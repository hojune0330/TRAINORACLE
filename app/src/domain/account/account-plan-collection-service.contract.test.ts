import { webcrypto } from "node:crypto"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { TODAY } from "../prescription-quality-matrix.test-fixtures"
import { accountPlanPacketFixture } from "./account-plan.test-fixtures"
import { accountPlanEntry, accountPlanFingerprint, emptyAccountPlanDocument, materializeAccountPlan } from "./account-plan-document-schema"
import { createAccountPlanCollectionService, type AccountPlanCollectionServiceInput } from "./account-plan-collection-service"
import { COLLECTION_OWNER, collectionMemoryBuffers, collectionServer } from "./account-plan-collection.test-support"

beforeEach(() => { vi.stubGlobal("crypto", webcrypto); localStorage.clear(); vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(TODAY.getTime() + 120_000)) })
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
const tick = async () => { await new Promise<void>(resolve => setTimeout(resolve, 0)) }
function fixture(count = 3, version: 3 | 4 | 5 | 6 = 3) {
  const doc = emptyAccountPlanDocument()
  for (let i = 0; i < count; i++) {
    localStorage.clear()
    const entry = accountPlanEntry(accountPlanPacketFixture(version, new Date(TODAY.getTime() + i * 1000)))
    if (i < count - 1) entry.archivedAt = new Date().toISOString()
    doc.data.plans.push(entry)
  }
  doc.data.currentPlanId = doc.data.plans.at(-1)?.planId ?? null
  return doc
}
function setup(server = collectionServer(), extra: Partial<AccountPlanCollectionServiceInput> = {}, stores = collectionMemoryBuffers()) {
  const service = createAccountPlanCollectionService({ ownerId: COLLECTION_OWNER, isCurrent: () => true,
    client: server.client, buffers: stores.dependencies, legacyBuffer: stores.legacy.buffer, yieldTask: tick, ...extra })
  return { service, server, stores }
}
const select = (packet = accountPlanPacketFixture(3)) => ({ kind: "SELECT" as const, packet,
  confirmsSelection: true as const, freshReview: () => true })

it("hydrates exactly the current two parts out of 18 and exposes an explicit partial confirmed projection", async () => {
  const doc = fixture(18), { service, server } = setup(collectionServer(doc))
  expect(await service.hydrate()).toBe(true)
  expect(server.client.readPart).toHaveBeenCalledTimes(2)
  expect(server.client.readLegacy).not.toHaveBeenCalled()
  expect(service.snapshot()).toMatchObject({ status: "READY", historyLoaded: false, totalPlans: 18,
    migrationRequired: false, capacity: { limit: 100, plans: 18, partByteLimit: 500_000 } })
  expect(service.snapshot().confirmedDocument?.data.plans).toEqual([doc.data.plans[17]])
  expect(service.snapshot().currentPlan).toMatchObject({ executionAuthority: "NONE", kind: "read_only" })
  const historyPlan = await service.loadPlan(doc.data.plans[0]!.planId)
  expect(historyPlan).toEqual(doc.data.plans[0])
  expect(service.snapshot().historyLoaded).toBe(false)
  expect(service.snapshot().document?.data.plans).toHaveLength(1)
})

it("an index without a current pointer never scans archived parts on hydrate", async () => {
  const doc = fixture(); doc.data.plans.at(-1)!.archivedAt = new Date().toISOString(); doc.data.currentPlanId = null
  const { service, server } = setup(collectionServer(doc))
  expect(await service.hydrate()).toBe(true)
  expect(server.client.readPart).not.toHaveBeenCalled()
  expect(service.snapshot()).toMatchObject({ status: "READY", historyLoaded: false, totalPlans: 3, currentPlan: null })
  expect(service.snapshot().confirmedDocument?.data.plans).toEqual([])
})

it("deduplicates history requests, yields per entry and keeps READY/current visible throughout", async () => {
  const doc = fixture(), states: ReturnType<ReturnType<typeof createAccountPlanCollectionService>["snapshot"]>[] = []
  const { service, server } = setup(collectionServer(doc), { changed: () => { states.push(service.snapshot()) } })
  await service.hydrate()
  const first = service.loadHistory(), second = service.loadHistory()
  expect(first).toBe(second)
  expect(await first).toBe(true)
  expect(server.client.readPart).toHaveBeenCalledTimes(6)
  expect(states.filter(s => s.historyStatus === "LOADING")).not.toHaveLength(0)
  for (const state of states.filter(s => s.historyStatus === "LOADING")) {
    expect(state.status).toBe("READY"); expect(state.currentPlan?.planId).toBe(doc.data.currentPlanId)
  }
  expect(service.snapshot().confirmedDocument).toEqual(doc)
  expect(service.snapshot().historyLoaded).toBe(true)
})

