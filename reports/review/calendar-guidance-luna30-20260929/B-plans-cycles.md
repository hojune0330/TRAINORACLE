# 독립 공격 리뷰 B — 계획 달력·주기

검토일: 2026-09-29  
검토 대상: `reports/plans/CALENDAR_GUIDED_CONTEXT_AND_MOTION_PLAN_2026-09-29.md` v0.1  
기준 커밋: `3e659d4` (초안의 `source_commit`과 일치)  
판정: **보완 후 재검토**. 화면별 정책과 불변식은 좋은 출발이지만, 종료 계획 기본 위치와 cycle 날짜 역매핑은 구현 전에 닫아야 한다.

## 경계

소스 읽기와 정적 대조만 했다. 앱 실행, 부분·전체 테스트, 브라우저 확인, 네트워크, 선수 기록·비공개 데이터 접근은 하지 않았다. 훈련 숫자·강도·생성 엔진은 수정하지 않았다. 테스트 파일은 존재 여부와 assertion 본문만 읽었으며 실행 증거가 아니다. 초안 계획서는 미추적 상태였고 그대로 보존했다. 검토 폴더의 다른 미추적 산출물도 열거나 수정하지 않았다.

## 우선 판단

1. **P1 — 종료 계획 기본 위치가 현행 동작과 다르다.** 초안은 종료 후 마지막 계획 날짜를 고르지만 `PlanSchedulePreview`의 현재 초기화는 오늘이 범위 밖이면 첫 날짜로 간다.
2. **P1 — 최근 기록에서 cycle index를 역산하는 규칙이 없다.** 음수 index는 기존 CycleArchive/helper에서 지원된다. 최근 기록이 anchor보다 앞이면 음수일 수 있는데, 초안은 이를 언급하지 않고 기존 “매핑 함수”를 재사용한다고만 한다.
3. **P1 — 화면·계획 정체성 및 상태가 어댑터에 연결되지 않았다.** 제안 scope에는 owner/plan ID/navigation token이 있지만 대상 컴포넌트 다수는 해당 identity나 load/source uncertainty를 받지 않는다.

## 현행 코드 기준

- `PlanSchedulePreview`는 `ceil(frameLengthDays)`개의 날짜를 `startDate`부터 만들고, 세션은 기존 `session.day`/`slot`에만 투영한다. 달력 선택은 내부 날짜·리더를 바꾸며 계획 날짜를 쓰는 callback은 없다 (`app/src/screens/plan-beta/PlanSchedulePreview.tsx:89-105`, `:540-555`, `:221-227`).
- `DatedPlanPanel`은 주석 그대로 달력 어댑터다. 선택일의 기존 세션이 있을 때만 외부 `day`를 바꾸며, 세션/시작일 변경 API는 없다 (`app/src/screens/plan-beta/DatedPlanPanel.tsx:18-25`, `:29-40`).
- `RecommendationCalendar`는 후보 `days[0].date`를 시작 위치로 쓰고 그 날짜가 바뀔 때만 내부 선택을 초기화한다 (`app/src/components/instant-plan/RecommendationCalendar.tsx:11-19`).
- `IntakeCalendarPeek`는 유효한 입력 시작일이 없으면 오늘을 그림의 기준일로 쓰고, 예시 훈련일을 따로 만든다. 실제 계획 생성 배치가 아니라는 주석도 있다 (`app/src/screens/plan-beta/IntakeCalendarPeek.tsx:10-14`, `:23-29`, `:67-78`).
- `CycleArchive`는 anchor와 index를 분리한다. 월 이동은 월만 바꾸고, 시작일 입력만 anchor를 바꾸며 index를 0으로 되돌린다 (`app/src/screens/CycleArchive.tsx:23-31`, `:41-48`, `:52-67`).

## B01 — 오늘 휴식인 선수

1. **예정 휴식과 실제 쉼·빈 일정이 같은 말로 뭉개지는지 공격한다 (P1).**  
   현재 코드: `REST` 역할은 `OFF/휴식`으로 표시되고, 세션이 아예 없는 날은 `비움`으로 구분된다. 실제 진행 상태는 별도 `sessionProgress`로 읽는다 (`PlanSchedulePreview.tsx:561-579`, `:602-605`, `:504-519`).  
   공격 순서: 오늘에 `REST` 세션만 존재 → 진행 기록 없음 → 같은 날의 실제 `RESTED` 결과 도착 → 다시 방문. 초안의 자동 위치는 날짜만 고르고, `예정 휴식`을 `휴식함/완료`로 표현하거나 기록을 쓰면 안 된다. `REST` 행, 세션 없는 날, 실제 진행 상태를 나란히 검증해야 한다. 초안의 “오늘 예정 휴식” 원칙은 좋지만 세 상태의 사용자 문구·접근성 이름 기준은 아직 없다.  
   장점/비용: 오늘의 실제 계획을 바로 찾게 한다 / 날짜 선택이 휴식 수행 완료를 뜻하지 않는다는 명시가 필요하다.

