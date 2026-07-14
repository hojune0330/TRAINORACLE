# SPEC_OVERVIEW_FOR_HOJUNE.md

```yaml
doc_id: TRAINORACLE_SPEC_OVERVIEW_FOR_HOJUNE
spec_id: TRAINORACLE.SPEC_OVERVIEW_FOR_HOJUNE
title: "TrainOracle SPEC Easy Overview For Hojune"
version: "0.2"
round: RT2_FORMATION_OWNER_BRIEF
status: DRAFT_HANDOFF_OVERVIEW
owner: COACH_HOJUNE
open_issues_total: 0
canonical_blocking_count: 0
executed_tests_total: 0
canonical_promotion_allowed: false
```

---

## 1. 지금 TrainOracle 스펙은 어디까지 왔나

TrainOracle은 아직 완성된 앱이 아니다. 지금 단계는 앱과 웹을 만들기 전에, 훈련을 안전하게 분석하고 설계하기 위한 계약서를 촘촘하게 세우는 단계다.

현재 GitHub에는 핵심 스펙 뼈대가 올라가 있다. 특히 아래 흐름이 분리되어 있다.

```text
선수 데이터
-> 세션 분류
-> 선수 프로필과 동의/권한 확인
-> D9 안전 신호 확인
-> Rule Validation Engine
-> Safety Gate
-> Plan Generator
-> 훈련 계획/분석/일지 화면
```

이 흐름이 중요한 이유는 단순하다.

- 좋은 훈련 데이터를 봤다고 위험 신호를 지우지 않는다.
- AI나 코치 설명이 안전 hard-stop을 덮어쓰지 않는다.
- 선수의 원문 메모, 증상 문장, 민감한 의료성 문장은 저장하지 않는다.
- 계획 생성 전에 반드시 안전 게이트를 지난다.
- 아직 실제 실행 증거가 없는 것은 닫았다고 말하지 않는다.

즉, 지금 문서들은 "앱을 어떻게 예쁘게 만들까"보다 먼저 "훈련을 안전하고 근거 있게 짜려면 무엇을 절대 어기면 안 되는가"를 정리하고 있다.

---

## 2. 스펙이 탄탄하다고 말할 수 있는 이유

TrainOracle 스펙은 문서가 많기 때문에 복잡해 보이지만, 구조는 꽤 단단하다.

1. 안전 규칙의 중심이 있다.

`RULE_SPEC_D1_D9.md`가 D1-D9 규칙의 의미를 잡고 있다. 특히 D9은 훈련 계획을 멈출 수 있는 안전 hard-stop이다.

2. 판단 결과가 흐르는 길이 있다.

`RVE_RULE_EVALUATOR_BINDING_SPEC.md`, `RULE_VALIDATION_ENGINE_CONTRACT.md`, `PLAN_SAFETY_GATE_SPEC.md`가 D9 평가 결과를 RVE, Safety Gate, Plan Generator로 보내는 길을 정의한다.

3. 저장해도 되는 것과 안 되는 것이 나뉘어 있다.

`APP_IMPLEMENTATION_BRIDGE.md`, `ATHLETE_PROFILE_SPEC.md`, `DAILY_LOG_AND_CHECKIN_SPEC.md`는 원문 자유서술을 저장하지 않고, 구조화된 값과 reason code 중심으로 다루게 한다.

4. 훈련 계획을 만드는 쪽도 독립적으로 막혀 있다.

`PLAN_GENERATOR_SPEC.md`는 좋은 생리 데이터나 좋은 템플릿이 D9 위험을 지우지 못하게 막는다.

5. 일지 서비스 방향과도 이어져 있다.

`DAILY_LOG_AND_CHECKIN_SPEC.md`가 매일 들어오는 선수 기록을 안전하게 구조화하고, 이후 Daily Brief, AI Inbox, Analysis로 넘길 준비를 한다.

6. 아직 증거가 없는 것은 증거가 없다고 남긴다.

`SPEC_TARGET_PATCH_MATRIX.md`, `SPEC_WORK_STATUS.md`, `SPEC_WAVE1_PHYSIO_PATCH_REPORT.md`는 어떤 이슈가 아직 열려 있는지, 무엇을 닫으면 안 되는지 분리해서 기록한다.

