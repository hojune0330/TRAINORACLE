# 계획 의미성 런타임 감사 · 2026-09-30

## 판정과 경계

이 감사는 `codex/workout-choice-runtime-completion` 작업트리의 실제 생성 경로와 합성 입력만 확인했다. 처방 숫자, 앱 코드, 안전 규칙, 활성화 권한은 수정하지 않았다. 상위 작업의 달력·상태복원 dirty 변경도 건드리지 않았다.

`TRAINING_PLAN_CURRENT_SCOPE.md` v1.1은 2026-09-06 기준선이며 스스로도 그 당시 base SHA의 범위만 보증한다고 적는다 (`TRAINING_PLAN_CURRENT_SCOPE.md:5-12,21-30`). 따라서 최신 상태는 이를 기준으로 삼되, 이후의 2026-09-28 한정 LT 채택과 2026-09-29 남은 일정 재설계를 별도 대조했다. 이 후속 결정은 나머지 종목/목적의 일반 생성을 승인하거나 과학적 일반화를 하지 않는다.

실행: 기존 표적 4파일 **47/47 PASS**. 새 합성 매트릭스는 **6/7 PASS, 1건 실패**이며 실패한 단언이 아래 확정 계약 불일치를 재현한다. 테스트는 오프라인 synthetic fixture이고 실제 선수·계정 자료를 쓰지 않았다.

## 런타임 매트릭스

| 입력 | 실제 생성 결과 | 판정 |
|---|---|---|
| 같은 5일/10일/MIXED/EXPERIENCED 프로필, 800m·1500m·3000m·5000m·10km·하프·마라톤 | RPE-only 세션 배열이 일곱 종목에서 동일 | 종목/거리 자체는 세션 처방을 바꾸지 않는다. 이벤트 태그·적격한 상세 경로는 별도다. |
| NEW_TO_RUNNING, 3일, MIXED, 10일 투영 | available day `[1,5,9]`, QUALITY 1회, day 5 | 경험·가용일은 품질 세션 수/위치에 반영된다. 이는 생리학적 최적 배치 검증이 아니다. |
| EXPERIENCED, 매일, MIXED, 10일 투영 | QUALITY day 2와 10, 간격 8일 | 코드의 기준은 첫 QUALITY를 두 번째 가용일에 두고, 이후 최소 3일 지난 가장 늦은 가용일을 고른다. 이벤트 종류는 쓰지 않는다. |
| EXPERIENCED, 매일, MIXED, 9일 투영 | available days `[1..9]`, MAIN/QUALITY day 2와 9; day 10은 REST이며 화면/추천 projection은 9일 | day10 MAIN을 만든 뒤 숨기는 게 아니다. 9.5일 투영은 `ceil(9.5)=10`이므로 가용일 `[1..10]`, MAIN day 2와 10 모두 표시 범위다. |
| 위와 같은 프로필에서 MIXED → VO2 | 날짜·세션 시간은 같고 QUALITY RPE만 6–7 → 7–8 | 명시 목적은 RPE에 반영되지만 세션 구조/분량은 바꾸지 않는다. |
| EXPERIENCED 5일, BALANCED ↔ CONSERVATIVE | QUALITY 내용·위치는 동일; 초기 차이는 쉬운 세션의 최대 시간 | 후보 두 개가 서로 다른 MAIN 방법 두 개라는 뜻이 아니다. |
| 현재 합성 5000m PB 1111초, 템플릿 선택만 하고 기록 미선택 | storedRecordCount=1이어도 `PACE_TARGET_FALLBACK_NO_EXPLICIT_ANCHOR` | 기록 개수는 사용 사실이 아니다. |
| 위 기록을 명시 선택 / 다른 합성 PB 1200초 명시 선택 | 1000m 목표 222.2초 / 240초, `PACE_TARGET_BOUND` | 상세 허용 종목·경험·목적·현재성·안전 검사를 지난 명시 기록만 수치에 연결된다. |
| EVERY_DAY, 10일 투영, `RECOVERY_PM_ALLOWED`, EVENING | day 1–9 각각 2슬롯, day 10 AM만: **19회 / 기대 20회** | 아래 확정 결함. 마지막 반일의 PM 슬롯이 누락된다. |

품질 규칙은 `impl/src/plan-generator/candidates.ts:310-355`, RPE/경험 범위는 `impl/src/plan-generator/session-builder.ts:31-108,185-198`, 슬롯 생성은 `:172-183,201-252`에서 확인했다. 입력을 모으고 `generatePlanCandidates`에 전달하는 실제 앱 경로는 `app/src/domain/plan-beta-flow.ts:275-314`다. 상세 기록은 명시 `selectedRecordId`와 동일 종목/경험 및 승인 템플릿 검사를 통과해야 하며 (`app/src/domain/plan-candidate-prescription.ts:81-133`), 두 후보에 하나씩만 연결한다 (`:213-239`).

