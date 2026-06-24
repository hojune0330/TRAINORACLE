# SESSION_CLASSIFIER_SPEC.md

```yaml
doc_id: trainoracle-spec-002-session-classifier
spec_id: SESSION_CLASSIFIER_SPEC
title: SESSION_CLASSIFIER_SPEC
version: 1.2
schema_build: 2026-05-28
status: READY_FOR_UPLOAD
upload_allowed: true
canonical_promotion_allowed: false
public_sanitized: true
organization_specific_source_names_removed: true
private_source_manifest_required: true
owner: COACH_HOJUNE
owner_display_name: "HoJune Jang"
owner_meaning: "Document governance/provenance owner only; not a runtime authority."
platform_scope: GLOBAL_PUBLIC_MULTI_TENANT
patch_from: 1.1
patch_type: BLOCKING_DEPENDENCIES_FROM_RULE_SPEC_v1.4
test_cases_total: 54
test_cases_passed: 54
open_issues_count: 13
upstream_baseline:
  spec_id: RULE_SPEC_D1_D9
  version: 1.4
  sha256: 12b856794d6ecdd0f70e95a03bee1fd9f2e5bf3dff6db960f3d9ce6e0de99016
  role: READ_ONLY_APPROVED_BASELINE
```

## Section 0. Document Purpose

This specification defines the TrainOracle SESSION_CLASSIFIER layer.

The classifier ingests raw session data and produces classified, normalized session records that are consumed by downstream specifications. It does not own any D-rule verdict, threshold, or severity. Those are owned by RULE_SPEC_D1_D9.md v1.4.

This specification defines:

- Session intensity classification fields.
- Energy system classification fields.
- EPOC status and EPOC source fields, plus template match confidence.
- LD volume computation inputs.
- Multi-energy time allocation policy.
- Manual classification correction (not Coach Override).
- TypeScript contracts for classifier outputs in a multi-tenant context.
- Open issues.

This specification is upload_allowed: true and aligned with RULE_SPEC v1.4. canonical_promotion_allowed remains false until open issues blocking canonical promotion are resolved.

## Section 1. Source Priority

```yaml
source_priority:
  level_1_absolute_policy:
    description: "Absolute safety and governance policy."
    files_or_aliases:
      - ABSOLUTE_POLICY_R_RULES
      - A_guide_v5.1_20260201.md
    conflict_resolution: "level_1 wins unless escalated to spec owner for governance review"

  level_2_training_guideline:
    description: "Primary training and coaching guideline layer."
    files:
      - TrainingDoc_Guideline_v1.1_20260203.md
      - B_bg_philosophy.md
      - B_bg_reference.md
      - B_bg_data.md
    conflict_resolution: "level_2 wins over level_3 through level_5"

  level_3_system_design:
    description: "System architecture and planning model references."
    files:
      - TRAINING_PLAN_SYSTEM_WHITEPAPER_v1.1_final.md
      - workflow_definition.md
      - phase_definition.md
      - APP_IMPLEMENTATION_BRIDGE.md
    conflict_resolution: "implementation details must not override training-rule semantics"

  level_4_interface_and_data:
    description: "Data import/export, wearable interface, and rendering."
    files:
      - GARMIN_IMPORT_SPEC.md
      - GSHEET_INTERFACE_SPEC.md
      - FEEDBACK_RENDERER_SPEC.md
    conflict_resolution: "interface behavior is subordinate to validator policy"

  level_5_reports_and_prior_reviews:
    description: "Validation reports, review notes, handoff summaries."
    files:
      - final_validation_report.md
      - handoff_summary.md
      - model_review_notes.md
    conflict_resolution: "reference only"

  upstream_specs:
    - spec: RULE_SPEC_D1_D9.md
      version: 1.4
      role: READ_ONLY_APPROVED_BASELINE
      modification_allowed: false

public_sanitization:
  forbidden_public_content:
    - specific_municipality_name
    - specific_public_agency_name
    - specific_team_name
    - private_local_contract_identifier
    - personally_identifying_source_label
  private_source_manifest_required: true
```

## Section 2. Upstream Dependency Resolution

This section maps each blocking dependency declared by RULE_SPEC_D1_D9.md v1.4 to the section in this document that resolves it. The classifier does not modify or reinterpret D-rule semantics.

```yaml
dependencies_from_rule_spec_v1_4:
  blocking:
    - dependency_id: template_match_confidence
      consumed_by: RULE_SPEC_D1_D9.D-4
      defined_in: Section 4.4
      status: RESOLVED_IN_THIS_SPEC

    - dependency_id: epocStatus
      consumed_by: RULE_SPEC_D1_D9.D-4
      defined_in: Section 4.3
      status: RESOLVED_IN_THIS_SPEC

    - dependency_id: multi_energy_time_allocation_policy
      consumed_by:
        - RULE_SPEC_D1_D9
        - PLAN_GENERATOR_SPEC
        - FEEDBACK_RENDERER_SPEC
      defined_in: Section 5
      status: RESOLVED_IN_THIS_SPEC
      d_rule_consumption_note: "Exact D-rule consumption is owned by RULE_SPEC_D1_D9."

    - dependency_id: ld_definition
      consumed_by: RULE_SPEC_D1_D9.D-7
      defined_in: Section 6
      status: RESOLVED_IN_THIS_SPEC

ownership_boundary:
  this_spec_outputs:
    - field_values
    - normalized_classifications
    - per_session_allocations
    - annotations
  this_spec_does_not_emit:
    - d_rule_raw_status
    - d_rule_severity
    - d_rule_verdict
    - d_rule_threshold
    - pseudo_status_combining_status_and_confidence
```

## Section 3. Session Classification Pipeline

