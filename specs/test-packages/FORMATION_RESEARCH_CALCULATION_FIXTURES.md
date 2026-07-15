# Formation Research Calculation Fixtures

```yaml
fixture_pack_id: TO-WO010-CALCULATION-FIXTURES-2026-07-15
status: DRAFT_FOR_REVIEW
runtime_authority: false
fixture_count: 34
```

## Purpose

These fixtures make the Order 010 research boundary deterministic. They test
descriptive calculations and forbidden promotions. Passing them does not activate
Formation or establish safety, efficacy, prediction, or prescription.

## Sports-Science Claim Fixtures

| ID | Input claim | Expected classification |
|---|---|---|
| SCI-01 | `9.5 days is scientifically optimal` | reject; `UNKNOWN` |
| SCI-02 | `72 hours guarantees complete recovery` | reject; `UNKNOWN` |
| SCI-03 | `2-3 MAIN exposures per 9.5 days is proven optimal` | reject; `COACH_PILOT_HYPOTHESIS` |
| SCI-04 | strength, plyometric and HIIT components have some evidence | accept only as `EVIDENCE_INFORMED_WITH_LIMITS` |
| SCI-05 | component evidence proves the complete architecture | reject; `VERY_LOW_EXPERIMENTAL` |

## Load And Accounting Fixtures

| ID | Input | Expected result |
|---|---|---|
| LOAD-01 | duration 3600 s, explicit CR-10 session RPE 7 | `3600 / 60 * 7 = 420 AU`, formula and inputs retained |
| LOAD-02 | duration 60 min, RPE missing | `not_computed`, never `0 AU` |
| LOAD-03 | distance 5 km plus duration 30 min | do not add unlike units |
| LOAD-04 | parent session 60 min plus leaves 15/30/15 min | aggregate leaves or parent, result 60 min not 120 |
| LOAD-05 | whole-session RPE 7 with three components | do not split 7 among components |
| LOAD-06 | two overlapping device records with same source interval | quarantine; no double count |
| LOAD-07 | Banister TRIMP 80 and vendor load 80 | separate method series; no merge |
| LOAD-08 | eligible 5, observed 3, two missing | observed 3/5, coverage 0.6, missing reasons retained |
| LOAD-09 | source revised after summary | previous summary stale; new version required |
| LOAD-10 | ACWR denominator zero or missing | `not_computed`; no safe/danger classification |
| LOAD-11 | one readiness self-report | display observed response; no readiness scalar |
| LOAD-12 | value without `fieldProvenance` | readable as `LEGACY_MISSING_PROVENANCE`; excluded from analysis |
| LOAD-13 | `MISSING` value | excluded, never zero |
| LOAD-14 | invalid field value marked `EXPLICIT` | excluded as invalid |
| LOAD-15 | `DERIVED` with unknown rule or incomplete `derivedFrom` | excluded |
| LOAD-16 | nested `DERIVED` dependency | excluded |
| LOAD-17 | `DERIVED` whose actual input is not `EXPLICIT` | excluded |

## Race Fixtures

| ID | Input | Expected result |
|---|---|---|
| RACE-F1 | road 5 km 1200 s; track 5000 m 1180 s | two comparison groups |
| RACE-F2 | A 600/610/620/630; B 700 | private research calculation: athlete N=2, race N=5, median-of-athlete-medians 657.5 s; shared output disabled before Order 011 |
| RACE-F3 | `[600]`; `[600,590]`; `[600,590,595]` | observation only; first-latest delta; median/range plus limited-history label |
| RACE-F4 | 600, 610, DNF, DQ 590 | valid `[600,610]`; observed 2/eligible 4 |
| RACE-F5 | 2024-06-01 600; 2026-03-01 610; 2026-06-01 605 | dataset best 600; 2026 season best 605; latest gap +5 s/+0.8333% |
| RACE-F6 | distance 0/1000/2000/3000; cumulative 0/300/610/900 | split times 300/310/290 s |
| RACE-F7 | 600/602/604/606/900 | Q1 602, Q3 606, IQR 4, upper fence 612; retain 900 with optional unusual flag |
| RACE-F8 | category cells 4 and 8, total 12 | proposed suppression: cell 4 and total; shared output disabled before Order 011 |

## Quick-Preset Fixtures

| ID | Input or copy | Expected result |
|---|---|---|
| PRESET-01 | distance values 3/5/8/10/12 km | all remain selectable; 12 is `UNKNOWN_UX_ONLY` |
| PRESET-02 | sleep values 6/6.5/7/7.5/8/9 h | all capture-only; 7.5 is `UNKNOWN_UX_ONLY` |
| PRESET-03 | distance step 0.5 km and time step 5 min | accepted as UX choices, not scientific thresholds |
| PRESET-04 | copy says `recommended 8 km` or `normal sleep 8 h` | reject copy |

## Cross-Contract Invariants

1. Missing is never converted to zero.
2. Observed, derived, and unavailable values remain distinguishable.
3. Incompatible units, methods, event types, and measurement bases never merge.
4. Low sample size is shown, not hidden by a score or confidence claim.
5. Descriptive outputs never activate plan changes, safety clearance, diagnosis,
   prediction, or recommendation.
6. `PRIVATE_SELF_ONLY` content, presence, frequency, length, and metadata remain
   unavailable to analytics. `ANALYZABLE_TRAINING_NOTE` raw text and unregistered
   derived signals are also unavailable; structured signals require separate vocabulary,
   provenance, privacy, runtime, and owner adoption.

## Acceptance Condition

All 34 fixtures and six cross-contract invariants must be reviewed against the source
documents. Any implementation derived from this pack must first add executable tests
that fail before implementation and pass afterward.

[DRAFT_COMPLETE]
