# 독립 제품·UX·콘텐츠·스펙 감사: 20개 관점

작성일: 2026-09-30. Task C. 최초 확인 기준 `9085282`, 직전 런타임 `8b80fa1`.
파일명의 PERSONA_100은 공동 감사 묶음 이름이다. 이 문서는 **20개 합성 시나리오 관점**이며 100명 조사나 100회 실행 결과가 아니다.

**종료 판정:** F01/F02/F04/F05/F06은 부모 수정 후 같은 합성 조건의 좁은 실제 브라우저 재시험에서 해소됐다. F03 활성 계획 편집 공백과 F07/F08 선택적 기록의 마찰은 남는다. §1~§8의 재현·위험 판정·중간 검토를 삭제하지 않고 보존하며, 수정 후 현재 상태와 최종 파일/줄은 **§9 부록**을 따른다. 이전 위치의 링크는 당시 소스 위치를 기록한 것이다.

## 1. 우선 발견 사항

**이 감사에서 P0를 입증하지 않았다. P1은 실제 안내의 불일치, 보호 범위 누락, 승인된 제품 경험과 현재 경로의 공백이다. 임상적 위해 발생이나 계정 데이터 유출을 입증했다는 뜻이 아니다.**

| ID | 우선순위 | 발견 사항 | 증거 수준 | 최종 확인 상태 |
|---|---|---|---|---|
| F01 | P1 | 계산된 반복·회복을 오늘 화면에서 미정이라고 안내 | 실제 앱 재현 + 코드 | 부모 수정 후 좁은 재현 해소, §9 |
| F02 | P1 | 계산형 본운동 표기를 준비·정리 포함 총시간처럼 표시 | 실제 앱 재현 + 코드 + 기존 계산 결과 | 부모 수정 후 좁은 재현 해소, §9 |
| F03 | P1 | 저장 전 후보 교체와 저장 후 활성 계획 편집이 연결되지 않음 | 경로 재현 + 코드; 기대 불일치의 영향은 추론 | 제품 공백 유지, 문구는 저장 전으로 한정 |
| F04 | P1 | 후보 날짜 상세와 전체 훈련 내용에서 실제 처방 숫자 누락 | 실제 후보 날짜 상세 재현 + 코드 | 부모 수정 후 좁은 재현 해소, §9 |
| F05 | P1 | 새 이탈 가드가 최초 폼의 제출 전 입력을 보호하지 않음 | 패치 후 실제 탭 왕복 재현 + 이벤트 확인 | 부모 수정 후 취소/명시적 버리기 재확인, §9 |
| F06 | P1 | 계획 다듬기의 '강도는 그대로'가 실제 재생성과 불일치 | 문구 재현 + 2개 합성 생성 결과 비교 | 부모 수정 후 문구 실제 확인, §9 |
| F07 | P2 | 선택적 구간 기록이 운동·회복 두 행씩 18페이지로 분절됨 | 실제 연결 일지 재현 + 35구간 계산 결과 | 남음, 필수 입력 아님 |
| F08 | P2 | 연결 일지에서 원래 훈련명·본운동 목표 맥락이 빠짐 | 실제 빠른 기록 진입·구간 편집 재현 + 코드 | 남음 |
| S01 | P2 후보 | 구간 입력 범위 위반 시 이유 없이 이전 값으로 되돌리는 코드 | 정적 확인만, 잘못된 값 입력 미실행 | 재현 전 확정 결함으로 세지 않음 |
| R01 | P2 | 시작·일정 변경 CTA가 월 달력 아래에 있음 | 최초 화면 재현; 패치 후 재확인 | 주 작업자 수정 후 좁은 재현 해소 |
| R02 | P2 | 시간 합계의 원시 부동소수점 노출 | 최초 화면 재현; 패치 후 재확인 | 주 작업자 수정 후 좁은 재현 해소 |

### F01. 반복과 회복이 있는데 '정해지지 않았다'고 안내

- 정확한 위치: [instant-plan-today.ts:38](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/screens/plan-beta/instant-plan-today.ts:38>). `QUALITY + RPE_TIME_RANGE`이면 계산형 카탈로그 존재 여부와 관계없이 미정 안내를 붙인다.
- 재현: 기록 없이 5000m, 경험자, 9일 중 3일, 몸 상태 이상 없음으로 후보 생성. 훈련 종류를 VO2로 바꾸고 저장한 합성 계획의 5일차에 진입했다. `15/15 인터벌`과 `3 sets × (6 × 15s ... r15s ... R3min ...)` 바로 위에 반복·회복이 정해지지 않았다고 표시됐다. [화면](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/.scratch/persona-100-ux/followup-07-quality-today.png>), [텍스트](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/.scratch/persona-100-ux/followup-07-quality-today.json>).
- 영향: 상세 숫자를 따라야 하는지, 총시간만 채우면 되는지 서로 다른 안내를 준다. 실제 사용자의 오해나 수행 실패는 측정하지 않았다.
- 최소 수정: 검증된 계산형 구조에는 이 범용 미정 안내를 붙이지 않는다. 카탈로그 없는 범용 QUALITY의 안내는 유지한다. 단순히 모든 안전 안내를 삭제하면 안 된다.
- 근거: `SESSION_METHOD_SELECTION_AND_ADJUSTMENT_CONTRACT` §21.56의 실제 숫자·원본 구간·공통 표시 원칙. 숫자나 반복량 변경이 필요하지 않다.

### F02. 본운동 표기를 '총 시간·강도'로 잘못 묶음

- 정확한 위치: [instant-plan-today.ts:53](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/screens/plan-beta/instant-plan-today.ts:53>), [workout-notation.ts:133](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/domain/workout-notation.ts:133>). 계산형의 `prescriptionLabel`은 본운동 구조를 반환하지만 상위 투영은 여전히 총시간 라벨을 사용한다.
- 재현: F01과 같은 저장본에서 오늘 첫 줄은 총시간이라는 이름으로 15/15의 본운동만 보여준다. 방법 상세의 준비·회복·정리 포함 총시간은 **43분 35초(2615초)**다. 본운동과 그 회복은 **14분 15초**다. 이는 기존 저장본 계산값과 `18×15 + 15×15 + 2×180 = 855초`를 대조한 값이며 새로운 처방 제안이 아니다. [상세 화면](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/.scratch/persona-100-ux/followup-10-method-reader.png>), [계산 확인](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/.scratch/persona-100-ux/micro-probes.json>).
- 영향: 준비·정리를 합친 전체 예정시간과 본운동 노출을 혼동한다. 특히 수업·출근 사이 전체 시간을 판단하는 관점에 중요하다.
- 최소 수정: 검증된 계산형은 첫 표기의 라벨을 본운동으로 맞추고, 필요한 전체 예정시간은 이미 계산된 총시간에서 읽는다. 카탈로그 없는 범용 시간 범위는 계속 전체 예정시간으로 표시한다. 총시간을 본운동에 재할당하거나 지원 구간을 삭제하지 않는다.

