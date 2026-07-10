# COMPOSITION_BALANCE_BASELINE_CONTRACT.md

```yaml
document_metadata:
  doc_id: trainoracle-composition-balance-baseline-contract
  spec_id: COMPOSITION_BALANCE_BASELINE_CONTRACT
  title: Composition Balance Baseline Contract
  version: 0.1
  round: RT1_RECONSTRUCTED
  status: DRAFT_FOR_REVIEW
  owner: COACH_HOJUNE
  created_from:
    - CODEX_WORK_ORDER_005.md Task B
    - SPEC_SOURCE_ACCEPTANCE_DECISION_ROUND5.md T5-3
  open_issues_total: 5
  canonical_blocking_count: 3
  executed_tests_total: 0
  runtime_evidence: none
```

---

## 1. Purpose

This document defines the draft contract for displaying training-composition
balance signals such as intensity distribution, distance-change context, and
high-load share. It is a baseline and display contract only.

The contract exists because early UI work may show balance markers with a demo
baseline. Until coach-approved or literature-backed values are accepted, any
displayed balance baseline must remain clearly marked as `basis:
placeholder_demo` and the UI must keep a visible `기준: 데모` badge.

---

## 2. Top-Level Safety Boundary

Composition balance is not safety authority.

```yaml
composition_balance_authority:
  is_safety_authority: false
  can_block_training: false
  can_clear_D9_or_Safety_Gate: false
  can_override_RVE: false
  can_override_Plan_Safety_Gate: false
  can_create_medical_clearance: false
```

A balance marker may help a coach notice under-emphasis or over-emphasis in a
training mix. It must not block plan generation, clear D9/Safety Gate status, or
replace human review. `in_range` means only that the displayed composition is
inside the selected non-safety baseline.

---

## 3. Baseline Basis Model

Each baseline must carry an explicit basis.

```yaml
baseline_basis_values:
  allowed:
    - coach_policy
    - published_guideline_reference
    - placeholder_demo
```

| Basis | Meaning | Required Handling |
|---|---|---|
| `coach_policy` | Coach or owner has accepted the baseline for a defined athlete scope. | Store approver, approval date, and scope. |
| `published_guideline_reference` | Baseline is tied to a cited training guideline or published reference. | Store citation metadata and validation status. |
| `placeholder_demo` | Baseline exists only to support prototype display or discussion. | Must keep `기준: 데모` badge and must not be presented as accepted coaching standard. |

No baseline value may be treated as final unless its `basis` and approval state
permit it. Unknown or partially specified baselines must degrade to
`placeholder_demo` or remain hidden.

---

## 4. Baseline Record Shape

```yaml
composition_baseline_record:
  baselineId: required_string
  metricKey: required_string
  periodAxis: WEEKLY_OR_MONTHLY_OR_SEASON
  athleteLevel: ENTRY_OR_DEVELOPMENT_OR_PERFORMANCE_OR_UNKNOWN
  basis: coach_policy_OR_published_guideline_reference_OR_placeholder_demo
  rangeLow: nullable_structured_value
  rangeHigh: nullable_structured_value
  unit: required_string
  approvedBy: optional_string
  approvedAt: optional_timestamp
  referenceId: optional_string
  placeholderBadgeRequired: boolean
  validFrom: optional_date
  validTo: optional_date
```

The record shape allows ranges to be absent while the baseline is still a draft.
It does not define final numeric values.

---

## 5. Period Axis Validity

Different balance concepts are valid on different time axes. A UI must not
reuse a weekly interpretation as a monthly or seasonal interpretation without an
accepted baseline for that axis.

| Baseline Type | Weekly | Monthly | Season | Notes |
|---|---|---|---|---|
| Intensity distribution share | VALID | VALID_WITH_SEPARATE_BASELINE | VALID_WITH_SEPARATE_BASELINE | Each axis needs its own accepted range. |
| Distance change context | VALID | REVIEW_ONLY | INVALID_UNLESS_DEFINED | Designed primarily for short-term load-change review. |
| High-load share | VALID | VALID_WITH_SEPARATE_BASELINE | REVIEW_ONLY | Must not become a medical or safety blocker. |
| Race-specific sharpening mix | REVIEW_ONLY | VALID_WITH_SEPARATE_BASELINE | VALID_WITH_SEPARATE_BASELINE | Requires periodized coach policy before display. |

