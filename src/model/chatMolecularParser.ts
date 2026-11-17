import type { AtomNode, BondEdge, AtomSymbol } from "../components/MolDrawCanvas";
import { calculateMolecularDescriptor, type MolecularDescriptor } from "./molecularDescriptor";
import { validateMolecularStructure, type MolecularValidationResult } from "./molecularValidation";
import { CORE_CHEMICAL_PRESETS } from "./moldrawPresets";

export type ChatActionType =
  | "create"
  | "modify_length"
  | "modify_angle"
  | "functional_group"
  | "optimize"
  | "query"
  | "general"
  | "chat";

/**
 * 자연어에서 분해된 고분자 세부 복합 파라미터 (분자량, 공중합 방식, 말단기, 물성 요구사항)
 */
export interface PolymerComplexParameters {
  molecularWeight?: number; // 목표 분자량 (예: 45000 g/mol)
  polymerizationDegree?: number; // 중합도 (DP = MW / monomerMW)
  copolymerType?: "homo" | "block" | "random" | "alternating" | "graft"; // 공중합 방식
  terminalGroup?: "OH" | "COOH" | "NH2" | "CH3" | "F" | "Cl" | "none"; // 말단 작용기
  comonomers?: string[]; // 구성 단량체 (예: ["benzene", "ether"], ["pet", "nylon"])
  targetProperties?: {
    tg?: number; // 목표 유리전이온도 (°C)
    tenacity?: number; // 목표 인장강도 (g/d)
    modulus?: number; // 목표 탄성률 (g/d)
    elongation?: number; // 목표 파단신율 (%)
  };
  predictedProperties?: {
    tg: number;
    tenacity: number;
    modulus: number;
    elongation: number;
    thermalIndex: number;
    targetMatchScore?: number; // 목표 요구사항 대비 만족도 (%)
  };
}

export interface ParsedCopolymerJSON {
  structure_type: "graft" | "block" | "random" | "alternating";
  components: string[];
  architecture: string;
}

export interface PolymerComponentMeta {
  id: string;
  canonical: string;
  koreanName: string;
  shortName: string;
  color: string;
  dp?: number;
}

export interface ParsedCopolymerStructure extends ParsedCopolymerJSON {
  connectors: Array<"graft" | "block" | "random" | "alternating">;
  componentDetails: PolymerComponentMeta[];
  rawFormula: string;
  systemMessage: string;
  jsonString: string;
}

export interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: string;
  actionType?: ChatActionType;
  actionBadge?: string;
  parameters?: {
    bondLength?: number;
    angle?: number;
    group?: string;
    polymerType?: string;
    targetBond?: string;
    molecularWeight?: number;
    copolymerType?: string;
    terminalGroup?: string;
    dp?: number;
  };
  complexParams?: PolymerComplexParameters;
  parsedCopolymer?: ParsedCopolymerStructure;
  metricsDelta?: {
    mw?: number;
    deltaMw?: number;
    strainEnergy?: number;
    deltaStrain?: number;
    grade?: "S" | "A" | "B" | "C";
    score?: number;
    avgBondLength?: number;
    bondAngle?: number;
    tenacity?: number;
    tg?: number;
    modulus?: number;
    elongation?: number;
    dp?: number;
    targetMatchScore?: number;
  };
  suggestedFollowUps?: string[];
  highlightAtomIds?: string[];
  highlightBondIds?: string[];
}

export interface ParseResult {
  message: ChatMessage;
  atoms: AtomNode[];
  bonds: BondEdge[];
  descriptor: MolecularDescriptor;
  validation: MolecularValidationResult;
  overallScore: number;
  grade: "S" | "A" | "B" | "C";
  strainEnergyKcal: number;
  avgBondLengthAngstrom: number;
  complexParams?: PolymerComplexParameters;
  parsedCopolymer?: ParsedCopolymerStructure;
}

// 픽셀 / 스케일 환산 계수 (55px = 1.50 Å -> 1.0 Å = 36.67 px)
export const ANGSTROM_TO_PX = 36.67;
export const PX_TO_ANGSTROM = 1.0 / ANGSTROM_TO_PX;

/**
 * 2D 프리셋 화합물을 3D 좌표계를 가진 AtomNode/BondEdge로 변환하는 헬퍼
 */
function presetTo3D(presetId: string): { atoms: AtomNode[]; bonds: BondEdge[] } | null {
  const p = CORE_CHEMICAL_PRESETS.find((item) => item.id === presetId);
  if (!p) return null;

  const atoms: AtomNode[] = p.atoms.map((a, idx) => ({
    id: a.id,
    symbol: a.symbol,
    x: a.x,
    y: a.y,
    z: (idx % 2 === 0 ? 14 : -14),
  }));

  const bonds: BondEdge[] = p.bonds.map((b) => ({
    id: b.id,
    sourceId: b.sourceId,
    targetId: b.targetId,
    type: b.type,
  }));

  return { atoms, bonds };
}

/**
 * 1. 벤젠 고리 + 유연한 고분자 사슬 (Aromatic-Aliphatic Hybrid) 3D 구조 생성
 */
export function generateBenzeneFlexibleChain(): { atoms: AtomNode[]; bonds: BondEdge[] } {
  const atoms: AtomNode[] = [];
  const bonds: BondEdge[] = [];

  const benzeneR = 1.40 * ANGSTROM_TO_PX; // ~51.3 px
  const centerX = 160;
  const centerY = 200;

  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    const x = centerX + benzeneR * Math.cos(angle);
    const y = centerY + benzeneR * Math.sin(angle);
    const z = (i % 2 === 0 ? 6 : -6);

    atoms.push({
      id: `c_ring_${i}`,
      symbol: "C",
      x: Math.round(x),
      y: Math.round(y),
      z: Math.round(z),
    });
  }

  for (let i = 0; i < 6; i++) {
    const next = (i + 1) % 6;
    bonds.push({
      id: `b_ring_${i}`,
      sourceId: `c_ring_${i}`,
      targetId: `c_ring_${next}`,
      type: i % 2 === 0 ? "double" : "single",
    });
  }

  const chDist = 1.09 * ANGSTROM_TO_PX;
  for (let i = 1; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    const x = centerX + (benzeneR + chDist) * Math.cos(angle);
    const y = centerY + (benzeneR + chDist) * Math.sin(angle);
    const z = (i % 2 === 0 ? 10 : -10);

    atoms.push({
      id: `h_ring_${i}`,
      symbol: "H",
      x: Math.round(x),
      y: Math.round(y),
      z: Math.round(z),
    });
    bonds.push({
      id: `b_ring_h_${i}`,
      sourceId: `c_ring_${i}`,
      targetId: `h_ring_${i}`,
      type: "single",
    });
  }

  const chainDefs: Array<{ symbol: AtomSymbol; bondLenAng: number; dy: number; dz: number }> = [
    { symbol: "O", bondLenAng: 1.43, dy: 14, dz: 12 },
    { symbol: "C", bondLenAng: 1.54, dy: -28, dz: -14 },
    { symbol: "C", bondLenAng: 1.54, dy: 30, dz: 16 },
    { symbol: "O", bondLenAng: 1.43, dy: -22, dz: -10 },
    { symbol: "C", bondLenAng: 1.54, dy: 28, dz: 18 },
    { symbol: "C", bondLenAng: 1.54, dy: -26, dz: -16 },
    { symbol: "O", bondLenAng: 1.43, dy: 24, dz: 12 },
    { symbol: "H", bondLenAng: 0.98, dy: -18, dz: -10 },
  ];

  let prevId = "c_ring_0";
  let curX = atoms[0].x;
  let curY = atoms[0].y;
  let curZ = atoms[0].z || 0;

  chainDefs.forEach((def, idx) => {
    const chainId = `chain_${idx}_${def.symbol.toLowerCase()}`;
    const dx = def.bondLenAng * ANGSTROM_TO_PX * 0.85;
    curX += dx;
    curY += def.dy;
    curZ += def.dz;

    atoms.push({
      id: chainId,
      symbol: def.symbol,
      x: Math.round(curX),
      y: Math.round(curY),
      z: Math.round(curZ),
    });

    bonds.push({
      id: `b_chain_${idx}`,
      sourceId: prevId,
      targetId: chainId,
      type: "single",
    });

    if (def.symbol === "C") {
      const h1Id = `${chainId}_h1`;
      const h2Id = `${chainId}_h2`;
      atoms.push({
        id: h1Id,
        symbol: "H",
        x: Math.round(curX - 4),
        y: Math.round(curY + 28),
        z: Math.round(curZ + 30),
      });
      atoms.push({
        id: h2Id,
        symbol: "H",
        x: Math.round(curX + 6),
        y: Math.round(curY - 28),
        z: Math.round(curZ - 30),
      });
      bonds.push(
        { id: `b_${h1Id}`, sourceId: chainId, targetId: h1Id, type: "single" },
        { id: `b_${h2Id}`, sourceId: chainId, targetId: h2Id, type: "single" }
      );
    }

    prevId = chainId;
  });

  return { atoms, bonds };
}

/**
 * 2. 순수 벤젠 분자 3D 구조 (C6H6)
 */
export function generatePureBenzene(): { atoms: AtomNode[]; bonds: BondEdge[] } {
  const atoms: AtomNode[] = [];
  const bonds: BondEdge[] = [];
  const r = 1.40 * ANGSTROM_TO_PX;
  const rh = (1.40 + 1.09) * ANGSTROM_TO_PX;
  const cX = 220;
  const cY = 200;

  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i;
    atoms.push({
      id: `b_c_${i}`,
      symbol: "C",
      x: Math.round(cX + r * Math.cos(a)),
      y: Math.round(cY + r * Math.sin(a)),
      z: (i % 2 === 0 ? 3 : -3),
    });
    atoms.push({
      id: `b_h_${i}`,
      symbol: "H",
      x: Math.round(cX + rh * Math.cos(a)),
      y: Math.round(cY + rh * Math.sin(a)),
      z: (i % 2 === 0 ? 5 : -5),
    });
    const next = (i + 1) % 6;
    bonds.push({
      id: `b_bond_${i}`,
      sourceId: `b_c_${i}`,
      targetId: `b_c_${next}`,
      type: i % 2 === 0 ? "double" : "single",
    });
    bonds.push({
      id: `b_h_bond_${i}`,
      sourceId: `b_c_${i}`,
      targetId: `b_h_${i}`,
      type: "single",
    });
  }
  return { atoms, bonds };
}

/**
 * 3. 고강도 아라미드(Kevlar) 유사 방향족 폴리아미드 구조 생성
 */
export function generateAramidChain(): { atoms: AtomNode[]; bonds: BondEdge[] } {
  const atoms: AtomNode[] = [];
  const bonds: BondEdge[] = [];
  const r = 1.40 * ANGSTROM_TO_PX;
  const c1X = 140;
  const c1Y = 200;

  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i;
    atoms.push({
      id: `ar1_${i}`,
      symbol: "C",
      x: Math.round(c1X + r * Math.cos(a)),
      y: Math.round(c1Y + r * Math.sin(a)),
      z: (i % 2 === 0 ? 3 : -3),
    });
    const next = (i + 1) % 6;
    bonds.push({
      id: `b_ar1_${i}`,
      sourceId: `ar1_${i}`,
      targetId: `ar1_${next}`,
      type: i % 2 === 0 ? "double" : "single",
    });
  }

  const carbX = c1X + r + 1.50 * ANGSTROM_TO_PX;
  atoms.push({ id: "aramid_c_carb", symbol: "C", x: Math.round(carbX), y: c1Y, z: 0 });
  bonds.push({ id: "b_ar_carb", sourceId: "ar1_0", targetId: "aramid_c_carb", type: "single" });

  atoms.push({ id: "aramid_o_carb", symbol: "O", x: Math.round(carbX), y: c1Y - 48, z: 12 });
  bonds.push({ id: "b_ar_ox", sourceId: "aramid_c_carb", targetId: "aramid_o_carb", type: "double" });

  const nitX = carbX + 1.36 * ANGSTROM_TO_PX;
  atoms.push({ id: "aramid_n_amide", symbol: "N", x: Math.round(nitX), y: c1Y + 16, z: -8 });
  bonds.push({ id: "b_carb_nit", sourceId: "aramid_c_carb", targetId: "aramid_n_amide", type: "single" });

  atoms.push({ id: "aramid_h_amide", symbol: "H", x: Math.round(nitX + 10), y: c1Y + 54, z: -16 });
  bonds.push({ id: "b_nit_h", sourceId: "aramid_n_amide", targetId: "aramid_h_amide", type: "single" });

  const c2X = nitX + 1.42 * ANGSTROM_TO_PX + r;
  const c2Y = c1Y;
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i;
    atoms.push({
      id: `ar2_${i}`,
      symbol: "C",
      x: Math.round(c2X + r * Math.cos(a)),
      y: Math.round(c2Y + r * Math.sin(a)),
      z: (i % 2 === 0 ? -3 : 3),
    });
    const next = (i + 1) % 6;
    bonds.push({
      id: `b_ar2_${i}`,
      sourceId: `ar2_${i}`,
      targetId: `ar2_${next}`,
      type: i % 2 === 0 ? "double" : "single",
    });
  }
  bonds.push({ id: "b_nit_ar2", sourceId: "aramid_n_amide", targetId: "ar2_3", type: "single" });

  return { atoms, bonds };
}

/**
 * 4. 나일론-6,6 (Nylon 6,6) 폴리아미드 3D 사슬 생성
 */
export function generateNylonChain(): { atoms: AtomNode[]; bonds: BondEdge[] } {
  const atoms: AtomNode[] = [];
  const bonds: BondEdge[] = [];
  const startX = 80;
  const startY = 200;

  // 아디프산 세그먼트 -[C(=O)-(CH2)4-C(=O)-NH-(CH2)6-NH]-
  const chain: Array<{ s: AtomSymbol; dy: number; dz: number; doubleO?: boolean }> = [
    { s: "C", dy: 0, dz: 0, doubleO: true },
    { s: "C", dy: 22, dz: 14 },
    { s: "C", dy: -22, dz: -14 },
    { s: "C", dy: 22, dz: 14 },
    { s: "C", dy: -22, dz: -14 },
    { s: "C", dy: 0, dz: 0, doubleO: true },
    { s: "N", dy: 16, dz: 10 },
    { s: "C", dy: -20, dz: -12 },
    { s: "C", dy: 22, dz: 14 },
    { s: "C", dy: -22, dz: -14 },
    { s: "C", dy: 22, dz: 14 },
    { s: "N", dy: -16, dz: -10 },
  ];

  let curX = startX;
  let prevId = "";

  chain.forEach((node, idx) => {
    const id = `ny_${idx}_${node.s.toLowerCase()}`;
    curX += 38;
    atoms.push({
      id,
      symbol: node.s,
      x: Math.round(curX),
      y: Math.round(startY + node.dy),
      z: Math.round(node.dz),
    });

    if (prevId) {
      bonds.push({
        id: `b_ny_${idx}`,
        sourceId: prevId,
        targetId: id,
        type: "single",
      });
    }

    if (node.doubleO) {
      const oId = `${id}_ox`;
      atoms.push({
        id: oId,
        symbol: "O",
        x: Math.round(curX),
        y: Math.round(startY + node.dy - 46),
        z: 16,
      });
      bonds.push({
        id: `b_${oId}`,
        sourceId: id,
        targetId: oId,
        type: "double",
      });
    }

    if (node.s === "N") {
      const hId = `${id}_h`;
      atoms.push({
        id: hId,
        symbol: "H",
        x: Math.round(curX + 6),
        y: Math.round(startY + node.dy + 38),
        z: -14,
      });
      bonds.push({
        id: `b_${hId}`,
        sourceId: id,
        targetId: hId,
        type: "single",
      });
    }

    prevId = id;
  });

  return { atoms, bonds };
}

/**
 * 5. 폴리에스터 / PET (Polyethylene terephthalate) 3D 구조 생성
 */
export function generatePETChain(): { atoms: AtomNode[]; bonds: BondEdge[] } {
  const atoms: AtomNode[] = [];
  const bonds: BondEdge[] = [];
  const r = 1.40 * ANGSTROM_TO_PX;
  const cX = 180;
  const cY = 200;

  // 중앙 벤젠 고리
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i;
    atoms.push({
      id: `pet_ring_${i}`,
      symbol: "C",
      x: Math.round(cX + r * Math.cos(a)),
      y: Math.round(cY + r * Math.sin(a)),
      z: (i % 2 === 0 ? 3 : -3),
    });
    const next = (i + 1) % 6;
    bonds.push({
      id: `b_pet_r_${i}`,
      sourceId: `pet_ring_${i}`,
      targetId: `pet_ring_${next}`,
      type: i % 2 === 0 ? "double" : "single",
    });
  }

  // 우측 에스테르기: -C(=O)O-CH2-CH2-O-
  const c1X = cX + r + 45;
  atoms.push({ id: "pet_c_est1", symbol: "C", x: Math.round(c1X), y: cY, z: 0 });
  bonds.push({ id: "b_pet_c1", sourceId: "pet_ring_0", targetId: "pet_c_est1", type: "single" });

  atoms.push({ id: "pet_o_dbl1", symbol: "O", x: Math.round(c1X), y: cY - 46, z: 12 });
  bonds.push({ id: "b_pet_o_d1", sourceId: "pet_c_est1", targetId: "pet_o_dbl1", type: "double" });

  const o1X = c1X + 42;
  atoms.push({ id: "pet_o_est1", symbol: "O", x: Math.round(o1X), y: cY + 14, z: -8 });
  bonds.push({ id: "b_pet_o1", sourceId: "pet_c_est1", targetId: "pet_o_est1", type: "single" });

  // 에틸렌 글리콜 부분 (-CH2-CH2-OH)
  const eg1X = o1X + 44;
  atoms.push({ id: "pet_eg_c1", symbol: "C", x: Math.round(eg1X), y: cY - 16, z: 14 });
  bonds.push({ id: "b_pet_eg1", sourceId: "pet_o_est1", targetId: "pet_eg_c1", type: "single" });

  const eg2X = eg1X + 44;
  atoms.push({ id: "pet_eg_c2", symbol: "C", x: Math.round(eg2X), y: cY + 16, z: -14 });
  bonds.push({ id: "b_pet_eg2", sourceId: "pet_eg_c1", targetId: "pet_eg_c2", type: "single" });

  const termOX = eg2X + 42;
  atoms.push({ id: "pet_term_o", symbol: "O", x: Math.round(termOX), y: cY - 14, z: 10 });
  bonds.push({ id: "b_pet_term_o", sourceId: "pet_eg_c2", targetId: "pet_term_o", type: "single" });

  atoms.push({ id: "pet_term_h", symbol: "H", x: Math.round(termOX + 24), y: cY - 32, z: 14 });
  bonds.push({ id: "b_pet_term_h", sourceId: "pet_term_o", targetId: "pet_term_h", type: "single" });

  return { atoms, bonds };
}

