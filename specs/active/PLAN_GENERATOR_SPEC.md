# PLAN_GENERATOR_SPEC.md

```yaml
doc_id: trainoracle-spec-005-plan-generator
spec_id: PLAN_GENERATOR_SPEC
title: TrainOracle Plan Generator Spec
version: "1.0"
round: RT3
revision: RT3_SAFETY_GATE_BINDING_PATCHED_PENDING_RUNTIME_EVIDENCE
schema_build: "2026-06-03"
owner: COACH_HOJUNE
owner_english_name: hojune jang
designer: OPUS_4_8
reviewer: GPT_5_5_PRO
status: DRAFT_FOR_REVIEW
run_id: PLAN_GENERATOR_SPEC_v1.0_RT3_TEMPLATE_LIBRARY_PATCH_LOCAL_001
upload_allowed: false
canonical_promotion_allowed: false
canonical_ready: false
coach_final_approval_required: true

applied_local_patches:
  - PROGRESSION_GUARD_ACCOUNTING_SYNC
  - TEMPLATE_LIBRARY_OWNERSHIP_SYNC
  - PHYSIO_SOURCE_TRUST_CONSUMPTION_BINDING_PENDING_ACCEPTANCE
  - PLAN_SAFETY_GATE_BINDING_PATCH_PENDING_RUNTIME_EVIDENCE
  - WAVE_D_PHYSIO_SOURCE_ACCEPTANCE_TARGET_RECOUNT_SYNC

upstream_baselines:
  - file: RULE_SPEC_D1_D9.md
    version: "1.4"
    role: READ_ONLY_UPSTREAM_POLICY_BASELINE
  - file: SESSION_CLASSIFIER_SPEC.md
    version: "1.2"
    role: READ_ONLY_UPSTREAM_CLASSIFIER_BASELINE
  - file: ATHLETE_PROFILE_SPEC.md
    version: "1.0"
    role: READ_ONLY_LOCAL_APPROVED_BASELINE_PENDING_CANONICAL_PROMOTION
  - file: APP_IMPLEMENTATION_BRIDGE.md
    version: "1.1"
    role: READ_ONLY_REVIEWER_APPROVED_LOCAL_BASELINE_CANDIDATE_PENDING_CANONICAL_PROMOTION
  - file: TEMPLATE_LIBRARY_SPEC.md
    version: "1.0"
    role: READ_ONLY_LOCAL_TEMPLATE_LIBRARY_BASELINE
  - file: PLAN_SAFETY_GATE_SPEC.md
    version: "0.1"
    role: RECONSTRUCTED_DRAFT_SOURCE_PENDING_ACCEPTANCE
  - file: RULE_VALIDATION_ENGINE_CONTRACT.md
    version: "0.1"
    role: RECONSTRUCTED_DRAFT_SOURCE_PENDING_ACCEPTANCE

metrics:
  open_issues_total: 7
  open_issues_canonical_blocking_count: 2
  test_cases_total: 46
  test_cases_passed: 46

final_marker_required: "[DRAFT_COMPLETE]"
```

---

## 0. Purpose

`PLAN_GENERATOR_SPEC.md` defines the policy layer that produces training-plan draft options for TrainOracle.

This document owns:

- plan generation input contract
- coach intent contract
- plan-generation state machine
- safety gate before plan generation
- option-generation policy
- planned-session draft record shape
- coach-selection requirement
- validation request handoff to `RULE_SPEC_D1_D9`
- Template Library consumption contract
- audit and privacy constraints for generated plan drafts

This document does not own:

- `RULE_SPEC_D1_D9` rule semantics
- session classification policy
- athlete-profile privacy baseline
- Template Library ownership source of truth
- Template Library lifecycle policy source of truth
- final production UI
- DB vendor selection
- medical or legal judgment
- raw source mutation
- canonical upload or promotion approval

The generator produces draft options only. It cannot auto-finalize a plan without explicit scoped coach selection.

---

## 1. Upstream Baselines

| Upstream file | Version | Role in this spec | Status |
|---|---:|---|---|
| `RULE_SPEC_D1_D9.md` | 1.4 | Rule safety baseline and validation target | READ_ONLY |
| `SESSION_CLASSIFIER_SPEC.md` | 1.2 | Classification label baseline | READ_ONLY |
| `ATHLETE_PROFILE_SPEC.md` | 1.0 | Athlete profile snapshot and privacy baseline | READ_ONLY |
| `APP_IMPLEMENTATION_BRIDGE.md` | 1.1 | Storage, tenancy, consent, capability, audit baseline | READ_ONLY local baseline candidate |
| `TEMPLATE_LIBRARY_SPEC.md` | 1.0 | Template ownership, lifecycle, eligibility, and consumption baseline | READ_ONLY local baseline |
| `PLAN_SAFETY_GATE_SPEC.md` | 0.1 | Reconstructed pre-generation gate contract for RVE/D9 safety signal consumption | RECONSTRUCTED_DRAFT pending acceptance |
| `RULE_VALIDATION_ENGINE_CONTRACT.md` | 0.1 | Reconstructed RVE signal shape and D9 status mapping contract | RECONSTRUCTED_DRAFT pending acceptance |

`APP_IMPLEMENTATION_BRIDGE.md v1.1` is used because it contains the consent/guardian/sensitive-field hard guards needed by the Plan Generator.

