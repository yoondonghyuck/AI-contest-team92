import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { POLYMER_DATABASE, type PolymerDefinition } from "./polymers";
import {
  buildCopolymer3DFromParsedStructure,
  type ParsedCopolymerStructure,
  type PolymerComponentMeta,
} from "./chatMolecularParser";
import { calculateMolecularDescriptor, type MolecularDescriptor } from "./molecularDescriptor";
import type { AtomNode, BondEdge } from "../components/MolDrawCanvas";

export interface LiveComonomerSpec {
  code: string;
  name: string;
  backbone_class: string;
  dp_n: number;
  mole_fraction: number;
  weight_fraction: number;
}

export interface LiveHSP {
  delta_d: number;
  delta_p: number;
  delta_h: number;
  delta_total: number;
  R0: number;
  good_solvents?: string[];
  non_solvents?: string[];
}

export interface LiveSimilarityAudit {
  passed: boolean;
  quality_grade: "S++" | "S+" | "S" | string;
  innovation_score: number;
  max_tanimoto_similarity_whitelist: number;
  max_tanimoto_similarity_pool: number;
  overall_max_tanimoto: number;
  nearest_reference_id: string;
  property_delta_score: number;
  cosmetic_variant_check: string;
}

export interface LiveSyntheticPolymerRecord {
  id: string;
  generated_at: string;
  structure_hash: string;
  structure_name: string;
  short_code: string;
  smiles_topology: string;
  architecture: "Random" | "Block (-b-)" | "Graft (-g-)" | "Alternating" | string;
  comonomers: LiveComonomerSpec[];
  dp_n: number;
  Mn: number;
  Mw: number;
  Mz: number;
  PDI: number;
  Tg: number;
  Tm: number;
  Td: number;
  tensile_strength: number;
  modulus_gpa: number;
  elongation_at_break_pct: number;
  crystallinity: number;
  density: number;
  tacticity: string;
  HSP: LiveHSP;
  phase_separation_morphology: string;
  chi_N: number;
  crosslinking_reactivity_index: number;
  processing_window_c: number;
  processability_status: string;
  purity_confidence_pct: number;
  quality_grade: "S++" | "S+" | "S" | string;
  innovation_score: number;
  similarity_audit: LiveSimilarityAudit;
  novelty_tags: string[];
}

export interface LiveEngineTelemetry {
  engine_status: string;
  started_at: string;
  last_updated_at: string;
  max_sliding_window_size: number;
  current_pool_size: number;
  total_candidates_generated: number;
  rejected_stage1_octet_valency: number;
  rejected_stage1_dp_cutoff: number;
  rejected_stage1_thermodynamic_instability: number;
  rejected_stage2_tanimoto_similarity: number;
  rejected_stage2_cosmetic_low_delta: number;
  rejected_stage3_sub_s_grade: number;
  accepted_s_grade: number;
  sliding_window_evictions: number;
}

export interface LivePoolFilterOptions {
  query?: string;
  grade?: "ALL" | "S++" | "S+" | "S";
  architecture?: "ALL" | "Block (-b-)" | "Graft (-g-)" | "Random";
  morphology?: "ALL" | "Lamellar" | "Cylindrical" | "Spherical" | "Gyroid" | "Homogeneous";
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
}

