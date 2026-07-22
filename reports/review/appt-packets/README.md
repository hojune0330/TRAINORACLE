# TrainOracle APPT 검토 패킷 색인

```yaml
bundle_id: TRAINORACLE_APPT_REVIEW_PACKETS_V1
assembled_at: 2026-07-22 Asia/Seoul
service_name: TrainOracle
provisional_service_provider_name: aaclub
legal_service_provider_identity: UNCONFIRMED
assembly_pr: 98
source_document_snapshot_sha: 9cf33692741167e1563a881ffec934477c41794d
packet_bundle_revision: RESOLVE_FROM_PR_HEAD
review_head_sha: TO_BE_FROZEN_ON_ASSIGNMENT
packet_count: 14
named_human_reviews_completed: 0
runtime_authority: false
```

## 이 묶음은 무엇인가

기존 스펙·연구·테스트·AI 검토를 실제 담당자가 읽고 답하기 쉬운 14개 패킷으로
정리한 것이다. 에이전트 사전검토가 완료됐다는 뜻이지, 법률·의료·과학·보안·사용자
검토가 승인됐다는 뜻은 아니다.

서비스명은 **TrainOracle**이다. **aaclub은 임시 서비스 제공자명**이며, 확인된 법인명,
사업자명 또는 개인정보처리자 법적 명칭이 아니다.

## 읽고 답하는 순서

1. 본인에게 해당하는 패킷 하나만 연다.
2. `먼저 읽을 원문`의 정확한 버전과 head SHA를 고정한다.
3. 질문마다 `APPROVE / REVISE / REJECT / UNRESOLVED`와 근거를 남긴다.
4. 이름·현재 자격·관할·범위·이해충돌·대상 SHA·결정일을 기록한다.
5. `UNRESOLVED` 또는 차단 조건이 하나라도 있으면 다음 P1/ACT 단계로 넘기지 않는다.

`source_document_snapshot_sha`는 패킷을 조립할 때 읽은 원문 묶음의 고정 커밋이다.
패킷 자체와 원문을 함께 검토할 때는 PR #98의 검토 시점 head를 `review_head_sha`에
기록한다. `main`이라는 이름이나 최신 브랜치 상태를 SHA 대신 쓰지 않는다.

## 역할별 패킷

| ID | 검토 역할 | 패킷 | 현재 상태 |
|---|---|---|---|
| APPT-01 | 한국 개인정보·청소년 서비스 법률 | [열기](./APPT-01_PRIVACY_YOUTH_LEGAL.md) | 사람 검토자 미지정 |
| APPT-02 | 청소년 중·장거리 스포츠과학 | [열기](./APPT-02_YOUTH_ENDURANCE_SCIENCE.md) | 사람 검토자 미지정 |
| APPT-03 | 청소년 스포츠의학·의료안전 | [열기](./APPT-03_YOUTH_SPORTS_MEDICINE.md) | 사람 검토자 미지정 |
| APPT-04 | N-of-1·종단 통계 | [열기](./APPT-04_N_OF_1_STATISTICS.md) | 사람 검토자 미지정 |
| APPT-05 | 문헌 선별·추출·평가 | [열기](./APPT-05_HUMAN_RESEARCH_SCREENING.md) | 사람 검토자 미지정 |
| APPT-06 | 실제 선수·코치 사용성 | [열기](./APPT-06_ATHLETE_COACH_USABILITY.md) | 실제 참가자 0명 |
| APPT-07 | 접근성·보조기술 | [열기](./APPT-07_ACCESSIBILITY_AT.md) | 사람 검토자 미지정 |
| APPT-08 | 백엔드 구현 책임 | [열기](./APPT-08_BACKEND_OWNER.md) | 책임자 미지정 |
| APPT-09 | 독립 보안 검토 | [열기](./APPT-09_INDEPENDENT_SECURITY.md) | 사람 검토자 미지정 |
| APPT-10 | 독립 파일럿 검토 | [열기](./APPT-10_INDEPENDENT_PILOT.md) | 참가자 모집 금지 |
| APPT-11 | 파일럿 안전 판정 | [열기](./APPT-11_PILOT_SAFETY.md) | 책임자 미지정 |
| APPT-12 | `SafetyBlockRef` 안전 책임 | [열기](./APPT-12_SAFETY_BLOCK_REF.md) | 책임자 미지정 |
| APPT-13 | Rule owner | [열기](./APPT-13_RULE_OWNER.md) | 책임자 미지정 |
| APPT-14 | Classifier owner | [열기](./APPT-14_CLASSIFIER_OWNER.md) | 책임자 미지정 |

## 모든 패킷의 공통 차단선

- D9 `ACTIVE`와 `UNKNOWN`은 계획 생성을 계속 차단한다.
- D9 `CLEARED`는 의료적 허가, 계획 승인 또는 런타임 권한이 아니다.
- 원문 선수 메모·증상 문구·의료 서술을 감사·동기화·분석 근거에 저장하지 않는다.
- AI, 페르소나, 자동검사, 문서 `PASS`는 이름 있는 사람 검토를 대신하지 않는다.
- `runtime_authority: false`, `participant_enrollment: false`, `approved_plans: 0`을
  패킷 작성만으로 바꾸지 않는다.
- 2026-08-01은 공개 준비 목표일이며 미완료 관문을 자동으로 해제하지 않는다.

[DRAFT_COMPLETE]
