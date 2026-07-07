# MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md

```yaml
doc_id: trainoracle-spec-017-microcycle-and-calendar-mapping
spec_id: MICROCYCLE_AND_CALENDAR_MAPPING_SPEC
title: TrainOracle Microcycle And Calendar Mapping Spec
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

`MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md` defines how TrainOracle maps the 9.5-day training cycle, `CYCLE_DAY.*` labels, planned sessions, race anchors, and Calendar/Dashboard displays without confusing cycle labels with safety rule identifiers.

The goal is to let Plan Generator, Calendar, Dashboard, Session Detail, Analysis, Daily Brief, and AI Inbox refer to the same date/cycle context while preserving namespace separation, source refs, uncertainty, and safety-gate boundaries.

This document is a productization mapping contract. It is not a Plan Generator, not a training philosophy proof, not a calendar UI implementation, not a D9 evaluator, not runtime evidence, and not canonical promotion.

---

## 2. Non-Purpose

This document does not:

- define or justify the 9.5-day coaching method itself
- create, rank, select, or modify plan options
- redefine `RULE_SPEC_D1_D9.D-*` rule semantics
- treat `LEGACY_PHASE_D.D-*` workflow items as current rule IDs
- use bare `D-*` labels in new contracts
- clear `D9_ACTIVE`, `D9_UNKNOWN`, Safety Gate blocks, or human-review requirements
- treat `D9_CLEARED` as medical clearance
- authorize plan generation when Safety Gate blocks generation
- store raw athlete free text, raw memo text, raw symptom clauses, injury narratives, medical notes, rehab notes, evidence clauses, or guardian private notes
- close `OI-PG-MICROCYCLE-CALENDAR-MAPPING-001` or any downstream issue

---

## 3. Source Basis

This draft was created only after exact local filename search found no current `MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md`.

Source references used for this draft:

| Source | Treatment |
|---|---|
| `SPEC_LEGACY_ALIGNMENT_AND_DAILY_LOG_PLAN.md` | Productization order and namespace guardrails |
| `specs/active/PLAN_GENERATOR_SPEC.md` | Owns planned dates, session slots, and `OI-PG-MICROCYCLE-CALENDAR-MAPPING-001` |
| `specs/reconstruct/DAILY_LOG_AND_CHECKIN_SPEC.md` | Defines `CYCLE_DAY` namespace and forbids bare D labels as rule IDs |
| `specs/reconstruct/ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md` | Requires Calendar and visualization data to preserve source refs and namespace separation |
| `specs/reconstruct/PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md` | Provides rationale privacy boundary for planned-session explanations |
| `specs/reconstruct/PLAN_SAFETY_GATE_SPEC.md` | Defines pre-generation block/review/allow boundary |
| `specs/reconstruct/RULE_VALIDATION_ENGINE_CONTRACT.md` | Provides RVE signal and D9 status boundary |
| `design-system/SCREENS.md` | Calendar 9.5-Cycle product intent and screen priority |
| `design-system/VISUALIZATION_SYSTEM.md` | Cycle rhythm rail and Calendar visual encoding references |
| `HANDOFF.md` | Calendar and 9.5-day cycle implementation handoff context |

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
    meaning: old workflow Phase validation item

  cycle_day_namespace:
    name: CYCLE_DAY
    example: CYCLE_DAY.D-5
    meaning: cycle or race-day display label, not a rule id

  bare_D_reference_in_new_specs: FORBIDDEN
```

Rules:

- New product and implementation contracts must use `CYCLE_DAY.*` when referring to calendar/cycle labels.
- New safety contracts must use `RULE_SPEC_D1_D9.*` when referring to current rule IDs.
- Legacy workflow text may be referenced only as `LEGACY_PHASE_D.*`.
- Calendar UI may display short labels like `D-5` only when the backing data field is explicitly `namespace: CYCLE_DAY`.

---

## 5. Global Invariants

