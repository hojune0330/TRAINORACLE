# Closed lounge identity closure operator

This is a **prepare-only** operator for the exact existing project
`texspxlpjungyarkvtkc`. It has no network client, native DB DSN, password prompt,
secret loader, production apply command, public activation or health-storage
approval. Root reviews its output and may submit it through the existing official
`supabase_apply_migration` connector only after the separate operational gates.

## Source and history

- The accepted sparse provider baseline is 48 receipts: original 45 versions plus
  the already-applied timestamped `0041`, `0042`, and `0063` receipts.
- The nine exact, hash-pinned additions are `0039`, `0051`, `0053`–`0058`, and
  **`0065_lounge_grant_auth_channel_recheck`**.
- Upstream `0064_minigame_progress_account_storage.sql` is retained and not
  activated by this closure. Only the previously unapplied lounge migration was
  renumbered, with its body bytes preserved, after upstream reserved 0064.
- Existing migration rows are never rewritten/deleted. Nine individually named
  receipts are appended inside the same DO as their source changes. The API may
  separately add its auto-timestamped bundle receipt. Postcheck both; do not
  remove a real provider receipt to make the counts appear neat.

## Prepare and review

1. Import `INVENTORY_SQL` from `lounge-closure-operator.mjs`. Root submits this
   read-only metadata query to the project above. It returns ledger/function/ACL/
   schema hashes (including the migration ledger's schema/ACLs/triggers) and
   non-secret gate states, **not** SQL bodies or user records.
2. Independently review the baseline metadata and retain its
   `snapshotHash(inventory.snapshot)` fingerprint as a review receipt. Pass both
   to `planClosure(inventory, reviewedSnapshotSha256)`. The operator rejects a
   wrong project, non-48 history, changed names, hashes differing from that
   independently reviewed fingerprint, empty/duplicate function fingerprints,
   unsafe DO delimiters, partial prior closure, version collisions, changed source
   bodies, enabled lounge/legal binding, or an already configured auth release.
   The hash of a fresh, unreviewed capture is not independent approval; it checks
   capture-to-execution drift but does not prove the historical SQL was correct.
3. Independently verify the ciphertext backup, disk readback, its no-credentials
   scope, and **actual isolated app-record restore**. A decrypt/scope pass is not
   a restore pass. The backup excludes Auth credentials/session DATA and does not
   establish full Supabase/Auth disaster recovery or cross-PC DPAPI recovery.
4. Choose the real quiescence path. `IN_TRANSACTION_TABLE_LOCKS` explicitly sets
   `operatorWritesQuiesced:false` before application: it does not claim a prior
   external drain. The SQL instead acquires and verifies write-blocking locks on
   every existing ordinary/partitioned public table before any source change.
   `EXTERNAL_DRAIN` with `operatorWritesQuiesced:true` requires independent actual
   application/provider/retention drain evidence; UI switches alone are not proof.
   Both paths retain the same DB lock guards. Bind the reviewed recovery receipt to
   `plan.snapshotSha256`. `createMcpRequest()` requires the separate evidence
   assertions below; supplying booleans does not manufacture their evidence.
5. Root reviews `request.query` and submits exactly that request via MCP. This
   module never does so itself. No secrets belong in the SQL or receipt.

Evidence shape (values below are descriptions, not an approved receipt):

```js
{
  projectRef: 'texspxlpjungyarkvtkc',
  scope: 'TRAINORACLE_ENCRYPTED_APP_RECORDS',
  encrypted: true,
  plaintextFiles: false,
  privateRowsPrinted: false,
  ciphertextIntegrityVerified: true,         // actual independent receipt
  isolatedAppRecordsRestoreVerified: true,   // actual restore, not decrypt-only
  ciphertextSha256: '<ciphertext archive SHA256>',
  metadataSnapshotSha256: '<plan.snapshotSha256>',
  quiescenceMode: 'IN_TRANSACTION_TABLE_LOCKS',
  operatorWritesQuiesced: false,             // no invented pre-drain claim
  publicActivationApproved: false            // this request remains closed
}
```

`createMcpRequest(plan,evidence)` returns exactly
`{project_id,name,query}` for the official tool. Its bundle name is
`lounge_identity_closure_0039_0065_atomic`. `summarizePlan(plan)` is safe to print;
do not print backup contents, wrapped provider errors or configuration values.

The optional CLI reads explicitly provided metadata/evidence JSON files and
prints only the selected preparation format. It writes no files and performs no
network/DB operations:

```text
node supabase/operations/lounge-closure-operator.mjs --inventory=<metadata.json> --reviewed-snapshot-sha256=<independently-reviewed-metadata-SHA256>
node supabase/operations/lounge-closure-operator.mjs --inventory=<metadata.json> --reviewed-snapshot-sha256=<independently-reviewed-metadata-SHA256> --evidence=<reviewed-receipt.json> --format=mcp
```

## Atomicity and bounded execution

The request has one DO owner inside an explicit transaction, with transaction-
local lock timeout 10s, statement timeout 120s and idle timeout 180s. It serializes
operators, locks migration history, enumerates public table metadata in stable
OID order, and takes SHARE ROW EXCLUSIVE locks before comparing the exact captured
inventory. A non-READ-COMMITTED transaction is rejected before any lock/source
change, rather than treating a frozen snapshot as fresh drained metadata.
These locks wait for existing writers and block new writes until the
transaction ends. The unchanged OID/name catalog and `pg_locks` coverage for this
backend/database are verified before any of the nine source bodies. Foreign
tables and public-parent descendants outside the supported public r/p scope,
changed coverage/catalog, insufficient privileges or a lock timeout fail
closed; no table DATA or gateway key is read for this check. Ordinary SELECTs can
usually continue, but later ALTER TABLE can require stronger locks. This is not
a zero-downtime promise, an Auth pause, or proof that external provider queues
have stopped. Commit/rollback releases the DB locks. Only the exact known outer
BEGIN/COMMIT wrappers are stripped; a
SQL-aware scanner rejects hidden top-level transaction controls without altering
PL/pgSQL function bodies.

After 0057 and before 0058, the new consent/review tables must still be empty.
Other transactions cannot see these new objects before the one transaction
commits. The unchanged 0058 adoption loop therefore has no preexisting withdrawal
to erase. Source, individual receipts, closed gates, zero new storage reviews,
minimal privileges and capabilities are checked before COMMIT. Any exception
rolls back the whole prepared transaction. Source 0039 can still take table locks
and populate connection metadata; this is not a zero-downtime promise.
Original feature switches are compared exactly after excluding only the new
closed AUTH switches. Existing ACCOUNT/SYNC/ACCOUNT_JOURNAL_V2 values are not
turned off or represented as newly enabled by this closure.

`node supabase/operations/rehearse-closure-table-locks.mjs --synthetic-loopback`
uses the installed PostgreSQL 17 binaries with a new disposable DATA directory,
scrubbed connection environment and localhost-only listener. It does not open
the installed/production cluster. It exercises a real second writer, bounded
lock timeout, whole-transaction rollback, then drain and successful closure.
Its synthetic local receipt is not a provider or backup-restore receipt.

Post-call, use `verificationSql()` and `INVENTORY_SQL` to inspect real receipts
and metadata. A timeout or uncertain API result must not trigger blind replay.
Keep the service closed, inspect whether the DB and provider bundle receipt
committed, then choose a reviewed roll-forward. Never erase migration history,
undo a real withdrawal, restore withdrawn data into active use, or reopen legacy
unsafe auth just because a newer component failed.

## Validation boundary

Focused disposable PGlite tests replay the unchanged sparse 48-file source
baseline, preserve two synthetic journals, execute the actual generated SQL,
inject early/late failures, hash drift and a withdrawal between 0057/58, and
prove named purpose-erasure failure under a deliberately omitted guard. No
actual account, production row, URL, credential or network is used.

```text
node --test supabase/operations/lounge-closure-operator.test.mjs
node --test supabase/tests/local-postgres/lounge-grant-auth-channel.test.mjs
```

The maintained `supabase/tests/local-postgres/package.json` test script includes
`../../operations/lounge-closure-operator.test.mjs`, so the existing contract CI
entry also runs these guards. No workflow or dependency lockfile is changed.

These local checks do not prove the live Management API's additional receipt
transaction boundary, actual isolated backup restore, hosted auth, worker
configuration, release CI, provider application or the two-app public cutover.
