# PHYSIO_SOURCE_TRUST_SPEC.md

```yaml
document_metadata:
  doc_id: trainoracle-spec-009-physio-source-trust
  spec_id: PHYSIO_SOURCE_TRUST_SPEC
  title: TrainOracle Physiological Source Trust Spec
  version: "1.0"
  round: RT1
  status: DRAFT_FOR_REVIEW
  owner: COACH_HOJUNE
  owner_english_name: hojune jang

  target_downstream_document: PLAN_GENERATOR_SPEC.md
  target_downstream_issue: OI-PG-PHYSIO-SOURCE-CONSUMPTION-001

  open_issues_total: 4
  canonical_blocking_count: 0

  executed_tests_total: 0
  executed_tests_passed: 0

  self_check_items_total: 36
  self_check_items_satisfied: 36

count_policy:
  executed_tests_total: "실제 코드 실행 또는 런타임 테스트만 집계한다."
  executed_tests_passed: "실제 실행된 테스트 중 통과한 항목만 집계한다."
  self_check_items_total: "문서 정합성 검토 항목만 집계한다."
  self_check_items_satisfied: "문서 정합성 검토에서 만족한 항목만 집계한다."
  self_check_is_not_runtime_test_evidence: true
  do_not_claim_runtime_pass_without_execution: true
```

---

## 1. Purpose

`PHYSIO_SOURCE_TRUST_SPEC.md`는 TrainOracle에서 생리학적 데이터, 웨어러블 데이터, 훈련 부하 데이터, 회복 관련 데이터를 Plan Generator가 어떻게 신뢰하고 소비할 수 있는지를 정의한다.

이 문서는 다음을 정의한다.

- 생리학적 source의 허용 범위
- source trust level
- primary device policy
- stale / missing / conflicting / suspicious data 처리
- consent / guardian consent 경계
- Plan Generator 소비 계약
- D9/RVE Safety Gate와의 경계
- privacy-safe storage policy
- downstream issue `OI-PG-PHYSIO-SOURCE-CONSUMPTION-001` 해결 조건

---

## 2. Non-Purpose

이 문서는 다음을 하지 않는다.

- 의료 진단을 하지 않는다.
- 부상 또는 질병을 판정하지 않는다.
- D9 Safety Evaluator를 구현하지 않는다.
- Rule Validation Engine을 구현하지 않는다.
- 심박수, HRV, 수면, 체온 등에 대한 절대 의학 threshold를 새로 정의하지 않는다.
- wearable vendor integration 세부 구현을 정의하지 않는다.
- Plan Generator의 전체 생성 알고리즘을 재작성하지 않는다.
- 선수 자유서술 원문을 저장하거나 해석하지 않는다.

---

## 3. Upstream Reference Documents

```yaml
upstream_references:
  - document: PLAN_GENERATOR_SPEC.md
    expected_version: "1.0"
    expected_revision: RT3_TEMPLATE_LIBRARY_OWNERSHIP_PATCHED_AFTER_PROGRESS_GUARD_SYNC
    consumed_for:
      - plan_generator_consumption_boundary
      - safety_gate_order
      - open_issue_closure_target

  - document: APP_IMPLEMENTATION_BRIDGE.md
    expected_version: ">=1.1"
    consumed_for:
      - consent_model
      - guardian_consent_model
      - tenant_scope
      - audit_storage_boundary
      - primary_device_policy_reference

  - document: ATHLETE_PROFILE_SPEC.md
    expected_version: ">=1.0"
    consumed_for:
      - athlete_profile_snapshot
      - age_group
      - minor_status
      - profile_privacy_baseline

  - document: RULE_SPEC_D1_D9.md
    expected_version: ">=1.4"
    consumed_for:
      - D9_safety_boundary
      - safety_hard_stop_reference

  - document: SESSION_CLASSIFIER_SPEC.md
    expected_version: ">=1.2"
    consumed_for:
      - recent_session_context
      - training_load_context
```

---

## 4. Dependency Direction

```yaml
physio_source_trust_consumes:
  - consent_status
  - guardian_consent_status
  - tenant_group_athlete_scope
  - source_snapshot_refs
  - device_identity_refs
  - athlete_profile_snapshot_refs
  - classified_session_refs
  - rule_safety_status_refs

physio_source_trust_provides:
  - source_trust_decision
  - source_quality_flags
  - stale_data_policy
  - conflicting_data_policy
  - suspicious_data_policy
  - primary_device_consumption_policy
  - plan_generator_physio_consumption_contract

physio_source_trust_does_not_provide:
  - medical_diagnosis
  - rule_verdict
  - D9_clearance
  - injury_clearance
  - rehab_clearance
  - final_training_plan
```

