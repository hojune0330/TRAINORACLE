# CUMULATIVE_DISTANCE_ANALYSIS_CONTRACT.md

```yaml
doc_id: trainoracle-spec-026-cumulative-distance-analysis-contract
spec_id: CUMULATIVE_DISTANCE_ANALYSIS_CONTRACT
title: TrainOracle Cumulative Distance Analysis Contract
version: "0.1"
round: RT1_IMPLEMENTATION_BINDING_DRAFT
status: DRAFT_FOR_REVIEW
owner: COACH_HOJUNE
source_state:
  local_original_found: false
  new_productization_draft: true
  restored_original: false
  previous_approved_version_restored: false
open_issues_total: 3
canonical_blocking_count: 1
executed_tests_total: 0
executed_tests_passed: 0
self_check_is_runtime_evidence: false
canonical_promotion_allowed: false
runtime_activation_scope: CUMULATIVE_DISTANCE_V1_ONLY
```

---

## 1. Purpose

This draft defines the first production-bound cumulative distance surface for TrainOracle. It gives Home and Analysis one shared aggregation contract for weekly, monthly, yearly, recent-window, and current-plan-period distance without inventing missing values or reading private memo text.

It is a narrow implementation binding for descriptive distance totals. It is not a training-load formula, a training recommendation, a distance goal, a reward rule, a medical or safety decision, an exact 9.5-day physiological claim, canonical promotion, or runtime evidence.

---

## 2. Source Basis

| Source | Binding used here |
|---|---|
| `TRAINORACLE_MASTER_PLAN.md` | Cumulative weekly/monthly/yearly mileage is a first-class return reason; energy-system accumulation follows in a later slice. |
| `specs/reconstruct/ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md` | Source refs, uncertainty, visible missing data, private-text prohibition, and non-prescriptive analysis boundary. |
| `specs/reconstruct/METRIC_ALGORITHM_CONTRACT.md` | Missing values remain null, default imputation is forbidden, and output requires a versioned formula/envelope. |
| `specs/reconstruct/DAILY_LOG_AND_CHECKIN_SPEC.md` | Structured journal fields and private raw-text boundary. |
| `specs/reconstruct/TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md` | Authoritative 9.5-day frame is athlete-local 9 days and 12 hours; approximate calendar projections must not be labeled exact. |
| `app/src/domain/journal-observation.ts` | Existing structured observation, provenance, trust state, and source-ref projection. |
| `app/src/domain/trend-analysis.ts` | Existing strict metric eligibility boundary. |

---

## 3. Global Invariants

```yaml
cumulative_distance_invariants:
  shared_home_analysis_engine_required: true
  direct_or_approved_derived_structured_distance_only: true
  imported_or_unverified_distance_excluded: true
  legacy_missing_provenance_excluded: true
  invalid_distance_excluded: true
  duplicate_source_id_counted_at_most_once: true
  conflicting_duplicate_source_id_excluded: true
  missing_is_zero: false
  raw_memo_text_read_allowed: false
  private_memo_presence_used_as_signal: false
  source_refs_preserved: true
  exclusion_counts_visible: true
  distance_goal_or_reward_authority: false
  training_plan_mutation_authority: false
  safety_or_D9_authority: false
  exact_9_5_day_label_without_exact_boundary: false
```

---

## 4. Eligible Distance Input

An input is eligible only when all conditions are true:

1. it is a valid `StructuredJournalObservation`;
2. `loggedOn` is a valid athlete-local `YYYY-MM-DD` date;
3. `distanceKm` is finite, positive, and within the existing journal numeric boundary;
4. distance provenance is `EXPLICIT`, or an accepted derivation rule is explicitly registered in a later contract revision;
5. source trust is `ACCEPTED`;
6. the source identity has no conflicting duplicate inside the requested window.

`DERIVED` distance is not enabled in v1. Pace derived from explicit distance and duration does not turn distance itself into a derived distance.

A source with no distance value and distance provenance `MISSING` is absent from the distance dataset. It is not included, not counted as an excluded distance record, and not exposed through source refs or reason codes.

---

## 5. Privacy Boundary

