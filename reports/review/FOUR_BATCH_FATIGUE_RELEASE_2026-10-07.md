# Athlete fatigue reduction: four-batch integration

Date: 2026-10-07

## Approved scope and completed changes

1. Journal and feedback: distinguish saved journal count from analysis-eligible records; acknowledge an RPE-only entry without inventing distance, pace, or adaptation. Optional pre-save plan-progress confirmation is unchecked initially and invalidated after answer changes. Save the journal first, recheck the plan, and keep the journal if the plan update fails. Saved-page secondary actions remain under a named menu.
2. Plan journey: remove repeated peripheral calendar/import/summary content from questions. Group candidate actions into schedule, workout adjustment, and recommendation evidence. Retain the visible start action, prescription numbers, unconfirmed changes and safety restrictions.
3. Home and Oracle: prioritize recording and the relevant result; profile/library destinations open directly. Explicit examples remain distinct from personal findings. Keep manager, friend, history and evidence features in named destinations. Do not report incomplete reads as no records.
4. Ancillary navigation: purpose-based More pages with return-position/browser-Back support; reuse stored race records from the pace-tool entry; show file preparation by provider without suggesting unsupported OAuth import; do not show an empty real calendar while records are unconfirmed.

Previously approved memo/background and cross-screen clarity work in this checkout is included. Remote commits 86234796, 9bcd031e and 247eec1d were integrated, preserving optional-date input, mounted intake state, shared title emphasis and contextual illustrations. The unrelated treadmill PR is excluded.

## Evidence boundaries

- Parent journal/storage/domain/Oracle checks: 124 selected tests resolved; the 23-test journal/More subset was rerun successfully after restoring the deliberate opt-in defect.
- Plan worker: 145 passed, one existing skip. Ancillary worker: 76 passed; 12 local browser cases across 320/375/1440 and reduced motion.
- Oracle worker: 14 local browser states across 375/1280; explicit example-mode defect detected and restored.
- Merge-conflict surfaces: 137 passed and one existing skip on the first run; the sole failed assertion was a renamed stale-calendar message, subsequently corrected and rerun separately.
- TypeScript app check passed after resolving the source merge. No formulas, auth permissions, database migrations, provider credentials or health-data transfers were added.
- Deliberately prechecking plan completion caused both new consent tests to fail. The production source was restored before release.
- Parent isolated guest journeys cover plan creation, confirmation, saved journal, Oracle count and More/restore/browser Back at 320/375. Screenshot inspection caught the new RPE-only summary occupying an icon column; the layout was fixed and a minimum text-width assertion added.

The local browser files are synthetic observations, not evidence from real adolescent athletes. Production publication, CI and authenticated-account round trips are separate evidence levels. Current shared-origin account hold remains in force. The existing unrelated e2e TypeScript `reducedMotion` option errors in two legacy files were not broadened into this release.

## Reproduction

- `reports/review/fatigue-release-journey-20261007.mjs` runs the integrated guest journey against a supplied local or public URL.
- `reports/review/batch3-entry-fatigue-20261007.mjs` checks the home/profile/library journey.
- `app/playwright.batch4.config.ts` covers ancillary discovery and state handling.
- Before/after observations: `ATHLETE_FATIGUE_JOURNEY_AUDIT_2026-10-07.md` and local evidence under `reports/review/evidence/fatigue-release-20261007/`.

## Remaining observation, not unimplemented scope

Actual athlete hesitation, iPhone Safari text scaling and authenticated multi-device saves have not been established by these synthetic tests. Complete-plan calendars remain scrollable rather than hiding days or truncating information. A public smoke check and deployed source receipt must be recorded separately in the PR after publication.

## Public release evidence

- PR #350 merged as `a36631b39d5cedd37c6636c832cf837003930a7a`.
- Manual Pages commit `72ce2a5ac1a93b3f98b7b475927a5ef229ec2e2c` was built successfully. It preserves existing previews and prior hashed assets on top of `353f52fa019c7babc74e78c8552392ec1e73bf0d`.
- The canonical public build manifest and deployment receipt both returned the merged source SHA. Oracle V2 remains enabled and the existing account hold remains unchanged.
- The integrated public guest journey passed 18 states across 320/375px with no page errors or document horizontal overflow. A separate visit to `?app=1`, without test mode, confirmed the ordinary canonical entry and navigation.
- Release evidence was posted to [PR #350](https://github.com/hojune0330/TRAINORACLE/pull/350#issuecomment-6034309462).

## CI follow-up boundary

Full PR CI `37593853861` passed contract-tests, but app-quality failed with 55 tests in 18 files (607 test files passed, seven skipped). Browser and automatic deployment jobs did not run. This is a failed full CI result, not a successful release gate.

The follow-up updates outdated labels and disclosure navigation while retaining save, ownership, safety, explicit confirmation and return-navigation assertions. It also restores the real journal visibility exports in the file-comparison test mock. The memo's owner-approved `brief/detail` mode label is exempted narrowly by its source declaration, not by relaxing the prohibition on unnamed generic actions.

The focused review found one real rendering regression: opening record management or notation help from the initial plan form hid the preserved draft but did not render the requested supporting view. `PlanBeta` now renders that view beside the mounted, hidden draft and suppresses unrelated plan tools until returning. All five entry-navigation tests pass, including current/goal draft preservation and the separate unsaved-record guard. The public journey script now includes both supporting-view round trips with an unsaved decimal record; all 22 local states pass. This fix requires a new release, not merely a test-only update.

Final focused results: all 18 previously failing files pass, with 142 distinct tests (24 plan-entry, 33 plan/journal presentation, 67 shell/records/Oracle, 18 copy/segment/comparison). The 33-test and 67-test subsets also pass under KST; those reruns are not added to the distinct count. App TypeScript passes. No test was skipped or deleted to obtain this result, and no full CI pass is claimed. The existing decoration/calendar render-update warning remains a separate observation; it was not suppressed or changed by this patch.
