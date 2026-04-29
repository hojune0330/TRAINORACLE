# SCREENS — 화면 인벤토리 & 다음 작업

> 화면 현재 상태 + 개발 시 우선순위. 각 화면별 핵심 기능과 주의점.
>
> **사용자 정의 (정본)**: 사용자 ↔ AI 1:1. Coach view (8명 동시 보기), Cohort 비교 등 B2B
> 시나리오는 **P3 후순위**로 미룸 (PHILOSOPHY §2 참조).

---

## 화면 상태 요약

### Core 화면 (개인 사용자 1:1 흐름)

| # | 화면 | 파일 | 상태 | 우선순위 |
|---|---|---|---|---|
| 00 | Moodboard | `00_Moodboard.html` | ✅ 참고용 (참고만) | — |
| 01 | Landing | `01_Landing.html` | ✅ v1 (Tufte) | P3 |
| 02 | Onboarding | `02_Onboarding.html` | ✅ v1 (Tufte) | **P1** |
| 03 | Dashboard | `03_Dashboard.html` | ⚠️ v1 (Opus, 재작업 필요) | **P1** |
| 04 | Calendar | `04_Calendar.html` | ⚠️ v1 (Opus, 재작업 필요) | P2 |
| 05 | Session Detail | `05_SessionDetail.html` | ✅ v2 정본 (Tufte) | **P1** |
| 06 | AI Chat | `06_AIChat.html` | ✅ v1 (Tufte) | **P1** |
| 07 | AI Inbox | `07_AIInbox.html` | ✅ v1 (Tufte) | **P2** |
| 08 | Analysis | `08_Analysis.html` | ✅ v1 (Tufte) | P2 |
| 09 | Daily Check-in | `09_DailyCheckin.html` | ✅ v1 (Tufte) | **P1** |
| 10 | Competitions | `10_Competitions.html` | ✅ v1 (Tufte) | P2 |
| 11 | Philosophy | `11_Philosophy.html` | ✅ v1 (Tufte) | P3 |
| 12 | Settings | `12_Settings.html` | ✅ v1 (Tufte) | P3 |

### Sprint 산출물 (이미 작업됨)

| # | 화면 | 파일 | 상태 | 우선순위 |
|---|---|---|---|---|
| S1 | Minji's Day (시연) | `SPRINT1_MinjisDay.html` | ✅ 시연용 | — |
| S2a | Data Import | `SPRINT2_DataImport.html` | ✅ Onboarding 이후 흐름 | **P1** |
| S2b | Records (PB/SB/Target/Reference) | `SPRINT2_Records.html` | ✅ 4-record 입력·표시 | **P1** |
| S2c | Visualization System | `SPRINT2_VisualizationSystem.html` | 🚧 진행 중 | **P1** |

### 미디자인 — 다음 작업 후보

| 화면 | 우선순위 | 비고 |
|---|---|---|
| **Personal Archive** ("내 이야기") | **P1** | PHILOSOPHY §5.6, SYSTEM_FOUNDATIONS §1.5에서 정의됨, 화면 미디자인 |
| Session Timer (실행 중) | P2 | Big timer + lap + HR |
| Knowledge base (Coach Jang notes) | P3 | RAG 도입 후 |
| Reports (PDF export) | P3 | 사이클/월간 리뷰 export |
| 404 / Error | P3 | — |

### B2B / 추후 (P3+)

| 화면 | 비고 |
|---|---|
| ~~Athlete list (코치 view 8명)~~ | B2B 단계로 미룸 |
| ~~Coach dashboard~~ | B2B 단계로 미룸 |
| ~~Cohort comparison~~ | privacy 검토 후, P3+ |

**P1 (Phase 2 — 2주차)**: 핵심 사용 흐름. 신규 가입 → 매일 사용 → 기록 추적.
**P2 (Phase 3-4 — 3-4주차)**: 차별화 기능 (Calendar 9.5-Cycle, Analysis, Inbox).
**P3 (Phase 5+)**: 퍼블릭, 폴리시, B2B/cohort.

