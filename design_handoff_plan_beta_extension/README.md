# Handoff: TrainOracle Plan Beta Extension (v3.6)

## Overview

TrainOracle 앱에 **세션 실행·주간 회고·코치 관리** 3개 화면을 신규 추가합니다.
실제 앱 코드(`app/src/screens/`), Supabase 스키마(`supabase/migrations/`), 계약 테스트(`*.contract.test.tsx`)를 조사한 뒤 만든 시안이며, **기존 도메인 로직·컴포넌트를 최대 재사용**하도록 설계됐어요.

이 패키지의 목표: 3개 신규 화면을 TrainOracle 앱에 통합하여
- **P0 Session Prep** — TrainingHome의 "다음 훈련" 카드에서 세션 5분 전 준비 뷰로 진입
- **P1 Weekly Wrap** — 주간 회고 페이지 (셀프 회고 3줄 + Lazy 생성)
- **P1 Coach Handoff** — 다중 선수 관리 대시보드 (기존 백엔드 활용)

## About the Design Files

이 번들의 **HTML 파일들은 디자인 레퍼런스**예요. 프로덕션 코드로 직접 복사하는 것이 아니라, **의도된 룩·비헤이비어·데이터 연결을 보여주는 프로토타입**입니다.

작업: 이 HTML 시안을 **TrainOracle의 기존 코드베이스 환경 (React + TypeScript + Supabase)** 에서 재구현. 기존 패턴 (`useState` 기반 SPA · `AppShell.tsx` 라우팅 · `DeferredMobileScreens` lazy loading · `MobileFrame` · Contract Test) 을 그대로 따라야 해요.

**각 HTML 시안은 왼쪽에 폰/데스크톱 시안, 오른쪽에 개발 스펙 부록 (§1~§9)** 이 나란히 배치돼 있어요:
- §1 진입 경로 · §2 앱 데이터 재사용 (실제 함수·필드명)
- §3 핵심 개선점 · §4 파일 위치 제안 (신규/수정 파일 경로)
- §5 인터랙션 계약 · §6 AppShell 통합 (라우팅 Option 비교)
- §7 계약 테스트 스펙 (Given/When/Then) · §8~§9 화면별 세부

## Fidelity

**High-fidelity (hifi)**. 픽셀 · 컬러 · 타이포 · 스페이싱 · 인터랙션 모두 확정 상태예요. TrainOracle의 기존 디자인 토큰 (`--paper`, `--sans`, `--brand`, `--energy-*`) 을 그대로 사용했어요. 앱 기존 다이어리 감성 (다이어리 + 스티커) 을 유지하면서 **셀프 회고 편집 UI, 프린트 가능한 페이스 카드, 통계 그리드** 등 새 컴포넌트를 추가했어요.

시안 그대로 픽셀-퍼펙트하게 재구현 목표. 기존 앱의 `shared/tokens.css` 및 `DecorationCatalog`에 이미 대부분 자산·색이 있으므로 **거의 매핑만 하면 됨**.

---

## Screens / Views

### Screen 1: **Session Prep** (17 Session Prep.html) · P0 · 예상 2 스프린트

#### Purpose
러너가 세션 시작 5분 전에 오늘 무엇을 할지 확인하고 준비 완료 상태로 진입하는 화면. 계획 편집이 아닌 **실행 준비 뷰**.

