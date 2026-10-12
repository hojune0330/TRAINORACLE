# 계정 복원과 삭제 및 로컬 뒤로가기 개선

2026년 10월 7일 승인된 순서에 따라 남은 계정 복원·삭제 경계와 로컬 뒤로가기 문제를 개선했다. 정상 기록과 미전송 자료는 보존하며, 계정 삭제 성공이나 계정 전환 뒤 이전 작업이 권한·저장·화면을 다시 적용하지 못하게 했다. 이번 범위는 로컬 구현과 관련 검사이며 공개 배포나 실계정 검증이 아니다.

기준 작업실은 `TRAINORACLE-ux-oracle-integration-20261006`, 브랜치는 `main`이다. 시작 때의 개인 계획 수정 `583e66ad`와 병행 작업자가 완료한 `b264d71c`를 보존했다. 최종 로컬 검증은 `b264d71c` 위의 이번 변경이 포함된 작업본에서 수행했다. 이 보고서를 포함하는 커밋의 식별자는 Git 기록에서 확인한다.

## 완료한 동작

### 복원 실패 이유 구분

- `SOURCE_UNAVAILABLE`와 정확한 `source_unavailable` 영수증을 현재 문서 변경·일반 충돌·일시 실패·늦은 응답과 구분한다. 문서·작업·현재 revision·복원 source revision을 검증한다.
- 더 이상 복원할 수 없는 정확한 수정본은 다시 전송하지 않는다. 다른 수정본, 현재 일지, 삭제 이력은 지우지 않는다.
- 현재 내용이 바뀌었거나 요청이 충돌하면 다시 불러와 확인하도록 안내한다. 기존 boolean 복원 API와 30일 이력·보관 기한 계약은 유지한다.

### 삭제 후 로컬 권한 종료

- `request_account_deletion`의 유효한 ISO timestamp 영수증을 확인한 뒤 즉시 해당 소유자의 로컬 권한을 닫는다. 실패하거나 잘못된 영수증이면 정상 계정을 봉쇄하지 않는다.
- 기기 표식과 메모리 상태를 함께 사용한다. 표식을 읽을 수 없는 상태는 `UNKNOWN`이며, 삭제 사실로 단정하지 않고 계정 활성화·전송을 중단한다. API는 `UNAVAILABLE`, 동기화는 자료를 보존하는 `PENDING`으로 구분한다.
- 늦은 동의·조회·전송·ACK·임포트와 다른 탭의 이전 권한이 삭제된 계정을 다시 열지 못한다. A의 삭제 신호는 정상 B 또는 비회원 권한을 닫지 않는다.
- IndexedDB 거래는 삭제된 소유자의 진행 중 작업만 중단한다. 이미 보관한 원문·암호문·고정 operation·미전송 수정본·비추출 기기 키는 삭제하지 않는다.
- 기본 로컬 데이터 정리는 삭제 표식을 남긴다. 명시적인 전체 흔적 삭제로 지속 표식을 지워도 현재 탭의 삭제 상태는 열리지 않는다. 새로운 탭의 실제 계정 허용 여부는 기존 서버 admission 관문으로 확인해야 한다.

### 계정 전환 뒤 로그아웃 보호

삭제 후 전체 로그아웃, 실패 뒤 이 기기 로그아웃, 수동 재시도와 소유자가 확인된 일반 로그아웃에는 예상 계정과 인증 세대를 함께 전달한다. 보호 구간 대기·클라이언트 초기화·세션 확인 뒤, 실제 SDK 호출 직전과 결과 처리 전에도 확인한다. A에서 B를 거쳐 A로 돌아온 새 세션은 이전 작업의 대상이 아니다.

설치된 Auth SDK 2.109.0 자체에는 예상 계정을 고정하는 원자성 보장이 없다. 본앱의 SMS·이메일·OAuth 교환과 로그아웃이 공통 origin 보호 구간을 끝까지 보유하는 정상 경로에서 가드를 적용했다. 다른 SDK 클라이언트나 수동 저장소 변경까지 이 검사로 보장하지 않는다. raw/admin 로그아웃 경로나 새로운 권한은 추가하지 않았다.

### 뒤로가기와 화면 복귀