이 점이 가장 중요하다. 이 저장소는 "완성됐다고 포장한 문서"가 아니라, "무엇이 완성됐고 무엇이 아직 증거가 필요한지 구분하는 문서"다.

---

## 3. 현재 있는 핵심 스펙별 쉬운 설명

| 스펙 | 쉬운 설명 | 현재 의미 |
|---|---|---|
| `RULE_SPEC_D1_D9.md` | TrainOracle의 안전 규칙 책 | D1-D9 규칙 의미의 기준이다. D9 안전 hard-stop을 함부로 바꾸면 안 된다. |
| `SESSION_CLASSIFIER_SPEC.md` | 운동 기록을 어떤 세션인지 분류하는 기준 | 조깅, 인터벌, 회복주 같은 훈련 성격을 안정적으로 나누는 바탕이다. |
| `ATHLETE_PROFILE_SPEC.md` | 선수별 프로필, 제한, 선호, 동의 범위 | 같은 훈련도 선수마다 다르게 적용하기 위한 개인 범위다. |
| `APP_IMPLEMENTATION_BRIDGE.md` | 앱이 무엇을 저장하고 어떤 API로 주고받는지 정하는 다리 | 동의, 권한, 감사 로그, 저장 경계를 구현자가 따라가게 한다. |
| `PLAN_GENERATOR_SPEC.md` | 훈련 계획 후보를 만드는 계약 | 안전 게이트를 지난 뒤에만 계획을 만들고, 이유와 근거를 남기게 한다. |
| `TEMPLATE_LIBRARY_SPEC.md` | 훈련 템플릿 보관소 규칙 | 템플릿 소유권, 생명주기, 적용 가능 조건을 정한다. |
| `PHYSIO_SOURCE_TRUST_SPEC.md` | 생리 데이터가 믿을 만한지 판단하는 기준 | HR, RPE, 피로도 같은 데이터의 신뢰도, 최신성, 충돌을 다룬다. |
| `RVE_RULE_EVALUATOR_BINDING_SPEC.md` | D9 평가 결과를 시스템 신호로 묶는 계약 | 평가기가 낸 결과를 RVE, Safety Gate, Plan Generator가 같은 의미로 읽게 한다. |

---

## 4. 재구성된 핵심 스펙

아래 문서들은 원본 파일이 로컬에서 확인되지 않아, 현재는 `RECONSTRUCTED_DRAFT_FOR_REVIEW` 상태다. 즉, "원본 복원"이나 "정본 승인"이 아니다.

| 스펙 | 쉬운 설명 | 남은 일 |
|---|---|---|
| `RULE_VALIDATION_ENGINE_CONTRACT.md` | 규칙 평가 결과를 앱이 읽을 수 있는 표준 신호로 만드는 문서 | 원본/승인본 아님. RVE 실제 실행 증거와 target patch 검토가 필요하다. |
| `PLAN_SAFETY_GATE_SPEC.md` | 계획 생성 전에 멈출지 통과시킬지 정하는 문서 | ACTIVE/UNKNOWN 차단, CLEARED/ADVISORY 의미를 구현과 연결해야 한다. |
| `DAILY_LOG_AND_CHECKIN_SPEC.md` | 매일 쓰는 훈련 일지를 안전한 구조 데이터로 바꾸는 문서 | App Bridge, Profile, RVE, Safety Gate와 더 연결해야 한다. |

---

## 5. 이제 남은 스펙 제작

남은 일은 이제 "이미 만든 제품화 초안 검토"와 "아직 만들 제품화 스펙"으로 나뉜다.

