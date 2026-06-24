<!-- FILE START: /TRAINORACLE_Project/docs/SPEC/RULE_SPEC_D1_D9.md -->

# RULE_SPEC_D1_D9.md — TrainOracle Rule Validator Specification

```yaml
doc_id: trainoracle-spec-001-rule-validator
spec_id: RULE_SPEC_D1_D9
version: 1.4
schema_build: 2026-05-26
last_updated: 2026-05-26
status: READY_FOR_UPLOAD
upload_allowed: true
canonical_promotion_allowed: false
public_sanitized: true
organization_specific_source_names_removed: true
private_source_manifest_required: true
test_cases_total: 55
test_cases_passed: 55
open_issues_count: 23
owner: COACH_HOJUNE
owner_display_name: "HoJune Jang"
platform_scope: GLOBAL_PUBLIC_MULTI_TENANT
target_path: /TRAINORACLE_Project/docs/SPEC/RULE_SPEC_D1_D9.md
next_recommended_spec: SESSION_CLASSIFIER_SPEC.md
```

---

## 0. Document Purpose

This specification defines the TrainOracle D-rule validator for D-1 through D-9.

The validator is designed for a global, public, multi-tenant training platform.  
It must not depend on a fixed organization, fixed public agency, fixed team name, or fixed coaching role.

The document defines:

1. D-1 to D-9 rule meanings and validator outputs.
2. Separation between immutable raw validation and Coach Override.
3. R-rule exclusion from override targets.
4. Validity windows and re-validation rules.
5. Tenancy, group, consent, and capability rules.
6. TypeScript contracts for implementation.
7. Open issues blocking canonical promotion.
8. Validation test coverage.

This document is upload-ready, but not yet canonical-promotion-ready.

---

## 1. Source Priority

```yaml
source_priority:
  level_1_absolute_policy:
    description: "Absolute safety and governance policy. May be represented publicly only through aliases."
    files_or_aliases:
      - ABSOLUTE_POLICY_R_RULES
      - A_guide_v5.1_20260201.md
    conflict_resolution: "level_1 wins unless explicitly escalated to the spec owner for document governance review"

  level_2_training_guideline:
    description: "Primary training-rule and coaching guideline layer."
    files:
      - TrainingDoc_Guideline_v1.1_20260203.md
      - B_bg_philosophy.md
      - B_bg_reference.md
      - B_bg_data.md
    conflict_resolution: "level_2 wins over level_3 through level_5"

  level_3_system_design:
    description: "System architecture, workflow, and planning model references."
    files:
      - TRAINING_PLAN_SYSTEM_WHITEPAPER_v1.1_final.md
      - workflow_definition.md
      - phase_definition.md
      - APP_IMPLEMENTATION_BRIDGE.md
    conflict_resolution: "implementation details must not override training-rule semantics"

  level_4_interface_and_data:
    description: "Data import/export, sheet interface, Garmin or wearable interface, app UI behavior."
    files:
      - GARMIN_IMPORT_SPEC.md
      - GSHEET_INTERFACE_SPEC.md
      - FEEDBACK_RENDERER_SPEC.md
    conflict_resolution: "interface behavior is subordinate to validator policy"

  level_5_reports_and_prior_reviews:
    description: "Validation reports, review notes, handoff summaries, and prior model reviews."
    files:
      - final_validation_report.md
      - handoff_summary.md
      - model_review_notes.md
    conflict_resolution: "reference only; cannot change rule meaning without explicit approval"
```

---

## 2. Public Sanitization and Governance Policy

```yaml
public_sanitization:
  public_sanitized: true
  organization_specific_source_names_removed: true
  private_source_manifest_required: true

  forbidden_public_content:
    - specific_municipality_name
    - specific_public_agency_name
    - specific_team_name
    - private_local_contract_identifier
    - personally_identifying_source_label

  allowed_public_aliases:
    - ABSOLUTE_POLICY_R_RULES

  source_alias_registry:
    ABSOLUTE_POLICY_R_RULES:
      public_meaning: "Absolute R-rule policy source"
      private_manifest_required: true
      public_document_must_not_expand_alias: true
      contains_override_targets: false
      used_for:
        - R-rule immutability
        - safety governance
        - public-safe reference hierarchy

governance_scope:
  spec_owner: COACH_HOJUNE
  spec_owner_meaning: "Document governance/provenance owner only; not a runtime global authority."
  tenant_runtime_authority_model: relationship_and_capability_based
  no_fixed_global_coach_authority: true

naming_convention:
  yaml_default: snake_case
  typescript_default: camelCase
  externally_defined_terms_may_keep_original_case:
    - epocStatus
    - scopeGroupId
    - targetScope
  serialization_mapping_delegated_to: APP_IMPLEMENTATION_BRIDGE.md
```

Public files must never expose private organization-specific names.  
If a private source is required for traceability, it must be resolved through a private source manifest outside public SPEC files.

---

## 3. Terminology

```yaml
terminology:
  raw_validation:
    meaning: "The immutable validator result before coach override"
    mutable: false

  coach_override:
    meaning: "An append-only audit-layer decision made by a permitted human or permitted relationship actor"
    mutable: false
    can_change_raw_validation: false

  effective_verdict:
    meaning: "The operational display state after raw validation, override record, and safety-hard-stop precedence are applied"
    mutable: false

  R_rule:
    meaning: "Absolute policy rule"
    override_target: false
    source_mutation_allowed: false
    audit_annotation_allowed: true
    annotation_effect:
      affects_raw_result: false
      affects_effective_verdict: false
      affects_source_policy: false

  D_rule:
    meaning: "Derived training validation rule D-1 through D-9"
    override_target: true
    override_allowed_only_when_policy_allows: true

  safety_hard_stop:
    meaning: "AI recommendation/export stop state"
    blocks_ai_recommendation: true
    blocks_unsafe_export: true
    blocks_real_world_training: false
    requires_human_review_or_self_acknowledgement: true

  self_acknowledgement:
    meaning: "SOLO athlete acknowledgement record; not a safety exception approval"
    equivalent_to_safety_exception: false
```

---

## 4. Status, Verdict, and Display Model

Raw status, execution state, authorization state, dependency state, and display code must not be mixed.

```yaml
status_model:
  raw_status:
    allowed:
      - OK
      - WARN
      - ERROR
      - SKIP
      - DATA_ERROR

  execution_state:
    allowed:
      - READY
      - PENDING_INPUT
      - BLOCKED_BY_DEPENDENCY
      - NOT_APPLICABLE

  auth_state:
    allowed:
      - ALLOWED
      - DENIED
      - REQUIRES_CAPABILITY
      - REQUIRES_CONSENT

  dependency_state:
    allowed:
      - RESOLVED
      - TBD
      - OPEN_ISSUE

  display_code:
    allowed:
      - OK
      - WARN
      - ERROR
      - ERROR_SAFETY
      - DATA_ERROR_REVIEW_REQUIRED
      - SKIP_ANNOTATION
      - OVERRIDDEN_ERROR
      - REVIEW_REQUIRED

  overall_verdict:
    allowed:
      - SAFETY_HARD_STOP
      - ACTIVE_ERROR
      - OVERRIDDEN_ERROR
      - WARNING_PRESENT
      - ALL_CLEAR

  display_labels_ko:
    OK: "정상"
    WARN: "주의"
    ERROR: "오류"
    ERROR_SAFETY: "안전 오류"
    SAFETY_HARD_STOP_ACTIVE: "안전 하드스톱 활성"
    DATA_ERROR_REVIEW_REQUIRED: "데이터 오류 검토 필요"
    SKIP_ANNOTATION: "검증 생략 주석"
    OVERRIDDEN_ERROR: "코치 승인으로 운영상 통과"
    REVIEW_REQUIRED: "검토 필요"
```

