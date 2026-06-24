# ATHLETE_PROFILE_SPEC.md

```yaml
doc_id: trainoracle-spec-003-athlete-profile
spec_id: ATHLETE_PROFILE_SPEC
title: ATHLETE_PROFILE_SPEC
version: 1.0
schema_build: 2026-05-31
round: RT4
status: DRAFT_FOR_REVIEW
upload_allowed: false
canonical_promotion_allowed: false
public_sanitized: true
organization_specific_source_names_removed: true
private_athlete_data_included: false
private_source_manifest_required: true
owner: COACH_HOJUNE
owner_display_name: "HoJune Jang"
owner_meaning: "Document governance/provenance owner only; not a runtime authority."
platform_scope: GLOBAL_PUBLIC_MULTI_TENANT
naming_convention:
  public_spec_yaml: snake_case
  typescript_runtime: camelCase
  serialization_mapping_delegated_to: APP_IMPLEMENTATION_BRIDGE
test_cases_total: 38
test_cases_passed: 38
open_issues_count: 11
open_issues_canonical_blocking_count: 6
upstream_baselines:
  - spec_id: RULE_SPEC_D1_D9
    version: 1.4
    sha256: 12b856794d6ecdd0f70e95a03bee1fd9f2e5bf3dff6db960f3d9ce6e0de99016
    role: READ_ONLY_APPROVED_BASELINE
  - spec_id: SESSION_CLASSIFIER_SPEC
    version: 1.2
    role: READ_ONLY_APPROVED_BASELINE
```

## Section 0. Document Purpose

This specification defines the TrainOracle ATHLETE_PROFILE layer.

The athlete profile layer owns athlete-scoped configuration, LD inclusion preferences, cross-training LD policy, manual classification correction consent policy, profile consent lifecycle records, and athlete availability constraints. It produces immutable, tenant-isolated and group-isolated profile snapshots consumed by downstream specifications.

This specification does not own and must not emit D-rule verdicts, severity, or thresholds; safety hard-stop activation or clearance; weekly window anchors or training-week thresholds; or energy-system distribution thresholds.

This specification resolves the following declared dependencies from upstream baselines: ld_inclusion_preferences, cross_training_counts_as_ld, base_low_intensity_segment_inclusion_override, and the manual classification correction consent and capability policy, all declared by SESSION_CLASSIFIER_SPEC v1.2.

This document is DRAFT_FOR_REVIEW. The value upload_allowed is false and canonical_promotion_allowed is false.

## Section 0A. Dependency Satisfaction Table

| Dependency | Declared By | Resolved In | Status | Notes |
|---|---|---|---|---|
| ld_inclusion_preferences | SESSION_CLASSIFIER_SPEC v1.2 | Section 6 | RESOLVED | Athlete-scoped preference fields defined. |
| cross_training_counts_as_ld | SESSION_CLASSIFIER_SPEC v1.2 | Section 6 | RESOLVED | camelCase field plus enabled-flag consistency rule. |
| base_low_intensity_segment_inclusion_override | SESSION_CLASSIFIER_SPEC v1.2 | Section 6 | RESOLVED | Session-level exclusion boundary invariants included. |
| manual_correction_consent_policy | SESSION_CLASSIFIER_SPEC v1.2 | Section 7 | RESOLVED | Capability-based consent, distinct from Coach Override. |
| manual_correction_authorization_invariants | SESSION_CLASSIFIER_SPEC v1.2 | Section 7 | RESOLVED | Non-override, no raw or safety effect. |
| manual_correction_final_capability_name | SESSION_CLASSIFIER_SPEC v1.2 | Section 7 | PARTIAL_DELEGATED_TO_APP_BRIDGE | Tracked by OI-AP-CAPABILITY-NAME-001. |
| group setting anchors and thresholds | RULE_SPEC v1.4 | OUT OF SCOPE | DELEGATED | Owned by TeamPolicy and RULE_SPEC. |

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
      - APP_IMPLEMENTATION_BRIDGE.md
    conflict_resolution: "implementation details must not override training-rule semantics"

  upstream_specs:
    - spec: RULE_SPEC_D1_D9.md
      version: 1.4
      role: READ_ONLY_APPROVED_BASELINE
      modification_allowed: false
    - spec: SESSION_CLASSIFIER_SPEC.md
      version: 1.2
      role: READ_ONLY_APPROVED_BASELINE
      modification_allowed: false

public_sanitization:
  forbidden_public_content:
    - specific_municipality_name
    - specific_public_agency_name
    - specific_team_name
    - private_local_contract_identifier
    - personally_identifying_athlete_data
  private_source_manifest_required: true
