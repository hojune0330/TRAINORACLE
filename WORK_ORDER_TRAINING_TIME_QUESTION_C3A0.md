# WORK_ORDER_TRAINING_TIME_QUESTION_C3A0.md

```yaml
doc_id: TRAINORACLE_WORK_ORDER_TRAINING_TIME_QUESTION_C3A0
title: "㉢-a0 훈련 시간대 질문 추가 — 생성기가 오후를 알 수 있게"
issued_by: 오너 승인 2026-08-06 ("주로 언제 훈련하세요 넣자")
issued_date: "2026-08-06"
status: ISSUED
base_commit: "main 최신 (착수 시 `git log -1` 로 확인)"
implementation_branch: codex/training-time-question-c3a0
scope: app_intake + engine_profile (생성 로직 변경은 ㉢-a)
prohibited_scope: [생성기 슬롯 배치(㉢-a), 저장 관문(㉢-b), 화면 문구 C-6(㉢-c), 수정·확정 플로우(B-17), safety-gate, memo-safety]
required_report: reports/review/WORK_ORDER_TRAINING_TIME_QUESTION_C3A0_REPORT.md
blocks: WORK_ORDER_PM_QUALITY_GENERATOR_C3A.md
```

> **먼저 읽을 것 (순서대로).**
> 1. [`OWNER_DECISION_SESSION_SLOT_INTENSITY_2026_08_06.md`](OWNER_DECISION_SESSION_SLOT_INTENSITY_2026_08_06.md) — 전부
> 2. [`AGENTS.md`](AGENTS.md) §5(비공허성·`npx tsc` 금지), §7(판단 보류)
> 3. [`WORK_ORDER_PM_QUALITY_GENERATOR_C3A.md`](WORK_ORDER_PM_QUALITY_GENERATOR_C3A.md) §3 — **이 작업이 그 제약을 푸는 작업이다**

---

## 1. 왜 이 작업이 생겼나

㉢-a 작업지시서를 쓰다가 막혔다. 오너는 "오후 고강도를 열어라"라고 했는데,
**시스템이 선수의 훈련 시간대를 모른다.** 계획 질문 6개 어디에도 없다.

정보가 없으면 생성기는 오후를 고를 수 없다. 근거 없이 고르면 그건 추측이다.
오너에게 물었고 **"주로 언제 훈련하세요 넣자"**로 승인됐다.

**이 작업은 ㉢-a의 선행 작업이다.** 이게 끝나야 ㉢-a가 의미를 갖는다.

## 2. 이 작업이 하는 일 / 안 하는 일

| 함 | 안 함 |
|---|---|
| 계획 질문에 시간대 문항 1개 추가 (6문항 → 7문항) | **생성기가 그 값을 쓰게 하는 것** — ㉢-a |
| 그 값을 저장 스키마에 하위호환으로 추가 | 저장 관문 PM 제약 수정 — ㉢-b |
| 그 값을 엔진 `PlanProfile`까지 전달 | `two-a-day` 문항 문구 수정 — ㉢-c |
| 요약 스트립·뒤로가기·점프 연결 | 새 role 추가 (OD-SLOT-4 금지) |

**이 작업만 끝난 시점에서 생성 결과는 지금과 100% 같아야 한다.**
값을 받아서 엔진까지 전달하되, 아직 아무도 그 값을 읽지 않는다.
이게 이상해 보여도 맞다. 입력과 사용을 분리해야 각각을 따로 검증할 수 있다.

---

## 3. 질문 설계

### 3.1 문항

```
5/7   TRAINING TIME
주로 언제 훈련하세요?

고른 시간대에 고강도 훈련을 배치해요. 나중에 계획에서 직접 바꿀 수도 있어요.
```

### 3.2 선택지 3개

| 값 | 제목 | 설명 |
|---|---|---|
| `MORNING` | 주로 오전 | 새벽·오전에 주로 훈련해요 |
| `EVENING` | 주로 오후 | 오후·저녁에 주로 훈련해요 |
| `VARIES` | 그때그때 달라요 | 정해두지 않고 상황에 맞춰 훈련해요 |