The aggregation engine receives structured observations only. It must not receive, decrypt, inspect, hash, count, classify, or infer from raw memo or note text.

The current runtime `PRIVATE_SELF_ONLY` field scopes memo text, not the whole journal entry. Therefore v1 may use a separately entered structured distance only when that distance independently satisfies Section 4. Private memo existence, length, encryption record, unlock state, and text must remain zero-signal.

Whole-entry private diary exclusion is not claimed in v1 because the current journal schema has no independent whole-entry analysis-scope field. That product capability remains open under `OI-CDA-WHOLE-ENTRY-PRIVACY-001`.

---

## 6. Source Identity And Duplicate Handling

The dedupe key is `sourceKind + sourceId`.

- One eligible observation: include once.
- Repeated observations with the same key and identical `loggedOn`, `distanceKm`, provenance, and trust state: include once and report the duplicate count.
- Repeated observations with the same key but conflicting values: exclude the entire key, emit `CONFLICTING_SOURCE_ID`, and do not select a winner by array order or timestamp.
- A missing `sourceId` is invalid and excluded.

Duplicate and conflict evaluation is scoped to the requested window after date filtering. An observation with the same source key outside that window does not alter the total, coverage, or conflict state inside the window. This is a reporting-window rule only; it does not declare two cross-window records globally consistent.

This rule prevents sync, restore, or repeated projection from silently doubling mileage.

---

## 7. Required V1 Windows

All v1 windows use athlete-local civil dates and inclusive start/end dates.

| Window | Start | End | User label |
|---|---|---|---|
| week to date | Monday containing `asOfDate` | `asOfDate` | `이번 주` |
| month to date | first local date of month | `asOfDate` | `이번 달` |
| year to date | January 1 of year | `asOfDate` | `올해` |
| recent weeks | Monday-aligned 4 or 12 week buckets | week containing `asOfDate` | `최근 4주`, `최근 12주` |
| recent months | 6 or 12 calendar-month buckets | month containing `asOfDate` | `최근 6개월`, `최근 12개월` |
| current month days | each local date in current month through `asOfDate` | `asOfDate` | `이번 달 날짜별 거리` |
| active plan date window | persisted plan start date | earlier of `asOfDate` and the last visible local plan date | `현재 계획 기간` |

Future-dated observations after `asOfDate` are excluded from to-date windows.

---

## 8. Active Plan Window And 9.5-Day Boundary

The authoritative formation spec defines 9.5 days as athlete-local nine calendar days plus twelve hours. Exact attribution requires at least:

- athlete timezone;
- persisted frame start instant;
- persisted frame end-exclusive instant;
- observation occurrence instant or explicit planned-session/slot linkage.

The current journal runtime stores a local date and saved timestamp but does not prove exact occurrence time or plan-session attribution. The v1 UI must therefore label this metric `현재 계획 기간 거리`, use the persisted plan start date through the earlier of today and the visible plan date projection, and disclose that it is date-based.

The v1 UI and engine must not use the alternating 10/9-day helper as evidence for an exact 9.5-day total, must not label a date projection `정확한 9.5일 거리`, and must not compare it as a physiological outcome.

---

## 9. Output Contract

```ts
type CumulativeDistanceSummary = {
  formulaVersion: "CUMULATIVE_DISTANCE_SUM_V1";
  window: {
    kind: string;
    startDate: string;
    endDate: string;
    precision: "LOCAL_DATE";
  };
  totalKm: number | null;
  includedSourceCount: number;
  excludedSourceCount: number;
  duplicateSourceCount: number;
  coverage: "DATA" | "PARTIAL" | "MISSING";
  sourceRefs: Array<{
    sourceKind: string;
    sourceId: string;
    observedAt: string | null;
  }>;
  reasonCodes: string[];
}
```

`totalKm` is rounded only for display/storage stability after summation. Individual source values must not be rounded before summation.

---

## 10. UI Contract

Home and Analysis must use the same engine output. They must never calculate totals independently.

Required first-slice presentation:

- Home: after the first journal entry or saved plan exists, compact `이번 주`, `이번 달`, `올해`, and optional `현재 계획 기간` totals with a direct route to Analysis.
- A completely empty first-visit Home may omit the empty cumulative panel to preserve the existing mobile scroll-depth contract; the existing example-journal preview remains the value demonstration.
- Analysis: 4/12-week comparison, 6/12-month totals, and current-month daily heatmap.
- Missing windows show `기록 없음` or an em dash, never `0 km`.
- Partial/excluded data is disclosed near the visualization.
- Color is not the only encoding; charts have values or an accessible table/text alternative.
- Controls meet 44px touch targets and remain usable at 375x667 without horizontal overflow.
- `prefers-reduced-motion` must be respected.

Distance goals, target rings, streak pressure, points for mileage, and automatic training increases are outside v1.

---

## 11. Required Test Vectors

1. Explicit accepted distances sum correctly across week, month, and year boundaries.
2. Missing distance returns `null`, not zero.
3. Imported, unverified, legacy-no-provenance, invalid, and future-dated distance is excluded.
4. Identical duplicate source ids count once.
5. Conflicting duplicate source ids count zero and emit a conflict reason.
6. Raw/private memo text is absent from engine input and output.
7. Home and Analysis show the same total for the same window and source set.
8. Active plan total is labeled date-based and never exact 9.5-day when exact boundary inputs are absent.
9. 4/12-week, 6/12-month, and current-month daily buckets preserve missing state.
10. 375x667 UI has no horizontal overflow and exposes a non-color-only alternative.

---

## 12. Issue Closure Boundary

Implementation and tests produced from this draft may provide scoped runtime evidence for the cumulative-distance slice only. They do not close or canonically promote the broader Analysis, Metric Algorithm, Daily Log, Training Formation, App Bridge, D9, Safety Gate, or Plan Generator contracts.

---

## 13. Open Issues

| Issue ID | Priority | Canonical blocking | Status | Problem | Required next evidence |
|---|---|---|---|---|---|
| `OI-CDA-EXACT-9-5-ATTRIBUTION-001` | P1 | YES | OPEN | Exact 9.5-day attribution lacks persisted timezone, frame instants, occurrence instant, and session/slot linkage. | Accept and implement exact boundary/attribution fields, then add DST and cross-boundary runtime tests. |
| `OI-CDA-WHOLE-ENTRY-PRIVACY-001` | P1 | NO | OPEN | Current private scope protects memo text but does not express whole-entry zero-signal analysis exclusion. | Add an explicit whole-entry analysis-scope field with migration, UI consent, sync, export, and tests. |
| `OI-CDA-RUNTIME-EVIDENCE-001` | P1 | NO | OPEN | This draft has no runtime evidence. | Implement the shared engine and Home/Analysis surfaces, then attach actual unit, browser, and CI evidence without promoting the broader specs. |

---

## 14. Self-Check

| Check | Result |
|---|---|
| First line is exact filename H1 | PASS |
| Metadata counts match the open-issue table | PASS |
| Executed tests remain 0 | PASS |
| Missing is not converted to zero | PASS |
| Imported and unverified distance is excluded | PASS |
| Duplicate and conflict behavior is explicit | PASS |
| Raw/private memo text is zero-signal | PASS |
| Whole-entry privacy gap is disclosed, not invented | PASS |
| Exact 9.5-day claim is blocked without exact boundary inputs | PASS |
| Home and Analysis must share one engine | PASS |
| No plan, safety, medical, reward, or distance-goal authority is created | PASS |
| Final marker is the final line | PASS |

## Scoped owner amendment: 2026-09-04

[Analysis integrity adoption](../../ANALYSIS_INTEGRITY_ADOPTION_2026-09-04.md)
supersedes the whole-observation ACCEPTED requirement only for independently
attested EXPLICIT fields in a mixed-source journal. Imported values remain excluded.
It also defines unique-source/conflict/identical-copy counts, per-metric sample
counts, both-period coverage and proportional chart length. All other authority,
privacy, issue status and formula boundaries above remain unchanged. This is a
scoped implementation amendment, not canonical promotion or runtime evidence.

[DRAFT_COMPLETE]
