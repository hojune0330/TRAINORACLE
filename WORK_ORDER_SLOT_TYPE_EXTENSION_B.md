# WORK_ORDER_SLOT_TYPE_EXTENSION_B — QUALITY·REST의 PM/자유 슬롯 이동을 위한 엔진 타입 확장

```yaml
doc_id: TRAINORACLE_WORK_ORDER_SLOT_TYPE_EXTENSION_B
title: "B 확장 엔진 작업지시서 — 세션 슬롯 타입 확장 (QUALITY·REST PM 허용)"
issued_by: UX2 §8-10 오너 결정 (2026-08-04 확정: 경로 B)
issued_date: "2026-08-05"
status: 구현 완료 — C-7 철회 적용 후 리뷰 대기 (2026-08-06, 브랜치 codex/slot-type-extension-b, main a29e5f2 리베이스, 보고서 reports/review/WORK_ORDER_SLOT_TYPE_EXTENSION_B_REPORT.md)
implementation_branch: codex/slot-type-extension-b
scope: engine_only (@impl + app 스키마 미러)
prohibited_scope: [safety-gate, memo-safety, 화면 UI 소비(본 문서 범위 밖)]
required_report: reports/review/WORK_ORDER_SLOT_TYPE_EXTENSION_B_REPORT.md
```

---

## 0. 왜 이 지시서가 분리되었나

`WORK_ORDER_UX2_COACH_HOME_AND_JOURNAL_HONESTY.md` §8-10 (2026-08-04 오너 확정 **경로 B**):

> QUALITY·REST도 PM/자유 슬롯 이동 허용 — `session-types.ts` 확장 = **엔진 타입 작업** —
> **별도 엔진 작업지시서로 분리 제출**, 본 문서 UI는 결과 소비만.

본 문서(UI 수정)는 확장 결과를 **소비만** 한다. 확장 자체는 이 작업지시서가 소유한다.
UI 작업(롱프레스 드래그·캘린더 그리드)은 본 문서 범위 밖이며, 확장 머지 전까지
QUALITY/REST 세로 드래그 차단을 유지한다(실패 시 안전한 쪽, NORTH_STAR §3).

> ## ⚠️ 2026-08-06 정정 — 이 문서의 일부는 폐기됐다
>
> 오너가 2026-08-06에 **오전 고정 해제**를 결정했다
> ([`OWNER_DECISION_SESSION_SLOT_INTENSITY_2026_08_06.md`](OWNER_DECISION_SESSION_SLOT_INTENSITY_2026_08_06.md)).
> 이 문서가 전제하던 **"QUALITY는 PM에 생성 금지"는 더 이상 유효하지 않다.**
>
> | 폐기된 부분 | 대체 |
> |---|---|
> | §1-2 "leaf 스키마가 `(day,slot)` 유일성을 거부하도록 유지" | **거짓 전제였다.** leaf는 원래 검사한 적 없다 → 백로그 B-13 |
> | §3 "QUALITY를 PM에 생성하는 신규 후보 생성은 금지, 이동 시에만 허용" | **폐기.** OD-SLOT-1 — 생성 단계부터 PM 배치가 열려야 한다 (㉢-a) |
> | §4 레지스트리의 `DSB-INV-002`·`DSB-INV-003` | **폐기.** 오너 결정이 초안을 이긴다 (결정 문서 §3.3) |
> | 문서 말미 "PM 차단 유지를 보증한다" | **폐기.** 보증 대상이 뒤집혔다 |
>
> **이 문서를 근거로 오후 고강도를 다시 막지 마라.** 후속 작업(㉢-a)은
> 이 문서가 아니라 오너 결정 문서 §5를 따른다. 아래 본문은 2026-08-05 시점의
> 기록으로 보존하되, 위 4개 항목은 실행 지시로 읽지 않는다.

## 1. 절대 준수 규칙

