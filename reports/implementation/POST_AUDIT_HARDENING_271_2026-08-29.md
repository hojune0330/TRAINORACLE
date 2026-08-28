# TrainOracle Post-Audit Hardening Report — PR #271 Follow-up

## Basis

- accepted review record: `reports/review/FABLE_POST_MERGE_AUDIT_263_270_2026-08-28.md`
- review base: main `fb171d9`
- follow-up base after report merge: main `d3919c0`
- implementation branch: `codex/post-audit-hardening-271`

This follow-up addresses the four non-blocking observations without changing training
prescription science, plan eligibility, D9 authority, private memo boundaries, account
permissions, or point rules.

## Implemented Deltas

1. Pages deployment fetches and compares `origin/main` again immediately before the
   verified gh-pages commit is pushed. A stale run exits without publishing.
2. Personal Oracle sorts jointly most-frequent energy systems by stable public code and
   explicitly says `동률` and `모두 N회` instead of relying on implicit list order.
3. The training-content contract now defines an append-only discovery, source review,
   editorial review, owner read-only acceptance, publication, correction, and withdrawal
   pipeline. Existing open issues remain open.
4. Runtime content entries expose revision, read-only publication state, publication
   date, and nullable correction notice. A correction notice has a visible rendering
   path.
5. The plan cloud notice moved presentation rules from JSX into shared CSS, and the
   visual contract now guards the audited new surfaces against inline style attributes.

## Verification

- deployment source-guard tests: `3/3 PASS`
- focused personal Oracle, content, correction-rendering and visual contract tests:
  `16/16 PASS`
- app TypeScript and production build: `PASS`
- full app unit suite: `1,766/1,766 PASS` in the default run and
  `1,766/1,766 PASS` in the KST run
- hosted release-environment tests: `11/11 PASS`
- focused browser assertions: `16/16 PASS` across desktop, mobile, 320-pixel touch,
  and reduced-motion projects
- local Playwright cleanup: `INCONCLUSIVE`; every selected assertion completed, but the
  direct runner did not terminate its preview process and was interrupted. The GitHub
  `app-browser` job remains the decisive browser gate for this branch.

The first focused run caught an unnatural Korean particle in the tie sentence. The text
and its regression assertion were corrected before the final full-suite evidence above.

No production deployment is requested by this report. The branch must be reviewed at an
exact pushed SHA before merge.
