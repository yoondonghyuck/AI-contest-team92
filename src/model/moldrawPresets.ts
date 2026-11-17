import type { AtomNode, BondEdge, AtomSymbol } from "../components/MolDrawCanvas";
import { POLYMER_DATABASE, type AtomDef, type BondDef, type PolymerDefinition } from "./polymers";
import type { MolecularDescriptor } from "./molecularDescriptor";
import { convertRealRecordToPolymerDefinition, type RealPolymerRecord } from "./polymerDatasetService";

export type PresetCategory = "polymer" | "monomer" | "pharma";

export interface PresetMolecule {
  id: string;
  name: string;
  nameKo: string;
  formula: string;
  smiles: string;
  mw: number;
  description: string;
  category?: PresetCategory;
  atoms: AtomNode[];
  bonds: BondEdge[];
}

/**
 * 메인 랩의 30종 PolymerDefinition을 2D 캔버스용 PresetMolecule 구조로 자동 변환
 */
export function polymerToPresetMolecule(p: PolymerDefinition): PresetMolecule {
  const prefix = p.id;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  // 3D relPos -> 2D 캔버스 좌표 투영 (사슬 방향 X, 수직 Y, Z는 입체 분리용 약한 틸트 오프셋)
  const projected = p.unitAtoms.map((a, i) => {
    const rx = a.relPos[0] + (a.relPos[2] || 0) * 0.12;
    const ry = -(a.relPos[1] || 0) - (a.relPos[2] || 0) * 0.45;
    if (rx < minX) minX = rx;
    if (rx > maxX) maxX = rx;
    if (ry < minY) minY = ry;
    if (ry > maxY) maxY = ry;
    return { rx, ry, a, i };
  });

  const spanX = Math.max(1.0, maxX - minX);
  const scale = Math.min(54, Math.max(26, 420 / spanX));
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;
  const canvasCenterX = 250;
  const canvasCenterY = 210;

  const atoms: AtomNode[] = projected.map(({ rx, ry, a, i }) => ({
    id: `${prefix}_a${i}`,
    symbol: a.element as AtomSymbol,
    x: Math.round(canvasCenterX + (rx - midX) * scale),
    y: Math.round(canvasCenterY + (ry - midY) * scale),
  }));

  const bonds: BondEdge[] = p.unitBonds.map((b, i) => ({
    id: `${prefix}_b${i}`,
    sourceId: `${prefix}_a${b.from}`,
    targetId: `${prefix}_a${b.to}`,
    type: b.order === 3 ? "triple" : b.order === 2 ? "double" : "single",
  }));

  return {
    id: `poly_${p.id}`,
    name: `${p.name} (${p.shortName})`,
    nameKo: `${p.koreanName} [반복단위]`,
    formula: p.formulaUnit,
    smiles: p.smiles,
    mw: p.monomerMW,
    description: `[메인 랩 반복단위] ${p.formulaDisplay} - ${p.description}`,
    category: "polymer",
    atoms,
    bonds,
  };
}

/**
 * 기본 유기 화합물, 핵심 단량체 및 의약 화학식 프리셋 라이브러리
 */