State meanings:

| State | Meaning |
|---|---|
| `VALID` | May be evaluated if an accepted or placeholder baseline exists for the axis. |
| `VALID_WITH_SEPARATE_BASELINE` | May be evaluated only with an axis-specific baseline. |
| `REVIEW_ONLY` | May be shown as context but should avoid marker-style judgment until accepted. |
| `INVALID_UNLESS_DEFINED` | Hidden unless a later accepted spec defines the behavior. |

---

## 6. Athlete Level Parameter

The contract reserves an athlete-level parameter:

```yaml
athlete_level:
  allowed_draft_values:
    - entry
    - development
    - performance
    - unknown
  final_value_set_status: OPEN
```

Level-specific thresholds are not accepted in this draft. If `athleteLevel` is
`unknown`, the UI must either hide level-specific markers or use a
`placeholder_demo` baseline with the demo badge visible.

---

## 7. Display Contract

The UI may display only three status values:

```yaml
composition_balance_display_state:
  allowed:
    - below_range
    - in_range
    - above_range
```

| State | Display Rule | Notes |
|---|---|---|
| `below_range` | May show a low-side marker. | Marker text must not imply injury risk or safety clearance. |
| `in_range` | Silent: no marker by default. | No positive safety claim may be displayed. |
| `above_range` | May show a high-side marker. | Marker text must not block training or imply D9 activation. |

If any active baseline has `basis: placeholder_demo`, the relevant UI surface
must keep a visible `기준: 데모` badge near the marker, legend, or balance panel.

---

## 8. Metric Boundary

This contract permits only simple composition checks, such as ratio and sum over
already-accepted structured training fields.

```yaml
metric_boundary:
  allowed_operations:
    - simple_ratio
    - simple_sum
    - compare_to_baseline_range
  forbidden_sources:
    - METRIC_ALGORITHM_CONTRACT.md §6 Draft Formula Set
  forbidden_formula_authority:
    - CTL
    - ATL
    - TSB
    - any_unaccepted_metric_formula
```

While `OI-MAC-FORMULA-ACCEPTANCE-001` remains OPEN, no formula from
`METRIC_ALGORITHM_CONTRACT.md` section 6 may be copied into this contract or
implemented through it.

---

## 9. Required Audit Shape

Composition balance display audits must stay structured:

```yaml
composition_balance_audit:
  athleteId: required_string
  metricKey: required_string
  periodAxis: required_string
  athleteLevel: required_string
  basis: required_string
  displayState: below_range_OR_in_range_OR_above_range
  baselineId: required_string
  computedAt: required_timestamp
  rawMemoStored: false
  safetyDispositionChanged: false
```

The audit must not store raw athlete free text, symptom clauses, coach notes, or
unstructured explanation text.

---

## 10. Open Issues

| issue_id | title | status | canonical_blocking | notes |
|---|---|---|---:|---|
| OI-CBB-COACH-BASELINE-APPROVAL-001 | Coach approval of baseline values required | OPEN | YES | Final ranges cannot be accepted without owner/coach approval. |
| OI-CBB-ATHLETE-LEVEL-DIFFERENTIATION-001 | Athlete-level value set and threshold differences unresolved | OPEN | YES | `entry`, `development`, and `performance` remain draft placeholders. |
| OI-CBB-LITERATURE-VALIDATION-001 | Published guideline validation pending | OPEN | YES | `published_guideline_reference` baselines require source vetting before use as non-demo guidance. |
| OI-CBB-UI-BADGE-BINDING-001 | Demo badge binding needs downstream UI acceptance | OPEN | NO | Any placeholder baseline must keep the `기준: 데모` badge visible. |
| OI-CBB-RUNTIME-EVIDENCE-001 | Runtime display and audit evidence missing | OPEN | NO | No runtime evidence is claimed by this draft. |

---

## 11. Non-Claims

This draft does not claim:

- Any final training-composition numeric baseline is accepted.
- Any balance marker is a safety blocker.
- Any `in_range` marker clears D9, RVE, Safety Gate, or human review.
- Any METRIC section 6 formula is accepted or propagated.
- Any runtime test has passed.
- Any open issue is closed.
- Any canonical promotion is granted.

[DRAFT_COMPLETE]
