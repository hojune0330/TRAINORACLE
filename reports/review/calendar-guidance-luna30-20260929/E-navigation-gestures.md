# E. Navigation Gestures 독립 공격 리뷰

**대상:** `TRAINORACLE-oracle-exploration-20260921` · **기준일:** 2026-09-29  
**범위:** AppShell navigation/history, MonthCalendar, JournalMonthCalendar, reader hooks, 작성 취소·저장 복귀, 용어집 왕복·탭 복귀.  
**판정:** 계획 리뷰는 진행 가능. 런타임 구현·실기기 합격·배포 승인은 아님.

## 증거 경계

- **현재 코드 사실:** 월 달력은 부모가 월을 제어하고 날짜 선택·키보드 포커스는 `MonthCalendar`/`JournalMonthCalendar`에 분산돼 있다. `MonthCalendar`에는 스와이프 핸들러가 없고, 일지 전체화면 리더의 스와이프는 별도 `useJournalPageTurn` 경로다 (`MonthCalendar.tsx:32-58,90-114`, `JournalMonthCalendar.tsx:19-24,45-67`, `JournalDayReader.tsx:42-70`, `useJournalPageTurn.ts:58-125`). 달력 버튼은 44px 최소 터치 영역을 사용한다 (`MonthCalendar.css:5,21`).
- **현재 코드 사실:** 달력 안 `PlanDayReader`는 `useReaderDialog`로 history 항목을 만들고, close 시 연결된 opener와 스크롤을 복구한다. 반면 AppShell 전체화면 리더 진입은 `detailDate`만 바꾸며, `popstate` 처리기는 calendar-draft, Oracle 입력 복귀, 오버레이만 분기한다 (`PlanDayReader.tsx:22-26,60-78`, `useReaderDialog.ts:16-46`, `AppShell.tsx:180-214,625-651`).
- **현재 코드 사실:** 선택일·readerDate는 `JournalMonthCalendar` 로컬 state다. 작성 draft의 셸 복귀점은 `AppShell`의 `v`만 저장한다. 저장 또는 화면 내 취소는 `viewForJournalReturn`을 사용하고, 브라우저 Back은 `calendarDraftReturn` 경로를 사용한다 (`JournalMonthCalendar.tsx:21-23`, `AppShell.tsx:113,180-189,639-648,690-705`, `app-shell-state.ts:102-116`).
- **현재 코드 사실:** 계정 스코프 변경은 화면 key를 바꾸어 자식 화면을 재마운트하지만 `v`의 날짜/월/리더 컨텍스트를 초기화하지 않는다. 달력 데이터 훅은 owner-scoped `loadEntries()` 배열만 반환하고 READY/LOADING/ERROR 구별값은 없다 (`AppShell.tsx:100-108,244-276,742-747`, `useCalendarEntries.ts:6-23`).
- **계획 위험:** 계획은 owner epoch, 소비되는 navigation token, return focus key, 로딩 상태, 마지막 입력 우선 전환을 제안하지만 런타임 API가 있다고 주장하지 않는다. 이를 실제 AppShell·dialog history·form draft 흐름에 연결하고 화면별 Back 의미를 하나로 맞추는 것이 선행 조건이다 (`CALENDAR_GUIDED_CONTEXT_AND_MOTION_PLAN_2026-09-29.md:91-103,120-161,199-205`).
- **실행 증거:** 저장소의 `model-evidence.json:2-34`는 순수 계획 모델 PASS, 19개 사례, 4개 seed, 1,000개 랜덤 시퀀스/50,000 전이를 기록한다. 그러나 같은 증거가 React 렌더링, 실제 계정, 브라우저 제스처, 성능을 제외한다고 명시한다 (`model-evidence.json:54-61`). 이번 리뷰에서 앱 테스트·브라우저·기기를 실행하지 않았다.
- **실행 증거:** 사용자가 제공한 synthetic `2025-08-18` 리더 닫기 후 같은 월·포커스 복귀 baseline은 **PASS**로 수용한다. 이번 턴에 재실행하거나 독립 검증하지 않았다. 아래 공격은 그 기준선을 반박하지 않고 월 경계·작성 왕복·하드웨어 Back·탭 교차라는 다른 경로를 겨눈다.
- **프라이버시 경계:** 실제 계정·메모 데이터는 열거나 실행하지 않았다. 기존 테스트 코드의 synthetic fixture만 정적으로 확인했다. 전체 앱 회귀는 요청에 따라 실행하지 않았다.

