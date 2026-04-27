# 🤝 HANDOFF — 개발 에이전트용 첫 프롬프트

> **다른 AI 개발 에이전트에게 이 폴더를 통째로 전달할 때, 이 문서를 첫 메시지로 보내세요.**

---

## 당신에게 전달된 것

당신은 TRAINORACLE이라는 제품의 **디자인 산출물 13개 + 제품 문서 9개**를 받았습니다. 이제 이걸 **실제 작동하는 웹 애플리케이션**으로 구현해야 합니다.

---

## 먼저 할 일 (반드시 순서대로)

1. **[`README.md`](./README.md)** — 패키지 전체 구조 파악 (3분)
2. **[`PHILOSOPHY.md`](./PHILOSOPHY.md)** — 제품의 가치관, 절대 어겨선 안 되는 원칙 (5분)
3. **[`DESIGN_DECISIONS.md`](./DESIGN_DECISIONS.md)** — 왜 이렇게 디자인됐는지 (10분)
4. **[`design-system/DESIGN_TOKENS.md`](./design-system/DESIGN_TOKENS.md)** — 색·타이포·spacing 토큰
5. **[`design-system/COMPONENT_INVENTORY.md`](./design-system/COMPONENT_INVENTORY.md)** — 컴포넌트 카탈로그
6. **[`design-system/SCREENS.md`](./design-system/SCREENS.md)** — 화면별 상태와 다음 작업
7. 그 다음 `designs/*.html` 파일들을 열어 직접 확인

---

## 절대 해선 안 되는 것 ❌

PHILOSOPHY.md에 자세히 있지만, 핵심 7가지:

1. **컬러 그라데이션, 네온, glow 효과 사용 금지**
2. **둥근 모서리 남발 금지** — `border-radius` 기본 0, 인터랙티브 요소만 4px 이하
3. **카드/박스로 모든 정보 감싸기 금지** — hairline과 여백으로 분리
4. **Instrument Serif 등 serif 폰트 금지** — UI는 Inter / Pretendard / JetBrains Mono만
5. **에너지 시스템 컬러를 배경으로 사용 금지** — 점(●) + 코드(V2) + underline 패턴 유지
6. **소셜 피드, 좋아요, 게이미피케이션 추가 금지** — 브리프 위반
7. **AI에게 100% 확신 표현 금지** — 모든 AI 응답에 신뢰도(%) 명시 필수

---

## 권장 기술 스택

```yaml
Framework:    Next.js 14 (App Router)
Language:     TypeScript (strict)
Styling:      Tailwind CSS + CSS variables (tokens)
UI primitives: Radix UI (headless) — 스타일은 직접 작성
State:        Zustand (client) + React Query (server)
Database:     Supabase (Postgres + Auth + Realtime)
Charts:       Visx (low-level, Tufte 스타일에 적합)
                또는 Recharts (편하지만 커스터마이징 필요)
Forms:        React Hook Form + Zod
i18n:         next-intl (한/영)

AI Stack:
  - 룰 엔진:    TypeScript decision functions (9 Rules 검증)
  - LLM:        Anthropic Claude (Sonnet 4.5)
  - RAG:        pgvector (Supabase) — Coach Jang 노트 + 본인 세션
  - Streaming:  Vercel AI SDK
  - Citation:   Custom — sup태그 [1] [2] 자동 삽입
```

다른 스택을 선호한다면 사용자에게 확인 후 변경하세요.

---

## 추천 작업 순서

### Phase 1 — Foundation (1주)
- [ ] Next.js + Tailwind 셋업
- [ ] DESIGN_TOKENS.md 기반 `tailwind.config.ts` 작성
- [ ] CSS variables 설정 (light mode 우선, dark mode 추후)
- [ ] 폰트 로드 (Inter, Pretendard, JetBrains Mono)
- [ ] 기본 컴포넌트 5개 만들기 (Button, Tag, Etag, DataTable, ValidationItem)
- [ ] Auth 설정 (Supabase)

### Phase 2 — Core screens (2주)
- [ ] **Onboarding** (3-step) — 신규 가입 흐름
- [ ] **Dashboard** — 진입점 (단, v2 Tufte 스타일로 재작업 필요)
- [ ] **Session Detail** — 가장 많이 보는 화면
- [ ] **Daily Check-in** — 5분 안에 끝나는 폼

### Phase 3 — AI features (2주)
- [ ] **장호준 AI Chat** — Claude API + RAG
- [ ] **AI Inbox** — 알림 큐
- [ ] 9 Rules validation 엔진