---

## 1. Landing (`01_Landing.html`) — P3

### 목적
- 비로그인 사용자에게 제품 소개, **차별화 명확히**

### 주요 섹션
1. Hero — "Strava records, TP analyzes, TRAINORACLE thinks"
2. 비교 테이블 (vs Strava / TrainingPeaks)
3. Three pillars (Why-first / Honest uncertainty / 9.5-day cycle)
4. Feature 3개 (Calendar / AI Chat / AI Inbox) — placeholder 자리에 실제 스크린샷 삽입 예정
5. Testimonials (코치/선수 음성)
6. Final CTA

### 개발 시 주의
- **placeholder 영역에 실제 화면 스크린샷 삽입** (PNG 저용량 또는 인터랙티브 mock)
- SEO meta 태그 추가
- Open Graph 이미지 1200×630
- 다국어 지원 (한/영) — 메인은 한국어, `/en` 라우트 영어
- Google Analytics 또는 Plausible

### 외부 의존성
- 없음 (정적)

---

## 2. Onboarding (`02_Onboarding.html`) — **P1**

### 목적
- 3-step + welcome → 14일 trial 시작

### Steps
| Step | 입력 | 검증 |
|---|---|---|
| 1 | Role 선택 (Athlete / Coach / Both) | 필수 |
| 2 | 이름 / 생년 / 성별 / 키-체중 / 종목 / PB 4개 | 이름·생년·종목 필수, PB 선택 |
| 3 | 데이터 동기화 (Garmin / Strava / Polar / COROS / 기타) | 선택 (skip 가능) |
| Welcome | summary + AI 학습 시작 | 자동 |

### 개발 시 주의
- 진행 상태 localStorage에 저장 (브라우저 닫혀도 복귀 가능)
- 3단계 모두 끝나야 Dashboard 접근 가능 (또는 skip 후 추후 입력 유도)
- Garmin OAuth는 redirect flow — 콜백 처리 필요
- 프로필 데이터 → `Athlete` 테이블 insert
- PB → `PB` 테이블 (각 event 한 행)
- 데이터 동기화 → `Provider` 테이블 + 백그라운드 fetch job 큐

### 외부 의존성
- Garmin Connect OAuth (필수)
- Strava OAuth (선택)

---

## 3. Dashboard (`03_Dashboard.html`) — **P1** ⚠️ 재작업

### 목적
- 매일 첫 진입점. "오늘 뭐 해야 하는가" 한 화면에 답.

### v2 재작업 필요 — 가이드라인
v1은 Opus-style이라 시각 톤이 다른 v2 화면들과 일관성 없음. 다음 v2 화면들을 참고해서 재구성:
- **레이아웃 구조**: `05_SessionDetail.html` (모바일 세로 스크롤 / 데스크톱 2-3열)
- **컴포넌트 패턴**: `08_Analysis.html` (KPI grid 4분할), `09_DailyCheckin.html` (Today section)
- **Kill list**: 둥근 카드, 좌측 컬러 스트립, 파스텔 배경 박스, Serif

### 정보 블록 (v1에서 가져올 정보 구조)
1. 헤더 (인사 + 날짜 + Cycle/Day)
2. **Today** (AM/PM 세션, MAIN 강조)
3. 9.5 Cycle Progress (10-slot rail mini)
4. Validation Summary (최근 3개)
5. AI Inbox (3 미확인 미리보기)
6. Week mini summary
7. Bottom tab bar (mobile)

### Desktop 3-column
- Left: Sidebar (220px)
- Main: Today + Cycle + Validation (1fr)
- Right: AI 인박스 + Quick actions ⌘K (320-380px)

### 개발 시 주의
- 데이터 로딩: 첫 페인트는 skeleton, 핵심 데이터는 SSR
- Sticky Today 카드 (스크롤 시 상단 고정)
- 빈 상태 처리: 사이클 없을 때, 데이터 없을 때

---

