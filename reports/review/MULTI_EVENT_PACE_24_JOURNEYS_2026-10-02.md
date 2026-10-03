# 다종목 페이스 24개 생애주기 브라우저 검증

날짜: 2026-10-02. 공유 작업 트리의 로컬 합성 데이터 검증이며 커밋/푸시/배포하지 않았다.

## 최신 fix2: 목표 4개와 수정 후 하프 2개 전체 여정 PASS

2026-10-03 KST. 부모의 목표 초기 후보 수정 및 하프 거리 정규화 수정 후 요청된 MEP-08/09/10/11과 MEP-06/13을 순차 실행했다. **6개 모두 PASS, 각 완료 단계 6/6, fullLifecycle true, pageerror 0**을 최종 JSON receipt에서 확인했다. skip/flaky 0, retries 0이다. 이전 전체 24개 13/11 결과와 아래의 하프 수정 전 실패 이력은 보존하며, 이를 최신 단일 24개 실행 PASS로 바꾸지 않는다.

### 실행과 종료

작업 경로는 이 release 폴더만 사용했다. app에서 `C:\Users\admin\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe`로 `node_modules/@playwright/test/cli.js test -c playwright.multi-event-pace.config.ts`를 실행했다. 포트 4597, workers 2, 기존 timeout/예산/동의/필수 assertion은 유지했다.

| 실행 | 추가 인수 | 핸들 / 종료 | 시작 UTC / 총 소요 | 결과 |
| --- | --- | --- | --- | --- |
| 목표 4개 | `--grep 'MEP-(08|09|10|11) ' --output=test-results/multi-event-pace-fix2-goal-four` | 99354 / exit 0 | 2026-10-03T00:13:29.440Z / 295555.202ms | 4 PASS |
| 수정 후 하프 2개 | `--grep 'MEP-(06|13) ' --output=test-results/multi-event-pace-fix2-half-two` | 1985 / exit 0 | 2026-10-03T00:18:50.263Z / 142000.025ms | 2 PASS |

| 사례 | 전체 여정 | 테스트 소요 | 추가 확인 |
| --- | --- | --- | --- |
| MEP-08 | PASS 6/6 | 67.196s | 800m 목표 입력/명시적 기준 확인/숫자 MAIN/변경/수정/일지/후속 저장 |
| MEP-09 | PASS 6/6 | 67.498s | 1500m 목표, 일부 수행 일지 포함 |
| MEP-10 | PASS 6/6 | 53.715s | 3000m 목표 |
| MEP-11 | PASS 6/6 | 53.544s | 5000m 목표, 일부 수행 일지 포함 |
| MEP-06 | PASS 6/6 | 54.060s | 하프 실제, 375px, 과예산 차단 및 후속 기준 UI 확인 |
| MEP-13 | PASS 6/6 | 54.218s | 하프 목표, null 날짜, 일부 수행, 과예산 차단 및 후속 기준 UI 확인 |

PASS 출력 직후가 아니라 실행기 종료와 JSON 저장까지 기다렸다. 목표 실행 종료 후에만 하프 실행을 시작했다. 모든 핸들을 종료 회수했고 최종 4597 listener 0개를 확인했다. 진행 중인 테스트나 남겨 둔 서버는 없다.

### 다음 주기 판정과 변경 범위

- 이미 연결된 다음 주기 후보는 `prepareInitialRecordPaces`가 기존 `paceReferences`를 덮어쓰지 않으므로 최초 페이스 제안이 비활성일 수 있다. 버튼 재클릭 대신 기존 `assertBoundSuccessor`의 실제 선택 기록/숫자 검증을 유지했다. 비활성 버튼만으로 통과하지 않는다.
- 하프 두 사례 모두 기존 후보 5일차 AM의 `RP-HALF-DISTANCE`, 선택된 원본 기록 ID, 5310.25초 / 21097.5m, 1km 원시 구간 시간 **251.70043844057352초**, `RACE_AVERAGE_V1`을 UI와 독립 산술로 대조했다. 기록 재선택이나 편집 적용 없이 검증했다.
- 실제는 ACTUAL 및 달성일 2026-10-02, 목표는 GOAL/ASPIRATIONAL_TARGET 및 null 날짜가 저장된 후속 MAIN에 유지됐다. `이 일정으로 시작`으로 실제 수락한 새 계획의 시작일은 2026-10-12다. 이전 계획 보관본 정확히 1개와 원본 전체 일치, 기존 일지 불변, 새로고침 후 계획/이력/일지 일치를 확인했다.
- 이번 작업의 spec 추가 변경은 후보 확인 중 불변 검사에 RECORDS를 포함하고, 후속 저장 후 새로고침한 숫자 MAIN을 다시 독립 검증하여 수락 직후 숫자와 대조한 것이다. fixture는 변경하지 않았다. 이미 존재하던 다음 주기 helper와 보존 검증은 유지했다.
- 제품 런타임, config/setup, 예산 상한, 재시도 정책은 이 작업에서 변경하지 않았다. 부모 수정의 브라우저 결과이지 이 작업이 런타임을 수정했다는 뜻이 아니다. 추가 전체 테스트, 빌드, 커밋, 푸시, 배포는 하지 않았다. 인증 계정/운영 증거가 아닌 합성 게스트 로컬 UI 증거다.

### fix2 증거 보존

