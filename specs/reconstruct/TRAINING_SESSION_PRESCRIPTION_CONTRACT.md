# TRAINING_SESSION_PRESCRIPTION_CONTRACT.md

```yaml
document_metadata:
  doc_id: trainoracle-spec-training-session-prescription
  status: RECONSTRUCTED_DRAFT_FOR_REVIEW
  owner: COACH_HOJUNE
  version: "0.1"
  local_original_found: false
  reconstructed_from_current_product_and_review_sources: true
  restored_original: false
  prior_approved_version_restored: false
  executed_tests_total: 0
  executed_tests_passed: 0
  runtime_authority: false
  template_activation_authority: false
  automatic_prescription_authority: false
  final_marker_required: "[DRAFT_COMPLETE]"
```

## 1. 목적과 경계

이 계약은 상세 훈련을 한 줄의 문자열이 아니라 세트, 반복, 앵커, 회복, 준비,
하향 조정, 중단 조건으로 보존하는 초안이다. 숫자가 존재하는 것만으로 선수에게
배정하거나 안전·의학적 허가를 뜻하지 않는다.

이 계약은 다음을 하지 않는다.

- 새 에너지 시스템 측정값, 종합 피로 점수, 회복 완료 판정을 만든다.
- GOAL, PB, SB, 최근 기록 중 하나를 자동으로 가장 빠른 기준으로 고른다.
- 교차 종목 변환, VDOT 계산, 30m 스프린트에 장거리 RP를 적용한다.
- 수행 뒤 코치 범위 비교를 처방 레코드와 합치거나 다음 계획을 자동으로 바꾼다.
- D9 `ACTIVE` 또는 `UNKNOWN`을 해제하거나 자유서술 메모를 사용한다.

## 2. 소유권과 소비 순서

```yaml
ownership:
  template_library:
    owns: [template_id, template_version, lifecycle, source_and_transfer_limits]
  safety_gate:
    owns: [generation_allow_or_block]
  plan_generator:
    may_combine: [eligible_active_template, explicit_pace_anchor]
    may_not: [mutate_template, bypass_lifecycle, clear_safety]
  formation:
    owns: [main_support_recovery_placement, duplicate_management]
  calibration:
    owns: [completed_record_vs_coach_range_comparison_only]
```

The required order for a later runtime is `Safety Gate -> Template Library eligibility
filter -> Plan Generator -> Formation placement`. This draft neither implements nor
authorizes that runtime.

## 3. Core types

```typescript
type PlanningIntent =
  | "BASE_INTENT"
  | "LT_INTENT"
  | "VO2_INTENT"
  | "GLY_INTENT"
  | "ATP_PC_INTENT"
  | "RECOVERY_INTENT"
  | "MIXED_INTENT";

type PaceAnchorKind =
  | "RECENT_RESULT"
  | "PB"
  | "SB"
  | "GOAL"
  | "COACH_REFERENCE"
  | "RPE_ONLY"
  | "SPRINT_BENCHMARK";

type PaceAnchorEnteredBy = "ATHLETE" | "COACH" | "VERIFIED_IMPORT";
type PaceAnchorVerification = "VERIFIED" | "SELF_REPORTED" | "UNVERIFIED";
type PaceAnchorFreshness = "CURRENT" | "STALE" | "UNKNOWN";
type PaceAnchorPurpose =
  | "CURRENT_CAPABILITY"
  | "SEASON_CONTEXT"
  | "ASPIRATIONAL_TARGET"
  | "SPRINT_REFERENCE"
  | "EFFORT_ONLY";

interface PaceAnchorRecord {
  anchorId: string;
  kind: PaceAnchorKind;
  eventDistanceM: number | null;
  performanceSeconds: number | null;
  achievedAt: string | null;
  seasonId: string | null;
  enteredBy: PaceAnchorEnteredBy;
  sourceRef: string;
  verificationState: PaceAnchorVerification;
  freshnessState: PaceAnchorFreshness;
  purpose: PaceAnchorPurpose;
}

type RecoveryMode =
  | "WALK"
  | "JOG"
  | "STAND"
  | "FULL_RECOVERY"
  | "COACH_DEFINED"
  | "NOT_APPLICABLE";

interface StructuredPrescription {
  setCount: number | null;
  repetitionsPerSet: number | null;
  repetitionDistanceM: number | null;
  repetitionDurationSeconds: number | null;
  paceAnchorRef: string | null;
  repetitionRecoverySeconds: number | null;
  repetitionRecoveryMode: RecoveryMode;
  setRecoverySeconds: number | null;
  setRecoveryMode: RecoveryMode;
  warmupComponentRef: string | null;
  cooldownComponentRef: string | null;
  downshiftOptionRefs: string[];
  stopConditionCodes: string[];
}
```

`PlanningIntent` is a coach-declared planning label, not a measured physiological
result or an automatic classification of a completed session.

## 4. Pace-anchor invariants

| Kind | Required facts | Required purpose | Boundary |
|---|---|---|---|
| `RECENT_RESULT` | `eventDistanceM`, `performanceSeconds`, `achievedAt`, `sourceRef` | `CURRENT_CAPABILITY` | Freshness and verification remain visible; stale is not silently current. |
| `PB` | `eventDistanceM`, `performanceSeconds`, `achievedAt`, `sourceRef` | `CURRENT_CAPABILITY` | A PB can be old; it is never assumed to be current without its state. |
| `SB` | `eventDistanceM`, `performanceSeconds`, `achievedAt`, `seasonId`, `sourceRef` | `SEASON_CONTEXT` | A season must be named. |
| `GOAL` | `eventDistanceM`, `performanceSeconds`, `sourceRef` | `ASPIRATIONAL_TARGET` | It may never become `CURRENT_CAPABILITY`. UI labels it `GOAL RP`. |
| `COACH_REFERENCE` | `eventDistanceM`, `performanceSeconds`, `sourceRef` | explicit coach context | It is a named reference, not a hidden population default. |
| `RPE_ONLY` | `eventDistanceM: null`, `performanceSeconds: null` | `EFFORT_ONLY` | A numeric pace is not estimated. |
| `SPRINT_BENCHMARK` | `eventDistanceM`, `performanceSeconds`, `achievedAt`, `sourceRef` | `SPRINT_REFERENCE` | It may not be derived from 5K/T/I/RP. |

