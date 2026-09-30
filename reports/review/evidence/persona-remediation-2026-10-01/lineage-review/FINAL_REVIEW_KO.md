# W2 순서·원본·다음 프레임 독립 통합 검수

## 결론과 증명 범위

- 요청 기준 HEAD: `55ffc3bef853eca462acee32d79b7153fe46c515`. 시작 시 추적 파일 변경 없음, 종료 시 HEAD 동일.
- **수정 전 합성 실행: 고유 경계 8개, PASS 4 / FAIL 4. 부모 B05 수정 반영 후: PASS 5 / FAIL 3.**
- 남은 실제 재현은 **B03 기존 원본 일지의 재계획 진입 차단, B06 다음 프레임 context 단절, B07 일반 다음 주기 계보 초기화**다.
- B05는 수정 전 저장 단계까지 재현했고, 검수 중 부모가 공유 보호 함수를 적용한 뒤 AM/SINGLE 두 변형 모두 보호됨을 재검수했다. 이 검수자가 제품을 수리한 것으로 보고하지 않는다.
- 최초·중간 일지 원본과 진행 결과는 반복 교체 및 두 변경 순서에서 보존된다. 원본 소실과 후속 기능 진입 차단은 별개다.
- public 함수 + 기존 fixture + 메모리 DOM/Storage/locks를 이용한 로컬 합성 실행이다. 실제 브라우저, 계정 저장, PostgreSQL, 운영 서버, 배포, 사용자 전달 또는 100명 전체 검수의 증거가 아니다.
- F01/F03 계정 응답·보존 12건은 재실행하지 않았다. SQL F02는 읽기·실행·수정하지 않았다. 부모의 F02 결과는 이 보고서의 독립 실행 수치에 합산하지 않는다.
- 도메인 숫자, 채택 상태, W1 강도·시간 정책, 제품 파일, 기존 증거, 디스크 생성 번들, Git 상태를 변경하지 않았다. 새 의존성·새 스레드·외부 통신 없음.
- 요청한 모델/최고 추론 설정을 바꾸거나 확인할 수 있는 도구가 없어 그 설정의 실행 증명은 제공하지 않는다.

## 8개 경계

| ID | 실행 경계 | 수정 전 | 부모 B05 수정 후 |
|---|---|---|---|
| B01 | 같은 미래 슬롯 2회 교체 후 최초·중간 일지 원본·결과·계보 조회 | PASS | PASS |
| B02 | 수행 재계획 → 수동 교체, 양쪽 원본/영수증/결과 보존 | PASS | PASS |
| B03 | 수동 교체 → 기존 과거 일지로 수행 재계획 진입 | FAIL | FAIL |
| B04 | 수동 교체 → 새 현재 버전 합성 일지로 수행 재계획, 기존 카탈로그 구조 보존 | PASS | PASS |
| B05 | 수동 교체 후 실제 날짜 일지·시간대 불명 일지의 재계획 보호 | FAIL | PASS |
| B06 | 교체 전 성공하던 명시적 다음 프레임 제안이 2회 교체 뒤에도 가능한가 | FAIL | FAIL |
| B07 | 일반 다음 주기 보관/재생성에서 원본·앞선 결과·program 계보 연결 | FAIL | FAIL |
| B08 | 교체 전에 수락한 다음 계획을 교체 후 재사용할 때 무쓰기 거절 | PASS | PASS |

UTC/KST 반복은 같은 8개 경계다. AM/SINGLE 두 변형과 결함주입도 새 경계 수에 합산하지 않는다.

## 실제 재현

### B05 · P1 · 기록된 미래 슬롯 보호 누락 · 부모 수정 후 해당 재현 PASS

**수정 전 위치:** `app/src/domain/execution-replan.ts:70-74` (HEAD 55ffc3b). 실제 일지 날짜·시간대가 아니라 `plannedSessionLink`가 있는 일지만 보호했다. 수동 경로의 `catalog-replacement.ts:12-22`는 실제 날짜/시간대도 보호하므로 두 경로가 달랐다.

**최소 재현:** `replanFixture()` → day 4 AM BASE 카탈로그 수동 교체 → 현재 버전 day 1의 합성 PARTIAL 일지를 재계획 근거로 추가 → 계획 링크 없는 `2026-09-30` 일지 추가 (AM 또는 SINGLE) → `prepareExecutionReplan(REDUCE)` → `applyExecutionReplan(..., true)`.

**관측:** 수동 보호 집합에는 day 3 AM이 있지만 수행 재계획 집합에는 없음. 저장 결과는 `applied`, 해당 슬롯의 기존 시간 범위 `20~30`이 `20~20`으로 바뀜. 일지 바이트 자체는 보존되지만 기록된 슬롯의 계획을 바꾸는 보호 위반이다. 수치는 기존 fixture 그대로이며 새 정책이 아니다.

