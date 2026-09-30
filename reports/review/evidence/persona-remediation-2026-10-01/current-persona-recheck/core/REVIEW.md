# 독립 코어 최종 재검수

## 판정과 증거 경계

**현재 원본 코어 100개와 카탈로그 연결 경로에서 새 회귀를 발견하지 않았다. W1 첫 자동 MAIN 상세 공급은 여전히 미완이며, 기존 강도·시간 정책 충돌과 입력 확인 부족을 재현했다. 코어 통과를 제품 전체 완료로 승인하지 않는다.**

새 P1/P2 제품 결함은 발견하지 않았다. 기존 W1의 완료 수용 조건 미충족과 시험기 오류를 새 제품 회귀로 분류하지 않는다.

| 판정 대상 | 이번 결과 | 의미 |
|---|---|---|
| core100 assertion | PASS, 100/100 | 원본의 계산·안전·교체·선택·로컬 저장 조건에 대한 통과 |
| 현재 카탈로그 전수 로컬 연결 | PASS, 116 연결·저장·재읽기 + OFF 1 | 각 ID의 적격 한 조합에 대한 기술적 연결 통과 |
| W1 처방·흐름 개선 완료의 제품 수용 | FAIL / 완료 조건 미충족, 오너 결정 대기 | 첫 자동 MAIN 85회 중 상세 19회, 범위 안내 66회. 새 위험 수치를 허용해서 해결하지 않음 |
| W2 전체·운영 반영·브라우저 UX | 이번 독립 범위 미검증 | core100 PASS로 대체하지 않음 |

- 저장소: `D:\admin\Documents\ChatGPT\트레인 오라클\TRAINORACLE-oracle-exploration-20260921`
- 브랜치: `codex/workout-choice-runtime-completion`
- 시작, 두 원본 실행, 보강 실행, 최종 재계수 HEAD: `eb2e4caf99e219b090cd490d51b1c754db1f680b`
- 실행 환경: `C:\Program Files\nodejs\node.exe`, Node `v24.11.1`, 설치된 Vitest `4.1.10`. 다운로드나 설치 없음.
- 실제 원본 실행: 2026-10-01 KST 08:01:57~08:04:21(UTC 설정), 08:05:21~08:07:43(KST 설정). 페르소나의 시험 시각은 원본대로 `2026-09-30T03:00:00.000Z`에 고정했다.
- 독립적인 합성 입력은 **100개**다. UTC/KST 반복, 보강 시험, 교체 시도, 카탈로그 계산을 새 사람 수로 합산하지 않는다. 실제 사람의 사용성 시험이 아니다.
- 브라우저 UX, 부모의 browser100, 부모의 초보 GLY 편집기 수리 및 E2E fixture 수리는 이 판정에 포함하지 않는다.
- 제품 코드, 테스트 원본, 기존 증거를 이 작업자가 수정하지 않았다. 보고서와 새 시험기·출력은 이 폴더에만 작성했다. 커밋·푸시·배포 없음.

## 문서와 원본 실행 확인

`AGENTS.md`, `PRODUCT_NORTH_STAR.md`, `WORK_ORDER_PERSONA_REVIEW_REMEDIATION_2026-09-30.md`를 먼저 읽었다. 이후 PLAN_GENERATOR의 강제 경계·현행 베타 범위, TRAINING_PLAN_METHOD_DECISION의 과거 지위, TRAINING_PLAN_CURRENT_SCOPE의 최신 전체 연결 범위, TEMPLATE_LIBRARY §16A, 상세 처방 계약의 앵커·구조·안전 조항, 전체 계산·연결 계약, D9, AM/PM 계약과 슬롯 결정, 감사 함정표를 대조했다. 초안 전체를 활성 권한으로 승격하지 않았다.

원본 `app/src/domain/plan-persona-100.audit.ts`는 다음을 실제로 수행한다.

