# EXTERNAL_RECORD_INTEGRATION_SPEC.md

```yaml
document_metadata:
  doc_id: trainoracle-external-record-integration-spec
  spec_id: EXTERNAL_RECORD_INTEGRATION_SPEC
  title: External Record And Device Integration Contract
  version: 0.2
  round: RT2_PROVIDER_APPLICATION_READINESS
  status: DRAFT_FOR_REVIEW
  owner: COACH_HOJUNE
  created_from:
    - CODEX_WORK_ORDER_005.md Task A
    - SPEC_SOURCE_ACCEPTANCE_DECISION_ROUND5.md T5-3
    - OWNER_DECISION_DEVICE_INTEGRATION_APPLICATION_2026_08_29.md
    - Garmin Connect Developer Program public documentation
    - COROS API Reference V2.0.6 and public application guidance
  open_issues_total: 12
  canonical_blocking_count: 10
  executed_tests_total: 0
  runtime_evidence: none
```

---

## 1. Purpose And Authority

This draft defines the data and safety boundary for official external-record and device
integrations. Candidate sources are AthleteTime PB/SB records, Garmin activity data, and
COROS activity data. Candidate outbound destinations are Garmin and COROS structured
workouts selected by the user.

The owner decision dated 2026-08-29 authorizes application-readiness work only. It does
not authorize public account linking, provider token storage, live activity ingestion,
outbound workout publication, canonical promotion, or issue closure.

```yaml
runtime_stage:
  provider_application: allowed
  public_support_and_notice_pages: allowed
  fail_closed_endpoint_readiness: allowed
  schema_readiness_with_feature_off: allowed
  public_user_linking: forbidden_until_gates_pass
  production_ingestion: forbidden_until_gates_pass
  outbound_workout_sync: forbidden_until_gates_pass
```

---

## 2. Provider And Direction Model

| Provider | Candidate inbound scope | Candidate outbound scope | Current state |
|---|---|---|---|
| AthleteTime | Structured event PB/SB | None | API reality unresolved |
| Garmin | User-authorized activity summary and official activity file | User-selected structured workout or training plan | Application pending |
| COROS | User-authorized activity summary and official activity file | User-selected structured workout or training plan | Application pending |

The v0.1 AthleteTime rule remains one-way PB/SB only. Garmin and COROS are separate
provider namespaces and do not inherit AthleteTime's field or direction contract.

```yaml
provider_namespaces:
  ATHLETETIME_PB_SB: record_only
  GARMIN_ACTIVITY_API: device_activity
  COROS_ACTIVITY_API: device_activity
  GARMIN_TRAINING_API: outbound_workout
  COROS_TRAINING_PLAN_API: outbound_workout
```

No unofficial login, browser-cookie extraction, scraping, credential forwarding, or
consumer-session impersonation is allowed. Only official provider APIs and OAuth flows
may be used.

---

## 3. Allowed Inbound Data

### 3.1 AthleteTime PB/SB

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

### 3.2 Garmin And COROS Activity Staging

Provider activities must first enter an inbox state. Only bounded structured facts may be
stored before user confirmation.

```yaml
device_activity_inbox:
  provider: GARMIN_OR_COROS
  providerUserId: required_provider_identifier
  providerRecordId: required_provider_identifier
  userId: required_trainoracle_account_identifier
  activityStart: required_timestamp
  sportCode: required_string
  distanceMeters: optional_non_negative_number
  durationSeconds: optional_non_negative_number
  deviceName: optional_short_string
  payloadDigest: required_digest
  reviewState: PENDING_USER_CONFIRMATION
```

The system must not persist the complete provider payload, complete GPS track, provider
download URL, access token, refresh token, free-form activity note, symptom text, or coach
comment in the activity inbox.

### 3.3 Confirmation Boundary