---

## 5. Hard Constraints

```yaml
hard_constraints:
  no_unconsented_sensitive_processing: true
  no_minor_sensitive_processing_without_guardian_consent: true
  no_cross_tenant_physio_source_access: true
  no_global_coach_authority: true
  no_medical_diagnosis: true
  no_rule_threshold_definition: true
  no_D9_clearance_from_physio_data: true
  no_safety_gate_override: true
  no_raw_free_text_storage: true
  no_raw_symptom_clause_storage: true
  no_external_llm_with_private_physio_data: true
  no_manual_override_to_trusted_without_audit: true
  no_suspicious_data_as_positive_evidence: true
```

생리학적 데이터는 위험을 낮추는 근거로 함부로 쓰면 안 된다.  
특히 D9 관련 위험이 이미 존재하면, 좋은 HRV나 좋은 수면 데이터가 그 위험을 해제할 수 없다.

```yaml
risk_clearance_policy:
  physio_data_can_raise_risk: true
  physio_data_can_request_review: true
  physio_data_can_block_generation_when_required_data_invalid: true
  physio_data_cannot_clear_D9_ACTIVE: true
  physio_data_cannot_clear_D9_UNKNOWN: true
```

---

## 6. Source Categories

| Source Kind | Description | Default Trust Eligibility |
|---|---|---|
| PRIMARY_DEVICE | 선수별 승인된 주 사용 장비 | Eligible for trust evaluation |
| VERIFIED_DEVICE | 검증된 보조 장비 | Eligible with lower priority |
| SECONDARY_DEVICE | 보조 웨어러블 또는 앱 | Review required if conflicting |
| MANUAL_COACH_STRUCTURED | 코치가 구조화 입력한 수치 또는 상태 | Review required unless corroborated |
| ATHLETE_SELF_REPORT_STRUCTURED | 선수가 선택형으로 입력한 상태 | Review required; never sole hard clearance |
| IMPORTED_FILE | 외부 파일 import | Review required until provenance verified |
| DERIVED_METRIC | 계산된 파생 지표 | Depends on source lineage |
| UNKNOWN_SOURCE | 출처 불명 | Excluded |

```yaml
source_kind_policy:
  PRIMARY_DEVICE:
    may_be_trusted_for_generation: true
    requires_active_device_binding: true
    requires_recent_sync: true

  VERIFIED_DEVICE:
    may_be_trusted_for_generation: true
    requires_cross_check_if_primary_exists: true

  SECONDARY_DEVICE:
    may_support_context: true
    may_override_primary_device: false

  MANUAL_COACH_STRUCTURED:
    may_trigger_review: true
    may_override_device_without_audit: false

  ATHLETE_SELF_REPORT_STRUCTURED:
    may_trigger_review: true
    may_clear_risk: false

  IMPORTED_FILE:
    may_be_used_after_provenance_check: true
    default_without_provenance: REVIEW_REQUIRED

  DERIVED_METRIC:
    inherits_lowest_trust_of_inputs: true

  UNKNOWN_SOURCE:
    may_be_used_for_generation: false
```

---

## 7. Allowed Physiological Metric Families

이 문서는 지표의 source trust를 정의한다.  
의학적 threshold 자체는 정의하지 않는다.

| Metric Family | Examples | May Be Used For |
|---|---|---|
| HEART_RATE | heart rate, resting heart rate, recovery heart rate | load context, abnormal signal review |
| HRV | HRV, readiness proxy | recovery context |
| SLEEP | sleep duration, sleep quality, sleep regularity | recovery context |
| TRAINING_LOAD | session load, acute load, recent high-intensity exposure | progression and recovery context |
| RPE_STRUCTURED | structured RPE, structured fatigue rating | coach review context |
| BODY_STATUS_STRUCTURED | structured soreness, structured wellness score | review context |
| DEVICE_STATUS | sync status, battery, firmware, device binding | source validity |
| DERIVED_READINESS | readiness band, recovery band | candidate filtering only |

```yaml
metric_family_policy:
  HEART_RATE:
    threshold_owner: RULE_OR_APPROVED_PROFILE_LAYER
    this_spec_defines_threshold: false

  HRV:
    threshold_owner: RULE_OR_APPROVED_PROFILE_LAYER
    this_spec_defines_threshold: false

  SLEEP:
    threshold_owner: COACH_POLICY_OR_APPROVED_PROFILE_LAYER
    this_spec_defines_threshold: false

  TRAINING_LOAD:
    threshold_owner: PLAN_PROGRESSION_POLICY_OR_APPROVED_PROFILE_LAYER
    this_spec_defines_threshold: false

  RPE_STRUCTURED:
    free_text_allowed: false
    structured_only: true

  BODY_STATUS_STRUCTURED:
    free_text_allowed: false
    structured_only: true

  DERIVED_READINESS:
    must_expose_source_lineage: true
```