- 목표 JSON: `app/test-results/multi-event-pace-fix2-goal-four-4pass.json`; SHA256 `02B57C3CF140F7761C2A07974C1396407AE0AFCB51E081E382B82F6125ABA12F`.
- 수정 후 하프 JSON: `app/test-results/multi-event-pace-fix2-half-two-2pass.json`; SHA256 `E9D746BA3E4DD0DBD977CD3D0BE8DB20C49F0D50BE3BB91D563E3CF146A571FE`. 기본 `multi-event-pace-lifecycle.json`은 이 2개 실행이다.
- 각 실행 output 폴더에 `saved-journal.png`, `successor.png`가 있다. 하프에는 `overbudget-blocked.png`도 있다. JSON에는 `lifecycle-stage-receipt`, `successor-accepted-receipt`, 하프의 `successor-bound-ui-receipt`와 `overbudget-branch-receipt`가 있다.
- 이번 spec SHA256 `88B844D29519C05D18FB78670278CA3288BB82AA11C813718F365D79BF140F05`; 변경하지 않은 fixture SHA256 `F5E8E42FDD9DEB3B28E9B309D1A280E48A10EF753133FD127554059AC148CF25`.
- 최초 요청으로 이미 시작돼 있던 fix2 장거리 7개는 핸들 82463, exit 1, **5 PASS / 2 FAIL**로 끝까지 회수했다. 시작 2026-10-03T00:08:13.033Z, 소요 289107.547ms. MEP-05/07/12/14/18은 6/6, 하프 06/13은 수정 전 선택기에서 5/6 실패, 과예산 차단은 7/7, pageerror 0이다. 실행 후반 부모 수정의 HMR이 있었으므로 고정된 최종 코드 단일 실행으로 주장하지 않는다. 이후 성공한 5개를 추가 반복하지 않았다.
- 해당 수정 전 JSON: `app/test-results/multi-event-pace-fix2-seven-5pass-2fail.json`; SHA256 `C8E61B93DDF2907770D05C7586E2A5D733BB5082C7E14B0D43913072E723AB23`. output은 `app/test-results/multi-event-pace-fix2-seven`이다. 수정 후 하프 PASS로 이 실패 파일을 덮어쓰지 않았다.

사례별 최신 targeted 결과로는 요청된 11개 모두 전체 여정 PASS 증거가 있다. **24개 범위의 결합 증거는 이전 전체 실행의 13개 PASS + 후속 targeted 11개 PASS이다. 단일 24개 재실행 결과가 아니다.** 이전 13개는 MEP-01/02/03/04/15/16/17/19/20/21/22/23/24, 후속 11개는 MEP-05/06/07/08/09/10/11/12/13/14/18로 서로 중복되지 않는다. 단일 최신 코드에서 11개 또는 24개를 한꺼번에 재실행했다는 뜻은 아니며, 이전 13개의 최종 코드 재검증을 주장하지 않는다.

## 이전 장거리 7개 targeted 실행: 5 PASS / 2 FAIL

2026-10-03 KST. 부모 요청에 따라 MEP-05/06/07/12/13/14/18만 처음부터 전체 UI 여정으로 실행했다. 새 전체 24개 실행은 하지 않았다. MEP-08~11의 첫 GOAL MAIN 수정/검증은 부모 소유이며 이번 결과에 포함하지 않는다. 아래의 전체 24개 13/11 결과를 24개 PASS로 소급 변경하지 않는다.

### spec 수정과 증명 범위

- 초기 기록 입력/첫 계획 수락/기록 갱신/명시적 적용/실제 수정/일지 저장·읽기와 느린 기록 과예산 차단을 그대로 유지했다. fixture와 제품 코드는 이번 후속 작업에서 변경하지 않았다.
- 장거리 후속 후보에서는 비활성 최초 페이스 제안 버튼을 무조건 재클릭하지 않는다. 대신 기존 후보의 5일차 AM catalog ID와 현재 선택된 기록 ID를 UI에서 읽는다. 기록 선택값이나 편집 구성을 바꾸지 않고 source 초, 날짜 또는 null, 실제/GOAL 설명, 종목을 확인한다.
- 펼친 `기준 기록·계산식`의 원시 초/거리와 `반올림 전 구간 시간`을 읽고 `sourceSeconds * segmentDistance / eventDistance`에 소수 8자리까지 독립 대조한다. 달력의 실제 후보 MAIN 표시도 확인한다. 후보 검사 중 PLAN/HISTORY/JOURNAL 저장 문자열이 바뀌지 않아야 한다. 비활성 버튼 존재만으로 통과하지 않는다.
- 이후 `이 일정으로 시작`을 실제 클릭하고 새 candidate ID, 2026-10-12 시작일, 저장된 모든 숫자 MAIN의 source ID/초/종목/model 및 ACTUAL/GOAL 역할을 검증한다. source 날짜도 정확히 대조한다. 이전 candidate의 보관본은 정확히 1개이며 `originalPlan` 전체가 수정 후 이전 계획과 같아야 한다. 새로고침 후 후속 계획·보관 이력·기존 일지가 모두 동일해야 완주다.
- `tsc --noEmit -p tsconfig.e2e.json` exit 0. 소유 파일 범위 `git diff --check` exit 0. 예산 상한, 동의, 적용 검증, skip/expected-failure, retry 정책은 변경하지 않았다.

### 정확한 사례별 결과

| 사례 | 결과 | 완료 단계 | 과예산 차단 | 실행 시간 | 후속 증거/실패 |
| --- | --- | --- | --- | --- | --- |
| MEP-05 | PASS | 6/6 | PASS | 47.492s | ACTUAL 2370.75초 / 10000m, 1km 237.075초; 수락·저장·이력·일지 불변 |
| MEP-06 | FAIL | 5/6 | PASS | 49.213s | 하프 후속 편집기에서 RP-HALF-DISTANCE 구성/기준 선택기 없음 |
| MEP-07 | PASS | 6/6 | PASS | 56.161s | ACTUAL 11248.25초 / 42195m, 1km 266.57779357743806초; 수락·저장·이력·일지 불변 |
| MEP-12 | PASS | 6/6 | PASS | 56.468s | GOAL 2370.75초 / 10000m, 1km 237.075초; 목표 역할/null 날짜 유지 |
| MEP-13 | FAIL | 5/6 | PASS | 55.099s | 하프 후속 편집기에서 RP-HALF-DISTANCE 구성/기준 선택기 없음 |
| MEP-14 | PASS | 6/6 | PASS | 47.607s | GOAL 11248.25초 / 42195m, 1km 266.57779357743806초; 목표 역할/null 날짜 유지 |
| MEP-18 | PASS | 6/6 | PASS | 31.196s | ACTUAL 2370.75초 / 10000m, 1km 237.075초; 날짜 미입력 null 유지 |

선택/종료 7, PASS 5, FAIL 2, skipped/flaky/interrupted/retry 모두 0. 모든 pageerror 배열은 비어 있고 module-not-found는 없다. PASS 5개는 `fullLifecycle: true`, 후속 UI 기준 receipt와 실제 수락 receipt가 각각 존재한다. FAIL 2개는 `fullLifecycle: false`이며 후속 수락/저장까지 도달한 것으로 계산하지 않는다. 7개 모두 명시적 과예산 차단 receipt가 있고 첫 계획부터 일지 읽기까지는 통과했다.

