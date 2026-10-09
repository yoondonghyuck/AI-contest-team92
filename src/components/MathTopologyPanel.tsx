import { useState, useMemo, useRef, useEffect } from "react";
import {
  Network,
  Binary,
  Layers,
  Sparkles,
  Info,
  GitBranch,
  ShieldCheck,
  Zap,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts";
import {
  analyzeMolecularTopology,
  type MolecularGraph,
  type GraphTopologyResult,
} from "../model/mathTopology";
import { type PolymerDefinition } from "../model/polymers";
import type { AtomNode, BondEdge } from "./MolDrawCanvas";

interface Props {
  currentPolymer?: PolymerDefinition;
  sketchAtoms?: AtomNode[];
  sketchBonds?: BondEdge[];
  className?: string;
}

export function MathTopologyPanel({
  currentPolymer,
  sketchAtoms,
  sketchBonds,
  className = "",
}: Props) {
  const [sourceMode, setSourceMode] = useState<"polymer" | "sketch">(
    sketchAtoms && sketchAtoms.length > 0 ? "sketch" : "polymer"
  );
  const [matrixView, setMatrixView] = useState<"adj" | "laplacian" | "normLap">("laplacian");
  const [fiedlerColoring, setFiedlerColoring] = useState<boolean>(true);
  const [hoveredCell, setHoveredCell] = useState<{ i: number; j: number; val: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodePositionsRef = useRef<Map<string, { x: number; y: number; vx: number; vy: number }>>(new Map());

  // 분자 그래프 데이터 추출
  const graphData: MolecularGraph = useMemo(() => {
    if (sourceMode === "sketch" && sketchAtoms && sketchAtoms.length > 0) {
      return {
        nodes: sketchAtoms.map((a) => ({
          id: a.id,
          label: a.symbol,
          element: a.symbol,
          x: a.x,
          y: a.y,
        })),
        edges: (sketchBonds || []).map((b) => ({
          source: b.sourceId,
          target: b.targetId,
          order: b.type === "double" ? 2 : b.type === "triple" ? 3 : 1,
        })),
      };
    }

    // 기본 고분자 단위체에서 그래프 구성
    if (currentPolymer && currentPolymer.unitAtoms) {
      const nodes = currentPolymer.unitAtoms.map((atom, idx) => ({
        id: `node-${idx}`,
        label: `${atom.element}${idx + 1}`,
        element: atom.element,
        x: atom.relPos[0] * 35 + 200,
        y: atom.relPos[1] * 35 + 150,
      }));

      const edges = currentPolymer.unitBonds.map((bond) => ({
        source: `node-${bond.from}`,
        target: `node-${bond.to}`,
        order: bond.order,
      }));

      return { nodes, edges };
    }

    return { nodes: [], edges: [] };
  }, [sourceMode, currentPolymer, sketchAtoms, sketchBonds]);

  // 그래프 이론 및 위상수학 해석 실행
  const topology: GraphTopologyResult = useMemo(() => {
    return analyzeMolecularTopology(graphData);
  }, [graphData]);

  // 2D 힘-유도(Force-Directed) 네트워크 시뮬레이션 및 Canvas 렌더링
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || graphData.nodes.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 초기 좌표 캐싱
    const positions = nodePositionsRef.current;
    graphData.nodes.forEach((node, idx) => {
      if (!positions.has(node.id)) {
        const angle = (idx / Math.max(1, graphData.nodes.length)) * 2 * Math.PI;
        const radius = 90 + (idx % 2) * 20;
        positions.set(node.id, {
          x: (node.x && !isNaN(node.x)) ? node.x : 200 + radius * Math.cos(angle),
          y: (node.y && !isNaN(node.y)) ? node.y : 150 + radius * Math.sin(angle),
          vx: 0,
          vy: 0,
        });
      }
    });

    let animationFrameId: number;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      // 미세 스프링 물리 시뮬레이션
      const nodes = graphData.nodes;
      const edges = graphData.edges;

      // 노드 간 척력 (Coulomb repulsion)
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const p1 = positions.get(nodes[i].id)!;
          const p2 = positions.get(nodes[j].id)!;
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.hypot(dx, dy) || 1;
          if (dist < 180) {
            const force = (800 / (dist * dist)) * 0.4;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            p1.vx += fx;
            p1.vy += fy;
            p2.vx -= fx;
            p2.vy -= fy;
          }
        }
      }

      // 엣지 인력 (Hooke's spring attraction)
      edges.forEach((edge) => {
        const p1 = positions.get(edge.source);
        const p2 = positions.get(edge.target);
        if (p1 && p2) {
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const dist = Math.hypot(dx, dy) || 1;
          const targetDist = 48;
          const force = (dist - targetDist) * 0.05;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          p1.vx += fx;
          p1.vy += fy;
          p2.vx -= fx;
          p2.vy -= fy;
        }
      });

      // 중심 끌어당김 및 속도 감쇠
      nodes.forEach((node) => {
        const p = positions.get(node.id)!;
        p.vx += (width / 2 - p.x) * 0.015;
        p.vy += (height / 2 - p.y) * 0.015;
        p.vx *= 0.82;
        p.vy *= 0.82;
        p.x += p.vx;
        p.y += p.vy;
      });

      // 1. 간선(엣지) 렌더링
      edges.forEach((edge) => {
        const p1 = positions.get(edge.source);
        const p2 = positions.get(edge.target);
        if (p1 && p2) {
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = edge.order === 2 ? "#38bdf8" : "#475569";
          ctx.lineWidth = edge.order === 2 ? 3 : 1.8;
          ctx.stroke();

          if (edge.order === 2) {
            // 이중 결합 평행 보조선
            ctx.setLineDash([4, 4]);
            ctx.strokeStyle = "#818cf8";
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.setLineDash([]);
          }
        }
      });

      // 2. 정점(노드) 렌더링
      nodes.forEach((node, idx) => {
        const p = positions.get(node.id)!;
        const fiedlerVal = topology.fiedlerVector[idx] || 0;

        // Fiedler 벡터 값 기반 대수적 위상 채색 (-: 청색, +: 자색)
        let nodeColor = "#0ea5e9";
        if (fiedlerColoring && topology.fiedlerVector.length > 0) {
          nodeColor = fiedlerVal >= 0 ? "#818cf8" : "#06b6d4";
        } else if (node.element === "O") {
          nodeColor = "#ef4444";
        } else if (node.element === "N") {
          nodeColor = "#3b82f6";
        } else if (node.element === "C") {
          nodeColor = "#64748b";
        }

        // 외곽 글로우
        ctx.beginPath();
        ctx.arc(p.x, p.y, 14, 0, Math.PI * 2);
        ctx.fillStyle = nodeColor;
        ctx.shadowColor = nodeColor;
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;

        // 노드 테두리
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // 텍스트 라벨
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 10px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(node.label || node.element, p.x, p.y);
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animationFrameId);
  }, [graphData, topology, fiedlerColoring]);

  // 현재 선택된 행렬
  const currentMatrix =
    matrixView === "adj"
      ? topology.adjacencyMatrix
      : matrixView === "laplacian"
      ? topology.laplacianMatrix
      : topology.normalizedLaplacianMatrix;

  // 고유값 바 차트 데이터
  const spectralChartData = useMemo(() => {
    return topology.eigenvalues.slice(0, 16).map((val, idx) => ({
      index: `λ${idx + 1}`,
      value: val,
      isFiedler: idx === 1,
    }));
  }, [topology.eigenvalues]);

  return (
    <div
      className={`flex flex-col h-full bg-[#070b14] border border-cyan-500/20 rounded-2xl overflow-hidden shadow-2xl text-slate-100 ${className}`}
    >
      {/* ─────────────────────────────────────────────────────────────
          1. 패널 헤더: 화학 그래프 이론 및 위상 분석 제목 & 전환 툴바
          ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between border-b border-white/10 bg-slate-950/80 px-4 py-2.5 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/20 border border-cyan-400/30 text-cyan-400">
            <Network size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white tracking-wide">
                분자 토폴로지 & 화학 그래프 이론 분석기
              </h2>
              <span className="rounded-full bg-cyan-500/10 border border-cyan-400/30 px-2 py-0.5 text-[10px] font-mono text-cyan-300">
                G = (V, E) Matrix Spectral Lab
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              인접 행렬(A), 라플라시안(L), 자코비 고유치 스펙트럼 및 토폴로지 불변량 실시간 계산
            </p>
          </div>
        </div>

        {/* 데이터 소스 선택 버튼 */}
        <div className="flex items-center gap-2 mt-2 sm:mt-0">
          <div className="flex rounded-lg bg-slate-900 border border-white/10 p-0.5 text-xs">
            <button
              onClick={() => setSourceMode("polymer")}
              className={`rounded-md px-2.5 py-1 transition ${
                sourceMode === "polymer"
                  ? "bg-cyan-500 text-white font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              현재 고분자 ({currentPolymer?.shortName || "Polymer"})
            </button>
            {sketchAtoms && sketchAtoms.length > 0 && (
              <button
                onClick={() => setSourceMode("sketch")}
                className={`rounded-md px-2.5 py-1 transition ${
                  sourceMode === "sketch"
                    ? "bg-cyan-500 text-white font-semibold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                2D 스케치 분자 ({sketchAtoms.length} 원자)
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. 상단 핵심 토폴로지 지수 카드 (Topological Invariants)
          ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 p-3 bg-slate-900/40 border-b border-white/10">
        <div className="rounded-xl border border-white/10 bg-slate-950/60 p-2.5">
          <div className="flex items-center justify-between text-slate-400 text-[11px]">
            <span>피들러 값 (λ₂)</span>
            <Sparkles size={12} className="text-amber-400" />
          </div>
          <p className="mt-1 font-mono text-lg font-bold text-amber-300">
            {topology.fiedlerValue.toFixed(3)}
          </p>
          <span className="text-[10px] text-slate-500">대수적 연결도 (Algebraic Connectivity)</span>
        </div>

        <div className="rounded-xl border border-white/10 bg-slate-950/60 p-2.5">
          <div className="flex items-center justify-between text-slate-400 text-[11px]">
            <span>위너 지수 (Wiener W)</span>
            <GitBranch size={12} className="text-cyan-400" />
          </div>
          <p className="mt-1 font-mono text-lg font-bold text-cyan-300">
            {topology.wienerIndex}
          </p>
          <span className="text-[10px] text-slate-500">전역 경로 거리 합 Σ d(i,j)</span>
        </div>

        <div className="rounded-xl border border-white/10 bg-slate-950/60 p-2.5">
          <div className="flex items-center justify-between text-slate-400 text-[11px]">
            <span>랜딕 지수 (Randić χ)</span>
            <Zap size={12} className="text-emerald-400" />
          </div>
          <p className="mt-1 font-mono text-lg font-bold text-emerald-300">
            {topology.randicIndex}
          </p>
          <span className="text-[10px] text-slate-500">가지 분기 연결 지수</span>
        </div>

        <div className="rounded-xl border border-white/10 bg-slate-950/60 p-2.5">
          <div className="flex items-center justify-between text-slate-400 text-[11px]">
            <span>자그레브 M₁ / M₂</span>
            <Binary size={12} className="text-purple-400" />
          </div>
          <p className="mt-1 font-mono text-lg font-bold text-purple-300">
            {topology.zagrebIndexM1} <span className="text-xs text-slate-400">/ {topology.zagrebIndexM2}</span>
          </p>
          <span className="text-[10px] text-slate-500">차수 제곱합 Σ deg²</span>
        </div>

        <div className="rounded-xl border border-white/10 bg-slate-950/60 p-2.5">
          <div className="flex items-center justify-between text-slate-400 text-[11px]">
            <span>발라반 지수 (J)</span>
            <Layers size={12} className="text-sky-400" />
          </div>
          <p className="mt-1 font-mono text-lg font-bold text-sky-300">
            {topology.balabanIndex}
          </p>
          <span className="text-[10px] text-slate-500">고리 환상 토폴로지 척도</span>
        </div>

        <div className="rounded-xl border border-white/10 bg-slate-950/60 p-2.5">
          <div className="flex items-center justify-between text-slate-400 text-[11px]">
            <span>그래프 지름 / 평균 경로</span>
            <ShieldCheck size={12} className="text-indigo-400" />
          </div>
          <p className="mt-1 font-mono text-lg font-bold text-indigo-300">
            {topology.diameter} <span className="text-xs text-slate-400">/ {topology.avgPathLength}</span>
          </p>
          <span className="text-[10px] text-slate-500">Max & Avg Shortest Path</span>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. 메인 분석 영역: 좌측 2D 위상 네트워크 다이어그램 / 우측 행렬 및 스펙트럼
          ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 p-3 flex-1 min-h-0 overflow-y-auto">
        {/* 좌측 (5열): 2D 토폴로지 네트워크 캔버스 */}
        <div className="lg:col-span-5 flex flex-col rounded-xl border border-white/10 bg-slate-950/80 p-3 min-h-[300px]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-300">
              <Network size={14} />
              <span>실시간 위상 네트워크 다이어그램 (Force Graph)</span>
            </div>
            <button
              onClick={() => setFiedlerColoring(!fiedlerColoring)}
              className={`rounded px-2 py-0.5 text-[10px] border transition ${
                fiedlerColoring
                  ? "bg-cyan-500/20 text-cyan-300 border-cyan-400/40"
                  : "bg-slate-900 text-slate-400 border-white/10"
              }`}
              title="Fiedler 벡터(λ2 고유벡터) 부호에 따른 위상 분할 착색 토글"
            >
              피들러 위상 분할 {fiedlerColoring ? "ON" : "OFF"}
            </button>
          </div>

          <div className="relative flex-1 rounded-lg bg-[#040811] border border-white/5 overflow-hidden flex items-center justify-center">
            <canvas
              ref={canvasRef}
              width={420}
              height={320}
              className="w-full h-full object-contain cursor-grab active:cursor-grabbing"
            />
            <div className="absolute bottom-2 left-2 flex items-center gap-2 text-[10px] text-slate-400 bg-black/60 px-2 py-1 rounded backdrop-blur border border-white/10">
              <span>정점 |V| = {topology.nodeCount}</span>
              <span>•</span>
              <span>간선 |E| = {topology.edgeCount}</span>
              <span>•</span>
              <span>평균 차수 {topology.avgDegree}</span>
            </div>
          </div>
        </div>

        {/* 우측 상단 & 하단 (7열): 행렬 히트맵 및 라플라시안 고유치 스펙트럼 */}
        <div className="lg:col-span-7 flex flex-col gap-3 min-h-[300px]">
          {/* A & L 행렬 히트맵 */}
          <div className="flex-1 rounded-xl border border-white/10 bg-slate-950/80 p-3 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-white">행렬 구조 히트맵 (Matrix Heatmap)</span>
                <div className="flex rounded bg-slate-900 border border-white/10 p-0.5 text-[10px]">
                  <button
                    onClick={() => setMatrixView("adj")}
                    className={`px-2 py-0.5 rounded transition ${
                      matrixView === "adj" ? "bg-cyan-500 text-white font-bold" : "text-slate-400"
                    }`}
                  >
                    인접 행렬 (A)
                  </button>
                  <button
                    onClick={() => setMatrixView("laplacian")}
                    className={`px-2 py-0.5 rounded transition ${
                      matrixView === "laplacian" ? "bg-cyan-500 text-white font-bold" : "text-slate-400"
                    }`}
                  >
                    라플라시안 (L = D - A)
                  </button>
                  <button
                    onClick={() => setMatrixView("normLap")}
                    className={`px-2 py-0.5 rounded transition ${
                      matrixView === "normLap" ? "bg-cyan-500 text-white font-bold" : "text-slate-400"
                    }`}
                  >
                    정규화 (L_sym)
                  </button>
                </div>
              </div>

              {hoveredCell && (
                <div className="text-[11px] font-mono text-cyan-300 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/30">
                  M({hoveredCell.i + 1}, {hoveredCell.j + 1}) = {hoveredCell.val.toFixed(2)}
                </div>
              )}
            </div>

            {/* 행렬 그리드 렌더링 */}
            <div className="flex-1 min-h-[140px] max-h-[180px] overflow-auto rounded bg-[#030712] p-2 border border-white/5 flex items-center justify-center">
              {currentMatrix.length === 0 ? (
                <div className="text-xs text-slate-500">행렬 데이터가 없습니다.</div>
              ) : (
                <div
                  className="grid gap-1"
                  style={{
                    gridTemplateColumns: `repeat(${currentMatrix.length}, minmax(18px, 28px))`,
                  }}
                >
                  {currentMatrix.map((row, i) =>
                    row.map((val, j) => {
                      let bg = "bg-slate-900/60 text-slate-600";
                      if (val > 0) bg = "bg-cyan-600 text-white font-bold shadow-sm shadow-cyan-500/40";
                      else if (val < 0) bg = "bg-rose-600 text-white font-bold shadow-sm shadow-rose-500/40";
                      else if (i === j) bg = "bg-slate-800 text-slate-400";

                      return (
                        <div
                          key={`${i}-${j}`}
                          onMouseEnter={() => setHoveredCell({ i, j, val })}
                          onMouseLeave={() => setHoveredCell(null)}
                          className={`aspect-square flex items-center justify-center text-[10px] font-mono rounded cursor-pointer transition hover:scale-115 hover:z-10 ${bg}`}
                          title={`Row ${i + 1}, Col ${j + 1}: ${val}`}
                        >
                          {Math.abs(val) >= 10 ? val.toFixed(0) : val !== 0 ? val.toFixed(1) : "0"}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 라플라시안 고유치 스펙트럼 (Eigenvalue Spectrum) 차트 */}
          <div className="h-[170px] rounded-xl border border-white/10 bg-slate-950/80 p-3 flex flex-col">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Info size={13} className="text-amber-400" />
                라플라시안 고유값 스펙트럼 (0 = λ₁ ≤ λ₂ ≤ ... ≤ λₙ)
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                Spectral Gap Δλ = {topology.spectralGap.toFixed(3)}
              </span>
            </div>

            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={spectralChartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="index" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      borderColor: "#334155",
                      borderRadius: "8px",
                      fontSize: "11px",
                    }}
                    formatter={(val: any) => [`${Number(val ?? 0).toFixed(4)}`, "고유값 λ"]}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {spectralChartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.isFiedler ? "#f59e0b" : "#0ea5e9"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
