# WO013 Repository Target-Binding Plan

```yaml
work_order: WO013
status: TARGET_PLAN_ONLY_NOT_ACCEPTED
source_fixture_pack: specs/test-packages/CALENDAR_SYNC_CONCURRENCY_FIXTURE_PLAN.md
fixture_coverage: 36/36
backend_choice: none
database_choice: none
migration_choice: none
runtime_authority: false
schema_authority: false
```

## Boundary And Authority

This document identifies where each WO013 behavior could be implemented or tested. It
does not authorize a backend, database, persistence schema, sync transport, migration,
calendar write, or production runtime. `CURRENT_LOCAL` means a file exists and owns a
related local behavior; it does not mean the fixture already passes there.
`FUTURE_EXISTING_SEAM` means an existing stub can receive a later accepted patch.
`NO_TARGET_YET` means the repository has no honest implementation owner for that
behavior. A later owner decision must create and review one before GREEN work begins.

The current app is local journal-first. There is no App Bridge, server sync aggregate,
calendar mutation adapter, outbox, key service, or tenant-aware persistence target.
Contract documents remain requirements, not runtime targets.

## Typed Target Shapes

These are target shapes for later RED tests, not accepted database or API schemas.

```text
CalendarIdentityTarget = {
  tenantId, groupId, athleteId,
  runId, planVersionId, planVersionNumber, planContentHash,
  frameId, frameContentHash, frameHeadRevision,
  blockId, predecessorBlockId,
  plannedSessionId, predecessorPlannedSessionId,
  completedRecordId, experiencedResponseId,
  formationRuleSetVersion, projectionSchemaVersion,
  timezoneId, timezoneDatabaseVersion, resolvedBoundaryRef,
  projectionRevision, sourceWatermark
}

CanonicalProjectionEnvelope = {
  domainTag, projectionSchemaVersion, projectionDocument,
  canonicalization: UTF8_NFC_RFC8785,
  digestAlgorithm: SHA256_LOWERCASE_HEX
}

RevisionCommand = {
  typedIdentity, idempotencyKey, requestHash,
  expectedAggregateRevision, expectedSafetyEpoch,
  expectedAuthorizationRevocationEpoch, operation
}

ProjectionSubscription = {
  streamId, sequence, predecessorRevision, revision,
  getSnapshot, subscribe, unsubscribe, staleState
}

OfflineEnvelope = {
  typedIdentity, idempotencyKey, requestHash, payloadSchemaVersion,
  baseHash, deletionEpoch, authorizationRevocationEpoch, originalPayloadHash
}

TombstoneState = { typedIdentity, deletionEpoch, sourceSnapshotEpoch, visible }
KeyErasureEvidence = { keyVersion, destroyedAt, protectedLocations, decryptableCount }
ResolvedCivilBoundary = {
  timezoneId, timezoneDatabaseVersion, requestedLocal, foldOrGapDecision,
  resolvedInstantUtc, utcOffsetSeconds
}
TransactionalPromotionResult = {
  aggregateRevision, recordRef, idempotencyRef, auditRef, outboxRef,
  committedTogether, rollbackComplete
}
```

Every identity is scope-bound. Hash preimages use UTF-8, NFC, materialized defaults,
RFC 8785 canonical JSON, a domain tag, and SHA-256. A tenant boundary failure returns
`SCOPE_MISMATCH` without disclosing whether the referenced resource exists.

## Patch Order

| Stage | Later patch objective | Entry gate | Required RED evidence |
|---|---|---|---|
| `P1` | Bind typed identity, canonical hash, tenant boundary | accepted identity owner and threat review | HASH/ID exact bytes, digest, and cross-scope rejection |
| `P2` | Resolve local-civil boundaries and DST | accepted timezone/tzdb owner; DOUBLE/FLEX decision | TZ and CAL boundary fixtures |
| `P3` | Add aggregate compare-and-swap and lineage | accepted aggregate target | competing writer and re-anchor rollback fixtures |
| `P4` | Add subscription freshness behavior | accepted App Bridge target | unsubscribe, duplicate, and sequence-gap fixtures |
| `P5` | Add offline idempotency and conflict preservation | accepted sync target | retry, partial failure, revocation, conflict fixtures |
| `P6` | Add tombstone and key erasure enforcement | qualified privacy/security approval | restore, deletion epoch, and decryptability fixtures |
| `P7` | Add atomic audit/outbox promotion and rollback | accepted persistence and outbox targets | failure-after-each-step fixtures |
| `P8` | Prove private-note zero signal end to end | WO011 approval and concrete targets P1-P7 | pairwise byte equality and raw-text absence |

Stages describe dependency order only. They do not select technology or authorize a
patch. DOUBLE and FLEX remain unmapped until the coach/calendar crosswalk is accepted.

## Fixture Target Matrix

The fourth column is the first patch stage that can own a deterministic RED test.

