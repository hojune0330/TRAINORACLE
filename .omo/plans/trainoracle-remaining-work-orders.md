# TRAINORACLE Remaining Work Orders Master Plan

## TL;DR

This plan converts every remaining item reported after PR #75 into seven formal,
dependency-ordered work orders. Fifteen source items have exactly one primary owner.
Orders 010-015 produce research, decisions, contracts, and review evidence only.
Order 016 is the only runtime order, and it stays blocked until all six prior orders
have immutable acceptance records.

## 사장님용 한눈 요약

| 순서 | 무엇을 결정하는가 | 지금 실행 가능한가 |
|---:|---|---|
| 010 | 논문·반대근거, 피로/부하 통계, 경기 분석, 퀵로그 프리셋 | 연구 범위 승인 후 가능 |
| 011 | 메모 안전 신호, 선수·보호자 개인정보, 보존·삭제 | 결정문 작성 가능, 전문 검토 전 구현 금지 |
| 012 | 9.5일·MAIN·대회·테이퍼·예외 코치 규칙 | 010·011 승인 후 가능 |
| 013 | 달력·버전·여러 탭/기기 동기화·충돌 처리 | 011·012 승인 후 가능 |
| 014 | 선수가 아는 그림자 모드, 중단 기준, 사람 검토·공유 | 012·013 승인 후 가능 |
| 015 | 쉬움 1단계~정확함 5단계 설명, 색/복합훈련, 접근성 | 011·014 승인 후 가능 |
| 016 | 앞선 결정을 실제 비실행 그림자 기능으로 연결 | 010~015 전부 승인 전 시작 금지 |

핵심은 010부터 차례대로 승인 근거를 만드는 것입니다. 016이 끝나도 시스템이
선수의 실제 훈련계획을 자동으로 바꾸지는 않습니다. 실제 파일럿 시작은 별도
사장님 승인입니다.

## Current Baseline

- Repository baseline: `origin/main` after PR #75.
- GitHub open issues: 0.
- GitHub open pull requests: 0.
- Task-R audit: DONE 28 / OPEN 1 / DEFERRED 5.
- Formation deferred register: 8 goals.
- Additional deferred item: `CODEX_WORK_ORDER_008` Task C preset research.
- Current Formation runtime authority: none.

## Source Inventory

| Primary source item | Primary owner order |
|---|---|
| `R-safety-001` | `CODEX_WORK_ORDER_011` |
| `R-parent-001` | `CODEX_WORK_ORDER_011` |
| `R-parent-004` | `CODEX_WORK_ORDER_014` |
| `R-coach-003` | `CODEX_WORK_ORDER_012` |
| `R-frontend-003` | `CODEX_WORK_ORDER_013` |
| `R-a11y-005` | `CODEX_WORK_ORDER_015` |
| Formation: Sports-science evidence and counterevidence review | `CODEX_WORK_ORDER_010` |
| Formation: Load, component, and statistical rules | `CODEX_WORK_ORDER_010` |
| Formation: Coach rules for frame, MAIN, race, taper, and exceptions | `CODEX_WORK_ORDER_012` |
| Formation: Athlete-visible shadow protocol | `CODEX_WORK_ORDER_014` |
| Formation: Privacy, youth, retention, deletion, and governance | `CODEX_WORK_ORDER_011` |
| Formation: Product projection and explanations | `CODEX_WORK_ORDER_015` |
| Formation: Calendar/version binding and backend fixtures | `CODEX_WORK_ORDER_013` |
| Formation: Race descriptive analysis | `CODEX_WORK_ORDER_010` |
| `CODEX_WORK_ORDER_008` Task C | `CODEX_WORK_ORDER_010` |

## Formation Blocker Mapping

| Existing Formation issue | Decision owner order | Runtime evidence order |
|---|---|---|
| `OI-FA-COACH-RULESET-001` | `CODEX_WORK_ORDER_012` | `CODEX_WORK_ORDER_016` |
| `OI-FA-LOAD-COMPONENT-001` | `CODEX_WORK_ORDER_010` | `CODEX_WORK_ORDER_016` |
| `OI-FA-MINIMUM-EVIDENCE-001` | `CODEX_WORK_ORDER_010` | `CODEX_WORK_ORDER_016` |
| `OI-FA-PLAN-VERSION-BINDING-001` | `CODEX_WORK_ORDER_013` | `CODEX_WORK_ORDER_016` |
| `OI-FA-PILOT-PROTOCOL-001` | `CODEX_WORK_ORDER_014` | `CODEX_WORK_ORDER_016` |
| `OI-FA-CALENDAR-SCHEMA-BINDING-001` | `CODEX_WORK_ORDER_013` | `CODEX_WORK_ORDER_016` |
| `OI-FA-UPSTREAM-SAFETY-PRIVACY-BINDING-001` | `CODEX_WORK_ORDER_011` | `CODEX_WORK_ORDER_016` |
| `OI-FA-RULE-CLASSIFIER-EXPOSURE-BINDING-001` | `CODEX_WORK_ORDER_012` | `CODEX_WORK_ORDER_016` |
| `OI-FA-PRODUCT-PROJECTION-001` | `CODEX_WORK_ORDER_015` | `CODEX_WORK_ORDER_016` |
| `OI-FA-RECORD-GOVERNANCE-001` | `CODEX_WORK_ORDER_011` | `CODEX_WORK_ORDER_016` |
| `OI-FA-RUNTIME-EVIDENCE-001` | none; dependency-derived | `CODEX_WORK_ORDER_016` |

