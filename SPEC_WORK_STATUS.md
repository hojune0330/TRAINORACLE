# SPEC_WORK_STATUS.md

Updated: 2026-06-27 Asia/Seoul
status: DRAFT_HANDOFF_STATUS
owner: COACH_HOJUNE

This is the current GitHub-main handoff status for continuing TrainOracle SPEC work.

It is not a product rule definition, not canonical promotion, not runtime evidence, and not issue closure.

For SPEC-to-legacy continuity, daily-log service flow, and later productization document order, read [`SPEC_LEGACY_ALIGNMENT_AND_DAILY_LOG_PLAN.md`](./SPEC_LEGACY_ALIGNMENT_AND_DAILY_LOG_PLAN.md).
For a plain Korean overview of why the SPEC layer is solid and what remains, read [`SPEC_OVERVIEW_FOR_HOJUNE.md`](./SPEC_OVERVIEW_FOR_HOJUNE.md).
For an easy document-by-document report, read [`SPEC_DOCUMENTATION_REPORT.md`](./SPEC_DOCUMENTATION_REPORT.md).
For the next source-to-target patch order and non-closure conditions, read [`SPEC_TARGET_PATCH_MATRIX.md`](./SPEC_TARGET_PATCH_MATRIX.md).
For the Wave 1 Physio Source Trust target patch result, read [`SPEC_WAVE1_PHYSIO_PATCH_REPORT.md`](./SPEC_WAVE1_PHYSIO_PATCH_REPORT.md).
For the rule that prevents chapter/title/status text from being treated as file existence, read [`SPEC_FILE_TRUTH_GUARD.md`](./SPEC_FILE_TRUTH_GUARD.md).

## Current Phase

TrainOracle is in an incomplete SPEC contract-layer phase.

Current focus:

- keep the `RULE_SPEC_D1_D9` safety semantics stable
- make the D9 evaluator -> RVE -> Safety Gate -> Plan Generator chain implementation-ready
- prevent raw athlete free-text, raw symptom clauses, and private notes from entering audit/storage contracts
- keep Template Library and Physio Source Trust consumable by Plan Generator without clearing D9 risk
- reconstruct missing core contracts only after local/repo existence checks

Current Wave 1 physio patch state:

- `PLAN_GENERATOR_SPEC.md`, `APP_IMPLEMENTATION_BRIDGE.md`, and `ATHLETE_PROFILE_SPEC.md` now have target-local Physio Source Trust bindings.
- The related target issues remain OPEN as patched-pending-source-acceptance work; this is not issue closure.
- Counts remain owned by each target file and must be recounted from those files before any closure.

Current Wave 2 Daily Log patch state:

- `APP_IMPLEMENTATION_BRIDGE.md` now has target-local Daily Check-in storage/API/type bindings for structured fields only.
- `PLAN_SAFETY_GATE_SPEC.md` now has a target-local Daily Log input boundary in Section 9A.
- Raw memo/free-text remains transient only; structured daily signals may raise review or block, but cannot clear `D9_ACTIVE`, `D9_UNKNOWN`, or Safety Gate blocks.
- Related target issues remain OPEN; this is not canonical promotion, runtime evidence, or issue closure.

Current Wave 3 productization draft state:

- `specs/reconstruct/DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC.md` now exists as a new `DRAFT_FOR_REVIEW` productization SPEC.
- It defines Daily Brief and AI Inbox signal records from structured facts only.
- It requires source refs, confidence/uncertainty, and non-sensitive reason codes.
- It forbids raw memo/free-text/symptom clause storage, external LLM use with private athlete data, D9/Safety Gate clearing, plan option creation, runtime evidence claims, and issue closure.
- Remaining productization drafts: `ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md`, `PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md`, and `MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md`.

Not yet:

- full working web/app implementation
- canonical promotion
- production deployment
- actual D9 evaluator runtime evidence
- closure of RVE or Plan Generator safety-gate binding issues
- acceptance of productization drafts into implementation contracts

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
- [`specs/reconstruct/RULE_VALIDATION_ENGINE_CONTRACT.md`](./specs/reconstruct/RULE_VALIDATION_ENGINE_CONTRACT.md) (`RECONSTRUCTED_DRAFT_FOR_REVIEW`; not original restored)
- [`specs/reconstruct/PLAN_SAFETY_GATE_SPEC.md`](./specs/reconstruct/PLAN_SAFETY_GATE_SPEC.md) (`RECONSTRUCTED_DRAFT_FOR_REVIEW`; not original restored)
- [`specs/reconstruct/DAILY_LOG_AND_CHECKIN_SPEC.md`](./specs/reconstruct/DAILY_LOG_AND_CHECKIN_SPEC.md) (`RECONSTRUCTED_DRAFT_FOR_REVIEW`; not original restored)