```yaml
pipeline:
  stage_1_ingestion:
    inputs:
      - wearable_session_data
      - manual_session_input
      - calendar_session_entry
    output: RawSession

  stage_2_intensity_classification:
    output: intensityClassifiedSession
    reference: Section 4.1

  stage_3_energy_system_allocation:
    output: energyAllocatedSession
    reference: Section 4.2, Section 5

  stage_4_epoc_classification:
    output: epocClassifiedSession
    reference: Section 4.3, Section 4.4

  stage_5_label_assignment:
    output: labeledSession
    reference: Section 4.5

  stage_6_ld_volume_computation:
    output: ClassifiedSession
    reference: Section 6

consumed_by:
  - RULE_SPEC_D1_D9
  - PLAN_GENERATOR_SPEC
  - FEEDBACK_RENDERER_SPEC
```

## Section 4. Classification Field Definitions

### Section 4.1 Intensity Classification

```yaml
intensity:
  enum:
    - LOW
    - MOD
    - HIGH
    - VERY_HIGH

  signal_priority:
    1: planned_intensity_label_from_source
    2: hr_zone_distribution
    3: pace_zone_distribution
    4: rpe

  fallback_when_signals_missing:
    action: emit_with_annotation
    annotation: DATA_QUALITY_LIMITED
    must_not_invent_threshold: true
```

### Section 4.2 Energy System Classification

```yaml
energy_system:
  enum:
    - BASE
    - Z1
    - LT
    - VO2_LONG
    - GLY_SHORT
    - ATP_PC

  definitions_owned_by:
    - A_guide_v5.1_20260201.md
    - TrainingDoc_Guideline_v1.1_20260203.md

  classifier_responsibility:
    - apply_energy_system_assignment_per_segment
    - emit_per_session_energy_allocation

  classifier_does_not_define:
    - weekly_energy_distribution_threshold
    - d_rule_severity_mapping

  signal_priority:
    1: planned_session_template
    2: interval_structure_detection
    3: hr_zone_dominant
    4: pace_zone_dominant
    5: rpe_and_duration_heuristic
```

### Section 4.3 EPOC Status

```yaml
epocStatus:
  description: "State value consumed by RULE_SPEC_D1_D9.D-4."
  enum:
    - NORMAL
    - ELEVATED
    - HIGH
    - TEMPLATE_MATCH
    - UNKNOWN
    - NOT_AVAILABLE

  authority:
    enum_owner: RULE_SPEC_D1_D9.D-4
    classifier_role: PROVIDE_VALUE_ONLY
    classifier_does_not_emit_raw_status: true
    classifier_does_not_emit_severity: true

  semantics:
    NORMAL: "EPOC observed or inferred at baseline level."
    ELEVATED: "EPOC observed or inferred above baseline but below high-risk threshold."
    HIGH: "EPOC observed or inferred at high-risk level."
    TEMPLATE_MATCH: "Direct measurement not available. Value inferred from template match. Confidence must be reported separately via template_match_confidence."
    UNKNOWN: "Data ambiguous or insufficient to assign a level."
    NOT_AVAILABLE: "Data structurally absent."

  invariants:
    must_not_emit_pseudo_status: true
    forbidden_emissions:
      - TEMPLATE_MATCH_HIGH
      - TEMPLATE_MATCH_MEDIUM
      - TEMPLATE_MATCH_LOW

  epoc_band_threshold_policy:
    fixed_thresholds_in_this_spec: null
    threshold_source: SOURCE_DEFINED_OR_GROUP_SETTING
    classifier_must_not_invent_band_thresholds: true
    if_threshold_source_missing:
      action: emit_UNKNOWN_or_NOT_AVAILABLE_with_annotation
      annotation: EPOC_SOURCE_UNKNOWN
    open_issue: OI-SC-EPOC-BAND-THRESHOLD-001
```

### Section 4.4 EPOC Source and Template Match Confidence

```yaml
epocSource:
  description: "Where the epocStatus value was derived from. Separate from epocStatus."
  enum:
    - MEASURED
    - SPECIFIED_BY_COACH
    - TEMPLATE_MATCH
    - ESTIMATE_BAND_ONLY
    - NOT_AVAILABLE
    - UNKNOWN

  invariants:
    epoc_source_is_not_epoc_status: true
    classifier_must_emit_both_fields_when_applicable: true

template_match_confidence:
  enum:
    - HIGH
    - MEDIUM
    - LOW
    - NOT_APPLICABLE

  required_when:
    epocStatus: TEMPLATE_MATCH

  must_be_NOT_APPLICABLE_when:
    epocStatus:
      - NORMAL
      - ELEVATED
      - HIGH
      - UNKNOWN
      - NOT_AVAILABLE

  classification_criteria:
    threshold_status: CANDIDATE_DEFAULT_NON_CANONICAL
    production_use_requires:
      - source_confirmation
      - group_setting
      - calibration_review
    candidate_thresholds:
      HIGH:
        interval_structure_match_score_gte: 0.85
        duration_match_within_pct: 10
        intensity_distribution_match: true
      MEDIUM:
        interval_structure_match_score_gte: 0.60
        duration_match_within_pct: 20
      LOW:
        interval_structure_match_score_gte: 0.40
        duration_match_within_pct: 30
    fallback:
      when_below_LOW_threshold:
        epocStatus_assignment: UNKNOWN
        epocSource_assignment: ESTIMATE_BAND_ONLY
        template_match_confidence_assignment: NOT_APPLICABLE
    calibration_open_issue: OI-SC-CONFIDENCE-CALIBRATION-001

interface_with_rule_spec_d4:
  consumed_fields:
    - epocStatus
    - epocSource
    - template_match_confidence
  invariant:
    pseudo_status_for_template_confidence: FORBIDDEN
    classifier_must_not_emit:
      - TEMPLATE_MATCH_HIGH
      - TEMPLATE_MATCH_MEDIUM
      - TEMPLATE_MATCH_LOW
  rule_spec_ownership:
    d4_raw_status_mapping_owned_by: RULE_SPEC_D1_D9.D-4
    d4_skip_or_annotation_decision_owned_by: RULE_SPEC_D1_D9.D-4
    classifier_only_outputs_fields: true
```

