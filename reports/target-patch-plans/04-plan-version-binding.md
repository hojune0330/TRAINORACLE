# P1 Target Patch Plan 04: Plan Version Binding

```yaml
issue_id: OI-FA-PLAN-VERSION-BINDING-001
approved: false
state: READY_FOR_OWNER_APPROVAL
readiness_class: REQUIRES_RUNTIME_TARGET
classification: VERSION_LINEAGE_CONCURRENCY_AND_DURABILITY
runtime_authorized: false
canonical_spec_patch_authorized: false
owning_files:
  - `specs/active/PLAN_GENERATOR_SPEC.md`
  - `specs/active/APP_IMPLEMENTATION_BRIDGE.md`
  - `specs/reconstruct/CALENDAR_VERSION_AND_SYNC_CONTRACT.md`
  - `specs/reconstruct/MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md`
owning_issues:
  - `OI-FA-PLAN-VERSION-BINDING-001`
  - `OI-AIB-IDEMPOTENCY-001`
  - `OI-MCM-PLAN-GENERATOR-BINDING-001`
  - `PROPOSED-OI-PG-FORMATION-VERSION-LIFECYCLE-001`
```

## Classification

Cross-target identity, lifecycle, CAS, hold ordering, atomicity, and durable idempotency.

## Governing Decision

`FORMATION_CALENDAR_SYNC_ACCEPTANCE_DECISION.md` is prepared but blocked. The exact
architecture handoff is `reports/review/WO013_REPOSITORY_TARGET_BINDING_PLAN.md`.

## Exact Targets

Patch only the four listed contracts. The proposed Plan Generator issue is created in
that exact file after an owner-approved target recount; it must name option, selection,
validation, hold, adaptation, aggregate/safety epoch, hash, and outbox requirements.

## Prerequisites

- Orders 011 and 012 accepted for this bounded use.
- Owner accepts canonical identity/preimage, lifecycle, CAS, and offline conflict states.
- Backend owner chooses persistence/outbox technology in a later implementation decision.

## Forbidden Work

No silent last-write-wins, mutable accepted version, unsequenced hold, cross-epoch
selection, retry-created duplicate, partial plan/calendar write, or runtime schema work.

## Impact

Schema: future unique keys, version lineage, CAS revision, epochs, hold sequence,
idempotency, outbox. API: typed conflict/stale/review errors. Runtime: prohibited now.

## Baseline

Thirty-six deterministic architecture fixtures exist; architecture remains unaccepted,
DOUBLE/FLEX unresolved, and no target owns a complete Formation lifecycle issue.

## RED

Before implementation, fail tests for stale revision, epoch mismatch, hash mismatch,
duplicate retry, partial transaction, out-of-order hold, revoked version, and key erasure.

## Patch Order

1. Accept the calendar/version identity and canonical hash contract.
2. Recount Plan Generator; create the exact proposed lifecycle issue.
3. Patch Plan Generator option/selection/validation/adaptation state machines.
4. Patch App Bridge API, access, idempotency, and atomic transaction requirements.
5. Patch calendar projection mapping; recount all three issue tables.

## GREEN

All 36 architecture fixtures plus target-local lifecycle fixtures pass; retries are
durable, conflicts typed, holds ordered, hashes reproducible, and writes atomic.

## Manual QA

Exercise two tabs selecting the same revision, offline edit/reconnect, revoked consent,
stale SafetyBlockRef, race re-anchor, and duplicate request; verify visible outcomes.

## Migration, Rollback, And Kill Switch

Migration requires expand/backfill/verify/contract with immutable backups. Rollback
keeps new identity columns readable. `formationVersionWritesEnabled=false` blocks writes.

## Privacy And Security Review

Privacy reviewer approves stored lineage/minimization and erasure behavior. Security
reviewer threat-models replay, IDOR, tenant mixing, hash substitution, and outbox leakage.

## Closure Evidence

Accepted architecture hash, target issues/recounts, schema design, RED/GREEN and
concurrency logs, migration rehearsal, threat model, rollback proof, and closure PR.

## Latest Research Reconciliation

```yaml
latest_owner_baseline: reports/review/FORMATION_LATEST_OWNER_DECISION_BASELINE.md
related_conflicts:
  - FRV2-CONF-001
research_inputs:
  - reports/review/FORMATION_LATEST_DECISION_AND_USER_GAP_AUDIT_V2.md
decision_packets:
  - reports/review/MULTITAB_REFRESH_AND_REVISION_DECISION.md
prepared_evidence:
  - reports/review/WO013_REPOSITORY_TARGET_BINDING_PLAN.md
  - reports/review/FORMATION_RUNTIME_SECURITY_AND_PRIVACY_AUDIT.md
remaining_named_gates:
  - ORDER_011_QUALIFIED_PRIVACY_ACCEPTANCE
  - ORDER_012_COACH_OWNER_ACCEPTANCE
  - COACH_HOJUNE_VERSION_IDENTITY_DECISION
  - BACKEND_SECURITY_IMPLEMENTATION_DECISION
approval_state_unchanged: true
runtime_authorized: false
canonical_spec_patch_authorized: false
```

## Human Decision

`COACH_HOJUNE` approves the bounded contract plan; backend/security owners later approve
implementation. Current answer: NOT_RECORDED; plan unapproved and P1 OPEN.
