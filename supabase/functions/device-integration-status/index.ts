const headers = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
}

Deno.serve((request) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(JSON.stringify({ error: "METHOD_NOT_ALLOWED" }), {
      status: 405,
      headers: { ...headers, allow: "GET, HEAD" },
    })
  }

  const body = JSON.stringify({
    service: "TrainOracle device integration",
    stage: "APPLICATION_PENDING",
    operational: true,
    publicUserLinking: false,
    providers: {
      garmin: "APPLICATION_PENDING",
      coros: "APPLICATION_PENDING",
    },
    dataIngestion: "FAIL_CLOSED",
    updatedAt: "2026-08-29",
  })
  return new Response(request.method === "HEAD" ? null : body, { status: 200, headers })
})
