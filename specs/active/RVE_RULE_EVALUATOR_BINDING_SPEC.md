# RVE_RULE_EVALUATOR_BINDING_SPEC.md

```yaml
document_metadata:
  doc_id: trainoracle-spec-010-rve-rule-evaluator-binding
  spec_id: RVE_RULE_EVALUATOR_BINDING_SPEC
  title: TrainOracle RVE Rule Evaluator Binding Spec
  version: "1.0"
  round: RT1
  status: DRAFT_FOR_REVIEW
  owner: COACH_HOJUNE
  owner_english_name: hojune jang

  target_downstream_documents:
    - RULE_VALIDATION_ENGINE_CONTRACT.md
    - PLAN_SAFETY_GATE_SPEC.md
    - PLAN_GENERATOR_SPEC.md

  target_downstream_issues:
    - OI-RVE-RULE-EVALUATOR-BINDING-001
    - OI-PG-RULE-SAFETY-GATE-BINDING-001

  open_issues_total: 4
  canonical_blocking_count: 0

  executed_tests_total: 0
  executed_tests_passed: 0

  self_check_items_total: 36
  self_check_items_satisfied: 36

binding_evidence_status:
  implementation_candidate_defined: true
  actual_runtime_execution_evidence_attached: false
  may_close_target_issues_now: false
  closure_requires_actual_test_output: true

count_policy:
  executed_tests_total: "실제 코드 실행 또는 런타임 테스트만 집계한다."
  executed_tests_passed: "실제 실행된 테스트 중 통과한 항목만 집계한다."
  self_check_items_total: "문서 정합성 검토 항목만 집계한다."
  self_check_items_satisfied: "문서 정합성 검토에서 만족한 항목만 집계한다."
  self_check_is_not_runtime_test_evidence: true
  do_not_claim_runtime_pass_without_execution: true
  do_not_claim_issue_closure_without_actual_execution_evidence: true
```

---

## 1. Purpose

`RVE_RULE_EVALUATOR_BINDING_SPEC.md`는 TrainOracle에서 D9 safety evaluator의 결과를 Rule Validation Engine, Plan Safety Gate, Plan Generator가 어떻게 소비해야 하는지 정의한다.

이 문서는 다음을 정의한다.

- D9 evaluator output contract
- RVE rule-evaluation signal contract
- ACTIVE / UNKNOWN / CLEARED routing semantics
- D9_CLEARED_WITH_ADVISORY 하위 의미 처리
- Plan Safety Gate binding behavior
- Plan Generator blocking behavior
- privacy-safe evidence storage
- evaluator unavailable / failed / stale 처리
- 실제 실행 증거가 있어야 target issue를 닫을 수 있다는 조건

---

## 2. Non-Purpose

이 문서는 다음을 하지 않는다.

- D9 evaluator 코드를 새로 구현하지 않는다.
- Vitest 실행 PASS를 주장하지 않는다.
- 의료 진단을 하지 않는다.
- 부상, 질병, 재활 복귀 허가를 판정하지 않는다.
- `RULE_SPEC_D1_D9.md`의 규칙 의미를 재정의하지 않는다.
- Plan Generator의 전체 생성 알고리즘을 재작성하지 않는다.
- 선수 자유서술 원문을 저장하지 않는다.
- raw symptom clause를 audit record에 저장하지 않는다.
- canonical promotion을 주장하지 않는다.

---

## 3. Upstream Reference Documents

```yaml
upstream_references:
  - document: RULE_SPEC_D1_D9.md
    expected_version: ">=1.4"
    consumed_for:
      - D9_rule_reference
      - safety_hard_stop_semantics
      - rule_id_consistency

  - document: RULE_VALIDATION_ENGINE_CONTRACT.md
    expected_version: ">=RT4"
    consumed_for:
      - rule_validation_signal_shape
      - evaluator_binding_issue_target

  - document: PLAN_SAFETY_GATE_SPEC.md
    expected_version: ">=RT5"
    consumed_for:
      - safety_gate_blocking_semantics
      - pre_generation_safety_routing

  - document: PLAN_GENERATOR_SPEC.md
    expected_version: ">=1.0"
    consumed_for:
      - plan_generation_block_state
      - target_issue_OI_PG_RULE_SAFETY_GATE_BINDING

  - document: APP_IMPLEMENTATION_BRIDGE.md
    expected_version: ">=1.1"
    consumed_for:
      - audit_boundary
      - tenant_scope
      - consent_boundary
      - storage_policy

  - document: DAILY_LOG_AND_CHECKIN_SPEC.md
    expected_status: ACCEPTED_AS_WORKING_SOURCE
    decision_document: SPEC_SOURCE_ACCEPTANCE_DECISION_ROUND2.md
    consumed_for:
      - structured_daily_checkin_signal_boundary
      - transient_free_text_risk_raising_only_policy
      - OI-DLC-RVE-SAFETY-BINDING-001_source_issue

  - document: D9_SAFETY_EVALUATOR_V2_1_1_TEST_PACKAGE.md
    expected_status: IMPLEMENTATION_CANDIDATE_READY_FOR_LOCAL_TEST
    consumed_for:
      - evaluator_candidate_version_reference
      - expected_test_evidence_source
```

