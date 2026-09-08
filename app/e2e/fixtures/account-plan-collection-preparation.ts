import { createAccountPlanCollectionBuffer } from "../../src/domain/account/account-plan-collection-buffer"
import { createAccountPlanCollectionPreparationStore, COLLECTION_PREPARATION_DB } from "../../src/domain/account/account-plan-collection-preparation"
import { prepareAccountPlanCollectionTransfer } from "../../src/domain/account/account-plan-collection-transfer"
import { accountPlanEntry, accountPlanFingerprint, emptyAccountPlanDocument } from "../../src/domain/account/account-plan-document-schema"
import { splitAccountPlanCollection } from "../../src/domain/account/account-plan-collection-schema"
import { planBetaStateV3Schema } from "../../src/domain/plan-beta-schema"
import { stateFixture } from "../../src/domain/plan-beta-store.test-fixture"

export function setup() {
  const owner = "11111111-1111-4111-8111-111111111111", other = "22222222-2222-4222-8222-222222222222"
  const scope = { owner }
  const open = (id = owner) => createAccountPlanCollectionBuffer(id, () => scope.owner === id, { yieldTask: async () => {} })
  function fixture(count = 2) {
    const previous = emptyAccountPlanDocument()
    const at = new Date("2026-08-24T00:00:00.000Z")
    const packet = (time: Date) => ({ state: planBetaStateV3Schema.parse({ ...stateFixture(), generatedAt: time.toISOString() }), evidence: null })
    previous.data.plans.push(accountPlanEntry(packet(at), at.toISOString()))
    previous.data.currentPlanId = previous.data.plans[0]!.planId
    const next = structuredClone(previous)
    next.data.plans[0]!.archivedAt = at.toISOString()
    for (let i = 1; i < count; i++) {
      const time = new Date(at.getTime() + i * 1000)
      next.data.plans.push(accountPlanEntry(packet(time), time.toISOString()))
    }
    next.data.currentPlanId = next.data.plans.at(-1)!.planId
    const transfer = prepareAccountPlanCollectionTransfer({ ownerId: owner, operationId: crypto.randomUUID(),
      expectedRevision: 1, previous, next })
    if (!transfer) throw Error("Invalid synthetic preparation fixture")
    return { previous, transfer, expectedSequence: 1 }
  }
  async function raw() {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open(COLLECTION_PREPARATION_DB, 1)
      r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error)
    })
    try {
      return await new Promise<{ rows: Array<{ ownerId: string; slot: string; operationId: string;
        iv: Uint8Array; ciphertext: Uint8Array }>; keys: Array<{ id: string; key: CryptoKey }> }>((resolve, reject) => {
        const tx = db.transaction(["payloads", "ownerKeys"], "readonly")
        const rows = tx.objectStore("payloads").getAll(), keys = tx.objectStore("ownerKeys").getAll()
        tx.oncomplete = () => resolve({ rows: rows.result, keys: keys.result }); tx.onabort = () => reject(tx.error)
      })
    } finally { db.close() }
  }
  async function rejected(run: () => Promise<unknown>) {
    try { await run(); return null } catch (error) { return error instanceof Error ? error.message : "Failed" }
  }
  const harness = { owner, other, scope, open, fixture, raw, rejected, fingerprint: accountPlanFingerprint,
    split: splitAccountPlanCollection, createPreparation: createAccountPlanCollectionPreparationStore, databaseName: COLLECTION_PREPARATION_DB }
  window.accountPreparationHarness = harness
  return harness
}
declare global { interface Window { accountPreparationHarness: ReturnType<typeof setup> } }
