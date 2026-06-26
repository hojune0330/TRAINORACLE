# RULE_VALIDATION_ENGINE_CONTRACT.md

```yaml
document_metadata:
  doc_id: trainoracle-spec-011-rule-validation-engine-contract
  spec_id: RULE_VALIDATION_ENGINE_CONTRACT
  title: TrainOracle Rule Validation Engine Contract
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

`RULE_VALIDATION_ENGINE_CONTRACT.md` defines the contract boundary for TrainOracle's Rule Validation Engine (RVE).

The RVE consumes rule-layer and evaluator-layer results, stores tenant-scoped rule-validation signals, and emits privacy-safe safety signals for downstream gates. It does not own D-rule semantics.

This reconstructed draft exists because exact local search did not find an original `RULE_VALIDATION_ENGINE_CONTRACT.md` before reconstruction. It must not be treated as a restored original or approved prior version.

---

## 2. Non-Purpose

This document does not:

- redefine `RULE_SPEC_D1_D9.D-*` rule semantics
- replace `RULE_SPEC_D1_D9.md`
- treat `11_API_AND_ENGINE_CONTRACTS.md` as this contract
- implement the D9 evaluator
- claim D9 evaluator runtime PASS evidence
- close `OI-RVE-RULE-EVALUATOR-BINDING-001`
- close `OI-PG-RULE-SAFETY-GATE-BINDING-001`
- provide medical, injury, rehab, or return-to-play clearance
- permit raw athlete free-text, symptom clauses, injury narratives, medical notes, or evidence clauses in audit records

---

## 3. Source Priority

```yaml
source_priority:
  primary_rule_semantics:
    - document: specs/active/RULE_SPEC_D1_D9.md
      treatment: READ_ONLY_SEMANTIC_BASELINE
      consumed_for:
        - rule_id_namespace
        - raw_status_passthrough
        - D9_safety_hard_stop_invariants

  binding_and_signal_shape:
    - document: specs/active/RVE_RULE_EVALUATOR_BINDING_SPEC.md
      treatment: READ_ONLY_BINDING_BASELINE
      consumed_for:
        - D9_to_RVE_signal_mapping
        - advisory_mapping
        - failure_handling
        - runtime_evidence_requirement

  storage_and_audit_boundary:
    - document: specs/active/APP_IMPLEMENTATION_BRIDGE.md
      treatment: READ_ONLY_APP_BRIDGE_BASELINE
      consumed_for:
        - tenant_group_athlete_scope
        - immutable_storage
        - consent_and_capability_guards
        - audit_privacy_policy

  evaluator_candidate_reference:
    - document: specs/test-packages/D9_SAFETY_EVALUATOR_V2_1_1_TEST_PACKAGE.md
      treatment: CANDIDATE_PACKAGE_ONLY
      consumed_for:
        - expected_D9_candidate_output_shape
        - expected_runtime_test_command
        - no_runtime_PASS_until_executed

  legacy_reference_not_replacement:
    - document: specs/legacy-reference/11_API_AND_ENGINE_CONTRACTS.md
      treatment: LEGACY_PHASE_OUTPUT_REFERENCE_ONLY
      not_same_as: RULE_VALIDATION_ENGINE_CONTRACT.md
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

RVE stores references to current rule IDs as namespaced rule references. New RVE contracts must not use bare `D-9` when the current rule is meant.

---

## 5. RVE Responsibility Boundary

```yaml
rve_owns:
  - rule_validation_run_envelope
  - rule_validation_result_storage_contract
  - evaluator_signal_storage_contract
  - safety_signal_emission_to_plan_safety_gate
  - privacy_safe_reason_code_storage
  - failure_to_UNKNOWN_routing
  - audit_log_linkage

rve_does_not_own:
  - RULE_SPEC_D1_D9_rule_semantics
  - D9_evaluator_algorithm
  - Plan_Generator_generation_algorithm
  - Plan_Safety_Gate_final_policy
  - medical_clearance
  - raw_athlete_text_storage
  - canonical_promotion
```

