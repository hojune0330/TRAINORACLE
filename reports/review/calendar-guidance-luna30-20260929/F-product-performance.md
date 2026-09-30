# 독립 공격 리뷰 F: 달력 안내·반응성·성능

검토일: 2026-09-29  
대상: CALENDAR_GUIDED_CONTEXT_AND_MOTION_PLAN_2026-09-29 v0.1  
판정: **조건부 진행.** 최근 맥락, 화면별 날짜 정책, 예시의 쓰기 금지, 동작 감소 원칙은 좋은 출발이다. 다만 구현 착수 전에 375px 이중 달력 노출, 준비 중 상태와 실제 빈 상태의 구분, 소유자별 데이터 인덱스/렌더 비용을 구체화해야 한다. 구현 거절이 아니라, 아래 선행 관문을 A단계에 반영하라는 판정이다.

## 검토 범위와 증거 경계

- AGENTS.md, PRODUCT_NORTH_STAR.md, docs/UX_UI_VISUAL_STANDARD.md, 지정된 계획 및 달력·일지·계획 소스를 읽었다.
- 다섯 모델 관점의 시나리오 공격이다. 실제 사용자 시험이나 30명 검증으로 읽으면 안 된다.
- 앱 브라우저 실행, 전체 앱 성능 측정, 저사양 실기기 측정은 하지 않았다. 성능 수치는 코드의 반복 횟수로 계산한 상한 추정이며 실제 지연·FPS가 아니다.
- 개인 일지 데이터, 메모 금고, 계정 자료에는 접근하지 않았다. 소스 코드만 읽었다.
- 변경은 이 보고서뿐이다. 앱 및 스펙은 수정하지 않았다.

## 우선 발견

### F-01 · 375px에서 실제 달력과 예시 달력을 연속 배치하면 핵심 행동이 접힐 수 있음 · P0

계획 §3.3은 작은 실제 빈 달력 아래에 실제 크기의 예시 달력을 둔다. 현재 MonthCalendar 셀 버튼은 최소 높이 64px이고 달은 4~6주, 대개 5~6주 그리드다. 두 달력을 각각 전부 렌더하면 셀 높이만으로 첫 달력이 256~384px, 둘째도 같은 높이가 될 수 있다. 375×667 기준에서 월 툴바·요일·상단 내비게이션·요약·주요 행동을 더하기 전부터 세로 공간을 크게 쓴다. 사용자가 알려준 “기본 달력 하나로 거의 화면 가득”이라는 관찰과 일치하는 구조적 위험이다. 새 미니 달력에 별도 축소 CSS를 붙이면 터치 44px 기준을 깨기 쉽다.

근거: app/src/components/MonthCalendar.css:21, app/src/domain/journal-calendar.ts:31, app/src/screens/JournalArchive.tsx:162-173, 계획 §3.3·§6.1. 화면 캡처나 실제 375px 렌더 측정은 아직 없다.

**대안:** 검증된 빈 상태에서는 달력 그리드를 하나만 둔다. 동일 그리드 안의 분할 선택으로 “내 달력”과 “예시 보기”를 바꾸거나, 7일짜리 한 줄 체험으로 시작한다. 예시 모드에서도 44px 터치 영역을 유지하고 “예시 · 내 기록 아님”을 제목, 선택 날짜 요약, 스크린리더 이름에 고정한다. 이는 놀이성을 없애지 않고 중복 그리드만 없앤다. 선택한 예시는 즉시 요약에 나타나고, 실제 행동 “첫 기록 남기기”는 분명히 분리한다.

### F-02 · 빈 배열만으로는 “실제 기록 없음”을 증명할 수 없음 · P0

계획은 LOADING/STALE/ERROR/계정 전환 때 빈 상태나 예시를 보여주지 말라고 한다. 하지만 useCalendarEntries는 구독 이벤트 후 매 렌더 loadEntries()를 반환하는 배열 API다. 준비 상태나 오류 상태를 호출 화면에 넘기지 않는다. JournalArchive는 집계 월이 0개면 빈 안내를 렌더한다. 이 계약 그대로 예시를 연결하면 “계정 전환 중”, “복구 불확실”, “아직 로드되지 않음”이 “진짜 빈 계정”으로 오인될 수 있다.

