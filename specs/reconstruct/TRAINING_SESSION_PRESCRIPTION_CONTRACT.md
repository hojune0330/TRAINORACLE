# TRAINING_SESSION_PRESCRIPTION_CONTRACT.md

```yaml
document_metadata:
  doc_id: trainoracle-spec-training-session-prescription
  status: RECONSTRUCTED_WITH_OWNER_ADOPTED_V2_SEED_05
  owner: COACH_HOJUNE
  version: "0.4"
  local_original_found: false
  reconstructed_from_current_product_and_review_sources: true
  restored_original: false
  prior_approved_version_restored: false
  executed_tests_total: 36
  executed_tests_passed: 36
  runtime_authority: false
  template_activation_authority: false
  automatic_prescription_authority: false
  final_marker_required: "[DRAFT_COMPLETE]"
```

## 1. 목적과 경계

이 계약은 상세 훈련을 한 줄의 문자열이 아니라 세트, 반복, 앵커, 회복, 준비,
하향 조정, 중단 조건으로 보존한다. 현재 별도 오너 결정과 신뢰 매니페스트에 의해
채택된 범위는 `TEMPLATE_LIBRARY_SPEC.md` §16A의 네 가지 정체성이다.
`V2-SEED-05@1.0.0`만 채택되었다는 이전 문장은 최초 채택 시점의 이력이다.
숫자가 존재하는 것만으로 선수에게 배정하거나
안전·의학적 허가를 뜻하지 않는다.

이 계약은 다음을 하지 않는다.

- 새 에너지 시스템 측정값, 종합 피로 점수, 회복 완료 판정을 만든다.
- GOAL, PB, SB, 최근 기록 중 하나를 자동으로 가장 빠른 기준으로 고른다.
- 교차 종목 변환, VDOT 계산, 30m 스프린트에 장거리 RP를 적용한다.
- 수행 뒤 코치 범위 비교를 처방 레코드와 합치거나 다음 계획을 자동으로 바꾼다.
- D9 `ACTIVE` 또는 `UNKNOWN`을 해제하거나 자유서술 메모를 사용한다.

### 1.1 선택 화면과 확장 경계 (2026-09-02)

새 상세 후보는 기존 후보의 반복 수를 임의로 나누거나 회복 시간을 바꿔 만들지
않는다. 동일 종목·목적·경험에 맞는 별도 채택본만 후보가 된다. 현재 네 종목에
각 한 가지가 있다는 사실을 "종목별 다양한 MAIN 제공 완료"로 표현하지 않는다.

선택 전에는 승인된 구조에서 반복 거리·횟수, 반복 사이/세트 사이 회복, 준비와
정리를 읽어 보여준다. 숫자 페이스는 선수의 같은 종목 현재 기록을 직접 고르고
확인한 뒤에만 계산한다. 적용되지 않는 경험 범위는 선택 후 실패시키는 대신
선택 화면에서 설명하고, RPE 기준 계획을 계속 제공한다. 나이/성별 배율은 없다.

RPE 기준 계획과 상세 계획의 선택은 처방의 표현·근거 차이이며, 서로 다른
과학적 효능을 가진 MAIN 두 개로 세지 않는다. 승인 자료의 출처와 운영상 조정,
미검토 연구 후보를 구분한다. 원래 문서의 정본 지위와 열린 이슈는 유지한다.

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

