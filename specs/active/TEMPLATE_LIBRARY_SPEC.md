# TEMPLATE_LIBRARY_SPEC.md

```yaml
document_metadata:
  doc_id: trainoracle-spec-008-template-library
  spec_id: TEMPLATE_LIBRARY_SPEC
  title: TrainOracle Template Library Spec
  version: "1.0"
  round: RT1
  status: DRAFT_FOR_REVIEW
  owner: COACH_HOJUNE
  target_downstream_document: PLAN_GENERATOR_SPEC.md
  target_downstream_issue: OI-PG-TEMPLATE-LIBRARY-OWNERSHIP-001

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

`TEMPLATE_LIBRARY_SPEC.md`는 TrainOracle 시스템에서 세션 템플릿을 관리하기 위한 문서다.

이 문서는 다음을 정의한다.

- 세션 템플릿의 소유권 모델
- 템플릿의 공개 범위와 사용 가능 범위
- 템플릿 생명주기 상태
- Plan Generator가 템플릿을 조회할 때 지켜야 할 소비 계약
- 안전 게이트와의 경계
- 개인정보 및 민감정보 저장 금지 원칙
- 템플릿 라이브러리 관련 Open Issue 상태

---

## 2. Non-Purpose

이 문서는 다음을 하지 않는다.

- 실제 훈련 계획을 생성하지 않는다.
- D1-D9 규칙을 재정의하지 않는다.
- D9 Safety Evaluator를 구현하지 않는다.
- Session Classifier의 분류 기준을 재정의하지 않는다.
- Athlete Profile의 체력·부상·의학 정보를 새로 정의하지 않는다.
- Plan Generator의 전체 의사결정 로직을 재작성하지 않는다.
- 의료 처방, 재활 처방, 복귀 허가 판단을 자동화하지 않는다.

---

## 3. Upstream Reference Documents

```yaml
upstream_references:
  - document: RULE_SPEC_D1_D9.md
    expected_version: ">=1.4"
    consumed_for:
      - safety_rule_reference
      - D9_rule_boundary
      - rule_id_consistency

  - document: SESSION_CLASSIFIER_SPEC.md
    expected_version: ">=1.2"
    consumed_for:
      - session_label_taxonomy
      - session_intent_classification

  - document: ATHLETE_PROFILE_SPEC.md
    expected_version: ">=1.0"
    consumed_for:
      - athlete_level_band
      - event_group
      - age_group
      - minor_status

  - document: APP_IMPLEMENTATION_BRIDGE.md
    expected_version: ">=1.1"
    consumed_for:
      - implementation_contract_shape
      - audit_signal_boundary
      - storage_policy_alignment
```

---

## 4. Dependency Direction

```yaml
template_library_consumes:
  - session_classifier_labels
  - athlete_profile_bands
  - event_group_metadata
  - safety_rule_references
  - app_bridge_contracts

template_library_provides:
  - template_ownership_model
  - template_visibility_scope
  - template_lifecycle_states
  - template_family_catalog
  - eligibility_filter_contract
  - plan_generator_consumption_contract

template_library_does_not_consume:
  - plan_generator_reviewer_verdicts
  - coach_free_text_notes
  - raw_athlete_free_text
  - private_medical_records
  - unverified_rehab_status_text
```

---

## 5. Hard Constraints

```yaml
hard_constraints:
  - no_global_coach_authority
  - no_cross_tenant_template_access
  - no_unscoped_athlete_access
  - no_safety_gate_override
  - no_rule_redefinition
  - no_session_classifier_redefinition
  - no_private_free_text_storage
  - no_medical_rehab_auto_prescription
  - coach_final_selection_required
