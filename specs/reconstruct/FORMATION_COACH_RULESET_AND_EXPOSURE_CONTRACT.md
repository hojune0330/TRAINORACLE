# Formation Coach Ruleset And Exposure Contract

```yaml
spec_id: FORMATION_COACH_RULESET_AND_EXPOSURE_CONTRACT
version: 0.2
status: READINESS_ONLY_BLOCKED_ON_ORDER_011
coach_owner: COACH_HOJUNE
source_commit: 5c4673fc968d3e8b8ae22f50837eded7678594f0
runtime_authority: false
scientific_fact_authority: false
ruleset_accepted: false
```

## 1. Authority Boundary

This document makes fail-closed pilot mechanics reviewable. It does not accept the
ruleset, activate Formation, prescribe training, or claim that 9.5 days, two or three
MAIN exposures, or approximately 72 hours is scientifically optimal or safe.

## 2. Pilot Registry

```yaml
registry_id: hojune_9_5_pilot_v0_2
registry_status: DRAFT_BLOCKED
scope:
  event: 1500M
  athlete_count: 1
  linked_coach_required: true
frame:
  model: LOCAL_CIVIL_9_DAYS_12_HOURS
  accounting: NAMED_LINEAGE_FRAME
  timezone: IANA_TIMEZONE_REQUIRED
  timezone_database_version: REQUIRED
  start_boundary: INCLUSIVE
  end_boundary: EXCLUSIVE
  dst_fold_or_gap: EXPLICIT_RESOLUTION_REQUIRED
  superiority: UNKNOWN
main_exposures:
  planned_count: TWO_OR_THREE
  placement_target: APPROXIMATELY_THREE_LOCAL_CIVIL_DAYS_WHEN_FEASIBLE
  hard_minimum_elapsed_hours: null
  spacing_is_safety_clearance: false
  scientific_optimality: UNKNOWN
  previous_frame_exposure_context: DESCRIPTIVE_ONLY_NOT_CARRIED_INTO_COUNT
automatic_actions:
  catch_up: false
  compression: false
  progression: false
  taper: false
  recovery_selection: false
  safety_clearance: false
```

The frame contains planned exposures whose local start is greater than or equal to the
resolved start and strictly less than the resolved end. An exposure exactly at the end
belongs only to the contiguous successor. Planned and completed exposure views are
separate and are never added together.

## 3. Coach Exposure-Class Vocabulary

The vocabulary is coach bookkeeping, not a physiological diagnosis or evidence grade:

```yaml
main_exposure_classes:
  - AEROBIC_PRIORITY
  - THRESHOLD
  - VO2
  - GLYCOLYTIC
  - SPEED_POWER
  - STRENGTH_POWER
  - RACE
  - MIXED_REGISTERED
  - OTHER_COACH_REGISTERED
```

`RACE` may describe the planned exposure class only. A completed classifier label
remains `COMPETITION`. `OTHER_COACH_REGISTERED` requires a stable registered code,
version, coach owner, and component definition. A priority class never removes the
ordered components of a composite session.

## 4. Required Session Facts And Canonical Roles

Every planned exposure retains session ID, frame ID, plan version, local-civil time,
role, competition flag, exposure class, ordered components, typed duration/distance/
load facts, provenance, freshness, and coach intent.

The only planning roles are `MAIN | SUPPORT | RECOVERY | REST`, matching
`TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md`. Classifier labels remain the
`SESSION_CLASSIFIER_SPEC.md` vocabulary:
`MAIN | SUB | RECOVERY | LD | REST | CROSS_TRAINING | COMPETITION | TEST`.

- A composite parent and its leaves are never counted together.
- Whole-session RPE is not split across components.
- `RECOVERY` and `REST` are plan roles, not proof of physiological recovery.
- Plyometric, strength, hill, HIIT, and alternative aerobic remain visible components,
  not mutually exclusive day colors or interchangeable fatigue units.
- Missing unit, provenance, freshness, or component allocation returns
  `NEEDS_COACH_CLARIFICATION`; it never becomes permission.

## 5. Race, Taper, Recovery, Progression, And Re-anchor