### 남은 하프 UI 문제: 부모 전달

- MEP-06(375px)과 MEP-13(1280px) 모두 5일차 AM을 검사할 때 `이 구성은 현재 조건에서 고를 수 없어요. 현재 훈련은 그대로예요. 다른 날짜를 확인해 주세요.`가 나타난다. `훈련 구성` combobox 자체가 없으므로 기존 catalog/기록 ID의 UI 단언이 실패한다. 화면 크기나 의존성 누락에 한정된 실패가 아니다.
- `app/src/screens/plan-beta/CatalogWorkoutPicker.tsx:107`은 `e.eventDistances.includes(intake.eventDistanceM)`로 정규화 없이 후보를 필터링한다. 이 테스트는 기존 intake UI 값 21097을 선택한다. 반면 `impl/src/prescription/all-workout-catalog.json`의 `RP-HALF-DISTANCE`는 `eventDistances: [21097.5]`, family MIX, experience EXPERIENCED, hold null이다. 따라서 이 비교에서 저장된 하프 구성은 제외된다. `CatalogWorkoutPicker.tsx:155-159`는 선택된 기존 binding을 pool에서 찾지 못하면 위 상태 메시지만 반환한다.
- 실패 화면의 처방 요약은 기록/목표 페이스가 연결됐다고 표시한다. 그러나 이번 테스트는 정확한 기존 기준의 UI 확인에서 멈췄으므로 **후속 계획 저장 자체가 잘못됐다고 단정하지 않는다.** 하프 두 사례의 실제 후속 수락·숫자·보관본 검증은 아직 미완료다. 검사를 삭제하거나 다른 기록을 재선택해서 우회하지 않았다. 제품 수정은 부모 소유로 남겼다.

### 실행 이력과 증거

1. 새 helper의 첫 targeted 실행: 0 PASS / 7 FAIL, 각 5/6, 과예산 차단 7/7, pageerror 0. `getByLabel(..., exact: true)`가 중첩 select 옵션 텍스트 때문에 `바꿀 일정`을 찾지 못한 spec locator 오류다. 실제 접근성 snapshot의 `combobox "바꿀 일정"`과 실패 스크린샷을 확인하고 세 select locator만 `getByRole("combobox", { name, exact: true })`로 수정했다. 이 실패는 제품 PASS로 재분류하지 않고 보존한다. 시작 `2026-10-02T16:06:22.177Z`, 소요 `347625.867ms`, runner 80205 exit 1.
2. 수정 후 targeted 실행: 위의 5 PASS / 2 FAIL. 시작 `2026-10-02T16:14:13.551Z`(KST 01:14:13.551), 소요 `221486.049ms`, runner 93134 exit 1. 2 workers, retries 0. 선행 runner 종료 후에만 시작했고 중복/재시작하지 않았다.
3. 명령: release app에서 지정 Node24로 `node_modules/@playwright/test/cli.js test -c playwright.multi-event-pace.config.ts --grep 'MEP-(05|06|07|12|13|14|18) ' --output=test-results/multi-event-pace-nextcycle-seven-verified`. 첫 locator 진단의 output은 `test-results/multi-event-pace-nextcycle-seven`이다.
4. 최신 JSON 보존: `app/test-results/multi-event-pace-nextcycle-seven-5pass-2fail.json`, SHA256 `CE0A0E56FF7D70C8A1A85022A4365E02E5B879237870FEF7526E895F41B96C86`. 기본 `multi-event-pace-lifecycle.json`도 이 7개 실행 결과다. `successor-bound-ui-receipt`, `successor-accepted-receipt`, `lifecycle-stage-receipt`, `overbudget-branch-receipt`를 직접 읽어 위 집계를 확인했다.
5. locator 실패 JSON: `app/test-results/multi-event-pace-nextcycle-seven-locator-0pass-7fail.json`, SHA256 `914BCE97774C82CEBEEE7F0EE1C5F6DD9390795C65AA2BE380741D4AF023A287`. 이전 전체 실행 JSON/trace도 보존돼 있다.
6. 최종 spec SHA256 `7E1324373B59EB75F0C7A0234C6C9B9C15BB880E38DFB3F77DC0F09B7D83EC3C`; fixture SHA256 `F5E8E42FDD9DEB3B28E9B309D1A280E48A10EF753133FD127554059AC148CF25`(변경 없음). 모든 시작한 명령을 종료 회수했고 4597 listener 0개를 확인했다. 새 전체 UI/빌드/대규모 테스트/커밋/푸시/배포는 하지 않았다.

## 이전 독립 release 전체 실행: 13 PASS / 11 FAIL

2026-10-03 KST 후속 검증. 작업/증거 기준 경로는 `D:\admin\Documents\ChatGPT\트레인 오라클\TRAINORACLE-multi-event-pace-release-20261002`로 옮겼다. 원래 공유 junction이나 의존성에는 쓰지 않았다. 이 절은 targeted 재검증 전의 전체 실행이며 아래의 13/11 원래 실행과 0/24 환경 오류 이력은 별도 보존한다. 이전 실행 절의 상대 증거 경로는 원래 `TRAINORACLE-oracle-exploration-20260921` 기준이다.

### 환경과 실행

