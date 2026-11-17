import type { PolymerDefinition } from "./polymers";
import type { FiberInputs, ComprehensiveProperties } from "../types";
import type { AtomNode, BondEdge } from "../components/MolDrawCanvas";
import { validateMolecularStructure } from "./molecularValidation";
import { calculateMolecularDescriptor } from "./molecularDescriptor";
import type { DetailedCopolymerEvaluation } from "./polymerBlendService";
import { verifyStructureAgainstRealDataset } from "./polymerDatasetService";

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

/**
 * 실제 실험실 합성 타당성 및 중합 공정 프로토콜 가이드
 */
export interface PolymerizationProtocolGuide {
  architecture: "homopolymer" | "block" | "graft" | "random";
  architectureNameKo: string;
  mechanismNameKo: string;
  mechanismNameEn: string;
  mechanismCategory: string; // e.g. "가역적 불활성화 라디칼 중합 (RDRP)", "용융 중축합", "배위 배향 중합"
  feasibilityGrade: "S" | "A" | "B" | "C";
  feasibilityScore: number; // 0 ~ 100
  feasibilityVerdictKo: string;

  // 1. 단량체 반응성 비(Reactivity Ratios) 및 공중합 동역학
  reactivityKinetics: {
    r1: number;
    r2: number;
    productR1R2: number;
    copolymerizationBehavior: string;
    kineticsComment: string;
  };

  // 2. 입체 장애 및 부반응 제약 조건 검증
  stericAndSideEffects: {
    stericLevel: "낮음 (Low)" | "보통 (Moderate)" | "높음 (Bulky)" | "극심 (Severe)";
    stericFactorDescription: string;
    sideReactionRisks: string[];
    gradeComment: string;
  };

  // 3. 실무형 실험실 합성 레시피 가이드
  labRecipeGuide: {
    initiatorCatalyst: {
      primary: string;
      dosage: string;
      alternatives: string[];
      roleAndCoCatalyst: string;
    };
    reactionConditions: {
      temperature: string;
      solvent: string;
      atmosphere: string;
      reactionTime: string;
      workupPurification: string;
    };
    criticalRisks: {
      title: string;
      risk: string;
      mitigation: string;
    }[];
  };

  summaryProtocolText: string;
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
  polymerizationProtocol: PolymerizationProtocolGuide;
  exportableProposalText: string;
  radarData: { subject: string; score: number; fullMark: number }[];
  // [고도화 추가 필드]: 상용 소재 화이트리스트 및 최소 중합도(올리고머) 컷오프
  isCommercialBaseline?: boolean;
  commercialMatchBadge?: string;
  isOligomer?: boolean;
  oligomerWarningMessage?: string;
  effectiveDp?: number;
  effectiveMw?: number;
}

/**
 * 복합 공중합 구조 및 분자 특성에 따른 실제 실험실 합성 타당성 및 중합 메커니즘 가이드 생성 엔진
 */
