import React, { useRef, useEffect, useState, useCallback } from "react";
import { ZoomIn, ZoomOut, Maximize2, RotateCcw, Hand } from "lucide-react";
import { createBenzeneRing, createCyclopentylRing } from "../model/moldrawPresets";

export type AtomSymbol = "C" | "O" | "N" | "H" | "Cl" | "F" | "S";
export type BondType = "single" | "double" | "triple";
export type MolDrawTool =
  | "single"
  | "double"
  | "triple"
  | "benzene"
  | "cyclopentyl"
  | "atom"
  | "move"
  | "pan"
  | "erase";

export interface AtomNode {
  id: string;
  symbol: AtomSymbol;
  x: number;
  y: number;
  z?: number;
  domainColor?: string;
  domainLabel?: string;
  isGraftBranch?: boolean;
  isJunction?: boolean;
}

export interface BondEdge {
  id: string;
  sourceId: string;
  targetId: string;
  type: BondType;
  domainColor?: string;
  isGraftLink?: boolean;
  isBlockLink?: boolean;
}

export interface MolDrawCanvasProps {
  atoms: AtomNode[];
  bonds: BondEdge[];
  onAtomsChange: (atoms: AtomNode[]) => void;
  onBondsChange: (bonds: BondEdge[]) => void;
  selectedAtomSymbol: AtomSymbol;
  onSelectAtomSymbol?: (sym: AtomSymbol) => void;
  activeTool: MolDrawTool;
  onSelectTool?: (tool: MolDrawTool) => void;
  className?: string;
  invalidAtomIds?: Set<string>;
  invalidBondIds?: Set<string>;
  showDimensions?: boolean;
}

// 원소별 시각 테마 설정 (CPK 컬러 기반)
export const ATOM_CONFIG: Record<
  AtomSymbol,
  { label: string; name: string; fill: string; stroke: string; text: string; radius: number }
> = {
  C: {
    label: "C",
    name: "탄소 (Carbon)",
    fill: "#1e293b",
    stroke: "#64748b",
    text: "#f8fafc",
    radius: 18,
  },
  O: {
    label: "O",
    name: "산소 (Oxygen)",
    fill: "#7f1d1d",
    stroke: "#ef4444",
    text: "#fee2e2",
    radius: 18,
  },
  N: {
    label: "N",
    name: "질소 (Nitrogen)",
    fill: "#1e3a8a",
    stroke: "#3b82f6",
    text: "#dbeafe",
    radius: 17,
  },
  H: {
    label: "H",
    name: "수소 (Hydrogen)",
    fill: "#334155",
    stroke: "#94a3b8",
    text: "#e2e8f0",
    radius: 14,
  },
  Cl: {
    label: "Cl",
    name: "염소 (Chlorine)",
    fill: "#064e3b",
    stroke: "#10b981",
    text: "#d1fae5",
    radius: 19,
  },
  F: {
    label: "F",
    name: "불소 (Fluorine)",
    fill: "#065f46",
    stroke: "#34d399",
    text: "#ecfdf5",
    radius: 16,
  },
  S: {
    label: "S",
    name: "황 (Sulfur)",
    fill: "#713f12",
    stroke: "#eab308",
    text: "#fef9c3",
    radius: 19,
  },
};

// 점과 선분 사이의 최단 거리 계산 (결합 클릭 감지용)
function distanceToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
}