```

## Section 2. Governance and Authority Model

```yaml
governance_scope:
  spec_owner: COACH_HOJUNE
  spec_owner_meaning: "Document governance/provenance owner only; not a runtime authority."
  no_fixed_global_coach_authority: true
  authority_model: relationship_and_capability_based
  deny_by_default: true

authority_invariants:
  - "No actor holds authority over an athlete by role label alone."
  - "Authority requires an explicit, scoped, non-expired capability grant."
  - "A relationship_role value is descriptive metadata only and grants no authority."
  - "Membership in a group does not by itself grant visibility or authority over athlete data."
```

## Section 3. Tenancy and Isolation Model

```yaml
tenancy_model:
  platform: GLOBAL_PUBLIC_MULTI_TENANT
  row_level_isolation_required: true
  fixed_role_authority_forbidden: true

  validation_context_group_rule:
    description: "Every profile read, write, or consumption must occur within an explicit single group context."
    validation_context_group_must_be_explicit: true
    cross_group_auto_propagation: FORBIDDEN

  primary_group:
    field: primaryGroupId
    meaning: "The athlete home group context."
    grants_visibility_within: false
    visibility_requires_scoped_capability: true
    visibility_requires_consent: true
    notes:
      - "Primary group is a home-context label only."
      - "Being the home group does not auto-grant visibility or authority."
      - "Any access requires an explicit scoped non-expired capability grant plus consent."

  secondary_groups:
    field: secondaryGroupIds
    meaning: "Additional group memberships an athlete may participate in."
    invariants:
      does_not_grant_visibility: true
      does_not_grant_authority: true
      validation_context_group_must_be_explicit: true
      each_group_requires_independent_capability_grant: true
    notes:
      - "A secondary group membership never auto-shares profile data with that group."
      - "Each group that needs profile access requires its own capability grant."

relationship_role_enum:
  descriptor_only: true
  authorization_effect: none
  allowed:
    - SELF
    - COACH
    - ASSISTANT
    - MEDICAL_SUPPORT
    - GUARDIAN
    - ADMIN
    - VIEWER
  note: "These values describe the relationship for display and audit only. They do not confer capabilities."
```

## Section 4. Profile Snapshot Model

```yaml
profile_snapshot:
  immutability: true
  append_only_history: true

  isolation:
    tenant_id_required: true
    group_id_at_snapshot_required: true
    athlete_id_required: true

  required_fields:
    - tenantId
    - athleteId
    - primaryGroupId
    - groupIdAtSnapshot
    - profileVersion
    - createdAt

  groupIdAtSnapshot_meaning: >
    The explicit group context under which this snapshot was created.
    It binds the snapshot to a single group and must not be inferred
    from secondary group memberships.

  mutation_policy:
    edit_in_place_forbidden: true
    new_snapshot_required_on_change: true
    supersession_requires_new_snapshot: true

  invalid_snapshot_policy:
    description: >
      A snapshot that fails internal consistency validation is rejected at
      creation time. Downstream consumers must not consume an invalid snapshot.
    profile_layer_does_not_emit_rule_status: true
    rule_status_surfacing_owned_by: RULE_SPEC_D1_D9
    note: >
      The profile layer rejects the snapshot. It does not itself emit a
      RULE_SPEC DATA_ERROR status. Any DATA_ERROR surfacing is owned solely
      by RULE_SPEC-owned logic at the validation layer.

  consumed_by:
    - SESSION_CLASSIFIER_SPEC
    - PLAN_GENERATOR_SPEC
    - FEEDBACK_RENDERER_SPEC
```

## Section 5. Athlete Attributes

```yaml
athlete_attributes:
  privacy:
    private_identifying_data_in_public_spec: false
    public_examples_must_be_synthetic: true

  attribute_groups:
    discipline:
      field: disciplineCategory
      allowed:
        - MD
        - MLD
        - LD
      meaning: "Distance category. Used by downstream planning, not for D-rule thresholds here."

    physiological:
      fields:
        - hrMaxBpm
        - restingHrBpm
        - thresholdHrBpm
      threshold_ownership: "Zone thresholds are owned by the training guideline layer, not this spec."
      source_conflict_handling:
        when_device_and_self_report_conflict: ESCALATE_OR_OPEN_ISSUE
        open_issue: OI-AP-PHYSIO-SOURCE-001

    availability_defaults:
      field: defaultAvailabilityPolicyId
      meaning: "Reference to athlete availability constraint set in Section 8."

  attribute_source_priority:
    1: source_defined_or_group_setting
    2: athlete_self_declared_with_consent
    3: derived_estimate_with_annotation
