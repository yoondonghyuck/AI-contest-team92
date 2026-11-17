import {
  type PolymerDefinition,
  type RenderAtom,
  type RenderBond,
  generatePolymerChain,
  ELEMENT_PROPERTIES,
} from "./polymers";

export type CopolymerArchitecture = "random" | "block" | "graft";
export type BlendDisplayMode = "parallel" | "copolymer";
export type RatioUnitMode = "wt" | "mol";

export interface PolymerBlendItem {
  id: string;
  polymer: PolymerDefinition;
  ratio: number; // 0 ~ 100 (%) - 중량비(wt%) 기준 내부 저장
  molRatio?: number; // 0 ~ 100 (%) - 몰분율(mol%)
  dp?: number; // 해당 블록/가지의 개별 중합도 (Degree of Polymerization, 단량체 개수)
  blockMw?: number; // 해당 블록/가지의 개별 분자량 (g/mol)
  slotRole?: "block" | "graft" | "random";
  tintColor?: string;
  yOffset: number;
}

export interface CopolymerComponentSummary {
  id: string;
  shortName: string;
  koreanName: string;
  roleLabel: string;
  dp: number;
  blockMw: number;
  wtRatio: number;
  molRatio: number;
}

export interface DetailedCopolymerEvaluation {
  architecture: CopolymerArchitecture;
  ratioA_wt: number;
  ratioB_wt: number;
  ratioA_mol: number;
  ratioB_mol: number;
  foxTg: number; // 단일 또는 대표 Tg (℃)
  tgA: number;
  tgB: number;
  hasPhaseSeparation: boolean;
  chiEstimate: number; // Flory-Huggins chi parameter
  chiN: number; // chi * N
  predictedTenacity: number; // 예상 인장강도 (g/d)
  predictedElongation: number; // 예상 파단 신율 (%)
  predictedDensity: number; // 밀도 (g/cm³)
  syntheticFeasibilityScore: number; // 0 ~ 100
  phaseMorphology: string; // 모폴로지 설명
  recommendedMethod: string; // 추천 합성법 (ATRP, RAFT, Living Anionic 등)
  researcherAssessment: string; // 연구원용 학술 진단 리포트 전문
  totalDp?: number;
  totalMw?: number;
  componentBreakdown?: CopolymerComponentSummary[];
}

/**
 * 다중 단량체(2개, 3개 이상) 각각의 개별 DP(단량체 개수)로부터
 * 개별 분자량(blockMw), 중량비(wt%), 몰분율(mol%), 총 DP 및 총 분자량(Mn)을 정밀 재계산
 */
export function recalculateBlendItemsFromDPs(
  items: PolymerBlendItem[],
  architecture: CopolymerArchitecture = "block"
): {
  items: PolymerBlendItem[];
  totalDp: number;
  totalMw: number;
} {
  if (items.length === 0) {
    return { items: [], totalDp: 0, totalMw: 0 };
  }

  const withDp = items.map((item, idx) => {
    const dp = Math.max(1, Math.round(item.dp ?? Math.max(10, Math.round((item.ratio || 33) * 1.2))));
    const mw = Math.max(10, item.polymer.monomerMW || 50);
    const blockMw = Math.round(dp * mw);
    const defaultRole: "block" | "graft" | "random" =
      architecture === "random"
        ? "random"
        : architecture === "graft"
        ? idx === 0
          ? "block"
          : "graft"
        : idx >= 2
        ? "graft"
        : "block";
    return {
      ...item,
      dp,
      blockMw,
      slotRole: item.slotRole || defaultRole,
    };
  });

  const totalDp = withDp.reduce((acc, it) => acc + (it.dp || 1), 0);
  const totalMw = withDp.reduce((acc, it) => acc + (it.blockMw || 10), 0);

  const updated = withDp.map((it) => {
    const wtRatio = totalMw > 0 ? Math.round(((it.blockMw || 0) / totalMw) * 1000) / 10 : 0;
    const molRatio = totalDp > 0 ? Math.round(((it.dp || 0) / totalDp) * 1000) / 10 : 0;
    return {
      ...it,
      ratio: wtRatio,
      molRatio,
    };
  });

  return {
    items: updated,
    totalDp,
    totalMw,
  };
}