근거: app/src/hooks/useCalendarEntries.ts:7-23, app/src/domain/journal-store.ts:70-75·111-119, app/src/screens/JournalArchive.tsx:165-173, 계획 §5·§10.1.

**대안:** 렌더 입력을 단순 배열이 아니라 상태가 있는 읽기 결과로 만든다. 예: LOADING / READY / STALE / ERROR와 활성 소유자 epoch·데이터 revision을 함께 전달한다. EMPTY는 현재 소유자의 읽기가 확인된 READY에서만 계산한다. 계정이 바뀌면 이전 인덱스·선택일·리더를 동기적으로 버리고 새 epoch가 준비되기 전에는 예시도 잠근다. 기다린 시간으로 READY를 추측하지 않는다.

### F-03 · 일지 1만 건에서 보이는 달력 날짜마다 전체 배열을 다시 검색함 · P1, 10k 경로 구현 전 선행

공용 월 그리드는 최대 42셀이다. MonthCalendar는 각 셀의 aria-label을 만들 때 dayDescription을 한 번 호출하고, 결과가 참이면 같은 함수를 한 번 더 호출한다. 계획 달력의 설명과 배지는 각각 CalendarJournalDetails의 entries.filter를 부른다. PlanSchedulePreview에서 한 렌더의 날짜별 설명은 최대 84회, 배지는 42회 전체 배열을 훑을 수 있다. 10,000개 배열이면 달력 콜백만으로 대략 840,000~1,260,000개의 배열 원소 방문 상한이 나온다. 여기에 조건별 날짜 필터 내부 작업, 데이터 로딩·파싱, 계획 집계는 포함하지 않았다. 따라서 실제 시간이나 버벅임의 측정값으로 인용하면 안 된다.

근거: app/src/components/MonthCalendar.tsx:98, app/src/domain/journal-calendar.ts:31, app/src/components/CalendarJournalDetails.tsx:13-24, app/src/screens/plan-beta/PlanSchedulePreview.tsx:504-519; 동일 패턴은 DatedPlanPanel.tsx:47-50에도 있다.

**대안:** owner epoch + revision 단위로 날짜별 달력 요약을 한 번 만든다. 각 날짜에는 이벤트 수·종류·경기 표시 등 화면에 필요한 작은 집계만 두고, 35~42셀 조회는 O(1) Map 조회로 만든다. 원문·통증 세부는 리더를 명시적으로 연 뒤 선택 날짜에서만 읽는다. MonthCalendar는 dayDescription을 로컬 변수에 한 번만 평가한다. 비용 기준은 “한 revision당 인덱스 1회, 셀당 조회 O(1)”로 코드와 synthetic 10k 테스트에서 검증한다.

### F-04 · useMemo가 있어도 매 렌더 전체 로드·투영 비용이 반복될 수 있음 · P1

useCalendarEntries는 render 중 loadEntries()를 호출한다. loadEntries는 소유 계정 projection과 로컬 snapshot을 합쳐 새 배열을 반환하며, snapshot 경로는 localStorage를 읽고 JSON.parse한다. 따라서 선택일 변경 등 같은 컴포넌트의 보통 상태 갱신만으로도 새 entries 참조와 저장 데이터 재파싱이 발생할 수 있다. 일지 탭도 AppShell이 render 중 loadEntries()를 JournalArchive prop으로 직접 전달한다. JournalArchive의 useMemo([entries])는 새 참조를 받을 때 무효화되어 projectJournalArchive의 전 레코드 eligibleValues 집계를 다시 한다. Cycle 모드에서는 JournalArchive와 CycleArchive 양쪽에 projectJournalArchive가 있고, 최근 훈련 조건의 some/filter도 별도 순회다. 이 효과는 측정된 시간이 아니라 의존성·호출 구조에서 확인한 반복 위험이다.

근거: app/src/hooks/useCalendarEntries.ts:23, app/src/domain/journal-store.ts:70-75·111-119, app/src/AppShell.tsx:626-632, app/src/screens/JournalArchive.tsx:60·127-128·137, app/src/domain/journal-archive.ts:201-230, app/src/screens/CycleArchive.tsx:32·49.

