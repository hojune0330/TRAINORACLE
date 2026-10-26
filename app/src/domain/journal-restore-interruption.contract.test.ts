import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { clearJournalPrivateReadCache, deleteEntry, loadEntries, loadEntriesWithPrivateMemos, restoreDeletedEntry, savePrivateEntry } from "./journal-store"
import { loadTrash, prepareTrashRestore } from "./journal-trash"
import { JOURNAL_OWNERSHIP_STORAGE_KEY, JOURNAL_STORAGE_KEY, JOURNAL_TRASH_STORAGE_KEY, PRIVATE_MEMO_VAULT_STORAGE_KEY } from "./journal-storage-keys"
import { initializeCanonicalJournalFixture } from "../test/canonical-journal-fixture"
import { createRecoveryCode } from "./account/private-note-crypto"
import { saveSessionRecoveryCode } from "./account/private-note-sync"
import { setActiveLocalAccount } from "./account/local-journal-ownership"
import { privateEntry } from "./private-memo-test-fixtures"

beforeEach(async () => {
  vi.restoreAllMocks()
  localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null)
  clearJournalPrivateReadCache()
  await initializeCanonicalJournalFixture()
  expect(saveSessionRecoveryCode(createRecoveryCode())).toBe(true)
})
afterEach(() => { vi.restoreAllMocks(); setActiveLocalAccount(null); clearJournalPrivateReadCache() })

const capture = () => Object.fromEntries(Object.keys(localStorage).map(key => [key, localStorage.getItem(key)!]))
async function restart(values: Record<string, string>) {
  vi.restoreAllMocks()
  localStorage.clear()
  for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value)
  clearJournalPrivateReadCache()
  await initializeCanonicalJournalFixture()
}
async function deletedPrivateEntry() {
  expect((await savePrivateEntry(privateEntry("restore-source", "SYNTHETIC PRIVATE RESTORE"))).ok).toBe(true)
  expect(deleteEntry("restore-source")).toMatchObject({ ok: true, trashed: true })
}

it.each([JOURNAL_TRASH_STORAGE_KEY, PRIVATE_MEMO_VAULT_STORAGE_KEY, JOURNAL_STORAGE_KEY])(
  "resumes the same private restore id after abrupt termination just after %s is written", async boundary => {
    await deletedPrivateEntry()
    let interrupted: Record<string, string> | undefined
    const real = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      real.call(this, key, value)
      if (this === localStorage && key === boundary && interrupted === undefined) interrupted = capture()
    })
    const first = restoreDeletedEntry("restore-source")
    expect(first.ok).toBe(true)
    expect(interrupted).toBeDefined()
    // Rehydrate only bytes persisted at the interruption, ignoring all later writes.
    await restart(interrupted!)
    const source = loadTrash().find(item => item.entry.id === "restore-source")
    expect(source?.privateMemo).toBeDefined()
    expect(source?.restoredId).toBe(first.restoredId)
    const resumed = restoreDeletedEntry("restore-source")
    expect(resumed).toMatchObject({ ok: true, restoredId: first.restoredId, total: 1 })
    expect(loadTrash()).toEqual([])
    expect(loadEntries().map(entry => entry.id)).toEqual([first.restoredId])
    const entries = await loadEntriesWithPrivateMemos()
    expect(entries[0]).toMatchObject({ memo: "SYNTHETIC PRIVATE RESTORE" })
    expect(JSON.stringify(capture())).not.toContain("SYNTHETIC PRIVATE RESTORE")
  },
)

it("retains the recovery source and reserved id after a journal write failure", async () => {
  await deletedPrivateEntry()
  const real = Storage.prototype.setItem
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
    if (key === JOURNAL_STORAGE_KEY) throw new Error("synthetic quota")
    real.call(this, key, value)
  })
  expect(restoreDeletedEntry("restore-source").ok).toBe(false)
  vi.restoreAllMocks()
  const source = loadTrash()[0]!
  expect(source.restoredId).toBeTruthy()
  expect(source.privateMemo).toBeDefined()
  await restart(capture())
  expect(restoreDeletedEntry("restore-source")).toMatchObject({ ok: true, restoredId: source.restoredId, total: 1 })
})

it("refuses an altered destination without discarding the source or overwriting another value", async () => {
  await deletedPrivateEntry()
  const prepared = prepareTrashRestore("restore-source", "synthetic-destination")!
  expect(prepared).not.toBeNull()
  const unrelated = { ...prepared.item.entry, id: "synthetic-destination", title: "CHANGED DESTINATION" }
  localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify([unrelated]))
  const before = capture()
  expect(restoreDeletedEntry("restore-source").ok).toBe(false)
  expect(capture()).toEqual(before)
})

it("does not consume the source when the resume marker cannot be written", async () => {
  await deletedPrivateEntry()
  const before = capture(), real = Storage.prototype.setItem
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
    if (key === JOURNAL_TRASH_STORAGE_KEY) throw new Error("synthetic quota")
    real.call(this, key, value)
  })
  expect(restoreDeletedEntry("restore-source").ok).toBe(false)
  vi.restoreAllMocks()
  expect(capture()).toEqual(before)
})

it("refuses a destination reserved to another owner even when no journal row exists", async () => {
  await deletedPrivateEntry()
  expect(prepareTrashRestore("restore-source", "synthetic-destination")).not.toBeNull()
  localStorage.setItem(JOURNAL_OWNERSHIP_STORAGE_KEY, JSON.stringify({
    schemaVersion: 1, ownerByEntryId: { "synthetic-destination": "another-synthetic-owner" },
  }))
  const before = capture()
  expect(restoreDeletedEntry("restore-source").ok).toBe(false)
  expect(capture()).toEqual(before)
})

it("explicit cache erasure revokes a private read already decrypting", async () => {
  expect((await savePrivateEntry(privateEntry("read-source", "SYNTHETIC PRIVATE READ"))).ok).toBe(true)
  const real = crypto.subtle.decrypt.bind(crypto.subtle)
  vi.spyOn(crypto.subtle, "decrypt").mockImplementation((...args) => {
    clearJournalPrivateReadCache()
    return real(...args)
  })
  expect(await loadEntriesWithPrivateMemos()).toEqual([])
})

it("an account change during private encryption prevents journal publication", async () => {
  const real = crypto.subtle.encrypt.bind(crypto.subtle)
  vi.spyOn(crypto.subtle, "encrypt").mockImplementation((...args) => {
    setActiveLocalAccount("different-synthetic-owner")
    return real(...args)
  })
  expect((await savePrivateEntry(privateEntry("save-source", "SYNTHETIC PRIVATE SAVE"))).ok).toBe(false)
  setActiveLocalAccount(null)
  expect(loadEntries()).toEqual([])
})
