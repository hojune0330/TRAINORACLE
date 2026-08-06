# WORK_ORDER_SLOT_TYPE_EXTENSION_B 구현 완료 보고 (C-7 철회 반영)

> ⚠️ **2026-08-06 사양 갱신 안내 (본문은 당시 기록이므로 고치지 않았다).**
> 이 문서가 인용한 `DSB-INV-002`(PM은 회복 전용)와 `DSB-INV-003`(같은 날 quality 짝 금지)은
> `specs/reconstruct/DOUBLE_SESSION_BETA_SAFETY_CONTRACT.md` **v0.2에서 은퇴하고 새 규칙으로
> 교체됐다.** 은퇴 원문은 그 문서 §10 변경 이력에 보존돼 있다.
> 아래 본문의 해당 인용은 **당시 시점의 판단 기록**으로 읽고, 현재 지침으로 쓰지 마라.
> 지금 유효한 규칙: 새 `DSB-INV-002`·`DSB-INV-003`·신설 `DSB-INV-009`(OD-SLOT-8).
> 근거: `OWNER_DECISION_SESSION_SLOT_INTENSITY_2026_08_06.md` §3.3, §4.10.

> 작업지시서: `WORK_ORDER_SLOT_TYPE_EXTENSION_B.md` (doc_id: TRAINORACLE_WORK_ORDER_SLOT_TYPE_EXTENSION_B)
> 필수 보고서: `reports/review/WORK_ORDER_SLOT_TYPE_EXTENSION_B_REPORT.md`
> 적용 오너 결정: `OWNER_DECISION_SESSION_SLOT_INTENSITY_2026_08_06.md` (OD-SLOT-1~7, `decision_precedence: LATEST_EXPLICIT_OWNER_DECISION_GOVERNS`)

## 1. 실행 경계

- 작업 브랜치: `codex/slot-type-extension-b` (작업지시서 `implementation_branch`와 일치)
- 기준 main(PR 베이스): `a29e5f2` — `fc44f97` → `518a9aa`(OD-SLOT 문서) → `1ffadd3`(오판 철회 기록 + AGENTS.md tsc 함정) → `a29e5f2`(OD-SLOT-4~7) 리베이스 완료.
- 실행 모델: 현재 어시스턴트 (오너 지시 — 나(B-02 마감 작업)가 구현, Opus가 PR 리뷰)
- 작업 분리: 딥시크 작업(5개 코드/테스트 파일)을 최신 main 위로 이식 + 승인된 B-02 계획 3요소 + **C-7 철회(2026-08-06 OD-SLOT-1)**

## 2. 최종 변경 파일 (5개 — 이식 유지분, 벽 철회 포함)

| 파일 | 최종 내용 | 비고 |
|---|---|---|
| `impl/src/plan-generator/session-types.ts` | REST·QUALITY 변형 `slot: "AM"` → `slot: PlanSessionSlot` (EASY는 원래 자유) | 이식 유지 |
| `impl/src/plan-generator/session-builder.ts` | `restSession(day, slot = "AM")`, `qualityTrainingSession(day, duration, intent, slot = "AM")` — 생성 기본 AM 유지 | 이식 유지 |
| `impl/test/plan-beta-selection.test.ts` | +2건: PM QUALITY 좌표 진행 기록 / 확장 플랜에 없는 슬롯 거부 (`SESSION_SLOT_NOT_IN_ACTIVE_PLAN`) | 이식 유지 |
| `app/src/domain/plan-session-schema.ts` | REST·QUALITY `slot: sessionSlotSchema.optional().default("AM")` — **방어벽 refine은 OD-SLOT-1에 따라 철회** (`52d13a4` 상태와 동일한 leaf) | 이식 유지 + C-7 철회 |
| `app/src/domain/plan-beta-schema.contract.test.ts` | `parsePlanBetaState` import, leaf 테스트 **"accepts QUALITY PM (OD-SLOT-1)"** 복원, 저장 관문 테스트 3건을 **C-4 현행 동작 고정(㉢-b에서 개정 예정) 프레이밍**으로 정리 | 이식 + 철회 반영 |

## 3. C-7 철회 (2026-08-06, 결정 문서 §3.1·§3.3)

### 3.1 무슨 일이 있었나

