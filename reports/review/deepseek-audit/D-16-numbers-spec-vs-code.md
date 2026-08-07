# D-16 — 스펙 숫자 vs 코드 상수 대조

```yaml
packet: D-16
executor: DeepSeek
executed_at: "2026-08-07"
repo_sha: "b4f5d99"
mode: READ_ONLY
verdict_authority: NONE
```

- **감사자**: DeepSeek (지시서 v1.1 실행자)
- **일자**: 2026-08-07
- **스냅샷**: main HEAD = b4f5d99 (= origin/main)
- **판정 요약**: 3개 축(밴드별 duration ranges / 훈련일 분산 / 프레임 길이) 대조 — **🔴 템플릿 카탈로그 duration↔밴드 매핑 부재 1 / 🟡 프레임 9.5→7일 매핑 OI OPEN 1 / 나머지 스펙 미언급(불일치 아닌 독자)**
- **OD-REQ**: 1건 (OD-REQ-D16-001)
- **확정 기준 재검증**: `rangesFor()`(impl/src/plan-generator/session-builder.ts:31-54), `spreadTrainingDays()`(app/src/domain/plan-beta-flow.ts:232-245), `LOCAL_CIVIL_9_5`/`slotCount:19`(plan-beta-formation.ts:27) — 지시서 §12 D-16(L821~841)에 명시된 확정값과 **전부 일치** 확인(재조사가 아닌 기준 재검증).

## 1. 밴드별 duration ranges (`rangesFor()` vs 스펙)

| 문서:행 | 문서값 | 코드값 (`session-builder.ts:31-54`) | 차이 |
|---|---|---|---|
| `ENERGY_SYSTEM_SESSION_TEMPLATE_CATALOG.md:230-232` (BA-SEED-01) | easy 30~45분 (`30~45′ @E`) | DEVELOPING easy 30-45 | **일치**(DEVELOPING 밴드와 정확 일치) |
| `ENERGY_SYSTEM_SESSION_TEMPLATE_CATALOG.md:264-266` (BA-SEED-02) | recovery easy 20~30분 (`20~30′ @E`) | EXPERIENCED recoverySupport 20-30 | **부분 일치**: EXPERIENCED recoverySupport와만 정확 일치, 그 외 밴드 recovery와 불일치 |
| `ENERGY_SYSTEM_SESSION_TEMPLATE_CATALOG.md:298-300` (BA-SEED-03) | easy 45~60분 (`45~60′ @E`) | EXPERIENCED easy 35-60 | **부분 일치**: EXPERIENCED easy에 부분 포함(하위 45-60), 어느 밴드와도 1:1 불일치 |
| `ENERGY_SYSTEM_SESSION_TEMPLATE_CATALOG.md:1137` | very easy 20~30′ | — | 위 BA-SEED-02와 동일 집합 |

**🔴 핵심 발견:** 템플릿 카탈로그의 BASE_INTENT 템플릿은 duration을 **밴드 무관**으로 선언하며, 템플릿이 어느 경험 밴드에서 선택 가능한지 연결하는 매핑(밴드→템플릿 또는 템플릿→밴드)이 카탈로그·TEMPLATE_LIBRARY 어디에도 없다(D-12에서 `exact_mapping` 요구만 확인, 정의 없음과 동일 계열). `allowedExperienceBands: []`, `draftExperienceEvidence: SOURCE_AND_HUMAN_MAPPING_REQUIRED`가 이를 방증한다. 코드 `rangesFor`가 밴드로 duration을 고르는 것과 두 경로가 정렬되어 있지 않다.

## 2. 훈련일 분산 (`spreadTrainingDays()` vs 스펙)

| 문서:행 | 문서값 | 코드값 (`plan-beta-flow.ts:232-245`) | 차이 |
|---|---|---|---|
| 스펙 전체 | 분산 패턴 명시 0건 | 3→[1,5,9] / 4→[1,4,7,10] / 5→[1,3,5,7,9] / 6→[1,3,5,6,8,10] / EVERY_DAY→[1..10] | **스펙 미언급 — 코드 독자**(불일치 아님) |

- `spreadTrainingDays`는 지시서가 확정 기준으로 준 값과 정확히 일치하며, 스펙 어디에도 이 알고리즘을 규정하거나 다른 값을 적은 문서가 없다. **구현자가 스펙만 보고 이 분산 규칙을 알 수 없음** — 코드→스펙 역방향 문서화 간극(부가 관찰).

## 3. 프레임 길이 (9.5일 / slotCount 19)

