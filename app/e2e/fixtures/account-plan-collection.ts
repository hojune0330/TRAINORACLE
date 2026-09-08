import { createAccountPlanCollectionService } from "../../src/domain/account/account-plan-collection-service"
import { activeLocalAccount, setActiveLocalAccount, onLocalJournalScopeChange } from "../../src/domain/account/local-journal-ownership"
import { planBetaStateV3Schema } from "../../src/domain/plan-beta-schema"
import { stateFixture } from "../../src/domain/plan-beta-store.test-fixture"
import type { AccountPlanPacket } from "../../src/domain/account/account-plan-document-schema"

export function setup() {
  const owner = "11111111-1111-4111-8111-111111111111"
  setActiveLocalAccount(owner)
  const service = createAccountPlanCollectionService({ ownerId: owner, isCurrent: () => activeLocalAccount() === owner })
  const unsubscribe = onLocalJournalScopeChange(() => { service.close(); unsubscribe() })
  const packet: AccountPlanPacket = { state: planBetaStateV3Schema.parse(stateFixture()), evidence: null }
  async function rawRecords() {
    const result: unknown[] = []
    for (const name of ["trainoracle-account-plan-collection-manifests-v1", "trainoracle-account-plan-collection-parts-v1"]) {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const r = indexedDB.open(name, 1); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error)
      })
      try {
        result.push(...await new Promise<unknown[]>((resolve, reject) => {
          const tx = db.transaction("drafts", "readonly"), r = tx.objectStore("drafts").getAll()
          tx.oncomplete = () => resolve(r.result); tx.onabort = () => reject(tx.error)
        }))
      } finally { db.close() }
    }
    return result
  }
  window.accountCollectionHarness = { service, packet, rawRecords,
    select: () => service.mutate({ kind: "SELECT", packet, confirmsSelection: true, freshReview: () => true }, service.snapshot().fingerprint!),
  }
}
declare global { interface Window { accountCollectionHarness: {
  service: ReturnType<typeof createAccountPlanCollectionService>; packet: AccountPlanPacket;
  select: () => Promise<string>; rawRecords: () => Promise<unknown[]>;
} } }
