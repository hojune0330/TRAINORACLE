# DAILY_LOG_AND_CHECKIN_SPEC.md

```yaml
document_metadata:
  doc_id: trainoracle-spec-013-daily-log-and-checkin
  spec_id: DAILY_LOG_AND_CHECKIN_SPEC
  title: TrainOracle Daily Log And Check-in Spec
  version: "0.2"
  round: RT1_RECONSTRUCT
  status: RECONSTRUCTED_DRAFT_FOR_REVIEW
  owner: COACH_HOJUNE
  owner_english_name: hojune jang

  reconstruction_notice:
    local_original_found: false
    reconstructed_from_sources: true
    restored_original: false
    prior_approved_version_restored: false

  open_issues_total: 7
  canonical_blocking_count: 3

  executed_tests_total: 0
  executed_tests_passed: 0
  self_check_is_runtime_evidence: false

  upload_allowed: false
  canonical_promotion_allowed: false
  final_marker_required: "[DRAFT_COMPLETE]"
```

---

## 1. Purpose

`DAILY_LOG_AND_CHECKIN_SPEC.md` defines the daily training-journal and check-in ingestion contract for TrainOracle.

This reconstructed draft exists because exact local filename search did not find an original `DAILY_LOG_AND_CHECKIN_SPEC.md` before reconstruction. It must not be treated as a restored original, prior approved version, runtime evidence, canonical promotion, or issue closure.

Daily Log is the athlete-facing ingestion layer for training analysis, plan design, evidence-based coaching, Safety Gate context, and future daily brief / AI Inbox signals. It is not a separate planning engine and must not bypass RVE, Plan Safety Gate, Plan Generator, Template Library, Physio Source Trust, App Bridge, Athlete Profile, or Session Classifier contracts.

---

## 2. Non-Purpose

This document does not:

- redefine `RULE_SPEC_D1_D9.D-*` rule semantics
- implement the D9 evaluator
- replace `RULE_VALIDATION_ENGINE_CONTRACT.md`
- replace `PLAN_SAFETY_GATE_SPEC.md`
- replace `APP_IMPLEMENTATION_BRIDGE.md`
- replace `PHYSIO_SOURCE_TRUST_SPEC.md`
- define final web/app UI
- create a parallel plan generator
- create medical, injury, rehab, return-to-play, or high-intensity clearance
- store raw athlete free text, raw symptom clauses, injury narratives, medical notes, rehab notes, evidence clauses, or guardian private notes in server, analysis, or audit records
- claim D9 evaluator runtime PASS evidence
- close any RVE, Safety Gate, Plan Generator, Physio Source, App Bridge, Athlete Profile, or Daily Brief issue

---

## 3. Source Priority

```yaml
source_priority:
  daily_flow_planning:
    - document: SPEC_LEGACY_ALIGNMENT_AND_DAILY_LOG_PLAN.md
      treatment: CONTINUITY_PLAN
      consumed_for:
        - daily_log_service_flow
        - missing_daily_log_contract_gap
        - memo_free_text_reconciliation
        - future_productization_order

  app_storage_and_consent:
    - document: specs/active/APP_IMPLEMENTATION_BRIDGE.md
      treatment: READ_ONLY_APP_BRIDGE_BASELINE
      consumed_for:
        - source_snapshot_records
        - consent_guard
        - capability_guard
        - audit_boundary
        - tenant_group_athlete_scope

  athlete_profile:
    - document: specs/active/ATHLETE_PROFILE_SPEC.md
      treatment: READ_ONLY_PROFILE_BASELINE
      consumed_for:
        - athlete_scoped_preferences
        - consent_lifecycle
        - minor_guardian_boundary
        - privacy_reason_text_policy

  session_classifier:
    - document: specs/active/SESSION_CLASSIFIER_SPEC.md
      treatment: READ_ONLY_CLASSIFIER_BASELINE
      consumed_for:
        - session_context_refs
        - completed_session_linkage
        - no_classifier_output_redefinition

  physio_source_trust:
    - document: specs/active/PHYSIO_SOURCE_TRUST_SPEC.md
      treatment: READ_ONLY_PHYSIO_BASELINE
      consumed_for:
        - structured_readiness
        - structured_soreness
        - structured_wellness
        - structured_RPE
        - freshness_and_conflict_policy

  rve_and_safety_gate:
    - document: specs/reconstruct/RULE_VALIDATION_ENGINE_CONTRACT.md
      treatment: RECONSTRUCTED_DRAFT_FOR_REVIEW
      consumed_for:
        - reason_code_storage
        - D9_signal_boundary
        - raw_text_forbidden_storage
    - document: specs/reconstruct/PLAN_SAFETY_GATE_SPEC.md
      treatment: RECONSTRUCTED_DRAFT_FOR_REVIEW
      consumed_for:
        - pre_generation_safety_gate
        - D9_ACTIVE_UNKNOWN_CLEARED_routing
        - no_raw_text_safety_gate_inputs

  design_context_reference:
    - document: design-system/SCREENS.md
      treatment: DESIGN_REFERENCE_ONLY
      consumed_for:
        - Daily_Checkin_six_question_surface
        - RPE_sleep_condition_pain_memo_UI_intent
    - document: HANDOFF.md
      treatment: DESIGN_REFERENCE_ONLY
      consumed_for:
        - draft_CheckIn_shape
        - screen_priority_context
```

---

## 4. Hard Constraints

