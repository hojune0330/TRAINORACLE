# WORK_ORDER_P3 — 페이스 계산 배선·화면 표시

```yaml
work_order:
  id: WORK_ORDER_P3
  issued_by: TOTAL_RESPONSIBILITY_HOLDER
  issue_date: "2026-07-27"
  decision_basis:
    - PERSONAL_PACE_DECISION_2026-07-27.md (오너 결정 1·2·3)
  선행필독:
    - PRODUCT_NORTH_STAR.md
    - PERSONAL_PACE_DECISION_2026-07-27.md
  branch: codex/work-order-p3-pace-wiring
  선행조건: WORK_ORDER_P1 병합 + WORK_ORDER_P2 병합  # 둘 다 필요
  대상작업자: 구현 에이전트 (토큰 소모 큼)
  주의: 템플릿 활성화는 오너 최종 확인 후 별도 커밋
```

---

## §0-Z 공격 리뷰 결과 — 🟠 중대 1 · 보통 2 (D1~D3)

**리뷰:** [`reports/review/WORK_ORDER_AGGRESSIVE_REVIEW_2026-07-28.md`](./reports/review/WORK_ORDER_AGGRESSIVE_REVIEW_2026-07-28.md) · 2026-07-28

**조건부 착수.** 페이스 산수는 전부 검증 통과했다. 그러나 §2-4 의
"목표 달성 시 3분 30초" 는 **5000m 목표 17:30 이라는 전제 입력이 지시서에 없어
재현·테스트가 불가능**하다. §2-8 4행은 `achievedOn 2024-04-20` 에
`seasonId "2023 시즌"` 이 붙어 내부 모순이다.

**착수 전 반드시 위 리뷰의 §0-A(결함표)·§0-B(고칠 것)를 읽고 지시서를 먼저 고친다.**

---

## 0. 이 작업의 위치 — 경유지다, 종착지가 아니다

오너 승인 결정 1은 **길 2(환산 모델 도입)** 이다. 이 작업(3단계)은
환산 없이 되는 2개 템플릿으로 **배선을 검증하는 단계**다.

```
1단계 P1  선수 기록 입력       ✅ 완료 후
2단계 P2  기계용 표기 추가      ✅ 완료 후
3단계 P3  ← 지금 이 작업
4단계     환산 모델 (목적지)   ← 오너 재승인 후
5단계     구역 템플릿 13개 개방
```

**⚠️ 이 작업이 끝나도 제품은 완성이 아니다.** 3단계에서 멈추면
오너 결정 위반이다. 보고서에 "4단계로 넘어가야 함"을 반드시 남긴다.

배선을 먼저 검증하는 이유: 4단계에서 페이스가 틀리게 나올 때
**원인이 환산 모델인지 배선인지 구분**할 수 있어야 한다.

## 1. 이미 조사된 사실 (다시 조사 금지)

| 항목 | 상태 | 위치 |
|---|---|---|
| 페이스 계산 함수 | **이미 있음** | `impl/src/prescription/runtime.ts:177` `calculateSameEventRacePace` |
| 런타임 준비 함수 | **이미 있음** | `runtime.ts:198` `preparePrescriptionRuntime` |
| 앵커 검증 | 있음 | `impl/src/prescription/anchor.ts` |
| 표기 파서 | 있음 | `impl/src/prescription/notation.ts` |
| 앱이 처방 엔진 사용 | **안 함** | `@impl/prescription` import 0건 |
| 앱 처방 저장 종류 | `REST`, `RPE_TIME_RANGE` **둘뿐** | `plan-beta-store.ts:42-90` |
| 표기 읽기 화면 | 있음 | `app/src/screens/plan-beta/NotationReader.tsx` |

**계산식을 새로 만들지 말 것. 이미 있다. 연결하는 작업이다.**

### 1-1. 계산식 (참고)

```
목표 반복 시간(초) = 기록(초) × 반복거리(m) ÷ 기록거리(m)

예) 5000m 18분30초(1110초) 선수의 1000m 반복
    1110 × 1000 ÷ 5000 = 222초 = 3분 42초
```

## 2. 해야 할 일

### 2-1. 앱 저장 구조에 처방 종류 추가

**현재 `plan-beta-store.ts`에는 페이스를 담을 자리가 없다.**
처방 종류가 `REST`와 `RPE_TIME_RANGE` 두 개다.

**기존 두 종류를 건드리지 말고 하나 추가한다.**

