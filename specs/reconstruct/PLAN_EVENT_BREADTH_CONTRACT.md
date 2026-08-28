# PLAN_EVENT_BREADTH_CONTRACT.md

```yaml
doc_id: PLAN_EVENT_BREADTH_CONTRACT
spec_id: TO-PLAN-EVENT-BREADTH-001
title: TrainOracle Initial Event Breadth Contract
version: 1.0
round: RT1
status: DRAFT_FOR_REVIEW
owner: TrainOracle Product Owner
open_issues_total: 4
canonical_blocking_count: 3
executed_tests_total: 0
canonical_promotion_allowed: false
final_marker_required: DRAFT_COMPLETE_AT_END
```

## 1. Purpose

This draft defines the narrow event-selection and fallback boundary for the first
TrainOracle planning range. It does not activate a detailed training template,
approve a pace formula, or claim that the same plan is suitable for every event.

## 2. Initial Event Set

| Target | Stored distance | Event group |
|---|---:|---|
| 800m | 800 | `MIDDLE_DISTANCE` |
| 1500m | 1500 | `MIDDLE_DISTANCE` |
| 3000m | 3000 | `MIDDLE_DISTANCE` |
| 5000m | 5000 | `FIVE_K` |
| 10km | 10000 | `TEN_K` |
| Half marathon | 21097 | `GENERAL_ENDURANCE` |
| Marathon | 42195 | `GENERAL_ENDURANCE` |

The distance and event group must match exactly. A mismatched pair is rejected;
it is not silently converted to another target.

## 3. Generation Boundary

- All seven targets may receive the existing 7, 9, 9.5, or 10-day candidate
  structure when the other intake and Safety Gate requirements are satisfied.
- A plan without an active detailed template uses duration and RPE ranges.
- `selectedDetailedTemplateRef` remains `null` when no approved exact template
  is available.
- The product must not infer a repetition pace from a target time, another event,
  an old record, a profile label, or a professional-athlete display mode.
- RPE-time fallback is a real usable beta plan, not evidence that a detailed
  same-event prescription was applied.

## 4. Detailed Prescription Boundary

At this draft's creation, runtime detailed pace templates remain limited to the
separately approved 800m, 1500m, 3000m, and 5000m records. Adding a target to the
event picker does not activate a catalog entry.

10km, half-marathon, and marathon numeric prescriptions require, per template:

1. exact session structure and notation;
2. same-event anchor and freshness rule;
3. event and experience applicability;
4. warm-up, cool-down, recovery, downshift, and stop components;
5. source-adoption and owner decision records;
6. arithmetic, non-divisible time, mobile display, and persistence tests.

Cross-event pace conversion remains unavailable until a separately reviewed
model and evidence contract exist.

## 5. Continuity And Adaptation

- Candidate identity includes the exact event distance and event group.
- Stored plan intake, active plan, history, adaptation scope, and successor must
  preserve the same target.
- A successor may advance periodization lineage, but the event expansion itself
  cannot raise intensity, volume, or frequency.
- PB/SB and explicit-request adaptation rules remain separate and unchanged.

## 6. Privacy And Safety

- Event selection contains no raw memo, symptom clause, medical note, or private
  diary text.
- `D9_ACTIVE` and `D9_UNKNOWN` continue to block plan generation.
- Event choice, professional display mode, template availability, a good result,
  or an Oracle score cannot clear D9 risk.
- A generated RPE plan is training guidance, not medical clearance.

## 7. Required Verification

- each initial event appears once and maps to one group;
- wrong distance-group pairs are rejected;
- all three newly exposed long events generate RPE-time candidates without a
  pace-target prescription;
- save, reload, history, successor, and adaptation parsers accept the exact new
  identities without weakening old identity checks;
- 320px mobile and desktop intake flows reach candidate comparison;
- no draft catalog template becomes runtime eligible from this contract.

## 8. Open Issues

| Issue | Canonical blocker | Status | Required evidence |
|---|---|---|---|
| `OI-PEB-10K-DETAIL-001` | YES | OPEN | accepted 10km detailed templates and runtime receipts |
| `OI-PEB-HALF-DETAIL-001` | YES | OPEN | accepted half-marathon detailed templates and runtime receipts |
| `OI-PEB-MARATHON-DETAIL-001` | YES | OPEN | accepted marathon detailed templates and runtime receipts |
| `OI-PEB-CROSS-EVENT-MODEL-001` | NO | OPEN | separately reviewed conversion model, if ever adopted |

No issue is closed by this draft or by local tests.

[DRAFT_COMPLETE]
