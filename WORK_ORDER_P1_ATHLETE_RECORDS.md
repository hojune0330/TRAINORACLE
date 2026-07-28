# WORK_ORDER_P1 — 선수 기록 입력·저장

```yaml
work_order:
  id: WORK_ORDER_P1
  issued_by: TOTAL_RESPONSIBILITY_HOLDER
  issue_date: "2026-07-27"
  decision_basis:
    - PERSONAL_PACE_DECISION_2026-07-27.md (오너 승인 정본)
    - DECISION_BRIEFING_PERSONAL_PACE.md (맥락)
  선행필독:
    - PRODUCT_NORTH_STAR.md
    - PERSONAL_PACE_DECISION_2026-07-27.md
  branch: codex/work-order-p1-athlete-records
  선행조건: 없음 — 즉시 착수 가능
  오너추가승인: 불필요
  대상작업자: 구현 에이전트 (토큰 소모 큼)
```

---

## §0-Z 공격 리뷰 결과 — 🟠 중대 2 · 보통 2 (D1~D4)

**리뷰:** [`reports/review/WORK_ORDER_AGGRESSIVE_REVIEW_2026-07-28.md`](./reports/review/WORK_ORDER_AGGRESSIVE_REVIEW_2026-07-28.md) · 2026-07-28

**조건부 착수.** 산수·인용은 전부 검증 통과했다. 그러나 §6 의
`grep -rn "EXPIRED|만료|유효기간" app/src → 0건` 은 **이미 6건이 있어 달성 불가**다
(휴지통·인증 코드, 이 작업과 무관). §3-3(`today` 주입)과 §4(`vi.useFakeTimers()`)가
서로를 무효화하고, §6 의 "기존 308개" 는 낡았다(현재 338개).

**착수 전 반드시 위 리뷰의 §0-A(결함표)·§0-B(고칠 것)를 읽고 지시서를 먼저 고친다.**

---

## 0. 이 작업이 왜 1번인가

개인 페이스 계산식은 **이미 코드에 있다**(`impl/src/prescription/runtime.ts:177`).
그런데 **넣을 숫자가 없다.** 앱 어디에도 선수의 최고기록·시즌기록·목표기록을
입력하는 칸이 없다.

**환산 모델(길 2)을 쓰든 안 쓰든 이 작업은 무조건 필요하다.**
그래서 오너 추가 승인 없이 착수한다.

## 1. 절대 규칙

1. **안전 불변식을 건드리지 않는다.** D9 차단, 일지 원문 경계, 60m 미만
   금지, 종목 간 환산 금지 — 이 작업은 이 중 어느 것도 완화하지 않는다.
2. **기존 일지(`RaceEntry`)를 수정하지 않는다.** 새 저장소를 별도로 만든다.
   이유는 §2-1에 있다.
3. **이 작업은 페이스를 계산하지 않는다.** 기록을 받아 저장하는 것까지다.
   계산·표시는 P3의 일이다.
4. **미성년 정책을 건드리지 않는다.** 오너 결정 5 = 당분간 성인만.
5. **범위값을 코드가 정하지 않는다.** 오너 결정 4.

## 2. 배경 — 이미 조사된 사실 (다시 조사하지 말 것)

토큰을 아끼기 위해 조사 결과를 적어 둔다. **아래는 확인된 사실이다.**

| 항목 | 상태 | 위치 |
|---|---|---|
| 페이스 계산식 | 있음 | `impl/src/prescription/runtime.ts:177` |
| 앵커 타입 정의 | 있음 | `impl/src/prescription/types.ts` |
| 앵커 검증 | 있음 | `impl/src/prescription/anchor.ts` |
| 앱의 처방 저장 구조 | `REST`/`RPE_TIME_RANGE` 둘뿐 | `app/src/domain/plan-beta-store.ts:42-90` |
| 선수 기록 입력 화면 | **없음** | — |
| 경기 일지 | 있으나 사용 불가 | `app/src/domain/journal-schema.ts:63` |
| localStorage 저장소 패턴 | 참고용 | `app/src/domain/journal-store.ts` |

### 2-1. 왜 기존 경기 일지를 못 쓰는가 (중요)

