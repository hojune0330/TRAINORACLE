# trainoracle-next-spec-review-and-patch-plan - Work Plan

## TL;DR (For humans)

**What you'll get:** A review-first handoff layer that lets another reviewer understand TrainOracle's current SPEC state from GitHub, what to inspect, and what must not be claimed yet. It also gives the next executor a clear target-patch readiness order without closing issues or claiming runtime evidence.

**Why this approach:** Wave 3 productization drafts now exist, so the next risk is not missing draft creation. The next risk is accepting, patching, or implementing them out of order and accidentally weakening D9/Safety Gate/privacy boundaries.

**What it will NOT do:** It will not close any open issue, promote any draft to canonical, claim D9 runtime evidence, or redefine D9 semantics.

**Effort:** Medium
**Risk:** Medium - safety/privacy language must remain strict while making the handoff easier to read.
**Decisions I made for you:** Use a review packet before target patches; use GitHub as reviewer source with a scoped reviewer brief; treat GitHub-only review as useful but insufficient for runtime evidence; defer app/web implementation until target patch readiness is documented.

Your next move: execute the review packet and target-patch readiness docs, then run CLI evidence checks. Full execution detail follows below.

---

> TL;DR (machine): Medium effort, medium risk; produce review packet, readiness doc, stale handoff updates, and evidence without issue closure.

## Scope

### Must have

- Complete this plan file after the approved `ulw-plan` gate.
- Add `SPEC_REVIEW_PACKET.md` so external reviewers can inspect GitHub with read order, known non-claims, reviewer lenses, and exact questions.
- Add `SPEC_TARGET_PATCH_READINESS.md` so the next target patches have a safe order, target/source pairs, evidence gates, and non-closure rules.
- Update the top-level handoff docs so a GitHub-only reader can find the new review/readiness docs.
- Update `SPEC_TARGET_PATCH_MATRIX.md` stale wording from productization draft selection to productization draft review/acceptance and target-patch readiness.
- Preserve all safety, privacy, namespace, runtime-evidence, and file-truth guardrails.

### Must NOT have (guardrails, anti-slop, scope boundaries)

- No issue closure.
- No canonical promotion.
- No runtime evidence claim.
- No D9 semantic redefinition outside `RULE_SPEC_D1_D9.md`.
- No assertion that reconstructed drafts are original restored files.
- No absolute issue-count changes copied from memory.
- No app/web implementation.
- No raw athlete free-text, raw symptom clause, injury narrative, medical note, guardian private note, or hidden chain-of-thought storage permission.

## Verification strategy

> Zero human intervention - all verification is agent-executed.

- Test decision: none for runtime behavior; this is documentation governance. Use CLI auxiliary-surface evidence because the deliverable is files, links, grep checks, and git diff.
- RED evidence: `.omo/evidence/trainoracle-next-phase-red.txt`
- C001 evidence: `.omo/evidence/trainoracle-next-phase-c001-green.txt`
- C002 evidence: `.omo/evidence/trainoracle-next-phase-c002-guardrails.txt`
- C003 evidence: `.omo/evidence/trainoracle-next-phase-c003-regression.txt`
- Review evidence: `.omo/evidence/trainoracle-next-phase-final-review.txt`

## Execution strategy

### Parallel execution waves

Wave 1 - Planning and baseline:

- Capture RED proof that reviewer/readiness docs do not exist and the plan still has placeholders.
- Complete this approved plan file.
- Create concrete ULW criteria for CLI evidence.

Wave 2 - Documentation creation:

- Create `SPEC_REVIEW_PACKET.md`.
- Create `SPEC_TARGET_PATCH_READINESS.md`.

Wave 3 - Handoff references:

- Update `README.md`.
- Update `SPEC_WORK_STATUS.md`.
- Update `TRAINORACLE_SPEC_INDEX.md`.
- Update `SPEC_DOCUMENTATION_REPORT.md`.
- Update `SPEC_TARGET_PATCH_MATRIX.md`.

Wave 4 - Evidence and review:

- Run C001 deliverable checks.
- Run C002 guardrail checks.
- Run C003 regression checks.
- Run final diff/self-review.
- Record ULW evidence and checkpoint where possible.

### Dependency matrix

| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| T1 RED baseline | none | T2-T6 | none |
| T2 Complete plan | T1 | T7-T10 | T3/T4 drafting once scope stable |
| T3 Create review packet | T1/T2 | T7/C001/C003 | T4 |
| T4 Create target patch readiness doc | T1/T2 | T7/C001/C002/C003 | T3 |
| T5 Update patch matrix stale language | T3/T4 | C002/C003 | T6 |
| T6 Update reader-facing indexes | T3/T4 | C001/C003 | T5 |
| T7 Run C001-C003 checks | T3-T6 | T8 | none |
| T8 Final review and ULW evidence | T7 | final report | none |

## Todos

- [x] 1. Capture RED baseline
  What to do / Must NOT do: Capture missing review/readiness docs, stale patch-matrix wording, and plan placeholders. Do not edit product SPEC files before this proof.
  Parallelization: Wave 1 | Blocked by: none | Blocks: all edits
  References: `SPEC_TARGET_PATCH_MATRIX.md`, `.omo/plans/trainoracle-next-spec-review-and-patch-plan.md`
  Acceptance criteria: `.omo/evidence/trainoracle-next-phase-red.txt` exists and names the missing/stale state.
  QA scenarios: PowerShell CLI auxiliary surface; `Test-Path`, `Select-String`; Evidence `.omo/evidence/trainoracle-next-phase-red.txt`
  Commit: N | not a standalone commit unit

- [x] 2. Create reviewer packet
  What to do / Must NOT do: Add a reviewer-facing document with read order, reviewer lenses, GitHub-only limits, and exact questions. Do not ask reviewers to infer runtime evidence from docs.
  Parallelization: Wave 2 | Blocked by: Todo 1 | Blocks: Todo 6, C001, C003
  References: `README.md`, `SPEC_WORK_STATUS.md`, `TRAINORACLE_SPEC_INDEX.md`, `SPEC_DOCUMENTATION_REPORT.md`
  Acceptance criteria: `SPEC_REVIEW_PACKET.md` exists, is non-empty, and contains sections for read order, reviewer lenses, known non-claims, GitHub-only limits, and review prompts.
  QA scenarios: PowerShell CLI auxiliary surface; `Select-String -LiteralPath SPEC_REVIEW_PACKET.md -Pattern ...`; Evidence `.omo/evidence/trainoracle-next-phase-c001-green.txt`
  Commit: N | user did not explicitly request commit in this turn

- [x] 3. Create target patch readiness doc
  What to do / Must NOT do: Add a readiness document that states source-to-target patch order, blockers, recount gates, and runtime evidence gates. Do not close issues or update counts.
  Parallelization: Wave 2 | Blocked by: Todo 1 | Blocks: Todo 5, Todo 6, C001, C002, C003
  References: `SPEC_TARGET_PATCH_MATRIX.md`, `specs/active/PLAN_GENERATOR_SPEC.md`, `specs/active/APP_IMPLEMENTATION_BRIDGE.md`, `specs/reconstruct/PLAN_SAFETY_GATE_SPEC.md`, `specs/reconstruct/RULE_VALIDATION_ENGINE_CONTRACT.md`
  Acceptance criteria: `SPEC_TARGET_PATCH_READINESS.md` exists, is non-empty, and contains target patch waves, blockers, no-closure gates, and evidence gates.
  QA scenarios: PowerShell CLI auxiliary surface; `Select-String -LiteralPath SPEC_TARGET_PATCH_READINESS.md -Pattern ...`; Evidence `.omo/evidence/trainoracle-next-phase-c001-green.txt`
  Commit: N | user did not explicitly request commit in this turn