export const CORE_CHEMICAL_PRESETS: PresetMolecule[] = [
  // ─── [1. 대표 유기 및 의약/천연 분자] ───
  {
    id: "benzene",
    name: "Benzene",
    nameKo: "벤젠 (방향족 기본 골격)",
    formula: "C₆H₆",
    smiles: "c1ccccc1",
    mw: 78.11,
    description: "가장 단순하고 안정적인 방향족 6원환 구조",
    category: "pharma",
    atoms: [
      { id: "b1", symbol: "C", x: 200, y: 130 },
      { id: "b2", symbol: "C", x: 260, y: 165 },
      { id: "b3", symbol: "C", x: 260, y: 235 },
      { id: "b4", symbol: "C", x: 200, y: 270 },
      { id: "b5", symbol: "C", x: 140, y: 235 },
      { id: "b6", symbol: "C", x: 140, y: 165 },
    ],
    bonds: [
      { id: "bb1", sourceId: "b1", targetId: "b2", type: "double" },
      { id: "bb2", sourceId: "b2", targetId: "b3", type: "single" },
      { id: "bb3", sourceId: "b3", targetId: "b4", type: "double" },
      { id: "bb4", sourceId: "b4", targetId: "b5", type: "single" },
      { id: "bb5", sourceId: "b5", targetId: "b6", type: "double" },
      { id: "bb6", sourceId: "b6", targetId: "b1", type: "single" },
    ],
  },
  {
    id: "aspirin",
    name: "Aspirin (Acetylsalicylic acid)",
    nameKo: "아스피린 (해열소염제)",
    formula: "C₉H₈O₄",
    smiles: "CC(=O)Oc1ccccc1C(=O)O",
    mw: 180.16,
    description: "아세틸살리실산 대표적 진통해열 의약품",
    category: "pharma",
    atoms: [
      { id: "a1", symbol: "C", x: 180, y: 150 },
      { id: "a2", symbol: "C", x: 240, y: 185 },
      { id: "a3", symbol: "C", x: 240, y: 255 },
      { id: "a4", symbol: "C", x: 180, y: 290 },
      { id: "a5", symbol: "C", x: 120, y: 255 },
      { id: "a6", symbol: "C", x: 120, y: 185 },
      { id: "a7", symbol: "C", x: 300, y: 150 },
      { id: "a8", symbol: "O", x: 360, y: 185 },
      { id: "a9", symbol: "O", x: 300, y: 80 },
      { id: "a10", symbol: "O", x: 180, y: 80 },
      { id: "a11", symbol: "C", x: 120, y: 45 },
      { id: "a12", symbol: "O", x: 120, y: -25 },
      { id: "a13", symbol: "C", x: 60, y: 80 },
    ],
    bonds: [
      { id: "ab1", sourceId: "a1", targetId: "a2", type: "double" },
      { id: "ab2", sourceId: "a2", targetId: "a3", type: "single" },
      { id: "ab3", sourceId: "a3", targetId: "a4", type: "double" },
      { id: "ab4", sourceId: "a4", targetId: "a5", type: "single" },
      { id: "ab5", sourceId: "a5", targetId: "a6", type: "double" },
      { id: "ab6", sourceId: "a6", targetId: "a1", type: "single" },
      { id: "ab7", sourceId: "a2", targetId: "a7", type: "single" },
      { id: "ab8", sourceId: "a7", targetId: "a8", type: "single" },
      { id: "ab9", sourceId: "a7", targetId: "a9", type: "double" },
      { id: "ab10", sourceId: "a1", targetId: "a10", type: "single" },
      { id: "ab11", sourceId: "a10", targetId: "a11", type: "single" },
      { id: "ab12", sourceId: "a11", targetId: "a12", type: "double" },
      { id: "ab13", sourceId: "a11", targetId: "a13", type: "single" },
    ],
  },
  {
    id: "caffeine",
    name: "Caffeine",
    nameKo: "카페인 (중추신경 흥분제)",
    formula: "C₈H₁₀N₄O₂",
    smiles: "Cn1cnc2c1c(=O)n(c(=O)n2C)C",
    mw: 194.19,
    description: "퓨린 유도체 각성 알칼로이드",
    category: "pharma",
    atoms: [
      { id: "c1", symbol: "C", x: 160, y: 150 },
      { id: "c2", symbol: "N", x: 220, y: 120 },
      { id: "c3", symbol: "C", x: 280, y: 150 },
      { id: "c4", symbol: "N", x: 280, y: 220 },
      { id: "c5", symbol: "C", x: 220, y: 250 },
      { id: "c6", symbol: "C", x: 160, y: 220 },
      { id: "c7", symbol: "N", x: 100, y: 150 },
      { id: "c8", symbol: "C", x: 70, y: 185 },
      { id: "c9", symbol: "N", x: 100, y: 220 },
      { id: "c10", symbol: "O", x: 340, y: 120 },
      { id: "c11", symbol: "O", x: 220, y: 320 },
      { id: "c12", symbol: "C", x: 220, y: 50 },
      { id: "c13", symbol: "C", x: 340, y: 250 },
      { id: "c14", symbol: "C", x: 70, y: 90 },
    ],
    bonds: [
      { id: "cb1", sourceId: "c1", targetId: "c2", type: "single" },
      { id: "cb2", sourceId: "c2", targetId: "c3", type: "single" },
      { id: "cb3", sourceId: "c3", targetId: "c4", type: "single" },
      { id: "cb4", sourceId: "c4", targetId: "c5", type: "single" },
      { id: "cb5", sourceId: "c5", targetId: "c6", type: "double" },
      { id: "cb6", sourceId: "c6", targetId: "c1", type: "single" },
      { id: "cb7", sourceId: "c1", targetId: "c7", type: "single" },
      { id: "cb8", sourceId: "c7", targetId: "c8", type: "single" },
      { id: "cb9", sourceId: "c8", targetId: "c9", type: "double" },
      { id: "cb10", sourceId: "c9", targetId: "c6", type: "single" },
      { id: "cb11", sourceId: "c3", targetId: "c10", type: "double" },
      { id: "cb12", sourceId: "c5", targetId: "c11", type: "double" },
      { id: "cb13", sourceId: "c2", targetId: "c12", type: "single" },
      { id: "cb14", sourceId: "c4", targetId: "c13", type: "single" },
      { id: "cb15", sourceId: "c7", targetId: "c14", type: "single" },
    ],
  },
  {
    id: "ethanol",
    name: "Ethanol",
    nameKo: "에탄올 (주정 알코올)",
    formula: "C₂H₅OH",
    smiles: "CCO",
    mw: 46.07,
    description: "가장 기본적인 지방족 알코올",
    category: "monomer",
    atoms: [
      { id: "e1", symbol: "C", x: 140, y: 200 },
      { id: "e2", symbol: "C", x: 220, y: 155 },
      { id: "e3", symbol: "O", x: 300, y: 200 },
    ],
    bonds: [
      { id: "eb1", sourceId: "e1", targetId: "e2", type: "single" },
      { id: "eb2", sourceId: "e2", targetId: "e3", type: "single" },
    ],
  },
  {
    id: "acetic_acid",
    name: "Acetic Acid",
    nameKo: "아세트산 (초산 / PVAc 전구체)",
    formula: "CH₃COOH",
    smiles: "CC(=O)O",
    mw: 60.05,
    description: "대표적인 카르복실산 화합물",
    category: "monomer",
    atoms: [
      { id: "ac1", symbol: "C", x: 140, y: 200 },
      { id: "ac2", symbol: "C", x: 220, y: 200 },
      { id: "ac3", symbol: "O", x: 270, y: 130 },
      { id: "ac4", symbol: "O", x: 270, y: 270 },
    ],
    bonds: [
      { id: "acb1", sourceId: "ac1", targetId: "ac2", type: "single" },
      { id: "acb2", sourceId: "ac2", targetId: "ac3", type: "double" },
      { id: "acb3", sourceId: "ac2", targetId: "ac4", type: "single" },
    ],
  },

  // ─── [2. 고분자 합성 핵심 단량체 및 반응물] ───
  {
    id: "terephthalic_acid",
    name: "Terephthalic Acid (TPA)",
    nameKo: "테레프탈산 (TPA / PET 핵심 원료)",
    formula: "C₈H₆O₄",
    smiles: "O=C(O)c1ccc(C(=O)O)cc1",
    mw: 166.13,
    description: "폴리에스터(PET) 합성의 핵심 방향족 디카르복실산 단량체",
    category: "monomer",
    atoms: [
      { id: "t1", symbol: "C", x: 170, y: 160 },
      { id: "t2", symbol: "C", x: 230, y: 160 },
      { id: "t3", symbol: "C", x: 260, y: 210 },
      { id: "t4", symbol: "C", x: 230, y: 260 },
      { id: "t5", symbol: "C", x: 170, y: 260 },
      { id: "t6", symbol: "C", x: 140, y: 210 },
      { id: "t7", symbol: "C", x: 80, y: 210 },
      { id: "t8", symbol: "O", x: 50, y: 160 },
      { id: "t9", symbol: "O", x: 50, y: 260 },
      { id: "t10", symbol: "C", x: 320, y: 210 },
      { id: "t11", symbol: "O", x: 350, y: 160 },
      { id: "t12", symbol: "O", x: 350, y: 260 },
    ],
    bonds: [
      { id: "tb1", sourceId: "t1", targetId: "t2", type: "double" },
      { id: "tb2", sourceId: "t2", targetId: "t3", type: "single" },
      { id: "tb3", sourceId: "t3", targetId: "t4", type: "double" },
      { id: "tb4", sourceId: "t4", targetId: "t5", type: "single" },
      { id: "tb5", sourceId: "t5", targetId: "t6", type: "double" },
      { id: "tb6", sourceId: "t6", targetId: "t1", type: "single" },
      { id: "tb7", sourceId: "t6", targetId: "t7", type: "single" },
      { id: "tb8", sourceId: "t7", targetId: "t8", type: "double" },
      { id: "tb9", sourceId: "t7", targetId: "t9", type: "single" },
      { id: "tb10", sourceId: "t3", targetId: "t10", type: "single" },
      { id: "tb11", sourceId: "t10", targetId: "t11", type: "double" },
      { id: "tb12", sourceId: "t10", targetId: "t12", type: "single" },
    ],
  },
  {
    id: "ethylene_glycol",
    name: "Ethylene Glycol (EG)",
    nameKo: "에틸렌 글리콜 (EG / PET 원료)",
    formula: "C₂H₆O₂",
    smiles: "OCCO",
    mw: 62.07,
    description: "폴리에스터(PET) 중합의 2가 알코올 단량체",
    category: "monomer",
    atoms: [
      { id: "eg1", symbol: "O", x: 120, y: 210 },
      { id: "eg2", symbol: "C", x: 180, y: 170 },
      { id: "eg3", symbol: "C", x: 240, y: 210 },
      { id: "eg4", symbol: "O", x: 300, y: 170 },
    ],
    bonds: [
      { id: "egb1", sourceId: "eg1", targetId: "eg2", type: "single" },
      { id: "egb2", sourceId: "eg2", targetId: "eg3", type: "single" },
      { id: "egb3", sourceId: "eg3", targetId: "eg4", type: "single" },
    ],
  },
  {
    id: "adipic_acid",
    name: "Adipic Acid",
    nameKo: "아디프산 (나일론 66 원료)",
    formula: "C₆H₁₀O₄",
    smiles: "O=C(O)CCCCC(=O)O",
    mw: 146.14,
    description: "나일론 66 및 폴리우레탄 합성에 쓰이는 지방족 디카르복실산",
    category: "monomer",
    atoms: [
      { id: "ad1", symbol: "O", x: 70, y: 160 },
      { id: "ad2", symbol: "C", x: 110, y: 200 },
      { id: "ad3", symbol: "O", x: 80, y: 250 },
      { id: "ad4", symbol: "C", x: 170, y: 170 },
      { id: "ad5", symbol: "C", x: 220, y: 210 },
      { id: "ad6", symbol: "C", x: 270, y: 170 },
      { id: "ad7", symbol: "C", x: 320, y: 210 },
      { id: "ad8", symbol: "C", x: 380, y: 170 },
      { id: "ad9", symbol: "O", x: 420, y: 130 },
      { id: "ad10", symbol: "O", x: 410, y: 220 },
    ],
    bonds: [
      { id: "adb1", sourceId: "ad2", targetId: "ad1", type: "double" },
      { id: "adb2", sourceId: "ad2", targetId: "ad3", type: "single" },
      { id: "adb3", sourceId: "ad2", targetId: "ad4", type: "single" },
      { id: "adb4", sourceId: "ad4", targetId: "ad5", type: "single" },
      { id: "adb5", sourceId: "ad5", targetId: "ad6", type: "single" },
      { id: "adb6", sourceId: "ad6", targetId: "ad7", type: "single" },
      { id: "adb7", sourceId: "ad7", targetId: "ad8", type: "single" },
      { id: "adb8", sourceId: "ad8", targetId: "ad9", type: "double" },
      { id: "adb9", sourceId: "ad8", targetId: "ad10", type: "single" },
    ],
  },
  {
    id: "hexamethylenediamine",
    name: "Hexamethylenediamine (HMDA)",
    nameKo: "헥사메틸렌디아민 (나일론 66 원료)",
    formula: "C₆H₁₆N₂",
    smiles: "NCCCCCCN",
    mw: 116.21,
    description: "나일론 66 축합 중합의 핵심 디아민 단량체",
    category: "monomer",
    atoms: [
      { id: "hm1", symbol: "N", x: 70, y: 200 },
      { id: "hm2", symbol: "C", x: 120, y: 165 },
      { id: "hm3", symbol: "C", x: 170, y: 200 },
      { id: "hm4", symbol: "C", x: 220, y: 165 },
      { id: "hm5", symbol: "C", x: 270, y: 200 },
      { id: "hm6", symbol: "C", x: 320, y: 165 },
      { id: "hm7", symbol: "C", x: 370, y: 200 },
      { id: "hm8", symbol: "N", x: 420, y: 165 },
    ],
    bonds: [
      { id: "hmb1", sourceId: "hm1", targetId: "hm2", type: "single" },
      { id: "hmb2", sourceId: "hm2", targetId: "hm3", type: "single" },
      { id: "hmb3", sourceId: "hm3", targetId: "hm4", type: "single" },
      { id: "hmb4", sourceId: "hm4", targetId: "hm5", type: "single" },
      { id: "hmb5", sourceId: "hm5", targetId: "hm6", type: "single" },
      { id: "hmb6", sourceId: "hm6", targetId: "hm7", type: "single" },
      { id: "hmb7", sourceId: "hm7", targetId: "hm8", type: "single" },
    ],
  },
  {
    id: "caprolactam",
    name: "Caprolactam (ε-Caprolactam)",
    nameKo: "카프로락탐 (나일론 6 단량체)",
    formula: "C₆H₁₁NO",
    smiles: "O=C1CCCCCN1",
    mw: 113.16,
    description: "개환 중합(ROP)을 통해 나일론 6 섬유가 되는 7원환 락탐",
    category: "monomer",
    atoms: [
      { id: "cp1", symbol: "N", x: 160, y: 160 },
      { id: "cp2", symbol: "C", x: 220, y: 140 },
      { id: "cp3", symbol: "O", x: 250, y: 85 },
      { id: "cp4", symbol: "C", x: 270, y: 190 },
      { id: "cp5", symbol: "C", x: 250, y: 250 },
      { id: "cp6", symbol: "C", x: 190, y: 280 },
      { id: "cp7", symbol: "C", x: 140, y: 245 },
      { id: "cp8", symbol: "C", x: 130, y: 190 },
    ],
    bonds: [
      { id: "cpb1", sourceId: "cp1", targetId: "cp2", type: "single" },
      { id: "cpb2", sourceId: "cp2", targetId: "cp3", type: "double" },
      { id: "cpb3", sourceId: "cp2", targetId: "cp4", type: "single" },
      { id: "cpb4", sourceId: "cp4", targetId: "cp5", type: "single" },
      { id: "cpb5", sourceId: "cp5", targetId: "cp6", type: "single" },
      { id: "cpb6", sourceId: "cp6", targetId: "cp7", type: "single" },
      { id: "cpb7", sourceId: "cp7", targetId: "cp8", type: "single" },
      { id: "cpb8", sourceId: "cp8", targetId: "cp1", type: "single" },
    ],
  },
  {
    id: "styrene",
    name: "Styrene monomer",
    nameKo: "스티렌 (PS 단량체)",
    formula: "C₈H₈",
    smiles: "C=Cc1ccccc1",
    mw: 104.15,
    description: "폴리스티렌(PS) 및 고무 공중합에 널리 쓰이는 방향족 비닐 단량체",
    category: "monomer",
    atoms: [
      { id: "st1", symbol: "C", x: 170, y: 170 },
      { id: "st2", symbol: "C", x: 230, y: 170 },
      { id: "st3", symbol: "C", x: 260, y: 220 },
      { id: "st4", symbol: "C", x: 230, y: 270 },
      { id: "st5", symbol: "C", x: 170, y: 270 },
      { id: "st6", symbol: "C", x: 140, y: 220 },
      { id: "st7", symbol: "C", x: 260, y: 120 },
      { id: "st8", symbol: "C", x: 320, y: 105 },
    ],
    bonds: [
      { id: "stb1", sourceId: "st1", targetId: "st2", type: "double" },
      { id: "stb2", sourceId: "st2", targetId: "st3", type: "single" },
      { id: "stb3", sourceId: "st3", targetId: "st4", type: "double" },
      { id: "stb4", sourceId: "st4", targetId: "st5", type: "single" },
      { id: "stb5", sourceId: "st5", targetId: "st6", type: "double" },
      { id: "stb6", sourceId: "st6", targetId: "st1", type: "single" },
      { id: "stb7", sourceId: "st2", targetId: "st7", type: "single" },
      { id: "stb8", sourceId: "st7", targetId: "st8", type: "double" },
    ],
  },
  {
    id: "vinyl_chloride",
    name: "Vinyl Chloride monomer (VCM)",
    nameKo: "염화비닐 (PVC 단량체)",
    formula: "C₂H₃Cl",
    smiles: "C=CCl",
    mw: 62.50,
    description: "PVC 중합의 할로겐화 비닐 단량체",
    category: "monomer",
    atoms: [
      { id: "vc1", symbol: "C", x: 160, y: 210 },
      { id: "vc2", symbol: "C", x: 230, y: 180 },
      { id: "vc3", symbol: "Cl", x: 300, y: 215 },
    ],
    bonds: [
      { id: "vcb1", sourceId: "vc1", targetId: "vc2", type: "double" },
      { id: "vcb2", sourceId: "vc2", targetId: "vc3", type: "single" },
    ],
  },
  {
    id: "acrylonitrile",
    name: "Acrylonitrile monomer",
    nameKo: "아크릴로니트릴 (PAN / 탄소섬유 전구체)",
    formula: "C₃H₃N",
    smiles: "C=CC#N",
    mw: 53.06,
    description: "고강도 탄소 섬유(PAN) 및 아크릴 섬유의 원료",
    category: "monomer",
    atoms: [
      { id: "an1", symbol: "C", x: 150, y: 215 },
      { id: "an2", symbol: "C", x: 215, y: 185 },
      { id: "an3", symbol: "C", x: 280, y: 185 },
      { id: "an4", symbol: "N", x: 345, y: 185 },
    ],
    bonds: [
      { id: "anb1", sourceId: "an1", targetId: "an2", type: "double" },
      { id: "anb2", sourceId: "an2", targetId: "an3", type: "single" },
      { id: "anb3", sourceId: "an3", targetId: "an4", type: "triple" },
    ],
  },
  {
    id: "methyl_methacrylate",
    name: "Methyl Methacrylate (MMA)",
    nameKo: "메틸 메타크릴레이트 (PMMA 아크릴 유리 원료)",
    formula: "C₅H₈O₂",
    smiles: "CC(=C)C(=O)OC",
    mw: 100.12,
    description: "투명성이 뛰어난 PMMA 유기유리의 에스테르 단량체",
    category: "monomer",
    atoms: [
      { id: "mm1", symbol: "C", x: 140, y: 240 },
      { id: "mm2", symbol: "C", x: 190, y: 205 },
      { id: "mm3", symbol: "C", x: 170, y: 145 },
      { id: "mm4", symbol: "C", x: 255, y: 210 },
      { id: "mm5", symbol: "O", x: 280, y: 270 },
      { id: "mm6", symbol: "O", x: 295, y: 155 },
      { id: "mm7", symbol: "C", x: 360, y: 155 },
    ],
    bonds: [
      { id: "mmb1", sourceId: "mm1", targetId: "mm2", type: "double" },
      { id: "mmb2", sourceId: "mm2", targetId: "mm3", type: "single" },
      { id: "mmb3", sourceId: "mm2", targetId: "mm4", type: "single" },
      { id: "mmb4", sourceId: "mm4", targetId: "mm5", type: "double" },
      { id: "mmb5", sourceId: "mm4", targetId: "mm6", type: "single" },
      { id: "mmb6", sourceId: "mm6", targetId: "mm7", type: "single" },
    ],
  },
  {
    id: "bisphenol_a",
    name: "Bisphenol A (BPA)",
    nameKo: "비스페놀 A (에폭시/PC 핵심 원료)",
    formula: "C₁₅H₁₆O₂",
    smiles: "CC(C)(c1ccc(O)cc1)c2ccc(O)cc2",
    mw: 228.29,
    description: "에폭시 수지 및 폴리카보네이트 합성의 핵심 방향족 디페놀",
    category: "monomer",
    atoms: [
      // 중심 탄소 및 메틸
      { id: "bp_c0", symbol: "C", x: 250, y: 200 },
      { id: "bp_m1", symbol: "C", x: 250, y: 140 },
      { id: "bp_m2", symbol: "C", x: 250, y: 260 },
      // 좌측 페놀 링
      { id: "bp_l1", symbol: "C", x: 195, y: 185 },
      { id: "bp_l2", symbol: "C", x: 145, y: 170 },
      { id: "bp_l3", symbol: "C", x: 100, y: 185 },
      { id: "bp_l4", symbol: "C", x: 100, y: 215 },
      { id: "bp_l5", symbol: "C", x: 145, y: 230 },
      { id: "bp_l6", symbol: "C", x: 195, y: 215 },
      { id: "bp_oh1", symbol: "O", x: 50, y: 200 },
      // 우측 페놀 링
      { id: "bp_r1", symbol: "C", x: 305, y: 185 },
      { id: "bp_r2", symbol: "C", x: 355, y: 170 },
      { id: "bp_r3", symbol: "C", x: 400, y: 185 },
      { id: "bp_r4", symbol: "C", x: 400, y: 215 },
      { id: "bp_r5", symbol: "C", x: 355, y: 230 },
      { id: "bp_r6", symbol: "C", x: 305, y: 215 },
      { id: "bp_oh2", symbol: "O", x: 450, y: 200 },
    ],
    bonds: [
      { id: "bpb1", sourceId: "bp_c0", targetId: "bp_m1", type: "single" },
      { id: "bpb2", sourceId: "bp_c0", targetId: "bp_m2", type: "single" },
      { id: "bpb3", sourceId: "bp_c0", targetId: "bp_l1", type: "single" },
      { id: "bpb4", sourceId: "bp_c0", targetId: "bp_r1", type: "single" },
      // 좌측 링
      { id: "bpb5", sourceId: "bp_l1", targetId: "bp_l2", type: "double" },
      { id: "bpb6", sourceId: "bp_l2", targetId: "bp_l3", type: "single" },
      { id: "bpb7", sourceId: "bp_l3", targetId: "bp_l4", type: "double" },
      { id: "bpb8", sourceId: "bp_l4", targetId: "bp_l5", type: "single" },
      { id: "bpb9", sourceId: "bp_l5", targetId: "bp_l6", type: "double" },
      { id: "bpb10", sourceId: "bp_l6", targetId: "bp_l1", type: "single" },
      { id: "bpb11", sourceId: "bp_l3", targetId: "bp_oh1", type: "single" },
      // 우측 링
      { id: "bpb12", sourceId: "bp_r1", targetId: "bp_r2", type: "double" },
      { id: "bpb13", sourceId: "bp_r2", targetId: "bp_r3", type: "single" },
      { id: "bpb14", sourceId: "bp_r3", targetId: "bp_r4", type: "double" },
      { id: "bpb15", sourceId: "bp_r4", targetId: "bp_r5", type: "single" },
      { id: "bpb16", sourceId: "bp_r5", targetId: "bp_r6", type: "double" },
      { id: "bpb17", sourceId: "bp_r6", targetId: "bp_r1", type: "single" },
      { id: "bpb18", sourceId: "bp_r3", targetId: "bp_oh2", type: "single" },
    ],
  },
  {
    id: "propylene",
    name: "Propylene monomer",
    nameKo: "프로필렌 (PP 단량체)",
    formula: "C₃H₆",
    smiles: "C=CC",
    mw: 42.08,
    description: "폴리프로필렌(PP) 수지 합성의 기본 올레핀 단량체",
    category: "monomer",
    atoms: [
      { id: "pr1", symbol: "C", x: 160, y: 220 },
      { id: "pr2", symbol: "C", x: 220, y: 180 },
      { id: "pr3", symbol: "C", x: 280, y: 215 },
    ],
    bonds: [
      { id: "prb1", sourceId: "pr1", targetId: "pr2", type: "double" },
      { id: "prb2", sourceId: "pr2", targetId: "pr3", type: "single" },
    ],
  },
  {
    id: "tetrafluoroethylene",
    name: "Tetrafluoroethylene (TFE)",
    nameKo: "테트라플루오로에틸렌 (테프론/PTFE 단량체)",
    formula: "C₂F₄",
    smiles: "FC(F)=C(F)F",
    mw: 100.02,
    description: "최고 수준의 내열성 및 화학적 불활성을 갖는 PTFE 불소 수지 단량체",
    category: "monomer",
    atoms: [
      { id: "tf1", symbol: "C", x: 200, y: 200 },
      { id: "tf2", symbol: "C", x: 270, y: 200 },
      { id: "tf3", symbol: "F", x: 160, y: 155 },
      { id: "tf4", symbol: "F", x: 160, y: 245 },
      { id: "tf5", symbol: "F", x: 310, y: 155 },
      { id: "tf6", symbol: "F", x: 310, y: 245 },
    ],
    bonds: [
      { id: "tfb1", sourceId: "tf1", targetId: "tf2", type: "double" },
      { id: "tfb2", sourceId: "tf1", targetId: "tf3", type: "single" },
      { id: "tfb3", sourceId: "tf1", targetId: "tf4", type: "single" },
      { id: "tfb4", sourceId: "tf2", targetId: "tf5", type: "single" },
      { id: "tfb5", sourceId: "tf2", targetId: "tf6", type: "single" },
    ],
  },
  {
    id: "butadiene",
    name: "1,3-Butadiene",
    nameKo: "1,3-부타디엔 (합성고무 단량체)",
    formula: "C₄H₆",
    smiles: "C=CC=C",
    mw: 54.09,
    description: "폴리부타디엔 고무, ABS, SBR 합성의 핵심 공액 디엔 화합물",
    category: "monomer",
    atoms: [
      { id: "bd1", symbol: "C", x: 140, y: 215 },
      { id: "bd2", symbol: "C", x: 195, y: 180 },
      { id: "bd3", symbol: "C", x: 250, y: 215 },
      { id: "bd4", symbol: "C", x: 305, y: 180 },
    ],
    bonds: [
      { id: "bdb1", sourceId: "bd1", targetId: "bd2", type: "double" },
      { id: "bdb2", sourceId: "bd2", targetId: "bd3", type: "single" },
      { id: "bdb3", sourceId: "bd3", targetId: "bd4", type: "double" },
    ],
  },
  {
    id: "isoprene",
    name: "Isoprene (2-Methyl-1,3-butadiene)",
    nameKo: "이소프렌 (천연고무 단량체)",
    formula: "C₅H₈",
    smiles: "CC(=C)C=C",
    mw: 68.12,
    description: "천연고무 및 합성 폴리이소프렌의 핵심 분지형 디엔 단량체",
    category: "monomer",
    atoms: [
      { id: "ip1", symbol: "C", x: 140, y: 215 },
      { id: "ip2", symbol: "C", x: 195, y: 180 },
      { id: "ip3", symbol: "C", x: 180, y: 125 },
      { id: "ip4", symbol: "C", x: 250, y: 215 },
      { id: "ip5", symbol: "C", x: 305, y: 180 },
    ],
    bonds: [
      { id: "ipb1", sourceId: "ip1", targetId: "ip2", type: "double" },
      { id: "ipb2", sourceId: "ip2", targetId: "ip3", type: "single" },
      { id: "ipb3", sourceId: "ip2", targetId: "ip4", type: "single" },
      { id: "ipb4", sourceId: "ip4", targetId: "ip5", type: "double" },
    ],
  },
  {
    id: "ethylene",
    name: "Ethylene monomer",
    nameKo: "에틸렌 (PE 단량체)",
    formula: "C₂H₄",
    smiles: "C=C",
    mw: 28.05,
    description: "폴리에틸렌(PE) 및 에틸렌 공중합체 합성의 가장 기본적인 올레핀 단량체",
    category: "monomer",
    atoms: [
      { id: "et1", symbol: "C", x: 185, y: 200 },
      { id: "et2", symbol: "C", x: 265, y: 200 },
    ],
    bonds: [
      { id: "etb1", sourceId: "et1", targetId: "et2", type: "double" },
    ],
  },
  {
    id: "vinyl_acetate",
    name: "Vinyl Acetate monomer (VAM)",
    nameKo: "아세트산비닐 (PVAc / PVA 단량체)",
    formula: "C₄H₆O₂",
    smiles: "CC(=O)OC=C",
    mw: 86.09,
    description: "폴리아세트산비닐(PVAc), 폴리비닐알코올(PVA) 및 EVA 공중합체 핵심 단량체",
    category: "monomer",
    atoms: [
      { id: "va1", symbol: "C", x: 130, y: 215 },
      { id: "va2", symbol: "C", x: 190, y: 180 },
      { id: "va3", symbol: "O", x: 250, y: 215 },
      { id: "va4", symbol: "C", x: 310, y: 180 },
      { id: "va5", symbol: "O", x: 310, y: 120 },
      { id: "va6", symbol: "C", x: 370, y: 215 },
    ],
    bonds: [
      { id: "vab1", sourceId: "va1", targetId: "va2", type: "double" },
      { id: "vab2", sourceId: "va2", targetId: "va3", type: "single" },
      { id: "vab3", sourceId: "va3", targetId: "va4", type: "single" },
      { id: "vab4", sourceId: "va4", targetId: "va5", type: "double" },
      { id: "vab5", sourceId: "va4", targetId: "va6", type: "single" },
    ],
  },
  {
    id: "lactic_acid",
    name: "L-Lactic Acid / Lactide",
    nameKo: "젖산 / 락타이드 (PLA 친환경 단량체)",
    formula: "C₃H₆O₃",
    smiles: "CC(O)C(=O)O",
    mw: 90.08,
    description: "생분해성 폴리락트산(PLA) 바이오 플라스틱의 핵심 단량체",
    category: "monomer",
    atoms: [
      { id: "la1", symbol: "C", x: 140, y: 220 },
      { id: "la2", symbol: "C", x: 205, y: 185 },
      { id: "la3", symbol: "O", x: 205, y: 120 },
      { id: "la4", symbol: "C", x: 270, y: 220 },
      { id: "la5", symbol: "O", x: 330, y: 185 },
      { id: "la6", symbol: "O", x: 270, y: 280 },
    ],
    bonds: [
      { id: "lab1", sourceId: "la1", targetId: "la2", type: "single" },
      { id: "lab2", sourceId: "la2", targetId: "la3", type: "single" },
      { id: "lab3", sourceId: "la2", targetId: "la4", type: "single" },
      { id: "lab4", sourceId: "la4", targetId: "la5", type: "single" },
      { id: "lab5", sourceId: "la4", targetId: "la6", type: "double" },
    ],
  },
  {
    id: "ethylene_oxide",
    name: "Ethylene Oxide (EO)",
    nameKo: "산화에틸렌 (PEG / PEO 단량체)",
    formula: "C₂H₄O",
    smiles: "C1CO1",
    mw: 44.05,
    description: "친수성 폴리에틸렌글리콜(PEG/PEO) 개환 중합의 3원환 에폭사이드 단량체",
    category: "monomer",
    atoms: [
      { id: "eo1", symbol: "C", x: 190, y: 225 },
      { id: "eo2", symbol: "C", x: 260, y: 225 },
      { id: "eo3", symbol: "O", x: 225, y: 165 },
    ],
    bonds: [
      { id: "eob1", sourceId: "eo1", targetId: "eo2", type: "single" },
      { id: "eob2", sourceId: "eo2", targetId: "eo3", type: "single" },
      { id: "eob3", sourceId: "eo3", targetId: "eo1", type: "single" },
    ],
  },
];

