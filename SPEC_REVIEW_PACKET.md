# SPEC_REVIEW_PACKET.md

```yaml
doc_id: TRAINORACLE_SPEC_REVIEW_PACKET
spec_id: TRAINORACLE.SPEC_REVIEW_PACKET
title: "TrainOracle SPEC Review Packet"
version: "0.1"
round: RT1_REVIEW_READINESS
status: DRAFT_REVIEW_PACKET
owner: COACH_HOJUNE
open_issues_total: 0
canonical_blocking_count: 0
executed_tests_total: 0
canonical_promotion_allowed: false
```

---

## 1. Purpose

This packet tells an external reviewer how to inspect the TrainOracle SPEC work from GitHub without relying on private chat history.

It is not a product rule definition, not canonical promotion, not runtime evidence, and not issue closure.

Use this document when asking another reviewer, agent, or implementation lead to review the repository.

---

## 2. Review Context In Plain Korean

TrainOracle은 단순한 훈련 일지 UI가 아니다.

목표는 선수의 일지, 세션, 프로필, 생리 신호, 안전 신호를 근거로 읽고, D9 safety hard-stop과 Safety Gate를 통과한 뒤에만 훈련 계획과 분석을 만드는 것이다.

현재 GitHub 상태는 다음이다.

- 핵심 SPEC 계층은 정리되어 있다.
- Wave 1 Physio Source Trust target patch와 Wave 2 Daily Log binding patch는 일부 적용되어 있다.
- Wave 3 productization draft는 모두 만들어졌다.
- 아직 canonical promotion, production deployment, D9 runtime evidence, safety-chain issue closure 단계는 아니다.

따라서 리뷰의 핵심 질문은 "더 멋진 앱을 바로 만들 수 있는가"가 아니라 "지금 SPEC 계층이 구현으로 넘어가기 전에 안전/개인정보/근거/패치 순서를 잘 지키고 있는가"다.

---

## 3. Read Order

Read in this order.

1. [`README.md`](./README.md) - product and repository entry point.
2. [`SPEC_OVERVIEW_FOR_HOJUNE.md`](./SPEC_OVERVIEW_FOR_HOJUNE.md) - plain Korean overview.
3. [`TRAINORACLE_SPEC_INDEX.md`](./TRAINORACLE_SPEC_INDEX.md) - file inventory and source-of-truth policy.
4. [`SPEC_WORK_STATUS.md`](./SPEC_WORK_STATUS.md) - current phase and not-yet list.
5. [`SPEC_TARGET_PATCH_MATRIX.md`](./SPEC_TARGET_PATCH_MATRIX.md) - current source-to-target patch matrix and non-closure gates.
6. [`SPEC_TARGET_PATCH_READINESS.md`](./SPEC_TARGET_PATCH_READINESS.md) - next target-patch readiness plan.
7. [`SPEC_DOCUMENTATION_REPORT.md`](./SPEC_DOCUMENTATION_REPORT.md) - document-by-document map.
8. Active SPEC files under [`specs/active/`](./specs/active/).
9. Reconstructed and productization drafts under [`specs/reconstruct/`](./specs/reconstruct/).

Do not start from legacy files unless the review question is specifically about legacy alignment.

---

## 4. Known Non-Claims

The repository does not currently claim:

- full working web/app implementation
- canonical SPEC promotion
- production deployment
- D9 evaluator runtime evidence
- RVE or Plan Generator safety-gate binding issue closure
- final metric algorithm authority for analysis charts
- medical clearance from `D9_CLEARED`
- source acceptance for every reconstructed/productization draft

Markdown self-checks, generated reports, and candidate test packages are process evidence only. They are not runtime evidence.

---

## 5. GitHub-Only Review: What It Can And Cannot Prove

GitHub-only review can produce useful insight on:

- whether the file inventory and read order are understandable
- whether reviewer-facing handoff docs are enough to continue work
- whether safety and privacy guardrails are stated consistently
- whether target patch order is coherent
- whether productization drafts overlap or leave obvious gaps
- whether legacy references are being treated as reference only

GitHub-only review cannot prove:

- that D9 evaluator code actually runs
- that RVE signal mapping works at runtime
- that Safety Gate blocks Plan Generator in a live app
- that data deletion/redaction is implemented
- that external LLM/private athlete data boundaries are enforced in code
- that UI behavior matches final product needs
- that reconstructed drafts are original restored files

Any reviewer must label these as runtime or implementation gaps, not as resolved issues.

---

## 6. Reviewer Lenses

### 6.1 Safety / Medical-Risk Lens

Review:

- `RULE_SPEC_D1_D9.md`
- `RVE_RULE_EVALUATOR_BINDING_SPEC.md`
- `RULE_VALIDATION_ENGINE_CONTRACT.md`
- `PLAN_SAFETY_GATE_SPEC.md`
- `PLAN_GENERATOR_SPEC.md`

Questions:

- Does `D9_ACTIVE` always block plan generation?
- Does `D9_UNKNOWN` block or require human review?
- Is `D9_CLEARED` clearly not medical clearance?
- Is ADVISORY clearly a non-blocking subtype under `D9_CLEARED`, not a fourth D9 disposition?
- Can any template, good physio data, rationale text, or UI state clear D9 risk? It must not.

### 6.2 Privacy / Data-Governance Lens

Review:

- `APP_IMPLEMENTATION_BRIDGE.md`
- `ATHLETE_PROFILE_SPEC.md`
- `DAILY_LOG_AND_CHECKIN_SPEC.md`
- `PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md`
- `DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC.md`
- `ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md`

Questions:

- Are raw athlete free-text, symptom clauses, medical notes, injury narratives, guardian private notes, and hidden chain-of-thought kept out of audit/storage?
- Are reason codes, source refs, redaction states, and structured fields preferred?
- Is external LLM use with private athlete data still forbidden in the current rule-engine phase?
- Are retention, consent, access, export, and audit boundaries still open where implementation proof is missing?

### 6.3 Implementation / API Lens

Review:

- `APP_IMPLEMENTATION_BRIDGE.md`
- `PLAN_SAFETY_GATE_SPEC.md`
- `RULE_VALIDATION_ENGINE_CONTRACT.md`
- `SPEC_TARGET_PATCH_MATRIX.md`
- `SPEC_TARGET_PATCH_READINESS.md`

Questions:

- Are target/source pairs clear enough for an implementation lead?
- Which records and endpoints still need App Bridge/API schema contracts?
- Which items require target-file recount before closure?
- Which runtime tests must exist before safety-chain issues close?
- Are reconstructed drafts treated as drafts rather than restored originals?

### 6.4 Coaching / Product-UX Lens

Review:

- `DAILY_LOG_AND_CHECKIN_SPEC.md`
- `DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC.md`
- `ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md`
- `MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md`
- design docs under [`design-system/`](./design-system/) and [`designs/`](./designs/)

Questions:

- Does the daily-log flow support athletes coming back every day?
- Do Daily Brief, AI Inbox, Analysis, Calendar, and rationale surfaces explain uncertainty and source coverage?
- Is the 9.5-day cycle display separated from `RULE_SPEC_D1_D9.*` rule IDs?
- Are product surfaces prevented from creating/selecting plan options unless Plan Generator owns that decision?

---

## 7. Review Output Template

Ask reviewers to answer in this shape.

```text
Reviewer lens:
Files read:
Verdict: APPROVE_FOR_NEXT_PATCH_PLAN / ITERATE_BEFORE_PATCH / BLOCKED

Findings:
- [severity] file:line - issue / risk / gap

Must fix before target patches:
- ...

Can defer until implementation:
- ...

Runtime evidence still required:
- ...

No-claim confirmation:
- I did / did not find unsupported issue closure, canonical promotion, or runtime evidence claims.
```

Do not accept a vague "looks good" as a sufficient review.

---

## 8. Current Recommended Review Outcome

The recommended next move is:

1. Run Review Round 1 using this packet.
2. Use [`SPEC_TARGET_PATCH_READINESS.md`](./SPEC_TARGET_PATCH_READINESS.md) to choose the first safe target patch wave.
3. Patch target docs only after opening the exact target files and verifying issue rows.
4. Keep all related issues open until source acceptance, target recount, and required runtime/implementation evidence exist.
5. Prepare D9 runtime evidence after review/readiness is stable.

[DRAFT_COMPLETE]