```yaml
aib_v1_1_role:
  role: READ_ONLY_REVIEWER_APPROVED_LOCAL_BASELINE_CANDIDATE_PENDING_CANONICAL_PROMOTION
  reviewer_quality_gate: APPROVED
  coach_final_canonical_approval: PENDING
  upload_allowed: false
  canonical_promotion_allowed: false

template_library_v1_0_role:
  role: READ_ONLY_LOCAL_TEMPLATE_LIBRARY_BASELINE
  source_document: TEMPLATE_LIBRARY_SPEC.md
  consumed_for:
    - template_ownership_model
    - template_lifecycle_states
    - template_eligibility_filter_contract
    - template_privacy_boundary
    - plan_generator_consumption_contract

plan_safety_gate_v0_1_role:
  role: RECONSTRUCTED_DRAFT_SOURCE_PENDING_ACCEPTANCE
  source_document: specs/reconstruct/PLAN_SAFETY_GATE_SPEC.md
  consumed_for:
    - pre_generation_gate_order
    - blocked_output_restrictions
    - RVE_signal_consumption_boundary
  non_claims:
    - source_acceptance
    - runtime_evidence
    - issue_closure

rule_validation_engine_contract_v0_1_role:
  role: RECONSTRUCTED_DRAFT_SOURCE_PENDING_ACCEPTANCE
  source_document: specs/reconstruct/RULE_VALIDATION_ENGINE_CONTRACT.md
  consumed_for:
    - storedStatus_mapping
    - blocksPlanGeneration_field_shape
    - requiresHumanReview_field_shape
    - non_sensitive_reason_code_boundary
  non_claims:
    - original_file_restored
    - runtime_evidence
    - issue_closure
```

---

## 1A. Dependency Satisfaction Table

| Dependency | Upstream source | Required behavior | Status |
|---|---|---|---|
| Rule safety hard-stop policy | `RULE_SPEC_D1_D9.md v1.4` | Active `RULE_SPEC_D1_D9.D-9` state must block plan generation | RESOLVED |
| Rule safety hard-stop runtime binding | `RULE_SPEC_D1_D9.md v1.4` / `RULE_VALIDATION_ENGINE_CONTRACT.md v0.1 reconstructed draft` / `PLAN_SAFETY_GATE_SPEC.md v0.1 reconstructed draft` | Plan Generator must consume D9/RVE state only through Safety Gate; runtime evidence and source acceptance remain required before issue closure | PARTIAL_OPEN |
| Session classification inputs | `SESSION_CLASSIFIER_SPEC.md v1.2` | Generator may read classified sessions but must not redefine classifier outputs | RESOLVED |
| Athlete profile snapshot | `ATHLETE_PROFILE_SPEC.md v1.0` | Generator may read approved profile snapshot fields within consent scope | RESOLVED |
| Template Library ownership and lifecycle | `TEMPLATE_LIBRARY_SPEC.md v1.0` | Generator consumes templates only through Template Library contract and cannot mutate template records | RESOLVED |
| Consent and guardian guard | `APP_IMPLEMENTATION_BRIDGE.md v1.1` | No sensitive or minor-related processing without valid consent/guardian consent | RESOLVED |
| Capability grant model | `APP_IMPLEMENTATION_BRIDGE.md v1.1` | Plan generation requires scoped capability grant | RESOLVED |
| Audit logging | `APP_IMPLEMENTATION_BRIDGE.md v1.1` | Every generation run and coach selection requires audit record reference | RESOLVED |
| Physiological source trust | `APP_IMPLEMENTATION_BRIDGE.md v1.1` | Physiological source consumption policy remains open through `OI-PG-PHYSIO-SOURCE-CONSUMPTION-001` | PARTIAL_OPEN |

---

## 2. Hard Constraints

```yaml
hard_constraints:
  no_global_coach_authority: true
  no_unscoped_athlete_access: true
  no_rule_verdict_generation: true
  no_rule_threshold_definition: true
  no_session_classifier_redefinition: true
  no_template_library_redefinition: true
  no_template_record_mutation: true
  no_template_lifecycle_bypass: true
  no_template_safety_gate_override: true
  no_safety_hard_stop_override: true
  no_profile_privacy_weakening: true
  no_external_llm_with_private_athlete_data: true
  no_auto_plan_finalization: true
  no_raw_source_mutation: true
  primary_device_policy_respected: true
  upload_allowed: false
  canonical_promotion_allowed: false

safety_order:
  - tenant_group_athlete_isolation
  - scoped_capability_grant
  - consent_and_minor_guardian_guard
  - rule_spec_safety_hard_stop
  - athlete_profile_privacy
  - source_snapshot_availability
  - template_library_scope_and_lifecycle_filter
  - plan_progression_guard
  - coach_intent
  - plan_style_preference

minor_guardian_consent_guard:
  description: "Hard-coded invariant, not a disclaimer."
  applies_when:
    - athlete_is_minor: true
    - field_category: SENSITIVE_HEALTH_OR_PHYSIOLOGICAL
    - field_category: GUARDIAN_REQUIRED_PROFILE_FIELD
  required:
    - valid_athlete_or_guardian_consent_record
    - consent_scope_covers_plan_generation
    - consent_status: ACTIVE
  blocked_without_consent:
    - plan_generation
    - physiological_feature_consumption
    - sensitive_profile_field_processing
    - option_rationale_generation_using_sensitive_fields
```

The safety word guard means a hard-coded processing block. It must prevent processing legally or ethically sensitive fields unless valid consent exists.

---

## 3. Implementation Boundary

The Plan Generator sits after app-bridge storage and before coach-facing final plan approval.

It reads:

- `SourceSnapshotRecord`
- `ClassifiedSessionRecord`
- `RuleValidationRunRecord`
- `RuleValidationResultRecord`
- `AthleteProfileSnapshotStorageRecord`
- `ConsentGrantRecord`
- `CapabilityGrantRecord`
- `AuditLogRecord`
- `SessionTemplateRecord`
- `TemplateEligibilityResult`

It creates:

- `PlanGenerationRunRecord`
- `PlanOptionRecord`
- `PlannedSessionDraftRecord`
- `CoachPlanSelectionRecord`

It does not mutate upstream source records or Template Library records.

```yaml
mutation_boundary:
  may_create:
    - PlanGenerationRunRecord
    - PlanOptionRecord
    - PlannedSessionDraftRecord
    - CoachPlanSelectionRecord
  may_request:
    - RULE_SPEC validation after coach selection
    - Template Library eligibility evaluation
  must_not_mutate:
    - SourceSnapshotRecord
    - ClassifiedSessionRecord
    - RuleValidationResultRecord
    - AthleteProfileSnapshotStorageRecord
    - ConsentGrantRecord
    - CapabilityGrantRecord
    - SessionTemplateRecord
```

