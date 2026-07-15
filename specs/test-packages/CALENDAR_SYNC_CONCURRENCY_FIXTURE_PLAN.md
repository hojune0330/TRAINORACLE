# Calendar Sync Concurrency Fixture Plan

```yaml
fixture_pack_id: TO-WO013-CALENDAR-SYNC-2026-07-15
version: 0.2
status: READINESS_ONLY_BLOCKED_ON_011_012
fixture_count: 36
runtime_authority: false
backend_choice: none
```

## Normalization Rules

All fixture comparisons use UTF-8, Unicode NFC, RFC 8785 JCS, finite JSON numbers,
materialized schema defaults, exact case-sensitive IDs, canonical units, and SHA-256
lowercase 64-character hex digests. `fixture-tzdb-2026a` is a pinned synthetic fixture
snapshot containing the listed 2026 transition rules; it is not a production tzdb
selection. Expected error objects contain only the exact keys shown.

Arrays preserve their declared input order. Object property names use RFC 8785 UTF-16
code-unit lexicographic ordering after the versioned fixture schema has materialized all
defaults. No host operating-system or language-runtime timezone database may be used for
these fixtures.

### Embedded synthetic timezone snapshot

```yaml
snapshotId: fixture-tzdb-2026a
zones:
  Asia/Seoul:
    initialOffsetSeconds: 32400
    transitions: []
  America/New_York:
    initialOffsetSeconds: -18000
    transitions:
      - { atUtc: "2026-03-08T07:00:00Z", offsetBeforeSeconds: -18000, offsetAfterSeconds: -14400, localEffect: GAP_02_00_TO_02_59_59 }
      - { atUtc: "2026-11-01T06:00:00Z", offsetBeforeSeconds: -14400, offsetAfterSeconds: -18000, localEffect: FOLD_01_00_TO_01_59_59 }
outsideSnapshotRange: REJECT_UNSUPPORTED_FIXTURE_TIME
```

This embedded snapshot is the complete timezone authority for `TZ-01` through `TZ-08`.
Implementations must derive expected offsets, gaps, and folds from these rows and reject
an instant requiring any unlisted transition.

## Exact Hash And Identity Fixtures

### HASH-01 - Canonical bytes and digest

```yaml
input_object:
  domainTag: TRAINORACLE_CALENDAR_PROJECTION_V1
  projectionSchemaVersion: "1"
  projectionDocument:
    plannedSessionId: session-1
expected_canonical_utf8: '{"domainTag":"TRAINORACLE_CALENDAR_PROJECTION_V1","projectionDocument":{"plannedSessionId":"session-1"},"projectionSchemaVersion":"1"}'
expected_sha256: d09425ec584a295dcc9d47a7aeab44fb5eb7d5230633fec0b05abf89c03b3834
```

### HASH-02 - Domain separation

```yaml
input_canonical_utf8: '{"domainTag":"TRAINORACLE_OTHER_DOMAIN_V1","projectionDocument":{"plannedSessionId":"session-1"},"projectionSchemaVersion":"1"}'
expected_sha256: 3714a2c85c3a80a4420df8a4bcee979d669b47cfc835f71d3da3efddbaff0dac
mustNotEqual_HASH_01: true
```

### ID-01 - Cross-scope reference

```yaml
input:
  mutationScope: [tenant-a, group-1, athlete-1]
  referencedPlanScope: [tenant-b, group-1, athlete-1]
expected:
  status: REJECTED
  code: SCOPE_MISMATCH
  resourceExists: NOT_DISCLOSED
  committedRevision: null
```

### ID-02 - Planned/completed/experienced version binding

```yaml
input:
  planned: [tenant-a, group-1, athlete-1, plan-v3, session-5]
  completed: [tenant-a, group-1, athlete-1, plan-v2, session-5, completed-9]
  experienced: [tenant-a, group-1, athlete-1, plan-v3, session-5, response-4]
expected:
  status: REJECTED
  code: COMPLETED_PLAN_VERSION_MISMATCH
  plannedRecordMutated: false
  completedRecordBound: false
  experiencedRecordBound: false
```

## Exact Local-Civil And DST Fixtures

