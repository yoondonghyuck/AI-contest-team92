export interface AtomDef {
  name: string;
  element: "C" | "H" | "O" | "N" | "F" | "Cl" | "S";
  relPos: [number, number, number];
  isBackbone?: boolean;
}

export interface BondDef {
  from: number;
  to: number;
  order: 1 | 2 | 3;
}

export interface PolymerDefinition {
  id: string;
  name: string;
  shortName: string;
  koreanName: string;
  rawName?: string; // 원료명 (e.g. Polycaprolactam)
  iupacName?: string; // IUPAC 공식 명칭
  aliases: string[];
  category: "단일 고분자 (Homopolymer)" | "공중합체 (Copolymer)" | "열경화성 수지 (Thermoset)" | "특수 구조 (Special Architecture)";
  thermalCategory: "Thermoplastic (열가소성)" | "Thermoset (열경화성)" | "Special (특수 구조)";
  chainArchitecture: string; // 선형, 가지형, 그래프트, 블록, 교대, 랜덤, 망상형 등
  smiles: string;
  density: number; // g/cm³
  tg: number; // ℃
  tm?: number; // ℃
  formulaUnit: string;
  formulaDisplay: string;
  monomerMW: number;
  description: string;
  application: string;
  unitLength: number;
  unitAtoms: AtomDef[];
  unitBonds: BondDef[];
  connection: {
    headAtomIndex: number;
    tailAtomIndex: number;
    bondOrder: 1 | 2;
  };
  typicalMwRange?: [number, number];
  defaultMw?: number;
}

export interface RenderAtom {
  id: string;
  element: "C" | "H" | "O" | "N" | "F" | "Cl" | "S";
  name: string;
  position: [number, number, number];
  unitIndex: number;
  isBackbone: boolean;
  color: string;
  radius: number;
}

export interface RenderBond {
  id: string;
  atomAId: string;
  atomBId: string;
  posA: [number, number, number];
  posB: [number, number, number];
  order: 1 | 2 | 3;
  isInterUnit: boolean;
  color: string;
}

// CPK 컬러 및 원자 반경
export const ELEMENT_PROPERTIES: Record<
  string,
  { color: string; radius: number; vdwRadius: number; name: string }
> = {
  C: { color: "#334155", radius: 0.38, vdwRadius: 0.75, name: "Carbon (탄소)" },
  H: { color: "#f8fafc", radius: 0.22, vdwRadius: 0.50, name: "Hydrogen (수소)" },
  O: { color: "#ef4444", radius: 0.35, vdwRadius: 0.70, name: "Oxygen (산소)" },
  N: { color: "#3b82f6", radius: 0.36, vdwRadius: 0.72, name: "Nitrogen (질소)" },
  F: { color: "#10b981", radius: 0.32, vdwRadius: 0.65, name: "Fluorine (불소)" },
  Cl: { color: "#22c55e", radius: 0.44, vdwRadius: 0.85, name: "Chlorine (염소)" },
  S: { color: "#eab308", radius: 0.42, vdwRadius: 0.82, name: "Sulfur (황)" },
};