The mapping assigns decision ownership only. Existing issue status remains OPEN until
its owning target is patched, recounted, accepted, and evidenced independently.

## Acceptance Definition

An order is `ACCEPTED` only when all of the following exist:

1. Every named output is committed and linked from an acceptance record.
2. Automated contract tests have captured RED before the change and GREEN after it.
3. Each acceptance criterion has a real-surface QA artifact with a binary result.
4. Unresolved P1 blockers owned by that order are zero, or explicitly rejected with
   the prohibited behavior still fail-closed.
5. The acceptance record names the actual approver, review role, timestamp, source
   commit SHA, evidence paths, and remaining risks.
6. Passing one order does not silently accept or activate another order.

Required approval roles must map to real people at execution time:

- `TOTAL_RESPONSIBILITY_HOLDER`: product and final scope decision.
- `COACH_OWNER`: versioned training-rule decision; may be the same named person.
- `FABLE_INDEPENDENT_REVIEW`: independent repository/product review.
- `QUALIFIED_PRIVACY_REVIEWER`: external qualified review for youth/privacy policy.
- `ATHLETE_REVIEW_PARTICIPANT`: informed feedback for shadow/projection work.

## Global Invariants

- `PRIVATE_SELF_ONLY` notes are zero-signal: never feature, analyze, project, log,
  sync, persist to plan/audit records, or enter model context.
- Analyzable training notes never authorize a plan and never persist raw note text
  into safety, plan, audit, telemetry, or reason-code records.
- No note-derived path may silently convert uncertainty into clearance.
- No hidden shadow operation. Participation is separate, visible, withdrawable, and
  non-executing until a later explicit runtime gate.
- No autonomous medical, injury-risk, readiness, fatigue, percentile, threshold, or
  training prescription claim before its accepted source contract.
- Competition remains `COMPETITION`; an accepted exposure adapter may count it once
  without rewriting the classifier label.
- Missed MAIN work is never automatically caught up or compressed.
- Rest, pain, injury, refusal, withdrawal, or unfavorable reporting cannot reduce a
  reward or break a journal consistency acknowledgment.
- AthleteTime identity never receives TrainOracle journal, memo, pain, safety, or
  coaching authority through these orders.

## Wave Order

| Wave | Work order | Execution state | Depends on |
|---:|---|---|---|
| 1 | `CODEX_WORK_ORDER_010` Research Foundation | `READY_FOR_HIGH_ACCURACY_RESEARCH` | none |
| 2 | `CODEX_WORK_ORDER_011` Safety, Privacy, Youth Governance | `READY_FOR_DECISION_PACKET` | 010 research may use public/synthetic data before 011; real athlete data may not |
| 3 | `CODEX_WORK_ORDER_012` Coach Rules and Exposure | `BLOCKED_UNTIL_010_011_ACCEPTED` | 010, 011 |
| 4 | `CODEX_WORK_ORDER_013` Calendar, Version, and Sync | `BLOCKED_UNTIL_011_012_ACCEPTED` | 011, 012 |
| 5 | `CODEX_WORK_ORDER_014` Human Review and Shadow Protocol | `BLOCKED_UNTIL_012_013_ACCEPTED` | 012, 013 |
| 6 | `CODEX_WORK_ORDER_015` Projection and Accessibility | `BLOCKED_UNTIL_011_014_ACCEPTED` | 011, 014 |
| 7 | `CODEX_WORK_ORDER_016` Gated Runtime Integration | `DORMANT` | accepted 010-015 records |

## TODOs

