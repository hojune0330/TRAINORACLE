import { webcrypto } from "node:crypto"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import type { AccountAthleteRecordDocument } from "./account-athlete-record-schema"
import { accountAthleteRecordDocumentSchema } from "./account-athlete-record-schema"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { AccountJournalConflictBuffer, AccountJournalDraftView } from "./account-journal-draft-buffer"
import type { AccountJournalRequest } from "./account-journal-api"
import { createSelfReportedAthleteRecord, type AthleteRecord } from "../athlete-records"
// @ts-expect-error Edge modules intentionally have no TypeScript declaration file.
import { verifyAccountPaceRecordEdit, verifyAccountPlanPaceRecordSources, accountPlanIntroducesPaceRecordSources, createAccountJournalHandler, createAccountJournalRepository } from "../../../../supabase/functions/_shared/account-journal-handler.mjs"
// @ts-expect-error Edge modules intentionally have no TypeScript declaration file.
import { createAccountPlanCollectionHandler, accountPlanCollectionDocumentId, accountPlanCollectionMetadata } from "../../../../supabase/functions/_shared/account-plan-collection-handler.mjs"
// @ts-expect-error Edge modules intentionally have no TypeScript declaration file.
import { encryptAccountJournalDocument } from "../../../../supabase/functions/_shared/account-journal-crypto.mjs"
import { accountPlanEntry, accountPlanFingerprint } from "./account-plan-document-schema"
import { splitAccountPlanCollection, accountPlanCollectionPartHash } from "./account-plan-collection-schema"
import { stateFixture } from "../plan-beta-store.test-fixture"
import { bindCatalogSession, resolveCatalogBinding } from "@impl/prescription/catalog-session-binding"
import { deriveCandidateId, derivePairId } from "@impl/plan-generator/candidate-identity"
import { createAccountPlanCollectionClient } from "./account-plan-collection-api"
import { preparePacePlanUpdate } from "../pace-plan-update"
import { prepareCatalogReplacement } from "../catalog-replacement"
import type { VersionedStoredPlanSession } from "../plan-session-schema"

const mocks = vi.hoisted(() => ({ owner: "a1111111-1111-4111-8111-111111111111" as string | null,
  enabled: true, changed: null as null | (() => void), request: vi.fn(), create: vi.fn() }))
vi.mock("./account-journal-api", () => ({ requestAccountDocument: mocks.request, accountJournalPreviewEnabled: () => mocks.enabled }))
vi.mock("./account-journal-draft-buffer", () => ({ createAccountDocumentBuffer: mocks.create }))
vi.mock("./local-journal-ownership", () => ({ activeLocalAccount: () => mocks.owner,
  onLocalJournalScopeChange: (fn: () => void) => { mocks.changed = fn; return () => { mocks.changed = null } } }))
import { accountAthleteRecordDocumentId, loadAccountAthleteRecords, syncAccountAthleteRecords,
  addAccountAthleteRecord, getConfirmedAccountAthleteRecordSnapshot, readAccountAthleteRecordsState,
  disposeAccountAthleteRecords } from "./account-athlete-record-service"

const A = "a1111111-1111-4111-8111-111111111111", B = "b2222222-2222-4222-8222-222222222222"
const record = (id = "r-1"): AthleteRecord & { purpose: "RECENT_RESULT" } => {
  const value = createSelfReportedAthleteRecord({ id, purpose: "RECENT_RESULT",
    eventDistanceM: 5000, performanceSeconds: 1200, achievedOn: null, seasonId: null }, new Date("2026-01-01T00:00:00Z"))
  if (!value || value.purpose !== "RECENT_RESULT") throw Error("Invalid record fixture")
  return { ...value, purpose: "RECENT_RESULT" as const }
}
const document = (id = "r-1"): AccountAthleteRecordDocument => ({ version: 3, state: "ACCOUNT_STATE", kind: "ATHLETE_RECORDS", data: { records: [record(id)] } })

// Protocol double: the shared buffer's encryption and real IndexedDB are not proven by this suite.
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
let device: ReturnType<typeof memoryBuffer>
let remote: { revision: number; document: AccountAthleteRecordDocument } | null
let unavailable: boolean, lostAck: boolean, deleted: boolean, supported: boolean, saveUnavailable: boolean
const receipts = new Map<string, unknown>()

beforeEach(() => {
  vi.stubGlobal("crypto", webcrypto)
  disposeAccountAthleteRecords(); mocks.owner = A; mocks.enabled = true
  device = memoryBuffer(); mocks.create.mockImplementation(() => device.local)
  remote = null; unavailable = false; lostAck = false; deleted = false; supported = true; saveUnavailable = false; receipts.clear()
  mocks.request.mockImplementation(async (_owner: string, request: AccountJournalRequest<AccountAthleteRecordDocument>, current: () => boolean) => {
    if (!current()) return { ok: false, code: "STALE_RESPONSE" }
    if (unavailable) return { ok: false, code: "UNAVAILABLE" }
    if (request.action === "athleteRecordSupport") return supported
      ? { ok: true, data: { kind: "athlete-record-support", version: 1 } } : { ok: false, code: "ATHLETE_RECORD_UNSUPPORTED" }
    if (request.action === "read") return deleted ? { ok: true, data: { kind: "deleted", documentId: request.documentId, revision: 3 } }
      : remote ? { ok: true, data: { kind: "document", documentId: request.documentId, ...structuredClone(remote) } } : { ok: false, code: "NOT_FOUND" }
    if (request.action !== "save") throw Error("Unexpected action")
    if (saveUnavailable) return { ok: false, code: "UNAVAILABLE" }
    if (receipts.has(request.operationId)) return receipts.get(request.operationId)
    if ((remote?.revision ?? 0) !== request.expectedRevision) return { ok: true, data: { kind: "conflict",
      documentId: request.documentId, operationId: request.operationId, currentRevision: remote?.revision ?? 0 } }
    remote = { revision: request.expectedRevision + 1, document: structuredClone(request.document) }
    const ack = { ok: true, data: { kind: "saved", documentId: request.documentId, operationId: request.operationId, revision: remote.revision } }
    receipts.set(request.operationId, ack)
    return lostAck ? { ok: false, code: "UNAVAILABLE" } : ack
  })
})
afterEach(() => { disposeAccountAthleteRecords(); vi.useRealTimers(); vi.unstubAllGlobals() })