```yaml
hard_constraints:
  no_global_coach_authority: true
  no_safety_hard_stop_override: true
  no_D9_rule_semantic_redefinition: true
  no_rule_threshold_definition: true
  no_external_llm_with_private_athlete_data: true
  no_raw_free_text_server_analysis_or_audit_storage: true
  local_device_raw_text_requires_explicit_purpose_contract: true
  no_raw_symptom_clause_storage: true
  no_evidence_clause_storage_in_audit: true
  no_medical_note_storage_in_daily_log: true
  no_guardian_private_note_storage_in_daily_log: true
  no_free_text_clearance_of_existing_risk: true
  free_text_can_raise_risk: true
  good_physio_data_cannot_clear_D9_risk: true
  template_selection_cannot_clear_D9_risk: true
  daily_log_cannot_bypass_RVE_or_Safety_Gate: true
  daily_log_cannot_generate_plan_candidates: true
  no_runtime_pass_claim_without_actual_log: true
  no_issue_closure_from_reconstruction_only: true
```

Daily check-in can make the system more cautious. It cannot make the system less cautious when a safety risk is already `ACTIVE` or `UNKNOWN`.

---

## 5. Namespace Policy

```yaml
namespace_policy:
  current_rule_namespace:
    name: RULE_SPEC_D1_D9
    example: RULE_SPEC_D1_D9.D-9
    meaning: current SPEC-layer validation rule

  legacy_workflow_namespace:
    name: LEGACY_PHASE_D
    example: LEGACY_PHASE_D.D-9
    meaning: old workflow Phase D validation item

  cycle_day_namespace:
    name: CYCLE_DAY
    example: CYCLE_DAY.D-5
    meaning: cycle or race-day label, not a rule id

  bare_D_reference_in_new_specs: FORBIDDEN
```

Daily log records may include cycle-day labels only through `CYCLE_DAY.*` fields. They must not use bare `D-*` strings as rule IDs.

---

## 6. User-Facing Daily Check-in Scope

Design references describe a fast daily check-in with RPE, sleep, condition, pain/body area, and optional memo. This spec preserves that product intent while defining the storage contract as structured-first and privacy-safe.

```yaml
daily_checkin_surface:
  target_completion_time: "<=5 minutes"
  common_steps:
    - previous_session_RPE
    - sleep_hours
    - sleep_quality
    - overall_condition
    - pain_or_soreness_body_area
    - optional_constrained_note

  display_surfaces:
    - Dashboard_today_checkin_state
    - Session_Detail_context
    - Analysis_trends
    - AI_Inbox_signal_candidate
    - Daily_Brief_candidate_future_spec

  not_owned_here:
    - final_visual_layout
    - final_component_library
    - push_notification_policy
    - daily_brief_generation_copy
    - AI_Inbox_ranking_algorithm
```

---

## 7. Storable Structured Fields

```yaml
DailyCheckInRecord:
  required_scope:
    - tenantId
    - groupId
    - athleteId
    - checkInDate
    - createdAt
    - sourceSnapshotId
    - auditLogId

  structured_fields_allowed:
    rpe:
      type: integer
      range: 1..10
      nullable: true
    sleepHours:
      type: decimal_hours
      range: 0..16
      nullable: true
    sleepQuality:
      type: enum
      values: [VERY_POOR, POOR, OK, GOOD, GREAT]
      nullable: true
    overallCondition:
      type: enum
      values: [VERY_LOW, LOW, NORMAL, GOOD, GREAT]
      nullable: true
    mood:
      type: enum
      values: [LOW, NEUTRAL, GOOD, HIGH]
      nullable: true
    readiness:
      type: enum
      values: [NOT_READY, CAUTION, NORMAL, READY]
      nullable: true
    sorenessOverall:
      type: integer
      range: 0..5
      nullable: true
    bodyAreaSignals:
      type: readonly BodyAreaSignal[]
      nullable: true
    completedSessionRef:
      type: ClassifiedSessionRecordRef
      nullable: true
    plannedSessionRef:
      type: PlannedSessionDraftRef
      nullable: true
    nonSensitiveReasonCodes:
      type: readonly string[]
      nullable: false
```

```typescript
export type BodyArea =
  | "HEAD_NECK"
  | "SHOULDER_ARM"
  | "CHEST_BACK"
  | "HIP_GLUTE"
  | "THIGH"
  | "KNEE"
  | "CALF_ACHILLES"
  | "ANKLE_FOOT"
  | "OTHER_STRUCTURED";

export interface BodyAreaSignal {
  bodyArea: BodyArea;
  side?: "LEFT" | "RIGHT" | "BILATERAL" | "UNSPECIFIED";
  level: 0 | 1 | 2 | 3 | 4 | 5;
  signalType: "SORENESS" | "PAIN_SIGNAL" | "TIGHTNESS" | "FATIGUE" | "OTHER_STRUCTURED";
  durationBand?: "TODAY_ONLY" | "TWO_TO_THREE_DAYS" | "FOUR_TO_SEVEN_DAYS" | "MORE_THAN_SEVEN_DAYS";
}

export interface DailyCheckInRecord {
  tenantId: TenantId;
  groupId: GroupId;
  athleteId: AthleteId;
  checkInDate: ISO8601Date;
  rpe?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
  sleepHours?: number;
  sleepQuality?: "VERY_POOR" | "POOR" | "OK" | "GOOD" | "GREAT";
  overallCondition?: "VERY_LOW" | "LOW" | "NORMAL" | "GOOD" | "GREAT";
  mood?: "LOW" | "NEUTRAL" | "GOOD" | "HIGH";
  readiness?: "NOT_READY" | "CAUTION" | "NORMAL" | "READY";
  sorenessOverall?: 0 | 1 | 2 | 3 | 4 | 5;
  bodyAreaSignals: readonly BodyAreaSignal[];
  completedSessionRef?: ClassifiedSessionRecordRef;
  plannedSessionRef?: PlannedSessionDraftRef;
  nonSensitiveReasonCodes: readonly string[];
  sourceSnapshotId: SourceSnapshotId;
  auditLogId: AuditLogId;
  createdAt: ISO8601;
}
```

