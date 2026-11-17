import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  Search,
  Copy,
  Check,
  RotateCcw,
  Trash2,
  Columns,
  Square,
  Box,
  Minus,
  Equal,
  Move,
  Eraser,
  CheckCircle2,
  Atom,
  Layers,
  FlaskConical,
  X,
  ShieldAlert,
  ShieldCheck,
  Bookmark,
  BookmarkPlus,
  Download,
  Upload,
  AlertTriangle,
  Info,
  Ruler,
  Wrench,
  Sparkles,
  Database,
  Plus,
} from "lucide-react";
import {
  MolDrawCanvas,
  type AtomNode,
  type BondEdge,
  type AtomSymbol,
  type MolDrawTool,
  ATOM_CONFIG,
} from "./MolDrawCanvas";
import { MolViewer3D } from "./MolViewer3D";
import {
  calculateMolecularDescriptor,
  type MolecularDescriptor,
} from "../model/molecularDescriptor";
import {
  POPULAR_MOLECULES,
  MAIN_LAB_POLYMER_PRESETS,
  type PresetCategory,
  type PresetMolecule,
  createPolymerFromSketch,
  realRecordToPresetMolecule,
  appendMoleculeToCanvas,
} from "../model/moldrawPresets";
import {
  loadPolymerInformaticsDataset,
  searchPolymers,
} from "../model/polymerDatasetService";
import {
  validateMolecularStructure,
  autoFixMolecularStructure,
  type MolecularValidationResult,
} from "../model/molecularValidation";
import {
  loadSavedMolecules,
  saveNamedMolecule,
  deleteSavedMolecule,
  saveCurrentWorkingSketch,
  loadCurrentWorkingSketch,
  exportMoleculesJson,
  importMoleculesJson,
  type SavedMoleculePreset,
} from "../model/sketchStorage";
import type { PolymerDefinition } from "../model/polymers";
import { predictComprehensive } from "../model/surrogate";
import { DEFAULT_INPUTS, type ComprehensiveProperties, type FiberInputs } from "../types";
import {
  interceptPolymerStructureFormula,
  buildCopolymer3DFromParsedStructure,
  type ParsedCopolymerStructure,
} from "../model/chatMolecularParser";

export interface MolDrawStudioProps {
  initialAtoms?: AtomNode[];
  initialBonds?: BondEdge[];
  parsedCopolymer?: ParsedCopolymerStructure;
  onStructureChange?: (
    atoms: AtomNode[],
    bonds: BondEdge[],
    descriptor: MolecularDescriptor,
    parsedCopolymer?: ParsedCopolymerStructure
  ) => void;
  onApplyToMainModel?: (data: {
    polymer: PolymerDefinition;
    descriptor: MolecularDescriptor;
    atoms: AtomNode[];
    bonds: BondEdge[];
    parsedCopolymer?: ParsedCopolymerStructure;
  }) => void;
  className?: string;
  onClose?: () => void;
}

