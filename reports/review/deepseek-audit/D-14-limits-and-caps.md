# D-14 — 상한·한계 숫자 전수 대장

```yaml
packet: D-14
executor: DeepSeek
executed_at: "2026-08-07"
repo_sha: "b4f5d99"
mode: READ_ONLY
verdict_authority: NONE
```

- **감사자**: DeepSeek (지시서 v1.1 실행자)
- **일자**: 2026-08-07
- **스냅샷**: main HEAD = b4f5d99 (= origin/main)
- **판정 요약**: 상한 규정 8건 조사 — **일치 4 / 불일치 2(코드 미강제) / 해당없음 1(제한 아닌 파생·컨텍스트 선택) / 확정 인용 2건**
- **OD-REQ**: 2건 (OD-REQ-D14-001, OD-REQ-D14-002)

## 1. 스코프·방법

지시서 §12 D-14(L774~794)에 따라: (1) 이미 확정된 2건은 **인용만 하고 재조사하지 않았다** — `DSB-INV-005` 상한 2 = `session-builder.ts:165 const limit = 2`, 저장 관문 프레임 상한 없음 = `plan-beta-schema.ts`의 `limit|length|count` grep 결과 `:105` 하나뿐(선행 감사 확정). (2) **나머지 상한들**을 스펙(`specs/`)의 `(상한|최대|최소|한계|limit|cap|max|min)` grep + 코드(`app/src`, `impl/src`)의 `limit|cap|maxS|MAX_|LIMIT_` grep으로 교차 대조했다.

"기계 검증됨?" 컬럼의 기준은 `.github/workflows/ci.yml`에 등록된 검증기가 해당 상한을 검증하는가(D-06/D-09 맥락).

## 2. 상한·한계 대장

| 문서:행 | 상한의 대상 | 문서상 값 | 코드 강제 지점 | 코드값 | 일치? | 기계 검증됨? |
|---|---|---|---|---|---|---|
| `DOUBLE_SESSION_BETA_SAFETY_CONTRACT.md:132` (DSB-INV-005) | beta day recoverySecondSessionDays 상한 | 상한 2, 71% 케이스 초과 (C-5, C-7) | `impl/src/plan-generator/session-builder.ts:165` | `const limit = 2` | 🔴 불일치(초과 발생) | 아니요(수작업 감사로 확인) |
| `plan-beta-schema.ts`(저장 관문) | 프레임(일수) 상한 | 상한 규정 없음 | `app/src/domain/plan-beta-schema.ts:105` | `sessions.length > 2`(세션 수만 체크) | 일치(상한 없는 채로 일치) | 아니요 |
| `JOURNAL_DELIGHT_AND_DECORATION_SPEC.md:393` | 페이지 배치(placements) 1일 행 수 | cap at 4 (`PLACEMENT_LIMIT_EXCEEDED` → 첫 4행만 유지) | `app/src/domain/decoration-schema.ts:66` | `pagePlacements: z.array(pagePlacementSchema).readonly()` — **cap 4 미강제** | 🔴 불일치(코드 강제 없음) | 아니요 |
| `JOURNAL_DELIGHT_AND_DECORATION_SPEC.md:394` (·:300, :511) | favorites/recents 상한 | cap recents at 8 (`LIBRARY_LIMIT_NORMALIZED`) | `app/src/domain/decoration-schema.ts:57` | `recentItemIds: z.array(decorationIdSchema).max(8)` | ✅ 일치 | 아니요 |
| `SESSION_INTENSITY_ASSESSMENT_SPEC.md:45` | objectiveComponents 개수 | maximum 6 | `app/src/domain/intensity-assessment.ts:160` | `objectiveComponents: z.array(objectiveLoadComponentSchema).max(6)` | ✅ 일치 | 아니요 |
| `DOUBLE_SESSION_BETA_SAFETY_CONTRACT.md:134` (DSB-INV-004, V-5/V-10) | 하루 세션 수 | at most 2 per day, `(day, slot)` 유일 | `app/src/domain/plan-beta-schema.ts:105-108` | `sessions.length > 2` → "Too many sessions in one day." | ✅ 일치(저장 관문 강제) | 아니요 |
| `PLAN_GENERATOR_SPEC.md:913` (·:1015 PG-TC-031) | 생성 옵션 수 | default 3, minimum 2 (blocked/불충분 시 제외) | **미발견** | `options.length` 강제 지점 grep 0건 | 🔴 불일치(코드 강제 없음) | 아니요 |
| `RULE_SPEC_D1_D9.md:322-331, 351-359` | operational window / rolling microcycle 컨텍스트 일수 | max 4 / max 11, min 2 / min 8 | **미발견**(실행 코드) | `APP_IMPLEMENTATION_BRIDGE.md:1537-1538`는 TS 타입 contract뿐, 실행 검증 아님 | 해당없음(`enforcement_effect: CONTEXT_SELECTION_ONLY` — 생성 상한 아님) | 아니요 |

## 3. 핵심 발견