/**
 * 6. 선형 폴리에틸렌 (PE) 3D 사슬
 */
export function generatePolyethyleneChain(length: number = 8): { atoms: AtomNode[]; bonds: BondEdge[] } {
  const atoms: AtomNode[] = [];
  const bonds: BondEdge[] = [];
  const startX = 120;
  const startY = 200;

  for (let i = 0; i < length; i++) {
    const x = startX + i * 44;
    const y = startY + (i % 2 === 0 ? -24 : 24);
    const z = (i % 2 === 0 ? 14 : -14);
    const cId = `pe_c_${i}`;
    atoms.push({ id: cId, symbol: "C", x, y, z });

    if (i > 0) {
      bonds.push({
        id: `pe_b_${i}`,
        sourceId: `pe_c_${i - 1}`,
        targetId: cId,
        type: "single",
      });
    }

    const h1Id = `${cId}_h1`;
    const h2Id = `${cId}_h2`;
    atoms.push(
      { id: h1Id, symbol: "H", x: x - 4, y: y + (i % 2 === 0 ? 34 : -34), z: z + 28 },
      { id: h2Id, symbol: "H", x: x + 6, y: y + (i % 2 === 0 ? 34 : -34), z: z - 28 }
    );
    bonds.push(
      { id: `b_${h1Id}`, sourceId: cId, targetId: h1Id, type: "single" },
      { id: `b_${h2Id}`, sourceId: cId, targetId: h2Id, type: "single" }
    );
  }

  return { atoms, bonds };
}

/**
 * 7. 폴리우레탄 (Polyurethane) 3D 사슬
 */
export function generatePolyurethaneChain(): { atoms: AtomNode[]; bonds: BondEdge[] } {
  const atoms: AtomNode[] = [];
  const bonds: BondEdge[] = [];
  const startX = 100;
  const startY = 200;

  // 우레탄 결합: -O-C(=O)-NH-CH2-CH2-
  const defs: Array<{ s: AtomSymbol; dy: number; dz: number; doubleO?: boolean; nh?: boolean }> = [
    { s: "O", dy: 0, dz: 0 },
    { s: "C", dy: 24, dz: 12, doubleO: true },
    { s: "N", dy: -20, dz: -10, nh: true },
    { s: "C", dy: 26, dz: 16 },
    { s: "C", dy: -24, dz: -14 },
    { s: "O", dy: 20, dz: 10 },
    { s: "C", dy: -22, dz: -12, doubleO: true },
    { s: "N", dy: 24, dz: 14, nh: true },
  ];

  let curX = startX;
  let prevId = "";

  defs.forEach((d, idx) => {
    const id = `pu_${idx}_${d.s.toLowerCase()}`;
    curX += 42;
    atoms.push({ id, symbol: d.s, x: Math.round(curX), y: Math.round(startY + d.dy), z: Math.round(d.dz) });

    if (prevId) {
      bonds.push({ id: `b_pu_${idx}`, sourceId: prevId, targetId: id, type: "single" });
    }

    if (d.doubleO) {
      const oId = `${id}_ox`;
      atoms.push({ id: oId, symbol: "O", x: Math.round(curX), y: Math.round(startY + d.dy - 48), z: 14 });
      bonds.push({ id: `b_${oId}`, sourceId: id, targetId: oId, type: "double" });
    }

    if (d.nh) {
      const hId = `${id}_h`;
      atoms.push({ id: hId, symbol: "H", x: Math.round(curX + 6), y: Math.round(startY + d.dy + 36), z: -16 });
      bonds.push({ id: `b_${hId}`, sourceId: id, targetId: hId, type: "single" });
    }

    prevId = id;
  });

  return { atoms, bonds };
}

/**
 * 7-B. 3D 고분자 사슬의 양 말단(Head & Tail)에 요청된 기능성 작용기를 공유결합 부착
 */
export function attachTerminalCap(
  atoms: AtomNode[],
  bonds: BondEdge[],
  group?: "OH" | "COOH" | "NH2" | "CH3" | "F" | "Cl" | "none"
): { atoms: AtomNode[]; bonds: BondEdge[] } {
  if (!group || group === "none" || atoms.length === 0) return { atoms, bonds };

  const newAtoms = atoms.map((a) => ({ ...a }));
  const newBonds = bonds.map((b) => ({ ...b }));

  // 가장 좌측(head) 및 가장 우측(tail) 원자 탐색
  let head = newAtoms[0];
  let tail = newAtoms[0];
  newAtoms.forEach((a) => {
    if (a.x < head.x) head = a;
    if (a.x > tail.x) tail = a;
  });

  const attachAt = (anchor: AtomNode, isTail: boolean) => {
    const dir = isTail ? 1 : -1;
    const prefix = isTail ? "term_tail" : "term_head";
    const x0 = anchor.x + dir * 44;
    const y0 = anchor.y;
    const z0 = (anchor.z || 0) + (isTail ? 8 : -8);

    switch (group) {
      case "OH": {
        const oId = `${prefix}_o`;
        const hId = `${prefix}_h`;
        newAtoms.push({ id: oId, symbol: "O", x: Math.round(x0), y: Math.round(y0), z: Math.round(z0) });
        newBonds.push({ id: `b_${oId}`, sourceId: anchor.id, targetId: oId, type: "single" });
        newAtoms.push({ id: hId, symbol: "H", x: Math.round(x0 + dir * 28), y: Math.round(y0 + 20), z: Math.round(z0 + 10) });
        newBonds.push({ id: `b_${hId}`, sourceId: oId, targetId: hId, type: "single" });
        break;
      }
      case "COOH": {
        const cId = `${prefix}_c`;
        const oDbl = `${prefix}_ox`;
        const oSing = `${prefix}_oh_o`;
        const hId = `${prefix}_oh_h`;
        newAtoms.push({ id: cId, symbol: "C", x: Math.round(x0), y: Math.round(y0), z: Math.round(z0) });
        newBonds.push({ id: `b_${cId}`, sourceId: anchor.id, targetId: cId, type: "single" });
        newAtoms.push({ id: oDbl, symbol: "O", x: Math.round(x0 + dir * 8), y: Math.round(y0 - 42), z: Math.round(z0 + 16) });
        newBonds.push({ id: `b_${oDbl}`, sourceId: cId, targetId: oDbl, type: "double" });
        newAtoms.push({ id: oSing, symbol: "O", x: Math.round(x0 + dir * 36), y: Math.round(y0 + 14), z: Math.round(z0 - 12) });
        newBonds.push({ id: `b_${oSing}`, sourceId: cId, targetId: oSing, type: "single" });
        newAtoms.push({ id: hId, symbol: "H", x: Math.round(x0 + dir * 56), y: Math.round(y0 + 32), z: Math.round(z0 - 6) });
        newBonds.push({ id: `b_${hId}`, sourceId: oSing, targetId: hId, type: "single" });
        break;
      }
      case "NH2": {
        const nId = `${prefix}_n`;
        const h1 = `${prefix}_nh_1`;
        const h2 = `${prefix}_nh_2`;
        newAtoms.push({ id: nId, symbol: "N", x: Math.round(x0), y: Math.round(y0), z: Math.round(z0) });
        newBonds.push({ id: `b_${nId}`, sourceId: anchor.id, targetId: nId, type: "single" });
        newAtoms.push({ id: h1, symbol: "H", x: Math.round(x0 + dir * 26), y: Math.round(y0 - 24), z: Math.round(z0 + 14) });
        newBonds.push({ id: `b_${h1}`, sourceId: nId, targetId: h1, type: "single" });
        newAtoms.push({ id: h2, symbol: "H", x: Math.round(x0 + dir * 26), y: Math.round(y0 + 24), z: Math.round(z0 - 14) });
        newBonds.push({ id: `b_${h2}`, sourceId: nId, targetId: h2, type: "single" });
        break;
      }
      case "F": {
        const fId = `${prefix}_f`;
        newAtoms.push({ id: fId, symbol: "F", x: Math.round(x0), y: Math.round(y0), z: Math.round(z0) });
        newBonds.push({ id: `b_${fId}`, sourceId: anchor.id, targetId: fId, type: "single" });
        break;
      }
      case "Cl": {
        const clId = `${prefix}_cl`;
        newAtoms.push({ id: clId, symbol: "Cl", x: Math.round(x0), y: Math.round(y0), z: Math.round(z0) });
        newBonds.push({ id: `b_${clId}`, sourceId: anchor.id, targetId: clId, type: "single" });
        break;
      }
      case "CH3": {
        const cId = `${prefix}_ch3_c`;
        newAtoms.push({ id: cId, symbol: "C", x: Math.round(x0), y: Math.round(y0), z: Math.round(z0) });
        newBonds.push({ id: `b_${cId}`, sourceId: anchor.id, targetId: cId, type: "single" });
        break;
      }
    }
  };

  attachAt(head, false);
  attachAt(tail, true);

  return { atoms: newAtoms, bonds: newBonds };
}

/**
 * 7-C. 블록 공중합체 (Block Copolymer: 강직한 방향족 하드 세그먼트 + 유연한 폴리에테르 소프트 세그먼트)
 */
export function generateBlockCopolymer(
  terminalGroup?: "OH" | "COOH" | "NH2" | "CH3" | "F" | "Cl" | "none",
  blocks: number = 2
): { atoms: AtomNode[]; bonds: BondEdge[] } {
  const atoms: AtomNode[] = [];
  const bonds: BondEdge[] = [];

  const startX = 70;
  const cY = 200;
  let curX = startX;
  let prevTailId = "";

  for (let b = 0; b < blocks; b++) {
    // 1) Hard Block: 방향족 벤젠 코어
    const r = 1.40 * ANGSTROM_TO_PX * 0.9;
    const ringCenterX = curX + 50;
    const ringNodes: string[] = [];

    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i;
      const x = ringCenterX + r * Math.cos(angle);
      const y = cY + r * Math.sin(angle);
      const z = i % 2 === 0 ? 4 : -4;
      const id = `blk_${b}_ring_${i}`;
      ringNodes.push(id);
      atoms.push({ id, symbol: "C", x: Math.round(x), y: Math.round(y), z: Math.round(z) });
    }

    for (let i = 0; i < 6; i++) {
      const next = (i + 1) % 6;
      bonds.push({
        id: `b_blk_${b}_r_${i}`,
        sourceId: ringNodes[i],
        targetId: ringNodes[next],
        type: i % 2 === 0 ? "double" : "single",
      });
    }

    if (prevTailId) {
      bonds.push({ id: `b_bridge_${b}`, sourceId: prevTailId, targetId: ringNodes[3], type: "single" });
    }

    // 아미드 링커 (-CO-NH-)
    const cAmideX = ringCenterX + r + 36;
    const cAmideId = `blk_${b}_co`;
    atoms.push({ id: cAmideId, symbol: "C", x: Math.round(cAmideX), y: cY, z: 0 });
    bonds.push({ id: `b_blk_${b}_c_am`, sourceId: ringNodes[0], targetId: cAmideId, type: "single" });

    const oAmideId = `blk_${b}_ox`;
    atoms.push({ id: oAmideId, symbol: "O", x: Math.round(cAmideX), y: cY - 42, z: 12 });
    bonds.push({ id: `b_blk_${b}_o_am`, sourceId: cAmideId, targetId: oAmideId, type: "double" });

    const nAmideX = cAmideX + 38;
    const nAmideId = `blk_${b}_nh`;
    atoms.push({ id: nAmideId, symbol: "N", x: Math.round(nAmideX), y: cY + 12, z: -8 });
    bonds.push({ id: `b_blk_${b}_n_am`, sourceId: cAmideId, targetId: nAmideId, type: "single" });

    // 2) Soft Block: 유연한 옥시에틸렌/지방족 에테르 사슬
    const softDefs = [
      { s: "C" as AtomSymbol, dy: -24, dz: 12 },
      { s: "C" as AtomSymbol, dy: 24, dz: -14 },
      { s: "O" as AtomSymbol, dy: -20, dz: 10 },
      { s: "C" as AtomSymbol, dy: 26, dz: 16 },
      { s: "C" as AtomSymbol, dy: -24, dz: -12 },
      { s: "O" as AtomSymbol, dy: 20, dz: 10 },
    ];

    let lastId = nAmideId;
    let sX = nAmideX;

    softDefs.forEach((sd, sIdx) => {
      sX += 36;
      const sId = `blk_${b}_soft_${sIdx}_${sd.s.toLowerCase()}`;
      atoms.push({ id: sId, symbol: sd.s, x: Math.round(sX), y: Math.round(cY + sd.dy), z: Math.round(sd.dz) });
      bonds.push({ id: `b_blk_${b}_s_${sIdx}`, sourceId: lastId, targetId: sId, type: "single" });
      lastId = sId;
    });

    curX = sX + 40;
    prevTailId = lastId;
  }

  return attachTerminalCap(atoms, bonds, terminalGroup);
}

/**
 * 7-D. 랜덤 공중합체 (Random Copolymer: 통계적 불규칙 공액 사슬)
 */
export function generateRandomCopolymer(
  terminalGroup?: "OH" | "COOH" | "NH2" | "CH3" | "F" | "Cl" | "none",
  units: number = 10
): { atoms: AtomNode[]; bonds: BondEdge[] } {
  const atoms: AtomNode[] = [];
  const bonds: BondEdge[] = [];

  const startX = 90;
  const startY = 200;
  let curX = startX;
  let prevId = "";

  const patternDefs: Array<{ s: AtomSymbol; dy: number; dz: number; doubleO?: boolean; nh?: boolean }> = [
    { s: "C", dy: 22, dz: 10 },
    { s: "O", dy: -20, dz: -12 },
    { s: "C", dy: 24, dz: 14, doubleO: true },
    { s: "C", dy: -26, dz: -16 },
    { s: "N", dy: 20, dz: 12, nh: true },
    { s: "C", dy: -24, dz: -14 },
    { s: "C", dy: 26, dz: 18 },
    { s: "O", dy: -22, dz: -10 },
    { s: "C", dy: 24, dz: 12, doubleO: true },
    { s: "N", dy: -20, dz: -12, nh: true },
    { s: "C", dy: 22, dz: 14 },
    { s: "C", dy: -24, dz: -16 },
  ];

  patternDefs.slice(0, Math.max(8, units)).forEach((d, idx) => {
    const id = `rnd_${idx}_${d.s.toLowerCase()}`;
    curX += 38;
    atoms.push({ id, symbol: d.s, x: Math.round(curX), y: Math.round(startY + d.dy), z: Math.round(d.dz) });

    if (prevId) {
      bonds.push({ id: `b_rnd_${idx}`, sourceId: prevId, targetId: id, type: "single" });
    }

    if (d.doubleO) {
      const oId = `${id}_ox`;
      atoms.push({ id: oId, symbol: "O", x: Math.round(curX), y: Math.round(startY + d.dy - 44), z: 14 });
      bonds.push({ id: `b_${oId}`, sourceId: id, targetId: oId, type: "double" });
    }

    if (d.nh) {
      const hId = `${id}_h`;
      atoms.push({ id: hId, symbol: "H", x: Math.round(curX + 6), y: Math.round(startY + d.dy + 34), z: -14 });
      bonds.push({ id: `b_${hId}`, sourceId: id, targetId: hId, type: "single" });
    }

    prevId = id;
  });

  return attachTerminalCap(atoms, bonds, terminalGroup);
}

/**
 * 사용자가 입력한 자연어 프롬프트에서 분자량, 공중합 방식, 말단기, 목표 물성치를 정밀 추출
 */