#### Layout
- **폰 프레임 375×812px** · 세로 스크롤
- Top nav (44px) — 뒤로/제목/액션
- **Hero (padding 20 16)** — 시스템 태그 · 6×1000m 타이틀 · 카운트다운 카드
- **Pace Card (border 2px solid #14120C · print-friendly badge)** — 3'20" × 6 회 · 회복 정보 · 총합 3-col
- Weather check · 워밍업 5-block · Strategy 3줄 · Stop Rules
- **Sticky bottom CTA** — "시작 · 기록 남기기" (primary black) + secondary more

#### Components

**Hero System Tag**
- BG: `--e-vo2-strong` (VO2 시스템 · #B95A22 계열 · tokens.css 참조)
- 안에 `V2` 코드 배지 (rgba(255,255,255,0.25) BG · 900 weight · 10px)
- Text: white · 10.5px 700 · uppercase-ish
- Padding 4×10 · border-radius 4

**Countdown Card**
- BG: `--ink` (#14120C) · Color: `--paper` (#F7F3E8)
- Grid 2col: 라벨 왼쪽 (opacity 0.65 · 10.5px 600) · 시간 오른쪽 정렬 (32px 700 mono)
- Padding 14×16

**Pace Card (핵심 컴포넌트)**
- BG: paper · Border 2px solid ink · Padding 14×16
- 상단 absolute 뱃지 "PRINT-FRIENDLY" (top -10 right 12 · mono 9px 700 · BG ink white text)
- 상단 anchor 텍스트: "개인 기준 5000m 16:10 · 2025.05.18 기록 기준" (11.5px 600 · center · dashed hair 하단 border)
- 메인 3-col grid: `1fr auto 1fr`
  - 왼: 3:20 (44px 700 mono · `--e-vo2-text`) + "km당 목표" (10.5px 600)
  - 중: × (20px 700 mono)
  - 우: 6 (44px 700 mono · ink) + "회 반복"
- 하단 총합 3-col: 본운동시간 · 회복총합 · 주요거리 (15px 700 mono values)

**Warmup Block**
- Grid: `32px 40px 1fr auto` · Padding 10×14
- Circle idx (24×24 · ink BG · paper text · mono 11px)
- Duration text (13px 700 `--e-base-text`)
- Name + small subtitle
- RPE chip (mono 10.5px · paper BG · hair border)
- `.done` 상태: idx 초록 · name 취소선

**Stop Rules**
- BG: `--surface-2` · Border: hair 1px · Padding 12×16
- 헤더 warn color + 삼각형 아이콘
- ul list 11.5px

#### Typography
- Sans: 실제 앱 폰트 스택 사용 (Pretendard 계열)
- Mono: 실제 앱 mono 스택 (IBM Plex Mono 계열)
- 크기: Hero title 28px 700, Pace num 44px 700 mono, Body 12.5-13px, Micro 10.5-11px
- Letter-spacing: -0.02em (headings), -0.005em (body), 0.02em (mono badges)

#### Interactions & Behavior
- 화면 마운트 시 `session.startAt`까지 실시간 카운트다운 tick (1초 간격)
- 세션 시각 지나면 카운트다운 → "지나감" 상태 · 중단 규칙만 표시
- 워밍업 체크박스 클릭 → localStorage 낙관 저장 (즉시 UI · debounce 없음)
- 인쇄 버튼 → `window.print()` · `@media print` 로 페이스 카드만 A6 인쇄
- 하단 primary CTA → `onSessionComplete(sessionId)` 호출 · 앱 reducer가 `tab='journal', viewForJournal:{mode:'post-session', sessionId}` 로 전환

#### State Management
```typescript
interface SessionPrepState {
  session: Session // from prescription
  countdownSec: number
  warmupChecks: [boolean, boolean, boolean, boolean, boolean]
  weatherData: WeatherSnapshot | null
}
```

#### App Data Reuse (100%)
| Field | Source |
|---|---|
| `prescription.notation` `repetitionDistanceM` `targetRepSeconds` `setCount` `repetitionsPerSet` `repetitionRecoverySeconds` `recoveryMode` | `DetailedPrescriptionView` |
| `prescription.operationalComponents.warmup/cooldown` (easyDurationMinutes, rpeMin/Max, strides) | `warmup-cooldown` domain |
| `prescription.selectedAnchor` (eventDistanceM, performanceSeconds, achievedAt) | `anchor-selection` domain |
| `prescription.stopCodes[]` | `stopLabel()` 함수 그대로 |

#### Files to Create
- **NEW** `app/src/screens/plan-beta/SessionPrepView.tsx`
- **NEW** `app/src/screens/plan-beta/SessionPrepView.print.css` (A6 인쇄 스타일)

#### Files to Modify
- `app/src/screens/TrainingHome.tsx` — `nextTrainingSection` 클릭 핸들러 분기 (`onOpenSessionPrep`)
- `app/src/screens/Home.tsx` — 새 prop `onOpenSessionPrep` 추가, 라우팅 연결

#### AppShell Integration
- **Option A (권장)**: `tab='home'` 유지 + `viewForHome: {mode:'session-prep', sessionId}` 추가. Home 하위 뷰. 뒤로가기 시 Home 복귀.
- Option B: `tab='plan'` 이동. 단점 = 세션 준비 ≠ 계획 편집.
- **결정**: A. TrainingHome "다음 훈련" 카드 본체 → SessionPrep. 편집 아이콘(별도) → Plan.

#### Contract Test Scenarios (6개)
`app/src/screens/plan-beta/__tests__/SessionPrepView.contract.test.tsx`

- **T-01 페이스 카드**: GIVEN prescription notation "V2 6×1000 @3'20"" · WHEN mount · THEN `pace-card-target`="3:20", `pace-card-count`="6"
- **T-02 카운트다운 tick**: GIVEN startAt = now + 3min · WHEN 60초 fake timer · THEN "2:00" 표시
- **T-03 워밍업 저장**: GIVEN 5블록 · WHEN block[1] check · THEN `localStorage["session-prep-warmup:{id}"]=[false,true,false,false,false]`
- **T-04 Stop Codes**: GIVEN 4개 codes · WHEN mount · THEN `stopLabel()` 변환 4개 항목 렌더
- **T-05 Anchor**: GIVEN 5000m 970초 · WHEN 카드 · THEN ".prep"에 "5000m 16:10" 포함
- **T-06 CTA**: GIVEN "시작" 버튼 · WHEN click · THEN `onSessionComplete` 호출 · reducer tab='journal', viewForJournal={mode:'post-session'}

#### Print CSS
```css
@media print {
  @page { size: A6 portrait; margin: 8mm }
  body > *:not(.pace-card-printable) { display: none !important }
  .pace-card-printable {
    display: block !important;
    width: 100%; page-break-after: avoid;
    color: #000; background: #fff;
    border: 1.5pt solid #000;
    padding: 6mm;
  }
  .pace-card-printable .main .num { font-size: 32pt }
  .pace-card-printable .totals .v { font-size: 14pt }
}
```

#### Warmup Storage Policy
- Key: `session-prep-warmup:{sessionId}` · Value: 5-bool array
- 저장 시점: 각 체크 즉시 (debounce 없음, 5개뿐)
- 초기화: PostSessionForm 저장 완료 이벤트 시 `localStorage.removeItem`
- Skipped session: `skipSession()` 호출 시 함께 삭제
- Stale: 세션 종료 + 12시간 지나면 다음 마운트 시 auto-remove

---

### Screen 2: **Weekly Wrap** (18 Weekly Wrap.html) · P1 · 예상 1 스프린트

#### Purpose
러너가 지난 주 훈련 리듬을 회상하고 셀프 회고 3줄로 정리. **일요일 이후 첫 앱 실행 시 lazy 생성**해서 사용자가 열 때 확인 (매주 22:00 자동 크론이 아님 — 브라우저 백그라운드 불가로 폐기).

#### Key Change from v3.5 → v3.6
- ~~AI 코치 노트~~ → **셀프 회고 3줄** (사용자 지시 · AI 배제)
- ~~일요일 22:00 자동 크론~~ → **Lazy 생성** (localStorage 캐시)

#### Layout
- 폰 프레임 · 세로 스크롤
- **Week Header (매거진 스타일)** — kicker "WEEKLY WRAP · 36주차" + title "해냈어요, 이번 주도 리듬 잘 잡았어요" + subtitle "2026 · 09.04 ~ 09.10 · 자동 생성" badge
- **3-Number Hero** — 3 col: 42.3km · 6/7 · 4.1 (mood) · 각 하위 diff (▲3.1km up · ▲1회 up · ■±0 eq)
- Sticker Collage (paper BG · 스티커·테이프·도장 오버레이)
- Mood Curve (SVG 감정 곡선 7일)
- **Weekly Highlight** (border 2px solid `--e-vo2-strong` · 세션 카드 + why 텍스트)
- **Pain Timeline** (부위 × 7일 그리드 · R-4 WATCH 자동 판정)
- **Self Reflection (핵심)** — 3줄 편집 가능 (Gowun Dodum 폰트 · contenteditable)
- Next Week Preview · Weekly Badges
- Sticky bottom CTA

#### Components

**3-Number Hero**
- Grid 3col · gap 4 · padding 20×20
- 각 셀 center align
- Number: mono 32px 700 · with small unit (12px 600 gray)
- Label: 11px 600 gray · below number
- Diff: mono 10.5px 600 · color 조건별 (up=ok, down=warn, eq=gray)

**Self Reflect**
- Container: paper BG · border-left 3px `--ink-blue` · padding 14×16
- Prompt: 11.5px 500 gray · italic emphasis · dashed hair 하단 border
- Field row: grid `22px 1fr` · gap 8
  - Number: mono 11px 700 gray
  - Text: 'Gowun Dodum' font · 13.5px · `--ink-blue` color · contenteditable · min-height 20 · padding 2×4
  - Focus 시 rgba(26,58,111,0.06) BG
- Saved hint: 하단 dashed hair · 초록 dot + "자동 저장됨" 텍스트

**Sticker Collage**
- Container: paper BG · border 1px ink · padding 6 · height 200
- 안에 격자 무늬 (`radial-gradient` dots)
- 스티커 3개(sun/shoe/heart/water-bottle/stopwatch/moon/runner) · 테이프 3개(mint/blush/kraft) · 도장 3개(vo2/done/tempo/early) 오버레이
- 각각 position absolute · rotate deg 다양

**Mood Curve**
- SVG viewBox="0 0 320 100"
- Grid lines: hair 0.6px stroke
- Path: brand color 2.5px stroke round join
- Fill area: brand 0.08 opacity
- Dots on data points: brand 3.5px radius
- Peak highlight: 최고값 위 라벨 "최고 목 · 5.0"

#### Colors
- Kicker: `--brand` (#B5622E)
- Hero title: `--ink` (#14120C)
- Hero numbers: `--ink` mono
- Diff up: `--ok` (초록 계열)
- Diff warn: `--warn` (주황 계열)
- Self reflect: `--ink-blue` (남색 계열)
- Highlight border: `--e-vo2-strong`

#### Interactions
- 셀프 회고 debounced autosave (800ms) → `localStorage["self-reflection-2026-W36"]`
- Lazy 생성: `JournalArchive` mount 시 `getOrGenerateWeeklyWrap(prevIsoWeek)` 호출 · 캐시 hit이면 즉시 반환
- 주간 하이라이트 세션 카드 탭 → `LogDetail`로 이동
- 다음 주 세션 탭 → SessionPrep 프리뷰 (편집 안 열린 경우) · 편집 상태면 `DetailedPrescriptionView`
- 공유 액션 → 이미지 렌더링 SNS (개인 정보 · 통증 자동 마스킹)

#### App Data Reuse (100%)
| Field | Source |
|---|---|
| `loadEntries()` → 7일 필터 → `toAnalysisJournalEntry()` | journal domain |
| `summarizeToDateDistances()` `projectStructuredJournalObservations()` | 누적 거리 |
| `loadDecorationState()` — 이번 주 배치한 자산 ID 리스트 | decoration domain |
| `EveningEntry.mood` `painParts` | mood/pain 데이터 |
| Highlight 선정: R-7 준수 세션 중 drift 최소 | rule engine |
| `engagement` `reconcileJournalAwards()` | award system |

#### Files to Create
- **NEW** `app/src/screens/JournalWeeklyWrap.tsx` — 화면
- **NEW** `app/src/domain/weekly-wrap-generator.ts` — 데이터 조합 로직
- **NEW** `app/src/domain/weekly-wrap-lazy.ts` — `getOrGenerateWeeklyWrap()` 캐시 헬퍼

#### Files to Modify
- `app/src/screens/JournalArchive.tsx` — 상단 "이번 주 요약" 카드 추가
- `app/src/screens/EngagementStrip.tsx` — 일요일 알림 노출

#### AppShell Integration
- Journal 하위 뷰로 통합. `viewForJournal: {mode:'weekly-wrap', isoWeek}` 추가
- 진입 경로 2개: (1) JournalArchive 상단 카드 (2) 홈 배너 "이번 주 요약이 준비됐어요"
- 뒤로가기 → `viewForJournal: {mode:'archive'}` 복귀
- ISO 주차 파라미터 없으면 가장 최근 완료 주 (오늘 이전 마지막 일요일)

#### Contract Test Scenarios (7개)
`app/src/screens/__tests__/JournalWeeklyWrap.contract.test.tsx`

- **T-01 3-number hero**: GIVEN 7일치 · WHEN render · THEN hero-distance="42.3", hero-completion="6/7", hero-mood="4.1"
- **T-02 diff 계산**: GIVEN 지난주 39.2 · WHEN render · THEN hero-distance-diff="▲ 3.1km" class="up"
- **T-03 highlight 선정**: GIVEN R-7 준수 3건 drift [1.8, 2.4, 3.9] · WHEN render · THEN highlight.sessionId = min drift session id
- **T-04 셀프회고 저장**: GIVEN 입력 "테스트" · WHEN 800ms · THEN localStorage["self-reflection-2026-W36"] = {line1:"테스트"}
- **T-05 Lazy 캐시 hit**: GIVEN localStorage 존재 · WHEN mount · THEN getOrGenerateWeeklyWrap 캐시 반환 · generate 미호출
- **T-06 Pain R-4 WATCH**: GIVEN 왼종아리 [null,null,1,1,1,null,null] · WHEN render · THEN "R-4 WATCH 진입" 문구 표시
- **T-07 도장 자동발급**: GIVEN 완료 6/7, V2 3회 · WHEN mount · THEN reconcileJournalAwards 4개 도장 발급

---

### Screen 3: **Coach Handoff** (19 Coach Handoff.html) · P1 · 예상 3 스프린트

#### Purpose
코치가 여러 선수의 오늘 상태를 한눈에 확인하고 Priority Signal에 대응. Coach Note 남기고 Plan Override 제안 가능.

#### Layout (Two Layouts)

**Mobile 375px (2 Screens)**:
- Screen A: 대시보드 리스트 (선수 6명 세로 · Priority Signal 스택 · Bottom tab bar 5탭 + "코치" 활성)
- Screen B: 선수 상세 드릴다운 (선수 hero · Cycle summary 3col · Priority · 지난 7일 · 코치 노트 이력 · sticky composer 하단)

**Desktop 1440px (통합 뷰)**:
- 페이지 헤더 + 자격 미확인 배너 + Priority Signal Strip (가로 스크롤 3건)
- Grid `1.4fr 1fr`: 왼쪽 선수 6명 그리드 (2col) + 팀 메시지 카드 / 오른쪽 sticky right panel 선수 상세

#### Key Components

**Athlete Card**
- Grid `44px 1fr auto` · gap 14 · padding 16×18
- Avatar 44×44 원형 · 시스템 색 BG · 이니셜 white
- Info: name (14.5px 700) + Mode 배지 (mono 9.5px · READY green · CAUTION warn · RECOVERY info)
- Meta: 성별 · 종목 · PB · Cycle 진행 (11.5px)
- Cycle bar: 10칸 grid · 각 8×h ·  done=e-base-strong · today=e-vo2-strong outline · missed=warn
- Signal 우측: today-tag (완료/대기/위반) + pain-dot 5-dot

**Coach Note Composer**
- Textarea (border 0 · sans 12.5px · resize none · min-height 42)
- Placeholder italic
- Toolbar: target 왼쪽 "→ 민지 · 오늘 세션 카드에 표시" + Send 오른쪽 (ink BG · paper text · 5×12)

**Plan Override Panel**
- BG paper · border dashed warn · padding 12×14
- 헤더 warn color 삼각형 + "R-4 WATCH · 왼 종아리"
- Desc 11.5px 2줄
- Actions row: primary "강도 -10% 제안" (warn BG white) · secondary "지켜보기" (transparent + line border)

#### App Backend (이미 준비됨)
- **RPC**: `list_shared_journal_entries(uuid)` — `supabase/migrations/0013_shared_journal_projection.sql`
- **Table**: `support_connections` — `athlete_id · supporter_id · shared_fields · season_ends_on · revoked_at`
- **RLS**: 시즌 자동 만료 · 개인 메모 자동 제외

#### Interactions
- Priority Signal 클릭 → 해당 선수 카드 자동 선택 + 우측 상세 업데이트
- 선수 카드 클릭 → 우측 상세 업데이트 (URL 변경 · 뒤로가기 지원)
- Coach Note 등록 → optimistic UI + Supabase upsert. 선수 다음 앱 실행 시 표시
- Plan Override 원 탭 → 선수 알림 · 승인 대기 상태. 승인 시 실제 계획 반영
- 연결 해제 (revoked_at 설정) → 다음 refresh 시 카드 즉시 제거

#### Files to Create
- **NEW** `app/src/screens/coach/CoachDashboard.tsx` — 메인
- **NEW** `app/src/screens/coach/AthleteCard.tsx`
- **NEW** `app/src/screens/coach/AthleteDetailPanel.tsx`
- **NEW** `app/src/domain/coach-notes.ts` — CRUD + Supabase

#### Files to Modify
- `app/src/screens/Account.tsx` — 코치 모드 진입 링크
- `app/src/screens/AppShell.tsx` — `viewForAccount: {mode:'coach-dashboard'}` 추가

#### New Migrations

**`supabase/migrations/0020_coach_notes.sql`**
```sql
CREATE TABLE coach_notes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id   UUID NOT NULL REFERENCES auth.users(id),
  supporter_id UUID NOT NULL REFERENCES auth.users(id),
  target_date  DATE NOT NULL,
  text         TEXT NOT NULL CHECK (char_length(text) <= 500),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ,
  deleted_at   TIMESTAMPTZ,
  seen_at      TIMESTAMPTZ,
  CONSTRAINT valid_connection
    FOREIGN KEY (athlete_id, supporter_id)
    REFERENCES support_connections (athlete_id, supporter_id)
);
```

**`supabase/migrations/0021_plan_override.sql`**
```sql
CREATE TABLE plan_override_requests (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     UUID NOT NULL,
  athlete_id     UUID NOT NULL,
  supporter_id   UUID NOT NULL,
  proposed_delta JSONB NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','approved','rejected','expired')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at   TIMESTAMPTZ,
  expires_at     TIMESTAMPTZ NOT NULL
);
```

RLS: 코치는 자신이 쓴 것만 · 선수는 자기 앞 노트만 (deleted_at IS NULL). 편집은 30분 이내만.

#### AppShell Integration
- **Option A (권장)**: 기존 `tab='account'` 내부에 "코치 모드" 항목. `viewForAccount: {mode:'coach-dashboard'}`
  - 코치 자격 자동 감지: `support_connections`에 supporter로 1명 이상 연결 시 링크 노출
- Option B: `appMode: 'athlete'|'coach'` 전체 앱 스위칭. Phase 2로.

#### Contract Test Scenarios (8개)
`app/src/screens/coach/__tests__/CoachDashboard.contract.test.tsx`

- **T-01 코치 모드 자격 감지**: GIVEN support_connections 1개 이상 · WHEN Account mount · THEN "코치 모드" 링크 표시
- **T-02 자격 미확인 배너**: GIVEN CoachDashboard mount · WHEN render · THEN 배너 항상 표시
- **T-03 Priority Signal 생성**: GIVEN 왼종아리 3일 연속 · WHEN generatePrioritySignals · THEN 신호 배열에 R-4-WATCH 포함
- **T-04 개인 메모 필터링**: GIVEN entries PRIVATE 1건 + ANALYZABLE 1건 · WHEN RPC · THEN ANALYZABLE만 반환
- **T-05 Coach Note 저장**: GIVEN 입력 "수고했어" · WHEN 보내기 · THEN coach_notes insert + optimistic UI
- **T-06 선수 앱 노트 표시**: GIVEN coach_notes 오늘 · WHEN LogDetail mount · THEN 배너 표시
- **T-07 Plan Override 승인**: GIVEN 코치 -10% 제안 · WHEN 선수 승인 · THEN status='approved' + prescription 조정
- **T-08 연결 해제 즉시 반영**: GIVEN revoked_at 설정 · WHEN 다음 refresh · THEN 선수 카드 제거

---

## Interactions & Behavior (Summary)

**Session Prep**:
- 시작 5분 전 자동 진입 배너
- 워밍업 낙관 저장
- CTA → PostSessionForm plan-link 자동 연결
- 인쇄 액션 A6 페이스 카드
- 세션 시각 지나감 상태 전환

**Weekly Wrap**:
- Lazy 생성 · localStorage 캐시
- 셀프 회고 debounced autosave 800ms
- 홈 배너 알림 (일~수 표시)
- 스티커 콜라주 드래그 불가 (편집 아님)
- 이미지 공유 시 개인 정보 자동 마스킹

**Coach Handoff**:
- 자격 미확인 배너 상시
- 선수 카드 클릭 → 우측 상세 업데이트
- Coach Note optimistic
- Plan Override 승인 대기
- 연결 해제 즉시 카드 제거

## State Management

**Session Prep**: 로컬 useState (countdownSec, warmupChecks, weatherData). localStorage 저장. 세션 완료 시 useReducer로 앱 전역 상태 dispatch (tab, viewFor*).

**Weekly Wrap**: 앱 initial mount 시 `getOrGenerateWeeklyWrap()` 호출. 캐시 hit이면 즉시 로드. Self reflection은 debounced (800ms). 앱 useReducer에 `viewForJournal` 확장 필요.

**Coach Handoff**: Supabase 실시간 구독 (`support_connections`, `coach_notes`, `plan_override_requests`). Priority Signal은 클라이언트 계산 (R-4, R-7 rule engine 재사용). Optimistic UI + 실패 시 롤백.

## Design Tokens

**Colors** (모두 `shared/tokens.css`에 정의됨 · TrainOracle 기존 토큰 그대로):
- `--paper` `--paper-edge` — 배경 페이퍼 톤
- `--ink` `--ink-2` `--ink-3` `--ink-4` — 4-tier 잉크 색
- `--surface` `--surface-2` `--hair` `--line` `--line-2` — 서페이스/라인 4-tier
- `--brand` (#B5622E) — 브랜드 orange
- `--ink-blue` (#1A3A6F) — 셀프 회고용 남색
- `--ok` `--warn` `--info` `--err` — 상태 색
- `--e-base-*` `--e-vo2-*` `--e-lt-*` `--e-gly-*` `--e-rest-*` — 5개 에너지 시스템 계열 (wash/mid/strong/text 4-tier)
- `--pain-1..4` — 통증 4단계 색

**Typography**:
- `--sans` — 앱 sans 스택
- `--mono` — 앱 mono 스택
- 'Gowun Dodum' — Self Reflection · 다이어리 손글씨용 (Google Fonts)

**Spacing**: 4의 배수 · 6, 8, 10, 12, 14, 16, 20, 24, 32
**Border radius**: 0 (플랫) · 2 · 4 · 999 (원형)
**Shadow**: `0 30px 60px -20px rgba(20, 18, 12, 0.5)` (폰 프레임) · `0 4px 12px rgba(0,0,0,0.06)` (호버)

## Assets

- **shared/tokens.css** — 디자인 토큰 파일 (그대로 사용)
- **shared/mark-jh.svg** · **shared/wordmark.svg** — 브랜드 마크
- **shared/decorations/** — 16개 SVG (기존 `DecorationCatalog`에 이미 있는 것들):
  - Tapes (3): tape-mint · tape-blush · tape-kraft
  - Stickers (7): sticker-sun · sticker-shoe-detail · sticker-heart-detail · sticker-water-bottle · sticker-stopwatch-detail · sticker-moon-detail · sticker-runner
  - Stamps (6): stamp-vo2 · stamp-done · stamp-tempo · stamp-early · stamp-consistency · stamp-focus

**중요**: `DecorationCatalog` 88개 자산이 앱에 이미 있어요. 여기 SVG는 미리보기용으로만 필요. 재구현 시 앱의 `DECORATION_CATALOG`를 그대로 사용.

## Files

| Design File | Purpose |
|---|---|
| `17 Session Prep.html` | P0 Session Prep 시안 + §1-§9 개발 스펙 |
| `18 Weekly Wrap.html` | P1 Weekly Wrap 시안 + §1-§7 개발 스펙 |
| `19 Coach Handoff.html` | P1 Coach Handoff 375+1440 시안 + §1-§9 개발 스펙 |
| `20 Handoff Risk Review.html` | **필독** · 리스크 감사 16건 · 8건 해결 완료 · 남은 8건 팀 미팅 필요 |
| `shared/tokens.css` | 디자인 토큰 (앱 기존과 호환) |
| `shared/decorations/*.svg` | 데코 자산 미리보기 (앱 카탈로그와 매핑) |

---

## 🔴 개발 착수 전 필독: Handoff Risk Review

`20 Handoff Risk Review.html`에 상세 감사 리포트가 있어요. 상단 초록 배너에 **8건 이미 해결 완료** 리스트 (Critical 3 + High 3 + Medium 1 + Low 1). **남은 8건은 스프린트 시작 전 팀 미팅으로 결정 필요**:

- **H1** Session Prep 진입 라우팅 옵션 최종 결정
- **H5** 페르소나 fixture 4~5명 추가
- **H6** 확장 색 변수 이식 경로
- **H7** Plan Override 방식과 `adjusted-method-resolution-v3.ts` 정합성
- **M2** 스티커 콜라주 배치 알고리즘
- **M3** i18n 톤 태그
- **M4** a11y 스펙
- **M5** Weekly Wrap 이미지 공유 마스킹 정책
- **L2** ISO 주차 계산 · 도장 조건 정합성

## 🔒 자격·개인정보 보호 방침 (Coach Handoff 구현 시 필수)

1. **자격 미확인 배너 항상 표시** — 페이지 헤더에 상시 노출
2. **개인 메모 필터링** — `memoPurpose !== 'ANALYZABLE_TRAINING_NOTE'`는 RPC에서 제외
3. **시즌 자동 만료** — `season_ends_on >= current_date` RLS
4. **연결 해제 즉시 반영** — `revoked_at` 설정 시 즉시 RLS 차단
5. **코치 여러 명 있어도 서로 다른 코치의 노트는 못 봄**

---

**Version**: v3.6 · 2026-09-10  
**Design**: Genspark Designer  
**Handoff Format**: HTML 시안 (좌: 시안 · 우: 개발 스펙 §1~§9)  
**Priority**: P0 Session Prep → P1 Weekly Wrap → P1 Coach Handoff
