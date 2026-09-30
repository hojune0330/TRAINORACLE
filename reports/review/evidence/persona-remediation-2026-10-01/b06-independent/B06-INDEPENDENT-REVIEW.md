# B06 독립 검토

## 판정

P2 복구 결함 2건. 검토 대상은 부모의 B06 미커밋 변경이다.
브랜치 `codex/workout-choice-runtime-completion`, HEAD `38300ae988b97a9968968a2dd3eb3517b4e62781`.
제품/명세 수정, 커밋/푸시/배포, 환경 파일/비밀/개인자료 접근, 네트워크 요청 없음.
B07 변경 내용은 평가하지 않았다. 기존 scratch와 증거를 보존했다.

## 발견

### F01 / P2: 다시 열어도 저장된 다음 계획을 재조회하지 않음

대상: `D:\admin\Documents\ChatGPT\트레인 오라클\TRAINORACLE-oracle-exploration-20260921\app\src\screens\plan-beta\PlanAdaptationFlow.tsx:97`.
관련 위치: 111-121(초기 조회와 의존성), 173-176(저장 예외 안내), 184-191(닫기), 206-208(재진입).

- 정적: pending 조회는 state/콜백 변경 시에만 실행된다. reset과 재진입은 재조회하지 않는다.
- 실행 T09: 실제 조정 생성/로컬 저장 성공 후, 기존 저장본 읽기에 일시적 오류를 주었다. 초기 읽기에서 오류 1회가 발생했고, 오류를 해제한 뒤 닫고 다시 열어도 저장 키를 다시 읽지 않았다. 이미 저장된 pending 대신 새 조정 질문이 계속 표시됐다. 컴포넌트를 다시 마운트하니 실제 저장본이 표시됐다.
- 실행 T07: 실제 로컬 저장 뒤 응답 유실을 시험용 onAccept 예외로 모사했다. "다시 열어" 확인하라는 안내를 따랐지만 onLoadPending 호출은 최초 1회뿐이었다. T07의 응답 유실 자체는 합성 경계이지 실제 서버 장애 증거가 아니다.
- 영향: 사용자가 저장 여부를 확인할 수 없고 같은 제안을 다시 작성하게 된다. 중복 쓰기나 보호 우회는 입증하지 않았다.
- 권고: 재진입/명시적 재시도에서 현재 state와 scope에 묶인 pending 조회를 갱신하고, 읽기 실패를 "없음"과 구별한다.

### F02 / P2: 무효화된 준비 작업이 새 계획의 읽기 전용 화면도 잠금

대상: `D:\admin\Documents\ChatGPT\트레인 오라클\TRAINORACLE-oracle-exploration-20260921\app\src\screens\plan-beta\PlanAdaptationFlow.tsx:86`.
관련 위치: 86-95(state 변경 초기화), 147-149(옛 작업 finally), 204-205(entry busy/disabled).

- 정적: state 변경으로 epoch와 질문 상태는 초기화하지만 busy/inFlight는 옛 Promise가 종료될 때까지 유지한다.
- 실행 T06: 준비 응답을 지연한 뒤 다른 state로 다시 렌더하고 비교 context를 제거했다. 새 "이번 주기 기록 확인" 버튼이 disabled였고, 클릭해도 읽기 전용 요약에 진입하지 못했다. 옛 응답을 종료하자 버튼과 요약이 정상 작동했다.
- 영향: 이전 준비 작업이 오래 지연되거나 끝나지 않으면 현재 계획의 요약 확인까지 묶인다. 재현은 같은 컴포넌트 인스턴스의 state 변경 경계이며, 실제 기기/브라우저 장애를 재현한 것은 아니다.
- 권고: 현재 state의 UI 대기 상태와 폐기된 작업의 수명을 분리하고, 읽기 전용 요약은 폐기된 prepare에 종속시키지 않는다. 오래된 finally가 새 작업 상태를 해제하는 역경쟁도 함께 방어한다.

## 확인한 경계

검사 파일: `D:\admin\Documents\ChatGPT\트레인 오라클\TRAINORACLE-oracle-exploration-20260921\.scratch\b06-independent-followup-20261001\b06-boundaries.test.tsx`.

