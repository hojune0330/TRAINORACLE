# ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md

```yaml
doc_id: trainoracle-spec-015-analysis-and-visualization-data-contract
spec_id: ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT
title: TrainOracle Analysis And Visualization Data Contract
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

`ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md` defines how TrainOracle turns accepted structured facts into data that can be shown in Analysis, Dashboard, Session Detail, Calendar, and coach review surfaces.

This document exists so visual products can show training load, readiness, session patterns, body-area trends, source coverage, safety context, and uncertainty without inventing facts or storing private free text.

It is a productization data contract. It is not a training-load algorithm, not a chart implementation spec, not a medical clearance workflow, not a Plan Generator, not runtime evidence, and not canonical promotion.

---

## 2. Non-Purpose

This document does not:

- define new `RULE_SPEC_D1_D9.D-*` rule semantics
- redefine `D9_ACTIVE`, `D9_UNKNOWN`, `D9_CLEARED`, or ADVISORY
- calculate final CTL, ATL, TSB, TSS, HR drift, or race-readiness formulas
- authorize external LLM processing with private athlete data
- store raw athlete free text, raw memo text, raw symptom clauses, injury narratives, medical notes, rehab notes, evidence clauses, or guardian private notes
- create plan options or modify Plan Generator output
- clear `D9_ACTIVE`, `D9_UNKNOWN`, Safety Gate blocks, or human-review requirements
- close Daily Log, Daily Brief, RVE, Safety Gate, Plan Generator, App Bridge, UI, or implementation issues

---

## 3. Source Basis

This draft was created only after exact local filename search found no current `ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md`.

Source references used for this draft:

| Source | Treatment |
|---|---|
| `SPEC_LEGACY_ALIGNMENT_AND_DAILY_LOG_PLAN.md` | Productization order and requirement that Analysis, Session Detail, Calendar, and Dashboard visualizations bind to structured data sources |
| `specs/reconstruct/DAILY_LOG_AND_CHECKIN_SPEC.md` | Daily structured ingestion, transient memo boundary, body-area and readiness trend needs |
| `specs/reconstruct/DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC.md` | Source refs, confidence/uncertainty, reason-code boundary, and non-blocking attention surfaces |
| `specs/active/SESSION_CLASSIFIER_SPEC.md` | Session category and classification source |
| `specs/active/ATHLETE_PROFILE_SPEC.md` | Athlete-scoped profile context and source priority boundaries |
| `specs/active/PHYSIO_SOURCE_TRUST_SPEC.md` | Physio source trust, recency, conflict, consent, and no-D9-clearing rule |
| `specs/reconstruct/RULE_VALIDATION_ENGINE_CONTRACT.md` | RVE signal shape and safety status boundary |
| `specs/reconstruct/PLAN_SAFETY_GATE_SPEC.md` | Pre-generation safety gate status boundary |
| `specs/active/PLAN_GENERATOR_SPEC.md` | Plan output as downstream context only |
| `design-system/VISUALIZATION_SYSTEM.md` | Visualization intent, chart families, evidence-first display direction |
| `design-system/SCREENS.md` | Dashboard, Calendar, Session Detail, AI Inbox, and Analysis surface references |

---

## 4. Global Invariants

```yaml
analysis_visualization_invariants:
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
  reason_code_storage_preferred: true
  source_refs_required: true
  confidence_or_uncertainty_required: true
  missing_data_must_be_visible: true
  stale_data_must_be_visible: true
  conflicting_data_must_be_visible: true
  analysis_can_raise_attention: true
  analysis_can_clear_D9: false
  analysis_can_clear_safety_gate: false
  analysis_can_create_plan_options: false
