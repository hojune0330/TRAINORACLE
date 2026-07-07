# PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md

```yaml
doc_id: trainoracle-spec-016-plan-output-rationale-privacy
spec_id: PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC
title: TrainOracle Plan Output Rationale Privacy Spec
version: "0.1"
round: RT1_PRODUCTIZATION_DRAFT
status: DRAFT_FOR_REVIEW
owner: COACH_HOJUNE
source_state:
  local_original_found: false
  new_productization_draft: true
  restored_original: false
  previous_approved_version_restored: false
open_issues_total: 7
canonical_blocking_count: 4
executed_tests_total: 0
executed_tests_passed: 0
self_check_is_runtime_evidence: false
canonical_promotion_allowed: false
```

---

## 1. Purpose

`PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md` defines how TrainOracle may explain why a Plan Generator option or planned session was proposed without leaking sensitive athlete data.

The goal is to preserve useful coaching reasoning while keeping raw athlete text, symptom clauses, medical notes, guardian notes, private profile details, and private LLM prompts out of plan rationale copy, tooltips, exports, audit records, and downstream product surfaces.

This document is a productization privacy contract. It is not a Plan Generator, not a D9 evaluator, not a Safety Gate, not a metric algorithm, not runtime evidence, and not canonical promotion.

---

## 2. Non-Purpose

This document does not:

- create, rank, select, or modify plan options
- redefine `RULE_SPEC_D1_D9.D-*` semantics
- override `D9_ACTIVE`, `D9_UNKNOWN`, Safety Gate blocks, or human-review requirements
- treat `D9_CLEARED` as medical clearance
- make ADVISORY a fourth D9 disposition
- authorize external LLM processing with private athlete data
- store raw athlete free text, raw memo text, raw symptom clauses, injury narratives, medical notes, rehab notes, evidence clauses, or guardian private notes
- define final UI copy, localization strings, push notification text, or export templates
- close `OI-PG-OPTION-RATIONALE-PRIVACY-001` or any downstream issue

---

## 3. Source Basis

This draft was created only after exact local filename search found no current `PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md`.

Source references used for this draft:

| Source | Treatment |
|---|---|
| `specs/active/PLAN_GENERATOR_SPEC.md` | Owns plan generation, `rationaleRefs`, and `OI-PG-OPTION-RATIONALE-PRIVACY-001` |
| `specs/reconstruct/DAILY_LOG_AND_CHECKIN_SPEC.md` | Names this contract before plan option rationale generation from check-in context and coach-visible reasoning copy |
| `specs/reconstruct/PLAN_SAFETY_GATE_SPEC.md` | Defines pre-generation safety block/review/allow boundary |
| `specs/reconstruct/RULE_VALIDATION_ENGINE_CONTRACT.md` | Provides privacy-safe RVE signal and reason-code boundary |
| `specs/active/APP_IMPLEMENTATION_BRIDGE.md` | Provides storage, capability, consent, audit, and privacy boundary |
| `specs/active/ATHLETE_PROFILE_SPEC.md` | Provides athlete profile and sensitive-field consent boundary |
| `specs/active/SESSION_CLASSIFIER_SPEC.md` | Provides classified session source and uncertainty boundary |
| `specs/active/PHYSIO_SOURCE_TRUST_SPEC.md` | Provides physio source trust, recency, conflict, and no-D9-clearing rule |
| `specs/active/TEMPLATE_LIBRARY_SPEC.md` | Provides template eligibility and template privacy boundary |
| `specs/reconstruct/DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC.md` | Requires source refs, confidence/uncertainty, non-sensitive reason codes, and no private external LLM use |
| `specs/reconstruct/ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md` | Defines source-backed visualization and display privacy boundary |

---

## 4. Global Invariants

```yaml
plan_rationale_privacy_invariants:
  local_files_are_truth: true
  no_runtime_evidence_claim: true
  no_canonical_promotion_claim: true
  no_issue_closure_from_this_draft: true
  no_external_llm_with_private_athlete_data: true
  raw_free_text_storage_forbidden: true
  raw_memo_storage_forbidden: true
  raw_symptom_clause_storage_forbidden: true
  injury_narrative_storage_forbidden: true
  medical_note_storage_forbidden: true
  guardian_private_note_storage_forbidden: true
  private_profile_detail_disclosure_forbidden: true
  reason_code_storage_preferred: true
  source_refs_required: true
  confidence_or_uncertainty_required: true
  rationale_code_required: true
  redaction_state_required: true
  rationale_can_explain_plan: true
  rationale_can_create_plan_option: false
  rationale_can_select_plan_option: false
  rationale_can_clear_D9: false
  rationale_can_clear_safety_gate: false
```

