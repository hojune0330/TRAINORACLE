# WORK_ORDER_PM_QUALITY_GENERATOR_C3A.md

```yaml
doc_id: TRAINORACLE_WORK_ORDER_PM_QUALITY_GENERATOR_C3A
title: "㉢-a 생성기 — 오전 고정 해제와 반대 슬롯 가벼운 훈련"
issued_by: OWNER_DECISION_SESSION_SLOT_INTENSITY_2026_08_06 (OD-SLOT-1~7)
issued_date: "2026-08-06"
status: ABSORBED_INTO_FULL_RUN
base_commit: "같은 PR의 S-1 커밋 위 — 별도 PR 머지를 기다리지 않는다"
implementation_branch: codex/slot-intensity-full-run   # 통합 지시서와 같은 브랜치. 별도 브랜치를 만들지 마라
scope: engine_only (@impl 생성기)
prohibited_scope: [저장 관문(S-3), 화면 문구(S-4), 수정·확정 플로우(OD-SLOT-6), safety-gate, memo-safety]
# ↑ "S-2 커밋 하나 안에서 건드리지 말 범위"를 뜻한다. S-3·S-4는 같은 PR의 다음 커밋에서 진행한다
required_report: reports/review/WORK_ORDER_SLOT_INTENSITY_FULL_RUN_REPORT.md   # 보고서는 통합 1건으로 쓴다
depends_on: "S-1 (WORK_ORDER_TRAINING_TIME_QUESTION_C3A0.md) — 같은 PR의 앞 커밋"
revised_at: "2026-08-06"
```

> ## ⚠️ 2026-08-06 개정 — 이 문서의 §3이 바뀌었다
>
> 최초 발행 시 이 지시서의 §3은 **"입력에 훈련 시간대 정보가 없으므로
> 생성기는 오후를 고를 수 없다"**를 전제로 했다.
>
> 오너가 **"주로 언제 훈련하세요 넣자"**로 시간대 문항 추가를 승인했다
> ([`WORK_ORDER_TRAINING_TIME_QUESTION_C3A0.md`](WORK_ORDER_TRAINING_TIME_QUESTION_C3A0.md)).
> **그 전제는 폐기됐다.** `qualitySlotFor()`는 이제 실제로 슬롯을 결정한다.
>
> **㉢-a0이 머지되기 전에는 이 작업을 시작하지 마라.** 시작하면
> `profile.trainingTimePreference`가 존재하지 않아 타입 오류가 난다.

> ## 📦 2026-08-06 — 이 지시서는 통합 지시서에 흡수됐다
>
> 오너가 **중간 리뷰 없이 연속 수행**을 지시해
> [`WORK_ORDER_SLOT_INTENSITY_FULL_RUN.md`](WORK_ORDER_SLOT_INTENSITY_FULL_RUN.md)
> **S-2단계**로 흡수됐다.
>
> **작업자는 통합 지시서를 먼저 읽어라.** 이 문서는 **세부 좌표·코드 예시의
> 참조용**으로 계속 유효하다. 다만 **순서·경계·정지 조건은 통합 지시서가 이긴다.**
> 이 문서를 단독으로 수행하지 마라.

---

> **먼저 읽을 것 (순서대로).**
> 1. [`OWNER_DECISION_SESSION_SLOT_INTENSITY_2026_08_06.md`](OWNER_DECISION_SESSION_SLOT_INTENSITY_2026_08_06.md) — 전부
> 2. [`AGENTS.md`](AGENTS.md) §5(비공허성·`npx tsc` 금지), §7(판단 보류)
> 3. `WORK_ORDER_SLOT_TYPE_EXTENSION_B.md` 최상단 폐기 경고 블록
>
> 이 작업은 **안전 규칙을 푸는 방향**이다. 코드를 보다 보면 "이건 위험한데"
> 싶은 순간이 온다. 그때 되돌리지 마라. 오너가 "오후애 고강도 매우자주해"라고
> 확인했다. 판단이 서지 않으면 멈추고 물어라.

---

## 1. 이 작업이 하는 일 (한 문장)

**계획 생성기가 고강도를 오전에만 만들던 것을 멈추고, 오후에도 만들 수 있게 하며,
고강도가 있는 날의 반대 슬롯에 가벼운 훈련을 붙인다.**

## 2. 하지 않는 일

