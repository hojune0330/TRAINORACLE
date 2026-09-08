# Task4 Account PLAN Integration

Development unit only. No production switch, commit, secret access, account-journal core edit, or App.tsx edit.

## Server Contract

- Import `validateAccountPlanDocument` and `validateAccountPlanDocumentUpdate` from `account-plan-document-schema.ts` into the parent-owned account-state aggregator.
- Envelope: `{ version: 3, state: "ACCOUNT_STATE", kind: "PLAN", data: { schemaVersion: 1, currentPlanId, plans } }`.
- Fixed owner document ID: `await accountPlanDocumentId(ownerId)` uses SHA-256 of JSON `["trainoracle.account.plan.v1", ownerId]`, with the same UUID bit/format convention as account decoration documents.
- The authenticated owner, document ID, expected server revision, and operation UUID remain the gateway's authority. The body carries no caller-selected owner.
- Every accepted body passes the full existing V3/V4/V5/V6 readers. Maximum body is 500,000 UTF-8 bytes, maximum 100 retained plan entries; reaching a limit rejects the write, never evicts originals.
- Update validation preserves all previous immutable snapshots and archived entries. Current pointer, progress, and archive change in one server CAS revision.
- Build/check with the parent-owned `node scripts/build-account-state-validator.mjs [--check]`. The portable test proves no Supabase, live journal/plan store, or plan-beta-flow dependency is reachable.

## Parent Runtime Calls

`accountPlanService()` returns the current owner-scoped singleton when the existing account journal development flag is enabled. It subscribes to account scope changes and closes the old buffer without deleting persisted bytes. Mount/hydrate in the parent account lifecycle, not only on the plan tab.

1. `await service.hydrate()` reads the fixed ID. Verified NOT_FOUND initializes an EMPTY baseline; failed/auth/invalid responses do not initialize an empty account.
2. `service.snapshot()` returns `{ status, document, fingerprint, currentPlan }`. Document is the detached local overlay; `currentPlan` comes ONLY from a matching server receipt or authenticated remote body, never from an unsent pointer change.
3. Pass the fingerprint of the rendered document to `service.mutate(command, fingerprint)`. A stale render or concurrent local IDB sequence cannot overwrite a later view.
4. `service.retry(freshReview?)` replays the immutable operation UUID/body. A pending new current pointer requires a fresh independent review callback. A pointer already observed on the authenticated server can replay its lost receipt without inventing a second selection.
5. `disposeAccountPlans()` on root logout/cutover cleanup. No local originals, ciphertext, or evidence are deleted.

Commands (all use the same encrypted buffer and requestAccountDocument/flush path):

- `SELECT`: `{ kind: "SELECT", packet, confirmsSelection: true, freshReview }`. Call ONLY after explicit selection under the existing plan gate. `freshReview` must recompute current safety/selection/record/source review, not return a saved flag. Requires online state; archives the former current entry atomically when selecting a successor. Cannot select an archived entry.
- `SAVE_HISTORY`: `{ kind: "SAVE_HISTORY", packet }`. Explicit backup/import only. Never changes the current pointer. Do not silently assign anonymous device originals to an account.
- `PROGRESS`: `{ kind: "PROGRESS", packet }`. Packet is the versioned result of the existing successful progress store. Its immutable selection identity must equal the server-confirmed current plan. Never infers execution or performed distance from progress.
- `ARCHIVE`: `{ kind: "ARCHIVE", planId }`. Retains snapshot/progress and clears the pointer in the same CAS. Current-plan archive requires online state.

`AccountPlanPacket` is `{ state, evidence }`: V3 uses null evidence; V4/V5/V6 carry one exact historical evidence packet. Construct from existing validators' output, not inferred or reconstructed personal inputs. `accountPlanEntry(packet)` derives the immutable identity and separates progress.

For custom independently retained source registries, create `createAccountPlanService({ ownerId, isCurrent, readTrusted })`. `readTrusted` must return independently accepted exact content, NOT the downloaded packet's evidence. The operating retained registries remain empty where they were empty before this task. Packet validation verifies internal consistency, NOT external acceptance. No whitelist entries or review receipts were fabricated.

## UI Adapter

- Hook: `screens/plan-beta/useAccountPlanRuntime.ts`, exports `useAccountPlanRuntime(service?)` -> `{ view, mutate, retry }`. It binds writes to the rendered fingerprint and drops old-service responses after a switch.
- Control: `screens/plan-beta/AccountPlanStorageControls.tsx`, props `{ status, evidenceRequired?, onRetry }`.
- `currentPlan.kind === "read_only"` provides `packet`, `executionAuthority: "NONE"`, and `requiredNextGate: "FRESH_SAFETY_AND_EXECUTION_REVIEW"`. Display is not activation. Existing fresh execution review remains mandatory before starting/logging a planned session.
- `evidence_required` preserves encrypted content but does not render it as independently verified. No fallback to today's sources or self-supplied evidence.
- In account mode legacy V3 latest-saved cloud reads/writes/archive and V6 default cloud controls are disabled. Do not use their unavailability as permission to restore a historical plan into current local storage.