**영향:** 수동 교체에서 보호된 실제 기록 슬롯을 다른 변경 경로로 변경할 수 있다. 이번 증거는 게스트 로컬 경로이며 계정 서버까지 통과했다고 주장하지 않는다.

**가장 작은 수정안:** 실제 날짜/AM·PM, 미지정·SINGLE의 하루 전체 보호, 연결 일지의 원래 날짜/시간대를 공유하는 보호 함수 하나를 두 경로에서 사용한다. 비교·완료·재계획 근거로 자동 연결하는 권한은 만들지 않는다.

**부모 변경 재검수:** [app/src/domain/recorded-plan-slots.ts:6](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/domain/recorded-plan-slots.ts:6>)와 [app/src/domain/execution-replan.ts:71](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/domain/execution-replan.ts:71>)의 공통 보호 적용을 읽기 전용으로 확인했다. v4에서는 AM/SINGLE 모두 `replanProtected=true`, 보호 슬롯 전후 `20~30` 유지. `applied`는 다른 변경 가능한 슬롯에 대한 적용이며 보호 슬롯 변경 성공이 아니다. 전체 SQL/서버/모든 시간대 승인으로 확대하지 않는다.

### B03 · P2 · 원본이 있어도 수동 교체 후 기존 일지로 재계획 불가

**위치:** [app/src/domain/execution-replan.ts:63](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/domain/execution-replan.ts:63>). `resolveCurrentPlannedSession`으로 현재 candidate의 링크만 인정하고, 정확히 보관된 과거 일지를 바로 차단한다.

**최소 재현:** `replanFixture()`의 day 1 PARTIAL 일지 → day 4 AM 수동 교체 → `readJournalOriginalPlan(oldEntry)` → 같은 `entryId`로 `prepareExecutionReplan`.

**관측:** 원본 조회는 `matched/ARCHIVED`, 전체 원본·progress와 세션은 최초 상태와 동일. 재계획만 `blocked`와 “이 기록은 이전 계획에 연결되어 있어요…” 반환. day 1은 실제로 변경하지 않았으며 준비 과정의 저장 쓰기는 없다. UTC/KST 일치.

**영향:** 관계없는 미래 훈련을 한 번 바꾸면 이미 남긴 수행 기록에서 이어지는 남은 일정 교정 흐름이 끊긴다. B04의 새 현재 버전 합성 일지는 기술적 호환 대조군일 뿐, 사용자에게 중복 기록이나 과거 링크 변경을 요구하는 해결책이 아니다.

**가장 작은 수정안:** 정확한 보관 원본으로 수행 비교를 계속하고, 검증된 변경 영수증/원본 체인으로 현재 계획과 같은 주기인지 및 해당 원본 occurrence가 보존됐는지 확인한 경우에만 현재 계획의 미래 슬롯 교정 근거로 사용한다. 적용 CAS·근거 지문·보호 집합은 현재 상태에 묶는다. 같은 날짜/슬롯만으로 연결하거나 기존 일지 링크를 재작성하지 않는다. 범용 과거 프레임 전체를 수용하도록 넓히지 않는다.

**분류:** 실행된 기능 연속성 공백. 저장 파손, 보존 실패 또는 안전 차단 우회가 아니다. 현재 코드의 명시적 current-only 경계이므로 의도된 지원 한계와 개선 요구를 분리한다.

### B06 · P2 · 2회 수동 교체 후 다음 프레임 context 단절

**위치:** [app/src/domain/plan-adaptation-ui.ts:80](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/domain/plan-adaptation-ui.ts:80>), [app/src/domain/plan-adaptation-ui-context.ts:180](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/domain/plan-adaptation-ui-context.ts:180>), [app/src/domain/catalog-replacement-store.ts:85](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/domain/catalog-replacement-store.ts:85>). 교체는 candidate ID를 갱신하지만 다음 프레임 후보 context는 기존 candidate ID에 그대로 남는다.

**대조군/최소 재현:** 기존 `baseRequest`·`canonicalFormation` fixture와 public `generatePlanCandidates`로 plain-RPE FIVE_K 계획을 생성 → public 선택/저장 및 `savePlanAdaptationContext` → 교체 전 `prepareNextFrameAdaptation(EXPLICIT_REQUEST)`는 `ready` → 미래 EASY 슬롯을 두 번 서로 다른 BASE 카탈로그로 교체 → 같은 public 준비 함수 재호출.

**관측:** 교체 전 `ready`, 교체 후 `unavailable/ADAPTATION_CONTEXT_UNAVAILABLE`. context 저장 바이트는 그대로이고 `activeCandidateId`는 현재 ID와 다름. 기존 day 1 일지 원본은 계속 정확히 보관 조회됨. UTC/KST 일치. B08 v4의 추가 대조군은 교체 전 수락·활성화까지 실제 실행하여 같은 program ID, frame 2, 원본 보관 1건을 확인했다.

