# APPT-14 Classifier owner lineage 검토

```yaml
packet_id: TRAINORACLE_APPT_14_V1
status: READY_FOR_NAMED_CLASSIFIER_OWNER
classifier_owner: UNASSIGNED
service_name: TrainOracle
provisional_service_provider_name: aaclub
review_head_sha: TO_BE_FROZEN_ON_ASSIGNMENT
runtime_authority: false
```

## 쉽게 말하면

분류기가 원래 label을 불변으로 보존하고 adapter가 출처와 변경 이력을 추적할 수 있는지
정한다. 규칙 소비를 위해 label taxonomy·분류 기준·D9 의미를 바꿀 수 없다.

## 먼저 읽을 원문

- `reports/target-patch-plans/08-rule-classifier-exposure-binding.md`
- `specs/active/SESSION_CLASSIFIER_SPEC.md`
- `specs/reconstruct/FORMATION_COACH_RULESET_AND_EXPOSURE_CONTRACT.md`
- `specs/active/APP_IMPLEMENTATION_BRIDGE.md`
- `specs/active/RULE_SPEC_D1_D9.md`

## Classifier owner가 답할 질문

1. `sessionLabel`, `sessionLabelSource`, `sourceSnapshotId`, `classifierRunId`, spec version이 충분한가?
2. 원래 `COMPETITION` label이 adapter 왕복 뒤에도 그대로 남는가?
3. 수동 정정이 append-only이고 raw validation·D9 결과를 바꾸지 않는가?
4. adapter가 taxonomy·휴리스틱·임계값을 새로 정의하지 않는가?
5. source ID·content hash·session/version·frame으로 중복·충돌을 찾을 수 있는가?
6. legacy lineage·버전·경계 충돌이 자동 추정이 아니라 거부·사람 검토로 가는가?

## Terra High 사전확인

- classifier 계약은 label source, snapshot, run ID와 수동 정정 lineage를 가진다.
- exposure adapter는 원래 label·source IDs·hash·dedupe를 요구한다.
- App Bridge는 immutable classified session과 correction lineage를 요구한다.
- target plan 08은 원래 label 보존과 Rule/Classifier 공동 gate를 요구한다.

## 사람이 남길 기록

```yaml
classifier_owner_legal_name_and_authority: REQUIRED
current_classifier_contract_responsibility: REQUIRED
conflicts_of_interest: REQUIRED
reviewed_paths_versions_and_head_sha: REQUIRED
label_taxonomy_lineage_and_correction_decision: REQUIRED
roundtrip_dedupe_and_lineage_fixture_refs: REQUIRED
decision: APPROVE | REVISE | REJECT | UNRESOLVED
decision_date_and_signature_ref: REQUIRED
```

## 차단 조건

Classifier owner와 Rule owner의 공동 결정이 없거나 원래 label 변경, lineage 누락, mutation
정정이 있으면 차단한다. classifier 휴리스틱과 `RULE_SPEC_D1_D9.D-9` 안전 의미는 adapter
패킷에서 재정의하지 않는다.

[DRAFT_COMPLETE]
