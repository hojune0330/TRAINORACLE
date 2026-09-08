import { webcrypto } from "node:crypto"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { TODAY } from "../prescription-quality-matrix.test-fixtures"
import { accountPlanPacketFixture } from "./account-plan.test-fixtures"
import { accountPlanEntry, emptyAccountPlanDocument } from "./account-plan-document-schema"
import { createAccountPlanCollectionBuffer, accountPlanCollectionManifestSchema } from "./account-plan-collection-buffer"
import { prepareAccountPlanCollectionTransfer } from "./account-plan-collection-transfer"
import { collectionMemoryBuffers, COLLECTION_OWNER } from "./account-plan-collection.test-support"

beforeEach(() => { vi.stubGlobal("crypto", webcrypto); localStorage.clear(); vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(TODAY.getTime() + 120_000)) })
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
function transfer() {
  const next = emptyAccountPlanDocument(); next.data.plans.push(accountPlanEntry(accountPlanPacketFixture(3)))
  return prepareAccountPlanCollectionTransfer({ ownerId: COLLECTION_OWNER, operationId: crypto.randomUUID(),
    expectedRevision: 0, previous: null, next })!
}
function setup() {
  const stores = collectionMemoryBuffers()
  const open = (current = () => true) => createAccountPlanCollectionBuffer(COLLECTION_OWNER, current, {
    ...stores.dependencies, yieldTask: async () => {},
  })
  return { stores, open }
}

it("does not publish a manifest or queue when any physical staging transaction fails", async () => {
  const { stores, open } = setup(), buffer = open(), op = transfer()
  vi.mocked(stores.parts.buffer.saveDraft).mockImplementationOnce(async () => { throw Error("Quota") })
  await expect(buffer.save(op, 0)).rejects.toThrow("Quota")
  expect(stores.manifests.writes).toHaveLength(0)
  expect(stores.manifests.buffer.queue).not.toHaveBeenCalled()
  expect(await buffer.pending()).toBeNull()
})

it("a crash between manifest durability and queue recovers exactly the same operation ID on reopen", async () => {
  const { stores, open } = setup(), first = open(), op = transfer()
  vi.mocked(stores.manifests.buffer.queue).mockRejectedValueOnce(Error("Interrupted"))
  await expect(first.save(op, 0)).rejects.toThrow("Interrupted")
  expect(stores.parts.writes).toHaveLength(2)
  expect(stores.manifests.writes).toHaveLength(1)
  const persisted = [...stores.manifests.rows.values()][0]!
  expect(persisted.pending).toBeNull()
  expect(persisted.draft.operation?.operationId).toBe(op.operationId)
  first.close()
  expect(await open().pending()).toEqual(op)
  expect([...stores.manifests.rows.values()][0]!.pending?.operationId).toBe(op.operationId)
})

it("revalidates every referenced local part on replay and never substitutes an empty payload", async () => {
  const { stores, open } = setup(), op = transfer(), buffer = open()
  await buffer.save(op, 0)
  const row = [...stores.parts.rows.values()].find(v => v.draft.kind === "PLAN_PROGRESS")!
  Reflect.set(row.draft, "updatedAt", "invalid")
  await expect(open().pending()).rejects.toThrow("INVALID")
  expect([...stores.manifests.rows.values()][0]!.pending?.operationId).toBe(op.operationId)
})

it("does not overwrite an existing pending manifest and keeps the losing operation's immutable parts", async () => {
  const { stores, open } = setup(), first = transfer(), second = transfer(), buffer = open()
  await buffer.save(first, 0)
  await expect(buffer.save(second, 0)).rejects.toThrow("CONFLICT")
  expect(await buffer.pending()).toEqual(first)
  expect(stores.manifests.writes).toHaveLength(1)
  expect(stores.parts.writes).toHaveLength(2)
})

it("refuses manifest ownership tampering before queue or replay", async () => {
  const { stores, open } = setup(), op = transfer(), buffer = open()
  await buffer.save(op, 0)
  const row = [...stores.manifests.rows.values()][0]!
  row.draft.operation!.ownerId = "22222222-2222-4222-8222-222222222222"
  await expect(open().pending()).rejects.toThrow("INVALID")
  expect(stores.manifests.buffer.ack).not.toHaveBeenCalled()
})

it("rejects payload-bearing manifests and preserves bounded references only", async () => {
  const { stores, open } = setup(), op = transfer()
  await open().save(op, 0)
  const manifest = stores.manifests.writes[0]!
  expect(accountPlanCollectionManifestSchema.safeParse(manifest).success).toBe(true)
  expect(accountPlanCollectionManifestSchema.safeParse({ ...manifest, parts: op.next }).success).toBe(false)
  expect(accountPlanCollectionManifestSchema.safeParse({ ...manifest, next: op.next }).success).toBe(false)
  expect(stores.parts.buffer.queue).not.toHaveBeenCalled()
  expect(stores.parts.buffer.ack).not.toHaveBeenCalled()
})

it("scope loss during staging stops before manifest durability and keeps completed parts", async () => {
  const { stores, open } = setup(), op = transfer()
  let current = true
  const buffer = open(() => current), save = stores.parts.buffer.saveDraft
  vi.mocked(stores.parts.buffer.saveDraft).mockImplementationOnce(async (...args) => {
    const result = await saveOriginal(args[0], args[1], args[2]); current = false; return result
  })
  // Capture the normal implementation, not the mock wrapper which now calls itself.
  async function saveOriginal(owner: string, doc: string, draft: Parameters<typeof save>[2]) {
    stores.parts.rows.set(`${owner}:${doc}`, { ownerId: owner, documentId: doc, serverRevision: 0,
      localSequence: 1, acknowledgedSequence: 0, draft: structuredClone(draft), state: "LOCAL_CHANGES",
      pending: null, blocked: null, remoteDraft: null })
  }
  await expect(buffer.save(op, 0)).rejects.toThrow("STALE")
  expect(stores.parts.rows.size).toBe(1)
  expect(stores.manifests.writes).toHaveLength(0)
})
