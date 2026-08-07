# D-13. energy intent enum 전수 대조

```yaml
packet: D-13
executor: DeepSeek
executed_at: "2026-08-06"
repo_sha: "b4f5d99"
mode: READ_ONLY
verdict_authority: NONE
```

- 패킷: D-13 (`WORK_ORDER_DEEPSEEK_SPEC_WIDE_AUDIT.md` §PHASE 3 D-13)
- 감사자: DeepSeek (지시서 v1.1 실행자) / Round 3
- 기준 커밋: b4f5d99
- pending: 없음

## 1. 개요

**목적:** 코드 정본에 없는 intent 이름을 쓰는 문서 전수. 특히 **`GLYCOLYTIC_INTENT`**(존재하지 않는 값) 탐색.

## 2. 코드 정본 (T-9, `app/src/domain/plan-session-schema.ts:3-11`)

```
RECOVERY_INTENT · BASE_INTENT · LT_INTENT · VO2_INTENT · GLY_INTENT · ATP_PC_INTENT · MIXED_INTENT
```

## 3. 전수 스캔 (지시서 명령 그대로)

```
RECOVERY_INTENT  69
BASE_INTENT      23
LT_INTENT        20
GLY_INTENT       16
ATP_PC_INTENT    13
MIXED_INTENT      7
────────────────────────────
GLYCOLYTIC_INTENT  3   ← 코드에 없음
COACH_INTENT       3   ← 에너지 intent 아님 (별개 enum 값)
VERY_EASY_INTENT   1   ← 별개 enum (PlannedIntensityLabel)
EASY_INTENT        1   ← 별개 enum
MODERATE_INTENT    1   ← 별개 enum
HARD_INTENT        1   ← 별개 enum
VERY_HARD_INTENT   1   ← 별개 enum
MAX_INTENT         1   ← 별개 enum
NOT_APPLICABLE_INTENT 1 ← 별개 enum
```

## 4. 발견

**F1 — `GLYCOLYTIC_INTENT` 실사용 0건.** 등장 3건은 전부 "이 값은 없다"는 경고·지시 문맥:
- `WORK_ORDER_DEEPSEEK_SPEC_WIDE_AUDIT.md:241` (T-9: "GLYCOLYTIC_INTENT는 존재하지 않는다")
- `WORK_ORDER_DEEPSEEK_SPEC_WIDE_AUDIT.md:770` (지시서 출력 요구 문구)
- `WORK_ORDER_SLOT_INTENSITY_FULL_RUN.md:310` ("의도 값은 GLY_INTENT 다. GLYCOLYTIC_INTENT 아님")
→ **부정·경고 문맥뿐이라 "없는 값을 쓰는 문서" 0건.** 긍정 사용 없음.

**F2 — `COACH_INTENT`는 별개 enum `itemKind`의 값 (에너지 intent 아님).**
- `specs/reconstruct/PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md:239,412` — `itemKind: LOAD_ADJUSTMENT | … | COACH_INTENT | SCHEDULE_CONTEXT` (rationale item 종류)
- `specs/active/PLAN_GENERATOR_SPEC.md:322,336` — `semantic_class: COACH_INTENT_LABEL_ONLY`
- `specs/reconstruct/TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md:311` — rationale 목록
→ 에너지 intent enum과 혼동하는 사례 없음 (접미사 `_INTENT`가 같지만 컨텍스트가 분리).

**F3 — `VERY_EASY_INTENT` 등 7개는 `PlannedIntensityLabel` (별개 enum).**
- `specs/active/PLAN_GENERATOR_SPEC.md:778-786` — `PlannedIntensityLabel = VERY_EASY_INTENT | EASY_INTENT | MODERATE_INTENT | HARD_INTENT | VERY_HARD_INTENT | MAX_INTENT | NOT_APPLICABLE_INTENT`
- **코드(`app/src`·`impl/src`)에 `PlannedIntensityLabel`/`VERY_EASY_INTENT` 0건** — 문서만의 타입.
- 에너지 intent와 **이름이 다름**을 명확히 구분 — 에너지 intent enum 착각 사례는 0건.

**F4 — 정본 7종의 문서 사용 모두 코드와 일치.** `GLY_INTENT`/`VO2_INTENT` 등이 쓰인 모든 의도 계획 문맥이 코드 정본 값 사용. (D-01 인벤토리·D-11 RPE 대조와 정합.)

## 5. 대조 표

| intent 명칭 | 등장 수 | 코드 존재? | 분류 |
|---|---:|---|---|
| RECOVERY_INTENT 외 정본 7종 | 148 | 예 | 일치 |
| GLYCOLYTIC_INTENT | 3 | 아니오 | **부정·경고 문맥뿐 (실사용 0)** |
| COACH_INTENT | 3 | 아니오 (코드 0건) | 별개 enum(itemKind) — 에너지 아님 |
| VERY_EASY_INTENT 외 6종 | 7 | 아니오 | 별개 enum(PlannedIntensityLabel) — 에너지 아님 |

## 6. OD-REQ

- OD-REQ: **0건** (intent enum 혼동 실사용 0건. PlannedIntensityLabel·AthleteLevelBand 등 문서 전용 타입의 코드 반영 여부는 D-12·D-15에서 취급)

## 7. 한계

- `_INTENT` 접미사 문자열 기반 스캔이라, `NO_INTENT`·`INTENT` 단독 표기나 소문자 표기는 미포함 — 에너지 intent로 오인할 실사용 후보 0건을 스캔 범위 내에서 확인.
- `.omo/` 도면·계획서의 intent 표기는 미스캔(범위 외).
