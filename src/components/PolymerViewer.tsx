import { type PolymerDefinition } from "../model/polymers";
import { PolymerControls } from "./PolymerControls";
import { PolymerCanvas } from "./PolymerCanvas";
import type { FiberInputs } from "../types";

interface PolymerViewerProps {
  currentPolymer: PolymerDefinition;
  onSelectPolymer: (p: PolymerDefinition) => void;
  repeatCount: number;
  onRepeatCountChange: (count: number) => void;
  molecularWeight: number;
  onMolecularWeightChange: (mw: number) => void;
  inputs: FiberInputs;
  onInputsChange: (next: FiberInputs) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

export function PolymerViewer({
  currentPolymer,
  onSelectPolymer,
  repeatCount,
  onRepeatCountChange,
  molecularWeight,
  onMolecularWeightChange,
  inputs,
  onInputsChange,
  isFullscreen,
  onToggleFullscreen,
}: PolymerViewerProps) {
  return (
    <div
      className={`flex flex-col overflow-hidden bg-[#070b12] ${
        isFullscreen ? "fixed inset-0 z-50 h-screen w-screen" : "h-full w-full"
      }`}
    >
      {/* 상단 컨트롤 바: 고분자 반복단위 검색, n개수 및 Mw 조절 */}
      <PolymerControls
        currentPolymer={currentPolymer}
        onSelectPolymer={onSelectPolymer}
        repeatCount={repeatCount}
        onRepeatCountChange={onRepeatCountChange}
        molecularWeight={molecularWeight}
        onMolecularWeightChange={onMolecularWeightChange}
      />

      {/* 대형 3D 사슬 캔버스 (화면의 주역) */}
      <div className="relative flex-1 min-h-0">
        <PolymerCanvas
          polymer={currentPolymer}
          repeatCount={repeatCount}
          molecularWeight={molecularWeight}
          crystallinity={inputs.crystallinity}
          inputs={inputs}
          onInputsChange={onInputsChange}
          isFullscreen={isFullscreen}
          onToggleFullscreen={onToggleFullscreen}
          onSelectPolymer={onSelectPolymer}
        />
      </div>
    </div>
  );
}
