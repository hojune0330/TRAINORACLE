import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { initializeCanonicalJournalFixture } from "../test/canonical-journal-fixture"
import { createRecoveryCode } from "./account/private-note-crypto"
import { saveSessionRecoveryCode } from "./account/private-note-sync"
import { assignJournalsToAccount, journalOwner, setActiveLocalAccount } from "./account/local-journal-ownership"
import { loadEntriesWithPrivateMemos, replaceEntriesOwnedByWithPrivateMemos, savePrivateEntry, updatePrivateEntry } from "./journal-store"
import { JOURNAL_OWNERSHIP_STORAGE_KEY, JOURNAL_STORAGE_KEY, PRIVATE_MEMO_VAULT_STORAGE_KEY } from "./journal-storage-keys"
import { privateEntry } from "./private-memo-test-fixtures"
import { rotatePrivateMemoVault } from "./private-memo-vault"

beforeEach(async () => {
  vi.stubEnv("VITE_FEATURE_ACCOUNT_JOURNAL", "false")
  localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount("A")
  await initializeCanonicalJournalFixture()
})
afterEach(() => { vi.unstubAllEnvs(); setActiveLocalAccount(null) })

const operations = ["create", "edit", "replace"] as const
type Operation = typeof operations[number]
const disruptions = ["scope-ABA", "recovery", "owner-ledger"] as const

async function prepare(operation: Operation) {
  const code = createRecoveryCode()
  expect(saveSessionRecoveryCode(code)).toBe(true)
  const original = privateEntry("one", "SYNTHETIC ORIGINAL")
  if (operation !== "create") expect((await savePrivateEntry(original)).ok).toBe(true)
  const next = { ...original, memo: "SYNTHETIC PENDING", savedAt: "2026-08-02T00:00:00.000Z" }
  const before = {
    journal: localStorage.getItem(JOURNAL_STORAGE_KEY), vault: localStorage.getItem(PRIVATE_MEMO_VAULT_STORAGE_KEY),
    ownership: localStorage.getItem(JOURNAL_OWNERSHIP_STORAGE_KEY),
  }
  const start = () => operation === "create" ? savePrivateEntry(next)
    : operation === "edit" ? updatePrivateEntry(next, original.savedAt)
    : replaceEntriesOwnedByWithPrivateMemos("A", [next], [next], code)
  return { before, start, next, code }
}

for (const operation of operations) {
  it.each(disruptions)(`rejects stale ${operation} after %s without changing the encrypted record`, async disruption => {
    const { before, start } = await prepare(operation)
    const pending = start()
    let ownerAfterDisruption = before.ownership
    if (disruption === "scope-ABA") { setActiveLocalAccount("B"); setActiveLocalAccount("A") }
    if (disruption === "recovery") expect(saveSessionRecoveryCode(createRecoveryCode())).toBe(true)
    if (disruption === "owner-ledger") {
      // Another tab changes only ownership; the journal/vault/manifest stay identical.
      ownerAfterDisruption = JSON.stringify({ schemaVersion: 1, ownerByEntryId: { one: "B" } })
      localStorage.setItem(JOURNAL_OWNERSHIP_STORAGE_KEY, ownerAfterDisruption)
    }
    expect((await pending).ok).toBe(false)
    expect(localStorage.getItem(JOURNAL_STORAGE_KEY)).toBe(before.journal)
    expect(localStorage.getItem(PRIVATE_MEMO_VAULT_STORAGE_KEY)).toBe(before.vault)
    expect(localStorage.getItem(JOURNAL_OWNERSHIP_STORAGE_KEY)).toBe(ownerAfterDisruption)
  })

  it(`keeps same-owner ${operation} working and the private text out of the journal shell`, async () => {
    const { start, next } = await prepare(operation)
    expect((await start()).ok).toBe(true)
    expect(journalOwner(next.id)).toBe("A")
    expect(localStorage.getItem(JOURNAL_STORAGE_KEY)).not.toContain(next.memo)
    expect(await loadEntriesWithPrivateMemos()).toEqual([next])
  })
}

it("does not adopt an unbound private record when editing it while signed in", async () => {
  setActiveLocalAccount(null)
  const code = createRecoveryCode()
  expect(saveSessionRecoveryCode(code)).toBe(true)
  const original = privateEntry("free", "SYNTHETIC UNBOUND")
  expect((await savePrivateEntry(original)).ok).toBe(true)
  setActiveLocalAccount("A"); expect(saveSessionRecoveryCode(code)).toBe(true)
  expect((await updatePrivateEntry({ ...original, memo: "SYNTHETIC EDIT", savedAt: "2026-08-02T00:00:00.000Z" }, original.savedAt)).ok).toBe(true)
  expect(journalOwner(original.id)).toBeNull()
})

it("rejects an edit when an unbound record changes owner while encrypting", async () => {
  setActiveLocalAccount(null)
  const code = createRecoveryCode()
  expect(saveSessionRecoveryCode(code)).toBe(true)
  const original = privateEntry("free", "SYNTHETIC UNBOUND")
  expect((await savePrivateEntry(original)).ok).toBe(true)
  setActiveLocalAccount("A"); expect(saveSessionRecoveryCode(code)).toBe(true)
  const before = {
    journal: localStorage.getItem(JOURNAL_STORAGE_KEY), vault: localStorage.getItem(PRIVATE_MEMO_VAULT_STORAGE_KEY),
  }
  const pending = updatePrivateEntry({ ...original, memo: "SYNTHETIC LATE", savedAt: "2026-08-02T00:00:00.000Z" }, original.savedAt)
  // The existing ownership API can adopt an unbound record without editing its
  // encrypted contents or changing this tab's active account/lifecycle epoch.
  expect(assignJournalsToAccount([original.id], "B")).toBe(true)
  expect((await pending).ok).toBe(false)
  expect(journalOwner(original.id)).toBe("B")
  expect(localStorage.getItem(JOURNAL_STORAGE_KEY)).toBe(before.journal)
  expect(localStorage.getItem(PRIVATE_MEMO_VAULT_STORAGE_KEY)).toBe(before.vault)
})

it("rejects stale key rotation after an A to B to A account switch", async () => {
  const { start, code } = await prepare("create")
  expect((await start()).ok).toBe(true)
  const previousVault = localStorage.getItem(PRIVATE_MEMO_VAULT_STORAGE_KEY)
  const pending = rotatePrivateMemoVault(code, createRecoveryCode())
  setActiveLocalAccount("B"); setActiveLocalAccount("A")
  expect(await pending).toEqual({ ok: false })
  expect(localStorage.getItem(PRIVATE_MEMO_VAULT_STORAGE_KEY)).toBe(previousVault)
})