| 문서:행 | 문서값 | 코드값 | 차이 |
|---|---|---|---|
| `PLAN_GENERATOR_SPEC.md:976` (OI-PG-MICROCYCLE-CALENDAR-MAPPING-001) | 9.5-day reference cycle, 7-day calendar output **매핑 필요(OPEN)** | `LOCAL_CIVIL_9_5`, `slotCount:19` (`plan-beta-formation.ts:27`) | 🟡 **일치하되 7일 달력 출력 매핑 미완**: 코드는 9.5일 프레임을 유지, 스펙은 9.5→7 매핑을 OPEN OI로 보류 |
| `specs/legacy-reference/02_AI_STRATEGY.md:72` | 9.5일 = 마이크로사이클 평균(범위 8–11일) | 9.5 고정 | 일치(legacy 기준과 정합) |
| `DOUBLE_SESSION_BETA_SAFETY_CONTRACT.md:135` (DSB-INV-005) | 회복 세션 상한: 7일 프레임 1, 9/9.5/10일 프레임 2 | 프레임 길이 체계(7/9/9.5/10)와 정합 | 일치 — 단 D-14에서 상한 초과(71%) 확정, 인용만 |

- **🟡 발견:** 코드는 `frameLengthSchema = z.union([7,9,10])`(plan-session-schema.ts:13)과 `LOCAL_CIVIL_9_5`(9.5일)를 **함께** 가진다. "9.5일"이 스펙에서 reference cycle로만 간주되는 동안, 코드는 9.5일 프레임을 저장 형식으로 고정(`z.literal("LOCAL_CIVIL_9_5")`). 7일 달력 출력으로의 변환이 OI-PG-MICROCYCLE-CALENDAR-MAPPING-001에 미뤄져 있어 **표시(7일)/저장(9.5일) 이중성**이 남아 있다 — D-19에서 OI로 추적.

## 4. 부가: `rpeTimeRangeSchema` 상한 없음

`plan-session-schema.ts:82-91`의 `rpeTimeRangeSchema`는 `rpe.min/max`와 `durationMinutes.min/max`를 모두 `z.number()`(상한 없음)로 둔다. durationMinutes는 `rangesFor`에서 배정(`session-builder.ts:60`)되므로 저장 관문 차원의 독립 상한은 없다. D-14 대장의 "저장 관문 프레임 상한 없음"과 같은 계열. 별도 OD-REQ는 내지 않고 D-14 §3-4로 연결.

## 5. OD-REQ (결정 요청)

### OD-REQ-D16-001 — 템플릿 카탈로그 duration과 경험 밴드의 정렬 규칙
- **사실**: `ENERGY_SYSTEM_SESSION_TEMPLATE_CATALOG.md`의 BASE_INTENT 템플릿 3종(30~45′/20~30′/45~60′)이 밴드 무관이며, 코드 `rangesFor`의 밴드별 범위와 1:1 대응이 없다(30~45=DEVELOPING 일치, 20~30/45~60은 특정 밴드에만 부분 일치). `allowedExperienceBands: []`로 연결도 비어 있다.
- **왜 내가 결정하지 않는가**: "템플릿은 밴드별 검증 통과 후 승인된 것만 노출"인지 "밴드 무관 설계"인지는 제품 의도(D-19 OI 및 S-2 구현 방향)에 달렸고, 템플릿 자체가 DRAFT·REVIEW_REQUIRED 상태라 지금 확정할 단계가 아니다.
- **선택지 A**: 카탈로그 템플릿에 `allowedExperienceBands`를 채우고 duration을 밴드별 범위로 제약(재검증 필요).
- **선택지 B**: 템플릿 duration을 "코치 조정 대상 예시"로 명시하고 밴드 매핑 없음을 문서화(현 상태 명시화).
- **어느 문서를 함께 봐야 하나**: `ENERGY_SYSTEM_SESSION_TEMPLATE_CATALOG.md`(템플릿 3종), `TEMPLATE_LIBRARY_SPEC.md:308-313`(AthleteLevelBand), `session-builder.ts:31-54`(rangesFor), D-12(밴드 매핑 미발견), D-19(템플릿 OI 상태).

## 6. 인용·판정 누수 점검

- 지시서가 확정 기준으로 준 3개 값 집합(rangesFor/spreadTrainingDays/9.5일)을 재검증해 전부 일치 확인 — "다른 값을 적어둔 문서" 대조에 집중했다.
- 스프레드 패턴·rangesFor 숫자를 스펙에서 찾지 못한 것을 불일치로 부풀리지 않고 "스펙 미언급 — 코드 독자"로 분류.
- 카탈로그 duration은 "밴드와 정확 일치 1건/부분 일치 2건"으로 정밀 분류(통째로 불일치로 몰지 않음).
