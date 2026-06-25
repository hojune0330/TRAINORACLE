# trainoracle-main-handoff-cleanup - Work Plan

## TL;DR (For humans)
This is a documentation-only cleanup plan for the TrainOracle GitHub main branch. The goal is that someone can open GitHub, understand that the SPEC layer is still incomplete, see exactly which documents exist, see which contracts are missing, and continue the next SPEC-production step without relying on this chat history.

**What you'll get:** A clearer GitHub landing path, a one-page current SPEC work status, refreshed handoff reports, and evidence that the repository still does not overclaim runtime tests, canonical promotion, or issue closure.

**Why this approach:** Keep the existing SPEC documents stable, then improve the handoff layer around them. The repo already contains most of the raw material; the weak points are entrypoint clarity, stale publish-status wording, and old local-path references.

**What it will NOT do:** It will not reconstruct missing contracts, change D9/RVE semantics, close open issues, or claim runtime evidence that does not exist.

**Effort:** Medium
**Risk:** Medium - the content is documentation-only, but wrong wording could mislead future SPEC work around safety contracts.
**Decisions to sanity-check:** Work directly on `main`; add a root `SPEC_WORK_STATUS.md`; preserve historical `.omo` reports while marking stale state clearly.

Your next move: approve execution on `main`, or run a high-accuracy review of this plan first. Full execution detail follows below.

---

> TL;DR (machine): Medium docs-only main-branch handoff cleanup; produce GitHub-self-contained SPEC status, path mapping, stale-report corrections, and evidence without touching active SPEC semantics.

## Scope
### Must have
- Update the first-screen GitHub entrypoint so SPEC work starts at `TRAINORACLE_SPEC_INDEX.md`, with design/handoff docs clearly secondary.
- Add or equivalent-create a root `SPEC_WORK_STATUS.md` that answers:
  - what TrainOracle SPEC phase this repo is in;
  - which active SPEC docs are present;
  - which required contracts are missing or source-not-verified;
  - what the exact next production sequence is;
  - what must not be claimed yet.
- Preserve the existing active SPEC files under `specs/active/` without semantic changes.
- Preserve the test package as candidate-only evidence, not runtime PASS evidence.
- Refresh `.omo/reports/github-publish-readiness.md` so it no longer contradicts the already-pushed `main` state, or clearly label it as historical and add a current publish-complete report.
- Add repo-path mapping to `.omo/reports/trainoracle-reconstruction-readiness.md` so a GitHub-only worker can find sources under `specs/active/`, `specs/test-packages/`, and `specs/legacy-reference/`.
- Strengthen `specs/reconstruct/README.md` with a continuation checklist for `RULE_VALIDATION_ENGINE_CONTRACT.md` and `PLAN_SAFETY_GATE_SPEC.md`.
- Capture before/after evidence under `.omo/evidence/`.
- Keep all final markers and source-of-truth language consistent with the handoff policy.

### Must NOT have (guardrails, anti-slop, scope boundaries)
- Do not edit the semantics of `RULE_SPEC_D1_D9.md`, `PLAN_GENERATOR_SPEC.md`, `RVE_RULE_EVALUATOR_BINDING_SPEC.md`, or any active SPEC body.
- Do not create `RULE_VALIDATION_ENGINE_CONTRACT.md` or `PLAN_SAFETY_GATE_SPEC.md` in this cleanup pass.
- Do not claim `RULE_VALIDATION_ENGINE_CONTRACT.md` exists unless it is actually present in the repository.
- Do not treat `11_API_AND_ENGINE_CONTRACTS.md` as the missing RVE contract.
- Do not close `OI-RVE-RULE-EVALUATOR-BINDING-001`, `OI-PG-RULE-SAFETY-GATE-BINDING-001`, or any physio downstream issue.
- Do not say the D9 evaluator test package has passed runtime execution.
- Do not use absolute issue/test count changes unless the target file is opened and recounted during execution.
- Do not remove legacy references or quarantine candidates as part of this cleanup unless the user explicitly asks.
- Do not add raw athlete free-text, symptom clauses, or evidence clauses to any audit/storage examples.

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: failing-first document QA, then tests-after. There is no app runtime to test in this pass.
- Primary proof channel: Git Bash/PowerShell document assertions, `git diff --check`, remote `origin/main` reads after push.
- Evidence naming: `.omo/evidence/task-<N>-trainoracle-main-handoff-cleanup-<red|green>.txt`.
- Do not use Markdown self-check language as runtime evidence. Any "PASS" in evidence files must be scoped to documentation checks only.
- For line-sensitive checks, use `grep -n`, `sed -n`, or PowerShell `Select-String` and save output.
- For remote proof after execution, run `git fetch origin main` and inspect `origin/main` content, not only the local worktree.

