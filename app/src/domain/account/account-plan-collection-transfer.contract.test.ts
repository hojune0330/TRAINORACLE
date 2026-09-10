import { beforeEach, afterEach, expect, it, vi } from "vitest"
import { TODAY } from "../prescription-quality-matrix.test-fixtures"
import { accountPlanPacketFixture } from "./account-plan.test-fixtures"
import { accountPlanEntry, accountPlanFingerprint, emptyAccountPlanDocument, type AccountPlanDocument } from "./account-plan-document-schema"
import { joinAccountPlanCollection, splitAccountPlanCollection, type AccountPlanCollectionParts } from "./account-plan-collection-schema"
import { accountPlanCollectionCommit, prepareAccountPlanCollectionTransfer, readAccountPlanCollectionTransfer,
  transferAccountPlanCollection, type AccountPlanCollectionPort, type AccountPlanCollectionReceipt,
  type AccountPlanCollectionScope, type AccountPlanCollectionTransfer } from "./account-plan-collection-transfer"

const OWNER = "11111111-1111-4111-8111-111111111111", OTHER = "22222222-2222-4222-8222-222222222222"
const OP = "33333333-3333-4333-8333-333333333333", OP2 = "44444444-4444-4444-8444-444444444444"
const LEGACY = "55555555-5555-4555-8555-555555555555"
beforeEach(() => { localStorage.clear(); vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(TODAY.getTime() + 120_000)) })
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

function document(count = 1, version: 3 | 4 | 5 | 6 = 3) {
  const result = emptyAccountPlanDocument()
  for (let i = 0; i < count; i++) {
    localStorage.clear()
    const entry = accountPlanEntry(accountPlanPacketFixture(version, new Date(TODAY.getTime() + i * 1000)))
    if (i < count - 1) entry.archivedAt = new Date().toISOString()
    result.data.plans.push(entry)
  }
  result.data.currentPlanId = result.data.plans.at(-1)?.planId ?? null
  return result
}
function prepared(next = document(), previous: AccountPlanDocument | null = null, operationId = OP) {
  const transfer = prepareAccountPlanCollectionTransfer({ ownerId: OWNER, operationId, expectedRevision: previous ? 1 : 0, previous, next })
  expect(transfer).not.toBeNull()
  return transfer!
}

/** Protocol double only. This is not SQL atomicity, encryption, or JWT evidence. */
function repository(previous: AccountPlanCollectionParts | null = null) {
  const parts = new Map<string, unknown>(), receipts = new Map<string, AccountPlanCollectionReceipt>()
  const indices = new Map<string, { revision: number; parts: AccountPlanCollectionParts }>()
  const address = (owner: string, kind: string, id: string) => `${owner}:${kind}:${id}`
  if (previous) {
    for (const part of [...previous.snapshots, ...previous.progress]) parts.set(address(OWNER, part.kind, part.id), structuredClone(part))
    indices.set(OWNER, { revision: 1, parts: structuredClone(previous) })
  }
  const port: AccountPlanCollectionPort = {
    receipt: vi.fn(async (owner, operation) => structuredClone(receipts.get(`${owner}:${operation}`) ?? null)),
    stage: vi.fn(async (owner, part) => {
      const key = address(owner, part.kind, part.id), existing = parts.get(key)
      if (existing && accountPlanFingerprint(existing) !== accountPlanFingerprint(part)) throw Error("immutable part")
      parts.set(key, structuredClone(part))
    }),
    readPart: vi.fn(async (owner, kind, id) => structuredClone(parts.get(address(owner, kind, id)) ?? null)),
    commit: vi.fn<AccountPlanCollectionPort["commit"]>(async request => {
      const key = `${request.ownerId}:${request.operationId}`, oldReceipt = receipts.get(key)
      if (oldReceipt) {
        if (oldReceipt.requestFingerprint !== accountPlanFingerprint(request)) throw Error("operation reuse")
        return { kind: "committed", receipt: structuredClone(oldReceipt) }
      }
      const old = indices.get(request.ownerId)
      if ((old?.revision ?? 0) !== request.expectedRevision
        || (old ? accountPlanFingerprint(old.parts.index) : null) !== request.previousIndexFingerprint
        || (old?.parts.index.currentPlanId ?? null) !== request.previousCurrentPlanId) return { kind: "conflict" }
      const collection = { index: request.index,
        snapshots: request.index.plans.map(ref => parts.get(address(request.ownerId, "PLAN_SNAPSHOT", ref.snapshotId))),
        progress: request.index.plans.map(ref => parts.get(address(request.ownerId, "PLAN_PROGRESS", ref.progressId))) }
      if (!joinAccountPlanCollection(collection)) throw Error("missing/corrupt reference")
      const receipt = { ownerId: request.ownerId, operationId: request.operationId, revision: request.expectedRevision + 1,
        indexFingerprint: accountPlanFingerprint(request.index), requestFingerprint: accountPlanFingerprint(request) }
      indices.set(request.ownerId, { revision: receipt.revision, parts: structuredClone(collection) as AccountPlanCollectionParts })
      receipts.set(key, receipt)
      return { kind: "committed", receipt: structuredClone(receipt) }
    }),
  }
  return { port, parts, indices, receipts }
}
function run(transfer: AccountPlanCollectionTransfer, port: AccountPlanCollectionPort, overrides: Partial<Parameters<typeof transferAccountPlanCollection>[0]> = {}) {
  return transferAccountPlanCollection({ transfer, port, scope: () => ({ ownerId: OWNER, epoch: 1 }), freshSelectionReview: () => true, ...overrides })
}

