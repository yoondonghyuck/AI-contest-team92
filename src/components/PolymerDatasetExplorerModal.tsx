import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Search,
  Database,
  Filter,
  CheckCircle2,
  ArrowRight,
  FlaskConical,
  SlidersHorizontal,
} from "lucide-react";
import {
  loadPolymerInformaticsDataset,
  searchPolymers,
  getDatasetStats,
  convertRealRecordToPolymerDefinition,
  type RealPolymerRecord,
  type DatasetStats,
} from "../model/polymerDatasetService";
import type { PolymerDefinition } from "../model/polymers";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelectPolymer: (polymer: PolymerDefinition, realRecord: RealPolymerRecord) => void;
  currentPolymerId?: string;
  onAddToBlend?: (polymer: PolymerDefinition) => void;
}

export const PolymerDatasetExplorerModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSelectPolymer,
  currentPolymerId,
  onAddToBlend,
}) => {
  const [records, setRecords] = useState<RealPolymerRecord[]>([]);
  const [stats, setStats] = useState<DatasetStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // 검색 & 필터 상태
  const [query, setQuery] = useState<string>("");
  const [debouncedQuery, setDebouncedQuery] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<
    "relevance" | "tg_desc" | "tg_asc" | "density_desc" | "mw_desc" | "tenacity_desc"
  >("relevance");

  // 초고속 디바운스 (120ms): 3,284건 고속 검색 프론트엔드 최적화
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 120);
    return () => clearTimeout(timer);
  }, [query]);

  // 데이터셋 초기 로드
  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    setIsLoading(true);

    loadPolymerInformaticsDataset().then((data) => {
      if (mounted) {
        setRecords(data);
        setStats(getDatasetStats());
        setIsLoading(false);
      }
    });

    return () => {
      mounted = false;
    };
  }, [isOpen]);

  // 검색 결과 계산 (< 2ms)
  const searchResults = useMemo(() => {
    if (!isOpen || records.length === 0) return { results: [], totalMatches: 0, searchTimeMs: 0 };

    return searchPolymers({
      query: debouncedQuery,
      category: selectedCategory,
      sortBy,
      limit: 60,
    });
  }, [isOpen, records, debouncedQuery, selectedCategory, sortBy]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150">
      {/* 백드롭 오버레이 */}
      <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md" onClick={onClose} />

      {/* 모달 윈도우 */}
      <div className="relative z-10 flex h-[90vh] w-full max-w-5xl flex-col rounded-2xl border border-sky-500/40 bg-[#090e1a] text-slate-100 shadow-[0_25px_80px_rgba(0,0,0,0.95)] overflow-hidden">
        {/* 1. 모달 헤더 */}
        <header className="flex items-center justify-between border-b border-white/10 bg-slate-950/90 px-5 py-3.5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 via-indigo-600 to-purple-600 p-0.5 shadow-lg shadow-sky-500/25">
              <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-slate-950 text-sky-400">
                <Database size={20} />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                  <span>대규모 고분자 인포매틱스 오픈 데이터셋 (PI1M & Polymer Genome)</span>
                  <span className="rounded-full bg-emerald-500/20 border border-emerald-400/40 px-2 py-0.2 text-[10px] text-emerald-300 font-mono">
                    3,284건 실제 데이터
                  </span>
                </h2>
              </div>
              <p className="text-[11px] text-slate-400">
                공인 학술 벤치마크 실측 고분자 물성·SMILES 데이터셋을 실시간 검색하고 3D 시뮬레이터에 즉각 바인딩합니다.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </header>

        {/* 2. 검색 및 필터 컨트롤 바 */}
        <div className="border-b border-white/10 bg-slate-900/80 p-3.5 space-y-2.5 shrink-0">
          <div className="flex items-center gap-2">
            {/* 검색창 */}
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="고분자 한글명, 영문명, SMILES(예: '폴리아미드', 'terephthalate', '*CC(Cl)*')..."
                className="w-full rounded-xl bg-slate-950 border border-white/10 pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-400/60 focus:ring-1 focus:ring-sky-400 transition"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* 정렬 드롭다운 */}
            <div className="flex items-center gap-1.5 text-xs">
              <SlidersHorizontal size={14} className="text-slate-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-sky-400 focus:outline-none cursor-pointer"
              >
                <option value="relevance">정확도순</option>
                <option value="tg_desc">유리전이온도(Tg) 높은순</option>
                <option value="tg_asc">유리전이온도(Tg) 낮은순</option>
                <option value="density_desc">밀도(Density) 높은순</option>
                <option value="mw_desc">단량체 분자량(Mw) 큰순</option>
                <option value="tenacity_desc">인장강도 높은순</option>
              </select>
            </div>
          </div>

          {/* 카테고리 칩 목록 */}
          {stats && stats.categories.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
              <span className="text-slate-400 text-[10px] shrink-0 mr-1 flex items-center gap-1">
                <Filter size={11} />
                분류:
              </span>
              <button
                onClick={() => setSelectedCategory("ALL")}
                className={`rounded-lg px-2.5 py-1 transition cursor-pointer shrink-0 font-medium ${
                  selectedCategory === "ALL"
                    ? "bg-sky-500 text-slate-950 font-bold shadow-md shadow-sky-500/20"
                    : "bg-white/5 text-slate-300 hover:bg-white/10"
                }`}
              >
                전체 (3,284)
              </button>
              {stats.categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`rounded-lg px-2.5 py-1 transition cursor-pointer shrink-0 font-medium ${
                    selectedCategory === cat
                      ? "bg-sky-500 text-slate-950 font-bold shadow-md shadow-sky-500/20"
                      : "bg-white/5 text-slate-300 hover:bg-white/10"
                  }`}
                >
                  {cat.split(" ")[0]}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 3. 본문 검색 결과 리스트 */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-400">
              <FlaskConical size={32} className="animate-spin text-sky-400" />
              <p className="text-xs">3,284건의 오픈 데이터셋 및 다차원 인덱스 로딩 중...</p>
            </div>
          ) : searchResults.results.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-400">
              <p className="text-sm font-semibold">검색 조건에 맞는 고분자가 없습니다.</p>
              <p className="text-xs text-slate-500">다른 키워드나 SMILES 구조식을 검색해 보세요.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* 상단 검색 통계 라벨 */}
              <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                <span>
                  검색 결과 <strong className="text-white font-mono">{searchResults.totalMatches.toLocaleString()}</strong>건
                  (상위 {searchResults.results.length}건 표시)
                </span>
                <span className="font-mono text-emerald-400">
                  ⚡ 룩업 속도: {searchResults.searchTimeMs}ms
                </span>
              </div>

              {/* 그리드 카드 목록 */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {searchResults.results.map((rec) => {
                  const isCurrent = currentPolymerId === rec.id.toLowerCase();
                  return (
                    <div
                      key={rec.id}
                      className={`flex flex-col justify-between rounded-xl border p-3.5 transition shadow-sm ${
                        isCurrent
                          ? "border-sky-400 bg-sky-950/40 shadow-sky-500/15"
                          : "border-white/10 bg-slate-900/60 hover:border-sky-400/50 hover:bg-slate-900"
                      }`}
                    >
                      <div className="space-y-2">
                        {/* 카드 헤더 */}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[10px] font-mono text-sky-400 block">{rec.id}</span>
                            <h3 className="text-xs font-bold text-white line-clamp-1" title={rec.name}>
                              {rec.name}
                            </h3>
                            <p className="text-[11px] text-slate-300 font-medium">{rec.koreanName}</p>
                          </div>
                          <span className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-mono text-slate-300 border border-white/10">
                            {rec.source}
                          </span>
                        </div>

                        {/* SMILES */}
                        <div className="rounded bg-slate-950/90 px-2 py-1 font-mono text-[9px] text-slate-400 truncate border border-white/5">
                          SMILES: <span className="text-slate-200">{rec.smiles}</span>
                        </div>

                        {/* 물성치 그리드 */}
                        <div className="grid grid-cols-3 gap-1 text-[10px] font-mono">
                          <div className="rounded bg-slate-950/60 p-1 border border-white/5">
                            <span className="text-[8px] text-slate-400 block">Tg</span>
                            <span className="font-bold text-sky-300">{rec.tg} ℃</span>
                          </div>
                          <div className="rounded bg-slate-950/60 p-1 border border-white/5">
                            <span className="text-[8px] text-slate-400 block">밀도</span>
                            <span className="font-bold text-emerald-300">{rec.density} g/cm³</span>
                          </div>
                          <div className="rounded bg-slate-950/60 p-1 border border-white/5">
                            <span className="text-[8px] text-slate-400 block">단량체 Mw</span>
                            <span className="font-bold text-purple-300">{rec.monomerMw}</span>
                          </div>
                        </div>

                        {/* 카테고리 태그 */}
                        <div className="flex items-center gap-1 text-[9px] text-slate-400">
                          <span className="rounded bg-sky-500/10 px-1.5 py-0.2 text-sky-300">
                            {rec.subCategory || rec.category}
                          </span>
                        </div>
                      </div>

                      {/* 하단 선택 및 혼합 추가 버튼 그룹 */}
                      <div className="mt-3 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const def = convertRealRecordToPolymerDefinition(rec);
                            onSelectPolymer(def, rec);
                            onClose();
                          }}
                          className={`flex-1 flex items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-semibold transition cursor-pointer ${
                            isCurrent
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/40"
                              : "bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold shadow-md shadow-sky-500/20"
                          }`}
                        >
                          {isCurrent ? (
                            <>
                              <CheckCircle2 size={13} />
                              <span>선택됨</span>
                            </>
                          ) : (
                            <>
                              <span>3D 로드</span>
                              <ArrowRight size={13} />
                            </>
                          )}
                        </button>
                        {onAddToBlend && (
                          <button
                            type="button"
                            onClick={() => {
                              const def = convertRealRecordToPolymerDefinition(rec);
                              onAddToBlend(def);
                              onClose();
                            }}
                            className="rounded-lg bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/40 py-1.5 px-2.5 text-xs font-bold text-amber-200 transition cursor-pointer shadow-sm"
                            title="현재 3D 화면에 이 고분자를 혼합/조합 추가"
                          >
                            + 혼합
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 4. 모달 하단 푸터 바 */}
        <footer className="flex items-center justify-between border-t border-white/10 bg-slate-950/90 px-5 py-2.5 text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-emerald-400">
              <CheckCircle2 size={13} />
              <span>실제 인포매틱스 오픈 데이터셋 활성화</span>
            </span>
            <span>•</span>
            <span>출처: PI1M, PoLyInfo (NIMS), Polymer Genome</span>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg bg-white/10 px-3 py-1 text-xs text-slate-200 hover:bg-white/20 transition cursor-pointer"
          >
            닫기
          </button>
        </footer>
      </div>
    </div>
  );
};
