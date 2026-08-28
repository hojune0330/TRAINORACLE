# ENERGY_SYSTEM_ACCUMULATION_CONTRACT.md

```yaml
document_metadata:
  doc_id: trainoracle-spec-energy-system-accumulation-contract
  spec_id: ENERGY_SYSTEM_ACCUMULATION_CONTRACT
  title: Energy System Accumulation Contract
  version: "1.0"
  round: RT1
  status: DRAFT_FOR_REVIEW
  owner: COACH_HOJUNE
  open_issues_total: 4
  canonical_blocking_count: 2
  canonical_promotion_allowed: false
  runtime_authority: false
  executed_tests_total: 0
  final_marker_required: "[DRAFT_COMPLETE]"
```

## 1. Purpose

This draft defines the first production-bound energy-system ledger for TrainOracle. It converts explicit journal classifications and the currently selected plan into descriptive counts without claiming a physiological measurement, coaching diagnosis, safety clearance, or automatic adaptation authority.

The ledger answers four separate questions:

1. which energy intent was planned in the current visible plan;
2. which planned sessions the user marked complete;
3. which energy purpose the user explicitly selected in a post-session journal;
4. which direct duration, distance, and RPE values accompanied those journal sessions.

These facts must remain separate. A completion button is not a journal result, and a journal classification is not proof that the athlete physiologically trained only one energy system.

---

## 2. Taxonomy

```yaml
ledger_keys:
  - RECOVERY
  - BASE
  - LT
  - VO2
  - GLY
  - ATP_PC
  - MIXED_UNALLOCATED
```

`MIXED_UNALLOCATED` is a required visible category. A mixed session may be split only when a later accepted contract provides explicit component allocation and provenance. V1 must not infer shares from title, memo text, duration, RPE, pace, or template name.

`RECOVERY` represents a performed low-intensity recovery-purpose session selected in the journal. A planned `REST` day and a `RESTED` progress mark are not recovery-system training and are excluded from planned and completed session counts.

---

## 3. Global Invariants

```yaml
invariants:
  explicit_system_selection_required: true
  legacy_default_system_is_not_evidence: true
  missing_is_not_BASE: true
  missing_is_not_zero: true
  planned_completed_and_journal_facts_separate: true
  completed_mark_is_not_execution_measurement: true
  MIXED_UNALLOCATED_must_remain_visible: true
  inferred_mixed_allocation_forbidden: true
  private_memo_text_or_existence_as_signal: forbidden
  raw_free_text_storage_or_audit: forbidden
  energy_label_as_physiological_measurement: forbidden
  energy_ledger_as_safety_or_medical_judgment: forbidden
  energy_ledger_as_automatic_plan_adjustment: forbidden
```

The post-session form must begin with no energy system selected. Saving without touching that field records `system: MISSING`. Old entries that contain a historical default such as `base` but do not contain explicit system provenance remain excluded until the user explicitly chooses a system in a later edit.

---

## 4. Eligible Journal Source

A journal observation is eligible only when all conditions are true:

1. source kind is `SESSION_RESULT_RECORD`;
2. `loggedOn` is a real athlete-local date inside the requested window;
3. energy-system key maps to the Section 2 taxonomy;
4. system provenance is `EXPLICIT`;
5. source trust is `ACCEPTED`;
6. the source identity has no conflicting duplicate inside the requested window.

Distance, duration, and RPE are accumulated only when each field independently has `EXPLICIT` provenance and a valid value. A session may count while one or more of those metrics remain missing. Missing metrics remain `null`, never zero.

Imported or legacy-unprovenanced systems are excluded in V1. A later accepted derivation registry may add qualified sources without silently changing this formula version.

---

## 5. Privacy Boundary

The ledger consumes only `StructuredJournalObservation`. It must not receive, decrypt, inspect, hash, count, classify, or infer from memo or note text.

Private memo content and private memo existence are zero-signal. A structured system selection may be used only through its own explicit provenance; the presence, length, lock state, encryption state, or wording of any attached memo cannot change inclusion, exclusion, system choice, allocation, or chart copy.

Whole-entry private-diary withdrawal remains blocked until an independent whole-entry analysis-scope field exists. This draft does not claim that capability.

---

## 6. Source Identity And Conflict Handling

The dedupe key is `sourceKind + sourceId` after requested-window filtering.

The energy signature includes:

- local journal date;
- energy-system key and system provenance;
- duration and duration provenance;
- distance and distance provenance;
- RPE and RPE provenance;
- source trust state.

Identical signatures count once. If any signature field differs for the same key, the entire key is excluded and `CONFLICTING_SOURCE_ID` is emitted. This intentionally extends the cumulative-distance signature: two records with the same distance but different duration are not interchangeable for an energy ledger.

Conflict evaluation is scoped to the requested reporting window. A same-key record outside the window does not alter the inside-window result and is not declared globally consistent by that behavior.

---

## 7. Planned And Completed Projection

The current selected plan may project non-`REST` sessions by `plannedEnergyIntent`.

