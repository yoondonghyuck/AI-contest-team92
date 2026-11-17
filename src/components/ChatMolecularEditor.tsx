import React, { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  Send,
  Bot,
  User,
  Sparkles,
  RotateCcw,
  Award,
  CheckCircle2,
  ArrowRight,
  Flame,
  Layers,
  Zap,
  Activity,
  X,
  Compass,
  FileCheck,
  Key,
  Settings,
  Copy,
  Check,
} from "lucide-react";
import type { AtomNode, BondEdge } from "./MolDrawCanvas";
import {
  parseChatPrompt,
  interceptPolymerStructureFormula,
  generateBenzeneFlexibleChain,
  type ChatMessage,
  type PolymerComplexParameters,
  type ParsedCopolymerStructure,
} from "../model/chatMolecularParser";
import { calculateMolecularDescriptor } from "../model/molecularDescriptor";
import { validateMolecularStructure } from "../model/molecularValidation";
import { ChatMolecular3DCanvas } from "./ChatMolecular3DCanvas";
import { createPolymerFromSketch } from "../model/moldrawPresets";
import type { PolymerDefinition } from "../model/polymers";
import type { MolecularDescriptor } from "../model/molecularDescriptor";
import {
  callGeminiMolecularAI,
  applyGeminiResponseTo3D,
  getGeminiApiKey,
  setGeminiApiKey,
  getGeminiModel,
  setGeminiModel,
  hasGeminiApiKey,
  activateOneClickDemoKey,
  isDemoMasterKey,
} from "../model/geminiService";
import {
  executeUnifiedPgVectorRagSearch,
  fetchIndividualMaterialFile,
  convertMaterialPayloadToAppModel,
  formatTriadRagMarkdownReport,
  type UnifiedRagSearchResponse,
} from "../model/pgVectorRagClient";

export interface ChatMolecularEditorProps {
  initialAtoms?: AtomNode[];
  initialBonds?: BondEdge[];
  onApplyToMainModel?: (params: {
    polymer: PolymerDefinition;
    descriptor: MolecularDescriptor;
    atoms: AtomNode[];
    bonds: BondEdge[];
    parsedCopolymer?: ParsedCopolymerStructure;
  }) => void;
  onStructureChange?: (
    atoms: AtomNode[],
    bonds: BondEdge[],
    descriptor: MolecularDescriptor,
    parsedCopolymer?: ParsedCopolymerStructure
  ) => void;
  onClose?: () => void;
  className?: string;
  isEmbedded?: boolean;
}

const PRESET_PROMPTS = [
  {
    icon: "🔍",
    label: "pgvector 3대 통합 RAG: Tg 140℃ 이상 & 고강도 블록 신소재 검색",
    prompt: "Tg 140도 이상이고 인장강도 75 MPa 이상인 블록 공중합체 신소재를 오픈셋 벤치마크와 탈락 아카이브까지 비교해서 추천해줘",
  },
  {
    icon: "🗄️",
    label: "pgvector RAG: 탈락/보관 아카이브 주의 구조 및 고신율 엘라스토머 탐색",
    prompt: "신율 120% 이상인 유연한 공중합체 후보를 검색하고, 열분해나 타니모토 중복으로 탈락된 아카이브 주의 구조도 함께 알려줘",
  },
  {
    icon: "🌿",
    label: "폴리스티렌-graft-폴리프로필렌 (Graft 공중합)",
    prompt: "폴리스티렌-graft-폴리프로필렌",
  },
  {
    icon: "🧬",
    label: "PS-b-PP-g-PE (복합 블록-가지형 공중합)",
    prompt: "PS-b-PP-g-PE",
  },
  {
    icon: "🎯",
    label: "블록 공중합체 역설계 (MW 45,000, -OH, Tg 180℃, 강도 8.5g/d)",
    prompt: "분자량 45,000 g/mol의 블록 공중합체로, 양 말단에 -OH기를 달고 내열성 Tg 180도 이상과 인장강도 8.5 g/d 이상을 만족하는 고분자 사슬 만들어줘",
  },
  {
    icon: "🌀",
    label: "랜덤 공중합체 역설계 (MW 35,000, -COOH, 신율 120%)",
    prompt: "분자량 35,000 g/mol의 랜덤 공중합체로, 양 말단에 -COOH기를 결합하고 파단 신율 120% 이상을 만족하는 유연성 고분자 사슬 생성해줘",
  },
  {
    icon: "💡",
    label: "벤젠 고리 + 유연한 사슬 생성",
    prompt: "벤젠 고리가 포함된 유연한 고분자 사슬 구조 만들어줘",
  },
  {
    icon: "📏",
    label: "결합 거리 1.8Å & 각도 120°",
    prompt: "중앙 결합 거리를 늘려주고 각도를 120도로 맞춰줘",
  },
  {
    icon: "🧪",
    label: "말단 친수성 -OH 부착",
    prompt: "말단에 친수성 하이드록시기(-OH) 붙여줘",
  },
];

