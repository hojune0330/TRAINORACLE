# WO017 Replacement Receipt Contract

```yaml
scope: DOCUMENTATION_VALIDATION_AND_GITHUB_RECEIPTS_ONLY
artifact_pr_field: "pr_url: RECORDED_IN_GITHUB_RECEIPT"
implementation_activation: PENDING_OWNER
runtime_authority: false
```

## Purpose

An artifact commit exists before GitHub assigns its pull-request URL. This
contract keeps the artifact immutable and records that later GitHub fact in a
reviewable location instead of adding a second artifact commit.

## Required GitHub Receipt

The draft PR body and a reciprocal comment on the WO017 control issue must
record all of these values after the PR exists:

1. Task identifier and owned artifact paths.
2. Branch name and exact 40-character head SHA.
3. Control issue URL and actual draft PR URL.
4. Commands run and their observable pass or fail result.
5. Cleanup state for temporary evidence, processes, browser sessions, ports,
   and worktrees.
6. A statement that the work is documentation-only and does not grant runtime,
   implementation, scientific, safety, privacy, coach, or owner authority.

## Forbidden Substitutions

- Do not replace the token in an artifact with a literal PR URL.
- Do not add a plan, ledger, checkbox, or bookkeeping commit to an artifact PR.
- Do not use ignored local evidence as the sole proof that a task completed.
- Do not set `implementation_activation` to anything other than
  `PENDING_OWNER` in this work stream.

[DRAFT_COMPLETE]