**`VARIES`가 기본값이다.** 저장된 기존 데이터에는 이 필드가 없으므로
`.optional().default("VARIES")`로 받는다.

> **왜 3개인가.** 오너 결정은 "오전(새벽,오전) 오후(오후,저녁)" 두 구간이다.
> 여기에 "모름/유동"이 필요하다 — 기존 사용자의 저장 데이터가 그 상태이고,
> 정하기 싫은 사용자도 있다. **`VARIES`를 "오전"으로 몰래 취급하지 마라.**
> 그게 지금 코드가 저지르고 있는 잘못이다.

### 3.3 값 이름을 이렇게 정한 이유 (바꾸지 마라)

- `MORNING` / `EVENING` — 슬롯 이름 `AM`/`PM`과 **일부러 다르게** 썼다.
  "선수가 선호하는 시간대"와 "세션이 배치된 슬롯"은 다른 개념이다.
  같은 이름을 쓰면 나중에 둘을 혼동해서 대입해 버린다.
- `VARIES` — `UNKNOWN`이나 `null`이 아니다. 사용자가 **적극적으로 고른 답**일 수 있다.

### 3.4 문항 위치

`days`(4번) 다음, `two-a-day`(5번) **앞**에 넣는다.

```
goal → experience → focus → days → training-time → two-a-day → safety
  1        2          3       4          5             6          7
```

**이유:** "며칠 하는가" → "언제 하는가" → "하루 몇 번 하는가" 순서가 자연스럽다.
`two-a-day`는 시간대를 알아야 의미가 명확해진다.

---

## 4. 할 일 (경로 전체, 실측 좌표)

이 값은 화면에서 엔진까지 6단계를 지난다. **하나라도 빠뜨리면 조용히 사라진다.**

### 4.1 엔진 타입 — `impl/src/plan-generator/types.ts`

`SECOND_SESSION_MODES`(`:78-83`) 옆에 같은 패턴으로 추가:

```ts
export const TRAINING_TIME_PREFERENCES = [
  "MORNING",
  "EVENING",
  "VARIES",
] as const
export type TrainingTimePreference = (typeof TRAINING_TIME_PREFERENCES)[number]
```

`PlanProfile`(`:173-179`)에 필드 추가:
```ts
export type PlanProfile = {
  readonly eventGroup: PlanEventGroup
  readonly experienceBand: ExperienceBand
  readonly availableTrainingDays: readonly number[]
  readonly secondSessionMode: SecondSessionMode
  readonly trainingTimePreference: TrainingTimePreference   // ← 추가
}
```

> **필수 필드로 만든다** (optional 아님). 엔진은 앱과 달리 저장 데이터를 읽지 않는다.
> 호출부가 항상 채워 넣게 강제하는 편이 안전하다. 타입체크가 누락을 잡아준다.

### 4.2 저장 스키마 — `app/src/domain/plan-beta-schema.ts`

먼저 `secondSessionModeSchema`(`:20-23`) 옆에 열거 스키마를 선언한다:

```ts
const trainingTimePreferenceSchema = z.enum([
  "MORNING",
  "EVENING",
  "VARIES",
])
```

그리고 `planIntakeSchema`(`:35-48`)에 추가. **`secondSessionMode`(`:47`)와 똑같은 패턴을 따른다:**

```ts
  trainingTimePreference: trainingTimePreferenceSchema
    .optional()
    .default("VARIES"),
```

> **엔진 쪽 `TRAINING_TIME_PREFERENCES`(§4.1)와 값이 어긋나지 않게 하라.**
> 두 곳에 같은 문자열이 존재하는 것은 `secondSessionMode`가 이미 쓰는 방식이다.
> 새로 공용 모듈을 만들지 마라 — app과 impl은 별도 패키지다.