type PaceTargetKind =
  | "RACE_PACE"
  | "EFFORT_GUIDANCE"
  | "SPRINT_REFERENCE";

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
  paceTargetKind: PaceTargetKind | null;
  paceTargetEventDistanceM: number | null;
  displayRoundingPolicyVersion: string | null;
  repetitionRecoverySeconds: number | null;
  repetitionRecoveryMode: RecoveryMode;
  setRecoverySeconds: number | null;
  setRecoveryMode: RecoveryMode;
  warmupComponent: PrescriptionWarmupComponent;
  cooldownComponent: PrescriptionCooldownComponent;
  fallbackComponent: PrescriptionFallbackComponent;
  stopConditionComponent: PrescriptionStopConditionComponent;
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
| `COACH_REFERENCE` | `eventDistanceM`, `performanceSeconds`, `sourceRef` | one of `CURRENT_CAPABILITY`, `SEASON_CONTEXT`, or `ASPIRATIONAL_TARGET` | The chosen enum purpose and coach source must be explicit; it is never an unnamed population default. |
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
  race_pace_target:
    when: paceTargetKind=RACE_PACE
    required_non_null_fields: [paceAnchorRef, paceTargetEventDistanceM]
    anchor_event_must_equal_target_event: true
    mismatch_result: CROSS_EVENT_MODEL_REQUIRED
  non_race_pace_target:
    when: paceTargetKind in [EFFORT_GUIDANCE, SPRINT_REFERENCE, null]
    paceTargetEventDistanceM: null
    no_race_pace_math: true
  incomplete_anchor:
    numeric_pace_output: forbidden
    derived_pace_duration: unavailable_with_ANCHOR_INCOMPLETE
  display_rounding_policy_version_required_when_numeric_pace_is_shown: true
  catalog_seed_text_must_not_be_deserialized_as_StructuredPrescription: true
  lowercase_r_means: between_repetitions_inside_a_set
  uppercase_R_means: between_sets
  set_end_rule: set_recovery_replaces_repetition_recovery
  warmup_and_cooldown_excluded_from_quality_totals: true
  quality_and_sprint_templates_require_warmup_cooldown_downshift_stop_refs: true
  missing_required_component_or_fingerprint: REJECT_ATOMICALLY
  runtime_repetition_arithmetic_for_downshift: forbidden
  RPE_ONLY_CONTROLLED: DELEGATE_TO_EXISTING_RPE_CANDIDATE_ATOMICALLY
  age_only_training_rejection_or_dose_change: forbidden
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
| `qualityDurationSeconds` | `totalRepetitions * repetitionDurationSeconds`, or `totalRepetitions * targetRepSeconds` after a valid same-event race-pace calculation | `REPETITION_DURATION_MISSING`, `PACE_TARGET_UNRESOLVED`, `CROSS_EVENT_MODEL_REQUIRED` |
| `repetitionRecoveryOccurrences` | `setCount * max(repetitionsPerSet - 1, 0)` | `RECOVERY_STRUCTURE_INCOMPLETE` |
| `repetitionRecoveryTotalSeconds` | occurrences times `repetitionRecoverySeconds` | `REPETITION_RECOVERY_MISSING` |
| `setRecoveryOccurrences` | `max(setCount - 1, 0)` | `SET_STRUCTURE_INCOMPLETE` |
| `setRecoveryTotalSeconds` | occurrences times `setRecoverySeconds` | `SET_RECOVERY_MISSING` |
| `mainSessionTotalExcludingWarmupCooldown` | known work duration plus known repetition/set recovery totals | `WORK_DURATION_UNAVAILABLE` or another listed missing code |

The record stores `uncomputableReasonCodes: string[]`; it never fills unavailable
values with zero merely to produce a total.

### 5.2 Same-event RP calculation

```text
targetRepSeconds =
  anchorPerformanceSeconds * repetitionDistanceMeters / anchorEventDistanceMeters
```

This formula is allowed only when `paceTargetKind=RACE_PACE` and
`paceTargetEventDistanceM` equals the anchor's `eventDistanceM`. Internal values are
not rounded. A future display must retain `displayRoundingPolicyVersion`. Different
events return `CROSS_EVENT_MODEL_REQUIRED`; this draft does not supply such a model.

## 6. Fixtures

### 6.1 Adopted V2-SEED-05 prescription

```yaml
fixture_id: V2-SEED-05@1.0.0
authority: TO-V2-SEED-05-OWNER-ADOPTION-2026-08-17
scope: { event: FIVE_K, experience: EXPERIENCED, population: YOUTH_AND_ADULT }
anchor: { eventDistanceM: 5000, freshnessState: CURRENT, purpose: CURRENT_CAPABILITY }
notation: "5×1000m @5000m RP · r150″ JOG"
main: { setCount: 1, repetitionsPerSet: 5, repetitionDistanceM: 1000 }
recovery: { occurrences: 4, secondsEach: 150, mode: JOG, totalSeconds: 600 }
qualityDistanceM: 5000
warmup:
  ref: WU-V2-5K-01@1.0.0
  authority: OWNER_OPERATIONAL_ADAPTATION
  content: "15 min easy RPE 2-3; 4x20 sec progressive strides; 40 sec easy walk/jog between"
cooldown:
  ref: CD-V2-5K-01@1.0.0
  authority: OWNER_OPERATIONAL_ADAPTATION
  content: "10 min easy RPE 1-2"
fallback:
  code: RPE_ONLY_CONTROLLED
  behavior: DELEGATE_TO_EXISTING_RPE_CANDIDATE_ATOMICALLY
  numericRepetitionVariant: null
stopConditionAuthority: OWNER_PRECAUTIONARY_OPERATIONAL_RULE_NOT_DIAGNOSIS
stopConditionCodes:
  - STOP_NEW_OR_WORSENING_PAIN
  - STOP_DIZZINESS_OR_FAINTNESS
  - STOP_CHEST_PAIN_OR_UNUSUAL_BREATHING
  - STOP_LOSS_OF_CONTROLLED_FORM
ageOnlyReject: false
ageOnlyDoseMultiplier: false
```

