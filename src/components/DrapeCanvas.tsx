import { Canvas } from "@react-three/fiber";
import { ContactShadows, Environment, OrbitControls } from "@react-three/drei";
import type { CrossSectionShape, KesProperties } from "../types";
import { DrapeCloth, Pedestal } from "./DrapeScene";

export function DrapeCanvas({ kes, shape }: { kes: KesProperties; shape: CrossSectionShape }) {
  return (
    <div className="relative h-full min-h-[420px] overflow-hidden bg-[#101826]">
      <Canvas shadows camera={{ position: [2.45, 1.25, 2.35], fov: 40 }} dpr={[1, 2]}>
        <color attach="background" args={["#101826"]} />
        <hemisphereLight args={["#dbeafe", "#1e293b", 0.7]} />
        <directionalLight
          position={[3.2, 5.4, 2.4]}
          intensity={1.35}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <Pedestal />
        <DrapeCloth kes={kes} shape={shape} />
        <ContactShadows position={[0, 0, 0]} opacity={0.45} scale={8} blur={2.2} far={3} />
        <Environment preset="studio" />
        <OrbitControls enablePan={false} minDistance={1.6} maxDistance={5} maxPolarAngle={Math.PI / 2.05} />
      </Canvas>
      <div className="pointer-events-none absolute left-4 top-4 rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-xs text-slate-200 backdrop-blur">
        가상 드레이프 시험대 · 드래그로 회전
      </div>
    </div>
  );
}