- 36행에서 로컬 `git rev-parse HEAD`를 실행해 기준 SHA를 캡처한다.
- 43행에서 `.scratch/persona-100-core-${runId}`를 출력 위치로 정한다. 이번 `runId=final-20261001`은 지정된 폴더와 정확히 일치한다.
- 264~418행의 100개 행렬은 독립 source ledger를 이용한 구간 순서·회복 횟수·거리·시간 검사, 생성·안전 차단, 후보 교체, 선택, 저장, 재읽기를 수행한다. 416행에서 각 페르소나의 실패 목록이 빈 배열인지 단언한다.
- 661행의 `AUDIT-ACTUAL-ROUTE-COVERAGE`는 실제 생성된 슬롯에 각 카탈로그를 연결하고, 선택·저장·재읽기 값 일치를 단언한다. 단, 원본은 `CALCULABLE_NOT_BINDABLE` 행을 곧바로 실패시키지는 않는다. 보강 `CURRENT-ID-EXHAUSTION`에서 그 행이 0개이고 현재 ID와 결과 ID가 전수 일치하는지 추가로 단언했다.
- 433~468행의 첫 MAIN 공급 검사는 적격 옵션 존재 여부와 실제 자동 연결 여부가 일치하는지 단언한다. 보강 검사에서 동일 82개 입력을 다시 생성해 MAIN 주소와 catalogId를 전부 비교했다.

원본 `app/vitest.persona-100.config.ts`는 감사 파일 1개만 포함하고 verbose/JSON reporter를 사용한다. 원본 `envDir: false`와 공유 감사 cacheDir는 그대로 두었다. 이 폴더의 wrapper만 사용해 envDir을 실제 빈 `empty-env/`, cacheDir을 이 폴더의 `cache/`로 덮어썼다. 모든 감사 JSON은 생성 후 해당 실행의 새 하위 폴더에 옮겨 서로 덮어쓰지 않도록 했다.

화면 시험 5개는 이름 필터로 제외했다: `AUDIT-STALE-DISPLAY`, `AUDIT-DRAW-NO-REPEAT`, `AUDIT-DRAW-ELIGIBILITY`, `AUDIT-LIMITATIONS-LIST`, `AUDIT-RELOAD-CONFIRMATION`. 실행 모듈이 화면 컴포넌트를 import하는 사실과 해당 화면 시험을 실행하는 것은 구분한다. 실제 사용자 브라우저를 열거나 조작하지 않았다.

## 실행 결과

| 검사 | UTC | KST | 해석 |
|---|---:|---:|---|
| 원본 코어 등록 시험 | 107 통과 / 0 실패 | 107 통과 / 0 실패 | 100개 행렬 + 축 검사 1개 + 이름 있는 코어 반례 6개 |
| 제외된 화면 시험 | 5 | 5 | 미실행이며 통과로 세지 않음 |
| 고유 합성 페르소나 | 100 | 같은 100 | 반복 합산 금지 |
| 정상 생성 / 안전 차단 / 입력 거절 | 82 / 12 / 6 | 동일 | 100개 모두 계획이 생성됐다는 뜻이 아님 |
| 행렬 내부 감사 조건 평가 | 1,550,902 | 동일 | Vitest 테스트 수가 아닌 `check()` 조건 평가 수 |
| 카탈로그 행 | 11,700 | 동일 | 100×117 |
| 기본 + 명시 입력 계산 호출 | 23,400 | 동일 | 행당 두 계산. 검증용 재계산 등 모든 함수 호출의 총합은 아님 |
| 저장 전 후보 교체 시도 | 984 | 동일 | 변경 419 / 안전·조건 보류 565 |
| 선택·로컬 저장·재읽기 행동 | 578 | 동일 | undo/복원 및 같은 입력의 반복 포함 |
| 원본 페르소나 실패 목록 | 0 | 0 | 이름별 실패와 개별 JSON 확인 |

UTC 보강 최종 결과는 **11/11**이다: 새 proof probe 4개와 기존 `catalog-method-selection.contract.test.ts` 7개. 재시도 전후의 통과를 합산하지 않는다. W3에서는 시간 변형·연속 달리기 별칭을 같은 탐색 방법으로 묶고, 실제 세트 경계·반복 자식 회복·마지막 회복·거리/시간 단위 차이를 보존하는 대조군을 확인했다. 기존 처방 내용 지문과 legacy method identity를 새 탐색 키로 바꾸지 않았다.

## 카탈로그 전수 연결과 첫 자동 공급