---

## 4. Dependency Direction

```yaml
rve_rule_evaluator_binding_consumes:
  - D9_rule_reference
  - D9_evaluator_candidate_result
  - tenant_group_athlete_scope
  - consent_and_guardian_status
  - app_bridge_audit_policy
  - plan_safety_gate_blocking_contract

rve_rule_evaluator_binding_provides:
  - rule_evaluator_output_contract
  - RVE_signal_contract
  - advisory_reason_code_mapping_contract
  - safety_gate_routing_contract
  - plan_generator_blocking_contract
  - privacy_safe_evidence_policy
  - execution_evidence_acceptance_policy

rve_rule_evaluator_binding_does_not_provide:
  - medical_diagnosis
  - raw_free_text_storage
  - D9_rule_redefinition
  - plan_generation_algorithm
  - canonical_promotion
```

---

## 5. Hard Constraints

```yaml
hard_constraints:
  no_D9_rule_semantic_redefinition: true
  no_rule_threshold_definition: true
  no_safety_hard_stop_override: true
  no_free_text_clearance_of_existing_risk: true
  no_good_physio_clearance_of_D9_risk: true
  no_template_library_clearance_of_D9_risk: true
  no_external_llm_with_private_athlete_data: true
  no_raw_free_text_storage: true
  no_raw_symptom_clause_storage: true
  no_evidence_clause_storage_in_audit: true
  no_claimed_runtime_pass_without_actual_execution_log: true
  no_issue_closure_without_actual_execution_evidence: true
```

D9 evaluator는 위험을 해제하는 장치가 아니다.  
D9 evaluator는 위험 신호를 `ACTIVE` 또는 `UNKNOWN`으로 올리고, 안전하게 처리할 수 있을 때만 `CLEARED`를 반환한다.

`ADVISORY`는 별도 4번째 disposition이 아니다.  
`D9_CLEARED`의 하위 의미로만 보존한다.

```yaml
safety_default:
  evaluator_error: D9_UNKNOWN
  evaluator_unavailable: D9_UNKNOWN
  evaluator_timeout: D9_UNKNOWN
  ambiguous_input: D9_UNKNOWN
  insufficient_input_for_safety: D9_UNKNOWN
  active_red_flag: D9_ACTIVE
  advisory_signal_without_blocking_risk: D9_CLEARED_WITH_ADVISORY
```

---

## 6. Core Status Semantics

| D9 Evaluator Disposition / Semantic Subtype | Meaning | RVE Stored Status | Plan Safety Gate Action | Plan Generator Action |
|---|---|---|---|---|
| D9_ACTIVE | Current hard risk or red-flag condition detected | ACTIVE | BLOCK | BLOCK_PLAN_GENERATION |
| D9_UNKNOWN | Ambiguous, insufficient, concerning, evaluator unavailable, or review-required state | UNKNOWN | BLOCK_OR_HUMAN_REVIEW | NEEDS_COACH_CLARIFICATION or BLOCK |
| D9_CLEARED | No D9 colloquial or structured safety risk detected by evaluator | CLEARED | CONTINUE_WITH_OTHER_GATES | Continue only if all other gates pass |
| D9_CLEARED_WITH_ADVISORY | Semantic subtype of D9_CLEARED; no blocking D9 risk, but advisory reasonCode exists | CLEARED | CONTINUE_WITH_OTHER_GATES | Continue only if all other gates pass; preserve advisory reasonCodes |

```yaml
status_semantics:
  D9_ACTIVE:
    blocks_plan_generation: true
    human_review_required: true
    may_be_cleared_by_free_text: false

  D9_UNKNOWN:
    blocks_plan_generation: true
    human_review_or_more_info_required: true
    may_be_treated_as_safe: false

  D9_CLEARED:
    blocks_plan_generation: false
    means_only: "No D9 risk signal detected by this evaluator at this evaluation time."
    does_not_mean:
      - medical_clearance
      - injury_clearance
      - rehab_clearance
      - full_plan_approval

  D9_CLEARED_WITH_ADVISORY:
    not_a_fourth_disposition: true
    parent_disposition: D9_CLEARED
    storedStatus: CLEARED
    blocks_plan_generation: false
    requiresHumanReview: false
    advisory_reason_codes_preserved: true
    coach_advisory_visible: true
    means_only: "No blocking D9 risk detected, but weak non-blocking advisory signal exists."
    must_not_mean:
      - medical_clearance
      - injury_clearance
      - pain_is_safe
      - high_intensity_approval
```

