# APPT-08 백엔드 구현 책임자 검토

```yaml
packet_id: TRAINORACLE_APPT_08_V1
status: READY_FOR_NAMED_OWNER
owner: UNASSIGNED
service_name: TrainOracle
provisional_service_provider_name: aaclub
legal_service_provider_identity: UNCONFIRMED
review_head_sha: TO_BE_FROZEN_ON_ASSIGNMENT
runtime_authority: false
```

## 쉽게 말하면

로컬 기록을 먼저 보존하면서 향후 계정 연결 뒤 구조화 데이터만 안전하게 동기화할
구현 책임 범위를 확인한다. 책임자 지정만으로 백엔드나 서버 수집을 켜지 않는다.

## 먼저 읽을 원문

- `LAUNCH_BACKEND_AND_ACCOUNT_PLAN.md`
- `specs/reconstruct/LOCAL_FIRST_SYNC_AND_PROMOTION_CONTRACT.md`
- `specs/reconstruct/CALENDAR_VERSION_AND_SYNC_CONTRACT.md`
- `specs/active/APP_IMPLEMENTATION_BRIDGE.md`
- `reports/work-harness/OWNER_DECISION_CHECKLIST_20260722.md`

## 책임자가 답할 질문

1. 서버 장애 중에도 로컬 작성·열람이 계속되는가?
2. 항목별 확인 전에는 로컬 원본을 삭제하거나 `synced`로 바꾸지 않는가?
3. 충돌 시 자동 병합·덮어쓰기·시간순 승자를 금지하는가?
4. 원문 메모·증상·의료·보호자 서술이 서버·감사·동기화 큐에 들어가지 않는가?
5. 멱등성·부분 실패·재시도·버전 불일치·롤백 시험이 구체적인가?
6. 동기화 성공이나 좋은 데이터가 D9 또는 Safety Gate를 해제하지 않는가?

## Terra High 사전확인

- 계약은 로컬 우선, 확인 후 승격, 충돌 보존과 원문 비전송을 요구한다.
- 백엔드 구현과 런타임 증거는 아직 없다.
- 메모·암호화·보관·삭제 정책에는 사람 결정이 남아 있다.
- 서비스 제공자 법적 신원은 미확정이다.

## 사람이 남길 기록

```yaml
owner_legal_name_and_roster_id: REQUIRED
backend_migration_security_qualification: REQUIRED
assigned_scope_and_exclusions: REQUIRED
conflicts_of_interest: REQUIRED
reviewed_paths_manifest_and_head_sha: REQUIRED
implementation_test_recovery_evidence: REQUIRED_BEFORE_ACTIVATION
decision: ACCEPT_RESPONSIBILITY | REVISE_SCOPE | DECLINE
decision_date_and_signature_ref: REQUIRED
```

## 차단 조건

실제 구현·시험·복구 증거가 없거나 원문 비공개 텍스트 전송 가능성이 남으면 서버 기능을
활성화하지 않는다. 책임자 지정은 정본 승격·이슈 종결·런타임 권한이 아니다.

[DRAFT_COMPLETE]