1. **🔴 JOURNAL placements cap 4 미강제**: `decoration-schema.ts:66`의 `pagePlacements`가 길이 제한 없는 배열이다. 규격(:393)은 1일 4행 초과 시 `PLACEMENT_LIMIT_EXCEEDED`로 **첫 4행만 유지하고 렌더링**하라고 규정하지만, 스키마 레벨에서 막지 않는다. (렌더링 UI 레벨 cap 여부는 본 감사 스코프 밖 — OD-REQ-D14-001 참조.)
2. **🔴 PG-TC-031 옵션 수 강제 미발견**: `PLAN_GENERATOR_SPEC.md:913`의 "default option count 3, minimum 2"를 강제하는 코드 지점이 grep으로 검출되지 않았다(생성 흐름 계열 `plan-proposal-service`/`plan-generator` 전수 확인, `options.length` 계열 0건). D-18에서 DSB-INV와 함께 추가 추적 대상.
3. **RULE_SPEC_D1_D9 max 4/11은 생성 제한이 아님**: `enforcement_effect: CONTEXT_SELECTION_ONLY`로 규칙 평가 컨텍스트 선택 범위만 제한(거짓 발견으로 분류하지 않음). 다만 `APP_IMPLEMENTATION_BRIDGE.md:1537-1538`의 TS contract와 실행 검증 사이의 간극은 존재.
4. **숫자 입력 상한(코드에만 있음)**: `numeric-input.ts:14/20/26` (`MAX_DISTANCE_KM=1000`, `MAX_DURATION_MIN=3000`, `MAX_PACE_SECONDS_PER_KM=30*60`), `read-file.ts:1` (`MAX_IMPORT_FILE_BYTES=10*1024*1024`)은 **스펙에 명시적 상한 규정이 미발견** — "스펙에만 있는 값"의 역방향(코드에만 있는 값)으로, 구현자는 스펙만 보고 상한을 모를 수 있는 간극.
5. **제외 항목(상한 아님)**: `ENERGY_SYSTEM_SESSION_TEMPLATE_CATALOG.md:813`의 `setRecoveryOccurrences=2`는 상한이 아니라 표기법 파싱의 **파생값**(코드 `prescription/totals.ts:18` = `notation.setCount - 1`)이라 대장에서 제외.

## 4. OD-REQ (결정 요청)

### OD-REQ-D14-001 — JOURNAL placements cap 4의 강제 위치
- **사실**: `JOURNAL_DELIGHT_AND_DECORATION_SPEC.md:393`은 1일 4행 초과 시 행 수를 cap하라는 규정인데, `decoration-schema.ts:66`에는 길이 제한이 없다.
- **왜 내가 결정하지 않는가**: cap을 스키마에 넣으면 규격이 명시한 "첫 4행만 유지하고 렌더링"(렌더링 단계 동작)과 상충할 수 있고, UI 렌더링 레벨에서 이미 정상화할 가능성도 있어 실행 코드 전수 확인이 선행돼야 한다.
- **선택지 A**: 스키마에 `.max(4)`를 추가해 저장 관문에서 거부(규격의 정상화 의미 변경).
- **선택지 B**: 스키마는 그대로 두고 규격에서 "cap은 렌더링 정상화 단계에서 수행"이라고 강제 위치를 명시.
- **어느 문서를 함께 봐야 하나**: `JOURNAL_DELIGHT_AND_DECORATION_SPEC.md:393-394, 511-514`(cap 동작 정의), `decoration-schema.ts:57-70`(스키마), `validate-journal-decoration-contract.mjs`(기계 검증 범위).

### OD-REQ-D14-002 — 생성 옵션 수(3, 최소 2) 강제 지점
- **사실**: `PLAN_GENERATOR_SPEC.md:913`의 옵션 수 규정이 실행 코드에서 grep 검출되지 않았다.
- **왜 내가 결정하지 않는가**: 생성 흐름의 옵션 수는 입력 데이터(가용 훈련일 등)에 의존해 가변일 수 있고, 규정 자체가 "blocked or insufficient data" 예외를 두고 있어 단순 상수 강제가 오히려 규정 위반이 될 수 있다.
- **선택지 A**: 옵션 생성 로직에 상/하한 체크+실패 코드를 추가한다.
- **선택지 B**: 규정을 "권장 수치"로 완화해 스펙-코드 간 계약을 재정의한다.
- **어느 문서를 함께 봐야 하나**: `PLAN_GENERATOR_SPEC.md:905-915`(생성 단계 규정), `impl/src/plan-generator/` 생성 흐름(옵션 배열 생성 지점), D-18(DSB-INV 강제 지점 대장) — PG-TC-031을 D-18과 연결 추적.

## 5. 부가 관찰

- `JOURNAL` 검증기(`validate-journal-decoration-contract.mjs`)는 catalogRows 8종·slotRows 4종·`[DRAFT_COMPLETE]` 마커만 검증하고 **cap 4/recents 8은 검증하지 않는다**(grep 0건) — D-07에서 상세 확인.
- 본 대장의 "기계 검증됨?" 전부 "아니요": D-09 결론(기계 검증 0건)과 정합적이다.

## 6. 인용·판정 누수 점검

- 확정 인용 2건(DSB-INV-005, 저장 관문 프레임 상한 없음)을 재조사 없이 표에 그대로 인용했다.
- 상한이 아닌 항목(파생값, 컨텍스트 선택 한정)을 불일치로 부풀리지 않았다(각각 해당없음/제외로 분류).
