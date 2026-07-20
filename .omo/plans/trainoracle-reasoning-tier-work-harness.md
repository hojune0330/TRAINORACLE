# TRAINORACLE Reasoning-Tier Work Harness

## TL;DR

> **Summary**: Route remaining TRAINORACLE work through three progressively smaller reasoning/context stages without allowing a lower stage to make owner, coach, scientific, legal, human-review, or runtime decisions.
> **Deliverables**: human guide, machine catalog, dependency-free selector/validator, tests, CI gate, and a current next-work selection.
> **Effort**: Medium
> **Parallel**: No; the schema and fail-closed rules must exist before the catalog is trusted.
> **Critical Path**: Contract -> RED tests -> selector/validator -> real catalog -> CI -> PR

## Context

### Original Request

- Continue every autonomous part to completion.
- Defer simple but token-heavy bulk work.
- Divide lower-reasoning-capable work into three stages that progressively reduce context and reasoning needs.

### Repository Facts

- Work in `C:/Users/SAMSUNG/.codex/worktrees/TRAINORACLE-reasoning-tier-harness` on `codex/reasoning-tier-harness`, based on `a0a51096762a82f1cdf56b0eb522e72e870484c6`.
- Formal acceptance is `0/6`, owner-approved P1 plans are `0/10`, named expert reviews are `0/6`, and canonical human screening is `0/167`.
- WO011-WO015 packets, the WO016 verifier, and ten P1 target plans already exist and must be referenced rather than rewritten.

### Metis Review Incorporated

- Pin exact stage caps and CLI behavior.
- Treat all human screening and expert review as authority-blocked, never mechanical work.
- Detect stale status through evidence markers in source files rather than comparing HEAD to the catalog base.
- Make generated capsules pointer-based and bounded; do not duplicate existing packets.
- Add negative tests for authority escalation, missing references, stale evidence, budget regression, and runtime activation.

## Work Objectives

### Core Objective

Create a small deterministic harness that tells a future Codex which work is eligible for high, medium, or low reasoning and supplies only the bounded references and checks needed for that work.

### Stage Contract

| Stage | Suggested reasoning | Maximum references | Maximum capsule characters | Maximum tasks | Authority |
|---|---|---:|---:|---:|---|
| `S1_DEEP_FRAME` | high/xhigh | 10 | 12000 | 1 | May frame options; cannot self-approve |
| `S2_BOUNDED_BUILD` | medium | 6 | 6000 | 2 | Executes accepted, decision-complete contracts only |
| `S3_MECHANICAL_BATCH` | low | 3 | 3000 | 5 | Deterministic transcription, checking, or status sync only |

Character and reference limits are tokenizer-independent context controls, not promises of an exact token bill.

### Definition Of Done

- The three budgets are strictly descending.
- `S3_MECHANICAL_BATCH` rejects any task with policy, scientific, legal, human-authority, or runtime risk.
- Every runnable task has existing source references, a deterministic check, allowed paths, and forbidden actions.
- Evidence-marker drift fails validation.
- `next --stage <stage>` emits a bounded Markdown capsule or an explicit no-ready-work result.
- Existing Formation approval counts and `runtime_authority: false` remain unchanged.
- Local tests and GitHub CI pass.

### Must NOT Have

- No edits to Formation decisions, approval rosters, research screening decisions, P1 approval states, runtime evidence, app behavior, or runtime authorization.
- No model name hard dependency.
- No third-party package.
- No generated claim that prepared work is accepted work.
- No classification of 167-paper human screening or six expert reviews as low-tier work.

## Verification Strategy

- Test decision: TDD with Node's built-in `node:test` and `assert/strict`.
- Every catalog selection is validated before rendering.
- Exact commands:
  - `node --test specs/test-packages/reasoning-tier-harness.test.mjs`
  - `node specs/test-packages/reasoning-tier-harness.mjs validate`
  - `node specs/test-packages/reasoning-tier-harness.mjs next --stage S1_DEEP_FRAME`
  - `node specs/test-packages/reasoning-tier-harness.mjs next --stage S2_BOUNDED_BUILD`
  - `node specs/test-packages/reasoning-tier-harness.mjs next --stage S3_MECHANICAL_BATCH`
  - `node --test specs/test-packages/*.test.mjs`
  - `git diff --check`

