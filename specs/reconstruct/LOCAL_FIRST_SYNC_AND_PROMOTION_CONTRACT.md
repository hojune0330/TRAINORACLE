# LOCAL_FIRST_SYNC_AND_PROMOTION_CONTRACT.md

```yaml
document_metadata:
  doc_id: trainoracle-local-first-sync-promotion-contract
  spec_id: LOCAL_FIRST_SYNC_AND_PROMOTION_CONTRACT
  title: Local-First Sync And Promotion Contract
  version: 0.1
  round: RT1_RECONSTRUCTED
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
It is a sync and data-boundary contract only. It does not implement a backend,
close any issue, or authorize raw free-text server persistence.

The current app model stores entries locally first with `syncState: local`.
Server sync is a later account-linked capability. The local writing flow must
remain usable even when the server is unavailable.

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
  trigger: account_link_complete
  source: device_local_journal_store
  destination: TRAINORACLE_SERVER_ONLY
  batch_policy: upload_local_items
  local_delete_before_confirmed_upload: forbidden
  syncState_transition:
    from: local
    to: synced
    allowed_only_after: server_ack_for_that_item
```

Required item-level behavior:

| Step | Rule |
|---|---|
| Read local entries | Include only entries currently marked `syncState: local`. |
| Upload | Send a bounded batch with stable local IDs and idempotency keys. |
| Partial success | Mark only acknowledged items as `synced`; leave failed items `local`. |
| Retry | Retry failed local items with the same idempotency key unless the user cancels sync. |
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
    - then_attempt_background_upload_if_authenticated
  server_unavailable_blocks_writing: false
  failed_upload_blocks_local_review: false
  sync_retry_visible: true
```

Server downtime, account errors, token expiry, or network loss must not prevent
the athlete from writing or reading local entries on that device.

---

## 5. Conflict Handling

Automatic merge is forbidden for same `date + kind` conflicts.

```yaml
conflict_key:
  fields:
    - date
    - kind

conflict_resolution:
  automatic_overwrite_allowed: false
  automatic_merge_allowed: false
  preserve_both_versions: true
  required_resolution: user_confirmation
  audit_resolution_without_raw_text: true
```

If a server already contains an entry for the same date and journal kind from
another device, both versions must be preserved until the user chooses a
structured resolution. This mirrors the conflict principle in
`EXTERNAL_RECORD_INTEGRATION_SPEC.md`: no side wins automatically.

---

## 6. Memo Policy Decision Point

`memo` and `note` fields are useful to the athlete, but raw free-text server
persistence conflicts with the existing §8 memo policy unless explicitly
accepted by the owner.

### 6.1 Options

| Option | Server behavior | Benefit | Risk |
|---|---|---|---|
| A. Local-only memo | Structured entry syncs, raw memo/note remain on device. | Strongest alignment with current privacy policy. | Multi-device text backup is unavailable. |
| B. End-to-end encrypted memo | Server stores encrypted blob it cannot read. | Supports backup while reducing server exposure. | Requires key management, recovery, and clear UX. |
| C. Policy revision | Owner accepts a revised rule for raw memo server persistence. | Simplest product behavior. | Changes a core privacy invariant and needs explicit acceptance. |

Recommended draft default:

```yaml
recommended_memo_server_policy:
  model: local_only_until_owner_decision
  raw_memo_server_persistence_before_decision: forbidden
  raw_memo_audit_persistence: forbidden
  implementation_before_decision: forbidden
```

Until a later accepted decision changes this contract, sync implementation must
not transmit raw `memo`, `note`, raw symptom clauses, injury narratives,
medical notes, guardian notes, or coach private notes to the server or audit
logs.

### 6.2 Allowed Structured Promotion

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

Omitted memo fields should carry a redaction state such as
`memo_server_state: local_only` so the UI can explain why an entry looks
different across devices.

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
| OI-LFSP-BACKEND-REALITY-001 | TrainOracle server backend is not implemented | OPEN | YES | F2 Workers+D1 or successor backend must exist before runtime sync can be claimed. |
| OI-LFSP-MEMO-SERVER-POLICY-001 | Raw memo/note server persistence decision unresolved | OPEN | YES | Until accepted, raw memo/note and symptom text must remain local-only or omitted/redacted from server sync. |
| OI-LFSP-ENCRYPTION-001 | Encryption and key-recovery design unresolved | OPEN | YES | Required if owner chooses E2E encrypted memo backup or other sensitive backup path. |
| OI-LFSP-RETENTION-DELETE-001 | Retention, export, deletion, and unlink UX not accepted | OPEN | NO | Needed before production account deletion and device/server divergence flows. |

---

## 10. Non-Claims

This draft does not claim:

- Any backend sync has been implemented.
- Any runtime test has passed.
- Raw memo server persistence is allowed.
- Any open issue is closed.
- Any canonical promotion is granted.
- Sync state can affect D9, RVE, Safety Gate, or Plan Generator safety disposition.

[DRAFT_COMPLETE]
