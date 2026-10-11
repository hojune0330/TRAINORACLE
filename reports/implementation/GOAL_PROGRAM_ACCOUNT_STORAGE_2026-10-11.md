# Goal program account storage — local implementation evidence

Date: 2026-10-11. Integrated baseline: `bf29931c24ab64b2477f6269bd26ed655b4699e2`.
This report covers source implementation and disposable local tests, not production account readiness.

## Implemented boundary

- The existing program V1 original, frame geometry, dose and guest APIs remain unchanged. Pure document validation moved to `goal-training-program-document.ts` so the edge bundle does not import browser storage.
- A capability-gated account adapter now uses the existing authenticated encrypted gateway, fixed operation receipts, native encrypted IndexedDB outbox, consent revision pins, account deletion boundary and mandatory Web Locks. There is no memory-only storage substitute.
- `accountPlansEnabled=true` never falls back to a device wrapper after unsupported capability, failed read, unknown version, missing referenced bytes, conflict or failed save. Only a verified account index and referenced originals become confirmed UI state. Pending state retains the last confirmed program separately from its staged proposal.
- The older held DEVICE lane is intentionally preserved: when canonical account mode is disabled, an owner-scoped, unstarted local preview wrapper may be saved/exported/restored. It is not account persistence; active application/archive is still rejected for an authenticated held owner. Its existing regression tests were preserved.

## Physical collection and capacity

| Kind | Contents | Write rule |
| --- | --- | --- |
| `GOAL_PROGRAM_BODY` | Complete immutable program V1 original and its program identity | Owner/content-derived physical ID; content hash includes body; revision 1 only |
| `GOAL_PROGRAM_PROGRESS` | Immutable application/cycle/latest-plan/lineage snapshot bound to that body hash | New content-derived physical ID for each snapshot; revision 1 only |
| `GOAL_PROGRAM_INDEX` | Current body/progress reference and up to 18 retained program archive references | Owner-derived singleton; existing server revision CAS |

Every physical document retains the existing 500,000-byte limit. The full nineteen-program synthetic case (current + eighteen archived, unstarted originals) exceeds that limit as one wrapper and round-trips as 38 bounded immutable parts plus a small index. This is not evidence that every possible edited lineage fits the limit: oversized progress is rejected, never pruned or accepted through a larger envelope.

Both client and gateway resolve the actual referenced snapshots before accepting an index update. They reject same-original revision rewind, application/cycle rewind and restarting an ended cycle. Existing archive references cannot be silently removed or rewritten; replacement retains the prior original body in the archive.

The gateway reads/decrypts referenced parts using the authenticated owner's physical namespace and requires immutable revision 1. Attested SQL rechecks live owner/kind/content-hash metadata under the existing owner lock before the index CAS. Monthly metadata never grants rewards. Ordinary draft/journal lists continue to exclude account-state documents, including these new kinds.

## Durable intent, failure and explicit recovery

- New immutable parts and the proposed index are encrypted before one native `readwrite` transaction stages the complete intent. Any later-row local CAS mismatch, owner/deletion boundary or consent-generation change aborts all draft writes. Existing single-document APIs are unchanged.
- Sync submits/acknowledges parts, rereads referenced remote bytes, then submits the index with its fixed operation ID and expected revision. Lost acknowledgements replay that same operation; a successful part receipt alone is not program success.
- PLAN selection and monthly INDEX confirmation have independent receipts. A PLAN acknowledgement followed by monthly staging/index failure is reported as incomplete, not as “nothing was applied.” Recovery permits only the exact requested successor that is already selected after its predecessor was explicitly ended; unrelated/detached plans are not overwritten.
- Conflict review is bound to owner, session generation, local sequence, confirmed revision, remote revision and the reviewed content. Explicit remote acceptance retains both encrypted versions in the existing conflict archive. A separately requested backup reads the exact staged index and staged archive, not the confirmed remote history. Restoring a different existing program still requires review and never silently changes the active plan.
- Whole-device erasure now disposes the monthly database through the independently reviewed disposal helper. The native test proves deletion succeeds with a live buffer connection and the former draft is absent after reconnection.

