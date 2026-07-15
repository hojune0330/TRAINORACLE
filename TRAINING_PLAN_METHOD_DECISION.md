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
  supersedes_joint_brief_pending_items: PARTIAL_ONLY_SEE_SECTION_4
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
- whether MAIN count applies to every sliding 9.5-day window or named lineage frames,
  including re-anchor carry-over and missed-MAIN accounting
- exact MAIN exposure-class vocabulary and allowed class sequences
- whether the user-facing option taxonomy is `BALANCED`, `CONSERVATIVE`,
  `RECOVERY_FOCUSED`, or `COMPETITION_PREP`
- minimum history length, freshness, missingness, and longitudinal sample thresholds
- load-vector aggregation, component allocation, percentile, or comparison formulas
- automatic readiness, fatigue, injury-risk, or medical clearance decisions
- one-athlete pilot baseline, stop criteria, and success criteria
- production implementation, canonical promotion, or runtime safety evidence
- coach-free advisory scope, provenance/legacy detail, encrypted backup timing, and
  final Fable/Codex implementation ownership

The statement in `DECISION_LOG.md` that useful AI coaching needs at least six months
of journal data is a product-sequencing rationale. It is not an executable formation
eligibility threshold for this controlled pilot unless the owner accepts it again as
a versioned rule with applicability and tests.

## 3. Acceptance Boundary

`TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md` may use Section 1 as owner-decision
provenance. Any proposal from Section 2 must remain visibly draft or held. This file
does not authorize edits to `app/`, automatic coaching, downstream issue closure, or
production deployment.

## 4. Joint-Brief Partial Supersession

This decision only narrows the 2026-07-14 parts below; it does not mark D1-D5 as
fully resolved.

| Joint item | Confirmed here | Still pending |
|---|---|---|
| D1 | Final selection for this pilot requires a linked coach. | Coach-free advisory scope. |
| D2 | Formation requires explicit eligible provenance and rejects silent defaults. | Metadata names, legacy/import/demo handling, and partial-log eligibility. |
| D3 | `PRIVATE_SELF_ONLY` is zero-signal; raw analyzable-note text is not a plan input. | Encrypted backup and any future structured derivative policy. |
| D4 | One linked 1500 m pilot, 9.5-day frame, 2-3 MAINs, and deterministic 2-3 candidates. | Exact coaching rules, taxonomy, bindings, and pilot protocol. |
| D5 | This draft preserves Fable `app/` ownership and Codex contract work. | Final vertical-slice ownership and app integration approval. |

## 5. Owner Follow-Up: Athlete-Visible Shadow Pilot

```yaml
decision_amendment:
  decision_id: TO-DEC-ATHLETE-VISIBLE-SHADOW-2026-07-14-001
  status: OWNER_CONFIRMED_IN_CONVERSATION
  owner: COACH_HOJUNE
  recorded_at: 2026-07-14
  production_authority: false
  canonical_promotion_authority: false
```

Coach Hojune confirmed the product boundary below after reviewing the proposed
shadow-pilot sequence in PR #63.

| Decision | Confirmed boundary |
|---|---|
| Athlete awareness | Shadow operation is never hidden. The journal owner is told what is being compared, which data categories are used, that the generated candidate does not govern training, and how to stop participation. |
| Meaningful participation | The athlete surface should explain the purpose in plain language and show visible progress, milestones, and a comprehensible finish state. |
| Progress and delight | Check marks, frame milestones, stickers, or another small collection experience may support participation. They follow `JOURNAL_DELIGHT_AND_DECORATION_SPEC.md` and may reward safe recording consistency, never training load or silence about pain. |
| Analysis sequencing | Structured self-check data may be collected and displayed first while descriptive analysis continues to be developed. Analysis must remain non-causal and must not change a real plan until its separate acceptance and shadow evidence exist. |
| PR #63 status | The Formation/Adaptation blueprint is merged on `main` as a review draft; its owner-readable summary and cross-spec map remain required recovery artifacts. This is not canonical acceptance or implementation authority. |

This amendment does not yet accept exact pilot duration, incentive amounts,
catalog assets, statistical thresholds, adverse-event protocol, stop criteria,
production execution, or an automatic plan. A proposed three-frame sequence remains
part of the pilot protocol that must be accepted with those operational details.

[DECISION_RECORDED]
