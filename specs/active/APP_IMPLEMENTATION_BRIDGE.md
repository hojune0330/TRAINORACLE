# APP_IMPLEMENTATION_BRIDGE.md

```yaml
doc_id: trainoracle-spec-004-app-implementation-bridge
spec_id: APP_IMPLEMENTATION_BRIDGE
title: TrainOracle App Implementation Bridge
version: "1.1"
schema_build: 2026-06-03
round: RT4
status: DRAFT_FOR_REVIEW
upload_allowed: false
canonical_promotion_allowed: false
public_sanitized: true
organization_specific_source_names_removed: true
private_athlete_data_included: false
owner: COACH_HOJUNE
owner_display_name: "HoJune Jang"
owner_meaning: "Document governance and provenance owner only; not a runtime authority."
platform_scope: GLOBAL_PUBLIC_MULTI_TENANT
designer: OPUS_4_8
seed_author: GPT_5_5_PRO
run_id: APP_IMPLEMENTATION_BRIDGE_v1.1_from_RULE_v1.4_SESSION_v1.2_ATHLETE_PROFILE_v1.0_LOCAL_001

upstream_baselines:
  - file: RULE_SPEC_D1_D9.md
    version: "1.4"
    role: READ_ONLY_APPROVED_BASELINE
    namespace: RULE_SPEC_D1_D9
  - file: SESSION_CLASSIFIER_SPEC.md
    version: "1.2"
    role: READ_ONLY_APPROVED_BASELINE
  - file: ATHLETE_PROFILE_SPEC.md
    version: "1.0"
    role: READ_ONLY_LOCAL_APPROVED_BASELINE_PENDING_CANONICAL_PROMOTION
    reviewer_quality_gate: APPROVED
    coach_final_canonical_approval: PENDING
    upload_allowed: false
    canonical_promotion_allowed: false

legacy_reference_docs:
  - file: SOURCE_MAP.md
    version: "3.1"
  - file: SOURCE_TO_DOC_MAP.md
    version: "3.1"
  - file: GLOSSARY.md
    version: "1.1"
  - file: 02_AI_STRATEGY.md
    version: "2.1"
  - file: 06_VALIDATION_AND_SAFEGUARDS.md
    version: "2.1"
  - file: 11_API_AND_ENGINE_CONTRACTS.md
    version: "2.1"
  - file: 12_SCREEN_GUIDE.md
    version: "2.1"

test_cases_total: 46
test_cases_passed: 46
open_issues_total: 12
open_issues_canonical_blocking_count: 4
```

## Section 0. Design Summary

`APP_IMPLEMENTATION_BRIDGE.md`는 TrainOracle의 정책 SPEC 계층과 실제 앱 구현 계층 사이를 연결하는 브릿지 문서다. 이 문서는 멀티테넌트 저장 구조, tenant/group/athlete 단위 격리, capability grant와 consent lifecycle의 구현 경계, 그리고 `RULE_SPEC_D1_D9` / `SESSION_CLASSIFIER_SPEC` / `ATHLETE_PROFILE_SPEC` 산출물의 저장·조회·감사 모델을 정의한다. 또한 source snapshot, classified session, rule validation run, manual correction, profile snapshot의 논리적 record contract, onboarding 단계의 분리 동의 모델, 미성년 선수 보호자 동의 가드, API surface 초안, YAML 정책 필드와 TypeScript contract 간 매핑, 자동화 검증 체크리스트를 포함한다.

이 문서는 다음을 하지 않는다. `RULE_SPEC_D1_D9.D-*` 규칙 의미를 재정의하지 않으며, verdict와 severity 값을 정의하지 않고 오직 opaque passthrough로 보관만 한다. `SESSION_CLASSIFIER_SPEC`의 분류 정책을 재정의하지 않는다. `ATHLETE_PROFILE_SPEC`의 privacy, consent, authority boundary를 약화하지 않는다. 전역 코치 권한을 만들지 않는다. safety hard-stop을 우회하지 않는다. DB vendor, cloud provider, UI 세부 구현을 확정하지 않는다. 법률 자문을 대체하지 않는다.

## Section 1. Purpose and Boundary

```yaml
purpose:
  primary: "Bridge approved policy specs to a concrete multi-tenant app data and access model."
  secondary:
    - define_logical_storage_contracts
    - define_capability_and_consent_implementation_boundary
    - define_onboarding_scoped_consent_model
    - define_minor_guardian_consent_guards
    - define_cross_spec_data_flow
    - provide_api_surface_draft
    - provide_yaml_to_typescript_mapping

boundary:
  bridge_owns:
    - logical_storage_contracts
    - multi_tenant_row_isolation
    - capability_grant_records
    - consent_grant_records
    - onboarding_consent_capture_model
    - minor_guardian_consent_guards
    - source_snapshot_records
    - classified_session_records
    - rule_validation_run_records
    - rule_validation_result_records
    - manual_correction_audit_records
    - scoped_review_escalation_records
    - profile_snapshot_storage_records
    - api_surface_draft
    - yaml_to_typescript_mapping
    - audit_log_contracts
  bridge_does_not_own:
    - RULE_SPEC_D1_D9_rule_semantics
    - RULE_SPEC_D1_D9_verdict_or_severity_values
    - RULE_SPEC_D1_D9_safety_thresholds
    - SESSION_CLASSIFIER_classification_policy
    - ATHLETE_PROFILE_authority_model
    - training_plan_generation_logic
    - final_database_vendor_selection
    - final_cloud_provider_selection
    - production_security_certification
    - binding_legal_determination
```

## Section 2. Upstream Dependency Satisfaction

| Dependency | Upstream Source | Bridge Responsibility | Status |
|---|---|---|---|
| Rule validation result storage | RULE_SPEC_D1_D9 v1.4 | rule run, result, evidence, audit linkage 저장 | RESOLVED |
| Safety hard-stop preservation | RULE_SPEC_D1_D9 v1.4 | `RULE_SPEC_D1_D9.D-9` 결과를 planner나 escalation이 해제하지 못하게 보존 | RESOLVED |
| Verdict and severity handling | RULE_SPEC_D1_D9 v1.4 | opaque passthrough 저장만, 값 정의 금지 | RESOLVED |
| Session classification storage | SESSION_CLASSIFIER_SPEC v1.2 | classified session, uncertainty, correction lineage 저장 | RESOLVED |
| LD inclusion preferences | SESSION_CLASSIFIER_SPEC v1.2 + ATHLETE_PROFILE v1.0 | profile snapshot 기준으로 classifier input에 연결 | RESOLVED |
| Manual correction authorization | SESSION_CLASSIFIER_SPEC v1.2 + ATHLETE_PROFILE v1.0 | scoped capability + consent + audit 필수화 | RESOLVED |
| Athlete profile snapshot storage | ATHLETE_PROFILE_SPEC v1.0 | immutable snapshot, group isolation, audit pointer 저장 | RESOLVED |
| Secondary group access | ATHLETE_PROFILE_SPEC v1.0 | secondary group grant record + 4대 invariant 보존 | RESOLVED |
| Consent lifecycle | ATHLETE_PROFILE_SPEC v1.0 | grant/revoke/expire model + onboarding 분리 동의 저장 | RESOLVED |
| Consent legal basis | ATHLETE_PROFILE_SPEC v1.0 | scoped 분리 동의, 끼워넣기 동의 금지, 민감정보 별도 동의 | RESOLVED |
| Guardian consent | ATHLETE_PROFILE_SPEC v1.0 | 미성년 선수 보호자 별도 동의 가드 | RESOLVED |
| Profile retention | ATHLETE_PROFILE_SPEC v1.0 | retention matrix와 purge policy 연결 | OPEN |
| Physiological source trust | ATHLETE_PROFILE_SPEC v1.0 | source quality policy 연결 | PARTIAL_OPEN |
| Primary device only | GLOSSARY S-04 | analysis input은 primary device source만 허용 | RESOLVED |
| External LLM restriction | GLOSSARY S-02/S-03 | Free/Beta 외부 LLM 전송 금지, LLM explainer only | RESOLVED |

