/**
 * PolyMatrix 32-Dimensional Physicochemical & Topological Embedding Engine
 * ========================================================================
 * Converts any polymer record (OPEN_BENCHMARK, ACTIVE_S_TIER, ARCHIVED_REJECTED)
 * or natural-language user query into a normalized 32-dimensional vector(32)
 * compatible with PostgreSQL `pgvector` (`<=>` cosine distance / `<->` L2 distance).
 *
 * Vector Dimensions (0..31):
 *   [0]  Tg normalized: (Tg + 150) / 450
 *   [1]  Tm normalized: (Tm + 50) / 450
 *   [2]  Td normalized: Td / 600
 *   [3]  Tensile Strength normalized: tensileMpa / 200
 *   [4]  Modulus normalized: modulusGpa / 10
 *   [5]  Elongation normalized: min(1, elongation / 500)
 *   [6]  Density normalized: (density - 0.8) / 1.4
 *   [7]  Crystallinity normalized: crystallinity / 100
 *   [8]  Mn log-normalized: log10(max(1000, Mn)) / 6
 *   [9]  DP normalized: min(1, dp_n / 1000)
 *   [10] PDI normalized: (PDI - 1.0) / 3.0
 *   [11] Flory-Huggins chi*N normalized: min(1, chi_N / 100)
 *   [12] HSP delta_total normalized: hsp_total / 35
 *   [13] Processing Window normalized: max(0, min(1, procWindow / 200))
 *   [14] Innovation / Quality Score normalized: score / 100
 *   [15] Architecture: Homopolymer indicator
 *   [16] Architecture: Block (-b-) indicator
 *   [17] Architecture: Graft (-g-) indicator
 *   [18] Architecture: Random (-ran-) indicator
 *   [19] Morphology: Lamellar / Cylindrical / Gyroid nanostructure indicator
 *   [20] Chemical Motif: Aromatic / Phenyl ring (c1ccccc1, St, PET, PC, PEEK, Aramid)
 *   [21] Chemical Motif: Amide / Polyamide (-NH-CO-, PA6, Nylon, Aramid)
 *   [22] Chemical Motif: Ester / Carbonate (-COO-, PET, PLA, PCL, PC, MMA)
 *   [23] Chemical Motif: Fluorine / Halo (-F, -Cl, PVDF, PTFE, PVC)
 *   [24] Chemical Motif: Siloxane / Elastomer / Diene (Si, DMS, Bd, Spandex)
 *   [25] Chemical Motif: Nitrile / Pyridine / Pyrrolidone (AN, P4VP, VP)
 *   [26] Chemical Motif: Ether / Ketone / Sulfone (EO, PO, PEEK, PES)
 *   [27] Chemical Motif: Polyolefin / Aliphatic (PE, PP)
 *   [28..31] Topological Morgan-like SMILES Hash Projection (4 dimensions)
 */

export const EMBEDDING_DIM = 32;

const clamp01 = (v: number): number => {
  if (!Number.isFinite(v)) return 0.0;
  return Math.max(0.0, Math.min(1.0, v));
};

export interface EmbeddingInputSpec {
  id?: string;
  name?: string;
  koreanName?: string;
  shortCode?: string;
  category?: string;
  architecture?: string;
  morphology?: string;
  smiles?: string;
  tg?: number;
  tm?: number | null;
  td?: number | null;
  tensileStrengthMpa?: number;
  modulusGpa?: number;
  elongationPct?: number;
  density?: number;
  crystallinityPct?: number;
  mn?: number;
  dpN?: number;
  pdi?: number;
  chiN?: number;
  hspTotal?: number;
  processingWindowC?: number;
  innovationScore?: number;
}

/**
 * Generates a L2-normalized 32-dimensional vector for any polymer asset.
 */
