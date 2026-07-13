# TRAINORACLE_SPEC_INDEX.md

doc_id: TRAINORACLE_SPEC_INDEX
spec_id: TRAINORACLE.SPEC_INDEX
title: "TrainOracle SPEC Index And Local Inventory Registry"
version: 0.1
round: RT1
status: DRAFT_FOR_REVIEW
owner: COACH_HOJUNE
open_issues_total: 0
canonical_blocking_count: 0
executed_tests_total: 0
canonical_promotion_allowed: false
registry_note: "Counts apply only to this registry document. Source SPEC issue counts remain owned by each target document and must be recounted from the local target file before use."

---

## 0. Easy Start

If this repository feels too dense, start with [`SPEC_OVERVIEW_FOR_HOJUNE.md`](./SPEC_OVERVIEW_FOR_HOJUNE.md).

That document explains, in plain Korean:

- what the TrainOracle SPEC layer is trying to protect
- why the current SPEC structure is solid
- what each core SPEC does
- which SPECs are still reconstructed drafts
- which productization drafts still need review, owner decisions, target patches, or runtime evidence

Short version:

```text
TrainOracle is not only a training diary UI.
It is a safety-bound coaching system:
athlete data -> classifier -> profile/consent -> D9 safety evaluation -> RVE -> Safety Gate -> Plan Generator -> plan, analysis, daily log.
```

---

## 1. Purpose

This registry records the current TrainOracle SPEC layer added to the `hojune0330/TRAINORACLE` repository.

It is not a product rule definition, not runtime evidence, and not canonical promotion.

For the current continuation snapshot after this index, read [`SPEC_WORK_STATUS.md`](./SPEC_WORK_STATUS.md).
For a human-readable map of all existing, reconstructed, legacy, design, and planned documents, read [`SPEC_DOCUMENTATION_REPORT.md`](./SPEC_DOCUMENTATION_REPORT.md).
For the next count-safe target patch sequence, read [`SPEC_TARGET_PATCH_MATRIX.md`](./SPEC_TARGET_PATCH_MATRIX.md).
For external reviewer read order, lenses, and review questions, read [`SPEC_REVIEW_PACKET.md`](./SPEC_REVIEW_PACKET.md).
For target patch readiness gates and wave order, read [`SPEC_TARGET_PATCH_READINESS.md`](./SPEC_TARGET_PATCH_READINESS.md).
For documentation link/terminology quality findings, read [`SPEC_DOC_QUALITY_REPORT.md`](./SPEC_DOC_QUALITY_REPORT.md).
For the Wave B Safety Gate target-local patch report, read [`SPEC_WAVEB_SAFETY_GATE_PATCH_REPORT.md`](./SPEC_WAVEB_SAFETY_GATE_PATCH_REPORT.md).
For Safety Gate/RVE source acceptance review prep, read [`SPEC_SOURCE_ACCEPTANCE_REVIEW_ROUND1.md`](./SPEC_SOURCE_ACCEPTANCE_REVIEW_ROUND1.md).
For the Wave D downstream binding patch report, read [`SPEC_WAVED_BINDING_PATCH_REPORT.md`](./SPEC_WAVED_BINDING_PATCH_REPORT.md).
For the Wave 1 Physio Source Trust target patch result, read [`SPEC_WAVE1_PHYSIO_PATCH_REPORT.md`](./SPEC_WAVE1_PHYSIO_PATCH_REPORT.md).
For SPEC-to-legacy continuity and daily-log productization planning, read [`SPEC_LEGACY_ALIGNMENT_AND_DAILY_LOG_PLAN.md`](./SPEC_LEGACY_ALIGNMENT_AND_DAILY_LOG_PLAN.md).
For file-existence and chapter/title disambiguation rules, read [`SPEC_FILE_TRUTH_GUARD.md`](./SPEC_FILE_TRUTH_GUARD.md).

The highest-priority operating rule remains:

- local files are truth
- conversation ledgers are reference only
- file existence must be verified locally before use
- absolute downstream counts must not be copied from memory
- runtime issues must not be closed without actual execution evidence