`RaceEntry`는 이렇게 생겼다.

```ts
export type RaceEntry = JournalEntryBase & PurposeScopedMemo & {
  readonly kind: "race"
  readonly stage: "pre" | "post"
  readonly record: string      // ← 자유 텍스트! "18분30초", "18:30", "1830" 다 가능
  readonly rank: string
  readonly result: string
  ...
}
```

**두 가지 문제가 있다.**

1. `record`가 `z.string()` 자유 텍스트다. 파싱을 신뢰할 수 없다.
2. **종목 거리 필드가 아예 없다.** 18분 30초가 5000m인지 10000m인지 모른다.

페이스 계산에는 **거리와 시간이 모두** 필요하다
(`기록초 × 반복거리 ÷ 기록거리`). 거리를 모르면 계산 자체가 불가능하다.

**따라서 구조화된 새 저장소를 만든다. 기존 일지는 그대로 둔다.**

> 기존 일지를 고치지 않는 것은 회피가 아니다. 사용자가 이미 저장한
> 데이터의 의미를 사후에 바꾸면 안 된다. 자유 텍스트를 억지로 파싱해
> "이건 5000m일 것이다"라고 추정하면 그게 곧 근거 없는 처방이 된다.

## 3. 만들 것

### 3-1. 새 파일: `app/src/domain/athlete-records.ts`

`app/src/domain/journal-store.ts`의 패턴을 따른다
(`storage()` 가드, `try/catch`, 깨진 값이면 빈 목록).

```ts
const STORAGE_KEY = "trainoracle.athlete-records.v1"
```

### 3-2. 저장할 데이터 구조

```ts
export type RecordPurpose =
  | "PERSONAL_BEST"    // 최고기록 (PB)
  | "SEASON_BEST"      // 시즌기록 (SB)
  | "RECENT_RESULT"    // 최근 경기 결과
  | "RACE_GOAL"        // 경기 목표

export type AthleteRecord = {
  readonly schemaVersion: 1
  readonly id: string
  readonly purpose: RecordPurpose
  readonly eventDistanceM: number      // 종목 거리 (필수)
  readonly performanceSeconds: number  // 기록 (초, 필수)
  readonly achievedOn: string          // "YYYY-MM-DD" (필수)
  /**
   * 시즌 이름. purpose === "SEASON_BEST" 일 때만 필수, 그 외에는 null.
   * 스펙이 SB에 대해 "A season must be named" 라고 요구하고
   * anchor.ts 가 seasonId 없는 SB 를 ANCHOR_PROVENANCE_INCOMPLETE 로
   * 거부하므로, 여기서 받지 않으면 P3에서 계산이 불가능해진다.
   * 예: "2026 실외", "2026 시즌"
   */
  readonly seasonId: string | null
  readonly savedAt: string             // ISO
}
```

**`achievedOn`은 필수다.** 오너 결정 3이 **경과 기간을 항상 표시**하라고
요구하는데, 달성일이 없으면 경과를 표시할 수 없다.
**날짜 없는 기록은 저장을 거부한다.**

**`seasonId`는 `SEASON_BEST`일 때만 필수다** (오너 결정
`OWNER_DECISION_ANCHOR_CHOICE_2026-07-27.md` §5).

```ts
// 저장 시 검증
if (record.purpose === "SEASON_BEST" && (record.seasonId ?? "").trim() === "") {
  // 저장 거부. 시즌 이름을 받는다.
}
if (record.purpose !== "SEASON_BEST" && record.seasonId !== null) {
  // 저장 거부. SB 가 아니면 시즌을 붙이지 않는다.
}
```

> ✅ **시즌 창은 확정되었다 — 오늘로부터 18개월.**
> 오너 확답(2026-07-27): *"시즌길이는 보통 1년이지만 보수적으로
> 오늘로부터 1년 6개월 전으로 잡을게. pb기간무관. 시즌밖기록으로."*
> 자세한 내용은 `OWNER_DECISION_ANCHOR_CHOICE_2026-07-27.md` §3.
>
> 그래서 P1은 **§3-4의 `seasonWindowLabel()` 표시 함수를 만든다.**
> 단 그것은 **라벨만** 만든다. 계산 가능/불가를 정하거나
> 생성을 거부하지 않는다. `PERSONAL_BEST`에는 적용하지 않는다.