- [x] 1. Execute and accept `CODEX_WORK_ORDER_010` research foundation.
- [ ] 2. Execute and accept `CODEX_WORK_ORDER_011` safety, privacy, and youth governance packet.
- [ ] 3. Execute and accept `CODEX_WORK_ORDER_012` coach rules and exposure authority.
- [ ] 4. Execute and accept `CODEX_WORK_ORDER_013` calendar, version, and local-first sync contract.
- [ ] 5. Execute and accept `CODEX_WORK_ORDER_014` human review and athlete-visible shadow protocol.
- [ ] 6. Execute and accept `CODEX_WORK_ORDER_015` product projection and accessibility contract.
- [ ] 7. Evaluate the entry gate and execute only the authorized scope of `CODEX_WORK_ORDER_016` runtime integration.
- [ ] 8. Complete final cross-order verification, evidence reconciliation, and cleanup.

## Formal Work Orders

### CODEX_WORK_ORDER_010 — Research Foundation

```yaml
order_id: CODEX_WORK_ORDER_010
execution_state: ACCEPTED_RESEARCH_BOUNDARY_ONLY
runtime_authority: false
primary_items:
  - formation_sports_science_evidence_and_counterevidence
  - formation_load_component_and_statistical_rules
  - formation_race_descriptive_analysis
  - CODEX_WORK_ORDER_008_TASK_C
depends_on: []
entry_gate:
  - TOTAL_RESPONSIBILITY_HOLDER records populations, questions, and allowed claims
  - research uses public, synthetic, or fully de-identified data only
forbidden_before_gate:
  - no athlete-level data collection or reuse
  - no numeric prescription, diagnosis, injury-risk, readiness, or safety claim
  - no app, Formation, Plan Generator, or preset SPEC modification
exit_evidence:
  - primary-source research packet and counterevidence matrix
  - reproducible calculation fixtures
  - owner research-acceptance record
```

**Objective:** establish what can be described, calculated, or proposed before any
coach rule or athlete-facing Formation behavior is designed.

**Required outputs**

- `reports/research/FORMATION_SPORTS_SCIENCE_EVIDENCE_REVIEW.md`
- `specs/reconstruct/FORMATION_LOAD_AND_STATISTICAL_RULES_CONTRACT.md`
- `reports/research/RACE_DESCRIPTIVE_ANALYSIS_REVIEW.md`
- `reports/review/QUICK_LOG_PRESET_RESEARCH.md`
- `FORMATION_RESEARCH_ACCEPTANCE_DECISION.md`

**Tasks**

1. Freeze research questions: 9.5-day framing, MAIN exposure spacing, 72-hour
   recovery as a coach-experience hypothesis, insertion of moderate/moderately-high
   plyometric, weight, hill, HIIT, neural-fatigue-resistance, and alternative aerobic
   blocks, and applicability to adolescent/young-adult middle-distance runners.
2. Use a declared source hierarchy: primary empirical studies first; consensus and
   systematic reviews for context; coaching columns only as practice context. Record
   counterevidence, population mismatch, study limitations, and confidence for every
   conclusion. No source count may be presented as proof by itself.
3. Define typed units and data boundaries for session components, whole-session
   intensity, allocation, composite-session deduplication, missingness, staleness,
   sample size, suppression, uncertainty, and comparison windows. Unaccepted values
   remain `UNKNOWN`; they never receive a convenient default.
4. Define race analysis as descriptive only: owner-approved event scope, sample
   policy, missingness, uncertainty, within-athlete comparison limits, and explicit
   prohibition on causal, medical, or plan-changing interpretation.
5. Complete ORDER_008 Task C as report-only research. Review the current distance,
   time, sleep, and stepper presets by population and input ergonomics. Output only
   `maintain`, `adjust_proposal`, or `unknown`; do not modify the quick-log SPEC.
6. Provide reproducible fixtures for every proposed calculation, including empty,
   stale, malformed, mixed-unit, low-sample, composite, and conflicting-source cases.

**Acceptance tests and real QA**

- Automated `WO010-T01`: fail when a claim lacks source type, population,
  applicability, counterevidence, uncertainty, or confidence; pass only when complete.
- Automated `WO010-T02`: fail on mixed units, duplicate composite allocation, stale
  facts, or low-sample statistics that produce a number instead of typed absence.
- Automated `WO010-T03`: fail if race analysis or a preset report contains causal,
  diagnostic, safety, or automatic-plan authority.
- Manual QA channel: CLI/data. Run the published calculation fixtures with exact
  inputs and compare normalized outputs; PASS requires deterministic results and
  `UNKNOWN`/suppression on every prohibited case.

### CODEX_WORK_ORDER_011 — Safety, Privacy, and Youth Governance

