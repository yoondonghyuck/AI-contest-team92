import type { MolecularDescriptor } from "./model/molecularDescriptor";

export type CrossSectionShape = "circular" | "trilobal" | "hollow";

export interface FiberInputs {
  polymerId: string;
  repeatCount: number; // 중합도 n (기본값 1, 1 ~ 50,000)
  molecularWeight: number; // 분자량 Mw (g/mol)
  denier: number; // 섬도 (0.5 ~ 10.0 D)
  crystallinity: number; // 결정화도 (0.20 ~ 0.90, 20% ~ 90%)
  lengthMm: number; // 섬유 길이 (10 ~ 150 mm)
  crimpCpi: number; // 권축수 (0 ~ 30 CPI)
  shape: CrossSectionShape; // 단면 형상
  // 신규 추가된 섬유 방사 공학 미세 변수들
  drawRatio: number; // 연신비 Draw Ratio (1.0x ~ 6.0x)
  spinningSpeed: number; // 방사 권취 속도 (1,000 ~ 6,000 m/min)
  modificationRatio: number; // 단면 이형도/중공률 (1.0 ~ 3.0)
  // 2D/3D 스케치 분자 구조 특성값 연동
  customDescriptor?: MolecularDescriptor;
}

export interface KesProperties {
  B: number; // 굽힘 강성 (gf·cm²/cm)
  G: number; // 전단 강성 (gf/(cm·deg))
  EMT: number; // 인장 신장률 (%)
  W: number; // 면밀도 (mg/cm²)
  H0: number; // 직물 두께 (mm)
  DC: number; // 드레이프 계수 (%)
}

export interface DyeabilityInfo {
  score: number; // 0 ~ 100
  grade: "최우수" | "우수" | "양호" | "조건부 염색" | "염색 난이도 높음" | "염색 불가 (원착 필수)";
  dyeType: string; // 적용 염료 (분산염료, 산성염료, 양이온염료 등)
  tempCelsius: number; // 권장 염색 온도 (℃)
  colorDepth: string; // 겉보기 색 농도 (K/S)
  mechanism: string; // 염색 메커니즘
  washingFastness: string; // 세탁 견뢰도
  lightFastness: string; // 일광 견뢰도
  dopeDyeingRecommended: boolean; // 원착사(마스터배치) 필요 여부
}

export interface PhysicalProperties {
  tenacity: number; // 섬유 인장강도 (g/d)
  elongationBreak: number; // 파단신도 (%)
  modulus: number; // 초기 탄성률 (g/d)
  moistureRegain: number; // 공정 수분율 (%)
  meltingTemp: number; // 융점 Tm (℃)
  glassTemp: number; // 유리전이온도 Tg (℃)
  orientationFactor: number; // 분자 사슬 배향 계수 (0.0 ~ 1.0)
}

export interface ComprehensiveProperties {
  kes: KesProperties;
  dyeability: DyeabilityInfo;
  physical: PhysicalProperties;
  fabricAssessment: string;
  recommendedUse: string;
}

export const SHAPE_LABELS: Record<CrossSectionShape, string> = {
  circular: "원형 Circular (표준)",
  trilobal: "삼엽형 Trilobal (실크 광택·심색성)",
  hollow: "중공형 Hollow (경량·보온)",
};

// 기본값: 사용자의 요청대로 반복단위 기본값 전부 1로 설정
export const DEFAULT_INPUTS: FiberInputs = {
  polymerId: "pet",
  repeatCount: 1, // 반복단위 기본값: 1
  molecularWeight: 192.2, // PET 1단위 단량체 분자량
  denier: 2.4,
  crystallinity: 0.48,
  lengthMm: 51,
  crimpCpi: 12,
  shape: "circular",
  drawRatio: 3.2, // 표준 연신비 3.2x
  spinningSpeed: 3200, // 3,200 m/min
  modificationRatio: 1.8, // 삼엽/중공 이형도
};