it("uses stable owner-bound document IDs", async () => {
  expect(await accountAthleteRecordDocumentId(A)).toBe(await accountAthleteRecordDocumentId(A))
  expect(await accountAthleteRecordDocumentId(A)).not.toBe(await accountAthleteRecordDocumentId(B))
})
it("loads empty, adds with CAS, then reloads the confirmed collection on another device", async () => {
  expect((await loadAccountAthleteRecords()).status).toBe("EMPTY")
  expect(getConfirmedAccountAthleteRecordSnapshot("r-1")).toBeNull()
  const result = await addAccountAthleteRecord(record(), 0)
  expect(result).toMatchObject({ ok: true, storage: "ACCOUNT", state: { serverRevision: 1, confirmed: true } })
  const snapshot = getConfirmedAccountAthleteRecordSnapshot("r-1")
  expect(snapshot).toEqual({ documentId: await accountAthleteRecordDocumentId(A), serverRevision: 1, recordId: "r-1" })
  disposeAccountAthleteRecords(); device = memoryBuffer()
  expect(await loadAccountAthleteRecords()).toMatchObject({ status: "READY", serverRevision: 1, records: [record()] })
  expect(getConfirmedAccountAthleteRecordSnapshot("r-1")).toEqual(snapshot)
  expect(readAccountAthleteRecordsState().records[0]?.verificationState).toBe("SELF_REPORTED")
})
it("rejects not-loaded writes, forged authority, duplicates and stale expected revisions", async () => {
  expect(await addAccountAthleteRecord(record(), 0)).toEqual({ ok: false, code: "NOT_READY" })
  await loadAccountAthleteRecords()
  expect(await addAccountAthleteRecord({ ...record(), verificationState: "VERIFIED" }, 0)).toEqual({ ok: false, code: "INVALID_RECORD" })
  await addAccountAthleteRecord(record(), 0)
  expect(await addAccountAthleteRecord(record(), 1)).toEqual({ ok: false, code: "DUPLICATE_RECORD" })
  expect(await addAccountAthleteRecord(record("r-2"), 0)).toEqual({ ok: false, code: "STALE_REVISION" })
  expect(remote?.document.data.records).toHaveLength(1)
})
it("preserves a competing-device conflict without last-write-wins or a pace snapshot", async () => {
  await loadAccountAthleteRecords(); remote = { revision: 1, document: document("r-other") }
  expect(await addAccountAthleteRecord(record(), 0)).toEqual({ ok: false, code: "CONFLICT" })
  expect(getConfirmedAccountAthleteRecordSnapshot("r-1")).toBeNull()
  expect((await syncAccountAthleteRecords()).status).toBe("CONFLICT")
  expect([...device.rows.values()][0]?.draft.data.records[0]?.id).toBe("r-1")
  expect(remote.document.data.records[0]?.id).toBe("r-other")
})
it("replays the exact operation after lost acknowledgement and a service restart", async () => {
  await loadAccountAthleteRecords(); lostAck = true
  expect(await addAccountAthleteRecord(record(), 0)).toMatchObject({ ok: true, storage: "PENDING", snapshot: null })
  const operation = [...device.rows.values()][0]?.pending?.operationId
  expect(getConfirmedAccountAthleteRecordSnapshot("r-1")).toBeNull()
  disposeAccountAthleteRecords(); lostAck = false
  expect((await syncAccountAthleteRecords()).status).toBe("READY")
  const saves = mocks.request.mock.calls.map(call => call[1]).filter(request => request.action === "save")
  expect(saves).toHaveLength(2)
  expect(saves[1]).toEqual(saves[0])
  expect(saves[1].operationId).toBe(operation)
  expect(remote?.revision).toBe(1)
})
it("does not label a cached read as confirmed during an outage", async () => {
  remote = { revision: 2, document: document() }; await loadAccountAthleteRecords(); unavailable = true
  expect((await loadAccountAthleteRecords()).status).toBe("FAILED")
  expect(getConfirmedAccountAthleteRecordSnapshot("r-1")).toBeNull()
})
it("blocks deletion resurrection and preserves pending data for review", async () => {
  await loadAccountAthleteRecords(); saveUnavailable = true; await addAccountAthleteRecord(record(), 0)
  saveUnavailable = false; deleted = true
  expect((await syncAccountAthleteRecords()).status).toBe("CONFLICT")
  expect([...device.rows.values()][0]?.draft.data.records).toEqual([record()])
  expect(getConfirmedAccountAthleteRecordSnapshot("r-1")).toBeNull()
})
it("does not expose another account's results after a mid-read switch", async () => {
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  mocks.request.mockResolvedValueOnce({ ok: true, data: { kind: "athlete-record-support", version: 1 } })
  mocks.request.mockImplementationOnce(async (_owner, request) => {
    await gate; return { ok: true, data: { kind: "document", documentId: request.documentId, revision: 1, document: document() } }
  })
  const loading = loadAccountAthleteRecords()
  await vi.waitFor(() => expect(mocks.request.mock.calls.some(call => call[1].action === "read")).toBe(true))
  mocks.owner = B; mocks.changed?.(); release(); await loading
  expect(readAccountAthleteRecordsState().records).toEqual([])
  expect(getConfirmedAccountAthleteRecordSnapshot("r-1")).toBeNull()
  expect(device.rows.size).toBe(0)
})
it("serializes same-device writes and uses the revised CAS version", async () => {
  await loadAccountAthleteRecords()
  const results = await Promise.all([addAccountAthleteRecord(record(), 0), addAccountAthleteRecord(record("r-2"), 0)])
  expect(results[0]).toMatchObject({ ok: true, storage: "ACCOUNT" })
  expect(results[1]).toEqual({ ok: false, code: "STALE_REVISION" })
  expect(await addAccountAthleteRecord(record("r-2"), 1)).toMatchObject({ ok: true, storage: "ACCOUNT", state: { serverRevision: 2 } })
})
it("fails closed when disabled or signed out", async () => {
  mocks.enabled = false; expect((await loadAccountAthleteRecords()).status).toBe("IDLE")
  mocks.enabled = true; mocks.owner = null; expect((await loadAccountAthleteRecords()).status).toBe("AUTH_REQUIRED")
  expect(mocks.request).not.toHaveBeenCalled()
})