- `app/node_modules`는 junction이 아닌 물리 디렉터리다. Node v24.19.0에서 `postcss`, `zod`, `vite`, `@playwright/test`를 이 release 경로로 resolve하고 실제 로딩했다. 사전 검사 exit 0.
- setup의 `fileURLToPath(new URL("..", import.meta.url))`는 해당 release의 app을 가리킨다. helper는 `/e2e/fixtures/multi-event-pace-lifecycle.ts`, 브라우저 허용 origin은 `http://127.0.0.1:4597`이다. setup/config 경로 수정 없이 이동 가능함을 확인했다.
- `--list --reporter=list`는 고유한 24개, 파일 1개를 수집하고 exit 0으로 종료했다. 이는 UI 실행 PASS가 아니다.
- 전체 명령: app 폴더에서 지정 Node24로 `node_modules/@playwright/test/cli.js test -c playwright.multi-event-pace.config.ts --output=test-results/multi-event-pace-independent-release`. 2 workers, retries 0. 전체 실행은 한 번만 시작했고 재시작/중복 실행하지 않았다.
- JSON 시작 `2026-10-02T15:22:10.800Z`(KST 2026-10-03 00:22:10.800), 소요 `837218.849ms`(약 14.0분). 선택/종료 24, PASS 13, FAIL 11, skipped 0, flaky 0, interrupted 0, retry 0. runner 세션 `41570`의 exit 1을 회수했다. 종료 뒤 4597 listener 0개를 확인했다.
- 24개 receipt를 모두 읽었다. PASS 13개는 각각 완료 단계 6개, `fullLifecycle: true`. 장거리 7개는 각각 5/6 및 `overBudgetVerified: true`, 목표 800~5000m 4개는 각각 1/6이다. 모든 receipt의 브라우저 pageerror 배열은 비어 있다. 이 실행에 module-not-found 환경 실패는 관측되지 않았다.
- 이번 release 실행에서는 테스트/fixture/제품 코드와 setup/config를 수정하지 않았다. 보고서 및 생성된 실행 증거만 갱신한다. 빌드·다른 대규모 검사·backend 재생성·커밋·푸시·배포는 실행하지 않았다. 부모가 별도로 보고한 tsc/diffcheck 통과와 이 UI 결과를 합쳐 PASS로 표현하지 않는다.

### 정확한 사례별 결과

| 사례 | 결과 | 완료 단계 | 예산 초과 분기 | 실패 지점 |
| --- | --- | --- | --- | --- |
| MEP-01 | PASS | 6/6 | 해당 없음 | 없음 |
| MEP-02 | PASS | 6/6 | 해당 없음 | 없음 |
| MEP-03 | PASS | 6/6 | 해당 없음 | 없음 |
| MEP-04 | PASS | 6/6 | 해당 없음 | 없음 |
| MEP-05 | FAIL | 5/6 | PASS | 다음 주기 재적용 버튼 비활성 |
| MEP-06 | FAIL | 5/6 | PASS | 다음 주기 재적용 버튼 비활성 |
| MEP-07 | FAIL | 5/6 | PASS | 다음 주기 재적용 버튼 비활성 |
| MEP-08 | FAIL | 1/6 | 해당 없음 | 첫 수락 계획의 숫자 MAIN 0개 |
| MEP-09 | FAIL | 1/6 | 해당 없음 | 첫 수락 계획의 숫자 MAIN 0개 |
| MEP-10 | FAIL | 1/6 | 해당 없음 | 첫 수락 계획의 숫자 MAIN 0개 |
| MEP-11 | FAIL | 1/6 | 해당 없음 | 첫 수락 계획의 숫자 MAIN 0개 |
| MEP-12 | FAIL | 5/6 | PASS | 다음 주기 재적용 버튼 비활성 |
| MEP-13 | FAIL | 5/6 | PASS | 다음 주기 재적용 버튼 비활성 |
| MEP-14 | FAIL | 5/6 | PASS | 다음 주기 재적용 버튼 비활성 |
| MEP-15 | PASS | 6/6 | 해당 없음 | 없음 |
| MEP-16 | PASS | 6/6 | 해당 없음 | 없음 |
| MEP-17 | PASS | 6/6 | 해당 없음 | 없음 |
| MEP-18 | FAIL | 5/6 | PASS | 다음 주기 재적용 버튼 비활성 |
| MEP-19 | PASS | 6/6 | 해당 없음 | 없음 |
| MEP-20 | PASS | 6/6 | 해당 없음 | 없음 |
| MEP-21 | PASS | 6/6 | 해당 없음 | 없음 |
| MEP-22 | PASS | 6/6 | 해당 없음 | 없음 |
| MEP-23 | PASS | 6/6 | 해당 없음 | 없음 |
| MEP-24 | PASS | 6/6 | 해당 없음 | 없음 |

### 읽기 전용 실패 조사와 부모 전달

1. **목표 첫 계획 연결 미완: MEP-08~11.** 목표 기록 영구 저장·역할·거리·null 날짜 검사는 통과했다. 그러나 첫 수락 계획의 숫자 MAIN이 0개여서 spec 70행의 필수 단언이 실패한다. 실패 화면도 `처방 기준 · 시간·체감 강도 기준`을 표시한다. `instant-plan-entry.ts:35,40`은 GOAL_ONLY를 저장한 뒤 recordId를 null로 반환하고, `PlanBeta.tsx:1154,1173`은 CURRENT_RECORD만 생성 입력/기준 확인에 연결한다. `PlanCandidates.tsx:254,341`의 상세 기준 UI도 selectedDetailedTemplateRef 조건을 따른다. 이들은 현재 짧은 목표 입력 경로를 조사할 정확한 코드 지점이며, 목표를 현재 능력으로 취급하라는 뜻이 아니다. 별도 숨겨진 수동 UI 경로 전체가 불가능하다고 확장하지 않는다. 이 실행 경로의 미충족 결과는 FAIL로 유지한다.
2. **장거리 후속 재적용 테스트 가정과 UI 안내: MEP-05/06/07/12/13/14/18.** 일지 열람까지 완료하고 06단계의 `confirmNumeric`에서 spec 131행 `offer.click()`이 비활성 버튼을 눌러 timeout된다. `initial-record-pace.ts:33-34`는 이미 paceReferences가 있는 MAIN을 최초 제안에서 제외한다. `InitialRecordPaceOffer.tsx`는 null offer를 비활성 버튼과 `이 기록은 현재 훈련 구성에 적용할 수 없어요`로 표시한다. 따라서 이미 연결된 후보에 최초 적용을 다시 요구하는 helper와, 이미 연결됨/실제 부적격을 구분하지 못하는 UI 안내가 원인 후보다. **후속 계획을 수락하지 못했으므로 저장된 다음 주기의 정확한 source ID/초/종목/목표 역할·일지 불변은 아직 검증하지 않았다.** 버튼 click을 건너뛰었다는 이유만으로 PASS 처리하면 안 된다. 부모가 처리할 후속 단계는 기존 바인딩을 정확히 확인한 뒤 실제 수락·필수 숫자 단언·새로고침·과거 일지 불변까지 완료하는 경로다.
3. 제품 런타임은 읽기 전용으로 조사했다. 실행 중 단계별 현황과 두 실패 유형을 부모에게 전달했다. 새 전체/부분 UI 실행은 시작하지 않았으며 이 실행 뒤 남아 있는 명령이나 전용 서버는 없다.

### 추가 차단 분기 증거

