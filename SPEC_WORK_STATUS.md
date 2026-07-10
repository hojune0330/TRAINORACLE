# SPEC_WORK_STATUS.md

Updated: 2026-07-10 Asia/Seoul
status: DRAFT_HANDOFF_STATUS
owner: COACH_HOJUNE

This is the current GitHub-main handoff status for continuing TrainOracle SPEC work.

It is not a product rule definition, not canonical promotion, not runtime evidence, and not issue closure.

For SPEC-to-legacy continuity, daily-log service flow, and later productization document order, read [`SPEC_LEGACY_ALIGNMENT_AND_DAILY_LOG_PLAN.md`](./SPEC_LEGACY_ALIGNMENT_AND_DAILY_LOG_PLAN.md).
For a plain Korean overview of why the SPEC layer is solid and what remains, read [`SPEC_OVERVIEW_FOR_HOJUNE.md`](./SPEC_OVERVIEW_FOR_HOJUNE.md).
For an easy document-by-document report, read [`SPEC_DOCUMENTATION_REPORT.md`](./SPEC_DOCUMENTATION_REPORT.md).
For the next source-to-target patch order and non-closure conditions, read [`SPEC_TARGET_PATCH_MATRIX.md`](./SPEC_TARGET_PATCH_MATRIX.md).
For external reviewer read order, lenses, and review prompts, read [`SPEC_REVIEW_PACKET.md`](./SPEC_REVIEW_PACKET.md).
For the next target-patch readiness gates and wave order, read [`SPEC_TARGET_PATCH_READINESS.md`](./SPEC_TARGET_PATCH_READINESS.md).
For documentation link/terminology quality findings, read [`SPEC_DOC_QUALITY_REPORT.md`](./SPEC_DOC_QUALITY_REPORT.md).
For the Wave B Safety Gate target-local patch result, read [`SPEC_WAVEB_SAFETY_GATE_PATCH_REPORT.md`](./SPEC_WAVEB_SAFETY_GATE_PATCH_REPORT.md).
For Safety Gate/RVE source acceptance review prep, read [`SPEC_SOURCE_ACCEPTANCE_REVIEW_ROUND1.md`](./SPEC_SOURCE_ACCEPTANCE_REVIEW_ROUND1.md).
For the Wave D downstream binding patch result, read [`SPEC_WAVED_BINDING_PATCH_REPORT.md`](./SPEC_WAVED_BINDING_PATCH_REPORT.md).
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

Current Work Order 001 implementation/evidence state:

- Wave D binding patches were merged to main through PR #6.
- The TypeScript implementation skeleton under `impl/` was merged through PR #7.
- GitHub Actions CI configuration was merged through PR #8.
- The static SPEC status dashboard under `dashboard/` was merged through PR #9.
- `runtime-evidence/d9-evaluator/` now contains actual D9 evaluator runtime evidence, including `d9-vitest-run-2026-07-09.log`.
- This runtime evidence proves the candidate evaluator package execution for its covered cases only; it does not by itself close RVE, Safety Gate, Plan Generator, App Bridge, UI, or productization-draft issues.

Current Work Order 002 state:

- `CODEX_WORK_ORDER_002.md` is present on main and assigns Codex to spec verification, flow audit, and document improvement.
- Design and screen implementation files remain Project Lead AI territory under Work Order 002; Codex findings should be documented, not patched into `ui_kits/`, `preview/`, `design-v3/`, `designs/`, `colors_and_type*.css`, or root `index.html`.
- PR #14-#17 are merged.
- `SPEC_SCREEN_TRACEABILITY_MATRIX.md`, `SPEC_SOURCE_ACCEPTANCE_REVIEW_ROUND3.md`, `SPEC_DOC_QUALITY_REPORT.md`, and the dashboard Task 4 update are now present on main.
- `SPEC_SOURCE_ACCEPTANCE_DECISION_ROUND3.md` records the Project Lead AI decision for Round 3 sources.

Current Work Order 003 state:

- `CODEX_WORK_ORDER_003.md` is present on main and completed.
- PR #22 merged `MEDIA_AND_TRANSIENT_CAPTURE_SPEC.md`.
- PR #23 merged `RACE_RECORD_AND_HISTORICAL_RECALL_SPEC.md`.
- PR #24 merged `METRIC_ALGORITHM_CONTRACT.md`.
- PR #25 merged the Daily Brief metadata normalization, Plan Generator Round 3 patch notes, and index/status update.
- `SPEC_SOURCE_ACCEPTANCE_DECISION_ROUND4.md` accepts the three Work Order 003 draft specs as working sources only. It does not grant canonical promotion, issue closure, implementation completeness, or runtime evidence.
- Round 4 note N2 explicitly withholds acceptance of `METRIC_ALGORITHM_CONTRACT.md` §6 formulas while the formula acceptance issue remains open.

Current Work Order 004 state:

- `CODEX_WORK_ORDER_004.md` is present on main and completed.
- PR #28 merged the MEDIA transcript-to-D9 precheck patch.
- PR #30 merged the Daily Log race subtype reference and Analysis metric envelope reference.
- PR #31 merged the legacy v1 kit disposition proposal.
- PR #32 merged the traceability matrix, index, and status recount. It does not close issues.
- `SPEC_SOURCE_ACCEPTANCE_DECISION_ROUND5.md` records the Project Lead AI decision for Work Order 004 outputs. It does not grant canonical promotion, issue closure, implementation completeness, or runtime evidence.

Current Work Order 005 state:

- `CODEX_WORK_ORDER_005.md` is present on main and assigns Codex to external record integration, composition balance baseline, and index/status refresh work.
- Task A is proposed in PR #36: `EXTERNAL_RECORD_INTEGRATION_SPEC.md` as a new `DRAFT_FOR_REVIEW` contract for AthleteTime PB/SB inbound records. It is not merged at this status update.
- Task B is proposed in PR #37: `COMPOSITION_BALANCE_BASELINE_CONTRACT.md` as a new `DRAFT_FOR_REVIEW` contract for composition balance baselines. It is not merged at this status update.
- Task C is this index/status refresh. It does not close issues, promote drafts, claim runtime evidence, edit `app/`, or edit design files.

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
- `specs/reconstruct/ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md` now exists as a new `DRAFT_FOR_REVIEW` productization SPEC.
- It defines source-backed visualization data for Analysis, Dashboard, Session Detail, Calendar, coach review, Daily Brief, and AI Inbox surfaces.
- It requires source refs, confidence/uncertainty, non-sensitive reason codes, and visible missing/stale/conflicting source states.
- It forbids raw memo/free-text/symptom clause storage, external LLM use with private athlete data, final metric formula authority, D9/Safety Gate clearing, plan option creation, runtime evidence claims, and issue closure.
- `specs/reconstruct/PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md` now exists as a new `DRAFT_FOR_REVIEW` productization SPEC.
- It defines privacy-safe plan rationale bundles and items using source refs, rationale codes, privacy tiers, redaction states, and confidence/uncertainty.
- It forbids raw memo/free-text/symptom clause storage, private notes, hidden chain-of-thought storage, external LLM use with private athlete data, D9/Safety Gate clearing, plan option creation/selection, runtime evidence claims, and issue closure.
- `specs/reconstruct/MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md` now exists as a new `DRAFT_FOR_REVIEW` productization SPEC.
- It defines namespace-safe microcycle/calendar mapping for 9.5-day cycle display, `CYCLE_DAY.*` labels, planned dates, session slots, race anchors, and Calendar projections.
- It keeps `CYCLE_DAY.*`, `RULE_SPEC_D1_D9.*`, and `LEGACY_PHASE_D.*` separate and forbids bare D-rule ambiguity in contract fields.
- It cannot create/select plan options, clear D9/Safety Gate states, claim runtime evidence, resolve `OI-PG-MICROCYCLE-CALENDAR-MAPPING-001`, or close downstream issues.
- Wave 3 productization drafts are now all created as drafts for review.

Not yet:

- full working web/app implementation
- canonical promotion
- production deployment
- closure of RVE or Plan Generator safety-gate binding issues
- acceptance of productization drafts into implementation contracts
- runtime evidence for productization data generation, UI binding, App Bridge storage, or dashboard data sync beyond the D9 evaluator package

Current review/readiness state:

- `SPEC_REVIEW_PACKET.md` now exists as a reviewer-facing read-order and question packet.
- `SPEC_TARGET_PATCH_READINESS.md` now exists as a target patch readiness and evidence-gate guide.
- These documents do not close issues, promote drafts, or create runtime evidence.

Current Wave B Safety Gate patch state:

- `PLAN_GENERATOR_SPEC.md` now has a target-local Safety Gate/RVE consumption binding.
- `OI-PG-RULE-SAFETY-GATE-BINDING-001` remains open.
- `PLAN_GENERATOR_SPEC.md` still has 7 open issues and 2 canonical blocking open issues after local recount.
- Actual D9 evaluator runtime evidence now exists under `runtime-evidence/d9-evaluator/`, but closure still requires source acceptance scope, target recount approval, owner review, and any additional implementation/runtime evidence required by the target issue.

Current source acceptance review state:

- `SPEC_SOURCE_ACCEPTANCE_REVIEW_ROUND1.md` exists as the review-prep packet for `PLAN_SAFETY_GATE_SPEC.md` and `RULE_VALIDATION_ENGINE_CONTRACT.md`.
- `SPEC_SOURCE_ACCEPTANCE_DECISION_ROUND1.md` records that Safety Gate and RVE reconstructed drafts were accepted as working sources only.
- `SPEC_SOURCE_ACCEPTANCE_DECISION_ROUND2.md` records that Physio Source Trust and Daily Log were accepted as working sources only.
- `SPEC_SOURCE_ACCEPTANCE_DECISION_ROUND3.md` records that Analysis/Visualization, Daily Brief/Inbox, Microcycle/Calendar, and Plan Output Rationale Privacy were accepted as working sources only.
- Round 1/2/3 decisions do not grant canonical promotion, implementation completeness, issue closure, or runtime evidence for downstream behavior.
- Reconstructed/productization working-source decisions now cover 8 documents across Rounds 1-3; downstream target issues remain OPEN unless separately closed with required evidence and owner approval.

Current Wave D downstream binding state:

- `PLAN_GENERATOR_SPEC.md` now records Round 2 source acceptance and Wave D recount for `OI-PG-PHYSIO-SOURCE-CONSUMPTION-001`.
- `APP_IMPLEMENTATION_BRIDGE.md` now records Round 2 source acceptance and Wave D recount for `OI-DLC-APP-BRIDGE-BINDING-001` in its Daily Log binding addendum.
- `RVE_RULE_EVALUATOR_BINDING_SPEC.md` now has a Daily Log structured input boundary addendum for `OI-DLC-RVE-SAFETY-BINDING-001`.
- All three issues remain open; no runtime evidence, canonical promotion, or issue closure is claimed by Wave D.

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
- [`specs/reconstruct/DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC.md`](./specs/reconstruct/DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC.md) (`DRAFT_FOR_REVIEW`; new productization draft)
- [`specs/reconstruct/ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md`](./specs/reconstruct/ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md) (`DRAFT_FOR_REVIEW`; new productization draft)
- [`specs/reconstruct/PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md`](./specs/reconstruct/PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md) (`DRAFT_FOR_REVIEW`; new productization draft)
- [`specs/reconstruct/MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md`](./specs/reconstruct/MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md) (`DRAFT_FOR_REVIEW`; new productization draft)

## Reconstructed Or Source-Not-Verified Contracts

These required contracts are not all present as approved source files in this repo at this checkpoint:

| Required item | Current exact repository state |
|---|---|
| `RULE_VALIDATION_ENGINE_CONTRACT.md` | `specs/reconstruct/RULE_VALIDATION_ENGINE_CONTRACT.md` exists as `RECONSTRUCTED_DRAFT_FOR_REVIEW`; not original restored, not canonical, not runtime evidence |
| `PLAN_SAFETY_GATE_SPEC.md` | `specs/reconstruct/PLAN_SAFETY_GATE_SPEC.md` exists as `RECONSTRUCTED_DRAFT_FOR_REVIEW`; not original restored, not canonical, not runtime evidence |
| `DAILY_LOG_AND_CHECKIN_SPEC.md` | `specs/reconstruct/DAILY_LOG_AND_CHECKIN_SPEC.md` exists as `RECONSTRUCTED_DRAFT_FOR_REVIEW`; not original restored, not canonical, not runtime evidence |
| `DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC.md` | `specs/reconstruct/DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC.md` exists as `DRAFT_FOR_REVIEW`; new productization draft, not canonical, not runtime evidence |
| `ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md` | `specs/reconstruct/ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md` exists as `DRAFT_FOR_REVIEW`; new productization draft, not metric formula authority, not canonical, not runtime evidence |
| `PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md` | `specs/reconstruct/PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md` exists as `DRAFT_FOR_REVIEW`; new productization draft, not Plan Generator issue closure, not canonical, not runtime evidence |
| `MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md` | `specs/reconstruct/MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md` exists as `DRAFT_FOR_REVIEW`; new productization draft, not Plan Generator issue closure, not D-rule redefinition, not canonical, not runtime evidence |
| `COACH_RATIFICATION_SAFETY_DEFAULTS_2026_06_04_001` | Not found as approved local evidence |

Do not claim a document exists from a chapter title, H1, table row, status label, or conversation summary. Exact local filename search is required.

`11_API_AND_ENGINE_CONTRACTS.md` is a legacy Phase A-F output contract. It is not `RULE_VALIDATION_ENGINE_CONTRACT.md`.

## Next SPEC Production Order

1. Re-open the target repository files before making claims about file status, issue counts, blockers, or runtime evidence.
2. Review `SPEC_TARGET_PATCH_MATRIX.md` to choose the next safe target patch wave; do not treat the matrix as issue closure or runtime evidence.
3. Use `SPEC_REVIEW_PACKET.md` to run Review Round 1 with specific reviewer lenses.
4. Use `SPEC_TARGET_PATCH_READINESS.md` to choose the next target patch wave and evidence gates.
5. Review `specs/reconstruct/RULE_VALIDATION_ENGINE_CONTRACT.md` as a reconstructed draft and patch only with direct file evidence.
6. Review `specs/reconstruct/PLAN_SAFETY_GATE_SPEC.md` as a reconstructed draft and patch only with direct file evidence.
7. Review `specs/reconstruct/DAILY_LOG_AND_CHECKIN_SPEC.md` as a reconstructed draft and patch only with direct file evidence.
8. Review the Wave 1 physio target patches in `PLAN_GENERATOR_SPEC.md`, `APP_IMPLEMENTATION_BRIDGE.md`, and `ATHLETE_PROFILE_SPEC.md`; do not close their physio issues until source acceptance and target recount approval exist.
9. Review the Wave B Safety Gate target-local patch in `PLAN_GENERATOR_SPEC.md`; do not close `OI-PG-RULE-SAFETY-GATE-BINDING-001` before source acceptance, target recount approval, and runtime evidence.
10. Use `SPEC_SOURCE_ACCEPTANCE_REVIEW_ROUND1.md` for Safety Gate/RVE source review before treating reconstructed drafts as accepted sources.
11. Review `SPEC_WAVED_BINDING_PATCH_REPORT.md`; do not close Wave D issues before implementation/runtime evidence and owner approval.
12. Obtain actual D9 evaluator runtime output before closing RVE or Plan Generator safety-gate binding issues.
13. Review `specs/reconstruct/DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC.md`; it is a productization draft, not canonical or runtime evidence.
14. Review `specs/reconstruct/ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md`; it is a productization draft, not metric formula authority, canonical, or runtime evidence.
15. Review `specs/reconstruct/PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md`; it is a productization draft, not Plan Generator target issue closure, canonical, or runtime evidence.
16. Review `specs/reconstruct/MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md`; it is a productization draft, not Plan Generator target issue closure, D-rule redefinition, canonical, or runtime evidence.
17. Begin App Bridge/API schema contracts and runtime evidence only after preserving the safety core chain.

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
- [`.omo/evidence/spec-productization-analysis-red-20260707.txt`](./.omo/evidence/spec-productization-analysis-red-20260707.txt)
- [`.omo/evidence/spec-productization-analysis-green-20260707.txt`](./.omo/evidence/spec-productization-analysis-green-20260707.txt)
- [`.omo/evidence/spec-productization-analysis-code-review.md`](./.omo/evidence/spec-productization-analysis-code-review.md)
- [`.omo/evidence/spec-productization-analysis-final-qa-20260707.txt`](./.omo/evidence/spec-productization-analysis-final-qa-20260707.txt)
- [`.omo/evidence/spec-productization-rationale-red-20260707.txt`](./.omo/evidence/spec-productization-rationale-red-20260707.txt)
- [`.omo/evidence/spec-productization-rationale-green-20260707.txt`](./.omo/evidence/spec-productization-rationale-green-20260707.txt)
- [`.omo/evidence/spec-productization-rationale-code-review.md`](./.omo/evidence/spec-productization-rationale-code-review.md)
- [`.omo/evidence/spec-productization-rationale-gate-review.md`](./.omo/evidence/spec-productization-rationale-gate-review.md)
- [`.omo/evidence/spec-productization-rationale-final-qa-20260707.txt`](./.omo/evidence/spec-productization-rationale-final-qa-20260707.txt)
- [`.omo/evidence/spec-productization-microcycle-red-20260707.txt`](./.omo/evidence/spec-productization-microcycle-red-20260707.txt)
- [`.omo/evidence/spec-productization-microcycle-green-20260707.txt`](./.omo/evidence/spec-productization-microcycle-green-20260707.txt)
- [`.omo/evidence/spec-productization-microcycle-code-review.md`](./.omo/evidence/spec-productization-microcycle-code-review.md)
- [`.omo/evidence/spec-productization-microcycle-gate-review.md`](./.omo/evidence/spec-productization-microcycle-gate-review.md)
- [`.omo/evidence/spec-productization-microcycle-final-qa-20260707.txt`](./.omo/evidence/spec-productization-microcycle-final-qa-20260707.txt)