## Existing UI Integration

- Existing initial V3 selection, adjusted V4/V5/V6 selection, successor stores, all versioned progress stores, and explicit PlanBeta archive now call the account bridge after their existing validation gates. Writes preserve original device keys. V3 optional strict adaptation context is preserved with the immutable packet; it is not reconstructed on restore.
- PlanBeta subscribes to the account epoch/projection. Home reads the confirmed pointer/progress. Journal original lookup resolves the exact confirmed active/archived packet and refreshes on account events. Parent owns root hydration/disposal.
- Unverified V4-V6 historical originals and progress render read-only in PlanBeta and journal. Home suppresses next-training actions for them. Their transported evidence never becomes independent accepted evidence.
- Explicit conflict control calls `useServerCurrent(renderedFingerprint)`: authenticated remote read, generic encrypted preserve-both conflict archive, then remote acceptance. There is no merge editor and no false ACK.
- Unsupported IndexedDB initialization is FAILED, not empty or a legacy writer fallback. Controlled write rejections persist as REJECTED across mutation, import, retry and hydration; pending bytes remain intact, with no automatic repeated submission.
- Import captures deep-cloned packets synchronously before queued/auth work. Duplicate immutable plan IDs with different progress reject the whole import as HISTORY_CONFLICT. Capacity failures are distinct CAPACITY results.

## Remaining Boundaries

- Independent approved retained evidence retrieval, complete archived-template version distribution, actual A/B authentication/production gateway encryption, and real two-device production verification are not claimed by local mock-server tests.
- The existing independent approved registries are empty: current-build accepted exact sources were not available to populate them. Historical display works, but restored adjusted plans are not thereby usable for starting training.
- Pending V3 adaptation proposals remain owner-scoped device drafts, not cloud-restored approvals. An unacknowledged selection still requires a fresh live review; a generic retry after reload cannot invent it.
- Account successor branches are connected to existing fresh validators; full V3-V6 successor UI end-to-end coverage is not claimed by the initial/progress/archive UI tests below.
- Stored document limits reject rather than prune. Full 18-frame / 24-week cloud retention is BLOCKED by the current single-document byte cap. A separately reviewed partitioned immutable-plan collection plus CAS pointer is the concrete follow-up; no cap increase or eviction is implemented.

## Measured Capacity

Synthetic actual versioned fixtures, UTF-8 JSON, distinct immutable plan IDs, no compression. These are fixture measurements, not a guaranteed plan count (real source content and progress vary).

| Version | Packet bytes | Retained entries | Accepted body bytes | Next body bytes |
| --- | ---: | ---: | ---: | ---: |
| V3 | 1,470 | 100 | 166,109 | 167,769 (101-entry shape limit) |
| V4 | 61,560 | 8 | 494,109 | 555,859 |
| V5 | 51,951 | 9 | 469,378 | 521,519 |
| V6 | 52,775 | 9 | 476,794 | 529,759 |

V4-V6 do NOT fit 18 frames. The UI shows actual document usage/count and a near-capacity notice. Failed append tests verify the prior server document/revision stays unchanged.

## Verification

- Normal V3/V4/V5/V6 packet reconstruction, zero execution authority, missing/duplicate independent evidence, modified payloads, duplicate/missing progress slots, snapshot/update immutability, UTF-8 size gate.
- CAS selection/progress/archive, lost receipt, stale rendered version, two-device conflict, account switch, failed-read vs NOT_FOUND, no automatic historical activation, no unreviewed retry.
- Standalone neutral server bundle compiles and validates all four versions in a fresh Node process with no window or browser/auth/store imports.
- Chromium real IndexedDB: fresh context pointer/progress restore, encrypted records at rest, preserved device sentinel, archive propagation, pending operation reload/review/replay, owner switch. HTTP/auth are mocked; IDB/WebCrypto/schema/service are real.
- Actual Chromium PlanBeta intake -> selection -> progress -> Home -> linked journal original -> archive -> archived journal original passes with three server writes and preserved device sentinel.
- Actual React V4/V5/V6 apply buttons -> progress -> unverified new-device historical display -> explicit archive pass. Actual Home rewards tests pass without hiding the unavailable-IDB service behind a mock.
- Recovery tests cover input mutation during deferred authentication, duplicate differing progress, all three controlled rejection codes on selection/import/retry/hydrate, and measured capacity without eviction.
- Mutation proof: temporarily disabled independent evidence match; named V4/V5/V6 `transported evidence cannot manufacture independently retained authority` tests failed. Restored the predicate immediately.

Run focused unit tests in both default and `-c vitest.config.kst.ts` modes, `npm run typecheck`, and `node node_modules/@playwright/test/cli.js test --config playwright.account-plan-service.config.ts`.