> **🔴 하위호환이 이 작업의 최대 위험이다.**
> 이미 사용자 기기에 저장된 계획에는 이 필드가 없다. `.optional().default()`가
> 없으면 **기존 사용자의 계획이 통째로 사라진다** (`parsePlanBetaState`가
> `null`을 돌려주고 `loadPlanBetaState`가 빈 상태를 준다).
> §6 T-D가 이걸 고정한다. **반드시 통과시켜라.**

### 4.3 앱 도메인 타입 — 건드릴 것이 없다 (확인만)

`PlanBetaIntake`는 `app/src/domain/plan-beta-schema.ts:128`에서
`z.infer<typeof planIntakeSchema>`로 파생된다. §4.2를 고치면 **자동으로 따라온다.**

**별도 타입 선언을 새로 만들지 마라.** 두 벌이 되면 반드시 어긋난다.

### 4.4 화면 — `app/src/screens/plan-beta/PlanIntake.tsx`

| 위치 | 할 일 |
|---|---|
| `:23` `IntakeStep` | `"training-time"` 추가 (`"days"`와 `"two-a-day"` 사이) |
| `:27-42` `PlanIntakeProps` | `onTrainingTime: (pref: TrainingTimePreference) => void` 추가 |
| `:44-90` `STEP_META` | `training-time` 항목 추가. **기존 5·6번의 `number`를 6·7로 올린다** |
| `:118` `aria-label` | `계획 질문 ${meta.number}/6` → `/7` |
| `:119-120` 진행바 | `{meta.number}/6` → `/7`, `width: meta.number * (100/6)` → `(100/7)` |
| 선택지 렌더 | `days`와 `two-a-day` 사이에 `training-time` 분기 추가 |
| `:262-267` 요약 스트립 | `trainingTimePreference` 줄 추가 (`days`와 `two-a-day` 사이 순서) |
| `helpTerm` | 기존 용어 중 적절한 것 재사용. **새 용어를 만들면 `glossary.ts`도 고쳐야 한다 — 판단 보류 후보** |

> `/6`이 **3곳**에 하드코딩돼 있다(`:118`, `:119`, `:120`). 전부 고쳐라.
> 하나만 놓치면 "질문 5/6"인데 7개가 나오는 상태가 된다.

### 4.5 단계 진행 — `app/src/screens/PlanBeta.tsx`

| 위치 | 할 일 |
|---|---|
| `:25` `STEP_ORDER` | `"training-time"`을 `"days"`와 `"two-a-day"` 사이에 삽입 |
| `:174` `onDays` 끝 | `setStep("two-a-day")` → `setStep("training-time")` |
| 신규 `onTrainingTime` | draft에 저장 후 `setStep("two-a-day")` |
| `:127` 후보화면 뒤로가기 | `setStep("two-a-day")` — 그대로 둔다 (마지막 입력 단계가 아님) |
| `:219` `previousStep()` | 새 단계의 이전 단계 매핑 추가 |

### 4.6 완성 검사 — `app/src/domain/plan-beta-flow.ts`

**🔴 여기가 두 번째 함정이다.**

`completeIntake()`(`:155-190`)가 모든 필드에 `undefined` 검사를 건다:
```ts
  if (
    eventGroup === undefined
    || ...
    || secondSessionMode === undefined
  ) {
    return null      // ← 하나라도 없으면 계획 생성 실패
  }
```

새 필드를 여기 **필수로 넣으면**, 위저드를 다시 다 거치지 않은 사용자는
계획을 만들 수 없다. 그런데 화면에서 반드시 거치므로 실제로는 채워진다.

**결정:** `completeIntake()`에는 **필수로 넣는다.** 다만
- 반환 객체(`:183-190`)에 `trainingTimePreference`를 포함시킨다
- **draft에서 `undefined`면 `"VARIES"`로 채우지 말고 `null`을 반환하게 둔다**
  (화면이 반드시 묻게 하기 위해서다. 조용히 기본값을 넣으면 문항을 건너뛰어도
  티가 안 나고, 그러면 문항을 추가한 의미가 없다)