Markdown self-checks and documentation scans are not D9 evaluator runtime evidence.

## What To Read First

1. [`SPEC_OVERVIEW_FOR_HOJUNE.md`](./SPEC_OVERVIEW_FOR_HOJUNE.md)
2. [`TRAINORACLE_SPEC_INDEX.md`](./TRAINORACLE_SPEC_INDEX.md)
3. This file
4. [`SPEC_DOCUMENTATION_REPORT.md`](./SPEC_DOCUMENTATION_REPORT.md)
5. [`SPEC_TARGET_PATCH_MATRIX.md`](./SPEC_TARGET_PATCH_MATRIX.md)
6. [`SPEC_REVIEW_PACKET.md`](./SPEC_REVIEW_PACKET.md)
7. [`SPEC_TARGET_PATCH_READINESS.md`](./SPEC_TARGET_PATCH_READINESS.md)
8. [`SPEC_DOC_QUALITY_REPORT.md`](./SPEC_DOC_QUALITY_REPORT.md)
9. [`SPEC_WAVEB_SAFETY_GATE_PATCH_REPORT.md`](./SPEC_WAVEB_SAFETY_GATE_PATCH_REPORT.md)
10. [`SPEC_SOURCE_ACCEPTANCE_REVIEW_ROUND1.md`](./SPEC_SOURCE_ACCEPTANCE_REVIEW_ROUND1.md)
11. [`SPEC_WAVED_BINDING_PATCH_REPORT.md`](./SPEC_WAVED_BINDING_PATCH_REPORT.md)
12. [`SPEC_WAVE1_PHYSIO_PATCH_REPORT.md`](./SPEC_WAVE1_PHYSIO_PATCH_REPORT.md)
13. [`SPEC_FILE_TRUTH_GUARD.md`](./SPEC_FILE_TRUTH_GUARD.md)
14. [`SPEC_LEGACY_ALIGNMENT_AND_DAILY_LOG_PLAN.md`](./SPEC_LEGACY_ALIGNMENT_AND_DAILY_LOG_PLAN.md)
15. [`specs/reconstruct/README.md`](./specs/reconstruct/README.md)
16. [`.omo/reports/trainoracle-reconstruction-readiness.md`](./.omo/reports/trainoracle-reconstruction-readiness.md)
17. [`.omo/evidence/trainoracle-remaining-work-flow-reference.md`](./.omo/evidence/trainoracle-remaining-work-flow-reference.md)

[DRAFT_COMPLETE]