---

## 2. Repository Layout

| Path | Role | Status |
|---|---|---|
| `specs/active/` | Current active SPEC candidates copied from the verified local source package | DRAFT_FOR_REVIEW / source status preserved in each file |
| `specs/test-packages/` | Candidate local test packages | TEST_PACKAGE / not runtime evidence |
| `specs/legacy-reference/` | Legacy and reference documents | REFERENCE_ONLY |
| `specs/reconstruct/` | Missing or reconstructed required contracts | SOURCE_NOT_VERIFIED / RECONSTRUCTED_DRAFT_FOR_REVIEW |
| `.omo/` | Codex handoff, evidence, plans, and readiness reports | PROCESS_EVIDENCE |
| `ui_kits/` | Imported executable service-screen prototypes | DESIGN_SCREEN_ASSET / read-only for Codex Work Order 002 |
| `design-v3/` | Static v3 journal-style screen set and tokens | DESIGN_SCREEN_ASSET / read-only for Codex Work Order 002 |
| `preview/` | Design-system component preview cards | DESIGN_SCREEN_ASSET / read-only for Codex Work Order 002 |
| `impl/` | TypeScript safety-chain skeleton and contract tests | IMPLEMENTATION_SKELETON |
| `runtime-evidence/` | Actual local runtime evidence artifacts | RUNTIME_EVIDENCE |
| `dashboard/` | Static SPEC status dashboard | STATUS_DASHBOARD |
| `.github/workflows/` | GitHub Actions workflow definitions | CI_CONFIGURATION |

---

## 2A. Main-Branch Asset Inventory

This table records files found in the repository at the time of this index update. It does not grant acceptance or implementation completeness.

| Asset group | Current files counted from local tree | Status | Notes |
|---|---:|---|---|
| `preview/*.html` | 30 | DESIGN_ASSET | Design-system cards visible from the root design index. |
| `design-v3/` files | 7 | DESIGN_ASSET | Static v3 journal screens and token CSS. |
| `ui_kits/` files | 19 | DESIGN_ASSET | Executable v2/v3 prototype screens. Work Order 002 assigns design/screen implementation to Project Lead AI. |
| `impl/**/*.ts` excluding `node_modules` | 7 | IMPLEMENTATION_SKELETON | D9 -> RVE -> Safety Gate -> Plan Generator vertical slice skeleton. |
| `.github/workflows/ci.yml` | 1 | CI_CONFIGURATION | Runs implementation contract checks and D9 evaluator runtime package checks. |
| `runtime-evidence/d9-evaluator/` | present | RUNTIME_EVIDENCE | Contains D9 evaluator source, package files, and `d9-vitest-run-2026-07-09.log`. |
| `dashboard/index.html` | 1 | STATUS_DASHBOARD | Visual SPEC status dashboard. |

---

## 2B. Work Orders, Decisions, And Evidence

