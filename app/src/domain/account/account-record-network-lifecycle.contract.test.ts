import { webcrypto } from "node:crypto"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { createConsentCheckedFetch } from "./consent-checked-fetch"
import { rememberStorageConsentRevision } from "./storage-consent-revision"
import type { AccountAthleteRecordDocument } from "./account-athlete-record-schema"
import { accountAthleteRecordDocumentSchema } from "./account-athlete-record-schema"
import type { AccountJournalConflictBuffer, AccountJournalDraftView } from "./account-journal-draft-buffer"
import { prepareAccountInstantPlanEntry } from "./instant-plan-record-save"
const mocks = vi.hoisted(() => ({ owner: "a1111111-1111-4111-8111-111111111111" as string | null,
  enabled: true, generation: 0, changed: null as null | (() => void), request: vi.fn(), create: vi.fn() }))
vi.mock("./account-journal-api", () => ({ requestAccountDocument: mocks.request, accountJournalPreviewEnabled: () => mocks.enabled }))
vi.mock("./account-journal-draft-buffer", () => ({ createAccountDocumentBuffer: mocks.create }))
vi.mock("./local-journal-ownership", () => ({ activeLocalAccount: () => mocks.owner, localJournalScopeGeneration: () => mocks.generation,
  onLocalJournalScopeChange: (fn: () => void) => { mocks.changed = fn; return () => { mocks.changed = null } } }))