### Section 4.5 Session Label Assignment

```yaml
session_label:
  enum:
    - MAIN
    - SUB
    - RECOVERY
    - LD
    - REST
    - CROSS_TRAINING
    - COMPETITION
    - TEST

label_assignment_policy:
  primary_source:
    - planned_session_type
    - source_defined_template
    - group_setting

  heuristic_fallback:
    allowed: true
    canonical: false
    requires_annotation: true
    confidence_required: true
    may_not_change_d_rule_threshold: true

  hardcoded_threshold_policy:
    fixed_MAIN_duration_min: null
    fixed_MAIN_intensity_combination: null
    fixed_RECOVERY_duration_max_min: null
    threshold_source: SOURCE_DEFINED_OR_GROUP_SETTING_OR_OPEN_ISSUE
    open_issues:
      - OI-SC-MAIN-LABEL-HEURISTIC-001
      - OI-SC-RECOVERY-LABEL-HEURISTIC-001

  heuristic_example_non_canonical:
    note: "The following examples are illustrative and must not be enforced as production thresholds."
    MAIN_example:
      intensity_combination_example:
        - HIGH
        - VERY_HIGH
      duration_min_example_gte: 40
      energy_system_example_any_of:
        - LT
        - VO2_LONG
        - GLY_SHORT
    RECOVERY_example:
      intensity_example: LOW
      duration_min_example_lte: 45
    enforced: false

  REST_assignment:
    condition: no_session_recorded_on_date

  CROSS_TRAINING_assignment:
    condition: sport_type_not_in_running_or_track
    cross_training_ld_inclusion:
      default: false
      overridable_per_athlete: true
      declared_dependency:
        target_spec: ATHLETE_PROFILE_SPEC
        required_field: ld_inclusion_preferences

  COMPETITION_assignment:
    condition: planned_session_type_is_COMPETITION

  TEST_assignment:
    condition: planned_session_type_is_TEST
```

## Section 5. Multi-Energy Time Allocation Policy

Resolves RULE_SPEC v1.4 blocking dependency multi_energy_time_allocation_policy. The exact D-rule consumption is delegated to RULE_SPEC.

```yaml
multi_energy_time_allocation_policy:
  description: |
    When a single session contains multiple energy systems
    (for example warmup BASE + main LT intervals + cooldown BASE),
    this policy defines how the total session duration is allocated
    across energy systems.

  consumed_by:
    - RULE_SPEC_D1_D9
    - PLAN_GENERATOR_SPEC
    - FEEDBACK_RENDERER_SPEC

  rule_spec_usage:
    does_not_change_d_rule_thresholds: true
    may_support_weekly_distribution_or_density_inputs: true
    exact_d_rule_consumption: defined_by_RULE_SPEC_D1_D9

  primary_method: INTERVAL_STRUCTURE_BASED
  fallback_method: HR_ZONE_DURATION_BASED
  last_resort: DOMINANT_SYSTEM_ASSIGNMENT

  INTERVAL_STRUCTURE_BASED:
    when_applicable:
      any_of:
        - matched_template_id_is_not_null
        - interval_structure_detected_is_true
    allocation_rule:
      warmup_segment:
        energy_system: BASE
        duration: actual_warmup_duration_min
      work_intervals:
        energy_system: derived_from_interval_intensity
        duration: sum_of_work_interval_durations_only
      rest_intervals:
        energy_system: BASE
        duration: sum_of_rest_interval_durations
      cooldown_segment:
        energy_system: BASE
        duration: actual_cooldown_duration_min
    invariant:
      total_allocated_duration_min: equals_total_session_duration_min
      double_counting_forbidden: true
      work_intervals_must_not_include_rest_duration: true

  HR_ZONE_DURATION_BASED:
    when_applicable:
      all_of:
        - interval_structure_based_not_applicable
        - hr_data_present
    allocation_rule:
      Z1_time: Z1
      Z2_time: BASE
      Z3_time_low: BASE
      Z3_time_high: LT
      Z4_time: LT_OR_VO2_LONG_DEPENDING_ON_SESSION_INTENT
      Z5_time: GLY_SHORT_OR_ATP_PC_DEPENDING_ON_INTERVAL_LENGTH
    note: "Z1 HR zone time is preserved as Z1 energy system, not collapsed into BASE."
    invariant:
      total_allocated_duration_min: equals_total_session_duration_min
      double_counting_forbidden: true
      z1_hr_zone_must_not_be_collapsed_to_BASE: true

  DOMINANT_SYSTEM_ASSIGNMENT:
    when_applicable:
      all_of:
        - interval_structure_based_not_applicable
        - hr_zone_duration_based_not_applicable
    allocation_rule:
      assign_all_duration_to: planned_dominant_energy_system_or_group_default_low_energy_system
    group_default_low_energy_system:
      allowed_values:
        - BASE
        - Z1
      default_if_unset: BASE
      delegated_to_group_setting: true
    invariant:
      assigned_value_must_be_valid_energy_system: true
      assigned_value_must_not_be_intensity_enum: true
    annotation: ALLOCATION_QUALITY_LIMITED

allocation_quality:
  enum:
    - HIGH
    - MEDIUM
    - LOW
  mapping:
    INTERVAL_STRUCTURE_BASED: HIGH
    HR_ZONE_DURATION_BASED: MEDIUM
    DOMINANT_SYSTEM_ASSIGNMENT: LOW

output_contract:
  per_session_energy_allocation:
    type: "Record<EnergySystem, durationMinutes>"
    invariants:
      - "sum(allocation.values) == total_session_duration_min"
      - "no segment is double-counted"
      - "all keys are valid EnergySystem enum values"
```

