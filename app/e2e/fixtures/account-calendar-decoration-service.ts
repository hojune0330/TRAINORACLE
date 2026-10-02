import * as service from "../../src/domain/account/account-calendar-decoration-service"
import * as store from "../../src/domain/calendar-decoration-store"
import { createEmptyCalendarDecorationState } from "../../src/domain/calendar-decoration-schema"
import { setActiveLocalAccount } from "../../src/domain/account/local-journal-ownership"
import { createAccountDocumentBuffer } from "../../src/domain/account/account-journal-draft-buffer"
import { accountCalendarDecorationDocumentSchema } from "../../src/domain/account/account-calendar-decoration-schema"
import { createEmptyDecorationState } from "../../src/domain/decoration-schema"
import { accountDecorationDocumentId } from "../../src/domain/account/account-decoration-service"
const owner = "a1111111-1111-4111-8111-111111111111"
const other = "b2222222-2222-4222-8222-222222222222"
setActiveLocalAccount(owner)
async function view(ownerId = owner) {
  const buffer = createAccountDocumentBuffer(accountCalendarDecorationDocumentSchema, service.ACCOUNT_CALENDAR_DECORATION_DATABASE)
  try { return await buffer.read(ownerId, await service.accountCalendarDecorationDocumentId(ownerId)) } finally { buffer.close() }
}
async function rawRecords() {
  const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open(service.ACCOUNT_CALENDAR_DECORATION_DATABASE, 1); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error) })
  try {
    return await new Promise<unknown[]>((resolve, reject) => { const tx = db.transaction("drafts", "readonly"), r = tx.objectStore("drafts").getAll(); tx.oncomplete = () => resolve(r.result); tx.onabort = () => reject(tx.error) })
  } finally { db.close() }
}
const harness = { ...service, ...store, createEmptyCalendarDecorationState, setActiveLocalAccount, owner, other, view, rawRecords,
  createEmptyDecorationState, accountDecorationDocumentId, createAccountDocumentBuffer, accountCalendarDecorationDocumentSchema }
declare global { interface Window { accountCalendarDecorationHarness: typeof harness } }
window.accountCalendarDecorationHarness = harness
