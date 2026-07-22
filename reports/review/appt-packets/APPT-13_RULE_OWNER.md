# APPT-13 Rule owner adapter 검토

```yaml
packet_id: TRAINORACLE_APPT_13_V1
status: READY_FOR_NAMED_RULE_OWNER
rule_owner: UNASSIGNED
service_name: TrainOracle
provisional_service_provider_name: aaclub
review_head_sha: TO_BE_FROZEN_ON_ASSIGNMENT
runtime_authority: false
```

## 쉽게 말하면

`RULE_SPEC_D1_D9.D-1`과 `RULE_SPEC_D1_D9.D-2`가 네임스페이스를 바꾸지 않고 versioned
exposure ledger를 소비할 수 있는지 정한다. Adapter가 규칙 의미나 D9를 재정의할 수 없다.

## 먼저 읽을 원문

- `reports/target-patch-plans/08-rule-classifier-exposure-binding.md`
- `specs/active/RULE_SPEC_D1_D9.md`
- `specs/active/SESSION_CLASSIFIER_SPEC.md`
- `specs/reconstruct/FORMATION_COACH_RULESET_AND_EXPOSURE_CONTRACT.md`
- `specs/active/APP_IMPLEMENTATION_BRIDGE.md`

## Rule owner가 답할 질문

1. 소비 규칙이 `RULE_SPEC_D1_D9.D-1`·`.D-2`로 명시되고 다른 namespace와 섞이지 않는가?
2. 원래 classifier label, source/session/version, frame, dedupe identity, hash가 남는가?
3. `COMPETITION` label을 유지하면서 노출이 정확히 한 번만 기여하는가?
4. planned·completed view가 분리되고 중복·경계 이중 계산이 거부되는가?
5. 알 수 없는 버전·충돌한 adapter·비주요 label 승격이 fail-closed인가?
6. adapter가 새 임계값·휴리스틱·D9 예외를 만들지 않는가?

## Terra High 사전확인

- 대상 패치 계획은 미수용이고 `runtime_authorized: false`다.
- raw result와 `RULE_SPEC_D1_D9.D-9` override 금지는 불변이다.
- exposure 계약은 원래 label과 one-exposure·분리 view를 요구한다.
- App Bridge는 source snapshot lineage와 명시적 namespace를 요구한다.

## 사람이 남길 기록

```yaml
rule_owner_legal_name_and_authority: REQUIRED
current_rule_coaching_policy_responsibility: REQUIRED
conflicts_of_interest: REQUIRED
reviewed_paths_versions_and_head_sha: REQUIRED
accepted_ledger_schema_version_hash_and_rejections: REQUIRED
fixtures_diff_recount_and_validation_refs: REQUIRED
decision: APPROVE | REVISE | REJECT | UNRESOLVED
decision_date_and_signature_ref: REQUIRED
```

## 차단 조건

Rule owner와 Classifier owner의 서면 결정이 없거나 namespace 혼용, 원래 label 변경,
planned/completed 합산, 중복 노출이 있으면 차단한다. bare `D-*` 참조를 새 스펙에 쓰지
않으며 adapter로 `RULE_SPEC_D1_D9.D-9`를 변경하지 않는다.

[DRAFT_COMPLETE]
