import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from 'pg';

const MAIN_PROJECT_POOL = path.resolve("c:/WORK/고분자 예측 AI/public/data/live_synthetic_pool.json");
const MAIN_PROJECT_TELEMETRY = path.resolve("c:/WORK/고분자 예측 AI/public/data/live_synthetic_pool_telemetry.json");
const MAIN_PROJECT_DELTA = path.resolve("c:/WORK/고분자 예측 AI/public/data/live_synthetic_pool_delta.json");
const STORAGE_MATERIALS_DIR = path.resolve("c:/WORK/고분자 예측 AI/storage/materials");
const ARCHIVED_INDEX_PATH = path.resolve("c:/WORK/고분자 예측 AI/storage/archived_rejected_index.json");

const WORKSPACE_POOL = fs.existsSync("c:/WORK/고분자 예측 AI 가상 데이터/public/data")
  ? path.resolve("c:/WORK/고분자 예측 AI 가상 데이터/public/data/live_synthetic_pool.json")
  : MAIN_PROJECT_POOL;
const WORKSPACE_TELEMETRY = fs.existsSync("c:/WORK/고분자 예측 AI 가상 데이터/public/data")
  ? path.resolve("c:/WORK/고분자 예측 AI 가상 데이터/public/data/live_synthetic_pool_telemetry.json")
  : MAIN_PROJECT_TELEMETRY;
const WORKSPACE_DELTA = fs.existsSync("c:/WORK/고분자 예측 AI 가상 데이터/public/data")
  ? path.resolve("c:/WORK/고분자 예측 AI 가상 데이터/public/data/live_synthetic_pool_delta.json")
  : MAIN_PROJECT_DELTA;

fs.mkdirSync(STORAGE_MATERIALS_DIR, { recursive: true });

let cycleCount = 0;

// ============================================================================
// 실시간 생성 및 필터링 파이프라인 (2초 주기 델타 스트리밍 + 탈락/이관 자산화)
// ============================================================================
const MAX_POOL_SIZE = 5000;
const BATCH_SIZE = Number(process.env.DAEMON_BATCH_SIZE || 2);
const INTERVAL_MS = Number(process.env.DAEMON_INTERVAL_MS || 2000);
const MAX_REJECTED_ARCHIVE_PER_CYCLE = 2;

const ATOMIC_MASS = { C: 12.011, H: 1.008, O: 15.999, N: 14.007, F: 18.998, Cl: 35.45, S: 32.06, Si: 28.085 };
const round = (val, digits = 2) => Number(val.toFixed(digits));
const clamp01 = (v) => (Number.isFinite(v) ? Math.max(0.0, Math.min(1.0, v)) : 0.0);

// Optional PostgreSQL + pgvector Direct Connection
let pgPool = null;
async function initPostgresConnection() {
  const connStr =
    process.env.DATABASE_URL ||
    `postgresql://${process.env.POSTGRES_USER || "polymatrix"}:${
      process.env.POSTGRES_PASSWORD || "polymatrix2026"
    }@${process.env.POSTGRES_HOST || "127.0.0.1"}:${process.env.POSTGRES_PORT || "5432"}/${
      process.env.POSTGRES_DB || "polymatrix_rag"
    }`;
  try {
    const pool = new pg.Pool({ connectionString: connStr, connectionTimeoutMillis: 1200, max: 3 });
    const client = await pool.connect();
    client.release();
    pgPool = pool;
    console.log("[LiveDaemon] Connected to Docker PostgreSQL + pgvector for real-time asset archival.");
  } catch (_err) {
    pgPool = null;
  }
}
initPostgresConnection();

