import { useMemo, useState, useEffect } from "react";
import {
  Dna,
  PanelLeftClose,
  PanelLeft,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Droplets,
  Gauge,
  Calculator,
  Award,
  X,
  Database,
  Sparkles,
} from "lucide-react";
import { ControlPanel } from "./components/ControlPanel";
import { PolymerViewer } from "./components/PolymerViewer";
import { KesDashboard } from "./components/KesDashboard";
import { MolDrawStudio } from "./components/MolDrawStudio";
import { MathPhysicsLabModal } from "./components/MathPhysicsLabModal";
import { ResearchValuePanel } from "./components/ResearchValuePanel";
import { ChatMolecularEditor } from "./components/ChatMolecularEditor";
import { UnifiedInputHubTabs, type InputHubMode } from "./components/UnifiedInputHub";
import { PolymerDatasetExplorerModal } from "./components/PolymerDatasetExplorerModal";
import { LiveSyntheticRecommendPanel, type LiveApplyPayload } from "./components/LiveSyntheticRecommendPanel";
import { predictComprehensive } from "./model/surrogate";
import { POLYMER_DATABASE, type PolymerDefinition } from "./model/polymers";
import { DEFAULT_INPUTS, type FiberInputs } from "./types";
import type { AtomNode, BondEdge } from "./components/MolDrawCanvas";
import { loadMainAppState, saveMainAppState, saveCurrentWorkingSketch, loadCurrentWorkingSketch } from "./model/sketchStorage";
import { createPolymerFromSketch, polymerToPresetMolecule } from "./model/moldrawPresets";
import { loadPolymerInformaticsDataset } from "./model/polymerDatasetService";
import type { DetailedCopolymerEvaluation } from "./model/polymerBlendService";
import type { ParsedCopolymerStructure } from "./model/chatMolecularParser";