**대안:** 저장소 변경 이벤트가 만든 안정된 snapshot/revision을 구독해, 화면 render마다 동기 로드·JSON parse를 하지 않는다. 프로젝트된 Archive와 date index도 그 revision에 묶고 JournalArchive와 CycleArchive가 공유한다. 계정 epoch가 바뀌면 캐시를 폐기해 교차 계정 재사용을 막는다. React.memo만 추가하고 매 렌더 새 배열·새 callback을 주는 식의 얕은 최적화는 해결로 인정하지 않는다.

## 다섯 관점 공격

### F01 · 게임을 좋아하는 중학생

**공격 A — 예시가 내 기록처럼 보이는 순간**

순서: 375px에서 들어옴 → 진짜 빈 달력 바로 아래 별도 예시 달력을 발견함 → “쉬는 날” 칸을 누르고 완료/저장된 기록이라고 이해함 → 화면을 떠나 실제 기록이 생겼는지 확인할 수 없음.

보존할 장점: 가상 기록을 눌러 날짜와 요약을 직접 탐색할 수 있으면 첫 사용의 발견성과 재미가 생긴다. 취약점: 두 달력의 형태와 이벤트 칩이 같으면 ‘예시’가 스크롤이나 선택 후 사라지는 순간 출처가 흐려진다. 실제 훈련의 휴식, 기록으로 남긴 휴식, 가상 예시는 서로 다른 사실이다.

실행안: 두 개의 달력을 쌓지 말고 한 그리드에서 “내 달력 / 예시”를 전환한다. 예시 날짜 선택은 즉시 반응하되 고정된 예시 배지와 예시용 상세만 보여준다. demo 데이터 타입에는 저장·계획 완료·포인트 callback을 전달하지 않는다. 소소한 수집/발견감은 고정된 세 샘플을 넘겨 보는 것으로 주고, 실제 기록·성취로 오인될 점수·연속일은 만들지 않는다. **우선순위 P0: 상태·공간, P2: 상호작용.** 근거: 계획 §3.3; IntakeCalendarPeek의 이미 좋은 상시 예시 문구 app/src/screens/plan-beta/IntakeCalendarPeek.tsx:59-68.

**공격 B — 연속 탭이 애니메이션을 기다리게 함**

순서: 날짜를 빠르게 두 번 누름 → 첫 전환이 끝나기 전 다음 달로 이동 → 늦은 콜백이 처음 날짜를 선택하거나 포커스를 되돌림 → 반응이 늦거나 조작이 먹지 않은 것으로 판단.

보존할 장점: 누른 칸이 즉시 선택되고 짧은 시각 반응이 있으면 달력이 게임처럼 응답한다. 취약점: 애니메이션을 상태 변경의 선행 조건으로 만들거나 입력마다 전환을 큐에 넣으면 재미가 아니라 지연이 된다.

실행안: 선택 상태는 입력 즉시 확정하고 transition은 취소 가능한 장식으로 둔다. 마지막 입력만 유효하게 하며 200~350ms, 8px 이내 전환을 기존 모션 helper로 구현한다. OS/app reduced-motion에서도 같은 선택 결과를 즉시 보여준다. **우선순위 P2.** 근거: UX_UI_VISUAL_STANDARD.md §7; 계획 §6.2-6.3.

### F02 · 효율을 중시하는 엘리트 선수

**공격 A — 1만 건에서 “가장 최근”을 찾으려다 달력이 먼저 느려짐**

순서: 기록 1만 건을 가진 선수가 활성 계획 달력을 엶 → 각 월 셀의 계획·실제 일지 설명과 마커가 실행됨 → 다른 날짜나 월로 이동해 다시 렌더 → 빠른 기록 확인보다 대기·스크롤 비용이 커짐.

보존할 장점: 최근 실제 기록으로 첫 위치를 잡으면 빈 현재 월에서 몇 달을 넘기는 일을 줄인다. 취약점: 기본 위치의 이득이 per-cell filter와 반복 저장소 parse에 묻힐 수 있다. 이전 절의 0.84~1.26M은 콜백 배열 방문 상한일 뿐, 기기 지연 측정은 아니다.

실행안: 저장소 revision 시 한 번만 날짜 index와 최근 eligible date를 계산하고, 계획 화면은 그 index의 요약만 O(1) 조회한다. 사용자 탭/키보드 탐색 후 데이터가 갱신되어도 위치를 탈취하지 않고 “새 기록 1개 보기”처럼 명시적 이동을 제공한다. **우선순위 P1 선행, 저사양 실측은 후속 관문.** 근거: app/src/screens/plan-beta/PlanSchedulePreview.tsx:504-519, useCalendarEntries.ts:23, journal-store.ts:70-75·116-118.

