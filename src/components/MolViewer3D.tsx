import React, { useMemo, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Grid, Html } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import {
  RotateCcw,
  Play,
  Pause,
  Box,
  Sparkles,
  Maximize2,
  Move,
  PenTool,
  Ruler,
  Eraser,
  Link,
  PlusCircle,
} from "lucide-react";
import type { AtomNode, BondEdge, AtomSymbol } from "./MolDrawCanvas";

export interface MolViewer3DProps {
  atoms: AtomNode[];
  bonds: BondEdge[];
  className?: string;
  onAtomsChange?: (atoms: AtomNode[]) => void;
  onBondsChange?: (bonds: BondEdge[]) => void;
  selectedAtomSymbol?: AtomSymbol;
  showDimensions?: boolean;
  onToggleDimensions?: () => void;
}

// CPK 컬러 및 물리적 반경 정의
export const CPK_PALETTE: Record<
  AtomSymbol,
  { color: string; radius: number; vdwRadius: number; name: string }
> = {
  C: { color: "#475569", radius: 0.42, vdwRadius: 0.85, name: "Carbon (탄소)" },
  O: { color: "#ef4444", radius: 0.38, vdwRadius: 0.78, name: "Oxygen (산소)" },
  N: { color: "#3b82f6", radius: 0.40, vdwRadius: 0.80, name: "Nitrogen (질소)" },
  H: { color: "#f8fafc", radius: 0.25, vdwRadius: 0.55, name: "Hydrogen (수소)" },
  Cl: { color: "#10b981", radius: 0.46, vdwRadius: 0.88, name: "Chlorine (염소)" },
  F: { color: "#34d399", radius: 0.35, vdwRadius: 0.70, name: "Fluorine (불소)" },
  S: { color: "#eab308", radius: 0.44, vdwRadius: 0.85, name: "Sulfur (황)" },
};

// 3D 공간 상의 원자 정보
interface Atom3D {
  id: string;
  symbol: AtomSymbol;
  position: [number, number, number];
  color: string;
  radius: number;
  vdwRadius: number;
}

// 3D 공간 상의 결합 정보
interface Bond3D {
  id: string;
  sourceId: string;
  targetId: string;
  posA: [number, number, number];
  posB: [number, number, number];
  type: "single" | "double" | "triple";
  lengthAngstrom: number;
}