### F03. 활성 계획의 일반 카탈로그 편집은 후보 전용

- 정확한 최종 위치: [PlanBeta.tsx:692](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/screens/PlanBeta.tsx:692>)의 `stored !== null` 분기와 [PlanBeta.tsx:795](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/screens/PlanBeta.tsx:795>)의 후보 `onCatalogChange`. 활성 경로는 [ActivePlan.tsx:219](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/screens/plan-beta/ActivePlan.tsx:219>), [ActivePlan.tsx:355](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/screens/plan-beta/ActivePlan.tsx:355>).
- 재현: 저장 전 후보에는 다른 훈련 선택기가 있었다. 저장 후 오늘·날짜 리더·방법 상세에는 방법, 일지, 휴식/건너뜀 및 진행 표시가 있고 일반 카탈로그 교체 진입점은 없다. [저장 후 화면](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/.scratch/persona-100-ux/followup-09-day-reader.png>). 소스에서도 일반 저장본에 후보 교체 콜백을 전달하지 않는다.
- 구분: 이는 '모든 계획 변경이 없다'는 발견이 아니다. [execution-replan-policy.ts:32](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/domain/execution-replan-policy.ts:32>)의 미래·미기록 슬롯에 대한 수행 근거 재계획, 저강도 교체/뒤로 이동 및 조정된 계획 계열은 별도 경로다. 계산형에 기존 시간 상한 축소를 적용하지 않는 `:40`도 승인 계약에 맞는 제한이다.
- 제품 공백: 후보 안내의 '같은 목적의 다른 훈련으로 바꿀 수 있다'([instant-plan-projection.ts:30](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/screens/plan-beta/instant-plan-projection.ts:30>))와 §21.55의 저장된 계획 변경 원칙 때문에, 시작 후에도 동일 편집이 이어진다고 기대할 수 있다. 기대 자체는 시나리오 추론이며 실사용자 인터뷰가 아니다.
- 최소 수정: 현재 교체 가능 시점을 저장 전으로 정확히 설명하고 활성 계획 편집 완료라고 보고하지 않는다. 저장 후 편집은 원본·지문·기존 일지·명시적 적용을 보존하는 승인 경로가 실제로 연결됐을 때만 노출한다. 후보 UI를 활성 저장본에 바로 붙이거나 저장본을 덮어쓰는 수정은 금지한다. 로드맵 전체 해결을 이 감사의 완료 조건으로 삼지 않는다.

### F04. 후보에서 실제 훈련 내용 대신 이름만 표시

- 정확한 최종 위치: [instant-plan-projection.ts:41](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/screens/plan-beta/instant-plan-projection.ts:41>), [RecommendationCalendar.tsx:38](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/components/instant-plan/RecommendationCalendar.tsx:38>), [InstantPlanRecommendationView.tsx:152](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/components/instant-plan/InstantPlanRecommendationView.tsx:152>).
- 재현: 기본 MIXED 후보에서 10월 4일을 열면 오전·핵심 훈련·시간형 리듬 달리기라는 이름만 나온다. 해당 생성 결과에는 `P-RHYTHM-T`, RPE 6~7, 총 2840초, 본운동·회복 12구간이 이미 존재한다. [후보 날짜 화면](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/.scratch/persona-100-ux/followup-03b-candidate-day.png>).
- 범위: 숫자가 앱 전체에서 사라졌다는 뜻은 아니다. 다른 훈련 선택기, 숨겨진 후보 상세, 저장 후 방법 화면에는 구조가 있다. 마지막 부모 패치로 기본 조절 CTA도 올바른 선택기를 연다. 그러나 기본 추천의 날짜 상세와 '전체 훈련 내용'은 여전히 제목만 투영한다. 미구성 MAIN 안내 개선과 이미 구성된 숫자의 표시 손실은 별개다.
- 최소 수정: 후보 요약의 각 실제 세션에 이미 검증된 공통 본운동 표기와 회복을 함께 전달한다. 자세한 준비·정리·근거는 기존 펼침을 사용한다. 숫자를 읽기 위해 훈련 변경을 시작하도록 요구하지 않는다. 없는 기준 페이스를 생성하거나 숫자형 목표를 임의 추가하지 않는다.

### F05. 새 이탈 가드의 제출 전 폼 상태 누락

- 정확한 위치: [PlanBeta.tsx:399](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/screens/PlanBeta.tsx:399>), [PlanBeta.tsx:870](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/screens/PlanBeta.tsx:870>) 부근의 폼 통합, [InstantPlanEntryForm.tsx:65](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/components/instant-plan/InstantPlanEntryForm.tsx:65>). 폼의 kind/event/minutes/seconds/achievedOn은 자식 상태이며 부모는 `onSubmit` 때만 알게 된다.
- 패치 후 재현: 완전히 새 합성 컨텍스트에서 5km, 21분 30.12초, 달성일 2026-09-10을 입력하고 제출하지 않은 채 홈→계획으로 이동했다. 확인 대화상자 **0회**, 돌아온 event/minutes/seconds/achievedOn 모두 빈 문자열. 제출 전 `beforeunload` 이벤트의 `defaultPrevented=false`. [실행 영수증](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/.scratch/persona-100-ux/guard-probe-results.json>).
- 정상 확인도 분리: 생성된 후보에서는 취소 후 같은 후보 화면과 텍스트 유지, `beforeunload` 이벤트 차단, 명시적 버리기 후 홈 이동을 확인했다. 별도 합성 강제 가드를 등록하면 차단 1회, 버리기 확인 추가 0회였다. 이 패치를 통째로 실패라고 판정하지 않는다.
- 최소 수정: 제출 전 실제 변경 여부를 동일 소유자에 묶어 기존 가드에 전달한다. 빈 첫 방문은 경고하지 않고, 취소는 모든 입력을 보존하며, 명시적 버리기만 허용한다. 자동 저장, 기록 조기 저장, 안전 확인 생략, 다른 계정의 입력 재사용은 해결책이 아니다.
- 증거 한계: 실제 브라우저 종료/운영체제 종료를 시험한 것이 아니라 취소 가능한 `beforeunload` 이벤트와 실제 앱 탭 이동을 시험했다. 실계정 로그인·로그아웃은 수행하지 않았다.

### F06. 다듬기 안내의 강도 불변 약속은 사실이 아님