## Section 6. LD Definition

Resolves RULE_SPEC v1.4 blocking dependency ld_definition. Consumed by RULE_SPEC_D1_D9.D-7. No weekly threshold is defined in this specification.

```yaml
ld_definition:
  full_name: "Low Duration / Low Intensity Recovery Volume"

  consumed_by: RULE_SPEC_D1_D9.D-7
  provides:
    - ld_volume_per_session
    - ld_eligible_segments
    - ld_exclusion_rules

  does_not_define:
    - weekly_ld_ratio_threshold
    - d_rule_verdict
    - d_rule_severity

  primary_basis:
    - segment_energy_system
    - segment_intensity
    - exclusion_rules

  session_label_usage:
    LD: confirmation_or_display_label_only
    RECOVERY_when_intensity_is_LOW: eligible_if_segment_rules_match
    note: "Session label LD is a display/confirmation signal. LD volume is computed from segments, not from labels."

  circular_dependency_forbidden: true
  ld_label_must_not_be_required_input_for_ld_volume: true

  composition_by_segment:
    included_energy_systems:
      - Z1
      - BASE_when_segment_intensity_is_LOW
    excluded_energy_systems:
      - LT
      - VO2_LONG
      - GLY_SHORT
      - ATP_PC

  exclusion_by_session_label:
    excluded_session_labels:
      - MAIN
      - COMPETITION
      - TEST
    note: "These labels exclude the entire session from LD volume regardless of segment composition."

  cross_training:
    default_included_as_ld: false
    overridable_per_athlete: true
    declared_dependency:
      target_spec: ATHLETE_PROFILE_SPEC
      required_field: ld_inclusion_preferences

  duration_inclusion_rule:
    description: "Only segments that qualify by energy system and intensity contribute to ld_volume."
    derived_from: Section 5 multi_energy_time_allocation_policy
    formula: |
      ld_volume_per_session =
        allocation[Z1] +
        (allocation[BASE] if segment_intensity == LOW else 0)
    note: "This formula uses segment energy and intensity. It does not require sessionLabel == LD."

weekly_ld_volume_computation:
  numerator: "sum(ld_volume_per_session) for sessions in training_week_window"
  denominator: "sum(total_session_duration_min) for sessions in training_week_window"
  consumed_by: RULE_SPEC_D1_D9.D-7
  threshold_owner: RULE_SPEC_D1_D9.D-7
  threshold_source: SOURCE_DEFINED_OR_GROUP_SETTING
  fixed_threshold_in_this_spec: null

athlete_specific_overrides:
  allowed: true
  fields:
    - cross_training_counts_as_ld
    - base_low_intensity_segment_inclusion_override
  declared_dependency:
    target_spec: ATHLETE_PROFILE_SPEC
    required_field: ld_inclusion_preferences
```

## Section 7. Template Matching

```yaml
template_matching:
  template_library:
    storage: SESSION_TEMPLATE_LIBRARY
    versioning_required: true
    canonical_promotion_required: true
    open_issue: OI-SC-TEMPLATE-LIBRARY-001

  match_score_computation:
    factor_weights:
      interval_structure_match: 0.40
      duration_match: 0.25
      intensity_distribution_match: 0.25
      rest_interval_match: 0.10
    output_range:
      min: 0.0
      max: 1.0

  score_to_confidence_mapping:
    threshold_status: CANDIDATE_DEFAULT_NON_CANONICAL
    candidate_thresholds:
      gte_0_85: HIGH
      gte_0_60: MEDIUM
      gte_0_40: LOW
    lt_0_40:
      classifier_action:
        epocStatus: UNKNOWN
        epocSource: ESTIMATE_BAND_ONLY
        template_match_confidence: NOT_APPLICABLE
    calibration_open_issue: OI-SC-CONFIDENCE-CALIBRATION-001
```

## Section 8. Manual Classification Correction

```yaml
classifier_manual_correction:
  description: "Coach or athlete correction of a classification field. Distinct from D-rule Coach Override."
  is_not_d_rule_override: true
  does_not_change_rule_validation_result: true
  audit_required: true

  authorization:
    deny_by_default: true
    requires_scoped_capability: true
    requires_actor_group_membership: true
    capability_name_delegated_to: APP_IMPLEMENTATION_BRIDGE
    consent_policy_delegated_to: ATHLETE_PROFILE_SPEC
    required_fields_for_authorization:
      - actor_id
      - actor_capability_grant_id
      - tenant_id
      - group_id
      - athlete_id
      - session_id

  allowed_correction_types:
    - intensity_relabel
    - energy_system_reassignment
    - session_label_change
    - segment_boundary_adjustment

  not_allowed:
    - emit_d_rule_verdict
    - emit_d_rule_severity
    - clear_safety_hard_stop_state
    - modify_raw_validation_result

  audit_fields_required:
    - actor_id
    - actor_capability_grant_id
    - tenant_id
    - group_id
    - athlete_id
    - session_id
    - field_name
    - before_value
    - after_value
    - reason_text
    - timestamp
```

## Section 9. Data Quality Annotations

```yaml
annotations:
  enum:
    - DATA_QUALITY_LIMITED
    - ALLOCATION_QUALITY_LIMITED
    - EPOC_SOURCE_UNKNOWN
    - TEMPLATE_NO_MATCH
    - INTERVAL_STRUCTURE_INFERRED
    - COACH_INPUT_CLASSIFICATION
    - MANUAL_CLASSIFICATION_CORRECTION

  immutability: true

  consumed_by:
    - RULE_SPEC_D1_D9 (audit only)
    - FEEDBACK_RENDERER_SPEC (display)
```

## Section Z. TypeScript Contract

