# TrainOracle Reconstruction Readiness Brief

Generated: 2026-06-24 Asia/Seoul

Scope: readiness only. This does not reconstruct product SPEC files, close issues, or claim runtime evidence.

## New Remaining-Work Reference

`D:/admin/Downloads/새 텍스트 문서.md` is now `TRAINORACLE_SPEC_FLOW_AND_REMAINING_WORK.md`, not the earlier charter content. It is a handoff/reference document, not an active SPEC baseline, but it changes the next-work ordering:

- The spec set is still incomplete.
- `TRAINORACLE_SPEC_INDEX.md` or `SPEC_REGISTRY.md` is top priority before more SPEC expansion.
- Missing/unverified core documents still require local existence checks before reconstruction.
- `RULE_VALIDATION_ENGINE_CONTRACT.md` and `PLAN_SAFETY_GATE_SPEC.md` remain missing/source-not-verified unless found locally.
- Productization specs such as output format, privacy rationale, taper policy, microcycle mapping, template catalog expansion, UI copy, feedback loop, and multilingual taxonomy are later phases.

Evidence summary: `.omo/evidence/trainoracle-remaining-work-flow-reference.md`.

## Global Rules For Next Worker

- Local files are truth; conversation ledgers and belief files are references only.
- Use `RECONSTRUCTED_DRAFT_FOR_REVIEW` for missing contracts unless a local original is later found.
- Do not claim original file restored, previous approved version restored, canonical promotion, or issue closure.
- `11_API_AND_ENGINE_CONTRACTS.md` is a legacy Phase A-F output contract, not `RULE_VALIDATION_ENGINE_CONTRACT.md`.
- Do not redefine `RULE_SPEC_D1_D9.D-*` semantics outside `RULE_SPEC_D1_D9.md`.
- Keep `RULE_SPEC_D1_D9.D-*`, `LEGACY_PHASE_D.D-*`, and `CYCLE_DAY.D-*` namespaces separate.
- D9 ACTIVE and D9 UNKNOWN block generation or require human review; D9 CLEARED is not medical clearance.
- ADVISORY is not a fourth blocking disposition; it is under CLEARED, stored as CLEARED, and does not block Plan Generator.
- Raw athlete free-text, raw symptom clauses, injury narratives, medical notes, and guardian private notes must not be stored.
- Markdown PASS/self-check is not runtime evidence; actual D9 evaluator execution logs are required before RVE/PG binding issue closure.

## Target 1: RULE_VALIDATION_ENGINE_CONTRACT.md

Recommended status: `RECONSTRUCTED_DRAFT_FOR_REVIEW` if still absent after final local search.

Purpose: define the Rule Validation Engine contract that consumes rule/evaluator results and emits auditable rule-validation signals without changing D-rule semantics.

Primary sources to open before writing:

- `D:\admin\Downloads\정본 제작 1차\RULE_SPEC_D1_D9.md`
  - `D:\admin\Downloads\정본 제작 1차\RULE_SPEC_D1_D9.md:31` This specification defines the TrainOracle D-rule validator for D-1 through D-9.
  - `D:\admin\Downloads\정본 제작 1차\RULE_SPEC_D1_D9.md:38` 1. D-1 to D-9 rule meanings and validator outputs.
  - `D:\admin\Downloads\정본 제작 1차\RULE_SPEC_D1_D9.md:177` meaning: "Derived training validation rule D-1 through D-9"
  - `D:\admin\Downloads\정본 제작 1차\RULE_SPEC_D1_D9.md:339` - D-9
  - `D:\admin\Downloads\정본 제작 1차\RULE_SPEC_D1_D9.md:400` - D-9
  - `D:\admin\Downloads\정본 제작 1차\RULE_SPEC_D1_D9.md:408` ## 8. D-Rule Definitions
  - `D:\admin\Downloads\정본 제작 1차\RULE_SPEC_D1_D9.md:864` ### D-9 — Safety Hard-Stop Guard
  - `D:\admin\Downloads\정본 제작 1차\RULE_SPEC_D1_D9.md:867` D-9:
  - `D:\admin\Downloads\정본 제작 1차\RULE_SPEC_D1_D9.md:1077` D-9:
  - `D:\admin\Downloads\정본 제작 1차\RULE_SPEC_D1_D9.md:1215` D-9_behavior:
  - `D:\admin\Downloads\정본 제작 1차\RULE_SPEC_D1_D9.md:1225` ## 11. Implementation Invariants
  - `D:\admin\Downloads\정본 제작 1차\RULE_SPEC_D1_D9.md:1246` ## 12. TypeScript Contract
  - `D:\admin\Downloads\정본 제작 1차\RULE_SPEC_D1_D9.md:1269` | "D-9";
  - `D:\admin\Downloads\정본 제작 1차\RULE_SPEC_D1_D9.md:1566` title: "D-9 public fixed trigger thresholds require canonical confirmation"
  - `D:\admin\Downloads\정본 제작 1차\RULE_SPEC_D1_D9.md:1694` ## 14. Test Cases
  - `D:\admin\Downloads\정본 제작 1차\RULE_SPEC_D1_D9.md:1750` | TC-D9-045 | D-9 | no safety signal | OK | PASS |
  - `D:\admin\Downloads\정본 제작 1차\RULE_SPEC_D1_D9.md:1751` | TC-D9-046 | D-9 | safety hard-stop active | ERROR_SAFETY | PASS |
  - `D:\admin\Downloads\정본 제작 1차\RULE_SPEC_D1_D9.md:1752` | TC-D9-047 | D-9 | hard stop blocks AI recommendation | blocked | PASS |
  - `D:\admin\Downloads\정본 제작 1차\RULE_SPEC_D1_D9.md:1753` | TC-D9-048 | D-9 | hard stop does not claim to block real-world training | false | PASS |
  - `D:\admin\Downloads\정본 제작 1차\RULE_SPEC_D1_D9.md:1754` | TC-D9-049 | D-9 | SOLO self acknowledgement | recorded only | PASS |
  - `D:\admin\Downloads\정본 제작 1차\RULE_SPEC_D1_D9.md:1755` | TC-D9-050 | D-9 | safety exception approval attempt | denied | PASS |
  - `D:\admin\Downloads\정본 제작 1차\RULE_SPEC_D1_D9.md:1843` summary: "Micro-patch: D-9 split, D-4 confidence handling, TypeScript corrections, test count 55"
- `D:\admin\Downloads\정본 제작 1차\RVE_RULE_EVALUATOR_BINDING_SPEC.md`
  - `D:\admin\Downloads\정본 제작 1차\RVE_RULE_EVALUATOR_BINDING_SPEC.md:197` ## 6. Core Status Semantics
  - `D:\admin\Downloads\정본 제작 1차\RVE_RULE_EVALUATOR_BINDING_SPEC.md:268` ## 8. RVE Signal Contract
  - `D:\admin\Downloads\정본 제작 1차\RVE_RULE_EVALUATOR_BINDING_SPEC.md:365` ## 10. Binding Algorithm
  - `D:\admin\Downloads\정본 제작 1차\RVE_RULE_EVALUATOR_BINDING_SPEC.md:414` ## 11. Evaluator Failure Handling
  - `D:\admin\Downloads\정본 제작 1차\RVE_RULE_EVALUATOR_BINDING_SPEC.md:448` ## 12. Plan Safety Gate Consumption
  - `D:\admin\Downloads\정본 제작 1차\RVE_RULE_EVALUATOR_BINDING_SPEC.md:480` ## 13. Plan Generator Consumption
  - `D:\admin\Downloads\정본 제작 1차\RVE_RULE_EVALUATOR_BINDING_SPEC.md:585` ## 16. Execution Evidence Requirement
  - `D:\admin\Downloads\정본 제작 1차\RVE_RULE_EVALUATOR_BINDING_SPEC.md:621` ## 17. Failure Log Contract
  - `D:\admin\Downloads\정본 제작 1차\RVE_RULE_EVALUATOR_BINDING_SPEC.md:676` ## 19. TypeScript Contract Draft
