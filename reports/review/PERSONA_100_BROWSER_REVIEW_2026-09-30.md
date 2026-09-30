# 합성 페르소나 100개 브라우저 적대적 검토

검토일: 2026-09-30, Task B. 기준 커밋 `9085282`, 런타임 커밋 `8b80fa1`. **100개 합성 페르소나의 전체 앱 브라우저 여정 실행을 완료했다.** 실제 사용자나 컴포넌트 fixture 실행을 이 수에 포함하지 않았다.

## 발견사항 먼저

### F01. P1, 기준판: 거리 회복 수치 입력 후 전체 앱 오류

- 정확한 기준 소스: `9085282:impl/src/prescription/all-workout-calculator.ts:247`. `calculatedWorkoutSequence`가 거리 회복의 `distanceM`를 보존한 채 `seconds`를 추가하는 변환이 V3 시간/거리 구분과 충돌한다.
- **실행 확인:** P042, 800m, DEVELOPING, 1280px. `P-RHYTHM-300`의 300m 운동/100m Roll-on 회복에 합성 `76.92초`/`77초`를 입력하는 보완 여정에서 `INVALID_SEQUENCE_V3` 두 번과 최상위 오류 화면을 확인했다. 저장하지 못했다. 이후 적용 버튼 탐색의 6초 시간 초과는 앱 오류의 후속 증상이며 별도 사고로 세지 않았다.
- 원본: `.scratch/persona-100-browser/baseline-repair/synthetic-p042/evidence.json`, `failure.png`. [보존한 실제 오류 화면](evidence/persona-100-browser/baseline-p042-runtime-error.png).
- **수정 복사본 실행 확인:** 같은 P042는 적용·날짜 복귀 시 입력 복원·저장·재로드·연결 일지 진입까지 완료했다. 별도 전체 앱 화면 probe도 `100m Roll-on` 구조와 `ACTIVE_ROLL_ON 77초 · 100m · 직접 정한 회복 시간`을 함께 확인하고 저장했다. 검증 복사본 수정 위치: `impl/src/prescription/all-workout-calculator.ts:248`, `app/src/screens/plan-beta/CatalogWorkoutDetail.tsx:29`. [수정 후 실제 화면](evidence/persona-100-browser/current-p042-distance-recovery-fixed.png).
- 원래 제품 P1은 보존한다. 수정은 부모 작업이며 본 검토자는 런타임을 수정하지 않았다.

### F02. P1, 기준판: 미적용 변경을 무시하고 원래 처방 확정

- 기준 소스: `9085282:app/src/screens/plan-beta/PlanCandidates.tsx:149`, 카탈로그 초안 상태를 제외한 `canSelect`.
- **실행 확인:** 13개 여정에서 적용하지 않고 시작한 뒤 실제 저장 ID를 비교했다. P001은 선택 `P-INTRO-ATP-T`, 해당 날짜 저장 구성 `null`. 단순 선택 이벤트만으로 확정 결함을 세지 않았다. 비교값을 CSV와 `selected-browser-proof.json`에 보존했다.
- **수정 복사본:** P001은 변경 후 시작이 막히고, 직접 수치를 적용한 뒤 저장했다. 별도 375px 검증에서 기존 `P-LT-C`를 그대로 재선택하면 시작 활성, 다른 `X-LT-01`로 실제 변경하면 시작 비활성임을 확인했다. 복사본 위치: `CatalogWorkoutPicker.tsx:85`, `PlanCandidates.tsx:151`.
- `START_ENABLED_WITH_UNAPPLIED_DRAFT` 70개는 **관찰값만** 남긴다. 최초 도구가 기존 값과의 차이를 충분히 비교하지 않았으므로 70개를 확정 결함 수로 사용하지 않는다. 실제 저장 비교 13개와 구분한다.

### F03. P2, 기준판: 필수 수치 숨김 및 적용 입력 복원 손실

