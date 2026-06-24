# TrainOracle Remaining Work Flow Reference

Generated: 2026-06-24 Asia/Seoul

Source: `D:/admin/Downloads/새 텍스트 문서.md`

Treatment: handoff/reference only. This document does not prove file existence, current issue counts, canonical status, or runtime evidence. Local target files remain the source of truth.

## Identity

- `1-8`: The local file identifies itself as `TRAINORACLE_SPEC_FLOW_AND_REMAINING_WORK.md`, with `document_type: HANDOFF_REFERENCE`, `status: DRAFT_FOR_REVIEW`, and the source rule that local files take priority over memory or summaries.
- `12-26`: The file states it is not an individual TrainOracle SPEC. It organizes the total spec flow, active candidates, legacy references, remaining core specs, work order, and consistency rules. It also instructs Codex to run local inventory before creating new specs.

## Flow

- `53-67`: Core flow is philosophy/legacy/terms -> `RULE_SPEC_D1_D9.md` -> D9 Safety Evaluator -> Rule Validation Engine / RVE -> Plan Safety Gate -> Plan Generator -> UI/API/App Implementation.
- `69-83`: Supporting flow feeds Session Classifier, Template Library, Athlete Profile, Physio Source Trust, and App Implementation Bridge into Plan Generator and implementation. Plan Generator is a downstream consumer.

## Active Candidates And Verification

- `121-137`: Active candidates include the eight SPEC files plus `D9_SAFETY_EVALUATOR_V2_1_1_TEST_PACKAGE.md`; all still require local file verification before use.
- `147-159`: Template Library, Physio Source Trust, and RVE binding are recorded as save-ready in the reference, but `PLAN_SAFETY_GATE_SPEC.md`, coach ratification evidence, and `RULE_VALIDATION_ENGINE_CONTRACT.md` require local existence checks.

## Top-Priority Missing Or Unverified Work

- `163-199`: `TRAINORACLE_SPEC_INDEX.md` or `SPEC_REGISTRY.md` is top priority. It should record active, legacy, missing, duplicate/quarantine, canonical/draft/patch state, dependency, and local-file inventory.
- `202-240`: `RULE_VALIDATION_ENGINE_CONTRACT.md` is `MISSING_OR_SOURCE_NOT_VERIFIED` unless found locally. If absent, reconstruct only as `RECONSTRUCTED_DRAFT_FOR_REVIEW`; do not close `OI-RVE-RULE-EVALUATOR-BINDING-001` without runtime PASS evidence.
- `244-294`: `PLAN_SAFETY_GATE_SPEC.md` is `MISSING_OR_SOURCE_NOT_VERIFIED` unless found locally. Its role is to consume RVE/D9 signal before Plan Generator and block D9 ACTIVE/UNKNOWN while keeping advisory non-blocking.

## Remaining Downstream Work

- `295-345`: Plan Generator still needs Physio Source Consumption and Rule Safety Gate Binding work, including local target verification, upstream dependency checks, and runtime evidence where applicable.
- `480-627`: Later remaining work includes template event catalog expansion, template UI copy/catalog browsing, coach feedback loop, multilingual taxonomy, Athlete Profile physio source patch, App Bridge physio source patch, and App Bridge safety gate patch.

## Required Order

- `635-678`: Phase order is index/registry and inventory first; safety core recovery second; runtime evidence third; Plan Generator completion fourth; peripheral consumer alignment fifth.
- `697-756`: New specs and patches must preserve source truth, explicit dependencies, D9 safety invariants, raw-text storage prohibitions, count rules, and the runtime-test evidence distinction.
- `763-839`: Immediate priority is document order: create `TRAINORACLE_SPEC_INDEX.md`, run local inventory, verify missing core documents, recheck Plan Generator issue table, confirm physio patch state, obtain RVE/Safety Gate runtime evidence, finish Plan Generator safety binding, then proceed to productization specs.

## Operational Consequence

The next TrainOracle SPEC execution should not be framed as "missing contract reconstruction only." It should first lock the registry/index layer, then perform final local existence checks, then reconstruct `RULE_VALIDATION_ENGINE_CONTRACT.md` and `PLAN_SAFETY_GATE_SPEC.md` if still absent. Productization specs remain later-phase work.