```ts
z.object({
  kind: z.literal("PACE_TARGET"),
  // 반복 구조
  setCount: z.number().int().positive(),
  repetitionsPerSet: z.number().int().positive(),
  repetitionDistanceM: z.number().int().positive(),
  // 오늘 목표 (현재 실력 기준) — 실제 훈련 지시
  targetRepSeconds: z.number().positive(),
  // 근거 표시용
  anchorEventDistanceM: z.number().int().positive(),
  anchorPerformanceSeconds: z.number().positive(),
  anchorPurpose: z.enum(["PERSONAL_BEST", "SEASON_BEST", "RECENT_RESULT"]),
  anchorAchievedOn: z.string(),
  // SEASON_BEST 를 기준으로 고른 경우 시즌 이름. 그 외 null
  // 스펙: "A season must be named" (anchor.ts 가 없으면 거부한다)
  anchorSeasonId: z.string().nullable(),
  // 고르지 않은 쪽과의 비교 (오너 결정 B). 비교 대상이 없으면 null
  comparisonAnchor: z.object({
    purpose: z.enum(["PERSONAL_BEST", "SEASON_BEST", "RECENT_RESULT"]),
    achievedOn: z.string(),
    elapsedLabel: z.string(),
    seasonId: z.string().nullable(),
    // 같은 세션을 이 기준으로 계산했을 때의 목표. 같은 공식·같은 단위
    repSeconds: z.number().positive(),
    // targetRepSeconds - comparisonAnchor.repSeconds (초). 음수 가능
    deltaSeconds: z.number(),
  }).nullable(),
  // 사람이 선택한 인정 상태. 날짜에서 자동 계산하지 않는다 (§2-3)
  anchorFreshness: z.enum(["CURRENT", "STALE"]),
  // 표시용 경과 라벨. P1의 elapsedSinceAchieved().label 을 그대로 저장
  anchorElapsedLabel: z.string(),
  // 목표 달성 시 (참고용, 오너 결정 2) — 없을 수 있다
  goalRepSeconds: z.number().positive().nullable(),
  // 회복
  repetitionRecoverySeconds: z.number().nullable(),
  setRecoverySeconds: z.number().nullable(),
})
```

**⚠️ 기존 계획이 그대로 열려야 한다.** 스키마 추가로 기존
`RPE_TIME_RANGE` 계획이 깨지면 사용자가 저장한 계획을 잃는다.
**마이그레이션 테스트를 반드시 넣는다.**

### 2-2. 계산 배선

`impl`의 기존 함수를 호출한다. 새로 만들지 않는다.

```
선수 기록(P1) + 기계표기(P2) → preparePrescriptionRuntime → 페이스
```

주의: `preparePrescriptionRuntime`은 안전 게이트와 템플릿 상태를 먼저 본다.
`SAFETY_GATE_BLOCKED`, `TEMPLATE_NOT_ACTIVE`, `TEMPLATE_NOT_ELIGIBLE`을
정상 응답으로 받아 **폴백**해야 한다. 우회하지 말 것.

### 2-3. 오래된 기록 처리 — **만료가 아니라 표시** (오너 결정 3, 정정판)

> 🔴 **이 절은 오너 지적으로 정정되었다.** 이전 버전은 `EXPIRED`
> (경과 기간 초과 시 계산 거부)를 요구했다. **그 요구는 삭제되었다.**
> 오너 지적: *"유효기간은 없어야 되는 거 아냐?"*

**기록은 만료되지 않는다.** 스펙이 명시적으로 그렇게 정한다.

- `FORMATION_LOAD_AND_STATISTICAL_RULES_CONTRACT.md` §9
  — "There is **no evidence-backed universal freshness cutoff**"
- `TRAINING_SESSION_PRESCRIPTION_CONTRACT.md` §4
  — "**A PB can be old**; it is never assumed to be current without its state"

**P1에는 `recordFreshness()`가 없다.** P1은 표시용
`elapsedSinceAchieved()`만 만든다. 경과 기간으로 계산 가능 여부를
판정하는 코드는 **어디에도 없어야 한다.**

#### `freshnessState`는 누가 정하는가 — **사람이 정한다**

엔진의 `freshnessState`는 **입력값이다**(`anchor.ts:23`이 읽기만 한다).
날짜에서 자동 계산되는 값이 **아니다.**

```
기록 선택 화면에서 선수가 고른다:

  [○] 이 기록을 현재 실력으로 봅니다        → CURRENT
  [○] 참고만 하고, 오래된 기록임을 표시합니다  → STALE

  5000m 18분 30초 · 2023-03-11 (3년 4개월 전)
```

**기본 선택값을 코드가 미리 찍어 두지 말 것.** 선수가 직접 고른다.
경과 기간을 옆에 크게 보여 주는 것이 코드가 할 일의 전부다.

| 사람의 선택 | 동작 |
|---|---|
| `CURRENT` | 계산 + **경과 기간 항상 표시** |
| `STALE` | 계산 + 경과 기간 + "참고용" 문구 |
| 선택 안 함 | 계산하지 않고 체감강도 폴백 |

