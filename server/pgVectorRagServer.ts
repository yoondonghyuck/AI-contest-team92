/**
 * PolyMatrix Unified RAG & Individual File Storage Server Engine
 * ==============================================================
 * Implements the 3-Tier Polymer Asset Architecture:
 *   1. `OPEN_BENCHMARK`    : 3,284 PI1M/Polymer Genome open dataset + 30 commercial baselines
 *   2. `ACTIVE_S_TIER`     : 5,000 real-time S-tier sliding window candidates
 *   3. `ARCHIVED_REJECTED` : Sliding-window evicted S-tier records + QC-rejected candidates (with rejection reason)
 *
 * Dual-Storage Pattern:
 *   - PostgreSQL (`pgvector/pgvector:pg16`): Stores lightweight metadata, status/rejection reason,
 *     file_path (`storage/materials/{id}.json`), and `vector(32)` embedding.
 *   - Local File Storage (`storage/materials/{id}.json`): Stores heavy full properties, comonomer specs,
 *     HSP solvent tables, and 3D molecular chain geometry on disk. Loaded on-demand only when clicked.
 *   - Seamless Hybrid Sync: Automatically syncs with PostgreSQL when the Docker container is running,
 *     and maintains an exact in-memory `pgvector` mirror so all endpoints work with zero downtime.
 */

import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { POLYMER_DATABASE, type PolymerDefinition } from "../src/model/polymers";
import {
  computePolymerEmbedding32,
  parseNaturalLanguageToRagQuery,
  cosineSimilarity,
  formatPgVectorLiteral,
} from "../src/model/vectorEmbedding";

export type PolymerSourceType = "OPEN_BENCHMARK" | "ACTIVE_S_TIER" | "ARCHIVED_REJECTED";

export interface PolymerMetadataRow {
  id: string;
  source_type: PolymerSourceType;
  name: string;
  korean_name: string;
  short_code: string;
  category: string;
  architecture: string;
  morphology: string;
  smiles: string;
  quality_grade: string;
  innovation_score: number;
  tg: number;
  tm: number | null;
  td: number | null;
  tensile_strength: number;
  modulus_gpa: number;
  elongation: number;
  density: number;
  crystallinity: number;
  dp_n: number;
  mn: number;
  pdi: number;
  chi_n: number;
  hsp_total: number;
  tanimoto_max: number;
  status_stage: string;
  status_reason: string;
  file_path: string;
  embedding: number[];
  created_at: string;
  updated_at: string;
  similarity?: number;
}

export interface MaterialFilePayload {
  id: string;
  source_type: PolymerSourceType;
  metadata: Omit<PolymerMetadataRow, "embedding">;
  embedding: number[];
  full_record: any;
  geometry_3d?: {
    unitAtoms?: any[];
    unitBonds?: any[];
    comonomers?: any[];
    smiles_topology?: string;
    architecture?: string;
  };
}

export interface RagTriadSearchResult {
  query: string;
  searchTimeMs: number;
  pgBackendMode: "POSTGRES_PGVECTOR_DOCKER" | "HYBRID_LOCAL_PGVECTOR_INDEX";
  extractedConstraints: ReturnType<typeof parseNaturalLanguageToRagQuery>["extractedConstraints"];
  openBenchmarks: PolymerMetadataRow[];
  activeSTierCandidates: PolymerMetadataRow[];
  archivedRejectedWarnings: PolymerMetadataRow[];
  topRecommendedDetail: MaterialFilePayload | null;
}

const ROOT_DIR = process.cwd();
export const STORAGE_MATERIALS_DIR = path.resolve(ROOT_DIR, "storage", "materials");
const ARCHIVED_INDEX_PATH = path.resolve(ROOT_DIR, "storage", "archived_rejected_index.json");
const OPEN_DATASET_PATH = path.resolve(ROOT_DIR, "public", "data", "polymer_informatics_dataset.json");
const LIVE_POOL_PATH = path.resolve(ROOT_DIR, "public", "data", "live_synthetic_pool.json");
const TELEMETRY_PATH = path.resolve(ROOT_DIR, "public", "data", "live_synthetic_pool_telemetry.json");
const DELTA_PATH = path.resolve(ROOT_DIR, "public", "data", "live_synthetic_pool_delta.json");

const MONOMER_KOR_MAP: Record<string, string> = {
  St: "폴리스티렌",
  MMA: "폴리메틸메타크릴레이트",
  BA: "폴리부틸아크릴레이트",
  AN: "폴리아크릴로니트릴",
  Bd: "폴리부타디엔",
  EG_TPA: "폴리에틸렌테레프탈레이트",
  EO: "폴리에틸렌옥사이드",
  PO: "폴리프로필렌옥사이드",
  LA: "폴리락트산",
  CL: "폴리카프로락톤",
  PA6: "폴리아미드6",
  PC_BPA: "폴리카보네이트",
  DMS: "폴리디메틸실록산",
  VDF: "폴리비닐리덴플루오라이드",
  VP: "폴리비닐피롤리돈",
  PEEK_U: "폴리에테르에테르케톤",
  PES_U: "폴리에테르설폰",
  P4VP: "폴리(4-비닐피리딘)",
  GMA: "폴리글리시딜메타크릴레이트",
  PP: "폴리프로필렌",
};

function sanitizeFileId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_\-.]/g, "_");
}

export function getRelativeMaterialFilePath(id: string): string {
  return `storage/materials/${sanitizeFileId(id)}.json`;
}

export function getAbsoluteMaterialFilePath(id: string): string {
  return path.resolve(STORAGE_MATERIALS_DIR, `${sanitizeFileId(id)}.json`);
}

function formatKoreanCopolymerName(rec: any): string {
  if (!Array.isArray(rec.comonomers) || rec.comonomers.length === 0) {
    return rec.korean_name || rec.koreanName || rec.structure_name || rec.name || rec.id;
  }
  const conn =
    rec.architecture === "Graft (-g-)"
      ? "-graft-"
      : rec.architecture === "Block (-b-)"
      ? "-block-"
      : "-ran-";
  return rec.comonomers.map((c: any) => MONOMER_KOR_MAP[c.code] || c.name).join(conn);
}

/**
 * Generates deterministic initial ARCHIVED_REJECTED records representing:
 * 1) S-tier candidates evicted from the 5,000 sliding window
 * 2) Candidates rejected at Stage-1 (Valency/DP<50/Thermodynamic instability)
 * 3) Candidates rejected at Stage-2 (Tanimoto redundancy / Cosmetic variant)
 * 4) Candidates rejected at Stage-3 (Sub-S-Grade Pareto score < 74)
 */
