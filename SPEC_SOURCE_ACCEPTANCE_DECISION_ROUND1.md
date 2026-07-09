# SPEC_SOURCE_ACCEPTANCE_DECISION_ROUND1.md

```yaml
doc_id: TRAINORACLE_SPEC_SOURCE_ACCEPTANCE_DECISION_ROUND1
spec_id: TRAINORACLE.SPEC_SOURCE_ACCEPTANCE_DECISION_ROUND1
title: "TrainOracle Source Acceptance Decision Round 1"
version: "0.1"
round: RT1_SOURCE_ACCEPTANCE
status: DECISION_RECORD
owner: COACH_HOJUNE
reviewed_by: GENSPARK_AI_LEAD (총책임 대행, COACH_HOJUNE 위임 2026-07-09)
review_input: SPEC_SOURCE_ACCEPTANCE_REVIEW_ROUND1.md
canonical_promotion_allowed: false
```

---

## 1. 결정 요약

`SPEC_SOURCE_ACCEPTANCE_REVIEW_ROUND1.md`의 8개 acceptance question을
대상 파일을 직접 열어 라인 단위로 대조 검증한 결과:

```yaml
source_acceptance_decision:
  PLAN_SAFETY_GATE_SPEC.md: ACCEPTED_AS_WORKING_SOURCE
  RULE_VALIDATION_ENGINE_CONTRACT.md: ACCEPTED_AS_WORKING_SOURCE

acceptance_scope: downstream_target_patch_source_only
canonical_promotion: false
original_restoration_claim: false
downstream_issue_closure_by_this_decision: false
```

`ACCEPTED_AS_WORKING_SOURCE`의 의미: 이 두 재구성 드래프트를
downstream target patch(Wave C/D)의 **소스 문서로 사용하는 것을 승인**한다.
원본 복원 주장, canonical 승격, 이슈 자동 closure는 포함하지 않는다.

---

## 2. 8개 Acceptance Question 검증 결과

검증 방법: 대상 파일을 로컬에서 직접 열어 grep 라인 대조 (파일이 진실).

### 2.1 PLAN_SAFETY_GATE_SPEC.md (v0.1)

| # | 질문 | 판정 | 근거 (파일 내 라인) |
|---|---|---|---|
| 1 | D-9 의미/threshold 재정의 없음? | PASS | L48, L152–153: 재정의 명시적 금지 |
| 2 | ACTIVE/UNKNOWN 차단·검토 유지? | PASS | L274–275: ACTIVE→BLOCK, UNKNOWN→BLOCK_OR_HUMAN_REVIEW |
| 3 | advisory = CLEARED 하위, 4번째 disposition 아님? | PASS | L277 |
| 4 | raw free-text/증상/사적 메모 저장 차단? | PASS | L58, L155–156, L243, L323–325 |
| 5 | self-check ≠ runtime evidence? | PASS | L25 `self_check_is_runtime_evidence: false` |
| 6 | 남은 open issue 명시? | PASS | L507–511: OI-PSG 5건 전부 OPEN 명시 |
| 7 | 다운스트림 절대 카운트 미복사? | PASS | 선언 `open_issues_total: 5` = 실제 테이블 5행, 재계수 일치 |
| 8 | provenance 결격? | 조건부 PASS | 재구성 출처 한계를 파일 스스로 선언(L38). 작업 소스로는 충분 |

### 2.2 RULE_VALIDATION_ENGINE_CONTRACT.md (v0.1)

| # | 질문 | 판정 | 근거 |
|---|---|---|---|
| 1 | D-9 재정의 없음? | PASS | L48, L191 |
| 2 | ACTIVE/UNKNOWN 차단? | PASS | L195–196 매핑 테이블 + 장애 시 UNKNOWN fail-safe (L213–241) |
| 3 | advisory 처리? | PASS | L198–200: CLEARED + reason code, 4번째 disposition 아님 명시 |
| 4 | raw text 차단? | PASS | L150, L175, L333, L415, L424 |
| 5 | self-check ≠ runtime? | PASS | L25 |
| 6 | open issue 명시? | PASS | OI-RVEC 5건 OPEN |
| 7 | 카운트 정합? | PASS | 선언 5 = 테이블 5행 |
| 8 | legacy 혼동 방지? | PASS | `11_API_AND_ENGine_CONTRACTS.md` 대체 금지 명시 (L50, L99, L484) |

추가 강점: 평가기 unavailable/timeout/exception/invalid-input/version-stale
전부 UNKNOWN(=차단)으로 매핑 — fail-safe 설계 확인.

---

## 3. 결정과 동시에 확보된 최초 Runtime Evidence

이 결정 라운드에서 `specs/test-packages/D9_SAFETY_EVALUATOR_V2_1_1_TEST_PACKAGE.md`의
Vitest 테스트를 실제 실행했다:

- 결과: **11/11 PASS** (vitest 4.1.10, node v20.19.6)
- 기록: [`runtime-evidence/d9-evaluator/`](./runtime-evidence/d9-evaluator/)
- 이는 `OI-PSG-RUNTIME-EVIDENCE-001` 등 runtime-gated 이슈의 첫 필요조건이다.
- 단, 로컬 실행이며 CI/구현 바인딩 증거는 아니다. 이 실행만으로 closure되는 이슈는 없다.

---

## 4. 이 결정이 허용하는 다음 작업

1. Wave C: `PHYSIO_SOURCE_TRUST_SPEC` + `DAILY_LOG_AND_CHECKIN_SPEC` 소스 수용 리뷰 (동일 절차)
2. Wave D: 수용된 소스 기반 productization draft 바인딩 패치 (target recount 필수)
3. Wave E 계속: CI 편입 + 앱 구현에서 Safety Gate 소비 바인딩
4. 각 target 이슈 closure는 여전히 **개별 recount + owner 승인 + 해당 runtime 증거** 필요

## 5. 이 결정이 허용하지 않는 것

- canonical promotion
- `OI-PG-RULE-SAFETY-GATE-BINDING-001` 등 어떤 이슈의 즉시 closure
- 재구성 드래프트를 원본 복원본으로 취급
- 이 문서 자체를 runtime evidence로 인용

[DECISION_RECORDED]
