import { beforeEach, describe, expect, it, vi } from "vitest"
import { CANONICAL_JOURNAL_MANIFEST_KEY, assertCanonicalJournalWritable, eraseCanonicalJournalStorage, initializeCanonicalJournalStorage, redactCanonicalJournalOriginals } from "./canonical-journal-storage"
import { JOURNAL_STORAGE_KEY, LEGACY_JOURNAL_STORAGE_KEYS, PRIVATE_MEMO_VAULT_STORAGE_KEY } from "./journal-storage-keys"
import { readVaultJournalStorageSnapshot, writeStorageValueWithReadback, writeVaultAndJournalAtomically } from "./private-memo-vault-storage"
import { writeJournalEntries } from "./journal-local-storage"
import { setActiveLocalAccount } from "./account/local-journal-ownership"
import type { PostSessionEntry } from "./journal-schema"
import type { PrivateMemoVault } from "./private-memo-vault"

function post(id: string): PostSessionEntry {
  return { id, kind: "post-session", date: "2026-10-12", savedAt: "2026-10-12T00:00:00Z", syncState: "local",
    system: "base", title: "synthetic fixture", distanceKm: "", durationMin: "", avgPace: "", rpe: 0, memo: "" }
}
function vault(ciphertext: string): PrivateMemoVault {
  return { version: 1, records: { "private-entry": { encrypted: { version: 1, algorithm: "AES-GCM",
    derivation: "PBKDF2-SHA-256", iterations: 210_000, salt: "synthetic-salt", iv: "synthetic-iv", ciphertext } } } }
}
const previousVault = vault("synthetic-private-before-erase")
const nextVault = vault("synthetic-pending-private-write")
const nextVaultRaw = JSON.stringify(nextVault)
const nextJournal = [post("pending-journal")]

function seed(): void {
  localStorage.setItem(PRIVATE_MEMO_VAULT_STORAGE_KEY, JSON.stringify(previousVault))
  localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify([post("existing-journal")]))
}

beforeEach(async () => {
  localStorage.clear()
  sessionStorage.clear()
  setActiveLocalAccount(null)
  await initializeCanonicalJournalStorage(localStorage, sessionStorage)
})