```

---

## 5. Safety Boundary

Analysis and visualization surfaces are evidence-display layers.

They may show:

- `D9_ACTIVE`, `D9_UNKNOWN`, `D9_CLEARED`, and ADVISORY-derived display states from accepted RVE/Safety Gate records
- source-backed reason codes
- stale, missing, conflicting, or insufficient source states
- non-sensitive warnings that review is needed
- links or references to accepted structured source records

They must not:

- treat `D9_CLEARED` as medical clearance
- treat ADVISORY as a fourth D9 disposition
- use good physio data to clear D9 risk
- use good trend data to clear Safety Gate blocks
- downgrade `D9_ACTIVE` or `D9_UNKNOWN`
- hide blockers because a dashboard KPI looks normal
- infer safety clearance from athlete compliance, session completion, green charts, or coach preference

---

## 6. Privacy Boundary

Visualization data may persist only structured values, source refs, confidence/uncertainty states, non-sensitive reason codes, and display-safe labels.

Forbidden persisted fields:

```yaml
forbidden_persisted_fields:
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
```

If a visualization needs to explain why a value is sensitive or incomplete, it must use reason codes and source coverage states instead of raw private text.

---

## 7. Visualization Surfaces

| Surface | Allowed purpose | Required data treatment |
|---|---|---|
| Dashboard | Show today, cycle, unread attention, source coverage, and compact trends | Display source-backed states only; do not hide unresolved safety blocks |
| Analysis | Show medium-range and long-range trends | Use structured metrics with source refs, date ranges, and uncertainty |
| Session Detail | Show one session result and evidence context | Link each claim to source refs; show validation and uncertainty visibly |
| Calendar | Show planned/completed sessions, cycle context, and safe status indicators | Use `CYCLE_DAY` labels only for calendar/cycle meaning; never as D-rule IDs |
| Coach Review | Show athletes or sessions needing attention | Attention ranking may prioritize review but cannot clear safety state |
| AI Inbox / Daily Brief | Reuse visualization signal summaries where accepted | Preserve source refs, confidence/uncertainty, and no-plan-option boundary |

---

## 8. Data Families

### 8.1 AnalysisDataSet

```yaml
AnalysisDataSet:
  datasetId: string
  tenantId: string
  groupId: string_or_null
  athleteId: string
  dateRange:
    startDate: ISO_DATE
    endDate: ISO_DATE
  generatedAt: ISO_DATETIME
  generatedBy: SYSTEM_RULE_ENGINE
  sourceRefs: SourceRef[]
  sourceCoverage: SourceCoverageSummary
  uncertaintyState: VisualizationUncertaintyState
  privacy:
    rawTextStored: false
    rawSymptomClauseStored: false
    externalPrivateLlmUsed: false
  safetyBoundary:
    mayClearD9Risk: false
    mayClearSafetyGateBlock: false
    mayCreatePlanOption: false
  panels: VisualizationPanel[]
```

### 8.2 VisualizationPanel

```yaml
VisualizationPanel:
  panelId: string
  surface: DASHBOARD | ANALYSIS | SESSION_DETAIL | CALENDAR | COACH_REVIEW | DAILY_BRIEF | AI_INBOX
  panelKind: KPI_GRID | LINE_SERIES | BAR_SERIES | STACKED_BAR | HEATMAP | TABLE | TIMELINE | STATUS_RAIL | SOURCE_COVERAGE
  titleCode: string
  metricCodes: string[]
  dateRange: DateRange
  dataPoints: VisualizationDataPoint[]
  sourceRefs: SourceRef[]
  confidence: number_or_null
  uncertaintyState: VisualizationUncertaintyState
  nonSensitiveReasonCodes: string[]
  emptyStateCode: string_or_null
  safetyDisplay: SafetyDisplayState_or_null
```

### 8.3 VisualizationDataPoint

```yaml
VisualizationDataPoint:
  pointId: string
  date: ISO_DATE
  x: string_or_number
  y: number_or_null
  yUnit: string
  metricCode: string
  sourceRefs: SourceRef[]
  confidence: number_or_null
  uncertaintyState: VisualizationUncertaintyState
  displayStatus: OBSERVED | DERIVED | ESTIMATED_NOT_ALLOWED | MISSING | STALE | CONFLICTING | INSUFFICIENT
  nonSensitiveReasonCodes: string[]
