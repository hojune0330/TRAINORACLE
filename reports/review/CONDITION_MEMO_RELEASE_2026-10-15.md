# Approved condition/memo and calendar release

User approved all identified improvements and deployment. Base: main 38b638db.

## Implemented
- Existing record can save removal of its final fixed pain marker; new empty records still cannot save.
- Weight/heart-rate reject nonnumeric, nonfinite and nonpositive input; no new medical ranges.
- Invalid sleep can be left with Back without silently accepting/saving it.
- Review edits do not build a repeated Back stack; empty new review has no Save action.
- Memo uses readable labels, brief storage/use summary and optional storage details.
- Private-code setup starts with new-user/existing-code choices; crypto and ownership checks unchanged.
- Condition entry reuses body category identity; body history keeps pain degree prominent and source metadata expandable.
- Includes preceding approved calendar role-visibility/readability and condition-screen work documented in adjacent reports.

## Evidence
- Four focused test files: 35 cases passed across final file runs.
- Browser synthetic flow at 320/375px passed: numeric rejection, repeated review editing, Back, guarded exit, memo code reveal. Memo screenshot reviewed at 320px.
- Earlier calendar focused tests and 320/375/1280 browser results are recorded in the calendar reports; unchanged logic was not redundantly re-run.
- Negative control: restoring the old empty-input guard fails the exact persistence assertion (rKnee:2 remains instead of empty). Guard restored immediately.
- Type check passed before the final test-only optional-access correction; final run accompanies release.

## Release boundaries
Use preserving guarded manual Pages publication, retain prior assets/previews, preserve account hold. No backend/auth activation, medical-rule change, schema migration, or unrelated PR merge.
Local browser evidence is not physical iOS or authenticated-account proof. Hosted CI and public publication are reported separately in the task; this document does not claim publication before it happens.