장거리 7개 모두 자동 차단 안내, 제외 사유 펼침, 적용 버튼/확인 checkbox 부재, 원본 계획·일지 byte 단위 불변, 새로고침 뒤 느린 경기 기록 보존을 통과했다. 이어 유효한 빠른 기록의 자동 미리보기/명시적 적용, 실제 비-MAIN 수정, MAIN 숫자 보존, 일지 저장·열람까지 완료했다. 이것을 7개 전체 생애주기 PASS와 혼동하지 않는다.

| 사례 | 기존 최대 초 | 느린 기록 적용 시 독립 예상 최대 초 |
| --- | --- | --- |
| MEP-05/12/18 (10km) | 3200.625 | 3216.875 |
| MEP-06/13 (하프) | 3279.8909823438794 | 3298.791325986491 |
| MEP-07/14 (마라톤) | 3351.078326815973 | 3369.267685744756 |

각 증거는 5일째 AM, 거리 MAIN 5회 기준이며 product budget을 바꾸지 않고 비교했다. 7개의 `overbudget-branch-receipt`와 `overbudget-blocked.png`가 생성됐다. MEP-05 차단 화면은 추가로 직접 열어 사유와 적용 버튼 부재를 시각 확인했다. 로컬 개발 도구 overlay가 포함된 화면이지 운영 배포 화면은 아니다.

### 독립 실행 증거 식별

- 당시 JSON: `app/test-results/multi-event-pace-lifecycle.json`; 보존 사본: `app/test-results/multi-event-pace-independent-release-13pass-11fail.json`. SHA256 `50667EACA40E37B4548B023BB186E40FED7C259786FE5950AA987DAB1BEC4BC7`. 현재 기본 JSON은 상단 targeted 실행 결과다.
- 화면/실패 trace: `app/test-results/multi-event-pace-independent-release/` 아래 사례별 폴더. MEP-18 폴더는 긴 이름이 축약된 `multi-event-pace-lifecycle-cbf19-long-RP-update-retains-null`이다.
- spec SHA256 `8C936487B46C430C6202F736F8E15559286B15DAA19EE89A000C0AA03757B178`; fixture SHA256 `F5E8E42FDD9DEB3B28E9B309D1A280E48A10EF753133FD127554059AC148CF25`. 실행 전후 일치한다.

## 구현 상태와 실행 경계

- 24개 독립 전체 생애주기는 유지한다. 장거리 성공 입력을 기존 기록보다 빠른 값으로 바꾸고, 원래 느린 입력은 같은 사례 안의 필수 시간 예산 초과 차단 분기로 보존했다. 음성 경로만 검사하는 별도 사례로 전체 생애주기를 대체하지 않는다.
- MEP-05/06/07/12/13/14/18의 03단계는 `느린 기록 저장 -> 차단 안내 자동 노출 -> 사유 펼쳐 읽기 -> 적용 버튼/확인 체크박스 없음 -> 계획·일지 불변 -> 새로고침 -> 기록은 저장됨/계획은 그대로 -> 빠른 기록 저장 -> 정상 미리보기/명시적 적용` 순서다. 이후 수정·일지 작성·열람·다음 주기를 모두 수행해야 완주다.
- 읽기 전용 fixture가 저장된 동일 종목 거리 MAIN의 각 반복 거리와 원본 기록 초로 총시간 차이를 독립 계산한다. 느린 기록은 기존 `acceptedDurationSeconds` 또는 원래 시간 상한을 초과하고, 빠른 기록은 그 이하여야 한다. 타이머 기반 MAIN이나 빈 계산 결과로 차단 검사를 통과시키지 않는다. 제품의 예산·동의·검증 규칙은 수정하지 않았다.
- 성공/차단 모두 자동 안내 노출이 필수다. 성공 경로의 이전 soft assertion/수동 열기 fallback은 제거했다. 안내가 누락되면 실패이며, 실패를 skip/expected-failure로 숨기지 않는다.
- 새 receipt는 `overBudgetRequired`/`overBudgetVerified`를 분리한다. 여섯 단계, 필수 차단 분기, assertion 오류 없음이 모두 충족돼야 `fullLifecycle: true`다. 차단 화면과 상세 예산 receipt도 개별 테스트 출력에 남긴다.
- 부모 전달 상태: 게스트 목표 저장/하프 정규화 수정, blocked PROPOSAL_INVALID 자동 안내 및 제외 사유 표시 UI 2/2, 동일 페이스 actual -> goal 의미 변경을 포함한 페이스 검사 111/111, 앞선 145개 묶음의 기록 화면 파일 34/34 통과. 이는 부모가 전달한 단위/UI 결과이며 이 작업의 새 브라우저 완주 증거가 아니다.
- accepted-duration 오거부 수정은 다른 에이전트 소유다. 부모가 전용 17개 + 관련 182개 통과 및 tsc 0, duration 에이전트 READY를 전달하고 전체 실행을 승인했다. 승인 후 전체 24개를 선택해 실행했으나 공유 의존성 오류로 **0 PASS / 24 FAIL, exit 1**로 종료됐다. 아래의 **13 PASS / 11 FAIL**은 이전 실행 이력이며 삭제하거나 새 결과와 합산하지 않는다.

### 이번 변경의 사전 확인과 실행 이력

- 변경 분류: E2E/fixture 및 보고서만 변경한 WIP 검증. 안전 예산을 직접 검증하지만 제품 런타임·배포 설정은 수정하지 않았다.
- 지정 Node `C:\Users\admin\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe`로 `node_modules/typescript/bin/tsc --noEmit -p tsconfig.e2e.json` 실행, exit 0 회수.
- 첫 `--list --reporter=list` 시도는 공유 `node_modules` 연결의 최종 대상이 비어 있어 CLI MODULE_NOT_FOUND로 종료했다. 브라우저 테스트 실패나 실행 24개로 집계하지 않는다. 의존성을 설치/교체하지 않았다. 후속 읽기에서 연결 대상이 비어 있지 않은 폴더로 변경됨을 확인한 뒤 실행했다.
- 이전 JSON을 `app/test-results/multi-event-pace-lifecycle.previous-13pass-11fail.json`으로 보존했다. 원본과 사본의 SHA256은 `77C60DFBA89F3CAD6C87A54F3533DDA1A271AF326B421F1584D87910240A5AF2`로 일치한다. 24개 개별 receipt를 다시 읽어 13개 6/6 완주, 11개 미완주, 재시도 0을 확인했다.
- 실제 전체 명령은 app 폴더에서 위 Node로 `node_modules/@playwright/test/cli.js test -c playwright.multi-event-pace.config.ts --output=test-results/multi-event-pace-budget-redesign`. 기존 trace 출력 폴더는 덮어쓰지 않는다. 이 실행은 24개, 2 workers, retries 0이다.
- 빌드·전체 단위 테스트·CI·배포·운영/실계정 검증은 실행하지 않았다. 부모의 런타임 검사 결과와 새 로컬 브라우저 결과를 분리한다.