### Phase 4 — Coach features (1주)
- [ ] **Calendar** — 3-view (단, v2 재작업 필요)
- [ ] **Analysis Dashboard** — 차트
- [ ] **Competitions** — 대회 관리

### Phase 5 — Public + Polish (1주)
- [ ] **Landing Page**
- [ ] **Philosophy Page**
- [ ] **Settings**
- [ ] Dark mode
- [ ] 성능·접근성

**총 예상 기간: 6-8주** (1인 풀타임 기준)

---

## v1 / v2 구분

**v2 정본 (Tufte × Linear 스타일):**
- ✅ Session Detail
- ✅ AI Chat
- ✅ Analysis
- ✅ AI Inbox
- ✅ Daily Check-in
- ✅ Competitions
- ✅ Onboarding
- ✅ Settings
- ✅ Philosophy
- ✅ Landing

**v1 (Opus-style, 재작업 필요):**
- ⚠️ Dashboard
- ⚠️ Calendar

→ Dashboard와 Calendar는 v1 디자인을 참고해서 **정보 구조만 가져오고**, 시각 스타일은 다른 v2 화면(특히 Session Detail, Analysis)을 참고해 재작업하세요.

---

## 데이터 모델 힌트 (확정 아님)

```typescript
// 핵심 엔티티 (개략)
type User = { id, email, name, role: 'athlete' | 'coach' | 'both' }
type Athlete = { id, userId, dob, gender, eventPrimary, eventSecondary, mhr, lthr }
type PB = { athleteId, event, time, recordedAt }

type Cycle = { id, athleteId, number, startDate, endDate, focusEnergySystem }
type Session = {
  id, cycleId, dayInCycle, // D-1 ~ D-9
  type: 'main' | 'aux' | 'recovery' | 'rest',
  energySystem: 'BASE' | 'LT' | 'VO2' | 'GLY' | 'ATP' | 'REST',
  scheduledAt, completedAt,
  protocol: { phases: Phase[], totalKm, expectedTSS },
  result?: { actualPace, hrAvg, hrMax, drift, rpe, ckPredicted }
}

type CheckIn = { athleteId, date, rpe, sleepHours, sleepQuality, condition, painAreas, note }

type InboxItem = {
  id, athleteId, type: 'unc' | 'risk' | 'pattern' | 'rule' | 'pass',
  title, description, confidence, sources: Source[],
  createdAt, readAt?, decisionAt?
}

type ChatMessage = {
  id, threadId, role: 'user' | 'ai',
  content, // markdown with [1] [2] citations
  verdict?: 'confirm' | 'recommend' | 'unc' | 'lack',
  confidence?: number,
  sources?: Source[],
  createdAt
}

type ValidationResult = {
  cycleId, ruleId: 'R-1' | ... | 'R-9',
  status: 'pass' | 'warn' | 'info',
  detail: string
}
```

---

## 외부 통합 (우선순위)

1. **Garmin Connect** (필수) — OAuth + Activity API
2. **Strava** (선택) — OAuth + Activities
3. **Apple Health** (모바일 앱 단계에서)
4. **Polar / COROS** (추후)

---

## 핵심 차별화 — 구현 시 절대 빠뜨리면 안 되는 것

1. **Citation system** — AI 응답의 모든 주장에 클릭 가능한 `[1]` 인용 (Session Detail, AI Chat 화면 참조)
2. **Confidence display** — 모든 AI 응답에 % 표기, 70% 미만은 자동 인박스 이관
3. **9 Rules validation** — 매 사이클 자동 검증, 결과 표시 (PHILOSOPHY.md §4 참조)
4. **9.5-day cycle** — Calendar의 **9.5-Cycle 뷰**가 핵심 차별화. 일반 Week 뷰만 있으면 가치 없음.
5. **Why-first answer** — 모든 추천에 근거 명시. "오늘 6×1000m" 단독으로 보여주면 안 됨.

---

## 마무리 체크리스트

전달자(코치 장호준)에게 다시 컨펌받을 사항:

- [ ] 기술 스택 OK?
- [ ] AI 통합 방식 (Claude / OpenAI / 자체) 결정?
- [ ] Garmin OAuth 키 발급 가능?
- [ ] 호스팅 환경 (Vercel / 자체 서버)?
- [ ] 도메인?
- [ ] 결제 모델 (월 구독? 무료?)
- [ ] 베타 테스터 풀 (코치/선수 8명) 확보됨?

이 7가지 답이 나오기 전엔 **Phase 1만 진행**하고 멈추세요.

---

**시작하세요.** 막히면 PHILOSOPHY.md를 다시 읽으세요.
