# Session Intensity Assessment Spec

```yaml
status: ACTIVE_IMPLEMENTATION_CONTRACT
schema_version: 1
owner_direction: SUBJECTIVE_AND_OBJECTIVE_INTENSITY_TOGETHER
decision_id: OWNER_SESSION_INTENSITY_V1_2026_07_18
owner: COACH_HOJUNE
owner_decision_status: APPROVED_FOR_APP_LOCAL_V1
runtime_scope: POST_SESSION_JOURNAL_ONLY
universal_fatigue_score: FORBIDDEN
plan_authority: false
safety_authority: false
```

## Purpose

TRAINORACLE must let an athlete record how hard a session was expected to feel, how hard it
actually felt, and the measurable work that was completed. These are related observations, not
interchangeable facts. The app presents them together without silently filling a missing answer or
claiming that unlike training modalities share one scientifically validated scale.

## User Contract

1. `plannedRpe` is an optional 1-10 answer representing the athlete or coach's expected session
   intensity before execution.
2. The existing post-session `rpe` is the optional 1-10 reported intensity after execution. A stored
   zero remains the legacy missing marker and is never treated as a real RPE.
3. `objectiveComponents` is an ordered list. One session may contain multiple components.
4. If both subjective values are missing but at least one objective component exists, the saved
   record says `객관 기록으로만 표시`. It does not fabricate a subjective value.
5. If subjective data exists without an objective component, the record says that only subjective
   data is available.
6. The UI may describe coverage and show normalized facts. It may not average subjective and
   objective data into a universal fatigue, readiness, safety, injury-risk, or prescription score.

## Persistence Shape

`PostSessionEntry.intensityAssessment` is optional for backward compatibility.

```text
SessionIntensityAssessment
  schemaVersion: 1
  plannedRpe?: integer 1..10
  objectiveComponents: ObjectiveLoadComponent[] (maximum 6)
```

Each component has a stable `componentId` and one modality discriminator:

- `RUNNING`: actual distance and pace, with optional typical distance and personal reference pace;
- `INTERVALS`: repetitions, work seconds, recovery seconds, with optional actual and personal
  reference pace;
- `STRENGTH`: exercise type, sets, repetitions, optional `%1RM`, optional RIR;
- `PLYOMETRIC`: exercise type, contact count, optional typical contact count;
- `HILLS`: repetitions, work seconds, recovery seconds, optional grade percentage;
- `CROSS_TRAINING`: modality name, duration minutes, optional `%HRmax`.

All quantities are positive finite values unless their explicit range says otherwise. Components
that do not meet their modality's minimum fields are rejected at the persistence boundary rather
than partially trusted.

## Derived Objective Metrics

The owner-approved V1 display rules below are calculated only when their named inputs exist. They
remain transient display facts and are not registered analysis, Formation, safety, or plan rules.

| Rule ID | Formula | Source fields | Meaning boundary |
| --- | --- | --- | --- |
| `INTENSITY_RUNNING_PACE_RATIO_V1` / `INTENSITY_INTERVAL_PACE_RATIO_V1` | `reference seconds/km / actual seconds/km * 100` | `referencePaceSecondsPerKm`, `actualPaceSecondsPerKm` | Speed relative to the athlete-provided reference pace |
| `INTENSITY_RUNNING_DISTANCE_RATIO_V1` | `actual distance / typical distance * 100` | `distanceKm`, `typicalDistanceKm` | Volume relative to the athlete-provided typical session |
| `INTENSITY_INTERVAL_WORK_DENSITY_V1` / `INTENSITY_HILL_WORK_DENSITY_V1` | `work seconds / (work + recovery seconds) * 100` | `workSeconds`, `recoverySeconds` | Fraction of one work/recovery cycle spent working |
| `INTENSITY_PLYOMETRIC_CONTACT_RATIO_V1` | `contacts / typical contacts * 100` | `contacts`, `typicalContacts` | Contacts relative to athlete-provided typical contacts |
| Explicit strength facts | no derived formula | `%1RM`, RIR, sets, repetitions | Kept as separate modality facts |
| Explicit cross-training facts | no derived formula | duration and `%HRmax` | Kept as separate modality facts |

These formulas are descriptive. They are not scientific high-intensity cutoffs. Input values remain
explicit data; calculated metrics are marked derived and list their source fields and rule ID.
Pace ratios are displayed with a faster, slower, or equal label so the athlete does not have to
interpret direction from the percentage alone.

When an objective component fails validation, the editor identifies each input field that needs
correction and preserves the draft instead of silently dropping malformed values.

## Coverage State

```text
COMBINED        subjective observation exists and objective components exist
SUBJECTIVE_ONLY subjective observation exists and no objective component exists
OBJECTIVE_ONLY  no subjective observation exists and objective components exist
MISSING         neither source exists
```

Planned-only and reported-only subjective states remain distinguishable inside the combined view.
Disagreement between planned and reported RPE is useful information and is never overwritten.

## Provenance

- `plannedRpe` is `EXPLICIT` only when selected; otherwise `MISSING`.
- `objectiveComponents` is `EXPLICIT` only when one or more validated components are saved;
  otherwise `MISSING`.
- Display metrics are transient `DERIVED` values with stable rule IDs.
- Display metrics carry their complete `derivedFrom` source-field list in runtime summaries.
- Display rule IDs above are intentionally absent from the persisted analysis derivation registry.
- Legacy entries without these provenance keys remain legacy-missing and are not made analyzable by
  inference.

## Privacy And Analysis Boundary

- `PRIVATE_SELF_ONLY` text, its presence, length, timestamps, and other metadata are zero-signal.
- `ANALYZABLE_TRAINING_NOTE` raw text does not feed this assessment in version 1.
- Race self-check fields remain display-only and do not feed session intensity.
- Exporting or sharing a record transports the owner's selected data but does not grant analysis,
  standing access, Formation, reward, safety, or telemetry permission.

## Deferred Decisions

The following require a higher-accuracy sports-science, statistics, user, and owner decision before
implementation:

- modality-specific cutoffs that label an objective component low, medium, high, or maximal;
- a cross-modality scalar or weighting model;
- automatic plan changes from intensity observations;
- wearable-derived data and device confidence;
- minimum within-athlete history and freshness rules for personal baselines.

Until those decisions are accepted, the app shows transparent facts and coverage only.