/**
 * 1. 중량비(wt%) <-> 몰 분율(mol%) 상호 변환
 */
export function convertWtToMol(polyA: PolymerDefinition, polyB: PolymerDefinition, wtA: number): number {
  const mwA = Math.max(10, polyA.monomerMW);
  const mwB = Math.max(10, polyB.monomerMW);
  const wtB = 100 - wtA;
  const molesA = wtA / mwA;
  const molesB = wtB / mwB;
  const totalMoles = molesA + molesB;
  if (totalMoles === 0) return 50;
  return Math.round((molesA / totalMoles) * 1000) / 10;
}

export function convertMolToWt(polyA: PolymerDefinition, polyB: PolymerDefinition, molA: number): number {
  const mwA = Math.max(10, polyA.monomerMW);
  const mwB = Math.max(10, polyB.monomerMW);
  const molB = 100 - molA;
  const massA = molA * mwA;
  const massB = molB * mwB;
  const totalMass = massA + massB;
  if (totalMass === 0) return 50;
  return Math.round((massA / totalMass) * 1000) / 10;
}

/**
 * 2. 공중합 구조 및 비율/개별 중합도(DP)에 따른 심층 타당성 및 상분리 특성 분석
 *    - 2성분뿐만 아니라 3성분 이상(예: A-b-B-g-C) 다중 공중합체 완벽 지원
 */