```yaml
- id: TZ-01
  input:
    timezone: Asia/Seoul
    timezoneDatabaseVersion: fixture-tzdb-2026a
    requestedStartLocal: "2026-03-01T00:00:00"
  expected:
    startUtc: "2026-02-28T15:00:00Z"
    startOffsetSeconds: 32400
    endExclusiveLocal: "2026-03-10T12:00:00"
    endExclusiveUtc: "2026-03-10T03:00:00Z"
    endOffsetSeconds: 32400
    elapsedHours: 228
    status: EXACT

- id: TZ-02
  input:
    timezone: America/New_York
    timezoneDatabaseVersion: fixture-tzdb-2026a
    requestedStartLocal: "2026-03-01T00:00:00"
  expected:
    startUtc: "2026-03-01T05:00:00Z"
    startOffsetSeconds: -18000
    endExclusiveLocal: "2026-03-10T12:00:00"
    endExclusiveUtc: "2026-03-10T16:00:00Z"
    endOffsetSeconds: -14400
    elapsedHours: 227
    status: EXACT

- id: TZ-03
  input:
    timezone: America/New_York
    timezoneDatabaseVersion: fixture-tzdb-2026a
    requestedStartLocal: "2026-10-26T00:00:00"
  expected:
    startUtc: "2026-10-26T04:00:00Z"
    startOffsetSeconds: -14400
    endExclusiveLocal: "2026-11-04T12:00:00"
    endExclusiveUtc: "2026-11-04T17:00:00Z"
    endOffsetSeconds: -18000
    elapsedHours: 229
    status: EXACT

- id: TZ-04
  input:
    timezone: America/New_York
    timezoneDatabaseVersion: fixture-tzdb-2026a
    requestedLocal: "2026-11-01T01:30:00"
    fold: null
  expected:
    status: REJECTED
    code: AMBIGUOUS_LOCAL_TIME_REQUIRES_FOLD
    resolvedInstantUtc: null

- id: TZ-05
  input:
    timezone: America/New_York
    timezoneDatabaseVersion: fixture-tzdb-2026a
    requestedLocal: "2026-03-08T02:30:00"
    gapAdjustment: null
  expected:
    status: REJECTED
    code: NONEXISTENT_LOCAL_TIME_REQUIRES_GAP_DECISION
    resolvedInstantUtc: null

- id: TZ-06
  input:
    persistedTimezoneDatabaseVersion: fixture-tzdb-2026a
    replayTimezoneDatabaseVersion: fixture-tzdb-2026b
    persistedResolvedInstantUtc: "2026-03-10T16:00:00Z"
  expected:
    status: STALE_OR_INCOMPLETE_PROJECTION
    code: TZDB_VERSION_MISMATCH
    reinterpretPersistedInstant: false

- id: TZ-07
  input:
    timezone: America/New_York
    timezoneDatabaseVersion: fixture-tzdb-2026a
    requestedLocal: "2026-11-01T01:30:00"
    fold: EARLIER_OFFSET
    boundaryDecisionRef: decision-fold-earlier-1
  expected:
    resolvedLocal: "2026-11-01T01:30:00"
    resolvedInstantUtc: "2026-11-01T05:30:00Z"
    utcOffsetSeconds: -14400
    status: EXPLICIT_FOLD_SELECTION

- id: TZ-08
  input:
    timezone: America/New_York
    timezoneDatabaseVersion: fixture-tzdb-2026a
    requestedLocal: "2026-03-08T02:30:00"
    resolvedLocal: "2026-03-08T03:00:00"
    boundaryDecisionRef: decision-gap-forward-1
  expected:
    resolvedInstantUtc: "2026-03-08T07:00:00Z"
    utcOffsetSeconds: -14400
    status: EXPLICIT_GAP_ADJUSTMENT
```

## Calendar Identity Fixtures