---

## 7. Evaluator Candidate Reference

```yaml
evaluator_candidate:
  candidate_name: D9_SAFETY_EVALUATOR_V2_1_1
  source_package: D9_SAFETY_EVALUATOR_V2_1_1_TEST_PACKAGE.md
  expected_executable_file_when_extracted: d9-safety-evaluator.vitest.ts
  candidate_status: READY_FOR_LOCAL_TEST
  actual_execution_status: NOT_EXECUTED_IN_THIS_DOCUMENT
  actual_execution_evidence_required_for_closure: true
```

이 문서는 evaluator candidate를 참조하지만, 실제 실행 결과를 주장하지 않는다.

```yaml
runtime_claim_policy:
  this_document_claims_vitest_pass: false
  this_document_attaches_actual_test_log: false
  target_issue_closure_requires_actual_vitest_output: true
```

---

## 8. RVE Signal Contract

RVE는 D9 evaluator 결과를 다음 형태로 저장해야 한다.  
이 섹션의 `RveRuleEvaluatorSignal`은 Section 19 TypeScript Contract와 동일한 정본 필드셋을 사용한다.

```ts
export type TenantId = string;
export type GroupId = string;
export type AthleteId = string;
export type AuditLogId = string;
export type ISO8601 = string;

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

export interface RveRuleEvaluatorSignal {
  tenantId: TenantId;
  groupId: GroupId;
  athleteId: AthleteId;
  ruleRef: RuleRef;
  evaluatorId: string;
  evaluatorVersion: string;
  storedStatus: RveStoredRuleStatus;
  blocksPlanGeneration: boolean;
  requiresHumanReview: boolean;
  nonSensitiveReasonCodes: string[];
  generatedAt: ISO8601;
  expiresAt: ISO8601;
  auditLogId: AuditLogId;
}
```

`CLEARED_WITH_ADVISORY`는 `D9EvaluatorDisposition`에 추가하지 않는다.  
이는 `D9_CLEARED`의 하위 의미이며, RVE에는 `storedStatus: CLEARED`와 advisory reasonCode로 보존한다.

금지되는 저장 필드는 다음과 같다.

```yaml
forbidden_storage_fields:
  - raw_freeText
  - raw_athlete_statement
  - symptom_clause
  - evidence_clause
  - injury_description
  - medical_note
  - rehab_note
  - guardian_private_note
  - external_llm_prompt
```

---

## 9. Evaluator Input Boundary

D9 evaluator 입력은 runtime processing boundary 안에서만 다뤄야 한다.

```yaml
allowed_runtime_inputs:
  - scoped_athlete_safety_free_text
  - structured_safety_status
  - current_symptom_flags
  - recent_session_context_refs
  - consent_and_scope_context

storage_policy_for_inputs:
  raw_free_text_persistence_allowed: false
  symptom_clause_persistence_allowed: false
  local_debug_log_allowed_only_in_non_production: true
  production_audit_must_use_reason_codes_only: true
```

free-text는 위험을 올릴 수는 있지만, 기존 위험을 해제할 수 없다.

```yaml
free_text_policy:
  free_text_can_raise_risk: true
  free_text_can_request_review: true
  free_text_cannot_clear_existing_D9_ACTIVE: true
  free_text_cannot_clear_existing_D9_UNKNOWN: true
  advisory_free_text_cannot_clear_existing_risk: true
```

---

## 10. Binding Algorithm

RVE binding은 다음 순서를 따른다.

```yaml
binding_algorithm_order:
  - validate_tenant_group_athlete_scope
  - validate_consent_boundary_if_sensitive_input_present
  - run_D9_evaluator_or_return_UNKNOWN_if_unavailable
  - convert_evaluator_disposition_to_RVE_stored_status
  - preserve_advisory_reason_codes_when_parent_disposition_is_CLEARED
  - derive_blocksPlanGeneration
  - derive_requiresHumanReview
  - strip_sensitive_evidence
  - store_reason_codes_only
  - emit_RVE_signal_to_safety_gate
  - audit_signal_creation
```