```

`ESTIMATED_NOT_ALLOWED` is a display status for rejected or hidden points. It does not allow invented values.

---

## 9. SourceRef Contract

Every panel and data point must carry source refs or an explicit insufficient-source state.

```ts
export type VisualizationSourceKind =
  | "DAILY_CHECKIN_RECORD"
  | "CLASSIFIED_SESSION_RECORD"
  | "SESSION_RESULT_RECORD"
  | "ATHLETE_PROFILE_CONTEXT"
  | "PHYSIO_SOURCE_TRUST_RESULT"
  | "RVE_SIGNAL"
  | "PLAN_SAFETY_GATE_RESULT"
  | "PLAN_GENERATOR_OUTPUT"
  | "DAILY_BRIEF_SIGNAL"
  | "AI_INBOX_SIGNAL"
  | "DESIGN_REFERENCE";

export interface SourceRef {
  sourceKind: VisualizationSourceKind;
  sourceId: string;
  sourceVersion: string | null;
  observedAt: string | null;
  trustState:
    | "ACCEPTED"
    | "STALE"
    | "CONFLICTING"
    | "MISSING"
    | "SOURCE_NOT_VERIFIED"
    | "DESIGN_REFERENCE_ONLY";
  containsPrivateRawText: false;
}
```

Design references may guide the shape of a panel, but they must never be used as athlete data.

---

## 10. Uncertainty States

```ts
export type VisualizationUncertaintyState =
  | "NONE"
  | "LOW_CONFIDENCE"
  | "INSUFFICIENT_SOURCE"
  | "STALE_SOURCE"
  | "CONFLICTING_SOURCE"
  | "METRIC_NOT_DEFINED"
  | "REQUIRES_HUMAN_REVIEW"
  | "SAFETY_BLOCK_PRESENT";
```

Rules:

- `NONE` requires accepted source refs and no unresolved conflict for the displayed claim.
- `METRIC_NOT_DEFINED` must be used when a design surface names a metric but no accepted algorithm contract exists.
- `SAFETY_BLOCK_PRESENT` must be visible when RVE/Safety Gate says a block exists.
- `REQUIRES_HUMAN_REVIEW` cannot be converted into a safe/green display state by chart styling.

---

## 11. Metric Definition Boundary

Design docs mention CTL, ATL, TSB, HR drift, weekly TSS, energy distribution, body-area trends, cycle rhythm, and heatmaps.

This draft may name those as `metricCode` values, but it does not define final formulas. Until an accepted metric-algorithm spec exists:

```yaml
metric_definition_policy:
  accepted_formula_required_for_numeric_authority: true
  design_metric_name_is_not_formula_authority: true
  unknown_formula_display_state: METRIC_NOT_DEFINED
  source_refs_required_for_every_numeric_point: true
  invented_values_forbidden: true
```

```yaml
metric_envelope_binding:
  patched_from: METRIC_ALGORITHM_CONTRACT.md; accepted 2026-07-10 by SPEC_SOURCE_ACCEPTANCE_DECISION_ROUND4.md
  binding_type: envelope_and_boundary_reference_only
  accepted_scope:
    - formulaVersion
    - sourceRefs
    - inputCompleteness
    - confidence
    - uncertaintyState
    - uncertaintyBand
    - privacyTier
    - nonSensitiveReasonCodes
  explicitly_excluded_scope:
    - METRIC_ALGORITHM_CONTRACT.md Section 6 Draft Formula Set
    - CTL_ATL_TSB_numeric_formula_authority
    - HR_drift_numeric_formula_authority
    - monotony_or_load_change_numeric_formula_authority
  implementation_rule:
    formulas_must_not_be_implemented_or_copied_while_OI_MAC_FORMULA_ACCEPTANCE_001_is_OPEN: true
