# TRAINING_PLAN_METHOD_DECISION.md

```yaml
decision_metadata:
  decision_id: TO-DEC-TRAINING-METHOD-2026-07-14-001
  title: First-pilot training-plan method boundary
  status: OWNER_CONFIRMED_IN_CONVERSATION
  owner: COACH_HOJUNE
  recorded_at: 2026-07-14
  recorder: CODEX
  applies_to: ONE_COACH_LINKED_1500M_ATHLETE
  production_authority: false
  supersedes_joint_brief_pending_items: D1_D2_D3_D4_D5_ONLY_AS_LISTED_BELOW
```

## 1. Confirmed Decisions

Coach Hojune confirmed the following method boundary in the planning conversation.
This record preserves those decisions without turning unresolved coaching judgment
into an automatic formula.

| Decision | Confirmed boundary |
|---|---|
| Formation frame | One rolling cycle is 9.5 local civil days. A calendar week is a display/projection window, not the formation cycle. |
| MAIN count | Each 9.5-day frame contains 2 or 3 MAIN exposure events when plan formation is allowed. |
| MAIN placement | Approximately one MAIN every three days is a placement tendency. It is not a fixed 72-hour clearance rule. |
| Intervening load | Moderate and moderately-high running, plyometric, strength, hill, neural-fatigue-resistance, alternative aerobic, recovery, and composite work must remain visible in the formation process. |
| Composite sessions | One session may contain several load components. The system must not force the whole session into one modality or double-count copied measures. |
| Candidate generation | The system presents 2 or 3 meaningfully different, deterministic candidates from the same accepted input snapshot and rule-set version. |
| Final authority | A scoped coach makes the final plan selection. The system does not auto-finalize a candidate. |
| Pilot scope | The first formation/adaptation pilot is one coach-linked 1500 m athlete. |
| Calendar | A 7-day calendar projection preserves the source 9.5-day frame, block, session, and provenance identity. |
| Athlete notes | `PRIVATE_SELF_ONLY` content is never analyzed. Raw `ANALYZABLE_TRAINING_NOTE` text is not a plan input; only a separately accepted privacy-safe structured derivative may be considered in a future contract. |

## 2. Not Decided By This Record

The following remain open and cannot execute merely because this decision record
exists:

- exact phase-specific placement, progression, recovery, taper, and exception rules
- exact MAIN exposure-class vocabulary and allowed class sequences
- whether the user-facing option taxonomy is `BALANCED`, `CONSERVATIVE`,
  `RECOVERY_FOCUSED`, or `COMPETITION_PREP`
- minimum history length, freshness, missingness, and longitudinal sample thresholds
- load-vector aggregation, component allocation, percentile, or comparison formulas
- automatic readiness, fatigue, injury-risk, or medical clearance decisions
- one-athlete pilot baseline, stop criteria, and success criteria
- production implementation, canonical promotion, or runtime safety evidence

The statement in `DECISION_LOG.md` that useful AI coaching needs at least six months
of journal data is a product-sequencing rationale. It is not an executable formation
eligibility threshold for this controlled pilot unless the owner accepts it again as
a versioned rule with applicability and tests.

## 3. Acceptance Boundary

`TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md` may use Section 1 as owner-decision
provenance. Any proposal from Section 2 must remain visibly draft or held. This file
does not authorize edits to `app/`, automatic coaching, downstream issue closure, or
production deployment.

[DECISION_RECORDED]
