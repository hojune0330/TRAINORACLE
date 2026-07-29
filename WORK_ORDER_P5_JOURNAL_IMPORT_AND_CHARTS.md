# WORK_ORDER_P5 - 일지 구조화 수치의 추이·분포 표시

```yaml
work_order:
  id: WORK_ORDER_P5
  revision: SOL_CONTRACT_CORRECTION_2026-07-28
  status: READY_FOR_DISPLAY_ONLY_IMPLEMENTATION
  issued_by: TOTAL_RESPONSIBILITY_HOLDER
  implementation_branch: codex/work-order-p5-trends
  prerequisite: none
  target_surface: existing_Trends
  plan_generator_consumption: forbidden
  plan_candidate_adjacent_panel: forbidden
  required_report: reports/review/WORK_ORDER_P5_REPORT.md
```

## 0. 이 수정본이 바꾼 것

기존 P5는 `DAILY_LOG_AND_CHECKIN_SPEC.md`의 다른 YAML 블록에 있는
`adoption_authority`를 가져와, 계획 활용이 승인된 것처럼 잘못 해석했다.
실제 문서에는 다음 값이 모두 닫혀 있다.

```yaml
future_plan_evidence_allowed_before_separate_adoption: false
may_feed_future_plan_before_separate_adoption: false
current_downstream_plan_or_SafetyGate_consumer_exists: false
```

따라서 이 수정본은:

- 기존 `Trends` 화면의 설명용 분석만 구현
- 계획 후보 화면의 참고 패널은 구현하지 않음
- 일지 수치를 Plan Generator 입력으로 연결하지 않음
- 메모 원문과 `memoPurpose`를 분석 함수 입력에서 제거
- 출처·불확실성·누락·오래됨·충돌 상태를 데이터 타입에 포함
- 평균/중앙값 모순을 중앙값 하나로 통일

## 1. 허용 범위와 금지 범위

허용:

- 사용자가 명시적으로 입력한 구조화된 거리·시간·RPE
- 명시 입력만으로 계산된 provenance가 완전한 파생 페이스
- 기록 수, 중앙값, 최소·최대 같은 설명 통계
- 누락, 오래된 출처, 충돌, 불충분 상태의 정직한 표시
- 기존 `app/src/screens/Trends.tsx`와 그 하위 컴포넌트 확장

금지:

- 자유 메모, 요약, 토큰, 임베딩, 감정 추론
- `PRIVATE_SELF_ONLY` 메모 내용·존재·길이·개수 처리
- Plan Generator, Formation, Safety Gate, D9의 입력
- 분석 결과로 계획 후보를 생성·정렬·교체
- 훈련 후보 옆에 분석 패널을 붙여 후보 근거처럼 보이게 하기
- 준비도, 부상 위험, 안전함, 좋아짐·나빠짐 판정
- 빈 구간 보간 또는 0 대입
- formula authority가 없는 지표 계산

`ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md`는 분석 화면이 계획 후보를 만들 수
없다고 명시한다. 별도 계획 채택 전까지 표시와 계획은 분리한다.

## 2. 데이터 입력 경계

분석 함수는 전체 `JournalEntry`나 메모 객체를 받지 않는다. 먼저 구조화 수치만
추출한 privacy-safe projection을 만든다.

```ts
type StructuredJournalObservation = {
  readonly sourceRef: {
    readonly sourceKind: "DAILY_CHECKIN_RECORD" | "SESSION_RESULT_RECORD"
    readonly sourceId: string
    readonly sourceVersion: string | null
    readonly observedAt: string | null
    readonly trustState:
      | "ACCEPTED"
      | "STALE"
      | "CONFLICTING"
      | "MISSING"
      | "SOURCE_NOT_VERIFIED"
    readonly containsPrivateRawText: false
  }
  readonly loggedOn: string
  readonly distanceKm: number | null
  readonly durationMin: number | null
  readonly secondsPerKm: number | null
  readonly rpe: number | null
  readonly fieldProvenance: {
    readonly distanceKm: "EXPLICIT" | "DERIVED" | "MISSING" | "LEGACY_MISSING_PROVENANCE"
    readonly durationMin: "EXPLICIT" | "DERIVED" | "MISSING" | "LEGACY_MISSING_PROVENANCE"
    readonly secondsPerKm: "EXPLICIT" | "DERIVED" | "MISSING" | "LEGACY_MISSING_PROVENANCE"
    readonly rpe: "EXPLICIT" | "DERIVED" | "MISSING" | "LEGACY_MISSING_PROVENANCE"
  }
  readonly derivationRefs: readonly {
    readonly field: "secondsPerKm"
    readonly derivedFrom: readonly ("distanceKm" | "durationMin")[]
    readonly derivationRuleId: string
  }[]
}
```