| 안 함 | 이유 / 담당 |
|---|---|
| 저장 관문(`app/src/domain/plan-beta-schema.ts`) 수정 | **㉢-b** — 이번엔 손대지 않는다 |
| 화면 문구(`PlanIntake.tsx:201` 등) 수정 | **㉢-c** — 런타임이 바뀐 뒤에만 |
| 하루 2회 고강도 생성 | **OD-SLOT-6** — 지정 입구가 없다. §5 참조 |
| `movePlanSession` / 이동 연산 | 별도 작업 |
| `rpeForIntent()` 숫자 변경 | **OD-SLOT-5 — 절대 금지.** §4.2 |
| 새 role 추가 | **OD-SLOT-4 — 절대 금지.** `REST`/`EASY`/`QUALITY` 3종 유지 |

---

## 3. 선행 작업이 넘겨주는 것 — 착수 전 반드시 읽기

㉢-a0(C3A0)이 끝나면 `PlanProfile`에 아래 필드가 들어온다.

`impl/src/plan-generator/types.ts`:
```ts
readonly availableTrainingDays: readonly number[]      // 며칠에 하는지
readonly secondSessionMode: SecondSessionMode           // 하루 1번/2번
readonly trainingTimePreference: TrainingTimePreference // ← 신규. "MORNING" | "EVENING" | "VARIES"
```

**착수 전 확인:** `impl/src/plan-generator/types.ts`에 `trainingTimePreference`가
실제로 있는지 눈으로 봐라. 없으면 ㉢-a0이 아직 안 끝난 것이다. **멈춰라.**

### 값 → 슬롯 대응 규칙

| `trainingTimePreference` | 고강도 슬롯 | 근거 |
|---|---|---|
| `MORNING` | `AM` | 선수가 오전에 훈련한다고 답했다 |
| `EVENING` | `PM` | **OD-SLOT-1.** 오후 고강도는 이 종목의 정상 관행이다 |
| `VARIES` | `AM` | 아래 설명 |

**`VARIES`가 `AM`인 이유 (오너 확인 대기 항목).**
"그때그때 다르다"는 **오후를 원한다는 뜻이 아니다.** 정보가 없다는 뜻이다.
정보가 없을 때 현행 동작(AM)을 유지하는 것은 변경 폭을 줄인다.
사용자가 오후를 원하면 `EVENING`을 고르거나, 나중에 수정 플로우(OD-SLOT-6)에서 옮긴다.

> 이 한 줄은 오너에게 확인 중이다. **바꾸라는 지시가 오면 이 함수 한 곳만 고치면 된다.**
> 임의로 다른 규칙(예: 홀수날 AM / 짝수날 PM)을 넣지 마라.

### 이 작업의 범위

| 함 | 안 함 |
|---|---|
| `trainingTimePreference`를 읽어 고강도 슬롯을 **결정**한다 | 그 값을 입력받는 화면·스키마 (㉢-a0에서 끝났다) |
| 고강도 날의 반대 슬롯에 가벼운 훈련을 붙인다 | 저장 관문 수정 (㉢-b) |
| `EVENING` 사용자에게 실제로 PM 고강도를 만든다 | 하루 2회 고강도 (§5) |

---

## 4. 할 일

### 4.1 슬롯 결정을 함수로 분리한다 (C-1)

**현재** `impl/src/plan-generator/session-builder.ts:205-211`:
```ts
    if (qualityDays.has(day)) {
      sessions.push(qualityTrainingSession(
        day,
        ranges.quality,
        qualityIntentFor(input.request),
      ))                                  // ← slot 인자 없음 = 언제나 "AM"
      continue
    }
```

**목표** — 슬롯을 정하는 책임을 이름 있는 함수로 꺼낸다.

```ts
/**
 * 고강도 세션을 어느 슬롯에 둘지 정한다.
 *
 * OD-SLOT-1: 오전 고정은 금지다. 오후 고강도는 이 종목의 정상 관행이다.
 * 선수가 계획 질문에서 답한 훈련 시간대(㉢-a0에서 추가)를 그대로 따른다.
 *
 * VARIES(그때그때 다름)는 "오후를 원한다"가 아니라 "정보가 없다"이므로
 * 현행 동작인 AM을 유지한다. 사용자는 수정 플로우(OD-SLOT-6)에서 옮길 수 있다.
 *
 * 규칙을 바꿔야 하면 이 함수 하나만 고친다. 호출부에 조건을 흩뿌리지 마라.
 */
function qualitySlotFor(input: CandidateSessionBuildInput, day: number): PlanSessionSlot {
  switch (input.request.profile.trainingTimePreference) {
    case "EVENING":
      return "PM"
    case "MORNING":
    case "VARIES":
      return "AM"
  }
}
```