### 7A. Race-Day Quick Check Binding

```yaml
race_day_quick_check_binding:
  patched_from: RACE_RECORD_AND_HISTORICAL_RECALL_SPEC.md; accepted 2026-07-10 by SPEC_SOURCE_ACCEPTANCE_DECISION_ROUND4.md
  binding_type: reference_only
  canonical_field_duplication_allowed: false
  defined_in: specs/reconstruct/RACE_RECORD_AND_HISTORICAL_RECALL_SPEC.md
  applicable_surface:
    - LogEntry race quick check
    - CYCLE_DAY.D-0 race form
  namespace_requirement:
    race_day_label_namespace: CYCLE_DAY
    bare_D_reference_in_storage_or_audit: forbidden
  safety_boundary:
    can_raise_review_attention: true
    can_clear_D9_or_Safety_Gate: false

  interim_app_local_projection:
    decision_ref: TO-DECISION-RACE-SELFCHECK-FIELDS-2026-07-14-001
    source_document: RACE_SELFCHECK_FIELDS_DECISION.md
    owner_approved_at: 2026-07-14
    owner: COACH_HOJUNE
    scope: app_local_JournalEntry_pilot_only
    pending_binding_to_canonical_RaceDayCheckInRecord: true
    creates_new_canonical_subtype: false
    grants_server_or_Formation_runtime_authority: false
    fields:
      tension: optional_integer_1_to_10
      condition: optional_integer_1_to_5
      goalPace:
        schemaVersion: 1
        unit: seconds_per_kilometer
        secondsPerKm: positive_integer
      mood: optional_integer_1_to_5
    strategy_or_other_free_text_field: forbidden
    strategy_text_route: explicit_purpose_scoped_note_only
    current_use: collection_and_display_only
    excluded_consumers: [Trends, Formation, PlanGenerator, D9, SafetyGate]
```

Race-day quick check subtypes are not reproduced in this document. `DAILY_LOG_AND_CHECKIN_SPEC.md` may reference them as daily-log-adjacent ingestion records only when the subtype, namespace handling, privacy boundary, and race safety boundary remain owned by `RACE_RECORD_AND_HISTORICAL_RECALL_SPEC.md`.

The owner-approved local `RaceEntry` fields above are an interim app projection, not
a duplicated canonical record or a new canonical subtype. Canonical binding remains
open until the Race Record owner contract, provenance handling, analysis acceptance,
and runtime evidence are reviewed separately.

---

## 7B. Quick Log Contract

```yaml
quick_log_contract:
  patched_from: SPEC_TAP_FIRST_LOGGING.md
  contract_status: SPEC_ONLY_OWNER_ADOPTION_PENDING
  runtime_implementation_status: NOT_CLAIMED
  canonical_promotion_status: NOT_CLAIMED
  issue_closure_status: NOT_CLAIMED

  modes:
    quick:
      entry_behavior: default_fast_entry
      text_input_fields: 0
    detail:
      entry_behavior: existing_full_form
    shared_invariants:
      JournalEntry_schema: identical
      save_path: same_saveEntry()
      existing_field_addition_deletion_or_type_change: forbidden
      quick_to_detail_value_handoff: preserve_current_values

  tap_counting:
    counted_event: one_deliberate_user_tap_that_selects_changes_or_confirms_a_value_or_command
    entry_point_tap_counts: true
    automatic_transition_after_selection_counts_as_tap: false
    animation_or_derived_value_appearance_counts_as_tap: false

  budgets:
    post_session_quick:
      maximum_taps: 5
      same_kind_prefill_maximum_taps: 3
      maximum_screen_transitions: 2
    evening_quick:
      maximum_taps: 7
      no_pain_path_maximum_taps: 4
      maximum_screen_transitions: 2
    race_pre_quick:
      maximum_taps: 4
      maximum_screen_transitions: 1

  preset_standard:
    distance_km_chips: [3, 5, 8, 10, 12]
    duration_min_chips: [20, 30, 40, 60, 90]
    sleep_hours_chips: [6, 6.5, 7, 7.5, 8, 9]
    stepper_increments:
      distance_km: 0.5
      duration_min: 5
      body_weight_kg: 0.1
      heart_rate_bpm: 1
    default_sorting: nearest_relevant_or_previous_value
    largest_value_first_or_training_increase_nudge: forbidden

  derived_pace:
    formula: durationMin / distanceKm
    display_unit: pace_per_km
    requires_nonzero_fields: [durationMin, distanceKm]
    when_either_input_is_missing_or_zero: do_not_display_or_persist_a_pace_value
    quick_mode_user_input_surface: forbidden
    provenance_requirement: DERIVED_under_data_provenance_contract

  same_kind_prefill:
    trigger: explicit_current_entry_user_tap_on_same_kind_prefill
    source: most_recent_entry_with_identical_kind
    copies_only: [system, distanceKm, durationMin]
    never_copies: [memo, rpe]
    copied_values_require_current_entry_confirmation: true
    no_matching_entry_behavior: leave_fields_MISSING

  partial_and_completion_state:
    partial_save_allowed: true
    missing_answers_never_block_save: true
    silent_defaults_as_athlete_facts: forbidden
    completion_paper_shows_only_values_selected_for_current_entry: true
    weekly_written_day_dots_are_fact_display_only: true
    streak_pressure_or_training_volume_nudge_copy: forbidden

  pain_review_invariants:
    quick_and_detail_use_same_painLevelsRequireReview: true
    REVIEW_banner_visibility_identical_for_same_pain_values: true
    quick_mode_can_bypass_safety_evaluation: false
    no_pain_action_requires_explicit_current_entry_tap: true
    favorable_checkin_or_completion_state_can_clear_D9_or_Safety_Gate: false
```

