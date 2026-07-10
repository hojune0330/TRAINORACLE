# RACE_RECORD_AND_HISTORICAL_RECALL_SPEC.md

```yaml
doc_id: trainoracle-spec-020-race-record-and-historical-recall
spec_id: RACE_RECORD_AND_HISTORICAL_RECALL_SPEC
title: TrainOracle Race Record And Historical Recall Spec
version: "0.1"
round: WORK_ORDER_003_TASK_2
status: DRAFT_FOR_REVIEW
owner: COACH_HOJUNE
source_state:
  local_original_found: false
  new_productization_draft: true
  restored_original: false
  previous_approved_version_restored: false
source_acceptance_decision_state: PENDING_REVIEW
open_issues_total: 7
canonical_blocking_count: 4
executed_tests_total: 0
executed_tests_passed: 0
self_check_is_runtime_evidence: false
canonical_promotion_allowed: false
issue_closure_claimed: false
runtime_evidence_claimed: false
```

---

## 1. Purpose

`RACE_RECORD_AND_HISTORICAL_RECALL_SPEC.md` defines two missing productization contracts:

1. A race-day quick-check / race result subtype for Daily Log records.
2. A privacy-safe historical recall surface for showing past context without storing or quoting raw athlete memory text.

This document addresses the two remaining `GAP_SPEC_MISSING` rows from `SPEC_SCREEN_TRACEABILITY_MATRIX.md`:

- `ui_kits/trainoracle-app-v3/LogEntry.jsx` race quick check / `D-0` race form
- `ui_kits/trainoracle-app-v3/Home.jsx` historical memory row with pain text

This is a draft contract. It is not runtime evidence, not canonical promotion, not a Daily Log implementation, not a Calendar implementation, not a UI implementation, and not issue closure.

---

## 2. Non-Purpose

This document does not:

- modify `app/`, `ui_kits/`, `preview/`, `design-v3/`, `designs/`, `colors_and_type*.css`, or root `index.html`
- define final race prediction, ranking, selection, or training-plan generation logic
- create or modify plan options
- redefine `RULE_SPEC_D1_D9.D-*`, `LEGACY_PHASE_D.D-*`, or `CYCLE_DAY.D-*`
- use bare `D-*` labels as data/API/audit fields
- treat `CYCLE_DAY.D-0` as a safety rule identifier
- authorize raw athlete memory text, raw memo text, raw symptom clauses, injury narratives, medical notes, rehab notes, evidence clauses, or guardian private notes in persistent storage or audit
- authorize external LLM processing with private athlete data
- clear `D9_ACTIVE`, `D9_UNKNOWN`, Safety Gate blocks, human-review requirements, physio conflicts, or template eligibility failures
- close `OI-DLC-RAW-NOTE-REDACTION-001`, `OI-MCM-RACE-ANCHOR-POLICY-001`, `OI-PORP-REDACTION-POLICY-001`, or any downstream issue

---

## 3. Source Basis

This draft was created only after local target-file search found no existing `specs/reconstruct/RACE_RECORD_AND_HISTORICAL_RECALL_SPEC.md`.

| Source | Treatment |
|---|---|
| `SPEC_SCREEN_TRACEABILITY_MATRIX.md` | Identifies the race quick-check and historical recall `GAP_SPEC_MISSING` rows. |
| `SPEC_SOURCE_ACCEPTANCE_DECISION_ROUND3.md` | Accepts Microcycle/Calendar and Plan Output Rationale Privacy as working sources only, with no canonical promotion or issue closure. |
| `specs/reconstruct/DAILY_LOG_AND_CHECKIN_SPEC.md` | Provides DailyCheckInRecord, `CYCLE_DAY` namespace guardrails, transient memo/raw-text boundary, and no-risk-clearing rules. |
| `specs/reconstruct/MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md` | Provides `RaceAnchor`, `CYCLE_DAY.*` namespace, `CYCLE_DAY.D-0` race-day display boundary, and no bare `D-*` data rule. |
| `specs/reconstruct/PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md` | Provides sourceRefs, privacyTier, redactionState, rationale code, and no raw/private text leakage rules. |
| `specs/reconstruct/ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md` | Provides source-backed display, confidence/uncertainty, and visible stale/missing/conflicting source states. |
| `specs/active/APP_IMPLEMENTATION_BRIDGE.md` | Owns future storage, endpoint, capability, consent, and audit binding after this draft is accepted. |

