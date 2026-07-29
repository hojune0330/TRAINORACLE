# WORK_ORDER_P1 - 선수 기록 입력·저장

```yaml
work_order:
  id: WORK_ORDER_P1
  revision: SOL_CONTRACT_CORRECTION_2026-07-28
  status: READY_FOR_IMPLEMENTATION
  issued_by: TOTAL_RESPONSIBILITY_HOLDER
  implementation_branch: codex/work-order-p1-athlete-records
  prerequisite: none
  implementation_scope: app_only
  prohibited_scope: [impl, specs, journal_schema, journal_store]
  required_report: reports/review/WORK_ORDER_P1_REPORT.md
```

## 0. 이 수정본이 바꾼 것

이 지시서는 기존 P1의 다음 결함을 제거한 실행본이다.

1. 엔진 앵커에 항상 필요한 `enteredBy`, `verificationState`, `sourceRef`가
   선수 기록 저장 구조에서 빠져 있던 문제
2. 실제 달성 기록과 목표 기록에 모두 `achievedOn`을 강제하던 문제
3. `PERSONAL_BEST`를 오래됐다는 이유만으로 현재 실력이라고 단정하던 문구
4. `today`를 주입하면서 가짜 시계까지 요구하던 중복 검증
5. 저장소 전체를 대상으로 한 달성 불가능한 금지어 검색과 고정 테스트 개수

근거:

- `specs/reconstruct/TRAINING_SESSION_PRESCRIPTION_CONTRACT.md` §4
- `impl/src/prescription/runtime.ts`의 `parsePaceAnchor`
- `impl/src/prescription/anchor.ts`의 `currentAnchorError`
- `reports/review/WORK_ORDER_AGGRESSIVE_REVIEW_2026-07-28.md`

## 1. 목표와 경계

이 작업은 선수가 구조화된 경기 기록과 목표 기록을 저장하고 다시 선택할 수
있게 한다. 페이스 계산, 템플릿 활성화, 훈련 처방 생성은 하지 않는다.

절대 규칙:

- 기존 `RaceEntry.record` 자유 텍스트를 기록 앵커로 자동 변환하지 않는다.
- 자유 메모, 증상 문장, 경기 소감은 새 저장소에 복사하지 않는다.
- 기록 날짜만 보고 `freshnessState`를 만들지 않는다.
- 오래된 기록을 삭제, 숨김, 비활성화하지 않는다.
- `RACE_GOAL`을 현재 경기력으로 표시하지 않는다.
- 미성년자라는 이유만으로 기록 입력을 막는 새 정책을 만들지 않는다.
- 이 작업에서 D9, Safety Gate, Plan Generator를 수정하지 않는다.

## 2. 왜 기존 경기 일지를 그대로 쓰지 않는가

현재 경기 일지의 `record`는 자유 텍스트이고 종목 거리도 없다. 예를 들어
`18:30`만으로는 5000m인지 10000m인지 알 수 없다. 다음 공식은 거리와 시간이
모두 정확해야 하므로 추정 파싱을 금지한다.

```text
반복 목표 시간 = 경기 기록 초 × 반복 거리 / 경기 거리
```

따라서 구조화된 별도 저장소를 만들고 기존 일지는 변경하지 않는다.

## 3. 만들 파일

필수:

- `app/src/domain/athlete-records.ts`
- `app/src/domain/athlete-records.contract.test.ts`
- 기존 계획 입력 흐름 안의 기록 관리 화면 또는 컴포넌트
- 화면 계약 테스트

기존 저장 패턴은 `app/src/domain/journal-store.ts`를 참고하되, 저장값 검증은
새 기록 스키마가 독립적으로 수행한다.

```ts
const STORAGE_KEY = "trainoracle.athlete-records.v1"
```

## 4. 저장 계약

```ts
export type RecordPurpose =
  | "PERSONAL_BEST"
  | "SEASON_BEST"
  | "RECENT_RESULT"
  | "RACE_GOAL"

export type RecordEnteredBy = "ATHLETE" | "COACH" | "VERIFIED_IMPORT"

export type RecordVerificationState =
  | "VERIFIED"
  | "SELF_REPORTED"
  | "UNVERIFIED"

type AthleteRecordBase = {
  readonly schemaVersion: 1
  readonly id: string
  readonly eventDistanceM: number
  readonly performanceSeconds: number
  readonly enteredBy: RecordEnteredBy
  readonly verificationState: RecordVerificationState
  readonly sourceRef: string
  readonly savedAt: string
}

export type AthleteRecord =
  | AthleteRecordBase & {
      readonly purpose: "PERSONAL_BEST" | "RECENT_RESULT"
      readonly achievedOn: string
      readonly seasonId: null
    }
  | AthleteRecordBase & {
      readonly purpose: "SEASON_BEST"
      readonly achievedOn: string
      readonly seasonId: string
    }
  | AthleteRecordBase & {
      readonly purpose: "RACE_GOAL"
      readonly achievedOn: null
      readonly seasonId: null
    }
```

