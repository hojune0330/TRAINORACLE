# METRIC_ALGORITHM_CONTRACT.md

```yaml
doc_id: trainoracle-spec-021-metric-algorithm-contract
spec_id: METRIC_ALGORITHM_CONTRACT
title: TrainOracle Metric Algorithm Contract
version: "0.1"
round: WORK_ORDER_003_TASK_3
status: DRAFT_FOR_REVIEW
owner: COACH_HOJUNE
source_state:
  local_original_found: false
  new_productization_draft: true
  restored_original: false
  previous_approved_version_restored: false
source_acceptance_decision_state: PENDING_REVIEW
open_issues_total: 7
canonical_blocking_count: 4
executed_tests_total: 0
executed_tests_passed: 0
self_check_is_runtime_evidence: false
canonical_promotion_allowed: false
issue_closure_claimed: false
runtime_evidence_claimed: false
```

---

## 1. Purpose

`METRIC_ALGORITHM_CONTRACT.md` defines draft metric formulas, input requirements, missing-data behavior, uncertainty reporting, and safety boundaries for TrainOracle analysis surfaces.

It addresses Round 3 decision note N1: `ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md` is accepted as a working source for display/data shape, but it does not own final formulas for CTL, ATL, TSB, HR drift, load, or related derived metrics.

This document is a formula contract draft. It is not runtime evidence, not canonical promotion, not a chart implementation, not a Plan Generator, not a D9 evaluator, and not issue closure.

---

## 2. Non-Purpose

This document does not:

- modify `app/`, `ui_kits/`, `preview/`, `design-v3/`, `designs/`, `colors_and_type*.css`, or root `index.html`
- claim these formulas are accepted for production use before owner review
- redefine `RULE_SPEC_D1_D9.D-*`, `D9_ACTIVE`, `D9_UNKNOWN`, `D9_CLEARED`, or ADVISORY
- create, rank, select, or modify plan options
- clear `D9_ACTIVE`, `D9_UNKNOWN`, Safety Gate blocks, human-review requirements, physio conflicts, or template eligibility failures
- diagnose injury, illness, overtraining syndrome, or medical readiness
- store raw athlete free text, raw memo text, raw symptom clauses, injury narratives, medical notes, rehab notes, evidence clauses, or guardian private notes
- authorize external LLM processing with private athlete data
- close `OI-AVD-METRIC-SOURCE-OWNERSHIP-001` or any downstream issue

---

## 3. Source Basis

This draft was created only after local target-file search found no existing `specs/reconstruct/METRIC_ALGORITHM_CONTRACT.md`.

| Source | Treatment |
|---|---|
| `SPEC_SOURCE_ACCEPTANCE_DECISION_ROUND3.md` | N1 requires a separate metric algorithm contract before CTL/ATL/TSB and related metrics have numeric authority. |
| `specs/reconstruct/ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md` | Provides analysis data shape, sourceRefs, uncertainty, and open issue `OI-AVD-METRIC-SOURCE-OWNERSHIP-001`. |
| `specs/reconstruct/DAILY_LOG_AND_CHECKIN_SPEC.md` | Provides structured daily/session fields and raw-text prohibition. |
| `specs/active/SESSION_CLASSIFIER_SPEC.md` | Provides session category/classification source boundary. |
| `specs/active/ATHLETE_PROFILE_SPEC.md` | Provides athlete-scoped configuration boundary for zones, profile context, and defaults. |
| `specs/active/PHYSIO_SOURCE_TRUST_SPEC.md` | Provides source trust/recency/conflict boundary and no-D9-clearing rule. |
| `specs/reconstruct/PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md` | Provides sourceRefs, privacyTier, rationale code, and no raw/private text leakage rules for displayed explanations. |

---

## 4. Global Invariants

