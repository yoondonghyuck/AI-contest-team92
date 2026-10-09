import { useState } from "react";
import {
  X,
  Maximize2,
  Minimize2,
  Network,
  Gauge,
  Cpu,
  Calculator,
} from "lucide-react";
import { MathTopologyPanel } from "./MathTopologyPanel";
import { MathPhysicsDebugger } from "./MathPhysicsDebugger";
import { MathEngineLive } from "./MathEngineLive";
import type { PolymerDefinition } from "../model/polymers";
import type { FiberInputs, ComprehensiveProperties } from "../types";
import type { AtomNode, BondEdge } from "./MolDrawCanvas";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentPolymer: PolymerDefinition;
  inputs: FiberInputs;
  comprehensive: ComprehensiveProperties;
  latencyMs: number;
  sketchAtoms?: AtomNode[];
  sketchBonds?: BondEdge[];
}

export function MathPhysicsLabModal({
  isOpen,
  onClose,
  currentPolymer,
  inputs,
  comprehensive,
  latencyMs,
  sketchAtoms,
  sketchBonds,
}: Props) {
  const [activeTab, setActiveTab] = useState<"topology" | "physics" | "surrogate">("topology");
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4 animate-in fade-in duration-150">
      <div
        className={`relative flex flex-col bg-[#070b14] border border-cyan-500/30 rounded-2xl shadow-2xl transition-all duration-200 overflow-hidden ${
          isExpanded ? "w-full h-full" : "w-full max-w-7xl h-[92vh]"
        }`}
      >
        {/* 모달 헤더 */}
        <div className="flex items-center justify-between border-b border-white/10 bg-slate-950 px-4 py-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 via-indigo-500/20 to-purple-500/20 border border-cyan-400/40 text-cyan-300">
              <Calculator size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-white tracking-tight">
                  Math & Physics Lab (수학·물리 엔진 정밀 분석 랩)
                </h1>
                <span className="rounded-full bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 border border-cyan-400/40 px-2.5 py-0.5 text-[11px] font-semibold text-cyan-300">
                  응용수학 & 수치해석 팀
                </span>
              </div>
              <p className="text-xs text-slate-400">
                분자 토폴로지 그래프 이론, PBD/RK4 수치해석 안정성, 베이지안 대리 모델 실시간 추적
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* 3대 모듈 탭 선택 버튼 */}
            <div className="hidden md:flex rounded-xl bg-slate-900 border border-white/10 p-1 text-xs">
              <button
                onClick={() => setActiveTab("topology")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold transition ${
                  activeTab === "topology"
                    ? "bg-cyan-500 text-white shadow-md shadow-cyan-500/20"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Network size={14} />
                <span>1. 분자 토폴로지 (Graph Theory)</span>
              </button>
              <button
                onClick={() => setActiveTab("physics")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold transition ${
                  activeTab === "physics"
                    ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Gauge size={14} />
                <span>2. PBD 수치해석 디버거</span>
              </button>
              <button
                onClick={() => setActiveTab("surrogate")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold transition ${
                  activeTab === "surrogate"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Cpu size={14} />
                <span>3. 대리 모델 연산 추적기</span>
              </button>
            </div>

            {/* 창 크기 최대화 토글 */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition"
              title={isExpanded ? "창 복원" : "전체화면"}
            >
              {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>

            {/* 닫기 버튼 */}
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-500/20 hover:text-rose-400 transition"
              title="닫기"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* 모바일/소형 화면용 보조 탭 바 */}
        <div className="flex md:hidden border-b border-white/10 bg-slate-900/60 p-2 gap-1 overflow-x-auto text-xs shrink-0">
          <button
            onClick={() => setActiveTab("topology")}
            className={`px-3 py-1 rounded-lg shrink-0 ${
              activeTab === "topology" ? "bg-cyan-500 text-white font-bold" : "text-slate-400"
            }`}
          >
            1. 분자 토폴로지
          </button>
          <button
            onClick={() => setActiveTab("physics")}
            className={`px-3 py-1 rounded-lg shrink-0 ${
              activeTab === "physics" ? "bg-emerald-500 text-white font-bold" : "text-slate-400"
            }`}
          >
            2. PBD 물리
          </button>
          <button
            onClick={() => setActiveTab("surrogate")}
            className={`px-3 py-1 rounded-lg shrink-0 ${
              activeTab === "surrogate" ? "bg-indigo-600 text-white font-bold" : "text-slate-400"
            }`}
          >
            3. 대리 모델 연산
          </button>
        </div>

        {/* 모달 본체: 활성화된 모듈 렌더링 */}
        <div className="flex-1 min-h-0 p-3 overflow-hidden bg-[#050813]">
          {activeTab === "topology" && (
            <MathTopologyPanel
              currentPolymer={currentPolymer}
              sketchAtoms={sketchAtoms}
              sketchBonds={sketchBonds}
              className="h-full border-none shadow-none rounded-xl"
            />
          )}

          {activeTab === "physics" && (
            <MathPhysicsDebugger
              kes={comprehensive.kes}
              className="h-full border-none shadow-none rounded-xl"
            />
          )}

          {activeTab === "surrogate" && (
            <MathEngineLive
              inputs={inputs}
              latencyMs={latencyMs}
              className="h-full border-none shadow-none rounded-xl"
            />
          )}
        </div>
      </div>
    </div>
  );
}