```yaml
microcycle_calendar_invariants:
  local_files_are_truth: true
  no_runtime_evidence_claim: true
  no_canonical_promotion_claim: true
  no_issue_closure_from_this_draft: true
  no_rule_semantic_redefinition: true
  no_bare_D_reference_in_contract_fields: true
  cycle_labels_are_not_rule_ids: true
  source_refs_required: true
  uncertainty_required_when_anchor_or_timezone_missing: true
  calendar_can_display_safety_state: true
  calendar_can_clear_D9: false
  calendar_can_clear_safety_gate: false
  calendar_can_create_plan_option: false
  calendar_can_select_plan_option: false
  raw_free_text_storage_forbidden: true
  raw_symptom_clause_storage_forbidden: true
  private_note_storage_forbidden: true
```

---

## 6. Mapping Concepts

| Concept | Meaning | Boundary |
|---|---|---|
| `MicrocycleAnchor` | The date/context used to position a 9.5-day cycle | Not a rule ID and not a safety clearance |
| `CycleSlot` | A display bin in the 9.5-day rhythm rail | Not a training prescription by itself |
| `CycleDayLabel` | A `CYCLE_DAY.*` label such as `CYCLE_DAY.D-5` | Not `RULE_SPEC_D1_D9.D-*` |
| `CalendarSessionProjection` | Calendar-facing view of an accepted planned or completed session | Does not create or mutate sessions |
| `RaceAnchor` | Race or target event date used for countdown labels | Not medical or safety clearance |
| `MappingUncertaintyState` | Missing/stale/conflicting anchor, timezone, or source state | Must be visible instead of guessed |

---

## 7. Required Data Contract

### 7.1 MicrocycleCalendarContext

```yaml
MicrocycleCalendarContext:
  contextId: string
  tenantId: string
  groupId: string_or_null
  athleteId: string
  timezone: IANA_TIMEZONE
  dateRange:
    startDate: ISO_DATE
    endDate: ISO_DATE
  generatedAt: ISO_DATETIME
  generatedBy: SYSTEM_RULE_ENGINE
  sourceRefs: SourceRef[]
  anchors: MicrocycleAnchor[]
  cycleDays: CycleDayAssignment[]
  sessionProjections: CalendarSessionProjection[]
  uncertaintyState: MappingUncertaintyState
  namespaceBoundary:
    cycleDayNamespace: CYCLE_DAY
    ruleNamespaceAllowed: false
    bareDReferenceAllowed: false
  safetyBoundary:
    mayCreatePlanOption: false
    maySelectPlanOption: false
    mayClearD9Risk: false
    mayClearSafetyGateBlock: false
```

### 7.2 MicrocycleAnchor

```yaml
MicrocycleAnchor:
  anchorId: string
  anchorKind: RACE_DATE | TARGET_EVENT | PLAN_START | COACH_SELECTED_REFERENCE | SYSTEM_ESTIMATED_REQUIRES_REVIEW
  anchorDate: ISO_DATE
  timezone: IANA_TIMEZONE
  sourceRefs: SourceRef[]
  confidence: number_or_null
  uncertaintyState: MappingUncertaintyState
  humanReviewRequired: boolean
```

### 7.3 CycleDayAssignment

```yaml
CycleDayAssignment:
  cycleDayAssignmentId: string
  date: ISO_DATE
  timezone: IANA_TIMEZONE
  namespace: CYCLE_DAY
  cycleDayLabel: string
  displayLabel: string
  cycleSlotIndex: integer
  cycleSlotCount: 10
  halfDayPhase: AM | PM | FULL_DAY | UNKNOWN
  sourceRefs: SourceRef[]
  uncertaintyState: MappingUncertaintyState
  isRuleId: false
```

`displayLabel` may be short for UI, but storage and API contracts must keep `namespace: CYCLE_DAY` and `isRuleId: false`.

### 7.4 CalendarSessionProjection

```yaml
CalendarSessionProjection:
  projectionId: string
  plannedSessionDraftId: string_or_null
  classifiedSessionId: string_or_null
  planOptionId: string_or_null
  date: ISO_DATE
  timezone: IANA_TIMEZONE
  sessionSlot: AM | PM | FULL_DAY | UNSPECIFIED
  cycleDayAssignmentId: string_or_null
  planGenerationRunId: string_or_null
  safetyDisplayStateRef: string_or_null
  rationaleBundleId: string_or_null
  sourceRefs: SourceRef[]
  projectionState: PLANNED | COMPLETED | MISSED | CHANGED | BLOCKED_BY_SAFETY_GATE | REVIEW_REQUIRED | SOURCE_INSUFFICIENT
  uncertaintyState: MappingUncertaintyState
  mayCreatePlanOption: false
  mayClearD9Risk: false
  mayClearSafetyGateBlock: false
```

