# TERRA_WORK_ORDER_019_DETAILED_PRESCRIPTION_RUNTIME.md

```yaml
document_metadata:
  doc_id: trainoracle-work-order-019-detailed-prescription-runtime
  status: ISSUED_WAITING_FOR_DEPENDENCIES
  owner: COACH_HOJUNE
  prepared_by: CODEX
  version: "1.0"
  issued_at: "2026-07-26"
  requested_model: gpt-5.6-terra
  requested_reasoning_effort: xhigh
  base_branch: main
  base_commit: 0d5dc6548f920ca882f2d555b92b37f3c91ab6c7
  runtime_authority: false
  template_activation_authority: false
  deployment_authority: false
  final_marker_required: "[DRAFT_COMPLETE]"
```

## 1. 목적

상세 훈련 처방을 문자열이나 화면 문구가 아니라 테스트 가능한 도메인 코드로 만든다.
첫 구현은 표기 해석, 같은 종목 레이스 페이스 계산, 파생 합계, 활성화 거부 경계까지다.
선수에게 보이는 실제 상세 처방과 템플릿 활성화는 아직 하지 않는다.

대표 회귀 fixture는 다음과 같다.

```text
2×(10×400m) @5000m RP · r60″ · R3′
```

```yaml
expected:
  setCount: 2
  repetitionsPerSet: 10
  totalRepetitions: 20
  repetitionDistanceM: 400
  qualityDistanceM: 8000
  repetitionRecoverySeconds: 60
  repetitionRecoveryOccurrences: 18
  setRecoverySeconds: 180
  setRecoveryOccurrences: 1
  plannedRecoverySeconds: 1260
  numericPaceOutputBeforeAnchorSelection: UNAVAILABLE_ANCHOR_INCOMPLETE
```

## 2. 착수 게이트

아래 두 조건을 모두 확인하기 전에는 코드 작업을 시작하지 않는다.

1. PR #120이 `main`에 병합되어 현재 Plan Beta의 쉬운 문구와 `미지정` 경계가 기준선이 됨
2. PR #123이 독립 재검수 `APPROVE`를 받고 `main`에 병합됨

PR #123에서 확인할 최소 head는 독립 검수 P1 수정이 들어간
`9ae4cb9e8437840f8a443e0733d1d70a89b933a6` 이후다.

조건이 충족되지 않으면 다음 형식으로 정지 보고만 남긴다.

```yaml
status: BLOCKED_BY_UNMERGED_DEPENDENCY
missing:
  - exact_pr_and_required_state
files_changed: []
```

## 3. source of truth

병합된 파일만 읽는다. 대화 요약이나 PR 설명만으로 계약이 존재한다고 판단하지 않는다.

필수 입력:

- `specs/reconstruct/TRAINING_SESSION_PRESCRIPTION_CONTRACT.md`
- `specs/reconstruct/ENERGY_SYSTEM_SESSION_TEMPLATE_CATALOG.md`
- `specs/active/TEMPLATE_LIBRARY_SPEC.md`
- `specs/reconstruct/PLAN_SAFETY_GATE_SPEC.md`
- `specs/active/PLAN_GENERATOR_SPEC.md`
- `specs/reconstruct/TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md`
- `impl/src/plan-generator/*`
- `impl/src/safety-gate/gate.ts`

## 4. 허용 범위

```yaml
allowed_write_scope:
  - impl/src/prescription/**
  - impl/test/prescription-*.test.ts
  - impl/src/index.ts
  - reports/implementation/DETAILED_PRESCRIPTION_RUNTIME_IMPLEMENTATION_REPORT.md

conditionally_allowed_after_domain_tests:
  - impl/src/plan-generator/types.ts
  - impl/src/plan-generator/generator.ts
  - impl/test/plan-beta-generation.test.ts

forbidden_write_scope:
  - app/**
  - specs/reconstruct/ENERGY_SYSTEM_SESSION_TEMPLATE_CATALOG.md
  - specs/reconstruct/TRAINING_SESSION_PRESCRIPTION_CONTRACT.md
  - runtime-evidence/d9-evaluator/**
  - payment_or_subscription_code
  - deployment_configuration
```

`app/**` 변경은 Fable UX 검토와 별도 작업지시 전까지 금지한다.

## 5. Task A — typed prescription domain

다음 타입을 현재 계약과 같은 의미로 구현한다.

- `PaceAnchorRecord`
- `StructuredPrescription`
- `RecoveryMode`
- `PaceTargetKind`
- `PrescriptionDerivedTotals`
- 안정적인 `PrescriptionErrorCode` union

숫자는 유한수이며 허용된 필드는 양수여야 한다. 계산 불가 값을 `0`으로 채우지 않는다.
입력 오류는 예외 문자열이 아니라 구조화된 거부 결과로 반환한다.

## 6. Task B — notation parser and formatter

최소 지원 문법:

- `10×400m`
- `2×(10×400m)`
- `@5000m RP`
- `r60″`
- `R3′`
- 공백과 구분점 `·`의 허용된 변형

구문 의미:

- 소문자 `r`: 한 세트 안 반복 사이 회복
- 대문자 `R`: 세트 사이 회복
- 세트 마지막 반복 뒤에는 `r`을 더하지 않고 `R`이 대신함

필수 거부:

- 0 또는 음수 세트·반복·거리·회복
- 단위 누락
- 괄호 불균형
- `r`과 `R`의 위치가 구조와 맞지 않음
- 한 반복에 거리와 시간을 동시에 부여
- 알 수 없는 페이스 앵커를 숫자로 추정

