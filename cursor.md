# 🚀 Cursor IDE 프롬프트: 미세 섬유 기반 직물 물성 예측 AI 및 3D 시각화 웹 앱 구축

다음 프롬프트를 **Cursor IDE의 Agent / Composer 창 (Ctrl+I 또는 Cmd+I)**에 그대로 복사하여 실행하세요.

---

### [MASTER PROMPT - Copy & Paste below]

```text
너는 섬유 공학(Textile Engineering), 재료정보학(Materials Informatics), 그리고 WebGL/Three.js 3D 프론트엔드 전문 수석 소프트웨어 엔지니어이자 AI 연구원이다.

내가 만들고자 하는 시스템은 **미세 섬유 변수(섬도, 결정화도, 섬유 길이, 권축수, 단면 형상)를 조절함에 따라 최종 직물(Fabric)이 어떤 거시적 물성(KES-FB 지표)을 갖게 되는지 예측하고, 이를 3D 물리 시뮬레이션 및 질감으로 시각화하는 풀스택 웹 애플리케이션**이다.

아래 요구사항과 시스템 아키텍처를 바탕으로 전체 프로젝트 구조를 설계하고 완벽하게 작동하는 코드를 작성해 줘.

---

### 1. 핵심 시스템 목표
- **Input (사용자 컨트롤러)**:
  1. 섬도 (Fineness / Denier): 0.5D ~ 10.0D
  2. 결정화도 (Crystallinity): 20% ~ 90%
  3. 섬유 길이 (Fiber Length): 10mm ~ 150mm
  4. 권축수 (Crimp per Inch): 0 ~ 30 CPI
  5. 단면 형상 (Cross-sectional Shape): 원형(Circular), 삼엽형(Trilobal), 중공형(Hollow)
- **AI/수치 예측 대리 모델 (Surrogate Model Engine)**:
  - 입력된 미세 파라미터로부터 KES-FB 표준 역학 물성치를 실시간 추정 (< 10ms 지연시간):
    - $B$ (굽힘 강성, Bending Stiffness, gf·cm²/cm)
    - $G$ (전단 강성, Shear Stiffness, gf/(cm·deg))
    - $EMT$ (인장 신장률, Tensile Tensility, %)
    - $W$ (면밀도/중량, Areal Density, mg/cm²)
    - $2H_0$ (직물 두께, Thickness, mm)
    - $DC$ (드레이프 계수, Drape Coefficient, %)
- **Output (3D 인터랙티브 시각화)**:
  - 예측된 KES 물성을 **3D 스프링-질량 물리 엔진(Particle-Spring / Position Based Dynamics)**의 구속 조건 계수로 역매핑.
  - Three.js 기반의 가상 드레이프 시험대 위에 천(Cloth)이 실시간으로 처지고 주름지는 3D 시뮬레이션 렌더링.
  - 단면 형상에 따른 이방성 반사(Anisotropic PBR) 질감 및 광택 표현.

---

### 2. 기술 스택 및 아키텍처
- **Frontend**: React (Vite) 또는 Next.js (App Router), Tailwind CSS, Lucide React (아이콘)
- **3D Graphics & Physics**: Three.js, `@react-three/fiber`, `@react-three/drei`, OrbitControls
- **Charts & Data**: Chart.js (`react-chartjs-2`) 또는 Recharts (KES 레이더 차트)
- **AI Inference Engine**:
  - Browser-side: Pure JS/TS 수치 대리 모델 함수 및 ONNX Runtime Web (`onnxruntime-web`) 연동 레이어 준비

---

### 3. 미세 파라미터 ➔ KES 역학 변환 수치 모델 매핑 규칙 (Surrogate Math)
AI 대리 모델 추론 로직에 아래 도메인 물리 근사식을 반영해 줘:
1. **굽힘 강성 ($B$)**:
   $$B \propto d^{1.8} \times (1 + \text{cryst} \times 1.5) \times \text{ShapeMod}$$
   (삼엽형: 1.25, 중공형: 0.85, 원형: 1.0)
2. **전단 강성 ($G$)**:
   $$G \propto (d \times 0.15) + (\text{crimp} \times 0.08) + (\text{length} \times 0.005) + (\text{cryst} \times 0.5)$$
3. **인장 신장률 ($EMT$)**:
   $$EMT = \frac{15.0}{1 + \text{cryst} \times 2.0} + (\text{crimp} \times 0.3) - (d \times 0.2)$$ (최소값 2.0)
4. **면밀도 ($W$)**:
   $$W = 10.0 + (d \times 1.5) + (\text{crimp} \times 0.2)$$
5. **드레이프 계수 ($DC$)**:
   $$DC = 20.0 + \left(\frac{B}{W} \times 350.0\right) + \left(\frac{G}{W} \times 150.0\right)$$ (범위 15% ~ 95%)

---

### 4. KES 물성 ➔ Three.js 3D 물리 시뮬레이션 매핑 규칙
- **Bending Stiffness ($B$)**: 3D 천 메시(PlaneGeometry) 각 정점(Vertex)의 dropY 변형률 및 건너뛰기 스프링(Bending Spring) 강성에 반영. $B$가 클수록 천이 뼛뼛하게 피어있고, 작을수록 아래로 가파르게 처짐.
- **Shear Stiffness ($G$)**: 드레이프 주름의 파동 개수(Fluting Waves)에 영향.
- **Shape (단면)**:
  - `trilobal`: Metalness 0.3, Roughness 0.15, Sky Blue 톤의 고광택 이방성 질감
  - `hollow`: Roughness 0.6, Light Blue, 경량화된 처짐
  - `circular`: Standard Satin/Cotton PBR

---

### 5. 개발 단계 및 구현 순서
**Step 1: 기본 프로젝트 세팅 & UI 레이아웃**
- 좌측: 5개 미세 파라미터 컨트롤 슬라이더 패널
- 우측 상단: Three.js 3D 드레이프 시뮬레이터 캔버스 (마우스 조작 지원)
- 우측 하단: KES 물성 레이더 차트 (Chart.js) 및 정량 수치 카드가 포함된 레이아웃 구축

**Step 2: AI 대리 모델 추론 연동**
- 슬라이더 조작 시 `onInput` 이벤트로 계산 함수 호출, < 5ms 이내에 차트와 3D 파라미터 상태(State) 업데이트.

**Step 3: Three.js 드레이프 메쉬 렌더링 완성**
- 원기둥 받침대(Pedestal) 위에 얹혀진 3D 천 메쉬 생성.
- 정점 위치 계산식을 통해 $B$와 $DC$ 값 변화에 따라 주름의 폭, 깊이, 각도가 자연스럽게 실시간 변형되도록 정점 노멀 계산 연동.

---

위 사양에 맞추어 프로젝트 생성 명령부터 필요한 컴포넌트 코드까지 순서대로 실행해 줘.
```

---

### 💡 Cursor 사용 시 꿀팁

1. **Composer 모드 활성화**: `Ctrl + I` (Mac: `Cmd + I`)를 눌러 Composer 창을 연 뒤 위 프롬프트를 전체 붙여넣기 하세요.
2. **단계별 생성 연계**: 프로젝트 생성이 완료되면, 다음 질문으로 추가 기능을 구현시키세요:
   - *"이제 RDKit 화학 구조식(SMILES)을 입력받아 고분자 단량체 3D 구조를 렌더링하는 모달 팝업 컴포넌트도 추가해 줘."*
   - *"진짜 ONNX 모델 파일을 브라우저에서 로드할 수 있도록 `@onnxruntime/web` 로더 파일 아키텍처를 작성해 줘."*
```

eof