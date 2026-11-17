import { useState, useMemo, useRef, useEffect } from "react";
import {
  Search,
  Hash,
  FlaskConical,
  Plus,
  Minus,
  Dna,
  Database,
  X,
  ExternalLink,
  Sparkles,
  Layers,
  Flame,
  GitMerge,
  Split,
} from "lucide-react";
import {
  POLYMER_DATABASE,
  type PolymerDefinition,
} from "../model/polymers";
import {
  searchPolymers,
  convertRealRecordToPolymerDefinition,
  type RealPolymerRecord,
} from "../model/polymerDatasetService";
import {
  type PolymerBlendItem,
  type BlendDisplayMode,
  type CopolymerArchitecture,
  type RatioUnitMode,
  evaluateDetailedCopolymer,
  createSynthesizedCopolymer,
  convertMolToWt,
  recalculateBlendItemsFromDPs,
} from "../model/polymerBlendService";
import {
  interceptPolymerStructureFormula,
  buildCopolymer3DFromParsedStructure,
  type ParsedCopolymerStructure,
} from "../model/chatMolecularParser";
import { saveCurrentWorkingSketch } from "../model/sketchStorage";
import {
  useLiveSyntheticPool,
  filterLiveSyntheticPolymers,
  convertLiveRecordToAppModel,
  formatLiveRecordKoreanName,
  type LiveSyntheticPolymerRecord,
} from "../model/liveSyntheticPoolService";
import type { LiveApplyPayload } from "./LiveSyntheticRecommendPanel";

interface PolymerControlsProps {
  currentPolymer: PolymerDefinition;
  onSelectPolymer: (polymer: PolymerDefinition) => void;
  repeatCount: number;
  onRepeatCountChange: (count: number) => void;
  molecularWeight: number;
  onMolecularWeightChange: (mw: number) => void;
  onOpenDatasetExplorer?: () => void;
  onOpenLiveRecommendModal?: () => void;
  onApplyLiveRecommendation?: (payload: LiveApplyPayload) => void;
  blendItems?: PolymerBlendItem[];
  onBlendItemsChange?: (items: PolymerBlendItem[]) => void;
  blendMode?: BlendDisplayMode;
  onBlendModeChange?: (mode: BlendDisplayMode) => void;
  copolymerArch?: CopolymerArchitecture;
  onCopolymerArchChange?: (arch: CopolymerArchitecture) => void;
}

// 빠른 선택을 위한 인기 추천 키워드
const POPULAR_KEYWORDS = [
  { label: "폴리스티렌-graft-폴리프로필렌", hint: "Graft 공중합체" },
  { label: "PS-b-PP-g-PE", hint: "블록-가지형 공중합체" },
  { label: "PS", hint: "폴리스티렌" },
  { label: "PP", hint: "폴리프로필렌" },
  { label: "PE", hint: "폴리에틸렌" },
  { label: "Nylon 66", hint: "나일론 66" },
  { label: "PET", hint: "폴리에스테르" },
];