| Document / area | Repository path | Status | Treatment |
|---|---|---|---|
| `CODEX_WORK_ORDER_001.md` | root | ISSUED / completed by PR sequence | Historical work order for Wave D patches, impl skeleton, CI, and dashboard. |
| `CODEX_WORK_ORDER_002.md` | root | COMPLETED | Work order for screen/SPEC traceability, Round 3 review prep, doc quality, and dashboard data sync; PR #14-#17 merged. |
| `CODEX_WORK_ORDER_003.md` | root | COMPLETED / MERGED | Work order for GAP_SPEC draft contracts and Round 3 follow-up binding; PR #22-#25 merged. |
| `CODEX_WORK_ORDER_004.md` | root | COMPLETED / MERGED | Work order for Round 4 downstream patches, legacy v1 kit disposition proposal, and traceability/index/status recount; PR #28/#30/#31/#32 merged. |
| `CODEX_WORK_ORDER_005.md` | root | COMPLETED / MERGED_TO_MAIN | Work order for external record integration draft, composition balance baseline draft, and index/status refresh. |
| `CODEX_WORK_ORDER_006.md` | root | PARTIALLY_COMPLETED / TASK_D_IN_PROGRESS | Work order for journal delight, local-first sync promotion, federated SSO, and index refresh. Tasks A-C are merged; Task D is this index/status refresh. |
| `CODEX_WORK_ORDER_007.md` | root | ISSUED / REVIEW_TRACK | Work order that unblocked ORDER_006 after F0 main merge and requested multi-persona review. It is not implementation acceptance or issue closure. |
| `SPEC_SOURCE_ACCEPTANCE_DECISION_ROUND1.md` | root | DECIDED | Safety Gate and RVE reconstructed drafts accepted as working sources only; not canonical promotion or issue closure. |
| `SPEC_SOURCE_ACCEPTANCE_DECISION_ROUND2.md` | root | DECIDED | Physio Source Trust and Daily Log accepted as working sources only; not canonical promotion or issue closure. |
| `SPEC_SOURCE_ACCEPTANCE_DECISION_ROUND3.md` | root | DECIDED | Analysis/Visualization, Daily Brief/Inbox, Microcycle/Calendar, and Plan Output Rationale Privacy accepted as working sources only; not canonical promotion or issue closure. |
| `SPEC_SOURCE_ACCEPTANCE_DECISION_ROUND4.md` | root | DECIDED | Media/Transient Capture, Race Record/Historical Recall, and Metric Algorithm accepted as working sources only; METRIC §6 formulas remain unaccepted. |
| `SPEC_SOURCE_ACCEPTANCE_DECISION_ROUND5.md` | root | DECIDED | Work Order 004 outputs accepted as working-source amendments only; legacy v1 kit is idea source only; no canonical promotion, issue closure, or runtime evidence. |
| D9 runtime evidence | `runtime-evidence/d9-evaluator/` | RUNTIME_EVIDENCE_PRESENT | Actual local D9 evaluator run evidence exists; downstream issue closure still requires target review/recount and owner approval. |
| Work Order 002 Task 2 output | `SPEC_SCREEN_TRACEABILITY_MATRIX.md` | MERGED / UPDATED_BY_ORDER_004 | Screen/spec traceability matrix; originally documented five `GAP_SPEC_MISSING` rows, now recounts those rows as `RESOLVED_BY_SOURCE(ROUND4)` without claiming implementation completion. |
| Work Order 002 Task 1 output | `SPEC_SOURCE_ACCEPTANCE_REVIEW_ROUND3.md` | MERGED | Round 3 review packet; decisions issued separately by `SPEC_SOURCE_ACCEPTANCE_DECISION_ROUND3.md`. |
| Work Order 003 Task 1 PR | GitHub PR #22 | MERGED | `MEDIA_AND_TRANSIENT_CAPTURE_SPEC.md` is present on main as a Round 4 accepted working source only. |
| Work Order 003 Task 2 PR | GitHub PR #23 | MERGED | `RACE_RECORD_AND_HISTORICAL_RECALL_SPEC.md` is present on main as a Round 4 accepted working source only. |
| Work Order 003 Task 3 PR | GitHub PR #24 | MERGED | `METRIC_ALGORITHM_CONTRACT.md` is present on main as a Round 4 accepted working source only; §6 formulas are not accepted. |
| Work Order 003 Task 4 PR | GitHub PR #25 | MERGED | Daily Brief flat metadata, Plan Generator Round 3 patch notes, and index/status updates merged. |
| Work Order 004 Task 1 PR | GitHub PR #28 | MERGED | MEDIA transcript-to-D9 precheck patch merged. |
| Work Order 004 Task 2 PR | GitHub PR #30 | MERGED | Daily Log race subtype reference and Analysis metric envelope reference merged. |
| Work Order 004 Task 3 PR | GitHub PR #31 | MERGED | Legacy v1 kit disposition proposal merged as proposal; owner disposition is recorded in Round 5. |
| Work Order 004 Task 4 PR | GitHub PR #32 | MERGED | Traceability matrix, index, and status recount merged. |
| Round 5 decision PR | GitHub PR #34 | MERGED | Round 5 decision, Work Order 005, and Project Lead app UI work merged. Codex Work Order 005 forbids Codex from editing `app/` and design files. |
| Work Order 005 Task A output | `specs/reconstruct/EXTERNAL_RECORD_INTEGRATION_SPEC.md` | MERGED_TO_MAIN / DRAFT_FOR_REVIEW | External record integration draft is present locally; open issues 5, canonical blockers 3 by direct metadata/table check. |
| Work Order 005 Task B output | `specs/reconstruct/COMPOSITION_BALANCE_BASELINE_CONTRACT.md` | MERGED_TO_MAIN / DRAFT_FOR_REVIEW | Composition balance baseline draft is present locally; open issues 5, canonical blockers 3 by direct metadata/table check. |
| Work Order 006 Task A PR | GitHub PR #44 | MERGED | `JOURNAL_DELIGHT_AND_DECORATION_SPEC.md` is present on main as a draft; open issues 3, canonical blockers 2 by direct metadata/table check. |
| Work Order 006 Task B PR | GitHub PR #45 | MERGED | `LOCAL_FIRST_SYNC_AND_PROMOTION_CONTRACT.md` is present on main as a draft; open issues 4, canonical blockers 3 by direct metadata/table check. |
| Work Order 006 Task C PR | GitHub PR #46 | MERGED | `FEDERATED_ACCOUNT_SSO_CONTRACT.md` is present on main as a draft; open issues 5, canonical blockers 4 by direct metadata/table check. |
| Work Order 006 supporting decision docs | `ACCOUNT_FEDERATION_DECISION.md`, `ATHLETETIME_INTEGRATION_REVIEW.md`, `LAUNCH_BACKEND_AND_ACCOUNT_PLAN.md` | MERGED_TO_MAIN / DECISION_CONTEXT | Account federation, AthleteTime integration review, and launch/backend/account planning context. Not runtime evidence or canonical promotion. |
| F0-e app stability PR | GitHub PR #47 | OPEN_AT_UPDATE_TIME | App-area response to selected improvement findings. Codex Task D does not edit `app/` or design files. |
| Improvement discovery report PR | GitHub PR #48 | OPEN_AT_UPDATE_TIME | Report-only PR for `reports/review/CODEX_PARALLEL_IMPROVEMENT_DISCOVERY_20260711.md`; not a spec status change. |

