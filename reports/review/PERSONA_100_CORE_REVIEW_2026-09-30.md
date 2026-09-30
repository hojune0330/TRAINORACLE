# 100 Synthetic Persona Core Review

검토일: 2026-09-30. 기준 HEAD `9085282`, 런타임 기준 `8b80fa1`.
독립 적대적 검토이며 아래의 페르소나는 모두 합성 입력이다. 실제 사용자, 임상 검증, 운영 환경 검증으로 해석하지 않는다.
검토자가 런타임 파일을 수정하지 않았다. 진행 중 부모가 추가한 입력 경계와 화면 패치는 현재 작업 트리에서 재검증했다.

## Findings First

최종 후속 상태: **F3 미해결**, 기본 MAIN 상세 공급 부족(F4)은 기존 계수 유지. **F1/F2/F5는 부모 수정 후 2026-09-30 22:05 KST 좁은 재검증 3/3 green**이다. 아래의 원문 red는 역사적 증거로 보존하며 현재 미수정 상태로 읽지 않는다. 전체 100은 재실행하지 않았다.

### F1. P2: 같은 목적 추첨이 미관찰 방법을 소진하기 전에 반복한다 [원문 red, 부모 수정 후 좁은 green]

- 현재 수정 위치: [CatalogWorkoutPicker.tsx:120](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/screens/plan-beta/CatalogWorkoutPicker.tsx:120>)의 슬롯/적격 풀/입력 scope와 `:130`의 seen-history. 원문 red는 당시 `:119-122` 분기에서 발생했다.
- 계약: `SESSION_METHOD_SELECTION_AND_ADJUSTMENT_CONTRACT.md:1969-1976`, 용량 변형의 확률 부풀림 금지와 미관찰 적격 방법 우선 소진.
- `AUDIT-DRAW-NO-REPEAT`, seed `154148902`: 적격 방법 식별 6개인데 첫 6개 노출은 `X-VO2-07, X-VO2-08, X-VO2-07, X-VO2-11, X-VO2-06, X-VO2-08`이다. 고유 방법은 4개뿐이다.
- 원문은 현재 항목만 제외하고 이전 노출 집합을 관리하지 않았다. 부모는 슬롯과 적격 풀/입력 scope에 묶인 seen-history를 추가했다.
- 동일 seed의 후속 첫 6개는 `X-VO2-07, X-VO2-10, X-VO2-08, X-VO2-11, X-VO2-06, P-VO2-2`, 고유 방법 **6/6**이다. 10회 요청에서도 즉시 같은 방법 재등장이 없었다. 테스트의 시간 입력도 바인딩의 실제 originalEnvelope 상한 3000초로 맞췄다. 현재 방식의 방법 지문을 사용한 좁은 green이며 F3 해결이나 모든 history scope 전환의 전수 증명으로 확대하지 않는다.

### F2. P2: 적격 추첨 풀이 비면 미확인 후보로 fallback한다 [원문 red, invariant 정정 후 좁은 green]