현재 존재하는 유니크 카탈로그 ID를 다시 읽고 실행 결과와 대조했다.

| 계열 | 현재 ID 수 |
|---|---:|
| BASE | 16 |
| LT | 20 |
| VO2 | 21 |
| ATP-PC | 18 |
| GLY | 13 |
| MIX | 19 |
| REC | 9 |
| OFF | 1 |
| 합계 | 117 |

**116개는 실제 생성 슬롯에 명시적 합성 입력과 시간 확인을 제공해 연결·선택·로컬 저장·재읽기에 성공했다. OFF 1개는 운동 없음으로 계산됐다. 계산 가능하지만 연결 불가인 ID는 0개다.** 각 ID에 선언된 적격 종목·경험 중 한 조합만 실행한 결과다. 모든 사용자에게 117개 자동 처방 가능, 117개 독립 훈련법, 운영 계정 저장 완료라는 뜻이 아니다. 명시 입력으로 사용한 목표 초와 요구조건 확인은 시험용 합성 값이며 새 코칭 수치의 채택이 아니다.

첫 BALANCED 후보의 자동 공급은 다음과 같다. 부모 브라우저 결과와 분모가 다르다.

| 목적 | 정상 프로필 | MAIN 슬롯 | 상세 연결 | 범위 안내 유지 |
|---|---:|---:|---:|---:|
| BASE | 13 | 0 | 0 | 0 |
| LT | 12 | 19 | 0 | 19 |
| VO2 | 10 | 15 | 9 | 6 |
| GLY | 12 | 17 | 0 | 17 |
| ATP-PC | 12 | 17 | 0 | 17 |
| MIXED | 11 | 17 | 10 | 7 |
| RECOVERY | 12 | 0 | 0 | 0 |
| 합계 | 82 | 85 | 19 | 66 |

MAIN 있는 프로필은 57개이며, 그중 43개에 하나 이상의 미완결 MAIN이 있다. MAIN 없는 BASE/REC 25개는 실패 분모가 아니다. 경험별 MAIN은 초보 20개 중 상세 7개, DEVELOPING 33개 중 상세 0개, EXPERIENCED 32개 중 상세 12개다.

기존 지시서의 기준 **19/85 상세, 66/85 범위 안내**와 동일하다. 전수 연결 성공과 기본 자동 공급 완료는 다르며 W1은 해소되지 않았다.

## 발견과 재현

### 새 제품 회귀

이 실행 범위에서 새 제품 회귀 0개. 원본 코어의 실패 이름 0개, 최종 proof probe 실패 이름 0개. 아래는 새 회귀가 아닌 기존 W1 미완의 재현이다.

| 이름 | 파일:줄 | 재현 | 사용자 영향 / 분류 |
|---|---|---|---|
| W1-LT-RPE-POLICY | `impl/src/plan-generator/session-builder.ts:81`, `impl/src/prescription/catalog-session-binding.ts:42`, `:93` | P008, EXPERIENCED, 800m, LT, `3:AM`. 기존 RPE 상한 6, 호환 18구성 모두 상세 RPE 상한 초과 | 첫 LT MAIN이 상세 연결되지 않음. 기존 5~6 대 6~7 정책 충돌, 오너 결정 대기 |
| W1-GLY-RPE-AND-INPUT | `impl/src/plan-generator/session-builder.ts:84`, `impl/src/prescription/catalog-session-binding.ts:42`, `:93` | P022, DEVELOPING, 800m, GLY, `3:PM`. 호환 2구성 모두 RPE 상한 초과 및 전체 시간 미확정 | GLY MAIN 범위 안내 유지. 기존 7~8 대 8~9 충돌과 입력 부족이 겹침 |
| W1-ATP-PC-SPACE | `impl/src/prescription/catalog-session-binding.ts:86`, `impl/src/prescription/all-workout-calculator.ts:116` | P029, NEW_TO_RUNNING, 800m, `3:AM`. 호환 2구성의 공통 제외 사유 `ACCELERATION_AND_DECELERATION_SPACE` | 공간 확인 없는 상태에서 자동 상세 처방하지 않음. 실제 응답 필요, 강제 확인값 생성 금지 |
| W1-VO2-TOTAL-TIME | `impl/src/prescription/all-workout-calculator.ts:199`, `impl/src/prescription/catalog-session-binding.ts:70` | P015, DEVELOPING, 800m, `2:PM`. 상한 2400초, 호환 구성의 최단 알려진 전체 시간 2420초 | 본운동만이 아닌 준비·회복·정리 포함 시간 때문에 자동 연결 불가. 기존 20초 정책 충돌 |
| W1-MIX-TOTAL-TIME | `impl/src/prescription/all-workout-calculator.ts:199`, `impl/src/prescription/catalog-session-binding.ts:70` | P041, DEVELOPING, 하프, `5:AM`. 상한 2400초, 호환 구성의 최단 알려진 전체 시간 2840초 | 자동 상세 공급 없음. 기존 전체 시간 상한과 검토된 구성의 충돌 |

