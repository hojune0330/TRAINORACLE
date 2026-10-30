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
    schemaVersion: 2,
    service: "TrainOracle device integration",
    stage: "CONNECTIONS_NOT_ENABLED",
    endpointAvailable: true,
    publicUserLinking: false,
    providers: {
      garmin: "CONNECTION_NOT_ENABLED",
      coros: "CONNECTION_NOT_ENABLED",
    },
    // Public release metadata cannot attest personal OAuth, application approval,
    // received records, or permission to use a provider's data for AI coaching.
    providerDetails: Object.fromEntries(["GARMIN", "COROS"].map(provider => [provider, {
      apiAvailability: "NOT_ENABLED",
      accountConnection: "NOT_DISCLOSED",
      applicationStatus: "NOT_REPORTED",
      requiresUserAuthorization: true,
    }])),
    dataIngestion: "FAIL_CLOSED",
    updatedAt: "2026-10-30",
  })
  return new Response(request.method === "HEAD" ? null : body, { status: 200, headers })
})