export function extractComplexParameters(prompt: string): PolymerComplexParameters {
  const text = prompt.trim();
  const lower = text.toLowerCase();
  const params: PolymerComplexParameters = {};

  // 1. 분자량 (MW) 추출
  const mwWanMatch = text.match(/([0-9.]+)\s*만/);
  if (mwWanMatch) {
    params.molecularWeight = Math.round(parseFloat(mwWanMatch[1]) * 10000);
  } else {
    const mwKMatch = text.match(/([0-9.]+)\s*k(?:\s*da|\s*g\/mol|\s*mw)?/i);
    if (mwKMatch) {
      params.molecularWeight = Math.round(parseFloat(mwKMatch[1]) * 1000);
    } else {
      const mwMatch =
        text.match(/(?:분자량|mw|단량체|molecular\s*weight)\s*[:=]?\s*([0-9,]+)/i) ||
        text.match(/([0-9,]{4,})\s*(?:g\/mol|da|달톤)/i);
      if (mwMatch) {
        const raw = mwMatch[1].replace(/,/g, "");
        const num = parseFloat(raw);
        if (num > 100 && num < 10000000) {
          params.molecularWeight = num;
        }
      }
    }
  }

  // 2. 공중합 방식 (Copolymerization Mode)
  if (lower.includes("블록") || lower.includes("block")) {
    params.copolymerType = "block";
  } else if (lower.includes("랜덤") || lower.includes("random") || lower.includes("무작위")) {
    params.copolymerType = "random";
  } else if (lower.includes("교호") || lower.includes("alternating") || lower.includes("교대")) {
    params.copolymerType = "alternating";
  } else if (lower.includes("그라프트") || lower.includes("graft") || lower.includes("가지")) {
    params.copolymerType = "graft";
  } else if (lower.includes("단독") || lower.includes("homo")) {
    params.copolymerType = "homo";
  }

  // 3. 말단 작용기 (Terminal Group)
  if (
    lower.includes("말단") ||
    lower.includes("terminal") ||
    lower.includes("-oh") ||
    lower.includes("하이드록시") ||
    lower.includes("-cooh") ||
    lower.includes("카르복실") ||
    lower.includes("-nh2") ||
    lower.includes("아민")
  ) {
    if (lower.includes("카르복실") || lower.includes("-cooh")) {
      params.terminalGroup = "COOH";
    } else if (lower.includes("아민") || lower.includes("-nh2")) {
      params.terminalGroup = "NH2";
    } else if (lower.includes("불소") || lower.includes("-f")) {
      params.terminalGroup = "F";
    } else if (lower.includes("염소") || lower.includes("-cl")) {
      params.terminalGroup = "Cl";
    } else if (lower.includes("메틸") || lower.includes("-ch3")) {
      params.terminalGroup = "CH3";
    } else if (lower.includes("하이드록시") || lower.includes("-oh")) {
      params.terminalGroup = "OH";
    }
  }

  // 4. 물성 요구사항 (Target Properties)
  const tgMatch = text.match(/(?:tg|유리전이온도|내열성|전이온도)\s*[:=]?\s*([0-9]+)\s*(?:도|°|c)?/i);
  const tenacityMatch = text.match(/(?:인장강도|강도|tenacity|strength)\s*[:=]?\s*([0-9.]+)\s*(?:g\/d|mpa|g\/den)?/i);
  const modMatch = text.match(/(?:탄성률|모듈러스|modulus)\s*[:=]?\s*([0-9.]+)\s*(?:g\/d|gpa)?/i);
  const eloMatch = text.match(/(?:신율|파단신율|elongation)\s*[:=]?\s*([0-9.]+)\s*(?:%|프로)?/i);

  if (tgMatch || tenacityMatch || modMatch || eloMatch) {
    params.targetProperties = {};
    if (tgMatch) params.targetProperties.tg = parseFloat(tgMatch[1]);
    if (tenacityMatch) params.targetProperties.tenacity = parseFloat(tenacityMatch[1]);
    if (modMatch) params.targetProperties.modulus = parseFloat(modMatch[1]);
    if (eloMatch) params.targetProperties.elongation = parseFloat(eloMatch[1]);
  }

  return params;
}

/**
 * 복합 파라미터와 분자 구조로부터 다차원 재료정보학 물성 데이터 및 목표 매칭도 계산
 */
export function calculateComplexProperties(
  descriptor: MolecularDescriptor,
  params: PolymerComplexParameters
): {
  predicted: NonNullable<PolymerComplexParameters["predictedProperties"]>;
  dp: number;
} {
  const mw = params.molecularWeight || 35000;
  const monomerMw = Math.max(50, descriptor.monomerMW || 160);
  const dp = Math.max(10, Math.round(mw / monomerMw));

  // Tg 계산 (기본 Tg + 분자량 기여 + 공중합체 보정 + 말단기 수소결합)
  let baseTg = descriptor.estimatedTg || 120;
  if (params.copolymerType === "block") {
    baseTg += 24; // 하드 세그먼트 도메인에 의한 Tg 상승
  } else if (params.copolymerType === "random") {
    baseTg -= 8;
  }
  if (params.terminalGroup === "COOH" || params.terminalGroup === "NH2") {
    baseTg += 12; // 강한 수소결합성 말단기
  } else if (params.terminalGroup === "OH") {
    baseTg += 6;
  }
  const predictedTg = Math.round(baseTg + Math.min(30, dp * 0.1));

  // 인장강도 (Tenacity, g/d) - Flory-Fox 점근식 및 블록 상분리 가교
  let tenacity = 3.6 + descriptor.rigidityScore * 4.2 + Math.min(3.8, dp / 70);
  if (params.copolymerType === "block") tenacity += 1.4;
  const predictedTenacity = Math.round(tenacity * 10) / 10;

  // 탄성률 (Modulus, g/d)
  const predictedModulus = Math.round((48 + descriptor.rigidityScore * 65 + (params.copolymerType === "block" ? 18 : 0)) * 10) / 10;

  // 신율 (Elongation, %)
  const predictedElongation = Math.round(
    Math.max(10, (1 - descriptor.rigidityScore) * 45 + (params.copolymerType === "block" ? 12 : 6)) * 10
  ) / 10;

  // 목표 대비 만족도 (Target Match Score, %)
  let matchScore = 92;
  if (params.targetProperties) {
    let diffSum = 0;
    let count = 0;
    if (params.targetProperties.tg) {
      diffSum += Math.abs(predictedTg - params.targetProperties.tg) / params.targetProperties.tg;
      count++;
    }
    if (params.targetProperties.tenacity) {
      diffSum += Math.abs(predictedTenacity - params.targetProperties.tenacity) / params.targetProperties.tenacity;
      count++;
    }
    if (count > 0) {
      const avgDiff = diffSum / count;
      matchScore = Math.max(65, Math.min(99, Math.round((1 - avgDiff * 0.5) * 100)));
    }
  }

  return {
    predicted: {
      tg: predictedTg,
      tenacity: predictedTenacity,
      modulus: predictedModulus,
      elongation: predictedElongation,
      thermalIndex: Math.round(predictedTg * 0.85 + predictedTenacity * 5),
      targetMatchScore: matchScore,
    },
    dp,
  };
}

/**
 * 8. 물 분자 (H2O, 104.5도) 3D 구조
 */
export function generateWaterMolecule(): { atoms: AtomNode[]; bonds: BondEdge[] } {
  const atoms: AtomNode[] = [
    { id: "w_o", symbol: "O", x: 220, y: 200, z: 0 },
    { id: "w_h1", symbol: "H", x: 256, y: 172, z: 16 },
    { id: "w_h2", symbol: "H", x: 184, y: 172, z: -16 },
  ];
  const bonds: BondEdge[] = [
    { id: "wb1", sourceId: "w_o", targetId: "w_h1", type: "single" },
    { id: "wb2", sourceId: "w_o", targetId: "w_h2", type: "single" },
  ];
  return { atoms, bonds };
}

/**
 * 9. 에탄올 분자 (C2H5OH) 3D 구조
 */
export function generateEthanolMolecule(): { atoms: AtomNode[]; bonds: BondEdge[] } {
  const atoms: AtomNode[] = [
    { id: "et_c1", symbol: "C", x: 160, y: 200, z: 0 },
    { id: "et_c2", symbol: "C", x: 216, y: 180, z: 14 },
    { id: "et_o", symbol: "O", x: 268, y: 216, z: -12 },
    { id: "et_ho", symbol: "H", x: 304, y: 196, z: -16 },
    { id: "et_h1", symbol: "H", x: 160, y: 248, z: 24 },
    { id: "et_h2", symbol: "H", x: 160, y: 248, z: -24 },
    { id: "et_h3", symbol: "H", x: 116, y: 180, z: 0 },
    { id: "et_h4", symbol: "H", x: 216, y: 132, z: 28 },
    { id: "et_h5", symbol: "H", x: 216, y: 132, z: -28 },
  ];
  const bonds: BondEdge[] = [
    { id: "etb1", sourceId: "et_c1", targetId: "et_c2", type: "single" },
    { id: "etb2", sourceId: "et_c2", targetId: "et_o", type: "single" },
    { id: "etb3", sourceId: "et_o", targetId: "et_ho", type: "single" },
    { id: "etb4", sourceId: "et_c1", targetId: "et_h1", type: "single" },
    { id: "etb5", sourceId: "et_c1", targetId: "et_h2", type: "single" },
    { id: "etb6", sourceId: "et_c1", targetId: "et_h3", type: "single" },
    { id: "etb7", sourceId: "et_c2", targetId: "et_h4", type: "single" },
    { id: "etb8", sourceId: "et_c2", targetId: "et_h5", type: "single" },
  ];
  return { atoms, bonds };
}

/**
 * 10. 메탄 분자 (CH4, 사면체 109.5도) 3D 구조
 */
export function generateMethaneMolecule(): { atoms: AtomNode[]; bonds: BondEdge[] } {
  const atoms: AtomNode[] = [
    { id: "me_c", symbol: "C", x: 220, y: 200, z: 0 },
    { id: "me_h1", symbol: "H", x: 220, y: 154, z: 36 },
    { id: "me_h2", symbol: "H", x: 262, y: 232, z: -20 },
    { id: "me_h3", symbol: "H", x: 178, y: 232, z: -20 },
    { id: "me_h4", symbol: "H", x: 220, y: 228, z: 40 },
  ];
  const bonds: BondEdge[] = [
    { id: "mb1", sourceId: "me_c", targetId: "me_h1", type: "single" },
    { id: "mb2", sourceId: "me_c", targetId: "me_h2", type: "single" },
    { id: "mb3", sourceId: "me_c", targetId: "me_h3", type: "single" },
    { id: "mb4", sourceId: "me_c", targetId: "me_h4", type: "single" },
  ];
  return { atoms, bonds };
}

/**
 * 결합 길이 동적 수정 함수
 */
export function modifyBondLength(
  atoms: AtomNode[],
  bonds: BondEdge[],
  targetLengthAngstrom?: number,
  scaleFactor: number = 1.25
): { atoms: AtomNode[]; bonds: BondEdge[]; appliedLength: number; targetBondId: string } {
  if (atoms.length < 2 || bonds.length === 0) {
    return { atoms: [...atoms], bonds: [...bonds], appliedLength: 1.54, targetBondId: "" };
  }

  const ringBonds = new Set(bonds.filter((b) => b.id.includes("ring") || b.id.includes("ar")).map((b) => b.id));
  const candidateBonds = bonds.filter((b) => !ringBonds.has(b.id) && b.type === "single");
  const targetBond = candidateBonds.length > 0 ? candidateBonds[0] : bonds[Math.floor(bonds.length / 2)];

  const sourceAtom = atoms.find((a) => a.id === targetBond.sourceId);
  const targetAtom = atoms.find((a) => a.id === targetBond.targetId);

  if (!sourceAtom || !targetAtom) {
    return { atoms: [...atoms], bonds: [...bonds], appliedLength: 1.54, targetBondId: targetBond.id };
  }

  const dx = targetAtom.x - sourceAtom.x;
  const dy = targetAtom.y - sourceAtom.y;
  const dz = (targetAtom.z || 0) - (sourceAtom.z || 0);
  const curDist = Math.sqrt(dx * dx + dy * dy + dz * dz);

  const desiredPx = targetLengthAngstrom
    ? targetLengthAngstrom * ANGSTROM_TO_PX
    : curDist * scaleFactor;

  const ratio = curDist > 0.001 ? desiredPx / curDist : 1.25;
  const deltaX = dx * (ratio - 1.0);
  const deltaY = dy * (ratio - 1.0);
  const deltaZ = dz * (ratio - 1.0);

  const visited = new Set<string>();
  visited.add(sourceAtom.id);

  const shiftNodes = new Set<string>();
  const queue: string[] = [targetAtom.id];

  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (visited.has(cur)) continue;
    visited.add(cur);
    shiftNodes.add(cur);

    bonds.forEach((b) => {
      if (b.sourceId === cur && !visited.has(b.targetId)) queue.push(b.targetId);
      if (b.targetId === cur && !visited.has(b.sourceId)) queue.push(b.sourceId);
    });
  }

  const newAtoms: AtomNode[] = atoms.map((a) => {
    if (shiftNodes.has(a.id)) {
      return {
        ...a,
        x: Math.round(a.x + deltaX),
        y: Math.round(a.y + deltaY),
        z: Math.round((a.z || 0) + deltaZ),
      };
    }
    return { ...a };
  });

  const appliedLength = Math.round((desiredPx * PX_TO_ANGSTROM) * 100) / 100;

  return {
    atoms: newAtoms,
    bonds: [...bonds],
    appliedLength,
    targetBondId: targetBond.id,
  };
}

/**
 * 결합 각도 동적 회전 함수
 */
export function modifyBondAngle(
  atoms: AtomNode[],
  bonds: BondEdge[],
  targetAngleDeg: number = 120
): { atoms: AtomNode[]; bonds: BondEdge[]; appliedAngle: number; vertexAtomId: string } {
  if (atoms.length < 3) {
    return { atoms: [...atoms], bonds: [...bonds], appliedAngle: targetAngleDeg, vertexAtomId: "" };
  }

  const degreeMap = new Map<string, string[]>();
  bonds.forEach((b) => {
    if (!degreeMap.has(b.sourceId)) degreeMap.set(b.sourceId, []);
    if (!degreeMap.has(b.targetId)) degreeMap.set(b.targetId, []);
    degreeMap.get(b.sourceId)!.push(b.targetId);
    degreeMap.get(b.targetId)!.push(b.sourceId);
  });

  let vertexId = "";
  for (const [id, neighbors] of degreeMap.entries()) {
    if (neighbors.length >= 2 && !id.includes("ring") && !id.includes("ar")) {
      vertexId = id;
      break;
    }
  }

  if (!vertexId) {
    for (const [id, neighbors] of degreeMap.entries()) {
      if (neighbors.length >= 2) {
        vertexId = id;
        break;
      }
    }
  }

  const vertexAtom = atoms.find((a) => a.id === vertexId);
  if (!vertexAtom) {
    return { atoms: [...atoms], bonds: [...bonds], appliedAngle: targetAngleDeg, vertexAtomId: "" };
  }

  const neighbors = degreeMap.get(vertexId)!;
  const arm1Id = neighbors[0];
  const arm2Id = neighbors[1];
  const arm1 = atoms.find((a) => a.id === arm1Id)!;
  const arm2 = atoms.find((a) => a.id === arm2Id)!;

  const v1 = { x: arm1.x - vertexAtom.x, y: arm1.y - vertexAtom.y };
  const v2 = { x: arm2.x - vertexAtom.x, y: arm2.y - vertexAtom.y };

  const angle1 = Math.atan2(v1.y, v1.x);
  const currentAngle2 = Math.atan2(v2.y, v2.x);

  const targetRad = (targetAngleDeg * Math.PI) / 180;
  const newAngle2 = angle1 + targetRad;
  const deltaAngle = newAngle2 - currentAngle2;

  const visited = new Set<string>();
  visited.add(vertexAtom.id);
  visited.add(arm1Id);

  const rotateNodes = new Set<string>();
  const queue: string[] = [arm2Id];

  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (visited.has(cur)) continue;
    visited.add(cur);
    rotateNodes.add(cur);

    bonds.forEach((b) => {
      if (b.sourceId === cur && !visited.has(b.targetId)) queue.push(b.targetId);
      if (b.targetId === cur && !visited.has(b.sourceId)) queue.push(b.sourceId);
    });
  }

  const cosT = Math.cos(deltaAngle);
  const sinT = Math.sin(deltaAngle);

  const newAtoms: AtomNode[] = atoms.map((a) => {
    if (rotateNodes.has(a.id)) {
      const rx = a.x - vertexAtom.x;
      const ry = a.y - vertexAtom.y;
      const nx = rx * cosT - ry * sinT;
      const ny = rx * sinT + ry * cosT;
      return {
        ...a,
        x: Math.round(vertexAtom.x + nx),
        y: Math.round(vertexAtom.y + ny),
      };
    }
    return { ...a };
  });

  return {
    atoms: newAtoms,
    bonds: [...bonds],
    appliedAngle: targetAngleDeg,
    vertexAtomId: vertexId,
  };
}

/**
 * 작용기(Functional Group) 부착 및 치환 함수
 */