---

## 3. Active SPEC Candidates

These files are active SPEC candidates, but each file's own metadata and open-issue table remain authoritative.

| File | Current repository path | Role |
|---|---|---|
| `RULE_SPEC_D1_D9.md` | `specs/active/RULE_SPEC_D1_D9.md` | D1-D9 rule semantic baseline |
| `SESSION_CLASSIFIER_SPEC.md` | `specs/active/SESSION_CLASSIFIER_SPEC.md` | Session classification baseline |
| `ATHLETE_PROFILE_SPEC.md` | `specs/active/ATHLETE_PROFILE_SPEC.md` | Athlete-scoped profile and config baseline |
| `APP_IMPLEMENTATION_BRIDGE.md` | `specs/active/APP_IMPLEMENTATION_BRIDGE.md` | Storage, consent, capability, audit, and app bridge |
| `PLAN_GENERATOR_SPEC.md` | `specs/active/PLAN_GENERATOR_SPEC.md` | Plan candidate generation contract |
| `TEMPLATE_LIBRARY_SPEC.md` | `specs/active/TEMPLATE_LIBRARY_SPEC.md` | Template ownership, lifecycle, and eligibility |
| `PHYSIO_SOURCE_TRUST_SPEC.md` | `specs/active/PHYSIO_SOURCE_TRUST_SPEC.md` | Physiological source trust, recency, conflict, and consent boundary |
| `RVE_RULE_EVALUATOR_BINDING_SPEC.md` | `specs/active/RVE_RULE_EVALUATOR_BINDING_SPEC.md` | D9 evaluator to RVE / Safety Gate / Plan Generator binding |