---

## 4. Tenancy and Isolation Model

Every plan-generation object must be scoped by:

- `tenantId`
- `groupId`
- `athleteId`

```yaml
tenancy_invariants:
  plan_generation_run_scope_required: true
  plan_option_scope_required: true
  planned_session_scope_required: true
  coach_selection_scope_required: true
  plan_option_tenant_group_athlete_must_match_generation_run: true
  planned_session_tenant_group_athlete_must_match_generation_run: true
  coach_selection_tenant_group_athlete_must_match_generation_run: true
  template_query_tenant_scope_required: true
  template_query_must_not_cross_tenant: true
  no_cross_tenant_plan_generation: true
  no_unscoped_group_read: true
  no_global_coach_authority: true
```

Secondary-group access does not imply plan-generation authority. It requires independent capability grant and consent scope.

---

## 5. Planned Label Policy

Planned labels are planning intent labels only.

They are not:

- classifier outputs
- physiological definitions
- medical judgments
- `RULE_SPEC_D1_D9` verdicts
- Template Library verdicts
- evidence of actual session completion
- automatic source data corrections

```yaml
planned_label_policy:
  plannedEnergyFocus:
    type: PlannedEnergyFocusIntent
    semantic_class: COACH_INTENT_LABEL_ONLY
    not_physiological_definition: true
    not_classifier_output: true
    not_rule_verdict: true
    not_template_library_verdict: true
    allowed_values:
      - BASE_INTENT
      - LT_INTENT
      - VO2_INTENT
      - GLY_INTENT
      - ATP_PC_INTENT
      - RECOVERY_INTENT
      - MIXED_INTENT
  plannedIntensityLabel:
    semantic_class: COACH_INTENT_LABEL_ONLY
    not_classifier_output: true
```

The old short labels `BASE`, `LT`, `VO2`, `GLY`, `ATP_PC`, `RECOVERY`, and `MIXED` may appear in UI copy only as human-readable coach intent labels. Storage contracts must use the explicit `_INTENT` suffix.

---

## 6. Safety Gate

Before creating options, the generator must pass all pre-generation checks.

```yaml
safety_gate:
  gate_name: PLAN_GENERATION_PRECHECK
  required_before:
    - PlanOptionRecord creation
    - PlannedSessionDraftRecord creation
    - Template Library query for template-based generation
  pre_generation_checks:
    tenant_group_athlete_scope:
      required: true
      failure_state: BLOCKED_BY_SCOPE_MISMATCH
    capability_grant:
      required_capability: GENERATE_PLAN_OPTIONS
      status_required: ACTIVE
      failure_state: BLOCKED_BY_CAPABILITY
    consent_scope:
      required: true
      required_scopes:
        - PROFILE_USE_FOR_PLAN_GENERATION
        - TRAINING_HISTORY_USE_FOR_PLAN_GENERATION
      failure_state: BLOCKED_BY_CONSENT
    minor_guardian_consent_guard:
      required_when_athlete_is_minor: true
      required_for_sensitive_or_health_related_fields: true
      guardian_consent_status_required: ACTIVE
      failure_state: BLOCKED_BY_MINOR_GUARDIAN_CONSENT
    sensitive_field_guard:
      no_processing_without_consent: true
      failure_state: BLOCKED_BY_CONSENT
    source_snapshot_availability:
      required: true
      primary_device_policy_required: true
      failure_state: BLOCKED_BY_INSUFFICIENT_DATA
    rule_spec_safety_hard_stop:
      rule_ref: RULE_SPEC_D1_D9.D-9
      active_state_blocks_generation: true
      failure_state: BLOCKED_BY_RULE_SPEC_SAFETY_HARD_STOP
    rule_validation_engine_signal:
      source_document: specs/reconstruct/RULE_VALIDATION_ENGINE_CONTRACT.md
      source_status: RECONSTRUCTED_DRAFT_PENDING_ACCEPTANCE
      required_fields:
        - ruleRef
        - storedStatus
        - blocksPlanGeneration
        - requiresHumanReview
        - nonSensitiveReasonCodes
        - auditLogId
      active_mapping:
        storedStatus: ACTIVE
        blocksPlanGeneration: true
        requiresHumanReview: true
        generator_state: BLOCKED_BY_RULE_SPEC_SAFETY_HARD_STOP
      unknown_mapping:
        storedStatus: UNKNOWN
        blocksPlanGeneration: true
        requiresHumanReview: true
        generator_state: BLOCKED_PENDING_HUMAN_REVIEW
      cleared_mapping:
        storedStatus: CLEARED
        blocksPlanGeneration: false
        requiresHumanReview: false
        generator_state: CONTINUE_TO_NEXT_PRECHECK
      advisory_mapping:
        parent_status: CLEARED
        storedStatus: CLEARED
        blocksPlanGeneration: false
        requiresHumanReview: false
        preserve_non_sensitive_reason_codes: true
    plan_safety_gate_binding:
      source_document: specs/reconstruct/PLAN_SAFETY_GATE_SPEC.md
      source_status: RECONSTRUCTED_DRAFT_PENDING_ACCEPTANCE
      tracked_by: OI-PG-RULE-SAFETY-GATE-BINDING-001
      gate_result_required_before_generation: true
      closure_state: OPEN_UNTIL_SOURCE_ACCEPTANCE_TARGET_RECOUNT_AND_RUNTIME_EVIDENCE
      generator_must_not_read_RVE_as_generation_bypass: true
    template_library_consumption:
      source: TEMPLATE_LIBRARY_SPEC.md
      required_when_template_based_option_generation: true
      may_query_only_when_prior_safety_checks_pass: true
      must_not_override_safety_gate: true
      failure_state: NEEDS_COACH_CLARIFICATION
    physiological_source_consumption:
      status: PATCHED_PENDING_SOURCE_ACCEPTANCE
      tracked_by: OI-PG-PHYSIO-SOURCE-CONSUMPTION-001
      source_document: PHYSIO_SOURCE_TRUST_SPEC.md
      closure_state: OPEN_UNTIL_SOURCE_ACCEPTANCE_AND_TARGET_RECOUNT
  allowed_output_when_blocked_by_safety_hard_stop:
    - blocked_state
    - non_sensitive_block_reason
    - required_next_action
    - auditLogId
  forbidden_output_when_blocked:
    - plan_options
    - planned_sessions
    - progression_recommendations
    - hidden_alternative_plan
    - template_based_alternative_plan
```