```yaml
order_id: CODEX_WORK_ORDER_011
execution_state: READY_FOR_DECISION_PACKET
runtime_authority: false
primary_items:
  - R-safety-001
  - R-parent-001
  - formation_privacy_youth_retention_deletion_and_governance
depends_on:
  - CODEX_WORK_ORDER_010 for data categories and derived-output inventory
entry_gate:
  - current memo-purpose and export decisions are preserved
  - QUALIFIED_PRIVACY_REVIEWER is a named real reviewer before policy acceptance
forbidden_before_gate:
  - no account-linked sensitive storage or raw memo server transfer
  - no persisted note-derived clearance or human-readable sensitive reason
  - no youth/guardian production flow
exit_evidence:
  - target-bound safety/privacy contract
  - qualified governance review
  - owner acceptance with enforcement-test plan
```

**Objective:** close the contract gap behind `R-safety-001`,
`OI-FA-UPSTREAM-SAFETY-PRIVACY-BINDING-001`, and
`OI-FA-RECORD-GOVERNANCE-001` without leaking note meaning or inventing legal policy.

**Required outputs**

- `specs/reconstruct/NOTE_SAFETY_SIGNAL_AND_REVIEW_STATE_CONTRACT.md`
- `specs/reconstruct/FORMATION_RECORD_GOVERNANCE_CONTRACT.md`
- `reports/review/PRIVACY_YOUTH_QUALIFIED_REVIEW_PACKET.md`
- `FORMATION_PRIVACY_GOVERNANCE_DECISION.md`

**Tasks**

1. Create a purpose-to-consumer matrix. `PRIVATE_SELF_ONLY` is zero-signal across
   features, analytics, model context, safety, plan, logs, telemetry, sync, and audit.
   Analyzable training notes may be transiently reviewed only for the user-approved
   purpose and remain non-plan input.
2. Specify the smallest persistable non-sensitive review envelope: opaque target-bound
   reference, version, state, freshness/expiry, and non-reversible reason category.
   Raw text, excerpts, embeddings, private-note presence, and reconstructable details
   are forbidden. The packet must explicitly resolve the current note-derived
   `CLEARED` conflict or keep Formation blocked.
3. Define fail-closed behavior for absent, stale, expired, mismatched-target,
   mismatched-version, evaluator-failure, or revoked data. No new fourth D9 disposition
   may be invented.
4. Define governance envelopes for source, safety, plan, hold, adaptation, and audit
   records: role-based access, minimization, retention periods, export, deletion,
   revocation, key erasure, legal-hold conflict, auditability, and breach response.
5. Define youth handling for age collection, guardian consent, athlete assent,
   refusal, age transition, guardian-role change, access boundaries, deletion, and
   account unlinking. A qualified reviewer must mark each clause accepted, revised,
   out-of-scope, or unresolved.
6. Define correction and appeal paths, false-positive review, emergency copy, and
   what neither parent nor coach may override. All flags remain non-diagnostic.

**Acceptance tests and real QA**

- Automated `WO011-T01`: data-flow fixtures prove private notes create no observable
  difference outside the private local view.
- Automated `WO011-T02`: opaque-review fixtures reject raw text, identifiers,
  reconstructable reason strings, stale refs, wrong targets, and wrong versions.
- Automated `WO011-T03`: governance matrix rejects undefined role, retention,
  revocation, deletion, age-transition, or breach behavior.
- Manual QA channel: CLI/data. Run a canary-string scan across every proposed output;
  PASS requires zero private/raw note canaries and a fail-closed state for all malformed
  envelopes.

### CODEX_WORK_ORDER_012 — Coach Rules and Exposure Authority

```yaml
order_id: CODEX_WORK_ORDER_012
execution_state: BLOCKED_UNTIL_010_011_ACCEPTED
runtime_authority: false
primary_items:
  - R-coach-003
  - formation_coach_rules_frame_MAIN_race_taper_and_exceptions
depends_on:
  - CODEX_WORK_ORDER_010
  - CODEX_WORK_ORDER_011
entry_gate:
  - accepted evidence/statistical envelope
  - accepted safety/privacy envelope
  - COACH_OWNER named in the decision record
forbidden_before_gate:
  - no generated or auto-finalized plan candidate
  - no automatic catch-up, compression, taper, or progression
  - no inference from private-note content
exit_evidence:
  - versioned coach registry
  - conflict and failure-state fixtures
  - coach-owner acceptance record
```

**Objective:** turn coach experience into an explicit, versioned, testable pilot rule
registry while keeping it distinct from scientific fact and runtime authority.

**Required outputs**

