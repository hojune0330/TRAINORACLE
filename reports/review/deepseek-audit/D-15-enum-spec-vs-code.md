# D-15 — 스펙이 선언한 enum vs 코드 zod enum 전수 대조

```yaml
packet: D-15
executor: DeepSeek
executed_at: "2026-08-07"
repo_sha: "b4f5d99"
mode: READ_ONLY
verdict_authority: NONE
```

- **감사자**: DeepSeek (지시서 v1.1 실행자)
- **일자**: 2026-08-07
- **스냅샷**: main HEAD = b4f5d99 (= origin/main)
- **판정 요약**: 코드 z.enum 28건(고유 enum ~16종) 전수 대조 — **🔴 이름 다름 1 / 🔴 양방향 차이 1 / 🟡 스펙에만(비확정) 1 / 일치 6 / 코드에만(스펙 미언급) 7**
- **OD-REQ**: 2건 (OD-REQ-D15-001, OD-REQ-D15-002)

## 1. 방법

지시서 §12 D-15(L800~817)에 따라: (1) 코드의 모든 `z.enum([` 28건 수집(`/tmp/d15_enum.txt`), (2) 각 enum 값 집합의 실행 정의를 `sed`로 확정, (3) 그 값 집합을 언급하는 스펙 문서를 grep으로 전수 찾아 대조했다. 이미 선행 패킷에서 확정된 enum(D-10 slot, D-12 experienceBand, D-13 plannedEnergyIntent)은 **그 결과를 인용**하고 재조사하지 않았다.

## 2. 대조 대장

| 코드 위치 | enum 이름 | 코드 값 집합 | 이 enum을 다루는 스펙 문서 | 스펙 값 집합 | 차이 |
|---|---|---|---|---|---|
| `plan-session-schema.ts:12` | sessionSlotSchema | AM \| PM | `PLAN_GENERATOR_SPEC.md:753-756` 외 상위 스펙 | AM \| PM \| DOUBLE \| FLEX | 이름 다름·개수 다름 **(D-10 선행 확정, 인용만)** |
| `plan-session-schema.ts:15`, `athlete-records.ts:70` | enteredBy | ATHLETE\|COACH\|VERIFIED_IMPORT | `TRAINING_SESSION_PRESCRIPTION_CONTRACT.md:77` | 동일 3값 | 일치 |
| `plan-session-schema.ts:16`, `athlete-records.ts:71` | verificationState | VERIFIED\|SELF_REPORTED\|UNVERIFIED | `TRAINING_SESSION_PRESCRIPTION_CONTRACT.md:78` | 동일 3값 | 일치 |
| `plan-session-schema.ts:56` | freshnessState | **CURRENT** \| STALE \| UNKNOWN | `EXTERNAL_RECORD_INTEGRATION_SPEC.md:53,68` | **FRESH** \| STALE \| UNKNOWN | 🔴 **이름 다름: CURRENT↔FRESH** |
| `plan-session-schema.ts:3,106,113` | plannedEnergyIntent | RECOVERY\|BASE\|LT\|VO2\|GLY\|ATP_PC\|MIXED 7값 | `PLAN_GENERATOR_SPEC.md`·OD 문서 | 정본 7값 | 일치 **(D-13 선행 확정, 인용만)** |
| `plan-beta-schema.ts:15` | experienceBand | NEW_TO_RUNNING\|DEVELOPING\|EXPERIENCED | `session-builder.ts:31-54` | 동일 3값 | 일치 **(D-12 선행 확정, 인용만)** |
| `plan-beta-schema.ts:20` | secondSessionMode | SINGLE_SESSION_ONLY\|RECOVERY_PM_ALLOWED | `DOUBLE_SESSION_BETA_SAFETY_CONTRACT.md:62,94-95` | 동일 2값 | 일치 |
| `plan-beta-schema.ts:24` | progressState | COMPLETED\|RESTED\|SKIPPED\|PAIN_CHECKIN | `DOUBLE_SESSION_BETA_SAFETY_CONTRACT.md:169` | `structured_progress` 동일 4값 | 일치 |
| `plan-proposal-service.ts:4` | proposalStatus | DRAFT\|WARNING_REVIEWED\|ACTIVE\|USER_ACCEPTED_WITH_WARNING\|REJECTED\|SUPERSEDED | `APP_IMPLEMENTATION_BRIDGE.md:279-290,752-759` | SUPERSEDED만 일치, 나머지 계약 없음 | 코드에만 있음 (일부) |
| `product-analytics.ts:3` | analyticsEventName | APP_OPENED 외 6값 | 스펙 미언급 | — | 코드에만 있음 |
| `journal-schema.ts:83` | memoPurpose | privateSelfOnly\|analyzableTrainingNote | `CALENDAR_SYNC_CONCURRENCY_FIXTURE_PLAN.md:445`(fixture만) | analyzableTrainingNote fixture 1건 | 대조 불가(fixture뿐) |
| `journal-schema.ts:118` | syncState | local \| synced | `LOCAL_FIRST_SYNC_AND_PROMOTION_CONTRACT.md:31,69,79,174` | `syncState: local` 등 부분 일치 | 대조 불가(영속 transition 계약) |
| `journal-schema.ts:163` | stage | pre \| post | 스펙 미언급 | — | 코드에만 있음 |
| `daily-context.ts:8-10` | mood/body/weather | LOW\|OKAY\|GOOD / TIRED\|NORMAL\|LIGHT / SUNNY\|CLOUDY\|RAINY\|COLD\|HOT | 스펙 미언급 | — | 코드에만 있음 |
| `feedback-schema.ts:5,12,14` | author/category/status | USER\|OPERATOR / BUG\|IDEA\|QUESTION / OPEN\|ANSWERED\|RESOLVED | 스펙 미언급 | — | 코드에만 있음 |
| `plan-session-schema.ts:152-153` | selectionActor / sourceMode | SELF\|COACH / PROFILE_ONLY\|JOURNAL_CONTEXT_ONLY | 스펙 미언급 | — | 코드에만 있음 |
| `plan-beta-schema.ts:9` | planEventGroup | MIDDLE_DISTANCE\|FIVE_K\|TEN_K\|GENERAL_ENDURANCE | `TEMPLATE_LIBRARY_SPEC.md:316-320` EventGroup 6값: SPRINT\|MIDDLE_DISTANCE\|LONG_DISTANCE\|ROAD_RUNNING\|GENERAL_FITNESS\|UNKNOWN + `ENERGY_SYSTEM_SESSION_TEMPLATE_CATALOG.md` draftCandidateEventGroups(SPRINT/LONG_DISTANCE/ROAD_RUNNING 사용) | 6값 | 🔴 **양방향 차이: 코드에만 FIVE_K·TEN_K·GENERAL_ENDURANCE, 스펙에만 SPRINT·LONG_DISTANCE·ROAD_RUNNING·GENERAL_FITNESS·UNKNOWN** |
| `plan-beta-schema.ts:58`, `plan-session-schema.ts:151` | candidateKind | BALANCED \| CONSERVATIVE | `PLAN_GENERATOR_SPEC.md:744-749` PlanOptionType 6값 (CONSERVATIVE\|BALANCED\|STIMULUS_FOCUSED\|RECOVERY_FOCUSED\|COMPETITION_PREP\|RETURN_TO_TRAINING) / `TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md:101` proposed taxonomy 4값 | 6값 | 🟡 스펙에만 4값 (아래 §3-3 참조) |