- 기준 소스: `9085282:app/src/screens/plan-beta/CatalogWorkoutPicker.tsx:88`의 접힌 필수 입력, 같은 파일 `:34`, `:36`의 빈 입력 초기화.
- **실행 확인:** 운동/회복 필수 시간이 숨겨진 여정 30개, 적용 후 다른 날짜로 갔다 돌아오면 직접 시간 또는 기준 기록이 사라지는 여정 23개. 하네스 보완은 후속 적용·저장까지 관찰하기 위한 것이며 제품 문제를 통과로 지우지 않았다.
- **수정 복사본:** 375px `X-LT-01`의 필수 1000m 초 입력이 펼쳐져 보이고, 수치 없이는 적용이 막힌다. 합성 5km `18분 31.25초` 선택 후 1000m 참고 범위 약 `237.16~240.89초`를 확인했다. 적용·날짜 이동·복귀 시 기록과 구성이 복원됐다. P042는 운동 `76.92`, 회복 `77` 모두 복원됐다. [필수 초 입력](evidence/persona-100-browser/current-375-required-seconds.png), [복원한 참고 목표](evidence/persona-100-browser/current-375-restored-reference-target.png).

### F04. P2, 기준판: 탭 복귀로 생성 초안 소실

- 기준 소스: `9085282:app/src/screens/PlanBeta.tsx:387`의 생성 결과 로컬 상태. **실행 확인:** 홈→계획 복귀로 생성 후보와 종목 선택이 초기화된 여정 20개. P001/P006 등 전후 텍스트와 화면을 보존했다.
- **수정 복사본:** 생성 후보와 `X-LT-02` 선택 상태에서 탭 이탈 취소 시 후보 텍스트와 선택이 정확히 유지됐다. 명시적 버리기는 화면을 떠나며 계획을 저장하지 않았다. 초기 입력 `18분/31.25초`도 취소로 유지됐다. 미편집 입력 화면과 이미 저장한 계획은 경고가 없었다.
- 복사본 위치: `app/src/screens/PlanBeta.tsx:400`, `:871`. 제한적인 이탈 방지이며 자동 저장·재진입 복원 완료를 뜻하지 않는다. 실제 브라우저 종료의 `beforeunload` 대화상자는 미검증이다.

### F05. P2, 검증 당시 수정 복사본: 선택 목록과 적용 관문 불일치

- 기준 소스: `9085282:app/src/screens/plan-beta/CatalogWorkoutPicker.tsx:43`의 목적 계열만 보는 풀. **기준판 실행:** 경험/종목 부적격 옵션 노출 73개 여정, 입력·확인 후 선택한 구성 적용 거부 8개 여정. 정확한 ID 전부를 [부적격/거부 ID](evidence/persona-100-browser/incompatible-and-rejected-ids.json)에 보존했다.
- **현재 실행 확인:** P003, 3000m, NEW_TO_RUNNING, 375px/CSS 200%, 4일차 AM에서 목록에 `P-BASE-C-1500`이 남았다. 기존 `P-BASE-B`와 실제 다른 값으로 선택했지만 적용 비활성이다. 취소 후 시작도 검사 시점에 비활성이어서 이 여정은 저장 완료하지 않았다.
- 현재는 `이 일정에는 적용할 수 없는 구성이에요. 같은 목적의 다른 훈련을 골라 주세요.`와 **변경 취소**가 있다. 원본 코드명 `CATALOG_APPLY_DEADEND`는 남기되 현재의 완전한 탈출 불능이라고 과장하지 않는다. 현재 원래 여정 5개 중 이 1개를 UX 발견사항 assertion 실패로 유지했다.
- 복사본 소스: `CatalogWorkoutPicker.tsx:70`, `app/src/domain/catalog-plan-binding.ts:10`, `:15`, `:20`. 목록은 첫 후보 세션 기준, 적용은 두 후보 모두 변경·검증한다는 **정적 원인 후보**가 있다. 특정 후보 RPE 상한인지 최종 쌍 검증인지, 취소 후 비활성이 지속인지 일시 상태인지 **미확인**이다. 추가 실행 없이 남긴다.
- 이후 부모 랜덤 선택 패치는 이 실행 복사본 이후 변경이다. 최신판에서 이 문제가 해결됐다는 브라우저 판정을 하지 않는다.
- **후속 부모 제공 증거, 본 브라우저 실행과 별도:** 부모는 A 원래 예산 35분/B 20분에서 A 예산만 검사해 25분 BASE가 B에서 거부되며 증액 확인 체크박스도 없었던 원인을 재현했다고 보고했다. `pairedBudgetSeconds`를 양쪽 `originalEnvelope` 예산의 최솟값으로 두고 기존 명시적 시간 수락을 두 후보에 반영했다. 즉시 랜덤 선택도 `replaceCandidateCatalogWorkout`의 실제 pair 적용 가능성을 확인하도록 수정했다고 보고했다. 임의 강도·수치 생성은 없다고 밝혔다.
- 부모 제공 regression 제목은 `checks the shorter candidate budget before applying one workout to both candidates`. 수정 전 체크박스 부재로 실패, 수정 후 관련 component **7/7** 통과라는 보고다. 본 검토자가 이 component 결과를 재실행한 것은 아니다. 역사적 current5 결과 **4 passed/1 failed, 저장4**는 유지한다. 후속 patch의 실제 브라우저 해결 여부는 **미검증**이며 새 브라우저 실행을 하지 않았다.

