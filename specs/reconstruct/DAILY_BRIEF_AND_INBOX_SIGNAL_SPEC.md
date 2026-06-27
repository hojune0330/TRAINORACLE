# DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC.md

```yaml
document_metadata:
  doc_id: trainoracle-spec-014-daily-brief-and-inbox-signal
  spec_id: DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC
  title: TrainOracle Daily Brief And AI Inbox Signal Spec
  version: "0.1"
  round: RT1_PRODUCTIZATION_DRAFT
  status: DRAFT_FOR_REVIEW
  owner: COACH_HOJUNE
  owner_english_name: hojune jang

  source_state:
    local_original_found: false
    new_productization_draft: true
    restored_original: false
    prior_approved_version_restored: false
    reconstructed_from_missing_original: false

  open_issues_total: 6
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

`DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC.md` defines how TrainOracle turns structured daily facts into daily brief items, dashboard prompts, and AI Inbox signals.

This is a new productization draft. It is not an original restored file, not a canonical SPEC, not runtime evidence, and not issue closure.

The goal is to let athletes and coaches see what changed, why it matters, and what needs attention without exposing raw private text or letting a generated message create a new coaching decision.

---

## 2. Non-Purpose

This document does not:

- redefine `RULE_SPEC_D1_D9.D-*` semantics
- implement the D9 evaluator
- replace RVE, Safety Gate, Plan Generator, Daily Log, App Bridge, Athlete Profile, Session Classifier, Physio Source Trust, or Template Library contracts
- create plan options, planned sessions, or progression recommendations
- clear `D9_ACTIVE`, `D9_UNKNOWN`, or any Safety Gate block
- create medical, injury, rehab, return-to-play, high-intensity, or race-readiness clearance
- store raw athlete free text, raw memo text, raw symptom clauses, injury narratives, medical notes, rehab notes, evidence clauses, or guardian private notes
- send private athlete data to an external LLM in the current rule-engine phase
- claim runtime PASS evidence
- close Daily Log, RVE, Safety Gate, Plan Generator, App Bridge, Analysis, or UI implementation issues

---

## 3. Source Priority

```yaml
source_priority:
  daily_ingestion:
    - document: specs/reconstruct/DAILY_LOG_AND_CHECKIN_SPEC.md
      treatment: RECONSTRUCTED_DRAFT_FOR_REVIEW
      consumed_for:
        - DailyCheckInRecord
        - structured daily signals
        - transient memo boundary
        - future Daily Brief / AI Inbox need
      caveat: "Reconstructed source; not canonical and not runtime evidence."

  storage_and_access:
    - document: specs/active/APP_IMPLEMENTATION_BRIDGE.md
      treatment: DRAFT_FOR_REVIEW_ACTIVE_SPEC_CANDIDATE
      consumed_for:
        - tenant/group/athlete scope
        - consent and capability guard
        - audit boundary
        - DailyCheckInRecord target-local binding

  safety_routing:
    - document: specs/reconstruct/PLAN_SAFETY_GATE_SPEC.md
      treatment: RECONSTRUCTED_DRAFT_FOR_REVIEW
      consumed_for:
        - Daily Log input boundary
        - D9/RVE/Safety Gate block preservation
        - advisory non-blocking semantics

  classification_and_context:
    - document: specs/active/SESSION_CLASSIFIER_SPEC.md
      treatment: ACTIVE_SPEC_CANDIDATE
      consumed_for:
        - classified session refs
        - uncertainty and correction lineage

  athlete_profile:
    - document: specs/active/ATHLETE_PROFILE_SPEC.md
      treatment: ACTIVE_SPEC_CANDIDATE
      consumed_for:
        - athlete preferences and constraints
        - consent lifecycle
        - minor/guardian boundary

  physiological_context:
    - document: specs/active/PHYSIO_SOURCE_TRUST_SPEC.md
      treatment: ACTIVE_SPEC_CANDIDATE
      consumed_for:
        - structured readiness/soreness/wellness context
        - source recency/conflict/consent status

  design_reference:
    - document: design-system/SCREENS.md
      treatment: DESIGN_REFERENCE_ONLY
      consumed_for:
        - AI Inbox surface intent
        - confidence and uncertainty display intent
    - document: SPEC_LEGACY_ALIGNMENT_AND_DAILY_LOG_PLAN.md
      treatment: CONTINUITY_PLAN
      consumed_for:
        - productization order
        - daily service flow
        - required citation/confidence/source-ref boundary