export function PolymerControls({
  currentPolymer,
  onSelectPolymer,
  repeatCount,
  onRepeatCountChange,
  molecularWeight,
  onMolecularWeightChange,
  onOpenDatasetExplorer,
  onOpenLiveRecommendModal,
  onApplyLiveRecommendation,
  blendItems = [],
  onBlendItemsChange,
  blendMode = "parallel",
  onBlendModeChange,
  copolymerArch = "block",
  onCopolymerArchChange,
}: PolymerControlsProps) {
  const { records: livePoolRecords } = useLiveSyntheticPool({
    pollIntervalMs: 2000,
    initialAutoRefresh: true,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [ratioUnit, setRatioUnit] = useState<RatioUnitMode>("wt");
  const [systemParseToast, setSystemParseToast] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // [자연어/구조식 파싱 인터셉터]: 검색창에 "폴리스티렌-graft-폴리프로필렌", "PS-b-PP-g-PE" 입력 시 즉시 감지
  const interceptedCopolymer = useMemo<ParsedCopolymerStructure | null>(() => {
    if (!searchQuery.trim()) return null;
    return interceptPolymerStructureFormula(searchQuery.trim());
  }, [searchQuery]);

  const handleApplyInterceptedCopolymer = (parsed: ParsedCopolymerStructure) => {
    if (!onBlendItemsChange || parsed.componentDetails.length < 2) return;

    const targetArch: CopolymerArchitecture =
      parsed.structure_type === "graft"
        ? "graft"
        : parsed.structure_type === "random" || parsed.structure_type === "alternating"
        ? "random"
        : "block";

    const rawItems: PolymerBlendItem[] = parsed.componentDetails.map((meta, idx) => {
      const found =
        POLYMER_DATABASE.find(
          (p) =>
            p.id.toLowerCase() === meta.shortName.toLowerCase() ||
            p.shortName.toLowerCase() === meta.shortName.toLowerCase() ||
            p.koreanName.includes(meta.koreanName)
        ) || POLYMER_DATABASE[idx % POLYMER_DATABASE.length];

      const defaultDp = idx >= 2 ? 40 : 60;
      const splitRatio = Math.round(100 / parsed.componentDetails.length);
      return {
        id: `parsed_slot_${idx}_${meta.id}`,
        polymer: found,
        ratio:
          idx === parsed.componentDetails.length - 1
            ? 100 - splitRatio * (parsed.componentDetails.length - 1)
            : splitRatio,
        dp: defaultDp,
        blockMw: Math.round(defaultDp * found.monomerMW),
        slotRole: idx >= 2 ? "graft" : targetArch === "graft" && idx === 1 ? "graft" : "block",
        yOffset: idx * 6.0,
        tintColor: meta.color,
      };
    });

    const recalc = recalculateBlendItemsFromDPs(rawItems, targetArch);
    const resolvedItems = recalc.items;

    onBlendItemsChange(resolvedItems);
    if (onBlendModeChange) onBlendModeChange("copolymer");
    if (onCopolymerArchChange) onCopolymerArchChange(targetArch);

    const synthesized = createSynthesizedCopolymer(
      resolvedItems[0].polymer,
      resolvedItems[1].polymer,
      targetArch,
      resolvedItems[0].ratio
    );
    const built2d = buildCopolymer3DFromParsedStructure(parsed);
    saveCurrentWorkingSketch(built2d.atoms, built2d.bonds);
    onSelectPolymer(synthesized);
    onRepeatCountChange(recalc.totalDp);
    onMolecularWeightChange(recalc.totalMw);

    setSystemParseToast(parsed.systemMessage);
    setTimeout(() => setSystemParseToast(null), 5000);

    setSearchQuery("");
    setIsDropdownOpen(false);
    setFocusedIndex(-1);
  };

  // ─────────────────────────────────────────────────────────────
  // 1. 초고속 디바운스 (120ms): 대용량 데이터셋(3,284건) 검색 시 멈춤 제로
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 120);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 외부 클릭 시 자동완성 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
        setFocusedIndex(-1);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ─────────────────────────────────────────────────────────────
  // 2. 디바운스된 쿼리로 표준 DB 및 3,284건 오픈 데이터셋 초고속 매칭
  // ─────────────────────────────────────────────────────────────
  const matchedStandardPolymers = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) {
      return POLYMER_DATABASE.slice(0, 6);
    }
    return POLYMER_DATABASE.filter((p) => {
      const matchShort = p.shortName.toLowerCase().includes(q);
      const matchKr = p.koreanName.toLowerCase().includes(q);
      const matchCat = p.category.toLowerCase().includes(q);
      const matchIupac = p.iupacName ? p.iupacName.toLowerCase().includes(q) : false;
      const matchRaw = p.rawName ? p.rawName.toLowerCase().includes(q) : false;
      return matchShort || matchKr || matchCat || matchIupac || matchRaw;
    }).slice(0, 6);
  }, [debouncedQuery]);

  const matchedOpenDataset = useMemo((): RealPolymerRecord[] => {
    const q = debouncedQuery.trim();
    if (!q) return [];
    return searchPolymers({ query: q, limit: 6 }).results;
  }, [debouncedQuery]);

  const matchedLiveSynthetic = useMemo((): LiveSyntheticPolymerRecord[] => {
    const q = debouncedQuery.trim();
    if (!q) {
      return livePoolRecords.slice(0, 3);
    }
    return filterLiveSyntheticPolymers(livePoolRecords, { query: q, limit: 5 }).results;
  }, [debouncedQuery, livePoolRecords]);

  const handleSelectLiveRecord = (rec: LiveSyntheticPolymerRecord) => {
    const converted = convertLiveRecordToAppModel(rec);
    saveCurrentWorkingSketch(converted.atoms, converted.bonds);
    if (onApplyLiveRecommendation) {
      onApplyLiveRecommendation({ record: rec, ...converted });
    } else {
      onSelectPolymer(converted.polymer);
      onRepeatCountChange(converted.recommendedInputs.repeatCount);
      onMolecularWeightChange(converted.recommendedInputs.molecularWeight);
    }
    setSystemParseToast(converted.parsedCopolymer.systemMessage);
    setTimeout(() => setSystemParseToast(null), 5000);
    setSearchQuery("");
    setIsDropdownOpen(false);
    setFocusedIndex(-1);
  };

  const totalItemsCount = matchedStandardPolymers.length + matchedOpenDataset.length;

  // 단독 로드 핸들러
  const handleSelectStandard = (p: PolymerDefinition) => {
    onSelectPolymer(p);
    onRepeatCountChange(1);
    onMolecularWeightChange(p.monomerMW);
    if (onBlendItemsChange) {
      onBlendItemsChange([
        { id: `slot_0`, polymer: p, ratio: 100, yOffset: 0, tintColor: "#38bdf8" },
      ]);
    }
    setSearchQuery("");
    setIsDropdownOpen(false);
    setFocusedIndex(-1);
  };

  const handleSelectOpenRecord = (record: RealPolymerRecord) => {
    const def = convertRealRecordToPolymerDefinition(record);
    onSelectPolymer(def);
    onRepeatCountChange(1);
    onMolecularWeightChange(def.monomerMW);
    if (onBlendItemsChange) {
      onBlendItemsChange([
        { id: `slot_0`, polymer: def, ratio: 100, yOffset: 0, tintColor: "#38bdf8" },
      ]);
    }
    setSearchQuery("");
    setIsDropdownOpen(false);
    setFocusedIndex(-1);
  };

  // ─────────────────────────────────────────────────────────────
  // 3. 다중 고분자 혼합 슬롯 추가 (예: PS와 PP, PE 3성분 이상 조합)
  // ─────────────────────────────────────────────────────────────
  const handleAddToBlend = (polymerToAdd: PolymerDefinition) => {
    if (!onBlendItemsChange) return;

    const currentList = blendItems.length > 0 ? blendItems : [
      {
        id: "slot_0",
        polymer: currentPolymer,
        ratio: 100,
        dp: Math.max(50, repeatCount),
        blockMw: Math.round(Math.max(50, repeatCount) * currentPolymer.monomerMW),
        yOffset: 0,
        tintColor: "#38bdf8",
      },
    ];

    // 이미 등록되어 있는지 확인
    const exists = currentList.some((item) => item.polymer.id === polymerToAdd.id);
    if (exists) {
      setIsDropdownOpen(false);
      return;
    }

    const colors = ["#38bdf8", "#f59e0b", "#10b981", "#a855f7"];
    const rawUpdated: PolymerBlendItem[] = [
      ...currentList.map((item, idx) => ({
        ...item,
        dp: item.dp ?? 60,
        tintColor: colors[idx % colors.length],
        yOffset: idx * 6.0,
      })),
      {
        id: `slot_${Date.now()}`,
        polymer: polymerToAdd,
        ratio: 33,
        dp: currentList.length >= 2 ? 45 : 60,
        blockMw: Math.round((currentList.length >= 2 ? 45 : 60) * polymerToAdd.monomerMW),
        tintColor: colors[currentList.length % colors.length],
        yOffset: currentList.length * 6.0,
      },
    ];

    const recalc = recalculateBlendItemsFromDPs(rawUpdated, copolymerArch);
    onBlendItemsChange(recalc.items);
    onRepeatCountChange(recalc.totalDp);
    onMolecularWeightChange(recalc.totalMw);
    setSearchQuery("");
    setIsDropdownOpen(false);
  };

  // 혼합 슬롯에서 항목 제거
  const handleRemoveBlendItem = (idToRemove: string) => {
    if (!onBlendItemsChange) return;
    const filtered = blendItems.filter((it) => it.id !== idToRemove);
    if (filtered.length <= 1) {
      // 1개만 남으면 단일 모드로 복귀
      if (filtered[0]) {
        onSelectPolymer(filtered[0].polymer);
      }
      onBlendItemsChange(filtered.length === 1 ? [{ ...filtered[0], ratio: 100, yOffset: 0 }] : []);
      if (onBlendModeChange) onBlendModeChange("parallel");
      return;
    }

    const recalc = recalculateBlendItemsFromDPs(filtered, copolymerArch);
    onBlendItemsChange(recalc.items);
    onRepeatCountChange(recalc.totalDp);
    onMolecularWeightChange(recalc.totalMw);
  };

  // 2개 이상(3개 이상 다중 단량체 포함)일 때 실시간 심층 공중합/상분리 분석 결과
  const detailedCopolymerEval = useMemo(() => {
    if (blendItems.length < 2) return null;
    return evaluateDetailedCopolymer(
      blendItems[0].polymer,
      blendItems[1].polymer,
      copolymerArch,
      blendItems[0].ratio,
      blendItems
    );
  }, [blendItems, copolymerArch]);

  // 개별 블록/가지의 단량체 개수(DP) 변경 핸들러 (3성분 이상 독립 제어 완벽 지원)
  const handleItemDpChange = (itemIndex: number, newDp: number) => {
    if (!onBlendItemsChange || blendItems.length < 2) return;
    const clampedDp = Math.max(5, Math.min(2000, Math.round(newDp)));
    const nextRaw = blendItems.map((it, idx) =>
      idx === itemIndex
        ? {
            ...it,
            dp: clampedDp,
            blockMw: Math.round(clampedDp * it.polymer.monomerMW),
          }
        : {
            ...it,
            dp: it.dp ?? Math.max(15, Math.round(it.ratio * 1.2)),
          }
    );
    const recalc = recalculateBlendItemsFromDPs(nextRaw, copolymerArch);
    onBlendItemsChange(recalc.items);
    onRepeatCountChange(recalc.totalDp);
    onMolecularWeightChange(recalc.totalMw);

    if (blendMode === "copolymer") {
      const synthesized = createSynthesizedCopolymer(
        recalc.items[0].polymer,
        recalc.items[1].polymer,
        copolymerArch,
        recalc.items[0].ratio
      );
      onSelectPolymer(synthesized);
    }
  };

  // 개별 블록/가지의 분자량(Mn, g/mol) 직접 변경 핸들러
  const handleItemMwChange = (itemIndex: number, newMw: number) => {
    if (!onBlendItemsChange || !blendItems[itemIndex]) return;
    const monomerMw = Math.max(10, blendItems[itemIndex].polymer.monomerMW);
    const derivedDp = Math.max(5, Math.round(newMw / monomerMw));
    handleItemDpChange(itemIndex, derivedDp);
  };

  // 공중합 구조 (Random, Block, Graft) 선택
  const handleSelectArchitecture = (arch: CopolymerArchitecture) => {
    if (onCopolymerArchChange) onCopolymerArchChange(arch);
    if (blendItems.length >= 2) {
      const recalc = recalculateBlendItemsFromDPs(blendItems, arch);
      if (onBlendItemsChange) onBlendItemsChange(recalc.items);
      const synthesized = createSynthesizedCopolymer(
        recalc.items[0].polymer,
        recalc.items[1].polymer,
        arch,
        recalc.items[0].ratio
      );
      if (blendMode === "copolymer") {
        onSelectPolymer(synthesized);
      }
    }
  };

  // 혼합 비율 조정 (슬라이더 입력값: wt% 또는 mol%)
  const handleRatioSliderChange = (valA: number) => {
    if (!onBlendItemsChange || blendItems.length < 2) return;

    let targetWtA = valA;
    if (ratioUnit === "mol") {
      targetWtA = convertMolToWt(blendItems[0].polymer, blendItems[1].polymer, valA);
    }

    const clampedWtA = Math.max(5, Math.min(95, Math.round(targetWtA)));
    const totalCurrentDp = blendItems.reduce((acc, it) => acc + (it.dp ?? 60), 0);
    const dpA = Math.max(5, Math.round(totalCurrentDp * (clampedWtA / 100)));
    const dpB = Math.max(5, totalCurrentDp - dpA);

    const nextRaw: PolymerBlendItem[] = blendItems.map((it, idx) => {
      if (idx === 0) return { ...it, dp: dpA, ratio: clampedWtA };
      if (idx === 1) return { ...it, dp: dpB, ratio: 100 - clampedWtA };
      return it;
    });
    const recalc = recalculateBlendItemsFromDPs(nextRaw, copolymerArch);
    onBlendItemsChange(recalc.items);
    onRepeatCountChange(recalc.totalDp);
    onMolecularWeightChange(recalc.totalMw);

    // 공중합체 모드인 경우 실시간 3D 합성 분자 갱신
    if (blendMode === "copolymer") {
      const synthesized = createSynthesizedCopolymer(
        recalc.items[0].polymer,
        recalc.items[1].polymer,
        copolymerArch,
        recalc.items[0].ratio
      );
      onSelectPolymer(synthesized);
    }
  };

  // 공중합체 결합 뷰 토글 (나란히 동시 비교 vs 공중합체 결합)
  const handleToggleCopolymerMode = (mode: BlendDisplayMode) => {
    if (onBlendModeChange) onBlendModeChange(mode);
    if (mode === "copolymer" && blendItems.length >= 2) {
      const synthesized = createSynthesizedCopolymer(
        blendItems[0].polymer,
        blendItems[1].polymer,
        copolymerArch,
        blendItems[0].ratio
      );
      onSelectPolymer(synthesized);
    } else if (mode === "parallel" && blendItems.length >= 1) {
      onSelectPolymer(blendItems[0].polymer);
    }
  };

  // 키보드 방향키 및 엔터 지원
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isDropdownOpen && (e.key === "ArrowDown" || e.key === "Enter")) {
      setIsDropdownOpen(true);
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((prev) => (prev + 1 < totalItemsCount ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((prev) => (prev > 0 ? prev - 1 : totalItemsCount - 1));
    } else if (e.key === "Enter" && interceptedCopolymer) {
      e.preventDefault();
      handleApplyInterceptedCopolymer(interceptedCopolymer);
    } else if (e.key === "Enter" && focusedIndex >= 0) {
      e.preventDefault();
      if (focusedIndex < matchedStandardPolymers.length) {
        handleSelectStandard(matchedStandardPolymers[focusedIndex]);
      } else {
        const openIdx = focusedIndex - matchedStandardPolymers.length;
        if (matchedOpenDataset[openIdx]) {
          handleSelectOpenRecord(matchedOpenDataset[openIdx]);
        }
      }
    } else if (e.key === "Escape") {
      setIsDropdownOpen(false);
      setFocusedIndex(-1);
    }
  };

  // 분자량 변경 시 중합도 동기화
  const handleMwChange = (newMw: number) => {
    const clampedMw = Math.max(100, Math.min(2000000, newMw));
    onMolecularWeightChange(clampedMw);
    onRepeatCountChange(Math.max(1, Math.round(clampedMw / currentPolymer.monomerMW)));
  };

  // 중합도(반복단위수 n) 변경 시 분자량 동기화
  const handleRepeatChange = (newCount: number) => {
    const clampedCount = Math.max(1, Math.min(100000, newCount));
    onRepeatCountChange(clampedCount);
    onMolecularWeightChange(Math.round(clampedCount * currentPolymer.monomerMW * 10) / 10);
  };

  const isBuiltIn = POLYMER_DATABASE.some((p) => p.id === currentPolymer.id);
  const isBlendActive = blendItems.length >= 2;

  return (
    <div className="relative z-30 border-b border-white/10 bg-slate-900/90 px-3 py-2 backdrop-blur-md">
      {/* ─────────────────────────────────────────────────────────────
          1. 메인 검색 & 단일 바 레이아웃 (Search-First Minimal Header)
          ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* 좌측: 정밀 검색 & 실시간 자동완성(Autocomplete) 컴포넌트 */}
        <div ref={containerRef} className="relative flex-1 min-w-[320px] max-w-[540px]">
          <div className="relative flex items-center">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sky-400" size={15} />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onFocus={() => setIsDropdownOpen(true)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsDropdownOpen(true);
                setFocusedIndex(-1);
              }}
              onKeyDown={handleKeyDown}
              placeholder="고분자 검색 (예: PS, PP, 폴리스티렌, 나일론, 블록, PET...)"
              className="w-full rounded-xl border border-sky-500/30 bg-black/60 py-1.5 pl-9 pr-24 text-xs text-white placeholder-slate-400 shadow-inner focus:border-sky-400 focus:bg-black/80 focus:outline-none focus:ring-1 focus:ring-sky-400/50 transition-all"
            />
            {/* 우측 클리어 버튼 및 데이터셋 바로가기 */}
            <div className="absolute right-1.5 flex items-center gap-1">
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    inputRef.current?.focus();
                  }}
                  className="rounded p-1 text-slate-400 hover:text-white hover:bg-white/10 transition"
                  title="검색어 지우기"
                >
                  <X size={13} />
                </button>
              )}
              {onOpenLiveRecommendModal && (
                <button
                  type="button"
                  onClick={onOpenLiveRecommendModal}
                  className="flex items-center gap-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/40 px-2 py-0.5 text-[10px] font-bold text-amber-300 transition cursor-pointer"
                  title="실시간 AI S급 신소재 R&D 추천 리스트 (5,000건 슬라이딩 윈도우) 열기"
                >
                  <Sparkles size={11} className="text-amber-400" />
                  <span className="hidden sm:inline">S급 추천(5k)</span>
                </button>
              )}
              {onOpenDatasetExplorer && (
                <button
                  type="button"
                  onClick={onOpenDatasetExplorer}
                  className="flex items-center gap-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/30 px-2 py-0.5 text-[10px] font-semibold text-sky-300 transition"
                  title="3,284건 공인 오픈 데이터셋 탐색기 열기"
                >
                  <Database size={11} className="text-sky-400" />
                  <span className="hidden sm:inline">3.2k DB</span>
                </button>
              )}
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────────
              자동완성(Autocomplete) 팝오버 드롭다운 (단독 로드 / 혼합 추가 지원)
              ───────────────────────────────────────────────────────────── */}
          {isDropdownOpen && (
            <div className="absolute left-0 top-full mt-1.5 w-full rounded-2xl border border-sky-500/40 bg-slate-950/95 p-2 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 z-50 max-h-[460px] overflow-y-auto">
              {/* [0. 복합 공중합 구조식 인터셉터 즉시 실행 배너] */}
              {interceptedCopolymer && (
                <div className="mb-2 rounded-xl border border-purple-400/50 bg-gradient-to-r from-purple-950/80 via-indigo-950/80 to-slate-950 p-2.5 shadow-lg">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-purple-200">
                        <Sparkles size={13} className="text-amber-400 animate-pulse shrink-0" />
                        <span>
                          ✨ [시스템] {interceptedCopolymer.componentDetails.map((m) => m.koreanName).join(" + ")}{" "}
                          ({interceptedCopolymer.architecture}) 구조식 감지!
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-300 mt-0.5 font-mono">
                        JSON: {`{"structure_type":"${interceptedCopolymer.structure_type}","components":${JSON.stringify(interceptedCopolymer.components)},"architecture":"${interceptedCopolymer.architecture}"}`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleApplyInterceptedCopolymer(interceptedCopolymer)}
                      className="shrink-0 rounded-xl bg-gradient-to-r from-purple-500 to-sky-500 hover:from-purple-400 hover:to-sky-400 px-3 py-1.5 text-xs font-bold text-white shadow-md cursor-pointer transition"
                    >
                      즉시 3D 렌더링 (Enter)
                    </button>
                  </div>
                </div>
              )}

              {/* 검색어 없을 때: 인기/추천 퀵 태그 */}
              {!searchQuery.trim() && (
                <div className="mb-2 border-b border-white/10 pb-2 px-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
                    <span className="flex items-center gap-1 font-semibold text-sky-300">
                      <Sparkles size={11} className="text-amber-400" />
                      자주 찾는 고분자 키워드
                    </span>
                    <span className="text-[10px] text-slate-500">클릭 시 자동 검색</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {POPULAR_KEYWORDS.map((k) => (
                      <button
                        key={k.label}
                        type="button"
                        onClick={() => {
                          setSearchQuery(k.label);
                          inputRef.current?.focus();
                        }}
                        className="rounded-lg border border-white/10 bg-slate-900/80 hover:bg-sky-500/20 hover:border-sky-400/50 px-2 py-0.5 text-[11px] text-slate-300 hover:text-sky-200 transition"
                      >
                        <span className="font-semibold">{k.label}</span>
                        <span className="ml-1 text-[10px] text-slate-500">({k.hint})</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 1. 표준 고분자 모델 매칭 결과 */}
              {matchedStandardPolymers.length > 0 && (
                <div className="mb-2">
                  <div className="px-2 py-1 text-[10px] font-bold text-sky-400 flex items-center justify-between uppercase tracking-wider">
                    <span className="flex items-center gap-1">
                      <Dna size={12} />
                      표준 3D 모델 ({matchedStandardPolymers.length}건)
                    </span>
                    <span className="text-slate-500 font-normal">정밀 단위포 궤도</span>
                  </div>
                  <div className="space-y-1">
                    {matchedStandardPolymers.map((p, idx) => {
                      const isFocused = focusedIndex === idx;
                      const isCurrent = p.id === currentPolymer.id;
                      return (
                        <div
                          key={p.id}
                          className={`flex items-center justify-between rounded-xl p-2 transition ${
                            isFocused
                              ? "bg-sky-500/25 border border-sky-400/50 text-white"
                              : isCurrent
                              ? "bg-sky-950/60 border border-sky-500/30 text-sky-100"
                              : "hover:bg-white/5 border border-transparent text-slate-300"
                          }`}
                        >
                          <div
                            onClick={() => handleSelectStandard(p)}
                            className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer"
                          >
                            <span className="font-bold text-sky-300 font-mono text-xs w-16 truncate">
                              {p.shortName}
                            </span>
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-slate-100 truncate">
                                {p.koreanName}
                              </p>
                              <p className="text-[10px] text-slate-400 truncate">
                                {p.category.split(" ")[0]} · Tg {p.tg}℃ | {p.density}g/cm³
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 ml-2">
                            <button
                              type="button"
                              onClick={() => handleAddToBlend(p)}
                              className="rounded-lg bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/40 px-2 py-1 text-[10px] font-bold text-amber-200 transition"
                              title="이 고분자를 3D 화면에 혼합/조합 추가"
                            >
                              + 혼합 추가
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSelectStandard(p)}
                              className="rounded-lg bg-sky-500/20 hover:bg-sky-500/35 border border-sky-400/40 px-2 py-1 text-[10px] font-bold text-sky-200 transition"
                            >
                              단독 로드
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 2. 대규모 오픈 데이터셋(3,284건) 매칭 결과 */}
              {matchedOpenDataset.length > 0 && (
                <div className="mb-1 border-t border-white/10 pt-2">
                  <div className="px-2 py-1 text-[10px] font-bold text-purple-400 flex items-center justify-between uppercase tracking-wider">
                    <span className="flex items-center gap-1">
                      <Database size={12} />
                      공인 오픈 데이터셋 매칭 ({matchedOpenDataset.length}건)
                    </span>
                    <span className="text-slate-500 font-normal">PI1M / PolymerGenome</span>
                  </div>
                  <div className="space-y-1">
                    {matchedOpenDataset.map((record, i) => {
                      const overallIdx = matchedStandardPolymers.length + i;
                      const isFocused = focusedIndex === overallIdx;
                      return (
                        <div
                          key={record.id}
                          className={`flex items-center justify-between rounded-xl p-2 transition ${
                            isFocused
                              ? "bg-purple-500/25 border border-purple-400/50 text-white"
                              : "hover:bg-white/5 border border-transparent text-slate-300"
                          }`}
                        >
                          <div
                            onClick={() => handleSelectOpenRecord(record)}
                            className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer"
                          >
                            <span className="rounded bg-purple-500/20 border border-purple-400/30 px-1.5 py-0.2 text-[9px] font-mono text-purple-300 shrink-0">
                              {record.source}
                            </span>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-slate-100 truncate">
                                {record.name}
                              </p>
                              <p className="text-[10px] text-slate-400 font-mono truncate">
                                Tg {record.tg}℃ | {record.density.toFixed(2)}g/cm³ · {record.smiles}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 ml-2">
                            <button
                              type="button"
                              onClick={() => {
                                const def = convertRealRecordToPolymerDefinition(record);
                                handleAddToBlend(def);
                              }}
                              className="rounded-lg bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/40 px-2 py-1 text-[10px] font-bold text-amber-200 transition"
                              title="오픈 데이터셋 고분자를 3D 화면에 혼합/조합 추가"
                            >
                              + 혼합 추가
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSelectOpenRecord(record)}
                              className="rounded-lg bg-purple-500/20 hover:bg-purple-500/35 border border-purple-400/40 px-2 py-1 text-[10px] font-bold text-purple-200 transition"
                            >
                              단독 로드
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 2-B. 실시간 AI S급 신소재 추천 풀 (live_synthetic_pool.json) 매칭 결과 */}
              {matchedLiveSynthetic.length > 0 && (
                <div className="mb-1 border-t border-white/10 pt-2">
                  <div className="px-2 py-1 text-[10px] font-bold text-amber-400 flex items-center justify-between uppercase tracking-wider">
                    <span className="flex items-center gap-1">
                      <Sparkles size={12} />
                      실시간 AI S급 신소재 추천 ({matchedLiveSynthetic.length}건)
                    </span>
                    <span className="text-emerald-400 font-mono font-normal">
                      LIVE 5,000 슬라이딩 윈도우
                    </span>
                  </div>
                  <div className="space-y-1">
                    {matchedLiveSynthetic.map((rec) => {
                      const kor = formatLiveRecordKoreanName(rec);
                      return (
                        <div
                          key={rec.id}
                          onClick={() => handleSelectLiveRecord(rec)}
                          className="flex items-center justify-between rounded-xl p-2 hover:bg-amber-500/15 border border-transparent hover:border-amber-400/40 text-slate-300 transition cursor-pointer"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="rounded bg-amber-500/20 border border-amber-400/40 px-1.5 py-0.5 text-[9px] font-mono font-bold text-amber-300 shrink-0">
                              {rec.quality_grade} ({rec.innovation_score}점)
                            </span>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white truncate">
                                {rec.short_code}{" "}
                                <span className="text-[11px] font-normal text-amber-200">
                                  ({kor})
                                </span>
                              </p>
                              <p className="text-[10px] text-slate-400 font-mono truncate">
                                DP={rec.dp_n} · Mn={Math.round(rec.Mn).toLocaleString()} · Tg={rec.Tg}℃ · χN={rec.chi_N} ({rec.phase_separation_morphology})
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectLiveRecord(rec);
                            }}
                            className="shrink-0 ml-2 rounded-lg bg-amber-400 hover:bg-amber-300 px-2.5 py-1 text-[10px] font-extrabold text-slate-950 transition"
                          >
                            3D 즉시 적용
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 검색 결과가 없을 때 */}
              {debouncedQuery.trim() &&
                matchedStandardPolymers.length === 0 &&
                matchedOpenDataset.length === 0 &&
                matchedLiveSynthetic.length === 0 && (
                <div className="py-6 text-center text-xs text-slate-400">
                  <p className="font-semibold text-slate-300">'{debouncedQuery}'에 대한 고분자를 찾을 수 없습니다.</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    약어(PS, PP, PE, PET) 또는 오픈 데이터셋 탐색기에서 3,284건을 검색해 보세요.
                  </p>
                </div>
              )}

              {/* 하단 퀵 모달 열기 링크 */}
              {onOpenLiveRecommendModal && (
                <div className="border-t border-white/10 mt-2 pt-2 px-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsDropdownOpen(false);
                      onOpenLiveRecommendModal();
                    }}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500/25 via-rose-500/20 to-purple-500/25 hover:from-amber-500/40 hover:to-purple-500/40 border border-amber-400/40 py-1.5 text-xs font-extrabold text-amber-200 transition cursor-pointer"
                  >
                    <Sparkles size={13} className="text-amber-400" />
                    <span>실시간 AI S급 신소재 R&D 추천 풀 (5,000건 슬라이딩 윈도우) 전체 열기</span>
                    <ExternalLink size={12} className="text-amber-300 ml-1" />
                  </button>
                </div>
              )}
              {onOpenDatasetExplorer && (
                <div className="border-t border-white/10 mt-2 pt-2 px-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsDropdownOpen(false);
                      onOpenDatasetExplorer();
                    }}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-500/20 to-purple-500/20 hover:from-sky-500/30 hover:to-purple-500/30 border border-sky-400/30 py-1.5 text-xs font-bold text-sky-200 transition"
                  >
                    <Database size={13} className="text-sky-400" />
                    <span>대규모 고분자 오픈 데이터셋 (3,284건) 전체 탐색기 열기</span>
                    <ExternalLink size={12} className="text-slate-400 ml-1" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 중앙: 현재 선택된 고분자 핵심 정보 인디케이터 */}
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3 py-1 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-sky-500/20 text-sky-400">
              <Dna size={12} />
            </span>
            <span className="font-bold text-white font-mono">{currentPolymer.shortName}</span>
            <span className="text-[11px] text-slate-300">({currentPolymer.koreanName.split(" ")[0]})</span>
          </div>

          <div className="hidden lg:flex items-center gap-2 border-l border-white/10 pl-2 text-[10px] text-slate-400 font-mono">
            <span className="rounded bg-sky-500/10 px-1 text-sky-300 border border-sky-500/20">
              {isBuiltIn ? "표준 3D" : "오픈 DB"}
            </span>
            <span>Tg: <strong className="text-amber-300">{currentPolymer.tg}℃</strong></span>
            <span>밀도: <strong className="text-emerald-300">{currentPolymer.density}</strong></span>
          </div>
        </div>

        {/* 우측: 반복단위(n) & 분자량(Mw) 조절 바 */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 p-1">
            {/* 반복수 n */}
            <div className="flex items-center gap-1.5 px-2">
              <Hash size={13} className="text-sky-400" />
              <span className="text-xs text-slate-300 font-medium">n:</span>
              <input
                type="number"
                min={1}
                max={50000}
                value={repeatCount}
                onChange={(e) => handleRepeatChange(Number(e.target.value))}
                className="w-14 rounded border border-white/15 bg-slate-900 px-1 py-0.5 text-center font-mono text-xs font-bold text-sky-300 focus:border-sky-400 focus:outline-none"
              />
            </div>

            <div className="h-4 w-[1px] bg-white/15" />

            {/* 분자량 Mw */}
            <div className="flex items-center gap-1.5 px-2">
              <FlaskConical size={13} className="text-emerald-400" />
              <span className="text-xs text-slate-300 font-medium">Mw:</span>
              <input
                type="number"
                step={100}
                min={10}
                max={1500000}
                value={Math.round(molecularWeight)}
                onChange={(e) => handleMwChange(Number(e.target.value))}
                className="w-20 rounded border border-white/15 bg-slate-900 px-1 py-0.5 text-center font-mono text-xs font-bold text-emerald-300 focus:border-emerald-400 focus:outline-none"
              />
              <span className="text-[10px] text-slate-400">g/mol</span>
            </div>

            <div className="h-4 w-[1px] bg-white/15" />

            {/* 증감 버튼 */}
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => handleRepeatChange(Math.max(1, repeatCount - 1))}
                disabled={repeatCount <= 1}
                className="flex h-6 w-6 items-center justify-center rounded bg-slate-800 text-slate-300 transition hover:bg-slate-700 disabled:opacity-40"
                title="1단위 감소"
              >
                <Minus size={11} />
              </button>
              <button
                type="button"
                onClick={() => handleRepeatChange(repeatCount + 1)}
                className="flex h-6 w-6 items-center justify-center rounded bg-slate-800 text-slate-300 transition hover:bg-slate-700"
                title="1단위 증가"
              >
                <Plus size={11} />
              </button>
            </div>
          </div>

          {/* Mw 스케일 퀵 프리셋 */}
          <div className="hidden sm:flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleRepeatChange(1)}
              className={`rounded px-2 py-1 text-[10px] font-semibold transition ${
                repeatCount === 1
                  ? "bg-sky-500 text-white shadow-sm"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
              title="반복수 1로 리셋 (단위포 모드)"
            >
              n=1 단위포
            </button>
            <button
              type="button"
              onClick={() => handleMwChange(50000)}
              className="rounded bg-slate-800 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-700 transition"
              title="상용 평균 분자량 (약 50,000 g/mol)"
            >
              표준(5만)
            </button>
          </div>
        </div>
      </div>

      {/* [시스템 공중합 파서 완료 알림 배너] */}
      {systemParseToast && (
        <div className="mt-2 flex items-center justify-between rounded-xl border border-emerald-400/50 bg-emerald-950/80 px-3 py-1.5 text-xs font-semibold text-emerald-200 shadow-lg animate-in fade-in slide-in-from-top-1 duration-150">
          <span>{systemParseToast}</span>
          <button
            type="button"
            onClick={() => setSystemParseToast(null)}
            className="text-emerald-300 hover:text-white ml-2"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          2. 다중 고분자 혼합 & 공중합체 결합 제어 바 (Multi-Polymer Blend Studio Bar)
          2종 이상의 고분자가 혼합 슬롯에 있을 때 나타남! (예: PS + PP 동시 비교 또는 블록 공중합)
          ───────────────────────────────────────────────────────────── */}
      {isBlendActive && (
        <div className="mt-2 rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-950/40 via-purple-950/40 to-sky-950/40 p-2.5 backdrop-blur-lg animate-in slide-in-from-top-2 duration-200">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* 좌측: 혼합 슬롯 칩 목록 */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1 text-xs font-bold text-amber-300">
                <GitMerge size={14} className="text-amber-400" />
                <span>혼합/조합 슬롯:</span>
              </span>

              {blendItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-black/60 px-2 py-1 text-xs font-medium text-white shadow-sm"
                >
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: item.tintColor || "#38bdf8" }}
                  />
                  <span className="font-bold font-mono">{item.polymer.shortName}</span>
                  <span className="text-[10px] text-amber-300 font-mono font-bold">({item.ratio}%)</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveBlendItem(item.id)}
                    className="ml-1 text-slate-400 hover:text-rose-300 transition"
                    title="슬롯에서 제거"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>

            {/* 중앙: 3D 표시 모드 및 공중합체 구조(Random / Block / Graft) 선택 */}
            <div className="flex flex-wrap items-center gap-1.5">
              <div className="flex items-center gap-0.5 rounded-lg border border-white/15 bg-black/50 p-0.5">
                <button
                  type="button"
                  onClick={() => handleToggleCopolymerMode("parallel")}
                  className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold transition ${
                    blendMode === "parallel"
                      ? "bg-amber-500 text-slate-950 shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                  title="동일 3D 화면에 두 고분자 사슬을 나란히 동시에 배치하여 비교"
                >
                  <Split size={12} />
                  <span>동시 나란히 비교</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleCopolymerMode("copolymer")}
                  className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold transition ${
                    blendMode === "copolymer"
                      ? "bg-purple-500 text-white shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                  title="두 고분자 단량체를 결합한 공중합체(Random/Block/Graft) 3D 사슬 렌더링"
                >
                  <GitMerge size={12} />
                  <span>공중합체 합성 뷰</span>
                </button>
              </div>

              {/* 공중합체 모드일 때: Random / Block / Graft 구조 선택 세그먼트 */}
              {blendMode === "copolymer" && (
                <div className="flex items-center gap-0.5 rounded-lg border border-purple-400/40 bg-purple-950/60 p-0.5 animate-in fade-in duration-150">
                  <span className="text-[10px] text-purple-300 font-bold px-1.5">구조:</span>
                  <button
                    type="button"
                    onClick={() => handleSelectArchitecture("random")}
                    className={`rounded px-2 py-0.5 text-[11px] font-bold transition ${
                      copolymerArch === "random"
                        ? "bg-purple-400 text-slate-950 shadow-sm"
                        : "text-purple-300 hover:text-white"
                    }`}
                    title="랜덤 공중합체: A와 B 단량체가 사슬 내에 불규칙/통계적으로 분산"
                  >
                    Random (랜덤)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectArchitecture("block")}
                    className={`rounded px-2 py-0.5 text-[11px] font-bold transition ${
                      copolymerArch === "block"
                        ? "bg-purple-400 text-slate-950 shadow-sm"
                        : "text-purple-300 hover:text-white"
                    }`}
                    title="블록 공중합체: A 블록과 B 블록이 연속적으로 연결된 나노 미세상분리 구조"
                  >
                    Block (블록)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectArchitecture("graft")}
                    className={`rounded px-2 py-0.5 text-[11px] font-bold transition ${
                      copolymerArch === "graft"
                        ? "bg-purple-400 text-slate-950 shadow-sm"
                        : "text-purple-300 hover:text-white"
                    }`}
                    title="그래프트 공중합체: A 주사슬 백본에 B 단량체가 곁가지로 뻗어나가는 빗살형 구조"
                  >
                    Graft (그래프트)
                  </button>
                </div>
              )}
            </div>

            {/* 우측: 혼합 해제 (단일 고분자로 복귀) */}
            <button
              type="button"
              onClick={() => {
                if (onBlendItemsChange) {
                  onBlendItemsChange([
                    { id: "slot_0", polymer: blendItems[0].polymer, ratio: 100, yOffset: 0 },
                  ]);
                }
                onSelectPolymer(blendItems[0].polymer);
                if (onBlendModeChange) onBlendModeChange("parallel");
              }}
              className="flex items-center gap-1 rounded-lg border border-white/10 bg-slate-800/80 hover:bg-slate-700 px-2 py-1 text-[11px] font-semibold text-slate-300 transition"
            >
              <RotateCcwIcon size={11} />
              <span>단일 뷰 복귀</span>
            </button>
          </div>

          {/* 2단: 다중 단량체(2개, 3개 이상) 블록/가지별 개별 분자량(DP/Mn) 조절 슬롯 & 실시간 비율/물성 지표 */}
          {blendItems.length >= 2 && detailedCopolymerEval && (
            <div className="mt-2 pt-2 border-t border-white/10 space-y-2 text-xs">
              {/* 블록/가지별 개별 중합도(DP, 단량체 개수) 및 분자량(Mn) 독립 컨트롤 그리드 */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {blendItems.map((item, idx) => {
                  const compSummary = detailedCopolymerEval.componentBreakdown?.[idx];
                  const itemDp = compSummary?.dp ?? item.dp ?? Math.max(15, Math.round(item.ratio * 1.2));
                  const itemMw = compSummary?.blockMw ?? item.blockMw ?? Math.round(itemDp * item.polymer.monomerMW);
                  const wtPct = compSummary?.wtRatio ?? item.ratio;
                  const molPct = compSummary?.molRatio ?? item.molRatio ?? item.ratio;
                  const roleTitle =
                    copolymerArch === "random"
                      ? `Random 성분 ${idx + 1}`
                      : copolymerArch === "graft"
                      ? idx === 0
                        ? `Backbone 1 크기 (주사슬)`
                        : `Graft ${idx + 1} 크기 (가지)`
                      : idx >= 2
                      ? `Graft ${idx + 1} 크기 (가지)`
                      : `Block ${idx + 1} 크기 (블록)`;

                  const badgeColors = [
                    "border-sky-500/40 bg-sky-950/40 text-sky-300",
                    "border-amber-500/40 bg-amber-950/40 text-amber-300",
                    "border-emerald-500/40 bg-emerald-950/40 text-emerald-300",
                    "border-purple-500/40 bg-purple-950/40 text-purple-300",
                  ];
                  const accentColors = [
                    "accent-sky-400",
                    "accent-amber-400",
                    "accent-emerald-400",
                    "accent-purple-400",
                  ];

                  return (
                    <div
                      key={item.id}
                      className={`rounded-xl border px-3 py-2 flex flex-col gap-1.5 ${badgeColors[idx % badgeColors.length]}`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className="h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: item.tintColor || "#38bdf8" }}
                          />
                          <span className="font-extrabold text-[11px] text-white truncate">
                            {roleTitle}: {item.polymer.shortName}
                          </span>
                        </div>
                        <span className="rounded bg-black/50 border border-white/15 px-1.5 py-0.5 text-[10px] font-mono font-bold text-white shrink-0">
                          {wtPct} wt% · {molPct} mol%
                        </span>
                      </div>

                      {/* 개별 중합도(DP, 단량체 개수) 슬라이더 + 직접 입력 */}
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-slate-300 shrink-0 w-16">
                          단량체(DP):
                        </span>
                        <input
                          type="range"
                          min={5}
                          max={300}
                          step={1}
                          value={Math.min(300, itemDp)}
                          onChange={(e) => handleItemDpChange(idx, Number(e.target.value))}
                          className={`flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer ${accentColors[idx % accentColors.length]}`}
                        />
                        <input
                          type="number"
                          min={5}
                          max={2000}
                          value={itemDp}
                          onChange={(e) => handleItemDpChange(idx, Number(e.target.value) || 10)}
                          className="w-14 rounded bg-black/70 border border-white/20 px-1.5 py-0.5 text-right font-mono text-[11px] font-bold text-white focus:outline-none focus:border-sky-400"
                          title={`${roleTitle} 단량체 반복 개수(DP) 직접 입력`}
                        />
                        <span className="text-[10px] text-slate-400 font-mono">개</span>
                      </div>

                      {/* 개별 블록/가지 분자량(Mn) 직접 입력 & 표시 */}
                      <div className="flex items-center justify-between gap-2 text-[10px] font-mono pt-0.5 border-t border-white/10">
                        <span className="text-slate-300">개별 분자량(Mn):</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min={100}
                            max={500000}
                            step={100}
                            value={itemMw}
                            onChange={(e) => handleItemMwChange(idx, Number(e.target.value) || 500)}
                            className="w-20 rounded bg-black/70 border border-white/20 px-1.5 py-0.5 text-right font-mono text-[10px] font-bold text-amber-200 focus:outline-none focus:border-amber-400"
                            title={`${roleTitle} 분자량(g/mol) 직접 입력`}
                          />
                          <span className="text-slate-400">g/mol</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                {/* 2성분일 때 빠른 상대 비율 조절 바 + 다중 성분일 때 총합 DP / 총 분자량(Mn) 요약 */}
                {blendItems.length === 2 ? (
                  <div className="flex items-center gap-2 flex-1 min-w-[260px]">
                    <div className="flex items-center rounded-lg border border-white/15 bg-black/60 p-0.5 text-[10px] font-mono shrink-0">
                      <button
                        type="button"
                        onClick={() => setRatioUnit("wt")}
                        className={`rounded px-1.5 py-0.2 transition ${
                          ratioUnit === "wt" ? "bg-amber-500 text-black font-bold" : "text-slate-400 hover:text-white"
                        }`}
                      >
                        wt%
                      </button>
                      <button
                        type="button"
                        onClick={() => setRatioUnit("mol")}
                        className={`rounded px-1.5 py-0.2 transition ${
                          ratioUnit === "mol" ? "bg-purple-500 text-white font-bold" : "text-slate-400 hover:text-white"
                        }`}
                      >
                        mol%
                      </button>
                    </div>

                    <span className="text-[11px] font-mono text-sky-300 font-bold shrink-0">
                      {blendItems[0].polymer.shortName}{" "}
                      {ratioUnit === "wt"
                        ? `${detailedCopolymerEval.ratioA_wt}%`
                        : `${detailedCopolymerEval.ratioA_mol}mol%`}
                    </span>

                    <input
                      type="range"
                      min={10}
                      max={90}
                      step={1}
                      value={ratioUnit === "wt" ? detailedCopolymerEval.ratioA_wt : detailedCopolymerEval.ratioA_mol}
                      onChange={(e) => handleRatioSliderChange(Number(e.target.value))}
                      className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                    />

                    <span className="text-[11px] font-mono text-amber-300 font-bold shrink-0">
                      {blendItems[1].polymer.shortName}{" "}
                      {ratioUnit === "wt"
                        ? `${detailedCopolymerEval.ratioB_wt}%`
                        : `${detailedCopolymerEval.ratioB_mol}mol%`}
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-emerald-300 bg-emerald-950/40 border border-emerald-500/30 rounded-lg px-2.5 py-1">
                    <span>
                      총 공중합도(Total DP):{" "}
                      <strong className="text-white">{detailedCopolymerEval.totalDp?.toLocaleString()}</strong> mers
                    </span>
                    <span className="text-slate-500">|</span>
                    <span>
                      총 분자량(Total Mn):{" "}
                      <strong className="text-amber-300">
                        {detailedCopolymerEval.totalMw?.toLocaleString()} g/mol
                      </strong>
                    </span>
                  </div>
                )}

                {/* 실시간 물성 지표 요약 (Tg, 강도, 밀도) */}
                <div className="flex items-center gap-3 text-[11px] font-mono text-slate-300 shrink-0">
                  <span className="flex items-center gap-1">
                    <Flame size={12} className="text-amber-400" />
                    예상 Tg: <strong className="text-amber-300">{detailedCopolymerEval.foxTg}℃</strong>
                  </span>
                  <span className="flex items-center gap-1 border-l border-white/10 pl-2">
                    <span className="text-emerald-400 font-bold">인장강도:</span>
                    <strong className="text-emerald-300">{detailedCopolymerEval.predictedTenacity} g/d</strong>
                  </span>
                  <span className="flex items-center gap-1 border-l border-white/10 pl-2">
                    <Layers size={12} className="text-sky-400" />
                    밀도: <strong className="text-sky-300">{detailedCopolymerEval.predictedDensity}</strong>
                  </span>
                </div>
              </div>

              {/* 3단: 연구원용 상분리 모폴로지 & 합성 타당성 배지 */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-black/40 border border-white/5 px-2.5 py-1 text-[10px]">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="rounded bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 px-1.5 py-0.2 font-semibold">
                    {detailedCopolymerEval.phaseMorphology}
                  </span>
                  <span className="text-slate-400 font-mono">
                    χ={detailedCopolymerEval.chiEstimate} (χN={detailedCopolymerEval.chiN})
                  </span>
                  <span className="text-slate-300 hidden md:inline truncate">
                    • {detailedCopolymerEval.recommendedMethod}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-medium">합성 타당성 점수:</span>
                  <span className="rounded bg-emerald-500/20 border border-emerald-400/40 px-1.5 py-0.2 font-bold font-mono text-emerald-300">
                    {detailedCopolymerEval.syntheticFeasibilityScore} / 100점
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// 회전 초기화 아이콘 컴포넌트
function RotateCcwIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}
