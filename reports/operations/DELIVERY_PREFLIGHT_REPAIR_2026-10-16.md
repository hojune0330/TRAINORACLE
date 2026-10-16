# Delivery preflight repair — 2026-10-16

## Causes separated

- A sandbox-local Playwright cache path did not contain the installed browser. Explicit `PLAYWRIGHT_BROWSERS_PATH` selects the existing installation; no browser reinstall is needed.
- Independent server/browser launches mixed execution contexts and began tests before demonstrated app readiness. The local preview runner now owns one loopback server, verifies HTTP and app navigation in the browser, then starts the selected tests. Failures are propagated, not converted to passes.
- Responsive candidate assertions counted both the primary recommendation and the comparison. Scope to the comparison preserves its one-expanded-candidate contract.
- Same-position, rapid pointer answers could trigger the deliberate double-tap guard. These journal lifecycle scenarios use keyboard slot activation, as other existing progression tests do. The guard itself remains unchanged.
- The upward popover covers the heading. Tapping its uncovered viewport gutter validates outside-touch dismissal without forcing a click through the note; Escape coverage remains.
- Reduced motion intentionally fixes the camera/background. Assertions distinguish this from ordinary tracking. A real short-landscape jump/HUD overlap was found and static headroom added, without altering game physics or adding motion.
- Main `6384e91f4ad7a9bc084b68542f4ddd685ad31771` was incorporated. Its source-backed UI and the prior delivery fixes are retained; the two merge conflicts were resolved explicitly.
- Its ViewSwitcher uses radio semantics (`radiogroup`, `radio`, `aria-checked`, Space activation), and the day reader returns either to the calendar or day list. Update the affected browser consumers together, retaining selection, focus restoration, persistence and navigation assertions.
- Use the available Node 22 runtime with npm 11 for this lockfile. An interrupted installation and the older bundled npm 10 produced unrelated compiler/lock errors. A complete npm 11 offline installation restored 425 packages without modifying the lockfile.

## Observed evidence (not publication proof)

- Before rebuilding the integrated UI: 32 mobile/narrow browser cases passed; the remaining popover case was reproduced, fixed, and passed separately. One desktop-only exclusion in that selection was skipped as declared by the original test.
- Final integrated focused browser run: 12 passed across mobile, narrow-touch and reduced-motion projects, covering radio keyboard/large labels, edited-plan partial journal and successor lifecycle, obstacle continuity, and landscape jump/HUD separation. The real camera defect passes on the rebuilt integrated app.
- CI gate/changed-scope tests: 10 passed, including rejection of failed/cancelled/incomplete results.
- Integrated application and browser TypeScript checks and production build passed. Focused camera and home-summary unit tests: 13 passed. Integrated calendar flow/month navigation and basic compact-control browser cases: 6 passed; radio keyboard activation was subsequently corrected to Space and passed on mobile.
- The `[manual-pages]` main-commit marker suppresses only automatic publication. All release gates remain mandatory; manual publication must follow their successful settled-source results.

No merge to main, publication, or authenticated user transaction is asserted by this note.

## Integrated-source contract reconciliation

Hosted run 38837999756 exposed further tests still asserting pre-6384e91 UI:
radio roles and return labels in unit fixtures, the old recommended-reading article,
the old chooser heading level, hidden next-workout prescription, and the old compact
plan metric string. Both timezones reported the same 16 failures in 10 files; the
remaining 8,740 unit cases passed. The corrected 10 files pass all 102 focused cases.

Browser assertions now target the real workout-opening control and current static
metric cards plus optional summary/evidence motion. Detailed same-day instructions
are permitted to grow vertically; both session controls must be reachable, unclipped,
and the afternoon must still open its own diary. No text is hidden to satisfy old
one-viewport assumptions. The dedicated TCX import/account ACK/plan reload/original
comparison case passes after matching the detailed prescription already displayed.

A complete local desktop inventory finished: 285 passed, 29 existing conditional
skips and 5 failures. The four old Oracle reading-entry assertions were corrected
and passed together; the remaining game sample landed on a RAF/integer-second
boundary. Absolute rounded replay deadlines and sampling inside second 13 keep the
exact time assertion and all geometry assertions; this passed in all four projects.

Run 38839967916 also revealed rapid same-position refinement clicks under reduced
motion hitting the intentional double-tap guard. The shared refinement helper now
uses deliberate keyboard activation, preserving product pointer protection.
Calendar/method/two-tab replay scenarios passed all 8 narrow-touch/reduced cases;
the pointer-protection unit tests passed 3/3. Current detailed-card/optional-motion
scenarios passed 6/6 in narrow-touch and reduced projects. These focused reruns are
not represented as a single clean full-inventory run or hosted release pass.