- `specs/reconstruct/FORMATION_COACH_RULESET_AND_EXPOSURE_CONTRACT.md`
- `reports/review/COACH_TEAM_AND_MICROCYCLE_VIEW_DECISION.md`
- `specs/test-packages/FORMATION_COACH_RULESET_FIXTURES.md`
- `FORMATION_COACH_RULESET_ACCEPTANCE_DECISION.md`

**Tasks**

1. Version the 9.5-day pilot registry: MAIN exposure count, placement, spacing,
   frame semantics, re-anchor behavior, progression, race, taper, recovery, missed
   MAIN handling, carry-over, exceptions, and precedence. Label owner experience and
   research support separately.
2. Preserve no-catch-up and cross-boundary accounting. Competition remains
   `COMPETITION` and may count exactly once through a normalized exposure ledger;
   Session Classifier labels are not rewritten.
3. Define component roles and composite-session accounting using Order 010's accepted
   units. Conflicts, unknown data, and double counting must reject or route to coach
   review rather than choose silently.
4. Decide the coach-facing window: calendar week is presentation only unless the
   coach accepts a team/microcycle interpretation. Define who can view which athlete,
   what version is shown, and how corrections are audited.
5. Define precedence and non-overridable boundaries. Coach choices cannot infer
   private-note meaning, clear safety gates, or turn missing evidence into permission.
6. Walk through normal, race-anchor, missed-MAIN, pain/review, stale-data, composite,
   exception, and boundary-crossing cases before acceptance.

**Acceptance tests and real QA**

- Automated `WO012-T01`: registry parser rejects incomplete versions, ambiguous
  precedence, missing units, duplicate exposure, and silent fallback.
- Automated `WO012-T02`: competition remains classified as competition while the
  accepted adapter counts one exposure; missed MAIN produces no catch-up candidate.
- Automated `WO012-T03`: private-note and unresolved-safety fixtures cannot change a
  rule result or reveal note presence.
- Manual QA channel: CLI/data. Execute every fixture as a deterministic walkthrough;
  PASS requires the coach-owner's expected state and explicit human-review outcomes.

### CODEX_WORK_ORDER_013 — Calendar, Version, and Local-First Sync

```yaml
order_id: CODEX_WORK_ORDER_013
execution_state: BLOCKED_UNTIL_011_012_ACCEPTED
runtime_authority: false
primary_items:
  - R-frontend-003
  - formation_calendar_version_binding_and_backend_fixtures
depends_on:
  - CODEX_WORK_ORDER_011
  - CODEX_WORK_ORDER_012
entry_gate:
  - accepted access, deletion, revocation, and record-governance rules
  - accepted rule/frame/version identities
forbidden_before_gate:
  - no production backend, schema migration, account sync, or cross-device sharing
  - no raw memo or symptom-text server persistence
  - no calendar edit that silently mutates an accepted plan
exit_evidence:
  - calendar/version/sync contracts
  - deterministic concurrency and timezone fixtures
  - owner architecture acceptance record
```

**Objective:** define the identity, revision, conflict, and refresh contracts required
before multitab, multidevice, calendar, or backend behavior is implemented.

**Required outputs**

- `specs/reconstruct/CALENDAR_VERSION_AND_SYNC_CONTRACT.md`
- `reports/review/MULTITAB_REFRESH_AND_REVISION_DECISION.md`
- `specs/test-packages/CALENDAR_SYNC_CONCURRENCY_FIXTURE_PLAN.md`
- `FORMATION_CALENDAR_SYNC_ACCEPTANCE_DECISION.md`

**Tasks**

1. Define immutable plan/frame/block/session identities, rule and source versions,
   aggregate/safety epochs, canonical preimage hash, revision, watermark, and explicit
   planned/completed/experienced separation.
2. Define local-civil 9.5-day boundaries, timezone and DST transitions, race-anchor
   edits, re-anchors, DOUBLE/FLEX crosswalks, and weekly presentation without changing
   frame semantics.
3. Define multitab refresh using a revision/subscription contract: event source,
   monotonic revision, stale-tab detection, update notification, unsubscribe lifecycle,
   and deterministic behavior when tabs race or close. Do not assume server sync.
4. Define offline-first writes, idempotency, partial failure, retry, two-sided conflict
   preservation, rollback, version compatibility, deletion propagation, authorization,
   and device/server divergence. Local originals remain until confirmed promotion.
5. Define backend fixtures without choosing production infrastructure by implication:
   atomicity, unique constraints, outbox/retry, concurrent update, rollback, key
   erasure, least privilege, tenant isolation, and unsupported-version rejection.
6. Define edit authority. Drag/drop or manual calendar edits are proposals until the
   accepted Plan Generator/App Bridge workflow records validation and human approval.

**Acceptance tests and real QA**