```yaml
disposition_to_signal_mapping:
  D9_ACTIVE:
    storedStatus: ACTIVE
    blocksPlanGeneration: true
    requiresHumanReview: true

  D9_UNKNOWN:
    storedStatus: UNKNOWN
    blocksPlanGeneration: true
    requiresHumanReview: true

  D9_CLEARED:
    storedStatus: CLEARED
    blocksPlanGeneration: false
    requiresHumanReview: false

  D9_CLEARED_WITH_ADVISORY:
    not_a_fourth_disposition: true
    parent_disposition: D9_CLEARED
    storedStatus: CLEARED
    blocksPlanGeneration: false
    requiresHumanReview: false
    preserveReasonCodes: true
    allowed_reason_code_prefix:
      - RVE_D9_ADVISORY_
```

---

## 11. Evaluator Failure Handling

Evaluator failure must fail safe.

```yaml
evaluator_failure_handling:
  evaluator_unavailable:
    disposition: D9_UNKNOWN
    reasonCode: RVE_D9_EVALUATOR_UNAVAILABLE
    blocksPlanGeneration: true

  evaluator_timeout:
    disposition: D9_UNKNOWN
    reasonCode: RVE_D9_EVALUATOR_TIMEOUT
    blocksPlanGeneration: true

  evaluator_exception:
    disposition: D9_UNKNOWN
    reasonCode: RVE_D9_EVALUATOR_EXCEPTION
    blocksPlanGeneration: true

  invalid_input_shape:
    disposition: D9_UNKNOWN
    reasonCode: RVE_D9_INVALID_INPUT_SHAPE
    blocksPlanGeneration: true

  stale_evaluator_version:
    disposition: D9_UNKNOWN
    reasonCode: RVE_D9_EVALUATOR_VERSION_STALE
    blocksPlanGeneration: true
```

---

## 12. Plan Safety Gate Consumption

Plan Safety Gate는 RVE signal을 다음처럼 소비한다.

```yaml
plan_safety_gate_consumption:
  if_RVE_signal_status_ACTIVE:
    gate_action: BLOCK
    plan_generation_allowed: false
    required_next_action: HUMAN_REVIEW

  if_RVE_signal_status_UNKNOWN:
    gate_action: BLOCK_OR_HUMAN_REVIEW
    plan_generation_allowed: false
    required_next_action: MORE_INFO_OR_HUMAN_REVIEW

  if_RVE_signal_status_CLEARED:
    gate_action: CONTINUE_WITH_OTHER_GATES
    plan_generation_allowed: depends_on_other_gates
    required_next_action: CONTINUE_SAFETY_PRECHECK

  if_RVE_signal_status_CLEARED_with_advisory_reason_codes:
    gate_action: CONTINUE_WITH_OTHER_GATES
    plan_generation_allowed: depends_on_other_gates
    required_next_action: CONTINUE_SAFETY_PRECHECK_WITH_COACH_ADVISORY_VISIBLE
```

`CLEARED`는 전체 안전 승인 또는 훈련 승인과 같지 않다.  

---

## 12A. Daily Log Structured Input Boundary

Daily Log / Daily Check-in signals may feed RVE only as structured, privacy-safe context.

```yaml
daily_log_rve_binding:
  source_document: specs/reconstruct/DAILY_LOG_AND_CHECKIN_SPEC.md
  source_decision_document: SPEC_SOURCE_ACCEPTANCE_DECISION_ROUND2.md
  source_decision: ACCEPTED_AS_WORKING_SOURCE
  source_issue: OI-DLC-RVE-SAFETY-BINDING-001
  target_patch_status: PATCHED_BUT_NOT_CLOSED
  target_recount_status: RECOUNTED_IN_WAVE_D

  allowed_inputs:
    - structured_daily_checkin_fields
    - structured_body_area_signals
    - structured_readiness_state
    - nonSensitiveReasonCodes
    - sourceSnapshotId

  forbidden_inputs:
    - raw_memo_text
    - raw_athlete_free_text
    - raw_symptom_clause
    - injury_narrative
    - medical_note
    - rehab_note
    - guardian_private_note
    - external_llm_prompt_with_private_athlete_data

  safety_boundary:
    may_raise_to_UNKNOWN_or_review: true
    may_add_non_sensitive_reason_codes: true
    may_clear_D9_ACTIVE: false
    may_clear_D9_UNKNOWN: false
    may_clear_existing_Safety_Gate_block: false
    good_daily_checkin_values_can_create_medical_clearance: false
```

`OI-DLC-RVE-SAFETY-BINDING-001` is a Daily Log source issue consumed by this target-local addendum. It is not added as a Section 20 issue row in this document, so this document's own open issue count remains 4 and canonical blocking count remains 0.
`CLEARED_WITH_ADVISORY`도 전체 안전 승인 또는 고강도 승인과 같지 않다.