---

## 8. SourceRef Contract

```ts
export type CalendarMappingSourceKind =
  | "PLAN_GENERATION_RUN"
  | "PLAN_OPTION"
  | "PLANNED_SESSION_DRAFT"
  | "CLASSIFIED_SESSION_RECORD"
  | "DAILY_CHECKIN_RECORD"
  | "ATHLETE_PROFILE_SNAPSHOT"
  | "PLAN_SAFETY_GATE_RESULT"
  | "RVE_SIGNAL"
  | "ANALYSIS_DATASET"
  | "PLAN_RATIONALE_BUNDLE"
  | "DESIGN_REFERENCE";

export interface CalendarMappingSourceRef {
  sourceKind: CalendarMappingSourceKind;
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

Design references may guide display shape. They must not create athlete data or calendar facts.

---

## 9. Mapping Uncertainty States

```ts
export type MappingUncertaintyState =
  | "NONE"
  | "MISSING_ANCHOR"
  | "STALE_ANCHOR"
  | "CONFLICTING_ANCHOR"
  | "MISSING_TIMEZONE"
  | "CONFLICTING_TIMEZONE"
  | "PLAN_SOURCE_NOT_ACCEPTED"
  | "SAFETY_BLOCK_PRESENT"
  | "REQUIRES_HUMAN_REVIEW"
  | "SOURCE_INSUFFICIENT";
```

Rules:

- `NONE` requires accepted source refs, accepted timezone, accepted anchor, and no unresolved conflict.
- `SAFETY_BLOCK_PRESENT` must be shown when Safety Gate blocks or requires review.
- `MISSING_TIMEZONE` or `CONFLICTING_TIMEZONE` must prevent precise day-boundary claims.
- `PLAN_SOURCE_NOT_ACCEPTED` must be used when a plan draft is not accepted for calendar projection.

---

## 10. 9.5-Day Cycle Display Policy

The Calendar may render the 9.5-day rhythm as a 10-slot rail.

```yaml
cycle_display_policy:
  display_slot_count: 10
  cycle_length_label: "9.5-day"
  half_day_transition_supported: true
  slot_index_is_display_index: true
  slot_index_is_not_rule_id: true
  color_only_encoding_forbidden: true
  source_refs_required: true
  uncertainty_state_required: true
```

This contract does not define the coaching rationale for why a given session belongs in a given slot. Plan Generator, accepted templates, and coach-approved plan context own that upstream decision.

---

## 11. Calendar View Boundary

Allowed views:

- Week view
- Month view
- 9.5-Cycle view
- Dashboard cycle rail
- Session Detail cycle context
- Analysis cycle summary

Required display behavior:

- show source-backed planned/completed state
- show uncertainty for missing anchor/timezone/source
- show Safety Gate block/review state when present
- preserve `CYCLE_DAY` namespace in data layer
- avoid bare `D-*` identifiers in API and audit records

Forbidden behavior:

- create plan sessions from Calendar drag/drop without Plan Generator/App Bridge workflow
- hide Safety Gate blocks because a Calendar cell looks normal
- display `D-5` as if it were a `RULE_SPEC_D1_D9` rule
- use design-only references as athlete data

---

## 12. Plan Generator Binding

Plan Generator owns:

- `plannedDate`
- `sessionSlot`
- `PlanGenerationRunRecord`
- `PlanOptionRecord`
- `PlannedSessionDraftRecord`

This spec may project those values into Calendar views after Safety Gate and Plan Generator boundaries are satisfied.

This spec does not close `OI-PG-MICROCYCLE-CALENDAR-MAPPING-001`. Closure requires Plan Generator target patch, target issue recount, App Bridge/UI binding, and runtime or implementation evidence where applicable.

---

## 13. Safety Boundary

Calendar and microcycle mapping are display/projection layers.

They may display:

- Safety Gate block/review/allow state
- RVE/D9 status refs
- source-backed reason codes
- uncertainty and review-required states

They must not:

- clear `D9_ACTIVE`
- clear `D9_UNKNOWN`
- treat `D9_CLEARED` as medical clearance
- create a workaround calendar plan after Safety Gate block
- allow good cycle alignment to clear D9 risk
- allow coach drag/drop to override safety hard stop

---

## 14. Privacy Boundary

Microcycle and Calendar records may store:

- dates
- timezone
- cycle labels under `CYCLE_DAY`
- source refs
- plan/session ids
- projection state
- uncertainty state
- non-sensitive reason codes

They must not store:

- raw athlete free text
- raw memo text
- raw symptom clauses
- injury narratives
- medical notes
- rehab notes
- guardian private notes
- private external LLM prompts or responses

---

## 15. TypeScript Shape Draft

```ts
export type CycleDayNamespace = "CYCLE_DAY";
export type CalendarSessionSlot = "AM" | "PM" | "FULL_DAY" | "UNSPECIFIED";