**`CURRENT`에도 경과 기간을 표시한다.** 스펙의
"stale is not silently current"는 **조용함**을 금지하는 것이므로,
현재 실력으로 인정했더라도 그 근거가 언제 것인지 항상 보여야 한다.

#### `impl` 변경 규칙

`STALE`을 허용하는 경로를 **명시적으로** 만든다.

- `CURRENT` 검사를 **그냥 지우지 말 것** — 지우면 `UNKNOWN`까지 통과한다
- `UNKNOWN`은 **계속 거부**한다 (사람이 아무 선택도 안 한 상태다)
- 계약 테스트로 `UNKNOWN` 거부를 잠근다
- **경과 개월 수를 보는 코드를 `impl`에 넣지 말 것.** 나이 판정 금지

### 2-4. 화면 표시 (오너 결정 2 — 2단 표시)

```
1000m 5회 · 사이 조깅 2분 30초

오늘 목표        3분 42초
목표 달성 시     3분 30초        ← 회색, 작게. 참고용임이 보여야 함

기준: 5000m 18분 30초 (최고기록, 2026-05-10)
```

기준 줄에는 **경과 기간을 항상 넣는다.** `CURRENT`든 `STALE`이든 마찬가지다.

```
기준: 5000m 18분 30초 (최고기록, 2026-05-10 · 2개월 전)
```

`STALE`(참고용으로 선택함)이면 여기에 덧붙인다.

```
ⓘ 3년 4개월 전 기록을 참고용으로 쓰고 있어요.
```

경과 문구는 P1의 `elapsedSinceAchieved().label`을 쓴다.
**"N개월 지나서 안 씁니다" 같은 만료 문구를 쓰지 말 것.**

**"목표 달성 시"를 "오늘 목표"보다 크거나 눈에 띄게 표시하면 안 된다.**
선수가 목표 페이스를 오늘의 지시로 착각하면 매 훈련이 과부하가 된다.
코드에 박힌 규칙(`anchor.ts:42` `GOAL_ANCHOR_FORBIDDEN`)과
카탈로그 정지 조건(`STOP_IF_GOAL_MISREPRESENTED_AS_CURRENT_CAPABILITY`)이
막으려는 것이 바로 이 착각이다.

목표기록이 없으면 "목표 달성 시" 줄은 **표시하지 않는다**(빈칸·0 금지).

### 2-5. 폴백 (실패 시 동작)

**어떤 이유로든 계산이 안 되면 기존 체감강도 표시로 돌아간다.**

| 상황 | 표시 |
|---|---|
| 기록 없음 | 체감강도 (기존 그대로) |
| 인정 상태 미선택 (`UNKNOWN`) | 체감강도 + "기록을 현재 실력으로 볼지 선택해 주세요" |
| 템플릿 비활성 | 체감강도 |
| D9 차단 | **계획 자체가 안 나온다** (기존 동작 유지) |
| 파싱 실패 | 체감강도 |
| 종목 불일치 | 체감강도 + "이 종목 기록이 필요해요" |

**숫자를 못 보여주면 사용자가 아쉬워하는 데서 끝난다.
틀린 숫자를 보여주면 선수가 다친다. 그래서 막히면 안 보여준다.**

### 2-6. 표기 읽기 화면 안내문 갱신

`NotationReader.tsx`에 이 문장이 있다.

> "개인 최고기록이나 목표기록으로 페이스를 계산하지 않아요."

**개인 페이스가 실제로 작동하면 이 문장은 거짓이 된다.**
다만 그 화면 자체는 여전히 계산하지 않으므로, 문장을 정확하게 고친다.

예: "이 화면에서는 표기만 풀어봐요. 개인 페이스는 훈련계획에서 볼 수 있어요."

### 2-7. 기준 기록 선택제 (오너 결정, 필수)

> 근거: [`OWNER_DECISION_ANCHOR_CHOICE_2026-07-27.md`](./OWNER_DECISION_ANCHOR_CHOICE_2026-07-27.md) §2
> 오너: *"본인이나 코치가 어떤 훈련을 할지 선택하게 하는 거지. 번거롭거나
> 손이 한번 더 눌러야 하는 상황이 있더라도 그게 필요할 듯."*

**코드가 기준 기록을 자동 선택하지 않는다.** 사람이 버튼으로 고른다.

```
기준 기록을 고르세요            ← 미리 선택된 기본값 없음
[○ PB 기준]  [○ SB 기준]
```

두 개 이상의 기록이 있을 때 **반드시 선택 단계를 거친다.** 기록이 하나뿐이면
그 하나를 보여주되 **"이 기록을 기준으로 씁니다"를 사람이 확인**하게 한다.