2. **선택한 휴식 날짜를 백그라운드 갱신이 빼앗는지 공격한다 (P1).**  
   현재 코드: 달력 선택 날짜와 월은 컴포넌트 내부 상태다. 계획 날짜/길이가 바뀌면 초기화하는 effect가 있고, 오늘 표시에는 `useLocalToday`를 쓰지만 초기화 effect는 `todayISO()`를 다시 읽는다 (`PlanSchedulePreview.tsx:93-116`, `:487-503`). `useCalendarEntries`는 계정·storage·focus 이벤트 뒤 배열을 다시 읽으며 load state를 반환하지 않는다 (`app/src/hooks/useCalendarEntries.ts:6-23`).  
   공격 순서: 오늘 휴식 날짜 열기 → 다른 휴식일을 직접 선택 → 저장/focus 갱신 또는 자정 → 새 기록 도착. 초안대로 수동 의도는 유지하고 `오늘` 명시 동작만 재이동시켜야 한다. 선택을 재정렬하는 effect가 hydrate·refresh마다 실행되지 않도록 reducer의 MANUAL 소비 규칙을 각 소비자에 연결해야 한다.  
   장점/비용: 같은 화면에서 최근 데이터가 도착해도 읽던 날짜를 유지 / 최신 기록을 놓칠 수 있으므로 초안의 명시적 `최근 일지`/`오늘` 재진입이 필요하다.

## B02 — 오전·오후 선수

1. **오전 완료/오후 예정 중 PM 직접 진입이 자동 날짜 선택에 밀리는지 공격한다 (P1).**  
   현재 코드: 진행 상태는 세션별로 계산되고, `readerRequest`는 `day + slot + sequence`, `focusSession`은 `day + slot`을 받는다. 요청은 지정 슬롯을 reader로 열고 focus는 복귀 세션을 표시한다 (`PlanSchedulePreview.tsx:63-87`, `:118-127`, `:158-162`). 달력 날짜 자체는 두 슬롯을 함께 묶는다 (`:308-319`, `:501-519`).  
   공격 순서: 같은 날 AM=완료·PM=예정 → PM에서 일지로 이동 → 달력 복귀와 동시에 refresh → 같은 계획 화면 재진입. 현재의 새 explicit PM 요청은 자동 위치보다 우선해야 하고 한 번만 소비해야 한다. `focusSession`과 `readerRequest`를 같은 종류의 반복 effect로 합치거나 현재 시각/`savedAt`으로 슬롯을 추측하면 안 된다. 초안의 navigation token 우선순위는 타당하지만 소비자별 explicit 요청 생성·소비·취소 조건은 빠져 있다.  
   장점/비용: AM/PM 실제 슬롯과 일지 복귀를 보존 / 계획 ID가 바뀐 뒤 오래된 token이 재생되는 경우까지 token scope에 포함해야 한다.

2. **슬롯 정보가 없거나 하루 단위인 데이터를 AM 또는 PM으로 꾸며내는지 공격한다 (P2).**  
   현재 코드: `DatedPlanPanel`의 세션 타입은 AM/PM뿐이고 달력에서 선택하는 값은 날짜다 (`DatedPlanPanel.tsx:11-16`, `:29-40`). 반면 매핑 스펙 초안은 `sessionSlot`의 `FULL_DAY`/`UNSPECIFIED`, cycle phase의 `FULL_DAY`/`UNKNOWN`도 정의한다 (`specs/reconstruct/MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md:192-205`, `:209-229`).  
   공격 순서: source slot이 `UNSPECIFIED` 또는 timezone/phase가 모호한 날짜 → calendar-context로 복사 → UI가 오전/오후를 표시. 초안 상태 타입의 optional AM/PM만으로는 이를 표현하지 못한다. mapping spec은 DRAFT이므로 새 의미를 승인된 런타임 계약으로 승격하지 말고, 불명은 불명으로 표시하거나 기존 두 슬롯 projection에만 한정해야 한다.  
   장점/비용: 날짜별 요약에서 두 세션이 보이는 구조는 이미 갖춰져 있다 / cycle `halfDayPhase`와 실제 예정 `sessionSlot`을 같은 필드처럼 쓰지 않는 adapter가 필요하다.

