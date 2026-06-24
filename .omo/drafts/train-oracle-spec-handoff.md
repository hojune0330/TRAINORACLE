---
slug: train-oracle-spec-handoff
status: inventory_readiness_complete
intent: clear
pending-action: next execution should create or update TRAINORACLE_SPEC_INDEX.md / SPEC_REGISTRY.md before reconstructing missing RULE_VALIDATION_ENGINE_CONTRACT.md and PLAN_SAFETY_GATE_SPEC.md
approach: evidence-first TrainOracle SPEC handoff; inventory local files before reconstruction, keep conversation ledger as reference only
---

# Draft: train-oracle-spec-handoff

## Ulw Bootstrap

- Skills used:
  - `omo:ulw-plan`: user explicitly invoked planning-only handoff mode; no implementation or product SPEC edits should start until the user explicitly starts execution.
- Tier:
  - Current turn: LIGHT, because the work is handoff preparation under `.omo/` only, with no product document reconstruction or SPEC patch yet.
  - Future execution: HEAVY once reconstruction/patching starts, because it touches architecture-scale safety contracts, D9/RVE/Plan Generator binding, privacy, consent, and runtime evidence.
- Binding success criteria for this prep stage:
  - The handoff policy, document classes, missing-contract order, and hard safety rules are recorded in a durable `.omo` draft.
  - Local search evidence is captured for the two required missing contract filenames before calling them missing in the handoff context.
  - Reconstruction, issue closure, and runtime-test claims remain explicitly deferred.

## Components (topology ledger)
<!-- Lock the SHAPE before depth. One row per top-level component that can succeed or fail independently. -->
<!-- id | outcome (one line) | status: active|deferred | evidence path -->

| id | outcome (one line) | status | evidence path |
| --- | --- | --- | --- |
| C1 | Confirmed local file inventory and duplicate/quarantine classification | complete | `.omo/evidence/trainoracle-confirmed-inventory.md`, `.omo/evidence/trainoracle-missing-quarantine.md` |
| C2 | Missing `RULE_VALIDATION_ENGINE_CONTRACT.md` handling without confusing it with `11_API_AND_ENGINE_CONTRACTS.md` | ready-for-reconstruction | `.omo/evidence/trainoracle-missing-quarantine.md`, `.omo/reports/trainoracle-reconstruction-readiness.md` |
| C3 | Missing or absent `PLAN_SAFETY_GATE_SPEC.md` handling before reconstruction | ready-for-reconstruction | `.omo/evidence/trainoracle-missing-quarantine.md`, `.omo/reports/trainoracle-reconstruction-readiness.md` |
| C4 | Physio source trust consumption patches for Plan Generator / App Bridge / Athlete Profile | deferred | user handoff 2026-06-24, to be verified against target files before edits |
| C5 | D9 evaluator runtime evidence phase | deferred | `D:/admin/Downloads/정본 제작 1차/D9_SAFETY_EVALUATOR_V2_1_1_TEST_PACKAGE.md` must be executed before evidence claims |
| C6 | Final binding patches across RVE, Safety Gate, and Plan Generator | deferred | gated on accepted specs plus actual D9 evaluator runtime evidence |
| C7 | Model belief/reference inputs from Claude Opus 4.8 and GPT-5.5 Pro | active-reference | `.omo/evidence/model-belief-files-train-oracle-spec-handoff.md` |
| C8 | Spec index/registry and remaining-work ordering | ready-for-index | `.omo/evidence/trainoracle-remaining-work-flow-reference.md` |

## Open assumptions (announced defaults)
<!-- Record any default you adopt instead of asking, so the user can veto it at the gate. -->
<!-- assumption | adopted default | rationale | reversible? -->

