# DETAILED_PRESCRIPTION_RECONCILIATION_2026-07-26.md

```yaml
document_metadata:
  doc_id: trainoracle-review-detailed-prescription-2026-07-26
  spec_id: DETAILED_PRESCRIPTION_RECONCILIATION
  title: TrainOracle 상세 훈련 처방 기존 자료 정합성 검토와 연구 시드
  version: "0.1"
  round: RT1
  status: DRAFT_FOR_REVIEW
  owner: COACH_HOJUNE
  open_issues_total: 8
  canonical_blocking_count: 4

authority:
  runtime_authority: false
  canonical_promotion_allowed: false
  automatic_prescription_authorized: false
  numeric_template_activation_authorized: false
  source_research_is_runtime_evidence: false
```

## 1. 책임자 표기 해석 확정

책임자가 확정한 표기는 다음 의미다.

```text
2×(10×400m) @5000m RP · r60″ · R3′
```

```yaml
notation_fixture:
  setCount: 2
  repetitionsPerSet: 10
  totalRepetitions: 20
  repetitionDistanceM: 400
  qualityDistanceM: 8000
  paceAnchor:
    eventDistanceM: 5000
    anchorType: RACE_PACE
  repetitionRecoverySeconds: 60
  setRecoverySeconds: 180
  recovery_semantics:
    lowercase_r: BETWEEN_REPETITIONS_INSIDE_ONE_SET
    uppercase_R: BETWEEN_SETS
    set_end_rule: SET_RECOVERY_REPLACES_REPETITION_RECOVERY
  derivedRecovery:
    repetitionRecoveryOccurrences: 18
    setRecoveryOccurrences: 1
    totalRecoverySecondsExcludingWarmupCooldown: 1260
```

즉 총 20회를 수행하며, 각 세트 안에서 반복 사이 60초를 9번씩 쉬고,
첫 세트가 끝나면 세트 사이 3분을 쉰다. 마지막 반복 뒤에는 다음 반복이
없으므로 `r60″`을 더하지 않는다.

이 표기는 파서, 계산기, 화면 풀이의 필수 회귀 테스트다. 그러나 총 질적
러닝 거리가 8,000m이므로 이 문서만으로 일반 선수, 청소년 또는 중장거리
선수에게 자동 배정되는 기본 템플릿이 되지는 않는다. 실제 활성화에는 종목,
연령, 경력, 현재 훈련량, 같은 Formation의 다른 MAIN 노출과 사람 검토가
필요하다.

## 2. 기존 자료는 사라진 것이 아니다

| 자료 | 실제 확인 내용 | 현재 역할 |
|---|---|---|
| PR #115 `PLAN_WORKOUT_DETAIL_UX_PROPOSAL_2026-07-24.md` | `2×(10×400m)`, 20m 스타트 대시, 30m/50m 알락틱 스프린트, 언덕 스프린트, 젖산 내성, 복합 인터벌, 3층 카드가 존재 | 가장 가까운 상세 처방 기획 원본. 미병합 `PROPOSAL_ONLY` |
| PR #120 `PLAN_PRESCRIPTION_DETAIL_GAP_2026-07-26.md`와 앱 변경 | 현재 베타가 시간/RPE까지만 제공하고 반복·거리·페이스·회복은 아직 배정하지 않는다고 정직하게 표시 | 현재 런타임 경계와 UX 기준 |
| PR #121 `ENERGY_SYSTEM_GUIDANCE_AND_CALIBRATION_SPEC.md` | 실제 수행값과 코치 범위를 비교해 `BELOW/WITHIN/ABOVE/UNAVAILABLE`만 표시 | 처방 생성이 아니라 수행 후 그림자 비교 계층 |
| `specs/legacy-reference/GLOSSARY.md` | `8×400m · GLY-SHORT · rest 3min`, `6×80m · ATP-PC`, VO2 400~1200m 예시 | 레거시 용어와 예시. 현재 정본 규칙을 대체하지 않음 |
| `ui_kits/trainoracle-app/SessionDetail.jsx` | 5000m PB를 근거로 1000m 목표를 보여주는 시연 문구 | 디자인 시연. 검증된 공식 또는 런타임 권한 아님 |
| `specs/reconstruct/TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md` | `BASE`, `THRESHOLD`, `VO2`, `GLYCOLYTIC`, `SPEED_POWER` 구성요소와 9.5일 Formation 경계 | 계획 구조 계약. 개별 세션 수치 템플릿은 아직 없음 |