export function computePolymerEmbedding32(spec: EmbeddingInputSpec): number[] {
  const vec = new Array<number>(EMBEDDING_DIM).fill(0);

  const tg = spec.tg ?? 50;
  const tm = spec.tm ?? tg + 110;
  const td = spec.td ?? Math.max(320, tm + 110);
  const tensile = spec.tensileStrengthMpa ?? 55;
  const modulus = spec.modulusGpa ?? 2.2;
  const elongation = spec.elongationPct ?? 45;
  const density = spec.density ?? 1.18;
  const cryst = spec.crystallinityPct ?? 28;
  const mn = spec.mn ?? 35000;
  const dp = spec.dpN ?? 180;
  const pdi = spec.pdi ?? 1.85;
  const chiN = spec.chiN ?? 0;
  const hsp = spec.hspTotal ?? 20.5;
  const procWin = spec.processingWindowC ?? Math.max(20, td - tm - 15);
  const score = spec.innovationScore ?? 80;

  // [0..14] Continuous Physicochemical Features
  vec[0] = clamp01((tg + 150) / 450);
  vec[1] = clamp01((tm + 50) / 450);
  vec[2] = clamp01(td / 600);
  vec[3] = clamp01(tensile / 200);
  vec[4] = clamp01(modulus / 10);
  vec[5] = clamp01(elongation / 500);
  vec[6] = clamp01((density - 0.8) / 1.4);
  vec[7] = clamp01(cryst / 100);
  vec[8] = clamp01(Math.log10(Math.max(1000, mn)) / 6.0);
  vec[9] = clamp01(dp / 1000);
  vec[10] = clamp01((pdi - 1.0) / 3.0);
  vec[11] = clamp01(chiN / 120);
  vec[12] = clamp01(hsp / 35);
  vec[13] = clamp01(procWin / 220);
  vec[14] = clamp01(score / 100);

  // [15..19] Architecture & Morphology Indicators
  const archBlob = `${spec.architecture || ""} ${spec.category || ""} ${spec.shortCode || ""}`.toLowerCase();
  if (archBlob.includes("block") || archBlob.includes("-b-")) {
    vec[16] = 0.85;
  } else if (archBlob.includes("graft") || archBlob.includes("-g-")) {
    vec[17] = 0.85;
  } else if (archBlob.includes("random") || archBlob.includes("-ran-") || archBlob.includes("-co-")) {
    vec[18] = 0.85;
  } else {
    vec[15] = 0.85; // Homopolymer / Standard
  }

  const morphBlob = (spec.morphology || "").toLowerCase();
  if (morphBlob.includes("lamellar") || morphBlob.includes("cylindrical") || morphBlob.includes("gyroid")) {
    vec[19] = 0.8;
  } else if (morphBlob.includes("spherical")) {
    vec[19] = 0.5;
  }

  // [20..27] Chemical Motif & Functional Group Features
  const textBlob = `${spec.name || ""} ${spec.koreanName || ""} ${spec.shortCode || ""} ${spec.category || ""} ${spec.smiles || ""}`.toLowerCase();

  // [20] Aromatic
  if (/c1cc|phenyl|styrene|terephthalate|aramid|peek|bisphenol|carbonate|ps\b|eg_tpa|pc_bpa|pes_u|스티렌|방향족|벤젠|아라미드|폴리에스터/.test(textBlob)) {
    vec[20] = 0.9;
  }
  // [21] Amide / Polyamide
  if (/amide|nylon|caprolactam|pa6|pa66|aramid|kevlar|nc\(=o\)|나일론|폴리아미드|아미드/.test(textBlob)) {
    vec[21] = 0.9;
  }
  // [22] Ester / Acrylic / Carbonate
  if (/ester|acrylate|methacrylate|lactide|lactic|caprolactone|carbonate|mma\b|ba\b|la\b|cl\b|gma\b|c\(=o\)o|에스테르|아크릴|락트산|카보네이트/.test(textBlob)) {
    vec[22] = 0.9;
  }
  // [23] Fluorine / Chlorine
  if (/fluoro|vinylidene|tetrafluoro|vdf\b|ptfe|pvdf|pvc|chloro|\(f\)|\(cl\)|불소|테프론|염화비닐/.test(textBlob)) {
    vec[23] = 0.95;
  }
  // [24] Siloxane / Diene / Elastomer
  if (/siloxane|dms\b|pdms|\[si\]|butadiene|isoprene|bd\b|elastomer|spandex|urethane|실록산|실리콘|부타디엔|고무|탄성|우레탄/.test(textBlob)) {
    vec[24] = 0.95;
  }
  // [25] Nitrile / Pyridine / Pyrrolidone
  if (/nitrile|acrylonitrile|an\b|pan\b|pyridine|p4vp|pyrrolidone|vp\b|c#n|니트릴|피리딘|피롤리돈/.test(textBlob)) {
    vec[25] = 0.9;
  }
  // [26] Ether / Ketone / Sulfone
  if (/ether|oxide|eo\b|po\b|peg|peek|sulfone|pes\b|s\(=o\)|에테르|옥사이드|설폰|케톤/.test(textBlob)) {
    vec[26] = 0.85;
  }
  // [27] Polyolefin / Aliphatic
  if (/ethylene|propylene|olefin|pe\b|pp\b|폴리에틸렌|폴리프로필렌|올레핀/.test(textBlob)) {
    vec[27] = 0.85;
  }

  // [28..31] Topological SMILES Shingle Hash Projection
  const cleanSmiles = (spec.smiles || spec.shortCode || spec.name || "C").replace(/[*()\[\]\s]/g, "");
  for (let i = 0; i < cleanSmiles.length; i++) {
    const code = cleanSmiles.charCodeAt(i);
    const bucket = 28 + ((code + i * 7) % 4);
    vec[bucket] += ((code % 13) + 1) / (13.0 * Math.max(4, cleanSmiles.length));
  }
  for (let b = 28; b < 32; b++) {
    vec[b] = clamp01(vec[b]);
  }

  return l2Normalize(vec);
}