export const MolDrawCanvas: React.FC<MolDrawCanvasProps> = ({
  atoms,
  bonds,
  onAtomsChange,
  onBondsChange,
  selectedAtomSymbol,
  activeTool,
  className = "",
  invalidAtomIds,
  invalidBondIds,
  showDimensions = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 1. 화면 이동(Pan) & 줌(Zoom) 상태
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(1);
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [isSpacePressed, setIsSpacePressed] = useState<boolean>(false);
  const panStartRef = useRef<{ mouseX: number; mouseY: number; panX: number; panY: number }>({
    mouseX: 0,
    mouseY: 0,
    panX: 0,
    panY: 0,
  });

  // 2. 분자 상호작용 상태
  const [hoveredAtomId, setHoveredAtomId] = useState<string | null>(null);
  const [hoveredBondId, setHoveredBondId] = useState<string | null>(null);
  const [selectedAtomId, setSelectedAtomId] = useState<string | null>(null);
  const [dragSourceId, setDragSourceId] = useState<string | null>(null);
  const [dragCurrentPos, setDragCurrentPos] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingNode, setIsDraggingNode] = useState<boolean>(false);

  // 스페이스바 누름 감지 (상시 손바닥 화면 이동 단축키)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat && (e.target as HTMLElement).tagName !== "INPUT") {
        e.preventDefault();
        setIsSpacePressed(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setIsSpacePressed(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // 화면 좌표(Screen px) -> 캔버스 월드 좌표(World coordinate) 변환
  const screenToWorld = useCallback(
    (screenX: number, screenY: number) => {
      return {
        x: (screenX - pan.x) / zoom,
        y: (screenY - pan.y) / zoom,
      };
    },
    [pan, zoom]
  );

  // 마우스 위치의 원자 검색
  const findAtomAt = useCallback(
    (worldX: number, worldY: number, margin = 8): AtomNode | null => {
      for (let i = atoms.length - 1; i >= 0; i--) {
        const atom = atoms[i];
        const cfg = ATOM_CONFIG[atom.symbol] || ATOM_CONFIG.C;
        if (Math.hypot(atom.x - worldX, atom.y - worldY) <= cfg.radius + margin) {
          return atom;
        }
      }
      return null;
    },
    [atoms]
  );

  // 마우스 위치의 결합 검색
  const findBondAt = useCallback(
    (worldX: number, worldY: number, threshold = 9): BondEdge | null => {
      const atomMap = new Map(atoms.map((a) => [a.id, a]));
      for (let i = bonds.length - 1; i >= 0; i--) {
        const bond = bonds[i];
        const src = atomMap.get(bond.sourceId);
        const tgt = atomMap.get(bond.targetId);
        if (src && tgt) {
          const dist = distanceToSegment(worldX, worldY, src.x, src.y, tgt.x, tgt.y);
          if (dist <= threshold) {
            return bond;
          }
        }
      }
      return null;
    },
    [atoms, bonds]
  );

  // 스마트 연장 각도 계산: 120° 지그재그 방향 도출
  const calculateNextChainPosition = useCallback(
    (sourceAtom: AtomNode, bondLength = 55): { x: number; y: number } => {
      const connectedBonds = bonds.filter(
        (b) => b.sourceId === sourceAtom.id || b.targetId === sourceAtom.id
      );

      if (connectedBonds.length === 0) {
        const angle = -Math.PI / 6;
        return {
          x: Math.round(sourceAtom.x + bondLength * Math.cos(angle)),
          y: Math.round(sourceAtom.y + bondLength * Math.sin(angle)),
        };
      }

      const angles: number[] = [];
      const atomMap = new Map(atoms.map((a) => [a.id, a]));

      connectedBonds.forEach((b) => {
        const otherId = b.sourceId === sourceAtom.id ? b.targetId : b.sourceId;
        const other = atomMap.get(otherId);
        if (other) {
          angles.push(Math.atan2(other.y - sourceAtom.y, other.x - sourceAtom.x));
        }
      });

      if (angles.length === 1) {
        const prevAngle = angles[0];
        const candidate1 = prevAngle + (2 * Math.PI) / 3;
        const candidate2 = prevAngle - (2 * Math.PI) / 3;
        const choice = Math.sin(candidate1) > Math.sin(candidate2) ? candidate2 : candidate1;

        return {
          x: Math.round(sourceAtom.x + bondLength * Math.cos(choice)),
          y: Math.round(sourceAtom.y + bondLength * Math.sin(choice)),
        };
      }

      angles.sort((a, b) => a - b);
      let maxGap = 0;
      let bisector = 0;

      for (let i = 0; i < angles.length; i++) {
        const nextIdx = (i + 1) % angles.length;
        let gap = angles[nextIdx] - angles[i];
        if (gap < 0) gap += Math.PI * 2;

        if (gap > maxGap) {
          maxGap = gap;
          bisector = angles[i] + gap / 2;
        }
      }

      return {
        x: Math.round(sourceAtom.x + bondLength * Math.cos(bisector)),
        y: Math.round(sourceAtom.y + bondLength * Math.sin(bisector)),
      };
    },
    [atoms, bonds]
  );

  // ─────────────────────────────────────────────────────────────
  // 줌 및 뷰 맞춤(Fit) 헬퍼 함수군
  // ─────────────────────────────────────────────────────────────
  const handleZoomIn = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cx = canvas.clientWidth / 2;
    const cy = canvas.clientHeight / 2;
    const nextZoom = Math.min(4.0, Number((zoom * 1.2).toFixed(2)));
    const nextPanX = cx - (cx - pan.x) * (nextZoom / zoom);
    const nextPanY = cy - (cy - pan.y) * (nextZoom / zoom);
    setZoom(nextZoom);
    setPan({ x: Math.round(nextPanX), y: Math.round(nextPanY) });
  };

  const handleZoomOut = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cx = canvas.clientWidth / 2;
    const cy = canvas.clientHeight / 2;
    const nextZoom = Math.max(0.25, Number((zoom / 1.2).toFixed(2)));
    const nextPanX = cx - (cx - pan.x) * (nextZoom / zoom);
    const nextPanY = cy - (cy - pan.y) * (nextZoom / zoom);
    setZoom(nextZoom);
    setPan({ x: Math.round(nextPanX), y: Math.round(nextPanY) });
  };

  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleFitContent = useCallback(() => {
    if (atoms.length === 0) {
      handleResetZoom();
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    atoms.forEach((a) => {
      if (a.x < minX) minX = a.x;
      if (a.x > maxX) maxX = a.x;
      if (a.y < minY) minY = a.y;
      if (a.y > maxY) maxY = a.y;
    });

    const padding = 80;
    const contentW = Math.max(100, maxX - minX + padding * 2);
    const contentH = Math.max(100, maxY - minY + padding * 2);

    const fitZoom = Math.min(1.8, Math.max(0.35, Math.min(width / contentW, height / contentH)));
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;

    const roundedZoom = Number(fitZoom.toFixed(2));
    setZoom(roundedZoom);
    setPan({
      x: Math.round(width / 2 - midX * roundedZoom),
      y: Math.round(height / 2 - midY * roundedZoom),
    });
  }, [atoms]);

  // 마우스 휠 줌 (커서 위치 중심 줌 인/아웃)
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    const nextZoom = Math.min(4.0, Math.max(0.25, Number((zoom * factor).toFixed(3))));

    const nextPanX = mouseX - (mouseX - pan.x) * (nextZoom / zoom);
    const nextPanY = mouseY - (mouseY - pan.y) * (nextZoom / zoom);

    setZoom(nextZoom);
    setPan({ x: Math.round(nextPanX), y: Math.round(nextPanY) });
  };

  // ─────────────────────────────────────────────────────────────
  // 캔버스 렌더링 루프 (Pan & Zoom 월드 변환 적용)
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // 1. 패닝 및 줌에 따라 무한하게 움직이는 미세 도트 그리드 배경
    const baseGap = 26;
    const scaledGap = baseGap * zoom;
    const step = scaledGap < 13 ? scaledGap * 2 : scaledGap > 60 ? scaledGap / 2 : scaledGap;
    const startX = ((pan.x % step) + step) % step;
    const startY = ((pan.y % step) + step) % step;

    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    for (let gx = startX; gx < width; gx += step) {
      for (let gy = startY; gy < height; gy += step) {
        ctx.beginPath();
        ctx.arc(gx, gy, Math.max(0.7, 1 * Math.min(1.2, zoom)), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 2. 월드 좌표계 변환 (Pan & Zoom)
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    const atomMap = new Map(atoms.map((a) => [a.id, a]));

    // 3. 결합선(Bonds) 그리기
    bonds.forEach((bond) => {
      const src = atomMap.get(bond.sourceId);
      const tgt = atomMap.get(bond.targetId);
      if (!src || !tgt) return;

      const srcCfg = ATOM_CONFIG[src.symbol] || ATOM_CONFIG.C;
      const tgtCfg = ATOM_CONFIG[tgt.symbol] || ATOM_CONFIG.C;

      const dx = tgt.x - src.x;
      const dy = tgt.y - src.y;
      const dist = Math.hypot(dx, dy);
      if (dist === 0) return;

      const ux = dx / dist;
      const uy = dy / dist;

      const startX = src.x + ux * (srcCfg.radius + 1);
      const startY = src.y + uy * (srcCfg.radius + 1);
      const endX = tgt.x - ux * (tgtCfg.radius + 1);
      const endY = tgt.y - uy * (tgtCfg.radius + 1);

      const nx = -uy;
      const ny = ux;

      const isBondHovered = hoveredBondId === bond.id;
      const isInvalidBond = invalidBondIds?.has(bond.id);

      ctx.save();
      ctx.strokeStyle = isInvalidBond ? "#ef4444" : isBondHovered ? "#38bdf8" : "#94a3b8";
      ctx.lineCap = "round";

      if (bond.type === "single") {
        ctx.lineWidth = isInvalidBond ? 4 : isBondHovered ? 4 : 2.8;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
      } else if (bond.type === "double") {
        ctx.lineWidth = isInvalidBond ? 3.8 : isBondHovered ? 3.5 : 2.5;
        const offset = 3.8;
        ctx.beginPath();
        ctx.moveTo(startX + nx * offset, startY + ny * offset);
        ctx.lineTo(endX + nx * offset, endY + ny * offset);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(startX - nx * offset, startY - ny * offset);
        ctx.lineTo(endX - nx * offset, endY - ny * offset);
        ctx.stroke();
      } else if (bond.type === "triple") {
        ctx.lineWidth = 2.2;
        const offset = 4.8;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(startX + nx * offset, startY + ny * offset);
        ctx.lineTo(endX + nx * offset, endY + ny * offset);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(startX - nx * offset, startY - ny * offset);
        ctx.lineTo(endX - nx * offset, endY - ny * offset);
        ctx.stroke();
      }
      ctx.restore();
    });

    // 4. 결합 드래그 프리뷰 점선 가이드
    if (dragSourceId && dragCurrentPos && !isDraggingNode) {
      const src = atomMap.get(dragSourceId);
      if (src) {
        ctx.save();
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 2.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(src.x, src.y);
        ctx.lineTo(dragCurrentPos.x, dragCurrentPos.y);
        ctx.stroke();
        ctx.restore();
      }
    }

    // 5. 원자 노드(Atoms) 렌더링
    atoms.forEach((atom) => {
      const cfg = ATOM_CONFIG[atom.symbol] || ATOM_CONFIG.C;
      const isHovered = hoveredAtomId === atom.id;
      const isSelected = selectedAtomId === atom.id;
      const isDragSource = dragSourceId === atom.id;
      const isInvalid = invalidAtomIds?.has(atom.id);

      ctx.save();

      // 화학적/기하학적 오류 강조 링
      if (isInvalid) {
        ctx.beginPath();
        ctx.arc(atom.x, atom.y, cfg.radius + 8, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(239, 68, 68, 0.22)";
        ctx.fill();
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 2.5;
        ctx.setLineDash([4, 3]);
        ctx.stroke();
        ctx.setLineDash([]);

        // 빨간 느낌표 경고 배지
        ctx.beginPath();
        ctx.arc(atom.x + cfg.radius - 2, atom.y - cfg.radius + 2, 5.5, 0, Math.PI * 2);
        ctx.fillStyle = "#ef4444";
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 8px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("!", atom.x + cfg.radius - 2, atom.y - cfg.radius + 2);
      }

      // 글로우 링 (선택/호버)
      if (isHovered || isSelected || isDragSource) {
        ctx.beginPath();
        ctx.arc(atom.x, atom.y, cfg.radius + 6, 0, Math.PI * 2);
        ctx.fillStyle = isSelected
          ? "rgba(56, 189, 248, 0.2)"
          : isDragSource
          ? "rgba(168, 85, 247, 0.2)"
          : "rgba(255, 255, 255, 0.12)";
        ctx.fill();
        ctx.strokeStyle = isSelected
          ? "#38bdf8"
          : isDragSource
          ? "#c084fc"
          : "rgba(255, 255, 255, 0.4)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // 원자 바디
      ctx.beginPath();
      ctx.arc(atom.x, atom.y, cfg.radius, 0, Math.PI * 2);
      ctx.fillStyle = isInvalid ? "#450a0a" : cfg.fill;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = isInvalid ? "#ef4444" : cfg.stroke;
      ctx.stroke();

      // 원자 기호 텍스트
      ctx.fillStyle = cfg.text;
      ctx.font = "bold 13px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(cfg.label, atom.x, atom.y);

      ctx.restore();
    });

    // 6. 결합 길이(Bond Length) 및 결합 각도(Bond Angle) 치수 오버레이 (showDimensions)
    if (showDimensions) {
      // 6-1. 결합 길이 뱃지 (Å)
      bonds.forEach((bond) => {
        const src = atomMap.get(bond.sourceId);
        const tgt = atomMap.get(bond.targetId);
        if (!src || !tgt) return;
        const distPx = Math.hypot(tgt.x - src.x, tgt.y - src.y);
        const distAngstrom = (distPx * (1.5 / 55.0)).toFixed(2);
        const mx = (src.x + tgt.x) / 2;
        const my = (src.y + tgt.y) / 2;

        ctx.save();
        ctx.font = "bold 10px ui-monospace, SFMono-Regular, Menlo, monospace";
        const text = `${distAngstrom}Å`;
        const textMetrics = ctx.measureText(text);
        const padX = 5;
        const w = textMetrics.width + padX * 2;
        const h = 16;

        ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (typeof ctx.roundRect === "function") {
          ctx.roundRect(mx - w / 2, my - h / 2, w, h, 4);
        } else {
          ctx.rect(mx - w / 2, my - h / 2, w, h);
        }
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#38bdf8";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, mx, my);
        ctx.restore();
      });

      // 6-2. 결합 각도(Bond Angle) 호 및 라벨 (°)
      const neighbors = new Map<string, string[]>();
      atoms.forEach((a) => neighbors.set(a.id, []));
      bonds.forEach((b) => {
        if (b.sourceId === b.targetId) return;
        neighbors.get(b.sourceId)?.push(b.targetId);
        neighbors.get(b.targetId)?.push(b.sourceId);
      });

      atoms.forEach((center) => {
        const nbrIds = neighbors.get(center.id) || [];
        if (nbrIds.length < 2) return;

        for (let i = 0; i < Math.min(2, nbrIds.length - 1); i++) {
          const a1 = atomMap.get(nbrIds[i]);
          const a2 = atomMap.get(nbrIds[i + 1]);
          if (!a1 || !a2) continue;

          const v1x = a1.x - center.x;
          const v1y = a1.y - center.y;
          const v2x = a2.x - center.x;
          const v2y = a2.y - center.y;

          const l1 = Math.hypot(v1x, v1y) || 1;
          const l2 = Math.hypot(v2x, v2y) || 1;

          const dot = (v1x * v2x + v1y * v2y) / (l1 * l2);
          const angleRad = Math.acos(Math.max(-1, Math.min(1, dot)));
          const angleDeg = (angleRad * 180 / Math.PI).toFixed(1);

          const ang1 = Math.atan2(v1y, v1x);
          const ang2 = Math.atan2(v2y, v2x);

          ctx.save();
          // 각도 호(Arc)
          ctx.strokeStyle = "rgba(251, 191, 36, 0.75)";
          ctx.lineWidth = 1.3;
          ctx.setLineDash([3, 2]);
          ctx.beginPath();
          ctx.arc(center.x, center.y, 25, ang1, ang2, ang2 < ang1);
          ctx.stroke();
          ctx.setLineDash([]);

          // 각도 라벨
          const bisector = (ang1 + ang2) / 2 + (Math.abs(ang1 - ang2) > Math.PI ? Math.PI : 0);
          const lx = center.x + 36 * Math.cos(bisector);
          const ly = center.y + 36 * Math.sin(bisector);

          ctx.font = "bold 9px ui-monospace, SFMono-Regular, monospace";
          const degText = `${angleDeg}°`;
          const dw = ctx.measureText(degText).width + 6;

          ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
          ctx.strokeStyle = "#fbbf24";
          ctx.lineWidth = 1;
          ctx.beginPath();
          if (typeof ctx.roundRect === "function") {
            ctx.roundRect(lx - dw / 2, ly - 7, dw, 14, 3);
          } else {
            ctx.rect(lx - dw / 2, ly - 7, dw, 14);
          }
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = "#fbbf24";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(degText, lx, ly);
          ctx.restore();
        }
      });
    }

    ctx.restore(); // 월드 변환 복원
    ctx.restore(); // dpr 복원
  }, [
    atoms,
    bonds,
    pan,
    zoom,
    hoveredAtomId,
    hoveredBondId,
    selectedAtomId,
    dragSourceId,
    dragCurrentPos,
    isDraggingNode,
    invalidAtomIds,
    invalidBondIds,
    showDimensions,
  ]);

  // ─────────────────────────────────────────────────────────────
  // 마우스 상호작용 핸들러 (Pan / Zoom / 드로잉)
  // ─────────────────────────────────────────────────────────────
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    // [패닝 조건 1] 마우스 휠(가운데) 클릭, 마우스 우클릭, 'pan' 도구 선택 중이거나 스페이스바 누른 상태
    if (e.button === 1 || e.button === 2 || activeTool === "pan" || isSpacePressed) {
      setIsPanning(true);
      panStartRef.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        panX: pan.x,
        panY: pan.y,
      };
      return;
    }

    if (e.button !== 0) return; // 좌클릭만 화학 드로잉 진행

    const { x, y } = screenToWorld(screenX, screenY);
    const clickedAtom = findAtomAt(x, y, 8 / zoom);
    const clickedBond = findBondAt(x, y, 9 / zoom);

    // 1. 지우개 도구
    if (activeTool === "erase") {
      if (clickedAtom) {
        onAtomsChange(atoms.filter((a) => a.id !== clickedAtom.id));
        onBondsChange(
          bonds.filter(
            (b) => b.sourceId !== clickedAtom.id && b.targetId !== clickedAtom.id
          )
        );
      } else if (clickedBond) {
        onBondsChange(bonds.filter((b) => b.id !== clickedBond.id));
      }
      return;
    }

    // 2. 원자 위치 개별 이동 도구
    if (activeTool === "move") {
      if (clickedAtom) {
        setSelectedAtomId(clickedAtom.id);
        setIsDraggingNode(true);
      }
      return;
    }

    // 3. 원소 치환 도구
    if (activeTool === "atom" && clickedAtom) {
      if (clickedAtom.symbol !== selectedAtomSymbol) {
        onAtomsChange(
          atoms.map((a) => (a.id === clickedAtom.id ? { ...a, symbol: selectedAtomSymbol } : a))
        );
      }
      return;
    }

    // 4. 결합 차수 토글 (단일 ↔ 이중 ↔ 삼중)
    if (!clickedAtom && clickedBond) {
      const nextType: BondType =
        clickedBond.type === "single"
          ? "double"
          : clickedBond.type === "double"
          ? "triple"
          : "single";

      onBondsChange(
        bonds.map((b) => (b.id === clickedBond.id ? { ...b, type: nextType } : b))
      );
      return;
    }

    // 5. 벤젠 고리 스탬프
    if (activeTool === "benzene") {
      const targetCenter = clickedAtom ? { x: clickedAtom.x + 80, y: clickedAtom.y } : { x, y };
      const ring = createBenzeneRing(targetCenter.x, targetCenter.y);

      if (clickedAtom) {
        const bridgeBond: BondEdge = {
          id: `b_bridge_${Date.now()}`,
          sourceId: clickedAtom.id,
          targetId: ring.atoms[0].id,
          type: "single",
        };
        onAtomsChange([...atoms, ...ring.atoms]);
        onBondsChange([...bonds, ...ring.bonds, bridgeBond]);
      } else {
        onAtomsChange([...atoms, ...ring.atoms]);
        onBondsChange([...bonds, ...ring.bonds]);
      }
      return;
    }

    // 6. 5각 고리 스탬프
    if (activeTool === "cyclopentyl") {
      const targetCenter = clickedAtom ? { x: clickedAtom.x + 75, y: clickedAtom.y } : { x, y };
      const ring = createCyclopentylRing(targetCenter.x, targetCenter.y);

      if (clickedAtom) {
        const bridgeBond: BondEdge = {
          id: `b_bridge_${Date.now()}`,
          sourceId: clickedAtom.id,
          targetId: ring.atoms[0].id,
          type: "single",
        };
        onAtomsChange([...atoms, ...ring.atoms]);
        onBondsChange([...bonds, ...ring.bonds, bridgeBond]);
      } else {
        onAtomsChange([...atoms, ...ring.atoms]);
        onBondsChange([...bonds, ...ring.bonds]);
      }
      return;
    }

    // 7. 결합 도구 (single, double, triple)
    if (clickedAtom) {
      setDragSourceId(clickedAtom.id);
      setSelectedAtomId(clickedAtom.id);
      setDragCurrentPos({ x: Math.round(x), y: Math.round(y) });
    } else {
      const newAtom: AtomNode = {
        id: `atom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        symbol: selectedAtomSymbol,
        x: Math.round(x),
        y: Math.round(y),
      };
      onAtomsChange([...atoms, newAtom]);
      setSelectedAtomId(newAtom.id);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // [화면 패닝 중]
    if (isPanning) {
      const dx = e.clientX - panStartRef.current.mouseX;
      const dy = e.clientY - panStartRef.current.mouseY;
      setPan({
        x: Math.round(panStartRef.current.panX + dx),
        y: Math.round(panStartRef.current.panY + dy),
      });
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const { x, y } = screenToWorld(screenX, screenY);

    const hoveredAtom = findAtomAt(x, y, 8 / zoom);
    const hoveredBond = findBondAt(x, y, 9 / zoom);

    setHoveredAtomId(hoveredAtom ? hoveredAtom.id : null);
    setHoveredBondId(!hoveredAtom && hoveredBond ? hoveredBond.id : null);

    // 원자 개별 드래그 이동
    if (isDraggingNode && selectedAtomId) {
      onAtomsChange(
        atoms.map((a) =>
          a.id === selectedAtomId ? { ...a, x: Math.round(x), y: Math.round(y) } : a
        )
      );
      return;
    }

    // 결합 생성 드래그 가이드
    if (dragSourceId) {
      setDragCurrentPos({ x: Math.round(x), y: Math.round(y) });
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (isDraggingNode) {
      setIsDraggingNode(false);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const { x, y } = screenToWorld(screenX, screenY);
    const targetAtom = findAtomAt(x, y, 8 / zoom);

    if (dragSourceId) {
      const sourceAtom = atoms.find((a) => a.id === dragSourceId);

      if (targetAtom && targetAtom.id !== dragSourceId) {
        const existingIdx = bonds.findIndex(
          (b) =>
            (b.sourceId === dragSourceId && b.targetId === targetAtom.id) ||
            (b.sourceId === targetAtom.id && b.targetId === dragSourceId)
        );

        const currentToolBondType: BondType =
          activeTool === "double" ? "double" : activeTool === "triple" ? "triple" : "single";

        if (existingIdx >= 0) {
          onBondsChange(
            bonds.map((b, i) =>
              i === existingIdx
                ? {
                    ...b,
                    type:
                      b.type === "single"
                        ? "double"
                        : b.type === "double"
                        ? "triple"
                        : "single",
                  }
                : b
            )
          );
        } else {
          const newBond: BondEdge = {
            id: `b_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            sourceId: dragSourceId,
            targetId: targetAtom.id,
            type: currentToolBondType,
          };
          onBondsChange([...bonds, newBond]);
        }
      } else if (sourceAtom && (!targetAtom || targetAtom.id === dragSourceId)) {
        // 스마트 각도(120° 지그재그) 자동 연장
        const nextPos = calculateNextChainPosition(sourceAtom);
        const newAtom: AtomNode = {
          id: `atom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          symbol: selectedAtomSymbol,
          x: nextPos.x,
          y: nextPos.y,
        };

        const currentToolBondType: BondType =
          activeTool === "double" ? "double" : activeTool === "triple" ? "triple" : "single";

        const newBond: BondEdge = {
          id: `b_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          sourceId: sourceAtom.id,
          targetId: newAtom.id,
          type: currentToolBondType,
        };

        onAtomsChange([...atoms, newAtom]);
        onBondsChange([...bonds, newBond]);
        setSelectedAtomId(newAtom.id);
      }

      setDragSourceId(null);
      setDragCurrentPos(null);
    }
  };

  const handleMouseLeave = () => {
    setHoveredAtomId(null);
    setHoveredBondId(null);
    if (isPanning) setIsPanning(false);
    if (isDraggingNode) setIsDraggingNode(false);
    if (dragSourceId) {
      setDragSourceId(null);
      setDragCurrentPos(null);
    }
  };

  // 우클릭 컨텍스트 메뉴 방지 (우클릭 드래그로 화면 이동 지원)
  const handleContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
  };

  // 상황에 맞는 마우스 커서 산출
  let currentCursor = "cursor-crosshair";
  if (isPanning) {
    currentCursor = "cursor-grabbing";
  } else if (activeTool === "pan" || isSpacePressed) {
    currentCursor = "cursor-grab";
  } else if (activeTool === "move") {
    currentCursor = isDraggingNode
      ? "cursor-grabbing"
      : hoveredAtomId
      ? "cursor-grab"
      : "cursor-default";
  } else if (activeTool === "erase") {
    currentCursor = "cursor-pointer";
  } else if (activeTool === "atom") {
    currentCursor = hoveredAtomId ? "cursor-pointer" : "cursor-default";
  } else {
    currentCursor = hoveredAtomId ? "cursor-pointer" : "cursor-crosshair";
  }

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col w-full h-full bg-[#080d18] select-none overflow-hidden ${className}`}
    >
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onContextMenu={handleContextMenu}
        onWheel={handleWheel}
        className={`w-full h-full block ${currentCursor}`}
      />

      {/* ─────────────────────────────────────────────────────────────
          화면 이동 / 확대 / 축소 줌 컨트롤러 플로팅 위젯 (우하단)
          ───────────────────────────────────────────────────────────── */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-slate-950/85 backdrop-blur-md p-1.5 rounded-xl border border-slate-800 shadow-xl z-20">
        <button
          onClick={handleZoomIn}
          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white transition"
          title="화면 확대 (휠 위로)"
        >
          <ZoomIn size={14} />
        </button>

        <span className="text-[11px] font-mono text-slate-300 px-1.5 min-w-[42px] text-center select-none font-semibold">
          {Math.round(zoom * 100)}%
        </span>

        <button
          onClick={handleZoomOut}
          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white transition"
          title="화면 축소 (휠 아래로)"
        >
          <ZoomOut size={14} />
        </button>

        <div className="w-px h-4 bg-slate-800 mx-0.5" />

        <button
          onClick={handleFitContent}
          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-sky-400 hover:text-sky-300 transition flex items-center gap-1 text-[11px]"
          title="전체 분자 화면 중앙 맞춤 (Fit to View)"
        >
          <Maximize2 size={13} />
          <span className="hidden sm:inline">맞춤</span>
        </button>

        <button
          onClick={handleResetZoom}
          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition"
          title="100% 기본 배율 복원"
        >
          <RotateCcw size={13} />
        </button>
      </div>

      {/* 조작 힌트 배지 (좌하단) */}
      <div className="absolute bottom-2.5 left-2.5 flex flex-wrap items-center gap-2 bg-slate-950/85 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800 text-[11px] text-slate-400 pointer-events-none z-10 shadow-lg">
        <span className="flex items-center gap-1 text-sky-400 font-medium">
          <Hand size={12} />
          <span>화면 이동:</span>
        </span>
        <span className="text-slate-300">
          우클릭 드래그 / 휠 클릭 드래그 / Space+드래그 / '화면 이동' 도구
        </span>
        <span className="text-slate-600">|</span>
        <span className="flex items-center gap-1 text-emerald-400 font-medium">
          <ZoomIn size={12} />
          <span>확대/축소:</span>
        </span>
        <span className="text-slate-300">마우스 휠 스크롤</span>
      </div>
    </div>
  );
};
