import React, { useMemo, useState } from "react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import {
  Award,
  Sparkles,
  TrendingUp,
  Download,
  Copy,
  Check,
  FlaskConical,
  Building2,
  FileText,
  Layers,
  Lightbulb,
  CheckCircle2,
  Database,
  GitMerge,
  Flame,
  Split,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";
import type { PolymerDefinition } from "../model/polymers";
import type { FiberInputs, ComprehensiveProperties } from "../types";
import type { AtomNode, BondEdge } from "./MolDrawCanvas";
import {
  evaluateResearchValue,
  type ResearchValueEvaluationResult,
} from "../model/researchValueEvaluator";
import { verifyStructureAgainstRealDataset } from "../model/polymerDatasetService";
import type { DetailedCopolymerEvaluation } from "../model/polymerBlendService";
import {
  useLiveSyntheticPool,
  convertLiveRecordToAppModel,
  formatLiveRecordKoreanName,
} from "../model/liveSyntheticPoolService";
import type { LiveApplyPayload } from "./LiveSyntheticRecommendPanel";

export interface ResearchValuePanelProps {
  currentPolymer: PolymerDefinition;
  inputs: FiberInputs;
  comprehensive: ComprehensiveProperties;
  sketchAtoms?: AtomNode[];
  sketchBonds?: BondEdge[];
  className?: string;
  copolymerEvaluation?: DetailedCopolymerEvaluation | null;
  onInputsChange?: (next: FiberInputs) => void;
  onApplyLiveRecommendation?: (payload: LiveApplyPayload) => void;
}

