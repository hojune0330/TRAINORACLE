# Delivery regression alignment — 2026-10-15

Scope: PR369 delivery maintenance, preserving the latest approved main UI and
all existing journal, account, training calculation and release boundaries.

## Runtime corrections

- Compact only home destination-row spacing. Retain the permanent identity,
  plan/analysis/record order, optional introduction, all destinations, typography
  and 44px minimum controls. At 320px the measured home height fell from 1427px
  to 1227px (1248px with the reserved scrollbar gutter), below the unchanged
  1250px gate. Enlarged text and keyboard navigation remain covered.
- Track the visible half of the day reader and its clamped bottom, so a short PM
  session does not show AM as selected while the athlete opens PM records.
  Preserve manual scrolling and navigation; no automatic scrolling is added.

## Regression maintenance

Additional reproduced runtime fixes:

- Duplicate live journal IDs no longer block startup merely while collecting
  cleanup membership. Both originals remain byte-for-byte intact, and ambiguous
  update/delete operations still fail. Live IDs remain excluded from cleanup.
- Reader selection follows a focused, visible session without forcing scrolling;
  scrolling that session out of view returns selection to visible content.
- Landscape game status rows no longer overlap the jump arc. Exhaustion camera
  bounds are smoothed as a target, rather than clamping after interpolation and
  snapping the entire hazard lane. Simulation physics are unchanged.

Latest main uses direct home navigation, category cards, instruction definition
lists, a confirmed-empty calendar and a custom unsaved-journal dialog. Tests now
exercise those actual controls instead of waiting for removed accordions, labels,
illustrations and native confirmation prompts. Quantity, recovery, safety cue,
unchanged plan bytes, deletion/undo, private-draft non-persistence, return focus,
date and linked-session assertions are retained. Empty-save illustration coverage
now supplies a real distance instead of expecting an empty journal to be saved.

The short-session reader regression has a geometry-specific unit test and an
actual browser test. No tests are skipped, expected failures added or required
release gates bypassed. Generic four-project coverage and dedicated configurations
remain unchanged.

## Evidence boundaries

Independent quality/build and both timezone unit jobs now start together. The
unchanged delivery-complete gate still rejects a failed, cancelled, skipped or
unfinished unit lane before publication. A workflow regression test exercises
this exact dependency and final guard; parallel scheduling is not a waiver.

- Focused unit checks: 69 passed across five files (including reader, home and
  shell contracts). An earlier sandbox cache-rename failure ran no tests; the
  identical elevated rerun passed.
- Narrow-phone progressive-information and scroll-depth: 18 passed. Screenshots
  visually inspected; existing height limits are unchanged.
- Fresh type checks and production build passed before the final small reader
  correction; hosted CI must validate the exact committed candidate again.
- Focused calendar, deletion/undo, private memo cancellation and plan return paths
  passed. Other focused browser batches are being reconciled; this document is
  not a full browser-pass or deployment receipt.
- The account hold and disabled TrainOracle lounge entry remain in effect.
  AthleteTime's previous live deployment is not changed by this PR.

Merge/publication requires the exact candidate's existing hosted gates. The
preserving publisher must retain preview files and hashed assets. Public status
and deployment bytes do not prove an authenticated member posting round trip.

### Follow-up focused evidence

- Retention/update safety/reader contracts: 22 passed. Camera contracts: 5 passed.
- Remaining focused built UI batch: 24 passed and 2 existing project-conditional
  skips; no new skips were introduced. Covers four personas, real-zero scores,
  explicit plan start, calendar journals, enlarged text, rest days and Back.
- Synthetic account plan selection/progress/archive/journal pointer: passed.
- Explicit numeric pace confirmation: passed in an isolated preview run. A prior
  overlapping run lost its shared preview server and is not counted as success.
- Browser hazard continuity after exhaustion: passed with the unchanged 0.09
  bound. Landscape jump screenshot inspected; status stays above the runner.
- Existing catalog-table assertions were removed from the method-picker journey
  only because that component has no live caller; its component contracts remain.
  Live method selection, exact quantities and save/reconfirmation are retained.
- Latest typecheck and build passed before the final isolated camera correction;
  the exact candidate still needs hosted CI. None of these receipts implies a
  full suite pass, merge, publication or authenticated real-member proof.

Final fixture follow-up: the dedicated file input now uses its current accessible
name (all 9 scenarios passed). The spring-upgrade retry asserts the current
7-minus-4 energy cost and its exact preservation across retry (passed); map reset
and shader navigation also passed. All 7 dedicated mobile account tests passed
locally after the hosted run lost a Vite module connection (`socket hang up`).
No authentication or production storage code was altered for that infrastructure
failure. The local long game replay timed out at 81/90 seconds and remains an
explicit non-pass, pending hosted results; its timeout was not increased.

### Final browser fixture reconciliation

- Resolved the long-game harness's frame-by-frame key chatter with separate
  press/release thresholds and physical key release at upgrade boundaries.
  The unchanged three-stage clear and Seoul replay passed with CI's bundled
  Chromium; navigation preserved the exact upgrade cost. No game timeout was
  increased and no physics or success assertion was removed.
- The arena is now in every browser project's source-fixture lane, backed by
  the real loopback server in an isolated worker. Its existing dedicated
  135-second allowance covers the real 90-second match. Standalone invitation,
  collision, result, rematch and exit test passed. CI installs the server's
  locked dependency; this does not configure a public game endpoint.
- Form autosave: 13 scenarios passed together, then the final recovery scenario
  passed after using the current group/side/pain selector. Both fake account
  transports explicitly report unsupported body metadata, matching their scope.
  Production account code and conflict safeguards are unchanged.
- Calendar, journal linkage and motion accessibility: 10 focused touch/reduced
  motion checks passed. Cycle evidence assertions remain intact after opening
  the current next-plan disclosure; its clock is fixed after the fixture frame.
- CI guard tests: all 6 passed with the Windows Bash runtime available.
  A sandbox-only Bash launch failure is not counted as a gate pass.
- These are focused local receipts, not a full hosted gate or deployment pass.

The previously unreached source-fixture lane exposed three more stale test
consumers. Their readers now use explicit day/session navigation, open the
current disclosure before its action, and distinguish the 10km plain-language
time from retained half/marathon seconds notation. Numeric precision, source
identity, blocked over-budget edits, unchanged journals and successor history
assertions are retained. Initial 800m through 10km and half-marathon lifecycles
passed; remaining personas are being checked. Both prescription scenarios and
mobile clarity/200-percent text checks passed after using the current detail
disclosure and disambiguating the actual effort choice from its review shortcut.
The prior hosted dedicated browser lane passed; its other in-progress jobs were
cancelled only after this follow-up was known to be necessary. That run is not a
successful full gate. No further application/runtime change is in this follow-up.
