import { createAccountPlanService, accountPlanDocumentId } from "../../src/domain/account/account-plan-service"
import { accountPlanDocumentSchema, type AccountPlanPacket } from "../../src/domain/account/account-plan-document-schema"
import { createAccountDocumentBuffer } from "../../src/domain/account/account-journal-draft-buffer"
import { activeLocalAccount, setActiveLocalAccount } from "../../src/domain/account/local-journal-ownership"
import { planBetaStateV3Schema } from "../../src/domain/plan-beta-schema"
import { stateFixture } from "../../src/domain/plan-beta-store.test-fixture"

const owner = "11111111-1111-4111-8111-111111111111", databaseName = "trainoracle-account-plans-v1"
export function setup() {
  setActiveLocalAccount(owner)
  const service = createAccountPlanService({ ownerId: owner, isCurrent: () => activeLocalAccount() === owner })
  const packet: AccountPlanPacket = { state: planBetaStateV3Schema.parse(stateFixture()), evidence: null }
  async function view() {
    const buffer = createAccountDocumentBuffer(accountPlanDocumentSchema, databaseName)
    try { return await buffer.read(owner, await accountPlanDocumentId(owner)) } finally { buffer.close() }
  }
  async function rawRecords() {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1)
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error)
    })
    try {
      return await new Promise<unknown[]>((resolve, reject) => {
        const tx = db.transaction("drafts", "readonly"), request = tx.objectStore("drafts").getAll()
        tx.oncomplete = () => resolve(request.result); tx.onabort = () => reject(tx.error)
      })
    } finally { db.close() }
  }
  const harness = { service, packet, view, rawRecords, setActiveLocalAccount,
    select: () => service.mutate({ kind: "SELECT", packet, confirmsSelection: true, freshReview: () => true }, service.snapshot().fingerprint!),
  }
  window.accountPlanHarness = harness
  return harness
}
declare global { interface Window { accountPlanHarness: ReturnType<typeof setup> } }
