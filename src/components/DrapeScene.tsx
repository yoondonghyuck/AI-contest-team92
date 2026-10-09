import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { CrossSectionShape, KesProperties } from "../types";
import { mapKesToPhysics } from "../model/surrogate";

const SEG = 56;
const SIZE = 1.95;
const PEDESTAL_R = 0.42;
const PEDESTAL_H = 0.92;

function fabricMaterial(shape: CrossSectionShape) {
  if (shape === "trilobal") {
    return {
      color: "#7ec8ff",
      roughness: 0.15,
      metalness: 0.3,
      sheen: 1,
      sheenColor: "#c4ecff",
      anisotropy: 0.85,
    };
  }
  if (shape === "hollow") {
    return {
      color: "#b7d9f2",
      roughness: 0.6,
      metalness: 0.04,
      sheen: 0.45,
      sheenColor: "#e8f4ff",
      anisotropy: 0.2,
    };
  }
  return {
    color: "#d9c7b0",
    roughness: 0.42,
    metalness: 0.06,
    sheen: 0.7,
    sheenColor: "#fff4e6",
    anisotropy: 0.35,
  };
}

export function DrapeCloth({ kes, shape }: { kes: KesProperties; shape: CrossSectionShape }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const geom = useMemo(() => {
    const g = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);

  const rest = useMemo(() => {
    const pos = geom.attributes.position;
    const x = new Float32Array(pos.count);
    const z = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      x[i] = pos.getX(i);
      z[i] = pos.getZ(i);
    }
    return { x, z };
  }, [geom]);

  const physics = mapKesToPhysics(kes, shape);
  const mat = fabricMaterial(shape);

  useLayoutEffect(() => {
    deform(0);
    geom.computeVertexNormals();
  });

  useFrame(({ clock }) => {
    deform(clock.elapsedTime);
    geom.computeVertexNormals();
  });

  function deform(t: number) {
    const pos = geom.attributes.position as THREE.BufferAttribute;
    const { stiffness, drop, waves, fluteAmp, stretch } = physics;
    for (let i = 0; i < pos.count; i++) {
      const x = rest.x[i];
      const z = rest.z[i];
      const r = Math.hypot(x, z);
      const theta = Math.atan2(z, x);
      if (r <= PEDESTAL_R) {
        pos.setXYZ(i, x, PEDESTAL_H + 0.012, z);
        continue;
      }
      const overhang = r - PEDESTAL_R;
      const settle = 1 - Math.exp(-overhang / stiffness);
      const y = PEDESTAL_H - drop * overhang * (0.55 + settle) * (0.85 + stretch * 0.2);
      const radialFall = Math.min(1, overhang / 0.85);
      const flute =
        Math.sin(theta * waves + t * 0.35) * fluteAmp * radialFall * (1.1 - stiffness * 0.18);
      const inward = 1 - fluteAmp * 0.15 * radialFall;
      pos.setXYZ(i, x * inward, y + flute, z * inward);
    }
    pos.needsUpdate = true;
  }

  return (
    <mesh ref={meshRef} geometry={geom} castShadow receiveShadow>
      <meshPhysicalMaterial
        color={mat.color}
        roughness={mat.roughness}
        metalness={mat.metalness}
        sheen={mat.sheen}
        sheenColor={mat.sheenColor}
        anisotropy={mat.anisotropy}
        side={THREE.DoubleSide}
        envMapIntensity={0.55}
      />
    </mesh>
  );
}

export function Pedestal() {
  return (
    <group>
      <mesh position={[0, PEDESTAL_H / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[PEDESTAL_R * 0.92, PEDESTAL_R * 1.05, PEDESTAL_H, 48]} />
        <meshStandardMaterial color="#8a93a3" metalness={0.55} roughness={0.28} />
      </mesh>
      <mesh position={[0, PEDESTAL_H + 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[PEDESTAL_R, 48]} />
        <meshStandardMaterial color="#c5ccd6" metalness={0.4} roughness={0.22} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <circleGeometry args={[3.2, 48]} />
        <meshStandardMaterial color="#121a28" roughness={0.9} metalness={0.05} />
      </mesh>
    </group>
  );
}