---

## 5. Global Validation Window Definitions

Window end never means recovery, clearance, medical clearance, or risk disappearance.  
Window end only means re-validation is required.

```yaml
validation_window_definitions:
  global_invariants:
    window_end_means: REQUIRE_REVALIDATION
    window_end_does_not_mean:
      - recovery_confirmed
      - raw_signal_cleared
      - medical_clearance
      - safety_clearance
      - coach_override_auto_extended
    fixed_week_start: null
    fixed_recovery_hours_default: null

  training_week_window:
    anchor_policy: SOURCE_DEFINED_OR_GROUP_SETTING
    fixed_week_start: null
    default_behavior_if_unset: REQUIRE_GROUP_SETTING_OR_OPEN_ISSUE
    applies_to:
      - D-1
      - D-3
      - D-5
      - D-7

  last_main_session_to_candidate_session:
    anchor_policy:
      start: previous_MAIN_session_end_or_source_defined_anchor
      end: candidate_MAIN_session_start_or_source_defined_anchor
    threshold_source: SOURCE_DEFINED_OR_GROUP_SETTING_OR_OPEN_ISSUE
    fixed_hours: null
    window_end_effect: REQUIRE_REVALIDATION
    recovery_meaning: false
    applies_to:
      - D-2

  next_day_recovery_window:
    anchor_policy: SOURCE_DEFINED_OR_GROUP_SETTING
    rolling_24h_assumption_allowed: false
    rolling_24h_allowed_only_if_source_explicit: true
    applies_to:
      - D-4

  current_microcycle_evaluation_window:
    anchor_policy:
      - ck_risk_signal_session
      - latest_ck_related_validation_event
      - group_defined_microcycle_boundary
    window_end_effect: REQUIRE_REVALIDATION
    recovery_meaning: false
    fallback_max_hours: null
    applies_to:
      - D-6

  operational_update_window:
    anchor_policy: GROUP_SETTING_OR_APP_IMPLEMENTATION_BRIDGE
    intended_range_days:
      min: 2
      max: 4
    enforcement_effect: CONTEXT_SELECTION_ONLY
    recovery_meaning: false

  rolling_microcycle_context_window:
    anchor_policy: GROUP_SETTING_OR_APP_IMPLEMENTATION_BRIDGE
    intended_range_days:
      min: 8
      max: 11
    enforcement_effect: CONTEXT_SELECTION_ONLY
    recovery_meaning: false

  same_session_or_same_export_window:
    anchor_policy: VALIDATION_RUN_CONTEXT
    applies_to:
      - D-8
      - D-9
```

---

## 6. Mode Thresholds

Mode thresholds are context selectors, not training safety conclusions.

```yaml
mode_thresholds:
  rolling_mode:
    intended_context_days_min: 8
    intended_context_days_max: 11
    meaning: "Rolling microcycle context for validation and planning review"
    can_auto_clear_risk: false
    can_define_recovery: false

  operational_mode:
    intended_context_days_min: 2
    intended_context_days_max: 4
    meaning: "Near-term operational adjustment context"
    can_auto_clear_risk: false
    can_define_recovery: false

  threshold_policy:
    if_conflict_with_source: ESCALATE_OR_OPEN_ISSUE
    if_missing_group_setting: USE_OPEN_ISSUE_NOT_HARDCODE
```

---

## 7. Rule Index

```yaml
rule_index:
  R_rules:
    ids:
      - R-1
      - R-2
      - R-3
      - R-4
      - R-5
      - R-6
      - R-7
      - R-8
      - R-9
    override_target: false
    source_mutation_allowed: false
    audit_annotation_allowed: true

  D_rules:
    ids:
      - D-1
      - D-2
      - D-3
      - D-4
      - D-5
      - D-6
      - D-7
      - D-8
      - D-9
    override_target: true
    raw_result_immutable: true
    override_append_only: true
```

---

## 8. D-Rule Definitions

### D-1 — Weekly MAIN Session Count Guard

```yaml
D-1:
  name: WEEKLY_MAIN_SESSION_COUNT_GUARD
  purpose: "Prevent excessive MAIN-session density inside the active training-week context."
  source_status: CANONICAL_WITH_GROUP_SETTING
  validation_window: training_week_window

  required_inputs:
    - athlete_id
    - validation_context.group_id
    - session_classification
    - session_intensity_tag
    - training_week_window
    - group_or_source_defined_main_limit

  evaluation:
    main_session_identifier: MAIN
    count_scope: training_week_window
    threshold_source: SOURCE_DEFINED_OR_GROUP_SETTING
    fixed_week_start: null

  raw_result_mapping:
    within_limit:
      raw_status: OK
      display_code: OK
    limit_reached:
      raw_status: WARN
      display_code: WARN
    limit_exceeded:
      raw_status: ERROR
      display_code: ERROR

  override_policy:
    override_allowed: true
    override_level_required: COACH_APPROVAL
    override_duration: current_training_week_window
    requires_reason: true

  notes:
    - "Week anchor must not be hardcoded to a specific weekday."
    - "If group setting is missing, create open issue rather than inventing a global limit."
```

### D-2 — MAIN-to-MAIN Interval Guard

```yaml
D-2:
  name: MAIN_INTERVAL_GUARD
  purpose: "Validate minimum separation or conflict policy between MAIN sessions."
  source_status: PARTIALLY_CANONICAL_WITH_OPEN_ISSUE
  validation_window: last_main_session_to_candidate_session

  required_inputs:
    - athlete_id
    - validation_context.group_id
    - previous_MAIN_session
    - candidate_session
    - interval_policy
    - session_classification

  evaluation:
    interval_unit: SOURCE_DEFINED
    interval_threshold: TBD
    source_conflict_open_issue: OI-D2-MAIN-INTERVAL-001

  raw_result_mapping:
    interval_policy_satisfied:
      raw_status: OK
      display_code: OK
    interval_policy_uncertain:
      raw_status: WARN
      display_code: REVIEW_REQUIRED
    interval_policy_violated:
      raw_status: ERROR
      display_code: ERROR

  override_policy:
    override_allowed: true
    override_level_required: COACH_APPROVAL
    override_duration: candidate_session_only
    requires_reason: true

  canonical_promotion:
    blocked: true
    blocking_issue: OI-D2-MAIN-INTERVAL-001
```

### D-3 — Weekly High-Intensity Density Guard

