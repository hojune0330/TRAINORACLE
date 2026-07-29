# WORK_ORDER_P2 - 카탈로그 기계 표기 상태 추가

```yaml
work_order:
  id: WORK_ORDER_P2
  revision: SOL_CONTRACT_CORRECTION_2026-07-28
  status: READY_FOR_DOCUMENT_AND_TEST_IMPLEMENTATION
  issued_by: TOTAL_RESPONSIBILITY_HOLDER
  implementation_branch: codex/work-order-p2-machine-notation
  prerequisite: none
  runtime_code_change: forbidden
  allowed_code_change: validation_tests_only
  required_report: reports/review/WORK_ORDER_P2_REPORT.md
```

## 0. 이 수정본이 바꾼 것

기존 지시서는 파서가 읽어야 할 문자열인 `machineNotation` 자리에
`PENDING_*`, `NOT_APPLICABLE_*` 같은 상태값도 넣었다. 또한 "파싱 성공"만
확인하여 회복 150초를 1초로 잘못 옮겨도 통과할 수 있었다.

수정본은 다음을 분리한다.

- `machineNotation`: 파서가 읽을 문자열 또는 `null`
- `machineNotationStatus`: 준비·보류 이유를 나타내는 enum
- `machineNotationBlockers`: 사람 결정이 필요한 이유
- 검증: 문법 파싱과 의미값 대조를 별도로 수행

## 1. 절대 경계

- `notationPattern` 원본은 정본이며 한 글자도 바꾸지 않는다.
- `machineNotation`은 원본을 대체하지 않는다.
- 범위(`3~4`, `2~3분`)를 작업자가 하나로 줄이지 않는다.
- 반복 수, 거리, 세트 수, 반복 회복, 세트 회복을 바꾸지 않는다.
- 강도구역이나 종목 간 환산을 추정하지 않는다.
- 모든 템플릿은 `DRAFT`, `REVIEW_REQUIRED`, `minorAllowed: false`,
  빈 적격성 배열을 그대로 유지한다.
- 이 작업은 템플릿을 활성화하거나 선수 계획에 연결하지 않는다.
- `app/`과 `impl/src/`를 수정하지 않는다.

## 2. 공통 필드

카탈로그의 Common field semantics에 아래를 추가하고 30개 모든 항목에 상태를
명시한다.

```ts
type MachineNotationStatus =
  | "PARSER_READY"
  | "PENDING_OWNER_RANGE_DECISION"
  | "NOT_APPLICABLE_INTENSITY_ZONE"
  | "NOT_APPLICABLE_NO_PACE_TARGET"
  | "PENDING_CONVERSION_MODEL"
```

문서 필드:

```yaml
machineNotation: string_or_null
machineNotationStatus: MachineNotationStatus
machineNotationBasis: string_or_null
machineNotationBlockers: string[]
```

불변식:

```yaml
machine_notation_invariants:
  notationPattern_is_canonical: true
  machineNotation_requires_status: PARSER_READY
  non_parser_ready_machineNotation_must_be_null: true
  parser_ready_basis_required: true
  parser_ready_blockers_must_be_empty: true
  narrowing_a_range_without_human_decision: forbidden
  runtime_template_activation_from_this_field: forbidden
```

상태값을 `machineNotation` 문자열에 넣지 않는다. 예를 들어 아래는 금지다.

```yaml
machineNotation: PENDING_OWNER_RANGE_DECISION
```

올바른 형태:

```yaml
machineNotation: null
machineNotationStatus: PENDING_OWNER_RANGE_DECISION
```

## 3. 30개 분류

현재 실측 분류는 다음과 같다. 작업 시작 시 원문 30개를 다시 세고, 분류가
달라졌다면 임의로 옛 숫자에 맞추지 말고 중단 보고한다.

| 상태 | 기대 개수 | 의미 |
|---|---:|---|
| `PARSER_READY` | 1 | 원본 의미를 바꾸지 않고 현재 파서 문법으로 표현 가능 |
| `PENDING_OWNER_RANGE_DECISION` | 1 | 범위값을 사람이 확정해야 함 |
| `NOT_APPLICABLE_INTENSITY_ZONE` | 13 | `@T`, `@I`, `@E`에 종목 RP 앵커가 없음 |
| `NOT_APPLICABLE_NO_PACE_TARGET` | 13 | 스프린트·회복 등 현재 RP 파서 대상이 아님 |
| `PENDING_CONVERSION_MODEL` | 2 | 별도 환산 모델이 필요 |
| 합계 | 30 | 모든 항목이 정확히 한 상태를 가짐 |

`@T`, `@I`, `@E`가 막히는 핵심 원인은 시간 단위가 아니라 `@` 뒤에 현재
런타임이 요구하는 종목 RP 앵커가 없다는 점이다.

## 4. 항목별 지시

### 4.1 `V2-SEED-05`

원본:

```yaml
notationPattern: "5×1000m @5K RP · r2′30″"
```

추가:

```yaml
machineNotation: "5×1000m @5000m RP · r150″"
machineNotationStatus: PARSER_READY
machineNotationBasis: "5K=5000m, 2분30초=150초 단위 표기 변환. 반복·거리·회복량 변경 없음."
machineNotationBlockers: []
```

의미 대조표:

| 의미 | 원본 | 기계 표기 | 같아야 하는 값 |
|---|---|---|---:|
| 세트 수 | 생략 | 생략 | 1 |
| 세트당 반복 | 5 | 5 | 5 |
| 반복 거리 | 1000m | 1000m | 1000 |
| 목표 종목 | 5K RP | 5000m RP | 5000 |
| 반복 회복 | 2분 30초 | 150초 | 150 |
| 세트 회복 | 없음 | 없음 | `null` |

### 4.2 `GL-SEED-01`

원본:

```yaml
notationPattern: "3~4×500m @GOAL 1500m RP · r2~3′"
```

추가:

```yaml
machineNotation: null
machineNotationStatus: PENDING_OWNER_RANGE_DECISION
machineNotationBasis: null
machineNotationBlockers:
  - "반복 수 3~4 중 확정값이 필요함"
  - "반복 회복 2~3분 중 확정값이 필요함"
  - "GOAL RP를 현재 처방과 분리하는 표시·런타임 경로가 필요함"
```

`3` 또는 `4`, `120초` 또는 `180초`를 작업자가 고르지 않는다.

### 4.3 나머지 28개

각 항목에 `machineNotation: null`, 정확히 하나의 상태, 필요하면 블로커를
추가한다. 상태는 파서 문자열이 아니다.

```yaml
machineNotation: null
machineNotationStatus: NOT_APPLICABLE_INTENSITY_ZONE
machineNotationBasis: null
machineNotationBlockers:
  - "강도구역을 동일 종목 RP로 바꾸는 승인된 변환 모델이 없음"
```

## 5. 검증 구현

런타임 코드는 바꾸지 않는다. 다음 검증 파일만 변경 또는 추가할 수 있다.

- `specs/test-packages/validate-detailed-prescription-catalog.mjs`
- `specs/test-packages/validate-detailed-prescription-catalog.test.mjs`
- `impl/test/catalog-machine-notation.contract.test.ts`

### 5.1 문서 validator

validator가 반드시 잠글 것:

- 30개 항목 모두 `machineNotationStatus` 정확히 1개
- 상태별 개수 1/1/13/13/2
- `PARSER_READY`인 항목만 비어 있지 않은 `machineNotation`
- 나머지 29개는 `machineNotation: null`
- `V2-SEED-05` 문자열과 basis가 정확한 값
- `GL-SEED-01`이 `null`이며 블로커 3개
- 기존 DRAFT·적격성·미성년 경계 불변
- `[DRAFT_COMPLETE]` 최종 표식 불변

### 5.2 파서·의미 테스트

전용 Vitest는 카탈로그에서 `V2-SEED-05`의 `machineNotation`을 읽어 현재
`parsePrescriptionNotation`에 넣는다. 파싱 성공만 보지 말고 다음 구조값을
각각 비교한다.

```yaml
setCount: 1
repetitionsPerSet: 5
repetitionDistanceM: 1000
paceTargetKind: RACE_PACE
paceTargetEventDistanceM: 5000
repetitionRecoverySeconds: 150
setRecoverySeconds: null
```

가능하면 `formatPrescriptionNotation` 왕복 결과도 검사하되, 포맷 문자열
모양이 아니라 위 의미값이 보존되는지를 최종 기준으로 삼는다.

### 5.3 적대적 회귀 테스트

다음 변조는 각각 실패해야 한다.

- `r150″` -> `r1″`
- `5×1000m` -> `4×1000m`
- `1000m` -> `100m`
- `@5000m RP` -> `@1500m RP`
- `PARSER_READY` 항목의 `machineNotation`을 `null`로 변경
- 보류 항목에 임의의 기계 표기 추가
- `machineNotation` 자리에 `PENDING_*` 문자열 입력
- 원본 `notationPattern` 변경

변조 대상 문자열이 실제로 바뀌지 않았으면 테스트 자체가 먼저 실패해야 한다.
변조 실패를 validator 성공으로 오인하지 않는다.

## 6. 검증 명령

저장소에 실제 존재하는 실행기만 사용한다.

```bash
node specs/test-packages/validate-detailed-prescription-catalog.mjs
node --test specs/test-packages/validate-detailed-prescription-catalog.test.mjs

cd impl
npm test
npm run typecheck
```

`npx tsx` 임시 실행 파일을 만들지 않는다.

## 7. 완료 기준

- 30개 원본 `notationPattern` 변경 0건
- 30개 모두 분리된 status 보유
- `machineNotation` 비-null은 `V2-SEED-05` 1개뿐
- 의미 대조값 7개 전부 테스트 통과
- 적대적 변조 테스트 전부 실패 폐쇄
- 상태별 개수 1/1/13/13/2
- 카탈로그 항목 삭제 0건
- lifecycle·eligibility·minorAllowed·적격성 변경 0건
- `app/`, `impl/src/` 변경 0건
- 런타임 활성화 주장 0건

## 8. 완료 보고

`reports/review/WORK_ORDER_P2_REPORT.md`에 다음을 남긴다.

- 기준 main SHA와 작업 head SHA
- 원본 30개 재계수
- 상태별 재계수
- V2 의미 대조표의 기대값과 실제 파서 출력
- 적대적 변조별 exit code와 실패 이유
- 변경하지 않은 원본 필드 diff 확인
- 사람이 결정해야 하는 GL 범위값
- 템플릿 활성화가 여전히 금지된 이유

파싱 성공만으로 "의미가 동일하다"고 보고하지 않는다.
