# 독립 공격 리뷰 A: 기록 위치와 빈 상태

## 범위와 증거 경계

- 전담 관점: A01 첫 방문자, A02 1년 만에 복귀, A03 듬성한 기록, A04 하루 복수 종류 기록, A05 과거자료 가져오기.
- 읽은 기준: AGENTS.md, PRODUCT_NORTH_STAR.md, docs/UX_UI_VISUAL_STANDARD.md, 지정 계획서, 디자인 핸드오프 위험 검토. 구현 대조는 JournalArchive, JournalMonthCalendar, AppShell, journal date/schema/store/archive, import 경로로 제한했다.
- 코드 사실은 현재 소스 또는 현재 테스트가 직접 보장하는 동작이다. 설계 위험은 계획의 미구현 가정, 누락된 상태 전이 또는 필요한 검증을 뜻하며 현재 런타임 결함으로 단정하지 않는다.
- 부모 제공 합성 브라우저 관측은 baseline/observations.json과 baseline/old-record-375.png를 읽어 확인했다. fixedToday=2026-09-29, old-record 첫 화면은 2026년 9월이며 oldRecordListPresent=true, detailOpens=true, returnMonth=2025년 8월, returnFocused=true, journalUnchangedByNavigation=true로 기록되어 있다. 캡처는 375x667 기준 현재 UI이며 새 기능 검증이 아니다. 브라우저는 이 리뷰에서 재실행하지 않았다. 실제 사용자 30명 시험이 아닌 5관점 모델 리뷰다.
- 실제 계정 기록, 비밀값, 환경변수에는 접근하지 않았다. 브라우저를 실행하지 않았고 런타임·스펙·기타 파일은 수정하지 않았다.

## 결론 요약

계획의 방향은 현재 동작의 확인된 불편과 맞는다. 현재 Archive는 선택 월이 없으면 오늘의 월을 보여주며, 빈 저장 상태도 오늘의 작은 달력과 첫 기록 CTA로 표현한다. 따라서 오래된 기록이 있어도 오늘 달부터 열리는 것은 코드에서 설명되고, 부모가 전달한 합성 관측과도 일치한다. JournalArchive.tsx:60-68, 161-169; JournalArchive.contract.test.tsx:106-119.

좋은 점은 모든 달력에 최근 기록을 강제하지 않고 화면 정책을 분리한 것, 자동 리더 열기·포인트·연속 출석 압박·3D를 제외한 것, 예시를 실제 데이터와 분리하려는 것이다. 현재 아카이브도 동일 날짜의 복수 기록을 종류별 개수로 합치고 메모 원문을 요약에 넣지 않으며, 과거 빈 날짜에 날짜 지정 기록을 쓰는 기존 경로가 테스트되어 있다. journal-archive.ts:206-236; JournalArchive.contract.test.tsx:140-166, 215-224.

구현 착수 전 해결할 핵심은 두 가지다. 첫째, 데이터 준비 상태가 Archive 입력까지 전달되어야 빈 사용자와 로드 실패를 구별할 수 있다. 둘째, 계획이 요구하는 자동 선택 날짜와 현재 컴포넌트 내부 선택 날짜/리더 날짜의 소유권을 하나의 반환 가능한 컨텍스트로 연결해야 한다. 그 다음 후보 날짜는 저장 시각이 아닌 기록일 기준으로 정렬하고 미래 날짜·계정·가져오기 상태를 명시해야 한다.

## 우선순위 발견

### P1 - 준비되지 않은 빈 배열을 첫 사용자로 오인할 수 있음

코드 사실: AppShell은 JournalArchive에 loadEntries() 배열만 전달한다. useCalendarEntries도 배열만 반환하고 READY/LOADING/ERROR 상태를 주지 않는다. 별도 안전 경로인 loadEntriesForPlanSafety는 uncertain을 구분하지만 Archive에서 사용하지 않는다. AppShell.tsx:630-632; useCalendarEntries.ts:6-23; journal-store.ts:70-75, 93-109, 111-132. JournalArchive는 투영된 월이 비었으면 곧바로 첫 일지 CTA를 렌더한다. JournalArchive.tsx:60, 165-169.

설계 위험: 계획은 CalendarLoadState를 제안하지만 이를 실제 AppShell/JournalArchive adapter에 연결하는 계약은 아직 없다. 첫 로드, 오프라인 stale, 저장소 판독 불확실, 오류가 모두 빈 배열로 들어오면 실제 사용자 기록이 있는데도 예시와 첫 기록 안내가 보일 수 있다.

