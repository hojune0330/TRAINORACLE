# Parallel Fix 3: 0046 Stored Function Line Endings

## Scope And Findings

- Worktree: `TRAINORACLE-multi-event-pace-release-20261002` only.
- Existing dirty/untracked work was retained. On entry, 0046 already normalized
  CRLF and lone CR to LF in both `pg_get_functiondef` results. The test already
  exercised CRLF, exact-anchor drift rejection and transactional rollback.
- The entry-state Node 24.19.0 run passed all four cases. No new SQL change was
  necessary; this continuation preserved the existing migration fix and extended
  its test evidence. Only the owned test and this dedicated report were edited.
- Root cause confirmed by mutation: removing only the two normalization
  statements from an in-memory copy of 0046 reproduces
  `PACE_RECORD_COLLECTION_OPTIONAL_JOURNAL_ANCHOR_MISSING` on CRLF and lone CR.
  The stored multi-line anchor differs from the LF literal before normalization.
- Normalization changes line endings only. Exact text checks and their exceptions
  remain intact. A non-newline spacing change still aborts 0046; no regex or
  whitespace-tolerant anchor was introduced. Helper creation and earlier journal
  replacement are rolled back on failure.

## Verification

Runtime: `C:\Users\admin\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe`, v24.19.0.

Command from the worktree:

```powershell
& 'C:\Users\admin\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test supabase/tests/local-postgres/athlete-record-pace-revision.test.mjs
```

Default fixture line ending is CRLF. Set `PACE_TEST_LINE_ENDING` to `LF` or `CR`
in the test process environment to repeat the other two variants.

| Stored fixture | Cases passed | Exit | Duration |
| --- | --- | --- | --- |
| CRLF | 4/4 | 0 | 3076 ms |
| LF | 4/4 | 0 | 3076 ms |
| CR | 4/4 | 0 | 3478 ms |

Four named cases remain: atomic source revision/retry behavior, unrelated-kind
guard rejection, private-helper access denial, and collection conflict/retry.
The private-helper case additionally rejects forged signatures for both gateways
with SQLSTATE 42501. Before-hook checks prove the preflight accepts each fixture,
rejects exact-anchor drift, and restores original definitions/helper absence
after a failed migration. Mutation uses an in-memory SQL string, not disk edits.

This is disposable PGlite PostgreSQL execution with synthetic users/keys. It is
not a production, external PostgreSQL, CI, browser or release-gate receipt.
Broad application checks were intentionally omitted for this isolated database
regression task. No dependencies were installed, no commits made, no production
connections opened, and no deploys or secret reads performed.

## Minimal Read-Only Production Preflight

Production 0045 present / 0046 absent is user-reported, not verified here.
In a separately authorized operator session, run this metadata-only ledger gate:

```sql
begin read only;
select
  exists(select 1 from supabase_migrations.schema_migrations
    where version = '0045') as ledger_0045_present,
  not exists(select 1 from supabase_migrations.schema_migrations
    where version = '0046') as ledger_0046_absent,
  to_regprocedure('public.verify_account_pace_record_revision(uuid,jsonb)')
    is null as helper_0046_absent;
rollback;
```

Every value must be true; missing tables, permission errors, NULL or false mean
STOP. This short query alone is not an installation gate: ledger entries do not
prove the actual function bodies match. Then run the existing read-only
[exact preflight](0046_pace_record_preflight.sql), unchanged by this worker.
It emits booleans, not function bodies, secrets or application data, and checks
all nine 0046 anchors plus required source markers/signatures/configuration.
All checks must pass. Its successful execution was rehearsed locally for each
line-ending variant. The production ledger query itself was not executed.

## Deployment Sequence (Not Executed)

1. Freeze the reviewed release and obtain separate production authorization.
   Retain previous frontend/Edge artifacts and an authorized metadata-only
   checkpoint of the current journal/replan definitions, owner, ACL and settings.
2. Run both read-only gates above; reconcile missing 0043/0044/0045 behavior
   against actual definitions, not numbering. Do not fabricate ledger entries,
   replay every pending migration, or weaken anchors to force installation.
3. Prevent concurrent DDL and apply only reviewed 0046 through the established
   migration workflow, preserving its transaction. Record ledger success only
   after commit. On any error, ROLLBACK and confirm old definitions remain.
4. Check helper existence, SECURITY DEFINER/search_path configuration, denied
   execution for PUBLIC/anon/authenticated/service_role, preserved gateway
   owner/ACL/settings, and both installed guard paths using catalog metadata.
5. Deploy matching `account-plan-collection`, then `account-journal`; do not
   change auth, grants, feature controls, keys or use service-role substitution.
   Release the matching frontend only after both backend deployments succeed.
6. Keep production authentication/write smoke tests separately authorized and
   report their actual outcomes. Local 4/4 does not establish live completion.

If deployment is partial, withhold the frontend. Prefer leaving additive 0046 in
place and forward-fixing. Backend rollback requires compatibility with any new
records already accepted. A database rollback requires stopped writes and exact
saved definitions; never replay whole old migrations or delete user data to
make an undo fit. The existing [release runbook](PACE_RECORD_0046_RELEASE_RUNBOOK_2026-10-03.md)
contains the detailed rollback sequence and remains unchanged.