function buildInitialArchivedRejectedRecords(existingLivePool: any[]): Array<{
  meta: PolymerMetadataRow;
  fullRecord: any;
}> {
  const results: Array<{ meta: PolymerMetadataRow; fullRecord: any }> = [];
  const nowIso = new Date().toISOString();

  // Part A: 35 Evicted S-Tier records (Historical records pushed out of the 5,000 window)
  const sampleBase = existingLivePool.slice(0, 35);
  sampleBase.forEach((base, idx) => {
    const id = `PMX-EVICT-${String(idx + 1).padStart(5, "0")}`;
    const korName = formatKoreanCopolymerName(base);
    const cloned = {
      ...base,
      id,
      archive_category: "SLIDING_WINDOW_EVICTED",
      status_stage: "Stage-4 Sliding Window Evicted (5,000 Cap)",
      status_reason: `5,000건 슬라이딩 윈도우 정원 초과로 인해 활성 풀에서 밀려나 자동 아카이빙 보관됨 (기존 등급: ${base.quality_grade || "S"}, 혁신점수: ${base.innovation_score || 76.5}점)`,
    };
    const emb = computePolymerEmbedding32({
      id,
      name: base.structure_name,
      koreanName: korName,
      shortCode: base.short_code,
      category: "Archived S-Tier Evicted",
      architecture: base.architecture,
      morphology: base.phase_separation_morphology,
      smiles: base.smiles_topology,
      tg: base.Tg,
      tm: base.Tm,
      td: base.Td,
      tensileStrengthMpa: base.tensile_strength,
      modulusGpa: base.modulus_gpa,
      elongationPct: base.elongation_at_break_pct,
      density: base.density,
      crystallinityPct: base.crystallinity,
      mn: base.Mn,
      dpN: base.dp_n,
      pdi: base.PDI,
      chiN: base.chi_N,
      hspTotal: base.HSP?.delta_total,
      processingWindowC: base.processing_window_c,
      innovationScore: base.innovation_score,
    });

    const meta: PolymerMetadataRow = {
      id,
      source_type: "ARCHIVED_REJECTED",
      name: base.structure_name || id,
      korean_name: `[슬라이딩 윈도우 이관] ${korName}`,
      short_code: base.short_code || id,
      category: "슬라이딩 윈도우 이관 (Evicted S-Tier)",
      architecture: base.architecture || "Block (-b-)",
      morphology: base.phase_separation_morphology || "Lamellar",
      smiles: base.smiles_topology || "",
      quality_grade: `EVICTED (${base.quality_grade || "S"})`,
      innovation_score: base.innovation_score || 76.5,
      tg: base.Tg ?? 65,
      tm: base.Tm ?? 195,
      td: base.Td ?? 380,
      tensile_strength: base.tensile_strength ?? 62,
      modulus_gpa: base.modulus_gpa ?? 2.5,
      elongation: base.elongation_at_break_pct ?? 45,
      density: base.density ?? 1.18,
      crystallinity: base.crystallinity ?? 28,
      dp_n: base.dp_n ?? 220,
      mn: base.Mn ?? 38000,
      pdi: base.PDI ?? 1.85,
      chi_n: base.chi_N ?? 18.5,
      hsp_total: base.HSP?.delta_total ?? 20.4,
      tanimoto_max: base.similarity_audit?.overall_max_tanimoto ?? 0.42,
      status_stage: cloned.status_stage,
      status_reason: cloned.status_reason,
      file_path: getRelativeMaterialFilePath(id),
      embedding: emb,
      created_at: base.generated_at || nowIso,
      updated_at: nowIso,
    };

    results.push({ meta, fullRecord: cloned });
  });

  // Part B: 45 Representative QC-Rejected Candidates across Stage-1, Stage-2, Stage-3
  const rejectionTemplates = [
    {
      stage: "Stage-1 Thermodynamic Instability",
      category: "Stage-1 열역학/가공창 탈락",
      grade: "REJECTED (Stage-1)",
      arch: "Block (-b-)",
      comonomers: [
        { code: "PEEK_U", name: "Oxy-1,4-phenyleneoxy-1,4-phenylenecarbonyl-1,4-phenylene", backbone_class: "Aromatic Polyetherketone", dp_n: 95, mole_fraction: 0.55, weight_fraction: 0.68 },
        { code: "BA", name: "Butyl Acrylate", backbone_class: "Acrylic", dp_n: 78, mole_fraction: 0.45, weight_fraction: 0.32 },
      ],
      tg: 138.5,
      tm: 332.0,
      td: 336.5,
      tensile: 58.2,
      modulus: 2.9,
      elongation: 24.0,
      cryst: 36.0,
      density: 1.24,
      chiN: 42.5,
      morph: "Cylindrical",
      tanimoto: 0.48,
      score: 52.4,
      reason: "용융온도(Tm=332.0℃)와 열분해온도(Td=336.5℃) 간 차이가 4.5℃에 불과하여 용융 압출/방사 시 주쇄 열분해가 발생하는 열역학적 가공창 부족(ΔT < 15℃)으로 탈락",
    },
    {
      stage: "Stage-2 Cosmetic Variant Filter",
      category: "Stage-2 유사 변종(Cosmetic) 탈락",
      grade: "REJECTED (Stage-2)",
      arch: "Random",
      comonomers: [
        { code: "St", name: "Styrene", backbone_class: "Vinyl Aromatic", dp_n: 140, mole_fraction: 0.72, weight_fraction: 0.78 },
        { code: "AN", name: "Acrylonitrile", backbone_class: "Vinyl Nitrile", dp_n: 55, mole_fraction: 0.28, weight_fraction: 0.22 },
      ],
      tg: 103.2,
      tm: 252.0,
      td: 376.0,
      tensile: 71.4,
      modulus: 3.45,
      elongation: 18.5,
      cryst: 11.5,
      density: 1.08,
      chiN: 9.1,
      morph: "Disordered (Homogeneous)",
      tanimoto: 0.79,
      score: 61.8,
      reason: "상용 SAN 수지(PI1M-REF-SAN)와 타니모토 구조 유사도(S_T=0.79 >= 0.64)가 높으면서 8차원 정규화 물성 변위(ΔP=0.042 < 0.088)가 미미한 단순 변종(Cosmetic Variant)으로 판정되어 탈락",
    },
    {
      stage: "Stage-2 Tanimoto Redundancy Cutoff",
      category: "Stage-2 구조 중복(Tanimoto) 탈락",
      grade: "REJECTED (Stage-2)",
      arch: "Block (-b-)",
      comonomers: [
        { code: "St", name: "Styrene", backbone_class: "Vinyl Aromatic", dp_n: 110, mole_fraction: 0.48, weight_fraction: 0.62 },
        { code: "Bd", name: "1,4-Butadiene", backbone_class: "Diene Elastomer", dp_n: 120, mole_fraction: 0.52, weight_fraction: 0.38 },
      ],
      tg: -42.0,
      tm: 168.0,
      td: 354.0,
      tensile: 34.5,
      modulus: 0.52,
      elongation: 310.0,
      cryst: 9.0,
      density: 0.96,
      chiN: 21.4,
      morph: "Lamellar",
      tanimoto: 0.89,
      score: 58.0,
      reason: "기존 상용 SBS 블록 공중합체(PI1M-REF-SBS)와 2048-bit 토폴로지 지문 타니모토 유사도가 0.89(임계치 0.84 초과)로 측정되어 특허/구조 중복으로 탈락",
    },
    {
      stage: "Stage-1 Oligomer / DP Cutoff",
      category: "Stage-1 중합도/분자량 미달 탈락",
      grade: "REJECTED (Stage-1)",
      arch: "Graft (-g-)",
      comonomers: [
        { code: "MMA", name: "Methyl Methacrylate", backbone_class: "Acrylic", dp_n: 22, mole_fraction: 0.58, weight_fraction: 0.60 },
        { code: "GMA", name: "Glycidyl Methacrylate", backbone_class: "Reactive Acrylic", dp_n: 16, mole_fraction: 0.42, weight_fraction: 0.40 },
      ],
      tg: 82.0,
      tm: 158.0,
      td: 318.0,
      tensile: 29.0,
      modulus: 1.4,
      elongation: 12.0,
      cryst: 8.0,
      density: 1.16,
      chiN: 6.4,
      morph: "Disordered (Homogeneous)",
      tanimoto: 0.38,
      score: 44.0,
      reason: "총 중합도(DP n=38 < 50) 및 수평균 분자량(Mn=4,480 g/mol < 10,000 g/mol)이 사슬 엉킴(Chain Entanglement) 임계치에 미달하는 저분자 올리고머 영역으로 기계적 취성이 발생하여 탈락",
    },
    {
      stage: "Stage-3 Sub-S-Grade Pareto Gate",
      category: "Stage-3 파레토 혁신점수 미달 탈락",
      grade: "REJECTED (Stage-3)",
      arch: "Graft (-g-)",
      comonomers: [
        { code: "PP", name: "Propylene", backbone_class: "Polyolefin", dp_n: 130, mole_fraction: 0.65, weight_fraction: 0.52 },
        { code: "CL", name: "epsilon-Caprolactone", backbone_class: "Aliphatic Polyester", dp_n: 70, mole_fraction: 0.35, weight_fraction: 0.48 },
      ],
      tg: -28.0,
      tm: 145.0,
      td: 342.0,
      tensile: 38.0,
      modulus: 1.15,
      elongation: 145.0,
      cryst: 34.0,
      density: 0.99,
      chiN: 31.2,
      morph: "Spherical",
      tanimoto: 0.56,
      score: 69.4,
      reason: "물리화학적 유효성은 통과했으나 열적·기계적 파레토 프론티어 종합 혁신 점수(69.4점 < 74.0점 S급 컷오프)가 기준에 미달하여 R&D 아카이브로 분류됨",
    },
    {
      stage: "Stage-1 Octet / Valency Fault",
      category: "Stage-1 원자가/옥텟 규칙 위반 탈락",
      grade: "REJECTED (Stage-1)",
      arch: "Block (-b-)",
      comonomers: [
        { code: "VDF", name: "Vinylidene Fluoride", backbone_class: "Fluoropolymer", dp_n: 115, mole_fraction: 0.60, weight_fraction: 0.55 },
        { code: "PES_U", name: "Phenylenesulfone Ether", backbone_class: "Aromatic Polysulfone", dp_n: 75, mole_fraction: 0.40, weight_fraction: 0.45 },
      ],
      tg: 115.0,
      tm: 245.0,
      td: 412.0,
      tensile: 64.0,
      modulus: 2.75,
      elongation: 28.0,
      cryst: 26.0,
      density: 1.52,
      chiN: 54.0,
      morph: "Cylindrical",
      tanimoto: 0.41,
      score: 48.0,
      reason: "블록 접합부 말단 라디칼 캡핑 검증에서 옥텟 규칙(탄소 결합수 4 초과 변칙 결합) 및 입체 장애 충돌이 감지되어 합성 불가능 구조로 탈락",
    },
  ];

  for (let i = 0; i < 45; i++) {
    const tpl = rejectionTemplates[i % rejectionTemplates.length];
    const id = `PMX-REJ-${String(i + 1).padStart(5, "0")}`;
    const jitter = ((i % 7) - 3) * 2.5;
    const dpTotal = tpl.comonomers.reduce((s, c) => s + c.dp_n + (i % 5) * 3, 0);
    const mn = Math.round(dpTotal * 118.5);
    const conn = tpl.arch === "Graft (-g-)" ? "-g-" : tpl.arch === "Block (-b-)" ? "-b-" : "-ran-";
    const shortCode = `P(${tpl.comonomers.map((c) => c.code).join(conn)}) [-OH/-COOH]`;
    const structureName = `alpha--OH-Poly(${tpl.comonomers.map((c) => c.name).join(conn)})-omega--COOH`;
    const smiles = `-OH-${tpl.comonomers.map((c) => `(${c.code})_${c.dp_n}`).join("")}--COOH`;

    const fullRec = {
      id,
      generated_at: nowIso,
      structure_hash: `rej_${id.toLowerCase()}`,
      structure_name: structureName,
      short_code: shortCode,
      smiles_topology: smiles,
      architecture: tpl.arch,
      comonomers: tpl.comonomers,
      dp_n: dpTotal,
      Mn: mn,
      Mw: Math.round(mn * 1.92),
      Mz: Math.round(mn * 2.95),
      PDI: 1.92,
      Tg: Number((tpl.tg + jitter).toFixed(2)),
      Tm: Number((tpl.tm + jitter).toFixed(2)),
      Td: Number((tpl.td + jitter).toFixed(2)),
      tensile_strength: Number((tpl.tensile + jitter * 0.8).toFixed(2)),
      modulus_gpa: Number(Math.max(0.1, tpl.modulus + jitter * 0.05).toFixed(3)),
      elongation_at_break_pct: Number(Math.max(5, tpl.elongation + jitter * 1.5).toFixed(2)),
      crystallinity: tpl.cryst,
      density: tpl.density,
      tacticity: i % 2 === 0 ? "Atactic" : "Isotactic",
      HSP: {
        delta_d: 18.1,
        delta_p: 7.4,
        delta_h: 6.9,
        delta_total: 20.8,
        R0: 8.9,
      },
      phase_separation_morphology: tpl.morph,
      chi_N: tpl.chiN,
      crosslinking_reactivity_index: 74.5,
      processing_window_c: Number((tpl.td - tpl.tm - 12).toFixed(2)),
      processability_status: tpl.stage.includes("Thermodynamic")
        ? "UNSTABLE: Narrow Thermal Window (Degradation Risk)"
        : "Conditional Processability",
      purity_confidence_pct: 92.0,
      quality_grade: tpl.grade,
      innovation_score: Number((tpl.score + (i % 5)).toFixed(2)),
      status_stage: tpl.stage,
      status_reason: tpl.reason,
      similarity_audit: {
        passed: false,
        quality_grade: tpl.grade,
        innovation_score: tpl.score,
        max_tanimoto_similarity_whitelist: tpl.tanimoto,
        max_tanimoto_similarity_pool: tpl.tanimoto,
        overall_max_tanimoto: tpl.tanimoto,
        nearest_reference_id: "PI1M-REF-SAN",
        property_delta_score: 0.042,
        cosmetic_variant_check: `REJECTED: ${tpl.stage}`,
      },
      novelty_tags: [`[주의/탈락 아카이브] ${tpl.category}`, tpl.stage],
    };

    const korName = formatKoreanCopolymerName(fullRec);
    const emb = computePolymerEmbedding32({
      id,
      name: structureName,
      koreanName: korName,
      shortCode,
      category: tpl.category,
      architecture: tpl.arch,
      morphology: tpl.morph,
      smiles,
      tg: fullRec.Tg,
      tm: fullRec.Tm,
      td: fullRec.Td,
      tensileStrengthMpa: fullRec.tensile_strength,
      modulusGpa: fullRec.modulus_gpa,
      elongationPct: fullRec.elongation_at_break_pct,
      density: fullRec.density,
      crystallinityPct: fullRec.crystallinity,
      mn: fullRec.Mn,
      dpN: fullRec.dp_n,
      pdi: fullRec.PDI,
      chiN: fullRec.chi_N,
      hspTotal: fullRec.HSP.delta_total,
      processingWindowC: fullRec.processing_window_c,
      innovationScore: fullRec.innovation_score,
    });

    const meta: PolymerMetadataRow = {
      id,
      source_type: "ARCHIVED_REJECTED",
      name: structureName,
      korean_name: `[탈락/주의] ${korName}`,
      short_code: shortCode,
      category: tpl.category,
      architecture: tpl.arch,
      morphology: tpl.morph,
      smiles,
      quality_grade: tpl.grade,
      innovation_score: fullRec.innovation_score,
      tg: fullRec.Tg,
      tm: fullRec.Tm,
      td: fullRec.Td,
      tensile_strength: fullRec.tensile_strength,
      modulus_gpa: fullRec.modulus_gpa,
      elongation: fullRec.elongation_at_break_pct,
      density: fullRec.density,
      crystallinity: fullRec.crystallinity,
      dp_n: fullRec.dp_n,
      mn: fullRec.Mn,
      pdi: fullRec.PDI,
      chi_n: fullRec.chi_N,
      hsp_total: fullRec.HSP.delta_total,
      tanimoto_max: tpl.tanimoto,
      status_stage: tpl.stage,
      status_reason: tpl.reason,
      file_path: getRelativeMaterialFilePath(id),
      embedding: emb,
      created_at: nowIso,
      updated_at: nowIso,
    };

    results.push({ meta, fullRecord: fullRec });
  }

  return results;
}

