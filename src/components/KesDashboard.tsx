import { useState } from "react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import {
  Droplets,
  Gauge,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  Thermometer,
  Activity,
  Award,
  Calculator,
  Network,
  Cpu,
  Maximize2,
} from "lucide-react";
import type { ComprehensiveProperties, KesProperties, FiberInputs } from "../types";
import type { PolymerDefinition } from "../model/polymers";
import type { AtomNode, BondEdge } from "./MolDrawCanvas";
import { MathTopologyPanel } from "./MathTopologyPanel";
import { MathPhysicsDebugger } from "./MathPhysicsDebugger";
import { MathEngineLive } from "./MathEngineLive";
import { ResearchValuePanel } from "./ResearchValuePanel";

const METRICS: {
  key: keyof KesProperties;
  label: string;
  unit: string;
  max: number;
  digits: number;
}[] = [
  { key: "B", label: "굽힘 강성 B", unit: "gf·cm²/cm", max: 1.5, digits: 3 },
  { key: "G", label: "전단 강성 G", unit: "gf/(cm·deg)", max: 6.5, digits: 2 },
  { key: "EMT", label: "인장 신장률 EMT", unit: "%", max: 25, digits: 1 },
  { key: "W", label: "면밀도 W", unit: "mg/cm²", max: 35, digits: 1 },
  { key: "H0", label: "두께 2H₀", unit: "mm", max: 1.6, digits: 3 },
  { key: "DC", label: "드레이프 DC", unit: "%", max: 95, digits: 1 },
];

interface Props {
  props: ComprehensiveProperties;
  latencyMs: number;
  currentPolymer?: PolymerDefinition;
  inputs?: FiberInputs;
  onOpenMathLab?: () => void;
  sketchAtoms?: AtomNode[];
  sketchBonds?: BondEdge[];
}

