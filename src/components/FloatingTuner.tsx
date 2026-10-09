import {
  SlidersHorizontal,
  X,
  Layers,
  FlaskConical,
  Ruler,
  CircleDot,
  Dna,
} from "lucide-react";
import type { CrossSectionShape, FiberInputs } from "../types";
import { POLYMER_DATABASE, type PolymerDefinition } from "../model/polymers";

interface Props {
  inputs: FiberInputs;
  onChange: (next: FiberInputs) => void;
  isOpen: boolean;
  onToggle: () => void;
  currentPolymer?: PolymerDefinition;
  onSelectPolymer?: (p: PolymerDefinition) => void;
}

const SHAPES: CrossSectionShape[] = ["circular", "trilobal", "hollow"];

export function FloatingTuner({
  inputs,
  onChange,
  isOpen,
  onToggle,
  currentPolymer,
  onSelectPolymer,
}: Props) {
  const set = <K extends keyof FiberInputs>(key: K, value: FiberInputs[K]) => {
    onChange({ ...inputs, [key]: value });
  };

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="flex items-center gap-2 rounded-xl border border-sky-400/40 bg-slate-900/90 px-3.5 py-2 text-xs font-semibold text-sky-200 shadow-2xl backdrop-blur-md transition-all hover:bg-sky-500/20 hover:border-sky-400 active:scale-95"
      >
        <SlidersHorizontal size={14} className="text-sky-400" />
        <span>미세 변수 튜너</span>
        <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] text-sky-300">
          {currentPolymer ? `${currentPolymer.shortName} · ` : ""}결정화도 {(inputs.crystallinity * 100).toFixed(0)}% · Mw {(inputs.molecularWeight / 1000).toFixed(0)}k
        </span>
      </button>
    );
  }

  return (
    <div className="w-[320px] rounded-2xl border border-white/20 bg-slate-950/95 p-4 shadow-2xl backdrop-blur-xl transition-all">
      {/* 튜너 헤더 */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-sky-500/20 text-sky-400">
            <SlidersHorizontal size={13} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white">미세 변수 실시간 튜너</h3>
            <p className="text-[10px] text-slate-400">3D 구조 & 염색성 실시간 연동</p>
          </div>
        </div>
        <button
          onClick={onToggle}
          className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white"
        >
          <X size={14} />
        </button>
      </div>

      {/* 슬라이더 및 선택자 목록 */}
      <div className="mt-3 space-y-3 max-h-[60vh] overflow-y-auto pr-1">
        {/* 0. 30종 고분자 빠른 전환 셀렉터 */}
        {currentPolymer && onSelectPolymer && (
          <div className="rounded-xl border border-sky-500/30 bg-sky-950/40 p-2.5">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="flex items-center gap-1.5 font-bold text-sky-200">
                <Dna size={13} className="text-sky-400" />
                고분자 선택 (30종)
              </span>
              <span className="text-[10px] text-sky-300 font-mono">
                {currentPolymer.shortName}
              </span>
            </div>
            <select
              value={currentPolymer.id}
              onChange={(e) => {
                const found = POLYMER_DATABASE.find((p) => p.id === e.target.value);
                if (found) onSelectPolymer(found);
              }}
              className="w-full rounded-lg border border-sky-400/40 bg-slate-900 py-1.5 px-2 text-xs font-medium text-white focus:border-sky-400 focus:outline-none cursor-pointer"
            >
              <optgroup label="[A. 범용·공학용 단일 고분자 (11종)]">
                {POLYMER_DATABASE.filter((p) => p.category.includes("단일")).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.shortName} · {p.koreanName.split(" ")[0]}
                  </option>
                ))}
              </optgroup>
              <optgroup label="[B. 공중합체 & 사슬구조 (10종)]">
                {POLYMER_DATABASE.filter((p) => p.category.includes("공중합체")).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.shortName} · {p.koreanName.split(" ")[0]}
                  </option>
                ))}
              </optgroup>
              <optgroup label="[C. 열경화성 수지 (5종)]">
                {POLYMER_DATABASE.filter((p) => p.category.includes("열경화성")).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.shortName} · {p.koreanName.split(" ")[0]}
                  </option>
                ))}
              </optgroup>
              <optgroup label="[D. 특수 구조 & 기능성 (4종)]">
                {POLYMER_DATABASE.filter((p) => p.category.includes("특수")).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.shortName} · {p.koreanName.split(" ")[0]}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
        )}
        {/* 1. 결정화도 */}
        <label className="block">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-slate-200 font-medium">
              <Layers size={13} className="text-sky-400" />
              결정화도 (Crystallinity)
            </span>
            <span className="font-mono font-bold text-sky-300">
              {(inputs.crystallinity * 100).toFixed(0)}%
            </span>
          </div>
          <input
            type="range"
            min={20}
            max={90}
            step={1}
            value={inputs.crystallinity * 100}
            onChange={(e) => set("crystallinity", Number(e.target.value) / 100)}
            className="mt-1 h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 accent-sky-400"
          />
          <div className="flex justify-between text-[9px] text-slate-500 mt-0.5">
            <span>20% (비정질·염색↑)</span>
            <span>90% (라멜라 결정·강도↑)</span>
          </div>
        </label>

        {/* 2. 분자량 Mw */}
        <label className="block">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-slate-200 font-medium">
              <FlaskConical size={13} className="text-emerald-400" />
              분자량 (Mw)
            </span>
            <span className="font-mono font-bold text-emerald-300">
              {Math.round(inputs.molecularWeight).toLocaleString()} <span className="text-[10px] text-slate-400 font-normal">g/mol</span>
            </span>
          </div>
          <input
            type="range"
            min={10000}
            max={600000}
            step={5000}
            value={inputs.molecularWeight}
            onChange={(e) => set("molecularWeight", Number(e.target.value))}
            className="mt-1 h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 accent-emerald-400"
          />
          <div className="flex justify-between text-[9px] text-slate-500 mt-0.5">
            <span>1만 (올리고머)</span>
            <span>28만 (일반)</span>
            <span>60만 (초고분자량)</span>
          </div>
        </label>

        {/* 3. 섬도 Denier */}
        <label className="block">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-slate-200 font-medium">
              <Ruler size={13} className="text-purple-400" />
              섬도 (Denier)
            </span>
            <span className="font-mono font-bold text-purple-300">
              {inputs.denier.toFixed(1)} <span className="text-[10px] text-slate-400 font-normal">D</span>
            </span>
          </div>
          <input
            type="range"
            min={0.5}
            max={10.0}
            step={0.1}
            value={inputs.denier}
            onChange={(e) => set("denier", Number(e.target.value))}
            className="mt-1 h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 accent-purple-400"
          />
          <div className="flex justify-between text-[9px] text-slate-500 mt-0.5">
            <span>0.5D (마이크로극세사)</span>
            <span>10.0D (태데니어)</span>
          </div>
        </label>

        {/* 4. 단면 형상 및 이형도 */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="flex items-center gap-1.5 text-slate-200 font-medium">
              <CircleDot size={13} className="text-amber-400" />
              단면 형상 (Cross-section)
            </span>
            <span className="text-[10px] text-sky-300 font-mono">
              이형도 {inputs.modificationRatio?.toFixed(1) || 1.8}x
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {SHAPES.map((shape) => {
              const active = inputs.shape === shape;
              return (
                <button
                  key={shape}
                  type="button"
                  onClick={() => set("shape", shape)}
                  className={`rounded-lg py-1.5 px-1 text-center text-[11px] transition ${
                    active
                      ? "border border-sky-400 bg-sky-500/25 font-bold text-sky-200 shadow-sm"
                      : "border border-white/10 bg-slate-900/60 text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {shape === "circular" ? "원형" : shape === "trilobal" ? "삼엽형✨" : "중공형"}
                </button>
              );
            })}
          </div>

          {/* 단면 이형도/중공률 슬라이더 */}
          <div className="mt-2 rounded-lg bg-black/30 p-2">
            <div className="flex items-center justify-between text-[11px] text-slate-300">
              <span>{inputs.shape === "trilobal" ? "삼엽 이형도 (MR)" : inputs.shape === "hollow" ? "중공율 (Hollow %)" : "변형비 (MR)"}</span>
              <span className="font-mono text-amber-300 font-bold">
                {inputs.shape === "hollow" ? `${Math.round((inputs.modificationRatio || 1.8) * 15)}%` : `${(inputs.modificationRatio || 1.8).toFixed(1)}x`}
              </span>
            </div>
            <input
              type="range"
              min={1.0}
              max={3.0}
              step={0.1}
              value={inputs.modificationRatio || 1.8}
              onChange={(e) => set("modificationRatio", Number(e.target.value))}
              className="mt-1 h-1 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 accent-amber-400"
            />
          </div>
        </div>

        {/* 5. 방사 연신비 & 방사 속도 */}
        <div className="pt-2 border-t border-white/10 space-y-2.5">
          {/* 연신비 Draw Ratio */}
          <label className="block">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-200 font-medium">연신비 (Draw Ratio)</span>
              <span className="font-mono font-bold text-sky-300">
                {(inputs.drawRatio || 3.2).toFixed(1)}x
              </span>
            </div>
            <input
              type="range"
              min={1.0}
              max={6.0}
              step={0.1}
              value={inputs.drawRatio || 3.2}
              onChange={(e) => set("drawRatio", Number(e.target.value))}
              className="mt-1 h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 accent-sky-400"
            />
            <div className="flex justify-between text-[9px] text-slate-500 mt-0.5">
              <span>1.0x (미연신사 POY)</span>
              <span>3.5x (표준)</span>
              <span>6.0x (초고연신 FDY)</span>
            </div>
          </label>

          {/* 방사 속도 Spinning Speed */}
          <label className="block">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-200 font-medium">방사 속도 (Take-up Speed)</span>
              <span className="font-mono font-bold text-emerald-300">
                {(inputs.spinningSpeed || 3200).toLocaleString()} <span className="text-[10px] text-slate-400 font-normal">m/min</span>
              </span>
            </div>
            <input
              type="range"
              min={1000}
              max={6000}
              step={100}
              value={inputs.spinningSpeed || 3200}
              onChange={(e) => set("spinningSpeed", Number(e.target.value))}
              className="mt-1 h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 accent-emerald-400"
            />
          </label>
        </div>

        {/* 6. 섬유 길이 & 권축수 그리드 */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
          <label className="block">
            <div className="flex items-center justify-between text-[11px] text-slate-300">
              <span>섬유길이(mm)</span>
              <span className="font-mono text-purple-300 font-bold">{inputs.lengthMm}</span>
            </div>
            <input
              type="range"
              min={10}
              max={150}
              step={1}
              value={inputs.lengthMm}
              onChange={(e) => set("lengthMm", Number(e.target.value))}
              className="mt-1 h-1 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 accent-purple-400"
            />
          </label>

          <label className="block">
            <div className="flex items-center justify-between text-[11px] text-slate-300">
              <span>권축수(CPI)</span>
              <span className="font-mono text-purple-300 font-bold">{inputs.crimpCpi}</span>
            </div>
            <input
              type="range"
              min={0}
              max={30}
              step={0.5}
              value={inputs.crimpCpi}
              onChange={(e) => set("crimpCpi", Number(e.target.value))}
              className="mt-1 h-1 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 accent-purple-400"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
