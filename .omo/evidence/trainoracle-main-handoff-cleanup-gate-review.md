# TrainOracle Main Handoff Cleanup Gate Review

recommendation: REJECT

notepadPath: `.omo/evidence/trainoracle-main-handoff-cleanup-gate-review.md`

## originalIntent

Act as the final gate reviewer for the TrainOracle ulw-loop handoff cleanup. The underlying work was to execute `.omo/plans/trainoracle-main-handoff-cleanup.md` so GitHub `main` becomes self-contained for continuing incomplete TrainOracle SPEC work, without changing active SPEC semantics, reconstructing missing contracts, closing issues, or claiming runtime/canonical evidence.

## desiredOutcome

A GitHub-only worker should be able to open `origin/main`, find the SPEC start/status path immediately, see existing active SPEC candidates, see missing/source-not-verified contracts and the next production order, understand stale publish reports as historical, locate source files by repository path, and avoid false claims about runtime evidence, canonical promotion, issue closure, or D9 semantics.

## blockers

1. Required current-work review coverage is incomplete and unsupported. A cleanup code-review file appeared locally after the initial gate write, but it is untracked and does not clear this final gate:
   - `.omo/evidence/trainoracle-main-handoff-cleanup-code-review.md:10` recommends approval.
   - `.omo/evidence/trainoracle-main-handoff-cleanup-code-review.md:16-18` names `remove-ai-slops` and `programming`, but does not explicitly cover the full overfit/slop criteria required here, such as tautological documentation checks, implementation-mirroring checks, deletion-only/removal-only tests, or unnecessary extraction/parsing/normalization.
   - `.omo/evidence/trainoracle-main-handoff-cleanup-code-review.md:36-38` acknowledges the stale remote proof and stale draft status, then downgrades both to low/non-blocking.
   - `.omo/evidence/trainoracle-main-handoff-cleanup-code-review.md:63-65` says there are no blockers, but this is unsupported by the artifacts above and does not include a separate manual-QA matrix.
   - `git status -sb` shows this code-review report is untracked, so it is not part of the pushed `origin/main` cleanup commits.

   The earlier `remove-ai-slops` / `programming` review coverage I found is scoped to the inventory/readiness work unit, not this `trainoracle-main-handoff-cleanup` diff:
   - `.omo/evidence/trainoracle-review-coverage.md:5` says the scope is final-review coverage for the `.omo` inventory/readiness work unit.
   - `.omo/evidence/trainoracle-inventory-readiness-code-review.md:1` and `:5` identify the report as inventory readiness and list only the inventory/readiness artifact set.
   - `.omo/evidence/trainoracle-inventory-readiness-gate-review.md:44`, `:49`, and `:51` resolve slop/programming coverage for that prior scope.
   - No cleanup-specific manual-QA matrix or final reviewer approval artifact was present in `.omo/evidence` or `.omo/reports`.

2. Final evidence artifacts are stale relative to the final pushed commit. The current repository is at `83752ce46e441a9f7263a5df68fa99711a3b3b99`, but the committed final evidence was captured before the evidence commit:
   - `.omo/evidence/f1-trainoracle-main-handoff-cleanup-plan-compliance.txt:1-3` shows `f1` itself untracked and `HEAD -> main, origin/main` at `af6cd07`.
   - `.omo/evidence/f3-trainoracle-main-handoff-cleanup-remote-proof.txt:1-5` shows `f1`, `f2`, and `f3` untracked and `HEAD -> main, origin/main` at `af6cd07`.
   - Direct git verification now shows local `HEAD` and `origin/main` are `83752ce`, but the artifact set does not itself prove the final remote state after `83752ce`.

3. ULW/process state is not cleanly closed for this cleanup:
   - `.omo/ulw-loop/goals.json:14` keeps the cleanup goal at `"status": "pending"` while `.omo/ulw-loop/goals.json:23`, `:33`, and `:43` mark criteria pass.
   - `.omo/drafts/trainoracle-main-handoff-cleanup.md:3` and `:71-72` still say `status: awaiting-approval` and `recommended-next-action: execute the docs-only cleanup on main`, even though commits `af6cd07` and `83752ce` are pushed.
   - `.omo/ulw-loop/ledger.jsonl:7` records the planner validation subagent as inconclusive, not approval, and there is no current cleanup final-review artifact replacing that gap.

## userOutcomeReview

Direct review of the shipped docs supports most of the user-visible handoff outcome:

- `origin/main:README.md` first screen points SPEC continuation to `TRAINORACLE_SPEC_INDEX.md`, then `SPEC_WORK_STATUS.md`.
- `SPEC_WORK_STATUS.md` states the current incomplete SPEC contract-layer phase, lists active SPEC candidates, lists `RULE_VALIDATION_ENGINE_CONTRACT.md` and `PLAN_SAFETY_GATE_SPEC.md` as missing/source-not-verified, gives the next production order, and forbids runtime/canonical/issue-closure claims.
- `.omo/reports/github-publish-readiness.md:5-11` marks the old publish report as historical and superseded.
- `.omo/reports/trainoracle-reconstruction-readiness.md:7`, `:15`, and `:23` provide repository path mapping for active/test-package sources.
- `Test-Path specs/reconstruct/RULE_VALIDATION_ENGINE_CONTRACT.md` and `Test-Path specs/reconstruct/PLAN_SAFETY_GATE_SPEC.md` both returned `False`, so the cleanup did not create the missing contracts.
- `git diff --name-status 37f5e40..83752ce -- specs/active` returned no paths, so the cleanup did not touch active SPEC bodies.

However, the ULW evidence gate is not satisfied because the current cleanup lacks supported review/manual-QA coverage, its final evidence is stale relative to the final commit, and its durable state still says pending/awaiting approval.

## directSlopAndProgrammingPass

I loaded and applied `omo:remove-ai-slops` and `omo:programming` as review lenses. The cleanup diff is documentation/evidence only; `git diff --name-status 37f5e40..83752ce -- '*.py' '*.pyi' '*.rs' '*.ts' '*.tsx' '*.mts' '*.cts' '*.go'` returned no paths, so language-specific programming rules are not directly applicable.

For the slop/overfit pass, no deletion-only tests, production-code extraction, implementation-mirroring code tests, or unnecessary production parsing/normalization were present. The unresolved slop is evidence/process slop: stale final proof, stale draft state, and incomplete/unsupported scoped review coverage.

## checkedArtifactPaths

- `.omo/plans/trainoracle-main-handoff-cleanup.md`
- `README.md`
- `SPEC_WORK_STATUS.md`
- `TRAINORACLE_SPEC_INDEX.md`
- `specs/reconstruct/README.md`
- `.omo/reports/github-main-publish-complete.md`
- `.omo/reports/github-publish-readiness.md`
- `.omo/reports/trainoracle-reconstruction-readiness.md`
- `.omo/evidence/task-1-trainoracle-main-handoff-cleanup-red.txt`
- `.omo/evidence/task-2-trainoracle-main-handoff-cleanup-green.txt`
- `.omo/evidence/task-3-trainoracle-main-handoff-cleanup-green.txt`
- `.omo/evidence/task-4-trainoracle-main-handoff-cleanup-green.txt`
- `.omo/evidence/task-5-trainoracle-main-handoff-cleanup-green.txt`
- `.omo/evidence/task-6-trainoracle-main-handoff-cleanup-green.txt`
- `.omo/evidence/task-7-trainoracle-main-handoff-cleanup-green.txt`
- `.omo/evidence/task-8-trainoracle-main-handoff-cleanup-green.txt`
- `.omo/evidence/task-9-trainoracle-main-handoff-cleanup-precommit.txt`
- `.omo/evidence/f1-trainoracle-main-handoff-cleanup-plan-compliance.txt`
- `.omo/evidence/f2-trainoracle-main-handoff-cleanup-safety-audit.txt`
- `.omo/evidence/f3-trainoracle-main-handoff-cleanup-remote-proof.txt`
- `.omo/evidence/f4-trainoracle-main-handoff-cleanup-continuation-dry-run.txt`
- `.omo/ulw-loop/goals.json`
- `.omo/ulw-loop/ledger.jsonl`
- `.omo/drafts/trainoracle-main-handoff-cleanup.md`
- `.omo/evidence/trainoracle-review-coverage.md`
- `.omo/evidence/trainoracle-inventory-readiness-code-review.md`
- `.omo/evidence/trainoracle-inventory-readiness-gate-review.md`
- `.omo/evidence/trainoracle-main-handoff-cleanup-code-review.md`

## exactEvidenceGaps

- Cleanup-scoped code-review report is untracked and does not explicitly cover the full `remove-ai-slops` overfit/slop criteria required by this gate.
- Cleanup-scoped programming applicability review exists only as a terse statement and is not part of the pushed commits.
- Missing cleanup-scoped manual QA matrix or equivalent final reviewer report.
- Missing final remote proof captured after commit `83752ce`.
- Stale `.omo/ulw-loop/goals.json` goal status (`pending`) despite pass criteria.
- Stale `.omo/drafts/trainoracle-main-handoff-cleanup.md` status (`awaiting-approval`) despite pushed execution.