## 이전 실행 결과: 공유 의존성 환경 오류

JSON 시작 시각 `2026-10-02T15:04:53.983Z`(KST 2026-10-03 00:04:53.983), 실행 시간 `111287.289ms`. runner 집계: 선택 24, PASS 0, FAIL 24, skip 0, flaky 0, interrupted 0. 앱 테스트 본문 진입 2, worker 시작 실패 22, 전체 생애주기 완료 0, 추가 시간 예산 초과 분기 도달/검증 0/7이다. worker 시작 실패를 실제 UI 생애주기 실행으로 세지 않는다.

- MEP-01/02: Vite가 `postcss` 및 `zod` 모듈을 불러오지 못해 앱 로딩 실패. 최초 `주 탭 -> 계획` 탐색이 timeout됐으며 receipt는 0/6, `fullLifecycle: false`다.
- MEP-03..24: `playwright/package.json` 누락으로 worker가 code 1로 종료됐다. 각 결과 duration 0ms, 생애주기 receipt 없음. 제품 로직이나 성공/차단 분기를 실행한 결과가 아니다.
- 실행 중 공유 연결의 최종 대상은 `TRAINORACLE-journal-calendar-release-20261002/app/node_modules`였다. 종료 후 `postcss/package.json`, `postcss/lib/postcss.js`, `zod/index.js`, `playwright/package.json` 모두 부재를 다시 확인했다. 부모도 원래 `app/node_modules` junction에서 TypeScript가 사라진 동시 환경 변경을 전달했다. 누가/어떤 작업이 파일을 바꿨는지는 이 보고서에서 추정하지 않는다.
- 반복 환경 오류를 확인하고 이 실행 세션에만 종료 입력을 보냈으며, 회수한 최종 상태는 runner의 `24 failed`, exit 1이다. `53131` 종료와 전용 4597 포트 listener 0개를 확인했다. 이 작업에서 시작한 다른 명령도 모두 종료됐다. 다른 작업자의 UI/프로세스·공유 의존성·junction은 수정/삭제/재시작하지 않았다.

| 사례 | 이번 runner 결과 | 이번 UI 완료 단계 | 실패 구분 |
| --- | --- | --- | --- |
| MEP-01 | FAIL | 0/6 | 앱 로딩 환경 오류 |
| MEP-02 | FAIL | 0/6 | 앱 로딩 환경 오류 |
| MEP-03 | FAIL | 본문 시작 못함 | worker 모듈 누락 |
| MEP-04 | FAIL | 본문 시작 못함 | worker 모듈 누락 |
| MEP-05 | FAIL | 본문 시작 못함 | worker 모듈 누락 |
| MEP-06 | FAIL | 본문 시작 못함 | worker 모듈 누락 |
| MEP-07 | FAIL | 본문 시작 못함 | worker 모듈 누락 |
| MEP-08 | FAIL | 본문 시작 못함 | worker 모듈 누락 |
| MEP-09 | FAIL | 본문 시작 못함 | worker 모듈 누락 |
| MEP-10 | FAIL | 본문 시작 못함 | worker 모듈 누락 |
| MEP-11 | FAIL | 본문 시작 못함 | worker 모듈 누락 |
| MEP-12 | FAIL | 본문 시작 못함 | worker 모듈 누락 |
| MEP-13 | FAIL | 본문 시작 못함 | worker 모듈 누락 |
| MEP-14 | FAIL | 본문 시작 못함 | worker 모듈 누락 |
| MEP-15 | FAIL | 본문 시작 못함 | worker 모듈 누락 |
| MEP-16 | FAIL | 본문 시작 못함 | worker 모듈 누락 |
| MEP-17 | FAIL | 본문 시작 못함 | worker 모듈 누락 |
| MEP-18 | FAIL | 본문 시작 못함 | worker 모듈 누락 |
| MEP-19 | FAIL | 본문 시작 못함 | worker 모듈 누락 |
| MEP-20 | FAIL | 본문 시작 못함 | worker 모듈 누락 |
| MEP-21 | FAIL | 본문 시작 못함 | worker 모듈 누락 |
| MEP-22 | FAIL | 본문 시작 못함 | worker 모듈 누락 |
| MEP-23 | FAIL | 본문 시작 못함 | worker 모듈 누락 |
| MEP-24 | FAIL | 본문 시작 못함 | worker 모듈 누락 |

현재 JSON `app/test-results/multi-event-pace-lifecycle.json`의 SHA256은 `45E0306494DD87EB3806556352BB532F2C70A06984974E91FA3676E7827D2B28`다. 이번 출력 폴더는 `app/test-results/multi-event-pace-budget-redesign`이다. 이전 실패 근거 JSON/trace는 별도로 보존했다. 실패를 예상 실패·skip·PASS로 전환하지 않았다.

**준비된 테스트와 fixture는 새 UI 검증 완료가 아니다.** 부모가 조사 중인 의존성 환경이 안정화된 뒤 전체 24개와 필수 차단 7개를 다시 실행해야 한다. 현재 추가 실행이나 백그라운드 작업은 없다.

## 증거 경계

- 24개는 산술 단위 테스트가 아니라 각자 빈 브라우저 저장소에서 시작하는 독립 생애주기 정의다.
- 실제 앱 화면으로 기록 입력, 첫 계획 수락, 기준 변경 미리보기/수락, 훈련 수정, 일지 작성/열람, 후속 계획 수락을 수행한다.
- 브라우저는 루프백 개발 서버만 허용한다. 모든 기록은 합성 자료다. 실계정, 운영 서버, 배포 검증이 아니다.
- MEP-22는 저장 범위 변경 후 오래된 제안의 적용 차단을 검사한다. 로그인 화면이나 서버 계정 간 왕복 저장 검증은 아니다.
- MEP-23은 게스트 오프라인 적용, MEP-24는 로컬 저장 실패 후 명시적 재시도다. 서버 CAS/네트워크 재시도 검증으로 확대 해석하지 않는다.
- 긴 거리 사례는 동일 종목 RACE_PACE 및 호환 MIXED_INTENT MAIN 경로만 다룬다. 임의 LT/VO2 변환, 모든 훈련 목적 조합, 모든 경험 단계의 보장은 없다.