---

## 5. Rationale Boundary

Plan rationale is a display and audit explanation for an already generated plan option.

It may answer:

- which accepted structured inputs influenced the plan option
- which constraints were applied
- which template or progression rule was eligible
- why a planned session is lighter, heavier, delayed, or review-required
- which non-sensitive reason codes explain uncertainty
- which source refs support the explanation

It must not answer:

- what the athlete wrote in a raw memo
- what exact private symptom phrase triggered a risk signal
- what private medical or guardian note exists
- how to bypass a Safety Gate block
- why a blocked plan should still be generated
- a hidden ranking or hidden option that was not produced by Plan Generator

---

## 6. Audience And Privacy Tiers

```yaml
rationale_audience:
  ATHLETE_VISIBLE:
    allowed: public_safe_plan_reasoning
    forbidden: private_profile_detail, guardian_note, medical_note, raw_text

  COACH_VISIBLE:
    allowed: structured_reason_codes, source_refs, uncertainty, consent-scoped context
    forbidden: raw_text, raw_symptom_clause, medical_note, guardian_private_note

  GUARDIAN_VISIBLE:
    allowed: guardian-consented summaries and high-level reason codes only
    forbidden: athlete_private_text_without_scope, coach_internal_notes

  AUDIT_ONLY:
    allowed: ids, sourceRefs, policy flags, non-sensitive reason codes
    forbidden: raw text, raw symptom clauses, private notes, external private LLM prompts

  HIDDEN_SENSITIVE:
    allowed: no display text
    required: route_to_privacy_review_or_structured_redaction
```

Any rationale item with uncertain privacy tier must default to `AUDIT_ONLY` or `HIDDEN_SENSITIVE` until reviewed.

---

## 7. Allowed Inputs

Allowed rationale inputs are structured and reference-based only.

```yaml
allowed_inputs:
  - PlanGenerationRunRecord_ref
  - PlanOptionRecord_ref
  - PlannedSessionDraftRecord_ref
  - PlanSafetyGateResult_ref
  - RveSignal_ref
  - TemplateEligibilityResult_ref
  - SessionTemplateRecord_ref
  - ClassifiedSessionRecord_ref
  - AthleteProfileSnapshotStorageRecord_ref
  - ConsentGrantRecord_ref
  - CapabilityGrantRecord_ref
  - PhysioSourceTrustResult_ref
  - DailyCheckInRecord_structured_ref
  - AnalysisDataSet_ref
  - DailyBriefSignal_ref
  - AiInboxSignal_ref
```

Allowed structured facts must still be minimized for the target audience.

---

## 8. Forbidden Inputs

```yaml
forbidden_rationale_inputs:
  - raw_athlete_free_text
  - raw_memo_text
  - raw_symptom_clause
  - raw_injury_narrative
  - raw_medical_note
  - raw_rehab_note
  - raw_guardian_private_note
  - raw_evidence_clause
  - private_external_llm_prompt
  - private_external_llm_response
  - sensitive_profile_field_without_active_consent
  - hidden_safety_override_comment
```

If a source contains private raw text, the rationale layer may use only approved structured reason codes or source ids that do not reveal the private text.

---

## 9. Required Output Contract

### 9.1 PlanRationaleBundle

```yaml
PlanRationaleBundle:
  rationaleBundleId: string
  planGenerationRunId: string
  planOptionId: string_or_null
  tenantId: string
  groupId: string_or_null
  athleteId: string
  generatedAt: ISO_DATETIME
  generatedBy: SYSTEM_RULE_ENGINE
  audience: ATHLETE_VISIBLE | COACH_VISIBLE | GUARDIAN_VISIBLE | AUDIT_ONLY
  sourceRefs: SourceRef[]
  confidence: number_or_null
  uncertaintyState: RationaleUncertaintyState
  privacyReviewState: PrivacyReviewState
  safetyBoundary:
    mayCreatePlanOption: false
    maySelectPlanOption: false
    mayClearD9Risk: false
    mayClearSafetyGateBlock: false
  items: PlanRationaleItem[]
```

### 9.2 PlanRationaleItem