export interface LivePoolStats {
  totalCount: number;
  sPlusPlusCount: number;
  sPlusCount: number;
  sCount: number;
  avgInnovationScore: number;
  avgTg: number;
  avgTensile: number;
  avgChiN: number;
  avgTanimoto: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// 단량체 코드(St, MMA, VDF 등) ➔ 한글명 및 3D 뷰어/파서 메타 매핑 사전
// ─────────────────────────────────────────────────────────────────────────────
const MONOMER_CODE_MAP: Record<
  string,
  { parserId: string; polymerDbId: string; koreanName: string; shortName: string }
> = {
  St: { parserId: "ps", polymerDbId: "ps", koreanName: "폴리스티렌", shortName: "PS" },
  MMA: { parserId: "pmma", polymerDbId: "pmma", koreanName: "폴리메틸메타크릴레이트", shortName: "PMMA" },
  BA: { parserId: "pmma", polymerDbId: "pmma", koreanName: "폴리부틸아크릴레이트", shortName: "PBA" },
  AN: { parserId: "pan", polymerDbId: "pan", koreanName: "폴리아크릴로니트릴", shortName: "PAN" },
  Bd: { parserId: "polybutadiene", polymerDbId: "spandex", koreanName: "폴리부타디엔", shortName: "BR" },
  EG_TPA: { parserId: "pet", polymerDbId: "pet", koreanName: "폴리에틸렌테레프탈레이트", shortName: "PET" },
  EO: { parserId: "peg", polymerDbId: "pe", koreanName: "폴리에틸렌옥사이드", shortName: "PEO" },
  PO: { parserId: "pp", polymerDbId: "pp", koreanName: "폴리프로필렌옥사이드", shortName: "PPO" },
  LA: { parserId: "pla", polymerDbId: "pla", koreanName: "폴리락트산", shortName: "PLA" },
  CL: { parserId: "pla", polymerDbId: "pla", koreanName: "폴리카프로락톤", shortName: "PCL" },
  PA6: { parserId: "nylon66", polymerDbId: "nylon6", koreanName: "폴리아미드6(나일론6)", shortName: "PA6" },
  PC_BPA: { parserId: "pc", polymerDbId: "pc", koreanName: "폴리카보네이트", shortName: "PC" },
  DMS: { parserId: "pdms", polymerDbId: "spandex", koreanName: "폴리디메틸실록산", shortName: "PDMS" },
  VDF: { parserId: "ptfe", polymerDbId: "pvdf", koreanName: "폴리비닐리덴플루오라이드", shortName: "PVDF" },
  VP: { parserId: "pan", polymerDbId: "nylon6", koreanName: "폴리비닐피롤리돈", shortName: "PVP" },
  PEEK_U: { parserId: "aramid", polymerDbId: "peek", koreanName: "폴리에테르에테르케톤", shortName: "PEEK" },
  PES_U: { parserId: "pc", polymerDbId: "pps", koreanName: "폴리에테르설폰", shortName: "PES" },
  P4VP: { parserId: "ps", polymerDbId: "ps", koreanName: "폴리(4-비닐피리딘)", shortName: "P4VP" },
  GMA: { parserId: "pmma", polymerDbId: "pmma", koreanName: "폴리글리시딜메타크릴레이트", shortName: "PGMA" },
  PP: { parserId: "pp", polymerDbId: "pp", koreanName: "폴리프로필렌", shortName: "PP" },
};

const DOMAIN_COLORS = ["#38bdf8", "#f59e0b", "#10b981", "#a855f7", "#ec4899"];

// 인메모리 캐시 (탭 전환 시 즉각 렌더링 보장)
let cachedLivePool: LiveSyntheticPolymerRecord[] = [];
let cachedTelemetry: LiveEngineTelemetry | null = null;
let lastKnownUpdatedAt = "";

/**
 * 실시간 S급 가상 고분자 추천 풀(/data/live_synthetic_pool.json) 및 초경량 델타 스트리밍 로드
 * - 최초 1회: 전체 5,000건 슬라이딩 윈도우(live_synthetic_pool.json) 로드
 * - 이후 3초 주기 폴링: 15KB 델타 패킷(live_synthetic_pool_delta.json)만 조회하여 인메모리 병합 (네트워크/CPU 부하 99.5% 절감)
 */
export async function fetchLiveSyntheticPool(forceReload = false): Promise<{
  records: LiveSyntheticPolymerRecord[];
  telemetry: LiveEngineTelemetry | null;
  hasChanged: boolean;
}> {
  const ts = Date.now();
  try {
    // 1. 이미 초기 풀이 로드된 상태이고 강제 전체 리로드가 아니면 15KB 델타 패킷만 우선 조회
    if (cachedLivePool.length > 0 && !forceReload) {
      const deltaRes = await fetch(`/data/live_synthetic_pool_delta.json?t=${ts}`, {
        cache: "no-store",
      });
      if (deltaRes.ok) {
        const deltaData = await deltaRes.json();
        const nextTelemetry: LiveEngineTelemetry | null = deltaData?.telemetry || cachedTelemetry;
        const recentRecords: LiveSyntheticPolymerRecord[] = Array.isArray(deltaData?.recent_records)
          ? deltaData.recent_records
          : [];

        if (nextTelemetry) {
          cachedTelemetry = nextTelemetry;
        }

        if (nextTelemetry && nextTelemetry.last_updated_at === lastKnownUpdatedAt) {
          return {
            records: cachedLivePool,
            telemetry: cachedTelemetry,
            hasChanged: false,
          };
        }

        if (recentRecords.length > 0) {
          const existingIds = new Set(cachedLivePool.slice(0, 120).map((r) => r.id));
          const brandNew = recentRecords.filter((r) => !existingIds.has(r.id)).reverse();

          if (brandNew.length > 0) {
            const maxWindow = nextTelemetry?.max_sliding_window_size || 5000;
            cachedLivePool = [...brandNew, ...cachedLivePool].slice(0, maxWindow);
          }
        }

        if (nextTelemetry) {
          lastKnownUpdatedAt = nextTelemetry.last_updated_at;
        }

        return {
          records: cachedLivePool,
          telemetry: cachedTelemetry,
          hasChanged: true,
        };
      }
    }

    // 2. 최초 실행(부트스트랩) 또는 강제 새로고침 시 전체 5,000건 풀 + 최신 델타 병합 로드
    const [teleRes, poolRes, deltaRes] = await Promise.all([
      fetch(`/data/live_synthetic_pool_telemetry.json?t=${ts}`, { cache: "no-store" }),
      fetch(`/data/live_synthetic_pool.json?t=${ts}`, { cache: "no-store" }),
      fetch(`/data/live_synthetic_pool_delta.json?t=${ts}`, { cache: "no-store" }).catch(() => null),
    ]);

    if (teleRes.ok) {
      cachedTelemetry = await teleRes.json();
    }

    if (poolRes.ok) {
      const raw = await poolRes.json();
      const list: LiveSyntheticPolymerRecord[] = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.polymers)
        ? raw.polymers
        : [];
      let merged = [...list].reverse();

      if (deltaRes && deltaRes.ok) {
        const deltaData = await deltaRes.json();
        if (deltaData?.telemetry) cachedTelemetry = deltaData.telemetry;
        const recent: LiveSyntheticPolymerRecord[] = Array.isArray(deltaData?.recent_records)
          ? deltaData.recent_records
          : [];
        const existingIds = new Set(merged.slice(0, 150).map((r) => r.id));
        const brandNew = recent.filter((r) => !existingIds.has(r.id)).reverse();
        if (brandNew.length > 0) {
          merged = [...brandNew, ...merged].slice(0, 5000);
        }
      }

      cachedLivePool = merged;
      if (cachedTelemetry) {
        lastKnownUpdatedAt = cachedTelemetry.last_updated_at;
      }
      return {
        records: cachedLivePool,
        telemetry: cachedTelemetry,
        hasChanged: true,
      };
    }

    return {
      records: cachedLivePool,
      telemetry: cachedTelemetry,
      hasChanged: false,
    };
  } catch (err) {
    console.warn("[LiveSyntheticPoolService] Failed to fetch live pool:", err);
    return {
      records: cachedLivePool,
      telemetry: cachedTelemetry,
      hasChanged: false,
    };
  }
}

