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
import { canonicalJournalStorage, JOURNAL_DEVICE_POINTER_KEY, JOURNAL_DEVICE_PREFIX } from "./journal-device-storage"

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
})

describe("private memo vault and journal persistence", () => {
  it("restores the prior encrypted vault and journal shell after a partial canonical publication", async () => {
    const recoveryCode = createRecoveryCode()
    expect(saveSessionRecoveryCode(recoveryCode)).toBe(true)
    await expect(savePrivateEntry(privateEntry("original", "PRIVATE-LUNA-ORIGINAL"))).resolves.toEqual({ ok: true, total: 1 })
    const original = persistenceSnapshot()
    const realSet = Storage.prototype.setItem
    let faultInjected = false
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key: string, value: string) {
      realSet.call(this, key, value)
      // The paired record is now one immutable candidate. Fail after publishing
      // its real pointer, before confirmation, rather than a nonexistent v1 write.
      if (!faultInjected && key === JOURNAL_DEVICE_POINTER_KEY && value !== original.pointer) {
        faultInjected = true
        throw new Error("PartialCanonicalPublicationError")
      }
    })

    await expect(savePrivateEntry(privateEntry("new", "PRIVATE-LUNA-NEW"))).resolves.toEqual({ ok: false, total: 1 })
    expect(faultInjected).toBe(true)
    expectPriorPersistence(original)
    expect(allLocalStorageValues()).not.toContain("PRIVATE-LUNA-NEW")
  })

  it.each([
    { step: "candidate", label: "candidate generation" },
    { step: "pointer", label: "published pointer" },
  ])("restores both records when $label confirmation throws", async ({ step }) => {
    const recoveryCode = createRecoveryCode()
    expect(saveSessionRecoveryCode(recoveryCode)).toBe(true)
    await expect(savePrivateEntry(privateEntry("original", "PRIVATE-LUNA-ORIGINAL"))).resolves.toEqual({ ok: true, total: 1 })
    const original = persistenceSnapshot()
    const realSet = Storage.prototype.setItem
    const realGet = Storage.prototype.getItem
    let candidateKey: string | null = null
    let wrotePointer = false
    let throwConfirmation = true
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, storageKey: string, value: string) {
      realSet.call(this, storageKey, value)
      if (storageKey.startsWith(`${JOURNAL_DEVICE_PREFIX}generation:`) && JSON.parse(value).kind === "commit") candidateKey = storageKey
      if (storageKey === JOURNAL_DEVICE_POINTER_KEY && value !== original.pointer) wrotePointer = true
    })
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (this: Storage, storageKey: string) {
      if (throwConfirmation && ((step === "candidate" && storageKey === candidateKey)
        || (step === "pointer" && wrotePointer && storageKey === JOURNAL_DEVICE_POINTER_KEY))) {
        throwConfirmation = false
        throw new Error("ReadbackError")
      }
      return realGet.call(this, storageKey)
    })

    await expect(savePrivateEntry(privateEntry("new", "PRIVATE-LUNA-NEW"))).resolves.toEqual({ ok: false, total: 1 })
    expect(candidateKey).not.toBeNull()
    expect(throwConfirmation).toBe(false)
    if (step === "pointer") expect(wrotePointer).toBe(true)
    expectPriorPersistence(original)
    expect(allLocalStorageValues()).not.toContain("PRIVATE-LUNA-NEW")
  })

  it("keeps both prior records when the legacy source snapshot cannot be read", async () => {
    const recoveryCode = createRecoveryCode()
    expect(saveSessionRecoveryCode(recoveryCode)).toBe(true)
    await expect(savePrivateEntry(privateEntry("original", "PRIVATE-LUNA-ORIGINAL"))).resolves.toEqual({ ok: true, total: 1 })
    const original = persistenceSnapshot()
    const realGet = Storage.prototype.getItem
    let journalReads = 0
    let faultInjected = false
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (this: Storage, storageKey: string) {
      if (storageKey === JOURNAL_STORAGE_KEY && ++journalReads === 2) {
        faultInjected = true
        throw new Error("SnapshotReadError")
      }
      return realGet.call(this, storageKey)
    })

    await expect(savePrivateEntry(privateEntry("new", "PRIVATE-LUNA-NEW"))).resolves.toEqual({ ok: false, total: 1 })
    expect(faultInjected).toBe(true)
    expectPriorPersistence(original)
    expect(allLocalStorageValues()).not.toContain("PRIVATE-LUNA-NEW")
  })

  it("does not overwrite late legacy vault and journal writes while a private cipher await is pending", async () => {
    const recoveryCode = createRecoveryCode()
    expect(saveSessionRecoveryCode(recoveryCode)).toBe(true)
    const original = privateEntry("original", "PRIVATE-LUNA-ORIGINAL")
    const pending = privateEntry("pending", "PRIVATE-LUNA-PENDING")
    const concurrent = privateEntry("concurrent", "PRIVATE-LUNA-CONCURRENT")
    await expect(savePrivateEntry(original)).resolves.toEqual({ ok: true, total: 1 })
    const prior = persistenceSnapshot()
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
    const storage = delegatedStorage(key => realGetItem.call(window.localStorage, key))
    const encrypt = crypto.subtle.encrypt.bind(crypto.subtle)
    let lateWriterTriggered = false
    vi.spyOn(crypto.subtle, "encrypt").mockImplementationOnce(async (...args) => {
      const encrypted = await encrypt(...args)
      // An old client still writes physical v1 keys. This occurs inside the
      // actual cipher await, not incidentally during the source snapshot read.
      realSetItem.call(window.localStorage, PRIVATE_MEMO_VAULT_STORAGE_KEY, concurrentVaultRaw)
      realSetItem.call(window.localStorage, JOURNAL_STORAGE_KEY, concurrentJournal)
      lateWriterTriggered = true
      return encrypted
    })

    await expect(savePrivateMemoWithJournalShell(storage, [...loadEntries(), pending], pending, recoveryCode))
      .resolves.toBe(false)

    expect(lateWriterTriggered).toBe(true)
    expect(window.localStorage.getItem(PRIVATE_MEMO_VAULT_STORAGE_KEY)).toBe(concurrentVaultRaw)
    expect(window.localStorage.getItem(JOURNAL_STORAGE_KEY)).toBe(concurrentJournal)
    expect(window.localStorage.getItem(JOURNAL_DEVICE_POINTER_KEY)).toBe(prior.pointer)
    expect(window.localStorage.getItem(prior.headKey)).toBe(prior.headRaw)
    expect(() => canonicalJournalStorage(window.localStorage).getItem(JOURNAL_STORAGE_KEY))
      .toThrow("JOURNAL_DEVICE_STORAGE_UNCERTAIN")
    expect(allLocalStorageValues()).not.toContain("PRIVATE-LUNA-PENDING")
  })
})

