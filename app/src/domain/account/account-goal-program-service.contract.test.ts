import { webcrypto } from "node:crypto"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { createAccountGoalProgramService, accountGoalProgramEditToken } from "./account-goal-program-service"
import { accountGoalProgramDocumentId, splitAccountGoalProgramCollection, type AccountGoalProgramDocument as Document } from "./account-goal-program-schema"
import { syntheticGoalProgram } from "./account-goal-program.test-fixtures"
import type { AccountJournalConflictBuffer, AccountJournalDraftView, AccountJournalConflictArchive } from "./account-journal-draft-buffer"
import type { AccountJournalRequest, AccountJournalResult } from "./account-journal-api"

vi.setConfig({ testTimeout: 30_000 })

const owner = "a1111111-1111-4111-8111-111111111111"
const clone = <T,>(value: T): T => structuredClone(value)
beforeEach(() => { localStorage.clear(); vi.stubGlobal("crypto", webcrypto) })
afterEach(() => vi.unstubAllGlobals())

/** Protocol fixture, not evidence of native IndexedDB atomicity (tested separately). */
function fixture() {
  let current = true
  const local = new Map<string, AccountJournalDraftView<Document>>()
  const archives = new Map<string, AccountJournalConflictArchive<Document>[]>()
  const remote = new Map<string, { document: Document; revision: number }>()
  const receipts = new Map<string, AccountJournalResult<Document>>()
  const requests: AccountJournalRequest<Document>[] = []
  let intercept: ((request: AccountJournalRequest<Document>) => Promise<AccountJournalResult<Document> | null>) | null = null
  const initial = (documentId: string, draft: Document, revision = 0): AccountJournalDraftView<Document> => ({
    ownerId: owner, documentId, draft: clone(draft), serverRevision: revision, localSequence: 1,
    acknowledgedSequence: revision ? 1 : 0, state: revision ? "DRAFT_ACKNOWLEDGED" : "LOCAL_CHANGES",
    pending: null, blocked: null, remoteDraft: null,
  })
  const buffer: AccountJournalConflictBuffer<Document> = {
    saveDraft: async (_owner, id, draft, sequence) => {
      const before = local.get(id)
      if (sequence !== undefined && sequence !== (before?.localSequence ?? 0)) throw Error("stale draft")
      local.set(id, before ? { ...before, draft: clone(draft), localSequence: before.localSequence + 1, state: "LOCAL_CHANGES" } : initial(id, draft))
    },
    saveDraftBatch: vi.fn(async (_owner, entries, fresh = () => true) => {
      if (!fresh()) throw Error("stale batch")
      for (const entry of entries) if (entry.expectedLocalSequence !== (local.get(entry.documentId)?.localSequence ?? 0)) throw Error("stale batch")
      if (!fresh()) throw Error("stale batch")
      for (const entry of entries) await buffer.saveDraft(owner, entry.documentId, entry.draft, entry.expectedLocalSequence)
    }),
    read: async (_owner, id) => clone(local.get(id) ?? null),
    list: async () => [...local.values()].map(clone),
    queue: async (_owner, id, operationId) => {
      const row = local.get(id)!
      if (!row.pending) { row.pending = { operationId, expectedRevision: row.serverRevision, sequence: row.localSequence, draft: clone(row.draft) }; row.state = "PENDING" }
    },
    ack: vi.fn(async (_owner, id, operationId, revision) => {
      const row = local.get(id)!
      const pending = row.pending
      if (!pending || pending.operationId !== operationId) return false
      row.serverRevision = revision; row.acknowledgedSequence = pending.sequence; row.pending = null
      row.state = row.localSequence === row.acknowledgedSequence ? "DRAFT_ACKNOWLEDGED" : "LOCAL_CHANGES"
      return true
    }),
    conflict: async (_owner, id, operationId, currentRevision) => {
      const row = local.get(id)!
      if (row.pending?.operationId !== operationId) return false
      row.blocked = { kind: "RECEIPT", operationId, currentRevision }; row.state = "CONFLICT"; return true
    },
    importRemote: async (_owner, id, draft, revision) => {
      const row = local.get(id)
      if (row && row.state !== "DRAFT_ACKNOWLEDGED") return "CONFLICT"
      local.set(id, initial(id, draft, revision)); return "IMPORTED"
    },
    captureConflict: async (_owner, id, draft, revision, sequence, fresh = () => true) => {
      const row = local.get(id)!
      if (!fresh() || row.localSequence !== sequence) throw Error("stale conflict")
      row.blocked = { kind: "REMOTE", operationId: null, currentRevision: revision }; row.remoteDraft = clone(draft); row.state = "CONFLICT"
    },
    resolveConflict: async (_owner, id, choice, revision, sequence, fresh = () => true) => {
      const row = local.get(id)!
      if (!fresh() || row.localSequence !== sequence || choice !== "REMOTE" || !row.remoteDraft) throw Error("stale resolution")
      const entry: AccountJournalConflictArchive<Document> = { version: 1, createdAt: "2026-10-10T01:00:00.000Z",
        localServerRevision: row.serverRevision, localSequence: sequence, remoteRevision: revision, deleted: false,
        local: clone(row.draft), remote: clone(row.remoteDraft), pending: clone(row.pending), choice }
      archives.set(id, [...(archives.get(id) ?? []), entry]); local.set(id, initial(id, row.remoteDraft, revision))
    },
    acceptCleanDeletion: async () => { throw Error("not used") },
    readConflictArchive: async (_owner, id) => clone(archives.get(id) ?? []),
    clear: async () => false, close: vi.fn(), logout: vi.fn(),
  }
  async function commit(request: Extract<AccountJournalRequest<Document>, { action: "save" }>): Promise<AccountJournalResult<Document>> {
    const receipt = receipts.get(request.operationId)
    if (receipt) return clone(receipt)
    const old = remote.get(request.documentId), revision = old?.revision ?? 0
    const result: AccountJournalResult<Document> = revision !== request.expectedRevision
      ? { ok: true, data: { kind: "conflict", documentId: request.documentId, operationId: request.operationId, currentRevision: revision } }
      : { ok: true, data: { kind: "saved", documentId: request.documentId, operationId: request.operationId, revision: revision + 1 } }
    if (revision === request.expectedRevision) remote.set(request.documentId, { document: clone(request.document), revision: revision + 1 })
    receipts.set(request.operationId, result); return clone(result)
  }
  const send = vi.fn(async (request: AccountJournalRequest<Document>): Promise<AccountJournalResult<Document>> => {
    requests.push(clone(request))
    const stopped = await intercept?.(request)
    if (stopped) return stopped
    if (request.action === "goalProgramSupport") return { ok: true, data: { kind: "goal-program-support", version: 1 } }
    if (request.action === "read") {
      const row = remote.get(request.documentId)
      return row ? { ok: true, data: { kind: "document", documentId: request.documentId, ...clone(row) } } : { ok: false, code: "NOT_FOUND" }
    }
    if (request.action === "save") return commit(request)
    throw Error("Unexpected mutation")
  })
  const make = () => createAccountGoalProgramService(owner, vi.fn(), { buffer, send, isOwner: () => current, exclusive: work => work() })
  async function seed(document = syntheticGoalProgram()) {
    const collection = splitAccountGoalProgramCollection(document, { version: 1, entries: [] })
    for (const part of collection.parts) remote.set(await accountGoalProgramDocumentId(owner, part.kind, part.data.id), { document: part, revision: 1 })
    remote.set(await accountGoalProgramDocumentId(owner), { document: collection.index, revision: 1 }); return collection
  }
  return { make, buffer, local, remote, requests, commit, seed, archives,
    intercept: (callback: typeof intercept) => { intercept = callback }, changeOwner: () => { current = false } }
}

