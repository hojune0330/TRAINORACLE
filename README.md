# TRAINORACLE — SPEC And Design Handoff

## TrainOracle SPEC를 처음 보는 사람에게

TrainOracle의 핵심은 예쁜 훈련 일지 화면만이 아니라, **선수 데이터를 안전하게 읽고, 훈련을 분석하고, 근거 있는 계획을 만드는 코칭 시스템**입니다.

현재 GitHub에는 앱 구현 전에 필요한 SPEC 계약층이 정리되어 있습니다. 핵심 흐름은 `선수 데이터 -> 세션 분류 -> 선수 프로필/동의 -> D9 안전 평가 -> RVE -> Safety Gate -> Plan Generator -> 훈련 계획/분석/일지`입니다.

먼저 아래 문서를 읽으면 됩니다.

- 쉬운 전체 설명: [`SPEC_OVERVIEW_FOR_HOJUNE.md`](./SPEC_OVERVIEW_FOR_HOJUNE.md)
- 정확한 파일 목록과 상태: [`TRAINORACLE_SPEC_INDEX.md`](./TRAINORACLE_SPEC_INDEX.md)
- 현재 남은 작업: [`SPEC_WORK_STATUS.md`](./SPEC_WORK_STATUS.md)
- 다음 패치 순서: [`SPEC_TARGET_PATCH_MATRIX.md`](./SPEC_TARGET_PATCH_MATRIX.md)
- 외부 리뷰어에게 보여줄 패킷: [`SPEC_REVIEW_PACKET.md`](./SPEC_REVIEW_PACKET.md)
- target patch 준비 기준: [`SPEC_TARGET_PATCH_READINESS.md`](./SPEC_TARGET_PATCH_READINESS.md)
- Safety Gate target patch 상태: [`SPEC_WAVEB_SAFETY_GATE_PATCH_REPORT.md`](./SPEC_WAVEB_SAFETY_GATE_PATCH_REPORT.md)
- Safety Gate/RVE source acceptance 검토: [`SPEC_SOURCE_ACCEPTANCE_REVIEW_ROUND1.md`](./SPEC_SOURCE_ACCEPTANCE_REVIEW_ROUND1.md)

## 스펙별 근거와 결과물

| 스펙 | 근거로 삼는 것 | 만들어내는 결과물 |
|---|---|---|
| `RULE_SPEC_D1_D9.md` | D1-D9 안전 규칙과 D9 hard-stop 의미 | 훈련 계획을 막아야 하는 안전 판단 기준 |
| `SESSION_CLASSIFIER_SPEC.md` | 세션 기록, 운동 의도, 강도/구성 신호 | 조깅, 회복주, 인터벌, 경기 등 세션 분류 결과 |
| `ATHLETE_PROFILE_SPEC.md` | 선수별 프로필, 제한, 선호, 동의/권한 | 선수별 적용 가능 조건과 개인화 경계 |
| `APP_IMPLEMENTATION_BRIDGE.md` | 저장 정책, 동의, 권한, audit 요구사항 | 앱/웹이 저장할 데이터, API, 감사 로그 계약 |
| `PHYSIO_SOURCE_TRUST_SPEC.md` | HR, RPE, 피로도, 최신성, 충돌 여부 | 생리 데이터의 신뢰 등급과 사용 가능 범위 |
| `TEMPLATE_LIBRARY_SPEC.md` | 훈련 템플릿 소유권, lifecycle, eligibility | 사용할 수 있는 훈련 템플릿 후보와 제한 조건 |
| `RVE_RULE_EVALUATOR_BINDING_SPEC.md` | D9 evaluator 결과와 reason code | RVE, Safety Gate, Plan Generator가 읽는 표준 안전 신호 |
| `PLAN_SAFETY_GATE_SPEC.md` | RVE 신호, D9 상태, safety routing 규칙 | 계획 생성 전 차단/검토/통과 결정 |
| `PLAN_GENERATOR_SPEC.md` | Safety Gate 결과, 선수 프로필, 세션/템플릿/physio 신호 | 근거와 제한을 가진 훈련 계획 후보 |
| `DAILY_LOG_AND_CHECKIN_SPEC.md` | 매일 들어오는 훈련 일지, 컨디션, 구조화된 체크인 | 저장 가능한 일지 데이터와 RVE/Safety Gate/분석 입력 |
| `DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC.md` | Daily Log, 세션, 안전/physio/profile 구조 신호 | 매일 요약, 코치 알림, AI Inbox 항목 |
| `ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md` | 구조화된 일지/세션/분류/안전/physio/계획 신호 | Dashboard, Analysis, Session Detail, Calendar가 읽는 근거 기반 시각화 데이터 |
| `PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md` | Plan Generator 결과, source refs, privacy tier, redaction state | 훈련 계획 설명이 민감정보를 누출하지 않게 하는 rationale 계약 |
| `MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md` | 9.5-day cycle, `CYCLE_DAY`, plannedDate/sessionSlot, Calendar | 사이클/달력 라벨을 규칙 ID와 섞지 않는 날짜 매핑 계약 |

