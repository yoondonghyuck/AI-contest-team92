/**
 * 수치해석(Numerical Analysis) 및 PBD(Position-Based Dynamics) 시뮬레이션 모델
 * 비선형 탄성 제약조건, 오일러/베를레/RK4/XPBD 적분, CFL 수치 안정성 및 해밀토니안 보존 분석
 */

export interface PhysicsParams {
  stiffnessK: number; // 스프링 강성 계수 k (N/m or gf/cm)
  dampingC: number; // 감쇠 계수 c (N·s/m)
  massM: number; // 질점 질량 m (g)
  dtMs: number; // 시간 간격 dt (ms)
  pbdIterations: number; // PBD 제약 투영 반복수 (1 ~ 30)
  gravityG: number; // 중력 가속도 g (m/s²)
  restLength: number; // 초기 자연장 l0 (cm)
}

export interface SimulationStepResult {
  timeMs: number;
  displacement: number; // x(t) 변위 (cm)
  velocity: number; // v(t) 속도 (cm/s)
  kineticEnergy: number; // T = 0.5 * m * v^2
  potentialEnergy: number; // V = 0.5 * k * x^2
  totalEnergy: number; // E = T + V
  constraintResidual: number; // |C(x)| = |(|x| - l0)| 제약 오차
  rk4Displacement: number; // RK4 기준 진정한 해석해/고정밀도 비교군
  rk4Velocity: number;
}

export interface StabilityAnalysis {
  cflNumber: number; // CFL 수치 조건 v_wave * dt / dx
  naturalFreqOmega: number; // 고유 진동수 omega0 = sqrt(k/m)
  dampingRatioZeta: number; // 감쇠비 zeta = c / (2 * sqrt(m * k))
  stabilityStatus: "STABLE" | "CRITICAL" | "UNSTABLE_STIFF";
  stabilityMessage: string;
  energyDriftPercent: number; // E_final / E_initial 오차
  maxConstraintError: number;
}

export const DEFAULT_PHYSICS_PARAMS: PhysicsParams = {
  stiffnessK: 120.0, // 120 gf/cm
  dampingC: 1.8,
  massM: 0.5,
  dtMs: 2.0, // 2 ms
  pbdIterations: 8,
  gravityG: 9.8,
  restLength: 5.0,
};

/**
 * 1자유도/다자유도 PBD 및 수치 적분 시뮬레이션을 생성하고 안정성을 분석
 */
