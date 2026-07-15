# Formation Product Projection And Explanation Contract

```yaml
spec_id: FORMATION_PRODUCT_PROJECTION_AND_EXPLANATION_CONTRACT
version: 0.1
status: READINESS_DRAFT_BLOCKED_ON_011_014_AND_FEEDBACK
runtime_authority: false
rendered_evidence: absent
```

## Required Header

Every surface states both its fact/authority class and current action:

- `내 기록`, `기록 분석`, `비교용 초안`, `사람 검토`, or `코치 확정 계획`.
- `보기만 가능`, `일시정지·나가기`, `공유 선택`, or `코치 검토 대기`.

This information is visible text, not a tooltip or color-only cue. `AI coach`,
`recommended workout`, `ready`, `recovered`, and medical authority copy are forbidden.

## Audiences

```yaml
audience:
  ATHLETE: own_scope_plain_projection
  LINKED_COACH: governance_eligible_structured_projection
  GUARDIAN_SCOPE_ALLOWED: separately_granted_policy_approved_summary
  JOURNAL_ONLY: no_formation_projection

authority_class:
  JOURNAL_FACT: athlete_recorded_or_source_bound_fact
  DESCRIPTIVE_ANALYSIS: noncausal_description_only
  SHADOW_CANDIDATE: comparison_only_never_executing
  HUMAN_REVIEW: review_state_never_silent_mutation
  ACCEPTED_REAL_PLAN: linked_coach_accepted_plan_fact

action_state:
  VIEW_ONLY: no_mutation
  CORRECT_OWN_JOURNAL_FACT: correct_source_fact_or_request_correction_only
  PAUSE_OR_WITHDRAW_SHADOW: athlete_optional_participation_control
  CHOOSE_POLICY_ALLOWED_SHARE: explicit_recipient_and_scope_required
  LINKED_COACH_REVIEW_ONLY: review_record_or_correction_proposal_only
  GUARDIAN_VIEW_WITHIN_SCOPE: no_default_notification_or_edit
  NO_FORMATION_ACTION: formation_unavailable
```

| Audience | Allowed authority classes | Allowed action states | Forbidden implication |
|---|---|---|---|
| `ATHLETE` | all five, subject to privacy | `VIEW_ONLY`, `CORRECT_OWN_JOURNAL_FACT`, `PAUSE_OR_WITHDRAW_SHADOW`, `CHOOSE_POLICY_ALLOWED_SHARE` | Athlete correction never edits a shadow candidate or accepted real plan. |
| `LINKED_COACH` | all five, governance-eligible fields only | `VIEW_ONLY`, `LINKED_COACH_REVIEW_ONLY` | A review or correction proposal is not a silent plan edit or acceptance. |
| `GUARDIAN_SCOPE_ALLOWED` | only separately authorized classes/fields | `GUARDIAN_VIEW_WITHIN_SCOPE` | No inferred access, default notification, private note, or edit right. |
| `JOURNAL_ONLY` | `JOURNAL_FACT` outside Formation only | `NO_FORMATION_ACTION` | No shadow, analysis, review, or plan surface. |

An invalid audience/authority/action combination is rejected rather than hidden or
downgraded. Athlete correction means editing an eligible own journal fact or submitting a
correction request. It never mutates a source snapshot, candidate, review, or real plan.

## Five Explanation Levels

1. `쉽게`: one short age-appropriate meaning and action.
2. `짧게`: compact facts with units and limitation.
3. `균형`: observations, components, missing facts, and status.
4. `자세히`: component time/distance/source/method and uncertainty.
5. `정확히`: units, provenance, formula/rule version, sample, freshness, and contract code.

Changing level changes words/detail only. Fact IDs, values, results, authority, missing/
stale state, uncertainty, privacy masking, action rights, and real-plan hash remain
identical.

### Immutable five-level fixture

