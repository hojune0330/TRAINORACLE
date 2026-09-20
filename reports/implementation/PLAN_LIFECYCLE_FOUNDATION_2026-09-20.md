# Plan Lifecycle Foundation - 2026-09-20

## Status and Scope

- Status: LOCAL_FOUNDATION_TESTED, NOT_CONNECTED, NOT_PRODUCTION_ENABLED.
- This is executable server-side transition validation, not a working service deletion feature.
- Only the following new files belong to this work:
  - `supabase/functions/_shared/account-plan-lifecycle.mjs`
  - `supabase/tests/account-plan-lifecycle.test.mjs`
  - `reports/implementation/PLAN_LIFECYCLE_FOUNDATION_2026-09-20.md`
- The foundation itself changes no shared schema, generated validator, handler, SQL, UI or outbox. The integrator added its focused test command to the existing CI contract job; this does not enable the feature.
- No database connection, production access, personal data, credentials, commit or push.
- Concurrent UI/test/style edits appeared in the shared worktree and were left untouched.

## Inspected Boundaries

The implementation was informed by these current local sources, not prior rollout status:

- `specs/reconstruct/PLAN_DELETION_AND_RESTORE_IMPLEMENTATION_CONTRACT.md`: draft, non-production; owner/plan/revision/operation binding, server time, 30-day recovery, archive-only restore and journal preservation.
- `app/src/domain/account/account-plan-collection-schema.ts`: strict existing wire shapes, owner-neutral hashes, immutable snapshots and archived entries; deletion cannot be enabled by relaxing history validation.
- `supabase/functions/_shared/account-plan-collection-handler.mjs`: authenticated owner, receipt-before-CAS replay, request binding, attested repository mutation.
- `supabase/migrations/0037_account_plan_collection.sql`: owner-scoped keys, owner advisory transaction lock, CAS and exact receipt binding; only `planStage`/`planCommit`, no lifecycle actions.
- `supabase/tests/account-plan-collection-handler.test.mjs`: existing node:test conventions and in-memory fault-injection approach.

The lifecycle module does not import or weaken those files. Existing SQL requires archiving the previous current entry when switching the pointer; this foundation intentionally does not pretend a lifecycle proposal can already pass that path.

## Internal API

`proposeAccountPlanLifecycleTransition(input: unknown)` accepts exactly:

- `authenticatedOwnerId`: verified server authentication context, never a body assertion.
- `serverNow`: canonical UTC ISO timestamp with milliseconds, supplied by a trusted server clock.
- `state`: authoritative owner-scoped metadata, read under the future transaction lock.
- `request`: exact version/action/ownerId/planId/expectedRevision/operationId tuple.
- `priorReceipt`: authoritative owner+operation lookup result, explicitly `null` only if absent.

This is an internal version-1 foundation shape, NOT an adopted client/server wire version or migration. Metadata state contains `version`, `ownerId`, collection `revision`, server `updatedAt`, `currentPlanId`, and at most 100 plan metadata records. A record contains only `planId`, `status`, `deletedAt`, `restoredAt`. Statuses are `AVAILABLE`, `ARCHIVED`, `DELETED`; AVAILABLE does not imply current selection or execution authority. Initial metadata must be built from verified existing owner data by a future adapter, not from a client claim.

The module accepts no snapshot, progress or journal payload. It neither rewrites nor deletes original plan IDs, immutable snapshots, receipts, progress, diary links, records or lineage. Lifecycle ARCHIVED is separate metadata: this module does not alter a stored progress part's `archivedAt`.

Results:

- `proposed`: detached `nextState` and receipt to commit together, NOT a server storage acknowledgement.
- `replay`: historical receipt only; no state patch to apply again.
- `rejected`: fixed error code without raw input or personal data.

The receipt retains the complete exact request tuple instead of inventing a new fingerprint scheme. Property ordering is irrelevant, field values are exact, unknown fields are rejected. Persistence must protect and authenticate receipts; structural validation is not cryptographic authenticity. Owner-neutral content hashes are identifiers, never proof of ownership or authorization.

## Enforced Semantics