| 검사 | 확인 내용 | 결과 |
|---|---|---|
| T01 | 실제 BALANCED/CONSERVATIVE 등록 변환 및 보수형 PB 생성 양성 대조군, 준비 단계 무쓰기 | 확인 |
| T02 | 같은 ID의 다른 세션 내용 차단, 카탈로그 미지원 시 질문 진입 차단 | 확인 |
| T03 | 다른 로컬 계정 context 차단, 합성 memo getter 미호출, 구조화 RPE 양성 대조 | 확인 |
| T04 | 실제 accept의 현재 hold 재확인/무쓰기, 정상 로컬 저장, 전체 state hash로 옛 pending 제외 | 확인 |
| T05 | 중복 클릭 준비 1회, 뒤로 간 뒤 늦은 응답 무시 | 확인 |
| T06 | 폐기된 prepare가 새 state entry를 잠그는 현상, 응답 종료 후 복구 대조 | F02 재현 |
| T07 | 로컬 저장 후 합성 응답 유실, 재진입 미조회, 재마운트 복구 대조 | F01 재현 |
| T08 | 준비 예외 종료/거짓 성공 없음/무쓰기 | 확인 |
| T09 | 실제 저장본의 일시적 읽기 오류, 재진입 미조회, 재마운트 복구 대조 | F01 재현 |

9개 assertion 검사 실행 완료: 정상/방어 6개 + 결함 재현 3개. 9/9 통과는 결함 없음 판정이 아니다.
T02의 카탈로그 sentinel은 속성 수준의 합성 입력이며 전체 유효 카탈로그 저장/브라우저 검증을 대신하지 않는다.
계정 서비스는 비활성 시험 대역을 사용했다. T03은 로컬 계정 키 격리 증거이며 서버 계정 인증 증거가 아니다.
모든 시험의 fetch 호출 0회. 실제 브라우저/모바일 시각 검증, 기존 40개/9개 브라우저 재실행, 전체 suite/100 personas는 수행하지 않았다.

## 정적 검토

`plan-adaptation-availability.ts`는 세션/프레임/종목/쌍/상세 ref를 실제 비교하고 등록 레지스트리를 호출한다.
PB 경로는 등록된 보수형→기본형에만 표시된다. 가용성이 실행 권한을 대신하지 않으며 실제 준비/저장에서 안전과 상태를 다시 검사한다.
카탈로그 및 교체된 계획의 다음 주기 미지원은 실제 레지스트리 한계와 일치한다. context 복원/카탈로그 변환 미완은 명시된 미완 범위이며 이 검토에서 새 결함으로 세지 않았다.
Review의 busy 뒤로/선택 비활성화와 CycleEvidence의 구조화 비교 표시에 별도 구체적 결함은 발견하지 않았다.
일지 원문 또는 새 외부 전송 경로를 추가한 증거도 없다. 이는 검토한 B06 코드 및 합성 로컬 경계에 한정된다.

## 결함 주입 증거

제품 파일을 고치지 않고 scratch 설정의 시험용 load 단계에서만 메모리상 변형했다.

- `M_EXACT_CONTENT`: 세션 내용 일치 검사를 제거. `T02_EXACT_CONTENT_rejects_same_ID_changed_sessions_and_unsupported_entry`가 이름별 실패.
- `M_STALE_PREPARE`: 준비 응답 epoch/state guard를 제거. `T05_STALE_PREPARE_double_tap_one_request_and_back_ignores_late_result`가 이름별 실패.
- 각각 지정한 검사 1개 실패/나머지 8개 미실행. 결함 주입 실행의 exit 1은 예상된 검출 결과다.

## 정확한 증거 경로

모든 아래 파일의 공통 절대 폴더:
`D:\admin\Documents\ChatGPT\트레인 오라클\TRAINORACLE-oracle-exploration-20260921\.scratch\b06-independent-followup-20261001`

- `baseline-final.json`: 최종 9개 검사 결과.
- `mutation-exact-content-final.json`: M_EXACT_CONTENT 이름별 실패.
- `mutation-stale-prepare-final.json`: M_STALE_PREPARE 이름별 실패.
- `before-final-source-hashes.json`, `after-final-source-hashes.json`: B06 대상 6개 파일의 최종 실행 전후 SHA256 동일.
- `vitest.config.mts`, `setup.ts`: 설치된 Vitest/jsdom만 사용, 별도 envDir/cacheDir, fetch 차단.
- `baseline-run2.json`, 최초 중첩 폴더의 `baseline.json`, 최초 mutation JSON도 덮어쓰거나 삭제하지 않았다. 최초 baseline은 시험 환경 import 오류로 0개 실행이며 유효한 통과 증거가 아니다.

재실행은 기존 `C:\Program Files\nodejs\node.exe`와 `app/node_modules/vitest/vitest.mjs`를 사용한다.
설정의 `--configLoader runner --mode baseline`은 전체 suite가 아니라 이 scratch 파일만 선택한다.