그리고 `:89-97` 엔진 요청 조립부에 전달:
```ts
    profile: {
      eventGroup: intake.eventGroup,
      experienceBand: intake.experienceBand,
      availableTrainingDays: spreadTrainingDays(intake.availableDayCount),
      secondSessionMode: intake.secondSessionMode,
      trainingTimePreference: intake.trainingTimePreference,   // ← 추가
    },
```

### 4.7 기존 테스트 수리

새 문항이 생기면 위저드를 통과하는 기존 테스트가 **중간에 막힌다.**

| 파일 | 실측 | 할 일 |
|---|---|---|
| `app/e2e/launch-ready.spec.ts:93` | `"일부 날은 하루 두 번 운동"` 클릭 | 그 **앞에** 시간대 선택 클릭 추가 |
| `app/src/screens/PlanBeta.contract.test.tsx:124` | `"하루에 두 번 운동하는 날도 넣을까요?"` 확인 | 그 **앞에** 시간대 단계 통과 추가 |

**이 두 곳만이라고 단정하지 마라.** 반드시 전체 스위트를 돌려 실제로 깨지는 것을
확인하고 고쳐라. 위저드를 도는 테스트가 더 있을 수 있다.

---

## 5. 생성기는 아직 이 값을 쓰지 않는다

`impl/src/plan-generator/session-builder.ts`를 **이번에 고치지 마라.**
`qualitySlotFor()`를 만드는 것도 ㉢-a의 일이다.

값이 엔진까지 도착하되 아무도 읽지 않는 상태로 끝낸다.
**§6 T-F가 "생성 결과가 이전과 동일함"을 고정한다.**

> 이게 낭비처럼 보일 수 있다. 아니다. 입력 경로와 사용 로직을 같은 PR에서
> 바꾸면, 계획이 달라졌을 때 원인이 입력인지 로직인지 알 수 없다.

---

## 6. 검증 (전부 필수)

| ID | 고정할 것 | 위치 |
|---|---|---|
| **T-A** | 위저드가 7단계이고, `days` 다음이 `training-time`이다 | contract test |
| **T-B** | 시간대를 고르면 draft에 저장되고 `two-a-day`로 넘어간다 | contract test |
| **T-C** | 고른 값이 엔진 `PlanProfile.trainingTimePreference`까지 도달한다 | flow test |
| **T-D** | 🔴 **`trainingTimePreference`가 없는 기존 저장 데이터를 읽으면 `"VARIES"`로 살아난다** | schema contract |
| **T-E** | 진행 표시가 `1/7`~`7/7`이고 `/6`이 남아 있지 않다 | contract test 또는 grep |
| **T-F** | 🔴 **같은 입력에 대한 생성 결과가 이 변경 전후로 동일하다** | impl 또는 flow test |
| **T-G** | 위저드 전체를 처음부터 끝까지 통과해 계획이 만들어진다 | e2e |

### 6.1 T-D를 반드시 통과시켜라

```ts
// 기존 사용자 데이터 — trainingTimePreference 없음
const legacy = { version: 1, intake: { /* 이 필드 없이 */ }, ... }
expect(parsePlanBetaState(legacy)).not.toBeNull()
expect(parsePlanBetaState(legacy)?.intake.trainingTimePreference).toBe("VARIES")
```

**이게 깨지면 실사용자의 계획이 사라진다.** 다른 게 다 통과해도 이게 실패하면
병합하지 마라.

### 6.2 비공허성 증명 — 결함 주입 (AGENTS.md §5)

각 테스트마다 대응 결함을 넣고 **이름으로** 실패하는지 확인한다.

```bash
# 예: T-D
#   .optional().default("VARIES") 를 제거한다
#   → T-D만 이름으로 실패해야 한다
#   → 되돌린다
git status --porcelain      # 비어 있어야 한다
```

**결함을 넣어도 통과하는 테스트는 고치지 말고 지운다.**

