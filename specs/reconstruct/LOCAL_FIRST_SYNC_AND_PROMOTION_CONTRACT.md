# LOCAL_FIRST_SYNC_AND_PROMOTION_CONTRACT.md

```yaml
document_metadata:
  doc_id: trainoracle-local-first-sync-promotion-contract
  spec_id: LOCAL_FIRST_SYNC_AND_PROMOTION_CONTRACT
  title: Local-First Sync And Promotion Contract
  version: 0.2
  round: RT2_STRUCTURED_SYNC_BETA_ALIGNMENT
  status: DRAFT_FOR_REVIEW
  owner: COACH_HOJUNE
  created_from:
    - CODEX_WORK_ORDER_006.md Task B
    - ACCOUNT_FEDERATION_DECISION.md
    - app/src/domain/journal-store.ts syncState model
  open_issues_total: 4
  canonical_blocking_count: 3
  executed_tests_total: 0
  runtime_evidence: none
```

---

## 1. Purpose

This document defines the draft contract for promoting local journal entries
from a device-only store into TrainOracle server storage after account linking.
It is a sync and data-boundary contract. A Supabase-backed implementation now
exists behind a release gate, but this draft does not by itself open that gate,
close any issue, or authorize raw free-text server persistence.

The current app model stores entries locally first with `syncState: local`.
Server sync is a separately enabled, account-linked capability. The local
writing flow must remain usable when sync is disabled or the server is
unavailable.

---

## 2. Authority Boundary

Sync state is not safety authority.

```yaml
sync_authority:
  is_safety_authority: false
  can_clear_D9_or_Safety_Gate: false
  can_override_RVE: false
  can_override_Plan_Safety_Gate: false
  can_create_medical_clearance: false
  can_export_to_athletetime: false
```

A successful upload means only that a structured journal record was promoted
to TrainOracle storage. It must not change D9, RVE, Safety Gate, Plan
Generator, or human-review disposition.

---

## 3. Promotion Flow

Promotion starts only after the user completes account linking or sign-in for
TrainOracle under the accepted account contract.

```yaml
promotion_flow:
  trigger: explicit_sync_consent_then_preview_then_confirmation
  source: device_local_journal_store
  destination: TRAINORACLE_SERVER_ONLY
  batch_policy: merge_account_owned_structured_items
  automatic_upload_after_login: forbidden
  unbound_device_data_auto_claim: forbidden
  local_delete_before_confirmed_upload: forbidden
  syncState_transition:
    first_beta_behavior: keep_local_for_backward_compatible_device_storage
    synced_state_activation: deferred_until_dirty_state_contract_exists
```

Required item-level behavior:

| Step | Rule |
|---|---|
| Read local entries | Include only entries explicitly owned by the current account. |
| Upload | Send a bounded idempotent batch with stable local IDs. |
| Partial success | Keep local entries readable and report the failed server operation visibly. |
| Retry | Re-run the explicit preview and confirmation flow; upsert the same stable IDs. |
| Local retention | Keep the local source until the server confirms durable storage. |

Any UI copy must describe the transition as online backup or multi-device
availability, not as safety validation.

---

## 4. Offline-First Rule

Local writing is the primary path.

```yaml
offline_first_order:
  save_journal_entry:
    - write_local_first
    - wait_for_user_initiated_sync
  server_unavailable_blocks_writing: false
  failed_upload_blocks_local_review: false
  sync_retry_visible: true
```

Server downtime, account errors, token expiry, or network loss must not prevent
the athlete from writing or reading local entries on that device.

---

## 5. Conflict Handling

The first beta uses stable journal IDs rather than `date + kind` as identity.
Two independently created entries for the same date and kind are preserved as
separate entries. Only two versions carrying the same stable ID compete.

```yaml
conflict_key:
  field: journal_id

conflict_resolution:
  different_id_overwrite_allowed: false
  same_id_resolution: latest_savedAt_wins
  different_ids_same_date_kind: preserve_both
  ambiguous_or_invalid_savedAt: fail_visible_without_mutation
  audit_resolution_without_raw_text: true
```

This rule prevents one device from overwriting a separately created session
only because both sessions share a date and kind. A same-ID update may select
the later `savedAt` value, but a schema or persistence failure stops visibly
and keeps the local recovery checkpoint.

---

## 6. Memo Policy Decision Point

`memo` and `note` fields are useful to the athlete, but raw free-text server
persistence conflicts with the existing §8 memo policy unless explicitly
accepted by the owner.

### 6.1 First-Beta Owner Decision

```yaml
owner_decision_2026_08_27:
  first_beta_model: structured_journal_only
  raw_training_memo_upload: forbidden
  encrypted_private_memo_upload: deferred
  memo_purpose_upload: forbidden
  later_encrypted_memo_release_requires_separate_gate: true
```

The first public sync beta adopts option A below. Existing experimental consent
or recovery-code state must not reopen memo transmission at runtime.

### 6.2 Options

| Option | Server behavior | Benefit | Risk |
|---|---|---|---|
| A. Local-only memo | Structured entry syncs, raw memo/note remain on device. | Strongest alignment with current privacy policy. | Multi-device text backup is unavailable. |
| B. End-to-end encrypted memo | Server stores encrypted blob it cannot read. | Supports backup while reducing server exposure. | Requires key management, recovery, and clear UX. |
| C. Policy revision | Owner accepts a revised rule for raw memo server persistence. | Simplest product behavior. | Changes a core privacy invariant and needs explicit acceptance. |