`purpose`가 스펙의 역할 구분과 연결된다. 반드시 이 대응을 지킨다.

| `purpose` | 스펙 `PaceAnchorPurpose` | 뜻 |
|---|---|---|
| `RECENT_RESULT` | `CURRENT_CAPABILITY` | 현재 실력 |
| `PERSONAL_BEST` | `CURRENT_CAPABILITY` | 현재 실력 (오래돼도 유효) |
| `SEASON_BEST` | `SEASON_CONTEXT` | 시즌 맥락. **`seasonId` 필수** |
| `RACE_GOAL` | `ASPIRATIONAL_TARGET` | **절대 현재 실력이 될 수 없음** |

근거: `specs/reconstruct/TRAINING_SESSION_PRESCRIPTION_CONTRACT.md` §4

### 3-3. 경과 기간 계산 (만료가 아니다)

> 🔴 **이 절은 오너 지적으로 정정되었다.** 이전 버전은 `3개월`/`12개월`
> 경과 시 `EXPIRED`(계산 거부)를 요구했다. **그 요구는 삭제되었다.**
> 오너 지적: *"유효기간은 없어야 되는 거 아냐?"* — 맞다.

**기록은 만료되지 않는다. 만료 개념 자체를 만들지 말 것.**

근거 (스펙):

- `FORMATION_LOAD_AND_STATISTICAL_RULES_CONTRACT.md` §9
  — "There is **no evidence-backed universal freshness cutoff**"
- `TRAINING_SESSION_PRESCRIPTION_CONTRACT.md` §4
  — "**A PB can be old**; it is never assumed to be current without its state"

3년 전 5000m 최고기록은 **여전히 최고기록이다.** 금지되는 건 그것을
**조용히 현재 실력처럼 쓰는 것**이다. 그래서 만드는 건 판정이 아니라
**표시용 경과 계산**이다.

```ts
/**
 * 달성일로부터 지난 기간을 사람이 읽을 수 있게 만든다.
 * 이 함수는 판정하지 않는다. 계산 가능/불가를 정하지 않는다.
 */
export function elapsedSinceAchieved(
  record: AthleteRecord,
  today: Date,          // 테스트 가능하게 반드시 인자로 받는다
): { readonly months: number; readonly label: string }
```

| 경과 | `label` 예 |
|---|---|
| 0개월 | `"이번 달"` |
| 4개월 | `"4개월 전"` |
| 38개월 | `"3년 2개월 전"` |

**금지 사항 (중요)**

- `EXPIRED`·`만료`·`유효기간` 같은 상태나 이름을 만들지 말 것
- 경과 개월 수로 **계산 가능 여부를 판정하지 말 것**
- 임계값 상수(`RECORD_CURRENT_MAX_MONTHS` 등)를 만들지 말 것
  — **스펙에 근거가 없는 숫자를 코드가 만들어 쓰는 것이 되기 때문**
- 오래된 기록을 **숨기거나 지우지 말 것**

**경과를 항상 보여주면 임계값이 필요 없다.**
`"2023-05-10 · 3년 2개월 전"`이 그 자체로 경고다.

> `today`를 인자로 받는 이유: `new Date()`를 함수 안에서 부르면
> 테스트가 시계에 의존해 불규칙하게 실패한다. 실제로 이 저장소에서
> 그 원인으로 CI가 실패한 적이 있다(`tombstone.contract.test.ts`).

### 3-3-1. `freshnessState`는 P1이 정하지 않는다

엔진의 `freshnessState`(`CURRENT`/`STALE`/`UNKNOWN`)는 **날짜에서 자동
계산되는 값이 아니다.** 엔진은 이 값을 **입력으로 받는다**(`anchor.ts:23`).

즉 "이 기록을 현재 실력으로 인정할지"는 **사람이 정하는 것**이다.
**P1은 이 값을 만들지 않는다.** 기록을 저장하고 경과를 표시하는 것까지다.
누가 어떻게 정할지는 P3에서 다룬다.