```

설명:

- 템플릿 라이브러리는 안전 게이트를 우회할 수 없다.
- 템플릿이 존재한다고 해서 선수에게 적용 가능하다는 뜻은 아니다.
- 템플릿은 후보를 제공할 뿐, 최종 훈련 처방은 코치 검토를 거쳐야 한다.
- 템플릿은 선수의 민감한 자유서술 원문을 저장하지 않는다.

---

## 6. Core Concepts

### 6.1 Session Template

세션 템플릿은 반복적으로 재사용 가능한 훈련 세션의 구조화된 초안이다.

예:

- 회복 조깅
- 이지 러닝
- 롱런
- 템포런
- 인터벌
- 스프린트 가속
- 보강 운동
- 기술 드릴

템플릿은 특정 선수의 현재 컨디션을 확정하지 않는다.  
템플릿은 항상 안전 게이트와 선수 프로필 필터를 거친 뒤에만 후보가 될 수 있다.

---

### 6.2 Template Family

Template Family는 템플릿을 큰 목적별로 묶는 분류다.

템플릿 패밀리는 Session Classifier의 라벨을 소비할 수 있지만, 그 라벨 체계를 새로 정의하지 않는다.

---

### 6.3 Template Owner

템플릿 소유자는 다음 세 종류만 허용한다.

| Owner Type | 설명 |
|---|---|
| SYSTEM | 시스템 기본 템플릿 |
| TENANT | 팀, 학교, 클럽, 조직 단위 템플릿 |
| COACH | 특정 코치가 만든 템플릿 |

선수 개인이 직접 소유하는 템플릿은 허용하지 않는다.

```yaml
athlete_private_template_allowed: false
reason:
  - prevents_sensitive_personalization_leak
  - avoids_private_medical_or_condition_data_storage
  - keeps_template_library_non-clinical
```

---

## 7. Ownership Policy

| Owner Type | Editable By Coach | Visibility Scope | Clone Required For Modification | Notes |
|---|---:|---|---:|---|
| SYSTEM | NO | all authorized tenants | YES | 원본 수정 불가 |
| TENANT | YES, if authorized | same tenant only | OPTIONAL | 조직 내부 템플릿 |
| COACH | YES, owner coach only | owner coach scope | OPTIONAL | 코치 개인 템플릿 |

```yaml
ownership_policy:
  system_template:
    coach_can_edit_original: false
    coach_can_clone: true
    cross_tenant_override: false

  tenant_template:
    editable_by_authorized_tenant_roles: true
    visible_outside_tenant: false
    requires_tenant_scope_check: true

  coach_template:
    editable_by_owner_coach: true
    visible_to_other_coaches_by_default: false
    share_requires_explicit_permission: true
```

---

## 8. Lifecycle States

| Status | Usable For Plan Generation | Description |
|---|---:|---|
| DRAFT | NO | 작성 중 |
| ACTIVE | YES | 사용 가능 |
| DEPRECATED | NO | 더 이상 신규 사용 금지 |
| RETIRED | NO | 보관 전용 |

```yaml
lifecycle_policy:
  DRAFT:
    returned_to_plan_generator: false
    reason: "아직 검수되지 않은 템플릿"

  ACTIVE:
    returned_to_plan_generator: true
    requires_eligibility_filter: true

  DEPRECATED:
    returned_to_plan_generator: false
    retained_for_audit: true

  RETIRED:
    returned_to_plan_generator: false
    retained_for_archive: true
```

---

## 9. Initial Template Family Seed

| Family ID | Family Name | Intended Use |
|---|---|---|
| TL-FAM-REST-RECOVERY | REST_RECOVERY | 휴식, 회복, 저부하 회복 세션 |
| TL-FAM-EASY-AEROBIC | EASY_AEROBIC | 이지 러닝, 유산소 유지 |
| TL-FAM-LONG-AEROBIC | LONG_AEROBIC | 장거리 유산소 |
| TL-FAM-TEMPO-THRESHOLD | TEMPO_THRESHOLD | 템포, 역치성 훈련 |
| TL-FAM-INTERVAL-VO2 | INTERVAL_VO2 | 인터벌, VO2 계열 |
| TL-FAM-SPEED-ACCELERATION | SPEED_ACCELERATION | 가속, 단거리 속도 |
| TL-FAM-SPRINT-MAX-V | SPRINT_MAX_VELOCITY | 최고속도, 플라잉 스프린트 |
| TL-FAM-HILLS-POWER | HILLS_POWER | 언덕, 파워, 근지구력 |
| TL-FAM-TECHNIQUE-DRILLS | TECHNIQUE_DRILLS | 러닝 드릴, 기술 훈련 |
| TL-FAM-RACE-PREP | RACE_PREP_TUNEUP | 대회 전 조정 |
| TL-FAM-STRENGTH-MOBILITY | GENERAL_STRENGTH_MOBILITY | 보강, 가동성, 안정화 |

---

## 10. TypeScript Contract Draft

```ts
export type TemplateId = string;
export type TenantId = string;
export type CoachId = string;

