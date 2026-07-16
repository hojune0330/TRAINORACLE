# P1 Target Patch Plan 10: Record Governance

```yaml
issue_id: OI-FA-RECORD-GOVERNANCE-001
approved: false
state: READY_FOR_OWNER_APPROVAL
readiness_class: READY_AFTER_NAMED_APPROVAL
classification: PRIVACY_SECURITY_RETENTION_AND_ACCESS_GOVERNANCE
runtime_authorized: false
canonical_spec_patch_authorized: false
owning_files:
  - `specs/reconstruct/FORMATION_RECORD_GOVERNANCE_CONTRACT.md`
  - `specs/active/APP_IMPLEMENTATION_BRIDGE.md`
  - `specs/reconstruct/DAILY_LOG_AND_CHECKIN_SPEC.md`
  - `specs/reconstruct/HUMAN_REVIEW_AND_SHARING_WORKFLOW.md`
owning_issues:
  - `OI-FA-RECORD-GOVERNANCE-001`
  - `OI-AIB-RLS-STRATEGY-001`
  - `OI-AIB-RETENTION-POLICY-001`
  - `OI-AIB-ENCRYPTION-KEY-MGMT-001`
```

## Classification

Qualified privacy/legal, security, youth, access, retention, deletion, revocation,
legal-hold, key-erasure, breach, sharing, and minimization governance.

## Governing Decision

`FORMATION_PRIVACY_GOVERNANCE_DECISION.md` keeps policy unaccepted pending a named
qualified reviewer. The detailed candidate is `FORMATION_RECORD_GOVERNANCE_CONTRACT.md`.

## Exact Targets

Patch the four named contracts and existing App Bridge P1 issue rows after qualified
review. No runtime storage, sharing, migration, processor, or account-linked persistence
is authorized by this plan.

## Prerequisites

- Named qualified reviewer and verified review scope.
- Owner states launch jurisdiction, youth age, vendors/processors, regions, and product facts.
- Accepted record inventory, access matrix, retention/deletion, revocation, hold, and breach rules.

## Forbidden Work

No invented legal basis, indefinite retention, private-note signal, hidden recipient
sharing, guardian overreach, deletion bypass, production storage, or fake reviewer approval.

## Impact

Schema: future governance envelope, purpose/access, retention, deletion, hold, key and
audit references. API/runtime/migration: separately gated and currently blocked.

## Baseline

Candidate governance contract has eight blocking issues; App Bridge RLS, retention and
key management remain P1; qualified reviewer and product facts are absent.

## RED

Before implementation, fail tests for cross-tenant access, revoked purpose reuse,
expired retention, youth age-out, deletion under/without valid hold, key-erasure restore,
unauthorized share, processor-region mismatch, and private-note trace.

## Patch Order

1. Complete product facts and qualified legal/privacy review.
2. Accept governance envelope and enforcement matrix.
3. Patch Daily Log minimization/revocation boundaries and sharing workflow.
4. Patch App Bridge RLS, retention, key, deletion, audit and breach requirements; recount.
5. Seek separate architecture/migration/runtime authorization and executable evidence.

## GREEN

Governance fixtures pass; deny is default; private notes are zero-signal; revocation,
deletion, age-out, hold and key erasure have deterministic, auditable outcomes.

## Manual QA

Qualified reviewer walks athlete, minor/guardian, coach, friend/export, revoked access,
deletion, legal hold, breach, processor, and account closure scenarios.

## Migration, Rollback, And Kill Switch

No migration now. Future migration requires encrypted backup, rehearsal and erasure proof;
rollback cannot resurrect deleted data; account-linked storage/share switches default off.

## Privacy And Security Review

Named qualified legal/privacy approval is mandatory. Security review covers RLS/IDOR,
keys, logs, backups, export, breach detection, processors, regions, and restore after erasure.

## Closure Evidence

Signed reviewer report, product-fact snapshot, accepted contract hash, target diffs/recounts,
later RED/GREEN and migration/restore logs, threat model, and closure PR.

## Human Decision

`COACH_HOJUNE` adopts only the qualified-reviewed policy and names implementation owners.
Current answer: NOT_RECORDED; plan unapproved and P1 OPEN.
