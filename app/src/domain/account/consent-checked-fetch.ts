// Prevent a body containing health/journal data from leaving the browser before
// a fresh server consent check. The database remains the authorization boundary.
import { isStorageTransmissionHeld } from "./storage-transmission-hold"
const META_ROUTES = new Set([
  "rpc/claim_beta_seat", "rpc/get_current_account_admission_status", "rpc/request_account_deletion",
  "rpc/get_account_storage_consent", "rpc/set_account_storage_consent",
  "rpc/read_account_data_rights_page", "rpc/account_data_rights_identity",
])
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu
function tokenSubject(authorization: string | null): string | null {
  try {
    const part = authorization?.replace(/^Bearer /u, "").split(".")[1]
    if (!part) return null
    const claims: unknown = JSON.parse(atob(part.replace(/-/gu, "+").replace(/_/gu, "/")))
    const sub = (claims as { sub?: unknown })?.sub
    return typeof sub === "string" && uuid.test(sub) ? sub : null
  } catch { return null }
}

export function createConsentCheckedFetch(serviceUrl: string, transport: typeof fetch = fetch): typeof fetch {
  const service = new URL(serviceUrl)
  return async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input))
    const path = url.pathname.replace(/^\/rest\/v1\//u, "")
    const protectedRequest = url.origin === service.origin && (
      url.pathname.startsWith("/rest/v1/") && !META_ROUTES.has(path)
      || ["/functions/v1/account-journal", "/functions/v1/account-plan-collection"].includes(url.pathname)
    )
    if (!protectedRequest) return transport(input, init)
    const headers = new Headers(input instanceof Request ? input.headers : undefined)
    new Headers(init?.headers).forEach((value, key) => headers.set(key, value))
    const subject = tokenSubject(headers.get("Authorization"))
    const denied = () => new Response(JSON.stringify({ error: "STORAGE_CONSENT_REQUIRED" }), {
      status: 403, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    })
    if (!subject || isStorageTransmissionHeld(subject) || init?.signal?.aborted) return denied()
    try {
      const checkHeaders = new Headers({ "Content-Type": "application/json" })
      for (const name of ["Authorization", "apikey"]) {
        const value = headers.get(name)
        if (value) checkHeaders.set(name, value)
      }
      const response = await transport(new URL("/rest/v1/rpc/get_account_storage_consent", service).href, {
        method: "POST", headers: checkHeaders,
        body: JSON.stringify({ expected_user_id_input: subject }),
        signal: init?.signal, cache: "no-store",
      })
      const value: unknown = response.ok ? await response.json() : null
      const consent = value as { userId?: unknown; purposeVersion?: unknown; healthStorage?: unknown; journalTextStorage?: unknown; operationsReady?: unknown } | null
      if (consent?.userId !== subject || consent.purposeVersion !== "2026-10-05"
        || consent.healthStorage !== true || consent.journalTextStorage !== true || consent.operationsReady !== true
        || isStorageTransmissionHeld(subject) || init?.signal?.aborted) return denied()
      // Pin the exact Authorization used for the consent check.
      return transport(input, { ...init, headers })
    } catch { return denied() }
  }
}