- 현재 수정 위치: [CatalogWorkoutPicker.tsx:128](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/screens/plan-beta/CatalogWorkoutPicker.tsx:128>)의 empty alternatives 비활성화와 `:139`의 이유. 원문 red는 당시 `:121-122`의 `preferred.length ? preferred : options` fallback에서 발생했다.
- 원문 `AUDIT-DRAW-ELIGIBILITY`에서는 초보 ATP-PC 무작위 요청 후 `P-INTRO-ATP-T`가 선택되어 `ACCELERATION_AND_DECELERATION_SPACE`가 남았다. 부모는 unavailable fallback을 삭제했다.
- 계약 `:1965-1966`의 현재 조건에 적격한 풀과, 입력을 채워 볼 수 있는 탐색 목록이 혼합되어 있다.
- **위해성 경계:** 부적격 미리보기 선택은 재현했지만 조용한 적용/저장 성공은 재현하지 않았다. 미확인 요구가 있으면 `bindCatalogSession`이 null을 반환하는 방어는 100-persona 계산/바인딩 검사에서 확인했다. 화면도 `!next`일 때 적용을 비활성화한다는 코드가 있다. 이를 안전 상향 성공이라고 부르지 않는다.
- **검사 정정 근거:** 수동 목록은 추가 조건을 채울 수 있는 탐색 경로로 유지된다. 따라서 disabled 버튼 때문에 기존 미확인 선택이 그대로 남은 상태를 `result.unavailable === []` 위반으로 판단하면 잘못된 red다. 올바른 invariant는 적격 추첨 후보 0개일 때 버튼 비활성화 + 이유 + choice unchanged + 추첨/계획 적용 부작용 없음이다. 원문 fallback 결함 재현은 보존하고, 수정 후 판정만 이 경계로 정정했다.
- 후속 실행: 적격 후보 **0**, disabled **true**, 이유 표시, `P-INTRO-ATP-A` 선택 그대로, random 호출 **0**, 계획 적용 **0**. 수동 목록은 활성화되어 `P-INTRO-ATP-T`를 직접 고를 수 있지만 그것만으로 계획에 적용되지는 않았다. 이 invariant로 named test가 green이다.

### F3. P2: 동일 방법의 시간 변형이 서로 다른 방법 식별자로 계산된다 [실행 재현, 미수정]

- 위치: [all-workout-calculator.ts:233](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/impl/src/prescription/all-workout-calculator.ts:233>), `work: node.work`를 방법 지문에 포함한다.
- `AUDIT-DURATION-VARIANTS`: `X-BASE-01` 45분과 `X-BASE-03` 60분은 같은 선언 `methodGroup=BASE:EASY_CONTINUOUS`인데 서로 다른 지문이다.
- 경험/최근 장거리 확인 조건이 다른 것은 적격성 차이이지, 시간 수치만으로 새로운 방법을 만드는 근거가 아니다. 구조가 달라 실제로 다른 방법인 경우까지 합치라는 뜻도 아니다.
- 수정 범위: 검토된 방법군/구성 매핑을 추첨 단위로 쓰고 시간·거리·횟수 변형을 대표 구성으로 묶는 별도 판단이 필요하다. 현 지문은 기본 자동 생성에도 사용되므로 숫자 필드를 무조건 제외하면 생성 선택/용량 동작에 영향을 줄 수 있다. **숫자 무조건 제외 금지, 미해결 유지**. 이번 후속 실행에서는 F3를 재실행하거나 런타임 식별자를 바꾸지 않았다.

### F4. 기본 MAIN 상세 공급은 일부에 그친다 [실행 계수, 의도된 fallback과 정책 충돌을 분리]

- 위치: [catalog-session-binding.ts:87](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/impl/src/prescription/catalog-session-binding.ts:87>), 자동 입력은 기록 없음/확인 조건 없음. `:93`은 원래 RPE 상한을 넘는 구성을 제외하고 `:98`은 후보가 없으면 원래 범위 처방을 유지한다.
- 정상 생성 82개 중 MAIN이 있는 프로필은 57개다. 그중 **43/57 (75.4%)**는 최소 한 MAIN이 상세 카탈로그 바인딩 없이 남는다. 정상 생성 전체 분모로는 **43/82 (52.4%)**다.
- 첫 BALANCED 후보의 MAIN 슬롯 **66/85 (77.6%)**가 시간·RPE 범위만 있고 상세 바인딩은 **19/85 (22.4%)**다. MAIN 없는 BASE/REC 25개는 상세 MAIN 실패 분모에 넣지 않았다. A/B 두 후보 합산, 합성 100명 전체 비율, 임의 사용자 모집단 비율이 아니다.
- `P008`, seed `4169919918`: 합성 15세/800m/숙련/LT/9일/AM-PM에서 `3:AM`, `9:AM` 모두 RPE 5~6, 30~50분만 남는다. `P015` VO2 DEVELOPING에서는 최단 적격 시간형 `P-VO2-2-4`도 2420초여서 원래 2400초 상한을 넘는다.
- **위해성 경계:** 상한을 지키고 불완전한 상세 공급을 범위 처방으로 남긴 동작이다. 자동 증량 또는 누락 구간을 완성값으로 저장한 성공은 관찰하지 않았다. 화면에서 완전한 상세 MAIN처럼 보이는 문제의 수정/브라우저 증명은 부모 작업의 별도 증거이며 이 도메인 결과로 대체하지 않는다.

