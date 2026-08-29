const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>COROS 연동 준비 중 | TrainOracle</title></head>
<body><main><h1>COROS 연동은 아직 준비 중입니다.</h1>
<p>공식 승인과 보안 검증이 끝난 뒤 TrainOracle 계정 화면에서 연결할 수 있습니다.</p>
<p><a href="https://hojune0330.github.io/TRAINORACLE/support.html">TrainOracle 도움말 보기</a></p>
</main></body></html>`

Deno.serve((request) => {
  if (request.method !== "GET") {
    return new Response("METHOD_NOT_ALLOWED", {
      status: 405,
      headers: { allow: "GET", "cache-control": "no-store" },
    })
  }

  const url = new URL(request.url)
  const authorizationAttempt = url.searchParams.has("code") || url.searchParams.has("state")
  return new Response(html, {
    status: authorizationAttempt ? 409 : 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
    },
  })
})