it("publishes only verified account bytes after immutable parts and singleton index CAS", async () => {
  const f = fixture(), service = f.make(), document = syntheticGoalProgram()
  expect(await service.loadHistory()).toBe(true)
  expect(service.snapshot().status).toBe("EMPTY")
  expect(await service.save(document, { version: 1, entries: [] }, accountGoalProgramEditToken(service.snapshot()))).toBe(true)
  const writes = f.requests.filter(request => request.action === "save")
  expect(writes.map(request => request.document.kind)).toEqual(["GOAL_PROGRAM_BODY", "GOAL_PROGRAM_PROGRESS", "GOAL_PROGRAM_INDEX"])
  expect(writes.map(request => request.expectedRevision)).toEqual([0, 0, 0])
  expect(service.snapshot()).toMatchObject({ status: "READY", revision: 1, historyLoaded: true, document, pendingDocument: null })
  expect(f.buffer.saveDraftBatch).toHaveBeenCalledOnce()
})

it("retains the entire durable intent when a part ACK is lost, then replays the same operation after reopen", async () => {
  const f = fixture(), service = f.make(), document = syntheticGoalProgram()
  await service.loadHistory()
  let fail = true
  f.intercept(async request => {
    if (request.action === "save" && request.document.kind === "GOAL_PROGRAM_BODY") {
      await f.commit(request)
      if (fail) return { ok: false, code: "UNAVAILABLE" }
    }
    return null
  })
  expect(await service.save(document, { version: 1, entries: [] }, accountGoalProgramEditToken(service.snapshot()))).toBe(false)
  expect(service.snapshot()).toMatchObject({ status: "PENDING", document: null, pendingDocument: document })
  expect(f.local.size).toBe(3)
  expect(f.requests.filter(request => request.action === "save").map(request => request.document.kind)).toEqual(["GOAL_PROGRAM_BODY"])
  const first = f.requests.find(request => request.action === "save")!
  expect(first.action).toBe("save")
  service.close(); fail = false
  const reopened = f.make()
  expect(await reopened.loadHistory()).toBe(true)
  const bodies = f.requests.filter(request => request.action === "save" && request.document.kind === "GOAL_PROGRAM_BODY")
  expect(bodies).toHaveLength(2)
  expect(bodies[1]).toEqual(bodies[0])
  expect(reopened.snapshot()).toMatchObject({ status: "READY", document, pendingDocument: null })
  expect([...f.remote.values()].map(row => row.revision)).toEqual([1, 1, 1])
})

