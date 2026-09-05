# PLAN_CYCLE_RESPONSE_AND_ADAPTATION_CONTRACT.md

```yaml
doc_id: PLAN_CYCLE_RESPONSE_AND_ADAPTATION_CONTRACT
spec_id: TO-PLAN-CYCLE-RESPONSE-001
title: TrainOracle Repeated Cycle Response And Adaptation Contract
version: 1.2
round: RT2_CORE_EVIDENCE_INTEGRITY
status: DRAFT_FOR_REVIEW
owner: TrainOracle Product Owner
open_issues_total: 3
canonical_blocking_count: 1
executed_tests_total: 0
canonical_promotion_allowed: false
final_marker_required: DRAFT_COMPLETE_AT_END
```

## 1. Purpose

This draft connects completed plan sessions to the next plan-candidate review without
turning journal history into an automatic progression formula. It supplements, and
does not redefine, `TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md`.

## 2. Accepted Inputs

Only a structured post-session entry may contribute when its immutable
`plannedSessionLink` matches the active candidate and session identity. The first
runtime version uses only an explicitly entered RPE and the stored planned RPE range.
Quick capture is eligible under this same rule only when it stores one exact RPE with
`EXPLICIT` provenance and the immutable planned-session link. A quick RPE band, missing
RPE, generic quick entry, or device-derived effort remains excluded.

The following are excluded: raw diary or memo text, including the existence of a
private memo; pain or symptom clauses; entries without a matching planned-session
link; missing, imported, derived, or legacy-missing RPE provenance; elapsed time
alone; completion marks alone; and unlinked activities.

### 2.1 Current-Plan Evidence Binding (2026-09-02)

The owner approved the core/spec correction and bounded implementation track on
2026-09-02. This adds no training dose, template, scientific threshold, or automatic
adaptation authority. The existing comparison rule is applied to trustworthy inputs:

- Recompute the complete planned-session identity from the stored active plan,
  generation version, start date, session content, day and AM/PM slot. A matching
  candidate label or day alone is insufficient. Validate the stored link itself.
- A journal date different from the selected planned date is not silently aligned.
  Keep it as an excluded mismatch pending an explicit rescheduling contract.
- Duplicate copies of one structured result count once. Conflicting copies of the
  same journal ID, or multiple distinct journals for one occurrence, do not become
  repeated evidence. Compare structured fields only, never memo content/existence.
- RESTED/SKIPPED results and explicit MODIFIED/NOT_APPLICABLE execution relations
  cannot claim effort comparable to the original session. PARTIAL/LIGHT_ACTIVITY
  remain observed results, not evidence that the complete prescription was followed.
- A PACE_TARGET session has no adopted planned RPE range. Its exact entered RPE may
  be shown as an observation, but cannot be compared to an invented RPE target.
- Preserve per-occurrence evidence and explicit exclusion reasons. A complete
  classifier, physiological response model and historical ledger remain separate.

## 3. Descriptive Result

The evaluator may return `NO_LINKED_RESULTS`, `ONE_SIGNAL`, `REPEATED_MATCH`,
`REPEATED_HIGHER_EFFORT`, `MIXED_SIGNAL`, or `NO_COMPARABLE_RESULTS`. These states describe the available
linked evidence. They are not recovery, fitness, injury-risk, or efficacy diagnoses.

`ONE_SIGNAL` means exactly one comparable RPE, not zero. `NO_COMPARABLE_RESULTS`
means linked records exist but no eligible comparison exists. Below-range RPE is
counted separately, never as missing or a reason for automatic progression. The
screen must not call observations from different sessions "the same training".

## 4. Next-Candidate Boundary

- Missing or one-off evidence never increases intensity, volume, or frequency.
- Repeated in-range RPE may support maintaining the current candidate or reviewing a separately approved method variation.
- Repeated above-range RPE may offer the existing approved lower-volume sibling or human review. It may not lower a safety disposition or rewrite the active plan.
- A result alone never creates a higher-volume sibling.
- PB/SB and explicit-request transitions remain governed by the existing adaptation registry. Intensity, volume, and frequency are never increased together.
- A method-variation button must not promise a new method when the same-scope
  accepted catalogue contains only one. In-range observations may offer maintenance;
  adding a genuinely different method still requires its own exact adoption.
