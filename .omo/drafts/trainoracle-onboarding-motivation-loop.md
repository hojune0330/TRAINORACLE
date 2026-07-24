---
slug: trainoracle-onboarding-motivation-loop
status: approved-for-terra-xhigh-execution
intent: clear
review_required: false
primary_worker_model: gpt-5.6-terra
primary_worker_reasoning_effort: xhigh
pending-action: execute-documentation-only-plan-and-stop-at-owner-gate
approach: "Use one Terra Very High primary worker to publish the four-PR documentation stack for the first-visit router and truthful daily analysis-motivation loop, then stop at owner activation."
---

# Draft: trainoracle-onboarding-motivation-loop

## Current handoff

```yaml
objective: Publish the WO017 documentation-only planning stack.
authority: Documentation, validators, tests, review artifacts, one controlling issue, and four linked draft PRs only.
repository: hojune0330/TRAINORACLE
handoff_pr: 99
expected_plan_sha256: 0c10c2f97740872566e19ce67458a1aa185b3114d8e8f20606c221624dedbd06
plan_hash_method: "SHA-256 of raw Git blob bytes: git show <pr-head>:.omo/plans/trainoracle-onboarding-motivation-loop.md | node -e \"const c=require('node:crypto');const a=[];process.stdin.on('data',x=>a.push(x));process.stdin.on('end',()=>console.log(c.createHash('sha256').update(Buffer.concat(a)).digest('hex')))\""
primary_worker: gpt-5.6-terra
reasoning_effort: xhigh
model_switch_for_primary_worker: forbidden
app_modification_authorized: false
implementation_activation: PENDING_OWNER
next_actor: TERRA
stop_when: Four linked draft PRs are validated and the activation packet remains PENDING_OWNER.
```

The branch name `review/wo017-external-plan-gate` is historical. PR #99 is now an execution handoff, not an external-review gate.

## Plan-pin reconciliation

The owner approved the exact canonical plan hash `0c10c2f97740872566e19ce67458a1aa185b3114d8e8f20606c221624dedbd06` for the current PR #99 head. Calculate it from raw Git blob bytes, not checked-out file bytes, because Windows line-ending conversion can produce a different working-tree hash:

```text
git show <pr-head>:.omo/plans/trainoracle-onboarding-motivation-loop.md | node -e "const c=require('node:crypto');const a=[];process.stdin.on('data',x=>a.push(x));process.stdin.on('end',()=>console.log(c.createHash('sha256').update(Buffer.concat(a)).digest('hex')))"
```

## Owner decisions

- `OWNER-017-01`: Use an optional one-context visit-reason router with direct-record and skip routes.
- `OWNER-017-02`: Show training-plan interest only as equally visible `서비스 준비 중`; do not collect a plan request or imply a working generator.
- `OWNER-017-03`: Use factual, source-backed analysis motivation now. Keep future decoration behind a separate acceptance gate.
- Primary worker decision: fix the receiving worker to `gpt-5.6-terra` with `reasoning_effort: xhigh`.
- A new Momus plus independent CLI review round is not required before execution.

## Product invariants

- First-time visitors choose why they came without a long explanation or mandatory onboarding.
- A tap routes directly into existing journaling behavior.
- Returning users do not repeat first-visit onboarding.
- Post-save feedback uses only facts available in current local records.
- Structured evening pain takes precedence over mood when both are recorded.
- Training-plan interest creates no request, candidate, waitlist, output, profile signal, or audit signal.
- Analysis never invents a score, threshold, readiness value, or medical/safety clearance.
- Decoration does not activate money, points, badges, levels, streak pressure, load, pace, weight, pain-free, safety-clearance, or plan-compliance rewards.

## Scope

### Allowed

- `.omo/` plan and resume records
- root WO017 work order
- review and handoff reports
- WO017 validator, fixtures, and tests
- current documentation indexes named by the plan
- one controlling GitHub issue
- four stacked draft PRs
- bounded Fable UX artifact and bounded Sol advisory artifact as required by the plan

### Forbidden

- `app/` or `impl/`
- runtime evaluators
- storage, consent, identity, sync, or schema
- deployment or production configuration
- canonical promotion
- issue closure
- fabricated runtime evidence
- implementation activation

## Actor boundaries

- Primary worker: `gpt-5.6-terra`, `xhigh`, for the entire handoff.
- Fable: bounded UX, copy, mobile, accessibility, and persona artifact only.
- Sol: bounded non-authoritative adversarial advisory only where the plan requires it.
- Owner: all public product changes and implementation activation.
- Qualified humans: privacy, youth, medical, legal, or scientific approvals when those gates are triggered.

Fable or Sol output does not switch the primary worker model and cannot replace owner or qualified-human authority.

## Approval record

```yaml
product_choices_evidence: "Owner reply: 권장 / 권장 / 권장+b"
product_choices_interpretation: "Optional one-context router; plan interest as service preparing; factual analysis now plus future decoration under separate acceptance."
model_routing_evidence: "Owner instruction: 다음 작업자는 테라 매우 높음으로 고정."
model_routing_interpretation: "Use gpt-5.6-terra with reasoning_effort xhigh as the primary worker and begin the bounded documentation plan without another pre-execution dual-review gate."
execution_authorized: true
app_implementation_authorized: false
```

## Prior review context

- Earlier attempts to run a separate independent CLI plan gate were blocked by the nested sandbox before the plan could be read.
- Those failed launch attempts are historical context, not current blockers and not approval evidence.
- The final content review had already returned `OKAY` from Momus session `019f8b4c-8c18-77e1-80c2-3a195ed840b3` and supplementary `OKAY` from gpt-5.6-sol xhigh session `019f8b4c-a299-7bf2-a616-ff233173b870`.
- The owner's latest instruction supersedes the blocked external-gate workflow and authorizes Terra xhigh execution of the documentation-only plan.

## Exact next action

1. Open PR #99 and read all three changed files.
2. Verify the checked-out PR head and calculate the live plan SHA-256.
3. Keep the primary worker on `gpt-5.6-terra` with `reasoning_effort: xhigh`.
4. Follow `.omo/plans/trainoracle-onboarding-motivation-loop.md`.
5. Before creating WO017 execution issue/PRs, exclude only PR #99 from duplicate results and require no actual execution duplicate.
6. Stop at `implementation_activation: PENDING_OWNER` without changing `app/` or `impl/`.

[DRAFT_COMPLETE]