it("keeps the previously confirmed program visible when index CAS has not been acknowledged", async () => {
  const f = fixture(), old = syntheticGoalProgram(), next = syntheticGoalProgram(1), service = f.make()
  next.revision = 1
  await f.seed(old); await service.loadHistory()
  f.intercept(async request => request.action === "save" && request.document.kind === "GOAL_PROGRAM_INDEX" ? { ok: false, code: "UNAVAILABLE" } : null)
  const history = { version: 1 as const, entries: [{ archivedAt: "2026-10-10T01:00:00.000Z", document: old }] }
  expect(await service.save(next, history, accountGoalProgramEditToken(service.snapshot()))).toBe(false)
  expect(service.snapshot()).toMatchObject({ status: "PENDING", document: old, pendingDocument: next })
  f.intercept(null)
  expect(await service.loadHistory()).toBe(true)
  expect(service.snapshot()).toMatchObject({ status: "READY", revision: 2, document: next, history })
})

it("refuses a late part ACK after owner switch without clearing ciphertext or submitting the index", async () => {
  const f = fixture(), service = f.make()
  await service.loadHistory()
  f.intercept(async request => {
    if (request.action !== "save") return null
    const result = await f.commit(request); f.changeOwner(); return result
  })
  expect(await service.save(syntheticGoalProgram(), { version: 1, entries: [] }, accountGoalProgramEditToken(service.snapshot()))).toBe(false)
  expect(f.buffer.ack).not.toHaveBeenCalled()
  expect(f.local.size).toBe(3)
  expect([...f.local.values()].find(row => row.draft.kind === "GOAL_PROGRAM_BODY")?.pending).not.toBeNull()
  expect(service.snapshot()).toMatchObject({ status: "FAILED", document: null, pendingDocument: null })
  expect(f.requests.filter(request => request.action === "save")).toHaveLength(1)
})

