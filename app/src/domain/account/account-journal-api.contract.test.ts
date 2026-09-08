import { describe, expect, it, vi } from "vitest"
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js"
import { accountJournalPreviewEnabled, requestAccountJournal } from "./account-journal-api"

const ownerId = "a1111111-1111-4111-8111-111111111111"
const documentId = "b2222222-2222-4222-8222-222222222222"
const operationId = "c3333333-3333-4333-8333-333333333333"
const otherOwnerId = "d4444444-4444-4444-8444-444444444444"
const accessToken = "synthetic-token-A"
const draft = { version: 1 as const, state: "DRAFT" as const, visibility: "PRIVATE" as const,
  date: "2026-09-08", title: "Synthetic", body: "Synthetic draft" }
const request = { action: "save" as const, documentId, operationId, expectedRevision: 0, document: draft }
function dependencies(data: unknown, error: unknown = null) {
  const invoke = vi.fn().mockResolvedValue({ data, error })
  const client = { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: ownerId }, access_token: accessToken } }, error: null }) },
    functions: { invoke } }
  return { client: vi.fn().mockResolvedValue(client as unknown as SupabaseClient), owner: () => ownerId, invoke, auth: client.auth }
}
describe("account draft API", () => {
  it.each(["PLANNED_SESSION_ALREADY_RECORDED", "INSUFFICIENT_POINTS", "OPERATION_REPLAY_UNAVAILABLE"] as const)(
    "preserves controlled rejection %s without inventing a revision", async error => {
      expect(await requestAccountJournal(ownerId, request, () => true,
        dependencies(null, { context: new Response(JSON.stringify({ error }), { status: 409 }) })))
        .toEqual({ ok: false, code: error })
    },
  )
  it("is hidden unless explicitly enabled and not killed", () => {
    expect(accountJournalPreviewEnabled({})).toBe(false)
    expect(accountJournalPreviewEnabled({ VITE_FEATURE_ACCOUNT_JOURNAL: "true" })).toBe(true)
    expect(accountJournalPreviewEnabled({ VITE_FEATURE_ACCOUNT_JOURNAL: "true", VITE_KILL_ACCOUNT_JOURNAL: "true" })).toBe(false)
  })
  it("accepts only matching server receipt", async () => {
    const deps = dependencies({ kind: "saved", documentId, operationId, revision: 1 })
    expect((await requestAccountJournal(ownerId, request, () => true, deps)).ok).toBe(true)
    expect(deps.invoke).toHaveBeenCalledWith("account-journal", {
      body: request, headers: { Authorization: `Bearer ${accessToken}` },
    })
  })
  it.each([
    { kind: "saved", documentId, operationId, revision: 2 },
    { kind: "saved", documentId: ownerId, operationId, revision: 1 },
    { kind: "ready" }, { kind: "list", documents: [], nextCursor: null },
  ])("rejects unrelated success response %j", async data => {
    expect(await requestAccountJournal(ownerId, request, () => true, dependencies(data)))
      .toEqual({ ok: false, code: "INVALID_RESPONSE" })
  })
  it("does not contact server for previous account", async () => {
    const deps = dependencies(null)
    expect((await requestAccountJournal(ownerId, request, () => false, deps)).ok).toBe(false)
    expect(deps.client).not.toHaveBeenCalled()
  })
  it("ignores response when account changed while sending", async () => {
    let active = true
    const deps = dependencies(null)
    deps.invoke.mockImplementation(async () => { active = false; return { data: { kind: "saved", documentId, operationId, revision: 1 }, error: null } })
    expect(await requestAccountJournal(ownerId, request, () => active, deps)).toEqual({ ok: false, code: "STALE_RESPONSE" })
  })
  it("does not send after missing authentication", async () => {
    const deps = dependencies(null)
    deps.auth.getSession.mockResolvedValue({ data: { session: null }, error: null })
    expect(await requestAccountJournal(ownerId, request, () => true, deps)).toEqual({ ok: false, code: "AUTH_REQUIRED" })
    expect(deps.invoke).not.toHaveBeenCalled()
  })
  it.each([undefined, null, "", " ", 123, {}, " token", "token ", "two tokens", "token\r\nother", "token\n", "token\u0000", "token\u00e9"])(
    "does not send a missing or malformed bearer token (%j)", async token => {
      const deps = dependencies(null)
      deps.auth.getSession.mockResolvedValue({ data: { session: { user: { id: ownerId }, access_token: token } }, error: null })
      expect(await requestAccountJournal(ownerId, request, () => true, deps)).toEqual({ ok: false, code: "AUTH_REQUIRED" })
      expect(deps.invoke).not.toHaveBeenCalled()
    },
  )
  it.each([
    { data: { session: { user: { id: otherOwnerId }, access_token: "synthetic-token-B" } }, error: null },
    { data: { session: { user: { id: ownerId }, access_token: accessToken } }, error: new Error("Synthetic auth failure") },
  ])("does not send for mismatched or failed authentication", async session => {
    const deps = dependencies(null)
    deps.auth.getSession.mockResolvedValue(session)
    expect(await requestAccountJournal(ownerId, request, () => true, deps)).toEqual({ ok: false, code: "AUTH_REQUIRED" })
    expect(deps.invoke).not.toHaveBeenCalled()
  })
  it("does not invoke if the owner changes during the initial session check", async () => {
    let owner = ownerId
    const deps = dependencies(null)
    deps.auth.getSession.mockImplementation(async () => {
      owner = otherOwnerId
      return { data: { session: { user: { id: ownerId }, access_token: accessToken } }, error: null }
    })
    expect(await requestAccountJournal(ownerId, request, () => true, { ...deps, owner: () => owner }))
      .toEqual({ ok: false, code: "STALE_RESPONSE" })
    expect(deps.invoke).not.toHaveBeenCalled()
  })
  it("does not render failed list as an empty account", async () => {
    expect(await requestAccountJournal(ownerId, { action: "list" }, () => true,
      dependencies(null, { context: new Response(null, { status: 503 }) })))
      .toEqual({ ok: false, code: "UNAVAILABLE" })
  })
  it("uses NOT_FOUND only for a missing individual document, never failed listing or auth", async () => {
    const missing = () => dependencies(null, { context: new Response(null, { status: 404 }) })
    expect(await requestAccountJournal(ownerId, { action: "read", documentId }, () => true, missing()))
      .toEqual({ ok: false, code: "NOT_FOUND" })
    expect(await requestAccountJournal(ownerId, { action: "list" }, () => true, missing()))
      .toEqual({ ok: false, code: "UNAVAILABLE" })
    expect(await requestAccountJournal(ownerId, { action: "read", documentId }, () => true,
      dependencies(null, { context: new Response(null, { status: 401 }) })))
      .toEqual({ ok: false, code: "AUTH_REQUIRED" })
  })
  it("preserves a validated HTTP 409 conflict receipt", async () => {
    const receipt = { kind: "conflict", documentId, operationId, currentRevision: 2 }
    expect(await requestAccountJournal(ownerId, request, () => true,
      dependencies(null, { context: new Response(JSON.stringify(receipt), { status: 409 }) })))
      .toEqual({ ok: true, data: receipt })
  })
  it("does not invent a conflict revision for operation reuse", async () => {
    expect(await requestAccountJournal(ownerId, request, () => true,
      dependencies(null, { context: new Response(JSON.stringify({ error: "OPERATION_REUSED" }), { status: 409 }) })))
      .toEqual({ ok: false, code: "CONFLICT" })
  })
})