MIXED는 새 세션 방법 pool이 아니라 generic QUALITY 세션에 `MIXED_INTENT`를 붙이는 intent다. 초기 BALANCED/CONSERVATIVE 두 안의 QUALITY session 배열은 같고, 실제 첫 QUALITY 처방은 RPE 6–7이다 (합성 매트릭스). 승인된 runtime method pool은 별도 LT 예외이며, 5000m·EXPERIENCED·3일·9일·LT 등 전체 지원 조합이 맞을 때만 route된다. MIXED를 LT pool로 치환하거나 LT의 방법 선택지를 일반 MIXED에 끼우지 않는다.

## 최근 채택과 남은 일정

- **LT 방법 풀:** 9/28 `LT_PILOT_OWNER_ADOPTION_DECISION_2026-09-28.md:18-43`는 5000m·EXPERIENCED·3일·9일 투영/9.5일 형성·LT·하루 한 번 등 하나의 정확한 조합에만 연속 20분, 10분×2, 분할형의 시간 축소 8분×2를 제한 채택한다. 실제 `LT_PILOT_MULTI_PLAN_RUNTIME_V3`는 앱 진입(`app/src/main.tsx:9,78-80`)에서 전달되고, 5km 일치·1500m 비일치·방법/조절 분리·저장/재열기 검사를 갖는다 (`app/src/domain/lt-pilot-runtime-v3.ts:77-90,167-194`; `app/src/domain/lt-pilot-runtime-v3.contract.test.tsx:55-98`). 이것은 일반 이벤트별 생성기의 개인화를 대체하지 않는 좁은 예외다.
- **남은 일정:** 9/29 구현 보고는 승인 범위를 유지/시간 줄이기/저강도로 교체/기존 쉬운 슬롯로 이동 후 사용자 적용으로 제한한다 (`reports/implementation/EXECUTION_REMAINDER_REPLAN_IMPLEMENTATION_2026-09-29.md:5-34`). 로컬 코드도 기존 RPE 최소값 선택, 기존 EASY 재사용, 이미 있는 동일 AM/PM 슬롯로 이동만 replay한다 (`app/src/domain/execution-replan.ts:35-108`; `app/src/domain/execution-replan-policy.ts:25-83`). 자동 증량, 빈 날 채우기, catch-up, 다일 최적화는 아니다. 보고서가 배포 완료라고 기록하더라도 이번 감사는 외부 운영 배포/계정 저장을 재확인하지 않았다.
- **주기/적응:** periodization context는 프레임·mesocycle·phase 표지를 다음 프레임으로 넘긴다 (`app/src/domain/periodization-lineage.ts:46-99`; successor 상태 기록 `app/src/domain/plan-successor-activation.ts:530-552`). phase별 템플릿/시간/RPE/테이퍼 처방이 생성되는 경로는 확인되지 않았다. 현재 일반 A/B 차이는 보조 easy 시간에 한정된다. transform registry는 별도로 기존 sibling의 support maximum을 바꾸며, reverse volume edge를 `ACTIVE`로 노출한다 (`impl/src/plan-generator/adaptation-transform-registry.ts:36-74,97-115`).

## 확정 결함

1. **명시적 하루 2회 선택이 마지막 가용일을 누락한다.** 오너 결정은 직접 선택 시 고른 모든 훈련일에 AM/PM 두 슬롯을 요구한다 (`OWNER_DECISION_FULL_TWO_A_DAY_2026_08_12.md:23-33`; `specs/reconstruct/DOUBLE_SESSION_BETA_SAFETY_CONTRACT.md:66-70,100-105,134-144`). 앱은 10일을 가용일로 만들지만 (`app/src/domain/plan-beta-flow.ts:613-629`), 9.5일 formation에는 day 10 AM 슬롯만 있다 (`app/src/domain/plan-beta-formation.ts:12-23`). 생성기는 formation에 PM이 있는 날만 두 번째 세션을 만든다 (`impl/src/plan-generator/session-builder.ts:172-183,210-249`). 그 결과 day 10이 입력상 가용일인데 한 회만 생성된다. 이번 매트릭스에서 재현; 코드 수정은 하지 않았다. 해결에는 마지막 반일을 “가용 훈련일”로 셀지에 관한 날짜/슬롯 계약 정합화가 필요하며, 임의 PM을 추가하지 않았다.
2. **상향 volume transform의 권한 상태가 기록과 런타임에서 다르다.** 런타임 registry는 `CONSERVATIVE_TO_BALANCED_EXISTING_SIBLING_ONLY`를 `ACTIVE/INCREASE/VOLUME`로 두고 명시 요청 및 같은 종목 PB/SB trigger를 허용한다 (`impl/src/plan-generator/adaptation-transform-registry.ts:55-69,97-115`). 8/23 owner payload는 같은 reverse edge를 `APPROVED_FOR_IMPLEMENTATION_NOT_ACTIVE`로 기록하고 frequency/intensity를 비활성으로 둔다 (`reports/review/OWNER_DECISION_PERSONALIZED_PRESCRIPTION_ALGORITHM_V2_2026-08-23.json:58-65`). 9/6 current scope는 기존 A/B 보조 시간 상한 변환만 기록하지만 reverse edge의 activation state를 명시적으로 해소하지 않는다 (`TRAINING_PLAN_CURRENT_SCOPE.md:5-12,50-55`). 따라서 **상태 불일치는 확정**, 이 volume 변환의 현재 최종 승인 여부는 문서만으로 확정 불가다. 변환 resolver는 합성으로 확인했으나 PB/SB successor의 전체 생성·사용자 확인·저장 트랜잭션은 이번 감사에서 실행하지 않았다. 빈도/강도 증가 edge는 registry에서 비활성이다.

