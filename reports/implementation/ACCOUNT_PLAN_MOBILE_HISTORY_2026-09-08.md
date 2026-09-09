# 계획 이력 모바일 UI 검증

## 범위

- 기반 HEAD: `2509a173e564b7924d07903d138ff3603c150956`
- 브랜치: `codex/account-canonical-storage-foundation`
- 상태: 지정 UI 구현 및 집중 로컬 Chromium 검증 완료. 운영 배포 아님.
- 메인 담당자가 서비스/API/스키마를 변경했다. 이 작업자는 해당 런타임을 수정하지 않았다.
- 운영 요청, 실제 키/토큰/개인정보, 훈련 숫자/권한 변경, 커밋/푸시 없음.
- 기존 `.vite/`, `app/tsconfig.tsbuildinfo`는 직접 수정/삭제하지 않았으며 untracked 상태를 보존했다.

## 구현

- 이력 진행 건수, 실패/재시도, 명시적 조회 취소를 서비스 인터페이스에 연결했다.
- 취소 뒤 현재 계획이 없는 화면의 자동 조회가 다시 시작되지 않도록 계정 서비스별 일시 정지 상태를 유지한다.
- 실패 문구는 읽지 못한 원격 원본의 무결성을 단정하지 않는다.
- 보관 목록은 10개씩 추가 표시한다. 닫힌 원본은 본문을 만들지 않으며 펼친 원본 하나만 마운트한다.
- 계정 서비스가 바뀌면 이전 계정의 펼침/일시 정지 상태를 재사용하지 않는다.
- 이력 summary/버튼의 줄바꿈, 최소 터치 크기, 키보드 포커스를 적용했다.
- 같은 화면의 파일 가져오기 버튼 줄바꿈과 360px 이하 현재 계획 범례의 1열 배치를 보완했다.
- `test:e2e:account-plan-service`는 기존 설정 다음 모바일 설정을 `&&`로 순차 실행한다.
- 기존 `.github/workflows/ci.yml:170`에서 해당 스크립트를 호출함을 확인했다. workflow는 변경하지 않았다.

## 실행 증거

모든 명령의 실행 디렉터리는 저장소의 `app/`이다. 결과 경로는 저장소 기준이다.

1. 최종 안정 실행:
   `node node_modules/@playwright/test/cli.js test --config playwright.account-plan-service-mobile.config.ts --output test-results/account-plan-mobile-stable --reporter=list,json`
   결과: **6/6 통과**, 종료 코드 0. 로그에 실행 중 Vite 런타임 재로드 없음.
   로그: `app/test-results/account-plan-mobile-stable-run.log`
2. 타입 검사:
   `node node_modules/typescript/bin/tsc --noEmit --incremental false -p tsconfig.e2e.json`
   결과: 종료 코드 0. 로그: `app/test-results/account-plan-mobile-typecheck-final.log`.
3. 공용 fixture에 합성 토큰을 추가한 뒤 기존 설정 실행:
   `node node_modules/@playwright/test/cli.js test --config playwright.account-plan-service.config.ts --output test-results/account-plan-original-auth-final`
   결과: **7/7 통과, 23.2초**. 로그: `app/test-results/account-plan-original-auth-final.log`.
   이 실행은 이후 메인 API/취소 liveness 변경 및 mock fetch signal 전달 추가 이전이다.
   최종 코드 전체의 13건 동시 통과로 합산하지 않는다. 최종 통합 실행은 메인 담당 범위다.

최종 모바일 6건의 직접 검사 범위:

- `mobile 320 200% text: 100-plan loading, HTTP failure, retry and bounded originals`
- `mobile 375 200% text: 100-plan loading, HTTP failure, retry and bounded originals`
- `mobile delayed history response failure=true after owner switch cannot show old originals or failure`
- `mobile delayed history response failure=false after owner switch cannot show old originals or failure`
- `mobile cancel history with current=true: delayed completion stays cancelled until explicit retry`
- `mobile cancel history with current=false: delayed completion stays cancelled until explicit retry`

취소 두 검사 모두 기존 HTTP 응답을 해제하지 않은 상태에서 재시도 완료를 확인한다.
`delayedReleased === false`를 단언한 다음 이전 응답을 해제하고 현재 계획이 유지됨을 확인한다.
mock SDK의 fetch에 `options.signal`을 전달하며 실제 브라우저 AbortSignal을 사용한다.

## 모바일 측정