```yaml
metric_algorithm_invariants:
  local_files_are_truth: true
  no_runtime_evidence_claim: true
  no_canonical_promotion_claim: true
  source_acceptance_decision_state: PENDING_REVIEW

  formula_version_required: true
  source_refs_required: true
  uncertainty_required: true
  missing_data_must_be_visible: true
  imputation_default_allowed: false
  athlete_specific_config_required_for_zones: true

  metric_can_raise_attention: true
  metric_can_clear_D9: false
  metric_can_clear_SafetyGate: false
  metric_can_create_or_select_plan_options: false
  metric_can_override_coach_or_human_review: false

  raw_free_text_storage_forbidden: true
  raw_symptom_clause_storage_forbidden: true
  private_external_llm_with_athlete_data_forbidden: true
```

---

## 5. Required Metric Envelope

Every derived metric must carry its formula and source envelope.

```yaml
DerivedMetricRecord:
  metricId: string
  metricName: string
  formulaVersion: string
  athleteId: string
  tenantId: string
  window:
    startDate: ISO_DATE
    endDate: ISO_DATE
    timezone: IANA_TIMEZONE
  value:
    type: number | null
    null_when: insufficient_source
  unit: string
  sourceRefs:
    type: array
    required: true
  inputCompleteness:
    requiredInputs: integer
    presentInputs: integer
    missingInputs: string[]
  uncertaintyState:
    enum:
      - complete
      - insufficient_source
      - stale_source
      - conflicting_source
      - estimated_requires_review
  uncertaintyBand:
    lower: number | null
    upper: number | null
    method: none | source_completeness | rolling_variability | configured_error_band
  privacyTier:
    enum:
      - non_sensitive_derived_metric
      - coach_visible_with_consent
      - audit_metadata_only
  nonSensitiveReasonCodes:
    type: array
```

If required inputs are missing, the metric should return `value: null` and `uncertaintyState: insufficient_source` unless a later accepted contract explicitly permits an imputation method.

---

## 6. Draft Formula Set

These formulas are draft defaults. They are not production-authoritative until this document is accepted and implementation/runtime evidence exists.

### 6.1 Session Load

```yaml
session_load_v0_1:
  formulaVersion: session_load.srpe_duration.v0_1
  required_inputs:
    - durationMinutes
    - sessionRpe_0_to_10
  formula: "sessionLoad = durationMinutes * sessionRpe"
  unit: arbitrary_load_units
  missing_behavior:
    missing_duration: insufficient_source
    missing_rpe: insufficient_source
  safety_boundary:
    can_raise_attention: true
    can_clear_D9_or_SafetyGate: false
```

### 6.2 CTL, ATL, And TSB

```yaml
training_stress_balance_v0_1:
  formulaVersion: ctl_atl_tsb.ewma_load.v0_1
  dailyLoadInput: sessionLoad_daily_sum
  default_time_constants:
    ctl_days: 42
    atl_days: 7
  formulas:
    ctl_today: "ctl_yesterday + (dailyLoad - ctl_yesterday) * (1 / ctl_days)"
    atl_today: "atl_yesterday + (dailyLoad - atl_yesterday) * (1 / atl_days)"
    tsb_today: "ctl_today - atl_today"
  required_inputs:
    - date
    - dailyLoad
    - priorCtlOrSeedWindow
    - priorAtlOrSeedWindow
  seed_policy:
    minimum_seed_days: 14
    below_minimum_seed: estimated_requires_review
    no_seed_available: insufficient_source
  configurable_by_profile: true
  safety_boundary:
    can_raise_attention: true
    can_clear_D9_or_SafetyGate: false
```

### 6.3 HR Drift

```yaml
hr_drift_v0_1:
  formulaVersion: hr_drift.decoupling_ratio.v0_1
  intended_use: steady aerobic sessions with comparable first and second segments
  required_inputs:
    - segment1_averageHeartRate
    - segment1_speedOrPace
    - segment2_averageHeartRate
    - segment2_speedOrPace
    - segment_comparability_flag
  formula: "hrDriftPercent = ((hrPerSpeed_segment2 / hrPerSpeed_segment1) - 1) * 100"
  gating:
    if_segment_comparability_flag_false: insufficient_source
    if_missing_hr_or_speed: insufficient_source
  uncertainty:
    gps_noise_or_terrain_change: estimated_requires_review
    heat_or_weather_missing: estimated_requires_review
  safety_boundary:
    can_raise_attention: true
    can_clear_D9_or_SafetyGate: false
```

