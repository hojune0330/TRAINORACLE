# Next-Frame Repair Evidence

Scope: uncommitted B06/B07 implementation based on HEAD `38300ae`, 2026-10-01.
This is focused local remediation, not another 100-persona run or a production release.
All athlete records, plans and journals in these files are synthetic.

## Results

| File | Meaning |
|---|---|
| `before-corrected.json` | Four B07 UI regressions fail before the repair at the intended assertions |
| `b06-recovery-before-corrected.json` | Four new B06 recovery regressions fail, sixteen controls pass |
| `b06-recovery-after.json` | Related B06 flow/domain/storage tests: 84/84 pass |
| `final-utc.json`, `final-kst.json` | Same nine focused files, 120/120 pass per timezone, not 240 unique cases |
| `mutation-lineage.json` | In-memory removal of forward lineage: two named tests fail |
| `mutation-rollback.json` | In-memory removal of local rollback: four named tests fail |
| `browser-result.json` | Six actual PlanBeta guest-screen combinations pass, with zero observed overflow/page errors/external requests |
| `b06-browser-after.json` | Nine isolated B06 component combinations still pass after recovery repairs |
| `pending-reopen-before.json` | Three controls pass, returning to a pending draft then recovering a receipt fails |
| `pending-reopen-after.json`, `pending-reopen-after-kst.json` | Final three affected UI files: 14/14 per timezone after the additional receipt-lifetime repair |

The initial B07 before run used a wrong button selector for two tests; the initial
B06 run used a wrong close-button selector once. Corrected separate before files are
preserved here. A later expanded test attempt had four test-fixture/selector defects;
the final outputs above follow their correction. Those attempts are not new product
bugs or successful verification.

The account tests run the real collection service against a protocol double. They
cover one SELECT commit, lost acknowledgement, receipt recovery, retained predecessor
and the pending screen returning to the confirmed current plan. They do not execute
production SQL, real account authentication or network storage.

An independent follow-up added the pending-cancel-reopen path after the 120-test runs.
The parent reproduced its failure, retained the pending predecessor separately from
the dismissed error message, then ran the three affected files (14 tests) in both
timezones. The full nine-file set was not rerun after this last UI-only correction;
do not label the earlier 120-test JSON as the final unchanged source. Do not add
14 to 120 as unique coverage. TypeScript passed again after the final correction.

Local multi-key failure rollback is not crash-atomic storage. The existing latest-18
guest archive policy remains, but trimming happens only on accepted continuation.
No new training-dose authority or catalog adaptation transform is enabled.

## Reproduce

Copy `run.mjs`, `entry.tsx` and `browser.cjs` into
`.scratch/b07-remediation-20261001` in the repository. Relative imports intentionally
target that layout. No environment files are read by the runner or browser bundle.

```powershell
$env:TZ = 'UTC'
$env:B07_RUN = 'local-check'
$env:B07_MUTATION = ''
node .scratch/b07-remediation-20261001/run.mjs src/screens/plan-beta/plan-next-draft.contract.test.tsx src/screens/plan-beta/plan-next-selection.contract.test.ts src/screens/plan-beta/plan-next-account.contract.test.tsx src/screens/PlanBeta.persistence-retry.contract.test.tsx src/screens/plan-beta/plan-selection-revision.contract.test.ts src/screens/plan-beta/PlanAdaptationFlow.contract.test.tsx src/screens/plan-beta/ActivePlan.adaptation.contract.test.tsx src/domain/plan-adaptation-ui.contract.test.ts src/domain/plan-adaptation-store.contract.test.ts
node .scratch/b07-remediation-20261001/browser.cjs
```

Repeat with `TZ=Asia/Seoul` for the second timezone. For mutation checks use
`B07_MUTATION=lineage` with `plan-next-draft.contract.test.tsx`, or `rollback` with
`plan-next-selection.contract.test.ts`. Mutation target occurrence is checked before
replacement, and the product files are never modified. Exit 1 alone is not evidence;
check the named assertion failure in the JSON.

The three included screenshots cover 375px, 320px and synthetic enlarged text with
reduced motion. They are actual component screenshots, not live iOS/OS text-scaling
proof. The isolated screen uses repository CSS but not the full app navigation shell.

TypeScript and all three generated-server-validator source checks passed separately.
The full release suite, operating DB migration, server deployment, Pages publication,
and live account round trip have not been run for this candidate.

[DRAFT_COMPLETE]
