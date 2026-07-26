# Energy System Guidance And Calibration Specification

```yaml
document_status: DRAFT_FOR_OWNER_REVIEW
document_role: PLANNING_BOUNDARY
source_commit: 0d5dc6548f920ca882f2d555b92b37f3c91ab6c7
planning_route: Terra -> Sol -> OWNER -> Terra
sol_advisory:
  model: gpt-5.6-sol
  reasoning_effort: xhigh
runtime_authority: false
implementation_authorized: false
automatic_prescription_authorized: false
next_actor: OWNER
```

## 1. One-Sentence Direction

TrainOracle will first use a **manual, coach-configured cruise control**:
it shows how a completed training record compares with a coach-defined range.
It does not automatically increase, reduce, choose, or finalize training.

This document is a planning boundary only. It creates no application behavior,
training-plan generator, athlete profile threshold, consent permission, safety
clearance, or scientific claim.

## 2. What This Is And Is Not

| This document defines | This document does not define |
|---|---|
| A clear separation between observed facts, coach-defined ranges, and a future comparison display | A universal dose, energy-system capacity score, recovery score, or readiness score |
| A safe way to preserve composite-session components without double counting | A default range for BASE, LT, VO2, GLY, ATP-PC, or any other system |
| A non-executing comparison state that explains missing evidence honestly | A plan change, safety clearance, medical conclusion, injury-risk prediction, or return-to-play decision |
| The owner decisions needed before a future implementation plan | Acceptance of draft load formulas as production authority |

The existing labels `BASE_INTENT`, `LT_INTENT`, `VO2_INTENT`, `GLY_INTENT`,
`ATP_PC_INTENT`, `RECOVERY_INTENT`, and `MIXED_INTENT` remain
`COACH_INTENT_LABEL_ONLY`. They are not physiological measurements, automatic
classifications, or proof that a completed session had a particular effect.

## 3. Four Stages

### S0: Observation Ledger

Store or display only structured facts with their source and completeness state.
Examples can include completed duration, distance, interval recovery, external
load components, session RPE, pace, and coach-entered intent. A missing value
stays missing; it is never estimated merely to make a comparison possible.

### S1: Coach Range Registration

A coach may register a range for one scoped athlete and a stated period. The
range is a planning reference, not a physiological truth.

```yaml
CoachRangeProfile:
  athleteScope: required
  validFrom: required
  validUntil: required
  planningPhase: required
  energyIntent: one_registered_intent
  dimension: owner_approved_registered_dimension
  unit: owner_approved_registered_unit
  minimum: explicit_number
  maximum: explicit_number
  sourceRationaleRef: required
  version: required
  confirmedByCoach: required
```

No system default, group default, silent imputation, or inferred range is
allowed. A range without an explicit coach confirmation is unavailable.

### S2: Shadow Comparison

The system may compare S0 facts with a valid S1 range without changing a plan.

```yaml
EnergyGuidanceStatus:
  allowedValues:
    - BELOW_COACH_RANGE
    - WITHIN_COACH_RANGE
    - ABOVE_COACH_RANGE
    - UNAVAILABLE
  mustShow:
    - observedValueOrMissing
    - coachRangeVersionOrMissing
    - sourceRefs
    - completenessState
    - uncertaintyState
    - comparisonReason
  candidateInfluence: false
  executionInfluence: false
```

`UNAVAILABLE` is the required outcome when the athlete-specific range, source,
unit, allocation, or comparison precondition is missing. It is not a warning
that the athlete failed a target.

### S3: Future Candidate Annotation

After separate owner approval and shadow evidence, a later system may attach an
S2 result as a non-executing annotation to a coach review surface. It still may
not rank options, choose a plan, or prescribe a dose without a separately
accepted planning and safety contract.

## 4. Composite Sessions And Allocation

One completed session may contain running, plyometric, strength, alternative
aerobic, recovery, and other registered components. Preserve the parent session
and each component rather than forcing the day into one energy-system bucket.

```yaml
composite_measure_rules:
  parentMeasureId: required_when_component_uses_parent_measure
  dedupeKey: required
  allocationFraction: explicit_0_to_1_or_unavailable
  duplicate_dedupeKey: reject
  unknown_allocation:
    comparisonStatus: UNAVAILABLE
    candidateInfluence: false
  allocated_components:
    may_not_exceed_parent_measure: true
```

This prevents the same distance, duration, or load from being counted both for
the parent session and for copied components. It also prevents a system from
pretending that a mixed session has a known percentage split when it does not.

## 5. Numbers: What May Be Shown And What May Not Be Claimed

The existing metric document contains draft formulas for session load,
CTL/ATL/TSB, heart-rate drift, rolling load ratio, and monotony. They may be
shown only with their formula version, source references, input-completeness
state, and uncertainty state. They remain draft research inputs, not automatic
energy-system prescriptions.

```yaml
prohibited_outputs:
  autoGenerate: false
  autoSelect: false
  autoFinalize: false
  mayClearSafety: false
  mayDeclareRecovery: false
  mayPrescribeDose: false
  mayInferMissingAllocation: false
  mayTreatDraftFormulaAsClinicalOrScientificProof: false

required_before_any_future_range_comparison:
  coachConfirmationRequired: true
  sourceRefsRequired: true
  formulaVersionRequired_when_derived: true
  completenessStateRequired: true
  uncertaintyStateRequired: true
```

An observed `ABOVE_COACH_RANGE` result means only that one recorded value is
above one coach-defined value range. It must not become a recovery judgement,
a safety decision, or an instruction to reduce the next session.

## 6. Current Method Boundary

The historical 9.5-day frame, 2-3 MAIN exposures, and approximate three-day
placement tendency must be treated as historical, non-executing reference
material until the owner re-approves them for the current product direction.
They cannot be silently used as numerical defaults for this specification.

Likewise, energy-system guidance must never convert a missing baseline, missing
component allocation, unknown unit, or stale source into a numerical target.

## 7. Minimum Owner Decisions

1. **Cycle convention**: Should the historical 9.5-day / 2-3 MAIN convention
   be re-approved for the next scoped product phase, revised, or remain
   reference-only?
2. **Range registry**: Which dimensions, units, explicit allocation rules, and
   coach roles may create an athlete-specific `CoachRangeProfile`?
3. **Shadow protocol**: What duration, stop conditions, review cadence, and
   evidence are required before S3 may be considered?

Until these decisions exist, the conservative default is S0 observation only.

## 8. Acceptance Checks For A Later Implementation Plan

Any future implementation proposal must demonstrate all of the following:

1. Separate `ObservedEnergyMetric`, `CoachRangeProfile`, and
   `EnergyGuidanceStatus` records or equivalent typed boundaries.
2. The seven intent labels remain coach intent only.
3. Missing allocation, unit, range, or source produces `UNAVAILABLE` and has
   no candidate influence.
4. Composite inputs reject duplicated measures and preserve explicit parent and
   allocation links.
5. Derived values retain formula version, source references, completeness, and
   uncertainty.
6. The prohibited-output flags in Section 5 remain false.
7. The comparison is visible as a coach-reviewed shadow result, not a training
   command.

## 9. Handoff

```text
HANDOFF
commit: RECORDED_IN_GITHUB_PR
branch: codex/energy-system-cruise-control-planning
scope: reports/review/ENERGY_SYSTEM_GUIDANCE_AND_CALIBRATION_SPEC.md
verified: documentation boundary review and git diff checks pending commit
decision: Sol advisory recorded in this document
open: the three owner decisions in Section 7
```