개선: READY + 빈 결과에서만 예시를 허용한다. LOADING은 중립 로딩, STALE은 저장된 기록과 오래된 상태 표기, ERROR는 오류/재시도, 계정 전환 중은 이전 내용 비우기로 분리한다. 해당 상태 전부를 Archive까지 운반하는 호출 경로와 상태 전이 테스트를 계획 A 완료 조건에 명시한다. 계획서:42-44, 82, 127-145.

### P1 - 최근 월 이동만으로 최근 날짜 선택과 복귀가 완성되지 않음

코드 사실: AppShell의 ArchiveSelection에는 selectedMonth와 selectedWeekStart만 있고, JournalMonthCalendar는 selectedDate와 readerDate를 내부 useState로 가진다. 날짜를 고르면 두 내부 상태를 바꾸고 바로 리더를 연다. 자동으로 초기 날짜를 주입하는 controlled prop은 없다. app-shell-state.ts:7-24; AppShell.tsx:626-650; JournalMonthCalendar.tsx:19-23, 45-67.

설계 위험: 계획은 선택 civil-date, return focus, reader history, 자동 리더 미개방을 제안하지만 월/날짜/리더를 기존 view와 어떤 이벤트로 동기화할지 구체적인 adapter 전후 조건이 부족하다. 최근 월만 외부에서 지정하면 날짜 선택 테두리와 요약은 선택되지 않은 채 남는다. 부모 캡처는 현재 reader open/return 한 경로의 포커스 유지를 확인하지만, 첫 화면 자동 날짜 선택과 작성 draft route의 취소/뒤로 복귀는 측정하지 않았다. 자식 재마운트 시 내부 selectedDate 복구는 별도 계약으로 검증해야 한다.

개선: 달력 컨텍스트가 visibleMonth, selectedDate, readerOpen을 분리해 소유하고 Archive는 이를 명시적으로 주고받게 한다. 첫 위치는 월과 날짜만 선택하고 리더는 열지 않는다. 기록 보기/기록 쓰기는 별도 명시 동작으로 유지한다. 기록 보기 -> 작성 진입 -> 취소/뒤로 -> 복귀, 수동 날짜 선택 후 refresh, 오래된 달력 이동 후 탭 이탈/복귀를 계약 테스트에 추가한다. 계획서:88-98, 127-151, 223-227.

### P2 - 날짜 후보의 기준과 제외 조건을 구현 계약으로 고정해야 함

코드 사실: JournalEntryBase의 date와 savedAt은 서로 다른 필드다. 구조화 관측도 date를 loggedOn, savedAt을 observedAt으로 내보낸다. 가져온 활동은 activity.date를 entry.date로 보존하고 저장 시각은 별도로 현재 시각으로 만든다. journal-schema.ts:41-47; journal-observation.ts:161-182; import-draft.ts:270-301.

코드 사실: isValidIsoDate는 달력상 존재하는 YYYY-MM-DD인지 확인할 뿐 미래 여부를 제한하지 않는다. 아카이브 투영은 유효한 모든 entry.date를 월에 넣고, 오늘 이하인지 또는 출처/동기화 상태가 후보로 승인됐는지는 검사하지 않는다. dates.ts:22-30; journal-archive.ts:201-243. 반면 계획은 JOURNAL 후보를 오늘 이하로 제한한다. 계획서:100-113.

설계 위험: 최근 기록을 savedAt이나 배열 마지막 항목으로 정렬하면 뒤늦게 가져온 오래된 운동이 최신 기록처럼 보인다. 미래의 유효 날짜가 섞이면 단순 최댓값은 달력 오입력을 최근 기록으로 선택할 수 있다. 가져오기 parser는 현재 기기 시간대를 사용해 offset timestamp의 local date를 계산하므로 날짜 경계 근처 자료는 파싱 시간대 영향을 받는다. ImportActivities.tsx:80-104; activity-file.ts:58-66, 339-352.