### 6.2 Notation-parser regression fixture

```yaml
fixture_id: OWNER-NOTATION-001
notation: "2×(10×400m) @5000m RP · r60″ STAND · R3′ STAND"
fixture_stage: UNBOUND_NOTATION_PARSE_ONLY
setCount: 2
repetitionsPerSet: 10
totalRepetitions: 20
repetitionDistanceM: 400
qualityDistanceM: 8000
repetitionRecoveryOccurrences: 18
setRecoveryOccurrences: 1
plannedRecoverySeconds: 1260
expected_parse:
  paceTargetKind: RACE_PACE
  paceTargetEventDistanceM: 5000
  paceAnchorRef: null
  numericPaceOutput: UNAVAILABLE_ANCHOR_INCOMPLETE
  fullStructuredPrescriptionCreation: forbidden_until_explicit_anchor_is_selected
plainKoreanReading: >
  400미터를 5000미터 경기 페이스로 10번 달립니다. 반복 사이에는 60초 쉽니다.
  10번을 마치면 3분 쉬고 같은 세트를 한 번 더 합니다. 총 20번입니다.
fixture_authority: notation_parser_regression_case_only
template_activation: forbidden
```

The parser may preserve that the notation names a `5000m` race-pace target, but it
must not construct a usable `StructuredPrescription`, calculate seconds, or show a
numeric pace until a separate explicit anchor is selected and passes the invariants
above. The notation itself is never an athlete-specific pace source.

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
  active_numeric_template_allowlist:
    - V2-SEED-05@1.0.0
    - MD-800-01@1.0.0
    - MD-1500-01@1.0.0
    - MD-3000-01@1.0.0
```

No other `DRAFT` entry in the companion catalogue is queryable by the beta Plan
Generator. The allowlist supplies neither canonical promotion nor issue closure.

## 9. 2026-08-24 Beta Runtime Synchronization

```yaml
runtime_sync:
  exact_event_template_pairs:
    - { eventDistanceM: 800, template: MD-800-01@1.0.0, intent: GLY_INTENT }
    - { eventDistanceM: 1500, template: MD-1500-01@1.0.0, intent: MIXED_INTENT }
    - { eventDistanceM: 3000, template: MD-3000-01@1.0.0, intent: VO2_INTENT }
    - { eventDistanceM: 5000, template: V2-SEED-05@1.0.0, intent: VO2_INTENT }
  authority_requirements:
    exact_template_identity_and_fingerprint: REQUIRED
    athlete_experience: EXPERIENCED_ONLY
    explicitly_selected_record: REQUIRED
    record_freshness: CURRENT_ONLY
    record_event_match: EXACT_SAME_EVENT_ONLY
    race_goal_anchor: FORBIDDEN
    cross_event_conversion: FORBIDDEN
  numeric_pace_storage:
    retain_unrounded_internal_value: true
    display_rounding_separate: true
  failure_behavior:
    partial_numeric_prescription: FORBIDDEN
    fallback: ATOMIC_RPE_ONLY_CONTROLLED