## Execution strategy
### Parallel execution waves
> Target 5-8 todos per wave. Fewer than 3 (except the final) means you under-split.
- Wave 0, proof first: capture current handoff gaps before editing.
- Wave 1, entrypoint and status: update README, create root status, link the index.
- Wave 2, continuity reports: fix stale publish wording, add repo-path mapping, strengthen reconstruct README.
- Wave 3, evidence and final polish: run false-claim scans, whitespace checks, remote main verification, commit/push if approved.

### Dependency matrix
| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| 1 | none | 2, 3, 4, 5, 6 | none |
| 2 | 1 | 3, 8 | none |
| 3 | 1, 2 | 6, 8 | 4, 5 |
| 4 | 1 | 7, 8 | 3, 5, 6 |
| 5 | 1 | 7, 8 | 3, 4, 6 |
| 6 | 1, 3 | 7, 8 | 4, 5 |
| 7 | 3, 4, 5, 6 | 8, 9 | none |
| 8 | 2, 3, 4, 5, 6, 7 | 9 | none |
| 9 | 8 | final verification | none |

## Todos
> Implementation + Test = ONE todo. Never separate.
<!-- APPEND TASK BATCHES BELOW THIS LINE WITH edit/apply_patch - never rewrite the headers above. -->
- [ ] 1. Capture the current GitHub-main handoff gaps as RED evidence.
  What to do / Must NOT do: Before editing, record the exact current contradictions and missing handoff surfaces. Do not change files in this todo.
  Parallelization: Wave 0 | Blocked by: none | Blocks: 2, 3, 4, 5, 6
  References: `README.md:1-4`, `README.md:120`, `.omo/reports/github-publish-readiness.md:5-15`, `.omo/reports/trainoracle-reconstruction-readiness.md`, `TRAINORACLE_SPEC_INDEX.md:93-136`, `specs/reconstruct/README.md:1-35`
  Acceptance criteria (agent-executable):
  ```bash
  mkdir -p .omo/evidence
  {
    echo "RED1 README first-screen entrypoint"
    sed -n '1,24p' README.md
    echo
    echo "README later SPEC pointer"
    grep -n "TRAINORACLE_SPEC_INDEX.md" README.md || true
    echo
    echo "RED2 stale publish readiness"
    sed -n '1,80p' .omo/reports/github-publish-readiness.md
    echo
    echo "RED3 missing repo path mapping"
    grep -nE "specs/active/RULE_SPEC_D1_D9.md|Repository path mapping" .omo/reports/trainoracle-reconstruction-readiness.md || true
    echo
    echo "RED4 root status doc"
    test -f SPEC_WORK_STATUS.md && echo "exists" || echo "missing"
  } > .omo/evidence/task-1-trainoracle-main-handoff-cleanup-red.txt
  ```
  QA scenarios: happy is evidence file showing the current gaps; failure is any command error or missing cited file. Use `mcp__git_bash.run` preferred on Windows.
  Commit: N | evidence only, included in final docs commit if execution proceeds.