## 우선 발견

### P1. Android Back이 전체화면 일지 리더를 닫지 않음

`JournalArchive`의 원문 열기는 `detailDate`를 설정해 `JournalDayReader` 전체화면 분기로 간다. 이 진입에는 reader history marker를 추가하지 않는다. AppShell의 `popstate` 처리도 `detailDate`를 닫지 않아 Android 시스템 Back은 달력 복귀 대신 이전 문서/앱 이탈로 이어질 수 있다. 달력 안의 modal reader는 별도 `useReaderDialog` 경로여서 결과가 다르다 (`AppShell.tsx:180-214,625-651`, `CalendarJournalDetails.tsx:59-62`, `PlanDayReader.tsx:25-26`).

**보완:** 전체화면 리더와 modal reader의 반환점을 구분해 하나의 reader navigation 계약으로 묶는다. 전체화면 진입은 화면·owner·계획 범위·선택일·return focus key를 가진 marker를 한 번만 만들고, Android Back/브라우저 Back/화면 내 Back은 동일한 close reducer를 호출한다. 월 이동마다 history를 늘리지 않는다. 테스트는 전체화면 원문 열기와 modal 열기를 각각 Android Back으로 닫아 정확히 달력으로 돌아오는지 확인한다.

### P2. 작성 취소·저장 복귀가 달력 modal 복귀와 다른 화면을 선택함

작성 진입 시 `calendarDraftReturn`은 당시 AppShell `v`를 기억하지만, 일반 취소 및 저장 완료는 `viewForJournalReturn(v)`를 사용한다. 이 함수는 archiveSelection을 보존하면서 `detailDate`를 draft 날짜로 설정하므로 달력 안 날짜 reader가 아니라 전체화면 `JournalDayReader`로 간다. 하드웨어 Back은 반대로 저장된 `v`를 복원한다. 선택일·readerDate는 로컬 state이므로 하드웨어 Back도 그 내부 선택/포커스를 완전히 복원하지 못한다 (`AppShell.tsx:180-189,639-648,690-705`, `app-shell-state.ts:102-116`, `JournalMonthCalendar.tsx:21-23`).

**보완:** 작성 진입 원점을 `CALENDAR_MODAL | FULL_READER | ARCHIVE_LIST`처럼 명시적으로 기록하고, 취소·저장·하드웨어 Back 각각의 목적지를 결정한다. 저장 여부에 관계없이 원래 월·날짜·reader 단계·포커스 키를 복구할지, 저장 후 전체 리더를 여는 UX를 채택할지 하나로 정한다. 더티 폼에서 discard 거절 시 draft 유지, 승인 시 원점 복귀, 저장 성공 시 기존 저장 확인 의미 유지를 각각 테스트한다.

### P2. 월 경계를 넘은 modal reader close는 현재 날짜 포커스를 보장하지 않음

`useReaderDialog`는 처음 열린 opener를 캡처한다. close 시 opener가 연결돼 있으면 그 요소로 focus하고, 아니면 전달받은 fallback으로 이동한다. 그런데 `PlanDayReader`는 fallback을 전달하지 않는다. 달력 modal에서 날짜를 바꾸면 `JournalMonthCalendar`가 월을 갱신하고 opener 날짜가 표시 그리드에서 사라질 수 있다. opener가 남더라도 현재 선택일이 아니라 처음 눌렀던 날짜로 돌아갈 수 있다 (`useReaderDialog.ts:18-20,44-46`, `PlanDayReader.tsx:25-26`, `JournalMonthCalendar.tsx:21-24,63-66`).

**보완:** close 때 현재 selectedDate 버튼을 찾아 focus하고 없으면 월 제목 또는 달력 heading으로 안전하게 이동하는 fallback을 전달한다. 같은 달 baseline PASS는 유지하면서 한 달 경계, 여러 달 이동, opener DOM 제거, 키보드·TalkBack Back을 별도 검증한다.

