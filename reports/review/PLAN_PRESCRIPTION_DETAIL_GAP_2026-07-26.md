# PLAN_PRESCRIPTION_DETAIL_GAP_2026-07-26.md

```yaml
report_id: TO-PLAN-PRESCRIPTION-DETAIL-GAP-2026-07-26
status: CONFIRMED_RUNTIME_AND_SPEC_GAP
runtime_baseline: origin/main@0d5dc65
public_plan_baseline: PR_112
canonical_promotion: false
open_issue_closure: false
template_activation: false
```

## 1. 결론

TrainOracle의 현재 공개 훈련계획 베타는 훈련일의 역할, 총 시간 범위, RPE
범위만 생성한다. 선수가 그대로 따라 할 수 있는 세트 수, 반복 수, 반복 거리 또는
시간, 목표 페이스 기준, 반복 사이 회복, 세트 사이 회복, 워밍업과 정리운동은
아직 생성하지 않는다.

이 상태는 공개 베타 보고서의 `DURATION_RPE_ONLY`, `LIMITED`,
`NOT_UNIVERSAL` 경계와 일치하지만, 근거 있는 상세 훈련 설계라는 제품 목표에는
도달하지 못했다.

## 2. 제품 책임자 원문 예시

제품 책임자는 의도한 상세도 예시로 다음 표기를 제시했다.

> `10 x 400m 2set @5000m RP r60"`

이 문장은 상세 처방의 형식을 설명하는 제품 요구 예시다. 현재 선수에게 적용된
처방이나 검증된 시스템 템플릿으로 취급하지 않는다.

다음 해석은 아직 확정하지 않는다.

- `10 x 400m 2set`이 세트당 10회인지, 총 10회를 2세트로 나누는지
- `r60"`이 반복 사이 회복인지 다른 구간의 회복인지
- 세트 사이 회복 시간
- `5000m RP`를 선수의 어떤 기록과 버전에서 계산하는지
- 워밍업, 정리운동, 중단 조건

## 3. 로컬에서 확인된 기존 흔적

| 위치 | 확인된 형식 | 현재 권한 |
|---|---|---|
| `specs/legacy-reference/GLOSSARY.md` | `8×400m · GLY-SHORT · rest 3min` | 레거시 설명 예시 |
| `designs/04_Calendar.html` | `8×400m @ 73s`, `rest 2'30"` | 디자인 예시 |
| `specs/active/TEMPLATE_LIBRARY_SPEC.md` | 인터벌, 역치, 스피드 등 템플릿 패밀리 | 소유·수명주기·적격성 계약 |
| `impl/src/plan-generator` | `REST`, `EASY`, `QUALITY`와 시간·RPE 범위 | 현재 공개 베타 런타임 |

이 노트북의 이전 작업 세션에는 실제 코치 훈련표에서 세트, 반복, 거리, RP, 반복
회복과 세트 회복을 읽은 기록도 존재한다. 해당 자료에는 선수별 내용이 포함될 수
있으므로 원문과 이름을 이 보고서나 범용 템플릿에 복사하지 않는다. 여기서는
상세 처방 구조가 과거 업무에 실제로 사용됐다는 사실만 확인한다.

## 4. 필요한 최소 구조

상세 처방 템플릿은 최소한 다음 사실을 서로 분리해 보존해야 한다.

```ts
interface DetailedSessionPrescription {
  warmup: readonly SessionBlock[]
  main: readonly SessionBlock[]
  cooldown: readonly SessionBlock[]
  intendedEnergySystem: string
  stopOrReviewConditions: readonly string[]
}

interface IntervalBlock {
  blockType: "INTERVAL"
  setCount: number
  repetitionsPerSet: number
  workDistanceMeters?: number
  workDurationSeconds?: number
  targetBasis: "RACE_PACE" | "RPE" | "EXPLICIT_REP_TIME"
  targetEventMeters?: number
  targetRpe?: { minimum: number; maximum: number }
  targetRepSeconds?: { minimum: number; maximum: number }
  recoveryBetweenRepsSeconds: number
  recoveryBetweenSetsSeconds?: number
}
```

필드 이름과 타입은 구현 전 검토에서 바뀔 수 있다. 핵심은 반복, 세트, 목표,
두 종류의 회복을 한 문자열에 뭉개지 않고 별도 사실로 보존하는 것이다.

## 5. 적용 순서

1. 제품 책임자 예시의 표기 의미와 미정 항목을 확정한다.
2. `TEMPLATE_LIBRARY_SPEC.md`에 상세 처방 본문과 버전 계약을 추가한다.
3. 일반화된 시스템 기본 템플릿을 스포츠과학·코치 검토 후 `ACTIVE` 후보로 만든다.
4. Plan Generator가 안전 게이트 통과 후 적격 템플릿만 읽도록 연결한다.
5. 생성 결과에 템플릿 ID·버전·근거·미정 값을 함께 보존한다.
6. 후보 비교와 활성 계획 화면에 워밍업, 본운동, 정리운동, 중단 조건을 표시한다.
7. 세트·반복·회복 수치와 종목·경험별 경계를 결정론적 테스트로 검증한다.

## 6. 절대 경계

- 과거 특정 선수의 훈련표를 익명 범용 템플릿으로 자동 전환하지 않는다.
- 목표 기록이나 페이스 입력이 없으면 `5000m RP`의 초 단위 값을 발명하지 않는다.
- `QUALITY`와 RPE만으로 LT, VO2, GLY 등 세부 에너지 시스템을 추정하지 않는다.
- D9 `ACTIVE` 또는 `UNKNOWN` 상태에서는 상세 후보를 포함한 어떤 계획도 생성하지
  않는다.
- 상세한 형식이 안전성, 의학적 허가, 성과 보장 또는 모든 선수에게 적합함을
  의미하지 않는다.

## 7. 현재 화면 패치의 역할

이번 설명 개선은 현재 엔진이 실제로 생성한 총 시간과 RPE를 더 이해하기 쉽게
보여주고, 상세 세트·반복·페이스·회복이 아직 미지정임을 숨기지 않는다. 이
보고서의 상세 템플릿 작업이 완료되기 전까지 예시 훈련을 실제 개인 처방처럼
표시하지 않는다.

[DRAFT_COMPLETE]