| Fixture | Repository target | Target status | Patch stage |
|---|---|---|---|
| `HASH-01` | `impl/src/plan-generator/generator.ts` | `FUTURE_EXISTING_SEAM` | `P1` |
| `HASH-02` | `impl/src/plan-generator/generator.ts` | `FUTURE_EXISTING_SEAM` | `P1` |
| `ID-01` | `impl/src/plan-generator/generator.ts` | `FUTURE_EXISTING_SEAM` | `P1` |
| `ID-02` | `impl/src/plan-generator/generator.ts` | `FUTURE_EXISTING_SEAM` | `P1` |
| `TZ-01` | `NO_TARGET_YET` | `NO_TARGET_YET` | `P2` |
| `TZ-02` | `NO_TARGET_YET` | `NO_TARGET_YET` | `P2` |
| `TZ-03` | `NO_TARGET_YET` | `NO_TARGET_YET` | `P2` |
| `TZ-04` | `NO_TARGET_YET` | `NO_TARGET_YET` | `P2` |
| `TZ-05` | `NO_TARGET_YET` | `NO_TARGET_YET` | `P2` |
| `TZ-06` | `NO_TARGET_YET` | `NO_TARGET_YET` | `P2` |
| `TZ-07` | `NO_TARGET_YET` | `NO_TARGET_YET` | `P2` |
| `TZ-08` | `NO_TARGET_YET` | `NO_TARGET_YET` | `P2` |
| `CAL-01` | `NO_TARGET_YET` | `NO_TARGET_YET` | `P2` |
| `CAL-02` | `impl/src/plan-generator/generator.ts` | `FUTURE_EXISTING_SEAM` | `P3` |
| `CAL-03` | `NO_TARGET_YET` | `NO_TARGET_YET` | `P2` |
| `TAB-01` | `NO_TARGET_YET` | `NO_TARGET_YET` | `P3` |
| `TAB-02` | `NO_TARGET_YET` | `NO_TARGET_YET` | `P3` |
| `TAB-03` | `NO_TARGET_YET` | `NO_TARGET_YET` | `P4` |
| `TAB-04` | `NO_TARGET_YET` | `NO_TARGET_YET` | `P4` |
| `TAB-05` | `NO_TARGET_YET` | `NO_TARGET_YET` | `P4` |
| `OFF-01` | `NO_TARGET_YET` | `NO_TARGET_YET` | `P5` |
| `OFF-02` | `NO_TARGET_YET` | `NO_TARGET_YET` | `P5` |
| `OFF-03` | `NO_TARGET_YET` | `NO_TARGET_YET` | `P5` |
| `OFF-04` | `NO_TARGET_YET` | `NO_TARGET_YET` | `P6` |
| `OFF-05` | `NO_TARGET_YET` | `NO_TARGET_YET` | `P5` |
| `OFF-06` | `NO_TARGET_YET` | `NO_TARGET_YET` | `P5` |
| `OFF-07` | `NO_TARGET_YET` | `NO_TARGET_YET` | `P5` |
| `DB-01` | `NO_TARGET_YET` | `NO_TARGET_YET` | `P7` |
| `DB-02` | `NO_TARGET_YET` | `NO_TARGET_YET` | `P7` |
| `DB-03` | `NO_TARGET_YET` | `NO_TARGET_YET` | `P1` |
| `DB-04` | `NO_TARGET_YET` | `NO_TARGET_YET` | `P7` |
| `DB-05` | `NO_TARGET_YET` | `NO_TARGET_YET` | `P6` |
| `DB-06` | `NO_TARGET_YET` | `NO_TARGET_YET` | `P6` |
| `DB-07` | `NO_TARGET_YET` | `NO_TARGET_YET` | `P7` |
| `PRIV-01` | `app/src/domain/journal-store.ts` | `CURRENT_LOCAL` | `P8` |
| `PRIV-02` | `app/src/safety/memo-safety.ts` | `CURRENT_LOCAL` | `P8` |

## Current Seams

| Concern | Exact current file | Honest boundary |
|---|---|---|
| Local journal schema/provenance | `app/src/domain/journal-schema.ts` | local entries only; no Formation identity or tenant scope |
| Local store/export | `app/src/domain/journal-store.ts` | browser-local journal; no CAS, subscription, sync, tombstone, or outbox |
| Local analysis aggregates | `app/src/domain/aggregates.ts` | journal summaries only; never a calendar or Formation authority |
| Memo safety projection | `app/src/safety/memo-safety.ts` | transient reason-code projection; no raw-note persistence authority |
| Plan Generator | `impl/src/plan-generator/generator.ts` | stub returning `PLAN_GENERATOR_STUB`; no identity/hash/calendar behavior |
| Safety Gate | `impl/src/safety-gate/gate.ts` | decision seam only; cannot clear privacy, auth, or calendar gates |
| Calendar view | `NO_TARGET_YET` | no production calendar component or mutation surface exists |
| App Bridge | `NO_TARGET_YET` | no bridge package, endpoint, transport, or tenant adapter exists |
| Server aggregate/sync | `NO_TARGET_YET` | no persistence or concurrency implementation exists |
| Tombstone/key erasure | `NO_TARGET_YET` | no reviewed key domain or erasure runtime exists |
| Audit/outbox | `NO_TARGET_YET` | no transactional runtime exists |

## Deferred Decisions

- Name the App Bridge, calendar projection, aggregate, sync, outbox, and key-erasure
  owners before replacing any `NO_TARGET_YET` row.
- Decide DOUBLE/FLEX mapping with the WO012 coach/calendar owner before P2.
- Select timezone data and update policy before P2; the fixture snapshot is synthetic.
- Select backend, database, transport, schema, migration, and key infrastructure only in
  separately approved architecture records.
- Obtain qualified privacy/security approval before P6 and P8.
- Preserve offline conflict originals; no automatic winner is allowed.
- Require atomic record/idempotency/audit/outbox commit or complete rollback at P7.
- Re-run all 36 exact fixtures after every target replacement or ownership change.

[TARGET_BINDING_COMPLETE_NOT_ACCEPTED]
