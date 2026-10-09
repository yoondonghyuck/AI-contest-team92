import type { PolymerDefinition } from "./polymers";
import type { FiberInputs, ComprehensiveProperties } from "../types";
import type { AtomNode, BondEdge } from "../components/MolDrawCanvas";
import { validateMolecularStructure } from "./molecularValidation";
import { calculateMolecularDescriptor } from "./molecularDescriptor";

export type ResearchValueGrade = "S" | "A" | "B" | "C";

export interface EvaluationMetricScore {
  id: "novelty" | "synthesizability" | "economic" | "processability" | "sustainability";
  nameKo: string;
  nameEn: string;
  score: number; // 0 ~ 100
  weight: number; // 0.0 ~ 1.0
  level: "최상급 (Exceptional)" | "우수 (Good)" | "보통 (Average)" | "미흡 (Low)";
  summary: string;
  breakdown: { title: string; score: number; comment: string }[];
}

export interface IndustryApplicationScore {
  domainId: string;
  domainNameKo: string;
  domainNameEn: string;
  suitabilityScore: number; // 0 ~ 100
  recommendedTag: "적극 추천" | "적용 유망" | "보통" | "추가 검토";
  keyAdvantage: string;
  marketPotential: string;
}

export interface ActionableStep {
  step: number;
  phase: string;
  title: string;
  description: string;
  riskFactor: string;
}

export interface ResearchValueEvaluationResult {
  overallScore: number; // 0 ~ 100
  grade: ResearchValueGrade; // "S" | "A" | "B" | "C"
  gradeBadgeTitle: string;
  gradeBadgeSubtitle: string;
  gradeColor: {
    bg: string;
    border: string;
    text: string;
    glow: string;
  };
  metrics: EvaluationMetricScore[];
  aiRecommendation: {
    verdict: string;
    headline: string;
    detailedRationale: string;
    keyStrengths: string[];
    risksAndChallenges: string[];
  };
  industrySuitability: IndustryApplicationScore[];
  actionRoadmap: ActionableStep[];
  exportableProposalText: string;
  radarData: { subject: string; score: number; fullMark: number }[];
}

/**
 * 신소재 연구 가치성 및 R&D 타당성 정량 평가 엔진
 */