### 3-3-2. 시즌 창 라벨 `seasonWindowLabel()` (확정, 만료가 아니다)

오너 확답 (2026-07-27):

> "시즌길이는 보통 1년이지만 보수적으로 오늘로부터 1년 6개월 전으로
> 잡을게. **pb기간무관.** 시즌밖기록으로."

정본: `OWNER_DECISION_ANCHOR_CHOICE_2026-07-27.md` §3

```yaml
시즌_창:
  기준점: 오늘
  범위: 오늘로부터 18개월 이내
  적용_대상: SEASON_BEST 만
  PB_적용: 없음
  범위_밖_기록:
    삭제: 없음
    저장_거부: 없음
    계산_거부: 없음
    처리: "시즌 밖" 으로 표시
```

만들 함수:

```ts
/**
 * SB 가 오늘 기준 시즌 창(18개월) 안에 있는지 라벨을 만든다.
 * 이 함수는 계산 가능/불가를 정하지 않는다. 저장을 거부하지 않는다.
 * PB·RECENT_RESULT 에는 호출하지 않는다.
 */
export function seasonWindowLabel(
  record: AthleteRecord,
  today: Date,                    // 테스트 가능하게 반드시 인자로 받는다
): { readonly withinWindow: boolean; readonly label: string }
// 예: { withinWindow: true,  label: "현재 시즌" }
// 예: { withinWindow: false, label: "시즌 밖 (2년 3개월 전)" }
```

`label`의 경과 부분은 `elapsedSinceAchieved`의 `label`을 **재사용한다.**
개월 계산 로직을 두 번 쓰지 않는다.

**허용 / 금지 경계 (이 표를 어기면 만료 기능이 다시 살아난다)**

| 하는 것 | 허용 |
|---|---|
| "현재 시즌" / "시즌 밖" 라벨 만들기 | ✅ |
| 목록에서 두 그룹으로 **나눠 보여 주기** | ✅ |
| P3에서 SB 후보 정렬·기본 제안에 참고 | ✅ |
| 저장을 거부 | ❌ |
| 계산을 거부 | ❌ |
| 화면에서 숨기거나 삭제 | ❌ |
| `PERSONAL_BEST`에 적용 | ❌ (`pb기간무관`) |
| `freshnessState`를 이 값으로 자동 결정 | ❌ (§3-3-1) |

**임계값 상수 이름 주의.** `18`은 **오너 정책 값**이지 과학적 임계값이
아니다. 반드시 그렇게 주석에 쓴다. `FORMATION_LOAD_AND_STATISTICAL_RULES_CONTRACT.md`
§9 — *"A future cutoff is product policy, not a scientific threshold."*

```ts
/** 오너 정책 값 (2026-07-27 확답). 과학적 임계값이 아니다. 라벨 전용. */
export const SEASON_WINDOW_MONTHS = 18
```

### 3-3-3. "현재 경기력 평가 지표"는 표시 라벨이다

오너 요구: *"현재 경기력 평가 지표로 표현하기도 해줘."*

화면에서 그렇게 **부를 수 있다.** 다만 **`purpose`는 바뀌지 않는다.**

| 화면 라벨 | 실제 `purpose` | 비고 |
|---|---|---|
| 현재 경기력 지표 | `RECENT_RESULT` → `CURRENT_CAPABILITY` | 그대로 |
| 현재 경기력 지표 | `PERSONAL_BEST` → `CURRENT_CAPABILITY` | 기간 무관 |
| 현재 시즌 기록 | `SEASON_BEST` → **`SEASON_CONTEXT`** | 창 안에 있어도 **바뀌지 않음** |
| 시즌 밖 기록 | `SEASON_BEST` → `SEASON_CONTEXT` | 라벨만 다름 |
| 목표기록 | `RACE_GOAL` → `ASPIRATIONAL_TARGET` | 절대 현재 실력 아님 |

🔴 **SB가 시즌 창 안에 있다는 이유로 `purpose`를 `CURRENT_CAPABILITY`로
올리지 말 것.** 스펙 `TRAINING_SESSION_PRESCRIPTION_CONTRACT.md` §4가
SB → `SEASON_CONTEXT` 를 불변식으로 못 박았고, `anchor.ts:35-40`이
다른 값이면 거부한다.