it("failed history reads preserve the confirmed current and are retryable without empty-history substitution", async () => {
  const doc = fixture(), { service, server } = setup(collectionServer(doc))
  await service.hydrate(); const before = service.snapshot().confirmedDocument
  const id = server.index()!.plans[0]!.snapshotId, lost = server.parts.get(id)!
  server.parts.delete(id)
  expect(await service.loadHistory()).toBe(false)
  expect(service.snapshot()).toMatchObject({ status: "READY", historyStatus: "FAILED", historyLoaded: false, totalPlans: 3 })
  expect(service.snapshot().confirmedDocument).toEqual(before)
  server.parts.set(id, lost)
  expect(await service.loadHistory()).toBe(true)
})

it("history validates the whole fingerprint without a second physical read pass", async () => {
  const doc = fixture(), { service, stores } = setup(collectionServer(doc))
  await service.hydrate()
  vi.mocked(stores.parts.buffer.read).mockClear()
  expect(await service.loadHistory()).toBe(true)
  // Each part is read once and checked once when staging; no third read for final join.
  expect(stores.parts.buffer.read).toHaveBeenCalledTimes(doc.data.plans.length * 4)
  expect(service.snapshot().historyProgress).toEqual({ loaded: 3, total: 3 })
  expect(service.snapshot().document).toEqual(doc)
})

it("history rejects an invented whole-document fingerprint despite valid individual entries", async () => {
  const doc = fixture(), server = collectionServer(doc), original = server.index()!
  vi.mocked(server.client.readIndex).mockResolvedValue({ revision: 1,
    index: { ...original, documentFingerprint: `sha256:${"0".repeat(64)}` } })
  const { service } = setup(server)
  expect(await service.hydrate()).toBe(true)
  const before = service.snapshot().confirmedDocument
  expect(await service.loadHistory()).toBe(false)
  expect(service.snapshot()).toMatchObject({ historyLoaded: false, historyStatus: "FAILED" })
  expect(service.snapshot().confirmedDocument).toEqual(before)
})

it("cancelled history preserves current and ignores a late failed response before retry", async () => {
  const doc = fixture(), { service, server } = setup(collectionServer(doc))
  await service.hydrate()
  const before = service.snapshot().confirmedDocument
  let reject!: (error: unknown) => void, entered!: () => void
  const started = new Promise<void>(resolve => { entered = resolve })
  vi.mocked(server.client.readPart).mockImplementationOnce(() => {
    entered(); return new Promise((_resolve, fail) => { reject = fail })
  })
  const pending = service.loadHistory()
  await started
  service.cancelHistory()
  expect(service.snapshot()).toMatchObject({ historyStatus: "IDLE", historyLoaded: false,
    historyProgress: { loaded: 0, total: 3 } })
  const retry = service.loadHistory()
  expect(retry).not.toBe(pending)
  expect(await pending).toBe(false)
  expect(service.snapshot().confirmedDocument).toEqual(before)
  // Retry must finish while the cancelled transport is still unresolved.
  expect(await retry).toBe(true)
  reject(Error("UNAVAILABLE"))
  await tick()
  expect(service.snapshot().document).toEqual(doc)
})

it("cancel during a yielded history pass cannot publish a complete history or change the current plan", async () => {
  const doc = fixture()
  let cancel = false
  const { service } = setup(collectionServer(doc), { yieldTask: async () => {
    if (cancel) service.cancelHistory()
    await tick()
  } })
  await service.hydrate(); const before = service.snapshot().confirmedDocument
  cancel = true
  expect(await service.loadHistory()).toBe(false)
  expect(service.snapshot()).toMatchObject({ historyStatus: "IDLE", historyLoaded: false })
  expect(service.snapshot().confirmedDocument).toEqual(before)
  cancel = false
  expect(await service.loadHistory()).toBe(true)
})

it("never treats failed index or legacy reads as an empty baseline", async () => {
  const { service, server } = setup()
  vi.mocked(server.client.readIndex).mockRejectedValueOnce({ code: "AUTH_REQUIRED" })
  expect(await service.hydrate()).toBe(false)
  expect(service.snapshot()).toMatchObject({ status: "AUTH_REQUIRED", document: null })
  vi.mocked(server.client.readLegacy).mockRejectedValueOnce({ code: "UNAVAILABLE" })
  expect(await service.hydrate()).toBe(false)
  expect(service.snapshot().document).toBeNull()
  expect(server.commits).toHaveLength(0)
})