```yaml
PlanRationaleItem:
  rationaleItemId: string
  itemKind: LOAD_ADJUSTMENT | RECOVERY_PROTECTION | TEMPLATE_ELIGIBILITY | SAFETY_BLOCK | REVIEW_REQUIRED | SOURCE_LIMITATION | PROGRESSION_GUARD | COACH_INTENT | SCHEDULE_CONTEXT
  titleCode: string
  bodyTemplateCode: string
  rationaleCodes: string[]
  sourceRefs: SourceRef[]
  confidence: number_or_null
  uncertaintyState: RationaleUncertaintyState
  audience: ATHLETE_VISIBLE | COACH_VISIBLE | GUARDIAN_VISIBLE | AUDIT_ONLY
  privacyTier: PUBLIC_SAFE | INTERNAL_SAFE | SENSITIVE_SUPPRESSED | AUDIT_ONLY
  redactionState: NOT_NEEDED | REDACTED | SUPPRESSED | REVIEW_REQUIRED
  containsRawText: false
  containsRawSymptomClause: false
  containsPrivateNote: false
  externalPrivateLlmUsed: false
```

`titleCode` and `bodyTemplateCode` are template or localization keys. They must not contain raw athlete text or private symptom wording.

---

## 10. SourceRef Contract

```ts
export type RationaleSourceKind =
  | "PLAN_GENERATION_RUN"
  | "PLAN_OPTION"
  | "PLANNED_SESSION_DRAFT"
  | "PLAN_SAFETY_GATE_RESULT"
  | "RVE_SIGNAL"
  | "TEMPLATE_ELIGIBILITY_RESULT"
  | "SESSION_TEMPLATE"
  | "CLASSIFIED_SESSION_RECORD"
  | "ATHLETE_PROFILE_SNAPSHOT"
  | "CONSENT_GRANT"
  | "CAPABILITY_GRANT"
  | "PHYSIO_SOURCE_TRUST_RESULT"
  | "DAILY_CHECKIN_RECORD"
  | "ANALYSIS_DATASET"
  | "DAILY_BRIEF_SIGNAL"
  | "AI_INBOX_SIGNAL";

export interface RationaleSourceRef {
  sourceKind: RationaleSourceKind;
  sourceId: string;
  sourceVersion: string | null;
  observedAt: string | null;
  trustState:
    | "ACCEPTED"
    | "STALE"
    | "CONFLICTING"
    | "MISSING"
    | "SOURCE_NOT_VERIFIED"
    | "CONSENT_RESTRICTED";
  containsPrivateRawText: false;
}
```

Source refs support traceability. They must not become a backdoor for displaying raw source content.

---

## 11. Uncertainty States

```ts
export type RationaleUncertaintyState =
  | "NONE"
  | "LOW_CONFIDENCE"
  | "INSUFFICIENT_SOURCE"
  | "STALE_SOURCE"
  | "CONFLICTING_SOURCE"
  | "CONSENT_RESTRICTED"
  | "PRIVACY_REDACTED"
  | "REQUIRES_HUMAN_REVIEW"
  | "SAFETY_BLOCK_PRESENT";
```

Rules:

- `CONSENT_RESTRICTED` must be used when a useful explanation cannot be shown because consent or guardian scope is insufficient.
- `PRIVACY_REDACTED` must be used when a reason exists but raw or sensitive detail cannot be displayed.
- `SAFETY_BLOCK_PRESENT` must remain visible when Safety Gate blocks or requires review.
- `NONE` requires accepted source refs and no unresolved privacy/safety conflict.

---

## 12. Copy Generation Policy

Rationale copy must be deterministic or template-based in this phase.

```yaml
copy_generation_policy:
  deterministic_template_copy_allowed: true
  local_formatting_from_reason_codes_allowed: true
  external_llm_with_private_athlete_data_allowed: false
  raw_text_interpolation_allowed: false
  symptom_phrase_interpolation_allowed: false
  medical_note_interpolation_allowed: false
  guardian_note_interpolation_allowed: false
  hidden_chain_of_thought_storage_allowed: false
  coach_visible_copy_requires_privacy_tier: true
  athlete_visible_copy_requires_redaction_state: true
```

The word "rationale" means product-visible explanation. It does not authorize hidden chain-of-thought storage or private prompt logging.

---

## 13. Redaction And Suppression Rules

| Source condition | Required action |
|---|---|
| Structured source is accepted and non-sensitive | Show template copy with source refs |
| Source is missing | Show `INSUFFICIENT_SOURCE` or omit the rationale item |
| Source is stale | Show `STALE_SOURCE` and do not claim strong certainty |
| Sources conflict | Show `CONFLICTING_SOURCE` and route to review when needed |
| Consent is insufficient | Use `CONSENT_RESTRICTED`; suppress private detail |
| Raw athlete memo is present | Do not store or display raw memo text |
| Raw symptom phrase triggered risk extraction | Store/display reason code only; suppress phrase |
| Medical/guardian note exists | Do not expose note content; route to privacy review if necessary |
| Safety Gate blocks generation | Show block/review state; do not generate hidden plan rationale |

