---
name: terra-sol-router
description: Route a coding, research, or product-specification task between gpt-5.6-terra and gpt-5.6-sol without duplicating work.
---

# Terra-Sol Router

Route by uncertainty and consequence, not by alternating models.

## Roles

| Actor | Use for | Do not use for |
| --- | --- | --- |
| Terra | Repository orientation, bounded research, routine implementation, tests, mechanical reconciliation, Git handoff | Owner decisions or unresolved high-consequence trade-offs |
| Sol | One bounded design decision, conflicting evidence, safety/privacy/scientific boundary review, final risk review | Repeating Terra research, mechanical edits, or routine test reruns |
| OWNER | Product direction, permission, pricing, clinical or safety authority, or any choice that no evidence can resolve | Delegating an unanswered decision to either model |

Use model names only when available. Do not silently substitute a different model: record
the unavailable route and continue only with work that remains safe for the available actor.

## Route

1. Terra creates a small evidence packet: Git SHA, task goal, paths, constraints,
   evidence, and one concrete open question.
2. Terra completes deterministic, bounded, reversible work with observable verification.
3. Escalate to Sol only when the question can change safety, privacy, permission, formal
   specification direction, or nontrivial architecture.
4. Sol returns DECISION, RATIONALE, CONSTRAINTS, UNKNOWN, and ACCEPTANCE_CHECK.
5. Stop at OWNER for product or authority decisions. Record the smallest question and
   conservative default; do not implement the unresolved choice.
6. Terra implements accepted boundaries, tests them, verifies them, and creates the Git
   handoff.

## Handoff Contract

    HANDOFF
    commit: full Git SHA
    branch: branch name
    scope: changed paths
    verified: commands and observable result
    decision: Sol or OWNER record, or NONE
    open: only unresolved owner question, or NONE

Use a pushed Git commit SHA as the cross-computer boundary. Do not use a local session
identifier or uncommitted edits as an inter-computer handoff.

## Boundaries

- Do not have Terra and Sol research the same source set.
- Do not present Sol advice as runtime authority, user consent, scientific validity, or
  safety clearance.
- Do not turn a missing owner decision into an inferred product fact.
- Keep sensitive material out of handoff packets unless it is essential and permitted.

## Output

    Route: Terra -> Sol -> OWNER -> Terra | handoff: SHA | open: question or NONE

For a simple task:

    Route: Terra only | handoff: SHA | open: NONE