이 projection에는 다음 키가 존재하면 안 된다.

```text
memo
record
result
symptom
note
quote
summary
memoPurpose
```

`memoPurpose`는 메모의 처리 목적이다. 구조화된 거리·시간 필드의 provenance를
대체하지 않는다. projection은 메모 내용을 읽지 않고, 메모 목적도 조건으로
사용하지 않는다. 따라서 "나만의 메모가 몇 건 제외됐다" 같은 흔적도 만들지
않는다.

### 2.1 수치 적격성

- 직접 값은 `EXPLICIT`만 집계 가능
- 파생 값은 모든 실제 입력이 `EXPLICIT`이고 `derivedFrom`,
  `derivationRuleId`가 완전할 때만 집계 가능
- `MISSING`, `LEGACY_MISSING_PROVENANCE`, 미지 상태, 불완전 DERIVED는 제외
- 제외된 필드를 0으로 바꾸지 않음
- 기존 일지에 provenance가 없으면 화면 표시 자체는 가능하지만 그 수치는 추이
  집계에 넣지 않음
- imported/demo provenance는 현재 계약상 집계에서 제외

## 3. 만들 파일

필수:

- `app/src/domain/trend-analysis.ts`
- `app/src/domain/trend-analysis.contract.test.ts`
- `app/src/domain/journal-observation.ts`
- `app/src/domain/journal-observation.contract.test.ts`
- `app/src/screens/Trends.tsx` 또는 기존 `app/src/screens/trends/` 하위 컴포넌트
- 관련 화면 계약 테스트
- 관련 Playwright 시나리오

새 `app/src/screens/records/` 화면을 만들지 않는다. 기존 추이 화면을 확장한다.
`PlanBeta.tsx`와 계획 후보 생성 코드는 변경하지 않는다.

## 4. 추이 결과 타입

빈 구간과 불확실성을 타입으로 표현한다.

```ts
type TrendSourceRef = StructuredJournalObservation["sourceRef"]

export type TrendBucket =
  | {
      readonly kind: "DATA"
      readonly label: string
      readonly n: number
      readonly median: number
      readonly min: number
      readonly max: number
      readonly unit: "SECONDS_PER_KM" | "RPE"
      readonly sourceRefs: readonly TrendSourceRef[]
      readonly confidence: number | null
      readonly uncertaintyState:
        | "NONE"
        | "LOW_CONFIDENCE"
        | "STALE_SOURCE"
        | "CONFLICTING_SOURCE"
        | "REQUIRES_HUMAN_REVIEW"
      readonly displayStatus: "OBSERVED" | "DERIVED" | "STALE" | "CONFLICTING"
      readonly nonSensitiveReasonCodes: readonly string[]
    }
  | {
      readonly kind: "MISSING"
      readonly label: string
      readonly sourceRefs: readonly []
      readonly confidence: null
      readonly uncertaintyState: "INSUFFICIENT_SOURCE"
      readonly displayStatus: "MISSING"
      readonly nonSensitiveReasonCodes: readonly ["NO_ELIGIBLE_SOURCE"]
    }
```

규칙:

- `DATA.n >= 1`
- `sourceRefs.length >= 1`
- source ref가 `STALE`이면 `NONE` 금지
- source ref가 `CONFLICTING`이면 `CONFLICTING_SOURCE`와 `CONFLICTING` 표시
- `MISSING`에는 `median`, `min`, `max`, `unit` 키가 없음
- 빈 구간은 선을 끊음
- confidence 계산 공식이 없으면 `null`; 숫자를 발명하지 않음

함수:

```ts
export function bucketByMonth(
  observations: readonly StructuredJournalObservation[],
  today: Date,
  monthsBack: number,
  metric: "SECONDS_PER_KM" | "RPE",
): readonly TrendBucket[]
```

`monthsBack`은 양의 정수 입력이다. 18개월을 과학적 임계값으로 하드코딩하지
않는다. 화면 기본 범위가 필요하면 기존 제품 설정이나 명시된 UI 기본값으로
관리하고 함수에는 인자로 넘긴다.

## 5. 집계 규칙

### 5.1 중앙값

대푯값은 중앙값으로 통일한다.

- 홀수 표본: 정렬한 가운데 값
- 짝수 표본: 가운데 두 값의 산술 평균
- 최소·최대와 표본 수를 함께 표시
- "평균"이라는 문구를 사용하지 않음

### 5.2 날짜 구간

- `loggedOn`의 ISO 날짜만 사용
- 로컬 달력의 해당 월로 묶음
- 시각이 없는 값을 UTC 시각으로 재해석하여 날짜를 이동시키지 않음
- `today`를 인자로 받고 가짜 시계를 사용하지 않음

### 5.3 손검산 fixture