- 정확한 위치: [PlanRefinePanel.tsx:101](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/screens/plan-beta/PlanRefinePanel.tsx:101>).
- 재현/계산 확인: 문구는 '바꾸면 다시 만들어요. 강도는 그대로.'이다. 다른 조건이 동일한 경험자 MIXED와 VO2를 실제 생성 함수로 호출하면 본운동이 `P-RHYTHM-T / RPE 6~7`에서 `X-VO2-08 / RPE 7~8`로 바뀐다. UI에서도 해당 선택 후 다시 생성된 후보를 저장했다. 이를 무단 자동 증량이라고 부르지는 않는다. 사용자가 목적을 직접 바꾸는 경로지만 불변 약속은 틀리다.
- 관련 정적 문구: [plan-intake-meta.ts:59](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/screens/plan-beta/plan-intake-meta.ts:59>)의 경험은 운동 시간에만 사용한다는 설명도 현재와 맞지 않는다. [all-workout-calculator.ts:114](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/impl/src/prescription/all-workout-calculator.ts:114>)는 경험 적격성을 검사하고, 합성 초보 VO2는 경험자와 다른 구성으로 생성됐다.
- 최소 수정: 다시 생성되며 새 구성과 표시된 강도를 확인해야 한다고 설명한다. 경험은 구성의 적용 조건과 시간에 사용한다는 실제 범위로 맞춘다. 기존 RPE를 강제로 유지하거나 신규 강도 표를 만들지 않는다.

### F07. 실제 구간 기록은 선택적이지만 페이지 수가 과도함

- 정확한 위치: [PlannedSegmentEditor.tsx:13](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/screens/log-entry/PlannedSegmentEditor.tsx:13>), `:15`, `:41`, `:55`.
- 재현: 저장한 15/15 계획의 연결 일지에서 구간 기록을 열면 `1/18`이 표시됐다. 본운동의 WORK 18개 + 반복 회복 15개 + 세트 회복 2개 = 35개 항목을 두 개씩 잘라서 18페이지로 만든다. 처음부터 마지막까지 보기 위한 다음 버튼만 최소 17회다. 앞/뒤 한 번씩 이동은 실행했고 18페이지 전부 입력하지 않았다. [화면](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/.scratch/persona-100-ux/followup-13-linked-segment-editor.png>).
- 중요 구분: '구간별로 자세히 남기기'는 선택 입력이다. 미입력 구간을 계획 숫자로 채우지 않고 빈 상태로 저장되는 점은 정상이다. 기본 빠른 기록에 18페이지 완주를 요구한다고 보고하면 잘못이다.
- 최소 수정: 이미 있는 반복/세트 구분과 구간 식별값을 유지하면서, 기록 화면에서 운동과 그 회복의 대응을 끊지 않는 표시 단위로 정리한다. 회복 행을 데이터에서 삭제하거나 여러 실제 값에 하나의 값을 복제하지 않는다. 도메인 숫자·수행 비교·저장 구조는 그대로 둔다.
- 트레이드오프: 화면당 행을 늘리면 글자 확대·작은 화면의 세로 길이가 늘어난다. 두 행을 무작정 모두 펼치는 미관 변경보다 기존 구간 구조를 읽는 제한된 정리가 우선이다.

### F08. 연결 일지의 원래 훈련 맥락이 부족함

- 정확한 위치: [app-shell-state.ts:154](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/domain/app-shell-state.ts:154>), [QuickSessionForm.tsx:399](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/screens/log-entry/QuickSessionForm.tsx:399>), [PlannedSegmentEditor.tsx:44](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/screens/log-entry/PlannedSegmentEditor.tsx:44>).
- 재현: 오늘의 일지 CTA는 `PostSessionForm`이 아니라 빠른 기록으로 이동한다. 첫 화면에는 '계획 5일차 · 오전'만 있고 원래 `15/15 인터벌`의 이름·세트·강도·회복은 없다. 선택적 구간 편집에서도 행은 '1번 운동 구간 / 15초' 정도이며 계획의 노력 목표나 구간 목적은 표시하지 않는다. [진입 화면](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/.scratch/persona-100-ux/followup-11-linked-journal.png>).
- 영향 추론: 오전·오후 두 세션, 복합 강도, 날짜를 바꿔서 기록하는 관점에서 무엇과 비교하는지 확인하기 어렵다. 실제 기록을 계획에 맞춰 입력하도록 유도해서는 안 된다.
- 최소 수정: 이미 연결된 당시 원본에서 공통 훈련명·본운동 표기를 읽어 짧은 참조로 제공하고, 실제 입력과 구분한다. 구간 행도 기존 목적·노력 안내를 참조한다. 현재 활성 계획으로 과거 원본을 교체하거나 실제 초/RPE를 계획값으로 자동 채우지 않는다.
- 추가 마찰은 결함과 구분: 빠른 기록의 운동 결과→실제 시간대→RPE→몸 상태→저장은 이번 수행에서 5개 답변/저장 클릭이었다. 완료 버튼은 별도 1회다. 계획 오전을 실제 오전으로 간주하지 않는 재질문에는 정당한 이유가 있으므로 제거를 요구하지 않는다. '실제로 운동한 시간대'라고 더 명확히 설명하는 수준이 적절하다.

### S01. 범위 위반 입력의 피드백 공백은 아직 정적 위험

- 정확한 위치: [PlannedSegmentEditor.tsx:28](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/screens/log-entry/PlannedSegmentEditor.tsx:28>). 유한수/양수/RPE 범위·정수 검사 실패 시 `return`만 하고 해당 행의 오류를 표시하는 상태가 없다.
- 가능 영향: 잘못된 값을 입력했을 때 왜 반영되지 않았는지 모를 수 있다. 실제 입력·포커스·브라우저 제약 메시지까지 확인하지 않아 P2 확정 발견에 포함하지 않는다.
- 최소 확인/교정 범위: 합성 잘못된 값의 입력 후 실제 값과 오류 안내를 확인한다. 필요하면 같은 검증 조건의 이유만 행에 표시한다. 저장 검증을 느슨하게 하거나 숫자 범위를 새로 정하지 않는다.

## 2. 주 작업자 수정 후 확인

### R01. CTA가 월 달력 아래에 있던 문제

- 최초 `9085282`: `InstantPlanRecommendationView.tsx:85`의 월 달력이 `:115` 행동 영역보다 앞섰다. 375×667 첫 후보 화면에서 시작/일정 변경 CTA가 보이지 않았다. [최초 화면](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/.scratch/persona-100-ux/03-candidate-mixed.png>).
- 주 작업자 수정: 현재 [InstantPlanRecommendationView.tsx:106](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/components/instant-plan/InstantPlanRecommendationView.tsx:106>)의 CTA가 `:131` 달력 앞에 있다. 동일 합성 조건의 시작 CTA는 `x=21, y=242.03125, w=128.625, h=47.015625`로 첫 화면에 들어왔다. [후속 영수증](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/.scratch/persona-100-ux/followup-probe-results.json>).
- 상태: 이 좁은 모바일 재현은 해소됐다. 모든 목표 입력 길이·확대 글자·계정 실패 화면에서 첫 화면 노출을 보장했다고 확대하지 않는다. 고정/스티키 CTA나 새 화면은 요구하지 않는다.