it("preserves legacy view until explicit exact migration, without a monolithic write", async () => {
  const doc = fixture(), { service, server } = setup()
  server.setLegacy(doc, 7)
  expect(await service.hydrate()).toBe(true)
  expect(service.snapshot()).toMatchObject({ migrationRequired: true, historyLoaded: true, totalPlans: 3 })
  expect(service.snapshot().document).toEqual(doc)
  expect(server.commits).toHaveLength(0)
  expect(await service.mutate({ kind: "ARCHIVE", planId: doc.data.currentPlanId! }, service.snapshot().fingerprint!)).toBe("STALE")
  expect(await service.migrateLegacy()).toBe("ACCOUNT")
  expect(server.commits[0]?.legacy).toMatchObject({ revision: 7, fingerprint: accountPlanFingerprint(doc) })
  expect(service.snapshot().confirmedDocument).toEqual(doc)
  expect(service.snapshot().migrationRequired).toBe(false)
})

it("a changed legacy revision conflicts and preserves the staged exact migration", async () => {
  const doc = fixture(), { service, server, stores } = setup()
  server.setLegacy(doc, 1); await service.hydrate(); server.setLegacy(doc, 2)
  expect(await service.migrateLegacy()).toBe("CONFLICT")
  expect(service.snapshot().confirmedDocument).toEqual(doc)
  expect([...stores.manifests.rows.values()][0]?.pending?.draft.operation?.legacy?.revision).toBe(1)
  expect(server.revision()).toBe(0)
})

it("selection, progress and archive preserve existing rules and update current only after a receipt", async () => {
  const { service, server } = setup()
  await service.hydrate()
  expect(await service.mutate(select(), service.snapshot().fingerprint!)).toBe("ACCOUNT")
  const packet = service.snapshot().currentPlan!.packet!
  Reflect.set(packet.state, "progress", [{ sessionDay: 1, sessionSlot: "AM", state: "COMPLETED" }])
  expect(await service.mutate({ kind: "PROGRESS", packet }, service.snapshot().fingerprint!)).toBe("ACCOUNT")
  expect(service.snapshot().confirmedDocument?.data.plans[0]?.progress).toHaveLength(1)
  expect(server.client.stage).toHaveBeenCalledTimes(3)
  const id = service.snapshot().currentPlan!.planId
  expect(await service.mutate({ kind: "ARCHIVE", planId: id }, service.snapshot().fingerprint!)).toBe("ACCOUNT")
  expect(service.snapshot().currentPlan).toBeNull()
  expect(await service.mutate(select(), service.snapshot().fingerprint!)).toBe("INVALID")
})

it("receipt loss leaves a stable segmented operation across reopen and retry, without optimistic confirmation", async () => {
  const { service, server, stores } = setup()
  await service.hydrate(); server.loseResponse()
  expect(await service.mutate(select(), service.snapshot().fingerprint!)).toBe("PENDING")
  expect(service.snapshot().currentPlan).toBeNull()
  expect(service.snapshot().confirmedDocument).toEqual(emptyAccountPlanDocument())
  const pending = structuredClone([...stores.manifests.rows.values()][0]!.pending)
  expect(pending).not.toBeNull()
  expect(stores.manifests.buffer.ack).not.toHaveBeenCalled()
  service.close()
  const reopened = setup(server, {}, stores).service
  expect(await reopened.hydrate()).toBe(true)
  expect(reopened.snapshot().currentPlan).toMatchObject({ kind: "read_only", executionAuthority: "NONE" })
  expect(server.commits).toHaveLength(1)
  expect(server.client.receipt).toHaveBeenLastCalledWith(COLLECTION_OWNER, pending!.operationId)
  expect([...stores.manifests.rows.values()][0]!.pending).toBeNull()
})

it("an unsent selection needs fresh review after reopen and cannot trust transported evidence", async () => {
  const { service, server, stores } = setup()
  await service.hydrate(); server.failStages(true)
  expect(await service.mutate(select(), service.snapshot().fingerprint!)).toBe("PENDING")
  server.failStages(false); service.close()
  const reopened = setup(server, {}, stores).service
  expect(await reopened.hydrate()).toBe(false)
  expect(await reopened.retry()).toBe("PENDING")
  expect(server.commits).toHaveLength(0)
  expect(await reopened.retry(() => true)).toBe("ACCOUNT")
  const independent = setup(collectionServer(fixture(1, 6))).service
  await independent.hydrate()
  expect(independent.snapshot().currentPlan).toMatchObject({ kind: "evidence_required", executionAuthority: "NONE" })
})

