# Account Journal Draft Gateway Deployment Runbook

Status: REVIEWABLE DRAFT GATEWAY; NOT PRODUCTION READY; DO NOT ACTIVATE.

This document is an operator checklist, not authorization to change a remote
project, provision secrets, deploy, enable flags, or collect real journal content.
No deployment, secret provisioning, or live verification was performed to write it.
PR #320 is an OPEN dependency, as reported by the parent task. Its remote state
has not been verified here; do not treat it as merged or deployed.

## 1. Authority And Scope

Read `AGENTS.md`, `PRODUCT_NORTH_STAR.md`, and
`ACCOUNT_CANONICAL_STORAGE_IMPLEMENTATION_PLAN.md` before operating this path.
The owner-approved storage exception does not authorize journal text in logs,
telemetry, model context, analytics, coach views, or sharing.

This gateway is standalone DRAFT storage and owner retrieval only. It does not
implement final journal completion, statistics, rewards, plan recovery, stickers,
legacy vault migration, full account synchronization, deletion, or retention.
Service-managed encryption is NOT end-to-end encryption: the service can decrypt.
Both PRIVATE and PERSONAL drafts remain owner-only through this gateway.

**Production blocker: the approved 30-day revision/trash retention workflow is
NOT implemented.** Migration 0033 stores the latest document plus operation
proposals/receipts; that is not a 30-day history, trash, expiry, or restore system.
There is no implemented automatic expiry or deletion path here. Do not advertise
30-day recovery or silently prune operation rows to imitate it. Unresolved
conflicts and idempotency receipts need separately reviewed lifecycle rules.

## 2. Dependencies And OFF Baseline

- Review and resolve the OPEN PR #320 dependency before any release decision.
  Record the reviewed commit, merge state, migration state, and test evidence.
- Migration `0033_account_journal_revision_foundation.sql` depends on the earlier
  account, legal/age eligibility, and service-feature migrations. Apply the
  reviewed migration chain only through a separately approved deployment plan.
- 0033 inserts `ACCOUNT_JOURNAL_V2 = false`. Its `ON CONFLICT DO NOTHING` does not
  switch an already-enabled project back off. Verify the actual target value.
- Keep server `ACCOUNT_JOURNAL_V2` OFF and frontend
  `VITE_FEATURE_ACCOUNT_JOURNAL` absent or `false`. For explicit UI suppression,
  set `VITE_KILL_ACCOUNT_JOURNAL=true` in the approved build configuration.
- Frontend flags are build-time visibility controls, not authorization. Hiding the
  panel does not stop direct requests. Server RPC/RLS gates are authoritative.
- `ACCOUNT`, `ACCOUNT_JOURNAL_V2`, and authenticated account eligibility must all
  pass. Do not enable the global ACCOUNT gate merely to test this feature.
- Never use a service-role client for this gateway. The SDK client uses the
  verified user's bearer token for all database operations.

## 3. Runtime Configuration

| Variable | Requirement |
| --- | --- |
| `SUPABASE_URL` | Approved target project URL; never infer production from a local link. |
| `SUPABASE_ANON_KEY` | Target project's anon key used with the user's JWT; not a service-role key. |
| `TRAINORACLE_JOURNAL_ALLOWED_ORIGINS` | Comma-separated exact http(s) origins; no wildcard, paths, or trailing slash. |
| `TRAINORACLE_JOURNAL_KEYRING_JSON` | Server-only keyring injected by an authorized operator. |

Keyring shape, deliberately nonfunctional placeholders:

```json
{
  "activeKeyId": "journal-key-version-placeholder",
  "keys": {
    "journal-key-version-placeholder": "<BASE64_OF_EXACTLY_32_RANDOM_BYTES>"
  }
}
```

Generate each key with an approved cryptographically secure generator in the
operator's secret-management environment. Use a unique, nonsemantic key ID of
1-80 characters. Base64 must encode exactly 32 bytes in canonical form. Never
derive this key from a password, user token, document, or public identifier.

Inject the JSON through the approved secret-management workflow. Do not put real
values in source, chat, fixtures, command arguments/history, build variables,
screenshots, or logs. Do not create a frontend `VITE_` variant of the keyring.
Restrict secret read/change permissions and record metadata-only change evidence.

