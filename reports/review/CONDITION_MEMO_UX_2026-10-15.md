# Condition/memo focused UX review — 2026-10-15

Scope: EveningCheckin only. Existing calendar work remains separate. No publication requested.

Findings and implementation:
- Duplicate Back controls: retain TopBar Back and existing native Back handling; remove question-level duplicate.
- Date dominated all non-body questions: consistent compact semantic date; remove live clock (not a saved timestamp).
- Undifferentiated entry buttons: reuse category-card and body-color tokens with distinct icons and destination arrows.
- Review labels too small: scoped readable cards showing only supplied answers; optional additions remain available.
- Metrics lacked visible labels: persistent labels, decimal/numeric keyboards, no example numbers resembling supplied answers; stack at narrow widths.
- Inconsistent continuation: full-width input-review actions without nested action containers.

Unchanged: body diagram and side/level editor, safety rules, metadata history, memo privacy selection, draft storage, account isolation, validation and explicit persistence. No default measurements invented.

Evidence:
- EveningCheckin discovery + JournalBodyInput flow: 17 tests passed.
- TypeScript noEmit passed.
- Browser synthetic-input flow at 320 and 375px: selection, metrics, review, mood, Back retention, exit dialog, continue-writing; passed again after final action-width refinement.
- Fault injection removing the visible weight label fails the named browser label assertion. No production source mutation for fault run.
- Screenshots under .scratch/condition-review. Visual review found undersized continuation action; corrected.

Limits: Chromium desktop mobile-sized viewports, not physical iOS/keyboard or authenticated account round-trip. No child usability study. Not committed, pushed, merged or deployed in this task.
