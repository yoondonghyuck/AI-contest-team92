import type { AtomNode, BondEdge } from "../components/MolDrawCanvas";

// 원자별 표준 원자량 (Standard Atomic Weight, g/mol)
const ATOMIC_WEIGHTS: Record<string, number> = {
  C: 12.011,
  O: 15.999,
  N: 14.007,
  H: 1.008,
};

export interface MolecularDescriptor {
  totalAtoms: number;
  carbonCount: number;
  oxygenCount: number;
  nitrogenCount: number;
  hydrogenCount: number;
  totalBonds: number;
  singleBonds: number;
  doubleBonds: number;
  doubleBondRatio: number; // 이중 결합 비율 (0.0 ~ 1.0)
  heteroatomRatio: number; // 산소/질소 등 극성 헤테로 원자 비율 (0.0 ~ 1.0)
  oxygenRatio: number; // 산소 비율 (0.0 ~ 1.0)
  monomerMW: number; // 단량체 추정 분자량 (g/mol)
  rigidityScore: number; // 이중결합/불포화도 기반 사슬 강직도 점수 (0.0 ~ 1.0)
  polarityScore: number; // 수소결합/극성 작용기 점수 (0.0 ~ 1.0)
  estimatedTg: number; // 스케치 구조 기반 추정 Tg (℃)
  estimatedTm: number; // 스케치 구조 기반 추정 Tm (℃)
  formula: string; // Hill system 분자식 표기
}

/**
 * 2D/3D 스케치 노드 및 엣지 데이터를 분석하여 화학 물리 디스크립터를 계산
 */
export function calculateMolecularDescriptor(
  atoms: AtomNode[],
  bonds: BondEdge[]
): MolecularDescriptor {
  if (atoms.length === 0) {
    return {
      totalAtoms: 0,
      carbonCount: 0,
      oxygenCount: 0,
      nitrogenCount: 0,
      hydrogenCount: 0,
      totalBonds: 0,
      singleBonds: 0,
      doubleBonds: 0,
      doubleBondRatio: 0,
      heteroatomRatio: 0,
      oxygenRatio: 0,
      monomerMW: 0,
      rigidityScore: 0,
      polarityScore: 0,
      estimatedTg: 0,
      estimatedTm: 0,
      formula: "None",
    };
  }

  // 1. 원자 개수 집계
  const carbonCount = atoms.filter((a) => a.symbol === "C").length;
  const oxygenCount = atoms.filter((a) => a.symbol === "O").length;
  const nitrogenCount = atoms.filter((a) => a.symbol === "N").length;
  const hydrogenCount = atoms.filter((a) => a.symbol === "H").length;
  const totalAtoms = atoms.length;

  // 2. 결합 개수 집계
  const totalBonds = bonds.length;
  const singleBonds = bonds.filter((b) => b.type === "single").length;
  const doubleBonds = bonds.filter((b) => b.type === "double").length;

  // 이중 결합 비율 (결합이 없을 경우 0)
  const doubleBondRatio = totalBonds > 0 ? Number((doubleBonds / totalBonds).toFixed(3)) : 0;

  // 산소 및 헤테로 원소(O, N) 비율
  const oxygenRatio = Number((oxygenCount / totalAtoms).toFixed(3));
  const heteroatomRatio = Number(((oxygenCount + nitrogenCount) / totalAtoms).toFixed(3));

  // 3. 화학 분자량 (Monomer MW) 계산
  let rawMW = 0;
  atoms.forEach((a) => {
    rawMW += ATOMIC_WEIGHTS[a.symbol] || ATOMIC_WEIGHTS.C;
  });

  // 스켈레탈 드로잉 특성상 수소(H)가 생략된 경우를 고려한 자동 포화 수소 보정 (탄소 원자가 4가, 산소 2가, 질소 3가)
  if (hydrogenCount === 0 && (carbonCount > 0 || nitrogenCount > 0)) {
    // 결합 차수 합산으로 미충족 원자가 계산
    const valenceMap = new Map<string, number>();
    atoms.forEach((a) => valenceMap.set(a.id, 0));
    bonds.forEach((b) => {
      const order = b.type === "double" ? 2 : 1;
      valenceMap.set(b.sourceId, (valenceMap.get(b.sourceId) || 0) + order);
      valenceMap.set(b.targetId, (valenceMap.get(b.targetId) || 0) + order);
    });

    let implicitHCount = 0;
    atoms.forEach((a) => {
      const usedValence = valenceMap.get(a.id) || 0;
      const maxValence = a.symbol === "C" ? 4 : a.symbol === "N" ? 3 : a.symbol === "O" ? 2 : 1;
      const freeValence = Math.max(0, maxValence - usedValence);
      implicitHCount += freeValence;
    });

    rawMW += implicitHCount * ATOMIC_WEIGHTS.H;
  }

  const monomerMW = Number(Math.max(12.0, rawMW).toFixed(1));

  // 4. 강직도 점수 (Rigidity Score, 0 ~ 1)
  // 이중 결합 비율이 높고 단일 결합 회전 자유도가 낮을수록 사슬 강직도 상승
  const rigidityScore = Number(
    Math.min(1.0, doubleBondRatio * 1.5 + (carbonCount > 0 ? (carbonCount / totalAtoms) * 0.2 : 0)).toFixed(3)
  );

  // 5. 극성/수소결합 점수 (Polarity Score, 0 ~ 1)
  // 산소와 질소 비율이 높을수록 염색 흡착성 및 친수성 극대화
  const polarityScore = Number(
    Math.min(1.0, oxygenRatio * 1.8 + (nitrogenCount / totalAtoms) * 2.2).toFixed(3)
  );

  // 6. 추정 Tg (유리전이온도) 및 Tm (융점)
  // 사슬 강직도와 분자량이 높을수록 Tg 상승
  const baseTg = 40 + rigidityScore * 110 + polarityScore * 40;
  const estimatedTg = Math.round(baseTg);
  const estimatedTm = Math.round(baseTg + 120 + rigidityScore * 60);

  // 7. 분자식 문자열 생성 (Hill System)
  const formulaParts: string[] = [];
  if (carbonCount > 0) formulaParts.push(`C${carbonCount > 1 ? carbonCount : ""}`);
  if (hydrogenCount > 0) formulaParts.push(`H${hydrogenCount > 1 ? hydrogenCount : ""}`);
  if (nitrogenCount > 0) formulaParts.push(`N${nitrogenCount > 1 ? nitrogenCount : ""}`);
  if (oxygenCount > 0) formulaParts.push(`O${oxygenCount > 1 ? oxygenCount : ""}`);
  const formula = formulaParts.length > 0 ? formulaParts.join("") : "Empty";

  return {
    totalAtoms,
    carbonCount,
    oxygenCount,
    nitrogenCount,
    hydrogenCount,
    totalBonds,
    singleBonds,
    doubleBonds,
    doubleBondRatio,
    heteroatomRatio,
    oxygenRatio,
    monomerMW,
    rigidityScore,
    polarityScore,
    estimatedTg,
    estimatedTm,
    formula,
  };
}
