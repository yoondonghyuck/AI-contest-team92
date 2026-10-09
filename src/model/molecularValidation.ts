/**
 * 분자 화학적 유효성 검증 및 자동 오류 교정 엔진 (Cheminformatics Molecular Validation & Auto-Fix Engine)
 * 
 * 1. 원자가 규칙 검증 (Valence Check: Texas Carbon 방지, O/N/H/할로겐 최대 결합수)
 * 2. 결합 기하 구조 검증 (Geometry Check: 픽셀-Å 환산 결합 길이 왜곡, 3원자 각도 스트레인)
 *    - 고분자 반복 단위(PE, PET 등) 2D 투영 구조 및 손으로 그린 사슬이 오탐되지 않도록 정교화
 * 3. 위상학적 무결성 (자체 결합, 다중 중복 결합, 원자 중첩)
 * 4. 자동 오류 교정 (Auto-Fix): 원자가 초과 결합 정리, 비정상적 결합 길이 표준화(55px), 중복/자기 결합 제거
 */

import type { AtomNode, BondEdge, AtomSymbol } from "../components/MolDrawCanvas";

export type ValidationSeverity = "error" | "warning";

export interface ValidationErrorItem {
  id: string;
  type: "valence" | "bond_length" | "bond_angle" | "self_loop" | "overlap" | "duplicate_bond" | "empty";
  severity: ValidationSeverity;
  title: string;
  message: string;
  details: string;
  atomIds?: string[];
  bondIds?: string[];
}

export interface AtomValenceReport {
  atomId: string;
  symbol: AtomSymbol;
  currentValence: number;
  maxValence: number;
  isValid: boolean;
  excess: number;
}

export interface MolecularValidationResult {
  isValid: boolean; // error가 0건일 때 true (warning만 있을 때는 true)
  errors: ValidationErrorItem[];
  warnings: ValidationErrorItem[];
  valenceReports: AtomValenceReport[];
  invalidAtomIds: Set<string>;
  invalidBondIds: Set<string>;
  warningAtomIds: Set<string>;
  warningBondIds: Set<string>;
  stats: {
    totalAtoms: number;
    totalBonds: number;
    avgBondLengthPx: number;
    avgBondLengthAngstrom: number;
    minBondLengthPx: number;
    maxBondLengthPx: number;
  };
}

export interface AutoFixResult {
  fixedAtoms: AtomNode[];
  fixedBonds: BondEdge[];
  fixCount: number;
  fixDescriptions: string[];
}

// 캔버스 픽셀 -> 실제 화학 결합 길이(Å) 근사 환산 계수
// 캔버스 기준 표준 단일결합 = 약 55px ≒ 1.50 Å (C-C 결합 약 1.54 Å)
export const PIXEL_TO_ANGSTROM_RATIO = 1.50 / 55.0; // ~0.02727 Å/px

// 원소별 최대 허용 원자가 (Maximum Allowed Valence in Organic Chemistry)
export const MAX_VALENCE_LIMITS: Record<AtomSymbol, { max: number; standard: number; label: string }> = {
  C: { max: 4, standard: 4, label: "탄소 (최대 4가)" },
  O: { max: 2, standard: 2, label: "산소 (최대 2가)" },
  N: { max: 4, standard: 3, label: "질소 (중성 3가, 사차암모늄 4가)" },
  H: { max: 1, standard: 1, label: "수소 (최대 1가)" },
  F: { max: 1, standard: 1, label: "불소 (최대 1가)" },
  Cl: { max: 1, standard: 1, label: "염소 (최대 1가)" },
  S: { max: 6, standard: 2, label: "황 (최대 6가 - 황산/술폰)" },
};

/**
 * 2D 분자 구조의 화학적/기하학적 유효성을 전수 검사
 */
