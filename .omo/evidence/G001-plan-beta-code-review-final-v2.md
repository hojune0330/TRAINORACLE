# G001 Plan Beta Final Code/Safety Review v2

**Verdict: APPROVE**

- `codeQualityStatus`: `WATCH`
- `recommendation`: `APPROVE`
- `blockers`: none
- Review base: `origin/main` = `HEAD` = merge-base `8d6d80248fbee67b2dba2f81bedefa95ba05bee2`; all Plan Beta work remains uncommitted.
- Scope: latest tracked diff and untracked Plan Beta production, tests, documentation, and referenced evidence. The date-boundary fix and documentation were reloaded after concurrent updates.

## Findings

### CRITICAL

None.

### HIGH

None.

### MEDIUM

**M1 — The new PlanBeta regression proves the future-date branch, but its calendar-invalid fixture is not causally exercising calendar validation.**

At `app/src/screens/PlanBeta.contract.test.tsx:146-155`, `2026-02-31` is already older than the current 14-day window. Removing `isValidIsoDate()` from `structuredJournalSource()` would therefore still leave that fixture excluded by the lower date bound. The two 2099 records do correctly prove the newly added upper bound and make the overall test non-tautological.

This is not a current production blocker:

- Shared calendar validation is behaviorally covered at `app/src/domain/engagement.test.ts:70-82`.
- An independent production-build probe with two malformed strings that sort inside the current window (`2026-07-20x`, `2026-07-21x`) observed `inWindowInvalidContextLabelCount: 0` and `profileOnlyLabelCount: 1`.

Recommended follow-up: make the PlanBeta fixture itself use at least two calendar-invalid strings that sort inside the generated `from <= date <= today` window. That would make the test fail if the PlanBeta validator call is removed.

### LOW

None.

## Resolved Blockers and Required Behaviors

- **Truthful journal provenance:** `app/src/domain/plan-beta-flow.ts:196-211` now requires post-session kind, shared calendar validity, and the complete inclusive recent window before emitting `RECENT_JOURNAL_CONTEXT`. Production-build probes now return `PROFILE_ONLY` for both future/invalid and malformed-in-window records.
- **Shared date boundary:** `app/src/domain/dates.ts:22-31` owns `isValidIsoDate`; engagement reuses it at `app/src/domain/engagement.ts:9-11,93-99`.
- **No safety override:** recent journal risk is checked before the current answer at `app/src/domain/plan-beta-flow.ts:79-85`. Structured evening pain `>=4` and analyzable memo `ACTIVE`/`UNKNOWN` continue to block.
- **Both current-check variants use the full chain:** `PlanIntake` passes `NO_KNOWN_RISK` and `REVIEW_REQUIRED` through `PlanBeta` to `currentCheckGate`, which executes D9 → RVE → Safety Gate and catches evaluator exceptions as fail-safe `UNKNOWN` (`app/src/domain/plan-beta-flow.ts:169-175`).
- **Private memo remains private:** `app/src/safety/memo-safety.ts:52-57` does not call the evaluator unless purpose is `ANALYZABLE_TRAINING_NOTE`; its contract test verifies the private/unlabeled branches do not invoke D9.
- **No raw text in plans/audits:** Plan Beta request/output types and audits remain structured-only. Raw memo/evidence clauses are removed at the transient adapter boundary.
- **Journal values do not alter prescriptions:** `impl/test/plan-beta-generation.test.ts:274-295` compares journal-context sessions with profile-only sessions and proves equality.
- **Points date safety:** future and calendar-invalid dates earn no points through the shared validator and upper bound.
- **README honesty:** `README.md:3-19` clearly distinguishes the currently public journal from the branch's pending beta deployment.
- **Documentation consistency:** the public action name, engine count (36), and app count (114) now match the latest worktree.

## Independent Validation

- Focused app regressions: 2 files, 15/15 passed.
- Full app Vitest: 19 files, 114/114 passed.
- Plan engine Vitest: 4 files, 36/36 passed.
- App TypeScript: passed.
- E2E TypeScript: passed.
- Plan engine TypeScript: passed.
- Vite production build: passed; 1,723 modules transformed.
- Focused launch/safety Playwright: 17 passed, 3 intentional desktop-only skips.
- Production-build future/invalid probe: `futureOrInvalidContextLabelCount: 0`, `profileOnlyLabelCount: 1`.
- Production-build malformed-in-window probe: `inWindowInvalidContextLabelCount: 0`, `profileOnlyLabelCount: 1`.
- `git diff --check origin/main`: passed; only line-ending conversion warnings were emitted.
- Lint and static/security scan: N/A; neither package configures those scripts.

## Maintainability, Types, and Scope

- No new `any`, type-ignore, non-null assertion, or enum escape hatch was found in the Plan Beta production scope.
- Boundaries use typed unions and Zod/manual parsing where data is untrusted or persisted; no unnecessary raw-text extraction or normalization enters the plan engine.
- Production TypeScript remains below the 250 pure-LOC ceiling. `PlanBeta.tsx` (204), `plan-beta-flow.ts` (218), and `candidates.ts` (231) are in the 200–250 warning band and should be split before substantial growth.
- The oversized CSS and table-style engine contract suite retain explicit first-line `SIZE_OK` explanations.
- Beta limits remain explicit: limited confidence, duration/RPE-only prescriptions, non-universal event-group scope, browser-local persistence, and no automatic progression.

## Skill-Perspective Check

The mandatory `omo:programming` TypeScript perspective and `omo:remove-ai-slops` overfit/slop pass were reloaded and applied; `omo:git-master` status guidance was also applied.

- `programming`: current production code passes the type/boundary review. M1 is a test-isolation weakness because one claimed input class would not fail if the PlanBeta validator wiring regressed.
- `remove-ai-slops`: no deletion-only, requested-removal-only, tautological, implementation-constant-only, or unnecessary production parsing test was found. M1 is the only false-confidence watch item; the future-date portion of the same test is behavioral and non-tautological.

## Blockers

None. M1 is a recommended test-strengthening follow-up and does not overturn approval because current production behavior, the shared validator, and independent built-app edge probes are all correct.