---

## 13. Plan Generator Consumption

Plan Generator는 Safety Gate 결과를 통해서만 D9/RVE binding 결과를 소비한다.

```yaml
plan_generator_consumption:
  may_consume_RVE_signal_directly_for_audit_context: true
  must_not_bypass_plan_safety_gate: true
  must_not_override_ACTIVE: true
  must_not_override_UNKNOWN: true
  must_not_treat_CLEARED_as_final_plan_approval: true
  must_not_treat_CLEARED_WITH_ADVISORY_as_final_plan_approval: true

  if_safety_gate_blocks_due_to_D9_ACTIVE:
    planGenerationState: BLOCKED_BY_RULE_SPEC_SAFETY_HARD_STOP

  if_safety_gate_blocks_due_to_D9_UNKNOWN:
    planGenerationState: NEEDS_COACH_CLARIFICATION

  if_safety_gate_continues_after_D9_CLEARED:
    planGenerationState: depends_on_remaining_prechecks

  if_safety_gate_continues_after_D9_CLEARED_WITH_ADVISORY:
    planGenerationState: depends_on_remaining_prechecks
    advisory_reason_codes_may_be_visible_to_coach: true
```

---

## 14. Reason Codes

```yaml
reason_codes:
  active:
    - RVE_D9_ACTIVE_RED_FLAG_SYMPTOM
    - RVE_D9_ACTIVE_ACUTE_INJURY_SIGNAL
    - RVE_D9_ACTIVE_FUNCTION_LIMITATION
    - RVE_D9_ACTIVE_MEDICAL_RED_FLAG
    - RVE_D9_ACTIVE_REHAB_NOT_CLEARED

  unknown:
    - RVE_D9_UNKNOWN_AMBIGUOUS_SAFETY_TEXT
    - RVE_D9_UNKNOWN_INSUFFICIENT_CONTEXT
    - RVE_D9_UNKNOWN_REVIEW_REQUIRED
    - RVE_D9_UNKNOWN_RISK_MASKING_LANGUAGE
    - RVE_D9_UNKNOWN_EVALUATOR_UNAVAILABLE
    - RVE_D9_UNKNOWN_EVALUATOR_TIMEOUT
    - RVE_D9_UNKNOWN_INVALID_INPUT_SHAPE

  cleared:
    - RVE_D9_CLEARED_NO_COLLOQUIAL_RISK_SIGNAL

  advisory:
    parent_disposition: D9_CLEARED
    storedStatus: CLEARED
    blocksPlanGeneration: false
    requiresHumanReview: false
    reason_codes:
      - RVE_D9_ADVISORY_UNLOCALIZED_DISCOMFORT
      - RVE_D9_ADVISORY_WEAK_PAIN_SIGNAL
```

Reason codes must be non-sensitive and must not contain raw athlete words.  
Advisory reason codes are preserved only as non-blocking reason codes under `D9_CLEARED`.

---

## 15. Privacy and Audit Policy

```yaml
privacy_policy:
  audit_signal_may_store:
    - tenantId
    - groupId
    - athleteId
    - ruleRef
    - evaluatorId
    - evaluatorVersion
    - storedStatus
    - blocksPlanGeneration
    - requiresHumanReview
    - nonSensitiveReasonCodes
    - generatedAt
    - expiresAt
    - auditLogId

  audit_signal_must_not_store:
    - raw_freeText
    - raw_athlete_statement
    - symptom_clause
    - evidence_clause
    - injury_description
    - medical_note
    - rehab_note
    - guardian_private_note
    - external_llm_prompt

  debug_clause_storage:
    production_allowed: false
    local_test_allowed: true
    must_not_be_promoted_to_audit: true
```

---

## 16. Execution Evidence Requirement

Target issues cannot be closed by this spec alone.

```yaml
closure_evidence_required:
  actual_vitest_execution_output: true
  all_tests_passed: true
  adapter_mapping_passed: true
  no_failed_cases: true
  no_runtime_exception: true
  evaluator_version_logged: true
  RVE_signal_shape_verified: true
  advisory_to_CLEARED_mapping_verified: true
  privacy_storage_boundary_verified: true
```

Accepted evidence source:

```yaml
accepted_execution_evidence:
  preferred:
    - actual_vitest_terminal_output
    - CI_test_run_artifact
    - developer_submitted_failure_or_pass_log

  not_accepted_as_execution_evidence:
    - hand_tracing
    - speculative_regex_reasoning
    - copied_code_without_execution
    - self_check_table
    - markdown_claim_of_PASS
```

