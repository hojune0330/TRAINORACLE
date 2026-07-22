# APPT-04 N-of-1·종단 통계 검토

```yaml
packet_id: TRAINORACLE_APPT_04_V1
status: READY_FOR_NAMED_REVIEWER
reviewer: UNASSIGNED
service_name: TrainOracle
provisional_service_provider_name: aaclub
review_head_sha: TO_BE_FROZEN_ON_ASSIGNMENT
runtime_authority: false
```

## 쉽게 말하면

한 선수의 기록으로 어디까지 관찰하고 설명할 수 있는지 정한다. 통계 결과만으로 효과,
안전, 회복, 준비도 또는 훈련 허가를 선언하지 않는다.

## 먼저 읽을 원문

- `reports/research/FORMATION_MINIMUM_EVIDENCE_METHODS_REVIEW.md`
- `specs/reconstruct/FORMATION_LOAD_AND_STATISTICAL_RULES_CONTRACT.md`
- `reports/research/FORMATION_RESEARCH_PROTOCOL_V2.md`
- `reports/target-patch-plans/03-minimum-evidence.md`
- `reports/review/FORMATION_RESEARCH_REVIEWER_LEDGER.csv`

## 검토자가 답할 질문

1. 지표별 최소 관찰 수·기간·간격·신선도는 어떤 근거로 정하는가?
2. 단위·기기·방법·프로토콜이 달라질 때 비교를 언제 거부하는가?
3. 측정오차보다 큰 변화와 실제로 중요한 변화를 어떻게 구분하는가?
4. 성장·성숙, 계절, 자기상관, 이월효과, 동시 훈련과 결측을 어떻게 처리하는가?
5. 사전가설·중단 규칙·다중비교·사후 구간 선택 금지가 충분한가?
6. 기기·펌웨어·방법 변경은 기존 기준선을 언제 무효화하는가?
7. 사용자 문구가 통계 관찰을 효능·안전·의료 판단으로 과장하지 않는가?

## Terra High 사전확인

- 기존 근거는 모든 지표에 적용할 보편 최소 `n`과 신선도 숫자를 지지하지 않는다.
- 호환 출처·방법·단위가 없으면 기준선을 만들지 않는 계약이 준비돼 있다.
- readiness·부상위험의 보편 임계값은 금지돼 있다.
- 통계 검토자는 현재 `UNASSIGNED / NOT_REVIEWED`다.

## 사람이 남길 기록

```yaml
reviewer_legal_name_and_role: REQUIRED
current_n_of_1_longitudinal_qualification: REQUIRED
conflicts_of_interest: REQUIRED
metric_population_model_scope: REQUIRED
reviewed_paths_data_versions_and_head_sha: REQUIRED
missingness_measurement_error_carryover_decision: REQUIRED
required_changes_and_limits: REQUIRED
decision: APPROVE | REVISE | REJECT | UNRESOLVED
decision_date_and_signature_ref: REQUIRED
```

## 차단 조건

호환성·오차모형·결측·교란 처리가 미정이면 통계 기반 계획 변경을 차단한다. 통계 결과로
D9 `ACTIVE`·`UNKNOWN`을 낮추거나 `CLEARED`를 의료적 허가로 바꿀 수 없다.

[DRAFT_COMPLETE]