```yaml
activity_confirmation:
  automatic_journal_save: forbidden
  automatic_analysis_adoption: forbidden
  automatic_plan_input: forbidden
  user_confirmation_required: true
  duplicate_detection_required: true
  automatic_merge: forbidden
  automatic_overwrite: forbidden
  confirmed_provenance: DERIVED_EXTERNAL_PROVIDER
  explicit_existing_journal_reconciliation:
    allowed_only_after_user_selects_candidate: true
    candidate_rule: exact_same_date_and_single_WAITING_quick_entry_or_existing_similarity_match
    multiple_same_date_waiting_entries: no_automatic_candidate
    preserve_entry_id: true
    existing_objective_value_overwrite: forbidden
    subjective_value_inference: forbidden
```

Until a provider-specific confirmation UI and provenance rule are accepted, imported
activity remains excluded from statistics, trend analysis, Oracle content, safety logic,
and training-plan generation.

---

## 4. Explicit Exclusions

| Excluded data or behavior | Rule |
|---|---|
| Raw athlete free text, symptoms, pain notes, or evidence clauses | Never stored in server or audit payloads |
| Provider tokens in source control, browser storage, ordinary database columns, or logs | Forbidden |
| Complete provider webhook body in logs or audit tables | Forbidden |
| Automatic adoption into analysis or training plans | Forbidden |
| Automatic replacement of a local journal or race record | Forbidden |
| External data clearing D9/RVE/Safety Gate | Forbidden |
| External provider becoming global coach authority | Forbidden |
| Selling provider data, advertising profiles, or unrelated model training | Forbidden |
| Workout upload without an explicit user action | Forbidden |

---

## 5. Consent, Account, And Minor Boundary

Device linking requires an authenticated TrainOracle account, official provider OAuth,
provider-specific scopes, and a separate TrainOracle consent event before lookup or sync.

```yaml
device_link_consent:
  athlete_action_required: true
  consent_audit_required: true
  scopes_visible_before_authorization: true
  disconnect_available: true
  provider_revocation_supported: true
  consent_withdrawal_is_fail_closed: true
  under_14_online_linking: blocked_by_current_account_policy
```

Required audit facts are identifiers, roles, provider, scopes, policy version, timestamps,
and structured reason codes. Tokens, raw activity, free text, and symptom clauses are not
audit fields.

Coach-initiated linking cannot substitute for the athlete's provider authorization. A
coach may assist the flow only after a separate role and consent contract is accepted.

---

## 6. Credential And Endpoint Security

```yaml
credential_boundary:
  oauth_authorization_code_flow: required
  provider_client_secret_in_browser: forbidden
  token_exchange_server_side_only: true
  token_at_rest_encryption: required_before_storage
  least_privilege_scopes: required
  webhook_authentication: required
  replay_and_duplicate_protection: required
  request_body_and_token_logging: forbidden
```

Application-readiness endpoints must fail closed when credentials, shared webhook
secrets, provider approval, a linked user, or the server feature switch is absent.
A public HTTP 200 status endpoint may expose only operational readiness and provider
application state. It must expose no user identifiers, tokens, secrets, or activity data.

COROS activity push handling must be idempotent by provider and provider record ID. The
success response may be returned only after a linked user was resolved and the bounded
summary was persisted or recognized as an existing duplicate.

---

## 7. Outbound Workout Boundary

Garmin Training API and COROS training-plan synchronization are candidate capabilities,
not current runtime features.

```yaml
outbound_workout:
  user_selected_session_only: true
  automatic_background_publication: forbidden
  safety_gate_bypass: forbidden
  provider_success_is_medical_clearance: false
  provider_delivery_receipt_required: true
  edit_and_delete_semantics: OPEN_ISSUE
  eligible_plan_contract: OPEN_ISSUE
```

An outbound workout may not be created directly from raw journal text or an unreviewed
template. The exact eligible plan state, retry behavior, replacement rules, and provider
display wording require a later accepted contract and runtime evidence.

---

## 8. Failure, Conflict, And Revocation

```yaml
failure_behavior:
  keep_confirmed_local_values: true
  automatic_value_clear: false
  automatic_safety_change: false
  silent_drop: forbidden
  show_provider_and_freshness: true
```

When local and provider values conflict, both structured values may be shown with source
and freshness. Neither side wins automatically. User confirmation is required.