### F06. 현재도 남는 수치·반복·회복 구성 미완성

- **현재 실제 320px 후보 화면:** `주요 훈련 2회는 시간·체감 강도 안내예요. 반복·회복 구성은 아직 정하지 않았어요.`가 시작 버튼 **앞**에 표시됐다. `처방 확인·조절`은 실제 카탈로그를 펼치고 그 영역에 포커스·스크롤을 옮겼다. [실제 화면](evidence/persona-100-browser/current-320-action-and-unbound-main.png).
- 현재 원래 여정 중 저장한 4개 계획의 전체 스냅샷 40세션: 휴식 14, 카탈로그 연결 23, **일반 RPE QUALITY/MAIN 3**. 이 3개는 시간·RPE 안내이며 운동 구간·반복·회복·수치 페이스가 모두 정해진 처방이 아니다. 안내가 정직해졌지만 구성 미완성이 없어지지는 않았다.
- 기준판 병합 89개 저장 계획의 전체 스냅샷 942세션: 휴식 390, 카탈로그 연결 512, **일반 RPE QUALITY/MAIN 40**. 화면 투영 기간 밖 슬롯도 포함되므로 화면에 표시된 훈련 횟수와 동일시하지 않는다.
- 카탈로그 계산 가능한 저장 MAIN에서 거리 구간의 `seconds=null`은 기준/현재 모두 **0**, 저장 계산 거부도 **0**이다. 기준판 직접 초 목표 WORK 발생 81, 기준 기록 기반 발생 28; 현재 직접 초 WORK 발생 15. 반복을 펼친 구간 발생 수이지 사람 수나 독립 목표 종류 수가 아니다.
- 기준판 카탈로그 MAIN WORK 발생 2276개에 숫자 페이스가 없다. 상당수는 합법적인 시간·체감 노력 기반 구성으로 **숫자 페이스 부재 자체를 결함으로 세지 않는다**. 일반 MAIN 40/현재 3개의 반복·회복 미정과 구분한다. 참고 범위를 측정 역치로, 합성 직접 초를 실제 선수 처방 타당성으로 주장하지 않는다.
- 현재 안내 위치: `app/src/screens/plan-beta/instant-plan-projection.ts:20`, `:25`, `app/src/components/instant-plan/InstantPlanRecommendationView.tsx:84`.

## 정확한 100개 집계

| 구간 | 고유 ID | 시도 | 생성 | 의도된 안전 차단 | 저장 완료 | 제품 예외 ID | 하네스 오류 ID | 전체 테스트 timeout |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 기준판 최초 본 실행 | 100 | 100 | 90 | 10 | 63 | 0 | 27 | 0 |
| 하네스 보완, 같은 기준판 27개만 | 27 | 27 | 27 | 0 | 26 | 1 | 0 | 0 |
| 고유 100개 원본+보완 병합 | **100** | **100** | **90** | **10** | **89** | **1** | **0** | **0** |
| 수정 복사본 원래 여정 5개만 | 5 | 5 | 5 | 0 | 4 | 0 | 0 | 0 |

- 최초 본 실행: **21:27:53~21:36:38 KST**, 약 8분 45초. Playwright 완료 **100**, passed 10, failed 90, skipped/flaky 0. 10개 pass는 안전 차단 확인이지 계획 성공이 아니다. 실패에는 UX assertion과 하네스 오류가 섞인다.
- 보완 실행: **21:38:53~21:42:18 KST**, 완료 27, failed 27, skipped/flaky/전체 timeout 0. 하네스 오류는 없어졌지만 기준판 발견사항을 계속 실패로 남겼다. 모든 실행의 자동 retries는 **0**.
- 병합 고유100: 확정 발견 코드 ID 83, 미적용 시작 관찰만 있는 ID 7, 안전 차단 ID 10. 발견 유형은 중복되므로 유형별 수를 사람 수로 합산하지 않는다. 100개 모두 계획 성공이라고 하지 않는다.
- 최초100의 **6초 action timeout 27개는 하네스 선택자 오류**. 보완 P042의 action timeout 1개는 제품 오류 후속 증상이다. 표의 전체 테스트 timeout=0과 구분한다.
- [100행 CSV](evidence/persona-100-browser/baseline-100.csv)는 seed·화면·진입·훈련 조건·탐색 습관·발견 코드·수치·최초 하네스 오류·보완 여부·개별 JSON 출처·SHA-256을 담는다. 보완을 새 페르소나로 세거나 원본을 덮어쓰지 않았다.