export function KesDashboard({
  props,
  latencyMs,
  currentPolymer,
  inputs,
  onOpenMathLab,
  sketchAtoms,
  sketchBonds,
}: Props) {
  const { kes, dyeability, physical, fabricAssessment, recommendedUse } = props;
  const [activeTab, setActiveTab] = useState<"comprehensive" | "radar" | "mathLab" | "researchValue">("comprehensive");
  const [mathSubTab, setMathSubTab] = useState<"topology" | "physics" | "surrogate">("topology");

  const radar = METRICS.map((m) => ({
    metric: m.key,
    value: Math.min(100, (kes[m.key] / m.max) * 100),
  }));

  // 염색성 점수에 따른 색상
  const getDyeScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-400 border-emerald-500/30 bg-emerald-500/10";
    if (score >= 60) return "text-sky-400 border-sky-500/30 bg-sky-500/10";
    if (score >= 40) return "text-amber-400 border-amber-500/30 bg-amber-500/10";
    return "text-rose-400 border-rose-500/30 bg-rose-500/10";
  };

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden bg-[#090e1a] p-3 text-slate-100">
      {/* 탭 헤더 */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("comprehensive")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition ${
              activeTab === "comprehensive"
                ? "bg-sky-500 text-white shadow-sm"
                : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
            }`}
          >
            <Droplets size={13} />
            <span>염색성 & 물리/열적 특성</span>
          </button>
          <button
            onClick={() => setActiveTab("radar")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition ${
              activeTab === "radar"
                ? "bg-sky-500 text-white shadow-sm"
                : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
            }`}
          >
            <Activity size={13} />
            <span>KES-FB 역학 레이더 차트</span>
          </button>
          <button
            onClick={() => setActiveTab("mathLab")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition ${
              activeTab === "mathLab"
                ? "bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow-md shadow-indigo-500/20"
                : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
            }`}
          >
            <Calculator size={13} />
            <span>수학·물리 엔진 분석 (Math Lab)</span>
          </button>
          <button
            onClick={() => setActiveTab("researchValue")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition ${
              activeTab === "researchValue"
                ? "bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 text-white shadow-md shadow-amber-500/20"
                : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
            }`}
          >
            <Award size={13} />
            <span>신소재 R&D 가치성 평가</span>
          </button>
        </div>

        <div className="flex items-center gap-2.5 text-[10px] text-slate-500">
          {onOpenMathLab && (
            <button
              onClick={onOpenMathLab}
              className="flex items-center gap-1 rounded-md bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 px-2 py-0.5 text-[11px] font-medium transition"
              title="수학·물리 분석 랩 대화면 스튜디오 열기"
            >
              <Maximize2 size={11} />
              <span>전용 랩 스튜디오</span>
            </button>
          )}
          <span>대리 모델 연산: <strong className="text-sky-400 font-mono">{latencyMs.toFixed(1)}ms</strong></span>
        </div>
      </div>

      {/* 탭 내용 영역 */}
      <div className="flex-1 min-h-0 overflow-y-auto pt-2.5">
        {activeTab === "researchValue" ? (
          <ResearchValuePanel
            currentPolymer={currentPolymer || ({} as any)}
            inputs={inputs || ({} as any)}
            comprehensive={props}
            sketchAtoms={sketchAtoms}
            sketchBonds={sketchBonds}
          />
        ) : activeTab === "comprehensive" ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* 1. 염색성 정밀 진단 카드 */}
            <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Droplets size={15} className="text-sky-400" />
                    <h3 className="text-xs font-semibold text-white">염색성 (Dyeability) 평가</h3>
                  </div>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${getDyeScoreColor(
                      dyeability.score
                    )}`}
                  >
                    {dyeability.grade} ({dyeability.score}점)
                  </span>
                </div>

                {/* 프로그레스 바 */}
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className={`h-full transition-all duration-300 ${
                      dyeability.score >= 70
                        ? "bg-emerald-400"
                        : dyeability.score >= 40
                        ? "bg-sky-400"
                        : "bg-rose-500"
                    }`}
                    style={{ width: `${dyeability.score}%` }}
                  />
                </div>

                <div className="mt-2.5 space-y-1.5 text-[11px]">
                  <div className="flex justify-between border-b border-white/5 pb-1">
                    <span className="text-slate-400">적용 염료:</span>
                    <span className="font-medium text-sky-200 text-right">{dyeability.dyeType}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-1">
                    <span className="text-slate-400">적정 염색 온도:</span>
                    <span className="font-mono text-amber-300">{dyeability.tempCelsius} ℃</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-1">
                    <span className="text-slate-400">발색성/심색도:</span>
                    <span className="text-emerald-300 text-right">{dyeability.colorDepth}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">견뢰도:</span>
                    <span className="text-slate-300">{dyeability.washingFastness}</span>
                  </div>
                </div>
              </div>

              {/* 염색 기전 및 조언 */}
              <div className="mt-2 rounded-lg bg-black/40 p-2 text-[10px] text-slate-300 leading-tight">
                {dyeability.dopeDyeingRecommended ? (
                  <p className="flex items-start gap-1 text-rose-300">
                    <ShieldAlert size={12} className="shrink-0 mt-0.5" />
                    <span>{dyeability.mechanism}</span>
                  </p>
                ) : (
                  <p className="flex items-start gap-1 text-slate-300">
                    <ShieldCheck size={12} className="shrink-0 text-emerald-400 mt-0.5" />
                    <span>{dyeability.mechanism}</span>
                  </p>
                )}
              </div>
            </div>

            {/* 2. 물리 및 열적 특성 카드 */}
            <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Gauge size={15} className="text-emerald-400" />
                  <h3 className="text-xs font-semibold text-white">물리/역학 & 열적 지표</h3>
                </div>

                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-lg bg-white/5 p-2">
                    <p className="text-[10px] text-slate-400">인장 강도 (Tenacity)</p>
                    <p className="mt-0.5 font-mono text-base font-bold text-emerald-300">
                      {physical.tenacity} <span className="text-[10px] font-normal text-slate-400">g/d</span>
                    </p>
                  </div>
                  <div className="rounded-lg bg-white/5 p-2">
                    <p className="text-[10px] text-slate-400">초기 탄성률 (Modulus)</p>
                    <p className="mt-0.5 font-mono text-base font-bold text-sky-300">
                      {physical.modulus} <span className="text-[10px] font-normal text-slate-400">g/d</span>
                    </p>
                  </div>
                  <div className="rounded-lg bg-white/5 p-2">
                    <p className="text-[10px] text-slate-400">파단 신도 (Elongation)</p>
                    <p className="mt-0.5 font-mono text-base font-bold text-purple-300">
                      {physical.elongationBreak} <span className="text-[10px] font-normal text-slate-400">%</span>
                    </p>
                  </div>
                  <div className="rounded-lg bg-white/5 p-2">
                    <p className="text-[10px] text-slate-400">공정 수분율 (Regain)</p>
                    <p className="mt-0.5 font-mono text-base font-bold text-cyan-300">
                      {physical.moistureRegain} <span className="text-[10px] font-normal text-slate-400">%</span>
                    </p>
                  </div>
                </div>

                {/* 열적 특성 */}
                <div className="mt-2.5 flex items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/5 px-2.5 py-1.5 text-[11px]">
                  <span className="flex items-center gap-1 text-slate-300">
                    <Thermometer size={12} className="text-amber-400" />
                    열전이 온도:
                  </span>
                  <div className="flex gap-2 font-mono">
                    <span className="text-amber-200">Tm: {physical.meltingTemp}℃</span>
                    <span className="text-slate-500">|</span>
                    <span className="text-sky-300">Tg: {physical.glassTemp}℃</span>
                  </div>
                </div>
              </div>

              {/* 드레이프, 굽힘 및 사슬 배향도 요약 */}
              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-white/5 pt-1.5">
                <span>사슬 배향도(fc): <strong className="text-emerald-300 font-mono">{physical.orientationFactor}</strong></span>
                <span>드레이프(DC): <strong className="text-sky-300 font-mono">{kes.DC}%</strong></span>
                <span>굽힘(B): <strong className="text-sky-300 font-mono">{kes.B}</strong></span>
              </div>
            </div>

            {/* 3. 직물 감성 종합 진단 및 용도 제안 */}
            <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Sparkles size={15} className="text-amber-400" />
                  <h3 className="text-xs font-semibold text-white">직물 감성 및 용도 제안</h3>
                </div>

                <div className="rounded-lg border border-sky-500/20 bg-sky-950/30 p-2.5 text-xs text-sky-100 leading-relaxed">
                  <p className="font-medium">{fabricAssessment}</p>
                </div>

                <div className="mt-2.5">
                  <p className="text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1">
                    <Award size={12} className="text-amber-400" />
                    추천 제품 및 용도:
                  </p>
                  <p className="text-xs text-emerald-300 font-medium bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2">
                    {recommendedUse}
                  </p>
                </div>
              </div>

              <div className="mt-2 text-[10px] text-slate-500">
                * 고분자 반복단위 화학종, 분자량(Mw), 결정화도 및 단면 기하구조 복합 반영 모델
              </div>
            </div>
          </div>
        ) : activeTab === "radar" ? (
          /* KES 레이더 차트 및 6대 역학 수치 */
          <div className="grid grid-cols-[240px_1fr] gap-4">
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radar} cx="50%" cy="50%" outerRadius="70%">
                  <PolarGrid stroke="#334155" />
                  <PolarAngleAxis dataKey="metric" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar dataKey="value" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.35} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-3 gap-2 overflow-y-auto">
              {METRICS.map((m) => (
                <article
                  key={m.key}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                >
                  <p className="text-[11px] text-slate-400">{m.label}</p>
                  <p className="mt-0.5 font-mono text-base font-bold text-slate-50">
                    {kes[m.key].toFixed(m.digits)}
                  </p>
                  <p className="text-[10px] text-slate-500">{m.unit}</p>
                </article>
              ))}
            </div>
          </div>
        ) : (
          /* Math & Physics Lab 탭 */
          <div className="flex flex-col h-full overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2 shrink-0">
              <div className="flex items-center gap-1.5 text-xs">
                <button
                  onClick={() => setMathSubTab("topology")}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition ${
                    mathSubTab === "topology"
                      ? "bg-cyan-500 text-white font-semibold"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Network size={12} />
                  <span>1. 분자 토폴로지 (A & L Matrix)</span>
                </button>
                <button
                  onClick={() => setMathSubTab("physics")}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition ${
                    mathSubTab === "physics"
                      ? "bg-emerald-500 text-white font-semibold"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Gauge size={12} />
                  <span>2. PBD 수치해석 물리</span>
                </button>
                <button
                  onClick={() => setMathSubTab("surrogate")}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition ${
                    mathSubTab === "surrogate"
                      ? "bg-indigo-600 text-white font-semibold"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Cpu size={12} />
                  <span>3. 대리 모델 연산 추적</span>
                </button>
              </div>

              <div className="text-[11px] text-slate-400">
                수학과 수치모델링 연구진 실시간 연동
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto">
              {mathSubTab === "topology" && (
                <MathTopologyPanel
                  currentPolymer={currentPolymer}
                  sketchAtoms={sketchAtoms}
                  sketchBonds={sketchBonds}
                  className="min-h-[350px]"
                />
              )}
              {mathSubTab === "physics" && (
                <MathPhysicsDebugger
                  kes={kes}
                  className="min-h-[350px]"
                />
              )}
              {mathSubTab === "surrogate" && (
                <MathEngineLive
                  inputs={inputs || ({} as any)}
                  latencyMs={latencyMs}
                  className="min-h-[350px]"
                />
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