**공격 B — 최근 일지 후보의 날짜 정의가 엇나감**

순서: 오래된 실제 운동을 오늘 수정해 savedAt이 최신이 됨 → 미래 날짜 오입력/미검토 가져오기도 존재함 → 화면이 수정일 또는 배열 마지막 값으로 점프함 → 선수는 방금 한 훈련이나 현재 계획을 찾지 못함.

보존할 장점: 계획의 오늘/첫 일정/마지막 일정 우선과 일지의 entry.date 우선순위가 분리되어 있다. 취약점: resolver를 일반화하면서 page policy를 지우거나 새 데이터 수신 때 매번 재적용하면 계약이 무너진다.

실행안: 최신 eligible entry.date ≤ local today를 일지에만 적용하고 savedAt, 미래, 휴지통, 타 계정, 미승인 가져오기는 자동 위치에서 제외한다. 수동 탐색·리더 열기 뒤 자동 위치 토큰을 소비하고, 데이터가 오면 비탈취형 안내를 낸다. 삭제된 최근 날짜는 묵묵히 과거 날짜로 바꾸지 말고 “이 날짜에 기록 없음 / 이전 기록 보기”로 선택권을 준다. **우선순위 P0: 정책 및 token 시험.** 근거: 계획 §4.1-4.2; 현재 사용자 선택과 reader state는 app/src/screens/JournalMonthCalendar.tsx:18-23·63-66에 분리되어 있다.

### F03 · 계획만 사용하는 사람

**공격 A — 복귀 세션 포커스가 최근 일지 위치에 밀림**

순서: 계획 세션의 “훈련과 일지로 돌아가기”로 특정 DAY/AM에 진입 → 공통 calendar resolver가 최근 journal 날짜를 초기 위치로 적용 → 사용자는 요청한 계획 슬롯 대신 다른 날짜를 봄.

보존할 장점: 계획 달력은 최근 운동일이 아니라 오늘/시작/끝 및 명시 세션을 우선하도록 계획에 적혀 있다. 취약점: PlanSchedulePreview에는 초기 날짜 state, 시작일 변경 effect, readerRequest effect가 이미 별도로 존재하므로 공통 자동 이동 effect를 무심코 추가하면 두 소유자가 경쟁한다.

실행안: 탐색 context를 owner + 화면 policy + plan ID + navigation sequence로 scope한다. 명시 세션 요청은 가장 높은 우선순위로 한 번 소비하고, JOURNAL resolver를 ACTIVE_PLAN·PLAN_CANDIDATE·INTAKE_PREVIEW에 호출하지 않는다. 예: focusSession/readerRequest/수동 선택이 월 변경·동기화보다 우선하는 reducer transition 표를 테스트한다. **우선순위 P0.** 근거: app/src/screens/plan-beta/PlanSchedulePreview.tsx:97-126·158; 계획 §4.1·§5.

**공격 B — 입력 미리보기를 실제 생성 계획으로 기억함**

순서: 날짜·운동 가능일을 입력함 → 균등 배치된 Intake 미리보기 칸을 봄 → 다음 화면에서 실제 생성 일정의 배치가 다름 → 입력 미리보기의 가정을 계획 약속으로 기억함.

보존할 장점: 기존 IntakeCalendarPeek은 “예시”, “아직 계획 아님”, 생성 후 실제 날짜 확인을 이미 분명히 말한다. 취약점: 새 빈 달력 데모를 추가하면서 Intake 예시와 합치면 둘 다 같은 종류의 가상·실제 일정처럼 보인다. 실제 생성기와 미리보기 분포는 다르다고 소스 주석이 밝힌다.

실행안: 빈 일지 데모, 입력 미리보기, 확정된 계획을 서로 다른 data source/state로 유지한다. 입력 미리보기는 “훈련일 배치 예시 · 아직 계획 아님”을 현재처럼 보존하고, 생성 후에는 실제 schedule source로 완전히 교체한다. 날짜·색·선택값을 계획 저장으로 복사하지 않는다. **우선순위 P1.** 근거: app/src/screens/plan-beta/IntakeCalendarPeek.tsx:23-30·43·59-68.

### F04 · 기록 1만 건 + 저사양 기기