### 6.4 Load Change And Monotony

```yaml
load_change_v0_1:
  formulaVersion: load_change.rolling_ratio.v0_1
  metrics:
    sevenDayLoad: "sum(sessionLoad over trailing 7 calendar days)"
    twentyEightDayLoad: "sum(sessionLoad over trailing 28 calendar days)"
    loadRatio: "sevenDayLoad / (twentyEightDayLoad / 4)"
  missing_behavior:
    fewer_than_7_days: insufficient_source
    fewer_than_28_days: estimated_requires_review

monotony_v0_1:
  formulaVersion: monotony.daily_load_variability.v0_1
  formula: "mean(dailyLoad_7d) / standardDeviation(dailyLoad_7d)"
  missing_behavior:
    zero_variance: estimated_requires_review
    fewer_than_7_days: insufficient_source
```

---

## 7. Input Ownership

| Input | Owner source | Required source state |
|---|---|---|
| `durationMinutes` | Session record / classifier | confirmed or coach-reviewed |
| `sessionRpe` | Daily Log / post-session check-in | structured value only |
| `distance` | Session record / device import | sourceRef required |
| `pace` or `speed` | Session record / device import | sourceRef required |
| `heartRate` | Device/physio source | trust/recency/conflict state required |
| `training zones` | Athlete Profile | athlete-scoped config, versioned |
| `race/session category` | Session Classifier | classification confidence required |
| `weather/terrain` | Optional contextual source | missing must be visible |

Metrics must not infer missing athlete profile values from raw free text.

---

## 8. Safety And Plan Generator Boundary

Derived metrics are analytical signals, not safety dispositions and not plan choices.

```yaml
metric_safety_boundary:
  may_feed:
    - AnalysisVisualization
    - DailyBrief_attention_item
    - CoachReview_context
    - PlanOutputRationale_sourceRef
  may_raise:
    - attention
    - uncertainty
    - human_review_recommendation
  must_not_write:
    - D9_disposition
    - RVE_storedStatus
    - SafetyGate_decision
    - PlanGenerator_selected_option
    - medical_clearance
  cannot_clear:
    - D9_ACTIVE
    - D9_UNKNOWN
    - SafetyGate_BLOCK
    - SafetyGate_REVIEW
```

Any future Plan Generator consumption must go through accepted sourceRefs and reason codes. Metrics cannot bypass RVE or Safety Gate.

---

## 9. Display Requirements

```yaml
metric_display_requirements:
  show_formula_version: true
  show_source_coverage_when_incomplete: true
  show_uncertainty_state: true
  show_stale_or_conflicting_source: true
  show_units: true
  hide_raw_private_inputs: true
  avoid_medical_claim_language: true
```

Trends and analysis surfaces may show metric values only with visible source/uncertainty state. If a value is estimated, the display must not present it as exact or safety-authoritative.

---

## 10. Draft Type Shapes

These shapes are contract sketches only. They do not select database, chart library, route names, or implementation modules.

```ts
type MetricUncertaintyState =
  | "complete"
  | "insufficient_source"
  | "stale_source"
  | "conflicting_source"
  | "estimated_requires_review";

type MetricFormulaVersion =
  | "session_load.srpe_duration.v0_1"
  | "ctl_atl_tsb.ewma_load.v0_1"
  | "hr_drift.decoupling_ratio.v0_1"
  | "load_change.rolling_ratio.v0_1"
  | "monotony.daily_load_variability.v0_1";

interface DerivedMetricRecord {
  metricId: string;
  metricName: string;
  formulaVersion: MetricFormulaVersion;
  athleteId: string;
  tenantId: string;
  window: {
    startDate: string;
    endDate: string;
    timezone: string;
  };
  value: number | null;
  unit: string;
  sourceRefs: string[];
  inputCompleteness: {
    requiredInputs: number;
    presentInputs: number;
    missingInputs: string[];
  };
  uncertaintyState: MetricUncertaintyState;
  uncertaintyBand: {
    lower: number | null;
    upper: number | null;
    method: "none" | "source_completeness" | "rolling_variability" | "configured_error_band";
  };
  privacyTier: "non_sensitive_derived_metric" | "coach_visible_with_consent" | "audit_metadata_only";
  nonSensitiveReasonCodes: string[];
}
```