Quick mode changes interaction cost, not storage truth or safety authority. It must preserve the visible ink stack across each automatic transition, and the accumulated values must remain editable without treating a transition, animation, preset ordering, or prior record as a new athlete fact.

---

## 7C. Data Provenance Contract

```yaml
data_provenance_contract:
  contract_status: OWNER_ADOPTED_RUNTIME_IMPLEMENTATION_UNMERGED
  applies_to: every_coaching_relevant_numeric_field_in_each_entry
  persisted_states: [EXPLICIT, DERIVED, MISSING]
  read_time_only_state: LEGACY_MISSING_PROVENANCE
  unrecognized_provenance_state: INVALID_AND_INELIGIBLE
  imported_and_demo_scope:
    labels: [IMPORTED, DEMO]
    contract_status: PENDING_OWNER_DECISION
    persisted_as_new_states_under_this_contract: false
    ineligible_until_contract_adopted_by: COACH_HOJUNE
    excluded_surfaces:
      - weekly_statistics
      - trend_analysis
      - future_training_plan_evidence

  state_semantics:
    EXPLICIT:
      meaning: user_directly_tapped_selected_or_entered_the_current_entry_value
      may_be_eligible_for_analysis_or_future_plan_evidence: true
    DERIVED:
      meaning: system_calculated_from_current_entry_inputs
      may_be_eligible_for_analysis_or_future_plan_evidence: conditional
    MISSING:
      meaning: user_skipped_the_field_and_no_athlete_fact_exists
      may_be_eligible_for_analysis_or_future_plan_evidence: false
    LEGACY_MISSING_PROVENANCE:
      meaning: metadata_absent_on_a_record_created_before_provenance_adoption
      persisted_as_a_new_state: false
      may_be_eligible_for_analysis_or_future_plan_evidence: false

  optional_metadata_proposal:
    adoption_authority: COACH_HOJUNE
    optional_field_name: fieldProvenance
    compatibility: existing_entries_without_fieldProvenance_remain_readable
    absent_metadata_read_as: LEGACY_MISSING_PROVENANCE
    existing_JournalEntry_field_names_and_types: unchanged
    existing_field_addition_deletion_or_type_change: forbidden
    metadata_keys: existing_field_names_only
    raw_text_values_allowed: false
    per_field_shape:
      provenance: EXPLICIT_or_DERIVED_or_MISSING
      derivedFrom: required_nonempty_array_of_existing_field_names_for_DERIVED_only
      derivationRuleId: required_nonempty_stable_rule_identifier_for_DERIVED_only

  derived_eligibility:
    derivedFrom_must_enumerate_every_actual_input: true
    derivationRuleId_must_be_present_and_nonempty: true
    derived_inputs_must_all_be: EXPLICIT
    nested_DERIVED_input_is_eligible: false
    MISSING_input_is_eligible: false
    LEGACY_MISSING_PROVENANCE_input_is_eligible: false
    unknown_input_provenance_is_eligible: false
    omitted_actual_input_is_eligible: false
    any_non_EXPLICIT_actual_input_makes_DERIVED_ineligible: true

  aggregate_and_plan_eligibility:
    eligible_direct_value: EXPLICIT_only
    eligible_derived_value: DERIVED_only_when_every_derived_eligibility_rule_passes
    excluded_surfaces:
      - weekly_statistics
      - trend_analysis
      - future_training_plan_evidence
    MISSING_excluded_from_all_listed_surfaces: true
    LEGACY_MISSING_PROVENANCE_excluded_from_all_listed_surfaces: true
    invalid_unknown_or_omitted_provenance_excluded_from_all_listed_surfaces: true
    ineligible_DERIVED_excluded_from_all_listed_surfaces: true

  save_and_default_invariants:
    partial_save_allowed: true
    missing_or_ineligible_field_can_block_entry_save: false
    skipped_field_must_be_MISSING_when_metadata_is_created: true
    silent_default_can_be_reclassified_as_EXPLICIT: false
    metadata_absence_can_be_inferred_as_EXPLICIT: false

  privacy_and_safety:
    fieldProvenance_may_store_raw_memo_symptom_evidence_or_private_text: false
    derivedFrom_contains_field_identifiers_not_values: true
    provenance_can_clear_D9_or_Safety_Gate: false
    free_text_favorable_checkin_template_or_good_physio_can_clear_D9_risk: false
    daily_log_still_cannot_bypass_RVE_or_Safety_Gate: true
```

