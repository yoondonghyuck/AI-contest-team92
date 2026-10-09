import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { RenderAtom, RenderBond } from "../model/polymers";

// 두 3D 좌표 사이를 잇는 원통(Cylinder) 메쉬
function BondCylinder({
  posA,
  posB,
  order = 1,
  color = "#64748b",
  radius = 0.08,
}: {
  posA: [number, number, number];
  posB: [number, number, number];
  order?: 1 | 2 | 3;
  color?: string;
  radius?: number;
}) {
  const { position, quaternion, length } = useMemo(() => {
    const vA = new THREE.Vector3(...posA);
    const vB = new THREE.Vector3(...posB);
    const mid = new THREE.Vector3().addVectors(vA, vB).multiplyScalar(0.5);
    const dir = new THREE.Vector3().subVectors(vB, vA);
    const len = dir.length();

    const quat = new THREE.Quaternion();
    if (len > 0.0001) {
      dir.normalize();
      // Three.js CylinderGeometry의 기본 방향은 Y축(0, 1, 0)
      quat.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    }
    return {
      position: [mid.x, mid.y, mid.z] as [number, number, number],
      quaternion: quat,
      length: Math.max(len, 0.05),
    };
  }, [posA, posB]);

  const effectiveRadius = order === 2 ? radius * 1.35 : order === 3 ? radius * 1.6 : radius;

  return (
    <mesh position={position} quaternion={quaternion}>
      <cylinderGeometry args={[effectiveRadius, effectiveRadius, length, 12]} />
      <meshStandardMaterial
        color={color}
        roughness={0.35}
        metalness={0.25}
        transparent={true}
        opacity={0.92}
      />
    </mesh>
  );
}

// 개별 원자 구체
function AtomSphere({
  atom,
  styleMode,
  colorByUnit,
  onHover,
}: {
  atom: RenderAtom;
  styleMode: "ballAndStick" | "spaceFilling" | "wireframe";
  colorByUnit: boolean;
  onHover?: (atom: RenderAtom | null) => void;
}) {
  // 단위체별 색조 구분 (colorByUnit 활성화 시)
  const unitHue = (atom.unitIndex * 57) % 360;
  const atomColor = colorByUnit && atom.element === "C"
    ? `hsl(${unitHue}, 65%, 48%)`
    : atom.color;

  const radius =
    styleMode === "spaceFilling"
      ? atom.radius * 2.2
      : styleMode === "wireframe"
      ? atom.radius * 0.4
      : atom.radius;

  return (
    <mesh
      position={atom.position}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover?.(atom);
      }}
      onPointerOut={() => onHover?.(null)}
    >
      <sphereGeometry args={[radius, 24, 24]} />
      <meshStandardMaterial
        color={atomColor}
        roughness={0.2}
        metalness={0.15}
        wireframe={styleMode === "wireframe"}
      />
    </mesh>
  );
}

// 3D 고분자 사슬 렌더링 그룹
export function PolymerChainMesh({
  atoms,
  bonds,
  center,
  styleMode,
  colorByUnit,
  autoRotate,
  onHoverAtom,
}: {
  atoms: RenderAtom[];
  bonds: RenderBond[];
  center: [number, number, number];
  styleMode: "ballAndStick" | "spaceFilling" | "wireframe";
  colorByUnit: boolean;
  autoRotate: boolean;
  onHoverAtom?: (atom: RenderAtom | null) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (autoRotate && groupRef.current) {
      groupRef.current.rotation.y += delta * 0.35;
    }
  });

  return (
    // 고분자 사슬 중심이 (0, 0, 0)에 오도록 오프셋
    <group ref={groupRef} position={[-center[0], -center[1], -center[2]]}>
      {/* 결합선 렌더링 (spaceFilling 모드에서는 결합 숨김) */}
      {styleMode !== "spaceFilling" &&
        bonds.map((bond) => (
          <BondCylinder
            key={bond.id}
            posA={bond.posA}
            posB={bond.posB}
            order={bond.order}
            color={bond.isInterUnit ? "#38bdf8" : "#64748b"}
            radius={bond.isInterUnit ? 0.10 : 0.075}
          />
        ))}

      {/* 원자 렌더링 */}
      {atoms.map((atom) => (
        <AtomSphere
          key={atom.id}
          atom={atom}
          styleMode={styleMode}
          colorByUnit={colorByUnit}
          onHover={onHoverAtom}
        />
      ))}
    </group>
  );
}

// 거대 고분자 사슬 3D 튜브 메쉬 (수백~수십만 분자량 렌더링)
export function MacroPolymerCoilMesh({
  points,
  autoRotate,
  color = "#38bdf8",
}: {
  points: [number, number, number][];
  autoRotate: boolean;
  color?: string;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (autoRotate && groupRef.current) {
      groupRef.current.rotation.y += delta * 0.25;
    }
  });

  const { geometry, center } = useMemo(() => {
    if (points.length < 2) return { geometry: null, center: [0, 0, 0] as [number, number, number] };
    const vectors = points.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
    const curve = new THREE.CatmullRomCurve3(vectors, false, "centripetal");
    const geom = new THREE.TubeGeometry(curve, Math.min(points.length * 3, 400), 0.35, 8, false);

    // 기하 중심 계산
    geom.computeBoundingBox();
    const box = geom.boundingBox;
    const midX = box ? (box.min.x + box.max.x) / 2 : 0;
    const midY = box ? (box.min.y + box.max.y) / 2 : 0;
    const midZ = box ? (box.min.z + box.max.z) / 2 : 0;

    return { geometry: geom, center: [midX, midY, midZ] as [number, number, number] };
  }, [points]);

  if (!geometry) return null;

  return (
    <group ref={groupRef} position={[-center[0], -center[1], -center[2]]}>
      <mesh geometry={geometry}>
        <meshStandardMaterial
          color={color}
          roughness={0.25}
          metalness={0.35}
          emissive="#0284c7"
          emissiveIntensity={0.15}
        />
      </mesh>
    </group>
  );
}