---

## 4. Test Package

| File | Current repository path | Treatment |
|---|---|---|
| `D9_SAFETY_EVALUATOR_V2_1_1_TEST_PACKAGE.md` | `specs/test-packages/D9_SAFETY_EVALUATOR_V2_1_1_TEST_PACKAGE.md` | Candidate package only. Markdown PASS/self-check is not runtime evidence. |

---

## 5. Legacy Reference

These files must not be deleted, but they do not directly replace the current SPEC layer.

| File | Current repository path | Treatment |
|---|---|---|
| `SOURCE_MAP.md` | `specs/legacy-reference/SOURCE_MAP.md` | Reference |
| `_SOURCE_TO_DOC_MAP_v3.0.md` | `specs/legacy-reference/_SOURCE_TO_DOC_MAP_v3.0.md` | Reference; exact `SOURCE_TO_DOC_MAP.md` was not found in the verified package |
| `GLOSSARY.md` | `specs/legacy-reference/GLOSSARY.md` | Reference |
| `02_AI_STRATEGY.md` | `specs/legacy-reference/02_AI_STRATEGY.md` | Legacy/reference |
| `06_VALIDATION_AND_SAFEGUARDS.md` | `specs/legacy-reference/06_VALIDATION_AND_SAFEGUARDS.md` | Legacy/reference |
| `11_API_AND_ENGINE_CONTRACTS.md` | `specs/legacy-reference/11_API_AND_ENGINE_CONTRACTS.md` | Legacy Phase A-F output contract; not `RULE_VALIDATION_ENGINE_CONTRACT.md` |
| `12_SCREEN_GUIDE.md` | `specs/legacy-reference/12_SCREEN_GUIDE.md` | Legacy/reference |

---

## 6. Reconstructed Or Source-Not-Verified Required Contracts

This table records exact repository file state. Text references, chapter titles, and status rows do not count as file existence.

| Required file | Expected repository area | Status | Required treatment |
|---|---|---|---|
| `RULE_VALIDATION_ENGINE_CONTRACT.md` | `specs/reconstruct/RULE_VALIDATION_ENGINE_CONTRACT.md` | RECONSTRUCTED_DRAFT_FOR_REVIEW | Reconstructed draft only; not original restored, not canonical, not runtime evidence |
| `PLAN_SAFETY_GATE_SPEC.md` | `specs/reconstruct/PLAN_SAFETY_GATE_SPEC.md` | RECONSTRUCTED_DRAFT_FOR_REVIEW | Reconstructed draft only; not original restored, not canonical, not runtime evidence |
| `DAILY_LOG_AND_CHECKIN_SPEC.md` | `specs/reconstruct/DAILY_LOG_AND_CHECKIN_SPEC.md` | RECONSTRUCTED_DRAFT_FOR_REVIEW | Reconstructed draft only; not original restored, not canonical, not runtime evidence |
| `MEDIA_AND_TRANSIENT_CAPTURE_SPEC.md` | `specs/reconstruct/MEDIA_AND_TRANSIENT_CAPTURE_SPEC.md` | DRAFT_FOR_REVIEW / ACCEPTED_AS_WORKING_SOURCE_FOR_PATCHING | New/reconstructed media and transient capture contract; not canonical, not implementation evidence |
| `RACE_RECORD_AND_HISTORICAL_RECALL_SPEC.md` | `specs/reconstruct/RACE_RECORD_AND_HISTORICAL_RECALL_SPEC.md` | DRAFT_FOR_REVIEW / ACCEPTED_AS_WORKING_SOURCE_FOR_PATCHING | New/reconstructed race record and historical recall contract; not canonical, not implementation evidence |
| `METRIC_ALGORITHM_CONTRACT.md` | `specs/reconstruct/METRIC_ALGORITHM_CONTRACT.md` | DRAFT_FOR_REVIEW / ACCEPTED_AS_WORKING_SOURCE_FOR_PATCHING | Metric envelope/boundary source only; §6 formulas are not accepted while formula issue remains open |
| `COACH_RATIFICATION_SAFETY_DEFAULTS_2026_06_04_001` | `specs/reconstruct/` or evidence area | MISSING_OR_SOURCE_NOT_VERIFIED | Do not claim ratification found until local evidence exists |

