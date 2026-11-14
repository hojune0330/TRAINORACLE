import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createClient } from "@supabase/supabase-js"
import { createAccountSettingsClient } from "./account-settings-client"

vi.mock("./config", () => ({ accountConfig: () => ({ passwordAuthEnabled: true,
  url: "https://synthetic.supabase.co", anonKey: "synthetic-public" }) }))
const origin = "https://synthetic.supabase.co"
const A = "a1111111-1111-4111-8111-111111111111", B = "b2222222-2222-4222-8222-222222222222"
const encoded = (value: unknown) => btoa(JSON.stringify(value)).replace(/\+/gu, "-").replace(/\//gu, "_").replace(/=+$/u, "")
const token = (sub: string, exp = Math.floor(Date.now() / 1000) + 3600) =>
  `${encoded({ alg: "HS256", typ: "JWT" })}.${encoded({ sub, exp, session_id: "c3333333-3333-4333-8333-333333333333" })}.c3ludGhldGlj`
const credentials = (sub: string) => ({ access_token: token(sub), refresh_token: `synthetic-refresh-${sub}` })
beforeEach(() => { localStorage.clear(); sessionStorage.clear() })
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe("isolated settings client actual SDK", () => {
  it.each(["update", "reauthenticate"] as const)("pins %s to A while the shared browser client changes to B", async operation => {
    const captured = credentials(A), replacement = credentials(B)
    const writes = vi.spyOn(Storage.prototype, "setItem")
    const broadcast = vi.fn()
    vi.stubGlobal("BroadcastChannel", class { constructor() { broadcast() } close() {} postMessage() { broadcast() } })
    let release!: () => void, reached!: () => void
    const pending = new Promise<void>(resolve => { release = resolve }), started = new Promise<void>(resolve => { reached = resolve })
    const outgoing: { path: string; method: string; authorization: string | null }[] = []
    const transport = vi.fn<typeof fetch>(async (input, init) => {
      const request = new Request(input, init), url = new URL(request.url)
      const authorization = request.headers.get("Authorization")
      outgoing.push({ path: url.pathname, method: request.method, authorization })
      const settingsOperation = request.method === "PUT" || url.pathname.endsWith("/reauthenticate")
      if (settingsOperation) { reached(); await pending }
      if (url.pathname.endsWith("/reauthenticate")) return new Response("{}", { status: 200 })
      const id = authorization === `Bearer ${replacement.access_token}` ? B : A
      return new Response(JSON.stringify({ id, aud: "authenticated", role: "authenticated", email: "synthetic@example.invalid", created_at: "2026-11-14T00:00:00Z", user_metadata: {}, app_metadata: {} }), { status: 200 })
    })
    vi.stubGlobal("fetch", transport)
    const shared = createClient(origin, "synthetic-public", { global: { fetch: transport }, auth: {
      persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: `synthetic-shared-memory-${operation}` } })
    let isolated: Awaited<ReturnType<typeof createAccountSettingsClient>> = null
    try {
      await shared.auth.setSession(captured)
      isolated = await createAccountSettingsClient(captured)
      expect(isolated).not.toBeNull()
      const sending = operation === "update" ? isolated!.auth.updateUser({ password: "synthetic-new-password" }) : isolated!.auth.reauthenticate()
      await started
      await shared.auth.setSession(replacement)
      expect((await shared.auth.getSession()).data.session?.user.id).toBe(B)
      release()
      expect((await sending).error).toBeNull()
      const operationRequest = outgoing.filter(request => request.method === "PUT" || request.path.endsWith("/reauthenticate"))
      expect(operationRequest).toEqual([{ path: operation === "update" ? "/auth/v1/user" : "/auth/v1/reauthenticate", method: operation === "update" ? "PUT" : "GET", authorization: `Bearer ${captured.access_token}` }])
      expect((await shared.auth.getSession()).data.session?.user.id).toBe(B)
      expect(writes).not.toHaveBeenCalled()
      expect(broadcast).not.toHaveBeenCalled()
      expect(outgoing.some(request => /token|logout/u.test(request.path))).toBe(false)
      const dispose = vi.spyOn(isolated!.auth, "dispose")
      await isolated!.auth.dispose()
      expect(dispose).toHaveBeenCalledOnce()
      isolated = null
    } finally { release?.(); await isolated?.auth.dispose(); await shared.auth.dispose() }
  })

  it("rejects an expired captured credential without refreshing or signing out on the server", async () => {
    const transport = vi.fn<typeof fetch>()
    vi.stubGlobal("fetch", transport)
    const dispose = vi.spyOn((await import("@supabase/auth-js")).GoTrueClient.prototype, "dispose")
    expect(await createAccountSettingsClient({ access_token: token(A, 1), refresh_token: "synthetic-expired-refresh" })).toBeNull()
    expect(transport).not.toHaveBeenCalled()
    expect(dispose).toHaveBeenCalledOnce()
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
  })
  it("does not send refresh or logout when an already seeded credential expires", async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ id: A, aud: "authenticated", created_at: "2026-11-14T00:00:00Z" })))
    vi.stubGlobal("fetch", transport)
    const isolated = await createAccountSettingsClient(credentials(A))
    expect(isolated).not.toBeNull()
    try {
      transport.mockClear()
      vi.spyOn(Date, "now").mockReturnValue(Date.now() + 4 * 3600 * 1000)
      expect((await isolated!.auth.updateUser({ password: "synthetic-new-password" })).error).not.toBeNull()
      expect(transport).not.toHaveBeenCalled()
    } finally { await isolated?.auth.dispose() }
  })
})