const MONOMER_LIBRARY = [
  { code: "St", name: "Styrene", korName: "폴리스티렌", smiles_repeat: "[*]CC(c1ccccc1)[*]", formula: { C: 8, H: 8 }, tg_inf_c: 100.0, tm_inf_c: 240.0, delta_d: 18.6, delta_p: 1.0, delta_h: 4.1, molar_volume_cm3: 99.0, rho_amorphous: 1.05, rho_crystalline: 1.12, max_crystallinity: 0.48, min_bde_kj_mol: 335.0, avg_bde_kj_mol: 372.0, backbone_class: "Vinyl Aromatic", me_g_mol: 13300.0, intrinsic_modulus_gpa: 3.2 },
  { code: "MMA", name: "Methyl Methacrylate", korName: "폴리메틸메타크릴레이트", smiles_repeat: "[*]CC(C)(C(=O)OC)[*]", formula: { C: 5, H: 8, O: 2 }, tg_inf_c: 105.0, tm_inf_c: 160.0, delta_d: 18.6, delta_p: 10.5, delta_h: 7.5, molar_volume_cm3: 85.5, rho_amorphous: 1.17, rho_crystalline: 1.23, max_crystallinity: 0.38, min_bde_kj_mol: 328.0, avg_bde_kj_mol: 358.0, backbone_class: "Acrylic", me_g_mol: 10000.0, intrinsic_modulus_gpa: 3.1 },
  { code: "BA", name: "Butyl Acrylate", korName: "폴리부틸아크릴레이트", smiles_repeat: "[*]CC(C(=O)OCCCC)[*]", formula: { C: 7, H: 12, O: 2 }, tg_inf_c: -54.0, tm_inf_c: 47.0, delta_d: 16.2, delta_p: 4.5, delta_h: 6.8, molar_volume_cm3: 118.0, rho_amorphous: 1.08, rho_crystalline: 1.14, max_crystallinity: 0.22, min_bde_kj_mol: 338.0, avg_bde_kj_mol: 360.0, backbone_class: "Acrylic", me_g_mol: 28000.0, intrinsic_modulus_gpa: 0.05 },
  { code: "AN", name: "Acrylonitrile", korName: "폴리아크릴로니트릴", smiles_repeat: "[*]CC(C#N)[*]", formula: { C: 3, H: 3, N: 1 }, tg_inf_c: 97.0, tm_inf_c: 317.0, delta_d: 21.7, delta_p: 14.1, delta_h: 9.1, molar_volume_cm3: 45.2, rho_amorphous: 1.18, rho_crystalline: 1.27, max_crystallinity: 0.62, min_bde_kj_mol: 345.0, avg_bde_kj_mol: 385.0, backbone_class: "Vinyl Nitrile", me_g_mol: 4200.0, intrinsic_modulus_gpa: 3.8 },
  { code: "Bd", name: "1,4-Butadiene", korName: "폴리부타디엔", smiles_repeat: "[*]CC=CC[*]", formula: { C: 4, H: 6 }, tg_inf_c: -85.0, tm_inf_c: 2.0, delta_d: 17.5, delta_p: 2.3, delta_h: 3.4, molar_volume_cm3: 60.7, rho_amorphous: 0.89, rho_crystalline: 1.01, max_crystallinity: 0.45, min_bde_kj_mol: 315.0, avg_bde_kj_mol: 355.0, backbone_class: "Diene Elastomer", me_g_mol: 1850.0, intrinsic_modulus_gpa: 0.01 },
  { code: "EG_TPA", name: "Ethylene Terephthalate", korName: "폴리에틸렌테레프탈레이트", smiles_repeat: "[*]OCCOC(=O)c1ccc(C(=O)[*])cc1", formula: { C: 10, H: 8, O: 4 }, tg_inf_c: 76.0, tm_inf_c: 265.0, delta_d: 18.2, delta_p: 6.4, delta_h: 6.6, molar_volume_cm3: 143.0, rho_amorphous: 1.33, rho_crystalline: 1.45, max_crystallinity: 0.58, min_bde_kj_mol: 350.0, avg_bde_kj_mol: 395.0, backbone_class: "Aromatic Polyester", me_g_mol: 1450.0, intrinsic_modulus_gpa: 3.4 },
  { code: "EO", name: "Ethylene Oxide", korName: "폴리에틸렌옥사이드", smiles_repeat: "[*]CCO[*]", formula: { C: 2, H: 4, O: 1 }, tg_inf_c: -67.0, tm_inf_c: 66.0, delta_d: 17.0, delta_p: 10.0, delta_h: 8.9, molar_volume_cm3: 39.3, rho_amorphous: 1.12, rho_crystalline: 1.24, max_crystallinity: 0.76, min_bde_kj_mol: 340.0, avg_bde_kj_mol: 362.0, backbone_class: "Polyether", me_g_mol: 2000.0, intrinsic_modulus_gpa: 0.6 },
  { code: "PO", name: "Propylene Oxide", korName: "폴리프로필렌옥사이드", smiles_repeat: "[*]CC(C)O[*]", formula: { C: 3, H: 6, O: 1 }, tg_inf_c: -72.0, tm_inf_c: 67.0, delta_d: 16.5, delta_p: 6.1, delta_h: 7.4, molar_volume_cm3: 57.8, rho_amorphous: 1.00, rho_crystalline: 1.10, max_crystallinity: 0.45, min_bde_kj_mol: 336.0, avg_bde_kj_mol: 358.0, backbone_class: "Polyether", me_g_mol: 7700.0, intrinsic_modulus_gpa: 0.25 },
  { code: "LA", name: "Lactic Acid (Lactide Unit)", korName: "폴리락트산", smiles_repeat: "[*]OC(C)C(=O)[*]", formula: { C: 3, H: 4, O: 2 }, tg_inf_c: 60.0, tm_inf_c: 180.0, delta_d: 17.5, delta_p: 9.5, delta_h: 10.5, molar_volume_cm3: 58.0, rho_amorphous: 1.25, rho_crystalline: 1.29, max_crystallinity: 0.60, min_bde_kj_mol: 332.0, avg_bde_kj_mol: 365.0, backbone_class: "Aliphatic Polyester", me_g_mol: 8000.0, intrinsic_modulus_gpa: 3.5 },
  { code: "CL", name: "epsilon-Caprolactone", korName: "폴리카프로락톤", smiles_repeat: "[*]OCCCCCC(=O)[*]", formula: { C: 6, H: 10, O: 2 }, tg_inf_c: -60.0, tm_inf_c: 62.0, delta_d: 17.0, delta_p: 4.8, delta_h: 8.3, molar_volume_cm3: 100.0, rho_amorphous: 1.08, rho_crystalline: 1.20, max_crystallinity: 0.68, min_bde_kj_mol: 342.0, avg_bde_kj_mol: 368.0, backbone_class: "Aliphatic Polyester", me_g_mol: 3000.0, intrinsic_modulus_gpa: 0.45 },
  { code: "PA6", name: "Caprolactam (Amide 6)", korName: "폴리아미드6", smiles_repeat: "[*]NCCCCCC(=O)[*]", formula: { C: 6, H: 11, N: 1, O: 1 }, tg_inf_c: 52.0, tm_inf_c: 223.0, delta_d: 17.0, delta_p: 10.6, delta_h: 12.8, molar_volume_cm3: 99.5, rho_amorphous: 1.09, rho_crystalline: 1.23, max_crystallinity: 0.55, min_bde_kj_mol: 360.0, avg_bde_kj_mol: 392.0, backbone_class: "Polyamide", me_g_mol: 2000.0, intrinsic_modulus_gpa: 2.9 },
  { code: "PC_BPA", name: "Bisphenol-A Carbonate", korName: "폴리카보네이트", smiles_repeat: "[*]Oc1ccc(C(C)(C)c2ccc(OC(=O)[*])cc2)cc1", formula: { C: 16, H: 14, O: 3 }, tg_inf_c: 150.0, tm_inf_c: 267.0, delta_d: 19.1, delta_p: 5.9, delta_h: 6.9, molar_volume_cm3: 212.0, rho_amorphous: 1.20, rho_crystalline: 1.31, max_crystallinity: 0.32, min_bde_kj_mol: 375.0, avg_bde_kj_mol: 415.0, backbone_class: "Polycarbonate", me_g_mol: 1750.0, intrinsic_modulus_gpa: 2.4 },
  { code: "DMS", name: "Dimethylsiloxane", korName: "폴리디메틸실록산", smiles_repeat: "[*]O[Si](C)(C)[*]", formula: { C: 2, H: 6, O: 1, Si: 1 }, tg_inf_c: -125.0, tm_inf_c: -40.0, delta_d: 14.9, delta_p: 0.5, delta_h: 2.5, molar_volume_cm3: 75.6, rho_amorphous: 0.97, rho_crystalline: 1.07, max_crystallinity: 0.40, min_bde_kj_mol: 445.0, avg_bde_kj_mol: 455.0, backbone_class: "Polysiloxane", me_g_mol: 12000.0, intrinsic_modulus_gpa: 0.005 },
  { code: "VDF", name: "Vinylidene Fluoride", korName: "폴리비닐리덴플루오라이드", smiles_repeat: "[*]CC(F)(F)[*]", formula: { C: 2, H: 2, F: 2 }, tg_inf_c: -38.0, tm_inf_c: 177.0, delta_d: 17.2, delta_p: 12.5, delta_h: 9.2, molar_volume_cm3: 36.0, rho_amorphous: 1.68, rho_crystalline: 1.97, max_crystallinity: 0.65, min_bde_kj_mol: 410.0, avg_bde_kj_mol: 450.0, backbone_class: "Fluoropolymer", me_g_mol: 2500.0, intrinsic_modulus_gpa: 2.2 },
  { code: "VP", name: "N-Vinylpyrrolidone", korName: "폴리비닐피롤리돈", smiles_repeat: "[*]CC(N1CCCC1=O)[*]", formula: { C: 6, H: 9, N: 1, O: 1 }, tg_inf_c: 168.0, tm_inf_c: null, delta_d: 18.8, delta_p: 11.8, delta_h: 11.4, molar_volume_cm3: 92.5, rho_amorphous: 1.20, rho_crystalline: 1.26, max_crystallinity: 0.15, min_bde_kj_mol: 338.0, avg_bde_kj_mol: 368.0, backbone_class: "Hydrophilic Vinyl", me_g_mol: 15000.0, intrinsic_modulus_gpa: 2.6 },
  { code: "PEEK_U", name: "Oxy-1,4-phenyleneoxy-1,4-phenylenecarbonyl-1,4-phenylene", korName: "폴리에테르에테르케톤", smiles_repeat: "[*]Oc1ccc(Oc2ccc(C(=O)c3ccc([*])cc3)cc2)cc1", formula: { C: 19, H: 12, O: 3 }, tg_inf_c: 145.0, tm_inf_c: 343.0, delta_d: 19.8, delta_p: 5.2, delta_h: 4.6, molar_volume_cm3: 226.0, rho_amorphous: 1.26, rho_crystalline: 1.40, max_crystallinity: 0.48, min_bde_kj_mol: 420.0, avg_bde_kj_mol: 460.0, backbone_class: "Aromatic Polyetherketone", me_g_mol: 1300.0, intrinsic_modulus_gpa: 4.1 },
  { code: "PES_U", name: "Phenylenesulfone Ether", korName: "폴리에테르설폰", smiles_repeat: "[*]Oc1ccc(S(=O)(=O)c2ccc([*])cc2)cc1", formula: { C: 12, H: 8, O: 3, S: 1 }, tg_inf_c: 220.0, tm_inf_c: null, delta_d: 19.6, delta_p: 10.8, delta_h: 6.8, molar_volume_cm3: 169.0, rho_amorphous: 1.37, rho_crystalline: 1.44, max_crystallinity: 0.12, min_bde_kj_mol: 405.0, avg_bde_kj_mol: 442.0, backbone_class: "Aromatic Polysulfone", me_g_mol: 1800.0, intrinsic_modulus_gpa: 2.8 },
  { code: "P4VP", name: "4-Vinylpyridine", korName: "폴리(4-비닐피리딘)", smiles_repeat: "[*]CC(c1ccncc1)[*]", formula: { C: 7, H: 7, N: 1 }, tg_inf_c: 142.0, tm_inf_c: null, delta_d: 19.2, delta_p: 8.8, delta_h: 9.6, molar_volume_cm3: 92.0, rho_amorphous: 1.15, rho_crystalline: 1.22, max_crystallinity: 0.18, min_bde_kj_mol: 336.0, avg_bde_kj_mol: 374.0, backbone_class: "Vinyl Heteroaromatic", me_g_mol: 11500.0, intrinsic_modulus_gpa: 3.0 },
  { code: "GMA", name: "Glycidyl Methacrylate", korName: "폴리글리시딜메타크릴레이트", smiles_repeat: "[*]CC(C)(C(=O)OCC1CO1)[*]", formula: { C: 7, H: 10, O: 3 }, tg_inf_c: 74.0, tm_inf_c: null, delta_d: 18.1, delta_p: 9.8, delta_h: 8.4, molar_volume_cm3: 119.0, rho_amorphous: 1.19, rho_crystalline: 1.26, max_crystallinity: 0.20, min_bde_kj_mol: 322.0, avg_bde_kj_mol: 354.0, backbone_class: "Reactive Acrylic", me_g_mol: 11000.0, intrinsic_modulus_gpa: 2.7 },
  { code: "PP", name: "Propylene", korName: "폴리프로필렌", smiles_repeat: "[*]CC(C)[*]", formula: { C: 3, H: 6 }, tg_inf_c: -10.0, tm_inf_c: 171.0, delta_d: 16.6, delta_p: 0.2, delta_h: 0.8, molar_volume_cm3: 49.1, rho_amorphous: 0.85, rho_crystalline: 0.95, max_crystallinity: 0.72, min_bde_kj_mol: 346.0, avg_bde_kj_mol: 362.0, backbone_class: "Polyolefin", me_g_mol: 5200.0, intrinsic_modulus_gpa: 1.7 },
];