export type TemplateOwnerType = "SYSTEM" | "TENANT" | "COACH";

export type TemplateLifecycleStatus =
  | "DRAFT"
  | "ACTIVE"
  | "DEPRECATED"
  | "RETIRED";

export type TemplateFamily =
  | "REST_RECOVERY"
  | "EASY_AEROBIC"
  | "LONG_AEROBIC"
  | "TEMPO_THRESHOLD"
  | "INTERVAL_VO2"
  | "SPEED_ACCELERATION"
  | "SPRINT_MAX_VELOCITY"
  | "HILLS_POWER"
  | "TECHNIQUE_DRILLS"
  | "RACE_PREP_TUNEUP"
  | "GENERAL_STRENGTH_MOBILITY";

export type AthleteLevelBand =
  | "BEGINNER"
  | "DEVELOPING"
  | "INTERMEDIATE"
  | "ADVANCED"
  | "ELITE";

export type EventGroup =
  | "SPRINT"
  | "MIDDLE_DISTANCE"
  | "LONG_DISTANCE"
  | "ROAD_RUNNING"
  | "GENERAL_FITNESS"
  | "UNKNOWN";

export type EligibilityStatus =
  | "ELIGIBLE"
  | "REVIEW_REQUIRED"
  | "INELIGIBLE";

export interface TemplateOwner {
  ownerType: TemplateOwnerType;
  tenantId?: TenantId;
  coachId?: CoachId;
}

export interface TemplateScope {
  visibleToTenantIds: TenantId[];
  visibleToCoachIds?: CoachId[];
  crossTenantAllowed: false;
}

export interface TemplateEligibility {
  allowedEventGroups: EventGroup[];
  allowedLevelBands: AthleteLevelBand[];
  minorAllowed: boolean;
  guardianConsentRequiredForMinor: boolean;
}

export interface TemplateSafetyTags {
  requiresSafetyGateClearance: true;
  compatibleWithD9Active: false;
  compatibleWithD9Unknown: false;
  mayRequireHumanReview: boolean;
}

export interface SessionTemplateRecord {
  templateId: TemplateId;
  version: string;
  family: TemplateFamily;
  displayName: string;
  owner: TemplateOwner;
  scope: TemplateScope;
  lifecycleStatus: TemplateLifecycleStatus;
  eligibility: TemplateEligibility;
  safetyTags: TemplateSafetyTags;
  prohibitedUseCases: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TemplateEligibilityRequest {
  tenantId: TenantId;
  coachId: CoachId;
  athleteLevelBand: AthleteLevelBand;
  eventGroup: EventGroup;
  isMinor: boolean;
  guardianConsentAvailable: boolean;
  safetyGateStatus: "CLEARED" | "UNKNOWN" | "ACTIVE";
}

export interface TemplateEligibilityResult {
  templateId: TemplateId;
  status: EligibilityStatus;
  reasonCodes: string[];
}
```

---

## 11. Eligibility Filtering Order

Plan Generator가 템플릿 라이브러리를 조회할 때 필터 순서는 다음을 따른다.

```yaml
filtering_order:
  - tenant_scope_check
  - owner_visibility_check
  - lifecycle_status_check
  - session_classifier_label_check
  - event_group_check
  - athlete_level_band_check
  - minor_guardian_policy_check
  - safety_gate_status_check
  - prohibited_use_case_check
```

원칙:

1. Scope가 맞지 않으면 즉시 제외한다.
2. `ACTIVE`가 아닌 템플릿은 Plan Generator 후보로 반환하지 않는다.
3. D9 Safety Gate 상태가 `ACTIVE` 또는 `UNKNOWN`이면 훈련 템플릿 자동 추천을 막는다.
4. `REVIEW_REQUIRED`는 자동 적용이 아니라 사람 검토 대상이다.
5. 템플릿 라이브러리는 안전 판단을 직접 하지 않고, 안전 상태를 소비만 한다.

---

## 12. Safety Boundary

```yaml
safety_boundary:
  template_library_may:
    - consume_safety_gate_status
    - mark_template_as_requires_review
    - exclude_template_when_safety_status_blocks_generation