## 4. Calendar (`04_Calendar.html`) — P2 ⚠️ 재작업

### 목적
- 3가지 view 전환 — 9.5-Cycle이 핵심 차별화

### v2 재작업 필요 — 가이드라인
v1과 동일한 정보 구조 유지하되, 시각 톤 v2 통일:
- 세션 카드: 좌측 컬러 스트립 → 점·코드 inline
- 둥근 모서리 제거
- 카드 → 셀 직각 hairline grid

### 3 Views
1. **Week** — 7×2 (AM/PM) 그리드, Garmin/TP 친화
2. **9.5-Cycle** ★ — 10-slot rail, MAIN 정중앙 (D-5)
3. **Timeline** — 12주 macro, 코치용

### Mobile
- 기본 view: 9.5-Cycle (제품 정체성)
- View switcher 상단
- Week는 vertical scroll, Cycle은 list view (가로 스크롤 X — v1 사용성 이슈 반영)

### 개발 시 주의
- URL state: `?view=week|cycle|timeline&date=2026-04-22`
- 키보드 단축키: ⌘← / ⌘→ 이전/다음
- 드래그 앤 드롭으로 세션 이동 (선택, 코치 역할만)
- 셀 클릭 → Session Detail로 라우팅
- 빈 셀 클릭 → 세션 추가 modal

---

## 5. Session Detail (`05_SessionDetail.html`) — **P1** ✅ 정본

### 목적
- 가장 많이 보는 화면. 훈련 전·중·후 모두.

### 정보 블록 (논문식 §1-§5)
1. **§1 Session** — Hero (태그, 제목, 목적, 4메트릭, countdown)
2. **§2 Why this session** — 철학 + 데이터 + sources (★ 차별화)
3. **§3 Protocol** — 3 phases (Warm-up / Main / Cool-down)
4. **§4 Validation · 9 Rules** — 자동 검증 결과
5. **AI Inbox 연동** — 좌측 hairline brand
6. **§5 Cycle context** — 전·후 세션

### Desktop 2-column
- Left (1fr): §1-§3
- Right (420px): Action + AI inbox + Validation + Related

### Mobile
- 세로 스크롤
- Sticky bottom: [세션 시작] [AI 질문] [더보기]

### 핵심 인터랙션
- Hero countdown 실시간 (1초 단위)
- "세션 시작" → Timer 화면 (별도 — 미디자인, MVP 후순위)
- Phase 클릭 → 상세 modal
- Source 클릭 → Side panel slide
- "코치 판단 입력" → InboxItem update + decision log

### 개발 시 주의
- AI 응답은 Server Component에서 prefetch (핵심 화면 빠르게)
- Validation은 Server에서 룰 엔진 실행 후 props
- Mobile sticky bar 60px reserve (콘텐츠 padding-bottom)

---

## 6. AI Chat (`06_AIChat.html`) — **P1**

### 목적
- 장호준 AI와 대화. 모든 응답에 verdict + confidence + 인용 + 반대 의견.

### 화면 구조 (Desktop 3-column)
- Left: Sidebar (220px)
- Center: Chat (1fr)
  - Top: 모델 정보 + 액션
  - Context bar: 선수 상태
  - Stream: 메시지 (User → AI → User → AI...)
  - Composer: input + suggestions + footer hints
- Right: Cited / Context / History (320px)

### 메시지 구조
**User**: ink bg, right-aligned, 65% max width
**AI**:
```
| 장호준 AI · [verdict] · 신뢰도 X% · N sources · X.Xs
| ────────────────
| Lead 답변 [1] [2]
| (data table optional)
| 추가 설명 [3]
| [다른 관점] alternative view (반드시 포함)
| Sources (collapsed by default)
| Actions (저장 / 복사 / 인박스 추가 / 코치 판단)
```

### 핵심 차별 기능
1. **Verdict + Confidence** 의무 — 모든 응답에 4종 중 하나 + %
2. **Citations [1] [2]** — sup태그, 클릭 시 사이드 패널 펼침
3. **Alternative view** — 반대 의견 또는 보수적 해석 항상 포함
4. **Sources panel** — Cited (이번 채팅) / Context (선수 상태) / History (과거 대화)

