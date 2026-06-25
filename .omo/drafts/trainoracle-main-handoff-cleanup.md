---
slug: trainoracle-main-handoff-cleanup
status: executed-pushed-final-review-fixes-applied
intent: clear
pending-action: final gate re-review after blocker fixes
approach: docs-only main-branch handoff cleanup; make GitHub self-contained for continuing incomplete TrainOracle SPEC work without changing active SPEC semantics
---

# Draft: trainoracle-main-handoff-cleanup

## Components (topology ledger)
| id | outcome | status | evidence path |
| --- | --- | --- | --- |
| C1 | Main README has one unambiguous SPEC starting point, then points to design/supporting handoff docs. | active | `README.md` |
| C2 | Root-level current work status makes incomplete SPEC phase, missing documents, and next production order visible from GitHub alone. | active | `SPEC_WORK_STATUS.md` |
| C3 | Reconstruction readiness report maps old local source paths to repo paths so a GitHub-only worker is not stranded on `D:\admin\Downloads\...`. | active | `.omo/reports/trainoracle-reconstruction-readiness.md` |
| C4 | GitHub publish readiness history no longer contradicts the current main-branch state. | active | `.omo/reports/github-publish-readiness.md`, `.omo/reports/github-main-publish-complete.md` |
| C5 | Reconstruct folder and index preserve the hard guardrails: no runtime PASS claim, no issue closure, no canonical promotion, no D9 semantic rewrite. | active | `TRAINORACLE_SPEC_INDEX.md`, `specs/reconstruct/README.md` |
| C6 | Final evidence proves that main is self-contained, clean, and still only claims document handoff readiness. | active | `.omo/evidence/*trainoracle-main-handoff-cleanup*` |

## Open assumptions (announced defaults)
| assumption | adopted default | rationale | reversible? |
| --- | --- | --- | --- |
| Branching | Work directly on `main` when execution is approved. | User explicitly said all work starts on main for now. | Yes, but requires user redirect. |
| Product scope | This pass is documentation/handoff cleanup only. | User asked whether GitHub clearly contains the work and next SPEC process; missing contracts are a later production phase. | Yes. |
| Historical reports | Preserve historical `.omo` reports, but mark/update stale ones instead of deleting them. | They are useful process evidence, but must not confuse future workers. | Yes. |
| New status doc | Add a root `SPEC_WORK_STATUS.md`. | It compensates for the terse landed commit message and gives GitHub visitors a one-page live handoff. | Yes, filename can be changed before execution. |
| Counts | Do not invent or update absolute issue/test counts unless the target file is opened and recounted during execution. | Matches the TrainOracle source-of-truth policy. | No, this is a hard guardrail. |

## Findings (cited - path:lines)
- `README.md:1-4` currently tells readers to start with `HANDOFF.md` and `PHILOSOPHY.md`, while `README.md:120` says SPEC workers should read `TRAINORACLE_SPEC_INDEX.md` first. This creates a first-screen entrypoint conflict.
- `TRAINORACLE_SPEC_INDEX.md:1-13` has useful metadata and `TRAINORACLE_SPEC_INDEX.md:93-95` lists missing/source-not-verified contracts, including `RULE_VALIDATION_ENGINE_CONTRACT.md` and `PLAN_SAFETY_GATE_SPEC.md`.
- `TRAINORACLE_SPEC_INDEX.md:129-136` already gives the correct next-work order: inventory, reconstruct RVE contract, reconstruct Safety Gate, then downstream patches/runtime evidence.
- `specs/README.md:5-21` correctly routes readers to the index and warns that the repo is not canonical promotion or runtime evidence.
- `specs/reconstruct/README.md:1-35` correctly identifies missing reconstruction targets and the no-approval/no-issue-closure rules, but it can be strengthened with a GitHub-main execution checklist.
- `.omo/reports/trainoracle-reconstruction-readiness.md` is useful, but its source references still point mainly to old local paths under `D:\admin\Downloads\정본 제작 1차\...`; GitHub-only continuation needs repo-path mapping.
- `.omo/reports/github-publish-readiness.md:5-15` is stale after the GitHub upload because it says no commit/push occurred and refers to the old handoff branch. Current local state shows `main...origin/main` clean at commit `37f5e40 Add`.
- `.omo/evidence/trainoracle-remaining-work-flow-reference.md` already captures the correct incomplete-SPEC continuation sequence and should be linked from the new status surface.
- The active SPEC files are present under `specs/active/`; test package is under `specs/test-packages/`; legacy references are under `specs/legacy-reference/`; missing contracts are represented only by `specs/reconstruct/README.md`.

## Decisions (with rationale)
- Create a concise root status document instead of burying the next-work state only under `.omo/`. Rationale: a GitHub visitor should not need to know OMO internals to understand the project state.
- Keep `TRAINORACLE_SPEC_INDEX.md` as the canonical document index. Rationale: it already expresses the core source-of-truth and safety invariants.
- Do not reconstruct `RULE_VALIDATION_ENGINE_CONTRACT.md` or `PLAN_SAFETY_GATE_SPEC.md` in this cleanup. Rationale: the user asked for plan/review of GitHub continuity, and reconstruction changes the actual SPEC layer.
- Treat stale reports as historical process artifacts and add/update current-state notes. Rationale: deletion loses useful history; unmarked stale content creates false blockers.
- Use failing-first document checks before editing. Rationale: this is a docs-only task, but the same discipline applies: prove the handoff gap exists, then prove it is closed.

## Scope IN
- `README.md` first-screen entrypoint correction.
- New root `SPEC_WORK_STATUS.md` or equivalent one-page live status document.
- Cross-links among `README.md`, `TRAINORACLE_SPEC_INDEX.md`, `specs/README.md`, `specs/reconstruct/README.md`, and key `.omo` evidence/report files.
- `.omo/reports/trainoracle-reconstruction-readiness.md` repository-path mapping.
- `.omo/reports/github-publish-readiness.md` stale-state correction or historical labeling.
- Optional new `.omo/reports/github-main-publish-complete.md` with current main-branch state.
- Evidence files under `.omo/evidence/` proving the before/after handoff state.

## Scope OUT (Must NOT have)
- No active SPEC semantic edits.
- No reconstruction of missing contracts in this cleanup pass.
- No issue closure, canonical promotion, or runtime PASS claims.
- No D9/RVE disposition reinterpretation.
- No claims that `11_API_AND_ENGINE_CONTRACTS.md` is `RULE_VALIDATION_ENGINE_CONTRACT.md`.
- No absolute downstream count updates from memory.
- No deletion of legacy/reference/spec files.
- No raw athlete free-text, symptom clause, or evidence clause examples added to audit contracts.

## Open questions
- None blocking. The only meaningful execution choice is whether to run directly on `main` now, or run an optional high-accuracy review before touching the docs.

## Approval gate
status: executed-pushed-final-review-fixes-applied
executed_commits:
- `af6cd07` docs(handoff): make TrainOracle SPEC status self-contained
- `83752ce` docs(handoff): add TrainOracle verification evidence
review_status:
- QA reviewer approved the evidence matrix.
- Code/document reviewer approved with no blockers.
- Gate reviewer rejected iteration 1 on evidence/process drift; fixes are applied in this draft and companion evidence artifacts for re-review.