- `D:\admin\Downloads\정본 제작 1차\APP_IMPLEMENTATION_BRIDGE.md`
  - `D:\admin\Downloads\정본 제작 1차\APP_IMPLEMENTATION_BRIDGE.md:181` ## Section 4. Tenancy and Isolation Model
  - `D:\admin\Downloads\정본 제작 1차\APP_IMPLEMENTATION_BRIDGE.md:216` ## Section 5. Capability and Consent Model
  - `D:\admin\Downloads\정본 제작 1차\APP_IMPLEMENTATION_BRIDGE.md:402` ## Section 8. Cross-Spec Data Flow
  - `D:\admin\Downloads\정본 제작 1차\APP_IMPLEMENTATION_BRIDGE.md:452` ## Section 9. API Surface Draft
  - `D:\admin\Downloads\정본 제작 1차\APP_IMPLEMENTATION_BRIDGE.md:497` ## Section 11. Safety and Privacy Invariants
  - `D:\admin\Downloads\정본 제작 1차\APP_IMPLEMENTATION_BRIDGE.md:530` ## Section 12. TypeScript Contract
- `D:\admin\Downloads\정본 제작 1차\D9_SAFETY_EVALUATOR_V2_1_1_TEST_PACKAGE.md`
  - `D:\admin\Downloads\정본 제작 1차\D9_SAFETY_EVALUATOR_V2_1_1_TEST_PACKAGE.md:12` ## 목적
  - `D:\admin\Downloads\정본 제작 1차\D9_SAFETY_EVALUATOR_V2_1_1_TEST_PACKAGE.md:22` ## 실행 방법
  - `D:\admin\Downloads\정본 제작 1차\D9_SAFETY_EVALUATOR_V2_1_1_TEST_PACKAGE.md:31` ## TypeScript / Vitest 파일
  - `D:\admin\Downloads\정본 제작 1차\D9_SAFETY_EVALUATOR_V2_1_1_TEST_PACKAGE.md:611` ## 실패 로그 제출 형식
  - `D:\admin\Downloads\정본 제작 1차\D9_SAFETY_EVALUATOR_V2_1_1_TEST_PACKAGE.md:625` ## 운영 저장 원칙

Minimum outline:

1. `# RULE_VALIDATION_ENGINE_CONTRACT.md`
2. metadata with `status: RECONSTRUCTED_DRAFT_FOR_REVIEW`, `executed_tests_total: 0` unless runtime log exists
3. Purpose / Non-purpose
4. Upstream source priority and namespace separation
5. RVE input boundary and opaque D-rule result passthrough
6. D9 signal handling: ACTIVE, UNKNOWN, CLEARED, CLEARED_WITH_ADVISORY as CLEARED sub-status
7. Audit/privacy model with reason-code storage and raw-text prohibition
8. Runtime evidence requirement and failure log contract
9. Open issues table; no closure without target patch and runtime evidence
10. `[DRAFT_COMPLETE]` as final line

Must not claim: original restored; prior approved version restored; RVE binding issue closed; D9 evaluator passed runtime tests; medical clearance.

## Target 2: PLAN_SAFETY_GATE_SPEC.md

Recommended status: `RECONSTRUCTED_DRAFT_FOR_REVIEW` if still absent after final local search.

Purpose: define the pre-generation safety gate that consumes RVE/D9 signals before Plan Generator creates or applies training candidates.

Primary sources to open before writing:

- `D:\admin\Downloads\정본 제작 1차\PLAN_GENERATOR_SPEC.md`
  - `D:\admin\Downloads\정본 제작 1차\PLAN_GENERATOR_SPEC.md:126` | Rule safety hard-stop runtime binding | `RULE_SPEC_D1_D9.md v1.4` / `APP_IMPLEMENTATION_BRIDGE.md v1.1` | Runtime detection and binding tracked by `OI-PG-RULE-SAFETY-GATE-BINDING-001` | PARTIAL_OPEN |
  - `D:\admin\Downloads\정본 제작 1차\PLAN_GENERATOR_SPEC.md:133` | Physiological source trust | `APP_IMPLEMENTATION_BRIDGE.md v1.1` | Physiological source consumption policy remains open through `OI-PG-PHYSIO-SOURCE-CONSUMPTION-001` | PARTIAL_OPEN |
  - `D:\admin\Downloads\정본 제작 1차\PLAN_GENERATOR_SPEC.md:137` ## 2. Hard Constraints
  - `D:\admin\Downloads\정본 제작 1차\PLAN_GENERATOR_SPEC.md:308` ## 6. Safety Gate
  - `D:\admin\Downloads\정본 제작 1차\PLAN_GENERATOR_SPEC.md:357` tracked_by: OI-PG-PHYSIO-SOURCE-CONSUMPTION-001
  - `D:\admin\Downloads\정본 제작 1차\PLAN_GENERATOR_SPEC.md:780` ## 9. API Surface Draft
  - `D:\admin\Downloads\정본 제작 1차\PLAN_GENERATOR_SPEC.md:795` ## 10. Safety, Privacy, and LLM Policy
  - `D:\admin\Downloads\정본 제작 1차\PLAN_GENERATOR_SPEC.md:826` | `OI-PG-RULE-SAFETY-GATE-BINDING-001` | P1 | YES | OPEN | Runtime binding between active `RULE_SPEC_D1_D9.D-9` state and generation block must be finalized. | Define exact bridge query and active-state interpretation. |
  - `D:\admin\Downloads\정본 제작 1차\PLAN_GENERATOR_SPEC.md:827` | `OI-PG-PHYSIO-SOURCE-CONSUMPTION-001` | P1 | YES | OPEN | Trusted physiological source consumption remains unresolved. | Bind to APP Bridge physiology source-trust resolution. |
  - `D:\admin\Downloads\정본 제작 1차\PLAN_GENERATOR_SPEC.md:980` - OI-PG-RULE-SAFETY-GATE-BINDING-001
  - `D:\admin\Downloads\정본 제작 1차\PLAN_GENERATOR_SPEC.md:981` - OI-PG-PHYSIO-SOURCE-CONSUMPTION-001
- `D:\admin\Downloads\정본 제작 1차\RVE_RULE_EVALUATOR_BINDING_SPEC.md`
  - `D:\admin\Downloads\정본 제작 1차\RVE_RULE_EVALUATOR_BINDING_SPEC.md:197` ## 6. Core Status Semantics
  - `D:\admin\Downloads\정본 제작 1차\RVE_RULE_EVALUATOR_BINDING_SPEC.md:268` ## 8. RVE Signal Contract
  - `D:\admin\Downloads\정본 제작 1차\RVE_RULE_EVALUATOR_BINDING_SPEC.md:365` ## 10. Binding Algorithm
  - `D:\admin\Downloads\정본 제작 1차\RVE_RULE_EVALUATOR_BINDING_SPEC.md:414` ## 11. Evaluator Failure Handling
  - `D:\admin\Downloads\정본 제작 1차\RVE_RULE_EVALUATOR_BINDING_SPEC.md:448` ## 12. Plan Safety Gate Consumption
  - `D:\admin\Downloads\정본 제작 1차\RVE_RULE_EVALUATOR_BINDING_SPEC.md:480` ## 13. Plan Generator Consumption
  - `D:\admin\Downloads\정본 제작 1차\RVE_RULE_EVALUATOR_BINDING_SPEC.md:585` ## 16. Execution Evidence Requirement
  - `D:\admin\Downloads\정본 제작 1차\RVE_RULE_EVALUATOR_BINDING_SPEC.md:621` ## 17. Failure Log Contract
  - `D:\admin\Downloads\정본 제작 1차\RVE_RULE_EVALUATOR_BINDING_SPEC.md:676` ## 19. TypeScript Contract Draft