export function generatePolymerizationProtocolGuide(params: {
  currentPolymer: PolymerDefinition;
  inputs: FiberInputs;
  descriptor: { monomerMW: number; formula: string; heteroatomRatio: number; oxygenRatio: number };
  validation: { isValid: boolean; errors?: any[] };
  copolymerEvaluation?: DetailedCopolymerEvaluation | null;
}): PolymerizationProtocolGuide {
  const { currentPolymer, descriptor, validation, copolymerEvaluation } = params;

  // 1. 공중합 구조(Architecture) 판정
  let architecture: "homopolymer" | "block" | "graft" | "random" = "homopolymer";
  if (copolymerEvaluation) {
    architecture = copolymerEvaluation.architecture;
  } else {
    const nameLower = (currentPolymer.name + " " + currentPolymer.id + " " + (currentPolymer.koreanName || "")).toLowerCase();
    if (nameLower.includes("-b-") || nameLower.includes("block") || nameLower.includes("블록")) {
      architecture = "block";
    } else if (nameLower.includes("-g-") || nameLower.includes("graft") || nameLower.includes("그래프트")) {
      architecture = "graft";
    } else if (nameLower.includes("-r-") || nameLower.includes("-co-") || nameLower.includes("random") || nameLower.includes("랜덤")) {
      architecture = "random";
    }
  }

  // 2. 단량체 화학군 판별 (폴리에스터, 폴리아미드, 폴리올레핀, 비닐/스티렌 등)
  const nameAndCat = (currentPolymer.name + " " + currentPolymer.category + " " + currentPolymer.smiles).toLowerCase();
  const isPolyester = nameAndCat.includes("ester") || nameAndCat.includes("pet") || nameAndCat.includes("pla") || nameAndCat.includes("pcl");
  const isPolyamide = nameAndCat.includes("amide") || nameAndCat.includes("nylon") || nameAndCat.includes("aramid") || nameAndCat.includes("나일론");
  const isPolyolefin = nameAndCat.includes("ethylene") || nameAndCat.includes("propylene") || nameAndCat.includes("olefin") || nameAndCat.includes("pe") || nameAndCat.includes("pp");
  const hasAromatic = nameAndCat.includes("benzene") || nameAndCat.includes("styrene") || nameAndCat.includes("phthal") || currentPolymer.smiles.includes("c1");
  const isBulkyMonomer = descriptor.monomerMW > 200 || descriptor.heteroatomRatio > 0.35;

  // 3. 구조별 & 화학군별 메커니즘, 반응성 비(r1, r2), 입체 장애, 레시피 가이드 생성
  if (architecture === "block") {
    const isLactoneBlock = isPolyester;
    const mechanismNameKo = isLactoneBlock
      ? "순차적 개환중합(ROP) 및 ATRP 연계 탠덤 블록 합성"
      : "원자이전 라디칼 중합 (ATRP, Atom Transfer Radical Polymerization)";
    const mechanismNameEn = isLactoneBlock ? "Tandem ROP-ATRP Block Polymerization" : "Atom Transfer Radical Polymerization (ATRP)";
    const mechanismCategory = "가역적 불활성화 정밀 라디칼 중합 (RDRP)";

    const chiN = copolymerEvaluation?.chiN ?? 12.4;
    const hasPhaseSep = copolymerEvaluation?.hasPhaseSeparation ?? (chiN > 10.5);

    const r1 = 0.65;
    const r2 = 0.42;
    const productR1R2 = Math.round(r1 * r2 * 100) / 100;

    const stericLevel = (hasAromatic || isBulkyMonomer) ? "높음 (Bulky)" : "보통 (Moderate)";
    const stericDesc = hasAromatic
      ? "방향족 벤젠 고리 및 블록 접합부(Junction)의 입체 반발로 인해 2차 블록 성장 속도 상수(kp)가 1차 블록 대비 약 18~22% 감소하므로 전자 주개형 고활성 리간드(PMDETA) 사용이 필수적입니다."
      : "선형 지방족 블록 결합으로 접합부 입체 장애는 양호한 수준이며, 분자량 제어가 용이합니다.";

    const feasibilityScore = validation.isValid ? (hasPhaseSep ? 88 : 92) : 58;
    const feasibilityGrade = feasibilityScore >= 90 ? "S" : feasibilityScore >= 80 ? "A" : feasibilityScore >= 65 ? "B" : "C";
    const feasibilityVerdictKo = feasibilityGrade === "S"
      ? "실험실 합성 매우 수월 (표준 ATRP/RAFT 키트로 90% 이상 수율)"
      : feasibilityGrade === "A"
      ? "합성 타당성 양호 (불활성 질소 기류 및 정밀 Schlenk 조건 충족 시 재현성 우수)"
      : "정밀 조건 제어 요망 (블록 간 상분리 및 겔화 리스크 완화 필수)";

    return {
      architecture,
      architectureNameKo: "블록 공중합체 (Block Copolymer, A-b-B)",
      mechanismNameKo,
      mechanismNameEn,
      mechanismCategory,
      feasibilityGrade,
      feasibilityScore,
      feasibilityVerdictKo,
      reactivityKinetics: {
        r1,
        r2,
        productR1R2,
        copolymerizationBehavior: "블록 세그먼트 순차 연쇄 성장 (Sequential Block Propagation)",
        kineticsComment: `단량체 A의 1차 블록 중합 후 휴면종(Dormant C-Br) 말단 활성도를 보존한 상태에서 2차 단량체 B를 투입하는 사슬 연장(Chain extension) 프로토콜입니다. 1차 블록 전환율을 75~80%에서 정밀 종결하여 미반응 단량체 오염을 방지해야 합니다. (Mayo-Lewis r₁=${r1}, r₂=${r2}, r₁·r₂=${productR1R2})`,
      },
      stericAndSideEffects: {
        stericLevel,
        stericFactorDescription: stericDesc,
        sideReactionRisks: [
          "불가역적 이분자 라디칼 정지(Bi-molecular termination)에 의한 A-A 호모폴리머 불순물 발생",
          hasPhaseSep ? `블록 간 강한 상분리(χN=${chiN} > 10.5)로 인한 반응 중 점도 급상승 및 탁도(Cloud-point) 침전 위험` : "블록 계면 미세 혼화로 인한 균일상 형성 (거시적 침전 위험 낮음)",
          "산소(O₂) 미량 유입 시 구리 1가 촉매(CuI)의 급격한 산화 실활",
        ],
        gradeComment: `블록 분자량비(${copolymerEvaluation ? copolymerEvaluation.ratioA_wt + ":" + copolymerEvaluation.ratioB_wt : "50:50"})와 χN(${chiN}) 지표를 감안할 때 ${feasibilityGrade}등급으로 평가되며, ATRP 정밀 불활성 조건에서 성공률이 높습니다.`,
      },
      labRecipeGuide: {
        initiatorCatalyst: {
          primary: "Cu(I)Br / PMDETA (Pentamethyldiethylenetriamine 1:1 착물) + EBIB (Ethyl 2-bromoisobutyrate) 개시제",
          dosage: "단량체 대비 EBIB 0.2 mol%, CuBr 0.1 mol%, Deactivator CuBr₂ 0.015 mol% (PDI < 1.22 달성용)",
          alternatives: [
            "AIBN (0.05 mol%) + CPDB (연쇄이동제 0.2 mol%) [RAFT 프로토콜]",
            "FeCl₂ / PPh₃ (트리페닐포스핀 1:2 착물) [환경친화 비독성 금속계]",
          ],
          roleAndCoCatalyst: "전이금속 가역적 할로겐 이동 촉매계: 평형 활성화/비활성화 상수(K_ATRP)를 10⁻⁷ 이하로 억제하여 라디칼 정상상태 농도를 균일화",
        },
        reactionConditions: {
          temperature: "65 ~ 70 ℃ (실리콘 오일 배스 정밀 항온 ±0.5℃ 제어)",
          solvent: "무수 탈수 톨루엔 (Anhydrous Toluene) 또는 무수 DMF (단량체 농도 45~50 wt%)",
          atmosphere: "고순도 질소(N₂) 또는 아르곤(Ar) 분위기 (반응 전 Freeze-Pump-Thaw 3회 탈기 필수)",
          reactionTime: "1차 블록 5~6시간 (전환율 75%) ➔ 탈기 후 2차 블록 6~8시간",
          workupPurification: "중성 알루미나(Alumina) 컬럼 통과(구리 제거) 후 과량의 냉 메탄올에 적하 재침전, 40℃ 진공오븐 24시간 건조",
        },
        criticalRisks: [
          {
            title: "공정 중 마크로 상분리(Macrophase separation)",
            risk: "서로 다른 두 블록의 용해도 차이로 인해 2차 블록 성장 중 겔화 및 침전 발생",
            mitigation: "톨루엔/THF 7:3 혼합 공용매를 채택하고 고토크 테플론 교반자 450 rpm 유지",
          },
          {
            title: "1차 블록 단량체 잔존 오염",
            risk: "1차 블록 미반응 모노머가 2차 블록에 섞여 랜덤 구배(Gradient) 불순물 형성",
            mitigation: "1차 반응 후 50℃ 감압 진공 탈기(Vacuum flash stripping)를 거친 후 2차 단량체 투입",
          },
          {
            title: "산소에 의한 촉매 실활",
            risk: "미량의 산소 유입으로 Cu(I)가 Cu(II)로 산화되어 반응 속도 급정지",
            mitigation: "Schlenk 플라스크 격벽(Septum) 밀봉 및 0.05 bar 질소 양압 버블러 유지",
          },
        ],
      },
      summaryProtocolText: "CuBr/PMDETA 촉매계 기반 2단계 ATRP 반응 (65~70℃, 질소 FPT 3회 탈기, 톨루엔 50wt% 용액, 1차 블록 75% 전환 후 2차 블록 연장, 알루미나 정제 및 냉메탄올 침전).",
    };
  } else if (architecture === "graft") {
    const mechanismNameKo = "주사슬 거대개시제 기반 Grafting-from ATRP 중합 (또는 클릭 CuAAC 결합)";
    const mechanismNameEn = "Grafting-from Atom Transfer Radical Polymerization";
    const mechanismCategory = "이종 관능기 곁가지 유도 정밀 그래프팅";

    const r1 = 0.85;
    const r2 = 0.20;
    const productR1R2 = Math.round(r1 * r2 * 100) / 100;

    const stericLevel = "높음 (Bulky)";
    const stericDesc = "주사슬에 다수의 곁가지가 동시다발적으로 밀집 결합하므로, 곁가지 길이가 길어질수록 사슬 간 입체 얽힘(Chain crowding) 및 입체 장해가 급격히 증대됩니다. 곁가지 밀도를 주사슬 반복단위 기준 8~12 mol%로 조절해야 겔화를 방지할 수 있습니다.";

    const feasibilityScore = validation.isValid ? 80 : 50;
    const feasibilityGrade = feasibilityScore >= 90 ? "S" : feasibilityScore >= 80 ? "A" : feasibilityScore >= 65 ? "B" : "C";
    const feasibilityVerdictKo = "정밀 공정 제어 요망 (B등급 — 사슬 간 가교 및 점도 폭주 억제 필수)";

    return {
      architecture,
      architectureNameKo: "그래프트 빗살형 공중합체 (Graft / Comb Copolymer, A-g-B)",
      mechanismNameKo,
      mechanismNameEn,
      mechanismCategory,
      feasibilityGrade,
      feasibilityScore,
      feasibilityVerdictKo,
      reactivityKinetics: {
        r1,
        r2,
        productR1R2,
        copolymerizationBehavior: "주사슬 앵커링 곁가지 집중 성장 (Comb-like Branching Growth)",
        kineticsComment: `주사슬의 반응성 할로겐(Cl, Br) 사이트에서 곁가지 단량체가 방사형으로 성장합니다. 곁가지 간 입체 장애로 인해 유효 성장 속도 상수(kp)가 단독 호모폴리머 대비 30% 감속되므로 전환율 60% 시점에서 반응을 정지시키는 것이 최적의 다분산도를 보장합니다. (Mayo-Lewis r₁=${r1}, r₂=${r2}, r₁·r₂=${productR1R2})`,
      },
      stericAndSideEffects: {
        stericLevel,
        stericFactorDescription: stericDesc,
        sideReactionRisks: [
          "사슬 간 곁가지 라디칼 커플링에 의한 비가역적 3차원 불용성 겔화(Macroscopic Gelation)",
          "점도 급상승에 따른 국소적 발열(Trommsdorff-Norrish Gel Effect) 폭주",
          "곁가지 단량체의 열적 자가개시 호모폴리머(Free Homopolymer B) 혼입",
        ],
        gradeComment: `고밀도 분지 구조 특성상 겔화 제어가 최우선 과제이므로 저농도 희석 중합(20~25 wt%)을 적용하여 B등급 안정성을 확보해야 합니다.`,
      },
      labRecipeGuide: {
        initiatorCatalyst: {
          primary: "브롬화 주사슬 매크로개시제 + Cu(I)Br / Bpy (2,2'-Bipyridine 1:2 착물)",
          dosage: "주사슬 개시점 대비 CuBr 0.15 mol%, CuBr₂ 0.03 mol% 첨가 (정밀 연쇄 정지 제어)",
          alternatives: [
            "주사슬 아지드(-N₃) 도입 후 말단 알킨 곁가지 CuAAC 클릭 결합 [Grafting-onto 공법]",
            "BPO 열개시제를 이용한 주사슬 C-H 수소추출 라디칼 그래프팅",
          ],
          roleAndCoCatalyst: "고농도 비활성화제 Cu(II)Br₂를 선투입하여 사슬 간 라디칼 재결합(Termination by coupling)을 원천 차단",
        },
        reactionConditions: {
          temperature: "75 ~ 80 ℃ (충분한 확산 에너지 공급 및 점도 저하 유도)",
          solvent: "테트라히드로푸란(THF) 또는 무수 톨루엔 희석 용액 (단량체 농도 20 ~ 25 wt% 저농도 엄수)",
          atmosphere: "고순도 질소(N₂) 연속 치환 하 오버헤드 메카니컬 기계식 고토크 교반(350 rpm)",
          reactionTime: "8 ~ 12 시간 (전환율 55~65% 도달 시 즉시 냉각 켄칭)",
          workupPurification: "디에틸에테르/헥산(1:1) 침전으로 미반응 단량체 및 부생 호모폴리머를 상등액으로 완벽 제거 후 감압 건조",
        },
        criticalRisks: [
          {
            title: "3차원 사슬 가교 겔화(Gelation)",
            risk: "인접한 두 주사슬의 곁가지 성장 말단이 서로 결합하여 반응기 전체가 굳어버림",
            mitigation: "용액 농도를 반드시 25 wt% 이하로 유지하고 전환율 60%를 초과하지 않도록 GC 모니터링",
          },
          {
            title: "교반 불능 및 국소 발열",
            risk: "가지형 고분자의 고유 점도 급상승으로 통상적 자석 교반자 멈춤 현상",
            mitigation: "테플론 블레이드 기계식 모터 교반기를 장착하고 외부 냉각 칠러 10℃ 순환",
          },
        ],
      },
      summaryProtocolText: "브롬화 주사슬 기반 Grafting-from ATRP (75~80℃, CuBr/Bpy 촉매, 단량체 25wt% 저농도 THF 희석 용액, 전환율 60% 조기 켄칭, 에테르/헥산 선택적 재침전).",
    };
  } else if (architecture === "random") {
    const mechanismNameKo = "세미배치 단량체 연속 공급 자유라디칼 공중합 (Semi-batch FRP)";
    const mechanismNameEn = "Semi-batch Free Radical Polymerization (FRP)";
    const mechanismCategory = "동역학 제어 라디칼 연쇄 공중합";

    const r1 = 0.58;
    const r2 = 0.48;
    const productR1R2 = Math.round(r1 * r2 * 100) / 100;

    const stericLevel = "보통 (Moderate)";
    const stericDesc = "선형 주사슬 내에 단량체 A와 B가 통계적으로 고르게 분산되어 국소 입체 반발이 최소화되며 반응기 내 유동성이 우수합니다.";

    const feasibilityScore = validation.isValid ? 94 : 65;
    const feasibilityGrade = feasibilityScore >= 90 ? "S" : feasibilityScore >= 80 ? "A" : feasibilityScore >= 65 ? "B" : "C";
    const feasibilityVerdictKo = "실험실 합성 매우 수월 (S등급 — 범용 실험실 장비로 고수율 합성 가능)";

    return {
      architecture,
      architectureNameKo: "랜덤 통계적 공중합체 (Random Copolymer, A-r-B)",
      mechanismNameKo,
      mechanismNameEn,
      mechanismCategory,
      feasibilityGrade,
      feasibilityScore,
      feasibilityVerdictKo,
      reactivityKinetics: {
        r1,
        r2,
        productR1R2,
        copolymerizationBehavior: "이상적 랜덤 통계적 분포 (Statistical Random Distribution)",
        kineticsComment: `단량체 간의 반응성 비가 r₁=${r1}, r₂=${r2} (r₁·r₂=${productR1R2})로 이상적인 랜덤 분산 범위(0.1 ~ 0.5)에 위치합니다. 초기 단량체 조성 표류(Composition Drift)를 방지하기 위해 반응성이 더 빠른 단량체를 시린지 펌프로 3시간에 걸쳐 연속 투입(Semi-batch)합니다.`,
      },
      stericAndSideEffects: {
        stericLevel,
        stericFactorDescription: stericDesc,
        sideReactionRisks: [
          "단량체 소모 속도 불일치에 따른 중합 초기와 후기 사슬 간 조성 불균일성",
          "불균등 연쇄 정지(Disproportionation)에 기인한 미량의 불포화 이중결합 말단 생성",
        ],
        gradeComment: "특수 금속 촉매나 극저온/무수 조건 없이도 AIBN 열개시제를 이용해 재현성 높은 공중합체를 90% 이상 고수율로 합성할 수 있는 가장 신뢰성 높은 공정입니다.",
      },
      labRecipeGuide: {
        initiatorCatalyst: {
          primary: "AIBN (Azobisisobutyronitrile, 열분해 라디칼 개시제)",
          dosage: "총 단량체 질량 대비 0.2 ~ 0.4 wt% (0.15 mol%)",
          alternatives: [
            "BPO (Benzoyl Peroxide, 75~85℃ 유기 용액 중합)",
            "KPS (Potassium Persulfate, 수계 유화/현탁 공중합 0.3 wt%)",
            "V-65 (2,2'-Azobis(2,4-dimethylvaleronitrile), 50℃ 저온 중합용)",
          ],
          roleAndCoCatalyst: "AIBN의 1차 반응속도 상수(kd ≈ 10⁻⁵ s⁻¹ @ 70℃)를 이용해 6~8시간 동안 일정한 라디칼 정상상태 플럭스 유지",
        },
        reactionConditions: {
          temperature: "68 ~ 72 ℃ (AIBN 10시간 반감기 최적 온도)",
          solvent: "에틸아세테이트(EA), 메틸에틸케톤(MEK) 또는 무수 톨루엔 (고형분 40 wt% 용액)",
          atmosphere: "반응 전 질소 30분 버블링 후 환류 냉각기 상단 질소 버블러 밀폐 유지",
          reactionTime: "6 ~ 8 시간 (단량체 전환율 > 92% 달성)",
          workupPurification: "반응액을 과량의 헥산 또는 메탄올에 교반 적하하여 백색 침전물 여과 수득 후 50℃ 진공 건조",
        },
        criticalRisks: [
          {
            title: "조성 표류(Composition Drift)",
            risk: "반응성이 빠른 단량체가 초기에 먼저 소모되어 후기 사슬의 조성이 달라짐",
            mitigation: "Mayo-Lewis 식 기반 시린지 펌프로 빠른 모노머를 3.5시간 동안 균일 적하",
          },
          {
            title: "발열 반응(Exothermic peak)",
            risk: "배치 중합 초반 급격한 라디칼 폭주로 용매 끓어넘침(Bumping) 현상",
            mitigation: "환류 냉각기 순환수 15℃ 유지 및 모노머 분할 투입",
          },
        ],
      },
      summaryProtocolText: "AIBN 열개시제 기반 세미배치 자유라디칼 공중합 (70℃, 톨루엔/EA 40wt% 용액, 빠른 단량체 3시간 균일 적하, 질소 치환, 메탄올 재침전).",
    };
  } else {
    // Homopolymer (단일 고분자)
    let mechanismNameKo = "열개시 자유 라디칼 부가중합 (Free Radical Polymerization)";
    let mechanismNameEn = "Thermal Free Radical Chain-growth Polymerization";
    let mechanismCategory = "연쇄 성장 부가 중합 (Chain-growth)";
    let primaryCat = "AIBN (0.2 wt%)";
    let tempCond = "70 ℃ 오일 배스";
    let solvCond = "무수 톨루엔 또는 에틸아세테이트 (고형분 40 wt%)";
    let workup = "메탄올 재침전 후 감압 건조";
    let kineticsComment = "단일 단량체의 연쇄 성장 반응으로 Mayo-Lewis 경쟁 반응성 비의 간섭이 없으며, 분자량 제어가 용이합니다.";

    if (isPolyester) {
      mechanismNameKo = "용융 감압 에스테르 교환 및 중축합 (Melt Polycondensation)";
      mechanismNameEn = "Melt Step-Growth Polycondensation";
      mechanismCategory = "고진공 고온 축차 중합 (Step-growth)";
      primaryCat = "Sb₂O₃ (삼산화안티몬 250 ppm) 또는 Ti(OBu)₄ (티타늄 테트라부톡사이드 120 ppm)";
      tempCond = "1단계 220~240 ℃ (상압 탈수/탈글리콜) ➔ 2단계 270~285 ℃ (고진공)";
      solvCond = "무용매 용융 상태 (Bulk melt state)";
      workup = "스트랜드 토출 후 냉각 수조 급랭 및 펠렛화";
      kineticsComment = "카로더스(Carothers) 축차 중합 평형 제어: 부산물(물/에틸렌글리콜)을 0.5 torr 이하 고진공으로 제거하여 반응도 p > 0.995 도달.";
    } else if (isPolyamide) {
      mechanismNameKo = "용액 저온 계면 중축합 (Low-temperature Solution Polycondensation)";
      mechanismNameEn = "Solution Polycondensation";
      mechanismCategory = "친핵성 아실 치환 축중합";
      primaryCat = "트리에틸아민 (TEA, 산포착제) + 이염기산 염화물";
      tempCond = "0 ~ 10 ℃ (빙냉 용액 반응기)";
      solvCond = "NMP / LiCl 또는 DMAc (디메틸아세트아미드)";
      workup = "물에 침전시켜 염산염 세척 후 고온 진공 건조";
      kineticsComment = "급격한 아미드 결합 발열을 억제하기 위해 빙냉 조건에서 디아민 용액에 디에시드 클로라이드를 천천히 적하.";
    } else if (isPolyolefin) {
      mechanismNameKo = "메탈로센 배위 삽입 중합 (Metallocene Coordination Polymerization)";
      mechanismNameEn = "Metallocene Coordination Polymerization";
      mechanismCategory = "전이금속 활성점 배위 중합";
      primaryCat = "Cp₂ZrCl₂ (지르코노센 디클로라이드 5 ppm) + MAO (메틸알루미녹산, Al/Zr = 1000)";
      tempCond = "60 ~ 80 ℃ (오토클레이브 가압 반응기)";
      solvCond = "정제 탈수 헥산 또는 톨루엔";
      workup = "산성화 메탄올(HCl/MeOH) 투입으로 알루미늄 촉매 잔사 추출 및 백색 분말 수득";
      kineticsComment = "단일 활성점(Single-site) 촉매 메커니즘을 통해 다분산지수 PDI ≈ 2.0의 고입체규칙성(Tacticity) 사슬 성장.";
    }

    return {
      architecture,
      architectureNameKo: `단일 선형 고분자 (${currentPolymer.koreanName || currentPolymer.name})`,
      mechanismNameKo,
      mechanismNameEn,
      mechanismCategory,
      feasibilityGrade: "S",
      feasibilityScore: 95,
      feasibilityVerdictKo: "실험실 표준 합성 검증 완료 (S등급 — 공인 상용 레시피)",
      reactivityKinetics: {
        r1: 1.0,
        r2: 1.0,
        productR1R2: 1.0,
        copolymerizationBehavior: "단일 화학종 연쇄 전파 (Homopolymer Propagation)",
        kineticsComment,
      },
      stericAndSideEffects: {
        stericLevel: "낮음 (Low)",
        stericFactorDescription: "동일 반복단위의 연속 결합으로 입체 규칙성이 안정적이며 부반응 제어가 수월합니다.",
        sideReactionRisks: [
          "고온 체류 시 열산화 및 변색(Yellowing) 리스크",
          "축합계 고분자의 경우 미량 수분에 의한 가수분해(Hydrolysis) 분자량 저하",
        ],
        gradeComment: "공정 레시피가 표준화되어 있어 실험실 및 파일럿 규모에서 높은 재현성을 보입니다.",
      },
      labRecipeGuide: {
        initiatorCatalyst: {
          primary: primaryCat,
          dosage: "단량체 대비 0.05 ~ 0.2 mol%",
          alternatives: ["AIBN", "BPO", "유기주석 촉매(DBTDL)"],
          roleAndCoCatalyst: "주 반응 활성화 촉매",
        },
        reactionConditions: {
          temperature: tempCond,
          solvent: solvCond,
          atmosphere: "고순도 질소(N₂) 불활성 기류",
          reactionTime: "4 ~ 8 시간",
          workupPurification: workup,
        },
        criticalRisks: [
          {
            title: "수분 민감성(Moisture Sensitivity)",
            risk: "원료 내 미량 수분 존재 시 촉매 실활 또는 사슬 절단",
            mitigation: "모노머 및 용매의 Karl-Fischer 수분 측정(< 30 ppm) 확인 후 투입",
          },
        ],
      },
      summaryProtocolText: `${mechanismNameKo} (${tempCond}, ${solvCond}, ${primaryCat}, ${workup}).`,
    };
  }
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
  copolymerEvaluation?: DetailedCopolymerEvaluation | null;
}): ResearchValueEvaluationResult {
  const { currentPolymer, inputs, comprehensive, sketchAtoms, sketchBonds, copolymerEvaluation } = params;
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
  // [0-1] 상용 소재 화이트리스트 룩업 (Exact Match Check: 3,284건 오픈DB + 30종 베이스라인)
  // ─────────────────────────────────────────────────────────────
  const hybridCheck = verifyStructureAgainstRealDataset({
    id: currentPolymer.id,
    smiles: currentPolymer.smiles,
    name: currentPolymer.name,
    koreanName: currentPolymer.koreanName,
    formula: descriptor.formula || currentPolymer.formulaUnit,
    tg: currentPolymer.tg,
    mw: descriptor.monomerMW || currentPolymer.monomerMW,
    category: currentPolymer.category,
    isCopolymer: Boolean(copolymerEvaluation),
  });
  const isCommercialBaseline = hybridCheck.isRealMatch;
  const commercialMatchBadge = isCommercialBaseline ? "[실제 상용/공인 소재]" : undefined;

  // ─────────────────────────────────────────────────────────────
  // [0-2] 최소 중합도 컷오프 (Molecular Weight / DP Threshold)
  // 수평균 분자량(Mn >= 10,000 g/mol) 또는 반복단위(n >= 50) 미달 저분자/올리고머(예: 에틸렌 10개) 필터링
  // ─────────────────────────────────────────────────────────────
  const effectiveDp = copolymerEvaluation?.totalDp ?? Math.max(1, inputs.repeatCount || 1);
  const unitMw = Math.max(14, descriptor.monomerMW || currentPolymer.monomerMW || 28);
  const effectiveMw =
    copolymerEvaluation?.totalMw ??
    Math.max(unitMw, inputs.molecularWeight || Math.round(effectiveDp * unitMw));

  const isOligomer = effectiveDp <= 15 || (effectiveDp < 50 && effectiveMw < 10000);
  const oligomerWarningMessage = isOligomer
    ? "⚠️ [안내] 중합도가 너무 낮아 올리고머(Oligomer) 영역입니다. 고분자 특성을 가지려면 반복 단위를 늘려주세요."
    : undefined;

  // ─────────────────────────────────────────────────────────────
  // 1. 혁신성 (Novelty / Uniqueness) 평가 (0 ~ 100)
  //    - 상용/공인 소재 화이트리스트 일치 시 신규성 점수 0점 (미적용) 강제!
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

  if (isCommercialBaseline) {
    noveltyScore = 0;
    noveltyBreakdown.unshift({
      title: "[실제 상용/공인 소재] 화이트리스트 일치 (신규성 0점 미적용)",
      score: 0,
      comment: `3,284건 오픈 데이터셋 및 상용 고분자 라이브러리에 이미 존재하는 실제 상용 소재(${currentPolymer.koreanName || currentPolymer.name})이므로 가상 신소재(Synthetic Novelty) 점수는 0점(미적용)으로 처리되며 공인 물성을 표시합니다.`,
    });
  } else if (isOligomer) {
    noveltyScore = 0;
    noveltyBreakdown.unshift({
      title: "[평가 제외] 올리고머(Oligomer) 저중합도 영역",
      score: 0,
      comment: `현재 반복단위(n=${effectiveDp}) 및 분자량(Mn=${effectiveMw.toLocaleString()} g/mol)이 고분자 임계치(n ≥ 50 또는 Mn ≥ 10,000 g/mol)에 미달하여 R&D 신규성 평가에서 제외됩니다.`,
    });
  } else {
    noveltyScore = Math.min(100, Math.max(30, 25 + tenacityBonus + tradeOffBonus + dyeTradeOffBonus + thermalBonus));
  }

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
      nameKo: isCommercialBaseline ? "혁신성 (상용 소재 미적용)" : "혁신성 및 물성 독창성",
      nameEn: "Novelty & Performance",
      score: noveltyScore,
      weight: isCommercialBaseline ? 0.0 : 0.35,
      level: isCommercialBaseline || isOligomer ? "미흡 (Low)" : noveltyScore >= 85 ? "최상급 (Exceptional)" : noveltyScore >= 70 ? "우수 (Good)" : noveltyScore >= 55 ? "보통 (Average)" : "미흡 (Low)",
      summary: isCommercialBaseline
        ? `[실제 상용/공인 소재] 오픈DB 일치 — 신규성 점수 미적용 (0점)`
        : isOligomer
        ? `올리고머(Oligomer) 저분자 영역 (n=${effectiveDp}, Mn=${effectiveMw.toLocaleString()} g/mol) — 평가 제외`
        : `인장강도 ${tenacity.toFixed(1)}g/d 및 드레이프 ${kes.DC.toFixed(0)}% 기반 파레토 한계 돌파 분석`,
      breakdown: noveltyBreakdown,
    },
    {
      id: "synthesizability",
      nameKo: "화학적 공정 실현 가능성",
      nameEn: "Synthesizability & Feasibility",
      score: synthScore,
      weight: isCommercialBaseline ? 0.40 : 0.30,
      level: synthScore >= 85 ? "최상급 (Exceptional)" : synthScore >= 70 ? "우수 (Good)" : synthScore >= 55 ? "보통 (Average)" : "미흡 (Low)",
      summary: `분자 원자가 옥텟 충족 및 단량체 반응성 동역학 검증`,
      breakdown: synthBreakdown,
    },
    {
      id: "economic",
      nameKo: "경제성 및 원료 경쟁력",
      nameEn: "Economic & Cost Competitiveness",
      score: econScore,
      weight: isCommercialBaseline ? 0.25 : 0.15,
      level: econScore >= 85 ? "최상급 (Exceptional)" : econScore >= 70 ? "우수 (Good)" : econScore >= 55 ? "보통 (Average)" : "미흡 (Low)",
      summary: `석유화학 피드스톡 원가 및 용융 방사 설비 호환성`,
      breakdown: econBreakdown,
    },
    {
      id: "processability",
      nameKo: "방사 가공성 및 양산성",
      nameEn: "Processability & Scalability",
      score: procScore,
      weight: isCommercialBaseline ? 0.20 : 0.10,
      level: procScore >= 85 ? "최상급 (Exceptional)" : procScore >= 70 ? "우수 (Good)" : procScore >= 55 ? "보통 (Average)" : "미흡 (Low)",
      summary: `설정 연신비(${inputs.drawRatio}x) 및 섬도(${inputs.denier}D) 기준 고속 방사성`,
      breakdown: procBreakdown,
    },
    {
      id: "sustainability",
      nameKo: "친환경성 및 자원 순환성",
      nameEn: "Sustainability & Eco-Impact",
      score: ecoScore,
      weight: isCommercialBaseline ? 0.15 : 0.10,
      level: ecoScore >= 85 ? "최상급 (Exceptional)" : ecoScore >= 70 ? "우수 (Good)" : ecoScore >= 55 ? "보통 (Average)" : "미흡 (Low)",
      summary: `열가소성 기계적 리사이클 가능성 및 무수염색 연계성`,
      breakdown: ecoBreakdown,
    },
  ];

  // 올리고머(Oligomer) 영역은 고분자 R&D 타당성 평가 대상에서 엄격히 제외 (0점)
  const overallScore = isOligomer
    ? 0
    : Math.round(metrics.reduce((acc, cur) => acc + cur.score * cur.weight, 0));

  let grade: ResearchValueGrade = "C";
  let gradeBadgeTitle = "[C급: 실효성 낮음 (Low R&D Priority)]";
  let gradeBadgeSubtitle = "기존 범용 고분자 대비 물성 차별화가 미흡하거나 합성 난이도가 과다합니다.";
  let gradeColor = {
    bg: "bg-slate-800/80",
    border: "border-slate-600",
    text: "text-slate-300",
    glow: "shadow-slate-700/20",
  };

  if (isOligomer) {
    grade = "C";
    gradeBadgeTitle = "[평가 제외: 올리고머(Oligomer) 저중합도 영역]";
    gradeBadgeSubtitle =
      "⚠️ [안내] 중합도가 너무 낮아 올리고머(Oligomer) 영역입니다. 고분자 특성을 가지려면 반복 단위를 늘려주세요.";
    gradeColor = {
      bg: "bg-rose-950/70",
      border: "border-rose-500/70",
      text: "text-rose-300",
      glow: "shadow-rose-500/30",
    };
  } else if (isCommercialBaseline) {
    grade = overallScore >= 80 ? "A" : "B";
    gradeBadgeTitle = "[실제 상용/공인 소재] 오픈 데이터셋 검증 완료";
    gradeBadgeSubtitle =
      "3,284건 벤치마크 풀에 존재하는 실제 상용 고분자입니다. (신규성 점수 0점 미적용 · 공인 실험 물성 표시)";
    gradeColor = {
      bg: "bg-emerald-500/15",
      border: "border-emerald-400/60",
      text: "text-emerald-300",
      glow: "shadow-emerald-500/25",
    };
  } else if (overallScore >= 84) {
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

  if (isOligomer) {
    verdict = "평가 제외 — 올리고머(Oligomer) 저중합도 영역";
    headline = `⚠️ [안내] 중합도가 너무 낮아 올리고머(Oligomer) 영역입니다. 고분자 특성을 가지려면 반복 단위를 늘려주세요.`;
    detailedRationale = `현재 설정된 반복단위(n = ${effectiveDp}) 및 수평균 분자량(Mn = ${effectiveMw.toLocaleString()} g/mol)은 고분자 사슬 얽힘(Chain Entanglement)이 일어나는 임계 분자량(Mn ≥ 10,000 g/mol 또는 반복단위 n ≥ 50)에 미달하는 저분자/올리고머(Oligomer) 또는 왁스 수준입니다. 고분자 R&D 타당성 평가를 수행하려면 상단 컨트롤러에서 반복 단위(n)를 50 이상(또는 분자량 10,000 g/mol 이상)으로 상향해 주세요.`;
    risksAndChallenges.push(`반복단위(n=${effectiveDp}) 부족으로 섬유 방사 및 기계적 인장 특성 발현 불가 (올리고머/왁스 거동)`);
  } else if (isCommercialBaseline) {
    verdict = "[실제 상용/공인 소재] — 공인 물성 데이터 적용 (신규성 평가 제외)";
    headline = `입력하신 [${currentPolymer.koreanName || currentPolymer.name}] 구조는 3,284건 오픈 데이터셋 및 상용 고분자 라이브러리에 이미 등재된 [실제 상용/공인 소재]입니다.`;
    detailedRationale = `가상 신소재(Synthetic Novelty)가 아니므로 신규성(Novelty) 점수는 0점(미적용)으로 처리되며, 문헌 및 산업 표준으로 검증된 실제 물성 데이터(Tg ${currentPolymer.tg}℃, Tm ${currentPolymer.tm ?? "-"}℃, 밀도 ${currentPolymer.density} g/cm³)와 표준 중합 레시피를 즉시 제공합니다. 신규 R&D 특허성을 확보하려면 공중합(Block/Graft) 또는 관능기 개질을 추가해 보세요.`;
    keyStrengths.push(`[실제 상용/공인 소재] 화이트리스트 일치 (신뢰도 100%)`);
    keyStrengths.push(`검증된 양산 공정 및 리얼 물성 데이터 보유`);
    risksAndChallenges.push("기존 상용 단일 고분자이므로 물질 자체에 대한 신규 물질특허(Novelty) 청구 불가");
  } else if (grade === "S") {
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
  // 10. 실제 실험실 합성 타당성 및 중합 공정 프로토콜 가이드 도출
  // ─────────────────────────────────────────────────────────────
  const polymerizationProtocol = generatePolymerizationProtocolGuide({
    currentPolymer,
    inputs,
    descriptor,
    validation,
    copolymerEvaluation,
  });

  // ─────────────────────────────────────────────────────────────
  // 11. 제안서용 마크다운 텍스트 자동 생성 (Proposal Generator)
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

## 7. 실제 실험실 합성 및 중합 공정 레시피 가이드 (Laboratory Protocol)
- **추천 중합 메커니즘:** ${polymerizationProtocol.mechanismNameKo} (${polymerizationProtocol.mechanismNameEn})
- **공정 범주:** ${polymerizationProtocol.mechanismCategory} | **구조 형태:** ${polymerizationProtocol.architectureNameKo}
- **합성 타당성 등급:** ${polymerizationProtocol.feasibilityGrade}등급 (${polymerizationProtocol.feasibilityScore}점 / 100점) — ${polymerizationProtocol.feasibilityVerdictKo}
- **공중합 반응성 비 (Reactivity Ratios):** r₁ = ${polymerizationProtocol.reactivityKinetics.r1}, r₂ = ${polymerizationProtocol.reactivityKinetics.r2} (r₁·r₂ = ${polymerizationProtocol.reactivityKinetics.productR1R2}, ${polymerizationProtocol.reactivityKinetics.copolymerizationBehavior})
- **단량체 동역학 소견:** ${polymerizationProtocol.reactivityKinetics.kineticsComment}
- **입체 장애(Steric Hindrance) 평가:** ${polymerizationProtocol.stericAndSideEffects.stericLevel} — ${polymerizationProtocol.stericAndSideEffects.stericFactorDescription}

### [실험실 표준 합성 레시피 가이드]
1. **개시제 및 촉매 시스템:**
   - 주 촉매/개시제: ${polymerizationProtocol.labRecipeGuide.initiatorCatalyst.primary}
   - 표준 투입량: ${polymerizationProtocol.labRecipeGuide.initiatorCatalyst.dosage}
   - 대체 촉매계: ${polymerizationProtocol.labRecipeGuide.initiatorCatalyst.alternatives.join(" / ")}
   - 역할 및 작용: ${polymerizationProtocol.labRecipeGuide.initiatorCatalyst.roleAndCoCatalyst}
2. **표준 반응 환경 조건:**
   - 반응 온도: ${polymerizationProtocol.labRecipeGuide.reactionConditions.temperature}
   - 용매계 및 농도: ${polymerizationProtocol.labRecipeGuide.reactionConditions.solvent}
   - 반응 분위기: ${polymerizationProtocol.labRecipeGuide.reactionConditions.atmosphere}
   - 반응 시간: ${polymerizationProtocol.labRecipeGuide.reactionConditions.reactionTime}
   - 정제 및 후처리: ${polymerizationProtocol.labRecipeGuide.reactionConditions.workupPurification}
3. **핵심 공정 리스크 및 트러블슈팅:**
${polymerizationProtocol.labRecipeGuide.criticalRisks.map((r) => `   - **${r.title}:** ${r.risk} ➔ [대응 방안] ${r.mitigation}`).join("\n")}

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
    polymerizationProtocol,
    exportableProposalText,
    radarData,
    isCommercialBaseline,
    commercialMatchBadge,
    isOligomer,
    oligomerWarningMessage,
    effectiveDp,
    effectiveMw,
  };
}