Accepted first-beta default:

```yaml
recommended_memo_server_policy:
  model: local_only_for_first_public_sync_beta
  raw_memo_server_persistence: forbidden
  encrypted_private_memo_persistence: deferred
  raw_memo_audit_persistence: forbidden
  implementation_before_decision: forbidden
```

Until a later accepted decision and separate release gate change this contract, sync implementation must
not transmit raw `memo`, `note`, raw symptom clauses, injury narratives,
medical notes, guardian notes, or coach private notes to the server or audit
logs.

### 6.3 Allowed Structured Promotion

The following classes may be promoted before memo policy changes, subject to
the accepted journal schema:

```yaml
allowed_structured_promotion:
  - journal_id
  - kind
  - date
  - savedAt
  - syncState
  - structured_numeric_fields
  - structured_enums
  - non_sensitive_reason_codes
  - redaction_state_for_omitted_text
```

The first beta omits memo fields entirely and explains this boundary once in
the sync UI. A future schema may add a non-sensitive redaction state such as
`memo_server_state: local_only`; its absence in the first beta must not be
interpreted as permission to infer, request, or upload the omitted text.

### 6.4 Current-Beta Serializer Boundary

`app/src/domain/account/sync-local.ts` `toUploadPayload` must enforce the
structured-only boundary itself, including when called outside the public sync
flow. A stored or caller-supplied `shareTrainingNotes: true` is legacy state,
not authority to include raw text. Neither consent flag nor memo purpose may
bypass the existing `toExportJournalEntry` structured projection.

- Omit `memo`, `note`, and `memoPurpose` for every journal kind and memo purpose,
  including legacy entries without a purpose. Never spread the original entry
  into an upload payload.
- Preserve the existing projection's structured training fields, field provenance,
  and `plannedSessionLink`; this correction does not expand the upload schema.
- Return `null` when the existing projection finds no exportable structured
  signal. A memo-only entry must not become uploadable through stale consent.
- Leave the source entry and locally stored memo unchanged. Keep the existing
  consent storage shape for compatibility; it cannot authorize memo upload.

Account restore may restore the structured record, but must not depend on a new
upload carrying raw memo text. This serializer correction does not authorize
deletion of existing server or device data, migrations, encrypted memo release,
or changes to retention policy. The draft status and all open issues remain
unchanged; focused regression and mutation results are separate implementation
evidence, not public-release or canonical-promotion evidence.

---

## 7. Account And Consent Boundary

Promotion requires TrainOracle account consent. AthleteTime identity may be
used only as a login provider under the accepted federation decision.

```yaml
sync_consent:
  consentSubject: ATHLETE_OR_GUARDIAN_WHEN_REQUIRED
  consentScope: TRAINORACLE_JOURNAL_SERVER_BACKUP
  athleteTimeReceivesJournalData: false
  consentAuditRequired: true
```

Consent audit may record that sync was enabled, disabled, or retried. It must
not include raw memo text, symptom clauses, or injury narratives.

---

## 8. Deletion And Unlinking

```yaml
unlink_and_delete_policy:
  unlink_account:
    server_copy_default: keep_until_user_deletes_or_retention_expires
    local_copy_default: keep_on_device
    user_export_before_delete: open_issue
  account_deletion:
    server_copy: delete_or_anonymize_under_policy
    local_copy: user_choice_on_device
  sync_disable:
    future_uploads: stopped
    local_entries: preserved
```

Unlinking an account must not silently erase the only copy of an athlete's
journal. Server deletion, local deletion, and export behavior need explicit UX
and policy acceptance before implementation.

---

## 9. Open Issues

| issue_id | title | status | canonical_blocking | notes |
|---|---|---|---:|---|
| OI-LFSP-BACKEND-REALITY-001 | Supabase sync implementation exists behind a release gate | OPEN | YES | Keep open until the intended public environment deploys the structured-only path and operational receipts exist. |
| OI-LFSP-MEMO-SERVER-POLICY-001 | First beta decided as structured-only; later memo policy remains deferred | OPEN | YES | Raw memo/note, memo purpose, and symptom text remain local-only. A later scope needs a separate owner decision. |
| OI-LFSP-ENCRYPTION-001 | Encrypted private memo release remains deferred | OPEN | YES | Existing experimental crypto code is not first-beta release authority. Recovery UX and operations need a separate gate. |
| OI-LFSP-RETENTION-DELETE-001 | Retention, export, deletion, and unlink UX not accepted | OPEN | NO | Needed before production account deletion and device/server divergence flows. |

---

## 10. Non-Claims

This draft does not claim:

- Public production sync has been enabled or deployed.
- Any runtime test has passed.
- Raw memo server persistence is allowed.
- Any open issue is closed.
- Any canonical promotion is granted.
- Sync state can affect D9, RVE, Safety Gate, or Plan Generator safety disposition.

---

## 11. Change History

| version | date | change |
|---|---|---|
| 0.1 | 2026-07 | Reconstructed local-first sync draft. |
| 0.2 | 2026-08-27 | Aligned the draft with explicit preview/confirmation, stable-ID merge behavior, account-scoped consent, and the owner-approved structured-only first beta. Open issues remain open. |

[DRAFT_COMPLETE]