export type CalendarProjectionState =
  | "PLANNED"
  | "COMPLETED"
  | "MISSED"
  | "CHANGED"
  | "BLOCKED_BY_SAFETY_GATE"
  | "REVIEW_REQUIRED"
  | "SOURCE_INSUFFICIENT";

export interface CycleDayAssignment {
  cycleDayAssignmentId: string;
  date: string;
  timezone: string;
  namespace: CycleDayNamespace;
  cycleDayLabel: string;
  displayLabel: string;
  cycleSlotIndex: number;
  cycleSlotCount: 10;
  halfDayPhase: "AM" | "PM" | "FULL_DAY" | "UNKNOWN";
  sourceRefs: readonly CalendarMappingSourceRef[];
  uncertaintyState: MappingUncertaintyState;
  isRuleId: false;
}

export interface CalendarSessionProjection {
  projectionId: string;
  plannedSessionDraftId: string | null;
  classifiedSessionId: string | null;
  planOptionId: string | null;
  date: string;
  timezone: string;
  sessionSlot: CalendarSessionSlot;
  cycleDayAssignmentId: string | null;
  planGenerationRunId: string | null;
  safetyDisplayStateRef: string | null;
  rationaleBundleId: string | null;
  sourceRefs: readonly CalendarMappingSourceRef[];
  projectionState: CalendarProjectionState;
  uncertaintyState: MappingUncertaintyState;
  mayCreatePlanOption: false;
  mayClearD9Risk: false;
  mayClearSafetyGateBlock: false;
}

export interface MicrocycleCalendarContext {
  contextId: string;
  tenantId: string;
  groupId: string | null;
  athleteId: string;
  timezone: string;
  dateRange: { startDate: string; endDate: string };
  generatedAt: string;
  generatedBy: "SYSTEM_RULE_ENGINE";
  sourceRefs: readonly CalendarMappingSourceRef[];
  anchors: readonly MicrocycleAnchor[];
  cycleDays: readonly CycleDayAssignment[];
  sessionProjections: readonly CalendarSessionProjection[];
  uncertaintyState: MappingUncertaintyState;
  namespaceBoundary: {
    cycleDayNamespace: "CYCLE_DAY";
    ruleNamespaceAllowed: false;
    bareDReferenceAllowed: false;
  };
  safetyBoundary: {
    mayCreatePlanOption: false;
    maySelectPlanOption: false;
    mayClearD9Risk: false;
    mayClearSafetyGateBlock: false;
  };
}
```

---

## 16. API Draft

This draft proposes read-only mapping endpoints for future App Bridge work. The endpoints are not implementation evidence.

```yaml
read_only_api_draft:
  GET /bridge/athletes/{athleteId}/microcycle-calendar-context:
    returns: MicrocycleCalendarContext
    purpose: retrieve namespace-safe cycle and calendar projections for a date range
    writes_plan_state: false
    writes_safety_state: false
    may_create_plan_option: false
    may_clear_D9: false
    may_clear_safety_gate: false

  GET /bridge/plan-generation-runs/{runId}/calendar-projections:
    returns: CalendarSessionProjection[]
    purpose: retrieve calendar projections for accepted generated plan context
    writes_plan_state: false
    writes_safety_state: false
    may_select_plan_option: false