The handler retrieves key material only after authentication and access checks.
It imports nonextractable AES-256-GCM CryptoKeys at runtime. Nonextractability of
those objects does not protect the source secret from a compromised server.
Missing/malformed keys fail with generic 503; status must not claim ready.
Disable request/response body capture in platform logs, proxies, and tracing.
The handler's lack of logging alone does not prove infrastructure privacy.

## 4. Review And Deploy Without Activation

1. Obtain explicit authorization for the exact target and external deployment.
   Resolve PR #320 and inspect its resulting source/migrations first.
2. Verify the target project's migration ledger and server OFF state. A deployed
   function or successful migration is not permission to enable the feature.
3. Run the synthetic Node checks from the repository root:

   ```text
   node --test supabase/tests/account-journal-handler.test.mjs supabase/tests/account-journal-crypto.test.mjs
   ```

4. Run the parent's buffer/API/UI regression suite against the same commit.
   Run Deno type checks and local Supabase Edge Runtime integration checks using
   the approved installed toolchain. Node tests do not validate a deployed edge
   bundle or live RLS/authentication. Do not download tools implicitly.
5. Provision approved server configuration without exposing values. Verify that
   the official `npm:@supabase/supabase-js@2.109.0` import resolves in the target
   Edge Runtime and that both shared MJS modules are included in the bundle.
6. After target and CLI-version verification, an authorized operator may deploy
   only `account-journal`. Illustrative operator command, NOT executed here:

   ```text
   supabase functions deploy account-journal --project-ref <APPROVED_PROJECT_REF>
   ```

7. Preserve `[functions.account-journal] verify_jwt = false` from config. The
   function explicitly verifies the bearer with server `auth.getUser(token)`;
   disabling platform JWT verification does not make this an anonymous API.
8. With server gate still OFF, an authenticated valid `status` request must yield
   403, not ready or an empty list. Anonymous/invalid bearer must yield 401.
   Verify exact CORS and no-store on success and failure without logging tokens.
9. Record function version, commit, configuration names (not values), OFF checks,
   and remaining blockers. Do not rebuild the frontend with its feature flag ON.

There is deliberately no activation SQL or secret-setting command in this file.

## 5. Wire Contract

All application actions use POST JSON with bearer authentication. GET is rejected;
OPTIONS is the restricted CORS preflight, not an application action.

| Request | Success response |
| --- | --- |
| `{action:'status'}` | `{kind:'ready'}` after auth, gates, and key readiness |
| `{action:'read',documentId}` | `{kind:'document',documentId,revision,document}` |
| `{action:'list',limit?,cursor?}` | `{kind:'list',documents:[{documentId,revision,document}],nextCursor}` |
| `{action:'save',documentId,operationId,expectedRevision,document}` | 0033 saved or conflict receipt |

IDs/cursors are UUIDs; revisions are safe integers within the 0033 range.
List defaults to 50, permits 1-50, sorts by document ID, and returns a UUID cursor
or null. The handler validates/decrypts lookahead too; an invalid row fails the
whole response rather than disappearing from the list.

Document fields are exactly `version:1`, `state:'DRAFT'`,
`visibility:'PRIVATE'|'PERSONAL'`, valid `YYYY-MM-DD` date, string title (at most
200 UTF-16 code units), and string body (at most 100000 UTF-16 code units).
No extra fields or finalization state are accepted.

The streaming request bound is 655360 bytes (640 KiB), checked before JSON parse
regardless of Content-Length. This accommodates maximum-length Korean text and
JSON Unicode escapes; 256 KiB would reject valid 100000-character Korean input.
Excessive whitespace or other over-bound transport is still rejected.

Saved receipt: `{kind:'saved',documentId,operationId,revision}` (HTTP 200).
CAS conflict: `{kind:'conflict',documentId,operationId,currentRevision}` (HTTP 409).
The 409 receipt must be parsed by the client and bound to the pending operation.
Never clear or replace a newer local edit on an older acknowledgement.