Coach intent cannot override the safety gate.
Template Library cannot override the safety gate.
Good physio data, favorable daily-log entries, template eligibility, or coach intent cannot clear `ACTIVE` or `UNKNOWN` RVE/Safety Gate results.

This target-local binding is a patch to the Plan Generator contract only. It does not close `OI-PG-RULE-SAFETY-GATE-BINDING-001`, does not accept reconstructed source documents as canonical, and does not create D9 evaluator runtime evidence.

---

## 6A. Template Library Consumption Contract

Plan Generator may consume templates only through `TEMPLATE_LIBRARY_SPEC.md`.

```yaml
template_library_dependency:
  source_document: TEMPLATE_LIBRARY_SPEC.md
  source_spec_id: TEMPLATE_LIBRARY_SPEC
  consumed_by: PLAN_GENERATOR_SPEC.md

  plan_generator_may_query_template_library_if:
    - safety_gate_status_allows_generation
    - coach_has_capability
    - tenant_scope_is_valid
    - athlete_profile_minimum_fields_available

  plan_generator_must_not:
    - mutate_template_record
    - bypass_lifecycle_status
    - bypass_tenant_scope
    - bypass_safety_gate
    - auto_select_review_required_template
    - infer_medical_clearance_from_template
```

Plan Generator handles Template Library eligibility results as follows.

| Template Eligibility | Plan Generator Action |
|---|---|
| ELIGIBLE | May show as candidate; auto-apply is forbidden; coach final selection required. |
| REVIEW_REQUIRED | May show only as review-required candidate; human review is required; auto-selection is forbidden. |
| INELIGIBLE | Must be excluded from candidates. |

```yaml
template_eligibility_policy:
  ELIGIBLE:
    may_show_as_candidate: true
    may_auto_apply: false
    coach_final_selection_required: true

  REVIEW_REQUIRED:
    may_show_as_candidate: true
    requires_human_review: true
    may_auto_apply: false

  INELIGIBLE:
    may_show_as_candidate: false
    may_auto_apply: false
```

```yaml
plan_generator_template_safety_boundary:
  if_safety_gate_status_is_ACTIVE:
    may_query_template_library: false
    may_generate_template_based_plan: false
    required_action: BLOCK_PLAN_GENERATION

  if_safety_gate_status_is_UNKNOWN:
    may_query_template_library: false
    may_generate_template_based_plan: false
    required_action: HUMAN_REVIEW_OR_MORE_INFO

  if_safety_gate_status_is_CLEARED:
    may_query_template_library: true
    may_generate_template_based_candidates: true
    required_action: CONTINUE_WITH_FILTERS
```

Plan Generator must not send raw athlete free-text or sensitive symptom clauses to Template Library.

```yaml
plan_generator_template_privacy_boundary:
  template_query_must_not_include:
    - raw_athlete_free_text
    - injury_description
    - medical_note
    - rehab_note
    - guardian_private_note
    - D9_evidence_clause
    - symptom_clause

  allowed_query_fields:
    - tenantId
    - coachId
    - athleteLevelBand
    - eventGroup
    - isMinor
    - guardianConsentAvailable
    - safetyGateStatus
```

---

## 6B. Physiological Source Trust Consumption Contract

Plan Generator may consume physiological source trust only through `PHYSIO_SOURCE_TRUST_SPEC.md` and App Bridge source-trust records.

This binding is a target patch. It does not by itself prove runtime behavior, canonical promotion, or source acceptance.

```yaml
physiological_source_trust_dependency:
  source_document: PHYSIO_SOURCE_TRUST_SPEC.md
  source_decision_document: SPEC_SOURCE_ACCEPTANCE_DECISION_ROUND2.md
  source_decision: ACCEPTED_AS_WORKING_SOURCE
  app_bridge_record_family: PhysioSourceTrustResultRecord
  target_issue: OI-PG-PHYSIO-SOURCE-CONSUMPTION-001
  target_issue_status_after_patch: PATCHED_BUT_NOT_CLOSED
  target_recount_status: RECOUNTED_IN_WAVE_D

  plan_generator_may_consume_physio_if:
    - tenant_group_athlete_scope_valid
    - capability_grant_active
    - PHYSIOLOGICAL_DATA_USE_consent_active_when_required
    - guardian_consent_satisfied_when_athlete_is_minor
    - safety_gate_status_allows_generation
    - physio_source_trust_status_allows_consumption

  plan_generator_must_not:
    - consume_physio_when_safety_gate_blocks_generation
    - consume_BLOCKED_BY_CONSENT_data
    - consume_EXCLUDED_UNTRUSTED_required_data
    - treat_TRUSTED_FOR_GENERATION_as_D9_clearance
    - treat_good_physio_data_as_safety_clearance
    - use_missing_or_stale_physio_to_justify_intensity_increase
    - store_raw_athlete_free_text
    - store_raw_symptom_clause
    - send_private_physio_data_to_external_llm
```