- Automated `WO013-T01`: timezone/DST/re-anchor fixtures preserve local-civil frame
  identity and reject ambiguous or missing zone data.
- Automated `WO013-T02`: concurrent tabs/devices converge only through explicit
  revision/conflict rules; no last-writer-wins data loss is permitted.
- Automated `WO013-T03`: deletion, revocation, rollback, stale version, duplicate
  delivery, and partial failure produce deterministic auditable states.
- Manual QA channel: tmux or browser for the later implementation. Drive two tabs with
  the same local fixture and conflicting edits; PASS requires visible conflict/stale
  handling, no silent overwrite, and no network request in the local-only phase.

### CODEX_WORK_ORDER_014 — Human Review and Athlete-Visible Shadow Protocol

```yaml
order_id: CODEX_WORK_ORDER_014
execution_state: BLOCKED_UNTIL_012_013_ACCEPTED
runtime_authority: false
primary_items:
  - R-parent-004
  - formation_athlete_visible_shadow_protocol
depends_on:
  - CODEX_WORK_ORDER_012
  - CODEX_WORK_ORDER_013
entry_gate:
  - accepted coach, safety, record, and version identities
  - named athlete participant and linked human reviewer for protocol review
forbidden_before_gate:
  - no hidden shadow, live plan mutation, automatic notification, or bundled consent
  - no withdrawal penalty or reward tied to consent, load, speed, pain silence, or obedience
  - no claim of safety, efficacy, or validated prediction
exit_evidence:
  - prospective protocol and human-review workflow
  - synthetic dry-run evidence
  - owner, athlete, and independent-review acceptance records
```

**Objective:** define a transparent, non-executing pilot and the human workflow around
pain/review signals without automatically sharing private information.

**Required outputs**

- `specs/reconstruct/ATHLETE_VISIBLE_SHADOW_PILOT_PROTOCOL.md`
- `specs/reconstruct/HUMAN_REVIEW_AND_SHARING_WORKFLOW.md`
- `specs/test-packages/SHADOW_PROTOCOL_SCENARIO_PACKAGE.md`
- `FORMATION_SHADOW_PROTOCOL_ACCEPTANCE_DECISION.md`

**Tasks**

1. Define shadow as disclosed, separately consented, non-live replay or sandbox
   generation with zero effect on the athlete's real plan. A three-frame duration may
   be presented as the current proposal, but only the owner acceptance record fixes
   duration.
2. Define participation, refusal, withdrawal, pause, deletion, baseline, monitoring
   cadence, usefulness/feasibility measures, uncertainty, adverse-event recording,
   intervention boundaries, abort/stop criteria, and post-pilot disposition.
3. Make the athlete aware of generation and progress. Progress means only that the
   agreed observation step completed; it never means plan completion, safety, efficacy,
   or coach approval.
4. Define pain/human-review routes: the athlete chooses whether and what to share with
   coach, parent/guardian, friend, or another person. Private notes are never eligible.
   No automatic coach/guardian notification is introduced by default.
5. Define reviewer sampling, independence, disagreement adjudication, measurable pass
   thresholds, youth/privacy cases, bias/error analysis, correction, and immutable
   review records. Reviewer feedback cannot silently mutate a plan.
6. Define safe acknowledgment/sticker hooks only as protocol references. Rest, injury,
   refusal, withdrawal, and unfavorable reports count without penalty; consent and
   continued participation are never rewarded.

**Acceptance tests and real QA**

- Automated `WO014-T01`: protocol schema rejects hidden enrollment, bundled consent,
  missing withdrawal, undefined stop rules, real-plan writes, and success-like progress.
- Automated `WO014-T02`: sharing matrix rejects private notes, unspecified recipients,
  automatic notification, and stale/revoked consent.
- Automated `WO014-T03`: review fixtures require independent decisions, disagreement
  handling, fixed thresholds, and no silent plan change.
- Manual QA channel: browser for the later projection prototype. Enroll, refuse,
  withdraw, encounter a stop event, and choose a sharing recipient; PASS requires
  visible non-executing status, immediate withdrawal, no plan mutation, and no hidden
  network/share action.

### CODEX_WORK_ORDER_015 — Product Projection and Accessibility

```yaml
order_id: CODEX_WORK_ORDER_015
execution_state: BLOCKED_UNTIL_011_014_ACCEPTED
runtime_authority: false
primary_items:
  - R-a11y-005
  - formation_product_projection_and_explanations
depends_on:
  - CODEX_WORK_ORDER_011
  - CODEX_WORK_ORDER_014
entry_gate:
  - accepted privacy vocabulary, authority states, and shadow lifecycle
  - athlete and coach feedback participants named
forbidden_before_gate:
  - no UI that appears to be a coach, medical authority, or executing plan
  - no color-only, hover-only, dominant-component collapse, or coercive progress
  - no fixed readiness/fatigue score without accepted statistical authority
exit_evidence:
  - audience-aware projection contract
  - rendered multi-viewport and assistive-technology evidence
  - product, athlete, coach, accessibility, and privacy approvals
```