/**
 * 메인 랩의 30종 고분자 반복단위 전체 프리셋 목록
 */
export const MAIN_LAB_POLYMER_PRESETS: PresetMolecule[] = POLYMER_DATABASE.map(polymerToPresetMolecule);

/**
 * 2D 분자 그리기 스튜디오에서 지원하는 전체 종합 프리셋 (메인 랩 반복단위 30종 + 유기/단량체 15종 = 45+종)
 */
export const POPULAR_MOLECULES: PresetMolecule[] = [
  ...CORE_CHEMICAL_PRESETS,
  ...MAIN_LAB_POLYMER_PRESETS,
];

/**
 * 3,284건 오픈 데이터셋(RealPolymerRecord) 항목을 2D 에디터 캔버스용 PresetMolecule로 즉시 변환
 */
export function realRecordToPresetMolecule(record: RealPolymerRecord): PresetMolecule {
  const polyDef = convertRealRecordToPolymerDefinition(record);
  const basePreset = polymerToPresetMolecule(polyDef);
  return {
    ...basePreset,
    id: `open_${record.id}`,
    name: `${record.name} [${record.source}]`,
    nameKo: `${record.koreanName || record.name} (오픈DB 단량체/반복단위)`,
    formula: record.smiles,
    smiles: record.smiles,
    mw: record.monomerMw,
    description: `[${record.source} 공인 DB · Tg ${record.tg}℃ · 밀도 ${record.density}g/cm³] ${record.description || record.category}`,
    category: "monomer",
  };
}