---

## 4. Global Invariants

```yaml
race_record_historical_recall_invariants:
  local_files_are_truth: true
  no_runtime_evidence_claim: true
  no_canonical_promotion_claim: true
  source_acceptance_decision_state: PENDING_REVIEW

  cycle_day_namespace_required: CYCLE_DAY
  bare_D_reference_in_data_api_audit: FORBIDDEN
  D0_representation: CYCLE_DAY.D-0
  D0_is_rule_id: false

  raw_historical_memory_storage_forbidden: true
  raw_memo_storage_forbidden: true
  raw_symptom_clause_storage_forbidden: true
  raw_injury_narrative_storage_forbidden: true
  private_external_llm_with_athlete_data_forbidden: true

  race_record_can_raise_attention: true
  historical_recall_can_raise_attention: true
  race_record_can_clear_D9: false
  historical_recall_can_clear_D9: false
  race_record_can_clear_SafetyGate: false
  historical_recall_can_clear_SafetyGate: false
  can_create_or_select_plan_options: false
```

---

## 5. Race-Day Record Subtype

Race-day quick check is a subtype of Daily Log. It must keep race-day context separate from safety rule IDs.

```yaml
RaceDayCheckInRecord:
  extends: DailyCheckInRecord
  recordSubtype: RACE_DAY_CHECKIN
  cycleDay:
    namespace: CYCLE_DAY
    value: D-0
    displayLabel: D-0
    isRuleId: false
  raceContext:
    raceId: string
    raceAnchorId: string
    raceDate: ISO_DATE
    timezone: IANA_TIMEZONE
    raceDistance:
      value: number
      unit: km | m | mile
    raceSurface:
      enum:
        - track
        - road
        - trail
        - cross_country
        - unknown
    resultStatus:
      enum:
        - planned
        - completed
        - dns
        - dnf
        - postponed
        - cancelled
        - unknown
  quickCheckFields:
    perceivedReadiness: integer_1_to_5
    warmupStatus: not_started | in_progress | completed | skipped | unknown
    painOrConcernStructured: none | mild | moderate | severe | unknown
    resultTime:
      value: string
      required_when_resultStatus_completed: false
    splitSummaryStructured:
      type: optional_structured_summary
      raw_text_allowed: false
  sourceRefs:
    type: array
  privacyTier:
    enum:
      - athlete_private
      - coach_visible_with_consent
      - audit_metadata_only
  uncertaintyState:
    enum:
      - complete
      - missing_result
      - stale_race_anchor
      - conflicting_race_anchor
      - requires_human_review
```

The race subtype may record structured race result facts. It must not store raw free-text race narratives, symptom phrases, medical notes, or coach-private notes in audit.

---

## 6. Race Safety Boundary

Race records can add context and raise review. They cannot clear safety.

```yaml
race_safety_boundary:
  can_raise_attention:
    - severe_structured_pain
    - conflicting_race_anchor
    - abnormal_readiness_drop
    - athlete_requests_review
  cannot_clear:
    - D9_ACTIVE
    - D9_UNKNOWN
    - SafetyGate_BLOCK
    - SafetyGate_REVIEW
    - physio_conflict_state
    - template_ineligibility
  D9_CLEARED_meaning_unchanged: true
  advisory_is_fourth_disposition: false
```

`CYCLE_DAY.D-0` means race-day cycle context only. It never means `RULE_SPEC_D1_D9.D-0` and must not be persisted as a bare `D-0` data field.

---

## 7. Historical Recall Contract

Historical recall is a display surface for source-backed context. It is not a raw memory store.

```yaml
HistoricalRecallDisplayRecord:
  recallId: string
  athleteId: string
  tenantId: string
  displaySurface:
    enum:
      - home_historical_memory_row
      - log_detail_context_note
      - coach_review_context
  sourceRefs:
    type: array
    required: true
  recallBasis:
    enum:
      - structured_daily_log_history
      - race_result_history
      - plan_rationale_source
      - analysis_source
      - coach_visible_structured_note
  displayTextPolicy:
    raw_athlete_text_allowed: false
    raw_symptom_clause_allowed: false
    generated_summary_allowed: true
    structured_reason_code_summary_preferred: true
    quote_private_text_allowed: false
  nonSensitiveReasonCodes:
    type: array
  privacyTier:
    enum:
      - athlete_visible_safe_summary
      - coach_visible_with_consent
      - audit_metadata_only
  redactionState:
    enum:
      - no_raw_text_source
      - raw_source_redacted
      - private_source_suppressed
      - source_missing
      - source_stale
      - source_conflicting
  confidence:
    type: number
    range: 0_to_1
  uncertaintyState:
    enum:
      - sufficient
      - insufficient_source
      - stale_source
      - conflicting_source
      - requires_human_review
```

