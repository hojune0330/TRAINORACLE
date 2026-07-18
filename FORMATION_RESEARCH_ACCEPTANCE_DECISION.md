# Formation Research Acceptance Decision

```yaml
product_direction_status: SUPERSEDED_PRODUCT_DIRECTION
historical_runtime_facts_preserved: true
latest_owner_baseline: reports/review/FORMATION_LATEST_OWNER_DECISION_BASELINE.md
```

> Current product direction is governed by the
> [latest owner baseline](reports/review/FORMATION_LATEST_OWNER_DECISION_BASELINE.md).
> The dated research verdict, runtime-off state, and safety/privacy limits below remain
> historical facts; earlier selection guidance is not current product direction.

```yaml
decision_id: TO-DECISION-WO010-2026-07-15
order_id: CODEX_WORK_ORDER_010
decision: ACCEPT_RESEARCH_BOUNDARY_ONLY
owner: COACH_HOJUNE
owner_direction_basis: proceed_through_work_orders_010_to_016_in_sequence
accepted_at: 2026-07-15
runtime_authority: false
formation_activation: false
prediction_authority: false
prescription_authority: false
safety_or_medical_authority: false
group_or_shared_output_authority: false
```

## 한 줄 결정

조사 결과와 계산 경계는 다음 설계의 근거로 채택한다. 그러나 Formation 실행,
자동 훈련 변경, 안전 판정, 예측, 집단 공유 기능은 하나도 열지 않는다.

## 채택한 내용

1. `9.5일`, `MAIN 2-3회`, `대략 72시간 간격`은 코치 경험에서 출발한 파일럿
   가설이다. 우월성·안전성·최적성은 `UNKNOWN`이다.
2. 근력, 플라이오, HIIT, 힐, 대체 유산소, 테이퍼의 개별 근거는 구성요소를
   검토할 이유만 제공한다. 전체 9.5일 구조의 효능을 입증하지 않는다.
3. 훈련 부하와 경기 기록은 호환되는 관찰값의 기술 통계로만 다룬다. 결측은
   0이 아니며, 서로 다른 단위·방법·경기 유형은 합치지 않는다.
4. 빠른 입력 프리셋은 권장량이 아니라 입력 바로가기다. 직접 근거가 없는
   `12 km`, `20분`, `6/6.5/7/7.5시간`과 거리·시간 스테퍼는 UX 선택으로만
   유지한다.
5. 34개 계산·금지 승격 fixture와 여섯 불변식을 후속 구현의 초기 회귀 계약으로
   채택한다. 구현 전에는 다시 executable RED test를 먼저 만들어야 한다.

## 채택하지 않은 내용

- 9.5일 또는 72시간의 과학적 최적성·안전성.
- 준비도, 피로, 부상 위험, 회복 완료, 훈련 적합 판정.
- ACWR 안전·위험 구간 또는 인과 해석.
- 미래 기록 예측이나 자동 계획 변경.
- 집단 공유·공개 통계. `<5`는 Order 011 검토용 제안일 뿐이다.
- Formula Registry의 runtime 채택. 네 수식은 아직 `PROPOSED_DESCRIPTIVE`다.
- Formation, Plan Generator, shadow mode, production UI 활성화.

## 개인정보 경계

- `PRIVATE_SELF_ONLY`의 내용, 존재, 빈도, 길이, metadata는 local save path 밖에서
  완전 무신호다.
- `ANALYZABLE_TRAINING_NOTE` 원문은 통계·Formation·계획 입력이 아니다.
- 구조화 메모 신호는 등록 vocabulary, provenance, privacy review, runtime evidence,
  별도 owner adoption 전까지 사용할 수 없다.
- legacy, missing, invalid, unknown-rule, incomplete/nested derived 값은 분석에서
  제외한다.
- 이 결정은 내보내기나 타인 공유 권한을 변경하지 않는다. 사용자 선택형 전체
  내보내기와 기존 문서 드리프트는 Order 011에서 정렬한다.

## 독립 검토 결과

| 관점 | 1차 | 수정 후 | 주요 확인 |
|---|---|---|---|
| 스포츠과학 | FAIL | PASS | 잘못 연결된 preset 근거와 힐 근거 분리 |
| 통계·계산 | FAIL | PASS | sRPE 단위, 경기 차이, low-n, 중복 합산 결정화 |
| 개인정보·보안 | FAIL | PASS | provenance 결속, 메모 무신호, 공유 OFF |
| 제품·중학생 이해 | FAIL | PASS | `<5`를 제안으로 격하, 경기 fixture 통일 |

## 후속 필수 항목

- Order 011: 청소년 동의·보호자·보존·삭제·접근통제·사용자 선택 export/share,
  집단 억제와 반복 조회 방어를 결정한다.
- Order 014/015: 중학생용 한국어 단계별 설명, 중립적인 preset 시각 표현,
  결측·비교 제외 문구, 접근성을 설계한다.
- Order 016: 010-015의 모든 필수 게이트가 실제로 통과하지 않으면 runtime을
  시작하지 않는다.

## Evidence

- `reports/research/FORMATION_SPORTS_SCIENCE_EVIDENCE_REVIEW.md`
- `specs/reconstruct/FORMATION_LOAD_AND_STATISTICAL_RULES_CONTRACT.md`
- `reports/research/RACE_DESCRIPTIVE_ANALYSIS_REVIEW.md`
- `reports/review/QUICK_LOG_PRESET_RESEARCH.md`
- `specs/test-packages/FORMATION_RESEARCH_CALCULATION_FIXTURES.md`
- `.omo/evidence/work-order-010/verification.md`

[OWNER_ACCEPTED_RESEARCH_BOUNDARY]