export function evaluateDetailedCopolymer(
  polyA: PolymerDefinition,
  polyB: PolymerDefinition,
  architecture: CopolymerArchitecture,
  ratioA_wt: number,
  allItems?: PolymerBlendItem[]
): DetailedCopolymerEvaluation {
  // 다중 성분(2개 이상) 정규화
  const normalized =
    allItems && allItems.length >= 2
      ? recalculateBlendItemsFromDPs(allItems, architecture)
      : recalculateBlendItemsFromDPs(
          [
            {
              id: "slot_a",
              polymer: polyA,
              ratio: ratioA_wt,
              dp: Math.max(10, Math.round(ratioA_wt * 1.2)),
              yOffset: 0,
            },
            {
              id: "slot_b",
              polymer: polyB,
              ratio: Math.max(0, 100 - ratioA_wt),
              dp: Math.max(10, Math.round((100 - ratioA_wt) * 1.2)),
              yOffset: 0,
            },
          ],
          architecture
        );

  const items = normalized.items;
  const totalDp = normalized.totalDp;
  const totalMw = normalized.totalMw;

  const effectiveRatioA_wt = items[0]?.ratio ?? ratioA_wt;
  const effectiveRatioB_wt = items[1]?.ratio ?? Math.round((100 - effectiveRatioA_wt) * 10) / 10;
  const ratioA_mol = items[0]?.molRatio ?? convertWtToMol(polyA, polyB, effectiveRatioA_wt);
  const ratioB_mol = items[1]?.molRatio ?? Math.round((100 - ratioA_mol) * 10) / 10;

  // 1) 다중 성분 Fox 식 기반 Tg 계산: 1/Tg = Σ (w_i / Tg_i)
  let invTgSum = 0;
  items.forEach((it) => {
    const w_i = Math.max(0, (it.ratio || 0) / 100);
    const tg_K = Math.max(100, it.polymer.tg + 273.15);
    invTgSum += w_i / tg_K;
  });
  const foxTgK = invTgSum > 0 ? 1 / invTgSum : Math.max(100, polyA.tg + 273.15);
  const foxTg = Math.round((foxTgK - 273.15) * 10) / 10;

  // 2) Flory-Huggins 상호작용 파라미터 chi(χ) 근사 추정
  const tgDiff = Math.abs(polyA.tg - polyB.tg);
  const densityDiff = Math.abs(polyA.density - polyB.density);
  const deltaDiffEstimate = Math.sqrt(Math.pow(densityDiff * 4.5, 2) + Math.pow(tgDiff * 0.035, 2));
  const chiEstimate = Math.round((Math.pow(deltaDiffEstimate, 2) * 0.12 + 0.05) * 1000) / 1000;

  // 실제 총 중합도(totalDp) 반영하여 χN 계산!
  const degreeOfPolymerization = Math.max(10, totalDp);
  const chiN = Math.round(chiEstimate * degreeOfPolymerization * 10) / 10;

  // 성분별 요약 리스트 생성
  const componentBreakdown: CopolymerComponentSummary[] = items.map((it, idx) => {
    const roleLabel =
      architecture === "random"
        ? `Random 단량체 ${idx + 1}`
        : architecture === "graft"
        ? idx === 0
          ? `Main Backbone (주사슬 1)`
          : `Graft Branch ${idx} (가지 ${idx})`
        : idx >= 2
        ? `Graft Branch ${idx - 1} (가지 ${idx})`
        : `Block ${idx + 1} (블록 ${idx + 1})`;
    return {
      id: it.id,
      shortName: it.polymer.shortName,
      koreanName: it.polymer.koreanName.split(" ")[0],
      roleLabel,
      dp: it.dp || 50,
      blockMw: it.blockMw || Math.round((it.dp || 50) * it.polymer.monomerMW),
      wtRatio: it.ratio,
      molRatio: it.molRatio || 0,
    };
  });

  const compSummaryText = componentBreakdown
    .map((c) => `${c.roleLabel}[${c.shortName}: DP=${c.dp}, Mn=${c.blockMw.toLocaleString()} g/mol, ${c.wtRatio} wt% / ${c.molRatio} mol%]`)
    .join(" + ");

  // 3) 상분리 특성 및 모폴로지 판정
  let hasPhaseSeparation = false;
  let phaseMorphology = "";
  let syntheticFeasibilityScore = 85;
  let recommendedMethod = "자유 라디칼 공중합 (Free Radical Polymerization)";
  let researcherAssessment = "";

  if (items.length >= 3) {
    recommendedMethod = "다단계 리빙 라디칼 중합 + Grafting-from (Sequential RAFT/ATRP)";
    hasPhaseSeparation = chiN > 10.5;
    phaseMorphology = hasPhaseSeparation
      ? "다중블록-가지형 계층적 나노상분리 도메인 (Hierarchical Multiblock-Graft Nanodomains)"
      : "다성분 상용화 네트워크 매트릭스 (Compatibilized Multi-Component Matrix)";
    syntheticFeasibilityScore = 84;
    researcherAssessment = `다성분 복합 공중합체(${compSummaryText}) 설계 결과, 총 중합도 DP=${totalDp}, 총 분자량 Mn=${totalMw.toLocaleString()} g/mol, χN=${chiN}로 계산되었습니다. 각 블록 및 그래프트 가지의 DP 조절에 따라 강성 도메인과 탄성 가지가 계면에서 정밀 결합됩니다.`;
  } else if (architecture === "block") {
    recommendedMethod = "리빙 제어 라디칼 중합 (ATRP 또는 RAFT)";
    if (chiN > 10.5) {
      hasPhaseSeparation = true;
      if (effectiveRatioA_wt >= 40 && effectiveRatioA_wt <= 60) {
        phaseMorphology = "라멜라 미세상분리 (Alternating Lamellar Nanodomains)";
      } else if ((effectiveRatioA_wt >= 20 && effectiveRatioA_wt < 40) || (effectiveRatioA_wt > 60 && effectiveRatioA_wt <= 80)) {
        phaseMorphology = "육방정계 실린더 도메인 (Hexagonal Cylindrical Domain)";
      } else {
        phaseMorphology = "구형 미셀 마이크로도메인 (Spherical Micellar Morphology)";
      }
      syntheticFeasibilityScore = 88;
      researcherAssessment = `블록 공중합체(${compSummaryText})의 χN 값이 ${chiN}(총 DP=${totalDp})으로 임계치(10.5)를 상회하여 뚜렷한 나노스케일 미세상분리가 일어납니다.`;
    } else {
      hasPhaseSeparation = false;
      phaseMorphology = "약한 분리 영역 / 혼합 비정질 단일 상";
      syntheticFeasibilityScore = 92;
      researcherAssessment = `블록 공중합체(${compSummaryText})의 χN=${chiN}(총 DP=${totalDp} < 임계치)로 거시적 상분리 없이 균일한 매트릭스를 형성합니다.`;
    }
  } else if (architecture === "graft") {
    recommendedMethod = "Grafting-from 중합 (거대단량체/매크로개시제 기반 ATRP)";
    hasPhaseSeparation = chiEstimate > 0.15;
    phaseMorphology = "코어-쉘 가지형 분산 모폴로지 (Core-Shell / Comb-like Structure)";
    syntheticFeasibilityScore = 78;
    researcherAssessment = `${compSummaryText} 구조로 주사슬에 곁가지가 화학적으로 앵커링되어 상용화제 효능이 극대화됩니다(총 Mn=${totalMw.toLocaleString()} g/mol).`;
  } else {
    recommendedMethod = "반응성 단량체 피딩 자유라디칼 공중합 (Semi-batch FRP)";
    hasPhaseSeparation = false;
    phaseMorphology = "균일 단일 비정질 상 (Homogeneous Random Matrix)";
    syntheticFeasibilityScore = 95;
    researcherAssessment = `${compSummaryText} 사슬 내에 단량체가 분산되어 단일 Tg(${foxTg}℃)를 나타냅니다.`;
  }

  // 4) 다성분 가중 기계적 물성 예측 (Tenacity & Elongation & Density)
  let weightedTenacity = 0;
  let weightedElongation = 0;
  let weightedDensity = 0;

  items.forEach((it, idx) => {
    const w = Math.max(0, (it.ratio || 0) / 100);
    weightedTenacity += w * (it.polymer.density * 3.8);
    weightedElongation += w * (idx === 0 ? 30 : 45);
    weightedDensity += w * it.polymer.density;
  });

  // 총 분자량(Mn)에 따른 사슬 얽힘(Entanglement) 보정 계수
  const mwEntanglementFactor = totalMw < 5000 ? 0.55 : totalMw < 10000 ? 0.8 : Math.min(1.25, 1 + Math.log10(totalMw / 10000) * 0.12);

  let archTenacityBonus = 0;
  let archElongationBonus = 0;
  if (architecture === "block") {
    archTenacityBonus = 0.8;
    archElongationBonus = 35;
  } else if (architecture === "graft") {
    archTenacityBonus = 1.1;
    archElongationBonus = 15;
  } else {
    archTenacityBonus = -0.2;
    archElongationBonus = 50;
  }

  const predictedTenacity = Math.round(((weightedTenacity + archTenacityBonus) * mwEntanglementFactor) * 10) / 10;
  const predictedElongation = Math.round(((weightedElongation + archElongationBonus) * mwEntanglementFactor) * 10) / 10;
  const predictedDensity = Math.round(weightedDensity * 100) / 100;

  return {
    architecture,
    ratioA_wt: effectiveRatioA_wt,
    ratioB_wt: effectiveRatioB_wt,
    ratioA_mol,
    ratioB_mol,
    foxTg,
    tgA: polyA.tg,
    tgB: polyB.tg,
    hasPhaseSeparation,
    chiEstimate,
    chiN,
    predictedTenacity,
    predictedElongation,
    predictedDensity,
    syntheticFeasibilityScore,
    phaseMorphology,
    recommendedMethod,
    researcherAssessment,
    totalDp,
    totalMw,
    componentBreakdown,
  };
}