```

## Section 6. LD Inclusion Preferences

```yaml
ld_inclusion_preferences:
  consumed_by: SESSION_CLASSIFIER_SPEC
  does_not_define:
    - weekly_ld_ratio_threshold
    - d_rule_verdict
    - d_rule_severity

  fields:
    crossTrainingCountsAsLd:
      type: boolean
      default: false
      meaning: "Whether cross-training sessions contribute to LD volume for this athlete."

    baseLowIntensitySegmentInclusionOverride:
      type: enum
      allowed:
        - DEFAULT
        - FORCE_INCLUDE
        - FORCE_EXCLUDE
      default: DEFAULT
      meaning: >
        Overrides whether BASE segments at LOW intensity contribute to LD volume.
        DEFAULT defers to SESSION_CLASSIFIER segment rules.

  base_low_intensity_override_invariants:
    - "FORCE_INCLUDE applies only to BASE segments at LOW intensity."
    - "FORCE_INCLUDE must not override session-level exclusion for MAIN, COMPETITION, or TEST sessions."
    - "FORCE_INCLUDE must not reclassify LT, VO2_LONG, GLY_SHORT, or ATP_PC segments as LD."
    - "This preference must not change RULE_SPEC D-7 thresholds."
    - "This preference must not change SESSION_CLASSIFIER raw energy allocation; it only affects LD inclusion."
    - "If the preference conflicts with a session-level exclusion rule, the session-level exclusion wins."

  cross_training_ld_policy:
    field: crossTrainingLdPolicy
    fields:
      enabled:
        type: boolean
      includedSportTypes:
        type: "string[]"
    consistency_invariant:
      rule: "crossTrainingCountsAsLd == crossTrainingLdPolicy.enabled"
      on_mismatch:
        - "The profile snapshot is invalid and is rejected at creation time."
        - "Downstream consumers must not consume the invalid snapshot."
        - "The profile layer does not itself emit a RULE_SPEC DATA_ERROR status."
        - "Any DATA_ERROR surfacing is owned by RULE_SPEC-owned validation logic."

  segment_minimum_duration_note:
    status: OPEN_ISSUE
    open_issue: OI-AP-LD-MIN-SEGMENT-DURATION-001
    field_proposed: low_intensity_segment_minimum_duration_sec
    consumed_by_session_classifier_v1_2: false
    requires_future_classifier_version: true
    note: >
      A minimum qualifying duration for low-intensity LD segments is not
      consumable by SESSION_CLASSIFIER v1.2. It is deferred to a future
      classifier version and tracked as an open issue.
```

## Section 7. Manual Classification Correction Authorization and Consent

```yaml
manual_classification_correction_authorization:
  is_coach_override: false
  affects_raw_validation_result: false
  affects_safety_hard_stop: false

  authorization:
    deny_by_default: true
    requires_scoped_capability: true
    requires_actor_group_membership: true
    requires_consent_record_reference: true
    capability_name_candidate: CORRECT_SESSION_CLASSIFICATION
    capability_name_final_owner: APP_IMPLEMENTATION_BRIDGE
    capability_name_status: PARTIAL_DELEGATED_TO_APP_BRIDGE
    capability_name_open_issue: OI-AP-CAPABILITY-NAME-001
    required_fields_for_authorization:
      - actorId
      - actorCapabilityGrantId
      - consentId
      - tenantId
      - groupId
      - athleteId
      - sessionId

  invariants:
    - "A manual classification correction never emits a D-rule verdict."
    - "A manual classification correction never clears a safety hard-stop state."
    - "A manual classification correction never modifies a raw validation result."
    - "Authorization is denied unless an explicit scoped capability grant is present."
    - "Authorization must reference a valid, non-expired, non-revoked ProfileConsentRecord via consentId."

profile_consent_lifecycle:
  description: >
    Consent governs whether an actor may access or act on athlete profile data
    within an explicit group context. Consent is capability-based, not role-based.
  record: ProfileConsentRecord
  fields:
    - consentId
    - tenantId
    - scopeGroupId
    - targetAthleteId
    - actorId
    - consentBasis
    - grantedBy
    - grantedAt
    - expiresAt
    - revokedAt
  consent_basis_allowed:
    - SELF
    - GUARDIAN
    - GROUP_POLICY
    - CONTRACT
    - EXPLICIT_SHARE
  lifecycle_invariants:
    - "Consent records are append-only and immutable after creation."
    - "Revocation is recorded as revokedAt; the record is not deleted."
    - "An expired or revoked consent grants no access."
    - "Consent is scoped to a single group via scopeGroupId."
    - "Consent does not auto-propagate to secondary groups."
  open_issue: OI-AP-CONSENT-LIFECYCLE-001
