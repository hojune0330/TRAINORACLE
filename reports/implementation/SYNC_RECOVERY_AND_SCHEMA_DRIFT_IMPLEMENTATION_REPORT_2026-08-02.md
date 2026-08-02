# Sync Recovery And Schema Drift Implementation Report

Date: 2026-08-02
Base main: `44d5dc03c946a1aae2f5b1fe61b98c5cb7670271`

## What changed

- Journal sync now checks an authenticated server schema-version action before any journal, private-note, or tombstone query.
- Server versions below `17`, malformed replies, and unavailable version actions fail closed while local journal data remains available.
- Server versions newer than `17` remain compatible.
- Before sync changes local journal shells or tombstones, the app stores a device-local recovery checkpoint.
- A retry restores an interrupted checkpoint, keeps entries and deletions created after the interruption, and then resumes sync.
- A checkpoint from another account, a malformed checkpoint, or a checkpoint containing private memo plaintext is rejected.
- The checkpoint is cleared only after the full pull, merge, push, and delete propagation sequence succeeds.
- The previous monolithic sync module is split into preview, execution, guard, recovery, and result-type modules; every production TypeScript file in this slice stays below 200 lines.

## Privacy boundary

The checkpoint contains journal shells and deletion identifiers already eligible for local journal storage. It does not contain decrypted private memo text. It remains on the user's device and is never included in analytics or remote payloads.

## Database contract

Migration `0017_sync_schema_version.sql` adds an internal `JOURNAL_SYNC` contract version and the authenticated `get_sync_schema_version()` action. Direct table access is revoked. Reapplying an older migration cannot lower the recorded version.

This migration is committed to the repository only. It has not been applied to a production Supabase project in this task. Account and sync public feature flags remain off, so the public app continues to operate as a local journal.

## Verification

- PIN: existing sync characterization `37/37` passed before implementation.
- RED: missing recovery module, missing migration, old-server acceptance, and interrupted-sync cases failed before implementation.
- GREEN: focused sync, recovery, schema, session, and panel tests passed.
- Full app unit suite: `640/640` passed.
- App and browser TypeScript checks passed.
- Production build passed.
- Repository contract tests, D9 evaluator, and implementation tests passed.
- Browser suite: `189` passed, `39` viewport-conditional scenarios skipped, `0` failed across desktop, mobile, 320px, and reduced-motion projects.
- Hostile schema mutations are rejected for version downgrade, downgrade-guard removal, direct-table access, anonymous action access, and missing authentication.

## Honest limit

This is durable device-local recovery and retry convergence, not a single database transaction spanning browser storage and Supabase. Production activation still requires applying migrations in order, configuring Supabase, and deliberately enabling the account and sync feature flags.
