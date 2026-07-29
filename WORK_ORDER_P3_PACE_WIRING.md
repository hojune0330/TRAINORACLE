# WORK_ORDER_P3 - 개인 페이스 계산 배선·화면 표시

```yaml
work_order:
  id: WORK_ORDER_P3
  revision: SOL_CONTRACT_CORRECTION_2026-07-28
  status: READY_AFTER_P1_AND_P2
  issued_by: TOTAL_RESPONSIBILITY_HOLDER
  implementation_branch: codex/work-order-p3-pace-wiring
  prerequisites:
    - WORK_ORDER_P1 merged
    - WORK_ORDER_P2 merged
  template_activation_in_scope: false
  cross_event_conversion_in_scope: false
  required_report: reports/review/WORK_ORDER_P3_REPORT.md
```

## 0. 이 수정본이 바꾼 것

기존 P3는 다음 위험을 갖고 있었다.

1. 엔진 앵커의 필수 provenance인 `enteredBy`, `verificationState`,
   `sourceRef`를 계획 저장 구조에서 잃어버림
2. 현재 런타임이 숫자 계산을 거부하는 `STALE` 앵커를 계산 가능하게 바꾸라고
   지시함
3. 비교 차이의 부호 정의가 스키마 주석과 검산표에서 서로 반대였음
4. `목표 달성 시 3분 30초`의 입력인 5000m 목표 17:30이 빠져 있었음
5. GOAL을 현재 처방 앵커와 분리해 계산할 런타임 경계가 없었음
6. 템플릿 배선과 실제 활성화를 같은 작업 흐름에 섞음

이 수정본은 `CURRENT`만 오늘의 숫자 처방을 만들고, `STALE`과 `UNKNOWN`은
표시할 수 있지만 숫자 처방은 만들지 않는 현재 안전 경계를 유지한다.

## 1. 작업 위치

P3는 같은 종목 경기 페이스 계산 배선만 검증한다.

```text
P1 구조화 기록
  + P2 PARSER_READY 표기
  + D9/Safety Gate 허용
  + ACTIVE/ELIGIBLE 테스트용 템플릿
  -> 기존 impl 런타임
  -> 개인 반복 목표 시간
```

이 작업에서 하지 않는 것:

- `@T`, `@I`, `@E` 환산
- 800m 기록으로 1500m 페이스를 만드는 종목 간 환산
- 카탈로그 DRAFT 템플릿 활성화
- 자동 기준 기록 선택
- 일지 원문 또는 메모 분석
- 100~400m 스프린터 처방

## 2. 안전·근거 불변식

- D9 ACTIVE/UNKNOWN 또는 Safety Gate block이면 계획 숫자를 만들지 않는다.
- 숫자 페이스는 `freshnessState === CURRENT`일 때만 허용한다.
- 오래된 기록도 삭제하지 않지만, 오래됐다는 사실만으로 CURRENT가 되지 않는다.
- 선수가 오래된 PB를 현재 실력으로 명시적으로 인정하면 CURRENT로 계산할 수
  있다. 날짜 임계값으로 막지 않는다.
- `STALE`, `UNKNOWN`을 허용하려고 `anchor.ts`의 CURRENT 검사를 지우지 않는다.
- `enteredBy`, `verificationState`, `freshnessState`, `sourceRef`는 앵커와 함께
  저장하고 화면·런타임 전달 중 잃지 않는다.
- 목표 기록은 `ASPIRATIONAL_TARGET`이며 오늘의 처방 앵커가 될 수 없다.
- 모든 숫자에 출처 기록 ID와 표시 반올림 버전을 보존한다.
- 실패하면 숫자를 추정하지 않고 기존 RPE 지침으로 돌아간다.

## 3. 앱 계획 저장 구조

기존 `REST`, `RPE_TIME_RANGE`를 유지하고 하위 호환 가능한 새 variant를
추가한다.