#### 고르지 않은 쪽과의 차이를 항상 보여준다

```
선택: PB 5000m 15:30 (2024-03-10, 2년 4개월 전)
  → 1000m 반복 목표 3:06

참고: SB 5000m 15:45 (2026 실외, 4개월 전)
  → 같은 세션이면 1000m 3:09  (3초 느림)
```

`comparisonAnchor`가 이 "참고" 줄을 만든다. **같은 세션·같은 공식으로
계산하고 차이는 초 단위로만 표시한다.**

#### 🔴 부하를 하나의 점수로 합치지 않는다

오너가 *"훈련의 부하를 비교해주는 것"*이라고 하셨으나, 부하 계약이
**단일 부하 점수를 금지 해석으로 명시**한다.

`FORMATION_LOAD_AND_STATISTICAL_RULES_CONTRACT.md` §3:

| Family | **Forbidden interpretation** |
|---|---|
| external | **total biological load** |
| derived | **interchangeable universal load** |

> "Values with different dimensions or different arbitrary-unit methods
> are **never added**."

| 표시 | 허용 |
|---|---|
| `"1000m 3:06 vs 3:09 (3초 느림)"` | ✅ 같은 단위 차이 |
| `"세션 총 목표 시간 15:30 vs 15:45"` | ✅ 같은 단위 차이 |
| `"PB 훈련이 부하 12% 높음"` | ❌ 단일 부하 점수 금지 |
| `"이 부하는 무리입니다 / 안전합니다"` | ❌ `readiness_threshold: PROHIBITED` |

**페이스와 목표 시간의 차이로만 보여준다.** 이게 선수에게도 더 명확하다.

### 2-8. 기록 목록을 세 그룹으로 보여준다 (오너 결정 D·E, 확정)

> 근거: [`OWNER_DECISION_ANCHOR_CHOICE_2026-07-27.md`](./OWNER_DECISION_ANCHOR_CHOICE_2026-07-27.md) §3
> 오너 확답 (2026-07-27): *"시즌길이는 보통 1년이지만 보수적으로 오늘로부터
> 1년 6개월 전으로 잡을게. 현재 경기력 평가 지표로 표현하기도 해줘.
> pb기간무관. 시즌밖기록으로."*

기준 기록을 고르는 화면에서 후보를 **세 그룹으로 나눠 보여준다.**
세 그룹 **모두 화면에 남는다.** 어느 그룹도 숨기거나 잠그지 않는다.

```
■ 현재 경기력 지표
   5000m 15:45 · 2026 실외 · 4개월 전        [○ 이 기록 기준]
   3000m  9:02 · 2026 실외 · 2개월 전        [○ 이 기록 기준]

■ 개인 최고기록  (기간 무관)
   5000m 15:30 · 2024-03-10 · 2년 4개월 전   [○ 이 기록 기준]

■ 시즌 밖 기록  (참고)
   5000m 15:38 · 2023 시즌 · 2년 3개월 전    [○ 이 기록 기준]
```

그룹 판정은 P1의 `seasonWindowLabel(record, today)` 결과를 쓴다.
**P3가 개월 수를 다시 계산하지 않는다.**

| 그룹 | 들어가는 것 |
|---|---|
| 현재 경기력 지표 | `RECENT_RESULT` + 시즌 창(18개월) **안**의 `SEASON_BEST` |
| 개인 최고기록 | `PERSONAL_BEST` — **기간 무관, 창 판정 없음** |
| 시즌 밖 기록 | 시즌 창 **밖**의 `SEASON_BEST` |

#### 🔴 라벨은 `purpose`를 바꾸지 않는다

"현재 경기력 지표" 그룹에 들어갔다는 이유로 SB의
`purpose`를 `CURRENT_CAPABILITY`로 올리면 **엔진이 거부한다.**

```ts
// anchor.ts:35-40 — SB 는 purpose 가 SEASON_CONTEXT 여야 한다
// 아니면 ANCHOR_PROVENANCE_INCOMPLETE
```

스펙 `TRAINING_SESSION_PRESCRIPTION_CONTRACT.md` §4 불변식:
SB → `SEASON_CONTEXT`, *"A season must be named"*.

| 하는 것 | 허용 |
|---|---|
| 그룹 제목을 "현재 경기력 지표"로 쓰기 | ✅ 화면 문구 |
| 시즌 창 안/밖으로 목록을 나누기 | ✅ 정렬·그룹화 |
| 시즌 밖 기록도 **선택 가능**하게 두기 | ✅ 오너: 거부 없음 |
| 시즌 밖 SB로 계산을 **거부** | ❌ |
| 시즌 밖 기록을 숨기거나 흐리기 | ❌ |
| `PERSONAL_BEST`를 창으로 판정 | ❌ `pb기간무관` |
| 창 안이라고 `purpose`·`freshnessState`를 **자동 승격** | ❌ (§2-3) |

