# Calendar Version And Sync Contract

```yaml
spec_id: CALENDAR_VERSION_AND_SYNC_CONTRACT
version: 0.2
status: READINESS_DRAFT_BLOCKED_ON_011_012
runtime_authority: false
backend_choice: none
schema_migration_authority: false
```

## Authority Boundary

This is an infrastructure-neutral readiness contract. Orders 011 and 012 are not
accepted. Nothing here selects a database, transport, cloud, account system, local
adapter, production schema, or migration. It does not authorize sync, calendar writes,
plan execution, Formation activation, raw-note transfer, or runtime claims.

## Typed Identity And Version Envelope

All IDs are opaque, stable, non-empty strings. They are scoped; an ID from another
tenant, group, or athlete is rejected without revealing whether it exists.

```yaml
CalendarProjectionIdentity:
  tenantId: string
  groupId: string
  athleteId: string
  planGenerationRunId: string
  planVersionId: string
  planVersionNumber: positive_integer
  planContentHash: CanonicalContentHash
  frameId: string
  frameContentHash: CanonicalContentHash
  frameHeadRevision: nonnegative_integer
  blockId: string
  blockPredecessorId: string_or_null
  plannedSessionId: string
  plannedSessionPredecessorId: string_or_null
  completedSessionRecordId: string_or_null
  experiencedResponseRecordId: string_or_null
  formationRuleSetVersion: string
  ruleSpecVersion: string
  sourceSchemaVersion: string
  projectionSchemaVersion: string
  timezone: IANA_TIMEZONE
  timezoneDatabaseVersion: string
  frameStartBoundary: LocalCivilBoundaryResolution
  frameEndExclusiveBoundary: LocalCivilBoundaryResolution
  projectionRevision: nonnegative_integer
  sourceWatermark: SourceWatermark

LocalCivilBoundaryResolution:
  requestedLocalDateTime: ISO_LOCAL_DATETIME
  resolvedLocalDateTime: ISO_LOCAL_DATETIME
  resolvedInstantUtc: ISO_DATETIME
  utcOffsetSeconds: integer
  fold: NOT_AMBIGUOUS | EARLIER_OFFSET | LATER_OFFSET
  resolution: EXACT | EXPLICIT_FOLD_SELECTION | EXPLICIT_GAP_ADJUSTMENT
  boundaryDecisionRef: string_or_null

SourceWatermark:
  streamId: string
  eventSequence: nonnegative_integer
  aggregateRevision: nonnegative_integer
  observedAt: ISO_DATETIME
```

`sourceWatermark` means the highest contiguous accepted event sequence projected for
that stream. It is not wall-clock freshness, a safety clearance, or permission to skip
events. A gap, regression, different stream, or revision/sequence mismatch produces
`STALE_OR_INCOMPLETE_PROJECTION` and requires refresh or review.

Planned, completed, and experienced facts are separate immutable records. Completion
and response records reference the exact accepted `planVersionId` and
`plannedSessionId`; scope or version mismatch rejects the binding. An edit creates a
successor plan/session record with a predecessor reference. It never rewrites an
accepted plan, completed record, experienced response, or earlier calendar projection.

## Canonical Hash Contract