it("requires capability before collection reads or a new local draft", async () => {
  supported = false
  expect((await loadAccountAthleteRecords()).status).toBe("FAILED")
  expect(mocks.request.mock.calls.every(call => call[1].action === "athleteRecordSupport")).toBe(true)
  expect(device.local.saveDraft).not.toHaveBeenCalled()
  supported = true; await loadAccountAthleteRecords(); supported = false
  expect(await addAccountAthleteRecord(record(), 0)).toEqual({ ok: false, code: "NOT_READY" })
  expect(device.local.saveDraft).not.toHaveBeenCalled()
  expect(getConfirmedAccountAthleteRecordSnapshot("r-1")).toBeNull()
})
it("preserves a pending operation while capability is unavailable and retries the same operation", async () => {
  await loadAccountAthleteRecords(); saveUnavailable = true; await addAccountAthleteRecord(record(), 0)
  const pending = structuredClone([...device.rows.values()][0]?.pending)
  supported = false; saveUnavailable = false
  expect((await syncAccountAthleteRecords()).status).toBe("FAILED")
  expect([...device.rows.values()][0]?.pending).toEqual(pending)
  expect(mocks.request.mock.calls.filter(call => call[1].action === "save")).toHaveLength(1)
  supported = true
  expect((await syncAccountAthleteRecords()).status).toBe("READY")
  const saves = mocks.request.mock.calls.filter(call => call[1].action === "save")
  expect(saves[1]?.[1]).toEqual(saves[0]?.[1])
})
it.each([
  { ok: true, data: { kind: "ready" } },
  { ok: true, data: { kind: "athlete-record-support", version: 2 } },
  { ok: false, code: "AUTH_REQUIRED" },
])("does not accept an invalid or unauthenticated capability: %j", async response => {
  mocks.request.mockResolvedValueOnce(response)
  expect((await loadAccountAthleteRecords()).confirmed).toBe(false)
  expect(mocks.request).toHaveBeenCalledTimes(1)
  expect(device.local.saveDraft).not.toHaveBeenCalled()
})

async function realTransport(invoke: (name: string, options: { body: unknown; headers: Record<string, string> }) => Promise<unknown>) {
  const { requestAccountDocument } = await vi.importActual<typeof import("./account-journal-api")>("./account-journal-api")
  const client = { auth: { getSession: async () => ({ data: { session: { access_token: "synthetic-token", user: { id: A } } }, error: null }) },
    functions: { invoke } } as unknown as SupabaseClient
  return (request: AccountJournalRequest<AccountAthleteRecordDocument> = { action: "athleteRecordSupport" }) =>
    requestAccountDocument(A, request, () => true, accountAthleteRecordDocumentSchema, { client: async () => client, owner: () => A })
}
it("connects the actual capability API to the authenticated handler and rejects absent SQL support", async () => {
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"])
  const active = { key, keyId: "test-key" }
  const rpc = vi.fn(async () => ({ data: { kind: "athlete-record-support", version: 1 }, error: null as null | { code: string } }))
  const signed = { request_text: "synthetic-attested-request", signature: "synthetic-signature", key_id: "test-attestor" }
  const attest = vi.fn(async () => signed)
  const repo = createAccountJournalRepository({ rpc }, { ownerId: A, attest })
  const handler = createAccountJournalHandler({ authenticate: async () => ({ ownerId: A,
    repo: { ...repo, enabled: async () => true } }),
    getMaterial: async () => ({ active, get: () => active }), validateDocument: () => true })
  const invoke = vi.fn(async (name: string, options: { body: unknown; headers: Record<string, string> }) => {
    expect(name).toBe("account-journal")
    const response = await handler(new Request("https://example.test/account-journal", { method: "POST",
      headers: { ...options.headers, "Content-Type": "application/json" }, body: JSON.stringify(options.body) }))
    return response.ok ? { data: await response.json(), error: null } : { data: null, error: { context: response } }
  })
  const request = await realTransport(invoke)
  expect(await request()).toEqual({ ok: true, data: { kind: "athlete-record-support", version: 1 } })
  expect(invoke.mock.calls[0]?.[1].body).toEqual({ action: "athleteRecordSupport" })
  expect(attest).toHaveBeenCalledWith(A, "athleteRecordSupport", {})
  expect(rpc).toHaveBeenCalledWith("mutate_account_journal_attested", signed)
  rpc.mockResolvedValueOnce({ data: { kind: "athlete-record-support", version: 1 }, error: { code: "22023" } })
  expect(await request()).toEqual({ ok: false, code: "ATHLETE_RECORD_UNSUPPORTED" })
})
it.each([400, 404, 501, 401, 503])("bounds capability HTTP %i handling without changing read semantics", async statusCode => {
  const request = await realTransport(async () => ({ data: null, error: { context: new Response(null, { status: statusCode }) } }))
  expect(await request()).toEqual({ ok: false, code: statusCode === 401 ? "AUTH_REQUIRED"
    : statusCode === 503 ? "UNAVAILABLE" : "ATHLETE_RECORD_UNSUPPORTED" })
  if (statusCode === 404) expect(await request({ action: "read", documentId: await accountAthleteRecordDocumentId(A) }))
    .toEqual({ ok: false, code: "NOT_FOUND" })
})
it.each([{ kind: "ready" }, { kind: "athlete-record-support", version: 2 },
  { kind: "athlete-record-support", version: 1, extra: true }])("rejects malformed actual API capability: %j", async data => {
  const request = await realTransport(async () => ({ data, error: null }))
  expect(await request()).toEqual({ ok: false, code: "INVALID_RESPONSE" })
})