```

## Section 8. Athlete Availability Constraints

```yaml
availability_constraints:
  purpose: "Planner-facing scheduling hints. Not safety state."

  constraint_record:
    isolation:
      tenantId: required
      groupId: required
      athleteId: required
    fields:
      - constraintId
      - tenantId
      - groupId
      - athleteId
      - constraintType
      - timeWindow
      - reasonText
      - createdAt

  constraint_types:
    NO_TRAINING_AT_THIS_TIME:
      planner_hint_only: true
      not_safety_hard_stop: true
      must_not_emit_D9: true
      must_not_block_rule_execution: true
      must_not_clear_or_trigger_d_rule_result: true
      display_must_not_use_safety_hard_stop_language: true
      meaning: >
        Indicates the athlete is unavailable for training during the window.
        This is a planner scheduling hint only. It does not activate any safety
        hard-stop, must not emit a D-9 result, and must not block rule execution.

    PREFERRED_TRAINING_WINDOW:
      planner_hint_only: true
      not_safety_hard_stop: true

    REDUCED_LOAD_WINDOW:
      planner_hint_only: true
      not_safety_hard_stop: true
      note: "Load reduction intent for planner. D-rule thresholds remain owned by RULE_SPEC."

  reason_text_privacy:
    must_be_minimal: true
    medical_detail_forbidden_in_public_profile_field: true
    sensitive_detail_delegated_to: private_medical_or_support_note_system
    renderer_must_not_expose_reason_text_cross_group: true
```

## Section 9. Data Quality Annotations

```yaml
annotations:
  enum:
    - PROFILE_DATA_LIMITED
    - LD_PREFERENCE_DEFAULTED
    - CONSTRAINT_SOURCE_UNKNOWN
    - DERIVED_ATTRIBUTE_ESTIMATE
    - MANUAL_CORRECTION_AUTHORIZATION_RECORDED
  immutability: true
  consumed_by:
    - spec: SESSION_CLASSIFIER_SPEC
      purpose: audit_only
    - spec: FEEDBACK_RENDERER_SPEC
      purpose: display
```

## Section Z. TypeScript Contract

```typescript
export type ISO8601 = string;
export type TenantId = string;
export type GroupId = string;
export type AthleteId = string;
export type SessionId = string;
export type ActorId = string;
export type CapabilityGrantId = string;
export type ConsentId = string;
export type ConstraintId = string;
export type ProfileSnapshotId = string;
export type ProfileAuditRecordId = string;

export type DisciplineCategory = "MD" | "MLD" | "LD";

export type RelationshipRole =
  | "SELF"
  | "COACH"
  | "ASSISTANT"
  | "MEDICAL_SUPPORT"
  | "GUARDIAN"
  | "ADMIN"
  | "VIEWER";

export type BaseLowIntensityInclusionOverride =
  | "DEFAULT"
  | "FORCE_INCLUDE"
  | "FORCE_EXCLUDE";

export type ConsentBasis =
  | "SELF"
  | "GUARDIAN"
  | "GROUP_POLICY"
  | "CONTRACT"
  | "EXPLICIT_SHARE";

export type ConstraintType =
  | "NO_TRAINING_AT_THIS_TIME"
  | "PREFERRED_TRAINING_WINDOW"
  | "REDUCED_LOAD_WINDOW";

export type ProfileAnnotation =
  | "PROFILE_DATA_LIMITED"
  | "LD_PREFERENCE_DEFAULTED"
  | "CONSTRAINT_SOURCE_UNKNOWN"
  | "DERIVED_ATTRIBUTE_ESTIMATE"
  | "MANUAL_CORRECTION_AUTHORIZATION_RECORDED";

export interface CrossTrainingLdPolicy {
  enabled: boolean;
  includedSportTypes: readonly string[];
}

export interface LdInclusionPreferences {
  crossTrainingCountsAsLd: boolean;
  baseLowIntensitySegmentInclusionOverride: BaseLowIntensityInclusionOverride;
  crossTrainingLdPolicy: CrossTrainingLdPolicy;
}

export interface PhysiologicalAttributes {
  hrMaxBpm?: number;
  restingHrBpm?: number;
  thresholdHrBpm?: number;
}

export interface TimeWindow {
  startLocal: ISO8601;
  endLocal: ISO8601;
  recurrenceRule?: string;
}

export interface ConstraintRecord {
  constraintId: ConstraintId;
  tenantId: TenantId;
  groupId: GroupId;
  athleteId: AthleteId;
  constraintType: ConstraintType;
  timeWindow: TimeWindow;
  reasonText: string;
  plannerHintOnly: true;
  notSafetyHardStop: true;
  mustNotEmitD9: true;
  mustNotBlockRuleExecution: true;
  mustNotClearOrTriggerDRuleResult: true;
  displayMustNotUseSafetyHardStopLanguage: true;
  createdAt: ISO8601;
}

