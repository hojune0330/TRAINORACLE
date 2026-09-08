import { describe, expect, it, vi } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import { accountJournalPreviewEnabled, requestAccountJournal } from "./account-journal-api"

const ownerId = "a1111111-1111-4111-8111-111111111111"
const documentId = "b2222222-2222-4222-8222-222222222222"
const operationId = "c3333333-3333-4333-8333-333333333333"
const draft = { version: 1 as const, state: "DRAFT" as const, visibility: "PRIVATE" as const,
  date: "2026-09-08", title: "Synthetic", body: "Synthetic draft" }
const request = { action: "save" as const, documentId, operationId, expectedRevision: 0, document: draft }
function dependencies(data: unknown, error: unknown = null) {
  const invoke = vi.fn().mockResolvedValue({ data, error })
  const client = { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: ownerId } } }, error: null }) },
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
    expect(deps.invoke).toHaveBeenCalledWith("account-journal", { body: request })
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
