import type {
  CrossSectionShape,
  FiberInputs,
  KesProperties,
  DyeabilityInfo,
  PhysicalProperties,
  ComprehensiveProperties,
} from "../types";

// 고분자 고유 기준 화학/물리 데이터
interface PolymerBaseSpecs {
  name: string;
  baseModulus: number; // g/d
  baseTenacity: number; // g/d
  baseElongation: number; // %
  density: number; // g/cm³
  baseMoistureRegain: number; // %
  tm: number; // ℃
  tg: number; // ℃
  baseDyeScore: number; // 0 ~ 100
  dyeType: string;
  dyeTemp: number;
  mechanism: string;
  fastness: string;
  dopeDyeingRequired: boolean;
}

const POLYMER_SPECS: Record<string, PolymerBaseSpecs> = {
  pet: {
    name: "PET (폴리에스터)",
    baseModulus: 95,
    baseTenacity: 5.2,
    baseElongation: 26,
    density: 1.38,
    baseMoistureRegain: 0.4,
    tm: 256,
    tg: 75,
    baseDyeScore: 68,
    dyeType: "분산 염료 (Disperse Dye)",
    dyeTemp: 130,
    mechanism: "고온고압(130℃) 또는 캐리어 하에서 비정질 영역의 자유부피(Free Volume) 팽창 후 염료 침투",
    fastness: "세탁 4~5급 / 일광 5급 (매우 우수)",
    dopeDyeingRequired: false,
  },
  pe: {
    name: "PE (폴리에틸렌)",
    baseModulus: 45,
    baseTenacity: 4.0,
    baseElongation: 35,
    density: 0.95,
    baseMoistureRegain: 0.01,
    tm: 135,
    tg: -110,
    baseDyeScore: 8,
    dyeType: "기존 수용성 염료 적용 불가 (원착 필수)",
    dyeTemp: 90,
    mechanism: "완전 비극성 탄화수소 사슬로 친염성 작용기 전무 → 일반 후염(Post-dyeing) 불가능",
    fastness: "원착 시 5급 / 일반염색 불가",
    dopeDyeingRequired: true,
  },
  pp: {
    name: "PP (폴리프로필렌)",
    baseModulus: 65,
    baseTenacity: 4.8,
    baseElongation: 30,
    density: 0.91,
    baseMoistureRegain: 0.02,
    tm: 165,
    tg: -10,
    baseDyeScore: 12,
    dyeType: "마스터배치 원착 착색 (Dope-dyeing)",
    dyeTemp: 100,
    mechanism: "무극성 지방족 고분자로 염료 흡착 자리 없음 → 용융 방사 시 안료 혼합(원착) 공정 필수",
    fastness: "원착 가공 시 내광 5급, 이염 없음",
    dopeDyeingRequired: true,
  },
  nylon6: {
    name: "Nylon 6 (폴리아미드 6)",
    baseModulus: 48,
    baseTenacity: 6.2,
    baseElongation: 38,
    density: 1.14,
    baseMoistureRegain: 4.5,
    tm: 220,
    tg: 50,
    baseDyeScore: 94,
    dyeType: "산성 염료 (Acid Dye), 금속착염 염료",
    dyeTemp: 98,
    mechanism: "말단 아민기(-NH2)와 염료 음이온 간 강력한 정전기적 결합 및 아미드기 수소결합 형성",
    fastness: "선명도 최상 / 세탁 견뢰도 3~4급 (고착제 처리 권장)",
    dopeDyeingRequired: false,
  },
  pan: {
    name: "PAN (아크릴)",
    baseModulus: 70,
    baseTenacity: 3.5,
    baseElongation: 22,
    density: 1.18,
    baseMoistureRegain: 1.6,
    tm: 320,
    tg: 85,
    baseDyeScore: 84,
    dyeType: "양이온/염기성 염료 (Cationic/Basic Dye)",
    dyeTemp: 100,
    mechanism: "공단량체(설폰산염 등) 음이온 사이트에 양이온 염료가 이온 결합하여 극도로 선명한 발색",
    fastness: "일광 7~8급 (최상), 발색 선명도 우수",
    dopeDyeingRequired: false,
  },
  ptfe: {
    name: "PTFE (테플론)",
    baseModulus: 38,
    baseTenacity: 2.2,
    baseElongation: 25,
    density: 2.20,
    baseMoistureRegain: 0.0,
    tm: 327,
    tg: 125,
    baseDyeScore: 2,
    dyeType: "염색 불능 (화학적 불활성)",
    dyeTemp: 150,
    mechanism: "C-F 결합의 극단적인 화학적 안정성과 초소수성으로 어떤 염료 분자도 침투 불가",
    fastness: "평가 불가 (원착 불가 또는 소결 시 특수 안료)",
    dopeDyeingRequired: true,
  },
  pla: {
    name: "PLA (폴리락트산)",
    baseModulus: 85,
    baseTenacity: 4.2,
    baseElongation: 28,
    density: 1.25,
    baseMoistureRegain: 0.5,
    tm: 175,
    tg: 58,
    baseDyeScore: 55,
    dyeType: "저온형 분산 염료 (Low-temp Disperse)",
    dyeTemp: 105,
    mechanism: "Tg가 낮아 100~110℃ 저온에서 분산염료 염색 가능하나, 고온 시 가수분해 주의 필요",
    fastness: "세탁 3~4급, 습윤 견뢰도 주의",
    dopeDyeingRequired: false,
  },
  pvc: {
    name: "PVC (폴리염화비닐)",
    baseModulus: 60,
    baseTenacity: 2.8,
    baseElongation: 30,
    density: 1.40,
    baseMoistureRegain: 0.1,
    tm: 212,
    tg: 80,
    baseDyeScore: 28,
    dyeType: "유용성 염료 또는 안료 배합",
    dyeTemp: 80,
    mechanism: "가소제(Plasticizer) 함량에 따라 침투성이 좌우되며 통상 컴파운딩 시 안료 배합",
    fastness: "일광 4급",
    dopeDyeingRequired: true,
  },
  ps: {
    name: "PS (폴리스티렌)",
    baseModulus: 80,
    baseTenacity: 2.0,
    baseElongation: 15,
    density: 1.05,
    baseMoistureRegain: 0.05,
    tm: 240,
    tg: 100,
    baseDyeScore: 20,
    dyeType: "유기 안료/유용성 염료 (원료 착색)",
    dyeTemp: 80,
    mechanism: "방사용 섬유로는 드물며 수지 성형 시 마스터배치 착색",
    fastness: "원착 4급",
    dopeDyeingRequired: true,
  },
  pmma: {
    name: "PMMA (아크릴 유리)",
    baseModulus: 88,
    baseTenacity: 2.5,
    baseElongation: 12,
    density: 1.19,
    baseMoistureRegain: 0.3,
    tm: 160,
    tg: 105,
    baseDyeScore: 35,
    dyeType: "유용성 염료 또는 안료 배합",
    dyeTemp: 85,
    mechanism: "에스테르 결합 부위가 있으나 강한 강성으로 염색성이 제한됨",
    fastness: "일광 5급, 광학 투명도 우수",
    dopeDyeingRequired: true,
  },
  pvac: {
    name: "PVAc (폴리비닐아세테이트)",
    baseModulus: 30,
    baseTenacity: 1.8,
    baseElongation: 45,
    density: 1.19,
    baseMoistureRegain: 2.0,
    tm: 60,
    tg: 30,
    baseDyeScore: 50,
    dyeType: "수분산 염료 및 유기 안료",
    dyeTemp: 60,
    mechanism: "낮은 Tg로 인해 에멀전 상태에서 안료 착색이 용이함",
    fastness: "세탁 2~3급",
    dopeDyeingRequired: false,
  },
  nylon66: {
    name: "Nylon 66 (폴리아미드 66)",
    baseModulus: 55,
    baseTenacity: 7.2,
    baseElongation: 32,
    density: 1.14,
    baseMoistureRegain: 4.2,
    tm: 260,
    tg: 50,
    baseDyeScore: 92,
    dyeType: "산성 염료 (Acid Dye), 금속착염 염료",
    dyeTemp: 100,
    mechanism: "말단 아민기와 규칙적인 아미드기 수소결합으로 산성염료 염착성 극대화",
    fastness: "세탁 4급 / 일광 5급 (고내열성)",
    dopeDyeingRequired: false,
  },
  hips: {
    name: "HIPS (내충격 폴리스티렌)",
    baseModulus: 65,
    baseTenacity: 2.4,
    baseElongation: 35,
    density: 1.04,
    baseMoistureRegain: 0.1,
    tm: 220,
    tg: 95,
    baseDyeScore: 18,
    dyeType: "안료 마스터배치 착색",
    dyeTemp: 80,
    mechanism: "고무상 부타디엔 도메인이 분산되어 있어 원료 압출 착색이 일반적",
    fastness: "원착 4~5급",
    dopeDyeingRequired: true,
  },
  polybutadiene: {
    name: "Polybutadiene (BR 고무)",
    baseModulus: 15,
    baseTenacity: 1.5,
    baseElongation: 95,
    density: 0.91,
    baseMoistureRegain: 0.05,
    tm: 5,
    tg: -90,
    baseDyeScore: 10,
    dyeType: "카본블랙 및 고무 배합 안료",
    dyeTemp: 50,
    mechanism: "가황(Vulcanization) 시 카본블랙 및 고무용 안료를 기계적으로 혼련 배합",
    fastness: "내마모 5급",
    dopeDyeingRequired: true,
  },
  polyisoprene: {
    name: "Polyisoprene (천연고무 NR)",
    baseModulus: 18,
    baseTenacity: 2.2,
    baseElongation: 110,
    density: 0.92,
    baseMoistureRegain: 0.2,
    tm: 28,
    tg: -70,
    baseDyeScore: 15,
    dyeType: "고무 착색제 배합",
    dyeTemp: 50,
    mechanism: "천연 라텍스 상태에서 안료 분산 혼합",
    fastness: "배합 4급",
    dopeDyeingRequired: true,
  },
  ps_co_pmma: {
    name: "Poly(S-co-MMA) (SMMA)",
    baseModulus: 82,
    baseTenacity: 2.2,
    baseElongation: 15,
    density: 1.12,
    baseMoistureRegain: 0.2,
    tm: 200,
    tg: 102,
    baseDyeScore: 28,
    dyeType: "유기 안료",
    dyeTemp: 85,
    mechanism: "랜덤 공중합체로 광학적 균일 착색 가능",
    fastness: "4급",
    dopeDyeingRequired: true,
  },
  ps_alt_pmma: {
    name: "PS-alt-PMMA (교대 공중합체)",
    baseModulus: 84,
    baseTenacity: 2.3,
    baseElongation: 14,
    density: 1.13,
    baseMoistureRegain: 0.2,
    tm: 205,
    tg: 104,
    baseDyeScore: 30,
    dyeType: "정밀 유기 안료",
    dyeTemp: 85,
    mechanism: "규칙적 1:1 교대 배열로 상분리 없는 투명 착색",
    fastness: "4급",
    dopeDyeingRequired: true,
  },
  ps_b_pmma: {
    name: "PS-b-PMMA (블록 공중합체)",
    baseModulus: 85,
    baseTenacity: 2.4,
    baseElongation: 15,
    density: 1.13,
    baseMoistureRegain: 0.2,
    tm: 205,
    tg: 105,
    baseDyeScore: 32,
    dyeType: "선택적 블록 도핑/염색",
    dyeTemp: 85,
    mechanism: "PMMA 도메인 또는 PS 도메인에 선택적 염료/금속 나노입자 염색 가능",
    fastness: "특수 나노용",
    dopeDyeingRequired: false,
  },
  ps_g_pmma: {
    name: "PS-g-PMMA (그래프트 공중합체)",
    baseModulus: 80,
    baseTenacity: 2.1,
    baseElongation: 18,
    density: 1.11,
    baseMoistureRegain: 0.2,
    tm: 200,
    tg: 103,
    baseDyeScore: 30,
    dyeType: "유기 안료",
    dyeTemp: 85,
    mechanism: "가지형 PMMA 사슬이 계면 활성 작용",
    fastness: "4급",
    dopeDyeingRequired: true,
  },
  sbr_vac: {
    name: "SBR-VAc 3원 공중합체",
    baseModulus: 45,
    baseTenacity: 2.0,
    baseElongation: 55,
    density: 1.08,
    baseMoistureRegain: 0.8,
    tm: 150,
    tg: 45,
    baseDyeScore: 45,
    dyeType: "에멀전 착색제",
    dyeTemp: 60,
    mechanism: "VAc 작용기로 인해 수분산 착색 친화성 보유",
    fastness: "3~4급",
    dopeDyeingRequired: false,
  },
  sis: {
    name: "SIS 3중 블록 공중합체",
    baseModulus: 20,
    baseTenacity: 1.8,
    baseElongation: 85,
    density: 0.94,
    baseMoistureRegain: 0.05,
    tm: 140,
    tg: -65,
    baseDyeScore: 12,
    dyeType: "핫멜트 안료 배합",
    dyeTemp: 70,
    mechanism: "용융 점착제 배합 시 안료 분산",
    fastness: "4급",
    dopeDyeingRequired: true,
  },
  pb_b_ps_g_pan: {
    name: "ABS/MABS 복합체",
    baseModulus: 75,
    baseTenacity: 3.5,
    baseElongation: 25,
    density: 1.06,
    baseMoistureRegain: 0.5,
    tm: 220,
    tg: 105,
    baseDyeScore: 38,
    dyeType: "원료 착색 마스터배치",
    dyeTemp: 90,
    mechanism: "PAN 성분으로 인해 극성이 향상되어 도장 및 도금성 우수",
    fastness: "원착 5급",
    dopeDyeingRequired: true,
  },
  phenol_resin: {
    name: "Phenol 수지 (베이클라이트)",
    baseModulus: 120,
    baseTenacity: 3.0,
    baseElongation: 5,
    density: 1.30,
    baseMoistureRegain: 0.8,
    tm: 300,
    tg: 180,
    baseDyeScore: 25,
    dyeType: "흑색/갈색 원료 혼합 충전재",
    dyeTemp: 100,
    mechanism: "자체적으로 암갈색을 띠므로 밝은 색 염색 불가, 흑색/갈색 배합",
    fastness: "내열/내광 5급 (최상)",
    dopeDyeingRequired: true,
  },
  urea_resin: {
    name: "Urea 수지 (요소 수지)",
    baseModulus: 110,
    baseTenacity: 3.2,
    baseElongation: 6,
    density: 1.45,
    baseMoistureRegain: 1.5,
    tm: 240,
    tg: 160,
    baseDyeScore: 60,
    dyeType: "수용성 염료 및 안료",
    dyeTemp: 90,
    mechanism: "무색투명하여 선명한 파스텔톤 착색이 매우 우수함",
    fastness: "4급",
    dopeDyeingRequired: false,
  },
  melamine_resin: {
    name: "Melamine 수지",
    baseModulus: 130,
    baseTenacity: 3.8,
    baseElongation: 4,
    density: 1.50,
    baseMoistureRegain: 1.2,
    tm: 280,
    tg: 210,
    baseDyeScore: 55,
    dyeType: "고온 내열 안료",
    dyeTemp: 100,
    mechanism: "표면 경도가 높아 염료 침투가 어렵고 성형 시 안료 혼합",
    fastness: "식기용 5급 무독성",
    dopeDyeingRequired: true,
  },
  epoxy: {
    name: "Epoxy 수지",
    baseModulus: 100,
    baseTenacity: 4.5,
    baseElongation: 8,
    density: 1.20,
    baseMoistureRegain: 0.6,
    tm: 250,
    tg: 140,
    baseDyeScore: 40,
    dyeType: "에폭시 전용 유기/무기 안료 페이스트",
    dyeTemp: 80,
    mechanism: "주제와 경화제 혼합 시 페이스트 안료 분산 경화",
    fastness: "내화학/내마모 5급",
    dopeDyeingRequired: true,
  },
  unsaturated_polyester: {
    name: "Unsaturated Polyester (FRP)",
    baseModulus: 90,
    baseTenacity: 3.6,
    baseElongation: 10,
    density: 1.15,
    baseMoistureRegain: 0.4,
    tm: 220,
    tg: 110,
    baseDyeScore: 35,
    dyeType: "FRP 겔코트용 토너 안료",
    dyeTemp: 70,
    mechanism: "액상 수지 상태에서 토너 혼합 후 라디칼 상온/가열 가교",
    fastness: "내후 4급",
    dopeDyeingRequired: true,
  },
  dendrimer: {
    name: "Dendrimer (덴드리머)",
    baseModulus: 40,
    baseTenacity: 1.2,
    baseElongation: 20,
    density: 1.25,
    baseMoistureRegain: 3.5,
    tm: 120,
    tg: 35,
    baseDyeScore: 90,
    dyeType: "표면 작용기 분자 포획/포집 염색",
    dyeTemp: 40,
    mechanism: "수많은 말단기(-NH2) 및 내부 공동(Cavity)에 염료 분자를 분자 단위로 포집",
    fastness: "바이오 나노급",
    dopeDyeingRequired: false,
  },
  polyrotaxane: {
    name: "Polyrotaxane (슬라이드링)",
    baseModulus: 25,
    baseTenacity: 2.8,
    baseElongation: 120,
    density: 1.22,
    baseMoistureRegain: 1.8,
    tm: 140,
    tg: -40,
    baseDyeScore: 75,
    dyeType: "수분산 염료 및 친수성 색소",
    dyeTemp: 60,
    mechanism: "시클로덱스트린 고리의 다공성 친수성 부위로 염료 흡착 용이",
    fastness: "4급",
    dopeDyeingRequired: false,
  },
  polycatenane: {
    name: "Polycatenane (고리연결)",
    baseModulus: 50,
    baseTenacity: 3.0,
    baseElongation: 40,
    density: 1.18,
    baseMoistureRegain: 1.0,
    tm: 180,
    tg: 60,
    baseDyeScore: 65,
    dyeType: "초분자 유기 색소",
    dyeTemp: 70,
    mechanism: "거대 고리 내부 공극에 유기 색소 분자 인터칼레이션",
    fastness: "4급",
    dopeDyeingRequired: false,
  },
  conducting_polymer: {
    name: "Conducting Polymers (PEDOT/PANI)",
    baseModulus: 95,
    baseTenacity: 3.2,
    baseElongation: 10,
    density: 1.35,
    baseMoistureRegain: 2.5,
    tm: 290,
    tg: 150,
    baseDyeScore: 80,
    dyeType: "자체 도핑 전도성 발색 (Dark Blue / Green)",
    dyeTemp: 60,
    mechanism: "공액계 산화 환원 도핑 상태에 따라 짙은 청색(PEDOT) 및 녹색(PANI) 고유 발색",
    fastness: "전도도 연동 4급",
    dopeDyeingRequired: false,
  },
};

