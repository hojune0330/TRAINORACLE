# Formation Competition Anchor Decision Packet V1

```yaml
packet_id: FORMATION_COMPETITION_ANCHOR_V1
status: NOT_REVIEWED
runtime_authority: false
owner_product_identity: 9_5_DAY_FORMATION
owner_target_authority: DEFAULT_AUTOMATED_PRESCRIPTION
owned_fields:
  - competition_anchor_id
  - competition_name
  - timezone
  - venue
  - source_provenance
  - collection_purpose
  - access_scope
  - retention_class
  - competitive_bout_id
  - event_code
  - round_or_role
  - planned_start_at
  - actual_start_at
  - actual_end_at
  - completion_state
  - exposure_contribution
  - race_priority_class
  - taper_template_id
  - taper_template_version
  - reanchor_disposition
  - next_main_review_state
forbidden_fields:
  - universal_taper_days
  - universal_taper_reduction_percent
  - universal_last_main_offset
  - elapsed_time_clearance
  - race_equals_training_physiology
  - automatic_catch_up_debt
```

## 사장님이 결정할 것

이 패킷은 대회 날짜 고정, 실제 출발 수, taper와 대회 후 다음 MAIN 처리의 소유권만
결정한다. 9.5일 제품 정체성을 다시 선택하거나 대회 후 회복을 의학적으로 판정하지 않는다.

| ID | 결정 | 권고 |
|---|---|---|
| CA-01 | 달력의 대회 앵커를 유연한 훈련보다 먼저 고정한다 | 승인 권고 |
| CA-02 | 대회 앵커 1개와 실제 경기 bout N개를 분리한다 | 승인 권고 |
| CA-03 | 완료 bout 하나는 MAIN 노출 하나에만 기여하고 앵커는 기여하지 않는다 | 승인 권고 |
| CA-04 | 단일 출발 대회는 앵커 1개·bout 1개·완료 MAIN 1회로 처리한다 | 승인 권고 |
| CA-05 | 예선·결승·복수 종목은 bout별 완료 노출을 보존하고 부모와 중복 계산하지 않는다 | 승인 권고 |
| CA-06 | 대회 충돌이나 누락으로 catch-up·압축·MAIN 빚을 만들지 않는다 | 승인 권고 |
| CA-07 | 72시간은 목표·경과 표시만 하고 회복·안전 허가에 쓰지 않는다 | 승인 권고 |
| CA-08 | 승인된 버전형 template 없이는 taper나 post-race transform을 생성하지 않는다 | 승인 권고 |
| CA-09 | 적격 후보가 없으면 현재 코치 작성 계획과 일지를 보존한다 | 승인 권고 |

## 별도 값 결정

아래는 연구가 대신 정할 수 없다. 책임자와 코치가 운영 의미를 고정해야 한다.

| ID | 아직 정할 값 | 결정 전 상태 |
|---|---|---|
| CA-O1 | `A/B/C` 또는 준비·주요대회 우선순위 분류와 효과 | `NOT_REVIEWED` |
| CA-O2 | 한 9.5일 프레임 안 복수 대회의 MAIN 목표 수와 지원 세션 처리 | `NOT_REVIEWED` |
| CA-O3 | 종목·시즌·선수별 taper template 구성요소·용량·슬롯 | `NOT_REVIEWED` |
| CA-O4 | 취소·연기·시간대 변경 시 유지·이동·취소 disposition | `NOT_REVIEWED` |
| CA-O5 | 대회 후 첫 MAIN 후보에 필요한 입력·금지 입력 | `NOT_REVIEWED` |

template이 없거나 이 값이 필요한 상황이면 시스템은 다른 주기나 예외 계획을 발명하지
않고 `NO_AUTOMATED_PLAN -> KEEP_CURRENT_COACH_AUTHORED_PLAN`으로 끝낸다.

## 근거와 반대 근거

성인 중거리 taper 연구는 훈련량·빈도·강도 조합이 결과에 영향을 줄 수 있음을 보여주지만
표본이 작고 청소년 전이가 제한된다. 챔피언십 자료는 예선·준결승·결승이 서로 다른
경기 시작과 페이싱 맥락임을 보여준다. 회복 연구에서는 수행·인지 노력·힘·통증 지표가
서로 다른 속도로 변했다.

따라서 대회 구조와 중복 방지는 후보 규칙으로 쓸 수 있지만, 보편 6일·7일 taper,
정확한 D-3 MAIN, 대회 후 24·48·72시간 clearance는 만들 수 없다. 상세 근거는
`FORMATION_COMPETITION_ANCHOR_EVIDENCE_SUPPLEMENT.md`와 후보 claim
`FRV2-CLAIM-K-CAND-001..003`에 있다.

```yaml
evidence_status: CONDITIONALLY_SUPPORTED_STRUCTURE_ONLY
permitted_claim: RULE_INPUT_CANDIDATE
youth_directness: PARTIAL
architecture_directness: PARTIAL
expert_gate: YOUTH_MIDDLE_DISTANCE_SPORT_SCIENCE_REVIEW
privacy_gate: YOUTH_PRIVACY_SAFEGUARDING_AND_DATA_MINIMIZATION_REVIEW
```

## 개인정보와 최소수집

이 패킷이 승인돼도 필드는 자동 수집되지 않는다. 실제 저장은 별도 개인정보·보존 계약과
런타임 승인을 통과해야 한다.