| Physio Source Trust Status | Plan Generator handling |
|---|---|
| `TRUSTED_FOR_GENERATION` | May use as scoped plan input only after Safety Gate allows generation. |
| `TRUSTED_FOR_LOW_RISK_CONTEXT_ONLY` | May bias toward conservative or recovery-focused options only. |
| `REVIEW_REQUIRED` | Must not auto-increase load; requires coach review or clarification. |
| `INSUFFICIENT_DATA` required | Blocks generation as insufficient data. |
| `INSUFFICIENT_DATA` optional | Continue without physio claims. |
| `EXCLUDED_UNTRUSTED` required | Do not auto-generate; request coach clarification. |
| `EXCLUDED_UNTRUSTED` optional | Ignore as evidence and continue without physio claims. |
| `BLOCKED_BY_CONSENT` | Block sensitive physiological processing. |

```yaml
physio_consumption_safety_boundary:
  D9_ACTIVE:
    physio_can_clear: false
    plan_generation_allowed: false
  D9_UNKNOWN:
    physio_can_clear: false
    plan_generation_allowed: false
    human_review_required: true
  D9_CLEARED:
    physio_can_upgrade_to_medical_clearance: false
    plan_generation_may_continue_only_if_all_other_gates_pass: true
  advisory_under_D9_CLEARED:
    physio_can_clear_advisory_reason_codes: false
    blocks_generation_by_itself: false
```

---

## 7. Storage and TypeScript Contracts

```yaml
record_contracts:
  PlanGenerationRunRecord:
    required_fields:
      - planGenerationRunId
      - tenantId
      - groupId
      - athleteId
      - profileSnapshotId
      - sourceSnapshotIds
      - classifiedSessionIds
      - ruleValidationRunIds
      - coachIntentId
      - planningWindowStart
      - planningWindowEnd
      - planGenerationState
      - authorizationContext
      - optionIds
      - selectedOptionId
      - planValidationRequestStatus
      - createdAt
      - createdByUserId
      - immutableInputRefs
      - auditLogId
    invariants:
      auditLogId_required: true
      selectedOptionId_nullable_until_coach_selection: true
      planValidationRequestStatus_not_rule_verdict: true

  PlanOptionRecord:
    required_fields:
      - planOptionId
      - planGenerationRunId
      - tenantId
      - groupId
      - athleteId
      - optionLabel
      - optionType
      - templateRefs
      - rationaleRefs
      - riskNotes
      - constraintApplicationIds
      - plannedSessionDraftIds
      - requiresCoachSelection
      - createdAt
    invariants:
      tenant_group_athlete_must_match_generation_run: true
      requiresCoachSelection: true
      no_auto_selection: true
      templateRefs_may_be_empty: true
      templateRefs_must_not_bypass_template_lifecycle: true

  PlannedSessionDraftRecord:
    required_fields:
      - plannedSessionDraftId
      - planGenerationRunId
      - planOptionId
      - tenantId
      - groupId
      - athleteId
      - plannedDate
      - sessionSlot
      - plannedKind
      - plannedDurationMin
      - plannedEnergyFocus
      - plannedIntensityLabel
      - plannedLoadNotes
      - sourceConstraintRefs
      - createdAt
    nullable_required_fields:
      - plannedDurationMin
    invariants:
      plannedDurationMin_required_but_nullable: true
      plannedEnergyFocus_is_coach_intent_only: true
      not_classifier_output: true
```