따라서 누락의 원인은 논의 부재가 아니라 다음 세 가지가 서로 다른 PR과
레거시 파일에 분산되어 병합되지 않은 것이다.

1. 세션 처방과 표기: PR #115
2. 현재 베타의 정직한 표시: PR #120
3. 수행 후 코치 범위 비교: PR #121

## 3. PR #121 검토 판정

### 3.1 수용할 부분

- 관찰값, 코치 등록 범위, 비교 결과를 서로 다른 레코드로 둔다.
- 결측, 단위 불일치, 복합 세션 배분 불명은 `UNAVAILABLE`로 둔다.
- 비교 결과가 계획 변경, 안전 해제, 회복 판정 또는 다음 훈련 자동 배치로
  승격되지 않는다.
- 복합 훈련의 상위 세션과 하위 구성요소를 보존하고 이중 계산을 막는다.

### 3.2 수정해야 할 부분

PR #121 Section 6~7의 "9.5일 / MAIN 2~3회를 다시 채택할지"는 최신 main의
`FORMATION_LATEST_OWNER_DECISION_BASELINE.md`와 충돌한다.

```yaml
latest_owner_decision:
  product_identity: 9_5_DAY_FORMATION
  target_authority: DEFAULT_AUTOMATED_PRESCRIPTION
  default_main_exposures: 2_TO_3_PER_FORMATION
  scientific_superiority_claim: FORBIDDEN
  whole_architecture_safety_claim: FORBIDDEN
```

따라서 PR #121은 9.5일 채택 여부를 다시 묻지 말고 다음만 미결정으로 남겨야
한다.

- 코치 범위에 허용할 차원과 단위
- 범위 등록 권한과 버전 관리
- 그림자 비교 기간, 중단 조건과 검토 주기
- 비교 결과를 후보 설명에 붙일 수 있는 후속 승인 조건

또한 PR #121의 코치 범위 비교는 자기 주도 계획 생성을 막는 권한이 아니다.
코치 연결이 없는 사용자는 안전 게이트와 적격 입력을 통과하면 기본 계획을
받을 수 있고, 코치 강제 검토가 설정된 선수만 사람 확인을 필수로 한다.

## 4. PR #115 검토 판정

PR #115는 사용자 요구와 가장 가깝지만 그대로 구현하기 전에 보강이 필요하다.

1. 표기 예시는 책임자 최신 결정인 `r60″ · R3′`와 다르다.
2. 문헌 이름만 있고 정확한 URL, DOI, 대상 집단, 직접/간접 근거 구분이 부족하다.
3. 에너지 시스템 배지는 생리학적 측정값이 아니라 계획 의도 라벨이어야 한다.
4. `2×(10×400m)`를 표기 예시와 실제 활성 템플릿으로 구분하지 않았다.
5. 청소년, 초보, 성인, 엘리트에 대한 전이 한계를 각 수치 템플릿에 붙여야 한다.
6. 총 반복 거리, 총 고강도 시간, 반복/세트 회복 총량을 계산하는 필드가 없다.
7. PB, SB, 목표 기록 중 무엇을 사용했는지와 기록 시점/출처가 없다.
8. 30m 스프린트에 중장거리 RP 공식을 잘못 적용하지 않는 별도 앵커가 필요하다.

판정은 `USE_AS_WORKING_PROPOSAL_AFTER_SOURCE_AND_SCHEMA_RECONCILIATION`이다.
PR #115를 그대로 ACTIVE 템플릿으로 승격해서는 안 된다.