import { loadAccountAthleteRecords, readAccountAthleteRecordsState, disposeAccountAthleteRecords } from "./account-athlete-record-service"
const A = "a1111111-1111-4111-8111-111111111111", B = "b2222222-2222-4222-8222-222222222222"
const now = new Date("2026-10-02T03:00:00Z")
const entry = { kind: "CURRENT_RECORD" as const, eventDistanceM: 5000 as const, performanceSeconds: 1200, achievedOn: "2026-10-01" }
const support = { ok: true, data: { kind: "athlete-record-support", version: 1 } }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done }); return { promise, resolve } }
function switchOwner(next: string) { mocks.owner = next; mocks.generation += 1; mocks.changed?.() }
let device: ReturnType<typeof memoryBuffer>
const remote = new Map<string, { revision: number; document: AccountAthleteRecordDocument }>()
const receipts = new Map<string, ReturnType<typeof savedReceipt>>()
function savedReceipt(request: { documentId: string; operationId: string; expectedRevision: number }) {
  return { ok: true, data: { kind: "saved", documentId: request.documentId, operationId: request.operationId, revision: request.expectedRevision + 1 } }
}
function respond(owner: string, request: any) {
  if (request.action === "athleteRecordSupport") return support
  if (request.action === "read") return remote.has(owner)
    ? { ok: true, data: { kind: "document", documentId: request.documentId, ...structuredClone(remote.get(owner)) } }
    : { ok: false, code: "NOT_FOUND" }
  if (request.action === "save") {
    if (receipts.has(request.operationId)) return receipts.get(request.operationId)!
    if ((remote.get(owner)?.revision ?? 0) !== request.expectedRevision) return { ok: true, data: { kind: "conflict",
      documentId: request.documentId, operationId: request.operationId, currentRevision: remote.get(owner)!.revision } }
    remote.set(owner, { revision: request.expectedRevision + 1, document: structuredClone(request.document) })
    const receipt = savedReceipt(request)
    receipts.set(request.operationId, receipt)
    return receipt
  }
  throw Error("unexpected action")
}
function serialLocks() {
  const tails = new Map<string, Promise<unknown>>()
  return { request: vi.fn((name: string, _options: unknown, callback: () => unknown) => {
    const next = (tails.get(name) ?? Promise.resolve()).catch(() => undefined).then(callback)
    tails.set(name, next); return next
  }) }
}
beforeEach(() => {
  localStorage.clear(); vi.clearAllMocks(); vi.stubGlobal("crypto", webcrypto)
  disposeAccountAthleteRecords(); mocks.owner = A; mocks.enabled = true
  device = memoryBuffer(); mocks.create.mockImplementation(() => device.local); remote.clear(); receipts.clear()
  mocks.request.mockImplementation(async (owner, request, current) => current() ? respond(owner, request) : { ok: false, code: "STALE_RESPONSE" })
  vi.stubGlobal("navigator", { locks: serialLocks() })
})
afterEach(() => { disposeAccountAthleteRecords(); vi.useRealTimers(); vi.unstubAllGlobals() })
function memoryBuffer() {
  const rows = new Map<string, AccountJournalDraftView<AccountAthleteRecordDocument>>()
  const key = (owner: string, id: string) => `${owner}:${id}`
  const local = {
    close: vi.fn(), read: async (owner: string, id: string) => structuredClone(rows.get(key(owner, id)) ?? null),
    saveDraft: vi.fn(async (ownerId: string, documentId: string, draft: AccountAthleteRecordDocument, sequence: number) => {
      const old = rows.get(key(ownerId, documentId))
      if ((old?.localSequence ?? 0) !== sequence) throw Error("Local CAS")
      rows.set(key(ownerId, documentId), { ownerId, documentId, draft: structuredClone(draft),
        serverRevision: old?.serverRevision ?? 0, localSequence: sequence + 1, acknowledgedSequence: old?.acknowledgedSequence ?? 0,
        pending: null, blocked: null, remoteDraft: null, state: "LOCAL_CHANGES" })
    }),
    queue: async (owner: string, id: string, operationId: string) => {
      const view = rows.get(key(owner, id))!
      if (!view || view.pending) throw Error("Queue")
      view.pending = { operationId, expectedRevision: view.serverRevision, sequence: view.localSequence, draft: structuredClone(view.draft) }
      view.state = "PENDING"
    },
    ack: async (owner: string, id: string, operationId: string, revision: number) => {
      const view = rows.get(key(owner, id))
      if (!view || view.pending?.operationId !== operationId) return false
      view.acknowledgedSequence = view.pending.sequence; view.serverRevision = revision; view.pending = null
      view.state = "DRAFT_ACKNOWLEDGED"; return true
    },
    conflict: async (owner: string, id: string, operationId: string, revision: number) => {
      const view = rows.get(key(owner, id))!
      view.blocked = { kind: "RECEIPT", operationId, currentRevision: revision }; view.state = "CONFLICT"; return true
    },
    captureConflict: async (owner: string, id: string, remote: AccountAthleteRecordDocument | null, revision: number) => {
      const view = rows.get(key(owner, id))!
      view.blocked = { kind: "REMOTE", operationId: null, currentRevision: revision }; view.remoteDraft = remote; view.state = "CONFLICT"
    },
    acceptCleanDeletion: async (owner: string, id: string, revision: number) => {
      rows.get(key(owner, id))!.resolvedDeletion = revision
    },
    importRemote: async (ownerId: string, documentId: string, draft: AccountAthleteRecordDocument, serverRevision: number) => {
      const old = rows.get(key(ownerId, documentId))
      if (old && old.state !== "DRAFT_ACKNOWLEDGED") return "CONFLICT" as const
      rows.set(key(ownerId, documentId), { ownerId, documentId, draft: structuredClone(draft), serverRevision,
        localSequence: 1, acknowledgedSequence: 1, pending: null, blocked: null, remoteDraft: null, state: "DRAFT_ACKNOWLEDGED" })
      return "IMPORTED" as const
    },
  }
  return { rows, local: local as unknown as AccountJournalConflictBuffer<AccountAthleteRecordDocument> }
}
// Load the real transport before test timing; the service still receives its protocol double.
const actualJournalApi = await vi.importActual<typeof import("./account-journal-api")>("./account-journal-api")
async function realRequest() { return actualJournalApi.requestAccountDocument }
async function connectApi(invoke: (owner: string, request: any) => Promise<any>) {
  const requestAccountDocument = await realRequest()
  mocks.request.mockImplementation((owner, request, current, schema, _dependencies, options) => {
    const client = { auth: { getSession: async () => ({ data: { session: { user: { id: owner }, access_token: "synthetic-token" } }, error: null }) },
      functions: { invoke: (_name: string, args: { body: unknown }) => invoke(owner, args.body) } } as unknown as SupabaseClient
    return requestAccountDocument(owner, request, current, schema, { client: async () => client, owner: () => mocks.owner }, options)
  })
}
function transportReply(owner: string, request: any) {
  const result = respond(owner, request)
  return result.ok ? { data: result.data, error: null } : { data: null, error: { context: new Response("{}", { status: 404 }) } }
}

