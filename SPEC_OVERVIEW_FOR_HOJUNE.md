# SPEC_OVERVIEW_FOR_HOJUNE.md

```yaml
doc_id: TRAINORACLE_SPEC_OVERVIEW_FOR_HOJUNE
spec_id: TRAINORACLE.SPEC_OVERVIEW_FOR_HOJUNE
title: "TrainOracle SPEC Easy Overview For Hojune"
version: "0.1"
round: RT1
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
| D9 runtime evidence report | D9 evaluator가 실제로 ACTIVE/UNKNOWN/CLEARED/ADVISORY를 맞게 내는지 증명하기 위해 | 실제 terminal 또는 CI 실행 로그 |
| App DB/API schema contracts | 스펙을 실제 DB, API, 앱 구현으로 옮기기 위해 | 핵심 safety/privacy 스펙 acceptance |

현재 가장 가까운 다음 작업은 "이슈 닫기"가 아니다. 다음 순서는 아래에 가깝다.

1. Wave 1 Physio Source Trust 패치 리뷰와 target-file recount 승인.
2. Daily Log를 App Bridge와 Safety Gate에 연결.
3. RVE/Safety Gate/Plan Generator 안전 체인 target patch 보강.
4. 실제 D9 evaluator runtime evidence 확보.
5. Productization drafts are now created; next is target patch, API/schema, and runtime evidence.

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

Remaining productization SPEC:

- None. Productization drafts now exist, but all remain draft-for-review and not runtime evidence.

[DRAFT_COMPLETE]