**영향:** 교체를 명시적으로 수행한 뒤 기존 명시적 다음 프레임 제안 경로를 이용할 수 없다. 옛 제안을 강제로 적용하지 않고 막는 B08의 안전 동작은 올바르다.

**가장 작은 수정안:** 교체 후의 정확한 현재 계획을 기준으로 후속 context를 검증·재구성하고 옛 pending을 명시적으로 무효화한다. 카탈로그가 포함된 다음 계획에는 현재 승인된 transform만 허용하며, exact transform이 없다면 `UNAPPROVED_TRANSFORM` 등 실제 지원 한계를 표시하고 계보가 보존되는 별도 다음 계획 경로로 연결한다. context ID만 바꾸거나 카탈로그 구조를 임의 축소하는 수정은 허용되지 않는다.

**v1 한계:** 처음 사용한 `generatePlanFromDraft` 자동 카탈로그 대조군은 교체 전부터 `UNAPPROVED_TRANSFORM`이었다. 따라서 v1 B06/B08 실패는 W2 결함으로 세지 않는다. v2 이후는 기존 plain-RPE fixture의 교체 전 성공을 단언한 별도 증거다. 자동 카탈로그의 모든 다음 계획 수치가 승인됐다고 주장하지 않는다.

### B07 · P2 · 일반 다음 주기에서 program 계보 초기화 · W2 신규 회귀 아님

**위치:** [app/src/screens/plan-beta/PlanActiveState.tsx:95](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/screens/plan-beta/PlanActiveState.tsx:95>)의 보관 후 intake 복귀, [app/src/domain/plan-beta-store.ts:483](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/domain/plan-beta-store.ts:483>)의 요약 continuity, [app/src/domain/plan-beta-flow.ts:456](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/domain/plan-beta-flow.ts:456>)의 초기 program 생성.

**최소 재현:** 주기 context를 붙인 기존 `replanFixture` → 같은 미래 슬롯 2회 교체 → public `archiveAndClearActivePlanWithLock` → `loadPreviousContinuity` → public `generatePlanFromDraft` → `selectPlanForActivation` → 저장.

**관측:** 세 원본 보관, 최초 일지 원본 조회, 이전 `COMPLETED=1` continuity와 새 candidate의 `completed-1` 연결은 유지. 그러나 program ID는 `c11fbea…`에서 `91c1510…`로 바뀌고 `frameOrdinal=1/source=NEW_PLAN`으로 시작한다. “원본과 앞선 결과 전달”은 성공, “동일 program의 다음 프레임 연결”은 실패다.

**대조군:** 수동 교체 없이 같은 보관/재생성 경로를 실행해도 program ID가 새로 생성된다. 따라서 W2가 새로 만든 회귀로 보고하지 않는다. 반대로 B08 대조군의 승인 successor 활성화는 기존 `advancePeriodizationContext`를 통해 동일 program의 frame 2로 진행한다.

**영향:** 사용자가 일반 다음 주기 경로로 넘어갈 때 기존 장기 주기 방향과 단절된다. 다음 계획이 저장돼도 동일 program 계보가 이어졌다고 표시할 수 없다.

**가장 작은 수정안:** 일반 다음 주기 수락에서 검증된 종료 원본의 periodization을 명시적 predecessor로 전달하고 실제 활성화 시 기존 `advancePeriodizationContext`를 사용한다. 새 program 시작과 다음 frame 시작을 구분하고, 읽기/미리보기만으로 계보를 전진시키지 않는다. phase나 frame 위치로 수치를 올리거나 초안 계약을 승격하지 않는다.

## 통과가 증명한 것

- B01: `P-BASE-C → P-BASE-B` 두 교체 뒤 최초 및 중간 버전 일지를 정확한 전체 보관 원본으로 해석. 일지 바이트, 최초 progress, periodization 유지.
- B02: 수행 재계획 → 수동 교체 순서에서도 최초 원본과 재계획 receipt가 중간 보관본에 남음. 현재 계획에는 수동 receipt만 있어도 과거 해석은 보관본으로 가능.
- B04: 현재 버전의 별도 합성 기록을 근거로 수동 교체 → 재계획을 실제 저장했을 때, 교체한 카탈로그 전체 구조·진행 결과·계보와 두 과거 원본이 남음.
- B08: 교체 전 다음 계획의 준비·수락은 성공. 교체 후 기존 pending은 `CONTEXT_MISMATCH`로 거절되며 localStorage 전체 바이트와 현재 상태가 변하지 않음. v4는 교체 없는 승인 successor 활성화의 동일 program/frame 2/원본 보관 성공도 대조군으로 포함.

## 시험기와 결함주입