- `D:\admin\Downloads\정본 제작 1차\RULE_SPEC_D1_D9.md`
  - `D:\admin\Downloads\정본 제작 1차\RULE_SPEC_D1_D9.md:31` This specification defines the TrainOracle D-rule validator for D-1 through D-9.
  - `D:\admin\Downloads\정본 제작 1차\RULE_SPEC_D1_D9.md:38` 1. D-1 to D-9 rule meanings and validator outputs.
  - `D:\admin\Downloads\정본 제작 1차\RULE_SPEC_D1_D9.md:177` meaning: "Derived training validation rule D-1 through D-9"
  - `D:\admin\Downloads\정본 제작 1차\RULE_SPEC_D1_D9.md:339` - D-9
  - `D:\admin\Downloads\정본 제작 1차\RULE_SPEC_D1_D9.md:400` - D-9
  - `D:\admin\Downloads\정본 제작 1차\RULE_SPEC_D1_D9.md:408` ## 8. D-Rule Definitions
  - `D:\admin\Downloads\정본 제작 1차\RULE_SPEC_D1_D9.md:864` ### D-9 — Safety Hard-Stop Guard
  - `D:\admin\Downloads\정본 제작 1차\RULE_SPEC_D1_D9.md:867` D-9:
  - `D:\admin\Downloads\정본 제작 1차\RULE_SPEC_D1_D9.md:1077` D-9:
  - `D:\admin\Downloads\정본 제작 1차\RULE_SPEC_D1_D9.md:1215` D-9_behavior:
  - `D:\admin\Downloads\정본 제작 1차\RULE_SPEC_D1_D9.md:1225` ## 11. Implementation Invariants
  - `D:\admin\Downloads\정본 제작 1차\RULE_SPEC_D1_D9.md:1246` ## 12. TypeScript Contract
  - `D:\admin\Downloads\정본 제작 1차\RULE_SPEC_D1_D9.md:1269` | "D-9";
  - `D:\admin\Downloads\정본 제작 1차\RULE_SPEC_D1_D9.md:1566` title: "D-9 public fixed trigger thresholds require canonical confirmation"
  - `D:\admin\Downloads\정본 제작 1차\RULE_SPEC_D1_D9.md:1694` ## 14. Test Cases
  - `D:\admin\Downloads\정본 제작 1차\RULE_SPEC_D1_D9.md:1750` | TC-D9-045 | D-9 | no safety signal | OK | PASS |
  - `D:\admin\Downloads\정본 제작 1차\RULE_SPEC_D1_D9.md:1751` | TC-D9-046 | D-9 | safety hard-stop active | ERROR_SAFETY | PASS |
  - `D:\admin\Downloads\정본 제작 1차\RULE_SPEC_D1_D9.md:1752` | TC-D9-047 | D-9 | hard stop blocks AI recommendation | blocked | PASS |
  - `D:\admin\Downloads\정본 제작 1차\RULE_SPEC_D1_D9.md:1753` | TC-D9-048 | D-9 | hard stop does not claim to block real-world training | false | PASS |
  - `D:\admin\Downloads\정본 제작 1차\RULE_SPEC_D1_D9.md:1754` | TC-D9-049 | D-9 | SOLO self acknowledgement | recorded only | PASS |
  - `D:\admin\Downloads\정본 제작 1차\RULE_SPEC_D1_D9.md:1755` | TC-D9-050 | D-9 | safety exception approval attempt | denied | PASS |
  - `D:\admin\Downloads\정본 제작 1차\RULE_SPEC_D1_D9.md:1843` summary: "Micro-patch: D-9 split, D-4 confidence handling, TypeScript corrections, test count 55"
- `D:\admin\Downloads\정본 제작 1차\APP_IMPLEMENTATION_BRIDGE.md`
  - `D:\admin\Downloads\정본 제작 1차\APP_IMPLEMENTATION_BRIDGE.md:181` ## Section 4. Tenancy and Isolation Model
  - `D:\admin\Downloads\정본 제작 1차\APP_IMPLEMENTATION_BRIDGE.md:216` ## Section 5. Capability and Consent Model
  - `D:\admin\Downloads\정본 제작 1차\APP_IMPLEMENTATION_BRIDGE.md:402` ## Section 8. Cross-Spec Data Flow
  - `D:\admin\Downloads\정본 제작 1차\APP_IMPLEMENTATION_BRIDGE.md:452` ## Section 9. API Surface Draft
  - `D:\admin\Downloads\정본 제작 1차\APP_IMPLEMENTATION_BRIDGE.md:497` ## Section 11. Safety and Privacy Invariants
  - `D:\admin\Downloads\정본 제작 1차\APP_IMPLEMENTATION_BRIDGE.md:530` ## Section 12. TypeScript Contract