/**
 * 3. 공중합 구조 (Random, Block, Graft 및 3성분 이상 A-b-B-g-C)에 따른 3D 사슬 원자/결합 생성 알고리즘
 *    - 각 블록/가지의 개별 중합도(DP)가 사슬 길이 및 가지 크기에 직접 비례하여 반영됨
 */
export function generateCopolymerChain3D(
  polyA: PolymerDefinition,
  polyB: PolymerDefinition,
  architecture: CopolymerArchitecture,
  ratioA_wt: number,
  repeatCount: number,
  showHydrogen: boolean,
  polyC?: PolymerDefinition,
  allItems?: PolymerBlendItem[]
): {
  atoms: RenderAtom[];
  bonds: RenderBond[];
  center: [number, number, number];
  bounds: [number, number, number];
  unitSequence: ("A" | "B")[];
} {
  const dpA = allItems?.[0]?.dp ?? Math.max(10, Math.round(repeatCount * (ratioA_wt / 100)));
  const dpB = allItems?.[1]?.dp ?? Math.max(10, Math.round(repeatCount * ((100 - ratioA_wt) / 100)));
  const dpC = allItems?.[2]?.dp ?? 30;

  // 개별 DP에 비례하여 3D 시각화 블록 길이(단위체 개수) 산출 (DP를 키우면 해당 블록/가지가 실제로 길어짐!)
  const visCountA = Math.min(18, Math.max(2, Math.round(dpA / 6)));
  const visCountB = Math.min(18, Math.max(2, Math.round(dpB / 6)));
  const totalUnits =
    allItems && allItems.length >= 2
      ? Math.min(34, Math.max(4, visCountA + visCountB))
      : Math.min(26, Math.max(6, repeatCount));

  const wA = (dpA + dpB) > 0 ? dpA / (dpA + dpB) : ratioA_wt / 100;
  const unitSequence: ("A" | "B")[] = [];
  const countA =
    allItems && allItems.length >= 2
      ? visCountA
      : Math.max(2, Math.min(totalUnits - 2, Math.round(totalUnits * wA)));

  // 1) 구조별 단위체 서열(Sequence) 결정
  // polyC가 존재하는 복합 구조(예: PS-b-PP-g-PE)이거나 block인 경우 주사슬을 A 블록 + B 블록으로 구성
  if (architecture === "block" || Boolean(polyC)) {
    for (let i = 0; i < totalUnits; i++) {
      unitSequence.push(i < countA ? "A" : "B");
    }
  } else if (architecture === "random") {
    // 시드 기반 균일 분포 의사 난수
    for (let i = 0; i < totalUnits; i++) {
      const pseudoRand = ((i * 37 + 13) % 100) / 100;
      unitSequence.push(pseudoRand < wA ? "A" : "B");
    }
  } else {
    // 순수 2성분 Graft: 주사슬은 전부 A, 곁가지에 B 부착
    for (let i = 0; i < totalUnits; i++) {
      unitSequence.push("A");
    }
  }

  const allAtoms: RenderAtom[] = [];
  const allBonds: RenderBond[] = [];

  let currentX = 0;
  let atomIdCounter = 0;

  // 단량체 A, B, C의 컬러 하이라이트 틴트
  const colorA = "#38bdf8"; // 스카이블루 (단량체 A)
  const colorB = "#f59e0b"; // 앰버 (단량체 B)
  const colorC = "#10b981"; // 에메랄드 (단량체 C - 복합 그래프트 가지)

  // 2) 주사슬 단위체 순차 빌드 (블록 경계에서 3D 꺾임 각도 연출 포함)
  for (let u = 0; u < unitSequence.length; u++) {
    const isUnitA = unitSequence[u] === "A";
    const currentPoly = isUnitA ? polyA : polyB;
    const unitColor = isUnitA ? colorA : colorB;

    // 블록 공중합체(또는 A-b-B-g-C)일 때 블록 B 구간을 3D 공간상에서 눈에 띄게 꺾어서(Kink) 배치
    const isBlockMode = architecture === "block" || Boolean(polyC);
    const blockSteps = isBlockMode && !isUnitA ? u - countA + 1 : 0;
    const kinkY = blockSteps * 0.95;
    const kinkZ = blockSteps * 0.65;

    const unitAtoms = currentPoly.unitAtoms.filter((a) => showHydrogen || a.element !== "H");
    const atomIndexOffset = allAtoms.length;

    unitAtoms.forEach((aDef) => {
      const atomId = `atom_${atomIdCounter++}`;
      const elemProp = ELEMENT_PROPERTIES[aDef.element] || ELEMENT_PROPERTIES.C;

      // 주사슬 X축 방향 누적 배치 + 블록 꺾임(kinkY, kinkZ)
      const pos: [number, number, number] = [
        currentX + aDef.relPos[0],
        aDef.relPos[1] + Math.sin(u * 0.7) * 0.35 + kinkY,
        aDef.relPos[2] + Math.cos(u * 0.7) * 0.35 + kinkZ,
      ];

      allAtoms.push({
        id: atomId,
        element: aDef.element,
        name: `${currentPoly.shortName}_${aDef.name}_u${u}`,
        position: pos,
        unitIndex: u,
        isBackbone: Boolean(aDef.isBackbone),
        color: aDef.isBackbone ? unitColor : elemProp.color,
        radius: elemProp.radius,
      });
    });

    // 단위체 내부 결합 복제
    currentPoly.unitBonds.forEach((bDef, bIdx) => {
      const targetA = allAtoms[atomIndexOffset + bDef.from];
      const targetB = allAtoms[atomIndexOffset + bDef.to];
      if (targetA && targetB) {
        allBonds.push({
          id: `bond_${u}_${bIdx}`,
          atomAId: targetA.id,
          atomBId: targetB.id,
          posA: targetA.position,
          posB: targetB.position,
          order: bDef.order,
          color: unitColor,
          isInterUnit: false,
        });
      }
    });

    // 이전 단위체와의 연결 결합 (Inter-unit bond)
    if (u > 0) {
      const prevTail = allAtoms[atomIndexOffset - 1];
      const currHead = allAtoms[atomIndexOffset];
      if (prevTail && currHead) {
        const isBlockJunction = unitSequence[u - 1] !== unitSequence[u];
        allBonds.push({
          id: `inter_bond_${u}`,
          atomAId: prevTail.id,
          atomBId: currHead.id,
          posA: prevTail.position,
          posB: currHead.position,
          order: 1,
          color: isBlockJunction ? "#f43f5e" : unitColor,
          isInterUnit: true,
        });
      }
    }

    currentX += currentPoly.unitLength || 3.2;

    // ─────────────────────────────────────────────────────────────
    // 3) Graft (그래프트) 구조: 주사슬 특정 위치마다 3D 곁가지(Side-chain) 분기 연출
    // ─────────────────────────────────────────────────────────────
    if (architecture === "graft" || Boolean(polyC)) {
      const graftPoly = polyC || polyB;
      const graftColor = polyC ? colorC : colorB;
      const targetGraftDp = polyC ? dpC : dpB;
      const branchInterval = Math.max(2, Math.round(4 - (1 - wA) * 2));
      if (u % branchInterval === 1) {
        const branchUnitsCount =
          allItems && allItems.length >= 2
            ? Math.max(1, Math.min(7, Math.round(targetGraftDp / 15)))
            : Math.max(2, Math.min(3, Math.round((1 - wA) * 4)));
        const dirSign = (Math.floor(u / branchInterval) % 2 === 0) ? 1 : -1;
        let branchStep = 1;
        let prevBranchAtom = allAtoms[atomIndexOffset];

        for (let br = 0; br < branchUnitsCount; br++) {
          const bAtoms = graftPoly.unitAtoms.filter((a) => showHydrogen || a.element !== "H");
          const brOffset = allAtoms.length;

          bAtoms.forEach((bDef) => {
            const bAtomId = `graft_atom_${atomIdCounter++}`;
            const elemProp = ELEMENT_PROPERTIES[bDef.element] || ELEMENT_PROPERTIES.C;

            // 3D 공간상에서 주사슬 바깥쪽(+Y/+Z 또는 -Y/-Z 사선 방향)으로 명확히 뻗어나가는 가지 연출
            const bPos: [number, number, number] = [
              currentX - (currentPoly.unitLength || 3.2) + bDef.relPos[0] * 0.65 + branchStep * 0.55,
              kinkY + dirSign * (branchStep * 2.2) + bDef.relPos[1] * 0.8,
              kinkZ + dirSign * (branchStep * 1.45) + bDef.relPos[2] * 0.8,
            ];

            const renderB: RenderAtom = {
              id: bAtomId,
              element: bDef.element,
              name: `graft_${graftPoly.shortName}_${bDef.name}_${u}_${br}`,
              position: bPos,
              unitIndex: u + 100 + br,
              isBackbone: false,
              color: bDef.isBackbone ? graftColor : elemProp.color,
              radius: elemProp.radius,
            };
            allAtoms.push(renderB);
          });

          // 곁가지 단위체 내부 결합 복제
          graftPoly.unitBonds.forEach((bDef, bIdx) => {
            const targetA = allAtoms[brOffset + bDef.from];
            const targetB = allAtoms[brOffset + bDef.to];
            if (targetA && targetB) {
              allBonds.push({
                id: `graft_inner_bond_${u}_${br}_${bIdx}`,
                atomAId: targetA.id,
                atomBId: targetB.id,
                posA: targetA.position,
                posB: targetB.position,
                order: bDef.order,
                color: graftColor,
                isInterUnit: false,
              });
            }
          });

          // 주사슬-가지 또는 가지-가지 연결 결합
          const newBranchHead = allAtoms[brOffset];
          if (prevBranchAtom && newBranchHead) {
            allBonds.push({
              id: `graft_bond_${u}_${br}`,
              atomAId: prevBranchAtom.id,
              atomBId: newBranchHead.id,
              posA: prevBranchAtom.position,
              posB: newBranchHead.position,
              order: 1,
              color: br === 0 ? "#f43f5e" : graftColor,
              isInterUnit: true,
            });
          }

          prevBranchAtom = allAtoms[brOffset + bAtoms.length - 1];
          branchStep += 1;
        }
      }
    }
  }

  // 4) 중심 좌표 및 Bounding Box 계산
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  allAtoms.forEach((a) => {
    minX = Math.min(minX, a.position[0]);
    maxX = Math.max(maxX, a.position[0]);
    minY = Math.min(minY, a.position[1]);
    maxY = Math.max(maxY, a.position[1]);
    minZ = Math.min(minZ, a.position[2]);
    maxZ = Math.max(maxZ, a.position[2]);
  });

  const center: [number, number, number] = [
    (minX + maxX) / 2,
    (minY + maxY) / 2,
    (minZ + maxZ) / 2,
  ];

  const bounds: [number, number, number] = [
    Math.max(4, maxX - minX),
    Math.max(4, maxY - minY),
    Math.max(4, maxZ - minZ),
  ];

  return {
    atoms: allAtoms,
    bonds: allBonds,
    center,
    bounds,
    unitSequence,
  };
}