## B03 — 미래 계획 선택자

1. **과거 최근 기록이 미래 후보 시작일을 끌어당기는지 공격한다 (P1).**  
   현재 코드: 후보 섹션은 실제 `startDate`와 candidate sessions를 `PlanSchedulePreview`에 넘긴다 (`app/src/screens/plan-beta/CandidateSection.tsx:75-82`). 컴포넌트는 후보 시작일부터 날짜를 만들고, 오늘이 후보 범위 밖이면 index 0을 선택한다 (`PlanSchedulePreview.tsx:90-99`, `:540-555`).  
   공격 순서: 시작일이 미래인 후보 표시 → 최신 일지는 과거 → `최근 일지` 새 event 도착. 후보 화면은 후보 시작일에 남아야 하며, 최근 일지 월을 보더라도 `startDate`, 후보 날짜와 `sessions[].day`는 그대로여야 한다. 초안의 PLAN_CANDIDATE 정책과 계획값 불변 원칙은 적절하다. 단, 자동 선택이 달력 view state만 바꾸며 후보/선택/저장 callback을 호출하지 않는다는 계약을 assertion으로 남겨야 한다.  
   장점/비용: 후보 자체를 빠르게 읽는다 / 과거 실제 기록으로부터 후보 적합성이나 새 처방을 추론하지 않는 경계를 계속 지켜야 한다.

2. **같은 시작일을 가진 후보 교체에서 이전 선택/reader가 남는지 공격한다 (P1).**  
   현재 코드: `RecommendationCalendar`는 `days`만 받고, 첫 날짜가 달라질 때만 선택·열린 reader를 초기화한다 (`app/src/components/instant-plan/RecommendationCalendar.tsx:11-19`, `:31-37`). 두 후보가 같은 첫 날짜를 공유한 채 sessions만 달라지면 상태 scope는 후보 교체를 알 수 없다. 제안 scope에는 `plan/range id`가 있지만 해당 어댑터 prop에는 identity가 없다.  
   공격 순서: 후보 A의 3일째 reader 열기 → 같은 시작일의 후보 B로 props 교체 → 이전 선택/reader 내용 확인. 새 후보의 위치를 A의 explicit/manual state로 오인하거나 A의 old link를 B에 적용하면 안 된다. 안정된 candidate ID/version을 전달하고, identity 변경 시 view state를 분리·초기화할 정책이 필요하다. 날짜만 비교하는 것은 충분하지 않다.  
   장점/비용: 첫 날짜가 그대로면 사용자가 탐색하던 달을 유지할 수 있다 / 다른 후보로 교체된 경우에는 그 편의가 오히려 잘못된 계획 문맥을 이어 붙인다.

3. **인테이크 시작일 미입력/오류를 사용자 확정일처럼 보이는지 공격한다 (P2).**  
   현재 코드: `IntakeCalendarPeek`는 `draft.startDate`가 없거나 invalid면 오늘로 fallback하고, `startDate` 변경 때 selection/month를 초기화한다. 예시 날짜 생성은 preview-only helper다 (`IntakeCalendarPeek.tsx:23-29`, `:43-61`, `:67-78`).  
   공격 순서: 시작일 미입력 → 오늘을 기준으로 달력 펼치기 → 날짜 탭 → 인테이크 진행 또는 복귀. 선택한 달력 날짜가 `draft.startDate`를 확정하거나 예시 운동일이 실제 계획일을 약속하면 안 된다. 초안의 INTAKE_PREVIEW 표는 “사용자가 입력한 시작일”만 적어서 미입력/invalid 상태와 화면상 오늘 fallback을 구분하지 않는다. 기본 날짜를 임시 표시할지, 달력을 감출지, “시작일 미입력”을 표시할지 명문화해야 한다.  
   장점/비용: 빈 입력에도 preview가 비지 않아 흐름을 보여준다 / 임시 fallback과 오너가 고른 실제 시작일의 시각적 구분이 필요하다.

## B04 — 종료 계획 복기자

