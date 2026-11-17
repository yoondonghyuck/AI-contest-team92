import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { RenderAtom, RenderBond } from "../model/polymers";

// GPU 메모리 재할당 및 Draw Call 병목 방지를 위한 공용 단위 Geometry (모듈 싱글톤)
const SHARED_ATOM_SPHERE_GEOM = new THREE.SphereGeometry(1, 16, 16);
const SHARED_BOND_CYLINDER_GEOM = new THREE.CylinderGeometry(1, 1, 1, 10);
const UP_AXIS = new THREE.Vector3(0, 1, 0);

// 3D 고분자 사슬 렌더링 그룹 (InstancedMesh 기반 단일 Draw-Call 최적화: 1,500+ 메쉬 -> 2 Draw Calls)
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
  const atomMeshRef = useRef<THREE.InstancedMesh>(null);
  const bondMeshRef = useRef<THREE.InstancedMesh>(null);
  const lastHoveredIdxRef = useRef<number | null>(null);

  useFrame((_, delta) => {
    if (autoRotate && groupRef.current) {
      groupRef.current.rotation.y += delta * 0.35;
    }
  });

  // 원자 InstancedMesh 행렬 및 색상 일괄 업데이트 (1회 GPU 업로드)
  useEffect(() => {
    const mesh = atomMeshRef.current;
    if (!mesh || atoms.length === 0) return;

    const dummy = new THREE.Object3D();
    const tempColor = new THREE.Color();

    for (let i = 0; i < atoms.length; i++) {
      const atom = atoms[i];
      const radius =
        styleMode === "spaceFilling"
          ? atom.radius * 2.2
          : styleMode === "wireframe"
          ? atom.radius * 0.4
          : atom.radius;

      dummy.position.set(atom.position[0], atom.position[1], atom.position[2]);
      dummy.quaternion.identity();
      dummy.scale.set(radius, radius, radius);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      const unitHue = (atom.unitIndex * 57) % 360;
      const colorStr =
        colorByUnit && atom.element === "C"
          ? `hsl(${unitHue}, 65%, 48%)`
          : atom.color;
      tempColor.set(colorStr);
      mesh.setColorAt(i, tempColor);
    }

    mesh.count = atoms.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [atoms, styleMode, colorByUnit]);

  // 결합선 InstancedMesh 행렬 및 색상 일괄 업데이트 (1회 GPU 업로드)
  useEffect(() => {
    const mesh = bondMeshRef.current;
    if (!mesh || styleMode === "spaceFilling" || bonds.length === 0) return;

    const dummy = new THREE.Object3D();
    const vA = new THREE.Vector3();
    const vB = new THREE.Vector3();
    const mid = new THREE.Vector3();
    const dir = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const tempColor = new THREE.Color();

    for (let i = 0; i < bonds.length; i++) {
      const bond = bonds[i];
      vA.set(bond.posA[0], bond.posA[1], bond.posA[2]);
      vB.set(bond.posB[0], bond.posB[1], bond.posB[2]);
      mid.addVectors(vA, vB).multiplyScalar(0.5);
      dir.subVectors(vB, vA);
      const len = Math.max(dir.length(), 0.05);

      if (len > 0.0001) {
        dir.normalize();
        quat.setFromUnitVectors(UP_AXIS, dir);
      } else {
        quat.identity();
      }

      const baseRadius = bond.isInterUnit ? 0.1 : 0.075;
      const effectiveRadius =
        bond.order === 2
          ? baseRadius * 1.35
          : bond.order === 3
          ? baseRadius * 1.6
          : baseRadius;

      dummy.position.copy(mid);
      dummy.quaternion.copy(quat);
      dummy.scale.set(effectiveRadius, len, effectiveRadius);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      tempColor.set(bond.isInterUnit ? "#38bdf8" : "#64748b");
      mesh.setColorAt(i, tempColor);
    }

    mesh.count = bonds.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [bonds, styleMode]);

  return (
    // 고분자 사슬 중심이 (0, 0, 0)에 오도록 오프셋
    <group ref={groupRef} position={[-center[0], -center[1], -center[2]]}>
      {/* 결합선 InstancedMesh (단일 Draw Call) */}
      {styleMode !== "spaceFilling" && bonds.length > 0 && (
        <instancedMesh
          key={`bonds-${bonds.length}`}
          ref={bondMeshRef}
          args={[SHARED_BOND_CYLINDER_GEOM, undefined, bonds.length]}
          frustumCulled={false}
        >
          <meshStandardMaterial
            roughness={0.35}
            metalness={0.25}
            transparent={true}
            opacity={0.92}
          />
        </instancedMesh>
      )}

      {/* 원자 구체 InstancedMesh (단일 Draw Call + instanceId 호버 감지) */}
      {atoms.length > 0 && (
        <instancedMesh
          key={`atoms-${atoms.length}`}
          ref={atomMeshRef}
          args={[SHARED_ATOM_SPHERE_GEOM, undefined, atoms.length]}
          frustumCulled={false}
          onPointerMove={(e) => {
            e.stopPropagation();
            const idx = e.instanceId;
            if (idx !== undefined && idx !== lastHoveredIdxRef.current) {
              lastHoveredIdxRef.current = idx;
              onHoverAtom?.(atoms[idx] ?? null);
            }
          }}
          onPointerOut={() => {
            lastHoveredIdxRef.current = null;
            onHoverAtom?.(null);
          }}
        >
          <meshStandardMaterial
            roughness={0.2}
            metalness={0.15}
            wireframe={styleMode === "wireframe"}
          />
        </instancedMesh>
      )}
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

  // 슬라이더 조작 시 이전 TubeGeometry VRAM 즉시 해제 (메모리 누수 방지)
  useEffect(() => {
    return () => {
      geometry?.dispose();
    };
  }, [geometry]);

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