- [ ] 2. Make the README entrypoint unambiguous.
  What to do / Must NOT do: Change the top of `README.md` so SPEC work starts at `TRAINORACLE_SPEC_INDEX.md`. Keep design and philosophy documents visible, but mark them as supporting context. Do not remove design links or imply design docs are the SPEC source of truth.
  Parallelization: Wave 1 | Blocked by: 1 | Blocks: 3, 8
  References: `README.md:1-4`, `README.md:120`, `TRAINORACLE_SPEC_INDEX.md:1-30`, `specs/README.md:1-21`
  Acceptance criteria (agent-executable):
  ```bash
  {
    echo "README entrypoint after edit"
    sed -n '1,36p' README.md
    echo
    grep -n "TRAINORACLE_SPEC_INDEX.md" README.md
    grep -n "SPEC" README.md | head -20
  } > .omo/evidence/task-2-trainoracle-main-handoff-cleanup-green.txt
  ```
  The first 36 lines must tell a GitHub reader to start with `TRAINORACLE_SPEC_INDEX.md` for SPEC continuation.
  QA scenarios: happy is clear first-screen route; failure is any remaining first-screen text that makes `HANDOFF.md` or `PHILOSOPHY.md` sound like the primary SPEC source.
  Commit: Y | `docs(handoff): clarify TrainOracle SPEC entrypoint`

- [ ] 3. Add a root current-status document for the incomplete SPEC phase.
  What to do / Must NOT do: Create `SPEC_WORK_STATUS.md` as a one-page live handoff. It should be readable without chat history and should link to the index, active specs, test package, reconstruct README, and key `.omo` reports/evidence. It must explicitly say this is not canonical promotion, not a runtime-tested application, and not a completed SPEC layer.
  Parallelization: Wave 1 | Blocked by: 1, 2 | Blocks: 6, 8
  References: `TRAINORACLE_SPEC_INDEX.md:1-136`, `specs/README.md:1-60`, `.omo/evidence/trainoracle-remaining-work-flow-reference.md`, `.omo/reports/trainoracle-reconstruction-readiness.md`, user handoff policy captured in this plan draft
  Required sections:
  - "Current Phase"
  - "What Exists In This Repo"
  - "Missing Or Source-Not-Verified Contracts"
  - "Next SPEC Production Order"
  - "Hard Guardrails"
  - "Evidence Status"
  - "What To Read First"
  Acceptance criteria (agent-executable):
  ```bash
  {
    test -f SPEC_WORK_STATUS.md
    sed -n '1,220p' SPEC_WORK_STATUS.md
    grep -n "RULE_VALIDATION_ENGINE_CONTRACT.md" SPEC_WORK_STATUS.md
    grep -n "PLAN_SAFETY_GATE_SPEC.md" SPEC_WORK_STATUS.md
    grep -nE "not runtime evidence|runtime evidence.*missing|actual runtime" SPEC_WORK_STATUS.md
    grep -nE "do not close|Do not close|issue closure" SPEC_WORK_STATUS.md
  } > .omo/evidence/task-3-trainoracle-main-handoff-cleanup-green.txt
  ```
  QA scenarios: happy is a status doc that answers "what next?" from GitHub alone; failure is any wording that suggests missing contracts are restored, approved, or ready for canonical promotion.
  Commit: Y | `docs(handoff): add current SPEC work status`

- [ ] 4. Refresh the GitHub publish-state report without erasing history.
  What to do / Must NOT do: Update `.omo/reports/github-publish-readiness.md` so stale claims are labeled historical, or create `.omo/reports/github-main-publish-complete.md` and link it from the stale report. Do not pretend the old pre-publish state is current. Do not delete the report unless the user explicitly asks.
  Parallelization: Wave 2 | Blocked by: 1 | Blocks: 7, 8
  References: `.omo/reports/github-publish-readiness.md:1-120`, `git status -sb`, `git log --oneline --decorate -5`, `README.md`, `TRAINORACLE_SPEC_INDEX.md`
  Acceptance criteria (agent-executable):
  ```bash
  {
    echo "git state"
    git status -sb
    git log --oneline --decorate -5
    echo
    echo "publish readiness current labels"
    grep -nE "historical|superseded|main publish complete|origin/main" .omo/reports/github-publish-readiness.md
    test -f .omo/reports/github-main-publish-complete.md && sed -n '1,180p' .omo/reports/github-main-publish-complete.md || true
  } > .omo/evidence/task-4-trainoracle-main-handoff-cleanup-green.txt
  ```
  QA scenarios: happy is no unqualified "not pushed" or old-branch blocker language left as current state; failure is future worker seeing a false blocker after reading only this report.
  Commit: Y | `docs(handoff): record main publish completion state`

