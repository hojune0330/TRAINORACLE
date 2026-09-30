# 독립 공격 리뷰 D — 달력 접근성

```yaml
review: D-accessibility
status: SOURCE_REVIEW_COMPLETE
plan_status_at_review: PLANNING_INDEPENDENT_REVIEW_PENDING
scope: 지정된 달력·리더·포커스·모션 소스 대조
runtime_or_phone_test: NOT_RUN
wcag_conformance_claim: NONE
```

## 판정 경계

- 계획은 구현 전이며 정본 승격도 허용되지 않는다. 이 문서는 앱/스펙 승인이나 WCAG 적합 판정이 아니다. (`reports/plans/CALENDAR_GUIDED_CONTEXT_AND_MOTION_PLAN_2026-09-29.md:7-12, 286-295`)
- 적용 근거는 최상위 지침의 증거 경계와 UI 구속 기준이다. (`AGENTS.md:17-21, 64`; `PRODUCT_NORTH_STAR.md:3-10, 124-128`; `docs/UX_UI_VISUAL_STANDARD.md:202-225, 242-244`)
- 부모가 `375x667` baseline screenshot을 확보했다는 전달을 기록한다. 이번 리뷰에서는 이미지를 열어 확인하지 않았다. `320px + 200%` 재배치, 실제 보조기술 발화, 터치 좌표는 미검증이다.
- 실제 휴대전화 접근성 인증은 미실행이다. 자동/소스 점검을 인증으로 환산하지 않는다.
- P1: 정적 근거만으로 확정된 차단 결함 없음. P2는 핵심 사용 경로의 예상 실패 또는 구현 관문, P3는 플랫폼별 검증 공백이다. 아래 조건부 위험은 재현된 결함이 아니다.

## D01 화면읽기

방어: 달력은 제목·열 이름·날짜 버튼 이름·오늘(`aria-current`)·선택(`aria-selected`)을 제공한다. 셀 안의 시각 이벤트는 숨기되 `dayDescription`을 날짜 이름에 합친다. (`MonthCalendar.tsx:60-62, 90-116`)

1. **월 경계 이동 후 발화 중복/순서 — P2, 위험 확인 필요.** 날짜 버튼에 포커스 → `ArrowRight`/`Home`/`End`로 월 경계를 넘음 → 월 변경으로 `h3[aria-live=polite]`가 갱신되는 동시에 ref callback이 새 날짜 버튼으로 포커스 이동. 스크린리더가 월 제목과 새 날짜 이름을 중복·경합해 읽을 수 있다. 반대로 월 화살표를 누르면 포커스는 화살표에 남고 날짜 선택 위치는 별도 라이브 리전이 아니다. 단일하고 예측 가능한 발화 여부는 실제 SR 조합으로 확인해야 한다. (`MonthCalendar.tsx:45-58, 62, 100-110`)
2. **리더에서 날짜만 바뀌고 제목 발화는 보장되지 않음 — P2.** 날짜 리더 열기 → 이전/다음 날짜를 누름 → 같은 다이얼로그의 `h2`와 본문 날짜가 교체되지만 제목은 live region이 아니고 포커스는 누른 화살표에 남는다. 버튼 이름도 고정이어서 새 날짜를 자동으로 알지 못할 수 있다. 짧은 날짜 상태 알림과 제목/포커스 정책을 한 가지로 정하고 중복 발화를 피한다. (`PlanDayReader.tsx:60-68`; 포커스/스크롤 effect: `PlanDayReader.tsx:43-58`)

장점은 날짜명에 어댑터의 설명을 붙이고 원문을 셀에 자동 노출하지 않는 점이다. 단점은 “의미가 코드에 있다”는 사실만으로 선택 변경·날짜 이동의 실제 낭독을 증명할 수 없다는 점이다.

## D02 키보드만

방어: 한 날짜만 `tabIndex=0`이며 화살표/Home/End가 날짜를 옮기고, 경계를 넘으면 목표 월을 렌더한 뒤 목표 날짜에 포커스를 둔다. 월/날짜 입력 후 날짜 선택도 목표 날짜에 포커스를 보낸다. (`MonthCalendar.tsx:42-57, 78-88, 100-114`; 기존 계약 테스트는 경계 화살표와 날짜 점프 포커스를 확인하도록 작성됨: `MonthCalendar.contract.test.tsx:41-49, 59-68, 70-82`)