> **`default:`를 쓰지 마라.** 위처럼 모든 경우를 나열하면, 나중에 값이
> 하나 더 늘었을 때 **타입체커가 여기서 잡아준다.** `default`를 넣으면
> 조용히 AM으로 처리되고 아무도 모른다.
>
> **`day` 인자를 슬롯 결정에 쓰지 마라.** 날짜로 슬롯을 흔드는 것은
> 선수가 요청하지 않은 배치다. 인자는 향후 확장을 위해 받아만 둔다.

호출부:
```ts
    if (qualityDays.has(day)) {
      const slot = qualitySlotFor(input, day)
      sessions.push(qualityTrainingSession(
        day, ranges.quality, qualityIntentFor(input.request), slot,
      ))
      sessions.push(...counterpartSessions(input, day, slot, ranges))   // ← 4.2
      continue
    }
```

이 작업 후 **`EVENING`을 고른 사용자는 실제로 오후 고강도를 받는다.**
그게 눈에 보이는 동작 변경이다. `MORNING`·`VARIES` 사용자의 결과는 현행과 같다.

### 4.2 고강도 날의 반대 슬롯에 가벼운 훈련을 붙인다 (C-2·C-3)

**이것이 이번 작업의 실질적 동작 변경이다.**

**현재 문제** — `recoverySecondSessionDays()`(`:152-174`)가 `qualityDays`를 **제외**한다:
```ts
  const eligibleDays = input.request.profile.availableTrainingDays.filter(
    (day) => !qualityDays.has(day),      // ← 고강도 날엔 두 번째 세션이 아예 안 생김
  )
```
그래서 고강도 날은 하루 1세션으로 끝난다. **OD-SLOT-2 위반이다.**

**목표** — 고강도 날에도 반대 슬롯에 가벼운 훈련을 만든다.

```ts
/**
 * 고강도가 배치된 날의 반대 슬롯 세션.
 *
 * OD-SLOT-2: 고강도가 한 슬롯에 있으면 반대쪽은 가벼운 훈련 또는 능동적 휴식.
 * OD-SLOT-4: 능동적 휴식에 새 role을 만들지 않는다. EASY로 표현한다.
 * OD-SLOT-7: 권장은 휴식/회복운동이므로 RECOVERY_INTENT를 기본으로 쓴다.
 *            단 이것은 "권장"이지 강제가 아니다 — 다른 값을 거부하지 않는다.
 *
 * 사용자가 하루 두 번을 원하지 않으면(SINGLE_SESSION_ONLY) 만들지 않는다.
 */
function counterpartSessions(
  input: CandidateSessionBuildInput,
  day: number,
  qualitySlot: PlanSessionSlot,
  ranges: ...,
): readonly PlanSession[] {
  if (input.request.profile.secondSessionMode !== "RECOVERY_PM_ALLOWED") return []
  const other: PlanSessionSlot = qualitySlot === "AM" ? "PM" : "AM"
  return [easyTrainingSession(day, other, ranges.recoverySupport, "RECOVERY_INTENT")]
}
```

**주의 3가지:**

1. **`secondSessionMode`를 반드시 존중한다.** "하루 한 번"을 고른 사용자에게
   두 번째 세션을 만들어 주면 그건 동의 없는 추가다. 지금 저장 관문
   (`plan-beta-schema.ts:92-94`)도 이걸 거부한다.
2. **`recoverySecondSessionDays()`의 `limit = 2`는 고강도 날에 적용하지 않는다.**
   그 상한은 "고강도 없는 날에 회복 2부를 몇 번 넣을까"의 상한이다.
   고강도 날의 반대 슬롯은 별개 규칙(OD-SLOT-2)이다. **두 로직을 섞지 마라.**
3. **`RECOVERY_INTENT`를 쓰므로 RPE는 1-2가 된다** (`rpeForIntent`). 이건
   OD-SLOT-5(범위 현행 유지)와 OD-SLOT-7(권장은 휴식/회복운동)에 동시에 맞는다.
   **숫자를 직접 쓰지 말고 반드시 `rpeForIntent()`를 거쳐라.**

### 4.3 저장 관문과 충돌한다 — 이번엔 고치지 말고 기록하라

4.2를 구현하면 생성 결과가 **현재 저장 관문에 걸린다.**