---

## 8. Trust Status Model

| Trust Status | Meaning | Plan Generator Use |
|---|---|---|
| TRUSTED_FOR_GENERATION | Source is scoped, consented, recent, non-conflicting, and valid | May be used as input |
| TRUSTED_FOR_LOW_RISK_CONTEXT_ONLY | Acceptable for conservative context, not for high-intensity justification | May guide conservative options only |
| REVIEW_REQUIRED | Source is usable only after human review | Must not auto-generate intensity increase |
| INSUFFICIENT_DATA | Required data is missing or stale | Block if required by generation mode |
| EXCLUDED_UNTRUSTED | Source is invalid, unknown, suspicious, or out of scope | Must not be used |
| BLOCKED_BY_CONSENT | Consent or guardian consent missing | Must block sensitive processing |

```yaml
trust_status_priority:
  highest_risk_first:
    - BLOCKED_BY_CONSENT
    - EXCLUDED_UNTRUSTED
    - INSUFFICIENT_DATA
    - REVIEW_REQUIRED
    - TRUSTED_FOR_LOW_RISK_CONTEXT_ONLY
    - TRUSTED_FOR_GENERATION
```

---

## 9. Trust Evaluation Gates

A physiological source may be trusted only if all required gates pass.

```yaml
trust_evaluation_gates:
  tenant_scope_gate:
    required: true
    fail_status: EXCLUDED_UNTRUSTED

  athlete_identity_gate:
    required: true
    fail_status: EXCLUDED_UNTRUSTED

  consent_gate:
    required_for_sensitive_or_health_related_data: true
    fail_status: BLOCKED_BY_CONSENT

  guardian_consent_gate:
    required_when_minor_and_sensitive_data: true
    fail_status: BLOCKED_BY_CONSENT

  source_identity_gate:
    required: true
    fail_status: EXCLUDED_UNTRUSTED

  primary_device_binding_gate:
    required_when_primary_device_policy_applies: true
    fail_status: REVIEW_REQUIRED

  recency_gate:
    required: true
    fail_status: INSUFFICIENT_DATA

  quality_gate:
    required: true
    fail_status: EXCLUDED_UNTRUSTED

  conflict_gate:
    required: true
    fail_status: REVIEW_REQUIRED

  auditability_gate:
    required: true
    fail_status: REVIEW_REQUIRED
```

---

## 10. Primary Device Policy

```yaml
primary_device_policy:
  athlete_may_have_one_active_primary_device_per_metric_family: true
  primary_device_required_for_high_intensity_physio_justification: true
  secondary_device_may_support_but_not_override_primary: true
  primary_device_change_requires_audit: true
  primary_device_change_creates_review_period: true
```

Rules:

1. Primary device data has priority only when it is valid, recent, scoped, and consented.
2. Primary device data does not override D9 safety risk.
3. Secondary device data cannot be used to clear risk.
4. Manual input cannot promote untrusted device data to trusted without audit and review.
5. Device replacement or re-binding requires review before high-intensity plan generation relies on it.

---

## 11. Recency and Staleness Policy

이 문서는 default freshness window를 정의한다.  
이는 의학 threshold가 아니라 데이터 사용 가능 기간이다.

| Data Family | Fresh Window | Stale Handling |
|---|---:|---|
| TODAY_READINESS | 0-36 hours | If stale, review or ignore |
| SLEEP_LAST_MAIN_PERIOD | 0-36 hours | If stale, do not claim recovery status |
| RESTING_HR_OR_HRV | 0-48 hours | If stale, review required for intensity increase |
| RECENT_SESSION_LOAD | 0-72 hours | If stale, insufficient for progression decisions |
| TRAINING_LOAD_TREND | 7-28 days | If insufficient points, do not use trend |
| DEVICE_SYNC_STATUS | 0-24 hours | If stale, device data review required |

```yaml
staleness_policy:
  stale_data_may_be_stored_as_historical: true
  stale_data_may_support_long_term_context: true
  stale_data_must_not_justify_high_intensity_increase: true
  stale_required_data_blocks_generation_when_generation_mode_requires_it: true
  stale_optional_data_may_be_ignored_with_reason_code: true
```

---

## 12. Conflict Policy

```yaml
conflict_policy:
  source_conflict_requires_review: true
  primary_device_wins_only_if_valid_recent_and_scoped: true
  secondary_device_cannot_clear_primary_device_risk_signal: true
  manual_entry_cannot_clear_device_risk_signal: true
  athlete_self_report_cannot_clear_device_risk_signal: true
  derived_metric_inherits_conflict_from_inputs: true
```

