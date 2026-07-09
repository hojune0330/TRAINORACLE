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
- which productization SPECs still need to be written

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
10. Review the Wave B Safety Gate target-local patch in `PLAN_GENERATOR_SPEC.md`; do not close `OI-PG-RULE-SAFETY-GATE-BINDING-001` before source acceptance, target recount approval, and actual D9 runtime evidence.
11. Use `SPEC_SOURCE_ACCEPTANCE_REVIEW_ROUND1.md` before treating reconstructed Safety Gate/RVE documents as accepted sources.
12. Review `SPEC_WAVED_BINDING_PATCH_REPORT.md`; Wave D issues remain open until implementation/runtime evidence and owner approval.
13. Obtain actual D9 evaluator runtime output before closing RVE or Plan Generator safety-gate binding issues.
14. Review `specs/reconstruct/DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC.md` as a productization draft; do not treat it as canonical, runtime evidence, or downstream issue closure.
15. Review `specs/reconstruct/ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md` as a productization draft; do not treat it as metric formula authority, canonical, runtime evidence, or downstream issue closure.
16. Review `specs/reconstruct/PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md` as a productization draft; do not treat it as Plan Generator issue closure, canonical, runtime evidence, or downstream issue closure.
17. Review `specs/reconstruct/MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md` as a productization draft; do not treat it as Plan Generator issue closure, canonical, runtime evidence, D-rule redefinition, or downstream issue closure.
18. Begin App Bridge/API schema contracts and runtime evidence only after preserving the safety core chain.

---

## 10. Evidence

Current handoff, inventory, and readiness evidence lives under `.omo/`.

Important starting points:

- `SPEC_WORK_STATUS.md`
- `SPEC_DOCUMENTATION_REPORT.md`
- `SPEC_TARGET_PATCH_MATRIX.md`
- `SPEC_REVIEW_PACKET.md`
- `SPEC_TARGET_PATCH_READINESS.md`
- `SPEC_WAVEB_SAFETY_GATE_PATCH_REPORT.md`
- `SPEC_SOURCE_ACCEPTANCE_REVIEW_ROUND1.md`
- `SPEC_WAVED_BINDING_PATCH_REPORT.md`
- `SPEC_WAVE1_PHYSIO_PATCH_REPORT.md`
- `SPEC_FILE_TRUTH_GUARD.md`
- `SPEC_LEGACY_ALIGNMENT_AND_DAILY_LOG_PLAN.md`
- `.omo/drafts/train-oracle-spec-handoff.md`
- `.omo/plans/trainoracle-main-handoff-cleanup.md`
- `.omo/evidence/trainoracle-confirmed-inventory.md`
- `.omo/evidence/trainoracle-missing-quarantine.md`
- `.omo/evidence/trainoracle-remaining-work-flow-reference.md`
- `.omo/reports/trainoracle-reconstruction-readiness.md`
- `.omo/reports/github-publish-readiness.md`
- `.omo/reports/github-main-publish-complete.md`

[DRAFT_COMPLETE]