export const MolDrawStudio: React.FC<MolDrawStudioProps> = ({
  initialAtoms,
  initialBonds,
  parsedCopolymer,
  onStructureChange,
  onApplyToMainModel,
  className = "",
  onClose,
}) => {
  // 1. 분자 구조 상태 (외부 연동 구조 우선 -> LocalStorage 자동 복원 -> 벤젠 기본값)
  const [atoms, setAtoms] = useState<AtomNode[]>(() => {
    if (initialAtoms && initialAtoms.length > 0) return initialAtoms;
    const autosaved = loadCurrentWorkingSketch();
    if (autosaved && autosaved.atoms.length > 0) return autosaved.atoms;
    return POPULAR_MOLECULES[0].atoms;
  });
  const [bonds, setBonds] = useState<BondEdge[]>(() => {
    if (initialBonds && initialBonds.length > 0) return initialBonds;
    const autosaved = loadCurrentWorkingSketch();
    if (autosaved && autosaved.atoms.length > 0) return autosaved.bonds;
    return POPULAR_MOLECULES[0].bonds;
  });
  const [activeCopolymer, setActiveCopolymer] = useState<ParsedCopolymerStructure | undefined>(parsedCopolymer);

  // 내부 변경인지 외부(채팅/3D 뷰어) 동기화인지 구분하는 플래그 Ref
  const isInternalChangeRef = useRef(false);

  // 외부(채팅 입력 또는 3D 뷰어)에서 initialAtoms / initialBonds / parsedCopolymer가 변경되면 2D 캔버스도 즉시 실시간 동기화
  useEffect(() => {
    if (isInternalChangeRef.current) {
      isInternalChangeRef.current = false;
      return;
    }
    if (initialAtoms && initialAtoms.length > 0) {
      setAtoms(initialAtoms);
      setBonds(initialBonds || []);
    }
  }, [initialAtoms, initialBonds]);

  useEffect(() => {
    if (parsedCopolymer) {
      setActiveCopolymer(parsedCopolymer);
    }
  }, [parsedCopolymer]);

  // 자동 저장(Autosave) 동기화
  useEffect(() => {
    saveCurrentWorkingSketch(atoms, bonds);
  }, [atoms, bonds]);

  // Undo 히스토리
  const [history, setHistory] = useState<{ atoms: AtomNode[]; bonds: BondEdge[] }[]>([]);

  // 2. 도구 및 원소 상태
  const [activeTool, setActiveTool] = useState<MolDrawTool>("single");
  const [selectedAtomSymbol, setSelectedAtomSymbol] = useState<AtomSymbol>("C");

  // 3. 뷰 모드 ("split" | "2d" | "3d")
  const [viewMode, setViewMode] = useState<"split" | "2d" | "3d">("split");

  // 4. 검색창 및 템플릿 모달 상태
  const [searchQuery, setSearchQuery] = useState("");
  const [modalSearchQuery, setModalSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isLibraryModalOpen, setIsLibraryModalOpen] = useState(false);
  const [libraryCategory, setLibraryCategory] = useState<"all" | PresetCategory | "open_db" | "saved">("monomer");
  const [copiedSmiles, setCopiedSmiles] = useState(false);
  const [datasetLoadedCount, setDatasetLoadedCount] = useState(0);

  // 3,284건 오픈 데이터셋 백그라운드 로드
  useEffect(() => {
    loadPolymerInformaticsDataset().then((records) => {
      setDatasetLoadedCount(records.length);
    });
  }, []);

  // 5. 유효성 검증(Validation) 상세 모달
  const [isValidationModalOpen, setIsValidationModalOpen] = useState(false);

  // 6. 커스텀 분자 저장(Persistence) 상태
  const [savedMolecules, setSavedMolecules] = useState<SavedMoleculePreset[]>(() => loadSavedMolecules());
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveDescription, setSaveDescription] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 7. 결합 길이/각도 실시간 치수선 오버레이 표시 상태
  const [showDimensions, setShowDimensions] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 토스트 메시지 헬퍼
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // 2D 스케치 변경 시 메인 모델 / 3D 뷰어 / 채팅창으로 실시간 전파
  const emitStructureChange = useCallback(
    (
      nextAtoms: AtomNode[],
      nextBonds: BondEdge[],
      nextCopolymer?: ParsedCopolymerStructure
    ) => {
      isInternalChangeRef.current = true;
      saveCurrentWorkingSketch(nextAtoms, nextBonds);
      if (onStructureChange && nextAtoms.length > 0) {
        const nextDesc = calculateMolecularDescriptor(nextAtoms, nextBonds);
        onStructureChange(nextAtoms, nextBonds, nextDesc, nextCopolymer);
      }
    },
    [onStructureChange]
  );

  // 상태 히스토리 저장
  const pushHistory = useCallback(() => {
    setHistory((prev) => [...prev.slice(-20), { atoms, bonds }]);
  }, [atoms, bonds]);

  const handleAtomsChange = (nextAtoms: AtomNode[]) => {
    pushHistory();
    setAtoms(nextAtoms);
    emitStructureChange(nextAtoms, bonds, activeCopolymer);
  };

  const handleBondsChange = (nextBonds: BondEdge[]) => {
    pushHistory();
    setBonds(nextBonds);
    emitStructureChange(atoms, nextBonds, activeCopolymer);
  };

  // 실행 취소
  const handleUndo = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setAtoms(prev.atoms);
    setBonds(prev.bonds);
    emitStructureChange(prev.atoms, prev.bonds, activeCopolymer);
  };

  // 전체 초기화
  const handleClear = () => {
    pushHistory();
    setAtoms([]);
    setBonds([]);
    setActiveCopolymer(undefined);
  };

  // 프리셋 또는 저장된 분자 로드 (교체 로드)
  const handleLoadMolecule = (preset: { atoms: AtomNode[]; bonds: BondEdge[]; nameKo?: string; name?: string }) => {
    pushHistory();
    setAtoms(preset.atoms);
    setBonds(preset.bonds);
    setActiveCopolymer(undefined);
    emitStructureChange(preset.atoms, preset.bonds, undefined);
    setIsSearchOpen(false);
    setIsLibraryModalOpen(false);
    setSearchQuery("");
    showToast(`'${preset.nameKo || preset.name || "분자"}' 구조를 2D 캔버스 및 3D 뷰어에 실시간 연동했습니다.`);
  };

  // 현재 2D 캔버스에 단량체/고분자를 옆에 이어 붙이기 (조합/공중합 추가)
  const handleAppendMolecule = (
    preset: { atoms: AtomNode[]; bonds: BondEdge[]; nameKo?: string; name?: string },
    connectBond = true
  ) => {
    pushHistory();
    const combined = appendMoleculeToCanvas(atoms, bonds, preset, connectBond);
    setAtoms(combined.atoms);
    setBonds(combined.bonds);
    emitStructureChange(combined.atoms, combined.bonds, activeCopolymer);
    setIsSearchOpen(false);
    setIsLibraryModalOpen(false);
    setSearchQuery("");
    showToast(`'${preset.nameKo || preset.name || "단량체"}'를 현재 2D 캔버스 사슬에 조합 추가 및 3D 동기화했습니다.`);
  };

  // 화학적 유효성 자동 오류 제거 (Auto-Fix Engine)
  const handleAutoFix = useCallback(() => {
    if (atoms.length === 0) return;
    const res = autoFixMolecularStructure(atoms, bonds);
    pushHistory();
    setAtoms(res.fixedAtoms);
    setBonds(res.fixedBonds);
    emitStructureChange(res.fixedAtoms, res.fixedBonds, activeCopolymer);
    if (res.fixCount > 0) {
      showToast(
        `[자동 오류 제거] ${res.fixCount}건 교정 완료: ${res.fixDescriptions.slice(0, 2).join(", ")}${
          res.fixDescriptions.length > 2 ? " 외" : ""
        }`
      );
    } else {
      showToast("교정할 오류가 없거나 화학적 결합이 이미 정상입니다.");
    }
  }, [atoms, bonds, pushHistory, emitStructureChange, activeCopolymer]);

  // 분자 디스크립터 실시간 계산
  const descriptor = useMemo(() => {
    return calculateMolecularDescriptor(atoms, bonds);
  }, [atoms, bonds]);

  // 분자 화학적/기하학적 유효성 실시간 검증 (Valence & Geometry Validation)
  const validation: MolecularValidationResult = useMemo(() => {
    return validateMolecularStructure(atoms, bonds);
  }, [atoms, bonds]);

  // 대리 모델 실시간 예측 (단, 화학적 유효성 오류가 없을 때만 유의미하게 계산)
  const surrogateResult = useMemo((): ComprehensiveProperties => {
    const fiberInput: FiberInputs = {
      ...DEFAULT_INPUTS,
      customDescriptor: descriptor,
      molecularWeight: Math.round(DEFAULT_INPUTS.repeatCount * descriptor.monomerMW),
    };
    return predictComprehensive(fiberInput);
  }, [descriptor]);

  // 간이 SMILES 복사
  const handleCopySmiles = () => {
    const matchedPreset = POPULAR_MOLECULES.find((p) => p.formula === descriptor.formula);
    const smilesText = matchedPreset ? matchedPreset.smiles : `${descriptor.formula}-approx`;
    navigator.clipboard.writeText(smilesText);
    setCopiedSmiles(true);
    setTimeout(() => setCopiedSmiles(false), 2000);
  };

  // 커스텀 분자 저장 모달 오픈
  const handleOpenSaveModal = () => {
    setSaveName(descriptor.formula ? `커스텀 ${descriptor.formula}` : "새 분자 스케치");
    setSaveDescription("");
    setIsSaveModalOpen(true);
  };

  // 저장 확정
  const handleConfirmSave = () => {
    if (!saveName.trim()) return;
    saveNamedMolecule(
      saveName.trim(),
      atoms,
      bonds,
      descriptor.formula,
      descriptor.monomerMW,
      saveDescription.trim()
    );
    setSavedMolecules(loadSavedMolecules());
    setIsSaveModalOpen(false);
    showToast(`'${saveName.trim()}' 보관함 저장 완료!`);
  };

  // 6-1. 보관함 항목 삭제 인라인 확인 상태
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // 저장된 분자 삭제 핸들러 (브라우저 confirm 차단 버그 해결 및 실시간 State/LocalStorage 동기화)
  const handleDeleteSaved = (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    e.preventDefault();
    const updated = deleteSavedMolecule(id);
    setSavedMolecules([...updated]);
    setDeleteConfirmId(null);
    showToast(`'${name}' 보관함에서 삭제되었습니다.`);
  };

  // JSON 백업 다운로드
  const handleExportJson = () => {
    const jsonStr = exportMoleculesJson();
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `polymer_molecules_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("JSON 백업 파일이 다운로드되었습니다.");
  };

  // JSON 백업 가져오기
  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const res = importMoleculesJson(text);
      if (res.success) {
        setSavedMolecules(loadSavedMolecules());
        showToast(`${res.count}개 분자를 성공적으로 가져왔습니다.`);
      } else {
        alert(res.error || "가져오기 실패");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // [2D 스튜디오 구조식 인터셉터]: "폴리스티렌-graft-폴리프로필렌", "PS-b-PP-g-PE" 등 입력 시 감지
  const interceptedCopolymer = useMemo<ParsedCopolymerStructure | null>(() => {
    if (!searchQuery.trim()) return null;
    return interceptPolymerStructureFormula(searchQuery.trim());
  }, [searchQuery]);

  const handleApplyInterceptedCopolymer = (parsed: ParsedCopolymerStructure) => {
    const built = buildCopolymer3DFromParsedStructure(parsed);
    pushHistory();
    setAtoms(built.atoms);
    setBonds(built.bonds);
    setActiveCopolymer(parsed);
    emitStructureChange(built.atoms, built.bonds, parsed);
    setIsSearchOpen(false);
    setSearchQuery("");
    showToast(parsed.systemMessage);
  };

  // 검색 필터링된 프리셋
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return POPULAR_MOLECULES;
    const q = searchQuery.toLowerCase();
    return POPULAR_MOLECULES.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.nameKo.toLowerCase().includes(q) ||
        m.formula.toLowerCase().includes(q) ||
        m.smiles.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  // 3,284건 오픈 데이터셋 검색 결과 (상단 드롭다운용)
  const openDbSearchResults = useMemo(() => {
    if (datasetLoadedCount === 0) return [];
    const q = searchQuery.trim();
    const res = searchPolymers({ query: q || undefined, limit: q ? 12 : 6 });
    return res.results.map(realRecordToPresetMolecule);
  }, [searchQuery, datasetLoadedCount]);

  // 라이브러리 모달 내 카테고리 + 검색어 필터링된 프리셋
  const filteredLibraryPresets = useMemo(() => {
    let base: PresetMolecule[] = [];
    if (libraryCategory === "all") base = POPULAR_MOLECULES;
    else if (libraryCategory === "saved") return [];
    else if (libraryCategory === "open_db") {
      if (datasetLoadedCount === 0) return [];
      const res = searchPolymers({
        query: modalSearchQuery.trim() || undefined,
        limit: 36,
      });
      return res.results.map(realRecordToPresetMolecule);
    } else {
      base = POPULAR_MOLECULES.filter((m) => m.category === libraryCategory);
    }

    if (!modalSearchQuery.trim()) return base;
    const q = modalSearchQuery.toLowerCase();
    return base.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.nameKo.toLowerCase().includes(q) ||
        m.formula.toLowerCase().includes(q) ||
        m.smiles.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q)
    );
  }, [libraryCategory, modalSearchQuery, datasetLoadedCount]);

  return (
    <div
      className={`flex flex-col bg-[#070b14] border border-slate-800 rounded-2xl overflow-hidden shadow-2xl text-slate-100 ${className}`}
    >
      {/* ─────────────────────────────────────────────────────────────
          토스트 알림 팝업
          ───────────────────────────────────────────────────────────── */}
      {toastMessage && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-500 text-slate-950 font-bold px-4 py-2 rounded-xl shadow-2xl flex items-center gap-2 text-xs animate-in slide-in-from-top duration-200">
          <CheckCircle2 size={16} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          1. MolDraw 글로벌 헤더
          ───────────────────────────────────────────────────────────── */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/90 bg-slate-950/90 px-4 py-2.5 backdrop-blur-md shrink-0">
        {/* 좌측: 로고 및 타이틀 */}
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/20 border border-sky-400/30 text-sky-400 shadow-sm">
            <Atom size={19} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm tracking-tight text-white">
                MolDraw Studio
              </span>
              <span className="rounded-full bg-sky-500/20 border border-sky-400/30 px-2 py-0.2 text-[10px] text-sky-300 font-semibold">
                2D ➔ 3D 실시간 연동됨
              </span>
              {activeCopolymer && (
                <span className="rounded-full bg-emerald-500/20 border border-emerald-400/40 px-2 py-0.2 text-[10px] text-emerald-300 font-bold">
                  🧬 {activeCopolymer.componentDetails.map((c) => c.shortName).join("-")} ({activeCopolymer.structure_type.toUpperCase()})
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-400">
              2D 스케치 · 3D 뷰어 · AI 채팅창 양방향 실시간 동기화 에디터
            </p>
          </div>
        </div>

        {/* 중앙: PubChem 스타일 스마트 분자 & 공중합 구조식 검색 바 */}
        <div className="relative flex-1 max-w-md mx-2">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="단량체/고분자 또는 구조식 입력 (예: 폴리스티렌-graft-폴리프로필렌, PS-b-PP-g-PE)..."
              value={searchQuery}
              onFocus={() => setIsSearchOpen(true)}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (interceptedCopolymer) {
                    e.preventDefault();
                    handleApplyInterceptedCopolymer(interceptedCopolymer);
                  } else if (searchResults.length > 0) {
                    e.preventDefault();
                    handleLoadMolecule(searchResults[0]);
                  }
                }
              }}
              className="w-full pl-8 pr-4 py-1.5 bg-slate-900/90 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 transition"
            />
          </div>

          {/* 검색 드롭다운 결과 (구조식 인터셉터 + 기본 49종 + 3,284건 오픈 데이터셋 실시간 연동) */}
          {isSearchOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-2 z-50 max-h-96 overflow-y-auto">
              {/* 공중합 구조식 인터셉트 즉시 실행 배너 */}
              {interceptedCopolymer && (
                <button
                  type="button"
                  onClick={() => handleApplyInterceptedCopolymer(interceptedCopolymer)}
                  className="w-full text-left mb-2 p-2.5 rounded-xl bg-gradient-to-r from-emerald-950/90 via-teal-950/80 to-slate-900 border border-emerald-400/60 hover:border-emerald-300 transition flex items-center justify-between gap-2 shadow-lg"
                >
                  <div>
                    <div className="text-[10px] font-extrabold text-emerald-300 flex items-center gap-1">
                      <Sparkles size={11} />
                      <span>복합 공중합 구조식 감지 — 2D 캔버스 & 3D 뷰어 동시 생성 (Enter)</span>
                    </div>
                    <div className="text-xs font-bold text-white mt-0.5">
                      {interceptedCopolymer.componentDetails.map((m) => `${m.koreanName}(${m.shortName})`).join(` -${interceptedCopolymer.structure_type}- `)}
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-500 text-slate-950 font-extrabold text-[10px] shrink-0">
                    즉시 반영 →
                  </span>
                </button>
              )}
              <div className="text-[10px] text-slate-400 px-2 py-1 font-semibold uppercase tracking-wider flex justify-between items-center border-b border-slate-800/80 mb-1">
                <span>단량체 & 베이스라인 30종 ({searchResults.length})</span>
                <button
                  onClick={() => setIsSearchOpen(false)}
                  className="text-slate-500 hover:text-white"
                >
                  닫기
                </button>
              </div>
              {searchResults.map((preset) => (
                <div
                  key={preset.id}
                  className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-800 text-xs transition flex items-center justify-between gap-2 group"
                >
                  <div
                    onClick={() => handleLoadMolecule(preset)}
                    className="flex-1 cursor-pointer min-w-0"
                  >
                    <div className="font-semibold text-slate-200 group-hover:text-sky-300 flex items-center gap-1.5">
                      <span className="truncate">{preset.nameKo}</span>
                      {preset.category === "polymer" ? (
                        <span className="text-[9px] bg-indigo-950/80 text-indigo-300 px-1.5 py-0.2 rounded border border-indigo-800/60 font-normal shrink-0">
                          베이스라인 30종
                        </span>
                      ) : (
                        <span className="text-[9px] bg-emerald-950/80 text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-800/60 font-normal shrink-0">
                          단량체
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono truncate">
                      {preset.name} · {preset.formula} ({preset.mw} g/mol)
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleLoadMolecule(preset)}
                      className="text-[10px] font-bold text-sky-300 bg-sky-950/80 hover:bg-sky-600 hover:text-white px-2 py-1 rounded border border-sky-700/60 transition"
                      title="캔버스를 비우고 이 단량체/분자를 새로 불러옵니다"
                    >
                      불러오기
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAppendMolecule(preset, true)}
                      className="text-[10px] font-bold text-emerald-300 bg-emerald-950/80 hover:bg-emerald-600 hover:text-white px-2 py-1 rounded border border-emerald-700/60 transition flex items-center gap-0.5"
                      title="현재 2D 캔버스에 그려진 구조 옆에 이 단량체를 이어 붙여 조합합니다"
                    >
                      <Plus size={11} />
                      <span>조합</span>
                    </button>
                  </div>
                </div>
              ))}

              {/* 3,284건 오픈 데이터셋 검색 결과 섹션 */}
              {openDbSearchResults.length > 0 && (
                <>
                  <div className="text-[10px] text-emerald-400 px-2 py-1.5 mt-2 font-semibold uppercase tracking-wider flex justify-between items-center border-t border-slate-800">
                    <span className="flex items-center gap-1">
                      <Database size={11} />
                      오픈 데이터셋 3,284건 단량체/반복단위 매칭 ({openDbSearchResults.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsSearchOpen(false);
                        setLibraryCategory("open_db");
                        setModalSearchQuery(searchQuery);
                        setIsLibraryModalOpen(true);
                      }}
                      className="text-sky-400 hover:underline text-[10px]"
                    >
                      전체 3,284건 모달 열기 →
                    </button>
                  </div>
                  {openDbSearchResults.map((preset) => (
                    <div
                      key={preset.id}
                      className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-800 text-xs transition flex items-center justify-between gap-2 group"
                    >
                      <div
                        onClick={() => handleLoadMolecule(preset)}
                        className="flex-1 cursor-pointer min-w-0"
                      >
                        <div className="font-semibold text-slate-200 group-hover:text-emerald-300 flex items-center gap-1.5">
                          <span className="truncate">{preset.nameKo}</span>
                          <span className="text-[9px] bg-teal-950/80 text-teal-300 px-1.5 py-0.2 rounded border border-teal-800/60 font-normal shrink-0">
                            오픈DB
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono truncate">
                          {preset.formula} · SMILES: {preset.smiles}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleLoadMolecule(preset)}
                          className="text-[10px] font-bold text-sky-300 bg-sky-950/80 hover:bg-sky-600 hover:text-white px-2 py-1 rounded border border-sky-700/60 transition"
                        >
                          불러오기
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAppendMolecule(preset, true)}
                          className="text-[10px] font-bold text-emerald-300 bg-emerald-950/80 hover:bg-emerald-600 hover:text-white px-2 py-1 rounded border border-emerald-700/60 transition flex items-center gap-0.5"
                        >
                          <Plus size={11} />
                          <span>조합</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* 우측: 유효성 상태 배지, 저장 버튼, 뷰 모드 스위처 */}
        <div className="flex items-center gap-2">
          {/* 실시간 화학적 유효성 진단 배지 버튼 */}
          <button
            onClick={() => setIsValidationModalOpen(true)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition ${
              validation.isValid
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20"
                : "bg-rose-500/15 border-rose-500/40 text-rose-300 hover:bg-rose-500/25 animate-pulse"
            }`}
            title="화학적 유효성 검증 상세 리포트 열기"
          >
            {validation.isValid ? (
              <>
                <ShieldCheck size={13} className="text-emerald-400" />
                <span>유효함 (Valid)</span>
              </>
            ) : (
              <>
                <ShieldAlert size={13} className="text-rose-400" />
                <span>오류 {validation.errors.length}건 (Invalid)</span>
              </>
            )}
          </button>

          {/* 현재 분자 저장 버튼 (Persistence) */}
          <button
            onClick={handleOpenSaveModal}
            disabled={atoms.length === 0}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 text-xs font-medium transition disabled:opacity-40"
            title="현재 그린 분자를 내 보관함에 이름 붙여 저장"
          >
            <BookmarkPlus size={13} />
            <span className="hidden sm:inline">스케치 저장</span>
          </button>

          {/* 내 보관함 열기 */}
          <button
            onClick={() => {
              setLibraryCategory("saved");
              setIsLibraryModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:text-white hover:bg-slate-800 transition"
            title="저장된 분자 보관함 목록 보기"
          >
            <Bookmark size={13} className="text-amber-400" />
            <span className="hidden sm:inline">내 보관함 ({savedMolecules.length})</span>
          </button>

          {/* SMILES 복사 */}
          <button
            onClick={handleCopySmiles}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:text-white hover:bg-slate-800 transition"
            title="SMILES 문자열 복사"
          >
            {copiedSmiles ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            <span className="hidden sm:inline">
              {copiedSmiles ? "복사됨!" : "SMILES"}
            </span>
          </button>

          {/* 뷰 모드 전환 버튼 (Split / 2D / 3D) */}
          <div className="flex items-center bg-slate-900 border border-slate-800 p-0.5 rounded-lg text-xs">
            <button
              onClick={() => setViewMode("2d")}
              className={`px-2 py-1 rounded text-xs font-medium transition flex items-center gap-1 ${
                viewMode === "2d" ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white"
              }`}
              title="2D 에디터만 보기"
            >
              <Square size={12} />
              <span className="hidden md:inline">2D</span>
            </button>
            <button
              onClick={() => setViewMode("split")}
              className={`px-2 py-1 rounded text-xs font-medium transition flex items-center gap-1 ${
                viewMode === "split" ? "bg-sky-500 text-white" : "text-slate-400 hover:text-white"
              }`}
              title="2D + 3D 나란히 보기"
            >
              <Columns size={12} />
              <span className="hidden md:inline">Split</span>
            </button>
            <button
              onClick={() => setViewMode("3d")}
              className={`px-2 py-1 rounded text-xs font-medium transition flex items-center gap-1 ${
                viewMode === "3d" ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white"
              }`}
              title="3D 뷰어만 보기"
            >
              <Box size={12} />
              <span className="hidden md:inline">3D</span>
            </button>
          </div>

          {/* 실행취소 & 초기화 */}
          <button
            onClick={handleUndo}
            disabled={history.length === 0}
            className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-white disabled:opacity-40 transition"
            title="실행 취소 (Undo)"
          >
            <RotateCcw size={14} />
          </button>
          <button
            onClick={handleClear}
            className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-rose-400 hover:border-rose-900 transition"
            title="캔버스 비우기"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────
          2. 실시간 유효성 경고 인라인 배너 (오류 발생 시 상단 고정 표출)
          ───────────────────────────────────────────────────────────── */}
      {!validation.isValid && (
        <div className="bg-rose-950/90 border-b border-rose-500/60 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-rose-200 shrink-0 shadow-lg">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <AlertTriangle size={15} className="text-rose-400 shrink-0 animate-bounce" />
            <span className="font-bold text-white shrink-0">
              [오류 경고] 화학적·기하학적 오류 ({validation.errors.length}건):
            </span>
            <span className="truncate text-rose-200 text-[11px]">
              {validation.errors.map((e) => e.message).join(" | ")}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleAutoFix}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition active:scale-95 cursor-pointer"
              title="비정상적인 원자가, 겹친 원자 및 이상 결합 길이를 화학적으로 자동 교정합니다."
            >
              <Wrench size={13} />
              <span>자동 오류 제거 (Auto-Fix)</span>
            </button>
            <button
              onClick={() => setIsValidationModalOpen(true)}
              className="rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-400/40 px-2.5 py-1 text-xs font-semibold transition"
            >
              상세 진단 리포트 →
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          3. 서브 툴바 (원소 선택 팔레트 + 메인 랩 반복단위 퀵 바)
          ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-1.5 bg-slate-950/60 border-b border-slate-800/80 text-xs shrink-0">
        {/* 원소(Elements) 퀵 선택기 */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            원소:
          </span>
          <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-lg border border-slate-800">
            {(["C", "O", "N", "H", "Cl", "F", "S"] as AtomSymbol[]).map((sym) => {
              const cfg = ATOM_CONFIG[sym];
              const isSelected = selectedAtomSymbol === sym;
              return (
                <button
                  key={sym}
                  onClick={() => {
                    setSelectedAtomSymbol(sym);
                    setActiveTool("atom");
                  }}
                  className={`px-2.5 py-0.5 rounded text-xs font-bold font-mono transition flex items-center gap-1 ${
                    isSelected
                      ? "bg-slate-700 text-white ring-2 ring-sky-400 shadow-sm"
                      : "text-slate-300 hover:bg-slate-800"
                  }`}
                  title={cfg.name}
                >
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: cfg.stroke }}
                  />
                  <span>{sym}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 우측 도구: 퀵 단량체 스탬프 + 치수선 토글 + 자동오류제거 퀵버튼 + 단량체 라이브러리 퀵 오픈 */}
        <div className="flex flex-wrap items-center gap-2">
          {/* 핵심 단량체 퀵 불러오기/조합 바 */}
          <div className="hidden lg:flex items-center gap-1 bg-slate-900/80 px-2 py-0.5 rounded-lg border border-slate-800">
            <span className="text-[10px] text-emerald-400 font-bold mr-1">단량체 퀵조합:</span>
            {["ethylene", "propylene", "styrene", "mma", "acrylonitrile", "terephthalic_acid"].map((mid) => {
              const mp = POPULAR_MOLECULES.find((m) => m.id === mid);
              if (!mp) return null;
              return (
                <button
                  key={mid}
                  type="button"
                  onClick={() => handleAppendMolecule(mp, true)}
                  className="px-2 py-0.5 rounded bg-slate-800/80 hover:bg-emerald-600/30 hover:text-emerald-200 text-slate-300 border border-slate-700/60 text-[10px] font-medium transition flex items-center gap-0.5"
                  title={`${mp.nameKo} (${mp.formula}) 단량체를 2D 캔버스에 추가/조합합니다 (Shift 없이 클릭 시 이어 붙이기)`}
                >
                  <Plus size={9} className="text-emerald-400" />
                  <span>{mp.nameKo.split(" ")[0]}</span>
                </button>
              );
            })}
          </div>

          {/* 치수선(결합 길이/각도) 토글 버튼 */}
          <button
            onClick={() => setShowDimensions((prev) => !prev)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition cursor-pointer ${
              showDimensions
                ? "bg-sky-500/20 border-sky-400/60 text-sky-300 shadow-sm shadow-sky-500/10"
                : "bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200"
            }`}
            title="결합 길이(Å) 및 결합 각도(°) 치수선 오버레이 켜기/끄기"
          >
            <Ruler size={13} className={showDimensions ? "text-sky-400" : "text-slate-400"} />
            <span>치수선 표시 {showDimensions ? "ON" : "OFF"}</span>
          </button>

          {!validation.isValid && (
            <button
              onClick={handleAutoFix}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition shadow-sm cursor-pointer"
              title="비정상적인 원자가, 중복 결합 및 결합 길이를 화학적으로 자동 교정합니다."
            >
              <Wrench size={12} />
              <span>자동 오류 제거</span>
            </button>
          )}

          <button
            onClick={() => {
              setLibraryCategory("monomer");
              setIsLibraryModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-400/40 text-xs font-bold shadow-sm transition cursor-pointer"
          >
            <Database size={13} />
            <span>단량체 라이브러리 불러오기 (3,284건 오픈DB + 49종)</span>
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          4. 메인 워크스페이스: 좌측 드로잉 툴바 + 2D Canvas + 3D Canvas
          ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 flex relative overflow-hidden">
        {/* 좌측 사이드바: 드로잉 도구 팔레트 (2D 모드 시에만 표시) */}
        {viewMode !== "3d" && (
          <aside className="w-14 shrink-0 bg-slate-950/80 border-r border-slate-800/80 p-2 flex flex-col items-center gap-2.5 z-10">
            {/* 단일 결합 */}
            <button
              onClick={() => setActiveTool("single")}
              className={`p-2.5 rounded-xl transition ${
                activeTool === "single"
                  ? "bg-sky-500 text-white shadow-md shadow-sky-500/20"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/70"
              }`}
              title="단일 결합 (C-C / 120° 지그재그 연장)"
            >
              <Minus size={18} />
            </button>

            {/* 이중 결합 */}
            <button
              onClick={() => setActiveTool("double")}
              className={`p-2.5 rounded-xl transition ${
                activeTool === "double"
                  ? "bg-sky-500 text-white shadow-md shadow-sky-500/20"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/70"
              }`}
              title="이중 결합 (C=C)"
            >
              <Equal size={18} />
            </button>

            {/* 삼중 결합 */}
            <button
              onClick={() => setActiveTool("triple")}
              className={`p-2.5 rounded-xl transition font-mono font-bold text-sm ${
                activeTool === "triple"
                  ? "bg-sky-500 text-white shadow-md shadow-sky-500/20"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/70"
              }`}
              title="삼중 결합 (C≡C)"
            >
              ≡
            </button>

            <div className="w-8 h-[1px] bg-slate-800 my-0.5" />

            {/* 벤젠 고리 스탬프 */}
            <button
              onClick={() => setActiveTool("benzene")}
              className={`p-2.5 rounded-xl transition text-xs font-bold ${
                activeTool === "benzene"
                  ? "bg-sky-500 text-white shadow-md shadow-sky-500/20"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/70"
              }`}
              title="벤젠 고리 스탬프 (클릭 시 6원환 방향족 생성)"
            >
              ⌬
            </button>

            {/* 사이클로펜틸 고리 스탬프 */}
            <button
              onClick={() => setActiveTool("cyclopentyl")}
              className={`p-2.5 rounded-xl transition text-xs font-bold ${
                activeTool === "cyclopentyl"
                  ? "bg-sky-500 text-white shadow-md shadow-sky-500/20"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/70"
              }`}
              title="5원환 고리 스탬프"
            >
              ⬠
            </button>

            <div className="w-8 h-[1px] bg-slate-800 my-0.5" />

            {/* 원자 이동 도구 */}
            <button
              onClick={() => setActiveTool("move")}
              className={`p-2.5 rounded-xl transition ${
                activeTool === "move"
                  ? "bg-sky-500 text-white shadow-md shadow-sky-500/20"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/70"
              }`}
              title="원자 개별 이동 (특정 원자 노드를 마우스로 드래그)"
            >
              <Move size={17} />
            </button>

            {/* 지우개 도구 */}
            <button
              onClick={() => setActiveTool("erase")}
              className={`p-2.5 rounded-xl transition ${
                activeTool === "erase"
                  ? "bg-rose-500 text-white shadow-md shadow-rose-500/20"
                  : "text-slate-400 hover:text-rose-400 hover:bg-slate-800/70"
              }`}
              title="지우개 (원자 또는 결합 클릭 시 삭제)"
            >
              <Eraser size={17} />
            </button>
          </aside>
        )}

        {/* 2D & 3D 뷰포트 영역 */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 relative">
          {/* 2D Editor */}
          {viewMode !== "3d" && (
            <div
              className={`relative h-full ${
                viewMode === "split" ? "w-full md:w-1/2 border-r border-slate-800" : "w-full"
              }`}
            >
              <MolDrawCanvas
                atoms={atoms}
                bonds={bonds}
                onAtomsChange={handleAtomsChange}
                onBondsChange={handleBondsChange}
                selectedAtomSymbol={selectedAtomSymbol}
                activeTool={activeTool}
                onSelectTool={setActiveTool}
                invalidAtomIds={validation.invalidAtomIds}
                invalidBondIds={validation.invalidBondIds}
                showDimensions={showDimensions}
                className="w-full h-full"
              />
            </div>
          )}

          {/* 3D Realtime Viewer & 3D Molecular Sketcher */}
          {viewMode !== "2d" && (
            <div
              className={`relative h-full ${
                viewMode === "split" ? "w-full md:w-1/2" : "w-full"
              }`}
            >
              <MolViewer3D
                atoms={atoms}
                bonds={bonds}
                onAtomsChange={handleAtomsChange}
                onBondsChange={handleBondsChange}
                selectedAtomSymbol={selectedAtomSymbol}
                showDimensions={showDimensions}
                onToggleDimensions={() => setShowDimensions((prev) => !prev)}
                className="w-full h-full"
              />
            </div>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          5. 템플릿 및 내 보관함 라이브러리 모달 팝업
          ───────────────────────────────────────────────────────────── */}
      {isLibraryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0b1220] border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* 모달 헤더 */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-slate-800/90 bg-slate-950/80">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-400/30">
                  <Database size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    단량체 & 오픈 데이터셋 라이브러리 불러오기
                  </h3>
                  <p className="text-xs text-slate-400">
                    3,284건 오픈 데이터셋, 베이스라인 30종 고분자 및 핵심 단량체를 검색해 2D 캔버스에 불러오거나 이어서 조합하세요.
                  </p>
                </div>
              </div>

              {/* 모달 내 실시간 검색창 */}
              <div className="flex items-center gap-2 flex-1 max-w-xs">
                <div className="relative flex-1">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={modalSearchQuery}
                    onChange={(e) => setModalSearchQuery(e.target.value)}
                    placeholder="스티렌, 에틸렌, 프로필렌, SMILES 검색..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-400"
                  />
                </div>
                <button
                  onClick={() => setIsLibraryModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* 카테고리 탭 및 백업 버튼 */}
            <div className="flex flex-wrap items-center justify-between px-6 py-2.5 border-b border-slate-800/60 bg-slate-950/40 text-xs gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => setLibraryCategory("monomer")}
                  className={`px-3 py-1.5 rounded-lg transition font-medium flex items-center gap-1.5 ${
                    libraryCategory === "monomer"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-white hover:bg-slate-900"
                  }`}
                >
                  <FlaskConical size={13} />
                  <span>단량체 & 반응물</span>
                </button>
                <button
                  onClick={() => setLibraryCategory("open_db")}
                  className={`px-3 py-1.5 rounded-lg transition font-bold flex items-center gap-1.5 ${
                    libraryCategory === "open_db"
                      ? "bg-teal-600 text-white shadow-sm"
                      : "text-teal-300/80 hover:text-white hover:bg-slate-900 border border-teal-500/30"
                  }`}
                >
                  <Database size={13} />
                  <span>오픈 데이터셋 (3,284건)</span>
                </button>
                <button
                  onClick={() => setLibraryCategory("polymer")}
                  className={`px-3 py-1.5 rounded-lg transition font-medium flex items-center gap-1.5 ${
                    libraryCategory === "polymer"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-white hover:bg-slate-900"
                  }`}
                >
                  <Layers size={13} />
                  <span>베이스라인 30종 ({MAIN_LAB_POLYMER_PRESETS.length})</span>
                </button>
                <button
                  onClick={() => setLibraryCategory("all")}
                  className={`px-3 py-1.5 rounded-lg transition font-medium ${
                    libraryCategory === "all"
                      ? "bg-sky-500 text-white shadow-sm"
                      : "text-slate-400 hover:text-white hover:bg-slate-900"
                  }`}
                >
                  전체 프리셋 ({POPULAR_MOLECULES.length})
                </button>
                <button
                  onClick={() => setLibraryCategory("saved")}
                  className={`px-3 py-1.5 rounded-lg transition font-medium flex items-center gap-1.5 ${
                    libraryCategory === "saved"
                      ? "bg-amber-500 text-white shadow-sm"
                      : "text-slate-400 hover:text-white hover:bg-slate-900"
                  }`}
                >
                  <Bookmark size={13} className="text-amber-300" />
                  <span>내 보관함 ({savedMolecules.length})</span>
                </button>
              </div>

              {/* JSON 가져오기/내보내기 백업 */}
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImportJson}
                  accept=".json"
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-900 border border-slate-800 transition"
                  title="저장된 JSON 분자 데이터 가져오기"
                >
                  <Upload size={12} />
                  <span>JSON 가져오기</span>
                </button>
                <button
                  onClick={handleExportJson}
                  className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-900 border border-slate-800 transition"
                  title="내 보관함 분자 데이터 JSON 다운로드"
                >
                  <Download size={12} />
                  <span>JSON 백업</span>
                </button>
              </div>
            </div>

            {/* 카드 그리드 목록 */}
            <div className="flex-1 overflow-y-auto p-6">
              {libraryCategory === "saved" ? (
                /* ── 내 저장 보관함 뷰 ── */
                savedMolecules.length === 0 ? (
                  <div className="text-center py-16 text-slate-400">
                    <Bookmark size={36} className="mx-auto mb-3 text-slate-600" />
                    <p className="font-semibold text-sm text-slate-300">저장된 커스텀 분자가 없습니다.</p>
                    <p className="text-xs text-slate-500 mt-1">
                      원하는 분자를 스케치한 후 상단의 [스케치 저장] 버튼을 누르면 여기에 영구 보관됩니다.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {savedMolecules.map((saved) => (
                      <div
                        key={saved.id}
                        className="group relative p-3.5 rounded-xl border border-amber-500/20 bg-slate-900/80 hover:bg-slate-800/90 hover:border-amber-400/50 transition flex flex-col justify-between gap-2 shadow-sm"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-bold text-xs text-amber-200 group-hover:text-amber-100">
                              {saved.name}
                            </span>
                            <span className="text-[10px] font-mono text-sky-400 bg-sky-950/70 border border-sky-800/60 px-1.5 py-0.5 rounded shrink-0">
                              {saved.monomerMW} g/mol
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                            화학식: {saved.formula}
                          </div>
                          {saved.description && (
                            <p className="text-[11px] text-slate-400 line-clamp-2 mt-1.5">
                              {saved.description}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[10px] text-slate-400">
                          <span className="font-mono">원자 {saved.atoms.length} / 결합 {saved.bonds.length}</span>
                          <div className="flex items-center gap-2">
                            {deleteConfirmId === saved.id ? (
                              <div
                                className="flex items-center gap-1 rounded-lg bg-rose-950/90 border border-rose-500/60 p-0.5"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <span className="text-[9px] font-bold text-rose-300 px-1">삭제?</span>
                                <button
                                  type="button"
                                  onClick={(e) => handleDeleteSaved(e, saved.id, saved.name)}
                                  className="rounded bg-rose-600 hover:bg-rose-500 text-white px-1.5 py-0.5 text-[9px] font-bold transition shadow-sm"
                                >
                                  확인
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    setDeleteConfirmId(null);
                                  }}
                                  className="rounded bg-slate-800 hover:bg-slate-700 text-slate-300 px-1.5 py-0.5 text-[9px] transition"
                                >
                                  취소
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  setDeleteConfirmId(saved.id);
                                }}
                                className="flex items-center gap-1 rounded bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/30 px-2 py-0.5 text-[10px] text-rose-300 hover:text-rose-200 transition"
                                title="보관함에서 삭제"
                              >
                                <Trash2 size={11} />
                                <span>삭제</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleLoadMolecule(saved)}
                              className="text-amber-400 group-hover:underline font-bold"
                            >
                              불러오기 →
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                /* ── 기본 프리셋 & 3,284건 오픈 데이터셋 목록 ── */
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredLibraryPresets.map((preset) => (
                    <div
                      key={preset.id}
                      className="group relative p-3.5 rounded-xl border border-slate-800/80 bg-slate-900/60 hover:bg-slate-800/80 hover:border-sky-500/50 transition flex flex-col justify-between gap-2 shadow-sm"
                    >
                      <div
                        onClick={() => handleLoadMolecule(preset)}
                        className="cursor-pointer"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-semibold text-xs text-slate-100 group-hover:text-sky-300 transition">
                            {preset.nameKo}
                          </span>
                          <span className="text-[10px] font-mono text-sky-400 bg-sky-950/70 border border-sky-800/60 px-1.5 py-0.5 rounded shrink-0">
                            {preset.mw} g/mol
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">
                          {preset.name} · {preset.formula}
                        </div>
                        <p className="text-[11px] text-slate-500 line-clamp-2 mt-1.5">
                          {preset.description}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-[10px] text-slate-400 gap-1">
                        <span className="font-mono">원자 {preset.atoms.length} / 결합 {preset.bonds.length}</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleLoadMolecule(preset)}
                            className="px-2 py-0.5 rounded bg-sky-500/20 hover:bg-sky-500 text-sky-300 hover:text-white border border-sky-500/40 font-semibold transition"
                          >
                            단독 로드
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAppendMolecule(preset, true)}
                            className="px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-white border border-emerald-500/40 font-semibold transition flex items-center gap-0.5"
                            title="현재 캔버스에 있는 구조 옆에 이어 붙여 공중합/조합합니다"
                          >
                            <Plus size={10} />
                            <span>조합 추가</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          6. 화학적 유효성 진단 상세 모달 (Validation Diagnostic Modal)
          ───────────────────────────────────────────────────────────── */}
      {isValidationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0b1220] border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* 헤더 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/90 bg-slate-950/90">
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-xl border ${
                    validation.isValid
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-400/30"
                      : "bg-rose-500/20 text-rose-400 border-rose-400/30"
                  }`}
                >
                  {validation.isValid ? <ShieldCheck size={20} /> : <ShieldAlert size={20} />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>화학 구조 유효성 정밀 검증 리포트</span>
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                        validation.isValid
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/30"
                          : "bg-rose-500/20 text-rose-300 border-rose-400/30"
                      }`}
                    >
                      {validation.isValid ? "통과 (Valid)" : `오류 ${validation.errors.length}건 차단`}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    옥텟 원자가 규칙(Valence Rule) 및 공유 결합 길이·각도 기하구조 실시간 해석
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsValidationModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* 본문 */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* 요약 통계 그리드 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-xs">
                <div>
                  <span className="text-slate-400 text-[11px] block">총 원자 / 결합</span>
                  <strong className="text-white font-mono text-sm">
                    {validation.stats.totalAtoms}개 / {validation.stats.totalBonds}개
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">평균 결합 길이</span>
                  <strong className="text-sky-300 font-mono text-sm">
                    {validation.stats.avgBondLengthPx}px (~{validation.stats.avgBondLengthAngstrom}Å)
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">화학적 오류</span>
                  <strong
                    className={`font-mono text-sm ${
                      validation.errors.length === 0 ? "text-emerald-400" : "text-rose-400 font-bold"
                    }`}
                  >
                    {validation.errors.length}건
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">기하학적 경고</span>
                  <strong className="text-amber-400 font-mono text-sm">
                    {validation.warnings.length}건
                  </strong>
                </div>
              </div>

              {/* 오류 목록 */}
              {validation.errors.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                    <AlertTriangle size={14} />
                    <span>해결해야 할 화학적 오류 (차단 원인)</span>
                  </h4>
                  {validation.errors.map((err) => (
                    <div
                      key={err.id}
                      className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-xs space-y-1"
                    >
                      <div className="font-bold text-rose-200 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                        <span>{err.title}</span>
                      </div>
                      <p className="text-rose-300 leading-relaxed">{err.message}</p>
                      <p className="text-[11px] text-slate-400 border-t border-rose-900/40 pt-1 mt-1">
                        💡 <strong>화학적 설명:</strong> {err.details}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* 경고 목록 */}
              {validation.warnings.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                    <Info size={14} />
                    <span>구조 최적화 권고 사항 (Warnings)</span>
                  </h4>
                  {validation.warnings.map((warn) => (
                    <div
                      key={warn.id}
                      className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/30 text-xs space-y-1"
                    >
                      <div className="font-semibold text-amber-200 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        <span>{warn.title}</span>
                      </div>
                      <p className="text-amber-300/90">{warn.message}</p>
                      <p className="text-[11px] text-slate-400">{warn.details}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* 스마트 자동 오류 제거 (Auto-Fix) 액션 박스 */}
              {(!validation.isValid || validation.warnings.length > 0) && (
                <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-950/70 via-slate-900 to-sky-950/70 border border-amber-500/40 flex flex-wrap items-center justify-between gap-3 shadow-lg">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/40 shrink-0">
                      <Sparkles size={16} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>화학적 1-클릭 스마트 자동 교정 (Auto-Fix)</span>
                        <span className="text-[10px] px-1.5 py-0.2 bg-amber-500/20 text-amber-300 rounded font-normal">
                          Rule-based Engine
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        초과 원자가 해소, 비정상적 결합 길이 표준화(1.50Å), 겹친 원자 분리를 즉시 수행합니다.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleAutoFix}
                    className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 shrink-0 flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                  >
                    <Wrench size={14} />
                    <span>자동 오류 제거 실행</span>
                  </button>
                </div>
              )}

              {/* 통과 상태 */}
              {validation.isValid && (
                <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-xs text-emerald-200 flex items-start gap-3">
                  <CheckCircle2 size={18} className="text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-bold text-sm text-emerald-300">
                      화학적 유효성 검증을 완벽히 통과했습니다!
                    </h5>
                    <p className="text-slate-300 mt-1 leading-relaxed">
                      모든 원자의 원자가(Valence)가 옥텟 규칙 한도 이내이며, 결합 길이 및 3원자 각도가 실제 공유 결합 범주에 부합합니다.
                      하단의 <strong>'메인 랩에 적용'</strong> 버튼을 눌러 3D 시뮬레이션 및 물성 대리 모델 추론을 진행하실 수 있습니다.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* 풋터 */}
            <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
              {!validation.isValid ? (
                <button
                  onClick={handleAutoFix}
                  className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Wrench size={13} />
                  <span>지금 자동 교정 적용</span>
                </button>
              ) : (
                <div />
              )}
              <button
                onClick={() => setIsValidationModalOpen(false)}
                className="px-4 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-white font-semibold text-xs transition"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          7. 커스텀 분자 스케치 저장 모달 (Save Molecule Modal)
          ───────────────────────────────────────────────────────────── */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#0b1220] border border-slate-700 rounded-2xl w-full max-w-md p-5 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <BookmarkPlus size={18} className="text-amber-400" />
                <span>커스텀 분자 스케치 보관함 저장</span>
              </h3>
              <button
                onClick={() => setIsSaveModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-medium block mb-1">
                  분자 명칭 (필수)
                </label>
                <input
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder={`예: 내 커스텀 ${descriptor.formula}`}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-sky-500 text-xs"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">
                  설명 / 연구 메모 (선택)
                </label>
                <textarea
                  value={saveDescription}
                  onChange={(e) => setSaveDescription(e.target.value)}
                  rows={3}
                  placeholder="단량체 합성 기전, 목표 KES 물성 또는 반응 조건 메모..."
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-sky-500 text-xs resize-none"
                />
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900/80 border border-white/5 text-[11px] text-slate-400 space-y-1">
                <div className="flex justify-between">
                  <span>분자식:</span>
                  <strong className="text-sky-300 font-mono">{descriptor.formula}</strong>
                </div>
                <div className="flex justify-between">
                  <span>단량체 분자량:</span>
                  <strong className="text-slate-200 font-mono">{descriptor.monomerMW} g/mol</strong>
                </div>
                <div className="flex justify-between">
                  <span>원자 / 결합 수:</span>
                  <strong className="text-slate-200 font-mono">
                    {atoms.length}개 / {bonds.length}개
                  </strong>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                onClick={() => setIsSaveModalOpen(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs"
              >
                취소
              </button>
              <button
                onClick={handleConfirmSave}
                disabled={!saveName.trim()}
                className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-sky-500 hover:from-amber-400 hover:to-sky-400 text-white font-bold text-xs disabled:opacity-40 transition"
              >
                저장 완료
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          8. 하단 정보 인스펙터 & 물성 대리 모델(Surrogate) 연동 바
          ───────────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-800/90 bg-slate-950/95 px-4 py-3 flex flex-col gap-2.5 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* 분자 특성값 요약 */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">분자식:</span>
              <span className="font-bold text-sky-300 font-mono text-sm">
                {descriptor.formula}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">분자량(MW):</span>
              <span className="font-semibold text-slate-200 font-mono">
                {descriptor.monomerMW} g/mol
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">이중결합 비율:</span>
              <span className="font-semibold text-amber-300 font-mono">
                {(descriptor.doubleBondRatio * 100).toFixed(0)}%
              </span>
            </div>
            <div className="hidden lg:flex items-center gap-1.5">
              <span className="text-slate-400">사슬 강직도:</span>
              <span className="font-semibold text-indigo-300 font-mono">
                {(descriptor.rigidityScore * 100).toFixed(0)}%
              </span>
            </div>
          </div>

          {/* 대리 모델 연동 수치 프리뷰 및 메인 적용 버튼 */}
          <div className="flex items-center gap-3">
            {validation.isValid ? (
              <div className="hidden sm:flex items-center gap-3 bg-slate-900 border border-slate-800 px-3 py-1 rounded-lg text-[11px]">
                <span className="text-slate-400">
                  인장강도: <strong className="text-emerald-400">{surrogateResult.physical.tenacity} g/d</strong>
                </span>
                <span>·</span>
                <span className="text-slate-400">
                  굽힘 강성(B): <strong className="text-sky-300">{surrogateResult.kes.B}</strong>
                </span>
                <span>·</span>
                <span className="text-slate-400">
                  염색성: <strong className="text-rose-400">{surrogateResult.dyeability.grade} ({surrogateResult.dyeability.score}점)</strong>
                </span>
              </div>
            ) : (
              <div
                onClick={() => setIsValidationModalOpen(true)}
                className="hidden sm:flex items-center gap-1.5 bg-rose-950/70 border border-rose-500/50 px-3 py-1 rounded-lg text-[11px] text-rose-300 cursor-pointer hover:bg-rose-900/80 transition"
                title="클릭하여 오류 상세 진단 확인"
              >
                <ShieldAlert size={13} className="text-rose-400" />
                <span className="font-semibold">대리 모델 예측 일시 중지 (비현실적 분자 오류)</span>
              </div>
            )}

            {onApplyToMainModel && (
              <button
                onClick={() => {
                  if (!validation.isValid) {
                    setIsValidationModalOpen(true);
                    return;
                  }
                  const customPolymer = createPolymerFromSketch(atoms, bonds, descriptor);
                  onApplyToMainModel({
                    polymer: customPolymer,
                    descriptor,
                    atoms,
                    bonds,
                  });
                }}
                disabled={atoms.length === 0 || !validation.isValid}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition ${
                  validation.isValid && atoms.length > 0
                    ? "bg-sky-500 hover:bg-sky-400 text-white cursor-pointer"
                    : "bg-rose-950/70 border border-rose-600/60 text-rose-300 cursor-not-allowed opacity-80"
                }`}
                title={
                  !validation.isValid
                    ? "화학적 오류(원자가/결합 길이 위반)가 있어 대리 모델에 적용할 수 없습니다. 오류를 해결하세요."
                    : "스케치한 분자 구조를 메인 랩 3D 시뮬레이션에 즉시 적용"
                }
              >
                {validation.isValid ? <CheckCircle2 size={13} /> : <ShieldAlert size={13} />}
                <span>
                  {validation.isValid ? "메인 랩에 적용" : `오류 해결 필요 (${validation.errors.length}건)`}
                </span>
              </button>
            )}

            {onClose && (
              <button
                onClick={onClose}
                className="px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs transition"
              >
                닫기
              </button>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
};