**공격 A — 달력 한 번 렌더에 날짜별 O(N) 검색이 쌓임**

순서: 10,000개 합성 기록이 준비된 상태로 활성 계획 달력 진입 → 42셀에서 description 최대 84회와 badge 42회가 전체 배열을 검색 → 스크롤/선택/상태 변화로 다시 렌더 → 기기 사양에 따라 긴 task, 배터리 낭비, 입력 지연 가능성이 생김.

보존할 장점: 달력에는 날짜별 종류 요약만 필요해 원문을 셀마다 읽을 이유가 없다. 취약점: 두 helper가 원본 배열을 받기 때문에 데이터 양이 셀 수에 곱해진다. 실제 발생 시간은 측정되지 않았다.

실행안: dateIndex를 helper 인자로 주고 배열 filter를 없앤다. dayDescription은 한 번 평가한다. 10k 합성 데이터를 sparse·dense·같은 날 다량 기록 세 경우로 돌려 인덱스 build 수, 월 render 횟수, 이벤트당 lookup 수를 단언한다. **우선순위 P1, 전 앱 측정은 별도 후속 gate.** 근거: PlanSchedulePreview.tsx:504-519; CalendarJournalDetails.tsx:14·24; MonthCalendar.tsx:98; journal-calendar.ts:31.

**공격 B — Calendar UI의 작은 state 변경이 저장소 전체 재처리로 번짐**

순서: 달력 선택/모드 탭/reader 토글 → hook render에서 loadEntries 재실행 → 10k localStorage snapshot parse 및 새 배열 → archive projection 재실행 → 주기 모드에서 projection과 범위 검색이 또 실행.

보존할 장점: 기존 Archive projection은 날짜·주·월 요약을 재사용하기 좋은 한 곳의 계산 결과로 제공한다. 취약점: 매번 새 참조를 만든 뒤 useMemo에 넣으면 안정된 dependency가 아니다. JournalArchive와 CycleArchive가 같은 집계를 별도로 소유한다.

실행안: store revision이 바뀔 때만 snapshot을 만들고 기존 local-journal scope 이벤트로 갱신한다. immutable reference와 account epoch를 보존하고 archive/index를 같은 revision에서 공유한다. 최근 훈련 존재/개수도 한 projection에서 얻어 별도 some+filter를 지운다. **우선순위 P1; 계정 격리 회귀시험은 P0 품질 관문.** 근거: useCalendarEntries.ts:7-23; journal-store.ts:70-75·111-119; JournalArchive.tsx:60·127-128; CycleArchive.tsx:32·49; journal-archive.ts:201-230.

### F05 · 통증 후 복귀, 기록 압박에 민감한 선수

**공격 A — 날짜를 고르는 동작이 통증 상세 열기로 이어짐**

순서: 마지막에 남긴 통증 포함 일지가 자동 선택됨 → 날짜를 눌러 선택/확인하려 했으나 현재 adapter는 즉시 큰 reader를 엶 → 통증 부위·정도가 펼쳐짐 → 사용자가 예상하지 않은 노출로 느낄 수 있음.

보존할 장점: 첫 화면에서 메모·통증을 자동 펼치지 않고, 최근 실제 기록으로 복귀를 돕는 방향은 신뢰에 맞는다. 취약점: 계획은 “선택일 요약 + 기록 보기 버튼”과 “날짜 클릭은 큰 리더 열기”를 함께 적어 입력 의미가 모호하다. 기존 CalendarJournalDetails는 열린 뒤 통증 수치를 표시한다.

실행안: 처음 들어올 때 최근 날짜를 선택만 하고 reader를 열지 않는다. 사용자가 날짜를 고르면 한 줄의 중립 요약만 바꾸고, 세부는 명명된 “이날 기록 보기”로 연다. 오늘/최근 기록 이동과 세부 노출은 별도 명령으로 둔다. 기밀/건강 원문·통증 정보는 모션 퇴장 중 남기지 않는다. **우선순위 P0 의미 명확화, P1 검증.** 근거: JournalMonthCalendar.tsx:23·63-66; CalendarJournalDetails.tsx:104; 계획 §3.1·§4.2.

**공격 B — 공백을 실패로, 예시 휴식을 의학적 조언으로 읽음**