**Objective:** make complex sessions, uncertainty, shadow progress, and review state
understandable to a middle-school athlete while preserving expert detail on demand.

**Required outputs**

- `specs/reconstruct/FORMATION_PRODUCT_PROJECTION_AND_EXPLANATION_CONTRACT.md`
- `reports/review/FORMATION_ACCESSIBILITY_AND_DESIGN_REVIEW.md`
- `specs/test-packages/FORMATION_PROJECTION_ACCESSIBILITY_TEST_PACKAGE.md`
- `FORMATION_PRODUCT_PROJECTION_ACCEPTANCE_DECISION.md`

**Tasks**

1. Define audiences and action states: athlete, coach, guardian where policy permits,
   and journal-only user. Every surface states whether it is journal fact, descriptive
   analysis, shadow candidate, human review, or accepted real plan.
2. Define five explanation levels using progressive disclosure. Level 1 is short,
   plain, and age-appropriate; Level 5 is exact contract/technical detail. Changing
   level changes explanation only, never data authority or decision outcome.
3. Define fatigue/load presentation as a descriptive layer only after Order 010.
   Composite sessions retain all material components; the primary visual may show an
   accepted overall burden while detail exposes component types, units, sources, and
   uncertainty. No dominant-`MIXED` collapse.
4. Define color semantics only with text/icon/pattern equivalents. Final palette,
   competition/recovery/weight/plyometric associations, and fatigue bands require
   contrast testing and owner approval; color never communicates the sole meaning.
5. Define athlete-visible shadow progress and safe journal acknowledgments. Checks,
   stickers, or decorations may acknowledge writing/rest/injury reporting but never
   training volume, speed, clearance, consent, non-withdrawal, or obedience. Reference
   JDD catalog/unlock/monetization issues without silently closing them.
6. Define uncertainty, horizon, stale/missing data, source, privacy, linked-human
   action, correction, and no-medical-certainty copy. No projection automatically
   mutates a plan.
7. Require keyboard, screen reader, focus order, accessible name, 200% zoom/reflow,
   contrast, non-color meaning, reduced motion, mobile 320/375 px, and desktop tests.
   Motion must explain state or feedback, remain restrained, and respect reduced motion.

**Acceptance tests and real QA**

- Automated `WO015-T01`: projection fixtures reject missing authority, audience,
  freshness, uncertainty, source, or action state.
- Automated `WO015-T02`: explanation levels preserve the same underlying facts and
  outcome while changing only vocabulary/detail.
- Automated `WO015-T03`: accessibility checks reject color-only meaning, inaccessible
  names, keyboard traps, clipped 200% reflow, and reduced-motion violations.
- Manual QA channel: browser. Run 320 px, 375 px, desktop, and 200% zoom flows with
  keyboard and a named screen reader; PASS requires no overlap/clipping, complete
  semantic equivalence, visible focus, and understandable Level 1 copy.

### CODEX_WORK_ORDER_016 — Gated Runtime Integration and Evidence

```yaml
order_id: CODEX_WORK_ORDER_016
execution_state: DORMANT
runtime_authority: false
primary_items: []
dependency_owned_item:
  - OI-FA-RUNTIME-EVIDENCE-001
depends_on:
  - CODEX_WORK_ORDER_010_ACCEPTED
  - CODEX_WORK_ORDER_011_ACCEPTED
  - CODEX_WORK_ORDER_012_ACCEPTED
  - CODEX_WORK_ORDER_013_ACCEPTED
  - CODEX_WORK_ORDER_014_ACCEPTED
  - CODEX_WORK_ORDER_015_ACCEPTED
entry_gate:
  - six immutable acceptance records with approver, timestamp, source SHA, and evidence
  - all ten canonical blockers have accepted decision artifacts and approved target-patch plans; issue rows may remain OPEN pending this order's runtime evidence
  - explicit TOTAL_RESPONSIBILITY_HOLDER activation of this order
forbidden_before_gate:
  - no code, schema, migration, backend, SSO, shadow, plan, or production change
  - no partial implementation justified by a subset of accepted orders
forbidden_after_gate:
  - no authoritative plan change, hidden shadow, raw/private-note signal, or medical claim
  - no production rollout without kill switch, rollback, monitoring, and human approval
exit_evidence:
  - cross-order contract and security tests
  - non-executing athlete-visible vertical-slice evidence
  - migration, rollback, kill-switch, privacy, and traceability audits
```