// 두 점 사이를 잇는 원통(Cylinder) 메쉬 및 치수 라벨
function BondCylinder({
  bond,
  showDimensions,
  radius = 0.08,
  onClick,
}: {
  bond: Bond3D;
  showDimensions: boolean;
  radius?: number;
  onClick?: () => void;
}) {
  const { posA, posB, type, lengthAngstrom } = bond;

  const { position, quaternion, length, offsetDirs } = useMemo(() => {
    const vA = new THREE.Vector3(...posA);
    const vB = new THREE.Vector3(...posB);
    const mid = new THREE.Vector3().addVectors(vA, vB).multiplyScalar(0.5);
    const dir = new THREE.Vector3().subVectors(vB, vA);
    const len = dir.length();

    const quat = new THREE.Quaternion();
    let norm1 = new THREE.Vector3(0, 0, 1);

    if (len > 0.0001) {
      dir.normalize();
      quat.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);

      norm1 = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 0, 1));
      if (norm1.lengthSq() < 0.001) {
        norm1 = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(1, 0, 0));
      }
      norm1.normalize();
    }

    return {
      position: [mid.x, mid.y, mid.z] as [number, number, number],
      quaternion: quat,
      length: Math.max(len, 0.05),
      offsetDirs: norm1,
    };
  }, [posA, posB]);

  return (
    <group onClick={(e) => { e.stopPropagation(); onClick?.(); }}>
      {type === "double" ? (
        <group>
          {(() => {
            const offsetDist = 0.12;
            const vOffset = offsetDirs.clone().multiplyScalar(offsetDist);
            const pos1: [number, number, number] = [
              position[0] + vOffset.x,
              position[1] + vOffset.y,
              position[2] + vOffset.z,
            ];
            const pos2: [number, number, number] = [
              position[0] - vOffset.x,
              position[1] - vOffset.y,
              position[2] - vOffset.z,
            ];
            return (
              <>
                <mesh position={pos1} quaternion={quaternion}>
                  <cylinderGeometry args={[radius * 0.75, radius * 0.75, length, 16]} />
                  <meshStandardMaterial color="#cbd5e1" roughness={0.3} metalness={0.3} />
                </mesh>
                <mesh position={pos2} quaternion={quaternion}>
                  <cylinderGeometry args={[radius * 0.75, radius * 0.75, length, 16]} />
                  <meshStandardMaterial color="#cbd5e1" roughness={0.3} metalness={0.3} />
                </mesh>
              </>
            );
          })()}
        </group>
      ) : type === "triple" ? (
        <group>
          {(() => {
            const offsetDist = 0.15;
            const vOffset = offsetDirs.clone().multiplyScalar(offsetDist);
            const pos1: [number, number, number] = [
              position[0] + vOffset.x,
              position[1] + vOffset.y,
              position[2] + vOffset.z,
            ];
            const pos2: [number, number, number] = [
              position[0] - vOffset.x,
              position[1] - vOffset.y,
              position[2] - vOffset.z,
            ];
            return (
              <>
                <mesh position={position} quaternion={quaternion}>
                  <cylinderGeometry args={[radius * 0.65, radius * 0.65, length, 16]} />
                  <meshStandardMaterial color="#cbd5e1" roughness={0.25} metalness={0.4} />
                </mesh>
                <mesh position={pos1} quaternion={quaternion}>
                  <cylinderGeometry args={[radius * 0.65, radius * 0.65, length, 16]} />
                  <meshStandardMaterial color="#cbd5e1" roughness={0.25} metalness={0.4} />
                </mesh>
                <mesh position={pos2} quaternion={quaternion}>
                  <cylinderGeometry args={[radius * 0.65, radius * 0.65, length, 16]} />
                  <meshStandardMaterial color="#cbd5e1" roughness={0.25} metalness={0.4} />
                </mesh>
              </>
            );
          })()}
        </group>
      ) : (
        <mesh position={position} quaternion={quaternion}>
          <cylinderGeometry args={[radius, radius, length, 16]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.3} metalness={0.35} />
        </mesh>
      )}

      {/* 3D 결합 길이 치수 오버레이 라벨 (Å) */}
      {showDimensions && (
        <Html position={position} center distanceFactor={14} zIndexRange={[10, 0]}>
          <div className="pointer-events-none select-none px-1.5 py-0.5 rounded bg-slate-950/90 border border-sky-400 text-[10px] font-mono font-bold text-sky-300 shadow-md whitespace-nowrap">
            {lengthAngstrom.toFixed(2)} Å
          </div>
        </Html>
      )}
    </group>
  );
}

