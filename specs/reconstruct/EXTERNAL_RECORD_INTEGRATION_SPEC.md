# EXTERNAL_RECORD_INTEGRATION_SPEC.md

```yaml
document_metadata:
  doc_id: trainoracle-external-record-integration-spec
  spec_id: EXTERNAL_RECORD_INTEGRATION_SPEC
  title: External Record Integration Contract
  version: 0.1
  round: RT1_RECONSTRUCTED
  status: DRAFT_FOR_REVIEW
  owner: COACH_HOJUNE
  created_from:
    - CODEX_WORK_ORDER_005.md Task A
    - SPEC_SOURCE_ACCEPTANCE_DECISION_ROUND5.md T5-3
  open_issues_total: 5
  canonical_blocking_count: 3
  executed_tests_total: 0
  runtime_evidence: none
```

---

## 1. Purpose

This document defines the draft contract for receiving external athlete record
data, starting with AthleteTime PB/SB values. It is a product and data-boundary
contract only. It does not authorize implementation, API calls, account linking,
canonical promotion, or issue closure.

The integration is limited to event-specific personal and season records used
for display, trend context, and coach review. It must not become a channel for
training logs, pain data, free-form athlete notes, symptoms, or safety decisions.

---

## 2. Data Scope

### 2.1 Allowed Inbound Record Fields

```yaml
external_record_payload:
  source: athletetime
  sourceRecordId: optional_string
  athleteExternalId: optional_string
  eventCode: required_string
  recordKind: PB_OR_SB
  recordValue: required_structured_value
  recordUnit: required_string
  recordDate: required_date
  competitionName: optional_string
  placeName: optional_string
  lookupTimestamp: required_timestamp
  freshnessState: FRESH_OR_STALE_OR_UNKNOWN
```

Allowed record scope is limited to event-specific PB/SB values:

| Field | Required | Notes |
|---|---:|---|
| `eventCode` | YES | Event identifier such as a race distance or athletics event code. |
| `recordKind` | YES | `PB` or `SB` only. |
| `recordValue` | YES | Structured record value, not raw text. |
| `recordDate` | YES | Date attached to the external record. |
| `competitionName` | NO | Display context only. |
| `placeName` | NO | Display context only. |
| `source: athletetime` | YES | Must be visible in display and audit references. |
| `lookupTimestamp` | YES | Timestamp when TrainOracle last looked up or imported the value. |
| `freshnessState` | YES | `FRESH`, `STALE`, or `UNKNOWN`. |

### 2.2 Explicit Exclusions

The external record integration must not exchange or persist these data classes:

| Excluded Data | Direction | Rule |
|---|---|---|
| Training session details | Any | Not requested, not sent, not imported. |
| Pain, injury, symptom, or health data | Any | Forbidden. Safety data stays inside TrainOracle contracts. |
| Daily memo or athlete free text | Any | Forbidden as persisted raw text. |
| Coach notes or AI chat text | Any | Forbidden. |
| D9 evaluator inputs or outputs | Any | Not exported to external record services. |

This integration is one-way inbound only:

```yaml
record_exchange_direction:
  trainoracle_to_external_service: forbidden
  external_service_to_trainoracle: allowed_for_structured_pb_sb_only
  bidirectional_sync: forbidden
```

---

## 3. Consent Model

External record linking requires explicit consent before any lookup or import.

```yaml
external_record_consent:
  consentSubject: ATHLETE
  guardianConsentRequired: OPEN_ISSUE_FOR_MINOR_ATHLETES
  coachCanConnect: true
  coachCanDisconnect: true
  athleteCanDisconnect: true
  consentAuditRequired: true
```

Required consent audit fields:

| Field | Required | Notes |
|---|---:|---|
| `consentId` | YES | Internal consent record identifier. |
| `athleteId` | YES | TrainOracle athlete identifier. |
| `source` | YES | Must be `athletetime` for this draft scope. |
| `grantedByRole` | YES | `ATHLETE`, `GUARDIAN`, or authorized admin role. |
| `grantedAt` | YES | Timestamp. |
| `revokedAt` | NO | Timestamp when disconnected. |
| `revokedByRole` | NO | Role that disconnected the link. |
| `scope` | YES | `PB_SB_RECORD_LOOKUP_ONLY`. |
| `policyVersion` | YES | Version of this contract or successor contract. |

Minor-athlete guardian consent remains an open issue. Until resolved, the
implementation must either block minor account linking or route it to human
review under the product owner's decision.

---

## 4. Fetch And Display Options

### 4.1 Candidate Fetch Modes