개선: 순수 resolver 입력/출력에 후보 술어를 명문화한다. 기본 날짜는 소유 계정에서 준비 완료되고 삭제/휴지통이 아니며 날짜가 유효하고 entry.date <= localToday인 기록 중 최대 entry.date로 고정한다. savedAt은 후보 순서에 사용하지 않는다. 미래만 있으면 오늘을 보여주고 예정 기록 진입만 보조로 둔다. 가져오기 검토 전 초안과 저장 후 계정 동기화 대기 상태의 의미는 구별하고, 어느 단계부터 후보가 되는지 별도로 적는다. 계획서:100-124, 129-145.

### P2 - 계정 전환 시 탐색 컨텍스트의 소유권이 현재 분명하지 않음

코드 사실: archiveSelection은 AppViewState에 있으나 owner/epoch를 갖지 않는다. AppShell의 계정 이벤트는 active account와 scope revision을 갱신하고 화면을 다시 렌더하지만 view 안의 archiveSelection을 직접 비우는 동작은 해당 경로에 없다. app-shell-state.ts:7-24; AppShell.tsx:244-280, 626-650.

설계 위험: 계획은 계정과 navigation instance에 묶인 context 및 계정 변경 시 pending transition 제거를 요구한다. 그러나 이미 화면에 표시된 선택 날짜의 보존/폐기, 계정 변경과 뒤로가기 복원 경쟁, 지연 응답의 폐기 순서는 transition 표로 못 박혀 있지 않다. 날짜 자체는 메모가 아니지만 다른 계정의 선택 월을 새 계정 화면에 재사용하면 잘못된 위치나 오래된 예시 연결을 만들 수 있다.

개선: 컨텍스트에 owner identity epoch와 navigation instance를 함께 저장하고, account A -> B 시 reader/date/예시 선택/대기 callback을 먼저 무효화한 뒤 B의 READY 상태를 기다린다. 과거 view 복원은 owner와 plan/range id가 모두 일치할 때만 허용한다. 계획서:91-98, 122-125, 137-149.

### P3 - 복수 종류 요약과 줄인 모션의 동등성을 acceptance에 더 구체화

코드 사실: 날짜 그룹은 entry.date 기준이며 같은 종류의 복수 기록도 각각 개수로 증가한다. 기존 테스트는 같은 날 훈련 후 기록 2건을 확인한다. journal-archive.ts:121-136, 222-236; JournalArchive.contract.test.tsx:11-32, 61-81, 157-166.

설계 위험: 계획 예시는 훈련 1 · 일상 1까지다. 하루에 훈련 2회와 일상/경기가 섞이거나 입력 순서가 바뀔 때 요약 개수, 하루 총 기록 수, reader 결과가 동일해야 한다는 계약은 명시되지 않았다. 오전/오후는 기록 시각으로 추측하지 않고 실제 activitySlot에서만 보여야 한다. 또한 OS reduced-motion과 추가 앱 설정의 우선순위/저장 주체는 아직 기술 계약이 아니다.

개선: 같은 날짜에 종류별 0/1/2+건을 입력 순열별로 투영해 숫자 합계가 불변인지 확인한다. PRIVATE_SELF_ONLY 원문은 표시하지 않고 날짜/종류의 요약만 유지한다. reduced-motion에서는 translate, smooth-scroll, 반복 강조를 끄되 선택/저장 상태 전달은 동일하게 남긴다. 320px, 375px, 200% 확대, 키보드, pointercancel, 44px 타깃도 acceptance로 묶는다. 계획서:157-181, 238-267; docs/UX_UI_VISUAL_STANDARD.md:67, 217-225.

## 페르소나별 공격 순서

각 순서는 앱을 실행한 결과가 아니라 구현/계약 테스트용 결정적 이벤트 permutation이다. 예상 결과는 계획이 지켜야 할 불변식이며, 코드 사실과 미구현 위험을 별도로 표시한다.

### A01 - 첫 방문자

1. Seed A01-1, 준비 지연: ENTER -> 저장소 uncertain/빈 배열 -> 화면 진입 -> READY 응답 지연 -> 예시 열기 -> 오래된 실제 기록 도착. 기대: 준비 완료 전에는 “기록 없음”이나 예시를 단정하지 않고, 실제 데이터 도착 시 수동 의도를 뺏지 않으며 예시 기록은 0건 저장된다. 코드 사실: 현재 배열/빈 상태 계약은 위 P1과 같다. 설계 위험: 계획의 load-state 타입이 호출 화면에 아직 연결되지 않아 READY/ERROR 구별이 검증되지 않았다.
2. Seed A01-2, 예시와 계정 전환: READY(empty) -> 예시 날짜 선택 -> 계정 A에서 로그아웃/B 로그인 -> 이전 예시 애니메이션 callback 도착 -> 첫 실제 기록 작성. 기대: 예시 라벨은 탐색 내내 고정되고, callback은 owner epoch 불일치로 폐기되며 예시 선택이 실제 기록/포인트/계획 완료에 영향을 주지 않는다. 코드 사실: 현재 예시 달력은 구현되어 있지 않다. 설계 위험: 예시 시계, 상호작용과 실제 reader/write route 경계는 구현/contract test가 필요하다. 계획서:73-82, 137-145, 183-189.