---

## 14. Safety Boundary

Plan rationale can explain a Safety Gate outcome, but it cannot change it.

Required semantics:

- `D9_ACTIVE` blocks plan generation
- `D9_UNKNOWN` blocks generation or requires human review
- `D9_CLEARED` means no D9 signal detected by evaluator at this time only
- ADVISORY is a non-blocking subtype under `D9_CLEARED`
- good physio data cannot clear D9 risk
- template eligibility cannot clear D9 risk
- normal-looking analysis charts cannot clear Safety Gate blocks

If a plan is blocked, rationale may explain the block with safe reason codes and source refs. It must not produce a workaround plan.

---

## 15. TypeScript Shape Draft

```ts
export type RationaleAudience =
  | "ATHLETE_VISIBLE"
  | "COACH_VISIBLE"
  | "GUARDIAN_VISIBLE"
  | "AUDIT_ONLY";

export type RationalePrivacyTier =
  | "PUBLIC_SAFE"
  | "INTERNAL_SAFE"
  | "SENSITIVE_SUPPRESSED"
  | "AUDIT_ONLY";

export type PrivacyReviewState =
  | "NOT_REQUIRED"
  | "PASSED"
  | "REDACTED"
  | "SUPPRESSED"
  | "REVIEW_REQUIRED";

export interface PlanRationaleItem {
  rationaleItemId: string;
  itemKind:
    | "LOAD_ADJUSTMENT"
    | "RECOVERY_PROTECTION"
    | "TEMPLATE_ELIGIBILITY"
    | "SAFETY_BLOCK"
    | "REVIEW_REQUIRED"
    | "SOURCE_LIMITATION"
    | "PROGRESSION_GUARD"
    | "COACH_INTENT"
    | "SCHEDULE_CONTEXT";
  titleCode: string;
  bodyTemplateCode: string;
  rationaleCodes: readonly string[];
  sourceRefs: readonly RationaleSourceRef[];
  confidence: number | null;
  uncertaintyState: RationaleUncertaintyState;
  audience: RationaleAudience;
  privacyTier: RationalePrivacyTier;
  redactionState: PrivacyReviewState;
  containsRawText: false;
  containsRawSymptomClause: false;
  containsPrivateNote: false;
  externalPrivateLlmUsed: false;
}

export interface PlanRationaleBundle {
  rationaleBundleId: string;
  planGenerationRunId: string;
  planOptionId: string | null;
  tenantId: string;
  groupId: string | null;
  athleteId: string;
  generatedAt: string;
  generatedBy: "SYSTEM_RULE_ENGINE";
  audience: RationaleAudience;
  sourceRefs: readonly RationaleSourceRef[];
  confidence: number | null;
  uncertaintyState: RationaleUncertaintyState;
  privacyReviewState: PrivacyReviewState;
  safetyBoundary: {
    mayCreatePlanOption: false;
    maySelectPlanOption: false;
    mayClearD9Risk: false;
    mayClearSafetyGateBlock: false;
  };
  items: readonly PlanRationaleItem[];
}
```

---

## 16. Downstream Binding Rules

### 16.1 Plan Generator

Plan Generator may attach `rationaleRefs` to generated plan options.

This spec defines the privacy shape of those rationale refs. It does not resolve `OI-PG-OPTION-RATIONALE-PRIVACY-001` by itself.

### 16.2 App Bridge

App Bridge must decide final storage, audit, endpoint, capability, consent, and redaction enforcement before implementation.

No rationale endpoint may return raw text or private notes.

### 16.3 Daily Log

Daily Log can provide structured check-in facts and reason-code context.

Daily Log cannot provide persisted raw memo text, raw symptom clauses, injury narratives, medical notes, or guardian notes to plan rationale copy.

### 16.4 Daily Brief, AI Inbox, And Analysis

Daily Brief, AI Inbox, and Analysis may display or cite accepted rationale items only when source refs, uncertainty, privacy tier, and redaction state are preserved.

They cannot turn a plan rationale into a safety clearance or a new plan option.

### 16.5 Exports, Tooltips, Notifications, And Screenshots

Any export, tooltip, notification, screenshot, coach dashboard, athlete dashboard, or guardian view must use the same privacy tier and redaction state as the source rationale item.

