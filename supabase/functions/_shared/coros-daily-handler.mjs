import { normalizeCorosDaily, readBoundedDailyJson } from "./coros-daily.mjs"

const reply = (status, result, message) => new Response(JSON.stringify({ result, message }), {
  status, headers: { "content-type": "application/json", "cache-control": "no-store" },
})

// Provider signature verification and transactional account-bound persistence
// must be supplied by the production adapter. Their absence never accepts data.
export function createCorosDailyHandler({ verifyRequest, ingestAuthorizedBatch } = {}) {
  return async request => {
    if (request.method !== "POST") return reply(405, "4005", "method not allowed")
    if (!verifyRequest || !ingestAuthorizedBatch) return reply(503, "5001", "integration not configured")
    const url = new URL(request.url)
    for (const name of ["signature", "nonce", "timestamp"]) {
      const values = url.searchParams.getAll(name)
      if (values.length !== 1 || values[0].length === 0 || values[0].length > 512) return reply(401, "4001", "unauthorized")
    }
    if ((request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase() !== "application/json") {
      return reply(415, "4004", "json required")
    }
    try {
      // A verifier must check client/secret, signature and replay policy. It must
      // not consume the body; body signing requirements remain provider-pending.
      if (await verifyRequest(request) !== true) return reply(401, "4001", "unauthorized")
    } catch { return reply(503, "5002", "verification unavailable") }
    let rows
    try { rows = normalizeCorosDaily(await readBoundedDailyJson(request)) }
    catch (error) {
      return error?.message === "DAILY_BODY_TOO_LARGE"
        ? reply(413, "4003", "payload too large")
        : reply(400, "4002", "invalid daily payload")
    }
    try {
      // Must resolve ownership/consent from the database, never from payload user IDs.
      // Resolve all rows atomically, including replay and revocation checks.
      const result = await ingestAuthorizedBatch(rows)
      if (result?.committed !== true || result?.processed !== rows.length) return reply(503, "5002", "ingestion unavailable")
    } catch { return reply(503, "5002", "ingestion unavailable") }
    return reply(200, "0000", "ok")
  }
}