### AI Stack
- LLM: Claude Sonnet 4.5
- RAG: pgvector
  - Coach Jang notes (A_guide 9 rules + practice notes)
  - 외부 문헌 (Daniels, Seiler 등)
  - 본인 과거 세션 (last 90d)
- Streaming: Vercel AI SDK
- Verdict 결정: post-process LLM output → check confidence in response, classify

### 응답 포맷 강제 (System Prompt 핵심)
```
모든 응답은 다음 JSON으로:
{
  "verdict": "confirm" | "recommend" | "unc" | "lack",
  "confidence": 0-100,
  "answer": "마크다운 본문 with [1] [2] citations",
  "alternativeView": "반대 의견 (필수)",
  "sources": [{ "n": 1, "title": "...", "source": "...", "url": "..." }]
}
```

### 개발 시 주의
- Confidence < 70 → 자동으로 InboxItem 생성 (background)
- 답변에 사용자 개인 데이터 (PB, CK 등) 자동 포함 → context injection
- 토큰 비용 모니터링 (사용자당 hourly limit)
- Conversation memory: thread별 last 10 messages만 컨텍스트로

### 외부 의존성
- Claude API
- pgvector (Supabase)

---

## 7. AI Inbox (`07_AIInbox.html`) — **P2**

### 목적
- AI가 발견한 신호의 큐. **사용자 본인 데이터만**.

### 5 Categories
| Code | 이름 | 트리거 |
|---|---|---|
| UNC | 판정 불확실 | confidence < 70% |
| RISK | 부상 위험 | 패턴 + 통증 입력 |
| PTRN | 패턴 감지 | 14일 추세 변화 |
| RULE | 규칙 위반 | 9 Rules 자동 검증 fail |
| PASS | 규칙 통과 | 사이클 완료 시 |

### Desktop 3-column
- Left: Sidebar (220px)
- Filter rail (280px): By type / By time
- List (1fr): InboxItem stack
- Detail (380px): 선택된 item 상세 + sources + actions

### Mobile
- 1-column
- 필터 바 (가로 스크롤)
- InboxItem list

### 개발 시 주의
- Inbox는 **큐**가 아닌 **stream** — 새 이벤트 자동 추가, websocket 또는 polling
- 읽음 상태: read/unread 구분
- 일괄 작업: "전체 읽음", "필터별 읽음"
- 사용자는 본인 것만 본다 (Coach view 8명 통합은 B2B/P3로 미룸)

### 자동 트리거 (서버사이드 cron — 현 단계는 rule engine)
- 매일 06:00 KST: 9 Rules 검증 → fail 시 INBOX 추가
- 체크인 입력 직후: 결정 함수 → 변화 감지 시 INBOX
- (LLM 도입 후) AI 응답 confidence < 70 → INBOX

---

## 8. Analysis (`08_Analysis.html`) — P2

### 목적
- 8주 추이. CTL/ATL/TSB, HR drift, Energy distribution, MAIN session 기록.

### 섹션
1. **§1 KPI** — 4 메트릭 (CTL / ATL / TSB / Weekly TSS) + sparkline
2. **§2 Performance Manager** — 큰 line chart (CTL/ATL/TSB)
3. **§2 HR drift · MAIN** — bar chart + target band
4. **§3 Energy distribution** — stack bar + 5분할 legend
5. **§4 MAIN sessions table** — 7개 세션 비교

### 개발 시 주의
- 차트 라이브러리: **Visx 추천** (low-level, 디자인 자유도 높음)
  - 또는 Recharts (편하지만 격자 hairline 커스터마이징)