- `D:\admin\Downloads\정본 제작 1차\D9_SAFETY_EVALUATOR_V2_1_1_TEST_PACKAGE.md`
  - `D:\admin\Downloads\정본 제작 1차\D9_SAFETY_EVALUATOR_V2_1_1_TEST_PACKAGE.md:12` ## 목적
  - `D:\admin\Downloads\정본 제작 1차\D9_SAFETY_EVALUATOR_V2_1_1_TEST_PACKAGE.md:22` ## 실행 방법
  - `D:\admin\Downloads\정본 제작 1차\D9_SAFETY_EVALUATOR_V2_1_1_TEST_PACKAGE.md:31` ## TypeScript / Vitest 파일
  - `D:\admin\Downloads\정본 제작 1차\D9_SAFETY_EVALUATOR_V2_1_1_TEST_PACKAGE.md:611` ## 실패 로그 제출 형식
  - `D:\admin\Downloads\정본 제작 1차\D9_SAFETY_EVALUATOR_V2_1_1_TEST_PACKAGE.md:625` ## 운영 저장 원칙

Minimum outline:

1. `# PLAN_SAFETY_GATE_SPEC.md`
2. metadata with `status: RECONSTRUCTED_DRAFT_FOR_REVIEW`, no canonical promotion
3. Purpose / Non-purpose
4. RVE signal consumption boundary
5. Blocking matrix: ACTIVE blocks, UNKNOWN blocks or requires human review, CLEARED allows candidate generation, CLEARED_WITH_ADVISORY remains non-blocking CLEARED with reason codes
6. Plan Generator call order and fail-safe behavior for missing/unavailable evaluator state
7. Human review and coach final selection boundary
8. Audit/privacy and no raw text storage
9. Runtime evidence / open issue closure policy
10. `[DRAFT_COMPLETE]` as final line

Must not claim: coach ratification found unless local file found; safety gate issue closed; PG binding issue closed; D9 cleared means medical clearance; advisory blocks generation.

## Current Blocking Issues To Keep Open

- `OI-RVE-RULE-EVALUATOR-BINDING-001`
- `OI-PG-RULE-SAFETY-GATE-BINDING-001`
- `OI-PG-PHYSIO-SOURCE-CONSUMPTION-001`
- `OI-AIB-PHYSIO-SOURCE-001`
- `OI-AP-PHYSIO-SOURCE-001`

## Next Execution Order

1. Create or update `TRAINORACLE_SPEC_INDEX.md` / `SPEC_REGISTRY.md` as a draft registry using verified local files only.
2. Final local search for missing contract files and coach-ratification evidence.
3. Reconstruct `RULE_VALIDATION_ENGINE_CONTRACT.md` as draft if absent.
4. Reconstruct `PLAN_SAFETY_GATE_SPEC.md` as draft if absent.
5. Only after target files exist, patch Plan Generator/App Bridge/Athlete Profile physio consumption with target table recounts.
6. Run D9 evaluator package to obtain actual runtime evidence before any RVE/PG binding issue closure.

## Evidence Inputs Created In This Work Unit

- `.omo/evidence/trainoracle-confirmed-inventory.md`
- `.omo/evidence/trainoracle-missing-quarantine.md`
- `.omo/evidence/model-belief-files-train-oracle-spec-handoff.md`
- `.omo/evidence/trainoracle-remaining-work-flow-reference.md`
- `.omo/evidence/trainoracle-source-package-integrity.md`
- `.omo/evidence/trainoracle-review-coverage.md`
