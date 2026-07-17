# Formation Competition Anchor Evidence Supplement

```yaml
status: CANDIDATE_SYNTHESIS_PENDING_HUMAN_REVIEW
owner_product_identity: 9_5_DAY_FORMATION
owner_target_authority: DEFAULT_AUTOMATED_PRESCRIPTION
canonical_claim_matrix_changed: false
scientific_superiority_of_9_5_days: UNKNOWN
scientific_safety_of_whole_architecture: UNKNOWN
runtime_authority: false
```

## 결론부터

최신 선택인 “대회를 움직이지 않는 앵커로 두고 완료된 `COMPETITION`을 MAIN 노출 한
번으로 센다”는 원칙은 유지할 수 있다. 다만 예선·결승·복수 종목처럼 실제 출발이 여러
번인 대회는 **달력 앵커 1개**와 **완료 경기 기록 N개**를 분리해야 한다.

- 대회 앵커는 날짜·장소·전체 대회 맥락을 고정하며 노출 수에 직접 더하지 않는다.
- 실제 출발마다 완료 `COMPETITION_BOUT` 기록을 하나 만든다.
- 완료 bout 하나는 MAIN 노출 하나에만 기여한다.
- 앵커와 bout를 함께 세지 않고, 예선·결승을 하나로 뭉개지도 않는다.

이 모델은 최신 결정을 바꾸는 것이 아니라 “`COMPETITION` 한 건”이 무엇인지 명확히 하는
검토 후보다. 책임자 승인 전에는 정본 규칙이나 런타임에 적용하지 않는다.

## 근거 판정

| 질문 | 판정 | 허용되는 해석 | 금지되는 해석 |
|---|---|---|---|
| 대회를 먼저 고정해야 하는가 | `PRODUCT_RULE; EVIDENCE_PARTIAL` | 달력 충돌과 실제 경기 맥락을 보존 | 과학적으로 유일한 최적 배치라고 주장 |
| 단일 출발을 MAIN 1회로 세는가 | `PRODUCT_COUNTING_RULE` | 완료 bout 한 건을 한 번만 계산 | 경기와 훈련 MAIN이 생리학적으로 동일하다고 주장 |
| 다중 라운드를 한 노출로 뭉쳐도 되는가 | `NOT_SUPPORTED` | 앵커 1개 아래 bout N개를 보존 | 예선·준결승·결승을 자동으로 1회 처리 |
| 보편적인 taper 기간·감량률이 있는가 | `UNKNOWN` | 성인 소표본 template 구성요소 후보 | 6일·7일·특정 감량률을 청소년에게 고정 |
| 대회 후 24·48·72시간으로 다음 MAIN을 허가할 수 있는가 | `NOT_SUPPORTED` | 경과시간을 맥락과 목표 간격으로 표시 | 시간만으로 회복·안전·준비 완료 판정 |

중거리 taper 연구는 대체로 성인 남성 8-10명 수준이며 여러 요소를 한꺼번에 바꿨다.
챔피언십 분석은 라운드와 페이싱이 다름을 보여주지만 생리적 회복 시간을 측정하지 않았다.
연속 1500 m와 청소년 축구 회복 연구는 수행·주관적 노력·힘·통증이 서로 다른 속도로
변할 수 있음을 보여줄 뿐, 다음 MAIN 허가선을 만들지 않는다.

상세 출처와 제한은
`.omo/evidence/formation-research-v2/competition-anchor-primary-research.md`, 보충 검색 흔적은
`reports/research/evidence/FORMATION_SUPPLEMENTAL_SEARCH_LOG_20260717.md`, 후보 상태는
`reports/research/evidence/FORMATION_SUPPLEMENTAL_SOURCE_CANDIDATES_20260717.csv`에서 추적한다.

## 스펙용 후보 구조

```yaml
competition_anchor:
  competition_anchor_id: required
  competition_name: required
  planned_start_at: required
  timezone: required
  venue: optional
  source_provenance: required
  collection_purpose: COMPETITION_SCHEDULING_EXPOSURE_DEDUPE_AND_USER_EXPLANATION_ONLY
  access_scope: ATHLETE_AND_EXPLICITLY_AUTHORIZED_PLAN_REVIEWER_ONLY
  retention_class: NOT_DEFINED_RUNTIME_BLOCKED
  race_priority_class: owner_decision_pending
  taper_template_id: optional_only_after_owner_approval
  taper_template_version: optional_only_after_owner_approval
  reanchor_disposition: owner_decision_pending
  next_main_review_state: required
  bouts:
    - competitive_bout_id: required
      event_code: required
      round_or_role: HEAT | SEMIFINAL | FINAL | SINGLE_RACE | RELAY | OTHER
      planned_start_at: required
      actual_start_at: optional_structured_entry_only
      actual_end_at: optional_structured_entry_only
      completion_state: PLANNED | COMPLETED | DNS | DNF | CANCELLED
      exposure_contribution: ZERO | ONE
      source_provenance: required
```

