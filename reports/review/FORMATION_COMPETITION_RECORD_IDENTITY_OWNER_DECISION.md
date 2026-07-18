# Formation 대회 기록 정체성 책임자 결정표

```yaml
decision_sheet_id: FORMATION_COMPETITION_RECORD_IDENTITY_OWNER_DECISION
status: NOT_REVIEWED
owner_decision: NOT_REVIEWED
ca_02_decision: NOT_REVIEWED
ca_02_choices: "APPROVE | REVISE | REJECT"
ca_03_decision: NOT_REVIEWED
ca_03_choices: "APPROVE | REVISE | REJECT"
current_counting_rule: ONE_COMPLETED_COMPETITION_RECORD_ONE_EXPOSURE
calendar_anchor_exposure: 0
canonical_counting_changed: false
runtime_authority: false
```

## 지금 적용되는 규칙

완료된 `COMPETITION` 기록 한 건은 MAIN 노출에 **최대 한 번**만 기여한다. 달력의 대회
앵커는 대회 날짜와 맥락을 묶는 표지이며, 그 자체로 노출을 더하지 않는다. 한 대회에 실제
경기가 여러 번 있을 때 무엇을 각각의 완료 기록으로 볼지는 아직 정본 규칙이 아니다.
CA-02와 CA-03의 현재 상태는 모두 `NOT_REVIEWED`이므로 지금의 계산은 바뀌지 않는다.

## 한 대회 날을 네 가지로 보기

예: 같은 날 800m 예선, 800m 결승, 4x400m 계주에 출전한다.

| 구분 | 이 예에서 뜻하는 것 | 노출 계산 |
|---|---|---|
| 대회(meet) | 하루 전체를 묶는 달력 앵커 1개 | 앵커 자체는 0회 |
| 종목과 경기(event/bout) | 종목은 800m와 4x400m이고, 실제 출발은 800m 예선·800m 결승·4x400m 계주 3개 | 출발했다는 사실만으로 계산하지 않음 |
| 완료 기록(completed record) | 각 bout가 `COMPLETED`일 때 만드는 후보 기록. 세 경기 모두 완료했다면 후보 기록 3개 | CA-02/03 승인 전에는 정본 다중 기록이 아님 |
| 노출(exposure) | Formation이 세는 단위 | 후보안에서는 완료 기록마다 최대 1회, 앵커 추가 0회 |

`PLANNED`, `DNS`, `DNF`, `CANCELLED`는 완료 기록으로 추정하지 않는다. 따라서 이 예의
“완료 기록 3개, 노출 최대 3회, 앵커 추가 0회”는 **승인할 후보안의 결과**일 뿐 현재 자동
계산이 아니다. 승인 전 다중 경기 자동 처방은 금지하고 사람 검토로 보낸다.

## 결정할 두 항목

권고는 책임자의 결정을 대신하지 않는 제안이다.

| ID | 제안 | 제안 권고 | 책임자 선택 | 현재 응답 |
|---|---|---|---|---|
| CA-02 | 대회 앵커 1개와 실제 출발 bout N개의 정체성을 분리한다 | `APPROVE` 권고(제안) | `APPROVE \| REVISE \| REJECT` | `NOT_REVIEWED` |
| CA-03 | 앵커는 0회, `COMPLETED` bout는 최대 1회, 나머지 상태는 0회로 하고 중복 기록은 한 번만 센다 | `APPROVE` 권고(제안) | `APPROVE \| REVISE \| REJECT` | `NOT_REVIEWED` |

CA-02와 CA-03이 모두 `APPROVE`여야만 후속 정본 스펙 패치에서 다중 bout 정체성과 노출
규칙을 함께 제안할 수 있다. 한 항목의 승인으로 다른 항목까지 승인된 것으로 보지 않는다.

## 선택이 후속 스펙에 주는 권한

| 선택 | CA-02에서 허용되는 다음 단계 | CA-03에서 허용되는 다음 단계 |
|---|---|---|
| `APPROVE` | 후속 정본 스펙 패치가 앵커와 bout의 분리된 불변 ID 구조를 정확히 반영하도록 허용 | 후속 정본 스펙 패치가 앵커 `ZERO`, 완료 bout `ZERO 또는 ONE`, 미완료 상태 `ZERO`, 중복 제거 규칙을 정확히 반영하도록 허용 |
| `REVISE` | 요청한 정체성 변경만 후보 문서에 반영해 다시 검토하도록 허용. 정본 패치는 허용하지 않음 | 요청한 계산 변경만 후보 문서에 반영해 다시 검토하도록 허용. 정본 패치는 허용하지 않음 |
| `REJECT` | 분리 정체성을 정본에 넣지 않고 현재 한 기록 규칙과 사람 검토 경계를 유지하도록 허용 | bout별 노출 확대를 정본에 넣지 않고 현재 계산과 사람 검토 경계를 유지하도록 허용 |

여기서 `APPROVE`는 해당 내용을 담은 **후속 정본 스펙 패치의 진행만** 허용한다. 이 결정표
자체가 스펙을 고치거나, 필드를 수집하거나, 자동 처방을 실행하는 권한은 주지 않는다.

## 어느 선택에서도 지켜야 할 경계

- **중복 방지:** 한 bout의 부모·자식·가져온 사본을 함께 세지 않는다. 한 완료 bout는 최대
  한 번만 센다. `competition_anchor_id`와 `competitive_bout_id`는 불변 정체성으로 두고,
  정정할 때 ID를 재사용하거나 합치지 말고 버전과 변경 이력을 남긴다.
- **최소수집:** 실제 시작·종료 시각은 간격 설명에 꼭 필요할 때만 선택적 구조화 입력으로
  받는다. 자동 위치 추적, 정확한 주소·GPS·위치 이력, 원문 개인/훈련 메모, 의료·보호자
  자유서술, 웨어러블 원시 스트림은 수집하지 않는다.
- **청소년 개인정보:** 보존·삭제·접근·철회 계약과
  `YOUTH_PRIVACY_SAFEGUARDING_AND_DATA_MINIMIZATION_REVIEW` 통과 전에는 영속 저장, 공유,
  telemetry 사용을 허용하지 않는다.
- **스포츠과학:** `YOUTH_MIDDLE_DISTANCE_SPORT_SCIENCE_REVIEW`와 별도 규칙 승인이 남는다.
  대회와 훈련 MAIN이 생리학적으로 같다는 주장, 보편 taper, 24·48·72시간만으로 하는
  회복·안전·다음 MAIN 허가는 생기지 않는다.
- **런타임:** 앱, 스키마, 마이그레이션, 자동 계산, 자동 처방, 배포 권한은 계속 없다.
  스포츠과학·개인정보·인간 검토와 별도 런타임 승인 전까지 `runtime_authority: false`다.

결정 근거: `FORMATION_COMPETITION_ANCHOR_DECISION_PACKET_V1.md`,
`FORMATION_COMPETITION_ANCHOR_EVIDENCE_SUPPLEMENT.md`,
`FORMATION_LATEST_OWNER_DECISION_BASELINE.md`.