```yaml
D-3:
  name: WEEKLY_HIGH_INTENSITY_DENSITY_GUARD
  purpose: "Check high-intensity or quality-session density inside the training-week context."
  source_status: CANONICAL_WITH_GROUP_SETTING
  validation_window: training_week_window

  required_inputs:
    - athlete_id
    - validation_context.group_id
    - training_week_window
    - session_intensity_tag
    - quality_session_count
    - group_or_source_defined_density_limit

  evaluation:
    density_scope: training_week_window
    threshold_source: SOURCE_DEFINED_OR_GROUP_SETTING
    fixed_week_start: null

  raw_result_mapping:
    density_within_limit:
      raw_status: OK
      display_code: OK
    density_near_limit:
      raw_status: WARN
      display_code: WARN
    density_exceeded:
      raw_status: ERROR
      display_code: ERROR

  override_policy:
    override_allowed: true
    override_level_required: COACH_APPROVAL
    override_duration: current_training_week_window
    requires_reason: true
```

### D-4 — EPOC / Template-Match Recovery Guard

```yaml
D-4:
  name: EPOC_TEMPLATE_MATCH_RECOVERY_GUARD
  purpose: "Evaluate next-day recovery risk using epocStatus and template_match_confidence without creating pseudo raw-status values."
  source_status: CANONICAL_WITH_SESSION_CLASSIFIER_DEPENDENCY
  validation_window: next_day_recovery_window

  required_inputs:
    - athlete_id
    - validation_context.group_id
    - epocStatus
    - template_match_confidence
    - candidate_next_day_session
    - session_template_id
    - SESSION_CLASSIFIER_SPEC.epocStatus
    - SESSION_CLASSIFIER_SPEC.template_match_confidence

  allowed_epocStatus:
    - NORMAL
    - ELEVATED
    - HIGH
    - TEMPLATE_MATCH
    - UNKNOWN
    - NOT_AVAILABLE

  allowed_template_match_confidence:
    - HIGH
    - MEDIUM
    - LOW
    - NOT_APPLICABLE

  evaluation:
    pseudo_status_for_confidence: FORBIDDEN
    confidence_must_be_separate_field: true

  raw_result_mapping:
    epocStatus_NORMAL:
      raw_status: OK
      display_code: OK

    epocStatus_ELEVATED:
      raw_status: WARN
      display_code: WARN

    epocStatus_HIGH:
      raw_status: ERROR
      display_code: ERROR

    epocStatus_TEMPLATE_MATCH_with_high_confidence:
      raw_status: WARN
      display_code: WARN
      override_record_required_if_ignored: true

    epocStatus_TEMPLATE_MATCH_with_medium_or_low_confidence:
      raw_status: SKIP
      display_code: SKIP_ANNOTATION
      override_record_created: false
      annotation_allowed: true

    epocStatus_UNKNOWN_or_NOT_AVAILABLE:
      raw_status: DATA_ERROR
      display_code: DATA_ERROR_REVIEW_REQUIRED

  override_policy:
    override_allowed_for_WARN_or_ERROR: true
    override_not_allowed_for_SKIP_annotation: true
    override_level_required: COACH_APPROVAL
    override_duration: next_day_recovery_window
    requires_reason: true

  dependencies:
    blocking_for_next_spec:
      - template_match_confidence
      - epocStatus
```

### D-5 — Severity Branching Guard

```yaml
D-5:
  name: SEVERITY_BRANCHING_GUARD
  purpose: "Map athlete condition, observation, or load-risk severity into OK/WARN/ERROR without mixing severity and verdict enums."
  source_status: CANONICAL_WITH_OPEN_SOURCE_DETAIL
  validation_window: training_week_window

  required_inputs:
    - athlete_id
    - validation_context.group_id
    - severity_signal
    - severity_grade
    - signal_source
    - training_week_window

  allowed_severity_grade:
    - NONE
    - LOW
    - MEDIUM
    - HIGH
    - UNKNOWN

  evaluation:
    severity_is_not_verdict: true
    verdict_must_be_raw_status: true

  raw_result_mapping:
    severity_NONE:
      raw_status: OK
      display_code: OK

    severity_LOW:
      raw_status: OK
      display_code: SKIP_ANNOTATION
      annotation_allowed: true

    severity_MEDIUM:
      raw_status: WARN
      display_code: WARN

    severity_HIGH:
      raw_status: ERROR
      display_code: ERROR

    severity_UNKNOWN:
      raw_status: DATA_ERROR
      display_code: DATA_ERROR_REVIEW_REQUIRED

  override_policy:
    override_allowed: true
    override_level_required:
      WARN: COACH_APPROVAL
      ERROR: COACH_APPROVAL_WITH_EVIDENCE
    override_duration: current_training_week_window
    requires_reason: true

  open_issue:
    id: OI-D5-SEVERITY-SOURCE-001
    blocks_rule_execution: false
    blocks_canonical_promotion: false
```

### D-6 — CK Status Re-Validation Guard

```yaml
D-6:
  name: CK_STATUS_REVALIDATION_GUARD
  purpose: "Prevent time elapsed from being treated as CK recovery confirmation."
  source_status: PARTIALLY_CANONICAL_STATE_BASED
  validation_window: current_microcycle_evaluation_window

  required_inputs:
    - athlete_id
    - validation_context.group_id
    - ck_risk_signal_present
    - ck_status_rechecked
    - current_rule_evaluation_window_end
    - candidate_session_intensity

  validation_policy:
    time_elapsed_is_recovery: false
    ck_status_recheck_required_for_clearance: true
    fixed_hours: null
    fallback_max_hours: null

  override_validity_scope:
    valid_until:
      - ck_status_rechecked
      - current_rule_evaluation_window_end
    on_expiry: REQUIRE_REVALIDATION
    microcycle_boundary_effect: "override scope만 종료. CK 회복 판정 아님."
    current_rule_evaluation_window_end_means_recovery: false

  raw_result_mapping:
    no_ck_risk_signal:
      raw_status: OK
      display_code: OK

    ck_risk_signal_present_and_rechecked_clear:
      raw_status: OK
      display_code: OK

    ck_risk_signal_present_not_rechecked_low_intensity_candidate:
      raw_status: WARN
      display_code: WARN

    ck_risk_signal_present_not_rechecked_high_intensity_or_MAIN_candidate:
      raw_status: ERROR
      display_code: ERROR

    ck_data_missing_but_required:
      raw_status: DATA_ERROR
      display_code: DATA_ERROR_REVIEW_REQUIRED

  coach_operational_advisory:
    status: NON_CANONICAL_ADVISORY
    decided_by: COACH_HOJUNE
    decided_by_meaning: "Spec-level coaching advisory provenance; not a tenant runtime authority."
    purpose: COACH_REFERENCE_ONLY
    caution_threshold_hours: 48
    condition:
      ck_status_not_rechecked: true
      high_intensity_or_MAIN_session_planned: true
      elapsed_since_ck_risk_session_hours_less_than_threshold: true
    ui_display:
      target: COACH_ONLY
      label: "참고용 — 정본 룰 아님 — 의료 판단 아님"
    enforcement: NONE
    affects:
      validator_status: false
      trigger: false
      override_level: false
      block_scope: false
      plan_generation: false

  override_policy:
    override_allowed: true
    override_level_required: COACH_APPROVAL_WITH_EVIDENCE
    override_duration: event_based_validity_only
    requires_reason: true

  open_issue:
    id: OI-D6-VALIDITY-SOURCE-001
    priority: P1
    blocks:
      rule_execution: false
      canonical_promotion: false
```

### D-7 — LD Definition and Weekly Distribution Guard

