# 비밀번호 인증 통합 출시 체크리스트 — 2026-11-14

이 문서는 실행 기록이 아닌 출시 인계용 체크리스트다. 비밀번호 가입·로그인·재발송·복구,
설정의 비밀번호 변경과 로그아웃, OAuth 세션 복구, 원래 목적지로 1회 복귀, 자료 관리 화면 분리, 생년월일 재입력 없는 약관 재동의를 하나의 후보 SHA로 함께 출시한다.
아래 설치와 활성화 순서는 같은 출시의 안전 게이트이며 기능을 다음 출시로 미루는 계획이 아니다.
저장소 변경, 로컬 검사, 운영 적용, 실제 계정 검증은 각각 별도 증거를 남긴다.

## 1. 후보 확정과 서버 설치

- [ ] 변경 파일과 후보 SHA를 확정한다. 통합 인증 회귀 검사, 타입 검사, 빌드와 프로젝트 필수 게이트의 결과를 같은 후보에 연결한다.
- [ ] `20261114035856_oauth_credential_auth_method_fix.sql` 선행 적용 여부를 확인한다.
- [ ] `20261114042129_password_account_auth_channel.sql` 및 `20261114120000_account_settings_actions.sql`을 검토하고 순서대로 적용한다. 적용 영수증을 출시 기록에 적는다.
- [ ] 설치 시 `service_feature_controls`의 `AUTH_PASSWORD=false`를 확인한다. 이미 존재하는 플래그는 migration의 `ON CONFLICT DO NOTHING`으로 자동 닫히지 않으므로 실제 값을 별도로 확인한다.
- [ ] 새 권한·함수의 정상 인증, 다른 소유자 거절, recovery/OTP 세션의 일반 계정 권한 거절과 설정 변경 재인증 경계를 검증한다. 개인 기록을 열람하는 방식으로 검증하지 않는다.

## 2. 관리자 설정 — 완료 전 활성화 금지

- [ ] 관리자: 발신 도메인과 custom SMTP 연결, 발송 제한, 실제 메일 수신을 확인한다. 비밀값과 토큰은 기록에 넣지 않는다.
- [ ] 관리자: Hosted `Confirm signup` 본문을 `supabase/templates/confirm-password-signup.html`과 일치시킨다. 버튼은 `{{ .ConfirmationURL }}`이며 공급자 확인 후 PKCE code가 앱에 돌아와야 한다.
- [ ] 관리자: Hosted `Reset password`는 `supabase/templates/password-recovery.html`과 일치시킨다. `{{ .RedirectTo }}#token_hash={{ .TokenHash }}&type=recovery` 경로를 유지한다. 가입 링크 형식으로 바꾸지 않는다.
- [ ] 기존 `confirm-signup.html`과 `magic-link.html`은 passwordless fragment 계약의 보존 원본이다. 같은 Hosted Confirm signup 슬롯에 두 본문을 동시에 적용할 수 없다. 비밀번호 가입 템플릿 활성화 시 기존 passwordless 신규 가입 경로는 닫고, 이미 승인된 magic-link 경로는 별도 계약대로 유지한다.
- [ ] 관리자: Supabase Site URL과 Redirect URLs를 공개 canonical 도메인/앱 경로에 맞춘다. 가입·복구 요청에 포함되는 `account`, `password_action`, `password_flow` query를 허용된 복귀 주소에서 보존하고 이전 공용 인증 origin으로 돌아가지 않는지 확인한다.
- [ ] 관리자: Supabase 이메일 확인 정책과 비밀번호 정책을 후보 UI/서버 계약과 일치시킨다. 설정의 비밀번호 변경이 요구하는 현재 비밀번호 재인증과 공급자 설정이 함께 동작하는지 확인한다.
- [ ] DOMAIN 후보의 `scripts/canonical-account-config.mjs`, `scripts/prepare-domain.mjs` 및 관련 검사를 함께 반영한다. repository variable `TRAINORACLE_CANONICAL_ACCOUNT_CONFIG`에 `VITE_PASSWORD_AUTH_ENABLED=true`, `VITE_PASSWORD_AUTH_OPERATIONS_APPROVED=true`, `VITE_KILL_PASSWORD_AUTH=false`를 명시한다. 계정 공통 공개 설정·법적 문서 버전·기존 provider 설정도 유효해야 한다. 배포 환경은 이 canonical 설정과 일치해야 한다.