---

## 6. Input Boundary

RVE may consume only scoped, authorized, and purpose-bound inputs.

```yaml
input_boundary:
  tenantId: required
  groupId: required
  athleteId: required
  actorUserId: required_for_mutating_or_sensitive_actions
  validationRunId: required
  sourceSnapshotId: required_when_source_derived
  ruleRef: required_namespaced_rule_ref
  consentGrantId: required_when_sensitive_input_present
  capabilityGrantId: required_for_actor_driven_evaluation
  evaluatorId: required_when_evaluator_result_used
  evaluatorVersion: required_when_evaluator_result_used

forbidden_inputs_to_persist:
  - raw_athlete_free_text
  - raw_symptom_clause
  - raw_evidence_clause
  - injury_description
  - medical_note
  - rehab_note
  - guardian_private_note
  - external_llm_prompt
```

Free text may be used transiently by a local evaluator to raise risk. It must not be stored in RVE audit records or downstream plan-generation requests.

---

## 7. Core D9 Signal Semantics

RVE consumes D9 evaluator results without redefining `RULE_SPEC_D1_D9.D-9`.

| D9 evaluator disposition / cleared subtype | RVE stored status | blocksPlanGeneration | requiresHumanReview | Meaning |
|---|---|---:|---:|---|
| `D9_ACTIVE` | `ACTIVE` | true | true | Current hard risk, red-flag condition, manual/medical hold, or active safety hard-stop signal detected. |
| `D9_UNKNOWN` | `UNKNOWN` | true | true | Ambiguous, insufficient, stale, unavailable, or concerning safety state. |
| `D9_CLEARED` | `CLEARED` | false | false | No D9 risk signal detected by the evaluator at this evaluation time only. |
| `D9_CLEARED` with advisory subtype | `CLEARED` | false | false | Non-blocking advisory subtype under `D9_CLEARED`; preserve reason codes. |

`D9_CLEARED_WITH_ADVISORY` is not a fourth disposition. It is represented as `storedStatus: CLEARED` with non-sensitive advisory reason codes.

`D9_CLEARED` is not medical clearance, injury clearance, rehab clearance, return-to-play approval, full plan approval, or high-intensity approval.

---

## 8. Failure Handling

RVE must fail safe.

```yaml
failure_handling:
  evaluator_unavailable:
    storedStatus: UNKNOWN
    blocksPlanGeneration: true
    requiresHumanReview: true
    reasonCode: RVE_D9_EVALUATOR_UNAVAILABLE

  evaluator_timeout:
    storedStatus: UNKNOWN
    blocksPlanGeneration: true
    requiresHumanReview: true
    reasonCode: RVE_D9_EVALUATOR_TIMEOUT

  evaluator_exception:
    storedStatus: UNKNOWN
    blocksPlanGeneration: true
    requiresHumanReview: true
    reasonCode: RVE_D9_EVALUATOR_EXCEPTION

  invalid_input_shape:
    storedStatus: UNKNOWN
    blocksPlanGeneration: true
    requiresHumanReview: true
    reasonCode: RVE_D9_INVALID_INPUT_SHAPE

  stale_evaluator_version:
    storedStatus: UNKNOWN
    blocksPlanGeneration: true
    requiresHumanReview: true
    reasonCode: RVE_D9_EVALUATOR_VERSION_STALE
```

Good physiological data, template selection, coach preference, or athlete request cannot clear `ACTIVE` or `UNKNOWN` D9 risk.

---

## 9. Output Signal Contract

