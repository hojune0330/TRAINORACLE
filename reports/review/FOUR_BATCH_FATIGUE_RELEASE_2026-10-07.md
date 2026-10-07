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