it("two-device conflict retains both manifests and all parts when the user chooses server current", async () => {
  const server = collectionServer(), a = setup(server), b = setup(server)
  await a.service.hydrate(); await b.service.hydrate()
  expect(await a.service.mutate(select(), a.service.snapshot().fingerprint!)).toBe("ACCOUNT")
  const alternative = accountPlanPacketFixture(3, new Date(TODAY.getTime() + 1000))
  expect(await b.service.mutate(select(alternative), b.service.snapshot().fingerprint!)).toBe("CONFLICT")
  const pending = structuredClone([...b.stores.manifests.rows.values()][0]!.pending)
  const partCount = b.stores.parts.rows.size
  expect(await b.service.useServerCurrent(b.service.snapshot().fingerprint!)).toBe("ACCOUNT")
  expect(b.service.snapshot().currentPlan?.planId).toBe(a.service.snapshot().currentPlan?.planId)
  const archived = [...b.stores.manifests.archives.values()].flat()
  expect(archived).toHaveLength(1)
  expect(archived[0]!.pending).toEqual(pending)
  expect(b.stores.parts.rows.size).toBeGreaterThanOrEqual(partCount)
  expect(b.service.snapshot().historyLoaded).toBe(false)
})

it("captures caller input before queued awaits and refuses stale rendered fingerprints", async () => {
  const { service } = setup()
  await service.hydrate()
  const command = select(), packet = structuredClone(command.packet), fingerprint = service.snapshot().fingerprint!
  const pending = service.mutate(command, fingerprint)
  Reflect.set(command.packet.state, "progress", [{ sessionDay: 1, sessionSlot: "AM", state: "COMPLETED" }])
  expect(await pending).toBe("ACCOUNT")
  expect(service.snapshot().currentPlan!.packet).toEqual(packet)
  expect(await service.mutate({ kind: "SAVE_HISTORY", packet }, fingerprint)).toBe("STALE")
})

it.each(["close", "epoch"])("blocks late responses across %s ABA and performs no durable or server write", async mode => {
  let epoch = 0
  const { service, server, stores } = setup(collectionServer(fixture()), { epoch: () => epoch })
  const read = server.client.readIndex
  vi.mocked(server.client.readIndex).mockImplementationOnce(async () => {
    const response = { index: server.index()!, revision: 1 }
    if (mode === "close") service.close(); else epoch += 2
    return response
  })
  expect(await service.hydrate()).toBe(false)
  expect(service.snapshot()).toMatchObject({ status: "IDLE", currentPlan: null, document: null })
  expect(stores.parts.writes).toHaveLength(0); expect(stores.manifests.writes).toHaveLength(0)
  expect(server.commits).toHaveLength(0); expect(read).toHaveBeenCalledTimes(1)
})

it("imports 18 real V6 frames beyond 500k using bounded part records and a compact manifest", async () => {
  const doc = fixture(18, 6), packets = doc.data.plans.map(materializeAccountPlan)
  const { service, server, stores } = setup(undefined, { online: () => false })
  await service.hydrate()
  expect(new TextEncoder().encode(JSON.stringify(doc)).byteLength).toBeGreaterThan(500_000)
  expect(await service.importHistory(packets, service.snapshot().fingerprint!, () => true)).toBe("PENDING")
  expect(server.commits).toHaveLength(0)
  expect(stores.parts.writes).toHaveLength(36)
  for (const part of stores.parts.writes) expect(new TextEncoder().encode(JSON.stringify(part)).byteLength).toBeLessThanOrEqual(500_000)
  expect(stores.manifests.writes).toHaveLength(1)
  const manifest = stores.manifests.writes[0]!
  expect(Object.keys(manifest)).toEqual(["version", "previous", "next", "operation"])
  expect(new TextEncoder().encode(JSON.stringify(manifest)).byteLength).toBeLessThan(20_000)
  expect(service.snapshot().confirmedDocument).toEqual(emptyAccountPlanDocument())
  service.close()
  const reopened = setup(server, {}, stores).service
  expect(await reopened.hydrate()).toBe(true)
  expect(reopened.snapshot().document?.data.plans).toHaveLength(18)
  expect(reopened.snapshot().capacity).toMatchObject({ limit: 100, plans: 18, exceeded: false })
}, 120_000)