시즌 밖 기록을 골랐다면 `STALE` 안내문(§2-4)과 **같은 방식으로**
경과를 덧붙인다. 새 경고 등급을 만들지 않는다.

```
ⓘ 시즌 밖 기록(2년 3개월 전)을 기준으로 쓰고 있어요.
```

### 2-9. 함수 검증 절차 — 다음 작업자가 리뷰할 수 있게 남긴다

P3에서 새로 만드는 판단 로직은 두 개다. 둘 다 **틀리면 화면에 잘못된
페이스가 찍히는 자리**라서, 서명만 남기지 않고 검증 과정을 남긴다.

| 만드는 것 | 하는 일 |
|---|---|
| 그룹 배정 | 기록 하나를 §2-8의 세 그룹 중 하나에 넣는다 |
| `comparisonAnchor` 차이 | 고르지 않은 쪽과의 초 단위 차이를 만든다 |

작업자는 이 절의 표를 **보고서에 실제 값으로 채워서** 낸다.
빈칸이 있으면 리뷰가 반려된다.

#### (1) 그룹 배정 — 근거 추적표

| 서명 요소 | 이렇게 만든 근거 | 다르게 만들면 생기는 일 |
|---|---|---|
| P1의 `seasonWindowLabel()` 을 **호출**해서 쓴다 | 개월 계산이 두 곳에 있으면 두 값이 갈라진다 | 기록 목록과 선택 화면에 다른 그룹이 찍힌다 |
| `PERSONAL_BEST` 는 `seasonWindowLabel()` 을 **거치지 않는다** | 오너 결정 §3 `pb기간무관` | 2년 전 PB가 "시즌 밖"으로 밀려나 눈에 안 띈다 |
| 반환값이 그룹 이름뿐이고 `purpose` 가 없다 | 처방 계약 §4 SB → `SEASON_CONTEXT` 불변식, `anchor.ts:35-40` | 그룹이 `purpose` 를 올려 엔진이 `ANCHOR_PROVENANCE_INCOMPLETE` 로 거부한다 |
| 반환값에 `사용가능: false` 같은 값이 없다 | 오너 결정 §3 "계산_거부: 없음" | 시즌 밖 기록을 못 고르게 되어 만료 기능이 살아난다 |

#### (2) 그룹 배정 — 손으로 검산하는 표

`today = 2026-07-27` 로 고정한다. **코드를 쓰기 전에** 채운다.

| # | `purpose` | `achievedOn` | `seasonId` | 손으로 정한 그룹 | 고를 수 있나 |
|---|---|---|---|---|---|
| 1 | `RECENT_RESULT` | 2026-03-20 | — | 현재 경기력 지표 | ✅ |
| 2 | `RECENT_RESULT` | 2022-03-20 | — | 현재 경기력 지표 | ✅ |
| 3 | `SEASON_BEST` | 2026-03-20 | `2026 실외` | 현재 경기력 지표 | ✅ |
| 4 | `SEASON_BEST` | 2024-04-20 | `2023 시즌` | 시즌 밖 기록 | ✅ |
| 5 | `PERSONAL_BEST` | 2024-03-10 | — | 개인 최고기록 | ✅ |
| 6 | `PERSONAL_BEST` | 2019-05-01 | — | 개인 최고기록 | ✅ |

2번 줄이 왜 "현재 경기력 지표"에 남는지 보고서에 적는다.
**`RECENT_RESULT` 에는 시즌 창을 적용하지 않는다.** 창은 `SEASON_BEST`
전용이다 (오너 결정 §3 `적용_대상: SEASON_BEST 만`). 오래된
`RECENT_RESULT` 는 경과 문구로 알린다. 그룹을 옮기지 않는다.

6번 줄이 `pb기간무관` 을 지키는지 보는 줄이다. 7년 전 PB도
"개인 최고기록" 그룹에 그대로 있고 고를 수 있다.

#### (3) `comparisonAnchor` 차이 — 근거 추적표