## Section 3. Source Priority and Namespace Policy

```yaml
source_priority:
  L0_current_spec_baselines:
    priority: ABSOLUTE_FOR_NEW_SPEC_AUTHORING
    files:
      - "RULE_SPEC_D1_D9.md v1.4"
      - "SESSION_CLASSIFIER_SPEC.md v1.2"
      - "ATHLETE_PROFILE_SPEC.md v1.0"
  L1_legacy_canonical_sources:
    priority: REFERENCE_ONLY_UNLESS_CONFLICT
    files:
      - "SOURCE_MAP.md v3.1"
      - "SOURCE_TO_DOC_MAP.md v3.1"
      - "GLOSSARY.md v1.1"
      - "02_AI_STRATEGY.md v2.1"
      - "06_VALIDATION_AND_SAFEGUARDS.md v2.1"
      - "11_API_AND_ENGINE_CONTRACTS.md v2.1"
      - "12_SCREEN_GUIDE.md v2.1"
  conflict_rule:
    if_L0_conflicts_with_legacy_reference:
      winner: L0_current_spec_baselines
```

```yaml
rule_namespace_policy:
  bare_d_reference_forbidden_in_new_specs: true
  allowed_namespaces:
    - RULE_SPEC_D1_D9
    - LEGACY_PHASE_D
    - CYCLE_DAY
  meanings:
    RULE_SPEC_D1_D9: "Current app and spec validation rules from RULE_SPEC_D1_D9.md."
    LEGACY_PHASE_D: "Legacy Coach Jang Workflow Phase D training checks."
    CYCLE_DAY: "Cycle or race-day label; not a rule id."
  conflict_resolution:
    new_spec_authoring:
      winner: RULE_SPEC_D1_D9
  invalid_examples:
    - "UNNAMESPACED_D9"
    - "UNNAMESPACED_D1_THROUGH_D9"
  valid_examples:
    - "RULE_SPEC_D1_D9.D-9"
    - "LEGACY_PHASE_D.D-9"
    - "CYCLE_DAY.D-5"
```

## Section 4. Tenancy and Isolation Model

```yaml
tenancy_model:
  required_scope_keys:
    sensitive_records:
      - tenantId
      - groupId
      - athleteId
    system_records:
      - tenantId
  isolation_invariants:
    - record_access_requires_matching_tenantId
    - athlete_scoped_record_access_requires_matching_athleteId
    - group_scoped_record_access_requires_matching_groupId_or_valid_secondary_group_grant
    - coach_role_alone_never_grants_global_access
    - admin_role_must_be_tenant_scoped
    - all_cross_group_access_requires_consent_capability_and_audit
  prohibited:
    - global_coach_authority
    - unscoped_profile_read
    - unscoped_manual_correction
    - cross_tenant_query_without_system_audit
```

```yaml
secondary_group_access_invariants:
  does_not_grant_visibility: true
  does_not_grant_authority: true
  validation_context_group_must_be_explicit: true
  each_group_requires_independent_capability_grant: true
  source: "ATHLETE_PROFILE_SPEC.md v1.0"
  bridge_must_not_weaken: true
```

## Section 5. Capability and Consent Model

```yaml
capability_model:
  capability_source: APP_IMPLEMENTATION_BRIDGE
  grants_are:
    - scoped
    - auditable
    - revocable
    - time_bounded_or_explicitly_unbounded
  grant_validation:
    required_checks:
      - tenant_match
      - group_match_or_secondary_group_grant
      - athlete_scope_match_when_required
      - not_revoked
      - not_expired
      - consent_present_when_required
      - actor_identity_verified

bridge_capabilities:
  - VIEW_ATHLETE_PROFILE
  - WRITE_ATHLETE_PROFILE_SNAPSHOT
  - VIEW_PROFILE_AUDIT
  - MANAGE_PROFILE_CONSENT
  - CORRECT_SESSION_CLASSIFICATION
  - VIEW_CLASSIFIED_SESSION
  - WRITE_CLASSIFIED_SESSION
  - IMPORT_SOURCE_SNAPSHOT
  - WRITE_DAILY_CHECKIN
  - VIEW_DAILY_CHECKIN
  - RUN_RULE_VALIDATION
  - VIEW_RULE_VALIDATION_RESULT
  - REQUEST_SCOPED_REVIEW_ESCALATION
  - VIEW_AUDIT_LOG
```

```yaml
scoped_review_escalation_policy:
  legacy_override_label_replaced: true
  is_coach_global_authority: false
  requires_capability_grant: true
  requires_consent_when_sensitive: true
  requires_audit_log: true
  may_modify_raw_source: false
  may_modify_original_classification: false
  may_clear_safety_hard_stop: false
  may_redefine_rule_spec_result: false
```

```yaml
consent_model:
  consent_record_types:
    - ATHLETE_PROFILE_VISIBILITY
    - TRAINING_HISTORY_USE_FOR_PLAN_GENERATION
    - MANUAL_CLASSIFICATION_CORRECTION
    - SECONDARY_GROUP_ACCESS
    - PHYSIOLOGICAL_DATA_USE
    - GUARDIAN_CONSENT
  capability_grant_lifecycle_states:
    - ACTIVE
    - REVOKED
    - EXPIRED
    - SUPERSEDED
  consent_grant_lifecycle_states:
    - DRAFT
    - ACTIVE
    - REVOKED
    - EXPIRED
    - SUPERSEDED
  timestamp_fields:
    always_required:
      - createdAt
    status_dependent:
      activatedAt: "required when status is ACTIVE, REVOKED, EXPIRED, or SUPERSEDED"
      revokedAt: "required when status is REVOKED"
      expiresAt: "required when grant is time-bounded"
  invariants:
    - revoked_consent_must_not_authorize_new_access
    - expired_consent_must_not_authorize_new_access
    - manual_correction_requires_active_consent_or_valid_policy_exception
    - consent_change_must_create_audit_record
```

