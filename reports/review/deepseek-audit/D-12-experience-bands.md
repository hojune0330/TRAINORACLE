# D-12. 경험 밴드 이름 전수 대조

```yaml
packet: D-12
executor: DeepSeek
executed_at: "2026-08-06"
repo_sha: "b4f5d99"
mode: READ_ONLY
verdict_authority: NONE
```

- 패킷: D-12 (`WORK_ORDER_DEEPSEEK_SPEC_WIDE_AUDIT.md` §PHASE 3 D-12)
- 감사자: DeepSeek (지시서 v1.1 실행자) / Round 3
- 기준 커밋: b4f5d99
- pending: 없음

## 1. 개요

**목적:** 경험 밴드 어휘가 문서마다 다른지 전수 대조. 코드 확정 3값은 `NEW_TO_RUNNING` / `DEVELOPING` / `EXPERIENCED`.

## 2. 코드 기준

- `impl/src/plan-generator/types.ts:50` — `EXPERIENCE_BANDS = ["NEW_TO_RUNNING", "DEVELOPING", "EXPERIENCED"] as const`
- `impl/src/plan-generator/input-values.ts:114-121` — `parseExperienceBand()`가 3값만 수용 (그 외 undefined)
- `impl/src/plan-generator/session-builder.ts:31-54` — `rangesFor()`가 3밴드 분기

## 3. 전수 스캔 (지시서 명령 그대로)

```
NEW_TO_RUNNING  8
DEVELOPING     12
EXPERIENCED     6
BEGINNER        4
INTERMEDIATE    2
ELITE           2
ADVANCED        2
NOVICE          1
```

## 4. 발견

**F1 — 코드·문서 정합 (3값 사용처 모두 일치).** `NEW_TO_RUNNING/DEVELOPING/EXPERIENCED`가 쓰인 모든 문서가 코드와 동일 3값 체계. (주요 사용처: `impl/src`·`app/src`·`TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md`·`FORMATION_…_CONTRACT.md` 계열 — D-01·D-12 스캔 결과.)

**F2 — 제2의 밴드 체계: `AthleteLevelBand` 5값 (TEMPLATE_LIBRARY_SPEC:308-313).**
```
specs/active/TEMPLATE_LIBRARY_SPEC.md:309-313
  | "BEGINNER" | "DEVELOPING" | "INTERMEDIATE" | "ADVANCED" | "ELITE"
```
코드(`app/src`·`impl/src`)에 `BEGINNER` 문자열 0건, `AthleteLevelBand` 타입 자체도 0건 → **이 5값 체계는 코드에 구현돼 있지 않음 (문서 전용).**

**F3 — 두 체계의 교집합은 `DEVELOPING` 1개뿐. `BEGINNER` ↔ `NEW_TO_RUNNING` 매핑 미발견.**
- TEMPLATE_LIBRARY_SPEC.md 내 `NEW_TO_RUNNING` 발생 0건 (5값 체계는 NEW_TO_RUNNING/EXPERIENCED를 쓰지 않음)
- ENERGY_SYSTEM_SESSION_TEMPLATE_CATALOG.md:100에 `exact_TemplateLibrary_AthleteLevelBand_mapping`이 **필수 조건 항목으로 명시**되어 있으나, **매핑 테이블 자체(어느 값이 어느 값에 대응하는지)를 정의한 문서는 미발견** (CROSS grep: 매핑 표/함수/문장 0건)
- 지시서 §D-12: "매핑이 없으면 그것이 발견" — **"매핑 미발견"으로 기록**

**F4 — NOVICE는 감사 워크오더 문자열뿐.** `NOVICE` 1건은 `WORK_ORDER_DEEPSEEK_SPEC_WIDE_AUDIT.md:746`(지시서 명령 문자열) — 실사용 아님.

## 5. 대조 표

| 어휘 | 사용 문서 | 코드 존재? | 3값과 매핑 |
|---|---|---|---|
| NEW_TO_RUNNING / DEVELOPING / EXPERIENCED | 구현·형성 스펙 다수 | 예 (types.ts:50) | — (정본) |
| BEGINNER / DEVELOPING / INTERMEDIATE / ADVANCED / ELITE | TEMPLATE_LIBRARY_SPEC:308-313, ENERGY_SYSTEM…CATALOG:100 | 아니오 (코드 0건) | **매핑 미발견** |
| NOVICE | (워크오더 문자열 1건) | 아니오 | 해당없음(실사용 아님) |

## 6. OD-REQ

- OD-REQ: **0건** (F3의 매핑 부재는 사실관계 기록. 어느 체계로 통일할지·매핑을 정의할지는 제품 결정 — D-22 종합 참조 이관)

## 7. 한계

- `ENERGY_SYSTEM_SESSION_TEMPLATE_CATALOG.md` 전체의 밴드 필드(grep 대상)는 `:100` 매핑 요구 항목 확인에 그침 — 카탈로그 항목별 `allowedExperienceBands` 값 전수는 D-13·D-15 범위.
- 매핑 표 존재 여부는 `specs/`·`app/src`·`impl/src` 전역 grep으로 "미발견" 확인. `.omo/` 도면·계획서는 미스캔(범위 외).
