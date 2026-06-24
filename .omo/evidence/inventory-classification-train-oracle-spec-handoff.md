# TrainOracle Local Inventory Classification

Generated: 2026-06-24 Asia/Seoul
Rule: local filenames are truth; user handoff names are reference-only until found.

## SPEC_ACTIVE Confirmed In Provided Source Folder
- FOUND: RULE_SPEC_D1_D9.md
- FOUND: SESSION_CLASSIFIER_SPEC.md
- FOUND: ATHLETE_PROFILE_SPEC.md
- FOUND: APP_IMPLEMENTATION_BRIDGE.md
- FOUND: PLAN_GENERATOR_SPEC.md
- FOUND: TEMPLATE_LIBRARY_SPEC.md
- FOUND: PHYSIO_SOURCE_TRUST_SPEC.md
- FOUND: RVE_RULE_EVALUATOR_BINDING_SPEC.md

## TEST_PACKAGES Confirmed In Provided Source Folder
- FOUND: D9_SAFETY_EVALUATOR_V2_1_1_TEST_PACKAGE.md (candidate package only, not runtime evidence)

## LEGACY_REFERENCE Confirmed In Provided Source Folder
- FOUND: SOURCE_MAP.md
- NOT FOUND UNDER EXACT NAME: SOURCE_TO_DOC_MAP.md
- FOUND: _SOURCE_TO_DOC_MAP_v3.0.md
- FOUND: GLOSSARY.md
- FOUND: 02_AI_STRATEGY.md
- FOUND: 06_VALIDATION_AND_SAFEGUARDS.md
- FOUND: 11_API_AND_ENGINE_CONTRACTS.md
- FOUND: 12_SCREEN_GUIDE.md

## MISSING_OR_RECONSTRUCT Search Result
- NOT FOUND IN SEARCHED ROOTS: RULE_VALIDATION_ENGINE_CONTRACT.md
- NOT FOUND IN SEARCHED ROOTS: PLAN_SAFETY_GATE_SPEC.md

## Quick Duplicate/Stale Heuristic On Provided 16 Files
| file | H1 count | DRAFT_COMPLETE lines | notes |
| --- | ---: | --- | --- |
| _SOURCE_TO_DOC_MAP_v3.0.md | 1 | none | none from quick heuristic |
| 02_AI_STRATEGY.md | 1 | none | none from quick heuristic |
| 06_VALIDATION_AND_SAFEGUARDS.md | 1 | none | none from quick heuristic |
| 11_API_AND_ENGINE_CONTRACTS.md | 1 | none | none from quick heuristic |
| 12_SCREEN_GUIDE.md | 1 | none | none from quick heuristic |
| APP_IMPLEMENTATION_BRIDGE.md | 1 | 988:[DRAFT_COMPLETE] | none from quick heuristic |
| ATHLETE_PROFILE_SPEC.md | 1 | none | none from quick heuristic |
| D9_SAFETY_EVALUATOR_V2_1_1_TEST_PACKAGE.md | 1 | none | none from quick heuristic |
| GLOSSARY.md | 1 | none | none from quick heuristic |
| PHYSIO_SOURCE_TRUST_SPEC.md | 1 | 1004:  last_line_must_be: "[DRAFT_COMPLETE]";1009:[DRAFT_COMPLETE] | none from quick heuristic |
| PLAN_GENERATOR_SPEC.md | 1 | 49:final_marker_required: "[DRAFT_COMPLETE]";841:| `PG-TC-002` | integrity | Last line is `[DRAFT_COMPLETE]`. | PASS |;929:  expected_last_line: "[DRAFT_COMPLETE]";1004:last_line: "[DRAFT_COMPLETE]";1012:[DRAFT_COMPLETE] | count lines verified separately; local file shows 7 total / 2 canonical-blocking metadata |
| RULE_SPEC_D1_D9.md | 1 | none | none from quick heuristic |
| RVE_RULE_EVALUATOR_BINDING_SPEC.md | 1 | 958:  last_line_must_be: "[DRAFT_COMPLETE]";963:[DRAFT_COMPLETE] | none from quick heuristic |
| SESSION_CLASSIFIER_SPEC.md | 1 | none | none from quick heuristic |
| SOURCE_MAP.md | 1 | none | none from quick heuristic |
| TEMPLATE_LIBRARY_SPEC.md | 1 | 731:  last_line_must_be: "[DRAFT_COMPLETE]";736:[DRAFT_COMPLETE] | none from quick heuristic |

Correction note: an earlier broad heuristic could match unrelated `9...4` or `6...1` text. The exact count-related inspection is captured in `.omo/evidence/plan-generator-count-lines-train-oracle-spec-handoff.md`, where `PLAN_GENERATOR_SPEC.md` shows `open_issues_total: 7`, `open_issues_canonical_blocking_count: 2`, and the two canonical blockers `OI-PG-RULE-SAFETY-GATE-BINDING-001` and `OI-PG-PHYSIO-SOURCE-CONSUMPTION-001`.