- [x] 4. Update patch matrix stale next-work language
  What to do / Must NOT do: Replace stale "productization draft selection" language with "productization draft review/acceptance and target-patch readiness." Do not alter issue status, counts, or closure rules.
  Parallelization: Wave 3 | Blocked by: Todo 3 | Blocks: C002, C003
  References: `SPEC_TARGET_PATCH_MATRIX.md:165`, `SPEC_TARGET_PATCH_MATRIX.md:208`
  Acceptance criteria: no `productization draft selection` remains in `SPEC_TARGET_PATCH_MATRIX.md`; Wave 3 remains draft-for-review and no issue closure is claimed.
  QA scenarios: PowerShell CLI auxiliary surface; `Select-String -Pattern 'productization draft selection'` returns none; Evidence `.omo/evidence/trainoracle-next-phase-c002-guardrails.txt`
  Commit: N | user did not explicitly request commit in this turn

- [x] 5. Update reader-facing handoff links
  What to do / Must NOT do: Link the new review packet and readiness doc from top-level handoff docs. Do not change SPEC semantics.
  Parallelization: Wave 3 | Blocked by: Todos 2-3 | Blocks: C001, C003
  References: `README.md`, `SPEC_WORK_STATUS.md`, `TRAINORACLE_SPEC_INDEX.md`, `SPEC_DOCUMENTATION_REPORT.md`
  Acceptance criteria: the handoff docs point readers to `SPEC_REVIEW_PACKET.md` and `SPEC_TARGET_PATCH_READINESS.md`.
  QA scenarios: PowerShell CLI auxiliary surface; `Select-String` across handoff docs; Evidence `.omo/evidence/trainoracle-next-phase-c003-regression.txt`
  Commit: N | user did not explicitly request commit in this turn

- [x] 6. Run evidence checks and record ULW results
  What to do / Must NOT do: Run the three criteria checks, write artifacts, include cleanup receipts, and record evidence through ULW. Do not record pass from inference.
  Parallelization: Wave 4 | Blocked by: Todos 2-5 | Blocks: final report
  References: `.omo/ulw-loop/trainoracle-next-spec-review-20260707/goals.json`
  Acceptance criteria: C001 and C002 are pass; C003 pass if handoff links and final markers are intact.
  QA scenarios: PowerShell CLI auxiliary surface; evidence paths named above.
  Commit: N | user did not explicitly request commit in this turn

- [x] 7. Final self-review
  What to do / Must NOT do: Read diff and evidence, verify no forbidden claims, and record thread-limit reviewer blocker if external subagent review remains unavailable. Do not claim external reviewer approval if no reviewer ran.
  Parallelization: Final | Blocked by: Todo 6 | Blocks: final answer
  References: `git diff`, `.omo/evidence/trainoracle-next-phase-*.txt`
  Acceptance criteria: final review artifact exists and states pass/blocker status for reviewer availability.
  QA scenarios: PowerShell CLI auxiliary surface; `git diff --check`, targeted `Select-String`; Evidence `.omo/evidence/trainoracle-next-phase-final-review.txt`
  Commit: N | user did not explicitly request commit in this turn

## Final verification wave

- [x] F1. Plan compliance audit: confirm every requested deliverable exists or is explicitly blocked by environment, and all forbidden claims remain absent.
- [x] F2. Documentation quality review: confirm new docs are readable, linked, and scoped to review/readiness rather than semantic rule changes.
- [x] F3. Real manual QA for data-shaped surface: CLI evidence files exist, are non-empty, and include cleanup receipts.
- [x] F4. Scope fidelity: confirm no app/web implementation, issue closure, canonical promotion, runtime evidence claim, or D9 semantic redefinition was introduced.

## Commit strategy

The user did not explicitly request a commit in this turn. Leave changes unstaged and report the modified/untracked files. If the user asks to commit, use one docs commit in the repository's existing style, likely `docs(handoff): add TrainOracle next-phase review packet`, with footer:

```text
Plan: .omo/plans/trainoracle-next-spec-review-and-patch-plan.md
```

## Success criteria

- Reviewer-facing handoff exists and can be read from GitHub without private chat context.
- Target patch readiness order exists and preserves no-closure/no-runtime-evidence rules.
- Stale Wave 3 "selection" wording is updated to "review/acceptance and target-patch readiness."
- Adjacent handoff docs point to the new review/readiness documents.
- CLI evidence proves deliverables, guardrails, and handoff regression checks.