export function validateMolecularStructure(
  atoms: AtomNode[],
  bonds: BondEdge[]
): MolecularValidationResult {
  const errors: ValidationErrorItem[] = [];
  const warnings: ValidationErrorItem[] = [];
  const invalidAtomIds = new Set<string>();
  const invalidBondIds = new Set<string>();
  const warningAtomIds = new Set<string>();
  const warningBondIds = new Set<string>();

  // 0. 빈 분자 검사
  if (atoms.length === 0) {
    errors.push({
      id: "err-empty",
      type: "empty",
      severity: "error",
      title: "분자 구조 부재",
      message: "캔버스에 원자가 배치되지 않았습니다.",
      details: "원소를 선택하여 2D 캔버스에 최소 1개 이상의 원자를 배치하세요.",
    });
    return {
      isValid: false,
      errors,
      warnings,
      valenceReports: [],
      invalidAtomIds,
      invalidBondIds,
      warningAtomIds,
      warningBondIds,
      stats: {
        totalAtoms: 0,
        totalBonds: 0,
        avgBondLengthPx: 0,
        avgBondLengthAngstrom: 0,
        minBondLengthPx: 0,
        maxBondLengthPx: 0,
      },
    };
  }

  const atomMap = new Map<string, AtomNode>(atoms.map((a) => [a.id, a]));

  // 1. 자체 결합(Self-loop) 및 중복 결합(Duplicate bond) 검사
  const seenPairBonds = new Map<string, string[]>();

  bonds.forEach((bond) => {
    // 1-1. 자기 결합
    if (bond.sourceId === bond.targetId) {
      errors.push({
        id: `err-self-loop-${bond.id}`,
        type: "self_loop",
        severity: "error",
        title: "비현실적인 자기 결합 (Self-Loop)",
        message: `동일한 원자(${bond.sourceId})에 연결된 불가능한 자기 결합입니다.`,
        details: "원자는 자기 자신과 화학 결합을 형성할 수 없습니다.",
        atomIds: [bond.sourceId],
        bondIds: [bond.id],
      });
      invalidBondIds.add(bond.id);
      invalidAtomIds.add(bond.sourceId);
    }

    // 1-2. 중복 결합 페어
    const pairKey = [bond.sourceId, bond.targetId].sort().join("<->");
    const existing = seenPairBonds.get(pairKey) || [];
    existing.push(bond.id);
    seenPairBonds.set(pairKey, existing);
  });

  seenPairBonds.forEach((bondIds, pairKey) => {
    if (bondIds.length > 1) {
      const [idA, idB] = pairKey.split("<->");
      errors.push({
        id: `err-dup-${pairKey}`,
        type: "duplicate_bond",
        severity: "error",
        title: "중복 결합 오류 (Duplicate Bonds)",
        message: `두 원자 간에 ${bondIds.length}개의 분리된 결합 선이 중복 등록되었습니다.`,
        details: "이중/삼중 결합은 별도의 결합선을 여러 개 긋지 말고 결합 도구(=, ≡)를 사용하세요.",
        atomIds: [idA, idB],
        bondIds,
      });
      bondIds.forEach((bId) => invalidBondIds.add(bId));
      invalidAtomIds.add(idA);
      invalidAtomIds.add(idB);
    }
  });

  // 2. 원자가 규칙 검증 (Valence Check)
  // 원자별 결합 차수(Bond Order) 총합 계산
  const atomBondOrders = new Map<string, number>();
  atoms.forEach((a) => atomBondOrders.set(a.id, 0));

  bonds.forEach((bond) => {
    if (bond.sourceId === bond.targetId) return; // 자체 결합은 이미 에러
    const order = bond.type === "triple" ? 3 : bond.type === "double" ? 2 : 1;
    atomBondOrders.set(bond.sourceId, (atomBondOrders.get(bond.sourceId) || 0) + order);
    atomBondOrders.set(bond.targetId, (atomBondOrders.get(bond.targetId) || 0) + order);
  });

  const valenceReports: AtomValenceReport[] = [];

  atoms.forEach((atom, idx) => {
    const curValence = atomBondOrders.get(atom.id) || 0;
    const limit = MAX_VALENCE_LIMITS[atom.symbol] || { max: 4, standard: 4, label: atom.symbol };
    const isValid = curValence <= limit.max;
    const excess = Math.max(0, curValence - limit.max);

    valenceReports.push({
      atomId: atom.id,
      symbol: atom.symbol,
      currentValence: curValence,
      maxValence: limit.max,
      isValid,
      excess,
    });

    if (!isValid) {
      invalidAtomIds.add(atom.id);
      errors.push({
        id: `err-valence-${atom.id}`,
        type: "valence",
        severity: "error",
        title: `원자가 규칙 위반: ${limit.label} 초과`,
        message: `${atom.symbol} 원자(#${idx + 1})에 ${curValence}개의 결합이 연결되어 최대 허용치(${limit.max}가)를 초과했습니다.`,
        details:
          atom.symbol === "C"
            ? "탄소(C)는 최외각 전자가 4개이므로 옥텟 규칙상 최대 4개의 공유 결합만 가능합니다 (5가 탄소/Texas Carbon 금지)."
            : atom.symbol === "O"
            ? "산소(O)는 중성 분자에서 최대 2개의 공유 결합만 허용됩니다."
            : atom.symbol === "H"
            ? "수소(H)는 전자 1개를 공유하여 단일 결합(1가)만 형성할 수 있습니다."
            : atom.symbol === "F" || atom.symbol === "Cl"
            ? "할로겐(F, Cl) 원소는 단일 결합(1가)만 가능합니다."
            : `${atom.symbol} 원소의 허용 원자가 한도를 확인하고 불필요한 결합을 제거하세요.`,
        atomIds: [atom.id],
      });
    }
  });

  // 3. 결합 길이 검증 (Bond Length & Distance Check)
  // 고분자 반복 단위 투영 및 자유 스케치를 포용하도록 오탐 방지 임계값 적용
  let totalLengthPx = 0;
  let minLengthPx = Infinity;
  let maxLengthPx = 0;

  bonds.forEach((bond) => {
    const src = atomMap.get(bond.sourceId);
    const tgt = atomMap.get(bond.targetId);
    if (!src || !tgt || bond.sourceId === bond.targetId) return;

    const distPx = Math.hypot(tgt.x - src.x, tgt.y - src.y);
    const distAngstrom = distPx * PIXEL_TO_ANGSTROM_RATIO;

    totalLengthPx += distPx;
    if (distPx < minLengthPx) minLengthPx = distPx;
    if (distPx > maxLengthPx) maxLengthPx = distPx;

    // 결합 길이가 비현실적으로 짧음 (원자핵 직접 충돌: < 14px ≒ < 0.38 Å)
    if (distPx < 14) {
      errors.push({
        id: `err-len-short-${bond.id}`,
        type: "bond_length",
        severity: "error",
        title: "비현실적인 결합 길이: 심각한 원자 충돌",
        message: `결합 길이가 ${distPx.toFixed(1)}px (~${distAngstrom.toFixed(2)}Å)로 극단적으로 짧아 원자핵이 충돌합니다.`,
        details: "공유 결합의 일반적 거리는 1.2Å ~ 1.6Å (약 45~60px)입니다. 원자를 드래그하여 거리를 넓혀주세요.",
        atomIds: [bond.sourceId, bond.targetId],
        bondIds: [bond.id],
      });
      invalidBondIds.add(bond.id);
      invalidAtomIds.add(bond.sourceId);
      invalidAtomIds.add(bond.targetId);
    }
    // 결합 길이가 비현실적으로 김 (물리적 단절 한계: > 220px ≒ > 6.0 Å)
    else if (distPx > 220) {
      errors.push({
        id: `err-len-long-${bond.id}`,
        type: "bond_length",
        severity: "error",
        title: "비현실적인 결합 길이: 비정상적 과신장 결합",
        message: `결합 거리가 ${distPx.toFixed(1)}px (~${distAngstrom.toFixed(2)}Å)로 터무니없이 멀리 떨어져 결합이 유지될 수 없습니다.`,
        details: "화학 결합이 끊어지는 거리(해리 한계)를 초과했습니다. 원자를 가깝게 배치하세요.",
        atomIds: [bond.sourceId, bond.targetId],
        bondIds: [bond.id],
      });
      invalidBondIds.add(bond.id);
      invalidAtomIds.add(bond.sourceId);
      invalidAtomIds.add(bond.targetId);
    }
    // 경고 수준의 왜곡 (26px 미만 또는 120px 초과)
    else if (distPx < 26 || distPx > 120) {
      warnings.push({
        id: `warn-len-${bond.id}`,
        type: "bond_length",
        severity: "warning",
        title: "결합 길이 왜곡 주의",
        message: `결합 길이(${distPx.toFixed(1)}px, ~${distAngstrom.toFixed(2)}Å)가 표준 길이(55px) 대비 다소 왜곡되었습니다.`,
        details: "자동 오류 제거(Auto-Fix)를 사용해 표준 길이로 교정할 수 있습니다.",
        atomIds: [bond.sourceId, bond.targetId],
        bondIds: [bond.id],
      });
      warningBondIds.add(bond.id);
    }
  });

  // 4. 비결합 원자 간의 공간적 중첩 검사 (Unbonded Spatial Overlap)
  for (let i = 0; i < atoms.length; i++) {
    for (let j = i + 1; j < atoms.length; j++) {
      const a1 = atoms[i];
      const a2 = atoms[j];
      const dist = Math.hypot(a2.x - a1.x, a2.y - a1.y);
      if (dist < 10) {
        // 직접 결합 여부 확인
        const isBonded = bonds.some(
          (b) =>
            (b.sourceId === a1.id && b.targetId === a2.id) ||
            (b.sourceId === a2.id && b.targetId === a1.id)
        );
        if (!isBonded) {
          errors.push({
            id: `err-overlap-${a1.id}-${a2.id}`,
            type: "overlap",
            severity: "error",
            title: "비결합 원자 위치 중첩 (Steric Clash)",
            message: `${a1.symbol}와 ${a2.symbol} 두 원자가 동일한 좌표에 겹쳐 있습니다 (${dist.toFixed(1)}px).`,
            details: "반데르발스 반경 충돌로 인해 실제 화학 구조에서 불가능한 배치입니다. 원자를 분리하세요.",
            atomIds: [a1.id, a2.id],
          });
          invalidAtomIds.add(a1.id);
          invalidAtomIds.add(a2.id);
        }
      }
    }
  }

  // 5. 결합 각도 검증 (Bond Angle Strain Check: 3원자 A-B-C 각도)
  // 중심 원자 B와 연결된 이웃 원자들 수집
  const neighborMap = new Map<string, string[]>();
  atoms.forEach((a) => neighborMap.set(a.id, []));
  bonds.forEach((b) => {
    if (b.sourceId === b.targetId) return;
    neighborMap.get(b.sourceId)?.push(b.targetId);
    neighborMap.get(b.targetId)?.push(b.sourceId);
  });

  atoms.forEach((centerAtom) => {
    const nbrs = neighborMap.get(centerAtom.id) || [];
    if (nbrs.length < 2) return;

    for (let i = 0; i < nbrs.length; i++) {
      for (let j = i + 1; j < nbrs.length; j++) {
        const n1 = atomMap.get(nbrs[i]);
        const n2 = atomMap.get(nbrs[j]);
        if (!n1 || !n2) return;

        const v1x = n1.x - centerAtom.x;
        const v1y = n1.y - centerAtom.y;
        const v2x = n2.x - centerAtom.x;
        const v2y = n2.y - centerAtom.y;

        const len1 = Math.hypot(v1x, v1y) || 1;
        const len2 = Math.hypot(v2x, v2y) || 1;

        const dot = (v1x * v2x + v1y * v2y) / (len1 * len2);
        const clampedDot = Math.max(-1, Math.min(1, dot));
        const angleRad = Math.acos(clampedDot);
        const angleDeg = (angleRad * 180) / Math.PI;

        // 극단적인 각도 찌그러짐 (< 18°: 2D 투영 오차를 감안한 임계값)
        if (angleDeg < 18.0) {
          errors.push({
            id: `err-angle-${centerAtom.id}-${n1.id}-${n2.id}`,
            type: "bond_angle",
            severity: "error",
            title: "비현실적인 결합 각도 (Severe Angle Strain)",
            message: `${centerAtom.symbol} 중심 결합 각도가 ${angleDeg.toFixed(1)}°로 극단적으로 찌그러져 있습니다.`,
            details: "원자 궤도함수 중첩이 불가능하며 전자 반발력으로 인해 결합이 존재할 수 없습니다.",
            atomIds: [centerAtom.id, n1.id, n2.id],
          });
          invalidAtomIds.add(centerAtom.id);
        } else if (angleDeg < 45.0) {
          warnings.push({
            id: `warn-angle-${centerAtom.id}-${n1.id}-${n2.id}`,
            type: "bond_angle",
            severity: "warning",
            title: "고리 스트레인 각도 주의",
            message: `${centerAtom.symbol} 중심 결합 각도(${angleDeg.toFixed(1)}°)가 좁아 각스트레인이 발생할 수 있습니다.`,
            details: "3원환 구조가 아니라면 결합 각도를 넓혀주세요.",
            atomIds: [centerAtom.id, n1.id, n2.id],
          });
          warningAtomIds.add(centerAtom.id);
        }
      }
    }
  });

  const avgBondLengthPx = bonds.length > 0 ? totalLengthPx / bonds.length : 0;

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    valenceReports,
    invalidAtomIds,
    invalidBondIds,
    warningAtomIds,
    warningBondIds,
    stats: {
      totalAtoms: atoms.length,
      totalBonds: bonds.length,
      avgBondLengthPx: Number(avgBondLengthPx.toFixed(1)),
      avgBondLengthAngstrom: Number((avgBondLengthPx * PIXEL_TO_ANGSTROM_RATIO).toFixed(2)),
      minBondLengthPx: minLengthPx === Infinity ? 0 : Number(minLengthPx.toFixed(1)),
      maxBondLengthPx: Number(maxLengthPx.toFixed(1)),
    },
  };
}