// ─────────────────────────────────────────────────────────────────────────────
// 30종 통합 고분자 데이터베이스 (db.md 전면 반영)
// ─────────────────────────────────────────────────────────────────────────────
export const POLYMER_DATABASE: PolymerDefinition[] = [
  // ─── [A. 범용 및 공학용 단일 고분자 (Homopolymers)] ───
  // 1. PE
  {
    id: "pe",
    name: "Polyethylene",
    shortName: "PE",
    koreanName: "폴리에틸렌",
    iupacName: "Poly(methylene)",
    aliases: ["pe", "polyethylene", "hdpe", "ldpe", "폴리에틸렌", "다이니마"],
    category: "단일 고분자 (Homopolymer)",
    thermalCategory: "Thermoplastic (열가소성)",
    chainArchitecture: "Linear / Branched (선형/분기형)",
    smiles: "[CH2][CH2]",
    density: 0.95,
    tg: -120,
    tm: 135,
    formulaUnit: "C2H4",
    formulaDisplay: "—[CH₂—CH₂]ₙ—",
    monomerMW: 28.05,
    description: "가장 대표적인 범용 열가소성 수지로 All-trans 지그재그 탄소 골격을 가집니다. 초고분자량(UHMWPE) 시 초고강력 섬유가 됩니다.",
    application: "포장용 필름, 초고강도 섬유, 파이프, 용기",
    unitLength: 2.54,
    unitAtoms: [
      { name: "C1", element: "C", relPos: [0.0, 0.0, 0.0], isBackbone: true },
      { name: "C2", element: "C", relPos: [1.27, 0.88, 0.0], isBackbone: true },
      { name: "H1", element: "H", relPos: [0.0, -0.62, 0.89] },
      { name: "H2", element: "H", relPos: [0.0, -0.62, -0.89] },
      { name: "H3", element: "H", relPos: [1.27, 1.50, 0.89] },
      { name: "H4", element: "H", relPos: [1.27, 1.50, -0.89] },
    ],
    unitBonds: [
      { from: 0, to: 1, order: 1 },
      { from: 0, to: 2, order: 1 },
      { from: 0, to: 3, order: 1 },
      { from: 1, to: 4, order: 1 },
      { from: 1, to: 5, order: 1 },
    ],
    connection: { headAtomIndex: 0, tailAtomIndex: 1, bondOrder: 1 },
  },

  // 2. PTFE
  {
    id: "ptfe",
    name: "Polytetrafluoroethylene",
    shortName: "PTFE",
    koreanName: "폴리테트라플루오로에틸렌 (테프론)",
    iupacName: "Poly(difluoromethylene)",
    aliases: ["ptfe", "teflon", "테프론", "테플론", "고어텍스", "gore-tex"],
    category: "단일 고분자 (Homopolymer)",
    thermalCategory: "Thermoplastic (열가소성)",
    chainArchitecture: "Linear Helical (선형 나선형)",
    smiles: "[C](F)(F)[C](F)(F)",
    density: 2.20,
    tg: 125,
    tm: 327,
    formulaUnit: "C2F4",
    formulaDisplay: "—[CF₂—CF₂]ₙ—",
    monomerMW: 100.02,
    description: "C-F 결합의 극단적 불활성으로 초소수성, 무마찰성, 고내열성을 지닙니다. 방수투습 멤브레인의 원료입니다.",
    application: "고어텍스 멤브레인, 비점착 주방용품 코팅, 고주파 절연재",
    unitLength: 2.58,
    unitAtoms: [
      { name: "C1", element: "C", relPos: [0.0, 0.0, 0.0], isBackbone: true },
      { name: "C2", element: "C", relPos: [1.29, 0.88, 0.0], isBackbone: true },
      { name: "F1", element: "F", relPos: [0.0, -0.68, 0.95] },
      { name: "F2", element: "F", relPos: [0.0, -0.68, -0.95] },
      { name: "F3", element: "F", relPos: [1.29, 1.56, 0.95] },
      { name: "F4", element: "F", relPos: [1.29, 1.56, -0.95] },
    ],
    unitBonds: [
      { from: 0, to: 1, order: 1 },
      { from: 0, to: 2, order: 1 },
      { from: 0, to: 3, order: 1 },
      { from: 1, to: 4, order: 1 },
      { from: 1, to: 5, order: 1 },
    ],
    connection: { headAtomIndex: 0, tailAtomIndex: 1, bondOrder: 1 },
  },

  // 3. PS
  {
    id: "ps",
    name: "Polystyrene",
    shortName: "PS",
    koreanName: "폴리스티렌",
    iupacName: "Poly(1-phenylethylene)",
    aliases: ["ps", "polystyrene", "폴리스티렌", "스티로폼"],
    category: "단일 고분자 (Homopolymer)",
    thermalCategory: "Thermoplastic (열가소성)",
    chainArchitecture: "Linear with Phenyl Pendants",
    smiles: "C(Cc1ccccc1)C",
    density: 1.05,
    tg: 100,
    tm: 240,
    formulaUnit: "C8H8",
    formulaDisplay: "—[CH₂—CH(C₆H₅)]ₙ—",
    monomerMW: 104.15,
    description: "벤젠 고리 곁사슬을 지닌 고투명성 수지이며 발포 시 완충 스티로폼이 됩니다.",
    application: "일회용 투명 용기, 포장 완충재, 가전제품 케이스",
    unitLength: 2.54,
    unitAtoms: [
      { name: "C1", element: "C", relPos: [0.0, 0.0, 0.0], isBackbone: true },
      { name: "C2", element: "C", relPos: [1.27, 0.88, 0.0], isBackbone: true },
      { name: "C_ph1", element: "C", relPos: [1.27, 2.25, 0.55] },
      { name: "C_ph2", element: "C", relPos: [2.35, 3.05, 0.85] },
      { name: "C_ph3", element: "C", relPos: [2.35, 4.35, 1.35] },
      { name: "C_ph4", element: "C", relPos: [1.27, 4.95, 1.55] },
      { name: "C_ph5", element: "C", relPos: [0.19, 4.15, 1.25] },
      { name: "C_ph6", element: "C", relPos: [0.19, 2.85, 0.75] },
      { name: "H1", element: "H", relPos: [0.0, -0.62, 0.89] },
      { name: "H2", element: "H", relPos: [0.0, -0.62, -0.89] },
      { name: "H3", element: "H", relPos: [1.27, 0.95, -1.02] },
    ],
    unitBonds: [
      { from: 0, to: 1, order: 1 },
      { from: 1, to: 2, order: 1 },
      { from: 2, to: 3, order: 2 },
      { from: 3, to: 4, order: 1 },
      { from: 4, to: 5, order: 2 },
      { from: 5, to: 6, order: 1 },
      { from: 6, to: 7, order: 2 },
      { from: 7, to: 2, order: 1 },
      { from: 0, to: 8, order: 1 },
      { from: 0, to: 9, order: 1 },
      { from: 1, to: 10, order: 1 },
    ],
    connection: { headAtomIndex: 0, tailAtomIndex: 1, bondOrder: 1 },
  },

  // 4. PP
  {
    id: "pp",
    name: "Polypropylene",
    shortName: "PP",
    koreanName: "폴리프로필렌",
    iupacName: "Poly(propylene)",
    aliases: ["pp", "polypropylene", "폴리프로필렌"],
    category: "단일 고분자 (Homopolymer)",
    thermalCategory: "Thermoplastic (열가소성)",
    chainArchitecture: "Linear with Methyl Pendants",
    smiles: "CC(C)",
    density: 0.91,
    tg: -10,
    tm: 165,
    formulaUnit: "C3H6",
    formulaDisplay: "—[CH₂—CH(CH₃)]ₙ—",
    monomerMW: 42.08,
    description: "물보다 가벼운 경량 수지(비중 0.91)로 부직포와 보온 섬유에 탁월합니다.",
    application: "위생용 부직포, 보온 의류 섬유, 자동차 범퍼",
    unitLength: 2.54,
    unitAtoms: [
      { name: "C1", element: "C", relPos: [0.0, 0.0, 0.0], isBackbone: true },
      { name: "C2", element: "C", relPos: [1.27, 0.88, 0.0], isBackbone: true },
      { name: "C3", element: "C", relPos: [1.27, 2.05, 0.95] },
      { name: "H1", element: "H", relPos: [0.0, -0.62, 0.89] },
      { name: "H2", element: "H", relPos: [0.0, -0.62, -0.89] },
      { name: "H3", element: "H", relPos: [1.27, 1.35, -0.92] },
    ],
    unitBonds: [
      { from: 0, to: 1, order: 1 },
      { from: 1, to: 2, order: 1 },
      { from: 0, to: 3, order: 1 },
      { from: 0, to: 4, order: 1 },
      { from: 1, to: 5, order: 1 },
    ],
    connection: { headAtomIndex: 0, tailAtomIndex: 1, bondOrder: 1 },
  },

  // 5. PVC
  {
    id: "pvc",
    name: "Poly(vinyl chloride)",
    shortName: "PVC",
    koreanName: "폴리염화비닐",
    iupacName: "Poly(1-chloroethylene)",
    aliases: ["pvc", "polyvinyl chloride", "폴리염화비닐"],
    category: "단일 고분자 (Homopolymer)",
    thermalCategory: "Thermoplastic (열가소성)",
    chainArchitecture: "Linear with Chlorine Pendants",
    smiles: "C(Cl)C",
    density: 1.40,
    tg: 80,
    tm: 212,
    formulaUnit: "C2H3Cl",
    formulaDisplay: "—[CH₂—CH(Cl)]ₙ—",
    monomerMW: 62.5,
    description: "염소 원자로 인해 자체 난연성과 우수한 내화학성을 갖는 범용 수지입니다.",
    application: "상하수도 파이프, 인조 가죽, 전선 피복재",
    unitLength: 2.54,
    unitAtoms: [
      { name: "C1", element: "C", relPos: [0.0, 0.0, 0.0], isBackbone: true },
      { name: "C2", element: "C", relPos: [1.27, 0.88, 0.0], isBackbone: true },
      { name: "Cl1", element: "Cl", relPos: [1.27, 2.30, 1.05] },
      { name: "H1", element: "H", relPos: [0.0, -0.62, 0.89] },
      { name: "H2", element: "H", relPos: [0.0, -0.62, -0.89] },
      { name: "H3", element: "H", relPos: [1.27, 1.25, -0.95] },
    ],
    unitBonds: [
      { from: 0, to: 1, order: 1 },
      { from: 1, to: 2, order: 1 },
      { from: 0, to: 3, order: 1 },
      { from: 0, to: 4, order: 1 },
      { from: 1, to: 5, order: 1 },
    ],
    connection: { headAtomIndex: 0, tailAtomIndex: 1, bondOrder: 1 },
  },

  // 6. PAN
  {
    id: "pan",
    name: "Polyacrylonitrile",
    shortName: "PAN",
    koreanName: "폴리아크릴로니트릴 (아크릴)",
    iupacName: "Poly(1-cyanoethylene)",
    aliases: ["pan", "polyacrylonitrile", "아크릴", "탄소섬유"],
    category: "단일 고분자 (Homopolymer)",
    thermalCategory: "Thermoplastic (열가소성)",
    chainArchitecture: "Linear with Cyano Pendants",
    smiles: "C(C#N)C",
    density: 1.18,
    tg: 85,
    tm: 320,
    formulaUnit: "C3H3N",
    formulaDisplay: "—[CH₂—CH(C≡N)]ₙ—",
    monomerMW: 53.06,
    description: "고성능 탄소 섬유(Carbon Fiber)의 전구체이자 보온성이 우수한 아크릴 섬유의 원료입니다.",
    application: "탄소 섬유 전구체, 니트 스웨터, 인조 모피",
    unitLength: 2.54,
    unitAtoms: [
      { name: "C1", element: "C", relPos: [0.0, 0.0, 0.0], isBackbone: true },
      { name: "C2", element: "C", relPos: [1.27, 0.88, 0.0], isBackbone: true },
      { name: "C3", element: "C", relPos: [1.27, 2.15, 0.65] },
      { name: "N1", element: "N", relPos: [1.27, 3.15, 1.15] },
      { name: "H1", element: "H", relPos: [0.0, -0.62, 0.89] },
      { name: "H2", element: "H", relPos: [0.0, -0.62, -0.89] },
      { name: "H3", element: "H", relPos: [1.27, 1.25, -0.92] },
    ],
    unitBonds: [
      { from: 0, to: 1, order: 1 },
      { from: 1, to: 2, order: 1 },
      { from: 2, to: 3, order: 3 },
      { from: 0, to: 4, order: 1 },
      { from: 0, to: 5, order: 1 },
      { from: 1, to: 6, order: 1 },
    ],
    connection: { headAtomIndex: 0, tailAtomIndex: 1, bondOrder: 1 },
  },

  // 7. PMMA
  {
    id: "pmma",
    name: "Poly(methyl methacrylate)",
    shortName: "PMMA",
    koreanName: "폴리메틸메타크릴레이트 (아크릴 유리)",
    iupacName: "Poly[1-(methoxycarbonyl)-1-methylethylene]",
    aliases: ["pmma", "plexiglass", "lucite", "아크릴유리"],
    category: "단일 고분자 (Homopolymer)",
    thermalCategory: "Thermoplastic (열가소성)",
    chainArchitecture: "Linear with Ester & Methyl Pendants",
    smiles: "CC(C(=O)OC)(C)",
    density: 1.19,
    tg: 105,
    tm: 160,
    formulaUnit: "C5H8O2",
    formulaDisplay: "—[CH₂—C(CH₃)(COOCH₃)]ₙ—",
    monomerMW: 100.12,
    description: "유리보다 투명하고(투과율 92%) 가벼운 유기 유리 고분자로 우수한 내후성을 갖습니다.",
    application: "디스플레이 도광판, 자동차 헤드램프 커버, 항공기 창문",
    unitLength: 2.54,
    unitAtoms: [
      { name: "C1", element: "C", relPos: [0.0, 0.0, 0.0], isBackbone: true },
      { name: "C2", element: "C", relPos: [1.27, 0.88, 0.0], isBackbone: true },
      { name: "C_me", element: "C", relPos: [1.27, 2.10, 0.85] },
      { name: "C_est", element: "C", relPos: [1.27, 1.20, -1.35] },
      { name: "O_carb", element: "O", relPos: [1.27, 0.35, -2.25] },
      { name: "O_meth", element: "O", relPos: [1.27, 2.52, -1.55] },
      { name: "C_tail", element: "C", relPos: [1.27, 2.95, -2.85] },
    ],
    unitBonds: [
      { from: 0, to: 1, order: 1 },
      { from: 1, to: 2, order: 1 },
      { from: 1, to: 3, order: 1 },
      { from: 3, to: 4, order: 2 },
      { from: 3, to: 5, order: 1 },
      { from: 5, to: 6, order: 1 },
    ],
    connection: { headAtomIndex: 0, tailAtomIndex: 1, bondOrder: 1 },
  },

  // 8. PVAc
  {
    id: "pvac",
    name: "Poly(vinyl acetate)",
    shortName: "PVAc",
    koreanName: "폴리비닐아세테이트",
    iupacName: "Poly(1-acetoxyethylene)",
    aliases: ["pvac", "polyvinyl acetate", "목공풀"],
    category: "단일 고분자 (Homopolymer)",
    thermalCategory: "Thermoplastic (열가소성)",
    chainArchitecture: "Linear with Acetate Pendants",
    smiles: "CC(=O)OC(C)",
    density: 1.19,
    tg: 30,
    tm: 60,
    formulaUnit: "C4H6O2",
    formulaDisplay: "—[CH₂—CH(OCOCH₃)]ₙ—",
    monomerMW: 86.09,
    description: "목공용 수성 접착제(목공풀)의 주성분이며, 비누화 시 수용성 고분자인 PVA가 됩니다.",
    application: "수성 접착제, 도료 에멀전, 츄잉껌 기초제",
    unitLength: 2.54,
    unitAtoms: [
      { name: "C1", element: "C", relPos: [0.0, 0.0, 0.0], isBackbone: true },
      { name: "C2", element: "C", relPos: [1.27, 0.88, 0.0], isBackbone: true },
      { name: "O1", element: "O", relPos: [1.27, 2.05, 0.85] },
      { name: "C3", element: "C", relPos: [1.27, 3.25, 0.35] },
      { name: "O2", element: "O", relPos: [1.27, 3.65, -0.80] },
      { name: "C4", element: "C", relPos: [1.27, 4.25, 1.45] },
    ],
    unitBonds: [
      { from: 0, to: 1, order: 1 },
      { from: 1, to: 2, order: 1 },
      { from: 2, to: 3, order: 1 },
      { from: 3, to: 4, order: 2 },
      { from: 3, to: 5, order: 1 },
    ],
    connection: { headAtomIndex: 0, tailAtomIndex: 1, bondOrder: 1 },
  },

  // 9. PET
  {
    id: "pet",
    name: "Poly(ethylene terephthalate)",
    shortName: "PET",
    koreanName: "폴리에틸렌 테레프탈레이트 (폴리에스터)",
    iupacName: "Poly(oxyethyleneoxyterephthaloyl)",
    aliases: ["pet", "polyester", "폴리에스터", "폴리에스테르", "dacron", "페트"],
    category: "단일 고분자 (Homopolymer)",
    thermalCategory: "Thermoplastic (열가소성)",
    chainArchitecture: "Linear Aromatic Polyester",
    smiles: "O=C(c1ccc(C(=O)OCCO)cc1)OCCO",
    density: 1.38,
    tg: 75,
    tm: 256,
    formulaUnit: "C10H8O4",
    formulaDisplay: "—[O—CH₂—CH₂—O—CO—(C₆H₄)—CO]ₙ—",
    monomerMW: 192.17,
    description: "세계 최대 생산량의 합성 섬유(폴리에스터) 원료이자 투명 음료병 소재입니다.",
    application: "의류용 합성섬유, 타이어코드, 투명 페트병",
    unitLength: 10.75,
    unitAtoms: [
      { name: "O1", element: "O", relPos: [0.0, 0.0, 0.0], isBackbone: true },
      { name: "C1", element: "C", relPos: [1.25, 0.68, 0.0], isBackbone: true },
      { name: "C2", element: "C", relPos: [2.52, -0.15, 0.0], isBackbone: true },
      { name: "O2", element: "O", relPos: [3.78, 0.52, 0.0], isBackbone: true },
      { name: "C3", element: "C", relPos: [4.98, -0.18, 0.0], isBackbone: true },
      { name: "O3", element: "O", relPos: [4.95, -1.40, 0.0] },
      { name: "C4", element: "C", relPos: [6.32, 0.48, 0.0], isBackbone: true },
      { name: "C5", element: "C", relPos: [6.85, 1.48, 0.85] },
      { name: "C6", element: "C", relPos: [8.12, 1.95, 0.85] },
      { name: "C7", element: "C", relPos: [8.88, 1.45, 0.0], isBackbone: true },
      { name: "C8", element: "C", relPos: [8.35, 0.45, -0.85] },
      { name: "C9", element: "C", relPos: [7.08, -0.02, -0.85] },
      { name: "C10", element: "C", relPos: [10.22, 1.98, 0.0], isBackbone: true },
      { name: "O4", element: "O", relPos: [10.55, 3.16, 0.0] },
      { name: "H1", element: "H", relPos: [1.25, 1.35, 0.88] },
      { name: "H2", element: "H", relPos: [1.25, 1.35, -0.88] },
      { name: "H3", element: "H", relPos: [2.52, -0.82, 0.88] },
      { name: "H4", element: "H", relPos: [2.52, -0.82, -0.88] },
    ],
    unitBonds: [
      { from: 0, to: 1, order: 1 },
      { from: 1, to: 2, order: 1 },
      { from: 2, to: 3, order: 1 },
      { from: 3, to: 4, order: 1 },
      { from: 4, to: 5, order: 2 },
      { from: 4, to: 6, order: 1 },
      { from: 6, to: 7, order: 2 },
      { from: 7, to: 8, order: 1 },
      { from: 8, to: 9, order: 2 },
      { from: 9, to: 10, order: 1 },
      { from: 10, to: 11, order: 2 },
      { from: 11, to: 6, order: 1 },
      { from: 9, to: 12, order: 1 },
      { from: 12, to: 13, order: 2 },
      { from: 1, to: 14, order: 1 },
      { from: 1, to: 15, order: 1 },
      { from: 2, to: 16, order: 1 },
      { from: 2, to: 17, order: 1 },
    ],
    connection: { headAtomIndex: 0, tailAtomIndex: 12, bondOrder: 1 },
  },

  // 10. Nylon 66
  {
    id: "nylon66",
    name: "Nylon 66",
    shortName: "PA66",
    koreanName: "나일론 66 (폴리아미드 66)",
    rawName: "Poly(hexamethylene adipamide)",
    iupacName: "Poly[imino(hexamethylene)iminoadipoyl]",
    aliases: ["nylon 66", "nylon66", "pa66", "나일론66"],
    category: "단일 고분자 (Homopolymer)",
    thermalCategory: "Thermoplastic (열가소성)",
    chainArchitecture: "Linear Polyamide",
    smiles: "NCCCCCCNCCC(=O)CCCC(=O)O",
    density: 1.14,
    tg: 50,
    tm: 260,
    formulaUnit: "C12H22N2O2",
    formulaDisplay: "—[NH—(CH₂)₆—NH—CO—(CH₂)₄—CO]ₙ—",
    monomerMW: 226.32,
    description: "헥사메틸렌디아민과 아디프산의 축합중합체로 수소결합 밀도가 높아 고융점 고강도를 갖습니다.",
    application: "에어백 직물, 고내열성 엔지니어링 플라스틱, 타이어코드",
    unitLength: 17.2,
    unitAtoms: [
      { name: "N1", element: "N", relPos: [0.0, 0.0, 0.0], isBackbone: true },
      { name: "C1", element: "C", relPos: [1.25, 0.72, 0.0], isBackbone: true },
      { name: "C2", element: "C", relPos: [2.50, -0.14, 0.0], isBackbone: true },
      { name: "C3", element: "C", relPos: [3.75, 0.72, 0.0], isBackbone: true },
      { name: "C4", element: "C", relPos: [5.00, -0.14, 0.0], isBackbone: true },
      { name: "C5", element: "C", relPos: [6.25, 0.72, 0.0], isBackbone: true },
      { name: "C6", element: "C", relPos: [7.50, -0.14, 0.0], isBackbone: true },
      { name: "N2", element: "N", relPos: [8.75, 0.65, 0.0], isBackbone: true },
      { name: "C7", element: "C", relPos: [10.05, -0.10, 0.0], isBackbone: true },
      { name: "O1", element: "O", relPos: [10.05, -1.32, 0.0] },
      { name: "C8", element: "C", relPos: [11.30, 0.65, 0.0], isBackbone: true },
      { name: "C9", element: "C", relPos: [12.55, -0.14, 0.0], isBackbone: true },
      { name: "C10", element: "C", relPos: [13.80, 0.65, 0.0], isBackbone: true },
      { name: "C11", element: "C", relPos: [15.05, -0.14, 0.0], isBackbone: true },
      { name: "C12", element: "C", relPos: [16.35, 0.65, 0.0], isBackbone: true },
      { name: "O2", element: "O", relPos: [16.35, 1.88, 0.0] },
    ],
    unitBonds: [
      { from: 0, to: 1, order: 1 }, { from: 1, to: 2, order: 1 }, { from: 2, to: 3, order: 1 },
      { from: 3, to: 4, order: 1 }, { from: 4, to: 5, order: 1 }, { from: 5, to: 6, order: 1 },
      { from: 6, to: 7, order: 1 }, { from: 7, to: 8, order: 1 }, { from: 8, to: 9, order: 2 },
      { from: 8, to: 10, order: 1 }, { from: 10, to: 11, order: 1 }, { from: 11, to: 12, order: 1 },
      { from: 12, to: 13, order: 1 }, { from: 13, to: 14, order: 1 }, { from: 14, to: 15, order: 2 },
    ],
    connection: { headAtomIndex: 0, tailAtomIndex: 14, bondOrder: 1 },
  },

  // 11. Nylon 6
  {
    id: "nylon6",
    name: "Nylon 6",
    shortName: "Nylon 6",
    koreanName: "나일론 6 (폴리아미드 6)",
    rawName: "Polycaprolactam",
    iupacName: "Poly[imino(1-oxohexane-1,6-diyl)]",
    aliases: ["nylon 6", "nylon6", "pa6", "나일론", "나일론6", "polycaprolactam"],
    category: "단일 고분자 (Homopolymer)",
    thermalCategory: "Thermoplastic (열가소성)",
    chainArchitecture: "Linear Polyamide",
    smiles: "NCCCCCC(=O)O",
    density: 1.14,
    tg: 50,
    tm: 220,
    formulaUnit: "C6H11NO",
    formulaDisplay: "—[NH—(CH₂)₅—CO]ₙ—",
    monomerMW: 113.16,
    description: "카프로락탐의 개환중합체로 탄성과 산성염료 염색성이 매우 뛰어납니다.",
    application: "스타킹, 아웃도어 의류, 어망, 엔지니어링 플라스틱",
    unitLength: 8.65,
    unitAtoms: [
      { name: "N1", element: "N", relPos: [0.0, 0.0, 0.0], isBackbone: true },
      { name: "C1", element: "C", relPos: [1.25, 0.72, 0.0], isBackbone: true },
      { name: "C2", element: "C", relPos: [2.50, -0.14, 0.0], isBackbone: true },
      { name: "C3", element: "C", relPos: [3.75, 0.72, 0.0], isBackbone: true },
      { name: "C4", element: "C", relPos: [5.00, -0.14, 0.0], isBackbone: true },
      { name: "C5", element: "C", relPos: [6.25, 0.72, 0.0], isBackbone: true },
      { name: "C6", element: "C", relPos: [7.55, -0.10, 0.0], isBackbone: true },
      { name: "O1", element: "O", relPos: [7.55, -1.32, 0.0] },
      { name: "H_N", element: "H", relPos: [0.0, -0.98, 0.0] },
    ],
    unitBonds: [
      { from: 0, to: 1, order: 1 }, { from: 1, to: 2, order: 1 }, { from: 2, to: 3, order: 1 },
      { from: 3, to: 4, order: 1 }, { from: 4, to: 5, order: 1 }, { from: 5, to: 6, order: 1 },
      { from: 6, to: 7, order: 2 }, { from: 0, to: 8, order: 1 },
    ],
    connection: { headAtomIndex: 0, tailAtomIndex: 6, bondOrder: 1 },
  },

  // ─── [B. 공중합체 및 특수 사슬 구조 (Copolymers & Architectures)] ───
  // 12. HIPS
  {
    id: "hips",
    name: "High Impact Polystyrene",
    shortName: "HIPS",
    koreanName: "내충격성 폴리스티렌",
    aliases: ["hips", "high impact polystyrene"],
    category: "공중합체 (Copolymer)",
    thermalCategory: "Thermoplastic (열가소성)",
    chainArchitecture: "Graft Copolymer (PS 주사슬 + Polybutadiene 가지)",
    smiles: "[PS]-g-[PB]",
    density: 1.04,
    tg: 95,
    formulaUnit: "(C8H8)x-(C4H6)y",
    formulaDisplay: "—[PS backbone]—graft—[Polybutadiene rubber]—",
    monomerMW: 158.23,
    description: "깨지기 쉬운 폴리스티렌에 고무상 폴리부타디엔을 그래프트하여 충격 흡수력을 극대화한 탄성 수지입니다.",
    application: "냉장고 내벽, 가전제품 외장재, 일회용 요거트 용기",
    unitLength: 4.8,
    unitAtoms: [
      { name: "C1", element: "C", relPos: [0.0, 0.0, 0.0], isBackbone: true },
      { name: "C2", element: "C", relPos: [1.27, 0.88, 0.0], isBackbone: true },
      { name: "C_ph", element: "C", relPos: [1.27, 2.25, 0.55] },
      { name: "C_bd1", element: "C", relPos: [2.54, 0.0, 0.0], isBackbone: true },
      { name: "C_bd2", element: "C", relPos: [3.81, 0.88, 0.0], isBackbone: true },
    ],
    unitBonds: [
      { from: 0, to: 1, order: 1 }, { from: 1, to: 2, order: 1 },
      { from: 1, to: 3, order: 1 }, { from: 3, to: 4, order: 2 },
    ],
    connection: { headAtomIndex: 0, tailAtomIndex: 4, bondOrder: 1 },
  },

  // 13. Polybutadiene
  {
    id: "polybutadiene",
    name: "Polybutadiene",
    shortName: "BR",
    koreanName: "폴리부타디엔 고무",
    iupacName: "Poly(buta-1,3-diene)",
    aliases: ["polybutadiene", "br", "부타디엔"],
    category: "공중합체 (Copolymer)",
    thermalCategory: "Thermoplastic (열가소성)",
    chainArchitecture: "Linear Elastomer (cis-1,4)",
    smiles: "CC=CCC",
    density: 0.91,
    tg: -90,
    formulaUnit: "C4H6",
    formulaDisplay: "—[CH₂—CH=CH—CH₂]ₙ—",
    monomerMW: 54.09,
    description: "극저온 유리전이온도(-90℃)를 지녀 반발 탄성과 내마모성이 가장 우수한 합성 고무입니다.",
    application: "자동차 타이어 트레드, 골프공 코어, 내충격 보강제",
    unitLength: 4.85,
    unitAtoms: [
      { name: "C1", element: "C", relPos: [0.0, 0.0, 0.0], isBackbone: true },
      { name: "C2", element: "C", relPos: [1.25, 0.65, 0.0], isBackbone: true },
      { name: "C3", element: "C", relPos: [2.50, 0.0, 0.0], isBackbone: true },
      { name: "C4", element: "C", relPos: [3.75, 0.65, 0.0], isBackbone: true },
    ],
    unitBonds: [
      { from: 0, to: 1, order: 1 }, { from: 1, to: 2, order: 2 }, { from: 2, to: 3, order: 1 },
    ],
    connection: { headAtomIndex: 0, tailAtomIndex: 3, bondOrder: 1 },
  },

  // 14. Polyisoprene
  {
    id: "polyisoprene",
    name: "Polyisoprene",
    shortName: "IR / NR",
    koreanName: "폴리이소프렌 (천연고무)",
    iupacName: "Poly(2-methylbuta-1,3-diene)",
    aliases: ["polyisoprene", "natural rubber", "천연고무", "이소프렌"],
    category: "공중합체 (Copolymer)",
    thermalCategory: "Thermoplastic (열가소성)",
    chainArchitecture: "Linear Elastomer (cis-1,4)",
    smiles: "CC(=C)CC",
    density: 0.92,
    tg: -70,
    formulaUnit: "C5H8",
    formulaDisplay: "—[CH₂—C(CH₃)=CH—CH₂]ₙ—",
    monomerMW: 68.12,
    description: "고무나무에서 채취하는 천연고무(NR)의 주성분으로 우수한 점탄성과 인장강도를 보입니다.",
    application: "트럭/항공기 고하중 타이어, 수술용 라텍스 장갑, 댐퍼",
    unitLength: 4.85,
    unitAtoms: [
      { name: "C1", element: "C", relPos: [0.0, 0.0, 0.0], isBackbone: true },
      { name: "C2", element: "C", relPos: [1.25, 0.65, 0.0], isBackbone: true },
      { name: "C_me", element: "C", relPos: [1.25, 2.05, 0.65] },
      { name: "C3", element: "C", relPos: [2.50, 0.0, 0.0], isBackbone: true },
      { name: "C4", element: "C", relPos: [3.75, 0.65, 0.0], isBackbone: true },
    ],
    unitBonds: [
      { from: 0, to: 1, order: 1 }, { from: 1, to: 2, order: 1 },
      { from: 1, to: 3, order: 2 }, { from: 3, to: 4, order: 1 },
    ],
    connection: { headAtomIndex: 0, tailAtomIndex: 4, bondOrder: 1 },
  },

  // 15. Poly(S-co-MMA)
  {
    id: "ps_co_pmma",
    name: "Poly(styrene-co-methyl methacrylate)",
    shortName: "SMMA",
    koreanName: "스티렌-MMA 랜덤 공중합체",
    aliases: ["smma", "styrene mma copolymer", "ps-co-pmma"],
    category: "공중합체 (Copolymer)",
    thermalCategory: "Thermoplastic (열가소성)",
    chainArchitecture: "Random Copolymer (통계적 랜덤 배열)",
    smiles: "[CH2CH(c1ccccc1)]-co-[CH2C(CH3)(COOCH3)]",
    density: 1.12,
    tg: 102,
    formulaUnit: "(C8H8)-(C5H8O2)",
    formulaDisplay: "—[Styrene]—random—[Methyl Methacrylate]—",
    monomerMW: 204.27,
    description: "스티렌의 가공성과 MMA의 고투명성을 무작위로 결합하여 잔류 응력을 최소화한 광학용 수지입니다.",
    application: "투명 가전 외장재, 광학 렌즈, 고투명 포장재",
    unitLength: 5.08,
    unitAtoms: [
      { name: "C1", element: "C", relPos: [0.0, 0.0, 0.0], isBackbone: true },
      { name: "C2", element: "C", relPos: [1.27, 0.88, 0.0], isBackbone: true },
      { name: "C_ph", element: "C", relPos: [1.27, 2.25, 0.55] },
      { name: "C3", element: "C", relPos: [2.54, 0.0, 0.0], isBackbone: true },
      { name: "C4", element: "C", relPos: [3.81, 0.88, 0.0], isBackbone: true },
      { name: "C_est", element: "C", relPos: [3.81, 2.25, -0.65] },
    ],
    unitBonds: [
      { from: 0, to: 1, order: 1 }, { from: 1, to: 2, order: 1 },
      { from: 1, to: 3, order: 1 }, { from: 3, to: 4, order: 1 }, { from: 4, to: 5, order: 1 },
    ],
    connection: { headAtomIndex: 0, tailAtomIndex: 4, bondOrder: 1 },
  },

  // 16. Poly(S-alt-MMA)
  {
    id: "ps_alt_pmma",
    name: "Poly(styrene-alt-methyl methacrylate)",
    shortName: "PS-alt-PMMA",
    koreanName: "스티렌-MMA 교대 공중합체",
    aliases: ["ps-alt-pmma", "styrene mma alternating"],
    category: "공중합체 (Copolymer)",
    thermalCategory: "Thermoplastic (열가소성)",
    chainArchitecture: "Alternating Copolymer (정밀 1:1 교대 배열)",
    smiles: "[CH2CH(Ph)-alt-CH2C(Me)(COOMe)]",
    density: 1.13,
    tg: 104,
    formulaUnit: "C13H16O2",
    formulaDisplay: "—[Styrene—alt—MMA]ₙ—",
    monomerMW: 204.27,
    description: "스티렌 단위체와 MMA 단위체가 정확히 1:1로 번갈아 교대 배열되어 고유한 굴절률과 상용성을 보입니다.",
    application: "정밀 광학 렌즈, 고기능성 코팅막",
    unitLength: 5.08,
    unitAtoms: [
      { name: "C1", element: "C", relPos: [0.0, 0.0, 0.0], isBackbone: true },
      { name: "C2", element: "C", relPos: [1.27, 0.88, 0.0], isBackbone: true },
      { name: "C_ph", element: "C", relPos: [1.27, 2.25, 0.55] },
      { name: "C3", element: "C", relPos: [2.54, 0.0, 0.0], isBackbone: true },
      { name: "C4", element: "C", relPos: [3.81, 0.88, 0.0], isBackbone: true },
    ],
    unitBonds: [
      { from: 0, to: 1, order: 1 }, { from: 1, to: 2, order: 1 },
      { from: 1, to: 3, order: 1 }, { from: 3, to: 4, order: 1 },
    ],
    connection: { headAtomIndex: 0, tailAtomIndex: 4, bondOrder: 1 },
  },

  // 17. PS-b-PMMA
  {
    id: "ps_b_pmma",
    name: "Polystyrene-block-poly(methyl methacrylate)",
    shortName: "PS-b-PMMA",
    koreanName: "스티렌-MMA 블록 공중합체",
    aliases: ["ps-b-pmma", "block copolymer", "블록공중합체"],
    category: "공중합체 (Copolymer)",
    thermalCategory: "Thermoplastic (열가소성)",
    chainArchitecture: "Diblock Copolymer (나노 자기조립 블록)",
    smiles: "[PS]n-b-[PMMA]m",
    density: 1.13,
    tg: 105,
    formulaUnit: "—(PS)n—block—(PMMA)m—",
    formulaDisplay: "—[Polystyrene]ₙ—block—[Poly(methyl methacrylate)]ₘ—",
    monomerMW: 204.27,
    description: "서로 섞이지 않는 두 고분자 블록이 결합되어 미세상분리(DSA)를 통한 10nm급 나노 패턴을 자발 형성합니다.",
    application: "반도체 차세대 극미세 패터닝(DSA), 나노 리소그래피",
    unitLength: 5.08,
    unitAtoms: [
      { name: "C1", element: "C", relPos: [0.0, 0.0, 0.0], isBackbone: true },
      { name: "C2", element: "C", relPos: [1.27, 0.88, 0.0], isBackbone: true },
      { name: "C_ph", element: "C", relPos: [1.27, 2.25, 0.55] },
      { name: "C3", element: "C", relPos: [2.54, 0.0, 0.0], isBackbone: true },
      { name: "C4", element: "C", relPos: [3.81, 0.88, 0.0], isBackbone: true },
    ],
    unitBonds: [
      { from: 0, to: 1, order: 1 }, { from: 1, to: 2, order: 1 },
      { from: 1, to: 3, order: 1 }, { from: 3, to: 4, order: 1 },
    ],
    connection: { headAtomIndex: 0, tailAtomIndex: 4, bondOrder: 1 },
  },

  // 18. PS-g-PMMA
  {
    id: "ps_g_pmma",
    name: "Polystyrene-graft-poly(methyl methacrylate)",
    shortName: "PS-g-PMMA",
    koreanName: "스티렌-MMA 그래프트 공중합체",
    aliases: ["ps-g-pmma", "graft copolymer"],
    category: "공중합체 (Copolymer)",
    thermalCategory: "Thermoplastic (열가소성)",
    chainArchitecture: "Graft Copolymer (주사슬 PS + 가지 PMMA)",
    smiles: "[PS]-g-[PMMA]",
    density: 1.11,
    tg: 103,
    formulaUnit: "—[PS]—graft—[PMMA]—",
    formulaDisplay: "—[PS backbone]—graft—[PMMA branches]—",
    monomerMW: 204.27,
    description: "폴리스티렌 주사슬에 PMMA 곁사슬이 빗(Comb) 형태로 달린 이중 상용화 수지입니다.",
    application: "고분자 블렌드 상용화제, 표면 개질용 코팅제",
    unitLength: 5.08,
    unitAtoms: [
      { name: "C1", element: "C", relPos: [0.0, 0.0, 0.0], isBackbone: true },
      { name: "C2", element: "C", relPos: [1.27, 0.88, 0.0], isBackbone: true },
      { name: "C_br1", element: "C", relPos: [1.27, 2.30, 0.0] },
      { name: "C_br2", element: "C", relPos: [1.27, 3.60, 0.0] },
    ],
    unitBonds: [
      { from: 0, to: 1, order: 1 }, { from: 1, to: 2, order: 1 }, { from: 2, to: 3, order: 1 },
    ],
    connection: { headAtomIndex: 0, tailAtomIndex: 1, bondOrder: 1 },
  },

  // 19. SBR-VAc 3원 공중합체
  {
    id: "sbr_vac",
    name: "Poly(styrene-co-butadiene-co-vinyl acetate)",
    shortName: "SBR-VAc",
    koreanName: "스티렌-부타디엔-VAc 3원 공중합체",
    aliases: ["sbr-vac", "terpolymer", "3원공중합체"],
    category: "공중합체 (Copolymer)",
    thermalCategory: "Thermoplastic (열가소성)",
    chainArchitecture: "Random Terpolymer (3종 단량체 랜덤)",
    smiles: "[PS]-[PB]-[PVAc]",
    density: 1.08,
    tg: 45,
    formulaUnit: "(C8H8)-(C4H6)-(C4H6O2)",
    formulaDisplay: "—[Styrene—co—Butadiene—co—VAc]ₙ—",
    monomerMW: 244.34,
    description: "스티렌의 강성, 부타디엔의 탄성, 비닐아세테이트의 접착 친화성을 하나로 융합한 3원 탄성체입니다.",
    application: "종이 코팅 바인더 라텍스, 건축용 고접착 방수 도막",
    unitLength: 7.2,
    unitAtoms: [
      { name: "C1", element: "C", relPos: [0.0, 0.0, 0.0], isBackbone: true },
      { name: "C2", element: "C", relPos: [1.25, 0.85, 0.0], isBackbone: true },
      { name: "C3", element: "C", relPos: [2.50, 0.0, 0.0], isBackbone: true },
      { name: "C4", element: "C", relPos: [3.75, 0.85, 0.0], isBackbone: true },
      { name: "C5", element: "C", relPos: [5.00, 0.0, 0.0], isBackbone: true },
      { name: "C6", element: "C", relPos: [6.25, 0.85, 0.0], isBackbone: true },
    ],
    unitBonds: [
      { from: 0, to: 1, order: 1 }, { from: 1, to: 2, order: 1 }, { from: 2, to: 3, order: 2 },
      { from: 3, to: 4, order: 1 }, { from: 4, to: 5, order: 1 },
    ],
    connection: { headAtomIndex: 0, tailAtomIndex: 5, bondOrder: 1 },
  },

  // 20. SIS
  {
    id: "sis",
    name: "Polystyrene-b-polyisoprene-b-polystyrene",
    shortName: "SIS",
    koreanName: "스티렌-이소프렌-스티렌 3중 블록 공중합체",
    aliases: ["sis", "triblock", "열가소성엘라스토머", "tpe"],
    category: "공중합체 (Copolymer)",
    thermalCategory: "Thermoplastic (열가소성)",
    chainArchitecture: "Triblock Copolymer (A-B-A 열가소성 탄성체)",
    smiles: "[PS]n-b-[PI]m-b-[PS]n",
    density: 0.94,
    tg: -65,
    formulaUnit: "—[PS]—[PI]—[PS]—",
    formulaDisplay: "—[Polystyrene]ₙ—block—[Polyisoprene]ₘ—block—[Polystyrene]ₙ—",
    monomerMW: 276.44,
    description: "가황 공정 없이도 고무 탄성을 내는 대표적인 열가소성 엘라스토머(TPE)로 점착성이 우수합니다.",
    application: "핫멜트 점착제, 붕대 테이프, 신발 밑창",
    unitLength: 7.4,
    unitAtoms: [
      { name: "C1", element: "C", relPos: [0.0, 0.0, 0.0], isBackbone: true },
      { name: "C2", element: "C", relPos: [1.25, 0.85, 0.0], isBackbone: true },
      { name: "C3", element: "C", relPos: [2.50, 0.0, 0.0], isBackbone: true },
      { name: "C4", element: "C", relPos: [3.75, 0.85, 0.0], isBackbone: true },
      { name: "C5", element: "C", relPos: [5.00, 0.0, 0.0], isBackbone: true },
      { name: "C6", element: "C", relPos: [6.25, 0.85, 0.0], isBackbone: true },
    ],
    unitBonds: [
      { from: 0, to: 1, order: 1 }, { from: 1, to: 2, order: 1 }, { from: 2, to: 3, order: 2 },
      { from: 3, to: 4, order: 1 }, { from: 4, to: 5, order: 1 },
    ],
    connection: { headAtomIndex: 0, tailAtomIndex: 5, bondOrder: 1 },
  },

  // 21. PB-b-(PS-g-PAN)
  {
    id: "pb_b_ps_g_pan",
    name: "Polybutadiene-b-(PS-g-PAN)",
    shortName: "ABS/MABS 복합체",
    koreanName: "블록-그래프트 복합 3원공중합체",
    aliases: ["abs", "mabs", "복합공중합체"],
    category: "공중합체 (Copolymer)",
    thermalCategory: "Thermoplastic (열가소성)",
    chainArchitecture: "Block-Graft Complex Architecture",
    smiles: "[PB]-b-([PS]-g-[PAN])",
    density: 1.06,
    tg: 105,
    formulaUnit: "—[PB]—block—[PS—g—PAN]—",
    formulaDisplay: "—[Polybutadiene]—block—([PS]—graft—[PAN])—",
    monomerMW: 211.31,
    description: "아크릴로니트릴의 내화학성, 부타디엔의 충격성, 스티렌의 성형성을 복합 사슬 구조로 극대화한 최고급 엔지니어링 플라스틱입니다.",
    application: "레고 블록, 자동차 계기판 내장재, 3D 프린터 고급 필라멘트",
    unitLength: 6.5,
    unitAtoms: [
      { name: "C1", element: "C", relPos: [0.0, 0.0, 0.0], isBackbone: true },
      { name: "C2", element: "C", relPos: [1.25, 0.85, 0.0], isBackbone: true },
      { name: "C3", element: "C", relPos: [2.50, 0.0, 0.0], isBackbone: true },
      { name: "C4", element: "C", relPos: [3.75, 0.85, 0.0], isBackbone: true },
      { name: "N1", element: "N", relPos: [3.75, 2.15, 0.65] },
    ],
    unitBonds: [
      { from: 0, to: 1, order: 1 }, { from: 1, to: 2, order: 2 }, { from: 2, to: 3, order: 1 },
      { from: 3, to: 4, order: 3 },
    ],
    connection: { headAtomIndex: 0, tailAtomIndex: 3, bondOrder: 1 },
  },

  // ─── [C. 열경화성 수지 (Thermosetting Plastics)] ───
  // 22. Phenol 수지
  {
    id: "phenol_resin",
    name: "Phenol-Formaldehyde Resin",
    shortName: "Phenol Resin",
    koreanName: "페놀-포름알데히드 수지 (베이클라이트)",
    aliases: ["phenol", "bakelite", "페놀", "베이클라이트"],
    category: "열경화성 수지 (Thermoset)",
    thermalCategory: "Thermoset (열경화성)",
    chainArchitecture: "3D Network Crosslinked (3차원 메틸렌 가교 망상구조)",
    smiles: "c1(O)cc(Cc2c(O)cccc2)ccc1",
    density: 1.30,
    tg: 180,
    formulaUnit: "—[C6H3(OH)—CH₂]ₙ—",
    formulaDisplay: "—[Phenol—CH₂—Network]ₙ—",
    monomerMW: 106.12,
    description: "인류 최초의 합성 플라스틱(베이클라이트)으로 탁월한 내열성과 전기 절연성을 지닌 열경화성 수지입니다.",
    application: "회로기판(PCB), 전기 개폐기, 브레이크 마찰 패드",
    unitLength: 4.2,
    unitAtoms: [
      { name: "C1", element: "C", relPos: [0.0, 0.0, 0.0], isBackbone: true },
      { name: "C2", element: "C", relPos: [1.20, 0.70, 0.0], isBackbone: true },
      { name: "O_oh", element: "O", relPos: [1.20, 2.05, 0.0] },
      { name: "C3", element: "C", relPos: [2.40, 0.0, 0.0], isBackbone: true },
      { name: "C_br", element: "C", relPos: [3.60, 0.70, 0.0], isBackbone: true },
    ],
    unitBonds: [
      { from: 0, to: 1, order: 2 }, { from: 1, to: 2, order: 1 },
      { from: 1, to: 3, order: 1 }, { from: 3, to: 4, order: 1 },
    ],
    connection: { headAtomIndex: 0, tailAtomIndex: 4, bondOrder: 1 },
  },

  // 23. Urea 수지
  {
    id: "urea_resin",
    name: "Urea-Formaldehyde Resin",
    shortName: "Urea Resin",
    koreanName: "요소-포름알데히드 수지",
    aliases: ["urea", "요소수지"],
    category: "열경화성 수지 (Thermoset)",
    thermalCategory: "Thermoset (열경화성)",
    chainArchitecture: "3D Network Crosslinked",
    smiles: "O=C(N)N-CH2-",
    density: 1.45,
    tg: 160,
    formulaUnit: "—[CO—NH—CH₂—NH]ₙ—",
    formulaDisplay: "—[Urea—CH₂—Network]ₙ—",
    monomerMW: 72.07,
    description: "요소와 포름알데히드의 반응물로 무색투명 착색이 가능하며 목재 접착제로 널리 쓰입니다.",
    application: "MDF/합판 접착제, 단열 폼, 배선 기구",
    unitLength: 3.8,
    unitAtoms: [
      { name: "N1", element: "N", relPos: [0.0, 0.0, 0.0], isBackbone: true },
      { name: "C1", element: "C", relPos: [1.15, 0.65, 0.0], isBackbone: true },
      { name: "O1", element: "O", relPos: [1.15, 1.85, 0.0] },
      { name: "N2", element: "N", relPos: [2.30, 0.0, 0.0], isBackbone: true },
      { name: "C2", element: "C", relPos: [3.45, 0.65, 0.0], isBackbone: true },
    ],
    unitBonds: [
      { from: 0, to: 1, order: 1 }, { from: 1, to: 2, order: 2 },
      { from: 1, to: 3, order: 1 }, { from: 3, to: 4, order: 1 },
    ],
    connection: { headAtomIndex: 0, tailAtomIndex: 4, bondOrder: 1 },
  },

  // 24. Melamine 수지
  {
    id: "melamine_resin",
    name: "Melamine-Formaldehyde Resin",
    shortName: "Melamine Resin",
    koreanName: "멜라민 수지",
    aliases: ["melamine", "멜라민"],
    category: "열경화성 수지 (Thermoset)",
    thermalCategory: "Thermoset (열경화성)",
    chainArchitecture: "Triazine Ring Crosslinked Network",
    smiles: "c1(nc(nc(n1)N)N)N",
    density: 1.50,
    tg: 210,
    formulaUnit: "C3N3(NHCH2)3",
    formulaDisplay: "—[Triazine—CH₂—Network]ₙ—",
    monomerMW: 126.12,
    description: "트리아진 고리를 바탕으로 표면 경도와 내오염성이 극도로 우수한 열경화성 수지입니다.",
    application: "불침투 식기, 싱크대 데코타일 라미네이트 판넬, 마술스펀지(멜라민폼)",
    unitLength: 4.5,
    unitAtoms: [
      { name: "N1", element: "N", relPos: [0.0, 0.0, 0.0], isBackbone: true },
      { name: "C1", element: "C", relPos: [1.15, 0.65, 0.0], isBackbone: true },
      { name: "N2", element: "N", relPos: [2.30, 0.0, 0.0], isBackbone: true },
      { name: "C2", element: "C", relPos: [2.30, -1.30, 0.0] },
      { name: "N3", element: "N", relPos: [1.15, -1.95, 0.0] },
      { name: "C3", element: "C", relPos: [0.0, -1.30, 0.0] },
    ],
    unitBonds: [
      { from: 0, to: 1, order: 2 }, { from: 1, to: 2, order: 1 },
      { from: 2, to: 3, order: 2 }, { from: 3, to: 4, order: 1 },
      { from: 4, to: 5, order: 2 }, { from: 5, to: 0, order: 1 },
    ],
    connection: { headAtomIndex: 0, tailAtomIndex: 2, bondOrder: 1 },
  },

  // 25. Epoxy 수지
  {
    id: "epoxy",
    name: "Epoxy Resin (DGEBA)",
    shortName: "Epoxy",
    koreanName: "에폭시 수지",
    aliases: ["epoxy", "에폭시", "dgeba"],
    category: "열경화성 수지 (Thermoset)",
    thermalCategory: "Thermoset (열경화성)",
    chainArchitecture: "Crosslinked Network (비스페놀A-에피클로로히드린)",
    smiles: "C1OC1COC2=CC=C(C=C2)C(C)(C)C3=CC=C(OCC4CO4)C=C3",
    density: 1.20,
    tg: 140,
    formulaUnit: "C21H24O4",
    formulaDisplay: "—[Bisphenol A—Epichlorohydrin Network]ₙ—",
    monomerMW: 340.41,
    description: "접착력, 기계적 강도, 전기절연성이 극도로 우수하여 탄소섬유 복합재료의 바인더로 필수입니다.",
    application: "탄소섬유 항공기 복합소재, 반도체 봉지재(EMC), 바닥 코팅 에폭시",
    unitLength: 8.5,
    unitAtoms: [
      { name: "O1", element: "O", relPos: [0.0, 0.0, 0.0], isBackbone: true },
      { name: "C1", element: "C", relPos: [1.20, 0.65, 0.0], isBackbone: true },
      { name: "C2", element: "C", relPos: [2.40, 0.0, 0.0], isBackbone: true },
      { name: "O2", element: "O", relPos: [3.60, 0.65, 0.0], isBackbone: true },
      { name: "C3", element: "C", relPos: [4.80, 0.0, 0.0], isBackbone: true },
    ],
    unitBonds: [
      { from: 0, to: 1, order: 1 }, { from: 1, to: 2, order: 1 },
      { from: 2, to: 3, order: 1 }, { from: 3, to: 4, order: 1 },
    ],
    connection: { headAtomIndex: 0, tailAtomIndex: 4, bondOrder: 1 },
  },

  // 26. Unsaturated Polyester
  {
    id: "unsaturated_polyester",
    name: "Unsaturated Polyester Resin",
    shortName: "UP",
    koreanName: "불포화 폴리에스터 수지",
    aliases: ["up", "unsaturated polyester", "frp"],
    category: "열경화성 수지 (Thermoset)",
    thermalCategory: "Thermoset (열경화성)",
    chainArchitecture: "Crosslinked Network with Styrene",
    smiles: "O=C(C=CC(=O)OCC)OCC",
    density: 1.15,
    tg: 110,
    formulaUnit: "—[O—CO—CH=CH—CO—O—R]ₙ—",
    formulaDisplay: "—[Fumaric/Maleic—Glycol Network]ₙ—",
    monomerMW: 184.15,
    description: "불포화 이중결합을 지닌 폴리에스터 사슬에 스티렌 단량체를 가교 반응시켜 성형하는 FRP 수지입니다.",
    application: "유리섬유 강화 플라스틱(FRP) 선박 보트, 욕조, 물탱크",
    unitLength: 6.2,
    unitAtoms: [
      { name: "O1", element: "O", relPos: [0.0, 0.0, 0.0], isBackbone: true },
      { name: "C1", element: "C", relPos: [1.20, 0.65, 0.0], isBackbone: true },
      { name: "C2", element: "C", relPos: [2.40, 0.0, 0.0], isBackbone: true },
      { name: "C3", element: "C", relPos: [3.60, 0.65, 0.0], isBackbone: true },
      { name: "O2", element: "O", relPos: [4.80, 0.0, 0.0], isBackbone: true },
    ],
    unitBonds: [
      { from: 0, to: 1, order: 1 }, { from: 1, to: 2, order: 2 },
      { from: 2, to: 3, order: 1 }, { from: 3, to: 4, order: 1 },
    ],
    connection: { headAtomIndex: 0, tailAtomIndex: 4, bondOrder: 1 },
  },

  // ─── [D. 특수 구조 및 기능성 고분자 (Special Architectures)] ───
  // 27. Dendrimer
  {
    id: "dendrimer",
    name: "Dendrimer (PAMAM)",
    shortName: "Dendrimer",
    koreanName: "덴드리머 (수지상 구형 고분자)",
    aliases: ["dendrimer", "pamam", "덴드리머"],
    category: "특수 구조 (Special Architecture)",
    thermalCategory: "Special (특수 구조)",
    chainArchitecture: "Hyperbranched / Spherical (방사형 완전 규칙 가지)",
    smiles: "N(CCN(CC)CC)CCN...",
    density: 1.25,
    tg: 35,
    formulaUnit: "Generation-4 Globular",
    formulaDisplay: "—[Core]—(Branching Gen 1~5)—[Surface Groups]—",
    monomerMW: 14214.0,
    description: "중심 코어에서 나뭇가지 모양으로 정밀하게 뻗어나가는 단분산 구형 나노입자 고분자입니다.",
    application: "표적 지향성 약물 전달 시스템(DDS), 유전자 전달체, 나노 센서",
    unitLength: 4.5,
    unitAtoms: [
      { name: "N_core", element: "C", relPos: [0.0, 0.0, 0.0], isBackbone: true },
      { name: "C_br1", element: "C", relPos: [1.25, 0.85, 0.0], isBackbone: true },
      { name: "C_br2", element: "C", relPos: [-1.25, 0.85, 0.0] },
      { name: "C_br3", element: "C", relPos: [0.0, -1.35, 0.85] },
      { name: "N_gen1", element: "N", relPos: [2.35, 1.65, 0.0], isBackbone: true },
    ],
    unitBonds: [
      { from: 0, to: 1, order: 1 }, { from: 0, to: 2, order: 1 },
      { from: 0, to: 3, order: 1 }, { from: 1, to: 4, order: 1 },
    ],
    connection: { headAtomIndex: 0, tailAtomIndex: 4, bondOrder: 1 },
  },

  // 28. Polyrotaxane
  {
    id: "polyrotaxane",
    name: "Polyrotaxane",
    shortName: "Polyrotaxane",
    koreanName: "폴리로탁세인 (슬라이드 링 인터락)",
    aliases: ["polyrotaxane", "rotaxane", "폴리로탁세인", "슬라이드링"],
    category: "특수 구조 (Special Architecture)",
    thermalCategory: "Special (특수 구조)",
    chainArchitecture: "Mechanically Interlocked (도르래형 링 결합)",
    smiles: "[PEG axle] threading [alpha-CD rings] capped by [Adamantane]",
    density: 1.22,
    tg: -40,
    formulaUnit: "—[PEG Axle]·(Cyclodextrin)m—",
    formulaDisplay: "—[Axle Chain] ⊗ [Sliding Rings]—[End Caps]—",
    monomerMW: 3500.0,
    description: "선형 고분자 축에 고리형 분자가 꿰어져 도르래처럼 미끄러지는 분자 수준의 슬라이드-링 인터락 구조입니다.",
    application: "자가치유(Self-healing) 자동차 도장, 초고신축 탄성 젤",
    unitLength: 5.5,
    unitAtoms: [
      { name: "C1", element: "C", relPos: [0.0, 0.0, 0.0], isBackbone: true },
      { name: "O1", element: "O", relPos: [1.35, 0.0, 0.0], isBackbone: true },
      { name: "C2", element: "C", relPos: [2.70, 0.0, 0.0], isBackbone: true },
      { name: "C_ring1", element: "C", relPos: [1.35, 1.45, 0.85] },
      { name: "O_ring1", element: "O", relPos: [1.35, -1.45, 0.85] },
    ],
    unitBonds: [
      { from: 0, to: 1, order: 1 }, { from: 1, to: 2, order: 1 },
      { from: 3, to: 4, order: 1 },
    ],
    connection: { headAtomIndex: 0, tailAtomIndex: 2, bondOrder: 1 },
  },

  // 29. Polycatenane
  {
    id: "polycatenane",
    name: "Polycatenane",
    shortName: "Polycatenane",
    koreanName: "폴리카테네인 (사슬 고리 결합 고분자)",
    aliases: ["polycatenane", "catenane", "폴리카테네인"],
    category: "특수 구조 (Special Architecture)",
    thermalCategory: "Special (특수 구조)",
    chainArchitecture: "Topologically Interlocked Rings (공유결합 없는 위상학적 링 연결)",
    smiles: "[Macrocycle]-(interlocked)-[Macrocycle]",
    density: 1.18,
    tg: 60,
    formulaUnit: "—(Interlocked Macrocycles)ₙ—",
    formulaDisplay: "—[Ring 1] ∞ [Ring 2] ∞ [Ring 3]—",
    monomerMW: 1200.0,
    description: "공유결합 없이 닫힌 거대 고리들이 쇠사슬처럼 위상학적(Topological)으로 맞물린 인터락 고분자입니다.",
    application: "분자 기계, 에너지 분산형 신소재 충격 흡수재",
    unitLength: 4.8,
    unitAtoms: [
      { name: "C_r1", element: "C", relPos: [0.0, 1.10, 0.0], isBackbone: true },
      { name: "C_r2", element: "C", relPos: [1.20, 0.0, 0.0], isBackbone: true },
      { name: "C_r3", element: "C", relPos: [0.0, -1.10, 0.0], isBackbone: true },
      { name: "C_r4", element: "C", relPos: [2.20, 0.0, 0.95], isBackbone: true },
    ],
    unitBonds: [
      { from: 0, to: 1, order: 1 }, { from: 1, to: 2, order: 1 },
      { from: 2, to: 0, order: 1 }, { from: 1, to: 3, order: 1 },
    ],
    connection: { headAtomIndex: 0, tailAtomIndex: 3, bondOrder: 1 },
  },

  // 30. Conducting Polymers
  {
    id: "conducting_polymer",
    name: "Conducting Polymers (PEDOT / PANI)",
    shortName: "PEDOT / PANI",
    koreanName: "전도성 고분자 (PEDOT / 폴리아닐린)",
    aliases: ["pedot", "pani", "conducting", "전도성고분자", "polyacetylene"],
    category: "특수 구조 (Special Architecture)",
    thermalCategory: "Special (특수 구조)",
    chainArchitecture: "Conjugated Backbone (π-공액 공명 전도 사슬)",
    smiles: "c1sc2c1OCCO2",
    density: 1.35,
    tg: 150,
    formulaUnit: "C6H4O2S",
    formulaDisplay: "—[EDOT / Thiophene Conjugated Chain]ₙ—",
    monomerMW: 142.18,
    description: "π-전자 공액계(Conjugated) 백본을 통해 도핑 시 금속에 필적하는 높은 전기 전도도를 발현하는 기능성 고분자입니다.",
    application: "OLED 투명 전극, 정전기 방지 코팅, 플렉서블 바이오 센서",
    unitLength: 4.2,
    unitAtoms: [
      { name: "C1", element: "C", relPos: [0.0, 0.0, 0.0], isBackbone: true },
      { name: "C2", element: "C", relPos: [1.15, 0.65, 0.0], isBackbone: true },
      { name: "S1", element: "S", relPos: [1.15, -1.15, 0.0] },
      { name: "C3", element: "C", relPos: [2.30, 0.0, 0.0], isBackbone: true },
      { name: "O1", element: "O", relPos: [0.55, 1.75, 0.0] },
      { name: "O2", element: "O", relPos: [1.75, 1.75, 0.0] },
    ],
    unitBonds: [
      { from: 0, to: 1, order: 2 }, { from: 1, to: 3, order: 1 },
      { from: 3, to: 2, order: 1 }, { from: 2, to: 0, order: 1 },
      { from: 0, to: 4, order: 1 }, { from: 1, to: 5, order: 1 },
    ],
    connection: { headAtomIndex: 0, tailAtomIndex: 3, bondOrder: 1 },
  },
];