`LEGACY_MISSING_PROVENANCE` is a conservative read-time interpretation, not permission to rewrite old records or infer athlete intent. A caller may display a partial or legacy entry, but only an `EXPLICIT` value or a `DERIVED` value whose complete dependency set is entirely `EXPLICIT` may enter weekly statistics, trends, or future training-plan evidence.

---

## 8. Free-Text And Memo Boundary

Daily Check-in separates private writing from analyzable training notes. A private
note is not a hidden safety input. An analyzable training note is not permission to
persist or expose its raw text outside the athlete's device.

```yaml
memo_policy:
  patched_from: CODEX_WORK_ORDER_009 amendment_v3 + TO-DECISION-RACE-SELFCHECK-FIELDS-2026-07-14-001
  contract_status: OWNER_APPROVED_APP_LOCAL_INCREMENT
  runtime_implementation_status: NOT_CLAIMED
  owner_adoption:
    owner: COACH_HOJUNE
    approved_at: 2026-07-14
    scope: purpose_selector_and_app_local_storage_boundary
    spec_canonical_promotion: NOT_CLAIMED
    server_sync_authority: none
    Formation_or_plan_evidence_authority: none
  purposes: [PRIVATE_SELF_ONLY, ANALYZABLE_TRAINING_NOTE]
  legacy_or_unlabeled_text_read_as: PRIVATE_SELF_ONLY
  implicit_consent_from_existing_memo_field: forbidden
  new_nonempty_text_requires_explicit_purpose_selector: true
  race_strategy_free_text_requires_explicit_note_purpose: true

  file_transport:
    first_delivery: SELECTIVE_EXPORT_AND_OS_SHARE
    operation_class: USER_DIRECTED_FILE_OPERATION
    memo_inclusion_default: false
    exact_field_preview_required: true
    explicit_memo_inclusion_confirmation_required: true
    owner_full_local_backup_allowed: true
    automatic_network_upload_allowed: false
    preselected_recipient_allowed: false
    analysis_consent_from_export_or_share: prohibited
    standing_coach_guardian_or_friend_access_from_export_or_share: prohibited
    Formation_plan_safety_reward_or_telemetry_effect: prohibited

  PRIVATE_SELF_ONLY:
    user_facing_name_candidate: 나만의 메모
    raw_text_local_device_persistence_allowed: true
    D9_or_safety_assessment_allowed: false
    athlete_analysis_allowed: false
    derived_signal_generation_allowed: false
    server_sync_allowed: false
    coach_access_allowed: false
    future_plan_evidence_allowed: false
    default_export_inclusion: false
    explicit_user_selected_file_inclusion: allowed_under_file_transport_contract
    account_reward_event_from_presence_frequency_length_or_content: forbidden
    UI_must_not_claim_safety_monitoring: true
    processing_flow_after_local_device_save: stop

  ANALYZABLE_TRAINING_NOTE:
    user_facing_name_candidates: [훈련 메모, 오늘의 메모]
    explicit_current_entry_purpose_required: true
    raw_text_local_device_persistence_allowed: true
    transient_local_D9_assessment_allowed: true
    transient_local_athlete_analysis_allowed: true
    transient_sanitized_review_metadata_allowed: true
    can_raise_review_attention: true
    can_clear_D9_or_SafetyGate_risk: false
    current_sanitized_result_persistence_allowed: false
    current_downstream_plan_or_SafetyGate_consumer_exists: false
    athlete_analysis_runtime_status: NOT_IMPLEMENTED
    privacy_safe_structured_derivation_allowed: true
    raw_text_server_sync_allowed: false
    raw_text_coach_access_allowed: false
    structured_result_coach_access_default: false_until_separate_adoption
    future_plan_evidence_allowed_before_separate_adoption: false
    default_export_inclusion: false
    explicit_user_selected_file_inclusion: allowed_under_file_transport_contract

  current_device_security_truth:
    current_app_storage: browser_localStorage
    at_rest_encryption_evidence: absent
    secure_storage_claim_allowed: false
    encrypted_diary_claim_allowed: false
    allowed_UI_claim: 이 기기에만 저장
    device_or_browser_profile_access_risk_remains: true

  storage_location_matrix:
    athlete_device_raw_text: allowed_only_under_selected_purpose
    server_raw_text: forbidden
    audit_raw_text: forbidden
    analytics_raw_text: forbidden
    plan_generator_raw_text: forbidden
    coach_surface_raw_text: forbidden

  raw_symptom_clause_persistence_allowed: false
  raw_injury_narrative_persistence_allowed: false
  raw_medical_note_persistence_allowed: false
  raw_guardian_private_note_persistence_allowed: false

  analyzable_note_allowed_processing:
    - transient_local_validation
    - transient_risk_extraction
    - transient_athlete_analysis
    - reason_code_generation
    - privacy_safe_structured_signal_generation

  future_persistence_allowlist_after_separate_adoption:
    - structured_fields
    - nonSensitiveReasonCodes
    - D9_disposition
    - analysisSignalCodes
    - sourceSnapshotId
    - auditLogId
    - extractionVersion

  AthleteNoteDerivedSignal:
    runtime_status: NOT_IMPLEMENTED
    sourcePurpose: ANALYZABLE_TRAINING_NOTE_only
    required_fields:
      - registeredSignalCode
      - confidenceOrUncertainty
      - sourceSnapshotId
      - extractionVersion
    optional_fields:
      - valueBand_from_closed_vocabulary
    forbidden_fields:
      - rawText
      - quote
      - generatedNarrative
      - sentimentLabel_without_adopted_vocabulary
      - diagnosis
      - medicalInference
    registeredSignalCode_vocabulary_status: PENDING_SEPARATE_ADOPTION
    may_feed_athlete_analysis_before_vocabulary_adoption: false
    may_feed_future_plan_before_separate_adoption: false

  forbidden_downstream_payloads:
    - raw_memo_text
    - raw_athlete_statement
    - symptom_clause
    - evidence_clause
    - injury_description
    - medical_note
    - rehab_note
    - guardian_private_note
    - external_llm_prompt_with_private_athlete_data
```