```yaml
onboarding_consent_capture:
  model: SCOPED_CONSENT_AT_SIGNUP_BUNDLED_UI_SEPARATE_RECORDS
  meaning: "가입 흐름에서 동의를 받되, 항목별로 분리된 consent record를 생성한다. 단일 일괄 동의로 묶지 않는다."
  forbidden:
    bundled_all_or_nothing_consent: true
    sensitive_data_consent_tied_to_service_access: true
  required_separations:
    - consent_type: ATHLETE_PROFILE_VISIBILITY
      mandatory_for_service: true
    - consent_type: PHYSIOLOGICAL_DATA_USE
      mandatory_for_service: false
      note: "Sensitive category. Separate explicit consent required. Refusal must still allow base service."
    - consent_type: MANUAL_CLASSIFICATION_CORRECTION
      mandatory_for_service: false
    - consent_type: SECONDARY_GROUP_ACCESS
      mandatory_for_service: false
  each_separation_creates_independent_consent_record: true

minor_athlete_consent_guard:
  age_check_required_at_signup: true
  if_minor:
    guardian_consent_required: true
    guardian_consent_is_separate_record: true
    minor_self_signup_alone_insufficient: true
    physiological_data_use_requires_guardian_consent: true
    guardian_identity_verification_required: true
  hard_guard:
    sensitive_processing_without_required_consent: BLOCKED
    minor_physiological_processing_without_guardian_consent: BLOCKED
  not_a_legal_determination: true
  legal_review_before_production: REQUIRED
```

## Section 6. Storage Record Families

```yaml
storage_record_families:
  source_snapshot_records:
    purpose: "Raw or normalized input source lineage."
    immutable_after_create: true
  classified_session_records:
    purpose: "SESSION_CLASSIFIER output storage."
    mutable: false
    correction_path: "Manual correction creates new correction record, not in-place mutation."
  rule_validation_run_records:
    purpose: "RULE_SPEC_D1_D9 run envelope."
    mutable: false
  rule_validation_result_records:
    purpose: "Individual RULE_SPEC_D1_D9.D-* result storage as opaque passthrough."
    mutable: false
  scoped_review_escalation_records:
    purpose: "Scoped, capability-gated review escalation requests. Never clears safety hard-stop."
    mutable: false
  athlete_profile_snapshot_records:
    purpose: "ATHLETE_PROFILE immutable snapshot storage."
    mutable: false
  daily_checkin_records:
    purpose: "DAILY_LOG_AND_CHECKIN_SPEC structured daily check-in storage without raw memo, raw symptom clause, or raw free-text."
    mutable: false
    target_issue: OI-DLC-APP-BRIDGE-BINDING-001
    closure_state: OPEN_UNTIL_DAILY_LOG_SOURCE_ACCEPTANCE_TARGET_RECOUNT_AND_PRIVACY_REVIEW
  physio_source_trust_result_records:
    purpose: "PHYSIO_SOURCE_TRUST_SPEC output storage without raw payload, raw symptom clause, or raw free-text."
    mutable: false
    target_issue: OI-AIB-PHYSIO-SOURCE-001
    closure_state: OPEN_UNTIL_SOURCE_ACCEPTANCE_AND_TARGET_RECOUNT
  consent_grant_records:
    purpose: "Consent lifecycle including onboarding scoped consents and guardian consent."
    mutable: append_only_status_transition
  capability_grant_records:
    purpose: "Scoped authority."
    mutable: append_only_status_transition
  audit_log_records:
    purpose: "Security, privacy, and lineage audit."
    mutable: false
```

```yaml
bridge_rule_result_policy:
  bridge_may_store_rule_verdict: true
  bridge_may_define_rule_verdict_values: false
  bridge_may_define_rule_severity_values: false
  source_of_verdict_and_severity: RULE_SPEC_D1_D9_ONLY
  bridge_behavior: OPAQUE_PASSTHROUGH_STORAGE_ONLY
```

## Section 7. Source Snapshot and Primary Device Policy

```yaml
source_snapshot_policy:
  sourceSnapshotId_required_for:
    - source_import
    - classified_session
    - rule_validation_run
    - profile_snapshot_when_source_derived
  allowed_source_types:
    - GARMIN_IMPORT
    - GSHEET_INPUT
    - MANUAL_COACH_ENTRY
    - ATHLETE_SELF_REPORT
    - DAILY_CHECKIN_SELF_REPORT
    - LAB_PHYSIOLOGY
    - SYSTEM_DERIVED
  immutability:
    content_hash_required: true
    hash_algorithm: SHA256
    mutation_after_create: forbidden
  primary_device_policy:
    based_on: GLOSSARY_S04
    rule: "Analysis inputs must use exactly one primary device source unless a future RFC changes this."
    non_primary_device_data:
      may_store_in_archive: true
      may_feed_analysis: false
```

```yaml
physio_source_trust_storage_policy:
  source_document: PHYSIO_SOURCE_TRUST_SPEC.md
  target_issue: OI-AIB-PHYSIO-SOURCE-001
  status_after_patch: PATCHED_PENDING_SOURCE_ACCEPTANCE

  may_store:
    - physioSourceTrustResultId
    - sourceSnapshotId
    - trustStatus
    - sourceCategory
    - recencyStatus
    - conflictStatus
    - consentStatus
    - nonSensitiveReasonCodes
    - createdAt
    - auditLogId

  must_not_store:
    - raw_device_payload
    - raw_athlete_free_text
    - raw_symptom_clause
    - injury_narrative
    - medical_note
    - rehab_note
    - guardian_private_note
    - D9_evidence_clause

  safety_boundary:
    good_physio_data_can_clear_D9: false
    template_or_physio_can_override_safety_hard_stop: false
    missing_or_conflicting_physio_may_raise_review: true
```

```yaml
daily_checkin_storage_policy:
  source_document: DAILY_LOG_AND_CHECKIN_SPEC.md
  target_issue: OI-DLC-APP-BRIDGE-BINDING-001
  status_after_patch: PATCHED_PENDING_SOURCE_ACCEPTANCE_AND_TARGET_RECOUNT

  may_store:
    - dailyCheckInId
    - sourceSnapshotId
    - tenantId
    - groupId
    - athleteId
    - checkInDate
    - structured_rpe
    - structured_sleep
    - structured_condition
    - structured_readiness
    - structured_body_area_signals
    - completedSessionRef
    - plannedSessionRef
    - nonSensitiveReasonCodes
    - redactedNonSensitiveSummary_when_policy_allows
    - extractionVersion
    - createdAt
    - auditLogId

  must_not_store:
    - raw_memo_text
    - raw_athlete_free_text
    - raw_symptom_clause
    - injury_narrative
    - medical_note
    - rehab_note
    - guardian_private_note
    - D9_evidence_clause
    - external_llm_prompt_with_private_athlete_data

  safety_boundary:
    daily_checkin_can_raise_review_or_block: true
    daily_checkin_can_clear_D9_ACTIVE: false
    daily_checkin_can_clear_D9_UNKNOWN: false
    daily_checkin_can_clear_Safety_Gate_block_state: false
    good_daily_checkin_values_can_create_medical_clearance: false
```

## Section 8. Cross-Spec Data Flow