| Situation | Exact v0.2 behavior |
|---|---|
| Race anchor | Place the immutable competition anchor before flexible sessions. A collision returns `NEEDS_COACH_CLARIFICATION`. |
| Taper | No automatic transform. `COMPETITION_PREP` is unavailable unless a versioned coach template supplies exact before/after components, measures, and slots. |
| Recovery | No RPE, statistic, memo, or elapsed-time rule selects recovery. A coach-requested registered transform may be reviewed; otherwise no candidate is emitted. |
| Progression | No automatic increase. A new coach-authored version must state every changed measure and rationale. |
| Missed MAIN | Preserve the planned fact, record zero completed exposure, create no debt, catch-up, compression, or automatic future candidate. |
| Reschedule | Requires a new coach-reviewed class, load, slot, spacing review, safety state, and plan version. |
| Re-anchor | Requires explicit local-civil boundary resolution and disposition of every displaced session as `RETAIN_PREDECESSOR`, `MOVE_TO_SUCCESSOR`, `CANCEL_BY_COACH`, or `NEEDS_COACH_CLARIFICATION`. |
| Carry-over | No planned or missed MAIN is automatically carried into the successor count. Completed predecessor exposures may be shown as descriptive spacing context only. |
| Unknown exception | Fail closed with `NEEDS_COACH_CLARIFICATION`; no default transform or silent fallback. |

## 6. Non-Overridable Precedence

1. active safety hold, authorization/scope failure, consent or privacy failure;
2. provenance, governance, unit, freshness, and required-source validity;
3. immutable competition anchor and accepted plan/frame/version lineage;
4. invariant MAIN count, one-exposure dedupe, named-frame boundary, and no-catch-up;
5. scoped current coach choice that does not conflict with levels 1-4;
6. versioned taper, recovery, support, or progression transform;
7. presentation preference.

Higher priority cannot be overridden by lower priority. Equal-priority conflict,
missing precedence, or ambiguous exception returns `NEEDS_COACH_CLARIFICATION`. Coach
action cannot infer private-note meaning, clear a safety state, treat missing as
permission, rewrite history, or waive levels 1-4.

## 7. Exposure Adapter And Ledger

```yaml
ExposureLedgerItem:
  immutableSessionId: required
  frameId: required
  planVersionId: required
  view: PLANNED | COMPLETED
  originalClassifierLabel: MAIN | SUB | RECOVERY | LD | REST | CROSS_TRAINING | COMPETITION | TEST | null
  exposureKind: TRAINING_MAIN | COMPETITION | NONE
  acceptedMainExposureClass: registered_class_or_null
  exposureContribution: ZERO | ONE
  sourceRecordIds: required
  sourceContentHashes: required
  countedAtMostOncePerView: true
```

Adapter rules:

- planned role `MAIN` contributes one to the planned view;
- completed classifier `MAIN` contributes one `TRAINING_MAIN` exposure;
- completed classifier `COMPETITION` remains `COMPETITION` and contributes one
  `COMPETITION` exposure;
- every other completed classifier label contributes zero and cannot be promoted;
- one composite session contributes at most one per view regardless of component count;
- duplicate session/source identity or conflicting adapter result is rejected;
- planned and completed views are reported separately and never summed;
- predecessor and successor named-frame counts are separate; the end-exclusive rule
  prevents double carry-over.

## 8. Private-Note Zero-Signal

`PRIVATE_SELF_ONLY` content, existence, length, timestamp, hash, source reference,
reason code, audit correlation, and telemetry are absent from registry input and
output. Two otherwise identical inputs that differ only in private-note state must
produce byte-identical results. Raw analyzable-note text is also forbidden. A future
opaque note-derived safety block may only block and cannot clear or explain a plan.

## 9. Open Gates

- `CODEX_WORK_ORDER_011`: named qualified privacy acceptance remains absent.
- `OI-FA-UPSTREAM-SAFETY-PRIVACY-BINDING-001`: current note-derived `CLEARED`
  behavior conflicts with the proposed Formation boundary.
- `OI-FA-RULE-CLASSIFIER-EXPOSURE-BINDING-001`: Rule D1/D2 do not yet consume the
  normalized competition exposure adapter.
- `OI-FA-PLAN-VERSION-BINDING-001`: lifecycle/CAS/runtime binding is unaccepted.
- `OI-FA-CALENDAR-SCHEMA-BINDING-001`: Calendar identity belongs to Order 013.
- `OI-FA-RUNTIME-EVIDENCE-001`: no runtime or CI evidence exists.
- Coach-owner deterministic walkthrough and explicit acceptance remain absent.

[DRAFT_COMPLETE]