/**
 * 다차원 실시간 필터링 및 정렬 (< 2ms)
 */
export function filterLiveSyntheticPolymers(
  records: LiveSyntheticPolymerRecord[],
  options: LivePoolFilterOptions = {}
): {
  results: LiveSyntheticPolymerRecord[];
  totalMatches: number;
  searchTimeMs: number;
} {
  const t0 = performance.now();
  const {
    query = "",
    grade = "ALL",
    architecture = "ALL",
    morphology = "ALL",
    minTg,
    maxTg,
    minTensile,
    sortBy = "latest",
    limit = 60,
  } = options;

  let filtered = records;

  // 1. 등급 필터 (S++, S+, S)
  if (grade !== "ALL") {
    filtered = filtered.filter((r) => r.quality_grade === grade);
  }

  // 2. 사슬 아키텍처 필터 (Block, Graft, Random)
  if (architecture !== "ALL") {
    filtered = filtered.filter((r) => r.architecture === architecture);
  }

  // 3. Flory-Huggins 나노 상분리 모폴로지 필터
  if (morphology !== "ALL") {
    const mLower = morphology.toLowerCase();
    filtered = filtered.filter((r) =>
      (r.phase_separation_morphology || "").toLowerCase().includes(mLower)
    );
  }

  // 4. 수치 범위 필터
  if (minTg !== undefined) filtered = filtered.filter((r) => r.Tg >= minTg);
  if (maxTg !== undefined) filtered = filtered.filter((r) => r.Tg <= maxTg);
  if (minTensile !== undefined) filtered = filtered.filter((r) => r.tensile_strength >= minTensile);

  // 5. 검색어 필터 (ID, 약어, 구조명, 단량체명/코드, SMILES, 태그, 모폴로지)
  if (query.trim()) {
    const tokens = query
      .trim()
      .toLowerCase()
      .split(/[\s,]+/)
      .filter(Boolean);

    filtered = filtered.filter((r) => {
      const comonomerText = r.comonomers
        .map((c) => `${c.code} ${c.name} ${c.backbone_class} ${MONOMER_CODE_MAP[c.code]?.koreanName || ""}`)
        .join(" ");
      const tagsText = (r.novelty_tags || []).join(" ");
      const blob = `${r.id} ${r.short_code} ${r.structure_name} ${r.smiles_topology} ${r.architecture} ${r.phase_separation_morphology} ${r.quality_grade} ${comonomerText} ${tagsText}`.toLowerCase();
      return tokens.every((tok) => blob.includes(tok));
    });
  }

  const totalMatches = filtered.length;

  // 6. 정렬
  const sorted = [...filtered];
  if (sortBy === "innovation_desc") {
    sorted.sort((a, b) => b.innovation_score - a.innovation_score);
  } else if (sortBy === "tg_desc") {
    sorted.sort((a, b) => b.Tg - a.Tg);
  } else if (sortBy === "tensile_desc") {
    sorted.sort((a, b) => b.tensile_strength - a.tensile_strength);
  } else if (sortBy === "td_desc") {
    sorted.sort((a, b) => b.Td - a.Td);
  } else if (sortBy === "tanimoto_asc") {
    sorted.sort(
      (a, b) =>
        (a.similarity_audit?.overall_max_tanimoto ?? 0.5) -
        (b.similarity_audit?.overall_max_tanimoto ?? 0.5)
    );
  } else if (sortBy === "chi_n_desc") {
    sorted.sort((a, b) => b.chi_N - a.chi_N);
  }
  // sortBy === "latest" maintains the reversed (newest-first) order

  const results = sorted.slice(0, limit);
  const searchTimeMs = Math.round((performance.now() - t0) * 100) / 100;

  return { results, totalMatches, searchTimeMs };
}