```

Analysis may consume the accepted metric envelope, source-reference, confidence, and uncertainty boundary from `METRIC_ALGORITHM_CONTRACT.md`. It must not copy, quote as authority, or implement that document's §6 draft formulas while Round 4 note N2 and `OI-MAC-FORMULA-ACCEPTANCE-001` keep formula acceptance open.

Recommended initial metric code families:

| Family | Example metric codes | Initial treatment |
|---|---|---|
| Training load | `TRAINING_LOAD_DAILY`, `WEEKLY_LOAD_SUMMARY`, `LOAD_DISTRIBUTION_BY_ZONE` | Source-backed only; formula authority remains open |
| Readiness | `SLEEP_QUALITY_STRUCTURED`, `FATIGUE_RATING_STRUCTURED`, `RPE_STRUCTURED` | Daily Log/Profile/Physio structured sources only |
| Session result | `SESSION_COMPLETION_STATE`, `MAIN_SESSION_HR_DRIFT`, `PACE_SPLIT_CURVE` | Session result source required |
| Energy distribution | `ENERGY_SYSTEM_DISTRIBUTION` | Session Classifier source required |
| Body area | `BODY_AREA_ATTENTION_TREND` | Structured body-area codes only; no raw symptom text |
| Safety | `RVE_D9_STATUS`, `SAFETY_GATE_STATUS`, `HUMAN_REVIEW_REQUIRED` | RVE/Safety Gate source required |
| Source coverage | `SOURCE_COVERAGE_SCORE`, `STALE_SOURCE_COUNT`, `CONFLICTING_SOURCE_COUNT` | Does not imply safety clearance |

---

## 12. Aggregation Policy

Aggregation is allowed only when each input point is structured, source-referenced, and privacy-safe.

```yaml
aggregation_policy:
  raw_text_input_allowed: false
  private_llm_input_allowed: false
  hidden_interpolation_allowed: false
  missing_point_behavior: show_missing_or_insufficient
  stale_point_behavior: show_stale
  conflicting_point_behavior: show_conflicting
  unsafe_point_behavior: show_safety_context_without_clearing
  aggregate_can_raise_attention: true
  aggregate_can_clear_attention: false
```

Attention priority may decrease only by accepted source updates or human workflow outside this draft. A smooth chart line alone is never a clearing event.

---

## 13. SafetyDisplayState

```ts
export interface SafetyDisplayState {
  rveStatus: "ACTIVE" | "UNKNOWN" | "CLEARED" | null;
  safetyGateStatus: "BLOCK" | "REVIEW_REQUIRED" | "ALLOW" | null;
  advisoryPresent: boolean;
  blocksPlanGeneration: boolean | null;
  requiresHumanReview: boolean | null;
  sourceRefs: SourceRef[];
  nonSensitiveReasonCodes: readonly string[];
  displayOnly: true;
  mayClearD9Risk: false;
  mayClearSafetyGateBlock: false;
}
```

`SafetyDisplayState` is a display projection of upstream safety contracts. It is not an evaluator.

---

## 14. API Draft

This draft proposes read-only analysis endpoints for future App Bridge work. The endpoints are not implementation evidence.

```yaml
read_only_api_draft:
  GET /bridge/athletes/{athleteId}/analysis-data:
    returns: AnalysisDataSet
    purpose: retrieve source-backed visualization data for a date range
    writes_training_state: false
    writes_safety_state: false
    may_clear_D9: false
    may_clear_safety_gate: false

  GET /bridge/athletes/{athleteId}/visualization-panels:
    returns: VisualizationPanel[]
    purpose: retrieve panel-specific data for Dashboard, Analysis, Session Detail, Calendar, Coach Review, Daily Brief, or AI Inbox
    writes_training_state: false
    writes_safety_state: false
    may_create_plan_option: false
```

Any write endpoint for annotations, dismissals, human review, or source correction must be specified in a separate App Bridge or workflow contract.

---

## 15. TypeScript Shape Draft

```ts
export type VisualizationSurface =
  | "DASHBOARD"
  | "ANALYSIS"
  | "SESSION_DETAIL"
  | "CALENDAR"
  | "COACH_REVIEW"
  | "DAILY_BRIEF"
  | "AI_INBOX";