## 구현과 판정

각 테스트는 다음 여섯 단계가 모두 성공해야 `fullLifecycle: true`를 기록한다. 건너뛰기나 예상 실패를 통과로 계산하지 않는다.

1. UI 기록 입력과 영구 저장, 출처/날짜/실제-목표 분리.
2. 실제 첫 계획 수락, 비어 있지 않은 MAIN, 원본 기록 ID/초/종목과 독립 산술값, 달력 상세 표시.
3. 장거리 7개에서는 느린 시간 예산 초과 기록의 명시적 차단/계획 불변 확인 후 유효한 빠른 기록 입력. 전 사례에서 자동 미리보기 동안 계획 불변, 명시적 적용 후 계획 변경/일정 및 비-MAIN 보존, 새로고침 후 유지.
4. UI에서 허용된 비-MAIN 훈련을 실제 수정, 미리보기 동안 불변, 수락 후 MAIN 및 숫자 보존.
5. MAIN 일지 작성, 실제 AM/PM 및 계획 AM/PM 링크 분리, 저장된 일지 화면 열람.
6. 후속 계획 실제 수락과 새 기준 숫자, 새로고침 후 유지, 과거 일지 불변.

## 24개 정의

| ID | 주요 차이 |
| --- | --- |
| MEP-01 | 800m 실제 121.5초, 124.25초로 변경 |
| MEP-02 | 1500m 실제 241.25초, 좁은 화면 |
| MEP-03 | 3000m 실제 541.75초 |
| MEP-04 | 5000m 실제 1111.5초, 좁은 화면 |
| MEP-05 | 10000m 실제 2401.25초 -> 2370.75초 적용; 2433.75초 예산 초과 차단 |
| MEP-06 | 하프 실제 5400.5초 -> 5310.25초 적용; 5480.25초 차단; intake 21097 / 기록 21097.5 |
| MEP-07 | 마라톤 실제 11401.75초 -> 11248.25초 적용; 11555.25초 차단 |
| MEP-08 | 800m 명시적 목표 기록 |
| MEP-09 | 1500m 명시적 목표, 일부 수행 일지 |
| MEP-10 | 3000m 명시적 목표 |
| MEP-11 | 5000m 명시적 목표, 일부 수행 일지 |
| MEP-12 | 10000m 목표 2401.25초 -> 2370.75초 적용; 2433.75초 차단 |
| MEP-13 | 하프 목표 5400.5초 -> 5310.25초 적용; 5480.25초 차단; 일부 수행 일지 |
| MEP-14 | 마라톤 목표 11401.75초 -> 11248.25초 적용; 11555.25초 차단 |
| MEP-15 | 최근 느린 실제가 오래된 PB 및 빠른 목표보다 우선 |
| MEP-16 | 최근 추천과 다른 PB를 명시적으로 선택 |
| MEP-17 | 날짜 없는 빠른 실제를 최근/최근 12개월 최고로 오인하지 않음 |
| MEP-18 | 10000m 날짜 미입력 실제 2433.75초 차단 후 2370.75초 적용; null 날짜 보존 |
| MEP-19 | 같은 날짜의 서로 다른 실제 기록 충돌과 명시적 선택 |
| MEP-20 | 최근 12개월 포함/제외 경계와 최근 추천 구별 |
| MEP-21 | 오전 계획과 오후 실제 링크, 일부 수행, 320px |
| MEP-22 | 합성 계정 저장 범위 전환 시 오래된 제안 차단 |
| MEP-23 | 게스트 오프라인 적용 후 재연결 |
| MEP-24 | 한 번의 로컬 저장 실패 후 명시적 재시도 |

## 실행

전용 명령: app 폴더에서 지정된 Node24 실행 파일로 `node_modules/@playwright/test/cli.js test -c playwright.multi-event-pace.config.ts`.

공통 경로 점검에서는 MEP-01이 기록/첫 계획/변경/수정/일지 열람까지 통과했다. 후속 기준을 명시적으로 다시 선택하지 않은 테스트 결함을 수정했다. MEP-05 첫 계획의 2401.25초 -> 1km 240.125초 독립 계산은 앞선 실행에서 통과했다. 최근 점검의 선택 목록 탐색 오류는 접근성 역할 기반 선택으로 수정했다. 이 초기 점검은 완주로 집계하지 않는다.

## 이전 단일 실행 결과: 13 PASS / 11 FAIL 보존

기존 실행을 끝까지 회수했다. 구현 24개, 실행/종료 24개, PASS 13개, FAIL 11개, skip 0개, flaky 0개. 실행 시간 876751.549ms (14.6분), JSON 시작 시각 2026-10-02T13:54:11.345Z. 각 PASS의 첨부 receipt는 완료 단계 6개 및 `fullLifecycle: true`임을 JSON에서 다시 읽어 확인했다.

| 사례 | 결과 | 완료 단계 | 분류 |
| --- | --- | --- | --- |
| MEP-01, 02, 03, 04 | PASS | 6/6 | 실제 기록 전체 생애주기 |
| MEP-05, 07, 18 | FAIL | 2/6 | 바인딩된 MAIN의 새 기록 자동 미리보기 미노출; 원인 확인 필요 |
| MEP-06 | FAIL | 0/6 | 게스트 하프 기록 거리 저장 오류 |
| MEP-08, 09, 10, 11, 12, 13, 14 | FAIL | 0/6 | 게스트 목표 기록 저장 누락 |
| MEP-15, 16, 17 | PASS | 6/6 | 최근/PB/날짜 미입력 구별 |
| MEP-19, 20, 21 | PASS | 6/6 | 같은 날짜 충돌/기간 경계/AM-PM 및 일부 수행 |
| MEP-22, 23, 24 | PASS | 6/6 | 합성 저장 범위/오프라인/로컬 실패 재시도 |