### 4.1 필드 불변식

| 필드 | 규칙 |
|---|---|
| `id` | 비어 있지 않은 로컬 고유 ID |
| `eventDistanceM` | 유한한 양수이며 60m 이상 |
| `performanceSeconds` | 유한한 양수 |
| `achievedOn` | PB, SB, 최근 결과에는 `YYYY-MM-DD` 필수 |
| `achievedOn` | 경기 목표에는 `null`; 목표를 이미 달성한 사실처럼 저장하지 않음 |
| `seasonId` | SB에만 비어 있지 않은 값 필수, 그 외 `null` |
| `enteredBy` | 실제 입력 경로와 일치해야 함 |
| `verificationState` | 입력 사실을 검증하지 않았으면 `VERIFIED` 금지 |
| `sourceRef` | 비어 있지 않은 불투명 참조. 자유 문장 금지 |
| `savedAt` | 저장 시점 ISO datetime |

현재 셀프서비스 화면에서 선수가 직접 입력한 값은:

```yaml
enteredBy: ATHLETE
verificationState: SELF_REPORTED
```

코치 계정·검증된 가져오기 경로가 실제로 구현되기 전에는
`COACH`, `VERIFIED_IMPORT`, `VERIFIED`를 화면에서 만들어 내지 않는다.

`sourceRef`는 예를 들어 `athlete-record:<id>`처럼 로컬 기록을 가리키는 안정된
식별자다. 메모 원문, 경기 소감, 증상 문장, 선수 이름을 넣지 않는다.

### 4.2 목적 매핑

| 앱 `purpose` | 엔진 `kind` | 엔진 `purpose` | 주의 |
|---|---|---|---|
| `RECENT_RESULT` | `RECENT_RESULT` | `CURRENT_CAPABILITY` | 현재성은 별도 선택이 필요 |
| `PERSONAL_BEST` | `PB` | `CURRENT_CAPABILITY` | 오래될 수 있으며 자동 CURRENT 금지 |
| `SEASON_BEST` | `SB` | `SEASON_CONTEXT` | `seasonId` 필수 |
| `RACE_GOAL` | `GOAL` | `ASPIRATIONAL_TARGET` | 현재 실력 또는 오늘 처방으로 사용 금지 |

이 표는 역할 매핑이다. `freshnessState`를 결정하지 않는다.

## 5. 경과·시즌 표시

기록은 날짜 때문에 자동 폐기되지 않는다. 대신 실제 달성 기록에는 경과를
항상 표시한다.

```ts
export function elapsedSinceAchieved(
  record: AthleteRecord,
  today: Date,
): { readonly months: number; readonly label: string } | null
```

- `RACE_GOAL`처럼 `achievedOn === null`이면 `null`
- 0개월: `이번 달`
- 4개월: `4개월 전`
- 38개월: `3년 2개월 전`
- 미래 날짜는 저장 단계에서 거부
- 함수 안에서 `new Date()`를 호출하지 않음

개월 계산은 한 곳에만 둔다.

```text
months = (오늘 연도 - 달성 연도) × 12 + (오늘 월 - 달성 월)
오늘 일 < 달성 일이면 months - 1
```

시즌 기록은 오너 정책인 18개월 창을 라벨로만 사용한다.

```ts
export const SEASON_WINDOW_MONTHS = 18

export function seasonWindowLabel(
  record: Extract<AthleteRecord, { readonly purpose: "SEASON_BEST" }>,
  today: Date,
): { readonly withinWindow: boolean; readonly label: string }
```

- 정확히 18개월은 창 안(`months <= 18`)
- 19개월부터 `시즌 범위 밖 (<경과 라벨>)`
- 저장, 선택, 계산 가능 여부를 반환하지 않음
- PB, 최근 결과, 목표 기록에는 호출하지 않음
- `purpose`, `verificationState`, 미래의 `freshnessState`를 바꾸지 않음

18개월은 과학적 안전 임계값이 아니라 화면 분류용 제품 정책이다.

