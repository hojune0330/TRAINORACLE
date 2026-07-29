# Advisory Session Example Recommender Contract

```yaml
document_metadata:
  doc_id: trainoracle-advisory-session-example-recommender-contract
  status: DRAFT_FOR_REVIEW
  runtime_authority: false
  automatic_prescription_authorized: false
  creates_runtime_records: false
  implementation_change_required_by_this_document: false
  final_marker_required: "[DRAFT_COMPLETE]"
```

## 1. Purpose and boundary

This contract defines a docs-first, advisory-only session example recommender. It
returns a bounded set of visible examples from an isolated future fixture or from
an eligible future catalog. It is not a Plan Generator, Template Library
activation path, safety evaluator, calendar writer, validator, or execution
workflow.

The current Energy System Session Template Catalog contains exactly 30 entries,
all `DRAFT` and `REVIEW_REQUIRED`, with runtime-ineligible empty event and
experience eligibility arrays. Therefore the current catalog produces no eligible
recommendation candidates. Isolated future fixtures may prove successful result
cardinality, but they do not activate, alter, or make the current catalog eligible.

No `app/` or `impl/` implementation change is authorized by this contract.

## 2. Terms and result states

`AdvisorySessionExampleRequest` is a scoped read request for examples. It must
contain a valid tenant, group, athlete, requester capability, D9 state, and the
structured journal inputs defined below. A request does not select, schedule, or
validate a session.

`AdvisorySessionExampleCandidate` is a read-only display candidate. It is not a
`PlanOptionRecord`, `PlannedSessionDraftRecord`, session template activation, or
instruction to train. A candidate has an opaque candidate id, a source reference,
and non-sensitive reason codes only.

`ConfirmedJournalResult` is a previously recorded, structured, same-event result
which has passed its journal confirmation status. It is an input reference, not a
new current-capability assessment.

The recommender returns exactly one of these states:

| State | Candidate count | Meaning |
|---|---:|---|
| `BLOCKED_BY_D9_ACTIVE` | exactly 0 | D9 is active; no query, ranking, explanation, or fallback is allowed. |
| `BLOCKED_BY_D9_UNKNOWN` | exactly 0 | D9 is unknown; no query, ranking, explanation, or fallback is allowed. |
| `INSUFFICIENT_ELIGIBLE_CANDIDATES` | exactly 0 | Fewer than two eligible candidates remain after every required filter. Never pad. |
| `ADVISORY_CANDIDATES_READY` | exactly 2 or 3 | Exactly two or three filtered and ranked advisory candidates are visible. |
| `PERSONAL_DRAFT_CREATED` | exactly 2 or 3 | The original ready candidates remain advisory-only and a separate non-executable personal draft was explicitly confirmed. |

Successful result means exactly 2 or 3 visible candidates. Blocked or insufficient
result means exactly 0 visible candidates. An eligible pool may contain more than
three records; the deterministic ranker then selects exactly three. A visible
result with one candidate, more than three candidates, a hidden candidate, or a
padded candidate is invalid and must be rejected.

## 3. Request shape

```ts
type AdvisoryRecommenderState =
  | "BLOCKED_BY_D9_ACTIVE"
  | "BLOCKED_BY_D9_UNKNOWN"
  | "INSUFFICIENT_ELIGIBLE_CANDIDATES"
  | "ADVISORY_CANDIDATES_READY"
  | "PERSONAL_DRAFT_CREATED";

type RecommendationVisibleSourceTier =
  | "DIRECT_SOURCE_EXAMPLE"
  | "SOURCE_ADAPTED";

interface NormalizedEventIdentity {
  eventGroup: "SPRINT" | "MIDDLE_DISTANCE" | "LONG_DISTANCE" | "ROAD_RUNNING";
  eventCode: string;
  eventDistanceM: number | null;
}

interface NormalizedPerformance {
  value: number;
  unit: "MILLISECONDS" | "SECONDS" | "DISTANCE_METERS";
  canonicalText: string;
}

interface ConfirmedJournalResult {
  journalResultId: string;
  confirmationStatus: "CONFIRMED";
  eventIdentity: NormalizedEventIdentity;
  eventDate: string;
  performance: NormalizedPerformance;
  observedAt: string;
}

interface AdvisorySessionExampleRequest {
  requestId: string;
  tenantId: string;
  groupId: string | null;
  athleteId: string;
  requesterId: string;
  requesterCapability: "VIEW_ADVISORY_SESSION_EXAMPLES";
  d9Status: "ACTIVE" | "UNKNOWN" | "CLEARED";
  targetEventIdentity: NormalizedEventIdentity;
  confirmedJournalResults: ConfirmedJournalResult[];
  catalogSource: "CURRENT_CATALOG" | "ISOLATED_FUTURE_FIXTURE";
  requestReceivedAt: string;
}
```