`app/src/domain/plan-beta-schema.ts:108-113`:
```ts
    if (
      sessions.some((session) => session.slot === "PM")
      && sessions.some((session) => session.role === "QUALITY")
    ) {
      addIssue(context, ["activePlan", "sessions"], "PM recovery cannot follow quality.")
    }
```
→ 같은 날 QUALITY(AM) + EASY(PM)은 **거부된다.** 이게 C-5다.

**S-2 커밋 안에서는 이 검사를 고치지 마라. S-3 커밋의 일이다.**
**단, PR은 나누지 않는다** — 통합 지시서 §1 참조.

대신 S-2 커밋에서는:
- 생성기 계약 테스트로 **생성 결과가 OD-SLOT-2를 만족함**을 고정한다 (impl 안에서)
- 저장 관문에 걸린다는 사실을 **보고서에 명시**한다
- app 쪽 저장 경로 테스트를 새로 만들지 않는다 (S-3에서 열린 뒤 만든다)

> ## 🔴 2026-08-06 정정 — 여기서 말하는 분리는 **커밋 분리**다
>
> 최초 발행 시 이 자리에는 *"생성기와 저장 관문을 같은 PR에서 바꾸지 마라"*가
> 적혀 있었다. **그 지시는 철회됐다.**
>
> 근거는 "같이 바꾸면 테스트 통과가 둘 다 맞아서인지 둘 다 틀려서인지 모른다"였고
> 검증 논리로는 옳다. 그러나 **배포 결과를 계산하지 않았다.** S-2만 병합하면
> 생성된 오후 계획이 저장 관문에서 거부되고(`PLAN_STORAGE_WRITE_FAILED`),
> 사용자는 `"계획을 이 기기에 저장하지 못했어요"`를 본다. `main` push는
> 자동 배포이므로 **깨진 상태가 그대로 나간다.**
>
> **따라서 S-2와 S-3은 커밋을 분리하되 같은 PR에 실린다.**
> 원래의 검증 의도(원인 분리)는 커밋 경계 + 단계별 테스트로 지킨다.
> → `OWNER_DECISION_SESSION_SLOT_INTENSITY_2026_08_06.md` §4.9

---

## 5. 하루 2회 고강도는 만들지 않는다

OD-SLOT-3은 "사용자가 직접 지정하지 않는 한 하루 1회"다.
**지정할 입구(OD-SLOT-6 수정·확정 플로우)가 아직 없다.**
입구가 없으므로 지정도 없고, 따라서 생성기는 하루 1회만 만든다.

이는 오너 결정의 기본값과 일치하므로 **중간 상태로 안전하다.**
"나중에 필요하니 미리 만들어 두자"는 하지 마라. 지정 경로 없이 2회를 만들면
사용자가 요청하지 않은 고강도를 주는 것이 된다.

---

## 6. 검증 (전부 필수)

### 6.1 계약 테스트

`impl/test/`에 아래를 고정한다. **이름을 명확히 써라** — 실패했을 때 이름만 보고
무엇이 깨졌는지 알 수 있어야 한다.

| 테스트 | 고정할 것 |
|---|---|
| T-A 🔴 | `trainingTimePreference: "EVENING"`이면 고강도 세션의 슬롯이 `PM`이다 (OD-SLOT-1) |
| T-A2 | `"MORNING"`이면 `AM`, `"VARIES"`면 `AM` |
| T-B | `RECOVERY_PM_ALLOWED`일 때, 고강도 날에 반대 슬롯 `EASY` 세션이 생긴다 (OD-SLOT-2) |
| T-B2 🔴 | `EVENING` + `RECOVERY_PM_ALLOWED`이면 반대 슬롯이 `AM`이다 (`PM` 고정이 아님) |
| T-C | `SINGLE_SESSION_ONLY`일 때, 고강도 날에 반대 슬롯 세션이 생기지 **않는다** |
| T-D | 반대 슬롯 세션의 RPE가 `rpeForIntent("RECOVERY_INTENT")`와 같다 (숫자 직접 비교 금지) |
| T-E | 같은 `(day, slot)` 쌍이 중복 생성되지 않는다 (DSB-INV-004는 유효) |
| T-F | 하루에 `QUALITY`가 2개 생기지 않는다 (OD-SLOT-3 기본값) |
| T-G | `MORNING`/`VARIES` 사용자의 생성 결과가 ㉢-a0 시점과 동일하다 (회귀 없음) |