// 스마트 검색 함수: 약어, IUPAC명, 한글명, 원료명, SMILES 등 다차원 매칭
export function findPolymer(query: string): PolymerDefinition | null {
  if (!query || !query.trim()) return null;
  const q = query.trim().toLowerCase();

  // 1. 정확 일치 우선 (shortName, id, aliases, iupac, rawName)
  const exact = POLYMER_DATABASE.find(
    (p) =>
      p.shortName.toLowerCase() === q ||
      p.id.toLowerCase() === q ||
      p.name.toLowerCase() === q ||
      p.koreanName.toLowerCase() === q ||
      p.iupacName?.toLowerCase() === q ||
      p.rawName?.toLowerCase() === q ||
      p.aliases.some((a) => a.toLowerCase() === q)
  );
  if (exact) return exact;

  // 2. 부분 일치 검색
  const partial = POLYMER_DATABASE.find(
    (p) =>
      p.shortName.toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q) ||
      p.koreanName.toLowerCase().includes(q) ||
      p.iupacName?.toLowerCase().includes(q) ||
      p.rawName?.toLowerCase().includes(q) ||
      p.aliases.some((a) => a.toLowerCase().includes(q))
  );

  return partial || null;
}

// 3D 사슬 빌더
export function generatePolymerChain(
  polymer: PolymerDefinition,
  count: number,
  showHydrogen: boolean = true
): { atoms: RenderAtom[]; bonds: RenderBond[]; center: [number, number, number]; bounds: [number, number, number] } {
  const n = Math.max(1, Math.min(count, 50));
  const atoms: RenderAtom[] = [];
  const bonds: RenderBond[] = [];

  let minX = Infinity,
    maxX = -Infinity;
  let minY = Infinity,
    maxY = -Infinity;
  let minZ = Infinity,
    maxZ = -Infinity;

  const unitLength = polymer.unitLength || 3.0;

  for (let unitIdx = 0; unitIdx < n; unitIdx++) {
    const xOffset = unitIdx * unitLength;
    const unitAtomMap: string[] = [];

    // 원자 배치
    polymer.unitAtoms.forEach((atomDef, atomLocalIdx) => {
      if (!showHydrogen && atomDef.element === "H") return;

      const atomId = `u${unitIdx}_a${atomLocalIdx}`;
      unitAtomMap[atomLocalIdx] = atomId;

      const posX = atomDef.relPos[0] + xOffset;
      const posY = atomDef.relPos[1];
      const posZ = atomDef.relPos[2];

      minX = Math.min(minX, posX);
      maxX = Math.max(maxX, posX);
      minY = Math.min(minY, posY);
      maxY = Math.max(maxY, posY);
      minZ = Math.min(minZ, posZ);
      maxZ = Math.max(maxZ, posZ);

      const prop = ELEMENT_PROPERTIES[atomDef.element] || ELEMENT_PROPERTIES.C;

      atoms.push({
        id: atomId,
        element: atomDef.element,
        name: `${atomDef.name} (#${unitIdx + 1})`,
        position: [posX, posY, posZ],
        unitIndex: unitIdx,
        isBackbone: !!atomDef.isBackbone,
        color: prop.color,
        radius: prop.radius,
      });
    });

    // 단위체 내부 결합
    polymer.unitBonds.forEach((bDef, bIdx) => {
      const atomAId = unitAtomMap[bDef.from];
      const atomBId = unitAtomMap[bDef.to];

      if (!atomAId || !atomBId) return;

      const atomA = atoms.find((a) => a.id === atomAId);
      const atomB = atoms.find((a) => a.id === atomBId);
      if (!atomA || !atomB) return;

      bonds.push({
        id: `u${unitIdx}_b${bIdx}`,
        atomAId,
        atomBId,
        posA: atomA.position,
        posB: atomB.position,
        order: bDef.order,
        isInterUnit: false,
        color: "#64748b",
      });
    });

    // 단위체 간 연결 결합
    if (unitIdx < n - 1 && polymer.connection) {
      const tailLocalIdx = polymer.connection.tailAtomIndex;
      const headLocalIdx = polymer.connection.headAtomIndex;

      if (polymer.unitAtoms[tailLocalIdx] && polymer.unitAtoms[headLocalIdx]) {
        const curTailPos: [number, number, number] = [
          polymer.unitAtoms[tailLocalIdx].relPos[0] + xOffset,
          polymer.unitAtoms[tailLocalIdx].relPos[1],
          polymer.unitAtoms[tailLocalIdx].relPos[2],
        ];

        const nextHeadPos: [number, number, number] = [
          polymer.unitAtoms[headLocalIdx].relPos[0] + (unitIdx + 1) * unitLength,
          polymer.unitAtoms[headLocalIdx].relPos[1],
          polymer.unitAtoms[headLocalIdx].relPos[2],
        ];

        bonds.push({
          id: `inter_u${unitIdx}_u${unitIdx + 1}`,
          atomAId: `u${unitIdx}_a${tailLocalIdx}`,
          atomBId: `u${unitIdx + 1}_a${headLocalIdx}`,
          posA: curTailPos,
          posB: nextHeadPos,
          order: polymer.connection.bondOrder,
          isInterUnit: true,
          color: "#38bdf8",
        });
      }
    }
  }

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const centerZ = (minZ + maxZ) / 2;

  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const spanZ = Math.max(1, maxZ - minZ);

  return {
    atoms,
    bonds,
    center: [centerX, centerY, centerZ],
    bounds: [spanX, spanY, spanZ],
  };
}

