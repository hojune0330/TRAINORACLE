# 0046 Pace Record Release Runbook

## Release numbering correction (2026-10-03)

The historical rehearsal below used the unpublished number 0046. Current main now
owns 0046-0048 for account security. The pace migration is therefore
`supabase/migrations/0049_athlete_record_pace_revision.sql`; half comparison follows
as `0050_oracle_half_distance.sql`. Do not apply or record the pace migration as
0046. Historical preflight filenames/check IDs are retained as evidence, not ledger
versions. Rehearse against current main security migrations before production.

Scope: TRAINORACLE-multi-event-pace-release-20261002 only. Preparation, not deployment authorization.

## Evidence and Prerequisites

- Parent reports production ledger contains 0045, lacks 0046, and does not list 0041-0044. This worker did not access production or inspect secrets.
- 0033/0034 provide journal documents, revisions, deleted state and lifecycle; 0035 provides attested journal, identity and trusted metadata; 0037 provides collection storage/helpers; 0040 introduces the replan wrapper.
- Actual 0043 catalog/calendar wrapper, 0044 collection/replan journalGuard fingerprint binding, and 0045 journal calendar support must be present. Ledger order alone is insufficient. 0041/0042 lounge changes are not prerequisites for 0046; do not bulk-apply them.
- 0046 adds a private revision-check helper and replaces the journal/replan function bodies transactionally. No new columns, tables, login roles, grants or feature activation. It is not an idempotent migration.
- The parent run failed all 4 tests in the before hook at PACE_RECORD_COLLECTION_OPTIONAL_JOURNAL_ANCHOR_MISSING. The stored function retained CRLF while the anchor used LF.
- Fix: normalize CRLF and lone CR to LF in both loaded definitions, without altering other whitespace or anchor checks. The focused local PGlite file subsequently ran **4/4, exit 0** on Node 24.19.0. Its setup forces CRLF and deliberately changes a non-newline anchor, proving rejection and whole-migration rollback before restoring and applying 0046. This is disposable PGlite SQL evidence, not an external PostgreSQL server or production test.

## Read-Only Preflight

Run [0046_pace_record_preflight.sql](0046_pace_record_preflight.sql) only in the separately authorized target SQL session before 0046. It uses BEGIN READ ONLY and ROLLBACK, reads catalog metadata only, and emits booleans rather than function bodies or application rows. No key table, user rows, RPC execution or secret inspection.

Every result must be true; an error, missing output, NULL or false is a stop. It checks function signatures, column types, execution configuration, all nine exact 0046 anchors, and retained 0043-0045 source markers. Its line-ending normalization matches 0046. These are required source-shape checks, not proof of full semantic equivalence or live behavior. Do not run this pre-install gate as a post-install check: helper/capability absence must become false after a successful install.

Local rehearsal also executed this exact preflight: all checks passed against CRLF definitions; a deliberate non-newline anchor change failed only anchor.0046.optional_journal. The final focused run including these assertions remained 4/4, exit 0.

If 0043/0044/0045 definitions differ or are absent, halt for source/ledger reconciliation. Do not fake ledger entries, repair ledger from numbering alone, replay all pending migrations, or apply 0046 over a failed anchor.

## Deployment Order

1. Freeze the reviewed release files and record their revision/hashes. Retain deployable prior artifacts for both Edge Functions. In an approved operator session, checkpoint the actual pre-0046 journal/replan definitions, owner/ACL/configuration and ledger metadata, not secrets or user rows. If no safe checkpoint is available, stop.
2. Run the read-only preflight. Reconcile every failure before proceeding. Avoid concurrent DDL between preflight/checkpoint and migration.
3. Apply only supabase/migrations/0049_athlete_record_pace_revision.sql through the approved migration workflow. Preserve its transaction and record 0049 in the ledger only after successful commit; do not use an unrestricted pending-migration push. If it fails, issue ROLLBACK on that SQL session, confirm prior definitions remain, and stop.
4. Verify catalog-only postconditions: helper exists with SECURITY DEFINER / search_path=pg_catalog; PUBLIC, anon, authenticated and service_role cannot execute it; journal contains athleteRecordSupport and its PLAN revision check; replan contains paceRecordGuard validation. Compare original journal/replan owner, ACL and security settings with the checkpoint. These checks do not call either mutation RPC.
5. Deploy **account-plan-collection first**, then **account-journal**, from the same frozen release and regenerated shared validators. Respect the existing supabase/config.toml verify_jwt=false configuration: handlers perform auth.getUser and use owner-scoped clients. No key rotation, role/grant changes, feature-gate changes or service-role substitution.
6. Only after both deployments succeed, release the corresponding frontend. Any authenticated real-account smoke test/write requires its own approved scope; local 4/4 is not a production verification receipt. If step 5 is partial, do not release the frontend.

## Rollback Order

1. Stop the new frontend rollout first and restore its previous compatible artifact. Already-open clients can remain; if backend rollback is needed, use an approved maintenance/write-stop mechanism before continuing. Do not improvise grants or feature changes.
2. Prefer retaining additive 0046 and forward-fixing the Edge Functions. If no new ATHLETE_RECORDS/pace-bound data was accepted, or compatibility with all accepted new data is established, restore **account-journal first**, then **account-plan-collection**, from the paired saved artifacts. An old validator that rejects accepted new data is not a safe rollback. Unknown compatibility means stop and forward-fix.
3. Keep 0046 installed by default. A hard DB rollback additionally requires stopped writes, no incompatible new clients/data, and the exact pre-install definition checkpoint. In one transaction restore the saved **journal definition**, then saved **replan definition**, then drop public.verify_account_pace_record_revision(uuid,jsonb) with **RESTRICT**, never CASCADE. Preserve/reconcile saved owner/ACL/configuration; commit only after checks pass. On any failure, roll back the transaction.
4. Do not replay whole 0035/0044 migrations as an undo: that can erase 0045 or other deployed behavior. Never delete records, revisions, receipts or indexes to make rollback fit. Record any approved rollback through the established migration/ledger process, not a false success or silent ledger deletion.

## Exact Local Check

From the release checkout, with its independently installed local test dependency:

    & 'C:\Users\admin\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test supabase/tests/local-postgres/athlete-record-pace-revision.test.mjs

The four cases cover atomic single-document revision checks/replay, unrelated-kind rejection, private-helper permissions, and collection revision conflict/replay. No broad app suite, production SQL, deployment, secret inspection or commit was performed by this worker.
