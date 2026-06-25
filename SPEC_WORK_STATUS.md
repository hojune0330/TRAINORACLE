# SPEC_WORK_STATUS.md

Updated: 2026-06-25 Asia/Seoul
status: DRAFT_HANDOFF_STATUS
owner: COACH_HOJUNE

This is the current GitHub-main handoff status for continuing TrainOracle SPEC work.

It is not a product rule definition, not canonical promotion, not runtime evidence, and not issue closure.

## Current Phase

TrainOracle is in an incomplete SPEC contract-layer phase.

Current focus:

- keep the `RULE_SPEC_D1_D9` safety semantics stable
- make the D9 evaluator -> RVE -> Safety Gate -> Plan Generator chain implementation-ready
- prevent raw athlete free-text, raw symptom clauses, and private notes from entering audit/storage contracts
- keep Template Library and Physio Source Trust consumable by Plan Generator without clearing D9 risk
- reconstruct missing core contracts only after local/repo existence checks

Not yet:

- full working web/app implementation
- canonical promotion
- production deployment
- actual D9 evaluator runtime evidence
- closure of RVE or Plan Generator safety-gate binding issues

## What Exists In This Repo

Read [`TRAINORACLE_SPEC_INDEX.md`](./TRAINORACLE_SPEC_INDEX.md) first. It is the inventory registry.

Active SPEC candidates:

- [`specs/active/RULE_SPEC_D1_D9.md`](./specs/active/RULE_SPEC_D1_D9.md)
- [`specs/active/SESSION_CLASSIFIER_SPEC.md`](./specs/active/SESSION_CLASSIFIER_SPEC.md)
- [`specs/active/ATHLETE_PROFILE_SPEC.md`](./specs/active/ATHLETE_PROFILE_SPEC.md)
- [`specs/active/APP_IMPLEMENTATION_BRIDGE.md`](./specs/active/APP_IMPLEMENTATION_BRIDGE.md)
- [`specs/active/PLAN_GENERATOR_SPEC.md`](./specs/active/PLAN_GENERATOR_SPEC.md)
- [`specs/active/TEMPLATE_LIBRARY_SPEC.md`](./specs/active/TEMPLATE_LIBRARY_SPEC.md)
- [`specs/active/PHYSIO_SOURCE_TRUST_SPEC.md`](./specs/active/PHYSIO_SOURCE_TRUST_SPEC.md)
- [`specs/active/RVE_RULE_EVALUATOR_BINDING_SPEC.md`](./specs/active/RVE_RULE_EVALUATOR_BINDING_SPEC.md)

Candidate test package:

- [`specs/test-packages/D9_SAFETY_EVALUATOR_V2_1_1_TEST_PACKAGE.md`](./specs/test-packages/D9_SAFETY_EVALUATOR_V2_1_1_TEST_PACKAGE.md)

Legacy references:

- [`specs/legacy-reference/`](./specs/legacy-reference/)

Missing/reconstruct area:

- [`specs/reconstruct/README.md`](./specs/reconstruct/README.md)

## Missing Or Source-Not-Verified Contracts

These required contracts are not present as approved source files in this repo at this checkpoint:

- `RULE_VALIDATION_ENGINE_CONTRACT.md`
- `PLAN_SAFETY_GATE_SPEC.md`
- `COACH_RATIFICATION_SAFETY_DEFAULTS_2026_06_04_001`

Do not claim any of these exists unless a file is found locally or committed in the repo.

`11_API_AND_ENGINE_CONTRACTS.md` is a legacy Phase A-F output contract. It is not `RULE_VALIDATION_ENGINE_CONTRACT.md`.

## Next SPEC Production Order

