# APPT-12 SafetyBlockRef 안전 책임자 검토

```yaml
packet_id: TRAINORACLE_APPT_12_V1
status: READY_FOR_NAMED_SAFETY_OWNER
safety_owner: UNASSIGNED
service_name: TrainOracle
provisional_service_provider_name: aaclub
review_head_sha: TO_BE_FROZEN_ON_ASSIGNMENT
runtime_authority: false
```

## 쉽게 말하면

계획 생성 전 `SafetyBlockRef`가 정확한 선수·계획·버전·유효시간에 묶이는지 확인한다.
누락·오래됨·대상 불일치는 통과가 아니라 차단으로 처리한다.

## 먼저 읽을 원문

- `specs/reconstruct/PLAN_SAFETY_GATE_SPEC.md`
- `specs/reconstruct/TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md`
- `specs/reconstruct/FORMATION_RECORD_GOVERNANCE_CONTRACT.md`
- `reports/target-patch-plans/07-upstream-safety-privacy-binding.md`
- `reports/work-harness/OWNER_DECISION_CHECKLIST_20260722.md`

## 안전 책임자가 답할 질문

1. 참조가 tenant·group·athlete·계획 대상·버전·발급·만료시각을 모두 묶는가?
2. 누락·만료·대상 불일치·버전 노후·평가 예외가 fail-closed인가?
3. 코치·선수·템플릿·좋은 상태 입력이 D9 `ACTIVE`·`UNKNOWN`을 해제하지 않는가?
4. `CLEARED`가 의료·복귀·계획 승인으로 표시되지 않는가?
5. 참조·감사 기록에 원문 메모·증상·의료 서술이 들어가지 않는가?
6. 재개에는 같은 대상에 묶인 새 참조와 별도 권한 결정이 필요한가?

## Terra High 사전확인

- Safety Gate는 `ACTIVE`·`UNKNOWN`·평가 실패를 차단한다.
- Formation 계약은 versioned·expiring·target-bound 참조를 요구한다.
- 대상 패치 계획은 미수용이며 `runtime_authorized: false`다.
- 원문 메모에서 파생된 `CLEARED` 경로는 금지된다.

## 사람이 남길 기록

```yaml
safety_owner_legal_name_and_authority: REQUIRED
current_qualification_jurisdiction_and_scope: REQUIRED
organization_relationships_and_conflicts: REQUIRED
reviewed_paths_versions_and_head_sha: REQUIRED
issuance_expiry_reissue_mismatch_decision: REQUIRED
evidence_hash_diff_and_test_refs: REQUIRED
decision: APPROVE | REVISE | REJECT | UNRESOLVED
decision_date_and_signature_ref: REQUIRED
```

## 차단 조건

안전 책임자·권한·서면 판단이 없거나 D9 `ACTIVE`·`UNKNOWN`, 평가 실패, stale·만료·누락·
오대상 참조가 있으면 차단한다. 개인정보 envelope가 미해결이면 계정 저장과 Formation
소비도 차단한다.

[DRAFT_COMPLETE]
