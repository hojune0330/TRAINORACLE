# Same-Event Race Pace Binding

Status: OWNER_DIRECTED_BOUNDED_IMPLEMENTATION_CONTRACT
Decision: the owner's approved seven-event pace plan and continuation instruction.
This is a same-event application, not adoption of cross-event prediction.

## Exact Structures

The new lane reuses adopted work, preparation, recovery and cooldown structures.
It does not claim their previous LT explanation applies to race-average pace.

| Suffix | Source | Main structure | Population inherited |
|---|---|---|---|
| INTRO | P-INTRO-LT-S | 2 x 4 minutes, 60-second jog between | NEW_TO_RUNNING |
| TIMED | P-LT-S | 3 x 7 minutes, 60-second jog between | DEVELOPING, EXPERIENCED |
| DISTANCE | X-LT-01 | 5 x 1000m, 60-second jog between | EXPERIENCED |

Each structure has a separately versioned 10000m, 21097.5m and 42195m reference
declaration. The main intent is RACE_PACE, stored in the existing MIX plan lane.
MIX is the existing mixed/unallocated purpose category, not a metabolic pathway.
No LT, VO2max, race readiness or physiological measurement is inferred from RP.
RPE remains an effort guide inherited from the main-plan lane, never a measured
rating or evidence that a planned pace was achieved. The athlete records actual RPE.

## Binding And Changes

- Without a matching actual/explicit goal reference or explicit numeric input,
  a race-pace row cannot be bound or silently used as an RPE-only race-pace plan.
- Only the exact declared source event can supply RACE_AVERAGE_V1.
- Preserve time-based termination; calculated distance is informational only.
- Preserve repetitions, recoveries, preparation, cooldown and AM/PM layout.
- Initial record-aware substitution is a visible draft offer for a compatible MIX
  occurrence, not an automatic edit of an accepted plan or a different purpose.
- Show actual total duration before accepting a longer initial draft. Existing
  time-budget, experience, safety and explicit-acceptance gates remain operative.
- Actual and goal versions remain distinct immutable source snapshots. Predictions
  are not inputs. Old accepted plans keep their original catalog fingerprint.
- Pace updates, journal links and successor proposals use the same source guard and
  protected-occurrence rules as the multi-event contract.

No new repeat, recovery, workload multiplier, age/sex scaling or scientific efficacy
claim is introduced. These templates are coaching constructions, not independently
validated clinical or experimental protocols.

## Numeric input compatibility

The new RACE_PACE reference path uses the existing explicit-pace input envelope:
120 through 1800 seconds per kilometer. A calculated target outside that envelope
is marked RACE_PACE_REFERENCE_OUT_OF_RANGE and cannot activate a prescription.
This is an application input boundary, not a physiological assessment, a claim
about the athlete's ability, or a validation of an entered race result. Existing
historical non-RACE_PACE bindings are not rewritten under this new check.

[DRAFT_COMPLETE]
