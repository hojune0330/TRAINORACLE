# PRIVATE_MEMO_RECOVERY_FIX_REVIEW_2026-09-13.md

## Scope and Status

- Base: PR #339, main `d032664ad3496d0480e87d98858e666d5722cd60`.
- Owner request: implement the three findings in the post-deploy review.
- This report records local implementation evidence, not deployment proof or independent expert approval.
- Release evidence will be attached to the follow-up PR after CI, merge, and public verification.
- Contract: [LOCAL_PRIVATE_MEMO_RECOVERY_CONTRACT.md](../../docs/LOCAL_PRIVATE_MEMO_RECOVERY_CONTRACT.md).
- Original findings remain preserved in [the post-deploy review](./PRIVATE_MEMO_SAVE_POST_DEPLOY_REVIEW_2026-09-13.md).

## Changes

| Finding | Implementation | Evidence |
|---|---|---|
| PMR-01: trash ciphertext omitted from key preparation | Strict, read-only retained-trash inspection; verify all current and retained private memos before installing a code | Trash-only key creation refusal, original-code preparation and restore test |
| Existing mixed-code records | Optional explicit two-code repair; verify every ciphertext before writes; preserve journal data, raw extension fields and trash retention | Both-code repair, wrong-code no-write, partial-write retry and plaintext-leak tests |
| PMR-02: stale ready indicator | Subscribe to recovery-code changes and owner scope; no cached ready boolean | Clearing a code restores editable setup without losing the draft; generated-code state resets too |
| PMR-03: setup displaces typing | Compact closed control below textarea; full setup only after explicit request | Typing geometry and saving tested on four browser projects |
| Additional browser finding | Reveal focused memo when its bottom is behind the fixed save bar | Desktop and reduced-motion geometry failed before this correction and passed after |

## Local Evidence

- Focused storage, crypto, trash and form suite: 22 files, 260 tests passed before the final generated-code reset test was added.
- Final preparation suite: 12/12 passed, including the generated-code reset case.
- Browser suite: 8/8 passed across desktop Chromium, mobile Chromium, 320px touch and reduced-motion projects after the geometry fix. Physical iPhone Safari was not tested.
- Production build passed. Existing font-resolution/chunk-size warnings remain; no build errors.
- Mutation 1: omit retained trash from `hasRetainedPrivateMemos`; the trash-only test fails (exit 1).
- Mutation 2: replace reactive session state with initial-only `useState`; the code-disappearance test fails (exit 1).
- Both mutations were restored immediately after the negative run.
- The earlier unmodified-build browser negative run failed because the compact setup control did not exist. It does not prove that the later numeric geometry assertion executed on that build.
- Full repository unit suite and release CI are separate gates; their results are not inferred from these focused passes.

## Adversarial Cases

- Wrong/missing code, unreadable trash, or an unresolved owner does not create a new code or delete ciphertext.
- Owner switch-away-and-back, journal/vault/trash/ownership changes, or leaving the form invalidates asynchronous preparation.
- Two-code repair does not silently mark partial writes successful. Both codes remain necessary until retry completes.
- Unknown raw extension fields are preserved; recovery does not rewrite the journal, entry IDs, dates, or retention timestamps.
- Preparing encryption does not save the journal automatically. The existing Save action is still required.
- Test records and recovery codes are synthetic. No user's memo, password or recovery key was collected.

## Limits

- Multiple localStorage writes are not an atomic transaction. Readback and state checks detect observed changes; they cannot turn browser storage into a database transaction.
- Repair supports two supplied codes. Unknown codes and damaged ciphertext are not recoverable by guessing.
- This patch changes local memo preparation, not the approved account-storage service, D9, training prescriptions, sharing, or analysis.
- Other navigation work remains on its own branch and is not included.

[DRAFT_COMPLETE]