```ts
export type ISO8601 = string;
export type TenantId = string;
export type GroupId = string;
export type AthleteId = string;
export type UserId = string;
export type ValidationRunId = string;
export type SourceSnapshotId = string;
export type AuditLogId = string;
export type ConsentGrantId = string;
export type CapabilityGrantId = string;

export type RuleRef = "RULE_SPEC_D1_D9.D-9";

export type D9EvaluatorDisposition =
  | "D9_ACTIVE"
  | "D9_UNKNOWN"
  | "D9_CLEARED";

export type D9ClearedSubtype =
  | "NO_RISK_SIGNAL"
  | "CLEARED_WITH_ADVISORY";

export type RveStoredRuleStatus =
  | "ACTIVE"
  | "UNKNOWN"
  | "CLEARED";

export interface D9EvaluatorRuntimeResult {
  disposition: D9EvaluatorDisposition;
  clearedSubtype?: D9ClearedSubtype;
  reasonCodes: readonly string[];
  evaluatorId: string;
  evaluatorVersion: string;
  generatedAt: ISO8601;
}

export interface RveRuleEvaluatorSignal {
  tenantId: TenantId;
  groupId: GroupId;
  athleteId: AthleteId;
  validationRunId: ValidationRunId;
  sourceSnapshotId?: SourceSnapshotId;
  ruleRef: RuleRef;
  evaluatorId: string;
  evaluatorVersion: string;
  storedStatus: RveStoredRuleStatus;
  blocksPlanGeneration: boolean;
  requiresHumanReview: boolean;
  nonSensitiveReasonCodes: readonly string[];
  generatedAt: ISO8601;
  expiresAt: ISO8601;
  auditLogId: AuditLogId;
}
```

The signal must contain reason codes, not raw athlete statements.

---

## 10. Audit Record Contract

```yaml
audit_record_contract:
  stores:
    - tenantId
    - groupId
    - athleteId
    - validationRunId
    - ruleRef
    - evaluatorId
    - evaluatorVersion
    - storedStatus
    - blocksPlanGeneration
    - requiresHumanReview
    - nonSensitiveReasonCodes
    - generatedAt
    - expiresAt
    - sourceSnapshotId_when_available
    - consentGrantId_when_required
    - capabilityGrantId_when_required

  must_not_store:
    - raw_free_text
    - raw_athlete_statement
    - symptom_clause
    - evidence_clause
    - injury_description
    - medical_note
    - rehab_note
    - guardian_private_note
    - external_llm_prompt

  mutability:
    audit_log_append_only: true
    signal_records_immutable_after_create: true
```

Local debug failure logs may contain redacted local-only clauses only outside production audit storage. Such clauses must not be promoted into repository SPEC evidence.

---

## 11. Binding Algorithm

```yaml
binding_algorithm:
  - validate_tenant_group_athlete_scope
  - validate_actor_capability_when_actor_driven
  - validate_consent_boundary_when_sensitive_input_present
  - run_or_consume_D9_evaluator_candidate
  - route_evaluator_unavailable_or_invalid_to_UNKNOWN
  - convert_disposition_to_RVE_storedStatus
  - derive_blocksPlanGeneration
  - derive_requiresHumanReview
  - preserve_non_sensitive_reason_codes
  - strip_or_discard_raw_text_and_sensitive_clauses
  - create_immutable_RVE_signal
  - create_append_only_audit_log
  - emit_signal_to_PLAN_SAFETY_GATE
```

---

## 12. Downstream Consumption Boundary

RVE emits signals. It does not allow downstream systems to override D9 risk.

```yaml
plan_safety_gate_consumption:
  ACTIVE:
    gate_action: BLOCK
    plan_generation_allowed: false
    required_next_action: HUMAN_REVIEW

  UNKNOWN:
    gate_action: BLOCK_OR_HUMAN_REVIEW
    plan_generation_allowed: false
    required_next_action: MORE_INFO_OR_HUMAN_REVIEW

  CLEARED:
    gate_action: CONTINUE_WITH_OTHER_GATES
    plan_generation_allowed: depends_on_other_gates
    required_next_action: CONTINUE_SAFETY_PRECHECK

plan_generator_boundary:
  must_consume_D9_through_plan_safety_gate: true
  must_not_override_ACTIVE: true
  must_not_override_UNKNOWN: true
  must_not_treat_CLEARED_as_final_plan_approval: true
  must_not_treat_CLEARED_WITH_ADVISORY_as_final_plan_approval: true
```