- 데이터 fetch: 8주 일별 CTL/ATL/TSB → Server Component
- 격자선은 `hair` 색 (#E8E6DF), 1px
- 라인은 brand / warn / ink 3색
- "today" 마커 dashed
- Hover: tooltip with mono numbers
- 범위 변경 (4w/8w/12w/1y): URL state

### 외부 의존성
- 본인 세션 데이터 (Garmin sync 후 계산)
- 차트 라이브러리

---

## 9. Daily Check-in (`09_DailyCheckin.html`) — **P1**

### 목적
- 매일 5분 이내 체크인. RPE, 수면, 통증, 메모.

### 6 Questions (3-frame UI로 표시)
1. § 어제 세션 RPE (1-10 scale)
2. § 수면 시간 (stepper)
3. § 수면 질 (4-choice grid)
4. § 컨디션 (4-choice grid)
5. § 통증 부위 (body diagram)
6. § 메모 (textarea, optional)

### 완료 후
- summary + AI 코멘트 (좌측 brand hairline)
- "이 데이터는 14일 추세에 자동 반영" 안내

### 개발 시 주의
- Progress bar 상단 고정
- "건너뛰기" 허용하되, 14일 미입력 시 인박스 알림
- Body diagram은 SVG, multi-select, painLevel 1-5
- 입력 후 Dashboard로 자동 이동
- AI 코멘트는 새로 생성 (Claude API), 너무 비싸면 rule-based fallback

---

## 10. Competitions (`10_Competitions.html`) — P2

### 목적
- 대회 등록·D-day·테이퍼링·과거 결과·페이스 전략.

### 화면 구조
1. **Hero** — 다음 목표 대회 + D-day + Periodization timeline
2. **Stats** — Target / PB / SB / Last 5km
3. **Pace strategy table** — 1500m 4-lap split
4. **Past results** — 4-7 selected (1500m, 5000m)

### Periodization
5 phases: Build / Build / Peak / Taper / Race
- `done` (surface-2)
- `now` (ink bg)
- `future` (default)

### 개발 시 주의
- D-day countdown 매분 업데이트
- 자동 테이퍼 (R-9): D-21부터 볼륨 자동 감소 (cycle plan에 반영)
- 과거 대회 결과 → PB 자동 갱신
- 대회 일정 → Calendar에 마커 표시
- 다른 대회 추가 modal

---

## 11. Philosophy (`11_Philosophy.html`) — P3

### 목적
- 장호준 코치의 철학을 외부에 노출하는 정적 long-read.

### 섹션
1. §1 The problem — 주간 계획의 함정
2. §2 The 9.5-day cycle — 왜 9.5일인가 (figure 포함)
3. §3 The Rules — 9 rules table
4. §4 The role of AI — thinking tool
5. §5 What this is not — 한계
6. References (footnote)
7. CTA → 14일 무료

### 개발 시 주의
- Single-column long-read, max-width 760px
- Reading time 표시 (7분)
- pull quote: 좌측 3px ink border
- Cycle figure는 inline SVG/HTML grid
- 9 Rules table은 hairline border
- SEO 강화 (meta + structured data)
- Print-friendly CSS

---

## 12. Settings (`12_Settings.html`) — P3

### 목적
- 프로필, AI 설정, 데이터 동기화, 디스플레이, 알림, 계정.

### 7 Groups
1. Profile (이름, 생년, 성별, 키, 체중)
2. 종목 · PB
3. HR Zones
4. AI · Coach (모드, 신뢰도 임계, 코치 연결)
5. Data sync (Garmin, Strava, ...)
6. Display (다크 모드, 고대비, 언어, 단위)
7. Notifications (푸시, 아침 브리핑, D-7)
8. Account (이메일, 비번, 내보내기, 삭제)

### Desktop
- Left sub-nav (280px) — 그룹별
- Main detail (1fr)

### Mobile
- 1-column accordion 또는 single page (스크롤)

### 개발 시 주의
- Toggle 컴포넌트는 직각 (radius 0)
- "계정 삭제" → 확인 modal + 이메일 인증
- 데이터 내보내기 → CSV / JSON 선택, async job
- 비밀번호 변경 → email confirmation flow
- Settings persistence: localStorage (UI) + server (계정)

---

## 13. 화면 외 — 추가 작업 필요

### 미디자인 — 우선순위별

**P1 (다음 작업 후보)**
- **Personal Archive** — "내 이야기" 화면 (PHILOSOPHY §5.6 정의)
  - 시작일부터 누적된 모든 세션 timeline
  - PB / SB 갱신 timeline (PB Trail 차트)
  - 부상·통증·복귀 기록
  - DNF/DNS, 실패한 대회 포함
  - "1년 전 오늘" 회상 (toggle off 가능)
  - AI와의 주요 결정들 (Decision log)
  - **차별화 핵심**: 이 화면이 사용자가 "이건 내 이야기다"고 느끼는 자리

**P2**
- **Session Timer** (실행 중 화면) — Big timer + 현재 페이스 + lap 분할 + HR

**P3**
- **Knowledge base** — Coach Jang 노트, 외부 문헌 검색 (LLM 단계 도입 후)
- **Reports** — PDF export (사이클 리뷰, 월간 요약)
- **404 / Error** pages

### B2B / 추후 (P3+)
- ~~Athlete list (코치 view 8명)~~
- ~~Coach dashboard~~
- ~~Cohort comparison~~

### 부속 컴포넌트
- Modal (confirm, edit)
- Toast (성공/에러 알림 — 단, 무의미한 축하 메시지 X)
- Command Palette (⌘K) — search, jump, action
- Tooltip
- DatePicker
- Time Picker (페이스 입력용 m:ss.ms)
- **Range Switcher** (1y / 2y / 3y / all) — Heatmap·PB Trail 등 시간축 차트용
  *(Q4 결정: 모바일도 범위 토글 가능, 단계적 확장 구조)*

---

## 14. 화면별 데이터 의존성

| 화면 | 필요 데이터 |
|---|---|
| Onboarding | User, Athlete, PB |
| Dashboard | Cycle, Session(today), InboxItem(unread), CheckIn(today) |
| Calendar | Cycle, Session[] |
| Session Detail | Session, Cycle, ValidationResult[], InboxItem(linked) |
| AI Chat | ChatThread, Message[], Athlete state, Knowledge base |
| AI Inbox | InboxItem[], Athletes, Sources |
| Analysis | Session[] (8w), CTL/ATL daily, EnergyDistribution |
| Daily Check-in | CheckIn(today), Session(yesterday), AI tip |
| Competitions | Competition[], PB[], Session[] history |
| Philosophy | (정적) |
| Settings | User, Athlete, Provider[], Preferences |

---

## 15. 우선 순위 — 6주 빌드 플랜 요약

```
Week 1: Foundation
- Tailwind config, tokens (4-tier energy colors), primitives
- Auth (Supabase)
- Database schema

Week 2: P1 화면 (Phase 2 — 신규 가입 + 매일 사용)
- Onboarding (3-step)
- Data Import (Primary device, 3년치 분석 경험)
- Records (PB / SB / Target / Reference)
- Daily Check-in
- Session Detail (정본 따라가기)
- Dashboard (v2 스타일로 재작업)

Week 3: AI 핵심 (Rule Engine 단계)
- 9 Rules validation 엔진 (TS 결정 함수)
- Verdict + Confidence 결정 함수
- AI Chat UI (rule engine 출력)
- InboxItem auto-create

Week 4: 차별화 시각화 + Personal Archive
- Visualization System (12 차트 타입)
- Personal Archive ("내 이야기")
- Analysis 화면 (Visx 차트)
- AI Inbox

Week 5: 보조 + 사이클
- Calendar (9.5-Cycle 뷰 강조)
- Competitions

Week 6: Public + Polish
- Landing
- Philosophy
- Settings
- Dark mode
- 성능 + a11y

— LLM 단계 (추후) —
- Claude API + RAG 도입 (Coach Jang notes + 본인 세션)
- Citation 검증 (server-side)
- Coach view / Cohort (B2B 단계 진입 시)
```