## 현재 좁은 검증과 화면 경계

- 원래 ID **P001/P003/P042/P083/P096**만 재검증: **4 passed / 1 failed**, 제품 예외/하네스 오류/전체 timeout 0. P003은 생성했지만 저장하지 않았다. 전체 브라우저 통과로 포장하지 않는다.
- 별도 전체 앱 대표 점검 **11건 완료**, assertion 오류 0: 320/360/375/390/768/1280 폭 6건, CSS 200% 1건, 수치/기록 복원 1건, 탭 취소/버리기 1건, 미편집/저장 상태 경고 없음 1건, 초기 입력 경고 1건. 신규 격리 컨텍스트와 합성 데이터만 사용했다.
- 개발용 React Scan 오버레이가 화면을 덮어 원본을 보존하고 **동일 대표 3건만** 개발 표시를 끈 서버로 촬영했다. 화면 준비 문제이지 제품 실패를 통과로 바꾼 재시도가 아니다. P042 회복 구조·초·저장 화면 probe 1건도 완료했다. 현재 총 **20회 실행/구분된 case ID 17개**, 신규100 실행 없음.
- 320×568 실측: 시작 버튼 `y=309.4375`, 높이 `47.015625`, 하단 탭 `y=523`. 기본 배율에서는 시작 버튼이 온전히 들어온다. 달력 시작 `y=629.890625`로 첫 viewport 밖이지만 스크롤 후 실제 달력을 확인했다. 달력이 첫 화면에 모두 맞는다고 주장하지 않는다.
- 6개 폭 모두 시작 버튼이 달력 앞에 있고 문서 `scrollWidth=clientWidth`, 버튼 높이 최소 43.5px 이상을 확인했다. 시간 합계는 `3시간 21분~4시간 1분` 등 시/분/초이며 긴 소수 min/분을 찾지 않았다. 포맷 소스 `app/src/screens/plan-beta/labels.ts:277`.
- **CSS 확대 한계:** `html{zoom:2}` 320×568에서 가로 넘침은 없지만 하단 탭 `y=592`, 높이 90으로 초기 viewport 밖에 있었다. [200% 실제 화면](evidence/persona-100-browser/current-320-css-zoom-200.png). 브라우저 기본 확대/OS 글자 확대와의 등가성 및 문서 스크롤 후 탭 도달 가능성은 **미검증**이다. `app/src/styles/app.css:653`, `:1205`는 주변 소스이며 확정 원인이라고 하지 않는다.
- 기준판 터치 검사 P042의 데스크톱 `기술 정보` 높이 32px 1건은 44px 기준 관찰이지 실제 터치 실패 증거가 아니다. 43.9999px 반올림은 문제로 세지 않았다. reduced motion, 도움말/뒤로/취소/탭/재로드/스크롤 증거는 각 raw steps/audits에 있다.
- 부모 제공 focused112 pass/AppShell5/5는 본 실행 수에 합치지 않는다. 기존 테스트 통과는 좋은 UX의 증거가 아니다.

## 원본과 실행 시점

