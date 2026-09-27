# CALENDAR_CONCISE_UX_IMPLEMENTATION_2026-09-27.md

- 작성일: 2026-09-27
- 상태: LOCAL_IMPLEMENTED_FOCUSED_TESTS_PASSED
- 기준 HEAD: `7ee3196282b72a31099790e2f5ae9768e88f2107` + 기존 미커밋 달력 작업 + 이번 개선
- 승인: 사용자의 "간결함은 중심으로 개선작업 진행해"
- 범위: 달력, 오늘 훈련 요약, 날짜 상세, 일지 작성 진입의 정보 위계와 탐색
- 배포 상태: 커밋·푸시·병합·배포하지 않음. 로컬 구현과 검증 기록이다.

## 1. 적용 원칙

기본 화면에서는 날짜, 훈련명, 수행 핵심 수치, 다음 행동을 먼저 제공한다. 반복되는 설명과 부가 정보는 필요할 때 펼친다. 글자를 무작정 줄이거나 모든 내용을 한 화면에 밀어 넣지 않는다.

선행 검토: [디자인 전문가 검토](CALENDAR_DESIGN_EXPERT_UX_REVIEW_2026-09-27.md).

## 2. 변경 내용과 검토 항목

| 항목 | 반영 내용 | 범위·주의 |
|---|---|---|
| D1 정보 위계 | 오늘 요약의 정상 상태 안내·미기록 문구·선택된 오전/오후 제목 중복 제거. 시간·강도 유지, 나머지 방법은 한 번 펼쳐 확인 | 정확한 거리·반복·회복으로 구성된 PACE_TARGET 요약은 그대로 표시. 저장 오류·안전 경고는 숨기지 않음 |
| D1 상세 | 목적 문단을 반복하지 않고 기존 `훈련 방법과 이유` 진입점으로 제공. `일지·진행 기록`을 수치 바로 아래 펼침 영역으로 이동 | 수행 방법·반복·회복·RPE 수치와 기존 이유·근거 화면 유지 |
| D1 탐색 | 활성 계획은 달력을 기본으로 제공하고 날짜별 스와이프 카드는 `날짜별 카드 보기`로 선택 | 일지에서 돌아온 세션은 해당 카드를 자동으로 열어 원래 위치를 복원 |
| D2 범위 | 주기 밖의 달에서는 `선택한 주기로 이동`, 계획 밖의 달에서는 `계획 시작일로` 제공 | 표시 월만 이동. 처방·주기 시작일·주기 길이를 변경하지 않음. 일지 합계는 `이 달`로 범위 명시 |
| D3 빈 날짜 | 일지 월간·주기 달력의 빈 과거/오늘 날짜에 `이날 일지 쓰기` 연결 | 미래 수행 일지 유도 없음. 계획 달력의 빈 날짜에는 이번에 별도의 일반 일지 작성 경로를 추가하지 않음 |
| D4 진행 | 활성 계획 달력에 명시적으로 남긴 완료·휴식·건너뜀·통증 확인 상태만 아이콘과 접근 가능한 이름으로 표시 | 일지 존재만으로 완료 추정 금지. 아직 기록하지 않은 상태를 실패나 0으로 치환하지 않음 |
| D5 실제 행동 | `오늘은 어려워요`를 `휴식·건너뜀 기록`으로 변경, 선택한 세션의 기존 진행 기록 영역을 열음 | 버튼을 누르는 것만으로 상태를 저장하거나 일정을 재배치하지 않음 |
| D6 날짜 칸 | `AM/PM + 주요/기초/회복/휴식`으로 압축. 전체 한글 의미는 날짜 버튼 이름과 범례에서 제공 | 큰 글자에서 줄바꿈 허용. 월 칸에 체중·통증 부위·메모를 추가하지 않음 |
| D7 오전·오후 | 현재 읽는 세션과 바로가기 밑줄·`aria-current=location` 연결 | 탭으로 가장하지 않으며 두 세션을 함께 유지 |
| D8 뒤로 | 주기 화면의 뒤로가기 이름을 실제 목적지인 `월간 달력으로`로 수정 | 월 이동과 주기 이동의 의미를 분리 |

## 3. 구현 중 발견하고 수정한 문제

1. 빈 날짜에서 작성 화면으로 이동한 뒤 브라우저 뒤로가기가 작성 화면에 머물렀다. 상세 창의 히스토리 항목을 작성 진입에 재사용하고, 같은 계정 범위에서 원래 달력 화면으로 돌아오게 수정했다. 입력 중 이탈 보호를 유지하며 히스토리에는 메모·기록 원문을 넣지 않는다. 수정 전 브라우저 테스트 실패, 수정 후 통과를 확인했다.
2. 카드가 처음부터 펼쳐진다고 가정하던 테스트 도우미가 새 화면의 로딩을 기다리지 않고 진행했다. 실제 `날짜별 카드 보기` 동작을 추가하고 활성 화면을 기다리게 수정했다. 검증 단언을 삭제하거나 건너뛰지 않았다.
3. 외부에서 전달한 상세 열기 요청은 한 번만 처리한다. 동일 계획 데이터가 새 객체로 갱신되어도 닫아 둔 상세 창을 다시 열지 않는다. 새 사용자 요청은 정상적으로 다시 연다.

## 4. 검증 결과