| 필드 | 필요한 목적 | 최소화 규칙 |
|---|---|---|
| `competition_anchor_id` | 대회와 bout 중복 방지 | 무작위 내부 ID. 선수명·학교명 인코딩 금지 |
| `competition_name` | 선수가 대회를 구분 | 자유서술 메모 금지. 정식 명칭 또는 사용자가 고른 짧은 이름 |
| `planned_start_at`·`timezone` | 9.5일 local-civil 배치 | 날짜·시각·IANA timezone만. 위치 추적 금지 |
| `venue` | 이동·시설 제약 표시 | 선택값. 도시/경기장 수준만; 주소·GPS·실시간 위치 금지 |
| `source_provenance` | 정정·중복 방지 | 구조화된 source ID·확인 시각만; 원문 메모·자격정보 금지 |
| `event_code`·`round_or_role` | 실제 출발 수 구분 | 등록된 종목·라운드 값만 |
| `actual_start_at`·`actual_end_at` | 완료 bout의 실제 간격 설명 | 선택값. 자동 위치추적 금지; 사용자/코치의 구조화 입력만 |
| `completion_state` | 완료 노출과 DNS/DNF 구분 | 이유·진단·메모를 붙이지 않음 |
| template·priority·reanchor 상태 | 승인 규칙 version과 변경 설명 | 승인된 enum/ID만; 자유서술 금지 |

```yaml
collection_purpose: COMPETITION_SCHEDULING_EXPOSURE_DEDUPE_AND_USER_EXPLANATION_ONLY
access_scope: ATHLETE_AND_EXPLICITLY_AUTHORIZED_PLAN_REVIEWER_ONLY
retention_class: NOT_DEFINED_RUNTIME_BLOCKED
recipient_share: SEPARATE_USER_DIRECTED_OPERATION_ONLY
analytics_or_reward_use: false_until_separately_approved
telemetry_payload: NO_NAME_NO_VENUE_NO_EXACT_BOUT_TIME_NO_PRIVATE_NOTE
prohibited_collection:
  - exact_gps_or_location_history
  - raw_private_or_training_note
  - medical_or_guardian_free_text
  - wearable_raw_stream
  - contact_or_school_roster
```

보존·삭제·청소년 age-out·철회·법적 보존·키 삭제 규칙이 승인되기 전에는
`retention_class: NOT_DEFINED_RUNTIME_BLOCKED`이며 저장 런타임을 켜지 않는다. 사용자가
대회 일부를 다른 사람에게 공유하려면 기존 `USER_DIRECTED_RECIPIENT_SHARE`의 수신자·필드·
목적·기간·preview·확인을 별도로 거친다. 이 공유는 분석 동의나 상시 접근이 아니다.

## 승인 시 허용

- 9.5일 기본안 생성 전에 대회 앵커를 고정한다.
- 단일·다중 출발을 실제 완료 bout 단위로 한 번씩 계산한다.
- 대회 때문에 바뀐 세션과 이유를 사용자에게 보여준다.
- 승인된 coach template과 입력이 모두 있을 때만 taper 후보를 만든다.

## 승인해도 금지

- 9.5일이나 특정 taper가 과학적으로 최적·우월·안전하다는 주장.
- 대회와 훈련 MAIN이 생리학적으로 같다는 주장.
- 경과시간·수행 유지·무우려 응답만으로 다음 MAIN 허가.
- 예선·결승을 하나로 지우거나 앵커와 bout를 이중 계산.
- 빠진 훈련을 대회 뒤에 몰아넣기.
- 이 패킷만으로 런타임을 켜기.

## 사용자 관점

선수 화면은 대회 전문용어보다 결과부터 말한다.

- 단일 출발: “이 경기를 고정했고, 강한 훈련 1회로 계산했어요.”
- 예선·결승: “이 대회에는 경기 2개가 있어요. 각각 따로 계산했어요.”
- 계획 변경: “대회를 지키려고 화요일 훈련을 옮겼어요.”
- 정보 부족: “자동 계획을 만들지 못했어요. 지금 코치 계획은 그대로예요.”

각 상태에는 `누가 고른 계획인지`, `지금 실행 중인지`, `무엇이 바뀌었는지`, `다음 확인
담당자`를 텍스트로 표시한다. 색·스티커·아이콘만으로 상태를 전달하지 않는다. 휴식과
우려 보고도 성실한 기록으로 인정하며, 대회 출전·완주·속도만 보상하지 않는다.

## 대안과 되돌리기

- CA-02/03 거절 시: 현재 단일 `COMPETITION -> ONE` 규칙을 유지하되 다중 라운드 자동
  처방을 금지하고 사람 검토로 보낸다.
- template 오류 발견 시: 해당 version을 비활성화하고 현재 코치 계획으로 되돌린다.
- 대회 사실 정정 시: 과거 원본과 변경 이력을 보존하고 새 plan version을 만든다.
- 개인정보나 provenance 오류 시: 자동 후보를 폐기하고 원자료를 분석하지 않는다.

## 결정란

```yaml
owner_decision: NOT_REVIEWED
decision: APPROVE | REQUEST_CHANGES | REJECT | NOT_REVIEWED
reviewed_commit: NOT_RECORDED
sport_science_decision: NOT_REVIEWED
privacy_safeguarding_decision: NOT_REVIEWED
required_changes: NOT_RECORDED
runtime_authority: false
```