1. **딥링크 리더의 연속 자동 포커스 — P2.** 키보드로 `records` 구간이 지정된 리더를 엶 → `showModal()`이 dialog에 포커스를 두고 → 별도 effect가 기록을 펼치고 `summary`에 다시 포커스한다. 첫 안내/날짜 제목을 듣기 전에 포커스가 한 번 더 이동할 수 있다. 직접 요청된 구간으로 바로 진입하는 것과 dialog 제목을 먼저 알리는 정책을 명시하고, 실제 키보드/SR에서 한 번의 의도된 이동인지 확인한다. (`PlanDayReader.tsx:43-58`; dialog 개방: `useReaderDialog.ts:16-36`)
2. **닫기 뒤 시작점 소실 — P2, 조건부.** 달력 날짜로 리더를 엶 → 날짜/월 전환으로 시작 버튼이 DOM에서 교체되거나 화면을 떠난 상태에서 Escape/뒤로가기로 닫음 → hook은 연결된 opener에만 복귀하고, opener가 사라지면 선택적 fallback을 호출한다. `PlanDayReader`는 fallback을 전달하지 않는다. 달력 시작점이 바뀌는 경우 선택 날짜나 달력 제목에 복귀시키는 규칙이 필요하다. (`useReaderDialog.ts:18-20, 37-46`; 호출부 `PlanDayReader.tsx:22-26`)

장점은 native modal, Escape 처리, 스크롤 위치 복원, 연결된 opener 복귀가 이미 있다. 단점은 두 focus 이동과 opener 분리 시나리오가 계약 테스트에서 증명되지 않았다. 위 경계 이동 후 `Tab`/`Shift+Tab`, 모든 화살표/Home/End, 모달 닫기 복귀를 브라우저에서 확인해야 한다.

## D03 320px + 글자 200%

방어: 달력 셀은 7열 고정이지만 좁은 컨테이너에서 `7 * --app-touch-min + 8px`에 해당하는 약 316px 폭을 만들려는 음수 여백 계산이 있다. `--app-touch-min`은 44px이다. 이벤트 텍스트는 줄바꿈하고 툴바는 wrap 한다. (`colors_and_type.css:125`; `MonthCalendar.css:1-10, 11, 21, 28, 38-42`)

1. **7열 타깃 폭과 페이지 재배치 — P2, 실측 전 위험.** 320 CSS px에서 달력의 의도 폭은 약 316px, 열당 약 45px이다. 하지만 셀 버튼은 열 폭 100%이고 자체 최소 너비는 없다. 부모의 clipping/제약, 브라우저의 200% 텍스트 확대, 날짜 설명이 긴 계획 화면을 조합하면 타깃이 줄거나 달력이 뷰포트 밖으로 밀릴 수 있다. 375px screenshot으로 320px 동작을 추론하지 말고 viewport scroll width, 열별 실제 rect와 가장자리 타깃을 측정한다. (`MonthCalendar.css:1, 11, 21`; 계획 관문도 320px/200% 확인을 요구: 계획 `:157-162, 244-245`)
2. **리더의 확대 텍스트·세로 스크롤 — P3.** `320px`/200%에서 긴 날짜 제목과 세션 본문을 열고 탭 순회 → dialog는 전체 높이 고정, root `overflow:hidden`, 내부 body만 세로 스크롤이며 헤더는 374px 이하에서 wrap 한다. min-width/줄바꿈 방어는 있으나 focus indicator, 헤더 버튼, notice, 긴 세션과 하단 CTA가 서로 밀리거나 잘리지 않는지 실행 증거가 없다. (`plan-day-reader.css:1-19, 20-34, 44-54`)

장점은 7열 타깃을 보존하려는 명시적 계산과 세로형 reader다. 비용은 2D 달력의 폭을 지키는 전략이 좁은 부모에서 가로 overflow와 충돌할 수 있다는 점이다. baseline은 전달된 `375x667`로만 기록하며 320/200% 결과로 확대 해석하지 않는다.

## D04 모션멀미

방어: reader 진입 애니메이션은 `prefers-reduced-motion: no-preference`에 한정되고, 전역 reduced 규칙은 animation/transition/smooth scrolling을 끈다. reader의 슬롯 점프와 계획 날짜 스크롤도 OS 설정을 읽어 `auto`를 선택한다. (`plan-day-reader.css:55-58`; `app.css:2798-2805`; `PlanDayReader.tsx:27-32`; `PlanSchedulePreview.tsx:138-145`)