it("copies and reads back before committing an exact current pointer; transferred evidence remains data", async () => {
  const source = document(2), transfer = prepared(source), server = repository()
  expect((await run(transfer, server.port)).kind).toBe("committed")
  expect(server.port.stage).toHaveBeenCalledTimes(4)
  expect(joinAccountPlanCollection(server.indices.get(OWNER)!.parts)).toEqual(source)
  expect(server.indices.get(OWNER)!.revision).toBe(1)
  expect(server.indices.has(OTHER)).toBe(false)
  expect(source).toEqual(document(2))
})

it.each([4, 5, 6] as const)("transfers 18 actual V%s frames without a monolithic upload or truncation", async version => {
  const source = document(18, version), server = repository()
  expect((await run(prepared(source), server.port)).kind).toBe("committed")
  expect(joinAccountPlanCollection(server.indices.get(OWNER)!.parts)).toEqual(source)
  expect(server.port.stage).toHaveBeenCalledTimes(36)
  for (const [, part] of vi.mocked(server.port.stage).mock.calls) {
    expect(new TextEncoder().encode(JSON.stringify(part)).byteLength).toBeLessThanOrEqual(500_000)
  }
}, 120_000)

it("captures caller input before an authentication wait", async () => {
  const transfer = prepared(), before = structuredClone(transfer), server = repository()
  let release!: () => void
  vi.mocked(server.port.receipt).mockImplementationOnce(async () => { await new Promise<void>(resolve => { release = resolve }); return null })
  const pending = run(transfer, server.port)
  transfer.next.index.currentPlanId = null
  transfer.next.snapshots.length = 0
  release()
  expect((await pending).kind).toBe("committed")
  expect(server.indices.get(OWNER)!.parts).toEqual(before.next)
})

it("an interrupted stage leaves the current pointer and every original intact; retry reuses staged parts", async () => {
  const before = document(), next = document(2), transfer = prepared(next, before), server = repository(splitAccountPlanCollection(before))
  const stage = server.port.stage
  server.port.stage = vi.fn(async (owner, part) => { await stage(owner, part); throw Error("network") })
  expect((await run(transfer, server.port)).kind).toBe("unavailable")
  expect(server.indices.get(OWNER)!.revision).toBe(1)
  expect(joinAccountPlanCollection(server.indices.get(OWNER)!.parts)).toEqual(before)
  expect(server.port.commit).not.toHaveBeenCalled()
  server.port.stage = stage
  expect((await run(transfer, server.port)).kind).toBe("committed")
  expect(joinAccountPlanCollection(server.indices.get(OWNER)!.parts)).toEqual(next)
})

it("a lost commit response is outcome_unknown and the exact operation receipt recovers it once", async () => {
  const transfer = prepared(), server = repository(), commit = server.port.commit
  server.port.commit = vi.fn(async request => { await commit(request); throw Error("lost response") })
  expect((await run(transfer, server.port)).kind).toBe("outcome_unknown")
  expect(server.indices.get(OWNER)!.revision).toBe(1)
  expect((await run(transfer, server.port, { freshSelectionReview: () => false })).kind).toBe("committed")
  expect(server.port.commit).toHaveBeenCalledTimes(1)
  expect(server.indices.get(OWNER)!.revision).toBe(1)
})

