# Formation 책임자 최신 방향 바인딩

```yaml
binding_id: FORMATION_OWNER_DIRECTION_BINDING_2026-07-18
status: OWNER_DIRECTION_RECORDED_PENDING_NAMED_REVIEW
owner: COACH_HOJUNE
source_ref: reports/review/OWNER_DECISION_INTAKE_2026-07-18.md
formal_owner_decision: NOT_REVIEWED
scientific_acceptance: false
privacy_acceptance: false
runtime_authority: false
canonical_spec_patch_authorized: false
```

## 이번에 정한 제품 방향

| 항목 | 책임자 방향 | 쉬운 뜻 |
|---|---|---|
| 부하 구성 | `APPROVE_RECORDED_PENDING_NAMED_REVIEW` | 주관적·객관적·파생·맥락 값을 나누고 복합 훈련의 순서와 출처를 보존한다 |
| 개인내 최소 근거 | `APPROVE_RECORDED_PENDING_NAMED_REVIEW` | 데이터가 허용하는 수준까지만 말하고 부족하면 현재 코치 계획을 유지한다 |
| CA-02 경기 정체성 | `APPROVE_RECORDED_PENDING_NAMED_REVIEW` | 대회 일정과 예선·결승·계주 같은 실제 경기 기록을 분리한다 |
| CA-03 MAIN 계산 | `REVISE_RECORDED_PENDING_NAMED_REVIEW` | 경기별 부하는 보존하지만 같은 대회일은 계획상 MAIN 배치 최대 1회로 묶는다 |
| 첫 공유 방식 | `SELECTIVE_EXPORT_AND_OS_SHARE` | 앱 계정 공유보다 미리보기·선택 내보내기·기기 공유를 먼저 만든다 |
| 그림자 운영 | `ALLOWED_NON_PRESCRIPTIVE_INTERNAL_QA` | 내부에서는 결과를 보여줄 수 있지만 실제 계획을 자동 변경하지 않는다 |

## 대회 기록과 MAIN 배치

```yaml
completed_bout_records: SEPARATE
calendar_anchor_exposure: 0
same_competition_day_main_placement: ZERO_OR_ONE
completed_bout_load_inputs: PRESERVED_SEPARATELY
multi_day_meet_grouping: EACH_LOCAL_COMPETITION_DAY_REVIEWED_SEPARATELY
dnf_or_ambiguous_bout: COACH_REVIEW_NO_AUTOMATIC_COMPLETED_INFERENCE
```

예를 들어 같은 날 800m 예선·결승·4x400m 계주를 모두 마치면 경기 기록은 세 개다. 각 기록의
거리·시간·체감·회복 부담은 따로 남긴다. 그러나 9.5일 계획에서 그 대회일이 차지하는 MAIN
배치는 최대 한 번이다. 이 분리는 하루 대회만으로 MAIN 2~3회가 모두 찼다고 오판하는 것을
막는다. 실제 회복 부담과 다음 MAIN 허가는 별도 코치 규칙과 검토를 거친다.

## 공유 우선순위

```yaml
sharing_first_delivery: SELECTIVE_EXPORT_AND_OS_SHARE
memo_inclusion_default: false
preview_and_confirmation: required
analysis_consent_from_share: prohibited
standing_recipient_access: prohibited
in_app_recipient_accounts: DEFERRED
```

첫 구현은 사용자가 정확한 기록과 메모 포함 여부를 확인한 뒤 파일 또는 기기 공유 기능으로
보내는 방식이다. 공유는 분석 동의, 코치 상시 접근, Formation 입력, 보상 또는 telemetry
권한이 아니다. 앱 안 수신자 계정·링크·만료·철회 서버 기능은 개인정보 계약 뒤로 미룬다.

## 그림자 운영 경계

```yaml
internal_shadow_qa: ALLOWED_NON_PRESCRIPTIVE
allowed_data: SYNTHETIC_OR_OWNER_CONTROLLED_OR_CONSENTED_ADULT_INTERNAL
plan_mutation: prohibited
athlete_pilot: BLOCKED_PENDING_NAMED_REVIEW
minor_participant_operation: BLOCKED_PENDING_SAFEGUARDING
production_prescription: prohibited
```

합성 데이터, 책임자 본인 데이터, 명시적으로 동의한 성인 내부 사용자의 데이터로 화면과 설명을
시험할 수 있다. 추천은 기존 계획을 바꾸지 않으며 상용 자동 처방이 아니다. 모집된 선수 대상
파일럿과 청소년 운영은 스포츠과학·통계·개인정보·보호 검토 뒤에만 연다.

## 이 기록이 아직 허용하지 않는 것

- 세 결정 패킷의 정식 서명 완료 또는 전문가 승인 주장
- 10개 P1 계획의 일괄 승인
- 정본 스펙, 앱, 스키마, 마이그레이션 또는 자동 처방 실행
- 종합 피로·회복·준비도·안전·부상위험 점수
- 실제 선수 모집, 청소년 운영 또는 앱 안 수신자 계정 공유

따라서 책임자 제품 방향은 기록됐지만 정식 결정란과 전문 검토는 계속 `NOT_REVIEWED`이고,
실행 권한은 계속 꺼져 있다.