Conflict examples:

| Situation | Result |
|---|---|
| Primary device recent and valid, secondary disagrees | Use primary; retain conflict reasonCode |
| Primary stale, secondary recent | REVIEW_REQUIRED |
| Two verified devices conflict | REVIEW_REQUIRED |
| Manual entry contradicts device | REVIEW_REQUIRED |
| Derived readiness uses stale HRV | INSUFFICIENT_DATA or REVIEW_REQUIRED |
| Unknown source conflicts with verified source | Exclude unknown source |

---

## 13. Suspicious Data Policy

```yaml
suspicious_data_flags:
  - FUTURE_TIMESTAMP
  - ATHLETE_ID_MISMATCH
  - TENANT_SCOPE_MISMATCH
  - DEVICE_BINDING_MISSING
  - DEVICE_BINDING_CHANGED_RECENTLY
  - DUPLICATE_RECORD_COLLISION
  - IMPOSSIBLE_VALUE_SHAPE
  - MISSING_SOURCE_LINEAGE
  - RAW_IMPORT_WITHOUT_PROVENANCE
  - OUTSIDE_APPROVED_VALIDATOR_RANGE
  - MANUAL_OVERRIDE_WITHOUT_AUDIT
```

```yaml
suspicious_data_handling:
  suspicious_data_may_raise_review: true
  suspicious_data_may_block_generation_if_required: true
  suspicious_data_must_not_be_used_as_positive_evidence: true
  suspicious_data_must_not_clear_risk: true
```

---

## 14. Safety Boundary With D9/RVE

Physio Source Trust does not implement D9 and does not close the RVE binding issue.

```yaml
D9_RVE_boundary:
  this_spec_can:
    - classify_physio_source_trust
    - emit_non_sensitive_reason_codes
    - request_human_review
    - block_physio_based_generation_when_source_invalid

  this_spec_must_not:
    - declare_D9_ACTIVE
    - declare_D9_CLEARED
    - clear_D9_UNKNOWN
    - clear_D9_ACTIVE
    - replace_RVE_rule_evaluator
    - convert_free_text_symptoms_to_rule_verdicts
```

If trusted physiological data indicates a possible safety risk, Plan Generator must route to the safety gate or human review.

```yaml
physio_risk_signal_routing:
  trusted_abnormal_risk_signal:
    action: ROUTE_TO_SAFETY_GATE_OR_HUMAN_REVIEW
    may_generate_high_intensity_plan: false

  untrusted_abnormal_risk_signal:
    action: REVIEW_REQUIRED
    may_generate_high_intensity_plan: false

  normal_or_positive_physio_signal:
    action: MAY_SUPPORT_CONTEXT_ONLY
    may_clear_D9_risk: false
```

---

## 15. Plan Generator Consumption Contract

Plan Generator may consume physiological source trust results only after scope, capability, consent, and safety gates are satisfied.

```yaml
plan_generator_may_consume_physio_if:
  - tenant_group_athlete_scope_valid
  - capability_grant_active
  - consent_scope_covers_physio_processing
  - guardian_consent_satisfied_when_required
  - source_trust_status_allows_consumption
  - safety_gate_not_blocked

plan_generator_must_not:
  - consume_BLOCKED_BY_CONSENT_data
  - consume_EXCLUDED_UNTRUSTED_data
  - treat_missing_physio_as_safe
  - treat_good_physio_as_D9_clearance
  - use_stale_data_to_justify_intensity_increase
  - send_raw_physio_data_to_external_llm
  - store_raw_symptom_or_free_text_clause
```

---

## 16. Plan Generator Action Mapping

| Physio Trust Status | Plan Generator Action |
|---|---|
| TRUSTED_FOR_GENERATION | May use as plan input within scope |
| TRUSTED_FOR_LOW_RISK_CONTEXT_ONLY | May use for conservative or recovery-biased options only |
| REVIEW_REQUIRED | Do not auto-increase load; request coach review |
| INSUFFICIENT_DATA | Block if required; otherwise continue without physio claims |
| EXCLUDED_UNTRUSTED (required) | Do not auto-generate; request coach clarification |
| EXCLUDED_UNTRUSTED (optional) | Ignore as evidence and continue without physio claims |
| BLOCKED_BY_CONSENT | Block sensitive processing |