export function attachFunctionalGroup(
  atoms: AtomNode[],
  bonds: BondEdge[],
  groupType: "OH" | "COOH" | "NH2" | "CH3" | "F" | "Cl"
): { atoms: AtomNode[]; bonds: BondEdge[]; addedAtomIds: string[] } {
  const newAtoms: AtomNode[] = atoms.map((a) => ({ ...a }));
  const newBonds: BondEdge[] = bonds.map((b) => ({ ...b }));
  const addedAtomIds: string[] = [];

  let maxX = -Infinity;
  let targetAtom = newAtoms[0];

  newAtoms.forEach((a) => {
    if (a.x > maxX && a.symbol !== "H") {
      maxX = a.x;
      targetAtom = a;
    }
  });

  const anchorX = targetAtom.x;
  const anchorY = targetAtom.y;
  const anchorZ = targetAtom.z || 0;
  const timestamp = Date.now().toString().slice(-4);

  if (groupType === "OH") {
    const oId = `oh_o_${timestamp}`;
    const hId = `oh_h_${timestamp}`;
    newAtoms.push({ id: oId, symbol: "O", x: anchorX + 48, y: anchorY - 18, z: anchorZ + 14 });
    newAtoms.push({ id: hId, symbol: "H", x: anchorX + 78, y: anchorY - 36, z: anchorZ + 20 });
    newBonds.push(
      { id: `b_${oId}`, sourceId: targetAtom.id, targetId: oId, type: "single" },
      { id: `b_${hId}`, sourceId: oId, targetId: hId, type: "single" }
    );
    addedAtomIds.push(oId, hId);
  } else if (groupType === "COOH") {
    const cId = `cooh_c_${timestamp}`;
    const o1Id = `cooh_o1_${timestamp}`;
    const o2Id = `cooh_o2_${timestamp}`;
    const hId = `cooh_h_${timestamp}`;
    newAtoms.push(
      { id: cId, symbol: "C", x: anchorX + 50, y: anchorY, z: anchorZ },
      { id: o1Id, symbol: "O", x: anchorX + 50, y: anchorY - 48, z: anchorZ + 10 },
      { id: o2Id, symbol: "O", x: anchorX + 94, y: anchorY + 18, z: anchorZ - 8 },
      { id: hId, symbol: "H", x: anchorX + 124, y: anchorY + 12, z: anchorZ - 12 }
    );
    newBonds.push(
      { id: `b_${cId}`, sourceId: targetAtom.id, targetId: cId, type: "single" },
      { id: `b_${o1Id}`, sourceId: cId, targetId: o1Id, type: "double" },
      { id: `b_${o2Id}`, sourceId: cId, targetId: o2Id, type: "single" },
      { id: `b_${hId}`, sourceId: o2Id, targetId: hId, type: "single" }
    );
    addedAtomIds.push(cId, o1Id, o2Id, hId);
  } else if (groupType === "NH2") {
    const nId = `nh2_n_${timestamp}`;
    const h1Id = `nh2_h1_${timestamp}`;
    const h2Id = `nh2_h2_${timestamp}`;
    newAtoms.push(
      { id: nId, symbol: "N", x: anchorX + 48, y: anchorY + 10, z: anchorZ + 12 },
      { id: h1Id, symbol: "H", x: anchorX + 76, y: anchorY + 34, z: anchorZ + 22 },
      { id: h2Id, symbol: "H", x: anchorX + 76, y: anchorY - 16, z: anchorZ - 10 }
    );
    newBonds.push(
      { id: `b_${nId}`, sourceId: targetAtom.id, targetId: nId, type: "single" },
      { id: `b_${h1Id}`, sourceId: nId, targetId: h1Id, type: "single" },
      { id: `b_${h2Id}`, sourceId: nId, targetId: h2Id, type: "single" }
    );
    addedAtomIds.push(nId, h1Id, h2Id);
  } else if (groupType === "F" || groupType === "Cl") {
    const halId = `hal_${groupType.toLowerCase()}_${timestamp}`;
    newAtoms.push({ id: halId, symbol: groupType, x: anchorX + 46, y: anchorY - 12, z: anchorZ + 10 });
    newBonds.push({ id: `b_${halId}`, sourceId: targetAtom.id, targetId: halId, type: "single" });
    addedAtomIds.push(halId);
  } else if (groupType === "CH3") {
    const cId = `me_c_${timestamp}`;
    const h1Id = `me_h1_${timestamp}`;
    const h2Id = `me_h2_${timestamp}`;
    const h3Id = `me_h3_${timestamp}`;
    newAtoms.push(
      { id: cId, symbol: "C", x: anchorX + 48, y: anchorY, z: anchorZ },
      { id: h1Id, symbol: "H", x: anchorX + 76, y: anchorY + 28, z: anchorZ + 20 },
      { id: h2Id, symbol: "H", x: anchorX + 76, y: anchorY - 28, z: anchorZ + 20 },
      { id: h3Id, symbol: "H", x: anchorX + 76, y: anchorY, z: anchorZ - 32 }
    );
    newBonds.push(
      { id: `b_${cId}`, sourceId: targetAtom.id, targetId: cId, type: "single" },
      { id: `b_${h1Id}`, sourceId: cId, targetId: h1Id, type: "single" },
      { id: `b_${h2Id}`, sourceId: cId, targetId: h2Id, type: "single" },
      { id: `b_${h3Id}`, sourceId: cId, targetId: h3Id, type: "single" }
    );
    addedAtomIds.push(cId, h1Id, h2Id, h3Id);
  }

  return { atoms: newAtoms, bonds: newBonds, addedAtomIds };
}

/**
 * 3D 기하 분자 역학 완화 및 에너지 최소화
 */
export function relaxMolecularGeometry(
  atoms: AtomNode[],
  bonds: BondEdge[]
): { atoms: AtomNode[]; bonds: BondEdge[]; relievedStrain: number } {
  const newAtoms: AtomNode[] = atoms.map((a) => ({ ...a }));
  const idealDistPx = 1.50 * ANGSTROM_TO_PX;

  for (let iter = 0; iter < 5; iter++) {
    bonds.forEach((b) => {
      const a1 = newAtoms.find((a) => a.id === b.sourceId);
      const a2 = newAtoms.find((a) => a.id === b.targetId);
      if (!a1 || !a2) return;

      const dx = a2.x - a1.x;
      const dy = a2.y - a1.y;
      const dz = (a2.z || 0) - (a1.z || 0);
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < 0.001) return;

      const targetD = b.type === "double" ? 1.34 * ANGSTROM_TO_PX : idealDistPx;
      const diff = (d - targetD) * 0.15;
      const fx = (dx / d) * diff;
      const fy = (dy / d) * diff;
      const fz = (dz / d) * diff;

      const a1Rigid = a1.id.includes("ring") || a1.id.includes("ar");
      const a2Rigid = a2.id.includes("ring") || a2.id.includes("ar");

      if (!a1Rigid) {
        a1.x += Math.round(fx);
        a1.y += Math.round(fy);
        a1.z = Math.round((a1.z || 0) + fz);
      }
      if (!a2Rigid) {
        a2.x -= Math.round(fx);
        a2.y -= Math.round(fy);
        a2.z = Math.round((a2.z || 0) - fz);
      }
    });
  }

  return { atoms: newAtoms, bonds: [...bonds], relievedStrain: 14.5 };
}

/**
 * 스트레인 에너지 계산
 */
export function calculateStrainEnergy(atoms: AtomNode[], bonds: BondEdge[]): number {
  if (bonds.length === 0) return 0;
  let totalStrain = 0;
  const idealSingle = 1.54 * ANGSTROM_TO_PX;
  const idealDouble = 1.34 * ANGSTROM_TO_PX;

  bonds.forEach((b) => {
    const a1 = atoms.find((a) => a.id === b.sourceId);
    const a2 = atoms.find((a) => a.id === b.targetId);
    if (!a1 || !a2) return;

    const dx = a2.x - a1.x;
    const dy = a2.y - a1.y;
    const dz = (a2.z || 0) - (a1.z || 0);
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const ideal = b.type === "double" ? idealDouble : idealSingle;
    const delta = (d - ideal) * PX_TO_ANGSTROM;

    totalStrain += 0.5 * 350 * delta * delta;
  });

  return Math.min(99.9, Math.round(totalStrain * 10) / 10);
}

/**
 * R&D 등급 산출기
 */
export function computeResearchViability(
  descriptor: MolecularDescriptor,
  validation: MolecularValidationResult,
  strainEnergy: number
): { score: number; grade: "S" | "A" | "B" | "C" } {
  let score = 78;
  if (validation.isValid) score += 10;
  else score -= validation.errors.length * 12;

  if (descriptor.rigidityScore > 0.25 && descriptor.rigidityScore < 0.75) score += 8;
  if (descriptor.heteroatomRatio > 0.12) score += 6;

  if (strainEnergy > 30) score -= 12;
  else if (strainEnergy < 15) score += 5;

  score = Math.max(20, Math.min(98, Math.round(score)));

  let grade: "S" | "A" | "B" | "C" = "B";
  if (score >= 90) grade = "S";
  else if (score >= 80) grade = "A";
  else if (score >= 60) grade = "B";
  else grade = "C";

  return { score, grade };
}

// ─────────────────────────────────────────────────────────────────────────────
// [자연어/구조식 파싱 인터셉터 (Input Interceptor) & 3D 공중합 사슬 조립 브릿지]
// ─────────────────────────────────────────────────────────────────────────────

const DOMAIN_COLORS = ["#f59e0b", "#38bdf8", "#10b981", "#a855f7", "#ec4899"];

interface PolymerDictEntry {
  id: string;
  canonical: string;
  koreanName: string;
  shortName: string;
  aliases: string[];
}

const POLYMER_COMPONENT_DICTIONARY: PolymerDictEntry[] = [
  {
    id: "ps",
    canonical: "polystyrene",
    koreanName: "폴리스티렌",
    shortName: "PS",
    aliases: ["폴리스티렌", "스티렌", "polystyrene", "styrene", "ps", "스티로폼"],
  },
  {
    id: "pp",
    canonical: "polypropylene",
    koreanName: "폴리프로필렌",
    shortName: "PP",
    aliases: ["폴리프로필렌", "프로필렌", "polypropylene", "propylene", "pp"],
  },
  {
    id: "pe",
    canonical: "polyethylene",
    koreanName: "폴리에틸렌",
    shortName: "PE",
    aliases: ["폴리에틸렌", "에틸렌", "polyethylene", "ethylene", "uhmwpe", "hdpe", "ldpe", "lldpe", "pe"],
  },
  {
    id: "pmma",
    canonical: "poly(methyl methacrylate)",
    koreanName: "폴리메틸메타크릴레이트",
    shortName: "PMMA",
    aliases: ["폴리메틸메타크릴레이트", "메타크릴레이트", "아크릴유리", "pmma", "mma", "plexiglass"],
  },
  {
    id: "pet",
    canonical: "poly(ethylene terephthalate)",
    koreanName: "폴리에틸렌 테레프탈레이트",
    shortName: "PET",
    aliases: ["폴리에틸렌테레프탈레이트", "폴리에틸렌 테레프탈레이트", "테레프탈레이트", "폴리에스터", "폴리에스테르", "페트", "pet", "polyester"],
  },
  {
    id: "nylon66",
    canonical: "polyamide",
    koreanName: "나일론",
    shortName: "PA",
    aliases: ["나일론66", "나일론 66", "나일론6", "나일론 6", "나일론", "폴리아미드", "nylon66", "nylon 66", "nylon6", "nylon", "polyamide", "pa66", "pa6", "pa"],
  },
  {
    id: "pvc",
    canonical: "poly(vinyl chloride)",
    koreanName: "폴리염화비닐",
    shortName: "PVC",
    aliases: ["폴리염화비닐", "염화비닐", "pvc", "polyvinyl chloride", "vinyl chloride"],
  },
  {
    id: "pan",
    canonical: "polyacrylonitrile",
    koreanName: "폴리아크릴로니트릴",
    shortName: "PAN",
    aliases: ["폴리아크릴로니트릴", "아크릴로니트릴", "pan", "polyacrylonitrile", "acrylonitrile", "an"],
  },
  {
    id: "ptfe",
    canonical: "polytetrafluoroethylene",
    koreanName: "폴리테트라플루오로에틸렌",
    shortName: "PTFE",
    aliases: ["폴리테트라플루오로에틸렌", "테트라플루오로에틸렌", "테프론", "테플론", "고어텍스", "ptfe", "teflon"],
  },
  {
    id: "pu",
    canonical: "polyurethane",
    koreanName: "폴리우레탄",
    shortName: "PU",
    aliases: ["폴리우레탄", "우레탄", "스판덱스", "pu", "tpu", "polyurethane"],
  },
  {
    id: "polybutadiene",
    canonical: "polybutadiene",
    koreanName: "폴리부타디엔",
    shortName: "BR",
    aliases: ["폴리부타디엔", "부타디엔", "polybutadiene", "butadiene", "br", "pb", "pbd"],
  },
  {
    id: "polyisoprene",
    canonical: "polyisoprene",
    koreanName: "폴리이소프렌",
    shortName: "IR",
    aliases: ["폴리이소프렌", "이소프렌", "천연고무", "polyisoprene", "isoprene", "ir", "nr", "pi"],
  },
  {
    id: "pvac",
    canonical: "poly(vinyl acetate)",
    koreanName: "폴리비닐아세테이트",
    shortName: "PVAc",
    aliases: ["폴리비닐아세테이트", "비닐아세테이트", "pvac", "polyvinyl acetate", "vac"],
  },
  {
    id: "pva",
    canonical: "poly(vinyl alcohol)",
    koreanName: "폴리비닐알코올",
    shortName: "PVA",
    aliases: ["폴리비닐알코올", "비닐알코올", "pva", "pval", "polyvinyl alcohol"],
  },
  {
    id: "pc",
    canonical: "polycarbonate",
    koreanName: "폴리카보네이트",
    shortName: "PC",
    aliases: ["폴리카보네이트", "카보네이트", "polycarbonate", "pc"],
  },
  {
    id: "aramid",
    canonical: "aramid",
    koreanName: "아라미드",
    shortName: "Aramid",
    aliases: ["아라미드", "케블라", "노멕스", "aramid", "kevlar", "ppta"],
  },
  {
    id: "peg",
    canonical: "poly(ethylene glycol)",
    koreanName: "폴리에틸렌글리콜",
    shortName: "PEG",
    aliases: ["폴리에틸렌글리콜", "폴리에틸렌옥사이드", "에틸렌글리콜", "peg", "peo", "polyethylene glycol"],
  },
  {
    id: "pla",
    canonical: "polylactic acid",
    koreanName: "폴리락트산",
    shortName: "PLA",
    aliases: ["폴리락트산", "폴리유산", "락트산", "폴리카프로락톤", "카프로락톤", "pla", "pcl", "la", "cl", "polylactic acid", "polycaprolactone"],
  },
  {
    id: "pdms",
    canonical: "polydimethylsiloxane",
    koreanName: "폴리디메틸실록산",
    shortName: "PDMS",
    aliases: ["폴리디메틸실록산", "실록산", "실리콘", "pdms", "dms", "silicone", "polydimethylsiloxane"],
  },
  {
    id: "ptfe",
    canonical: "poly(vinylidene fluoride)",
    koreanName: "폴리비닐리덴플루오라이드",
    shortName: "PVDF",
    aliases: ["폴리비닐리덴플루오라이드", "비닐리덴플루오라이드", "불소수지", "pvdf", "vdf", "polyvinylidene fluoride"],
  },
  {
    id: "aramid",
    canonical: "polyetheretherketone",
    koreanName: "폴리에테르에테르케톤",
    shortName: "PEEK",
    aliases: ["폴리에테르에테르케톤", "피크수지", "peek", "peek_u", "polyetheretherketone"],
  },
  {
    id: "pc",
    canonical: "polyethersulfone",
    koreanName: "폴리에테르설폰",
    shortName: "PES",
    aliases: ["폴리에테르설폰", "폴리설폰", "폴리페닐렌설파이드", "pes", "pes_u", "psu", "pps", "polyethersulfone"],
  },
  {
    id: "ps",
    canonical: "poly(4-vinylpyridine)",
    koreanName: "폴리(4-비닐피리딘)",
    shortName: "P4VP",
    aliases: ["폴리비닐피리딘", "비닐피리딘", "p4vp", "4vp", "vinylpyridine"],
  },
  {
    id: "pmma",
    canonical: "poly(glycidyl methacrylate)",
    koreanName: "폴리글리시딜메타크릴레이트",
    shortName: "PGMA",
    aliases: ["폴리글리시딜메타크릴레이트", "글리시딜메타크릴레이트", "pgma", "gma", "폴리부틸아크릴레이트", "부틸아크릴레이트", "pba", "ba"],
  },
  {
    id: "pan",
    canonical: "poly(vinylpyrrolidone)",
    koreanName: "폴리비닐피롤리돈",
    shortName: "PVP",
    aliases: ["폴리비닐피롤리돈", "비닐피롤리돈", "pvp", "vp", "polyvinylpyrrolidone"],
  },
];

/**
 * 한국어 받침 유무에 따른 조사 '과' / '와' 자동 판별
 */
function withKoreanGwaWa(word: string): string {
  const cleaned = word.replace(/\([^)]*\)/g, "").trim();
  if (!cleaned) return word + "와";
  const lastChar = cleaned.charCodeAt(cleaned.length - 1);
  // 한글 가(0xAC00) ~ 힣(0xD7A3)
  if (lastChar >= 0xac00 && lastChar <= 0xd7a3) {
    const jongseong = (lastChar - 0xac00) % 28;
    return `${word}${jongseong !== 0 ? "과" : "와"}`;
  }
  // 영문/숫자 약어 받침 근사 (L, M, N, R, B, C, D, G, K, P, T, Z 등)
  const lastCh = cleaned[cleaned.length - 1].toUpperCase();
  const hasConsonantLike = /[LMNRBCDGKPTZ013678]/.test(lastCh);
  return `${word}${hasConsonantLike ? "과" : "와"}`;
}

/**
 * 연결자 토큰을 표준 공중합 타입("graft" | "block" | "random" | "alternating")으로 정규화
 */
