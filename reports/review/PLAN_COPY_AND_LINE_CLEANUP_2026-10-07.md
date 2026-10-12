# Plan Copy and Line Cleanup

Date: 2026-10-07

## Request and Scope

- Reduce the long incomplete-workout notice in the 10-day training plan.
- Remove repeated decorative boundaries from plan summaries.
- Apply the preceding background review to in-progress journal writers and quick-log summaries.
- Preserve training values, safety gates, calendar meaning, saved decoration choices, and finished-journal themes.

## Applied

1. Today and recommendation views share `IncompleteWorkoutNotice`.
   - Default: `반복·휴식이 아직 없어요` with a named help disclosure.
   - Visible caution: `이 시간 내내 강하게 뛰지 마세요.`
   - The original explanation remains inside the disclosure.
   - Existing guidance generation is unchanged: a complete catalog-bound workout does not receive this warning.
2. Removed status top/bottom rules, the first-session top rule, calendar exterior rules, and boundaries around supplementary plan disclosures.
   - Sibling sessions, calendar cells, selection/focus indicators, inputs, save errors, and action boundaries remain.
3. Journal writers no longer place a full-page equipped theme behind form controls.
   - A small saved motif remains.
   - Owned items, equipped selections, finished-journal themes, saved coordinates, and persistence are unchanged.
4. Removed the repeating horizontal gradient from quick-log paper.
5. Updated the current visual standard and added a presentation-only legacy plan fixture.

## Evidence

- TypeScript check: passed, exit 0.
- Four focused test files: 43 passed, 1 failed (44 total).
- All new notice, writer-preservation, and line-cleanup assertions passed.
- Remaining failure: the existing Oracle/Trends header test expects `64px minmax(0, 1fr) 64px`; the header already uses `64px minmax(0, 1fr) auto` at HEAD `a94a768fa2fb3463976ddf4356f2e0a2b4ed4a05`.
  Both the mismatching expectation and implementation were confirmed in HEAD. Neither was changed to silence this unrelated test.
- Mutation proof: temporarily restoring the status border caused the new line-cleanup assertion to fail at `.instant-plan__status`. The injected border was removed, and the assertion passed in the final focused run.
- Browser: synthetic 10km, 10-day recommendation reached through the real local intake/refinement flow. No plan activation, account write, athlete-record write, or journal save was performed.
- This fresh detailed plan did not show the incomplete-prescription notice.
- Separate synthetic legacy fixture: collapsed and expanded notice verified; keyboard Return closed it; at 320px the document width was 320px and summary tap height was 44px.
- 200% text enlargement and authenticated account round trips were not tested in this scoped pass.

Screenshots:

- `evidence/plan-readability-20261007/ten-day-preview-375.png`: real local 10-day preview with reduced exterior rules.
- `evidence/plan-readability-20261007/legacy-notice-375-closed.png`: synthetic old/incomplete plan, default compact notice.
- `evidence/plan-readability-20261007/legacy-notice-320-open.png`: full original explanation on a narrow screen.
- `evidence/plan-readability-20261007/legacy-notice-summary.png`: compact screenshot for the close-out.

## Boundaries and Remaining Scope

- This is a local implementation, not a public deployment or production-account verification.
- Missing repeat/recovery values in legacy generic MAIN prescriptions have not been invented or filled by this presentation change.
- The preceding full background audit is not entirely implemented: finished-journal background layering and theme-description discrepancies remain outside this patch.
- No training-dose, recommendation, adaptation, record calculation, privacy, ownership, or online-storage policy was changed.