```yaml
plan_generator_state_mapping:
  BLOCKED_BY_CONSENT:
    plan_generation_state: BLOCKED_BY_CONSENT

  INSUFFICIENT_DATA_required:
    plan_generation_state: BLOCKED_BY_INSUFFICIENT_DATA

  REVIEW_REQUIRED:
    plan_generation_state: NEEDS_COACH_CLARIFICATION

  EXCLUDED_UNTRUSTED_required:
    plan_generation_state: NEEDS_COACH_CLARIFICATION
    reason: "Required physio source is untrusted or invalid."

  EXCLUDED_UNTRUSTED_optional:
    plan_generation_state_change_required: false
    action: CONTINUE_WITHOUT_PHYSIO_CLAIMS
    reason: "Optional untrusted physio source is ignored as evidence."

  TRUSTED_FOR_LOW_RISK_CONTEXT_ONLY:
    allowed_option_bias:
      - CONSERVATIVE
      - RECOVERY_FOCUSED

  TRUSTED_FOR_GENERATION:
    allowed_option_bias:
      - CONSERVATIVE
      - BALANCED
      - RECOVERY_FOCUSED
      - STIMULUS_FOCUSED
    still_requires_coach_selection: true
```

---

## 17. Privacy and Storage Policy

```yaml
do_not_store_in_physio_trust_result:
  - raw_athlete_free_text
  - raw_symptom_clause
  - injury_description
  - medical_note
  - rehab_note
  - guardian_private_note
  - raw_waveform
  - raw_gps_trace
  - full_device_payload
  - external_llm_prompt_with_private_data

allowed_storage:
  - physioSourceTrustEvaluationId
  - tenantId
  - groupId
  - athleteId
  - sourceSnapshotRefs
  - metricFamily
  - sourceKind
  - trustStatus
  - nonSensitiveReasonCodes
  - qualityFlags
  - evaluatedAt
  - expiresAt
  - auditLogId
```

Only reasonCode-level evidence should be stored in audit-facing trust results.

---

## 18. Reason Codes

```yaml
reason_codes:
  consent:
    - PST_BLOCKED_CONSENT_MISSING
    - PST_BLOCKED_GUARDIAN_CONSENT_MISSING

  scope:
    - PST_EXCLUDED_TENANT_SCOPE_MISMATCH
    - PST_EXCLUDED_ATHLETE_ID_MISMATCH

  device:
    - PST_REVIEW_PRIMARY_DEVICE_MISSING
    - PST_REVIEW_PRIMARY_DEVICE_CHANGED
    - PST_EXCLUDED_DEVICE_BINDING_MISSING

  recency:
    - PST_INSUFFICIENT_STALE_TODAY_READINESS
    - PST_INSUFFICIENT_STALE_SLEEP
    - PST_INSUFFICIENT_STALE_HR_HRV
    - PST_INSUFFICIENT_STALE_SESSION_LOAD

  quality:
    - PST_EXCLUDED_SUSPICIOUS_VALUE_SHAPE
    - PST_EXCLUDED_MISSING_SOURCE_LINEAGE
    - PST_REVIEW_IMPORTED_FILE_PROVENANCE

  conflict:
    - PST_REVIEW_SOURCE_CONFLICT
    - PST_REVIEW_MANUAL_ENTRY_CONFLICT
    - PST_REVIEW_DERIVED_METRIC_CONFLICT

  safety:
    - PST_REVIEW_TRUSTED_RISK_SIGNAL
    - PST_REVIEW_UNTRUSTED_RISK_SIGNAL
    - PST_CONTEXT_ONLY_CANNOT_CLEAR_D9
```

---

## 19. TypeScript Contract Draft

