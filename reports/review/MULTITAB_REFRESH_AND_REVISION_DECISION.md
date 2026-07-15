# Multitab Refresh And Revision Decision

```yaml
decision_id: TO-WO013-MULTITAB-2026-07-15
version: 0.2
decision: ABSTRACT_REVISION_AND_EVENT_CONTRACT_ONLY
order_011: NOT_ACCEPTED
order_012: NOT_ACCEPTED
current_app_runtime_evidence: absent
production_adapter: UNSELECTED
backend_transport: UNSELECTED
runtime_authority: false
```

## Decision

The current array-style local storage has no proven atomic compare-and-swap, monotonic
revision, same-context notification, cross-context notification, conflict preservation,
or snapshot subscription contract. It therefore cannot be treated as evidence for
multitab convergence.

The readiness boundary adopts these implementation-neutral requirements only:

1. Every mutation carries expected aggregate revision, safety epoch, authorization
   revocation epoch, source watermark, scoped idempotency key, and request hash.
2. A successful mutation appends one ordered event and advances one aggregate revision.
3. Concurrent writers from the same base yield at most one successor. The losing edit
   remains an immutable conflict candidate; no timestamp or last-writer-wins rule applies.
4. `getSnapshot` and `subscribe` expose the same monotonic revision model to the writing
   context and other contexts. Event gaps require full refresh.
5. A stale context cannot silently rebase or retry. The user-visible workflow must later
   expose refresh/conflict state before another mutation.
6. Unsubscribe and context close cancel callbacks and queued mutations.
7. No network request is required or authorized by this local-phase contract.

## Deferred Architecture Choice

An atomic local adapter, single-writer coordinator, remote store, or other mechanism may
be evaluated only after Orders 011 and 012 are accepted. The candidate must first fail
the published RED fixtures against the current behavior, then pass the exact same CAS,
event, offline, timezone, deletion, key-erasure, tenant-isolation, and privacy fixtures.

This decision does not select an API such as `storage`, `BroadcastChannel`, SharedWorker,
IndexedDB, a service worker, WebSocket, a database, or a cloud provider. Those are later
implementation choices, not contract facts.

[READINESS_ONLY_BLOCKED_ON_011_012]
