import type { SupabaseClient } from "@supabase/supabase-js"
import { accountConfig } from "./config"

/** An operation's verified credential never follows the shared browser session.
 * No persistence, broadcasting or refresh-token rotation; dispose after use. */
export async function createAccountSettingsClient(credentials: { access_token: string; refresh_token: string }): Promise<SupabaseClient | null> {
  const config = accountConfig()
  if (!config?.passwordAuthEnabled) return null
  const { createClient } = await import("@supabase/supabase-js")
  const service = new URL(config.url)
  const transport = fetch
  const pinnedFetch: typeof fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input))
    const headers = new Headers(input instanceof Request ? input.headers : undefined)
    new Headers(init?.headers).forEach((value, key) => headers.set(key, value))
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase()
    const exactCredential = headers.get("Authorization") === `Bearer ${credentials.access_token}`
    const allowed = url.origin === service.origin && !url.search && !url.hash && !url.username && !url.password && (
      url.pathname === "/auth/v1/user" && (method === "GET" || method === "PUT") && exactCredential
      || url.pathname === "/auth/v1/reauthenticate" && method === "GET" && exactCredential
    )
    if (!allowed) return Promise.resolve(new Response(JSON.stringify({ code: "session_not_found", msg: "Account settings session is no longer usable" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    }))
    return transport(input, init)
  }
  const client = createClient(config.url, config.anonKey, { global: { fetch: pinnedFetch }, auth: {
    persistSession: false, autoRefreshToken: false, detectSessionInUrl: false,
    storageKey: `trainoracle.account.settings.memory.${crypto.randomUUID()}`,
  } })
  try {
    const seeded = await client.auth.setSession(credentials)
    if (!seeded.error && seeded.data.session?.access_token === credentials.access_token) return client
  } catch { /* A stale token never rotates credentials in this isolated client. */ }
  await client.auth.dispose()
  return null
}