1. **OS 줄임 설정에서 달력→리더→슬롯 이동 — P3, 방어 확인/실행 미검증.** OS reduced-motion 켬 → 날짜 선택 → reader 열기 → 오전/오후 바로가기 사용. 코드상 reader 진입 애니메이션은 제외되고 스크롤은 `auto`여야 한다. OS 설정 변경 직후의 브라우저별 동작, 초점 이동과 화면 위치의 일치, 색/상태만으로 결과가 보이는지는 실제 확인이 필요하다. 현 소스는 이 경로에서 반복·무한 모션을 추가하지 않는다.
2. **OS 외 앱 내 동작 줄이기 약속과 JS 경로 — P2, 구현 인수조건.** 계획은 OS 우선 외에 앱 내 `동작 줄이기`도 접근 가능하게 둔다고 쓴다. 현재 해당 reader/계획 스크롤은 `matchMedia`만 확인하고, `screen-motion`은 화면 방향만 산출하며 사용자 설정을 받지 않는다. 앱 설정을 이 범위의 완료 조건으로 유지한다면 CSS와 JS 스크롤 양쪽에 같은 설정을 연결해야 한다. 그렇지 않으면 계획에서 OS 전용으로 범위를 명확히 해야 한다. (`계획:179-181`; `PlanDayReader.tsx:29-30`; `PlanSchedulePreview.tsx:139-145`; `screen-motion.ts:20-39`)

장점은 현재 OS 설정 경로가 CSS뿐 아니라 명시적 smooth scroll까지 고려하는 점이다. 단점은 소스 검토가 설정 토글 중 애니메이션 취소나 플랫폼 동작을 대신하지 못한다는 점이다.

## D05 터치 미세운동 어려움

방어: 툴바 버튼은 최소 44x44, 날짜 셀은 폭 100%/높이 최소 64px, month/date 입력도 최소 높이 44px다. 계획과 구속 UI 기준 모두 44px을 요구한다. (`MonthCalendar.css:5, 10, 21`; `docs/UX_UI_VISUAL_STANDARD.md:217-218`; 계획 `:157-162`)

1. **7열에서 날짜 오탭 — P2, 경계 실측 필요.** 320px 화면에서 작은 목표에 손 떨림을 더하고 인접 날짜를 빠르게 탭 → 셀의 실제 너비가 의도한 44px 이상인지, 가장자리 여백/테두리 때문에 목표가 겹치거나 잘리는지 확인한다. 높이 64px은 세로 여유일 뿐 너비를 보장하지 않는다. 음수 margin 계산은 316px 확보를 시도하지만 hit-area rect와 부모 clipping을 보장하지 않는다. (`MonthCalendar.css:1, 17, 21`; 7일 열 생성 `MonthCalendar.tsx:38-39, 90-99`)
2. **접혀 있는 날짜 점프와 200% 글자 — P3.** 월 제목 토글을 탭해 조건부 날짜/월 입력을 열고 날짜를 고름 → toggle은 44px이고 `aria-expanded`는 있으나 panel은 닫힐 때 DOM에 없고, 열렸을 때 입력은 2열 `minmax(0,1fr)`이며 폭 최소값은 없다. 숨겨진 것 자체가 결함은 아니지만 magnification에서 라벨/네이티브 picker가 조밀해지거나 오탭되지 않는지, 닫은 뒤 선택 날짜로 예상대로 돌아가는지 확인해야 한다. (`MonthCalendar.tsx:62, 78-89`; `MonthCalendar.css:8-10`)

장점은 작은 시각 아이콘에도 큰 버튼 상자를 주고 날짜 버튼의 세로 여유를 유지한다는 점이다. 단점은 44px 계약이 실제 달력 셀의 너비·간격·viewport 경계까지 자동으로 보증하지 않는다는 점이다.

## 종료 조건

위 P2 항목을 결함 확정으로 오인하지 말고 구현 후 우선 검증한다. 최소 관문은 320px/200% viewport 및 target rect, 키보드 전 경계키/모달 복귀, 날짜 변경의 SR 발화, OS reduced-motion에서 dialog/스크롤이다. 이 소스 리뷰에서는 앱을 실행하지 않았고, 실제 휴대전화 접근성 인증도 수행하지 않았다. **WCAG 통과를 주장하지 않는다.**

[DRAFT_COMPLETE]
