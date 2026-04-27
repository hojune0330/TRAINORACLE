# TRAINORACLE — Design Handoff

> **이 폴더는 다른 AI 개발 에이전트에게 그대로 전달하기 위한 패키지입니다.**
> 시작점은 [`HANDOFF.md`](./HANDOFF.md)입니다. 그 다음 [`PHILOSOPHY.md`](./PHILOSOPHY.md)를 읽으세요.

---

## 제품 개요

**TRAINORACLE**은 1500m–10000m 엘리트 육상 선수를 위한 AI 코칭 플랫폼입니다.

> Strava가 **기록**하고, TrainingPeaks가 **분석**한다면, TRAINORACLE은 **생각**합니다.

코치 장호준의 30년 경험에서 추출한 **9.5일 사이클 방법론**을 학습한 AI가, 매 훈련 결정 뒤에 **왜 그래야 하는지**를 근거와 함께 답합니다.

---

## 패키지 구조

```
trainoracle-handoff/
├── README.md                         ← 시작점 (이 파일)
├── HANDOFF.md                        ← ★ 개발 에이전트용 첫 프롬프트
├── BRIEF_ORIGINAL.md                 ← 원본 디자인 브리프
├── CONVERSATION_LOG.md               ← 디자인 의사결정 흐름
├── DESIGN_DECISIONS.md               ← 결정사항 정제본
├── PHILOSOPHY.md                     ← 제품 철학·UX 원칙
│
├── design-system/
│   ├── DESIGN_TOKENS.md              ← 색·타입·spacing 토큰
│   ├── COMPONENT_INVENTORY.md        ← 만든 컴포넌트 목록
│   └── SCREENS.md                    ← 화면별 상태·다음 작업
│
└── designs/
    ├── 00_Moodboard.html
    ├── 01_Landing.html
    ├── 02_Onboarding.html
    ├── 03_Dashboard.html              [v1 - Opus-style, 재작업 필요]
    ├── 04_Calendar.html               [v1 - Opus-style, 재작업 필요]
    ├── 05_SessionDetail.html          [v2 - Tufte × Linear, 정본]
    ├── 06_AIChat.html
    ├── 07_AIInbox.html
    ├── 08_Analysis.html
    ├── 09_DailyCheckin.html
    ├── 10_Competitions.html
    ├── 11_Philosophy.html
    └── 12_Settings.html
```

---

## 디자인 방향 (한 줄 요약)

**"Scientific Minimalism — Tufte × Linear"**

- 박스·둥근 모서리 최소화
- 색은 **정보 전달용**으로만 (장식 색 0)
- 타이포그래피·여백·hairline으로 정보 위계 표현
- Inter (UI) + JetBrains Mono (수치) 두 폰트만
- 박스 모양은 직각, radius 0
- 에너지 시스템 컬러: **점(●) + 2자 코드 + 하단 underline**

자세한 토큰: [`design-system/DESIGN_TOKENS.md`](./design-system/DESIGN_TOKENS.md)

---

## 권장 기술 스택 (변경 가능)

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS + CSS variables for tokens
- **UI primitives**: Radix UI (headless) — shadcn/ui 등 스타일 강한 라이브러리 **비추천**
- **State**: 가벼운 거 추천 (Zustand / React Query)
- **Charts**: Visx 또는 Recharts — 단, 디자인은 Tufte 스타일 유지 (격자 hairline, 색 단순화)
- **Backend**: Supabase 또는 Hono + Postgres
- **AI**:
  - 룰 엔진 (9 Rules 검증): TypeScript 결정 함수
  - LLM (장호준 AI 채팅): Claude API + RAG (코치 노트 + 본인 세션 데이터)

자세한 추천: [`HANDOFF.md`](./HANDOFF.md) 참조

---

## 빠른 미리보기

각 `designs/*.html` 파일을 브라우저로 열면 모바일·데스크톱 탭이 있습니다. 모든 파일은 **독립형(standalone)** — 폰트와 CSS가 인라인되어 있어 인터넷 연결만 있으면 어디서든 미리보기 가능.

---

## 다음 단계 (개발 에이전트용)

1. **[HANDOFF.md](./HANDOFF.md) 읽기** — 첫 프롬프트
2. **[PHILOSOPHY.md](./PHILOSOPHY.md) 읽기** — 제품 가치관
3. **[DESIGN_TOKENS.md](./design-system/DESIGN_TOKENS.md)** — Tailwind config 작성
4. **[SCREENS.md](./design-system/SCREENS.md)** — 우선순위 결정
5. 디자인 파일 직접 열어 확인 → 컴포넌트 단위로 분해 → 구현 시작

---

문의: 코치 장호준 (제품 오너 · 최종 승인자)