it("lost ACK followed by unavailable receipt lookup stays outcome_unknown", async () => {
  const transfer = prepared(), server = repository(), commit = server.port.commit
  server.port.commit = vi.fn(async request => { await commit(request); throw Error("lost response") })
  expect((await run(transfer, server.port)).kind).toBe("outcome_unknown")
  vi.mocked(server.port.receipt).mockRejectedValueOnce(Error("offline receipt lookup"))
  expect((await run(transfer, server.port)).kind).toBe("outcome_unknown")
  expect(server.indices.get(OWNER)!.revision).toBe(1)
  expect(server.port.commit).toHaveBeenCalledTimes(1)
  expect((await run(transfer, server.port)).kind).toBe("committed")
})

it("adapter mutation cannot change the frozen retry request or produce a false ACK", async () => {
  const transfer = prepared(), before = structuredClone(transfer), server = repository(), stage = server.port.stage
  server.port.stage = vi.fn(async (owner, part) => { await stage(owner, part); part.planId = accountPlanFingerprint({}) })
  server.port.commit = vi.fn(async request => {
    request.index.currentPlanId = null
    return { kind: "committed" as const, receipt: { ownerId: OWNER, operationId: OP, revision: 1,
      indexFingerprint: accountPlanFingerprint(request.index), requestFingerprint: accountPlanFingerprint(request) } }
  })
  expect((await run(transfer, server.port)).kind).toBe("outcome_unknown")
  expect(transfer).toEqual(before)
  expect(server.port.stage).toHaveBeenCalledTimes(2)
})

it("two devices cannot overwrite each other's pointer at the same revision", async () => {
  const before = document(), server = repository(splitAccountPlanCollection(before))
  const a = prepared(document(2), before), b = prepared(document(3), before, OP2)
  expect((await run(a, server.port)).kind).toBe("committed")
  const confirmed = structuredClone(server.indices.get(OWNER))
  expect((await run(b, server.port)).kind).toBe("conflict")
  expect(server.indices.get(OWNER)).toEqual(confirmed)
})

it.each(["wrong owner", "wrong operation", "wrong revision", "wrong index", "wrong request"])("rejects %s receipt instead of manufacturing a successful account save", async mutation => {
  const transfer = prepared(), request = accountPlanCollectionCommit(transfer), server = repository()
  const receipt: AccountPlanCollectionReceipt = { ownerId: OWNER, operationId: OP, revision: 1,
    indexFingerprint: accountPlanFingerprint(transfer.next.index), requestFingerprint: accountPlanFingerprint(request) }
  if (mutation === "wrong owner") receipt.ownerId = OTHER
  if (mutation === "wrong operation") receipt.operationId = OP2
  if (mutation === "wrong revision") receipt.revision = 2
  if (mutation === "wrong index") receipt.indexFingerprint = accountPlanFingerprint({})
  if (mutation === "wrong request") receipt.requestFingerprint = accountPlanFingerprint({})
  vi.mocked(server.port.receipt).mockResolvedValueOnce(receipt)
  expect((await run(transfer, server.port)).kind).toBe("invalid")
  expect(server.port.stage).not.toHaveBeenCalled()
  expect(server.port.commit).not.toHaveBeenCalled()
})

it("A-B-A account changes during a read stop the old transfer even after A returns", async () => {
  const server = repository(), transfer = prepared()
  let scope: AccountPlanCollectionScope = { ownerId: OWNER, epoch: 1 }
  vi.mocked(server.port.readPart).mockImplementationOnce(async () => {
    scope = { ownerId: OTHER, epoch: 2 }; scope = { ownerId: OWNER, epoch: 3 }; return null
  })
  expect((await run(transfer, server.port, { scope: () => scope })).kind).toBe("stale")
  expect(server.port.stage).not.toHaveBeenCalled()
  expect(server.port.commit).not.toHaveBeenCalled()
})

it("scope change during the review callback cannot commit for the previous account", async () => {
  const server = repository(), transfer = prepared()
  let scope: AccountPlanCollectionScope = { ownerId: OWNER, epoch: 1 }, reviews = 0
  expect((await run(transfer, server.port, { scope: () => scope, freshSelectionReview: () => {
    if (++reviews === 2) scope = { ownerId: OTHER, epoch: 2 }
    return true
  } })).kind).toBe("stale")
  expect(server.port.commit).not.toHaveBeenCalled()
})