## 6. 입력 UX

종목 거리는 우선 선택 목록으로 받는다.

```text
800m / 1500m / 3000m / 5000m / 10000m /
하프마라톤 21097m / 마라톤 42195m / 직접 입력
```

직접 입력은 60m 이상만 허용한다. `18`처럼 단위가 불명확한 기록은 추정하지
말고 분·초 입력 칸을 분리하거나 오류를 알려 다시 입력하게 한다.

화면에는 다음을 표시한다.

- 종목 거리
- 기록 또는 목표
- 역할(PB, SB, 최근 결과, 경기 목표)
- 실제 달성 기록의 달성일과 경과
- SB의 시즌 이름
- 입력자와 검증 상태를 이해하기 쉬운 문구로 표시

예:

```text
5000m · 18분 30초 · 개인 최고
2024-03-10 · 2년 4개월 전 · 직접 입력한 기록
```

```text
5000m · 17분 30초 · 경기 목표
직접 입력한 목표 · 현재 경기력 기록이 아님
```

기록 하나를 저장했다고 해서 기준 기록으로 자동 선택하지 않는다.

## 7. 필수 테스트

### 7.1 스키마·저장

- PB, SB, 최근 결과에서 달성일이 없으면 거부
- 목표 기록에서 `achievedOn`이 있으면 거부
- SB에서 `seasonId`가 없으면 거부
- SB가 아닌 기록에서 `seasonId`가 있으면 거부
- 60m 미만, 0, 음수, 무한대, NaN 거부
- `enteredBy`, `verificationState`, `sourceRef` 누락 거부
- 빈 `sourceRef` 거부
- 새 셀프서비스 입력이 `ATHLETE + SELF_REPORTED`인지 확인
- 현재 화면이 `VERIFIED` 또는 `VERIFIED_IMPORT`를 허위 생성하지 않는지 확인
- 깨진 localStorage 값은 크래시 없이 빈 목록으로 처리
- 저장 예외는 실패 결과를 반환하고 앱을 죽이지 않음
- 기존 저장값을 읽는 하위 호환 테스트

### 7.2 표시·날짜

`today = 2026-07-27`을 함수 인자로 넣어 아래를 검증한다.

| 입력 | 기대 |
|---|---|
| 2026-07-03 | `이번 달` |
| 2026-03-27 | `4개월 전` |
| 2025-01-27 SB | 현재 시즌, 정확히 18개월 |
| 2024-12-27 SB | 시즌 범위 밖, 19개월 |
| 2023-05-10 PB | PB 목록에 남고 `3년 2개월 전` |
| RACE_GOAL | 경과 라벨 없음 |

가짜 시계는 사용하지 않는다. `today` 주입만 사용한다.

### 7.3 경계 회귀

- 기록 날짜로 `freshnessState`를 자동 생성하는 코드가 없음
- 오래된 기록을 숨기거나 비활성화하는 코드가 없음
- 페이스 숫자를 계산하거나 표시하는 코드가 없음
- 새 저장 구조에 자유 텍스트 필드가 없음
- `impl/`, `specs/`, `journal-schema.ts`, `journal-store.ts` 변경 없음

금지어 검색은 새 파일과 새 화면으로만 범위를 한정한다. 저장소 전체의 기존
휴지통·인증 문구를 이 작업의 실패로 오인하지 않는다.

## 8. 검증 명령

착수 직후 현재 테스트 결과를 기록하고, 완료 후 같은 명령을 다시 실행한다.
고정된 과거 테스트 개수를 완료 기준으로 사용하지 않는다.

```bash
cd app
npm test
npm run typecheck
npm run build

cd ../impl
npm test
npm run typecheck
```

UI를 변경했으므로 관련 Playwright 시나리오와 모바일·데스크톱 화면 검증도
수행한다.

## 9. 완료 보고

`reports/review/WORK_ORDER_P1_REPORT.md`에 다음을 남긴다.

- 기준 main SHA와 작업 head SHA
- 변경 파일 전체
- 테스트 before/after 실측
- 필수 provenance 필드 누락·변조 테스트 결과
- 날짜 검산표의 손계산과 코드 출력
- 오래된 PB/SB가 보존되는 화면 증거
- 목표 기록이 현재 실력으로 표시되지 않는 화면 증거
- 변경하지 않은 경계(`impl`, `specs`, journal files) 확인
- 판단하지 않고 남긴 사항

이 보고서와 실제 실행 로그가 없으면 P1 완료를 주장하지 않는다.
