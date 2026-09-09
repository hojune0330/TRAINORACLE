import * as service from "../../src/domain/account/account-decoration-service"
import * as store from "../../src/domain/decoration-store"
import { createEmptyDecorationState } from "../../src/domain/decoration-schema"
import { setActiveLocalAccount } from "../../src/domain/account/local-journal-ownership"
import { createAccountDocumentBuffer } from "../../src/domain/account/account-journal-draft-buffer"
import { accountDecorationDocumentSchema } from "../../src/domain/account/account-decoration-schema"
import { DECORATION_CATALOG } from "../../src/domain/decoration-catalog"
const owner = "a1111111-1111-4111-8111-111111111111"
const other = "b2222222-2222-4222-8222-222222222222"
setActiveLocalAccount(owner)
async function view() {
  const buffer = createAccountDocumentBuffer(accountDecorationDocumentSchema, "trainoracle-account-decorations-v1")
  try { return await buffer.read(owner, await service.accountDecorationDocumentId(owner)) } finally { buffer.close() }
}
async function rawRecords() {
  const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open("trainoracle-account-decorations-v1", 1); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error) })
  try {
    return await new Promise<unknown[]>((resolve, reject) => { const tx = db.transaction("drafts", "readonly"), r = tx.objectStore("drafts").getAll(); tx.oncomplete = () => resolve(r.result); tx.onabort = () => reject(tx.error) })
  } finally { db.close() }
}
const harness = { ...service, ...store, createEmptyDecorationState, setActiveLocalAccount, owner, other,
  view, rawRecords, paidItem: DECORATION_CATALOG.find(item => item.cost > 0)!, pending: null as Promise<unknown> | null,
  paidItems: DECORATION_CATALOG.filter(item => item.cost > 0 && item.cost <= 100),
  async editFromOtherTab(text: string) {
    const buffer = createAccountDocumentBuffer(accountDecorationDocumentSchema, "trainoracle-account-decorations-v1")
    try {
      const id = await service.accountDecorationDocumentId(owner), current = await buffer.read(owner, id)
      if (!current) throw Error("Missing fixture")
      const next = structuredClone(current.draft)
      Object.assign(next.data.pages[0]!.items[0]!, { text })
      await buffer.saveDraft(owner, id, next, current.localSequence)
    } finally { buffer.close() }
  },
}
declare global { interface Window { accountDecorationHarness: typeof harness } }
window.accountDecorationHarness = harness