```ts
type PaceAnchorEvidenceSnapshot = {
  readonly anchorId: string
  readonly kind: "RECENT_RESULT" | "PB" | "SB"
  readonly purpose: "CURRENT_CAPABILITY" | "SEASON_CONTEXT"
  readonly eventDistanceM: number
  readonly performanceSeconds: number
  readonly achievedAt: string
  readonly seasonId: string | null
  readonly enteredBy: "ATHLETE" | "COACH" | "VERIFIED_IMPORT"
  readonly verificationState: "VERIFIED" | "SELF_REPORTED" | "UNVERIFIED"
  readonly freshnessState: "CURRENT"
  readonly sourceRef: string
  readonly elapsedLabel: string
}

type GoalReferenceEvidenceSnapshot = {
  readonly anchorId: string
  readonly kind: "GOAL"
  readonly purpose: "ASPIRATIONAL_TARGET"
  readonly eventDistanceM: number
  readonly performanceSeconds: number
  readonly enteredBy: "ATHLETE" | "COACH" | "VERIFIED_IMPORT"
  readonly verificationState: "VERIFIED" | "SELF_REPORTED" | "UNVERIFIED"
  readonly freshnessState: "CURRENT" | "STALE" | "UNKNOWN"
  readonly sourceRef: string
}

type PaceTargetPlanItem = {
  readonly kind: "PACE_TARGET"
  readonly setCount: number
  readonly repetitionsPerSet: number
  readonly repetitionDistanceM: number
  readonly targetRepSeconds: number
  readonly selectedAnchor: PaceAnchorEvidenceSnapshot
  readonly comparisonAnchor: {
    readonly anchor: PaceAnchorEvidenceSnapshot
    readonly repSeconds: number
    /**
     * comparison rep seconds - selected rep seconds.
     * 양수면 비교 기록 기준이 더 느리다.
     */
    readonly deltaSeconds: number
  } | null
  readonly goalReference: {
    readonly anchor: GoalReferenceEvidenceSnapshot
    readonly repSeconds: number
    readonly displayOnly: true
  } | null
  readonly displayRoundingPolicyVersion: string
  readonly repetitionRecoverySeconds: number | null
  readonly setRecoverySeconds: number | null
}
```

`PaceTargetPlanItem` 안에 provenance를 문자열 몇 개로 생략하지 않는다. 계획을
나중에 열었을 때 어떤 기록·검증 상태·현재성으로 계산했는지 재현 가능해야 한다.

기존 계획 fixture를 그대로 열고 저장하는 마이그레이션 테스트를 넣는다.

## 4. 기준 기록 선택

코드가 자동 선택하지 않는다.

```text
기준 기록을 고르세요

최근 경기 결과
  5000m 18:30 · 2026-05-10 · 2개월 전

개인 최고 기록
  5000m 17:58 · 2024-03-10 · 2년 4개월 전

현재 시즌 기록
  5000m 18:12 · 2026 실외 · 4개월 전

시즌 범위 밖 기록
  5000m 18:05 · 2024 시즌 · 2년 3개월 전
```

기록이 하나뿐이어도 `이 기록을 기준으로 사용`을 사람이 확인한다. 기본 선택은
없다. 이어서 현재성 질문을 한다.

```text
이 기록이 지금 실력을 나타내나요?

[현재 실력으로 사용]  -> CURRENT, 숫자 계산 가능
[참고 기록으로만 보기] -> STALE, 숫자 계산 없음
[아직 모르겠어요]      -> UNKNOWN, 숫자 계산 없음
```

경과 기간은 세 선택 모두에 표시한다. 날짜로 CURRENT/STALE을 자동 결정하지
않는다.

## 5. 숫자 계산

### 5.1 오늘 목표

`CURRENT`로 명시 선택한 앵커만 기존
`preparePrescriptionRuntime` 경로에 넣는다.

```text
targetRepSeconds =
  anchorPerformanceSeconds × repetitionDistanceM / anchorEventDistanceM
```

계산식은 새로 구현하지 않는다. 동일 종목인지, 60m 이상인지, provenance가
완전한지, Safety Gate와 템플릿 상태가 허용되는지는 기존 impl이 판단한다.

### 5.2 STALE·UNKNOWN

현재 `impl/src/prescription/anchor.ts`는 CURRENT가 아니면
`ANCHOR_NOT_CURRENT`를 반환한다. 이 경계를 유지한다.

| 상태 | 기록 표시 | 숫자 페이스 | 결과 |
|---|---|---|---|
| CURRENT | 예 | 예 | 기존 impl 계산 |
| STALE | 예, 참고용 표시 | 아니오 | RPE 폴백 |
| UNKNOWN | 예, 확인 필요 표시 | 아니오 | RPE 폴백 |