## 3. 핵심 발견

### 3-1. 🔴 freshnessState: 코드 `CURRENT` vs 스펙 `FRESH` — 이름 다름
`plan-session-schema.ts:56`은 `z.enum(["CURRENT", "STALE", "UNKNOWN"])`인데, 외부 기록 무결성 계약 `EXTERNAL_RECORD_INTEGRATION_SPEC.md:53,68`은 `FRESH | STALE | UNKNOWN`을 선언한다. **스펙을 읽고 `FRESH`를 쓰면 zod가 거부한다.** 코드 사용처(`pace-target-evidence.ts:12,16-22,98`)는 `CURRENT`를 사용 중 → 스펙이 코드와 어긋난 방향이다. 같은 값의 의미(갱신 후·미갱신·불명)를 두 어휘로 부르는 셈.

### 3-2. 🔴 planEventGroup: 양방향 차이
- **코드 4값**: `MIDDLE_DISTANCE | FIVE_K | TEN_K | GENERAL_ENDURANCE` (`plan-beta-schema.ts:9-14`)
- **스펙 6값**: `TEMPLATE_LIBRARY_SPEC.md:316-320`의 `EventGroup` = `SPRINT | MIDDLE_DISTANCE | LONG_DISTANCE | ROAD_RUNNING | GENERAL_FITNESS | UNKNOWN`. 교집합은 `MIDDLE_DISTANCE` 하나뿐.
- `ENERGY_SYSTEM_SESSION_TEMPLATE_CATALOG.md`의 템플릿 메타데이터는 `draftCandidateEventGroups: [SPRINT, MIDDLE_DISTANCE, LONG_DISTANCE, ROAD_RUNNING]`을 쓰는데, **코드 zod enum에는 LONG_DISTANCE/ROAD_RUNNING/SPRINT가 없다** — "스펙에만 있는 값"이자 **템플릿 카탈로그가 실제로 참조하는 값**이라 구현자가 그대로 두면 zod 검증 통과 불가.
- 반대로 `FIVE_K`/`TEN_K`/`GENERAL_ENDURANCE`는 코드에만 있다(스펙 미언급).

