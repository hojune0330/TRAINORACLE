# PARALLEL_INTEGRATION_REVIEW_2026-09-20.md

## Scope

- Owner request: combine reviewed parallel development and current design, then merge and deploy.
- Integration PR: #345, targeting main. Base inspected: `83211de5943365cdcfb7798c01548fb91d62661e`.
- Fable #343 is already merged at `27cc6d5705a58f55eb3e07140a7f932d1118269c`; its recommended choices, MIX default, and progressive disclosure are retained.
- #344 instant-plan flow, #338 child-screen return navigation, and #337 COROS protocol/storage foundation are included with their Git ancestry.
- #320 is superseded, not merged wholesale: all 100 paths exist in current main, 71 have identical blobs and 29 have newer implementations. Reintroducing its local-only storage would regress online write guards.

## Integration Repairs

1. Preserve current home, grouped daily journals, rewards routing, and direct Korean labels while restoring child-screen origin navigation.
2. Regenerate shared journal, encrypted state, and plan collection validators. Current explanation content had changed fingerprints without updating server artifacts.
3. Regenerate review artifacts without changing exercise dose or claiming a new scientific approval.
4. Move the unapplied COROS daily inbox migration from duplicate version 0038 to 0039. Existing 0038 file-analysis migration is unchanged. Add a unique-version regression check.
5. Restore the optional install-shortcut suggestion lost during the home redesign. It stays absent for new guests, appears after eligible use, can be dismissed, and restores focus after installation.
6. Update browser journeys to open intentionally collapsed content before asserting actual prescription, evidence, provenance, and cycle values. No new skips or weaker numerical assertions.
7. Keep the restored install suggestion compact (populated home measured 1,073px, within the existing 1,100px limit; 44px touch targets retained).
8. Reserve layout space for persistent review notices so they do not cover journal actions. Keep the notice until explicit dismissal and maintain one modal-owned copy in the editor.
9. Capture the exact scroll position when opening a session explanation and restore it with focus when closing. Do not start a second alignment animation that competes with position restoration.

## Verification Evidence Before Final CI

| Check | Result and boundary |
| --- | --- |
| Focused integration unit recheck | 81 passed, 3 pre-existing skips |
| Home/install contracts | 20 passed |
| COROS protocol/storage/export and lifecycle | 58 passed |
| Account storage, crypto, recovery, ownership and PostgreSQL rehearsal | 186 passed; no production database writes |
| Migration boundary/version checks | 3 passed |
| Mobile and reduced-motion integration, navigation, launch, disclosure | 38 passed, 2 existing desktop-only skips |
| Broad desktop audit before repairs | 138 passed, 26 failed, 28 existing skips; not a passing release gate |
| Recheck: records, home, feedback, archive, revisit, provenance | 14 passed |
| Recheck: exact prescription, record changes, method target and cycle lineage | 17 passed |
| Recheck: install suggestion, dismissal, focus and narrow-screen guidance | 4 passed |
| Recheck: energy provenance and decoration motion | 2 passed |
| App and e2e TypeScript | Passed |
| Maintained production build (`--emptyOutDir=false`) | Passed; pre-existing chunk/font build warnings remain |

### Follow-up Mobile Audit

- Broad mobile audit: 176 passed, 4 failed, 12 pre-existing skips. Three actual UI integration problems (home height after install restoration, persistent toast overlap, explanation return scroll) and one collapsed-content test mismatch were identified.
- Home/install mobile and 320px recheck: 12 passed.
- Dialog/journal comparison on desktop, mobile, 320px and reduced motion: 20 passed; associated contracts: 46 passed.
- Youth/self-directed plan personas: 3 passed.
- Compact install/home contracts: 21 passed.
- Intermediate CI run `35512146435`: contract-tests passed; app units reported 4,262 passed, 1 failed, 35 existing skips. The legacy V5 account UI round-trip clicked while the mount-triggered server read could still be loading. Its fixture now explicitly waits for service READY instead of interpreting the previous save receipt as readiness. A local re-run of all V4/V5/V6 cases passed before the additional readiness assertion; the exact final CI remains the release gate.

## Deployment Boundaries

- CI run `35512922404`: contract-tests and app-quality passed (4,264 unit tests passed and 35 existing skips in each timezone). Browser verification found one mobile exact-scroll restoration failure. The return alignment animation was replaced with captured-position restoration, without weakening the pixel assertion; all 20 explanation browser cases passed locally afterward. The final-head gate is still required.
- CI run `35514958977`: contract-tests and app-quality passed; desktop and mobile browser projects passed. The 320px popover test still expected the replaced goal-entry question. It now enters through the current minimal form and checks the training-experience help, preserving width, outside-tap and Escape assertions. The focused 320px test passed.

- `account-journal` and `account-plan-collection` Edge Functions were deployed with matching generated validators. Auth and owner-scoped guards are retained.
- No operational database migration, COROS credentials, provider switch, or plan-trash activation is performed by this integration.
- Local rehearsal and server deployment are not proof of a real user's authenticated end-to-end save.
- Final exact-head CI, merge commit, Pages receipt, asset checks, and public smoke results must be recorded on PR #345 after completion. This report does not claim those pending steps have passed.
- Preserve other worktrees and their uncommitted evidence. Scratch output is excluded from the commit.

[DRAFT_COMPLETE]