export type VisualizationPanelKind =
  | "KPI_GRID"
  | "LINE_SERIES"
  | "BAR_SERIES"
  | "STACKED_BAR"
  | "HEATMAP"
  | "TABLE"
  | "TIMELINE"
  | "STATUS_RAIL"
  | "SOURCE_COVERAGE";

export interface VisualizationDataPoint {
  pointId: string;
  date: string;
  x: string | number;
  y: number | null;
  yUnit: string;
  metricCode: string;
  sourceRefs: readonly SourceRef[];
  confidence: number | null;
  uncertaintyState: VisualizationUncertaintyState;
  displayStatus:
    | "OBSERVED"
    | "DERIVED"
    | "ESTIMATED_NOT_ALLOWED"
    | "MISSING"
    | "STALE"
    | "CONFLICTING"
    | "INSUFFICIENT";
  nonSensitiveReasonCodes: readonly string[];
}

export interface VisualizationPanel {
  panelId: string;
  surface: VisualizationSurface;
  panelKind: VisualizationPanelKind;
  titleCode: string;
  metricCodes: readonly string[];
  dateRange: { startDate: string; endDate: string };
  dataPoints: readonly VisualizationDataPoint[];
  sourceRefs: readonly SourceRef[];
  confidence: number | null;
  uncertaintyState: VisualizationUncertaintyState;
  nonSensitiveReasonCodes: readonly string[];
  emptyStateCode: string | null;
  safetyDisplay: SafetyDisplayState | null;
}