```yaml
data_flow:
  source_import:
    creates:
      - SourceSnapshotRecord
  session_classification:
    reads:
      - SourceSnapshotRecord
      - AthleteProfileSnapshotStorageRecord
    creates:
      - ClassifiedSessionRecord
  manual_classification_correction:
    reads:
      - ClassifiedSessionRecord
      - CapabilityGrantRecord
      - ConsentGrantRecord
    creates:
      - ManualClassificationCorrectionRecord
      - AuditLogRecord
    must_not_modify:
      - raw_source_snapshot
      - original_classified_session
      - RULE_SPEC_D1_D9_safety_result
  rule_validation:
    reads:
      - ClassifiedSessionRecord
      - AthleteProfileSnapshotStorageRecord
      - SourceSnapshotRecord
    creates:
      - RuleValidationRunRecord
      - RuleValidationResultRecord
  profile_update:
    creates:
      - AthleteProfileSnapshotStorageRecord
      - ProfileAuditRecord
  daily_checkin_capture:
    reads:
      - ConsentGrantRecord
      - CapabilityGrantRecord_when_actor_is_not_self
      - SourceSnapshotRecord_when_linking_completed_or_planned_session
    creates:
      - DailyCheckInRecord
      - SourceSnapshotRecord
      - AuditLogRecord
    may_emit_for_runtime_processing:
      - structured_daily_signals
      - nonSensitiveReasonCodes
      - sourceSnapshotId
      - auditLogId
    must_not_store:
      - raw_memo_text
      - raw_athlete_free_text
      - raw_symptom_clause
      - injury_narrative
      - medical_note
      - rehab_note
      - guardian_private_note
      - D9_evidence_clause
    must_not_clear:
      - RULE_SPEC_D1_D9.D-9
      - Safety_Gate_block_state
  physio_source_trust_evaluation:
    reads:
      - SourceSnapshotRecord
      - ConsentGrantRecord
      - AthleteProfileSnapshotStorageRecord
    creates:
      - PhysioSourceTrustResultRecord
      - AuditLogRecord
    must_not_store:
      - raw_athlete_free_text
      - raw_symptom_clause
      - injury_narrative
      - medical_note
      - guardian_private_note
    must_not_clear:
      - RULE_SPEC_D1_D9.D-9
      - Safety_Gate_block_state
```

```yaml
cross_spec_impact:
  OI_AP_LD_MIN_SEGMENT_DURATION_001:
    source: "ATHLETE_PROFILE_SPEC.md v1.0"
    bridge_impact: "Storage can preserve durationMin and optional segment metadata, but classifier v1.2 does not enforce future LD minimum segment policy."
    consumed_by_session_classifier_v1_2: false
    requires_future_classifier_version: true
    canonical_blocking: false
    owner: FUTURE_CLASSIFIER_VERSION
```

## Section 9. API Surface Draft

| Endpoint | Method | Purpose | Required Capability | Notes |
|---|---|---|---|---|
| `/bridge/source-snapshots` | POST | source snapshot 생성 | `IMPORT_SOURCE_SNAPSHOT` | immutable create |
| `/bridge/source-snapshots/{id}` | GET | source snapshot 조회 | source-scoped read capability | tenant/group/athlete isolation |
| `/bridge/classified-sessions` | POST | classifier output 저장 | `WRITE_CLASSIFIED_SESSION` | SESSION_CLASSIFIER output only |
| `/bridge/classified-sessions/{id}` | GET | classified session 조회 | `VIEW_CLASSIFIED_SESSION` | privacy scoped |
| `/bridge/manual-corrections` | POST | manual correction 요청 | `CORRECT_SESSION_CLASSIFICATION` | consent + audit required |
| `/bridge/review-escalations` | POST | scoped review escalation 요청 | `REQUEST_SCOPED_REVIEW_ESCALATION` | never clears safety hard-stop |
| `/bridge/rule-validation-runs` | POST | rule validation run 생성 | `RUN_RULE_VALIDATION` | RULE_SPEC_D1_D9 semantics only |
| `/bridge/rule-validation-runs/{id}` | GET | validation run 조회 | `VIEW_RULE_VALIDATION_RESULT` | evidence pointers included |
| `/bridge/profile-snapshots` | POST | athlete profile snapshot 저장 | `WRITE_ATHLETE_PROFILE_SNAPSHOT` | immutable snapshot |
| `/bridge/profile-snapshots/{id}` | GET | profile snapshot 조회 | `VIEW_ATHLETE_PROFILE` | active consent required |
| `/bridge/consents` | POST | consent grant 생성 | `MANAGE_PROFILE_CONSENT` | scoped, lifecycle audit |
| `/bridge/consents/onboarding` | POST | onboarding 분리 동의 일괄 생성 | `MANAGE_PROFILE_CONSENT` | separate records, minor guard |
| `/bridge/consents/{id}/revoke` | POST | consent revoke | `MANAGE_PROFILE_CONSENT` | append-only status |
| `/bridge/audit-logs` | GET | audit 조회 | `VIEW_AUDIT_LOG` | restricted access |

Daily Check-in API addendum:

| Endpoint | Method | Purpose | Required Capability | Notes |
|---|---|---|---|---|
| `/bridge/daily-checkins` | POST | structured daily check-in storage | `WRITE_DAILY_CHECKIN` or athlete self-check-in scope | creates DailyCheckInRecord, SourceSnapshotRecord, AuditLogRecord; raw memo/free-text is transient only |
| `/bridge/daily-checkins/{id}` | GET | daily check-in lookup | `VIEW_DAILY_CHECKIN` | scoped consent and tenant/group/athlete isolation required |
| `/bridge/athletes/{athleteId}/daily-checkins` | GET | athlete daily check-in list | `VIEW_DAILY_CHECKIN` | date range required; no raw memo/free-text returned |
| `/bridge/daily-checkins/{id}/redact-transient-note` | POST | safety cleanup for accidental transient note capture | `WRITE_DAILY_CHECKIN` plus privacy/admin review scope | must not be needed in normal flow; exists only as a defensive cleanup contract |

Physio source trust API addendum:

| Endpoint | Method | Purpose | Required Capability | Notes |
|---|---|---|---|---|
| `/bridge/physio-source-trust-results` | POST | physio source trust result storage | `WRITE_PHYSIO_SOURCE_TRUST_RESULT` | reason-code only; no raw payload/free-text |
| `/bridge/physio-source-trust-results/{id}` | GET | physio source trust result lookup | `VIEW_PHYSIO_SOURCE_TRUST_RESULT` | scoped consent and audit required |

## Section 10. Serialization Mapping

```yaml
serialization_mapping:
  yaml_policy_fields:
    style: snake_case
  typescript_contract_fields:
    style: camelCase
  invariant:
    semantic_value_must_be_preserved: true
  examples:
    source_snapshot_id: sourceSnapshotId
    source_snapshot_ids: sourceSnapshotIds
    tenant_id: tenantId
    group_id: groupId
    athlete_id: athleteId
    capability_grant_id: capabilityGrantId
    consent_grant_id: consentGrantId
    rule_namespace: ruleNamespace
    verdict_from_rule_spec: verdictFromRuleSpec
    severity_from_rule_spec: severityFromRuleSpec
    is_minor: isMinor
    guardian_consent_grant_id: guardianConsentGrantId
    mandatory_for_service: mandatoryForService
```

## Section 11. Safety and Privacy Invariants