| MAIN 목적 | 초보 상세/전체 슬롯 | DEVELOPING 상세/전체 슬롯 | 숙련 상세/전체 슬롯 | 실제 제외 근거 |
| --- | ---: | ---: | ---: | --- |
| LT | 0/4 | 0/6 | 0/9 | 원래 RPE 5~6, 카탈로그 LT 최대 7. 모든 20개 구성에서 자동 RPE 상한 제외. 시간/경험/미정 구간 사유도 겹침 |
| GLY | 0/4 | 0/7 | 0/6 | 원래 RPE 7~8, 카탈로그 GLY 최대 9. 모든 13개에서 자동 RPE 상한 제외. 초보에는 경험 제외도 적용 |
| ATP-PC | 0/5 | 0/7 | 0/5 | 모든 18개에 가속·감속 공간 확인 필요. 일부 미정 거리 시간/언덕 조건/시간 초과도 적용 |
| VO2 | 4/4 | 0/6 | 5/5 | DEVELOPING에 종목·경험 적격인 5개는 모두 2400초 초과. 최단 2420초 |
| MIX | 3/3 | 0/7 | 7/7 | DEVELOPING 적격 시간형 2개는 2840/3200초로 2400초 초과. 다른 항목은 경험/시간/미정 입력 등으로 제외 |

목적/경험의 모든 교차 조합을 이 표에서 관찰했다. 입력 종목별 세부 제외 이유는 compact 요약에 있으며, 여러 사유가 한 구성에 겹치므로 사유 건수를 서로 다른 사용자 수나 실패 수로 더하면 안 된다.
부모의 후속 우선순위는 부분 MAIN의 표시 진실성을 보장하는 것이다. 공급을 채우려고 RPE 상한을 높이거나 새 반복·회복·용량을 발명하면 안 된다. LT/GLY 범위와 카탈로그 의도의 정책 정합성은 별도 오너 검토 대상이다.

### F5. P3: limitations 데이터 형식과 선언이 다르다 [원문 red, 부모 수정 후 좁은 green]

- 위치: [all-workout-calculator.ts:14](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/impl/src/prescription/all-workout-calculator.ts:14>)는 원문에서 `limitations: string`이었다. 부모가 실제 **117/117 배열**과 맞는 `readonly string[]`로 수정했다.
- [CatalogWorkoutDetail.tsx:20](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/screens/plan-beta/CatalogWorkoutDetail.tsx:20>)는 이제 제한 문장마다 별도 `li`를 렌더한다. 원문 자체가 쉼표 문자열인 것은 아니었다.
- `P-LT-C` 근거 뷰 렌더 텍스트에서 두 제한 문장이 `...않았어요.,계획의...`로 이어지는 것을 확인했다. 내용 자체의 삭제나 위해성 성공은 입증하지 않았다.
- 후속 `AUDIT-LIMITATIONS-LIST`에서 전체 117개 배열 형태와 `P-LT-C`의 제한 문장 2개가 각각 원문 그대로 별도 목록 항목으로 표시되는 것을 확인했다. 문자열 보간에 의한 배열 쉼표 연결은 이 재현에서 해소됐다. 117개 모두의 브라우저 화면을 전수 렌더한 것은 아니다.

### 별도 브라우저 결함 P042 [부모 실행 증거, 이 감사에서 독립 재실행하지 않음]