1. **스펙 계승 (§8-12 레지스트리)**: 아래 나열된 스펙 불변식을 위반하면 작업 무효.
   구현 전 해당 조항을 열어 확인하고, 변경이 계약에 걸리면 §8-11 원칙(불변 + append-only +
   fresh validation)으로 후퇴한다.
2. **기존 좌표 유일성 유지**: `DSB-INV-004` — "A beta day has at most one AM and one PM
   session. Each `(day, slot)` pair is unique." 확장 후에도 `(day, slot)` 쌍은 유일해야 한다.
   ~~`plan-session-schema.ts` Zod 스키마가 이를 거부하도록 유지.~~
   **[2026-08-06 정정]** 거짓 전제였다. leaf `planSessionSchema`는 `(day,slot)` 유일성을
   검사한 적이 **없다**. 실제 검사는 저장 관문 `plan-beta-schema.ts:76-79`
   (`"Duplicate plan session slot."`)에만 있다. leaf의 구멍은 **백로그 B-13**으로 분리했다.
   불변식 자체(유일성)는 유효하나, 이 문서가 지목한 강제 지점이 틀렸다.
3. **QUALITY→PM 단독 반영 금지**: QUALITY·REST의 PM 배치는 엔진 타입 허용으로 **열리되**,
   실제 "이동" 반영은 §8-11 **재계획 검증 필수** (FA-TC-014 `:1590` — "Safety changes after
   selection: Immediate `ON_SAFETY_HOLD`; optional replan only after fresh validation").
   이 작업지시서는 **타입 확장만** 만들고 이동 연산·재계획 흐름은 만들지 않는다.
4. **`safety-gate`·`memo-safety` 로직 수정 금지** — UX2 §6·§8-8 명시.
5. **기존 파일 삭제·이동 금지**; 스키마는 backward-compatible로만 확장.
   저장된 `StoredActivePlan`(로컬 localStorage)은 **무단 수정 금지** — 마이그레이션 없이
   신규 타입을 받아들이는 방향으로만.
6. **커밋마다 PR**. main 직접 푸시 금지. 이 작업지시서의 결과는 main 통합 PR로 남긴다
   (샌드박스 휘발성 대비 — 오너 지시).
7. `.omo/evidence/` 하위 파일은 불변 증거물. 수정 금지.

## 2. 바인딩 4종 (2026-08-05 실측 완료 — 라인이 truth)

### B-1. `impl/src/plan-generator/session-types.ts` — `PlanSession` 판별 유니온 슬롯 확장

실측 (파일 전체 65행):

- `:7` `export const PLAN_SESSION_SLOTS = ["AM", "PM"] as const`
- `:23-46` `PlanSession` 판별 유니온:
  - `:24-32` REST — `slot: "AM"` 고정 · `role: "REST"` · `plannedEnergyIntent: "RECOVERY_INTENT"`
  - `:33-39` EASY — `slot: PlanSessionSlot` (이미 AM|PM 자유)
  - `:40-46` **QUALITY — `slot: "AM"` 고정** ← 확장 대상
- REST `:24-32`의 `slot: "AM"` 고정도 **경로 B 대상** (자유 슬롯 허용): `slot: PlanSessionSlot`

**할 일:**
1. QUALITY 변형의 `slot` 리터럴을 `PlanSessionSlot`로 확장.
2. REST 변형의 `slot` 리터럴을 `PlanSessionSlot`로 확장 (경로 B: REST도 PM/자유 슬롯 이동 허용).
3. 변경 시 `assertNever` 기반 판별(`session-builder.ts`, `generator.ts`, `progress.ts`의
   `session.slot` switch)이 컴파일 에러로 드러나는 곳을 모두 확인 — **전부 수정 필요**.
   실측: `generator.ts:83-92`이 `request.formation.slots`로, `session.slot` 직접 switch는
   `candidates.ts` 등의 프레임 생성에 제한적. 수정 후 `npm run typecheck`(impl)로 전수 확인.

### B-2. `impl/src/plan-generator/session-builder.ts` — `recoverySecondSessionDays` + 슬롯 배치

실측:

- `:150-172` `recoverySecondSessionDays` — `const limit = 2` (PM 2부 일수 ≤2 상한) 유지.
  균등 분배: `eligibleDays[Math.floor((index * eligibleDays.length) / (limit + 1))]`.
- `:190-224` `makeCandidateSessions` — `day: 1..10` 루프:
  - `:203-210` QUALITY 데이 → `qualityTrainingSession(day, ranges.quality, intent)` — 슬롯 AM 고정
  - `:212-220` EASY 데이 → AM 세션 + `recoverySecondDays`에 있으면 PM `RECOVERY_INTENT` 세션

**할 일:**
1. `qualityTrainingSession`(`:132-148`)의 `slot: "AM"` 고정을 파라미터화:
   시그니처에 `slot: "AM" | "PM"` 추가. **본 작업지시서 범위에서는 기본 생성 AM 유지**
   (타입만 여는 것이 이 문서의 범위이기 때문이다).

   > **[2026-08-06 정정]** 원문에는 `DSB-INV-002`를 근거로
   > "QUALITY를 PM에 생성하는 신규 후보 생성은 **금지**, 이동 시에만 허용"이라고
   > 적혀 있었다. **이 금지는 폐기됐다.** 오너 결정 OD-SLOT-1이 오전 고정을 해제했다.
   >
   > 여기서 AM 기본을 유지하는 이유는 "PM 생성이 금지라서"가 **아니라**,
   > 이 작업지시서의 범위가 타입 확장까지이기 때문이다. 생성기가 실제로 오후 고강도를
   > 만들게 하는 것은 **㉢-a**의 일이다 (결정 문서 §5 단계 2).
2. `recoverySecondSessionDays`의 `limit = 2` 상한은 **유지** (재계획 검증 시 PM 2부 일수 ≤2
   검사에 사용 — `:163`).
3. `restSession`(`:63-71`)의 `slot: "AM"` 고정은 타입과 함께 `PlanSessionSlot`로 확장하되,
   **생성 로직은 AM만 사용** (REST PM은 이동 소비 전용).

### B-3. `app/src/domain/plan-session-schema.ts` — `activePlanSchema` 미러 (Zod)

실측:

- `:12` `sessionSlotSchema = z.enum(["AM", "PM"])`
- `:94-122` `planSessionSchema = z.discriminatedUnion("role", [...])`:
  - `:95-101` REST — `slot: z.literal("AM").optional().default("AM")` ← 확장 대상
  - `:109-121` QUALITY — `slot: z.literal("AM").optional().default("AM")` ← 확장 대상

**할 일:**
1. REST·QUALITY 변형의 `slot`을 `sessionSlotSchema.optional().default("AM")`로 교체
   (EASY `:104`와 동일 패턴 — 기존 저장값은 default resolution으로 호환).
2. `StoredActivePlan` 로드/저장 경로(`plan-beta-store.ts` → `parsePlanBetaState`)가
   신규 슬롯 값을 받아들이는지 확인: `plan-beta-schema.ts`의 `parsePlanBetaState`가
   `activePlanSchema`를 사용한다면 자동 반영. 계약 테스트 1건 추가:
   `slot: "PM"` QUALITY 세션을 가진 activePlan을 파싱해도 rejected되지 않음.

### B-4. `impl/src/plan-generator/progress.ts` + `app/src/domain/plan-beta-store.ts` — 허용 좌표 / upsert

실측:

- `progress.ts:18-42` `recordPlanProgress` — `activePlan.sessions.some(day)` → `SESSION_DAY_NOT_IN_ACTIVE_PLAN` rejected;
  `activePlan.sessions.some(day && slot)` → `SESSION_SLOT_NOT_IN_ACTIVE_PLAN` rejected.
  **이 함수는 종료 후 상태 기록용이다 — 이동용 재사용 금지 (UX2 §8-3 V1).**
- `plan-beta-store.ts:73-90` `updateStoredProgress` — 동일 `(sessionDay, sessionSlot)`의
  기존 진행 기록을 **filter로 제거 후 upsert** → 이동으로 좌표가 겹치면 기존 기록이
  **덮어써 소실·오배치**된다. **이 함수로 이동을 구현하지 않는다.**

**할 일 (이 작업지시서 범위):**
1. 타입 확장 후 `progress.ts`의 좌표 검사가 신규 슬롯 값(PM QUALITY 등)을 자연스럽게
   받도록: `session.slot` 타입이 `PlanSessionSlot`로 넓어진 뒤 컴파일 확인 + 계약 테스트.
2. **`movePlanSession(activePlan, from, to)` 전용 도메인 연산은 이 작업지시서의 B-4가
   아니다** — §8-11 UI 작업지시서(후속)가 `StoredPlanProgress` 재키잉 무손실 규칙과 함께
   소유한다. 본 문서는 **타입 확장까지만** 선언하고, upsert 재사용 금지를 명시한다.
3. `plan-beta-store.ts:73-90`는 **수정하지 않는다** (이동 연산 도입 시에만 재검토).

## 3. §8-11 재계획 계약 참조 (UI 후속 작업지시서가 소비할 엔진 계약 — 본문서는 타입만)

후속 UI(이동 + 재계획)가 사용할 엔진 계약을 실측으로 고정해 둔다 (2026-08-05 검증):

| 계약 | 실측 위치 | 내용 |
|---|---|---|
| `generatePlanCandidates` 재호출 계열 | `app/src/domain/plan-beta-flow.ts:88-120` | 생성 입력에 `sessionDay`·`sessionSlot` 가용성 컨텍스트 포함 가능 |
| `PREVIOUS_FRAME_CONTEXT_RETAINED` | `impl/src/plan-generator/candidates.ts:27,90` | 프레임 컨텍스트 승계 — 재계획 시 연속성 |
| `PREVIOUS_FRAME_CONTEXT_RETAINED` | `impl/src/plan-generator/types.ts:102,159` | 타입 정의 |
| stale fingerprint | `impl/src/plan-generator/selection.ts:104,135,143,150` | `NONCANONICAL_CANDIDATE_FRAME`/`STALE_CANDIDATE_FINGERPRINT` — 재선택 필요 |
| 결정적 2/3 옵션 | `specs/reconstruct/TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md:1577` (FA-TC-001) | BALANCED+CONSERVATIVE 안정 순서 |
| 재계획 fresh validation | 동 스펙 `:1590` (FA-TC-014) | ON_SAFETY_HOLD → fresh validation 후 선택적 재계획 |
| 프레임 불변 | 동 스펙 `:1596` (FA-TC-020) | 선행 프레임 불변, typed lineage 계승 |
| MAIN 이동 제약 | 동 스펙 `:1639` (FA-TC-063) | 취약성 위반 시 infeasible, 후보 생성 금지 |

## 4. 스펙 계승 레지스트리 (본 작업지시서가 위반할 수 없는 조항 — §8-12)

| 스펙 | 위치 | 본 작업이 지키는 불변식 |
|---|---|---|
| `DOUBLE_SESSION_BETA_SAFETY_CONTRACT.md` | `specs/reconstruct/` | ~~`DSB-INV-002`(PM은 EASY+RECOVERY_INTENT RPE 1-2만 — QUALITY PM 신규 생성 금지)~~ **폐기 — OD-SLOT-1** · ~~`DSB-INV-003`(QUALITY와 PM 동일 day 배치 금지)~~ **폐기 — OD-SLOT-2** · `DSB-INV-004`((day,slot) 유일) **유효, 단 강제 지점은 저장 관문 (B-13 참조)** |
| `OWNER_DECISION_SESSION_SLOT_INTENSITY_2026_08_06.md` | 루트 | **OD-SLOT-1~7. 위 초안 스펙보다 우선한다.** 오전 고정 금지 · 반대 슬롯은 가벼운 훈련/능동적 휴식 · 하루 고강도 1회 기본 · 새 role 만들지 않음 · RPE 범위 현행 유지 · 권장은 강제가 아님 |
| `PLAN_SAFETY_GATE_SPEC.md` | `specs/reconstruct/` | `:274` ACTIVE→BLOCK, `:275` UNKNOWN→BLOCK_OR_HUMAN_REVIEW, `:281` BLOCK_OR_HUMAN_REVIEW도 `planGenerationAllowed: false` |
| `TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md` | `specs/reconstruct/` | FA-TC-001/014/020/063 (`:1577/:1590/:1596/:1639`) — 이동 단독 반영 금지 |
| `TRAINING_SESSION_PRESCRIPTION_CONTRACT.md` | `specs/reconstruct/` | QUALITY/REST 처방 불변 · 정확한 라벨만 표시 (거짓 라벨 금지) |
| `MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md` | `specs/reconstruct/` | `:219` sessionSlot AM\|PM\|FULL_DAY\|UNSPECIFIED — 네임스페이스 혼용 금지 |
| `PRODUCT_NORTH_STAR.md` | 루트 §3 | 실패 시 안전한 쪽. **단 "안전한 쪽"이 곧 "차단"은 아니다** — 오너 결정(OD-SLOT-1)이 오후 고강도를 정상 훈련 관행으로 확인했으므로, 이를 막는 것은 안전이 아니라 거짓 제약이다 |

## 5. 구현 시나리오 (타입 확장 후 최소 소비 예 — 후속 UI를 위한 준비)

1. `session-types.ts` QUALITY·REST `slot: PlanSessionSlot`
2. `session-builder.ts` `qualityTrainingSession`/`restSession` 파라미터화 (기본 AM 유지)
3. `plan-session-schema.ts` REST·QUALITY `slot: sessionSlotSchema.optional().default("AM")`
4. `progress.ts` 컴파일 확인 (신규 슬롯 값 좌표 검사 통과 계약 테스트)
5. **테스트**: `cd impl && npm test` (계약 표 각 행 ≥1), `cd app && npm test` (스키마 미러),
   `npm run typecheck` 양쪽. 실측: impl은 vitest, app은 vitest+tsc.
6. 보고서: `reports/review/WORK_ORDER_SLOT_TYPE_EXTENSION_B_REPORT.md` —
   기준 main SHA, 변경 파일, 스펙 계승 확인표, 테스트 로그 경로.

## 6. 명시적 비목표 (건드리면 안 되는 것)

- `movePlanSession` 전용 연산 구현 (후속 UI 작업지시서 소유)
- `StoredPlanProgress` 재키잉 / `plan-beta-store.ts` upsert 수정
- 캘린더 그리드·롱프레스 드래그 UI (후속 UI 작업지시서 소유)
- `safety-gate`·`memo-safety` 로직
- 30 DRAFT 템플릿 활성화, Formation 게이트 해제

---

*이 지시서는 UX2 §8-10 경로 B 확정의 엔진 절반이다. UI 절반(§8-3~§8-7, §8-11)은
별도 후속 작업지시서로 분리된다.*

*~~이 문서가 타입 확장 머지 전 기존 QUALITY/REST PM 차단 유지를 보증한다.~~*
***[2026-08-06 정정]** 이 보증은 폐기됐다. 오너 결정 OD-SLOT-1이 PM 차단 자체를
없앴다. 이 문서가 실제로 보증하는 것은 **"타입만 열고 생성기 동작은 바꾸지 않았다"**
뿐이다. 생성기는 ㉢-a에서 바꾼다.*

[구현 완료 2026-08-06 — 리뷰 대기 · 보고서: reports/review/WORK_ORDER_SLOT_TYPE_EXTENSION_B_REPORT.md]