| 서명 요소 | 이렇게 만든 근거 | 다르게 만들면 생기는 일 |
|---|---|---|
| `deltaSeconds` 가 **초 정수**다 | 부하 계약 §3 — 다른 단위·다른 임의 단위 방법을 더하지 않는다 | 퍼센트나 점수로 바꾸면 단일 부하 점수 금지에 걸린다 |
| 같은 세션·같은 공식으로 두 번 계산한다 | 계산 방법이 다르면 차이가 방법 차이가 된다 | 3초 차이인데 6초로 보인다 |
| `comparisonAnchor` 가 `null` 일 수 있다 | 기록이 하나뿐이면 비교 대상이 없다 | `0초 차이` 로 만들면 "차이가 없다"는 틀린 말이 된다 |
| 부호를 문구로 풀어 쓴다 (`"3초 느림"`) | `+3` / `-3` 은 어느 쪽이 느린지 사람이 헷갈린다 | 선수가 반대로 읽고 더 빠르게 뛴다 |

#### (4) `comparisonAnchor` 차이 — 손으로 검산하는 표

입력: 세션은 `1000m 반복`, 두 기준 기록은 5000m.

| # | 선택한 기준 | 선택 쪽 목표 | 안 고른 쪽 | 안 고른 쪽 목표 | 손으로 계산한 `deltaSeconds` | 기대 문구 |
|---|---|---|---|---|---|---|
| 1 | PB 15:30 | 3:06 (186초) | SB 15:45 | 3:09 (189초) | 3 | `"3초 느림"` |
| 2 | SB 15:45 | 3:09 (189초) | PB 15:30 | 3:06 (186초) | -3 | `"3초 빠름"` |
| 3 | PB 15:30 | 3:06 | (기록 없음) | — | — | `comparisonAnchor: null`, 참고 줄 **표시 안 함** |
| 4 | PB 15:30 | 3:06 | SB 15:30 | 3:06 | 0 | `"차이 없음"` (0초로 쓰지 않는다) |

1·2번이 **부호 방향을 잠그는 줄이다.** 어느 쪽을 기준으로 부호를 잡을지
한 번 정하고 코드 주석과 테스트에 같이 적는다.

```ts
// 부호 규칙: deltaSeconds = 안 고른 쪽 목표초 - 선택한 쪽 목표초
// 양수면 안 고른 쪽이 더 느리다 → "N초 느림"
// 이 규칙은 계약 테스트가 잠근다. 바꾸려면 테스트부터 바꿔야 한다.
```

3번 줄이 중요하다. 비교 대상이 없을 때 **참고 줄 자체를 그리지 않는다.**
빈칸이나 `0초`를 넣지 않는다.

#### (5) 리뷰하는 사람이 확인할 것 (체크리스트)

- [ ] (1)(3) 근거 추적표의 각 줄이 실제 파일·줄번호를 가리키는가
- [ ] (2) 검산표 6줄, (4) 검산표 4줄이 **테스트 파일에 그대로** 들어갔는가
- [ ] 부호 규칙이 코드 주석과 테스트 양쪽에 같은 값으로 적혀 있는가
- [ ] P3에 개월 수를 세는 코드가 **없는가**
      (`grep -rn "getMonth()\|monthsBack\|/ 30" app/src/screens/plan-beta app/src/domain/plan-beta-store.ts` → 0건.
      P1의 `seasonWindowLabel()` 호출만 있어야 한다)
- [ ] `RECENT_RESULT` 에 시즌 창을 적용하는 코드가 없는가
- [ ] `PERSONAL_BEST` 에 `seasonWindowLabel()` 을 부르는 코드가 없는가
- [ ] 차이를 퍼센트·점수로 만드는 코드가 없는가
      (`grep -rn "%\|score\|점수" ` 결과에서 부하 관련 0건)
- [ ] 시즌 밖 기록을 고를 수 없게 만드는 `disabled` 가 없는가

#### (6) 막히면 이렇게 남긴다

```ts
// 판단보류: 두 기준의 목표가 완전히 같을 때 문구를 어떻게 쓸지 정해진 게 없다.
// 임시로 "차이 없음" 으로 두고 테스트로 잠갔다.
// 오너 확인 필요. 바꿀 때 고칠 곳: comparisonAnchor 문구 + 계약 테스트 1건.
```

**혼자 정하고 넘어가지 않는다.** 그게 만료 기준을 만들어 넣은
오판(`PRODUCT_NORTH_STAR.md` §5 사례 6)이 생긴 방식이다.

## 3. 템플릿 활성화 — 별도 커밋, 오너 확인 필요

페이스가 나오려면 템플릿이 `ACTIVE` + `ELIGIBLE`이어야 한다
(`runtime.ts:198`에서 검사).

**하지만 카탈로그 §10에 활성화 요건이 못 박혀 있다.**

```yaml
activation_requirements:
  all_numeric_templates:
    - coach_review_of_event_experience_and_current_context
    - sports_science_review_of_source_and_transfer_limitations
    - explicit_lifecycle_change_from_DRAFT
    - separate_active_template_approval_record
```

**따라서 이렇게 한다.**

