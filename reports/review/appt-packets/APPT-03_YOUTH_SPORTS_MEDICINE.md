# APPT-03 청소년 스포츠의학·의료안전 검토

```yaml
packet_id: TRAINORACLE_APPT_03_V1
status: READY_FOR_NAMED_REVIEWER
reviewer: UNASSIGNED
service_name: TrainOracle
provisional_service_provider_name: aaclub
review_head_sha: TO_BE_FROZEN_ON_ASSIGNMENT
runtime_authority: false
```

## 쉽게 말하면

증상·부상·중단·의료 의뢰 경계가 청소년에게 안전하게 작동하는지 확인한다. D9는
진단이나 복귀 허가를 하지 않으며 좋은 기분·준비도가 위험 신호를 상쇄할 수 없다.

## 먼저 읽을 원문

- `specs/active/RULE_SPEC_D1_D9.md`
- `specs/active/RVE_RULE_EVALUATOR_BINDING_SPEC.md`
- `specs/reconstruct/PLAN_SAFETY_GATE_SPEC.md`
- `RACE_SELFCHECK_FIELDS_DECISION.md`
- `reports/research/FORMATION_YOUTH_TRANSFER_AND_PILOT_REVIEW.md`

## 검토자가 답할 질문

1. 한국어 증상·통증·피로 문구가 진단처럼 보이지 않으면서 위험을 놓치지 않는가?
2. 어떤 red flag와 지속 증상에서 즉시 중단·사람 확인·의료 의뢰가 필요한가?
3. 필수 입력 누락·모순·오래된 정보는 어떤 `UNKNOWN` 경로로 보내야 하는가?
4. 코치·선수 확인이 D9 또는 의료 의뢰 필요성을 해제하지 않게 되어 있는가?
5. `CLEARED`가 회복·안전·의료 복귀 허가로 오해되지 않는가?
6. 결합 웰니스 분석이 안전 점수나 진단으로 변하지 않게 할 금지 표현은 무엇인가?
7. 한국 현지 응급·의뢰·보호자 알림 경로는 어떻게 연결해야 하는가?

## Terra High 사전확인

- D9 `ACTIVE`와 `UNKNOWN`은 계획 생성을 차단한다.
- `CLEARED`는 평가 시점에 신호를 찾지 못했다는 뜻일 뿐 의료적 허가가 아니다.
- D9 임계값과 한국 현지 의뢰 경계에는 아직 사람 검토가 필요하다.
- 자기점검과 결합 분석은 현재 계획·보상·코치 권한을 만들지 않는다.

## 사람이 남길 기록

```yaml
reviewer_legal_name: REQUIRED
organization_or_independent_status: REQUIRED
current_license_qualification_and_jurisdiction: REQUIRED
youth_sports_medicine_scope_and_exclusions: REQUIRED
conflicts_of_interest: REQUIRED
reviewed_paths_and_head_sha: REQUIRED
clinical_guidance_and_referral_boundary: REQUIRED
required_product_or_rule_changes: REQUIRED
decision: APPROVE | REVISE | REJECT | UNRESOLVED
decision_date_and_signature_ref: REQUIRED
```

## 차단 조건

적격 의료안전 검토와 한국 현지 의뢰 경로가 없으면 청소년 안전 기능을 활성화하지
않는다. D9 `ACTIVE`·`UNKNOWN`은 계속 차단하며, 어떤 기록도 `CLEARED`를 의료적
clearance나 실제 훈련 허가로 바꾸지 않는다.

[DRAFT_COMPLETE]