```ts
export type TenantId = string;
export type GroupId = string;
export type AthleteId = string;
export type SourceSnapshotId = string;
export type ConsentGrantId = string;
export type CapabilityGrantId = string;
export type AuditLogId = string;
export type ISO8601 = string;

export type PhysioSourceTrustEvaluationId = string;

export type PhysioSourceKind =
  | "PRIMARY_DEVICE"
  | "VERIFIED_DEVICE"
  | "SECONDARY_DEVICE"
  | "MANUAL_COACH_STRUCTURED"
  | "ATHLETE_SELF_REPORT_STRUCTURED"
  | "IMPORTED_FILE"
  | "DERIVED_METRIC"
  | "UNKNOWN_SOURCE";

export type PhysioMetricFamily =
  | "HEART_RATE"
  | "HRV"
  | "SLEEP"
  | "TRAINING_LOAD"
  | "RPE_STRUCTURED"
  | "BODY_STATUS_STRUCTURED"
  | "DEVICE_STATUS"
  | "DERIVED_READINESS";

export type PhysioTrustStatus =
  | "TRUSTED_FOR_GENERATION"
  | "TRUSTED_FOR_LOW_RISK_CONTEXT_ONLY"
  | "REVIEW_REQUIRED"
  | "INSUFFICIENT_DATA"
  | "EXCLUDED_UNTRUSTED"
  | "BLOCKED_BY_CONSENT";

export type PhysioQualityFlag =
  | "FUTURE_TIMESTAMP"
  | "ATHLETE_ID_MISMATCH"
  | "TENANT_SCOPE_MISMATCH"
  | "DEVICE_BINDING_MISSING"
  | "DEVICE_BINDING_CHANGED_RECENTLY"
  | "DUPLICATE_RECORD_COLLISION"
  | "IMPOSSIBLE_VALUE_SHAPE"
  | "MISSING_SOURCE_LINEAGE"
  | "RAW_IMPORT_WITHOUT_PROVENANCE"
  | "OUTSIDE_APPROVED_VALIDATOR_RANGE"
  | "MANUAL_OVERRIDE_WITHOUT_AUDIT";

export interface PhysioObservationRef {
  sourceSnapshotId: SourceSnapshotId;
  sourceKind: PhysioSourceKind;
  metricFamily: PhysioMetricFamily;
  observedAt: ISO8601;
  sourceLineageRefs: string[];
}

export interface PhysioTrustEvaluationRequest {
  tenantId: TenantId;
  groupId: GroupId;
  athleteId: AthleteId;
  consentGrantIds: ConsentGrantId[];
  capabilityGrantIds: CapabilityGrantId[];
  observations: PhysioObservationRef[];
  evaluationContext: "PLAN_GENERATION" | "SAFETY_REVIEW" | "COACH_REVIEW";
  requestedAt: ISO8601;
}

export interface PhysioTrustEvaluationResult {
  physioSourceTrustEvaluationId: PhysioSourceTrustEvaluationId;
  tenantId: TenantId;
  groupId: GroupId;
  athleteId: AthleteId;
  trustStatus: PhysioTrustStatus;
  metricFamiliesEvaluated: PhysioMetricFamily[];
  acceptedSourceSnapshotIds: SourceSnapshotId[];
  excludedSourceSnapshotIds: SourceSnapshotId[];
  qualityFlags: PhysioQualityFlag[];
  reasonCodes: string[];
  evaluatedAt: ISO8601;
  expiresAt: ISO8601;
  auditLogId: AuditLogId;
}
```

---

## 20. API Draft

```yaml
api_draft:
  evaluate_physio_source_trust:
    method: POST
    path: /physio-source-trust/evaluate
    constraints:
      - tenant_group_athlete_scope_required
      - consent_required_for_sensitive_data
      - guardian_consent_required_for_minor_sensitive_data
      - no_raw_free_text
      - no_external_llm
    returns:
      - PhysioTrustEvaluationResult

  get_physio_source_trust_result:
    method: GET
    path: /physio-source-trust/evaluations/{physioSourceTrustEvaluationId}
    constraints:
      - scoped_access_only
      - audit_log_required

  list_physio_source_status:
    method: GET
    path: /physio-source-trust/athletes/{athleteId}/sources
    constraints:
      - tenant_group_scope_required
      - no_cross_tenant_access
```

---

## 21. Audit Policy

```yaml
audit_policy:
  audit_required_for:
    - source_trust_evaluation_created
    - primary_device_changed
    - manual_override_attempted
    - suspicious_data_excluded
    - conflict_review_required
    - consent_block_triggered

  audit_must_not_store:
    - raw_free_text
    - raw_symptom_clause
    - raw_device_payload
    - raw_waveform
    - external_llm_prompt

  audit_may_store:
    - evaluation_id
    - source_snapshot_refs
    - trust_status
    - reason_codes
    - quality_flags
    - timestamp
```

---

## 22. Open Issues

| Open Issue ID | Status | Canonical Blocking | Description | Closure Condition |
|---|---|---:|---|---|
| OI-PST-DEVICE-VENDOR-MAPPING-001 | OPEN | NO | Vendor-specific device mapping is not defined. | Add vendor mapping table after implementation vendor selection |
| OI-PST-CALIBRATION-UX-001 | OPEN | NO | Coach-facing device calibration and review UI is not defined. | UI/UX flow completed |
| OI-PST-SPORT-SPECIFIC-WEIGHTS-001 | OPEN | NO | Sport-specific trust weighting is not finalized. | Event-specific usage data reviewed |
| OI-PST-LONGITUDINAL-TREND-MODEL-001 | OPEN | NO | Longitudinal readiness trend model is not specified. | Trend model policy created after data collection |

```yaml
open_issue_count_validation:
  open_issues_total_declared: 4
  open_issue_rows_in_section_22: 4
  canonical_blocking_count_declared: 0
  canonical_blocking_rows_with_yes: 0
  status: SATISFIED
```