### 3-3. 🟡 candidateKind: 스펙에만 4값 (확정 계약 아님 — 주의)
`PLAN_GENERATOR_SPEC.md:744-749`의 `PlanOptionType`은 6값, `TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md:101`은 4값 proposed taxonomy다. 단, 형성 스펙 :101은 "**proposed** first-pilot option taxonomy, **not an owner-confirmed method fact**"라고 명시 — 즉 스펙 스스로 미확정임을 적었다. 이 때문에 🔴가 아닌 🟡로 분류한다. 코드는 `BALANCED|CONSERVATIVE` 2값만 저장한다. **스펙에 있는 4값(STIMULUS_FOCUSED·RECOVERY_FOCUSED·COMPETITION_PREP·RETURN_TO_TRAINING)을 구현하려면 곧바로 차질**이 나지만, 미확정 제안이므로 포함 여부는 오너가 정할 일.

### 3-4. 일치·코드에만 있음 요약
- 일치: 6종(enteredBy, verificationState, plannedEnergyIntent, experienceBand, secondSessionMode, progressState).
- 코드에만 있음(스펙 미언급): proposalStatus 일부값, analyticsEventName 7값, journal stage pre/post, daily-context 3×3값, feedback 3×3값, selectionActor/sourceMode 2×2값. **이들은 "스펙에만 있는 값"이 아니라 역방향(코드에만 있는 값)** 으로, 스펙을 정본으로 쓰는 구현자가 값 존재를 모를 가능성. 다만 이들 다수는 로컬 UI/내부 상태 enum이라 계약 문서 대상이 아닐 수 있다(OD-REQ로 남기지 않고 부가 관찰로 처리).

## 4. OD-REQ (결정 요청)

### OD-REQ-D15-001 — freshnessState 어휘 통일
- **사실**: 코드 `CURRENT`(`plan-session-schema.ts:56`)와 스펙 `FRESH`(`EXTERNAL_RECORD_INTEGRATION_SPEC.md:53,68`)가 같은 상태를 다르게 부른다.
- **왜 내가 결정하지 않는가**: 이미 저장된 데이터에 `CURRENT`가 존재(`pace-target-evidence.ts:98`)해 마이그레이션 부담이 있고, 스펙 쪽 어느 문서가 정본인지(active vs reconstruct) 오너가 정해야 한다.
- **선택지 A**: 스펙 `FRESH`를 `CURRENT`로 수정(코드 정본 유지, 스펙 1곳 수정).
- **선택지 B**: 코드를 `FRESH`로 변경 + 저장 데이터 마이그레이션.
- **어느 문서를 함께 봐야 하나**: `EXTERNAL_RECORD_INTEGRATION_SPEC.md:53,68`(스펙값), `plan-session-schema.ts:56`(코드), `pace-target-evidence.ts:12-98`(기존 사용처), D-16(연결 스펙 번호).

### OD-REQ-D15-002 — planEventGroup 어휘 통일 (생성 흐름과 템플릿 카탈로그 정렬)
- **사실**: 코드 4값(`plan-beta-schema.ts:9-14`)과 스펙 6값(`TEMPLATE_LIBRARY_SPEC.md:316-320`)의 교집합이 `MIDDLE_DISTANCE` 하나이며, `ENERGY_SYSTEM_SESSION_TEMPLATE_CATALOG.md`의 템플릿은 코드에 없는 `LONG_DISTANCE`/`ROAD_RUNNING`/`SPRINT`를 참조한다.
- **왜 내가 결정하지 않는가**: 템플릿 카탈로그(스펙)가 사용하는 값 어느 쪽을 정본으로 할지는 오너 결정 사항이고, D-17(거짓 약속)과도 얽힐 수 있다.
- **선택지 A**: 코드 zod 4값을 스펙 6값으로 확장(기존 저장 데이터 호환).
- **선택지 B**: 스펙 `EventGroup` 6값과 템플릿 카탈로그 값을 코드 4값 체계로 단일화(카탈로그 대량 수정).
- **어느 문서를 함께 봐야 하나**: `TEMPLATE_LIBRARY_SPEC.md:316-320`, `ENERGY_SYSTEM_SESSION_TEMPLATE_CATALOG.md`(draftCandidateEventGroups 전수), `plan-beta-schema.ts:9-14`, D-16(연계 숫자).

## 5. 부가 관찰

- `frameLengthSchema = z.union([z.literal(7), z.literal(9), z.literal(10)])`(`plan-session-schema.ts:13`)는 D-16의 9.5일 프레임(`LOCAL_CIVIL_9_5`)과 **별개 저장 단위**다 — 혼동 금지 메모.
- D-14에서 발견한 PG-TC-031(옵션 수)과 연결: `candidateKind`의 축소(2값)는 생성 옵션 taxonomy의 미확정 상태와 정합적이다. D-18에서 DSB-INV와 함께 추적.

## 6. 인용·판정 누수 점검

- D-10/D-12/D-13 확정 결과는 재조사 없이 인용만 했다.
- 「스펙에만 있는 값」이 가장 위험하다는 지시서 기준에 따라 🔴 2건(freshnessState, planEventGroup)을 상위에 배치했다.
- `candidateKind`는 스펙 스스로 미확정임을 명시해 🟡로 분류 — 노이즈 부풀림 방지.