| 작업/스펙/증거 | 왜 필요한가 | 현재 상태 |
|---|---|---|
| Daily Log binding patches | 일지 입력을 App Bridge, Safety Gate, RVE가 안전하게 소비하게 만들기 위해 | 일부 target-local patch 완료. issue closure는 아직 아님 |
| `DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC.md` | 매일 요약, 코치 알림, AI Inbox 항목을 만들기 위해 | Draft created. 구현/실행 증거는 아직 없음 |
| `ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md` | 분석 화면과 시각화가 어떤 데이터 구조를 쓰는지 정하기 위해 | Draft created. App Bridge binding, metric formula authority, runtime evidence가 남아 있음 |
| `PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md` | 훈련 계획의 이유 설명이 민감정보를 드러내지 않게 하기 위해 | Draft created. Plan Generator/App Bridge binding과 runtime evidence가 남아 있음 |
| `MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md` | 9.5-day cycle, 달력, 경기일 기준 표기를 헷갈리지 않게 하기 위해 | Draft created. Plan Generator/App Bridge/UI binding과 runtime evidence가 남아 있음 |
| `TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md` | 9.5일 안에 MAIN 2-3회와 사이 부하를 실제 후보·조정 계약으로 만들기 위해 | Draft created. 9개 관점 검토 뒤 코치·부하·근거·안전/개인정보·노출 ledger·버전·달력·제품 투영·거버넌스·파일럿의 10개 canonical blocker가 남아 있음 |
| D9 runtime evidence report | 기존 11-case 로그가 target/Formation 경계를 어디까지 증명하는지 평가하기 위해 | tracked 로그 + coverage gap + 추가 terminal/CI 증거 |
| App DB/API schema contracts | 스펙을 실제 DB, API, 앱 구현으로 옮기기 위해 | 핵심 safety/privacy 스펙 acceptance |

현재 가장 가까운 다음 작업은 "이슈 닫기"가 아니다. 다음 순서는 아래에 가깝다.

1. `TRAINING_PLAN_BLUEPRINT_MULTIPERSPECTIVE_REVIEW.md`를 기준으로 Formation의 열 개 canonical blocker를 순서대로 결정.
2. Daily Log를 App Bridge와 Safety Gate에 연결.
3. RVE/Safety Gate/Formation/Plan Generator 안전·계획 체인 target patch 보강.
4. Calendar projection에 `frameId`와 `blockId`를 추가할 schema patch 검토.
5. 기존 D9 evaluator 로그의 target coverage를 평가하고, target 안정화 뒤 Formation contract runtime evidence를 새로 확보.

---

## 5A. PR #63과 선수에게 보이는 그림자 모드

### PR #63은 무엇인가

PR #63의 `TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md`는 앱 기능이 아니라
훈련계획 생성기의 큰 설계도다. 9.5일 동안 MAIN 2-3회, 대회 고정, 복합훈련,
중간 부하, 계획 후보, 코치 선택, 안전 중단, 계획 변경 이력을 한 계약으로
연결한다.

이 설계도는 보존 가치가 있지만 아직 정본은 아니다. 열 개 canonical blocker와
실행되지 않은 계약 테스트가 남아 있으므로 다음 상태로 병합한다.

```text
연구·검토 기록으로 보존: 허용
정본으로 승격: 금지
앱이나 Plan Generator 구현 근거로 자동 사용: 금지
실제 선수 훈련 자동 변경: 금지
```

### 그림자 모드는 무엇인가

그림자 모드는 시스템이 계획을 몰래 운영하는 방식이 아니다. 선수는 시작 전에
무엇을 비교하는지 알고 별도로 참여를 선택한다. 실제 훈련은 계속 연결된 코치의
계획대로 하고, TrainOracle 계획은 비교용으로만 만든다.

제안된 세 구간이 승인되면 선수 화면은 아래처럼 단순하게 보인다.

```text
참여 설명과 선택
  -> 1/3 비교 완료 [체크 + 날짜]
  -> 2/3 비교 완료 [체크 + 날짜]
  -> 3/3 비교 완료 [체크 + 날짜]
  -> 무엇을 비교했고 무엇은 아직 모르는지 함께 보기
```

화면은 항상 다음을 말해야 한다.

- 비교용 계획은 오늘 훈련을 바꾸지 않는다.
- 실제 계획은 연결된 코치가 결정한다.
- 사용하는 구조화 데이터와 사용하지 않는 메모를 알려준다.
- 현재 구간, 전체 구간, 멈춤 이유, 나가기 방법을 보여준다.
- 완료는 성능 향상, 안전, 의학적 효과를 뜻하지 않는다.

