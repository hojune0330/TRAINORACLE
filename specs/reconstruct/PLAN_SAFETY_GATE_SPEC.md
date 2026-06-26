# PLAN_SAFETY_GATE_SPEC.md

```yaml
document_metadata:
  doc_id: trainoracle-spec-012-plan-safety-gate
  spec_id: PLAN_SAFETY_GATE_SPEC
  title: TrainOracle Plan Safety Gate Spec
  version: "0.1"
  round: RT1_RECONSTRUCT
  status: RECONSTRUCTED_DRAFT_FOR_REVIEW
  owner: COACH_HOJUNE
  owner_english_name: hojune jang

  reconstruction_notice:
    local_original_found: false
    reconstructed_from_sources: true
    restored_original: false
    prior_approved_version_restored: false

  open_issues_total: 5
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

`PLAN_SAFETY_GATE_SPEC.md` defines the pre-generation safety gate that sits between Rule Validation Engine signals and Plan Generator execution.

This reconstructed draft exists because exact local filename search did not find an original `PLAN_SAFETY_GATE_SPEC.md` before reconstruction. It must not be treated as a restored original, prior approved version, runtime evidence, or issue closure.

The gate decides whether Plan Generator may continue toward draft option creation. It does not create training plans, redefine rule semantics, run the D9 evaluator, or provide medical clearance.

---

## 2. Non-Purpose

This document does not:

- redefine `RULE_SPEC_D1_D9.D-*` rule semantics
- replace `RULE_SPEC_D1_D9.md`
- replace `RULE_VALIDATION_ENGINE_CONTRACT.md`
- replace `PLAN_GENERATOR_SPEC.md`
- implement the D9 evaluator
- claim D9 evaluator runtime PASS evidence
- close `OI-RVE-RULE-EVALUATOR-BINDING-001`
- close `OI-PG-RULE-SAFETY-GATE-BINDING-001`
- close physio-source consumption issues
- provide medical, injury, rehab, return-to-play, or high-intensity clearance
- permit raw athlete free-text, symptom clauses, injury narratives, medical notes, rehab notes, evidence clauses, or guardian private notes in audit records

---

## 3. Source Priority

```yaml
source_priority:
  rule_semantics:
    - document: specs/active/RULE_SPEC_D1_D9.md
      treatment: READ_ONLY_SEMANTIC_BASELINE
      consumed_for:
        - RULE_SPEC_D1_D9.D-9 safety hard-stop semantics
        - no safety exception override
        - no rule threshold redefinition

  rve_signal_shape:
    - document: specs/reconstruct/RULE_VALIDATION_ENGINE_CONTRACT.md
      treatment: RECONSTRUCTED_DRAFT_FOR_REVIEW
      consumed_for:
        - RveRuleEvaluatorSignal shape
        - storedStatus values
        - privacy-safe reason codes
      caveat: "This source is reconstructed, not canonical."

  d9_binding_baseline:
    - document: specs/active/RVE_RULE_EVALUATOR_BINDING_SPEC.md
      treatment: READ_ONLY_BINDING_BASELINE
      consumed_for:
        - ACTIVE_UNKNOWN_CLEARED routing
        - advisory subtype handling
        - runtime evidence requirement

  plan_generator_boundary:
    - document: specs/active/PLAN_GENERATOR_SPEC.md
      treatment: READ_ONLY_DOWNSTREAM_BASELINE
      consumed_for:
        - PLAN_GENERATION_PRECHECK boundary
        - blocked output restrictions
        - target issue OI-PG-RULE-SAFETY-GATE-BINDING-001

  app_bridge_boundary:
    - document: specs/active/APP_IMPLEMENTATION_BRIDGE.md
      treatment: READ_ONLY_APP_BRIDGE_BASELINE
      consumed_for:
        - tenant_group_athlete_scope
        - consent_guard
        - capability_guard
        - audit_privacy_policy