export interface ProfileConsentRecord {
  consentId: ConsentId;
  tenantId: TenantId;
  scopeGroupId: GroupId;
  targetAthleteId: AthleteId;
  actorId: ActorId;
  consentBasis: ConsentBasis;
  grantedBy: ActorId;
  grantedAt: ISO8601;
  expiresAt: ISO8601 | null;
  revokedAt: ISO8601 | null;
  immutable: true;
}

export interface ManualClassificationCorrectionAuthorization {
  authorizationId: string;
  tenantId: TenantId;
  groupId: GroupId;
  athleteId: AthleteId;
  sessionId: SessionId;
  actorId: ActorId;
  actorCapabilityGrantId: CapabilityGrantId;
  consentId: ConsentId;
  consentBasis: ConsentBasis;
  isCoachOverride: false;
  affectsRawValidationResult: false;
  affectsSafetyHardStop: false;
  createdAt: ISO8601;
  immutable: true;
}

export interface AthleteProfileSnapshot {
  profileSnapshotId: ProfileSnapshotId;
  tenantId: TenantId;
  athleteId: AthleteId;
  primaryGroupId: GroupId;
  secondaryGroupIds: readonly GroupId[];
  groupIdAtSnapshot: GroupId;
  profileVersion: string;
  disciplineCategory: DisciplineCategory;
  physiological: PhysiologicalAttributes;
  ldInclusionPreferences: LdInclusionPreferences;
  defaultAvailabilityPolicyId?: string;
  annotations: readonly ProfileAnnotation[];
  profileSpecVersion: string;
  createdAt: ISO8601;
  immutable: true;
}

export interface ProfileAuditRecord {
  profileAuditRecordId: ProfileAuditRecordId;
  tenantId: TenantId;
  groupId: GroupId;
  athleteId: AthleteId;
  actorId: ActorId;
  action:
    | "PROFILE_SNAPSHOT_CREATED"
    | "LD_PREFERENCE_UPDATED"
    | "CONSTRAINT_CREATED"
    | "CONSTRAINT_REMOVED"
    | "CONSENT_GRANTED"
    | "CONSENT_REVOKED"
    | "MANUAL_CORRECTION_AUTHORIZED";
  targetId: string;
  createdAt: ISO8601;
  immutable: true;
}
```

## Section AA. Open Issues

```yaml
open_issues:
  - id: OI-AP-CAPABILITY-NAME-001
    priority: P1
    title: "Final capability name for manual classification correction"
    blocks_rule_execution: false
    blocks_canonical_promotion: true
    owner: APP_IMPLEMENTATION_BRIDGE

  - id: OI-AP-CONSENT-LIFECYCLE-001
    priority: P1
    title: "Profile consent grant, expiry, and revocation lifecycle finalization"
    blocks_rule_execution: false
    blocks_canonical_promotion: true
    owner: ATHLETE_PROFILE_SPEC

  - id: OI-AP-SECONDARY-GROUP-MODEL-001
    priority: P1
    title: "Secondary group capability grant issuance and audit model"
    blocks_rule_execution: false
    blocks_canonical_promotion: true
    owner: ATHLETE_PROFILE_SPEC

  - id: OI-AP-PROFILE-RETENTION-001
    priority: P1
    title: "Retention duration for profile snapshots, consent, and audit records"
    blocks_rule_execution: false
    blocks_canonical_promotion: true
    owner: APP_IMPLEMENTATION_BRIDGE

  - id: OI-AP-GUARDIAN-CONSENT-001
    priority: P1
    title: "Guardian consent rules for minor athletes"
    blocks_rule_execution: false
    blocks_canonical_promotion: true
    owner: ATHLETE_PROFILE_SPEC

  - id: OI-AP-PHYSIO-SOURCE-001
    priority: P1
    title: "Source of truth for physiological attributes when device and self-report conflict"
    blocks_rule_execution: false
    blocks_canonical_promotion: true
    owner: ATHLETE_PROFILE_SPEC
    note: "Promoted to P1. Physiological source conflict can propagate into downstream zone and plan derivation, so it is treated as a canonical blocking issue."

  - id: OI-AP-LD-MIN-SEGMENT-DURATION-001
    priority: P2
    title: "low_intensity_segment_minimum_duration_sec not consumable by SESSION_CLASSIFIER v1.2"
    consumed_by_session_classifier_v1_2: false
    requires_future_classifier_version: true
    blocks_rule_execution: false
    blocks_canonical_promotion: false
    owner: ATHLETE_PROFILE_SPEC

  - id: OI-AP-CROSS-TRAINING-SPORT-ENUM-001
    priority: P2
    title: "includedSportTypes value vocabulary alignment with SESSION_CLASSIFIER sport types"
    blocks_rule_execution: false
    blocks_canonical_promotion: false
    owner: ATHLETE_PROFILE_SPEC

  - id: OI-AP-CONSTRAINT-RECURRENCE-001
    priority: P2
    title: "recurrenceRule grammar for availability constraints"
    blocks_rule_execution: false
    blocks_canonical_promotion: false
    owner: ATHLETE_PROFILE_SPEC

  - id: OI-AP-SNAPSHOT-VERSIONING-001
    priority: P2
    title: "profileVersion increment semantics and supersession chain storage"
    blocks_rule_execution: false
    blocks_canonical_promotion: false
    owner: APP_IMPLEMENTATION_BRIDGE

  - id: OI-AP-DISPLAY-I18N-001
    priority: P2
    title: "Korean and English display label set for annotations and constraint types"
    blocks_rule_execution: false
    blocks_canonical_promotion: false
    owner: FEEDBACK_RENDERER_SPEC