## 5. 온라인 근거 시드

아래 자료는 후속 Terra 작업자가 원문을 다시 열어 세션별로 연결해야 한다.
이 목록 자체가 사람의 스포츠과학 승인은 아니다.

| Source ID | 자료 | 사용할 수 있는 범위 | 사용할 수 없는 주장 |
|---|---|---|---|
| `SRC-VDOT-PACES` | [V.O2 공식 계산기와 E/I/R/Fast Rep 설명](https://vdoto2.com/calculator/) | E 30~45분, I 2~4분 반복 예시, R 200/400m, Fast Rep 200~600m 예시 | 모든 연령·수준의 자동 용량 |
| `SRC-VDOT-T` | [V.O2 Threshold 설명](https://support.vdoto2.com/2017/12/whats-threshold-pace/) | 20분 T, 5~15분 cruise 반복, 1~2분 회복 | 개인별 주간 총량 또는 청소년 안전성 |
| `SRC-VDOT-CRUISE` | [V.O2 Cruise Interval 설명](https://news.vdoto2.com/2025/06/get-the-most-out-of-your-threshold-training/) | `4×1mi @T · r1′` 예와 속도를 올리지 말라는 실행 경계 | TrainOracle 전체 주기 검증 |
| `SRC-VDOT-GUIDE` | [V.O2 Adaptive Trainer 안내](https://support.vdoto2.com/vdot-adaptive-trainer-instructional-guide/) | 주행 일수·경력·휴지기 고려, quality day 사이 easy day, 거리/시간 표현 | TrainOracle 9.5일의 우월성 |
| `SRC-WA-SPRINT-INTRO` | [World Athletics, Introduction to sprinting](https://worldathletics.org/download/downloadnsa?filename=a0cae133-1056-4b89-9f93-16d87fd3bbd4.pdf&urlslug=introduction-to-sprinting) | 15~25m 가속 + 30m 최고속 구간, 반복 사이 2~5분 회복 예 | 모든 선수에게 최대질주 자동 처방 |
| `SRC-WA-SPRINT-RT` | [World Athletics, NSA sprint round table](https://worldathletics.org/download/downloadnsa?filename=f5f00a69-bc4e-46c7-af53-e356d5b9630b.pdf&urlslug=nsa-round-table-no-3-sprints) | 20~80m 속도/알락틱, 80~300m speed endurance, 300~600m lactate tolerance와 긴 회복 범주 | 청소년 중장거리로의 직접 전이 |
| `SRC-WA-DECATHLON` | [World Athletics, 미국 10종경기 선수의 발달과 훈련](https://worldathletics.org/download/downloadnsa?filename=ac054a49-c021-4864-a46b-5a33fb94b144.pdf&urlslug=the-development-and-training-of-decathletes-i) | `250m+100m`, `150m-200m-300m` 등 문서에 실린 코칭 사례 | 10종경기 성인 사례를 중장거리·청소년에 직접 적용 |
| `SRC-WA-SPRINTS` | [World Athletics, The Sprints](https://worldathletics.org/download/downloadnsa?filename=f411d6b2-f0be-456f-b969-28abad2159ce.pdf&urlslug=the-sprints) | 바운드와 30m 가속을 결합한 문서 내 훈련 예 | 플라이오메트릭 복합 세션의 자동 처방 |
| `SRC-WA-1500` | [World Athletics, endurance runners를 위한 speed training](https://worldathletics.org/personal-best/performance/speed-training-endurance-runners-benefits-limits) | 1500m 목표 세션 `3~4×500m · r2~3′`, `3×(800+200+200)` 예 | 입문 세션. 원문도 수개월에 걸쳐 준비해야 한다고 경고 |
| `SRC-WA-MEDICAL` | [World Athletics Medical Manual](https://worldathletics.org/download/download?filename=3f74b21a-2a83-4f92-9a30-759603533e5d.pdf&urlslug=Medical+Manual+%28complete%29) | 청소년 훈련 전 적절한 20~30분 워밍업 원칙 | 워밍업만으로 안전이 보장된다는 주장 |
| `SRC-PMID-39835194` | [3분 long interval과 30초 short interval 비교](https://pubmed.ncbi.nlm.nih.gov/39835194/) | 훈련된 중거리 선수의 `4×3min`, `24×30s` 직접 프로토콜 | 청소년 또는 모든 종목의 최적 프로토콜 |
| `SRC-PMID-36314990` | [4×4분 HIIT와 sprint interval 비교](https://pubmed.ncbi.nlm.nih.gov/36314990/) | 성인 훈련자에서 `4×4min · r3min`과 SIT 비교 | 개인 자동 처방 |
| `SRC-PMID-37075554` | [러닝 인터벌과 보행역학 체계적 문헌고찰](https://pubmed.ncbi.nlm.nih.gov/37075554/) | 200~1000m 고강도 반복에서 2~3분 회복을 검토할 근거 | 모든 세션의 고정 회복시간 |
| `SRC-PMID-37776346` | [20m/30m 무저항·저항 스프린트 회복 연구](https://pubmed.ncbi.nlm.nih.gov/37776346/) | `2×(3×20m)`와 `3×30m` 연구 프로토콜, 24~72시간 영향 관찰 | 청소년 자동 처방 또는 회복 승인 |
| `SRC-PMID-38188222` | [6초 반복질주 회복 60/90/120초 비교](https://pubmed.ncbi.nlm.nih.gov/38188222/) | 짧은 회복이 평균 파워와 RPE에 미치는 영향 | 육상 30m 세션의 보편 최적 회복 |

## 6. 에너지 의도별 5개 연구 시드

아래 25개는 Terra가 원문 대조, 구조화, 중복 제거와 사람 검토를 수행하기 위한
초기 후보다. `SYSTEM` 템플릿으로 활성화된 목록이 아니다.

### 6.1 BASE_INTENT

| ID | 후보 표기 | 출처 | 상태 |
|---|---|---|---|
| `BA-SEED-01` | `30~45′ @E` | `SRC-VDOT-PACES` 직접 예 | `SOURCE_EXAMPLE_PENDING_REVIEW` |
| `BA-SEED-02` | `20~30′ 회복주 @E` | VDOT의 recovery run 범주 + 제품 시간 변형 | `SOURCE_ADAPTED_PENDING_REVIEW` |
| `BA-SEED-03` | `45~60′ @E` | VDOT easy 범주의 시간 변형 | `SOURCE_ADAPTED_PENDING_REVIEW` |
| `BA-SEED-04` | `장거리 지속주 @E · 시간은 승인된 최근 기준선으로 제한` | `SRC-VDOT-PACES`, `SRC-VDOT-GUIDE` | `DOSE_UNRESOLVED` |
| `BA-SEED-05` | `3×10′ @E · r1′ 걷기/조깅` | 쉬운 지속주를 중단 가능한 블록으로 표현한 제품 변형 | `PRODUCT_ADAPTATION_NEEDS_REVIEW` |

### 6.2 LT_INTENT

| ID | 후보 표기 | 출처 | 상태 |
|---|---|---|---|
| `LT-SEED-01` | `20′ @T` | `SRC-VDOT-T` | `SOURCE_EXAMPLE_PENDING_REVIEW` |
| `LT-SEED-02` | `3×1600m @T · r1~2′` | `SRC-VDOT-T`, V.O2 Garmin 예 `3×1mi` | `SOURCE_EXAMPLE_PENDING_REVIEW` |
| `LT-SEED-03` | `4×1600m @T · r1′` | `SRC-VDOT-CRUISE` | `SOURCE_EXAMPLE_PENDING_REVIEW` |
| `LT-SEED-04` | `3×7′ @T · r1~2′` | `SRC-VDOT-GUIDE`, `SRC-VDOT-T` | `SOURCE_ADAPTED_PENDING_REVIEW` |
| `LT-SEED-05` | `6×6′ @T · r2′` | V.O2 coach 사례. 고용량이므로 상급/사람 검토 필요 | `ADVANCED_INDIRECT_PENDING_REVIEW` |

### 6.3 VO2_INTENT

| ID | 후보 표기 | 출처 | 상태 |
|---|---|---|---|
| `V2-SEED-01` | `6×2′ @I · r1′ 조깅` | `SRC-VDOT-PACES` | `SOURCE_EXAMPLE_PENDING_REVIEW` |
| `V2-SEED-02` | `5×3′ @I · r2′ 조깅` | `SRC-VDOT-PACES` | `SOURCE_EXAMPLE_PENDING_REVIEW` |
| `V2-SEED-03` | `4×4′ @I · r3′ 조깅` | `SRC-VDOT-PACES`, `SRC-PMID-36314990` | `SOURCE_EXAMPLE_PENDING_REVIEW` |
| `V2-SEED-04` | `4×3′ @95% vVO2max · r3′ easy` | `SRC-PMID-39835194` | `DIRECT_STUDY_PROTOCOL_PENDING_TRANSFER_REVIEW` |
| `V2-SEED-05` | `5×1000m @5K RP · r2′30″` | VDOT의 3~5분/800~1000m 범위 + PR #115 | `SOURCE_ADAPTED_PENDING_REVIEW` |

### 6.4 GLY_INTENT

| ID | 후보 표기 | 출처 | 상태 |
|---|---|---|---|
| `GL-SEED-01` | `3~4×500m @목표 1500m RP · r2~3′` | `SRC-WA-1500` | `SOURCE_EXAMPLE_NOT_INTRODUCTORY` |
| `GL-SEED-02` | `3×(800m+200m+200m) · r90″ · R3′` | `SRC-WA-1500` | `SOURCE_EXAMPLE_NEEDS_PACE_DETAIL_REVIEW` |
| `GL-SEED-03` | `2~3×(250m+100m) · r30″ · R4~8′` | `SRC-WA-DECATHLON` | `POPULATION_INDIRECT_PENDING_REVIEW` |
| `GL-SEED-04` | `150m-200m-300m @90~100% · 완전 회복` | `SRC-WA-DECATHLON` | `POPULATION_INDIRECT_PENDING_REVIEW` |
| `GL-SEED-05` | `1~2×300~600m · 긴 완전 회복` | `SRC-WA-SPRINT-RT` lactate-tolerance 범주 | `DOSE_AND_POPULATION_REVIEW_REQUIRED` |

### 6.5 ATP_PC_INTENT / SPEED_POWER

| ID | 후보 표기 | 출처 | 상태 |
|---|---|---|---|
| `AP-SEED-01` | `3×(15~25m 가속 + 30m 최고속 구간) · r2~5′` | `SRC-WA-SPRINT-INTRO` | `SOURCE_EXAMPLE_PENDING_REVIEW` |
| `AP-SEED-02` | `2×(3×20m) · r2′` | `SRC-PMID-37776346`의 연구 프로토콜 일부 | `DIRECT_STUDY_PROTOCOL_PENDING_TRANSFER_REVIEW` |
| `AP-SEED-03` | `3×30m · r3′` | `SRC-PMID-37776346`의 연구 프로토콜 일부 | `DIRECT_STUDY_PROTOCOL_PENDING_TRANSFER_REVIEW` |
| `AP-SEED-04` | `4×30m + 4×50m · r2~3′ 완전 회복` | PR #115 + `SRC-WA-SPRINT-RT` 범주 | `SOURCE_ADAPTED_PENDING_REVIEW` |
| `AP-SEED-05` | `5×(4회 바운드 + 30m 가속)` | `SRC-WA-SPRINTS` | `PLYOMETRIC_COMPLEX_HUMAN_REVIEW_REQUIRED` |

### 6.6 회복/휴식은 별도 축

`RECOVERY_INTENT`는 여섯 번째 에너지 시스템으로 측정하지 않는다. 완전 휴식,
회복 조깅, mobility-only 같은 지원 템플릿은 별도 5개를 만들 수 있으나, 강도
자극과 같은 방식으로 점수를 합산하거나 "회복 완료" 판정을 내려서는 안 된다.

## 7. 페이스 앵커 공식

### 7.1 같은 종목 Race Pace의 1차 공식

기록 종목과 페이스 앵커 종목이 같을 때만 단순 비례식을 쓴다.

```text
anchorPaceSecondsPerMeter = anchorPerformanceSeconds / anchorEventDistanceMeters
targetRepSeconds = anchorPaceSecondsPerMeter × repetitionDistanceMeters
```

예를 들어 5000m 기준 기록이 16분 40초, 즉 1,000초라면:

```text
400m target = 1,000 × 400 / 5,000 = 80초
```

계산 내부값은 반올림하지 않는다. 화면 반올림 단위는 별도
`displayRoundingPolicyVersion`으로 버전 관리한다.

### 7.2 PB, SB, 목표 기록은 서로 다른 사실

```yaml
PaceAnchorRecord:
  anchorId: required
  kind: RECENT_RESULT | PB | SB | GOAL | COACH_REFERENCE | RPE_ONLY | SPRINT_BENCHMARK
  eventDistanceM: required_except_RPE_ONLY
  performanceSeconds: required_except_RPE_ONLY
  achievedAt: required_for_RECENT_RESULT_PB_SB
  seasonId: required_for_SB
  enteredBy: ATHLETE | COACH | VERIFIED_IMPORT
  sourceRef: required
  verificationState: VERIFIED | SELF_REPORTED | UNVERIFIED
  freshnessState: CURRENT | STALE | UNKNOWN
  purpose: CURRENT_CAPABILITY | SEASON_CONTEXT | ASPIRATIONAL_TARGET | SPRINT_REFERENCE | EFFORT_ONLY
```

- `PB`: 실제 개인 최고지만 오래되었을 수 있다.
- `SB`: 현재 시즌의 실제 기록이지만 시즌 정의와 날짜가 필요하다.
- `GOAL`: 원하는 기록이며 현재 수행 능력의 증거가 아니다.
- `RECENT_RESULT`: 현재 상태를 설명하는 가장 직접적인 후보지만 검증 상태가 필요하다.
- `COACH_REFERENCE`: 코치가 명시적으로 등록한 기준이다.
- `RPE_ONLY`: 신뢰 가능한 숫자가 없을 때 사용한다.

시스템이 가장 빠른 값을 조용히 선택하면 안 된다. 카드에는 사용한 기준을
`5000m SB 16:40 · 2026-06-15 · 본인 입력`처럼 보여주고 사용자가 기준을 바꿀
수 있어야 한다. 목표 기록을 사용하면 `GOAL RP`라고 표시하며 현재 능력이라고
부르지 않는다.

### 7.3 교차 종목 환산

5000m 기록으로 1500m, T, I, R 페이스를 계산하는 교차 종목/생리 모델은 단순
나눗셈이 아니다. VDOT 같은 외부 모델을 사용하려면 다음이 선행되어야 한다.

- 공식 원출처와 수식 버전
- 구현 또는 표 사용 권한 검토
- 입력 종목/기록 범위
- 계산 오차와 반올림 규칙
- 성인 연구를 청소년에게 옮기는 한계
- 목표 기록을 현재 능력으로 오인하지 않는 UX

첫 구현은 동일 종목 RP의 단순 비례와 `RPE_ONLY`까지만 허용하는 것이 안전하다.

### 7.4 30m와 짧은 스프린트

30m 가속/최고속 세션에는 5000m RP, T, I 공식을 적용하지 않는다.

```yaml
sprint_anchor_allowed:
  - BEST_30M_TIME_WITH_SOURCE
  - COACH_TIMED_RANGE
  - TECHNICAL_RELAXED_FAST
  - MAX_INTENT_HUMAN_REVIEW_REQUIRED

sprint_anchor_forbidden:
  - FIVE_K_RACE_PACE_CONVERSION
  - GOAL_DISTANCE_PACE_AS_MAX_SPRINT
  - SILENT_ESTIMATE_FROM_JOURNAL_TEXT
```

## 8. 필요한 구조화 계약

```yaml
SessionPrescriptionTemplate:
  templateId: required
  version: required
  lifecycleStatus: DRAFT | ACTIVE | DEPRECATED | RETIRED
  humanReviewState: PENDING | ACCEPTED | REJECTED
  planningIntent: BASE_INTENT | LT_INTENT | VO2_INTENT | GLY_INTENT | ATP_PC_INTENT | RECOVERY_INTENT | MIXED_INTENT
  sourceRefs: required_non_empty
  sourcePopulationAndTransferLimits: required
  allowedEventGroups: required
  allowedExperienceBands: required
  minorPolicy: required
  prescription:
    setCount: integer_or_null
    repetitionsPerSet: integer_or_null
    repetitionDistanceM: number_or_null
    repetitionDurationSeconds: number_or_null
    paceAnchorPolicy: required
    repetitionRecoverySeconds: number_or_null
    repetitionRecoveryMode: WALK | JOG | STAND | FULL_RECOVERY | COACH_DEFINED | NOT_APPLICABLE
    setRecoverySeconds: number_or_null
    setRecoveryMode: WALK | JOG | STAND | FULL_RECOVERY | COACH_DEFINED | NOT_APPLICABLE
  warmupComponentRef: required_for_quality_and_sprint
  cooldownComponentRef: required_for_quality_and_sprint
  downshiftOptions: required_non_empty
  stopConditions: required_non_empty
  derivedTotals:
    totalRepetitions: deterministic
    qualityDistanceM: deterministic_or_unavailable
    qualityDurationSeconds: deterministic_or_unavailable
    plannedRecoverySeconds: deterministic_or_unavailable
  review:
    coachReviewState: required
    sportsScienceReviewState: required_for_numeric_SYSTEM_template
    youthTransferReviewState: required_when_minorAllowed
```

## 9. 열린 이슈

| ID | Canonical blocker | 상태 | 필요한 조치 |
|---|---:|---|---|
| `OI-DPR-SOURCE-LINKAGE-001` | YES | OPEN | 25개 시드 각각에 직접 원문, 대상, 세션, 전이 한계를 연결 |
| `OI-DPR-TEMPLATE-SCHEMA-001` | YES | OPEN | 상세 세트/반복/회복/앵커 계약 생성 |
| `OI-DPR-HUMAN-REVIEW-001` | YES | OPEN | 숫자 SYSTEM 템플릿의 코치·스포츠과학·청소년 전이 검토 |
| `OI-DPR-GENERATOR-BINDING-001` | YES | OPEN | Template Library → Safety Gate → Generator의 버전 바인딩과 런타임 테스트 |
| `OI-DPR-PACE-ANCHOR-001` | NO | OPEN | PB/SB/GOAL/최근기록 선택·표시·stale 정책 |
| `OI-DPR-CROSS-EVENT-MODEL-001` | NO | OPEN | VDOT 등 교차 종목 모델의 출처·버전·권한 결정 |
| `OI-DPR-SPRINT-ANCHOR-001` | NO | OPEN | 20m/30m/50m 기준과 완전회복 계약 |
| `OI-DPR-PR-RECONCILIATION-001` | NO | OPEN | #115/#120/#121의 수용·수정·대체 관계를 PR에 기록 |

## 10. 결론

상세 처방 논의는 이미 PR #115와 레거시 문서에 남아 있었다. 현재 필요한 것은
처음부터 다시 아이디어를 내는 일이 아니라, 그 자료를 최신 책임자 결정과 안전
계약에 맞춰 출처가 있는 구조화 템플릿으로 바꾸는 일이다.

PR #120은 현재 베타의 정직한 표시를 제공하고, PR #121은 수행 후 코치 범위
비교를 제공한다. 어느 것도 PR #115의 상세 처방 계층을 대체하지 않는다.

[DRAFT_COMPLETE]