```

---

## 4. Namespace Policy

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

All references to the current safety hard-stop rule must use `RULE_SPEC_D1_D9.D-9`.

---

## 5. Hard Constraints

```yaml
hard_constraints:
  no_global_coach_authority: true
  no_safety_hard_stop_override: true
  no_D9_rule_semantic_redefinition: true
  no_rule_threshold_definition: true
  no_external_llm_with_private_athlete_data: true
  no_raw_free_text_storage: true
  no_raw_symptom_clause_storage: true
  no_evidence_clause_storage_in_audit: true
  no_good_physio_clearance_of_D9_risk: true
  no_template_library_clearance_of_D9_risk: true
  no_free_text_clearance_of_existing_risk: true
  no_generation_after_ACTIVE_or_UNKNOWN: true
  no_runtime_pass_claim_without_actual_log: true
  no_issue_closure_from_reconstruction_only: true
```

Good physiological data, template selection, coach preference, athlete request, or advisory wording cannot clear an `ACTIVE` or `UNKNOWN` D9/RVE state.

---

## 6. Gate Position

```yaml
gate_position:
  gate_name: PLAN_GENERATION_PRECHECK
  required_before:
    - PlanOptionRecord creation
    - PlannedSessionDraftRecord creation
    - Template Library query for template-based generation
    - plan rationale generation
    - progression recommendation generation

  downstream_consumer:
    document: specs/active/PLAN_GENERATOR_SPEC.md
    rule: "Plan Generator consumes D9/RVE binding only through this Safety Gate."

  upstream_signal:
    document: specs/reconstruct/RULE_VALIDATION_ENGINE_CONTRACT.md
    signal: RveRuleEvaluatorSignal
    rule_ref_required: RULE_SPEC_D1_D9.D-9
```

Plan Generator may read an RVE signal for audit context, but it must not bypass the Safety Gate result when deciding whether to generate plan options.

---

## 7. Required Inputs

```yaml
required_inputs:
  scope:
    - tenantId
    - groupId
    - athleteId
    - actorId

  authorization:
    - capabilityGrantId
    - requiredCapability: GENERATE_PLAN_OPTIONS

  consent:
    - consentGrantIds
    - PROFILE_USE_FOR_PLAN_GENERATION
    - TRAINING_HISTORY_USE_FOR_PLAN_GENERATION
    - PHYSIOLOGICAL_DATA_USE_when_required
    - GUARDIAN_CONSENT_when_athlete_is_minor

  source_context:
    - sourceSnapshotId
    - primaryDevicePolicyStatus
    - profileSnapshotId
    - classifiedSessionRefs

  rve_signal:
    - validationRunId
    - ruleRef
    - storedStatus
    - blocksPlanGeneration
    - requiresHumanReview
    - nonSensitiveReasonCodes
    - generatedAt
    - expiresAt
    - auditLogId
```

Raw athlete text, symptom descriptions, evidence clauses, injury narratives, medical notes, rehab notes, and guardian private notes are not valid Safety Gate inputs.

---

## 8. Gate Order

```yaml
gate_order:
  - tenant_group_athlete_scope
  - capability_grant
  - consent_scope
  - minor_guardian_consent_guard
  - sensitive_field_guard
  - source_snapshot_availability
  - primary_device_policy
  - RVE_D9_signal_consumption
  - downstream_physio_source_trust_check_when_required
  - template_library_query_permission
```

The D9/RVE step is a hard gate. A later physio, template, coach-intent, or planning-style check cannot reverse an `ACTIVE` or `UNKNOWN` decision.

---

## 9. D9/RVE Signal Consumption

The Safety Gate consumes RVE status without redefining `RULE_SPEC_D1_D9.D-9`.

| RVE storedStatus | blocksPlanGeneration | requiresHumanReview | Safety Gate decision | Plan Generator state | Meaning |
|---|---:|---:|---|---|---|
| `ACTIVE` | true | true | `BLOCK` | `BLOCKED_BY_RULE_SPEC_SAFETY_HARD_STOP` | Current hard risk, red-flag, manual/medical hold, or active safety hard-stop signal. |
| `UNKNOWN` | true | true | `BLOCK_OR_HUMAN_REVIEW` | `NEEDS_COACH_CLARIFICATION` | Ambiguous, insufficient, stale, unavailable, or concerning state. |
| `CLEARED` | false | false | `CONTINUE_WITH_OTHER_GATES` | `DEPENDS_ON_REMAINING_PRECHECKS` | No D9 risk signal detected by the evaluator at this evaluation time only. |
| `CLEARED` with advisory reason codes | false | false | `CONTINUE_WITH_OTHER_GATES_WITH_ADVISORY` | `DEPENDS_ON_REMAINING_PRECHECKS` | Advisory is a non-blocking subtype under `D9_CLEARED`, not a fourth disposition. |

`D9_CLEARED` and advisory do not mean medical clearance, injury clearance, rehab clearance, return-to-play approval, full plan approval, or high-intensity approval.

`BLOCK_OR_HUMAN_REVIEW` still means `planGenerationAllowed: false`. Human review or more information is the required next action; it is not an automatic pass-through.

```yaml
failure_or_stale_signal_handling:
  evaluator_unavailable: UNKNOWN
  evaluator_timeout: UNKNOWN
  evaluator_exception: UNKNOWN
  invalid_input_shape: UNKNOWN
  stale_evaluator_version: UNKNOWN
  safety_gate_effect:
    storedStatus: UNKNOWN
    planGenerationAllowed: false
    templateLibraryQueryAllowed: false
    requiredNextAction: MORE_INFO_OR_HUMAN_REVIEW