// Edge handlers use the actual generated validators; SQL has a separate integration gate.
async function paceGuardFixture() {
  const documentId = await accountAthleteRecordDocumentId(A)
  const reference = { recordId: "r-1", recordVersion: record().savedAt, eventDistanceM: 5000,
    performanceSeconds: 1200, achievedOn: null, kind: "ACTUAL", segmentId: "main", confirmed: true,
    evaluatedOn: "2026-01-02", model: "RACE_AVERAGE_V1" }
  const replacement = { day: 2, slot: "AM", prescription: { catalogWorkout: { inputs: { paceReferences: [reference] } } } }
  const nextState = { activePlanEdit: { action: "PACE_REFERENCE", paceRecordGuard: { documentId, revision: 2 }, replacements: [replacement] } }
  const row = { user_id: A, document_id: documentId, revision: 2, deleted_at: null, encrypted_payload: {} }
  const read = vi.fn(async () => row), decode = vi.fn(async () => document())
  return { verifyAccountPaceRecordEdit, documentId, reference, replacement, nextState, row, read, decode,
    input: { ownerId: A, nextState, previousState: {}, read, decode } }
}

it("server source verification returns the exact revision only for matching stored self-entry", async () => {
  const f = await paceGuardFixture()
  expect(await f.verifyAccountPaceRecordEdit(f.input)).toEqual({ ok: true, guard: { documentId: f.documentId, revision: 2 } })
  expect(f.read).toHaveBeenCalledWith(A, f.documentId)
})
it("server matches legacy fiveK inputs against a dated actual without allowing a goal substitute", async () => {
  const f = await paceGuardFixture(), stored = { ...record(), achievedOn: "2025-12-31" }
  f.decode.mockResolvedValue({ ...document(), data: { records: [stored] } })
  const inputs = { fiveK: { recordId: stored.id, seconds: stored.performanceSeconds, achievedAt: stored.achievedOn, evaluatedAt: "2026-01-02" } }
  const nextState = { activePlanEdit: { ...f.nextState.activePlanEdit,
    replacements: [{ day: 2, slot: "AM", prescription: { kind: "RPE_TIME_RANGE", catalogWorkout: { inputs } } }] } }
  expect(await f.verifyAccountPaceRecordEdit({ ...f.input, nextState })).toMatchObject({ ok: true })
  inputs.fiveK.seconds = 999
  expect(await f.verifyAccountPaceRecordEdit({ ...f.input, nextState })).toMatchObject({ ok: false, code: "PACE_RECORD_SOURCE_CHANGED" })
  inputs.fiveK.seconds = stored.performanceSeconds
  f.decode.mockResolvedValue({ ...document(), data: { records: [{ ...stored, purpose: "RACE_GOAL", achievedOn: null, seasonId: null }] } })
  expect(await f.verifyAccountPaceRecordEdit({ ...f.input, nextState })).toMatchObject({ ok: false })
})
it("server matches legacy PACE_TARGET anchor contents and rejects changed times or claimed verification", async () => {
  const f = await paceGuardFixture(), stored = { ...record(), achievedOn: "2025-12-31" }
  f.decode.mockResolvedValue({ ...document(), data: { records: [stored] } })
  const anchor = { anchorId: stored.id, eventDistanceM: stored.eventDistanceM, performanceSeconds: stored.performanceSeconds,
    achievedAt: stored.achievedOn, kind: "RECENT_RESULT", purpose: "CURRENT_CAPABILITY", seasonId: null,
    enteredBy: stored.enteredBy, verificationState: "SELF_REPORTED", sourceRef: stored.sourceRef }
  const nextState = { activePlanEdit: { ...f.nextState.activePlanEdit,
    replacements: [{ day: 2, slot: "AM", prescription: { kind: "PACE_TARGET", selectedAnchor: anchor } }] } }
  expect(await f.verifyAccountPaceRecordEdit({ ...f.input, nextState })).toMatchObject({ ok: true })
  anchor.performanceSeconds = 999
  expect(await f.verifyAccountPaceRecordEdit({ ...f.input, nextState })).toMatchObject({ ok: false })
  anchor.performanceSeconds = stored.performanceSeconds; anchor.verificationState = "VERIFIED"
  expect(await f.verifyAccountPaceRecordEdit({ ...f.input, nextState })).toMatchObject({ ok: false })
})

