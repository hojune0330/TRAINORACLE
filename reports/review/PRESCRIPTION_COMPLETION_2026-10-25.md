# Prescription completion follow-up

## Implementation boundary

Working checkout: `.scratch/oracle-prescription-20261025`, based on `e8cad36c`.
This report describes local changes, not a production release or a real-athlete study.

- Removed legacy-template exclusions from default MAIN completion and initial condition review.
- Added a shared unresolved-MAIN check to candidate UI and activation, including the existing
  lock-time recheck. Historical plan reads and original journal snapshots are not rewritten.
- Moved the first dated MAIN ahead of the start action; moved all-plan comparison and supply
  details after it. Full schedule and editing paths remain available.
- Exposed the existing record-pace offer on the result screen, with workout preview, duration
  differences and an explicitly named apply action. Existing same-event eligibility is unchanged.
- Shared bounded short effort text across plain notation, detailed reading and memo output.
- Preserved the existing alternate-method pool and subsequent-cycle adaptation rules.

## Evidence

- Focused regression batch: 201 tests passed across 12 files.
- Subsequent-cycle, alternative-method, notation and shared UI batch: 105 tests passed across 6 files.
- Seven fresh browser journeys: real record input, explicit pace application, device save,
  reload and navigation back to the training tab passed for all seven supported events.
- Compact result check: 320/360/1280 widths and 320px with 200% root text sizing passed.
- Separate detailed-reason/memo browser checks passed at 320/360/1280 widths, including keyboard
  disclosure and return navigation. These are fixtures, separate from the real intake journeys.
- At 360x800, the no-record/developing/three-day result start button was at y=505px (52px high),
  compared with approximately y=2775px in the prior review. This is one measured scenario.
- Two edited-MAIN lifecycle journeys passed: partial and completed journal entries each led
  through journal reading to the next cycle. In total, 13 focused browser tests passed.
- Application and E2E type checks and a production-mode Vite build passed. Existing font-path,
  mixed-import and large-chunk warnings remain; this was an environment-free review build.

The initial automated reload check incorrectly expected to remain on the training tab.
The application correctly returned to Home; the test now navigates back through the Training tab.
The half/marathon browser probe initially attempted a nonexistent hours field; actual UI takes
minutes and seconds, and the corrected journeys passed with 90 and 180 minutes respectively.
The first lifecycle run hit a development-server dependency cache under Playwright's cleaned
output directory (504 Outdated Optimize Dep). Moving the cache into a separate scratch directory
and rerunning both journeys resolved the failure without changing journal behavior.

## Delivery boundary

Preview: http://127.0.0.1:4491/?app=1
No production deploy, account-server round trip, or participant usability acceptance is claimed.
The owner subsequently requested review and merge. This change is prepared for a fast-forward
integration into main; production deployment remains a separate action.

## Final merge review

The expanded review found and corrected three integration regressions:

- Moving the legacy single PACE_TARGET MAIN also redrew companion MAINs and changed support
  prescriptions. Remaining MAIN selection now uses its stable ordinal in this path, while
  legacy support sessions remain unchanged. Initial candidate comparison allows independent
  placement only for an identical complete MAIN work set. The strict adaptation predicate
  and all dose, eligibility and source checks remain unchanged.
- The unresolved-MAIN activation gate also disabled the condition-review entry. Reviewing
  conditions is now independently enabled when its existing prerequisites are met; starting
  the plan still requires every MAIN to be resolved.
- Switching to the schedule discarded pending condition checkboxes. The condition panel now
  stays mounted while hidden. Existing invalidation on source/account changes still applies.

Historical-plan fixtures now explicitly exercise the pre-catalog creation and saved-plan read
path rather than passing an incomplete historical plan through new-draft activation. Unsupported
new-draft cases explicitly assert MAIN_CONFIGURATION_REQUIRED and no active-plan write.
Multi-MAIN tests still require each unresolved slot to be completed independently.

Final checks on the corrected source:

- 895 relevant unit/integration tests passed across 41 files.
- 10 browser tests passed: seven actual intake/record-apply/device-save/reload journeys,
  one compact responsive result check, and partial/completed journal-to-next-cycle journeys.
  The earlier three detailed-reason/memo fixture checks are separate evidence, not extra
  executions in this final 10-test batch.
- Application TypeScript check passed. The earlier E2E TypeScript check remains applicable
  because the E2E source did not change in this merge review.
- Environment-free production-mode build passed. Existing font-path, mixed-import and
  large-chunk warnings remain. Build output and local diagnostics are excluded from the commit.
- Remote main was refreshed and matched the implementation base e8cad36c during review.
  Unrelated open PRs and other working checkouts were not incorporated or modified.

These checks are automated synthetic evidence, not athlete usability acceptance, scientific
validation of training effectiveness, or proof of production account persistence.
