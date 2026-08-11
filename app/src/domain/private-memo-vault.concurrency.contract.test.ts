import { beforeEach, describe, expect, it } from "vitest"
import { createRecoveryCode, encryptPrivateNote } from "./account/private-note-crypto"
import { JOURNAL_STORAGE_KEY, PRIVATE_MEMO_VAULT_STORAGE_KEY } from "./journal-storage-keys"
import {
  loadPrivateMemoVault,
  privateMemoShell,
  removePrivateMemoWithJournalEntries,
  restorePrivateMemoRecordWithJournalShell,
} from "./private-memo-vault"
import { privateEntry } from "./private-memo-test-fixtures"

beforeEach(() => {
  window.localStorage.clear()
})

describe("private vault concurrent writers", () => {
  it("does not delete a private record from a journal changed after the caller snapshot", async () => {
    const recoveryCode = createRecoveryCode()
    const original = privateEntry("original", "PRIVATE-ORIGINAL")
    const concurrent = privateEntry("concurrent", "PRIVATE-CONCURRENT")
    const originalVault = await vaultRawFor(original.id, original.memo, recoveryCode)
    const originalJournal = JSON.stringify([privateMemoShell(original)])
    const concurrentVault = await vaultRawFor(concurrent.id, concurrent.memo, recoveryCode)
    const concurrentJournal = JSON.stringify([privateMemoShell(concurrent)])
    window.localStorage.setItem(PRIVATE_MEMO_VAULT_STORAGE_KEY, originalVault)
    window.localStorage.setItem(JOURNAL_STORAGE_KEY, originalJournal)
    window.localStorage.setItem(PRIVATE_MEMO_VAULT_STORAGE_KEY, concurrentVault)
    window.localStorage.setItem(JOURNAL_STORAGE_KEY, concurrentJournal)

    expect(removePrivateMemoWithJournalEntries(
      window.localStorage,
      [],
      original.id,
      originalJournal,
    )).toBe(false)
    expect(window.localStorage.getItem(PRIVATE_MEMO_VAULT_STORAGE_KEY)).toBe(concurrentVault)
    expect(window.localStorage.getItem(JOURNAL_STORAGE_KEY)).toBe(concurrentJournal)
  })

  it("does not restore a private record into a journal changed after the caller snapshot", async () => {
    const recoveryCode = createRecoveryCode()
    const original = privateEntry("original", "PRIVATE-ORIGINAL")
    const restored = privateEntry("restored", "PRIVATE-RESTORED")
    const concurrent = privateEntry("concurrent", "PRIVATE-CONCURRENT")
    const originalVault = await vaultRawFor(original.id, original.memo, recoveryCode)
    const originalJournal = JSON.stringify([privateMemoShell(original)])
    const concurrentVault = await vaultRawFor(concurrent.id, concurrent.memo, recoveryCode)
    const concurrentJournal = JSON.stringify([privateMemoShell(concurrent)])
    const record = loadPrivateMemoVaultFromRaw(originalVault, original.id)
    window.localStorage.setItem(PRIVATE_MEMO_VAULT_STORAGE_KEY, originalVault)
    window.localStorage.setItem(JOURNAL_STORAGE_KEY, originalJournal)
    window.localStorage.setItem(PRIVATE_MEMO_VAULT_STORAGE_KEY, concurrentVault)
    window.localStorage.setItem(JOURNAL_STORAGE_KEY, concurrentJournal)

    expect(restorePrivateMemoRecordWithJournalShell(
      window.localStorage,
      [privateMemoShell(restored)],
      original.id,
      restored.id,
      record,
      originalJournal,
    )).toBe(false)
    expect(window.localStorage.getItem(PRIVATE_MEMO_VAULT_STORAGE_KEY)).toBe(concurrentVault)
    expect(window.localStorage.getItem(JOURNAL_STORAGE_KEY)).toBe(concurrentJournal)
  })
})

async function vaultRawFor(entryId: string, memo: string, recoveryCode: string): Promise<string> {
  return JSON.stringify({
    version: 1,
    records: { [entryId]: { encrypted: await encryptPrivateNote(memo, recoveryCode) } },
  })
}

function loadPrivateMemoVaultFromRaw(raw: string, entryId: string) {
  window.localStorage.setItem(PRIVATE_MEMO_VAULT_STORAGE_KEY, raw)
  const record = loadPrivateMemoVault(window.localStorage)?.records[entryId]
  if (record === undefined) throw new Error("Expected private memo record")
  return record
}
