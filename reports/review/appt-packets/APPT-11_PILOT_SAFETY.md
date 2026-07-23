# APPT-11 파일럿 안전 판정 책임자 검토

```yaml
packet_id: TRAINORACLE_APPT_11_V1
status: READY_FOR_NAMED_SAFETY_ADJUDICATOR
adjudicator: UNASSIGNED
must_be_separate_from_appt_10: true
participant_enrollment: false
service_name: TrainOracle
provisional_service_provider_name: aaclub
review_head_sha: TO_BE_FROZEN_ON_ASSIGNMENT
runtime_authority: false
```

## 쉽게 말하면

파일럿의 중단·보류·재개·불일치를 독립적으로 판정한다. 이 역할은 진단, 의료적
clearance, D9 해제 또는 실제 훈련 처방 권한이 아니다.

## 먼저 읽을 원문

- `specs/reconstruct/ATHLETE_VISIBLE_SHADOW_PILOT_PROTOCOL.md`
- `specs/reconstruct/HUMAN_REVIEW_AND_SHARING_WORKFLOW.md`
- `specs/active/RULE_SPEC_D1_D9.md`
- `specs/reconstruct/PLAN_SAFETY_GATE_SPEC.md`
- `specs/test-packages/SHADOW_PROTOCOL_SCENARIO_PACKAGE.md`

## 판정자가 답할 질문

1. D9 `ACTIVE`와 `UNKNOWN`이 파일럿을 보류하고 계획 생성을 차단하는가?
2. `CLEARED`가 의료 허가·계획 승인·재개 허가로 변하지 않는가?
3. 실제 계획 쓰기·비공개 노트 신호·숨은 등록·보안 사고가 `ABORTED`가 되는가?
4. 안전 미확정·출처 노후·이해충돌·고충 보고가 `PAUSED`로 남는가?
5. 재개에 새 동의·정확한 버전·원인 해소·독립 검토·책임자 권한이 필요한가?
6. APPT-10과 선수·코치·보호자·작성자에서 독립적인가?

## Terra High 사전확인

- D9와 Safety Gate는 `ACTIVE`·`UNKNOWN`을 차단한다.
- 계약에는 `PAUSED`·`ABORTED`와 실제 계획 비변경 조건이 있다.
- 충돌한 판정자는 무효이고 판정자 부재 시 미해결로 남는다.
- 실제 runtime·참여자 증거는 없다.

## 사람이 남길 기록

```yaml
adjudicator_roster_id_in_repo: REQUIRED
restricted_legal_identity_record_ref: REQUIRED_OUTSIDE_GIT
independence_from_appt_10_and_project_roles: REQUIRED
current_youth_safety_referral_qualification: REQUIRED
stop_pause_resume_authority_scope: REQUIRED
conflicts_of_interest_and_third_party_decision: REQUIRED
reviewed_manifest_locked_records_and_head_sha: REQUIRED
decision_reasons_timestamp_and_signature_ref: REQUIRED
```

## 차단 조건

판정자·독립성·권한이 없거나 D9 `ACTIVE`·`UNKNOWN`, 동의·버전·출처 불일치, 보류 원인
미해소가 있으면 중단한다. `CLEARED`도 의료적 clearance나 재개 승인이 아니다.

[DRAFT_COMPLETE]