부모가 `calculatedWorkoutSequence`의 거리 회복에 seconds를 함께 넣어 표시 구조의 V3 제약과 충돌하는 문제를 2개 red로 재현했고 수정 중이라고 전달했다. 산술 계산 결과가 유효한 것과 렌더용 구조가 파서를 통과하는 것은 별도 조건이다. 이 감사의 100개 원본에서 표기는 기록했지만 모든 렌더 반환 구조를 별도 V3 파서에 재입력하는 assertion은 없었다. 따라서 100-persona green을 P042의 반증이나 화면 표기 전수 green으로 쓰지 않는다. 부모의 red/green 영수증과 브라우저 재검증이 이 건의 판정 근거다. 전달 직전 해당 표시 함수에 부모 변경이 보였으나 추가 전체 실행은 하지 않았다.

## 수정 후 Green: 누락 안전 확인값 경계

수정 전 P020/P039/P058/P077/P096은 `unknown` 합성 fixture가 실제 `PlanCurrentCheck`의 누락값 `undefined`로 전달되어 생성됐다. P020 seed는 `1432723954`다. 별도 행렬의 undefined/null/UNKNOWN/빈 문자열에서는 활성화 선택, 저장, reload도 성공했다.

이 경로는 누락 확인값이 `CURRENT_CHECK_TEXT[값]`의 undefined가 된 뒤, [D9 evaluator.ts:378](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/impl/src/d9/evaluator.ts:378>)의 `D9_COLLOQUIAL_NO_TEXT`와 [signal.ts:61](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/impl/src/rve/signal.ts:61>)의 CLEARED 매핑으로 넘어간 것이다.

**판정 정정:** fixture 이름 unknown은 실제 D9 UNKNOWN 판정이 아니었다. 빈 자유문장 자체의 비차단 의미를 바꾸어야 한다는 증거가 아니다. [PlanBeta.tsx:507](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/screens/PlanBeta.tsx:507>)의 null 확인 화면 차단이 있으므로 사용자 UI 우회나 실제 위험 상태의 승인으로 입증되지 않았다. 현재 미해결 P1로 주장하지 않는다.

부모가 [plan-beta-flow.ts:383](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/domain/plan-beta-flow.ts:383>)에 넣은 좁은 검사 후 5개 페르소나가 모두 차단됐고, undefined/null/UNKNOWN/빈 문자열/false 행렬 모두 `CURRENT_CHECK_REQUIRES_REVIEW`다. `REVIEW_REQUIRED` 대조군도 차단된다. D9 코어와 signal 파일에는 기준 대비 diff가 없었다. 오래된 기록의 근거 뷰 경고도 부모 수정 후 실행 green이다.

## 실행 결과

| 실행 | 결과 | 증거 경계 |
| --- | --- | --- |
| 최초 전체 100-persona 실행 | 95 통과, 누락 확인값 5 실패 | 수정 전 증거 별도 보존. 당시 추가 named 실패/fixture 오류는 최종 수치와 분리 |
| 공식 opt-in 전체, 21:37:17 KST, 196.01초 | **111 tests: 108 통과 / 3 실패** | 당시 100 페르소나 전부 통과, coverage 1 + named 10. 역사적 실패 F1~F3 |
| 후속 확인, 21:43:09 KST, 41.54초 | **3 통과 / 108 미실행** | 안전 확인 행렬, 오래된 기록 표시, 117 실제 슬롯 경로와 기본 MAIN 제외 행렬 |
| 부모 F1/F2/F5 수정 후, 22:05:12 KST, 7.59초 | **3 통과 / 109 미실행** | F1 비반복, F2 empty eligible invariant 정정, F5 목록 렌더. F5 named 추가로 발견 테스트 수는 112. 전체 100 재실행 아님 |
| 이전 설치된 TypeScript 검사 | exit 0 | 부모가 지적한 union/ByRoleOptions/readonly 오류 수정 후, 기본 MAIN 보조 증거 추가 후 재검사 |
| F1/F2/F5 후속 TypeScript 검사 | exit 1 | 감사 파일 진단 0. 부모 새 `app/src/screens/plan-beta/catalog-presentation.contract.test.tsx:59:41` TS2345, `:65:42` TS2322: `activePlan.kind`의 PlanCandidateKind와 BETA_ACTIVE_PLAN_SNAPSHOT 불일치. 부모 파일은 수정하지 않음 |

