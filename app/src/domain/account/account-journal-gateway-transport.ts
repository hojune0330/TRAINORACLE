import { createConsentCheckedFetch } from "./consent-checked-fetch"
import { FILE_MUTATION_MAX_BYTES } from "./account-file-document-codec"

/** Build-time company endpoint only. A malformed configured route must not fall back. */
export function accountJournalGatewayUrl(env: Readonly<Record<string, unknown>> = import.meta.env): string | null {
  const raw = env.VITE_ACCOUNT_JOURNAL_GATEWAY_URL
  if (raw === undefined || raw === "") return null
  if (typeof raw !== "string" || raw.trim() !== raw) throw new Error("INVALID_ACCOUNT_GATEWAY")
  const url = new URL(raw)
  if (url.protocol !== "https:" || url.pathname !== "/api/account-journal" || url.username || url.password
    || url.search || url.hash || url.href !== raw) throw new Error("INVALID_ACCOUNT_GATEWAY")
  return url.href
}

export function accountJournalTransportIdentity(): string {
  try { return accountJournalGatewayUrl() ?? "SUPABASE" } catch { return "INVALID" }
}

function tokenOwner(token: string): string | null {
  try {
    const claims = JSON.parse(atob(token.split(".")[1]!.replace(/-/gu, "+").replace(/_/gu, "/"))) as { sub?: unknown }
    return typeof claims.sub === "string" ? claims.sub : null
  } catch { return null }
}

export async function invokeAccountJournalGateway(options: {
  gatewayUrl: string; serviceUrl: string; anonKey: string; ownerId: string; token: string
  body: Record<string, unknown>; headers: Record<string, string>; signal: AbortSignal
  current: () => boolean; transport?: typeof fetch
}): Promise<{ data: unknown; error: { context: Response } | null }> {
  const { serviceUrl, anonKey, ownerId, token, signal, current } = options
  const gatewayUrl = accountJournalGatewayUrl({ VITE_ACCOUNT_JOURNAL_GATEWAY_URL: options.gatewayUrl })
  if (!gatewayUrl || !current() || signal.aborted || tokenOwner(token) !== ownerId) throw new Error("STALE_ACCOUNT_GATEWAY")
  const service = new URL(serviceUrl)
  if (service.protocol !== "https:" || service.username || service.password || service.search || service.hash)
    throw new Error("INVALID_ACCOUNT_SERVICE")
  const virtualUrl = new URL("/functions/v1/account-journal", service).href
  const consentUrl = new URL("/rest/v1/rpc/get_account_storage_consent", service).href
  const transport = options.transport ?? fetch
  // Consent checks run against the exact existing Supabase route. Only the
  // final checked request is mapped; an arbitrary-origin fetch is never treated
  // as if createConsentCheckedFetch had authorized it.
  const checked = createConsentCheckedFetch(serviceUrl, async (input, init) => {
    if (!current() || signal.aborted) throw new Error("STALE_ACCOUNT_GATEWAY")
    const url = input instanceof Request ? input.url : String(input)
    if (url !== virtualUrl && url !== consentUrl) throw new Error("INVALID_ACCOUNT_GATEWAY_ROUTE")
    const headers = new Headers(init?.headers)
    if (headers.get("Authorization") !== `Bearer ${token}`) throw new Error("STALE_ACCOUNT_GATEWAY")
    // A redirect could forward the selected user's bearer or journal body.
    // The consent RPC receives identity only; it never receives the document.
    return transport(url === virtualUrl ? gatewayUrl : consentUrl, {
      ...init, signal, redirect: "error", credentials: "omit", cache: "no-store",
    })
  })
  const response = await checked(virtualUrl, { method: "POST", signal,
    headers: { ...options.headers, Authorization: `Bearer ${token}`, apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify(options.body),
  })
  if (!current() || signal.aborted) throw new Error("STALE_ACCOUNT_GATEWAY")
  const reader = response.body?.getReader()
  if (!reader) throw new Error("INVALID_ACCOUNT_GATEWAY_RESPONSE")
  const chunks: Uint8Array[] = []; let length = 0
  try {
    while (true) {
      const part = await reader.read()
      if (!current() || signal.aborted) throw new Error("STALE_ACCOUNT_GATEWAY")
      if (part.done) break
      length += part.value.byteLength
      if (length > FILE_MUTATION_MAX_BYTES + 65_536) throw new Error("INVALID_ACCOUNT_GATEWAY_RESPONSE")
      chunks.push(part.value)
    }
  } catch (error) { await reader.cancel().catch(() => undefined); throw error }
  finally { reader.releaseLock() }
  const bytes = new Uint8Array(length); let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
  if (!response.ok) return { data: null, error: { context: new Response(text, { status: response.status, headers: { "Content-Type": "application/json" } }) } }
  return { data: JSON.parse(text) as unknown, error: null }
}