재현 원본은 `utc-v3/default-main-coverage.json`의 해당 persona/slot/options와 `recount-final.json`의 `unboundExamples`에 있다. `WORK_ORDER_PERSONA_REVIEW_REMEDIATION_2026-09-30.md:28~36`의 대기 경계를 유지했다. 상한을 올리거나, 준비/정리 구조를 줄이거나, 가드/allowlist를 제거하지 않았다.

## 단순 exit 0을 넘는 확인

- 실제 호출 spy: 위험/응답 누락 대조군 2개는 generator와 default binder 호출 0. 정상 대조군은 generator 1회, A/B 기본 binder 2회, A/B 명시 교체 binder 2회, 선택기 1회가 관측됐다. generator가 binder보다 먼저 호출되는 것도 단언했다.
- 저장은 `app/src/domain/plan-beta-store.ts:220`의 `planBetaStateV3Schema.safeParse`를 실제 통과한다. 정상 저장 성공과 잘못된 version 저장 거절을 각각 단언해 2회 호출을 확인했다. 잘못된 요청 뒤 기존 저장본은 보존됐다.
- 재읽기는 `app/src/domain/plan-beta-store.ts:206`의 `parsePlanBetaState`를 실제 1회 호출했고 전체 state가 선택 당시 state와 일치했다. 미리보기는 원본 generated pair를 바꾸지 않았다.
- 원본 `AUDIT-MUTATION-CONTROL`은 계산 결과 복사본의 회복행 제거와 소수 반올림을 `SOURCE_OCCURRENCE_COUNT`, `INDEPENDENT_SECONDS` 이름으로 잡았다. 제품 원본을 수정하는 방어문 제거 시험은 수행하지 않았다.
- 보강 `FORGED-SELF-CONSISTENCY`는 정상 계산이 검증되는 대조군 후, 거리 변경과 새 일관된 해시를 가진 복사본도 trusted 재계산이 거절함을 단언했다. 해시 일치만으로 승인하지 않는다.

호출 기록: `probe-v3-actual-call-path.json`. 위조 대조군: `probe-v3-forged-self-consistency.json`.

## 감사 원본이 실패 원인을 숨기는가

**core100의 조건 실패를 몰래 성공으로 바꾸는 동작은 이번 실행에서 확인되지 않았다. 그러나 원본의 PASS/summary만 읽으면 제품 수용 실패나 별도 named test 실패를 놓칠 수 있다.**