- 확인창은 내용 없는 창 식별자만 브라우저 이력에 넣는다. Back과 Escape는 최상위 확인창만 닫으며, 하위 일지 reader·달력 원문·꾸미기 도구가 같은 POP를 재처리하지 않는다.
- 버튼으로 닫은 이전 창의 비동기 Back이 끝나기 전에 새 창 또는 같은 ID 창이 등록되면 이전 POP를 먼저 소비한다. 늦은 이벤트가 새 창을 닫거나 Forward가 삭제·저장을 재실행하지 않는다. 처리 중인 확인 동작은 기존 닫기 guard를 존중한다.
- 가장자리 24px에서는 일지 페이지 넘기기를 시작하지 않는다. 멀티터치·세로 움직임 취소를 유지하고 입력·열린 편집기·dialog는 넘기기 대상에서 제외한다.
- POP는 예약된 화면 정렬을 취소한다. 지연 RAF와 220ms 정렬에는 이동 세대와 계정 세대를 검사하며, 복귀 RAF와 보류된 임시 입력 이탈 결정도 같은 생명주기를 확인한다.
- 확인창 초점 복귀의 지연 타이머를 제거했다. 원래 계정 세대, 새 확인창 없음, 연결된 원래 버튼을 확인한 뒤 정리 시점에만 즉시 복귀한다.

## 관련 로컬 검증

전체 검사 반복 대신 수정한 경계의 검사만 실행했다. 아래 묶음에는 중복 검사가 있으므로 수를 합산하거나 동일 SHA의 전체 릴리스 관문으로 표현하지 않는다.

| 검사 범위 | 실제 결과와 실행 경계 |
|---|---|
| 복원 API 계약 | 최종 98/98 통과. `UNKNOWN` 추가 뒤 마지막 API 검사 결과 |
| 복원 서비스와 이력 UI | 각각 12/12, 8/8 통과. API 추가 전 세 파일 114/114를 실행했고, 추가 뒤 API만 다시 확인 |
| 삭제·동의·버퍼·기기 정리·계정 UI | 11파일 170/170, 생략 0. 20:59:20 KST의 핵심 경계 묶음이며 뒤이은 auth 보완 전 결과 |
| 마지막 auth와 계정 로그아웃 UI | 2파일 52/52, 생략 0. 21:13:40 KST. 170 묶음 뒤의 로그아웃 보완을 별도로 검증 |
| 실제 브라우저 IndexedDB | 합성 자료 4/4 통과. 새로고침, 다른 탭, 진행 중 암호화·ACK·실제 IDB transaction 중단과 정상 B 대조 |
| AppShell와 복귀 RAF | 최신 `b264d71c` 작업본에서 2파일 23/23 통과. 계획 담당자가 추가한 관련 검사도 함께 실행 |
| 뒤로가기 단위·컴포넌트 | 고유 47개를 여러 좁은 묶음으로 실행. 최종 초점 변경 후에는 확인창 관련 3파일 12/12를 재확인. 마지막에 47개 전체를 다시 실행한 결과는 아님 |
| 새 로컬 번들의 뒤로가기 | 큰 화면·320px의 3개 동선, 총 6경로 증거 확보. 첫 번들의 꾸미기 2개 통과 후, 초점 및 제목 selector를 수정한 마지막 번들에서 나머지 4개 통과 |
| 앱 타입과 번들 | Node 24.19.0의 표준 `npm run build` 통과. 브라우저에서 발견한 실제 초점 문제 수정 후 전용 출력으로 한 번 더 빌드하여 통과 |
| 브라우저 검사 타입 | 최초에는 기존 두 파일의 `reducedMotion` 옵션 오류로 실패. 병행 작업자의 `b264d71c` 수정 뒤 `tsc --noEmit -p tsconfig.e2e.json` 재확인 통과 |

브라우저 동선은 꾸미기 도구·글 입력창을 순서대로 닫기, 삭제 확인창 Back·Forward·Escape, 설명 화면에서 원래 일지로 돌아오기다. 실제 합성 일지·꾸밈 원본이 유지됐고 휴지통이 생성되지 않았다. 확인창 취소 뒤 원래 버튼으로 초점이 돌아왔으며, 비영점 스크롤이 330ms 후에도 원래 위치의 ±2px 이내였다.

브라우저는 격리 context와 합성 기록만 사용하고 외부 origin 요청을 차단했다. 전용 출력은 `app/.scratch/account-navigation-final-build`이며 계정·동기화·제품 분석 전송을 끈 상태였다. 공유 `dist`, 공개 Pages와 사용자 브라우저 저장소는 이 빌드의 대상이 아니다. 폰트 경로 및 기존 청크 경고는 남아 있으며 빌드 실패는 아니었다.

11파일 삭제 검사 목록은 다음과 같다. 실행 결과는 Vitest 화면 출력이며 별도 JSON 영수증을 만들었다고 주장하지 않는다.

