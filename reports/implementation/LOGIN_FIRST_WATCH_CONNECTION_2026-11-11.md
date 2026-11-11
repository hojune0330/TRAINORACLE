# 가입·로그인 직후 워치 연결 구현 기록

작성일: 2026-11-11. 사용자 요구: 워치 연결을 가입·로그인 직후 가장 먼저 발견하게 하고 불필요한 메뉴와 반복 설정을 줄인다.

## 변경 결과

- Account의 기존 일반 가져오기 카드를 실제 DeviceConnections/GarminConnectionPanel로 교체하고 계정 정보 위로 이동했다. 가입 확인 완료와 로그인 후 ready 상태에서 실제 스크롤 컨테이너 및 포커스를 연결 영역으로 이동한다.
- 보관 동의가 완료된 미연결 계정은 앱 안에서 기존 일반 카드 → 연결 시작 → 동의 버튼의 세 단계를 동의 버튼 한 번으로 줄였다. 외부 Garmin 로그인·권한 승인은 그대로 필요하다.
- ACTIVE 계정에는 연결 동의를 반복하지 않고 받은 운동과 서버가 확인한 정확한 날짜·ID의 일지를 바로 연다. 파일 가져오기는 파일 모드로 바로 진입한다.
- 최초 보관 동의는 단일 기존 StorageConsentPanel을 재사용한다. 실제 load/save 결과를 상단에 전달하고, required/checking/unavailable을 provider capability와 독립적으로 표시한다. 동의 확인 전 Garmin 요청을 시작하지 않는다.
- 보관 설정 버튼이 기존 disclosure를 펼쳐 이동한다. 두 목적에 대한 명시적 선택 후 저장 성공·운영 준비·전송 보류 해제 확인 때만 연결 영역으로 돌아온다. 이전 계정/언마운트의 늦은 응답은 무시한다.
- 로그인이나 보관 동의 저장 자체는 Garmin connect를 호출하지 않는다. 명시적 연결 버튼만 요청한다. 기존 저장 방식·철회·중복 처리·일지 초안 보호를 유지한다.
- Account 헤더의 뒤로 버튼은 활성화된 Garmin 하위 화면부터 닫는다.

## 집중 검증

- Account, GarminConnectionPanel, StorageConsentPanel, AccountNetworkSettings 4파일의 60개 검사 통과.
- 마지막 요청 순서 보완 후 GarminConnectionPanel 36개 검사 통과. 이 중 보관 확인 대기→ready에서 status/inbox를 각각 한 번 요청하는 회귀 검사 1개가 추가됐다. 앞의 60개와 중복 합산하지 않는다.
- AppShell 기존 파일에서 watch import / connection login / embedded watch 관련 9개 검사 통과, 관련 없는 22개는 필터로 실행하지 않았다.
- 최종 TypeScript 검사 및 git diff --check 통과.
- 실제 Account/연결/보관 UI와 AppShellFrame/하단 탭을 렌더한 합성 Chromium 320/375×812의 미연결·ACTIVE·보관필요 6조건 통과. 별도 브라우저 보고서에 좌표·터치 크기·행동·스크린샷을 기록했다.
- 320px 미연결 연결 버튼 y551~599, 실제 하단 탭 y726부터. 추가 스크롤 없이 주 행동과 나중에 연결이 함께 보인다. 가로 넘침 및 브라우저 pageerror 없음.

## 근거 및 완료 경계

브라우저 검수: ../review/login-connection-2026-11-11/README.md
측정: ../review/login-connection-2026-11-11/browser-results.json
대표 화면: ../review/login-connection-2026-11-11/unconnected-320-viewport.png

현재 로컬 구현과 합성 브라우저 검수가 완료됐다. 운영 배포, 실제 신규 가입/이메일 인증, Garmin OAuth·실제 기록 수신, 실기기 및 실제 중학생 사용성 시험은 이번 결과에 포함하지 않는다. COROS·Apple·Samsung의 실제 승인/운영 연결 상태를 이 화면 변경으로 완료했다고 간주하지 않는다. 기존 다른 작업 파일은 보존했고, 원격 main 변경과 배포를 수행하지 않았다.