// 3D 원자(Sphere) 메쉬 컴포넌트
function AtomSphere({
  atom,
  styleMode,
  isSelected,
  onHover,
  onClick,
}: {
  atom: Atom3D;
  styleMode: "ballAndStick" | "spaceFilling" | "wireframe";
  isSelected: boolean;
  onHover: (atom: Atom3D | null) => void;
  onClick: (atom: Atom3D) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const meshRef = useRef<THREE.Mesh>(null);

  const r = styleMode === "spaceFilling" ? atom.vdwRadius : atom.radius;

  return (
    <group position={atom.position}>
      <mesh
        ref={meshRef}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          onHover(atom);
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          setHovered(false);
          onHover(null);
        }}
        onClick={(e) => {
          e.stopPropagation();
          onClick(atom);
        }}
      >
        <sphereGeometry args={[r, 32, 32]} />
        <meshPhysicalMaterial
          color={isSelected ? "#a855f7" : hovered ? "#38bdf8" : atom.color}
          roughness={0.25}
          metalness={0.15}
          clearcoat={0.6}
          clearcoatRoughness={0.1}
          emissive={isSelected ? "#a855f7" : hovered ? atom.color : "#000000"}
          emissiveIntensity={isSelected ? 0.6 : hovered ? 0.35 : 0}
        />
      </mesh>

      {/* 선택된 상태 표시 링 */}
      {isSelected && (
        <mesh>
          <ringGeometry args={[r + 0.08, r + 0.16, 32]} />
          <meshBasicMaterial color="#c084fc" side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}

// 3D 결합 각도(Bond Angle) 치수 오버레이 표시 컴포넌트
function AngleDimensions3D({
  atoms3D,
  bonds3D,
}: {
  atoms3D: Atom3D[];
  bonds3D: Bond3D[];
}) {
  const angleTags = useMemo(() => {
    const atomMap = new Map(atoms3D.map((a) => [a.id, a]));
    const neighbors = new Map<string, string[]>();
    atoms3D.forEach((a) => neighbors.set(a.id, []));

    bonds3D.forEach((b) => {
      neighbors.get(b.sourceId)?.push(b.targetId);
      neighbors.get(b.targetId)?.push(b.sourceId);
    });

    const tags: { id: string; pos: [number, number, number]; angleDeg: string }[] = [];

    atoms3D.forEach((center) => {
      const nbrs = neighbors.get(center.id) || [];
      if (nbrs.length < 2) return;

      for (let i = 0; i < Math.min(2, nbrs.length - 1); i++) {
        const a1 = atomMap.get(nbrs[i]);
        const a2 = atomMap.get(nbrs[i + 1]);
        if (!a1 || !a2) continue;

        const v1 = new THREE.Vector3(...a1.position).sub(new THREE.Vector3(...center.position));
        const v2 = new THREE.Vector3(...a2.position).sub(new THREE.Vector3(...center.position));

        const l1 = v1.length();
        const l2 = v2.length();
        if (l1 < 0.001 || l2 < 0.001) continue;

        const dot = v1.dot(v2) / (l1 * l2);
        const rad = Math.acos(Math.max(-1, Math.min(1, dot)));
        const deg = (rad * 180 / Math.PI).toFixed(1);

        const bisector = v1.clone().normalize().add(v2.clone().normalize()).multiplyScalar(0.45);
        const tagPos = new THREE.Vector3(...center.position).add(bisector);

        tags.push({
          id: `ang_${center.id}_${i}`,
          pos: [tagPos.x, tagPos.y, tagPos.z],
          angleDeg: deg,
        });
      }
    });

    return tags;
  }, [atoms3D, bonds3D]);

  return (
    <>
      {angleTags.map((tag) => (
        <Html key={tag.id} position={tag.pos} center distanceFactor={14} zIndexRange={[10, 0]}>
          <div className="pointer-events-none select-none px-1.5 py-0.5 rounded bg-slate-950/90 border border-amber-400 text-[9px] font-mono font-bold text-amber-300 shadow-md whitespace-nowrap">
            {tag.angleDeg}°
          </div>
        </Html>
      ))}
    </>
  );
}

// 자동 회전 및 분자 집합 렌더링 그룹
function MoleculeGroup({
  atoms3D,
  bonds3D,
  styleMode,
  autoRotate,
  showDimensions,
  selectedAtomId,
  onHoverAtom,
  onClickAtom,
  onClickBond,
}: {
  atoms3D: Atom3D[];
  bonds3D: Bond3D[];
  styleMode: "ballAndStick" | "spaceFilling" | "wireframe";
  autoRotate: boolean;
  showDimensions: boolean;
  selectedAtomId: string | null;
  onHoverAtom: (atom: Atom3D | null) => void;
  onClickAtom: (atom: Atom3D) => void;
  onClickBond: (bond: Bond3D) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (autoRotate && groupRef.current) {
      groupRef.current.rotation.y += delta * 0.4;
    }
  });

  return (
    <group ref={groupRef}>
      {styleMode !== "spaceFilling" &&
        bonds3D.map((bond) => (
          <BondCylinder
            key={bond.id}
            bond={bond}
            showDimensions={showDimensions}
            radius={0.09}
            onClick={() => onClickBond(bond)}
          />
        ))}

      {atoms3D.map((atom) => (
        <AtomSphere
          key={atom.id}
          atom={atom}
          styleMode={styleMode}
          isSelected={selectedAtomId === atom.id}
          onHover={onHoverAtom}
          onClick={onClickAtom}
        />
      ))}

      {showDimensions && <AngleDimensions3D atoms3D={atoms3D} bonds3D={bonds3D} />}
    </group>
  );
}

export const MolViewer3D: React.FC<MolViewer3DProps> = ({
  atoms,
  bonds,
  className = "",
  onAtomsChange,
  onBondsChange,
  selectedAtomSymbol = "C",
  showDimensions: propShowDimensions,
  onToggleDimensions,
}) => {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [controlMode] = useState<"orbit" | "pan">("orbit");
  const [styleMode, setStyleMode] = useState<"ballAndStick" | "spaceFilling" | "wireframe">(
    "ballAndStick"
  );
  const [hoveredAtom, setHoveredAtom] = useState<Atom3D | null>(null);

  // 3D 스케처(Sketcher) 드로잉 모드 상태
  const [is3DSketcher, setIs3DSketcher] = useState<boolean>(false);
  const [active3DTool, setActive3DTool] = useState<"orbit" | "addAtom" | "addBond" | "erase">("orbit");
  const [selectedAtomId3D, setSelectedAtomId3D] = useState<string | null>(null);
  const [activeAtomSymbol, setActiveAtomSymbol] = useState<AtomSymbol>(selectedAtomSymbol);

  // 치수 오버레이 로컬 상태 (props가 없을 경우 자체 관리)
  const [localShowDimensions, setLocalShowDimensions] = useState<boolean>(false);
  const showDimensions = propShowDimensions !== undefined ? propShowDimensions : localShowDimensions;

  const toggleDimensions = () => {
    if (onToggleDimensions) {
      onToggleDimensions();
    } else {
      setLocalShowDimensions(!localShowDimensions);
    }
  };

  // 2D 캔버스 좌표 -> 3D 좌표계 변환 및 정규화
  const { atoms3D, bonds3D } = useMemo(() => {
    if (atoms.length === 0) {
      return { atoms3D: [], bonds3D: [] };
    }

    let sumX = 0;
    let sumY = 0;
    atoms.forEach((a) => {
      sumX += a.x;
      sumY += a.y;
    });
    const centerX = sumX / atoms.length;
    const centerY = sumY / atoms.length;
    const scale = 0.035;

    const atom3DMap = new Map<string, Atom3D>();
    const atomList: Atom3D[] = atoms.map((a, idx) => {
      const palette = CPK_PALETTE[a.symbol] || CPK_PALETTE.C;
      const x = (a.x - centerX) * scale;
      const y = -(a.y - centerY) * scale;
      // 3D z 좌표가 명시되어 있으면 사용, 없으면 지그재그 입체 틸트
      const z = a.z !== undefined
        ? a.z * scale
        : ((idx % 2 === 0 ? 1 : -1) * 0.12) * (atoms.length > 2 ? 1 : 0);

      const item: Atom3D = {
        id: a.id,
        symbol: a.symbol,
        position: [x, y, z],
        color: palette.color,
        radius: palette.radius,
        vdwRadius: palette.vdwRadius,
      };
      atom3DMap.set(a.id, item);
      return item;
    });

    const bondList: Bond3D[] = [];
    bonds.forEach((b) => {
      const a = atom3DMap.get(b.sourceId);
      const target = atom3DMap.get(b.targetId);
      if (a && target) {
        const vA = new THREE.Vector3(...a.position);
        const vB = new THREE.Vector3(...target.position);
        const lenPx = vA.distanceTo(vB) / scale;
        const lenAng = lenPx * (1.5 / 55.0);

        bondList.push({
          id: b.id,
          sourceId: b.sourceId,
          targetId: b.targetId,
          posA: a.position,
          posB: target.position,
          type: b.type,
          lengthAngstrom: lenAng,
        });
      }
    });

    return { atoms3D: atomList, bonds3D: bondList };
  }, [atoms, bonds]);

  // 카메라 뷰 완전 초기화
  const handleResetCamera = useCallback(() => {
    if (controlsRef.current) {
      controlsRef.current.reset();
      const camera = controlsRef.current.object as THREE.PerspectiveCamera;
      camera.position.set(0, 0, 8);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  }, []);

  // 분자 전체 중앙 맞춤 (Focus to Center & Fit)
  const handleFitMolecule = useCallback(() => {
    if (!controlsRef.current || atoms3D.length === 0) return;
    const controls = controlsRef.current;
    const camera = controls.object as THREE.PerspectiveCamera;

    const box = new THREE.Box3();
    atoms3D.forEach((a) => box.expandByPoint(new THREE.Vector3(...a.position)));
    const center = new THREE.Vector3();
    box.getCenter(center);
    const sphere = new THREE.Sphere();
    box.getBoundingSphere(sphere);
    const radius = Math.max(1.4, sphere.radius);

    controls.target.copy(center);

    const fov = (camera.fov * Math.PI) / 180;
    const dist = (radius / Math.sin(fov / 2)) * 1.35;
    const dir = camera.position.clone().sub(controls.target).normalize();
    camera.position.copy(center.clone().add(dir.multiplyScalar(dist)));
    controls.update();
  }, [atoms3D]);

  // 3D 원자 클릭 핸들러 (3D 스케처 드로잉 인터랙션)
  const handleClickAtom = (atom: Atom3D) => {
    if (!is3DSketcher) return;

    // 1. 결합 연결 도구
    if (active3DTool === "addBond") {
      if (!selectedAtomId3D) {
        setSelectedAtomId3D(atom.id);
      } else if (selectedAtomId3D !== atom.id) {
        // 두 원자 간 신규 결합 생성
        const newBond: BondEdge = {
          id: `b3d_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          sourceId: selectedAtomId3D,
          targetId: atom.id,
          type: "single",
        };
        onBondsChange?.([...bonds, newBond]);
        setSelectedAtomId3D(null);
      }
    }
    // 2. 지우개 도구
    else if (active3DTool === "erase") {
      onAtomsChange?.(atoms.filter((a) => a.id !== atom.id));
      onBondsChange?.(
        bonds.filter((b) => b.sourceId !== atom.id && b.targetId !== atom.id)
      );
      if (selectedAtomId3D === atom.id) setSelectedAtomId3D(null);
    }
  };

  // 3D 결합 클릭 핸들러
  const handleClickBond = (bond: Bond3D) => {
    if (!is3DSketcher) return;

    if (active3DTool === "erase") {
      onBondsChange?.(bonds.filter((b) => b.id !== bond.id));
    }
  };

  // 3D 바닥 평면 클릭 핸들러 (신규 원자 3D 좌표 배치)
  const handleGroundPlaneClick = (e: any) => {
    if (!is3DSketcher || active3DTool !== "addAtom") return;
    e.stopPropagation();

    const pt = e.point;
    const scale = 0.035;
    // 3D 좌표를 2D 캔버스 픽셀로 변환
    const newAtom: AtomNode = {
      id: `atom3d_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      symbol: activeAtomSymbol,
      x: Math.round(250 + pt.x / scale),
      y: Math.round(210 - pt.y / scale),
      z: Math.round(pt.z / scale),
    };

    onAtomsChange?.([...atoms, newAtom]);
  };

  return (
    <div
      className={`relative flex flex-col bg-[#050811] border border-slate-800 rounded-xl overflow-hidden shadow-2xl text-slate-100 ${className}`}
    >
      {/* ─────────────────────────────────────────────────────────────
          1. 3D 뷰어 헤더 툴바
          ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 bg-slate-950/80 px-3 py-2 backdrop-blur-md z-10 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-sky-500/20 border border-sky-400/30 text-sky-400">
            <Box size={14} />
          </div>
          <span className="text-xs font-bold text-white tracking-tight">
            {is3DSketcher ? "3D 공간 직접 드로잉 (3D Sketcher)" : "3D 실시간 분자 렌더러"}
          </span>
          <span className="text-[10px] text-slate-400 font-mono bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded">
            CPK 3D
          </span>
        </div>

        {/* 조작 모드 및 유틸리티 컨트롤군 */}
        <div className="flex items-center gap-1.5">
          {/* 3D 스케처 모드 전환 버튼 */}
          <button
            onClick={() => {
              setIs3DSketcher(!is3DSketcher);
              if (!is3DSketcher) {
                setAutoRotate(false);
                setActive3DTool("addAtom");
              } else {
                setActive3DTool("orbit");
              }
            }}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm border ${
              is3DSketcher
                ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-purple-400/50 shadow-purple-500/20"
                : "bg-slate-900 text-purple-300 border-purple-500/30 hover:bg-slate-800"
            }`}
            title="3D 공간에서 직접 마우스로 원자와 결합을 그리는 3D Sketcher 모드 토글"
          >
            <PenTool size={12} />
            <span>{is3DSketcher ? "3D 드로잉 ON" : "3D 스케처 모드"}</span>
          </button>

          {/* 결합 길이 및 각도 치수(Dimensions) 토글 버튼 */}
          <button
            onClick={toggleDimensions}
            className={`px-2 py-1 rounded-lg border text-xs font-medium transition flex items-center gap-1 ${
              showDimensions
                ? "bg-cyan-500/20 text-cyan-300 border-cyan-400/40 font-semibold"
                : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
            }`}
            title="결합 길이(Å) 및 결합 각도(°) 치수 오버레이 표시 켜기/끄기"
          >
            <Ruler size={12} />
            <span>치수(Å/°)</span>
          </button>

          {/* 자동 회전 토글 */}
          <button
            onClick={() => setAutoRotate(!autoRotate)}
            className={`p-1.5 rounded-lg border text-xs transition flex items-center gap-1 ${
              autoRotate
                ? "bg-sky-500/20 text-sky-300 border-sky-400/40"
                : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
            }`}
            title={autoRotate ? "자동 회전 멈춤" : "자동 회전 시작"}
          >
            {autoRotate ? <Pause size={13} /> : <Play size={13} />}
          </button>

          {/* 렌더 스타일 모드 전환 */}
          <div className="hidden sm:flex items-center bg-slate-900 border border-slate-800 p-0.5 rounded-lg text-xs">
            <button
              onClick={() => setStyleMode("ballAndStick")}
              className={`px-2 py-1 rounded text-[11px] font-medium transition ${
                styleMode === "ballAndStick"
                  ? "bg-slate-700 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Ball & Stick
            </button>
            <button
              onClick={() => setStyleMode("spaceFilling")}
              className={`px-2 py-1 rounded text-[11px] font-medium transition ${
                styleMode === "spaceFilling"
                  ? "bg-slate-700 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Space Filling
            </button>
          </div>

          {/* 분자 중앙 맞춤 (Fit) */}
          <button
            onClick={handleFitMolecule}
            className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-white text-xs transition"
            title="분자 전체를 중앙에 맞추기 (Fit to Center)"
          >
            <Maximize2 size={13} />
          </button>

          {/* 카메라 리셋 */}
          <button
            onClick={handleResetCamera}
            className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-white text-xs transition"
            title="카메라 원위치"
          >
            <RotateCcw size={13} />
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. 3D 스케처 활성화 시 상단 3D 드로잉 팔레트
          ───────────────────────────────────────────────────────────── */}
      {is3DSketcher && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-purple-950/40 border-b border-purple-500/30 text-xs shrink-0 animate-in fade-in duration-150">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-purple-300">3D 도구:</span>
            <button
              onClick={() => setActive3DTool("addAtom")}
              className={`px-2 py-1 rounded-md text-[11px] font-semibold transition flex items-center gap-1 ${
                active3DTool === "addAtom"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "bg-slate-900/80 text-slate-400 hover:text-white"
              }`}
              title="3D 공간 또는 그리드 클릭 시 새 원자 배치"
            >
              <PlusCircle size={12} />
              <span>원자 배치</span>
            </button>
            <button
              onClick={() => setActive3DTool("addBond")}
              className={`px-2 py-1 rounded-md text-[11px] font-semibold transition flex items-center gap-1 ${
                active3DTool === "addBond"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "bg-slate-900/80 text-slate-400 hover:text-white"
              }`}
              title="원자 1 클릭 후 원자 2 클릭 시 3D 결합 실린더 생성"
            >
              <Link size={12} />
              <span>결합 연결 {selectedAtomId3D ? "(1선택됨)" : ""}</span>
            </button>
            <button
              onClick={() => setActive3DTool("erase")}
              className={`px-2 py-1 rounded-md text-[11px] font-semibold transition flex items-center gap-1 ${
                active3DTool === "erase"
                  ? "bg-rose-600 text-white shadow-sm"
                  : "bg-slate-900/80 text-slate-400 hover:text-rose-400"
              }`}
              title="3D 원자 또는 결합 클릭 시 삭제"
            >
              <Eraser size={12} />
              <span>지우개</span>
            </button>
            <button
              onClick={() => setActive3DTool("orbit")}
              className={`px-2 py-1 rounded-md text-[11px] font-semibold transition flex items-center gap-1 ${
                active3DTool === "orbit"
                  ? "bg-sky-600 text-white shadow-sm"
                  : "bg-slate-900/80 text-slate-400 hover:text-white"
              }`}
              title="3D 카메라 자유 회전"
            >
              <Move size={12} />
              <span>카메라 회전</span>
            </button>
          </div>

          {/* 원소 선택기 */}
          {active3DTool === "addAtom" && (
            <div className="flex items-center gap-1 bg-slate-900/90 px-2 py-0.5 rounded-lg border border-purple-500/30">
              <span className="text-[10px] text-slate-400">원소:</span>
              {(["C", "O", "N", "H", "Cl", "F", "S"] as AtomSymbol[]).map((sym) => (
                <button
                  key={sym}
                  onClick={() => setActiveAtomSymbol(sym)}
                  className={`px-1.5 py-0.2 rounded text-[11px] font-bold font-mono transition ${
                    activeAtomSymbol === sym
                      ? "bg-purple-600 text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {sym}
                </button>
              ))}
            </div>
          )}

          <div className="text-[10px] text-purple-300 font-mono">
            {active3DTool === "addAtom"
              ? "3D 공간(그리드)을 클릭해 원자를 배치하세요"
              : active3DTool === "addBond"
              ? selectedAtomId3D
                ? "연결할 두 번째 원자를 클릭하세요"
                : "시작 원자를 클릭하세요"
              : active3DTool === "erase"
              ? "삭제할 원자나 결합을 클릭하세요"
              : "마우스 드래그로 회전하세요"}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          3. Three.js Canvas 렌더링 뷰포트
          ───────────────────────────────────────────────────────────── */}
      <div className="relative flex-1 w-full min-h-[350px]">
        {atoms.length === 0 && !is3DSketcher ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 gap-2">
            <Sparkles size={28} className="text-slate-600 animate-pulse" />
            <p className="text-xs">스케치 캔버스에 원자를 추가하거나 템플릿을 선택하면 3D 구조가 나타납니다.</p>
          </div>
        ) : (
          <Canvas
            camera={{ position: [0, 0, 8], fov: 45 }}
            gl={{ antialias: true, alpha: true }}
            className="w-full h-full cursor-crosshair"
          >
            <ambientLight intensity={0.9} />
            <directionalLight position={[10, 15, 10]} intensity={1.4} />
            <directionalLight position={[-10, -10, -10]} intensity={0.6} color="#38bdf8" />
            <pointLight position={[0, 5, 5]} intensity={0.8} />

            {/* 3D 스케처 공간용 그리드 바닥면 */}
            <Grid
              renderOrder={-1}
              position={[0, -2.5, 0]}
              infiniteGrid
              cellSize={0.6}
              cellThickness={0.6}
              cellColor={is3DSketcher ? "#6366f1" : "#1e293b"}
              sectionSize={3}
              sectionThickness={1.2}
              sectionColor={is3DSketcher ? "#818cf8" : "#334155"}
              fadeDistance={25}
              fadeStrength={1.5}
            />

            {/* 3D 클릭 레이캐스팅 투명 평면 (클릭 시 원자 생성) */}
            {is3DSketcher && active3DTool === "addAtom" && (
              <mesh
                position={[0, 0, 0]}
                rotation={[-Math.PI / 2, 0, 0]}
                onPointerDown={handleGroundPlaneClick}
                visible={false}
              >
                <planeGeometry args={[100, 100]} />
                <meshBasicMaterial transparent opacity={0} />
              </mesh>
            )}

            {/* 3D 분자 구조 메쉬 */}
            <MoleculeGroup
              atoms3D={atoms3D}
              bonds3D={bonds3D}
              styleMode={styleMode}
              autoRotate={autoRotate}
              showDimensions={showDimensions}
              selectedAtomId={selectedAtomId3D}
              onHoverAtom={setHoveredAtom}
              onClickAtom={handleClickAtom}
              onClickBond={handleClickBond}
            />

            {/* 3D 회전 컨트롤 (addAtom 또는 addBond 시 좌클릭 상호작용 우선) */}
            <OrbitControls
              ref={controlsRef}
              makeDefault
              enabled={!is3DSketcher || active3DTool === "orbit"}
              enablePan={controlMode === "pan"}
              enableRotate={controlMode === "orbit"}
              enableZoom={true}
              minDistance={1.5}
              maxDistance={35}
            />
          </Canvas>
        )}

        {/* 3D 원자 호버 정보 인포 배지 */}
        {hoveredAtom && (
          <div className="absolute bottom-3 left-3 bg-slate-900/90 border border-slate-700/80 px-2.5 py-1.5 rounded-lg text-xs backdrop-blur-md shadow-lg pointer-events-none flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full border border-white/20"
              style={{ backgroundColor: hoveredAtom.color }}
            />
            <span className="font-bold text-white font-mono">
              {CPK_PALETTE[hoveredAtom.symbol]?.name || hoveredAtom.symbol}
            </span>
            <span className="text-slate-400 text-[10px]">
              반경: {hoveredAtom.radius.toFixed(2)}Å
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
