# Workout Reading Follow-up: 2026-10-26

## Scope

Owner-approved implementation of the workout memo/design review. Baseline:
`b068289573858d44548877570c5591198cc996bf`. Changes are local and uncommitted.
This is not a production release, real-account persistence test, or athlete study.

## Implemented

| Area | Result |
| --- | --- |
| Reader | One paper; MAIN-first default; two depth choices only |
| Detailed view | Preparation/main/cooldown; rationale separately disclosed |
| Wording | Plain/coaching notation accessible in both depths without exporting |
| Preparation | Structured step rows; original recovery semantics retained |
| Targets | Duplicate whole-second 1km targets removed; fractional/long-rep precision retained |
| Dates | Repeated date/slot omitted only when the surrounding reader supplies them; exports retain date |
| Adjusted schedules | Same paper and date/title deduplication in single/multiple adjusted schedules |
| Comparisons | Current/changed MAIN values first; one full paper per version on expansion |
| Explanation | Ineffective global expert toggle removed; named disclosures retain technical material |
| Evidence | Loading, empty, failed, mismatched distinguished; retry rereads; verified same-scope content retained through temporary failure |
| Navigation | Original-journal Back lifecycle, AM/PM persistence, current-day focus restoration fixed |
| Export | Source/account/close/hidden/inert/CSS-hidden cancellation; inactive readers do not intercept Escape |
| Visual | Readable warnings, disclosure chevrons, fewer lines, both reduced-motion settings |
| PNG | 1080px width; body >=48px, supporting text >=42px; no shrink/crop of long prescriptions |

No prescription dose, pace selection rule, record anchor, journal snapshot, account
schema, or training safety gate was changed. PREVIEW/HISTORICAL context and actual
numeric provenance remain; generic effort-only provenance stays in rationale.

## Verification

- 15 directly affected Vitest files passed across focused batches. One broad
  attempt completed 12 files / 233 assertions but had three worker-start errors;
  those three files plus the final CSS-hidden memo change passed in a separate
  four-file / 31-test run. Counts overlap and are not summed as unique tests.
- Browser memo matrix: 18 combinations, 320/375/1024px, full/brief and three papers.
  Enlarged text tokens, keyboard depth switching, OS/app reduced motion, copy,
  actual PNG download, and nested reader Back passed.
- Actual plan-reader fixture: 320/360/1280px prescription -> detail -> export ->
  rationale -> Back. The first 320px attempt timed out before page setup, not on
  an app assertion. The same 320px scenario passed on targeted rerun.
- PNG: 1080 x 2336, 104726 dark pixels, opaque background. Full and compact exports
  were generated; full PNG and 360px plan-reader screenshot visually inspected.
- App and E2E typechecks passed. The final captured-root null guard passed the
  app typecheck and a separate memo regression rerun (1 file / 26 tests).
- Build runtime check and Vite production build passed (2871 modules, 39.54s).
  The build preceded only the final null guard, which was typechecked and tested
  afterward. Existing runtime font-path, mixed import, and bundle-size warnings
  remain; browser checks confirmed the font loaded.

Evidence: `evidence/workout-memo-20261026/`,
`evidence/workout-reader-20261026/`,
`evidence/workout-reader-20261026-narrow/`.

## Boundaries and Follow-up

- No production writes, commit, push or deployment in this task.
- Local fixture URL: `http://127.0.0.1:4491/e2e/fixtures/prescription-delivery.html`.
- Test inputs are synthetic. No real athlete journal/account data was written.
- Real middle-school athlete usability, native iOS sharing/zoom, and production
  account round trips remain separate acceptance work. Synthetic results do not
  establish that user fatigue has been eliminated.
- Existing unrelated mobile-touch screenshot, `app/.scratch/`, and tsbuildinfo
  were preserved. Runtime worker/page-start delays were recorded, not waived.