## Execution Tasks

### 1. Fix The Shared Contract

Create `reports/work-harness/README.md` and `reports/work-harness/TRAINORACLE_WORK_CATALOG.json`.

The JSON schema contains:

- `schemaVersion`, `catalogId`, `sourceSnapshot`, `runtimeAuthority`
- exact stage objects with order, reasoning class, caps, and batch size
- task ID, title, stage, status, priority, kind, decision completeness, risk flags,
  dependencies, source evidence markers, allowed paths, deterministic checks, and forbidden actions

QA:

- Happy: all referenced files and evidence markers exist at the pinned source snapshot.
- Failure: missing files, missing markers, duplicate task IDs, unknown stages, or non-descending budgets fail validation.

### 2. Build The Selector With RED First

Create `specs/test-packages/reasoning-tier-harness.test.mjs` against an importable minimal module, confirm behavior failures, then implement `specs/test-packages/reasoning-tier-harness.mjs`.

CLI:

- `validate`: exit 0 and print counts on success; exit 1 with stable error codes on failure.
- `next --stage <id>`: validate first, select only `READY` tasks whose dependencies are `DONE`, order by priority then ID, enforce the stage batch limit, and emit Markdown. No-ready-work is an honest exit-0 result.
- Unknown command or stage: exit 1 and print usage/error.

Required negative tests:

- low-stage owner/coach decision
- low-stage scientific or legal judgment
- low-stage human/expert approval
- low-stage runtime activation
- missing deterministic check or allowed path
- packet over cap
- stale evidence marker or missing reference
- descending budget regression
- dependency not complete
- replacement-character/mojibake in catalog text

### 3. Populate Current Work Without Inventing Authority

Catalog the current work as pointers:

- Deep: Formation prescription/coach rules, load and minimum-evidence model, privacy/youth review, shadow-to-pilot acceptance, and product projection/human review.
- Bounded build: later spec/P1 patches and runtime vertical slices, all blocked on their named deep decisions.
- Mechanical: current validator/status recount, later fixture transcription, metadata/link audit, and merged-state documentation sync.
- Human-only: 167-source screening, 18 supplemental screening, six expert reviews, five manual scenarios, and twelve user teach-back scenarios are explicitly `BLOCKED_HUMAN`.

At least one safe deterministic validation task is `READY`; high-volume audits remain `DEFERRED_VOLUME` until intentionally dispatched to a low-reasoning worker.

QA:

- Happy: each stage produces either a bounded capsule or clear blockers.
- Failure: changing a human-only task to stage 3 fails even if it is repetitive.

### 4. Add A Narrow CI Gate

Add one `.github/workflows/ci.yml` step after Node setup that runs only the harness test and validation commands. Do not alter app, impl, or Formation runtime jobs.

QA:

- Happy: clean catalog/test pair passes with no install.
- Failure: forbidden low-tier authority or stale marker fails CI.

### 5. Execute The First Selection And Publish

- Run all three `next` commands and record the result in the PR body, not as duplicated tracked packets.
- Run the complete spec test suite and diff check.
- Commit only the plan, guide, catalog, module, test, and CI step.
- Push `codex/reasoning-tier-harness` and open a ready PR against `main`.
- Request one counterpart comment review because the harness controls future task authority; do not create a review-record PR.

## Final Verification Wave

- Confirm no existing approval, screening, expert, runtime, app, or P1 plan state changed.
- Confirm the catalog reports the source counts honestly: 0/6 strict acceptance, 0/10 owner P1 approval, 0/6 expert review, 0/167 human screening.
- Confirm a GitHub-only reader can run the exact commands from the README on Node 24 without additional packages.
- Confirm PR checks are green before reporting completion.