`STALE` 숫자 계산을 열고 싶다면 accepted prescription contract와 런타임
테스트를 포함한 별도 채택 작업이 필요하다. P3에서 몰래 열지 않는다.

### 5.3 목표 기록의 참고 페이스

목표 기록은 오늘의 처방 앵커가 아니다. 하지만 오너가 승인한 2단 표시를 위해
동일 종목 목표 기록의 참고 반복 시간은 별도 display-only 경로로 계산한다.

`impl`에 별도 함수와 타입을 추가한다.

```ts
calculateGoalReferenceRacePace(input): {
  readonly kind: "calculated-goal-reference"
  readonly targetRepSeconds: number
  readonly displayOnly: true
  readonly sourceRef: string
}
```

필수 경계:

- `kind === GOAL`
- `purpose === ASPIRATIONAL_TARGET`
- `sourceRef`, `enteredBy`, `verificationState`, `freshnessState` 필수
- 목표 종목과 처방 목표 종목이 동일
- 60m 이상
- `StructuredPrescription`을 만들거나 현재 앵커를 대체하지 않음
- 기존 `validateRacePaceAnchor`는 GOAL을 계속 거부
- `GOAL_ANCHOR_FORBIDDEN` 회귀 테스트 유지
- 같은 산술 코어를 공유하고 공식을 복사해 두 군데에 만들지 않음

이 경계를 안전하게 만들 수 없으면 `goalReference: null`로 남기고 2단 표시를
열지 않는다.

## 6. 비교 기록

선택하지 않은 기록과 비교할 때도 같은 세션·같은 공식·같은 반올림 정책을
사용한다. 비교 기록도 CURRENT로 명시 확인된 경우에만 파생 반복 시간을 만든다.

부호 규칙은 하나다.

```ts
deltaSeconds = comparisonRepSeconds - selectedRepSeconds
```

| 선택 | 선택 목표 | 비교 | 비교 목표 | delta | 문구 |
|---|---:|---|---:|---:|---|
| PB 15:30 | 186초 | SB 15:45 | 189초 | 3 | 비교 기록 기준은 3초 느림 |
| SB 15:45 | 189초 | PB 15:30 | 186초 | -3 | 비교 기록 기준은 3초 빠름 |
| PB 15:30 | 186초 | 없음 | - | null | 비교 줄 없음 |
| PB 15:30 | 186초 | SB 15:30 | 186초 | 0 | 차이 없음 |

퍼센트, 부하 점수, 안전·위험 판정으로 바꾸지 않는다.

비교 후보가 STALE 또는 UNKNOWN이면 원기록과 경과는 보여도
`repSeconds`와 `deltaSeconds`를 만들지 않는다.

## 7. 화면 표시

재현 가능한 고정 fixture:

```yaml
session:
  repetitions: 5
  repetitionDistanceM: 1000
  repetitionRecoverySeconds: 150
current_anchor:
  event: 5000m
  performance: 18:30
  performanceSeconds: 1110
  freshnessState: CURRENT
goal_reference:
  event: 5000m
  performance: 17:30
  performanceSeconds: 1050
```

기대 화면:

```text
1000m 5회
반복 사이 회복 2분 30초

오늘 반복 목표    3분 42초
목표 기록 기준    3분 30초  · 참고용

오늘 목표 근거
5000m 18분 30초 · 2026-05-10 · 2개월 전
직접 입력 · 자기 보고 기록

목표 기록은 오늘 지시가 아니에요.
```

`목표 기록 기준`은 오늘 반복 목표보다 작고 덜 강조한다. 목표 기록이 없거나
display-only 검증이 실패하면 줄 자체를 표시하지 않는다.

STALE 예:

```text
이 기록은 참고용으로 선택됐어요.
숫자 페이스 대신 체감강도로 안내합니다.
```

## 8. 폴백

| 실패 | 사용자 결과 |
|---|---|
| 기록 없음 | 기존 RPE 지침 |
| 기준 미선택 | 선택 안내, 숫자 없음 |
| STALE/UNKNOWN | 참고 문구 + RPE 지침 |
| provenance 누락 | 기록 확인 요청 + RPE 지침 |
| 종목 불일치 | 같은 종목 기록 필요 + RPE 지침 |
| 파싱 실패 | 숫자 없음 + RPE 지침 |
| 템플릿 DRAFT/부적격 | 숫자 없음 |
| D9/Safety Gate block | 계획 생성 차단 |
| 목표 기록 검증 실패 | 오늘 목표만 표시, 목표 참고 줄 없음 |