순서: 통증 때문에 훈련과 기록을 쉬는 중임 → 달력에 기록 없는 날짜가 이어짐 → 예시의 “쉬는 날 기록”과 실제 계획 휴식을 구별하지 못함 → 기록을 채우거나 복귀를 서둘러야 한다는 압박을 느낌.

보존할 장점: 계획은 streak·운동량 경쟁·가짜 향상·포인트를 거부하고 쉰 날도 중립적으로 다룬다. 취약점: 훈련 3일 예시의 대비가 “비어 있는 실제 달력”을 실패처럼 보이게 만들면 문구만으로 압박을 막지 못한다. “오늘 기록하기”가 통증 복귀 CTA와 인접해도 혼동될 수 있다.

실행안: 실제 “기록 없음”, 계획상 “휴식”, 일지로 남긴 “쉰 날”, 가상 “예시”를 시각·접근성 이름에서 분리한다. 예시에는 통증 호전/회복 완료/부상 판정 서사를 넣지 않는다. “기록하지 않아도 괜찮아요”를 공백 상태에 두고, 기록 작성은 제안이지 완료 의무가 아니게 한다. 재미는 날짜를 눌러 샘플을 발견하고 이야기를 바꾸는 데서 얻고, streak·점수는 쓰지 않는다. **우선순위 P0 의미·예시 격리, P2 미세 반응.** 근거: 계획 §3.3·§6.2·§8; GuidedEmptyState 연결 JournalArchive.tsx:165-173.

## 실행 우선순위

1. **P0 — 의미·상태·소유 경계:** READY가 확인된 진짜 빈 상태만 빈 상태로 취급한다. owner epoch와 page policy를 탐색 scope에 넣는다. 날짜 선택과 세부 열기를 구별하고, 최근 위치 자동 적용은 첫 진입 한 번으로 제한한다. 예시는 별도 데이터 타입/화면 source로 격리하고 write/progress/points 경로를 연결하지 않는다. 두 full calendar를 연속 노출하지 않는 375px IA를 먼저 선택한다.
2. **P1 — 성능 구조를 A단계에 당김:** 저장소 안정 snapshot/revision → 공유 archive projection + 날짜별 요약 index → O(1) 셀 조회 순서로 구축한다. 매 render 동기 parse, 셀마다 entries.filter, cycle 중복 projection을 남긴 채 CSS나 React.memo로 덮지 않는다. MonthCalendar 설명 함수 중복 호출도 제거한다.
3. **P2 — 즐거움/반응성:** 한 달력 표면에서 sample 날짜를 탐색하고 즉시 요약을 바꾼다. 선택 칸 색/테두리와 짧은 opacity·작은 이동으로 누른 곳에 반응한다. 최근 일지/오늘은 명확한 직접 이동 버튼, 수동 이동 뒤에는 새 기록 안내를 제공한다. 도메인 안전은 그대로 두면서 발견감과 피드백을 키울 수 있다.
4. **P3 — 구현 뒤 후속 성능·화면 관문:** 전체 앱 측정은 현재 미실행이며 별도 후속 관문이다. 1k/10k 합성 sparse·dense 기록으로 cold load, warm rerender, month change, select, back을 CPU throttle 환경에서 측정한다. 브라우저 375×667 실제 화면에서 첫 화면과 다음 행동이 보이는지, 가로 넘침·터치 겹침·키보드·200% 글자 확대·reduced-motion을 검수한다. input-to-paint, long task, render 횟수/시간을 실제로 기록하고 목표치는 대상 기기 기준을 정한 뒤 설정한다. 이 보고서는 60fps나 앱 전체 성능을 주장하지 않는다.

## 종합

“Roblox처럼”을 3D·보상·경쟁이 아니라 즉시 반응, 탐색, 발견, 상태의 명료함으로 번역한 방향은 유지할 만하다. 다만 지금 초안의 예시 달력은 375px 세로 공간과 겹치고, 현재 배열 기반 helper를 그대로 연결하면 1만 건 경로가 셀 수에 비례해 전체 기록을 반복 검색한다. **한 그리드의 예시 전환 + 소유자별 안정 인덱스 + 데이터 준비 상태 분리 + 선택과 상세 열기의 명시적 분리**를 선행하면 간결함·신뢰·안전·효율을 지키면서도 충분히 즐겁고 살아 있는 탐색을 만들 수 있다.

[DRAFT_COMPLETE]
