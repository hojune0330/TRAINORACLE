# SPEC_TARGET_PATCH_READINESS.md

```yaml
doc_id: TRAINORACLE_SPEC_TARGET_PATCH_READINESS
spec_id: TRAINORACLE.SPEC_TARGET_PATCH_READINESS
title: "TrainOracle SPEC Target Patch Readiness"
version: "0.1"
round: RT1_REVIEW_READINESS
status: DRAFT_PATCH_READINESS
owner: COACH_HOJUNE
open_issues_total: 0
canonical_blocking_count: 0
executed_tests_total: 0
canonical_promotion_allowed: false
```

---

## 1. Purpose

This document turns the current TrainOracle SPEC state into a safe next-patch order.

It is not a product rule definition, not canonical promotion, not runtime evidence, and not issue closure.

Use it after reading [`SPEC_REVIEW_PACKET.md`](./SPEC_REVIEW_PACKET.md) and before editing target SPEC documents.

---

## 2. Current Phase Decision

Wave 3 productization drafts now exist, including the later Formation/Adaptation draft
and its owner-decision record. Formation currently has six canonical blockers.

Therefore the next phase is not "make more productization drafts" by default. The next phase is:

```text
Review Round 1
-> Formation owner/blocker decision
-> source acceptance decision
-> target patch readiness
-> target-local patches with recount
-> runtime evidence preparation
-> issue closure only when evidence gates are met
```

This phase still does not create a working app.

---

## 3. Readiness Gates

Every target patch must pass these gates before any issue can be closed.

| Gate | Required evidence | Closure effect |
|---|---|---|
| Source review | Source document read and accepted for the specific target use | Allows patch planning only |
| Target issue existence | Exact target file opened and issue row verified as open | Allows target-local patch only |
| Target patch | Target file patched with source refs and no semantic redefinition | Still no closure |
| Target recount | Open issue table recounted from the target file | Allows count update proposal only |
| Runtime/implementation proof | Terminal/CI/API/UI evidence as applicable | Required before safety/runtime issue closure |
| Owner review | COACH_HOJUNE or delegated owner accepts the patch and evidence | Required before canonical promotion |

No gate can be skipped because a separate summary document says the work is probably complete.

---

## 4. Recommended Target Patch Waves

### Wave A - Review Packet And Matrix Cleanup

Targets:

- `README.md`
- `TRAINORACLE_SPEC_INDEX.md`
- `SPEC_WORK_STATUS.md`
- `SPEC_DOCUMENTATION_REPORT.md`
- `SPEC_TARGET_PATCH_MATRIX.md`

Intent:

- Make the GitHub handoff readable to reviewers.
- Replace stale Wave 3 "selection" language with review/acceptance and target-patch readiness.
- Preserve all non-claim rules.

Closure allowed now:

- No. This is documentation orientation only.

### Wave B - Plan Generator Safety Gate Binding

Targets:

- `specs/active/PLAN_GENERATOR_SPEC.md`
- later `specs/reconstruct/PLAN_SAFETY_GATE_SPEC.md`
- later `specs/reconstruct/RULE_VALIDATION_ENGINE_CONTRACT.md`

Source documents:

- `specs/reconstruct/PLAN_SAFETY_GATE_SPEC.md`
- `specs/reconstruct/RULE_VALIDATION_ENGINE_CONTRACT.md`
- `specs/active/RVE_RULE_EVALUATOR_BINDING_SPEC.md`
- `specs/test-packages/D9_SAFETY_EVALUATOR_V2_1_1_TEST_PACKAGE.md` as candidate package only

Target issues:

- `OI-PG-RULE-SAFETY-GATE-BINDING-001`
- `OI-RVEC-PLAN-SAFETY-GATE-001`

Intent:

- Bind Plan Generator to consume D9/RVE state only through Safety Gate.
- Preserve `D9_ACTIVE` and `D9_UNKNOWN` blocking behavior.
- Preserve ADVISORY as a non-blocking subtype under `D9_CLEARED`.

Closure allowed now:

- No. Runtime evidence is still required.

### Wave C - Physio And Daily Log Source Acceptance

Targets:

- `specs/active/PLAN_GENERATOR_SPEC.md`
- `specs/active/APP_IMPLEMENTATION_BRIDGE.md`
- `specs/active/ATHLETE_PROFILE_SPEC.md`
- `specs/reconstruct/PLAN_SAFETY_GATE_SPEC.md`
- `specs/reconstruct/DAILY_LOG_AND_CHECKIN_SPEC.md`

Source documents:

- `specs/active/PHYSIO_SOURCE_TRUST_SPEC.md`
- `specs/reconstruct/DAILY_LOG_AND_CHECKIN_SPEC.md`

Target issues:

- `OI-PG-PHYSIO-SOURCE-CONSUMPTION-001`
- `OI-AIB-PHYSIO-SOURCE-001`
- `OI-AP-PHYSIO-SOURCE-001`
- `OI-PSG-DAILY-LOG-INPUT-BINDING-001`
- `OI-PSG-PHYSIO-SOURCE-CONSUMPTION-001`

Intent:

- Accept or iterate the source boundary for structured daily/physio signals.
- Keep raw memo/free-text transient only.
- Allow poor, missing, stale, or conflicting data to raise review/block.
- Prevent good physio data from clearing D9 or Safety Gate risk.

Closure allowed now:

- No. Source acceptance and target recount are still required, and implementation evidence is required where storage/redaction is involved.

### Wave D - Productization Draft Binding

Targets:

- `specs/active/APP_IMPLEMENTATION_BRIDGE.md`
- `specs/active/PLAN_GENERATOR_SPEC.md`
- `specs/reconstruct/DAILY_LOG_AND_CHECKIN_SPEC.md`
- future UI/screen contracts

Source documents:

- `specs/reconstruct/DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC.md`
- `specs/reconstruct/ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md`
- `specs/reconstruct/PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md`
- `specs/reconstruct/MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md`
- `TRAINING_PLAN_METHOD_DECISION.md`
- `specs/reconstruct/TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md`

Additional target:

- `specs/reconstruct/MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md` for the missing
  `frameId` / `blockId` projection schema

Target issues:

- `OI-PG-OUTPUT-FORMAT-BINDING-001`
- `OI-PG-OPTION-RATIONALE-PRIVACY-001`
- `OI-PG-MICROCYCLE-CALENDAR-MAPPING-001`
- `OI-FA-CALENDAR-SCHEMA-BINDING-001` remains a source-side blocker until a
  target-local mapping issue is added after recount
- a Plan Generator Formation/version binding issue may be added only after approved
  target-file recount
- downstream App Bridge/API/UI issues to be opened only after target files are reviewed

Intent:

- Connect product surfaces to structured source refs, reason codes, privacy tiers, redaction states, uncertainty, and source coverage.
- Keep product surfaces from creating/selecting plan options outside Plan Generator.
- Keep analysis/calendar/rationale surfaces from clearing D9 or Safety Gate blocks.
- Do not bind Formation until its proposed MAIN class registry, option taxonomy,
  coach rule set, load allocation, evidence/statistics, pilot protocol, and target
  schemas are accepted or explicitly held.

Closure allowed now:

- No. Draft acceptance, target patches, API/schema binding, and implementation evidence remain required.

### Wave E - Runtime Evidence Preparation

Targets:

- D9 evaluator execution path
- RVE signal mapping
- Safety Gate routing
- Plan Generator block behavior

Source documents:

- `specs/test-packages/D9_SAFETY_EVALUATOR_V2_1_1_TEST_PACKAGE.md`
- `specs/active/RVE_RULE_EVALUATOR_BINDING_SPEC.md`
- `specs/reconstruct/RULE_VALIDATION_ENGINE_CONTRACT.md`
- `specs/reconstruct/PLAN_SAFETY_GATE_SPEC.md`

Required runtime observations:

- `D9_ACTIVE` maps to stored `ACTIVE` and blocks plan generation.
- `D9_UNKNOWN` maps to stored `UNKNOWN` and blocks or requires human review.
- `D9_CLEARED` maps to stored `CLEARED` and does not block, while not implying medical clearance.
- ADVISORY preserves reason codes under `CLEARED` and does not block.
- Raw free-text and symptom clauses do not enter audit/storage evidence.

Closure allowed now:

- No. This readiness document only defines what evidence must later exist.

---

## 5. Stop Conditions

Stop and do not patch if any of these are true:

- The target issue row cannot be found in the exact target file.
- The target file has changed since the last recount and has not been reopened.
- A proposed patch needs to change D9 semantics outside `RULE_SPEC_D1_D9.md`.
- A proposed patch stores raw athlete free-text or raw symptom clauses.
- A reviewer asks to treat a reconstructed draft as an original restored file.
- A reviewer asks to close runtime issues from Markdown checks or candidate packages only.
- The patch would introduce bare D-rule references where namespace is required.

---

## 6. Recommended Next Execution Order

1. Review `TRAINING_PLAN_METHOD_DECISION.md` and Formation/Adaptation with coaching, security, and implementation lenses.
2. Resolve or explicitly retain its six canonical blockers; draft self-checks are not acceptance.
3. Run Wave B safety-gate and Wave C source-acceptance/recount planning where still open.
4. Add Plan Generator and Calendar target issues only after exact target-file recount and Formation source acceptance.
5. Run Wave D binding only after the safety/privacy and Formation source boundaries are accepted.
6. Prepare Wave E runtime evidence after target contracts are stable.

[DRAFT_COMPLETE]