### R02. 시간 합계의 소수 노출

- 최초: 9일 후보가 '2시간 21.333333333333343분'으로 표시됐다.
- 주 작업자 수정: [labels.ts:277](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/screens/plan-beta/labels.ts:277>)에서 표시만 초 단위로 반올림하고 시·분·초로 나눈다. 동일 조건에서 '2시간 21분 20초'를 확인했다. 저장 처방은 여전히 원래 소수값을 사용한다.
- 상태: 재현 해소. 이는 F02의 본운동/전체 시간 라벨 오류를 해결한 것은 아니다.

### R03. 마지막 후보 안내·조절 CTA 패치

- [instant-plan-projection.ts:20](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/screens/plan-beta/instant-plan-projection.ts:20>)는 투영 기간 안의 `QUALITY + RPE_TIME_RANGE + !catalogWorkout`만 정확히 센다. `:25`의 미구성 횟수 안내와 `:27`의 이유는 모든 MAIN이 구성됐다고 주장하지 않는다. 마지막 소스 재확인으로 확인했으며 이 버전의 별도 브라우저 실행으로 과장하지 않는다.
- [InstantPlanRecommendationView.tsx:84](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/components/instant-plan/InstantPlanRecommendationView.tsx:84>)는 이 안내를 CTA 앞에 표시한다. `:107`의 행동 영역은 `:132`의 달력보다 앞에 있고 저장 상태·`ready` 가드는 유지됐다.
- [PlanCandidates.tsx:195](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/screens/plan-beta/PlanCandidates.tsx:195>)는 일반 카탈로그 경로의 조절 CTA를 `reveal("catalog")`로 연결하며 `:205`에서 실제 선택기의 `openRequest`로 넘긴다. 더 이상 이 경로를 legacy 방법 선택기로 잘못 보낸다고 보고하지 않는다.
- `:181`~`:187`의 저장/계정 대기·실패·미적용 draft·기준 검토 및 `canSelect` 확인은 남았다. 실제 운영 계정 실패를 실행한 것은 아니다. **F01/F02의 활성 오늘 안내, F03의 저장 후 편집, F04의 날짜 숫자, F05의 제출 전 폼 보호는 이 후보 패치로 해소되지 않는다.**

## 3. 이탈 가드 패치의 제한된 회귀 검토

패치: [usePlanDraftNavigationGuard.ts:5](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/screens/plan-beta/usePlanDraftNavigationGuard.ts:5>)와 `PlanBeta`의 생성/입력 상태 판정. 자동 저장이 아니라 기존 이탈 가드에 등록하는 방식이다.

| 검토 항목 | 확인 결과 | 경계 |
|---|---|---|
| 생성된 후보에서 홈 이동 취소 | 후보 화면 유지, 후보 텍스트 동일 | 실제 브라우저 확인 |
| 생성된 후보에서 명시적 버리기 | 홈으로 이동 | 실제 브라우저 확인 |
| 다른 강제 가드의 우선순위 | 차단 1회, 버리기 확인 0회 | 기존 등록 API로 만든 합성 강제 가드 |
| 생성된 후보의 beforeunload | 취소 가능한 이벤트 차단 | 실제 종료/복원 시험 아님 |
| 최초 제출 전 폼 입력 | 보호 누락, 탭 왕복으로 유실 | F05 재현 |
| 소유자 범위 | hook `:10`이 현재 소유자 일치를 요구 | 실계정 전환 미실행 |
| 계정 전환 시 화면 재생성 | [AppShell.tsx:776](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/AppShell.tsx:776>)의 account-scope 키와 변경 구독 존재 | 정적 검사, 계정 통합 완료 증거 아님 |
| 안전/저장 상태 우회 | hook은 게이트·생성·선택·처방을 수정하지 않음. 후보 CTA는 `ready`일 때만 시작 | 정적 회귀 검토 + 별도 안전 미확인 합성 생성 차단 |
| 계정 저장 오류와 CTA 순서 | `selectionUnavailable`은 BLOCKED, 저장 실패/대기는 CTA 앞 상태 영역에 유지 | 실제 운영 계정 실패·충돌·동기화 미실행 |

`runDraftSafeNavigation`의 [unsaved-draft-navigation.ts:19](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/domain/unsaved-draft-navigation.ts:19>)는 확인 없는 강제 차단을 먼저 판정한다. 생성된 후보 취소/버리기 패치를 F05와 분리해 평가해야 한다. 브라우저 강제 종료에서 유실되지 않는다는 보장은 하지 않는다.

## 4. 117개인데도 보이는 공백의 해석

현재 근거는 [TRAINING_PLAN_CURRENT_SCOPE.md:184](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/TRAINING_PLAN_CURRENT_SCOPE.md:184>)의 후속 범위와 [ALL_WORKOUT_CALCULATION_AND_BINDING_CONTRACT.md:30](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/specs/reconstruct/ALL_WORKOUT_CALCULATION_AND_BINDING_CONTRACT.md:30>)이다. 오래된 §9의 4개 준비 상태만으로 새 계산형 연결을 부정하지 않는다.

1. 117개는 기존37+확장80의 **계산 카탈로그 구성 수**다. 독립 훈련법 117개, 개인 적격 117개, 모든 종목별 개인 페이스 모델 117개, 운영 배포 117개라는 뜻이 아니다. OFF 1개도 포함된다.
2. 종목·경험·보류·환경/장비·총시간·명시 입력·원본의 적용 조건이 서로 다르다. 일반 자동 계획의 [catalog-session-binding.ts:86](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/impl/src/prescription/catalog-session-binding.ts:86>)는 기록/직접 구간 페이스/요건 확인을 자동으로 만들어 넣지 않는다.
3. 합성 초보 VO2는 `P-INTRO-VO2-3`에 연결됐다. 합성 초보 GLY는 상세 구성 없이 기존 20~30분/RPE 7~8 안내를 보존했다. 이는 승인 계약 `:49`, `:56`의 조건부 구성·폴백이다. '117개 연결 실패' 또는 '초보 GLY를 강제로 상세화해야 함'으로 결론 내리면 안 된다.
4. 숫자가 실제 생성돼도 기본 후보 상세가 이름만 전달하면 F04처럼 사용자에게는 공백으로 보인다. 이것은 적격성 제한과 다른 **표시 손실**이다.
5. 직접 입력한 목표는 사용자 지정값이고, 5km RP는 현재 경기 평균 속도의 참고 모델이다. 시간형 참고 거리를 필수 달성 목표로 삼거나 스프린트·언덕·자전거·수영을 경기 페이스로 환산하지 않는다. 그런 숫자 부재를 전부 UX 결함으로 세지 않는다.
6. 주 작업자의 종목+경험+보류 필터, 필수 구간 목표 노출, 기존 입력/시간 확인 보존, 미적용 초안의 적용/취소 조치는 별도 소유 작업이다. 이 보고서는 그 전 범위를 재수행하거나 완료 인증하지 않는다. 필터를 완화해 목록 수를 늘리는 수정은 제안하지 않는다.