export interface AnalysisDataSet {
  datasetId: string;
  tenantId: string;
  groupId: string | null;
  athleteId: string;
  dateRange: { startDate: string; endDate: string };
  generatedAt: string;
  generatedBy: "SYSTEM_RULE_ENGINE";
  sourceRefs: readonly SourceRef[];
  sourceCoverage: SourceCoverageSummary;
  uncertaintyState: VisualizationUncertaintyState;
  privacy: {
    rawTextStored: false;
    rawSymptomClauseStored: false;
    externalPrivateLlmUsed: false;
  };
  safetyBoundary: {
    mayClearD9Risk: false;
    mayClearSafetyGateBlock: false;
    mayCreatePlanOption: false;
  };
  panels: readonly VisualizationPanel[];
}
```

---

## 16. Downstream Binding Rules

### 16.1 Daily Log

Daily Log can provide structured check-in values, body-area codes, readiness values, non-sensitive reason codes, and source refs.

Daily Log cannot provide persisted raw memo text, raw symptom clauses, injury narratives, or medical notes to visualization storage.

### 16.2 Session Classifier

Session Classifier can provide accepted session type, energy-system classification, and classification confidence.

If classification is uncertain, visualization must show uncertainty instead of forcing a clean category.

### 16.3 Physio Source Trust

Physio Source Trust can provide source recency, conflict, consent, and trust states.

Good physio source state can improve source confidence display, but it cannot clear D9 risk or Safety Gate blocks.

### 16.4 RVE And Plan Safety Gate

RVE and Safety Gate can provide display-only safety states.

Analysis must preserve upstream blocking semantics:

- `D9_ACTIVE` blocks plan generation
- `D9_UNKNOWN` blocks generation or requires human review
- `D9_CLEARED` is not medical clearance
- ADVISORY is non-blocking under `D9_CLEARED`

### 16.5 Plan Generator

Plan Generator output may be displayed as a source-backed plan context.

Analysis cannot modify a plan, create a plan option, or use chart values to bypass generation gates.

### 16.6 Daily Brief And AI Inbox

Daily Brief and AI Inbox may consume accepted visualization panels or data points as context only when source refs and uncertainty states are preserved.

Visualization data cannot turn an AI Inbox item into a safety clearance.

---

## 17. Empty And Error States

| State | Required display meaning |
|---|---|
| `MISSING` | No accepted source exists for this point |
| `STALE` | Source exists but is outside accepted recency |
| `CONFLICTING` | Sources disagree and no accepted resolution exists |
| `INSUFFICIENT` | There is not enough structured data to support the claim |
| `METRIC_NOT_DEFINED` | A named metric exists in design/product intent but no accepted formula contract exists |
| `SAFETY_BLOCK_PRESENT` | Upstream RVE/Safety Gate reports a blocking or review-required state |

Empty and error states should be useful and honest. They must not be styled as success.

---

## 18. Audit And Storage Notes

Analysis dataset generation may be audited using:

- dataset id
- athlete id
- tenant id
- date range
- generation timestamp
- source refs
- metric codes
- uncertainty states
- non-sensitive reason codes
- policy booleans proving no raw text or private external LLM data was stored

Analysis dataset generation must not audit:

- raw athlete text
- raw symptom phrases
- private medical notes
- private guardian notes
- private external LLM prompts or responses

---

## 19. Issue Closure Boundary

Creating this file does not close any issue in:

- `DAILY_LOG_AND_CHECKIN_SPEC.md`
- `DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC.md`
- `APP_IMPLEMENTATION_BRIDGE.md`
- `ATHLETE_PROFILE_SPEC.md`
- `SESSION_CLASSIFIER_SPEC.md`
- `PHYSIO_SOURCE_TRUST_SPEC.md`
- `RULE_VALIDATION_ENGINE_CONTRACT.md`
- `PLAN_SAFETY_GATE_SPEC.md`
- `PLAN_GENERATOR_SPEC.md`
- design-system implementation files

Issue closure requires accepted source spec, target patch, target open-issue recount, and implementation/runtime evidence where applicable.

---

## 20. Open Issues

| Issue ID | Priority | Canonical blocking | Status | Problem | Required next evidence |
|---|---|---|---|---|---|
| `OI-AVD-APP-BRIDGE-BINDING-001` | P1 | YES | OPEN | Read-only analysis endpoints and storage/audit boundaries are not accepted in App Bridge. | Patch `APP_IMPLEMENTATION_BRIDGE.md`, recount target issues, and review privacy boundary. |
| `OI-AVD-METRIC-SOURCE-OWNERSHIP-001` | P1 | YES | OPEN | Final formulas for CTL/ATL/TSB, HR drift, load, and related derived metrics are not accepted here; only the metric envelope/boundary reference is patched. | Patched from `METRIC_ALGORITHM_CONTRACT.md` and `SPEC_SOURCE_ACCEPTANCE_DECISION_ROUND4.md` for envelope scope only; do not use numeric formula authority while `OI-MAC-FORMULA-ACCEPTANCE-001` is OPEN. |
| `OI-AVD-SAFETY-DISPLAY-BINDING-001` | P1 | YES | OPEN | Safety display projections are defined in this draft but not accepted in App Bridge or UI implementation contracts. | Patch implementation contracts without allowing visualization to clear D9 or Safety Gate states. |
| `OI-AVD-RUNTIME-EVIDENCE-001` | P1 | YES | OPEN | No runtime or CI evidence proves dataset generation, source refs, or privacy guards. | Add actual terminal or CI logs after implementation exists. |
| `OI-AVD-UI-SURFACE-BINDING-001` | P2 | NO | OPEN | Dashboard, Analysis, Session Detail, Calendar, Daily Brief, and AI Inbox surfaces are design references only. | Patch implementation or UI contracts after this data contract is reviewed. |
| `OI-AVD-DESIGN-SYSTEM-A11Y-BINDING-001` | P2 | NO | OPEN | Visualization design references still need accessibility and non-color-only encoding acceptance. | Bind chart states to design-system accessibility rules before implementation. |
| `OI-AVD-EXPORT-TOOLTIP-PRIVACY-001` | P2 | NO | OPEN | Tooltip, drilldown, export, and screenshot privacy boundaries are not accepted in implementation. | Prove raw text and private notes cannot appear in labels, tooltips, exports, or audit. |

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
| Forbids raw memo/free-text/symptom clause storage | PASS |
| Forbids external LLM with private athlete data | PASS |
| Cannot clear D9 or Safety Gate blocks | PASS |
| Keeps `CYCLE_DAY` separate from D-rule IDs | PASS |
| Avoids final metric formula authority | PASS |

[DRAFT_COMPLETE]