```yaml
- id: CAL-01
  input:
    frameId: frame-1
    frameStartLocal: "2026-03-01T00:00:00"
    frameEndExclusiveLocal: "2026-03-10T12:00:00"
    view: WEEK_2026-03-02_TO_2026-03-08
    planVersionId: plan-v3
    blockId: block-4
    plannedSessionId: session-5
    sourceWatermark: [plan-stream-1, 41, 12]
  expected:
    clippedDisplayRange: ["2026-03-02", "2026-03-08"]
    frameId: frame-1
    planVersionId: plan-v3
    blockId: block-4
    plannedSessionId: session-5
    sourceWatermark: [plan-stream-1, 41, 12]
    authoritativeFieldsChanged: []

- id: CAL-02
  input:
    frameHead: [frame-1, 7]
    proposalA: [reanchor-a, expectedHeadRevision=7, successor=frame-2a]
    proposalB: [reanchor-b, expectedHeadRevision=7, successor=frame-2b]
    deterministicCommitOrder: [reanchor-a, reanchor-b]
  expected:
    committedSuccessor: frame-2a
    newHeadRevision: 8
    preservedConflict: reanchor-b
    partialLineageEvents: 0

- id: CAL-03
  input:
    order012Accepted: false
    formationSlots: [DOUBLE, FLEX]
  expected:
    DOUBLE: UNMAPPED_PENDING_UPSTREAM_DEFINITION
    FLEX: UNMAPPED_PENDING_UPSTREAM_DEFINITION
    calendarWrites: 0
```

## Revision And Subscription Fixtures

```yaml
- id: TAB-01
  input:
    aggregateRevision: 7
    safetyEpoch: 3
    authorizationRevocationEpoch: 2
    tabA: [key-a, hash-a, expectedRevision=7, session-1-to-AM]
    tabB: [key-b, hash-b, expectedRevision=7, session-1-to-PM]
    deterministicCommitOrder: [tabA, tabB]
  expected:
    committed: [key-a, revision=8]
    conflict: [key-b, baseRevision=7, payloadHash=hash-b]
    overwrittenPayloads: 0

- id: TAB-02
  input:
    currentRevision: 8
    tabExpectedRevision: 7
    requestHash: hash-c
  expected:
    status: REJECTED_STALE_REVISION
    committedRevision: 8
    mutationCount: 0

- id: TAB-03
  input:
    subscribeAtRevision: 8
    unsubscribeBeforeEvent: true
    event: [stream-1, sequence=10, revision=9]
  expected:
    callbackCount: 0
    queuedMutationCount: 0

- id: TAB-04
  input:
    sameContextCommand: [stream-1, sequence=10, predecessorRevision=8, revision=9]
    crossContextNotification: [stream-1, sequence=10, predecessorRevision=8, revision=9]
  expected:
    snapshotsEqual: true
    visibleRevision: 9
    duplicateMutationCount: 0

- id: TAB-05
  input:
    projectedWatermark: [stream-1, sequence=10, revision=9]
    nextNotification: [stream-1, sequence=12, revision=11]
  expected:
    status: STALE_OR_INCOMPLETE_PROJECTION
    requiredAction: FULL_SNAPSHOT_REFRESH
    applySequence12Directly: false
```

## Offline And Promotion Fixtures

```yaml
- id: OFF-01
  input:
    existingResult: [scope-a, operation-sync, key-1, hash-1, ACKNOWLEDGED]
    retry: [scope-a, operation-sync, key-1, hash-1]
  expected: [ACKNOWLEDGED, sameResult=true, newRecords=0]

- id: OFF-02
  input:
    existingResult: [scope-a, operation-sync, key-1, hash-1]
    retry: [scope-a, operation-sync, key-1, hash-2]
  expected: [REJECTED, REQUEST_HASH_MISMATCH, newRecords=0]

- id: OFF-03
  input:
    items: [item-a, item-b, item-c]
    serverAcknowledged: [item-a, item-c]
    serverFailed: [item-b]
  expected:
    item-a: ACKNOWLEDGED
    item-b: PARTIAL_FAILURE_RETRYABLE
    item-c: ACKNOWLEDGED
    wholeBatchAcknowledged: false

- id: OFF-04
  input:
    deletionEpoch: 5
    offlineMutationDeletionEpoch: 4
    itemId: item-deleted
  expected: [BLOCKED_BY_REVOCATION, resurrected=false, serverWrites=0]

- id: OFF-05
  input:
    authorizationRevocationEpoch: 8
    offlineExpectedAuthorizationRevocationEpoch: 7
  expected: [BLOCKED_BY_REVOCATION, serverWrites=0]

- id: OFF-06
  input:
    localOriginal: [item-1, local-hash]
    serverOriginal: [item-1, server-hash]
    baseHash: base-hash
  expected:
    state: CONFLICT_PRESERVED
    preservedHashes: [local-hash, server-hash]
    automaticWinner: null
    resolutionMutationRequired: true

- id: OFF-07
  input:
    payloadSchemaVersion: "99"
    supportedSchemaVersions: ["1", "2"]
    localOriginalHash: local-hash-99
  expected:
    state: REJECTED_UNSUPPORTED_VERSION
    localOriginalPreserved: true
    projectable: false
    migrationApplied: false
```