const END_GROUP_LIBRARY = [
  { code: "-OH", name: "Hydroxyl (-OH)", formula: { O: 1, H: 1 }, reactivity_score: 68.0, crosslink_mechanism: "Urethane / Esterification / Condensation Curing", sampling_weight: 0.24 },
  { code: "-COOH", name: "Carboxyl (-COOH)", formula: { C: 1, O: 2, H: 1 }, reactivity_score: 74.0, crosslink_mechanism: "Epoxy-Acid / Carbodiimide / Amidation Cross-linking", sampling_weight: 0.20 },
  { code: "-NH2", name: "Primary Amine (-NH2)", formula: { N: 1, H: 2 }, reactivity_score: 88.0, crosslink_mechanism: "Nucleophilic Epoxy Ring-Opening / Michael Addition", sampling_weight: 0.18 },
  { code: "Epoxy", name: "Glycidyl Epoxy (-CH2-CH(O)CH2)", formula: { C: 3, H: 5, O: 1 }, reactivity_score: 94.0, crosslink_mechanism: "Cationic / Amine / Anhydride Ring-Opening Thermoset Network", sampling_weight: 0.18 },
  { code: "-SH", name: "Thiol (-SH)", formula: { S: 1, H: 1 }, reactivity_score: 91.0, crosslink_mechanism: "Thiol-Ene Click / Disulfide Oxidative Cross-linking", sampling_weight: 0.10 },
  { code: "-Vinyl", name: "Acryloyl / Vinyl (-CH=CH2)", formula: { C: 2, H: 3 }, reactivity_score: 85.0, crosslink_mechanism: "UV Free-Radical / Peroxide Vulcanization", sampling_weight: 0.10 },
];

const BUILTIN_PI1M_WHITELIST = [
  { ref_id: "PI1M-REF-PS", smiles: "[*]CC(c1ccccc1)[*]", monomer_codes: ["St"], architecture: "Homopolymer", Tg: 100.0, Tm: 240.0, Td: 365.0, tensile_strength: 48.0, modulus_gpa: 3.2, crystallinity: 0.0, hsp_total: 19.07, chi_N: 0.0 },
  { ref_id: "PI1M-REF-PMMA", smiles: "[*]CC(C)(C(=O)OC)[*]", monomer_codes: ["MMA"], architecture: "Homopolymer", Tg: 105.0, Tm: 160.0, Td: 340.0, tensile_strength: 68.0, modulus_gpa: 3.1, crystallinity: 0.0, hsp_total: 22.63, chi_N: 0.0 },
  { ref_id: "PI1M-REF-SAN", smiles: "[*]CC(c1ccccc1)[*].[*]CC(C#N)[*]", monomer_codes: ["St", "AN"], architecture: "Random", Tg: 102.0, Tm: 255.0, Td: 378.0, tensile_strength: 72.0, modulus_gpa: 3.5, crystallinity: 12.0, hsp_total: 22.8, chi_N: 8.4 },
  { ref_id: "PI1M-REF-SBS", smiles: "[*]CC(c1ccccc1)[*].[*]CC=CC[*]", monomer_codes: ["St", "Bd"], architecture: "Block (-b-)", Tg: -45.0, Tm: 165.0, Td: 352.0, tensile_strength: 32.0, modulus_gpa: 0.45, crystallinity: 8.0, hsp_total: 18.2, chi_N: 18.5 },
  { ref_id: "PI1M-REF-PET", smiles: "[*]OCCOC(=O)c1ccc(C(=O)[*])cc1", monomer_codes: ["EG_TPA"], architecture: "Homopolymer", Tg: 76.0, Tm: 265.0, Td: 405.0, tensile_strength: 75.0, modulus_gpa: 3.4, crystallinity: 42.0, hsp_total: 20.39, chi_N: 0.0 },
  { ref_id: "PI1M-REF-PC", smiles: "[*]Oc1ccc(C(C)(C)c2ccc(OC(=O)[*])cc2)cc1", monomer_codes: ["PC_BPA"], architecture: "Homopolymer", Tg: 150.0, Tm: 267.0, Td: 435.0, tensile_strength: 65.0, modulus_gpa: 2.4, crystallinity: 5.0, hsp_total: 21.15, chi_N: 0.0 },
  { ref_id: "PI1M-REF-PA6", smiles: "[*]NCCCCCC(=O)[*]", monomer_codes: ["PA6"], architecture: "Homopolymer", Tg: 52.0, Tm: 223.0, Td: 395.0, tensile_strength: 82.0, modulus_gpa: 2.9, crystallinity: 45.0, hsp_total: 23.77, chi_N: 0.0 },
  { ref_id: "PI1M-REF-PEEK", smiles: "[*]Oc1ccc(Oc2ccc(C(=O)c3ccc([*])cc3)cc2)cc1", monomer_codes: ["PEEK_U"], architecture: "Homopolymer", Tg: 145.0, Tm: 343.0, Td: 475.0, tensile_strength: 100.0, modulus_gpa: 4.1, crystallinity: 38.0, hsp_total: 20.98, chi_N: 0.0 },
  { ref_id: "PI1M-REF-PVDF", smiles: "[*]CC(F)(F)[*]", monomer_codes: ["VDF"], architecture: "Homopolymer", Tg: -38.0, Tm: 177.0, Td: 445.0, tensile_strength: 54.0, modulus_gpa: 2.2, crystallinity: 52.0, hsp_total: 23.17, chi_N: 0.0 },
  { ref_id: "PI1M-REF-PLA-PCL", smiles: "[*]OC(C)C(=O)[*].[*]OCCCCCC(=O)[*]", monomer_codes: ["LA", "CL"], architecture: "Random", Tg: 12.0, Tm: 135.0, Td: 355.0, tensile_strength: 42.0, modulus_gpa: 1.6, crystallinity: 28.0, hsp_total: 21.8, chi_N: 7.2 },
];