데스크톱 Chrome의 320/375 x 667 뷰포트, reduced-motion, 글꼴 크기 토큰 200% 확대다.
body 크기 14.5px에서 29px가 되었음을 직접 단언한다. OS/브라우저의 텍스트 확대 설정이나 실제 휴대폰 측정은 아니다.
HTTP/인증만 합성 대역이며 앱 UI, 서비스, 파서, IndexedDB, WebCrypto는 실제 코드다.
각 계정은 합성 V3 `stateFixture` 100개, 원본당 세션 1개이며 현재 1개/보관 99개다.

| 폭 | 재시도 클릭 전부터 10개 목록 표시까지 | 측정 프레임 수 | 최대 프레임 간격 | 오류/원본 상태 문서 너비 |
|---|---:|---:|---:|---:|
| 320px | 2923.5ms | 95 | 60.2ms | 320/320px |
| 375px | 2909.5ms | 97 | 32.5ms | 375/375px |

검사 대상 이력 터치 영역의 최소 높이는 확대 상태에서 70.390625px였다.
관측 프레임 간격은 측정값이며 성능 SLA 통과를 뜻하지 않는다. 복잡한 V6 100개나 CPU 감속/실기기 성능으로 일반화하지 않는다.
각 테스트 폴더의 `runtime-evidence.json`에 원시 측정값을 보관한다.

## 결함 주입

- 닫힌 원본도 무조건 마운트하도록 UI 조건을 제거했다. 최초 `getByRole` 단언은 숨겨진 영역을 제외해 결함을 놓쳤다.
  이 공허한 가시성 단언을 실제 DOM 개수 단언으로 교체했다.
- 같은 결함 재실행에서 정확히 `mobile 375 200% text: 100-plan loading, HTTP failure, retry and bounded originals`가
  원본 DOM **예상 0 / 실제 10**으로 실패했다.
  로그: `app/test-results/account-plan-mobile-mutation-eager-dom.log`.
- 자동 이력 조회의 `!historyPaused` 보호를 제거했을 때 정확히
  `mobile cancel history with current=false: delayed completion stays cancelled until explicit retry`가
  **예상 IDLE / 실제 LOADING**으로 실패했다.
  로그: `app/test-results/account-plan-mobile-mutation-cancel.log`.
- 두 의도적 런타임 결함은 모두 원복했다. 최종 안정 실행은 원복 후 강화한 검사다.
- 초기 320px 검사에서는 기존 현재 계획 범례로 인해 문서가 343px로 넘쳤다. 범례 반응형 수정 후 최종 검사에서 320px가 되었다.
- `account-plan-mobile-auth-final` 실행도 6건 통과했으나 메인 서비스/API 편집에 따른 Vite 재로드가 있었으므로 안정 최종 증거로 쓰지 않는다.

## 화면 증거

기준 폴더: `app/test-results/account-plan-mobile-stable/`.

- `account-plan-service-mobil-7badf-retry-and-bounded-originals/`: `loading-320-200.png`, `failure-320-200.png`, `original-320-200.png`
- `account-plan-service-mobil-99887-retry-and-bounded-originals/`: `loading-375-200.png`, `failure-375-200.png`, `original-375-200.png`
- `account-plan-service-mobil-ddcbd-celled-until-explicit-retry/cancelled-current-false-320-200.png`: 취소 뒤 대기/재시도 화면
- 계정 전환 성공/실패 응답 케이스별 `owner-switch-320.png`.
- 현재 계획이 있는 취소 케이스의 캡처는 확대 후 스크롤 위치 때문에 취소 영역을 담지 못했다. 해당 케이스의 증거는 상태/재시도 런타임 단언이며 그 캡처를 취소 UI 시각 검수로 세지 않는다.

## 변경 경로

- `app/src/screens/PlanBeta.tsx`
- `app/src/screens/plan-beta/AccountPlanStorageControls.tsx`
- `app/src/screens/plan-beta/AccountPlanStorage.css`
- `app/e2e/account-plan-service-mobile.spec.ts`
- `app/e2e/account-plan-service-mobile.setup.ts`
- `app/e2e/fixtures/account-plan-service-mobile.ts`
- `app/e2e/fixtures/account-journal-record-server.ts` (추가 승인된 합성 토큰/signal 전달만)
- `app/playwright.account-plan-service-mobile.config.ts`
- `app/package.json` (추가 승인된 기존 e2e 스크립트 연결만)
- 이 보고서

테스트가 소유한 Vite 4383 서버는 종료됐다. 운영 키/복구키 보관, 실제 계정과 별도 기기,
최종 전체 CI, 커밋/배포/공개 사용 검증은 이 결과의 범위가 아니다.