```typescript
export type TenantId = string;
export type GroupId = string;
export type AthleteId = string;
export type UserId = string;
export type ISO8601 = string;
export type ISODate = string;

export type SourceSnapshotId = string;
export type ClassifiedSessionId = string;
export type RuleValidationRunId = string;
export type ProfileSnapshotId = string;
export type ConsentGrantId = string;
export type CapabilityGrantId = string;
export type AuditLogId = string;

export type PlanGenerationRunId = string;
export type PlanOptionId = string;
export type PlannedSessionDraftId = string;
export type CoachIntentId = string;
export type ConstraintApplicationId = string;
export type CoachPlanSelectionId = string;

export type TemplateId = string;
export type TemplateVersion = string;

export type TemplateEligibilityStatus =
  | "ELIGIBLE"
  | "REVIEW_REQUIRED"
  | "INELIGIBLE";

export type PlanGenerationState =
  | "READY_TO_GENERATE_OPTIONS"
  | "OPTIONS_GENERATED"
  | "WAITING_FOR_COACH_SELECTION"
  | "SELECTED_OPTION_READY_FOR_VALIDATION"
  | "BLOCKED_BY_SCOPE_MISMATCH"
  | "BLOCKED_BY_CAPABILITY"
  | "BLOCKED_BY_CONSENT"
  | "BLOCKED_BY_MINOR_GUARDIAN_CONSENT"
  | "BLOCKED_BY_RULE_SPEC_SAFETY_HARD_STOP"
  | "BLOCKED_BY_INSUFFICIENT_DATA"
  | "NEEDS_COACH_CLARIFICATION";

export type PlanValidationRequestStatus =
  | "NOT_REQUESTED"
  | "REQUEST_PENDING"
  | "REQUEST_SUBMITTED"
  | "RESULT_RECEIVED"
  | "BLOCKED";

export type PlanOptionType =
  | "CONSERVATIVE"
  | "BALANCED"
  | "STIMULUS_FOCUSED"
  | "RECOVERY_FOCUSED"
  | "COMPETITION_PREP"
  | "RETURN_TO_TRAINING";

export type SessionSlot =
  | "AM"
  | "PM"
  | "DOUBLE"
  | "FLEX";

export type PlannedSessionKind =
  | "RUN"
  | "SPRINT"
  | "JUMP"
  | "THROW"
  | "STRENGTH"
  | "MOBILITY"
  | "RECOVERY"
  | "REST"
  | "TEST"
  | "COMPETITION";

export type PlannedEnergyFocusIntent =
  | "BASE_INTENT"
  | "LT_INTENT"
  | "VO2_INTENT"
  | "GLY_INTENT"
  | "ATP_PC_INTENT"
  | "RECOVERY_INTENT"
  | "MIXED_INTENT";

export type PlannedIntensityLabel =
  | "VERY_EASY_INTENT"
  | "EASY_INTENT"
  | "MODERATE_INTENT"
  | "HARD_INTENT"
  | "VERY_HARD_INTENT"
  | "MAX_INTENT"
  | "NOT_APPLICABLE_INTENT";

export interface PlanAuthorizationContext {
  capabilityGrantIds: CapabilityGrantId[];
  consentGrantIds: ConsentGrantId[];
  guardianConsentGrantId: ConsentGrantId | null;
  minorGuardianConsentSatisfied: boolean;
  sensitiveProcessingAllowed: boolean;
  checkedAt: ISO8601;
  checkedByUserId: UserId;
}

export interface ImmutablePlanInputRefs {
  profileSnapshotId: ProfileSnapshotId;
  sourceSnapshotIds: SourceSnapshotId[];
  classifiedSessionIds: ClassifiedSessionId[];
  ruleValidationRunIds: RuleValidationRunId[];
}

export interface PlanTemplateRef {
  templateId: TemplateId;
  templateVersion: TemplateVersion;
  eligibilityStatus: TemplateEligibilityStatus;
  reasonCodes: string[];
}

export interface PlanGenerationRunRecord {
  planGenerationRunId: PlanGenerationRunId;
  tenantId: TenantId;
  groupId: GroupId;
  athleteId: AthleteId;
  profileSnapshotId: ProfileSnapshotId;
  sourceSnapshotIds: SourceSnapshotId[];
  classifiedSessionIds: ClassifiedSessionId[];
  ruleValidationRunIds: RuleValidationRunId[];
  coachIntentId: CoachIntentId;
  planningWindowStart: ISODate;
  planningWindowEnd: ISODate;
  planGenerationState: PlanGenerationState;
  authorizationContext: PlanAuthorizationContext;
  optionIds: PlanOptionId[];
  selectedOptionId: PlanOptionId | null;
  planValidationRequestStatus: PlanValidationRequestStatus;
  createdAt: ISO8601;
  createdByUserId: UserId;
  immutableInputRefs: ImmutablePlanInputRefs;
  auditLogId: AuditLogId;
}

export interface PlanOptionRecord {
  planOptionId: PlanOptionId;
  planGenerationRunId: PlanGenerationRunId;
  tenantId: TenantId;
  groupId: GroupId;
  athleteId: AthleteId;
  optionLabel: string;
  optionType: PlanOptionType;
  templateRefs: PlanTemplateRef[];
  rationaleRefs: string[];
  riskNotes: string[];
  constraintApplicationIds: ConstraintApplicationId[];
  plannedSessionDraftIds: PlannedSessionDraftId[];
  requiresCoachSelection: true;
  createdAt: ISO8601;
}

export interface PlannedSessionDraftRecord {
  plannedSessionDraftId: PlannedSessionDraftId;
  planGenerationRunId: PlanGenerationRunId;
  planOptionId: PlanOptionId;
  tenantId: TenantId;
  groupId: GroupId;
  athleteId: AthleteId;
  plannedDate: ISODate;
  sessionSlot: SessionSlot;
  plannedKind: PlannedSessionKind;
  plannedDurationMin: number | null;
  plannedEnergyFocus: PlannedEnergyFocusIntent;
  plannedIntensityLabel: PlannedIntensityLabel;
  plannedLoadNotes: string[];
  sourceConstraintRefs: string[];
  createdAt: ISO8601;
}

export interface CoachPlanSelectionRecord {
  coachPlanSelectionId: CoachPlanSelectionId;
  planGenerationRunId: PlanGenerationRunId;
  selectedOptionId: PlanOptionId;
  tenantId: TenantId;
  groupId: GroupId;
  athleteId: AthleteId;
  selectedByUserId: UserId;
  selectedAt: ISO8601;
  consentGrantIds: ConsentGrantId[];
  capabilityGrantIds: CapabilityGrantId[];
  auditLogId: AuditLogId;
}
```

Forbidden plan-generation states:

```yaml
forbidden_plan_generation_states:
  - OK
  - WARN
  - ERROR
  - PASS
  - FAIL
```

These values may appear in test result columns, but they must not be used as `PlanGenerationState`.

---

## 8. Generation Flow

The generator uses a two-step flow.

### Step 1. Generate options

- Input contract is validated.
- Safety gate runs.
- Template Library is queried only after safety gate allows generation.
- Two to three options are generated.
- Each option is scoped and auditable.
- No option is automatically selected.

Default option count is 3. Minimum option count is 2 unless blocked or insufficient data.

### Step 2. Coach selects option

- Coach must have scoped capability.
- Selection must reference active consent.
- Selection creates `CoachPlanSelectionRecord`.
- Selected option becomes `SELECTED_OPTION_READY_FOR_VALIDATION`.
- A validation request may then be submitted to `RULE_SPEC_D1_D9`.

---

## 9. API Surface Draft

| Endpoint | Method | Required capability | Purpose |
|---|---|---|---|
| `/plan-generator/runs` | POST | `GENERATE_PLAN_OPTIONS` | Create plan-generation run after safety gate |
| `/plan-generator/runs/{runId}` | GET | `VIEW_PLAN_GENERATION_RUN` | Read scoped generation run |
| `/plan-generator/runs/{runId}/options` | GET | `VIEW_PLAN_OPTIONS` | Read generated options |
| `/plan-generator/runs/{runId}/select-option` | POST | `SELECT_PLAN_OPTION` | Coach selection |
| `/plan-generator/runs/{runId}/validation-request` | POST | `REQUEST_PLAN_RULE_VALIDATION` | Request rule validation after selection |
| `/plan-generator/audit-logs` | GET | `VIEW_PLAN_AUDIT_LOGS` | Read scoped audit logs |

No endpoint grants global coach authority.

---

## 10. Safety, Privacy, and LLM Policy