---

## 11. Required Target Patches Before Implementation

This draft can be used as a downstream patch source only after owner review accepts it as a working source.

| Target | Required patch | Issue closure allowed now |
|---|---|---|
| `ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md` | replace "no formula authority" gap with source reference to accepted metric contract, after acceptance | NO |
| `APP_IMPLEMENTATION_BRIDGE.md` | define read endpoints/storage/audit for derived metric records | NO |
| `ATHLETE_PROFILE_SPEC.md` | define athlete-scoped metric configuration ownership for time constants/zones | NO |
| `SESSION_CLASSIFIER_SPEC.md` | bind session category/confidence into metric eligibility | NO |
| `PLAN_GENERATOR_SPEC.md` | if metrics are used in rationale or option filtering, bind only through sourceRefs and non-sensitive reason codes | NO |

Any target patch must open the target file, recount that target's open issue table, and avoid issue closure unless required runtime evidence and owner acceptance exist.

---

## 12. Open Issues

These are this draft's own issues. They do not change issue counts in other SPEC files.

| Issue ID | Priority | Canonical blocking | Status | Problem | Required next evidence |
|---|---|---|---|---|---|
| `OI-MAC-FORMULA-ACCEPTANCE-001` | P1 | YES | OPEN | CTL/ATL/TSB, HR drift, load change, and monotony formulas are draft defaults only. | Owner review must accept formula versions and scope before production use. |
| `OI-MAC-ANALYSIS-BINDING-001` | P1 | YES | OPEN | Analysis/Visualization still owns `OI-AVD-METRIC-SOURCE-OWNERSHIP-001`; this draft has not been patched into that target issue table. | Patch Analysis/Visualization after acceptance, then recount target issues. |
| `OI-MAC-APP-BRIDGE-METRIC-STORAGE-001` | P1 | YES | OPEN | App Bridge does not yet define derived metric endpoints, storage, tenant isolation, audit, or privacy boundary. | Patch App Bridge and verify no raw/private inputs persist. |
| `OI-MAC-RUNTIME-EVIDENCE-001` | P1 | YES | OPEN | No runtime or CI evidence proves formula execution, missing-data behavior, sourceRef preservation, or uncertainty output. | Add actual terminal or CI logs after implementation exists. |
| `OI-MAC-ATHLETE-CONFIG-BINDING-001` | P2 | NO | OPEN | Athlete-specific time constants, zones, and defaults are not accepted in Athlete Profile. | Patch Athlete Profile after formula acceptance. |
| `OI-MAC-HR-DRIFT-ELIGIBILITY-001` | P2 | NO | OPEN | HR drift requires steady comparable segments; eligibility detection is not implementation-bound. | Define session eligibility checks with Session Classifier before production. |
| `OI-MAC-UI-SURFACE-BINDING-001` | P2 | NO | OPEN | Trends and Analysis surfaces are design references only and do not yet show formula/source/uncertainty contract fields. | Patch UI/screen contracts or implementation after this draft is reviewed. |

---

## 13. Self-Check

| Check | Result |
|---|---|
| First line is filename H1 | PASS |
| Final marker is final line | PASS |
| Metadata declares `DRAFT_FOR_REVIEW` | PASS |
| Source decision remains `PENDING_REVIEW` | PASS |
| `executed_tests_total` is 0 | PASS |
| Does not claim runtime evidence | PASS |
| Does not claim canonical promotion | PASS |
| Does not close downstream issues | PASS |
| Open issue count is 7 | PASS |
| Canonical blocking count is 4 | PASS |
| Requires formula version, sourceRefs, and uncertainty | PASS |
| Metrics can raise attention but cannot clear D9 or Safety Gate | PASS |
| Does not create/select plan options | PASS |

[DRAFT_COMPLETE]