Disconnect must stop future processing immediately. Provider tokens and pending imported
data must be deleted or irreversibly deidentified within the accepted provider and privacy
deadline. A deletion failure must remain visible to an operator and must not be reported
to the user as complete.

---

## 9. Safety Boundary

```yaml
safety_boundary:
  is_safety_authority: false
  can_affect_safety_disposition: false
  can_clear_D9_or_Safety_Gate: false
  can_override_RVE: false
  can_unblock_plan_generation: false
```

Good, recent, or official-looking device data cannot clear `D9_ACTIVE`, `D9_UNKNOWN`, a
Safety Gate block, or a human-review requirement. Missing or stale device data cannot be
silently treated as zero. External activity may raise a user-facing discrepancy for
review only after a separate accepted rule defines that behavior.

---

## 10. Application-Readiness Acceptance Checks

Application readiness requires all of the following without claiming live integration:

1. Public support and device-integration notice pages are reachable.
2. The public status endpoint returns HTTP 200 without exposing secrets.
3. Callback and push endpoints fail closed while credentials or feature gates are absent.
4. Webhook authentication, body limits, schema validation, idempotency, and unlinked-user
   rejection are covered by executable contract tests.
5. Database tables are RLS-enabled, do not grant ordinary clients direct write access,
   and store no raw provider payload or token.
6. Provider application text accurately says the feature is in application/onboarding.
7. No provider is shown as connected in the public app before provider approval and a
   successful end-to-end test.

Self-check text, a reachable endpoint, or a provider application receipt is not runtime
evidence of account linking or activity synchronization.

---

## 11. Open Issues

| issue_id | title | status | canonical_blocking | notes |
|---|---|---|---:|---|
| OI-ERI-ATHLETETIME-API-REALITY-001 | AthleteTime public API reality and terms unknown | OPEN | YES | No AthleteTime credential handling or scraping may begin until the official surface and terms are verified. |
| OI-ERI-GUARDIAN-CONSENT-001 | Future minor account-linking model unresolved | OPEN | YES | Current online account policy blocks under-14 device linking. |
| OI-ERI-SYNC-CADENCE-001 | Provider sync cadence not accepted | OPEN | NO | Application readiness does not choose a production cadence. |
| OI-ERI-CONFLICT-RESOLUTION-001 | Human confirmation UX not accepted | OPEN | YES | Automatic overwrite remains forbidden. |
| OI-ERI-FRESHNESS-DISPLAY-001 | Freshness thresholds not finalized | OPEN | NO | Source and freshness remain required display facts. |
| OI-ERI-GARMIN-APPROVAL-001 | Garmin business application and scopes pending | OPEN | YES | No Garmin runtime activation before written provider approval. |
| OI-ERI-COROS-APPROVAL-001 | COROS application and scopes pending | OPEN | YES | No COROS runtime activation before written provider approval. |
| OI-ERI-TOKEN-PROTECTION-001 | Token encryption and rotation design not accepted | OPEN | YES | Application-readiness schema intentionally stores no tokens. |
| OI-ERI-REVOCATION-DELETION-001 | Provider revocation and deletion runbook not accepted | OPEN | YES | Disconnect must fail closed and meet the accepted deadline. |
| OI-ERI-ACTIVITY-CONFIRMATION-001 | Activity review and adoption UI not accepted | OPEN | YES | Inbox data remains excluded from analysis and plans. |
| OI-ERI-OUTBOUND-WORKOUT-001 | Outbound workout eligibility and lifecycle not accepted | OPEN | YES | No automatic or user-visible workout publication yet. |
| OI-ERI-PRIVACY-OPERATIONS-001 | Retention, incident response, and named privacy review pending | OPEN | YES | Provider onboarding does not replace qualified review. |

---

## 12. Non-Claims

This draft does not claim that any provider has approved TrainOracle, any credential has
been issued, any account has been linked, any activity has been received, any workout has
been sent, any runtime test has passed, any open issue is closed, or canonical promotion
has been granted.

[DRAFT_COMPLETE]