1. Re-open the target repository files before making claims about file status, issue counts, blockers, or runtime evidence.
2. Search locally/repo-wide for `RULE_VALIDATION_ENGINE_CONTRACT.md`.
3. If still absent, reconstruct `RULE_VALIDATION_ENGINE_CONTRACT.md` as `RECONSTRUCTED_DRAFT_FOR_REVIEW`.
4. Search locally/repo-wide for `PLAN_SAFETY_GATE_SPEC.md`.
5. If still absent, reconstruct `PLAN_SAFETY_GATE_SPEC.md` as `RECONSTRUCTED_DRAFT_FOR_REVIEW`.
6. Only after target files exist, patch physio source consumption into `PLAN_GENERATOR_SPEC.md`, `APP_IMPLEMENTATION_BRIDGE.md`, and `ATHLETE_PROFILE_SPEC.md` with target open-issue table recounts.
7. Obtain actual D9 evaluator runtime output before closing RVE or Plan Generator safety-gate binding issues.
8. Continue productization specs only after the safety core chain is stable.

## Hard Guardrails

- Local/repo files are truth for file existence and repository state.
- Conversation ledgers, chat summaries, and belief files are reference only.
- Do not copy absolute downstream counts from memory.
- Do not close issues without required target patches and runtime evidence.
- Do not redefine `RULE_SPEC_D1_D9.D-*` semantics outside `RULE_SPEC_D1_D9.md`.
- Keep `RULE_SPEC_D1_D9.D-*`, `LEGACY_PHASE_D.D-*`, and `CYCLE_DAY.D-*` separate.
- `D9_ACTIVE` blocks plan generation.
- `D9_UNKNOWN` blocks generation or requires human review.
- `D9_CLEARED` is not medical clearance.
- ADVISORY is not a fourth D9 disposition; it is a non-blocking sub-status under `D9_CLEARED`.
- Good physio data cannot clear D9 risk.
- Template selection cannot clear D9 risk.
- Raw athlete free-text, raw symptom clauses, injury narratives, medical notes, guardian private notes, and sensitive free-form comments must not be stored in audit contracts.

## Evidence Status

Candidate-only evidence:

- [`specs/test-packages/D9_SAFETY_EVALUATOR_V2_1_1_TEST_PACKAGE.md`](./specs/test-packages/D9_SAFETY_EVALUATOR_V2_1_1_TEST_PACKAGE.md)

Process evidence and handoff reports:

- [`.omo/evidence/trainoracle-confirmed-inventory.md`](./.omo/evidence/trainoracle-confirmed-inventory.md)
- [`.omo/evidence/trainoracle-missing-quarantine.md`](./.omo/evidence/trainoracle-missing-quarantine.md)
- [`.omo/evidence/trainoracle-remaining-work-flow-reference.md`](./.omo/evidence/trainoracle-remaining-work-flow-reference.md)
- [`.omo/reports/trainoracle-reconstruction-readiness.md`](./.omo/reports/trainoracle-reconstruction-readiness.md)
- [`.omo/reports/github-main-publish-complete.md`](./.omo/reports/github-main-publish-complete.md)

Documentation QA evidence from this handoff cleanup:

- [`.omo/evidence/task-1-trainoracle-main-handoff-cleanup-red.txt`](./.omo/evidence/task-1-trainoracle-main-handoff-cleanup-red.txt)
- [`.omo/evidence/task-2-trainoracle-main-handoff-cleanup-green.txt`](./.omo/evidence/task-2-trainoracle-main-handoff-cleanup-green.txt)
- [`.omo/evidence/task-8-trainoracle-main-handoff-cleanup-green.txt`](./.omo/evidence/task-8-trainoracle-main-handoff-cleanup-green.txt)
- [`.omo/evidence/f3-trainoracle-main-handoff-cleanup-remote-proof.txt`](./.omo/evidence/f3-trainoracle-main-handoff-cleanup-remote-proof.txt)

Markdown self-checks and documentation scans are not D9 evaluator runtime evidence.

## What To Read First

1. [`TRAINORACLE_SPEC_INDEX.md`](./TRAINORACLE_SPEC_INDEX.md)
2. This file
3. [`specs/reconstruct/README.md`](./specs/reconstruct/README.md)
4. [`.omo/reports/trainoracle-reconstruction-readiness.md`](./.omo/reports/trainoracle-reconstruction-readiness.md)
5. [`.omo/evidence/trainoracle-remaining-work-flow-reference.md`](./.omo/evidence/trainoracle-remaining-work-flow-reference.md)

[DRAFT_COMPLETE]