- 단위·컴포넌트: 9개 파일, **95/95 통과**. 기존 달력·일지·설명·화면 상태 검사와 새 회귀 검사 포함.
- 브라우저: 6개 파일, 12개 시나리오를 desktop-chromium / touch-narrow / reduced-motion에서 실행, **36/36 통과**.
- 마지막 요청 중복 처리 방지 보완 후: 닫기·재열기·오후 진행 연결 시나리오를 위 3개 환경에서 추가 실행, **3/3 통과**. 36개 전체를 다시 실행한 것으로 계산하지 않는다.
- TypeScript 앱 검사 및 e2e 타입 검사 통과. 최종 프로덕션 빌드 통과.
- Git diff 공백 검사 통과. 기존 작업은 그대로 보존했다.
- 브라우저 검증은 합성 기록으로 수행했다. 실제 계정·운영 서버 쓰기·기기 캘린더 연동 검증은 아니다.

검증한 주요 흐름:

- 오전·오후 선택, 상세 방법 펼치기, 휴식 기록 영역 열기, 닫기·재열기 중 계획 원본 불변
- 과거 날짜 작성 진입 시 날짜 보존, 브라우저 뒤로가기 시 원래 월 복귀
- 미래 빈 날짜에 실제 수행 기록 버튼이 나타나지 않음
- 계획 일지 빠른 작성·상세 작성·취소 후 DAY/오전·오후 복원
- 일지 저장이 계획 완료로 자동 처리되지 않음
- 계획 및 진행 상태 저장 실패 후 재시도
- 윤년 날짜와 키보드 이동, 원문 상세 뒤로가기, 삭제 후 달력 요약 갱신
- 320·375px, 상세 화면 200% 글자 확대, 줄인 모션에서 가로 넘침·내용 손실 검사

재현 명령은 `app/`에서 실행한다:

```powershell
.\node_modules\.bin\vitest.cmd run src/components/instant-plan/InstantPlanTodayView.test.tsx src/screens/plan-beta/PlanSchedulePreview.contract.test.tsx src/screens/plan-beta/ActivePlan.overview.contract.test.tsx src/screens/JournalArchive.contract.test.tsx src/components/CalendarJournalDetails.contract.test.tsx src/screens/plan-beta/SessionExplanation.contract.test.tsx src/screens/plan-beta/DatedPlanPanel.contract.test.tsx src/components/MonthCalendar.contract.test.tsx src/domain/app-shell-state.test.ts --maxWorkers=2
npm run typecheck:e2e
npm run build
$env:PLAYWRIGHT_EXTERNAL_SERVER='1'
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:4209'
.\node_modules\.bin\playwright.cmd test e2e/calendar-concise-flow.spec.ts e2e/plan-day-reader.spec.ts e2e/calendar-persona-regressions.spec.ts e2e/plan-journal-return.spec.ts e2e/plan-journal-linkage.spec.ts e2e/plan-save-retry.spec.ts --project=desktop-chromium --project=touch-narrow --project=reduced-motion --workers=2
```

## 5. 화면 증거와 판단

- [375px 계획 요약](evidence/calendar-concise-20260927/plan-375.png)
- [320px 계획 요약](evidence/calendar-concise-20260927/plan-320.png)
- [375px 날짜 상세](evidence/calendar-concise-20260927/reader-375.png)
- [200% 글자 날짜 상세](evidence/calendar-concise-20260927/reader-200-percent.png)
- [375px 배치 측정](evidence/calendar-concise-20260927/layout-375.json)

하루 두 번 계획의 375×667 표본에서 요약 하단은 약 385px, 월 달력 격자 시작은 약 585px였다. 요일 행이 첫 화면에 들어오지만 모든 날짜까지 무스크롤로 보이는 것은 아니다. 이전 검토의 표본과 입력 구성이 같지 않아 개선율로 환산하지 않는다. 기능을 숨기는 대신 주 작업과 긴 설명의 층을 분리한 결과로 평가한다.

장점: 기록 행동까지의 긴 스크롤을 줄이고, 월·주기·세션의 위치와 진행 상태를 구분한다. 단점: 간략 화면의 상세 방법이나 날짜 카드에는 한 번의 펼치기 동작이 추가된다. 정확한 페이스 처방과 안전 안내까지 접어 이 동작을 줄이지는 않았다.

## 6. 남겨 둔 범위

- PC의 달력/상세 2열 레이아웃은 앱 셸 전체를 바꾸는 별도 범위다.
- Google Calendar·iPhone Calendar 양방향 연동은 이번 UI 개선으로 구현된 것이 아니다.
- 계획 달력 빈 날짜에서 일반 일지를 새로 쓰는 경로는 미추가. 기존 계획 세션의 일지 연결과 일지 달력의 날짜별 작성은 가능하다.
- 운영 계정 데이터 왕복과 전체 e2e 스위트는 이번에 재실행하지 않았다. 계정용 전용 하니스와 적응형 전용 테스트는 카드 펼치기 경로만 갱신했으며 해당 전용 실행을 통과했다고 주장하지 않는다.
- 빌드에 기존 폰트 상대 경로, 동적/정적 import 혼용, 큰 청크 경고가 남는다. 이번 작업에서 해소했다고 주장하지 않는다.
- 이번 변경은 처방 알고리즘·안전 판단·스키마·스펙 승인 상태를 바꾸지 않는다. 작업트리는 이전 달력 개선과 함께 미커밋 상태이며, 배포된 서비스에 아직 반영하지 않았다.

[DRAFT_COMPLETE]