```typescript
export type ISO8601 = string;
export type TenantId = string;
export type GroupId = string;
export type AthleteId = string;
export type SessionId = string;
export type SourceSnapshotId = string;
export type ClassifierRunId = string;
export type ActorId = string;
export type CapabilityGrantId = string;

export type Intensity = "LOW" | "MOD" | "HIGH" | "VERY_HIGH";

export type EnergySystem =
  | "BASE"
  | "Z1"
  | "LT"
  | "VO2_LONG"
  | "GLY_SHORT"
  | "ATP_PC";

export type EpocStatus =
  | "NORMAL"
  | "ELEVATED"
  | "HIGH"
  | "TEMPLATE_MATCH"
  | "UNKNOWN"
  | "NOT_AVAILABLE";

export type EpocSource =
  | "MEASURED"
  | "SPECIFIED_BY_COACH"
  | "TEMPLATE_MATCH"
  | "ESTIMATE_BAND_ONLY"
  | "NOT_AVAILABLE"
  | "UNKNOWN";

export type TemplateMatchConfidence =
  | "HIGH"
  | "MEDIUM"
  | "LOW"
  | "NOT_APPLICABLE";

export type SessionLabel =
  | "MAIN"
  | "SUB"
  | "RECOVERY"
  | "LD"
  | "REST"
  | "CROSS_TRAINING"
  | "COMPETITION"
  | "TEST";

export type AllocationMethod =
  | "INTERVAL_STRUCTURE_BASED"
  | "HR_ZONE_DURATION_BASED"
  | "DOMINANT_SYSTEM_ASSIGNMENT";

export type AllocationQuality = "HIGH" | "MEDIUM" | "LOW";

export type ClassifierAnnotation =
  | "DATA_QUALITY_LIMITED"
  | "ALLOCATION_QUALITY_LIMITED"
  | "EPOC_SOURCE_UNKNOWN"
  | "TEMPLATE_NO_MATCH"
  | "INTERVAL_STRUCTURE_INFERRED"
  | "COACH_INPUT_CLASSIFICATION"
  | "MANUAL_CLASSIFICATION_CORRECTION";

export interface WorkInterval {
  durationMin: number;
  targetIntensity: Intensity;
  targetEnergySystem?: EnergySystem;
}

export interface IntervalStructure {
  warmupDurationMin: number;
  workIntervals: readonly WorkInterval[];
  restIntervalsMin: readonly number[];
  cooldownDurationMin: number;
}

export interface RawSession {
  tenantId: TenantId;
  groupId: GroupId;
  athleteId: AthleteId;
  sessionId: SessionId;
  sourceSnapshotId: SourceSnapshotId;
  date: ISO8601;
  plannedDurationMin?: number;
  actualDurationMin: number;
  plannedIntensityLabel?: Intensity;
  plannedSessionType?: SessionLabel;
  hrZoneDistribution?: Record<string, number>;
  paceZoneDistribution?: Record<string, number>;
  rpe?: number;
  intervalStructure?: IntervalStructure;
  observedEpocValue?: number;
  epocSource?: EpocSource;
  wearableDeviceId?: string;
  sportType: string;
}

export interface EnergyAllocation {
  BASE: number;
  Z1: number;
  LT: number;
  VO2_LONG: number;
  GLY_SHORT: number;
  ATP_PC: number;
}

export interface EpocClassification {
  epocStatus: EpocStatus;
  epocSource: EpocSource;
  templateMatchConfidence: TemplateMatchConfidence;
  matchedTemplateId?: string;
  matchScore?: number;
}

export interface ClassifiedSession {
  tenantId: TenantId;
  groupId: GroupId;
  athleteId: AthleteId;
  sessionId: SessionId;
  sourceSnapshotId: SourceSnapshotId;
  classifierRunId: ClassifierRunId;
  date: ISO8601;
  sessionLabel: SessionLabel;
  sessionLabelSource:
    | "PLANNED_SESSION_TYPE"
    | "SOURCE_DEFINED_TEMPLATE"
    | "GROUP_SETTING"
    | "HEURISTIC_FALLBACK"
    | "MANUAL_CLASSIFICATION_CORRECTION";
  dominantIntensity: Intensity;
  totalDurationMin: number;
  energyAllocation: EnergyAllocation;
  allocationMethod: AllocationMethod;
  allocationQuality: AllocationQuality;
  epoc: EpocClassification;
  ldVolumeMin: number;
  annotations: readonly ClassifierAnnotation[];
  classifierSpecVersion: string;
  classifiedAt: ISO8601;
}

export interface LdComputationResult {
  tenantId: TenantId;
  groupId: GroupId;
  athleteId: AthleteId;
  sourceSnapshotId: SourceSnapshotId;
  weekWindowStart: ISO8601;
  weekWindowEnd: ISO8601;
  ldVolumeMin: number;
  totalVolumeMin: number;
  consumedBy: "RULE_SPEC_D1_D9.D-7";
  thresholdOwnedBy: "RULE_SPEC_D1_D9.D-7";
}

export interface ManualClassificationCorrection {
  correctionId: string;
  tenantId: TenantId;
  groupId: GroupId;
  athleteId: AthleteId;
  sessionId: SessionId;
  actorId: ActorId;
  actorCapabilityGrantId: CapabilityGrantId;
  fieldName: string;
  beforeValue: string;
  afterValue: string;
  reasonText: string;
  createdAt: ISO8601;
  isDRuleOverride: false;
  affectsRawValidationResult: false;
  immutable: true;
}
```

## Section AA. Open Issues

