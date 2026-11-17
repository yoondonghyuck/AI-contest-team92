import type { ReactNode } from "react";
import type { CrossSectionShape, FiberInputs } from "../types";
import { SHAPE_LABELS } from "../types";
import { Hexagon, Layers, Ruler, Waves, CircleDot, Sparkles, FlaskConical, Dna, Database, Search } from "lucide-react";
import { POLYMER_DATABASE, type PolymerDefinition } from "../model/polymers";

interface Props {
  inputs: FiberInputs;
  onChange: (next: FiberInputs) => void;
  currentPolymer?: PolymerDefinition;
  onSelectPolymer?: (p: PolymerDefinition) => void;
  onOpenDatasetExplorer?: () => void;
}

const SHAPES: CrossSectionShape[] = ["circular", "trilobal", "hollow"];

export function ControlPanel({ inputs, onChange, currentPolymer, onSelectPolymer, onOpenDatasetExplorer }: Props) {
  const set = <K extends keyof FiberInputs>(key: K, value: FiberInputs[K]) => {
    onChange({ ...inputs, [key]: value });
  };

  const isBuiltIn30 = currentPolymer ? POLYMER_DATABASE.some((p) => p.id === currentPolymer.id) : true;

  return (
    <aside className="flex h-full flex-col gap-4 overflow-y-auto border-r border-white/10 bg-[#0c1220]/95 p-4 backdrop-blur">
      <div>
        <p className="text-[11px] tracking-[0.22em] text-sky-300/80 uppercase">Microfiber & Polymer Inputs</p>
        <h1 className="mt-1 text-lg font-bold text-slate-50">미세 섬유 & 방사 변수</h1>
        <p className="mt-1 text-xs leading-relaxed text-slate-400">
          고분자 화학종·분자량·결정화도·섬도에 따라 <strong>염색성, 강도, 직물 물성</strong>이 실시간으로 예측됩니다.
        </p>
      </div>

      {/* 0. 고분자 선택 및 대규모 오픈 데이터셋 연동 */}
      {currentPolymer && onSelectPolymer && (
        <div className="rounded-xl border border-sky-500/30 bg-sky-950/40 p-3 shadow-lg space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-bold text-sky-200">
              <Dna size={15} className="text-sky-400" />
              <span>고분자 선택</span>
            </span>
            <span className="rounded bg-sky-500/20 px-1.5 py-0.2 text-[10px] font-mono text-sky-300">
              {isBuiltIn30 ? "표준 30종 DB" : "대규모 오픈 DB (PI1M)"}
            </span>
          </div>

          {/* 대규모 오픈 데이터셋 검색 탐색기 버튼 */}
          {onOpenDatasetExplorer && (
            <button
              type="button"
              onClick={onOpenDatasetExplorer}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-sky-500/20 via-indigo-500/20 to-purple-500/20 hover:from-sky-500/35 hover:to-purple-500/35 border border-sky-400/40 py-2 px-3 text-xs font-bold text-sky-200 transition cursor-pointer shadow-sm group"
            >
              <Database size={14} className="text-sky-400 group-hover:scale-110 transition-transform" />
              <span>대규모 오픈 데이터셋 탐색기 (3,284건)</span>
              <Search size={13} className="text-slate-400 ml-auto" />
            </button>
          )}

          <div className="rounded-lg bg-black/40 border border-white/10 p-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white font-mono">{currentPolymer.shortName}</span>
              <span className="text-[10px] text-sky-300">{currentPolymer.category.split(" ")[0]}</span>
            </div>
            <p className="mt-0.5 text-[11px] text-slate-300 truncate">{currentPolymer.koreanName}</p>
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
            <span>밀도: {currentPolymer.density} g/cm³</span>
            <span>Tg: {currentPolymer.tg}℃</span>
          </div>
        </div>
      )}

      {/* 1. 고분자 분자량 (Mw) 슬라이더 */}
      <SliderRow
        icon={<FlaskConical size={15} />}
        label="분자량 (Mw)"
        unit="g/mol"
        value={inputs.molecularWeight}
        min={10000}
        max={600000}
        step={5000}
        display={Math.round(inputs.molecularWeight).toLocaleString()}
        hint="분자량이 높을수록 인장강도 급상승, 사슬 얽힘 증가"
        onInput={(v) => {
          set("molecularWeight", v);
        }}
      />

      {/* 2. 결정화도 (Crystallinity) 슬라이더 */}
      <SliderRow
        icon={<Layers size={15} />}
        label="결정화도 Crystallinity"
        unit="%"
        value={inputs.crystallinity * 100}
        min={20}
        max={90}
        step={1}
        display={(inputs.crystallinity * 100).toFixed(0)}
        hint="결정화도↑: 강도·탄성률 상승, 염색 침투성(비정질 영역) 감소"
        onInput={(v) => set("crystallinity", v / 100)}
      />

      {/* 3. 섬도 (Fineness / Denier) 슬라이더 */}
      <SliderRow
        icon={<Ruler size={15} />}
        label="섬도 Fineness"
        unit="D"
        value={inputs.denier}
        min={0.5}
        max={10}
        step={0.1}
        display={inputs.denier.toFixed(1)}
        hint="극세사(1D 이하): 표면적 급증, 초기 흡진 빠름"
        onInput={(v) => set("denier", v)}
      />

      {/* 4. 섬유 길이 (Fiber Length) 슬라이더 */}
      <SliderRow
        icon={<Hexagon size={15} />}
        label="섬유 길이 Length"
        unit="mm"
        value={inputs.lengthMm}
        min={10}
        max={150}
        step={1}
        display={inputs.lengthMm.toFixed(0)}
        hint="방적사 방적성 및 전단 강성(G)에 기여"
        onInput={(v) => set("lengthMm", v)}
      />

      {/* 5. 권축수 (Crimp per Inch) 슬라이더 */}
      <SliderRow
        icon={<Waves size={15} />}
        label="권축수 Crimp"
        unit="CPI"
        value={inputs.crimpCpi}
        min={0}
        max={30}
        step={0.5}
        display={inputs.crimpCpi.toFixed(1)}
        hint="벌키성, 신축성, 두께(H0) 증가"
        onInput={(v) => set("crimpCpi", v)}
      />

      {/* 6. 방사 연신비 Draw Ratio */}
      <SliderRow
        icon={<Ruler size={15} />}
        label="방사 연신비 (Draw Ratio)"
        unit="x"
        value={inputs.drawRatio || 3.2}
        min={1.0}
        max={6.0}
        step={0.1}
        display={(inputs.drawRatio || 3.2).toFixed(1)}
        hint="연신비↑: 사슬 배향도 및 인장강도 급상승, 신도 감소"
        onInput={(v) => set("drawRatio", v)}
      />

      {/* 7. 방사 속도 Spinning Speed */}
      <SliderRow
        icon={<Waves size={15} />}
        label="방사 속도 (Winding Speed)"
        unit="m/min"
        value={inputs.spinningSpeed || 3200}
        min={1000}
        max={6000}
        step={100}
        display={(inputs.spinningSpeed || 3200).toLocaleString()}
        hint="고속 방사: 배향 유도 결정화 촉진"
        onInput={(v) => set("spinningSpeed", v)}
      />

      {/* 8. 단면 형상 및 이형도 */}
      <div className="pt-1">
        <div className="mb-2 flex items-center justify-between text-xs text-slate-200">
          <span className="flex items-center gap-1.5 font-medium">
            <CircleDot size={15} className="text-sky-400" />
            단면 형상 Cross-section
          </span>
          <span className="text-[10px] text-sky-300 font-mono">
            이형도 {(inputs.modificationRatio || 1.8).toFixed(1)}x
          </span>
        </div>
        <div className="grid grid-cols-1 gap-1.5">
          {SHAPES.map((shape) => {
            const active = inputs.shape === shape;
            return (
              <button
                key={shape}
                type="button"
                onClick={() => set("shape", shape)}
                className={`rounded-xl border px-3 py-2 text-left text-xs transition ${active
                    ? "border-sky-400 bg-sky-400/15 text-sky-100 shadow-[0_0_20px_#38bdf822] font-semibold"
                    : "border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:bg-white/10"
                  }`}
              >
                <div className="flex items-center justify-between">
                  <span>{SHAPE_LABELS[shape]}</span>
                  {shape === "trilobal" && (
                    <span className="rounded bg-sky-500/20 px-1.5 py-0.2 text-[9px] text-sky-300 flex items-center gap-0.5">
                      <Sparkles size={9} /> 심색성+광택
                    </span>
                  )}
                  {shape === "hollow" && (
                    <span className="rounded bg-indigo-500/20 px-1.5 py-0.2 text-[9px] text-indigo-300">
                      보온·경량
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* 단면 이형도/중공률 슬라이더 */}
        <div className="mt-2 rounded-lg bg-black/40 p-2 border border-white/10">
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
            className="mt-1 h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 accent-amber-400"
          />
        </div>
      </div>
    </aside>
  );
}

function SliderRow({
  icon,
  label,
  unit,
  value,
  min,
  max,
  step,
  display,
  hint,
  onInput,
}: {
  icon: ReactNode;
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  hint?: string;
  onInput: (v: number) => void;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs text-slate-200">
          <span className="text-sky-300">{icon}</span>
          {label}
        </span>
        <span className="font-mono text-xs font-bold text-sky-200">
          {display}
          <span className="ml-1 text-[10px] font-normal text-slate-400">{unit}</span>
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onInput={(e) => onInput(Number((e.target as HTMLInputElement).value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-700 accent-sky-400"
      />
      {hint && (
        <p className="mt-1 text-[10px] text-slate-400 leading-tight">
          {hint}
        </p>
      )}
    </label>
  );
}