## Backend-Neutral Failure Fixtures

```yaml
- id: DB-01
  input:
    transactionSteps: [record, idempotencyResult, audit, outbox]
    failAfter: audit
  expected:
    visibleRecords: []
    committedAggregateRevision: unchanged

- id: DB-02
  input:
    predecessorPlanVersionId: plan-v1
    contenders: [plan-v2a, plan-v2b]
    deterministicCommitOrder: [plan-v2a, plan-v2b]
  expected:
    acceptedSuccessors: [plan-v2a]
    rolledBack: [plan-v2b]

- id: DB-03
  input:
    callerTenant: tenant-a
    referencedTenant: tenant-b
  expected: [REJECTED, SCOPE_MISMATCH, resourceExists=NOT_DISCLOSED]

- id: DB-04
  input:
    formationRuleSetVersion: unsupported-rules-99
    supportedRuleSetVersions: [rules-1]
  expected: [REJECTED_UNSUPPORTED_VERSION, planProjectionCount=0]

- id: DB-05
  input:
    protectedRecordId: record-1
    keyVersion: key-v3
    erasureCommitted: true
    locations: [primary, replica, backup, retry_queue, restored_media]
  expected:
    decryptableLocations: []
    genericAuditEvent: KEY_VERSION_ERASED
    rawContentInAudit: false

- id: DB-06
  input:
    itemId: deleted-1
    deletionEpoch: 5
    backupSnapshotEpoch: 4
    restoreAttempt: true
  expected:
    visibleAfterRestore: false
    promotionAllowed: false
    tombstoneEpoch: 5

- id: DB-07
  input:
    transactionSteps: [frame, lineage, headCAS, audit, outbox]
    failAfterEachStep: true
  expected:
    partialVisibilityForEveryFailurePoint: false
    headRevisionOnFailure: unchanged
```

## Privacy Zero-Signal Fixtures

```yaml
- id: PRIV-01
  inputVariants:
    - privateNote: ABSENT
    - privateNote: "A"
    - privateNote: "B is longer"
  compareExactOutputs:
    - syncRequestBytes
    - hashPreimageBytes
    - conflictMetadataBytes
    - outboxBytes
    - auditBytes
    - telemetryBytes
    - cacheBytes
    - projectionBytes
    - retryBytes
  expected:
    allPairwiseByteIdentical: true
    notePresenceEvents: 0

- id: PRIV-02
  input:
    analyzableTrainingNoteRawText: "raw training note fixture"
    rawSymptomClause: "raw symptom fixture"
    structuredUpstreamOutputAccepted: false
  expected:
    serverPayloadContainsRawText: false
    hashContainsRawText: false
    conflictContainsRawText: false
    outboxContainsRawText: false
    auditContainsRawText: false
    projectionContainsRawText: false
    structuredDerivedOutputEmitted: false
```

## Trace And Pass Rule

- `WO013-T01`: `HASH`, `ID`, `TZ`, and `CAL` fixtures.
- `WO013-T02`: `TAB` and `OFF` fixtures.
- `WO013-T03`: `DB` and `PRIV` fixtures.

PASS requires exact normalized output equality for all 36 fixtures. `UNKNOWN`, reject,
blocked, quarantine, and conflict states are expected successes where declared. These
are contract fixtures only; no fixture claims a current adapter, backend, network,
browser, or production implementation has passed.

[DRAFT_COMPLETE]