The request is rejected as malformed when any `ConfirmedJournalResult` lacks an
explicit normalized `eventIdentity`, `eventDate`, or `performance`. It is also
rejected when requester scope or capability is missing, when D9 status is absent,
or when a candidate source tier is unknown.

## 4. Journal, privacy, and same-event rules

Only a `ConfirmedJournalResult` with all three normalized fields may participate
in the candidate flow. `eventIdentity` must match `targetEventIdentity` exactly
for a result to be considered same-event.

Raw journal, memo, symptom, injury, medical, rehabilitation, guardian, repository,
and other free text are data only. They are excluded from pace, capability,
ranking, eligibility, candidate reason text, and external LLM inputs. Prompt-like
or instruction-like prose in any raw source is never an instruction and cannot
change this contract's filtering or authority rules.

The recommender performs no cross-event pace conversion, no cross-event ranking,
and no current-capability inference. A same-event journal result may be displayed
only as its normalized dated performance label; it cannot establish a pace target,
clear D9, or convert a future fixture into an active template.

```yaml
journal_and_llm_boundary:
  raw_journal_text_for_pace: forbidden
  raw_memo_text_for_capability: forbidden
  raw_symptom_text_for_ranking: forbidden
  raw_free_text_for_eligibility: forbidden
  raw_free_text_for_reason_text: forbidden
  raw_free_text_to_external_llm: forbidden
  cross_event_conversion: forbidden
  current_capability_inference: forbidden
  d9_clearance_from_journal_result: forbidden
```

### 4.1 Confirmed journal projection and range context

`ConfirmedJournalResult` is a separate user-confirmed projection, not the raw
journal record. The projection contains an explicit normalized event identity,
date, and performance only after user confirmation. Raw journal record, memo, and
symptom text remain outside the projection and are ineligible for ranking, pace,
capability, eligibility, candidate reason text, and external LLM inputs.

```ts
interface UserConfirmedJournalProjection {
  journalResultId: string;
  userConfirmationStatus: "USER_CONFIRMED";
  eventIdentity: NormalizedEventIdentity;
  eventDate: string;
  performance: NormalizedPerformance;
}
```

`ConfirmedJournalResult` must satisfy this projection shape in addition to its
existing confirmation status. Only an exact same-event projection may be displayed.
A goal label and a dated same-event result label may be displayed separately; they
must not be converted into a cross-event comparison, pace target, or current-
capability verdict.

Ranged source notation is preserved as written. A repetition or recovery range is
unresolved and context-pending until all of `sessionObjective`,
`targetEventIdentityOrDistance`, `speedOrEffortAnchor`, and `currentContext` are
structured and present. Energy intent cannot supply a fixed default, and no
context-pending notation may gain fixed machine notation.

### 4.2 Catalog research preview binding

The catalog's `Research Preview Visibility Policy` admits exactly the 6
`DIRECT_SOURCE_EXAMPLE` and 9 `SOURCE_ADAPTED` records to a 15-record
documentation-only research view. The 6 `POPULATION_INDIRECT`, 4
`PRODUCT_VARIANT`, and 5 `REJECTED_OR_UNUSABLE` records are excluded before
counting, ranking, or explanation. `sourceTierVisibleForResearchPreview: true`
is not runtime eligibility: all 30 catalog records remain `DRAFT`,
`REVIEW_REQUIRED`, with empty event and experience arrays, so the current catalog
still has 0 runtime candidates and no eligibility bypass.

