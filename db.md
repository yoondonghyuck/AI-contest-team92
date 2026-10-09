# 🧪 고분자 DB 및 미세구조 연동 마스터 프롬프트 가이드

이 문서는 제공된 **고분자 리스트(동종고분자, 공중합체, 열가소성/열경화성, 특수 구조 고분자)**를 AI에 입력하여 **자동 검색, IUPAC 매핑, SMILES 연동, 3D 구조 시각화 및 물성 예측 엔진**을 구축할 때 사용하는 프롬프트 세트입니다.

---

## 🚀 1. AI IDE / 에이전트 전달용 마스터 프롬프트 (Copy & Paste)

아래 상자 안의 구문 전체를 복사하여 Cursor, Windsurf, ChatGPT, 또는 Claude에 붙여넣으세요.

```text
너는 고분자 화학(Polymer Chemistry), 재료정보학(Materials Informatics), 그리고 프론트엔드 Web3D 전문 수석 엔지니어다.

아래 제공하는 고분자 데이터베이스 목록을 바탕으로, 사용자가 고분자명(관용명, IUPAC명, 약어)을 검색하거나 선택하면 해당 고분자의 [화학적 구조 특성, 단량체/사슬 분류, 물성 파라미터, 3D 분자/사슬 시각화 데이터]를 즉시 반환하고 연동하는 고분자 정보 검색 및 물성 예측 모듈을 구현해 줘.

---

### 1. 통합 고분자 데이터베이스 (Polymer Database List)

#### [A. 범용 및 공학용 단일 고분자 (Homopolymers)]
1. Polyethylene (PE) | IUPAC: Poly(methylene)
2. Polytetrafluoroethylene (PTFE, 테프론) | IUPAC: Poly(difluoromethylene)
3. Polystyrene (PS) | IUPAC: Poly(1-phenylethylene)
4. Polypropylene (PP) | IUPAC: Poly(propylene)
5. Poly(vinyl chloride) (PVC) | IUPAC: Poly(1-chloroethylene)
6. Polyacrylonitrile (PAN, 아크릴) | IUPAC: Poly(1-cyanoethylene)
7. Poly(methyl methacrylate) (PMMA, 아크릴 유리) | IUPAC: Poly[1-(methoxycarbonyl)-1-methylethylene]
8. Poly(vinyl acetate) (PVAc) | IUPAC: Poly(1-acetoxyethylene)
9. Poly(ethylene terephthalate) (PET, 폴리에스터) | IUPAC: Poly(oxyethyleneoxyterephthaloyl)
10. Nylon 66 | 원료명: Poly(hexamethylene adipamide) | IUPAC: Poly[imino(hexamethylene)iminoadipoyl]
11. Nylon 6 | 원료명: Polycaprolactam | IUPAC: Poly[imino(1-oxohexane-1,6-diyl)]

#### [B. 공중합체 및 특수 사슬 구조 (Copolymers & Architectures)]
12. HIPS (High Impact Polystyrene): PS 주사슬 + Polybutadiene 가지 (그래프트 공중합체)
13. Polybutadiene (폴리부타디엔 고무)
14. Polyisoprene (폴리이소프렌 / 천연고무)
15. Poly[styrene-co-(methyl methacrylate)]: 스티렌-MMA 랜덤 공중합체
16. Poly[styrene-alt-(methyl methacrylate)]: 스티렌-MMA 교대 공중합체
17. Polystyrene-block-poly(methyl methacrylate): 스티렌-MMA 블록 공중합체
18. Polystyrene-graft-poly(methyl methacrylate): 스티렌-MMA 그래프트 공중합체
19. Poly[styrene-co-butadiene-co-(vinyl acetate)]: 3원 랜덤 공중합체
20. Polystyrene-block-polyisoprene-block-polystyrene (SIS): 3중 블록 공중합체
21. Polybutadiene-block-(polystyrene-graft-polyacrylonitrile): 블록-그래프트 복합 3원공중합체

#### [C. 열경화성 수지 (Thermosetting Plastics)]
22. Phenol 수지 (페놀-포름알데히드 수지)
23. Urea 수지 (요소 수지)
24. Melamine 수지 (멜라민 수지)
25. Epoxy 수지 (에폭시 수지)
26. Unsaturated polyester (불포화 폴리에스터)

#### [D. 특수 구조 및 기능성 고분자 (Special Architectures)]
27. Dendrimer (덴드리머 - 구형 가지상 고분자)
28. Polyrotaxane (폴리로탁세인 - 인터락 분자 구조)
29. Polycatenane (폴리카테네인 - 고리 연결 구조)
30. Conducting polymers (전도성 고분자: Polyacetylene, PANI, PEDOT 등)

---

### 2. 시스템 요구사항 및 구현 기능

1. **검색 및 Autocomplete 기능**:
   - 한글명(예: 폴리에틸렌), 약어(예: PET, PVC), IUPAC명, 원료명 중 어떤 것을 입력해도 해당 고분자가 자동 검색되도록 정규화 노드 작성.

2. **구조 분류 태깅**:
   - 각 고분자별 분류 자동 매핑: `열가소성(Thermoplastic)` vs `열경화성(Thermoset)`, `동종(Homopolymer)` vs `공중합체(Copolymer)`, `선형(Linear)` / `가지형(Branched)` / `네트워크(Network)` / `특수(Dendrimer/Rotaxane/Conducting)`.

3. **SMILES 및 물리 상수 데이터 세트 준비**:
   - RDKit / 3D 분자 구조 연동을 위한 대표 단량체 SMILES 스트링 매핑 파이프라인 준비.
   - 고분자별 밀도(Density), 유리전이온도(Tg), 결정화도 범위 기본값 매핑.

4. **UI 컴포넌트 구성**:
   - 입력 창 또는 드롭다운 선택 시 해당 고분자의 IUPAC명, 구조식 세부 정보, 열적/역학적 특성 요약 카드가 팝업 또는 대시보드에 표시되도록 연동 코드 작성.

위 요구사항에 맞춰 JavaScript/TypeScript 객체 형태의 고분자 DB와 검색/연동 로직을 작성해 다오.
```