---

## 23. Acceptance Conditions

```yaml
acceptance_conditions:
  - source_categories_are_defined
  - trust_status_model_is_defined
  - primary_device_policy_is_defined
  - recency_and_staleness_policy_is_defined
  - conflict_policy_is_defined
  - suspicious_data_policy_is_defined
  - Plan_Generator_consumption_contract_is_defined
  - D9_RVE_boundary_is_explicit
  - privacy_policy_blocks_raw_free_text_and_raw_symptom_clause
  - expected_downstream_delta_is_scoped_to_PLAN_GENERATOR_SPEC
```

---

## 24. Self-Check Items, Not Executed Tests

```yaml
self_check_annotation:
  executed_tests_run: false
  self_check_is_runtime_test: false
  groups:
    metadata_and_counting: 4
    source_taxonomy: 5
    trust_gating: 6
    conflict_and_staleness: 5
    privacy_and_consent: 5
    plan_generator_consumption: 6
    downstream_delta_and_closure: 5
  total: 36
```

| ID | Group | Check | Status |
|---|---|---|---|
| SC-PST-001 | metadata_and_counting | Required metadata exists | SATISFIED |
| SC-PST-002 | metadata_and_counting | Executed tests are declared as 0/0 | SATISFIED |
| SC-PST-003 | metadata_and_counting | Self-check is separated from runtime evidence | SATISFIED |
| SC-PST-004 | metadata_and_counting | Open issue counts are declared | SATISFIED |
| SC-PST-005 | source_taxonomy | Source categories are listed | SATISFIED |
| SC-PST-006 | source_taxonomy | Unknown source is excluded | SATISFIED |
| SC-PST-007 | source_taxonomy | Derived metric lineage is required | SATISFIED |
| SC-PST-008 | source_taxonomy | Manual input cannot override without audit | SATISFIED |
| SC-PST-009 | source_taxonomy | Athlete self-report cannot clear risk | SATISFIED |
| SC-PST-010 | trust_gating | Tenant scope gate exists | SATISFIED |
| SC-PST-011 | trust_gating | Consent gate exists | SATISFIED |
| SC-PST-012 | trust_gating | Guardian consent gate exists | SATISFIED |
| SC-PST-013 | trust_gating | Source identity gate exists | SATISFIED |
| SC-PST-014 | trust_gating | Recency gate exists | SATISFIED |
| SC-PST-015 | trust_gating | Conflict gate exists | SATISFIED |
| SC-PST-016 | conflict_and_staleness | Freshness windows are defined | SATISFIED |
| SC-PST-017 | conflict_and_staleness | Stale data cannot justify intensity increase | SATISFIED |
| SC-PST-018 | conflict_and_staleness | Source conflict requires review | SATISFIED |
| SC-PST-019 | conflict_and_staleness | Primary device priority is conditional | SATISFIED |
| SC-PST-020 | conflict_and_staleness | Suspicious data is not positive evidence | SATISFIED |
| SC-PST-021 | privacy_and_consent | Raw free-text storage is forbidden | SATISFIED |
| SC-PST-022 | privacy_and_consent | Raw symptom clause storage is forbidden | SATISFIED |
| SC-PST-023 | privacy_and_consent | Raw device payload storage is forbidden in trust result | SATISFIED |
| SC-PST-024 | privacy_and_consent | External LLM with private physio data is forbidden | SATISFIED |
| SC-PST-025 | privacy_and_consent | Audit storage is reasonCode-based | SATISFIED |
| SC-PST-026 | plan_generator_consumption | Plan Generator consumption contract exists | SATISFIED |
| SC-PST-027 | plan_generator_consumption | Missing physio is not treated as safe | SATISFIED |
| SC-PST-028 | plan_generator_consumption | Good physio cannot clear D9 risk | SATISFIED |
| SC-PST-029 | plan_generator_consumption | Review-required blocks auto intensity increase | SATISFIED |
| SC-PST-030 | plan_generator_consumption | State mapping avoids new PlanGenerationState values | SATISFIED |
| SC-PST-031 | plan_generator_consumption | Coach selection remains required | SATISFIED |
| SC-PST-032 | downstream_delta_and_closure | Target downstream issue is referenced | SATISFIED |
| SC-PST-033 | downstream_delta_and_closure | Expected delta applies only to PLAN_GENERATOR_SPEC.md | SATISFIED |
| SC-PST-034 | downstream_delta_and_closure | This document has zero canonical blockers | SATISFIED |
| SC-PST-035 | downstream_delta_and_closure | D9/RVE binding is not falsely closed | SATISFIED |
| SC-PST-036 | downstream_delta_and_closure | Final marker rule is defined | SATISFIED |

