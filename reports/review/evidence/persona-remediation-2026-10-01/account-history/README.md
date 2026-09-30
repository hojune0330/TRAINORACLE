# Account History Readiness And View Continuity

Status: LOCAL_REVIEWED_IMPLEMENTATION; not production verified.
Base: `9d230772` plus this scoped patch. All account/record fixtures are synthetic.
No personal data, secrets, external requests or operational account were used.
This is a follow-up to the 100-persona baseline, not another 100-persona run.

## Changes

- Demand-load archived originals for cycle comparison, saved-session actual records
  and plan-based personal Oracle. Home and example-only entry do not fetch history.
- Preserve the open comparison when history progress emits account-plan events.
  Actual prescription/progress changes still invalidate the previous UI context.
- Separate journal readiness, archived-history readiness and initial account-plan
  failure. Explicit retries do not invoke hydration/pending-write recovery.
- Refresh after eventless local retry and late account journal arrival. Do not
  display missing journals as zero observations before the read completes.
- Preserve reader tab/scroll; close scoped readers on account changes. Do not cancel
  a shared request when only one consumer closes.
- Do not acknowledge unseen personal analysis via callbacks or bookmark tokens.
  Retry controls have at least a 44px touch height and use existing design tokens.

## Runtime Evidence

| Evidence | Result and boundary |
| --- | --- |
| `history-final-utc-corrected.json` | 5 nearest files, 90/90. UTC; before removing three unsupported test-only `exact` options. |
| `history-final-kst.json` | Same 90/90, Asia/Seoul after that test typing fix. Not 180 distinct cases. |
| `history-final-utc.json` | Earlier 89/90: new Oracle test used a missing-data fixture with no fingerprint; its seen-callback assertion was invalid. Not a product defect. |
| `mutations-result.json` | Five exact-once in-memory source changes each fail the named expected assertion. Product source is not modified. |
| `history-mutation-*.json` | Named failures for history request, eventless retry, journal-arrival subscription, stable active-plan state and unread bookmark. |
| `browser-result.json` | 9 real-component combinations: cycle/detail/Oracle at 320px, 375px and synthetic 200% text with reduced motion. |
| `*-failed.png`, `*-ready.png` | Failure/recovery screens from the successful browser run. |

The browser verifies one request, explicit retry, successful recovery and no
horizontal overflow, page errors, external requests or local-storage changes.
It first caught a 27px retry control; the final run requires at least 44px.
The real account-service integration test runs against an in-memory protocol server:
history reads cause zero commits; an explicit progress update causes one commit and
invalidates the review. This does not prove deployed DB/server behavior.

TypeScript `--noEmit` passes. This is a critical read-consistency boundary, not a
release candidate. Full release gates, production build/deploy and the unrelated
entire app suite were not repeated. No lint script/configuration exists in this
checkout. The edited legacy E2E text selectors were updated but that full E2E spec
was not run; the real-flow contracts and isolated browser checks above were run.

## Independent Review

A separate GPT-6.1 Sol / ultra reviewer inspected the read-only implementation.
Its first verdict requested changes for stale eventless retry evidence, late journal
arrival and a no-op retry after initial account failure. All three were addressed
with focused regressions. Its [verbatim original/follow-up report](INDEPENDENT_REVIEW.json)
confirms all three code causes resolved with no additional actionable defect in
the requested static scope. The reviewer did not execute the tests or browser.
Main-worker runtime results are not independent execution.

## Reproduce

Copy `run.mjs` into `.scratch/b06-cycle-lineage-20261001/` and `entry.tsx`,
`browser.cjs`, `mutations.mjs` into `.scratch/b06-account-history-20261001/`.
Their relative imports intentionally keep those paths. Use existing Node24 and app
dependencies; the runner uses an empty environment directory, not `.env` files.

```powershell
$env:TZ='UTC'
$env:B06_RUN='history-replay'
Remove-Item Env:B06_MUTATION -ErrorAction SilentlyContinue
Remove-Item Env:B06_TEST_NAME -ErrorAction SilentlyContinue
node .scratch/b06-cycle-lineage-20261001/run.mjs src/hooks/usePlanEvidenceHistory.contract.test.tsx src/screens/plan-beta/plan-evidence-account.contract.test.tsx src/screens/plan-beta/PlanAdaptationFlow.contract.test.tsx src/screens/plan-beta/SessionExplanation.contract.test.tsx src/screens/OracleExplore.contract.test.tsx
node .scratch/b06-account-history-20261001/browser.cjs
node .scratch/b06-account-history-20261001/mutations.mjs
```

Mutation setup errors are not passes; the expected assertion must fail. The browser
binds only to an ephemeral loopback port, blocks external requests and closes its
own server/browser. Synthetic enlargement is not actual iOS Dynamic Type testing.

## Remaining

W1 automatic MAIN intensity/full-time decision, B06 exact current-context and approved
catalog numerical successors, DB0041/server/app release and live-account verification
remain separate. No dose increase, safety override, new approval or issue closure is
implied. No push, merge or deployment was performed in this slice.

[DRAFT_COMPLETE]