---

## 🛠️ 2. 애플리케이션 연동용 JSON/JS 데이터 구조 예시

애플리케이션 코드 내에 바로 삽입할 수 있는 데이터 구조 형태입니다:

```javascript
const POLYMER_DATABASE = [
  {
    id: "pe",
    nameKo: "폴리에틸렌",
    nameEn: "Polyethylene",
    abbr: "PE",
    iupac: "Poly(methylene)",
    category: "Thermoplastic",
    structureType: "Linear / Branched",
    smiles: "[CH2][CH2]",
    density: 0.95, // g/cm³
    tg: -120 // °C
  },
  {
    id: "pet",
    nameKo: "폴리에틸렌 테레프탈레이트",
    nameEn: "Poly(ethylene terephthalate)",
    abbr: "PET",
    iupac: "Poly(oxyethyleneoxyterephthaloyl)",
    category: "Thermoplastic",
    structureType: "Linear",
    smiles: "O=C(c1ccc(C(=O)OCCO)cc1)OCCO",
    density: 1.38,
    tg: 75
  },
  {
    id: "nylon66",
    nameKo: "나일론 66",
    nameEn: "Nylon 66",
    abbr: "PA66",
    rawName: "Poly(hexamethylene adipamide)",
    iupac: "Poly[imino(hexamethylene)iminoadipoyl]",
    category: "Thermoplastic",
    structureType: "Linear",
    density: 1.14,
    tg: 50
  },
  {
    id: "hips",
    nameKo: "내충격용 폴리스티렌",
    nameEn: "High Impact Polystyrene",
    abbr: "HIPS",
    category: "Copolymer",
    structureType: "Graft Copolymer (PS backbone + Polybutadiene graft)",
    density: 1.04
  },
  {
    id: "epoxy",
    nameKo: "에폭시 수지",
    nameEn: "Epoxy Resin",
    abbr: "Epoxy",
    category: "Thermoset",
    structureType: "3D Network Crosslinked"
  },
  {
    id: "dendrimer",
    nameKo: "덴드리머",
    nameEn: "Dendrimer",
    category: "Special Architecture",
    structureType: "Hyperbranched / Spherical"
  }
];
```

---

## 💡 3. 상황별 질문 요령 (유저 프롬프트 팁)

1. **기존 웹 앱/대시보드에 고분자 선택 드롭다운을 추가하고 싶을 때:**
   > "위 고분자 리스트 30종을 드롭다운 메뉴로 만들고, 사용자가 선택하면 해당 고분자의 IUPAC 명과 기본 밀도, Tg 값이 자동으로 입력 필드에 채워지도록 연동해 줘."

2. **3D 분자 구조 시각화 기능을 추가하고 싶을 때:**
   > "선택한 고분자의 단량체 SMILES 코드를 기반으로 3D 입체 분자 구조를 RDKit / Three.js로 렌더링하는 모달 창 코드를 작성해 줘."

3. **고분자 종류에 따른 KES-FB 물성 예측을 계산하고 싶을 때:**
   > "선택된 고분자 종류(PET, Nylon 66, PE, PP 등)에 따라 기본 결정화도와 탄성률(Young's Modulus)이 결정되고, 이를 바탕으로 직물 굽힘 강성(B)과 전단 강성(G)이 자동 계산되는 수치 엔진을 업데이트해 줘."