```

If this document conflicts with a current active safety/spec baseline, the safety/spec baseline wins.

---

## 4. Hard Constraints

```yaml
hard_constraints:
  no_global_coach_authority: true
  no_safety_hard_stop_override: true
  no_D9_rule_semantic_redefinition: true
  no_rule_threshold_definition: true
  no_external_llm_with_private_athlete_data: true
  no_raw_free_text_storage: true
  no_raw_memo_storage: true
  no_raw_symptom_clause_storage: true
  no_injury_narrative_storage: true
  no_medical_note_storage: true
  no_guardian_private_note_storage: true
  no_generation_of_plan_candidates: true
  no_clearing_existing_risk: true
  daily_brief_can_raise_attention: true
  daily_brief_cannot_clear_D9: true
  inbox_signal_can_request_review: true
  inbox_signal_cannot_clear_safety_gate: true
  markdown_self_check_is_not_runtime_evidence: true
  issue_closure_from_draft_forbidden: true
```

Daily Brief and AI Inbox items are visibility and attention surfaces. They are not safety disposition sources.

---

## 5. Signal Surface Model

```yaml
signal_surfaces:
  daily_brief:
    purpose: "A compact daily explanation of current structured training context."
    primary_viewers:
      - athlete
      - scoped_coach_when_authorized
    output_shape:
      - DailyBriefItemRecord
    expected_cadence:
      - on_daily_checkin_submission
      - on_morning_refresh
      - after_relevant_structured_source_update

  ai_inbox:
    purpose: "A queue of attention-worthy signals that need reading, review, or action."
    primary_viewers:
      - athlete
      - scoped_coach_when_authorized
    output_shape:
      - InboxSignalRecord
    expected_cadence:
      - event_stream
      - scheduled_rule_engine_scan
      - post_checkin_rule_engine_scan
```

The word "AI" in AI Inbox names the product surface. It does not authorize external LLM processing with private athlete data.

---

## 6. Signal Categories

Signal categories are product routing labels. They do not redefine rule verdicts.

```yaml
inbox_signal_categories:
  UNC:
    meaning: "Uncertain classification, insufficient evidence, stale source, or low confidence."
    may_request_review: true
    may_block_generation: false
    can_clear_risk: false

  RISK:
    meaning: "Structured risk, fatigue, pain/soreness, readiness, consent, or safety context needs attention."
    may_request_review: true
    may_surface_existing_block: true
    can_clear_risk: false

  PTRN:
    meaning: "Pattern detected across structured daily, session, physiology, or plan-adherence signals."
    may_request_review: true
    can_clear_risk: false

  RULE:
    meaning: "Existing rule/RVE/Safety Gate status or precheck result should be shown."
    may_surface_existing_block: true
    may_create_new_rule_result: false
    can_clear_risk: false

  PASS:
    meaning: "Non-sensitive completion/pass-through information for visibility only."
    may_create_medical_clearance: false
    may_clear_D9: false
    may_clear_safety_gate: false