- [ ] 5. Add repository-path mapping to the reconstruction readiness report.
  What to do / Must NOT do: Add a prominent section near the top of `.omo/reports/trainoracle-reconstruction-readiness.md` that maps old local source paths to repository paths. Keep old paths only as provenance, not required continuation paths. Do not alter the reconstruction contract content itself.
  Parallelization: Wave 2 | Blocked by: 1 | Blocks: 7, 8
  References: `.omo/reports/trainoracle-reconstruction-readiness.md`, `specs/active/RULE_SPEC_D1_D9.md`, `specs/active/APP_IMPLEMENTATION_BRIDGE.md`, `specs/active/RVE_RULE_EVALUATOR_BINDING_SPEC.md`, `specs/test-packages/D9_SAFETY_EVALUATOR_V2_1_1_TEST_PACKAGE.md`, `specs/legacy-reference/11_API_AND_ENGINE_CONTRACTS.md`
  Minimum mapping:
  - `RULE_SPEC_D1_D9.md` -> `specs/active/RULE_SPEC_D1_D9.md`
  - `SESSION_CLASSIFIER_SPEC.md` -> `specs/active/SESSION_CLASSIFIER_SPEC.md`
  - `ATHLETE_PROFILE_SPEC.md` -> `specs/active/ATHLETE_PROFILE_SPEC.md`
  - `APP_IMPLEMENTATION_BRIDGE.md` -> `specs/active/APP_IMPLEMENTATION_BRIDGE.md`
  - `PLAN_GENERATOR_SPEC.md` -> `specs/active/PLAN_GENERATOR_SPEC.md`
  - `TEMPLATE_LIBRARY_SPEC.md` -> `specs/active/TEMPLATE_LIBRARY_SPEC.md`
  - `PHYSIO_SOURCE_TRUST_SPEC.md` -> `specs/active/PHYSIO_SOURCE_TRUST_SPEC.md`
  - `RVE_RULE_EVALUATOR_BINDING_SPEC.md` -> `specs/active/RVE_RULE_EVALUATOR_BINDING_SPEC.md`
  - `D9_SAFETY_EVALUATOR_V2_1_1_TEST_PACKAGE.md` -> `specs/test-packages/D9_SAFETY_EVALUATOR_V2_1_1_TEST_PACKAGE.md`
  Acceptance criteria (agent-executable):
  ```bash
  {
    grep -nE "Repository path mapping|GitHub path mapping|repo path" .omo/reports/trainoracle-reconstruction-readiness.md
    grep -n "specs/active/RULE_SPEC_D1_D9.md" .omo/reports/trainoracle-reconstruction-readiness.md
    grep -n "specs/test-packages/D9_SAFETY_EVALUATOR_V2_1_1_TEST_PACKAGE.md" .omo/reports/trainoracle-reconstruction-readiness.md
    sed -n '1,120p' .omo/reports/trainoracle-reconstruction-readiness.md
  } > .omo/evidence/task-5-trainoracle-main-handoff-cleanup-green.txt
  ```
  QA scenarios: happy is a GitHub-only worker can locate every referenced source; failure is a required source existing only as a `D:\admin\Downloads\...` path.
  Commit: Y | `docs(handoff): map reconstruction sources to repo paths`