## 지원 범위 한계

- 일반 RPE 생성은 종목별 자극 프로파일이나 800m 선수 간 프로파일 차이를 반영하지 않는다. 이벤트 거리는 신원/적격성에는 쓰이지만 generic RPE session-builder 출력에는 들어가지 않는 것이 이번 동일 배열 매트릭스로 확인됐다. 현재 채택 범위도 10km·하프·마라톤에 상세 템플릿이 없다고 적는다 (`TRAINING_PLAN_CURRENT_SCOPE.md:21-30`). 이는 승인된 숫자가 없는 영역에 처방을 발명하지 않는 제한이며, **일곱 종목이 같은 훈련으로 과학적으로 동등하다는 뜻도, 여기서 확인한 확정 코드 결함도 아니다.**
- 9.5일 formation ledger의 2/3 MAIN 노출은 화면의 QUALITY 처방 개수/날짜를 보증하지 않는다. 활성 계획 projection 계약은 이들을 별개로 둔다 (`specs/active/PLAN_GENERATOR_SPEC.md:1500-1519`). 따라서 ledger 숫자를 실제 품질 훈련 수로 세거나, 반대로 ledger를 맞추려고 QUALITY를 추가하는 것은 잘못이다.
- 월·중주기 phase 표시는 처방 변경이 아니다. 사용자 기록은 명시 선택된 동일 종목의 상세 template 외에는 generic RPE 계획을 개인화하지 않는다. 자동 taper, 부하 적응, 회복 판정, 일지 기반 증량은 검증되지 않았고 이 scope의 처방도 아니다.
- 새 LT pool은 9/28 단일 승인 조합에 대해서만 공급되고, 9/29 remaining-schedule 동작은 이미 저장된 계획의 제한된 사용자 승인 변경이다. 어느 것도 나머지 목적·종목·경험대의 검토 pool이 완성됐다는 증거가 아니다.

## 후속 연구·결정

- 과학 개념은 상위에서 제공한 primary review의 specificity (§5.2), individualization (§5.3), periodization (§5.4) 및 PubMed 34143410의 evidence-informed individual response monitoring 참조와 코드 동작을 분리한다. 이 감사는 논문 방법/결과를 독립 재검토하거나 숫자 정책으로 변환하지 않았다. [Sports Medicine review](https://link.springer.com/article/10.1007/s40279-021-01481-2), [PubMed 34143410](https://pubmed.ncbi.nlm.nih.gov/34143410/).
- 후속 정책 연구는 이벤트 × 선수 프로파일 × 실제 수행 반응을 어떤 구조화 근거로 구분하고 어떤 검토/채택이 필요한지 정해야 한다. `same-event` 기록 하나, 경험 밴드, 주기 표지만으로 적합성·회복·효과를 추론하지 않는다.
- 결정 항목: 마지막 반일과 two-a-day 선택의 결합 의미; reverse volume edge의 명시적 active 여부; 세션 위치/목적별로 periodization이 처방을 바꿀 권한과 근거. 승인 전에는 수치/빈도/강도/청소년 규칙을 바꾸지 않는다.

## 실행 및 미검증

- 기존 표적 실행: `app/node_modules/.bin/vitest.cmd run src/domain/plan-beta-flow.contract.test.ts src/domain/plan-beta-detailed-candidates.contract.test.ts src/domain/lt-pilot-runtime-v3.contract.test.tsx src/domain/execution-replan.test.ts` → 4 files, 47 tests PASS.
- 새 매트릭스: `app/node_modules/.bin/vitest.cmd run --config reports/review/plan-meaningfulness-20260930/vitest.config.ts` → 6 passed, 1 failed; 실패는 위 하루 2회 불일치다.
- 9일 경계 probe 추가: EVERY_DAY 가용일은 실제 day 1–9, QUALITY day 2·9, day 10은 REST; 추천 projection은 9일 및 MAIN 2회다. 9.5일 경계에서는 day 10이 visible day 10에 포함된다 (`app/src/domain/plan-beta-flow.ts:613-629`; 화면 day count `app/src/screens/plan-beta/PlanSchedulePreview.tsx:94`; 추천 projection filter `app/src/screens/plan-beta/instant-plan-projection.ts:16-29`).
- 미실행: 전체 Vitest/E2E·타입 검사·실기기/브라우저·실제 선수/계정·PB/SB successor 전체 저장 적용·운영 서비스 live 확인·논문 전문 재검토. 사용자 제공 과학 리뷰는 연구 적용 권한이 아니다.
