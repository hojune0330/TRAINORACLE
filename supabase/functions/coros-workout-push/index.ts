import {
  MAX_COROS_BODY_BYTES,
  normalizeCorosPush,
  secureSecretMatch,
  withPayloadDigests,
} from "../_shared/coros.mjs"

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
}

function response(status: number, result: string, message: string) {
  return new Response(JSON.stringify({ message, result }), { status, headers: jsonHeaders })
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return response(405, "4005", "method not allowed")

  const expectedClient = Deno.env.get("COROS_PUSH_CLIENT")
  const expectedSecret = Deno.env.get("COROS_PUSH_SECRET")
  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!expectedClient || !expectedSecret || !supabaseUrl || !serviceRoleKey) {
    return response(503, "5001", "integration not configured")
  }

  const [clientMatches, secretMatches] = await Promise.all([
    secureSecretMatch(request.headers.get("client"), expectedClient),
    secureSecretMatch(request.headers.get("secret"), expectedSecret),
  ])
  if (!clientMatches || !secretMatches) return response(401, "4001", "unauthorized")

  const declaredLength = Number(request.headers.get("content-length") ?? "0")
  if (Number.isFinite(declaredLength) && declaredLength > MAX_COROS_BODY_BYTES) {
    return response(413, "4003", "payload too large")
  }
  if (!(request.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) {
    return response(415, "4004", "json required")
  }

  const bodyText = await request.text()
  if (new TextEncoder().encode(bodyText).byteLength > MAX_COROS_BODY_BYTES) {
    return response(413, "4003", "payload too large")
  }

  let normalized
  try {
    normalized = await withPayloadDigests(normalizeCorosPush(JSON.parse(bodyText)))
  } catch {
    return response(400, "4002", "invalid activity payload")
  }

  const databaseResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/ingest_coros_activity_batch`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ p_items: normalized }),
  })
  if (!databaseResponse.ok) return response(503, "5002", "ingestion unavailable")

  const result = await databaseResponse.json()
  if (typeof result?.rejected !== "number" || result.rejected > 0) {
    return response(422, "4006", "unlinked or rejected activity")
  }
  return response(200, "0000", "ok")
})
