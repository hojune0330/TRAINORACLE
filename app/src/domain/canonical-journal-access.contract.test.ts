import { beforeEach, describe, expect, it } from "vitest"
import { canonicalJournalAccess } from "./canonical-journal-access"
import { acknowledgeCanonicalJournalStorage, canonicalJournalLegacySnapshots, canonicalJournalStorageStatus, initializeCanonicalJournalStorage } from "./canonical-journal-storage"
import { JOURNAL_STORAGE_KEY, LEGACY_JOURNAL_STORAGE_KEYS, PRIVATE_MEMO_VAULT_STORAGE_KEY } from "./journal-storage-keys"
import { writeJournalEntries } from "./journal-local-storage"
import { readVaultJournalStorageSnapshot, writeStorageValueWithReadback, writeVaultAndJournalAtomically } from "./private-memo-vault-storage"
import { deleteEntry, loadEntriesForPlanSafety, loadJournalEntriesSnapshot, restoreDeletedEntry } from "./journal-store"
import { setActiveLocalAccount } from "./account/local-journal-ownership"
import { parseJournalEntryForWrite, type EveningEntry } from "./journal-schema"

const entry: EveningEntry = { id: "synthetic-canonical-body", kind: "evening", date: "2026-10-12", savedAt: "2026-10-12T00:00:00Z", syncState: "local", sleepH: 7, sleepQuality: 4, weightKg: "", restingHr: "", painParts: {}, mood: 3, note: "", fieldProvenance: { painParts: { provenance: "EXPLICIT" } }, bodyPartMetadata: { schemaVersion: 1, observations: [{ id: "other_12345678-1234-4234-8234-123456789012", labelSnapshot: "SYNTHETIC_PART", severity: 2, note: "SYNTHETIC_PRIVATE" }] } }

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null) })

