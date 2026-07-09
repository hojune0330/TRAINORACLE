# D9 Safety Evaluator — 최초 Runtime Evidence (2026-07-09)

```yaml
evidence_id: D9_RUNTIME_EVIDENCE_2026_07_09_001
target_rule_ref: RULE_SPEC_D1_D9.D-9
candidate_version: v2.1.1
source_package: specs/test-packages/D9_SAFETY_EVALUATOR_V2_1_1_TEST_PACKAGE.md
source_commit: 90cbd61 (origin/main)
result: PASS (11/11 tests)
runner: vitest 4.1.10 / node v20.19.6 / Linux 6.1.102 x86_64
executed_by: GENSPARK_AI_LEAD (총책임 대행, COACH_HOJUNE 위임)
```

## 1. 이것은 무엇인가

`D9_SAFETY_EVALUATOR_V2_1_1_TEST_PACKAGE.md`에 포함된 Vitest 테스트를
**실제 터미널에서 실행한 최초의 runtime 기록**이다.

지금까지 리포지토리의 모든 검증은 markdown self-check(=process evidence)였고,
SPEC 규율상 runtime evidence로 인정되지 않았다. 이 실행이 그 공백을 처음 채운다.

## 2. 실행 절차 (재현 가능)

```bash
cd runtime-evidence/d9-evaluator
npm i -D vitest typescript
npx vitest run d9-safety-evaluator.test.ts --reporter=verbose
```

- 테스트 파일은 SPEC 패키지의 TS 코드블록을 **한 글자도 수정 없이** 추출
  (`d9-safety-evaluator.vitest.ts` — vitest glob 매칭을 위해 `.test.ts` 사본만 생성, diff IDENTICAL 확인).
- 파일 SHA256: `5caf8dd5c2e860435e2eba3d7966ab173a125bc5f1d55aab663f113ed60649a3`
- 전체 실행 로그: [`d9-vitest-run-2026-07-09.log`](./d9-vitest-run-2026-07-09.log)

## 3. 결과 요약

| 테스트 그룹 | 결과 |
|---|---|
| 20개 현장형 문장 기대 라우팅 분류 | ✓ PASS |
| worsening 활용형 (뛸수록/달릴수록) 감지 | ✓ PASS |
| 부위 없는 약한 통증 → advisory, block 안 함 | ✓ PASS |
| soft mitigation은 advisory만 낮추고 hard risk 유지 | ✓ PASS |
| 연결어미 절 분리 시 위험 조합 보존 | ✓ PASS |
| 짧은 토큰 오탐 방지 (토요일/열심 등) | ✓ PASS |
| 오탐 억제 중에도 실제 구토/발열 감지 | ✓ PASS |
| 전신 발열 vs 국소 열감 구분 | ✓ PASS |
| 장비 불편만 → 신체 안전 신호 제외 | ✓ PASS |
| 장비 맥락 + 신체 통증 → UNKNOWN | ✓ PASS |
| ACTIVE/UNKNOWN/CLEARED → RVE signal 매핑 | ✓ PASS |

**핵심 안전 속성 runtime 확인:**
- `D9_ACTIVE` → `blocksPlanGeneration: true` ✓
- `D9_UNKNOWN` → `blocksPlanGeneration: true` ✓
- `D9_CLEARED`(advisory 포함) → `blocksPlanGeneration: false` + reasonCode 보존 ✓
- 자유문장은 위험을 추가할 수 있으나 기존 위험을 해제하지 못함 ✓

## 4. 이 증거가 의미하는 것 / 의미하지 않는 것

**의미하는 것:**
- D9 evaluator v2.1.1 후보가 로컬 Vitest에서 실제로 실행되고 전 항목 PASS함.
- `OI-PSG-RUNTIME-EVIDENCE-001` 등 runtime-gated 이슈의 **첫 번째 필요조건** 충족.
- RVE storedStatus 매핑(ACTIVE/UNKNOWN/CLEARED)이 코드 수준에서 계약과 일치함.

**의미하지 않는 것:**
- canonical promotion 아님.
- 이 실행만으로 어떤 이슈도 자동 closure되지 않음 — target 파일 recount와
  owner 승인 절차가 남아 있음 (`SPEC_TARGET_PATCH_MATRIX.md` 규칙 유지).
- production 환경/CI 증거 아님 (로컬 sandbox 실행). CI 편입은 후속 작업.
- evaluator가 앱 runtime에 바인딩되었다는 증거 아님 (`OI-PSG-IMPLEMENTATION-BINDING-001`는 여전히 OPEN).