- [ ] 6. Strengthen the reconstruct-folder continuation checklist.
  What to do / Must NOT do: Update `specs/reconstruct/README.md` with a step-by-step next SPEC production checklist. It must say: search first, reconstruct only if absent, mark reconstructed drafts as `RECONSTRUCTED_DRAFT_FOR_REVIEW`, and do not close issues or claim runtime evidence. Do not add the missing documents yet.
  Parallelization: Wave 2 | Blocked by: 1, 3 | Blocks: 7, 8
  References: `specs/reconstruct/README.md:1-60`, `TRAINORACLE_SPEC_INDEX.md:93-136`, `.omo/reports/trainoracle-reconstruction-readiness.md`, `.omo/evidence/trainoracle-remaining-work-flow-reference.md`
  Acceptance criteria (agent-executable):
  ```bash
  {
    sed -n '1,220p' specs/reconstruct/README.md
    grep -n "RECONSTRUCTED_DRAFT_FOR_REVIEW" specs/reconstruct/README.md
    grep -nE "search|find" specs/reconstruct/README.md
    grep -nE "do not close|runtime evidence|canonical" specs/reconstruct/README.md
  } > .omo/evidence/task-6-trainoracle-main-handoff-cleanup-green.txt
  ```
  QA scenarios: happy is a worker can start the missing contract phase from this folder; failure is checklist wording that makes reconstruction sound completed or approved.
  Commit: Y | `docs(specs): clarify reconstruct workflow`

- [ ] 7. Add final cross-links from the index/status surface to the execution evidence.
  What to do / Must NOT do: Link `SPEC_WORK_STATUS.md` from `README.md` and `TRAINORACLE_SPEC_INDEX.md`. Link the reconstruct readiness report and remaining-work evidence from `SPEC_WORK_STATUS.md`. Do not create a circular maze of every `.omo` file; link only the documents a future worker needs.
  Parallelization: Wave 3 | Blocked by: 3, 4, 5, 6 | Blocks: 8, 9
  References: `README.md`, `TRAINORACLE_SPEC_INDEX.md`, `SPEC_WORK_STATUS.md`, `.omo/evidence/trainoracle-remaining-work-flow-reference.md`, `.omo/reports/trainoracle-reconstruction-readiness.md`
  Acceptance criteria (agent-executable):
  ```bash
  {
    grep -n "SPEC_WORK_STATUS.md" README.md TRAINORACLE_SPEC_INDEX.md
    grep -n "trainoracle-reconstruction-readiness.md" SPEC_WORK_STATUS.md
    grep -n "trainoracle-remaining-work-flow-reference.md" SPEC_WORK_STATUS.md
  } > .omo/evidence/task-7-trainoracle-main-handoff-cleanup-green.txt
  ```
  QA scenarios: happy is the reader path is README -> index/status -> reconstruct workflow; failure is the root status doc existing but not discoverable from the main entrypoint.
  Commit: Y | `docs(handoff): connect status and evidence references`

- [ ] 8. Run safety, false-claim, and formatting checks on touched documents.
  What to do / Must NOT do: Scan for forbidden overclaims and stale statements in touched files. Do not run broad mechanical formatting over copied SPEC sources. Fix only handoff docs touched in this plan.
  Parallelization: Wave 3 | Blocked by: 2, 3, 4, 5, 6, 7 | Blocks: 9
  References: handoff policy in this plan, user source-of-truth rules, `TRAINORACLE_SPEC_INDEX.md:107-136`
  Acceptance criteria (agent-executable):
  ```bash
  {
    echo "Forbidden overclaim scan"
    grep -RInE "runtime PASS|runtime passed|canonical promotion complete|issue closed|RULE_VALIDATION_ENGINE_CONTRACT.md exists|medical clearance" README.md SPEC_WORK_STATUS.md TRAINORACLE_SPEC_INDEX.md specs/reconstruct .omo/reports || true
    echo
    echo "Required caution terms"
    grep -RInE "not runtime evidence|runtime evidence.*missing|not canonical|do not close|RECONSTRUCTED_DRAFT_FOR_REVIEW" README.md SPEC_WORK_STATUS.md TRAINORACLE_SPEC_INDEX.md specs/reconstruct .omo/reports | head -80
    echo
    echo "Diff whitespace check"
    git diff --check -- README.md TRAINORACLE_SPEC_INDEX.md SPEC_WORK_STATUS.md specs/reconstruct/README.md .omo/reports/github-publish-readiness.md .omo/reports/github-main-publish-complete.md .omo/reports/trainoracle-reconstruction-readiness.md .omo/evidence || true
  } > .omo/evidence/task-8-trainoracle-main-handoff-cleanup-green.txt
  ```
  After reviewing the scan, remove or qualify any forbidden overclaims. If `git diff --check` reports only files not touched by this plan, record that; otherwise fix touched docs.
  QA scenarios: happy is no unqualified false claim in touched docs; failure is a future worker could reasonably think missing contracts exist, D9 runtime tests passed, or issues were closed.
  Commit: Y | `docs(handoff): verify safety wording`