```

`PASS` is never safety clearance. It can say a routine check or data flow completed, but it cannot downgrade a risk state.

---

## 7. Allowed Inputs

```yaml
allowed_inputs:
  daily_log:
    - DailyCheckInRecord_ref
    - sourceSnapshotId
    - auditLogId
    - structured_rpe
    - structured_sleep
    - structured_readiness
    - structured_body_area_signals
    - nonSensitiveReasonCodes
    - redactedNonSensitiveSummary_when_policy_allows

  session_context:
    - ClassifiedSessionRecord_ref
    - classification_confidence
    - correction_lineage_ref
    - session_summary_structured_fields

  safety_context:
    - RveRuleEvaluatorSignal_ref
    - PlanSafetyGateResult_ref
    - storedStatus
    - blocksPlanGeneration
    - requiresHumanReview
    - nonSensitiveReasonCodes
    - advisoryReasonCodes

  physiology_context:
    - PhysioSourceTrustResult_ref
    - trustStatus
    - recencyStatus
    - conflictStatus
    - consentStatus
    - nonSensitiveReasonCodes

  profile_context:
    - AthleteProfileSnapshot_ref
    - consentGrantRefs
    - capabilityGrantRefs
    - minor_guardian_scope_status
```

```yaml
forbidden_inputs:
  - raw_memo_text
  - raw_athlete_free_text
  - raw_symptom_clause
  - injury_narrative
  - medical_note
  - rehab_note
  - guardian_private_note
  - D9_evidence_clause
  - external_llm_prompt_with_private_athlete_data
```

---

## 8. Generation Policy

```yaml
generation_policy:
  current_phase_engine:
    primary_generator: deterministic_rule_engine_or_internal_structured_pipeline
    external_llm_with_private_athlete_data_allowed: false
    llm_may_create_new_coaching_decision: false
    llm_may_create_new_rule_verdict: false
    llm_may_clear_safety_state: false

  item_creation_requires:
    - sourceRefs
    - nonSensitiveReasonCodes
    - confidence_or_uncertainty
    - createdAt
    - audienceScope
    - privacyLevel

  item_creation_must_not:
    - create_plan_option
    - create_training_load_progression
    - clear_D9_ACTIVE
    - clear_D9_UNKNOWN
    - clear_Safety_Gate_block
    - reinterpret_RULE_SPEC_D1_D9_verdict
    - store_raw_text
```

An item can explain a fact, ask for review, or route attention. It cannot become the authority for training generation.

---

## 9. Required Output Contract

```typescript
export type DailyBriefSignalCategory =
  | "UNC"
  | "RISK"
  | "PTRN"
  | "RULE"
  | "PASS";

export type BriefAudienceScope =
  | "ATHLETE_ONLY"
  | "SCOPED_COACH_VISIBLE"
  | "GUARDIAN_VISIBLE_WHEN_AUTHORIZED"
  | "SYSTEM_INTERNAL";

export type BriefActionType =
  | "READ_ONLY"
  | "REQUEST_CHECKIN"
  | "REQUEST_REVIEW"
  | "OPEN_SOURCE_CONTEXT"
  | "OPEN_SAFETY_GATE_STATE"
  | "OPEN_SESSION_DETAIL"
  | "OPEN_ANALYSIS_VIEW";

export type BriefUncertaintyState =
  | "HIGH_CONFIDENCE"
  | "MEDIUM_CONFIDENCE"
  | "LOW_CONFIDENCE"
  | "INSUFFICIENT_DATA"
  | "STALE_SOURCE"
  | "CONFLICTING_SOURCES";

export interface SourceRef {
  sourceType:
    | "DAILY_CHECKIN"
    | "CLASSIFIED_SESSION"
    | "RVE_SIGNAL"
    | "PLAN_SAFETY_GATE"
    | "PHYSIO_SOURCE_TRUST"
    | "ATHLETE_PROFILE"
    | "TEMPLATE_LIBRARY"
    | "SYSTEM_DERIVED";
  sourceId: string;
  generatedAt?: string;
}

