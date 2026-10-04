# TrainOracle Auth Templates

이 폴더의 템플릿은 비밀값을 포함하지 않는 검토 가능한 원본이다.

- `confirm-signup.html`: 신규 가입 때 앱의 `{{ .RedirectTo }}`로 일회용
  `{{ .TokenHash }}`를 보내며, 앱은 이를 `verifyOtp({ type: "email" })`로 확인한다.
- `magic-link.html`: 기존 사용자의 재로그인도 같은 PKCE token-hash 콜백을 사용한다.
- 로컬 Supabase는 `config.toml`에서 이 파일을 사용한다.
- Hosted Supabase는 custom SMTP를 연결한 뒤 Dashboard의 `Confirm signup`과
  `Magic link or OTP` 템플릿에 같은 본문을 적용한다. 기본 발송기 상태에서는 운영
  템플릿 편집이 비활성화된다.
- 발신 도메인, SMTP 비밀번호, OAuth client secret, SMS provider key는 이 폴더와
  Git에 절대 저장하지 않는다.

이메일 버튼은 Hosted Supabase의 두 템플릿이 이 원본과 일치하고 공개 복귀 주소가
허용 목록에 있다는 운영 확인 뒤에만 `VITE_EMAIL_AUTH_PKCE_OPERATIONS_APPROVED=true`로
연다. 저장소 템플릿 변경만으로 운영 적용을 주장하지 않는다.

운영 적용 전에는 제목, `RedirectTo + TokenHash` fragment 형식, 한 번 사용 안내,
모바일 폭과 공개 앱 복귀 주소를 확인한다. `ConfirmationURL`은 사용하지 않는다.
템플릿 파일이 존재한다는 사실은 운영 발송 증거가 아니다.
