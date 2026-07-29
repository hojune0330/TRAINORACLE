# Journal Revisit Rewrite Report

## Execution Record

- model: `gpt-5.6-terra`
- reasoning_effort: `xhigh`
- base_main_sha: `ccd73debd75ec9e84d0a4e561b42b7550710b8a6`
- historical PR treatment: PR #114 was inspected as stale history only. This change
  was written on the current main baseline; no branch was rebased, cherry-picked,
  or copied into this implementation.

## Delivered Behavior

1. A past day detail opens at the top of its scroll region.
2. Local, non-imported entries show a distinct edit action: `훈련 기록 수정`,
   `하루 마무리 수정`, or `경기 기록 수정`.
3. Edit forms preload the selected entry. A successful edit replaces the original
   storage item in place: its id, kind, date, saved time, and sync state do not
   change, and no duplicate entry is created.
4. `이 날짜에 일지 더 쓰기` opens the chooser for the selected historical date.
   Saving returns to that same date detail rather than to today's home screen.
5. Imported activity records and non-local records have no edit control. The domain
   storage function enforces the same restriction even if a caller bypasses the UI.
6. A legacy record without provenance remains provenance-unknown after editing; an
   edit cannot silently promote it to explicit analysis data.

## Preserved Boundaries

- No `editedAt`, revision history, or new version policy was introduced.
- Existing `journal-delete-dialog`, tombstone, trash, and restore behavior remains
  intact. There is no `window.confirm` path for journal deletion.
- Purpose-scoped memo handling remains unchanged. Private memo text is not added to
  analytics, plans, recommendations, exports by default, or D9 authority.
- Account opt-in, import, D9, training-plan, and safety authority behavior was not
  expanded by this work.

## Test Evidence

- PIN: existing delete, tombstone, and restore behavior: `2/2` checks passed.
- RED then GREEN: same-id replacement, imported write refusal, immutable identity,
  and legacy-provenance preservation: `4/4` checks passed.
- Form revisit coverage: post-session, evening, and post-race records preload and
  update in place: `2/2` additional form checks passed.
- Browser scenario: a `2026-07-20` 5 km / 25 min / RPE 6 entry was changed to 6 km,
  then an evening entry was added on the same date. The original id appeared once,
  the date contained two entries, and no console error occurred.
- Manual surface evidence: `.omo/evidence/task-4-surface-393x852.png` at 393 x 852.
- Final app verification: Vitest `40 files / 346 tests`, TypeScript app and browser
  typechecks, production build, and Playwright `161 passed / 35 conditionally
  skipped` all passed.
- Current repository contract suite also passed: D9 evaluator `11`, implementation
  suite `99`, and all formal catalog, advisory, and dependency validators.

## Independent Review Gate

This report is implementation evidence, not an independent approval. The PR remains
draft until an independent reviewer comments on the exact head SHA. The reviewer must
verify same-id replacement, historical-date addition, imported-entry exclusion,
legacy-provenance retention, delete/restore preservation, and the final CI run.

[DRAFT_COMPLETE]