`enteredBy`, `verificationState`, `freshnessState`, and `sourceRef` always travel
with an anchor. A missing required fact returns `ANCHOR_INCOMPLETE`, not a guessed
pace.

## 5. Structured prescription invariants

```yaml
prescription_invariants:
  positive_counts_and_values_required_when_present: true
  work_distance_and_work_duration_simultaneously_present: forbidden_for_one_rep
  lowercase_r_means: between_repetitions_inside_a_set
  uppercase_R_means: between_sets
  set_end_rule: set_recovery_replaces_repetition_recovery
  warmup_and_cooldown_excluded_from_quality_totals: true
  quality_and_sprint_templates_require_warmup_cooldown_downshift_stop_refs: true
  sprint_under_60m:
    allowed_anchor_kinds: [SPRINT_BENCHMARK, COACH_REFERENCE, RPE_ONLY]
    race_pace_conversion_forbidden: true
  raw_note_input_for_dose: forbidden
  private_self_only_signal: forbidden
```

### 5.1 Derived totals

| Derived field | Deterministic rule | Unavailable reason examples |
|---|---|---|
| `totalRepetitions` | `setCount * repetitionsPerSet` | `SET_COUNT_MISSING`, `REPETITIONS_PER_SET_MISSING` |
| `qualityDistanceM` | `totalRepetitions * repetitionDistanceM` | `REPETITION_DISTANCE_MISSING`, time-based repetition |
| `qualityDurationSeconds` | `totalRepetitions * repetitionDurationSeconds` | `REPETITION_DURATION_MISSING`, distance-based repetition without pace duration |
| `repetitionRecoveryOccurrences` | `setCount * max(repetitionsPerSet - 1, 0)` | `RECOVERY_STRUCTURE_INCOMPLETE` |
| `repetitionRecoveryTotalSeconds` | occurrences times `repetitionRecoverySeconds` | `REPETITION_RECOVERY_MISSING` |
| `setRecoveryOccurrences` | `max(setCount - 1, 0)` | `SET_STRUCTURE_INCOMPLETE` |
| `setRecoveryTotalSeconds` | occurrences times `setRecoverySeconds` | `SET_RECOVERY_MISSING` |
| `mainSessionTotalExcludingWarmupCooldown` | known work duration plus known repetition/set recovery totals | `WORK_DURATION_UNAVAILABLE` or another listed missing code |

The record stores `uncomputableReasonCodes: string[]`; it never fills unavailable
values with zero merely to produce a total.

### 5.2 Same-event RP calculation, for a later implementation only

```text
targetRepSeconds =
  anchorPerformanceSeconds * repetitionDistanceMeters / anchorEventDistanceMeters
```

This formula is allowed only when the work's RP event and the anchor event are the
same. Internal values are not rounded. A future display must declare a versioned
rounding policy. Different events return `CROSS_EVENT_MODEL_REQUIRED`; this draft
does not supply such a model.

## 6. Example fixture: notation, not an active template

```yaml
fixture_id: OWNER-NOTATION-001
notation: "2×(10×400m) @5000m RP · r60″ · R3′"
setCount: 2
repetitionsPerSet: 10
totalRepetitions: 20
repetitionDistanceM: 400
qualityDistanceM: 8000
repetitionRecoveryOccurrences: 18
setRecoveryOccurrences: 1
plannedRecoverySeconds: 1260
plainKoreanReading: >
  400미터를 5000미터 경기 페이스로 10번 달립니다. 반복 사이에는 60초 쉽니다.
  10번을 마치면 3분 쉬고 같은 세트를 한 번 더 합니다. 총 20번입니다.
fixture_authority: parser_and_display_regression_case_only
template_activation: forbidden
```

## 7. Performed-comparison separation

`PrescriptionRecord` is the intended structured session. `PerformedComparisonRecord`
is a later, non-executing comparison of completed explicit facts against a
coach-confirmed range. They must have distinct identifiers and may link only by a
reference.

```yaml
performed_comparison_boundary:
  statuses: [BELOW_COACH_RANGE, WITHIN_COACH_RANGE, ABOVE_COACH_RANGE, UNAVAILABLE]
  can_modify_prescription: false
  can_modify_next_plan: false
  can_clear_safety: false
  missing_allocation_or_unit: UNAVAILABLE
  parent_component_deduplication: required
```

## 8. Safety and lifecycle gates

```yaml
later_runtime_requirements:
  template_lifecycle_must_be: ACTIVE
  review_required_must_not_auto_bind: true
  D9_ACTIVE: BLOCK
  D9_UNKNOWN: BLOCK_OR_HUMAN_REVIEW
  safety_gate_cleared_is_medical_clearance: false
  private_note_analysis: forbidden
  active_numeric_template_exists_in_this_document: false
```

No `DRAFT` entry in the companion catalogue is queryable by a future Plan Generator.
This document supplies neither runtime evidence nor issue closure.

[DRAFT_COMPLETE]