---

## 13. API Draft

```yaml
api_draft:
  evaluate_D9_signal:
    method: POST
    path: /rve/evaluate/D9
    returns: RveRuleEvaluatorSignal
    constraints:
      - scoped_access_required
      - consent_boundary_required_if_sensitive_input_present
      - evaluator_version_required
      - no_raw_free_text_persistence

  get_RVE_signal:
    method: GET
    path: /rve/signals/{auditLogId}
    returns: RveRuleEvaluatorSignal
    constraints:
      - scoped_access_required
      - reason_codes_only
      - no_raw_clause_returned

  evaluate_rule_batch:
    method: POST
    path: /rve/evaluate/batch
    constraints:
      - D9_failure_routes_to_UNKNOWN
      - partial_failure_is_explicit
      - no_failed_rule_silently_treated_as_CLEARED
```

---

## 14. Runtime Evidence Policy

This reconstructed draft does not attach actual evaluator execution output.

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
- all expected D9 ACTIVE / UNKNOWN / CLEARED mappings pass
- advisory maps to `CLEARED` and does not block plan generation
- RVE signal shape is verified
- privacy boundary is verified
- target document issue table is opened and recounted at patch time

---

## 15. Open Issues

These are this reconstructed document's own issues. They do not change issue counts in other SPEC files.

| ID | Priority | Canonical blocking | Status | Summary | Resolution needed |
|---|---|---:|---|---|---|
| `OI-RVEC-RUNTIME-EVIDENCE-001` | P1 | YES | OPEN | Actual D9 evaluator runtime output is missing. | Run local/CI evaluator tests and attach logs before runtime claims or downstream issue closure. |
| `OI-RVEC-PLAN-SAFETY-GATE-001` | P1 | YES | OPEN | `PLAN_SAFETY_GATE_SPEC.md` now exists only as a reconstructed draft. | Review and accept the Safety Gate contract, then bind RVE consumption without claiming runtime evidence from reconstruction alone. |
| `OI-RVEC-IMPLEMENTATION-BINDING-001` | P1 | YES | OPEN | No app implementation or database schema has consumed this contract. | Bind RVE signal storage in implementation after SPEC acceptance. |
| `OI-RVEC-RETENTION-POLICY-001` | P2 | NO | OPEN | Retention period for RVE signal and audit linkage is not final. | Align with App Bridge retention policy. |
| `OI-RVEC-ORIGINAL-SOURCE-TRACE-001` | P2 | NO | OPEN | Original file was not found before reconstruction. | If a local original appears later, compare and record provenance without silently replacing this draft. |

---

## 16. Self-Check

| Check | Status |
|---|---|
| First line is exact filename H1 | PASS |
| Metadata includes required fields | PASS |
| Status is `RECONSTRUCTED_DRAFT_FOR_REVIEW` | PASS |
| Does not claim original restored | PASS |
| Does not use `11_API_AND_ENGINE_CONTRACTS.md` as replacement | PASS |
| Does not redefine `RULE_SPEC_D1_D9.D-9` semantics | PASS |
| `D9_ACTIVE` blocks plan generation | PASS |
| `D9_UNKNOWN` blocks or requires human review | PASS |
| `D9_CLEARED` is not medical clearance | PASS |
| Advisory is not a fourth disposition | PASS |
| Raw athlete free-text storage forbidden | PASS |
| Runtime evidence not claimed | PASS |
| Target issues remain open | PASS |
| Final marker is required as final line | PASS |

[DRAFT_COMPLETE]