`today = 2026-07-27`, `monthsBack = 4`, metric은 5000m 기록 초:

```text
r1  2026-07-05  1160
r2  2026-06-11  1142
r3  2026-06-25  1124
r4  2026-04-02  1170
```

| 월 | kind | n | median | min/max | refs |
|---|---|---:|---:|---|---|
| 2026-04 | DATA | 1 | 1170 | 1170/1170 | r4 |
| 2026-05 | MISSING | - | 키 없음 | - | [] |
| 2026-06 | DATA | 2 | 1133 | 1124/1142 | r2,r3 |
| 2026-07 | DATA | 1 | 1160 | 1160/1160 | r1 |

2026-05를 `0`, `1151`, 이전값, 다음값으로 채우면 실패다.

## 6. 화면

기존 추이 화면에 다음처럼 표시한다.

```text
훈련 페이스 추이 · 최근 4개월

6월 중앙 페이스 18:53
표본 2건 · 범위 18:44~19:02

5월은 집계 가능한 기록이 없어요.
```

필수:

- 표본 수
- 단위
- 출처 기록 보기
- 누락 구간
- 오래된·충돌·검증 안 된 출처 상태
- 차트의 표 형식 텍스트 대안
- 좁은 화면에서 겹치지 않는 레이아웃

금지 문구:

- `컨디션이 좋아졌어요`
- `훈련 준비가 됐어요`
- `부상 위험이 낮아요`
- `다음 훈련을 강하게 해도 돼요`

분석 화면에서 계획 화면으로 이동 링크는 둘 수 있지만, 분석 데이터나 선택을
query/state로 넘겨 후보를 바꾸지 않는다.

## 7. 필수 테스트

### 7.1 privacy-safe projection

- 반환 객체에 자유 텍스트 키가 없음
- 메모 원문을 넣어도 결과가 동일
- `memoPurpose`가 달라도 구조화 수치 결과가 동일
- PRIVATE_SELF_ONLY 메모의 존재·개수·길이를 반환하지 않음
- EXPLICIT만 직접 집계
- 완전한 DERIVED만 집계
- MISSING, LEGACY, imported/demo, 불완전 DERIVED 제외
- 미기록을 0으로 만들지 않음

### 7.2 집계

- §5.3 네 행과 정확히 일치
- MISSING에 수치 키 없음
- 보간 없음
- DATA에 n과 sourceRefs 존재
- stale/conflict가 uncertainty와 displayStatus로 전파
- confidence 공식이 없으면 null
- 기록 1건도 `n: 1`로 표시
- 범위 4개월과 다른 범위가 독립적으로 동작

### 7.3 경계

- `PlanBeta` 후보 결과가 변경 전후 동일
- `app/src/domain/plan-*`, `impl/`, `specs/` 변경 0건
- 원문·요약·임베딩 소비 0건
- D9/Safety Gate 상태 변경 0건
- 금지 판정어 0건

### 7.4 UI

- 빈 달의 선이 끊김
- 표본 수와 출처가 화면에 보임
- stale/conflict/missing이 색상 외 텍스트로도 전달됨
- 차트 표 대안이 키보드·스크린리더로 접근 가능
- 모바일과 데스크톱에서 텍스트 겹침 없음

## 8. 검증 명령

```bash
cd app
npm test
npm run typecheck
npm run build
CI=1 npx playwright test

cd ../impl
npm test
npm run typecheck
```

새로 만든 실제 경로만 대상으로 정적 검색한다. 존재하지 않는 디렉터리를
검색하여 exit 2를 성공으로 오인하지 않는다.

## 9. 완료 기준

- 기존 Trends 확장, 별도 records 화면 없음
- 구조화 observation과 집계 함수·테스트 존재
- 출처·누락·오래됨·충돌·불확실성 표시
- 중앙값 하나로 용어·계산 통일
- Plan Generator·계획 후보 연결 0건
- 메모 원문·요약·개수 노출 0건
- 광범위한 "일지 N개"를 provenance 없이 집계하지 않음
- app/impl 전체 검증 통과
- 모바일·데스크톱 수동 화면 증거 존재

## 10. 완료 보고

`reports/review/WORK_ORDER_P5_REPORT.md`에 다음을 남긴다.

- 기준 main SHA와 작업 head SHA
- 실제 변경 파일
- projection 허용·제외 필드 표
- provenance별 집계 결과
- §5.3 손계산과 실제 출력
- stale/conflict/missing 화면 증거
- 메모 원문·목적을 읽지 않는 테스트
- PlanBeta 후보가 변하지 않았다는 증거
- 접근성·모바일·데스크톱 검증
- 별도 계획 채택 전까지 닫혀 있는 경계

이 작업은 분석 표시 기능이다. 개인 처방 근거로 채택했다는 주장을 하지 않는다.