it("server keeps an explicit PACE_TARGET goal aspirational and binds its immutable source version", async () => {
  const f = await paceGuardFixture(), stored = { ...record(), purpose: "RACE_GOAL" as const, achievedOn: null, seasonId: null }
  f.decode.mockResolvedValue({ ...document(), data: { records: [stored] } })
  const anchor = { anchorId: stored.id, eventDistanceM: stored.eventDistanceM, performanceSeconds: stored.performanceSeconds,
    achievedAt: null, kind: "GOAL", purpose: "ASPIRATIONAL_TARGET", seasonId: null, freshnessState: "UNKNOWN",
    enteredBy: stored.enteredBy, verificationState: "SELF_REPORTED", sourceRef: stored.sourceRef,
    selectionEvidence: { version: 1, kind: "EXPLICIT_GOAL", confirmed: true, recordSchemaVersion: 1,
      recordPurpose: "RACE_GOAL", recordVersion: stored.savedAt, evaluatedOn: "2026-01-02", timeZone: "UTC" } }
  const nextState = { activePlanEdit: { ...f.nextState.activePlanEdit,
    replacements: [{ day: 2, slot: "AM", prescription: { kind: "PACE_TARGET", selectedAnchor: anchor } }] } }
  expect(await f.verifyAccountPaceRecordEdit({ ...f.input, nextState })).toMatchObject({ ok: true })
  anchor.selectionEvidence.recordVersion = "2000-01-01T00:00:00.000Z"
  expect(await f.verifyAccountPaceRecordEdit({ ...f.input, nextState })).toMatchObject({ ok: false })
  anchor.selectionEvidence.recordVersion = stored.savedAt; anchor.purpose = "CURRENT_CAPABILITY"
  expect(await f.verifyAccountPaceRecordEdit({ ...f.input, nextState })).toMatchObject({ ok: false })
  anchor.purpose = "ASPIRATIONAL_TARGET"
  f.decode.mockResolvedValue({ ...document(), data: { records: [{ ...stored, purpose: "RECENT_RESULT", achievedOn: "2025-12-31" }] } })
  expect(await f.verifyAccountPaceRecordEdit({ ...f.input, nextState })).toMatchObject({ ok: false })
})
it.each([
  { performanceSeconds: 999 }, { eventDistanceM: 800 }, { recordVersion: "2025-01-01T00:00:00.000Z" },
  { achievedOn: "2025-12-31" }, { kind: "GOAL" }, { recordId: "missing-record" },
])("server rejects altered source snapshot %j", async changes => {
  const f = await paceGuardFixture(); Object.assign(f.reference, changes)
  expect(await f.verifyAccountPaceRecordEdit(f.input)).toEqual({ ok: false, code: "PACE_RECORD_SOURCE_CHANGED" })
})
it.each([{ user_id: B }, { revision: 3 }, { deleted_at: "2026-01-02T00:00:00Z" }])(
  "server rejects wrong owner, changed revision or deletion %j", async changes => {
    const f = await paceGuardFixture(); Object.assign(f.row, changes)
    expect(await f.verifyAccountPaceRecordEdit(f.input)).toEqual({ ok: false, code: "PACE_RECORD_SOURCE_CHANGED" })
    expect(f.decode).not.toHaveBeenCalled()
  })
it("server rejects another account's document ID before reading and forbids guard on other actions", async () => {
  const f = await paceGuardFixture()
  f.nextState.activePlanEdit.paceRecordGuard.documentId = await accountAthleteRecordDocumentId(B)
  expect(await f.verifyAccountPaceRecordEdit(f.input)).toEqual({ ok: false, code: "PACE_RECORD_SOURCE_REQUIRED" })
  expect(f.read).not.toHaveBeenCalled()
  f.nextState.activePlanEdit.action = "DURATION"
  expect(await f.verifyAccountPaceRecordEdit(f.input)).toEqual({ ok: false, code: "INVALID_PACE_RECORD_GUARD_SCOPE" })
})
it("server requires a guard for forward edits and cannot treat a forged undo as an exception", async () => {
  const f = await paceGuardFixture()
  const original = { action: "PACE_REFERENCE", baseSessions: [{ day: 2, slot: "AM", seconds: 100 }],
    replacements: [f.replacement], paceRecordGuard: { documentId: f.documentId, revision: 2 } }
  const previousState = { activePlanEdit: original, activePlan: { sessions: [f.replacement] } }
  const undo = { action: "PACE_REFERENCE", undoOf: structuredClone(original), replacements: structuredClone(original.baseSessions) }
  expect(await f.verifyAccountPaceRecordEdit({ ...f.input, nextState: { activePlanEdit: { action: "PACE_REFERENCE", replacements: [f.replacement] } } }))
    .toEqual({ ok: false, code: "PACE_RECORD_SOURCE_REQUIRED" })
  expect(await f.verifyAccountPaceRecordEdit({ ...f.input, previousState, nextState: { activePlanEdit: undo } }))
    .toEqual({ ok: true, guard: null })
  expect(f.read).not.toHaveBeenCalled()
  undo.undoOf.baseSessions[0]!.seconds = 99
  expect(await f.verifyAccountPaceRecordEdit({ ...f.input, previousState, nextState: { activePlanEdit: undo } }))
    .toEqual({ ok: false, code: "PACE_RECORD_UNDO_SOURCE_REQUIRED" })
})