- Owner/request/state binding is checked before replay. Foreign-owner receipts are invalid even for identical plan hashes.
- Only an exact prior request can replay. Action, plan, revision or operation changes cannot consume that receipt. Replay occurs before stale-revision and restoration-expiry checks; it never reapplies historical state.
- Fresh DELETE/RESTORE require the current collection revision. Successful proposals increment once. Duplicate deletion with a fresh operation is rejected, not silently acknowledged.
- DELETE timestamps the tombstone using serverNow and clears currentPlanId only when it points to the deleted plan. Other active pointers are preserved.
- RESTORE preserves deletedAt, records restoredAt, yields ARCHIVED and preserves the current pointer, including null. It cannot reactivate the restored plan.
- Restore interval is `[deletedAt, deletedAt + 2,592,000,000ms)`. The exact 30-day deadline is expired; this is elapsed time, not local calendar-month arithmetic. No cleanup operation is implemented.
- Clock rollback before the last committed metadata time fails closed. Invalid dates, normalized impossible dates, missing milliseconds, offsets and client-injected timestamps fail closed. The caller must actually provide server time; a pure function cannot authenticate a clock string.
- Safe integer revisions, unique bounded records, pointer/status consistency, strict keys, plain data objects, accessor/symbol rejection and receipt/result consistency are checked.
- Latest-revision receipts must match current metadata; historical receipts are returned only and are not treated as current state.

`validateAccountPlanLifecycleWrite(input: unknown)` checks SELECT/PROGRESS against the same authenticated owner, authoritative collection revision and plan metadata. Missing, deleted, archived or stale targets are rejected. Success is `eligible`, not an authorization or persistence result. Restored archived entries remain blocked for direct SELECT/PROGRESS under existing immutability rules; a separately reviewed reselection/safety path is still required. This primitive does not validate progress contents, implement write idempotency or grant execution authority.

## Verification

The integrator moved the test to the existing `supabase/tests` convention and independently reran it:

```text
node --test supabase/tests/account-plan-lifecycle.test.mjs
tests 18; pass 18; fail 0; cancelled 0; skipped 0; todo 0
```

Tests use synthetic owner/plan/operation IDs, a sequential fake server and an injected clock. Coverage includes delete/current-pointer behavior, stale DELETE/RESTORE, exact replay after lost response/expiry/later writes, operation reuse, cross-owner attempts, restore-only-to-archive, new active selection races, before/at/after expiry, stale SELECT/PROGRESS, timestamp corruption/rollback, unknown inputs, invalid receipts and revision bounds.

Six named in-memory fault probes alter owner comparison, request binding, stale-write comparison, exact expiry boundary, deletion pointer clearing and restore pointer preservation. Each altered module triggers the intended behavioral assertion failure; the test asserts that failure. Disk source and shared files are not modified for these probes.

This is focused critical-path development verification. No full suite, UI test, SQL integration test, CI release gate, deployment or live verification was run or claimed. Fake sequential server results do not establish multi-process/database atomicity.

## Remaining Integration Work

1. Adopt a lifecycle wire/metadata version and migration strategy with both client and server validators. Preserve the original documents and existing V2-V6 plan payloads. Do not simply loosen immutable-history validation.
2. Implement an actual owner-authenticated DB transaction using the existing account owner lock domain. Recheck consent, authentication/attestation, collection CAS and server time after locking; atomically persist tombstone/archive metadata, current pointer, collection revision and exact receipt. Handle rollback, lost response and duplicate-operation races.
3. Use authoritative owner+operation receipt lookup and a shared operation namespace across lifecycle and existing writes. Persist the full exact request binding. Null must mean confirmed absence, not lookup failure. Do not garbage-collect receipts/tombstones in a way that allows old operations or outboxes to reappear.
4. Guard all SELECT/PROGRESS/commit, legacy, backup, hydration and outbox paths inside the transaction. An in-process check before a later write is insufficient. The new primitive currently protects no existing runtime path because nothing imports it.
5. Resolve lifecycle/collection indexing and encrypted metadata integration without modifying snapshot/progress payloads. Current SQL pointer/history checks are deliberately unchanged. The 100-record bound mirrors current collection capacity, not an approved tombstone retention policy; exceedance rejects rather than evicts. Long-lived tombstone storage needs a separately reviewed design.
6. Connect account services, encrypted outbox, receipt recovery, history/trash reads and UI only after the server path is complete. Unsupported clients must fail closed/read-only. Archive restore is not permission to run the plan; explicit reselection must reapply existing safety/validity checks.
7. Implement separately reviewed cleanup based on server deletion time, protecting pending restores, unresolved conflicts and minimal tombstones. Preserve journal/race records, references and successor lineage; block new derivation from deleted originals.
8. Run real transaction/concurrency/rollback and compatibility tests, then obtain the separate merge/deploy/production approval. None of the four open deletion/restore contract issues is closed by this foundation.