```

---

## 10. Gate Result Contract

```typescript
export type PlanSafetyGateDecision =
  | "BLOCK"
  | "BLOCK_OR_HUMAN_REVIEW"
  | "CONTINUE_WITH_OTHER_GATES"
  | "CONTINUE_WITH_OTHER_GATES_WITH_ADVISORY";

export type PlanSafetyGateState =
  | "BLOCKED_BY_SCOPE_MISMATCH"
  | "BLOCKED_BY_CAPABILITY"
  | "BLOCKED_BY_CONSENT"
  | "BLOCKED_BY_MINOR_GUARDIAN_CONSENT"
  | "BLOCKED_BY_INSUFFICIENT_DATA"
  | "BLOCKED_BY_RULE_SPEC_SAFETY_HARD_STOP"
  | "NEEDS_COACH_CLARIFICATION"
  | "CONTINUE_SAFETY_PRECHECK";

export interface PlanSafetyGateResult {
  tenantId: TenantId;
  groupId: GroupId;
  athleteId: AthleteId;
  planRequestId: PlanRequestId;
  validationRunId?: ValidationRunId;
  ruleRef?: "RULE_SPEC_D1_D9.D-9";
  decision: PlanSafetyGateDecision;
  state: PlanSafetyGateState;
  planGenerationAllowed: boolean;
  templateLibraryQueryAllowed: boolean;
  requiresHumanReview: boolean;
  nonSensitiveReasonCodes: readonly string[];
  advisoryReasonCodes: readonly string[];
  requiredNextAction:
    | "HUMAN_REVIEW"
    | "MORE_INFO_OR_HUMAN_REVIEW"
    | "CONTINUE_SAFETY_PRECHECK"
    | "CONTINUE_SAFETY_PRECHECK_WITH_COACH_ADVISORY_VISIBLE";
  auditLogId: AuditLogId;
  generatedAt: ISO8601;
}
```

`templateLibraryQueryAllowed` must be `false` whenever `planGenerationAllowed` is `false`.

---

## 11. Blocked Output Policy

```yaml
allowed_output_when_blocked:
  - state
  - decision
  - planGenerationAllowed
  - templateLibraryQueryAllowed
  - requiresHumanReview
  - nonSensitiveReasonCodes
  - requiredNextAction
  - auditLogId

forbidden_output_when_blocked:
  - plan_options
  - planned_sessions
  - progression_recommendations
  - hidden_alternative_plan
  - template_based_alternative_plan
  - rationale_text_with_private_athlete_data
  - raw_athlete_free_text
  - symptom_clause
  - evidence_clause
  - injury_description
  - medical_note
  - rehab_note
  - guardian_private_note
```

When blocked by `ACTIVE` or `UNKNOWN`, the product may show a non-sensitive state and next action. It must not generate a fallback plan in the background.

---

## 12. Template And Physio Boundary

```yaml
template_boundary:
  may_query_template_library_only_after_safety_gate_allows_generation: true
  safety_gate_owns_query_permission_only: true
  template_lifecycle_policy_remains_owned_by_TEMPLATE_LIBRARY_SPEC: true
  template_selection_cannot_clear_D9_risk: true
  template_eligibility_cannot_override_ACTIVE_or_UNKNOWN: true