Errors use `{error:stableEnum}`: 401 AUTH_REQUIRED, 403 ACCESS_DENIED,
503 SERVICE_UNAVAILABLE, 409 OPERATION_REUSED, 422 INVALID_DOCUMENT.
Protocol errors additionally use 400 INVALID_REQUEST, 404 NOT_FOUND,
405 METHOD_NOT_ALLOWED, 413 BODY_TOO_LARGE, 415 UNSUPPORTED_MEDIA_TYPE.
Do not log error context bodies. All responses use no-store.

## 6. Rotation, Backup And Recovery

1. Retain every key needed by documents, operation proposals, unresolved
   conflicts, and retained backups. Inventory envelope key IDs without exposing
   plaintext or key bytes. Key ID reuse with different bytes is forbidden.
2. Add a newly generated key under a new ID while retaining old entries. Verify
   old document and old-operation replay decryption in an isolated rehearsal.
3. After approval, change `activeKeyId` to the new ID. New proposals encrypt with
   it; retries may still need an older key. Existing data is not re-encrypted by
   this change, and no automatic re-encryption job is implemented here.
4. A key may be retired only after verified migration of all references and the
   applicable backup/conflict/receipt obligations. Never delete an old key just
   because new writes succeed.
5. Back up the database documents AND operations/receipts with their owner,
   document and revision bindings. Maintain a separately access-controlled,
   encrypted backup of the complete matching keyring and recovery metadata.
   Database backups alone cannot restore readable drafts.
6. Restore into an isolated, access-restricted environment with outgoing
   integrations disabled. Test owner A reads, owner B denial, old-key reads,
   operation replay, conflicts, and missing/wrong-key failure. Verify counts and
   receipts without persisting journal plaintext in evidence.
7. Preserve originals during rehearsals. Record actual recovery time and loss
   window; do not claim an RPO/RTO without measurements and owner acceptance.

Backup restores do not implement 30-day revision/trash recovery. Recovery of
server drafts also does not restore never-uploaded device drafts. Browser
eviction, device loss, and local key loss remain separate risks.

## 7. Activation Blockers

Production activation remains blocked until all of the following have explicit
evidence and approval. Tests below require separately authorized accounts and
environments; do not collect real health/journal content by default.

- OPEN PR #320 dependency resolved and the exact deployment commit reviewed.
- Remaining parent editor/data-loss findings resolved with regression evidence.
- Approved 30-day revision/trash retention and restore workflow implemented and
  tested, with unresolved conflict, receipt and deletion-marker rules preserved.
- Real authenticated A/B accounts and two devices tested for isolation, expired
  sessions, account switching, eligibility withdrawal, OFF gates, and RLS denial.
  Use synthetic text with those authorized accounts wherever possible.
- CAS races, duplicate operations, lost responses, new typing during save,
  multitab stale edits, failed local writes, and navigation recovery verified.
- Full database PLUS key recovery rehearsal passed, including old-key replay and
  deliberate missing/wrong-key cases; originals remain recoverable.
- Platform/proxy log configuration verified to exclude raw content and secrets.
- User copy, privacy/access review, backup custody, operating cost and incident
  procedure approved by the responsible owners.
- Separate explicit approval to enable this bounded feature. Passing tests is
  not activation authority and does not complete the whole account-storage plan.

## 8. Incident Containment

Use the approved service-control process to disable ACCOUNT_JOURNAL_V2 first;
frontend kill configuration is additional containment, not a replacement.
Preserve local drafts, server proposals, receipts, and keys. Do not drop tables,
erase device buffers, restore a stale database over live data, rotate away old
keys, or re-enable legacy writers as an improvised rollback.

Investigate using metadata-only evidence in the authorized environment. A key
incident needs a reviewed containment/rotation/recovery plan, not secret values
in a ticket. Repeat the A/B and recovery gates before any reactivation.

## 9. Evidence Boundary

The gateway's synthetic Node suite passed 31/31 in the implementing task, with
two semantic-idempotency mutation tests observed failing before restoration.
The parent reported UI/API regression tests passing 16/16; that is a parent
report, not a live deployment claim. Re-run against the final integrated commit.
Deno/Edge Runtime, live auth/RLS, operational backups, key recovery, retention,
and production activation remain unverified by this task. The full goal is NOT
complete.