All five projections below bind `factBundleId: FB-COMPOSITE-001` and the same canonical
64-character lowercase SHA-256 fact, result, and real-plan hashes. The preimages use the
Order 013 NFC + RFC 8785 contract. They also bind the same authority, action, privacy,
structured source watermark, freshness, missingness, uncertainty, and horizon.

```yaml
fact_bundle:
  authority: DESCRIPTIVE_ANALYSIS
  action: VIEW_ONLY
  canonicalFactPreimageUtf8: '{"components":[{"durationMin":40,"id":"C-RUN","order":1,"type":"RUNNING"},{"durationMin":15,"id":"C-PLYO","order":2,"type":"PLYOMETRIC"},{"durationMin":25,"id":"C-STRENGTH","order":3,"type":"STRENGTH"}],"horizon":"completed_session_2026_07_16","parentSessionId":"S-001","wholeSessionRpe":7}'
  canonicalFactHash: 09851c68a7935f81919db853bc280887001640d405e6f72cffc9a20142ec0f4c
  canonicalResultPreimageUtf8: '{"action":"VIEW_ONLY","authority":"DESCRIPTIVE_ANALYSIS","readinessOrRecovery":"UNKNOWN","uncertainty":"recovery_not_inferred"}'
  canonicalResultHash: b788dd917b9dc33fd2d32644d66994563d84b42acc2a7a1bf3735eb3b478aa25
  horizon: completed_session_2026_07_16
  parentSessionId: S-001
  components:
    - { order: 1, id: C-RUN, type: RUNNING, durationMin: 40 }
    - { order: 2, id: C-PLYO, type: PLYOMETRIC, durationMin: 15 }
    - { order: 3, id: C-STRENGTH, type: STRENGTH, durationMin: 25 }
  wholeSessionRpe: 7
  readinessOrRecovery: UNKNOWN
  sourceWatermark:
    streamId: DLC-v1
    eventSequence: 1
    aggregateRevision: 1
    observedAt: "2026-07-16T00:00:00Z"
  freshness: CURRENT_FOR_COMPLETED_SESSION
  missingness: none_for_displayed_facts
  uncertainty: recovery_not_inferred
  privacyPolicy: ATHLETE_VISIBLE_PUBLIC_SAFE
  humanAction: none
  realPlanPreimageUtf8: '{"planVersionId":"plan-v3","plannedSessionId":"S-001","status":"UNCHANGED"}'
  realPlanHash: 7d414eef0b7febf3344e29c6994e269194191b4496d8e42b9e9d954e065df90b
```

| Level | Required projection of the same bundle |
|---:|---|
| 1 `쉽게` | `달리기, 점프, 웨이트를 함께 했어요. 전체 느낌은 꽤 힘들었다고 적었어요. 이 기록만으로 회복됐는지는 알 수 없어요.` |
| 2 `짧게` | `복합훈련 80분 · 달리기/플라이오/웨이트 · 전체 RPE 7/10 · 회복 여부 알 수 없음` |
| 3 `균형` | Show the three ordered observations, whole-session RPE, observation horizon, and unknown recovery state. |
| 4 `자세히` | Add component IDs, durations, source, freshness, missingness, and uncertainty without changing facts. |
| 5 `정확히` | Add provenance, units, accepted formula/rule versions when any, canonical hash, privacy policy, and contract codes. |

Levels 1-2 may reduce vocabulary and visible detail, but may not omit simulation/authority,
unknown or stale meaning, privacy restriction, required human action, or withdrawal when
those facts apply. Level switching grants no consent and causes no decision or data change.

## Load And Composite Sessions

No readiness or fatigue scalar is allowed. Present separate groups: work performed;
athlete-reported response; compatible measured response; and data quality/source state.
Use `몸 상태와 훈련 기록`, not a diagnostic readiness label.

A composite stays one session with all material running, plyometric, strength, hill,
or other components. Whole-session RPE remains whole-session. Missing is not zero or
normal. `MIXED` cannot replace component detail.