/**
 * 현재 2D 캔버스 위에 새로운 단량체/고분자 구조를 우측에 이어 붙이거나(조합/공중합) 배치하는 유틸리티
 */
export function appendMoleculeToCanvas(
  existingAtoms: AtomNode[],
  existingBonds: BondEdge[],
  incoming: { atoms: AtomNode[]; bonds: BondEdge[] },
  connectWithSingleBond = true
): { atoms: AtomNode[]; bonds: BondEdge[] } {
  if (existingAtoms.length === 0) {
    return {
      atoms: incoming.atoms.map((a) => ({ ...a })),
      bonds: incoming.bonds.map((b) => ({ ...b })),
    };
  }

  // 기존 원자들의 우측 끝(maxX) 및 평균 Y 계산
  let existingMaxX = -Infinity;
  let existingSumY = 0;
  let tailAtom: AtomNode = existingAtoms[existingAtoms.length - 1];

  existingAtoms.forEach((a) => {
    existingSumY += a.y;
    if (a.x > existingMaxX) {
      existingMaxX = a.x;
      tailAtom = a;
    }
  });
  const existingCenterY = existingSumY / existingAtoms.length;

  // 새로 추가할 원자들의 좌측 끝(minX) 및 평균 Y 계산
  let incomingMinX = Infinity;
  let incomingSumY = 0;
  let headIncomingOrigId = incoming.atoms[0]?.id;

  incoming.atoms.forEach((a) => {
    incomingSumY += a.y;
    if (a.x < incomingMinX) {
      incomingMinX = a.x;
      headIncomingOrigId = a.id;
    }
  });
  const incomingCenterY = incoming.atoms.length > 0 ? incomingSumY / incoming.atoms.length : existingCenterY;

  const gapPx = 68;
  const shiftX = existingMaxX + gapPx - (incomingMinX === Infinity ? 0 : incomingMinX);
  const shiftY = existingCenterY - incomingCenterY;
  const uid = `add_${Date.now().toString(36)}_${Math.floor(Math.random() * 1000)}`;

  const idMap = new Map<string, string>();
  const newAtoms: AtomNode[] = incoming.atoms.map((a, idx) => {
    const newId = `${uid}_a${idx}`;
    idMap.set(a.id, newId);
    return {
      ...a,
      id: newId,
      x: Math.round(a.x + shiftX),
      y: Math.round(a.y + shiftY),
    };
  });

  const newBonds: BondEdge[] = incoming.bonds
    .map((b, idx) => {
      const s = idMap.get(b.sourceId);
      const t = idMap.get(b.targetId);
      if (!s || !t) return null;
      return {
        ...b,
        id: `${uid}_b${idx}`,
        sourceId: s,
        targetId: t,
      };
    })
    .filter(Boolean) as BondEdge[];

  // 기존 사슬의 우측 말단 탄소/헤테로원자와 신규 단량체의 좌측 시작 원자를 단일 결합으로 자동 연결할지 여부
  const bridgeBonds: BondEdge[] = [];
  if (connectWithSingleBond && tailAtom && headIncomingOrigId && idMap.has(headIncomingOrigId)) {
    // 만약 tailAtom이 H가 아니라면 연결
    const connectSource =
      tailAtom.symbol !== "H"
        ? tailAtom
        : existingAtoms.find((a) => a.symbol === "C") || tailAtom;
    bridgeBonds.push({
      id: `${uid}_bridge`,
      sourceId: connectSource.id,
      targetId: idMap.get(headIncomingOrigId)!,
      type: "single",
    });
  }

  return {
    atoms: [...existingAtoms, ...newAtoms],
    bonds: [...existingBonds, ...newBonds, ...bridgeBonds],
  };
}

