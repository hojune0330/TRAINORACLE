# P1 Target Patch Plan 06: Calendar Schema Binding

```yaml
issue_id: OI-FA-CALENDAR-SCHEMA-BINDING-001
approved: false
state: READY_FOR_OWNER_APPROVAL
readiness_class: REQUIRES_RUNTIME_TARGET
classification: CALENDAR_IDENTITY_MAPPING_AND_PROJECTION
runtime_authorized: false
canonical_spec_patch_authorized: false
owning_files:
  - `specs/reconstruct/MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md`
  - `specs/reconstruct/CALENDAR_VERSION_AND_SYNC_CONTRACT.md`
  - `specs/active/PLAN_GENERATOR_SPEC.md`
  - `specs/active/APP_IMPLEMENTATION_BRIDGE.md`
owning_issues:
  - `OI-FA-CALENDAR-SCHEMA-BINDING-001`
  - `OI-MCM-PLAN-GENERATOR-BINDING-001`
  - `OI-MCM-APP-BRIDGE-BINDING-001`
  - `OI-PG-MICROCYCLE-CALENDAR-MAPPING-001`
```

## Classification

Calendar identity, local-civil boundary, projection, and DOUBLE/FLEX crosswalk.

## Governing Decision

`FORMATION_CALENDAR_SYNC_ACCEPTANCE_DECISION.md` is the governing blocked decision;
`reports/review/WO013_REPOSITORY_TARGET_BINDING_PLAN.md` names repository targets.

## Exact Targets

Patch only the four named documents and their existing issue rows. Mapping must carry
frame, block, plan version, session, hashes, boundary, timezone/tzdb, revision, and
watermark identity while leaving Calendar projection-only.

## Prerequisites

- Orders 011 and 012 accepted for this bounded mapping.
- Owner accepts DOUBLE/FLEX mapping and `[start,end)` local-civil semantics.
- Plan-version identity and canonical preimage are approved with P1 plan 04.

## Forbidden Work

No calendar drag/drop as plan mutation, UTC 228-hour substitution, automatic re-anchor,
classifier rewrite, stale projection acceptance, or UI/runtime implementation.

## Impact

Schema: future identity/crosswalk fields. API: read projection plus typed stale/conflict.
Runtime: none; Calendar remains a projection of an accepted plan version.

## Baseline

The mapping lacks complete identity; DOUBLE/FLEX is unresolved; 36 architecture fixtures
are specifications, not executed adapter evidence.

## RED

Fail tests for missing frame/block/version/hash, spring 227/fall 229 elapsed mismatch,
fold/gap without resolution, DOUBLE/FLEX unmapped, stale watermark, and re-anchor collision.

## Patch Order

1. Accept identity and slot crosswalk in the sync contract.
2. Patch mapping schema and boundary examples; recount its issue table.
3. Patch Plan Generator projection contract and existing issue row; recount.
4. Patch App Bridge endpoint/storage/access requirements; recount.
5. Attach accepted-only DST, re-anchor, revision, and projection fixtures.

## GREEN

Exact identity round-trips; local-civil 9d12h passes 227/228/229-hour cases; ambiguous
times require resolution; stale or unmapped records reject; target counts reconcile.

## Manual QA

Inspect Seoul and New York spring/fall frames, midnight end-boundary, DOUBLE/FLEX,
offline stale calendar, re-anchor, and two-tab refresh with visible planned/completed separation.

## Migration, Rollback, And Kill Switch

No migration authorized. Future migration backfills no invented identity; unresolved
legacy rows remain suppressed. Rollback is read-compatible; `formationCalendarEnabled=false`.

## Privacy And Security Review

Privacy reviewer checks calendar audience/minimization. Security reviewer verifies tenant,
athlete, version, revision, watermark, and hash cannot be substituted or enumerated.

## Closure Evidence

Accepted crosswalk/hash version, target diffs/recounts, executable DST and concurrency
logs, manual projection evidence, privacy/security sign-off, and closure PR.

## Latest Research Reconciliation

```yaml
latest_owner_baseline: reports/review/FORMATION_LATEST_OWNER_DECISION_BASELINE.md
related_conflicts:
  - FRV2-CONF-001
  - FRV2-CONF-012
research_inputs:
  - reports/research/FORMATION_COMPETITION_ANCHOR_EVIDENCE_SUPPLEMENT.md
  - reports/review/FORMATION_LATEST_DECISION_AND_USER_GAP_AUDIT_V2.md
decision_packets:
  - FORMATION_CALENDAR_SYNC_ACCEPTANCE_DECISION.md
  - reports/review/FORMATION_COMPETITION_ANCHOR_DECISION_PACKET_V1.md
prepared_evidence:
  - reports/review/WO013_REPOSITORY_TARGET_BINDING_PLAN.md
remaining_named_gates:
  - ORDERS_011_AND_012_ACCEPTED
  - COACH_HOJUNE_DOUBLE_FLEX_AND_BOUNDARY_DECISION
  - P1_PLAN_04_APPROVED
  - CA-02_CA-03_OWNER_DECISION
approval_state_unchanged: true
runtime_authorized: false
canonical_spec_patch_authorized: false
```

## Human Decision

`COACH_HOJUNE` approves DOUBLE/FLEX and boundary semantics, then target owners approve
bindings. Current answer: NOT_RECORDED; plan unapproved and P1 OPEN.