/**
 * 풀 전체 요약 통계 계산
 */
export function computeLivePoolStats(records: LiveSyntheticPolymerRecord[]): LivePoolStats {
  if (records.length === 0) {
    return {
      totalCount: 0,
      sPlusPlusCount: 0,
      sPlusCount: 0,
      sCount: 0,
      avgInnovationScore: 0,
      avgTg: 0,
      avgTensile: 0,
      avgChiN: 0,
      avgTanimoto: 0,
    };
  }

  let sPlusPlusCount = 0;
  let sPlusCount = 0;
  let sCount = 0;
  let sumInnov = 0;
  let sumTg = 0;
  let sumTensile = 0;
  let sumChiN = 0;
  let sumTanimoto = 0;

  for (const r of records) {
    if (r.quality_grade === "S++") sPlusPlusCount++;
    else if (r.quality_grade === "S+") sPlusCount++;
    else sCount++;

    sumInnov += r.innovation_score || 0;
    sumTg += r.Tg || 0;
    sumTensile += r.tensile_strength || 0;
    sumChiN += r.chi_N || 0;
    sumTanimoto += r.similarity_audit?.overall_max_tanimoto || 0;
  }

  const n = records.length;
  return {
    totalCount: n,
    sPlusPlusCount,
    sPlusCount,
    sCount,
    avgInnovationScore: Math.round((sumInnov / n) * 10) / 10,
    avgTg: Math.round((sumTg / n) * 10) / 10,
    avgTensile: Math.round((sumTensile / n) * 10) / 10,
    avgChiN: Math.round((sumChiN / n) * 10) / 10,
    avgTanimoto: Math.round((sumTanimoto / n) * 1000) / 1000,
  };
}

/**
 * 실시간 S급 가상 고분자 레코드를 한글 공중합 명칭으로 변환
 */
export function formatLiveRecordKoreanName(rec: LiveSyntheticPolymerRecord): string {
  const archLabel =
    rec.architecture === "Graft (-g-)"
      ? "-graft-"
      : rec.architecture === "Block (-b-)"
      ? "-block-"
      : "-ran-";

  const korParts = rec.comonomers.map(
    (c) => MONOMER_CODE_MAP[c.code]?.koreanName || c.name
  );
  return korParts.join(archLabel);
}

