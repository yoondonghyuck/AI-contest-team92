import { useState, useEffect } from "react";
import { POLYMER_DATABASE, type PolymerDefinition } from "../model/polymers";
import { PolymerControls } from "./PolymerControls";
import { PolymerCanvas } from "./PolymerCanvas";
import type { FiberInputs } from "../types";
import {
  type PolymerBlendItem,
  type BlendDisplayMode,
  type CopolymerArchitecture,
  type DetailedCopolymerEvaluation,
  evaluateDetailedCopolymer,
  recalculateBlendItemsFromDPs,
} from "../model/polymerBlendService";
import type { ParsedCopolymerStructure } from "../model/chatMolecularParser";
import type { LiveApplyPayload } from "./LiveSyntheticRecommendPanel";

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
  onOpenDatasetExplorer?: () => void;
  onOpenLiveRecommendModal?: () => void;
  onApplyLiveRecommendation?: (payload: LiveApplyPayload) => void;
  onCopolymerEvaluationChange?: (evalResult: DetailedCopolymerEvaluation | null) => void;
  parsedCopolymer?: ParsedCopolymerStructure;
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
  onOpenDatasetExplorer,
  onOpenLiveRecommendModal,
  onApplyLiveRecommendation,
  onCopolymerEvaluationChange,
  parsedCopolymer,
}: PolymerViewerProps) {
  // 다중 고분자 혼합(Blend) 및 공중합체(Copolymer) 결합 상태
  const [blendItems, setBlendItems] = useState<PolymerBlendItem[]>([
    {
      id: "slot_0",
      polymer: currentPolymer,
      ratio: 100,
      yOffset: 0,
      tintColor: "#38bdf8",
    },
  ]);
  const [blendMode, setBlendMode] = useState<BlendDisplayMode>("parallel");
  const [copolymerArch, setCopolymerArch] = useState<CopolymerArchitecture>("block");

  // 채팅창 또는 검색창에서 파싱된 복합 공중합 구조(parsedCopolymer)가 전달되면 즉시 3D 공중합체 뷰로 강제 동기화
  useEffect(() => {
    if (!parsedCopolymer || parsedCopolymer.componentDetails.length < 2) return;

    const targetArch: CopolymerArchitecture =
      parsedCopolymer.structure_type === "graft"
        ? "graft"
        : parsedCopolymer.structure_type === "random" || parsedCopolymer.structure_type === "alternating"
        ? "random"
        : "block";

    const rawItems: PolymerBlendItem[] = parsedCopolymer.componentDetails.map((meta, idx) => {
      const found =
        POLYMER_DATABASE.find(
          (p) =>
            p.id.toLowerCase() === meta.shortName.toLowerCase() ||
            p.shortName.toLowerCase() === meta.shortName.toLowerCase() ||
            p.koreanName.includes(meta.koreanName)
        ) || POLYMER_DATABASE[idx % POLYMER_DATABASE.length];

      const defaultDp = meta.dp && meta.dp >= 10 ? meta.dp : idx >= 2 ? 40 : 60;
      const splitRatio = Math.round(100 / parsedCopolymer.componentDetails.length);
      return {
        id: `parsed_slot_${idx}_${meta.id}`,
        polymer: found,
        ratio:
          idx === parsedCopolymer.componentDetails.length - 1
            ? 100 - splitRatio * (parsedCopolymer.componentDetails.length - 1)
            : splitRatio,
        dp: defaultDp,
        blockMw: Math.round(defaultDp * found.monomerMW),
        yOffset: idx * 6.0,
        tintColor: meta.color,
      };
    });

    const recalc = recalculateBlendItemsFromDPs(rawItems, targetArch);
    setBlendItems(recalc.items);
    setBlendMode("copolymer");
    setCopolymerArch(targetArch);
    onRepeatCountChange(recalc.totalDp);
    onMolecularWeightChange(recalc.totalMw);
  }, [parsedCopolymer]);

  // 단일 고분자 변경 시 기본 슬롯 동기화 (블렌드 슬롯이 1개 이하일 때)
  useEffect(() => {
    setBlendItems((prev) => {
      if (prev.length <= 1) {
        return [
          {
            id: "slot_0",
            polymer: currentPolymer,
            ratio: 100,
            yOffset: 0,
            tintColor: "#38bdf8",
          },
        ];
      }
      return prev;
    });
  }, [currentPolymer]);

  // 공중합체 평가 결과 변경 시 부모 콜백 전달 (3성분 이상 다중 단량체 포함)
  useEffect(() => {
    if (blendItems.length >= 2 && onCopolymerEvaluationChange) {
      const result = evaluateDetailedCopolymer(
        blendItems[0].polymer,
        blendItems[1].polymer,
        copolymerArch,
        blendItems[0].ratio,
        blendItems
      );
      onCopolymerEvaluationChange(result);
    } else if (onCopolymerEvaluationChange) {
      onCopolymerEvaluationChange(null);
    }
  }, [blendItems, copolymerArch, onCopolymerEvaluationChange]);

  return (
    <div
      className={`flex flex-col overflow-hidden bg-[#070b12] ${
        isFullscreen ? "fixed inset-0 z-50 h-screen w-screen" : "h-full w-full"
      }`}
    >
      {/* 상단 컨트롤 바: 디바운스 검색(Autocomplete), 다중 고분자 혼합/공중합체 구조(Random/Block/Graft), n/Mw 컨트롤러 */}
      <PolymerControls
        currentPolymer={currentPolymer}
        onSelectPolymer={onSelectPolymer}
        repeatCount={repeatCount}
        onRepeatCountChange={onRepeatCountChange}
        molecularWeight={molecularWeight}
        onMolecularWeightChange={onMolecularWeightChange}
        onOpenDatasetExplorer={onOpenDatasetExplorer}
        onOpenLiveRecommendModal={onOpenLiveRecommendModal}
        onApplyLiveRecommendation={onApplyLiveRecommendation}
        blendItems={blendItems}
        onBlendItemsChange={setBlendItems}
        blendMode={blendMode}
        onBlendModeChange={setBlendMode}
        copolymerArch={copolymerArch}
        onCopolymerArchChange={setCopolymerArch}
      />

      {/* 대형 3D 사슬 캔버스 (단일 사슬 뷰, 다중 고분자 동시 비교 뷰, Random/Block/Graft 3D 사슬) */}
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
          blendItems={blendItems}
          blendMode={blendMode}
          copolymerArch={copolymerArch}
        />
      </div>
    </div>
  );
}
