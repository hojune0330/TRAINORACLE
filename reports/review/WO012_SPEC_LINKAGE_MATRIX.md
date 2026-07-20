# WO012 스펙 연결표

```yaml
matrix_id: TO-WO012-SPEC-LINKAGE-2026-07-20
status: PREPARATION_ONLY_PENDING_NAMED_GATES
decision_record_source:
  pr_95: https://github.com/hojune0330/TRAINORACLE/pull/95
  owner_response_record: reports/review/WO012_COACH_DECISION_RESPONSE_TEMPLATE.md
  owner_direction_binding: reports/review/FORMATION_OWNER_DIRECTION_BINDING_2026-07-18.md
  competition_direction_sheet: reports/review/FORMATION_COMPETITION_RECORD_IDENTITY_OWNER_DECISION.md
ruleset_accepted: false
canonical_spec_patch_authorized: false
runtime_authority: false
scientific_acceptance: false
privacy_acceptance: false
participant_enrollment: false
```

## 읽는 법

이 표는 책임자 답변을 각 정본 후보 문서의 **검토 대상**으로 연결한다. 표의 어떤 행도
정본 채택, 과학적 검증, 개인정보 검토 완료, 런타임 활성화, 실제 계획 변경을 뜻하지 않는다.
`allowed outcome`은 다음 문서에 남길 수 있는 기록 또는 검토 요청의 범위이며, 실제 계획·달력·
알림·코치 지시를 쓰는 기능은 포함하지 않는다.