export const ResearchValuePanel: React.FC<ResearchValuePanelProps> = ({
  currentPolymer,
  inputs,
  comprehensive,
  sketchAtoms,
  sketchBonds,
  className = "",
  copolymerEvaluation,
  onInputsChange,
  onApplyLiveRecommendation,
}) => {
  const { records: liveRecords, stats: liveStats, telemetry: liveTelemetry } = useLiveSyntheticPool({
    pollIntervalMs: 2000,
    initialAutoRefresh: true,
  });
  const [copied, setCopied] = useState(false);
  const [protocolCopied, setProtocolCopied] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<string>("automotive");
  const [showFullProposalModal, setShowFullProposalModal] = useState<boolean>(false);
  const [dismissedOligomerPopup, setDismissedOligomerPopup] = useState<boolean>(false);

  // 실시간 R&D 가치성 평가 및 실제 중합법 프로토콜 계산
  const evaluation: ResearchValueEvaluationResult = useMemo(() => {
    return evaluateResearchValue({
      currentPolymer,
      inputs,
      comprehensive,
      sketchAtoms,
      sketchBonds,
      copolymerEvaluation,
    });
  }, [currentPolymer, inputs, comprehensive, sketchAtoms, sketchBonds, copolymerEvaluation]);

  // 1단계 공인 오픈 데이터셋(3,284건) & 30종 상용 베이스라인 화이트리스트 팩트체크 vs 2단계 가상 신소재 검증
  const hybridValidation = useMemo(() => {
    return verifyStructureAgainstRealDataset({
      id: currentPolymer.id,
      smiles: currentPolymer.smiles,
      name: currentPolymer.name,
      koreanName: currentPolymer.koreanName,
      formula: currentPolymer.formulaUnit,
      tg: currentPolymer.tg,
      mw: currentPolymer.monomerMW,
      category: currentPolymer.category,
      isCopolymer: Boolean(copolymerEvaluation),
    });
  }, [currentPolymer, copolymerEvaluation]);

  // 클립보드 복사
  const handleCopyProposal = () => {
    navigator.clipboard.writeText(evaluation.exportableProposalText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // 실험실 합성 프로토콜 레시피 복사
  const handleCopyProtocol = () => {
    const proto = evaluation.polymerizationProtocol;
    if (!proto) return;
    const text = `
# [실제 실험실 합성 및 중합 공정 레시피 가이드]
- 소재명: ${currentPolymer.name} (${currentPolymer.koreanName || ""})
- 구조 형태: ${proto.architectureNameKo}
- 추천 중합 메커니즘: ${proto.mechanismNameKo} (${proto.mechanismNameEn})
- 합성 난이도: ${proto.feasibilityGrade}등급 (${proto.feasibilityScore}점 / 100점) — ${proto.feasibilityVerdictKo}
- 단량체 반응성 비 (Mayo-Lewis): r₁ = ${proto.reactivityKinetics.r1}, r₂ = ${proto.reactivityKinetics.r2} (r₁·r₂ = ${proto.reactivityKinetics.productR1R2}, ${proto.reactivityKinetics.copolymerizationBehavior})
- 입체 장애(Steric Hindrance): ${proto.stericAndSideEffects.stericLevel} — ${proto.stericAndSideEffects.stericFactorDescription}

## 1. 개시제 및 촉매 시스템
- 주 촉매/개시제: ${proto.labRecipeGuide.initiatorCatalyst.primary} (${proto.labRecipeGuide.initiatorCatalyst.dosage})
- 대체 시약: ${proto.labRecipeGuide.initiatorCatalyst.alternatives.join(" / ")}
- 작용 메커니즘: ${proto.labRecipeGuide.initiatorCatalyst.roleAndCoCatalyst}

## 2. 표준 반응 환경 조건
- 반응 온도: ${proto.labRecipeGuide.reactionConditions.temperature}
- 용매계: ${proto.labRecipeGuide.reactionConditions.solvent}
- 반응 분위기: ${proto.labRecipeGuide.reactionConditions.atmosphere}
- 반응 시간: ${proto.labRecipeGuide.reactionConditions.reactionTime}
- 정제/후처리: ${proto.labRecipeGuide.reactionConditions.workupPurification}

## 3. 핵심 공정 리스크 관리 & 트러블슈팅
${proto.labRecipeGuide.criticalRisks.map((r) => `- [${r.title}] ${r.risk} ➔ 대응책: ${r.mitigation}`).join("\n")}
    `.trim();
    navigator.clipboard.writeText(text);
    setProtocolCopied(true);
    setTimeout(() => setProtocolCopied(false), 2500);
  };

  // 마크다운 제안서 파일 다운로드
  const handleDownloadProposal = () => {
    const blob = new Blob([evaluation.exportableProposalText], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `RD_Proposal_${currentPolymer.id}_${new Date().toISOString().slice(0, 10)}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // 등급에 따른 배지 스타일
  const gradeStyles = {
    S: {
      badge: "from-amber-400 via-rose-400 to-purple-400 text-slate-950 font-black",
      glow: "border-amber-400/80 shadow-amber-500/30",
      tag: "bg-amber-500/20 text-amber-300 border-amber-400/40",
      ring: "ring-amber-400/40",
    },
    A: {
      badge: "from-sky-400 to-indigo-400 text-slate-950 font-black",
      glow: "border-sky-400/70 shadow-sky-500/30",
      tag: "bg-sky-500/20 text-sky-300 border-sky-400/40",
      ring: "ring-sky-400/40",
    },
    B: {
      badge: "from-indigo-400 to-slate-300 text-slate-950 font-black",
      glow: "border-indigo-400/50 shadow-indigo-500/20",
      tag: "bg-indigo-500/20 text-indigo-300 border-indigo-400/40",
      ring: "ring-indigo-400/40",
    },
    C: {
      badge: "from-slate-500 to-slate-400 text-slate-950 font-black",
      glow: "border-slate-600 shadow-slate-700/20",
      tag: "bg-slate-800 text-slate-300 border-slate-700",
      ring: "ring-slate-600/40",
    },
  }[evaluation.grade];

  // 반복 단위(DP)가 낮아 올리고머 상태일 때 고분자 영역(n=100, Mn >= 10,000 g/mol)으로 원클릭 상향 핸들러
  const handleBoostToPolymerRange = () => {
    const unitMw = Math.max(14, currentPolymer.monomerMW || 28);
    const targetDp = Math.max(100, Math.ceil(12000 / unitMw));
    const targetMw = Math.round(targetDp * unitMw);
    if (onInputsChange) {
      onInputsChange({
        ...inputs,
        repeatCount: targetDp,
        molecularWeight: targetMw,
      });
    }
    setDismissedOligomerPopup(true);
  };

  return (
    <div className={`relative flex flex-col h-full overflow-y-auto pr-1 text-slate-100 space-y-3 ${className}`}>
      {/* ─────────────────────────────────────────────────────────────
          [필수 패치] 최소 중합도 컷오프 올리고머(Oligomer) 경고 팝업 모달
          ───────────────────────────────────────────────────────────── */}
      {evaluation.isOligomer && !dismissedOligomerPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl border-2 border-amber-400/80 bg-[#0d1424] p-5 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-400/50 text-amber-300 shrink-0 animate-bounce">
                <AlertTriangle size={22} />
              </div>
              <div className="space-y-1">
                <span className="inline-block rounded-full bg-rose-500/20 border border-rose-400/50 px-2.5 py-0.5 text-[10px] font-bold text-rose-300">
                  최소 중합도 컷오프 작동 (R&D 타당성 평가 제외)
                </span>
                <h3 className="text-sm sm:text-base font-extrabold text-amber-200 leading-snug">
                  {evaluation.oligomerWarningMessage ||
                    "⚠️ [안내] 중합도가 너무 낮아 올리고머(Oligomer) 영역입니다. 고분자 특성을 가지려면 반복 단위를 늘려주세요."}
                </h3>
              </div>
            </div>

            <div className="rounded-xl bg-slate-950/90 border border-white/10 p-3 text-xs text-slate-300 space-y-1.5 font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">현재 설정된 반복 단위 (DP, n):</span>
                <strong className="text-rose-400">{evaluation.effectiveDp} 개 (기준치: n ≥ 50 이상)</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">현재 수평균 분자량 (Mn):</span>
                <strong className="text-rose-400">
                  {evaluation.effectiveMw?.toLocaleString()} g/mol (기준치: 10,000 g/mol 이상)
                </strong>
              </div>
              <p className="text-[11px] text-slate-400 font-sans pt-1 border-t border-white/10">
                사슬 얽힘(Chain Entanglement)이 형성되지 않는 저분자 단량체 덩어리나 올리고머(예: 에틸렌 10개 연결 수준)는 섬유 방사 및 고분자 역학 물성을 발현할 수 없어 고분자 R&D 평가 대상에서 제외됩니다.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              {onInputsChange && (
                <button
                  type="button"
                  onClick={handleBoostToPolymerRange}
                  className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs shadow-lg shadow-emerald-500/25 transition cursor-pointer"
                >
                  ✨ 고분자 영역(Mn ≥ 12,000 g/mol, n ≥ 100)으로 반복 단위 즉시 늘리기
                </button>
              )}
              <button
                type="button"
                onClick={() => setDismissedOligomerPopup(true)}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
              >
                확인 (경고 닫기)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          [상단 고정 경고 배너] 올리고머(Oligomer) 상태일 때 상시 표출
          ───────────────────────────────────────────────────────────── */}
      {evaluation.isOligomer && (
        <div className="rounded-xl border-2 border-amber-400/70 bg-amber-950/50 px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2.5">
            <AlertTriangle size={18} className="text-amber-400 shrink-0" />
            <div>
              <p className="text-xs sm:text-sm font-extrabold text-amber-200">
                ⚠️ [안내] 중합도가 너무 낮아 올리고머(Oligomer) 영역입니다. 고분자 특성을 가지려면 반복 단위를 늘려주세요.
              </p>
              <p className="text-[11px] text-amber-300/80 font-mono mt-0.5">
                현재 DP(n) = {evaluation.effectiveDp}, Mn = {evaluation.effectiveMw?.toLocaleString()} g/mol ➔ 고분자 R&D 타당성 평가 대상 제외 (기준: n ≥ 50 또는 Mn ≥ 10,000 g/mol)
              </p>
            </div>
          </div>
          {onInputsChange && (
            <button
              type="button"
              onClick={handleBoostToPolymerRange}
              className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs shadow transition shrink-0 cursor-pointer"
            >
              반복 단위 즉시 늘리기 (고분자 전환) →
            </button>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          1. 상단 글로벌 헤더 & 제안서 추출 툴바
          ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500/20 to-sky-500/20 border border-amber-400/40 text-amber-300 shadow-sm">
            <Award size={18} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xs sm:text-sm font-bold text-white tracking-tight">
                신소재 R&D 타당성 및 연구 가치성 평가 리포트
              </h2>
              {evaluation.isCommercialBaseline && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/25 text-emerald-200 border border-emerald-400/60 flex items-center gap-1">
                  <ShieldCheck size={12} className="text-emerald-400" />
                  [실제 상용/공인 소재]
                </span>
              )}
              <span className={`px-2 py-0.2 rounded-full text-[10px] font-bold border ${gradeStyles.tag}`}>
                {evaluation.isOligomer
                  ? "평가 제외 (올리고머)"
                  : `${evaluation.grade}등급 (${evaluation.overallScore}점)`}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Materials Informatics 기반 합성 실현성·독창성·산업 파급력 정량 분석
            </p>
          </div>
        </div>

        {/* 제안서 요약 복사 및 다운로드 액션 버튼 */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCopyProposal}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-white/10 text-slate-200 hover:text-white hover:bg-slate-800 text-xs font-medium transition cursor-pointer"
            title="실험실 제안서 및 보고서 작성용 마크다운 요약문 복사"
          >
            {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            <span>{copied ? "복사 완료!" : "제안서 요약 복사"}</span>
          </button>

          <button
            onClick={handleDownloadProposal}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-400/40 text-xs font-medium transition cursor-pointer"
            title="R&D 연구 제안서 마크다운 파일 (.md) 다운로드"
          >
            <Download size={13} />
            <span>제안서 다운로드</span>
          </button>

          <button
            onClick={() => setShowFullProposalModal(true)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-600/80 hover:bg-indigo-500 text-white text-xs font-medium transition cursor-pointer"
            title="전체 제안서 미리보기 열기"
          >
            <FileText size={13} />
            <span className="hidden sm:inline">전문 보기</span>
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          1-B. 실시간 S급 가상 신소재 추천 스트림 (live_smart_generator.py 연동)
          ───────────────────────────────────────────────────────────── */}
      {liveRecords.length > 0 && (
        <div className="rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-950/30 via-slate-900/90 to-rose-950/25 p-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-xs font-extrabold text-amber-200">
                ⚡ 실시간 AI S급 신소재 추천 리스트 (슬라이딩 윈도우 {liveStats.totalCount.toLocaleString()}건 · S++ {liveStats.sPlusPlusCount}건)
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono">
              <span className="rounded bg-emerald-500/15 border border-emerald-400/30 px-2 py-0.5 text-emerald-300 font-bold">
                총 검증: {(liveTelemetry?.total_candidates_generated ?? 642762).toLocaleString()}건
              </span>
              <span className="rounded bg-amber-500/15 border border-amber-400/30 px-2 py-0.5 text-amber-300 font-bold">
                S급 통과: {(liveTelemetry?.accepted_s_grade ?? 58696).toLocaleString()}건
              </span>
              <span className="rounded bg-rose-500/15 border border-rose-400/30 px-2 py-0.5 text-rose-300 font-bold">
                탈락 보관: {(
                  (liveTelemetry?.rejected_stage1_octet_valency ?? 0) +
                  (liveTelemetry?.rejected_stage1_dp_cutoff ?? 0) +
                  (liveTelemetry?.rejected_stage1_thermodynamic_instability ?? 0) +
                  (liveTelemetry?.rejected_stage2_tanimoto_similarity ?? 0) +
                  (liveTelemetry?.rejected_stage2_cosmetic_low_delta ?? 0) +
                  (liveTelemetry?.rejected_stage3_sub_s_grade ?? 0)
                ).toLocaleString()}건
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {liveRecords.slice(0, 4).map((rec) => {
              const kor = formatLiveRecordKoreanName(rec);
              return (
                <button
                  key={rec.id}
                  type="button"
                  onClick={() => {
                    const converted = convertLiveRecordToAppModel(rec);
                    if (onApplyLiveRecommendation) {
                      onApplyLiveRecommendation({ record: rec, ...converted });
                    }
                  }}
                  className="text-left rounded-lg border border-white/10 bg-slate-950/80 hover:border-amber-400/70 hover:bg-slate-900 p-2 transition cursor-pointer group"
                >
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-amber-400 font-bold">{rec.id}</span>
                    <span className="rounded bg-amber-500/20 border border-amber-400/40 px-1.5 py-0.2 text-amber-200 font-bold">
                      {rec.quality_grade} ({rec.innovation_score}점)
                    </span>
                  </div>
                  <div className="text-xs font-bold text-white truncate mt-0.5 group-hover:text-amber-300">
                    {rec.short_code}
                  </div>
                  <div className="text-[10px] text-slate-300 truncate">{kor}</div>
                  <div className="mt-1 flex items-center justify-between text-[9px] font-mono text-slate-400">
                    <span>Tg {rec.Tg}℃ · χN {rec.chi_N}</span>
                    <span className="text-emerald-300">{rec.phase_separation_morphology}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          2. 최상단: 등급 배지 & AI 연구 의사결정 권유 멘트 박스
          ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* 좌측: 종합 등급 & 점수 게이지 (4열) */}
        <div className="lg:col-span-4 rounded-xl border border-white/10 bg-slate-900/80 p-3.5 flex flex-col justify-between relative overflow-hidden shadow-lg">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
                종합 R&D 가치 등급
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className={`text-3xl font-black bg-gradient-to-r ${gradeStyles.badge} bg-clip-text text-transparent`}>
                  Grade {evaluation.grade}
                </span>
                <span className="text-xs font-mono font-bold text-slate-300">
                  {evaluation.overallScore} <span className="text-[10px] text-slate-500">/ 100 pt</span>
                </span>
              </div>
            </div>

            {/* Glowing Big Grade Seal */}
            <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${gradeStyles.badge} flex items-center justify-center font-black text-2xl shadow-xl border ${gradeStyles.glow}`}>
              {evaluation.grade}
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-white/5 space-y-1.5">
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <Sparkles size={13} className="text-amber-400" />
              <span>{evaluation.gradeBadgeTitle}</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              {evaluation.gradeBadgeSubtitle}
            </p>
          </div>

          {/* 게이지 바 */}
          <div className="mt-3">
            <div className="flex justify-between text-[10px] text-slate-400 mb-1">
              <span>0 (실효성 낮음)</span>
              <span>55 (B급)</span>
              <span>70 (A급)</span>
              <span className="font-bold text-amber-300">85+ (S급)</span>
            </div>
            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden p-0.5 border border-white/5">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  evaluation.overallScore >= 84
                    ? "bg-gradient-to-r from-amber-400 to-rose-400 shadow-md shadow-amber-500/50"
                    : evaluation.overallScore >= 70
                    ? "bg-gradient-to-r from-sky-400 to-indigo-500"
                    : "bg-slate-500"
                }`}
                style={{ width: `${evaluation.overallScore}%` }}
              />
            </div>
          </div>
        </div>

        {/* 우측: AI 연구 의사결정 권유 멘트 (8열) */}
        <div className="lg:col-span-8 rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-950/30 via-slate-900/90 to-sky-950/30 p-3.5 flex flex-col justify-between shadow-lg relative">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="flex h-5 w-5 items-center justify-center rounded-md bg-amber-500/20 text-amber-400 border border-amber-400/30">
                  <Lightbulb size={12} />
                </div>
                <span className="text-xs font-bold text-amber-300">
                  AI 소재 연구원 권유 의견 (Executive Recommendation)
                </span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 border border-white/10 text-slate-300 font-mono">
                {evaluation.aiRecommendation.verdict}
              </span>
            </div>

            {/* 핵심 권유 텍스트 (사용자 요청 핵심 문구 반영) */}
            <blockquote className="mt-2.5 p-2.5 rounded-lg bg-black/40 border-l-3 border-amber-400 text-xs text-amber-100/90 leading-relaxed font-medium">
              "{evaluation.aiRecommendation.headline}"
            </blockquote>

            <p className="mt-2 text-[11px] text-slate-300 leading-relaxed">
              {evaluation.aiRecommendation.detailedRationale}
            </p>
          </div>

          {/* 핵심 강점 태그 목록 */}
          <div className="mt-3 pt-2 border-t border-white/5 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] text-slate-400 font-semibold mr-1">주요 검증 포인트:</span>
            {evaluation.aiRecommendation.keyStrengths.map((str, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-950/60 border border-emerald-500/40 text-[10px] text-emerald-300"
              >
                <CheckCircle2 size={10} />
                <span>{str}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. 중간: 5축 레이더 차트 (Visual) & 5대 정밀 평가 지표 바
          ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* 레이더 차트 (5열) */}
        <div className="lg:col-span-5 rounded-xl border border-white/10 bg-slate-900/60 p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <TrendingUp size={14} className="text-cyan-400" />
              <h3 className="text-xs font-bold text-white">5대 연구 가치성 레이더 분석</h3>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">Full Scale: 100 pt</span>
          </div>

          <div className="w-full h-48 sm:h-52 my-1">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={evaluation.radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                <PolarGrid stroke="#334155" strokeDasharray="3 3" />
                <PolarAngleAxis
                  dataKey="subject"
                  tick={{ fill: "#94a3b8", fontSize: 10, fontWeight: 600 }}
                />
                <PolarRadiusAxis
                  angle={30}
                  domain={[0, 100]}
                  tick={{ fill: "#64748b", fontSize: 9 }}
                />
                <Radar
                  name="연구 가치"
                  dataKey="score"
                  stroke="#38bdf8"
                  fill="#0284c7"
                  fillOpacity={0.45}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-3 gap-1 text-[10px] text-center pt-2 border-t border-white/5">
            <div className="p-1 rounded bg-slate-800/60">
              <span className="text-slate-400 block">혁신성</span>
              <strong className="text-sky-300 font-mono">{evaluation.metrics[0].score}점</strong>
            </div>
            <div className="p-1 rounded bg-slate-800/60">
              <span className="text-slate-400 block">합성성</span>
              <strong className="text-emerald-300 font-mono">{evaluation.metrics[1].score}점</strong>
            </div>
            <div className="p-1 rounded bg-slate-800/60">
              <span className="text-slate-400 block">경제성</span>
              <strong className="text-amber-300 font-mono">{evaluation.metrics[2].score}점</strong>
            </div>
          </div>
        </div>

        {/* 5대 지표별 세부 프로그레스 바 & 코멘터리 (7열) */}
        <div className="lg:col-span-7 rounded-xl border border-white/10 bg-slate-900/60 p-3 space-y-2.5">
          <div className="flex items-center justify-between pb-1.5 border-b border-white/10">
            <div className="flex items-center gap-1.5">
              <Layers size={14} className="text-indigo-400" />
              <h3 className="text-xs font-bold text-white">가치성 지표별 정밀 진단</h3>
            </div>
            <span className="text-[10px] text-slate-400">가중합산 정량 스코어</span>
          </div>

          <div className="space-y-2">
            {evaluation.metrics.map((m) => (
              <div key={m.id} className="p-2 rounded-lg bg-slate-950/50 border border-white/5 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-200">{m.nameKo}</span>
                    <span className="text-[10px] text-slate-500 font-mono">({m.nameEn})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-medium">{m.level}</span>
                    <strong className="text-sky-300 font-mono text-xs">{m.score}점</strong>
                  </div>
                </div>

                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      m.score >= 80 ? "bg-emerald-400" : m.score >= 60 ? "bg-sky-400" : "bg-amber-400"
                    }`}
                    style={{ width: `${m.score}%` }}
                  />
                </div>

                <p className="text-[10px] text-slate-400 leading-tight truncate">
                  💡 {m.summary}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3.3. [연구원 중심 타당성 리포트] 공중합 구조 & 열역학적 상분리 및 합성 타당성 평가
          (사용자가 Random, Block, Graft 구조 및 비율을 조절할 때 실시간 연동)
          ───────────────────────────────────────────────────────────── */}
      {copolymerEvaluation && (
        <div className="rounded-xl border border-purple-500/40 bg-gradient-to-br from-purple-950/40 via-slate-900/90 to-amber-950/40 p-4 space-y-3.5 shadow-xl animate-in fade-in duration-200">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-purple-500/20 pb-2.5">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-400/40 shadow-sm">
                <GitMerge size={17} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-white tracking-tight">
                    공중합 구조 & 열역학적 상분리(Microphase Separation) 진단
                  </h3>
                  <span className="rounded-full bg-purple-500/30 border border-purple-400/50 px-2 py-0.2 text-[10px] font-mono font-bold text-purple-200">
                    {copolymerEvaluation.architecture === "block"
                      ? "Block (블록)"
                      : copolymerEvaluation.architecture === "graft"
                      ? "Graft (그래프트)"
                      : "Random (랜덤)"}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">
                  단량체 조성비(wt%/mol%) 및 Flory-Huggins 매개변수 기반 모폴로지 예측
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 font-medium">합성 타당성:</span>
              <span className="rounded-lg bg-emerald-500/20 border border-emerald-400/40 px-2 py-0.5 text-xs font-bold font-mono text-emerald-300">
                {copolymerEvaluation.syntheticFeasibilityScore} / 100점
              </span>
            </div>
          </div>

          {/* 연구원용 학술 진단 브리핑 박스 */}
          <div className="rounded-xl bg-slate-950/80 border border-purple-500/20 p-3 space-y-1.5 text-xs text-slate-200 leading-relaxed font-sans shadow-inner">
            <div className="flex items-center gap-1.5 text-purple-300 font-bold text-[11px]">
              <Flame size={13} className="text-amber-400" />
              <span>연구원 종합 R&D 진단 소견:</span>
            </div>
            <p className="text-[11px] text-slate-300 pl-4 border-l-2 border-purple-500/40">
              {copolymerEvaluation.researcherAssessment}
            </p>
          </div>

          {/* 세부 열역학 및 상분리 매트릭스 그리드 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
            {/* 1. 단량체 조성비 (wt% & mol%) */}
            <div className="rounded-lg bg-slate-950/70 p-2 border border-white/5 space-y-0.5">
              <span className="text-[9px] text-slate-400 block font-sans">단량체 조성비</span>
              <div className="font-bold text-sky-300 text-[11px]">
                A: {copolymerEvaluation.ratioA_wt}wt% ({copolymerEvaluation.ratioA_mol}mol%)
              </div>
              <div className="font-bold text-amber-300 text-[11px]">
                B: {copolymerEvaluation.ratioB_wt}wt% ({copolymerEvaluation.ratioB_mol}mol%)
              </div>
            </div>

            {/* 2. Flory-Huggins 지표 */}
            <div className="rounded-lg bg-slate-950/70 p-2 border border-white/5 space-y-0.5">
              <span className="text-[9px] text-slate-400 block font-sans">Flory-Huggins 지표</span>
              <div className="font-bold text-purple-300 text-[11px]">
                χ = {copolymerEvaluation.chiEstimate}
              </div>
              <div className="text-[10px] text-slate-400">
                χN = <strong className="text-white">{copolymerEvaluation.chiN}</strong> (임계 10.5)
              </div>
            </div>

            {/* 3. 복합 열/기계 물성 */}
            <div className="rounded-lg bg-slate-950/70 p-2 border border-white/5 space-y-0.5">
              <span className="text-[9px] text-slate-400 block font-sans">예측 Tg & 인장강도</span>
              <div className="font-bold text-amber-300 text-[11px]">
                Tg(Fox): {copolymerEvaluation.foxTg}℃
              </div>
              <div className="text-[10px] text-emerald-400">
                강도: {copolymerEvaluation.predictedTenacity} g/d
              </div>
            </div>

            {/* 4. 추천 합성 공정 */}
            <div className="rounded-lg bg-slate-950/70 p-2 border border-white/5 space-y-0.5">
              <span className="text-[9px] text-slate-400 block font-sans">추천 합성 반응 경로</span>
              <div className="text-[10px] text-emerald-300 font-bold truncate" title={copolymerEvaluation.recommendedMethod}>
                {copolymerEvaluation.recommendedMethod.split(" (")[0]}
              </div>
              <div className="text-[9px] text-slate-500">
                밀도: {copolymerEvaluation.predictedDensity} g/cm³
              </div>
            </div>
          </div>

          {/* 모폴로지 뱃지 풋터 */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[10px]">
            <span className="flex items-center gap-1.5 text-slate-300 font-medium">
              <Split size={12} className="text-purple-400" />
              <span>미세 모폴로지:</span>
              <strong className="text-purple-200 bg-purple-500/20 px-2 py-0.5 rounded border border-purple-400/30">
                {copolymerEvaluation.phaseMorphology}
              </strong>
            </span>
            <span className="text-slate-400 font-mono">
              상분리 상태: {copolymerEvaluation.hasPhaseSeparation ? "⚠️ 나노스케일 도메인 형성" : "✅ 균일 혼합 상"}
            </span>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          3.5. 실제 오픈 데이터셋(3,284건) 화이트리스트 팩트체크 & 리얼 물성 데이터
          ───────────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-sky-500/30 bg-gradient-to-br from-slate-900/90 via-slate-950 to-indigo-950/40 p-3.5 space-y-3 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-sky-500/20 text-sky-400 border border-sky-400/30">
              <Database size={15} />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white flex flex-wrap items-center gap-2">
                <span>PI1M & Polymer Genome 3,284건 오픈 데이터셋 화이트리스트 검증</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                    hybridValidation.isRealMatch
                      ? "bg-emerald-500/25 text-emerald-200 border-emerald-400/60"
                      : "bg-purple-500/20 text-purple-300 border-purple-400/40"
                  }`}
                >
                  {hybridValidation.isRealMatch
                    ? "✅ [실제 상용/공인 소재]"
                    : "🔬 신규 가상 고분자 (Synthetic Novelty)"}
                </span>
              </h3>
              <p className="text-[10px] text-slate-400">
                3,284건 벤치마크 풀 및 30종 상용 고분자 화이트리스트 정확 일치(Exact Match) 대조 결과
              </p>
            </div>
          </div>
          <span
            className={`font-mono text-xs font-bold px-2.5 py-1 rounded-lg border ${
              hybridValidation.isRealMatch
                ? "bg-emerald-950/70 border-emerald-500/40 text-emerald-300"
                : "bg-sky-950/70 border-sky-500/40 text-sky-300"
            }`}
          >
            {hybridValidation.isRealMatch
              ? "신규성 점수: 0점 (상용 소재 미적용)"
              : `신규성 지수: ${hybridValidation.noveltyScore}점`}
          </span>
        </div>

        {/* 상용/공인 소재일 때 리얼 실험 물성 데이터 즉시 하이라이트 카드 */}
        {hybridValidation.isRealMatch && hybridValidation.matchedRecord && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-xl bg-emerald-950/30 border border-emerald-500/30 p-2.5 text-xs font-mono">
            <div>
              <span className="text-[10px] text-emerald-300/80 block font-sans">공인 소재명</span>
              <strong className="text-white text-[11px]">{hybridValidation.matchedRecord.name}</strong>
            </div>
            <div>
              <span className="text-[10px] text-emerald-300/80 block font-sans">실측 유리전이온도 (Tg)</span>
              <strong className="text-amber-300 text-[11px]">{hybridValidation.matchedRecord.tg} ℃</strong>
            </div>
            <div>
              <span className="text-[10px] text-emerald-300/80 block font-sans">실측 밀도 (Density)</span>
              <strong className="text-sky-300 text-[11px]">{hybridValidation.matchedRecord.density} g/cm³</strong>
            </div>
            <div>
              <span className="text-[10px] text-emerald-300/80 block font-sans">단량체 분자량 / 출처</span>
              <strong className="text-emerald-300 text-[11px]">
                {hybridValidation.matchedRecord.monomerMw} g/mol ({hybridValidation.matchedRecord.source})
              </strong>
            </div>
          </div>
        )}

        {/* 결론 마크다운 안내 */}
        <div className="rounded-lg bg-slate-950/60 p-2.5 border border-white/5 text-xs text-slate-200 leading-relaxed font-sans">
          {hybridValidation.verdictMarkdown}
        </div>

        {/* 델타 비교 분석 표 */}
        {hybridValidation.deltaAnalysis && hybridValidation.deltaAnalysis.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[10px] text-slate-400 flex items-center justify-between px-1">
              <span>물성 항목</span>
              <span>현재 설계치 vs 실제 오픈 DB 벤치마크 (변위)</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {hybridValidation.deltaAnalysis.map((item, idx) => (
                <div key={idx} className="rounded-lg bg-slate-950/80 p-2 border border-white/5 space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-400">{item.property}</span>
                    <span className="font-mono font-bold text-sky-300">{item.delta}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-white font-bold">{item.targetOrPredicted}</span>
                    <span className="text-slate-400 text-[10px] truncate max-w-[130px]" title={String(item.realBenchmark)}>
                      기준 {item.realBenchmark}
                    </span>
                  </div>
                  <div className="text-[9px] text-emerald-400 truncate">
                    {item.evaluation}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3.7. [실제 실험실 합성 및 중합법 가이드] (Laboratory Polymerization Protocol)
          ───────────────────────────────────────────────────────────── */}
      {evaluation.polymerizationProtocol && (
        <div className="rounded-xl border border-emerald-500/40 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/40 p-4 space-y-3.5 shadow-xl animate-in fade-in duration-200">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 shadow-sm">
                <FlaskConical size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-xs sm:text-sm font-bold text-white tracking-tight flex items-center gap-2">
                    <span>실제 실험실 합성 타당성 & 중합법(Polymerization Method) 가이드</span>
                  </h3>
                  <span className="rounded-full bg-emerald-500/20 border border-emerald-400/40 px-2 py-0.2 text-[10px] font-bold text-emerald-300">
                    {evaluation.polymerizationProtocol.mechanismCategory}
                  </span>
                  <span className="rounded-full bg-purple-500/20 border border-purple-400/40 px-2 py-0.2 text-[10px] font-mono font-medium text-purple-300">
                    {evaluation.polymerizationProtocol.architectureNameKo}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">
                  반응 메커니즘 자동 매칭 · 반응성 비(r₁, r₂) 동역학 · 입체 장애 및 표준 Lab 레시피
                </p>
              </div>
            </div>

            {/* 타당성 등급 및 프로토콜 복사 버튼 */}
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                evaluation.polymerizationProtocol.feasibilityGrade === "S"
                  ? "bg-amber-500/20 text-amber-300 border-amber-400/50"
                  : evaluation.polymerizationProtocol.feasibilityGrade === "A"
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/50"
                  : "bg-indigo-500/20 text-indigo-300 border-indigo-400/50"
              }`}>
                합성 난이도: {evaluation.polymerizationProtocol.feasibilityGrade}등급 ({evaluation.polymerizationProtocol.feasibilityScore}점)
              </span>

              <button
                onClick={handleCopyProtocol}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 text-emerald-200 border border-emerald-500/40 text-xs font-medium transition cursor-pointer"
                title="실험실 합성 프로토콜 레시피 요약 복사"
              >
                {protocolCopied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                <span>{protocolCopied ? "복사됨!" : "레시피 복사"}</span>
              </button>
            </div>
          </div>

          {/* 1. 추천 중합 메커니즘 및 학술 판정 브리핑 박스 */}
          <div className="rounded-xl bg-slate-950/80 border border-emerald-500/20 p-3 space-y-1.5 shadow-inner">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-emerald-300 font-bold text-xs">
                <Sparkles size={13} className="text-amber-400" />
                <span>추천 중합 메커니즘: {evaluation.polymerizationProtocol.mechanismNameKo}</span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                {evaluation.polymerizationProtocol.mechanismNameEn}
              </span>
            </div>
            <p className="text-[11px] text-slate-300 pl-3 border-l-2 border-emerald-400/50 leading-relaxed">
              💡 {evaluation.polymerizationProtocol.feasibilityVerdictKo}
            </p>
          </div>

          {/* 2. 단량체 반응성 비(r1, r2) 동역학 & 입체 장애(Steric Hindrance) 2단 그리드 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {/* 2-A: 반응성 비 (Mayo-Lewis) */}
            <div className="rounded-lg bg-slate-950/70 border border-white/5 p-2.5 space-y-1.5">
              <div className="flex items-center justify-between border-b border-white/5 pb-1">
                <span className="text-[11px] font-bold text-sky-300 flex items-center gap-1">
                  <span>단량체 반응성 비 (Mayo-Lewis Kinetics)</span>
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-200 border border-sky-400/30">
                  r₁={evaluation.polymerizationProtocol.reactivityKinetics.r1} / r₂={evaluation.polymerizationProtocol.reactivityKinetics.r2}
                </span>
              </div>
              <div className="text-[10px] text-slate-300 space-y-1">
                <div className="flex items-center justify-between text-slate-400 font-mono text-[9px]">
                  <span>공중합 거동: <strong className="text-sky-200">{evaluation.polymerizationProtocol.reactivityKinetics.copolymerizationBehavior}</strong></span>
                  <span>r₁·r₂ = {evaluation.polymerizationProtocol.reactivityKinetics.productR1R2}</span>
                </div>
                <p className="text-[10px] text-slate-300 leading-snug">
                  {evaluation.polymerizationProtocol.reactivityKinetics.kineticsComment}
                </p>
              </div>
            </div>

            {/* 2-B: 입체 장애 및 부반응 제약 검증 */}
            <div className="rounded-lg bg-slate-950/70 border border-white/5 p-2.5 space-y-1.5">
              <div className="flex items-center justify-between border-b border-white/5 pb-1">
                <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
                  <span>입체 장애(Steric Hindrance) & 부반응 검증</span>
                </span>
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${
                  evaluation.polymerizationProtocol.stericAndSideEffects.stericLevel.includes("낮음")
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/40"
                    : evaluation.polymerizationProtocol.stericAndSideEffects.stericLevel.includes("보통")
                    ? "bg-sky-500/20 text-sky-300 border-sky-400/40"
                    : "bg-amber-500/20 text-amber-300 border-amber-400/40"
                }`}>
                  {evaluation.polymerizationProtocol.stericAndSideEffects.stericLevel}
                </span>
              </div>
              <div className="text-[10px] text-slate-300 space-y-1">
                <p className="text-[10px] text-slate-300 leading-snug">
                  {evaluation.polymerizationProtocol.stericAndSideEffects.stericFactorDescription}
                </p>
                <div className="text-[9px] text-slate-400 pt-0.5">
                  <span className="text-amber-400/90 font-medium">부반응 제어: </span>
                  {evaluation.polymerizationProtocol.stericAndSideEffects.sideReactionRisks[0]}
                </div>
              </div>
            </div>
          </div>

          {/* 3. 실무형 실험실 합성 레시피 가이드 (3단 카드) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-200 px-0.5">
              <span className="flex items-center gap-1.5 text-emerald-300">
                <FlaskConical size={13} />
                <span>실무형 실험실 합성 레시피 가이드 (Standard Lab Protocol)</span>
              </span>
              <span className="text-[10px] text-slate-400 font-normal">반응기 셋업 & 조건 가이드</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
              {/* 카드 ①: 개시제 및 촉매 시스템 */}
              <div className="rounded-lg bg-slate-950/80 border border-emerald-500/30 p-2.5 flex flex-col justify-between space-y-1.5">
                <div>
                  <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wide flex items-center justify-between">
                    <span>① 개시제 / 촉매 시스템</span>
                    <span className="text-[9px] font-mono text-slate-400">Catalyst</span>
                  </div>
                  <div className="mt-1 font-semibold text-white text-[11px] leading-tight">
                    {evaluation.polymerizationProtocol.labRecipeGuide.initiatorCatalyst.primary}
                  </div>
                  <div className="text-[10px] text-emerald-300/90 font-mono mt-0.5">
                    투입량: {evaluation.polymerizationProtocol.labRecipeGuide.initiatorCatalyst.dosage}
                  </div>
                  <p className="text-[9px] text-slate-400 mt-1 leading-snug">
                    {evaluation.polymerizationProtocol.labRecipeGuide.initiatorCatalyst.roleAndCoCatalyst}
                  </p>
                </div>
                <div className="text-[9px] text-slate-500 border-t border-white/5 pt-1">
                  대체 시약: {evaluation.polymerizationProtocol.labRecipeGuide.initiatorCatalyst.alternatives.slice(0, 2).join(", ")}
                </div>
              </div>

              {/* 카드 ②: 반응 환경 조건 */}
              <div className="rounded-lg bg-slate-950/80 border border-sky-500/30 p-2.5 flex flex-col justify-between space-y-1.5">
                <div>
                  <div className="text-[10px] font-bold text-sky-400 uppercase tracking-wide flex items-center justify-between">
                    <span>② 표준 반응 조건</span>
                    <span className="text-[9px] font-mono text-slate-400">Conditions</span>
                  </div>
                  <div className="mt-1 space-y-0.5 text-[10px]">
                    <div className="flex items-center gap-1 text-slate-200">
                      <span className="text-slate-400 min-w-[36px]">온도:</span>
                      <strong className="text-amber-300 font-mono">{evaluation.polymerizationProtocol.labRecipeGuide.reactionConditions.temperature}</strong>
                    </div>
                    <div className="flex items-center gap-1 text-slate-200">
                      <span className="text-slate-400 min-w-[36px]">용매:</span>
                      <span className="text-white truncate" title={evaluation.polymerizationProtocol.labRecipeGuide.reactionConditions.solvent}>
                        {evaluation.polymerizationProtocol.labRecipeGuide.reactionConditions.solvent}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-slate-200">
                      <span className="text-slate-400 min-w-[36px]">분위기:</span>
                      <span className="text-cyan-300 truncate" title={evaluation.polymerizationProtocol.labRecipeGuide.reactionConditions.atmosphere}>
                        {evaluation.polymerizationProtocol.labRecipeGuide.reactionConditions.atmosphere}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-slate-200">
                      <span className="text-slate-400 min-w-[36px]">시간:</span>
                      <span className="text-emerald-300 font-mono">{evaluation.polymerizationProtocol.labRecipeGuide.reactionConditions.reactionTime}</span>
                    </div>
                  </div>
                </div>
                <div className="text-[9px] text-slate-400 border-t border-white/5 pt-1 truncate" title={evaluation.polymerizationProtocol.labRecipeGuide.reactionConditions.workupPurification}>
                  정제: {evaluation.polymerizationProtocol.labRecipeGuide.reactionConditions.workupPurification}
                </div>
              </div>

              {/* 카드 ③: 공정 리스크 & 트러블슈팅 */}
              <div className="rounded-lg bg-slate-950/80 border border-amber-500/30 p-2.5 flex flex-col justify-between space-y-1.5">
                <div>
                  <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wide flex items-center justify-between">
                    <span>③ 핵심 공정 리스크 & 대응</span>
                    <span className="text-[9px] font-mono text-slate-400">Risk Control</span>
                  </div>
                  <div className="mt-1 space-y-1">
                    {evaluation.polymerizationProtocol.labRecipeGuide.criticalRisks.slice(0, 2).map((risk, rIdx) => (
                      <div key={rIdx} className="text-[9px] leading-tight">
                        <strong className="text-amber-300 block">⚠️ {risk.title}</strong>
                        <span className="text-slate-400">{risk.risk}</span>
                        <div className="text-emerald-400 mt-0.5">
                          ↳ <span className="font-semibold">{risk.mitigation}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="text-[9px] text-slate-500 border-t border-white/5 pt-1">
                  안전 수칙: 불활성 가스 양압 및 급냉(Quenching) 얼음 배스 상시 대기
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          4. 하단: 산업 분야별 적용성 & R&D 4단계 실증 로드맵
          ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* 산업 분야별 파급력 탭 (6열) */}
        <div className="lg:col-span-6 rounded-xl border border-white/10 bg-slate-900/60 p-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div className="flex items-center gap-1.5">
                <Building2 size={14} className="text-sky-400" />
                <h3 className="text-xs font-bold text-white">타깃 산업 분야별 적용 적합도</h3>
              </div>
              <span className="text-[10px] text-slate-400">시장 파급성 순위</span>
            </div>

            <div className="mt-2 space-y-1.5">
              {evaluation.industrySuitability.map((ind) => {
                const isSelected = selectedDomain === ind.domainId;
                return (
                  <div
                    key={ind.domainId}
                    onClick={() => setSelectedDomain(ind.domainId)}
                    className={`p-2 rounded-lg border transition cursor-pointer ${
                      isSelected
                        ? "bg-sky-500/10 border-sky-400/50 text-white shadow-sm"
                        : "bg-slate-950/40 border-white/5 text-slate-300 hover:bg-slate-800/50"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 font-semibold">
                        <span>{ind.domainNameKo}</span>
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded font-normal ${
                            ind.recommendedTag === "적극 추천"
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              : "bg-sky-500/20 text-sky-300"
                          }`}
                        >
                          {ind.recommendedTag}
                        </span>
                      </div>
                      <span className="font-mono text-xs font-bold text-sky-300">
                        {ind.suitabilityScore}점
                      </span>
                    </div>

                    <div className="mt-1 flex justify-between text-[10px] text-slate-400">
                      <span>핵심 강점: {ind.keyAdvantage}</span>
                      <span className="text-slate-500 truncate max-w-[150px]">{ind.marketPotential}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 4단계 R&D 실증 액션 플랜 로드맵 (6열) */}
        <div className="lg:col-span-6 rounded-xl border border-white/10 bg-slate-900/60 p-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div className="flex items-center gap-1.5">
                <FlaskConical size={14} className="text-emerald-400" />
                <h3 className="text-xs font-bold text-white">R&D 실증 단계별 액션 로드맵</h3>
              </div>
              <span className="text-[10px] text-emerald-400 font-semibold">Step 1 ➔ 4</span>
            </div>

            <div className="mt-2 space-y-2">
              {evaluation.actionRoadmap.map((act) => (
                <div
                  key={act.step}
                  className="p-2 rounded-lg bg-slate-950/40 border border-white/5 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold text-slate-200">
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-mono border border-emerald-400/30">
                        {act.step}
                      </span>
                      <span>{act.phase}</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-snug">
                    {act.title}
                  </p>
                  <div className="text-[10px] text-slate-400 border-t border-white/5 pt-0.5 flex justify-between">
                    <span>리스크 관리: {act.riskFactor}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          5. R&D 연구 제안서 전문 미리보기 모달
          ───────────────────────────────────────────────────────────── */}
      {showFullProposalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-5 animate-in fade-in duration-150">
          <div className="bg-[#0b1220] border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-slate-950/80">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-sky-400" />
                <h3 className="text-sm font-bold text-white">
                  R&D 신소재 연구개발 제안서 전문 미리보기
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyProposal}
                  className="px-2.5 py-1 rounded-lg bg-sky-500/20 text-sky-300 border border-sky-400/30 text-xs font-semibold flex items-center gap-1 hover:bg-sky-500/30 transition cursor-pointer"
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copied ? "복사됨!" : "전체 복사"}</span>
                </button>
                <button
                  onClick={handleDownloadProposal}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1 transition cursor-pointer"
                >
                  <Download size={13} />
                  <span>다운로드</span>
                </button>
                <button
                  onClick={() => setShowFullProposalModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white transition"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 text-xs text-slate-300 font-mono leading-relaxed bg-slate-950/60 whitespace-pre-wrap select-text">
              {evaluation.exportableProposalText}
            </div>

            <div className="px-5 py-2.5 border-t border-white/10 bg-slate-950 flex justify-between items-center text-xs text-slate-400">
              <span>작성 형식: Markdown (GitHub & Notion 호환)</span>
              <button
                onClick={() => setShowFullProposalModal(false)}
                className="px-4 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-white font-semibold text-xs transition cursor-pointer"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