`PRIVATE_SELF_ONLY` cannot raise or clear risk because it is never evaluated. Safety
capture remains available through separate structured pain and check-in fields.
`ANALYZABLE_TRAINING_NOTE` can raise risk, request review, or produce non-sensitive
structured signals. It cannot clear `D9_ACTIVE`, `D9_UNKNOWN`, Safety Gate block
states, physio-source conflict states, or template eligibility failures.

Any transient sanitized assessment remains local implementation output and is not
persisted or plan evidence. After explicit `ANALYZABLE_TRAINING_NOTE` selection, the
local transient D9 evaluator may return allowlisted review metadata and raise review
attention. It can never clear risk. No current Formation, Plan Generator, Safety Gate,
Trends, or coach-surface consumer exists or is claimed. Any future persistence or
downstream consumption requires provenance, registered signal vocabulary, privacy
review, runtime evidence, and separate owner adoption. PR #63's athlete-visible
shadow-mode direction remains a draft disclosure contract; this app-local increment
does not activate shadow generation or a shadow pilot.

### 8A. Transient Note Assessment Contract

```yaml
memo_transient_assessment_contract:
  patched_from: PLAN_F0F_TASKR_HARDENING.md + ORDER_007_R_safety.md + CODEX_WORK_ORDER_009 amendment_v3
  contract_status: OWNER_APPROVED_APP_LOCAL_TRANSIENT_PATH
  runtime_evidence_status: NOT_CLAIMED

  invocation:
    function: assessMemoTransient(rawText)
    timing: immediately_before_saveEntry
    required_conditions:
      - memoPurpose_is_ANALYZABLE_TRAINING_NOTE
      - raw_text_is_nonempty
      - current_entry_purpose_was_explicitly_selected
    forbidden_conditions:
      - memoPurpose_is_PRIVATE_SELF_ONLY
      - purpose_is_absent_legacy_or_unrecognized
      - raw_text_is_empty

  allowed_result_metadata:
    - memoPurpose
    - disposition
    - blocksPlanGeneration
    - nonSensitiveReasonCodes
    - evaluatorVersion
    - evaluatedAt
  result_lifecycle:
    current_scope: in_memory_current_entry_review_only
    persistence_allowed_now: false
    Formation_or_PlanGenerator_evidence_allowed_now: false
    downstream_SafetyGate_consumer_exists_now: false
  forbidden_result_metadata:
    - rawText
    - rawTextHash
    - quotedClause
    - evidenceClause
    - generatedSummary
    - reconstructable_token_or_embedding

  failure_behavior:
    evaluator_exception_disposition: D9_UNKNOWN
    entry_save_blocked: false
    review_attention_required: true
    current_UI_copy_ceiling: 분석 결과를 확인해야 해요. 기록은 저장됐어요.
    current_UI_must_not_claim_plan_block_is_runtime_active: true

  future_consumption:
    plan_generator_implemented_now: false
    blocksPlanGeneration_runtime_consumer_exists_now: false
    future_consumer_must_use_SafetyGate: true
    current_app_may_claim_future_plan_blocking: false

  console_marker:
    format: "[D9MEMO] disposition=<v> codes=<n>"
    raw_text_logging: forbidden
    reason_code_value_logging: forbidden

  backward_compatible_metadata_proposal:
    adoption_authority: COACH_HOJUNE
    memoPurpose_field: optional
    memoAssessment_field: forbidden_in_current_app_persistence
    sanitized_assessment_persistence_status: NOT_ADOPTED
    absent_memoPurpose_read_as: PRIVATE_SELF_ONLY
    separate_review_index_alternative: rejected_due_to_entry_linkage_and_divergence_risk
```

The sanitized assessment persistence proposal is not adopted runtime schema
authority. The current result is transient only. Any future `memoAssessment` field
would require a separate owner decision and could carry only the allowlisted metadata
above; it must never contain raw text, summaries, embeddings, or quoted evidence.

---

## 9. Processing Flow

