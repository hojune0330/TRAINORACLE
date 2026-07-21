---
name: terra-sol-router
description: Route long or multi-stage Codex work between gpt-5.6-terra and gpt-5.6-sol to reduce repeated context while preserving decision quality. Use for sustained repository work, safety- or privacy-sensitive specifications, architecture decisions followed by routine execution, repeated handoffs, two-computer Git workflows, or whenever the user asks to alternate Terra and Sol for token efficiency.
---

# Terra-Sol Router

Route by phase and risk, never by timer or turn count. Keep one model on the task until
its stop condition is met, then transfer only a compact evidence packet.

## Core Routing Rule

Use **Terra** for bounded work whose method is already known:

- repository inventory and evidence collection;
- routine implementation following existing patterns;
- document reconciliation, issue recounts, and handoff updates;
- targeted tests, builds, and mechanical verification;
- applying an already-decided architecture or review delta.

Use **Sol** only when frontier judgment is worth its larger context cost:

- unresolved architecture or ownership boundaries;
- conflicting source-of-truth documents;
- safety, privacy, security, medical, legal, or destructive migration decisions;
- root-cause analysis after two materially different failed approaches;
- final review of a high-impact change or release gate.

Return to Terra as soon as Sol has produced a concrete review or decision delta within its
delegated authority. Do not leave Sol performing mechanical edits, broad inventories, or
repeated green test runs.

## Phase Loop

1. **Classify with Terra.** Establish repository truth, scope, changed surfaces, risks,
   and the next observable stop condition.
2. **Stay on Terra** when the work is startable and bounded. Finish it without a model
   switch.
3. **Escalate one question to Sol** only when an escalation trigger is present. Send the
   handoff capsule below with exact artifact paths. Ask for one review or decision delta,
   not a new project summary.
4. **Execute with Terra.** Apply the delta only after the appropriate authority accepts
   it, then run the matching tests and record evidence.
5. **Use Sol once more only for a high-risk gate.** Review the exact diff or full commit
   SHA. Routine work ends on Terra after observed verification.

The normal expensive-work loop is `Terra -> Sol -> Terra`. A second Sol pass requires a
new risk or a final high-impact gate; it is not automatic.

## Handoff Capsule

Pass only this information across models or computers:

```yaml
objective: one concrete outcome
authority: what this task may and may not change
repository: owner/name
branch: exact branch
base_sha: full commit SHA
head_sha: full commit SHA or UNCOMMITTED
changed_paths: exact paths only
verified_evidence: commands or artifact paths already observed
open_decision: the single question requiring the next model
invariants: safety, privacy, compatibility, and user constraints
next_actor: TERRA | SOL | OWNER | HUMAN_REVIEWER
stop_when: exact observable completion condition
```

Do not transfer the full conversation when these fields are sufficient. Link large
evidence by path and line, commit, PR, or test artifact instead of pasting it.

## Tool Use

When subagent model overrides are available:

- spawn with `fork_context: false` by default;
- choose `model: gpt-5.6-terra` for bounded execution or reconciliation;
- choose `model: gpt-5.6-sol` for one high-risk decision or gate;
- give each agent one ownership boundary and one stop condition;
- wait once with a timeout sized for the task; do not duplicate or repeatedly poll it;
- close completed agents after integrating their result.

Do not spawn an agent merely to satisfy alternation. If the current model is already the
right one, continue locally. If model override is unavailable, name the recommended model
in the handoff and continue with the current model unless the user requested a pause. When
`next_actor` is `OWNER` or `HUMAN_REVIEWER`, stop at that gate; no AI model may substitute.

Sol, Terra, Codex, and other AI reviewers are non-authoritative for owner, medical, legal,
privacy, scientific, and named-human-review gates. Their output is a recommendation until
an authorized person records acceptance with identity and role, scope, source/head SHA,
and a durable evidence path.

## Two-Computer Git Handoff

Use Git, not chat memory or a `codex://` link, as the shared state boundary.

Before handing off:

1. Re-read `git status`; distinguish intended, unrelated, and untracked files.
2. Verify the intended change on the matching surface.
3. Commit only the intended paths and push the branch when the user requested the
   cross-computer handoff.
4. Record the full pushed SHA and handoff capsule in the PR or durable project handoff.

On the receiving computer:

1. Fetch the remote and locate the exact pushed SHA.
2. Preserve unrelated local changes; never reset or clean them by assumption.
3. Check out or fast-forward the intended branch/worktree.
4. Verify `HEAD` equals the handoff SHA before continuing.
5. Resume with the named `next_actor` and `stop_when` condition. If the actor is a person,
   wait for the durable decision record before routing back to Terra or Sol.

Local-only and untracked files are never shared evidence.

## Efficiency Guardrails

- Do not have Terra and Sol independently rediscover the same repository.
- Do not ask Sol for broad summaries when Terra already produced an evidence packet.
- Do not rerun a green command unless its inputs changed.
- Do not run duplicate review agents against the same SHA.
- Do not switch models while a decision or edit is half-complete.
- Do not claim token savings from intuition. Report model, phase, token clues, rework,
  and elapsed time only when actual session records exist.
- Prefer one bounded Sol review or delegated technical decision over many short Sol turns.
- Prefer Terra completion over a ceremonial final Sol pass on routine changes.

## Completion Report

Report:

- which phases used Terra and Sol;
- why each switch occurred;
- exact commit or artifact reviewed across the switch;
- verification observed after returning to Terra;
- any unavailable token evidence or residual risk.

Never present an AI model review as a verified human, domain-expert, legal, medical, or
product-owner approval.