---

## 17. Failure Log Contract

If runtime tests fail, failure logs must use this shape.

```yaml
failed_case:
  test_name:
  input:
  expected:
  actual_disposition:
  actual_reasonCodes:
  actual_evidence:
    - ruleId:
      route:
      reasonCode:
      clause_allowed_only_in_local_debug: true
```

Production audit must not store the clause.

---

## 18. API Draft

```yaml
api_draft:
  evaluate_rule_D9:
    method: POST
    path: /rve/evaluate/D9
    constraints:
      - scoped_access_required
      - consent_boundary_required_if_sensitive_input
      - no_raw_free_text_persistence
      - evaluator_version_required
    returns:
      - RveRuleEvaluatorSignal

  get_rule_evaluation_signal:
    method: GET
    path: /rve/signals/{auditLogId}
    constraints:
      - scoped_access_only
      - returns_reason_codes_only
      - no_raw_clause_returned

  submit_rule_evaluation_batch:
    method: POST
    path: /rve/evaluate/batch
    constraints:
      - D9_must_fail_safe
      - partial_failure_routes_to_UNKNOWN_for_failed_rule
```

---

## 19. TypeScript Contract Draft

```ts
export type TenantId = string;
export type GroupId = string;
export type AthleteId = string;
export type AuditLogId = string;
export type ISO8601 = string;

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
  reasonCodes: string[];
  evaluatorId: string;
  evaluatorVersion: string;
  generatedAt: ISO8601;
}

export interface RveRuleEvaluatorSignal {
  tenantId: TenantId;
  groupId: GroupId;
  athleteId: AthleteId;
  ruleRef: RuleRef;
  evaluatorId: string;
  evaluatorVersion: string;
  storedStatus: RveStoredRuleStatus;
  blocksPlanGeneration: boolean;
  requiresHumanReview: boolean;
  nonSensitiveReasonCodes: string[];
  generatedAt: ISO8601;
  expiresAt: ISO8601;
  auditLogId: AuditLogId;
}

export interface RveD9EvaluationRequest {
  tenantId: TenantId;
  groupId: GroupId;
  athleteId: AthleteId;
  runtimeFreeText?: string;
  structuredSafetyFlags?: string[];
  consentContextRef: string;
  requestedAt: ISO8601;
}
```

Type invariants:

```yaml
typescript_invariants:
  D9_CLEARED_WITH_ADVISORY_is_not_D9EvaluatorDisposition: true
  clearedSubtype_allowed_only_when_disposition_is_D9_CLEARED: true
  advisory_reason_codes_preserved_in_nonSensitiveReasonCodes: true
  RveRuleEvaluatorSignal_section_8_and_19_fieldsets_match: true
```

---

## 20. Open Issues

| Open Issue ID | Status | Canonical Blocking | Description | Closure Condition |
|---|---|---:|---|---|
| OI-REB-PROD-DEPLOYMENT-WIRING-001 | OPEN | NO | Production service wiring is not defined. | Add deployment wiring after implementation stack decision |
| OI-REB-MULTILINGUAL-RISK-TOKENS-001 | OPEN | NO | Multilingual colloquial safety token expansion is not finalized. | Add language packs after Korean v2.1.1 validation |
| OI-REB-UI-REVIEW-COPY-001 | OPEN | NO | Coach-facing review copy is not finalized. | UI copy review completed |
| OI-REB-PERFORMANCE-MONITORING-001 | OPEN | NO | Evaluator latency and monitoring thresholds are not defined. | Add performance monitoring policy |

Daily Log safety binding issue addendum:

```yaml
OI-DLC-RVE-SAFETY-BINDING-001:
  status: OPEN
  source_document: specs/reconstruct/DAILY_LOG_AND_CHECKIN_SPEC.md
  source_decision_document: SPEC_SOURCE_ACCEPTANCE_DECISION_ROUND2.md
  source_decision: ACCEPTED_AS_WORKING_SOURCE
  target_patch_status: PATCHED_BUT_NOT_CLOSED
  target_recount_status: RECOUNTED_IN_WAVE_D
  counted_in_section_20_open_issue_table: false
  closure_allowed_now: false
  closure_requires:
    - implementation/runtime evidence proving structured-only RVE/Safety Gate routing
    - privacy review proving raw memo/free-text is transient only
    - owner approval for downstream closure
```

```yaml
open_issue_count_validation:
  open_issues_total_declared: 4
  open_issue_rows_in_section_20: 4
  canonical_blocking_count_declared: 0
  canonical_blocking_rows_with_yes: 0
  status: SATISFIED
```