// 거대 고분자 사슬 3D 경로 생성기
export function generateMacroCoilPoints(
  totalUnits: number,
  crystallinity: number
): [number, number, number][] {
  const points: [number, number, number][] = [];
  const numSegments = Math.min(600, Math.max(80, Math.round(Math.sqrt(totalUnits) * 6)));

  const isCrystalline = crystallinity > 0.45;
  const foldPeriod = Math.max(12, Math.round(28 * (1 - crystallinity * 0.5)));

  let currX = 0;
  let currY = 0;
  let currZ = 0;

  let seed = 42;
  const pseudoRand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  const stepSize = 1.2;

  for (let i = 0; i < numSegments; i++) {
    points.push([currX, currY, currZ]);

    if (isCrystalline && i % foldPeriod < foldPeriod * 0.75) {
      const foldDirection = Math.floor(i / foldPeriod) % 2 === 0 ? 1 : -1;
      currY += stepSize * foldDirection;
      currX += (pseudoRand() - 0.5) * 0.3;
      currZ += (pseudoRand() - 0.5) * 0.3;
    } else {
      const theta = pseudoRand() * Math.PI * 2;
      const phi = (pseudoRand() - 0.5) * Math.PI;
      currX += stepSize * Math.cos(theta) * Math.cos(phi);
      currY += stepSize * Math.sin(phi);
      currZ += stepSize * Math.sin(theta) * Math.cos(phi);
    }
  }

  return points;
}