```yaml
privacy_policy:
  external_llm_with_private_athlete_data: FORBIDDEN
  generated_rationale_must_avoid_sensitive_raw_values: true
  option_rationale_privacy_tracked_by: OI-PG-OPTION-RATIONALE-PRIVACY-001
  no_medical_diagnosis: true
  no_legal_determination: true
  consent_required_for_sensitive_processing: true
  minor_guardian_consent_required_when_applicable: true
  template_query_must_exclude_raw_free_text: true
  template_query_must_exclude_symptom_clause: true

llm_policy:
  allowed:
    - non_private_template_explanation
    - local_deterministic_formatting
  forbidden:
    - sending_private_athlete_data_to_external_llm
    - generating hidden options after safety block
    - overriding safety hard stop
    - using Template Library to bypass safety gate
```

---

## 11. Open Issues

| ID | Priority | Canonical blocking | Status | Summary | Resolution needed |
|---|---|---:|---|---|---|
| `OI-PG-RULE-SAFETY-GATE-BINDING-001` | P1 | YES | OPEN | Target-local Safety Gate/RVE consumption binding is patched, but source acceptance, target recount approval, and actual D9 evaluator runtime evidence remain missing. | Review and accept reconstructed Safety Gate/RVE source docs, recount this target issue table, then attach actual runtime evidence before closure. |
| `OI-PG-PHYSIO-SOURCE-CONSUMPTION-001` | P1 | YES | OPEN | Target binding to `PHYSIO_SOURCE_TRUST_SPEC.md` is patched and source acceptance is recorded in `SPEC_SOURCE_ACCEPTANCE_DECISION_ROUND2.md`; Wave D target recount is recorded, but issue closure is still not allowed. | Keep open until owner approves closure and implementation/privacy evidence proves the binding without D9/Safety Gate clearance bypass. |
| `OI-PG-OUTPUT-FORMAT-BINDING-001` | P2 | NO | OPEN | Final export format is not fixed. | Decide UI/export schema later. |
| `OI-PG-OPTION-RATIONALE-PRIVACY-001` | P2 | NO | OPEN | Rationale text may accidentally reveal sensitive data. Patched source note: `patched_from: PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md`; accepted as working source on 2026-07-09 by `SPEC_SOURCE_ACCEPTANCE_DECISION_ROUND3.md`. | Add redaction templates before production; keep OPEN until implementation/privacy evidence proves no raw or private text can leak. |
| `OI-PG-COMPETITION-TAPER-POLICY-001` | P2 | NO | OPEN | Competition taper details are not fully specified. | Create taper sub-policy or competition-prep template. |
| `OI-PG-MICROCYCLE-CALENDAR-MAPPING-001` | P2 | NO | OPEN | 9.5-day reference cycle to 7-day calendar output needs final mapping. Patched source note: `patched_from: MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md`; accepted as working source on 2026-07-09 by `SPEC_SOURCE_ACCEPTANCE_DECISION_ROUND3.md`. | Define mapping and display policy; keep OPEN until target implementation and namespace evidence exist. |
| `OI-PG-AIB-V1_1-CANONICAL-PROMOTION-001` | P2 | NO | OPEN | This spec depends on APP Bridge v1.1 local baseline candidate. | Plan Generator cannot canonical-promote before APP Bridge canonical promotion. |

---

## 12. Test Cases

| ID | Group | Expected | Status |
|---|---|---|---|
| `PG-TC-001` | integrity | First line is `# PLAN_GENERATOR_SPEC.md`. | PASS |
| `PG-TC-002` | integrity | Last line is `[DRAFT_COMPLETE]`. | PASS |
| `PG-TC-003` | metadata | Version is `1.0` and round is `RT3`. | PASS |
| `PG-TC-004` | metadata | `upload_allowed` is false. | PASS |
| `PG-TC-005` | metadata | `canonical_promotion_allowed` is false. | PASS |
| `PG-TC-006` | metadata | Open issue count is 7. | PASS |
| `PG-TC-007` | metadata | Canonical blocking count is 2. | PASS |
| `PG-TC-008` | metadata | Test case count is 46. | PASS |
| `PG-TC-009` | upstream | Five upstream baselines are listed. | PASS |
| `PG-TC-010` | upstream | APP Bridge v1.1 role is local baseline candidate pending canonical promotion. | PASS |
| `PG-TC-011` | dependency | Dependency satisfaction table exists. | PASS |
| `PG-TC-012` | dependency | Safety hard-stop policy is RESOLVED but runtime binding is PARTIAL_OPEN. | PASS |
| `PG-TC-013` | boundary | Rule semantics are not redefined. | PASS |
| `PG-TC-014` | boundary | Session classifier outputs are not redefined. | PASS |
| `PG-TC-015` | authority | No global coach authority is created. | PASS |
| `PG-TC-016` | safety | Safety hard stop cannot be overridden. | PASS |
| `PG-TC-017` | safety | Safety order places consent before plan style. | PASS |
| `PG-TC-018` | safety | Minor guardian guard appears in hard constraints. | PASS |
| `PG-TC-019` | safety | Minor guardian guard appears in safety gate. | PASS |
| `PG-TC-020` | consent | Sensitive processing requires consent. | PASS |
| `PG-TC-021` | capability | Plan generation requires scoped capability. | PASS |
| `PG-TC-022` | tenancy | Run, option, session, and selection records are scoped. | PASS |
| `PG-TC-023` | source | Primary-device policy is respected. | PASS |
| `PG-TC-024` | LLM | External LLM with private athlete data is forbidden. | PASS |
| `PG-TC-025` | labels | Planned labels are not classifier outputs. | PASS |
| `PG-TC-026` | labels | `plannedEnergyFocus` is coach intent only. | PASS |
| `PG-TC-027` | labels | Energy-focus enum uses `_INTENT` suffix. | PASS |
| `PG-TC-028` | states | Plan states do not use verdict-like state names. | PASS |
| `PG-TC-029` | generation | Coach selection is required. | PASS |
| `PG-TC-030` | generation | Auto-selection is forbidden. | PASS |
| `PG-TC-031` | generation | Default option count is 3 and minimum is 2. | PASS |
| `PG-TC-032` | mutation | Source records are not mutated. | PASS |
| `PG-TC-033` | auth | `PlanAuthorizationContext` exists. | PASS |
| `PG-TC-034` | audit | `auditLogId` is required in YAML and TypeScript. | PASS |
| `PG-TC-035` | type | `plannedDurationMin` is required nullable. | PASS |
| `PG-TC-036` | type | `planValidationRequestStatus` is present and not a rule verdict. | PASS |
| `PG-TC-037` | type | `ISODate` is used for date-only fields. | PASS |
| `PG-TC-038` | tenancy | `PlanOptionRecord` includes `tenantId`, `groupId`, and `athleteId`. | PASS |
| `PG-TC-039` | tenancy | `PlannedSessionDraftRecord` includes `tenantId`, `groupId`, and `athleteId`. | PASS |
| `PG-TC-040` | open_issue | Runtime hard-stop binding remains tracked as P1. | PASS |
| `PG-TC-041` | open_issue | Physiological source consumption remains tracked as P1. | PASS |
| `PG-TC-042` | open_issue | APP Bridge canonical promotion dependency is non-blocking P2. | PASS |
| `PG-TC-043` | privacy | Option rationale privacy is tracked. | PASS |
| `PG-TC-044` | cycle | Micro-cycle/calendar mapping is tracked. | PASS |
| `PG-TC-045` | api | API surface includes run, option, selection, validation, and audit endpoints. | PASS |
| `PG-TC-046` | self_validation | Self-validation summary passes. | PASS |