## 5. 20개 합성 시나리오 관점

아래는 목적·판단 과업을 구체화한 **관점 분석**이다. 일부에 실제 실행 증거를 연결했지만 20개 모두를 브라우저에서 실행한 것이 아니다. 만족도·전환율·부상률·실사용자 발언을 만들지 않았다.

20개 관점 체크리스트의 체크는 분석 작성·대조 완료를 뜻하며 실행 성공 표시가 아니다.

- [x] 01 무기록 첫 방문 초보
- [x] 02 제출 전 입력과 탭 이탈
- [x] 03 현재 기록과 목표 기록의 구분
- [x] 04 초보 VO2의 구체적인 처방
- [x] 05 초보 GLY의 승인된 폴백
- [x] 06 중학생 부문 초보
- [x] 07 청소년 숙련·복합 훈련
- [x] 08 경험자 목적 변경과 강도 안내
- [x] 09 작은 화면의 첫 후보 CTA
- [x] 10 저장 전 날짜별 실제 숫자
- [x] 11 활성 계획 편집 기대
- [x] 12 과거 연결 일지의 원본 보존
- [x] 13 매 훈련일 오전·오후 두 세션
- [x] 14 계획 슬롯과 실제 수행 시간대
- [x] 15 준비·회복·정리 포함 가능 시간
- [x] 16 다른 종목의 개인 페이스 지원 경계
- [x] 17 오래된 기록과 소수 보존
- [x] 18 언덕·스프린트·대체운동 환경
- [x] 19 선택적 반복·회복 실제 기록
- [x] 20 접근·뒤로가기·이탈 안전

### 01. 처음 방문한 무기록 초보
원하는 것은 시스템 분류를 배우는 것이 아니라 오늘 가능한 계획을 받는 것이다. 첫 홈과 무기록 진입은 실제 확인했고, 안전 확인은 필수 경로로 남는다. 후보 날짜의 이름만 보고 확정해야 하는 F04는 초보에게 특히 큰 판단 공백이다. 없는 페이스를 채우지 말고 현재 준비된 노력·반복·회복을 먼저 보여주는 것이 최소 교정이다. **증거: 첫 방문 실행 + 초보 생성 미세 시험; 초보 전체 UI 실행 아님.**

### 02. 기록을 입력하다 제출 전 다른 탭을 누른 사람
종목·소수 기록·달성일을 타이핑했지만 저장 권한을 아직 행사하지 않은 상태다. F05에서 실제 네 필드가 경고 없이 사라졌다. 제출을 조기 실행하거나 개인 기록에 자동 저장하는 방식은 동의 경계를 바꾼다. 기존 이탈 가드에 해당 폼의 변경 상태만 연결하는 최소 수정이 적절하다. **증거: 패치 후 독립 실제 탭 왕복.**

### 03. 현재 기록과 목표 기록을 구분해야 하는 초보
목표만 있는 사람이 원하는 값은 미래 목표이며 현재 능력의 근거가 아니다. 후보의 목표 불보장 문구와 현재/목표 분리 구조는 유지해야 한다. 목표값에서 처방 숫자를 새로 만들어 F04를 해결해서는 안 된다. 제출 전 입력 보호 누락은 목표 입력에도 영향을 줄 가능성이 있으나 이 모드의 탭 유실은 별도 실행하지 않았다. **증거: 정적 분기 확인, 모드별 실행 보류.**

### 04. 초보지만 숨찬 반복을 선택한 사람
미세 시험의 초보 VO2는 경험자의 15/15 대신 입문 구성을 받았다. '초보에는 상세 훈련이 전혀 없다'는 결론은 틀리다. 실제 받아든 숫자를 처음부터 읽을 수 있어야 하며, 오늘의 F01 안내가 같은 kind를 이유로 붙는 위험은 코드로 확인된다. 새 입문 용량이나 강도 축소표를 만들 필요는 없다. **증거: 합성 생성 실행; 해당 초보 오늘 화면은 미실행.**

### 05. 초보가 GLY를 골랐지만 상세 구성은 보류된 경우
미세 시험은 기존 시간·노력 안내로 폴백했다. 이때 반복·회복 미정 안내는 정직하며 F01의 수정에서 삭제하면 안 된다. 초보 적격성을 무시해 숫자를 채우는 것은 승인된 안전 경계를 훼손한다. 폴백과 계산형의 문구를 분리해야 한다. **증거: 합성 생성 실행, 계약 대조.**

### 06. 중학생 부문을 선택한 무기록 초보
합성 `MIDDLE_SCHOOL` 선택에서도 구성 결정은 경험·목적을 사용하며, 참가 부문은 표시 정보다. 부문 선택을 청소년별 검증 또는 의료 허가로 읽으면 안 된다. 당일 총시간·지원 구간·노력 안내의 정직성은 F02/F04로 확인해야 하지만 새로운 청소년 수치나 자동 금지 정책은 이 감사에서 정하지 않는다. **증거: 합성 생성 실행 + 표시 전용 계약; 실제 미성년자 아님.**

### 07. 청소년 숙련 선수가 복합 훈련을 검토하는 경우
경험자라는 답변과 실제 고강도/복합 경험 확인은 동일하지 않다. X-MIX-09/10 같은 조건부 요건은 유지돼야 하고, 한 RP를 모든 구간에 덮어쓰지 않아야 한다. F08의 구간 목적 누락은 복합형에서 혼동을 키울 가능성이 있지만 이 구성의 청소년 UI는 실행하지 않았다. **증거: 계약·정적 표시 분석, 가능 위험.**

### 08. 숙련자가 '골고루'에서 VO2로 다듬는 경우
변경 목적은 새로운 내용을 받는 것이지 표시상 같은 강도를 보장받는 것이 아니다. 실제 생성 결과의 RPE 6~7→7~8과 F06 문구가 충돌한다. 목적 변경의 명시 선택은 유지하되 새 결과 확인을 사실대로 안내해야 한다. 이는 과거 성과에 따른 자동 증량을 입증한 사례가 아니다. **증거: UI 전환 + 합성 생성 비교.**

### 09. 처음 후보를 받았고 달력보다 시작 행동을 찾는 경우
375×667에서는 최초 CTA가 월 달력 아래로 밀렸다. R01 패치 후에는 같은 조건에서 CTA가 위로 올라왔다. 핵심 행동 노출을 위해 새 탭·새 스티키 툴바가 필요하지 않았고, 저장 실패/차단 상태가 버튼 앞에 남는 점을 유지해야 한다. 긴 목표 문구나 글자 확대에서도 항상 첫 화면이라는 주장은 아직 없다. **증거: 전/후 실제 화면과 버튼 좌표.**