formatter는 파싱된 구조를 하나의 정규 표기로 되돌린다. 같은 의미의 입력은 동일한 출력으로
정규화되어야 한다.

## 7. Task C — same-event race-pace calculator

허용 공식:

```text
targetRepSeconds =
  anchorPerformanceSeconds * repetitionDistanceM / anchorEventDistanceM
```

허용 조건:

- `paceTargetKind=RACE_PACE`
- 명시적으로 선택된 `paceAnchorRef` 존재
- 앵커 종목 거리와 목표 RP 종목 거리가 같음
- 필수 provenance가 모두 존재
- 표시 반올림 정책 버전이 존재

필수 거부:

- `GOAL`을 `CURRENT_CAPABILITY`로 변경
- PB가 오래됐다는 사실을 숨김
- SB의 시즌 누락
- 종목 간 임의 변환
- 30m 이하 스프린트에 5K/T/I/RP 적용
- 앵커를 자동으로 가장 빠른 기록으로 선택

내부 계산은 반올림하지 않는다. 화면 표시용 반올림은 별도 함수와 버전으로 분리한다.

## 8. Task D — derived totals

다음을 독립 순수 함수로 계산한다.

- 총 반복 수
- 품질 구간 거리 또는 시간
- 반복 회복 횟수와 합계
- 세트 회복 횟수와 합계
- 준비·정리운동을 제외한 본운동 총 시간

계산에 필요한 값이 없으면 `uncomputableReasonCodes`를 반환한다.

대표 fixture는 반드시 다음을 만족한다.

```yaml
totalRepetitions: 20
qualityDistanceM: 8000
repetitionRecoveryOccurrences: 18
setRecoveryOccurrences: 1
plannedRecoverySeconds: 1260
```

## 9. Task E — lifecycle and safety refusal

이번 단계에서 카탈로그 30개는 모두 `DRAFT`다. 따라서 실제 Plan Generator 입력으로
변환되는 항목 수는 반드시 `0`이어야 한다.

필수 거부:

- lifecycle이 `ACTIVE`가 아님
- eligibility가 사람 검토 대기
- event/experience eligibility가 비어 있음
- Safety Gate가 `ACTIVE` 또는 `UNKNOWN`
- raw memo, symptom clause, private self-only signal을 사용하려 함
- catalog Markdown을 runtime 객체로 직접 역직렬화하려 함

이번 PR은 향후 바인딩 인터페이스와 거부 테스트까지만 만든다. 활성 템플릿이 없으므로
현재 공개 Plan Beta의 `RPE_TIME_RANGE` 후보를 상세 숫자 처방으로 바꾸지 않는다.

## 10. 필수 테스트

최소 테스트:

1. 대표 fixture parse
2. parse → format → parse 왕복
3. `r`/`R` 구분과 세트 끝 대체 규칙
4. 총 20회·8,000m·18회·1회·1,260초
5. 5,000m 16분 40초 앵커에서 400m 80초 계산
6. 앵커 없는 RP 숫자 출력 거부
7. 다른 종목 앵커 거부
8. GOAL을 현재 능력으로 사용하는 요청 거부
9. 30m 스프린트 레이스 페이스 변환 거부
10. 잘못된 숫자·단위·괄호 거부
11. DRAFT 템플릿 바인딩 거부
12. `D9_ACTIVE`와 `D9_UNKNOWN` 모두 후보·처방 없음
13. raw memo와 private signal이 결과·감사 객체에 없음
14. 기존 Plan Beta 결과와 순서가 바뀌지 않음

실행:

```text
impl typecheck
impl tests
app unit tests
app typecheck
app build
contract-tests
git diff --check
```

브라우저 UI가 바뀌지 않으므로 새 화면 증거를 만들지 않는다. 기존 E2E 회귀는 실행한다.

## 11. PR 및 검수 라우팅

```yaml
route:
  implementation: TERRA_XHIGH
  first_review: SOL_HIGH_CODE_AND_SAFETY
  owner_gate: COACH_HOJUNE
  later_ui_review: FABLE
```

한 PR에 도메인 코드, 직접 테스트, 구현 보고서만 넣는다. PR은 Draft로 만들고 아래를 링크한다.

- PR #120
- PR #123
- 이 작업지시 PR
- 실행한 CI

Sol은 exact head SHA를 기준으로 다음만 검수한다.

- 계약과 타입 의미 일치
- 파서·계산기 fail-closed
- D9/메모/미성년·템플릿 활성화 경계
- 기존 공개 Plan Beta 무변경

## 12. 완료 조건

```yaml
stop_when:
  - parser_formatter_tests_pass
  - same_event_pace_tests_pass
  - derived_total_tests_pass
  - all_30_draft_seeds_rejected_from_runtime
  - existing_plan_beta_behavior_unchanged
  - full_ci_green
  - draft_pr_and_evidence_comment_created

must_remain_false:
  - active_numeric_template_exists
  - public_detailed_prescription_enabled
  - cross_event_model_enabled
  - automatic_template_activation
  - medical_clearance_claim
  - raw_note_used_for_dose
```

이 단계가 끝나면 별도 사람 검토를 통해 작은 활성화 후보군을 선정한 뒤,
Fable이 선수용 3단계 설명 UX를 검토하고 Terra가 화면에 연결한다.

[DRAFT_COMPLETE]
