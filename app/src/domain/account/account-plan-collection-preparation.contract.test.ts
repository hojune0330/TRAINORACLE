import { webcrypto } from "node:crypto"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { TODAY } from "../prescription-quality-matrix.test-fixtures"
import { accountPlanPacketFixture } from "./account-plan.test-fixtures"
import { accountPlanEntry, emptyAccountPlanDocument } from "./account-plan-document-schema"
import { splitAccountPlanCollection } from "./account-plan-collection-schema"
import { createAccountPlanCollectionBuffer } from "./account-plan-collection-buffer"
import { prepareAccountPlanCollectionTransfer } from "./account-plan-collection-transfer"
import { collectionMemoryBuffers, COLLECTION_OWNER } from "./account-plan-collection.test-support"

beforeEach(() => { vi.stubGlobal("crypto", webcrypto); vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(TODAY.getTime() + 120_000)) })
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
function fixture() {
  const stores = collectionMemoryBuffers()
  const previous = emptyAccountPlanDocument()
  previous.data.plans.push(accountPlanEntry(accountPlanPacketFixture(3)))
  const next = structuredClone(previous)
  next.data.plans.push(accountPlanEntry(accountPlanPacketFixture(3, new Date(TODAY.getTime() + 60_000))))
  next.data.currentPlanId = next.data.plans[1]!.planId
  const transfer = prepareAccountPlanCollectionTransfer({ ownerId: COLLECTION_OWNER, operationId: crypto.randomUUID(),
    expectedRevision: 1, previous, next })!
  const open = (current = () => true) => createAccountPlanCollectionBuffer(COLLECTION_OWNER, current,
    { ...stores.dependencies, yieldTask: async () => {} })
  return { stores, previous, transfer, open }
}

it("reopening A after first-snapshot scope loss exposes the complete fixed SELECT, never the old clean manifest", async () => {
  const { stores, previous, transfer, open } = fixture()
  let current = true
  const first = open(() => current)
  await first.observe(splitAccountPlanCollection(previous).index, 1)
  const original = stores.parts.buffer.saveDraft
  vi.mocked(original).mockImplementationOnce(async (owner, documentId, draft) => {
    stores.parts.rows.set(`${owner}:${documentId}`, { ownerId: owner, documentId, serverRevision: 0,
      localSequence: 1, acknowledgedSequence: 0, draft: structuredClone(draft), state: "LOCAL_CHANGES",
      pending: null, blocked: null, remoteDraft: null })
    current = false; first.close()
  })
  await expect(first.save(transfer, 1)).rejects.toThrow("STALE")
  expect(stores.preparations.rows.get(COLLECTION_OWNER)).toEqual({ transfer, expectedSequence: 1 })
  expect(stores.manifests.writes).toHaveLength(0)
  await expect(first.read()).rejects.toThrow("STALE")
  expect(await stores.preparations.buffer.read("22222222-2222-4222-8222-222222222222", () => true)).toBeNull()
  const reopened = open()
  expect(await reopened.read()).toMatchObject({ state: "PENDING", draft: { next: transfer.next.index } })
  expect(await reopened.pending()).toEqual(transfer)
  expect(stores.preparations.rows.size).toBe(0)
  expect(stores.manifests.buffer.ack).not.toHaveBeenCalled()
})

it("failed atomic preparation never stages parts, publishes a manifest or loses an existing clean base", async () => {
  const { stores, previous, transfer, open } = fixture(), buffer = open()
  await buffer.observe(splitAccountPlanCollection(previous).index, 1)
  const before = await buffer.read()
  vi.mocked(stores.preparations.buffer.save).mockRejectedValueOnce(Error("Quota"))
  await expect(buffer.save(transfer, 1)).rejects.toThrow("Quota")
  expect(stores.parts.writes).toHaveLength(0)
  expect(stores.manifests.writes).toHaveLength(0)
  expect(stores.preparations.rows.size).toBe(0)
  expect(await buffer.read()).toEqual(before)
})

it("captures the complete caller input before the first await without modifying the original", async () => {
  const { stores, previous, transfer, open } = fixture(), buffer = open()
  await buffer.observe(splitAccountPlanCollection(previous).index, 1)
  const captured = structuredClone(transfer)
  const saving = buffer.save(transfer, 1)
  transfer.operationId = crypto.randomUUID()
  transfer.next.snapshots.length = 0
  await saving
  expect(await buffer.pending()).toEqual(captured)
  expect(transfer.next.snapshots).toEqual([])
  expect(stores.preparations.buffer.save).toHaveBeenCalledWith({ transfer: captured, expectedSequence: 1 }, expect.any(Function))
})

it("a lost queue result retains the full preparation and replays exactly once on reopen", async () => {
  const { stores, previous, transfer, open } = fixture(), buffer = open()
  await buffer.observe(splitAccountPlanCollection(previous).index, 1)
  vi.mocked(stores.manifests.buffer.queue).mockRejectedValueOnce(Error("Interrupted"))
  await expect(buffer.save(transfer, 1)).rejects.toThrow("Interrupted")
  expect(stores.preparations.rows.get(COLLECTION_OWNER)?.transfer).toEqual(transfer)
  const reopened = open()
  expect(await reopened.pending()).toEqual(transfer)
  expect(stores.manifests.writes).toHaveLength(1)
  expect(stores.preparations.rows.size).toBe(0)
})

it("does not clear a preparation when a supposedly durable part is missing on verification", async () => {
  const { stores, previous, transfer, open } = fixture(), buffer = open()
  await buffer.observe(splitAccountPlanCollection(previous).index, 1)
  const save = vi.mocked(stores.parts.buffer.saveDraft), implementation = save.getMockImplementation()!
  save.mockResolvedValue()
  await expect(buffer.save(transfer, 1)).rejects.toThrow("INVALID")
  expect(stores.preparations.buffer.clear).not.toHaveBeenCalled()
  expect(stores.preparations.rows.get(COLLECTION_OWNER)?.transfer).toEqual(transfer)
  save.mockImplementation(implementation)
  expect(await open().pending()).toEqual(transfer)
})

it("does not hide retained preparation behind READY after a competing manifest wins CAS", async () => {
  const { stores, previous, transfer, open } = fixture(), buffer = open()
  await buffer.observe(splitAccountPlanCollection(previous).index, 1)
  vi.mocked(stores.parts.buffer.saveDraft).mockRejectedValueOnce(Error("Interrupted"))
  await expect(buffer.save(transfer, 1)).rejects.toThrow("Interrupted")
  const manifest = [...stores.manifests.rows.values()][0]!
  manifest.localSequence++
  await expect(open().read()).rejects.toThrow("CONFLICT")
  expect(stores.preparations.rows.get(COLLECTION_OWNER)?.transfer).toEqual(transfer)
  expect(stores.preparations.buffer.clear).not.toHaveBeenCalled()
})

it("a lost preparation-clear result does not create a duplicate operation or local ACK", async () => {
  const { stores, previous, transfer, open } = fixture(), buffer = open()
  await buffer.observe(splitAccountPlanCollection(previous).index, 1)
  vi.mocked(stores.preparations.buffer.clear).mockRejectedValueOnce(Error("Interrupted"))
  await expect(buffer.save(transfer, 1)).rejects.toThrow("Interrupted")
  expect(await open().pending()).toEqual(transfer)
  expect(stores.manifests.writes).toHaveLength(1)
  expect(stores.manifests.buffer.queue).toHaveBeenCalledTimes(1)
  expect(stores.manifests.buffer.ack).not.toHaveBeenCalled()
})