const LIVE_ARCHITECTURES = ["Random", "Block (-b-)", "Graft (-g-)"];
const ARCH_CONNECTOR = { "Random": "-ran-", "Block (-b-)": "-b-", "Graft (-g-)": "-g-" };
const TACTICITY_TYPES = ["Isotactic", "Syndiotactic", "Atactic"];

function formulaMass(formula) {
  return Object.entries(formula).reduce((acc, [el, cnt]) => acc + ATOMIC_MASS[el] * cnt, 0);
}

function computeEmbedding32(rec) {
  const vec = new Array(32).fill(0);
  const tg = rec.Tg ?? 50;
  const tm = rec.Tm ?? tg + 110;
  const td = rec.Td ?? 370;
  vec[0] = clamp01((tg + 150) / 450);
  vec[1] = clamp01((tm + 50) / 450);
  vec[2] = clamp01(td / 600);
  vec[3] = clamp01((rec.tensile_strength ?? 55) / 200);
  vec[4] = clamp01((rec.modulus_gpa ?? 2.2) / 10);
  vec[5] = clamp01((rec.elongation_at_break_pct ?? 45) / 500);
  vec[6] = clamp01(((rec.density ?? 1.15) - 0.8) / 1.4);
  vec[7] = clamp01((rec.crystallinity ?? 25) / 100);
  vec[8] = clamp01(Math.log10(Math.max(1000, rec.Mn ?? 35000)) / 6.0);
  vec[9] = clamp01((rec.dp_n ?? 180) / 1000);
  vec[10] = clamp01(((rec.PDI ?? 1.8) - 1.0) / 3.0);
  vec[11] = clamp01((rec.chi_N ?? 10) / 120);
  vec[12] = clamp01((rec.HSP?.delta_total ?? 20.5) / 35);
  vec[13] = clamp01((rec.processing_window_c ?? 80) / 220);
  vec[14] = clamp01((rec.innovation_score ?? 75) / 100);

  const arch = (rec.architecture || "").toLowerCase();
  if (arch.includes("block")) vec[16] = 0.85;
  else if (arch.includes("graft")) vec[17] = 0.85;
  else if (arch.includes("random")) vec[18] = 0.85;
  else vec[15] = 0.85;

  const morph = (rec.phase_separation_morphology || "").toLowerCase();
  if (morph.includes("lamellar") || morph.includes("cylindrical")) vec[19] = 0.8;

  const blob = `${rec.structure_name || ""} ${rec.short_code || ""} ${rec.smiles_topology || ""}`.toLowerCase();
  if (/c1cc|st\b|eg_tpa|pc_bpa|peek|pes/.test(blob)) vec[20] = 0.9;
  if (/pa6|amide/.test(blob)) vec[21] = 0.9;
  if (/mma|ba|la|cl|gma|tpa|pc_bpa/.test(blob)) vec[22] = 0.9;
  if (/vdf|fluoro/.test(blob)) vec[23] = 0.95;
  if (/dms|bd|siloxane|butadiene/.test(blob)) vec[24] = 0.95;
  if (/an|p4vp|vp/.test(blob)) vec[25] = 0.9;
  if (/eo|po|peek|pes/.test(blob)) vec[26] = 0.85;
  if (/pp\b/.test(blob)) vec[27] = 0.85;

  const clean = (rec.smiles_topology || "C").replace(/[*()\[\]\s]/g, "");
  for (let i = 0; i < clean.length; i++) {
    const code = clean.charCodeAt(i);
    vec[28 + ((code + i * 7) % 4)] += ((code % 13) + 1) / (13.0 * Math.max(4, clean.length));
  }
  for (let b = 28; b < 32; b++) vec[b] = clamp01(vec[b]);

  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => Number((v / norm).toFixed(6)));
}

/**
 * Persists every material (ACTIVE_S_TIER or ARCHIVED_REJECTED) into:
 * 1) Individual file `storage/materials/{id}.json`
 * 2) Local archived index `storage/archived_rejected_index.json` (if ARCHIVED_REJECTED)
 * 3) Docker PostgreSQL `polymer_materials` table (if running)
 */