describe("account journal actual SDK authorization race", () => {
  const cases = [
    { request, response: { kind: "saved", documentId, operationId, revision: 1 } },
    { request: { action: "status" as const }, response: { kind: "ready" } },
    { request: { action: "list" as const }, response: { kind: "list", documents: [], nextCursor: null } },
    { request: { action: "read" as const, documentId }, response: { kind: "document", documentId, revision: 1, document: draft } },
    { request: { action: "history" as const, documentId }, response: { kind: "history", documentId, versions: [] } },
    { request: { action: "delete" as const, documentId, operationId, expectedRevision: 0 },
      response: { kind: "deleted", documentId, operationId, revision: 1 } },
    { request: { action: "restore" as const, documentId, operationId, expectedRevision: 1, sourceRevision: 1 },
      response: { kind: "restored", documentId, operationId, revision: 2, sourceRevision: 1 } },
  ]
  describe.each([false, true])("local owner change observed: %s", localOwnerChanged => {
    it.each(cases)("pins account A for $request.action when the SDK rereads account B", async ({ request, response }) => {
      let owner = ownerId
      const wire: { authorization: string | null; body: unknown }[] = []
      // Keep functions.invoke and fetchWithAuth real; replace only auth results and final I/O.
      const transport = vi.fn<typeof fetch>(async (input, init) => {
        expect(String(input)).toBe("https://synthetic.invalid/functions/v1/account-journal")
        wire.push({ authorization: new Headers(init?.headers).get("Authorization"), body: JSON.parse(String(init?.body)) })
        return new Response(JSON.stringify(response), { headers: { "Content-Type": "application/json" } })
      })
      const client = createClient("https://synthetic.invalid", "synthetic-anon-key", {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false,
          storageKey: `synthetic-journal-race-${localOwnerChanged}-${request.action}` },
        global: { fetch: transport },
      })
      await client.auth.initialize()
      const session = (id: string, token: string) => ({ data: { session: { user: { id }, access_token: token } as Session }, error: null })
      const getSession = vi.spyOn(client.auth, "getSession")
        .mockResolvedValueOnce(session(ownerId, accessToken))
        .mockImplementation(async () => {
          if (localOwnerChanged) owner = otherOwnerId
          return session(otherOwnerId, "synthetic-token-B")
        })
      const result = await requestAccountJournal(ownerId, request, () => true, { client: async () => client, owner: () => owner })
      expect(getSession).toHaveBeenCalledTimes(2)
      expect(transport).toHaveBeenCalledTimes(1)
      expect(wire).toEqual([{ authorization: `Bearer ${accessToken}`, body: request }])
      expect(result).toEqual(localOwnerChanged ? { ok: false, code: "STALE_RESPONSE" } : { ok: true, data: response })
    })
  })
})