it.each(["client", "session", "invoke"] as const)("settles a stalled %s within the request deadline and ignores its later completion", async stage => {
  const requestAccountDocument = await realRequest(), gate = deferred<any>()
  const reply = { data: { session: { user: { id: A }, access_token: "synthetic-token" } }, error: null }
  const invoke = vi.fn().mockImplementation(() => stage === "invoke" ? gate.promise : Promise.resolve({ data: support.data, error: null }))
  const client = { auth: { getSession: () => stage === "session" ? gate.promise : Promise.resolve(reply) }, functions: { invoke } } as unknown as SupabaseClient
  vi.useFakeTimers()
  let observed: unknown
  const request = requestAccountDocument(A, { action: "athleteRecordSupport" }, () => true, accountAthleteRecordDocumentSchema,
    { client: () => stage === "client" ? gate.promise : Promise.resolve(client), owner: () => A }).then(value => { observed = value; return value })
  await vi.advanceTimersByTimeAsync(30_001)
  expect(observed).toEqual({ ok: false, code: "UNAVAILABLE" })
  if (stage === "invoke") expect(invoke.mock.calls[0]?.[1]?.signal.aborted).toBe(true)
  gate.resolve(stage === "client" ? client : stage === "session" ? reply : { data: support.data, error: null })
  await request; await vi.advanceTimersByTimeAsync(0)
  expect(observed).toEqual({ ok: false, code: "UNAVAILABLE" })
  if (stage !== "invoke") expect(invoke).not.toHaveBeenCalled()
})

it("cancels a stalled session lookup without sending its late completion", async () => {
  const requestAccountDocument = await realRequest(), gate = deferred<any>(), controller = new AbortController()
  const invoke = vi.fn()
  const client = { auth: { getSession: () => gate.promise }, functions: { invoke } } as unknown as SupabaseClient
  vi.useFakeTimers()
  let observed: unknown
  const request = requestAccountDocument(A, { action: "athleteRecordSupport" }, () => true, accountAthleteRecordDocumentSchema,
    { client: async () => client, owner: () => A }, { signal: controller.signal }).then(value => { observed = value })
  await vi.advanceTimersByTimeAsync(0); controller.abort(); await vi.advanceTimersByTimeAsync(0)
  expect(observed).toEqual({ ok: false, code: "STALE_RESPONSE" })
  gate.resolve({ data: { session: { user: { id: A }, access_token: "synthetic-token" } }, error: null })
  await request; await vi.advanceTimersByTimeAsync(0)
  expect(invoke).not.toHaveBeenCalled()
})

it("bounds an error response body that never completes and ignores its late content", async () => {
  const requestAccountDocument = await realRequest(), body = deferred<unknown>()
  const context = new Response(null, { status: 507 })
  vi.spyOn(context, "clone").mockReturnValue({ json: () => body.promise } as Response)
  const client = { auth: { getSession: async () => ({ data: { session: { user: { id: A }, access_token: "synthetic-token" } }, error: null }) },
    functions: { invoke: async () => ({ data: null, error: { context } }) } } as unknown as SupabaseClient
  vi.useFakeTimers()
  let observed: unknown
  const request = requestAccountDocument(A, { action: "athleteRecordSupport" }, () => true, accountAthleteRecordDocumentSchema,
    { client: async () => client, owner: () => A }).then(value => { observed = value })
  await vi.advanceTimersByTimeAsync(30_001)
  expect(context.clone).toHaveBeenCalledOnce()
  expect(observed).toEqual({ ok: false, code: "UNAVAILABLE" })
  body.resolve({ error: "CONFLICT_STORAGE_LIMIT_REACHED" })
  await request; await vi.advanceTimersByTimeAsync(0)
  expect(observed).toEqual({ ok: false, code: "UNAVAILABLE" })
})

it("bounds the real SDK internal session lookup and prevents late consent or body transmission", async () => {
  const requestAccountDocument = await realRequest(), sessionGate = deferred<any>()
  const origin = "https://synthetic.supabase.co"
  const token = `x.${btoa(JSON.stringify({ sub: A, session_id: B })).replace(/\+/gu, "-").replace(/\//gu, "_").replace(/=+$/u, "")}.x`
  const reply = { data: { session: { user: { id: A }, access_token: token } }, error: null }
  rememberStorageConsentRevision(A, 1)
  const transport = vi.fn<typeof fetch>()
  const client = createClient(origin, "synthetic-public", { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: createConsentCheckedFetch(origin, transport) } })
  const getSession = vi.spyOn(client.auth, "getSession")
    .mockResolvedValueOnce(reply as Awaited<ReturnType<typeof client.auth.getSession>>).mockReturnValue(sessionGate.promise)
  vi.useFakeTimers()
  let observed: unknown
  const request = requestAccountDocument(A, { action: "athleteRecordSupport" }, () => true, accountAthleteRecordDocumentSchema,
    { client: async () => client, owner: () => A }).then(value => { observed = value })
  await vi.advanceTimersByTimeAsync(30_001)
  expect(getSession).toHaveBeenCalledTimes(2)
  expect(observed).toEqual({ ok: false, code: "UNAVAILABLE" })
  expect(transport).not.toHaveBeenCalled()
  sessionGate.resolve(reply)
  await request; await vi.advanceTimersByTimeAsync(0)
  expect(transport).not.toHaveBeenCalled()
})