```yaml
daily_log_processing_flow:
  0_route_free_text_by_purpose:
    PRIVATE_SELF_ONLY:
      save_raw_text_to_selected_local_device_store: true
      continue_to_normalize_RVE_analysis_or_product_surfaces: false
      emit_presence_or_processing_telemetry: false
    ANALYZABLE_TRAINING_NOTE:
      requires_explicit_current_entry_purpose: true
      may_continue_to_transient_processing: true
    absent_legacy_or_unrecognized_purpose:
      read_as: PRIVATE_SELF_ONLY
      may_continue_to_transient_processing: false

  1_capture:
    creates:
      - transient_checkin_input
      - purpose_labeled_local_note_input_when_present
    validates:
      - tenant_group_athlete_scope
      - athlete_identity_or_authorized_actor
      - active_consent
      - minor_guardian_consent_when_required
      - explicit_note_purpose_for_new_nonempty_text

  2_normalize:
    creates:
      - DailyCheckInRecord
      - SourceSnapshotRecord
      - AuditLogRecord
    removes_before_persistence:
      - raw_memo_text_from_server_analysis_and_audit_records
      - raw_symptom_clause
      - raw_evidence_clause

  3_classify_or_link_session:
    may_read:
      - completedSessionRef
      - plannedSessionRef
      - sourceSnapshotId
    must_not_redefine:
      - SESSION_CLASSIFIER_outputs

  4_profile_and_physio_context:
    may_read:
      - AthleteProfileSnapshotStorageRecord
      - PHYSIO_SOURCE_TRUST structured status
    must_not_clear:
      - D9_ACTIVE
      - D9_UNKNOWN
      - SafetyGate_BLOCK

  5_RVE_signal_candidate:
    may_send_to_RVE_runtime_boundary:
      - structured_safety_status
      - current_symptom_flags_from_structured_fields
      - recent_session_context_refs
      - consent_and_scope_context
      - transient_ANALYZABLE_TRAINING_NOTE_only_inside_runtime_processing_boundary
    must_not_store_in_RVE_or_audit:
      - raw_free_text
      - raw_symptom_clause
      - raw_evidence_clause

  6_safety_gate_and_plan_generator:
    SafetyGate_consumes_RVE_signal: true
    PlanGenerator_consumes_SafetyGate_result: true
    DailyLog_must_not_bypass_SafetyGate: true
    blocked_generation_outputs_forbidden: true

  7_product_surfaces:
    may_emit_candidates_for_future_specs:
      - DailyBriefSignal
      - AIInboxSignal
      - AnalysisTrendPoint
    must_include_when_generated:
      - sourceRefs
      - confidence_or_uncertainty
      - nonSensitiveReasonCodes
    must_exclude:
      - PRIVATE_SELF_ONLY_presence_or_metadata
      - raw_ANALYZABLE_TRAINING_NOTE_text
```

---

## 10. Risk Raising Rules

Daily check-in values can raise risk or request review only through structured rules and reason codes.

```yaml
risk_raising_policy:
  may_raise_review_or_block:
    - body_area_signal_level_high
    - same_body_area_repeated
    - sleep_low_repeated
    - RPE_rising_against_baseline
    - readiness_not_ready
    - analyzable_training_note_transient_extraction_flags_review
    - physio_source_conflict

  must_not_clear_risk:
    - good_sleep
    - low_RPE
    - athlete_says_ok
    - coach_preference
    - good_template_match
    - good_physio_source

  reason_code_examples_non_exhaustive:
    - DAILY_LOG_HIGH_PAIN_SIGNAL
    - DAILY_LOG_REPEATED_BODY_AREA_SIGNAL
    - DAILY_LOG_LOW_SLEEP_REPEATED
    - DAILY_LOG_RPE_SPIKE
    - DAILY_LOG_READINESS_CAUTION
    - DAILY_LOG_TRANSIENT_NOTE_REVIEW_REQUESTED
```

This document does not define D9 thresholds. Threshold ownership remains with `RULE_SPEC_D1_D9.md` and downstream accepted evaluator contracts.

---

## 11. Consent, Minor, And Capability Boundary

```yaml
consent_and_capability:
  required_for_capture:
    - ATHLETE_PROFILE_VISIBILITY_or_equivalent_service_consent
  required_for_training_analysis_use:
    - TRAINING_HISTORY_USE_FOR_PLAN_GENERATION
  required_for_physio_use_when_present:
    - PHYSIOLOGICAL_DATA_USE
  required_for_minor_sensitive_or_health_related_fields:
    - GUARDIAN_CONSENT

  actor_rules:
    athlete_self_checkin: allowed_with_scope_and_consent
    coach_entered_checkin: requires_scoped_capability_and_audit
    guardian_entered_checkin: requires_minor_guardian_scope_and_audit

  forbidden:
    - global_coach_authority
    - consent_bundling_for_sensitive_fields
    - revoked_consent_authorizing_new_processing
    - expired_consent_authorizing_new_processing
```

---

## 12. API And Storage Draft

```yaml
api_surface_draft:
  create_daily_checkin:
    method: POST
    path: /bridge/daily-checkins
    required_capability_or_actor:
      - ATHLETE_SELF_CHECKIN
      - WRITE_DAILY_CHECKIN_SCOPED
    creates:
      - DailyCheckInRecord
      - SourceSnapshotRecord
      - AuditLogRecord
    raw_text_persistence: false

  get_daily_checkin:
    method: GET
    path: /bridge/daily-checkins/{id}
    requires:
      - tenant_group_athlete_scope
      - active_consent_or_valid_policy_exception

  list_daily_checkins:
    method: GET
    path: /bridge/athletes/{athleteId}/daily-checkins
    requires:
      - tenant_group_athlete_scope
      - date_range

  redact_transient_note_safety_cleanup:
    method: POST
    path: /bridge/daily-checkins/{id}/redact-transient-note
    purpose: "Safety cleanup for accidental raw text capture."
```