## Reconstructed Or Source-Not-Verified Contracts

These required contracts are not all present as approved source files in this repo at this checkpoint:

| Required item | Current exact repository state |
|---|---|
| `RULE_VALIDATION_ENGINE_CONTRACT.md` | `specs/reconstruct/RULE_VALIDATION_ENGINE_CONTRACT.md` exists as `RECONSTRUCTED_DRAFT_FOR_REVIEW`; not original restored, not canonical, not runtime evidence |
| `PLAN_SAFETY_GATE_SPEC.md` | `specs/reconstruct/PLAN_SAFETY_GATE_SPEC.md` exists as `RECONSTRUCTED_DRAFT_FOR_REVIEW`; not original restored, not canonical, not runtime evidence |
| `DAILY_LOG_AND_CHECKIN_SPEC.md` | `specs/reconstruct/DAILY_LOG_AND_CHECKIN_SPEC.md` exists as `RECONSTRUCTED_DRAFT_FOR_REVIEW`; not original restored, not canonical, not runtime evidence |
| `COACH_RATIFICATION_SAFETY_DEFAULTS_2026_06_04_001` | Not found as approved local evidence |

Do not claim a document exists from a chapter title, H1, table row, status label, or conversation summary. Exact local filename search is required.

`11_API_AND_ENGINE_CONTRACTS.md` is a legacy Phase A-F output contract. It is not `RULE_VALIDATION_ENGINE_CONTRACT.md`.

## Next SPEC Production Order

1. Re-open the target repository files before making claims about file status, issue counts, blockers, or runtime evidence.
2. Review `SPEC_TARGET_PATCH_MATRIX.md` to choose the next safe target patch wave; do not treat the matrix as issue closure or runtime evidence.
3. Review `specs/reconstruct/RULE_VALIDATION_ENGINE_CONTRACT.md` as a reconstructed draft and patch only with direct file evidence.
4. Review `specs/reconstruct/PLAN_SAFETY_GATE_SPEC.md` as a reconstructed draft and patch only with direct file evidence.
5. Review `specs/reconstruct/DAILY_LOG_AND_CHECKIN_SPEC.md` as a reconstructed draft and patch only with direct file evidence.
6. Review the Wave 1 physio target patches in `PLAN_GENERATOR_SPEC.md`, `APP_IMPLEMENTATION_BRIDGE.md`, and `ATHLETE_PROFILE_SPEC.md`; do not close their physio issues until source acceptance and target recount approval exist.
7. Obtain actual D9 evaluator runtime output before closing RVE or Plan Generator safety-gate binding issues.
8. Review `specs/reconstruct/DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC.md`; it is a productization draft, not canonical or runtime evidence.
9. Draft Analysis visualization, plan rationale privacy, and microcycle/calendar contracts before implementation touches those product surfaces.
10. Continue productization specs only after preserving the safety core chain.

## Hard Guardrails

- Local/repo files are truth for file existence and repository state.
- Conversation ledgers, chat summaries, and belief files are reference only.
- H1 headings, chapter titles, table rows, and status labels are not file-existence evidence.
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
- [`SPEC_LEGACY_ALIGNMENT_AND_DAILY_LOG_PLAN.md`](./SPEC_LEGACY_ALIGNMENT_AND_DAILY_LOG_PLAN.md)

Process evidence and handoff reports:

- [`.omo/evidence/trainoracle-confirmed-inventory.md`](./.omo/evidence/trainoracle-confirmed-inventory.md)
- [`.omo/evidence/trainoracle-missing-quarantine.md`](./.omo/evidence/trainoracle-missing-quarantine.md)
- [`.omo/evidence/trainoracle-remaining-work-flow-reference.md`](./.omo/evidence/trainoracle-remaining-work-flow-reference.md)
- [`.omo/evidence/genspark-spec-readiness-validation-20260626.md`](./.omo/evidence/genspark-spec-readiness-validation-20260626.md)
- [`.omo/evidence/spec-continuation-phantom-doc-guard-20260626/c001-red-filesystem-truth.md`](./.omo/evidence/spec-continuation-phantom-doc-guard-20260626/c001-red-filesystem-truth.md)
- [`.omo/evidence/spec-continuation-plan-safety-gate-20260626/c001-red-filesystem-truth.md`](./.omo/evidence/spec-continuation-plan-safety-gate-20260626/c001-red-filesystem-truth.md)
- [`.omo/evidence/spec-continuation-daily-log-and-doc-report-20260626/c001-red-daily-log-file-truth.md`](./.omo/evidence/spec-continuation-daily-log-and-doc-report-20260626/c001-red-daily-log-file-truth.md)
- [`.omo/evidence/spec-target-patch-matrix-20260626.md`](./.omo/evidence/spec-target-patch-matrix-20260626.md)
- [`.omo/reports/trainoracle-reconstruction-readiness.md`](./.omo/reports/trainoracle-reconstruction-readiness.md)
- [`.omo/reports/github-main-publish-complete.md`](./.omo/reports/github-main-publish-complete.md)