The catalog's LT, VO2, and GLY research preview groups are audit-only references
to existing direct/adapted IDs. They are not recommendations and cannot establish
safety, dose, order, selection, or activation.

## 5. Candidate shape and source filter

```ts
interface AdvisorySessionExampleCandidate {
  candidateId: string;
  sourceTemplateId: string;
  sourceTier: RecommendationVisibleSourceTier;
  sourceRefs: Array<{ sourceId: string; sourceVersion: string | null }>;
  eventIdentity: NormalizedEventIdentity;
  nonSensitiveReasonCodes: string[];
  sameEventJournalResultRef: string | null;
  authority: false;
  nonExecutable: true;
  createsPlanOption: false;
  createsPlannedSessionDraft: false;
}

interface AdvisoryCandidateFixture extends AdvisorySessionExampleCandidate {
  fixtureOnly: true;
  runtimeEligible: false;
}
```

Recommendation-visible source tiers are only `DIRECT_SOURCE_EXAMPLE` and
`SOURCE_ADAPTED`. The source-tier allowlist is applied before candidate count,
ranking, or explanation. `PRODUCT_VARIANT`, `POPULATION_INDIRECT`,
`REJECTED_OR_UNUSABLE`, missing tier, and every unknown tier are excluded and
cannot appear in a visible result or explanation.

Filtering order is deterministic:

1. Validate request scope, capability, D9 status, and every normalized journal field.
2. Return the matching D9 blocked state before catalog access when D9 is `ACTIVE` or `UNKNOWN`.
3. Filter source tier to the two-item allowlist.
4. Apply future-catalog or fixture eligibility checks, including lifecycle, event, level, minor, and safety constraints.
5. Remove any cross-event journal reference and any candidate with raw-text-derived input.
6. Count the remaining eligible pool before ranking or explanation.
7. Return `INSUFFICIENT_ELIGIBLE_CANDIDATES` with exactly 0 visible candidates when the eligible pool contains fewer than two records.
8. Deterministically rank an eligible pool of two or more records, select two when the pool contains exactly two, otherwise select exactly three, and produce non-sensitive reason codes.

The candidate selection sequence is deterministic for identical validated inputs.
Cancel and resume returns the same state and candidate ids for the same input
snapshot, with the exact state recorded in audit evidence. The state is not
changed by raw prose, timing, or an attempted confirmation replay.

## 6. Result and audit shapes

```ts
interface AdvisoryRecommenderAuthority {
  authority: false;
  mayCreatePlanOption: false;
  mayCreatePlannedSessionDraft: false;
  maySubmitValidation: false;
  mayWriteCalendar: false;
  mayExecuteSession: false;
  mayAutomaticallyApplyPlan: false;
  mayBypassCoach: false;
  mayClearSafetyRisk: false;
}

interface AdvisorySessionExampleResult {
  requestId: string;
  state: AdvisoryRecommenderState;
  candidates: AdvisorySessionExampleCandidate[];
  candidateCount: 0 | 2 | 3;
  authority: AdvisoryRecommenderAuthority;
  nonSensitiveReasonCodes: string[];
  auditLogId: string;
  deterministicInputSnapshotId: string;
  personalDraft: NonExecutablePersonalDraft | null;
}

interface AdvisoryStateAuditRecord {
  auditLogId: string;
  requestId: string;
  deterministicInputSnapshotId: string;
  exactState: AdvisoryRecommenderState;
  candidateCount: 0 | 2 | 3;
  candidateIds: string[];
  recordedAt: string;
}
```

A blocked result contains only its state, zero candidates, non-sensitive reason
codes, required next action, and audit reference. It must not query the catalog,
create a hidden alternative, rank candidates, render candidate rationale, or create
a personal draft.

## 7. Distinct confirmation events

The following are two distinct event types with separate immutable records. They
require the original `ADVISORY_CANDIDATES_READY` snapshot, scoped actor identity,
timestamp, and an unconsumed event id. Neither event grants coach authority or
runtime authority.