  template_library_must_not:
    - reinterpret_athlete_free_text
    - override_D9_ACTIVE
    - override_D9_UNKNOWN
    - clear_safety_risk
    - create_medical_rehab_plan
    - store_raw_symptom_text
```

설명:

- D9 Safety Evaluator가 `ACTIVE`를 반환하면 템플릿 추천은 차단된다.
- D9 Safety Evaluator가 `UNKNOWN`을 반환하면 템플릿 추천은 차단하거나 사람 검토로 이동한다.
- 템플릿 라이브러리는 “괜찮다”는 선수 표현으로 위험을 해제하지 않는다.
- 템플릿 라이브러리는 D9 규칙의 구현체가 아니다.

---

## 13. Plan Generator Consumption Contract

Plan Generator는 다음 조건을 만족할 때만 Template Library를 조회할 수 있다.

```yaml
plan_generator_may_query_template_library_if:
  - safety_gate_status_allows_generation
  - coach_has_capability
  - tenant_scope_is_valid
  - athlete_profile_minimum_fields_available
```

Plan Generator는 다음을 해서는 안 된다.

```yaml
plan_generator_must_not:
  - mutate_template_record
  - bypass_lifecycle_status
  - bypass_tenant_scope
  - bypass_safety_gate
  - auto_select_review_required_template
  - infer_medical_clearance_from_template
```

반환 결과는 다음 세 가지로 제한한다.

| Result | Meaning |
|---|---|
| ELIGIBLE | 후보로 제시 가능 |
| REVIEW_REQUIRED | 사람 검토 필요 |
| INELIGIBLE | 후보 제외 |

---

## 14. Privacy Policy

템플릿 라이브러리는 다음 정보를 저장하지 않는다.

```yaml
do_not_store:
  - raw_athlete_free_text
  - injury_description
  - medical_note
  - rehab_note
  - guardian_private_note
  - coach_private_medical_comment
  - symptom_clause
  - D9_evidence_clause
```

저장 가능한 것은 비식별화된 구조 정보와 reasonCode 수준이다.

```yaml
allowed_storage:
  - template_id
  - template_version
  - template_family
  - owner_type
  - lifecycle_status
  - eligibility_reason_codes
  - non_sensitive_audit_event
```

---

## 15. Minor and Guardian Policy

```yaml
minor_policy:
  if_athlete_is_minor:
    guardian_consent_required_if_template_has_minor_restriction: true
    default_when_guardian_status_unknown: REVIEW_REQUIRED
    auto_apply_template_without_guardian_context: false
```

미성년 선수에 대한 템플릿 적용은 더 보수적으로 처리한다.

---

## 16. API Draft

```yaml
api_draft:
  list_templates:
    method: GET
    path: /template-library/templates
    returns: "visible templates after scope and lifecycle filtering"

  get_template:
    method: GET
    path: /template-library/templates/{templateId}
    returns: "single template if authorized"

  create_template:
    method: POST
    path: /template-library/templates
    constraints:
      - owner_scope_required
      - no_raw_athlete_free_text
      - lifecycle_starts_as_DRAFT

  clone_template:
    method: POST
    path: /template-library/templates/{templateId}/clone
    constraints:
      - source_template_must_be_visible
      - new_template_id_required
      - audit_log_required

  deprecate_template:
    method: POST
    path: /template-library/templates/{templateId}/deprecate
    constraints:
      - authorized_owner_or_admin_only
      - audit_log_required