async function collectionGuardFixture(mode: "edit" | "initial" | "successor" | "no-references" | "catalog-new-source" | "catalog-same-source" = "edit") {
  const now = "2026-10-02T03:00:00.000Z", today = "2026-10-02", state = stateFixture()
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(now))
  if (state.version !== 3) throw Error("V3 fixture required")
  state.intake.startDate = "2026-10-01"; state.intake.experienceBand = "EXPERIENCED"
  const old = { ...record(), achievedOn: "2026-09-20", savedAt: "2026-09-21T03:00:00.000Z" }
  const updated = { ...old, id: "r-2", sourceRef: "athlete-record:r-2", performanceSeconds: 1100, savedAt: now }
  const bare: VersionedStoredPlanSession = { day: 1, slot: "AM", role: "QUALITY", plannedEnergyIntent: "LT_INTENT",
    prescription: { kind: "RPE_TIME_RANGE", rpe: { minimum: 6, maximum: 7 }, durationMinutes: { minimum: 20, maximum: 50 } } }
  const inputs = { eventDistanceM: 5000, experience: "EXPERIENCED" as const, availableSeconds: null, confirmedRequirements: [],
    fiveK: { recordId: old.id, seconds: old.performanceSeconds, achievedAt: old.achievedOn, evaluatedAt: today }, segmentPaces: [] }
  const initial = bindCatalogSession(bare, "P-LT-C", inputs)!
  if (initial.prescription.kind !== "RPE_TIME_RANGE" || !initial.prescription.catalogWorkout) throw Error("Fixture binding")
  const segmentId = resolveCatalogBinding(initial.prescription.catalogWorkout)!.steps.find(step => step.targetModel === "THRESHOLD_REFERENCE")!.segmentId
  const selected = bindCatalogSession(bare, "P-LT-C", { ...inputs, fiveK: null, paceReferences: [{
    segmentId, kind: "ACTUAL", recordId: old.id, recordVersion: old.savedAt, eventDistanceM: 5000,
    performanceSeconds: old.performanceSeconds, achievedOn: old.achievedOn, evaluatedOn: today, confirmed: true, model: "FIVE_K_THRESHOLD_V1",
  }] })!
  state.activePlan.sessions = mode === "no-references" ? [bindCatalogSession(bare, "P-LT-C", { ...inputs, fiveK: null })!]
    : [1, 4, 7].map(day => ({ ...structuredClone(selected), day }))
  const plan = state.activePlan
  if (!("formationKind" in plan.frame)) throw Error("Frame required")
  const baseId = mode === "successor" ? plan.candidateId.replace("no-continuity", "balanced:completed-1-rested-0-skipped-0-pain_checkin-0") : plan.candidateId
  const projection = { kind: plan.candidateKind, eventDistanceM: plan.eventDistanceM,
    selectedDetailedTemplateRef: plan.selectedDetailedTemplateRef, selectedEnergyIntent: plan.selectedEnergyIntent,
    sourceMode: plan.sourceMode, selectionAuthority: "SELF" as const, frame: plan.frame, sessions: plan.sessions }
  plan.candidateId = deriveCandidateId(baseId, projection)
  if (mode === "successor") plan.pairId = derivePairId(plan.pairId.replace("no-continuity", "balanced:completed-1-rested-0-skipped-0-pain_checkin-0"),
    plan.candidateId, deriveCandidateId(baseId.replace("beta:balanced:", "beta:conservative:"), { ...projection, kind: "CONSERVATIVE" }))
  const documentId = await accountAthleteRecordDocumentId(A), guard = { documentId, revision: 2 }
  const catalogMode = mode === "catalog-new-source" || mode === "catalog-same-source"
  const chosen = mode === "catalog-new-source" ? updated : old
  const prepared = mode === "edit" ? preparePacePlanUpdate({ state, entries: [], today, now, timeZone: "Asia/Seoul", journalGuard: [], paceRecordGuard: guard, record: updated })
    : catalogMode ? prepareCatalogReplacement({ state, entries: [], today, now, timeZone: "Asia/Seoul", journalGuard: [],
      address: { day: 4, slot: "AM" }, catalogId: mode === "catalog-same-source" ? "P-LT-B" : "P-LT-C", acceptStronger: true, acceptLonger: true,
      inputs: { ...inputs, availableSeconds: 3600, fiveK: null, paceReferences: [{ segmentId, kind: "ACTUAL", recordId: chosen.id,
        recordVersion: chosen.savedAt, eventDistanceM: 5000, performanceSeconds: chosen.performanceSeconds,
        achievedOn: chosen.achievedOn, evaluatedOn: today, confirmed: true, model: "FIVE_K_THRESHOLD_V1" }] } }) : null
  if (prepared && prepared.kind !== "ready") throw Error(`Fixture proposal: ${"reasonCode" in prepared ? prepared.reasonCode : prepared.message}`)
  const previousState = mode === "successor" ? stateFixture() : state
  if (previousState.version !== 3) throw Error("V3 previous fixture required")
  const beforeEntry = accountPlanEntry({ state: previousState, evidence: null }, now)
  const afterEntry = accountPlanEntry({ state: prepared?.kind === "ready" ? prepared.proposal.after : state, evidence: null }, now)
  const hasPrevious = mode === "edit" || mode === "successor" || catalogMode
  const before = splitAccountPlanCollection({ version: 3, state: "ACCOUNT_STATE", kind: "PLAN",
    data: { schemaVersion: 1, currentPlanId: beforeEntry.planId, plans: [beforeEntry] } })!
  const after = splitAccountPlanCollection({ version: 3, state: "ACCOUNT_STATE", kind: "PLAN",
    data: { schemaVersion: 1, currentPlanId: afterEntry.planId, plans: hasPrevious ? [{ ...beforeEntry, archivedAt: now }, afterEntry] : [afterEntry] } })!
  if (!before || !after) throw Error("Fixture collection")
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"])
  const material = { active: { keyId: "test", key }, get: (id: string) => id === "test" ? { keyId: "test", key } : undefined }
  const encrypt = (value: unknown, id: string) => encryptAccountJournalDocument(JSON.stringify(value), { ownerId: A, documentId: id }, material.active)
  const parts = new Map<string, unknown>()
  for (const part of [...before.snapshots, ...before.progress, ...after.snapshots, ...after.progress]) {
    parts.set(`${part.kind}:${part.id}`, { part_kind: part.kind, part_id: part.id, plan_id: part.planId,
      content_hash: accountPlanCollectionPartHash(part), metadata: accountPlanCollectionMetadata(part),
      payload: await encrypt(part, await accountPlanCollectionDocumentId(A, part.kind, part.id)) })
  }
  const index = { revision: 1, index_fingerprint: accountPlanFingerprint(before.index), index_document: before.index,
    payload: await encrypt(before.index, await accountPlanCollectionDocumentId(A, "PLAN_COLLECTION", "index")) }
  const source = { user_id: A, document_id: documentId, revision: 2, deleted_at: null as null | string,
    encrypted_payload: await encrypt({ ...document(), data: { records: [old, updated] } }, documentId) }
  let prior: unknown = null
  const commit = async (input: { operationId: string; expectedRevision: number; indexFingerprint: string; requestFingerprint: string }) => {
    prior = { ownerId: A, operationId: input.operationId, revision: input.expectedRevision + 1,
      indexFingerprint: input.indexFingerprint, requestFingerprint: input.requestFingerprint }
    return { kind: "committed", receipt: prior }
  }
  const repo = { enabled: async () => true, attestationStatus: async () => ({ kind: "ready" }),
    receipt: async () => prior, readIndex: async () => hasPrevious ? index : null, readPart: async (kind: string, id: string) => parts.get(`${kind}:${id}`),
    readAthleteRecords: vi.fn(async () => source), readJournals: async () => [], commit: vi.fn(commit), commitReplan: vi.fn(commit) }
  const handler = createAccountPlanCollectionHandler({ authenticate: async () => ({ ownerId: A, repo }), getMaterial: async () => material, now: () => new Date(now) })
  const request = { ownerId: A, operationId: "c3333333-3333-4333-8333-333333333333", expectedRevision: hasPrevious ? 1 : 0,
    previousIndexFingerprint: hasPrevious ? accountPlanFingerprint(before.index) : null, previousCurrentPlanId: hasPrevious ? before.index.currentPlanId : null,
    index: after.index, legacy: null, ...(mode === "successor" ? { journalGuard: [] } : {}),
    ...(["initial", "successor"].includes(mode) ? { paceRecordGuard: guard } : {}) }
  const call = () => handler(new Request("https://edge.example.test/account-plan-collection", { method: "POST",
    headers: { Authorization: "Bearer synthetic-test", "Content-Type": "application/json" }, body: JSON.stringify({ action: "commit", request }) }))
  return { repo, source, guard, request, call, encrypt, old, updated, handler }
}