describe("journal writes and rollback remain in their original migration epoch", () => {
  it("stops the dependent journal write when full erasure finishes after the vault write", () => {
    seed()
    const snapshot = readVaultJournalStorageSnapshot(localStorage)!
    const beforeEpoch = localStorage.getItem(CANONICAL_JOURNAL_MANIFEST_KEY)
    let erased = false
    const realSet = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      realSet.call(this, key, value)
      if (this === localStorage && key === PRIVATE_MEMO_VAULT_STORAGE_KEY && value === nextVaultRaw) {
        erased = eraseCanonicalJournalStorage(localStorage, { includeDeletionRecord: true }).ok
      }
    })

    expect(writeVaultAndJournalAtomically(localStorage, nextVault, nextJournal, snapshot)).toBe(false)
    expect(erased).toBe(true)
    expect(localStorage.getItem(CANONICAL_JOURNAL_MANIFEST_KEY)).not.toBe(beforeEpoch)
    expect(localStorage.getItem(PRIVATE_MEMO_VAULT_STORAGE_KEY)).toBeNull()
    expect(localStorage.getItem(JOURNAL_STORAGE_KEY)).toBeNull()
  })

  it("does not roll a surviving unconfirmed vault back over a failed erase fence", () => {
    seed()
    const snapshot = readVaultJournalStorageSnapshot(localStorage)!
    const realSet = Storage.prototype.setItem
    const realRemove = Storage.prototype.removeItem
    let triggered = false
    let erased: boolean | null = null
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(function (this: Storage, key) {
      if (this === localStorage && key === PRIVATE_MEMO_VAULT_STORAGE_KEY) return
      realRemove.call(this, key)
    })
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      realSet.call(this, key, value)
      if (this === localStorage && key === PRIVATE_MEMO_VAULT_STORAGE_KEY && value === nextVaultRaw && !triggered) {
        triggered = true
        erased = eraseCanonicalJournalStorage(localStorage, { includeDeletionRecord: true }).ok
      }
    })

    expect(writeVaultAndJournalAtomically(localStorage, nextVault, nextJournal, snapshot)).toBe(false)
    expect(erased).toBe(false)
    expect(localStorage.getItem(PRIVATE_MEMO_VAULT_STORAGE_KEY)).toBe(nextVaultRaw)
    expect(localStorage.getItem(PRIVATE_MEMO_VAULT_STORAGE_KEY)).not.toContain("synthetic-private-before-erase")
    expect(() => assertCanonicalJournalWritable(localStorage)).toThrow()
  })

  it("does not roll a single journal write back after a newer failed erase intent", () => {
    seed()
    const before = localStorage.getItem(JOURNAL_STORAGE_KEY)
    const next = JSON.stringify(nextJournal)
    const realSet = Storage.prototype.setItem
    const realRemove = Storage.prototype.removeItem
    let triggered = false
    let erased: boolean | null = null
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(function (this: Storage, key) {
      if (this === localStorage && key === JOURNAL_STORAGE_KEY) return
      realRemove.call(this, key)
    })
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      realSet.call(this, key, value)
      if (this === localStorage && key === JOURNAL_STORAGE_KEY && value === next && !triggered) {
        triggered = true
        erased = eraseCanonicalJournalStorage(localStorage, { includeDeletionRecord: true }).ok
      }
    })

    expect(writeJournalEntries(localStorage, nextJournal, before)).toBe(false)
    expect(erased).toBe(false)
    expect(localStorage.getItem(JOURNAL_STORAGE_KEY)).toBe(next)
    expect(localStorage.getItem(JOURNAL_STORAGE_KEY)).not.toBe(before)
    expect(() => assertCanonicalJournalWritable(localStorage)).toThrow()
  })

  it("does not roll a single vault write back while a redaction is held for an unconfirmed vault replacement", () => {
    seed()
    const before = localStorage.getItem(PRIVATE_MEMO_VAULT_STORAGE_KEY)
    const emptyVaultRaw = JSON.stringify({ version: 1, records: {} })
    const realSet = Storage.prototype.setItem
    let redacting = false
    let redacted: boolean | null = null
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (this === localStorage && key === PRIVATE_MEMO_VAULT_STORAGE_KEY && value === emptyVaultRaw && redacting) return
      realSet.call(this, key, value)
      if (this === localStorage && key === PRIVATE_MEMO_VAULT_STORAGE_KEY && value === nextVaultRaw && !redacting) {
        redacting = true
        redacted = redactCanonicalJournalOriginals(localStorage, values => values.map(([legacy, raw]) =>
          [legacy, legacy === LEGACY_JOURNAL_STORAGE_KEYS.vault && raw !== null ? emptyVaultRaw : raw] as const)).ok
      }
    })

    expect(writeStorageValueWithReadback(localStorage, PRIVATE_MEMO_VAULT_STORAGE_KEY, nextVaultRaw, before)).toBe(false)
    expect(redacted).toBe(false)
    expect(localStorage.getItem(PRIVATE_MEMO_VAULT_STORAGE_KEY)).toBe(nextVaultRaw)
    expect(localStorage.getItem(PRIVATE_MEMO_VAULT_STORAGE_KEY)).not.toBe(before)
    expect(() => assertCanonicalJournalWritable(localStorage)).toThrow()
  })

  it("rejects an async write's pre-erase empty snapshot even when both raw values are still null", () => {
    const snapshot = readVaultJournalStorageSnapshot(localStorage)!
    expect(snapshot).toEqual({ vault: null, journal: null })
    expect(eraseCanonicalJournalStorage(localStorage, { includeDeletionRecord: true }).ok).toBe(true)
    const erasedEpoch = localStorage.getItem(CANONICAL_JOURNAL_MANIFEST_KEY)

    expect(writeVaultAndJournalAtomically(localStorage, nextVault, nextJournal, snapshot)).toBe(false)

    expect(localStorage.getItem(CANONICAL_JOURNAL_MANIFEST_KEY)).toBe(erasedEpoch)
    expect(localStorage.getItem(PRIVATE_MEMO_VAULT_STORAGE_KEY)).toBeNull()
    expect(localStorage.getItem(JOURNAL_STORAGE_KEY)).toBeNull()
  })

  it("preserves a complete future vault written concurrently with an atomic failure", () => {
    seed()
    const snapshot = readVaultJournalStorageSnapshot(localStorage)!
    const future = JSON.stringify({ version: 99, privateEnvelope: "synthetic-future-vault" })
    const realSet = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      realSet.call(this, key, value)
      if (this === localStorage && key === PRIVATE_MEMO_VAULT_STORAGE_KEY && value === nextVaultRaw) realSet.call(this, key, future)
    })

    expect(writeVaultAndJournalAtomically(localStorage, nextVault, nextJournal, snapshot)).toBe(false)

    expect(localStorage.getItem(PRIVATE_MEMO_VAULT_STORAGE_KEY)).toBe(future)
    expect(localStorage.getItem(JOURNAL_STORAGE_KEY)).toBe(snapshot.journal)
  })

  it("preserves a complete future journal instead of interpreting it as a partial write to undo", () => {
    seed()
    const before = localStorage.getItem(JOURNAL_STORAGE_KEY)
    const next = JSON.stringify(nextJournal)
    const future = JSON.stringify({ version: 99, entries: [post("future-journal")], privateEnvelope: "synthetic-future-data" })
    const realSet = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      realSet.call(this, key, value)
      if (this === localStorage && key === JOURNAL_STORAGE_KEY && value === next) realSet.call(this, key, future)
    })

    expect(writeJournalEntries(localStorage, nextJournal, before)).toBe(false)

    expect(localStorage.getItem(JOURNAL_STORAGE_KEY)).toBe(future)
  })

  it("still rolls a syntactically partial single-vault write back within the same epoch", () => {
    seed()
    const before = localStorage.getItem(PRIVATE_MEMO_VAULT_STORAGE_KEY)
    const epoch = localStorage.getItem(CANONICAL_JOURNAL_MANIFEST_KEY)
    const realSet = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (this === localStorage && key === PRIVATE_MEMO_VAULT_STORAGE_KEY && value === nextVaultRaw) {
        realSet.call(this, key, "{partial-write")
        throw new DOMException("quota")
      }
      realSet.call(this, key, value)
    })

    expect(writeStorageValueWithReadback(localStorage, PRIVATE_MEMO_VAULT_STORAGE_KEY, nextVaultRaw, before)).toBe(false)

    expect(localStorage.getItem(PRIVATE_MEMO_VAULT_STORAGE_KEY)).toBe(before)
    expect(localStorage.getItem(CANONICAL_JOURNAL_MANIFEST_KEY)).toBe(epoch)
    expect(() => assertCanonicalJournalWritable(localStorage)).not.toThrow()
  })

  it("still rolls its own partial atomic pair back within the same epoch", () => {
    seed()
    const snapshot = readVaultJournalStorageSnapshot(localStorage)!
    const epoch = localStorage.getItem(CANONICAL_JOURNAL_MANIFEST_KEY)
    const realSet = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (this === localStorage && key === JOURNAL_STORAGE_KEY && value === JSON.stringify(nextJournal)) {
        realSet.call(this, key, "{partial-journal-write")
        throw new DOMException("quota")
      }
      realSet.call(this, key, value)
    })

    expect(writeVaultAndJournalAtomically(localStorage, nextVault, nextJournal, snapshot)).toBe(false)

    expect(localStorage.getItem(PRIVATE_MEMO_VAULT_STORAGE_KEY)).toBe(snapshot.vault)
    expect(localStorage.getItem(JOURNAL_STORAGE_KEY)).toBe(snapshot.journal)
    expect(localStorage.getItem(CANONICAL_JOURNAL_MANIFEST_KEY)).toBe(epoch)
    expect(() => assertCanonicalJournalWritable(localStorage)).not.toThrow()
  })
})
