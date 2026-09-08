import React from "react"
import { createRoot } from "react-dom/client"
import { EveningCheckin } from "../../src/screens/log-entry/EveningCheckin"
import { RaceForm } from "../../src/screens/log-entry/RaceForm"
import { PostSessionForm } from "../../src/screens/log-entry/PostSessionForm"
import { QuickSessionForm } from "../../src/screens/log-entry/QuickSessionForm"
import { createFormDraftBuffer, decodeFormDraft } from "../../src/screens/log-entry/form-input-draft"
import { setActiveLocalAccount } from "../../src/domain/account/local-journal-ownership"
import "../../../colors_and_type.css"
import "../../../colors_and_type_journal.css"
import "../../src/styles/app.css"

const owner = "11111111-1111-4111-8111-111111111111"
setActiveLocalAccount(owner)
const kind = new URLSearchParams(location.search).get("kind") ?? "evening"
const Component = kind === "race" ? RaceForm : kind === "post-session" ? PostSessionForm : kind === "quick" ? QuickSessionForm : EveningCheckin
createRoot(document.getElementById("root")!).render(<React.StrictMode><Component targetDate="2026-09-08" /></React.StrictMode>)

window.formInputHarness = {
  switchOwner: setActiveLocalAccount,
  async input() {
    const buffer = createFormDraftBuffer()
    try { return (await buffer.list(owner)).map(v => decodeFormDraft(v.draft)) }
    finally { buffer.close() }
  },
  async encryptedAtRest(recovery = false) {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(recovery ? "trainoracle-form-input-recovery-v1" : "trainoracle-form-input-drafts-v1", 1)
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(new Error("Fixture open failed"))
    })
    try {
      return await new Promise<{ noPlaintext: boolean; nativeKey: boolean; nonextractable: boolean }>((resolve, reject) => {
        const tx = db.transaction(["drafts", "ownerKeys"], "readonly")
        const records = tx.objectStore("drafts").getAll()
        const key = tx.objectStore("ownerKeys").get(owner)
        tx.oncomplete = () => resolve({ noPlaintext: !JSON.stringify(records.result).includes("SYNTHETIC_"),
          nativeKey: key.result instanceof CryptoKey, nonextractable: key.result.extractable === false })
        tx.onabort = () => reject(new Error("Fixture inspection failed"))
      })
    } finally { db.close() }
  },
}

declare global { interface Window { formInputHarness: {
  switchOwner: typeof setActiveLocalAccount
  input: () => Promise<ReturnType<typeof decodeFormDraft>[]>
  encryptedAtRest: (recovery?: boolean) => Promise<{ noPlaintext: boolean; nativeKey: boolean; nonextractable: boolean }>
} } }