```yaml
CanonicalContentHash:
  algorithm: SHA-256
  digestEncoding: lowercase_hex_64
  serialization: RFC_8785_JSON_CANONICALIZATION_SCHEME
  textNormalizationBeforeSerialization: Unicode_NFC
  numbers: finite_JSON_numbers_only_no_negative_zero
  nullVersusOmitted: schema_declared_never_interchangeable
  defaults: materialized_by_the_versioned_schema_before_JCS
  units: canonical_units_only
  arrays: preserve_input_order
  objectPropertyNames: RFC_8785_UTF16_code_unit_lexicographic_order
  localTime: persisted_resolved_boundaries_and_timezone_database_version
  replay: never_re_resolve_timezone_or_defaults

CalendarProjectionHashEnvelope:
  domainTag: TRAINORACLE_CALENDAR_PROJECTION_V1
  projectionSchemaVersion: string
  sourceSchemaVersion: string
  formationRuleSetVersion: string
  ruleSpecVersion: string
  scope: tenantId_groupId_athleteId
  planGenerationRunId: string
  planVersionId: string
  planContentHash: CanonicalContentHash
  frameId: string
  frameContentHash: CanonicalContentHash
  blockId: string
  plannedSessionId: string
  boundaryDocument: persisted_LocalCivilBoundaryResolution_pair
  sourceWatermark: SourceWatermark
  projectionDocument: canonical_non_private_projection_fields
```

Private text, private-note presence, analyzable-note raw text, symptom clauses,
unstable display copy, current wall time, and adapter-specific metadata are forbidden in
the preimage. Every other hash domain uses a different fixed domain tag. A missing,
unknown, substituted, or unsupported version is rejected; no convenient default is
inserted.

The versioned schema materializes declared defaults and normalizes eligible strings to
NFC before the value is passed to RFC 8785 JCS. JCS then preserves array order and sorts
object property names lexicographically by UTF-16 code units. UTF-8 byte ordering is not
used to sort object properties. A schema that does not define its defaults and array
order is not hashable under this contract.

## Local-Civil Time And Projection

- A 9.5-day frame is local-civil `9 calendar days + 12 hours`, not fixed UTC 228
  hours. Both start and end-exclusive resolutions persist their IANA zone and tzdb
  version.
- Missing timezone or tzdb version is rejected. An ambiguous time is rejected until an
  explicit `EARLIER_OFFSET` or `LATER_OFFSET` fold decision is persisted. A nonexistent
  time is rejected until an explicit gap-adjustment decision and resolved time are
  persisted.
- Replay uses persisted resolved instants and tzdb identity. It never silently
  reinterprets an accepted frame under a newer timezone database.
- Existing frames retain their resolved boundary and tzdb identity after profile
  changes. A timezone or race-anchor change creates a re-anchor proposal and append-only
  lineage event; the old frame remains historical.
- A seven-day view may clip or repeat a visual projection, but it retains frame, block,
  plan-version, planned-session, boundary, hash, and watermark identity.
- `AM` and `PM` are candidate crosswalks. `DOUBLE` and `FLEX` remain
  `UNMAPPED_PENDING_UPSTREAM_DEFINITION`; no `FULL_DAY`, `UNSPECIFIED`, or guessed
  mapping is allowed before Order 012 acceptance.

## Revision, CAS, And Multitab Events

```yaml
RevisionedMutation:
  scope: tenantId_groupId_athleteId
  operation: string
  idempotencyKey: string
  requestHash: CanonicalContentHash
  expectedAggregateRevision: nonnegative_integer
  expectedSafetyEpoch: nonnegative_integer
  expectedAuthorizationRevocationEpoch: nonnegative_integer
  expectedSourceWatermark: SourceWatermark
  actorCapabilityRef: string
  payload: canonical_non_private_mutation

RevisionEvent:
  eventSource: SAME_CONTEXT_COMMAND | CROSS_CONTEXT_NOTIFICATION | FUTURE_REMOTE_PROMOTION
  streamId: string
  eventId: string
  eventSequence: nonnegative_integer
  predecessorAggregateRevision: nonnegative_integer
  committedAggregateRevision: nonnegative_integer
  requestHash: CanonicalContentHash
  projectionWatermark: SourceWatermark
```

Every write compare-and-swaps the exact revision, safety epoch, authorization revocation
epoch, and source watermark. Revisions and per-stream event sequences increase
monotonically. Two writes from one base revision can produce at most one successor. The
loser is preserved as a conflict candidate; last-writer-wins, timestamp arbitration,
silent merge, and silent retry are forbidden.