- ① 2026-08-05: Opus가 "없어진 방어벽(DSB-INV-002)을 다시 세운다"는 권고를 냈고, 내가 이를 구현해 PR #184의 `4fea164`(= face807 리베이스)에 포함시켰다 — QUALITY 변형에 `refine((s) => s.slot !== "PM")`.
- ② 2026-08-06: 오너 결정 OD-SLOT-1("오전 고정 해제 — QUALITY는 AM·PM 어느 슬롯에도 배치 가능, 오전 강제는 결함")이 나오면서 **DSB-INV-002·003이 최신 오너 결정에 대체**됨(결정 문서 metadata `supersedes_draft`, §3.3).
- ③ C-7은 "스키마 차원에서 고강도 PM 배치를 영구 차단"하므로 **OD-SLOT-1 정면 위반** → 결정 문서 §5 진행 순서 1단계 "C-7 철회"에 따라 **leaf refine 제거**.

### 3.2 철회 대상 정확히

- `plan-session-schema.ts` QUALITY 변형 `.refine((session) => session.slot !== "PM")` **1개 제거**
- 계약 테스트 "rejects a QUALITY session in the PM slot (DSB-INV-002)" → **"accepts a QUALITY session in the PM slot (OD-SLOT-1)"로 복원** (`expect(result.success).toBe(true)`)
- 저장 관문 negative 3건은 **제거하지 않음** — 현재 런타임(C-4: PM = EASY+RECOVERY+RPE1-2만, C-5: PM+QUALITY 동일 day 금지)의 **현행 동작을 고정**하는 테스트로 프레이밍만 정정. ㉢-b(진행 순서 3단계)에서 이 관문 자체를 개정할 때 이 테스트들이 함께 바뀐다. 지금 건드리지 않는다(`_docs: ㉢-c 문구는 ㉢-b 이후`).

### 3.3 "막는지 테스트 + 결함 주입"의 지위

벽 존재 기간 중 수행한 비-공허성 증명은 **유효했고 기록이 남는다**:
- GREEN(벽 포함) 7 passed → RED(벽 제거) **정확히 1건만 실패** → GREEN(복원) 재확인.
- 이 증명은 "만약 그 벽을 유지했다면 테스트가 진짜 잡아낸다"는 뜻으로, **벽 자체가 OD-SLOT-1과 충돌해 철회**된 것이지 테스트 방식이 틀렸던 것이 아니다.

## 4. 저장 관문 실측 정정 (Opus 철회 1로 확정)

| 주장 | 실측 | 판정 |
|---|---|---|
| "저장 관문이 열렸다"(2026-08-05 Opus) | `planBetaStateSchema` superRefine(`app/src/domain/plan-beta-schema.ts:70-113`)이 **원래부터** PM 검사 실행 (`Invalid PM recovery support.`, consent, authority, duplicate (day,slot)=DSB-INV-004, day당 ≤2, `PM recovery cannot follow quality.`) | **부정확** — Opus가 2026-08-06 철회 1로 정정 인정(결정 문서 §3.2) |
| 열린 것은 | **leaf 스키마뿐** — QUALITY·REST `slot` 리터럴이 타입 확장 전 `"AM"` 고정 | ✅ |
| 2026-08-05 조치 | leaf에 DSB-INV-002 벽 refine 추가 | ✅ 당시엔 정당 |
| 2026-08-06 조치 | OD-SLOT-1 우선 → **leaf refine 철회**; 저장 관문(C-4/C-5)은 그대로 (㉢-b 대상) | ✅ 현재 상태 |

**B-13 기록용 추가 실측**: `activePlanSchema` leaf의 `sessions` 배열 (`plan-session-schema.ts:160` `z.array(planSessionSchema).readonly()`)에는 (day,slot) 유일성 refine이 **부재** — 저장 관문 superRefine에만 존재(leaf 단독 검증 시 누락). 이번 범위 밖, 백로그 B-13으로 분리. (DSB-INV-004는 OD-SLOT과 충돌하지 않아 유지 — 결정 문서 §3.3)

## 5. 스펙 계승 확인표 (OD-SLOT 최신 오너 결정 우선)

| 불변식 | 지위 | 이 PR의 처리 |
|---|---|---|
| `DSB-INV-002` (PM = EASY+RECOVERY+RPE1-2 전용) | **OD-SLOT-1·7로 대체됨** | leaf refine **철회** (C-7). 저장 관문 C-4는 현행 유지, ㉢-b에서 "PM 무엇이든 + 하루 고강도 1회 기본"으로 개정 예정 (§4.3 표: 하면 되는 것/하면 안 되는 것) |
| `DSB-INV-003` (같은 day QUALITY+PM 금지) | **OD-SLOT-2로 대체됨** | 저장 관문 C-5는 현행 유지, ㉢-b 대상. OD-SLOT-2 기본 배치 경향(반대 슬롯 가벼운 훈련/능동적 휴식)은 생성기(㉢-a)가 구현 |
| `DSB-INV-004` ((day,slot) 유일) | **충돌 없음 — 유지** | 저장 관문 `Duplicate plan session slot.` 유지; leaf 단독 검사 부재 = B-13 |
| `DSB-INV-001/005~008` | 충돌 없음 | 이 PR은 타입 확장만 — 생성 로직·출력 변경 없음 (기본 AM 유지) |