| Mode | Description | Benefits | Risks |
|---|---|---|---|
| Manual import | Coach or athlete triggers a lookup/import action. | Clear intent, lower privacy risk, simple audit trail. | Requires user action; can go stale. |
| Periodic sync | TrainOracle refreshes linked records on a schedule. | Fresher record badges. | Requires stronger consent, API reliability, retry policy. |
| Deeplink lookup | TrainOracle links out or opens an external lookup context. | Avoids storing more than needed. | Depends on external UX; weaker automation. |

Recommended draft default:

```yaml
recommended_fetch_mode:
  mode: manual_import
  reason: lowest_contract_surface_before_public_api_reality_is_verified
  final_decision_owner: TOTAL_RESPONSIBILITY_HOLDER
```

### 4.2 Display Contract

Any displayed external value must show its source and freshness:

```yaml
external_record_display_badge:
  sourceLabel: "source: athletetime"
  lookupTimestamp: required
  freshnessState: required
  staleBehavior: show_stale_badge_and_keep_local_value
```

Display text may summarize structured record values, but raw external free text
must not be retained as server or audit state.

---

## 5. Alignment With Existing Privacy And AI Policy

This contract is not an external LLM policy exception. It defines structured
record inbound from an external record service. It must not be used to send
private athlete data to an external LLM or any unrelated processor.

If an external response includes free text, notes, comments, or unstructured
clauses, TrainOracle must apply the memo policy boundary:

```yaml
free_text_response_policy:
  raw_free_text_server_persistence: forbidden
  raw_free_text_audit_persistence: forbidden
  allowed_persistence: structured_fields_and_reason_codes_only
  unparseable_text_behavior: discard_or_route_to_human_review_without_raw_storage
```

This preserves the existing invariant that raw athlete free text and symptom
clauses are not stored in server or audit contracts.

---

## 6. Failure And Conflict Handling

### 6.1 Lookup Failure

```yaml
lookup_failure_behavior:
  keep_existing_local_values: true
  show_stale_or_unknown_badge: true
  automatic_value_clear: false
  automatic_safety_change: false
```

External lookup failure must not delete local PB/SB values. It only changes the
freshness signal.

### 6.2 Local Versus External Conflict

When local manually entered record values conflict with external values:

```yaml
conflict_resolution:
  automatic_overwrite_allowed: false
  required_resolution: human_confirmation
  allowed_confirmers:
    - COACH
    - ATHLETE
  audit_resolution_without_raw_text: true
```

Neither side wins automatically. The UI may display both values with source and
freshness badges until a human confirms the chosen structured value.

---

## 7. Safety Boundary

External record data is not safety authority.

```yaml
safety_boundary:
  is_safety_authority: false
  can_affect_safety_disposition: false
  can_clear_D9_or_Safety_Gate: false
  can_block_plan_generation: false
  can_override_RVE: false
```

Good, recent, or official-looking PB/SB data must not clear `D9_ACTIVE`,
`D9_UNKNOWN`, Safety Gate blocks, or any human-review requirement. Poor or stale
external record data must not create a D9 disposition. Safety routing remains
owned by the accepted D9/RVE/Safety Gate contracts.

---

## 8. Open Issues

| issue_id | title | status | canonical_blocking | notes |
|---|---|---|---:|---|
| OI-ERI-ATHLETETIME-API-REALITY-001 | AthleteTime public API reality and terms unknown | OPEN | YES | No implementation, credential handling, scraping, or periodic sync may start until the available integration surface and terms are verified. |
| OI-ERI-GUARDIAN-CONSENT-001 | Minor-athlete guardian consent model unresolved | OPEN | YES | Minor athlete linking must be blocked or routed to human review until the guardian-consent path is accepted. |
| OI-ERI-SYNC-CADENCE-001 | Sync cadence not decided | OPEN | NO | Manual import is the recommended draft default, but final cadence is owner decision. |
| OI-ERI-CONFLICT-RESOLUTION-001 | Human confirmation UX not specified | OPEN | YES | The contract forbids automatic overwrite, but the exact confirmation screen and audit event names remain pending. |
| OI-ERI-FRESHNESS-DISPLAY-001 | Freshness badge thresholds not finalized | OPEN | NO | `FRESH`, `STALE`, and `UNKNOWN` are required states; threshold durations remain pending. |

---

## 9. Non-Claims

This draft does not claim:

- AthleteTime provides a public API.
- Any external integration has been implemented.
- Any runtime test has passed.
- Any open issue is closed.
- Any canonical promotion is granted.
- External record data can affect D9, RVE, Safety Gate, or Plan Generator safety disposition.

[DRAFT_COMPLETE]
