import { useState, useMemo } from "react";
import {
  Activity,
  Sliders,
  AlertTriangle,
  CheckCircle2,
  Zap,
  Gauge,
  Flame,
  RotateCcw,
  TrendingDown,
  Info,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  AreaChart,
  Area,
} from "recharts";
import {
  simulatePhysicsDynamics,
  DEFAULT_PHYSICS_PARAMS,
  type PhysicsParams,
} from "../model/mathPhysics";
import type { KesProperties } from "../types";

interface Props {
  kes?: KesProperties;
  className?: string;
  onParamsSyncWith3D?: (params: PhysicsParams) => void;
}

export function MathPhysicsDebugger({ kes, className = "", onParamsSyncWith3D }: Props) {
  // 사용자가 실시간 조작할 수 있는 물리 수치해석 파라미터
  const [params, setParams] = useState<PhysicsParams>(() => {
    if (kes) {
      return {
        ...DEFAULT_PHYSICS_PARAMS,
        stiffnessK: Math.max(20, Math.min(300, kes.B * 150)),
        dampingC: Math.max(0.5, Math.min(5.0, kes.G * 0.8)),
      };
    }
    return DEFAULT_PHYSICS_PARAMS;
  });

  const [activeChartTab, setActiveChartTab] = useState<"energy" | "trajectory" | "phase">("energy");

  // 실시간 수치 시뮬레이션 및 안정성 판별
  const { trajectory, stability } = useMemo(() => {
    return simulatePhysicsDynamics(params, 50);
  }, [params]);

  // 슬라이더 변경 핸들러
  const handleParamChange = (key: keyof PhysicsParams, val: number) => {
    setParams((prev) => {
      const next = { ...prev, [key]: val };
      if (onParamsSyncWith3D) onParamsSyncWith3D(next);
      return next;
    });
  };

  // 기본값 리셋
  const handleReset = () => {
    setParams(DEFAULT_PHYSICS_PARAMS);
    if (onParamsSyncWith3D) onParamsSyncWith3D(DEFAULT_PHYSICS_PARAMS);
  };

  // 위상 공간 궤적 (Phase Space: x vs v)
  const phaseData = useMemo(() => {
    return trajectory.map((t) => ({
      displacement: t.displacement,
      velocity: t.velocity,
    }));
  }, [trajectory]);

  return (
    <div
      className={`flex flex-col h-full bg-[#070b14] border border-emerald-500/20 rounded-2xl overflow-hidden shadow-2xl text-slate-100 ${className}`}
    >
      {/* ─────────────────────────────────────────────────────────────
          1. 패널 헤더: 수치해석 및 PBD 물리 엔진 디버거 툴바
          ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between border-b border-white/10 bg-slate-950/80 px-4 py-2.5 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 border border-emerald-400/30 text-emerald-400">
            <Gauge size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white tracking-wide">
                수치해석 및 PBD(Position-Based Dynamics) 물리 디버거
              </h2>
              <span className="rounded-full bg-emerald-500/10 border border-emerald-400/30 px-2 py-0.5 text-[10px] font-mono text-emerald-300">
                ODE & XPBD Solver Matrix
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              미분 방정식 적분기(RK4 vs PBD), CFL 수치 안정성 및 해밀토니안 에너지 보존 실시간 추적
            </p>
          </div>
        </div>

        {/* 안정성 상태 배지 */}
        <div className="flex items-center gap-2 mt-2 sm:mt-0">
          <div
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border ${
              stability.stabilityStatus === "STABLE"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                : stability.stabilityStatus === "CRITICAL"
                ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                : "bg-rose-500/10 border-rose-500/30 text-rose-300 animate-pulse"
            }`}
          >
            {stability.stabilityStatus === "STABLE" ? (
              <CheckCircle2 size={13} className="text-emerald-400" />
            ) : stability.stabilityStatus === "CRITICAL" ? (
              <AlertTriangle size={13} className="text-amber-400" />
            ) : (
              <Flame size={13} className="text-rose-400" />
            )}
            <span>
              {stability.stabilityStatus === "STABLE"
                ? "수치 해석적 안정 (CFL Stable)"
                : stability.stabilityStatus === "CRITICAL"
                ? "주의: 감쇠 오차 구간"
                : "위험: 강성 폭주 (Stiff Divergence)"}
            </span>
          </div>

          <button
            onClick={handleReset}
            className="flex items-center gap-1 rounded-lg bg-slate-900 border border-white/10 px-2 py-1 text-xs text-slate-300 hover:text-white hover:bg-slate-800 transition"
            title="파라미터 초기화"
          >
            <RotateCcw size={12} />
            <span>초기화</span>
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. 실시간 수학 물리 지표 카드 (CFL, 고유진동수, 감쇠비, 에너지 편차)
          ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-slate-900/40 border-b border-white/10">
        <div className="rounded-xl border border-white/10 bg-slate-950/60 p-2.5">
          <div className="flex items-center justify-between text-slate-400 text-[11px]">
            <span>CFL 조건 번호 (v·dt/dx)</span>
            <span className="font-mono text-emerald-400">≤ 1.0</span>
          </div>
          <p
            className={`mt-1 font-mono text-lg font-bold ${
              stability.cflNumber <= 0.6
                ? "text-emerald-300"
                : stability.cflNumber <= 1.0
                ? "text-amber-300"
                : "text-rose-400"
            }`}
          >
            {stability.cflNumber}
          </p>
          <span className="text-[10px] text-slate-500">파동 전파 격자 한계</span>
        </div>

        <div className="rounded-xl border border-white/10 bg-slate-950/60 p-2.5">
          <div className="flex items-center justify-between text-slate-400 text-[11px]">
            <span>고유 각진동수 (ω₀)</span>
            <Zap size={12} className="text-sky-400" />
          </div>
          <p className="mt-1 font-mono text-lg font-bold text-sky-300">
            {stability.naturalFreqOmega} <span className="text-xs font-normal text-slate-400">rad/s</span>
          </p>
          <span className="text-[10px] text-slate-500">ω₀ = √(k / m)</span>
        </div>

        <div className="rounded-xl border border-white/10 bg-slate-950/60 p-2.5">
          <div className="flex items-center justify-between text-slate-400 text-[11px]">
            <span>감쇠비 (Damping Ratio ζ)</span>
            <TrendingDown size={12} className="text-purple-400" />
          </div>
          <p className="mt-1 font-mono text-lg font-bold text-purple-300">
            {stability.dampingRatioZeta}
          </p>
          <span className="text-[10px] text-slate-500">
            {stability.dampingRatioZeta < 1 ? "과소감쇠 (Underdamped)" : "임계/과감쇠"}
          </span>
        </div>

        <div className="rounded-xl border border-white/10 bg-slate-950/60 p-2.5">
          <div className="flex items-center justify-between text-slate-400 text-[11px]">
            <span>해밀토니안 에너지 드리프트</span>
            <Activity size={12} className="text-amber-400" />
          </div>
          <p className="mt-1 font-mono text-lg font-bold text-amber-300">
            {stability.energyDriftPercent}%
          </p>
          <span className="text-[10px] text-slate-500">최대 제약 오차 {stability.maxConstraintError}cm</span>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. 메인 분석 본문: 좌측 인터랙티브 파라미터 조절기 / 우측 차트
          ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 p-3 flex-1 min-h-0 overflow-y-auto">
        {/* 좌측 (4열): 수치해석 매개변수 실시간 슬라이더 컨트롤러 */}
        <div className="lg:col-span-4 flex flex-col gap-3 rounded-xl border border-white/10 bg-slate-950/80 p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300 mb-1">
            <Sliders size={14} />
            <span>수치해석 제약조건 매개변수 조절</span>
          </div>

          <div className="space-y-3.5 text-xs">
            {/* 스프링 강성 k */}
            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span className="font-medium">스프링 탄성 계수 (k):</span>
                <span className="font-mono text-emerald-400 font-bold">{params.stiffnessK} gf/cm</span>
              </div>
              <input
                type="range"
                min="10"
                max="500"
                step="5"
                value={params.stiffnessK}
                onChange={(e) => handleParamChange("stiffnessK", parseFloat(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <span className="text-[10px] text-slate-500">고분자 공유결합 및 섬유 굽힘 강성(B)</span>
            </div>

            {/* 댐핑 팩터 c */}
            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span className="font-medium">점성 댐핑 팩터 (c):</span>
                <span className="font-mono text-sky-400 font-bold">{params.dampingC.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="8.0"
                step="0.1"
                value={params.dampingC}
                onChange={(e) => handleParamChange("dampingC", parseFloat(e.target.value))}
                className="w-full accent-sky-500 cursor-pointer"
              />
              <span className="text-[10px] text-slate-500">공기 저항 및 고분자 사슬 점탄성 완화</span>
            </div>

            {/* 시간 간격 dt */}
            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span className="font-medium">적분 시간 간격 (Δt):</span>
                <span className="font-mono text-amber-400 font-bold">{params.dtMs} ms</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="10.0"
                step="0.5"
                value={params.dtMs}
                onChange={(e) => handleParamChange("dtMs", parseFloat(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
              <span className="text-[10px] text-slate-500">서브스텝 시간 간격 (크면 폭주/작으면 고비용)</span>
            </div>

            {/* PBD 제약 투영 반복수 */}
            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span className="font-medium">PBD 솔버 반복수 (Iterations):</span>
                <span className="font-mono text-purple-400 font-bold">{params.pbdIterations} 회</span>
              </div>
              <input
                type="range"
                min="1"
                max="25"
                step="1"
                value={params.pbdIterations}
                onChange={(e) => handleParamChange("pbdIterations", parseInt(e.target.value))}
                className="w-full accent-purple-500 cursor-pointer"
              />
              <span className="text-[10px] text-slate-500">Lagrange Multiplier 제약 오차 투영 횟수</span>
            </div>

            {/* 질점 질량 m */}
            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span className="font-medium">단위 질점 질량 (m):</span>
                <span className="font-mono text-cyan-400 font-bold">{params.massM} g</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="3.0"
                step="0.1"
                value={params.massM}
                onChange={(e) => handleParamChange("massM", parseFloat(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer"
              />
              <span className="text-[10px] text-slate-500">직물 면밀도(W) 및 단량체 분자량 연동</span>
            </div>
          </div>

          {/* 수학적 진단 가이드 */}
          <div className="mt-auto rounded-lg bg-black/40 p-2.5 border border-white/5 text-[11px] text-slate-300 leading-relaxed">
            <div className="flex items-start gap-1.5 text-amber-300 mb-1 font-semibold">
              <Info size={13} className="shrink-0 mt-0.5" />
              <span>수치해석 안정성 코멘트</span>
            </div>
            <p>{stability.stabilityMessage}</p>
          </div>
        </div>

        {/* 우측 (8열): 실시간 그래프 (에너지 보존, PBD vs RK4 궤적 비교, 위상 공간) */}
        <div className="lg:col-span-8 flex flex-col rounded-xl border border-white/10 bg-slate-950/80 p-3 min-h-[340px]">
          {/* 차트 탭 바 */}
          <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setActiveChartTab("energy")}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                  activeChartTab === "energy"
                    ? "bg-emerald-500 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                해밀토니안 에너지 (T + V = E)
              </button>
              <button
                onClick={() => setActiveChartTab("trajectory")}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                  activeChartTab === "trajectory"
                    ? "bg-emerald-500 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                PBD vs RK4 궤적 비교
              </button>
              <button
                onClick={() => setActiveChartTab("phase")}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                  activeChartTab === "phase"
                    ? "bg-emerald-500 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                위상 공간 포트레이트 (x vs v)
              </button>
            </div>

            <span className="text-[10px] text-slate-500 font-mono">
              Steps N = {trajectory.length} | dt = {params.dtMs}ms
            </span>
          </div>

          {/* 차트 컨테이너 */}
          <div className="flex-1 min-h-[260px]">
            {activeChartTab === "energy" ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trajectory} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="timeMs" tick={{ fill: "#94a3b8", fontSize: 10 }} unit="ms" />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      borderColor: "#334155",
                      borderRadius: "8px",
                      fontSize: "11px",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "5px" }} />
                  <Area
                    type="monotone"
                    dataKey="kineticEnergy"
                    name="운동 에너지 (T)"
                    stroke="#0ea5e9"
                    fill="#0ea5e9"
                    fillOpacity={0.25}
                  />
                  <Area
                    type="monotone"
                    dataKey="potentialEnergy"
                    name="탄성 위치 에너지 (V)"
                    stroke="#10b981"
                    fill="#10b981"
                    fillOpacity={0.25}
                  />
                  <Area
                    type="monotone"
                    dataKey="totalEnergy"
                    name="총 역학적 에너지 (H)"
                    stroke="#f59e0b"
                    fill="none"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : activeChartTab === "trajectory" ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trajectory} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="timeMs" tick={{ fill: "#94a3b8", fontSize: 10 }} unit="ms" />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} unit="cm" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      borderColor: "#334155",
                      borderRadius: "8px",
                      fontSize: "11px",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "5px" }} />
                  <Line
                    type="monotone"
                    dataKey="displacement"
                    name="PBD 제약 투영 변위"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="rk4Displacement"
                    name="RK4 고정밀 기준 변위"
                    stroke="#818cf8"
                    strokeWidth={1.8}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="constraintResidual"
                    name="제약 오차 잔차 |C|"
                    stroke="#f43f5e"
                    strokeWidth={1}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={phaseData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="displacement" tick={{ fill: "#94a3b8", fontSize: 10 }} name="변위 x(t)" unit="cm" />
                  <YAxis dataKey="velocity" tick={{ fill: "#94a3b8", fontSize: 10 }} name="속도 v(t)" unit="cm/s" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      borderColor: "#334155",
                      borderRadius: "8px",
                      fontSize: "11px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="velocity"
                    name="위상 궤도 (Phase Orbit)"
                    stroke="#ec4899"
                    strokeWidth={2}
                    dot={{ r: 2, fill: "#ec4899" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