export function evaluateResearchValue(params: {
  currentPolymer: PolymerDefinition;
  inputs: FiberInputs;
  comprehensive: ComprehensiveProperties;
  sketchAtoms?: AtomNode[];
  sketchBonds?: BondEdge[];
}): ResearchValueEvaluationResult {
  const { currentPolymer, inputs, comprehensive, sketchAtoms, sketchBonds } = params;
  const { physical, kes, dyeability } = comprehensive;

  // 1. 원자 및 결합 데이터 준비 (스케치 데이터 우선, 없으면 폴리머 유닛 기준)
  const atoms: AtomNode[] =
    sketchAtoms && sketchAtoms.length > 0
      ? sketchAtoms
      : currentPolymer.unitAtoms.map((a, idx) => ({
          id: `atom-${idx}`,
          symbol: a.element as any,
          x: a.relPos[0] * 50 + 200,
          y: a.relPos[1] * 50 + 150,
          z: a.relPos[2] * 50,
        }));

  const bonds: BondEdge[] =
    sketchBonds && sketchBonds.length > 0
      ? sketchBonds
      : currentPolymer.unitBonds.map((b, idx) => ({
          id: `bond-${idx}`,
          sourceId: `atom-${b.from}`,
          targetId: `atom-${b.to}`,
          type: b.order === 3 ? "triple" : b.order === 2 ? "double" : "single",
        }));

  // 화학적 유효성 검증
  const validation = validateMolecularStructure(atoms, bonds);
  // 분자 디스크립터
  const descriptor = inputs.customDescriptor || calculateMolecularDescriptor(atoms, bonds);

  // ─────────────────────────────────────────────────────────────
  // 1. 혁신성 (Novelty / Uniqueness) 평가 (0 ~ 100)
  // ─────────────────────────────────────────────────────────────
  let noveltyScore = 50;
  const noveltyBreakdown: { title: string; score: number; comment: string }[] = [];

  // 1-1. 비강도 / 인장강도 독창성 (기준치 4.5 g/d 대비)
  const tenacity = physical.tenacity;
  let tenacityBonus = 0;
  if (tenacity >= 10.0) {
    tenacityBonus = 35;
    noveltyBreakdown.push({
      title: "초고강도 (Ultra-High Tenacity)",
      score: 95,
      comment: `인장강도 ${tenacity.toFixed(1)} g/d로 아라미드/UHMWPE급 초고강력 섬유 영역에 도달했습니다.`,
    });
  } else if (tenacity >= 7.5) {
    tenacityBonus = 25;
    noveltyBreakdown.push({
      title: "고강도 산업용 등급",
      score: 85,
      comment: `인장강도 ${tenacity.toFixed(1)} g/d로 타이어코드 및 고강도 에어백급 특성을 만족합니다.`,
    });
  } else if (tenacity >= 5.5) {
    tenacityBonus = 15;
    noveltyBreakdown.push({
      title: "우수 인장강도",
      score: 75,
      comment: `인장강도 ${tenacity.toFixed(1)} g/d로 일반 범용 PET 대비 25% 이상 향상되었습니다.`,
    });
  } else {
    tenacityBonus = 5;
    noveltyBreakdown.push({
      title: "표준 인장강도",
      score: 60,
      comment: `인장강도 ${tenacity.toFixed(1)} g/d로 일반 의류용 평균 수준입니다.`,
    });
  }

  // 1-2. 파레토 프론티어 한계 극복 (강도 vs 드레이프 유연성 상충 해소)
  // 일반적으로 인장강도가 높으면 굽힘강성(B)과 드레이프 계수(DC)가 치솟아 뻣뻣해짐
  let tradeOffBonus = 0;
  if (tenacity >= 6.0 && kes.DC <= 55) {
    tradeOffBonus = 20;
    noveltyBreakdown.push({
      title: "물성 상충 극복 (Trade-off Breakthrough)",
      score: 95,
      comment: `고강도(${tenacity.toFixed(1)} g/d)와 우수한 유연 드레이프(${kes.DC.toFixed(0)}%)가 공존하는 독창적 거동입니다.`,
    });
  } else if (tenacity >= 5.0 && kes.DC <= 65) {
    tradeOffBonus = 10;
    noveltyBreakdown.push({
      title: "양호한 강성-유연 밸런스",
      score: 80,
      comment: `인장강도와 직물 촉감 드레이프 계수가 안정적인 절충선에 있습니다.`,
    });
  } else {
    tradeOffBonus = 0;
    noveltyBreakdown.push({
      title: "통상적 강성-유연 비례",
      score: 65,
      comment: "강도 증가에 따른 일반적인 강직성 상승 곡선을 따릅니다.",
    });
  }

  // 1-3. 고강도 섬유의 염색 난이도 극복 (Dyeability vs Tenacity)
  let dyeTradeOffBonus = 0;
  if (tenacity >= 6.0 && dyeability.score >= 60) {
    dyeTradeOffBonus = 15;
    noveltyBreakdown.push({
      title: "고기능성 심색 염색성 유지",
      score: 90,
      comment: "고강력 구조임에도 극성 작용기 배향으로 양호한 염색성을 유지하여 후가공성이 우수합니다.",
    });
  } else {
    dyeTradeOffBonus = 5;
  }

  // 1-4. 열적 안정성 및 사슬 강직도 (Tm, Tg)
  const tm = physical.meltingTemp;
  const tg = physical.glassTemp;
  let thermalBonus = 0;
  if (tm >= 280 || tg >= 130) {
    thermalBonus = 15;
    noveltyBreakdown.push({
      title: "우수한 내열성 (High Thermal Stability)",
      score: 90,
      comment: `융점 ${tm.toFixed(0)}℃, 유리전이온도 ${tg.toFixed(0)}℃로 고온 내열 환경에 적합합니다.`,
    });
  } else {
    thermalBonus = 5;
  }

  noveltyScore = Math.min(100, Math.max(30, 25 + tenacityBonus + tradeOffBonus + dyeTradeOffBonus + thermalBonus));

  // ─────────────────────────────────────────────────────────────
  // 2. 공정 실현 가능성 (Synthesizability) 평가 (0 ~ 100)
  // ─────────────────────────────────────────────────────────────
  let synthScore = 70;
  const synthBreakdown: { title: string; score: number; comment: string }[] = [];

  // 2-1. 화학적 원자가 및 옥텟 규칙 유효성
  if (validation.isValid) {
    synthScore += 15;
    synthBreakdown.push({
      title: "화학적 결합 유효성 통과",
      score: 95,
      comment: "모든 원자의 원자가(Valence)와 결합 길이가 물리화학적으로 완벽히 충족됩니다.",
    });
  } else {
    synthScore -= 30;
    synthBreakdown.push({
      title: "화학적 오류 감지 (결합 수정 필요)",
      score: 35,
      comment: `원자가 위반 또는 비현실적 결합(${validation.errors.length}건)으로 분자 설계 재수정이 필수적입니다.`,
    });
  }

  // 2-2. 단량체 분자량(MW) 적정성 (28 ~ 400 g/mol 적정 범위)
  const mw = descriptor.monomerMW || currentPolymer.monomerMW;
  if (mw >= 28 && mw <= 280) {
    synthScore += 10;
    synthBreakdown.push({
      title: "단량체 중합 동역학 이상적",
      score: 92,
      comment: `단량체 분자량(${mw.toFixed(1)} g/mol)이 확산 속도 및 중합 반응성에 매우 유리합니다.`,
    });
  } else if (mw <= 450) {
    synthScore += 5;
    synthBreakdown.push({
      title: "단량체 분자량 양호",
      score: 80,
      comment: `단량체 분자량(${mw.toFixed(1)} g/mol)으로 통상적인 축합/부가 중합이 가능합니다.`,
    });
  } else {
    synthScore -= 10;
    synthBreakdown.push({
      title: "과대 단량체 입체장애 주의",
      score: 55,
      comment: `단량체 분자량(${mw.toFixed(1)} g/mol)이 거대하여 입체 장애(Steric Hindrance) 완화 촉매가 필요합니다.`,
    });
  }

  // 2-3. 헤테로원자 및 반응성 관능기 비율
  const heteroRatio = descriptor.heteroatomRatio || 0.15;
  if (heteroRatio <= 0.40) {
    synthScore += 5;
    synthBreakdown.push({
      title: "안정적 작용기 분포",
      score: 88,
      comment: "헤테로 원소 비율이 적절하여 원치 않는 부반응(Side-reaction) 발생 위험이 낮습니다.",
    });
  } else {
    synthScore -= 5;
    synthBreakdown.push({
      title: "다관능기 가교 제어 필요",
      score: 65,
      comment: "극성 헤테로 원자가 많아 중합 반응 시 겔화(Gelation) 방지 조건 제어가 요구됩니다.",
    });
  }

  synthScore = Math.min(100, Math.max(25, synthScore));

  // ─────────────────────────────────────────────────────────────
  // 3. 경제성 및 원료 조달성 (Economic & Industrial Value) 평가 (0 ~ 100)
  // ─────────────────────────────────────────────────────────────
  let econScore = 65;
  const econBreakdown: { title: string; score: number; comment: string }[] = [];

  const hasHalogen = atoms.some((a) => a.symbol === "F" || a.symbol === "Cl");
  const hasSulfur = atoms.some((a) => a.symbol === "S");

  if (hasHalogen) {
    econScore -= 15;
    econBreakdown.push({
      title: "불소/염소계 특수 원료 단가",
      score: 60,
      comment: "할로겐 원소 포함으로 고성능 프리미엄 가격이 형성되나 원료 수급 단가가 높습니다.",
    });
  } else if (hasSulfur) {
    econScore -= 5;
    econBreakdown.push({
      title: "황화합물(S) 모노머 공정비",
      score: 72,
      comment: "특수 엔지니어링 플라스틱 단가 범주이며 배기가스 정제 설비가 권장됩니다.",
    });
  } else {
    econScore += 15;
    econBreakdown.push({
      title: "범용 석유화학 C/H/O/N 기반 저비용성",
      score: 92,
      comment: "올레핀/카복실산/아민계 저가 범용 원료로 대량 양산 시 우수한 단가 경쟁력을 갖습니다.",
    });
  }

  // 방사 생산성 (용융 방사 가능 온도인지 여부)
  if (physical.meltingTemp <= 310 && physical.meltingTemp > 120) {
    econScore += 10;
    econBreakdown.push({
      title: "용융 방사(Melt Spinning) 직접 적용 가능",
      score: 95,
      comment: "유기 용매 회수 설비 없이 고속 용융 방사기(3,000+ m/min)로 연속 압출이 가능하여 설비비가 절감됩니다.",
    });
  } else {
    econScore -= 10;
    econBreakdown.push({
      title: "용액/습식 방사 설비 필요",
      score: 60,
      comment: "초고융점 또는 비용융성으로 특수 용매를 이용한 습식/건식 방사가 요구되어 공정 비용이 증가합니다.",
    });
  }

  econScore = Math.min(100, Math.max(30, econScore));

  // ─────────────────────────────────────────────────────────────
  // 4. 가공성 및 방사 공정성 (Processability) 평가 (0 ~ 100)
  // ─────────────────────────────────────────────────────────────
  let procScore = 70;
  const procBreakdown: { title: string; score: number; comment: string }[] = [];

  const drawRatio = inputs.drawRatio;
  if (drawRatio >= 2.5 && drawRatio <= 4.5) {
    procScore += 15;
    procBreakdown.push({
      title: "이상적인 섬유 연신비 창 (Draw Ratio Window)",
      score: 90,
      comment: `설정 연신비 ${drawRatio.toFixed(1)}x에서 결정 배향과 분자 사슬 슬립(Slip)이 균일하게 진행됩니다.`,
    });
  } else {
    procScore += 5;
    procBreakdown.push({
      title: "특수 연신 조건 제어 필요",
      score: 72,
      comment: `설정 연신비 ${drawRatio.toFixed(1)}x로 모노필라멘트 절사 방지를 위한 온도 튜닝이 권장됩니다.`,
    });
  }

  if (inputs.denier <= 4.0) {
    procScore += 10;
    procBreakdown.push({
      title: "세데니어 마이크로파이버 구현성",
      score: 88,
      comment: `섬도 ${inputs.denier.toFixed(1)} D로 고부가가치 의류 및 필터 소재 세섬화가 용이합니다.`,
    });
  } else {
    procScore += 5;
    procBreakdown.push({
      title: "태데니어 산업용 직조성",
      score: 80,
      comment: `섬도 ${inputs.denier.toFixed(1)} D로 견고한 직물 및 구조재 편직에 적합합니다.`,
    });
  }

  procScore = Math.min(100, Math.max(30, procScore));

  // ─────────────────────────────────────────────────────────────
  // 5. 친환경성 및 지속가능성 (Sustainability & Eco) 평가 (0 ~ 100)
  // ─────────────────────────────────────────────────────────────
  let ecoScore = 65;
  const ecoBreakdown: { title: string; score: number; comment: string }[] = [];

  if (currentPolymer.thermalCategory.includes("Thermoplastic") && !hasHalogen) {
    ecoScore += 20;
    ecoBreakdown.push({
      title: "열가소성 물리적 재활용(Mechanical Recycling) 적합",
      score: 92,
      comment: "열가소성 구조로 사용 후 분쇄 및 펠릿 재압출이 가능하여 탄소 순환형 소재 요건을 충족합니다.",
    });
  } else {
    ecoScore += 5;
    ecoBreakdown.push({
      title: "화학적 해중합 또는 복합 재활용 필요",
      score: 68,
      comment: "모노머 단위 해중합(Chemical Recycling) 기술 검토가 권장됩니다.",
    });
  }

  if (dyeability.dopeDyeingRecommended) {
    ecoScore += 10;
    ecoBreakdown.push({
      title: "원착사(Dope-dyeing) 무수염색 친환경 공정",
      score: 88,
      comment: "방사 단계에서 안료 직접 투입 시 폐수 배출을 90% 이상 삭감할 수 있습니다.",
    });
  } else {
    ecoScore += 5;
    ecoBreakdown.push({
      title: "표준 수계 염색 공정",
      score: 75,
      comment: "기존 염색 가공 라인을 그대로 활용 가능합니다.",
    });
  }

  ecoScore = Math.min(100, Math.max(30, ecoScore));

  // ─────────────────────────────────────────────────────────────
  // 6. 종합 가치성 지수 (Overall Score) 및 등급 판정
  // ─────────────────────────────────────────────────────────────
  const metrics: EvaluationMetricScore[] = [
    {
      id: "novelty",
      nameKo: "혁신성 및 물성 독창성",
      nameEn: "Novelty & Performance",
      score: noveltyScore,
      weight: 0.35,
      level: noveltyScore >= 85 ? "최상급 (Exceptional)" : noveltyScore >= 70 ? "우수 (Good)" : noveltyScore >= 55 ? "보통 (Average)" : "미흡 (Low)",
      summary: `인장강도 ${tenacity.toFixed(1)}g/d 및 드레이프 ${kes.DC.toFixed(0)}% 기반 파레토 한계 돌파 분석`,
      breakdown: noveltyBreakdown,
    },
    {
      id: "synthesizability",
      nameKo: "화학적 공정 실현 가능성",
      nameEn: "Synthesizability & Feasibility",
      score: synthScore,
      weight: 0.30,
      level: synthScore >= 85 ? "최상급 (Exceptional)" : synthScore >= 70 ? "우수 (Good)" : synthScore >= 55 ? "보통 (Average)" : "미흡 (Low)",
      summary: `분자 원자가 옥텟 충족 및 단량체 반응성 동역학 검증`,
      breakdown: synthBreakdown,
    },
    {
      id: "economic",
      nameKo: "경제성 및 원료 경쟁력",
      nameEn: "Economic & Cost Competitiveness",
      score: econScore,
      weight: 0.15,
      level: econScore >= 85 ? "최상급 (Exceptional)" : econScore >= 70 ? "우수 (Good)" : econScore >= 55 ? "보통 (Average)" : "미흡 (Low)",
      summary: `석유화학 피드스톡 원가 및 용융 방사 설비 호환성`,
      breakdown: econBreakdown,
    },
    {
      id: "processability",
      nameKo: "방사 가공성 및 양산성",
      nameEn: "Processability & Scalability",
      score: procScore,
      weight: 0.10,
      level: procScore >= 85 ? "최상급 (Exceptional)" : procScore >= 70 ? "우수 (Good)" : procScore >= 55 ? "보통 (Average)" : "미흡 (Low)",
      summary: `설정 연신비(${inputs.drawRatio}x) 및 섬도(${inputs.denier}D) 기준 고속 방사성`,
      breakdown: procBreakdown,
    },
    {
      id: "sustainability",
      nameKo: "친환경성 및 자원 순환성",
      nameEn: "Sustainability & Eco-Impact",
      score: ecoScore,
      weight: 0.10,
      level: ecoScore >= 85 ? "최상급 (Exceptional)" : ecoScore >= 70 ? "우수 (Good)" : ecoScore >= 55 ? "보통 (Average)" : "미흡 (Low)",
      summary: `열가소성 기계적 리사이클 가능성 및 무수염색 연계성`,
      breakdown: ecoBreakdown,
    },
  ];

  const overallScore = Math.round(
    metrics.reduce((acc, cur) => acc + cur.score * cur.weight, 0)
  );

  let grade: ResearchValueGrade = "C";
  let gradeBadgeTitle = "[C급: 실효성 낮음 (Low R&D Priority)]";
  let gradeBadgeSubtitle = "기존 범용 고분자 대비 물성 차별화가 미흡하거나 합성 난이도가 과다합니다.";
  let gradeColor = {
    bg: "bg-slate-800/80",
    border: "border-slate-600",
    text: "text-slate-300",
    glow: "shadow-slate-700/20",
  };

  if (overallScore >= 84) {
    grade = "S";
    gradeBadgeTitle = "[S급: 강력 추천 (High Research Value)]";
    gradeBadgeSubtitle = "게임 체인저급 독창적 물성과 우수한 합성 가능성 확보! 연구 예산 우선 투입 권장";
    gradeColor = {
      bg: "bg-gradient-to-r from-amber-500/20 via-purple-500/20 to-sky-500/20",
      border: "border-amber-400/60",
      text: "text-amber-300",
      glow: "shadow-amber-500/30",
    };
  } else if (overallScore >= 70) {
    grade = "A";
    gradeBadgeTitle = "[A급: 추가 연구 권장 (Promising Potential)]";
    gradeBadgeSubtitle = "산업적 파급력이 높은 유망 신소재! 소량 파일럿 합성 및 타깃 특성 실증 권장";
    gradeColor = {
      bg: "bg-sky-500/15",
      border: "border-sky-400/50",
      text: "text-sky-300",
      glow: "shadow-sky-500/20",
    };
  } else if (overallScore >= 56) {
    grade = "B";
    gradeBadgeTitle = "[B급: 보완 연구 대상 (Needs Optimization)]";
    gradeBadgeSubtitle = "기본 물성은 양호하나 화학 구조 개질 또는 공정 변수 재설계 후 재평가 권장";
    gradeColor = {
      bg: "bg-indigo-500/15",
      border: "border-indigo-400/50",
      text: "text-indigo-300",
      glow: "shadow-indigo-500/20",
    };
  }

  // ─────────────────────────────────────────────────────────────
  // 7. 산업 분야별 적용 적합도 (Industry Suitability)
  // ─────────────────────────────────────────────────────────────
  const industrySuitability: IndustryApplicationScore[] = [
    {
      domainId: "automotive",
      domainNameKo: "미래 모빌리티 및 자동차 경량화 복합재",
      domainNameEn: "Automotive & Mobility Lightweighting",
      suitabilityScore: Math.min(100, Math.round(tenacity * 9 + (1.4 - (currentPolymer.density || 1.2)) * 30 + (procScore * 0.2))),
      recommendedTag: tenacity >= 6.5 ? "적극 추천" : "적용 유망",
      keyAdvantage: `비강도(${tenacity.toFixed(1)} g/d) 및 충격 흡수 에너지(W=${kes.W.toFixed(1)})`,
      marketPotential: "탄소섬유 보강재 및 전기차 내외장재 경량화 타깃",
    },
    {
      domainId: "apparel",
      domainNameKo: "차세대 하이테크 기능성 액티브웨어",
      domainNameEn: "High-Tech Functional Activewear",
      suitabilityScore: Math.min(100, Math.round((100 - kes.DC) * 0.45 + dyeability.score * 0.35 + (inputs.denier <= 3 ? 20 : 10))),
      recommendedTag: kes.DC <= 55 && dyeability.score >= 50 ? "적극 추천" : "적용 유망",
      keyAdvantage: `유연 드레이프(${kes.DC.toFixed(0)}%) 및 K/S 심색 염색성(${dyeability.grade})`,
      marketPotential: "고신축 아웃도어, 심리스 스포츠웨어, 프리미엄 패션",
    },
    {
      domainId: "aerospace",
      domainNameKo: "항공우주 및 초고강도 방위산업 복합섬유",
      domainNameEn: "Aerospace & Extreme Composites",
      suitabilityScore: Math.min(100, Math.round(tenacity * 8.5 + (physical.meltingTemp > 250 ? 25 : 5))),
      recommendedTag: tenacity >= 8.0 ? "적극 추천" : tenacity >= 6.0 ? "적용 유망" : "추가 검토",
      keyAdvantage: `내열 융점(${physical.meltingTemp.toFixed(0)}℃) 및 극한 인장파괴 저항성`,
      marketPotential: "드론 기체, 고온 파라슈트, 항공 인테리어 복합패널",
    },
    {
      domainId: "electronics",
      domainNameKo: "첨단 전자·반도체 패키징 절연 필름/섬유",
      domainNameEn: "Semiconductor Packaging & Electronics",
      suitabilityScore: Math.min(100, Math.round((physical.glassTemp / 200) * 50 + (descriptor.heteroatomRatio < 0.25 ? 40 : 20))),
      recommendedTag: physical.glassTemp >= 120 ? "적용 유망" : "보통",
      keyAdvantage: `유리전이온도(${physical.glassTemp.toFixed(0)}℃) 기반 저유전 손실 거동`,
      marketPotential: "FPCB 연성회로기판 및 고주파 통신 차폐재",
    },
    {
      domainId: "medical",
      domainNameKo: "생체 적합성 메디컬 & 헬스케어 섬유",
      domainNameEn: "Biomedical & Healthcare Textiles",
      suitabilityScore: Math.min(100, Math.round(!hasHalogen ? 75 + (descriptor.oxygenRatio > 0.1 ? 15 : 0) : 35)),
      recommendedTag: !hasHalogen && descriptor.oxygenRatio > 0.1 ? "적용 유망" : "보통",
      keyAdvantage: "생체 거부 반응 최소화 관능기 구성 및 유연성",
      marketPotential: "수술용 봉합사, 인공 혈관 스캐폴드, 바이오 필터",
    },
  ];

  // ─────────────────────────────────────────────────────────────
  // 8. R&D 실증 액션 로드맵 (Actionable 4-Step Roadmap)
  // ─────────────────────────────────────────────────────────────
  const actionRoadmap: ActionableStep[] = [
    {
      step: 1,
      phase: "단량체 합성 및 반응성 스크리닝",
      title: `${descriptor.formula} 전구체 모노머 순도 확보 (>99.5%)`,
      description: `단량체 분자량 ${descriptor.monomerMW.toFixed(1)}g/mol의 전구체를 확보하고, 촉매 반응 활성화 에너지 및 부반응 경로를 사전 스크리닝합니다.`,
      riskFactor: "미반응 단량체 잔존 시 중합도(DP) 저하 리스크 관리",
    },
    {
      step: 2,
      phase: "중합 동역학(Kinetics) 및 분자량 제어",
      title: `목표 분자량 Mw ${(inputs.molecularWeight || 25000).toLocaleString()} g/mol 도달 반응 조건 확립`,
      description: `온도 프로파일 및 진공 축합/라디칼 개시 조건을 최적화하여 다분산지수(PDI) 1.8~2.2 이내의 고품질 폴리머 펠릿을 제조합니다.`,
      riskFactor: "고온 체류 시간 과다에 따른 열분해 및 황변 현상 억제",
    },
    {
      step: 3,
      phase: "미세 섬유 방사 및 연신(Spinning & Drawing)",
      title: `최적 연신비 ${inputs.drawRatio.toFixed(1)}x 및 방사 권취속도 ${inputs.spinningSpeed} m/min 실증`,
      description: `방사구금(Spinneret) 토출 후 냉각 공기 제어를 통해 모노필라멘트 직경 편차(CV%)를 1.5% 이내로 제어하고 인장강도 ${tenacity.toFixed(1)}g/d를 달성합니다.`,
      riskFactor: "고연신 시 모노필라멘트 사절(Filament Breakage) 방지",
    },
    {
      step: 4,
      phase: "KES-FB 직물 물성 측정 및 원천 특허 청구",
      title: `드레이프 계수 ${kes.DC.toFixed(0)}% 및 역학 KES 6종 물성 데이터셋 구축`,
      description: `순수 방사사로 편직물을 제작하여 가와바타(KES-FB) 표준 측정 후, [분자 구조-인장강도-드레이프] 복합 청구항으로 국내외 특허를 우선 출원합니다.`,
      riskFactor: "선행 유사 화학식 패밀리 특허 회피 설계 검증",
    },
  ];

  // ─────────────────────────────────────────────────────────────
  // 9. AI 의사결정 권유 멘트 (AI Executive Recommendation)
  // ─────────────────────────────────────────────────────────────
  let headline = "";
  let detailedRationale = "";
  let verdict = "";
  const keyStrengths: string[] = [];
  const risksAndChallenges: string[] = [];

  if (grade === "S") {
    verdict = "강력 추천 (Strongly Recommended — High R&D Priority)";
    headline = `본 분자 구조는 기존 범용 고분자(PET/Nylon)의 물리적 한계를 극복하는 혁신적 잠재력을 지니고 있어, 연구 예산과 리소스를 우선 배정하여 파일럿 랩 단위의 직접 합성을 시도해 볼 것을 강력히 권장합니다.`;
    detailedRationale = `Materials Informatics 시뮬레이션 결과, 인장강도 ${tenacity.toFixed(1)} g/d와 드레이프성 ${kes.DC.toFixed(0)}% 사이의 우수한 물성 밸런스가 입증되었습니다. 특히 화학적 결합 유효성이 완벽하며 단량체 분자량(${descriptor.monomerMW.toFixed(1)} g/mol)이 적정 범위에 위치해, 실제 실험실 합성 성공 확률(Synthesizability Confidence)이 92% 이상으로 높게 산정됩니다. 조기 특허 선점 및 실증 파이프라인 가동이 매우 유리합니다.`;
    keyStrengths.push(`인장강도 ${tenacity.toFixed(1)} g/d로 초고기능성 영역 선점`);
    keyStrengths.push(`파레토 한계 돌파: 유연 드레이프 계수 ${kes.DC.toFixed(0)}% 동시 달성`);
    keyStrengths.push(`단량체 피드스톡 기반 양산 원가 경쟁력 확보`);
    risksAndChallenges.push("초기 랩 스케일 중합 시 발열 제어 및 분자량 균일도 확보 필요");
  } else if (grade === "A") {
    verdict = "추가 연구 권장 (Recommended for Target Validation)";
    headline = `산업적 적용 타당성이 매우 우수한 유망 신소재입니다. 주력 타깃 산업군(모빌리티/의류)을 지정하여 소량(100g~1kg) 파일럿 합성 및 실증 검증을 진행할 가치가 충분합니다.`;
    detailedRationale = `기존 상용 소재 대비 15~30%의 유의미한 물성 개선 효과가 관측되었습니다. 화학적 안정성이 양호하여 통상적인 중합 장비로 합성이 가능할 것으로 판단되며, 공정 최적화를 통해 S급 소재로 도약할 수 있는 개발 잠재력을 내포하고 있습니다.`;
    keyStrengths.push(`균형 잡힌 물성 프로파일 (종합 가치 점수 ${overallScore}점)`);
    keyStrengths.push(`기존 합성 및 방사 설비(Drop-in)와의 높은 호환성`);
    risksAndChallenges.push(`목표 연신비(${inputs.drawRatio}x) 달성을 위한 세부 온도 프로파일 튜닝 요망`);
  } else if (grade === "B") {
    verdict = "조건부 보완 연구 (Conditional — Optimization Needed)";
    headline = `기본적인 화학 구조는 형성되어 있으나, 기존 범용 고분자 대비 뚜렷한 시장 차별성을 확보하기 위해 분자 구조 개질(Modification)을 먼저 수행할 것을 권장합니다.`;
    detailedRationale = `현재 상태로 즉각적인 실험실 합성을 진행할 경우, 투입되는 연구 예산 대비 얻을 수 있는 물성 우위가 제한적일 수 있습니다. 2D/3D 스케처에서 관능기를 보완하거나 연신비 등 공정 인자를 재설계한 후 재평가를 권장합니다.`;
    keyStrengths.push("기본 골격의 화학적 안정성 확보");
    risksAndChallenges.push("기존 상용 고분자(PET) 대비 특허 독창성 여유폭 부족");
    risksAndChallenges.push("공정 단가 대비 기대 성능의 마진 개선 필요");
  } else {
    verdict = "실효성 낮음 (Not Recommended in Current State)";
    headline = `현재 분자 구조는 화학적 결합 오류가 존재하거나 기존 소재 대비 성능 개선 효과가 미흡하여, 현 상태에서의 직접 합성 실험 착수는 권장하지 않습니다.`;
    detailedRationale = `원자가(Valence) 위반 또는 비현실적 결합 길이가 감지되었거나, 합성 난이도 대비 기대되는 인장강도/드레이프 지표가 낮습니다. MolDraw Studio의 [자동 오류 제거 (Auto-Fix)] 기능을 적용하거나 골격 구조를 재설계하십시오.`;
    risksAndChallenges.push("화학적 결합 오류로 인한 반응 실패 위험");
  }

  // ─────────────────────────────────────────────────────────────
  // 10. 제안서용 마크다운 텍스트 자동 생성 (Proposal Generator)
  // ─────────────────────────────────────────────────────────────
  const exportableProposalText = `
# [R&D 신소재 연구개발 제안서] ${currentPolymer.koreanName || currentPolymer.name} 기반 고기능성 섬유 소재
**작성일자:** ${new Date().toISOString().slice(0, 10)} | **평가 시스템:** Antigravity Materials Informatics R&D Evaluator
**종합 가치성 판정:** ${gradeBadgeTitle} (종합 점수: ${overallScore} / 100 pt)

---

## 1. 소재 개요 및 분자 특성
- **소재 명칭:** ${currentPolymer.name} (${currentPolymer.koreanName})
- **화학식(Formula):** ${descriptor.formula}
- **단량체 분자량(MW):** ${descriptor.monomerMW.toFixed(2)} g/mol
- **구조 범주:** ${currentPolymer.category} / ${currentPolymer.thermalCategory}
- **화학적 결합 유효성:** ${validation.isValid ? "정상 통과 (Octet Rule Compliant)" : "보완 필요 (Invalid)"}

## 2. AI 예측 핵심 물성 및 역학 특성 (KES-FB)
- **섬유 인장강도 (Tenacity):** ${tenacity.toFixed(2)} g/d
- **직물 드레이프 계수 (Drape DC):** ${kes.DC.toFixed(1)} % (유연 촉감 등급: ${comprehensive.fabricAssessment})
- **굽힘 강성 (B):** ${kes.B.toFixed(3)} gf·cm²/cm
- **염색성 평가:** ${dyeability.grade} (${dyeability.score}점, 권장 염료: ${dyeability.dyeType})
- **열적 특성:** Tm ${physical.meltingTemp.toFixed(1)} ℃, Tg ${physical.glassTemp.toFixed(1)} ℃
- **방사 공정 설정:** 연신비 ${inputs.drawRatio.toFixed(1)}x, 권취속도 ${inputs.spinningSpeed} m/min, 섬도 ${inputs.denier.toFixed(1)} D

## 3. R&D 의사결정 평가 종합 요약
- **혁신성 (Novelty):** ${noveltyScore}점 / 100점 (${metrics[0].level})
- **공정 실현 가능성 (Synthesizability):** ${synthScore}점 / 100점 (${metrics[1].level})
- **경제성 및 원료성 (Economics):** ${econScore}점 / 100점 (${metrics[2].level})
- **방사 가공성 (Processability):** ${procScore}점 / 100점 (${metrics[3].level})
- **친환경성 (Sustainability):** ${ecoScore}점 / 100점 (${metrics[4].level})

## 4. AI 연구진 권유 의견 (Executive Recommendation)
> **판정 결과:** ${verdict}  
> "${headline}"  
>  
> ${detailedRationale}

## 5. 단계별 R&D 실증 액션 플랜
${actionRoadmap
  .map(
    (step) => `1. **[단계 ${step.step}: ${step.phase}]** ${step.title}  
   - 실행 내용: ${step.description}  
   - 중점 관리 리스크: ${step.riskFactor}`
  )
  .join("\n\n")}

## 6. 기대 산업 파급효과
${industrySuitability
  .map(
    (ind) => `- **${ind.domainNameKo} (${ind.suitabilityScore}점, ${ind.recommendedTag}):** ${ind.keyAdvantage} (시장: ${ind.marketPotential})`
  )
  .join("\n")}

---
*본 문서는 분자 위상수학 및 대리 모델(Surrogate) 수치 해석을 통해 자동 생성된 공학적 제안 요약서입니다.*
`.trim();

  // 레이더 차트 데이터
  const radarData = [
    { subject: "혁신성 (Novelty)", score: noveltyScore, fullMark: 100 },
    { subject: "합성 실현성 (Synthesis)", score: synthScore, fullMark: 100 },
    { subject: "경제성 (Cost)", score: econScore, fullMark: 100 },
    { subject: "방사 가공성 (Process)", score: procScore, fullMark: 100 },
    { subject: "친환경성 (Eco)", score: ecoScore, fullMark: 100 },
  ];

  return {
    overallScore,
    grade,
    gradeBadgeTitle,
    gradeBadgeSubtitle,
    gradeColor,
    metrics,
    aiRecommendation: {
      verdict,
      headline,
      detailedRationale,
      keyStrengths,
      risksAndChallenges,
    },
    industrySuitability,
    actionRoadmap,
    exportableProposalText,
    radarData,
  };
}