- [ ] 9. Commit and push the docs-only handoff cleanup to main.
  What to do / Must NOT do: Stage only files touched by this cleanup, commit with an explicit message, and push `main`. Do not stage unrelated generated files or ignored local cache files. Do not rewrite history.
  Parallelization: Wave 3 | Blocked by: 8 | Blocks: final verification
  References: `git status -sb`, `git diff --stat`, prior user instruction to work on `main`
  Acceptance criteria (agent-executable):
  ```bash
  {
    git status -sb
    git diff --stat
    git diff -- README.md TRAINORACLE_SPEC_INDEX.md SPEC_WORK_STATUS.md specs/reconstruct/README.md .omo/reports .omo/evidence | sed -n '1,260p'
  } > .omo/evidence/task-9-trainoracle-main-handoff-cleanup-precommit.txt
  ```
  Commit command:
  ```bash
  git add README.md TRAINORACLE_SPEC_INDEX.md SPEC_WORK_STATUS.md specs/reconstruct/README.md .omo/reports .omo/evidence
  git commit -m "docs(handoff): make TrainOracle SPEC status self-contained"
  git push origin main
  ```
  QA scenarios: happy is `git status -sb` clean after push and `main...origin/main` synchronized; failure is untracked/unstaged handoff docs, unrelated files staged, or push rejected.
  Commit: Y | `docs(handoff): make TrainOracle SPEC status self-contained`

## Final verification wave
> Runs in parallel after ALL todos. ALL must APPROVE. Surface results and wait for the user's explicit okay before declaring complete.
- [ ] F1. Plan compliance audit
  Verify every Must have is represented in the final diff and every Must NOT remains absent. Evidence: `.omo/evidence/f1-trainoracle-main-handoff-cleanup-plan-compliance.txt`.
  ```bash
  {
    git status -sb
    git log --oneline --decorate -3
    grep -n "TRAINORACLE_SPEC_INDEX.md" README.md
    test -f SPEC_WORK_STATUS.md
    grep -n "RULE_VALIDATION_ENGINE_CONTRACT.md" SPEC_WORK_STATUS.md specs/reconstruct/README.md
    grep -n "PLAN_SAFETY_GATE_SPEC.md" SPEC_WORK_STATUS.md specs/reconstruct/README.md
  } > .omo/evidence/f1-trainoracle-main-handoff-cleanup-plan-compliance.txt
  ```

- [ ] F2. Source-of-truth and safety wording audit
  Verify touched docs preserve "local/repo files are truth", "no runtime evidence", "no canonical promotion", and D9 guardrails. Evidence: `.omo/evidence/f2-trainoracle-main-handoff-cleanup-safety-audit.txt`.
  ```bash
  {
    grep -RInE "local.*truth|repo.*truth|not runtime evidence|not canonical|D9_ACTIVE|D9_UNKNOWN|D9_CLEARED|ADVISORY" README.md TRAINORACLE_SPEC_INDEX.md SPEC_WORK_STATUS.md specs/reconstruct .omo/reports | head -120
    grep -RInE "medical clearance|fourth disposition|runtime PASS|issue closed" README.md TRAINORACLE_SPEC_INDEX.md SPEC_WORK_STATUS.md specs/reconstruct .omo/reports || true
  } > .omo/evidence/f2-trainoracle-main-handoff-cleanup-safety-audit.txt
  ```