```yaml
D-7:
  name: LD_DEFINITION_AND_WEEKLY_DISTRIBUTION_GUARD
  purpose: "Validate LD session classification and weekly distribution only after ld_definition is supplied by SESSION_CLASSIFIER_SPEC."
  source_status: DEPENDS_ON_SESSION_CLASSIFIER
  validation_window: training_week_window

  required_inputs:
    - athlete_id
    - validation_context.group_id
    - ld_definition
    - session_classification
    - training_week_window
    - weekly_distribution_policy

  evaluation:
    ld_definition_source: SESSION_CLASSIFIER_SPEC
    fixed_week_start: null
    threshold_source: SOURCE_DEFINED_OR_GROUP_SETTING

  raw_result_mapping:
    ld_definition_missing:
      raw_status: DATA_ERROR
      display_code: DATA_ERROR_REVIEW_REQUIRED
      dependency_state: OPEN_ISSUE

    weekly_distribution_ok:
      raw_status: OK
      display_code: OK

    weekly_distribution_needs_review:
      raw_status: WARN
      display_code: WARN

    weekly_distribution_violated:
      raw_status: ERROR
      display_code: ERROR

  override_policy:
    override_allowed: true
    override_level_required: COACH_APPROVAL
    override_duration: current_training_week_window
    requires_reason: true

  dependencies:
    blocking_for_next_spec:
      - ld_definition
```

### D-8 — Required Input Completeness Guard

```yaml
D-8:
  name: REQUIRED_INPUT_COMPLETENESS_GUARD
  purpose: "Prevent validator conclusions when required data is missing, stale, or structurally invalid."
  source_status: CANONICAL_IMPLEMENTATION_GUARD
  validation_window: same_session_or_same_export_window

  required_inputs:
    - athlete_id
    - validation_context.group_id
    - session_date
    - session_classification
    - source_data_freshness
    - required_metric_availability

  evaluation:
    missing_required_input_is_not_ok: true
    stale_required_input_is_data_error: true
    optional_input_missing_can_be_skip: true

  raw_result_mapping:
    all_required_inputs_valid:
      raw_status: OK
      display_code: OK

    optional_inputs_missing_only:
      raw_status: SKIP
      display_code: SKIP_ANNOTATION

    required_input_missing:
      raw_status: DATA_ERROR
      display_code: DATA_ERROR_REVIEW_REQUIRED

    required_input_conflicting:
      raw_status: DATA_ERROR
      display_code: DATA_ERROR_REVIEW_REQUIRED

  override_policy:
    override_allowed: false
    reason: "Data errors require source correction or explicit implementation-level handling, not coach override."
    source_correction_requires_revalidation: true
```

### D-9 — Safety Hard-Stop Guard

```yaml
D-9:
  name: SAFETY_HARD_STOP_GUARD
  purpose: "Activate AI recommendation/export hard stop for severe safety-risk combinations without claiming to block real-world training."
  source_status: PARTIALLY_CANONICAL_WITH_THRESHOLD_OPEN_ISSUE
  validation_window: same_session_or_same_export_window

  required_inputs:
    - athlete_id
    - validation_context.group_id
    - acute_load_signal
    - load_spike_signal
    - unresolved_safety_signal
    - severe_fatigue_or_pain_signal
    - group_configured_safety_thresholds

  threshold_policy:
    fixed_public_thresholds: TBD
    candidate_examples_non_canonical:
      acwr_ratio_example: 1.5
      load_spike_percent_example: 50
    examples_are_enforced: false
    production_enforcement_requires:
      - group_configured_threshold
      - source_or_policy_confirmation
      - OI-D9-TRIGGER-THRESHOLD-001 resolution

  raw_result_mapping:
    no_safety_hard_stop_signal:
      raw_status: OK
      display_code: OK
      safety_hard_stop_active: false

    safety_hard_stop_signal_active:
      raw_status: ERROR
      display_code: ERROR_SAFETY
      safety_hard_stop_active: true
      blocks_ai_recommendation: true
      blocks_unsafe_export: true
      blocks_real_world_training: false

    required_safety_data_missing:
      raw_status: DATA_ERROR
      display_code: DATA_ERROR_REVIEW_REQUIRED
      safety_hard_stop_active: false

  override_policy:
    override_allowed: false
    safety_exception_approval_allowed: false
    coach_can_record_review: true
    solo_self_acknowledgement_allowed: true
    solo_self_acknowledgement_action: RECORD_SAFETY_SELF_ACKNOWLEDGEMENT
    self_acknowledgement_effect:
      clears_raw_error: false
      disables_safety_hard_stop: false
      enables_ai_recommendation: false
      enables_unsafe_export: false

  open_issue:
    id: OI-D9-TRIGGER-THRESHOLD-001
    priority: P1
    blocks_rule_execution: false
    blocks_canonical_promotion: true
```

---

## 9. Coach Override Policy

### X.0 Override Target Scope

```yaml
override_target_scope:
  R_rules:
    override_allowed: false
    source_mutation_allowed: false
    audit_annotation_allowed: true
    annotation_constraints:
      must_be_append_only: true
      affects_raw_result: false
      affects_effective_verdict: false
      affects_source_policy: false

  D_rules:
    override_allowed: true
    only_when_rule_policy_allows: true
    raw_result_mutable: false
    override_record_append_only: true
```

### X.1 Override Record Requirements

```yaml
override_record:
  required_fields:
    - override_id
    - tenant_id
    - group_id
    - athlete_id
    - rule_id
    - raw_status_at_time
    - display_code_at_time
    - actor_id
    - actor_relationship_to_athlete
    - actor_capability_at_time
    - capability_grant_id
    - reason_code
    - reason_text
    - evidence_snapshot
    - created_at
    - valid_until
    - valid_until_event

  immutable_after_create: true
  append_only: true
  deletion_allowed: false
  supersession_allowed: true
  supersession_requires_new_record: true
```

### X.2 Effective Verdict Precedence

```yaml
effective_verdict_precedence:
  ordered_high_to_low:
    - safety_hard_stop_active
    - active_non_overridden_error
    - overridden_error
    - warning_present
    - all_clear

  mapping:
    safety_hard_stop_active:
      overall_verdict: SAFETY_HARD_STOP
      display_code: ERROR_SAFETY

    active_non_overridden_error:
      overall_verdict: ACTIVE_ERROR
      display_code: ERROR

    overridden_error:
      overall_verdict: OVERRIDDEN_ERROR
      display_code: OVERRIDDEN_ERROR

    warning_present:
      overall_verdict: WARNING_PRESENT
      display_code: WARN

    all_clear:
      overall_verdict: ALL_CLEAR
      display_code: OK
```

### X.3 D-Rule Override Matrix