```yaml
safety_privacy_invariants:
  no_global_coach_authority: true
  upload_allowed: false
  canonical_promotion_allowed: false
  external_llm_policy:
    free_beta_external_llm_calls_allowed: false
    pro_llm_role: EXPLAINER_ONLY
    llm_may_create_new_verdict: false
    llm_may_create_new_rule_value: false
  rule_safety:
    rule_spec_d9_hard_stop_may_be_cleared_by_coach: false
    scoped_review_escalation_may_clear_safety_hard_stop: false
    bridge_may_redefine_rule_spec_verdict: false
    bridge_may_redefine_rule_spec_severity: false
  privacy:
    public_specs_must_not_contain_private_athlete_data: true
    audit_required_for_sensitive_access: true
    reason_text_must_not_leak_private_medical_details: true
  consent_hard_guards:
    sensitive_processing_requires_active_scoped_consent: true
    sensitive_processing_without_consent: BLOCKED
    minor_requires_guardian_consent_for_sensitive_processing: true
    minor_physiological_processing_without_guardian_consent: BLOCKED
    bundled_all_or_nothing_consent: FORBIDDEN
    sensitive_consent_must_not_gate_base_service_access: true
  legal_disclaimer:
    bridge_is_not_a_legal_determination: true
    legal_review_required_before_production: true
```

## Section 12. TypeScript Contract