/**
 * 벤젠 고리 템플릿 생성기 (지정한 x, y 중심 위치에 6각 고리 생성)
 */
export function createBenzeneRing(centerX: number, centerY: number, radius = 55) {
  const ts = Date.now().toString(36);
  const atoms: AtomNode[] = [];
  const bonds: BondEdge[] = [];

  for (let i = 0; i < 6; i++) {
    const angle = (i * 60 - 30) * (Math.PI / 180);
    const x = Math.round(centerX + radius * Math.cos(angle));
    const y = Math.round(centerY + radius * Math.sin(angle));
    atoms.push({
      id: `c_${ts}_${i}`,
      symbol: "C",
      x,
      y,
    });
  }

  for (let i = 0; i < 6; i++) {
    const next = (i + 1) % 6;
    bonds.push({
      id: `b_${ts}_${i}`,
      sourceId: atoms[i].id,
      targetId: atoms[next].id,
      type: i % 2 === 0 ? "double" : "single",
    });
  }

  return { atoms, bonds };
}

/**
 * 5각 고리 (시클로펜탄) 템플릿 생성기
 */
export function createCyclopentylRing(centerX: number, centerY: number, radius = 50) {
  const ts = Date.now().toString(36);
  const atoms: AtomNode[] = [];
  const bonds: BondEdge[] = [];

  for (let i = 0; i < 5; i++) {
    const angle = (i * 72 - 90) * (Math.PI / 180);
    const x = Math.round(centerX + radius * Math.cos(angle));
    const y = Math.round(centerY + radius * Math.sin(angle));
    atoms.push({
      id: `cp_${ts}_${i}`,
      symbol: "C",
      x,
      y,
    });
  }

  for (let i = 0; i < 5; i++) {
    const next = (i + 1) % 5;
    bonds.push({
      id: `cpb_${ts}_${i}`,
      sourceId: atoms[i].id,
      targetId: atoms[next].id,
      type: "single",
    });
  }

  return { atoms, bonds };
}