it("failed or expired selection review cannot activate a staged plan", async () => {
  const server = repository(), transfer = prepared()
  expect((await run(transfer, server.port, { freshSelectionReview: () => false })).kind).toBe("review_required")
  expect(server.port.stage).not.toHaveBeenCalled()
  let reviews = 0
  expect((await run(transfer, server.port, { freshSelectionReview: () => ++reviews === 1 })).kind).toBe("review_required")
  expect(server.port.stage).toHaveBeenCalledTimes(2)
  expect(server.port.commit).not.toHaveBeenCalled()
})

it("mismatched read-back never publishes a collection and never repairs by overwriting the source", async () => {
  const server = repository()
  vi.mocked(server.port.readPart).mockResolvedValueOnce({ version: 1, kind: "PLAN_SNAPSHOT" })
  expect((await run(prepared(), server.port)).kind).toBe("invalid")
  expect(server.port.stage).not.toHaveBeenCalled()
  expect(server.port.commit).not.toHaveBeenCalled()
})

it("progress-only updates reuse immutable snapshots and do not require a new plan selection", async () => {
  const before = document(), next = structuredClone(before), server = repository(splitAccountPlanCollection(before))
  const entry = next.data.plans[0]!, packet = entry.snapshot.state
  const session = (packet.version === 2 || packet.version === 3 ? packet.activePlan : packet.selection.activePlan).sessions[0]!
  entry.progress = [{ sessionDay: session.day, sessionSlot: session.slot, state: "COMPLETED" }]
  expect((await run(prepared(next, before), server.port, { freshSelectionReview: () => false })).kind).toBe("committed")
  expect(server.port.stage).toHaveBeenCalledTimes(1)
  expect(vi.mocked(server.port.stage).mock.calls[0]![1].kind).toBe("PLAN_PROGRESS")
  expect(joinAccountPlanCollection(server.indices.get(OWNER)!.parts)).toEqual(next)
})

it("legacy migration copies exactly and carries its original revision without deleting anything", async () => {
  const source = document(), before = structuredClone(source)
  const transfer = prepareAccountPlanCollectionTransfer({ ownerId: OWNER, operationId: OP, expectedRevision: 0, previous: null,
    next: source, legacy: { documentId: LEGACY, revision: 7, document: source } })!
  expect(transfer).not.toBeNull()
  const server = repository()
  expect((await run(transfer, server.port, { freshSelectionReview: () => false })).kind).toBe("committed")
  expect(vi.mocked(server.port.commit).mock.calls[0]![0].legacy).toEqual({ documentId: LEGACY, revision: 7, fingerprint: accountPlanFingerprint(before) })
  expect(source).toEqual(before)
  const changed = structuredClone(source); changed.data.currentPlanId = null
  expect(prepareAccountPlanCollectionTransfer({ ownerId: OWNER, operationId: OP, expectedRevision: 0, previous: null,
    next: changed, legacy: { documentId: LEGACY, revision: 7, document: source } })).toBeNull()
})

it("complete rehash cannot delete historical originals, rewrite an archive, or switch without archiving", () => {
  const before = document(2), removed = structuredClone(before)
  removed.data.plans.shift()
  expect(prepareAccountPlanCollectionTransfer({ ownerId: OWNER, operationId: OP, expectedRevision: 1, previous: before, next: removed })).toBeNull()
  const rewritten = structuredClone(before)
  rewritten.data.plans[0]!.archivedAt = null
  expect(prepareAccountPlanCollectionTransfer({ ownerId: OWNER, operationId: OP, expectedRevision: 1, previous: before, next: rewritten })).toBeNull()
  const switched = document(3); switched.data.plans[1]!.archivedAt = null
  expect(prepareAccountPlanCollectionTransfer({ ownerId: OWNER, operationId: OP, expectedRevision: 1, previous: before, next: switched })).toBeNull()
})

it("invalid persisted operations and revision baselines are rejected before IO", async () => {
  const transfer = prepared(), server = repository()
  expect(readAccountPlanCollectionTransfer({ ...transfer, expectedRevision: 1 })).toBeNull()
  const omittedPrevious: Record<string, unknown> = { ...transfer, expectedRevision: 1 }
  delete omittedPrevious.previous
  expect(readAccountPlanCollectionTransfer(omittedPrevious)).toBeNull()
  expect(readAccountPlanCollectionTransfer({ ...transfer, operationId: "not-a-uuid" })).toBeNull()
  expect(readAccountPlanCollectionTransfer({ ...transfer, surprise: true })).toBeNull()
  expect((await run({ ...transfer, expectedRevision: 1 }, server.port)).kind).toBe("invalid")
  expect(server.port.receipt).not.toHaveBeenCalled()
})