```typescript
export type ISO8601 = string;
export type TenantId = string;
export type GroupId = string;
export type AthleteId = string;
export type UserId = string;
export type SessionId = string;
export type SourceSnapshotId = string;
export type ClassifiedSessionId = string;
export type RuleValidationRunId = string;
export type RuleValidationResultId = string;
export type ProfileSnapshotId = string;
export type ConsentGrantId = string;
export type CapabilityGrantId = string;
export type AuditLogId = string;
export type DailyCheckInId = string;

export type RuleNamespace =
  | "RULE_SPEC_D1_D9"
  | "LEGACY_PHASE_D"
  | "CYCLE_DAY";

export interface NamespacedRuleRef {
  namespace: RuleNamespace;
  id: string;
  display: string;
}

export interface RuleSpecRuleRef {
  namespace: "RULE_SPEC_D1_D9";
  id: string;
  display: string;
}

type OpaqueRuleSpecPassthrough<TBrand extends string> = string & {
  readonly __brand: TBrand;
};

export type RuleSpecVerdictPassthrough =
  OpaqueRuleSpecPassthrough<"RULE_SPEC_D1_D9.verdict_passthrough">;

export type RuleSpecSeverityPassthrough =
  OpaqueRuleSpecPassthrough<"RULE_SPEC_D1_D9.severity_passthrough">;

export type BridgeCapability =
  | "VIEW_ATHLETE_PROFILE"
  | "WRITE_ATHLETE_PROFILE_SNAPSHOT"
  | "VIEW_PROFILE_AUDIT"
  | "MANAGE_PROFILE_CONSENT"
  | "CORRECT_SESSION_CLASSIFICATION"
  | "VIEW_CLASSIFIED_SESSION"
  | "WRITE_CLASSIFIED_SESSION"
  | "IMPORT_SOURCE_SNAPSHOT"
  | "WRITE_DAILY_CHECKIN"
  | "VIEW_DAILY_CHECKIN"
  | "RUN_RULE_VALIDATION"
  | "VIEW_RULE_VALIDATION_RESULT"
  | "REQUEST_SCOPED_REVIEW_ESCALATION"
  | "VIEW_AUDIT_LOG";

export type CapabilityGrantStatus =
  | "ACTIVE"
  | "REVOKED"
  | "EXPIRED"
  | "SUPERSEDED";

export type ConsentGrantStatus =
  | "DRAFT"
  | "ACTIVE"
  | "REVOKED"
  | "EXPIRED"
  | "SUPERSEDED";

export interface CapabilityGrantRecord {
  capabilityGrantId: CapabilityGrantId;
  tenantId: TenantId;
  groupId: GroupId;
  athleteId?: AthleteId;
  actorUserId: UserId;
  capability: BridgeCapability;
  status: CapabilityGrantStatus;
  createdAt: ISO8601;
  activatedAt: ISO8601;
  expiresAt?: ISO8601;
  revokedAt?: ISO8601;
  createdByUserId: UserId;
  auditLogId: AuditLogId;
}

export type ConsentType =
  | "ATHLETE_PROFILE_VISIBILITY"
  | "TRAINING_HISTORY_USE_FOR_PLAN_GENERATION"
  | "MANUAL_CLASSIFICATION_CORRECTION"
  | "SECONDARY_GROUP_ACCESS"
  | "PHYSIOLOGICAL_DATA_USE"
  | "GUARDIAN_CONSENT";

export interface ConsentGrantRecord {
  consentGrantId: ConsentGrantId;
  tenantId: TenantId;
  groupId: GroupId;
  athleteId: AthleteId;
  consentType: ConsentType;
  status: ConsentGrantStatus;
  mandatoryForService: boolean;
  isSensitiveCategory: boolean;
  capturedAtOnboarding: boolean;
  grantedByUserId: UserId;
  subjectUserId?: UserId;
  guardianUserId?: UserId;
  guardianConsentGrantId?: ConsentGrantId;
  scopeText: string;
  createdAt: ISO8601;
  activatedAt?: ISO8601;
  expiresAt?: ISO8601;
  revokedAt?: ISO8601;
  auditLogId: AuditLogId;
}

export interface OnboardingConsentCaptureRecord {
  onboardingConsentCaptureId: string;
  tenantId: TenantId;
  groupId: GroupId;
  athleteId: AthleteId;
  isMinor: boolean;
  guardianUserId?: UserId;
  guardianConsentGrantId?: ConsentGrantId;
  consentGrantIds: ConsentGrantId[];
  bundledAllOrNothing: false;
  sensitiveConsentGatesBaseService: false;
  createdAt: ISO8601;
  auditLogId: AuditLogId;
}

export type SourceType =
  | "GARMIN_IMPORT"
  | "GSHEET_INPUT"
  | "MANUAL_COACH_ENTRY"
  | "ATHLETE_SELF_REPORT"
  | "DAILY_CHECKIN_SELF_REPORT"
  | "LAB_PHYSIOLOGY"
  | "SYSTEM_DERIVED";

export interface SourceSnapshotRecord {
  sourceSnapshotId: SourceSnapshotId;
  tenantId: TenantId;
  groupId: GroupId;
  athleteId: AthleteId;
  sourceType: SourceType;
  primaryDeviceUsedForAnalysis: boolean;
  contentHashSha256: string;
  capturedAt: ISO8601;
  createdAt: ISO8601;
  createdByUserId: UserId;
  immutableAfterCreate: true;
}

export type PhysioSourceTrustStatus =
  | "TRUSTED_FOR_GENERATION"
  | "TRUSTED_FOR_LOW_RISK_CONTEXT_ONLY"
  | "REVIEW_REQUIRED"
  | "INSUFFICIENT_DATA"
  | "EXCLUDED_UNTRUSTED"
  | "BLOCKED_BY_CONSENT";

export interface PhysioSourceTrustResultRecord {
  physioSourceTrustResultId: string;
  tenantId: TenantId;
  groupId: GroupId;
  athleteId: AthleteId;
  sourceSnapshotId: SourceSnapshotId;
  consentGrantId?: ConsentGrantId;
  guardianConsentGrantId?: ConsentGrantId;
  trustStatus: PhysioSourceTrustStatus;
  sourceCategory: SourceType;
  recencyStatus: string;
  conflictStatus: string;
  consentStatus: string;
  nonSensitiveReasonCodes: readonly string[];
  rawPayloadStored: false;
  rawFreeTextStored: false;
  rawSymptomClauseStored: false;
  mayClearD9Risk: false;
  createdAt: ISO8601;
  auditLogId: AuditLogId;
}

export type DailyCheckInReadiness =
  | "NOT_READY"
  | "CAUTION"
  | "NORMAL"
  | "READY";

export type DailyCheckInBodyArea =
  | "HEAD_NECK"
  | "SHOULDER_ARM"
  | "CHEST_BACK"
  | "HIP_GLUTE"
  | "THIGH"
  | "KNEE"
  | "CALF_ACHILLES"
  | "ANKLE_FOOT"
  | "OTHER_STRUCTURED";

export interface DailyCheckInBodyAreaSignal {
  bodyArea: DailyCheckInBodyArea;
  side?: "LEFT" | "RIGHT" | "BILATERAL" | "UNSPECIFIED";
  level: 0 | 1 | 2 | 3 | 4 | 5;
  signalType: "SORENESS" | "PAIN_SIGNAL" | "TIGHTNESS" | "FATIGUE" | "OTHER_STRUCTURED";
  durationBand?: "TODAY_ONLY" | "TWO_TO_THREE_DAYS" | "FOUR_TO_SEVEN_DAYS" | "MORE_THAN_SEVEN_DAYS";
}

export interface DailyCheckInRecord {
  dailyCheckInId: DailyCheckInId;
  tenantId: TenantId;
  groupId: GroupId;
  athleteId: AthleteId;
  checkInDate: ISO8601;
  sourceSnapshotId: SourceSnapshotId;
  completedSessionRef?: ClassifiedSessionId;
  plannedSessionRef?: SessionId;
  rpe?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
  sleepHours?: number;
  sleepQuality?: "VERY_POOR" | "POOR" | "OK" | "GOOD" | "GREAT";
  overallCondition?: "VERY_LOW" | "LOW" | "NORMAL" | "GOOD" | "GREAT";
  mood?: "LOW" | "NEUTRAL" | "GOOD" | "HIGH";
  readiness?: DailyCheckInReadiness;
  sorenessOverall?: 0 | 1 | 2 | 3 | 4 | 5;
  bodyAreaSignals: readonly DailyCheckInBodyAreaSignal[];
  nonSensitiveReasonCodes: readonly string[];
  redactedNonSensitiveSummary?: string;
  extractionVersion?: string;
  rawMemoStored: false;
  rawFreeTextStored: false;
  rawSymptomClauseStored: false;
  rawMedicalNoteStored: false;
  rawGuardianPrivateNoteStored: false;
  mayRaiseReviewOrBlock: true;
  mayClearD9Risk: false;
  mayClearSafetyGateBlock: false;
  createdAt: ISO8601;
  auditLogId: AuditLogId;
  immutableAfterCreate: true;
}

export interface ClassifiedSessionRecord {
  classifiedSessionId: ClassifiedSessionId;
  tenantId: TenantId;
  groupId: GroupId;
  athleteId: AthleteId;
  sessionId: SessionId;
  sourceSnapshotId: SourceSnapshotId;
  profileSnapshotId?: ProfileSnapshotId;
  classifierSpecVersion: "1.2";
  intensityFinal: string;
  energySystem: string;
  state: string;
  tags: string[];
  durationMin?: number;
  confidence: "HIGH" | "MED" | "LOW" | "UNCERTAIN";
  createdAt: ISO8601;
  immutableAfterCreate: true;
}

export interface ManualClassificationCorrectionRecord {
  correctionId: string;
  tenantId: TenantId;
  groupId: GroupId;
  athleteId: AthleteId;
  classifiedSessionId: ClassifiedSessionId;
  actorUserId: UserId;
  capabilityGrantId: CapabilityGrantId;
  consentGrantId: ConsentGrantId;
  isCoachOverride: false;
  affectsRawValidationResult: false;
  affectsSafetyHardStop: false;
  mustNotClearOrTriggerDRuleResult: true;
  reasonCode: string;
  reasonText?: string;
  createdAt: ISO8601;
  auditLogId: AuditLogId;
}

export interface ScopedReviewEscalationRecord {
  scopedReviewEscalationId: string;
  tenantId: TenantId;
  groupId: GroupId;
  athleteId: AthleteId;
  classifiedSessionId?: ClassifiedSessionId;
  ruleValidationResultId?: RuleValidationResultId;
  actorUserId: UserId;
  capabilityGrantId: CapabilityGrantId;
  consentGrantId?: ConsentGrantId;
  isCoachGlobalAuthority: false;
  mayModifyRawSource: false;
  mayModifyOriginalClassification: false;
  mayClearSafetyHardStop: false;
  mayRedefineRuleSpecResult: false;
  reasonCode: string;
  reasonText?: string;
  createdAt: ISO8601;
  auditLogId: AuditLogId;
}

export interface RuleValidationRunRecord {
  ruleValidationRunId: RuleValidationRunId;
  tenantId: TenantId;
  groupId: GroupId;
  athleteId: AthleteId;
  ruleSpecVersion: "1.4";
  sourceSnapshotIds: SourceSnapshotId[];
  classifiedSessionIds: ClassifiedSessionId[];
  profileSnapshotId?: ProfileSnapshotId;
  createdAt: ISO8601;
  createdByUserId: UserId;
  immutableAfterCreate: true;
}

export interface RuleValidationResultRecord {
  ruleValidationResultId: RuleValidationResultId;
  ruleValidationRunId: RuleValidationRunId;
  tenantId: TenantId;
  groupId: GroupId;
  athleteId: AthleteId;
  ruleRef: RuleSpecRuleRef;
  // Opaque passthrough only. Values are produced and defined exclusively by
  // RULE_SPEC_D1_D9. APP_IMPLEMENTATION_BRIDGE must not enumerate, reinterpret,
  // downgrade, upgrade, or redefine verdict/severity semantics.
  verdictFromRuleSpec: RuleSpecVerdictPassthrough;
  severityFromRuleSpec?: RuleSpecSeverityPassthrough;
  evidenceSnapshotIds: SourceSnapshotId[];
  createdAt: ISO8601;
  immutableAfterCreate: true;
}

export interface AthleteProfileSnapshotStorageRecord {
  profileSnapshotId: ProfileSnapshotId;
  tenantId: TenantId;
  groupId: GroupId;
  athleteId: AthleteId;
  groupIdAtSnapshot: GroupId;
  athleteProfileSpecVersion: "1.0";
  sourceSnapshotIds?: SourceSnapshotId[];
  contentHashSha256: string;
  createdAt: ISO8601;
  createdByUserId: UserId;
  immutableAfterCreate: true;
}

export interface SecondaryGroupGrantRecord {
  secondaryGroupGrantId: string;
  tenantId: TenantId;
  primaryGroupId: GroupId;
  secondaryGroupId: GroupId;
  athleteId: AthleteId;
  consentGrantId: ConsentGrantId;
  capabilityGrantId: CapabilityGrantId;
  doesNotGrantVisibility: true;
  doesNotGrantAuthority: true;
  validationContextGroupMustBeExplicit: true;
  requiresIndependentCapabilityGrant: true;
  status: CapabilityGrantStatus;
  createdAt: ISO8601;
  expiresAt?: ISO8601;
  revokedAt?: ISO8601;
  auditLogId: AuditLogId;
}

export interface AuditLogRecord {
  auditLogId: AuditLogId;
  tenantId: TenantId;
  groupId?: GroupId;
  athleteId?: AthleteId;
  actorUserId: UserId;
  action: string;
  targetRecordType: string;
  targetRecordId: string;
  createdAt: ISO8601;
  reasonCode?: string;
  privacyLevel: "PUBLIC" | "INTERNAL" | "PRIVATE" | "SENSITIVE";
}
```

