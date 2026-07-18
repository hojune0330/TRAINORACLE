# Formation Load Component Decision Packet V2

```yaml
packet_id: FORMATION_LOAD_COMPONENT_V2
status: NOT_REVIEWED
runtime_authority: false
owner_product_identity: 9_5_DAY_FORMATION
owner_target_authority: DEFAULT_AUTOMATED_PRESCRIPTION
owned_fields:
  - component_id
  - component_family
  - quantity
  - unit
  - source_type
  - provenance
  - method_id
  - method_version
  - device_identity
  - quality_state
  - missing_reason
  - parent_session_id
  - order_index
  - separation_minutes
  - aggregation_scope
  - dedupe_key
forbidden_fields:
  - minimum_observation_count
  - baseline_eligibility
  - freshness_threshold
  - change_threshold
  - causal_claim_level
  - statistical_significance
```

## 사장님이 결정할 것

이 패킷은 “무슨 데이터를 어떤 구조로 보존할지”만 결정한다. 몇 개가 쌓여야 분석하는지,
언제 오래된 데이터인지, 변화가 의미 있는지는 Minimum Evidence 패킷의 소유다.

| ID | 결정 | 권고 |
|---|---|---|
| LC-01 | 내적·외적·파생·맥락 네 계열을 분리한다 | 승인 권고 |
| LC-02 | 물리 단위·척도·방법·기기·출처·시각을 보존한다 | 승인 권고 |
| LC-03 | 복합 세션을 부모 1개와 순서 있는 구성요소로 저장한다 | 승인 권고 |
| LC-04 | 같은 관측을 부모와 자식에서 두 번 계산하지 않는다 | 승인 권고 |
| LC-05 | 전체 세션 sRPE를 구성요소에 임의 분배하지 않는다 | 승인 권고 |
| LC-06 | 파생값은 공식 ID·버전·원천 ID가 있을 때만 생성한다 | 승인 권고 |
| LC-07 | 방법이 다른 TRIMP·임의단위를 서로 같은 값으로 취급하지 않는다 | 승인 권고 |
| LC-08 | ACWR 안전/위험 구간과 자동 행동을 등록하지 않는다 | 승인 권고 |
| LC-09 | 화면 요약 부하와 분석 원장을 분리한다 | 승인 권고 |

## 근거와 반대 근거

훈련부하 합의문과 청소년 거리주자 sRPE 연구는 내적·외적 값과 방법 정보를 분리해
반복 측정할 근거를 제공한다. 웨어러블 연구는 모델·착용·알고리즘·활동별 오차가 다름을
보여준다. 반면 전체 세션 sRPE의 비례 분할, TRIMP 공식 간 등가성, ACWR 행동구간은
지지되지 않는다. 자세한 출처는 claim `FRV2-CLAIM-D-001..004`와
`FORMATION_COMPOSITE_AND_LOAD_EVIDENCE_REVIEW.md`에 있다.

```yaml
evidence_status: CONDITIONALLY_SUPPORTED
permitted_claim: RULE_INPUT_CANDIDATE
youth_directness: PARTIAL
architecture_directness: INDIRECT
expert_gate: YOUTH_ENDURANCE_SPORT_SCIENCE_REVIEW
```

## 승인 시 허용

- 9.5일 후보를 설명하기 위한 구성요소·단위·출처·순서·간격 저장 계약 초안.
- 호환되는 물리량의 설명용 합계와 부모/자식 중복 방지.
- 선수 화면의 간단 요약과 전문가 상세 보기를 같은 원장에서 생성.

## 승인해도 금지

- 종합 피로·회복·준비도·부상위험·안전 점수.
- 72시간 또는 부하값만으로 MAIN 허가.
- 숨은 결측 대체·0 처리·기기 블랙박스 점수.
- 구성요소·부하값 하나가 accepted plan을 직접 바꾸는 것과 이 패킷만으로 런타임을
  활성화하는 것. 승인된 구성요소가 나중에 9.5일 generator 입력이 되는 것은 별도다.

## 사용자 관점

선수는 하루를 한 타일로 보지만 `달리기 + 웨이트 + 플라이오`를 펼쳐볼 수 있다. 입력은
한 번의 복합 세션 흐름으로 끝나며, 같은 운동을 여러 화면에서 반복 입력하지 않는다. 색은
기본적으로 부담/강도 수준을 나타내고 구성요소는 아이콘과 라벨로 구분한다. 색만으로 상태를
전달하지 않는다.

오류가 있으면 원자료를 고칠 수 있어야 하고, 고친 값으로 무엇이 바뀌는지 보여준다. 기기가
바뀌면 기록은 유지하되 이전과 직접 비교하지 않는 이유를 설명한다.

## 대안과 되돌리기

- 거절 시: 원자료를 관찰값으로만 저장하고 모든 합산·파생·자동 후보 입력을 억제한다.
- 변경 요청 시: 승인된 구성요소만 allowlist에 넣고 나머지는 `UNREGISTERED_COMPONENT`로
  저장하되 분석하지 않는다.
- 잘못된 공식/단위가 발견되면 파생값을 폐기하고 원자료로 되돌릴 수 있어야 한다.

## 결정란

```yaml
owner_decision: NOT_REVIEWED
decision: APPROVE | REQUEST_CHANGES | REJECT | NOT_REVIEWED
reviewed_commit: NOT_RECORDED
sport_science_decision: NOT_REVIEWED
required_changes: NOT_RECORDED
runtime_authority: false
```