### A02 - 1년 만에 복귀한 사용자

1. Seed A02-1, 과거 기록 하나: today=2026-09-29 -> ENTER -> READY([date=2025-08-18]) -> 첫 화면 확인. 기대: 2025-08 달과 8월 18일의 “최근 일지”가 선택되고 오늘 표시는 오늘 그대로 남는다. 부모 baseline의 375px old-record 캡처는 2026년 9월 달력과 “이 달 0일 · 0개 기록”을 보이고, JSON은 기존 일지 목록 존재 및 상세 후 2025년 8월 복귀를 기록한다. 코드 사실: selectedMonth가 null이면 today의 연월을 쓴다. JournalArchive.tsx:60-68; JournalArchive.contract.test.tsx:106-119; reports/review/calendar-guidance-luna30-20260929/baseline/observations.json; reports/review/calendar-guidance-luna30-20260929/baseline/old-record-375.png. 이는 부모가 실행한 합성 기준선이며 이 리뷰에서 브라우저를 재실행하지 않았다.
2. Seed A02-2, 기록일과 가져온 시각 역전: READY([A: date=2025-08-18, savedAt=2026-09-29], B: date=2025-08-25, savedAt=2025-08-26]) -> 입력 배열 순서 뒤집기 -> 초기 resolver. 기대: B의 8월 25일을 최근 기록으로 고르고, 이후 사용자가 2025-07로 이동하면 refresh가 자동으로 되돌리지 않는다. 코드 사실: date와 savedAt은 분리되어 있고 archive 월은 date에서 나온다. 설계 위험: 최초 resolver의 후보 순서와 자동 이동 소모 토큰이 코드/fixture에서 입증되지 않았다.

### A03 - 듬성듬성 기록하는 사용자

1. Seed A03-1, 비정렬 다년 자료: ENTER -> READY([2024-11-03, 2022-02-10, 2025-01-05]) -> 같은 집합을 여러 순서로 refresh. 기대: 첫 기본 위치는 순서와 관계없이 2025-01-05이고, 사용자가 빈 달로 이동한 뒤에는 자동 재점프하지 않는다. 코드 사실: archive 월 목록 자체는 내림차순 정렬되나 초기 displayedMonth는 여전히 오늘이다. journal-archive.ts:239-243; JournalArchive.tsx:62.
2. Seed A03-2, 미래 기록과 자정: READY([과거 유효일 2024-06-01, 미래 유효일 2027-01-03]) -> 사용자가 2024년 빈 날 선택 -> 자정 -> refresh. 기대: 미래일은 기본 후보가 되지 않고 수동 선택은 유지된다. 유효 기록이 전부 미래라면 오늘을 기본으로 하며 예정 기록은 보조 진입으로만 보인다. 코드 사실: 날짜 유효성은 미래를 막지 않고 archive 투영도 미래를 포함한다. 설계 위험: plan의 후보 필터를 resolver에서 반드시 적용하도록 시험해야 한다. dates.ts:22-30; journal-archive.ts:206-228; 계획서:102, 111-120.

### A04 - 하루에 복수 종류를 기록하는 사용자