### 6.3 타입체크 — `npx tsc` 금지

```bash
# ✗ 절대 하지 않는다 (무관한 tsc@2.0.4가 받아져 exit 0을 준다)
cd impl && npx tsc --noEmit

# ✓ 둘 중 하나
cd impl && npm ci && npm run typecheck
cd impl && ./node_modules/.bin/tsc --noEmit

# app 쪽
cd app && npm run typecheck && npm run typecheck:e2e
```

`src/`로 시작하는 오류가 **0건**이어야 한다.

### 6.4 회귀

```bash
cd impl && npx vitest run          # 14파일 127건
cd app  && npx vitest run          # 기준선 대비 신규 실패 0건 (이름 비교)
cd app  && npm run build && npx playwright test   # dist 먼저 빌드할 것
```

> **e2e 함정:** Playwright `webServer`가 `dist/`를 서빙한다.
> `npm run build`를 먼저 하지 않으면 **옛 화면으로 테스트한다.**
> 새 문항이 안 보여서 "왜 통과하지" 하게 된다.

---

## 7. 보고서

`reports/review/WORK_ORDER_TRAINING_TIME_QUESTION_C3A0_REPORT.md`:

1. T-A~T-G 각각의 **결함 주입 내용과 실패한 테스트 이름**
2. `./node_modules/.bin/tsc` 출력 (`npx tsc` 결과는 인정 안 함)
3. **T-D 하위호환 증명** — 기존 데이터가 살아나는 로그
4. **T-F 동일성 증명** — 생성 결과가 변경 전후 같다는 근거
5. 수리한 기존 테스트 목록 (§4.7 예상 2곳 외에 더 있었는지)
6. 판단 보류 항목

---

## 8. 커밋 규칙

- 브랜치 `codex/training-time-question-c3a0`, 베이스는 **`main` 최신**
- **커밋마다 푸시.** 샌드박스가 리셋되면 잃는다
- `main` 직접 푸시 금지
- PR 본문에 §7 요약

---

## 9. 이 작업에서 하기 쉬운 실수

| 실수 | 결과 |
|---|---|
| 🔴 `.optional().default("VARIES")` 누락 | **기존 사용자 계획 전부 소실** |
| 🔴 생성기까지 같이 고침 | ㉢-a 범위. 원인 분리가 안 됨 |
| `/6` 하드코딩 3곳 중 일부만 수정 | 진행 표시가 어긋남 |
| `VARIES`를 내부에서 `MORNING`으로 취급 | 지금 코드의 잘못을 그대로 반복 |
| 값 이름을 `AM`/`PM`으로 지음 | 슬롯과 혼동. 나중에 잘못 대입됨 |
| `completeIntake()`에서 `undefined`를 `"VARIES"`로 채움 | 문항을 건너뛰어도 티가 안 남 |
| e2e 전에 `npm run build` 안 함 | 옛 화면으로 테스트해서 헛통과 |
| `npx tsc` 통과로 판단 | 그건 TypeScript가 아니다 (§6.3) |
| 깨진 기존 테스트를 `skip` 처리 | 고치거나 물어라. 끄지 마라 |

---

## 10. 판단 보류 후보 (구현하지 말고 보고)

- `helpTerm`에 새 용어가 필요하다고 판단되면 → `glossary.ts` 수정 범위가 생긴다. 보고하라
- 시간대를 `VARIES`로 고른 사용자에게 ㉢-a가 무엇을 해야 하는지 → **이 작업 범위 아님.**
  ㉢-a 작업지시서 §3에 잠정 규칙(`VARIES`→`AM`)을 적어 두었고 오너 확인 대기 중이다.
  **이 작업에서는 어떤 슬롯 규칙도 구현하지 마라**
- 기존 사용자에게 "새 질문이 생겼으니 다시 답해달라"고 안내할지 → 별도 결정

---

**이 제품은 사람의 훈련과 몸을 다룬다. 판단이 서지 않으면 멈추고 물어라.**