**Objective:** implement only the accepted non-executing vertical slice, prove all
cross-order invariants, and produce evidence without promoting it to autonomous coach
or production plan authority.

**Required outputs**

- Runtime code and schema locations are chosen from the accepted target-binding packet;
  this plan does not guess them in advance.
- `specs/test-packages/FORMATION_RUNTIME_INTEGRATION_TEST_PACKAGE.md`
- `reports/review/FORMATION_RUNTIME_SECURITY_AND_PRIVACY_AUDIT.md`
- `runtime-evidence/formation-shadow/` evidence manifest and artifacts
- `FORMATION_RUNTIME_READINESS_DECISION.md`

**Tasks**

1. Build a gate verifier first. It parses the six acceptance records and rejects
   missing, stale, mismatched-SHA, unsigned, or partially accepted dependencies.
2. Patch owning target contracts and recount their open issues before runtime code.
   Generate strict types/parsers from accepted schemas; do not duplicate contract data
   through ad hoc constants.
3. Implement the smallest athlete-visible, non-executing shadow slice using TDD. It may
   read accepted structured facts, generate a candidate, show progress/explanation,
   route to human review, and record withdrawal; it cannot change a real plan.
4. Implement accepted persistence/sync with least privilege, audit minimization,
   atomicity, idempotency, outbox/retry where accepted, deletion/revocation propagation,
   and zero raw/private-note telemetry.
5. Add a kill switch that stops generation and presentation without deleting the
   athlete's journal. Add reversible migration and rollback evidence before any pilot.
6. Run cross-order contract, privacy, security, concurrency, timezone, accessibility,
   withdrawal, stop-event, stale-data, malformed-data, and no-plan-mutation tests.
7. Conduct a visible pilot-readiness review. Passing tests creates evidence only; a
   separate owner decision is still required before any real participant run.

**Acceptance tests and real QA**

- Automated `WO016-T01`: gate verifier starts RED on every missing/invalid acceptance
  and GREEN only for the exact accepted SHA set.
- Automated `WO016-T02`: private-note canary, raw-note, stale safety ref, wrong target,
  revoked consent, and evaluator failure cannot produce a candidate or leak data.
- Automated `WO016-T03`: concurrency, DST, rollback, kill switch, withdrawal, and
  partial failure preserve journal data and produce auditable fail-closed states.
- Automated `WO016-T04`: E2E proves shadow generation never mutates the real plan and
  cannot be mistaken for coach approval.
- Manual QA channel: browser plus HTTP/network audit. Execute enrollment, generation,
  progress, explanation-level change, human review, withdrawal, stop event, conflict,
  offline recovery, and kill switch. PASS requires visible non-executing status, zero
  plan mutation, zero private/raw-note network payload, and deterministic rollback.

## Final Verification Wave

1. `T-INV-001`: compare the 15-source inventory with all `primary_items`; require
   exactly 15 unique primary items and zero omissions.
2. `T-DEP-001`: parse `depends_on`; require no cycles and require Order 016 to depend
   on accepted Orders 010-015.
3. `T-GATE-001`: require every order to contain `execution_state`, `entry_gate`,
   `forbidden_before_gate`, and `exit_evidence`.
4. `T-SCOPE-001`: require this planning change to touch only `.omo/plans`,
   `.omo/drafts`, and `.omo/notepads`.
5. Manual QA `QA-INV-001`: exact-ID `rg` scan; PASS only if every reported Task-R ID
   and ORDER_008 Task C appears in its primary order.
6. Manual QA `QA-DEP-001`: extract the dependency matrix; PASS only with zero cycles.
7. Manual QA `QA-GATE-001`: inspect all gated orders; PASS only if runtime authority
   remains false before Order 016 and Order 016 remains non-prescriptive shadow-only.
8. Manual QA `QA-SCOPE-001`: inspect the actual Git diff; PASS only if no app, SPEC,
   CI, design, or production file changed.

## Commit Strategy

- Planning commit: `docs(plan): formalize remaining work orders`
- Future execution uses one branch and PR per order and one logical task per commit.
- Every future implementation commit footer references this plan:
  `Plan: .omo/plans/trainoracle-remaining-work-orders.md`.

## Non-Claims

- This plan does not accept scientific claims, numeric thresholds, coach rules,
  privacy/legal policy, shadow duration, backend design, or product projection.
- It does not authorize app, backend, SSO, Formation, or plan-generation runtime.
- It does not close any SPEC open issue merely by assigning it to an order.
