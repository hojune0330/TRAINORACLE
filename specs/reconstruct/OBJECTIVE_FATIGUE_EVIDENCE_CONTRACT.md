# Objective Fatigue Evidence Contract

```yaml
status: DRAFT_NON_RUNTIME_CONTRACT
schema_version: 1
implementation_module: app/src/domain/objective-fatigue-evidence.ts
runtime_connected: false
public_ui_connected: false
analysis_connected: false
formation_connected: false
plan_authority: false
safety_authority: false
universal_fatigue_score: forbidden
```

## 목적

객관 기록을 정규화할 수 있는 조건과 숫자를 만들면 안 되는 조건을 기계적으로 구분한다.
이 계약은 피로 점수를 만드는 공식이 아니라 근거의 사용 자격을 판정하는 계약이다.

## 결과 상태

| 상태 | 뜻 |
| --- | --- |
| `NORMALIZED_WITHIN_ATHLETE` | 같은 선수의 현재 기준과 같은 맥락·방법으로 비교 가능 |
| `NORMALIZED_WITHIN_SESSION` | 한 세트처럼 좁은 세션 내부에서만 정규화 가능 |
| `DESCRIPTIVE_ONLY` | 계산값은 보여줄 수 있지만 피로 비교값으로 쓰면 안 됨 |
| `WITHHELD` | 숫자를 만들지 않고 보류 이유를 반환 |

모든 숫자 결과는 아래 세 값을 항상 `false`로 유지한다.

```yaml
canAggregateAcrossModalities: false
canDrivePlan: false
canInferSafety: false
```

## 보류 이유

- `MISSING_BASELINE`
- `BASELINE_NOT_CURRENT`
- `GOAL_IS_NOT_CURRENT_ABILITY`
- `ATHLETE_MISMATCH`
- `CONTEXT_MISMATCH`
- `METHOD_MISMATCH`
- `INVALID_MEASUREMENT`

## 현재 계약의 계산 단위

- 비율은 `value`와 `unit: PERCENT`를 함께 반환한다.
- 근력 반복량은 `value`와 `unit: REPETITIONS`를 함께 반환한다.
- 결측은 0으로 반환하지 않는다.
- 소수 비율은 소수점 한 자리로 반올림한다.
- 페이스는 초/km가 작을수록 빠르므로 `기준 ÷ 실제` 방향을 사용한다.

## 맥락 일치 규칙

- 달리기 페이스: 선수, 종목, 측정법이 같고 출처가 `CURRENT`여야 한다.
- 달리기 거리: 선수, 세션 유형, 측정법이 같아야 한다.
- 플라이오 접촉: 선수, 운동 종류, 집계법이 같아야 한다.
- 근력 속도 감소: 첫 반복과 마지막 반복이 같은 세트·운동·기기 방법에서 나와야 한다.
- 인터벌 밀도, 근력 반복량, 대체 유산소 `%HRmax`는 설명 전용이다.

## 런타임 연결 전 남은 일

1. 저장 경계용 Zod 스키마와 provenance 필드를 설계한다.
2. 현재 기록의 종목·세션 유형·측정법 ID가 실제로 보존되는지 확인한다.
3. 기준 freshness 정책은 별도 Minimum Evidence 결정으로 고정한다.
4. 중학생도 이해하는 보류 문구와 상세 보기 UX를 검증한다.
5. 서로 다른 기기·방법의 연결 검증 정책을 정한다.
6. 사용자가 실험 기능을 켜도 계획·안전 권한이 열리지 않는 E2E를 추가한다.

연구 근거와 해석 범위는
`reports/research/OBJECTIVE_FATIGUE_NORMALIZATION_EVIDENCE_REVIEW.md`를 따른다.