- [ ] F3. GitHub-main remote proof
  Verify the pushed branch, not only local files, contains the corrected handoff. Evidence: `.omo/evidence/f3-trainoracle-main-handoff-cleanup-remote-proof.txt`.
  ```bash
  {
    git fetch origin main
    git status -sb
    git log --oneline --decorate -3 origin/main
    git show origin/main:README.md | sed -n '1,40p'
    git show origin/main:SPEC_WORK_STATUS.md | sed -n '1,120p'
    git show origin/main:TRAINORACLE_SPEC_INDEX.md | grep -nE "SPEC_WORK_STATUS.md|RULE_VALIDATION_ENGINE_CONTRACT.md|PLAN_SAFETY_GATE_SPEC.md" || true
  } > .omo/evidence/f3-trainoracle-main-handoff-cleanup-remote-proof.txt
  ```

- [ ] F4. Human-continuation dry run
  Simulate a new worker reading only GitHub files. The answer must be obtainable without chat history: what exists, what is missing, what to do next, what not to claim. Evidence: `.omo/evidence/f4-trainoracle-main-handoff-cleanup-continuation-dry-run.txt`.
  ```bash
  {
    echo "Question: What file should I read first?"
    grep -nE "TRAINORACLE_SPEC_INDEX.md|SPEC_WORK_STATUS.md" README.md
    echo
    echo "Question: Which contracts are missing or source-not-verified?"
    grep -nE "RULE_VALIDATION_ENGINE_CONTRACT.md|PLAN_SAFETY_GATE_SPEC.md" SPEC_WORK_STATUS.md TRAINORACLE_SPEC_INDEX.md specs/reconstruct/README.md
    echo
    echo "Question: What is the next production order?"
    grep -nE "Next SPEC Production Order|reconstruct" SPEC_WORK_STATUS.md specs/reconstruct/README.md
    echo
    echo "Question: What must not be claimed?"
    grep -nE "not runtime evidence|not canonical|do not close|must not" SPEC_WORK_STATUS.md specs/reconstruct/README.md TRAINORACLE_SPEC_INDEX.md
  } > .omo/evidence/f4-trainoracle-main-handoff-cleanup-continuation-dry-run.txt
  ```

## Commit strategy
- One docs-only commit on `main` after all todos pass.
- Suggested message: `docs(handoff): make TrainOracle SPEC status self-contained`
- Stage intentionally:
  ```bash
  git add README.md TRAINORACLE_SPEC_INDEX.md SPEC_WORK_STATUS.md specs/reconstruct/README.md .omo/reports .omo/evidence
  ```
- Do not stage `.codegraph/`, ignored snapshots, local cache files, or unrelated design/spec changes.
- Push:
  ```bash
  git push origin main
  ```
- Final response after execution should include the commit hash, pushed branch, changed files, and the evidence files that prove the GitHub handoff is self-contained.

## Success criteria
- A new reader on GitHub can identify the SPEC starting point within the first screen of the README.
- A new reader can understand that TrainOracle is in an incomplete SPEC contract-layer phase, not a finished app or canonical release.
- The repo visibly lists active SPEC files, test package status, legacy references, and missing/reconstruct targets.
- The next work order is explicit: inventory, reconstruct `RULE_VALIDATION_ENGINE_CONTRACT.md` if absent, reconstruct `PLAN_SAFETY_GATE_SPEC.md` if absent, then downstream physio/runtime/binding work.
- Stale pre-publish wording no longer contradicts the fact that content is already on `main`.
- Old local source paths no longer block GitHub-only continuation.
- No false runtime evidence, no issue closure, no canonical promotion, and no D9 semantic reinterpretation is introduced.
- Final pushed `origin/main` contains the cleanup and the local worktree is clean except ignored local caches.
