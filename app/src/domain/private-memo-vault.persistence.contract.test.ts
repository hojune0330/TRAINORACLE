import { beforeEach, describe, expect, it, vi } from "vitest"
import { createRecoveryCode, encryptPrivateNote } from "./account/private-note-crypto"
import { saveSessionRecoveryCode } from "./account/private-note-sync"
import { loadEntries, savePrivateEntry } from "./journal-store"
import { JOURNAL_STORAGE_KEY, PRIVATE_MEMO_VAULT_STORAGE_KEY } from "./journal-storage-keys"
import {
  loadPrivateMemoVault,
  privateMemoShell,
  savePrivateMemoWithJournalShell,
} from "./private-memo-vault"
import { privateEntry } from "./private-memo-test-fixtures"

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
})

describe("private memo vault and journal persistence", () => {
  it("restores the prior encrypted vault and journal shell after a partial journal write", async () => {
    const recoveryCode = createRecoveryCode()
    expect(saveSessionRecoveryCode(recoveryCode)).toBe(true)
    await expect(savePrivateEntry(privateEntry("original", "PRIVATE-LUNA-ORIGINAL"))).resolves.toEqual({ ok: true, total: 1 })
    const originalJournal = window.localStorage.getItem(JOURNAL_STORAGE_KEY)
    const originalVault = window.localStorage.getItem(PRIVATE_MEMO_VAULT_STORAGE_KEY)
    const realSet = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key: string, value: string) {
      if (key === JOURNAL_STORAGE_KEY && value !== originalJournal) {
        realSet.call(this, key, "{partial")
        return
      }
      realSet.call(this, key, value)
    })

    await expect(savePrivateEntry(privateEntry("new", "PRIVATE-LUNA-NEW"))).resolves.toEqual({ ok: false, total: 1 })
    expect(window.localStorage.getItem(JOURNAL_STORAGE_KEY)).toBe(originalJournal)
    expect(window.localStorage.getItem(PRIVATE_MEMO_VAULT_STORAGE_KEY)).toBe(originalVault)
    expect(allLocalStorageValues()).not.toContain("PRIVATE-LUNA-NEW")
  })

  it.each([
    { key: PRIVATE_MEMO_VAULT_STORAGE_KEY, label: "vault" },
    { key: JOURNAL_STORAGE_KEY, label: "journal" },
  ])("restores both records when $label confirmation throws", async ({ key }) => {
    const recoveryCode = createRecoveryCode()
    expect(saveSessionRecoveryCode(recoveryCode)).toBe(true)
    await expect(savePrivateEntry(privateEntry("original", "PRIVATE-LUNA-ORIGINAL"))).resolves.toEqual({ ok: true, total: 1 })
    const originalJournal = window.localStorage.getItem(JOURNAL_STORAGE_KEY)
    const originalVault = window.localStorage.getItem(PRIVATE_MEMO_VAULT_STORAGE_KEY)
    const realSet = Storage.prototype.setItem
    const realGet = Storage.prototype.getItem
    let wroteVault = false
    let wroteJournal = false
    let throwConfirmation = true
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, storageKey: string, value: string) {
      realSet.call(this, storageKey, value)
      if (storageKey === PRIVATE_MEMO_VAULT_STORAGE_KEY && value !== originalVault) wroteVault = true
      if (storageKey === JOURNAL_STORAGE_KEY && value !== originalJournal) wroteJournal = true
    })
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (this: Storage, storageKey: string) {
      if (storageKey === key && wroteVault && wroteJournal && throwConfirmation) {
        throwConfirmation = false
        throw new Error("ReadbackError")
      }
      return realGet.call(this, storageKey)
    })

    await expect(savePrivateEntry(privateEntry("new", "PRIVATE-LUNA-NEW"))).resolves.toEqual({ ok: false, total: 1 })
    expect(window.localStorage.getItem(JOURNAL_STORAGE_KEY)).toBe(originalJournal)
    expect(window.localStorage.getItem(PRIVATE_MEMO_VAULT_STORAGE_KEY)).toBe(originalVault)
  })

  it("keeps both prior records when the journal snapshot cannot be read", async () => {
    const recoveryCode = createRecoveryCode()
    expect(saveSessionRecoveryCode(recoveryCode)).toBe(true)
    await expect(savePrivateEntry(privateEntry("original", "PRIVATE-LUNA-ORIGINAL"))).resolves.toEqual({ ok: true, total: 1 })
    const originalJournal = window.localStorage.getItem(JOURNAL_STORAGE_KEY)
    const originalVault = window.localStorage.getItem(PRIVATE_MEMO_VAULT_STORAGE_KEY)
    const realGet = Storage.prototype.getItem
    let journalReads = 0
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (this: Storage, storageKey: string) {
      if (storageKey === JOURNAL_STORAGE_KEY && ++journalReads === 2) throw new Error("SnapshotReadError")
      return realGet.call(this, storageKey)
    })

    await expect(savePrivateEntry(privateEntry("new", "PRIVATE-LUNA-NEW"))).resolves.toEqual({ ok: false, total: 1 })
    expect(window.localStorage.getItem(JOURNAL_STORAGE_KEY)).toBe(originalJournal)
    expect(window.localStorage.getItem(PRIVATE_MEMO_VAULT_STORAGE_KEY)).toBe(originalVault)
  })

  it("does not overwrite a vault and journal changed while encrypting a new private memo", async () => {
    const recoveryCode = createRecoveryCode()
    expect(saveSessionRecoveryCode(recoveryCode)).toBe(true)
    const original = privateEntry("original", "PRIVATE-LUNA-ORIGINAL")
    const pending = privateEntry("pending", "PRIVATE-LUNA-PENDING")
    const concurrent = privateEntry("concurrent", "PRIVATE-LUNA-CONCURRENT")
    await expect(savePrivateEntry(original)).resolves.toEqual({ ok: true, total: 1 })
    const currentVault = loadPrivateMemoVault(window.localStorage)
    if (currentVault === null) throw new Error("Expected the current vault")
    const concurrentVault = {
      version: 1 as const,
      records: {
        ...currentVault.records,
        [concurrent.id]: { encrypted: await encryptPrivateNote(concurrent.memo, recoveryCode) },
      },
    }
    const concurrentJournal = JSON.stringify([...loadEntries(), privateMemoShell(concurrent)])
    const concurrentVaultRaw = JSON.stringify(concurrentVault)
    const realGetItem = Storage.prototype.getItem
    const realSetItem = Storage.prototype.setItem
    let vaultReads = 0
    const storage = delegatedStorage((key) => {
      if (key === PRIVATE_MEMO_VAULT_STORAGE_KEY && vaultReads++ === 1) {
        realSetItem.call(window.localStorage, PRIVATE_MEMO_VAULT_STORAGE_KEY, concurrentVaultRaw)
        realSetItem.call(window.localStorage, JOURNAL_STORAGE_KEY, concurrentJournal)
      }
      return realGetItem.call(window.localStorage, key)
    })

    await expect(savePrivateMemoWithJournalShell(storage, [...loadEntries(), pending], pending, recoveryCode))
      .resolves.toBe(false)

    expect(window.localStorage.getItem(PRIVATE_MEMO_VAULT_STORAGE_KEY)).toBe(concurrentVaultRaw)
    expect(window.localStorage.getItem(JOURNAL_STORAGE_KEY)).toBe(concurrentJournal)
  })
})

function delegatedStorage(getItem: (key: string) => string | null): Storage {
  return {
    get length(): number { return window.localStorage.length },
    clear(): void { window.localStorage.clear() },
    getItem,
    key(index: number): string | null { return window.localStorage.key(index) },
    removeItem(key: string): void { window.localStorage.removeItem(key) },
    setItem(key: string, value: string): void { window.localStorage.setItem(key, value) },
  }
}

function allLocalStorageValues(): string {
  return [...Array(window.localStorage.length)]
    .flatMap((_, index) => {
      const key = window.localStorage.key(index)
      return key === null ? [] : [window.localStorage.getItem(key) ?? ""]
    })
    .join("\n")
}