1. **W1은 실패 assertion이 아니라 관찰이다.** 첫 MAIN 공급 검사는 적격 후보가 있는지와 실제 연결이 일치하는지를 검사하지, 모든 MAIN이 상세 연결됐는지를 요구하지 않는다. 적격 공급이 없으면 상세 66회 미연결 상태에서도 정상 통과한다. 따라서 `100/100`은 W1 완료의 근거가 아니다.
2. **전수 연결 원본은 연결 거절을 행으로만 보존할 수 있다.** `AUDIT-ACTUAL-ROUTE-COVERAGE`의 695행은 교체 실패를 `CALCULABLE_NOT_BINDABLE`로 기록하고 continue한다. 마지막 117행 수 검사만으로 116개의 저장 성공을 보장하지 않는다. 이번에는 현재 ID 전수 대조와 status별 추가 assertion으로 116 성공 + OFF 1, 거절 0을 확인했다.
3. **summary의 failureCounts는 전체 Vitest 실패 목록이 아니다.** 237~251행은 `audits`에 수집된 100개 페르소나 실패만 집계한다. 별도 named test의 assertion 실패는 그 집계에 자동으로 들어가지 않는다. 반드시 JSON reporter의 `assertionResults` 및 실패 이름도 함께 봐야 한다. 이번 UTC/KST reporter의 실패 이름은 각각 0개다.
4. **예외는 보존하지만 stack은 줄인다.** 412~416행에서 `AUDIT_EXECUTION_EXCEPTION`과 `String(error)`를 실패 목록에 추가하고 마지막 assertion으로 실패시킨다. 예외 자체를 숨기지는 않지만 stack과 발생 위치는 축약된다. 콘솔 첫 6개만 출력하는 것 역시 개별 persona JSON과 summary 전체 실패 배열로 보완해야 한다. 이번 이 코드의 예외 실패는 0개다.

즉, 이번에는 숨겨진 새 코어 실패를 발견한 것이 아니라 **원본의 기술 assertion과 제품 수용 지표가 다른 것**을 확인했다. 현재 재계수·proof probe·reporter를 함께 읽어 그 경계를 명시했다.

## 시험기 오류와 동시 작업

다음 실패는 제품 결함이나 페르소나 실패로 세지 않았다. 로그와 이전 JSON reporter 출력은 보존했다.

| 시도 | 실패 | 처리 / 증거 |
|---|---|---|
| utc | NODE_OPTIONS의 Windows 역슬래시 인용 오류. 테스트 0개 실행 | slash 경로로 수정. `utc-stderr.log`, `utc-after.json` |
| utc-final | Vite 기본 localhost DNS 조회 시도가 통신 가드에서 차단. 테스트 0개 실행 | 실제 DNS 조회 전에 차단. wrapper 숫자 host를 지정. `utc-final-stderr.log`, `guard-utc-final-*.json` |
| probe | Vite의 동적 import.meta URL 처리로 증거 경로를 잘못 해석, proof probe 3개 ENOENT | 명시적 절대 출력 경로 환경값 사용. `probe-vitest-results.json`, `probe-stderr.log` |
| probe-v2 | 저장과 재읽기가 같은 parser를 두 번 호출한다는 시험기의 잘못된 기대 1개 실패 | 실제 저장 스키마와 재읽기 parser를 별도 spy하고 정상/거절 대조군 유지. `probe-v2-vitest-results.json` |
| 최종 | utc-v3, kst-v3, probe-v3의 제품 assertion 실패 0 | 이전 실패를 덮어쓰거나 최종 통과에 합산하지 않음 |

UTC 실행 중 `CatalogWorkoutPicker.tsx`와 그 contract test의 변경을 감지했다. 원본 Vitest는 107개 통과했지만, runner는 동시 변경 경고를 별도로 냈다. 이는 이 작업자의 수정이 아니며 되돌리지 않았다. 이후 부모는 초보 GLY 편집기 수리라고 직접 설명했다. 브라우저 결과나 이 화면 수리의 품질을 이 코어 판정으로 재승인하지 않는다.

코어 630개 파일(`app/src/domain/`, `impl/src/`, 원본 감사 config)은 UTC/KST 시작 SHA-256이 같고 양 실행 중 변경 0개였다. 보강 실행의 코어 변경도 0개다. 종료 시에는 부모의 화면·E2E·연결 계약 수정으로 worktree가 dirty이므로 **전체 작업 트리가 HEAD와 완전히 동일하거나 clean이라고 보고하지 않는다.** 정확한 코어 SHA와 동시 작업을 구분한다.

## 보안과 미검증 범위