- 서로 다른 합성 입력 100개, 기본 카탈로그 행 **100 x 117 = 11,700**, 명시 입력 재계산까지 **23,400**. 이것을 서로 다른 훈련 방법 수로 부르지 않는다.
- 독립 ledger 검사 1,550,902회. 난수 교체 시도 **984회 = 정상 생성 82 x 12**. 저장/재로드 등 전체 action artifact 행은 **1,562개**다.
- 생성 결과: 정상 82, 입력 누락 거절 6, 안전 확인 차단 12. 마지막 12는 명시 위험 확인 7과 누락 확인 5다. 위험 생성 0, 외부 fetch 호출 0.
- 117개 실제 경로는 **각 ID마다 선언된 적격 종목/경험 한 조합**에서만 측정했다. 요구 조건을 합성으로 명시 확인하고, 미정 구간에는 명시 합성 계획초를 제공하며 긴 구성은 정확한 총시간 확인을 수락했다. **116 BOUND_SAVED_RELOADED + 1 PLANNED_OFF**였다.
- 따라서 117개 모두에 연결 경로가 있다는 좁은 증거는 있지만, **117개가 모든 개인에게 현재 입력만으로 즉시 실행 가능하다는 증거는 아니다**. 100명 각각에게 117개를 저장시켰다는 뜻도 아니다.

## 독립 검사와 한계

기존 테스트의 통과 여부를 UX 근거로 쓰지 않았다. 카탈로그 원본 트리를 별도 weighted ledger와 순서 확장으로 해석하여 회복 N-1, terminal recoveryAfter, set 경계, 준비/정리/지원 구간, 전체 합계, work-only 거리, 소수 비반올림을 계산 결과와 비교했다. 원본 복사본의 회복 삭제와 목표 초 반올림을 실제로 주입한 positive control에서 독립 검사가 실패하는 것도 확인했다. 런타임은 변조하지 않았다.

기록 기반 수치는 실제 채택 계약의 산술만 독립 유도했다. 초단거리/언덕/대체운동/거리 회복에 경기 페이스가 무단 적용되지 않는지, absent/stale 기록 사용 금지, 미정 총시간을 0으로 만들거나 바인딩하지 않는지 검사했다. 재생성 결정성, 원래 자동 RPE/시간 envelope, 목적/슬롯/다른 일정 보존, 취소/복원, 명시 긴 시간 확인, 계획 선택/파싱/저장/reload, legacy-shaped 범위 처방의 무단 backfill 없음도 검사했다. 카탈로그 처방의 단순 시간 clamp는 거절되고 whole-slot 저강도 대체는 원문대로 보존되는 경로를 검증했다.

연령 12/15/17/22/34/51/67을 포함했지만 실제 API의 연령값이 아니라 합성 메타데이터와 학년/부문이다. 청소년별 생리학적 적합성이나 모든 금기, 장기 주기 안전성을 검증했다고 주장하지 않는다. 7/9/10일, daily와 AM/PM, 7종목, 3경험, 7목적, 기록 absent/current/stale/decimal의 각 범주는 포함했으나 가능한 모든 교차 조합을 전수 검사한 것은 아니다. 금기 fixture는 기존 `REVIEW_REQUIRED` 경계의 명시 확인이며 임상 증상 데이터가 아니다.

모든 페르소나는 새 JSDOM Window와 합성 localStorage를 사용했다. 실제 Chromium 화면, 모바일 접근성, 사용자 계정, cloud 저장, 운영 데이터, 배포, 오래된 실제 사용자 저장본, 모든 PACE_TARGET 정책 경로는 이 감사의 증거 범위 밖이다. 임의 숫자는 테스트 배관용 명시 입력이며 생리학적 권장 목표가 아니다.

## 재현과 전달 파일

`app` 디렉터리에서 설치된 Vitest를 사용한다. 설치/환경파일 읽기/외부 서비스 연결이 필요하지 않다.

```powershell
node ./node_modules/vitest/vitest.mjs run --config vitest.persona-100.config.ts
```

