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
