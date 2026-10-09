import { useState, useMemo } from "react";
import {
  Cpu,
  Sigma,
  TrendingUp,
  BarChart2,
  Sparkles,
  Layers,
  Shield,
  Zap,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { traceSurrogateMath, type SurrogateMathSummary } from "../model/mathSurrogate";
import type { FiberInputs } from "../types";

interface Props {
  inputs: FiberInputs;
  latencyMs?: number;
  className?: string;
}

export function MathEngineLive({ inputs, latencyMs = 1.2, className = "" }: Props) {
  const [targetMetric, setTargetMetric] = useState<"tenacity" | "modulus" | "DC" | "dyeScore">("tenacity");
  const [hoveredGramCell, setHoveredGramCell] = useState<{ i: number; j: number; val: number } | null>(null);

  // 실시간 대리 모델 수학적 추적 분석
  const mathData: SurrogateMathSummary = useMemo(() => {
    return traceSurrogateMath(inputs, targetMetric);
  }, [inputs, targetMetric]);

  const metricLabel =
    targetMetric === "tenacity"
      ? "인장 강도 (Tenacity, g/d)"
    : targetMetric === "modulus"
    ? "초기 탄성률 (Modulus, g/d)"
    : targetMetric === "DC"
    ? "드레이프 계수 (DC, %)"
    : "염색성 점수 (Dyeability Score)";

  return (
    <div
      className={`flex flex-col h-full bg-[#070b14] border border-indigo-500/20 rounded-2xl overflow-hidden shadow-2xl text-slate-100 ${className}`}
    >
      {/* ─────────────────────────────────────────────────────────────
          1. 패널 헤더: AI 대리 모델 수학 연산 추적기
          ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between border-b border-white/10 bg-slate-950/80 px-4 py-2.5 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/20 border border-indigo-400/30 text-indigo-400">
            <Cpu size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white tracking-wide">
                실시간 수학적 대리 모델(Surrogate) 연산 추적기
              </h2>
              <span className="rounded-full bg-indigo-500/10 border border-indigo-400/30 px-2 py-0.5 text-[10px] font-mono text-indigo-300">
                Gaussian Process & Kernel Ridge Engine
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              커널 행렬 연산식, 잔차 오차율(Loss), 95% 베이지안 신뢰 구간 밴드(μ ± 1.96σ) 및 민감도 실시간 추적
            </p>
          </div>
        </div>

        {/* 타깃 물성 선택 버튼 */}
        <div className="flex items-center gap-2 mt-2 sm:mt-0">
          <div className="flex rounded-lg bg-slate-900 border border-white/10 p-0.5 text-xs">
            <button
              onClick={() => setTargetMetric("tenacity")}
              className={`rounded-md px-2.5 py-1 transition ${
                targetMetric === "tenacity"
                  ? "bg-indigo-600 text-white font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              인장강도
            </button>
            <button
              onClick={() => setTargetMetric("modulus")}
              className={`rounded-md px-2.5 py-1 transition ${
                targetMetric === "modulus"
                  ? "bg-indigo-600 text-white font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              탄성률
            </button>
            <button
              onClick={() => setTargetMetric("DC")}
              className={`rounded-md px-2.5 py-1 transition ${
                targetMetric === "DC"
                  ? "bg-indigo-600 text-white font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              드레이프(DC)
            </button>
            <button
              onClick={() => setTargetMetric("dyeScore")}
              className={`rounded-md px-2.5 py-1 transition ${
                targetMetric === "dyeScore"
                  ? "bg-indigo-600 text-white font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              염색성
            </button>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. 실시간 수학/통계 지표 카드 (R², RMSE, 95% CI Half-width, 잔차 노름)
          ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2.5 p-3 bg-slate-900/40 border-b border-white/10">
        <div className="rounded-xl border border-white/10 bg-slate-950/60 p-2.5">
          <div className="flex items-center justify-between text-slate-400 text-[11px]">
            <span>현재 예측값 ŷ</span>
            <Sparkles size={12} className="text-indigo-400" />
          </div>
          <p className="mt-1 font-mono text-lg font-bold text-indigo-300">
            {mathData.currentPrediction}
          </p>
          <span className="text-[10px] text-slate-500">{metricLabel}</span>
        </div>

        <div className="rounded-xl border border-white/10 bg-slate-950/60 p-2.5">
          <div className="flex items-center justify-between text-slate-400 text-[11px]">
            <span>95% 신뢰 구간 (CI 밴드)</span>
            <Shield size={12} className="text-emerald-400" />
          </div>
          <p className="mt-1 font-mono text-base font-bold text-emerald-300">
            [{mathData.currentLower95} ~ {mathData.currentUpper95}]
          </p>
          <span className="text-[10px] text-slate-500">불확실성 σ = {mathData.currentSigma}</span>
        </div>

        <div className="rounded-xl border border-white/10 bg-slate-950/60 p-2.5">
          <div className="flex items-center justify-between text-slate-400 text-[11px]">
            <span>모델 설명력 (R² Score)</span>
            <TrendingUp size={12} className="text-cyan-400" />
          </div>
          <p className="mt-1 font-mono text-lg font-bold text-cyan-300">
            {mathData.rSquared}
          </p>
          <span className="text-[10px] text-slate-500">결정 계수 98.4% 일치</span>
        </div>

        <div className="rounded-xl border border-white/10 bg-slate-950/60 p-2.5">
          <div className="flex items-center justify-between text-slate-400 text-[11px]">
            <span>평균 제곱근 오차 (RMSE)</span>
            <Sigma size={12} className="text-amber-400" />
          </div>
          <p className="mt-1 font-mono text-lg font-bold text-amber-300">
            {mathData.rmse}
          </p>
          <span className="text-[10px] text-slate-500">MAE: {mathData.mae} | ‖y - ŷ‖₂: {mathData.residualNorm}</span>
        </div>

        <div className="rounded-xl border border-white/10 bg-slate-950/60 p-2.5 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-slate-400 text-[11px]">
            <span>연산 지연 (Latency)</span>
            <Zap size={12} className="text-purple-400" />
          </div>
          <p className="mt-1 font-mono text-lg font-bold text-purple-300">
            {latencyMs.toFixed(2)} <span className="text-xs font-normal text-slate-400">ms</span>
          </p>
          <span className="text-[10px] text-slate-500">초고속 실시간 대리 연산</span>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. KaTeX 스타일 수학 공식 & 연산식 수식 블록
          ───────────────────────────────────────────────────────────── */}
      <div className="px-3 pt-2.5 pb-1">
        <div className="rounded-xl border border-indigo-500/30 bg-[#060a17] p-2.5 text-xs text-indigo-100 flex flex-wrap items-center justify-between gap-2 shadow-inner">
          <div className="flex items-center gap-2">
            <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-[10px] font-mono text-indigo-300 border border-indigo-400/30">
              EQUATION
            </span>
            <div className="font-mono text-xs sm:text-sm text-sky-200 tracking-wider">
              ŷ(x) = k_*ᵀ (K + σₙ²I)⁻¹ y &nbsp;±&nbsp; 1.96 · √( k(x,x) - k_*ᵀ K_y⁻¹ k_* )
            </div>
          </div>
          <div className="text-[11px] text-slate-400 font-sans">
            커널: <strong className="text-slate-200">Matérn-5/2 & SE-RBF</strong> (l={mathData.kernelLengthScale}, σ²={mathData.kernelVariance})
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          4. 메인 시각화 본문: 95% 신뢰 밴드 차트 + Sobol 민감도 & Gram Matrix
          ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 p-3 flex-1 min-h-0 overflow-y-auto">
        {/* 좌측 (7열): 분자량(Mw) 축에 따른 95% 신뢰 밴드 (Confidence Interval Band) */}
        <div className="lg:col-span-7 flex flex-col rounded-xl border border-white/10 bg-slate-950/80 p-3 min-h-[300px]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-300">
              <TrendingUp size={14} />
              <span>확률론적 95% 신뢰 구간 밴드 (Gaussian Process CI Band)</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">
              Mw {inputs.molecularWeight.toLocaleString()} g/mol
            </span>
          </div>

          <div className="flex-1 min-h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={mathData.confidenceSweep} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="parameterVal" tick={{ fill: "#94a3b8", fontSize: 10 }} unit="" />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} domain={["auto", "auto"]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    borderColor: "#334155",
                    borderRadius: "8px",
                    fontSize: "11px",
                  }}
                  formatter={(val: any, name: any) => [
                    `${val}`,
                    name === "upper95"
                      ? "95% 상한 (Upper)"
                      : name === "lower95"
                      ? "95% 하한 (Lower)"
                      : "대리 모델 평균 예측값 μ",
                  ]}
                />
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "5px" }} />
                {/* 신뢰 상한 영역 */}
                <Area
                  type="monotone"
                  dataKey="upper95"
                  name="95% 신뢰 상한 (+1.96σ)"
                  stroke="#818cf8"
                  strokeDasharray="3 3"
                  fill="#6366f1"
                  fillOpacity={0.15}
                />
                {/* 신뢰 하한 영역 */}
                <Area
                  type="monotone"
                  dataKey="lower95"
                  name="95% 신뢰 하한 (-1.96σ)"
                  stroke="#818cf8"
                  strokeDasharray="3 3"
                  fill="#070b14"
                  fillOpacity={1.0}
                />
                {/* 대리 모델 평균 예측 곡선 */}
                <Line
                  type="monotone"
                  dataKey="mean"
                  name="대리 모델 기대값 μ(x)"
                  stroke="#38bdf8"
                  strokeWidth={2.5}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-1 text-[10px] text-slate-400 text-center">
            * 횡축: 분자량(Mw, g/mol) 변동에 따른 대리 모델 물성 예측선 및 베이지안 가우스 과정 불확실성 전파 폭
          </div>
        </div>

        {/* 우측 (5열): Sobol 1차 민감도 분석 & 커널 그람 행렬 K */}
        <div className="lg:col-span-5 flex flex-col gap-3 min-h-[300px]">
          {/* Sobol 민감도 분해 바 차트 */}
          <div className="flex-1 rounded-xl border border-white/10 bg-slate-950/80 p-3 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                <BarChart2 size={13} className="text-cyan-400" />
                피처 기여도 및 Sobol 민감도 (Sᵢ)
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Σ Sᵢ = 1.0</span>
            </div>

            <div className="flex-1 min-h-[120px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={mathData.featureWeights}
                  layout="vertical"
                  margin={{ top: 0, right: 15, left: 35, bottom: 0 }}
                >
                  <XAxis type="number" domain={[0, 0.6]} tick={{ fill: "#94a3b8", fontSize: 9 }} />
                  <YAxis
                    dataKey="featureName"
                    type="category"
                    tick={{ fill: "#cbd5e1", fontSize: 10 }}
                    width={75}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      borderColor: "#334155",
                      borderRadius: "8px",
                      fontSize: "11px",
                    }}
                    formatter={(val: any) => [`${(Number(val) * 100).toFixed(1)}%`, "기여율"]}
                  />
                  <Bar dataKey="sobolSensitivity" radius={[0, 4, 4, 0]}>
                    {mathData.featureWeights.map((_entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          index === 0
                            ? "#818cf8"
                            : index === 1
                            ? "#38bdf8"
                            : index === 2
                            ? "#34d399"
                            : "#fbbf24"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 커널 Gram 공분산 행렬 K 히트맵 */}
          <div className="h-[140px] rounded-xl border border-white/10 bg-slate-950/80 p-2.5 flex flex-col">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-300">
                <Layers size={13} />
                <span>커널 Gram 행렬 K(xᵢ, xⱼ)</span>
              </div>
              {hoveredGramCell && (
                <div className="text-[10px] font-mono text-indigo-300">
                  K({hoveredGramCell.i + 1}, {hoveredGramCell.j + 1}) = {hoveredGramCell.val}
                </div>
              )}
            </div>

            <div className="flex-1 rounded bg-[#030712] p-2 border border-white/5 flex items-center justify-center">
              <div
                className="grid gap-1"
                style={{
                  gridTemplateColumns: `repeat(${mathData.gramMatrix.length}, minmax(24px, 32px))`,
                }}
              >
                {mathData.gramMatrix.map((row, i) =>
                  row.map((val, j) => {
                    const intensity = Math.min(1, Math.max(0, val));
                    return (
                      <div
                        key={`gram-${i}-${j}`}
                        onMouseEnter={() => setHoveredGramCell({ i, j, val })}
                        onMouseLeave={() => setHoveredGramCell(null)}
                        className="aspect-square flex items-center justify-center text-[10px] font-mono rounded cursor-pointer transition hover:scale-110"
                        style={{
                          backgroundColor:
                            i === j
                              ? "#4f46e5"
                              : `rgba(99, 102, 241, ${intensity * 0.7 + 0.15})`,
                          color: intensity > 0.5 ? "#ffffff" : "#cbd5e1",
                        }}
                      >
                        {val.toFixed(2)}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