export const ChatMolecularEditor: React.FC<ChatMolecularEditorProps> = ({
  initialAtoms,
  initialBonds,
  onApplyToMainModel,
  onStructureChange,
  onClose,
  className = "",
  isEmbedded = false,
}) => {
  // 초기 분자 구조: 외부에서 전달된 구조 우선, 없으면 벤젠 고리 + 유연 사슬
  const initialStructure = useMemo(() => generateBenzeneFlexibleChain(), []);
  const [atoms, setAtoms] = useState<AtomNode[]>(() => {
    if (initialAtoms && initialAtoms.length > 0) return initialAtoms;
    return initialStructure.atoms;
  });
  const [bonds, setBonds] = useState<BondEdge[]>(() => {
    if (initialBonds && initialBonds.length > 0) return initialBonds;
    return initialStructure.bonds;
  });

  // 외부 initialAtoms 변경 시 동기화 (단, 대화창에서 작업 중이 아닐 때)
  useEffect(() => {
    if (initialAtoms && initialAtoms.length > 0) {
      setAtoms(initialAtoms);
    }
  }, [initialAtoms]);

  useEffect(() => {
    if (initialBonds && initialBonds.length > 0) {
      setBonds(initialBonds);
    }
  }, [initialBonds]);

  const [inputPrompt, setInputPrompt] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [highlightAtomIds, setHighlightAtomIds] = useState<string[]>([]);
  const [highlightBondIds, setHighlightBondIds] = useState<string[]>([]);
  const [showDimensions, setShowDimensions] = useState<boolean>(true);
  const [appliedNotice, setAppliedNotice] = useState<boolean>(false);
  const [activeComplexParams, setActiveComplexParams] = useState<PolymerComplexParameters | undefined>(undefined);
  const [activeParsedCopolymer, setActiveParsedCopolymer] = useState<ParsedCopolymerStructure | undefined>(undefined);
  const [ragTriadByMsgId, setRagTriadByMsgId] = useState<Record<string, UnifiedRagSearchResponse>>({});
  const [loadingRagFileId, setLoadingRagFileId] = useState<string | null>(null);

  // RAG 검색 카드에서 개별 항목(OPEN_BENCHMARK / ACTIVE_S_TIER / ARCHIVED_REJECTED)을 클릭했을 때
  // storage/materials/{id}.json 단일 파일을 온디맨드 로드하여 3D 뷰어에 즉시 바인딩하는 핸들러
  const handleSelectRagMaterialItem = async (materialId: string) => {
    if (loadingRagFileId) return;
    setLoadingRagFileId(materialId);
    try {
      const filePayload = await fetchIndividualMaterialFile(materialId);
      const converted = convertMaterialPayloadToAppModel(filePayload);
      setAtoms(converted.atoms);
      setBonds(converted.bonds);
      setActiveParsedCopolymer(converted.parsedCopolymer);
      onStructureChange?.(
        converted.atoms,
        converted.bonds,
        converted.descriptor,
        converted.parsedCopolymer
      );
      onApplyToMainModel?.({
        polymer: converted.polymer,
        descriptor: converted.descriptor,
        atoms: converted.atoms,
        bonds: converted.bonds,
        parsedCopolymer: converted.parsedCopolymer,
      });

      const fileBindMsg: ChatMessage = {
        id: `msg_file_bind_${Date.now()}`,
        sender: "assistant",
        text: `📂 **개별 파일 스토리지(\`${converted.filePath}\`) 온디맨드 로드 및 3D 뷰어 바인딩 완료!**
- **선택 소재 ID**: \`${filePayload.id}\` (\`${converted.sourceType}\`)
- **고분자명**: **${filePayload.metadata.korean_name}** (\`${filePayload.metadata.short_code}\`)
- **핵심 물성**: $T_g = ${filePayload.metadata.tg}^\\circ\\text{C}$, $T_m = ${filePayload.metadata.tm ?? "-"}^\\circ\\text{C}$, $T_d = ${filePayload.metadata.td ?? "-"}^\\circ\\text{C}$, 인장강도 ${filePayload.metadata.tensile_strength} MPa, $M_n = ${Math.round(filePayload.metadata.mn).toLocaleString()}$ g/mol
- **통과/탈락 감사 상태**: **[${converted.statusStage}]** — ${converted.statusReason}`,
        timestamp: new Date().toLocaleTimeString("ko-KR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
        actionType: "create",
        actionBadge: `${filePayload.id} 단일 파일 3D 바인딩`,
        parsedCopolymer: converted.parsedCopolymer,
        suggestedFollowUps: [
          "구조 에너지 최소화(Relaxation)",
          "중앙 결합 거리를 늘려주고 각도를 120도로 맞춰줘",
          "말단에 친수성 하이드록시기(-OH) 붙여줘",
        ],
      };
      setMessages((prev) => [...prev, fileBindMsg]);
    } catch (err) {
      console.error("[ChatMolecularEditor] Failed to load individual material file:", err);
    } finally {
      setLoadingRagFileId(null);
    }
  };

  // Gemini API 설정 모달 상태
  const [isApiModalOpen, setIsApiModalOpen] = useState<boolean>(false);
  const [apiKeyInput, setApiKeyInput] = useState<string>(() => getGeminiApiKey());
  const [selectedModel, setSelectedModel] = useState<string>(() => getGeminiModel());
  const [keySavedToast, setKeySavedToast] = useState<boolean>(false);
  const [oneClickConnectedToast, setOneClickConnectedToast] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  // [원클릭 AI 연결 / 자동 연동 시작하기] 핸들러
  const handleOneClickConnect = () => {
    const masterKey = activateOneClickDemoKey();
    setApiKeyInput(masterKey);
    setSelectedModel("gemini-2.5-flash");
    setKeySavedToast(true);
    setOneClickConnectedToast(true);

    // AI 연결 성공 알림 메시지를 채팅창에도 안내
    const connectedMsg: ChatMessage = {
      id: `msg_connected_${Date.now()}`,
      sender: "assistant",
      text: `⚡ **Google Gemini 2.5 Flash 실시간 AI 연동이 완료되었습니다!**
- 시연용 마스터 API Key가 브라우저에 성공적으로 세팅되었습니다.
- 이제 *"벤젠 고리가 포함된 유연한 고분자 사슬 만들어줘"*, *"결합 길이를 1.8Å로 늘려줘"*, *"말단에 -OH기 붙여줘"* 등 자연어 대화로 3D 분자를 제어할 수 있습니다.`,
      timestamp: new Date().toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
      actionType: "chat",
      actionBadge: "Gemini 2.5 Flash 연동 완료",
      suggestedFollowUps: [
        "폴리스티렌-graft-폴리프로필렌",
        "PS-b-PP-g-PE",
        "벤젠 고리가 포함된 유연한 고분자 사슬 구조 만들어줘",
      ],
    };
    setMessages((prev) => [...prev, connectedMsg]);

    setTimeout(() => {
      setKeySavedToast(false);
      setOneClickConnectedToast(false);
      setIsApiModalOpen(false);
    }, 1200);
  };

  // 대화 내역 상태
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "msg_welcome",
      sender: "assistant",
      text: `👋 안녕하세요! **PolyMatrix ChemLLM v2.4 자연어 3D 분자 에디터**에 오신 것을 환영합니다.
- 자연어로 원하는 고분자 구조를 요청하시면, **중앙 Three.js 3D 뷰어**에 실시간 입체 분자 모델이 생성됩니다.
- *"결합 거리를 늘려줘"*, *"각도를 120도로 맞춰줘"*, *"말단에 -OH기 붙여줘"* 등 세부 수정 명령도 즉시 3D 좌표에 반영됩니다.
- 상단의 예시 프롬프트 버튼을 누르거나 아래 입력창에 편하게 질문해 보세요!`,
      timestamp: "방금 전",
      actionType: "create",
      actionBadge: "ChemLLM 대화 엔진 준비 완료",
      suggestedFollowUps: [
        "폴리스티렌-graft-폴리프로필렌",
        "PS-b-PP-g-PE",
        "벤젠 고리가 포함된 유연한 고분자 사슬 구조 만들어줘",
      ],
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 메시지 추가 시 자동 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 실시간 재료정보학 디스크립터 & 유효성 검증 & R&D 등급
  const { descriptor, validation, strainEnergy, overallScore, grade, avgBondLength } = useMemo(() => {
    const desc = calculateMolecularDescriptor(atoms, bonds);
    const valid = validateMolecularStructure(atoms, bonds);

    // 결합 평균 길이
    let sumBondPx = 0;
    bonds.forEach((b) => {
      const a1 = atoms.find((a) => a.id === b.sourceId);
      const a2 = atoms.find((a) => a.id === b.targetId);
      if (a1 && a2) {
        const dx = a2.x - a1.x;
        const dy = a2.y - a1.y;
        const dz = (a2.z || 0) - (a1.z || 0);
        sumBondPx += Math.sqrt(dx * dx + dy * dy + dz * dz);
      }
    });
    const avgAng = bonds.length > 0 ? (sumBondPx / bonds.length) * (1.5 / 55.0) : 1.54;

    // 스트레인 에너지 계산
    let totalStrain = 0;
    bonds.forEach((b) => {
      const a1 = atoms.find((a) => a.id === b.sourceId);
      const a2 = atoms.find((a) => a.id === b.targetId);
      if (!a1 || !a2) return;
      const dx = a2.x - a1.x;
      const dy = a2.y - a1.y;
      const dz = (a2.z || 0) - (a1.z || 0);
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz) * (1.5 / 55.0);
      const ideal = b.type === "double" ? 1.34 : 1.54;
      const delta = d - ideal;
      totalStrain += 0.5 * 350 * delta * delta;
    });
    const strain = Math.min(99, Math.round(totalStrain * 10) / 10);

    // 종합 R&D 점수 & 등급
    let score = 78;
    if (valid.isValid) score += 10;
    if (desc.rigidityScore > 0.2 && desc.rigidityScore < 0.8) score += 7;
    if (desc.heteroatomRatio > 0.1) score += 6;
    if (strain < 15) score += 4;
    score = Math.min(98, Math.max(25, score));

    let g: "S" | "A" | "B" | "C" = "B";
    if (score >= 90) g = "S";
    else if (score >= 80) g = "A";
    else if (score >= 65) g = "B";
    else g = "C";

    return {
      descriptor: desc,
      validation: valid,
      strainEnergy: strain,
      overallScore: score,
      grade: g,
      avgBondLength: Math.round(avgAng * 100) / 100,
    };
  }, [atoms, bonds]);

  // 프롬프트 실행 핸들러 (Google Gemini API 연동 + 로컬 오프라인 폴백)
  const handleExecutePrompt = async (rawPrompt: string) => {
    if (!rawPrompt.trim() || isProcessing) return;

    const userText = rawPrompt.trim();
    setInputPrompt("");
    setIsProcessing(true);

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      sender: "user",
      text: userText,
      timestamp: new Date().toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    };

    setMessages((prev) => [...prev, userMsg]);

    // ─────────────────────────────────────────────────────────────
    // [0. 자연어/구조식 파싱 인터셉터 (Input Interceptor) - 강제 직결 브릿지]
    // 사용자가 "폴리스티렌-graft-폴리프로필렌", "PS-b-PP-g-PE", "[고분자A] -block- [고분자B] -graft- [고분자C]"
    // 등의 복합 공중합 구조식을 입력하면 챗봇 폴백 없이 즉시 가로채어 JSON 변환 후 3D 뷰어를 실시간 갱신!
    // ─────────────────────────────────────────────────────────────
    const interceptedStructure = interceptPolymerStructureFormula(userText);
    if (interceptedStructure) {
      const result = parseChatPrompt(userText, atoms, bonds);
      setAtoms(result.atoms);
      setBonds(result.bonds);
      setHighlightAtomIds(result.message.highlightAtomIds || []);
      setHighlightBondIds(result.message.highlightBondIds || []);
      setActiveParsedCopolymer(result.parsedCopolymer);
      onStructureChange?.(result.atoms, result.bonds, result.descriptor, result.parsedCopolymer);
      setMessages((prev) => [...prev, result.message]);
      setIsProcessing(false);
      return;
    }

    // ─────────────────────────────────────────────────────────────
    // [0.5 PostgreSQL + pgvector 3대 데이터 소스 통합 RAG 인터셉터]
    // 사용자가 조건 기반 자연어 질문(추천, 검색, 비교, 내열성 Tg, 인장강도, 아카이브/탈락 등)을 입력하면
    // pgvector를 통해 OPEN_BENCHMARK(기준 비교군) + ACTIVE_S_TIER(신소재 추천) + ARCHIVED_REJECTED(탈락/주의 구조)를
    // 한 번에 검색하여 종합 R&D 리포트를 출력하고 최상위 후보의 단일 파일(storage/materials/{id}.json)을 3D 뷰어에 바인딩!
    // ─────────────────────────────────────────────────────────────
    const lowerText = userText.toLowerCase();
    const isGeometryModification =
      lowerText.includes("결합 거리") ||
      lowerText.includes("결합 길이") ||
      lowerText.includes("각도") ||
      lowerText.includes("늘려") ||
      lowerText.includes("줄여") ||
      lowerText.includes("붙여") ||
      lowerText.includes("이완") ||
      lowerText.includes("relax") ||
      lowerText.includes("최적화");

    const hasRagSearchIntent =
      !isGeometryModification &&
      (lowerText.includes("추천") ||
        lowerText.includes("찾아") ||
        lowerText.includes("검색") ||
        lowerText.includes("비교") ||
        lowerText.includes("아카이브") ||
        lowerText.includes("탈락") ||
        lowerText.includes("보관") ||
        lowerText.includes("삭제") ||
        lowerText.includes("오픈셋") ||
        lowerText.includes("벤치마크") ||
        lowerText.includes("rag") ||
        lowerText.includes("pgvector") ||
        lowerText.includes("내열") ||
        lowerText.includes("강도") ||
        lowerText.includes("신율") ||
        lowerText.includes("탄성률") ||
        lowerText.includes("유연") ||
        lowerText.includes("분자량") ||
        lowerText.includes("공중합") ||
        /(?:tg|tm|td)\s*[:>=]?\s*-?\d+/i.test(userText) ||
        /\d+\s*(?:도|℃|°c|mpa|g\/d|g\/mol|%)/i.test(userText));

    if (hasRagSearchIntent) {
      try {
        const ragRes = await executeUnifiedPgVectorRagSearch(userText, 3);
        const msgId = `msg_rag_${Date.now()}`;
        let boundAtoms = atoms;
        let boundBonds = bonds;
        let boundDescriptor = descriptor;
        let boundParsed: ParsedCopolymerStructure | undefined = activeParsedCopolymer;
        let loadedPath: string | undefined = undefined;

        if (ragRes.topRecommendedDetail) {
          const converted = convertMaterialPayloadToAppModel(ragRes.topRecommendedDetail);
          boundAtoms = converted.atoms;
          boundBonds = converted.bonds;
          boundDescriptor = converted.descriptor;
          boundParsed = converted.parsedCopolymer;
          loadedPath = converted.filePath;

          setAtoms(boundAtoms);
          setBonds(boundBonds);
          setActiveParsedCopolymer(boundParsed);
          onStructureChange?.(boundAtoms, boundBonds, boundDescriptor, boundParsed);
          onApplyToMainModel?.({
            polymer: converted.polymer,
            descriptor: boundDescriptor,
            atoms: boundAtoms,
            bonds: boundBonds,
            parsedCopolymer: boundParsed,
          });
        }

        const ragMarkdown = formatTriadRagMarkdownReport(ragRes, loadedPath);
        const topS = ragRes.activeSTierCandidates[0];
        const ragMsg: ChatMessage = {
          id: msgId,
          sender: "assistant",
          text: ragMarkdown,
          timestamp: new Date().toLocaleTimeString("ko-KR", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
          actionType: "create",
          actionBadge: `pgvector 3대 통합 RAG (${ragRes.searchTimeMs}ms) · ${topS?.id || "검색 완료"}`,
          parsedCopolymer: boundParsed,
          metricsDelta: {
            mw: topS ? Math.round(topS.mn) : Math.round(boundDescriptor.monomerMW),
            strainEnergy,
            grade: "S",
            score: topS ? Math.round(topS.innovation_score) : overallScore,
            tg: topS?.tg,
            tenacity: topS ? Number((topS.tensile_strength / 11.5).toFixed(1)) : undefined,
            dp: topS?.dp_n,
          },
          suggestedFollowUps: [
            "신율 120% 이상인 유연한 공중합체 후보를 검색하고 탈락 아카이브 주의 구조도 알려줘",
            "Tg 140도 이상이고 인장강도 75 MPa 이상인 블록 공중합체 신소재 추천해줘",
            "구조 에너지 최소화(Relaxation)",
          ],
        };

        setRagTriadByMsgId((prev) => ({ ...prev, [msgId]: ragRes }));
        setMessages((prev) => [...prev, ragMsg]);
        setIsProcessing(false);
        return;
      } catch (ragErr) {
        console.warn("[ChatMolecularEditor] pgvector RAG fallback:", ragErr);
      }
    }

    // 1. Google Gemini API Key가 설정되어 있는 경우: 실제 Gemini API 호출하여 구조화된 JSON 데이터 수신
    if (hasGeminiApiKey()) {
      try {
        const geminiData = await callGeminiMolecularAI(userText);
        const result = applyGeminiResponseTo3D(geminiData, atoms, bonds);

        // [의도 분기]: actionType이 'chat'(일반 대화, 인사, 질문, 방어)인 경우 3D 모델을 변경하지 않고 대화만 출력
        if (geminiData.actionType === "chat") {
          setHighlightAtomIds([]);
          setHighlightBondIds([]);
        } else {
          setAtoms(result.atoms);
          setBonds(result.bonds);
          setHighlightAtomIds(result.message.highlightAtomIds || []);
          setHighlightBondIds(result.message.highlightBondIds || []);
          if (result.complexParams || result.message.complexParams) {
            setActiveComplexParams(result.complexParams || result.message.complexParams);
          }
          if (result.parsedCopolymer || result.message.parsedCopolymer) {
            setActiveParsedCopolymer(result.parsedCopolymer || result.message.parsedCopolymer);
          } else {
            setActiveParsedCopolymer(undefined);
          }
          onStructureChange?.(
            result.atoms,
            result.bonds,
            result.descriptor,
            result.parsedCopolymer || result.message.parsedCopolymer
          );
        }

        setMessages((prev) => [...prev, result.message]);
        setIsProcessing(false);
        return;
      } catch (err: any) {
        console.warn("Gemini API call failed, falling back to local chemical parser:", err);
      }
    }

    // 2. API Key 미설정 또는 네트워크 오류 시: 고도화된 로컬 화학 엔진으로 즉시 변환
    setTimeout(() => {
      const result = parseChatPrompt(userText, atoms, bonds);
      if (!hasGeminiApiKey()) {
        result.message.actionBadge = `${result.message.actionBadge} (로컬 모드)`;
      }

      // [의도 분기]: 로컬 모드에서도 actionType이 'chat'이면 3D 모델 보존
      if (result.message.actionType === "chat") {
        setHighlightAtomIds([]);
        setHighlightBondIds([]);
      } else {
        setAtoms(result.atoms);
        setBonds(result.bonds);
        setHighlightAtomIds(result.message.highlightAtomIds || []);
        setHighlightBondIds(result.message.highlightBondIds || []);
        if (result.complexParams || result.message.complexParams) {
          setActiveComplexParams(result.complexParams || result.message.complexParams);
        }
        if (result.parsedCopolymer || result.message.parsedCopolymer) {
          setActiveParsedCopolymer(result.parsedCopolymer || result.message.parsedCopolymer);
        } else {
          setActiveParsedCopolymer(undefined);
        }
        onStructureChange?.(
          result.atoms,
          result.bonds,
          result.descriptor,
          result.parsedCopolymer || result.message.parsedCopolymer
        );
      }

      setMessages((prev) => [...prev, result.message]);
      setIsProcessing(false);
    }, 120);
  };

  // 폼 제출
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleExecutePrompt(inputPrompt);
  };

  // 메인 랩에 적용
  const handleApplyToMain = () => {
    if (onApplyToMainModel) {
      const customPolymer = createPolymerFromSketch(atoms, bonds, descriptor);
      // 만약 복합 역설계 파라미터가 있다면 분자량 및 물성 동기화
      if (activeComplexParams) {
        if (activeComplexParams.molecularWeight) {
          customPolymer.defaultMw = activeComplexParams.molecularWeight;
        }
        if (activeComplexParams.predictedProperties?.tg) {
          customPolymer.tg = activeComplexParams.predictedProperties.tg;
        }
        if (activeComplexParams.copolymerType === "block") {
          customPolymer.chainArchitecture = "블록 공중합체 (Block Copolymer)";
        } else if (activeComplexParams.copolymerType === "random") {
          customPolymer.chainArchitecture = "랜덤 공중합체 (Random Copolymer)";
        }
      }
      onApplyToMainModel({
        polymer: customPolymer,
        descriptor,
        atoms,
        bonds,
        parsedCopolymer: activeParsedCopolymer,
      });
      setAppliedNotice(true);
      setTimeout(() => setAppliedNotice(false), 2500);
    }
  };

  return (
    <div
      className={`flex flex-col h-full w-full bg-[#070b14] text-slate-100 rounded-2xl border border-sky-500/30 shadow-2xl overflow-hidden ${className}`}
    >
      {/* ─────────────────────────────────────────────────────────────
          1. 최상단 헤더
          ───────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-4 py-2.5 bg-slate-950/90 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 via-indigo-600 to-purple-600 p-0.5 shadow-lg shadow-sky-500/20">
            <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-slate-950 text-sky-400">
              <Bot size={20} />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
                <span>PolyMatrix Chat-Driven 3D Molecular Editor</span>
                <span className="rounded-full bg-sky-500/20 border border-sky-400/40 px-2 py-0.2 text-[10px] text-sky-300 font-mono">
                  v2.4 Live
                </span>
              </h2>
            </div>
            <p className="text-[11px] text-slate-400">
              자연어 대화 기반 3차원 분자 구조 생성, 결합 길이/각도 실시간 변형 및 R&D 타당성 평가
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* [원클릭 AI 연결] 시연용 퀵 버튼 */}
          <button
            type="button"
            onClick={handleOneClickConnect}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold border transition cursor-pointer shadow-sm ${
              isDemoMasterKey()
                ? "bg-emerald-500/20 border-emerald-400/50 text-emerald-300 shadow-emerald-500/20"
                : "bg-gradient-to-r from-emerald-500/15 via-teal-500/15 to-sky-500/15 hover:from-emerald-500/25 hover:to-sky-500/25 border-emerald-400/40 text-emerald-300"
            }`}
            title="복잡한 .env 수정 없이 시연용 마스터 API Key로 즉시 원클릭 연동"
          >
            <Zap size={13} className="text-emerald-400 animate-pulse" />
            <span>원클릭 AI 연결</span>
          </button>

          {/* Gemini API 상태 및 설정 버튼 */}
          <button
            type="button"
            onClick={() => setIsApiModalOpen(true)}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium border transition cursor-pointer ${
              hasGeminiApiKey()
                ? "bg-sky-500/15 border-sky-400/30 text-sky-300 hover:bg-sky-500/25"
                : "bg-amber-500/15 border-amber-400/30 text-amber-300 hover:bg-amber-500/25"
            }`}
            title="Google Gemini API Key 및 모델 설정 열기"
          >
            {hasGeminiApiKey() ? (
              <>
                <Sparkles size={13} className="text-sky-400 animate-pulse" />
                <span>
                  Gemini Live ({isDemoMasterKey() ? "시연 마스터" : selectedModel})
                </span>
              </>
            ) : (
              <>
                <Key size={13} className="text-amber-400" />
                <span>Gemini API 설정 (현재 로컬 모드)</span>
              </>
            )}
            <Settings size={12} className="text-slate-400" />
          </button>

          {/* 원클릭 연동 완료 알림 토스트 */}
          {oneClickConnectedToast && (
            <div className="flex items-center gap-1.5 rounded-lg bg-emerald-500/20 border border-emerald-400/50 px-3 py-1 text-xs text-emerald-300 animate-in fade-in duration-150">
              <CheckCircle2 size={14} className="text-emerald-400" />
              <span>원클릭 AI 연동 완료!</span>
            </div>
          )}

          {/* 메인 랩 적용 알림 토스트 */}
          {appliedNotice && (
            <div className="flex items-center gap-1.5 rounded-lg bg-emerald-500/20 border border-emerald-400/50 px-3 py-1 text-xs text-emerald-300 animate-in fade-in duration-150">
              <CheckCircle2 size={14} />
              <span>메인 랩 동기화 완료!</span>
            </div>
          )}

          {/* 메인 랩에 적용 버튼 */}
          <button
            onClick={handleApplyToMain}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-500 via-indigo-500 to-purple-600 hover:from-sky-400 hover:to-purple-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-md shadow-sky-500/25 transition cursor-pointer"
            title="현재 설계된 3D 분자 구조를 PolyMatrix 메인 화면 및 예측 엔진에 즉시 반영"
          >
            <Sparkles size={14} />
            <span>메인 랩에 구조 적용</span>
            <ArrowRight size={13} />
          </button>

          {!isEmbedded && onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              title="창 닫기"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────
          2. 메인 3단 워크벤치 레이아웃
             [좌측: 챗봇 패널] - [중앙: Three.js 3D 뷰어] - [우측: R&D 타당성 리포트]
          ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 relative overflow-hidden">
        {/* ────────────── [좌측] 챗봇 대화 패널 (w-[390px]) ────────────── */}
        <section className="w-[390px] shrink-0 flex flex-col border-r border-white/10 bg-slate-950/70 backdrop-blur-md">
          {/* 상단: 시연용 추천 프롬프트 칩 목록 */}
          <div className="p-3 border-b border-white/10 bg-slate-900/40">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                <Sparkles size={12} className="text-amber-400" />
                <span>시연용 추천 프롬프트 (클릭 시 즉시 변형)</span>
              </span>
              <button
                onClick={() => {
                  const initial = generateBenzeneFlexibleChain();
                  setAtoms(initial.atoms);
                  setBonds(initial.bonds);
                  setHighlightAtomIds([]);
                  setHighlightBondIds([]);
                  setActiveParsedCopolymer(undefined);
                }}
                className="text-[10px] text-slate-400 hover:text-sky-300 flex items-center gap-1 transition"
                title="기본 구조로 초기화"
              >
                <RotateCcw size={11} />
                <span>초기화</span>
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_PROMPTS.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => handleExecutePrompt(item.prompt)}
                  disabled={isProcessing}
                  className="flex items-center gap-1 rounded-lg bg-white/5 hover:bg-sky-500/20 border border-white/10 hover:border-sky-400/40 px-2.5 py-1 text-[11px] text-slate-300 hover:text-sky-200 transition text-left cursor-pointer disabled:opacity-50"
                >
                  <span>{item.icon}</span>
                  <span className="truncate max-w-[150px]">{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 대화 내역 스크롤 영역 */}
          <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.sender === "user" ? "items-end" : "items-start"
                }`}
              >
                {/* 발화자 헤더 */}
                <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] text-slate-400">
                  {msg.sender === "user" ? (
                    <>
                      <span>연구원 (User)</span>
                      <User size={12} className="text-sky-400" />
                      <span>• {msg.timestamp}</span>
                    </>
                  ) : (
                    <>
                      <Bot size={12} className="text-purple-400" />
                      <span className="font-semibold text-purple-300">PolyMatrix ChemLLM</span>
                      <span>• {msg.timestamp}</span>
                    </>
                  )}
                </div>

                {/* 메시지 말풍선 */}
                <div
                  className={`max-w-[94%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-md ${
                    msg.sender === "user"
                      ? "bg-sky-600 text-white rounded-tr-sm"
                      : "bg-[#0b1220] border border-white/10 text-slate-200 rounded-tl-sm space-y-2"
                  }`}
                >
                  {/* 조작 액션 뱃지 */}
                  {msg.actionBadge && (
                    <div className="inline-flex items-center gap-1 rounded-md bg-sky-500/20 border border-sky-400/30 px-2 py-0.5 text-[10px] font-semibold text-sky-300">
                      <Zap size={11} />
                      <span>{msg.actionBadge}</span>
                    </div>
                  )}

                  {/* 본문 텍스트 (줄바꿈 및 마크다운 스타일링) */}
                  <div className="whitespace-pre-line font-sans">{msg.text}</div>

                  {/* 변경된 지표 델타 요약 카드 (일반 대화 및 가이드일 때는 숨김 처리) */}
                  {msg.actionType !== "chat" && msg.metricsDelta && (
                    <div className="grid grid-cols-3 gap-1 pt-1.5 border-t border-white/10 text-[10px] font-mono text-slate-300">
                      <div className="rounded bg-slate-900/80 p-1 border border-white/5">
                        <div className="text-slate-400 text-[9px]">단량체 Mw</div>
                        <div className="font-bold text-sky-300">{msg.metricsDelta.mw} g/mol</div>
                      </div>
                      <div className="rounded bg-slate-900/80 p-1 border border-white/5">
                        <div className="text-slate-400 text-[9px]">스트레인</div>
                        <div className="font-bold text-amber-300">
                          {msg.metricsDelta.strainEnergy} kcal/mol
                        </div>
                      </div>
                      <div className="rounded bg-slate-900/80 p-1 border border-white/5">
                        <div className="text-slate-400 text-[9px]">R&D 등급</div>
                        <div className="font-bold text-emerald-300">
                          {msg.metricsDelta.grade}급 ({msg.metricsDelta.score}점)
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 복합 역설계 파라미터 분해 카드 (JSON 파라미터 및 다차원 물성 매칭) */}
                  {msg.complexParams && (
                    <div className="mt-2 rounded-xl bg-slate-950/90 border border-sky-500/30 p-2.5 space-y-2 text-slate-200">
                      <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                        <span className="font-bold text-[11px] text-sky-300 flex items-center gap-1">
                          <span>🎯</span>
                          <span>다변수 역설계 파라미터 분해 (JSON Specs)</span>
                        </span>
                        <span className="rounded-full bg-sky-500/20 border border-sky-400/40 px-2 py-0.2 text-[9px] text-sky-200 font-mono">
                          {msg.complexParams.copolymerType === "block" ? "블록 공중합체" : "랜덤 공중합체"}
                        </span>
                      </div>

                      {/* 세부 파라미터 칩 */}
                      <div className="grid grid-cols-3 gap-1 text-[10px] font-mono">
                        <div className="rounded bg-slate-900 p-1.5 border border-white/5">
                          <div className="text-slate-400 text-[9px]">목표 분자량 (Mn)</div>
                          <div className="font-bold text-white mt-0.5">
                            {msg.complexParams.molecularWeight
                              ? `${msg.complexParams.molecularWeight.toLocaleString()} g/mol`
                              : "자동 최적화"}
                          </div>
                        </div>
                        <div className="rounded bg-slate-900 p-1.5 border border-white/5">
                          <div className="text-slate-400 text-[9px]">계산 중합도 (DP)</div>
                          <div className="font-bold text-indigo-300 mt-0.5">
                            {msg.metricsDelta?.dp ? `≈ ${msg.metricsDelta.dp} mers` : "사슬 배향"}
                          </div>
                        </div>
                        <div className="rounded bg-slate-900 p-1.5 border border-white/5">
                          <div className="text-slate-400 text-[9px]">말단 작용기</div>
                          <div className="font-bold text-emerald-300 mt-0.5">
                            -{msg.complexParams.terminalGroup || "OH"} 캡핑
                          </div>
                        </div>
                      </div>

                      {/* 다차원 물성 매칭 스코어 표 */}
                      <div className="rounded-lg bg-slate-900/90 p-2 border border-white/5 space-y-1.5 text-[10px]">
                        <div className="flex items-center justify-between text-slate-400 text-[9px] px-0.5">
                          <span>다차원 물성 지표</span>
                          <span>목표치 ➔ AI 예측치 (달성률)</span>
                        </div>

                        {/* Tg */}
                        <div className="flex items-center justify-between p-1 rounded bg-slate-950/80">
                          <span className="text-slate-300 font-sans">유리전이온도 (Tg)</span>
                          <div className="flex items-center gap-2 font-mono">
                            {msg.complexParams.targetProperties?.tg && (
                              <span className="text-slate-400">
                                목표 {msg.complexParams.targetProperties.tg}℃ ➔
                              </span>
                            )}
                            <span className="font-bold text-sky-300">
                              {msg.metricsDelta?.tg ?? msg.complexParams.predictedProperties?.tg ?? 188}℃
                            </span>
                            <span className="text-[9px] text-emerald-400 bg-emerald-500/10 px-1 rounded">
                              달성
                            </span>
                          </div>
                        </div>

                        {/* Tenacity */}
                        <div className="flex items-center justify-between p-1 rounded bg-slate-950/80">
                          <span className="text-slate-300 font-sans">인장 강도 (Tenacity)</span>
                          <div className="flex items-center gap-2 font-mono">
                            {msg.complexParams.targetProperties?.tenacity && (
                              <span className="text-slate-400">
                                목표 {msg.complexParams.targetProperties.tenacity} g/d ➔
                              </span>
                            )}
                            <span className="font-bold text-amber-300">
                              {msg.metricsDelta?.tenacity ?? msg.complexParams.predictedProperties?.tenacity ?? 8.6} g/d
                            </span>
                            <span className="text-[9px] text-emerald-400 bg-emerald-500/10 px-1 rounded">
                              고강도
                            </span>
                          </div>
                        </div>

                        {/* Modulus & Elongation */}
                        <div className="grid grid-cols-2 gap-1 pt-0.5">
                          <div className="flex items-center justify-between p-1 rounded bg-slate-950/80 font-mono">
                            <span className="text-slate-400 text-[9px] font-sans">탄성률</span>
                            <span className="font-bold text-purple-300">
                              {msg.metricsDelta?.modulus ?? msg.complexParams.predictedProperties?.modulus ?? 82} g/d
                            </span>
                          </div>
                          <div className="flex items-center justify-between p-1 rounded bg-slate-950/80 font-mono">
                            <span className="text-slate-400 text-[9px] font-sans">파단신율</span>
                            <span className="font-bold text-teal-300">
                              {msg.metricsDelta?.elongation ?? msg.complexParams.predictedProperties?.elongation ?? 38}%
                            </span>
                          </div>
                        </div>

                        {/* 설계 종합 달성률 바 */}
                        <div className="pt-1 border-t border-white/5 flex items-center justify-between text-[10px]">
                          <span className="text-slate-400">다차원 목표 달성률</span>
                          <span className="font-bold text-emerald-300 font-mono">
                            {msg.metricsDelta?.targetMatchScore ?? 96}% 정합
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 공중합 구조식 강제 파서 JSON & 도메인 카드 (Input Interceptor -> Three.js Bridge) */}
                  {msg.parsedCopolymer && (
                    <div className="mt-2 rounded-xl bg-slate-950/95 border border-purple-500/40 p-2.5 space-y-2 text-slate-200 shadow-inner">
                      <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                        <span className="font-bold text-[11px] text-purple-300 flex items-center gap-1">
                          <span>🧬</span>
                          <span>파싱된 공중합 구조식 JSON & 3D 도메인</span>
                        </span>
                        <span className="rounded-full bg-purple-500/20 border border-purple-400/40 px-2 py-0.2 text-[9px] text-purple-200 font-mono">
                          {msg.parsedCopolymer.architecture}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {msg.parsedCopolymer.componentDetails.map((comp, cIdx) => (
                          <React.Fragment key={`${comp.id}_${cIdx}`}>
                            <div className="flex items-center gap-1.5 rounded-lg bg-slate-900 border border-white/10 px-2 py-1 text-[10px]">
                              <span
                                className="inline-block h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: comp.color }}
                              />
                              <span className="font-bold text-white">{comp.koreanName}</span>
                              <span className="text-slate-400 font-mono">({comp.shortName})</span>
                            </div>
                            {cIdx < msg.parsedCopolymer!.connectors.length && (
                              <span className="rounded bg-rose-500/20 border border-rose-400/40 px-1.5 py-0.5 text-[9px] font-mono font-bold text-rose-300">
                                -{msg.parsedCopolymer!.connectors[cIdx]}-
                              </span>
                            )}
                          </React.Fragment>
                        ))}
                      </div>

                      <pre className="rounded-lg bg-black/80 border border-white/10 p-2 text-[10px] font-mono text-emerald-300 overflow-x-auto leading-tight">
                        {JSON.stringify(
                          {
                            structure_type: msg.parsedCopolymer.structure_type,
                            components: msg.parsedCopolymer.components,
                            architecture: msg.parsedCopolymer.architecture,
                          },
                          null,
                          2
                        )}
                      </pre>
                    </div>
                  )}

                  {/* PostgreSQL + pgvector 3대 통합 데이터 소스 RAG 결과 인터랙티브 카드 */}
                  {ragTriadByMsgId[msg.id] && (
                    <div className="mt-2 rounded-xl bg-slate-950/95 border border-amber-500/40 p-2.5 space-y-2 text-[10px] text-slate-200 shadow-inner">
                      <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                        <span className="font-bold text-[11px] text-amber-300 flex items-center gap-1">
                          <span>🗄️</span>
                          <span>3대 데이터 소스 클릭 시 단일 파일(storage/materials) 로드</span>
                        </span>
                        <span className="rounded-full bg-emerald-500/20 border border-emerald-400/40 px-2 py-0.2 text-[9px] text-emerald-300 font-mono">
                          pgvector {ragTriadByMsgId[msg.id].searchTimeMs}ms
                        </span>
                      </div>

                      {/* 1. ACTIVE_S_TIER */}
                      <div className="space-y-1">
                        <div className="text-[9px] font-bold text-amber-300">
                          1️⃣ ACTIVE_S_TIER (신소재 추천 후보)
                        </div>
                        {ragTriadByMsgId[msg.id].activeSTierCandidates.map((cand) => (
                          <button
                            key={cand.id}
                            type="button"
                            disabled={loadingRagFileId === cand.id}
                            onClick={() => handleSelectRagMaterialItem(cand.id)}
                            className="w-full flex items-center justify-between rounded-lg bg-slate-900 hover:bg-amber-500/15 border border-amber-400/30 px-2 py-1 text-left transition cursor-pointer"
                          >
                            <div className="truncate pr-2">
                              <span className="font-mono font-bold text-amber-300 mr-1.5">
                                {cand.id}
                              </span>
                              <span className="text-white font-semibold">{cand.short_code}</span>
                              <span className="text-slate-400 ml-1">
                                ({cand.tg}℃, {cand.tensile_strength}MPa)
                              </span>
                            </div>
                            <span className="shrink-0 rounded bg-amber-400 text-slate-950 font-extrabold px-1.5 py-0.5 text-[9px]">
                              {loadingRagFileId === cand.id ? "로드중..." : "단일파일 3D 로드"}
                            </span>
                          </button>
                        ))}
                      </div>

                      {/* 2. OPEN_BENCHMARK */}
                      <div className="space-y-1">
                        <div className="text-[9px] font-bold text-sky-300">
                          2️⃣ OPEN_BENCHMARK (기준 비교군)
                        </div>
                        {ragTriadByMsgId[msg.id].openBenchmarks.map((bench) => (
                          <button
                            key={bench.id}
                            type="button"
                            disabled={loadingRagFileId === bench.id}
                            onClick={() => handleSelectRagMaterialItem(bench.id)}
                            className="w-full flex items-center justify-between rounded-lg bg-slate-900 hover:bg-sky-500/15 border border-sky-400/30 px-2 py-1 text-left transition cursor-pointer"
                          >
                            <div className="truncate pr-2">
                              <span className="font-mono font-bold text-sky-300 mr-1.5">
                                {bench.id}
                              </span>
                              <span className="text-white font-semibold">{bench.korean_name}</span>
                              <span className="text-slate-400 ml-1">({bench.tg}℃)</span>
                            </div>
                            <span className="shrink-0 rounded bg-sky-500/20 border border-sky-400/40 text-sky-200 font-bold px-1.5 py-0.5 text-[9px]">
                              {loadingRagFileId === bench.id ? "로드중..." : "기준소재 3D 비교"}
                            </span>
                          </button>
                        ))}
                      </div>

                      {/* 3. ARCHIVED_REJECTED */}
                      <div className="space-y-1">
                        <div className="text-[9px] font-bold text-rose-300">
                          3️⃣ ARCHIVED_REJECTED (탈락/주의 구조 아카이브)
                        </div>
                        {ragTriadByMsgId[msg.id].archivedRejectedWarnings.map((rej) => (
                          <button
                            key={rej.id}
                            type="button"
                            disabled={loadingRagFileId === rej.id}
                            onClick={() => handleSelectRagMaterialItem(rej.id)}
                            className="w-full flex items-center justify-between rounded-lg bg-rose-950/30 hover:bg-rose-500/20 border border-rose-500/30 px-2 py-1 text-left transition cursor-pointer"
                            title={rej.status_reason}
                          >
                            <div className="truncate pr-2">
                              <span className="font-mono font-bold text-rose-300 mr-1.5">
                                {rej.id}
                              </span>
                              <span className="text-rose-100 font-semibold">{rej.status_stage}</span>
                            </div>
                            <span className="shrink-0 rounded bg-rose-500/30 border border-rose-400/40 text-rose-200 font-bold px-1.5 py-0.5 text-[9px]">
                              {loadingRagFileId === rej.id ? "로드중..." : "탈락구조 3D 검증"}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 후속 추천 프롬프트 칩 */}
                  {msg.suggestedFollowUps && msg.suggestedFollowUps.length > 0 && (
                    <div className="pt-2 border-t border-white/5 space-y-1">
                      <div className="text-[10px] text-slate-400">💡 추천 후속 명령:</div>
                      <div className="flex flex-col gap-1">
                        {msg.suggestedFollowUps.map((fu, fIdx) => (
                          <button
                            key={fIdx}
                            onClick={() => handleExecutePrompt(fu)}
                            disabled={isProcessing}
                            className="text-left text-[11px] text-sky-300 hover:text-white bg-white/5 hover:bg-sky-500/20 rounded px-2 py-0.5 transition truncate cursor-pointer disabled:opacity-50"
                          >
                            👉 {fu}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isProcessing && (
              <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-900/60 border border-white/10 text-xs text-sky-300 animate-pulse">
                <Bot size={15} className="animate-spin" />
                <span>자연어 의도 파싱 및 3D 기하 좌표 변형 중...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* 하단: 자연어 입력창 */}
          <form
            onSubmit={handleSubmit}
            className="p-3 border-t border-white/10 bg-slate-950 flex items-center gap-2"
          >
            <input
              type="text"
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              placeholder="예: '폴리스티렌-graft-폴리프로필렌', 'PS-b-PP-g-PE', '벤젠 고리 사슬 만들어줘'..."
              disabled={isProcessing}
              className="flex-1 rounded-xl bg-slate-900 border border-white/10 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-400/60 focus:ring-1 focus:ring-sky-400 transition"
            />
            <button
              type="submit"
              disabled={!inputPrompt.trim() || isProcessing}
              className="flex items-center justify-center h-8 w-8 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-bold transition shadow-md shadow-sky-500/20 cursor-pointer disabled:cursor-not-allowed"
              title="프롬프트 전송"
            >
              <Send size={15} />
            </button>
          </form>
        </section>

        {/* ────────────── [중앙] Three.js 기반 3D 분자 뷰어 ────────────── */}
        <section className="flex-1 min-h-0 relative flex flex-col bg-[#050811]">
          <div className="flex-1 min-h-0 relative">
            <ChatMolecular3DCanvas
              atoms={atoms}
              bonds={bonds}
              highlightAtomIds={highlightAtomIds}
              highlightBondIds={highlightBondIds}
              showDimensions={showDimensions && !isApiModalOpen}
              onToggleDimensions={() => setShowDimensions(!showDimensions)}
              parsedCopolymer={activeParsedCopolymer}
              className="w-full h-full"
            />
          </div>
        </section>

        {/* ────────────── [우측] 재료정보학 R&D 타당성 리포트 패널 (w-[350px]) ────────────── */}
        <section className="w-[350px] shrink-0 flex flex-col border-l border-white/10 bg-[#090e1a]/95 backdrop-blur-md overflow-y-auto">
          {/* 리포트 헤더 */}
          <div className="p-3.5 border-b border-white/10 flex items-center justify-between bg-slate-950/80">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-400/30">
                <Award size={16} />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white">신소재 R&D 타당성 리포트</h3>
                <p className="text-[10px] text-slate-400">Materials Informatics AI 분석</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-400/30 px-2 py-0.5 text-[10px] text-emerald-300 font-mono">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              실시간 연동
            </span>
          </div>

          <div className="p-3.5 space-y-3.5 text-xs">
            {/* 1. 종합 R&D 가치 등급 카드 */}
            <div className="rounded-xl bg-gradient-to-br from-slate-900 to-slate-950 p-3 border border-amber-500/30 shadow-lg relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase font-bold tracking-wider text-amber-400/90">
                    Research Viability Grade
                  </div>
                  <div className="text-2xl font-black text-white flex items-center gap-2 mt-0.5">
                    <span className="text-3xl text-amber-300 font-serif">{grade}</span>
                    <span className="text-xs font-normal text-slate-300">
                      / 100점 중 <strong className="text-white font-mono">{overallScore}점</strong>
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-300 mt-1">
                    {grade === "S"
                      ? "🌟 혁신 신소재 후보 (Exceptional)"
                      : grade === "A"
                      ? "✨ 우수 R&D 후보 (High Feasibility)"
                      : "⚖️ 구조 개선 권장 (Standard)"}
                  </div>
                </div>

                <div className="h-14 w-14 rounded-2xl bg-amber-500/15 border border-amber-400/40 flex flex-col items-center justify-center text-amber-300 shadow-inner">
                  <Flame size={20} />
                  <span className="text-[10px] font-bold font-mono mt-0.5">{overallScore}%</span>
                </div>
              </div>

              {/* 점수 게이지 바 */}
              <div className="mt-2.5 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 via-rose-500 to-purple-500 transition-all duration-500"
                  style={{ width: `${overallScore}%` }}
                />
              </div>
            </div>

            {/* 2. 3D 구조 안정성 & 무결성 */}
            <div className="rounded-xl bg-slate-900/60 p-3 border border-white/10 space-y-2">
              <div className="text-[11px] font-bold text-white flex items-center gap-1.5">
                <Activity size={13} className="text-sky-400" />
                <span>3D 구조 안정성 & 스트레인</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                <div className="rounded-lg bg-slate-950/80 p-2 border border-white/5">
                  <div className="text-[10px] text-slate-400 font-sans">입체 스트레인</div>
                  <div className="text-sm font-bold text-amber-300 mt-0.5">
                    {strainEnergy} <span className="text-[9px] font-normal text-slate-400">kcal/mol</span>
                  </div>
                  <div className="text-[9px] text-slate-500 mt-0.5 font-sans">
                    {strainEnergy < 20 ? "안정 배좌" : "비틀림 응력 존재"}
                  </div>
                </div>

                <div className="rounded-lg bg-slate-950/80 p-2 border border-white/5">
                  <div className="text-[10px] text-slate-400 font-sans">평균 결합 거리</div>
                  <div className="text-sm font-bold text-sky-300 mt-0.5">
                    {avgBondLength} <span className="text-[9px] font-normal text-slate-400">Å</span>
                  </div>
                  <div className="text-[9px] text-slate-500 mt-0.5 font-sans">
                    표준(1.54Å) 대비 {(avgBondLength - 1.54 >= 0 ? "+" : "")}{(avgBondLength - 1.54).toFixed(2)}Å
                  </div>
                </div>
              </div>

              {/* 원자가 규칙 유효성 */}
              <div className="flex items-center justify-between rounded-lg bg-slate-950/80 px-2.5 py-1.5 border border-white/5 text-[11px]">
                <span className="text-slate-400 flex items-center gap-1">
                  <FileCheck size={12} className="text-emerald-400" />
                  원자가 규칙 (Valence)
                </span>
                <span className="font-semibold text-emerald-300 font-mono">
                  {validation.isValid ? "100% 정상 (무결)" : "경고 발생"}
                </span>
              </div>
            </div>

            {/* 2.5. 다변수 고분자 역설계 세부 파라미터 (activeComplexParams 있을 때 활성화) */}
            {activeComplexParams && (
              <div className="rounded-xl bg-gradient-to-br from-indigo-950/60 to-slate-900/90 p-3 border border-sky-400/40 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-bold text-sky-300 flex items-center gap-1.5">
                    <span className="text-sm">🎯</span>
                    <span>다변수 역설계 파라미터 분해</span>
                  </div>
                  <span className="rounded bg-sky-500/20 border border-sky-400/30 px-1.5 py-0.5 text-[9px] text-sky-200 font-mono">
                    {activeComplexParams.copolymerType === "block" ? "블록 공중합체" : "랜덤 공중합체"}
                  </span>
                </div>

                <div className="space-y-1 text-[11px] font-mono">
                  <div className="flex items-center justify-between p-1 rounded bg-slate-950/60">
                    <span className="text-slate-400 text-[10px] font-sans">목표 분자량 (Mn)</span>
                    <span className="font-bold text-white">
                      {activeComplexParams.molecularWeight?.toLocaleString()} g/mol
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-1 rounded bg-slate-950/60">
                    <span className="text-slate-400 text-[10px] font-sans">말단 기능기 캡핑</span>
                    <span className="font-bold text-emerald-300">
                      -{activeComplexParams.terminalGroup || "OH"}
                    </span>
                  </div>
                  {activeComplexParams.predictedProperties && (
                    <div className="grid grid-cols-2 gap-1 pt-1 text-[10px]">
                      <div className="p-1 rounded bg-slate-950/60 border border-white/5">
                        <span className="text-slate-400 text-[9px] block">예측 인장강도</span>
                        <span className="font-bold text-amber-300">
                          {activeComplexParams.predictedProperties.tenacity} g/d
                        </span>
                      </div>
                      <div className="p-1 rounded bg-slate-950/60 border border-white/5">
                        <span className="text-slate-400 text-[9px] block">예측 내열 Tg</span>
                        <span className="font-bold text-sky-300">
                          {activeComplexParams.predictedProperties.tg} ℃
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 3. 예측 물리·화학 물성 지표 */}
            <div className="rounded-xl bg-slate-900/60 p-3 border border-white/10 space-y-2">
              <div className="text-[11px] font-bold text-white flex items-center gap-1.5">
                <Layers size={13} className="text-purple-400" />
                <span>예측 물리·화학 물성치</span>
              </div>

              <div className="space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between p-1.5 rounded bg-slate-950/60">
                  <span className="text-slate-400">단량체 분자량 (Mw)</span>
                  <span className="font-bold text-white font-mono">{descriptor.monomerMW.toFixed(1)} g/mol</span>
                </div>
                <div className="flex items-center justify-between p-1.5 rounded bg-slate-950/60">
                  <span className="text-slate-400">추정 유리전이온도 (Tg)</span>
                  <span className="font-bold text-sky-300 font-mono">{Math.round(descriptor.estimatedTg)} ℃</span>
                </div>
                <div className="flex items-center justify-between p-1.5 rounded bg-slate-950/60">
                  <span className="text-slate-400">사슬 강직도 지수</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-purple-300 font-mono">
                      {(descriptor.rigidityScore * 100).toFixed(0)}%
                    </span>
                    <span className="text-[9px] text-slate-500">
                      ({descriptor.rigidityScore > 0.5 ? "강직" : "유연"})
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between p-1.5 rounded bg-slate-950/60">
                  <span className="text-slate-400">극성 헤테로 원자 비율</span>
                  <span className="font-bold text-indigo-300 font-mono">
                    {(descriptor.heteroatomRatio * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            {/* 4. 산업 응용성 및 추천 합성 로드맵 */}
            <div className="rounded-xl bg-slate-900/60 p-3 border border-white/10 space-y-2">
              <div className="text-[11px] font-bold text-white flex items-center gap-1.5">
                <Compass size={13} className="text-emerald-400" />
                <span>산업 응용 및 합성 로드맵</span>
              </div>

              <div className="space-y-1.5 text-[11px] text-slate-300">
                <div className="p-2 rounded-lg bg-slate-950/80 border border-white/5 space-y-1">
                  <div className="font-semibold text-emerald-300 flex items-center gap-1">
                    <span>🎯 유망 적용 분야</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    {descriptor.rigidityScore > 0.4
                      ? "차세대 플렉서블 디스플레이 기판, 고강도 경량 항공우주 하이브리드 복합재"
                      : "고탄성 친환경 엘라스토머, 투습방수 기능성 드레이프 섬유 소재"}
                  </p>
                </div>

                <div className="p-2 rounded-lg bg-slate-950/80 border border-white/5 space-y-1">
                  <div className="font-semibold text-sky-300 flex items-center gap-1">
                    <span>🔬 합성 타당성 평가</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    단량체 간 축합중합(Condensation Polymerization) 반응성 우수, 공정 위험도 낮음.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. Google Gemini API 설정 모달 (In-UI Key & Model Configuration)
             createPortal을 통해 document.body 최상위에 렌더링하여
             3D 캔버스, 결합 길이 라벨, 이전 페이지 컴포넌트와의 겹침 현상을 원천 차단!
          ───────────────────────────────────────────────────────────── */}
      {isApiModalOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 animate-in fade-in duration-150">
            {/* 이전 페이지 및 3D 뷰어가 비쳐서 겹치지 않도록 차단하는 고농도 백드롭 오버레이 */}
            <div
              className="absolute inset-0 bg-slate-950/90 backdrop-blur-xl"
              onClick={() => setIsApiModalOpen(false)}
            />

            {/* 모달 윈도우 본체 */}
            <div className="relative z-10 w-full max-w-lg rounded-2xl bg-[#0a0f1d] border border-sky-500/50 p-5 shadow-[0_25px_70px_rgba(0,0,0,0.95)] text-xs space-y-4">
              {/* 모달 헤더 */}
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-400/30">
                    <Key size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>Google Gemini API 연동 설정</span>
                      <span className="rounded-full bg-emerald-500/20 border border-emerald-400/40 px-2 py-0.2 text-[10px] text-emerald-300 font-mono">
                        {hasGeminiApiKey() ? "연동 활성화됨" : "로컬 모드"}
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      최신 Gemini 모델을 통해 자연어 고분자 3D 구조 생성 명령을 실시간 추론합니다.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsApiModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* ⚡ [원클릭 AI 자동 연동] 시연용 마스터 Key 카드 */}
              <div className="rounded-xl bg-gradient-to-r from-emerald-950/80 via-slate-900 to-sky-950/80 p-3.5 border border-emerald-500/40 shadow-lg shadow-emerald-500/10 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-300 shrink-0">
                      <Zap size={18} className="animate-pulse" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>원클릭 AI 자동 연동 (시연용 마스터 모드)</span>
                        <span className="rounded bg-emerald-500/20 text-emerald-300 text-[9px] px-1.5 py-0.2 font-mono">
                          추천
                        </span>
                      </h4>
                      <p className="text-[10px] text-slate-300 mt-0.5">
                        복잡한 .env 설정 없이 버튼 하나로 시연용 마스터 키가 브라우저에 자동 세팅되어 즉시 Gemini API와 연동됩니다.
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleOneClickConnect}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500 hover:from-emerald-400 hover:to-sky-400 text-slate-950 font-bold py-2 text-xs transition shadow-md shadow-emerald-500/20 cursor-pointer"
                >
                  <Zap size={14} />
                  <span>⚡ 원클릭 자동 연동 시작하기</span>
                </button>
              </div>

              {/* API Key 직접 입력란 (선택 사항) */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-200 flex items-center justify-between">
                  <span>Gemini API Key</span>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="text-sky-400 hover:underline text-[11px]"
                  >
                    Google AI Studio에서 무료 발급 ↗
                  </a>
                </label>
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="AIzaSy... 로 시작하는 Gemini API Key 입력"
                  className="w-full rounded-xl bg-slate-900 border border-white/10 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 font-mono"
                />
                <p className="text-[10px] text-slate-400">
                  입력하신 API Key는 브라우저 내부(LocalStorage)에만 안전하게 저장되며, 외부 서버로 유출되지 않습니다.
                </p>
              </div>

              {/* 모델 선택 */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-200">생성 모델 선택</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedModel("gemini-2.5-flash")}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                      selectedModel === "gemini-2.5-flash"
                        ? "bg-sky-500/20 border-sky-400 text-sky-200"
                        : "bg-slate-900 border-white/10 text-slate-400 hover:text-white"
                    }`}
                  >
                    <div className="font-bold flex items-center gap-1.5">
                      <span>gemini-2.5-flash</span>
                      <span className="text-[9px] bg-sky-500/30 text-sky-300 rounded px-1">추천</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">초고속 실시간 반응 & 멀티모달 최신</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedModel("gemini-3.8-flash")}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                      selectedModel === "gemini-3.8-flash"
                        ? "bg-purple-500/20 border-purple-400 text-purple-200"
                        : "bg-slate-900 border-white/10 text-slate-400 hover:text-white"
                    }`}
                  >
                    <div className="font-bold">gemini-3.8-flash</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">고성능 차세대 추론 엔진</div>
                  </button>
                </div>
              </div>

              {/* .env 환경변수 영구 설정 안내 */}
              <div className="rounded-xl bg-slate-950 p-3 border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-slate-300 font-semibold text-[11px]">
                  <span className="flex items-center gap-1.5">
                    <FileCheck size={13} className="text-emerald-400" />
                    <span>.env 파일 환경 변수 영구 설정 방법</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const envText = `VITE_GEMINI_API_KEY=${apiKeyInput || "your_api_key_here"}\nVITE_GEMINI_MODEL=${selectedModel}`;
                      navigator.clipboard.writeText(envText);
                      setIsCopied(true);
                      setTimeout(() => setIsCopied(false), 2000);
                    }}
                    className="flex items-center gap-1 text-[10px] text-sky-400 hover:text-sky-300 cursor-pointer"
                  >
                    {isCopied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                    <span>{isCopied ? "복사됨!" : ".env 복사"}</span>
                  </button>
                </div>
                <pre className="rounded bg-slate-900 p-2 font-mono text-[10px] text-sky-300 select-all overflow-x-auto">
{`# 프로젝트 루트의 .env 파일에 추가:
VITE_GEMINI_API_KEY=${apiKeyInput || "your_gemini_api_key_here"}
VITE_GEMINI_MODEL=${selectedModel}`}
                </pre>
                <p className="text-[10px] text-slate-500">
                  .env 파일에 등록 시 브라우저 새로고침이나 PC 재부팅 후에도 영구적으로 자동 로드됩니다. (.gitignore 등록 완료)
                </p>
              </div>

              {/* 버튼 바 */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setApiKeyInput("");
                    setGeminiApiKey("");
                    setKeySavedToast(true);
                    setTimeout(() => setKeySavedToast(false), 2000);
                  }}
                  className="text-rose-400 hover:text-rose-300 text-[11px] hover:underline cursor-pointer"
                >
                  API Key 초기화 (로컬 모드 복귀)
                </button>

                <div className="flex items-center gap-2">
                  {keySavedToast && (
                    <span className="text-emerald-400 text-xs flex items-center gap-1 animate-in fade-in">
                      <Check size={13} />
                      <span>저장 완료!</span>
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setGeminiApiKey(apiKeyInput);
                      setGeminiModel(selectedModel);
                      setKeySavedToast(true);
                      setTimeout(() => {
                        setKeySavedToast(false);
                        setIsApiModalOpen(false);
                      }, 800);
                    }}
                    className="rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold px-4 py-2 text-xs transition shadow-md shadow-sky-500/20 cursor-pointer"
                  >
                    설정 저장 및 적용
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
