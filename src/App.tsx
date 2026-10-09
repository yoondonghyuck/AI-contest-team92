import { useMemo, useState, useEffect } from "react";
import {
  Activity,
  Dna,
  PanelLeftClose,
  PanelLeft,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Droplets,
  Gauge,
  PenTool,
  Calculator,
  Award,
  X,
} from "lucide-react";
import { ControlPanel } from "./components/ControlPanel";
import { PolymerViewer } from "./components/PolymerViewer";
import { KesDashboard } from "./components/KesDashboard";
import { MolDrawStudio } from "./components/MolDrawStudio";
import { MathPhysicsLabModal } from "./components/MathPhysicsLabModal";
import { ResearchValuePanel } from "./components/ResearchValuePanel";
import { predictComprehensive } from "./model/surrogate";
import { onnxEngine } from "./model/onnx";
import { POLYMER_DATABASE, type PolymerDefinition } from "./model/polymers";
import { DEFAULT_INPUTS, type FiberInputs } from "./types";
import type { AtomNode, BondEdge } from "./components/MolDrawCanvas";
import { loadMainAppState, saveMainAppState } from "./model/sketchStorage";
import { createPolymerFromSketch } from "./model/moldrawPresets";

export default function App() {
  const [inputs, setInputs] = useState<FiberInputs>(() => {
    const saved = loadMainAppState();
    return saved?.inputs || DEFAULT_INPUTS;
  });
  const [currentPolymer, setCurrentPolymer] = useState<PolymerDefinition>(() => {
    const saved = loadMainAppState();
    if (saved) {
      if (saved.inputs?.customDescriptor && saved.sketchData) {
        return createPolymerFromSketch(
          saved.sketchData.atoms,
          saved.sketchData.bonds,
          saved.inputs.customDescriptor
        );
      }
      if (saved.polymerId) {
        const found = POLYMER_DATABASE.find((p) => p.id === saved.polymerId);
        if (found) return found;
      }
    }
    return POLYMER_DATABASE.find((p) => p.id === DEFAULT_INPUTS.polymerId) || POLYMER_DATABASE[0];
  });
  const [sketchData, setSketchData] = useState<{ atoms: AtomNode[]; bonds: BondEdge[] } | null>(() => {
    const saved = loadMainAppState();
    return saved?.sketchData || null;
  });

  // 3D 캔버스 주력 화면을 위한 레이아웃 상태
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false); // 3D를 위해 기본 사이드바 최소화
  const [isDashboardCollapsed, setIsDashboardCollapsed] = useState<boolean>(false);
  const [dashboardHeightMode, setDashboardHeightMode] = useState<"normal" | "tall">(() => {
    const saved = loadMainAppState();
    return saved?.dashboardHeightMode || "normal";
  });
  const [isMolDrawOpen, setIsMolDrawOpen] = useState<boolean>(false); // MolDraw 분자 스튜디오 모달
  const [isMathLabOpen, setIsMathLabOpen] = useState<boolean>(false); // 수학·물리 정밀 분석 랩 모달
  const [isResearchValueModalOpen, setIsResearchValueModalOpen] = useState<boolean>(false); // 신소재 R&D 가치성 평가 모달

  // 메인 파라미터 및 스케치 로컬 영속화
  useEffect(() => {
    saveMainAppState({
      inputs,
      polymerId: currentPolymer.id,
      sketchData,
      dashboardHeightMode,
    });
  }, [inputs, currentPolymer.id, sketchData, dashboardHeightMode]);

  const status = onnxEngine.getStatus();

  // Esc 키로 전체화면 해제
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  // 고분자 화학종 + 분자량 + 미세 섬유 변수 + 스케치 분자 특성 통합 추론
  const { comprehensive, latencyMs } = useMemo(() => {
    const t0 = performance.now();
    const result = predictComprehensive(inputs);
    return { comprehensive: result, latencyMs: performance.now() - t0 };
  }, [inputs]);

  // 고분자 선택 핸들러 (반복단위 기본값 전부 1로 설정)
  const handleSelectPolymer = (p: PolymerDefinition) => {
    setCurrentPolymer(p);
    setInputs((prev) => ({
      ...prev,
      polymerId: p.id,
      repeatCount: 1,
      molecularWeight: p.monomerMW,
    }));
  };

  // 중합도(반복단위수) 변경 핸들러
  const handleRepeatCountChange = (n: number) => {
    setInputs((prev) => ({
      ...prev,
      repeatCount: n,
      molecularWeight: Math.round(n * currentPolymer.monomerMW),
    }));
  };

  // 분자량 변경 핸들러
  const handleMolecularWeightChange = (mw: number) => {
    setInputs((prev) => ({
      ...prev,
      molecularWeight: mw,
      repeatCount: Math.max(1, Math.round(mw / currentPolymer.monomerMW)),
    }));
  };

  return (
    <div className="flex h-screen min-h-0 flex-col bg-[#070b12] text-slate-100 overflow-hidden">
      {/* ─────────────────────────────────────────────────────────────
          1. 최상단 네비게이션 헤더 (전체화면 시 자동 숨김)
          ───────────────────────────────────────────────────────────── */}
      {!isFullscreen && (
        <header className="flex items-center justify-between border-b border-white/10 px-4 py-2.5 bg-slate-950/80 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            {/* 좌측 사이드바 여닫기 토글 버튼 */}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                isSidebarOpen
                  ? "bg-sky-500/20 text-sky-300 border border-sky-400/30"
                  : "bg-slate-900 border border-white/10 text-slate-300 hover:text-white hover:border-slate-500"
              }`}
              title={isSidebarOpen ? "사이드바 닫기 (3D 화면 극대화)" : "사이드바 열기"}
            >
              {isSidebarOpen ? <PanelLeftClose size={15} /> : <PanelLeft size={15} />}
              <span>{isSidebarOpen ? "패널 닫기" : "사이드 패널"}</span>
            </button>

            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/20 border border-sky-400/30 text-sky-400">
                <Dna size={18} />
              </div>
              <div>
                <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
                  <span>3D 고분자 사슬 & 미세 변수 연동 랩</span>
                  <span className="rounded-full bg-emerald-500/20 border border-emerald-400/30 px-2 py-0.2 text-[10px] text-emerald-300 font-normal">
                    3D Main Mode
                  </span>
                </h1>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 text-xs text-slate-400">
            {/* 실시간 염색성 퀵 배지 */}
            <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-sky-200">
              <Droplets size={12} className="text-sky-400" />
              <span>염색성: <strong>{comprehensive.dyeability.grade} ({comprehensive.dyeability.score}점)</strong></span>
            </div>

            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-0.5 text-emerald-200 text-[11px]">
              <Activity size={12} />
              {status.message}
            </span>

            {/* 신소재 R&D 가치 평가 전용 버튼 */}
            <button
              onClick={() => setIsResearchValueModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 hover:from-amber-400 hover:to-purple-500 text-white px-2.5 py-1 text-xs font-semibold shadow-md shadow-amber-500/20 transition border border-amber-400/30 cursor-pointer"
              title="Materials Informatics 기반 신소재 R&D 가치성 평가 및 의사결정 리포트 열기"
            >
              <Award size={13} />
              <span>R&D 가치 평가</span>
            </button>

            {/* Math & Physics Lab 전용 버튼 */}
            <button
              onClick={() => setIsMathLabOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-600 via-indigo-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white px-2.5 py-1 text-xs font-semibold shadow-md shadow-indigo-500/20 transition border border-cyan-400/30 cursor-pointer"
              title="수학과 수치모델링 연구진을 위한 수학·물리 엔진 정밀 분석 랩 열기"
            >
              <Calculator size={13} />
              <span>Math & Physics Lab</span>
            </button>

            {/* 2D 분자 그리기 도구 버튼 */}
            <button
              onClick={() => setIsMolDrawOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600/80 hover:bg-indigo-500 text-white px-2.5 py-1 text-xs font-semibold shadow-sm transition border border-indigo-400/30"
              title="2D 분자 구조 그리기 스케처 열기"
            >
              <PenTool size={13} />
              <span>2D 분자 그리기</span>
            </button>

            {/* 전체화면 바로가기 */}
            <button
              onClick={() => setIsFullscreen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-white px-2.5 py-1 text-xs font-semibold shadow-sm transition"
              title="3D 캔버스 전체 화면으로 전환"
            >
              <Maximize2 size={13} />
              <span>3D 전체화면</span>
            </button>
          </div>
        </header>
      )}

      {/* ─────────────────────────────────────────────────────────────
          2. 메인 워크스페이스: 3D Canvas가 사실상 주인공!
          ───────────────────────────────────────────────────────────── */}
      <main className="flex flex-1 min-h-0 relative overflow-hidden">
        {/* (옵션) 좌측 슬라이드 사이드바: 닫아두어도 3D 화면 내 FloatingTuner로 조작 가능 */}
        {isSidebarOpen && !isFullscreen && (
          <div className="w-[300px] shrink-0 border-r border-white/10 h-full animate-in slide-in-from-left duration-200">
            <ControlPanel
              inputs={inputs}
              onChange={setInputs}
              currentPolymer={currentPolymer}
              onSelectPolymer={handleSelectPolymer}
            />
          </div>
        )}

        {/* 메인 3D 및 하단 대시보드 영역 (3D 화면이 최대 크기로 시원하게 펼쳐짐) */}
        <div className="flex flex-col flex-1 min-h-0 relative">
          {/* 주인공: 3D 고분자 사슬 뷰어 (화면의 대부분을 시원하게 차지) */}
          <div className="flex-1 min-h-0 relative">
            <PolymerViewer
              currentPolymer={currentPolymer}
              onSelectPolymer={handleSelectPolymer}
              repeatCount={inputs.repeatCount}
              onRepeatCountChange={handleRepeatCountChange}
              molecularWeight={inputs.molecularWeight}
              onMolecularWeightChange={handleMolecularWeightChange}
              inputs={inputs}
              onInputsChange={setInputs}
              isFullscreen={isFullscreen}
              onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
            />
          </div>

          {/* 하단: 염색성 & KES 물성 대시보드 (접기/펼치기 가능) */}
          {!isFullscreen && (
            <div
              className={`border-t border-white/10 bg-[#090e1a] transition-all duration-300 shrink-0 ${
                isDashboardCollapsed
                  ? "h-[42px]"
                  : dashboardHeightMode === "tall"
                  ? "h-[520px]"
                  : "h-[285px]"
              }`}
            >
              {/* 대시보드 상단 토글 바 */}
              <div className="flex items-center justify-between px-4 py-1.5 bg-slate-950/90 border-b border-white/10 text-xs">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsDashboardCollapsed(!isDashboardCollapsed)}
                    className="flex items-center gap-1.5 font-bold text-slate-200 hover:text-sky-300 transition"
                  >
                    {isDashboardCollapsed ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    <span>{isDashboardCollapsed ? "물성 & 염색성 대시보드 펼치기" : "대시보드 접기 (3D 극대화)"}</span>
                  </button>

                  {!isDashboardCollapsed && (
                    <button
                      onClick={() => setDashboardHeightMode(dashboardHeightMode === "normal" ? "tall" : "normal")}
                      className="flex items-center gap-1 rounded bg-white/5 hover:bg-white/10 border border-white/10 px-2 py-0.5 text-[11px] font-medium text-slate-300 hover:text-cyan-300 transition"
                      title="대시보드 높이 조절 (수학·물리 랩 및 그래프 시각화 확대)"
                    >
                      <Maximize2 size={11} />
                      <span>{dashboardHeightMode === "normal" ? "높이 확대 (520px)" : "기본 높이 (285px)"}</span>
                    </button>
                  )}

                  {/* 접혔을 때 한눈에 보이는 실시간 핵심 요약 */}
                  {isDashboardCollapsed && (
                    <div className="flex items-center gap-4 text-[11px] text-slate-300">
                      <span className="flex items-center gap-1">
                        <Droplets size={12} className="text-sky-400" />
                        염색성: <strong className="text-sky-300">{comprehensive.dyeability.grade} ({comprehensive.dyeability.score}점)</strong>
                      </span>
                      <span className="flex items-center gap-1">
                        <Gauge size={12} className="text-emerald-400" />
                        인장강도: <strong className="text-emerald-300 font-mono">{comprehensive.physical.tenacity} g/d</strong>
                      </span>
                      <span className="flex items-center gap-1">
                        드레이프(DC): <strong className="text-purple-300 font-mono">{comprehensive.kes.DC}%</strong>
                      </span>
                      <span className="text-slate-400 truncate max-w-[320px]">
                        {comprehensive.recommendedUse}
                      </span>
                    </div>
                  )}
                </div>

                <div className="text-[10px] text-slate-500 font-mono">
                  대리 모델 추론 {latencyMs.toFixed(1)}ms
                </div>
              </div>

              {/* 펼쳐졌을 때의 상세 내용 */}
              {!isDashboardCollapsed && (
                <div
                  className={`${
                    dashboardHeightMode === "tall" ? "h-[478px]" : "h-[245px]"
                  } overflow-hidden transition-all duration-300`}
                >
                  <KesDashboard
                    props={comprehensive}
                    latencyMs={latencyMs}
                    currentPolymer={currentPolymer}
                    inputs={inputs}
                    onOpenMathLab={() => setIsMathLabOpen(true)}
                    sketchAtoms={sketchData?.atoms}
                    sketchBonds={sketchData?.bonds}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* ─────────────────────────────────────────────────────────────
          3. MolDraw 스타일 2D ➔ 3D 분자 스튜디오 모달 (MolDrawStudio)
          ───────────────────────────────────────────────────────────── */}
      {isMolDrawOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-3 sm:p-5 animate-in fade-in duration-150">
          <div className="relative w-full max-w-7xl max-h-[94vh] flex flex-col">
            <MolDrawStudio
              onApplyToMainModel={({ polymer, descriptor, atoms, bonds }) => {
                // 1. 메인 3D 뷰어 화면의 고분자를 방금 스케치한 분자 구조로 즉시 교체
                setCurrentPolymer(polymer);
                setSketchData({ atoms, bonds });
                // 2. 대리 모델 입력값(고분자ID, 분자량, 특성 디스크립터) 동기화
                setInputs((prev) => ({
                  ...prev,
                  polymerId: polymer.id,
                  molecularWeight: Math.round(prev.repeatCount * descriptor.monomerMW),
                  customDescriptor: descriptor,
                }));
                // 3. 모달 닫고 메인 랩 화면으로 복귀
                setIsMolDrawOpen(false);
              }}
              onClose={() => setIsMolDrawOpen(false)}
              className="h-[88vh]"
            />
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          4. Math & Physics Lab (수학·물리 엔진 정밀 분석 랩) 모달
          ───────────────────────────────────────────────────────────── */}
      <MathPhysicsLabModal
        isOpen={isMathLabOpen}
        onClose={() => setIsMathLabOpen(false)}
        currentPolymer={currentPolymer}
        inputs={inputs}
        comprehensive={comprehensive}
        latencyMs={latencyMs}
        sketchAtoms={sketchData?.atoms}
        sketchBonds={sketchData?.bonds}
      />

      {/* ─────────────────────────────────────────────────────────────
          5. 신소재 R&D 연구 가치성 평가 대화면 모달
          ───────────────────────────────────────────────────────────── */}
      {isResearchValueModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4 animate-in fade-in duration-150">
          <div className="relative flex flex-col bg-[#070b14] border border-amber-500/40 rounded-2xl shadow-2xl w-full max-w-7xl h-[92vh] overflow-hidden p-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-500/20 text-amber-300 rounded-xl border border-amber-400/40">
                  <Award size={20} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">
                    신소재 R&D 타당성 및 연구 가치성 평가 스튜디오
                  </h2>
                  <p className="text-xs text-slate-400">
                    합성 실현성·물성 독창성·산업 파급력 정량 분석 및 AI 제안서 생성
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsResearchValueModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 min-h-0 pt-3">
              <ResearchValuePanel
                currentPolymer={currentPolymer}
                inputs={inputs}
                comprehensive={comprehensive}
                sketchAtoms={sketchData?.atoms}
                sketchBonds={sketchData?.bonds}
                className="h-full"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