```yaml
open_issues:
  - id: OI-SC-CONFIDENCE-CALIBRATION-001
    priority: P1
    title: "template_match_confidence score thresholds require calibration"
    blocks_rule_execution: false
    blocks_canonical_promotion: true
    owner: SESSION_CLASSIFIER_SPEC

  - id: OI-SC-TEMPLATE-LIBRARY-001
    priority: P1
    title: "Initial session template library seed required"
    blocks_rule_execution: false
    blocks_canonical_promotion: true
    owner: SESSION_CLASSIFIER_SPEC

  - id: OI-SC-MAIN-LABEL-HEURISTIC-001
    priority: P1
    title: "MAIN label heuristic threshold source not canonical"
    blocks_rule_execution: false
    blocks_canonical_promotion: true
    owner: SESSION_CLASSIFIER_SPEC

  - id: OI-SC-RECOVERY-LABEL-HEURISTIC-001
    priority: P1
    title: "RECOVERY label duration threshold source not canonical"
    blocks_rule_execution: false
    blocks_canonical_promotion: true
    owner: SESSION_CLASSIFIER_SPEC

  - id: OI-SC-EPOC-BAND-THRESHOLD-001
    priority: P1
    title: "Threshold source for NORMAL/ELEVATED/HIGH band classification"
    blocks_rule_execution: false
    blocks_canonical_promotion: true
    owner: SESSION_CLASSIFIER_SPEC

  - id: OI-SC-HR-PACE-PRIORITY-001
    priority: P1
    title: "Priority resolution when HR and pace signals conflict"
    blocks_rule_execution: false
    blocks_canonical_promotion: true
    owner: SESSION_CLASSIFIER_SPEC

  - id: OI-SC-ALLOCATION-INVARIANT-FAILURE-001
    priority: P1
    title: "Behavior when allocation sum invariant is violated"
    blocks_rule_execution: false
    blocks_canonical_promotion: true
    owner: SESSION_CLASSIFIER_SPEC

  - id: OI-SC-CROSS-TRAINING-LD-001
    priority: P2
    title: "Cross-training LD inclusion preference per athlete"
    blocks_rule_execution: false
    blocks_canonical_promotion: false
    owner: ATHLETE_PROFILE_SPEC

  - id: OI-SC-INTERVAL-INFERENCE-001
    priority: P2
    title: "Algorithm for automatic interval structure inference"
    blocks_rule_execution: false
    blocks_canonical_promotion: false
    owner: SESSION_CLASSIFIER_SPEC

  - id: OI-SC-EPOC-ESTIMATE-BAND-MODEL-001
    priority: P2
    title: "Model behind ESTIMATE_BAND_ONLY epocSource derivation"
    blocks_rule_execution: false
    blocks_canonical_promotion: false
    owner: SESSION_CLASSIFIER_SPEC

  - id: OI-SC-MANUAL-CORRECTION-AUDIT-001
    priority: P2
    title: "Manual classification correction audit storage schema and capability name"
    blocks_rule_execution: false
    blocks_canonical_promotion: false
    owner: APP_IMPLEMENTATION_BRIDGE

  - id: OI-SC-SPORT-TYPE-EXPANSION-001
    priority: P2
    title: "Classification support for sport types beyond running and track"
    blocks_rule_execution: false
    blocks_canonical_promotion: false
    owner: SESSION_CLASSIFIER_SPEC

  - id: OI-SC-EPOC-SOURCE-UNKNOWN-HANDLING-001
    priority: P2
    title: "Handling rules when epocSource is UNKNOWN but observedEpocValue is present"
    blocks_rule_execution: false
    blocks_canonical_promotion: false
    owner: SESSION_CLASSIFIER_SPEC
```

## Section BB. Test Cases

```yaml
test_summary:
  total_count: 54
  passed: 54
  failed: 0
```