export function simulatePhysicsDynamics(
  params: PhysicsParams,
  stepsCount = 60
): {
  trajectory: SimulationStepResult[];
  stability: StabilityAnalysis;
} {
  const { stiffnessK, dampingC, massM, dtMs, pbdIterations, restLength } = params;
  const dt = dtMs / 1000.0; // 초 단위 변환
  const m = Math.max(0.01, massM);
  const k = Math.max(0.1, stiffnessK);
  const c = Math.max(0.0, dampingC);

  // 고유 진동수 및 감쇠비
  const naturalFreqOmega = Math.sqrt(k / m);
  const dampingRatioZeta = c / (2 * Math.sqrt(m * k));

  // 파동 속도 및 CFL 수
  // 파동 속도 v_wave = sqrt(k / (m / l0))
  const waveSpeed = Math.sqrt(k / (m / restLength));
  const dx = restLength;
  const cflNumber = Number(((waveSpeed * dt) / dx).toFixed(4));

  let stabilityStatus: StabilityAnalysis["stabilityStatus"] = "STABLE";
  let stabilityMessage = "수치적으로 무조건 안정(Unconditionally Stable) 영역입니다.";

  // 오일러 적분의 안정성 한계: dt < 2 / omega
  const criticalDtEuler = 2.0 / naturalFreqOmega;
  if (dt > criticalDtEuler && pbdIterations < 3) {
    stabilityStatus = "UNSTABLE_STIFF";
    stabilityMessage = `경고: 시간 간격(dt=${(dt * 1000).toFixed(1)}ms)이 강성 한계(${(criticalDtEuler * 1000).toFixed(1)}ms)를 초과하여 명시적 발산 위험이 있습니다! PBD 반복수를 늘려 제약을 투영하세요.`;
  } else if (cflNumber > 0.8 || pbdIterations < 2) {
    stabilityStatus = "CRITICAL";
    stabilityMessage = "주의: CFL 한계 근접. 빠른 진동 주기로 인한 수치적 댐핑 오차가 일부 발생할 수 있습니다.";
  }

  // 초기 상태: 외력(중력 또는 인장 변위 x0 = restLength * 1.5)
  const initialX = restLength * 1.45;
  let posX = initialX;
  let velX = 0;

  // RK4 기준 벤치마크 상태
  let rkX = initialX;
  let rkV = 0;

  const trajectory: SimulationStepResult[] = [];
  const initialEnergy = 0.5 * k * Math.pow(posX - restLength, 2);

  let maxResidual = 0;

  for (let step = 0; step < stepsCount; step++) {
    const timeMs = Number((step * dtMs).toFixed(1));

    // 1. PBD (Position-Based Dynamics) 예측 & 제약 투영 단계
    // a. 속도 감쇠 및 위치 외삽
    velX = velX * Math.exp((-c / m) * dt);
    const predictedX = posX + velX * dt;

    // b. 제약 조건 투영: C(p) = p - restLength = 0
    // Compliance alpha = 1 / (k * dt^2) (XPBD 가중 투영)
    const alpha = 1.0 / (k * 0.05 + 1e-6);
    let pIter = predictedX;
    for (let iter = 0; iter < pbdIterations; iter++) {
      const constraint = pIter - restLength;
      const w = 1.0 / m;
      const dlambda = -constraint / (w + alpha / Math.max(1e-6, dt * dt));
      pIter += w * dlambda * 0.25; // 완화 계수
    }

    // c. 새로운 속도 역산
    velX = (pIter - posX) / dt;
    posX = pIter;

    // 제약 잔차 오차
    const residual = Math.abs(posX - restLength);
    if (residual > maxResidual) maxResidual = residual;

    // 에너지 계산
    const kineticEnergy = 0.5 * m * Math.pow(velX, 2);
    const potentialEnergy = 0.5 * k * Math.pow(posX - restLength, 2);
    const totalEnergy = kineticEnergy + potentialEnergy;

    // 2. 고정밀 4차 룽게-쿠타 (RK4) 적분 대조군 계산
    // f(x, v) = dx/dt = v, dv/dt = (-k(x - l0) - c v) / m
    const deriv = (x: number, v: number): [number, number] => {
      const dv = (-k * (x - restLength) - c * v) / m;
      return [v, dv];
    };

    const [k1x, k1v] = deriv(rkX, rkV);
    const [k2x, k2v] = deriv(rkX + 0.5 * dt * k1x, rkV + 0.5 * dt * k1v);
    const [k3x, k3v] = deriv(rkX + 0.5 * dt * k2x, rkV + 0.5 * dt * k2v);
    const [k4x, k4v] = deriv(rkX + dt * k3x, rkV + dt * k3v);

    rkX += (dt / 6) * (k1x + 2 * k2x + 2 * k3x + k4x);
    rkV += (dt / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);

    trajectory.push({
      timeMs,
      displacement: Number(posX.toFixed(3)),
      velocity: Number(velX.toFixed(3)),
      kineticEnergy: Number(kineticEnergy.toFixed(4)),
      potentialEnergy: Number(potentialEnergy.toFixed(4)),
      totalEnergy: Number(totalEnergy.toFixed(4)),
      constraintResidual: Number(residual.toFixed(4)),
      rk4Displacement: Number(rkX.toFixed(3)),
      rk4Velocity: Number(rkV.toFixed(3)),
    });
  }

  const finalEnergy = trajectory[trajectory.length - 1].totalEnergy;
  const energyDriftPercent = Number(
    (Math.abs(finalEnergy - initialEnergy) / Math.max(1e-4, initialEnergy) * 100).toFixed(2)
  );

  return {
    trajectory,
    stability: {
      cflNumber,
      naturalFreqOmega: Number(naturalFreqOmega.toFixed(2)),
      dampingRatioZeta: Number(dampingRatioZeta.toFixed(3)),
      stabilityStatus,
      stabilityMessage,
      energyDriftPercent,
      maxConstraintError: Number(maxResidual.toFixed(4)),
    },
  };
}