작업지시서 §4 계승 레지스트리 나머지 (PLAN_SAFETY_GATE, FA-TC-001/014/020/063, 처방 계약, MICROCYCLE, NORTH_STAR §3): **손대지 않음** — `safety-gate`·`memo-safety` 수정 0건, 기존 파일 삭제·이동 0건, `.omo/evidence/` 변경 0건.

## 6. 테스트 로그 (2026-08-06, 철회 적용 후)

| 대상 | 결과 |
|---|---|
| `app/src/domain/plan-beta-schema.contract.test.ts` (OD-SLOT-1 accepts + REST PM + AM default + 저장 관문 C-4 고정 3건) | **7 passed** |
| `app/src/domain/plan-beta-store.test.ts` (main 소속, 미변경) | **13 passed** |
| impl 단위 (`cd impl && npm test`) | **14 파일 / 127 테스트 통과** |
| app 타입체크 | `app/node_modules/.bin/tsc --noEmit` **0 오류** |
| impl 타입체크 | `impl/node_modules/.bin/tsc --noEmit` **0 오류** |

> **타입체크 도구 주의 (AGENTS.md 1ffadd3):** 이 보고서의 타입체크는 `npx tsc`가 아니라 **`node_modules/.bin/tsc`(실체 TypeScript) 직접 호출**로 수행했다. `npx tsc`는 impl에 node_modules가 없을 때 무관한 `tsc@2.0.4`를 받아 exit 0을 주는 함정이 있어 금지된다.

### 전체 회귀 (철회 반영 후, 별도 실행)

| 스위트 | 결과 |
|---|---|
| app 단위 (UTC+KST) | 141 파일 / 1046 테스트 통과 (철회 전 기준 동일 구성) |
| impl 단위 | 14 파일 / 127 테스트 통과 |

## 7. 작업지시서 규칙 준수

| 규칙 | 준수 |
|---|---|
| 1. 스펙 계승 (§8-12) | ✅ §5 표 — OD-SLOT이 최신 오너 결정으로 DSB-INV-002·003을 대체(위반 아님) |
| 2. 기존 좌표 유일성 유지 (DSB-INV-004) | ✅ 저장 관문 기존 유지 + 계약 테스트 유지 |
| 3. QUALITY→PM 단독 반영 금지 | ✅ 타입 확장만 — 이동 연산·재계획 흐름 미생성 (`movePlanSession` 코드 0건) |
| 4. `safety-gate`·`memo-safety` 수정 금지 | ✅ 0건 |
| 5. 기존 파일 삭제·이동 금지 / backward-compatible | ✅ 삭제·이동 0건, `optional().default("AM")`로 기존 저장값 호환 |
| 6. 커밋마다 PR · main 직접 푸시 금지 | ✅ PR #184로 통합 (main 직접 0푸시) |
| 7. `.omo/evidence/` 불변 | ✅ 0건 |

## 8. 결과 요약

- **문 열기 (유지)**: QUALITY·REST `slot` 타입 확장 (`PlanSessionSlot`) — 엔진 타입 + app 스키마 미러 동기화, 생성 기본 AM 유지.
- **벽 세우기 → C-7 철회**: 2026-08-05에 세운 leaf DSB-INV-002 refine을 2026-08-06 오너 결정 OD-SLOT-1에 따라 **철회** (결정 문서 §5 진행 순서 1단계). leaf 테스트를 OD-SLOT-1(accepts)로 복원.
- **저장 관문**: 원래 닫혀 있었음을 실측 정정(Opus 철회 1 확정). C-4/C-5 현행 동작은 ㉢-b 대상으로 미변경 — 테스트로 현행 동작 고정.
- **후속 (결정 문서 §5 순서)**: ㉢-a 생성기(C-1~C-3) → ㉢-b 저장 관문(C-4/C-5) → ㉢-c 문구(C-6) → OD-SLOT-6 수정·확정 플로우(별도 작업지시서). ㉢-c는 ㉢-b 이후.
- **백로그**: B-02 ✅ 갱신(C-7 철회 반영), leaf (day,slot) 유일성 refine 부재 = **B-13 분리** (이번 범위 밖).

---
*보고서 최종 갱신: 2026-08-06 · main `a29e5f2` · 브랜치 `codex/slot-type-extension-b`*
