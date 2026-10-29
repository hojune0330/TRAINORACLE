const headers = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

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
    applicationEvidence: {
      garmin: { submittedAt: "2026-10-29", program: "BUSINESS_STARTER", receiptConfirmed: true, approvalConfirmed: false },
      coros: { submittedAt: "2026-08-29", program: "PARTNER_API", approvalConfirmed: false, alternative: "MCP_REQUIRES_USER_OAUTH" },
    },
    additionalProviders: { whoop: "AUTHENTICATION_REQUIRED", appleHealth: "NATIVE_DEVICE_VERIFICATION_REQUIRED", healthConnect: "NATIVE_DEVICE_VERIFICATION_REQUIRED" },
    dataIngestion: "FAIL_CLOSED",
    updatedAt: "2026-10-29",
  });
  return new Response(request.method === "HEAD" ? null : body, { status: 200, headers });
})