it("mutating a lazy collection loads all references and retains every historical plan", async () => {
  const doc = fixture(4), { service } = setup(collectionServer(doc))
  await service.hydrate()
  expect(await service.mutate({ kind: "ARCHIVE", planId: doc.data.currentPlanId! }, service.snapshot().fingerprint!)).toBe("ACCOUNT")
  expect(service.snapshot().confirmedDocument?.data.plans).toHaveLength(4)
  expect(service.snapshot().historyLoaded).toBe(true)
})

it("deduplicates simultaneous runtime hydration requests", async () => {
  const { service, server } = setup(collectionServer(fixture()))
  const one = service.hydrate(), two = service.hydrate()
  expect(one).toBe(two)
  expect(await one).toBe(true)
  expect(server.client.readIndex).toHaveBeenCalledTimes(1)
  expect(server.client.readPart).toHaveBeenCalledTimes(2)
})

it("does not ACK a mismatched commit receipt and leaves the confirmed pointer unchanged", async () => {
  const { service, server, stores } = setup()
  await service.hydrate()
  vi.mocked(server.client.commit).mockResolvedValueOnce({ kind: "committed", receipt: {
    ownerId: COLLECTION_OWNER, operationId: crypto.randomUUID(), revision: 1,
    indexFingerprint: accountPlanFingerprint({}), requestFingerprint: accountPlanFingerprint({}),
  } })
  expect(await service.mutate(select(), service.snapshot().fingerprint!)).toBe("PENDING")
  expect(service.snapshot().currentPlan).toBeNull()
  expect(stores.manifests.buffer.ack).not.toHaveBeenCalled()
  expect([...stores.manifests.rows.values()][0]!.pending).not.toBeNull()
})

it("refuses forged persisted receipts before confirmation and keeps local work", async () => {
  const { service, server, stores } = setup()
  await service.hydrate(); server.failStages(true)
  expect(await service.mutate(select(), service.snapshot().fingerprint!)).toBe("PENDING")
  const op = [...stores.manifests.rows.values()][0]!.pending!.operationId
  server.receipts.set(op, { ownerId: COLLECTION_OWNER, operationId: op, revision: 1,
    indexFingerprint: accountPlanFingerprint({}), requestFingerprint: accountPlanFingerprint({}) })
  expect(await service.retry(() => true)).toBe("INVALID")
  expect(stores.manifests.buffer.ack).not.toHaveBeenCalled()
  expect(service.snapshot().currentPlan).toBeNull()
})

it("returns API rejection codes compatibly without dropping the durable operation", async () => {
  const { service, server, stores } = setup()
  await service.hydrate()
  vi.mocked(server.client.stage).mockRejectedValueOnce({ code: "REJECTED" })
  expect(await service.mutate(select(), service.snapshot().fingerprint!)).toBe("REJECTED")
  expect(service.snapshot().status).toBe("REJECTED")
  expect([...stores.manifests.rows.values()][0]!.pending).not.toBeNull()
  expect(stores.manifests.buffer.ack).not.toHaveBeenCalled()
})

it("does not send imports after their caller guard is cancelled during durable staging", async () => {
  let active = true
  const stores = collectionMemoryBuffers(), original = stores.manifests.buffer.queue
  const queue = vi.mocked(original).getMockImplementation()!
  vi.mocked(original).mockImplementation(async (...args) => { await queue(...args); active = false })
  const { service, server } = setup(undefined, {}, stores)
  await service.hydrate()
  expect(await service.importHistory([accountPlanPacketFixture(3)], service.snapshot().fingerprint!, () => active)).toBe("STALE")
  expect(server.client.receipt).not.toHaveBeenCalled()
  expect(server.commits).toHaveLength(0)
  expect([...stores.manifests.rows.values()][0]!.pending).not.toBeNull()
})

it("the 101st plan is a structural CAPACITY error, never an eviction", async () => {
  const doc = fixture(100), { service, server } = setup(collectionServer(doc))
  await service.hydrate()
  const packet = accountPlanPacketFixture(3, new Date(TODAY.getTime() + 100_000))
  expect(await service.mutate({ kind: "SAVE_HISTORY", packet }, service.snapshot().fingerprint!)).toBe("CAPACITY")
  expect(service.snapshot().totalPlans).toBe(100)
  expect(service.snapshot().document?.data.plans).toHaveLength(100)
  expect(server.commits).toHaveLength(0)
}, 30_000)