- 기존 설치된 esbuild/jsdom만 사용. 코드 묶기는 `write:false`와 data URL import로 **메모리에서만** 처리하고 디스크 번들은 만들지 않았다.
- 최초 로딩은 누락된 Supabase 하위 의존성 3개 때문에 실행 전에 중단됐다. 제품 발견으로 세지 않는다. 제외 범위의 Supabase client를 호출 즉시 실패하는 대역으로 차단하고 설치 없이 재실행했다.
- 새 Date/Storage/locks는 합성 시험기다. 실제 탭 동시성, 저장 quota, 브라우저 시작/종료, 계정 또는 DB 잠금 증명이 아니다.
- v3/v4는 외부 fetch를 실패시키고 `networkAttempts=0`을 확인했다.
- 제품 소스 수정 없이 메모리 결함주입:
  - 수동 교체 보관에서 `[archived, ...history]`를 `[archived]`로 변경: 기존 PASS였던 **B01·B02가 이름으로 FAIL**. 기존 실패 B06/B07의 원인도 원본 missing으로 변했으므로 별도의 신규 검출 개수로 합산하지 않는다.
  - 수행 재계획 보관에서 같은 결함: 기존 PASS였던 **B04가 이름으로 FAIL**.
- 모든 실행에서 해당 실행 전후 `app/src, impl/src, supabase, specs` 합산 소스 지문은 같았다. 실행 사이 부모의 수리가 진행돼 지문은 달라졌으므로 모든 실행을 하나의 동일한 깨끗한 HEAD 검증으로 묶지 않는다.
- baseline은 미해결 재현이 있어 exit 1이다. 이는 테스트가 실행되지 않은 실패가 아니라 JSON에 기록된 기대 경계 단언 실패다.
- B03/B06/B07 최소 수정안을 제품이나 메모리에 적용해 해결됐다고 주장하지 않는다. account context·서버 체인·18개 보관 한도·전체 프레임의 결과 이전은 추가 검수 범위이며 이번 시험으로 완료되지 않았다.
- 별도 정적 의심만으로 추가한 발견은 **0건**. 화면 callback과 서버로의 확대 가능성은 정적 경로/미실행 한계로만 남긴다.

## 실행 기록과 작성 파일

| 파일 | 내용 |
|---|---|
| `run-lineage-review.mjs` | 8개 public 함수 통합 경계, exclusive 증거 생성, 네트워크 차단, 메모리 결함주입 |
| `baseline-kst-v1.json` | 최초 실행. B06/B08 승인 대조군 실패 포함, 확정 결함 수치로 사용 금지 |
| `baseline-kst-v2.json` | 원본 HEAD KST, 성공 plain-RPE 대조군 이후 4 PASS / 4 FAIL |
| `baseline-utc-v2.json` | 원본 HEAD UTC, 같은 4 PASS / 4 FAIL |
| `baseline-kst-v3.json` | 원본 HEAD KST, 네트워크 0 확인, 같은 4 PASS / 4 FAIL |
| `mutation-drop-prior-archives-kst-v3.json` | 수동 보관 결함주입, B01/B02 검출 |
| `baseline-kst-v4.json` | 부모 B05 수리 반영 후 KST 5 PASS / 3 FAIL, 실제 successor 활성화 대조군 추가 |
| `baseline-utc-v4.json` | 부모 B05 수리 반영 후 UTC 5 PASS / 3 FAIL |
| `mutation-drop-prior-replan-archives-kst-v4.json` | 수행 재계획 보관 결함주입, B04 검출 |
| `FINAL_REVIEW_KO.md` | 이 보고서 |

모두 `.scratch/followup-w2-lineage-20261001/` 안의 신규 파일이다. 기존 결과를 덮어쓰지 않았다. 종료 시 부모가 수정한 제품/계약/서버 파일들은 읽기 전용으로 확인했으며 복원하거나 수정하지 않았다.

재실행은 출력 파일명을 새 이름으로 정해야 한다. 기존 JSON 이름을 재사용하면 실행기는 덮어쓰기를 거부한다.

```powershell
$env:TZ='Asia/Seoul'
& 'C:\Program Files\nodejs\node.exe' 'D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/.scratch/followup-w2-lineage-20261001/run-lineage-review.mjs' 'fresh-kst-result.json'
```

기준 소스 지문:
- 원본 HEAD v2/v3: `74251ead085d949f96d503f01b30177b4adbbdb145faba4a07b3eecda613348d`
- 부모 수리 중 KST v4: `e51e82a95c3eb34c377df3ff7511ddc3d6fc3e1fe3c6d4b30f01995d3d47f54b`
- 부모 수리 중 UTC v4/재계획 mutation: `419530c7598c4970266955a8da802ab2e7e0b3c86ec0aba598d4f1cd377d79e8`

