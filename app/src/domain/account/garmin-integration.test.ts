import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { captureGarminCallback, clearGarminOperation, consumeGarminCallback, garminEndpoint, garminIntegrationEnabled, garminRequestSchema, hasGarminCallback, parseGarminResponse, pendingGarminOperation, prepareGarminOperation, rememberGarminAttempt, requestGarminIntegration, safeGarminAuthorizationUrl, GARMIN_VERSION } from "./garmin-integration"
import { setActiveLocalAccount } from "./local-journal-ownership"
import { rememberStorageConsentRevision } from "./storage-consent-revision"
import { ACCOUNT_NETWORK_DEADLINE_MS } from "./account-network-deadline"
import { closeAccountDeletionBoundary } from "./account-deletion-boundary"
import { syntheticGarminItem as item, syntheticGarminOwner as owner, syntheticGarminReceipt, syntheticGarminStatus as status } from "../../components/GarminConnectionPanel.test-fixtures"

const auth = vi.hoisted(() => ({ getSession: vi.fn(), getUser: vi.fn(), onAuthStateChange: vi.fn() }))
vi.mock("./supabase-client", () => ({ supabase: async () => ({ auth }) }))
beforeEach(() => {
  vi.clearAllMocks(); sessionStorage.clear(); setActiveLocalAccount(owner); rememberStorageConsentRevision(owner, 2)
  vi.stubEnv("VITE_FEATURE_GARMIN_INTEGRATION", "true"); vi.stubEnv("VITE_FEATURE_ACCOUNT_JOURNAL", "true")
  vi.stubEnv("VITE_GARMIN_INTEGRATION_URL", "https://company.example/api/garmin-integration")
  vi.stubEnv("VITE_GARMIN_AUTHORIZATION_ORIGIN", "https://connect.garmin.com")
  auth.getSession.mockResolvedValue({ data: { session: { user: { id: owner }, access_token: "synthetic-proof" } }, error: null })
  auth.getUser.mockResolvedValue({ data: { user: { id: owner } }, error: null })
  auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); setActiveLocalAccount(null); window.history.replaceState(null, "", "/"); consumeGarminCallback(owner); sessionStorage.clear() })
