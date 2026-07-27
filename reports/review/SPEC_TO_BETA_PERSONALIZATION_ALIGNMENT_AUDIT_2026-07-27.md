# SPEC_TO_BETA_PERSONALIZATION_ALIGNMENT_AUDIT_2026-07-27.md

```yaml
document_metadata:
  doc_id: trainoracle-review-spec-to-beta-personalization-alignment-2026-07-27
  spec_id: SPEC_TO_BETA_PERSONALIZATION_ALIGNMENT_AUDIT
  title: Spec To Beta Personalization Alignment Audit
  version: "0.1"
  round: PERSONALIZATION_REENTRY
  status: WORKING_AUDIT_FOR_OWNER_REVIEW
  owner: COACH_HOJUNE
  open_issues_total: 4
  canonical_blocking_count: 4
  runtime_authority: false
  numeric_template_activation_authorized: false
  production_execution_allowed: false
  final_marker_required: "[DRAFT_COMPLETE]"
```

## 1. Audit purpose

This audit checks whether existing TrainOracle specifications already support the
product direction of source-backed, personally usable training plans. It is not a
new scientific source, a template activation decision, a safety clearance, or an
issue closure record.

The product goal is not to copy a famous athlete's training. It is to take a
reviewed session structure, combine it with the athlete's permitted inputs, and
show selectable plan candidates with their evidence and limits intact.

## 2. Files opened for this audit

| File | Verified contribution | Current authority boundary |
|---|---|---|
| `specs/reconstruct/TRAINING_SESSION_PRESCRIPTION_CONTRACT.md` | Intent types, pace-anchor facts, same-event RP formula, structured repeat/recovery fields, owner notation fixture | `RECONSTRUCTED_DRAFT_FOR_REVIEW`; no active numeric template |
| `specs/reconstruct/ENERGY_SYSTEM_SESSION_TEMPLATE_CATALOG.md` | 25 energy-intent seeds and 5 recovery-support seeds, source/transfer fields, stop/downshift references | All entries are `DRAFT` and `REVIEW_REQUIRED`; zero event and experience eligibility |
| `reports/research/TRAINING_SCHEDULE_RESEARCH_ACCEPTANCE_DECISION.md` | Research source classes and exact personal-numeric activation gates | Working draft; research is template-synthesis input, not runtime import data |
| `PLAN_BETA_PRODUCT_DECISION_2026_07_24.md` | Plan-first entry, 7/9/10-day candidate flow, self-selection when policy permits, RPE-first beta boundary | Public beta product decision; does not activate numeric templates |
| `specs/active/PLAN_GENERATOR_SPEC.md` | Session slots, planned energy focus, candidate lifecycle, Template Library order | Active SPEC baseline still says coach selection is required |
| `specs/reconstruct/TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md` | 9.5-day frame, 2-3 MAIN exposure convention, deterministic candidate formation | Draft, first coach-linked 1500 m pilot only; no public execution authority |
| `specs/reconstruct/MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md` | `CYCLE_DAY` namespace and AM/PM calendar projection vocabulary | `DOUBLE` and `FLEX` remain unresolved upstream |
| `impl/src/prescription/*` and `reports/implementation/DETAILED_PRESCRIPTION_RUNTIME_IMPLEMENTATION_REPORT_2026-07-26.md` | Parser, derived totals, same-event pace calculation, visible notation reader | Reader only; no public plan binding or active catalogue template |

## 3. What already exists and should be used

### 3.1 Personalization vocabulary and structure

The existing detailed-prescription contract already defines the needed planning
intent vocabulary:

```text
BASE_INTENT, LT_INTENT, VO2_INTENT, GLY_INTENT,
ATP_PC_INTENT, RECOVERY_INTENT, MIXED_INTENT
```

It also separates a session's set count, repetitions per set, work distance or
duration, repetition recovery, set recovery, warm-up, cooldown, downshift options,
stop conditions, and pace anchor. This is the correct shape for a future session
such as `2×(10×400m) @5000m RP · r60″ · R3′`; it prevents a meaningful prescription
from being reduced to one opaque string.

The contract's same-event formula and anchor policy are also usable later. A current
same-event result may support a race-pace calculation. A `GOAL` remains aspirational,
a stale PB is not silently current, and 30 m work never derives a target from 5K/T/I
race pace.

### 3.2 Research material has a proper role

The catalogue contains five seeds for each energy intent plus five recovery-support
seeds. Its source, population, transfer limitation, anchor kind, warm-up/cooldown,
downshift, and stop-condition fields are exactly the information needed to turn
research into a reviewable session template.

The research-acceptance decision correctly permits this flow:

```text
research source
  -> exact reviewed template and version
  -> event/experience/youth eligibility
  -> allowed athlete anchor and selected plan inputs
  -> Safety Gate
  -> selectable personal plan candidate
```

This is materially different from copying a named athlete's distance, recovery,
double-day pattern, or taper into a new athlete's plan.

### 3.3 The current public beta has a valid interim path

The beta decision already allows a visitor without journal history to choose a 7-,
9-, or 10-day plan, compare candidates, and self-select when the policy allows it.
For sparse inputs, the authorized interim output is total duration plus RPE. A new
focus selection may therefore truthfully show a **planned intent** such as LT or
VO2 while it remains explicit that repeat count, distance, recovery, pace, and the
underlying numeric template are not yet assigned.

