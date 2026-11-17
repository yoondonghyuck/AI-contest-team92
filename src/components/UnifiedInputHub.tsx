import React from "react";
import { PenTool, Box, Bot } from "lucide-react";

export type InputHubMode = "2d_sketch" | "3d_viewer" | "chat_ai";

export interface UnifiedInputHubTabsProps {
  activeMode: InputHubMode;
  onChangeMode: (mode: InputHubMode) => void;
  className?: string;
}

export const UnifiedInputHubTabs: React.FC<UnifiedInputHubTabsProps> = ({
  activeMode,
  onChangeMode,
  className = "",
}) => {
  return (
    <div
      className={`inline-flex items-center rounded-xl bg-slate-900/90 p-1 border border-white/10 shadow-lg backdrop-blur-md ${className}`}
    >
      {/* 탭 1: 2D 스케치 */}
      <button
        type="button"
        onClick={() => onChangeMode("2d_sketch")}
        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
          activeMode === "2d_sketch"
            ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
            : "text-slate-400 hover:text-white hover:bg-white/5"
        }`}
        title="2D 분자 구조 그리기: 캔버스에 직접 원자와 결합선, 벤젠 고리 등을 드로잉"
      >
        <PenTool size={13} />
        <span>1. 2D 스케치</span>
      </button>

      {/* 탭 2: 3D 뷰어 */}
      <button
        type="button"
        onClick={() => onChangeMode("3d_viewer")}
        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
          activeMode === "3d_viewer"
            ? "bg-sky-500 text-slate-950 font-bold shadow-md shadow-sky-500/30"
            : "text-slate-400 hover:text-white hover:bg-white/5"
        }`}
        title="3D 인터랙티브 뷰어: 3차원 고분자 사슬 회전, 섬유 단면 형상 및 방사 변수 조작"
      >
        <Box size={13} />
        <span>2. 3D 뷰어</span>
      </button>

      {/* 탭 3: 채팅 입력 (AI 3D) */}
      <button
        type="button"
        onClick={() => onChangeMode("chat_ai")}
        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
          activeMode === "chat_ai"
            ? "bg-gradient-to-r from-sky-500 via-indigo-600 to-purple-600 text-white shadow-md shadow-purple-600/30 ring-1 ring-white/20"
            : "text-slate-400 hover:text-white hover:bg-white/5"
        }`}
        title="자연어 대화형 3D 분자 에디터: 채팅으로 '벤젠 고리 사슬 만들어줘', '결합 길이 1.8Å로 늘려줘' 실시간 3D 렌더링"
      >
        <Bot size={14} className={activeMode === "chat_ai" ? "text-sky-200 animate-pulse" : ""} />
        <span>3. 채팅 입력 (AI 3D)</span>
        <span className="rounded-full bg-white/20 px-1.5 py-0.2 text-[9px] font-mono">
          Live
        </span>
      </button>
    </div>
  );
};