### 체크·스티커·보상은 어떻게 붙나

그림자 구간의 `1/3`, `2/3`, `3/3` 표시는 시스템 진행 상황이다. 매일 기록한
체크나 스티커는 안전한 일지 습관을 위한 별도 경험이다.

휴식 기록, 통증 기록, 경기 기록, 훈련 후 기록은 모두 유효한 기록일이다.
더 많이 뛰기, 더 빠르게 뛰기, 아프지 않다고 쓰기, 메모를 숨기지 않기,
참여 동의를 계속 유지하기에는 보상을 주지 않는다. 빠진 날이나 중도 철회에도
창피를 주거나 이미 얻은 꾸미기 항목을 회수하지 않는다.

현금·쇼핑·게임 포인트는 이 그림자 파일럿에서 승인하지 않는다. 첫 단계는
체크, 진행선, 작은 스티커나 기념 스탬프처럼 부담 없는 비금전 경험으로 검증한다.

### 기존 스펙과의 역할 분담

| 질문 | 담당 스펙 | 의미 |
|---|---|---|
| 계획 후보는 어떻게 만드나 | `TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md` | 비교용 후보와 9.5일 구간을 만든다. |
| 선수 동의·철회·삭제는 누가 맡나 | `APP_IMPLEMENTATION_BRIDGE.md`, `ATHLETE_PROFILE_SPEC.md` | 별도 동의와 철회 이후 처리를 맡는다. |
| 나만의 메모는 어떻게 막나 | `DAILY_LOG_AND_CHECKIN_SPEC.md` | 존재 여부까지 계획·분석·보상에 신호를 주지 않는다. |
| 추이는 어떻게 보여주나 | `ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md` | 표본 수, 누락, 불확실성을 포함한 설명형 분석만 맡는다. |
| 체크·스티커는 누가 정하나 | `JOURNAL_DELIGHT_AND_DECORATION_SPEC.md` | 부하나 속도가 아닌 안전한 기록 습관만 보상한다. |
| 왜 이런 계획인지 어떻게 설명하나 | `PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md` | 개인정보를 숨긴 쉬운 이유 설명을 맡는다. |

### 이번 결정으로 확정된 것과 남은 것

확정된 것은 그림자 모드를 선수에게 숨기지 않는 것, 쉬운 설명과 진행 표시를
제공하는 것, 스티커·체크 방향을 안전한 기록 습관에만 연결하는 것, PR #63을
초안 기록으로 보존하는 것이다.

아직 남은 것은 세 구간을 실제로 시작할 날짜, 정확한 참여 기준, 중단 기준,
부작용·안전 사건 기록 방식, 분석 표본 기준, 스티커 개수와 디자인, 데이터
보관·삭제 기간, 미성년 보호자 절차다. 이것들이 닫히기 전에는 그림자 파일럿도
실행하지 않는다.

---

## 6. 절대 헷갈리면 안 되는 말

| 표현 | 뜻 |
|---|---|
| `DRAFT_FOR_REVIEW` | 검토 가능한 초안이다. 정본 승인은 아니다. |
| `RECONSTRUCTED_DRAFT_FOR_REVIEW` | 원본이 없어서 재구성한 초안이다. 원본 복원이라고 말하면 안 된다. |
| `runtime evidence` | 실제 코드나 CI를 돌린 실행 로그다. Markdown PASS나 self-check는 아니다. |
| `D9_CLEARED` | 지금 evaluator가 D9 위험 신호를 못 봤다는 뜻이다. 의료적 안전 판정이 아니다. |
| `ADVISORY` | 네 번째 D9 상태가 아니다. `D9_CLEARED` 아래의 비차단 조언 상태다. |
| `source acceptance` | 원천 스펙과 target patch를 사람이 받아들였다는 검토 상태다. 이 전에는 이슈를 닫지 않는다. |

---

## 7. 한 줄 결론