This is the correct first implementation bridge. It does not claim the selected
intent is a measured physiological state, a medical clearance, or a fully detailed
individual prescription.

## 4. Alignment findings

| ID | Severity | Finding | Evidence and consequence |
|---|---|---|---|
| `PERS-ALIGN-001` | P1 | Research templates cannot yet produce a numeric personal session. | The catalogue has no `ACTIVE` entry and has empty event/experience eligibility. The research decision requires exact extraction, transfer review, youth policy, permitted anchor, plan inputs, Safety Gate, numeric integrity, and runtime evidence. Numeric UI must remain unavailable until an exact template passes all gates. |
| `PERS-ALIGN-002` | P1 | Self-service selection is a product decision but is not reconciled with the active Plan Generator record. | `PLAN_BETA_PRODUCT_DECISION_2026_07_24.md` permits athlete selection when policy allows, while `PLAN_GENERATOR_SPEC.md` has `requiresCoachSelection: true` and a coach-only Step 2. The next spec patch must model policy-based `SELF` or `COACH` selection without weakening a configured coach-required case. |
| `PERS-ALIGN-003` | P1 | AM/PM vocabulary exists, but double-session behavior is not ready to schedule. | Plan Generator defines `AM`, `PM`, `DOUBLE`, and `FLEX`; Calendar mapping and Formation both record `DOUBLE/FLEX` as unresolved. A public plan must not emit a double day until slot crosswalk, same-day exposure caps, safety/hold behavior, and calendar projection fixtures are accepted. |
| `PERS-ALIGN-004` | P1 | The prescription preparation function is not yet bound to a real Template Library record. | `impl/src/prescription/runtime.ts` accepts caller-supplied `ACTIVE` and `ELIGIBLE` status but does not receive a template ID/version, Template Library eligibility record, source/transfer decision, or youth policy. It is safe only as an isolated preparation seam, not as public activation logic. |

## 5. Product decisions preserved by this audit

```yaml
preserved_product_direction:
  service_name: TrainOracle
  service_provider: aaclub
  plan_first_without_journal: allowed_after_existing_safety_gate
  journal_first: allowed
  default_cycle_preference: 9_or_10_day
  explicit_short_cycle: 7_day_with_continuity
  self_service_plan: allowed_when_selection_policy_allows
  coach_linked_plan: allowed
  configured_coach_review: may_require_coach_selection
  high_intensity_intentions: visible_and_selectable_in_rpe_only_beta
  minors_rpe_only_beta: not_hidden_by_age
  minors_numeric_template: requires_exact_template_youth_policy
  dedicated_100_200_400_plan_line: deferred
  sub_60m_race_pace_conversion: forbidden
  double_session_generation: blocked_pending_slot_crosswalk
  D9_ACTIVE_or_UNKNOWN: blocks_or_requires_human_review
  raw_note_for_dose_or_audit: forbidden
```

## 6. Required implementation sequence

1. **Intent-first beta bridge**: add a structured planning-focus selection to the
   existing RPE/duration candidate generator. Persist the selected intent and show
   it as a planned label, not a numeric template, physiological measurement, or
   safety state.
2. **Selection-authority reconciliation**: patch the Plan Generator ownership
   contract so `SELF` selection is permitted only by explicit policy and
   `COACH_REQUIRED` remains fail-closed when configured. Recount the target issue
   table before making any closure claim.
3. **One-template activation packet**: choose one exact non-sprint template for a
   named event and experience scope. Record source extraction, transfer decision,
   youth policy, Template Library ID/version, eligibility, warm-up/cooldown,
   downshift/stop conditions, and reviewer names. Do not promote a whole family at
   once.
4. **Anchored detailed candidate**: bind only that active template to an explicit
   same-event, fresh, provenance-carrying anchor. When the anchor is incomplete,
   retain the RPE-only candidate rather than guessing a pace.
5. **Double-session contract**: define the AM/PM versus `DOUBLE/FLEX` crosswalk,
   same-local-day exposure rule, availability policy, safety hold behavior,
   calendar projection, and regression fixtures before a public double day can be
   generated.

## 7. Non-negotiable display rules

- RPE 1-2 is active recovery: brisk walking, a jog only a little faster than
  walking, easy cycling, or gentle uphill walking can fit this range.
- RPE 3-4 is basic aerobic work: some sweat, an approximately Zone-2-like feel,
  and conversation or a phone call remains possible. RPE is personal exertion, not
  the same thing as a watch's heart-rate zone.
- Higher RPE labels need the same plain-language explanation next to the numeric
  range. The `?` trigger explains the practical feeling and the boundary first.
- `LT`, `VO2`, `GLY`, and `ATP_PC` must be displayed as a plan's intended focus;
  the interface must not imply that TrainOracle measured the athlete's energy
  system.
- A plan with no active detailed template must say which values are still
  unassigned. It must not replace them with invented repetitions, pace, recovery,
  or celebrity-training examples.

## 8. Audit conclusion

The detailed-personalization work is not missing from TrainOracle's design. Its
contracts, research inventory, notation parser, and anchor rules already exist.
The immediate product gap is a controlled bridge from those materials to a real
athlete-facing plan.

The correct next build is RPE-based focus selection and candidate explanation,
followed by a narrowly reviewed activation of one source-backed template. Full
numeric libraries and double-session scheduling must not be opened before their
separate eligibility, authority, and calendar contracts are accepted.

[DRAFT_COMPLETE]