export interface DailyBriefItemRecord {
  dailyBriefItemId: string;
  tenantId: string;
  groupId: string;
  athleteId: string;
  briefDate: string;
  category: DailyBriefSignalCategory;
  audienceScope: BriefAudienceScope;
  titleCode: string;
  bodyCode: string;
  nonSensitiveReasonCodes: readonly string[];
  sourceRefs: readonly SourceRef[];
  confidence: number | null;
  uncertaintyState: BriefUncertaintyState;
  actionType: BriefActionType;
  privacyLevel: "PUBLIC" | "INTERNAL" | "PRIVATE" | "SENSITIVE";
  rawTextStored: false;
  rawMemoStored: false;
  rawSymptomClauseStored: false;
  mayCreatePlanOption: false;
  mayClearD9Risk: false;
  mayClearSafetyGateBlock: false;
  createdAt: string;
  auditLogId: string;
}

export interface InboxSignalRecord extends DailyBriefItemRecord {
  inboxSignalId: string;
  readState: "UNREAD" | "READ" | "ARCHIVED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT_REVIEW";
  expiresAt?: string;
}
```

`titleCode` and `bodyCode` are template/localization keys or safe generated copy identifiers. They must not contain raw private text.

---

## 10. Ranking And Priority Rules

Ranking exists to decide visibility order. It is not a safety override.

```yaml
ranking_policy:
  priority_inputs_allowed:
    - category
    - requiresHumanReview
    - blocksPlanGeneration
    - uncertaintyState
    - source_recency
    - repeated_signal_count
    - unread_age

  priority_inputs_forbidden:
    - raw_free_text
    - raw_symptom_clause
    - private_medical_note
    - coach_global_preference
    - athlete_request_to_ignore_safety

  hard_ordering:
    safety_block_visibility: highest_visible_priority
    human_review_required: high_or_urgent_review
    uncertainty_without_block: medium_or_high
    pass_or_completion_notice: low
```

High priority does not mean plan generation is allowed. It only means the item should be seen sooner.

---

## 11. Privacy And Copy Policy

```yaml
copy_policy:
  public_or_low_sensitive_copy:
    allowed:
      - "Check-in is missing."
      - "Recent readiness signals need review."
      - "Training context changed since the last plan draft."
      - "A safety precheck is blocking plan generation."
      - "Sources disagree; review before planning."

  copy_must_not_include:
    - raw athlete quote
    - raw memo text
    - raw symptom phrase
    - injury narrative
    - medical diagnosis text
    - rehab note
    - guardian private note
    - private external LLM prompt or response

  explanation_style:
    must_include:
      - sourceRefs
      - confidence_or_uncertainty
      - nonSensitiveReasonCodes
    must_avoid:
      - false certainty
      - medical clearance language
      - hidden plan recommendation
```

If copy needs more detail than a reason code can safely express, route to `REQUEST_REVIEW` instead of storing or displaying raw text.

---

## 12. API And Storage Draft

This is a productization contract sketch only. App Bridge must accept or refine it before implementation.

```yaml
api_surface_draft:
  list_daily_brief:
    method: GET
    path: /bridge/athletes/{athleteId}/daily-brief
    requires:
      - tenant_group_athlete_scope
      - active_consent_or_valid_policy_exception
      - VIEW_DAILY_BRIEF_or_equivalent
    returns:
      - DailyBriefItemRecord[]

  list_inbox_signals:
    method: GET
    path: /bridge/athletes/{athleteId}/inbox-signals
    requires:
      - tenant_group_athlete_scope
      - active_consent_or_valid_policy_exception
      - VIEW_AI_INBOX_or_equivalent
    returns:
      - InboxSignalRecord[]

  mark_inbox_signal_read:
    method: POST
    path: /bridge/inbox-signals/{id}/read
    requires:
      - tenant_group_athlete_scope
      - actor_can_view_target_signal
    mutates:
      - readState_only