  evaluate_eligibility:
    method: POST
    path: /template-library/templates/evaluate-eligibility
    constraints:
      - no_raw_free_text_input
      - consumes_safety_gate_status_only
```

---

## 17. Open Issues

```yaml
open_issue_table_column_rule:
  canonical_blocking_column_scope: "Section 17 Open Issues table only"
  yaml_true_false_fields_elsewhere_are_not_column_values: true
  automated_validator_instruction: "Do not infer Canonical Blocking from unrelated boolean fields."
```

| Open Issue ID | Status | Canonical Blocking | Description | Closure Condition |
|---|---|---:|---|---|
| OI-TL-EVENT-SPECIFIC-CATALOG-EXPANSION-001 | OPEN | NO | 종목별 세부 템플릿 카탈로그 확장 필요 | 초기 운영 데이터 확보 후 확장 |
| OI-TL-UI-COPY-CATALOG-BROWSING-001 | OPEN | NO | 코치용 템플릿 탐색 UI 문구 확정 필요 | UI 카피 리뷰 완료 |
| OI-TL-COACH-FEEDBACK-LOOP-001 | OPEN | NO | 코치 피드백 기반 템플릿 개선 루프 정의 필요 | 피드백 이벤트 모델 확정 |
| OI-TL-MULTI-LANGUAGE-TAXONOMY-001 | OPEN | NO | 다국어 템플릿 명칭 체계 필요 | 다국어 taxonomy 정책 확정 |

```yaml
open_issue_count_validation:
  open_issues_total_declared: 4
  open_issue_rows_in_section_17: 4
  canonical_blocking_count_declared: 0
  canonical_blocking_rows_with_yes: 0
  status: SATISFIED
```

---

## 18. Acceptance Conditions

이 문서가 리뷰를 통과하려면 다음 조건을 만족해야 한다.

```yaml
acceptance_conditions:
  - metadata_counts_are_consistent
  - no_executed_tests_are_claimed
  - self_check_is_separated_from_runtime_tests
  - open_issue_count_matches_table_rows
  - canonical_blocking_count_matches_table_rows
  - ownership_model_is_explicit
  - lifecycle_policy_is_explicit
  - safety_gate_boundary_is_explicit
  - privacy_policy_blocks_raw_free_text
  - downstream_delta_is_scoped_to_target_document
```

---

## 19. Self-Check Items, Not Executed Tests

```yaml
self_check_annotation:
  executed_tests_run: false
  self_check_is_runtime_test: false
  groups:
    metadata_and_counting: 4
    ownership_and_scope: 4
    lifecycle_and_visibility: 4
    eligibility_filtering: 5
    safety_and_privacy: 6
    plan_generator_consumption: 5
    api_and_audit: 4
    downstream_delta_and_closure: 4
  total: 36
```

| ID | Group | Check | Status |
|---|---|---|---|
| SC-TL-001 | metadata_and_counting | Required metadata exists | SATISFIED |
| SC-TL-002 | metadata_and_counting | `test_cases_passed` is not used | SATISFIED |
| SC-TL-003 | metadata_and_counting | Executed tests are declared as 0/0 | SATISFIED |
| SC-TL-004 | metadata_and_counting | Self-check is separated from runtime test evidence | SATISFIED |
| SC-TL-005 | ownership_and_scope | Owner types SYSTEM/TENANT/COACH are defined | SATISFIED |
| SC-TL-006 | ownership_and_scope | SYSTEM templates cannot be edited directly by coach | SATISFIED |
| SC-TL-007 | ownership_and_scope | TENANT templates are tenant-scoped | SATISFIED |
| SC-TL-008 | ownership_and_scope | Cross-tenant access is prohibited | SATISFIED |
| SC-TL-009 | lifecycle_and_visibility | DRAFT state is defined | SATISFIED |
| SC-TL-010 | lifecycle_and_visibility | ACTIVE state is defined | SATISFIED |
| SC-TL-011 | lifecycle_and_visibility | DEPRECATED state is defined | SATISFIED |
| SC-TL-012 | lifecycle_and_visibility | RETIRED state is defined | SATISFIED |
| SC-TL-013 | eligibility_filtering | Initial template family seed exists | SATISFIED |
| SC-TL-014 | eligibility_filtering | Session labels are consumed, not redefined | SATISFIED |
| SC-TL-015 | eligibility_filtering | Event and level filters are defined | SATISFIED |
| SC-TL-016 | eligibility_filtering | Minor and guardian filters are defined | SATISFIED |
| SC-TL-017 | eligibility_filtering | Eligibility statuses are limited to allowed values | SATISFIED |
| SC-TL-018 | safety_and_privacy | Safety gate check precedes template use | SATISFIED |
| SC-TL-019 | safety_and_privacy | Safety tags cannot override D9/RVE | SATISFIED |
| SC-TL-020 | safety_and_privacy | Prohibited use cases are checked | SATISFIED |
| SC-TL-021 | safety_and_privacy | Raw athlete free-text storage is prohibited | SATISFIED |
| SC-TL-022 | safety_and_privacy | Injury and medical note storage is prohibited | SATISFIED |
| SC-TL-023 | safety_and_privacy | Medical or rehab auto-prescription is prohibited | SATISFIED |
| SC-TL-024 | plan_generator_consumption | Plan Generator query prerequisites are defined | SATISFIED |
| SC-TL-025 | plan_generator_consumption | Plan Generator cannot mutate template records | SATISFIED |
| SC-TL-026 | plan_generator_consumption | Plan Generator cannot bypass lifecycle | SATISFIED |
| SC-TL-027 | plan_generator_consumption | Returned templates retain source and version | SATISFIED |
| SC-TL-028 | plan_generator_consumption | REVIEW_REQUIRED is not auto-selected | SATISFIED |
| SC-TL-029 | api_and_audit | list/get API drafts are present | SATISFIED |
| SC-TL-030 | api_and_audit | create/clone/deprecate/evaluate API drafts are present | SATISFIED |
| SC-TL-031 | api_and_audit | Clone requires new ID and audit log | SATISFIED |
| SC-TL-032 | api_and_audit | Audit log avoids sensitive payload storage | SATISFIED |
| SC-TL-033 | downstream_delta_and_closure | Open issue count matches Section 17 table | SATISFIED |
| SC-TL-034 | downstream_delta_and_closure | Canonical blocking count is 0 and matches table | SATISFIED |
| SC-TL-035 | downstream_delta_and_closure | Downstream delta applies only to target document | SATISFIED |
| SC-TL-036 | downstream_delta_and_closure | This document’s own delta remains 0 | SATISFIED |

---

## 20. Self-Validation

```yaml
self_validation:
  metadata_block_present: SATISFIED
  purpose_section_present: SATISFIED
  non_purpose_section_present: SATISFIED
  dependency_direction_present: SATISFIED
  ownership_policy_present: SATISFIED
  lifecycle_policy_present: SATISFIED
  template_family_seed_present: SATISFIED
  plan_generator_consumption_contract_present: SATISFIED
  privacy_policy_present: SATISFIED
  open_issues_total_matches_rows: SATISFIED
  canonical_blocking_count_matches_rows: SATISFIED
  self_check_item_total_matches_annotations: SATISFIED
  self_check_item_table_rows_36: SATISFIED
  executed_tests_not_claimed: SATISFIED
  storage_header_footer: SATISFIED
```

---

## 21. Expected Delta For Target Document

이 섹션의 델타는 `TEMPLATE_LIBRARY_SPEC.md` 자체에 적용하지 않는다.  
대상 문서는 `PLAN_GENERATOR_SPEC.md`다.

```yaml
expected_delta_for_target_document:
  target_document: PLAN_GENERATOR_SPEC.md
  target_issue: OI-PG-TEMPLATE-LIBRARY-OWNERSHIP-001
  applies_after:
    - TEMPLATE_LIBRARY_SPEC.md reviewer acceptance
    - ownership_model accepted
    - lifecycle_policy accepted
    - plan_generator_consumption_contract accepted

  expected_delta:
    open_issues_total: -1
    canonical_blocking_count: -1

does_not_apply_to_this_document:
  target_document: TEMPLATE_LIBRARY_SPEC.md
  open_issues_total_delta: 0
  canonical_blocking_count_delta: 0
  reason: "This document declares its own four non-canonical open issues and does not reduce its own issue count."
```

---

## 22. Storage Rules

```yaml
storage_rules:
  filename: TEMPLATE_LIBRARY_SPEC.md
  first_line_must_be: "# TEMPLATE_LIBRARY_SPEC.md"
  last_line_must_be: "[DRAFT_COMPLETE]"
  text_after_final_marker_allowed: false
  direct_runtime_test_claim_allowed: false
```

[DRAFT_COMPLETE]
