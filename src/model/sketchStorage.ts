/**
 * 분자 스케치 및 메인 파라미터 로컬 영속화(LocalStorage Persistence) 모듈
 * 
 * 1. 현재 작업 중인 스케치 실시간 자동 저장(Autosave) 및 복원
 * 2. 이름이 부여된 커스텀 분자 라이브러리(My Saved Molecules) 저장/불러오기/삭제
 * 3. 메인 랩 시뮬레이션 파라미터(Inputs & Polymer Selection) 상태 저장/복원
 * 4. JSON 파일 내보내기/가져오기 백업 기능
 */

import type { AtomNode, BondEdge } from "../components/MolDrawCanvas";
import type { FiberInputs } from "../types";

export interface SavedMoleculePreset {
  id: string;
  name: string;
  description?: string;
  atoms: AtomNode[];
  bonds: BondEdge[];
  formula: string;
  monomerMW: number;
  createdAt: string;
  updatedAt: string;
}

export interface StoredMainAppState {
  inputs: FiberInputs;
  polymerId: string;
  sketchData: { atoms: AtomNode[]; bonds: BondEdge[] } | null;
  dashboardHeightMode: "normal" | "tall";
}

const STORAGE_KEY_SAVED_LIST = "fiber_lab_saved_molecules_v1";
const STORAGE_KEY_AUTOSAVE_SKETCH = "fiber_lab_autosave_sketch_v1";
const STORAGE_KEY_MAIN_STATE = "fiber_lab_main_app_state_v1";

// 초기 시드 샘플 (처음 방문 시 제공되는 예시 커스텀 분자)
const DEFAULT_SAVED_SAMPLES: SavedMoleculePreset[] = [
  {
    id: "sample-custom-aromatic-ester",
    name: "고배향 방향족 에스터 유도체",
    description: "벤젠 고리와 에스터기가 공액된 고강도 내열성 단량체 스케치",
    formula: "C9H8O2",
    monomerMW: 148,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    atoms: [
      { id: "a1", symbol: "C", x: 260, y: 220 },
      { id: "a2", symbol: "C", x: 305, y: 195 },
      { id: "a3", symbol: "C", x: 350, y: 220 },
      { id: "a4", symbol: "C", x: 350, y: 275 },
      { id: "a5", symbol: "C", x: 305, y: 300 },
      { id: "a6", symbol: "C", x: 260, y: 275 },
      { id: "a7", symbol: "C", x: 395, y: 195 },
      { id: "a8", symbol: "O", x: 395, y: 145 },
      { id: "a9", symbol: "O", x: 440, y: 220 },
      { id: "a10", symbol: "C", x: 485, y: 195 },
      { id: "a11", symbol: "C", x: 530, y: 220 },
    ],
    bonds: [
      { id: "b1", sourceId: "a1", targetId: "a2", type: "double" },
      { id: "b2", sourceId: "a2", targetId: "a3", type: "single" },
      { id: "b3", sourceId: "a3", targetId: "a4", type: "double" },
      { id: "b4", sourceId: "a4", targetId: "a5", type: "single" },
      { id: "b5", sourceId: "a5", targetId: "a6", type: "double" },
      { id: "b6", sourceId: "a6", targetId: "a1", type: "single" },
      { id: "b7", sourceId: "a3", targetId: "a7", type: "single" },
      { id: "b8", sourceId: "a7", targetId: "a8", type: "double" },
      { id: "b9", sourceId: "a7", targetId: "a9", type: "single" },
      { id: "b10", sourceId: "a9", targetId: "a10", type: "single" },
      { id: "b11", sourceId: "a10", targetId: "a11", type: "single" },
    ],
  },
];

/**
 * 1. 저장된 커스텀 분자 목록 불러오기
 */
export function loadSavedMolecules(): SavedMoleculePreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SAVED_LIST);
    if (raw === null) {
      // 최초 실행 시 기본 샘플 등록
      localStorage.setItem(STORAGE_KEY_SAVED_LIST, JSON.stringify(DEFAULT_SAVED_SAMPLES));
      return DEFAULT_SAVED_SAMPLES;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn("Failed to read saved molecules from localStorage:", err);
    return [];
  }
}

/**
 * 2. 커스텀 분자 저장하기 (신규 생성 또는 기존 이름 업데이트)
 */