Documentation QA evidence from this handoff cleanup:

- [`.omo/evidence/task-1-trainoracle-main-handoff-cleanup-red.txt`](./.omo/evidence/task-1-trainoracle-main-handoff-cleanup-red.txt)
- [`.omo/evidence/task-2-trainoracle-main-handoff-cleanup-green.txt`](./.omo/evidence/task-2-trainoracle-main-handoff-cleanup-green.txt)
- [`.omo/evidence/task-8-trainoracle-main-handoff-cleanup-green.txt`](./.omo/evidence/task-8-trainoracle-main-handoff-cleanup-green.txt)
- [`.omo/evidence/f3-trainoracle-main-handoff-cleanup-remote-proof.txt`](./.omo/evidence/f3-trainoracle-main-handoff-cleanup-remote-proof.txt)
- [`.omo/evidence/spec-wave2-daily-log-red-20260627.txt`](./.omo/evidence/spec-wave2-daily-log-red-20260627.txt)
- [`.omo/evidence/spec-wave2-daily-log-green-20260627.txt`](./.omo/evidence/spec-wave2-daily-log-green-20260627.txt)
- [`.omo/evidence/spec-wave2-daily-log-final-qa-20260627.txt`](./.omo/evidence/spec-wave2-daily-log-final-qa-20260627.txt)
- [`.omo/evidence/trainoracle-spec-wave2-daily-log-binding-code-review-followup-pass.md`](./.omo/evidence/trainoracle-spec-wave2-daily-log-binding-code-review-followup-pass.md)
- [`.omo/evidence/spec-wave2-daily-log-20260627-gate-review.md`](./.omo/evidence/spec-wave2-daily-log-20260627-gate-review.md)
- [`.omo/evidence/spec-productization-daily-brief-red-20260627.txt`](./.omo/evidence/spec-productization-daily-brief-red-20260627.txt)
- [`.omo/evidence/spec-productization-daily-brief-green-20260627.txt`](./.omo/evidence/spec-productization-daily-brief-green-20260627.txt)
- [`.omo/evidence/spec-productization-daily-brief-code-review.md`](./.omo/evidence/spec-productization-daily-brief-code-review.md)
- [`.omo/evidence/spec-productization-daily-brief-final-qa-20260627.txt`](./.omo/evidence/spec-productization-daily-brief-final-qa-20260627.txt)

Markdown self-checks and documentation scans are not D9 evaluator runtime evidence.

## What To Read First

1. [`SPEC_OVERVIEW_FOR_HOJUNE.md`](./SPEC_OVERVIEW_FOR_HOJUNE.md)
2. [`TRAINORACLE_SPEC_INDEX.md`](./TRAINORACLE_SPEC_INDEX.md)
3. This file
4. [`SPEC_DOCUMENTATION_REPORT.md`](./SPEC_DOCUMENTATION_REPORT.md)
5. [`SPEC_TARGET_PATCH_MATRIX.md`](./SPEC_TARGET_PATCH_MATRIX.md)
6. [`SPEC_WAVE1_PHYSIO_PATCH_REPORT.md`](./SPEC_WAVE1_PHYSIO_PATCH_REPORT.md)
7. [`SPEC_FILE_TRUTH_GUARD.md`](./SPEC_FILE_TRUTH_GUARD.md)
8. [`SPEC_LEGACY_ALIGNMENT_AND_DAILY_LOG_PLAN.md`](./SPEC_LEGACY_ALIGNMENT_AND_DAILY_LOG_PLAN.md)
9. [`specs/reconstruct/README.md`](./specs/reconstruct/README.md)
10. [`.omo/reports/trainoracle-reconstruction-readiness.md`](./.omo/reports/trainoracle-reconstruction-readiness.md)
11. [`.omo/evidence/trainoracle-remaining-work-flow-reference.md`](./.omo/evidence/trainoracle-remaining-work-flow-reference.md)

[DRAFT_COMPLETE]