1. 배선·화면·테스트를 **먼저 전부 끝낸다** (템플릿은 `DRAFT` 그대로)
2. 테스트에서는 **테스트용 가짜 템플릿**으로 검증한다
   (카탈로그를 고치지 않고도 배선이 도는지 확인 가능)
3. 실제 활성화는 **마지막에 별도 커밋**으로 분리하고, 보고서에
   "오너 확인 필요"로 표시한다

대상은 P2에서 `machineNotation`이 확정된 템플릿만이다
(현재 예상: `V2-SEED-05` 1개).

**⚠️ 2번을 3번보다 먼저 하는 이유:** 활성화와 배선을 같은 커밋에 섞으면,
문제가 생겼을 때 되돌릴 때 둘 다 되돌아간다. 분리하면 활성화만
`DRAFT`로 되돌려 즉시 안전한 상태로 복귀할 수 있다.

## 4. 테스트 (필수)

| 테스트 | 확인 내용 |
|---|---|
| 계산 정확성 | 5000m 1110초 → 1000m 반복 = 222초 |
| 기존 계획 마이그레이션 | `RPE_TIME_RANGE` 계획이 그대로 열림 |
| `CURRENT` 계산 | 계산되고 **경과 기간이 표시되는지** |
| `STALE` 계산 | 계산되고 참고용 문구가 실제로 있는지 |
| `UNKNOWN` 폴백 | 계산 안 하고 체감강도 |
| 만료 없음 | 아주 오래된 기록도 `CURRENT` 선택 시 계산되는지 |
| 나이 판정 없음 | `grep -rn "EXPIRED\|만료" app/src impl/src` → **0건** |
| `UNKNOWN` 거부 | **여전히 거부되는지** (`impl` 계약) |
| 종목 불일치 | `CROSS_EVENT_MODEL_REQUIRED` 폴백 |
| 60m 미만 | 거부 |
| D9 차단 | 계획 생성 안 됨 |
| 템플릿 `DRAFT` | 페이스 안 나옴 |
| 목표기록 없음 | "목표 달성 시" 줄 미표시 |
| 목표 > 현재 표시 우선순위 | "오늘 목표"가 주 표시 |
| 시계 고정 | `vi.useFakeTimers()` |
| **기준 자동선택 없음** | 기록 2개일 때 사람이 고르기 전엔 페이스 미표시 |
| **기본값 없음** | 선택 UI 초기 상태에서 어느 쪽도 선택돼 있지 않음 |
| **반대쪽 차이 표시** | PB 선택 시 SB 계산값과 `deltaSeconds`가 함께 나옴 |
| **차이 계산 일치** | `deltaSeconds` = 두 기준 목표초의 차이와 정확히 같음 |
| **비교 대상 없음** | 기록이 하나면 `comparisonAnchor === null`, 화면도 참고줄 없음 |
| **SB 시즌 필수** | `SEASON_BEST` + `anchorSeasonId: null` → 계산 거부 |
| **SB 시즌 표시** | SB 기준 선택 시 시즌 이름이 화면에 나옴 |
| **단일 부하 점수 없음** | `grep -rniE "부하 ?[0-9]+%\|loadScore\|biologicalLoad" app/src` → **0건** |
| **시즌 기간 검사 없음** | 10년 전 SB도 시즌 이름이 있으면 계산됨 (기간 상한 없음) |
| **시즌 밖 기록도 선택 가능** | 시즌 밖 SB 를 기준으로 고르면 페이스가 **나온다** |
| **세 그룹 표시** | 현재 경기력 지표·개인 최고기록·시즌 밖 기록이 **전부 화면에 있는지** |
| **PB는 그룹 판정 없음** | 5년 전 PB 가 "시즌 밖"이 아니라 "개인 최고기록" 그룹에 있는지 |
| **라벨이 `purpose`를 바꾸지 않음** | 시즌 창 안 SB 도 엔진에 `SEASON_CONTEXT` 로 넘어가는지 |
| **개월 수 재계산 없음** | `grep -rn "18" app/src/screens/plan-beta` 에 시즌 창 상수가 **없는지** |

## 5. 하지 말 것