TrainOracle 스펙은 아직 완성 앱은 아니지만, 훈련 분석과 훈련 설계를 위한 안전 체인, 개인정보 저장 경계, 계획 생성 계약, 일지 기반 제품 흐름이 분리되어 있다. 그래서 다음 개발자가 GitHub만 봐도 "무엇을 만들고, 무엇을 막아야 하고, 무엇은 아직 증거가 없는지" 이어받을 수 있는 상태다.

---

## Productization Update - 2026-06-27

`DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC.md` now exists at `specs/reconstruct/DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC.md`.

Plain meaning:

- Daily Log records can now flow into a defined Daily Brief / AI Inbox signal contract.
- Every signal must carry source refs, confidence or uncertainty, and non-sensitive reason codes.
- Raw memo/free-text/symptom clauses and private medical/guardian notes remain forbidden in storage and audit.
- Daily Brief / AI Inbox cannot create plan options and cannot clear D9 or Safety Gate blocks.
- This is still a draft for review, not canonical promotion and not runtime evidence.

Then-remaining productization SPECs at this checkpoint. Later updates below supersede this list:

- `PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md`
- `MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md`

## Productization Update - 2026-07-07

`ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md` now exists at `specs/reconstruct/ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md`.

Plain meaning:

- Analysis, Dashboard, Session Detail, Calendar, coach review, Daily Brief, and AI Inbox can now point to one draft contract for visualization data.
- Each graph or panel must be backed by structured source refs, confidence or uncertainty, and non-sensitive reason codes.
- Missing, stale, conflicting, or undefined metrics must be shown honestly instead of being smoothed over.
- Raw memo/free-text/symptom clauses and private medical/guardian notes remain forbidden in storage and audit.
- Visualizations cannot create plan options and cannot clear D9 or Safety Gate blocks.
- CTL/ATL/TSB and similar formulas are not finalized here; metric algorithm authority still needs a later accepted contract.

Then-remaining productization SPECs at this checkpoint. Later updates below supersede this list:

- `MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md`

## Productization Update - 2026-07-07 B

`PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md` now exists at `specs/reconstruct/PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md`.

Plain meaning:

- Plan Generator가 만든 훈련 계획의 "왜"를 보여줄 수 있는 privacy-safe 설명 계약이 생겼다.
- 설명은 raw text가 아니라 source refs, rationale codes, privacy tier, redaction state, confidence/uncertainty로 구성된다.
- 선수 메모 원문, 증상 문장, 의료/보호자 메모, hidden chain-of-thought, private external LLM prompt는 저장/표시/audit에 들어가면 안 된다.
- 이 스펙은 계획을 새로 만들거나 선택하지 않고, D9/Safety Gate 상태를 clear하지 않는다.
- `OI-PG-OPTION-RATIONALE-PRIVACY-001`는 아직 닫힌 것이 아니다. Plan Generator/App Bridge target patch와 runtime/privacy evidence가 필요하다.

Then-remaining productization SPEC at this checkpoint. The 2026-07-07 C update below supersedes this list:

- `MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md`

## Productization Update - 2026-07-07 C

`MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md` now exists at `specs/reconstruct/MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md`.

Plain meaning:

- 9.5-day cycle, Calendar, plannedDate/sessionSlot, race anchor, and cycle labels now have one draft contract.
- `CYCLE_DAY.D-5` 같은 라벨은 달력/사이클 라벨이고, `RULE_SPEC_D1_D9.D-*` 안전 규칙 ID가 아니다.
- Calendar는 계획을 새로 만들거나 선택하지 못하고, D9/Safety Gate 상태를 clear하지 못한다.
- Timezone, race anchor, source ref, uncertainty state를 보존해야 한다.
- `OI-PG-MICROCYCLE-CALENDAR-MAPPING-001`는 아직 닫힌 것이 아니다. Plan Generator/App Bridge/UI target patch와 runtime evidence가 필요하다.

Later productization update:

- `TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md` now exists with the owner-decision provenance in `TRAINING_PLAN_METHOD_DECISION.md`.
- Nine-perspective review is recorded in `TRAINING_PLAN_BLUEPRINT_MULTIPERSPECTIVE_REVIEW.md`.
- It is still draft-for-review with ten canonical blockers and is not Plan Generator/Calendar binding or runtime evidence.

[DRAFT_COMPLETE]