```

Write endpoints for calendar edits, coach drag/drop, race date changes, or plan re-generation require separate App Bridge and Plan Generator workflow acceptance.

---

## 17. Downstream Binding Rules

### 17.1 Plan Generator

Plan Generator remains the owner of plan option and planned session creation.

Calendar mapping can only project accepted plan/session records. It cannot create plan options, select options, or alter progression logic.

### 17.2 App Bridge

App Bridge must define storage, audit, permission, tenant isolation, and endpoint boundaries before implementation.

### 17.3 Analysis And Visualization

Analysis and visualization may consume `MicrocycleCalendarContext` only as source-backed display data.

They cannot use cycle alignment to clear safety state or invent training load data.

### 17.4 Daily Brief, AI Inbox, And Rationale

Daily Brief, AI Inbox, and Plan Rationale may cite cycle context only when source refs, namespace, uncertainty, and privacy boundaries are preserved.

They cannot turn a cycle label into a safety clearance or plan recommendation.

---

## 18. Audit And Storage Notes

Calendar mapping audit may store:

- context id
- tenant, group, athlete ids
- date range
- timezone
- cycle labels with `namespace: CYCLE_DAY`
- plan/session/source ids
- projection state
- uncertainty state
- non-sensitive reason codes

Calendar mapping audit must not store:

- raw athlete text
- raw symptom phrases
- injury narratives
- medical notes
- guardian private notes
- private external LLM prompts or responses
- bare D labels without namespace

---

## 19. Issue Closure Boundary

Creating this file does not close:

- `OI-PG-MICROCYCLE-CALENDAR-MAPPING-001`
- any Plan Generator issue
- any App Bridge issue
- any Analysis, Daily Brief, AI Inbox, Plan Rationale, UI, or implementation issue

Issue closure requires accepted source spec, target patch, target open-issue recount, and implementation/runtime evidence where applicable.

---

## 20. Open Issues

| Issue ID | Priority | Canonical blocking | Status | Problem | Required next evidence |
|---|---|---|---|---|---|
| `OI-MCM-PLAN-GENERATOR-BINDING-001` | P1 | YES | OPEN | `PLAN_GENERATOR_SPEC.md` still owns `OI-PG-MICROCYCLE-CALENDAR-MAPPING-001`; this draft has not been patched into the target issue table. | Patch Plan Generator after review, then recount target issues. |
| `OI-MCM-APP-BRIDGE-BINDING-001` | P1 | YES | OPEN | App Bridge does not yet define microcycle/calendar storage, audit, endpoint, permission, or tenant-isolation enforcement. | Patch App Bridge and run implementation/privacy review before production. |
| `OI-MCM-NAMESPACE-ENFORCEMENT-001` | P1 | YES | OPEN | No implementation evidence proves `CYCLE_DAY.*`, `RULE_SPEC_D1_D9.*`, and `LEGACY_PHASE_D.*` cannot be confused. | Add parser/type/API checks after implementation exists. |
| `OI-MCM-RUNTIME-EVIDENCE-001` | P1 | YES | OPEN | No runtime or CI evidence proves date mapping, timezone handling, source refs, or namespace guards. | Add actual terminal or CI logs after implementation exists. |
| `OI-MCM-UI-SURFACE-BINDING-001` | P2 | NO | OPEN | Calendar, Dashboard, Session Detail, and Analysis surfaces are design references only. | Patch UI/screen contracts after this mapping contract is reviewed. |
| `OI-MCM-RACE-ANCHOR-POLICY-001` | P2 | NO | OPEN | Race anchor selection, updates, conflicts, and timezone correction need product review. | Define accepted anchor workflow and human review behavior. |
| `OI-MCM-EDIT-WORKFLOW-001` | P2 | NO | OPEN | Calendar drag/drop or manual edits are not accepted plan modification workflows. | Define App Bridge/Plan Generator write workflow before any edit UI implementation. |

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
| Keeps `CYCLE_DAY` separate from rule namespaces | PASS |
| Forbids bare D references in contract fields | PASS |
| Cannot create/select plan options | PASS |
| Cannot clear D9 or Safety Gate blocks | PASS |
| Requires source refs and uncertainty states | PASS |
| Forbids raw text/private note storage | PASS |

[DRAFT_COMPLETE]