> **T-B2가 왜 🔴인가.** `counterpartSessions()`에서 `"PM"`을 리터럴로 쓰기
> 쉽다. 그러면 `EVENING` 사용자는 PM에 고강도와 회복이 겹쳐 쌓인다.
> 반드시 `qualitySlot`의 반대편을 계산해서 써라.

### 6.2 비공허성 증명 — 결함 주입 (AGENTS.md §5)

**각 테스트마다** 대응 결함을 넣고 **이름으로** 실패하는지 확인한다.

```bash
# 예: T-B
#   counterpartSessions가 [] 를 돌려주게 고친다
#   → T-B만 이름으로 실패해야 한다
#   → 되돌린다
git status --porcelain      # 비어 있어야 한다
```

**결함을 넣어도 통과하는 테스트는 지운다.** 고치지 말고 지운다.

### 6.3 타입체크 — `npx tsc` 금지

```bash
# ✗ 절대 하지 않는다 (무관한 tsc@2.0.4가 받아져 exit 0을 준다)
cd impl && npx tsc --noEmit

# ✓ 둘 중 하나
cd impl && npm ci && npm run typecheck
cd impl && ./node_modules/.bin/tsc --noEmit
```

출력에 `src/`로 시작하는 오류가 **0건**이어야 한다.

### 6.4 회귀

```bash
cd impl && npx vitest run          # 14파일 127건 전부 통과
cd app  && npx vitest run          # 기준선 대비 신규 실패 0건
```

app 스위트는 샌드박스(Node 20)에서 24건이 원래 실패한다. **개수가 아니라 이름을 비교하라.**

---

## 7. 보고서

`reports/review/WORK_ORDER_PM_QUALITY_GENERATOR_C3A_REPORT.md`에 아래를 담는다.

1. T-A~T-F 각각의 **결함 주입 내용과 실패한 테스트 이름**
2. `./node_modules/.bin/tsc` 출력 (`npx tsc` 결과는 인정하지 않는다)
3. impl/app 테스트 수치
4. **생성 결과가 현재 저장 관문에 걸리는 지점** — C-5 재현 로그
5. `EVENING` 사용자에게 실제로 PM 고강도가 생긴 생성 결과 실물
6. 판단 보류 항목 (있으면)

---

## 8. 커밋 규칙

- 브랜치 `codex/pm-quality-generator-c3a`, 베이스는 **㉢-a0 머지 후의 `main`**
- **커밋마다 푸시.** 샌드박스가 리셋되면 잃는다
- PR 본문에 §7 보고서 요약
- `main` 직접 푸시 금지

---

## 9. 이 작업에서 하기 쉬운 실수 (미리 읽어라)

| 실수 | 왜 문제인가 |
|---|---|
| `qualitySlotFor()`가 `day % 2`처럼 임의로 오후를 고르게 함 | 선수가 요청하지 않은 배치다. `trainingTimePreference`만 근거다 |
| `qualitySlotFor()`에 `default:` 절을 넣음 | 값이 늘었을 때 타입체커가 못 잡는다 (§4.1) |
| `counterpartSessions()`에서 `"PM"`을 리터럴로 씀 | `EVENING` 사용자는 PM에 고강도+회복이 겹친다 (T-B2) |
| `VARIES`를 `PM`으로 처리 | "정보 없음"을 "오후 원함"으로 바꿔 읽은 것 |
| ㉢-a0 머지 전에 착수 | `trainingTimePreference`가 없어 타입 오류 |
| RPE를 `{ minimum: 1, maximum: 2 }`로 직접 씀 | OD-SLOT-5 위반 위험. `rpeForIntent()`를 거쳐라 |
| "능동적 휴식"을 위해 새 role 추가 | **OD-SLOT-4 정면 위반** |
| 저장 관문 C-5를 같이 고침 | ㉢-b 범위. 섞으면 검증이 흐려진다 |
| `recoverySecondSessionDays`의 `limit = 2`를 고강도 날에도 적용 | 다른 규칙이다. 섞지 마라 |
| `secondSessionMode`를 무시하고 반대 슬롯 생성 | 동의 없는 세션 추가 |
| 테스트가 통과했으니 됐다고 판단 | 결함 주입 전엔 아무것도 증명되지 않았다 |
| `npx tsc`가 통과했다고 보고 | 그건 TypeScript가 아니다 (§6.3) |

---

**이 제품은 사람의 훈련과 몸을 다룬다. 판단이 서지 않으면 멈추고 물어라.**