function persistenceSnapshot() {
  const storage = canonicalJournalStorage(window.localStorage)
  const pointer = window.localStorage.getItem(JOURNAL_DEVICE_POINTER_KEY)
  if (pointer === null) throw new Error("Expected a confirmed canonical pointer")
  const headKey = `${JOURNAL_DEVICE_PREFIX}generation:${JSON.parse(pointer).head}`
  return {
    pointer, headKey, headRaw: window.localStorage.getItem(headKey),
    journal: storage.getItem(JOURNAL_STORAGE_KEY), vault: storage.getItem(PRIVATE_MEMO_VAULT_STORAGE_KEY),
    rawJournal: window.localStorage.getItem(JOURNAL_STORAGE_KEY), rawVault: window.localStorage.getItem(PRIVATE_MEMO_VAULT_STORAGE_KEY),
    generationKeys: Object.keys(window.localStorage).filter(key => key.startsWith(`${JOURNAL_DEVICE_PREFIX}generation:`)).sort(),
  }
}

function expectPriorPersistence(original: ReturnType<typeof persistenceSnapshot>): void {
  const storage = canonicalJournalStorage(window.localStorage)
  expect(storage.getItem(JOURNAL_STORAGE_KEY)).toBe(original.journal)
  expect(storage.getItem(PRIVATE_MEMO_VAULT_STORAGE_KEY)).toBe(original.vault)
  expect(window.localStorage.getItem(JOURNAL_DEVICE_POINTER_KEY)).toBe(original.pointer)
  expect(window.localStorage.getItem(original.headKey)).toBe(original.headRaw)
  expect(window.localStorage.getItem(JOURNAL_STORAGE_KEY)).toBe(original.rawJournal)
  expect(window.localStorage.getItem(PRIVATE_MEMO_VAULT_STORAGE_KEY)).toBe(original.rawVault)
  expect(Object.keys(window.localStorage).filter(key => key.startsWith(`${JOURNAL_DEVICE_PREFIX}generation:`)).sort())
    .toEqual(original.generationKeys)
  expect(allLocalStorageValues()).not.toContain("PRIVATE-LUNA-ORIGINAL")
}

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