1. **계획 종료 후 첫 날짜로 돌아가는 현행 초기화를 공격한다 (P1, 코드 불일치).**  
   현재 코드: 초기 index는 오늘 날짜의 `findIndex`를 0 이상으로 clamp한다. startDate/dayCount 변경 effect도 동일한 계산을 한다 (`PlanSchedulePreview.tsx:94-99`, `:110-116`). 오늘이 끝난 계획 범위 뒤라면 `findIndex === -1`이므로 index 0, 즉 첫 계획 날짜가 선택된다. 초안은 `ACTIVE_PLAN`의 종료 후 위치를 마지막 일정이라고 정의한다 (`reports/plans/CALENDAR_GUIDED_CONTEXT_AND_MOTION_PLAN_2026-09-29.md:100-107`).  
   공격 순서: 이전 계획의 마지막 날짜보다 오늘이 뒤 → 계획 화면 첫 진입 → 계획 시작일 변경/재마운트. 초안의 `PLAN_END`가 첫 날짜로 되돌아가지 않도록 기존 초기화와 자동 위치 effect를 함께 바꿔야 한다. 계획을 재생성하거나 이전 미완료 세션을 오늘 할 일로 승격하지 않고, 과거 계획의 마지막 civil date만 읽기 위치로 고른다.  
   장점/비용: 마지막 날부터 복기할 수 있다 / active/candidate/shared preview가 같은 컴포넌트라 각 caller의 policy를 명시하지 않으면 의도치 않게 candidate까지 종료 정책이 적용될 수 있다.

2. **“마지막 계획 날짜”를 마지막 운동/최근 기록 날짜로 바꾸는지 공격한다 (P1).**  
   현재 코드: `PlanSchedulePreview`는 sessions 행이 비어 있어도 `dayCount` 전체의 달력 날짜를 만든다 (`PlanSchedulePreview.tsx:90-92`, `:540-555`). `DatedPlanPanel`의 highlight end는 가장 큰 `session.day`에서 계산한다 (`DatedPlanPanel.tsx:34-47`). 두 기준은 같은 의미가 아니다.  
   공격 순서: 종료일이 휴식 또는 세션 없는 날인 계획 → 최신 실제 일지는 더 앞 날짜 → 계획 복기 자동 위치. 종료일은 저장된 계획의 inclusive range/start+length로 결정하고, 최신 workout, `savedAt`, 마지막 non-rest session로 당기지 않아야 한다. 초안에는 range end의 authoritative source와 trailing rest/empty-day 처리, 종료/취소/교체된 계획의 lifecycle 식별자가 없다. `PlanSchedulePreview` 자체에는 plan ID/status prop도 없으므로 caller가 명시적 ACTIVE_PLAN/종료 복기 policy를 넘기지 않으면 날짜만으로 상태를 짐작하게 된다.  
   장점/비용: 일정상 마지막 날을 그대로 볼 수 있다 / 종료 계획의 read-only 표시와 현재 활성 계획의 권한·상태를 분리하는 caller 연결이 선행돼야 한다.

## B05 — 9.5일 주기 탐색자

1. **최근 기록이 보존 anchor보다 앞서 음수 index를 요구하는 경우를 공격한다 (P1, 확인됨).**  
   현재 코드: CycleArchive의 이전 버튼은 `effectiveIndex - 1`에 하한을 두지 않는다 (`app/src/screens/CycleArchive.tsx:41-43`). `trainingCycleWindow`는 음수 index를 명시적으로 처리한다. parity는 `abs(index)`로 정하고, 음수일 때 anchor에서 역방향으로 길이를 더한다 (`app/src/domain/training-cycle-window.ts:10-29`). 계약 테스트 소스도 index `-1`이 anchor 직전 9일 창임을 assertion한다 (`app/src/domain/training-cycle-window.contract.test.ts:4-15`; 실행하지 않음).  
   합성 예: anchor가 `2026-09-29`이고 최근 기록이 그 전날이면 기존 window 정의상 `index=-1` 범위는 `2026-09-20`~`2026-09-28`이다. 즉 이 경우 음수는 오류가 아니라 보존 anchor를 유지한 정상적인 이전 창이다.  
   공격 순서: 사용자가 정한 anchor 유지 → anchor보다 앞선 최근 eligible `entry.date` 도착 → 해당 날짜의 index/월로 jump → anchor를 다시 확인. 자동 이동은 `cycleIndex`/view month만 바꾸고 `onAnchorChange`를 절대 호출하지 않아야 한다. 초안은 이 불변을 문장으로는 금지하지만, “기존 cycle 매핑 함수”에는 주어진 index→window만 있고 날짜→index 역함수, 음수 검색, 범위 경계/탐색 한도가 없다. `index=0`으로 clamp하거나 anchor를 기록 날짜로 바꾸면 각각 다른 cycle을 보여주는 결함이다.  
   장점/비용: 기존 화면은 음수 index와 수동 anchor를 이미 표현할 수 있다 / 역매핑 함수와 `onAnchorChange` 미호출, anchor snapshot 불변 assertion이 구현 관문에 추가돼야 한다.