이 표의 핵심은 “데이터가 들어오면 바로 AI가 답을 만드는 구조”가 아니라는 점입니다. TrainOracle은 먼저 근거를 분류하고, 저장해도 되는 정보만 남기고, 안전 게이트를 통과한 뒤에 계획과 분석 결과를 만들도록 설계되어 있습니다.

중요한 약속: 아직 완성 앱, 정본 승인, production 배포, D9 runtime evidence 단계는 아닙니다. 대신 무엇이 준비됐고 무엇은 아직 닫으면 안 되는지 분리해서 기록해 둔 상태입니다.

> Wave B Safety Gate target patch status: [`SPEC_WAVEB_SAFETY_GATE_PATCH_REPORT.md`](./SPEC_WAVEB_SAFETY_GATE_PATCH_REPORT.md). Wave 1 physio target patch status: [`SPEC_WAVE1_PHYSIO_PATCH_REPORT.md`](./SPEC_WAVE1_PHYSIO_PATCH_REPORT.md). Next patch order: [`SPEC_TARGET_PATCH_MATRIX.md`](./SPEC_TARGET_PATCH_MATRIX.md). Review packet: [`SPEC_REVIEW_PACKET.md`](./SPEC_REVIEW_PACKET.md). Target patch readiness: [`SPEC_TARGET_PATCH_READINESS.md`](./SPEC_TARGET_PATCH_READINESS.md). File-truth guardrails: [`SPEC_FILE_TRUTH_GUARD.md`](./SPEC_FILE_TRUTH_GUARD.md).

> **이 폴더는 다른 AI 개발 에이전트에게 그대로 전달하기 위한 패키지입니다.**
> SPEC / 안전 계약 작업을 이어받는 시작점은 [`TRAINORACLE_SPEC_INDEX.md`](./TRAINORACLE_SPEC_INDEX.md)입니다. 그 다음 현재 상태는 [`SPEC_WORK_STATUS.md`](./SPEC_WORK_STATUS.md), 전체 문서 지도는 [`SPEC_DOCUMENTATION_REPORT.md`](./SPEC_DOCUMENTATION_REPORT.md)에서 확인하세요.
> 디자인 / UI 구현 작업을 이어받을 때는 [`HANDOFF.md`](./HANDOFF.md)를 읽고, 그 다음 [`PHILOSOPHY.md`](./PHILOSOPHY.md)를 읽으세요.
> 이 저장소의 SPEC 계층은 아직 draft handoff 상태입니다. GitHub 업로드는 canonical promotion, runtime evidence, issue closure가 아닙니다.

---

## 제품 개요

**TRAINORACLE**은 중장거리(1500m / 5000m / 10000m) 선수를 위한 **AI 코치 시스템**입니다.

> **"너의 데이터를 모두 줘봐. AI 코치 장호준이 분석해서 해결해줄게."**

사용자 ↔ AI 코치 장호준의 **1:1 관계**가 중심. 사용자의 훈련 데이터·기록·목표·컨디션을 가져와서, 그 사람만의 맥락을 이해하고 지속적인 코칭을 제공합니다.

코치 장호준의 30년 경험에서 추출한 **9.5일 사이클 방법론** + **9 Rules**가 시스템의 심장. 모든 추천은 verdict + confidence + citation을 동반합니다.

**현재 단계**: AI는 하드코딩된 코칭 지식 + 결정 함수 + 고정 피드백 템플릿 기반 (rule engine). LLM 자유 호출은 추후 단계.

---

## 패키지 구조