it("collection receipt binds the guarded plan, derives the signed guard, and replays before a later source change", async () => {
  const f = await collectionGuardFixture(), response = await f.call()
  expect(await response.clone().json()).toMatchObject({ kind: "committed" }); expect(response.status).toBe(200)
  expect(f.repo.commit).not.toHaveBeenCalled()
  expect(f.repo.commitReplan).toHaveBeenCalledWith(expect.objectContaining({ paceRecordGuard: f.guard, journalGuard: [],
    requestFingerprint: accountPlanFingerprint(f.request) }))
  expect(f.request).not.toHaveProperty("paceRecordGuard")
  f.source.revision = 3; f.source.deleted_at = "2026-10-03T00:00:00Z"
  const replay = await f.call()
  expect(replay.status).toBe(200); expect(await replay.json()).toEqual(await response.json())
  expect(f.repo.readAthleteRecords).toHaveBeenCalledTimes(1)
  expect(f.repo.commitReplan).toHaveBeenCalledTimes(1)
})
it("collection rejects a changed athlete collection before committing any plan", async () => {
  const f = await collectionGuardFixture(); f.source.revision = 3
  const response = await f.call()
  expect(response.status).toBe(409); expect(await response.json()).toEqual({ error: "PACE_RECORD_SOURCE_CHANGED" })
  expect(f.repo.commitReplan).not.toHaveBeenCalled(); expect(f.repo.commit).not.toHaveBeenCalled()
})