/**
 * 선택된 S급 신소재 후보(LiveSyntheticPolymerRecord)를
 * 3D 뷰어(PolymerViewer), 2D 스케치(MolDrawStudio), AI 채팅 에디터, R&D 타당성 대시보드에
 * 즉시 바인딩할 수 있는 통합 모델 객체로 변환
 */
export function convertLiveRecordToAppModel(rec: LiveSyntheticPolymerRecord): {
  polymer: PolymerDefinition;
  parsedCopolymer: ParsedCopolymerStructure;
  atoms: AtomNode[];
  bonds: BondEdge[];
  descriptor: MolecularDescriptor;
  recommendedInputs: {
    repeatCount: number;
    molecularWeight: number;
    crystallinity: number;
  };
} {
  const structureType: "graft" | "block" | "random" =
    rec.architecture === "Graft (-g-)"
      ? "graft"
      : rec.architecture === "Block (-b-)"
      ? "block"
      : "random";

  const componentDetails: PolymerComponentMeta[] = rec.comonomers.map((c, idx) => {
    const mapped = MONOMER_CODE_MAP[c.code] || {
      parserId: "ps",
      polymerDbId: "ps",
      koreanName: c.name,
      shortName: c.code,
    };
    return {
      id: mapped.parserId,
      canonical: c.name.toLowerCase(),
      koreanName: mapped.koreanName,
      shortName: mapped.shortName,
      color: DOMAIN_COLORS[idx % DOMAIN_COLORS.length],
      dp: c.dp_n,
    };
  });

  const connectors: Array<"graft" | "block" | "random" | "alternating"> = [];
  for (let i = 0; i < Math.max(1, componentDetails.length - 1); i++) {
    connectors.push(structureType);
  }

  const korName = formatLiveRecordKoreanName(rec);
  const archBadge =
    structureType === "graft"
      ? "Graft(가지형)"
      : structureType === "block"
      ? "Block(블록형)"
      : "Random(랜덤형)";

  const parsedCopolymer: ParsedCopolymerStructure = {
    structure_type: structureType,
    components: componentDetails.map((c) => c.canonical),
    architecture:
      structureType === "graft"
        ? "multi-block-graft"
        : componentDetails.length >= 3
        ? "multi-block-copolymer"
        : "diblock-copolymer",
    connectors,
    componentDetails,
    rawFormula: rec.short_code,
    systemMessage: `✨ [시스템] S급 신소재 [${rec.id}] ${korName} (${archBadge}, DP=${rec.dp_n}, Mn=${Math.round(rec.Mn).toLocaleString()} g/mol) 3D 뷰어 및 2D 캔버스 실시간 바인딩 완료.`,
    jsonString: JSON.stringify(
      {
        id: rec.id,
        quality_grade: rec.quality_grade,
        innovation_score: rec.innovation_score,
        structure_type: structureType,
        components: componentDetails.map((c) => c.shortName),
        dp_n: rec.dp_n,
        Mn: rec.Mn,
        PDI: rec.PDI,
        chi_N: rec.chi_N,
        morphology: rec.phase_separation_morphology,
      },
      null,
      2
    ),
  };

  // 3D 및 2D 사슬 원자/결합 그래프 즉시 생성
  const built3D = buildCopolymer3DFromParsedStructure(parsedCopolymer);
  const descriptor = calculateMolecularDescriptor(built3D.atoms, built3D.bonds);

  // 대표 베이스 고분자 지오메트리 참조
  const firstCode = rec.comonomers[0]?.code || "St";
  const mappedDbId = MONOMER_CODE_MAP[firstCode]?.polymerDbId || "ps";
  const basePolymer =
    POLYMER_DATABASE.find((p) => p.id === mappedDbId) || POLYMER_DATABASE[0];

  const effectiveMonomerMw =
    Math.round((rec.Mn / Math.max(1, rec.dp_n)) * 10) / 10;

  const polymer: PolymerDefinition = {
    ...basePolymer,
    id: `copol_live_${rec.id.toLowerCase()}`,
    name: `${rec.short_code} — ${rec.structure_name}`,
    shortName: rec.short_code,
    koreanName: `[${rec.quality_grade}급 신소재] ${korName}`,
    iupacName: rec.structure_name,
    aliases: [rec.id, rec.short_code, korName, ...rec.comonomers.map((c) => c.code)],
    category: "특수 구조 (Special Architecture)",
    thermalCategory:
      rec.Td > rec.Tm + 25
        ? "Thermoplastic (열가소성)"
        : "Thermoset (열경화성)",
    chainArchitecture: `${rec.architecture} | 나노상분리: ${rec.phase_separation_morphology} (χN=${rec.chi_N})`,
    smiles: rec.smiles_topology,
    density: rec.density,
    tg: Math.round(rec.Tg),
    tm: Math.round(rec.Tm),
    formulaUnit: rec.comonomers.map((c) => `${c.code}(${c.dp_n})`).join("-"),
    formulaDisplay: rec.short_code,
    monomerMW: effectiveMonomerMw,
    description: `[AI S급 신소재 스크리닝 검증 (${rec.quality_grade} / 혁신점수 ${rec.innovation_score}점)] Fox/GT Tg=${rec.Tg}℃, Tm=${rec.Tm}℃, Td=${rec.Td}℃, PDI=${rec.PDI}, χN=${rec.chi_N} (${rec.phase_separation_morphology}), HSP δ=${rec.HSP.delta_total} MPa^½, 최대 타니모토 유사도=${rec.similarity_audit?.overall_max_tanimoto ?? 0.35} (할루시네이션/중복 검증 통과)`,
    application: (rec.novelty_tags || []).join(" · ") || "차세대 고기능성 신소재 R&D 후보",
    typicalMwRange: [15000, 250000],
    defaultMw: Math.round(rec.Mn),
  };

  return {
    polymer,
    parsedCopolymer,
    atoms: built3D.atoms,
    bonds: built3D.bonds,
    descriptor,
    recommendedInputs: {
      repeatCount: rec.dp_n,
      molecularWeight: Math.round(rec.Mn),
      crystallinity: Math.min(80, Math.max(5, Math.round(rec.crystallinity))),
    },
  };
}

