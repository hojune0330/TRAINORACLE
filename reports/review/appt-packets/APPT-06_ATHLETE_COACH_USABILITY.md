# APPT-06 실제 선수·코치 사용성 검토

```yaml
packet_id: TRAINORACLE_APPT_06_V1
status: PREPARED_NOT_VALID_FOR_RECRUITMENT
reviewers: UNASSIGNED
participants_tested: 0
service_name: TrainOracle
provisional_service_provider_name: aaclub
legal_service_provider_identity: UNCONFIRMED
review_head_sha: TO_BE_FROZEN_ON_ASSIGNMENT
runtime_authority: false
```

## 쉽게 말하면

실제 선수가 후보·중단·철회를 이해하고, 실제 코치가 사실·후보·검토·수용된 계획을
구분하는지 확인한다. 현재는 모집용 문서가 아니며 실제 훈련계획을 바꾸지 않는다.

## 먼저 읽을 원문

- `reports/review/FORMATION_USER_SCENARIOS_AND_TEACH_BACK_V1.md`
- `reports/research/FORMATION_YOUTH_TRANSFER_AND_PILOT_REVIEW.md`
- `specs/reconstruct/ATHLETE_VISIBLE_SHADOW_PILOT_PROTOCOL.md`
- `reports/review/WO014_ATHLETE_PARTICIPANT_MATERIALS.md`
- `TRAINING_PLAN_BLUEPRINT_MULTIPERSPECTIVE_REVIEW.md`

## 검토자가 답할 질문

1. 선수는 오늘 훈련의 최종 결정자가 누구인지 자기 말로 설명하는가?
2. 진행 표시를 성공·보상·안전 판정으로 오해하지 않는가?
3. 누락·우려·철회 때 현재 코치 계획이 유지됨을 이해하는가?
4. 멈춤·사람 문의·나가기·정정·로컬 내보내기를 압박 없이 찾는가?
5. 코치는 사실·shadow 후보·검토 요청·수용 계획을 구분하는가?
6. 후보 없음·정보 부족·수정 이유가 자동 실행으로 오해되지 않는가?
7. 발견 사항과 수정 후 재검토 범위가 명확한가?

## Terra High 사전확인

- 현재 `participants_tested: 0`, 실제 선수·코치 검토는 `NOT_RUN`이다.
- 페르소나 리뷰는 발견 자료일 뿐 실제 사용자 증거가 아니다.
- shadow 후보는 실제 계획을 변경하지 않는다.
- 법적 제공자 신원이 미확정이므로 현재 참가자 모집을 시작할 수 없다.

## 사람이 남길 기록

```yaml
opaque_athlete_and_coach_participant_ids: REQUIRED
restricted_identity_record_ref: REQUIRED_OUTSIDE_GIT
roles_experience_and_age_band: REQUIRED
consent_guardian_and_withdrawal_state: REQUIRED_IF_APPLICABLE
recruitment_relationship_and_conflicts: REQUIRED
device_build_and_head_sha: REQUIRED
tasks_observations_and_teach_back: REQUIRED
findings_required_changes_and_retest: REQUIRED
reviewed_at_and_signatures: REQUIRED
```

저장소 패킷에는 불투명 참여자 ID만 기록한다. 실명, 생년월일, 연락처, 보호자 신원과
동의 원본은 접근이 제한된 별도 신뢰 저장소에 두고 `restricted_identity_record_ref`만
연결한다.

## 차단 조건

실제 제공자·동의·보호자·현지 검토 경로가 없으면 모집하지 않는다. 실제 사람 대신
페르소나를 세거나 shadow 후보가 실제 계획·의료 판단을 바꾸면 즉시 중단한다.

[DRAFT_COMPLETE]