### 3-3-4. 함수 검증 절차 — 다음 작업자가 리뷰할 수 있게 남긴다

이 절은 **"왜 이 함수가 이런 모양인지"** 를 추적할 수 있게 만든다.
서명만 보고는 어떤 스펙 문장에서 나온 건지 알 수 없다. 리뷰하는 사람이
스펙을 처음부터 다시 읽지 않아도 되게, **근거 → 서명 → 손으로 검산 →
리뷰 체크** 순서로 적는다.

작업자는 이 절의 표를 **보고서에 실제 값으로 채워서** 낸다.
빈칸이 있으면 리뷰가 반려된다.

#### (1) 서명이 왜 이 모양인가 — 근거 추적표

| 서명 요소 | 이렇게 만든 근거 | 다르게 만들면 생기는 일 |
|---|---|---|
| 반환값이 `{ months, label }` 이고 `상태`가 없음 | 부하 계약 §9 "no evidence-backed universal freshness cutoff" | `EXPIRED` 같은 상태를 넣으면 만료 기능이 된다 (오판 사례 6) |
| `today: Date` 를 인자로 받음 | 이 저장소에서 `new Date()` 직접 호출 때문에 CI가 깨진 적 있음 (`tombstone.contract.test.ts`) | 테스트가 실행 시각에 따라 붙었다 떨어졌다 한다 |
| `seasonWindowLabel` 이 `boolean` + `문자열`만 돌려줌 | 오너 결정 §3 "시즌밖기록으로" — 처리는 표시까지 | 계산 가능 여부를 돌려주면 저장·계산 거부로 이어진다 |
| `label` 의 경과 부분을 `elapsedSinceAchieved` 에서 가져옴 | 개월 계산이 두 곳에 있으면 두 값이 갈라진다 | 목록과 상세에 다른 경과가 찍힌다 |
| `SEASON_WINDOW_MONTHS` 가 상수 1개 | 오너 정책 값이라 나중에 오너가 바꿀 수 있어야 함 | 여러 곳에 `18` 이 박히면 오너가 바꿀 때 일부만 바뀐다 |
| `purpose` 를 반환하지 않음 | 처방 계약 §4 SB → `SEASON_CONTEXT` 불변식, `anchor.ts:35-40` | 라벨이 `purpose` 를 올려서 오래된 기록이 현재 실력이 된다 |

#### (2) 손으로 검산하는 표 — 코드 없이 먼저 채운다

**코드를 쓰기 전에** 이 표를 손으로 채운다. 그 다음 테스트를 이 표대로
쓴다. 순서를 바꾸면 코드가 낸 답을 정답으로 착각한다.

`today = 2026-07-27` 로 고정한다.

| # | `achievedOn` | `purpose` | 손으로 계산한 `months` | 기대 `label` | 기대 `withinWindow` | 기대 시즌 창 라벨 |
|---|---|---|---|---|---|---|
| 1 | 2026-07-03 | `SEASON_BEST` | 0 | `"이번 달"` | `true` | `"현재 시즌"` |
| 2 | 2026-03-27 | `SEASON_BEST` | 4 | `"4개월 전"` | `true` | `"현재 시즌"` |
| 3 | 2025-01-27 | `SEASON_BEST` | 18 | `"1년 6개월 전"` | (경계 — (3) 참조) | (경계) |
| 4 | 2024-12-27 | `SEASON_BEST` | 19 | `"1년 7개월 전"` | `false` | `"시즌 밖 (1년 7개월 전)"` |
| 5 | 2023-05-10 | `SEASON_BEST` | 38 | `"3년 2개월 전"` | `false` | `"시즌 밖 (3년 2개월 전)"` |
| 6 | 2023-05-10 | `PERSONAL_BEST` | 38 | `"3년 2개월 전"` | — | **호출하지 않음** |
| 7 | 2026-07-27 | `SEASON_BEST` | 0 | `"이번 달"` | `true` | `"현재 시즌"` |

6번 줄이 `pb기간무관` 을 지키는지 보는 줄이다. `PERSONAL_BEST` 에
`seasonWindowLabel` 을 부르면 안 된다. 경과는 그대로 나온다.