| assumption | adopted default | rationale | reversible? |
| --- | --- | --- | --- |
| Source of truth | Local files are truth; conversation ledger is reference only | User supplied this as the highest-priority handoff policy, and it matches the project risk of multiple duplicate versions | Yes |
| Counts and issue status | Do not apply absolute counts from memory; open target file and recount first | User explicitly forbids unverified absolute downstream counts | Yes |
| Runtime evidence | Markdown PASS/self-check is not runtime evidence | User explicitly says D9 test package is a candidate, not proof | No for issue closure |
| Plan Generator baseline | Treat the user-supplied 7/2 status as a reference claim until verified in the local file | The handoff says 6/1 Plan Generator may be duplicate/stale | Yes |
| Missing contracts | Treat missing-contract reconstruction as deferred until inventory/search is complete | Avoid claiming original restoration or closing issues | Yes |

## Findings (cited - path:lines)

- `D:/admin/Downloads/정본 제작 1차/_SOURCE_TO_DOC_MAP_v3.0.md:19-23` defines the older docs rewrite principles: 정본 우선, root-name retention, single responsibility, and explicit source citation.
- `D:/admin/Downloads/정본 제작 1차/SOURCE_MAP.md:18-40` defines L0 current SPEC baselines and conflict priorities; new SPEC authoring prioritizes L0 current SPEC baselines over legacy docs.
- `D:/admin/Downloads/정본 제작 1차/APP_IMPLEMENTATION_BRIDGE.md:24-39` lists upstream baselines and marks `ATHLETE_PROFILE_SPEC.md` as pending canonical promotion, upload disallowed, canonical promotion disallowed.
- `.omo/evidence/spec-manifest-train-oracle-spec-handoff.txt` confirms the 16 provided markdown files are present under `D:/admin/Downloads/정본 제작 1차`.
- `.omo/evidence/inventory-classification-train-oracle-spec-handoff.md` classifies confirmed active specs, test package, legacy references, and missing/reconstruct targets; it also records that exact `SOURCE_TO_DOC_MAP.md` was not found, while `_SOURCE_TO_DOC_MAP_v3.0.md` was found.
- `.omo/evidence/missing-contract-search-train-oracle-spec-handoff.txt` found no `RULE_VALIDATION_ENGINE_CONTRACT.md` or `PLAN_SAFETY_GATE_SPEC.md` in the workspace or provided source package roots.
- `.omo/evidence/missing-contract-broader-search-train-oracle-spec-handoff.txt` found no `RULE_VALIDATION_ENGINE_CONTRACT.md` or `PLAN_SAFETY_GATE_SPEC.md` under `D:/admin/Documents` or `D:/admin/Downloads` within the searched depth.
- `.omo/evidence/plan-generator-count-lines-train-oracle-spec-handoff.md` verifies local `PLAN_GENERATOR_SPEC.md` count-related lines: `open_issues_total: 7`, `open_issues_canonical_blocking_count: 2`, and the two canonical blockers named in the user handoff.
- `.omo/evidence/model-belief-files-train-oracle-spec-handoff.md` records that the earlier `.txt` files are empty, while `D:/admin/Downloads/새 텍스트 문서.md` and `D:/admin/Downloads/새 텍스트 문서 (2).md` contain `TRAINORACLE_SPEC_FLOW_AND_REMAINING_WORK` and `TRAINORACLE_CODEX_HANDOFF` handoff/reference material. These are used as design judgment references, not active SPEC baselines.
- `.omo/evidence/trainoracle-remaining-work-flow-reference.md` records the latest user-provided reminder that the spec set is still incomplete: the next execution should lock `TRAINORACLE_SPEC_INDEX.md` or `SPEC_REGISTRY.md`, then verify/reconstruct missing core contracts, obtain runtime evidence, finish Plan Generator bindings, and only then continue productization specs.
- `.omo/evidence/trainoracle-confirmed-inventory.md` is the current confirmed inventory report for the first execution pass: source package root has 16 markdown files, active SPEC 8/8 found, test package 1/1 found, legacy exact-name references 7/8 found, and exact `SOURCE_TO_DOC_MAP.md` not found while `_SOURCE_TO_DOC_MAP_v3.0.md` is found.
- `.omo/evidence/trainoracle-missing-quarantine.md` is the current missing/quarantine detector report: searched `D:/admin/Documents` and `D:/admin/Downloads` depth<=7, did not find `RULE_VALIDATION_ENGINE_CONTRACT.md`, `PLAN_SAFETY_GATE_SPEC.md`, `COACH_RATIFICATION_SAFETY_DEFAULTS_2026_06_04_001`, or exact `SOURCE_TO_DOC_MAP.md`; no source package file was moved or quarantined.
- `.omo/reports/trainoracle-reconstruction-readiness.md` is the current readiness brief for future reconstruction of the two missing contracts. It is not a reconstructed product SPEC.
- `.omo/evidence/trainoracle-source-package-integrity.md` records SHA256 and LastWriteTimeUtc for the 16 source package markdown files; all source markdown LastWriteTimeUtc values predate the ULW start timestamp.
- User handoff received 2026-06-24 establishes the operational rule: do not claim a file exists unless found locally; do not close issues without required evidence; do not treat `11_API_AND_ENGINE_CONTRACTS.md` as `RULE_VALIDATION_ENGINE_CONTRACT.md`.