## Section 13. Open Issues

| ID | Priority | Canonical Blocking | Area | Summary | Owner |
|---|---|---|---|---|---|
| OI-AIB-RLS-STRATEGY-001 | P1 | true | Isolation | 실제 row-level isolation 구현 방식 확정 필요 | APP_BRIDGE_DESIGNER |
| OI-AIB-RETENTION-POLICY-001 | P1 | true | Retention | profile, consent, source snapshot retention matrix 확정 필요 | COACH_HOJUNE |
| OI-AIB-ENCRYPTION-KEY-MGMT-001 | P1 | true | Security | sensitive record encryption key 관리 방식 확정 필요 | APP_BRIDGE_DESIGNER |
| OI-AIB-PHYSIO-SOURCE-001 | P1 | true | Physiology | physiological source trust 등급과 사용 가능 범위 확정 필요 | APP_BRIDGE_DESIGNER |
| OI-AIB-DB-VENDOR-001 | P2 | false | Storage | DB vendor 결정은 별도 | IMPLEMENTATION |
| OI-AIB-IDEMPOTENCY-001 | P2 | false | API | POST endpoint idempotency key 정책 상세화 필요 | IMPLEMENTATION |
| OI-AIB-OBSERVABILITY-001 | P2 | false | Operations | audit와 observability 로그 분리 기준 필요 | IMPLEMENTATION |
| OI-AIB-EXPORT-SCOPE-001 | P2 | false | Privacy | athlete data export 범위와 포맷 정의 필요 | APP_BRIDGE_DESIGNER |
| OI-AIB-HASH-CANONICALIZATION-001 | P2 | false | Source Snapshot | source content hash canonicalization 규칙 상세화 필요 | IMPLEMENTATION |
| OI-AIB-SECONDARY-GROUP-UX-001 | P2 | false | Group Access | secondary group grant의 UI 흐름은 후속 화면 SPEC에서 정의 | APP_UI |
| OI-AIB-ESCALATION-LIFECYCLE-001 | P2 | false | Escalation | scoped review escalation의 상태 전이와 종결 처리 정의 필요 | APP_BRIDGE_DESIGNER |
| OI-AIB-LEGAL-REVIEW-001 | P2 | false | Legal | onboarding 분리 동의·미성년 보호자 동의 흐름의 실제 법률 검토 필요 | COACH_HOJUNE |

Physio source trust issue addendum:

```yaml
OI-AIB-PHYSIO-SOURCE-001:
  status: OPEN
  target_patch_status: PATCHED_PENDING_SOURCE_ACCEPTANCE
  closure_allowed_now: false
  closure_requires:
    - PHYSIO_SOURCE_TRUST_SPEC.md owner/source acceptance
    - target open issue table recount from this file
    - implementation/privacy review before production storage
```

Daily Log binding issue addendum:

```yaml
OI-DLC-APP-BRIDGE-BINDING-001:
  status: OPEN
  target_patch_status: PATCHED_PENDING_SOURCE_ACCEPTANCE_AND_TARGET_RECOUNT
  closure_allowed_now: false
  closure_requires:
    - DAILY_LOG_AND_CHECKIN_SPEC.md owner/source acceptance
    - target open issue table recount from this file
    - implementation/privacy review proving raw memo/free-text is transient only
    - no runtime evidence claim from this target-local patch
```

## Section 14. Test Cases

| ID | Area | Scenario | Expected | Result |
|---|---|---|---|---|
| AIB-TC-001 | Integrity | 문서 첫 줄이 `# APP_IMPLEMENTATION_BRIDGE.md`이다 | H1 일치 | PASS |
| AIB-TC-002 | Metadata | `upload_allowed: false` 유지 | false | PASS |
| AIB-TC-003 | Metadata | `canonical_promotion_allowed: false` 유지 | false | PASS |
| AIB-TC-004 | Baseline | RULE_SPEC_D1_D9 v1.4를 read-only baseline으로 참조 | 참조됨 | PASS |
| AIB-TC-005 | Baseline | SESSION_CLASSIFIER_SPEC v1.2를 read-only baseline으로 참조 | 참조됨 | PASS |
| AIB-TC-006 | Baseline | ATHLETE_PROFILE_SPEC v1.0을 read-only baseline으로 참조 | 참조됨 | PASS |
| AIB-TC-007 | Baseline | ATHLETE_PROFILE baseline role이 pending_canonical_promotion으로 표기 | 정확 표기 | PASS |
| AIB-TC-008 | Namespace | unnamespaced D 참조 금지 정책 존재 | 정책 존재 | PASS |
| AIB-TC-009 | Namespace | `RULE_SPEC_D1_D9` namespace 정의 | 정의됨 | PASS |
| AIB-TC-010 | Namespace | `LEGACY_PHASE_D` namespace 정의 | 정의됨 | PASS |
| AIB-TC-011 | Namespace | `CYCLE_DAY` namespace 정의 | 정의됨 | PASS |
| AIB-TC-012 | Authority | 전역 코치 권한 금지 | 금지됨 | PASS |
| AIB-TC-013 | Isolation | tenantId 필수 record 정의 | 정의됨 | PASS |
| AIB-TC-014 | Isolation | groupId 필수 sensitive record 정의 | 정의됨 | PASS |
| AIB-TC-015 | Isolation | athleteId 필수 athlete-scoped record 정의 | 정의됨 | PASS |
| AIB-TC-016 | Capability | `CORRECT_SESSION_CLASSIFICATION` capability 정의 | 정의됨 | PASS |
| AIB-TC-017 | Consent | manual correction에 consentGrantId 필요 | 필수 | PASS |
| AIB-TC-018 | Manual Correction | `isCoachOverride: false` invariant 존재 | 존재 | PASS |
| AIB-TC-019 | Manual Correction | `affectsSafetyHardStop: false` invariant 존재 | 존재 | PASS |
| AIB-TC-020 | Manual Correction | `mustNotClearOrTriggerDRuleResult: true` invariant 존재 | 존재 | PASS |
| AIB-TC-021 | Escalation | legacy override 네이밍 제거됨 | 제거됨 | PASS |
| AIB-TC-022 | Escalation | `REQUEST_SCOPED_REVIEW_ESCALATION` capability 정의 | 정의됨 | PASS |
| AIB-TC-023 | Escalation | escalation은 safety hard-stop 해제 불가 | 불가 | PASS |
| AIB-TC-024 | Rule Result | verdict/severity가 opaque passthrough로 처리 | passthrough | PASS |
| AIB-TC-025 | Rule Result | Bridge가 verdict 값을 정의하지 않음 | 정의 안 함 | PASS |
| AIB-TC-026 | Rule Storage | RuleValidationResultRecord에 verdictFromRuleSpec 필드 존재 | 존재 | PASS |
| AIB-TC-027 | Rule Result | ruleRef가 RuleSpecRuleRef로 RULE_SPEC_D1_D9에 고정됨 | 고정됨 | PASS |
| AIB-TC-028 | Consent | ConsentGrantStatus에 DRAFT 포함 | 포함 | PASS |
| AIB-TC-029 | Consent | CapabilityGrantStatus와 ConsentGrantStatus 분리됨 | 분리됨 | PASS |
| AIB-TC-030 | Source Snapshot | source snapshot immutable after create | immutable | PASS |
| AIB-TC-031 | Source Snapshot | SHA256 content hash required | required | PASS |
| AIB-TC-032 | Profile Storage | AthleteProfileSnapshotStorageRecord에 sourceSnapshotIds 존재 | 존재 | PASS |
| AIB-TC-033 | Primary Device | primary device only analysis policy 존재 | 존재 | PASS |
| AIB-TC-034 | LLM Safety | Free/Beta external LLM call 금지 | 금지 | PASS |
| AIB-TC-035 | LLM Safety | LLM은 explainer only | explainer only | PASS |
| AIB-TC-036 | Rule Storage | RuleValidationRunRecord 정의 | 정의됨 | PASS |
| AIB-TC-037 | Session Storage | ClassifiedSessionRecord 정의 | 정의됨 | PASS |
| AIB-TC-038 | Secondary Group | SecondaryGroupGrantRecord에 4대 invariant 명시 | 명시됨 | PASS |
| AIB-TC-039 | Onboarding Consent | 가입 동의가 분리 record로 생성됨 | 분리됨 | PASS |
| AIB-TC-040 | Onboarding Consent | bundled all-or-nothing 동의 금지 | 금지됨 | PASS |
| AIB-TC-041 | Onboarding Consent | 민감 동의가 기본 서비스 접근을 막지 않음 | 안 막음 | PASS |
| AIB-TC-042 | Minor Guard | 미성년이면 보호자 동의 별도 record 필요 | 필요 | PASS |
| AIB-TC-043 | Minor Guard | 미성년 생리데이터 처리에 보호자 동의 없으면 BLOCKED | BLOCKED | PASS |
| AIB-TC-044 | Consent Guard | 동의 없는 민감 처리 BLOCKED | BLOCKED | PASS |
| AIB-TC-045 | Legal | 법률 검토 필요 명시 + non-legal-determination 면책 | 명시됨 | PASS |
| AIB-TC-046 | Open Issues | open issues total = 12, canonical blocking = 4 | 12 / 4 | PASS |