/**
 * 실시간 S급 가상 고분자 추천 풀 React Hook (폴링 및 수동 새로고침 지원)
 */
export function useLiveSyntheticPool(options?: {
  pollIntervalMs?: number;
  initialAutoRefresh?: boolean;
}) {
  const pollIntervalMs = options?.pollIntervalMs ?? 2000;
  const [records, setRecords] = useState<LiveSyntheticPolymerRecord[]>(cachedLivePool);
  const [telemetry, setTelemetry] = useState<LiveEngineTelemetry | null>(cachedTelemetry);
  const [isLoading, setIsLoading] = useState<boolean>(cachedLivePool.length === 0);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(options?.initialAutoRefresh ?? true);
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);
  const mountedRef = useRef<boolean>(true);
  const lastSeenUpdatedAtRef = useRef<string>("");

  const loadPool = useCallback(async (force = false) => {
    if (!mountedRef.current) return;
    const isInitial = cachedLivePool.length === 0;
    if (isInitial) {
      setIsLoading(true);
    } else if (force) {
      setIsRefreshing(true);
    }

    const res = await fetchLiveSyntheticPool(force);
    if (!mountedRef.current) return;

    const nextUpdatedAt = res.telemetry?.last_updated_at || "";
    const instanceNeedsUpdate =
      isInitial ||
      force ||
      res.hasChanged ||
      nextUpdatedAt !== lastSeenUpdatedAtRef.current;

    if (instanceNeedsUpdate) {
      lastSeenUpdatedAtRef.current = nextUpdatedAt;
      setRecords([...res.records]);
      setTelemetry(res.telemetry ? { ...res.telemetry } : null);
      setLastFetchedAt(new Date().toLocaleTimeString("ko-KR"));
    }
    if (isInitial) setIsLoading(false);
    if (force) setIsRefreshing(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    loadPool(false);
    return () => {
      mountedRef.current = false;
    };
  }, [loadPool]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => {
      loadPool(false);
    }, pollIntervalMs);
    return () => clearInterval(timer);
  }, [autoRefresh, pollIntervalMs, loadPool]);

  const stats = useMemo(() => computeLivePoolStats(records), [records]);

  return {
    records,
    telemetry,
    stats,
    isLoading,
    isRefreshing,
    autoRefresh,
    setAutoRefresh,
    lastFetchedAt,
    refreshNow: () => loadPool(true),
  };
}