No display surface may downgrade `SENSITIVE_SUPPRESSED` to visible text.

---

## 17. API Draft

This draft proposes read-only rationale endpoints for future App Bridge work. The endpoints are not implementation evidence.

```yaml
read_only_api_draft:
  GET /bridge/plan-generation-runs/{runId}/rationale:
    returns: PlanRationaleBundle[]
    purpose: retrieve privacy-filtered rationale bundles for a plan-generation run
    writes_plan_state: false
    writes_safety_state: false
    may_create_plan_option: false
    may_clear_D9: false
    may_clear_safety_gate: false

  GET /bridge/plan-options/{planOptionId}/rationale:
    returns: PlanRationaleBundle
    purpose: retrieve privacy-filtered rationale for one plan option
    writes_plan_state: false
    writes_safety_state: false
    may_select_plan_option: false
```

Write endpoints for human review, redaction overrides, or copy approval require separate App Bridge workflow acceptance.

---

## 18. Audit And Storage Notes

Rationale audit may store:

- rationale bundle id
- plan generation run id
- plan option id
- tenant, group, athlete ids
- audience
- source refs
- rationale codes
- confidence or uncertainty
- privacy tier
- redaction state
- policy booleans proving raw/private text was not stored

Rationale audit must not store:

- raw athlete text
- raw symptom phrases
- injury narratives
- medical notes
- guardian private notes
- private external LLM prompts or responses
- hidden chain-of-thought

---

## 19. Issue Closure Boundary

Creating this file does not close:

- `OI-PG-OPTION-RATIONALE-PRIVACY-001`
- any Plan Generator issue
- any Daily Log issue
- any App Bridge issue
- any RVE, Safety Gate, Daily Brief, Analysis, UI, or implementation issue

Issue closure requires accepted source spec, target patch, target open-issue recount, and implementation/runtime evidence where applicable.

---

## 20. Open Issues

| Issue ID | Priority | Canonical blocking | Status | Problem | Required next evidence |
|---|---|---|---|---|---|
| `OI-PORP-PLAN-GENERATOR-BINDING-001` | P1 | YES | OPEN | `PLAN_GENERATOR_SPEC.md` still owns `OI-PG-OPTION-RATIONALE-PRIVACY-001`; this draft has not been patched into the target issue table. | Patch Plan Generator after review, then recount target issues. |
| `OI-PORP-APP-BRIDGE-AUDIT-BINDING-001` | P1 | YES | OPEN | App Bridge does not yet define rationale storage, audit, endpoint, capability, consent, or redaction enforcement. | Patch App Bridge and run privacy review before implementation. |
| `OI-PORP-REDACTION-POLICY-001` | P1 | YES | OPEN | Redaction and suppression templates are draft-only and not implementation-tested. | Define template keys and prove raw/private text cannot leak. |
| `OI-PORP-RUNTIME-EVIDENCE-001` | P1 | YES | OPEN | No runtime or CI evidence proves rationale generation, sourceRef preservation, or privacy filtering. | Add actual terminal or CI logs after implementation exists. |
| `OI-PORP-UI-COPY-SURFACE-BINDING-001` | P2 | NO | OPEN | UI surfaces, exports, tooltips, notifications, and screenshots are not accepted implementation contracts. | Patch UI/screen contracts after this data contract is reviewed. |
| `OI-PORP-EXTERNAL-LLM-POLICY-001` | P2 | NO | OPEN | Future LLM summarization boundary is not accepted for private athlete data. | Keep private external LLM disabled until privacy/security review exists. |
| `OI-PORP-MULTI-AUDIENCE-COPY-001` | P2 | NO | OPEN | Athlete, coach, guardian, audit-only copy policies need final product review. | Confirm audience-specific copy and consent rules before UI implementation. |

---

## 21. Self-Check

| Check | Result |
|---|---|
| First line is exact filename H1 | PASS |
| Final marker is final line | PASS |
| Metadata includes status, version, round, counts, owner | PASS |
| `executed_tests_total` remains 0 | PASS |
| Does not claim original restored | PASS |
| Does not claim canonical promotion | PASS |
| Does not claim runtime evidence | PASS |
| Does not close downstream issues | PASS |
| Requires source refs | PASS |
| Requires confidence or uncertainty | PASS |
| Requires rationale codes and privacy tier | PASS |
| Forbids raw memo/free-text/symptom clause storage | PASS |
| Forbids private external LLM use | PASS |
| Cannot create/select plan options | PASS |
| Cannot clear D9 or Safety Gate blocks | PASS |

[DRAFT_COMPLETE]
