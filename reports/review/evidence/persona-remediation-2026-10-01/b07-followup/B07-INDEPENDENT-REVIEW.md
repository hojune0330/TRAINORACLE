# B07 Independent Review

## Final Result

- Basis: `codex/workout-choice-runtime-completion`, HEAD `38300ae988b97a9968968a2dd3eb3517b4e62781` + parent-owned dirty changes.
- Independent result: one P2 UI recovery defect found, reproduced twice before the fix, and resolved by the parent's subsequent change within the tested boundary.
- After the parent fix, the SAME existing eight tests were run ONCE: 8 passed, 0 failed, 0 skipped; process exit 0. No additional tests or expanded audit.
- Before fix: 7 passed / 1 failed. T08-only confirmation: 1 failed / 7 skipped. These failure files remain unchanged.
- Parent-reported 35 focused tests, 120 tests, browser combinations and later 14 tests are not counted as this reviewer's execution evidence.

## F01 / P2: Pending Receipt Recovery Left a Reopened Predecessor Draft Visible

Status: resolved in the independently executed T08 boundary after the parent fix.

Static cause in the preserved pre-fix `PlanBeta.tsx:409`: recovery cleanup required `errorCode === "ACCOUNT_PLAN_PENDING"`. The return-to-current-plan action cleared that code. Reopening the next-cycle draft did not reinstate it, so a recovered receipt changed the confirmed account plan without closing the obsolete draft.

Executed reproduction:

1. Open a completed ordinary V3 plan's next-cycle draft and select a candidate.
2. The in-memory account protocol double commits the selection, then loses the response.
3. Return to the current plan while the confirmed pointer still names the predecessor.
4. Reopen its next-cycle draft.
5. Recover the receipt and dispatch `ACCOUNT_PLAN_EVENT`.
6. Before the fix, the confirmed pointer changes but the return-to-current-plan button and obsolete draft remain. T08 fails; protocol commit count is 1.

Positive control: T07 performs receipt recovery without cancel/reopen and passes before and after the fix, asserting one SELECT and one protocol commit.

Parent fix inspected at current `app/src/screens/PlanBeta.tsx:365`, `:410`, `:662`: `pendingNextReceipt` retains the exact predecessor independently of cancellation/error text; a changed confirmed plan only closes a draft matching that predecessor. The recovered path explicitly sets `celebrateActivePlan` false. That celebration assignment and the exact-match guard were statically inspected, not separately exercised across every alternate predecessor. T08's obsolete-draft assertion now passes; its commit-count assertion remains 1. No product fix was made by this reviewer.

## Eight Executed Boundaries

| ID | Boundary | Before fix | After fix |
| --- | --- | --- | --- |
| T01 | UI open/preview/cancel/guarded leave/remount preserves active plan, all 18 original archives and all synthetic storage bytes | PASS | PASS |
| T02 | Real domain selection 6 to 7 and 18 to next macrocycle 1; exact predecessor archived, retention 18, replay writes nothing | PASS | PASS |
| T03 | Same-ID predecessor changes while waiting for the mutation lock; selection/generation reject STALE_BASE without writes | PASS | PASS |
| T04 | Each of five local/session keys changes THEN throws; rollback restores all bytes, retry succeeds | PASS | PASS |
| T05 | Rollback itself fails; returns PLAN_STORAGE_STATE_UNCERTAIN, not success or ordinary safe retry | PASS | PASS |
| T06 | Delayed account protocol acknowledgement; old pointer retained until acknowledgement, SELECT once, commit once, browser storage unchanged | PASS | PASS |
| T07 | Actual PlanBeta UI lost-response receipt recovery without cancellation; SELECT once, commit once | PASS | PASS |
| T08 | Pending selection, cancel, reopen predecessor draft, then receipt recovery closes obsolete draft | FAIL | PASS |

Additional narrow attacks beyond ordinary failure-before-write coverage were T04's post-write exceptions and T05's failed rollback. No further issue was found in these exercised cases.

Named mutation evidence: `M_NO_ADVANCE`, a Vitest load-time memory-only replacement of the lineage advance with the predecessor context. Only T02 was executed; it failed its periodization equality assertion as intended, with seven tests skipped. The unmutated T02 positive control passed. Product source was never mutated.

## Execution / Proof Boundary

- Installed Node + Vitest 4.1.10, jsdom and Testing Library; one scratch test file, fixed synthetic date, synthetic storage/account fixture and controlled lock/protocol doubles.
- Account tests use the real collection-service implementation with an in-memory protocol double. This is NOT actual DB, SQL/RPC, provider, IndexedDB, encryption, production or private-account proof.
- T02 selects through the real domain function, not through browser UI. T01/T07/T08 execute PlanBeta under jsdom, not a real browser or mobile viewport.
- Each test asserts that `fetch` was not called. Supabase/cloud side effects are mocked, environment loading points to the scratch-only empty-env directory, and B06 PlanAdaptationFlow is mocked/excluded.
- Read the five B07 product files, parent `plan-next-*` tests and periodization contract including section 11. Parent tests were read, not rerun.
- Not executed: all-suite, full personas, browser/mobile/reduced-motion checks, typecheck/build, real DB/server/network, secrets/environment/private-account inspection, commit/push/deploy, B06 re-audit.
- Only new files under this scratch directory were written. Product/spec/prior evidence remained untouched by this reviewer.

## Preserved Files

Exact root for every relative path below:

`D:\admin\Documents\ChatGPT\트레인 오라클\TRAINORACLE-oracle-exploration-20260921\.scratch\b07-independent-after-20261001`

- `baseline-run1.json`: original eight-test run, 7 PASS / T08 FAIL.
- `t08-confirmation.json`: original T08-only failure confirmation.
- `after-fix-run1.json`: same eight tests, one post-fix run, 8 PASS.
- `mutation-no-advance.json`: named mutation killed by T02.
- `b07-boundaries.test.tsx`, `vitest.config.mts`, `setup.ts`: unchanged harness used for the post-fix run.
- `before-fix-source/PlanBeta.tsx`: reconstructed by removing only the parent's receipt-ref patch from the new file; byte hash verified against the original review capture before preservation.
- `after-fix-source/app/src/screens/PlanBeta.tsx` and four other scoped B07 source copies: parent-fix snapshot.
- `before-source-hashes.json`, `after-source-hashes.json`: original review captures; both preserve the pre-fix hashes.
- `after-fix-source-hashes.json`: parent-fix capture; all five live source hashes still matched after the eight-test run.
- `preserve-revision.mjs`, `snapshot.mjs`: scratch-only preservation helpers.

Pre-fix PlanBeta SHA-256: `9ca1aeb67a79e695f56f30753c3348d6d5bc5768f2bb652d2a0757b3f9c92c58`.

Parent-fixed PlanBeta SHA-256: `318e4b85b497944bec99cb41cfab2494d0e376e5555e67ac9978afad7c4d6714`.

The other four B07 product file hashes did not change between the original review and the post-fix run.