### P2. 계정 스코프 변경 후 이전 날짜 위치가 남음

계정 변경은 `accountScopeRevision`을 올려 화면을 재마운트하지만 셸 `v`를 초기화하지 않는다. 따라서 이전 계정에서 선택한 `detailDate`, archive month, cycle 위치가 새 계정 화면에도 남을 수 있다. 기록 배열은 owner-scoped라 이 코드만으로 이전 메모가 새 계정에 노출된다고 단정하지 않는다. 위험은 이전 계정 탐색 컨텍스트가 유지되고 새 데이터와 혼합된 것처럼 보이는 점이다 (`AppShell.tsx:100-108,244-276,625-635,742-747`, `useCalendarEntries.ts:6-23`).

**보완:** navigation scope에 owner identity/epoch를 묶고 scope 변경 시 리더·선택 날짜·pending transition을 동기적으로 무효화한다. 이전 owner의 늦은 결과와 focus callback은 버린다. 합성 A→B 전환 후 B 날짜 준비 전 화면, Back, 동일 계정 복귀를 확인한다.

### P2. 용어집 overlay 왕복 후 포커스 복원 기준이 없음

용어집 overlay는 history에 push/replace하고 underlying view를 숨겼다가 Back으로 되돌린다. 그러나 `applyOverlay`는 overlay와 scroll만 복구하며 opener focus를 저장/복귀하지 않는다. 직접 진입 용어는 `key={overlay.term}`로 교체돼 관련 용어를 연 순간 이전 버튼도 unmount될 수 있다. 기존 navigation contract는 정확한 계획 단계 복귀를 확인하지만 focus 복귀는 검사하지 않는다 (`AppShell.tsx:138-169,181-214,749-758`, `TrainingLexicon.tsx:53-75`, `AppShell.navigation.contract.test.tsx:16-53`).

**보완:** overlay entry마다 opener ref/key를 저장한다. Back 시 연결된 opener, 아니면 원래 화면의 heading/선택 단계로 focus한다. related-term history는 이전 용어 focus 대상도 함께 보존한다. 브라우저 Back과 overlay 버튼 Back 둘 다 같은 복구 경로를 쓴다.

### P2. 탭 왕복은 archive 월 선택을 보존하지 않음

같은 Journal 탭을 다시 눌렀을 때 선택 월을 보존하는 테스트는 있지만, 다른 탭을 거쳐 돌아오는 경로는 다르다. `goTab`은 탭을 바꿀 때 매번 `viewForTab(tab)` 새 상태를 설정하고, Journal 초기 archiveSelection은 null이다. 용어집에서 돌아온 뒤 월을 고르고 Plan→Journal로 왕복하면 다시 오늘 월로 시작한다. 화면 내 Back 보존과 탭 재진입 복원은 별도 정책으로 정해야 한다 (`AppShell.tsx:348-357`, `app-shell-state.ts:42-50`, `JournalArchive.tsx:60-68`, `AppShell.archive.contract.test.tsx:79-89`).

**보완:** per-tab return point를 둘지 탭 재진입 시 초기화할지 NorthStar UX의 “이전 선택·스크롤 복귀” 범위에 맞춰 결정한다. 보존한다면 owner-scoped 월·날짜만 저장하고 민감 원문은 저장하지 않는다. same-tab 재탭 테스트와 cross-tab 왕복 테스트를 분리한다.

### P2. 월 달력 스와이프와 브라우저 가장자리 제스처의 계약이 비어 있음

현재 달력은 화살표·키보드 탐색은 제공하지만 swipe로 월을 바꾸지는 않는다. 일지 전체화면 리더 swipe는 56px 임계값과 수평 우세 비율을 쓰고 `touchcancel`은 정리하지만 가장자리 시작 좌표를 제외하지 않는다. 따라서 계획된 달력 swipe를 이미 지원한다고 말할 수 없고, 기존 reader gesture가 브라우저 Back과 충돌하지 않는다는 실기기 증거도 없다 (`MonthCalendar.tsx:45-58,70-75`, `useJournalPageTurn.ts:17-20,58-111,120-125`).