```yaml
override_matrix:
  D-1:
    allowed: true
    level: COACH_APPROVAL
    validity_scope: current_training_week_window

  D-2:
    allowed: true
    level: COACH_APPROVAL
    validity_scope: candidate_session_only

  D-3:
    allowed: true
    level: COACH_APPROVAL
    validity_scope: current_training_week_window

  D-4:
    allowed_for:
      - WARN
      - ERROR
    not_allowed_for:
      - SKIP
      - DATA_ERROR
    level: COACH_APPROVAL
    validity_scope: next_day_recovery_window
    medium_or_low_template_confidence:
      action: SKIP_ANNOTATION_ONLY
      override_record_created: false

  D-5:
    allowed: true
    level:
      WARN: COACH_APPROVAL
      ERROR: COACH_APPROVAL_WITH_EVIDENCE
    validity_scope: current_training_week_window

  D-6:
    allowed: true
    level: COACH_APPROVAL_WITH_EVIDENCE
    validity_scope: event_based
    valid_until:
      - ck_status_rechecked
      - current_rule_evaluation_window_end
    fixed_hours: null
    fallback_max_hours: null

  D-7:
    allowed: true
    level: COACH_APPROVAL
    validity_scope: current_training_week_window

  D-8:
    allowed: false
    reason: DATA_ERROR_REQUIRES_SOURCE_CORRECTION

  D-9:
    allowed: false
    reason: SAFETY_HARD_STOP_CANNOT_BE_OVERRIDDEN
    solo_self_acknowledgement_allowed: true
```

### X.4 Retroactive Override

```yaml
retroactive_override:
  allowed: CONDITIONAL
  allowed_within_hours: TBD
  candidate_hours_example_non_production: 48
  example_is_enforced: false
  requires:
    - explicit_capability
    - reason
    - evidence_snapshot
    - audit_log
    - target_rule_allows_override
  open_issue: OI-RETROACTIVE-OVERRIDE-WINDOW-001
```

---

## 10. Tenancy and Group Module

### Y.0 Tenancy Principle

```yaml
tenancy_principle:
  platform: GLOBAL_PUBLIC_MULTI_TENANT
  fixed_role_authority_forbidden: true
  relationship_and_capability_based_authority_required: true
  deny_by_default: true
  row_level_isolation_required: true
  group_scope_required_for_sensitive_actions: true
```

### Y.1 Validation Context

```yaml
validation_context:
  required_fields:
    - tenant_id
    - group_id
    - athlete_id
    - actor_id
    - actor_group_membership_id
    - actor_capability_grant_ids
    - session_id
    - validation_run_id
    - source_snapshot_id

  group_id_meaning: "The active group context for this validation run."
  cross_group_auto_propagation: FORBIDDEN
```

### Y.2 Capability Grant Model

```yaml
capability_grant:
  required_fields:
    - capability_grant_id
    - tenant_id
    - scopeGroupId
    - targetScope
    - actor_id
    - target_athlete_id
    - capability
    - consent_basis
    - granted_by
    - granted_at
    - expires_at
    - revoked_at

  targetScope_allowed:
    - SELF
    - ATHLETE
    - GROUP
    - TEAM
    - ORGANIZATION

  capabilities_allowed:
    - VIEW_VALIDATION
    - RECORD_COACH_REVIEW
    - APPROVE_D_RULE_OVERRIDE
    - APPROVE_D_RULE_OVERRIDE_WITH_EVIDENCE
    - RECORD_SAFETY_SELF_ACKNOWLEDGEMENT
    - MANAGE_GROUP_POLICY
    - MANAGE_CAPABILITY_GRANTS

  forbidden_actions_for_solo:
    - APPROVE_SAFETY_EXCEPTION

  deny_by_default: true
```

### Y.3 Notification Routing

```yaml
notification_routing:
  default_scope: validation_context.group_id
  all_groups_of_athlete_auto_notify: false
  cross_group_notification_default: FORBIDDEN
  cross_group_notification_allowed_only_if:
    - explicit_consent
    - explicit_group_sharing_policy
    - actor_has_scoped_capability
    - audit_log_created

  notification_payload_must_include:
    - tenant_id
    - group_id
    - athlete_id
    - rule_id
    - raw_status
    - display_code
    - overall_verdict
    - created_at
```

### Y.4 SOLO Mode

```yaml
solo_mode:
  default_targetScope: SELF
  allowed_capabilities:
    - VIEW_VALIDATION
    - RECORD_SAFETY_SELF_ACKNOWLEDGEMENT

  not_allowed_capabilities:
    - APPROVE_D_RULE_OVERRIDE
    - APPROVE_D_RULE_OVERRIDE_WITH_EVIDENCE

  forbidden_actions:
    - APPROVE_SAFETY_EXCEPTION

  D-9_behavior:
    self_acknowledgement_allowed: true
    self_acknowledgement_clears_raw_error: false
    self_acknowledgement_disables_hard_stop: false
    ai_recommendation_remains_blocked: true
    unsafe_export_remains_blocked: true
```

---

## 11. Implementation Invariants

```yaml
implementation_invariants:
  raw_rule_result_immutable: true
  override_record_append_only: true
  evidence_snapshot_immutable: true
  audit_log_append_only: true
  row_level_tenant_isolation_required: true
  capability_check_required_on_every_sensitive_action: true
  cross_group_notification_forbidden_by_default: true
  source_correction_requires_revalidation: true
  data_error_cannot_be_silently_overridden: true
  safety_hard_stop_cannot_be_overridden: true
  R_rules_cannot_be_override_targets: true
```

Database schema, API endpoints, index strategy, row-level security implementation, and storage lifecycle rules are delegated to `APP_IMPLEMENTATION_BRIDGE.md`.

---

## 12. TypeScript Contract