```

`OWNER-NOTATION-001` remains an unbound parser regression fixture. Its notation must
not be mistaken for an activated athlete prescription, even though a different exact
5000 m template identity is allowlisted above.

## 12. Structured Sequence And Rationale Extension (2026-09-02)

Owner-approved direction: support distance, duration and ordered mixed work blocks
with explicit work targets, repetitions, within-block recovery and between-block
recovery. A typed sequence is a representation contract, not activation authority.
Unknown distance or duration stays unknown; never infer one merely from the other.
Uniform V1 prescriptions retain their identity, arithmetic and accepted components.

Every session explanation binds its exact session/prescription content, explanation
version, template identity/version and source references. Numbers are rendered from
the prescription, not independently authored prose. Changing work or recovery must
invalidate an old explanation snapshot. Missing historical explanations do not
authorize invented historical selection reasons or rewriting an accepted plan.

Candidate method distinction excludes label-only, unit-only, repetition-count-only
and warmup-only differences. Different main-work structure or repeat unit requires
an explicit reviewed pair rationale. Method difference is not proof of equal dose
or physiological effect. Target is two valid same-purpose methods, never two copies
or two sessions the athlete is required to perform. A missing second adopted method
is an open delivery gap, not permission to manufacture one.

Keep 800 m through marathon scope and age-neutral/self-service authority. Short
work may be placed when its reviewed eligibility and cycle purpose fit, without
adding duplicate warmup strides or automatically increasing frequency/volume.
100-400 m specialist activation remains excluded. Existing specific template
adoption and source-review requirements remain in force.

Change ledger: ADD typed sequences and content-bound rationale; KEEP V1 storage,
exact existing numeric adoptions and safety; DEFER activation without exact dose
and applicability acceptance. Existing runtime counts are historical, not evidence
for this extension.

### 12.1 Candidate Comparison Projection

Candidate comparison reads the actual session prescriptions, not candidate names.
Match MAIN sessions by day and AM/PM slot; also compare event, selected purpose and
per-session purpose before making a shared-work claim. A missing or duplicated slot,
different context or unreadable structure cannot be labelled identical.

Distinguish exact same prescribed work from the same method with changed dose and
from a structurally different method awaiting pair review. Repetition-only changes
are not a second method; a changed athlete anchor is not a different method either.
RPE/time envelopes without explicit repeat units remain structurally uncomparable,
even when both saved envelopes match. Never translate these into invented intervals.

The comparison exposes work, recovery, target intensity, available time information
and limitations in that order. Do not call a pace-target prescription an RPE target.
Whole-session time envelopes are not main-work time, and uncomputed elapsed time is
not zero. Identical work can be displayed once, with matching day/slot references.
Structural differences do not authorize selection, activation or equivalent-effect
claims; existing runtime adoption gates remain unchanged.

Derived comparison/sequence views are not separately persisted as a second source
of prescription authority. Existing stored prescriptions and explanation receipts
remain authoritative. This addition does not activate new templates or close the
two-distinct-MAIN-method delivery gap.

### 12.2 Explicit Method Changes Before Selection

The candidate screen may change the explicitly selected, currently authorized
template without restarting the intake. Preserve event, purpose, experience,
availability, frame, AM/PM preference and the chosen start date. A method change
regenerates candidates through the existing safety and eligibility gates; it does
not edit a stored plan, increase MAIN exposure, or silently select another record.

Changing to a detailed method invalidates the previous pace confirmation. Keep the
record visibly selected for convenience, but calculate and activate its new target
only after explicit reconfirmation. RPE-only is an alternate prescription basis,
not a second detailed MAIN method. Do not invent a second method when only one is
adopted. An unavailable/expired/mismatched template is rejected, not substituted.

Draft changes invalidate outstanding saves and storage retries. Check the draft
revision again inside the mutation lock, immediately before persistence. If the
user changes the record/method/start date or returns to intake while a save waits for that
lock, the old candidate must not become active later. Historical plans and their
explanation receipts remain unchanged.

Change ledger: ADD candidate-stage explicit choice and stale-save invalidation;
KEEP exact template adoption, source/transfer review and numeric allowlists;
DEFER unaccepted second-method doses. No approval or issue closure is implied.

### 12.3 Distance-Based Recovery Representation

Sequence version 2 adds an explicit positive `distanceM` to a recovery segment,
with `seconds: null`. Version 1 remains unchanged and rejects this new field.
Distance recovery permits WALK, JOG, WALK_OR_JOG or ACTIVE_ROLL_ON; standing and
NOT_APPLICABLE cannot carry a recovery distance. ACTIVE_ROLL_ON describes movement
continued between work bouts and is not silently renamed JOG or assigned a pace.

Distance and duration are exclusive prescribed recovery units. Do not convert a
100 m recovery to 100 seconds or derive recovery time from the work/race pace.
MAIN work distance excludes recovery distance. Report repetition, set, transition and terminal
recovery distances separately; a total with an unknown component remains unknown.
An absent recovery occurrence is zero occurrences, not missing data. Existing
time-based totals and version 1 serialization retain their original shape.

As in version 1, between-repeat recovery occurs N-1 times; a last child's unused
recoveryAfter is not appended. Version 2 requires an explicit root `terminalRecovery`
for recovery after the final MAIN work and before cooldown, including an explicit
NOT_APPLICABLE when none is prescribed. Version 1 rejects this field. Count that
occurrence separately and include it in recovery totals, never in MAIN work distance.
Do not infer final recovery from an unused recoveryAfter or count it again as cooldown.
Structural comparison includes recovery unit, amount and mode. This representation
does not adopt a source example or allow it through the athlete plan schema.

[DRAFT_COMPLETE]