2. **아카이브 그룹을 승인된 9.5일 처방/주기 mapping으로 오인하는지 공격한다 (P1).**  
   현재 코드: CycleArchive 안내는 9일·10일 window를 번갈아 보여주는 일지 묶음이며 처방/정답 주기가 아니라고 명시한다 (`app/src/screens/CycleArchive.tsx:52-67`). mapping spec은 `DRAFT_FOR_REVIEW`, `canonical_promotion_allowed: false`, 실행 테스트 0건이다 (`specs/reconstruct/MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md:7-21`). 문서는 9.5일을 10-slot 표시 rail로 둘 수 있다고 하나, accepted anchor/timezone/source ref/uncertainty가 필요하고 precise day claim은 timezone 불명 시 막는다 (`:143-187`, `:270-291`, `:295-311`). Plan Generator도 planned date/session slot의 소유자이며 mapping만으로 계획 생성·선택·수정은 허용하지 않는다 (`:343-355`).  
   공격 순서: stale/error/미확인 기록 배열 또는 anchor/timezone/source conflict → “최근 일지” 자동 jump → 화면에 cycle label 표시. `useCalendarEntries`의 배열만으로 READY/STALE/ERROR를 구분할 수 없으므로 초안의 readiness adapter 없이는 자동 위치나 “기록 없음”/예시 판정을 시작하면 안 된다 (`app/src/hooks/useCalendarEntries.ts:6-23`; 계획의 경계는 `CALENDAR_GUIDED_CONTEXT_AND_MOTION_PLAN_2026-09-29.md:134-145`). `entry.date` 기준의 실제 선택 가능 기록과 제외 범위만 써야 하고, 수집/수정 시각이나 비밀 메모를 읽어서는 안 된다. 기존 9/10일 아카이브 묶음과 DRAFT mapping의 cycle label은 별도 projection으로 유지해야 한다.  
   장점/비용: uncertainty를 추측으로 메우지 않는 초안의 방향은 맞다 / mapping spec 승격 전에는 archive index jump만 허용하고 `CYCLE_DAY`·half-day 의미를 새 처방 근거처럼 노출하지 않는 제한이 필요하다.

## 장점과 보완 우선순위

- **장점:** 모든 달력을 최근 일지로 몰지 않고 active/candidate/intake/cycle 정책을 나눈 점, 명시 요청과 복원 위치를 자동 선택보다 우선시킨 점, 자동 리더 열기·예시 쓰기·처방 변경을 금지한 점, 수동 탐색 고정·reduced motion·계정 격리를 계획에 포함한 점은 유지한다.
- **P1 선행:** 종료 계획의 첫 날짜 clamp를 마지막 날짜 정책으로 교정; 주기 anchor와 view index의 분리 및 음수 역매핑 정의; plan/candidate ID와 명시 navigation token을 실제 adapter에 연결; load/source uncertainty가 해결되지 않으면 자동 jump를 금지.
- **P2 선행:** AM/PM 외 슬롯 불명/하루 단위 projection; 인테이크 날짜 미입력/invalid 상태; plan range end와 trailing REST/empty-day 정의; recent record 후보의 eligibility·미래 날짜·동률 규칙을 단일 projection과 맞춤.
- **P3 후속:** 모션과 시각 반응은 `docs/UX_UI_VISUAL_STANDARD.md:202-225`의 44px, 200–350ms, reduced-motion, viewport 기준을 지키되, 현재 사용자 실측 전 성능 수치를 완료 증거로 적지 않는다.

## 실행 경계

새 구현: 미실시.  
테스트: 전체·부분 모두 미실행.  
런타임/브라우저/배포 검증: 미실시.  
이 문서는 계획 초안에 대한 정적 공격 리뷰이며 매핑 승인이나 실제 사용자 검증이 아니다.

[DRAFT_COMPLETE]
