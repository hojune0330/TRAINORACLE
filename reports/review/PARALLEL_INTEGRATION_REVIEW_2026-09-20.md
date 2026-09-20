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

## Deployment Boundaries

- `account-journal` and `account-plan-collection` Edge Functions were deployed with matching generated validators. Auth and owner-scoped guards are retained.
- No operational database migration, COROS credentials, provider switch, or plan-trash activation is performed by this integration.
- Local rehearsal and server deployment are not proof of a real user's authenticated end-to-end save.
- Final exact-head CI, merge commit, Pages receipt, asset checks, and public smoke results must be recorded on PR #345 after completion. This report does not claim those pending steps have passed.
- Preserve other worktrees and their uncommitted evidence. Scratch output is excluded from the commit.

[DRAFT_COMPLETE]