The subscription interface provides `getSnapshot`, `subscribe`, event source, monotonic
revision, stale state, update notice, and unsubscribe. Same-context commands and
cross-context notifications both publish a revision event. A sequence gap forces a full
snapshot refresh. A stale tab cannot write until it refreshes and explicitly retries.
After unsubscribe or context close, no callback or queued mutation may execute.

This contract does not claim current array-style `localStorage` can provide atomic CAS.
A later implementation must choose an adapter or single-writer coordinator that passes
the same fixtures; this document does not choose one.

## Offline State Machine And Conflict Preservation

```yaml
OfflinePromotionState:
  LOCAL_COMMITTED:
    mayTransitionTo: [PROMOTION_PENDING, BLOCKED_BY_REVOCATION]
  PROMOTION_PENDING:
    mayTransitionTo: [ACKNOWLEDGED, CONFLICT_PRESERVED, REJECTED_STALE_REVISION,
      REJECTED_UNSUPPORTED_VERSION, BLOCKED_BY_REVOCATION, PARTIAL_FAILURE_RETRYABLE]
  PARTIAL_FAILURE_RETRYABLE:
    mayTransitionTo: [PROMOTION_PENDING, BLOCKED_BY_REVOCATION]
  REJECTED_STALE_REVISION:
    mayTransitionTo: [CONFLICT_PRESERVED]
  CONFLICT_PRESERVED:
    mayTransitionTo: [LOCAL_COMMITTED]
  REJECTED_UNSUPPORTED_VERSION:
    terminalUntilSupportedMigration: true
  BLOCKED_BY_REVOCATION:
    serverPromotionTerminal: true
  ACKNOWLEDGED:
    terminalForThatOperation: true
```

The same scoped idempotency key and request hash returns the existing committed result;
the same key with another hash is rejected. Partial batch acknowledgement changes only
the acknowledged items. Local originals remain until durable acknowledgement. Conflict
resolution is a new authorized mutation referencing both immutable originals and their
hashes; neither original is overwritten. Device/server divergence is visible and
preserves both sides until that resolution commits.

Deletion tombstones and authorization/consent revocation epochs block stale offline,
outbox, replica, retry, and restore operations from resurrecting or promoting data. The
exact local deletion/retention consequence remains blocked on Order 011; revocation is
not permission to silently erase the athlete's only local copy. Unsupported versions
remain quarantined and non-projectable until an accepted migration exists.

## Privacy Zero-Signal Boundary

`PRIVATE_SELF_ONLY` note absence, presence, text A, and text B must yield byte-identical
sync request, hash preimage, conflict metadata, outbox, audit, telemetry, cache,
projection, retry, and backend fixture outputs. No presence bit, length, timestamp,
reason, error shape, correlation key, or processing event may differ.

Raw `ANALYZABLE_TRAINING_NOTE` text and raw symptom clauses also never enter server
payloads, hashes, conflicts, outbox, audit, telemetry, cache, replica, or projection.
Only a separately accepted upstream structured output may be considered later; this
contract grants none. An owner-confirmed local backup is a separate local export path,
not sync or sharing authority.

## Backend-Neutral Requirements

Atomic record/outbox/idempotency commit, unique successor and event-sequence constraints,
tenant isolation, least privilege, rollback, itemized retry, deletion propagation, key
erasure, backup/restore deletion enforcement, and unsupported-version rejection are
required. Key erasure means the erased version can no longer decrypt protected content
from primary storage, replicas, backups, retry queues, or restored media. The audit keeps
only a generic, non-sensitive erasure event. No database, cloud, account, key manager,
transport, or migration is selected here.

## Calendar Edit Authority

Drag/drop and manual edits are proposals. Only a later accepted validation and human
decision workflow may append a successor accepted plan. Calendar display never mutates
the real plan, rewrites a race anchor, releases a hold, or executes a session by itself.

[DRAFT_COMPLETE]