export function saveNamedMolecule(
  name: string,
  atoms: AtomNode[],
  bonds: BondEdge[],
  formula: string,
  monomerMW: number,
  description = ""
): SavedMoleculePreset {
  const list = loadSavedMolecules();
  const now = new Date().toISOString();

  // 기존 동일 이름 존재 여부 확인
  const existingIdx = list.findIndex((m) => m.name.trim().toLowerCase() === name.trim().toLowerCase());

  let savedItem: SavedMoleculePreset;

  if (existingIdx >= 0) {
    savedItem = {
      ...list[existingIdx],
      atoms,
      bonds,
      formula,
      monomerMW,
      description: description || list[existingIdx].description,
      updatedAt: now,
    };
    list[existingIdx] = savedItem;
  } else {
    savedItem = {
      id: `mol-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: name.trim(),
      description,
      atoms,
      bonds,
      formula,
      monomerMW,
      createdAt: now,
      updatedAt: now,
    };
    list.unshift(savedItem);
  }

  try {
    localStorage.setItem(STORAGE_KEY_SAVED_LIST, JSON.stringify(list));
  } catch (err) {
    console.error("Failed to save molecule to localStorage:", err);
  }

  return savedItem;
}

/**
 * 3. 저장된 분자 삭제
 */
export function deleteSavedMolecule(id: string): SavedMoleculePreset[] {
  const current = loadSavedMolecules();
  const targetId = String(id).trim();
  const list = current.filter((m) => String(m.id).trim() !== targetId);
  try {
    localStorage.setItem(STORAGE_KEY_SAVED_LIST, JSON.stringify(list));
  } catch (err) {
    console.error("Failed to delete molecule:", err);
  }
  return list;
}

/**
 * 4. 현재 작업 중인 스케치 임시 자동 저장 (Autosave Draft)
 */
export function saveCurrentWorkingSketch(atoms: AtomNode[], bonds: BondEdge[]): void {
  try {
    localStorage.setItem(
      STORAGE_KEY_AUTOSAVE_SKETCH,
      JSON.stringify({ atoms, bonds, timestamp: Date.now() })
    );
  } catch (err) {
    console.warn("Failed to autosave sketch:", err);
  }
}

/**
 * 5. 임시 자동 저장된 스케치 불러오기
 */
export function loadCurrentWorkingSketch(): { atoms: AtomNode[]; bonds: BondEdge[] } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_AUTOSAVE_SKETCH);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.atoms) && Array.isArray(parsed.bonds)) {
      return { atoms: parsed.atoms, bonds: parsed.bonds };
    }
  } catch (err) {
    console.warn("Failed to load autosaved sketch:", err);
  }
  return null;
}

/**
 * 6. 임시 자동 저장 초기화
 */
export function clearCurrentWorkingSketch(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_AUTOSAVE_SKETCH);
  } catch (err) {
    console.warn("Failed to clear autosaved sketch:", err);
  }
}

/**
 * 7. 메인 애플리케이션 상태 (Inputs, 선택 고분자, 대시보드 상태) 영속화
 */
export function saveMainAppState(state: StoredMainAppState): void {
  try {
    localStorage.setItem(STORAGE_KEY_MAIN_STATE, JSON.stringify(state));
  } catch (err) {
    console.warn("Failed to save main app state:", err);
  }
}

/**
 * 8. 메인 애플리케이션 상태 불러오기
 */
export function loadMainAppState(): StoredMainAppState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MAIN_STATE);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.inputs && parsed.polymerId) {
      return parsed as StoredMainAppState;
    }
  } catch (err) {
    console.warn("Failed to load main app state:", err);
  }
  return null;
}

/**
 * 9. JSON 데이터 백업 파일 생성용 문자열 추출
 */
export function exportMoleculesJson(): string {
  const list = loadSavedMolecules();
  return JSON.stringify({ version: "1.0", exportedAt: new Date().toISOString(), molecules: list }, null, 2);
}

/**
 * 10. JSON 데이터로부터 불러오기/병합
 */
export function importMoleculesJson(jsonStr: string): { success: boolean; count: number; error?: string } {
  try {
    const parsed = JSON.parse(jsonStr);
    const newItems: SavedMoleculePreset[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.molecules)
      ? parsed.molecules
      : [];

    if (newItems.length === 0) {
      return { success: false, count: 0, error: "유효한 분자 목록 데이터를 찾을 수 없습니다." };
    }

    const currentList = loadSavedMolecules();
    const currentIds = new Set(currentList.map((m) => m.id));

    let addedCount = 0;
    newItems.forEach((item) => {
      if (item.name && Array.isArray(item.atoms) && Array.isArray(item.bonds)) {
        if (!currentIds.has(item.id)) {
          currentList.push(item);
          addedCount++;
        }
      }
    });

    localStorage.setItem(STORAGE_KEY_SAVED_LIST, JSON.stringify(currentList));
    return { success: true, count: addedCount };
  } catch (err) {
    return { success: false, count: 0, error: "JSON 파싱 오류가 발생했습니다." };
  }
}
