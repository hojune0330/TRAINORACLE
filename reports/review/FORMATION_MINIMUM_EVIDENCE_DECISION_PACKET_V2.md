# Formation Minimum Evidence Decision Packet V2

```yaml
packet_id: FORMATION_MINIMUM_EVIDENCE_V2
status: NOT_REVIEWED
runtime_authority: false
owner_product_identity: 9_5_DAY_FORMATION
owner_target_authority: DEFAULT_AUTOMATED_PRESCRIPTION
owner_product_direction: APPROVE_RECORDED_PENDING_NAMED_REVIEW
owner_direction_binding: reports/review/FORMATION_OWNER_DIRECTION_BINDING_2026-07-18.md
owned_fields:
  - claim_level
  - intended_use
  - coverage_count
  - coverage_span
  - coverage_cadence
  - context_coverage
  - protocol_continuity
  - comparison_compatibility
  - reliability_source
  - error_model
  - important_change_definition
  - freshness_semantics
  - trend_check
  - autocorrelation_check
  - carryover_check
  - confound_check
  - permitted_interpretation
forbidden_fields:
  - component_id_definition
  - component_family_definition
  - physical_unit_definition
  - derivation_formula_definition
  - parent_leaf_dedupe_definition
  - device_schema_definition
```

## 사장님이 결정할 것

이 패킷은 “현재 데이터로 어떤 말까지 해도 되는지”를 결정한다. 구성요소·단위·공식 자체는
Load Components 패킷이 정하며 여기서 재정의하지 않는다.

책임자는 2026-07-18에 아래 권고 전체를 제품 방향으로 승인했다. 이 기록은 이름 붙은 통계
검토, 정식 결정란 서명, 정본 패치 또는 런타임 권한을 대신하지 않는다.

| ID | 결정 | 권고 |
|---|---|---|
| ME-01 | 네 단계 claim ladder를 채택한다 | 승인 권고 |
| ME-02 | 한 개의 유효 기록은 관찰 사실만 허용한다 | 승인 권고 |
| ME-03 | 기준선은 호환 기록과 맥락 범위를 지표별로 검토한다 | 승인 권고 |
| ME-04 | 측정오차보다 큰 변화는 호환 오차모형이 있을 때만 말한다 | 승인 권고 |
| ME-05 | 개인 비교 가설은 사전계획·비교·시계열 검사를 요구한다 | 승인 권고 |
| ME-06 | 보편 최소 n·보편 신선도·보편 변화 임계값을 만들지 않는다 | 승인 권고 |
| ME-07 | 기기/방법 변경·교란·이월·결측이면 승격을 억제한다 | 승인 권고 |
| ME-08 | 어느 단계도 단독으로 계획 변경·효능·안전·준비도를 허용하지 않는다 | 승인 권고 |
| ME-09 | 개인화 값의 근거 게이트가 실패하면 그 값을 만들지 않고 현재 코치 작성 계획을 유지한다 | 승인 권고 |

## 근거와 반대 근거

신뢰도·SEM·MDC·SWC 연구는 측정오차와 실제 변화 해석을 분리해야 함을 지지한다.
N-of-1/SCED 방법은 사전 계획·기간·이월·추세·자기상관·반복을 요구한다. 반대 근거는 작은
표본의 반응자 분류, MBI, 임의 기준선 안정성, 단순 전후 비교가 거짓 확신을 만들 수 있음을
보여준다. 보편 최소 관찰 수나 데이터 나이 기준은 확인되지 않았다.

```yaml
evidence_status: CONDITIONALLY_SUPPORTED
permitted_claim: RULE_INPUT_CANDIDATE
youth_directness: INDIRECT
architecture_directness: INDIRECT
expert_gate: LONGITUDINAL_N_OF_1_STATISTICIAN_REVIEW
```

## 승인 시 허용

- 관찰·설명 기준선·오차보다 큰 변화·사전 비교 가설의 단계별 표시.
- 지표별 호환성·오차·coverage·freshness가 승인된 경우에만 단계 승격.
- 선수에게 사용된 기록·누락·비교 중단 이유를 보여주는 설명.
- 개인화 값이 준비되지 않아도 9.5일 제품 정체성은 유지하되
  `KEEP_CURRENT_COACH_AUTHORED_PLAN`으로 끝내는 명확한 상태.

## 승인해도 금지

- 기록 수만으로 개인 반응자·효능·안전·회복·준비도 판단.
- 보편적인 `3회`, `7일`, `30일` 같은 임계값 발명.
- 사후 좋은 구간만 고른 인과 주장.
- 이 패킷만으로 자동 처방 규칙·런타임 활성화를 승인하는 것. 승인된 지표가 나중에
  게이트를 통과한 9.5일 generator의 rule input이 되는 것은 별도 정본 패치로 다룬다.
- `PRIVATE_SELF_ONLY`의 내용·존재·길이·시각·빈도를 coverage, freshness, 결측 이유,
  중단 이유에 사용하는 것.

## 사용자 관점

선수는 내부 통계 단계 대신 “기록됨”, “비교 준비 중”, “최근 같은 방식의 범위”, “측정
오차만으로 보기 어려운 변화”처럼 이해 가능한 문장을 본다. 분석을 못 하는 이유는 벌점이
아니라 데이터 호환성과 불확실성으로 설명한다.

기록이 부족하거나 기기가 바뀌어도 스티커·연속 기록 보상을 잃지 않는다. 보상은 입력 참여를
확인할 뿐, 데이터가 건강하거나 계획을 따라야 한다는 압력으로 작동하면 안 된다. 선수는
분석에 사용된 기록과 제외된 기록을 확인·정정할 수 있어야 한다.

같은 결정의 다섯 설명 수준과 방법론 근거는
`.omo/evidence/formation-research-v2/within-athlete-minimum-evidence-primary-research.md`에
있다. 쉬운 설명부터 정확한 계약 표현까지 사실과 결과 코드는 바뀌지 않는다.

## 대안과 되돌리기

- 거절 시: 모든 값은 `OBSERVATION`만 허용하고 비교 문장을 억제한다.
- 변경 요청 시: 승인된 지표·목적 조합만 allowlist에 올린다.
- 오류모형·프로토콜이 바뀌면 기존 승격 결과를 `SUPPRESSED_VERSION_MISMATCH`로 되돌리고
  원자료는 보존한다.

## 결정란

```yaml
owner_decision: NOT_REVIEWED
decision: APPROVE | REQUEST_CHANGES | REJECT | NOT_REVIEWED
reviewed_commit: NOT_RECORDED
statistics_decision: NOT_REVIEWED
required_changes: NOT_RECORDED
runtime_authority: false
```