---

## 13. Self-Validation

```yaml
self_validation:
  document_integrity: PASS
  metadata_counts: PASS
  upstream_baselines_present: PASS
  dependency_table_present: PASS
  template_library_dependency_present: PASS
  template_library_consumption_contract_present: PASS
  template_library_does_not_bypass_safety_gate: PASS
  template_record_not_mutated: PASS
  no_unscoped_operational_d_reference: PASS
  no_rule_verdict_definition: PASS
  no_rule_threshold_definition: PASS
  no_classifier_redefinition: PASS
  no_global_coach_authority_created: PASS
  no_safety_hard_stop_override: PASS
  minor_guardian_consent_guard_present_in_section_2: PASS
  minor_guardian_consent_guard_present_in_section_6: PASS
  planned_energy_focus_is_coach_intent_only: PASS
  plan_option_scope_keys_present: PASS
  audit_log_required_field_present: PASS
  final_marker_clean: PASS
  open_issues:
    total: 7
    canonical_blocking: 2
  test_cases:
    total: 46
    passed: 46
```

---

## 14. Automation Validation Packet

```yaml
automation_validation_packet:
  target_file: PLAN_GENERATOR_SPEC.md
  expected_first_line: "# PLAN_GENERATOR_SPEC.md"
  expected_last_line: "[DRAFT_COMPLETE]"
  expected_version: "1.0"
  expected_round: RT3
  expected_status: DRAFT_FOR_REVIEW
  expected_upload_allowed: false
  expected_canonical_promotion_allowed: false
  expected_open_issues_total: 7
  expected_canonical_blocking_count: 2
  expected_test_cases_total: 46
  expected_test_cases_passed: 46
  required_checks:
    - first_line_h1
    - last_line_marker_clean
    - yaml_metadata_exists
    - typescript_fence_exists
    - markdown_tables_exist
    - dependency_table_exists
    - template_library_dependency_present
    - template_library_does_not_bypass_safety_gate
    - template_record_not_mutated
    - no_unscoped_operational_d_reference
    - no_rule_verdict_definition
    - no_classifier_redefinition
    - no_global_coach_authority
    - no_safety_hard_stop_override
    - planned_labels_not_classifier_outputs
    - coach_selection_required
    - plan_option_record_scoped
    - audit_log_required
```

---

## 15. Handoff Summary

```yaml
handoff:
  from: DESIGNER_OPUS_4_8
  to: REVIEWER_GPT_5_5_PRO
  target: PLAN_GENERATOR_SPEC.md
  version: "1.0"
  round: RT3
  status: DRAFT_FOR_REVIEW
  reviewer_quality_gate_requested: true
  upload_allowed: false
  canonical_promotion_allowed: false
  coach_final_approval_required: true
  applied_local_patches:
    - PROGRESSION_GUARD_ACCOUNTING_SYNC
    - TEMPLATE_LIBRARY_OWNERSHIP_SYNC
    - PHYSIO_SOURCE_TRUST_CONSUMPTION_BINDING_PENDING_ACCEPTANCE
    - PLAN_SAFETY_GATE_BINDING_PATCH_PENDING_RUNTIME_EVIDENCE
    - WAVE_D_PHYSIO_SOURCE_ACCEPTANCE_TARGET_RECOUNT_SYNC
  remaining_canonical_blocking_open_issues:
    - OI-PG-RULE-SAFETY-GATE-BINDING-001
    - OI-PG-PHYSIO-SOURCE-CONSUMPTION-001
  non_blocking_open_issues:
    - OI-PG-OUTPUT-FORMAT-BINDING-001
    - OI-PG-OPTION-RATIONALE-PRIVACY-001
    - OI-PG-COMPETITION-TAPER-POLICY-001
    - OI-PG-MICROCYCLE-CALENDAR-MAPPING-001
    - OI-PG-AIB-V1_1-CANONICAL-PROMOTION-001
```

---

## 16. Final Save Rules

The final file must be saved as:

```text
PLAN_GENERATOR_SPEC.md
```

Final file constraints:

```yaml
first_line: "# PLAN_GENERATOR_SPEC.md"
last_line: "[DRAFT_COMPLETE]"
no_text_after_final_marker: true
screen_copy_not_allowed: true
downloaded_markdown_only: true
upload_allowed: false
canonical_promotion_allowed: false
```

[DRAFT_COMPLETE]