```text
src/domain/account/account-service.contract.test.ts
src/domain/account/account-deletion-boundary.contract.test.ts
src/domain/account/account-journal-sync.contract.test.ts
src/domain/account/storage-consent.contract.test.ts
src/domain/account/storage-consent-revision.contract.test.ts
src/domain/account/verified-account-scope.contract.test.ts
src/domain/account/account-journal-draft-buffer.contract.test.ts
src/domain/erase-local-data.contract.test.ts
src/screens/Account.session-exit.contract.test.tsx
src/screens/account/AccountJournalDraftPanel.contract.test.tsx
src/screens/account/AccountJournalDraftPanel.autosave.test.tsx
```

좁은 실행은 설치된 Vitest와 Playwright를 직접 사용했다. 브라우저 삭제 검사는 전용 `playwright.account-draft-buffer.config.ts`, 화면 뒤로가기는 `navigation-boundary.spec.ts`의 desktop·touch-narrow만 사용했다. 신규 삭제 검사는 일반 preview 검사 목록에서 제외하여 전용 실제 IDB 경로에서만 실행한다.

## 결함 검출 대조

의도적 결함으로 명명된 검사가 실패하는지 확인한 뒤 생산 소스를 복구했다. 대표 실패 이름은 다음과 같다.

- 삭제 닫기 누락: `beta account admission service > closes the owner's local generation on a valid deletion before any logout callback`.
- 확인 불가를 열린 상태로 변경: `treats an unreadable marker as UNKNOWN and refuses account scope without claiming deletion or blocking guest`.
- SDK 직전 확인 누락: `rechecks deletion generation immediately before the actual SDK sign-out call`.
- 지속 삭제 표식 무시: `deletion is terminal after reload while native ciphertext, pending snapshot and nonextractable key are retained`, 실제 `deleted owner must never send` 실패.
- 복귀 RAF의 이동 세대 확인 누락: `ignores a frame after browser Back or Forward has advanced`.
- 보류된 이동의 계정 세대 확인 누락: `does not resume a delayed draft decision after the owner lifetime has changed`.

복원 원본 구분, 반복 복원 차단, 가장자리 넘기기, 처리 중 Back, 신규·동일 ID 창의 예약 POP, reader 중복 닫기, 계정 왕복 뒤 스크롤·초점도 이름으로 실패를 확인했다. 메모리 주입의 실제 exit 1과 정상 복구의 exit 0을 구분했다. 접근 제한으로 0 tests였던 실행과 줄바꿈에 따른 주입 하네스 시작 오류는 검출·통과 수에 포함하지 않는다. 실제 브라우저의 초점 실패는 수정 전·후 비교로 별도 확인했다.

## 소유권과 보존

주요 구현은 `account-journal-api.ts`, `account-journal-record-service.ts`, `AccountJournalHistory.tsx`, `account-deletion-boundary.ts`, `account-journal-sync.ts`, `account-journal-draft-buffer.ts`, `auth.ts`, `Account.tsx`, `browserNavigation.ts`, `JournalConfirmationDialog.tsx`, `useActiveContentScroll.ts`, `useNavigationReturnFrame.ts`와 `AppShell.tsx`에 있다. 관련 계약·브라우저 검사와 전용 검사 설정만 함께 변경했다.

`local-journal-ownership.ts`의 가시 기록 조회 변경과 개인 계획·수입·선택·복구 변경은 병행 작업자의 `b264d71c`에 속한다. 이번에는 삭제 helper import와 활성화 조건만 추가했다. 같은 파일의 다른 변경을 이번 작업으로 보고하지 않는다. 기존 미추적 scratch, 이미지, 자산, 다른 작업실과 PR은 보존했다.

## 공개와 다음 작업의 경계

기존 계정 공개 보류와 서버 저장 관문을 유지한다. DB·Edge·OAuth/SMS 공급자·전용 인증 도메인·공개 설정을 변경하지 않았고 실계정 자료 왕복도 실행하지 않았다. 로컬 구현·타입·빌드·합성 브라우저 확인을 계정 공개, 자료 완전 삭제, CI 또는 운영 배포 증거로 대체하지 않는다.

이번 변경은 기존 native history 구조의 필요한 동작만 보완했다. 이전 React Router 묶음 전체 이식이나 계획 질문마다 브라우저 Back 이력을 만드는 작업은 포함하지 않았다. 물리적 iOS·Android 가장자리 제스처, 매우 늦은 최초 lazy 화면 mount, origin 보호 구간을 우회하는 외부 SDK 동작도 별도 확인 범위다.

이 단계는 로컬 뒤로가기 개선까지다. 미니게임 초안 PR #349의 통합과 공개 배포는 착수하지 않았다. 다음 공개 단계에서는 최신 main·소유권·필수 릴리스 관문을 다시 확인하고, 기존 계정 보류와 자산 보존형 게시 규칙을 적용한다. 푸시로 자동 게시가 시작될 수 있으므로 로컬 커밋을 공개 승인으로 해석하지 않는다.