숫자 계산 실패가 계획 차단을 완화하는 근거가 되어서는 안 된다.

## 9. 템플릿 활성화 경계

실제 카탈로그 30개는 모두 DRAFT·REVIEW_REQUIRED다. P3는 테스트용 fixture로
배선을 검증한다.

다음은 이 작업에 포함하지 않는다.

- lifecycle ACTIVE 변경
- eligibility ELIGIBLE 변경
- allowedEventGroups·allowedExperienceBands 채우기
- minorAllowed 변경
- 실제 사용자 계획에 숫자 템플릿 노출

활성화는 코치 적용 범위, 스포츠과학 전이 검토, 미성년자 조건, 별도 승인 기록을
갖춘 후 독립 PR로 처리한다.

## 10. 필수 테스트

### 10.1 provenance·스키마

- selected anchor에 4개 provenance 필드가 모두 저장됨
- 하나라도 누락되면 숫자 계산 거부
- `anchorId`가 P1의 record `id`와 일치
- kind와 purpose의 잘못된 조합을 거부
- 기존 REST/RPE 계획이 그대로 열림
- plan snapshot의 `sourceRef`가 P1 record와 일치
- SB는 `seasonId` 필수이고 purpose는 `SEASON_CONTEXT`
- GOAL은 현재 selected anchor가 될 수 없음

### 10.2 계산·안전

- 5000m 1110초 -> 1000m 222초
- CURRENT만 계산
- STALE, UNKNOWN은 `ANCHOR_NOT_CURRENT` 또는 안전한 폴백
- 10년 전 PB도 사람이 CURRENT로 확인하면 날짜 임계값 없이 계산
- 종목 불일치 `CROSS_EVENT_MODEL_REQUIRED`
- 60m 미만 거부
- D9/Safety Gate block 차단
- DRAFT/REVIEW_REQUIRED 템플릿 차단
- 자동 기준 선택 없음
- 일지 원문 소비 없음

### 10.3 목표 참고

- 5000m 17:30 목표 -> 1000m 210초
- goal result가 `displayOnly: true`
- GOAL이 StructuredPrescription current anchor가 되면 계속 거부
- 목표 종목 불일치 거부
- 목표 provenance 누락 거부
- 목표 줄이 오늘 목표보다 덜 강조됨

### 10.4 비교 부호

§6의 네 행을 그대로 계약 테스트로 만든다. 코드 주석과 테스트가 모두
`comparison - selected`를 사용해야 한다.

### 10.5 수동 UI 검증

- 모바일과 데스크톱에서 기준 선택, 현재성 선택, 2단 표시 확인
- 목표 참고 줄을 오늘 지시로 오해할 시각적 강조가 없는지 확인
- STALE/UNKNOWN에서 숫자가 사라지고 RPE 안내가 보이는지 확인
- provenance 문구가 좁은 화면에서 겹치지 않는지 확인
- 접근성 이름과 키보드 선택 경로 확인

## 11. 검증 명령

착수 시 기준 테스트 수를 측정하고 완료 후 같은 명령을 다시 실행한다.

```bash
cd impl
npm test
npm run typecheck

cd ../app
npm test
npm run typecheck
npm run build
CI=1 npx playwright test
```

저장소 전체의 일반 문구를 세는 광범위한 grep을 완료 기준으로 사용하지 않는다.
새로 만든 pace 경로와 테스트 파일로 검사 범위를 좁힌다.

## 12. 완료 보고

`reports/review/WORK_ORDER_P3_REPORT.md`에 다음을 남긴다.

- 기준 main SHA와 작업 head SHA
- P1/P2 선행 커밋
- provenance 보존 추적표
- CURRENT/STALE/UNKNOWN 실측 결과
- D9/Safety Gate fail-closed 결과
- 목표 17:30 fixture 입력과 3:30 출력
- 비교 부호 네 행의 손계산과 코드 출력
- 기존 계획 마이그레이션 결과
- 모바일·데스크톱 화면 증거
- 실제 카탈로그 활성화 변경 0건
- 환산 모델 미구현과 다음 별도 작업 조건

실제 실행 로그 없이 페이스 배선 완료를 주장하지 않는다.