- AGENTS, PRODUCT_NORTH_STAR, 현재 계획 범위, 계산·연결 계약, 선택·조정 §21.55~59, UX와 관련 계획/처방/안전 명세를 도메인 코드보다 먼저 읽었다. 초안/승인 권한을 구분했다.
- 기준판은 `git archive 9085282` 독립 복사본. 부모 수정이 기준판100에 섞이지 않았다. 초기 누락 JSON 준비 오류 6건, 버튼명/중복 선택자 준비 오류, trace 정리 지연으로 중단한 준비 실행은 본100 완료 수에 넣지 않았다.
- 최초100의 필수 수치 영역 선택자 범위 오류를 수정하고 **해당 27개만** 보완했다. 원본 JSON의 잘못 붙은 productErrors 문구도 보존하고 최종 요약에서 하네스 오류로 재분류했다. 초기 `baseline-100-summary.json`은 관찰 코드까지 포함한 중간 집계다. 최종 run-summary는 원본 증거를 다시 파싱해 미확정 관찰을 제외했다.
- 현재판은 작업 트리 독립 복사본. 첫11 점검은 추가 UI 수정 이후/P042 수정 이전, 원래5와 최종 화면은 P042 수정 이후다. 포장 시점에 복사본과 달라진 작업 트리 파일은 **CatalogWorkoutPicker.tsx, CatalogWorkoutDetail.tsx, all-workout-calculator.ts**. [source-manifest.json](evidence/persona-100-browser/source-manifest.json)에 양쪽 해시가 있다. 이후 부모 랜덤/수치 패치를 이번 브라우저 실행이 검증했다고 주장하지 않는다.
- 설치된 Playwright와 승인된 `plan-flow.ts`, `touch-audit.ts`, 실제 앱 `/?app=1&uitest=1` 사용. 100개 고유 seed와 종목/경험/빈도/기간/합성 기록/viewport/탐색 조합. 사용자 프로필·계정·저장 상태 접근 없음.
- 자체 서버 **127.0.0.1:4419**, `envFile=false`, `configFile=false`. .env/비밀 읽기 없음. 외부 HTTP·외부 WebSocket·로컬 변경/API 요청 차단, 서비스워커 차단. 기준판 병합 증거의 차단 요청 654개는 독립 컨텍스트 연결 시도다. 생산 쓰기 없음, 합성 local/session 상태만 scratch에 저장했다.
- 검토자 소유 감사 파일/전용 설정/본 문서/scratch/승인된 compact evidence만 수정. 다른 작업자 파일 보존. 새 브랜치/커밋/푸시/배포/런타임 변경 없음. **자체 서버는 종료했다.**

## 전달과 명시적 재현

- [실행 집계·측정](evidence/persona-100-browser/run-summary.json), [저장 비교·숫자 증거](evidence/persona-100-browser/selected-browser-proof.json), [부적격/거부 ID](evidence/persona-100-browser/incompatible-and-rejected-ids.json), [화면 출처·해시](evidence/persona-100-browser/screenshots.json).
- compact evidence: **100행 CSV, 압축 JSON 요약, 실제 화면 6장**. 대형 archive/전체 DOM/합성 raw state/전체 로그는 `.scratch/persona-100-browser/` 미추적 자료로 남겼다.
- 전용 파일 **`app/e2e/persona-100-adversarial.audit.ts`**로 변경하고 전용 config의 testMatch를 동기화했다. 기본 `app/playwright.config.ts`/CI는 수정하지 않았다. 이름 변경 전 .spec.ts 실행 기록은 원본 그대로 보존했다.
- 변경 후 목록 smoke만 확인: **전용 baseline 100개/1파일, 기본 설정으로 audit 파일 검색 0개/0파일**. 이름 변경 후 브라우저 실행 없음. 재현 시 반드시 프로젝트를 지정한다.

아래는 명시적 재현용이다. 최종 문서 작성 단계에는 목록 외 재실행하지 않았다. scratch의 고정 복사본을 대상으로 하며 최신 작업 트리 재검증과 다르다.

```powershell
# 저장소 루트, 기준판 서버
node .scratch/persona-100-browser/server.mjs
# app 폴더, 명시적으로 선택한 기준판100만
node node_modules/@playwright/test/cli.js test --config playwright.persona-100.config.ts --project baseline --workers 4

# 저장소 루트, 검증에 사용한 현재 복사본 서버
node .scratch/persona-100-browser/server.mjs --current
# app 폴더, 5개 제한 회귀만
node node_modules/@playwright/test/cli.js test --config playwright.persona-100.config.ts --project current --grep "synthetic-p(001|003|042|083|096) " --workers 1

# app 폴더, 목록만
node node_modules/@playwright/test/cli.js test --config playwright.persona-100.config.ts --project baseline --list --reporter list
node node_modules/@playwright/test/cli.js test persona-100-adversarial.audit.ts --config playwright.config.ts --list --pass-with-no-tests --reporter list
```

**판정: 기준판100 실행 완료, 수정 복사본 제한 검증 완료. 전체 UX 통과·처방 완성·최신 작업 트리 전체 검증·실사용자 검증·배포 검증은 아니다.**
