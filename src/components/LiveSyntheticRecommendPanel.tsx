import React, { useState, useEffect, useCallback } from "react";
import {
  Sparkles,
  Search,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  ArrowRight,
  Activity,
  X,
  CheckCircle2,
  Cpu,
  Filter,
  Zap,
  Database,
  Archive,
  AlertTriangle,
  FileJson,
  HardDrive,
} from "lucide-react";
import {
  fetchMaterialsMetadataCatalog,
  fetchIndividualMaterialFile,
  convertMaterialPayloadToAppModel,
  type PolymerSourceType,
  type PolymerMetadataItem,
  type IndividualMaterialFilePayload,
} from "../model/pgVectorRagClient";
import type { LiveSyntheticPolymerRecord, LivePoolFilterOptions } from "../model/liveSyntheticPoolService";
import type { PolymerDefinition } from "../model/polymers";
import type { ParsedCopolymerStructure } from "../model/chatMolecularParser";
import type { AtomNode, BondEdge } from "./MolDrawCanvas";
import type { MolecularDescriptor } from "../model/molecularDescriptor";

export interface LiveApplyPayload {
  record: LiveSyntheticPolymerRecord;
  polymer: PolymerDefinition;
  parsedCopolymer: ParsedCopolymerStructure;
  atoms: AtomNode[];
  bonds: BondEdge[];
  descriptor: MolecularDescriptor;
  recommendedInputs: {
    repeatCount: number;
    molecularWeight: number;
    crystallinity: number;
  };
}

interface LiveSyntheticRecommendPanelProps {
  onApplyRecommendation: (payload: LiveApplyPayload) => void;
  currentPolymerId?: string;
  isEmbedded?: boolean;
  onClose?: () => void;
  className?: string;
}