| CR id | Recorded direction | Authoritative target | Required gate | Allowed outcome | Forbidden outcome |
|---|---|---|---|---|---|
| CR-01 | 버전·책임자·프레임 정보가 모두 있어야 후보를 검토한다. | `specs/reconstruct/TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md`<br>`specs/reconstruct/FORMATION_COACH_RULESET_AND_EXPOSURE_CONTRACT.md`<br>`specs/active/RULE_SPEC_D1_D9.md` | 이름 있는 코치 규칙 검토, D1/D2 어댑터 근거, D9/RVE 근거 | 누락 사실을 `NEEDS_COACH_CLARIFICATION`으로 기록 | 누락 값을 채우거나 후보를 실행 |
| CR-02 | 9.5일은 파일럿 배치 관례이며 최적성 증명은 아니다. | `specs/reconstruct/TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md`<br>`specs/reconstruct/FORMATION_COACH_RULESET_AND_EXPOSURE_CONTRACT.md`<br>`specs/active/RULE_SPEC_D1_D9.md` | 코치 규칙 검토와 청소년 스포츠과학 검토 | 파일럿 관례와 한계를 표시 | 보편 최적 주기 또는 회복 보장 주장 |
| CR-03 | 약 72시간은 배치 관례이며 회복 허가는 아니다. | `specs/reconstruct/TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md`<br>`specs/reconstruct/FORMATION_COACH_RULESET_AND_EXPOSURE_CONTRACT.md`<br>`specs/active/RULE_SPEC_D1_D9.md` | 코치 규칙 검토, D9/RVE 근거, 스포츠과학 검토 | 간격을 설명용 후보 정보로 기록 | 72시간만으로 다음 훈련 허가 |
| CR-04 | 기본은 프레임당 MAIN 2-3회이고 1회·4회는 인접 프레임 이유 검토가 필요하다. | `specs/reconstruct/TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md`<br>`specs/reconstruct/FORMATION_COACH_RULESET_AND_EXPOSURE_CONTRACT.md`<br>`specs/active/RULE_SPEC_D1_D9.md` | 이름 있는 예외 검토와 현재·바로 앞·바로 뒤 최대 3프레임 확인 | `EXACTLY_TWO_OR_THREE_MAIN_CANDIDATE_VALIDITY_UNCHANGED`; `NEEDS_REVIEW_WITH_REASON`; `selectable_candidate: false`; `automatic_execution: false` | MAIN 1회·4회 선택, 자동 배치, 실제 계획 변경 |
| CR-05 | MAIN 2회도 배치와 회복 맥락을 검토한다. | `specs/reconstruct/TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md`<br>`specs/reconstruct/FORMATION_COACH_RULESET_AND_EXPOSURE_CONTRACT.md`<br>`specs/active/RULE_SPEC_D1_D9.md` | 코치 규칙 검토와 D9/RVE 근거 | 2회 후보의 배치 사유를 기록 | 회복이 확인됐다고 간주 |
| CR-06 | MAIN 3회도 배치와 회복 맥락을 검토한다. | `specs/reconstruct/TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md`<br>`specs/reconstruct/FORMATION_COACH_RULESET_AND_EXPOSURE_CONTRACT.md`<br>`specs/active/RULE_SPEC_D1_D9.md` | 코치 규칙 검토와 D9/RVE 근거 | 3회 후보의 배치 사유를 기록 | 회복이 확인됐다고 간주 |
| CR-07 | 같은 현지 대회 날짜 MAIN 0 또는 1회 기준은 유지하고, 1회·별표 표식 요청은 후속 정렬로 남긴다. | `specs/reconstruct/TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md`<br>`specs/reconstruct/MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md`<br>`reports/review/FORMATION_COMPETITION_RECORD_IDENTITY_OWNER_DECISION.md` | CA-02·CA-03 정식 검토와 현지 시민 날짜 경계 확인 | `same_competition_day_main_placement: ZERO_OR_ONE` 및 표식 요청을 검토 항목으로 기록 | 정확히 1회로 축소, 표식 의미 확정, 정본 계산 변경 |
| CR-08 | 대회 부모와 구성 경기의 중복 계산을 막는다. | `specs/reconstruct/TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md`<br>`specs/reconstruct/MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md`<br>`specs/reconstruct/FORMATION_COACH_RULESET_AND_EXPOSURE_CONTRACT.md` | CA-02·CA-03 정식 검토와 D1/D2 어댑터 근거 | 별도 완료 기록과 한 번의 기여를 검토용으로 기록 | 부모·구성 경기 이중 계산 |
| CR-09 | SUB·LD·TEST 보조 세션은 0 기여이며 분류 확인을 권장한다. | `specs/reconstruct/TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md`<br>`specs/reconstruct/FORMATION_COACH_RULESET_AND_EXPOSURE_CONTRACT.md`<br>`specs/active/RULE_SPEC_D1_D9.md` | 코치 분류 검토와 D1/D2 어댑터 근거 | 분류 확인 요청을 남김 | 보조 세션을 MAIN으로 자동 승격 |
| CR-10 | 중복 기록은 제거하되 같은 날의 다른 세션은 보호하고 확인을 권장한다. | `specs/reconstruct/TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md`<br>`specs/reconstruct/FORMATION_COACH_RULESET_AND_EXPOSURE_CONTRACT.md`<br>`specs/active/RULE_SPEC_D1_D9.md` | 출처·정체성 검토와 D1/D2 어댑터 근거 | 중복 의심을 검토 요청으로 기록 | 서로 다른 세션을 조용히 삭제 |
| CR-11 | 계획 기록과 완료 기록을 분리하고 합산하지 않는다. | `specs/reconstruct/TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md`<br>`specs/reconstruct/FORMATION_COACH_RULESET_AND_EXPOSURE_CONTRACT.md`<br>`specs/active/RULE_SPEC_D1_D9.md` | D1/D2 어댑터 근거와 코치 규칙 검토 | 두 보기를 분리한 설명 | 계획·완료 노출 합산 |
| CR-12 | 놓친 MAIN을 자동으로 몰아넣지 않는다. | `specs/reconstruct/TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md`<br>`specs/reconstruct/FORMATION_COACH_RULESET_AND_EXPOSURE_CONTRACT.md`<br>`specs/active/RULE_SPEC_D1_D9.md` | 코치 규칙 검토와 D9/RVE 근거 | 누락 사실과 검토 필요를 기록 | 자동 catch-up 후보 또는 실행 |
| CR-13 | 놓친 뒤 MAIN을 압축하거나 이중 계산하지 않는다. | `specs/reconstruct/TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md`<br>`specs/reconstruct/FORMATION_COACH_RULESET_AND_EXPOSURE_CONTRACT.md`<br>`specs/active/RULE_SPEC_D1_D9.md` | 코치 규칙 검토와 D9/RVE 근거 | 압축 금지 사유를 기록 | 누락 부채 이월 또는 자동 압축 |
| CR-14 | 복합 세션의 부모와 구성요소 정체성을 보존한다. | `specs/reconstruct/TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md`<br>`specs/reconstruct/FORMATION_COACH_RULESET_AND_EXPOSURE_CONTRACT.md`<br>`specs/active/RULE_SPEC_D1_D9.md` | 구성요소 출처 검토와 D1/D2 어댑터 근거 | 부모·구성요소 관계를 설명 | 부모와 구성요소 중복 계산 |
| CR-15 | 전체 세션 RPE를 구성요소에 나누어 추정하지 않는다. | `specs/reconstruct/TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md`<br>`specs/reconstruct/FORMATION_COACH_RULESET_AND_EXPOSURE_CONTRACT.md`<br>`specs/active/RULE_SPEC_D1_D9.md` | 코치 규칙 검토와 출처 근거 | 전체 세션 응답을 그대로 표시 | 구성요소 RPE 비율 추정 |
| CR-16 | 명시된 strong/high 플라이오만 추가 확인을 강제하며 RPE·자유서술 추정은 금지한다. | `specs/reconstruct/TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md`<br>`specs/reconstruct/FORMATION_COACH_RULESET_AND_EXPOSURE_CONTRACT.md`<br>`specs/active/RULE_SPEC_D1_D9.md` | strong/high 분류 레지스트리와 코치 규칙 검토 | `MANDATORY_ADDED_CHECK_PROMPT`를 검토용으로 표시 | RPE·메모·자유서술로 임계값 추정 |
| CR-17 | 오래되었거나 없는 사실은 현재 출처를 요구하고 추정하지 않는다. | `specs/reconstruct/TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md`<br>`specs/reconstruct/FORMATION_COACH_RULESET_AND_EXPOSURE_CONTRACT.md`<br>`specs/active/RULE_SPEC_D1_D9.md` | 출처 최신성 검토와 D1/D2 어댑터 근거 | `NEEDS_COACH_CLARIFICATION` 기록 | 결측값 보간 또는 유리한 추정 |
| CR-18 | private memo presence and content remain excluded (개인 메모의 존재와 내용은 계속 제외); 원터치 확인은 신호를 만들지 않는다. | `specs/reconstruct/DAILY_LOG_AND_CHECKIN_SPEC.md`<br>`specs/reconstruct/ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md`<br>`specs/reconstruct/PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md` | Order 011 적격 개인정보 검토와 D9/RVE 경계 근거 | 원터치 확인의 무신호 설명만 표시 | 개인 메모 존재·내용·해시·메타데이터를 분석·감사·통계에 사용 |
| CR-19 | 안전 상호작용은 두 단계이며 검토 요청만 만들 수 있다. | `specs/reconstruct/PLAN_SAFETY_GATE_SPEC.md`<br>`specs/reconstruct/RULE_VALIDATION_ENGINE_CONTRACT.md`<br>`specs/active/PLAN_GENERATOR_SPEC.md` | D9/RVE 바인딩 근거와 이름 있는 안전 검토 | 이유와 보수적 대안, 두 번째 화면의 검토 요청 초안 | 안전 우회, 실제 계획 변경 |
| CR-20 | taper에는 보수적 휴식을 보이고 두 단계 요청만 허용한다. | `specs/reconstruct/PLAN_SAFETY_GATE_SPEC.md`<br>`specs/reconstruct/RULE_VALIDATION_ENGINE_CONTRACT.md`<br>`specs/active/PLAN_GENERATOR_SPEC.md` | D9/RVE 바인딩 근거와 코치 검토 | 보수적 휴식 설명과 taper 요청 초안 | 자동 taper 또는 실제 계획 변경 |
| CR-21 | 두 단계 뒤 코치 검토 또는 자기확인 조정 초안을 선택한다. | `specs/reconstruct/PLAN_SAFETY_GATE_SPEC.md`<br>`specs/reconstruct/RULE_VALIDATION_ENGINE_CONTRACT.md`<br>`specs/active/PLAN_GENERATOR_SPEC.md` | D9/RVE 바인딩 근거와 코치 검토 | 검토 요청 또는 자기확인 조정 초안 | 자동 조정 또는 실제 계획 변경 |
| CR-22 | 증가 요청도 CR-21과 같은 두 단계 검토로 다룬다. | `specs/reconstruct/PLAN_SAFETY_GATE_SPEC.md`<br>`specs/reconstruct/RULE_VALIDATION_ENGINE_CONTRACT.md`<br>`specs/active/PLAN_GENERATOR_SPEC.md` | D9/RVE 바인딩 근거와 코치 검토 | 검토 요청 또는 자기확인 조정 초안 | 자동 증가 또는 실제 계획 변경 |
| CR-23 | 고정 대회는 보존하고 유연한 MAIN 충돌은 검토한다. | `specs/reconstruct/TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md`<br>`specs/reconstruct/MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md`<br>`specs/reconstruct/FORMATION_COACH_RULESET_AND_EXPOSURE_CONTRACT.md` | CA-02·CA-03 정식 검토와 현지 시민 날짜 경계 확인 | 고정 대회와 충돌 사유를 표시 | 대회를 옮기거나 유연 MAIN을 자동 배치 |
| CR-24 | 재앵커는 쉬운 선택을 돕되 우발적 한 번 클릭 일정 변경을 만들지 않는다. | `specs/reconstruct/FORMATION_PRODUCT_PROJECTION_AND_EXPLANATION_CONTRACT.md`<br>`specs/reconstruct/ATHLETE_VISIBLE_SHADOW_PILOT_PROTOCOL.md`<br>`specs/reconstruct/HUMAN_REVIEW_AND_SHARING_WORKFLOW.md` | 이름 있는 제품·접근성 검토와 코치 검토 | 안내된 처분 선택과 검토 가능한 초안 | 한 번 클릭 일정 변경 또는 실제 계획 변경 |
| CR-25 | 놓친 이전 MAIN은 다음 프레임으로 부채 이월하지 않는다. | `specs/reconstruct/TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md`<br>`specs/reconstruct/FORMATION_COACH_RULESET_AND_EXPOSURE_CONTRACT.md`<br>`specs/active/RULE_SPEC_D1_D9.md` | 코치 규칙 검토와 D9/RVE 근거 | 이전 누락의 설명용 기록 | 다음 프레임 MAIN 자동 추가 |
| CR-26 | 프레임 시작 경계는 포함하며 현재 프레임에만 둔다. | `specs/reconstruct/TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md`<br>`specs/reconstruct/MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md`<br>`specs/reconstruct/FORMATION_COACH_RULESET_AND_EXPOSURE_CONTRACT.md` | 현지 시민 날짜·시간대 경계 검토와 CA 정식 검토 | 시작 경계의 설명용 분류 | 경계 시점을 추측하거나 중복 배치 |
| CR-27 | 프레임 끝 경계는 제외하며 다음 프레임에만 둔다. | `specs/reconstruct/TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md`<br>`specs/reconstruct/MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md`<br>`specs/reconstruct/FORMATION_COACH_RULESET_AND_EXPOSURE_CONTRACT.md` | 현지 시민 날짜·시간대 경계 검토와 CA 정식 검토 | 끝 경계의 설명용 분류 | 경계 시점을 추측하거나 중복 배치 |
| CR-28 | DST fold 또는 gap은 명시 해석이 없으면 거절하고 추정하지 않는다. | `specs/reconstruct/TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md`<br>`specs/reconstruct/MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md`<br>`specs/reconstruct/FORMATION_COACH_RULESET_AND_EXPOSURE_CONTRACT.md` | 시간대·DST 명시 해석과 CA 정식 검토 | `NEEDS_COACH_CLARIFICATION` 기록 | 모호한 시각을 임의로 변환 |
| CR-29 | 충돌 우선순위 제안은 안전 우선이며 미해결 충돌은 검토 전용이다. | `specs/reconstruct/FORMATION_PRODUCT_PROJECTION_AND_EXPLANATION_CONTRACT.md`<br>`specs/reconstruct/ATHLETE_VISIBLE_SHADOW_PILOT_PROTOCOL.md`<br>`specs/reconstruct/HUMAN_REVIEW_AND_SHARING_WORKFLOW.md` | 이름 있는 제품·접근성 검토, 안전·코치 검토 | 우선순위 제안과 미해결 상태를 표시 | 제안만으로 충돌을 자동 해결 |
| CR-30 | 무단 열람·수정은 거부하고 공유는 명시적이며 정정은 감사 가능해야 한다. | `specs/reconstruct/FORMATION_PRODUCT_PROJECTION_AND_EXPLANATION_CONTRACT.md`<br>`specs/reconstruct/ATHLETE_VISIBLE_SHADOW_PILOT_PROTOCOL.md`<br>`specs/reconstruct/HUMAN_REVIEW_AND_SHARING_WORKFLOW.md` | Order 011 적격 개인정보 검토와 이름 있는 제품·접근성 검토 | 명시적 공유와 정정 요청의 절차 설명 | 무단 접근, 상시 수신자 접근, 자동 공유 |

## 그림자 운영 경계

기존 `specs/reconstruct/ATHLETE_VISIBLE_SHADOW_PILOT_PROTOCOL.md`만 그림자 운영 규약의
후보 문서다. 이 연결표는 새 파일럿 규약을 만들지 않는다.

```yaml
participant_enrollment: false
hidden_shadow: forbidden
real_calendar_write: forbidden
real_plan_write: forbidden
notification_write: forbidden
coach_instruction_write: forbidden
named_gate_prerequisites:
  - Order_011_qualified_privacy_review
  - youth_sport_science_review
  - D9_RVE_and_D1_D2_adapter_evidence
  - named_product_accessibility_review
  - separate_pilot_enrollment_approval
```

그림자 결과는 비교용 설명 또는 검토 기록만 만들 수 있다. 실제 참가자 모집, 실제 계획·달력·
알림·코치 지시 쓰기, 숨은 그림자 운영은 위 이름 있는 관문 전에는 금지다.