#### (3) 경계 하나를 먼저 정하고 적어 둔다

정확히 18개월 되는 날이 창 안인지 밖인지는 **스펙에 없다.** 작업자가
한 번 정하고, **정한 이유를 코드 주석과 보고서에 적는다.**

```ts
// 경계 규칙: 경과 개월 수가 18 이하면 창 안 (months <= 18).
// 근거: 오너가 "보수적으로" 잡았으므로 경계에서는 창 안쪽으로 붙인다.
//       라벨이지 거부가 아니라서 경계를 어느 쪽에 붙여도 안전하다.
// 이 규칙은 계약 테스트가 잠근다. 바꾸려면 테스트부터 바꿔야 한다.
```

한 번 정한 뒤 **다른 곳에서 다르게 계산하지 않는다.** 계약 테스트에
경계 케이스를 넣어 잠근다.

#### (4) 개월 수를 어떻게 세는지도 못 박는다

`months` 를 세는 방법이 사람마다 다르다. 하나로 정한다.

```
months = (오늘.연 - 달성.연) * 12 + (오늘.월 - 달성.월)
그리고 오늘.일 < 달성.일 이면 months - 1
```

| 입력 | 이 규칙의 답 | 그냥 나눗셈(일수/30)의 답 | 어느 쪽을 쓰나 |
|---|---|---|---|
| 2026-06-28 → 2026-07-27 | 0 | 0 | 같음 |
| 2026-01-31 → 2026-07-27 | 5 | 5 | 같음 |
| 2024-07-28 → 2026-07-27 | 23 | 24 | **위 규칙 (23)** |

세 번째 줄이 왜 중요한지 보고서에 적는다. 일수를 30으로 나누면
"2년 전"이 되는데, 달 기준으로는 아직 2년이 안 됐다. **달 기준으로 센다.**

#### (5) 리뷰하는 사람이 확인할 것 (체크리스트)

리뷰어는 코드를 읽는 대신 이 6개만 본다.

- [ ] (1) 근거 추적표의 각 줄이 실제 파일·줄번호를 가리키는가
- [ ] (2) 검산표 7줄이 **테스트 파일에 그대로** 들어가 있는가
- [ ] (3) 경계 규칙이 코드 주석과 테스트 양쪽에 같은 값으로 적혀 있는가
- [ ] (4) 개월 계산이 저장소에 **한 군데만** 있는가
      (`grep -rn "getMonth()\|/ 30" app/src/domain/athlete-records.ts` 로 확인)
- [ ] `PERSONAL_BEST` 에 `seasonWindowLabel` 을 부르는 코드가 없는가
      (`grep -rn "seasonWindowLabel" app/src` 결과를 보고서에 붙인다)
- [ ] 두 함수 어디에도 `if` 로 계산을 막는 분기가 없는가
      (라벨만 만든다. 막는 분기가 있으면 만료 기능이다)

#### (6) 막히면 이렇게 남긴다

경계나 계산 방법을 정하기 어려우면 **혼자 정하지 말고** 이렇게 남긴다.

```ts
// 판단보류: 18개월 경계를 창 안/밖 어디에 붙일지 스펙에 없다.
// 임시로 months <= 18 을 창 안으로 두고 테스트로 잠갔다.
// 오너 확인 필요. 바꿀 때 고칠 곳: seasonWindowLabel + 계약 테스트 2건.
```

**"합리적으로 보이는 쪽"으로 조용히 정하고 넘어가지 않는다.** 그게
오판 사례 6이 생긴 방식이다.

### 3-4. 입력 파싱

사용자는 `18:30`, `18분 30초`, `1110`(초) 등으로 넣을 수 있다.
**모호하면 저장하지 말고 사용자에게 되묻는다.** 추정 금지.

참고할 기존 구현: `app/src/domain/journal-schema.ts:213` `parseTargetPaceInput`

종목 거리는 **자유 입력이 아니라 선택**으로 받는다. 오타로 `500m`를
`5000m`로 잘못 넣으면 페이스가 10배 틀어진다.

```
800m / 1500m / 3000m / 5000m / 10000m / 하프(21097m) / 마라톤(42195m) / 직접입력
```

