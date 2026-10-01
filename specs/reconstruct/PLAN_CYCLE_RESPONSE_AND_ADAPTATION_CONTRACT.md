# PLAN_CYCLE_RESPONSE_AND_ADAPTATION_CONTRACT.md

```yaml
doc_id: PLAN_CYCLE_RESPONSE_AND_ADAPTATION_CONTRACT
spec_id: TO-PLAN-CYCLE-RESPONSE-001
title: TrainOracle Repeated Cycle Response And Adaptation Contract
version: 1.4
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
`plannedSessionLink` matches the active candidate and session identity, or the exact
unchanged same-cycle original allowed by section 13. The first
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
  For section 13 recovery, retain this original identity and expose a separately
  recomputed current occurrence reference only after exact chain validation.
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

## 12. Execution Deviation Review Direction (2026-09-28)

[PLAN_EXECUTION_DEVIATION_AND_REPLAN_CONTRACT](PLAN_EXECUTION_DEVIATION_AND_REPLAN_CONTRACT.md)
defines the new draft path for explaining changed actual work and reviewing the
remaining schedule. Modified/partial results remain excluded from the existing
same-prescription RPE comparison; exclusion is not a reason to discard known
actual facts or end all coaching at `CHANGED_SESSION`.

The new path distinguishes factual comparison, reviewed impact policy, a proposed
remaining-frame/block revision and explicit acceptance. It does not convert a
deviation into the existing PB_SB/EXPLICIT_REQUEST successor, infer adherence from
completion, or authorize runtime dose/schedule changes now. Existing observations
and all section 7 issues keep their current meaning and status. Implementation is
tracked separately in the linked contract's execution plan.

## 13. Same-Cycle Evidence After A Plan Change (2026-10-01)

The owner-approved persona-remediation work repairs evidence continuity without
adopting a new dose or successor transform. A changed candidate identifier must not
discard an unchanged, already-linked session in the same cycle.

- Resolve the immutable journal link against an exact retained original through
  replay-validated catalog-replacement/execution-replan receipts. Every intervening
  original and cycle context must match. Do not search an unrelated recent plan or
  rewrite a journal link to the current candidate.
- The compared occurrence must remain unchanged throughout that chain. Compare its
  original prescription, not a new slot's content. Missing originals, changed target
  sessions, dates, stale recurrent content IDs and invalid chains remain excluded.
- Group accepted links by the same-cycle date/day/AM-PM occurrence across candidate
  versions. Multiple distinct records or conflicting copies remain one conflicting
  occurrence, not repeated evidence. Identical copies count once; private text and
  its existence remain outside matching and deduplication.
- A valid original planned-slot link and a different explicit actual AM/PM slot
  are not a missing journal. Preserve the actual slot and measurements, label the
  changed execution, and exclude same-prescription RPE comparison. A forged planned
  slot/date/content link still fails. Do not silently move the plan or the journal.
- Mark comparisons recovered from an original as such inside the existing evidence
  detail. An unreadable account/archive source is not an empty history. Preserve
  directly verifiable results and disclose incomplete original lookup separately.
- Apply the same evidence boundary to the cycle summary, personal Oracle and
  saved-session explanation. Their read-only evidence does not authorize an
  unregistered catalog successor, clear safety, or manufacture physiological change.
- A direct linked-journal entry opens the actual-record section in the existing
  reader. General method entry remains unchanged, and tab/return positions persist.
  This is a viewport change, not a journal write or a new comparison rule.

Required regressions: unchanged-target multi-hop recovery, missing/forged/wrong-cycle
original rejection, cross-version duplicate/conflict accounting, source-read failure,
unchanged private-text zero-signal and rendering through the real caller boundary.
All existing open issues and the exact numerical transform registry remain unchanged.

### 13.1 Account History Readiness And View Continuity

The current-plan account projection does not prove that archived originals were
read. The cycle evidence view, saved-session actual-record reader and plan-based
personal Oracle request those originals when the user opens the relevant view.
An example-only view and the home return panel do not start a full-history request.

- Keep directly verifiable records available while originals load. Loading or a
  failed read must not become an empty-history claim or successful comparison.
- A failed request offers an explicit retry, not an unbounded retry loop. Closing
  one view does not cancel another view's shared request.
- Initial account projection failure is separate: direct the user to the existing
  account-plan recovery controls. Do not label a no-op as a history retry or call
  hydration as though it were read-only; it may recover a pending write.
- Journal readiness is separate from plan-history readiness. Until the relevant
  journal read completes, do not display an empty/completed comparison. Observe
  journal change events and refresh the open summary/reader when records arrive.
- Do not mark an unfinished personal comparison as seen through either its view
  callback or bookmark fingerprint. Example browsing remains available and separate.
- An explicit retry also refreshes the reader evidence when no storage or network
  event was emitted. Readiness alone must not remove the retry while leaving stale
  comparison contents on screen.
- Late responses cannot cross an account/service change or reopen a closed view.
  Read each refreshed result from the current scoped store, never a retained
  response containing another account's originals.
- A history-only event must not reset the current plan flow, selected reader tab
  or scroll position. A real prescription/progress change retains the existing
  stale-proposal invalidation behavior.

This is read-only evidence readiness, not a reconstructed A/B candidate pair,
new numerical transform, server write or production verification. All open issues
and existing dose/safety boundaries remain unchanged.

## 14. Owner-Directed Detailed Successor Preview (2026-10-01)

The owner explicitly directed implementation of actual-result linkage into the
next cycle's detailed composition. This adds a bounded new-draft path, not a silent
mutation of the active frame or a removal of the legacy adaptation registry guard.

- Use the exact current predecessor and the section 2/13 structured linked-result
  evaluator. No memo content, completion-only inference, imported effort or missing
  values become successful execution or evidence for progression.
- Match detailed MAINs by purpose and occurrence order only within compatible
  event/experience/focus contexts. Preserve exact reviewed source and inputs for
  maintenance. Re-evaluate time-sensitive record references; do not revive stale
  pace evidence or claim that a former environment answer certifies future dates.
- Repeated above-range eligible RPE for a purpose may prepare an already-reviewed
  lower-dose configuration from the same method group. Do not invent percentages,
  remove recovery, or multiply arbitrary repeats. Target RPE, work duration,
  distance and repeats cannot increase, and recovery cannot become shorter.
- When no such exact configuration is available, preserve the current detailed
  workout with an explicit review reason. A different method is not automatically
  a lower burden simply because its total time is shorter.
- Missing/single/conflicting/incomplete observations do not authorize reduction
  or increase. Easier or in-range reports never produce automatic progression.
  Preserve the distinction between maintenance and insufficient evidence.
- The initial trigger requires at least two distinct eligible above-range results
  in the same purpose, with the source purpose's MAIN observations complete.
  This is a bounded product rule, not a validated physiological threshold.
- This feature prepares a candidate only. Show a brief result and optional source
  comparison before the athlete starts the next plan. Use the existing explicit
  successor activation, predecessor/CAS protection and periodization lineage.
  Cancel or failed storage must leave the predecessor and original journals intact.
- Every new successor write must carry the preview's scoped structured-evidence
  fingerprint and recheck it inside the save lock and the account pre-write callback.
  Omitting this context is not a legacy bypass. An exact already-committed retry
  may acknowledge the existing state without a new write after journals change.
- This implementation covers the ordinary version-3 next-frame path. Adjusted
  version-4/5/6 continuation and legacy registered transforms keep their separate
  limits; this section does not declare them implemented.
- Do not add MAIN exposure or modify availability, safety disposition, or AM/PM
  scheduling through this projection. The existing future-environment check remains
  required where applicable. Old saved plans and explanation versions remain readable.

Existing section 7 issues stay OPEN. This is an owner-approved bounded implementation
direction using existing reviewed catalogue numbers, not scientific efficacy proof,
a new physiological threshold, or authorization of unrestricted NEXT_FRAME transforms.

[DRAFT_COMPLETE]