it("requires successful capability reading and never constructs an empty/local fallback for unknown account documents", async () => {
  const f = fixture(), service = f.make()
  f.intercept(async request => request.action === "goalProgramSupport" ? { ok: false, code: "GOAL_PROGRAM_UNSUPPORTED" } : null)
  expect(await service.loadHistory()).toBe(false)
  expect(service.snapshot().status).toBe("UNSUPPORTED")
  expect(f.requests.map(request => request.action)).toEqual(["goalProgramSupport"])
  f.intercept(null)
  f.remote.set(await accountGoalProgramDocumentId(owner), { document: { version: 4 } as unknown as Document, revision: 1 })
  expect(await service.loadHistory()).toBe(false)
  expect(service.snapshot().status).toBe("UPGRADE_REQUIRED")
  expect(await service.save(syntheticGoalProgram(), { version: 1, entries: [] }, accountGoalProgramEditToken(service.snapshot()))).toBe(false)
  expect(f.buffer.saveDraftBatch).not.toHaveBeenCalled()
})

it("blocks missing references and a stale edit token without any draft or remote write", async () => {
  const f = fixture(), service = f.make(), collection = await f.seed()
  f.remote.delete(await accountGoalProgramDocumentId(owner, collection.parts[1]!.kind, collection.parts[1]!.data.id))
  expect(await service.loadHistory()).toBe(false)
  expect(service.snapshot().status).toBe("FAILED")
  await f.seed(); await service.loadHistory()
  expect(await service.save(syntheticGoalProgram(), { version: 1, entries: [] }, "stale-token")).toBe(false)
  expect(f.buffer.saveDraftBatch).not.toHaveBeenCalled()
  expect(f.requests.some(request => request.action === "save")).toBe(false)
})

it("does not substitute non-atomic single saves for a missing native batch implementation", async () => {
  const f = fixture(), service = f.make()
  await service.loadHistory(); f.buffer.saveDraftBatch = undefined
  expect(await service.save(syntheticGoalProgram(), { version: 1, entries: [] }, accountGoalProgramEditToken(service.snapshot()))).toBe(false)
  expect(service.snapshot().status).toBe("FAILED")
  expect(f.local.size).toBe(0)
  expect(f.requests.some(request => request.action === "save")).toBe(false)
})

it("captures a competing index and accepts only explicitly reviewed remote bytes, retaining both versions", async () => {
  const f = fixture(), service = f.make(), old = syntheticGoalProgram(), next = syntheticGoalProgram(1), other = syntheticGoalProgram(2)
  next.revision = 1
  await f.seed(old); await service.loadHistory()
  f.intercept(async request => {
    if (request.action === "save" && request.document.kind === "GOAL_PROGRAM_INDEX") { await f.seed(other); const row = f.remote.get(request.documentId)!; row.revision = 2 }
    return null
  })
  const history = { version: 1 as const, entries: [{ archivedAt: "2026-10-10T01:00:00.000Z", document: old }] }
  expect(await service.save(next, history, accountGoalProgramEditToken(service.snapshot()))).toBe(false)
  const review = service.snapshot()
  expect(review).toMatchObject({ status: "CONFLICT", document: other, pendingDocument: next, remoteRevision: 2 })
  expect(await service.pendingBackup({ ...review, ownerId: "b2222222-2222-4222-8222-222222222222" })).toBeNull()
  expect(await service.acceptRemote({ ...review, sessionGeneration: review.sessionGeneration + 1 })).toBe(false)
  expect(await service.acceptRemote({ ...review, sequence: review.sequence + 1 })).toBe(false)
  expect(await service.pendingBackup(review)).toEqual({ document: next, history })
  expect(await service.acceptRemote(review)).toBe(true)
  expect(service.snapshot()).toMatchObject({ status: "READY", document: other, pendingDocument: null })
  const archived = await f.buffer.readConflictArchive(owner, await accountGoalProgramDocumentId(owner))
  expect(archived).toHaveLength(1)
  expect(archived[0]?.local.kind).toBe("GOAL_PROGRAM_INDEX")
  expect(archived[0]?.remote?.kind).toBe("GOAL_PROGRAM_INDEX")
  expect(archived[0]?.pending?.operationId).toBeTruthy()
})