계산 후보는 `COMPLETED -> ONE`, 그 밖의 상태는 `ZERO`다. 앵커 자체는 항상 `ZERO`이며
동일 bout의 부모·자식 기록을 두 번 세지 않는다. 실제 시작·종료·완료 상태가 없으면
계획값으로 완료 노출을 추정하지 않는다.

`competition_name`은 구분용 짧은 명칭, `venue`는 선택적인 도시/경기장 수준이다. 정확한
주소·GPS·위치 이력·원문 메모·웨어러블 원시 스트림은 수집하지 않는다. 실제 시작·종료는
간격 설명에 필요한 경우 사용자가 또는 명시적으로 승인된 코치가 구조화해서 입력하며,
보존·삭제·접근 계약과 청소년 개인정보 검토 전에는 영속 저장하거나 telemetry로 보내지
않는다.

## 자동 계획의 경계

다음 구조는 최신 선택과 근거가 함께 지지한다.

1. 대회 앵커를 유연한 세션보다 먼저 배치한다.
2. 충돌 시 대회를 보존한다.
3. 놓친 MAIN은 빚이 아니며 대회 뒤 catch-up·압축을 만들지 않는다.
4. 72시간은 목표·경과 표시일 뿐 clearance가 아니다.
5. 승인된 버전형 taper template이 없으면 taper를 발명하지 않는다.
6. 적격 후보가 없으면
   `NO_AUTOMATED_PLAN -> KEEP_CURRENT_COACH_AUTHORED_PLAN`으로 현재 계획과 일지를 보존한다.

다음 값은 연구 평균에서 만들지 않고 책임자·코치 결정 패킷으로 남긴다.

- 대회 우선순위 분류와 의미.
- 한 프레임에 대회가 여러 개일 때 2-3 MAIN 목표의 정확한 처리.
- 종목·시즌·선수별 taper template의 구성요소·용량·슬롯.
- 취소·연기·시간대 변경 때 displaced session의 disposition.
- 대회 후 첫 MAIN 후보에 필요한 입력과 금지 입력.

## 사용자 관점

첫 화면에는 “대회 날짜를 먼저 지켰어요”와 바뀐 훈련만 보여준다. 여러 출발이 있으면
“이 대회에는 경기 2개가 있어요. 예선과 결승을 각각 계산했어요”처럼 말한다. `노출`,
`taper`, `clearance`를 선수 기본 화면의 첫 문장으로 쓰지 않는다.

추천 상태는 다음 네 줄이면 충분하다.

1. `대회`: 언제 무엇을 뛰는지.
2. `바뀐 점`: 유지·이동·취소된 세션.
3. `현재 상태`: 자동 기본안인지 실제 실행 확정 계획인지.
4. `확인 필요`: 누가 무엇을 확인하는지.

대회를 마친 뒤에는 수행 기록만 보고 “회복 완료”라고 말하지 않는다. 통증·질병·강한
피로 또는 정보 충돌이 있으면 현재 계획을 보존한 채 코치 확인 상태를 명시한다. 휴식,
DNS/DNF의 정직한 기록, 우려 보고는 기록 연속성과 보상을 잃게 하지 않는다.

## 후보 claim

아래는 정본 claim matrix에 아직 넣지 않는 보충 후보다.

| 후보 ID | 후보 claim | 현재 상태 |
|---|---|---|
| `FRV2-CLAIM-K-CAND-001` | 달력상 대회 앵커 하나와 실제 경기 bout N개를 분리하면 다중 라운드의 노출을 보존할 수 있다 | `RULE_INPUT_CANDIDATE; HUMAN_REVIEW_REQUIRED` |
| `FRV2-CLAIM-K-CAND-002` | 모든 중거리 선수에게 적용되는 보편 taper 기간·감량률·마지막 고강도 위치가 있다 | `UNKNOWN; PROHIBITED` |
| `FRV2-CLAIM-K-CAND-003` | 대회 후 24·48·72시간 경과만으로 다음 MAIN의 회복·안전·준비를 허가할 수 있다 | `NOT_SUPPORTED; PROHIBITED` |

## 남은 게이트

- 보충 후보의 인간 중복 확인·선별·추출·평가.
- 청소년 중거리 스포츠과학 검토.
- 책임자의 대회 counting·priority·multi-race·taper 결정.
- 실제 코치 시나리오와 중학생 teach-back 검토.
- 개인정보·보조기술·회귀 테스트.

이 보충문은 정본 규칙 변경이나 실제 자동 처방 승인이 아니다.