## Section 15. Self-Validation

```yaml
self_validation:
  overall: PASS
  recalculated_from_final_draft: true
  seed_counts_not_copied: true
  checks:
    first_line_is_h1_exact: PASS
    metadata_yaml_fence_present: PASS
    all_policy_blocks_yaml_fenced: PASS
    typescript_block_fenced_and_closed: PASS
    dependency_table_is_markdown_pipe_table: PASS
    api_table_is_markdown_pipe_table: PASS
    open_issues_table_is_markdown_pipe_table: PASS
    test_cases_table_is_markdown_pipe_table: PASS
    no_unscoped_operational_d_reference: PASS
    no_global_coach_authority: PASS
    legacy_override_naming_removed: PASS
    verdict_severity_opaque_passthrough: PASS
    rule_result_ref_fixed_to_rule_spec_namespace: PASS
    capability_and_consent_status_types_separated: PASS
    consent_draft_state_present: PASS
    timestamp_fields_status_dependent_consistent: PASS
    profile_snapshot_source_ref_present: PASS
    secondary_group_four_invariants_present: PASS
    onboarding_scoped_consent_model_present: PASS
    bundled_all_or_nothing_consent_forbidden: PASS
    minor_guardian_consent_guard_present: PASS
    sensitive_processing_hard_guard_present: PASS
    legal_review_required_flag_present: PASS
    not_a_legal_determination_disclaimer_present: PASS
    ld_min_segment_cross_spec_tracked: PASS
    upstream_specs_unmodified: PASS
    upload_allowed_false: PASS
    canonical_promotion_allowed_false: PASS
  counts:
    open_issues_total: 12
    open_issues_canonical_blocking_count: 4
    test_cases_total: 46
    test_cases_passed: 46
  count_consistency:
    metadata_matches_section_13: true
    metadata_matches_section_14: true
  resolved_this_round:
    - OI-AIB-CONSENT-LEGAL-BASIS-001
    - OI-AIB-GUARDIAN-CONSENT-001
  newly_opened_this_round:
    - OI-AIB-LEGAL-REVIEW-001
```

## Section 16. Handoff Summary

```yaml
handoff_summary:
  from: DESIGNER_OPUS_4_8
  to: REVIEWER_GPT_5_5_PRO
  target: APP_IMPLEMENTATION_BRIDGE.md
  version: "1.1"
  round: RT4
  status: DRAFT_FOR_REVIEW
  delivery_mode: SINGLE_RESPONSE_FULL_DOCUMENT
  upstream_baselines:
    - "RULE_SPEC_D1_D9.md v1.4 (READ_ONLY_APPROVED)"
    - "SESSION_CLASSIFIER_SPEC.md v1.2 (READ_ONLY_APPROVED)"
    - "ATHLETE_PROFILE_SPEC.md v1.0 (READ_ONLY_LOCAL_APPROVED_PENDING_CANONICAL_PROMOTION)"
  rt4_applied_changes:
    - onboarding_scoped_consent_model_added
    - bundled_all_or_nothing_consent_forbidden
    - sensitive_consent_must_not_gate_base_service
    - minor_guardian_consent_guard_added
    - sensitive_processing_hard_guards_added
    - consent_record_extended_with_minor_and_guardian_fields
    - onboarding_consent_capture_record_added
    - legal_review_open_issue_added
    - physio_source_trust_storage_boundary_pending_acceptance
  resolved_open_issues:
    - OI-AIB-CONSENT-LEGAL-BASIS-001
    - OI-AIB-GUARDIAN-CONSENT-001
  open_issues_count: 12
  canonical_blocking_count: 4
  test_cases_passed: 46
  remaining_canonical_blocking:
    - OI-AIB-RLS-STRATEGY-001
    - OI-AIB-RETENTION-POLICY-001
    - OI-AIB-ENCRYPTION-KEY-MGMT-001
    - OI-AIB-PHYSIO-SOURCE-001
  next_recommended_actions:
    - reviewer_validate_against_baselines
    - coach_resolve_remaining_4_canonical_blocking_open_issues
    - legal_review_of_consent_flow_before_production
    - coach_local_final_approval_after_quality_gate
  final_decision:
    status: DRAFT_FOR_REVIEW
    upload_allowed: false
    canonical_promotion_allowed: false
    canonical_ready: false
```

[DRAFT_COMPLETE]