it.each(["initial", "successor"] as const)("%s selection validates real references and binds source CAS to the exact request", async mode => {
  const f = await collectionGuardFixture(mode), response = await f.call()
  expect(await response.clone().json()).toMatchObject({ kind: "committed" }); expect(response.status).toBe(200)
  expect(f.repo.commit).not.toHaveBeenCalled()
  expect(f.repo.commitReplan).toHaveBeenCalledWith(expect.objectContaining({ paceRecordGuard: f.guard,
    requestFingerprint: accountPlanFingerprint(f.request) }))
  const signed = f.repo.commitReplan.mock.calls[0]?.[0]
  if (mode === "initial") expect(signed).not.toHaveProperty("journalGuard")
  else expect(signed).toHaveProperty("journalGuard", [])
  f.source.revision = 3; f.source.deleted_at = "2026-10-03T00:00:00Z"
  expect(await (await f.call()).json()).toEqual(await response.json())
  expect(f.repo.readAthleteRecords).toHaveBeenCalledTimes(1)
  expect(f.repo.commitReplan).toHaveBeenCalledTimes(1)
})
it.each(["initial", "successor"] as const)("%s selection rejects a missing source guard and a changed collection revision", async mode => {
  const f = await collectionGuardFixture(mode)
  delete f.request.paceRecordGuard
  expect(await (await f.call()).json()).toEqual({ error: "PACE_RECORD_SOURCE_REQUIRED" })
  f.request.paceRecordGuard = f.guard; f.source.revision = 3
  expect(await (await f.call()).json()).toEqual({ error: "PACE_RECORD_SOURCE_CHANGED" })
  expect(f.repo.commitReplan).not.toHaveBeenCalled(); expect(f.repo.commit).not.toHaveBeenCalled()
})
it.each(["initial", "successor"] as const)("%s selection rejects a record-ID match whose actual snapshot differs", async mode => {
  const f = await collectionGuardFixture(mode)
  f.source.encrypted_payload = await f.encrypt({ ...document(), data: { records: [{ ...f.old, performanceSeconds: 1201 }, f.updated] } }, f.guard.documentId)
  const response = await f.call()
  expect(response.status).toBe(409)
  expect(await response.json()).toEqual({ error: "PACE_RECORD_SOURCE_CHANGED" })
  expect(f.repo.commitReplan).not.toHaveBeenCalled(); expect(f.repo.commit).not.toHaveBeenCalled()
})
it("an initial catalog selection with fiveK null and no pace sources keeps the original commit path and rejects an unrelated source guard", async () => {
  const f = await collectionGuardFixture("no-references")
  f.request.paceRecordGuard = f.guard
  expect(await (await f.call()).json()).toEqual({ error: "INVALID_PACE_RECORD_GUARD_SCOPE" })
  delete f.request.paceRecordGuard
  expect(await (await f.call()).json()).toMatchObject({ kind: "committed" })
  expect(f.repo.readAthleteRecords).not.toHaveBeenCalled()
  expect(f.repo.commitReplan).not.toHaveBeenCalled(); expect(f.repo.commit).toHaveBeenCalledTimes(1)
})
it("ordinary selection scans the actual legacy PACE_TARGET anchor, including adjusted-plan selection storage", async () => {
  const f = await paceGuardFixture(), stored = { ...record(), achievedOn: "2025-12-31" }
  f.decode.mockResolvedValue({ ...document(), data: { records: [stored] } })
  const anchor = { anchorId: stored.id, eventDistanceM: stored.eventDistanceM, performanceSeconds: stored.performanceSeconds,
    achievedAt: stored.achievedOn, kind: "RECENT_RESULT", purpose: "CURRENT_CAPABILITY", seasonId: null,
    enteredBy: stored.enteredBy, verificationState: "SELF_REPORTED", sourceRef: stored.sourceRef }
  const plan = { sessions: [{ prescription: { kind: "PACE_TARGET", selectedAnchor: anchor } }] }
  for (const nextState of [{ version: 3, activePlan: plan }, { version: 4, selection: { activePlan: plan } }]) {
    const input = { ...f.input, nextState, guard: { documentId: f.documentId, revision: 2 } }
    expect(await verifyAccountPlanPaceRecordSources(input)).toEqual({ ok: true, guard: input.guard })
    anchor.performanceSeconds = 999
    expect(await verifyAccountPlanPaceRecordSources(input)).toEqual({ ok: false, code: "PACE_RECORD_SOURCE_CHANGED" })
    anchor.performanceSeconds = stored.performanceSeconds
    expect(await verifyAccountPlanPaceRecordSources({ ...input, guard: undefined })).toEqual({ ok: false, code: "PACE_RECORD_SOURCE_REQUIRED" })
  }
})
it("actual collection API preserves the initial source guard and reports source revision failure as a conflict", async () => {
  const f = await collectionGuardFixture("initial")
  const client = { auth: { getSession: async () => ({ data: { session: { access_token: "synthetic-token", user: { id: A } } }, error: null }) },
    functions: { invoke: async (_name: string, options: { body: unknown; headers: Record<string, string> }) => {
      const response = await f.handler(new Request("https://example.test/account-plan-collection", { method: "POST",
        headers: { ...options.headers, "Content-Type": "application/json" }, body: JSON.stringify(options.body) }))
      return response.ok ? { data: await response.json(), error: null } : { data: null, error: { context: response } }
    } } } as unknown as SupabaseClient
  const api = createAccountPlanCollectionClient(A, () => true, { client: async () => client, owner: () => A })
  f.source.revision = 3
  expect(await api.commit(f.request)).toEqual({ kind: "conflict" })
  expect(f.repo.commitReplan).not.toHaveBeenCalled()
  f.source.revision = 2
  expect(await api.commit(f.request)).toMatchObject({ kind: "committed" })
  expect(f.repo.commitReplan).toHaveBeenCalledWith(expect.objectContaining({ paceRecordGuard: f.guard }))
})
it("catalog replacement cannot introduce a new reference through the unguarded edit protocol", async () => {
  const f = await collectionGuardFixture("catalog-new-source"), response = await f.call()
  expect(response.status).toBe(422)
  expect(await response.json()).toEqual({ error: "PACE_RECORD_SOURCE_REQUIRED" })
  expect(f.repo.readAthleteRecords).not.toHaveBeenCalled()
  expect(f.repo.commitReplan).not.toHaveBeenCalled(); expect(f.repo.commit).not.toHaveBeenCalled()
})
it("catalog replacement retaining the same historical reference does not depend on its live source", async () => {
  const f = await collectionGuardFixture("catalog-same-source")
  f.source.revision = 3; f.source.deleted_at = "2026-10-03T00:00:00Z"
  const response = await f.call()
  expect(await response.clone().json()).toMatchObject({ kind: "committed" }); expect(response.status).toBe(200)
  expect(f.repo.readAthleteRecords).not.toHaveBeenCalled()
  expect(f.repo.commitReplan.mock.calls[0]?.[0]).not.toHaveProperty("paceRecordGuard")
})
it.each(["catalogReplacement", "executionReplan", "activePlanEdit"])("new-source detection for %s preserves unchanged slots, but rejects changed or moved anchors", async receipt => {
  const f = await paceGuardFixture()
  const old = { version: 3, activePlan: { sessions: [f.replacement] } }
  const next = { ...structuredClone(old), [receipt]: {} }
  expect(accountPlanIntroducesPaceRecordSources(old, next)).toBe(false)
  next.activePlan.sessions[0]!.prescription.catalogWorkout.inputs.paceReferences[0]!.performanceSeconds = 999
  expect(accountPlanIntroducesPaceRecordSources(old, next)).toBe(true)
  next.activePlan.sessions = structuredClone(old.activePlan.sessions); next.activePlan.sessions[0]!.day = 3
  expect(accountPlanIntroducesPaceRecordSources(old, next)).toBe(true)
  next.activePlan.sessions = []
  expect(accountPlanIntroducesPaceRecordSources(old, next)).toBe(false)
})