---

## 6A. Productization Drafts

These files translate the safety/spec core into product surfaces. They are not canonical promotion and not runtime evidence.

| Productization draft | Repository path | Status | Required treatment |
|---|---|---|---|
| `DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC.md` | `specs/reconstruct/DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC.md` | DRAFT_FOR_REVIEW | New productization draft. Requires source refs, confidence/uncertainty, non-sensitive reason codes, and raw-text privacy boundary. Does not clear D9/Safety Gate states or create plan options. |
| `ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md` | `specs/reconstruct/ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md` | DRAFT_FOR_REVIEW | New productization draft. Defines source-backed visualization data, uncertainty/source coverage, and privacy boundary. Does not define final metric formulas, clear D9/Safety Gate states, or create plan options. |
| `PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md` | `specs/reconstruct/PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md` | DRAFT_FOR_REVIEW | New productization draft. Defines privacy-safe plan rationale bundles using source refs, rationale codes, privacy tiers, and redaction states. Does not create/select plan options, clear D9/Safety Gate states, or close Plan Generator issues. |
| `MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md` | `specs/reconstruct/MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md` | DRAFT_FOR_REVIEW | New productization draft. Defines namespace-safe 9.5-day cycle, `CYCLE_DAY`, planned-date/session-slot, race-anchor, and Calendar projection mapping. Does not create/select plan options, redefine D-rules, or clear D9/Safety Gate states. |
| `TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md` | `specs/reconstruct/TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md` | DRAFT_FOR_REVIEW | First-pilot policy draft, grounded by `TRAINING_PLAN_METHOD_DECISION.md` and audited in `TRAINING_PLAN_BLUEPRINT_MULTIPERSPECTIVE_REVIEW.md`. Ten canonical blockers remain; not canonical or runtime evidence. |
| `EXTERNAL_RECORD_INTEGRATION_SPEC.md` | `specs/reconstruct/EXTERNAL_RECORD_INTEGRATION_SPEC.md` | DRAFT_FOR_REVIEW / MERGED_TO_MAIN | Work Order 005 Task A draft. Defines one-way inbound external PB/SB record boundaries, consent, freshness display, conflict handling, and non-safety authority. Not canonical or runtime evidence. |
| `COMPOSITION_BALANCE_BASELINE_CONTRACT.md` | `specs/reconstruct/COMPOSITION_BALANCE_BASELINE_CONTRACT.md` | DRAFT_FOR_REVIEW / MERGED_TO_MAIN | Work Order 005 Task B draft. Defines baseline basis, period axis, athlete-level placeholder, display states, demo badge requirement, and non-safety authority. Not canonical or runtime evidence. |
| `JOURNAL_DELIGHT_AND_DECORATION_SPEC.md` | `specs/reconstruct/JOURNAL_DELIGHT_AND_DECORATION_SPEC.md` | DRAFT_FOR_REVIEW / MERGED_TO_MAIN | Work Order 006 Task A draft. Defines journal-only mode, decoration catalog boundaries, safe unlock constraints, and streak handling that must not reward training load. Not canonical or runtime evidence. |
| `LOCAL_FIRST_SYNC_AND_PROMOTION_CONTRACT.md` | `specs/reconstruct/LOCAL_FIRST_SYNC_AND_PROMOTION_CONTRACT.md` | DRAFT_FOR_REVIEW / MERGED_TO_MAIN | Work Order 006 Task B draft. Defines local-first journal persistence, later account-linked promotion, conflict handling, and memo/privacy boundaries. Not canonical or runtime evidence. |
| `FEDERATED_ACCOUNT_SSO_CONTRACT.md` | `specs/reconstruct/FEDERATED_ACCOUNT_SSO_CONTRACT.md` | DRAFT_FOR_REVIEW / MERGED_TO_MAIN | Work Order 006 Task C draft. Defines "Continue with AthleteTime" identity federation boundaries while keeping TrainOracle storage, consent, and safety authority separate. Not canonical or runtime evidence. |