```
TRAINORACLE/                          ← 저장소 루트
├── README.md                         ← 시작점 (이 파일)
├── TRAINORACLE_SPEC_INDEX.md         ← SPEC 계층 시작점 / inventory registry
├── SPEC_WORK_STATUS.md               ← 현재 SPEC 작업 상태 / 다음 제작 순서
├── SPEC_DOCUMENTATION_REPORT.md      ← 현재/재구성/예정 문서 전체 리포트
├── SPEC_REVIEW_PACKET.md             ← 외부 리뷰어용 read order / lens / 질문 패킷
├── SPEC_TARGET_PATCH_READINESS.md     ← 다음 target patch readiness / evidence gate
├── SPEC_WAVEB_SAFETY_GATE_PATCH_REPORT.md ← Plan Generator Safety Gate target patch 결과
├── HANDOFF.md                        ← 개발 에이전트용 첫 프롬프트
├── PHILOSOPHY.md                     ← 제품 철학·UX 원칙 (정본)
├── DESIGN_DECISIONS.md               ← 결정사항 정제본
├── CONVERSATION_LOG.md               ← 디자인 의사결정 흐름
├── BRIEF_ORIGINAL.md                 ← 원본 디자인 브리프
├── PUSH_TO_GITHUB.md                 ← (선택) GitHub 업로드 가이드
│
├── design-system/
│   ├── DESIGN_TOKENS.md              ← 색·타입·spacing (4-tier energy colors)
│   ├── COMPONENT_INVENTORY.md        ← 컴포넌트 목록
│   ├── SCREENS.md                    ← 화면 상태·우선순위
│   ├── SYSTEM_FOUNDATIONS.md         ← Identity/Visual/Trust/Feedback 4 시스템
│   ├── SAFEGUARDS.md                 ← 7 가드레일 (cold start, mode 등)
│   ├── FEATURE_TIERS.md              ← 무료/Pro 분리 준비
│   └── VISUALIZATION_SYSTEM.md       ← 시각화 정본 (작성 예정)
│
├── specs/                            ← SPEC 계층 문서
│   ├── active/                       ← 현재 active SPEC 후보
│   ├── test-packages/                ← 테스트 후보 패키지
│   ├── legacy-reference/             ← legacy/reference 문서
│   └── reconstruct/                  ← missing/reconstructed 계약 영역
│
└── designs/
    ├── README.md                     ← 디자인 미리보기 가이드
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
    ├── 12_Settings.html
    ├── SPRINT1_MinjisDay.html        [시연용]
    ├── SPRINT2_DataImport.html       [3년치 import 경험]
    ├── SPRINT2_Records.html          [PB/SB/Target/Reference]
    ├── SPRINT2_VisualizationSystem.html  [작성 예정]
    └── _archive/
        └── SessionDetail_v1_deprecated.html
```

---

## 디자인 방향 (한 줄 요약)

**"Scientific Minimalism — Tufte × Linear"**

- 박스·둥근 모서리 최소화
- 색은 **정보 전달용**으로만 (장식 색 0)
- 타이포그래피·여백·hairline으로 정보 위계 표현
- Inter (UI) + JetBrains Mono (수치) 두 폰트만
- 박스 모양은 직각, radius 0
- 에너지 시스템 컬러는 **컨텍스트별 4-tier 강도** 적용
  - T1 Strong: Calendar 셀, Session card 컬러바, hero
  - T2 Mid: 분석 차트
  - T3 Subtle: 본문 안 점 + 코드 + underline
  - T4 Wash: 선택 상태, 컨텍스트 배경 (5%)
- 색·코드·위치/모양 **3중 인코딩** 의무 (color-blind 대응)

자세한 토큰: [`design-system/DESIGN_TOKENS.md`](./design-system/DESIGN_TOKENS.md)
시각화 사용 규칙: [`design-system/VISUALIZATION_SYSTEM.md`](./design-system/VISUALIZATION_SYSTEM.md)

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

1. **[TRAINORACLE_SPEC_INDEX.md](./TRAINORACLE_SPEC_INDEX.md) 읽기** — SPEC 계층과 안전 계약 inventory
2. **[SPEC_WORK_STATUS.md](./SPEC_WORK_STATUS.md) 읽기** — 미완성 SPEC 상태, missing contract, 다음 제작 순서
3. **[SPEC_REVIEW_PACKET.md](./SPEC_REVIEW_PACKET.md) 읽기** — 외부 리뷰어에게 보여줄 범위와 질문
4. **[SPEC_TARGET_PATCH_READINESS.md](./SPEC_TARGET_PATCH_READINESS.md) 읽기** — target patch readiness와 evidence gate
5. **[HANDOFF.md](./HANDOFF.md) 읽기** — 디자인/개발 첫 프롬프트
6. **[PHILOSOPHY.md](./PHILOSOPHY.md) 읽기** — 제품 가치관
7. **[DESIGN_TOKENS.md](./design-system/DESIGN_TOKENS.md)** — Tailwind config 작성
8. **[SCREENS.md](./design-system/SCREENS.md)** — 우선순위 결정
9. 디자인 파일 직접 열어 확인 → SPEC 안전 계약과 충돌하지 않게 컴포넌트 단위로 분해 → 구현 시작

---

문의: 코치 장호준 (제품 오너 · 최종 승인자)