```yaml
planned_projection:
  plannedSessionCount: all_non_REST_sessions
  completedMarkCount: matching_progress_state_COMPLETED_only
  REST_session: excluded
  RESTED_progress: not_completed_energy_training
  SKIPPED_progress: not_completed_energy_training
  PAIN_CHECKIN_progress: not_completed_energy_training
```

No planned duration, distance, repetition count, quality distance, or RPE range may be presented as completed. `completedMarkCount` means only that the stored plan progress button is `COMPLETED`; it does not prove actual dose or journal linkage.

Historical plan-energy accumulation is not claimed because current archived plan history does not retain a complete immutable session projection. `plannedSessionId` and completed-session linkage remain required before historical plan-versus-actual attribution.

---

## 8. V1 Windows

Journal ledger windows use inclusive athlete-local dates:

| Period | Start | End | User label |
|---|---|---|---|
| recent 4 weeks | `asOfDate - 27 days` | `asOfDate` | `최근 4주` |
| recent 8 weeks | `asOfDate - 55 days` | `asOfDate` | `최근 8주` |
| recent 24 weeks | `asOfDate - 167 days` | `asOfDate` | `최근 24주` |
| year to date | January 1 | `asOfDate` | `올해` |

An exact 9.5-day experienced ledger remains blocked until timezone, frame instants, occurrence time, and plan-session attribution are accepted. The current-plan summary may show planned and completion-mark counts without calling them an exact experienced 9.5-day outcome.

---

## 9. Output Contract

```ts
type EnergyLedgerRow = {
  key: "RECOVERY" | "BASE" | "LT" | "VO2" | "GLY" | "ATP_PC" | "MIXED_UNALLOCATED";
  journalSessionCount: number;
  durationMinutes: number | null;
  distanceKm: number | null;
  rpeSampleCount: number;
  meanRpe: number | null;
};

type EnergySystemLedger = {
  formulaVersion: "ENERGY_SYSTEM_LEDGER_V1";
  includedSourceCount: number;
  excludedSourceCount: number;
  duplicateSourceCount: number;
  coverage: "DATA" | "PARTIAL" | "MISSING";
  rows: EnergyLedgerRow[];
  reasonCodes: string[];
};
```

Rows always retain the complete taxonomy order. Zero session count means that another eligible system may exist in the window while this system has no eligible session. When the whole ledger has `MISSING` coverage, the UI must say that no directly selected system record exists; it must not portray seven measured zeros.

---

## 10. UI Contract

- Home and Analysis use the same engine and taxonomy.
- The full Analysis view offers `최근 4주`, `최근 8주`, `최근 24주`, and `올해` controls.
- Charts use code, Korean label, numbers, and pattern/underline; color alone is insufficient.
- `MIXED_UNALLOCATED` remains visible even when its count is zero.
- Every chart has an accessible table and complete `aria-label` description.
- Excluded and duplicate counts appear near the chart.
- Copy must say `계획`, `완료 표시`, and `일지에서 직접 선택` rather than collapsing them into `완료 훈련` or `경험한 시스템`.
- No improvement, deficiency, risk, readiness, or next-plan judgment is generated in V1.

---

## 11. Required Tests

1. An untouched system field remains missing and does not become BASE.
2. Explicit journal systems aggregate counts and independently eligible metrics.
3. Imported, legacy, missing, and untrusted system sources are excluded.
4. `MIXED_UNALLOCATED` is never split.
5. Identical duplicates count once.
6. Same-id duration, distance, RPE, date, system, provenance, or trust conflicts exclude the entire identity.
7. Cross-window same-id observations do not create an inside-window conflict.
8. Planned, completion-marked, and journal values remain separate.
9. REST and RESTED do not become recovery training.
10. Private memo text and existence do not affect any result.
11. Missing metrics remain null and UI missing state is not zero.
12. Mobile, reduced-motion, accessible table, and no-horizontal-overflow checks pass.

---

## 12. Open Issues

| Issue ID | Severity | Canonical blocker | Status | Required evidence |
|---|---|---:|---|---|
| `OI-ESA-PLAN-JOURNAL-LINKAGE-001` | P1 | YES | OPEN | Immutable `plannedSessionId` to completed journal result binding |
| `OI-ESA-EXACT-9-5-ATTRIBUTION-001` | P1 | YES | OPEN | Timezone, frame instants, occurrence instant, session attribution |
| `OI-ESA-WHOLE-ENTRY-PRIVACY-001` | P1 | NO | OPEN | Whole-entry analysis scope and withdrawal lifecycle |
| `OI-ESA-HISTORICAL-PLAN-LEDGER-001` | P2 | NO | OPEN | Versioned archived plan sessions with immutable progress linkage |

No issue is closed by this draft or by V1 implementation tests.

---

## 13. Self Check

| Check | Result |
|---|---|
| Missing is not BASE or zero | PASS |
| Planned, completion mark, and journal facts stay separate | PASS |
| MIX remains unallocated and visible | PASS |
| Energy signature covers duration, distance, and RPE | PASS |
| Private text remains zero-signal | PASS |
| Exact 9.5-day and historical linkage remain blocked | PASS |
| Runtime tests claimed by markdown | NO |

[DRAFT_COMPLETE]