const SHAPE_MOD: Record<CrossSectionShape, { bMod: number; surfaceMod: number; colorMod: number }> = {
  circular: { bMod: 1.0, surfaceMod: 1.0, colorMod: 1.0 },
  trilobal: { bMod: 1.28, surfaceMod: 1.35, colorMod: 1.18 }, // 비표면적 증가 -> 심색성 및 실크 광택
  hollow: { bMod: 0.82, surfaceMod: 1.20, colorMod: 0.88 }, // 내부 공기층 빛 산란 -> 파스텔 톤
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/**
 * 고분자 화학 구조 + 분자량(Mw) + 결정화도 + 미세 섬유 변수 통합 예측
 */
export function predictComprehensive(inputs: FiberInputs): ComprehensiveProperties {
  const {
    polymerId,
    molecularWeight: mw,
    denier: d,
    crystallinity: cryst,
    lengthMm: length,
    crimpCpi: crimp,
    shape,
    drawRatio = 3.2,
    spinningSpeed = 3200,
    modificationRatio = 1.8,
    customDescriptor,
  } = inputs;

  const spec = POLYMER_SPECS[polymerId] || POLYMER_SPECS.pet;
  const baseShape = SHAPE_MOD[shape] || SHAPE_MOD.circular;

  // 2D/3D 스케치 분자 구조 디스크립터 기반 동적 물리화학 보정 인자
  const hasCustomMol = Boolean(customDescriptor && customDescriptor.totalAtoms > 0);
  const molRigidityFactor = hasCustomMol
    ? 1.0 + (customDescriptor?.rigidityScore ?? 0) * 0.75
    : 1.0;
  const molPolarityBoost = hasCustomMol
    ? (customDescriptor?.polarityScore ?? 0) * 32
    : 0;
  const molMoistureBoost = hasCustomMol
    ? ((customDescriptor?.oxygenRatio ?? 0) * 2.8 + ((customDescriptor?.nitrogenCount ?? 0) / Math.max(1, customDescriptor?.totalAtoms ?? 1)) * 3.2)
    : 0;

  // 이형도/중공률(modificationRatio: 1.0 ~ 3.0)에 따른 동적 형상 보정
  const mrFactor = Math.max(1.0, modificationRatio);
  const shapeInfo = {
    bMod: shape === "trilobal" ? baseShape.bMod * (0.85 + mrFactor * 0.15) : shape === "hollow" ? baseShape.bMod * (1.2 - mrFactor * 0.1) : 1.0,
    surfaceMod: shape === "trilobal" ? baseShape.surfaceMod * (0.7 + mrFactor * 0.2) : 1.0,
    colorMod: shape === "trilobal" ? baseShape.colorMod * (0.8 + mrFactor * 0.12) : shape === "hollow" ? baseShape.colorMod : 1.0,
  };

  // 배향 계수 (Orientation Factor fc: 0.15 ~ 0.95)
  // 연신비(drawRatio)와 고속 방사 속도(spinningSpeed)의 결합 효과
  const speedOrientationBoost = Math.max(0, (spinningSpeed - 2000) / 10000);
  const orientationFactor = Number(
    clamp(1.0 - 1.0 / Math.pow(Math.max(1.0, drawRatio), 1.35) + speedOrientationBoost, 0.15, 0.96).toFixed(3)
  );

  // 1. 염색성 (Dyeability) 정밀 계산
  // - 비정질 분율 (1 - cryst): 염료는 비정질 영역으로만 확산 침투
  const amorphousFraction = Math.max(0.05, 1.0 - cryst);
  const amorphousFactor = Math.pow(amorphousFraction / 0.52, 1.15);

  // - 연신비 효과: 연신비가 너무 높으면 비정질 사슬도 팽팽하게 긴장되어 염료 자유부피 감소
  const drawDyeFactor = clamp(1.10 - (drawRatio - 1.0) * 0.045, 0.82, 1.08);

  // - 분자량 효과: 분자량이 너무 크면 사슬 얽힘 밀도가 높아져 염료 확산 속도 감소
  const mwFactor = clamp(1.05 - (mw / 500000) * 0.12, 0.85, 1.08);

  // - 섬도(Denier) 효과: 극세사(d < 1.0)는 비표면적이 매우 커서 표면 흡진은 빠르나 깊은 심색에 더 많은 염료 필요
  const denierSurfaceFactor = d < 1.0 ? 1.1 : 1.0 - (d - 1.0) * 0.015;

  // 최종 염색성 점수 산출
  let rawDyeScore =
    spec.baseDyeScore *
    amorphousFactor *
    shapeInfo.colorMod *
    drawDyeFactor *
    mwFactor *
    denierSurfaceFactor +
    molPolarityBoost;

  // 비극성 올레핀계(PE, PP, PTFE)는 구조적으로 염색 자리가 없으므로 결정화도와 무관하게 억제 (단, 커스텀 극성 작용기 도입 시 일부 허용)
  if (spec.dopeDyeingRequired && spec.baseDyeScore < 20 && !hasCustomMol) {
    rawDyeScore = clamp(rawDyeScore, 1, 15);
  }

  const dyeScore = Math.round(clamp(rawDyeScore, 1, 99));

  let grade: DyeabilityInfo["grade"];
  if (dyeScore >= 88) grade = "최우수";
  else if (dyeScore >= 75) grade = "우수";
  else if (dyeScore >= 60) grade = "양호";
  else if (dyeScore >= 40) grade = "조건부 염색";
  else if (dyeScore >= 20) grade = "염색 난이도 높음";
  else grade = "염색 불가 (원착 필수)";

  const colorDepth =
    shape === "trilobal"
      ? `고심색성 (MR ${mrFactor.toFixed(1)}x 삼엽 실크 광택 발색)`
      : shape === "hollow"
      ? `파스텔 톤 (중공률 ${Math.round(mrFactor * 15)}% 빛 산란)`
      : "표준 발색성 (Uniform Shade)";

  const dyeability: DyeabilityInfo = {
    score: dyeScore,
    grade,
    dyeType: hasCustomMol && (customDescriptor?.oxygenRatio ?? 0) > 0.15 ? "분산/양이온 복합 염료 친화성 향상" : spec.dyeType,
    tempCelsius: spec.dyeTemp,
    colorDepth,
    mechanism: hasCustomMol && (customDescriptor?.polarityScore ?? 0) > 0.3
      ? `${spec.mechanism} + [스케치 분자 극성기/헤테로 원소 기반 흡진력 보정]`
      : spec.mechanism,
    washingFastness: spec.fastness,
    lightFastness: spec.fastness.includes("일광") ? spec.fastness : "4급 수준",
    dopeDyeingRecommended: hasCustomMol && (customDescriptor?.polarityScore ?? 0) > 0.4 ? false : spec.dopeDyeingRequired,
  };

  // 2. 물리/역학/열적 특성 (Physical Properties)
  // 연신비(drawRatio)에 따른 인장강도 급상승 & 잔여 신도 감소
  const drawTenacityMultiplier = Math.sqrt(Math.max(1.0, drawRatio) / 2.8);
  const drawElongationFactor = 1.0 / Math.sqrt(Math.max(1.0, drawRatio) / 2.8);

  let mwTenacityMultiplier = 1.0;
  if (polymerId === "pe") {
    mwTenacityMultiplier = 0.7 + (mw / 120000) * 0.9;
  } else {
    mwTenacityMultiplier = 0.8 + Math.min(1.5, Math.pow(mw / 30000, 0.35));
  }

  const tenacity = Number(
    (
      spec.baseTenacity *
      mwTenacityMultiplier *
      drawTenacityMultiplier *
      (0.7 + cryst * 0.6) *
      (shape === "hollow" ? 0.9 : 1.0) *
      (hasCustomMol ? 1.0 + (customDescriptor?.doubleBondRatio ?? 0) * 0.22 : 1.0)
    ).toFixed(2)
  );

  const modulus = Number(
    (
      spec.baseModulus *
      (0.6 + cryst * 0.7) *
      Math.pow(drawRatio / 2.5, 0.6) *
      shapeInfo.bMod *
      molRigidityFactor
    ).toFixed(1)
  );

  const elongationBreak = Number(
    clamp(
      ((spec.baseElongation * (1.3 - cryst * 0.8) + crimp * 0.25) * drawElongationFactor) /
        Math.sqrt(molRigidityFactor),
      4,
      65
    ).toFixed(1)
  );

  const moistureRegain = Number(
    (spec.baseMoistureRegain * (1 - cryst * 0.4) + molMoistureBoost).toFixed(2)
  );

  const glassTemp = spec.tg + (hasCustomMol ? Math.round((customDescriptor?.rigidityScore ?? 0) * 28) : 0);

  const physical: PhysicalProperties = {
    tenacity,
    elongationBreak,
    modulus,
    moistureRegain,
    meltingTemp: spec.tm,
    glassTemp,
    orientationFactor,
  };

  // 3. KES-FB 표준 역학 물성 계산
  // 고분자 고유 영률(Modulus)과 비중(Density)을 직접 반영
  const polymerStiffnessFactor = (spec.baseModulus * molRigidityFactor) / 70.0;
  const densityRatio = spec.density / 1.30;

  const B = clamp(
    0.009 * Math.pow(d, 1.8) * (1 + cryst * 1.6) * shapeInfo.bMod * polymerStiffnessFactor,
    0.015,
    3.5
  );

  const G = clamp(
    (d * 0.14 + crimp * 0.08 + length * 0.004 + cryst * 0.6) * Math.sqrt(polymerStiffnessFactor),
    0.1,
    8.0
  );

  const EMT = clamp(
    (14.0 / (1 + cryst * 2.2) + crimp * 0.35 - d * 0.15) * (elongationBreak / 25),
    1.5,
    35.0
  );

  const hollowArealMod = shape === "hollow" ? 0.82 : 1.0;
  const W = (9.5 + d * 1.45 + crimp * 0.2) * densityRatio * hollowArealMod;

  const hollowBoost = shape === "hollow" ? 1.25 : 1.0;
  const H0 = (0.20 + d * 0.052 + crimp * 0.011) * hollowBoost;

  const DC = clamp(18.0 + (B / W) * 360.0 + (G / W) * 140.0, 10, 96);

  const kes: KesProperties = {
    B: Number(B.toFixed(3)),
    G: Number(G.toFixed(2)),
    EMT: Number(EMT.toFixed(2)),
    W: Number(W.toFixed(2)),
    H0: Number(H0.toFixed(3)),
    DC: Number(DC.toFixed(1)),
  };

  // 4. 종합 직물 감성 및 용도 자동 진단
  let fabricAssessment = "";
  let recommendedUse = "";

  if (polymerId === "pet") {
    if (cryst > 0.6) {
      fabricAssessment = `고결정화(${Math.round(cryst * 100)}%) PET 직물로 형태 안정성과 주름 회복성이 매우 우수하며, 강한 반발 탄성과 뼛뼛한 실루엣을 형성합니다.`;
      recommendedUse = "고급 정장지, 주름가공 플리츠 스커트, 커튼, 기능성 아우터";
    } else {
      fabricAssessment = "유연하고 부드러운 드레이프성을 지니며 분산염료 흡진이 원활한 다목적 폴리에스터 직물입니다.";
      recommendedUse = "스포츠웨어 티셔츠, 캐주얼 웨어, 블라우스, 안감";
    }
  } else if (polymerId === "nylon6") {
    fabricAssessment = `우수한 수분율(${moistureRegain}%)과 산성염료 염색성(${dyeScore}점 최상급)을 보유하며, 극강의 내마모성과 질긴 인장 강도를 자랑합니다.`;
    recommendedUse = "고탄성 레깅스, 란제리/이너웨어, 아웃도어 윈드브레이커, 배낭/어망";
  } else if (polymerId === "pe") {
    if (mw >= 200000) {
      fabricAssessment = `초고분자량(Mw ${mw.toLocaleString()}) PE 특유의 고강도(${tenacity} g/d)와 경량성(비중 0.95), 수분 흡수 제로(0%) 특성을 발휘합니다. 일반 염색은 불가하여 원착 가공이 필수입니다.`;
      recommendedUse = "고강도 산업용 로프, 방탄복/방검복, 초경량 텐트, 낚싯줄";
    } else {
      fabricAssessment = "비극성으로 염색이 불가하며 촉감이 매끄럽고 유연하며 방수성이 탁월한 올레핀 직물입니다.";
      recommendedUse = "농업용 차광막, 방수포(타포린), 포장용 마포";
    }
  } else if (polymerId === "pp") {
    fabricAssessment = `물보다 가벼운 초경량(비중 0.91)과 속건성을 지니며 원착사 착색(${dyeScore}점)으로 색바램이 없습니다.`;
    recommendedUse = "기저귀 탑시트 부직포, 보온 내의, 수영복 안감, 지오텍스타일";
  } else if (polymerId === "pan") {
    fabricAssessment = `양모(Wool)와 유사한 벌키한 촉감과 우수한 보온성을 지니며 양이온 염료 발색성(${dyeScore}점)이 선명합니다.`;
    recommendedUse = "니트 스웨터, 인조 모피, 담요, 카본파이버 전구체";
  } else {
    fabricAssessment = `${spec.name} 특유의 고유 물성과 열적 특성을 가진 기능성 직물 구조입니다.`;
    recommendedUse = spec.name + " 적용 특수 기능성 소재";
  }

  return {
    kes,
    dyeability,
    physical,
    fabricAssessment,
    recommendedUse,
  };
}

export function predictKes(inputs: FiberInputs): KesProperties {
  return predictComprehensive(inputs).kes;
}

export function mapKesToPhysics(kes: KesProperties, shape: CrossSectionShape) {
  const stiffness = clamp(kes.B * 6.5, 0.12, 2.8);
  const drop = clamp((100 - kes.DC) / 72, 0.28, 1.45) * (shape === "hollow" ? 1.12 : 1);
  const waves = Math.round(clamp(4 + kes.G * 1.35, 4, 16));
  const fluteAmp = clamp(0.2 - kes.G * 0.028, 0.035, 0.22);
  const stretch = clamp(kes.EMT / 18, 0.15, 1.2);
  const mass = clamp(kes.W / 22, 0.4, 1.6);
  return { stiffness, drop, waves, fluteAmp, stretch, mass };
}