export default function App() {
  const [copolymerEvaluation, setCopolymerEvaluation] = useState<DetailedCopolymerEvaluation | null>(null);
  const [parsedCopolymer, setParsedCopolymer] = useState<ParsedCopolymerStructure | undefined>(undefined);
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
  const [isMolDrawOpen, setIsMolDrawOpen] = useState<boolean>(false); // MolDraw 분자 스튜디오 모달 (하위 호환)
  const [isMathLabOpen, setIsMathLabOpen] = useState<boolean>(false); // 수학·물리 정밀 분석 랩 모달
  const [isResearchValueModalOpen, setIsResearchValueModalOpen] = useState<boolean>(false); // 신소재 R&D 가치성 평가 모달
  const [isChatEditorOpen, setIsChatEditorOpen] = useState<boolean>(false); // 자연어 대화형 3D 분자 에디터 모달 (하위 호환)
  const [isDatasetModalOpen, setIsDatasetModalOpen] = useState<boolean>(false); // 대규모 오픈 데이터셋 탐색기 모달
  const [isLiveRecommendModalOpen, setIsLiveRecommendModalOpen] = useState<boolean>(false); // 실시간 AI S급 신소재 추천 모달
  // 통합 입력 허브 모드 (2D 스케치 | 3D 뷰어 | AI 챗 입력)
  const [activeInputMode, setActiveInputMode] = useState<InputHubMode>("3d_viewer");

  // 대규모 고분자 인포매틱스 오픈 데이터셋 백그라운드 프리로드 (초기 1회)
  useEffect(() => {
    loadPolymerInformaticsDataset();
  }, []);

  // 메인 파라미터 및 스케치 로컬 영속화
  useEffect(() => {
    saveMainAppState({
      inputs,
      polymerId: currentPolymer.id,
      sketchData,
      dashboardHeightMode,
    });
  }, [inputs, currentPolymer.id, sketchData, dashboardHeightMode]);

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

  // 고분자 선택 핸들러 (3D 뷰어나 사이드바에서 고분자 변경 시 2D 스케치 및 채팅 캔버스도 즉시 동기화)
  const handleSelectPolymer = (p: PolymerDefinition) => {
    setCurrentPolymer(p);
    if (!p.id.startsWith("copol_") && p.unitAtoms && p.unitAtoms.length > 0) {
      const preset = polymerToPresetMolecule(p);
      setSketchData({ atoms: preset.atoms, bonds: preset.bonds });
      saveCurrentWorkingSketch(preset.atoms, preset.bonds);
    } else if (p.id.startsWith("copol_")) {
      const working = loadCurrentWorkingSketch();
      if (working && working.atoms.length > 0) {
        setSketchData({ atoms: working.atoms, bonds: working.bonds });
      }
    }
    setInputs((prev) => ({
      ...prev,
      polymerId: p.id,
      repeatCount: 1,
      molecularWeight: p.monomerMW,
      customDescriptor: undefined,
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

  // 실시간 S급 가상 신소재 추천 후보(live_synthetic_pool.json) 적용 핸들러
  const handleApplyLiveRecommendation = (payload: LiveApplyPayload) => {
    setCurrentPolymer(payload.polymer);
    setParsedCopolymer(payload.parsedCopolymer);
    setSketchData({ atoms: payload.atoms, bonds: payload.bonds });
    saveCurrentWorkingSketch(payload.atoms, payload.bonds);
    setInputs((prev) => ({
      ...prev,
      polymerId: payload.polymer.id,
      repeatCount: payload.recommendedInputs.repeatCount,
      molecularWeight: payload.recommendedInputs.molecularWeight,
      crystallinity: payload.recommendedInputs.crystallinity,
      customDescriptor: payload.descriptor,
    }));
    setIsLiveRecommendModalOpen(false);
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
                <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-2 whitespace-nowrap">
                  <span>Trial-Zero</span>
                  <span className="rounded-full bg-emerald-500/20 border border-emerald-400/30 px-2 py-0.5 text-[10px] text-emerald-300 font-normal">
                    3D Main Mode
                  </span>
                </h1>
              </div>
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────────
              중앙: [통합 입력 컨트롤러 (Unified Input Hub)] 세그먼트 탭 메뉴
              [ 1. 2D 스케치 ] / [ 2. 3D 뷰어 ] / [ 3. 채팅 입력 (AI 3D) ]
              ───────────────────────────────────────────────────────────── */}
          <div className="hidden md:flex items-center">
            <UnifiedInputHubTabs
              activeMode={activeInputMode}
              onChangeMode={setActiveInputMode}
            />
          </div>

          <div className="flex items-center gap-2.5 text-xs text-slate-400">
            {/* 공인, 통과, 탈락 데이터 스토리지 퀵 버튼 */}
            <button
              onClick={() => setIsLiveRecommendModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-500/30 via-amber-500/30 to-rose-500/30 hover:from-emerald-400/50 hover:to-rose-400/50 text-amber-200 hover:text-white px-2.5 py-1 text-xs font-extrabold shadow-sm transition border border-amber-400/50 cursor-pointer"
              title="공인, 통과, 탈락 데이터 스토리지 열기"
            >
              <Sparkles size={13} className="text-amber-400 animate-pulse" />
              <span>공인, 통과, 탈락 데이터 스토리지</span>
            </button>

            {/* 대규모 오픈 데이터셋(3,284건) 탐색기 퀵 버튼 */}
            <button
              onClick={() => setIsDatasetModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-sky-600/30 via-indigo-600/30 to-purple-600/30 hover:from-sky-500/50 hover:to-purple-500/50 text-sky-200 hover:text-white px-2.5 py-1 text-xs font-semibold shadow-sm transition border border-sky-400/40 cursor-pointer"
              title="PI1M 및 Polymer Genome 공인 고분자 인포매틱스 대규모 데이터셋(3,284건) 탐색기 열기"
            >
              <Database size={13} className="text-sky-400" />
              <span>오픈 데이터셋 (3,284건)</span>
            </button>

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

            {/* 전체화면 바로가기 */}
            <button
              onClick={() => setIsFullscreen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-white px-2.5 py-1 text-xs font-semibold shadow-sm transition cursor-pointer"
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
              onOpenDatasetExplorer={() => setIsDatasetModalOpen(true)}
            />
          </div>
        )}

        {/* 메인 3D 및 하단 대시보드 영역 (통합 입력 컨트롤러 모드 연동) */}
        <div className="flex flex-col flex-1 min-h-0 relative">
          {/* ─────────────────────────────────────────────────────────────
              통합 입력 컨트롤러 모드 뷰:
              [1. 2D 스케치] / [2. 3D 뷰어] / [3. 채팅 입력 (AI 3D)]
              ───────────────────────────────────────────────────────────── */}
          {activeInputMode === "chat_ai" ? (
            /* 모드 3: AI 분자 챗 (Chat-Driven 3D Molecular Editor) */
            <div className="flex-1 min-h-0 relative">
              <ChatMolecularEditor
                initialAtoms={sketchData?.atoms}
                initialBonds={sketchData?.bonds}
                isEmbedded={true}
                onApplyToMainModel={({ polymer, descriptor, atoms, bonds, parsedCopolymer: parsed }) => {
                  setCurrentPolymer(polymer);
                  setSketchData({ atoms, bonds });
                  saveCurrentWorkingSketch(atoms, bonds);
                  if (parsed) setParsedCopolymer(parsed);
                  setInputs((prev) => ({
                    ...prev,
                    polymerId: polymer.id,
                    molecularWeight: Math.round(prev.repeatCount * descriptor.monomerMW),
                    customDescriptor: descriptor,
                  }));
                }}
                onStructureChange={(atoms, bonds, descriptor, parsed) => {
                  const customPolymer = createPolymerFromSketch(atoms, bonds, descriptor);
                  setCurrentPolymer(customPolymer);
                  setSketchData({ atoms, bonds });
                  saveCurrentWorkingSketch(atoms, bonds);
                  if (parsed) setParsedCopolymer(parsed);
                  setInputs((prev) => ({
                    ...prev,
                    polymerId: customPolymer.id,
                    molecularWeight: Math.round(prev.repeatCount * descriptor.monomerMW),
                    customDescriptor: descriptor,
                  }));
                }}
                className="h-full rounded-none border-0"
              />
            </div>
          ) : activeInputMode === "2d_sketch" ? (
            /* 모드 1: 2D 분자 스케치 (MolDraw Studio Embedded - 3D 뷰어 & 채팅 입력 실시간 양방향 연동) */
            <div className="flex-1 min-h-0 relative bg-slate-950">
              <MolDrawStudio
                initialAtoms={sketchData?.atoms}
                initialBonds={sketchData?.bonds}
                parsedCopolymer={parsedCopolymer}
                onStructureChange={(atoms, bonds, descriptor, parsed) => {
                  const customPolymer = createPolymerFromSketch(atoms, bonds, descriptor);
                  setCurrentPolymer(customPolymer);
                  setSketchData({ atoms, bonds });
                  saveCurrentWorkingSketch(atoms, bonds);
                  if (parsed) setParsedCopolymer(parsed);
                  setInputs((prev) => ({
                    ...prev,
                    polymerId: customPolymer.id,
                    molecularWeight: Math.round(prev.repeatCount * descriptor.monomerMW),
                    customDescriptor: descriptor,
                  }));
                }}
                onApplyToMainModel={({ polymer, descriptor, atoms, bonds, parsedCopolymer: parsed }) => {
                  setCurrentPolymer(polymer);
                  setSketchData({ atoms, bonds });
                  saveCurrentWorkingSketch(atoms, bonds);
                  if (parsed) setParsedCopolymer(parsed);
                  setInputs((prev) => ({
                    ...prev,
                    polymerId: polymer.id,
                    molecularWeight: Math.round(prev.repeatCount * descriptor.monomerMW),
                    customDescriptor: descriptor,
                  }));
                  // 스케치 적용 후 3D 뷰어로 자동 전환
                  setActiveInputMode("3d_viewer");
                }}
                className="h-full rounded-none border-0"
              />
            </div>
          ) : (
            /* 모드 2: 3D 고분자 사슬 & 미세 변수 뷰어 */
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
                onOpenDatasetExplorer={() => setIsDatasetModalOpen(true)}
                onOpenLiveRecommendModal={() => setIsLiveRecommendModalOpen(true)}
                onApplyLiveRecommendation={handleApplyLiveRecommendation}
                onCopolymerEvaluationChange={setCopolymerEvaluation}
                parsedCopolymer={parsedCopolymer}
              />
            </div>
          )}

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
                    onInputsChange={setInputs}
                    onOpenMathLab={() => setIsMathLabOpen(true)}
                    onOpenLiveRecommendModal={() => setIsLiveRecommendModalOpen(true)}
                    onApplyLiveRecommendation={handleApplyLiveRecommendation}
                    sketchAtoms={sketchData?.atoms}
                    sketchBonds={sketchData?.bonds}
                    copolymerEvaluation={copolymerEvaluation}
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
              initialAtoms={sketchData?.atoms}
              initialBonds={sketchData?.bonds}
              parsedCopolymer={parsedCopolymer}
              onStructureChange={(atoms, bonds, descriptor, copolymer) => {
                setSketchData({ atoms, bonds });
                if (copolymer) setParsedCopolymer(copolymer);
                saveCurrentWorkingSketch(atoms, bonds);
                setInputs((prev) => ({
                  ...prev,
                  molecularWeight: Math.round(prev.repeatCount * descriptor.monomerMW),
                  customDescriptor: descriptor,
                }));
              }}
              onApplyToMainModel={({ polymer, descriptor, atoms, bonds, parsedCopolymer: copolymer }) => {
                // 1. 메인 3D 뷰어 화면의 고분자를 방금 스케치한 분자 구조로 즉시 교체
                setCurrentPolymer(polymer);
                setSketchData({ atoms, bonds });
                if (copolymer) setParsedCopolymer(copolymer);
                saveCurrentWorkingSketch(atoms, bonds);
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
                onInputsChange={setInputs}
                onApplyLiveRecommendation={(payload) => {
                  handleApplyLiveRecommendation(payload);
                  setIsResearchValueModalOpen(false);
                }}
                comprehensive={comprehensive}
                sketchAtoms={sketchData?.atoms}
                sketchBonds={sketchData?.bonds}
                copolymerEvaluation={copolymerEvaluation}
                className="h-full"
              />
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          6. AI 자연어 대화형 3D 분자 구조 생성 및 실시간 수정 모달
          ───────────────────────────────────────────────────────────── */}
      {isChatEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4 animate-in fade-in duration-150">
          <div className="relative w-full max-w-[96vw] h-[94vh] flex flex-col">
            <ChatMolecularEditor
              onApplyToMainModel={({ polymer, descriptor, atoms, bonds }) => {
                // 1. 메인 3D 뷰어 화면의 고분자를 방금 생성/수정한 분자 구조로 즉시 교체
                setCurrentPolymer(polymer);
                setSketchData({ atoms, bonds });
                // 2. 대리 모델 입력값(고분자ID, 분자량, 특성 디스크립터) 동기화
                setInputs((prev) => ({
                  ...prev,
                  polymerId: polymer.id,
                  molecularWeight: Math.round(prev.repeatCount * descriptor.monomerMW),
                  customDescriptor: descriptor,
                }));
                // 3. 모달 닫기
                setIsChatEditorOpen(false);
              }}
              onClose={() => setIsChatEditorOpen(false)}
              className="h-full"
            />
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          7. 대규모 고분자 인포매틱스 오픈 데이터셋 (3,284건) 탐색기 모달
          ───────────────────────────────────────────────────────────── */}
      <PolymerDatasetExplorerModal
        isOpen={isDatasetModalOpen}
        onClose={() => setIsDatasetModalOpen(false)}
        onSelectPolymer={(polymer) => {
          handleSelectPolymer(polymer);
        }}
        currentPolymerId={currentPolymer.id}
      />

      {/* ─────────────────────────────────────────────────────────────
          8. 실시간 AI S급 신소재 R&D 추천 풀 (5,000건 슬라이딩 윈도우) 대화면 모달
          ───────────────────────────────────────────────────────────── */}
      {isLiveRecommendModalOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4 animate-in fade-in duration-150">
          <div className="relative flex flex-col w-full max-w-7xl h-[92vh] rounded-2xl border border-amber-500/40 bg-[#080d18] shadow-[0_25px_80px_rgba(0,0,0,0.95)] overflow-hidden">
            <LiveSyntheticRecommendPanel
              isEmbedded={false}
              currentPolymerId={currentPolymer.id}
              onApplyRecommendation={handleApplyLiveRecommendation}
              onClose={() => setIsLiveRecommendModalOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
