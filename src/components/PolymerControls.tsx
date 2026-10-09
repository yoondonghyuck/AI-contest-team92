import { useState, useMemo } from "react";
import {
  Search,
  Hash,
  FlaskConical,
  Plus,
  Minus,
  Check,
  Zap,
  Dna,
  ChevronDown,
} from "lucide-react";
import {
  POLYMER_DATABASE,
  findPolymer,
  type PolymerDefinition,
} from "../model/polymers";

interface PolymerControlsProps {
  currentPolymer: PolymerDefinition;
  onSelectPolymer: (polymer: PolymerDefinition) => void;
  repeatCount: number;
  onRepeatCountChange: (count: number) => void;
  molecularWeight: number;
  onMolecularWeightChange: (mw: number) => void;
}

type CategoryFilter = "ALL" | "HOMO" | "COPOLY" | "THERMOSET" | "SPECIAL";

export function PolymerControls({
  currentPolymer,
  onSelectPolymer,
  repeatCount,
  onRepeatCountChange,
  molecularWeight,
  onMolecularWeightChange,
}: PolymerControlsProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>("ALL");

  // 카테고리별 필터링
  const filteredPolymers = useMemo(() => {
    if (selectedCategory === "HOMO") {
      return POLYMER_DATABASE.filter((p) => p.category.includes("단일"));
    }
    if (selectedCategory === "COPOLY") {
      return POLYMER_DATABASE.filter((p) => p.category.includes("공중합체"));
    }
    if (selectedCategory === "THERMOSET") {
      return POLYMER_DATABASE.filter((p) => p.category.includes("열경화성"));
    }
    if (selectedCategory === "SPECIAL") {
      return POLYMER_DATABASE.filter((p) => p.category.includes("특수"));
    }
    return POLYMER_DATABASE;
  }, [selectedCategory]);

  // 검색어 입력 핸들러
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (!value.trim()) {
      setInputError(null);
      return;
    }
    const matched = findPolymer(value);
    if (matched) {
      onSelectPolymer(matched);
      // 고분자 변경 시 기본값 n = 1로 설정
      onRepeatCountChange(1);
      onMolecularWeightChange(matched.monomerMW);
      setInputError(null);
    } else {
      setInputError(`'${value}'을(를) 찾을 수 없습니다. 아래 30종 고분자 목록을 확인하세요.`);
    }
  };

  // 프리셋 고분자 선택 (기본값 n = 1)
  const handleSelectPolymer = (p: PolymerDefinition) => {
    setSearchQuery(p.shortName);
    onSelectPolymer(p);
    onRepeatCountChange(1);
    onMolecularWeightChange(p.monomerMW);
    setInputError(null);
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

  return (
    <div className="border-b border-white/10 bg-slate-900/90 px-4 py-2.5 backdrop-blur-md">
      {/* ─────────────────────────────────────────────────────────────
          1행: 고분자 드롭다운/검색 + 분자량(Mw)/n 컨트롤러 + Mw 등급 칩
          ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* 고분자 선택 드롭다운 & 텍스트 검색 통합 */}
        <div className="flex flex-1 min-w-[320px] items-center gap-2">
          {/* 30종 고분자 빠른 드롭다운 선택 */}
          <div className="relative">
            <select
              value={currentPolymer.id}
              onChange={(e) => {
                const p = POLYMER_DATABASE.find((item) => item.id === e.target.value);
                if (p) handleSelectPolymer(p);
              }}
              className="appearance-none rounded-lg border border-sky-500/30 bg-slate-950 py-1.5 pl-3 pr-8 text-xs font-semibold text-sky-200 focus:border-sky-400 focus:outline-none cursor-pointer"
            >
              {currentPolymer.id === "custom_mol" && (
                <option value="custom_mol">
                  ⭐ {currentPolymer.koreanName}
                </option>
              )}
              <optgroup label="[A. 범용·공학용 단일 고분자]">
                {POLYMER_DATABASE.filter((p) => p.category.includes("단일")).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.shortName} · {p.koreanName.split(" ")[0]}
                  </option>
                ))}
              </optgroup>
              <optgroup label="[B. 공중합체 & 사슬 구조]">
                {POLYMER_DATABASE.filter((p) => p.category.includes("공중합체")).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.shortName} · {p.koreanName.split(" ")[0]}
                  </option>
                ))}
              </optgroup>
              <optgroup label="[C. 열경화성 수지]">
                {POLYMER_DATABASE.filter((p) => p.category.includes("열경화성")).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.shortName} · {p.koreanName.split(" ")[0]}
                  </option>
                ))}
              </optgroup>
              <optgroup label="[D. 특수 구조 & 기능성]">
                {POLYMER_DATABASE.filter((p) => p.category.includes("특수")).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.shortName} · {p.koreanName.split(" ")[0]}
                  </option>
                ))}
              </optgroup>
            </select>
            <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>

          {/* 텍스트 검색 입력창 */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="고분자명·약어·IUPAC명 검색 (예: PET, Nylon 66, HIPS, Epoxy...)"
              className="w-full rounded-lg border border-white/15 bg-black/40 py-1.5 pl-8 pr-3 text-xs text-white placeholder-slate-500 focus:border-sky-400 focus:outline-none"
            />
            {inputError && (
              <p className="absolute left-0 -bottom-4 text-[10px] text-amber-400">
                {inputError}
              </p>
            )}
          </div>
        </div>

        {/* 반복단위 n (기본값 1) & 분자량 Mw 조절 바 */}
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/40 p-1">
          {/* 중합도 n (기본값: 1) */}
          <div className="flex items-center gap-1.5 px-2">
            <Hash size={13} className="text-sky-400" />
            <span className="text-xs text-slate-300 font-medium">반복수(n):</span>
            <input
              type="number"
              min={1}
              max={50000}
              value={repeatCount}
              onChange={(e) => handleRepeatChange(Number(e.target.value))}
              className="w-16 rounded border border-white/15 bg-slate-900 px-1 py-0.5 text-center font-mono text-xs font-bold text-sky-300 focus:border-sky-400 focus:outline-none"
            />
          </div>

          <div className="h-4 w-[1px] bg-white/15" />

          {/* 분자량 Mw (g/mol) */}
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
              className="w-24 rounded border border-white/15 bg-slate-900 px-1 py-0.5 text-center font-mono text-xs font-bold text-emerald-300 focus:border-emerald-400 focus:outline-none"
            />
            <span className="text-[10px] text-slate-400">g/mol</span>
          </div>

          <div className="h-4 w-[1px] bg-white/15" />

          {/* 증감 버튼 */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => handleRepeatChange(Math.max(1, repeatCount - 1))}
              disabled={repeatCount <= 1}
              className="flex h-6 w-6 items-center justify-center rounded bg-slate-800 text-slate-300 transition hover:bg-slate-700 disabled:opacity-40"
              title="1단위 감소"
            >
              <Minus size={11} />
            </button>
            <button
              onClick={() => handleRepeatChange(repeatCount + 1)}
              className="flex h-6 w-6 items-center justify-center rounded bg-slate-800 text-slate-300 transition hover:bg-slate-700"
              title="1단위 증가"
            >
              <Plus size={11} />
            </button>
          </div>
        </div>

        {/* Mw 프리셋 버튼 */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-slate-400 mr-1 flex items-center gap-0.5">
            <Zap size={10} className="text-amber-400" />
            Mw 스케일:
          </span>
          <button
            onClick={() => handleRepeatChange(1)}
            className={`rounded px-2 py-0.5 text-[10px] font-semibold transition ${
              repeatCount === 1
                ? "bg-sky-500 text-white shadow-sm"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            기본단위(n=1)
          </button>
          <button
            onClick={() => handleMwChange(50000)}
            className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300 hover:bg-slate-700 transition"
          >
            표준(~5만)
          </button>
          <button
            onClick={() => handleMwChange(280000)}
            className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-200 hover:bg-amber-500/20 transition"
          >
            고분자량(28만)
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2행: 30종 고분자 카테고리 탭 & 칩 목록 (db.md 4대 카테고리)
          ───────────────────────────────────────────────────────────── */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-white/5 pt-2">
        {/* 카테고리 필터 버튼 그룹 */}
        <div className="flex items-center gap-1 mr-2 border-r border-white/10 pr-2">
          <button
            onClick={() => setSelectedCategory("ALL")}
            className={`rounded-md px-2 py-0.5 text-[10px] font-semibold transition ${
              selectedCategory === "ALL"
                ? "bg-white/20 text-white"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            전체(30)
          </button>
          <button
            onClick={() => setSelectedCategory("HOMO")}
            className={`rounded-md px-2 py-0.5 text-[10px] font-semibold transition ${
              selectedCategory === "HOMO"
                ? "bg-sky-500/30 text-sky-200 border border-sky-400/40"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            A.단일(11)
          </button>
          <button
            onClick={() => setSelectedCategory("COPOLY")}
            className={`rounded-md px-2 py-0.5 text-[10px] font-semibold transition ${
              selectedCategory === "COPOLY"
                ? "bg-purple-500/30 text-purple-200 border border-purple-400/40"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            B.공중합체(10)
          </button>
          <button
            onClick={() => setSelectedCategory("THERMOSET")}
            className={`rounded-md px-2 py-0.5 text-[10px] font-semibold transition ${
              selectedCategory === "THERMOSET"
                ? "bg-amber-500/30 text-amber-200 border border-amber-400/40"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            C.열경화성(5)
          </button>
          <button
            onClick={() => setSelectedCategory("SPECIAL")}
            className={`rounded-md px-2 py-0.5 text-[10px] font-semibold transition ${
              selectedCategory === "SPECIAL"
                ? "bg-emerald-500/30 text-emerald-200 border border-emerald-400/40"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            D.특수구조(4)
          </button>
        </div>

        {/* 필터링된 고분자 칩 목록 */}
        <div className="flex flex-wrap items-center gap-1 max-h-[38px] overflow-y-auto">
          {currentPolymer.id === "custom_mol" && (
            <span className="inline-flex items-center gap-1 rounded px-2.5 py-0.5 text-[11px] border border-amber-400 bg-amber-500/30 font-bold text-amber-200 shadow-sm shadow-amber-500/30">
              <Check size={10} className="text-amber-300" />
              <span>⭐ {currentPolymer.shortName}</span>
              <span className="text-[9px] text-amber-300">(스케치 분자)</span>
            </span>
          )}
          {filteredPolymers.map((p) => {
            const isSelected = p.id === currentPolymer.id;
            return (
              <button
                key={p.id}
                onClick={() => handleSelectPolymer(p)}
                className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] transition-all ${
                  isSelected
                    ? "border border-sky-400/90 bg-sky-500/30 font-bold text-sky-100 shadow-sm shadow-sky-500/30"
                    : "border border-white/10 bg-slate-800/80 text-slate-300 hover:border-slate-500 hover:bg-slate-700"
                }`}
              >
                {isSelected && <Check size={10} className="text-sky-300" />}
                <span>{p.shortName}</span>
                <span className="text-[9px] text-slate-400">({p.koreanName.split(" ")[0]})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3행: 선택된 고분자 화학 구조 세부 정보 바 (IUPAC, SMILES, 구조 분류)
          ───────────────────────────────────────────────────────────── */}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-black/40 border border-white/10 px-3 py-1.5 text-[11px]">
        <div className="flex flex-wrap items-center gap-2 text-slate-300">
          <div className="flex items-center gap-1 font-semibold text-white">
            <Dna size={12} className="text-sky-400" />
            <span>{currentPolymer.koreanName}</span>
          </div>

          {currentPolymer.iupacName && (
            <span className="text-[10px] text-slate-400 font-mono border-l border-white/10 pl-2">
              IUPAC: <span className="text-sky-200">{currentPolymer.iupacName}</span>
            </span>
          )}

          {currentPolymer.rawName && (
            <span className="text-[10px] text-slate-400 font-mono border-l border-white/10 pl-2">
              원료: <span className="text-purple-200">{currentPolymer.rawName}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-[10px]">
          <span className="rounded bg-sky-500/20 text-sky-300 px-1.5 py-0.2 border border-sky-500/30">
            {currentPolymer.category.split(" ")[0]}
          </span>
          <span className="rounded bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 border border-emerald-500/30">
            {currentPolymer.chainArchitecture}
          </span>
          <span className="font-mono text-amber-300">
            밀도: {currentPolymer.density} g/cm³ | Tg: {currentPolymer.tg}℃
          </span>
        </div>
      </div>
    </div>
  );
}
