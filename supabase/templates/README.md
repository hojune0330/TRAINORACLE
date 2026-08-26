# TrainOracle Auth Templates

이 폴더의 템플릿은 비밀값을 포함하지 않는 검토 가능한 원본이다.

- `magic-link.html`: 이메일 링크 대신 `{{ .Token }}` 6자리 코드를 보여준다.
- 로컬 Supabase는 `config.toml`에서 이 파일을 사용한다.
- Hosted Supabase는 custom SMTP가 연결된 뒤 Dashboard의 `Magic link or OTP`
  템플릿에 같은 본문을 적용하고 실제 수신 메일로 검증한다.
- 발신 도메인, SMTP 비밀번호, OAuth client secret, SMS provider key는 이 폴더와
  Git에 절대 저장하지 않는다.

운영 적용 전에는 제목, 코드 6자리, 10분 만료 문구, 링크 미포함, 모바일 폭을
확인한다. 템플릿 파일이 존재한다는 사실은 운영 발송 증거가 아니다.