---

## 25. Self-Validation

```yaml
self_validation:
  metadata_block_present: SATISFIED
  purpose_section_present: SATISFIED
  non_purpose_section_present: SATISFIED
  upstream_references_present: SATISFIED
  dependency_direction_present: SATISFIED
  hard_constraints_present: SATISFIED
  source_categories_present: SATISFIED
  metric_families_present: SATISFIED
  trust_status_model_present: SATISFIED
  trust_gates_present: SATISFIED
  primary_device_policy_present: SATISFIED
  staleness_policy_present: SATISFIED
  conflict_policy_present: SATISFIED
  suspicious_data_policy_present: SATISFIED
  D9_RVE_boundary_present: SATISFIED
  plan_generator_consumption_contract_present: SATISFIED
  privacy_storage_policy_present: SATISFIED
  open_issues_total_matches_rows: SATISFIED
  canonical_blocking_count_matches_rows: SATISFIED
  self_check_item_total_matches_annotations: SATISFIED
  self_check_item_table_rows_36: SATISFIED
  executed_tests_not_claimed: SATISFIED
  downstream_absolute_count_not_declared: SATISFIED
  storage_header_footer: SATISFIED
```

---

## 26. Expected Delta For Target Document

이 섹션의 델타는 `PHYSIO_SOURCE_TRUST_SPEC.md` 자체에 적용하지 않는다.  
대상 문서는 `PLAN_GENERATOR_SPEC.md`다.

이 문서는 downstream target의 절대 open issue count를 단정하지 않는다.  
`PLAN_GENERATOR_SPEC.md`의 실제 카운트는 패치 적용 시점에 해당 문서를 직접 열어 확인해야 한다.

```yaml
expected_delta_for_target_document:
  target_document: PLAN_GENERATOR_SPEC.md
  target_issue: OI-PG-PHYSIO-SOURCE-CONSUMPTION-001
  applies_after:
    - PHYSIO_SOURCE_TRUST_SPEC.md reviewer acceptance
    - source trust status model accepted
    - primary device policy accepted
    - Plan Generator consumption mapping accepted
    - privacy and consent boundary accepted

  expected_relative_delta:
    open_issues_total: -1
    canonical_blocking_count: -1

absolute_count_policy:
  target_document_absolute_counts_not_declared_here: true
  reason: "PLAN_GENERATOR_SPEC.md counts must be verified directly at patch application time."
  prior_patch_status_is_not_count_evidence: true
  target_document_must_be_verified_even_if_expected_revision_matches: true
  do_not_infer_absolute_counts_from_template_library_patch_status: true
  do_not_assume_prior_patch_order_without_target_document_verification: true

application_time_validation_required:
  - open_current_PLAN_GENERATOR_SPEC.md
  - confirm_OI-PG-PHYSIO-SOURCE-CONSUMPTION-001_exists
  - confirm_issue_status_is_OPEN
  - confirm_issue_is_canonical_blocking_YES
  - apply_relative_delta_only_after_patch_application
  - recompute_open_issues_total_from_table
  - recompute_canonical_blocking_count_from_table

does_not_apply_to_this_document:
  target_document: PHYSIO_SOURCE_TRUST_SPEC.md
  open_issues_total_delta: 0
  canonical_blocking_count_delta: 0
  reason: "This document declares its own four non-canonical open issues and does not reduce its own issue count."
```

---

## 27. Downstream Closure Note

If this document is accepted and applied to `PLAN_GENERATOR_SPEC.md`, the following Plan Generator issue becomes eligible for resolution:

```yaml
ready_to_resolve_after_application:
  - issue: OI-PG-PHYSIO-SOURCE-CONSUMPTION-001
    target_document: PLAN_GENERATOR_SPEC.md
    closure_basis:
      - source trust levels defined
      - primary device policy defined
      - stale data handling defined
      - conflict handling defined
      - suspicious data handling defined
      - Plan Generator consumption mapping defined
      - privacy boundary defined
```

This does not close:

```yaml
not_closed_by_this_document:
  - OI-PG-RULE-SAFETY-GATE-BINDING-001
  - OI-RVE-RULE-EVALUATOR-BINDING-001
```

---

## 28. Storage Rules

```yaml
storage_rules:
  filename: PHYSIO_SOURCE_TRUST_SPEC.md
  first_line_must_be: "# PHYSIO_SOURCE_TRUST_SPEC.md"
  last_line_must_be: "[DRAFT_COMPLETE]"
  text_after_final_marker_allowed: false
  direct_runtime_test_claim_allowed: false
```

[DRAFT_COMPLETE]