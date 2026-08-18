# DoneClaim

Baseline: `edd7151e60c00b8a4c2b58722f39d021f7f5477a`

## Changed source files

- `app/src/domain/prescription-quality-matrix-cases.ts`
- `app/src/domain/prescription-quality-matrix.contract.test.ts`
- `impl/src/plan-generator/session-builder.ts`
- `impl/test/plan-beta-generation.test.ts`

## Executable matrix

`prescription-quality-matrix.json` records five supported generation cases, eight report-only athlete personas, NONE/SPARSE/CURRENT-same-event-plus-sufficient-journal evidence states, D9 ACTIVE/UNKNOWN blocks, self-selection, privacy, and explicit fallback/unsupported combinations.

The report deliberately treats sex, high/mid/low tier, and competition division as report-only persona dimensions. It does not invent dose multipliers or eligibility rules.

## Defect proved and fixed

Failing-first matrix runs proved two emissions outside the canonical 19-slot formation:

- Morning daily two-a-day: day 10 PM EASY/RECOVERY.
- Evening daily two-a-day: day 10 PM QUALITY.

The session builder now checks the formation before emitting a PM recovery counterpart and falls an unavailable preferred PM quality slot back to day 10 AM. The existing implementation test was corrected from four recovery PM days `[1,4,7,10]` to the valid formation days `[1,4,7]`.

## Verification

- Matrix red: 2 failed, 11 passed on the uncorrected implementation.
- Matrix green UTC: 13 passed. Matrix green KST: 13 passed.
- Focused app contracts: 65 passed. Focused implementation contracts: 78 passed.
- Full app: 1299 UTC + 1299 KST + 9 release-env passed.
- Full implementation: 161 passed.
- App, E2E, and implementation TypeScript checks passed.
- Production build: 1918 modules transformed; built successfully.
- Isolated Chromium on port 4174: 800m, 1500m, and 3000m generate/select/save/reload flows, 3 passed.
- `git diff --check`: passed.

Exact commands, from their package directories unless shown otherwise:

```text
PRESCRIPTION_MATRIX_REPORT=../.omo/evidence/prescription-persona-quality-matrix-20260818/prescription-quality-matrix.json npm run test:unit -- src/domain/prescription-quality-matrix.contract.test.ts --reporter=verbose
npm run test:unit:kst -- src/domain/prescription-quality-matrix.contract.test.ts --reporter=verbose
npm run test:unit -- src/domain/prescription-quality-matrix.contract.test.ts src/domain/plan-beta-detailed-candidates.contract.test.ts src/domain/multi-event-prescription.contract.test.ts src/domain/plan-beta-flow.contract.test.ts src/domain/plan-beta-schema.contract.test.ts --reporter=verbose
npm test -- test/plan-beta-generation.test.ts test/plan-beta-selection.test.ts test/prescription-runtime.test.ts test/prescription-pace.test.ts
(app) npm test
(impl) npm test
(app) npm run typecheck
(app) npm run typecheck:e2e
(impl) npm run typecheck
(app) npm run build
PLAYWRIGHT_PORT=4174 npx playwright test e2e/multi-event-personalized-prescription.spec.ts --project=desktop-chromium --workers=1 --headed
git diff --check
```

## Remaining unsupported combinations

- Sex-specific prescription: unmodeled; sex is not a runtime dose input.
- High/mid/low tier prescription: unmodeled; experience is not a performance score.
- 100-400m detailed prescription: deferred, with explicit RPE fallback.
- DEVELOPING or NEW_TO_RUNNING detailed prescription: RPE fallback under current approvals.
- Missing or unselected CURRENT same-event anchor: explicit RPE fallback.

## Cleanup receipt

- Removed current-worktree `app/dist`, `impl/dist`, and `app/test-results` after evidence capture.
- Confirmed no listener remained on isolated QA port 4174.
- Left unrelated port 4173 PID 4188 untouched after verifying it belongs to `.worktrees/plan-fast-preview-comparison`.
- Retained ignored `node_modules` dependency installs in the dedicated worktree.
- No push, merge, commit, reset, clean, or unrelated source change was performed.