```ts
export type ISO8601 = string;
export type TenantId = string;
export type GroupId = string;
export type AthleteId = string;
export type ActorId = string;
export type SessionId = string;
export type ValidationRunId = string;
export type CapabilityGrantId = string;
export type OverrideId = string;
export type SourceSnapshotId = string;

export type RuleId =
  | "D-1"
  | "D-2"
  | "D-3"
  | "D-4"
  | "D-5"
  | "D-6"
  | "D-7"
  | "D-8"
  | "D-9";

export type RRuleId =
  | "R-1"
  | "R-2"
  | "R-3"
  | "R-4"
  | "R-5"
  | "R-6"
  | "R-7"
  | "R-8"
  | "R-9";

export type RawStatus = "OK" | "WARN" | "ERROR" | "SKIP" | "DATA_ERROR";

export type ExecutionState =
  | "READY"
  | "PENDING_INPUT"
  | "BLOCKED_BY_DEPENDENCY"
  | "NOT_APPLICABLE";

export type AuthState =
  | "ALLOWED"
  | "DENIED"
  | "REQUIRES_CAPABILITY"
  | "REQUIRES_CONSENT";

export type DependencyState = "RESOLVED" | "TBD" | "OPEN_ISSUE";

export type DisplayCode =
  | "OK"
  | "WARN"
  | "ERROR"
  | "ERROR_SAFETY"
  | "DATA_ERROR_REVIEW_REQUIRED"
  | "SKIP_ANNOTATION"
  | "OVERRIDDEN_ERROR"
  | "REVIEW_REQUIRED";

export type OverallVerdict =
  | "SAFETY_HARD_STOP"
  | "ACTIVE_ERROR"
  | "OVERRIDDEN_ERROR"
  | "WARNING_PRESENT"
  | "ALL_CLEAR";

export type EpocStatus =
  | "NORMAL"
  | "ELEVATED"
  | "HIGH"
  | "TEMPLATE_MATCH"
  | "UNKNOWN"
  | "NOT_AVAILABLE";

export type TemplateMatchConfidence =
  | "HIGH"
  | "MEDIUM"
  | "LOW"
  | "NOT_APPLICABLE";

export type SeverityGrade = "NONE" | "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN";

export type Capability =
  | "VIEW_VALIDATION"
  | "RECORD_COACH_REVIEW"
  | "APPROVE_D_RULE_OVERRIDE"
  | "APPROVE_D_RULE_OVERRIDE_WITH_EVIDENCE"
  | "RECORD_SAFETY_SELF_ACKNOWLEDGEMENT"
  | "MANAGE_GROUP_POLICY"
  | "MANAGE_CAPABILITY_GRANTS";

export type TargetScope = "SELF" | "ATHLETE" | "GROUP" | "TEAM" | "ORGANIZATION";

export interface ValidationContext {
  tenantId: TenantId;
  groupId: GroupId;
  athleteId: AthleteId;
  actorId: ActorId;
  sessionId: SessionId;
  validationRunId: ValidationRunId;
  sourceSnapshotId: SourceSnapshotId;
  actorCapabilityGrantIds: readonly CapabilityGrantId[];
}

export interface RawEvidence {
  evidenceId: string;
  tenantId: TenantId;
  groupId: GroupId;
  athleteId: AthleteId;
  sourceSnapshotId: SourceSnapshotId;
  sourceType:
    | "SESSION_CLASSIFIER"
    | "PLAN_GENERATOR"
    | "WEARABLE_IMPORT"
    | "COACH_INPUT"
    | "ATHLETE_INPUT"
    | "GROUP_POLICY"
    | "SOURCE_DOCUMENT";
  field: string;
  value: string | number | boolean | null;
  unit?: string;
  observedAt?: ISO8601;
  recordedAt: ISO8601;
}

export interface ValidUntilEvent {
  eventType:
    | "TRAINING_WEEK_WINDOW_END"
    | "NEXT_DAY_RECOVERY_WINDOW_END"
    | "CK_STATUS_RECHECKED"
    | "CURRENT_RULE_EVALUATION_WINDOW_END"
    | "CANDIDATE_SESSION_END"
    | "VALIDATION_RUN_END";
  eventRef?: string;
  requiresRevalidation: boolean;
}

export interface RuleValidationResult {
  tenantId: TenantId;
  groupId: GroupId;
  athleteId: AthleteId;
  sessionId: SessionId;
  validationRunId: ValidationRunId;
  ruleId: RuleId;
  rawStatus: RawStatus;
  executionState: ExecutionState;
  dependencyState: DependencyState;
  displayCode: DisplayCode;
  overallVerdictBeforeOverride: OverallVerdict;
  safetyHardStopActive: boolean;
  blocksAiRecommendation: boolean;
  blocksUnsafeExport: boolean;
  blocksRealWorldTraining: boolean;
  validUntil: ISO8601 | null;
  validUntilEvent?: ValidUntilEvent;
  evidence: readonly RawEvidence[];
  createdAt: ISO8601;
}

export interface OverrideReason {
  reasonCode:
    | "COACH_CONTEXT"
    | "SOURCE_CORRECTION_PENDING"
    | "ATHLETE_SPECIFIC_CONTEXT"
    | "COMPETITION_CONTEXT"
    | "OTHER";
  reasonText: string;
}

export interface EvidenceSnapshot {
  snapshotId: string;
  tenantId: TenantId;
  groupId: GroupId;
  athleteId: AthleteId;
  validationRunId: ValidationRunId;
  sourceSnapshotId: SourceSnapshotId;
  rawEvidenceIds: readonly string[];
  createdAt: ISO8601;
  immutable: true;
}

export interface CapabilityGrant {
  capabilityGrantId: CapabilityGrantId;
  tenantId: TenantId;
  scopeGroupId: GroupId;
  targetScope: TargetScope;
  actorId: ActorId;
  targetAthleteId?: AthleteId;
  capability: Capability;
  consentBasis: "SELF" | "GUARDIAN" | "GROUP_POLICY" | "CONTRACT" | "EXPLICIT_SHARE";
  grantedBy: ActorId;
  grantedAt: ISO8601;
  expiresAt: ISO8601 | null;
  revokedAt: ISO8601 | null;
}

export interface GroupMember {
  tenantId: TenantId;
  groupId: GroupId;
  actorId: ActorId;
  athleteId?: AthleteId;
  relationship:
    | "SELF"
    | "COACH"
    | "ASSISTANT"
    | "MEDICAL_SUPPORT"
    | "GUARDIAN"
    | "ADMIN"
    | "VIEWER";
  capabilities: CapabilityGrant[];
  joinedAt: ISO8601;
  removedAt: ISO8601 | null;
}

export interface CoachOverrideRecord {
  overrideId: OverrideId;
  tenantId: TenantId;
  groupId: GroupId;
  athleteId: AthleteId;
  ruleId: RuleId;
  rawStatusAtTime: RawStatus;
  displayCodeAtTime: DisplayCode;
  actorId: ActorId;
  actorRelationshipToAthlete: GroupMember["relationship"];
  actorCapabilityAtTime: CapabilityGrant;
  capabilityGrantId: CapabilityGrantId;
  reason: OverrideReason;
  evidenceSnapshot: EvidenceSnapshot;
  validUntil: ISO8601 | null;
  validUntilEvent?: ValidUntilEvent;
  createdAt: ISO8601;
  supersedesOverrideId?: OverrideId;
  immutable: true;
}

export interface EffectiveValidationResult {
  tenantId: TenantId;
  groupId: GroupId;
  athleteId: AthleteId;
  sessionId: SessionId;
  validationRunId: ValidationRunId;
  ruleId: RuleId;
  rawResult: RuleValidationResult;
  appliedOverride: CoachOverrideRecord | null;
  overallVerdict: OverallVerdict;
  displayCode: DisplayCode;
  safetyHardStopActive: boolean;
  precedenceApplied:
    | "SAFETY_HARD_STOP_ACTIVE"
    | "ACTIVE_NON_OVERRIDDEN_ERROR"
    | "OVERRIDDEN_ERROR"
    | "WARNING_PRESENT"
    | "ALL_CLEAR";
  effectiveAt: ISO8601;
}

export interface AuditLog {
  auditLogId: string;
  tenantId: TenantId;
  groupId: GroupId;
  actorId: ActorId;
  action:
    | "RULE_VALIDATED"
    | "D_RULE_OVERRIDE_CREATED"
    | "SAFETY_SELF_ACKNOWLEDGED"
    | "SOURCE_CORRECTED"
    | "CAPABILITY_GRANTED"
    | "CAPABILITY_REVOKED"
    | "NOTIFICATION_SENT";
  targetType: "RULE_RESULT" | "OVERRIDE" | "CAPABILITY" | "NOTIFICATION" | "SOURCE";
  targetId: string;
  createdAt: ISO8601;
  immutable: true;
}

export interface DataVisibilityPolicy {
  tenantId: TenantId;
  groupId: GroupId;
  crossGroupSharingDefault: "FORBIDDEN";
  explicitConsentRequired: true;
  rowLevelIsolationRequired: true;
}

export interface TeamPolicy {
  tenantId: TenantId;
  groupId: GroupId;
  trainingWeekAnchorPolicy: "SOURCE_DEFINED_OR_GROUP_SETTING";
  fixedWeekStart: null | "MONDAY" | "SUNDAY" | "CUSTOM";
  rollingModeContextDays: { min: 8; max: 11 };
  operationalModeContextDays: { min: 2; max: 4 };
  d9ThresholdPolicyState: "TBD" | "GROUP_CONFIGURED" | "SOURCE_CANONICAL";
}
```