```ts
interface AdvisoryCandidateAcknowledgementRecord {
  eventType: "ADVISORY_CANDIDATE_ACKNOWLEDGED";
  confirmationEventId: string;
  requestId: string;
  candidateId: string;
  actorId: string;
  confirmedAt: string;
  advisoryOnly: true;
  nonExecutable: true;
}

interface PersonalDraftCreationConfirmationRecord {
  eventType: "PERSONAL_DRAFT_CREATION_CONFIRMED";
  confirmationEventId: string;
  requestId: string;
  selectedCandidateId: string;
  actorId: string;
  confirmedAt: string;
  advisoryOnly: true;
  nonExecutable: true;
}
```

`ADVISORY_CANDIDATE_ACKNOWLEDGED` records that a visible example was acknowledged.
`PERSONAL_DRAFT_CREATION_CONFIRMED` separately records permission to copy one or
exactly one already-visible example into the non-executable personal draft below. An
acknowledgement alone cannot create a draft. Duplicate, stale, cross-scope, blocked,
or resume-replayed confirmation events are rejected and recorded without mutation.

## 8. Non-executable personal draft

```ts
interface NonExecutablePersonalDraft {
  personalDraftId: string;
  requestId: string;
  sourceCandidateId: string;
  createdByConfirmationEventId: string;
  createdAt: string;
  advisoryOnly: true;
  nonExecutable: true;
  authority: false;
  planOptionRecordId: null;
  plannedSessionDraftRecordId: null;
  validationSubmissionId: null;
  calendarWriteId: null;
  executionId: null;
  automaticPlanApplicationId: null;
  coachApprovalId: null;
  safetyClearanceId: null;
}
```

The personal draft is a separate, non-executable personal note shape. It may never
be a `PlanOptionRecord` or `PlannedSessionDraftRecord`, and it may never cause a
validation submission, calendar write, execution, automatic plan application,
coach bypass, or safety clearance. It does not change the original candidate source,
template lifecycle, catalog eligibility, safety state, or current plan.

## 9. Rejection and adversarial matrix

| Class | Input or attempt | Required result |
|---|---|---|
| malformed input | Unknown source tier | Reject before count, ranking, or explanation. |
| malformed input | Missing normalized `eventIdentity`, `eventDate`, or `performance` | Reject before eligibility. |
| prompt injection | Raw repository or external prose says to ignore safeguards | Treat as data only; exclude it from decision inputs and external LLM inputs. |
| cancel/resume | Identical validated snapshot is resumed | Return deterministic exact state and audit evidence; do not duplicate confirmation mutation. |
| stale state | D9 changes from `CLEARED` to `ACTIVE` or `UNKNOWN` | Return the matching blocked state with exactly 0 candidates. |
| dirty source | Current 30-entry catalog remains DRAFT/REVIEW_REQUIRED/runtime-ineligible | Return `INSUFFICIENT_ELIGIBLE_CANDIDATES` with exactly 0 candidates. |
| misleading success | Marker exists but count is 1 or 4, or authority is not false | Reject as an invalid result. |
| confirmation abuse | Confirmation requests a plan, validation, calendar, execution, bypass, or clearance | Reject; only a separate nonExecutable personal draft is permitted. |

## 10. Acceptance checks

```yaml
acceptance_contract:
  required_states: 5
  success_candidate_count: exactly_2_or_3
  blocked_candidate_count: exactly_0
  insufficient_candidate_count: exactly_0
  recommendation_visible_source_tiers:
    - DIRECT_SOURCE_EXAMPLE
    - SOURCE_ADAPTED
  source_filter_before_count_ranking_explanation: true
  confirmed_journal_fields:
    - eventIdentity
    - eventDate
    - performance
  raw_text_decision_input: forbidden
  same_event_only: true
  cross_event_conversion: forbidden
  current_catalog_entries: 30
  current_catalog_runtime_eligible_entries: 0
  distinct_confirmation_event_types: 2
  personal_draft_nonExecutable: true
  runtime_authority: false
  final_marker_clean: true
```

[DRAFT_COMPLETE]