/**
 * 4. 기존 단일 고분자 블렌드 물성 계산 (하위 호환 유지)
 */
export function calculateBlendProperties(
  items: { polymer: PolymerDefinition; ratio: number }[]
) {
  if (items.length < 2) {
    const p = items[0]?.polymer;
    return {
      foxTg: p ? p.tg : 0,
      blendedDensity: p ? p.density : 1.0,
      blendedMw: p ? p.monomerMW : 100,
      compatibilityScore: 100,
      compatibilityRationale: "단일 순수 고분자",
    };
  }
  const evalResult = evaluateDetailedCopolymer(items[0].polymer, items[1].polymer, "block", items[0].ratio);
  return {
    foxTg: evalResult.foxTg,
    blendedDensity: evalResult.predictedDensity,
    blendedMw: Math.round((items[0].polymer.monomerMW * items[0].ratio + items[1].polymer.monomerMW * items[1].ratio) / 100),
    compatibilityScore: evalResult.syntheticFeasibilityScore,
    compatibilityRationale: evalResult.researcherAssessment,
  };
}

/**
 * 5. 다중 사슬 나란히 비교(Parallel) 렌더링 데이터 생성
 */
export function generateMultiChainData(
  items: PolymerBlendItem[],
  repeatCount: number,
  showHydrogen: boolean
): {
  chains: {
    id: string;
    polymerName: string;
    atoms: RenderAtom[];
    bonds: RenderBond[];
    yOffset: number;
    colorTint?: string;
  }[];
  combinedBounds: [number, number, number];
} {
  const chains: {
    id: string;
    polymerName: string;
    atoms: RenderAtom[];
    bonds: RenderBond[];
    yOffset: number;
    colorTint?: string;
  }[] = [];

  let maxX = 5;
  let maxY = 5;
  let maxZ = 5;

  const count = items.length;
  items.forEach((item, idx) => {
    const yOff = count === 1 ? 0 : (idx - (count - 1) / 2) * 7.0;
    const microCount = Math.min(25, Math.max(1, Math.round(repeatCount * (item.ratio / 100))));
    const chainData = generatePolymerChain(item.polymer, Math.max(2, microCount), showHydrogen);

    const offsetAtoms: RenderAtom[] = chainData.atoms.map((a) => ({
      ...a,
      position: [
        a.position[0] - chainData.center[0],
        a.position[1] - chainData.center[1] + yOff,
        a.position[2] - chainData.center[2],
      ],
    }));

    const offsetBonds: RenderBond[] = chainData.bonds.map((b) => ({
      ...b,
      posA: [
        b.posA[0] - chainData.center[0],
        b.posA[1] - chainData.center[1] + yOff,
        b.posA[2] - chainData.center[2],
      ],
      posB: [
        b.posB[0] - chainData.center[0],
        b.posB[1] - chainData.center[1] + yOff,
        b.posB[2] - chainData.center[2],
      ],
    }));

    maxX = Math.max(maxX, chainData.bounds[0]);
    maxY = Math.max(maxY, chainData.bounds[1] + Math.abs(yOff) * 2);
    maxZ = Math.max(maxZ, chainData.bounds[2]);

    chains.push({
      id: item.id,
      polymerName: item.polymer.shortName,
      atoms: offsetAtoms,
      bonds: offsetBonds,
      yOffset: yOff,
      colorTint: item.tintColor,
    });
  });

  return {
    chains,
    combinedBounds: [maxX, maxY, maxZ],
  };
}

