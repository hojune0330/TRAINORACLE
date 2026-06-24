# TrainOracle Missing And Quarantine Detector

Generated: 2026-06-24 Asia/Seoul

Rule: detection only. No source files moved, renamed, or edited.

## Search Roots

- `D:\admin\Documents` depth<=7
- `D:\admin\Downloads` depth<=7

## Required / Alias Filename Search

| target | result | paths |
| --- | --- | --- |
| `RULE_VALIDATION_ENGINE_CONTRACT.md` | NOT_FOUND |  |
| `PLAN_SAFETY_GATE_SPEC.md` | NOT_FOUND |  |
| `COACH_RATIFICATION_SAFETY_DEFAULTS_2026_06_04_001` | NOT_FOUND |  |
| `COACH_RATIFICATION_SAFETY_DEFAULTS_2026_06_04_001.md` | NOT_FOUND |  |
| `SOURCE_TO_DOC_MAP.md` | NOT_FOUND |  |

## Source Package Quarantine Heuristics

| file | H1 count | DRAFT_COMPLETE matches | last marker line | text after last marker | notes |
| --- | ---: | ---: | --- | --- | --- |
| `_SOURCE_TO_DOC_MAP_v3.0.md` | 1 | 0 | none | n/a | NO_DRAFT_COMPLETE_MARKER_REVIEW_ONLY |
| `02_AI_STRATEGY.md` | 1 | 0 | none | n/a | NO_DRAFT_COMPLETE_MARKER_REVIEW_ONLY |
| `06_VALIDATION_AND_SAFEGUARDS.md` | 1 | 0 | none | n/a | NO_DRAFT_COMPLETE_MARKER_REVIEW_ONLY |
| `11_API_AND_ENGINE_CONTRACTS.md` | 1 | 0 | none | n/a | NO_DRAFT_COMPLETE_MARKER_REVIEW_ONLY |
| `12_SCREEN_GUIDE.md` | 1 | 0 | none | n/a | NO_DRAFT_COMPLETE_MARKER_REVIEW_ONLY |
| `APP_IMPLEMENTATION_BRIDGE.md` | 1 | 1 | 988 | NO |  |
| `ATHLETE_PROFILE_SPEC.md` | 1 | 0 | none | n/a | NO_DRAFT_COMPLETE_MARKER_REVIEW_ONLY |
| `D9_SAFETY_EVALUATOR_V2_1_1_TEST_PACKAGE.md` | 1 | 0 | none | n/a | NO_DRAFT_COMPLETE_MARKER_REVIEW_ONLY |
| `GLOSSARY.md` | 1 | 0 | none | n/a | NO_DRAFT_COMPLETE_MARKER_REVIEW_ONLY |
| `PHYSIO_SOURCE_TRUST_SPEC.md` | 1 | 2 | 1009 | NO | PHYSIO_ABSOLUTE_COUNT_POLICY_PRESENT |
| `PLAN_GENERATOR_SPEC.md` | 1 | 5 | 1012 | NO | PLAN_GENERATOR_CURRENT_METADATA_7_2_CONFIRMED |
| `RULE_SPEC_D1_D9.md` | 1 | 0 | none | n/a | NO_DRAFT_COMPLETE_MARKER_REVIEW_ONLY |
| `RVE_RULE_EVALUATOR_BINDING_SPEC.md` | 1 | 2 | 963 | NO | RVE_ADVISORY_TEXT_PRESENT_REVIEW_OK |
| `SESSION_CLASSIFIER_SPEC.md` | 1 | 0 | none | n/a | NO_DRAFT_COMPLETE_MARKER_REVIEW_ONLY |
| `SOURCE_MAP.md` | 1 | 0 | none | n/a | NO_DRAFT_COMPLETE_MARKER_REVIEW_ONLY |
| `TEMPLATE_LIBRARY_SPEC.md` | 1 | 2 | 736 | NO | TEMPLATE_TEST_POLICY_TEXT_PRESENT |

## PLAN_GENERATOR_SPEC Count Evidence

- `44:   open_issues_total: 7`
- `45:   open_issues_canonical_blocking_count: 2`
- `126: | Rule safety hard-stop runtime binding | `RULE_SPEC_D1_D9.md v1.4` / `APP_IMPLEMENTATION_BRIDGE.md v1.1` | Runtime detection and binding tracked by `OI-PG-RULE-SAFETY-GATE-BINDING-001` | PARTIAL_OPEN |`
- `133: | Physiological source trust | `APP_IMPLEMENTATION_BRIDGE.md v1.1` | Physiological source consumption policy remains open through `OI-PG-PHYSIO-SOURCE-CONSUMPTION-001` | PARTIAL_OPEN |`
- `357:       tracked_by: OI-PG-PHYSIO-SOURCE-CONSUMPTION-001`
- `826: | `OI-PG-RULE-SAFETY-GATE-BINDING-001` | P1 | YES | OPEN | Runtime binding between active `RULE_SPEC_D1_D9.D-9` state and generation block must be finalized. | Define exact bridge query and active-state interpretation. |`
- `827: | `OI-PG-PHYSIO-SOURCE-CONSUMPTION-001` | P1 | YES | OPEN | Trusted physiological source consumption remains unresolved. | Bind to APP Bridge physiology source-trust resolution. |`
- `935:   expected_open_issues_total: 7`
- `979:   remaining_canonical_blocking_open_issues:`
- `980:     - OI-PG-RULE-SAFETY-GATE-BINDING-001`
- `981:     - OI-PG-PHYSIO-SOURCE-CONSUMPTION-001`

## PHYSIO_SOURCE_TRUST_SPEC Downstream Count Evidence

- `915:   downstream_absolute_count_not_declared: SATISFIED`
- `926: 이 문서는 downstream target의 절대 open issue count를 단정하지 않는다.`
- `940:   expected_relative_delta:`
- `942:     canonical_blocking_count: -1`
- `944: absolute_count_policy:`
- `945:   target_document_absolute_counts_not_declared_here: true`
- `946:   reason: "PLAN_GENERATOR_SPEC.md counts must be verified directly at patch application time."`
- `957:   - apply_relative_delta_only_after_patch_application`
- `959:   - recompute_canonical_blocking_count_from_table`

## Quarantine Candidate Summary

- No quarantine candidate found by these source-package heuristics. Review-only marker gaps are listed above but not quarantined automatically.

## Unsupported Claims Avoided

- Missing means not found in the stated search roots/depth, not proof of nonexistence on the entire machine.
- Markdown PASS/self-check lines are not runtime evidence.
- No issue is closed by this detector.