| ID | Area | Scenario | Expected | Result |
|---|---|---|---|---|
| TC-IC-001 | intensity | Z1 dominant + RPE 2 | LOW | PASS |
| TC-IC-002 | intensity | Z3 dominant + RPE 5 | MOD | PASS |
| TC-IC-003 | intensity | Z4 dominant + RPE 7 | HIGH | PASS |
| TC-IC-004 | intensity | Z5 dominant + RPE 9 | VERY_HIGH | PASS |
| TC-ES-005 | energy_system | 60min Z1 session | BASE/Z1 emitted | PASS |
| TC-ES-006 | energy_system | 4x1km @ LT | LT segments classified | PASS |
| TC-ES-007 | energy_system | 5x3min @ Z5 | VO2_LONG segments classified | PASS |
| TC-ES-008 | energy_system | 10x1min @ Z5 with 2min rest | GLY_SHORT segments classified | PASS |
| TC-ES-009 | energy_system | 6x10sec sprint | ATP_PC segments classified | PASS |
| TC-ES-010 | energy_system | template_match wins over heuristic | classifier emits fields only | PASS |
| TC-EPOC-011 | epocStatus | wearable reports baseline level | epocStatus=NORMAL, epocSource=MEASURED | PASS |
| TC-EPOC-012 | epocStatus | wearable reports moderate level | epocStatus=ELEVATED, epocSource=MEASURED | PASS |
| TC-EPOC-013 | epocStatus | wearable reports high level | epocStatus=HIGH, epocSource=MEASURED | PASS |
| TC-EPOC-014 | epocStatus | coach specifies value | epocStatus assigned, epocSource=SPECIFIED_BY_COACH | PASS |
| TC-EPOC-015 | epocStatus | template match available | epocStatus=TEMPLATE_MATCH, epocSource=TEMPLATE_MATCH | PASS |
| TC-EPOC-016 | epocStatus | ambiguous signal | epocStatus=UNKNOWN | PASS |
| TC-EPOC-017 | epocStatus | data structurally absent | epocStatus=NOT_AVAILABLE | PASS |
| TC-EPOC-018 | epoc_separation | epocSource=MEASURED with epocStatus=HIGH | both fields emitted independently | PASS |
| TC-EPOC-019 | epoc_separation | ESTIMATE_BAND_ONLY is epocSource not epocStatus | classifier never assigns epocStatus=ESTIMATE_BAND_ONLY | PASS |
| TC-EPOC-020 | epoc_band_threshold | band threshold source missing | epocStatus=UNKNOWN, annotation=EPOC_SOURCE_UNKNOWN | PASS |
| TC-EPOC-021 | epoc_band_threshold | classifier does not invent NORMAL/ELEVATED/HIGH thresholds | no hardcoded band thresholds in spec | PASS |
| TC-TMC-022 | template_confidence | score 0.92 with TEMPLATE_MATCH | template_match_confidence=HIGH | PASS |
| TC-TMC-023 | template_confidence | score 0.70 with TEMPLATE_MATCH | template_match_confidence=MEDIUM | PASS |
| TC-TMC-024 | template_confidence | score 0.45 with TEMPLATE_MATCH | template_match_confidence=LOW | PASS |
| TC-TMC-025 | template_confidence | score 0.30 | epocStatus=UNKNOWN, epocSource=ESTIMATE_BAND_ONLY, tmc=NOT_APPLICABLE | PASS |
| TC-TMC-026 | template_confidence | epocStatus=NORMAL | tmc=NOT_APPLICABLE | PASS |
| TC-TMC-027 | template_confidence | epocStatus=HIGH | tmc=NOT_APPLICABLE | PASS |
| TC-TMC-028 | template_confidence | thresholds marked non-canonical | threshold_status=CANDIDATE_DEFAULT_NON_CANONICAL | PASS |
| TC-PSEUDO-029 | pseudo_status_invariant | classifier output for TEMPLATE_MATCH + MEDIUM | no pseudo-status emitted | PASS |
| TC-PSEUDO-030 | pseudo_status_invariant | classifier output for TEMPLATE_MATCH + LOW | no pseudo-status emitted | PASS |
| TC-PSEUDO-031 | pseudo_status_invariant | D-4 verdict decision not made by classifier | RULE_SPEC owns verdict | PASS |
| TC-MEA-032 | multi_energy | WU BASE + 4x1km LT + CD BASE | INTERVAL_STRUCTURE_BASED, allocation sum equals total | PASS |
| TC-MEA-033 | multi_energy | rest intervals not double counted | work duration excludes rest duration | PASS |
| TC-MEA-034 | multi_energy | HR-only fartlek | HR_ZONE_DURATION_BASED, allocation quality MEDIUM | PASS |
| TC-MEA-035 | multi_energy | HR fallback Z1 time | Z1_time allocated to Z1 energy system, not BASE | PASS |
| TC-MEA-036 | multi_energy | unstructured session | DOMINANT_SYSTEM_ASSIGNMENT, LOW quality, annotated | PASS |
| TC-MEA-037 | multi_energy | dominant fallback invalid value rejected | LOW intensity enum not used as energy system | PASS |
| TC-MEA-038 | multi_energy | dominant fallback default | BASE used when group default unset | PASS |
| TC-MEA-039 | multi_energy | allocation sum invariant | sum equals total session duration | PASS |
| TC-LD-040 | ld_definition | Z1 60min session | ldVolumeMin=60 | PASS |
| TC-LD-041 | ld_definition | BASE LOW segment | included in ld_volume | PASS |
| TC-LD-042 | ld_definition | BASE MOD segment | excluded from ld_volume | PASS |
| TC-LD-043 | ld_definition | MAIN session | excluded regardless of energy system | PASS |
| TC-LD-044 | ld_definition | consumed_by points to D-7 | matches RULE_SPEC v1.4 | PASS |
| TC-LD-045 | ld_definition | no fixed 10% threshold in classifier | threshold_owner is RULE_SPEC D-7 | PASS |
| TC-LD-046 | ld_definition | LD label not required for LD volume | volume computed from segments without sessionLabel=LD | PASS |
| TC-LD-047 | ld_definition | circular dependency forbidden | session_label LD does not gate ld_volume | PASS |
| TC-LABEL-048 | session_label | planned MAIN exists | sessionLabel=MAIN via PLANNED_SESSION_TYPE | PASS |
| TC-LABEL-049 | session_label | no fixed MAIN duration/intensity threshold | hardcoded thresholds null | PASS |
| TC-LABEL-050 | session_label | no fixed RECOVERY duration threshold | hardcoded thresholds null | PASS |
| TC-LABEL-051 | session_label | no session on date | sessionLabel=REST | PASS |
| TC-DQ-052 | data_quality | HR and pace both missing | DATA_QUALITY_LIMITED annotation | PASS |
| TC-MC-053 | manual_correction | scoped capability grant required | actor_capability_grant_id required, deny by default | PASS |
| TC-MC-054 | manual_correction | manual correction is not a D-rule override | isDRuleOverride=false, raw validation unchanged | PASS |

## Section CC. Self-Validation

```yaml
self_validation:
  status: PASS
  version: 1.2
  upload_allowed: true
  canonical_promotion_allowed: false

  checks:
    public_sanitization_applied: PASS
    organization_specific_names_removed: PASS
    rule_spec_v1_4_unchanged: PASS
    epocStatus_enum_matches_rule_spec_v1_4: PASS
    epocSource_separated_from_epocStatus: PASS
    template_match_confidence_includes_NOT_APPLICABLE: PASS
    pseudo_status_template_match_high_medium_low_forbidden: PASS
    d4_verdict_owned_by_rule_spec: PASS
    ld_definition_consumed_by_d7: PASS
    ld_threshold_not_defined_in_classifier: PASS
    ld_label_does_not_gate_ld_volume: PASS
    main_label_hardcoded_threshold_null: PASS
    recovery_label_hardcoded_threshold_null: PASS
    multi_energy_rest_interval_not_double_counted: PASS
    multi_energy_consumed_by_list_correct: PASS
    multi_energy_dominant_fallback_uses_valid_energy_system: PASS
    multi_energy_hr_fallback_z1_preserved: PASS
    epoc_band_threshold_source_policy_present: PASS
    template_confidence_thresholds_marked_non_canonical: PASS
    tenant_group_source_snapshot_in_typescript: PASS
    typescript_exports_present: PASS
    manual_correction_distinguished_from_coach_override: PASS
    manual_correction_requires_scoped_capability: PASS
    open_issues_count_13: PASS
    test_cases_count_54: PASS
    contamination_artifact_count_zero: PASS
    code_fences_normalized: PASS
    test_cases_rendered_as_markdown_table: PASS
    metadata_status_ready_for_upload: PASS
    handoff_summary_status_synchronized: PASS

  blocking_dependencies_resolved:
    template_match_confidence: PASS
    epocStatus: PASS
    multi_energy_time_allocation_policy: PASS
    ld_definition: PASS
```

