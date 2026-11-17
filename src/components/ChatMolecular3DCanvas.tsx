import React, { useMemo, useRef, useState, useCallback, useEffect } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Grid, Html } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import {
  RotateCcw,
  Play,
  Pause,
  Box,
  Maximize2,
  Ruler,
} from "lucide-react";
import type { AtomNode, BondEdge, AtomSymbol } from "./MolDrawCanvas";
import { CPK_PALETTE } from "./MolViewer3D";
import type { ParsedCopolymerStructure } from "../model/chatMolecularParser";

export interface ChatMolecular3DCanvasProps {
  atoms: AtomNode[];
  bonds: BondEdge[];
  highlightAtomIds?: string[];
  highlightBondIds?: string[];
  showDimensions?: boolean;
  onToggleDimensions?: () => void;
  parsedCopolymer?: ParsedCopolymerStructure;
  className?: string;
}

interface Atom3DItem {
  id: string;
  symbol: AtomSymbol;
  position: [number, number, number];
  color: string;
  radius: number;
  vdwRadius: number;
  domainColor?: string;
  domainLabel?: string;
  isGraftBranch?: boolean;
  isJunction?: boolean;
}

interface Bond3DItem {
  id: string;
  sourceId: string;
  targetId: string;
  posA: [number, number, number];
  posB: [number, number, number];
  type: "single" | "double" | "triple";
  lengthAngstrom: number;
  domainColor?: string;
  isGraftLink?: boolean;
  isBlockLink?: boolean;
}

// GPU 지오메트리 재할당 방지를 위한 모듈 싱글톤 단위 메쉬
const UNIT_SPHERE_GEOM = new THREE.SphereGeometry(1, 18, 18);
const UNIT_CYLINDER_GEOM = new THREE.CylinderGeometry(1, 1, 1, 12);

// 3D 실시간 결합 원통 (Single, Double, Triple)
function BondCylinder3D({
  bond,
  isHighlighted,
  showDimensions,
  isLargeStructure,
}: {
  bond: Bond3DItem;
  isHighlighted: boolean;
  showDimensions: boolean;
  isLargeStructure: boolean;
}) {
  const { posA, posB, type, lengthAngstrom, domainColor, isGraftLink, isBlockLink } = bond;

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

  const isJunctionLink = Boolean(isGraftLink || isBlockLink);
  const bondColor = isJunctionLink
    ? "#f43f5e"
    : domainColor || (isHighlighted ? "#38bdf8" : "#94a3b8");
  const bondRadius = isJunctionLink ? 0.13 : isHighlighted ? 0.1 : 0.08;
  const shouldRenderDimension = showDimensions && (!isLargeStructure || isJunctionLink);

  return (
    <group>
      {type === "double" || type === "triple" ? (
        <group>
          {(() => {
            const offsetDist = 0.11;
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
            const subR = bondRadius * 0.75;
            return (
              <>
                <mesh
                  geometry={UNIT_CYLINDER_GEOM}
                  position={pos1}
                  quaternion={quaternion}
                  scale={[subR, length, subR]}
                >
                  <meshStandardMaterial color={bondColor} roughness={0.3} metalness={0.2} />
                </mesh>
                <mesh
                  geometry={UNIT_CYLINDER_GEOM}
                  position={pos2}
                  quaternion={quaternion}
                  scale={[subR, length, subR]}
                >
                  <meshStandardMaterial color={bondColor} roughness={0.3} metalness={0.2} />
                </mesh>
                {type === "triple" && (
                  <mesh
                    geometry={UNIT_CYLINDER_GEOM}
                    position={position}
                    quaternion={quaternion}
                    scale={[subR, length, subR]}
                  >
                    <meshStandardMaterial color={bondColor} roughness={0.3} metalness={0.2} />
                  </mesh>
                )}
              </>
            );
          })()}
        </group>
      ) : (
        <mesh
          geometry={UNIT_CYLINDER_GEOM}
          position={position}
          quaternion={quaternion}
          scale={[bondRadius, length, bondRadius]}
        >
          <meshStandardMaterial
            color={bondColor}
            roughness={0.28}
            metalness={0.25}
            emissive={isJunctionLink ? "#e11d48" : domainColor ? domainColor : isHighlighted ? "#0284c7" : "#000000"}
            emissiveIntensity={isJunctionLink ? 0.65 : domainColor ? 0.25 : isHighlighted ? 0.4 : 0}
          />
        </mesh>
      )}

      {/* 치수 라벨 (Ångström) */}
      {shouldRenderDimension && (
        <Html position={position} center distanceFactor={9} zIndexRange={[10, 0]}>
          <div
            className={`pointer-events-none select-none rounded px-1.5 py-0.5 text-[10px] font-mono font-semibold shadow-md whitespace-nowrap transition-transform ${
              isJunctionLink
                ? "bg-rose-500 text-white ring-2 ring-rose-300 scale-110 font-bold"
                : isHighlighted
                ? "bg-sky-500 text-slate-950 ring-2 ring-sky-300 scale-110 font-bold"
                : "bg-slate-900/90 text-sky-200 border border-sky-400/40 backdrop-blur-sm"
            }`}
          >
            {isGraftLink ? `Graft 분기 ${lengthAngstrom.toFixed(2)} Å` : isBlockLink ? `Block 접합 ${lengthAngstrom.toFixed(2)} Å` : `${lengthAngstrom.toFixed(2)} Å`}
          </div>
        </Html>
      )}
    </group>
  );
}