open_issues_count: 11
open_issues_canonical_blocking_count: 6
canonical_blocking_ids:
  - OI-AP-CAPABILITY-NAME-001
  - OI-AP-CONSENT-LIFECYCLE-001
  - OI-AP-SECONDARY-GROUP-MODEL-001
  - OI-AP-PROFILE-RETENTION-001
  - OI-AP-GUARDIAN-CONSENT-001
  - OI-AP-PHYSIO-SOURCE-001
```

## Section BB. Test Cases

```yaml
test_summary:
  total_count: 38
  passed: 38
  failed: 0
  status: PASS
```

| ID | Area | Scenario | Expected | Result |
|---|---|---|---|---|
| TC-AP-001 | snapshot | Snapshot created with all required fields | snapshot valid, immutable | PASS |
| TC-AP-002 | snapshot | groupIdAtSnapshot present and explicit | binds snapshot to single group | PASS |
| TC-AP-003 | snapshot | groupIdAtSnapshot missing | snapshot rejected | PASS |
| TC-AP-004 | snapshot | Edit-in-place attempt on existing snapshot | rejected, new snapshot required | PASS |
| TC-AP-005 | snapshot | Profile change creates new snapshot | supersession via new snapshot | PASS |
| TC-AP-006 | isolation | tenantId missing on snapshot | rejected | PASS |
| TC-AP-007 | isolation | athleteId missing on snapshot | rejected | PASS |
| TC-AP-008 | secondary_group | secondaryGroupId does not grant visibility | no auto visibility | PASS |
| TC-AP-009 | secondary_group | secondaryGroupId does not grant authority | no auto authority | PASS |
| TC-AP-010 | secondary_group | Access via secondary group without grant | denied | PASS |
| TC-AP-011 | secondary_group | Each group needs independent capability grant | independent grant required | PASS |
| TC-AP-012 | secondary_group | Validation context group must be explicit | explicit group enforced | PASS |
| TC-AP-013 | primary_group | primary group alone grants no visibility | grants_visibility_within false | PASS |
| TC-AP-014 | primary_group | visibility requires scoped capability and consent | both required | PASS |
| TC-AP-015 | relationship_role | COACH role alone grants no capability | descriptor only, no authority | PASS |
| TC-AP-016 | relationship_role | ADMIN role alone grants no capability | descriptor only, no authority | PASS |
| TC-AP-017 | authority | Action without capability grant | denied by default | PASS |
| TC-AP-018 | authority | Action with valid scoped grant | allowed | PASS |
| TC-AP-019 | authority | No fixed global coach authority exists | no global authority | PASS |
| TC-AP-020 | ld_pref | crossTrainingCountsAsLd default | false | PASS |
| TC-AP-021 | ld_pref | baseLowIntensitySegmentInclusionOverride default | DEFAULT | PASS |
| TC-AP-022 | ld_pref | FORCE_INCLUDE applies only to BASE LOW segment | scoped to BASE LOW | PASS |
| TC-AP-023 | ld_pref | FORCE_INCLUDE does not override MAIN session exclusion | session exclusion wins | PASS |
| TC-AP-024 | ld_pref | FORCE_INCLUDE does not reclassify LT segment as LD | LT not reclassified | PASS |
| TC-AP-025 | ld_pref | preference does not change D-7 threshold | threshold owned by D-7 | PASS |
| TC-AP-026 | ld_pref | preference does not change classifier raw allocation | raw allocation unchanged | PASS |
| TC-AP-027 | ld_consistency | crossTrainingCountsAsLd true and policy enabled true | consistent, valid | PASS |
| TC-AP-028 | ld_consistency | crossTrainingCountsAsLd true and policy enabled false | inconsistent, snapshot rejected | PASS |
| TC-AP-029 | ld_consistency | profile layer does not emit RULE DATA_ERROR itself | rejection only, no rule status | PASS |
| TC-AP-030 | ld_segment | low_intensity_segment_minimum_duration_sec not consumable by classifier v1.2 | tracked as open issue | PASS |
| TC-AP-031 | manual_corr | Manual correction is not a coach override | isCoachOverride false | PASS |
| TC-AP-032 | manual_corr | Manual correction does not affect raw validation | affectsRawValidationResult false | PASS |
| TC-AP-033 | manual_corr | Manual correction does not affect safety hard-stop | affectsSafetyHardStop false | PASS |
| TC-AP-034 | manual_corr | Manual correction without scoped capability or consentId | denied by default | PASS |
| TC-AP-035 | consent | Expired or revoked consent grants no access | access denied | PASS |
| TC-AP-036 | constraint | ConstraintRecord includes tenantId, groupId, athleteId | isolation fields present | PASS |
| TC-AP-037 | constraint | NO_TRAINING_AT_THIS_TIME planner-hint invariants enforced | hint only, no D9, no block, no trigger, no safety language | PASS |
| TC-AP-038 | audit | ProfileAuditRecord includes groupId and is immutable | groupId present, immutable | PASS |

## Section CC. Self-Validation

```yaml
self_validation:
  status: PASS
  version: 1.0
  round: RT4
  spec_status: DRAFT_FOR_REVIEW
  upload_allowed: false
  canonical_promotion_allowed: false

  document_integrity:
    single_file_markdown: true
    forbidden_ui_prefix_token_count: 0
    standalone_forbidden_token_line_present: false
    outer_wrapper_fence_removed: true
    all_yaml_blocks_fenced: PASS
    all_typescript_blocks_fenced: PASS
    typescript_fence_closed_before_section_aa: PASS
    spec_starts_with_h1_title: PASS
    h1_title_value: "# ATHLETE_PROFILE_SPEC.md"
    conversational_text_in_body: false
    part_navigation_text_in_body: false
    automation_or_dispatcher_text_in_body: false
    eof_marker_text_in_body: false
    all_section_headings_are_markdown_h2: PASS
    dependency_table_is_markdown_table: PASS
    test_cases_rendered_as_markdown_table: PASS
    test_cases_row_count: 38
    test_cases_row_count_gte_36: PASS
    round_label_consistent: PASS
    round_label_value: RT4

  baseline_integrity:
    rule_spec_v1_4_not_modified: PASS
    session_classifier_v1_2_not_modified: PASS

  authority_model:
    no_fixed_global_coach_authority: PASS
    coach_hojune_owner_provenance_only: PASS
    capability_based_consent_not_role_based: PASS
    relationship_role_descriptor_only: PASS
    primary_group_grants_visibility_within_false: PASS
    primary_group_visibility_requires_capability_and_consent: PASS

  rule_boundary:
    no_d_rule_verdict_defined: PASS
    no_d_rule_severity_defined: PASS
    no_d_rule_threshold_defined: PASS
    d9_safety_hard_stop_not_overridden: PASS
    profile_layer_does_not_emit_rule_status: PASS
    no_cross_group_visibility: PASS
    no_cross_group_notification: PASS

  required_fields:
    snapshot_has_group_id_at_snapshot: PASS
    profile_audit_record_has_group_id: PASS
    constraint_record_has_tenant_group_athlete: PASS
    secondary_group_invariants_explicit: PASS
    manual_correction_is_not_coach_override: PASS
    manual_correction_references_consent_id: PASS
    constraint_record_must_not_clear_or_trigger_d_rule_result: PASS
    no_training_planner_hint_invariants_full: PASS
    base_low_override_session_exclusion_invariant: PASS
    cross_training_ld_consistency_invariant_present: PASS
    consent_lifecycle_record_present: PASS

  open_issues:
    open_issues_count: 11
    open_issues_canonical_blocking_count: 6
    physio_source_priority: P1
    physio_source_blocking: true

  privacy:
    private_athlete_data_present: false
    reason_text_privacy_boundary_present: true

  source_snapshot_id_handling: REMOVED_NOT_INTRODUCED

  dependency_resolution:
    ld_inclusion_preferences: RESOLVED
    cross_training_counts_as_ld: RESOLVED
    base_low_intensity_segment_inclusion_override: RESOLVED
    manual_correction_consent_policy: RESOLVED
    manual_correction_authorization_invariants: RESOLVED
    manual_correction_final_capability_name: PARTIAL_DELEGATED_TO_APP_BRIDGE