Historical recall may say a safe derived summary such as "similar structured calf-pain pattern was logged in a prior cycle" only when backed by sourceRefs and non-sensitive reason codes. It must not quote the athlete's original memo or symptom phrase.

---

## 8. Local-Only Versus Derived Recall

```yaml
historical_recall_storage_modes:
  local_only_user_visible_memory:
    allowed: true
    server_persistence_allowed: false
    audit_persistence_allowed: false
    use_case: "athlete-facing convenience note before structured extraction"
  derived_structured_recall:
    allowed: true
    server_persistence_allowed: true
    audit_persistence_allowed: true
    required_fields:
      - sourceRefs
      - nonSensitiveReasonCodes
      - privacyTier
      - redactionState
      - uncertaintyState
  generated_natural_language_summary:
    allowed: true
    requires:
      - no_raw_quote
      - no_symptom_clause_quote
      - no_private_external_llm
      - sourceRefs
      - privacyTier
      - redactionState
```

If a historical recall surface cannot prove its source and privacy state, it must display a missing/insufficient source state or suppress the recall.

---

## 9. External LLM Boundary

```yaml
external_llm_boundary:
  raw_race_memo_to_external_llm_allowed: false
  raw_historical_memory_to_external_llm_allowed: false
  raw_symptom_clause_to_external_llm_allowed: false
  private_prompt_with_athlete_history_allowed: false
  allowed_without_new_review:
    - deterministic formatting of already-approved non-sensitive reason codes
    - local-only summarization that does not persist raw text
  future_enablement_requires:
    - explicit privacy_review
    - explicit security_review
    - consent_scope
    - redaction_policy
    - audit_policy_without_raw_private_text
```

No historical recall or race-day quick check path may silently add an external LLM dependency for private athlete data.

---

## 10. Downstream Consumer Rules

```yaml
downstream_consumption:
  DailyLog:
    may_create_RaceDayCheckInRecord: true
    must_keep_cycleDay_namespace: CYCLE_DAY
    must_not_store_raw_race_narrative: true
  MicrocycleCalendar:
    may_read_race_anchor: true
    may_display_D0: true
    must_back_display_with_CYCLE_DAY_namespace: true
    may_edit_race_anchor_without_future_contract: false
  AnalysisVisualization:
    may_display_race_result_summary: true
    may_display_historical_recall: true
    must_show_uncertainty_or_redaction_state: true
  PlanOutputRationale:
    may_reference_race_result_sourceRefs: true
    may_use_nonSensitiveReasonCodes: true
    must_not_quote_raw_memory: true
  RVE_SafetyGate:
    may_consume_structured_attention_codes: true
    may_raise_review_or_unknown: true
    may_clear_D9_or_SafetyGate_from_race_or_recall: false
```

---

## 11. Draft Type Shapes

These shapes are contract sketches only. They do not select a database, storage vendor, route name, or UI component.

```ts
type RaceResultStatus =
  | "planned"
  | "completed"
  | "dns"
  | "dnf"
  | "postponed"
  | "cancelled"
  | "unknown";

type HistoricalRecallRedactionState =
  | "no_raw_text_source"
  | "raw_source_redacted"
  | "private_source_suppressed"
  | "source_missing"
  | "source_stale"
  | "source_conflicting";

interface RaceDayCheckInRecord {
  recordSubtype: "RACE_DAY_CHECKIN";
  cycleDay: {
    namespace: "CYCLE_DAY";
    value: "D-0";
    displayLabel: "D-0";
    isRuleId: false;
  };
  raceContext: {
    raceId: string;
    raceAnchorId: string;
    raceDate: string;
    timezone: string;
    raceDistance?: { value: number; unit: "km" | "m" | "mile" };
    resultStatus: RaceResultStatus;
  };
  sourceRefs: string[];
  privacyTier: "athlete_private" | "coach_visible_with_consent" | "audit_metadata_only";
  uncertaintyState:
    | "complete"
    | "missing_result"
    | "stale_race_anchor"
    | "conflicting_race_anchor"
    | "requires_human_review";
}

interface HistoricalRecallDisplayRecord {
  recallId: string;
  sourceRefs: string[];
  nonSensitiveReasonCodes: string[];
  privacyTier:
    | "athlete_visible_safe_summary"
    | "coach_visible_with_consent"
    | "audit_metadata_only";
  redactionState: HistoricalRecallRedactionState;
  confidence: number;
  uncertaintyState:
    | "sufficient"
    | "insufficient_source"
    | "stale_source"
    | "conflicting_source"
    | "requires_human_review";
}
```