## Store integration API

Existing `read/save/apply/archive/export/restore/subscribe` APIs remain available. Added exports:

- `goalTrainingProgramStorageStatus(): "DEVICE" | AccountGoalProgramStatus`
- `refreshGoalTrainingProgram(): Promise<boolean>`
- `goalTrainingProgramAccountSnapshot(): AccountGoalProgramSnapshot | null`
- `acceptRemoteGoalTrainingProgram(review): Promise<boolean>`
- `exportGoalTrainingProgramConflictJSON(review): Promise<string>`

Account statuses: `LOADING`, `EMPTY`, `READY`, `PENDING`, `CONFLICT`, `FAILED`, `AUTH_REQUIRED`, `UNSUPPORTED`, `UPGRADE_REQUIRED`. New writes require fully loaded `EMPTY`/`READY`; UI must never show snapshot owner/session fields.

New rejection codes: `ACCOUNT_PROGRAM_LOADING`, `ACCOUNT_PROGRAM_PENDING`, `ACCOUNT_PROGRAM_CONFLICT`, `ACCOUNT_PROGRAM_FAILED`, `ACCOUNT_PROGRAM_AUTH_REQUIRED`, `ACCOUNT_PROGRAM_UPGRADE_REQUIRED`, and `ACCOUNT_PROGRAM_STATE_CHANGED`. Unsupported uses the existing `ACCOUNT_STORAGE_UNSUPPORTED`. Existing safety/cycle/revision/`ACCOUNT_PLAN_*` failures remain distinct.

## Verification and limits

All local JavaScript checks used pinned Node 24.19.0. No production connection, credential read, real account lookup or network write was used.

- Account schema 6 + service 8 + exact-successor store 2: **16/16 pass**. Full original source replay is used; the nineteen-original schema case has an explicit test-only timeout.
- Isolated Chromium on the parent-owned loopback Vite server: **8 boundaries pass** — later-row rollback, transaction late owner, WebCrypto late owner, late consent, encrypted-only storage/nonextractable key, fixed retry + original consent revision after reopen, live-connection monthly DB disposal and absent former record after reopen. Other origins were blocked; the parent server/profile was not manipulated by this test.
- Root-executed gateway contracts: **5/5 pass** (capability, namespaces/references/CAS/receipts, immutable lifecycle, old-reader compatibility, archive retention).
- Root-executed disposable PGlite: **4/4 pass**, loading the complete integrated SQL 0001–0062 chain and the operations proposal. Feature controls were unchanged by the proposal. This is single-session PostgreSQL engine evidence, not native multi-session concurrency or production evidence.
- Existing store + additive capability + shared API/buffer/sync compatibility: first combined run **210 pass / 1 fail out of 211**. The only failure was unsupported account restore error precedence (`INVALID_PROGRAM_BACKUP` instead of `ACCOUNT_STORAGE_UNSUPPORTED`). One service-unavailable entry guard fixed it; the affected test rerun **1 pass / 34 skipped**. Other 210 cases passed in the combined run; a second complete 211-case run was intentionally not duplicated.
- Root's final app TypeScript check passed again after the final store-only guard. Both generated validator freshness checks passed before that guard, which is not a schema change. A fresh build metafile inspection confirms **store=false, account service=false, draft buffer=false, Supabase client=false** in the account-state validator inputs; pure document validation is included.
- `git diff --check` passed for the integrated working copy before the final one-line guard/report; line-ending conversion warnings were informational only.

The SQL file is `supabase/operations/goal-program-account-storage.sql`: an unapplied operations draft, not a numbered/deployed migration. The available CLI was not located and the parent explicitly deferred installation and production work. Before any future account activation, generate/review the actual migration using the Supabase CLI, apply the matching gateway/schema/SQL deployment through the approved workflow, and obtain authorized authenticated account round-trip and concurrency evidence. Existing account-held production flags remain unchanged; local success does not authorize turning them on.
