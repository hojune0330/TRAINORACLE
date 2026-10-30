import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { coachingEndpoint, coachingRequestSchema, parseCoachingResponse, requestSelfHostedCoaching, selfHostedCoachingEnabled } from "./coaching-self-hosted"
import { exampleCoachingExplanation, exampleCoachingStatus, exampleRecordId } from "../components/SelfHostedCoachingPanel.test-fixtures"
import { setActiveLocalAccount } from "./account/local-journal-ownership"

const auth = vi.hoisted(() => ({ getSession: vi.fn(), getUser: vi.fn(), onAuthStateChange: vi.fn() }))
vi.mock("./account/supabase-client", () => ({ supabase: async () => ({ auth }) }))
beforeEach(() => {
  setActiveLocalAccount("owner-a")
  vi.stubEnv("VITE_FEATURE_SELF_HOSTED_COACHING", "true")
  vi.stubEnv("VITE_SELF_HOSTED_COACHING_URL", "https://coach.example.com/api/self-hosted-coaching")
  auth.getSession.mockResolvedValue({ data: { session: { user: { id: "owner-a" }, access_token: "synthetic-auth-proof" } }, error: null })
  auth.getUser.mockResolvedValue({ data: { user: { id: "owner-a" } }, error: null })
  auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
})
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); setActiveLocalAccount(null) })