### 10. 시작 전에 다음주 본운동 숫자를 비교하는 경우
후보 달력의 10월 4일은 훈련 이름만 보여줬다. F04 때문에 저장 전 부담을 비교하려면 다른 펼침이나 편집 진입점을 찾아야 한다. 필수 목표 입력이 필요한 구성과 이미 계산된 구성은 구분해야 하며, 숫자가 있는 구성은 같은 표시 함수를 그대로 소비해야 한다. **증거: 후보 날짜 상세 실제 실행.**

### 11. 저장 후 당일 훈련을 바꾸고 싶은 경우
후보에서는 교체했으므로 활성 날짜 상세에서도 비슷한 진입을 기대할 수 있다. F03의 일반 저장본 경로에는 연결이 없다. 최소한 가능 시점을 정확히 설명해야 하고, 후보의 저장없는 미리보기와 활성 저장본 변경을 동일 콜백으로 처리해서는 안 된다. 미래 수행 근거 재계획과 혼동하지 않는다. **증거: 저장 전/후 경로 실행 + 코드.**

### 12. 이미 쓴 일지의 원래 처방을 다시 보는 경우
새 카탈로그 계산으로 옛 원본을 다시 쓰는 것이 아니라 당시 버전·지문·입력과 실제 수행을 비교해야 한다. 연결 일지 저장 및 계획 복귀는 정상 재현됐다. F08은 원본 맥락을 앞에 보여주자는 제안이지 새로운 현재 계획을 과거 일지에 연결하자는 제안이 아니다. **증거: 실제 연결 저장·복귀 + 보존 계약; 버전 교체 전체 회귀 미실행.**

### 13. 직장인이 오전·오후 두 세션을 매 훈련일 선택한 경우
합성 double 모드는 3개 운동일에 총 6세션을 생성했고 하루 본운동 QUALITY는 하나였다. 이는 별도 동의한 현재 배치이며 중복 MAIN 버그로 세지 않는다. 다만 '하루 두 번 운동하는 날도'라는 질문을 가끔만 하는 뜻으로 해석할 가능성은 있다. 결과에서 실제 날짜별 2회와 총 횟수를 읽게 하는 것이 우선이며 새 요일별 선택 기능을 요구하지 않는다. **증거: 합성 생성 실행, double UI 전체 미실행.**

### 14. 오전 계획을 오후에 실제 수행한 두 세션 사용자
계획 슬롯과 실제 시간대는 다를 수 있다. 연결 일지의 '언제 했나요?' 재질문은 정당하며 계획 오전을 실제 오전으로 자동 입력하면 안 된다. F08처럼 원래 훈련명·목표를 먼저 확인할 수 있어야 오전/오후 어느 원본에 연결하는지 분명해진다. **증거: 연결 슬롯 재질문 실행; PM 불일치 저장은 미실행.**

### 15. 전체 시간이 제한된 학생·직장인
실제 필요한 시간은 본운동뿐 아니라 준비·회복·정리까지 포함한다. F02의 총시간 라벨은 이 판단을 방해한다. 해결을 위해 워밍업을 지우거나 긴 구성 확인을 재사용하면 안 된다. 지원 구간을 포함한 이미 계산된 총시간을 정확한 이름으로 표시하는 것이 최소 교정이다. **증거: 저장된 15/15 전체 2615초 대조.**

### 16. 10km·하프·마라톤 기록을 가진 사람이 모든 구성의 개인 페이스를 기대하는 경우
117개 계산 연결은 각 종목 기록의 개인 목표 모델을 모두 승인했다는 뜻이 아니다. 같은 종목 PACE_TARGET, 명시적으로 선택한 5km 참고 모델, 사용자 지정 구간 목표는 다른 근거다. 숫자 부재를 해결한다며 목표 기록·타종목·일반 비율을 조용히 적용하지 않는다. **증거: 지원 표시와 최신 계약 정적 대조; 해당 종목 UI 미실행.**

### 17. 오래된 기록 또는 소수 기록을 넣는 경우
오래된 기록은 현재 기준으로 침묵하며 사용하면 안 되고, 소수는 원본 계산에 보존해야 한다. R02는 표시 합계만 정리했으며 저장본의 소수를 없애지 않았다. 이번 제출 전 유실 시험의 소수 입력은 계산 검증이 아니라 보호 경계 검증이다. 기록 유효기간별 브라우저 회귀가 완료됐다고 보고하지 않는다. **증거: 소수 입력·시간 표시 실행 + 최신 계산 계약; 오래된 기록 저장 미실행.**

### 18. 언덕·스프린트·자전거·수영을 고르는 사람
실행 환경·장비 확인과 종료 조건을 알아야 하며 러닝 RP를 임의 환산하면 안 된다. 목록이 작아지는 것은 조건 불일치의 정상 결과일 수 있다. 회복이나 직접 목표 입력이 필요한 이유를 표시하고 승인된 확인을 보존하는 주 작업자의 수정 범위를 지켜야 한다. 이 환경별 적용은 이번 독립 시험에서 실행하지 않았다. **증거: 계약·계산 적격성 정적 확인.**

### 19. 운동 후 많은 반복을 선택적으로 기록하는 숙련자
15/15의 실제 35개 운동·회복 구간은 각각 사실로 보존할 필요가 있다. F07의 18페이지와 F08의 목적/노력 맥락 부재는 비교 입력을 번거롭게 한다. 기본 저장은 5개 답변/저장 클릭으로 가능했고 구간 입력 없이도 저장됐다. 필수 기록 부담이라고 과장하거나 미기록 값을 계획 숫자로 채우는 해결은 하지 않는다. **증거: 실제 선택적 편집·저장·복귀 실행.**

### 20. 작은 화면·키보드·뒤로가기를 사용하는 첫 방문자
375px 화면의 수평 넘침은 이번 캡처에서 없었고, 날짜 리더→방법 상세의 두 단계 Escape 닫기는 작동했다. 이는 스크린리더/확대 글자/모든 터치 영역 합격을 뜻하지 않는다. 생성된 후보의 탭 이탈 취소는 보존됐으나 첫 폼은 F05처럼 보존되지 않았다. 접근성과 이탈 안전을 별개로 보며 미실행 부분을 통과로 포장하지 않는다. **증거: 좁은 실제 화면·Escape·탭 시험; 보조기기 전체 검수 미실행.**

## 6. 실행 증거와 한계

