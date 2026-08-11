import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { JournalEntry } from "./journal-schema"
import { JOURNAL_STORAGE_KEY, PRIVATE_MEMO_VAULT_STORAGE_KEY } from "./journal-storage-keys"
import { writeVaultAndJournalAtomically } from "./private-memo-vault-storage"
import type { PrivateMemoVault } from "./private-memo-vault"

function entry(id: string): JournalEntry {
  return {
    id,
    kind: "post-session",
    date: "2026-08-05",
    savedAt: "2026-08-05T09:00:00.000Z",
    syncState: "local",
    system: "base",
    title: "가벼운 조깅",
    distanceKm: "8",
    durationMin: "45",
    avgPace: "5:30",
    rpe: 4,
    memo: "정상 기록",
  }
}

function vault(id: string): PrivateMemoVault {
  return {
    version: 1,
    records: {
      [id]: {
        encrypted: {
          version: 1,
          algorithm: "AES-GCM",
          derivation: "PBKDF2-SHA-256",
          iterations: 210_000,
          salt: "salt",
          iv: "iv",
          ciphertext: "ciphertext",
        },
      },
    },
  }
}

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  window.localStorage.clear()
})

describe("writeVaultAndJournalAtomically concurrent writers", () => {
  it("does not roll back over a valid pair written during failed confirmation", () => {
    const originalVault = JSON.stringify(vault("original"))
    const originalJournal = JSON.stringify([entry("original")])
    const concurrentVault = JSON.stringify(vault("concurrent"))
    const concurrentJournal = JSON.stringify([entry("concurrent")])
    window.localStorage.setItem(PRIVATE_MEMO_VAULT_STORAGE_KEY, originalVault)
    window.localStorage.setItem(JOURNAL_STORAGE_KEY, originalJournal)
    const realGet = Storage.prototype.getItem
    const realSet = Storage.prototype.setItem
    let writes = 0
    let replaced = false
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key: string, value: string) {
      realSet.call(this, key, value)
      if (key === PRIVATE_MEMO_VAULT_STORAGE_KEY || key === JOURNAL_STORAGE_KEY) writes += 1
    })
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (this: Storage, key: string) {
      if (!replaced && writes >= 2 && key === PRIVATE_MEMO_VAULT_STORAGE_KEY) {
        replaced = true
        realSet.call(window.localStorage, PRIVATE_MEMO_VAULT_STORAGE_KEY, concurrentVault)
        realSet.call(window.localStorage, JOURNAL_STORAGE_KEY, concurrentJournal)
      }
      return realGet.call(this, key)
    })

    expect(writeVaultAndJournalAtomically(
      window.localStorage,
      vault("next"),
      [entry("next")],
      { vault: originalVault, journal: originalJournal },
    )).toBe(false)
    expect(window.localStorage.getItem(PRIVATE_MEMO_VAULT_STORAGE_KEY)).toBe(concurrentVault)
    expect(window.localStorage.getItem(JOURNAL_STORAGE_KEY)).toBe(concurrentJournal)
  })
})