describe("Garmin authenticated browser boundary", () => {
  it("defaults off, pins the exact service and explicit authorization origin", () => {
    expect(garminIntegrationEnabled({})).toBe(false)
    for (const value of ["http://company.example/api/garmin-integration", "https://a:b@company.example/api/garmin-integration", "https://company.example/api/garmin-integration?q=x", "https://company.example/other"]) expect(garminEndpoint({ VITE_GARMIN_INTEGRATION_URL: value })).toBeNull()
    const state = "a".repeat(43), url = `https://connect.garmin.com/authorization?state=${state}&response_type=code&code_challenge_method=S256`
    expect(safeGarminAuthorizationUrl(url, state)).toBe(url)
    expect(safeGarminAuthorizationUrl(url.replace("connect.garmin.com", "evil.garmin.com"), state)).toBeNull()
    expect(safeGarminAuthorizationUrl(url, "b".repeat(43))).toBeNull()
    expect(safeGarminAuthorizationUrl(url, state, {})).toBeNull()
  })
  it("accepts only identifier requests and rejects malformed source or mismatched read receipts", () => {
    expect(garminRequestSchema.safeParse({ action: "confirm", inboxId: item.inboxId, expectedRevision: 1, operationId: crypto.randomUUID(), distanceMeters: 5000 }).success).toBe(false)
    expect(parseGarminResponse({ action: "inbox" }, { schemaVersion: GARMIN_VERSION, items: [{ ...item, observation: { ...item.observation, analysisEligible: true } }], nextCursor: null }).ok).toBe(false)
    expect(parseGarminResponse({ action: "read", documentId: syntheticGarminReceipt.documentId }, { schemaVersion: GARMIN_VERSION, item }).ok).toBe(false)
    expect(parseGarminResponse({ action: "inbox" }, { schemaVersion: GARMIN_VERSION, items: [item], nextCursor: null }).ok).toBe(true)
  })
  it("sends verified account identity and the pinned storage revision with identifier-only payload", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(status))); vi.stubGlobal("fetch", fetcher)
    expect((await requestGarminIntegration(owner, { action: "status" }, new AbortController().signal, () => true)).ok).toBe(true)
    const init = fetcher.mock.calls[0]![1] as RequestInit
    expect(init).toMatchObject({ method: "POST", credentials: "omit", cache: "no-store", redirect: "error", body: '{"action":"status"}' })
    expect(init.headers).toMatchObject({ Authorization: "Bearer synthetic-proof", "x-trainoracle-storage-revision": "2" })
    expect(auth.getUser).toHaveBeenCalledWith("synthetic-proof")
  })
  it("keeps verified disconnect reachable with feature off and no local journal scope", async () => {
    setActiveLocalAccount(null); vi.stubEnv("VITE_FEATURE_GARMIN_INTEGRATION", "false")
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ schemaVersion: GARMIN_VERSION, connection: { state: "DISCONNECTED", epoch: null, lastSyncAt: null }, remoteRevocationPending: true }))); vi.stubGlobal("fetch", fetcher)
    expect((await requestGarminIntegration(owner, { action: "disconnect" }, new AbortController().signal, () => true)).ok).toBe(true)
    expect((await requestGarminIntegration(owner, { action: "connect" }, new AbortController().signal, () => true)).ok).toBe(false)
    expect(fetcher).toHaveBeenCalledOnce()
  })
  it("does not transmit with another owner, unverified identity, or a disabled account-storage gate", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher)
    setActiveLocalAccount("another-owner")
    expect((await requestGarminIntegration(owner, { action: "status" }, new AbortController().signal, () => true)).ok).toBe(false)
    setActiveLocalAccount(owner); auth.getUser.mockResolvedValue({ data: { user: null }, error: new Error("synthetic") })
    expect((await requestGarminIntegration(owner, { action: "status" }, new AbortController().signal, () => true)).ok).toBe(false)
    vi.stubEnv("VITE_FEATURE_ACCOUNT_JOURNAL", "false")
    expect((await requestGarminIntegration(owner, { action: "inbox" }, new AbortController().signal, () => true)).ok).toBe(false)
    expect(fetcher).not.toHaveBeenCalled()
  })
  it("discards a late response across A→B→A and after auth-session replacement", async () => {
    let resolve!: (value: Response) => void
    const fetcher = vi.fn(() => new Promise<Response>(done => { resolve = done })); vi.stubGlobal("fetch", fetcher)
    const operation = requestGarminIntegration(owner, { action: "status" }, new AbortController().signal, () => true)
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce())
    setActiveLocalAccount("another-owner"); setActiveLocalAccount(owner); resolve(new Response(JSON.stringify(status)))
    expect(await operation).toEqual({ ok: false, code: "STALE_RESPONSE" })
    fetcher.mockClear()
    const second = requestGarminIntegration(owner, { action: "status" }, new AbortController().signal, () => true)
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce())
    auth.onAuthStateChange.mock.calls.at(-1)![0]("SIGNED_OUT", null); resolve(new Response(JSON.stringify(status)))
    expect(await second).toEqual({ ok: false, code: "STALE_RESPONSE" })
  })
  it("scrubs callback codes before account callback handling, binds state/owner/expiry and consumes once", () => {
    const state = "a".repeat(43), response = { schemaVersion: GARMIN_VERSION, authorizationUrl: `https://connect.garmin.com/oauth?state=${state}&response_type=code&code_challenge_method=S256`, state, expiresAt: new Date(Date.now() + 600000).toISOString() }
    expect(rememberGarminAttempt(owner, response)).toBe(true)
    window.history.replaceState(null, "", `/?garmin_callback=1&code=synthetic-code&state=${state}&kept=1`)
    expect(hasGarminCallback()).toBe(true); captureGarminCallback()
    expect(window.location.search).toBe("?kept=1"); expect(sessionStorage.getItem("trainoracle.garmin.oauth.v1")).not.toContain("synthetic-code")
    expect(consumeGarminCallback(owner)).toEqual({ action: "complete", code: "synthetic-code", state })
    expect(consumeGarminCallback(owner)).toBeNull()
    expect(rememberGarminAttempt(owner, response)).toBe(true)
    window.history.replaceState(null, "", `/?garmin_callback=1&code=synthetic-code&state=${state}`)
    expect(consumeGarminCallback("another-owner")).toBe("invalid")
  })
  it("reuses exact lost-ACK IDs across remount and will not borrow a revised source or later consent", () => {
    const first = prepareGarminOperation(owner, item, "confirm")!
    expect(pendingGarminOperation(owner, item.inboxId)).toEqual(first)
    expect(prepareGarminOperation(owner, item, "confirm")).toEqual(first)
    expect(prepareGarminOperation(owner, { ...item, revision: 2 }, "confirm")).toBeNull()
    expect(prepareGarminOperation(owner, item, "dismiss")).toBeNull()
    rememberStorageConsentRevision(owner, 3)
    expect(prepareGarminOperation(owner, item, "confirm")).toBeNull()
    expect(sessionStorage.getItem(`trainoracle.garmin.pending.v1:${owner}:${item.inboxId}`)).not.toContain("distanceMeters")
    clearGarminOperation(owner, item.inboxId); expect(pendingGarminOperation(owner, item.inboxId)).toBeNull()
  })
  it("ends a hung Auth verification at the same request deadline without sending or remaining busy", async () => {
    vi.useFakeTimers()
    auth.getUser.mockReturnValue(new Promise(() => {}))
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher)
    const operation = requestGarminIntegration(owner, { action: "status" }, new AbortController().signal, () => true)
    await vi.advanceTimersByTimeAsync(ACCOUNT_NETWORK_DEADLINE_MS + 1)
    expect(await operation).toEqual({ ok: false, code: "UNAVAILABLE" }); expect(fetcher).not.toHaveBeenCalled()
  })
  it("surfaces actionable provider permission and revocation errors, including final source metadata", async () => {
    const source = { manual: true, parent: { isParent: true, parentSummaryId: null }, summaryId: "synthetic-summary", lapStartOffsetsSeconds: [0, 10] }
    expect(parseGarminResponse({ action: "inbox" }, { schemaVersion: GARMIN_VERSION, items: [{ ...item, source }], nextCursor: null }).ok).toBe(true)
    for (const code of ["REVOKE_PENDING", "PROVIDER_PERMISSION_REQUIRED", "PROVIDER_ACCOUNT_ALREADY_BOUND", "BUSY", "DETAIL_UNAVAILABLE"]) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: code }), { status: 409 })))
      expect(await requestGarminIntegration(owner, { action: "status" }, new AbortController().signal, () => true)).toEqual({ ok: false, code })
    }
  })
  it("interrupts a hung identity lookup immediately when that account is deleted", async () => {
    const deletedOwner = "abcde000-0000-4000-8000-000000000099"
    setActiveLocalAccount(deletedOwner)
    auth.getSession.mockReturnValue(new Promise(() => {}))
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher)
    const operation = requestGarminIntegration(deletedOwner, { action: "status" }, new AbortController().signal, () => true)
    await vi.waitFor(() => expect(auth.getSession).toHaveBeenCalledOnce())
    closeAccountDeletionBoundary(deletedOwner, "2026-11-04T00:00:00Z")
    expect(await operation).toEqual({ ok: false, code: "STALE_RESPONSE" }); expect(fetcher).not.toHaveBeenCalled()
  })
})
