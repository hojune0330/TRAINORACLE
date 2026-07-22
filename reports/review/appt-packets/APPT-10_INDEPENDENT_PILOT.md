# APPT-10 독립 파일럿 검토

```yaml
packet_id: TRAINORACLE_APPT_10_V1
status: SYNTHETIC_PREPARATION_ONLY
reviewer: UNASSIGNED
participant_enrollment: false
hidden_shadow: forbidden
service_name: TrainOracle
provisional_service_provider_name: aaclub
legal_service_provider_identity: UNCONFIRMED
review_head_sha: TO_BE_FROZEN_ON_ASSIGNMENT
runtime_authority: false
```

## 쉽게 말하면

실제 모집 전에 공개형 shadow 파일럿의 설명·동의·철회·중단 흐름을 검토한다. 현재
자료는 합성 리허설용이며 참여자를 등록하거나 숨은 shadow를 허용하지 않는다.

## 먼저 읽을 원문

- `specs/reconstruct/ATHLETE_VISIBLE_SHADOW_PILOT_PROTOCOL.md`
- `reports/review/WO014_ATHLETE_PARTICIPANT_MATERIALS.md`
- `reports/review/WO014_INDEPENDENT_REVIEW_FORMS.md`
- `specs/test-packages/SHADOW_PROTOCOL_SCENARIO_PACKAGE.md`
- `specs/reconstruct/HUMAN_REVIEW_AND_SHARING_WORKFLOW.md`

## 검토자가 답할 질문

1. 모든 상태에서 비교용이며 실제 계획에 반영되지 않음이 보이는가?
2. 현재 자료가 실제 등록용으로 오인되지 않는가?
3. 거절·철회가 일지·기능·보상·가시성에 불이익을 만들지 않는가?
4. 미성년의 보호자 동의와 선수 동의·거부가 분리되는가?
5. 숨은 등록·묶음 동의·실제 계획 쓰기·자동 공유를 거부하는가?
6. 검토자가 코치·선수·보호자·작성자·운영자와 독립적인가?

## Terra High 사전확인

- `participant_enrollment: false`, `hidden_shadow: forbidden`이 명시돼 있다.
- 참여자 자료와 검토 양식은 `NOT_VALID_FOR_ENROLLMENT`다.
- 합성 시나리오는 숨은 등록·묶음 동의·실제 계획 변경을 거부한다.
- 법적 제공자 신원이 미확정이므로 실제 모집을 시작할 수 없다.

## 사람이 남길 기록

```yaml
reviewer_roster_id_in_repo: REQUIRED
restricted_legal_identity_record_ref: REQUIRED_OUTSIDE_GIT
independence_and_conflicts: REQUIRED
current_youth_consent_pilot_review_qualification: REQUIRED
materials_scenarios_and_stop_flow_scope: REQUIRED
reviewed_paths_manifest_and_head_sha: REQUIRED
guardian_applicability_decision: REQUIRED
decision: APPROVE | REVISE | REJECT | UNRESOLVED
decision_date_and_signature_ref: REQUIRED
```

## 차단 조건

이름 있는 독립 검토자, 법적 운영자, 동의·보호자 경로와 별도 모집 승인이 없으면 실제
참가자를 모집하지 않는다. 어떤 결과도 의료·안전·효과 승인으로 해석하지 않는다.

[DRAFT_COMPLETE]
