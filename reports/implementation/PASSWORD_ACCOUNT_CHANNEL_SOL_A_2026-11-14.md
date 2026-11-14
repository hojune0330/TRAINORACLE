# 일반 이메일·비밀번호 계정 채널 — Sol A

기준은 `TRAINORACLE-auth-hotfix-20261114`의 `5025f624`다. 소유자의 2026-11-14 일반 회원가입·로그인 요구가 기존 비밀번호 인증 금지 정책을 명시적으로 대체한다. 기존 OAuth 핫픽스의 운영 적용과 이번 일반 비밀번호 채널 준비는 별도 작업이다. A는 운영 DB 변경, 개인 사용자/JWT 조회, 실계정 로그인, 커밋·배포를 수행하지 않았다.

## 적용 가능한 core

CLI로 생성한 `20261114042129_password_account_auth_channel.sql`은 `AUTH_PASSWORD`를 독립 서버 관문으로 추가하며 기본값은 **false**다. 기존 OAuth와 passwordless 스위치를 바꾸지 않는다. 정상 `password` 또는 `password + token_refresh`, 확인된 `email/signup`과 실제 비밀번호 자격 증명은 확인된 이메일·활성 본인 세션·현재 `AUTH_PASSWORD`가 있어야 허용된다. `email/signup`에 비밀번호가 없으면 기존 passwordless 채널로 남는다. OAuth는 별도 비밀번호의 존재로 거부하지 않는다.

복구·초대·익명·알 수 없는 AMR, refresh-only 및 password와 OAuth/OTP의 새 복합 경로는 거부한다. 복구 AMR가 남은 세션은 비밀번호 변경 후에도 일반 회원 권한이 되지 않으며 정상 비밀번호로 새 로그인해야 한다. 비밀번호 없는 기존 OTP/magiclink 경로의 보수적인 자격 증명 제한은 유지한다.

현재 text RPC와 boolean wrapper는 공통 private 분류를 소비한다. 운영 채널 중단은 기존 `AUTH_CHANNEL_DISABLED`, 세션 문제는 `AUTH_SESSION_INACTIVE`, 허용되지 않은 AMR는 `AUTH_METHOD_UNSUPPORTED`다. 공개 RPC 인자·결과 형태, 나이·약관·본인/세션·베타·삭제·보관 동의 조건과 RLS·공개 execute 권한은 바꾸지 않는다. 새 내부 helper는 직접 execute 권한이 없다. 비밀번호나 JWT 본문을 앱 DB·발급 권한에 보관하지 않는다.

설치된 Lounge는 실제 발급 채널을 `requires_password` 최소 표식으로 추가한다. 기존 표식 있는 권한은 false를 유지하고 출처 불명 legacy 권한은 계속 거부한다. 현재 비밀번호 채널을 닫으면 이미 발급된 해당 Lounge 권한도 거부하고, OAuth만 닫은 경우 비밀번호 발급 권한은 유지한다. 기존 만료·활성 세션·회원 입장·16개 상한·발급 속도·해시 credential 저장 경계는 유지한다.

## 미설치 comparison 분리

Root의 read-only 운영 metadata 결과는 Lounge table/issue/inspect/기존 marker와 auth status helper가 존재하지만 `oracle_profile_comparison_attested(text,text,text)`는 없었다. 따라서 core migration은 comparison의 존재를 요구하거나 이를 생성하지 않는다. 설치된 Lounge의 정확한 prerequisite는 트랜잭션 시작 시 확인하며 누락되면 변경 없이 실패한다.

`supabase/operations/password_auth_comparison_companion.sql`은 **자동 migration이 아닌, 미적용 선택 기능 companion**이다. 별도 승인된 comparison 기능을 0062로 처음 설치하고 core를 적용한 후에만 실행한다. 필수 함수 존재와 정확한 기존 attested 본문을 확인하며 채널 분류·저장된 상대방/동의 채널의 현재 권한 재검사를 공통 helper에 연결한다. 사용자 비교의 양자 동의·원문/CAS·잠금·철회는 그대로다. comparison key/control을 만들거나 켜지 않는다. 향후 comparison 최초 배포에서는 이 companion 적용을 선행조건으로 포함해야 한다.

## 최소 실행 근거

최종 core: `tmp/password-account-core-sql.log`, **1/1 PASS, exit 0**. 운영처럼 0062 comparison을 제외한 실제 0001–0065 migration, 11/4 legal migration, 앞선 OAuth 핫픽스 및 최종 core를 disposable PGlite에서 실행했다. 적용 전후 comparison 함수가 없음을 단언했다. 정상 password/refresh/확인된 signup, default false 및 독립 채널, 확인되지 않은 이메일/자격 증명 부재/복구 혼합/알 수 없는 방식/세션 만료 거부와 실제 Lounge 발급·익명 inspector의 저장 채널 재검사를 확인했다. 기존 소유자·세션·약관·별도 보관 동의·private grants도 확인했다.

그 전에 `tmp/password-account-channel-sql.log`의 1/1 PASS는 0062가 설치된 합성 환경에서 분리 전 구현을 실행한 근거다. 실제 comparison 초대 발급의 `owner_auth_channels=['AUTH_PASSWORD']` 및 저장 채널 중단 재검사도 그 범위에서 확인했다. 최종 companion 파일 자체를 재실행한 증거로 확대하지 않는다. Root가 운영 미설치 상태를 확인한 뒤 core 분리를 명시적으로 요청하여 최종 production-like core 경계만 한 번 더 실행했다. 추가 전체 테스트·프런트 테스트·typecheck·브라우저/기기·provider 요청은 수행하지 않았다.

Core SHA256: `ed0a209f377b03b3c6aeb264d834ac199b46d31f9b8e94f9fbf7e20f8e0113e0`.

Companion SHA256: `32b5fa959eaad5c0794e8f477a19122fa8ae5e224b0d6a2c1f421a76856f874d`.

## 인계·미완료

`docs/ACCOUNT_PUBLIC_RELEASE_GATE.md`와 `docs/SUPABASE_SETUP.md`는 새 소유자 채택과 독립 스위치, 확인 메일·재설정·Hosted Auth 설정, 기존 금지 정책의 은퇴와 미설치 comparison 분리를 명시한다. B/C가 UI·SDK 가입/로그인·이메일/복구 격리 경로를 소유한다. A의 계정 service 메시지는 이전 핫픽스에 있는 reason을 그대로 사용하므로 새 변경은 없다.

실제 SMTP/관리 설정과 공개 여부를 확인한 뒤 `AUTH_PASSWORD`를 켜는 작업은 root 소유이며 여기서 실행하거나 완료로 표시하지 않는다. 운영 migration 적용·서버 flag 활성·웹 공개·실제 일반 가입/로그인 확인은 각각 별도 근거가 필요하다. 이 문서는 새 승인이나 개인 자료 조회를 요구하지 않는다.