async function persistMaterialAsset(rec, sourceType, statusStage, statusReason) {
  const safeId = rec.id.replace(/[^a-zA-Z0-9_\-.]/g, "_");
  const relPath = `storage/materials/${safeId}.json`;
  const absPath = path.resolve(STORAGE_MATERIALS_DIR, `${safeId}.json`);
  const conn = rec.architecture === "Graft (-g-)" ? "-graft-" : rec.architecture === "Block (-b-)" ? "-block-" : "-ran-";
  const korBase = (rec.comonomers || []).map((c) => {
    const found = MONOMER_LIBRARY.find((m) => m.code === c.code);
    return found ? found.korName : c.name;
  }).join(conn);
  const korName = sourceType === "ARCHIVED_REJECTED" ? `[보관/탈락] ${korBase}` : korBase;
  const emb = computeEmbedding32(rec);
  const nowIso = new Date().toISOString();

  const meta = {
    id: rec.id,
    source_type: sourceType,
    name: rec.structure_name || rec.id,
    korean_name: korName,
    short_code: rec.short_code || rec.id,
    category: sourceType === "ACTIVE_S_TIER" ? `S급 신소재 (${rec.quality_grade || "S"})` : rec.category || "아카이브/탈락 보관",
    architecture: rec.architecture || "Block (-b-)",
    morphology: rec.phase_separation_morphology || "Lamellar",
    smiles: rec.smiles_topology || "",
    quality_grade: rec.quality_grade || "REJECTED",
    innovation_score: rec.innovation_score || 55.0,
    tg: rec.Tg ?? 50,
    tm: rec.Tm ?? 170,
    td: rec.Td ?? 350,
    tensile_strength: rec.tensile_strength ?? 45,
    modulus_gpa: rec.modulus_gpa ?? 1.8,
    elongation: rec.elongation_at_break_pct ?? 35,
    density: rec.density ?? 1.15,
    crystallinity: rec.crystallinity ?? 22,
    dp_n: rec.dp_n ?? 120,
    mn: rec.Mn ?? 25000,
    pdi: rec.PDI ?? 1.85,
    chi_n: rec.chi_N ?? 12,
    hsp_total: rec.HSP?.delta_total ?? 20.5,
    tanimoto_max: rec.similarity_audit?.overall_max_tanimoto ?? 0.45,
    status_stage: statusStage,
    status_reason: statusReason,
    file_path: relPath,
    created_at: rec.generated_at || nowIso,
    updated_at: nowIso,
  };

  const filePayload = {
    id: rec.id,
    source_type: sourceType,
    metadata: meta,
    embedding: emb,
    full_record: { ...rec, status_stage: statusStage, status_reason: statusReason },
    geometry_3d: {
      comonomers: rec.comonomers,
      smiles_topology: rec.smiles_topology,
      architecture: rec.architecture,
    },
  };

  try {
    fs.writeFileSync(absPath, JSON.stringify(filePayload, null, 2), "utf8");
  } catch (_e) {
    // ignore transient lock
  }

  // Push to running Vite PG-RAG API server in real time (non-blocking)
  try {
    fetch("http://127.0.0.1:5173/api/materials/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        record: filePayload.full_record,
        sourceType,
        statusStage,
        statusReason,
      }),
    }).catch(() => {});
  } catch (_e) {
    // ignore if server not up
  }

  if (pgPool) {
    try {
      const vecStr = `[${emb.join(",")}]`;
      await pgPool.query(
        `INSERT INTO polymer_materials (
          id, source_type, name, korean_name, short_code, category,
          architecture, morphology, smiles, quality_grade, innovation_score,
          tg, tm, td, tensile_strength, modulus_gpa, elongation, density,
          crystallinity, dp_n, mn, pdi, chi_n, hsp_total, tanimoto_max,
          status_stage, status_reason, file_path, embedding, updated_at
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29::vector,NOW()
        ) ON CONFLICT (id) DO UPDATE SET
          source_type = EXCLUDED.source_type,
          quality_grade = EXCLUDED.quality_grade,
          status_stage = EXCLUDED.status_stage,
          status_reason = EXCLUDED.status_reason,
          updated_at = NOW();`,
        [
          meta.id, meta.source_type, meta.name, meta.korean_name, meta.short_code, meta.category,
          meta.architecture, meta.morphology, meta.smiles, meta.quality_grade, meta.innovation_score,
          meta.tg, meta.tm, meta.td, meta.tensile_strength, meta.modulus_gpa, meta.elongation, meta.density,
          meta.crystallinity, meta.dp_n, meta.mn, meta.pdi, meta.chi_n, meta.hsp_total, meta.tanimoto_max,
          meta.status_stage, meta.status_reason, meta.file_path, vecStr,
        ]
      );
    } catch (_err) {
      // ignore
    }
  }
}

function computeTopologicalFingerprint(smilesTopology, architecture, comonomerCodes, moleFractions, alphaEg, omegaEg, tacticity) {
  const tokens = [];
  const cleanSmiles = smilesTopology.replaceAll("[*]", "");
  for (const k of [2, 3, 4, 5]) {
    for (let i = 0; i <= cleanSmiles.length - k; i++) tokens.push(`SM${k}:${cleanSmiles.slice(i, i + k)}`);
  }
  const sortedCodes = [...comonomerCodes].sort();
  tokens.push(`ARCH:${architecture}`, `TACT:${tacticity}`, `END:${alphaEg}:${omegaEg}`);
  for (const code of sortedCodes) tokens.push(`MONO:${code}`);
  for (let i = 0; i < sortedCodes.length; i++) {
    for (let j = i + 1; j < sortedCodes.length; j++) tokens.push(`PAIR:${architecture}:${sortedCodes[i]}-${sortedCodes[j]}`);
  }
  comonomerCodes.forEach((code, idx) => {
    const qBin = Math.round(moleFractions[idx] * 20);
    for (const b of [qBin - 1, qBin, qBin + 1]) tokens.push(`COMP:${code}:B${b}`);
  });
  const activeBits = new Set();
  for (const tok of tokens) {
    const digest = crypto.createHash("md5").update(tok).digest();
    activeBits.add(((digest[0] << 8) | digest[1]) % 2048);
    activeBits.add(((digest[2] << 8) | digest[3]) % 2048);
  }
  return activeBits;
}

function tanimotoSimilarity(fpA, fpB) {
  if (!fpA.size || !fpB.size) return 0.0;
  let inter = 0;
  for (const bit of fpA) if (fpB.has(bit)) inter++;
  const union = fpA.size + fpB.size - inter;
  return union > 0 ? inter / union : 0.0;
}

function normalizedPropertyDelta(cand, ref) {
  const candHsp = cand.HSP?.delta_total ?? cand.hsp_total ?? 20.0;
  const refHsp = ref.HSP?.delta_total ?? ref.hsp_total ?? 20.0;
  const diffsSq = [
    ((cand.Tg - (ref.Tg ?? 50.0)) / 300.0) ** 2,
    ((cand.Tm - (ref.Tm ?? 180.0)) / 320.0) ** 2,
    ((cand.Td - (ref.Td ?? 380.0)) / 280.0) ** 2,
    ((cand.tensile_strength - (ref.tensile_strength ?? 55.0)) / 150.0) ** 2,
    ((cand.modulus_gpa - (ref.modulus_gpa ?? 2.2)) / 6.0) ** 2,
    ((cand.crystallinity - (ref.crystallinity ?? 25.0)) / 80.0) ** 2,
    ((candHsp - refHsp) / 18.0) ** 2,
    (((cand.chi_N ?? 10.0) - (ref.chi_N ?? 10.0)) / 60.0) ** 2,
  ];
  return Math.sqrt(diffsSq.reduce((a, b) => a + b, 0) / diffsSq.length);
}

const whitelistEntries = BUILTIN_PI1M_WHITELIST.map((ref) => [
  ref,
  computeTopologicalFingerprint(ref.smiles, ref.architecture, ref.monomer_codes, ref.monomer_codes.map(() => 1.0 / ref.monomer_codes.length), "-OH", "-H", "Atactic"),
]);

function atomicWriteJson(targetPath, data) {
  try {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    const text = JSON.stringify(data, null, 2);
    fs.writeFileSync(targetPath, text, "utf8");
  } catch (_err) {
    // Ignore transient Windows file lock
  }
}

const rawPool = JSON.parse(fs.readFileSync(MAIN_PROJECT_POOL, "utf8"));
const telemetry = JSON.parse(fs.readFileSync(MAIN_PROJECT_TELEMETRY, "utf8"));
telemetry.engine_status = "RUNNING_PGVECTOR_RAG_STABILIZED_DAEMON";
telemetry.daemon_interval_ms = INTERVAL_MS;
telemetry.daemon_batch_size = BATCH_SIZE;

const poolEntries = rawPool.map((rec) => {
  const codes = (rec.comonomers || []).map((c) => c.code);
  const mfs = (rec.comonomers || []).map((c) => c.mole_fraction);
  return [rec, computeTopologicalFingerprint(rec.smiles_topology || "", rec.architecture || "Random", codes, mfs, "-OH", "-COOH", rec.tacticity || "Atactic")];
});

let seqNum = telemetry.accepted_s_grade || poolEntries.length;
for (const [rec] of poolEntries) {
  const m = String(rec?.id || "").match(/PMX-LIVE-(\d+)/);
  if (m) seqNum = Math.max(seqNum, Number(m[1]));
}