이전 실행 당시 증거는 `app/test-results/multi-event-pace-lifecycle.json`이었다. 이번 실행 전 `app/test-results/multi-event-pace-lifecycle.previous-13pass-11fail.json`으로 사본과 해시를 보존했다. 이전 스크린샷 및 실패 trace도 기존 `app/test-results/multi-event-pace-lifecycle` 폴더에 남겼다. 현재 기본 JSON은 위의 환경 오류 실행 결과이므로 이전 13/11 근거로 혼동하지 않는다.

### 이전 실행 종료 뒤 테스트 정리 이력

- 새 기록 저장 뒤 미리보기가 자동으로 열리지 않으면 해당 기록 행의 `이 기록으로 페이스 변경 보기`를 명시적으로 클릭한다. MEP-05/07/18에 해당한다.
- 정정: 명시적 버튼이 존재한다는 사실만으로 자동 미리보기 미노출을 테스트 결함이라 단정할 수 없다. 같은 종목 기록으로 바인딩된 MAIN에서 새 기록 자동 안내는 별도 제품 요구다. fallback 전에 필수 자동 미리보기 soft assertion을 추가해, 누락 시 테스트는 실패로 남기되 명시적 버튼을 통해 후속 생애주기 증거도 수집하게 했다. fallback 성공만으로 이 요구를 PASS 처리하지 않는다.
- helper의 분기 추론을 `flatMap<NumericRow>`로 명시했다.
- MEP-17에서 unknown option 존재를 먼저 필수 assertion으로 확인하도록 보강했다. 없는 옵션을 빈 배열로 간주하지 않는다.
- MEP-22의 타 계정 저장 확인에 실제 `activePlanBetaStorageKey()`를 사용하도록 바꿨다.
- 위 네 수정 뒤 브라우저 재실행이나 추가 타입 검사를 시작하지 않았다. 부모의 런타임 준비 확인 후 재실행해야 한다. 위 13 PASS는 수정 전 실행 결과이며 보강된 assertion의 검증 완료를 뜻하지 않는다.
- 게스트 목표/하프 런타임 수정은 부모 소유이며 이 작업에서는 건드리지 않았다. 실패를 skip/expected-failure로 바꾸지 않았다.

위 항목은 당시 정리 이력이다. 이번 설계 수정은 상단 재실행 준비 상태를 따른다. MEP-05/07/18의 느린 새 기록은 확인한 시간 예산을 초과하는 음성 경로로 남기며, 자동 차단 안내가 보여야 한다. 빠른 새 기록의 정상 자동 미리보기/적용은 별도 필수 대조군이다. 이전 FAIL을 새 PASS로 소급 변경하지 않는다.

### 실행 핸들 정리

48538의 Playwright가 최종 13 passed / 11 failed를 출력하고 셸 프롬프트로 돌아온 것을 확인했다. 48538과 91066은 모두 exit로 종료했고 종료 응답을 확인했다. 두 핸들은 에이전트 범위여서 부모가 직접 사용할 수 없었다. 새 테스트는 시작하지 않았고 전용 Vite 서버는 globalSetup teardown이 정리한다.

### 실행 중 확인한 통합 차단점

- MEP-06: 실행 당시 하프 intake 선택값 21097이 경기 기록에도 그대로 저장됐다. 요구값은 21097.5다. 부모가 이후 게스트 목표 저장 및 새 하프 기록 정규화/중복 방지를 수정했다고 전달했다. 이 보고서의 실행 결과는 해당 수정의 브라우저 재검증이 아니다.
- MEP-08..14: `목표만 있어요` 입력 후 첫 계획까지 진행해도 RACE_GOAL 기록이 저장되지 않았다. 실행 당시 `app/src/domain/instant-plan-entry.ts:29`가 CURRENT_RECORD 이외를 저장 없이 반환했다. 계정용 `account/instant-plan-record-save.ts`에는 목표 저장/거리 정규화가 있어 게스트 경로의 통합 차이다. 부모의 후속 수정은 이 실행으로 검증하지 않았다.
- MEP-05/07/18: 02단계에서 비어 있지 않은 저장 MAIN의 source ID/초/동일 종목 및 독립 숫자 계산을 통과했으므로 단순한 RPE 대체 계획은 아니었다. 새 동일 종목 기록 저장 뒤 자동 변경 미리보기가 노출되지 않았다. UI에 명시적 버튼이 있어 진행 대체 경로를 추가했지만 자동 안내 요구 미검증은 별도 유지한다. 원인을 테스트 결함 또는 특정 런타임 버그로 단정했던 이전 문구를 철회한다.
- 현재 읽은 `app/src/screens/AthleteRecords.tsx:182-193`은 PACE_TARGET뿐 아니라 catalog `paceReferences`의 동일 종목 거리도 확인하며, `prepareCurrentPaceUpdate`가 ready일 때 자동 미리보기를 연다. 현재 코드가 5000만 지원한다고 볼 수 없다. 실패 실행 당시 판정 및 preview 준비 결과와의 연결 원인은 부모의 통합 확인 대상이다. 이후 재실행은 아직 시작하지 않았다.

## 산출물

- `app/e2e/multi-event-pace-lifecycle.spec.ts`
- `app/e2e/fixtures/multi-event-pace-lifecycle.ts`
- `app/e2e/multi-event-pace.setup.ts`
- `app/playwright.multi-event-pace.config.ts`
- 본 보고서
- 실행 증거: `app/test-results/multi-event-pace-lifecycle.json`, 개별 테스트의 실패 화면/trace 및 `saved-journal.png`, `successor.png`.
- JSON 첨부 `lifecycle-stage-receipt`에 사례와 완료 단계 및 브라우저 오류를 남긴다.
- 장거리 7개 추가 증거 설계: `overbudget-blocked.png`, `overbudget-branch-receipt`(기록, 저장된 예산, 독립 예상 총시간, 화면 차단/새로고침 불변 확인). 이번 실행은 해당 단계에 도달하지 못했으므로 새 차단 증거는 생성되지 않았다.

## 남은 범위

인증 서버 저장 왕복, 계정 서버 CAS, 운영 실계정, 배포, 전체 기존 테스트 모음, 무작위 테스트는 이 작업의 증거에 포함되지 않는다. 기존 수정과 다른 작업자의 런타임 코드는 변경하지 않았다.
