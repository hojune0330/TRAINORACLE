# TrainOracle Auth Templates

이 폴더의 템플릿은 비밀값을 포함하지 않는 검토 가능한 원본이다.

- `confirm-signup.html`: 신규 가입 때 앱의 `{{ .RedirectTo }}`로 일회용
  `{{ .TokenHash }}`를 보내며, 앱은 이를 `verifyOtp({ type: "email" })`로 확인한다.
- `magic-link.html`: 기존 사용자의 재로그인도 같은 PKCE token-hash 콜백을 사용한다.
- `confirm-password-signup.html`: 비밀번호 가입용 `Confirm signup` 원본이다.
  `{{ .ConfirmationURL }}`에서 공급자가 이메일을 확인한 뒤 앱으로 PKCE code를 돌려준다.
  운영 비밀번호 가입을 열 때는 이 원본을 사용하며 기존 `confirm-signup.html`은 보존한다.
- `password-recovery.html`: 격리된 복구 화면에 `type=recovery` token-hash를 전달한다.
- 로컬 Supabase의 `config.toml`은 비밀번호 가입·복구 템플릿을 각각 confirmation/recovery에 연결한다. 이메일 확인을 요구하며 새 비밀번호 최소 길이는 8자다.
- Hosted Supabase는 관리자 화면에서 confirmation/recovery 슬롯을 각 원본과 대조하고 실제 발신 설정을 확인한다. 서로 다른 슬롯에 같은 본문을 일괄 적용하지 않는다.
- 발신 도메인, SMTP 비밀번호, OAuth client secret, SMS provider key는 이 폴더와
  Git에 절대 저장하지 않는다.

이메일 버튼은 Hosted Supabase의 두 템플릿이 이 원본과 일치하고 공개 복귀 주소가
허용 목록에 있다는 운영 확인 뒤에만 `VITE_EMAIL_AUTH_PKCE_OPERATIONS_APPROVED=true`로
연다. 저장소 템플릿 변경만으로 운영 적용을 주장하지 않는다.

운영 적용 전에는 제목, `RedirectTo + TokenHash` fragment 형식, 한 번 사용 안내,
모바일 폭과 공개 앱 복귀 주소를 확인한다. 위 fragment 형식과 `ConfirmationURL` 금지는
기존 passwordless 템플릿에만 적용한다. 비밀번호 가입/복구의 통합 출시 절차는
`../../docs/delivery/AUTH_PASSWORD_COMBINED_RELEASE_20261114.md`를 따른다.
템플릿 파일이 존재한다는 사실은 운영 발송 증거가 아니다.