---

## 7. Namespace Policy

Bare D-rule references are forbidden in new SPEC work.

| Namespace | Example | Meaning |
|---|---|---|
| `RULE_SPEC_D1_D9` | `RULE_SPEC_D1_D9.D-9` | Current SPEC-layer validation rule |
| `LEGACY_PHASE_D` | `LEGACY_PHASE_D.D-9` | Old workflow Phase D validation item |
| `CYCLE_DAY` | `CYCLE_DAY.D-5` | Cycle or race-day label, not a rule id |

---

## 8. Safety And Privacy Invariants

- No global coach authority.
- No safety hard-stop override.
- No D-rule semantic redefinition outside `RULE_SPEC_D1_D9.md`.
- No external LLM with private athlete data.
- Raw athlete free-text, raw symptom clauses, injury narratives, medical notes, guardian private notes, and sensitive free-form comments must not be stored in audit contracts.
- Reason-code storage is preferred.
- Free-text can raise risk but cannot clear existing risk.
- Good physiological data cannot clear D9 risk.
- Template selection cannot clear D9 risk.
- `D9_ACTIVE` blocks plan generation.
- `D9_UNKNOWN` blocks generation or requires human review.
- `D9_CLEARED` is not medical clearance.
- Advisory is not a fourth D9 disposition; it is a non-blocking sub-status under `D9_CLEARED`.

---

## 9. Next Work Order

1. Re-open target files in this repository before making claims about file status, issue counts, or blockers.
2. Review `SPEC_TARGET_PATCH_MATRIX.md` before any target patch; it records the next source-to-target order and the non-closure conditions.
3. Use `SPEC_REVIEW_PACKET.md` before external review; assign a specific reviewer lens rather than asking for generic feedback.
4. Use `SPEC_TARGET_PATCH_READINESS.md` before target patches; it records readiness gates and patch waves.
5. Review `specs/reconstruct/RULE_VALIDATION_ENGINE_CONTRACT.md` as a reconstructed draft; do not treat it as an original or accepted contract yet.
6. Review `specs/reconstruct/PLAN_SAFETY_GATE_SPEC.md` as a reconstructed draft; do not treat it as an original or accepted contract yet.
7. Review `specs/reconstruct/DAILY_LOG_AND_CHECKIN_SPEC.md` as a reconstructed draft; do not treat it as an original or accepted contract yet.
8. Recheck `PLAN_GENERATOR_SPEC.md` open issue table from the file itself before any target patch.
9. Review the Wave 1 physio source consumption target patches in `PLAN_GENERATOR_SPEC.md`, `APP_IMPLEMENTATION_BRIDGE.md`, and `ATHLETE_PROFILE_SPEC.md`; do not close related issues before source acceptance and target recount approval.
10. Review the Wave B Safety Gate target-local patch in `PLAN_GENERATOR_SPEC.md`; do not close `OI-PG-RULE-SAFETY-GATE-BINDING-001` before source acceptance, target recount approval, tracked D9 evidence coverage assessment, and any missing runtime evidence.
11. Use `SPEC_SOURCE_ACCEPTANCE_REVIEW_ROUND1.md` before treating reconstructed Safety Gate/RVE documents as accepted sources.
12. Review `SPEC_WAVED_BINDING_PATCH_REPORT.md`; Wave D issues remain open until implementation/runtime evidence and owner approval.
13. Assess the tracked 11-case D9 evaluator output against target coverage and obtain only the missing terminal/CI evidence before closing RVE or Plan Generator safety-gate binding issues.
14. Review `specs/reconstruct/DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC.md` as a productization draft; do not treat it as canonical, runtime evidence, or downstream issue closure.
15. Review `specs/reconstruct/ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md` as a productization draft; do not treat it as metric formula authority, canonical, runtime evidence, or downstream issue closure.
16. Review `specs/reconstruct/PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md` as a productization draft; do not treat it as Plan Generator issue closure, canonical, runtime evidence, or downstream issue closure.
17. Review `specs/reconstruct/MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md` as a productization draft; do not treat it as Plan Generator issue closure, canonical, runtime evidence, D-rule redefinition, or downstream issue closure.
18. Review `TRAINING_PLAN_BLUEPRINT_MULTIPERSPECTIVE_REVIEW.md`, `TRAINING_PLAN_METHOD_DECISION.md`, and the Formation spec together; ten canonical blockers remain open.
19. Review `specs/reconstruct/EXTERNAL_RECORD_INTEGRATION_SPEC.md` as a merged local draft; do not implement AthleteTime integration until API reality, terms, consent, and owner decisions are verified.
20. Review `specs/reconstruct/COMPOSITION_BALANCE_BASELINE_CONTRACT.md` as a merged local draft; keep placeholder baselines visibly marked as demo until accepted by owner decision.
21. Review `specs/reconstruct/JOURNAL_DELIGHT_AND_DECORATION_SPEC.md` as a merged local draft; decoration, streaks, and unlocks must not reward training volume or hide pain/rest/injury signals.
22. Review `specs/reconstruct/LOCAL_FIRST_SYNC_AND_PROMOTION_CONTRACT.md` as a merged local draft; raw memo/server persistence remains unresolved until owner policy and encryption/retention decisions are accepted.
23. Review `specs/reconstruct/FEDERATED_ACCOUNT_SSO_CONTRACT.md` as a merged local draft; AthleteTime is identity context only and does not grant TrainOracle safety, storage, or coaching authority.
24. Read `ACCOUNT_FEDERATION_DECISION.md`, `ATHLETETIME_INTEGRATION_REVIEW.md`, and `LAUNCH_BACKEND_AND_ACCOUNT_PLAN.md` before backend/account work; treat them as planning context, not runtime evidence.
25. Begin App Bridge/API schema contracts and runtime evidence only after preserving the safety core chain and resolving the owner decisions called out by the account/sync drafts.