---

## 12. Required Target Patches Before Implementation

This draft can be used as a downstream patch source only after owner review accepts it as a working source.

| Target | Required patch | Issue closure allowed now |
|---|---|---|
| `DAILY_LOG_AND_CHECKIN_SPEC.md` | add race-day record subtype reference and raw race narrative ban | NO |
| `MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md` | bind `RaceAnchor` and `CYCLE_DAY.D-0` to race record subtype | NO |
| `PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md` | bind historical recall to sourceRefs, privacyTier, redactionState, and no raw quote rule | NO |
| `ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md` | bind race result and historical recall display states to uncertainty/source refs | NO |
| `APP_IMPLEMENTATION_BRIDGE.md` | storage, endpoint, consent, audit, tenant isolation, and deletion rules | NO |

Any target patch must open the target file, recount that target's open issue table, and avoid issue closure unless required runtime evidence and owner acceptance exist.

---

## 13. Open Issues

These are this draft's own issues. They do not change issue counts in other SPEC files.

| Issue ID | Priority | Canonical blocking | Status | Problem | Required next evidence |
|---|---|---|---|---|---|
| `OI-RHR-DAILYLOG-RACE-SUBTYPE-BINDING-001` | P1 | YES | OPEN | Daily Log does not yet own `RaceDayCheckInRecord` as an accepted subtype. | Patch Daily Log after this draft is accepted, then recount target issues. |
| `OI-RHR-APP-BRIDGE-STORAGE-BINDING-001` | P1 | YES | OPEN | App Bridge does not yet define storage, endpoint, consent, tenant isolation, or audit behavior for race records and historical recall. | Patch App Bridge and run privacy review before implementation. |
| `OI-RHR-HISTORICAL-RECALL-PRIVACY-001` | P1 | YES | OPEN | Historical recall redaction, sourceRef preservation, and no-raw-quote behavior are draft-only. | Prove raw memory/memo/symptom text cannot persist or appear in display copy. |
| `OI-RHR-RUNTIME-EVIDENCE-001` | P1 | YES | OPEN | No runtime or CI evidence proves race subtype validation, `CYCLE_DAY.D-0` namespace enforcement, or historical recall privacy filtering. | Add actual terminal or CI logs after implementation exists. |
| `OI-RHR-MICROCYCLE-RACE-ANCHOR-BINDING-001` | P2 | NO | OPEN | Race anchor update/conflict workflow remains owned by Microcycle/Calendar review and is not implementation-bound here. | Patch Microcycle/Calendar after review if this subtype is accepted. |
| `OI-RHR-UI-SURFACE-BINDING-001` | P2 | NO | OPEN | Home and Log Entry surfaces are design references only. | Patch UI/screen contracts or implementation after this draft is reviewed. |
| `OI-RHR-EXTERNAL-LLM-POLICY-001` | P2 | NO | OPEN | Future historical recall summarization through external LLM services is not accepted for private athlete data. | Keep disabled until explicit privacy/security review exists. |

---

## 14. Self-Check

| Check | Result |
|---|---|
| First line is filename H1 | PASS |
| Final marker is final line | PASS |
| Metadata declares `DRAFT_FOR_REVIEW` | PASS |
| Source decision remains `PENDING_REVIEW` | PASS |
| `executed_tests_total` is 0 | PASS |
| Does not claim runtime evidence | PASS |
| Does not claim canonical promotion | PASS |
| Does not close downstream issues | PASS |
| Open issue count is 7 | PASS |
| Canonical blocking count is 4 | PASS |
| Uses `CYCLE_DAY.D-0` and forbids bare `D-*` data/API/audit fields | PASS |
| Forbids raw historical memory, memo, and symptom clause persistence | PASS |
| Race/recall can raise attention but cannot clear D9 or Safety Gate | PASS |

[DRAFT_COMPLETE]