- 실행 환경: 저장소의 실제 React 앱을 로컬 `127.0.0.1:4493`에서 제공했다. 기존 설치된 Chrome 실행 파일을 사용하는 Playwright의 비영속 `newContext`였으며 사용자의 프로필·계정·브라우저 탭은 사용하지 않았다.
- 모든 입력·계획·일지는 합성이다. 컨텍스트는 새로 만들고 종료했다. 합성 저장은 이 컨텍스트의 브라우저 저장소에만 수행했다. 모델/API/운영 서버/실계정 저장은 하지 않았다.
- 시험 프로세스 환경은 명시적인 비밀 없는 값으로 교체했고, Vite의 환경 파일 경로는 소유 scratch로 한정했다. `.env`·비밀·사용자 데이터 파일을 읽지 않았다. localhost 외 요청을 차단했으며 성공한 후속/가드 영수증의 외부 요청 목록은 `[]`다.
- 최초 여정은 연결 기록 화면의 잘못된 locator('세션 제목') 때문에 끝까지 실행되지 않았다. 제품 실패가 아니라 시험기 오류다. 최초 오류 영수증을 보존하고, 후속 시험에서 실제 빠른 기록 진입·저장·복귀까지 성공했다. `probe-results.json`의 timeout을 일지 기능 결함으로 세지 않는다.
- 실행 단위: 한 종류의 실제 앱 여정을 최초 부분 실행하고 같은 합성 조건으로 후속 두 번 완료했다. 별도로 이탈 가드의 실제 탭 이동 시험과 생성 함수의 **7개 작은 합성 경우**를 실행했다. 이 숫자는 실사용자 수/20관점 실행 수/100개 페르소나 성공률이 아니다.
- 미세 시험 7개: 경험자 MIXED, 경험자 VO2, 초보 VO2, 초보 GLY, 경험자 double, 중학생 부문 초보 MIXED, 현재 몸 상태 미확인. 마지막 경우는 `CURRENT_CHECK_REQUIRES_REVIEW`로 차단됐다. 이를 모든 D9 신호 조합의 검증 완료로 확대하지 않는다.
- 캡처된 375×667 경로의 document scrollWidth는 375였다. 모든 기기/큰 글자/스크린리더/전체 지형·종목·기록 조합은 검증하지 않았다.
- 기존 전체 테스트, 빌드, 100개 페르소나 전수 실행은 중복 수행하지 않았다. 기존 테스트 통과 여부를 좋은 UX의 근거로 사용하지 않았다.
- 소유 증거: [probe.mjs](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/.scratch/persona-100-ux/probe.mjs>), [후속 영수증](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/.scratch/persona-100-ux/followup-probe-results.json>), [가드 영수증](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/.scratch/persona-100-ux/guard-probe-results.json>), [미세 생성 결과](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/.scratch/persona-100-ux/micro-probes.json>).

## 7. 문서 권위와 최소 교정 순서

먼저 AGENTS/North Star, 최신 계획 범위와 관련 계약을 읽고 도메인 코드를 검토했다. `specs/active`라는 폴더명만으로 미채택 조항을 승격하지 않았다.

- 우선 권위: `PRODUCT_NORTH_STAR.md`, `TRAINING_PLAN_CURRENT_SCOPE.md` §10, `ALL_WORKOUT_CALCULATION_AND_BINDING_CONTRACT.md` v1.0.0/OWNER_DIRECTED_IMPLEMENTATION, `SESSION_METHOD_SELECTION_AND_ADJUSTMENT_CONTRACT.md` §21.54~21.59, 관련 정확한 처방·템플릿 §16A·double-session/슬롯 결정·일지 보존/안전 계약.
- UX 기준: `docs/UX_UI_VISUAL_STANDARD.md`의 실제 수행 정보 우선, 실제 목적지 라벨, 원점 복귀, 미적용 변경의 적용/취소 및 최신 2026-09-30 조건을 대조했다.
- `design_handoff_plan_beta_extension/README.md`와 `20 Handoff Risk Review.html`도 검토했다. 이들은 새 Session Prep/Weekly Wrap/Coach Handoff의 시안이며 런타임 구현 승인 증거가 아니다. 제안된 경로·수치·예상 일정은 이 감사의 결함 판정 근거로 승격하지 않았다. 구현되지 않은 로드맵 전체를 현재 회귀로 세지 않았다.
- D9의 현재 판정과 미확인 차단은 유지한다. 자가 확인을 의료 허가로 표현하지 않고, 원본 보류 이력·종목/경험/환경 조건·시간 확인을 완화하지 않는다.

최소 순서는 F01/F02의 잘못된 안내 교정, F05의 기존 가드 보호 범위 연결, F04의 이미 있는 실제 처방 표시, F06의 불변 약속 제거다. F03은 활성 편집 완료 주장을 바로잡고 승인 경로의 실제 연결 범위를 분리한다. F07/F08은 원래 구간/실제 기록/일지 연결을 그대로 보존하는 좁은 표시 개선만 검토한다. 새로운 dose·기능·화면·미관 개편을 이 보고서로 승인하지 않는다.

## 8. 작업 보존과 종료 상태

이 작업자가 만든 변경은 이 보고서와 `.scratch/persona-100-ux/`, 사용자가 마지막에 허용한 증거 폴더의 합성 화면 6장뿐이다. 다른 작업자의 picker/candidate/labels/CTA/guard/test/UX 문서 변경을 보존했고 런타임을 수정하지 않았다. 새 브랜치·커밋·푸시·배포가 없다. 시험 서버와 브라우저는 종료했다.

최종 소스 재확인 시 HEAD는 여전히 `9085282`이며 부모의 미커밋 패치가 함께 존재한다. F03의 현재 분기는 `PlanBeta.tsx:692`, 후보 교체 콜백은 `:795`, F05 가드 조건은 `:399`, 최초 폼 통합은 `:870`이다. 마지막 후보 패치는 R03으로 분리했다. 이 보고서는 다른 작업자의 100개 브라우저·100개 코어 실행을 재실행하거나 독립 실행 수로 합산하지 않는다.

보존한 합성 화면 6장:

- [저장 전 후보 날짜 상세](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/reports/review/evidence/persona-100-ux/candidate-day-before-save.png>)
- [활성 오늘 안내의 충돌](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/reports/review/evidence/persona-100-ux/active-today-false-guidance.png>)
- [선택적 구간 기록 18페이지](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/reports/review/evidence/persona-100-ux/segment-editor-18-pages.png>)
- [CTA 위치 수정 후](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/reports/review/evidence/persona-100-ux/candidate-cta-after-parent.png>)
- [제출 전 합성 입력](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/reports/review/evidence/persona-100-ux/unsubmitted-entry-before.png>)
- [탭 왕복 후 입력 유실](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/reports/review/evidence/persona-100-ux/unsubmitted-entry-after-tab.png>)

## 9. 부록: 부모 수정 후 좁은 실제 브라우저 재확인

2026-09-30 사용자의 마지막 요청에 따라 신규 범위 탐색 대신 같은 합성 조건으로 재시험했다. 기존 판정·이미지·미세 시험·실행 영수증은 유지했다. 이번 부록의 통과는 해당 재현의 해소이며 전체 117구성·100개 관점·계정 운영·임상 안전의 완료 인증이 아니다.