describe("canonical runtime access", () => {
  it("rejects raw low-level writes before bootstrap without initializing an empty record", () => {
    expect(writeJournalEntries(localStorage, [entry])).toBe(false)
    expect(writeVaultAndJournalAtomically(localStorage, { version: 1, records: {} }, [entry])).toBe(false)
    expect(loadEntriesForPlanSafety()).toEqual({ status: "uncertain" })
    expect(localStorage.getItem(JOURNAL_STORAGE_KEY)).toBeNull()
  })

  it("keeps new metadata untouched when the old app saves a stripped journal, [] or removes its key", async () => {
    const original = JSON.stringify([entry])
    localStorage.setItem(LEGACY_JOURNAL_STORAGE_KEYS.journal, original)
    expect((await initializeCanonicalJournalStorage(localStorage)).status).toBe("ready")
    expect(loadJournalEntriesSnapshot().readStatus).toBe("complete")
    const stripped = { ...entry, bodyPartMetadata: undefined }
    for (const oldWrite of [JSON.stringify([stripped]), "[]", null]) {
      if (oldWrite === null) localStorage.removeItem(LEGACY_JOURNAL_STORAGE_KEYS.journal)
      else localStorage.setItem(LEGACY_JOURNAL_STORAGE_KEYS.journal, oldWrite)
      expect(writeJournalEntries(localStorage, [])).toBe(false)
      expect(writeVaultAndJournalAtomically(localStorage, { version: 1, records: {} }, [])).toBe(false)
      expect(loadEntriesForPlanSafety()).toEqual({ status: "uncertain" })
      expect(localStorage.getItem(JOURNAL_STORAGE_KEY)).toBe(original)
      const status = canonicalJournalStorageStatus(localStorage)
      expect(status.status).toBe("conflict")
      if (status.status !== "conflict") throw new Error("fixture conflict missing")
      expect((await acknowledgeCanonicalJournalStorage(localStorage, status.conflictToken)).status).toBe("ready")
      expect(loadJournalEntriesSnapshot().entries[0]?.bodyPartMetadata).toEqual(entry.bodyPartMetadata)
    }
  })

  it("routes vault operations to new addresses without changing the old vault", async () => {
    const oldVault = JSON.stringify({ version: 1, records: {} })
    localStorage.setItem(LEGACY_JOURNAL_STORAGE_KEYS.vault, oldVault)
    await initializeCanonicalJournalStorage(localStorage)
    expect(writeVaultAndJournalAtomically(localStorage, { version: 1, records: {} }, [entry])).toBe(true)
    expect(readVaultJournalStorageSnapshot(localStorage)?.journal).toContain("SYNTHETIC_PRIVATE")
    expect(localStorage.getItem(LEGACY_JOURNAL_STORAGE_KEYS.vault)).toBe(oldVault)
    expect(localStorage.getItem(PRIVATE_MEMO_VAULT_STORAGE_KEY)).toBe(oldVault)
  })

  it("never patches global Storage and leaves unrelated keys alone", () => {
    const set = Storage.prototype.setItem
    const access = canonicalJournalAccess(localStorage)
    expect(access).not.toBe(localStorage)
    expect(canonicalJournalAccess(access)).toBe(access)
    access.setItem("synthetic.unrelated", "value")
    expect(access.getItem("synthetic.unrelated")).toBe("value")
    expect(() => access.getItem(JOURNAL_STORAGE_KEY)).toThrow("CANONICAL_JOURNAL_UNAVAILABLE")
    expect(() => access.clear()).toThrow("BULK_CLEAR_REQUIRES_LIFECYCLE")
    expect(Storage.prototype.setItem).toBe(set)
  })

  it("never rolls a concurrent future vault version back to an older version", async () => {
    await initializeCanonicalJournalStorage(localStorage)
    const previous = JSON.stringify({ version: 1, records: {} })
    localStorage.setItem(PRIVATE_MEMO_VAULT_STORAGE_KEY, previous)
    const future = JSON.stringify({ version: 99, records: {}, future: "SYNTHETIC" })
    const racing: Storage = {
      get length() { return localStorage.length },
      key: index => localStorage.key(index),
      getItem: key => localStorage.getItem(key),
      removeItem: key => localStorage.removeItem(key),
      clear: () => { throw new Error("unused") },
      setItem: (key, value) => localStorage.setItem(key, key === PRIVATE_MEMO_VAULT_STORAGE_KEY ? future : value),
    }
    expect(writeStorageValueWithReadback(racing, PRIVATE_MEMO_VAULT_STORAGE_KEY, previous, previous)).toBe(false)
    expect(localStorage.getItem(PRIVATE_MEMO_VAULT_STORAGE_KEY)).toBe(future)
  })

  it("restores under a new id and removes the retired original body copy only after confirmed save", async () => {
    expect(parseJournalEntryForWrite(entry)).not.toBeNull()
    localStorage.setItem(LEGACY_JOURNAL_STORAGE_KEYS.journal, JSON.stringify([entry]))
    await initializeCanonicalJournalStorage(localStorage)
    expect(deleteEntry(entry.id)).toMatchObject({ ok: true, trashed: true })
    const restored = restoreDeletedEntry(entry.id)
    expect(restored.ok).toBe(true)
    expect(restored.restoredId).not.toBe(entry.id)
    expect(restored.cleanupPending).toBeUndefined()
    const snapshot = loadJournalEntriesSnapshot()
    expect(snapshot.readStatus).toBe("complete")
    expect(snapshot.entries).toHaveLength(1)
    expect(snapshot.entries[0]?.bodyPartMetadata).toEqual(entry.bodyPartMetadata)
    for (const original of canonicalJournalLegacySnapshots(localStorage)) {
      const journal = new Map(original.values).get(LEGACY_JOURNAL_STORAGE_KEYS.journal)
      const originalEntries = journal === null || journal === undefined ? [] : JSON.parse(journal) as EveningEntry[]
      expect(originalEntries.some(item => item.id === entry.id)).toBe(false)
      // A lifecycle recovery snapshot may retain the newly restored active id;
      // deleting its content here would erase the successful restoration too.
      for (const item of originalEntries) {
        expect(item.id).toBe(restored.restoredId)
        expect(item.bodyPartMetadata).toEqual(entry.bodyPartMetadata)
      }
    }
    expect(localStorage.getItem(LEGACY_JOURNAL_STORAGE_KEYS.journal)).toBe("[]")
  })
})