**보완:** swipe는 선택 편의로만 추가하고 화살표/키보드를 유지한다. OS 가장자리 구역·수직 스크롤·pointer/touch cancel·다중 터치·폼 입력 대상을 명시적으로 제외하며 iOS Safari와 Android Chrome에서 실측한다. 구현 전 acceptance에서 달력 swipe가 필수인지 선택인지 못 박는다.

### P2. auto-anchor 도입 시 로딩/오류 배열을 빈 상태로 오인할 위험

`useCalendarEntries()`는 빈 배열과 준비 전/실패 상태를 구분하지 않는다. 현재 plan의 최근 기록 자동 위치가 아직 구현되지 않은 것은 정상이나, 이 배열만 곧바로 anchor 입력에 쓰면 loading/error를 “기록 없음”으로 판단할 수 있다. 계획은 readiness adapter를 별도로 요구하지만 실제 계정 hydrate 경로는 아직 연결 전이다 (`useCalendarEntries.ts:7-23`, 계획 `:134-155`, `:201-205`).

**보완:** READY/STALE/LOADING/ERROR를 실제 hydrate·동기화 상태에 연결하기 전 자동 위치와 예시 상태를 결정하지 않는다. 로딩 중 수동 탐색, 오류 중 기존 기록, 같은 owner의 역순 응답을 앱 reducer/adapter 테스트로 검증한다. 대기 시간만으로 READY 판정 금지.

## 5 페르소나 공격 순서

아래 A/B는 유효한 진입·종료는 고정하고, 중간의 독립 간섭 이벤트를 LCG32 (`state = state * 1664525 + 1013904223 mod 2^32`) Fisher-Yates shuffle로 고정 seed에 따라 섞은 10개 공격 순서다. seed는 시나리오 순서 재현용이며 앱이나 모델을 이번에 실행한 결과가 아니다. 계획 문서의 필수 최소 시나리오와 UI 경계로 구성했다 (`계획:252-268`).

### E01 · iPhone 한손 탐색자

- **A (seed 20260929):** reader 열기 → 세로 scroll → 다음 페이지 swipe → `touchcancel` → 가장자리 시작 swipe → reader 닫기. 달력 swipe 자체는 현재 미구현. Reader swipe는 수평 우세 시 동작할 수 있으나 DOM에 이벤트가 전달될 때 browser-edge 시작 좌표를 제외하지 않는다. Safari가 해당 입력을 어떻게 중재하는지는 실기기 미검증이다. **계획위험, iPhone 실측 없음.**
- **B (seed 20261026):** calendar 열기 → 이전 달 화살표 → 키보드 월 경계 → 오늘 버튼 → 다음 달 화살표 → 선택 상태 확인. 화살표·키보드 경로는 있지만 한손 swipe는 제공되지 않는다. **현재 조작 경로 사실, swipe 동등성은 미구현.**

### E02 · Android 시스템 Back 우선 사용자

- **A (seed 20261123):** 전체화면 reader 열기 → 다음 날짜 → 이전 날짜 → 다음 날짜 → Android Back. AppShell route가 닫히지 않는 결함 경로다. **코드 사실, P1.** `AppShell.tsx:625-651`, `CalendarJournalDetails.tsx:59-62`.
- **B (seed 20261220):** modal reader 열기 → 이전 날짜 → 다음 날짜 → 월 경계 통과 → Android Back. dialog history는 있음. 단, 월 경계 이후 focus 대상은 별도 검사해야 한다. **dialog Back 구현 사실 / focus는 P2 미검증.** `PlanDayReader.tsx:25-26,60-78`, `useReaderDialog.ts:25-46`.

### E03 · 빠른 연타·늦은 갱신을 섞는 사용자

