import { useState, useMemo, useRef, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, Grid } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import {
  RotateCcw,
  Play,
  Pause,
  Eye,
  EyeOff,
  Palette,
  Sparkles,
  Layers,
  Maximize2,
  Minimize2,
} from "lucide-react";
import {
  type PolymerDefinition,
  generatePolymerChain,
  generateMacroCoilPoints,
  type RenderAtom,
  ELEMENT_PROPERTIES,
} from "../model/polymers";
import { PolymerChainMesh, MacroPolymerCoilMesh } from "./PolymerScene";
import { FloatingTuner } from "./FloatingTuner";
import type { FiberInputs } from "../types";

interface PolymerCanvasProps {
  polymer: PolymerDefinition;
  repeatCount: number;
  molecularWeight: number;
  crystallinity: number;
  inputs: FiberInputs;
  onInputsChange: (next: FiberInputs) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onSelectPolymer?: (polymer: PolymerDefinition) => void;
}

export function PolymerCanvas({
  polymer,
  repeatCount,
  molecularWeight,
  crystallinity,
  inputs,
  onInputsChange,
  isFullscreen,
  onToggleFullscreen,
  onSelectPolymer,
}: PolymerCanvasProps) {
  // 스케일 모드: micro(원자 상세 뷰) vs macro(수천~수만 단위체 거대 사슬 코일 뷰)
  const isHighMw = repeatCount > 35;
  const [viewScale, setViewScale] = useState<"micro" | "macro">(isHighMw ? "macro" : "micro");

  // repeatCount 변경 시 지능형 모드 전환
  useEffect(() => {
    if (repeatCount > 35 && viewScale === "micro") {
      setViewScale("macro");
    } else if (repeatCount <= 30 && viewScale === "macro") {
      setViewScale("micro");
    }
  }, [repeatCount]);

  const [styleMode, setStyleMode] = useState<"ballAndStick" | "spaceFilling" | "wireframe">("ballAndStick");
  const [showHydrogen, setShowHydrogen] = useState<boolean>(true);
  const [colorByUnit, setColorByUnit] = useState<boolean>(false);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [hoveredAtom, setHoveredAtom] = useState<RenderAtom | null>(null);
  const [isTunerOpen, setIsTunerOpen] = useState<boolean>(false);

  const controlsRef = useRef<OrbitControlsImpl>(null);

  // 1. 미시적 원자 사슬 데이터 (원자/결합 최대 30개 단위체)
  const microCount = Math.min(30, Math.max(1, repeatCount));
  const { atoms, bonds, center, bounds } = useMemo(() => {
    return generatePolymerChain(polymer, microCount, showHydrogen);
  }, [polymer, microCount, showHydrogen]);

  // 2. 거시적 고분자 사슬 코일 데이터 (수천~수십만 단위체 3D 튜브 궤적)
  const macroPoints = useMemo(() => {
    return generateMacroCoilPoints(repeatCount, crystallinity);
  }, [repeatCount, crystallinity]);

  // 최적 카메라 거리 계산
  const maxSpan = viewScale === "macro" ? 45 : Math.max(bounds[0], bounds[1], bounds[2]);
  const cameraZ = viewScale === "macro" ? 48 : Math.max(8, maxSpan * 0.95 + 4);

  // 카메라 시점 초기화
  const resetCamera = () => {
    if (controlsRef.current) {
      controlsRef.current.reset();
    }
  };

  return (
    <div
      className={`relative flex flex-col overflow-hidden bg-[#070b14] transition-all duration-300 ${
        isFullscreen ? "fixed inset-0 z-50 h-screen w-screen" : "h-full min-h-[440px] w-full"
      }`}
    >
      {/* ─────────────────────────────────────────────────────────────
          1. 상단 단일 통합 컨트롤 툴바 (Top Unified Toolbar)
          버튼들이 겹치지 않도록 체계적인 3단 Flex 레이아웃으로 완벽 정렬
          ───────────────────────────────────────────────────────────── */}
      <header className="z-10 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-slate-950/90 px-4 py-2 backdrop-blur-md">
        {/* 좌측: 뷰 모드 스위처 (원자 상세 뷰 vs 거대 사슬 코일 뷰) */}
        <div className="flex items-center gap-1 rounded-xl border border-white/15 bg-black/40 p-1">
          <button
            onClick={() => setViewScale("micro")}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
              viewScale === "micro"
                ? "bg-sky-500 text-white shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Sparkles size={13} />
            <span>원자 상세 뷰 ({microCount}단위)</span>
          </button>
          <button
            onClick={() => setViewScale("macro")}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
              viewScale === "macro"
                ? "bg-sky-500 text-white shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Layers size={13} />
            <span>거대 사슬 코일 뷰 (n={repeatCount.toLocaleString()})</span>
          </button>
        </div>

        {/* 중앙: 3D 렌더 스타일 (원자 뷰 전용) */}
        {viewScale === "micro" ? (
          <div className="flex items-center gap-1 rounded-xl border border-white/15 bg-black/40 p-1">
            <button
              onClick={() => setStyleMode("ballAndStick")}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                styleMode === "ballAndStick"
                  ? "bg-slate-700 text-sky-300 font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Ball & Stick
            </button>
            <button
              onClick={() => setStyleMode("spaceFilling")}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                styleMode === "spaceFilling"
                  ? "bg-slate-700 text-sky-300 font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Space-Filling
            </button>
            <button
              onClick={() => setStyleMode("wireframe")}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                styleMode === "wireframe"
                  ? "bg-slate-700 text-sky-300 font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Wireframe
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-slate-300 bg-black/40 border border-white/10 px-3 py-1 rounded-xl">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>
              분자량 <strong className="text-emerald-300 font-mono">~{Math.round(molecularWeight).toLocaleString()}</strong> g/mol 코일 사슬
            </span>
          </div>
        )}

        {/* 우측: 3D 뷰어 제어 툴바 & 전체화면 버튼 */}
        <div className="flex items-center gap-1.5">
          {viewScale === "micro" && (
            <>
              {/* 수소 표시 토글 */}
              <button
                onClick={() => setShowHydrogen(!showHydrogen)}
                title={showHydrogen ? "수소(H) 원자 숨기기" : "수소(H) 원자 표시"}
                className={`flex h-7 items-center gap-1 rounded-lg px-2 text-xs transition ${
                  showHydrogen
                    ? "bg-sky-500/20 text-sky-300 border border-sky-400/30"
                    : "text-slate-400 border border-white/10 hover:text-white"
                }`}
              >
                {showHydrogen ? <Eye size={13} /> : <EyeOff size={13} />}
                <span>수소</span>
              </button>

              {/* 단위체별 컬러 토글 */}
              <button
                onClick={() => setColorByUnit(!colorByUnit)}
                title={colorByUnit ? "단위체 색상 해제" : "단위체별 무지개 색상 구분"}
                className={`flex h-7 items-center gap-1 rounded-lg px-2 text-xs transition ${
                  colorByUnit
                    ? "bg-sky-500/20 text-sky-300 border border-sky-400/30"
                    : "text-slate-400 border border-white/10 hover:text-white"
                }`}
              >
                <Palette size={13} />
                <span>마디구분</span>
              </button>
            </>
          )}

          {/* 자동 회전 */}
          <button
            onClick={() => setAutoRotate(!autoRotate)}
            title={autoRotate ? "회전 멈춤" : "자동 회전"}
            className={`flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 transition ${
              autoRotate ? "bg-sky-500/20 text-sky-300" : "text-slate-400 hover:text-white"
            }`}
          >
            {autoRotate ? <Pause size={13} /> : <Play size={13} />}
          </button>

          {/* 카메라 리셋 */}
          <button
            onClick={resetCamera}
            title="카메라 시점 초기화"
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            <RotateCcw size={13} />
          </button>

          <div className="h-4 w-[1px] bg-white/15 mx-1" />

          {/* ⛶ 전체 화면 버튼 */}
          <button
            onClick={onToggleFullscreen}
            className={`flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition ${
              isFullscreen
                ? "bg-amber-500 text-slate-950 font-bold shadow-lg"
                : "bg-sky-500 text-white hover:bg-sky-400 shadow-md"
            }`}
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            <span>{isFullscreen ? "창 모드 복귀" : "3D 전체 화면"}</span>
          </button>
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────
          2. Three.js 3D 캔버스 영역 (대형 화면)
          ───────────────────────────────────────────────────────────── */}
      <div className="relative flex-1 min-h-0">
        <Canvas camera={{ position: [0, 2.5, cameraZ], fov: 45 }} dpr={[1, 2]}>
          <color attach="background" args={["#070b14"]} />
          <ambientLight intensity={0.65} />
          <directionalLight position={[12, 18, 12]} intensity={1.5} castShadow />
          <directionalLight position={[-12, -10, -8]} intensity={0.5} />
          <pointLight position={[0, 15, 0]} intensity={0.8} />

          {/* 조건부 3D 렌더링 */}
          {viewScale === "micro" ? (
            <PolymerChainMesh
              atoms={atoms}
              bonds={bonds}
              center={center}
              styleMode={styleMode}
              colorByUnit={colorByUnit}
              autoRotate={autoRotate}
              onHoverAtom={setHoveredAtom}
            />
          ) : (
            <MacroPolymerCoilMesh
              points={macroPoints}
              autoRotate={autoRotate}
              color={crystallinity > 0.5 ? "#38bdf8" : "#818cf8"}
            />
          )}

          {/* 3D 바닥 그리드 */}
          <Grid
            position={[0, -Math.max(2, (viewScale === "macro" ? 18 : bounds[1]) / 2 + 1.2), 0]}
            args={[Math.max(40, maxSpan * 1.5), Math.max(40, maxSpan * 1.5)]}
            cellSize={1}
            cellThickness={0.6}
            cellColor="#1e293b"
            sectionSize={5}
            sectionThickness={1.2}
            sectionColor="#334155"
            fadeDistance={Math.max(45, maxSpan * 1.8)}
          />

          <Environment preset="city" />
          <OrbitControls
            ref={controlsRef}
            makeDefault
            enableDamping
            dampingFactor={0.06}
            minDistance={2}
            maxDistance={Math.max(80, cameraZ * 3)}
          />
        </Canvas>

        {/* ─────────────────────────────────────────────────────────────
            3. 3D 화면 내부의 실시간 미세 변수 튜너 (Floating HUD Tuner)
            좌측 상단에 플로팅되어 3D 화면을 보면서 실시간 조작 가능!
            ───────────────────────────────────────────────────────────── */}
        <div className="absolute left-4 top-4 z-20">
          <FloatingTuner
            inputs={inputs}
            onChange={onInputsChange}
            isOpen={isTunerOpen}
            onToggle={() => setIsTunerOpen(!isTunerOpen)}
            currentPolymer={polymer}
            onSelectPolymer={onSelectPolymer}
          />
        </div>

        {/* 원자 마우스 호버 툴팁 (미시 뷰) */}
        {viewScale === "micro" && hoveredAtom && (
          <div className="pointer-events-none absolute bottom-14 left-4 z-20 rounded-xl border border-sky-400/40 bg-slate-900/95 px-3 py-2 text-xs text-white shadow-2xl backdrop-blur-md">
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-3.5 w-3.5 rounded-full border border-white/30"
                style={{ backgroundColor: hoveredAtom.color }}
              />
              <span className="font-bold text-sky-200">{hoveredAtom.name}</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-300">
              {ELEMENT_PROPERTIES[hoveredAtom.element]?.name || hoveredAtom.element}
              {" · "}
              <span className="text-slate-400">단위체 #{hoveredAtom.unitIndex + 1}</span>
            </p>
          </div>
        )}

        {/* 하단 좌측: 고분자 핵심 지표 뱃지 */}
        <div className="pointer-events-none absolute bottom-3 left-4 z-10 flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/80 px-3.5 py-1.5 text-xs text-slate-300 shadow-xl backdrop-blur-md">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-white">{polymer.shortName}</span>
            <span className="text-[11px] text-slate-400">({polymer.koreanName.split(" ")[0]})</span>
          </div>
          <span className="h-3 w-[1px] bg-white/15" />
          <div className="text-[11px] font-mono">
            <span className="text-slate-400">DP n=</span>
            <strong className="text-sky-300">{repeatCount.toLocaleString()}</strong>
          </div>
          <span className="h-3 w-[1px] bg-white/15" />
          <div className="text-[11px] font-mono">
            <span className="text-slate-400">전장: </span>
            <strong className="text-emerald-300">
              {repeatCount >= 1000
                ? `${((repeatCount * polymer.unitLength) / 10000).toFixed(1)} μm`
                : `${(repeatCount * polymer.unitLength).toFixed(0)} Å`}
            </strong>
          </div>
        </div>

        {/* 하단 우측: 원소 범례 (Legend) */}
        {viewScale === "micro" && (
          <div className="pointer-events-none absolute bottom-3 right-4 z-10 flex items-center gap-2.5 rounded-xl border border-white/10 bg-slate-950/80 px-3 py-1.5 text-[11px] text-slate-300 shadow-xl backdrop-blur-md">
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-[#334155] border border-white/20" />
              <span>C</span>
            </div>
            {showHydrogen && (
              <div className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-[#f8fafc] border border-slate-400" />
                <span>H</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-[#ef4444]" />
              <span>O</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-[#3b82f6]" />
              <span>N</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-[#10b981]" />
              <span>F/Cl</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