특정 과거 5개와 경계 행렬만 재실행하려면:

```powershell
node ./node_modules/vitest/vitest.mjs run --config vitest.persona-100.config.ts --testNamePattern 'P020|P039|P058|P077|P096|AUDIT-CURRENT-CHECK-FAIL-CLOSED' --outputFile ../.scratch/persona-100-core/vitest-boundary-results.json
```

고정 시간 `2026-09-30T03:00:00.000Z`, root seed `0x09302026` = `154148902`, 개별 seed `(rootSeed ^ imul(index+1, 0x9e3779b1)) >>> 0`.

- 감사 파일: `app/src/domain/plan-persona-100.audit.ts`. `.test.ts`가 아니므로 기본 `src/**/*.test.{ts,tsx}`에서 제외된다.
- 공식 명시 include: `app/vitest.persona-100.config.ts`. `envDir:false`, scratch cache, 단일 worker. 기본 CI 설정과 부모의 빠른 회귀 파일은 수정하지 않았다.
- 이번 좁은 명령: `node ./node_modules/vitest/vitest.mjs run --config vitest.persona-100.config.ts --testNamePattern 'AUDIT-DRAW-NO-REPEAT|AUDIT-DRAW-ELIGIBILITY|AUDIT-LIMITATIONS-LIST' --outputFile ../.scratch/persona-100-core/vitest-f1-f2-f5-results.json`. compact `regressions.json`에는 이전 전체 실행 red와 최신 좁은 green을 별도 필드로 보존한다.
- 최신 TypeScript 진단은 compact `latestNarrowTypecheck`에 별도로 보존했다. 세 기능 테스트의 green과 공유 작업 트리 전체 타입 검사 결과를 혼합하지 않는다.
- 커밋 후보의 compact 자료: `reports/review/evidence/persona-100-core/personas-100.summary.json` 정확히 100행, `default-main-coverage.summary.json` 목적/경험/원인 집계, `regressions.json` red/green 영수증·과거 경계 재현·117 경로 상태·패키징 시점 소스 SHA256. 대용량 계산 원본을 제외한 compact 3파일이다. 공유 작업 트리에 후속 부모 변경이 있으므로 SHA256은 패키징 스냅샷이며 전체 실행 시점의 불변 소스 영수증으로 주장하지 않는다.
- 대용량 원본: `.scratch/persona-100-core/Pxxx-seed.json` 100개, 원본 11,700행과 재계산 입력/순서/행동, `summary.json`, Vitest JSON 영수증, 세부 named/matrix 증거. 이 원본을 전부 커밋하거나 stage하지 않았다.
- `.scratch/persona-100-core/package-evidence.mjs`로 compact 자료를 재생성할 수 있다. 포커스 실행은 전체 100개 summary를 덮어쓰지 않는다.

## 후속 우선순위

1. 부분 MAIN의 표시 진실성을 유지한다. 완성된 카탈로그 구성과 범위 안내/추가 입력 필요 상태를 구분한다. 부모의 화면 회귀 및 별도 브라우저 감사가 담당한다.
2. 부모가 수정한 F1/F2 적격 추첨/seen-history와 F5 배열 목록의 좁은 green을 회귀로 보존한다. 없는 공급을 임의 처방으로 채우지 않는다.
3. 미해결 F3 방법군 매핑을 기본 생성에 대한 영향과 함께 검토하고 LT/GLY 자동 envelope 정합성을 오너 판단으로 정리한다. 숫자 무조건 제외와 감사 수치를 채우기 위한 자동 상향은 금지한다.
4. 누락 안전 확인값과 오래된 기록 경고의 fast green 회귀는 기본 단위 테스트에 유지한다. P042 표시 구조 검증은 부모의 별도 영수증으로 판정한다.

검토자 소유 변경은 새 감사 파일/전용 설정/본 보고서/compact 증거/.scratch 하위에만 있다. 다른 작업자의 소스 변경을 되돌리거나 편집하지 않았고 브랜치 생성, commit, push, deploy, 운영 쓰기를 하지 않았다.