- 계산식 새로 만들기 — **금지** (이미 있다)
- `CURRENT` 검사를 단순 삭제 — **금지** (`UNKNOWN`이 새어 들어온다)
- 경과 개월 수로 계산 거부 — **금지** (만료 개념은 삭제됨)
- `freshnessState` 기본값을 코드가 찍어 두기 — **금지** (사람이 고른다)
- 경과 기간 표시 없이 계산 — **금지** ("stale is not silently current")
- D9 게이트 우회 — **절대 금지**
- 일지 원문을 처방 숫자에 반영 — **절대 금지**
- 60m 미만 페이스 계산 — **절대 금지**
- **종목 간 환산 구현** — **금지** (4단계, 오너 재승인 필요)
- 강도구역(`@T`/`@I`)을 페이스로 추정 — **절대 금지**
- 범위값 임의 확정 — **금지**
- **기준 기록을 코드가 자동 선택** — **금지** (사람이 고른다, §2-7)
- **미리 선택된 기준 기본값 두기** — **금지**
- **부하를 하나의 점수·백분율로 합쳐 비교** — **금지** (§2-7)
- **부하로 안전/위험 판정** — **금지** (`readiness_threshold: PROHIBITED`)
- `SEASON_BEST` 기준인데 `anchorSeasonId` 없이 계산 — **금지** (거부된다)
- **시즌 창(18개월)으로 계산을 거부하거나 기록을 숨기기** — **금지**
  (시즌 창은 **표시·그룹화 전용**이다. §2-8)
- **`PERSONAL_BEST`에 시즌 창을 적용** — **금지** (`pb기간무관`)
- **시즌 창 안이라고 `purpose`·`freshnessState`를 자동 상향** — **금지**
  (SB 는 항상 `SEASON_CONTEXT`. `anchor.ts:35-40`)
- **P3가 개월 수를 다시 계산** — **금지** (P1 `seasonWindowLabel()` 결과를 쓴다)
- 미성년에게 개방 — **금지**
- 템플릿 활성화를 배선과 같은 커밋에 섞기 — **금지**
- 카탈로그 원본 표기 수정 — **금지**

## 6. 완료 기준

```bash
cd app && npm test && npx tsc --noEmit -p tsconfig.json && npm run build
cd impl && npm test
cd app && CI=1 npx playwright test    # e2e 4개 프로젝트
```

- [ ] `PACE_TARGET` 처방 종류 추가, 기존 계획 정상 열림
- [ ] `impl` 함수를 호출해 계산 (재구현 아님)
- [ ] `CURRENT`·`STALE` 둘 다 **경과 기간이 화면에 나옴**
- [ ] 인정 상태를 사람이 고르는 UI가 있고, 기본값이 찍혀 있지 않음
- [ ] `grep -rn "EXPIRED\|만료\|유효기간" app/src impl/src` → **0건**
- [ ] 아주 오래된 기록도 `CURRENT` 선택 시 계산됨 (만료 없음 확인)
- [ ] `UNKNOWN` 거부가 계약 테스트로 잠김
- [ ] 2단 표시, "오늘 목표"가 주 표시
- [ ] 기준 선택 UI가 있고 **미리 선택된 기본값이 없음** (§2-7)
- [ ] 고르지 않은 기준과의 차이가 **초 단위로** 항상 표시됨
- [ ] 단일 부하 점수·백분율이 화면과 소스에 **0건**
- [ ] 기록 목록이 **세 그룹**으로 나오고 세 그룹 모두 화면에 있음 (§2-8)
- [ ] 시즌 밖 SB 로도 계산이 되며 경과 안내문이 붙음
- [ ] `PERSONAL_BEST` 에 시즌 창 판정이 들어가지 않음 (`pb기간무관`)
- [ ] 시즌 창 라벨이 `purpose`·`freshnessState` 를 바꾸지 않음
- [ ] 모든 실패 경로가 체감강도로 폴백
- [ ] 템플릿 활성화는 **별도 커밋**으로 분리
- [ ] 전체 테스트 통과, 회귀 0건
- [ ] **§2-9 검증 절차를 보고서에 실제 값으로 채워 냈음** (빈칸 0개)
- [ ] 부호 규칙이 코드 주석과 테스트에 **같은 값**으로 적혀 있음
- [ ] P3에 개월 수를 세는 코드 0건 (P1 함수 호출만)

## 7. 보고

`reports/review/WORK_ORDER_P3_REPORT.md`

반드시 포함:

- 계산 검증 실측값 (입력 → 출력)
- **§2-9 (1)(3) 근거 추적표** — 각 줄에 실제 파일·줄번호를 적어서
- **§2-9 (2) 그룹 검산표 6줄** — 특히 2번(오래된 `RECENT_RESULT`)과 6번(7년 전 PB)
- **§2-9 (4) 차이 검산표 4줄** — 부호 방향과 3번(비교 대상 없음)
- **§2-9 (5) 체크리스트 8개** — grep 결과 붙여넣기
- `impl` 변경 내역과 **왜 필요했는지**
- 기존 계획 마이그레이션 확인 결과
- **템플릿 활성화 오너 확인 요청** (별도 커밋 링크)
- **"4단계(환산 모델)로 넘어가야 함" 명시** — 3단계는 경유지다
- 판단이 필요했으나 하지 않고 남긴 것