## 3. 같은 출시의 활성화와 실제 검증

- [ ] 위 관리자 항목의 영수증을 확보한 뒤 `AUTH_PASSWORD=true`를 활성화한다. 프런트 후보는 `VITE_PASSWORD_AUTH_ENABLED=true`, `VITE_PASSWORD_AUTH_OPERATIONS_APPROVED=true`, `VITE_KILL_PASSWORD_AUTH=false`로 빌드한다. 런타임에서 VITE 값을 바꾸는 것만으로 이미 빌드한 파일이 달라지지 않는다.
- [ ] 확정 소스를 main에 반영한 뒤 DOMAIN `publish.yml`의 `account_mode=canonical`, `source_sha=<현재 source main SHA>`로 배포한다. 배포된 SHA/서비스워커 자산과 공개 URL이 확정 후보를 가리키는지 확인한다.
- [ ] 승인된 테스트 계정: 신규 이메일+비밀번호 가입 → 확인 메일 수신 → 같은 브라우저 링크 → 이메일 확인과 가입 계속하기. 메일 대기 중 재발송, 잘못된 이메일 재발송 차단, 이미 쓴/만료 링크 실패도 확인한다.
- [ ] 다른 브라우저에서 가입 링크를 열었을 때 확인되지 않은 세션을 계정 권한으로 승격하지 않고 비밀번호 로그인 안내로 돌아가는지 확인한다.
- [ ] 정상 비밀번호 로그인, 틀린 비밀번호, 새로고침 뒤 세션, 전체 로그아웃 및 OAuth 정상 복귀를 확인한다.
- [ ] 복구 메일 → 격리된 복구 화면 → 새 비밀번호 저장 → 새 비밀번호로 재로그인. 복구 중 일반 계정 화면/동기화/설정 변경 권한이 열리지 않아야 한다. 취소·만료·재사용도 확인한다.
- [ ] 설정: 현재 비밀번호 재확인 → 새 비밀번호 변경 → 새 비밀번호 재로그인, 잘못된 현재 비밀번호 거절, Google 전용 사용자가 같은 계정에 비밀번호를 추가해도 user ID·일지·연결이 유지되는지 확인한다. 추가 확인이 요구되면 공식 reauthenticate nonce로 이어간다.
- [ ] 서버 게이트가 닫혔을 때 새 비밀번호 로그인·계정 접근이 거절되는지 확인한다. 운영 플래그를 다시 열었다면 최종 값과 검증 시각을 기록한다.

## 4. 중단과 복구

- [ ] 링크 계약 불일치, 잘못된 소유자/AMR 허용, recovery 세션의 일반 권한, 세션 정리 실패 또는 실제 메일 불능이면 출시 성공으로 기록하지 않는다.
- [ ] 즉시 `AUTH_PASSWORD=false`로 서버 경로를 닫고 프런트 `VITE_KILL_PASSWORD_AUTH=true` 후보를 배포한다. 이미 열린 세션/진행 중 요청의 차단은 실제 서버 동작으로 확인한다.
- [ ] 공개 password 플래그 세 값을 false/true/false(enabled/kill/operations approved)로 바꾸고 현재 main의 새 canonical 산출물을 게시한다. DOMAIN은 현재 main과 다른 source SHA를 거절하므로 과거 SHA를 임의로 재게시하지 않는다. 새 migration은 데이터와 함께 유지하고 호환성 검토 후 보완 migration으로 수정한다. 계정, 기록, credential 데이터 삭제나 migration history 조작을 롤백으로 사용하지 않는다.
- [ ] 이전 Confirm signup 본문 복구는 passwordless 경로 재개와 비밀번호 가입 중단이 함께 검토된 경우에만 수행한다. 기존 발송 링크는 템플릿 교체로 바뀌지 않으므로 만료/재요청 동작을 확인한다.

공식 근거: [Supabase 이메일 템플릿 변수](https://supabase.com/docs/guides/auth/auth-email-templates),
[PKCE 흐름](https://supabase.com/docs/guides/auth/sessions/pkce-flow),
[Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).
운영 템플릿·SMTP·redirect 설정은 관리자 확인 대기이며 이 문서 생성으로 적용되지 않는다.
