# SPEC_SOURCE_ACCEPTANCE_DECISION_ROUND3.md

```yaml
doc_id: TRAINORACLE_SPEC_SOURCE_ACCEPTANCE_DECISION_ROUND3
spec_id: TRAINORACLE.SPEC_SOURCE_ACCEPTANCE_DECISION_ROUND3
title: "TrainOracle Source Acceptance Decision Round 3"
version: "1.0"
round: RT1_SOURCE_ACCEPTANCE_ROUND3
status: DECISION_ISSUED
decided_by: PROJECT_LEAD_AI
decision_date: "2026-07-09"
review_packet: SPEC_SOURCE_ACCEPTANCE_REVIEW_ROUND3.md
independent_recount_performed: true
runtime_evidence_claimed: false
issue_closure_claimed: false
```

---

## 1. 결정 권한 및 근거

- 본 결정은 총책임자(Project Lead AI)의 단독 권한으로 발행한다.
- 입력물: 코덱스 Round 3 리뷰 패킷(`SPEC_SOURCE_ACCEPTANCE_REVIEW_ROUND3.md`, PR #15 병합분).
- 결정 전 **독립 재계수를 직접 수행**했다 (코덱스 리뷰 신뢰만으로 결정하지 않음):

| 문서 | 선언 open/blocking | 실측 open/blocking | 일치 |
|---|---|---|---|
| `ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md` | 7 / 4 | 7 / 4 | ✅ |
| `DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC.md` | 6 / 3 | 6 / 3 | ✅ |
| `MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md` | 7 / 4 | 7 / 4 | ✅ |
| `PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md` | 7 / 4 | 7 / 4 | ✅ |

- 재계수 방법: 각 문서의 open-issue 테이블에서 `OPEN` 상태 행과 blocking `YES` 열을 grep 기반으로 직접 계수. `executed_tests_total: 0` 4건 모두 유지 확인.

---

## 2. 결정

### 2.1 ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md
**결정: `ACCEPTED_AS_WORKING_SOURCE`** — scope: `downstream_target_patch_source_only`

- 8문항 사전 리뷰 전항 PASS. 재계수 일치.
- 안전 표시 투영이 D9/Safety Gate 상태를 해제(clear)할 수 없음을 명시(OI-AVD-SAFETY-DISPLAY-BINDING-001에서 재확인) — 3처분 불변식 위반 없음.
- 수용 노트 N1: CTL/ATL/TSB 등 파생 지표 최종 산식은 본 문서가 수치 권위를 갖지 않음(OI-AVD-METRIC-SOURCE-OWNERSHIP-001 OPEN 유지). Phase 3 이전에 별도 메트릭 알고리즘 계약이 필요하다.

### 2.2 DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC.md
**결정: `ACCEPTED_AS_WORKING_SOURCE`** — scope: `downstream_target_patch_source_only`

- 8문항 사전 리뷰: 7 PASS + 1 PASS_WITH_NOTE(메타데이터 nested 구조). 재계수 일치.
- 수용 노트 N2 (nested metadata): 필수 값이 모두 존재하므로 수용 차단 사유가 아니다. 단, 후속 개정 시 다른 스펙과 동일한 flat YAML 프런트매터로 정규화할 것 (ORDER_003 반영).
- 수용 노트 N3: "PASS ≠ safety clearance" 원칙 — Inbox 신호의 어떤 표시도 안전 해제를 암시할 수 없다. 이는 화면 매트릭스 CONFLICT C2(Inbox `9 Rules 9/9 pass`)의 스펙 측 근거로 확정한다. **C2는 스펙 결함이 아니라 UI 구현 측 결함**으로 분류한다.

### 2.3 MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md
**결정: `ACCEPTED_AS_WORKING_SOURCE`** — scope: `downstream_target_patch_source_only`

- 8문항 사전 리뷰 전항 PASS. 재계수 일치.
- 수용 노트 N4 (게이트 해제): 마스터플랜 게이트 규칙에 따라 본 수용으로 **캘린더 관련 Phase 작업이 잠금 해제**된다. 단 OI-MCM-EDIT-WORKFLOW-001이 OPEN이므로 캘린더 **편집(드래그/수동 수정) UI는 v1 범위에서 계속 제외**하며, 읽기 전용 투영만 허용한다.
- 수용 노트 N5 (네임스페이스): `CYCLE_DAY.*` / `RULE_SPEC_D1_D9.*` / `LEGACY_PHASE_D.*` 3-네임스페이스 분리가 본 문서로 소스 확정된다. 화면 매트릭스 CONFLICT C1/C3/C4/C5의 수정 기준이 이 문서다. Phase 1 포팅 시 typed backing object(`{namespace, value, isRuleId}`)를 이 스펙 기준으로 구현한다.

### 2.4 PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md
**결정: `ACCEPTED_AS_WORKING_SOURCE`** — scope: `downstream_target_patch_source_only`

- 8문항 사전 리뷰 전항 PASS. 재계수 일치.
- 수용 노트 N6 (게이트): 마스터플랜 게이트 규칙에 따라 본 수용으로 Phase 4의 **AI 각주 계약(sourceRefs + rationaleCodes + privacyTier + redactionState)이 default-ON 후보**가 된다. 단 OI-PORP-REDACTION-POLICY-001 구현 검증 전까지 raw/private 텍스트 누출 방어는 구현 증거로 재확인해야 한다.
- 수용 노트 N7: 외부 LLM 요약 경계(OI-PORP-EXTERNAL-LLM-POLICY-001)는 미수용 유지 — v1에서 사적 선수 데이터의 외부 LLM 전송은 계속 금지.

---

## 3. 수용 범위 한정 (전 문서 공통)

1. `ACCEPTED_AS_WORKING_SOURCE`는 canonical 승격이 아니다.
2. 다운스트림 타깃 패치의 소스로만 사용한다 (`downstream_target_patch_source_only`).
3. 각 문서 내부 open-issue는 **하나도 닫히지 않는다** (총 27건 OPEN 유지: 7+6+7+7).
4. 런타임 증거 주장 없음 — `executed_tests_total: 0` 상태 그대로 수용.
5. 안전 불변식 무변경: D9_ACTIVE→BLOCK, D9_UNKNOWN→BLOCK_OR_HUMAN_REVIEW, advisory는 CLEARED 하위에서만, 평가기 실패→UNKNOWN fail-safe.
6. §8 memo_policy 무변경: raw 자유텍스트 서버/감사 영속 금지.

---

## 4. 후속 트리거 (본 결정으로 발생하는 작업)

| 트리거 | 대상 | 담당 |
|---|---|---|
| T1 | Plan Generator / App Bridge 타깃 패치 시 본 4개 문서를 패치 소스로 사용 가능 | 코덱스 (ORDER_003+) |
| T2 | 캘린더 읽기 전용 투영 작업 잠금 해제 (N4) | 총책임자 (Phase 2+) |
| T3 | AI 각주 계약 구현 준비 (N6) | 총책임자 (Phase 4) |
| T4 | DAILY_BRIEF 메타데이터 flat 정규화 (N2) | 코덱스 (ORDER_003) |
| T5 | 메트릭 알고리즘 계약 초안 필요 (N1) | 코덱스 (ORDER_003+) |
| T6 | CONFLICT C1–C5는 구현 측 결함으로 확정, Phase 1/2 포팅 시 수정 | 총책임자 |

---

## 5. 결정 요약

```yaml
decisions:
  ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md: ACCEPTED_AS_WORKING_SOURCE
  DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC.md: ACCEPTED_AS_WORKING_SOURCE
  MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md: ACCEPTED_AS_WORKING_SOURCE
  PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md: ACCEPTED_AS_WORKING_SOURCE
scope_all: downstream_target_patch_source_only
open_issues_preserved_total: 27
canonical_promotion: false
runtime_evidence: false
```

이로써 재구성 스펙 8종(라운드 1: Gate+RVE / 라운드 2: Physio+DailyLog / 라운드 3: 본 4종) 전부가 working source로 수용 완료되었다.
