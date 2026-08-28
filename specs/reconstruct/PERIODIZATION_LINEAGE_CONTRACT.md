# PERIODIZATION_LINEAGE_CONTRACT.md

```yaml
document_metadata:
  doc_id: trainoracle-spec-periodization-lineage-v1
  spec_id: PERIODIZATION_LINEAGE_CONTRACT
  title: TrainOracle Periodization Lineage Contract
  version: "1.0"
  round: RT1_IMPLEMENTATION_BOUNDARY
  status: DRAFT_FOR_REVIEW
  owner: COACH_HOJUNE
  open_issues_total: 5
  canonical_blocking_count: 3
  executed_tests_total: 0
  production_execution_allowed: false
  canonical_promotion_allowed: false
  final_marker_required: DRAFT_COMPLETE_AT_END
```

---

## 1. Purpose

This draft defines a narrow storage and display lineage for TrainOracle's owner-approved
9.5-day, 4-8 week, and approximately 24-week product direction. It allows the app to
show where an activated plan sits in a longer direction without turning calendar
position into a load increase, readiness decision, medical decision, or efficacy claim.

This draft does not replace the formation, adaptation, detailed-prescription, D9,
Safety Gate, Calendar, or athlete-data contracts.

---

## 2. Product Direction, Not Biological Truth

```yaml
direction:
  frame_length_days: 9.5
  frames_per_display_mesocycle: 3
  display_mesocycles_per_macrocycle: 6
  frames_per_macrocycle: 18
  approximate_macrocycle_days: 171
  approximate_display_weeks: 24
```

The values above are an owner-approved planning convention. They do not prove that
9.5 days, three-frame grouping, 18 frames, or the default phase positions are optimal
for every athlete.

The three-frame mesocycle is a stable V1 display and lineage grouping. Later planning
logic may use a reviewed 3-6 frame mesocycle, but must not silently reinterpret stored
V1 ordinals.

---

## 3. Phase Direction

| Frame ordinal | Phase code | Athlete-facing meaning |
|---:|---|---|
| 1-6 | `BASE` | Build general foundations |
| 7-11 | `DEVELOPMENT` | Develop several relevant abilities |
| 12-16 | `COMPETITION_SPECIFIC` | Move toward event-relevant work |
| 17-18 | `TAPER_PEAK` | Reduce accumulated fatigue before a target period |

The phase code is context. It does not by itself select a template, set pace, raise
intensity, reduce volume, authorize taper details, or override an active safety hold.

---

## 4. Stored Context

```yaml
periodization_context_v1:
  schemaVersion: 1
  programLineageId: OPAQUE_SHA256
  macrocycleOrdinal: POSITIVE_INTEGER
  frameOrdinal: INTEGER_1_TO_18
  mesocycleOrdinal: INTEGER_1_TO_6
  phase: BASE | DEVELOPMENT | COMPETITION_SPECIFIC | TAPER_PEAK
  frameLengthDays: 9.5
  targetFrameCount: 18
  startedAt: ISO_TIMESTAMP
  frameStartedAt: ISO_TIMESTAMP
  source: NEW_PLAN | ROLLED_FORWARD
```

`programLineageId` is an opaque identity. Raw memo text, symptom text, evidence clauses,
name, email, phone number, and raw athlete free text are forbidden.

---

## 5. State Transitions

1. A newly selected plan starts at macrocycle 1, frame 1, mesocycle 1, phase `BASE`.
2. Viewing, editing, journaling, completing, resting, skipping, or recording pain does
   not advance the lineage.
3. The lineage advances only when an accepted next-frame plan is actually activated.
4. Frames 1-17 advance by exactly one.
5. Frame 18 advances to frame 1 of the next macrocycle while preserving the program
   lineage identity.
6. A successor activation must preserve the predecessor context in plan history before
   writing the successor context.
7. A failed or partially rolled-back storage transaction must not create a visible
   lineage advance.

---

## 6. Adaptation Invariants

```yaml
adaptation_invariants:
  calendar_position_auto_increases_load: false
  phase_position_auto_increases_load: false
  three_dimensions_can_increase_together: false
  default_next_action:
    - MAINTAIN
    - REDUCE
    - CHANGE_METHOD
  increase_candidate_requires:
    - SAME_EVENT_PB_OR_SB_AFTER_ACTIVE_PLAN_START
    - OR_EXPLICIT_ATHLETE_OR_COACH_REQUEST
  active_D9_or_safety_hold_can_be_cleared_by_lineage: false
```

The existing registered adaptation transform remains the executable authority for any
actual successor change. This lineage cannot create a transform, broaden a transform,
or authorize intensity or frequency changes.

---

## 7. Display Contract

The active plan may show:

- current frame out of 18;
- current three-frame group out of six;
- current phase label;
- an 18-segment progress track;
- a plain-language notice that the direction does not automatically raise training.

The display must not show a performance forecast, injury-risk score, guaranteed
adaptation, biological readiness, or an invented completion percentage for missing
historical frames.

Legacy active plans without this context remain usable. The UI must not invent hidden
past frames. Their first accepted successor may derive a local starting context from
the visible predecessor and must label that migration in a later accepted migration
contract before canonical promotion.

---

## 8. History And Retention

V1 retains at most 18 plan-history summaries on one local account scope so the current
macrocycle direction can be reconstructed. This does not yet provide the full immutable
session snapshot required for scientific plan-versus-performance analysis.

Account deletion, local-data deletion, device connection, server backup, tombstones,
and cross-device merge must treat periodization context as athlete-scoped data. Their
complete server lifecycle remains an open issue.

---

## 9. Open Issues

| Issue ID | Canonical blocking | Status | Required evidence |
|---|---:|---|---|
| `OI-PLC-TIMEZONE-001` | YES | OPEN | Athlete timezone, tzdb version, DST and local-civil occurrence policy |
| `OI-PLC-HISTORY-SNAPSHOT-001` | YES | OPEN | Full immutable archived plan-session snapshot and migration tests |
| `OI-PLC-SERVER-LIFECYCLE-001` | YES | OPEN | RLS, backup, merge, tombstone and account-deletion tests |
| `OI-PLC-MESOCYCLE-VARIABILITY-001` | NO | OPEN | Reviewed rule for 3-6 frame mesocycles without rewriting V1 history |
| `OI-PLC-COMPETITION-ANCHOR-001` | NO | OPEN | Accepted race-anchor rule for phase adjustment and taper placement |

No issue is closed by this draft or by local unit tests.

---

## 10. Required Verification

- initial plan starts at frame 1;
- ordinary journal and progress actions do not advance the frame;
- successor activation advances exactly once and replay is idempotent;
- frames map to the specified phase and mesocycle ordinals;
- frame 18 rolls to the next macrocycle frame 1;
- forged phase and mesocycle combinations are rejected;
- lineage data contains no private memo or identity fields;
- UI states that the direction does not automatically raise training;
- reduced-motion, mobile-width, account isolation, backup, deletion, and server tests
  pass before production authority is claimed.

[DRAFT_COMPLETE]
