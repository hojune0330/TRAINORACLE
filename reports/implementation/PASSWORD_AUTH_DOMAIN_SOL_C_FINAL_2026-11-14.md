# 이메일·비밀번호 인증 최종 보완

이 보고서는 PASSWORD_AUTH_DOMAIN_SOL_C_2026-11-14_SOURCE.json checkpoint 이후의 최종 동작을 기록한다. 이전 checkpoint의 소스 hash·검사 이력은 보존하고 구현 설명은 현재 동작으로 갱신했다. 기존 S3/S4 후보는 그대로다.

가입의 null session은 확인 메일 대기 상태다. 같은 브라우저에서 정확한 가입 nonce/email/기한·PKCE를 확인하고 서버 getUser/getClaims의 사용자·이메일·서명 session_id·confirmed email 및 password/email/signup AMR가 맞으면 SIGNED_IN으로 이어진다. 실제 가입 proof를 만든 뒤 기존 신규정보/서버 admission 절차로 이동하며 비밀번호를 다시 요구하지 않는다. recovery AMR 또는 미확인 이메일은 이 경로에 들어가지 않는다. 다른 브라우저에서 PKCE 증명을 사용할 수 없으면 확인 완료나 가입 실패를 단정하지 않고 이메일·비밀번호 로그인으로 이어간다.

iPhone 홈 앱에서 요청한 메일이 Safari로 열리면 원래 PKCE verifier/intent가 없을 수 있다. 기존 PKCE 전용 복구만으로는 이 경우를 처리할 수 없었다. 최종 경로는 전용 recovery 템플릿의 fragment TokenHash와 정확한 type=recovery를 읽어 즉시 URL에서 지운다. query TokenHash, 다른 type, 혼합/중복 credential은 거절한다. 전용 메모리 auth client는 persistSession=false, autoRefreshToken=false, detectSessionInUrl=false이며 일반 계정 저장소에 recovery 세션을 설치하지 않는다. 서버 verifyOtp→getUser/getClaims로 증명한 이메일을 화면에 표시하고, 명시적인 새 비밀번호 제출과 같은 recovery 세션 확인 후 updateUser를 실행한다. 독립 세션 sign-out과 일반 세션 부재가 확인돼야 quarantine을 해제하고 새 비밀번호 로그인을 안내한다. 다른 Safari 일반 계정이 이미 있으면 교체하거나 자동 로그아웃하지 않고 기존 계정의 명시 로그아웃을 먼저 안내한다. 세션을 만든 적 없는 자기 PRE_EXCHANGE marker만 취소할 수 있고 UNKNOWN/다른 quarantine을 해제하지 않는다.

supabase/templates/password-recovery.html은 공식 TokenHash/type=recovery 템플릿 적용용 소스다. `{{ .RedirectTo }}`는 앱의 account/password_action=recovery 복귀 URL이고, TokenHash는 fragment에만 둔다. 실제 Supabase recovery 이메일 템플릿에 이 파일을 적용하고 정확한 canonical redirect allowlist/SMTP 전달을 확인해야 Mail→Safari 경로가 운영에서도 동작한다. 이 파일을 추가했다고 관리 설정이 바뀌지 않는다. root의 로그인/운영 승인 대기로 설정 적용·실제 메일 왕복은 미실행이며 PASSWORD_OPERATIONS 승인 값을 추정하지 않는다.

## 증거 범위

최종 수정 후 영향 받은 password-auth.contract.test.ts만 실행했다: node node_modules/vitest/vitest.mjs run src/domain/account/password-auth.contract.test.ts --maxWorkers=1 --no-file-parallelism --reporter=verbose, app cwd, exit0, 23/23, 5.26초. 로그 tmp/password-auth-c-signup-crossbrowser-final.log. 같은 브라우저 가입 직행, 다른 브라우저 가입의 중립적 로그인 안내, Safari TokenHash 전용 독립 클라이언트, 서버 이메일 표시, 일반 계정 비교체, query/다른 type 거절, 정상 비밀번호 proof와 recovery 권한 분리, 동일 session refresh, 모르는 quarantine 및 세션 종료 실패를 포함한다. 실제 브라우저·SMTP·공급자 운영 API 시험이 아닌 합성 계약 검사다.

기존 checkpoint의 나머지 4파일 58 PASS와 hosted env 26 PASS는 해당 코드가 바뀌지 않아 반복하지 않았다. 첫 checkpoint의 5개 ReferenceError 실패와 해당 수정 후 17 PASS도 역사적 기록으로 보존한다. 이를 모두 더해 한 번에 통과한 전체 검사 수로 보고하지 않는다. 전체 suite·타입 검사·빌드·실메일·실계정은 추가 실행하지 않았다. B 최종 화면과 A SQL의 검사는 별도 보고서를 따른다.

공식 근거: [비밀번호 재설정 API](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail), [verifyOtp](https://supabase.com/docs/reference/javascript/auth-verifyotp), [이메일 템플릿](https://supabase.com/docs/guides/auth/auth-email-templates). 운영 적용은 구체적인 원격 승인 후 수행하며 public push/merge/배포는 이 단계에서 하지 않는다.