## Decisions (with rationale)

- The first execution work unit is complete as an `.omo` evidence/readiness package only. Product SPEC reconstruction has not started.
- Do not reconstruct `RULE_VALIDATION_ENGINE_CONTRACT.md` or `PLAN_SAFETY_GATE_SPEC.md` yet. The immediate ask is preparation, and reconstruction requires a separate execution start after the spec index/registry ordering is acknowledged.
- Record `D9_SAFETY_EVALUATOR_V2_1_1_TEST_PACKAGE.md` as ready-for-local-test candidate material only; do not treat it as runtime PASS evidence.
- Treat `RULE_SPEC_D1_D9.D-*`, `LEGACY_PHASE_D.D-*`, and `CYCLE_DAY.D-*` as separate namespaces. Bare D-rule references are forbidden in new specs unless disambiguated.
- Preserve the D9/RVE invariant that ADVISORY is not a fourth D9 disposition; it is under `D9_CLEARED`, stored as `CLEARED`, and does not block plan generation.
- Treat `TRAINORACLE_SPEC_FLOW_AND_REMAINING_WORK` and `TRAINORACLE_CODEX_HANDOFF` as a handoff/reference layer: they can guide interpretation, sequencing, and review priorities, but any factual claim about files, counts, versions, or issue state must still be verified from the local target file.
- Add `TRAINORACLE_SPEC_INDEX.md` or `SPEC_REGISTRY.md` as the next organizing artifact before expanding the SPEC set. The latest reference says document order is more important than immediately adding new feature specs.

## Scope IN

- Maintain handoff policy, document classes, namespace rules, safety invariants, current blocker list, and next work order.
- Keep current inventory/search/readiness evidence available for the next worker.
- Use `.omo/reports/trainoracle-reconstruction-readiness.md` as the start point for the next reconstruction phase.

## Scope OUT (Must NOT have)

- No product SPEC edits in this first execution work unit.
- No reconstruction of missing contracts yet.
- No issue closure or status/count mutation based on conversation memory.
- No claims that runtime tests passed.
- No merging multiple SPEC documents into one markdown file.
- No treating legacy workflow docs as current RULE_SPEC_D1_D9 semantics.

## Open questions

- Whether to physically organize/copy files into `/SPEC_ACTIVE`, `/LEGACY_REFERENCE`, `/TEST_PACKAGES`, `/SPEC_MISSING_OR_RECONSTRUCT`, and `/QUARANTINE_DUPLICATES` remains undecided. Current work produced reports only and did not move source files.
- Next execution phase should first create or update the spec index/registry, then reconstruct missing contracts only after explicit start and final local checks.

## Approval gate
status: inventory_readiness_complete
pending_user_input: explicit start for missing contract reconstruction
<!-- When exploration is exhausted and unknowns are answered, set status: awaiting-approval. -->
<!-- That durable record is the loop guard: on a later turn read it and resume at the gate instead of re-running exploration. -->