1. Seed A04-1, 같은 날 순서 섞기: READY([2025-08-18 evening, race, post-session AM, post-session PM]) -> 같은 날짜 그룹 순서 뒤집기 -> 날짜 선택. 기대: 훈련 2, 일상 1, 경기 1, 총 4건이 순서와 무관하게 보이고 날짜 셀은 하루로 유지된다. 오전/오후는 실제 activitySlot을 가진 세션만 표현한다. 코드 사실: 투영은 날짜별로 전부 합산하며 현재 test fixture도 같은 날 훈련 2건을 검증한다. 설계 위험: 다른 종류와 2+ counts가 섞인 순열 test는 보강해야 한다.
2. Seed A04-2, 작성 왕복 중 갱신: 2025-08-18 선택 -> 이날 기록 쓰기 -> 취소/뒤로 -> 같은 날 새 기록 refresh 도착 -> 달력 복귀. 기대: 원래 선택일과 월이 복원되고 새 기록은 보조 안내만 하며, 동일 날짜의 기존 종류별 개수는 유지된다. 코드 사실: 월/주는 AppShell view에 있고 선택일은 자식 local state에 있다. 작성 경로는 archiveSelection을 view에 넘기지만 selectedDate 자체는 보내지 않는다. AppShell.tsx:639-650; JournalMonthCalendar.tsx:19-23; app-shell-state.ts:15-24. 설계 위험: 반환 포커스와 새 데이터 arrival 순서의 계약이 필요하다.

### A05 - 과거자료를 가져오는 사용자

1. Seed A05-1, 검토 전 draft: 과거 날짜가 섞인 파일 PICK -> REVIEW -> 한 행 제외 또는 화면 취소 -> JournalArchive 진입 -> 다시 파일 확인 후 사용자가 명시적으로 저장. 기대: 검토 중/취소된 draft는 달력 후보가 아니며, 저장된 행은 원본 activity.date가 기록일이고 가져온 시각 savedAt은 순위에 쓰이지 않는다. 코드 사실: ImportActivities는 parse 후 review stage를 거쳐 사용자가 고른 행만 confirm 경로로 넘기고, toImportedEntry는 activity.date를 보존한다. ImportActivities.tsx:80-105, 131-152; import-draft.ts:1-10, 270-301. 설계 위험: resolver candidate eligibility에서 검토 취소/제외와 저장 완료를 명시해야 한다.
2. Seed A05-2, 시간대와 owner 경쟁: offset timestamp가 자정 근처인 자료 PICK(기기 시간대에서 date 계산) -> REVIEW -> 계정 A에서 B로 전환 -> A의 지연 hydrate/confirm 결과 도착 -> B 달력 READY. 기대: 이미 저장된 civil date를 이후 UTC slicing이나 B 데이터로 재해석하지 않고, owner가 다른 callback은 폐기하며 B 기록만으로 위치를 결정한다. 코드 사실: import parser는 현재 기기 시간대를 전달받고, account draft builder는 scope 변경 시 null을 반환한다. ImportActivities.tsx:80-105; activity-file.ts:58-66, 339-352; account-import.ts:30-46, 62-99. 설계 위험: 계획은 civil-date와 owner epoch를 요구하지만 import 시 선택된 시간대가 기록일의 권위인지, pending 서버 응답이 후보에 들어가는지는 전이표에 없다.

## P1/P2/P3 조치 목록

- P1: JournalArchive까지 LOADING/READY/STALE/ERROR를 전달하고 READY + 0건에서만 empty/demo를 표시한다. 계정 전환 중에는 이전 사용자와 예시 상태를 먼저 제거한다.
- P1: 선택일/월/리더 열림/복귀 포커스를 단일 계정 범위 컨텍스트로 연결한다. 초기 최근 날짜 선택은 리더 자동 열기와 분리한다.
- P2: 후보 규칙을 entry.date <= localToday로 고정하고 savedAt 정렬을 금지한다. 미래만 있음, 날짜/저장시각 역전, imported activity date, 유효하지 않은 legacy 입력을 resolver fixture로 검증한다.
- P2: 저장 전 draft, 사용자가 확인한 저장 기록, 서버 확인 대기, 충돌/실패를 구분한다. 다른 owner에서 시작한 오래된 비동기 결과는 탐색과 데이터 양쪽에서 무효화한다.
- P3: 같은 날 종류별 0/1/2+건 permutation, 날짜 지정 빈 날 기록, 화면 왕복, OS/app reduced-motion, 키보드/확대/좁은 폭 acceptance를 붙인다. 게임 같은 느낌은 즉시 선택 피드백과 짧은 전환으로 한정하고 완료·안전 승인·운동량 보상처럼 오해될 효과는 넣지 않는다.

계획 문서의 상태와 이 리뷰 결과는 구현·배포·실사용자 검증 완료를 뜻하지 않는다. 이 문서는 지정 범위의 모델 공격 리뷰이며 실제 30명 사용성 시험 결과가 아니다.

[DRAFT_COMPLETE]