/**
 * 스케치된 2D/3D 원자 및 결합 데이터로부터 메인 시뮬레이션용 PolymerDefinition 생성
 */
export function createPolymerFromSketch(
  atoms: AtomNode[],
  bonds: BondEdge[],
  descriptor: MolecularDescriptor
): PolymerDefinition {
  if (atoms.length === 0) {
    return {
      id: "custom_mol",
      name: "Custom Sketched Molecule",
      shortName: "Custom",
      koreanName: "스케치 분자 (비어있음)",
      aliases: ["custom", "sketch"],
      category: "특수 구조 (Special Architecture)",
      thermalCategory: "Special (특수 구조)",
      chainArchitecture: "단량체 스케치",
      smiles: "C",
      density: 1.2,
      tg: 50,
      tm: 150,
      formulaUnit: "C",
      formulaDisplay: "C",
      monomerMW: 12.0,
      description: "스케치된 단량체 분자 구조입니다.",
      application: "사용자 맞춤형 고분자 설계",
      unitLength: 3.0,
      unitAtoms: [{ name: "C1", element: "C", relPos: [0, 0, 0], isBackbone: true }],
      unitBonds: [],
      connection: { headAtomIndex: 0, tailAtomIndex: 0, bondOrder: 1 },
    };
  }

  // 1. 2D 좌표 중심점 계산
  let sumX = 0;
  let sumY = 0;
  let minX = Infinity;
  let maxX = -Infinity;
  atoms.forEach((a) => {
    sumX += a.x;
    sumY += a.y;
    if (a.x < minX) minX = a.x;
    if (a.x > maxX) maxX = a.x;
  });
  const centerX = sumX / atoms.length;
  const centerY = sumY / atoms.length;
  const scale = 0.035;

  // 2. unitAtoms 생성
  const atomIdToIndex = new Map<string, number>();
  let headIdx = 0;
  let tailIdx = 0;
  let minRelX = Infinity;
  let maxRelX = -Infinity;

  const unitAtoms: AtomDef[] = atoms.map((a, idx) => {
    atomIdToIndex.set(a.id, idx);
    const relX = (a.x - centerX) * scale;
    const relY = -(a.y - centerY) * scale;
    const relZ = (idx % 2 === 0 ? 0.15 : -0.15) * (atoms.length > 2 ? 1 : 0);

    if (relX < minRelX) {
      minRelX = relX;
      headIdx = idx;
    }
    if (relX > maxRelX) {
      maxRelX = relX;
      tailIdx = idx;
    }

    const validElement =
      a.symbol === "C" ||
      a.symbol === "H" ||
      a.symbol === "O" ||
      a.symbol === "N" ||
      a.symbol === "F" ||
      a.symbol === "Cl" ||
      a.symbol === "S"
        ? a.symbol
        : "C";

    return {
      name: `${validElement}${idx + 1}`,
      element: validElement,
      relPos: [Number(relX.toFixed(3)), Number(relY.toFixed(3)), Number(relZ.toFixed(3))],
      isBackbone: idx === 0 || validElement === "C",
    };
  });

  // 3. unitBonds 생성
  const unitBonds: BondDef[] = [];
  bonds.forEach((b) => {
    const fromIdx = atomIdToIndex.get(b.sourceId);
    const toIdx = atomIdToIndex.get(b.targetId);
    if (fromIdx !== undefined && toIdx !== undefined) {
      unitBonds.push({
        from: fromIdx,
        to: toIdx,
        order: b.type === "triple" ? 3 : b.type === "double" ? 2 : 1,
      });
    }
  });

  const spanX = Math.max(2.5, (maxX - minX) * scale);
  const unitLength = Number((spanX + 1.2).toFixed(2));

  return {
    id: "custom_mol",
    name: `Custom Sketched Polymer (${descriptor.formula})`,
    shortName: `Custom-${descriptor.formula}`,
    koreanName: `스케치 분자 (${descriptor.formula})`,
    aliases: ["custom", "sketch", "custom_mol", descriptor.formula],
    category: "특수 구조 (Special Architecture)",
    thermalCategory: "Special (특수 구조)",
    chainArchitecture: "MolDraw 스케치 유래 사슬",
    smiles: descriptor.formula,
    density: 1.25,
    tg: descriptor.estimatedTg || 65,
    tm: descriptor.estimatedTm || 220,
    formulaUnit: descriptor.formula,
    formulaDisplay: descriptor.formula,
    monomerMW: descriptor.monomerMW || 100,
    description: `사용자가 MolDraw 스튜디오에서 직접 그린 화학 구조식(${descriptor.formula}, 이중결합 비율 ${(descriptor.doubleBondRatio * 100).toFixed(0)}%) 기반의 고분자 모델입니다.`,
    application: "맞춤형 섬유 물성 및 염색성 예측 시뮬레이션",
    unitLength,
    unitAtoms,
    unitBonds,
    connection: {
      headAtomIndex: headIdx,
      tailAtomIndex: tailIdx,
      bondOrder: 1,
    },
  };
}
