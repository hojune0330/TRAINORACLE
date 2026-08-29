# PLAN_CYCLE_RESPONSE_AND_ADAPTATION_CONTRACT.md

```yaml
doc_id: PLAN_CYCLE_RESPONSE_AND_ADAPTATION_CONTRACT
spec_id: TO-PLAN-CYCLE-RESPONSE-001
title: TrainOracle Repeated Cycle Response And Adaptation Contract
version: 1.0
round: RT1
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

The following are excluded: raw diary or memo text, including the existence of a
private memo; pain or symptom clauses; entries without a matching planned-session
link; missing, imported, derived, or legacy-missing RPE provenance; elapsed time
alone; completion marks alone; and unlinked activities.

## 3. Descriptive Result

The evaluator may return `NO_LINKED_RESULTS`, `ONE_SIGNAL`, `REPEATED_MATCH`,
`REPEATED_HIGHER_EFFORT`, or `MIXED_SIGNAL`. These states describe the available
linked evidence. They are not recovery, fitness, injury-risk, or efficacy diagnoses.

## 4. Next-Candidate Boundary

- Missing or one-off evidence never increases intensity, volume, or frequency.
- Repeated in-range RPE may support maintaining the current candidate or reviewing a separately approved method variation.
- Repeated above-range RPE may offer the existing approved lower-volume sibling or human review. It may not lower a safety disposition or rewrite the active plan.
- A result alone never creates a higher-volume sibling.
- PB/SB and explicit-request transitions remain governed by the existing adaptation registry. Intensity, volume, and frequency are never increased together.

## 5. User Explanation

The screen must show the linked sample count, the observed relation to the planned
RPE range, what remains unknown, and the fact that the result did not read private
text. A missing sample must be described as missing, not as zero or successful
completion.

## 6. Verification

Required tests cover no linked results, repeated explicit in-range results, repeated
above-range results, mismatched links, missing provenance, and private-memo
zero-signal behavior. Runtime test output remains separate from this document.

## 7. Open Issues

| Issue | Canonical blocker | Status | Required evidence |
| --- | --- | --- | --- |
| `OI-PCR-METHOD-VARIATION-001` | YES | OPEN | At least two accepted same-scope detailed methods and rotation rules. |
| `OI-PCR-MULTI-METRIC-001` | NO | OPEN | Qualified adoption before duration, split, or objective-component response is used. |
| `OI-PCR-LONGITUDINAL-001` | NO | OPEN | Prospective evidence before any efficacy or improvement claim. |

[DRAFT_COMPLETE]