This API draft is a contract sketch only. It does not select database vendor, auth vendor, or final route names.

---

## 13. Downstream Productization Boundaries

```yaml
downstream_boundaries:
  DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC:
    needed_before:
      - daily_summary_generation
      - AI_Inbox_item_generation_from_checkin
      - push_or_notification_policy
    must_require:
      - source_refs
      - confidence_or_uncertainty
      - non_sensitive_reason_codes
      - no_private_athlete_data_to_external_LLM

  PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC:
    needed_before:
      - plan_option_rationale_generation_from_checkin_context
      - coach_visible_reasoning_copy

  ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT:
    needed_before:
      - trend_visualizations_from_daily_checkins
      - body_area_trend_chart
      - readiness_panel
```

Daily Log can feed these future contracts, but it does not define them.

---

## 14. Issue Closure Boundary

This document alone does not close target issues.

```yaml
not_closed_now:
  - OI-PSG-DAILY-LOG-INPUT-BINDING-001
  - OI-RVE-RULE-EVALUATOR-BINDING-001
  - OI-PG-RULE-SAFETY-GATE-BINDING-001
  - OI-PG-PHYSIO-SOURCE-CONSUMPTION-001
  - OI-AIB-PHYSIO-SOURCE-001
  - OI-AP-PHYSIO-SOURCE-001

closure_requires:
  - source_spec_accepted
  - target_document_patched
  - target_open_issue_table_recounted
  - actual_runtime_evidence_when_runtime_claim_is_involved
```

Absolute downstream issue counts are not declared here.

---

## 15. Open Issues

These are this reconstructed document's own issues. They do not change issue counts in other SPEC files.

| ID | Priority | Canonical blocking | Status | Summary | Resolution needed |
|---|---|---:|---|---|---|
| `OI-DLC-APP-BRIDGE-BINDING-001` | P1 | YES | OPEN | App Bridge does not yet own DailyCheckInRecord storage endpoints or audit lineage. | Patch App Bridge after this spec is accepted, then recount target issues. |
| `OI-DLC-RVE-SAFETY-BINDING-001` | P1 | YES | OPEN | Daily check-in structured and transient signals are not yet runtime-bound to RVE/Safety Gate. | Add implementation/runtime evidence before any safety binding issue closure. |
| `OI-DLC-RAW-NOTE-REDACTION-001` | P1 | YES | OPEN | Purpose-separated note UI, local lifecycle, transient assessment binding, and server omission are not accepted as runtime evidence. | Prove PRIVATE_SELF_ONLY is never evaluated or synced; prove ANALYZABLE_TRAINING_NOTE raw text remains device-local and sanitized review metadata remains transient and unpersisted. |
| `OI-DLC-DAILY-BRIEF-INBOX-001` | P2 | NO | OPEN | Daily Brief and AI Inbox signal generation remain future productization contracts. | Draft `DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC.md`. |
| `OI-DLC-ANALYSIS-VISUALIZATION-001` | P2 | NO | OPEN | Analysis charts and body-area trend visualization contract is not defined. | Draft `ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md`. |
| `OI-DLC-IMPLEMENTATION-BINDING-001` | P2 | NO | OPEN | An app-local UI, storage schema, and transient assessment path exist, but they are not accepted as canonical binding or runtime evidence. | Bind only after SPEC acceptance, privacy review, and separate runtime-evidence acceptance. |
| `OI-DLC-RACE-LOCAL-PROJECTION-BINDING-001` | P2 | NO | OPEN | Owner-approved race self-check fields are an interim app-local projection, not yet bound to canonical `RaceDayCheckInRecord`. | Review provenance, privacy, analysis acceptance, runtime evidence, and Race Record binding before canonical or downstream use. |

---

## 16. Self-Check

| Check | Status |
|---|---|
| First line is exact filename H1 | PASS |
| Metadata includes required fields | PASS |
| Status is `RECONSTRUCTED_DRAFT_FOR_REVIEW` | PASS |
| Does not claim original restored | PASS |
| Does not claim runtime evidence | PASS |
| Does not close downstream issues | PASS |
| Raw free-text server, analysis, and audit storage is forbidden | PASS |
| PRIVATE_SELF_ONLY is local-only and never evaluated | PASS |
| Unlabeled legacy text is not silently treated as analyzable | PASS |
| ANALYZABLE_TRAINING_NOTE requires explicit purpose | PASS |
| Raw symptom clause storage is forbidden | PASS |
| Only ANALYZABLE_TRAINING_NOTE can raise risk; no note can clear risk | PASS |
| Current localStorage is not described as encrypted or secure storage | PASS |
| Athlete note analysis runtime is not claimed | PASS |
| Analyzable note may raise local transient review but cannot clear risk | PASS |
| Sanitized transient assessment is not persisted or used as plan evidence | PASS |
| Owner-approved purpose selector remains app-local with no server or plan authority | PASS |
| Race self-check fields remain an interim local projection, not a canonical subtype | PASS |
| Shadow-mode disclosure direction does not activate shadow runtime | PASS |
| `D9_ACTIVE` / `D9_UNKNOWN` cannot be cleared by check-in | PASS |
| `D9_CLEARED` is not medical clearance | PASS |
| Daily Log does not generate plan candidates | PASS |
| Future Daily Brief / Inbox contract remains separate | PASS |
| Final marker is required as final line | PASS |

[DRAFT_COMPLETE]