// 3D 원자 메쉬 (Sphere with CPK & Copolymer Domain Shader)
function AtomSphere3D({
  atom,
  styleMode,
  isHighlighted,
  isLargeStructure,
  onHover,
  onClick,
}: {
  atom: Atom3DItem;
  styleMode: "ballAndStick" | "spaceFilling" | "wireframe";
  isHighlighted: boolean;
  isLargeStructure: boolean;
  onHover: (atom: Atom3DItem | null) => void;
  onClick: (atom: Atom3DItem) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const r = styleMode === "spaceFilling" ? atom.vdwRadius : atom.radius;

  // 탄소(C) 원자에 공중합 도메인 컬러가 지정된 경우 도메인 컬러로 시각화하고, 헤테로 원소(O, N, Cl, F)는 CPK 고유 색상 유지
  const effectiveColor = hovered
    ? "#a855f7"
    : atom.isJunction
    ? "#f43f5e"
    : atom.symbol === "C" && atom.domainColor
    ? atom.domainColor
    : isHighlighted
    ? "#38bdf8"
    : atom.color;

  // 대형 공중합체에서 모든 원소마다 DOM(<Html>)을 생성하면 레이아웃 병목이 발생하므로 핵심 원자만 표시
  const showSymbolLabel =
    !isLargeStructure || hovered || atom.isJunction || isHighlighted || atom.symbol !== "C";

  return (
    <group position={atom.position}>
      <mesh
        geometry={UNIT_SPHERE_GEOM}
        scale={[r, r, r]}
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
        <meshStandardMaterial
          color={effectiveColor}
          roughness={0.22}
          metalness={0.18}
          wireframe={styleMode === "wireframe"}
          emissive={
            atom.isJunction
              ? "#e11d48"
              : hovered
              ? "#7e22ce"
              : atom.domainColor && atom.symbol === "C"
              ? atom.domainColor
              : isHighlighted
              ? "#0284c7"
              : "#000000"
          }
          emissiveIntensity={
            atom.isJunction ? 0.65 : hovered ? 0.4 : atom.domainColor && atom.symbol === "C" ? 0.22 : isHighlighted ? 0.5 : 0
          }
        />
      </mesh>

      {/* 분기점(Junction) 또는 자연어 수정 강조 링 (Glow Ring) */}
      {(atom.isJunction || (isHighlighted && !atom.domainColor)) && (
        <mesh>
          <ringGeometry args={[r + 0.08, r + 0.17, 24]} />
          <meshBasicMaterial color={atom.isJunction ? "#f43f5e" : "#38bdf8"} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* 3D 공중합체 블록/가지 도메인 플로팅 배지 */}
      {atom.domainLabel && (
        <Html position={[0, r + 0.72, 0]} center distanceFactor={10} zIndexRange={[15, 0]}>
          <div
            className="pointer-events-none select-none rounded-lg px-2 py-0.5 text-[10px] font-bold text-white shadow-xl whitespace-nowrap border backdrop-blur-md"
            style={{
              backgroundColor: `${atom.domainColor || "#0ea5e9"}e6`,
              borderColor: "#ffffff66",
            }}
          >
            {atom.domainLabel}
          </div>
        </Html>
      )}

      {/* 원소 기호 라벨 */}
      {showSymbolLabel && (
        <Html position={[0, r + 0.22, 0]} center distanceFactor={8} zIndexRange={[5, 0]}>
          <div className="pointer-events-none select-none text-[10px] font-bold text-slate-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
            {atom.symbol}
          </div>
        </Html>
      )}
    </group>
  );
}

// 3D 각도 표시기
function AngleDimensions3D({
  atoms3D,
  bonds3D,
}: {
  atoms3D: Atom3DItem[];
  bonds3D: Bond3DItem[];
}) {
  const atomMap = useMemo(() => new Map(atoms3D.map((a) => [a.id, a])), [atoms3D]);

  const angles = useMemo(() => {
    const adj = new Map<string, string[]>();
    bonds3D.forEach((b) => {
      if (!adj.has(b.sourceId)) adj.set(b.sourceId, []);
      if (!adj.has(b.targetId)) adj.set(b.targetId, []);
      adj.get(b.sourceId)!.push(b.targetId);
      adj.get(b.targetId)!.push(b.sourceId);
    });

    const result: Array<{
      vertexId: string;
      pos: [number, number, number];
      angleDeg: number;
    }> = [];

    adj.forEach((neighbors, vertexId) => {
      if (neighbors.length >= 2) {
        const vAtom = atomMap.get(vertexId);
        const aAtom = atomMap.get(neighbors[0]);
        const bAtom = atomMap.get(neighbors[1]);
        if (!vAtom || !aAtom || !bAtom) return;

        const vV = new THREE.Vector3(...vAtom.position);
        const vA = new THREE.Vector3(...aAtom.position).sub(vV).normalize();
        const vB = new THREE.Vector3(...bAtom.position).sub(vV).normalize();

        const dot = Math.max(-1, Math.min(1, vA.dot(vB)));
        const deg = (Math.acos(dot) * 180) / Math.PI;

        if (deg > 30 && deg < 179) {
          result.push({
            vertexId,
            pos: vAtom.position,
            angleDeg: Math.round(deg * 10) / 10,
          });
        }
      }
    });

    return result.slice(0, 3); // 가독성을 위해 대표 3개만 표시
  }, [atoms3D, bonds3D, atomMap]);

  return (
    <>
      {angles.map((ang) => (
        <Html key={ang.vertexId} position={ang.pos} center distanceFactor={9} zIndexRange={[12, 0]}>
          <div className="pointer-events-none select-none rounded bg-purple-950/90 border border-purple-400/50 px-1.5 py-0.5 text-[9px] font-mono font-bold text-purple-200 shadow-md backdrop-blur-sm -translate-y-4">
            ∠ {ang.angleDeg}°
          </div>
        </Html>
      ))}
    </>
  );
}

// 3D 씬 내 분자 집합 컨테이너
function MoleculeScene({
  atoms3D,
  bonds3D,
  highlightAtomIds,
  highlightBondIds,
  styleMode,
  autoRotate,
  showDimensions,
  onHoverAtom,
  onClickAtom,
}: {
  atoms3D: Atom3DItem[];
  bonds3D: Bond3DItem[];
  highlightAtomIds: Set<string>;
  highlightBondIds: Set<string>;
  styleMode: "ballAndStick" | "spaceFilling" | "wireframe";
  autoRotate: boolean;
  showDimensions: boolean;
  onHoverAtom: (atom: Atom3DItem | null) => void;
  onClickAtom: (atom: Atom3DItem) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (autoRotate && groupRef.current) {
      groupRef.current.rotation.y += delta * 0.35;
    }
  });

  const isLargeStructure = bonds3D.length > 24;

  return (
    <group ref={groupRef}>
      {styleMode !== "spaceFilling" &&
        bonds3D.map((bond) => (
          <BondCylinder3D
            key={bond.id}
            bond={bond}
            isHighlighted={highlightBondIds.has(bond.id)}
            showDimensions={showDimensions}
            isLargeStructure={isLargeStructure}
          />
        ))}

      {atoms3D.map((atom) => (
        <AtomSphere3D
          key={atom.id}
          atom={atom}
          styleMode={styleMode}
          isHighlighted={highlightAtomIds.has(atom.id)}
          isLargeStructure={isLargeStructure}
          onHover={onHoverAtom}
          onClick={onClickAtom}
        />
      ))}

      {showDimensions && !isLargeStructure && <AngleDimensions3D atoms3D={atoms3D} bonds3D={bonds3D} />}
    </group>
  );
}

export const ChatMolecular3DCanvas: React.FC<ChatMolecular3DCanvasProps> = ({
  atoms,
  bonds,
  highlightAtomIds = [],
  highlightBondIds = [],
  showDimensions: initialShowDimensions = true,
  parsedCopolymer,
  className = "",
}) => {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [showDimensions, setShowDimensions] = useState<boolean>(initialShowDimensions);
  const [styleMode, setStyleMode] = useState<"ballAndStick" | "spaceFilling" | "wireframe">("ballAndStick");
  const [hoveredAtom, setHoveredAtom] = useState<Atom3DItem | null>(null);
  const [selectedAtom, setSelectedAtom] = useState<Atom3DItem | null>(null);

  const highlightAtomSet = useMemo(() => new Set(highlightAtomIds), [highlightAtomIds]);
  const highlightBondSet = useMemo(() => new Set(highlightBondIds), [highlightBondIds]);

  // 2D/3D AtomNode -> 3D 월드 좌표계 정규화 매핑
  const { atoms3D, bonds3D } = useMemo(() => {
    if (atoms.length === 0) return { atoms3D: [], bonds3D: [] };

    let sumX = 0;
    let sumY = 0;
    let sumZ = 0;
    atoms.forEach((a) => {
      sumX += a.x;
      sumY += a.y;
      sumZ += a.z || 0;
    });

    const cX = sumX / atoms.length;
    const cY = sumY / atoms.length;
    const cZ = sumZ / atoms.length;
    const scale = 0.038;

    const atom3DMap = new Map<string, Atom3DItem>();
    const atomList: Atom3DItem[] = atoms.map((a, idx) => {
      const palette = CPK_PALETTE[a.symbol] || CPK_PALETTE.C;
      const x = (a.x - cX) * scale;
      const y = -(a.y - cY) * scale;
      const z = a.z !== undefined
        ? (a.z - cZ) * scale
        : (idx % 2 === 0 ? 0.2 : -0.2);

      const item: Atom3DItem = {
        id: a.id,
        symbol: a.symbol,
        position: [x, y, z],
        color: palette.color,
        radius: palette.radius,
        vdwRadius: palette.vdwRadius,
        domainColor: a.domainColor,
        domainLabel: a.domainLabel,
        isGraftBranch: a.isGraftBranch,
        isJunction: a.isJunction,
      };
      atom3DMap.set(a.id, item);
      return item;
    });

    const bondList: Bond3DItem[] = [];
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
          domainColor: b.domainColor,
          isGraftLink: b.isGraftLink,
          isBlockLink: b.isBlockLink,
        });
      }
    });

    return { atoms3D: atomList, bonds3D: bondList };
  }, [atoms, bonds]);

  // 카메라 중앙 맞춤 (Center & Fit)
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
    const radius = Math.max(1.6, sphere.radius);

    controls.target.copy(center);
    const fov = (camera.fov * Math.PI) / 180;
    const dist = (radius / Math.sin(fov / 2)) * 1.35;
    let dir = camera.position.clone().sub(controls.target);
    if (dir.lengthSq() < 0.0001 || isNaN(dir.x) || isNaN(dir.y) || isNaN(dir.z)) {
      dir = new THREE.Vector3(0, 0.3, 1);
    }
    dir.normalize();
    camera.position.copy(center.clone().add(dir.multiplyScalar(dist)));
    controls.update();
  }, [atoms3D]);

  // 카메라 뷰 초기화
  const handleResetCamera = useCallback(() => {
    if (controlsRef.current) {
      controlsRef.current.reset();
      const camera = controlsRef.current.object as THREE.PerspectiveCamera;
      camera.position.set(0, 0, 7.5);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  }, []);

  // 분자 구조가 변경될 때마다 자동 센터링 및 렌더링 갱신
  useEffect(() => {
    const timer = setTimeout(() => {
      handleFitMolecule();
    }, 40);
    return () => clearTimeout(timer);
  }, [atoms, bonds, handleFitMolecule]);

  return (
    <div className={`relative w-full h-full bg-[#050811] overflow-hidden select-none ${className}`}>
      {/* Three.js Canvas */}
      <Canvas
        camera={{ position: [0, 0, 7.5], fov: 45 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
        className="w-full h-full"
      >
        <color attach="background" args={["#050811"]} />
        <ambientLight intensity={0.8} />
        <directionalLight position={[10, 15, 10]} intensity={1.2} />
        <directionalLight position={[-10, -10, -5]} intensity={0.5} />
        <pointLight position={[0, 0, 6]} intensity={0.4} />

        <OrbitControls
          ref={controlsRef}
          makeDefault
          enableDamping
          dampingFactor={0.06}
          rotateSpeed={0.8}
          minDistance={1.5}
          maxDistance={30}
        />

        {/* 3D 깊이감을 위한 섬세한 플로어 그리드 */}
        <Grid
          position={[0, -2.6, 0]}
          args={[20, 20]}
          cellSize={0.5}
          cellThickness={0.6}
          cellColor="#1e293b"
          sectionSize={2.0}
          sectionThickness={1.0}
          sectionColor="#334155"
          fadeDistance={14}
        />

        <MoleculeScene
          atoms3D={atoms3D}
          bonds3D={bonds3D}
          highlightAtomIds={highlightAtomSet}
          highlightBondIds={highlightBondSet}
          styleMode={styleMode}
          autoRotate={autoRotate}
          showDimensions={showDimensions}
          onHoverAtom={setHoveredAtom}
          onClickAtom={setSelectedAtom}
        />
      </Canvas>

      {/* 상단 3D 컨트롤 오버레이 툴바 */}
      <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-xl bg-slate-950/80 p-1 border border-white/10 backdrop-blur-md shadow-lg z-10 text-xs">
        <button
          onClick={() => setAutoRotate(!autoRotate)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition ${
            autoRotate
              ? "bg-sky-500 text-white font-semibold shadow-sm shadow-sky-500/40"
              : "text-slate-300 hover:text-white hover:bg-white/5"
          }`}
          title="3D 자동 회전 토글"
        >
          {autoRotate ? <Pause size={13} /> : <Play size={13} />}
          <span>회전</span>
        </button>

        <button
          onClick={() => setShowDimensions(!showDimensions)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition ${
            showDimensions
              ? "bg-purple-600 text-white font-semibold"
              : "text-slate-300 hover:text-white hover:bg-white/5"
          }`}
          title="결합 거리 및 각도 치수 표시 토글"
        >
          <Ruler size={13} />
          <span>치수(Å·°)</span>
        </button>

        <button
          onClick={() =>
            setStyleMode(
              styleMode === "ballAndStick"
                ? "spaceFilling"
                : styleMode === "spaceFilling"
                ? "wireframe"
                : "ballAndStick"
            )
          }
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/5 transition"
          title="3D 렌더링 스타일 전환"
        >
          <Box size={13} />
          <span>
            {styleMode === "ballAndStick"
              ? "볼&스틱"
              : styleMode === "spaceFilling"
              ? "반데르발스"
              : "와이어"}
          </span>
        </button>

        <div className="h-3.5 w-px bg-white/10 mx-0.5" />

        <button
          onClick={handleFitMolecule}
          className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/5 transition"
          title="분자 중앙 맞춤 (Fit Center)"
        >
          <Maximize2 size={13} />
        </button>

        <button
          onClick={handleResetCamera}
          className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/5 transition"
          title="카메라 위치 초기화"
        >
          <RotateCcw size={13} />
        </button>
      </div>

      {/* 실시간 원자/결합 카운트 뱃지 */}
      <div className="absolute top-3 right-3 flex items-center gap-2 rounded-xl bg-slate-950/80 px-3 py-1.5 border border-white/10 backdrop-blur-md shadow-lg text-[11px] font-mono text-slate-300 z-10">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-sky-400 animate-pulse" />
          원자 <strong className="text-white">{atoms.length}</strong>
        </span>
        <span className="text-slate-600">•</span>
        <span>
          결합 <strong className="text-white">{bonds.length}</strong>
        </span>
      </div>

      {/* 하단 우측: 실시간 공중합체 파서 JSON & 도메인 범례 HUD */}
      {parsedCopolymer && (
        <div className="absolute bottom-3 right-3 rounded-xl bg-slate-950/90 p-2.5 border border-sky-400/40 backdrop-blur-md shadow-2xl text-xs text-slate-200 z-10 max-w-[310px] animate-in fade-in duration-150">
          <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-white/10">
            <span className="font-bold text-sky-300 flex items-center gap-1 text-[11px]">
              <span>🧬</span>
              <span>3D 공중합 아키텍처 브릿지</span>
            </span>
            <span className="rounded bg-purple-500/20 border border-purple-400/40 px-1.5 py-0.2 text-[9px] font-mono text-purple-200 uppercase">
              {parsedCopolymer.structure_type} · {parsedCopolymer.architecture}
            </span>
          </div>
          <div className="pt-1.5 flex flex-wrap items-center gap-1.5">
            {parsedCopolymer.componentDetails.map((comp, idx) => (
              <React.Fragment key={`${comp.id}_${idx}`}>
                {idx > 0 && (
                  <span className="text-[9px] font-mono font-bold text-rose-400 px-0.5">
                    —{parsedCopolymer.connectors[idx - 1]}→
                  </span>
                )}
                <span className="inline-flex items-center gap-1 rounded-md bg-slate-900 border border-white/10 px-1.5 py-0.5 text-[10px] font-semibold">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: comp.color }}
                  />
                  <span className="text-white">{comp.shortName}</span>
                  <span className="text-slate-400 text-[9px]">({comp.koreanName})</span>
                </span>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* 하단 좌측: 원자 인스펙터 HUD 카드 */}
      {(hoveredAtom || selectedAtom) && (
        <div className="absolute bottom-3 left-3 rounded-xl bg-slate-950/90 p-2.5 border border-sky-400/30 backdrop-blur-md shadow-xl text-xs text-slate-200 z-10 max-w-[240px] animate-in fade-in duration-100">
          <div className="flex items-center gap-1.5 font-bold text-sky-300 pb-1 border-b border-white/10">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: (hoveredAtom || selectedAtom)!.color }}
            />
            <span>{(hoveredAtom || selectedAtom)!.symbol} 원자 상세</span>
            <span className="text-[10px] text-slate-400 font-normal">
              #{(hoveredAtom || selectedAtom)!.id}
            </span>
          </div>
          <div className="pt-1.5 space-y-0.5 font-mono text-[11px]">
            <div>반경: {(hoveredAtom || selectedAtom)!.radius} Å</div>
            <div>
              위치: [
              {(hoveredAtom || selectedAtom)!.position.map((v) => v.toFixed(2)).join(", ")}
              ]
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
