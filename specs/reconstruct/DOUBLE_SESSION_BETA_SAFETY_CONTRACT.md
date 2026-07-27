# DOUBLE_SESSION_BETA_SAFETY_CONTRACT.md

```yaml
document_metadata:
  doc_id: trainoracle-spec-035-double-session-beta-safety
  spec_id: DOUBLE_SESSION_BETA_SAFETY_CONTRACT
  title: TrainOracle Double Session Beta Safety Contract
  version: "0.1"
  round: RT1_OWNER_APPROVED_LOCAL_BETA_BOUNDARY
  status: DRAFT_FOR_REVIEW
  owner: COACH_HOJUNE
  open_issues_total: 3
  canonical_blocking_count: 3
  executed_tests_total: 0
  executed_tests_passed: 0
  production_execution_allowed: false
  canonical_promotion_allowed: false
  self_check_is_runtime_evidence: false
  final_marker_required: "[DRAFT_COMPLETE]"
```

---

## 1. Purpose

This draft defines the narrow local-beta meaning of a user-selected second
session in a TrainOracle plan candidate. It makes an AM/PM display and local
progress record possible without treating that display as an accepted calendar
projection, a medical recovery decision, or an individualized numeric
prescription.

It applies only when the athlete explicitly selects
`RECOVERY_PM_ALLOWED`. The default is `SINGLE_SESSION_ONLY`.

## 2. Scope And Non-Purpose

This draft owns:

- local ordinal `DAY n` AM/PM session slots in the public RPE-and-duration beta
- explicit athlete choice between one session and optional PM recovery support
- same-day caps, session-shape constraints, local progress identity, and
  backwards-compatible local storage

This draft does not:

- resolve `DOUBLE` or `FLEX` in `MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md`
- map a local beta day to a civil date or a coach calendar
- create a second high-intensity session, a catch-up session, or an automatic
  adjustment after a missed session
- authorize a detailed template, a target pace, repetitions, distance, or
  recovery duration for an individual athlete
- reinterpret D9, RVE, Safety Gate, consent, or raw-note privacy rules
- close any upstream issue or promote a source to canonical status

## 3. Vocabulary And Storage Shape

```yaml
second_session_mode:
  SINGLE_SESSION_ONLY: "default; one AM session at most on each beta day"
  RECOVERY_PM_ALLOWED: "explicit athlete selection; permits constrained PM recovery support"

session_slot:
  AM: "primary beta-day session or complete rest"
  PM: "optional recovery support only"

local_progress_identity:
  key: "sessionDay + sessionSlot"
  examples: ["1:AM", "1:PM"]
```

Older stored beta plans without a slot or second-session mode must load as
`AM` and `SINGLE_SESSION_ONLY`. This migration must not synthesize a PM
session or infer athlete consent.

## 4. Generation Invariants

Every generated local-beta candidate must satisfy all of the following.

| ID | Invariant | Required behavior |
|---|---|---|
| `DSB-INV-001` | Explicit choice | A PM session is absent unless `RECOVERY_PM_ALLOWED` was selected. |
| `DSB-INV-002` | PM shape | PM is `EASY` plus `RECOVERY_INTENT`, with `RPE 1-2` only. It can be brisk walking, a very easy jog, easy cycling, or gentle uphill walking. |
| `DSB-INV-003` | No same-day quality pairing | A PM session cannot share its day with a `QUALITY` session. A beta day cannot contain two high-intensity sessions. |
| `DSB-INV-004` | Daily cap | A beta day has at most one AM and one PM session. Each `(day, slot)` pair is unique. |
| `DSB-INV-005` | Frame cap | The Balanced candidate may show at most one PM recovery session in a 7-day frame and at most two in a 9- or 10-day frame. The Conservative candidate shows none. |
| `DSB-INV-006` | Availability meaning | An available day includes recovery movement. `EVERY_DAY` does not create extra quality days; existing quality-day rules remain unchanged. |
| `DSB-INV-007` | No compensation | A skipped or incomplete AM/PM session is not moved, duplicated, or added to a later day. |
| `DSB-INV-008` | RPE-only boundary | PM output may show only duration range, RPE range, intent, and plain-language guidance. It must not show derived pace, repetitions, distance, or recovery intervals. |

The PM range is a local, experience-banded duration range only. It is not a
claim that a particular duration is medically restorative or appropriate for an
individual athlete.

## 5. Safety, Authority, And Privacy

```yaml
safety:
  D9_ACTIVE: "block plan generation"
  D9_UNKNOWN: "block plan generation or require human review"
  D9_CLEARED: "permits this beta flow only; is not medical clearance"
  good_physio_data_or_template: "cannot clear D9 risk"

selection_authority:
  self_service_beta: "allowed when policy permits"
  coach_required_configuration: "must remain fail-closed"
  coach_connection: "does not override a safety hard stop"

privacy:
  raw_free_text_in_plan_or_audit: forbidden
  raw_symptom_clause_in_plan_or_audit: forbidden
  structured_progress: [COMPLETED, RESTED, SKIPPED, PAIN_CHECKIN]
```

`PAIN_CHECKIN` is a structured progress record. It is not a clearance signal,
does not cause a PM session to appear, and does not alter later plan intensity.

## 6. Required Presentation

The candidate and active-plan screens must show `DAY n · 오전` or `DAY n · 오후`
beside every session. A PM session must be called an afternoon recovery session,
not a second workout to make up missed training. The RPE `?` explanation must
state both of these distinctions:

- `RPE 1-2`: recovery movement with comfortable breathing
- `RPE 3-4`: basic aerobic work where conversation or a phone call remains
  possible

## 7. Verification Vectors

Before this draft can support broader execution claims, the implementation must
retain these regression vectors:

| Vector | Expected result |
|---|---|
| single-session profile | no PM session is generated |
| explicit AM/PM profile, 9-day LT candidate | two distinct PM recovery sessions at most; no PM quality session |
| 7-day explicit AM/PM profile | at most one PM recovery session |
| every-day availability | quality-session count is unchanged by availability alone |
| persisted AM and PM progress | progress for `n:AM` and `n:PM` coexist and update independently |
| malformed stored PM beside quality | storage loader rejects the snapshot |
| older slot-less snapshot | loader reads every legacy session as AM and the mode as single-session |

Passing a local test does not create runtime evidence for an upstream contract,
canonical promotion, or issue closure.

## 8. Open Issues

| Issue ID | Status | Canonical blocker | Required evidence before closure |
|---|---|---:|---|
| `OI-DSB-CALENDAR-CROSSWALK-001` | OPEN | yes | Accepted mapping of local AM/PM beta slots to `DOUBLE`/`FLEX`, calendar identity, and projection fixtures. |
| `OI-DSB-SAFETY-HOLD-INTEGRATION-001` | OPEN | yes | Accepted hold and recheck behavior for a real dated double-session calendar flow. |
| `OI-DSB-TEMPLATE-ELIGIBILITY-001` | OPEN | yes | Accepted template, event, experience, youth-policy, source, and anchor bindings before any numeric PM prescription. |

## 9. Source Relationships

- `specs/reconstruct/TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md`
- `specs/reconstruct/MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md`
- `specs/active/PLAN_GENERATOR_SPEC.md`
- `reports/review/SPEC_TO_BETA_PERSONALIZATION_ALIGNMENT_AUDIT_2026-07-27.md`
- `PLAN_BETA_PRODUCT_DECISION_2026_07_24.md`

This document is a bounded beta implementation contract. It does not state that
the upstream documents are accepted, patched, or resolved.

[DRAFT_COMPLETE]