`직접입력`은 60m 이상만 허용한다(안전 불변식: 60m 미만 스프린트 금지).

### 3-5. 화면

새 화면 하나를 만든다. 기존 화면 패턴을 따른다
(`app/src/screens/plan-beta/PlanIntake.tsx` 참고).

- 진입: 계획 입력 흐름 또는 설정 — **기존 흐름을 깨지 않는 위치**
- 목록 표시: 종목 · 기록 · 역할 · 달성일 · **경과 기간**
- 추가·수정·삭제
- **오래된 기록도 목록에서 숨기지 않는다.** 경과 기간만 함께 보여 준다
  (오너 지침: 지우지 말고 구분하라)
- 정렬은 달성일 최신순. 오래됐다고 접거나 흐리게 만들지 않는다

### 3-6. 표시 문구 규칙

**이 작업은 페이스를 계산하지 않는다.** 따라서 화면에
"목표 페이스 3분 42초" 같은 것을 절대 표시하지 않는다.

기록을 저장하면 이렇게만 안내한다.

```
5000m · 18분 30초 · 2026-05-10 (2개월 전) · 최고기록
```

```
5000m · 19분 02초 · 2023-03-11 (3년 4개월 전) · 시즌기록 · 2023 시즌
```

시즌기록은 **시즌 이름을 항상 함께 보여 준다.** 스펙 요구사항이다
(*"A season must be named"*).

**두 줄은 경과 기간 문구만 다르다.** 오래된 기록에
"쓰지 않아요" 같은 말을 붙이지 않는다. **P1은 그걸 판정할 권한이 없다.**

경과 기간은 `elapsedSinceAchieved`의 `label`을 그대로 쓴다.
문장에 개월 수를 굳혀 넣지 않는다.

## 4. 테스트 (필수)

`app/src/domain/athlete-records.contract.test.ts`

반드시 포함할 것:

| 테스트 | 확인 내용 |
|---|---|
| 날짜 없는 기록 거부 | `achievedOn` 없으면 저장 실패 |
| 시즌 없는 SB 거부 | `SEASON_BEST` + `seasonId` 미입력 → 저장 실패 |
| SB 아닌 기록에 시즌 부여 거부 | `PERSONAL_BEST` + `seasonId` 있으면 저장 실패 |
| 시즌 기간을 검사하지 않음 | 10년 전 날짜 + 시즌 이름 → **저장 성공** (기간 상한 없음) |
| 시즌 밖 기록도 생성된다 | 18개월을 넘긴 SB → **생성 성공** + `withinWindow: false` |
| 시즌 창 라벨 | 3개월 전 → `withinWindow: true` / 27개월 전 → `"시즌 밖 (2년 3개월 전)"` |
| 시즌 창 경계 | 정확히 18개월 지점이 어느 쪽인지 한 번만 정하고 변하지 않는지 |
| PB에는 시즌 창 미적용 | `PERSONAL_BEST`로 `seasonWindowLabel` 호출 시 라벨이 나오지 않거나 호출 자체가 없는지 |
| 라벨은 `purpose`를 바꾸지 않는다 | 시즌 창 안의 SB도 `purpose` 가 `SEASON_BEST` 그대로인지 |
| 60m 미만 거부 | 안전 불변식 |
| 경과 계산 | 0개월·4개월·38개월이 각각 올바른 `label`로 나오는지 |
| 만료 없음 | 아무리 오래된 기록도 목록에서 빠지지 않는지 |
| 시계 고정 | `vi.useFakeTimers()` 사용 — 시계 의존 금지 |
| 깨진 저장값 | `"{ not json"` 넣어도 빈 목록으로 안전하게 시작 |
| 저장 실패 | `localStorage` 예외 시 크래시 없이 실패 반환 |
| 파싱 모호값 | `"18"`처럼 단위 불명이면 거부 |

**`EXPIRED`·만료 관련 테스트를 쓰지 말 것.** 그 개념 자체가 삭제되었다.
대신 **오래된 기록이 그대로 남아 있는지**를 테스트한다.