- Journal review itself does not submit a proposal. The athlete must explicitly
  request the existing approved lower-volume sibling and pass current safety and
  acceptance gates. Preserve the active plan and its detailed MAIN unchanged.

## 5. User Explanation

The screen must show the linked sample count, the observed relation to the planned
RPE range, what remains unknown, and the fact that the result did not read private
text. A missing sample must be described as missing, not as zero or successful
completion.

## 6. Verification

Required tests cover no linked results, repeated explicit in-range results, repeated
above-range results, mismatched links, missing provenance, and private-memo
zero-signal behavior. Runtime test output remains separate from this document.
Also test zero comparable RPE, stale plan versions, content/date tampering, exact
duplicate and conflicting inputs, AM/PM separation, non-performed/modified sessions,
detailed-pace observations without a planned RPE, and below-range accounting.

## 7. Open Issues

| Issue | Canonical blocker | Status | Required evidence |
| --- | --- | --- | --- |
| `OI-PCR-METHOD-VARIATION-001` | YES | OPEN | At least two accepted same-scope detailed methods and rotation rules. |
| `OI-PCR-MULTI-METRIC-001` | NO | OPEN | Qualified adoption before duration, split, or objective-component response is used. |
| `OI-PCR-LONGITUDINAL-001` | NO | OPEN | Prospective evidence before any efficacy or improvement claim. |

## 10. Explanation And Method-Choice Boundary (2026-09-02)

Session explanation separates planned stimulus, linked actual record and observed
change. Completed checkmarks do not manufacture actual duration/distance or prove
physiological adaptation. Sparse training history does not diagnose an energy-system
deficit. Preserve the exact plan/session linkage and exclusion reasons.

Same-method repetition in a later cycle is allowed for comparison. Two method
options belong to an explicitly selected future plan; they are not automatic
progression or authority to edit the active frame. A method switch must disclose
all dose differences and pass the accepted successor/transform rules. It cannot
relabel multiple intensity/volume/frequency changes as a single harmless change.
Until a specific reviewed transform exists, show explanation/comparison only.

Change ledger: ADD explanation provenance and method distinction; KEEP current
adaptation limits and immutable active plans; DEFER unaccepted transforms and
efficacy claims. All existing open issues remain open.

## 11. Independent Slot Methods And Approved Implementation (2026-09-05)

[SESSION_METHOD_SELECTION_AND_ADJUSTMENT_CONTRACT](SESSION_METHOD_SELECTION_AND_ADJUSTMENT_CONTRACT.md)
binds the approved multi-method engineering direction. Section 10's two options and
OI-PCR-METHOD-VARIATION-001's minimum evidence requirement are not a fixed-pair
architecture or a licence to rotate automatically. Independent reviewed families
and configurations may be prepared across the full catalogue; exact source and
adjustment gaps live in the linked readiness report, not new approval claims.

Current runtime provides one detailed session with selectable MAIN placement.
Concurrent detailed choices for every MAIN are the eventual target and require an
exact per-slot applicability/exposure/interaction policy. A future method choice
replaces its intended occurrence only; no extra exposure, catch-up, automatic dose
increase or active-frame mutation is authorized. A successor still needs the
existing exact versioned transform and its single-dimension constraints.

Recommendation is not application. Draft/apply/cancel and plan acceptance are
separate; snapshots preserve configuration/rule/source versions and planned-session
lineage. Actual records link to the exact historical prescription, not a slot's
new content or today's active plan. Maintain all modified/partial/duplicate/missing
evidence exclusions and do not invent a planned RPE for PACE_TARGET.

Engineering approval is not scientific, efficacy or dose approval. No raw memo or
metadata enters the response loop. Youth/self-use and safety/processing gates stay
unchanged. All three section 7 issue rows and the one canonical blocker remain OPEN.

[DRAFT_COMPLETE]
