import { initializeCanonicalJournalFixture } from "../../test/canonical-journal-fixture"
import { webcrypto } from "node:crypto"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { createAccountGoalProgramService, accountGoalProgramEditToken } from "./account-goal-program-service"
import { accountGoalProgramDocumentId, splitAccountGoalProgramCollection, type AccountGoalProgramDocument as Document } from "./account-goal-program-schema"
import { syntheticGoalProgram } from "./account-goal-program.test-fixtures"
import type { AccountJournalConflictBuffer, AccountJournalDraftView, AccountJournalConflictArchive } from "./account-journal-draft-buffer"
import type { AccountJournalRequest, AccountJournalResult } from "./account-journal-api"
import { activePlanBetaStorageKey } from "../plan-beta-store"
import { todayISO } from "../journal-store"
import { generateGoalTrainingProgram } from "../goal-training-program"
import { evaluatePlanSafety } from "../plan-beta-flow"

vi.setConfig({ testTimeout: 30_000 })

const owner = "a1111111-1111-4111-8111-111111111111"
const clone = <T,>(value: T): T => structuredClone(value)
beforeEach(async () => {
  localStorage.clear();
  await initializeCanonicalJournalFixture()
   vi.stubGlobal("crypto", webcrypto)
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(2026, 9, 11, 23, 59))
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

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
      const nextRows = new Map(local), nextArchives = new Map(archives)
      for (const entry of entries) {
        const old = local.get(entry.documentId), replacement = entry.replaceExpiredGoalPending
        if (replacement) {
          if (!old || !old.goalStartDateReviewRequired || old.blocked
            || (old.pending?.operationId ?? null) !== replacement.expectedOperationId
            || old.serverRevision !== replacement.expectedServerRevision || JSON.stringify(old.draft) !== JSON.stringify(replacement.expectedDraft)) throw Error("stale goal replacement")
          const archive: AccountJournalConflictArchive<Document> = { version: 1, choice: "REVIEW", createdAt: new Date().toISOString(),
            localServerRevision: old.serverRevision, localSequence: old.localSequence, remoteRevision: replacement.expectedServerRevision,
            deleted: false, local: clone(old.draft), remote: clone(replacement.remoteDraft), pending: clone(old.pending) }
          nextArchives.set(entry.documentId, [...(archives.get(entry.documentId) ?? []), archive])
        } else if (old?.pending) throw Error("pending batch")
        nextRows.set(entry.documentId, old ? { ...old, draft: clone(entry.draft), localSequence: old.localSequence + 1,
          pending: null, state: "LOCAL_CHANGES", goalStartDateReviewRequired: entry.goalStartDateReviewRequired }
          : { ...initial(entry.documentId, entry.draft), goalStartDateReviewRequired: entry.goalStartDateReviewRequired })
      }
      if (!fresh()) throw Error("stale batch")
      for (const [id, row] of nextRows) local.set(id, row)
      for (const [id, archive] of nextArchives) archives.set(id, archive)
    }),
    read: async (_owner, id) => clone(local.get(id) ?? null),
    list: async () => [...local.values()].map(clone),
    queue: async (_owner, id, operationId) => {
      const row = local.get(id)!
      if (!row.pending) { row.pending = { operationId, expectedRevision: row.serverRevision, sequence: row.localSequence, draft: clone(row.draft),
        ...(row.goalStartDateReviewRequired ? { goalStartDateReviewRequired: row.goalStartDateReviewRequired } : {}) }; row.state = "PENDING" }
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
  const send = vi.fn(async (request: AccountJournalRequest<Document>, isCurrent = () => true): Promise<AccountJournalResult<Document>> => {
    requests.push(clone(request))
    if (!isCurrent()) return { ok: false, code: "STALE_RESPONSE" }
    const stopped = await intercept?.(request)
    if (stopped) return stopped
    if (!isCurrent()) return { ok: false, code: "STALE_RESPONSE" }
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

const historyFor = (old: ReturnType<typeof syntheticGoalProgram>) => ({ version: 1 as const,
  entries: [{ archivedAt: "2026-10-10T01:00:00.000Z", document: old }] })
const expire = () => vi.setSystemTime(new Date(2026, 9, 12, 0, 1))
const newOriginal = { goalStartDateReviewRequired: true as const }

it("blocks a new monthly INDEX after reviewed start date expires during a part await", async () => {
  const f = fixture(), old = syntheticGoalProgram(), next = syntheticGoalProgram(1), service = f.make()
  next.revision = 1
  await f.seed(old); await service.loadHistory()
  const activeKey = activePlanBetaStorageKey(), activeBytes = "SYNTHETIC_ACTIVE_PLAN_BYTES"
  localStorage.setItem(activeKey, activeBytes)
  let release!: () => void, reached!: () => void
  const held = new Promise<void>(done => { release = done }), started = new Promise<void>(done => { reached = done })
  f.intercept(async request => {
    if (request.action === "save" && request.document.kind === "GOAL_PROGRAM_BODY") { reached(); await held }
    return null
  })
  const fresh = () => next.program.window.startDate >= todayISO()
  expect(fresh()).toBe(true)
  const saving = service.save(next, historyFor(old), accountGoalProgramEditToken(service.snapshot()), fresh, newOriginal)
  await started; expire(); expect(fresh()).toBe(false); release()
  expect(await saving).toBe(false)
  expect(localStorage.getItem(activeKey)).toBe(activeBytes)
  expect(f.requests.filter(request => request.action === "save" && request.document.kind === "GOAL_PROGRAM_INDEX")).toHaveLength(0)
  expect(f.remote.get(await accountGoalProgramDocumentId(owner))?.revision).toBe(1)
  expect(service.snapshot()).toMatchObject({ status: "PENDING", document: old, pendingDocument: next })
})

it("does not first-send a pending expired monthly INDEX merely because hydration reopened", async () => {
  const f = fixture(), old = syntheticGoalProgram(), next = syntheticGoalProgram(1), service = f.make()
  next.revision = 1
  await f.seed(old); await service.loadHistory()
  const activeKey = activePlanBetaStorageKey(), activeBytes = "SYNTHETIC_ACTIVE_PLAN_BYTES"
  localStorage.setItem(activeKey, activeBytes)
  f.intercept(async request => request.action === "save" && request.document.kind === "GOAL_PROGRAM_INDEX"
    ? { ok: false, code: "UNAVAILABLE" } : null)
  const fresh = () => next.program.window.startDate >= todayISO()
  expect(await service.save(next, historyFor(old), accountGoalProgramEditToken(service.snapshot()), fresh, newOriginal)).toBe(false)
  const indexId = await accountGoalProgramDocumentId(owner), pendingBefore = clone(f.local.get(indexId)!)
  expect(pendingBefore.goalStartDateReviewRequired).toBe(true)
  expect(pendingBefore.pending?.goalStartDateReviewRequired).toBe(true)
  expect(f.remote.get(indexId)?.revision).toBe(1)
  service.close(); expire(); expect(fresh()).toBe(false); f.intercept(null)
  const countBefore = f.requests.filter(request => request.action === "save").length
  const reopened = f.make()
  expect(await reopened.loadHistory()).toBe(false)
  expect(f.requests.filter(request => request.action === "save").slice(countBefore)).toHaveLength(0)
  expect(f.local.get(indexId)).toEqual(pendingBefore)
  expect(f.remote.get(indexId)?.revision).toBe(1)
  expect(localStorage.getItem(activeKey)).toBe(activeBytes)
  expect(reopened.snapshot()).toMatchObject({ status: "PENDING", document: old, pendingDocument: next })
})

it.each([false, true])("recovers an INDEX committed before expiry through its exact receipt after remote advancement=%s", async advanced => {
  const f = fixture(), old = syntheticGoalProgram(), next = syntheticGoalProgram(1), service = f.make()
  next.revision = 1
  await f.seed(old); await service.loadHistory()
  let loseAck = true
  f.intercept(async request => {
    if (request.action === "save" && request.document.kind === "GOAL_PROGRAM_INDEX" && loseAck) {
      await f.commit(request); return { ok: false, code: "UNAVAILABLE" }
    }
    return null
  })
  const fresh = () => next.program.window.startDate >= todayISO()
  expect(await service.save(next, historyFor(old), accountGoalProgramEditToken(service.snapshot()), fresh, newOriginal)).toBe(false)
  const indexId = await accountGoalProgramDocumentId(owner)
  expect(f.remote.get(indexId)?.revision).toBe(2)
  const first = f.requests.find(request => request.action === "save" && request.document.kind === "GOAL_PROGRAM_INDEX")!
  const later = structuredClone(next)
  if (advanced) {
    later.revision = 2
    const collection = splitAccountGoalProgramCollection(later, historyFor(old))
    for (const part of collection.parts) f.remote.set(await accountGoalProgramDocumentId(owner, part.kind, part.data.id), { document: part, revision: 1 })
    f.remote.set(indexId, { document: collection.index, revision: 3 })
  }
  service.close(); expire(); expect(fresh()).toBe(false); loseAck = false
  const reopened = f.make()
  expect(await reopened.loadHistory()).toBe(true)
  const indexes = f.requests.filter(request => request.action === "save" && request.document.kind === "GOAL_PROGRAM_INDEX")
  expect(indexes).toHaveLength(2)
  expect(indexes[1]).toEqual(first)
  expect(f.remote.get(indexId)?.revision).toBe(advanced ? 3 : 2)
  expect(reopened.snapshot().document).toEqual(advanced ? later : next)
})

it("preserves normal-date automatic retry for a marked initial original without starting a PLAN", async () => {
  const f = fixture(), service = f.make(), next = syntheticGoalProgram()
  await service.loadHistory()
  f.intercept(async request => request.action === "save" && request.document.kind === "GOAL_PROGRAM_INDEX"
    ? { ok: false, code: "UNAVAILABLE" } : null)
  expect(await service.save(next, { version: 1, entries: [] }, accountGoalProgramEditToken(service.snapshot()), () => true, newOriginal)).toBe(false)
  const first = f.requests.find(request => request.action === "save" && request.document.kind === "GOAL_PROGRAM_INDEX")!
  service.close(); f.intercept(null)
  const reopened = f.make()
  expect(await reopened.loadHistory()).toBe(true)
  const indexes = f.requests.filter(request => request.action === "save" && request.document.kind === "GOAL_PROGRAM_INDEX")
  expect(indexes[1]).toEqual(first)
  expect(reopened.snapshot().document).toMatchObject({ application: null, cycles: [{ status: "PENDING" }, { status: "PENDING" }, { status: "PENDING" }] })
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBeNull()
})

it("retains past unstarted backup recovery without treating it as a newly reviewed original", async () => {
  const f = fixture(), service = f.make(), restored = syntheticGoalProgram()
  restored.revision = 1
  await service.loadHistory(); expire()
  expect(await service.save(restored, { version: 1, entries: [] }, accountGoalProgramEditToken(service.snapshot()))).toBe(true)
  const index = f.local.get(await accountGoalProgramDocumentId(owner))!
  expect(index.goalStartDateReviewRequired).toBeUndefined()
  expect(service.snapshot().document).toEqual(restored)
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBeNull()
})

function nextDateOriginal() {
  const original = syntheticGoalProgram(), safety = evaluatePlanSafety("NO_KNOWN_RISK")
  if (safety.kind !== "passed") throw Error("Synthetic safety unavailable")
  const result = generateGoalTrainingProgram({ goalMinutes: 45, dateChoice: { kind: "START", startDate: "2026-10-12" },
    today: todayISO(), generatedAt: new Date().toISOString(), ...original.program.inputs, safetyGate: safety.gate })
  if (result.kind !== "ready") throw Error("Synthetic next date unavailable")
  return { ...original, program: result.program }
}

async function stageExpiredIntent(f: ReturnType<typeof fixture>, hasConfirmed: boolean) {
  const old = syntheticGoalProgram(), pending = syntheticGoalProgram(1)
  if (hasConfirmed) { await f.seed(old); pending.revision = 1 }
  const history = hasConfirmed ? historyFor(old) : { version: 1 as const, entries: [] }
  const collection = splitAccountGoalProgramCollection(pending, history), indexId = await accountGoalProgramDocumentId(owner)
  for (const part of collection.parts) {
    const id = await accountGoalProgramDocumentId(owner, part.kind, part.data.id)
    f.remote.set(id, { document: part, revision: 1 }); await f.buffer.importRemote(owner, id, part, 1)
  }
  if (hasConfirmed) await f.buffer.importRemote(owner, indexId, f.remote.get(indexId)!.document, 1)
  await f.buffer.saveDraftBatch!(owner, [{ documentId: indexId, draft: collection.index, expectedLocalSequence: hasConfirmed ? 1 : 0,
    goalStartDateReviewRequired: true }])
  await f.buffer.queue(owner, indexId, "33333333-3333-4333-8333-333333333333")
  expire()
  return { old, pending, history, indexId }
}

it.each([false, true])("explicitly replaces an expired pending original and preserves its exact history with confirmed base=%s", async hasConfirmed => {
  const f = fixture(), { pending, history, indexId } = await stageExpiredIntent(f, hasConfirmed)
  const reopened = f.make()
  expect(await reopened.loadHistory()).toBe(false)
  const review = reopened.snapshot()
  const pendingBefore = clone(f.local.get(indexId)!), partsBefore = [...f.local].filter(([id]) => id !== indexId).map(clone)
  const readsBeforeBackup = f.requests.length
  expect(await reopened.pendingBackup(review)).toEqual({ document: pending, history })
  expect(f.requests.length).toBe(readsBeforeBackup)
  expect(await reopened.pendingBackup({ ...review, sequence: review.sequence + 1 })).toBeNull()
  const next = nextDateOriginal(); next.revision = hasConfirmed ? 1 : 0
  expect(await reopened.save(next, history, accountGoalProgramEditToken(review), () => true, newOriginal)).toBe(false)
  expect(f.local.get(indexId)).toEqual(pendingBefore)
  expect(await reopened.save(next, history, accountGoalProgramEditToken(review), () => true,
    { ...newOriginal, replaceExpiredPending: true })).toBe(true)
  expect(reopened.snapshot()).toMatchObject({ status: "READY", document: next })
  expect(await f.buffer.readConflictArchive(owner, indexId)).toEqual([expect.objectContaining({ choice: "REVIEW",
    local: pendingBefore.draft, pending: pendingBefore.pending, remote: hasConfirmed ? expect.any(Object) : null })])
  for (const [id, row] of partsBefore) expect(f.local.get(id)).toEqual(row)
  expect(await f.buffer.ack(owner, indexId, pendingBefore.pending!.operationId, hasConfirmed ? 2 : 1)).toBe(false)
  expect(f.remote.get(indexId)?.revision).toBe(hasConfirmed ? 2 : 1)
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBeNull()
})

it("rejects a changed remote base before replacing pending ciphertext or adding parts", async () => {
  const f = fixture(), { pending, history, indexId } = await stageExpiredIntent(f, true), service = f.make()
  expect(await service.loadHistory()).toBe(false)
  const before = clone([...f.local]), batches = vi.mocked(f.buffer.saveDraftBatch!).mock.calls.length
  const remote = f.remote.get(indexId)!
  f.remote.set(indexId, { ...remote, revision: 2 })
  const next = nextDateOriginal(); next.revision = 1
  expect(await service.save(next, history, accountGoalProgramEditToken(service.snapshot()), () => true,
    { ...newOriginal, replaceExpiredPending: true })).toBe(false)
  expect([...f.local]).toEqual(before)
  expect(f.archives.size).toBe(0)
  expect(vi.mocked(f.buffer.saveDraftBatch!).mock.calls.length).toBe(batches)
  expect(service.snapshot().pendingDocument).toEqual(pending)
})