/**
 * Parses a natural-language user query (Korean/English) into a 32-dim query vector
 * AND extracts explicit numerical/structural constraints for hybrid pgvector RAG search.
 */
export interface ParsedRagQuery {
  rawQuery: string;
  embedding: number[];
  extractedConstraints: {
    minTg?: number;
    maxTg?: number;
    minTd?: number;
    minTensileMpa?: number;
    minModulusGpa?: number;
    minElongationPct?: number;
    targetMw?: number;
    preferredArchitecture?: "Block (-b-)" | "Graft (-g-)" | "Random" | "Homopolymer";
    preferredMorphology?: string;
    keywords: string[];
    includeRejectedWarning?: boolean;
  };
}

export function parseNaturalLanguageToRagQuery(rawQuery: string): ParsedRagQuery {
  const q = rawQuery.trim();
  const lower = q.toLowerCase();

  const constraints: ParsedRagQuery["extractedConstraints"] = {
    keywords: [],
  };

  // 1. Extract Tg constraints (e.g., "Tg 150도 이상", "유리전이온도 120℃", "고내열", "저온 유연성")
  const tgMatch = q.match(/(?:tg|유리전이\s*온도|내열\s*온도|내열성)[^\d\-]*(-?\d+(?:\.\d+)?)\s*(?:도|℃|°c)?/i);
  if (tgMatch) {
    const val = parseFloat(tgMatch[1]);
    if (lower.includes("이하") || lower.includes("미만") || lower.includes("낮은")) {
      constraints.maxTg = val;
    } else {
      constraints.minTg = val;
    }
  } else if (lower.includes("초고내열") || lower.includes("고내열") || lower.includes("내열성")) {
    constraints.minTg = 135;
  } else if (lower.includes("저온") || lower.includes("탄성체") || lower.includes("엘라스토머") || lower.includes("유연")) {
    constraints.maxTg = 15;
  }

  // 2. Extract Td constraints
  const tdMatch = q.match(/(?:td|열분해\s*온도)[^\d]*(\d+(?:\.\d+)?)/i);
  if (tdMatch) {
    constraints.minTd = parseFloat(tdMatch[1]);
  }

  // 3. Extract Tensile Strength (handles both MPa and g/d -> 1 g/d ≈ 12.5 MPa)
  const mpaMatch = q.match(/(\d+(?:\.\d+)?)\s*mpa/i);
  const gdMatch = q.match(/(?:인장\s*강도|강도|tenacity)[^\d]*(\d+(?:\.\d+)?)\s*(?:g\/d|gd)?/i);
  if (mpaMatch) {
    constraints.minTensileMpa = parseFloat(mpaMatch[1]);
  } else if (gdMatch) {
    const rawVal = parseFloat(gdMatch[1]);
    constraints.minTensileMpa = rawVal <= 20 ? Math.round(rawVal * 11.5) : rawVal;
  } else if (lower.includes("초고강도") || lower.includes("고강도") || lower.includes("방탄")) {
    constraints.minTensileMpa = 75;
  }

  // 4. Extract Elongation
  const elongMatch = q.match(/(?:신율|신장률|elongation)[^\d]*(\d+(?:\.\d+)?)\s*%/i);
  if (elongMatch) {
    constraints.minElongationPct = parseFloat(elongMatch[1]);
  } else if (lower.includes("고신율") || lower.includes("유연한") || lower.includes("잘 늘어나는")) {
    constraints.minElongationPct = 100;
  }

  // 5. Extract Molecular Weight
  const mwMatch = q.match(/(?:분자량|mw|mn)[^\d]*(\d[\d,]*)/i);
  if (mwMatch) {
    const parsedMw = parseInt(mwMatch[1].replace(/,/g, ""), 10);
    if (parsedMw >= 1000) constraints.targetMw = parsedMw;
  }

  // 6. Architecture preference
  if (lower.includes("graft") || lower.includes("그래프트") || lower.includes("가지형") || lower.includes("-g-")) {
    constraints.preferredArchitecture = "Graft (-g-)";
  } else if (lower.includes("block") || lower.includes("블록") || lower.includes("-b-")) {
    constraints.preferredArchitecture = "Block (-b-)";
  } else if (lower.includes("random") || lower.includes("랜덤") || lower.includes("-ran-")) {
    constraints.preferredArchitecture = "Random";
  } else if (lower.includes("단일") || lower.includes("호모") || lower.includes("homopolymer")) {
    constraints.preferredArchitecture = "Homopolymer";
  }

  // 7. Morphology preference
  if (lower.includes("lamellar") || lower.includes("라멜라") || lower.includes("층상")) {
    constraints.preferredMorphology = "Lamellar";
  } else if (lower.includes("cylindrical") || lower.includes("실린더")) {
    constraints.preferredMorphology = "Cylindrical";
  } else if (lower.includes("gyroid") || lower.includes("자이로이드")) {
    constraints.preferredMorphology = "Gyroid";
  } else if (lower.includes("spherical") || lower.includes("구형")) {
    constraints.preferredMorphology = "Spherical";
  }

  // 8. Check if user specifically asks about rejected/archived/failed structures
  if (
    lower.includes("탈락") ||
    lower.includes("삭제") ||
    lower.includes("아카이브") ||
    lower.includes("실패") ||
    lower.includes("주의") ||
    lower.includes("archive") ||
    lower.includes("rejected")
  ) {
    constraints.includeRejectedWarning = true;
  }

  // 9. Keyword tokens for hybrid boosting
  const stopWords = new Set([
    "고분자", "소재", "신소재", "만들어줘", "추천해줘", "추천", "찾아줘", "검색", "알려줘",
    "이상", "이하", "만족하는", "가진", "사슬", "구조", "조건", "비교", "데이터", "검색해줘",
  ]);
  const rawTokens = lower
    .split(/[\s,()\[\]\/]+/)
    .map((t) => t.replace(/(으로|에서|이고|이며|해줘|줘|을|를|이|가|은|는|의|와|과)$/, ""))
    .filter((t) => t.length >= 2 && !stopWords.has(t) && !/^\d+$/.test(t));
  constraints.keywords = Array.from(new Set(rawTokens)).slice(0, 8);

  // Build synthetic spec representing the ideal target material for vector similarity search
  const targetSpec: EmbeddingInputSpec = {
    name: q,
    koreanName: q,
    architecture: constraints.preferredArchitecture || "Block (-b-)",
    morphology: constraints.preferredMorphology || (constraints.preferredArchitecture === "Block (-b-)" ? "Lamellar" : ""),
    tg: constraints.minTg !== undefined ? constraints.minTg + 15 : constraints.maxTg !== undefined ? constraints.maxTg - 25 : 95,
    tm: constraints.minTg !== undefined ? constraints.minTg + 125 : 220,
    td: constraints.minTd ?? (constraints.minTg ? constraints.minTg + 250 : 410),
    tensileStrengthMpa: constraints.minTensileMpa ?? 75,
    modulusGpa: constraints.minModulusGpa ?? (constraints.minTensileMpa ? constraints.minTensileMpa / 22 : 3.0),
    elongationPct: constraints.minElongationPct ?? 55,
    mn: constraints.targetMw ?? 45000,
    dpN: constraints.targetMw ? Math.round(constraints.targetMw / 120) : 280,
    innovationScore: 88,
  };

  const embedding = computePolymerEmbedding32(targetSpec);

  return {
    rawQuery: q,
    embedding,
    extractedConstraints: constraints,
  };
}

export function l2Normalize(vec: number[]): number[] {
  let sumSq = 0;
  for (let i = 0; i < vec.length; i++) {
    sumSq += vec[i] * vec[i];
  }
  const norm = Math.sqrt(sumSq);
  if (norm < 1e-9) return vec.map(() => 0);
  return vec.map((v) => Number((v / norm).toFixed(6)));
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 1e-9 ? dot / denom : 0;
}

export function formatPgVectorLiteral(vec: number[]): string {
  return `[${vec.map((v) => Number(v.toFixed(6))).join(",")}]`;
}

