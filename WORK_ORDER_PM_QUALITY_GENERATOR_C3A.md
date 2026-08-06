# WORK_ORDER_PM_QUALITY_GENERATOR_C3A.md

```yaml
doc_id: TRAINORACLE_WORK_ORDER_PM_QUALITY_GENERATOR_C3A
title: "㉢-a 생성기 — 오전 고정 해제와 반대 슬롯 가벼운 훈련"
issued_by: OWNER_DECISION_SESSION_SLOT_INTENSITY_2026_08_06 (OD-SLOT-1~7)
issued_date: "2026-08-06"
status: ISSUED
base_commit: e639eae
implementation_branch: codex/pm-quality-generator-c3a
scope: engine_only (@impl 생성기)
prohibited_scope: [저장 관문(㉢-b), 화면 문구(㉢-c), 수정·확정 플로우(OD-SLOT-6), safety-gate, memo-safety]
required_report: reports/review/WORK_ORDER_PM_QUALITY_GENERATOR_C3A_REPORT.md
```

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

## 3. ⚠️ 먼저 결정해야 할 것 — 착수 전 반드시 읽기

**입력 어디에도 "이 선수가 언제 훈련하는지"를 묻지 않는다.** 실측했다.

`impl/src/plan-generator/types.ts:177-178`:
```ts
readonly availableTrainingDays: readonly number[]   // 며칠에 하는지만
readonly secondSessionMode: SecondSessionMode        // 하루 1번/2번만
```

`app/src/screens/plan-beta/PlanIntake.tsx` 6문항 — 종목 / 경험 / 강도의도 / 가능일수 /
하루 몇 번 / 통증여부. **시간대를 묻는 질문이 없다.**

즉 생성기는 "이 선수가 오후에 훈련한다"는 정보를 **가지고 있지 않다.**
결정적(deterministic) 생성이라는 제약도 있어서 임의로 섞을 수도 없다.

### 그래서 이 작업의 정확한 범위

| 할 수 있는 것 | 할 수 없는 것 |
|---|---|
| 고강도가 **오후에 놓일 수 있는 구조**를 만든다 | 어느 선수의 고강도를 오후로 **결정**한다 |
| 슬롯을 결정하는 **함수 1개**를 분리해 만든다 | 그 함수가 입력 없이 오후를 고르게 한다 |
| 고강도 날의 반대 슬롯에 가벼운 훈련을 붙인다 | 시간대 질문을 새로 만든다 (범위 밖) |

**핵심:** 이번 작업 후에도 기본 생성 결과는 여전히 고강도가 AM일 수 있다.
그건 실패가 아니다. **"AM으로 하드코딩돼 있음"과 "AM으로 결정됨"은 다르다.**
전자를 후자로 바꾸는 것이 이 작업이다.

> **판단 보류 후보:** 시간대를 묻는 질문(7번째 문항)을 추가할지는 오너 결정이다.
> 이 작업지시서에 포함하지 않았다. 필요하다고 판단되면 **구현하지 말고 보고**하라.

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
 * 다만 현재 입력(PlanIntake 6문항)은 선수의 훈련 시간대를 묻지 않는다.
 * 근거 없이 오후로 옮기면 그건 결정이 아니라 추측이다.
 *
 * 그래서 지금은 AM을 돌려준다. 하드코딩이 아니라 "정보가 없어서 내린 기본값"이다.
 * 시간대 입력이 생기거나(오너 결정 대기) 사용자가 수정 플로우(OD-SLOT-6)에서
 * 직접 옮기면, 이 함수 하나만 고치면 된다.
 */
function qualitySlotFor(input: CandidateSessionBuildInput, day: number): PlanSessionSlot {
  return "AM"
}
```

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

**이 함수가 지금 `"AM"`을 돌려준다고 해서 작업이 무의미한 것이 아니다.**
지금은 `PlanSession` 리터럴 안에 박혀 있어서 바꿀 지점이 없다.
분리하면 바꿀 지점이 생긴다. 그게 이번 작업의 산출물이다.

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

**이번 작업에서 이 검사를 고치지 마라. ㉢-b의 일이다.**

대신:
- 생성기 계약 테스트로 **생성 결과가 OD-SLOT-2를 만족함**을 고정한다 (impl 안에서)
- 저장 관문에 걸린다는 사실을 **보고서에 명시**한다
- app 쪽 저장 경로 테스트를 새로 만들지 않는다 (걸릴 것을 알고 있으므로)

> **왜 한 번에 안 고치나.** 생성기와 저장 관문을 같은 PR에서 바꾸면,
> 테스트가 통과했을 때 그게 "둘 다 맞아서"인지 "둘 다 같이 틀려서"인지
> 구분할 수 없다. 생성기를 먼저 고정하고, 그 결과를 근거로 관문을 연다.

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
| T-A | 고강도 세션의 슬롯이 `qualitySlotFor()`가 돌려준 값과 같다 (리터럴 하드코딩이 아님) |
| T-B | `RECOVERY_PM_ALLOWED`일 때, 고강도 날에 반대 슬롯 `EASY` 세션이 생긴다 (OD-SLOT-2) |
| T-C | `SINGLE_SESSION_ONLY`일 때, 고강도 날에 반대 슬롯 세션이 생기지 **않는다** |
| T-D | 반대 슬롯 세션의 RPE가 `rpeForIntent("RECOVERY_INTENT")`와 같다 (숫자 직접 비교 금지) |
| T-E | 같은 `(day, slot)` 쌍이 중복 생성되지 않는다 (DSB-INV-004는 유효) |
| T-F | 하루에 `QUALITY`가 2개 생기지 않는다 (OD-SLOT-3 기본값) |

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
5. `qualitySlotFor()`가 여전히 `"AM"`을 돌려준다는 사실과 그 이유
6. 판단 보류 항목 (있으면)

---

## 8. 커밋 규칙

- 브랜치 `codex/pm-quality-generator-c3a`, 베이스 `e639eae`
- **커밋마다 푸시.** 샌드박스가 리셋되면 잃는다
- PR 본문에 §7 보고서 요약
- `main` 직접 푸시 금지

---

## 9. 이 작업에서 하기 쉬운 실수 (미리 읽어라)

| 실수 | 왜 문제인가 |
|---|---|
| `qualitySlotFor()`가 `day % 2`처럼 임의로 오후를 고르게 함 | 근거 없는 배치다. 입력에 시간대 정보가 없다 |
| RPE를 `{ minimum: 1, maximum: 2 }`로 직접 씀 | OD-SLOT-5 위반 위험. `rpeForIntent()`를 거쳐라 |
| "능동적 휴식"을 위해 새 role 추가 | **OD-SLOT-4 정면 위반** |
| 저장 관문 C-5를 같이 고침 | ㉢-b 범위. 섞으면 검증이 흐려진다 |
| `recoverySecondSessionDays`의 `limit = 2`를 고강도 날에도 적용 | 다른 규칙이다. 섞지 마라 |
| `secondSessionMode`를 무시하고 반대 슬롯 생성 | 동의 없는 세션 추가 |
| 테스트가 통과했으니 됐다고 판단 | 결함 주입 전엔 아무것도 증명되지 않았다 |
| `npx tsc`가 통과했다고 보고 | 그건 TypeScript가 아니다 (§6.3) |

---

**이 제품은 사람의 훈련과 몸을 다룬다. 판단이 서지 않으면 멈추고 물어라.**