describe("company coaching protocol and browser auth boundary", () => {
  it("defaults off and rejects query, credentials, paths, and insecure public endpoints", () => {
    expect(selfHostedCoachingEnabled({})).toBe(false)
    expect(selfHostedCoachingEnabled({ VITE_FEATURE_SELF_HOSTED_COACHING: "true", VITE_KILL_SELF_HOSTED_COACHING: "true" })).toBe(false)
    for (const url of ["https://user:password@coach.example.com/api/self-hosted-coaching", "https://coach.example.com/api/self-hosted-coaching?token=secret", "http://coach.example.com/api/self-hosted-coaching", "https://coach.example.com/other"]) {
      expect(coachingEndpoint({ VITE_SELF_HOSTED_COACHING_URL: url }, "https://app.example.com")).toBeNull()
    }
    expect(coachingEndpoint({}, "https://app.example.com")).toBeNull()
    expect(coachingEndpoint({ VITE_SELF_HOSTED_COACHING_URL: "/api/self-hosted-coaching" }, "https://app.example.com")).toBe("https://app.example.com/api/self-hosted-coaching")
  })
  it("rejects free text, browser-supplied grants, duplicate IDs, and unsupported model actions", () => {
    for (const candidate of [
      { action: "infer", documentIds: [exampleRecordId], consentRevision: 1, prompt: "run faster" },
      { action: "infer", documentIds: [exampleRecordId], consentRevision: 1, garminApproved: true },
      { action: "infer", documentIds: [exampleRecordId, exampleRecordId], consentRevision: 1 },
      { action: "train", documentIds: [exampleRecordId], consentRevision: 1 },
    ]) expect(coachingRequestSchema.safeParse(candidate).success).toBe(false)
  })
  it("binds purpose consent to each displayed record revision exactly once", () => {
    const consent = { action: "consent", purposeVersion: "2026-10-30", expectedConsentRevision: 0, documentIds: [exampleRecordId] }
    expect(coachingRequestSchema.safeParse(consent).success).toBe(false)
    expect(coachingRequestSchema.safeParse({ ...consent, documentRevisions: [] }).success).toBe(false)
    expect(coachingRequestSchema.safeParse({ ...consent, documentRevisions: [{ documentId: exampleRecordId, revision: 2 }, { documentId: exampleRecordId, revision: 2 }] }).success).toBe(false)
    expect(coachingRequestSchema.safeParse({ ...consent, documentRevisions: [{ documentId: exampleRecordId, revision: 2 }] }).success).toBe(true)
  })
  it("rejects source injection and plan or safety mutations from model responses", () => {
    const request = { action: "infer", documentIds: [exampleRecordId], consentRevision: 1 } as const
    const clonedRequest = { ...request, documentIds: [...request.documentIds] }
    for (const data of [
      { ...exampleCoachingExplanation, sourceDocumentIds: ["0ce21409-9dcc-47ad-b581-a0d68d0cb4e6"] },
      { ...exampleCoachingExplanation, planChanged: true },
      { ...exampleCoachingExplanation, safetyChanged: true },
      { ...exampleCoachingExplanation, actions: [{ id: "APPLY_PLAN", label: "apply" }] },
      { ...exampleCoachingExplanation, facts: [{ ...exampleCoachingExplanation.facts[0], sourceDocumentIds: ["0ce21409-9dcc-47ad-b581-a0d68d0cb4e6"] }] },
    ]) expect(parseCoachingResponse(clonedRequest, data)).toEqual({ ok: false, code: "INVALID_RESPONSE" })
    expect(parseCoachingResponse(clonedRequest, exampleCoachingExplanation).ok).toBe(true)
  })
  it("pins account authentication and sends only the constrained request with no cookies or caching", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(exampleCoachingStatus)))
    vi.stubGlobal("fetch", fetcher)
    const controller = new AbortController()
    expect((await requestSelfHostedCoaching("owner-a", { action: "status" }, controller.signal, () => true)).ok).toBe(true)
    expect(fetcher).toHaveBeenCalledOnce()
    const init = fetcher.mock.calls[0]![1] as RequestInit
    expect(init.credentials).toBe("omit"); expect(init.cache).toBe("no-store"); expect(init.redirect).toBe("error")
    expect(JSON.parse(init.body as string)).toEqual({ action: "status" })
    expect(init.headers).toMatchObject({ Authorization: "Bearer synthetic-auth-proof" })
  })
  it("does not transmit when session identity differs", async () => {
    auth.getSession.mockResolvedValue({ data: { session: { user: { id: "owner-b" }, access_token: "synthetic-b" } }, error: null })
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher)
    expect(await requestSelfHostedCoaching("owner-a", { action: "status" }, new AbortController().signal, () => true)).toEqual({ ok: false, code: "AUTH_REQUIRED" })
    expect(fetcher).not.toHaveBeenCalled()
  })
  it.each(["status", "withdraw"] as const)("permits verified %s management without a local storage scope after the feature is disabled", async action => {
    setActiveLocalAccount(null)
    vi.stubEnv("VITE_FEATURE_SELF_HOSTED_COACHING", "false")
    const data = action === "status" ? exampleCoachingStatus : { consent: { revision: 2, active: false, purposeVersion: "2026-10-30" } }
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(data)))
    vi.stubGlobal("fetch", fetcher)
    const request = action === "status" ? { action } : { action, expectedConsentRevision: 1 }
    expect((await requestSelfHostedCoaching("owner-a", request, new AbortController().signal, () => true)).ok).toBe(true)
    expect(auth.getUser).toHaveBeenCalledExactlyOnceWith("synthetic-auth-proof")
    expect(fetcher).toHaveBeenCalledOnce()
  })
  it("does not admit consent or inference without the exact local account scope", async () => {
    setActiveLocalAccount(null)
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher)
    const requests = [
      { action: "infer" as const, documentIds: [exampleRecordId], consentRevision: 1 },
      { action: "consent" as const, documentIds: [exampleRecordId], documentRevisions: [{ documentId: exampleRecordId, revision: 2 }], expectedConsentRevision: 0, purposeVersion: "2026-10-30" as const },
    ]
    for (const request of requests) expect(await requestSelfHostedCoaching("owner-a", request, new AbortController().signal, () => true)).toEqual({ ok: false, code: "STALE_RESPONSE" })
    expect(fetcher).not.toHaveBeenCalled(); expect(auth.getUser).not.toHaveBeenCalled()
  })
  it("never grants management while another local account is active", async () => {
    setActiveLocalAccount("owner-b")
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher)
    expect(await requestSelfHostedCoaching("owner-a", { action: "status" }, new AbortController().signal, () => true)).toEqual({ ok: false, code: "STALE_RESPONSE" })
    expect(await requestSelfHostedCoaching("owner-a", { action: "withdraw", expectedConsentRevision: 1 }, new AbortController().signal, () => true)).toEqual({ ok: false, code: "STALE_RESPONSE" })
    expect(fetcher).not.toHaveBeenCalled()
  })
  it("requires a remote user proof for scope-free management before sending", async () => {
    setActiveLocalAccount(null)
    auth.getUser.mockResolvedValue({ data: { user: { id: "owner-b" } }, error: null })
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher)
    expect(await requestSelfHostedCoaching("owner-a", { action: "withdraw", expectedConsentRevision: 1 }, new AbortController().signal, () => true)).toEqual({ ok: false, code: "AUTH_REQUIRED" })
    expect(fetcher).not.toHaveBeenCalled()
  })
  it("rejects scope changes during the remote management identity check", async () => {
    setActiveLocalAccount(null)
    let finish!: (value: unknown) => void
    auth.getUser.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher)
    const pending = requestSelfHostedCoaching("owner-a", { action: "withdraw", expectedConsentRevision: 1 }, new AbortController().signal, () => true)
    await vi.waitFor(() => expect(auth.getUser).toHaveBeenCalledOnce())
    setActiveLocalAccount("owner-b"); setActiveLocalAccount(null)
    finish({ data: { user: { id: "owner-a" } }, error: null })
    expect(await pending).toEqual({ ok: false, code: "STALE_RESPONSE" })
    expect(fetcher).not.toHaveBeenCalled()
  })
  it.each([{ error: "BUSY", status: 429 }, { error: "CANCELLED", status: 499 }] as const)("preserves $error as a recoverable service outcome", async ({ error, status }) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error }), { status })))
    expect(await requestSelfHostedCoaching("owner-a", { action: "infer", documentIds: [exampleRecordId], consentRevision: 1 }, new AbortController().signal, () => true)).toEqual({ ok: false, code: error })
  })
  it("discards an A response even after an A-B-A account round trip", async () => {
    let finish!: (value: Response) => void
    const fetcher = vi.fn().mockImplementation(() => new Promise<Response>(resolve => { finish = resolve }))
    vi.stubGlobal("fetch", fetcher)
    const pending = requestSelfHostedCoaching("owner-a", { action: "status" }, new AbortController().signal, () => true)
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce())
    setActiveLocalAccount("owner-b"); setActiveLocalAccount("owner-a")
    finish(new Response(JSON.stringify(exampleCoachingStatus)))
    expect(await pending).toEqual({ ok: false, code: "STALE_RESPONSE" })
  })
})