let rejectedSeqNum = Number(telemetry.last_rejected_seq || 250);
const recentRejectedRecords = [];

function randUniform(min, max) { return min + (max - min) * Math.random(); }
function randInt(min, max) { return Math.floor(randUniform(min, max + 1)); }
function sampleK(arr, k) {
  const copy = [...arr];
  const out = [];
  for (let i = 0; i < k; i++) out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
  return out;
}
function weightedChoice(arr, weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < arr.length; i++) {
    r -= weights[i];
    if (r <= 0) return arr[i];
  }
  return arr[arr.length - 1];
}

async function stepBatch() {
  const egWeights = END_GROUP_LIBRARY.map((e) => e.sampling_weight);
  let added = 0;
  let archivedInCycle = 0;

  while (added < BATCH_SIZE) {
    telemetry.total_candidates_generated += 1;
    const roll = Math.random();
    const numComponents = weightedChoice([2, 3], [0.74, 0.26]);
    const chosenMonomers = sampleK(MONOMER_LIBRARY, numComponents);
    const architecture = LIVE_ARCHITECTURES[Math.floor(Math.random() * LIVE_ARCHITECTURES.length)];

    const avgM0 = chosenMonomers.reduce((s, m) => s + formulaMass(m.formula), 0) / numComponents;
    const minDpForMn = Math.ceil(10500.0 / avgM0);
    const isOligomerFault = roll >= 0.03 && roll < 0.08;
    const targetTotalDp = isOligomerFault ? randInt(24, 44) : randInt(Math.max(55, minDpForMn), Math.max(140, minDpForMn + 980));
    const rawWeights = chosenMonomers.map(() => randUniform(0.12, 0.88));
    const wSum = rawWeights.reduce((a, b) => a + b, 0);
    const dpPerMonomer = rawWeights.map((w) => Math.max(8, Math.round(targetTotalDp * (w / wSum))));
    const dpTotal = dpPerMonomer.reduce((a, b) => a + b, 0);

    const alphaEg = weightedChoice(END_GROUP_LIBRARY, egWeights);
    const omegaEg = weightedChoice(END_GROUP_LIBRARY, egWeights);

    const monomerMasses = chosenMonomers.map((m, i) => formulaMass(m.formula) * dpPerMonomer[i]);
    const mnGMol = round(monomerMasses.reduce((a, b) => a + b, 0) + formulaMass(alphaEg.formula) + formulaMass(omegaEg.formula), 2);
    const moleFractions = dpPerMonomer.map((dp) => round(dp / dpTotal, 4));
    const totalMonomerMass = monomerMasses.reduce((a, b) => a + b, 0);
    const weightFractions = monomerMasses.map((mass) => round(mass / totalMonomerMass, 4));

    const pdi = architecture === "Block (-b-)" ? round(randUniform(1.50, 2.15), 3) : architecture === "Graft (-g-)" ? round(randUniform(1.85, 3.50), 3) : round(randUniform(1.60, 3.35), 3);
    const mwGMol = round(mnGMol * pdi, 2);
    const mzGMol = round(mwGMol * (1.0 + 0.65 * (pdi - 1.0)), 2);

    const baseTerminalScore = 0.5 * (alphaEg.reactivity_score + omegaEg.reactivity_score);
    let internalBoost = 0.0;
    chosenMonomers.forEach((m, i) => {
      if (m.code === "GMA") internalBoost += 28.0 * moleFractions[i];
      else if (m.code === "Bd") internalBoost += 18.0 * moleFractions[i];
      else if (m.code === "PA6") internalBoost += 8.0 * moleFractions[i];
    });
    const mwDilution = Math.max(0.72, Math.min(1.05, 1.05 - 0.06 * Math.log10(Math.max(mnGMol, 10000.0) / 10000.0)));
    const cri = round(Math.min(99.8, baseTerminalScore * mwDilution + internalBoost), 2);

    const tgKelvinList = chosenMonomers.map((m) => m.tg_inf_c + 273.15);
    const tgFoxK = 1.0 / weightFractions.reduce((s, w, i) => s + w / tgKelvinList[i], 0);
    const refRho = chosenMonomers[0].rho_amorphous;
    const refTgK = tgKelvinList[0];
    let gtNum = 0.0, gtDen = 0.0;
    chosenMonomers.forEach((m, i) => {
      const kGt = (refRho * refTgK) / Math.max(1.0, m.rho_amorphous * tgKelvinList[i]);
      gtNum += weightFractions[i] * kGt * tgKelvinList[i];
      gtDen += weightFractions[i] * kGt;
    });
    const tgGtK = gtNum / gtDen;
    const ffDep = (0.5 * (tgFoxK + tgGtK) > 330.0 ? 85000.0 : 45000.0) / Math.max(3000, mnGMol);
    const tgC = round(0.6 * (tgGtK - 273.15 - ffDep) + 0.4 * (tgFoxK - 273.15 - ffDep), 2);

    const tacticity = weightedChoice(TACTICITY_TYPES, [0.36, 0.32, 0.32]);
    const tactFactor = tacticity === "Isotactic" ? randUniform(0.78, 1.00) : tacticity === "Syndiotactic" ? randUniform(0.68, 0.92) : randUniform(0.02, 0.25);
    const archFactor = { "Block (-b-)": 0.88, "Graft (-g-)": 0.72, "Random": 0.54 }[architecture];
    const weightedMaxXc = chosenMonomers.reduce((s, m, i) => s + weightFractions[i] * m.max_crystallinity, 0);
    const crystallinityPct = round(Math.max(0.0, Math.min(80.0, weightedMaxXc * tactFactor * archFactor * 100.0)), 2);
    const xcFrac = crystallinityPct / 100.0;

    const rhoAMix = 1.0 / chosenMonomers.reduce((s, m, i) => s + weightFractions[i] / m.rho_amorphous, 0);
    const rhoCMix = 1.0 / chosenMonomers.reduce((s, m, i) => s + weightFractions[i] / m.rho_crystalline, 0);
    const densityGCm3 = round(rhoAMix * (1.0 - xcFrac) + rhoCMix * xcFrac, 4);

    const meMix = chosenMonomers.reduce((s, m, i) => s + weightFractions[i] * m.me_g_mol, 0);
    const entanglementRatio = mnGMol / Math.max(meMix, 1000.0);
    const mwStrengthFactor = Math.max(0.35, 1.0 - (0.45 * meMix) / Math.max(3000, mnGMol));
    const baseModGpa = chosenMonomers.reduce((s, m, i) => s + weightFractions[i] * m.intrinsic_modulus_gpa, 0);
    const thermalStateFactor = tgC > 25.0 ? 1.15 : (0.35 + 1.10 * xcFrac);
    const modulusGpa = round(Math.max(0.02, Math.min(8.50, baseModGpa * thermalStateFactor * (1.0 + 1.85 * xcFrac) * (0.85 + 0.15 * mwStrengthFactor) * (1.0 + 0.0018 * cri) * randUniform(0.96, 1.04))), 3);

    const glassyBoost = tgC > 20.0 ? Math.max(0.0, Math.min(55.0, (tgC - 20.0) * 0.34)) : 6.5;
    const crystalBoost = 92.0 * Math.pow(xcFrac, 0.85);
    const entangleBoost = 12.0 * Math.log10(Math.max(2.0, entanglementRatio));
    const tensileMpa = round(Math.max(4.5, Math.min(185.0, (14.0 + glassyBoost + crystalBoost + entangleBoost) * mwStrengthFactor * (1.0 + 0.0022 * cri) * randUniform(0.95, 1.05))), 2);
    const elongationPct = round(Math.max(1.8, Math.min(850.0, (tgC < 0.0 ? 320.0 : tgC < 45.0 ? 120.0 : 28.0) * randUniform(0.85, 1.15))), 2);

    let bestTmK = (tgC + 273.15) * 1.48, bestX = Math.max(...moleFractions);
    chosenMonomers.forEach((m, i) => { if (m.tm_inf_c !== null && moleFractions[i] >= bestX) { bestTmK = m.tm_inf_c + 273.15; bestX = moleFractions[i]; } });
    const effX = architecture === "Random" ? Math.max(0.45, bestX) : Math.max(0.82, bestX);
    let tmK = Math.max((tgC + 273.15) + 35.0, 1.0 / ((1.0 / bestTmK) - (8.314 / 14500.0) * Math.log(effX)));
    const tmC = round(tmK - 273.15, 2);

    const vols = chosenMonomers.map((m, i) => m.molar_volume_cm3 * moleFractions[i]);
    const totalV = vols.reduce((a, b) => a + b, 0);
    const phiList = vols.map((v) => v / totalV);
    const deltaD = round(chosenMonomers.reduce((s, m, i) => s + phiList[i] * m.delta_d, 0), 2);
    const deltaP = round(chosenMonomers.reduce((s, m, i) => s + phiList[i] * m.delta_p, 0), 2);
    const deltaH = round(chosenMonomers.reduce((s, m, i) => s + phiList[i] * m.delta_h, 0), 2);
    const deltaTotal = round(Math.sqrt(deltaD ** 2 + deltaP ** 2 + deltaH ** 2), 2);
    const r0 = round(10.5 - 0.045 * crystallinityPct, 2);

    const mA = chosenMonomers[0], mB = chosenMonomers[chosenMonomers.length - 1];
    const chiAb = round((100.0 / (8.314 * 298.15)) * ((mA.delta_d - mB.delta_d) ** 2 + 0.25 * (mA.delta_p - mB.delta_p) ** 2 + 0.25 * (mA.delta_h - mB.delta_h) ** 2) + 0.034, 4);
    const chiN = round(chiAb * dpTotal, 2);
    const fMinor = round(Math.max(0.05, Math.min(0.50, Math.min(phiList[0], 1.0 - phiList[0]))), 4);
    const morphology = chiN >= 10.5 ? (fMinor >= 0.36 ? "Lamellar" : fMinor >= 0.20 ? "Cylindrical" : "Spherical") : "Disordered (Homogeneous)";

    const minBde = Math.min(...chosenMonomers.map((m) => m.min_bde_kj_mol));
    const weightedAvgBde = chosenMonomers.reduce((s, m, i) => s + weightFractions[i] * m.avg_bde_kj_mol, 0);
    const effectiveBde = round(0.45 * minBde + 0.55 * weightedAvgBde, 2);
    const tdC = round(Math.max(240.0, Math.min(560.0, 25.0 + 0.96 * effectiveBde + 8.5 * Math.log10(Math.max(3000, mnGMol) / 10000.0) + 0.18 * crystallinityPct + randUniform(-4.0, 4.0))), 2);
    const minProcessingTempC = crystallinityPct >= 10.0 ? round(Math.max(tmC + 15.0, tgC + 35.0), 2) : round(tgC + 45.0, 2);
    const processingWindowC = round(tdC - minProcessingTempC, 2);

    const conn = ARCH_CONNECTOR[architecture];
    const structureName = `alpha-${alphaEg.code}-Poly(${chosenMonomers.map((m) => m.name).join(conn)})-omega-${omegaEg.code}`;
    const shortCode = `P(${chosenMonomers.map((m) => m.code).join(conn)}) [${alphaEg.code}/${omegaEg.code}]`;
    const smilesTopology = `${alphaEg.code}` + chosenMonomers.map((m, i) => `-(${m.smiles_repeat.replaceAll("[*]", "")})_${dpPerMonomer[i]}`).join("") + `-${omegaEg.code}`;
    const candFp = computeTopologicalFingerprint(smilesTopology, architecture, chosenMonomers.map((m) => m.code), moleFractions, alphaEg.code, omegaEg.code, tacticity);

    const candidate = {
      id: `PMX-LIVE-${String(seqNum + 1).padStart(6, "0")}`,
      generated_at: new Date().toISOString(),
      structure_hash: crypto.createHash("sha256").update(`${structureName}:${dpTotal}:${mnGMol}:${tacticity}`).digest("hex").slice(0, 12),
      structure_name: structureName,
      short_code: shortCode,
      smiles_topology: smilesTopology,
      architecture,
      comonomers: chosenMonomers.map((m, i) => ({ code: m.code, name: m.name, backbone_class: m.backbone_class, dp_n: dpPerMonomer[i], mole_fraction: moleFractions[i], weight_fraction: weightFractions[i] })),
      dp_n: dpTotal, Mn: mnGMol, Mw: mwGMol, Mz: mzGMol, PDI: pdi, Tg: tgC, Tm: tmC, Td: tdC,
      tensile_strength: tensileMpa, modulus_gpa: modulusGpa, elongation_at_break_pct: elongationPct,
      crystallinity: crystallinityPct, density: densityGCm3, tacticity,
      HSP: { delta_d: deltaD, delta_p: deltaP, delta_h: deltaH, delta_total: deltaTotal, R0: r0 },
      phase_separation_morphology: morphology, chi_N: chiN, crosslinking_reactivity_index: cri,
      processing_window_c: processingWindowC,
      processability_status: processingWindowC >= 80.0 ? "Processable: Wide Window" : "Processable: Standard Window",
      purity_confidence_pct: 99.99,
    };

    const archiveRejectionIfQuotaAllows = async (grade, score, stage, reason) => {
      if (archivedInCycle >= MAX_REJECTED_ARCHIVE_PER_CYCLE) return;
      rejectedSeqNum += 1;
      telemetry.last_rejected_seq = rejectedSeqNum;
      candidate.id = `PMX-REJ-${String(rejectedSeqNum).padStart(5, "0")}`;
      candidate.quality_grade = grade;
      candidate.innovation_score = score;
      candidate.status_stage = stage;
      candidate.status_reason = reason;
      await persistMaterialAsset(candidate, "ARCHIVED_REJECTED", stage, reason);
      recentRejectedRecords.push({ ...candidate });
      if (recentRejectedRecords.length > 32) recentRejectedRecords.shift();
      archivedInCycle += 1;
    };

    // Stage 1 Rejection Checks -> Archive to File Storage & DB instead of discarding!
    if (roll < 0.03) {
      telemetry.rejected_stage1_octet_valency += 1;
      await archiveRejectionIfQuotaAllows("REJECTED (Stage-1)", 45.0, "Stage-1 Octet / Valency Fault", "단량체 접합부 원자가/옥텟 결합 규칙 위반 감지 — 합성 불가 구조로 아카이브 보관됨");
      continue;
    }
    if (dpTotal < 50 || mnGMol < 10000.0) {
      telemetry.rejected_stage1_dp_cutoff += 1;
      await archiveRejectionIfQuotaAllows("REJECTED (Stage-1)", 48.0, "Stage-1 Oligomer / DP Cutoff", `중합도(DP=${dpTotal} < 50) 또는 분자량(Mn=${mnGMol} < 10,000 g/mol) 미달 저분자 올리고머 영역으로 탈락 보관됨`);
      continue;
    }
    if (tdC <= tmC + 10.0 || processingWindowC < 15.0) {
      telemetry.rejected_stage1_thermodynamic_instability += 1;
      await archiveRejectionIfQuotaAllows("REJECTED (Stage-1)", 52.0, "Stage-1 Thermodynamic Instability", `열분해온도(Td=${tdC}℃)와 용융온도(Tm=${tmC}℃) 간 열가공창(ΔT=${processingWindowC}℃ < 15℃) 부족으로 탈락 보관됨`);
      continue;
    }

    let maxSimWhitelist = 0.0, closestWhiteId = "None", rej = null, rejDelta = 0.0;
    for (const [refDoc, refFp] of whitelistEntries) {
      const sim = tanimotoSimilarity(candFp, refFp);
      const pDelta = normalizedPropertyDelta(candidate, refDoc);
      if (sim > maxSimWhitelist) { maxSimWhitelist = sim; closestWhiteId = refDoc.ref_id; rejDelta = pDelta; }
      if (sim >= 0.84) { rej = "tanimoto"; break; }
      if (sim >= 0.64 && pDelta < 0.088) { rej = "cosmetic"; break; }
    }

    let maxSimPool = 0.0, minDeltaPool = 999.0, closestPoolId = "None";
    if (!rej) {
      const startIdx = Math.max(0, poolEntries.length - 250);
      for (let i = startIdx; i < poolEntries.length; i++) {
        const [poolDoc, poolFp] = poolEntries[i];
        const sim = tanimotoSimilarity(candFp, poolFp);
        const pDelta = normalizedPropertyDelta(candidate, poolDoc);
        if (sim > maxSimPool) { maxSimPool = sim; closestPoolId = poolDoc.id; }
        if (pDelta < minDeltaPool) minDeltaPool = pDelta;
        if (sim >= 0.84) { rej = "tanimoto"; break; }
        if (sim >= 0.64 && pDelta < 0.088) { rej = "cosmetic"; break; }
      }
    }

    if (rej === "tanimoto") {
      telemetry.rejected_stage2_tanimoto_similarity += 1;
      const maxSim = round(Math.max(maxSimWhitelist, maxSimPool), 3);
      await archiveRejectionIfQuotaAllows("REJECTED (Stage-2)", 58.0, "Stage-2 Tanimoto Redundancy Cutoff", `기존 레퍼런스(${closestWhiteId !== "None" ? closestWhiteId : closestPoolId})와 타니모토 유사도(S_T=${maxSim} >= 0.84) 과다 중복으로 탈락 보관됨`);
      continue;
    }
    if (rej === "cosmetic") {
      telemetry.rejected_stage2_cosmetic_low_delta += 1;
      await archiveRejectionIfQuotaAllows("REJECTED (Stage-2)", 61.5, "Stage-2 Cosmetic Variant Filter", `구조 유사도(S_T>=0.64) 대비 8차원 물성 변위(ΔP=${round(Math.min(rejDelta || 0.05, minDeltaPool), 4)} < 0.088)가 미미한 단순 변종(Cosmetic Variant)으로 탈락 보관됨`);
      continue;
    }

    const overallMaxTanimoto = Math.max(maxSimWhitelist, maxSimPool);
    const effectivePropDelta = minDeltaPool < 900.0 ? minDeltaPool : 0.28;
    const innovationScore = round((1.0 - overallMaxTanimoto) * 44.0 + Math.min(28.0, effectivePropDelta * 135.0) + Math.min(28.0, (tdC / 440.0) * 10.0 + (tensileMpa / 95.0) * 9.0 + (processingWindowC / 130.0) * 9.0), 2);
    if (innovationScore < 74.0) {
      telemetry.rejected_stage3_sub_s_grade += 1;
      await archiveRejectionIfQuotaAllows("REJECTED (Stage-3)", innovationScore, "Stage-3 Sub-S-Grade Pareto Gate", `열·기계적 파레토 종합 혁신 점수(${innovationScore}점 < 74.0점 S급 기준) 미달로 아카이브 보관됨`);
      continue;
    }

    const sTier = innovationScore >= 86.0 ? "S++" : innovationScore >= 80.0 ? "S+" : "S";
    seqNum += 1;
    candidate.id = `PMX-LIVE-${String(seqNum).padStart(6, "0")}`;
    candidate.quality_grade = sTier;
    candidate.innovation_score = innovationScore;
    candidate.similarity_audit = {
      passed: true, quality_grade: sTier, innovation_score: innovationScore,
      max_tanimoto_similarity_whitelist: round(maxSimWhitelist, 4),
      max_tanimoto_similarity_pool: round(maxSimPool, 4),
      overall_max_tanimoto: round(overallMaxTanimoto, 4),
      nearest_reference_id: maxSimWhitelist >= maxSimPool ? closestWhiteId : closestPoolId,
      property_delta_score: round(effectivePropDelta, 4),
      cosmetic_variant_check: "PASSED (Distinct Structure-Property Signature)",
    };
    candidate.novelty_tags = [`Grade ${sTier} Verified Innovator`];

    // If sliding window is full (5,000), evict oldest
    if (poolEntries.length >= MAX_POOL_SIZE) {
      poolEntries.shift();
      telemetry.sliding_window_evictions += 1;
    }

    poolEntries.push([candidate, candFp]);
    await persistMaterialAsset(
      candidate,
      "ACTIVE_S_TIER",
      `PASSED (Grade ${sTier} Innovator)`,
      `4단계 물리화학 및 타니모토 중복 필터 통과 — 혁신점수 ${innovationScore}점`
    );
    telemetry.accepted_s_grade += 1;
    added += 1;
  }

  telemetry.current_pool_size = poolEntries.length;
  telemetry.last_updated_at = new Date().toISOString();
  cycleCount += 1;

  const recentRecords = poolEntries.slice(-32).map((e) => e[0]);
  const deltaPayload = {
    telemetry,
    recent_records: recentRecords,
    recent_rejected_records: recentRejectedRecords.slice(-24),
  };
  atomicWriteJson(MAIN_PROJECT_DELTA, deltaPayload);
  atomicWriteJson(MAIN_PROJECT_TELEMETRY, telemetry);
  if (WORKSPACE_DELTA !== MAIN_PROJECT_DELTA && fs.existsSync(path.dirname(WORKSPACE_DELTA))) {
    atomicWriteJson(WORKSPACE_DELTA, deltaPayload);
    atomicWriteJson(WORKSPACE_TELEMETRY, telemetry);
  }

  if (cycleCount === 1 || cycleCount % 15 === 0) {
    const recordsOnly = poolEntries.map((e) => e[0]);
    atomicWriteJson(MAIN_PROJECT_POOL, recordsOnly);
    if (WORKSPACE_POOL !== MAIN_PROJECT_POOL && fs.existsSync(path.dirname(WORKSPACE_POOL))) {
      atomicWriteJson(WORKSPACE_POOL, recordsOnly);
    }
  }

  const latestId = recentRecords.length > 0 ? recentRecords[recentRecords.length - 1].id : "N/A";
  console.log(
    `[LiveDaemon Stabilized (${INTERVAL_MS / 1000}s)] Pool=${poolEntries.length}/${MAX_POOL_SIZE} | Added=${added} | Archived/Rejected=${archivedInCycle} | Latest=${latestId}`
  );
}

stepBatch();
setInterval(stepBatch, INTERVAL_MS);