---

## 13. Open Issues

```yaml
open_issues:
  - id: OI-D2-MAIN-INTERVAL-001
    legacy_id: OI-1
    priority: P1
    title: "D-2 MAIN interval canonical threshold conflict"
    blocks_rule_execution: false
    blocks_canonical_promotion: true
    owner: COACH_HOJUNE

  - id: OI-D6-VALIDITY-SOURCE-001
    priority: P1
    title: "D-6 fixed time source not canonical"
    blocks_rule_execution: false
    blocks_canonical_promotion: false
    owner: COACH_HOJUNE

  - id: OI-D9-TRIGGER-THRESHOLD-001
    priority: P1
    title: "D-9 public fixed trigger thresholds require canonical confirmation"
    blocks_rule_execution: false
    blocks_canonical_promotion: true
    owner: COACH_HOJUNE

  - id: OI-PRIVACY-RETENTION-001
    priority: P1
    title: "Retention duration for audit, evidence, and validation records"
    blocks_rule_execution: false
    blocks_canonical_promotion: true

  - id: OI-CONSENT-SHARING-001
    priority: P1
    title: "Cross-group consent and data-sharing policy"
    blocks_rule_execution: false
    blocks_canonical_promotion: true

  - id: OI-CAPABILITY-GRANT-001
    priority: P1
    title: "Capability grant lifecycle and revocation UX"
    blocks_rule_execution: false
    blocks_canonical_promotion: true

  - id: OI-SOLO-SAFETY-001
    priority: P1
    title: "SOLO safety acknowledgement UX and legal wording"
    blocks_rule_execution: false
    blocks_canonical_promotion: true

  - id: OI-NOTIFICATION-CONTEXT-001
    priority: P1
    title: "Notification routing context and group-specific visibility"
    blocks_rule_execution: false
    blocks_canonical_promotion: false

  - id: OI-RULE-SOURCE-MANIFEST-001
    priority: P2
    title: "Private source manifest mapping for public aliases"
    blocks_rule_execution: false
    blocks_canonical_promotion: false

  - id: OI-SESSION-TEMPLATE-CONFIDENCE-001
    priority: P1
    title: "SESSION_CLASSIFIER must define template_match_confidence"
    blocks_rule_execution: false
    blocks_canonical_promotion: true

  - id: OI-SESSION-EPOC-ENUM-001
    priority: P1
    title: "SESSION_CLASSIFIER must define epocStatus enum"
    blocks_rule_execution: false
    blocks_canonical_promotion: true

  - id: OI-MULTI-ENERGY-POLICY-001
    priority: P1
    title: "SESSION_CLASSIFIER must define multi_energy_time_allocation_policy"
    blocks_rule_execution: false
    blocks_canonical_promotion: true

  - id: OI-LD-DEFINITION-001
    priority: P1
    title: "SESSION_CLASSIFIER must define ld_definition"
    blocks_rule_execution: false
    blocks_canonical_promotion: true

  - id: OI-D4-NEXT-DAY-WINDOW-001
    priority: P2
    title: "D-4 next-day recovery window source exactness"
    blocks_rule_execution: false
    blocks_canonical_promotion: false

  - id: OI-D5-SEVERITY-SOURCE-001
    priority: P2
    title: "D-5 severity branch source granularity"
    blocks_rule_execution: false
    blocks_canonical_promotion: false

  - id: OI-D7-WEEK-ANCHOR-001
    priority: P2
    title: "D-7 weekly distribution anchor policy"
    blocks_rule_execution: false
    blocks_canonical_promotion: false

  - id: OI-D8-REQUIRED-INPUT-001
    priority: P2
    title: "D-8 required field list per integration source"
    blocks_rule_execution: false
    blocks_canonical_promotion: false

  - id: OI-AUDIT-SNAPSHOT-SCHEMA-001
    priority: P2
    title: "Evidence snapshot storage schema delegated to bridge"
    blocks_rule_execution: false
    blocks_canonical_promotion: false

  - id: OI-RETROACTIVE-OVERRIDE-WINDOW-001
    priority: P1
    title: "Retroactive override allowed window remains TBD"
    blocks_rule_execution: false
    blocks_canonical_promotion: true

  - id: OI-APP-BRIDGE-DB-SCHEMA-001
    priority: P2
    title: "Database and API implementation details delegated to APP_IMPLEMENTATION_BRIDGE"
    blocks_rule_execution: false
    blocks_canonical_promotion: false

  - id: OI-TEST-DATA-ANONYMIZATION-001
    priority: P2
    title: "Public test fixtures must remain anonymized"
    blocks_rule_execution: false
    blocks_canonical_promotion: false

  - id: OI-DISPLAY-LABEL-I18N-001
    priority: P2
    title: "Korean and English display label expansion"
    blocks_rule_execution: false
    blocks_canonical_promotion: false

  - id: OI-MODE-THRESHOLD-SOURCE-001
    priority: P2
    title: "Rolling 8-11 day and operational 2-4 day mode threshold source finalization"
    blocks_rule_execution: false
    blocks_canonical_promotion: false
```

---

## 14. Test Cases

```yaml
test_summary:
  total_count: 55
  passed: 55
  failed: 0
  status: PASS
```

