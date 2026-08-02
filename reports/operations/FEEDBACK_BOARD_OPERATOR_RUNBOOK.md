# 문의 게시판 운영자 답변 절차

사용자는 앱 안에서 문의를 쓰고 답변을 확인한다. GitHub 이슈로 보내지 않는다.
운영자 답변은 공개 브라우저에 서비스 역할 키를 넣지 않고, 운영자 PC에서만
Supabase RPC로 처리한다.

## 준비

아래 두 값은 운영자 PC의 환경변수에만 둔다. 화면 캡처, Git, 문서, 채팅에
붙이지 않는다.

- `TRAINORACLE_SUPABASE_URL`
- `TRAINORACLE_SUPABASE_SERVICE_ROLE_KEY`

## 새 문의 확인

PowerShell에서 최근 문의를 최대 50건 가져온다.

```powershell
$headers = @{
  apikey = $env:TRAINORACLE_SUPABASE_SERVICE_ROLE_KEY
  Authorization = "Bearer $env:TRAINORACLE_SUPABASE_SERVICE_ROLE_KEY"
}
$threads = Invoke-RestMethod -Method Post `
  -Uri "$env:TRAINORACLE_SUPABASE_URL/rest/v1/rpc/list_feedback_threads_for_operator" `
  -Headers $headers -ContentType "application/json" -Body '{"limit_input":50}'
$threads | ConvertTo-Json -Depth 8
```

결과에는 문의 ID, 종류, 제목, 상태, 작성 시각, 댓글만 있다. 사용자의 기기
영수증 원문과 일지·통증·기분·메모는 포함하지 않는다.

## 답변 또는 종료

`<문의-ID>`와 답변을 바꿔 실행한다. `resolve_input`이 `false`면 답변 후에도
댓글을 받을 수 있고, `true`면 종료된다.

```powershell
$body = @{
  thread_id_input = "<문의-ID>"
  operator_comment_id_input = [guid]::NewGuid().ToString()
  body_input = "확인했습니다. 수정 결과를 이 댓글로 알려드릴게요."
  resolve_input = $false
} | ConvertTo-Json
Invoke-RestMethod -Method Post `
  -Uri "$env:TRAINORACLE_SUPABASE_URL/rest/v1/rpc/reply_to_feedback_thread" `
  -Headers $headers -ContentType "application/json" -Body $body
```

운영자 답변 뒤 보관 기한은 다시 180일로 연장된다. 한 문의는 사용자 글과 운영자
답변을 합쳐 최대 50개 댓글만 허용한다.

## 삭제와 중단

스팸·시험 문의를 운영상 삭제할 때만
`delete_feedback_thread_for_operations`를 사용한다. 사용자가 자기 문의를 지우는
경로는 앱 안의 두 단계 삭제다.

개인정보 노출이나 반복 오류가 생기면 먼저 서버 `FEEDBACK_BOARD`를 OFF로 바꾸고
배포 kill 스위치를 켠다. 문의판만 닫히며 로컬 일지는 계속 쓸 수 있다. 조치와
재개 이유는 `BETA_FEATURE_INCIDENT_LOG.md`에 남긴다.