---

## 21. Acceptance Conditions

```yaml
acceptance_conditions:
  - D9_status_semantics_are_defined
  - D9_CLEARED_WITH_ADVISORY_is_defined_as_CLEARED_subtype
  - advisory_reason_codes_map_to_CLEARED_without_blocking
  - RVE_signal_contract_is_defined
  - Section_8_and_Section_19_signal_contracts_are_aligned
  - ACTIVE_blocks_plan_generation
  - UNKNOWN_blocks_or_routes_to_human_review
  - CLEARED_does_not_mean_medical_clearance
  - evaluator_failure_fails_safe_to_UNKNOWN
  - raw_free_text_storage_is_forbidden
  - reason_code_storage_policy_is_defined
  - actual_execution_evidence_required_for_target_issue_closure
  - downstream_delta_is_relative_only
```

---

## 22. Self-Check Items, Not Executed Tests

```yaml
self_check_annotation:
  executed_tests_run: false
  self_check_is_runtime_test: false
  groups:
    metadata_and_counting: 4
    binding_contract: 6
    safety_semantics: 6
    privacy_storage: 5
    adapter_mapping: 5
    execution_evidence: 5
    downstream_delta_and_closure: 5
  total: 36
```

| ID | Group | Check | Status |
|---|---|---|---|
| SC-REB-001 | metadata_and_counting | Required metadata exists | SATISFIED |
| SC-REB-002 | metadata_and_counting | Executed tests are declared as 0/0 | SATISFIED |
| SC-REB-003 | metadata_and_counting | Self-check is separated from runtime evidence | SATISFIED |
| SC-REB-004 | metadata_and_counting | Open issue counts are declared | SATISFIED |
| SC-REB-005 | binding_contract | D9 evaluator candidate is referenced | SATISFIED |
| SC-REB-006 | binding_contract | RVE signal contract is defined | SATISFIED |
| SC-REB-007 | binding_contract | Evaluator version is required | SATISFIED |
| SC-REB-008 | binding_contract | RuleRef is explicit | SATISFIED |
| SC-REB-009 | binding_contract | RVE stored status values are defined | SATISFIED |
| SC-REB-010 | binding_contract | Section 8 and Section 19 signal contracts are aligned | SATISFIED |
| SC-REB-011 | safety_semantics | ACTIVE blocks plan generation | SATISFIED |
| SC-REB-012 | safety_semantics | UNKNOWN blocks or routes to human review | SATISFIED |
| SC-REB-013 | safety_semantics | CLEARED is not medical clearance | SATISFIED |
| SC-REB-014 | safety_semantics | Evaluator unavailable fails safe | SATISFIED |
| SC-REB-015 | safety_semantics | Free text cannot clear existing risk | SATISFIED |
| SC-REB-016 | safety_semantics | D9_CLEARED_WITH_ADVISORY maps to CLEARED without blocking | SATISFIED |
| SC-REB-017 | privacy_storage | Raw free-text storage is forbidden | SATISFIED |
| SC-REB-018 | privacy_storage | Symptom clause storage is forbidden | SATISFIED |
| SC-REB-019 | privacy_storage | Audit stores reason codes only | SATISFIED |
| SC-REB-020 | privacy_storage | External LLM prompt storage is forbidden | SATISFIED |
| SC-REB-021 | privacy_storage | Local debug clause cannot become audit evidence | SATISFIED |
| SC-REB-022 | adapter_mapping | D9_ACTIVE maps to ACTIVE | SATISFIED |
| SC-REB-023 | adapter_mapping | D9_UNKNOWN maps to UNKNOWN | SATISFIED |
| SC-REB-024 | adapter_mapping | D9_CLEARED including advisory maps to CLEARED | SATISFIED |
| SC-REB-025 | adapter_mapping | Plan Generator consumes via Safety Gate | SATISFIED |
| SC-REB-026 | adapter_mapping | No Safety Gate bypass is allowed | SATISFIED |
| SC-REB-027 | execution_evidence | Actual Vitest output is required for closure | SATISFIED |
| SC-REB-028 | execution_evidence | Hand tracing is not accepted as execution evidence | SATISFIED |
| SC-REB-029 | execution_evidence | Failure log format is defined | SATISFIED |
| SC-REB-030 | execution_evidence | Runtime pass is not claimed | SATISFIED |
| SC-REB-031 | execution_evidence | Adapter mapping pass is required | SATISFIED |
| SC-REB-032 | downstream_delta_and_closure | Target downstream issues are referenced | SATISFIED |
| SC-REB-033 | downstream_delta_and_closure | Relative delta only policy is used | SATISFIED |
| SC-REB-034 | downstream_delta_and_closure | This document has zero canonical blockers | SATISFIED |
| SC-REB-035 | downstream_delta_and_closure | Target issues are not closed now | SATISFIED |
| SC-REB-036 | downstream_delta_and_closure | Final marker rule is defined | SATISFIED |