- **A (seed 20261317):** calendar 첫 렌더 → 오늘 → 저장 refresh → 자정 갱신 → 다음 달 → 이전 달 → 수동/명시 의도 확인. 현재 수동 선택이 refresh·today 변경에 빼앗기지 않는 것이 불변값이다. 관련 contract test와 순수 모델 기록은 있으나 이번 턴 실행은 없다. **기존 계약 근거, 현 런타임 PASS 주장 아님.** `MonthCalendar.contract.test.tsx:31-49,97-119`, `model-evidence.json:2-34`.
- **B (seed 20261414):** reader 열기 → 다음 날짜 → 저장 refresh → 다음 날짜 → 이전 날짜 → Back. 날짜 변경은 셸에서 replace로 반영되고 scroll alignment effect는 이전 예약을 취소하지만, Android Back이 전체화면 reader route를 닫는 계약은 별도다. 빠른 연타 자체의 앱 실측은 없다. `AppShell.tsx:530`, `useActiveContentScroll.ts:49-60`, `useJournalPageTurn.ts:31-40`.

### E04 · 빈 날짜 작성 중 취소/저장 사용자

- **A (seed 20261511):** dirty draft → 저장 refresh → 화면 Back + discard 거절 → 계속 입력 → Android Back + discard 승인. 거절 시 dirty draft가 남는 guard는 존재한다. 승인 뒤 목적지는 `viewForJournalReturn`의 전체화면 reader로 달력 modal과 달라진다. **가드 장점 + 복귀 불일치 P2.** `unsaved-draft-navigation.ts:16-30`, `useFormInputDraft.tsx:61-82`, `AppShell.tsx:690-696`, `app-shell-state.ts:102-116`.
- **B (seed 20261608):** dirty draft → 저장 refresh → blur → 두 번째 필드 입력 → 저장. system Back은 `calendarDraftReturn`으로 archive `v`를 복원하고 저장 완료는 `viewForJournalReturn`을 사용한다. **취소/저장/하드웨어 Back이 같은 origin을 복구하지 않는 위험.** `AppShell.tsx:180-189,639-648,300-318,690-705`.

### E05 · 용어집 왕복 후 탭을 오가는 사용자

- **A (seed 20261705):** 용어 overlay 열기 → 관련 용어 A → 관련 용어 B → browser Back → overlay Back. history로 이전 overlay/계획 단계는 보존하는 강점이 있다. 포커스 재배치는 별도 검증되지 않았다. **화면 복귀 확인 경로 있음, focus 미검증.** `AppShell.tsx:149-169,181-214`, `AppShell.navigation.contract.test.tsx:16-53`.
- **B (seed 20261802):** 용어 overlay를 닫은 뒤 Journal에서 과거 월 선택 → 탭 Plan → 탭 Trends → 탭 Journal → 월 위치 확인. overlay가 열린 동안 tab bar는 숨겨져 있어 닫은 후 탭을 이동한다. 마지막 단계가 새 `viewForTab`을 만들기 때문에 선택 월이 초기화된다. **탭 왕복에서 월 위치 소실, 코드 사실.** `AppShell.tsx:348-357,738`, `app-shell-state.ts:42-50`, `JournalArchive.tsx:60-68`.

## 장점과 제한

- **장점:** 달력은 civil-date 기반, 키보드 월 경계 이동, 오늘/선택일 구별을 갖는다. modal reader history는 민감 기록 원문을 history state에 넣지 않고, 연결된 opener·scroll을 복구한다. draft guard는 discard 확인을 취소하면 volatile 입력을 지킨다 (`MonthCalendar.tsx:9-17,45-58,90-114`, `useReaderDialog.ts:6,22-46`, `unsaved-draft-navigation.ts:16-30`).
- **제한:** 제공된 baseline은 같은 달 close/focus 한 경로만 입증한다. 모델 PASS는 순수 상태 모델 증거다. Android 전체화면 Back, cross-month focus, draft return, tab return, browser-edge gesture, 실기기 반응은 별도 앱-level 증거가 필요하다.
- **실행 제한:** 계획 메타데이터는 `runtime_implementation: NOT_STARTED`, `deployment: NOT_PERFORMED`다 (`CALENDAR_GUIDED_CONTEXT_AND_MOTION_PLAN_2026-09-29.md:1-10`). 이 리뷰는 런타임·스펙·다른 보고서·기존 evidence를 수정하거나 전체 회귀를 실행하지 않았다.

[DRAFT_COMPLETE]