it("releases a stale A browser lock before its response completes across A-B-A", async () => {
  const gate = deferred<any>()
  let first = true, oldDone = false
  await connectApi(async (owner, request) => {
    if (first) { first = false; return gate.promise }
    return transportReply(owner, request)
  })
  const oldA = loadAccountAthleteRecords().then(value => { oldDone = true; return value })
  await vi.waitFor(() => expect(mocks.request).toHaveBeenCalledTimes(1))
  switchOwner(B)
  expect(await loadAccountAthleteRecords()).toMatchObject({ ownerId: B, status: "EMPTY" })
  expect(oldDone).toBe(true)
  switchOwner(A)
  expect(await loadAccountAthleteRecords()).toMatchObject({ ownerId: A, status: "EMPTY" })
  gate.resolve({ data: support.data, error: null })
  await oldA
  expect(readAccountAthleteRecordsState()).toMatchObject({ ownerId: A, status: "EMPTY" })
  expect(remote.size).toBe(0)
})

it("expires an ungranted browser lock without starting a request", async () => {
  vi.stubGlobal("navigator", { locks: { request: vi.fn((_name, options) => new Promise((_resolve, reject) => {
    options.signal?.addEventListener("abort", () => reject(new Error("aborted lock wait")), { once: true })
  })) } })
  vi.useFakeTimers()
  let observed: unknown
  loadAccountAthleteRecords().then(value => { observed = value })
  await vi.advanceTimersByTimeAsync(30_001)
  expect(observed).toMatchObject({ status: "FAILED", confirmed: false })
  expect(mocks.request).not.toHaveBeenCalled()
})

it("rejects an old entry after A-B-A even when a fresh same-owner read is ready without Web Locks", async () => {
  vi.stubGlobal("navigator", {})
  const gate = deferred<any>()
  mocks.request.mockResolvedValueOnce(support).mockImplementationOnce(() => gate.promise)
  const oldEntry = prepareAccountInstantPlanEntry(entry, now)
  await vi.waitFor(() => expect(mocks.request.mock.calls.some(call => call[1].action === "read")).toBe(true))
  switchOwner(B); await loadAccountAthleteRecords()
  switchOwner(A); await loadAccountAthleteRecords()
  const callsBefore = mocks.request.mock.calls.length
  gate.resolve({ ok: false, code: "STALE_RESPONSE" })
  expect(await oldEntry).toEqual({ kind: "storage_failed" })
  expect(mocks.request.mock.calls).toHaveLength(callsBefore)
  expect(remote.size).toBe(0)
})

it("retains the immutable operation after a committed save loses its response and confirms only its exact retry", async () => {
  const gate = deferred<any>()
  let firstSave = true
  await connectApi(async (owner, request) => {
    if (request.action === "save" && firstSave) { firstSave = false; transportReply(owner, request); return gate.promise }
    return transportReply(owner, request)
  })
  let observed: unknown
  vi.useFakeTimers()
  const entryRequest = prepareAccountInstantPlanEntry(entry, now).then(value => { observed = value; return value })
  await vi.waitFor(() => {
    expect({ observed, calls: mocks.request.mock.calls.map(call => call[1].action), state: readAccountAthleteRecordsState().status })
      .toMatchObject({ observed: undefined, calls: expect.arrayContaining(["save"]) })
  })
  await vi.advanceTimersByTimeAsync(30_001)
  expect(observed).toEqual({ kind: "pending" })
  expect(readAccountAthleteRecordsState()).toMatchObject({ status: "PENDING", confirmed: false })
  const pending = structuredClone([...device.rows.values()][0]?.pending)
  expect(pending?.operationId).toBeTruthy()
  vi.useRealTimers()
  expect(await prepareAccountInstantPlanEntry(entry, now)).toMatchObject({ kind: "ready" })
  const saves = mocks.request.mock.calls.filter(call => call[1].action === "save").map(call => call[1])
  expect(saves).toHaveLength(2)
  expect(saves[1]).toEqual(saves[0])
  expect(saves[1].operationId).toBe(pending?.operationId)
  expect(receipts.size).toBe(1)
  expect(remote.get(A)?.revision).toBe(1)
  gate.resolve({ data: { kind: "saved", documentId: saves[0].documentId, operationId: saves[0].operationId, revision: 1 }, error: null })
  await entryRequest
  expect(readAccountAthleteRecordsState()).toMatchObject({ status: "READY", confirmed: true, serverRevision: 1 })
})