---

## 10. Evidence

Current handoff, inventory, and readiness evidence lives under `.omo/`.

Important starting points:

- `SPEC_WORK_STATUS.md`
- `TRAINING_PLAN_METHOD_DECISION.md`
- `TRAINING_PLAN_BLUEPRINT_MULTIPERSPECTIVE_REVIEW.md`
- `SPEC_DOCUMENTATION_REPORT.md`
- `SPEC_TARGET_PATCH_MATRIX.md`
- `SPEC_REVIEW_PACKET.md`
- `SPEC_TARGET_PATCH_READINESS.md`
- `SPEC_DOC_QUALITY_REPORT.md`
- `SPEC_WAVEB_SAFETY_GATE_PATCH_REPORT.md`
- `SPEC_SOURCE_ACCEPTANCE_REVIEW_ROUND1.md`
- `SPEC_WAVED_BINDING_PATCH_REPORT.md`
- `SPEC_WAVE1_PHYSIO_PATCH_REPORT.md`
- `SPEC_FILE_TRUTH_GUARD.md`
- `SPEC_LEGACY_ALIGNMENT_AND_DAILY_LOG_PLAN.md`
- `ACCOUNT_FEDERATION_DECISION.md`
- `ATHLETETIME_INTEGRATION_REVIEW.md`
- `LAUNCH_BACKEND_AND_ACCOUNT_PLAN.md`
- `.omo/drafts/train-oracle-spec-handoff.md`
- `.omo/plans/trainoracle-main-handoff-cleanup.md`
- `.omo/evidence/trainoracle-confirmed-inventory.md`
- `.omo/evidence/trainoracle-missing-quarantine.md`
- `.omo/evidence/trainoracle-remaining-work-flow-reference.md`
- `.omo/reports/trainoracle-reconstruction-readiness.md`
- `.omo/reports/github-publish-readiness.md`
- `.omo/reports/github-main-publish-complete.md`

[DRAFT_COMPLETE]