This projection binds the accounting rules in
`FORMATION_LOAD_AND_STATISTICAL_RULES_CONTRACT.md` Order 010. It preserves one
`parentSessionId`, ordered typed component IDs, source record references, and overlap
state. The parent and its leaves are never aggregated together. Whole-session RPE, TRIMP,
or another whole-session measure is never split or inferred into component shares.
Unknown component time, distance, intensity, or contribution stays unknown. A visual area
or segment must not imply a proportion when the underlying share is not observed.

## Visual Semantics

Status uses text + icon + shape/pattern + optional color. Color never carries sole
meaning. Red is reserved for error/stop, and green cannot mean safe/recovered/cleared.
Final component colors require owner and contrast review.

Shadow progress includes count, date, and `실행 안 됨`; it is not a success rate or
training completion. Journal checks/stickers may acknowledge rest and injury reporting
equally. Consent, continued enrollment, load, speed, pain silence, or obedience are never
rewarded. Withdrawal alone causes no penalty or earned-item clawback. A separate accepted
retention/deletion request may remove linked records or items according to policy.

## Note-Origin Privacy Boundary

`PRIVATE_SELF_ONLY` content, presence, absence, length, timestamp, hash, source
reference, reason, provenance, audit correlation, and telemetry are absent from every
Formation projection input and output. They are also absent from cache, audit,
accessibility announcements, review packets, and error shapes. Otherwise identical
absent, text-A, text-B, and metadata-only private-note variants must produce
byte-identical results.

Raw `ANALYZABLE_TRAINING_NOTE` text, excerpts, summaries, translations, tokens, hashes,
embeddings, and human-readable note-derived reasons are forbidden in Formation
projection, review, provenance, audit, and telemetry. A note-derived `D9_CLEARED` or
`D9_CLEARED_WITH_ADVISORY` result emits no downstream result, projection, source marker,
presence signal, or plan permission.

Only after the governing safety/privacy contracts are accepted may a target-bound
note-derived `BLOCKED` or `D9_UNKNOWN` envelope enter Formation. It is represented only
as the generic opaque state `SAFETY_REVIEW_REQUIRED`; it contains no note source,
timestamp, reason, category detail, or note-derived provenance. It may block or request
review, but cannot clear, explain, select, or mutate a plan. A missing, stale, revoked,
wrong-scope, wrong-target, or over-detailed envelope is rejected and produces no
candidate.

## Required Metadata And Copy

Every eligible non-note-origin projection binds audience, authority, action state,
source, freshness, missingness, uncertainty, horizon, privacy policy, human action,
correction path, and immutable source watermark. For an accepted opaque note-derived
block/review envelope, the generic target-bound envelope reference replaces source and
provenance detail and must not reveal note origin. Stale/unknown data produces plain typed
absence. No projection mutates a plan.

## Accessibility

Require keyboard operation, visible focus, logical order, screen-reader names/states,
200% zoom/reflow, tested contrast, non-color equivalence, reduced motion, 320/375 px and
desktop layouts, 44x44 targets for non-inline custom controls, and no clipping/overlap. Motion is rare,
functional, interruptible, <=150 ms for small feedback, and removed/reduced under
`prefers-reduced-motion`. No pulsing, confetti, or coercive animation.

WCAG 2.2 AA is the minimum review baseline: normal text contrast is at least `4.5:1`,
large text at least `3:1`, and meaningful controls/graphics at least `3:1`. The product
retains the existing 44x44 CSS-pixel target requirement for non-inline custom controls even though WCAG 2.2 AA permits
24x24 with defined exceptions. Focus is visible, logically ordered, and not obscured.
Dynamic progress/status changes are programmatically announced without moving focus.
Screen-reader output preserves the same authority, state, facts, uncertainty, and action
meaning as the visual projection.

[DRAFT_COMPLETE]