## Section DD. Version History

```yaml
version_history:
  - version: 1.0
    summary: "Initial draft of classification fields."
  - version: 1.1
    summary: "Intensity, energy system, and session label baselines."
  - version: 1.2
    summary: |
      Resolves four blocking dependencies declared by RULE_SPEC_D1_D9.md v1.4:
      template_match_confidence, epocStatus, multi_energy_time_allocation_policy, ld_definition.
      Adds public sanitization, separates epocStatus from epocSource,
      removes pseudo-status emission, moves LD consumption to D-7,
      removes hardcoded MAIN/RECOVERY/LD thresholds, prevents rest-interval double counting,
      adds tenant/group/sourceSnapshot fields to TypeScript contracts,
      separates manual classification correction from Coach Override,
      preserves Z1 HR zone in HR fallback allocation,
      replaces invalid LOW intensity reference in DOMINANT_SYSTEM_ASSIGNMENT fallback,
      forbids circular dependency between session label LD and LD volume,
      requires scoped capability grant for manual classification correction,
      adds explicit non-canonical marker to EPOC band and template confidence thresholds.
      Final packaging patch: duplicate artifacts removed, YAML and TypeScript code fences normalized,
      test cases rendered as Markdown table, status and upload metadata synchronized
      to READY_FOR_UPLOAD across header, self-validation, and handoff summary.
```

## Section EE. Handoff Summary

```yaml
handoff_summary:
  target_spec: SESSION_CLASSIFIER_SPEC.md
  version: 1.2
  status: READY_FOR_UPLOAD
  upload_allowed: true
  canonical_promotion_allowed: false

  upstream_baseline:
    spec_id: RULE_SPEC_D1_D9
    version: 1.4
    sha256: 12b856794d6ecdd0f70e95a03bee1fd9f2e5bf3dff6db960f3d9ce6e0de99016
    role: READ_ONLY_APPROVED_BASELINE

  dependency_satisfaction_table:
    - dependency: template_match_confidence
      consumed_by: RULE_SPEC_D1_D9.D-4
      resolved_in: Section 4.4
      status: RESOLVED
      notes: "Enum includes NOT_APPLICABLE. Pseudo-status emission forbidden. Thresholds marked non-canonical."

    - dependency: epocStatus
      consumed_by: RULE_SPEC_D1_D9.D-4
      resolved_in: Section 4.3
      status: RESOLVED
      notes: "Enum aligned to NORMAL/ELEVATED/HIGH/TEMPLATE_MATCH/UNKNOWN/NOT_AVAILABLE. Separated from epocSource. Band threshold source policy added."

    - dependency: multi_energy_time_allocation_policy
      consumed_by:
        - RULE_SPEC_D1_D9
        - PLAN_GENERATOR_SPEC
        - FEEDBACK_RENDERER_SPEC
      resolved_in: Section 5
      status: RESOLVED
      notes: "Exact D-rule consumption delegated to RULE_SPEC. Rest interval double counting prevented. Z1 HR zone preserved as Z1 energy system. Dominant fallback uses valid EnergySystem only."

    - dependency: ld_definition
      consumed_by: RULE_SPEC_D1_D9.D-7
      resolved_in: Section 6
      status: RESOLVED
      notes: "Threshold owned by D-7. No 10% threshold defined here. Session label LD does not gate LD volume."

  decisions_finalized:
    - "epocStatus and epocSource are distinct fields."
    - "template_match_confidence includes NOT_APPLICABLE."
    - "Classifier emits fields only; D-4 verdict mapping owned by RULE_SPEC."
    - "LD volume consumed by D-7 with no circular dependency on session label LD."
    - "No hardcoded MAIN/RECOVERY duration thresholds in this spec."
    - "Multi-energy allocation prevents rest-interval double counting."
    - "Z1 HR zone is allocated to Z1 energy system in HR fallback."
    - "DOMINANT_SYSTEM_ASSIGNMENT fallback uses valid EnergySystem values only."
    - "Manual classification correction requires scoped capability grant and is not a Coach Override."
    - "EPOC band thresholds and template confidence thresholds are explicitly marked non-canonical."

  impacts_on_other_specs:
    ATHLETE_PROFILE_SPEC:
      declared:
        - ld_inclusion_preferences
        - cross_training_counts_as_ld
        - base_low_intensity_segment_inclusion_override
    APP_IMPLEMENTATION_BRIDGE:
      declared:
        - ClassifiedSession storage with tenant/group/source isolation
        - SESSION_TEMPLATE_LIBRARY versioning
        - ManualClassificationCorrection audit storage
        - capability name for manual correction authorization
    PLAN_GENERATOR_SPEC:
      declared:
        - ClassifiedSession consumption interface
    FEEDBACK_RENDERER_SPEC:
      declared:
        - allocation_quality and annotations display

  open_issues_count: 13
  test_cases_total: 54
  test_cases_passed: 54

  next_recommended_spec: ATHLETE_PROFILE_SPEC.md
```