---

## 23. Self-Validation

```yaml
self_validation:
  metadata_block_present: SATISFIED
  purpose_section_present: SATISFIED
  non_purpose_section_present: SATISFIED
  upstream_references_present: SATISFIED
  dependency_direction_present: SATISFIED
  hard_constraints_present: SATISFIED
  status_semantics_present: SATISFIED
  D9_CLEARED_WITH_ADVISORY_semantics_present: SATISFIED
  advisory_reason_codes_map_to_CLEARED: SATISFIED
  evaluator_candidate_reference_present: SATISFIED
  RVE_signal_contract_present: SATISFIED
  section_8_and_19_signal_contracts_aligned: SATISFIED
  failure_handling_present: SATISFIED
  safety_gate_consumption_present: SATISFIED
  plan_generator_consumption_present: SATISFIED
  privacy_storage_policy_present: SATISFIED
  execution_evidence_requirement_present: SATISFIED
  open_issues_total_matches_rows: SATISFIED
  canonical_blocking_count_matches_rows: SATISFIED
  self_check_item_total_matches_annotations: SATISFIED
  self_check_item_table_rows_36: SATISFIED
  executed_tests_not_claimed: SATISFIED
  target_issues_not_falsely_closed: SATISFIED
  downstream_absolute_count_not_declared: SATISFIED
  storage_header_footer: SATISFIED
```

---

## 24. Expected Delta For Target Documents

이 섹션의 델타는 `RVE_RULE_EVALUATOR_BINDING_SPEC.md` 자체에 적용하지 않는다.  
대상 문서의 절대 open issue count는 이 문서에서 단정하지 않는다.

```yaml
expected_delta_for_target_documents:
  target_1:
    target_document: RULE_VALIDATION_ENGINE_CONTRACT.md
    target_issue: OI-RVE-RULE-EVALUATOR-BINDING-001
    expected_relative_delta_after_actual_execution_evidence_and_patch_application:
      open_issues_total: -1
      canonical_blocking_count: -1

  target_2:
    target_document: PLAN_GENERATOR_SPEC.md
    target_issue: OI-PG-RULE-SAFETY-GATE-BINDING-001
    expected_relative_delta_after_RVE_binding_evidence_and_patch_application:
      open_issues_total: -1
      canonical_blocking_count: -1

absolute_count_policy:
  target_document_absolute_counts_not_declared_here: true
  reason: "Target document counts must be verified directly at patch application time."
  prior_patch_status_is_not_count_evidence: true
  do_not_assume_prior_patch_order_without_target_document_verification: true

application_time_validation_required:
  - open_current_target_document
  - confirm_target_issue_exists
  - confirm_target_issue_status_is_OPEN
  - confirm_target_issue_is_canonical_blocking_YES
  - confirm_actual_runtime_evidence_exists
  - apply_relative_delta_only_after_patch_application
  - recompute_open_issues_total_from_table
  - recompute_canonical_blocking_count_from_table

does_not_apply_to_this_document:
  target_document: RVE_RULE_EVALUATOR_BINDING_SPEC.md
  open_issues_total_delta: 0
  canonical_blocking_count_delta: 0
  reason: "This document declares its own four non-canonical open issues and does not reduce its own issue count."
```

---

## 25. Downstream Closure Note

This document alone does not close the target issues.

```yaml
not_closed_now:
  - OI-RVE-RULE-EVALUATOR-BINDING-001
  - OI-PG-RULE-SAFETY-GATE-BINDING-001
```

The target issues become eligible for resolution only after:

```yaml
ready_to_resolve_after:
  - this_spec_is_accepted
  - actual_D9_evaluator_runtime_tests_pass
  - advisory_to_CLEARED_mapping_tests_pass
  - adapter_mapping_tests_pass
  - RVE_signal_shape_is_verified
  - privacy_storage_boundary_is_verified
  - target_documents_are_patched
```

---

## 26. Storage Rules

```yaml
storage_rules:
  filename: RVE_RULE_EVALUATOR_BINDING_SPEC.md
  first_line_must_be: "# RVE_RULE_EVALUATOR_BINDING_SPEC.md"
  last_line_must_be: "[DRAFT_COMPLETE]"
  text_after_final_marker_allowed: false
  direct_runtime_test_claim_allowed: false
```

[DRAFT_COMPLETE]