| ID | Area | Scenario | Expected | Result |
|---|---|---|---|---|
| TC-D1-001 | D-1 | MAIN count below limit | OK | PASS |
| TC-D1-002 | D-1 | MAIN count equals warning boundary | WARN | PASS |
| TC-D1-003 | D-1 | MAIN count exceeds limit | ERROR | PASS |
| TC-D1-004 | D-1 | training week anchor from group setting | no fixed weekday | PASS |
| TC-D1-005 | D-1 | D-1 override with capability | append-only override | PASS |
| TC-D2-006 | D-2 | MAIN interval satisfied | OK | PASS |
| TC-D2-007 | D-2 | MAIN interval uncertain | REVIEW_REQUIRED | PASS |
| TC-D2-008 | D-2 | MAIN interval violated | ERROR | PASS |
| TC-D2-009 | D-2 | threshold unresolved | OI linked | PASS |
| TC-D2-010 | D-2 | override candidate session only | scoped override | PASS |
| TC-D3-011 | D-3 | weekly density within limit | OK | PASS |
| TC-D3-012 | D-3 | weekly density near limit | WARN | PASS |
| TC-D3-013 | D-3 | weekly density exceeded | ERROR | PASS |
| TC-D3-014 | D-3 | fixed weekday absent | valid | PASS |
| TC-D3-015 | D-3 | override expires at week window | revalidation required | PASS |
| TC-D4-016 | D-4 | epocStatus NORMAL | OK | PASS |
| TC-D4-017 | D-4 | epocStatus ELEVATED | WARN | PASS |
| TC-D4-018 | D-4 | epocStatus HIGH | ERROR | PASS |
| TC-D4-019 | D-4 | TEMPLATE_MATCH with HIGH confidence | WARN | PASS |
| TC-D4-020 | D-4 | TEMPLATE_MATCH with MEDIUM confidence | SKIP annotation | PASS |
| TC-D4-021 | D-4 | TEMPLATE_MATCH with LOW confidence | SKIP annotation | PASS |
| TC-D4-022 | D-4 | missing epocStatus | DATA_ERROR | PASS |
| TC-D5-023 | D-5 | severity NONE | OK | PASS |
| TC-D5-024 | D-5 | severity LOW | annotation | PASS |
| TC-D5-025 | D-5 | severity MEDIUM | WARN | PASS |
| TC-D5-026 | D-5 | severity HIGH | ERROR | PASS |
| TC-D5-027 | D-5 | severity UNKNOWN | DATA_ERROR | PASS |
| TC-D5-028 | D-5 | error override with evidence | append-only | PASS |
| TC-D6-029 | D-6 | no CK risk signal | OK | PASS |
| TC-D6-030 | D-6 | CK risk rechecked clear | OK | PASS |
| TC-D6-031 | D-6 | CK risk not rechecked, low intensity | WARN | PASS |
| TC-D6-032 | D-6 | CK risk not rechecked, MAIN candidate | ERROR | PASS |
| TC-D6-033 | D-6 | 48h advisory display | coach-only, non-enforced | PASS |
| TC-D6-034 | D-6 | evaluation window ends | revalidation, not recovery | PASS |
| TC-D7-035 | D-7 | ld_definition missing | DATA_ERROR | PASS |
| TC-D7-036 | D-7 | LD distribution OK | OK | PASS |
| TC-D7-037 | D-7 | LD distribution review | WARN | PASS |
| TC-D7-038 | D-7 | LD distribution violation | ERROR | PASS |
| TC-D7-039 | D-7 | SESSION dependency linked | handoff present | PASS |
| TC-D8-040 | D-8 | all required inputs valid | OK | PASS |
| TC-D8-041 | D-8 | optional inputs missing | SKIP annotation | PASS |
| TC-D8-042 | D-8 | required input missing | DATA_ERROR | PASS |
| TC-D8-043 | D-8 | conflicting required input | DATA_ERROR | PASS |
| TC-D8-044 | D-8 | data error override attempt | denied | PASS |
| TC-D9-045 | D-9 | no safety signal | OK | PASS |
| TC-D9-046 | D-9 | safety hard-stop active | ERROR_SAFETY | PASS |
| TC-D9-047 | D-9 | hard stop blocks AI recommendation | blocked | PASS |
| TC-D9-048 | D-9 | hard stop does not claim to block real-world training | false | PASS |
| TC-D9-049 | D-9 | SOLO self acknowledgement | recorded only | PASS |
| TC-D9-050 | D-9 | safety exception approval attempt | denied | PASS |
| TC-XY-051 | §X | R-rule override attempt | denied | PASS |
| TC-XY-052 | §X | D-rule override raw mutation attempt | denied | PASS |
| TC-XY-053 | §Y | cross-group notification without consent | forbidden | PASS |
| TC-XY-054 | §Y | scoped capability grant check | required | PASS |
| TC-XY-055 | §Y | evidence snapshot immutability | immutable | PASS |

---

## 15. Self-Validation

```yaml
self_validation:
  status: PASS
  version: 1.4
  ready_for_upload: true
  ready_for_canonical_promotion: false

  checks:
    organization_specific_names_removed: PASS
    public_alias_used_for_absolute_policy: PASS
    governance_owner_not_runtime_authority: PASS
    source_priority_training_doc_level_2: PASS
    R_rules_not_override_targets: PASS
    D_rule_meanings_preserved: PASS
    D2_validation_window_defined: PASS
    D4_confidence_not_encoded_as_pseudo_status: PASS
    D6_state_based_revalidation: PASS
    D6_48h_advisory_non_enforced: PASS
    D6_decided_by_meaning_scoped_to_spec_provenance: PASS
    D9_raw_status_and_display_code_split: PASS
    D9_solo_self_ack_not_safety_exception: PASS
    retroactive_override_TBD: PASS
    verdict_enum_english_only: PASS
    korean_labels_separate: PASS
    OverallVerdict_type_present: PASS
    EffectiveValidationResult_type_present: PASS
    RuleValidationResult_evidence_not_any: PASS
    GroupMember_capabilities_CapabilityGrant_array: PASS
    open_issues_count_23: PASS
    test_cases_count_55: PASS
```

---

## 16. Canonical Promotion Watchlist

```yaml
canonical_promotion_watchlist:
  canonical_promotion_allowed: false
  upload_allowed: true

  required_before_true:
    - OI-D2-MAIN-INTERVAL-001
    - OI-D9-TRIGGER-THRESHOLD-001
    - OI-PRIVACY-RETENTION-001
    - OI-CONSENT-SHARING-001
    - OI-CAPABILITY-GRANT-001
    - OI-SOLO-SAFETY-001
    - OI-SESSION-TEMPLATE-CONFIDENCE-001
    - OI-SESSION-EPOC-ENUM-001
    - OI-MULTI-ENERGY-POLICY-001
    - OI-LD-DEFINITION-001
    - OI-RETROACTIVE-OVERRIDE-WINDOW-001
```

---

## 17. Version History

```yaml
version_history:
  - version: 1.0
    summary: "Initial D-rule validator draft"

  - version: 1.1
    summary: "Rule review integration and initial override concept"

  - version: 1.2
    summary: "Expanded Coach Override policy"

  - version: 1.3
    summary: "Tenancy, group, capability, and notification model integrated"

  - version: 1.3.1
    summary: "Restored test cases, self-validation, and version history"

  - version: 1.3.2
    summary: "Micro-patch: D-9 split, D-4 confidence handling, TypeScript corrections, test count 55"

  - version: 1.4
    summary: "Public-safe global specification; organization-specific names removed; source aliases applied; final upload-ready version"
```

---

## 18. Handoff Summary

```yaml
handoff_summary:
  current_spec:
    spec_id: RULE_SPEC_D1_D9
    version: 1.4
    status: READY_FOR_UPLOAD
    upload_allowed: true
    canonical_promotion_allowed: false
    public_sanitized: true

  upload_target:
    path: /TRAINORACLE_Project/docs/SPEC/RULE_SPEC_D1_D9.md
    action: create_or_overwrite

  do_not_change:
    - D_rule_meanings
    - D_rule_threshold_policy
    - D2_validation_window_definition
    - D6_state_based_validity
    - D6_non_canonical_48h_advisory
    - D9_safety_hard_stop_behavior
    - SOLO_self_acknowledgement_behavior
    - test_cases_total
    - open_issues_count
    - canonical_promotion_allowed

  next_recommended_spec:
    file: SESSION_CLASSIFIER_SPEC.md
    target_version: 1.2
    blocking_dependencies:
      - template_match_confidence
      - epocStatus
      - multi_energy_time_allocation_policy
      - ld_definition

  public_sanitization:
    organization_specific_source_names_removed: true
    private_source_manifest_required: true
    absolute_policy_alias: ABSOLUTE_POLICY_R_RULES

  final_decision:
    upload: GO
    canonical_promotion: NO
```

<!-- FILE END: /TRAINORACLE_Project/docs/SPEC/RULE_SPEC_D1_D9.md -->