export const LiveSyntheticRecommendPanel: React.FC<LiveSyntheticRecommendPanelProps> = ({
  onApplyRecommendation,
  currentPolymerId,
  isEmbedded = false,
  onClose,
  className = "",
}) => {
  // 3대 통합 데이터 소스 탭 상태 (`ACTIVE_S_TIER` | `ARCHIVED_REJECTED` | `OPEN_BENCHMARK` | `ALL`)
  const [sourceTab, setSourceTab] = useState<"ALL" | PolymerSourceType>("ACTIVE_S_TIER");
  const [query, setQuery] = useState<string>("");
  const [debouncedQuery, setDebouncedQuery] = useState<string>("");
  const [gradeFilter, setGradeFilter] = useState<string>("ALL");
  const [archFilter, setArchFilter] = useState<string>("ALL");
  const [morphologyFilter, setMorphologyFilter] = useState<string>("ALL");
  const [stageFilter, setStageFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<NonNullable<LivePoolFilterOptions["sortBy"]>>("latest");

  // PostgreSQL 메타데이터 목록 상태
  const [items, setItems] = useState<PolymerMetadataItem[]>([]);
  const [totalMatches, setTotalMatches] = useState<number>(0);
  const [countsBySource, setCountsBySource] = useState({
    OPEN_BENCHMARK: 3314,
    ACTIVE_S_TIER: 5000,
    ARCHIVED_REJECTED: 80,
    TOTAL: 8394,
  });
  const [liveCounters, setLiveCounters] = useState({
    totalVerified: 642762,
    passedSTierTotal: 58696,
    rejectedTotal: 584066,
    activeWindowCount: 5000,
    archivedStorageCount: 80,
    lastUpdatedAt: null as string | null,
  });
  const [pgBackendMode, setPgBackendMode] = useState<string>("POSTGRES_PGVECTOR_DOCKER");
  const [searchTimeMs, setSearchTimeMs] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);

  // 개별 파일 스토리지(`storage/materials/{id}.json`) 온디맨드 로드 상태
  const [loadingFileId, setLoadingFileId] = useState<string | null>(null);
  const [selectedFilePayload, setSelectedFilePayload] =
    useState<IndividualMaterialFilePayload | null>(null);
  const [lastLoadedFileBanner, setLastLoadedFileBanner] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 120);
    return () => clearTimeout(t);
  }, [query]);

  // 탭 전환 시 서브 필터 초기화
  const handleSelectSourceTab = (tab: "ALL" | PolymerSourceType) => {
    setSourceTab(tab);
    setGradeFilter("ALL");
    setStageFilter("ALL");
  };

  // PostgreSQL 메타데이터 목록 조회 (무거운 3D/물성 전체 JSON 없이 경량 메타데이터만 조회)
  const loadMetadataList = useCallback(
    async (showSpinner = false) => {
      if (showSpinner) setIsRefreshing(true);
      try {
        const res = await fetchMaterialsMetadataCatalog({
          sourceType: sourceTab,
          query: debouncedQuery,
          grade: gradeFilter,
          architecture: archFilter,
          morphology: morphologyFilter,
          stageFilter,
          sortBy,
          limit: isEmbedded ? 30 : 72,
          offset: 0,
        });
        setItems(res.items);
        setTotalMatches(res.totalMatches);
        setCountsBySource(res.countsBySource);
        if (res.liveCounters) {
          setLiveCounters(res.liveCounters);
        }
        setPgBackendMode(res.pgBackendMode);
        setSearchTimeMs(res.searchTimeMs);
        setLastFetchedAt(new Date().toLocaleTimeString("ko-KR"));
      } catch (err) {
        console.warn("[LiveSyntheticRecommendPanel] Catalog fetch warning:", err);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [sourceTab, debouncedQuery, gradeFilter, archFilter, morphologyFilter, stageFilter, sortBy, isEmbedded]
  );

  const loadMetadataRef = React.useRef(loadMetadataList);
  useEffect(() => {
    loadMetadataRef.current = loadMetadataList;
  }, [loadMetadataList]);

  useEffect(() => {
    loadMetadataList(false);
  }, [loadMetadataList]);

  // 실시간 시연을 위한 2초 주기 폴링 (Stale Closure 방지 ref 사용)
  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => {
      loadMetadataRef.current(false);
    }, 2000);
    return () => clearInterval(timer);
  }, [autoRefresh]);

  // 목록에서 특정 항목 클릭 시에만 개별 파일(`storage/materials/{id}.json`)을 온디맨드 로드하여 3D 뷰어에 바인딩
  const handleLoadFileAndApply = async (id: string, openDrawerOnly = false) => {
    setLoadingFileId(id);
    try {
      const filePayload = await fetchIndividualMaterialFile(id);
      setSelectedFilePayload(filePayload);
      setLastLoadedFileBanner(
        `📂 단일 파일 온디맨드 로드 완료: ${filePayload.metadata.file_path} (${filePayload.source_type})`
      );

      if (!openDrawerOnly) {
        const converted = convertMaterialPayloadToAppModel(filePayload);
        onApplyRecommendation({
          record: converted.record,
          polymer: converted.polymer,
          parsedCopolymer: converted.parsedCopolymer,
          atoms: converted.atoms,
          bonds: converted.bonds,
          descriptor: converted.descriptor,
          recommendedInputs: converted.recommendedInputs,
        });
      }
    } catch (err) {
      console.error(`Failed to load individual material file for ${id}:`, err);
    } finally {
      setLoadingFileId(null);
    }
  };

  const sourceBadgeStyle = (st: PolymerSourceType, grade: string) => {
    if (st === "ARCHIVED_REJECTED") {
      if (grade.includes("EVICTED")) {
        return "bg-purple-500/20 text-purple-200 border-purple-400/50 font-bold";
      }
      return "bg-rose-500/20 text-rose-200 border-rose-400/50 font-bold";
    }
    if (st === "OPEN_BENCHMARK") {
      return "bg-sky-500/20 text-sky-200 border-sky-400/50 font-bold";
    }
    if (grade === "S++") {
      return "bg-gradient-to-r from-amber-400 via-rose-400 to-purple-500 text-slate-950 font-black border-amber-300";
    }
    if (grade === "S+") {
      return "bg-gradient-to-r from-amber-400 to-orange-400 text-slate-950 font-extrabold border-amber-300";
    }
    return "bg-amber-500/20 text-amber-300 font-bold border-amber-400/50";
  };

  return (
    <div
      className={`flex flex-col h-full min-h-0 bg-[#080d18] text-slate-100 overflow-hidden ${className}`}
    >
      {/* ─────────────────────────────────────────────────────────────
          1. 상단 PostgreSQL + pgvector & 개별 File Storage 아키텍처 상태 헤더
          ───────────────────────────────────────────────────────────── */}
      <div className="border-b border-white/10 bg-slate-950/90 px-4 py-2.5 shrink-0 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 via-rose-500 to-purple-600 p-0.5 shadow-lg shadow-amber-500/20">
              <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-slate-950 text-amber-400">
                <Database size={16} />
              </div>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xs sm:text-sm font-extrabold text-white tracking-tight flex items-center gap-1.5">
                  <span>공인, 통과, 탈락 데이터 스토리지</span>
                </h3>
                <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 border border-sky-400/40 px-2 py-0.5 text-[10px] font-mono text-sky-300">
                  <HardDrive size={11} />
                  storage/materials/&#123;id&#125;.json 분리 아키텍처
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-400/40 px-2 py-0.5 text-[10px] font-mono text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                  총 자산 {countsBySource.TOTAL.toLocaleString()}건 ({pgBackendMode === "POSTGRES_PGVECTOR_DOCKER" ? "Docker pgvector:pg16 연결됨" : "pgvector 하이브리드 인덱스"})
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                DB 테이블에는 검색용 경량 메타데이터와 32차원 <code className="text-amber-300">vector(32)</code> 임베딩만 목록화하고, 항목 클릭 시에만 단일 파일(<code className="text-sky-300">storage/materials/&#123;id&#125;.json</code>)을 가져와 3D 구조를 렌더링합니다.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold border transition cursor-pointer ${
                autoRefresh
                  ? "bg-emerald-500/20 border-emerald-400/50 text-emerald-300"
                  : "bg-slate-900 border-white/10 text-slate-400 hover:text-white"
              }`}
              title="백그라운드 생성 데몬(2초 주기) 실시간 동기화 토글"
            >
              <Activity size={12} className={autoRefresh ? "animate-pulse text-emerald-400" : ""} />
              <span>{autoRefresh ? "실시간 동기화 (2s)" : "동기화 일시정지"}</span>
            </button>

            <button
              type="button"
              onClick={() => loadMetadataList(true)}
              className="flex items-center gap-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 px-2.5 py-1 text-[11px] text-slate-200 transition cursor-pointer"
            >
              <RefreshCw size={12} className={isRefreshing ? "animate-spin text-sky-400" : ""} />
              <span>목록 새로고침</span>
            </button>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition cursor-pointer"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            실시간 가상 고분자 생성·통과(S급)·탈락 누적 카운터 바
            ───────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 text-xs">
          <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-950/25 px-3 py-1.5">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              <div>
                <div className="text-[10px] text-emerald-300 font-bold">검증된 총 데이터 건수 (누적 생성/검증)</div>
                <div className="text-[9px] text-slate-400">4단계 물리화학·타니모토·파레토 검증 총합</div>
              </div>
            </div>
            <span className="font-mono text-sm font-black text-emerald-300">
              {liveCounters.totalVerified.toLocaleString()}건
            </span>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-950/25 px-3 py-1.5">
            <div className="flex items-center gap-2">
              <Sparkles size={13} className="text-amber-400 shrink-0" />
              <div>
                <div className="text-[10px] text-amber-300 font-bold">통과된 S급 데이터 건수 (누적 통과)</div>
                <div className="text-[9px] text-slate-400">
                  카탈로그 보유: {countsBySource.ACTIVE_S_TIER.toLocaleString()}건
                </div>
              </div>
            </div>
            <span className="font-mono text-sm font-black text-amber-300">
              {liveCounters.passedSTierTotal.toLocaleString()}건
            </span>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-rose-500/30 bg-rose-950/25 px-3 py-1.5">
            <div className="flex items-center gap-2">
              <Archive size={13} className="text-rose-400 shrink-0" />
              <div>
                <div className="text-[10px] text-rose-300 font-bold">탈락된 데이터 건수 (오답 노트 보관)</div>
                <div className="text-[9px] text-slate-400">
                  스토리지 파일 보관: {countsBySource.ARCHIVED_REJECTED.toLocaleString()}건
                </div>
              </div>
            </div>
            <span className="font-mono text-sm font-black text-rose-300">
              {liveCounters.rejectedTotal.toLocaleString()}건
            </span>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            3대 데이터 소스(`source_type`) 통합 탭 스위처
            ───────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => handleSelectSourceTab("ACTIVE_S_TIER")}
            className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left transition cursor-pointer ${
              sourceTab === "ACTIVE_S_TIER"
                ? "border-amber-400 bg-amber-500/20 text-white shadow-sm shadow-amber-500/20"
                : "border-white/10 bg-slate-900/80 text-slate-300 hover:bg-slate-900"
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles size={14} className="text-amber-400 shrink-0" />
              <div className="truncate">
                <div className="font-extrabold text-[11px]">ACTIVE_S_TIER</div>
                <div className="text-[9px] text-slate-400 truncate">실시간 상위 S급 후보 슬라이딩 윈도우</div>
              </div>
            </div>
            <span className="font-mono text-xs font-black text-amber-300 ml-1">
              {countsBySource.ACTIVE_S_TIER.toLocaleString()}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectSourceTab("ARCHIVED_REJECTED")}
            className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left transition cursor-pointer ${
              sourceTab === "ARCHIVED_REJECTED"
                ? "border-rose-400 bg-rose-500/20 text-white shadow-sm shadow-rose-500/20"
                : "border-white/10 bg-slate-900/80 text-slate-300 hover:bg-slate-900"
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Archive size={14} className="text-rose-400 shrink-0" />
              <div className="truncate">
                <div className="font-extrabold text-[11px]">ARCHIVED_REJECTED</div>
                <div className="text-[9px] text-slate-400 truncate">삭제/이관 보관 & QC 필터 탈락 사유</div>
              </div>
            </div>
            <span className="font-mono text-xs font-black text-rose-300 ml-1">
              {countsBySource.ARCHIVED_REJECTED.toLocaleString()}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectSourceTab("OPEN_BENCHMARK")}
            className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left transition cursor-pointer ${
              sourceTab === "OPEN_BENCHMARK"
                ? "border-sky-400 bg-sky-500/20 text-white shadow-sm shadow-sky-500/20"
                : "border-white/10 bg-slate-900/80 text-slate-300 hover:bg-slate-900"
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Database size={14} className="text-sky-400 shrink-0" />
              <div className="truncate">
                <div className="font-extrabold text-[11px]">OPEN_BENCHMARK</div>
                <div className="text-[9px] text-slate-400 truncate">공인 오픈셋 3,284건 + 상용 30종</div>
              </div>
            </div>
            <span className="font-mono text-xs font-black text-sky-300 ml-1">
              {countsBySource.OPEN_BENCHMARK.toLocaleString()}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectSourceTab("ALL")}
            className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left transition cursor-pointer ${
              sourceTab === "ALL"
                ? "border-emerald-400 bg-emerald-500/20 text-white shadow-sm shadow-emerald-500/20"
                : "border-white/10 bg-slate-900/80 text-slate-300 hover:bg-slate-900"
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <ShieldCheck size={14} className="text-emerald-400 shrink-0" />
              <div className="truncate">
                <div className="font-extrabold text-[11px]">ALL UNIFIED (3대 통합)</div>
                <div className="text-[9px] text-slate-400 truncate">오픈셋 + S급 활성 + 아카이브 전체</div>
              </div>
            </div>
            <span className="font-mono text-xs font-black text-emerald-300 ml-1">
              {countsBySource.TOTAL.toLocaleString()}
            </span>
          </button>
        </div>

        {/* 최근 온디맨드 로드된 단일 파일 알림 바 */}
        {lastLoadedFileBanner && (
          <div className="flex items-center justify-between rounded-lg bg-sky-950/60 border border-sky-400/40 px-3 py-1 text-[11px] font-mono text-sky-200">
            <span className="flex items-center gap-1.5">
              <FileJson size={13} className="text-sky-400" />
              {lastLoadedFileBanner}
            </span>
            <button
              type="button"
              onClick={() => setLastLoadedFileBanner(null)}
              className="text-slate-400 hover:text-white"
            >
              <X size={12} />
            </button>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. 검색 및 다차원 R&D 필터 컨트롤 바
          ───────────────────────────────────────────────────────────── */}
      <div className="border-b border-white/10 bg-slate-900/75 px-4 py-2.5 space-y-2 shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          {/* 검색창 */}
          <div className="relative flex-1 min-w-[220px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="소재 ID(PMX-LIVE, PMX-REJ, PMX-EVICT, PI1M), 단량체, 탈락 사유(열분해, 타니모토, 올리고머), 한글명 검색..."
              className="w-full rounded-xl bg-slate-950 border border-white/10 pl-8 pr-7 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400/70 transition"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* 아키텍처 필터 */}
          <select
            value={archFilter}
            onChange={(e) => setArchFilter(e.target.value)}
            className="rounded-xl border border-white/10 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 focus:border-amber-400 focus:outline-none cursor-pointer"
          >
            <option value="ALL">전체 사슬 구조</option>
            <option value="Block (-b-)">Block 공중합체 (-b-)</option>
            <option value="Graft (-g-)">Graft 가지형 (-g-)</option>
            <option value="Random">Random 공중합체 (-ran-)</option>
          </select>

          {/* Flory-Huggins 상분리 모폴로지 필터 */}
          <select
            value={morphologyFilter}
            onChange={(e) => setMorphologyFilter(e.target.value)}
            className="rounded-xl border border-white/10 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 focus:border-amber-400 focus:outline-none cursor-pointer"
          >
            <option value="ALL">전체 상분리 모폴로지 (χN)</option>
            <option value="Lamellar">Lamellar (층상 나노상분리)</option>
            <option value="Cylindrical">Cylindrical (육방 실린더형)</option>
            <option value="Gyroid">Bicontinuous Gyroid (자이로이드)</option>
            <option value="Spherical">Spherical (체심입방 구형)</option>
            <option value="Homogeneous">Homogeneous (균일 단일상)</option>
          </select>

          {/* 정렬 기준 */}
          <div className="flex items-center gap-1 text-xs">
            <SlidersHorizontal size={13} className="text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="rounded-xl border border-white/10 bg-slate-950 px-2.5 py-1.5 text-xs text-amber-200 focus:border-amber-400 focus:outline-none cursor-pointer"
            >
              <option value="latest">⚡ 최신 등록/보관순</option>
              <option value="innovation_desc">🏆 R&D 혁신 점수 높은순</option>
              <option value="tanimoto_asc">🧬 타니모토 유사도 낮은순</option>
              <option value="tg_desc">🔥 유리전이온도(Tg) 높은순</option>
              <option value="tensile_desc">💪 인장강도(MPa) 높은순</option>
              <option value="td_desc">🛡️ 열분해온도(Td) 높은순</option>
              <option value="chi_n_desc">🔬 Flory-Huggins (χN) 높은순</option>
            </select>
          </div>
        </div>

        {/* 서브 필터 칩 (ACTIVE_S_TIER일 때는 등급 필터, ARCHIVED_REJECTED일 때는 탈락/이관 사유 필터) */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
          {sourceTab === "ARCHIVED_REJECTED" ? (
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <span className="text-rose-300 text-[10px] flex items-center gap-1 mr-1 font-semibold">
                <AlertTriangle size={11} /> 보관/탈락 사유 필터:
              </span>
              {[
                { key: "ALL", label: "전체 보관/탈락 자료" },
                { key: "Sliding Window", label: "📦 5,000건 슬라이딩 윈도우 이관" },
                { key: "Stage-1", label: "⚠️ Stage-1 물리화학/옥텟/DP<50 탈락" },
                { key: "Stage-2", label: "🧬 Stage-2 타니모토 중복/Cosmetic 탈락" },
                { key: "Stage-3", label: "📉 Stage-3 S급 점수 미달 탈락" },
              ].map((st) => (
                <button
                  key={st.key}
                  type="button"
                  onClick={() => setStageFilter(st.key)}
                  className={`rounded-lg px-2.5 py-0.5 text-[11px] font-bold transition cursor-pointer ${
                    stageFilter === st.key
                      ? "bg-rose-500 text-white shadow-sm shadow-rose-500/30"
                      : "bg-white/5 text-slate-300 hover:bg-white/10"
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <span className="text-slate-400 text-[10px] flex items-center gap-1 mr-1">
                <Filter size={11} /> 등급 필터:
              </span>
              {(["ALL", "S++", "S+", "S"] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGradeFilter(g)}
                  className={`rounded-lg px-2.5 py-0.5 text-[11px] font-bold transition cursor-pointer ${
                    gradeFilter === g
                      ? "bg-amber-400 text-slate-950 shadow-sm shadow-amber-400/30"
                      : "bg-white/5 text-slate-300 hover:bg-white/10"
                  }`}
                >
                  {g === "ALL" ? "전체 등급" : `${g} 등급`}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3 text-[10px] font-mono text-slate-400">
            <span>
              조회된 메타데이터:{" "}
              <strong className="text-white">{totalMatches.toLocaleString()}</strong>건
            </span>
            <span className="text-emerald-400">⚡ DB 쿼리 {searchTimeMs}ms</span>
            {lastFetchedAt && <span>동기화: {lastFetchedAt}</span>}
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. 본문: 메타데이터 목록 그리드 (클릭 시 storage/materials/{id}.json 로드)
          ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3.5">
        {isLoading ? (
          <div className="flex h-full flex-col items-center justify-center gap-2.5 text-slate-400 py-10">
            <Cpu size={28} className="animate-spin text-amber-400" />
            <p className="text-xs font-semibold">
              PostgreSQL 메타데이터 카탈로그(/api/materials) 조회 중...
            </p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-400 py-10">
            <p className="text-xs font-semibold">조건에 일치하는 고분자 자산 메타데이터가 없습니다.</p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setGradeFilter("ALL");
                setArchFilter("ALL");
                setMorphologyFilter("ALL");
                setStageFilter("ALL");
              }}
              className="rounded-lg bg-amber-500/20 border border-amber-400/40 px-3 py-1 text-xs text-amber-300 hover:bg-amber-500/30 cursor-pointer"
            >
              필터 초기화
            </button>
          </div>
        ) : (
          <div
            className={`grid gap-3 ${
              isEmbedded
                ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
                : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
            }`}
          >
            {items.map((item) => {
              const targetId = `copol_live_${item.id.toLowerCase()}`;
              const isSelected =
                currentPolymerId === targetId ||
                currentPolymerId === item.id.toLowerCase() ||
                currentPolymerId === item.id.replace(/^BASELINE_/i, "").toLowerCase();
              const isLoadingThisFile = loadingFileId === item.id;
              const isArchived = item.source_type === "ARCHIVED_REJECTED";

              return (
                <div
                  key={item.id}
                  className={`flex flex-col justify-between rounded-xl border p-3 transition shadow-sm ${
                    isSelected
                      ? "border-amber-400 bg-amber-950/25 shadow-amber-500/15"
                      : isArchived
                      ? "border-rose-500/30 bg-slate-900/75 hover:border-rose-400/60 hover:bg-slate-900"
                      : "border-white/10 bg-slate-900/70 hover:border-amber-400/50 hover:bg-slate-900"
                  }`}
                >
                  <div className="space-y-2">
                    {/* 상단 헤더: ID, source_type 배지, 아키텍처 */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-[10px] font-bold text-amber-400">
                            {item.id}
                          </span>
                          <span
                            className={`rounded px-1.5 py-0.2 text-[9px] font-mono border ${
                              item.source_type === "ACTIVE_S_TIER"
                                ? "bg-amber-500/15 border-amber-400/30 text-amber-300"
                                : item.source_type === "ARCHIVED_REJECTED"
                                ? "bg-rose-500/15 border-rose-400/30 text-rose-300"
                                : "bg-sky-500/15 border-sky-400/30 text-sky-300"
                            }`}
                          >
                            {item.source_type}
                          </span>
                          <span className="rounded bg-purple-500/15 border border-purple-400/30 px-1.5 py-0.2 text-[9px] font-mono text-purple-300">
                            {item.morphology}
                          </span>
                        </div>
                        <h4
                          className="text-xs font-extrabold text-white truncate mt-0.5"
                          title={item.name}
                        >
                          {item.short_code}
                        </h4>
                        <p
                          className="text-[11px] text-amber-200/90 font-medium truncate"
                          title={item.korean_name}
                        >
                          {item.korean_name}
                        </p>
                      </div>

                      <div className="flex flex-col items-end shrink-0">
                        <span
                          className={`rounded-md border px-2 py-0.5 text-[10px] shadow-sm ${sourceBadgeStyle(
                            item.source_type,
                            item.quality_grade
                          )}`}
                        >
                          {item.quality_grade} ({item.innovation_score}점)
                        </span>
                        <span className="text-[9px] font-mono text-slate-400 mt-0.5">
                          DP={item.dp_n} · Mn={Math.round(item.mn).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* 통과/탈락 사유 & 개별 파일 스토리지 경로 박스 */}
                    <div
                      className={`rounded-lg border p-2 space-y-1 text-[10px] ${
                        isArchived
                          ? "bg-rose-950/30 border-rose-500/30 text-rose-200"
                          : "bg-slate-950/90 border-white/5 text-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between font-mono text-[9px]">
                        <span className={isArchived ? "text-rose-300 font-bold" : "text-emerald-300 font-bold"}>
                          {item.status_stage}
                        </span>
                        <span className="text-sky-300 flex items-center gap-1" title="개별 파일 스토리지 경로">
                          <FileJson size={10} />
                          {item.file_path}
                        </span>
                      </div>
                      <p className="text-[10px] leading-snug line-clamp-2" title={item.status_reason}>
                        {item.status_reason}
                      </p>
                    </div>

                    {/* 핵심 열역학·물리화학 요약 지표 (Postgres 메타데이터 컬럼) */}
                    <div className="grid grid-cols-3 gap-1 text-[10px] font-mono">
                      <div className="rounded bg-slate-950/70 p-1.5 border border-white/5">
                        <span className="text-[8px] text-slate-400 block">Tg · Tm</span>
                        <span className="font-bold text-sky-300">
                          {item.tg}℃ / {item.tm ?? "-"}℃
                        </span>
                      </div>
                      <div className="rounded bg-slate-950/70 p-1.5 border border-white/5">
                        <span className="text-[8px] text-slate-400 block">열분해 Td · 밀도</span>
                        <span className="font-bold text-amber-300">
                          {item.td ?? "-"}℃ · {item.density}g/cm³
                        </span>
                      </div>
                      <div className="rounded bg-slate-950/70 p-1.5 border border-white/5">
                        <span className="text-[8px] text-slate-400 block">인장강도 · 탄성률</span>
                        <span className="font-bold text-emerald-300">
                          {item.tensile_strength}MPa · {item.modulus_gpa}GPa
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 하단 액션 버튼: 클릭 시에만 storage/materials/{id}.json 단일 파일 Fetch */}
                  <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={isLoadingThisFile}
                      onClick={() => handleLoadFileAndApply(item.id, false)}
                      className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 px-2.5 text-xs font-extrabold transition cursor-pointer ${
                        isSelected
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/50"
                          : isArchived
                          ? "bg-gradient-to-r from-rose-500 to-purple-600 hover:from-rose-400 hover:to-purple-500 text-white shadow-md shadow-rose-500/20"
                          : "bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400 hover:from-amber-300 hover:to-rose-300 text-slate-950 shadow-md shadow-amber-500/20"
                      }`}
                    >
                      {isLoadingThisFile ? (
                        <>
                          <RefreshCw size={13} className="animate-spin" />
                          <span>단일 파일 로드 중...</span>
                        </>
                      ) : isSelected ? (
                        <>
                          <CheckCircle2 size={13} />
                          <span>현재 3D 뷰어 적용됨</span>
                        </>
                      ) : (
                        <>
                          <Zap size={13} />
                          <span>단일 파일 로드 & 3D 뷰어 바인딩</span>
                          <ArrowRight size={12} />
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleLoadFileAndApply(item.id, true)}
                      className="rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-slate-200 transition cursor-pointer shrink-0"
                      title={`${item.file_path} 단일 파일 상세 정보 열람`}
                    >
                      파일 상세
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          4. 온디맨드 로드된 개별 파일(storage/materials/{id}.json) 상세 뷰어 드로어
          ───────────────────────────────────────────────────────────── */}
      {selectedFilePayload && (
        <div className="border-t border-amber-400/40 bg-slate-950/95 px-4 py-3 shrink-0 animate-in slide-in-from-bottom duration-150">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <FileJson size={16} className="text-sky-400" />
              <span className="text-xs font-extrabold text-white">
                [{selectedFilePayload.id}] {selectedFilePayload.metadata.korean_name} — 온디맨드 개별 파일 (
                <code className="text-sky-300">{selectedFilePayload.metadata.file_path}</code>)
              </span>
              <span className="rounded bg-emerald-500/20 border border-emerald-400/40 px-2 py-0.5 text-[10px] font-mono text-emerald-300">
                vector({selectedFilePayload.embedding?.length || 32}) 임베딩 검증됨
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const converted = convertMaterialPayloadToAppModel(selectedFilePayload);
                  onApplyRecommendation({
                    record: converted.record,
                    polymer: converted.polymer,
                    parsedCopolymer: converted.parsedCopolymer,
                    atoms: converted.atoms,
                    bonds: converted.bonds,
                    descriptor: converted.descriptor,
                    recommendedInputs: converted.recommendedInputs,
                  });
                  setSelectedFilePayload(null);
                }}
                className="rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold px-3 py-1 text-xs cursor-pointer"
              >
                3D 사슬 모델로 바로 열기 →
              </button>
              <button
                type="button"
                onClick={() => setSelectedFilePayload(null)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5 text-[11px] font-mono">
            <div className="rounded-lg bg-slate-900 border border-white/10 p-2 space-y-1">
              <span className="text-amber-300 font-bold block">1. 파일 스토리지 & 소스 분류</span>
              <div>파일 경로: {selectedFilePayload.metadata.file_path}</div>
              <div>데이터 소스: {selectedFilePayload.source_type}</div>
              <div>중합도(DP n): {selectedFilePayload.metadata.dp_n}</div>
              <div>수평균 Mn: {Math.round(selectedFilePayload.metadata.mn).toLocaleString()} g/mol (PDI={selectedFilePayload.metadata.pdi})</div>
            </div>

            <div className="rounded-lg bg-slate-900 border border-white/10 p-2 space-y-1">
              <span className="text-sky-300 font-bold block">2. 열역학 & 기계적 상세 물성</span>
              <div>Tg: {selectedFilePayload.metadata.tg}℃ | Tm: {selectedFilePayload.metadata.tm ?? "-"}℃</div>
              <div>열분해 Td: {selectedFilePayload.metadata.td ?? "-"}℃ | 밀도: {selectedFilePayload.metadata.density} g/cm³</div>
              <div>인장강도: {selectedFilePayload.metadata.tensile_strength} MPa | 탄성률: {selectedFilePayload.metadata.modulus_gpa} GPa</div>
              <div>신율: {selectedFilePayload.metadata.elongation}% | 결정화도: {selectedFilePayload.metadata.crystallinity}%</div>
            </div>

            <div className="rounded-lg bg-slate-900 border border-white/10 p-2 space-y-1">
              <span className="text-purple-300 font-bold block">3. 상분리 & pgvector 임베딩</span>
              <div>Flory-Huggins (χ·N): {selectedFilePayload.metadata.chi_n}</div>
              <div>모폴로지: {selectedFilePayload.metadata.morphology}</div>
              <div>한센 용해도(HSP δ): {selectedFilePayload.metadata.hsp_total} MPa½</div>
              <div className="truncate text-[10px] text-slate-400">
                Embedding[0..5]: [{(selectedFilePayload.embedding || []).slice(0, 6).join(", ")}...]
              </div>
            </div>

            <div className="rounded-lg bg-slate-900 border border-rose-500/30 p-2 space-y-1">
              <span className="text-rose-300 font-bold block">4. 통과 / 탈락 사유 감사 기록</span>
              <div className="font-bold text-white">{selectedFilePayload.metadata.status_stage}</div>
              <div className="text-slate-300 text-[10px] leading-relaxed whitespace-normal">
                {selectedFilePayload.metadata.status_reason}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