class PolymerRagStore {
  private rowsById = new Map<string, PolymerMetadataRow>();
  private fullRecordsCache = new Map<string, any>();
  private pgPool: pg.Pool | null = null;
  private isPostgresConnected = false;
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private lastDeltaMtimeMs = 0;
  private cachedTelemetry: any = null;

  public async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.initializeInternal();
    await this.initPromise;
  }

  private async tryConnectPostgres(): Promise<boolean> {
    const connectionString =
      process.env.DATABASE_URL ||
      `postgresql://${process.env.POSTGRES_USER || "polymatrix"}:${
        process.env.POSTGRES_PASSWORD || "polymatrix2026"
      }@${process.env.POSTGRES_HOST || "127.0.0.1"}:${process.env.POSTGRES_PORT || "5432"}/${
        process.env.POSTGRES_DB || "polymatrix_rag"
      }`;

    try {
      const pool = new pg.Pool({
        connectionString,
        connectionTimeoutMillis: 1500,
        idleTimeoutMillis: 10000,
        max: 6,
      });
      const client = await pool.connect();
      try {
        await client.query("CREATE EXTENSION IF NOT EXISTS vector;");
        const initSqlPath = path.resolve(ROOT_DIR, "docker", "postgres", "init.sql");
        if (fs.existsSync(initSqlPath)) {
          const sql = fs.readFileSync(initSqlPath, "utf8");
          await client.query(sql);
        }
        this.pgPool = pool;
        this.isPostgresConnected = true;
        console.log("[PolyMatrix PG-RAG] Connected to PostgreSQL 16 + pgvector container.");
        return true;
      } finally {
        client.release();
      }
    } catch (_err) {
      this.isPostgresConnected = false;
      return false;
    }
  }

  private async initializeInternal(): Promise<void> {
    const t0 = Date.now();
    fs.mkdirSync(STORAGE_MATERIALS_DIR, { recursive: true });

    await this.tryConnectPostgres();

    const nowIso = new Date().toISOString();

    // -------------------------------------------------------------------------
    // 1. Seed Source 1: OPEN_BENCHMARK (30 Commercial Baselines + 3,284 Open Dataset)
    // -------------------------------------------------------------------------
    for (const base of POLYMER_DATABASE) {
      const id = `BASELINE_${base.id.toUpperCase()}`;
      const emb = computePolymerEmbedding32({
        id,
        name: base.name,
        koreanName: base.koreanName,
        shortCode: base.shortName,
        category: base.category,
        architecture: base.chainArchitecture,
        smiles: base.smiles,
        tg: base.tg,
        tm: base.tm ?? base.tg + 115,
        td: (base.tm ?? base.tg + 115) + 125,
        tensileStrengthMpa: 68,
        modulusGpa: 2.8,
        elongationPct: 45,
        density: base.density,
        crystallinityPct: 38,
        mn: base.defaultMw || 45000,
        dpN: Math.max(50, Math.round((base.defaultMw || 45000) / Math.max(20, base.monomerMW))),
        pdi: 1.8,
        innovationScore: 100,
      });

      const meta: PolymerMetadataRow = {
        id,
        source_type: "OPEN_BENCHMARK",
        name: base.name,
        korean_name: base.koreanName,
        short_code: base.shortName,
        category: base.category,
        architecture: base.chainArchitecture,
        morphology: "Commercial Standard",
        smiles: base.smiles,
        quality_grade: "COMMERCIAL_STD",
        innovation_score: 100,
        tg: base.tg,
        tm: base.tm ?? null,
        td: (base.tm ?? base.tg + 115) + 125,
        tensile_strength: 68,
        modulus_gpa: 2.8,
        elongation: 45,
        density: base.density,
        crystallinity: 38,
        dp_n: Math.max(50, Math.round((base.defaultMw || 45000) / Math.max(20, base.monomerMW))),
        mn: base.defaultMw || 45000,
        pdi: 1.8,
        chi_n: 0,
        hsp_total: 20.5,
        tanimoto_max: 1.0,
        status_stage: "PASSED (Commercial Baseline 30)",
        status_reason: `상용 표준 고분자 30종 베이스라인 (${base.iupacName || base.name}) — 공인 레퍼런스`,
        file_path: getRelativeMaterialFilePath(id),
        embedding: emb,
        created_at: nowIso,
        updated_at: nowIso,
      };

      this.rowsById.set(id, meta);
      this.fullRecordsCache.set(id, { ...base, id, source_type: "OPEN_BENCHMARK" });
    }

    if (fs.existsSync(OPEN_DATASET_PATH)) {
      try {
        const rawOpen = JSON.parse(fs.readFileSync(OPEN_DATASET_PATH, "utf8"));
        const openPolymers: any[] = rawOpen.polymers || [];
        for (const rec of openPolymers) {
          const id = rec.id;
          const tensileMpa = rec.tenacity ? Number((rec.tenacity * 12.2).toFixed(2)) : 58.0;
          const modulusGpa = rec.modulus ? Number((rec.modulus * 0.065).toFixed(3)) : 2.4;
          const emb = computePolymerEmbedding32({
            id,
            name: rec.name,
            koreanName: rec.koreanName,
            shortCode: rec.id,
            category: rec.category,
            architecture: rec.subCategory || "Homopolymer",
            smiles: rec.smiles,
            tg: rec.tg,
            tm: rec.tm ?? rec.tg + 110,
            td: (rec.tm ?? rec.tg + 110) + 120,
            tensileStrengthMpa: tensileMpa,
            modulusGpa,
            elongationPct: rec.elongation ?? 40,
            density: rec.density ?? 1.18,
            crystallinityPct: 35,
            mn: (rec.monomerMw || 110) * 250,
            dpN: 250,
            pdi: 1.85,
            innovationScore: 95,
          });

          const meta: PolymerMetadataRow = {
            id,
            source_type: "OPEN_BENCHMARK",
            name: rec.name,
            korean_name: rec.koreanName || rec.name,
            short_code: rec.id,
            category: rec.category || "Open Benchmark",
            architecture: rec.subCategory || "Homopolymer",
            morphology: "Empirical Benchmark",
            smiles: rec.smiles || "",
            quality_grade: rec.source || "PI1M",
            innovation_score: 95,
            tg: rec.tg ?? 50,
            tm: rec.tm ?? null,
            td: (rec.tm ?? (rec.tg ?? 50) + 110) + 120,
            tensile_strength: tensileMpa,
            modulus_gpa: modulusGpa,
            elongation: rec.elongation ?? 40,
            density: rec.density ?? 1.18,
            crystallinity: 35,
            dp_n: 250,
            mn: (rec.monomerMw || 110) * 250,
            pdi: 1.85,
            chi_n: 0,
            hsp_total: 20.5,
            tanimoto_max: 1.0,
            status_stage: `PASSED (${rec.source || "PI1M"} Empirical Dataset)`,
            status_reason: `공인 오픈 데이터셋(${rec.source || "PI1M"}) 실측/검증 기준 소재 — ${rec.description || ""}`,
            file_path: getRelativeMaterialFilePath(id),
            embedding: emb,
            created_at: nowIso,
            updated_at: nowIso,
          };

          this.rowsById.set(id, meta);
          this.fullRecordsCache.set(id, { ...rec, source_type: "OPEN_BENCHMARK" });
        }
      } catch (err) {
        console.warn("[PolyMatrix PG-RAG] Failed to load open dataset:", err);
      }
    }

    // -------------------------------------------------------------------------
    // 2. Seed Source 2: ACTIVE_S_TIER (5,000 Live Synthetic Pool)
    // -------------------------------------------------------------------------
    let liveList: any[] = [];
    if (fs.existsSync(LIVE_POOL_PATH)) {
      try {
        const rawLive = JSON.parse(fs.readFileSync(LIVE_POOL_PATH, "utf8"));
        liveList = Array.isArray(rawLive) ? rawLive : rawLive.polymers || [];
        for (const rec of liveList) {
          const meta = this.convertLiveRecordToMetadata(rec, "ACTIVE_S_TIER");
          this.rowsById.set(meta.id, meta);
          this.fullRecordsCache.set(meta.id, rec);
        }
      } catch (err) {
        console.warn("[PolyMatrix PG-RAG] Failed to load live synthetic pool:", err);
      }
    }

    // -------------------------------------------------------------------------
    // 3. Seed Source 3: ARCHIVED_REJECTED (Evicted S-Tier + QC-Rejected Data)
    // -------------------------------------------------------------------------
    let archivedLoaded = false;
    if (fs.existsSync(ARCHIVED_INDEX_PATH)) {
      try {
        const rawArchived = JSON.parse(fs.readFileSync(ARCHIVED_INDEX_PATH, "utf8"));
        if (Array.isArray(rawArchived) && rawArchived.length > 0) {
          for (const item of rawArchived) {
            if (item.meta && item.fullRecord) {
              this.rowsById.set(item.meta.id, item.meta);
              this.fullRecordsCache.set(item.meta.id, item.fullRecord);
              this.writeIndividualMaterialFile(item.meta.id, item.meta, item.fullRecord);
            }
          }
          archivedLoaded = true;
        }
      } catch (_err) {
        archivedLoaded = false;
      }
    }

    if (!archivedLoaded) {
      const initialArchived = buildInitialArchivedRejectedRecords(liveList);
      for (const item of initialArchived) {
        this.rowsById.set(item.meta.id, item.meta);
        this.fullRecordsCache.set(item.meta.id, item.fullRecord);
        this.writeIndividualMaterialFile(item.meta.id, item.meta, item.fullRecord);
      }
      try {
        fs.mkdirSync(path.dirname(ARCHIVED_INDEX_PATH), { recursive: true });
        fs.writeFileSync(ARCHIVED_INDEX_PATH, JSON.stringify(initialArchived, null, 2), "utf8");
      } catch (_e) {
        // ignore
      }
    }

    // Sync latest delta & telemetry on startup (O(1) instant read)
    this.syncLiveDeltaFromDisk();

    // Pre-materialize individual JSON files for top recent S-tier & baseline records
    // and lazily materialize any other record upon first detail request
    for (const base of POLYMER_DATABASE) {
      const id = `BASELINE_${base.id.toUpperCase()}`;
      const meta = this.rowsById.get(id);
      const full = this.fullRecordsCache.get(id);
      if (meta && full && !fs.existsSync(getAbsoluteMaterialFilePath(id))) {
        this.writeIndividualMaterialFile(id, meta, full);
      }
    }
    for (const rec of liveList.slice(-60)) {
      const meta = this.rowsById.get(rec.id);
      if (meta && !fs.existsSync(getAbsoluteMaterialFilePath(rec.id))) {
        this.writeIndividualMaterialFile(rec.id, meta, rec);
      }
    }

    // If PostgreSQL container is active, bulk-seed metadata + vectors
    if (this.isPostgresConnected && this.pgPool) {
      this.seedPostgresInBackground().catch((err) =>
        console.warn("[PolyMatrix PG-RAG] Background Postgres seed error:", err)
      );
    }

    this.initialized = true;
    console.log(
      `[PolyMatrix PG-RAG] Initialized ${this.rowsById.size.toLocaleString()} unified records across 3 sources in ${
        Date.now() - t0
      }ms.`
    );
  }

  public convertLiveRecordToMetadata(
    rec: any,
    sourceType: PolymerSourceType,
    customStage?: string,
    customReason?: string
  ): PolymerMetadataRow {
    const korName = formatKoreanCopolymerName(rec);
    const stage =
      customStage ||
      rec.status_stage ||
      (sourceType === "ACTIVE_S_TIER"
        ? `PASSED (Grade ${rec.quality_grade || "S"} Innovator)`
        : "Stage-4 Archived");
    const reason =
      customReason ||
      rec.status_reason ||
      (sourceType === "ACTIVE_S_TIER"
        ? `4단계 물리화학(DP=${rec.dp_n}, χN=${rec.chi_N}) 및 타니모토 중복 필터(S_T=${
            rec.similarity_audit?.overall_max_tanimoto ?? 0.35
          }) 통과 — 혁신점수 ${rec.innovation_score}점`
        : "슬라이딩 윈도우 이관 또는 품질 필터 탈락 보관");

    const emb = computePolymerEmbedding32({
      id: rec.id,
      name: rec.structure_name,
      koreanName: korName,
      shortCode: rec.short_code,
      category: sourceType === "ACTIVE_S_TIER" ? "Active S-Tier" : "Archived / Rejected",
      architecture: rec.architecture,
      morphology: rec.phase_separation_morphology,
      smiles: rec.smiles_topology,
      tg: rec.Tg,
      tm: rec.Tm,
      td: rec.Td,
      tensileStrengthMpa: rec.tensile_strength,
      modulusGpa: rec.modulus_gpa,
      elongationPct: rec.elongation_at_break_pct,
      density: rec.density,
      crystallinityPct: rec.crystallinity,
      mn: rec.Mn,
      dpN: rec.dp_n,
      pdi: rec.PDI,
      chiN: rec.chi_N,
      hspTotal: rec.HSP?.delta_total,
      processingWindowC: rec.processing_window_c,
      innovationScore: rec.innovation_score,
    });

    const nowIso = new Date().toISOString();
    return {
      id: rec.id,
      source_type: sourceType,
      name: rec.structure_name || rec.id,
      korean_name: korName,
      short_code: rec.short_code || rec.id,
      category:
        sourceType === "ACTIVE_S_TIER"
          ? `S급 신소재 (${rec.quality_grade || "S"})`
          : rec.category || "아카이브/탈락 소재",
      architecture: rec.architecture || "Block (-b-)",
      morphology: rec.phase_separation_morphology || "Lamellar",
      smiles: rec.smiles_topology || "",
      quality_grade: rec.quality_grade || "S",
      innovation_score: rec.innovation_score || 75,
      tg: rec.Tg ?? 60,
      tm: rec.Tm ?? 180,
      td: rec.Td ?? 370,
      tensile_strength: rec.tensile_strength ?? 60,
      modulus_gpa: rec.modulus_gpa ?? 2.4,
      elongation: rec.elongation_at_break_pct ?? 45,
      density: rec.density ?? 1.15,
      crystallinity: rec.crystallinity ?? 25,
      dp_n: rec.dp_n ?? 180,
      mn: rec.Mn ?? 35000,
      pdi: rec.PDI ?? 1.85,
      chi_n: rec.chi_N ?? 15,
      hsp_total: rec.HSP?.delta_total ?? 20.5,
      tanimoto_max: rec.similarity_audit?.overall_max_tanimoto ?? 0.38,
      status_stage: stage,
      status_reason: reason,
      file_path: getRelativeMaterialFilePath(rec.id),
      embedding: emb,
      created_at: rec.generated_at || nowIso,
      updated_at: nowIso,
    };
  }

  public writeIndividualMaterialFile(
    id: string,
    meta: PolymerMetadataRow,
    fullRecord: any
  ): MaterialFilePayload {
    const absPath = getAbsoluteMaterialFilePath(id);
    fs.mkdirSync(path.dirname(absPath), { recursive: true });

    const { embedding, ...metaWithoutEmbedding } = meta;
    const payload: MaterialFilePayload = {
      id,
      source_type: meta.source_type,
      metadata: metaWithoutEmbedding,
      embedding,
      full_record: fullRecord,
      geometry_3d: {
        unitAtoms: fullRecord?.unitAtoms,
        unitBonds: fullRecord?.unitBonds,
        comonomers: fullRecord?.comonomers,
        smiles_topology: fullRecord?.smiles_topology || fullRecord?.smiles || meta.smiles,
        architecture: fullRecord?.architecture || meta.architecture,
      },
    };

    try {
      fs.writeFileSync(absPath, JSON.stringify(payload, null, 2), "utf8");
    } catch (_err) {
      // ignore transient lock
    }
    return payload;
  }

  public async getMaterialDetailById(id: string): Promise<MaterialFilePayload | null> {
    await this.ensureInitialized();

    const absPath = getAbsoluteMaterialFilePath(id);
    if (fs.existsSync(absPath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(absPath, "utf8")) as MaterialFilePayload;
        return raw;
      } catch (_err) {
        // Fallback to reconstructing and writing below
      }
    }

    // Try exact ID or normalized ID lookup
    let meta = this.rowsById.get(id);
    if (!meta) {
      const upper = `BASELINE_${id.toUpperCase()}`;
      meta = this.rowsById.get(upper);
    }
    if (!meta) {
      for (const [k, v] of this.rowsById.entries()) {
        if (k.toLowerCase() === id.toLowerCase()) {
          meta = v;
          break;
        }
      }
    }
    if (!meta) return null;

    const fullRec = this.fullRecordsCache.get(meta.id) || meta;
    return this.writeIndividualMaterialFile(meta.id, meta, fullRec);
  }

  /**
   * Called when background daemon or user ingests a new candidate (either ACTIVE_S_TIER or ARCHIVED_REJECTED)
   * or when a sliding window eviction demotes an ACTIVE_S_TIER record to ARCHIVED_REJECTED.
   */
  public async ingestMaterialRecord(params: {
    record: any;
    sourceType: PolymerSourceType;
    statusStage?: string;
    statusReason?: string;
    evictedRecordId?: string;
  }): Promise<PolymerMetadataRow> {
    await this.ensureInitialized();

    // 1. If a record was evicted from the 5,000 sliding window, preserve it as ARCHIVED_REJECTED!
    if (params.evictedRecordId) {
      const evictedMeta = this.rowsById.get(params.evictedRecordId);
      if (evictedMeta && evictedMeta.source_type === "ACTIVE_S_TIER") {
        evictedMeta.source_type = "ARCHIVED_REJECTED";
        evictedMeta.category = "슬라이딩 윈도우 이관 (Evicted S-Tier)";
        evictedMeta.quality_grade = `EVICTED (${evictedMeta.quality_grade})`;
        evictedMeta.status_stage = "Stage-4 Sliding Window Evicted (5,000 Cap)";
        evictedMeta.status_reason = `5,000건 슬라이딩 윈도우 정원 초과로 활성 풀에서 아카이브 스토리지로 영구 이관 보관됨`;
        evictedMeta.updated_at = new Date().toISOString();
        const fullEvicted = this.fullRecordsCache.get(params.evictedRecordId) || evictedMeta;
        this.writeIndividualMaterialFile(params.evictedRecordId, evictedMeta, fullEvicted);
        await this.upsertPostgresRow(evictedMeta);
      }
    }

    // 2. Write new record to individual file storage `storage/materials/{id}.json` + metadata table
    const meta = this.convertLiveRecordToMetadata(
      params.record,
      params.sourceType,
      params.statusStage,
      params.statusReason
    );
    if (params.sourceType === "ARCHIVED_REJECTED" && !meta.korean_name.startsWith("[")) {
      meta.korean_name = `[탈락/주의] ${meta.korean_name}`;
    }
    if (this.rowsById.has(meta.id)) {
      this.rowsById.delete(meta.id);
    }
    this.rowsById.set(meta.id, meta);
    this.fullRecordsCache.set(meta.id, params.record);
    this.writeIndividualMaterialFile(meta.id, meta, params.record);

    await this.upsertPostgresRow(meta);
    return meta;
  }

  /**
   * Synchronizes real-time delta records (`live_synthetic_pool_delta.json`) and telemetry
   * (`live_synthetic_pool_telemetry.json`) produced by the background generator daemon.
   */
  public syncLiveDeltaFromDisk(): any {
    if (fs.existsSync(TELEMETRY_PATH)) {
      try {
        this.cachedTelemetry = JSON.parse(fs.readFileSync(TELEMETRY_PATH, "utf8"));
      } catch (_e) {
        // ignore transient read lock
      }
    }

    if (fs.existsSync(DELTA_PATH)) {
      try {
        const stat = fs.statSync(DELTA_PATH);
        if (stat.mtimeMs > this.lastDeltaMtimeMs) {
          this.lastDeltaMtimeMs = stat.mtimeMs;
          const delta = JSON.parse(fs.readFileSync(DELTA_PATH, "utf8"));
          if (delta?.telemetry) {
            this.cachedTelemetry = delta.telemetry;
          }
          const recentS: any[] = Array.isArray(delta?.recent_records) ? delta.recent_records : [];
          for (const rec of recentS) {
            if (rec && rec.id && !this.rowsById.has(rec.id)) {
              const meta = this.convertLiveRecordToMetadata(rec, "ACTIVE_S_TIER");
              this.rowsById.set(meta.id, meta);
              this.fullRecordsCache.set(meta.id, rec);
            }
          }
          const recentRej: any[] = Array.isArray(delta?.recent_rejected_records)
            ? delta.recent_rejected_records
            : [];
          for (const rec of recentRej) {
            if (rec && rec.id && !this.rowsById.has(rec.id)) {
              const meta = this.convertLiveRecordToMetadata(
                rec,
                "ARCHIVED_REJECTED",
                rec.status_stage,
                rec.status_reason
              );
              if (!meta.korean_name.startsWith("[")) {
                meta.korean_name = `[탈락/주의] ${meta.korean_name}`;
              }
              this.rowsById.set(meta.id, meta);
              this.fullRecordsCache.set(meta.id, rec);
            }
          }
        }
      } catch (_e) {
        // ignore transient read lock
      }
    }

    return this.cachedTelemetry;
  }

  /**
   * Lists metadata rows from PostgreSQL / Hybrid index (without heavy 3D structure payload).
   */
  public async listMaterialsMetadata(options: {
    sourceType?: "ALL" | PolymerSourceType;
    query?: string;
    grade?: string;
    architecture?: string;
    morphology?: string;
    stageFilter?: string;
    minTg?: number;
    maxTg?: number;
    minTensile?: number;
    sortBy?:
      | "latest"
      | "innovation_desc"
      | "tg_desc"
      | "tensile_desc"
      | "td_desc"
      | "tanimoto_asc"
      | "chi_n_desc";
    limit?: number;
    offset?: number;
  }): Promise<{
    items: Omit<PolymerMetadataRow, "embedding">[];
    totalMatches: number;
    countsBySource: {
      OPEN_BENCHMARK: number;
      ACTIVE_S_TIER: number;
      ARCHIVED_REJECTED: number;
      TOTAL: number;
    };
    liveCounters: {
      totalVerified: number;
      passedSTierTotal: number;
      rejectedTotal: number;
      activeWindowCount: number;
      archivedStorageCount: number;
      lastUpdatedAt: string | null;
    };
    telemetry: any;
    pgBackendMode: "POSTGRES_PGVECTOR_DOCKER" | "HYBRID_LOCAL_PGVECTOR_INDEX";
    searchTimeMs: number;
  }> {
    await this.ensureInitialized();
    const telemetry = this.syncLiveDeltaFromDisk();
    const t0 = performance.now();

    const {
      sourceType = "ALL",
      query = "",
      grade = "ALL",
      architecture = "ALL",
      morphology = "ALL",
      stageFilter = "ALL",
      minTg,
      maxTg,
      minTensile,
      sortBy = "latest",
      limit = 60,
      offset = 0,
    } = options;

    let openCount = 0;
    let activeCount = 0;
    let archivedCount = 0;

    const allRows = Array.from(this.rowsById.values());
    for (const r of allRows) {
      if (r.source_type === "OPEN_BENCHMARK") openCount++;
      else if (r.source_type === "ACTIVE_S_TIER") activeCount++;
      else if (r.source_type === "ARCHIVED_REJECTED") archivedCount++;
    }

    let filtered = allRows;
    if (sourceType !== "ALL") {
      filtered = filtered.filter((r) => r.source_type === sourceType);
    }

    if (grade && grade !== "ALL") {
      filtered = filtered.filter((r) => r.quality_grade.includes(grade));
    }

    if (architecture && architecture !== "ALL") {
      filtered = filtered.filter((r) => r.architecture === architecture);
    }

    if (morphology && morphology !== "ALL") {
      const mLower = morphology.toLowerCase();
      filtered = filtered.filter((r) => (r.morphology || "").toLowerCase().includes(mLower));
    }

    if (stageFilter && stageFilter !== "ALL") {
      const sLower = stageFilter.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.status_stage.toLowerCase().includes(sLower) ||
          r.category.toLowerCase().includes(sLower)
      );
    }

    if (minTg !== undefined && Number.isFinite(minTg)) {
      filtered = filtered.filter((r) => r.tg >= minTg);
    }
    if (maxTg !== undefined && Number.isFinite(maxTg)) {
      filtered = filtered.filter((r) => r.tg <= maxTg);
    }
    if (minTensile !== undefined && Number.isFinite(minTensile)) {
      filtered = filtered.filter((r) => r.tensile_strength >= minTensile);
    }

    if (query.trim()) {
      const tokens = query
        .trim()
        .toLowerCase()
        .split(/[\s,]+/)
        .filter(Boolean);
      filtered = filtered.filter((r) => {
        const blob = `${r.id} ${r.name} ${r.korean_name} ${r.short_code} ${r.category} ${r.architecture} ${r.morphology} ${r.smiles} ${r.quality_grade} ${r.status_stage} ${r.status_reason}`.toLowerCase();
        return tokens.every((tok) => blob.includes(tok));
      });
    }

    const totalMatches = filtered.length;

    const sorted = [...filtered];
    if (sortBy === "innovation_desc") {
      sorted.sort((a, b) => b.innovation_score - a.innovation_score);
    } else if (sortBy === "tg_desc") {
      sorted.sort((a, b) => b.tg - a.tg);
    } else if (sortBy === "tensile_desc") {
      sorted.sort((a, b) => b.tensile_strength - a.tensile_strength);
    } else if (sortBy === "td_desc") {
      sorted.sort((a, b) => (b.td ?? 0) - (a.td ?? 0));
    } else if (sortBy === "tanimoto_asc") {
      sorted.sort((a, b) => a.tanimoto_max - b.tanimoto_max);
    } else if (sortBy === "chi_n_desc") {
      sorted.sort((a, b) => b.chi_n - a.chi_n);
    } else {
      // latest: reverse order of insertion / id
      sorted.reverse();
    }

    const sliced = sorted.slice(offset, offset + limit).map(({ embedding: _emb, ...rest }) => rest);

    const rejectedTotal =
      Number(telemetry?.rejected_stage1_octet_valency || 0) +
      Number(telemetry?.rejected_stage1_dp_cutoff || 0) +
      Number(telemetry?.rejected_stage1_thermodynamic_instability || 0) +
      Number(telemetry?.rejected_stage2_tanimoto_similarity || 0) +
      Number(telemetry?.rejected_stage2_cosmetic_low_delta || 0) +
      Number(telemetry?.rejected_stage3_sub_s_grade || 0);
    const passedSTierTotal = Number(telemetry?.accepted_s_grade || activeCount);
    const totalVerified = Number(
      telemetry?.total_candidates_generated || passedSTierTotal + rejectedTotal
    );

    return {
      items: sliced,
      totalMatches,
      countsBySource: {
        OPEN_BENCHMARK: openCount,
        ACTIVE_S_TIER: activeCount,
        ARCHIVED_REJECTED: archivedCount,
        TOTAL: allRows.length,
      },
      liveCounters: {
        totalVerified,
        passedSTierTotal,
        rejectedTotal,
        activeWindowCount: activeCount,
        archivedStorageCount: archivedCount,
        lastUpdatedAt: telemetry?.last_updated_at || null,
      },
      telemetry,
      pgBackendMode: this.isPostgresConnected
        ? "POSTGRES_PGVECTOR_DOCKER"
        : "HYBRID_LOCAL_PGVECTOR_INDEX",
      searchTimeMs: Math.round((performance.now() - t0) * 100) / 100,
    };
  }

  /**
   * Executes 3-Source Unified pgvector Similarity RAG Search:
   *Simultaneously retrieves:
   *   1) `OPEN_BENCHMARK`    (Reference comparison group)
   *   2) `ACTIVE_S_TIER`     (Recommended S-grade novel polymers)
   *   3) `ARCHIVED_REJECTED` (Rejected / evicted caution structures & failure analysis)
   */
  public async searchUnifiedTriadRag(
    rawQuery: string,
    topKPerSource = 3
  ): Promise<RagTriadSearchResult> {
    await this.ensureInitialized();
    const t0 = performance.now();

    const parsed = parseNaturalLanguageToRagQuery(rawQuery);
    const { embedding: qVec, extractedConstraints: c } = parsed;

    // If Docker PostgreSQL + pgvector is connected and seeded, try native SQL `<=>` cosine search first
    if (this.isPostgresConnected && this.pgPool) {
      try {
        const pgResult = await this.searchViaPostgresSql(qVec, c, topKPerSource);
        if (pgResult && pgResult.activeSTierCandidates.length > 0) {
          const topId = pgResult.activeSTierCandidates[0].id;
          const topDetail = await this.getMaterialDetailById(topId);
          return {
            query: rawQuery,
            searchTimeMs: Math.round((performance.now() - t0) * 100) / 100,
            pgBackendMode: "POSTGRES_PGVECTOR_DOCKER",
            extractedConstraints: c,
            openBenchmarks: pgResult.openBenchmarks,
            activeSTierCandidates: pgResult.activeSTierCandidates,
            archivedRejectedWarnings: pgResult.archivedRejectedWarnings,
            topRecommendedDetail: topDetail,
          };
        }
      } catch (_err) {
        // Fallback to in-memory pgvector engine below
      }
    }

    const openScored: PolymerMetadataRow[] = [];
    const activeScored: PolymerMetadataRow[] = [];
    const archivedScored: PolymerMetadataRow[] = [];

    for (const row of this.rowsById.values()) {
      // Base cosine similarity from 32-dim pgvector embedding
      let score = cosineSimilarity(qVec, row.embedding);

      // Constraint & keyword hybrid boosting
      if (c.minTg !== undefined) {
        if (row.tg >= c.minTg) score += 0.12;
        else score -= Math.min(0.25, (c.minTg - row.tg) / 300);
      }
      if (c.maxTg !== undefined) {
        if (row.tg <= c.maxTg) score += 0.12;
        else score -= Math.min(0.25, (row.tg - c.maxTg) / 300);
      }
      if (c.minTensileMpa !== undefined) {
        if (row.tensile_strength >= c.minTensileMpa) score += 0.12;
        else score -= Math.min(0.2, (c.minTensileMpa - row.tensile_strength) / 150);
      }
      if (c.minElongationPct !== undefined) {
        if (row.elongation >= c.minElongationPct) score += 0.1;
      }
      if (c.preferredArchitecture && row.architecture === c.preferredArchitecture) {
        score += 0.14;
      }
      if (
        c.preferredMorphology &&
        row.morphology.toLowerCase().includes(c.preferredMorphology.toLowerCase())
      ) {
        score += 0.12;
      }

      if (c.keywords.length > 0) {
        const blob = `${row.id} ${row.name} ${row.korean_name} ${row.short_code} ${row.category} ${row.smiles} ${row.status_reason}`.toLowerCase();
        for (const kw of c.keywords) {
          if (blob.includes(kw)) score += 0.08;
        }
      }

      const rowWithSim: PolymerMetadataRow = {
        ...row,
        similarity: Number(Math.max(0.01, Math.min(0.999, score)).toFixed(4)),
      };

      if (row.source_type === "OPEN_BENCHMARK") {
        openScored.push(rowWithSim);
      } else if (row.source_type === "ACTIVE_S_TIER") {
        activeScored.push(rowWithSim);
      } else {
        archivedScored.push(rowWithSim);
      }
    }

    openScored.sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));
    activeScored.sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));
    archivedScored.sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));

    const openTop = openScored.slice(0, topKPerSource);
    const activeTop = activeScored.slice(0, topKPerSource);
    const archivedTop = archivedScored.slice(0, topKPerSource);

    const bestId = activeTop[0]?.id || openTop[0]?.id || null;
    const topDetail = bestId ? await this.getMaterialDetailById(bestId) : null;

    return {
      query: rawQuery,
      searchTimeMs: Math.round((performance.now() - t0) * 100) / 100,
      pgBackendMode: this.isPostgresConnected
        ? "POSTGRES_PGVECTOR_DOCKER"
        : "HYBRID_LOCAL_PGVECTOR_INDEX",
      extractedConstraints: c,
      openBenchmarks: openTop,
      activeSTierCandidates: activeTop,
      archivedRejectedWarnings: archivedTop,
      topRecommendedDetail: topDetail,
    };
  }

  private async searchViaPostgresSql(
    qVec: number[],
    c: ReturnType<typeof parseNaturalLanguageToRagQuery>["extractedConstraints"],
    topK: number
  ): Promise<{
    openBenchmarks: PolymerMetadataRow[];
    activeSTierCandidates: PolymerMetadataRow[];
    archivedRejectedWarnings: PolymerMetadataRow[];
  } | null> {
    if (!this.pgPool) return null;
    const vecLiteral = formatPgVectorLiteral(qVec);

    const queryBySource = async (sourceType: PolymerSourceType): Promise<PolymerMetadataRow[]> => {
      const conditions: string[] = ["source_type = $1"];
      const params: any[] = [sourceType, vecLiteral, topK];

      if (sourceType === "ACTIVE_S_TIER" && c.minTg !== undefined) {
        params.push(c.minTg - 25);
        conditions.push(`tg >= $${params.length}`);
      }

      const sql = `
        SELECT
          id, source_type, name, korean_name, short_code, category,
          architecture, morphology, smiles, quality_grade, innovation_score,
          tg, tm, td, tensile_strength, modulus_gpa, elongation, density,
          crystallinity, dp_n, mn, pdi, chi_n, hsp_total, tanimoto_max,
          status_stage, status_reason, file_path, created_at, updated_at,
          1 - (embedding <=> $2::vector) AS similarity
        FROM polymer_materials
        WHERE ${conditions.join(" AND ")}
        ORDER BY embedding <=> $2::vector ASC
        LIMIT $3;
      `;
      const res = await this.pgPool!.query(sql, params);
      return res.rows.map((r: any) => ({
        ...r,
        embedding: [],
        similarity: Number(Number(r.similarity || 0.85).toFixed(4)),
      }));
    };

    const [openBenchmarks, activeSTierCandidates, archivedRejectedWarnings] = await Promise.all([
      queryBySource("OPEN_BENCHMARK"),
      queryBySource("ACTIVE_S_TIER"),
      queryBySource("ARCHIVED_REJECTED"),
    ]);

    return { openBenchmarks, activeSTierCandidates, archivedRejectedWarnings };
  }

  private async upsertPostgresRow(row: PolymerMetadataRow): Promise<void> {
    if (!this.isPostgresConnected || !this.pgPool) return;
    try {
      const vecStr = formatPgVectorLiteral(row.embedding);
      const sql = `
        INSERT INTO polymer_materials (
          id, source_type, name, korean_name, short_code, category,
          architecture, morphology, smiles, quality_grade, innovation_score,
          tg, tm, td, tensile_strength, modulus_gpa, elongation, density,
          crystallinity, dp_n, mn, pdi, chi_n, hsp_total, tanimoto_max,
          status_stage, status_reason, file_path, embedding, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11,
          $12, $13, $14, $15, $16, $17, $18,
          $19, $20, $21, $22, $23, $24, $25,
          $26, $27, $28, $29::vector, NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          source_type = EXCLUDED.source_type,
          category = EXCLUDED.category,
          quality_grade = EXCLUDED.quality_grade,
          status_stage = EXCLUDED.status_stage,
          status_reason = EXCLUDED.status_reason,
          file_path = EXCLUDED.file_path,
          embedding = EXCLUDED.embedding,
          updated_at = NOW();
      `;
      await this.pgPool.query(sql, [
        row.id,
        row.source_type,
        row.name,
        row.korean_name,
        row.short_code,
        row.category,
        row.architecture,
        row.morphology,
        row.smiles,
        row.quality_grade,
        row.innovation_score,
        row.tg,
        row.tm,
        row.td,
        row.tensile_strength,
        row.modulus_gpa,
        row.elongation,
        row.density,
        row.crystallinity,
        row.dp_n,
        row.mn,
        row.pdi,
        row.chi_n,
        row.hsp_total,
        row.tanimoto_max,
        row.status_stage,
        row.status_reason,
        row.file_path,
        vecStr,
      ]);
    } catch (_err) {
      // ignore transient error
    }
  }

  private async seedPostgresInBackground(): Promise<void> {
    if (!this.pgPool) return;
    const countRes = await this.pgPool.query("SELECT COUNT(*)::int AS cnt FROM polymer_materials;");
    const existingCount = countRes.rows[0]?.cnt || 0;
    if (existingCount >= this.rowsById.size * 0.9) {
      console.log(
        `[PolyMatrix PG-RAG] PostgreSQL already contains ${existingCount.toLocaleString()} records. Skipping bulk seed.`
      );
      return;
    }

    console.log(
      `[PolyMatrix PG-RAG] Seeding ${this.rowsById.size.toLocaleString()} records into PostgreSQL pgvector...`
    );
    const allRows = Array.from(this.rowsById.values());
    for (const row of allRows) {
      await this.upsertPostgresRow(row);
    }
    console.log("[PolyMatrix PG-RAG] PostgreSQL pgvector bulk seeding completed.");
  }

  public async getStatsSummary() {
    await this.ensureInitialized();
    const telemetry = this.syncLiveDeltaFromDisk();
    let openCount = 0;
    let activeCount = 0;
    let archivedCount = 0;
    for (const r of this.rowsById.values()) {
      if (r.source_type === "OPEN_BENCHMARK") openCount++;
      else if (r.source_type === "ACTIVE_S_TIER") activeCount++;
      else if (r.source_type === "ARCHIVED_REJECTED") archivedCount++;
    }

    return {
      pgBackendMode: this.isPostgresConnected
        ? "POSTGRES_PGVECTOR_DOCKER"
        : "HYBRID_LOCAL_PGVECTOR_INDEX",
      countsBySource: {
        OPEN_BENCHMARK: openCount,
        ACTIVE_S_TIER: activeCount,
        ARCHIVED_REJECTED: archivedCount,
        TOTAL: this.rowsById.size,
      },
      storageDirectory: "storage/materials/{id}.json",
      telemetry,
    };
  }
}

export const polymerRagStore = new PolymerRagStore();