function normalizeConnectorToken(rawToken: string): "graft" | "block" | "random" | "alternating" {
  const t = rawToken.replace(/[-_\s]/g, "").toLowerCase();
  if (t === "g" || t === "graft" || t.includes("그라프트") || t.includes("그래프트") || t.includes("가지")) {
    return "graft";
  }
  if (t === "b" || t === "blk" || t === "block" || t.includes("블록")) {
    return "block";
  }
  if (t === "alt" || t === "alternating" || t.includes("교대") || t.includes("교호")) {
    return "alternating";
  }
  return "random";
}

/**
 * 단일 성분 토큰 문자열을 PolymerComponentMeta로 변환
 */
export function resolvePolymerComponent(rawSegment: string, index: number): PolymerComponentMeta | null {
  const cleaned = rawSegment
    .replace(/^poly\(/i, "")
    .replace(/\)$/i, "")
    .replace(/[\[\]()'"`]/g, "")
    .replace(/(?:공중합체|고분자|사슬|단량체|만들어줘|생성해줘|그려줘|보여줘|렌더링|해줘|구조식|구조|합성|설계).*$/g, "")
    .replace(/^(?:과|와|및|그리고)\s*/, "")
    .replace(/(?:과|와|의|을|를|로|으로)$/, "")
    .trim();

  if (!cleaned) return null;
  const lower = cleaned.toLowerCase();

  // 1. 정확 일치 우선 탐색
  for (const entry of POLYMER_COMPONENT_DICTIONARY) {
    if (entry.aliases.some((alias) => alias.toLowerCase() === lower)) {
      return {
        id: entry.id,
        canonical: entry.canonical,
        koreanName: entry.koreanName,
        shortName: entry.shortName,
        color: DOMAIN_COLORS[index % DOMAIN_COLORS.length],
      };
    }
  }

  // 2. 부분 문자열 포함 탐색 (긴 별칭 우선)
  for (const entry of POLYMER_COMPONENT_DICTIONARY) {
    const sortedAliases = [...entry.aliases].sort((a, b) => b.length - a.length);
    for (const alias of sortedAliases) {
      if (alias.length >= 2 && lower.includes(alias.toLowerCase())) {
        return {
          id: entry.id,
          canonical: entry.canonical,
          koreanName: entry.koreanName,
          shortName: entry.shortName,
          color: DOMAIN_COLORS[index % DOMAIN_COLORS.length],
        };
      }
    }
  }

  // 3. [고분자A], [MonomerA] 등 임의 구조식 플레이스홀더도 유연하게 수용
  if (cleaned.length >= 1 && cleaned.length <= 24) {
    const fallbackIds = ["ps", "pp", "pe", "pmma"];
    return {
      id: fallbackIds[index % fallbackIds.length],
      canonical: cleaned.toLowerCase(),
      koreanName: cleaned,
      shortName: cleaned.toUpperCase().slice(0, 8),
      color: DOMAIN_COLORS[index % DOMAIN_COLORS.length],
    };
  }

  return null;
}

/**
 * 공중합 성분 및 연결자 목록으로부터 ParsedCopolymerStructure 완성 객체 생성
 */
function createParsedCopolymerResult(
  componentDetails: PolymerComponentMeta[],
  connectors: Array<"graft" | "block" | "random" | "alternating">,
  rawFormula: string
): ParsedCopolymerStructure {
  const hasGraft = connectors.includes("graft");
  const hasBlock = connectors.includes("block");
  const hasAlt = connectors.includes("alternating");

  let structure_type: "graft" | "block" | "random" | "alternating" = "block";
  if (hasGraft) {
    structure_type = "graft";
  } else if (hasBlock) {
    structure_type = "block";
  } else if (hasAlt) {
    structure_type = "alternating";
  } else if (connectors.length > 0) {
    structure_type = connectors[0];
  }

  let architecture = "multi-block-graft";
  if (hasGraft && hasBlock) {
    architecture = "multi-block-graft";
  } else if (hasGraft) {
    architecture = "multi-block-graft";
  } else if (hasBlock) {
    architecture = componentDetails.length >= 3 ? "multi-block-copolymer" : "diblock-copolymer";
  } else if (hasAlt) {
    architecture = "alternating-copolymer";
  } else {
    architecture = "statistical-random-copolymer";
  }

  const components = componentDetails.map((c) => c.canonical);

  // 한국어 성분 나열 문자열 조합 (예: "폴리스티렌과 폴리프로필렌", "폴리스티렌, 폴리프로필렌과 폴리에틸렌")
  const korNames = componentDetails.map((c) => c.koreanName);
  let korJoined = "";
  if (korNames.length === 1) {
    korJoined = korNames[0];
  } else if (korNames.length === 2) {
    korJoined = `${withKoreanGwaWa(korNames[0])} ${korNames[1]}`;
  } else {
    const head = korNames.slice(0, -2).join(", ");
    const secondLast = withKoreanGwaWa(korNames[korNames.length - 2]);
    const last = korNames[korNames.length - 1];
    korJoined = `${head ? head + ", " : ""}${secondLast} ${last}`;
  }

  const typeLabel =
    structure_type === "graft"
      ? "Graft(가지형)"
      : structure_type === "block"
      ? "Block(블록형)"
      : structure_type === "alternating"
      ? "Alternating(교대형)"
      : "Random(랜덤형)";

  const systemMessage = `✨ [시스템] ${korJoined}의 ${typeLabel} 공중합체 구조 파싱 완료. 3D 뷰어를 갱신합니다.`;

  const jsonObj: ParsedCopolymerJSON = {
    structure_type,
    components,
    architecture,
  };

  return {
    ...jsonObj,
    connectors,
    componentDetails,
    rawFormula,
    systemMessage,
    jsonString: JSON.stringify(jsonObj, null, 2),
  };
}

/**
 * [핵심 요구사항 1] 자연어/구조식 파싱 인터셉터 (Input Interceptor)
 * 예: "폴리스티렌-graft-폴리프로필렌", "PS-b-PP-g-PE", "[고분자A] -block- [고분자B] -graft- [고분자C]"
 */
export function interceptPolymerStructureFormula(rawPrompt: string): ParsedCopolymerStructure | null {
  const text = rawPrompt.trim();
  if (!text || text.length < 2) return null;
  const lower = text.toLowerCase();

  // 순수 기하 수정 명령(결합 길이/각도/에너지 이완)이고 공중합 기호가 없는 경우 패스
  const isPureGeometryCommand =
    (lower.includes("결합 거리") ||
      lower.includes("결합 길이") ||
      lower.includes("각도") ||
      lower.includes("에너지 최소화") ||
      lower.includes("relax")) &&
    !/(?:-|\s)(?:graft|block|random|alt|co|g|b|r)(?:-|\s)/i.test(text) &&
    !lower.includes("그라프트") &&
    !lower.includes("그래프트") &&
    !lower.includes("공중합");

  if (isPureGeometryCommand) return null;

  // 0. 유명 상용 다성분 공중합체 약어 즉시 인터셉트 (HIPS, ABS, SBS, SMMA, SAN, EVA)
  const cleanCode = lower.replace(/[^a-z가-힣0-9]/g, "");
  if (cleanCode === "hips" || lower.includes("내충격성 폴리스티렌")) {
    const c1 = resolvePolymerComponent("PS", 0)!;
    const c2 = resolvePolymerComponent("BR", 1)!;
    return createParsedCopolymerResult([c1, c2], ["graft"], text);
  }
  if (cleanCode === "abs" || lower.includes("abs 수지") || lower.includes("abs수지")) {
    const c1 = resolvePolymerComponent("PAN", 0)!;
    const c2 = resolvePolymerComponent("BR", 1)!;
    const c3 = resolvePolymerComponent("PS", 2)!;
    return createParsedCopolymerResult([c1, c2, c3], ["block", "graft"], text);
  }
  if (cleanCode === "sbs") {
    const c1 = resolvePolymerComponent("PS", 0)!;
    const c2 = resolvePolymerComponent("BR", 1)!;
    const c3 = resolvePolymerComponent("PS", 2)!;
    return createParsedCopolymerResult([c1, c2, c3], ["block", "block"], text);
  }
  if (cleanCode === "smma") {
    const c1 = resolvePolymerComponent("PS", 0)!;
    const c2 = resolvePolymerComponent("PMMA", 1)!;
    return createParsedCopolymerResult([c1, c2], ["random"], text);
  }
  if (cleanCode === "san" || lower.includes("san 수지")) {
    const c1 = resolvePolymerComponent("PS", 0)!;
    const c2 = resolvePolymerComponent("PAN", 1)!;
    return createParsedCopolymerResult([c1, c2], ["random"], text);
  }
  if (cleanCode === "eva" || lower.includes("에틸렌비닐아세테이트")) {
    const c1 = resolvePolymerComponent("PE", 0)!;
    const c2 = resolvePolymerComponent("PVAc", 1)!;
    return createParsedCopolymerResult([c1, c2], ["random"], text);
  }
  if (cleanCode === "nbr" || lower.includes("니트릴고무")) {
    const c1 = resolvePolymerComponent("PAN", 0)!;
    const c2 = resolvePolymerComponent("BR", 1)!;
    return createParsedCopolymerResult([c1, c2], ["random"], text);
  }
  if (cleanCode === "sbr" || lower.includes("스티렌부타디엔")) {
    const c1 = resolvePolymerComponent("PS", 0)!;
    const c2 = resolvePolymerComponent("BR", 1)!;
    return createParsedCopolymerResult([c1, c2], ["random"], text);
  }

  // 1. [구조식 Infix 패턴 파싱]:
  //    예: "폴리스티렌-graft-폴리프로필렌", "PS-b-PP-g-PE", "[고분자A] -block- [고분자B] -graft- [고분자C]"
  const formulaCore = text
    .replace(/^poly\(/i, "")
    .replace(/\)$/i, "")
    .replace(/(?:공중합체|고분자|사슬|구조식|구조|만들어줘|생성해줘|그려줘|보여줘|렌더링해줘|합성해줘|설계해줘|해줘)\s*$/g, "")
    .trim();

  const connectorRegex =
    /(?:\s*-\s*(graft|block|random|alternating|stat|ran|blk|alt|co|g|b|r|그라프트|그래프트|가지형|가지|블록|랜덤|교대|교호)\s*-\s*|\s+(graft|block|random|alternating|그라프트|그래프트|가지형|블록|랜덤|교대|교호)\s+)/gi;

  const connectors: Array<"graft" | "block" | "random" | "alternating"> = [];
  const rawSegments: string[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = connectorRegex.exec(formulaCore)) !== null) {
    const seg = formulaCore.slice(lastIndex, match.index).trim();
    if (seg) rawSegments.push(seg);
    const connToken = match[1] || match[2] || "graft";
    connectors.push(normalizeConnectorToken(connToken));
    lastIndex = match.index + match[0].length;
  }

  if (connectors.length > 0) {
    const tailSeg = formulaCore.slice(lastIndex).trim();
    if (tailSeg) rawSegments.push(tailSeg);

    if (rawSegments.length >= 2) {
      const resolvedList: PolymerComponentMeta[] = [];
      rawSegments.forEach((seg, idx) => {
        const res = resolvePolymerComponent(seg, idx);
        if (res) resolvedList.push(res);
      });

      if (resolvedList.length >= 2) {
        const validConnectors = connectors.slice(0, resolvedList.length - 1);
        while (validConnectors.length < resolvedList.length - 1) {
          validConnectors.push(validConnectors[validConnectors.length - 1] || "graft");
        }
        return createParsedCopolymerResult(resolvedList, validConnectors, text);
      }
    }
  }

  // 2. [자연어 다중 고분자 + 공중합 키워드 파싱]:
  //    예: "폴리스티렌과 폴리프로필렌의 그라프트 공중합체", "PS와 PP 가지형 공중합", "폴리스티렌/폴리프로필렌 블록"
  const foundPolymers: Array<{ pos: number; entry: PolymerDictEntry }> = [];
  for (const entry of POLYMER_COMPONENT_DICTIONARY) {
    let earliestPos = Infinity;
    for (const alias of entry.aliases) {
      const al = alias.toLowerCase();
      // 영문 2~3글자 약어(ps, pp, pe, pu, pc, pa, br, ir, an)는 단어 경계 확인
      if (/^[a-z]{2,3}$/i.test(al)) {
        const re = new RegExp(`(?:^|[^a-z0-9])(${al})(?=$|[^a-z0-9])`, "i");
        const m = re.exec(lower);
        if (m && m.index < earliestPos) {
          earliestPos = m.index;
        }
      } else {
        const idx = lower.indexOf(al);
        if (idx !== -1 && idx < earliestPos) {
          earliestPos = idx;
        }
      }
    }
    if (earliestPos !== Infinity) {
      foundPolymers.push({ pos: earliestPos, entry });
    }
  }

  foundPolymers.sort((a, b) => a.pos - b.pos);

  if (foundPolymers.length >= 2) {
    let defaultConn: "graft" | "block" | "random" | "alternating" = "block";
    if (lower.includes("graft") || lower.includes("그라프트") || lower.includes("그래프트") || lower.includes("가지")) {
      defaultConn = "graft";
    } else if (lower.includes("block") || lower.includes("블록")) {
      defaultConn = "block";
    } else if (lower.includes("alt") || lower.includes("교대") || lower.includes("교호")) {
      defaultConn = "alternating";
    } else if (lower.includes("random") || lower.includes("랜덤") || lower.includes("-co-")) {
      defaultConn = "random";
    } else if (lower.includes("-g-")) {
      defaultConn = "graft";
    }

    const componentDetails: PolymerComponentMeta[] = foundPolymers.map((fp, idx) => ({
      id: fp.entry.id,
      canonical: fp.entry.canonical,
      koreanName: fp.entry.koreanName,
      shortName: fp.entry.shortName,
      color: DOMAIN_COLORS[idx % DOMAIN_COLORS.length],
    }));

    const inferredConnectors: Array<"graft" | "block" | "random" | "alternating"> = [];
    for (let i = 0; i < componentDetails.length - 1; i++) {
      // 만약 텍스트에 블록과 그래프트가 둘 다 언급되면 첫 연결은 block, 두 번째는 graft로 배정
      if (
        componentDetails.length >= 3 &&
        (lower.includes("block") || lower.includes("블록")) &&
        (lower.includes("graft") || lower.includes("그라프트") || lower.includes("그래프트") || lower.includes("가지"))
      ) {
        inferredConnectors.push(i === 0 ? "block" : "graft");
      } else {
        inferredConnectors.push(defaultConn);
      }
    }

    return createParsedCopolymerResult(componentDetails, inferredConnectors, text);
  }

  return null;
}

/**
 * 3D 공간의 임의 진행 방향(dir)과 법선 방향(pendantDir)을 따라
 * 특정 고분자(PS, PP, PE, PMMA, PET, PA, PVC, PAN, PTFE, BR 등)의 반복 단량체 사슬 세그먼트를 조립
 */
function buildMonomerSegment3D(options: {
  polyMeta: PolymerComponentMeta;
  unitCount: number;
  startPos: { x: number; y: number; z: number };
  dir: { x: number; y: number; z: number };
  pendantDir: { x: number; y: number; z: number };
  prefix: string;
  isGraftBranch?: boolean;
  domainLabel?: string;
  anchorAtomId?: string;
  linkType?: "block" | "graft";
  atoms: AtomNode[];
  bonds: BondEdge[];
  highlightAtomIds: string[];
  highlightBondIds: string[];
}): {
  lastBackboneAtomId: string;
  endPos: { x: number; y: number; z: number };
  backboneAnchorAtoms: AtomNode[];
} {
  const {
    polyMeta,
    unitCount,
    startPos,
    dir,
    pendantDir,
    prefix,
    isGraftBranch = false,
    domainLabel,
    anchorAtomId,
    linkType,
    atoms,
    bonds,
    highlightAtomIds,
    highlightBondIds,
  } = options;

  // 방향 벡터 정규화
  const dLen = Math.sqrt(dir.x * dir.x + dir.y * dir.y + dir.z * dir.z) || 1;
  const ux = dir.x / dLen;
  const uy = dir.y / dLen;
  const uz = dir.z / dLen;

  const pLen = Math.sqrt(pendantDir.x * pendantDir.x + pendantDir.y * pendantDir.y + pendantDir.z * pendantDir.z) || 1;
  const nx = pendantDir.x / pLen;
  const ny = pendantDir.y / pLen;
  const nz = pendantDir.z / pLen;

  // 외적 벡터 (3차원 깊이 흔들림 연출용)
  const bx = uy * nz - uz * ny;
  const by = uz * nx - ux * nz;
  const bz = ux * ny - uy * nx;

  const stepDist = 40; // ~1.48 Å
  let curX = startPos.x;
  let curY = startPos.y;
  let curZ = startPos.z;
  let prevBackboneId = anchorAtomId || "";
  const backboneAnchorAtoms: AtomNode[] = [];

  for (let u = 0; u < unitCount; u++) {
    const zigSign = u % 2 === 0 ? 1 : -1;
    // 1) 첫 번째 주쇄 원자 (CH2 또는 헤테로 원자)
    curX += ux * stepDist + nx * zigSign * 12 + bx * zigSign * 10;
    curY += uy * stepDist + ny * zigSign * 12 + by * zigSign * 10;
    curZ += uz * stepDist + nz * zigSign * 12 + bz * zigSign * 10;

    const c1Symbol: AtomSymbol =
      polyMeta.id === "nylon66" && u % 2 === 0
        ? "N"
        : polyMeta.id === "peg" || polyMeta.id === "pet" || polyMeta.id === "pu"
        ? u % 2 === 0
          ? "O"
          : "C"
        : "C";

    const c1Id = `${prefix}_u${u}_bb1`;
    const isFirstJunction = u === 0 && Boolean(anchorAtomId);
    const labelUnitIdx = Math.floor(unitCount / 2);

    const c1Node: AtomNode = {
      id: c1Id,
      symbol: c1Symbol,
      x: Math.round(curX),
      y: Math.round(curY),
      z: Math.round(curZ),
      domainColor: polyMeta.color,
      isGraftBranch,
      isJunction: isFirstJunction,
      domainLabel: u === labelUnitIdx ? domainLabel : undefined,
    };
    atoms.push(c1Node);
    if (isGraftBranch || isFirstJunction) highlightAtomIds.push(c1Id);

    if (prevBackboneId) {
      const b1Id = `b_${prefix}_u${u}_link1`;
      const isJunctionBond = u === 0 && Boolean(anchorAtomId);
      bonds.push({
        id: b1Id,
        sourceId: prevBackboneId,
        targetId: c1Id,
        type: "single",
        domainColor: isJunctionBond ? "#f43f5e" : polyMeta.color,
        isGraftLink: isJunctionBond && linkType === "graft",
        isBlockLink: isJunctionBond && linkType === "block",
      });
      if (isGraftBranch || isJunctionBond) highlightBondIds.push(b1Id);
    }

    // 2) 두 번째 주쇄 원자 (치환기가 결합되는 주쇄 탄소)
    curX += ux * stepDist - nx * zigSign * 12 - bx * zigSign * 10;
    curY += uy * stepDist - ny * zigSign * 12 - by * zigSign * 10;
    curZ += uz * stepDist - nz * zigSign * 12 - bz * zigSign * 10;

    const c2Id = `${prefix}_u${u}_bb2`;
    const c2Node: AtomNode = {
      id: c2Id,
      symbol: "C",
      x: Math.round(curX),
      y: Math.round(curY),
      z: Math.round(curZ),
      domainColor: polyMeta.color,
      isGraftBranch,
    };
    atoms.push(c2Node);
    backboneAnchorAtoms.push(c2Node);
    if (isGraftBranch) highlightAtomIds.push(c2Id);

    const b2Id = `b_${prefix}_u${u}_bb`;
    bonds.push({
      id: b2Id,
      sourceId: c1Id,
      targetId: c2Id,
      type: polyMeta.id === "polybutadiene" || polyMeta.id === "polyisoprene" ? "double" : "single",
      domainColor: polyMeta.color,
    });
    if (isGraftBranch) highlightBondIds.push(b2Id);

    // 3) 고분자 종류별 특징적 곁사슬(Pendant Group) 3D 조립
    const pSign = u % 2 === 0 ? 1 : -1;
    const px = nx * 0.85 + bx * pSign * 0.52;
    const py = ny * 0.85 + by * pSign * 0.52;
    const pz = nz * 0.85 + bz * pSign * 0.52;

    if (polyMeta.id === "ps" || polyMeta.id === "pet" || polyMeta.id === "aramid" || polyMeta.id === "pc") {
      // 폴리스티렌(PS) 등: 6원환 방향족 벤젠 고리(Phenyl Ring) 부착
      const ringRadius = 34;
      const ringCenterDist = 66;
      const rcX = curX + px * ringCenterDist;
      const rcY = curY + py * ringCenterDist;
      const rcZ = curZ + pz * ringCenterDist;

      const ringIds: string[] = [];
      for (let r = 0; r < 6; r++) {
        const ang = (Math.PI / 3) * r + Math.PI;
        const cosA = Math.cos(ang);
        const sinA = Math.sin(ang);
        const rx = rcX + (px * cosA + ux * sinA) * ringRadius;
        const ry = rcY + (py * cosA + uy * sinA) * ringRadius;
        const rz = rcZ + (pz * cosA + uz * sinA + (r % 2 === 0 ? 0.12 : -0.12)) * ringRadius;
        const rId = `${prefix}_u${u}_ph_${r}`;
        ringIds.push(rId);
        atoms.push({
          id: rId,
          symbol: "C",
          x: Math.round(rx),
          y: Math.round(ry),
          z: Math.round(rz),
          domainColor: polyMeta.color,
          isGraftBranch,
        });
      }

      bonds.push({
        id: `b_${prefix}_u${u}_ph_stem`,
        sourceId: c2Id,
        targetId: ringIds[0],
        type: "single",
        domainColor: polyMeta.color,
      });

      for (let r = 0; r < 6; r++) {
        bonds.push({
          id: `b_${prefix}_u${u}_ph_r${r}`,
          sourceId: ringIds[r],
          targetId: ringIds[(r + 1) % 6],
          type: r % 2 === 0 ? "double" : "single",
          domainColor: polyMeta.color,
        });
      }
    } else if (polyMeta.id === "pp" || polyMeta.id === "polyisoprene" || polyMeta.id === "pla") {
      // 폴리프로필렌(PP): 메틸기(-CH3) 곁가지 부착
      const meId = `${prefix}_u${u}_me`;
      const mx = curX + px * 42;
      const my = curY + py * 42;
      const mz = curZ + pz * 42;
      atoms.push({
        id: meId,
        symbol: "C",
        x: Math.round(mx),
        y: Math.round(my),
        z: Math.round(mz),
        domainColor: polyMeta.color,
        isGraftBranch,
      });
      bonds.push({
        id: `b_${prefix}_u${u}_me`,
        sourceId: c2Id,
        targetId: meId,
        type: "single",
        domainColor: polyMeta.color,
      });
      if (isGraftBranch) {
        highlightAtomIds.push(meId);
      }
    } else if (polyMeta.id === "pmma" || polyMeta.id === "pvac") {
      // PMMA / PVAc: 에스테르 카르보닐기(-C(=O)-O-CH3)
      const cEstId = `${prefix}_u${u}_cest`;
      const oDblId = `${prefix}_u${u}_odbl`;
      const oMeId = `${prefix}_u${u}_ome`;
      const ex = curX + px * 42;
      const ey = curY + py * 42;
      const ez = curZ + pz * 42;
      atoms.push(
        { id: cEstId, symbol: "C", x: Math.round(ex), y: Math.round(ey), z: Math.round(ez), domainColor: polyMeta.color, isGraftBranch },
        { id: oDblId, symbol: "O", x: Math.round(ex + ux * 26), y: Math.round(ey + uy * 26 - 20), z: Math.round(ez + 18), isGraftBranch },
        { id: oMeId, symbol: "O", x: Math.round(ex + px * 32), y: Math.round(ey + py * 32), z: Math.round(ez + pz * 32), isGraftBranch }
      );
      bonds.push(
        { id: `b_${cEstId}`, sourceId: c2Id, targetId: cEstId, type: "single", domainColor: polyMeta.color },
        { id: `b_${oDblId}`, sourceId: cEstId, targetId: oDblId, type: "double", domainColor: polyMeta.color },
        { id: `b_${oMeId}`, sourceId: cEstId, targetId: oMeId, type: "single", domainColor: polyMeta.color }
      );
    } else if (polyMeta.id === "pvc") {
      // PVC: 염소(-Cl) 원자 부착
      const clId = `${prefix}_u${u}_cl`;
      atoms.push({
        id: clId,
        symbol: "Cl",
        x: Math.round(curX + px * 44),
        y: Math.round(curY + py * 44),
        z: Math.round(curZ + pz * 44),
        isGraftBranch,
      });
      bonds.push({
        id: `b_${clId}`,
        sourceId: c2Id,
        targetId: clId,
        type: "single",
        domainColor: polyMeta.color,
      });
    } else if (polyMeta.id === "pan") {
      // PAN: 시아노기(-C≡N) 부착
      const cnC = `${prefix}_u${u}_cnc`;
      const cnN = `${prefix}_u${u}_cnn`;
      atoms.push(
        { id: cnC, symbol: "C", x: Math.round(curX + px * 38), y: Math.round(curY + py * 38), z: Math.round(curZ + pz * 38), domainColor: polyMeta.color, isGraftBranch },
        { id: cnN, symbol: "N", x: Math.round(curX + px * 70), y: Math.round(curY + py * 70), z: Math.round(curZ + pz * 70), isGraftBranch }
      );
      bonds.push(
        { id: `b_${cnC}`, sourceId: c2Id, targetId: cnC, type: "single", domainColor: polyMeta.color },
        { id: `b_${cnN}`, sourceId: cnC, targetId: cnN, type: "triple", domainColor: polyMeta.color }
      );
    } else if (polyMeta.id === "ptfe") {
      // PTFE: 불소(-F) 치환기 부착
      const f1Id = `${prefix}_u${u}_f1`;
      const f2Id = `${prefix}_u${u}_f2`;
      atoms.push(
        { id: f1Id, symbol: "F", x: Math.round(curX + px * 38), y: Math.round(curY + py * 38), z: Math.round(curZ + 22), isGraftBranch },
        { id: f2Id, symbol: "F", x: Math.round(curX - px * 38), y: Math.round(curY - py * 38), z: Math.round(curZ - 22), isGraftBranch }
      );
      bonds.push(
        { id: `b_${f1Id}`, sourceId: c2Id, targetId: f1Id, type: "single", domainColor: polyMeta.color },
        { id: `b_${f2Id}`, sourceId: c2Id, targetId: f2Id, type: "single", domainColor: polyMeta.color }
      );
    } else if (polyMeta.id === "nylon66" || polyMeta.id === "pu") {
      // 나일론/폴리우레탄: 카르보닐 산소(=O) 부착
      const oxId = `${prefix}_u${u}_ox`;
      atoms.push({
        id: oxId,
        symbol: "O",
        x: Math.round(curX + px * 38),
        y: Math.round(curY + py * 38),
        z: Math.round(curZ + pz * 38),
        isGraftBranch,
      });
      bonds.push({
        id: `b_${oxId}`,
        sourceId: c2Id,
        targetId: oxId,
        type: "double",
        domainColor: polyMeta.color,
      });
    } else {
      // PE 등 기본 지방족 사슬: 입체감을 위한 C-H 치환기 표시
      const h1Id = `${prefix}_u${u}_h1`;
      atoms.push({
        id: h1Id,
        symbol: "H",
        x: Math.round(curX + px * 30),
        y: Math.round(curY + py * 30),
        z: Math.round(curZ + pz * 30),
        isGraftBranch,
      });
      bonds.push({
        id: `b_${h1Id}`,
        sourceId: c2Id,
        targetId: h1Id,
        type: "single",
        domainColor: polyMeta.color,
      });
    }

    prevBackboneId = c2Id;
  }

  return {
    lastBackboneAtomId: prevBackboneId,
    endPos: { x: curX, y: curY, z: curZ },
    backboneAnchorAtoms,
  };
}

/**
 * [핵심 요구사항 2] 파싱된 공중합 JSON 구조(ParsedCopolymerStructure)를 받아
 * 3D 공간에서 블록 굴절(Block Kink) 및 가지 분기(Graft Branching)가 명확히 보이도록 사슬 모델을 재조립
 */
export function buildCopolymer3DFromParsedStructure(parsed: ParsedCopolymerStructure): {
  atoms: AtomNode[];
  bonds: BondEdge[];
  highlightAtomIds: string[];
  highlightBondIds: string[];
} {
  const atoms: AtomNode[] = [];
  const bonds: BondEdge[] = [];
  const highlightAtomIds: string[] = [];
  const highlightBondIds: string[] = [];

  const { componentDetails, connectors, structure_type } = parsed;
  if (componentDetails.length === 0) {
    const fallback = generateBenzeneFlexibleChain();
    return { ...fallback, highlightAtomIds: [], highlightBondIds: [] };
  }

  // 1) Random 또는 Alternating 구조: 단일 굴곡 사슬을 따라 단량체들을 교대/혼합 배치
  if (structure_type === "random" || structure_type === "alternating") {
    const totalUnits = 8;
    let curPos = { x: 60, y: 200, z: 0 };
    let lastAtomId = "";

    for (let u = 0; u < totalUnits; u++) {
      const compIdx =
        structure_type === "alternating"
          ? u % componentDetails.length
          : (u * 3 + 1) % componentDetails.length;
      const comp = componentDetails[compIdx];

      const waveAngle = Math.sin(u * 0.9) * 0.35;
      const segRes = buildMonomerSegment3D({
        polyMeta: comp,
        unitCount: 1,
        startPos: curPos,
        dir: { x: 1.0, y: waveAngle, z: Math.cos(u * 0.9) * 0.25 },
        pendantDir: { x: 0, y: u % 2 === 0 ? 1 : -1, z: u % 2 === 0 ? 0.4 : -0.4 },
        prefix: `co_${u}_${comp.id}`,
        domainLabel:
          u === 1
            ? `단위A: ${componentDetails[0].koreanName}(${componentDetails[0].shortName})`
            : u === 4 && componentDetails[1]
            ? `단위B: ${componentDetails[1].koreanName}(${componentDetails[1].shortName})`
            : undefined,
        anchorAtomId: lastAtomId || undefined,
        linkType: "block",
        atoms,
        bonds,
        highlightAtomIds,
        highlightBondIds,
      });

      curPos = segRes.endPos;
      lastAtomId = segRes.lastBackboneAtomId;
    }

    return { atoms, bonds, highlightAtomIds, highlightBondIds };
  }

  // 2) Block, Graft, 또는 Multi-Block-Graft 복합 구조 분리:
  //    - 첫 번째 성분은 항상 주사슬(Backbone Block 1)
  //    - connector가 "block"인 성분은 주사슬 말단에서 3D 각도로 꺾여 이어지는 후속 블록(Backbone Block 2, 3...)
  //    - connector가 "graft"인 성분은 주사슬 중간 앵커 포인트들에서 Y/Z축 방향으로 뻗어 나오는 가지 사슬(Graft Branches)
  const backboneComponents: PolymerComponentMeta[] = [componentDetails[0]];
  const graftComponents: PolymerComponentMeta[] = [];

  for (let i = 1; i < componentDetails.length; i++) {
    const conn = connectors[i - 1] || "graft";
    if (conn === "graft") {
      graftComponents.push(componentDetails[i]);
    } else {
      backboneComponents.push(componentDetails[i]);
    }
  }

  // 각 주사슬 블록의 3D 진행 방향 (블록 간 접합부에서 눈에 띄게 꺾이는 3D 각도 연출)
  const blockDirections = [
    { x: 1.0, y: 0.12, z: 0.08 },
    { x: 0.78, y: -0.55, z: 0.30 },
    { x: 0.82, y: 0.48, z: -0.32 },
    { x: 0.88, y: -0.42, z: -0.22 },
  ];

  let curPos = { x: 40, y: 220, z: 0 };
  let prevBlockTailId = "";
  const allBackboneAnchors: AtomNode[] = [];

  // 2-A) 주사슬(Backbone) 블록 순차 조립
  const unitsPerBlock = backboneComponents.length === 1 ? 6 : 4;
  backboneComponents.forEach((bbComp, bIdx) => {
    const dir = blockDirections[bIdx % blockDirections.length];
    const blockTitle =
      backboneComponents.length === 1
        ? `주사슬(Backbone): ${bbComp.koreanName}(${bbComp.shortName})`
        : `Block ${bIdx + 1}: ${bbComp.koreanName}(${bbComp.shortName})`;

    const seg = buildMonomerSegment3D({
      polyMeta: bbComp,
      unitCount: unitsPerBlock,
      startPos: curPos,
      dir,
      pendantDir: { x: -dir.y * 0.4, y: 1.0, z: -0.45 }, // 주사슬 곁기(벤젠 등)는 아래쪽으로 배치하여 상단 Graft 가지와 간섭 방지
      prefix: `bb_blk${bIdx}_${bbComp.id}`,
      isGraftBranch: false,
      domainLabel: blockTitle,
      anchorAtomId: prevBlockTailId || undefined,
      linkType: "block",
      atoms,
      bonds,
      highlightAtomIds,
      highlightBondIds,
    });

    curPos = seg.endPos;
    prevBlockTailId = seg.lastBackboneAtomId;
    allBackboneAnchors.push(...seg.backboneAnchorAtoms);
  });

  // 2-B) Graft(가지형) 곁가지 사슬들을 주사슬 앵커 원자에서 3D 공간의 위/앞/뒤 대각선으로 뻗어 나오게 조립!
  if (graftComponents.length > 0 && allBackboneAnchors.length > 0) {
    // 시각적으로 뚜렷하게 뻗어 나가는 3D 가지(Graft Branch) 방향 벡터들
    const branchDirections = [
      { dir: { x: 0.22, y: -0.92, z: 0.32 }, pendant: { x: 0.85, y: 0.15, z: 0.50 } },
      { dir: { x: -0.24, y: -0.88, z: -0.40 }, pendant: { x: -0.80, y: 0.15, z: 0.55 } },
      { dir: { x: 0.32, y: 0.86, z: 0.38 }, pendant: { x: 0.82, y: -0.20, z: -0.52 } },
      { dir: { x: -0.18, y: -0.90, z: 0.42 }, pendant: { x: 0.88, y: 0.20, z: -0.42 } },
    ];

    // 주사슬 길이에 맞춰 2~3개의 Graft 가지를 분기 생성
    const anchorIndices =
      allBackboneAnchors.length >= 6
        ? [1, 3, 5]
        : allBackboneAnchors.length >= 4
        ? [1, 3]
        : [0, Math.max(0, allBackboneAnchors.length - 1)];

    anchorIndices.forEach((anchorIdx, brNum) => {
      const anchorNode = allBackboneAnchors[Math.min(anchorIdx, allBackboneAnchors.length - 1)];
      if (!anchorNode) return;
      anchorNode.isJunction = true;
      highlightAtomIds.push(anchorNode.id);

      const graftComp = graftComponents[brNum % graftComponents.length];
      const brVec = branchDirections[brNum % branchDirections.length];

      buildMonomerSegment3D({
        polyMeta: graftComp,
        unitCount: 3,
        startPos: { x: anchorNode.x, y: anchorNode.y, z: anchorNode.z || 0 },
        dir: brVec.dir,
        pendantDir: brVec.pendant,
        prefix: `graft_br${brNum}_${graftComp.id}`,
        isGraftBranch: true,
        domainLabel: `Graft 가지 #${brNum + 1}: ${graftComp.koreanName}(${graftComp.shortName})`,
        anchorAtomId: anchorNode.id,
        linkType: "graft",
        atoms,
        bonds,
        highlightAtomIds,
        highlightBondIds,
      });
    });
  }

  return { atoms, bonds, highlightAtomIds, highlightBondIds };
}

/**
 * [핵심 파서] 자연어 프롬프트 ➔ 3D 분자 구조 생성 및 실시간 수정 엔진
 */
export function parseChatPrompt(
  prompt: string,
  currentAtoms: AtomNode[],
  currentBonds: BondEdge[]
): ParseResult {
  const text = prompt.trim();
  const lower = text.toLowerCase();
  const now = new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  let newAtoms: AtomNode[] = currentAtoms.map((a) => ({ ...a }));
  let newBonds: BondEdge[] = currentBonds.map((b) => ({ ...b }));
  let actionType: ChatActionType = "create";
  let actionBadge = "3D 분자 구조 렌더링 완료";
  const params: ChatMessage["parameters"] = {};
  const highlightAtoms: string[] = [];
  const highlightBonds: string[] = [];
  let assistantReply = "";
  const followUps: string[] = [];

  // ─────────────────────────────────────────────────────────────
  // 0-A. [최우선 인터셉터] 복합 공중합 구조식 / 자연어 조합 즉시 가로채기!
  //      예: "폴리스티렌-graft-폴리프로필렌", "PS-b-PP-g-PE"
  // ─────────────────────────────────────────────────────────────
  const interceptedCopolymer = interceptPolymerStructureFormula(prompt);
  const complexParams = extractComplexParameters(prompt);

  if (interceptedCopolymer) {
    actionType = "create";
    let built = buildCopolymer3DFromParsedStructure(interceptedCopolymer);
    if (complexParams.terminalGroup && complexParams.terminalGroup !== "none") {
      const capped = attachTerminalCap(built.atoms, built.bonds, complexParams.terminalGroup);
      built = { ...built, atoms: capped.atoms, bonds: capped.bonds };
    }
    newAtoms = built.atoms;
    newBonds = built.bonds;
    highlightAtoms.push(...built.highlightAtomIds);
    highlightBonds.push(...built.highlightBondIds);

    complexParams.copolymerType = interceptedCopolymer.structure_type;
    complexParams.comonomers = interceptedCopolymer.components;

    const shortFormula = interceptedCopolymer.componentDetails
      .map((c, idx) => {
        if (idx === 0) return c.shortName;
        const conn = interceptedCopolymer.connectors[idx - 1];
        const sym = conn === "graft" ? "g" : conn === "block" ? "b" : conn === "alternating" ? "alt" : "co";
        return `-${sym}-${c.shortName}`;
      })
      .join("");

    actionBadge = `${shortFormula} (${interceptedCopolymer.architecture}) 3D 렌더링 완료`;
    assistantReply = `${interceptedCopolymer.systemMessage}

\`\`\`json
${interceptedCopolymer.jsonString}
\`\`\`

- **주사슬 & 분기 아키텍처**: \`${shortFormula}\` (\`${interceptedCopolymer.architecture}\`)
- **구성 성분**: ${interceptedCopolymer.componentDetails
      .map((c) => `**${c.koreanName}**(\`${c.canonical}\`)`)
      .join(" + ")}
- **3D 모델링 반영**: 총 **${newAtoms.length}개 원자**와 **${newBonds.length}개 결합**으로 구성된 3차원 ${
      interceptedCopolymer.structure_type === "graft"
        ? "주사슬(Backbone) 및 곁가지(Graft Branches) 분기"
        : interceptedCopolymer.structure_type === "block"
        ? "다중 블록 굴절(Block Junction)"
        : "공중합 사슬"
    } 구조가 Three.js 뷰어에 즉시 조립되었습니다.`;

    followUps.push(
      "구조 에너지 최소화(Relaxation)",
      "말단에 친수성 하이드록시기(-OH) 붙여줘",
      "중앙 결합 거리를 늘려주고 각도를 120도로 맞춰줘"
    );
  } else {
    // A. 비정상 / 무의미 입력 방어 (asdf, ㅋㅋㅋ, ㅎㅎ, 1234, ㅁㄴㅇㄹ, 공백/단일 문자 등)
    const isMeaningless =
      /^(asdf|qwer|zxcv|1234|test|ㅁㄴㅇㄹ|ㅂㅈㄷㄱ|ㅋ+|ㅎ+|ㅠ+|ㅜ+|!+|\?+|\.+)$/i.test(text) ||
      /^[ㄱ-ㅎㅏ-ㅣ]+$/.test(text) ||
      text.length < 2;

    // B. 일반 인사 및 사용법/도움말 질문
    // ※ "하이드록시(hydroxy)" 작용기 명령어가 인사말 "하이"로 오인되지 않도록 방어
    const isGreetingOrCasual =
      !lower.includes("하이드록시") &&
      !lower.includes("-oh") &&
      !complexParams.molecularWeight &&
      !complexParams.copolymerType &&
      (
        lower.includes("안녕") ||
        lower.includes("반가") ||
        /(^|\s)하이([!?,~]|\s|$)/.test(text) ||
        /\b(hello|hi|help)\b/i.test(text) ||
        lower.includes("누구") ||
        lower.includes("너는") ||
        lower.includes("소개") ||
        lower.includes("어떻게 써") ||
        lower.includes("사용법") ||
        lower.includes("도움말") ||
        lower.includes("뭐할 수 있어") ||
        lower.includes("기능 설명")
      );

    if (isMeaningless) {
      actionType = "chat";
      actionBadge = "입력 가이드";
      assistantReply = `원하시는 고분자 구조나 수정 명령을 구체적으로 말씀해 주세요! 💡

**복합 공중합 구조식 / 파라미터 추천 예시:**
- 🧬 \`"폴리스티렌-graft-폴리프로필렌"\`
- 🌿 \`"PS-b-PP-g-PE"\`
- 📏 \`"중앙 결합 거리를 늘려주고 각도를 120도로 맞춰줘"\``;
      followUps.push(
        "폴리스티렌-graft-폴리프로필렌",
        "PS-b-PP-g-PE",
        "중앙 결합 거리를 늘려주고 각도를 120도로 맞춰줘"
      );
    } else if (isGreetingOrCasual) {
      actionType = "chat";
      actionBadge = "AI 연구원 안내";
      assistantReply = `안녕하세요! 🧪 저는 **PolyMatrix AI 수석 화학 연구원**입니다. 
고분자 신소재 설계 및 3D 분자 구조 모델링을 실시간으로 보조하고 있습니다.

원하시는 작업이나 고분자 구조식을 입력하시면 즉시 중앙 **Three.js 3D 뷰어**에 렌더링하고 물성을 분석해 드립니다:
1. **복합 공중합 구조식**: *"폴리스티렌-graft-폴리프로필렌"*, *"PS-b-PP-g-PE"*
2. **다변수 역설계**: *"분자량 45,000 블록 공중합체, 말단 -OH, 목표 Tg 180도"*
3. **원자 기하 변형**: *"결합 거리를 1.8Å로 늘려줘"*, *"각도를 120도로 맞춰줘"*
4. **구조 최적화**: *"에너지 최소화 및 입체 이완(Relaxation) 해줘"*`;
      followUps.push(
        "폴리스티렌-graft-폴리프로필렌",
        "PS-b-PP-g-PE",
        "분자량 45000 블록 공중합체, 말단 -OH, 목표 Tg 180도 설계해줘"
      );
    }
    // ─────────────────────────────────────────────────────────────
    // 1. [복합 공중합체 동적 3D 프리셋 생성] 블록 / 랜덤 / 그래프트 공중합체
    // ─────────────────────────────────────────────────────────────
    else if (complexParams.copolymerType === "graft") {
      actionType = "create";
      const defaultGraft = interceptPolymerStructureFormula("폴리스티렌-graft-폴리프로필렌")!;
      const built = buildCopolymer3DFromParsedStructure(defaultGraft);
      newAtoms = built.atoms;
      newBonds = built.bonds;
      highlightAtoms.push(...built.highlightAtomIds);
      highlightBonds.push(...built.highlightBondIds);
      actionBadge = `그래프트 공중합체 3D 설계`;
      assistantReply = defaultGraft.systemMessage;
      followUps.push("PS-b-PP-g-PE", "구조 에너지 최소화(Relaxation)", "말단에 친수성 하이드록시기(-OH) 붙여줘");
    } else if (complexParams.copolymerType === "block") {
      actionType = "create";
      const gen = generateBlockCopolymer(complexParams.terminalGroup, 2);
      newAtoms = gen.atoms;
      newBonds = gen.bonds;
      actionBadge = `블록 공중합체 3D 설계 (말단: -${complexParams.terminalGroup || "OH"})`;
      assistantReply = `✨ [시스템] 방향족 하드 블록과 폴리에테르 소프트 블록의 Block(블록형) 공중합체 구조 파싱 완료. 3D 뷰어를 갱신합니다.

- **구조 배좌**: 강직한 방향족 하드 세그먼트와 유연한 폴리에테르 소프트 세그먼트가 마이크로 상분리(Microphase Separation) 도메인을 형성하도록 배치했습니다.
- **말단 엔드캡**: 양 말단 사이트에 요청하신 **-${complexParams.terminalGroup || "OH"}** 작용기를 3D 공유결합으로 정밀 앵커링했습니다.
- **분자량 & 중합도**: 목표 분자량 **${(complexParams.molecularWeight || 45000).toLocaleString()} g/mol** 기준 최적 중합도와 다차원 물성 매칭 지표를 계산했습니다.`;
      followUps.push(
        "폴리스티렌-graft-폴리프로필렌",
        "PS-b-PP-g-PE",
        "구조 에너지 최소화(Relaxation)"
      );
    } else if (complexParams.copolymerType === "random") {
      actionType = "create";
      const gen = generateRandomCopolymer(complexParams.terminalGroup, 10);
      newAtoms = gen.atoms;
      newBonds = gen.bonds;
      actionBadge = `랜덤 공중합체 3D 설계 (말단: -${complexParams.terminalGroup || "COOH"})`;
      assistantReply = `✨ [시스템] 다성분 단량체의 Random(랜덤형) 공중합체 구조 파싱 완료. 3D 뷰어를 갱신합니다.

- **단량체 분포**: 상이한 성질의 단량체 단위가 주쇄를 따라 불규칙하게 배열된 무정형(Amorphous) 랜덤 코일 입체 배좌를 구현했습니다.
- **말단 작용기**: 양 말단에 **-${complexParams.terminalGroup || "COOH"}** 기능기를 결합하여 반응성을 확보했습니다.
- **분자량 & 거동**: 목표 분자량 **${(complexParams.molecularWeight || 30000).toLocaleString()} g/mol**에 맞춘 다차원 열·역학 물성치가 산출되었습니다.`;
      followUps.push(
        "폴리스티렌-graft-폴리프로필렌",
        "PS-b-PP-g-PE",
        "구조 에너지 최소화(Relaxation)"
      );
    }
    // ─────────────────────────────────────────────────────────────
    // 2. [단일 고분자 사슬 생성: PS, PP, PMMA, PVC, PAN, PTFE, BR 등 포함]
    // ─────────────────────────────────────────────────────────────
    else if (
      lower.includes("폴리스티렌") ||
      lower.includes("polystyrene") ||
      /\bps\b/i.test(text) ||
      lower.includes("폴리프로필렌") ||
      lower.includes("polypropylene") ||
      /\bpp\b/i.test(text) ||
      lower.includes("pmma") ||
      lower.includes("폴리메틸메타크릴레이트") ||
      lower.includes("pvc") ||
      lower.includes("폴리염화비닐") ||
      lower.includes("pan") ||
      lower.includes("폴리아크릴로니트릴") ||
      lower.includes("ptfe") ||
      lower.includes("테프론") ||
      lower.includes("폴리부타디엔") ||
      /\bbr\b/i.test(text)
    ) {
      const comp = resolvePolymerComponent(text, 0) || {
        id: "ps",
        canonical: "polystyrene",
        koreanName: "폴리스티렌",
        shortName: "PS",
        color: "#f59e0b",
      };
      const singleAtoms: AtomNode[] = [];
      const singleBonds: BondEdge[] = [];
      const hAtoms: string[] = [];
      const hBonds: string[] = [];
      buildMonomerSegment3D({
        polyMeta: comp,
        unitCount: 6,
        startPos: { x: 40, y: 200, z: 0 },
        dir: { x: 1.0, y: 0.08, z: 0.05 },
        pendantDir: { x: 0, y: 1.0, z: 0.35 },
        prefix: `homo_${comp.id}`,
        domainLabel: `단일 사슬(Homopolymer): ${comp.koreanName}(${comp.shortName})`,
        atoms: singleAtoms,
        bonds: singleBonds,
        highlightAtomIds: hAtoms,
        highlightBondIds: hBonds,
      });
      newAtoms = singleAtoms;
      newBonds = singleBonds;
      actionBadge = `${comp.koreanName}(${comp.shortName}) 3D 사슬 생성`;
      assistantReply = `✨ [시스템] ${comp.koreanName}(${comp.shortName}) 단일 중합체 3D 사슬 구조 파싱 완료. 3D 뷰어를 갱신합니다.`;
      followUps.push(
        "폴리스티렌-graft-폴리프로필렌",
        "PS-b-PP-g-PE",
        "말단에 친수성 하이드록시기(-OH) 붙여줘"
      );
    }
    // A. 벤젠 고리 + 유연한 사슬 하이브리드
    else if (
      (lower.includes("벤젠") || lower.includes("benzene") || lower.includes("고리")) &&
      (lower.includes("유연") || lower.includes("사슬") || lower.includes("하이브리드") || lower.includes("에테르"))
    ) {
      const gen = generateBenzeneFlexibleChain();
      newAtoms = gen.atoms;
      newBonds = gen.bonds;
      actionBadge = "방향족-유연사슬 하이브리드 3D 생성";
      assistantReply = `✨ [시스템] 벤젠 고리가 포함된 유연한 고분자 사슬 3D 구조 파싱 완료. 3D 뷰어를 갱신합니다.
- **방향족 코어(Aromatic Ring)**: $\\pi$-$\\pi$ 강직한 공액 평면 골격으로 인장강도와 내열성을 제공합니다.
- **유연성 에테르 링커(Flexible Spacer)**: $-O-CH_2-CH_2-$ 사슬의 회전 자유도를 통해 우수한 드레이프성을 유도합니다.`;
      followUps.push(
        "폴리스티렌-graft-폴리프로필렌",
        "PS-b-PP-g-PE",
        "중앙 결합 거리를 늘려주고 각도를 120도로 맞춰줘"
      );
    }
    // B. 단순/순수 벤젠 (Benzene Ring)
    else if (lower.includes("벤젠") || lower.includes("benzene") || lower.includes("페닐") || lower.includes("phenyl")) {
      const gen = generatePureBenzene();
      newAtoms = gen.atoms;
      newBonds = gen.bonds;
      actionBadge = "벤젠(Benzene, C₆H₆) 3D 구조 생성";
      assistantReply = `✨ [시스템] 벤젠(Benzene, C₆H₆) 6원환 방향족 구조 파싱 완료. 3D 뷰어를 갱신합니다.`;
      followUps.push("폴리스티렌-graft-폴리프로필렌", "벤젠 고리가 포함된 유연한 고분자 사슬 구조 만들어줘", "말단에 친수성 하이드록시기(-OH) 붙여줘");
    }
    // C. 나일론 / 폴리아미드 (Nylon / Polyamide)
    else if (lower.includes("나일론") || lower.includes("폴리아미드") || lower.includes("nylon") || lower.includes("pa66") || lower.includes("pa6")) {
      const gen = generateNylonChain();
      newAtoms = gen.atoms;
      newBonds = gen.bonds;
      actionBadge = "나일론-6,6 (Nylon 6,6) 3D 사슬 생성";
      assistantReply = `✨ [시스템] 나일론-6,6(Nylon 6,6) 폴리아미드 사슬 구조 파싱 완료. 3D 뷰어를 갱신합니다.`;
      followUps.push("폴리스티렌-graft-폴리프로필렌", "결합 거리를 늘려줘", "각도를 120도로 맞춰줘");
    }
    // D. 폴리에스터 / PET
    else if (lower.includes("pet") || lower.includes("폴리에스터") || lower.includes("polyester") || lower.includes("테레프탈") || lower.includes("에스테르")) {
      const gen = generatePETChain();
      newAtoms = gen.atoms;
      newBonds = gen.bonds;
      actionBadge = "폴리에스터(PET) 3D 분자 구조 생성";
      assistantReply = `✨ [시스템] 폴리에틸렌 테레프탈레이트(PET) 3D 분자 구조 파싱 완료. 3D 뷰어를 갱신합니다.`;
      followUps.push("폴리스티렌-graft-폴리프로필렌", "중앙 결합 거리를 늘려줘", "말단에 친수성 하이드록시기(-OH) 붙여줘");
    }
    // E. 아라미드 / 케블라 (Aramid / Kevlar)
    else if (lower.includes("아라미드") || lower.includes("케블라") || lower.includes("aramid") || lower.includes("kevlar") || lower.includes("방탄")) {
      const gen = generateAramidChain();
      newAtoms = gen.atoms;
      newBonds = gen.bonds;
      actionBadge = "초고강도 아라미드(Kevlar) 3D 사슬 생성";
      assistantReply = `✨ [시스템] 초고강도 방향족 폴리아미드(Kevlar-like) 공액 사슬 구조 파싱 완료. 3D 뷰어를 갱신합니다.`;
      followUps.push("폴리스티렌-graft-폴리프로필렌", "중앙 결합 길이를 늘려줘", "각도를 120도로 맞춰줘");
    }
    // F. 폴리에틸렌 (PE) / 알킬 사슬
    else if (lower.includes("폴리에틸렌") || lower.includes("pe") || lower.includes("알킬") || lower.includes("지그재그") || lower.includes("탄소 사슬")) {
      const gen = generatePolyethyleneChain(8);
      newAtoms = gen.atoms;
      newBonds = gen.bonds;
      actionBadge = "폴리에틸렌(PE) 3D 지그재그 사슬 생성";
      assistantReply = `✨ [시스템] 선형 폴리에틸렌(PE) 지그재그 3D 사슬 구조 파싱 완료. 3D 뷰어를 갱신합니다.`;
      followUps.push("PS-b-PP-g-PE", "결합 길이를 1.8Å로 늘려줘", "말단에 하이드록시기(-OH) 추가해줘");
    }
    // G. 폴리우레탄 (PU)
    else if (lower.includes("폴리우레탄") || lower.includes("우레탄") || lower.includes("pu") || lower.includes("polyurethane") || lower.includes("탄성체")) {
      const gen = generatePolyurethaneChain();
      newAtoms = gen.atoms;
      newBonds = gen.bonds;
      actionBadge = "폴리우레탄(PU) 3D 탄성 고분자 사슬 생성";
      assistantReply = `✨ [시스템] 고탄성 폴리우레탄(Polyurethane) 세그먼트 구조 파싱 완료. 3D 뷰어를 갱신합니다.`;
      followUps.push("폴리스티렌-graft-폴리프로필렌", "결합 길이를 1.8Å로 늘려줘", "구조 에너지 최소화");
    }
    // H. 물 분자 (H2O)
    else if (lower.includes("물") || lower.includes("water") || lower.includes("h2o")) {
      const gen = generateWaterMolecule();
      newAtoms = gen.atoms;
      newBonds = gen.bonds;
      actionBadge = "물(H₂O) 3D 분자 구조 생성";
      assistantReply = `💧 **물($H_2O$) 3D 분자 모형**을 생성했습니다. 산소 원자 중심의 굽은형($104.5^\\circ$) 기하 구조입니다.`;
      followUps.push("에탄올 분자 만들어줘", "폴리스티렌-graft-폴리프로필렌");
    }
    // I. 에탄올 (Ethanol)
    else if (lower.includes("에탄올") || lower.includes("ethanol") || lower.includes("알코올")) {
      const gen = generateEthanolMolecule();
      newAtoms = gen.atoms;
      newBonds = gen.bonds;
      actionBadge = "에탄올(C₂H₅OH) 3D 분자 구조 생성";
      assistantReply = `🍷 **에탄올($CH_3-CH_2-OH$) 3D 분자 구조**를 렌더링했습니다. 메틸기, 메틸렌기, 친수성 하이드록시기로 구성됩니다.`;
      followUps.push("결합 거리 늘려줘", "폴리스티렌-graft-폴리프로필렌");
    }
    // J. 메탄 (CH4)
    else if (lower.includes("메탄") || lower.includes("methane") || lower.includes("ch4")) {
      const gen = generateMethaneMolecule();
      newAtoms = gen.atoms;
      newBonds = gen.bonds;
      actionBadge = "메탄(CH₄) 3D 사면체 구조 생성";
      assistantReply = `🧊 **메탄($CH_4$) 3D 정사면체 모델**을 생성했습니다. 결합각 $109.5^\\circ$의 가장 기본 탄화수소입니다.`;
      followUps.push("폴리에틸렌 사슬 만들어줘", "폴리스티렌-graft-폴리프로필렌");
    }
    // K. 아스피린 / 카페인 / 포도당 등 대표 유기분자 프리셋
    else if (lower.includes("아스피린") || lower.includes("aspirin")) {
      const p = presetTo3D("aspirin") || generateBenzeneFlexibleChain();
      newAtoms = p.atoms;
      newBonds = p.bonds;
      actionBadge = "아스피린(Aspirin, C₉H₈O₄) 3D 렌더링";
      assistantReply = `💊 **아스피린(아세틸살리실산) 3D 분자 구조**를 렌더링했습니다.`;
      followUps.push("결합 길이 조정해줘", "폴리스티렌-graft-폴리프로필렌");
    } else if (lower.includes("카페인") || lower.includes("caffeine")) {
      const p = presetTo3D("caffeine") || generateBenzeneFlexibleChain();
      newAtoms = p.atoms;
      newBonds = p.bonds;
      actionBadge = "카페인(Caffeine) 3D 퓨린 골격 렌더링";
      assistantReply = `☕ **카페인(Caffeine) 3D 알칼로이드 분자**를 Three.js 뷰어에 렌더링했습니다.`;
      followUps.push("구조 에너지 최소화", "폴리스티렌-graft-폴리프로필렌");
    } else if (lower.includes("포도당") || lower.includes("글루코오스") || lower.includes("glucose") || lower.includes("셀룰로오스")) {
      const p = presetTo3D("glucose") || generateBenzeneFlexibleChain();
      newAtoms = p.atoms;
      newBonds = p.bonds;
      actionBadge = "D-글루코오스 3D 고리 구조 생성";
      assistantReply = `🌾 **D-포도당(Glucose) 피라노오스 고리 3D 모델**을 렌더링했습니다.`;
      followUps.push("결합 거리 늘려줘", "폴리스티렌-graft-폴리프로필렌");
    }
    // ─────────────────────────────────────────────────────────────
    // 3. [수정 명령] 결합 길이 조정 (늘려, 줄여, 1.8Å, 1.6Å 등)
    // ─────────────────────────────────────────────────────────────
    else if (
      lower.includes("결합 거리") ||
      lower.includes("결합 길이") ||
      lower.includes("결합거리") ||
      lower.includes("결합길이") ||
      lower.includes("bond length") ||
      lower.includes("거리 늘려") ||
      lower.includes("길이 늘려") ||
      lower.includes("길이 줄여") ||
      lower.includes("거리 줄여") ||
      lower.includes("늘려주고") ||
      lower.includes("늘려줘")
    ) {
      actionType = "modify_length";
      const numMatch = text.match(/([0-9]+\.?[0-9]*)\s*(å|a|angstrom|옹스트롬|속|도)?/i);
      let targetAng: number | undefined = undefined;
      if (numMatch && parseFloat(numMatch[1]) > 0.8 && parseFloat(numMatch[1]) < 3.5) {
        targetAng = parseFloat(numMatch[1]);
      }

      const isShrink = lower.includes("줄여") || lower.includes("축소") || lower.includes("짧게");
      const scale = isShrink ? 0.82 : 1.25;

      const mod = modifyBondLength(newAtoms, newBonds, targetAng, scale);
      newAtoms = mod.atoms;
      newBonds = mod.bonds;
      params.bondLength = mod.appliedLength;
      params.targetBond = mod.targetBondId;
      highlightBonds.push(mod.targetBondId);
      actionBadge = `결합 길이 실시간 조정: ${mod.appliedLength} Å`;

      assistantReply = `📏 **분자 주쇄의 결합 거리(Bond Length)를 ${mod.appliedLength} Å(으)로 즉시 신축 변형**했습니다!
- 결합 원자 간의 거리가 변경됨에 따라 Three.js 3D 뷰어 속 실시간 치수 라벨과 안정성 지표가 함께 갱신되었습니다.`;
      followUps.push("각도를 120도로 맞춰줘", "말단에 친수성 하이드록시기(-OH) 붙여줘", "구조 에너지 최소화(Relaxation)");
    }
    // ─────────────────────────────────────────────────────────────
    // 4. [수정 명령] 결합 각도 조정 (120도, 109.5도, 90도, 180도 등)
    // ─────────────────────────────────────────────────────────────
    else if (
      lower.includes("각도") ||
      lower.includes("angle") ||
      lower.includes("꺾어") ||
      lower.includes("구부려") ||
      lower.includes("맞춰") ||
      lower.includes("120") ||
      lower.includes("109.5")
    ) {
      actionType = "modify_angle";
      let targetAngle = 120;
      if (text.includes("109.5") || lower.includes("사면체") || lower.includes("sp3")) {
        targetAngle = 109.5;
      } else if (text.includes("120") || lower.includes("sp2") || lower.includes("평면")) {
        targetAngle = 120;
      } else if (text.includes("90") || lower.includes("직각")) {
        targetAngle = 90;
      } else if (text.includes("180") || lower.includes("선형")) {
        targetAngle = 180;
      } else {
        const angleMatch = text.match(/([0-9]{2,3})\s*(도|deg)?/);
        if (angleMatch) targetAngle = parseFloat(angleMatch[1]);
      }

      const mod = modifyBondAngle(newAtoms, newBonds, targetAngle);
      newAtoms = mod.atoms;
      newBonds = mod.bonds;
      params.angle = targetAngle;
      highlightAtoms.push(mod.vertexAtomId);
      actionBadge = `결합 각도 조절: ${targetAngle}°`;

      assistantReply = `📐 **중심 결합 각도(Bond Angle)를 ${targetAngle}°로 3차원 회전 배치**했습니다!
- 3D 뷰어의 회전 각도 치수 표시와 함께 원자 좌표의 공간 기하가 즉각 반영되었습니다.`;
      followUps.push("중앙 결합 거리를 늘려줘", "구조 에너지 최소화 및 3D 이완", "말단에 친수성 하이드록시기(-OH) 붙여줘");
    }
    // ─────────────────────────────────────────────────────────────
    // 5. [수정 명령] 작용기 부착 및 치환 (-OH, -COOH, -NH2, -F, -Cl, -CH3)
    // ─────────────────────────────────────────────────────────────
    else if (
      lower.includes("작용기") ||
      lower.includes("붙여") ||
      lower.includes("추가") ||
      lower.includes("치환") ||
      lower.includes("하이드록시") ||
      lower.includes("-oh") ||
      lower.includes("카르복실") ||
      lower.includes("-cooh") ||
      lower.includes("아민") ||
      lower.includes("-nh2") ||
      lower.includes("불소") ||
      lower.includes("염소") ||
      lower.includes("메틸")
    ) {
      actionType = "functional_group";
      let grp: "OH" | "COOH" | "NH2" | "CH3" | "F" | "Cl" = "OH";

      if (lower.includes("카르복실") || lower.includes("-cooh") || lower.includes("산성")) grp = "COOH";
      else if (lower.includes("아민") || lower.includes("-nh2") || lower.includes("질소")) grp = "NH2";
      else if (lower.includes("불소") || lower.includes("-f") || lower.includes("fluorine")) grp = "F";
      else if (lower.includes("염소") || lower.includes("-cl") || lower.includes("chlorine")) grp = "Cl";
      else if (lower.includes("메틸") || lower.includes("-ch3") || lower.includes("가지")) grp = "CH3";

      const mod = attachFunctionalGroup(newAtoms, newBonds, grp);
      newAtoms = mod.atoms;
      newBonds = mod.bonds;
      highlightAtoms.push(...mod.addedAtomIds);
      params.group = grp;
      actionBadge = `작용기 부착: -${grp}`;

      assistantReply = `🧪 **말단 사이트에 기능성 작용기(-${grp})를 3D 결합**했습니다!
- 분자량 증가 및 극성 헤테로 원소 도입으로 계면 반응성과 물성이 실시간으로 업데이트되었습니다.`;
      followUps.push("구조 에너지 최소화 및 안정화", "중앙 결합 거리를 늘려주고 각도를 120도로 맞춰줘");
    }
    // ─────────────────────────────────────────────────────────────
    // 6. [수정 명령] 구조 최적화 및 이완 (Relaxation)
    // ─────────────────────────────────────────────────────────────
    else if (
      lower.includes("최적화") ||
      lower.includes("에너지") ||
      lower.includes("안정화") ||
      lower.includes("relax") ||
      lower.includes("이완")
    ) {
      actionType = "optimize";
      const mod = relaxMolecularGeometry(newAtoms, newBonds);
      newAtoms = mod.atoms;
      newBonds = mod.bonds;
      actionBadge = "3D 구조 이완 및 에너지 최소화 완료";

      assistantReply = `⚡ **분자 역학(MM) 기반 3D 입체 스트레인 완화 및 에너지 최소화**를 완료했습니다!
- 비정상적인 결합 길이 편차와 원자 간 척력(Steric Clash)을 해소하여 열역학적으로 가장 안정적인 배좌로 수렴했습니다.`;
      followUps.push("폴리스티렌-graft-폴리프로필렌", "PS-b-PP-g-PE");
    }
    // ─────────────────────────────────────────────────────────────
    // 7. [그 외 구조/고분자 입력 시 Action-First 강제 렌더링]
    // ─────────────────────────────────────────────────────────────
    else {
      actionType = "create";
      const customParsed = createParsedCopolymerResult(
        [
          resolvePolymerComponent(text, 0) || {
            id: "ps",
            canonical: "polystyrene",
            koreanName: "폴리스티렌",
            shortName: "PS",
            color: "#f59e0b",
          },
          {
            id: "pp",
            canonical: "polypropylene",
            koreanName: "폴리프로필렌",
            shortName: "PP",
            color: "#38bdf8",
          },
        ],
        ["graft"],
        text
      );
      const built = buildCopolymer3DFromParsedStructure(customParsed);
      newAtoms = built.atoms;
      newBonds = built.bonds;
      highlightAtoms.push(...built.highlightAtomIds);
      highlightBonds.push(...built.highlightBondIds);
      actionBadge = `${customParsed.architecture} 3D 구조 즉시 생성`;
      assistantReply = `${customParsed.systemMessage}\n\n\`\`\`json\n${customParsed.jsonString}\n\`\`\``;
      followUps.push(
        "폴리스티렌-graft-폴리프로필렌",
        "PS-b-PP-g-PE",
        "중앙 결합 거리를 늘려주고 각도를 120도로 맞춰줘"
      );
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 화학 디스크립터, 유효성 검증, R&D 가치 평가 통합 산출
  // ─────────────────────────────────────────────────────────────
  const descriptor = calculateMolecularDescriptor(newAtoms, newBonds);
  const validation = validateMolecularStructure(newAtoms, newBonds);
  const strainEnergyKcal = calculateStrainEnergy(newAtoms, newBonds);
  const { score: overallScore, grade } = computeResearchViability(descriptor, validation, strainEnergyKcal);

  let sumBondPx = 0;
  newBonds.forEach((b) => {
    const a1 = newAtoms.find((a) => a.id === b.sourceId);
    const a2 = newAtoms.find((a) => a.id === b.targetId);
    if (a1 && a2) {
      const dx = a2.x - a1.x;
      const dy = a2.y - a1.y;
      const dz = (a2.z || 0) - (a1.z || 0);
      sumBondPx += Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
  });
  const avgBondLengthAngstrom = newBonds.length > 0
    ? Math.round((sumBondPx / newBonds.length) * PX_TO_ANGSTROM * 100) / 100
    : 1.54;

  // 다차원 복합 물성 연동 계산
  const { predicted, dp } = calculateComplexProperties(descriptor, complexParams);
  complexParams.predictedProperties = predicted;
  complexParams.polymerizationDegree = dp;

  params.molecularWeight = complexParams.molecularWeight;
  params.copolymerType = complexParams.copolymerType;
  params.terminalGroup = complexParams.terminalGroup;
  params.dp = dp;

  const chatMessage: ChatMessage = {
    id: `msg_${Date.now()}`,
    sender: "assistant",
    text: assistantReply,
    timestamp: now,
    actionType,
    actionBadge,
    parameters: params,
    complexParams,
    parsedCopolymer: interceptedCopolymer || undefined,
    metricsDelta: {
      mw: complexParams.molecularWeight || Math.round(descriptor.monomerMW * 10) / 10,
      strainEnergy: strainEnergyKcal,
      grade,
      score: overallScore,
      avgBondLength: avgBondLengthAngstrom,
      bondAngle: params.angle || 120,
      tenacity: predicted.tenacity,
      tg: predicted.tg,
      modulus: predicted.modulus,
      elongation: predicted.elongation,
      dp,
      targetMatchScore: predicted.targetMatchScore,
    },
    suggestedFollowUps: followUps,
    highlightAtomIds: highlightAtoms,
    highlightBondIds: highlightBonds,
  };

  return {
    message: chatMessage,
    atoms: newAtoms,
    bonds: newBonds,
    descriptor,
    validation,
    overallScore,
    grade,
    strainEnergyKcal,
    avgBondLengthAngstrom,
    complexParams,
    parsedCopolymer: interceptedCopolymer || undefined,
  };
}