```

The read-state endpoint may update visibility state. It must not mutate source facts, safety facts, rule results, or plan generation decisions.

---

## 13. Downstream Boundaries

```yaml
downstream_boundaries:
  app_bridge:
    needed_before_implementation:
      - storage family acceptance
      - API route acceptance
      - capability names and consent mapping

  analysis_visualization:
    needed_before_trend_cards:
      - ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md

  plan_rationale:
    needed_before_plan_copy_uses_brief_or_inbox:
      - PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md

  notifications:
    needed_before_push_or_email:
      - notification_channel_consent_policy
      - audience_scope_delivery_policy

  runtime_evidence:
    needed_before_claiming_generated_items_work:
      - local_or_CI_generation_log
      - privacy scan
      - sourceRef preservation verification
```

Daily Brief and AI Inbox may read accepted structured outputs. They do not own upstream truth.

---

## 14. Issue Closure Boundary

This productization draft does not close issues in any other document.

```yaml
not_closed_now:
  - OI-DLC-DAILY-BRIEF-INBOX-001
  - OI-DLC-APP-BRIDGE-BINDING-001
  - OI-DLC-RVE-SAFETY-BINDING-001
  - OI-PSG-DAILY-LOG-INPUT-BINDING-001
  - OI-RVE-RULE-EVALUATOR-BINDING-001
  - OI-PG-RULE-SAFETY-GATE-BINDING-001

closure_requires:
  - source_spec_accepted
  - target_document_patched
  - target_open_issue_table_recounted
  - implementation_privacy_review_when_storage_or_api_is_claimed
  - actual_runtime_evidence_when_generation_behavior_is_claimed
```

Absolute downstream issue counts are not declared here.

---

## 15. Open Issues

These are this draft's own issues. They do not change issue counts in other SPEC files.

| ID | Priority | Canonical blocking | Status | Summary | Resolution needed |
|---|---|---:|---|---|---|
| `OI-DBI-APP-BRIDGE-BINDING-001` | P1 | YES | OPEN | App Bridge does not yet own DailyBriefItemRecord, InboxSignalRecord, capabilities, or API routes. | Patch App Bridge only after this draft is accepted, then recount the target issue table. |
| `OI-DBI-SIGNAL-RANKING-001` | P1 | YES | OPEN | Final ranking weights and stale/conflict handling are not implementation-bound. | Define deterministic ranking rules and verify no safety override behavior. |
| `OI-DBI-RUNTIME-EVIDENCE-001` | P1 | YES | OPEN | No runtime generation logs prove item creation, sourceRef preservation, or privacy filtering. | Run local/CI generation tests after implementation exists. |
| `OI-DBI-EXTERNAL-LLM-POLICY-001` | P2 | NO | OPEN | Future LLM summarization boundary is not accepted. | Keep external LLM disabled for private athlete data until a separate privacy/security review exists. |
| `OI-DBI-UI-SURFACE-BINDING-001` | P2 | NO | OPEN | Dashboard and AI Inbox screens are design references only, not accepted implementation contracts. | Patch UI/screen contracts after this data contract is accepted. |
| `OI-DBI-ANALYSIS-CONTRACT-BINDING-001` | P2 | NO | OPEN | Analysis trend items and visualization data contracts remain separate future work. | Draft `ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md`. |

---

## 16. Self-Check

| Check | Status |
|---|---|
| First line is exact filename H1 | PASS |
| Metadata includes required fields | PASS |
| Status is `DRAFT_FOR_REVIEW` | PASS |
| Does not claim original restored | PASS |
| Does not claim canonical promotion | PASS |
| Does not claim runtime evidence | PASS |
| Does not close downstream issues | PASS |
| Requires source refs | PASS |
| Requires confidence or uncertainty | PASS |
| Requires non-sensitive reason codes | PASS |
| Raw free-text storage is forbidden | PASS |
| Raw memo storage is forbidden | PASS |
| Raw symptom clause storage is forbidden | PASS |
| External LLM with private athlete data is forbidden in current phase | PASS |
| Daily Brief / AI Inbox cannot clear D9 or Safety Gate blocks | PASS |
| Final marker is required as final line | PASS |

[DRAFT_COMPLETE]