/**
 * [자동 오류 제거 (Auto-Fix)] 엔진
 * 1. 자기 결합(Self-loop) 제거
 * 2. 중복 결합 합치기
 * 3. 옥텟 원자가 초과 결합 다운그레이드 및 제거
 * 4. 심각한 원자 중첩 분리
 * 5. 비정상적 결합 길이 표준화(55px ≒ 1.50Å)
 */
export function autoFixMolecularStructure(
  atoms: AtomNode[],
  bonds: BondEdge[]
): AutoFixResult {
  let fixedAtoms: AtomNode[] = atoms.map((a) => ({ ...a }));
  let fixedBonds: BondEdge[] = bonds.map((b) => ({ ...b }));
  let fixCount = 0;
  const fixDescriptions: string[] = [];

  // 1. 자기 결합(Self-loop) 제거
  const prevBondCount = fixedBonds.length;
  fixedBonds = fixedBonds.filter((b) => b.sourceId !== b.targetId);
  const selfLoopsRemoved = prevBondCount - fixedBonds.length;
  if (selfLoopsRemoved > 0) {
    fixCount += selfLoopsRemoved;
    fixDescriptions.push(`불가능한 자기 결합 ${selfLoopsRemoved}개 제거`);
  }

  // 2. 중복 결합 합치기
  const pairMap = new Map<string, BondEdge[]>();
  fixedBonds.forEach((b) => {
    const key = [b.sourceId, b.targetId].sort().join("<->");
    const arr = pairMap.get(key) || [];
    arr.push(b);
    pairMap.set(key, arr);
  });

  const deduplicatedBonds: BondEdge[] = [];
  let dupCount = 0;
  pairMap.forEach((bondGroup) => {
    if (bondGroup.length === 1) {
      deduplicatedBonds.push(bondGroup[0]);
    } else {
      dupCount += bondGroup.length - 1;
      // 가장 높은 결합 차수 유지
      const hasTriple = bondGroup.some((b) => b.type === "triple");
      const hasDouble = bondGroup.some((b) => b.type === "double");
      const bestType = hasTriple ? "triple" : hasDouble ? "double" : "single";
      deduplicatedBonds.push({
        ...bondGroup[0],
        type: bestType,
      });
    }
  });
  if (dupCount > 0) {
    fixedBonds = deduplicatedBonds;
    fixCount += dupCount;
    fixDescriptions.push(`동일 원자 간 중복 결합 ${dupCount}개 통합`);
  }

  // 3. 비결합 원자 중첩(dist < 22px) 안전 분리
  for (let i = 0; i < fixedAtoms.length; i++) {
    for (let j = i + 1; j < fixedAtoms.length; j++) {
      const a1 = fixedAtoms[i];
      const a2 = fixedAtoms[j];
      const dist = Math.hypot(a2.x - a1.x, a2.y - a1.y);
      if (dist < 22) {
        const isBonded = fixedBonds.some(
          (b) =>
            (b.sourceId === a1.id && b.targetId === a2.id) ||
            (b.sourceId === a2.id && b.targetId === a1.id)
        );
        if (!isBonded) {
          // a2를 안전한 거리(50px)로 넉넉히 밀어냄
          const angle = Math.atan2(a2.y - a1.y, a2.x - a1.x) || (Math.PI / 4) * (j % 8);
          fixedAtoms[j] = {
            ...a2,
            x: Math.round(a1.x + 50 * Math.cos(angle)),
            y: Math.round(a1.y + 50 * Math.sin(angle)),
          };
          fixCount++;
          fixDescriptions.push(`원자 중첩 위치(${a1.symbol}-${a2.symbol}) 분리 조정`);
        }
      }
    }
  }

  // 4. 원자가(Valence) 초과 결합 정리
  // 각 원자의 허용 원자가 초과 시 결합 차수를 낮추거나 초과 결합 제거
  let valenceFixes = 0;
  let iterations = 0;

  while (iterations < 10) {
    iterations++;
    const atomValence = new Map<string, number>();
    fixedAtoms.forEach((a) => atomValence.set(a.id, 0));
    fixedBonds.forEach((b) => {
      const order = b.type === "triple" ? 3 : b.type === "double" ? 2 : 1;
      atomValence.set(b.sourceId, (atomValence.get(b.sourceId) || 0) + order);
      atomValence.set(b.targetId, (atomValence.get(b.targetId) || 0) + order);
    });

    let hadExcess = false;

    for (const atom of fixedAtoms) {
      const cur = atomValence.get(atom.id) || 0;
      const limit = MAX_VALENCE_LIMITS[atom.symbol]?.max ?? 4;

      if (cur > limit) {
        hadExcess = true;
        // 이 원자와 연결된 결합 찾기
        const connected = fixedBonds.filter(
          (b) => b.sourceId === atom.id || b.targetId === atom.id
        );

        // 우선순위 1: 다중 결합(삼중 -> 이중, 이중 -> 단일) 낮추기
        const multiBond = connected.find((b) => b.type === "triple" || b.type === "double");
        if (multiBond) {
          fixedBonds = fixedBonds.map((b) =>
            b.id === multiBond.id
              ? { ...b, type: b.type === "triple" ? "double" : "single" }
              : b
          );
          valenceFixes++;
          break;
        }

        // 우선순위 2: 가장 멀리 떨어진 결합 또는 마지막 결합 제거
        if (connected.length > 0) {
          const toRemove = connected[connected.length - 1];
          fixedBonds = fixedBonds.filter((b) => b.id !== toRemove.id);
          valenceFixes++;
          break;
        }
      }
    }

    if (!hadExcess) break;
  }

  if (valenceFixes > 0) {
    fixCount += valenceFixes;
    fixDescriptions.push(`초과된 원자가(옥텟 규칙 위반) 결합 ${valenceFixes}건 교정`);
  }

  // 5. 비정상적 결합 길이(너무 가깝거나 너무 멂) 표준화 (55px ≒ 1.50Å)
  const STANDARD_BOND_PX = 55;
  const atomMap = new Map<string, AtomNode>(fixedAtoms.map((a) => [a.id, a]));
  let lengthFixed = 0;

  fixedBonds.forEach((bond) => {
    const src = atomMap.get(bond.sourceId);
    const tgt = atomMap.get(bond.targetId);
    if (!src || !tgt) return;

    const dx = tgt.x - src.x;
    const dy = tgt.y - src.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 26 || dist > 115) {
      const angle = Math.atan2(dy, dx) || 0;
      const newTgtX = Math.round(src.x + STANDARD_BOND_PX * Math.cos(angle));
      const newTgtY = Math.round(src.y + STANDARD_BOND_PX * Math.sin(angle));

      const tgtIdx = fixedAtoms.findIndex((a) => a.id === tgt.id);
      if (tgtIdx >= 0) {
        fixedAtoms[tgtIdx] = { ...fixedAtoms[tgtIdx], x: newTgtX, y: newTgtY };
        atomMap.set(tgt.id, fixedAtoms[tgtIdx]);
        lengthFixed++;
      }
    }
  });

  if (lengthFixed > 0) {
    fixCount += lengthFixed;
    fixDescriptions.push(`비현실적 결합 길이 ${lengthFixed}개를 표준 길이(55px/1.5Å)로 교정`);
  }

  return {
    fixedAtoms,
    fixedBonds,
    fixCount,
    fixDescriptions,
  };
}