추가로 넣을 검사 하나: 소스 전체에 `EXPIRED`·`만료`라는 문자열이
**0건**인지 `grep`으로 확인한다.

## 5. 하지 말 것

- `impl/` 수정 — **금지** (P3에서 다룬다)
- `specs/` 수정 — **금지** (P2에서 다룬다)
- `journal-schema.ts`·`journal-store.ts` 수정 — **금지**
- 기존 경기 일지에서 PB 자동 추출 — **금지** (§2-1)
- 페이스 계산·표시 — **금지** (P3의 일)
- 템플릿 `lifecycleStatus` 변경 — **금지**
- 기록 만료·`EXPIRED` 상태 만들기 — **금지** (오너 지적으로 삭제된 개념)
- 경과 개월 수로 **계산 가능 여부를 판정하는** 임계값 상수 만들기 — **금지**
  (스펙에 근거가 없는 숫자를 만드는 일. `SEASON_WINDOW_MONTHS = 18` 은 예외 —
  오너가 정한 **표시 라벨 전용** 값이며 판정에 쓰지 않는다. §3-3-2)
- 오래된 기록 숨기기·접기·흐리게 하기 — **금지**
- `freshnessState` 값 만들기 — **금지** (P1의 일이 아니다, §3-3-1)
- 훈련 기록·타임트라이얼을 기록으로 받기 — **금지** (스펙 미결, 결정 정본 §9)
- 미성년 정책 변경 — **금지**

## 6. 완료 기준

```bash
cd app && npm test          # 기존 308개 + 신규 전부 통과
cd app && npx tsc --noEmit -p tsconfig.json   # 통과
cd impl && npm test         # 98개 그대로 통과 (impl 안 건드렸으므로)
cd app && npm run build     # 성공
```

- [ ] `athlete-records.ts` + 계약 테스트 추가
- [ ] 기록 입력 화면 추가, 기존 흐름 안 깨짐
- [ ] 모든 기록에 역할·달성일·경과 기간이 **항상** 함께 표시됨
- [ ] `grep -rn "EXPIRED\|만료\|유효기간" app/src` → **0건**
- [ ] 오래된 기록이 목록에서 빠지거나 흐려지지 않음
- [ ] `purpose` → 스펙 `PaceAnchorPurpose` 대응이 §3-2 표와 일치
- [ ] `seasonWindowLabel()` 구현 — SB 전용, 라벨만 만들고 거부하지 않음
- [ ] 시즌 밖 SB 기록이 생성되고 목록에 남아 있음 (숨김·삭제 0건)
- [ ] `seasonWindowLabel()` 이 `PERSONAL_BEST` 에 호출되지 않음 (`pb기간무관`)
- [ ] 시즌 창 라벨이 `purpose` 나 `freshnessState` 를 바꾸지 않음
- [ ] `impl/`, `specs/`, `journal-*` 변경 0건
- [ ] 페이스 숫자를 표시하는 코드 0건
- [ ] **§3-3-4 검증 절차를 보고서에 실제 값으로 채워 냈음** (빈칸 0개)
- [ ] 18개월 경계 규칙이 코드 주석과 테스트에 **같은 값**으로 적혀 있음
- [ ] 개월 계산 코드가 저장소에 **한 군데만** 있음

## 7. 보고

작업 후 `reports/review/WORK_ORDER_P1_REPORT.md`에 적는다.

- 만든 파일 목록
- 테스트 개수 변화 (before → after)
- **§3-3-4 (1) 근거 추적표** — 각 줄에 실제 파일·줄번호를 적어서
- **§3-3-4 (2) 검산표 7줄** — 손으로 계산한 값과 코드가 낸 값을 나란히
- **§3-3-4 (3) 경계 규칙** — 어느 쪽으로 정했고 왜 그렇게 정했는지
- **§3-3-4 (4) 개월 계산 방법** — 세 번째 줄(23 vs 24)의 실측 결과
- **§3-3-4 (5) 체크리스트 6개** — 각 항목의 grep 결과 붙여넣기
- **판단이 필요했으나 하지 않고 남긴 것** (가장 중요)
- 오너에게 물어야 할 것

**애매한 것을 임의로 정하지 말고 보고에 남긴다.** 그게 정답이다.