/**
 * 6. PolymerDefinition 형태의 결합 공중합체 생성 (하위 호환 및 시스템 연동)
 */
export function createSynthesizedCopolymer(
  polyA: PolymerDefinition,
  polyB: PolymerDefinition,
  type: CopolymerArchitecture = "block",
  ratioA = 50
): PolymerDefinition {
  const evalRes = evaluateDetailedCopolymer(polyA, polyB, type, ratioA);
  const id = `copol_${polyA.id}_${polyB.id}_${Date.now()}`;
  const archTag = type === "block" ? "블록" : type === "graft" ? "그래프트" : "랜덤";
  const shortName = `${polyA.shortName}-${type.slice(0, 1)}-${polyB.shortName}`;
  const koreanName = `${polyA.koreanName.split(" ")[0]}-${polyB.koreanName.split(" ")[0]} ${archTag} 공중합체`;

  return {
    id,
    name: `${polyA.name} / ${polyB.name} ${archTag} Copolymer`,
    shortName,
    koreanName,
    rawName: `${polyA.rawName || polyA.shortName} + ${polyB.rawName || polyB.shortName}`,
    iupacName: `poly(${polyA.shortName}-${type}-${polyB.shortName})`,
    aliases: [shortName, `${polyA.shortName}/${polyB.shortName}`],
    category: "공중합체 (Copolymer)",
    thermalCategory: "Thermoplastic (열가소성)",
    chainArchitecture: `${archTag} 공중합체 (${type.toUpperCase()})`,
    smiles: `${polyA.smiles}.${polyB.smiles}`,
    density: evalRes.predictedDensity,
    tg: evalRes.foxTg,
    tm: Math.round(((polyA.tm || 200) * (ratioA / 100) + (polyB.tm || 200) * (1 - ratioA / 100)) * 10) / 10,
    formulaUnit: `${polyA.formulaUnit} + ${polyB.formulaUnit}`,
    formulaDisplay: `(${polyA.formulaDisplay})${ratioA}% - (${polyB.formulaDisplay})${100 - ratioA}%`,
    monomerMW: evalRes.predictedDensity * 80,
    description: evalRes.researcherAssessment,
    application: `${polyA.application || "복합소재"}, ${polyB.application || "고기능성 엔지니어링"}`,
    unitLength: polyA.unitLength + polyB.unitLength,
    unitAtoms: polyA.unitAtoms,
    unitBonds: polyA.unitBonds,
    connection: polyA.connection,
  };
}