physio_boundary:
  good_physio_data_cannot_clear_D9_risk: true
  poor_missing_or_conflicting_physio_data_may_raise_review_or_block_state: true
  final_physio_consumption_patch_required_in_targets:
    - specs/active/PLAN_GENERATOR_SPEC.md
    - specs/active/APP_IMPLEMENTATION_BRIDGE.md
    - specs/active/ATHLETE_PROFILE_SPEC.md
```

This Safety Gate can consume physio-source status as a downstream precheck, but it does not close physio-source issues by itself.

---

## 13. Runtime Evidence Policy

This reconstructed draft does not attach actual D9 evaluator runtime output.

```yaml
runtime_evidence_policy:
  executed_tests_total: 0
  executed_tests_passed: 0
  markdown_self_check_is_not_runtime_evidence: true
  candidate_test_package_is_not_runtime_evidence: true
  actual_vitest_or_CI_log_required_for_runtime_claim: true
  target_issue_closure_allowed_now: false
```

Required before closing RVE or Plan Generator binding issues:

- actual D9 evaluator terminal or CI output
- `D9_ACTIVE` maps to RVE `ACTIVE` and Safety Gate block
- `D9_UNKNOWN` maps to RVE `UNKNOWN` and Safety Gate block or human review
- `D9_CLEARED` maps to RVE `CLEARED` and continues only with other gates
- advisory maps to RVE `CLEARED`, preserves non-sensitive advisory reason codes, and does not block
- privacy boundary is verified
- target document issue table is opened and recounted at patch time

---

## 14. Issue Closure Boundary

This document alone does not close target issues.

```yaml
not_closed_now:
  - OI-RVE-RULE-EVALUATOR-BINDING-001
  - OI-PG-RULE-SAFETY-GATE-BINDING-001
  - OI-PG-PHYSIO-SOURCE-CONSUMPTION-001
  - OI-AIB-PHYSIO-SOURCE-001
  - OI-AP-PHYSIO-SOURCE-001

closure_requires:
  - accepted_source_spec
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
| `OI-PSG-RUNTIME-EVIDENCE-001` | P1 | YES | OPEN | Actual D9 evaluator runtime output is missing. | Run local/CI evaluator tests and attach logs before runtime claims or downstream issue closure. |
| `OI-PSG-PLAN-GENERATOR-PATCH-001` | P1 | YES | OPEN | Plan Generator still has `OI-PG-RULE-SAFETY-GATE-BINDING-001` open. | Patch Plan Generator after Safety Gate acceptance, then recount the target issue table. |
| `OI-PSG-IMPLEMENTATION-BINDING-001` | P1 | YES | OPEN | No app implementation, API endpoint, or database schema has consumed this gate. | Bind Safety Gate result in implementation after SPEC acceptance. |
| `OI-PSG-PHYSIO-SOURCE-CONSUMPTION-001` | P2 | NO | OPEN | Physio source trust consumption remains unresolved in downstream targets. | Patch the named target files from `PHYSIO_SOURCE_TRUST_SPEC.md` with target-file recounts. |
| `OI-PSG-DAILY-LOG-INPUT-BINDING-001` | P2 | NO | OPEN | Daily check-in input may later feed RVE/Safety Gate, and the Daily Log contract now exists only as a reconstructed draft. | Review and accept `DAILY_LOG_AND_CHECKIN_SPEC.md`, then bind it to Safety Gate and app storage without treating reconstruction as runtime evidence. |

---

## 16. Self-Check

| Check | Status |
|---|---|
| First line is exact filename H1 | PASS |
| Metadata includes required fields | PASS |
| Status is `RECONSTRUCTED_DRAFT_FOR_REVIEW` | PASS |
| Does not claim original restored | PASS |
| Does not redefine `RULE_SPEC_D1_D9.D-9` semantics | PASS |
| Uses RVE stored statuses as downstream input | PASS |
| `ACTIVE` blocks plan generation | PASS |
| `UNKNOWN` blocks generation or routes to human review | PASS |
| `CLEARED` is not medical clearance | PASS |
| Advisory is not a fourth disposition | PASS |
| Template Library cannot clear D9 risk | PASS |
| Good physio data cannot clear D9 risk | PASS |
| Raw athlete free-text storage is forbidden | PASS |
| Runtime evidence is not claimed | PASS |
| Target issues remain open | PASS |
| Final marker is required as final line | PASS |

[DRAFT_COMPLETE]