- `.env`, 비밀 파일, 실계정, 실데이터를 읽지 않았다. 원본 fetch 카운터는 양 시간대 0이며, 최종 세 실행의 Node HTTP/HTTPS/socket/TLS/DNS/fetch 차단 장치에 위반 시도 0개가 기록됐다. 앞선 startup DNS 시도는 실제 실행 전에 차단된 시험기 오류로 별도 보존했다.
- 모든 localStorage/sessionStorage는 합성 jsdom 창이다. 계정 서비스와 cloud backup은 원본 감사의 disabled/mock 경계를 유지했다. 실제 계정·서버·DB·배포 검증이 아니다.
- 100개 행렬은 7종목·3경험·7/9/10일·오전/오후·다양한 가용일·기록 상태를 포함하지만 모든 교차 조합 전수 검사가 아니다. syntheticAge는 합성 분류축이며 법정 미성년 동의 처리의 실제 검증이 아니다.
- 원본 교체는 **저장 전 후보 교체**다. W2 저장 후 미래 슬롯 변경, 계정 CAS/0041 SQL, B03/B06/B07 전체, 다중 탭/운영 계정/응답 유실 복구를 이번 결과로 승인하지 않는다.
- 카탈로그 각 ID의 모든 종목·경험·장비·지형·주기 조건, 과학적 효능, 최적 용량, 실제 선수 수행도 미검증이다.
- D1~D8 전체, 승인된 PACE_TARGET 4종의 전체 별도 경로, 전체 앱 타입 검사·빌드·브라우저·접근성은 이번 독립 범위에서 실행하지 않았다. 부모 작업과 중복하지 않았다.

## 실행 명령과 증거 위치

작업 디렉터리는 위 저장소다. 아래는 실제 완료된 호출이다. runner는 동일 이름의 기존 실행 증거가 있으면 덮어쓰지 않고 거절한다. 재실행 시 runner가 허용하는 새 `utc-vN`/`kst-vN`/`probe-vN` 이름을 사용해야 한다.

```powershell
& 'C:\Program Files\nodejs\node.exe' '.scratch/persona-100-core-final-20261001/run-core.mjs' utc-v3
& 'C:\Program Files\nodejs\node.exe' '.scratch/persona-100-core-final-20261001/run-core.mjs' kst-v3
& 'C:\Program Files\nodejs\node.exe' '.scratch/persona-100-core-final-20261001/run-probe.mjs' probe-v3
& 'C:\Program Files\nodejs\node.exe' '.scratch/persona-100-core-final-20261001/recount.mjs'
```

각 runner의 실제 Vitest 절대 경로·인자·cwd·TZ·가드 설정은 `utc-v3-command.json`, `kst-v3-command.json`, `probe-v3-command.json`에 있다. 원본 코어 필터는 다음과 같다.

```text
has 100 different inputs|source math, generation|AUDIT-(MUTATION-CONTROL|DURATION-VARIANTS|REDUCE-CATALOG|COMPATIBILITY|CURRENT-CHECK-FAIL-CLOSED|ACTUAL-ROUTE-COVERAGE)
```

주요 증거는 전부 이 보고서와 같은 폴더 아래에 있다.

- `utc-v3-vitest-results.json`, `kst-v3-vitest-results.json`: 실제 시험 이름·pass/fail/skip·시각.
- `utc-v3/summary.json`, `kst-v3/summary.json`: HEAD·100개 집계·감사 조건 수·실패 배열.
- 각 실행 하위 폴더의 `P001-*.json`~`P100-*.json`: 입력·시드·계산·행동·관찰·조건 실패 원본.
- 각 실행 하위 폴더의 `all-117-real-slot-binding.json`, `default-main-coverage.json`: 실제 전수 연결과 첫 자동 MAIN 옵션/제외 사유.
- `probe-v3-vitest-results.json`, `probe-v3-current-id-exhaustion.json`, `probe-v3-fresh-default-main.json`, `probe-v3-actual-call-path.json`, `probe-v3-forged-self-consistency.json`: 보강 최종 증거.
- `*-before.json`, `*-after.json`, `probe-v3-source-snapshot.json`, `guard-*.json`: HEAD·파일 해시·동시 변경·차단 장치 관측.
- `recount-final.json`: 현재 ID와 실제 출력의 단언 기반 재계수, 양 시간대 동일성, 목적/경험별 공급, 기존 W1 재현 상세.

최종 범위 판정: **코어 100개와 이번 카탈로그 연결 재검수 통과. W1 결정 및 자동 상세 공급 완료, W2 전체, 운영 반영과 서비스 전체 합격은 별도 미승인/미검증으로 유지한다.**