```

## Section DD. Version History

```yaml
version_history:
  - version: 0.1
    designer: Opus 4.7
    summary: "Initial multi-part draft. Document integrity failed review."

  - version: 1.0
    designer: Opus 4.8
    round_history:
      - round: RT1
        result: NG
        cause: "Document integrity P0 issues in transported artifact."
      - round: RT2
        result: NG
        cause: "Nested rendering and partial assembly concerns."
      - round: RT3
        result: NG
        cause: "Multi-part assembly did not provide complete raw source to reviewer."
      - round: RT4
        result: PACKAGED_FOR_LOCAL_VALIDATION
        summary: >
          Single Markdown document packaged through local HTML factory.
          Starts with H1 title; no conversational, part-navigation, automation,
          dispatcher, or EOF text in body. All section headings are Markdown H2.
          Metadata and policy blocks are fenced YAML. TypeScript contract is
          fenced and closed before Section AA. Test cases are a 38-row Markdown
          pipe table. Dependency satisfaction table is a Markdown table in
          Section 0A. Round unified to RT4. Self-validation reflects actual
          document state. Canonical blocking open issue count is 6.
    status: DRAFT_FOR_REVIEW
```

## Section EE. Handoff Summary

```yaml
handoff_summary:
  target_spec: ATHLETE_PROFILE_SPEC.md
  version: 1.0
  status: DRAFT_FOR_REVIEW
  upload_allowed: false
  canonical_promotion_allowed: false
  round: RT4
  delivery_mode: HTML_FACTORY_GENERATED_LOCAL_MARKDOWN

  upstream_baselines:
    - spec_id: RULE_SPEC_D1_D9
      version: 1.4
      sha256: 12b856794d6ecdd0f70e95a03bee1fd9f2e5bf3dff6db960f3d9ce6e0de99016
      role: READ_ONLY_APPROVED_BASELINE
    - spec_id: SESSION_CLASSIFIER_SPEC
      version: 1.2
      role: READ_ONLY_APPROVED_BASELINE

  dependency_satisfaction:
    - dependency: ld_inclusion_preferences
      consumed_by: SESSION_CLASSIFIER_SPEC
      resolved_in: Section 6
      status: RESOLVED
    - dependency: cross_training_counts_as_ld
      consumed_by: SESSION_CLASSIFIER_SPEC
      resolved_in: Section 6
      status: RESOLVED
    - dependency: base_low_intensity_segment_inclusion_override
      consumed_by: SESSION_CLASSIFIER_SPEC
      resolved_in: Section 6
      status: RESOLVED
    - dependency: manual_correction_consent_policy
      consumed_by: SESSION_CLASSIFIER_SPEC
      resolved_in: Section 7
      status: RESOLVED
    - dependency: manual_correction_authorization_invariants
      consumed_by: SESSION_CLASSIFIER_SPEC
      resolved_in: Section 7
      status: RESOLVED
    - dependency: manual_correction_final_capability_name
      consumed_by: SESSION_CLASSIFIER_SPEC
      resolved_in: Section 7
      status: PARTIAL_DELEGATED_TO_APP_BRIDGE
      tracking_open_issue: OI-AP-CAPABILITY-NAME-001

  packaging_resolution:
    complete_document_single_file: true
    starts_with_h1: true
    ui_prefix_token_zero: true
    yaml_fences_open_and_close: true
    section_headings_markdown_h2: true
    dependency_table_markdown_pipe_table: true
    test_cases_section_present_markdown_table: true
    self_validation_present_and_matches: true
    no_automation_or_dispatcher_text_in_body: true
    round_unified_rt4: true
    typescript_section_present_and_closed: true

  decisions_finalized:
    - "ATHLETE_PROFILE owns athlete-scoped config only; no D-rule semantics."
    - "Primary and secondary group membership confer neither visibility nor authority by themselves."
    - "Visibility requires explicit scoped capability grant plus consent."
    - "Manual classification correction is distinct from Coach Override and references a consent record."
    - "Availability constraints are planner hints, never safety state."
    - "Cross-training LD boolean and policy enabled flag must agree, or the snapshot is rejected."

  impacts_on_other_specs:
    SESSION_CLASSIFIER_SPEC:
      - consumes LdInclusionPreferences for ld_volume computation
      - consumes manual correction authorization fields
    APP_IMPLEMENTATION_BRIDGE:
      - owns final capability name for manual correction
      - owns snapshot, consent, and audit retention
      - owns secondary-group capability grant issuance and serialization mapping
    FEEDBACK_RENDERER_SPEC:
      - displays annotations and constraint types
      - must not expose reasonText cross-group
      - owns i18n label set

  next_recommended_spec: APP_IMPLEMENTATION_BRIDGE.md
  open_issues_count: 11
  open_issues_canonical_blocking_count: 6
  test_cases_total: 38
  test_cases_passed: 38

  final_decision:
    output: DRAFT_FOR_REVIEW
    approved: false
    upload: NO
    canonical_promotion: NO
```