### 9.1 다섯 항목의 수정 후 결과

| 항목 | 최종 정확한 위치 | 실제 브라우저 결과 |
|---|---|---|
| F01 | [instant-plan-today.ts:39](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/screens/plan-beta/instant-plan-today.ts:39>) | 유효 X-VO2-08의 오늘 화면에서 '반복 횟수와 회복 시간은 정해지지 않았다'는 문구가 없어짐 |
| F02 | [instant-plan-today.ts:59](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/screens/plan-beta/instant-plan-today.ts:59>) | 본운동의 3 sets × 6 × 15s/r15s/R3min과 '전체 예정시간 · 준비·회복·정리 포함 43분 35초'가 분리 표시됨 |
| F04 | [instant-plan-projection.ts:43](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/screens/plan-beta/instant-plan-projection.ts:43>), [RecommendationCalendar.tsx:39](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/components/instant-plan/RecommendationCalendar.tsx:39>), [InstantPlanRecommendationView.tsx:153](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/components/instant-plan/InstantPlanRecommendationView.tsx:153>) | 기본 MIXED 후보의 10월 4일 날짜 상세와 '전체 훈련 내용' 양쪽에서 실제 반복/노력/회복 표기를 확인함 |
| F05 | [InstantPlanEntryForm.tsx:74](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/components/instant-plan/InstantPlanEntryForm.tsx:74>), [PlanBeta.tsx:400](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/screens/PlanBeta.tsx:400>), [PlanBeta.tsx:871](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/screens/PlanBeta.tsx:871>) | 제출 전 5km/21분/30.12초/2026-09-10에서 홈 이동을 취소하면 네 값 모두 유지. 명시적 버리기로 이동한 뒤 돌아왔을 때만 빈 폼. beforeunload 이벤트도 차단됨 |
| F06 | [PlanRefinePanel.tsx:101](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/screens/plan-beta/PlanRefinePanel.tsx:101>), [plan-intake-meta.ts:59](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/screens/plan-beta/plan-intake-meta.ts:59>) | '새 훈련 구성과 강도를 확인'과 '경험에 맞는 훈련 구성과 운동 시간을 정함'을 각각 실제 화면에서 확인함 |

- 생성된 후보에서도 취소 후 화면·텍스트 유지, 명시적 버리기 후 홈 이동을 다시 확인했다. 합성 강제 가드의 차단 1회, 그 상태의 버리기 확인 추가 0회를 재확인했다. 실제 종료나 실계정 전환 시험은 아니다.
- 원래 합성 VO2 저장본과 수정 후 같은 조건의 저장본에서 **sessions 10개 전체 JSON이 정확히 동일**했다. 날짜/슬롯/역할/처방 숫자/카탈로그 입력·참조가 이번 재현에서 바뀌지 않았다는 좁은 확인이다. 모든 경우의 dose 보존 증거로 확대하지 않는다.
- 최종 두 시험은 각각 정상 종료했고 오류·pageerror·외부 요청은 모두 0이었다. 최초 수정 후 시험은 없어진 접힘 요약을 찾는 기존 시험기 locator에서 멈췄다. 이미 필요한 다섯 항목 중 일부를 확인한 뒤 발생한 **시험기 오류**이며 제품 결함으로 세지 않았다. 그 부분 영수증도 별도 보존하고, 범위를 품질 확인까지로 맞춘 후 재실행해 정상 종료했다.

실행 영수증과 수정 후 화면:

- [수정 후 처방·후보·문구 확인 영수증](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/.scratch/persona-100-ux/after-parent-flow-results.json>)
- [수정 후 입력 취소·버리기·강제 가드 영수증](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/.scratch/persona-100-ux/after-parent-guard-results.json>)
- [수정 후 오늘의 본운동/전체 예정시간](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/.scratch/persona-100-ux/after-parent-flow-07-quality-today.png>)
- [수정 후 후보 날짜의 실제 숫자](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/.scratch/persona-100-ux/after-parent-flow-03b-candidate-day.png>)
- [수정 후 입력 취소 보존](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/.scratch/persona-100-ux/after-parent-guard-02b-input-after-cancel.png>)

### 9.2 통합에 남길 항목과 판정 경계

1. **F03 / P1 제품 공백 유지:** [PlanBeta.tsx:693](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/screens/PlanBeta.tsx:693>)의 일반 활성 계획은 카탈로그 선택기로 이어지지 않는다. `:796`의 후보 전용 콜백과 [ActivePlan.tsx:219](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/screens/plan-beta/ActivePlan.tsx:219>)의 방법/기록 경로는 여전히 다르다. [instant-plan-projection.ts:30](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/screens/plan-beta/instant-plan-projection.ts:30>)는 '저장하기 전'으로 범위를 한정했으므로 무제한 편집 약속은 완화됐다. 기능 완료라고 보고하지 않으며 로드맵 전부 해결을 요구하지 않는다.
2. **F07 / P2 유지:** [PlannedSegmentEditor.tsx:15](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/screens/log-entry/PlannedSegmentEditor.tsx:15>)의 두 항목씩 페이지 구성은 바뀌지 않았다. 35개 운동·회복 항목의 18페이지는 이전 실제 재현을 유지한다. 선택 입력이므로 기본 저장 차단으로 과장하지 않는다.
3. **F08 / P2 유지:** [QuickSessionForm.tsx:399](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/screens/log-entry/QuickSessionForm.tsx:399>)와 [PlannedSegmentEditor.tsx:44](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/screens/log-entry/PlannedSegmentEditor.tsx:44>)의 당시 훈련명·목적·노력 목표 맥락 공백은 이번 수정 범위 밖이다. 실제 값을 자동 입력하지 않고 기존 원본의 표시만 보완하는 범위가 적절하다.
4. **S01 유지:** 잘못된 입력의 조용한 거절은 정적 위험으로만 남기며 실행 확인된 결함에 합산하지 않는다.
5. **부모 패치 회귀 경계:** CTA는 계정 저장 상태/실패 안내 다음, 월 달력 이전에 유지됐고 유효 `ready`/`canSelect` 확인을 우회하지 않는다. 카탈로그 조절 CTA 라우팅은 소스로 확인했다. 미구성 MAIN 횟수·이유의 새로운 안내도 소스로 확인했으며 최종 fallback 브라우저 조합까지 재실행하지 않았다. 모든 D9·계정 동기화·보류 조합의 검증 완료 주장은 하지 않는다.

통합용 완료 범위: 20개 관점 체크리스트, 재현/정적 위험 분리, 부모 수정 후 다섯 항목의 좁은 실제 재확인, 원본 판정 보존, 잔여 제품 공백과 선택적 기록 마찰의 명시. 런타임 패치는 부모 소유다. 이 감사자의 서버·브라우저는 종료됐고 새 브랜치/커밋/푸시/배포는 없다.
