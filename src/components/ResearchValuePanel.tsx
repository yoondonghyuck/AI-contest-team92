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
} from "lucide-react";
import type { PolymerDefinition } from "../model/polymers";
import type { FiberInputs, ComprehensiveProperties } from "../types";
import type { AtomNode, BondEdge } from "./MolDrawCanvas";
import {
  evaluateResearchValue,
  type ResearchValueEvaluationResult,
} from "../model/researchValueEvaluator";

export interface ResearchValuePanelProps {
  currentPolymer: PolymerDefinition;
  inputs: FiberInputs;
  comprehensive: ComprehensiveProperties;
  sketchAtoms?: AtomNode[];
  sketchBonds?: BondEdge[];
  className?: string;
}

export const ResearchValuePanel: React.FC<ResearchValuePanelProps> = ({
  currentPolymer,
  inputs,
  comprehensive,
  sketchAtoms,
  sketchBonds,
  className = "",
}) => {
  const [copied, setCopied] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<string>("automotive");
  const [showFullProposalModal, setShowFullProposalModal] = useState<boolean>(false);

  // 실시간 R&D 가치성 평가 계산
  const evaluation: ResearchValueEvaluationResult = useMemo(() => {
    return evaluateResearchValue({
      currentPolymer,
      inputs,
      comprehensive,
      sketchAtoms,
      sketchBonds,
    });
  }, [currentPolymer, inputs, comprehensive, sketchAtoms, sketchBonds]);

  // 클립보드 복사
  const handleCopyProposal = () => {
    navigator.clipboard.writeText(evaluation.exportableProposalText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
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

  return (
    <div className={`flex flex-col h-full overflow-y-auto pr-1 text-slate-100 space-y-3 ${className}`}>
      {/* ─────────────────────────────────────────────────────────────
          1. 상단 글로벌 헤더 & 제안서 추출 툴바
          ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500/20 to-sky-500/20 border border-amber-400/40 text-amber-300 shadow-sm">
            <Award size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs sm:text-sm font-bold text-white tracking-tight">
                신소재 R&D 타당성 및 연구 가치성 평가 리포트
              </h2>
              <span className={`px-2 py-0.2 rounded-full text-[10px] font-bold border ${gradeStyles.tag}`}>
                {evaluation.grade}등급 ({evaluation.overallScore}점)
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
