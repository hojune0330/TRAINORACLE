import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { canonicalJournalStorage, eraseJournalDeviceData, JOURNAL_DEVICE_KEYS, JOURNAL_DEVICE_POINTER_KEY,
  JOURNAL_DEVICE_PREFIX, journalDeviceTransaction, redactJournalDeviceLegacyRecord,
  writeJournalDeviceValues } from "./journal-device-storage"
import { deleteEntry, loadEntries, loadEntriesForPlanSafety, restoreDeletedEntry, saveEntry, savePrivateEntry,
  replaceEntriesOwnedByWithPrivateMemos, updatePrivateEntry, loadEntriesWithPrivateMemos } from "./journal-store"
import { setActiveLocalAccount, journalOwner } from "./account/local-journal-ownership"
import { loadTrash, dropFromTrash } from "./journal-trash"
import type { EveningEntry } from "./journal-schema"
import { createRecoveryCode } from "./account/private-note-crypto"
import { saveSessionRecoveryCode } from "./account/private-note-sync"
import { eraseAllLocalData } from "./erase-local-data"

const journalKey = JOURNAL_DEVICE_KEYS[0], ownerKey = JOURNAL_DEVICE_KEYS[2], trashKey = JOURNAL_DEVICE_KEYS[3]
const ownerA = "11111111-1111-4111-8111-111111111111", ownerB = "22222222-2222-4222-8222-222222222222"
function entry(id = "synthetic-a"): EveningEntry {
  return { id, kind: "evening", date: "2026-10-12", savedAt: "2026-10-12T00:00:00.000Z",
    syncState: "local", sleepH: 0, sleepQuality: 0, weightKg: "", restingHr: "", painParts: {}, mood: 0,
    note: "", fieldProvenance: { painParts: { provenance: "EXPLICIT" } }, bodyPartMetadata: {
      schemaVersion: 1, observations: [{ id: "other_11111111-1111-4111-8111-111111111111",
        labelSnapshot: "SYNTHETIC_PRIVATE_LABEL", severity: 4, note: "SYNTHETIC_PRIVATE_BODY_NOTE" }] } }
}
function rawNamespace(): string[] {
  return Object.keys(window.localStorage).filter(key => key.startsWith(JOURNAL_DEVICE_PREFIX))
}
function freshStorageHandle(): Storage {
  const raw = window.localStorage
  return { get length() { return raw.length }, key: raw.key.bind(raw), clear: raw.clear.bind(raw),
    getItem: raw.getItem.bind(raw), setItem: raw.setItem.bind(raw), removeItem: raw.removeItem.bind(raw) }
}
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null) })
afterEach(() => { vi.restoreAllMocks(); setActiveLocalAccount(null); localStorage.clear(); sessionStorage.clear() })

describe("isolated canonical device journal", () => {
  it("copies the coupled source once without deleting, rewriting or dual-writing the v1 original", () => {
    const original = JSON.stringify([entry()])
    localStorage.setItem(journalKey, original)
    const adapter = canonicalJournalStorage(localStorage)
    expect(adapter.getItem(journalKey)).toBe(original)
    expect(writeJournalDeviceValues(adapter, { [journalKey]: JSON.stringify([entry(), entry("synthetic-b")]) }, { [journalKey]: original })).toBe(true)
    expect(localStorage.getItem(journalKey)).toBe(original)
    expect(JSON.parse(adapter.getItem(journalKey)!)).toHaveLength(2)
    expect(rawNamespace().filter(key => key.includes("generation:"))).toHaveLength(2)
  })

  it("keeps an old writer's same-ID companion removal separate and uncertain after promotion", () => {
    const original = JSON.stringify([entry()])
    localStorage.setItem(journalKey, original)
    const adapter = canonicalJournalStorage(localStorage)
    expect(adapter.getItem(journalKey)).toBe(original)
    const pointer = localStorage.getItem(JOURNAL_DEVICE_POINTER_KEY)
    const { bodyPartMetadata: _private, ...oldEntry } = entry()
    const lateOriginal = JSON.stringify([oldEntry])
    localStorage.setItem(journalKey, lateOriginal)
    expect(() => adapter.getItem(journalKey)).toThrow("JOURNAL_DEVICE_STORAGE_UNCERTAIN")
    expect(loadEntriesForPlanSafety()).toEqual({ status: "uncertain" })
    expect(writeJournalDeviceValues(adapter, { [journalKey]: "[]" })).toBe(false)
    expect(localStorage.getItem(journalKey)).toBe(lateOriginal)
    expect(localStorage.getItem(JOURNAL_DEVICE_POINTER_KEY)).toBe(pointer)
    expect(rawNamespace().map(key => localStorage.getItem(key)).join("\n")).toContain("SYNTHETIC_PRIVATE_LABEL")
  })

  it("refuses a paused legacy delete snapshot instead of adopting journal plus tombstone", () => {
    const original = JSON.stringify([entry()])
    localStorage.setItem(journalKey, original)
    localStorage.setItem(JOURNAL_DEVICE_KEYS[4], JSON.stringify([{ id: entry().id, deletedAt: "2026-10-12T01:00:00Z" }]))
    expect(() => canonicalJournalStorage(localStorage).getItem(journalKey)).toThrow("JOURNAL_DEVICE_STORAGE_UNCERTAIN")
    expect(localStorage.getItem(journalKey)).toBe(original)
    expect(localStorage.getItem(JOURNAL_DEVICE_POINTER_KEY)).toBeNull()
  })

  it("keeps the legacy original intact when capture quota fails", () => {
    const original = JSON.stringify([entry()])
    localStorage.setItem(journalKey, original)
    const actual = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function(this: Storage, key, value) {
      if (key.startsWith(JOURNAL_DEVICE_PREFIX)) throw new DOMException("synthetic quota", "QuotaExceededError")
      actual.call(this, key, value)
    })
    expect(() => canonicalJournalStorage(localStorage).getItem(journalKey)).toThrow()
    expect(localStorage.getItem(journalKey)).toBe(original)
    expect(localStorage.getItem(JOURNAL_DEVICE_POINTER_KEY)).toBeNull()
    expect(rawNamespace()).toHaveLength(0)
  })

  it("detects a late source write during pointer confirmation and preserves both captures", () => {
    const original = JSON.stringify([entry()])
    localStorage.setItem(journalKey, original)
    const actual = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function(this: Storage, key, value) {
      actual.call(this, key, value)
      if (key === JOURNAL_DEVICE_POINTER_KEY) actual.call(this, journalKey, "[]")
    })
    expect(() => canonicalJournalStorage(localStorage).getItem(journalKey)).toThrow()
    expect(localStorage.getItem(journalKey)).toBe("[]")
    expect(rawNamespace().map(key => localStorage.getItem(key)).join("\n")).toContain("SYNTHETIC_PRIVATE_LABEL")
  })

  it("rejects a competing immutable sibling rather than ACKing a stale pointer overwrite", () => {
    localStorage.setItem(journalKey, JSON.stringify([entry()]))
    const adapter = canonicalJournalStorage(localStorage)
    adapter.getItem(journalKey)
    const before = localStorage.getItem(JOURNAL_DEVICE_POINTER_KEY)!
    const pointer = JSON.parse(before)
    const actual = Storage.prototype.setItem
    let injected = false
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function(this: Storage, key, value) {
      actual.call(this, key, value)
      if (!injected && key.includes("generation:") && JSON.parse(value).kind === "commit") {
        injected = true
        const candidate = JSON.parse(value)
        const rival = { ...candidate, id: "synthetic-rival", values: { ...candidate.values, [journalKey]: JSON.stringify([entry("synthetic-rival")]) } }
        actual.call(this, JOURNAL_DEVICE_PREFIX + "generation:synthetic-rival", JSON.stringify(rival))
        actual.call(this, JOURNAL_DEVICE_POINTER_KEY, JSON.stringify({ ...pointer, head: rival.id }))
      }
    })
    expect(writeJournalDeviceValues(adapter, { [journalKey]: JSON.stringify([entry("synthetic-local")]) })).toBe(false)
    expect(() => adapter.getItem(journalKey)).toThrow()
    const preserved = rawNamespace().map(key => localStorage.getItem(key)).join("\n")
    expect(preserved).toContain("synthetic-local")
    expect(preserved).toContain("synthetic-rival")
  })

  it("stages owner, tombstone, trash and journal in one published commit and rolls back rejected work", () => {
    localStorage.setItem(journalKey, JSON.stringify([entry()]))
    const adapter = canonicalJournalStorage(localStorage)
    adapter.getItem(journalKey)
    const pointer = localStorage.getItem(JOURNAL_DEVICE_POINTER_KEY)
    const rejected = journalDeviceTransaction(adapter, () => {
      adapter.setItem(journalKey, "[]")
      adapter.setItem(trashKey, JSON.stringify([{ entry: entry(), deletedAt: "2026-10-12T01:00:00Z" }]))
      expect(localStorage.getItem(JOURNAL_DEVICE_POINTER_KEY)).toBe(pointer)
      return false
    }, Boolean)
    expect(rejected.ok).toBe(false)
    expect(JSON.parse(adapter.getItem(journalKey)!)).toHaveLength(1)
    expect(adapter.getItem(trashKey)).toBeNull()
  })

  it("redacts explicit deletion from the v1 original and retained seed while keeping canonical trash recoverable", () => {
    localStorage.setItem(journalKey, JSON.stringify([entry(), entry("synthetic-other-owner")]))
    localStorage.setItem(ownerKey, JSON.stringify({ schemaVersion: 1, ownerByEntryId: { [entry().id]: ownerA, "synthetic-other-owner": ownerB } }))
    setActiveLocalAccount(ownerA)
    expect(deleteEntry(entry().id)).toMatchObject({ ok: true, trashed: true })
    expect(loadEntries()).toHaveLength(0)
    expect(loadTrash()).toHaveLength(1)
    expect(JSON.parse(localStorage.getItem(journalKey)!)).toEqual([entry("synthetic-other-owner")])
    expect(journalOwner("synthetic-other-owner")).toBe(ownerB)
    const restored = restoreDeletedEntry(entry().id)
    expect(restored.ok).toBe(true)
    expect(restored.restoredId).not.toBe(entry().id)
    expect(loadEntries()[0]?.bodyPartMetadata).toEqual(entry().bodyPartMetadata)
    expect(loadTrash()).toHaveLength(0)
  })

  it("permanently deletes private body data from current trash, old source and every retained seed", () => {
    localStorage.setItem(trashKey, JSON.stringify([{ entry: entry(), deletedAt: new Date().toISOString() }]))
    expect(loadTrash()).toHaveLength(1)
    expect(dropFromTrash(entry().id)).toBe(true)
    expect(loadTrash()).toHaveLength(0)
    expect(JSON.stringify(Object.values(localStorage))).not.toContain("SYNTHETIC_PRIVATE_LABEL")
  })

  it("bounds successful payload generations and retains no permanent medical edit history", () => {
    const adapter = canonicalJournalStorage(localStorage)
    expect(saveEntry(entry()).ok).toBe(true)
    for (let index = 0; index < 12; index++) {
      expect(writeJournalDeviceValues(adapter, { [ownerKey]: JSON.stringify({ schemaVersion: 1, ownerByEntryId: { synthetic: ownerA } }) })).toBe(true)
      expect(writeJournalDeviceValues(adapter, { [ownerKey]: null })).toBe(true)
    }
    expect(rawNamespace().filter(key => key.includes("generation:"))).toHaveLength(2)
  })

  it("fully erases payload copies and leaves an empty fence that cannot reimport an old cached writer", () => {
    const original = JSON.stringify([entry()])
    localStorage.setItem(journalKey, original)
    const adapter = canonicalJournalStorage(localStorage)
    adapter.getItem(journalKey)
    expect(eraseJournalDeviceData(localStorage, true)).toBe(true)
    expect(adapter.getItem(journalKey)).toBeNull()
    expect(JSON.stringify(Object.values(localStorage))).not.toContain("SYNTHETIC_PRIVATE_LABEL")
    localStorage.setItem(journalKey, original)
    expect(() => adapter.getItem(journalKey)).toThrow("JOURNAL_DEVICE_STORAGE_UNCERTAIN")
    expect(loadEntries()).toHaveLength(0)
  })

  it("preserves another owner's data during targeted redaction without same-ID metadata merging", () => {
    localStorage.setItem(journalKey, JSON.stringify([entry(), entry("other")]))
    const adapter = canonicalJournalStorage(localStorage)
    adapter.getItem(journalKey)
    expect(redactJournalDeviceLegacyRecord(adapter, entry().id)).toBe(true)
    expect(JSON.parse(localStorage.getItem(journalKey)!)).toEqual([entry("other")])
    // Redaction is not a journal mutation. The caller must perform its explicit
    // delete in the staged canonical transaction first.
    expect(JSON.parse(adapter.getItem(journalKey)!)).toEqual([entry(), entry("other")])
  })

  it.each(["redaction-seed", "first-legacy-redaction", "published-redaction"] as const)(
    "resumes an actual captured process-crash state at %s without claiming an incomplete permanent deletion", phase => {
      localStorage.setItem(trashKey, JSON.stringify([{ entry: entry(), deletedAt: new Date().toISOString() }]))
      expect(loadTrash()).toHaveLength(1)
      const actual = Storage.prototype.setItem
      let captured: [string, string][] | undefined
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(function(this: Storage, key, value) {
        actual.call(this, key, value)
        if (captured) return
        const pointer = JSON.parse(this.getItem(JOURNAL_DEVICE_POINTER_KEY)!)
        const head = JSON.parse(this.getItem(JOURNAL_DEVICE_PREFIX + "generation:" + pointer.head)!)
        const isSeed = key.includes("generation:") && JSON.parse(value).kind === "seed" && head.deletions?.length
        const isLegacy = key === trashKey && value === "[]" && head.deletions?.length
        const isPublished = key === JOURNAL_DEVICE_POINTER_KEY && head.cleanup?.length
        if ((phase === "redaction-seed" && isSeed) || (phase === "first-legacy-redaction" && isLegacy)
          || (phase === "published-redaction" && isPublished)) {
          captured = Object.keys(this).map(stored => [stored, this.getItem(stored)!])
          throw new Error("synthetic-process-termination")
        }
      })
      expect(dropFromTrash(entry().id)).toBe(false)
      expect(captured).toBeDefined()
      vi.restoreAllMocks()
      // Replay exactly the captured durable state in a fresh handle. Ordinary
      // catch/rollback above is deliberately excluded from this fresh process.
      localStorage.clear()
      for (const [key, value] of captured!) actual.call(localStorage, key, value)
      const fresh = canonicalJournalStorage(freshStorageHandle())
      expect(fresh.getItem(trashKey)).toBe("[]")
      expect(localStorage.getItem(trashKey)).toBe("[]")
      expect(JSON.stringify(Object.values(localStorage))).not.toContain("SYNTHETIC_PRIVATE_LABEL")
      expect(rawNamespace().filter(key => key.includes("generation:"))).toHaveLength(2)
    },
  )

  it("removes only the explicit owner's exact ID from legacy and canonical pending sync checkpoints", () => {
    const checkpointKey = "trainoracle.sync.recovery.v1.account." + ownerA
    const checkpoint = { version: 1, userId: ownerA, startedAt: new Date().toISOString(), entries: [entry()], tombstones: [] }
    localStorage.setItem(journalKey, JSON.stringify([entry()]))
    localStorage.setItem(ownerKey, JSON.stringify({ schemaVersion: 1, ownerByEntryId: { [entry().id]: ownerA } }))
    localStorage.setItem(checkpointKey, JSON.stringify(checkpoint))
    setActiveLocalAccount(ownerA)
    expect(deleteEntry(entry().id).ok).toBe(true)
    expect(JSON.parse(localStorage.getItem(checkpointKey)!).entries).toEqual([])
    expect(JSON.parse(canonicalJournalStorage(localStorage).getItem(checkpointKey)!).entries).toEqual([])
  })

  it("preserves a different owner's same-ID checkpoint and refuses silent cross-owner sanitization", () => {
    const checkpointKey = "trainoracle.sync.recovery.v1.account." + ownerB
    const checkpoint = JSON.stringify({ version: 1, userId: ownerB, startedAt: new Date().toISOString(), entries: [entry()], tombstones: [] })
    localStorage.setItem(journalKey, JSON.stringify([entry()]))
    localStorage.setItem(ownerKey, JSON.stringify({ schemaVersion: 1, ownerByEntryId: { [entry().id]: ownerA } }))
    localStorage.setItem(checkpointKey, checkpoint)
    setActiveLocalAccount(ownerA)
    expect(deleteEntry(entry().id).ok).toBe(false)
    expect(localStorage.getItem(checkpointKey)).toBe(checkpoint)
    expect(loadEntries()).toEqual([entry()])
  })

  it("does not erase raw scoped recovery outside the adapter when canonical erase quota fails", () => {
    const checkpointKey = "trainoracle.sync.recovery.v1.account." + ownerA
    const checkpoint = JSON.stringify({ version: 1, userId: ownerA, startedAt: new Date().toISOString(), entries: [entry()], tombstones: [] })
    localStorage.setItem(checkpointKey, checkpoint)
    const adapter = canonicalJournalStorage(localStorage)
    expect(adapter.getItem(checkpointKey)).toBe(checkpoint)
    const actual = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function(this: Storage, key, value) {
      if (key.startsWith(JOURNAL_DEVICE_PREFIX) && JSON.parse(value).kind === "seed") throw new DOMException("synthetic quota", "QuotaExceededError")
      actual.call(this, key, value)
    })
    expect(eraseAllLocalData().ok).toBe(false)
    expect(localStorage.getItem(checkpointKey)).toBe(checkpoint)
    expect(adapter.getItem(checkpointKey)).toBe(checkpoint)
  })

  it.each(["save-private", "replace-private"] as const)(
    "keeps the owner pin unpublished until cipher-ready %s and leaves no ghost owner on final quota failure", async mode => {
      setActiveLocalAccount(ownerA)
      const code = createRecoveryCode()
      expect(saveSessionRecoveryCode(code)).toBe(true)
      const adapter = canonicalJournalStorage(localStorage)
      expect(adapter.getItem(journalKey)).toBeNull()
      const pointer = localStorage.getItem(JOURNAL_DEVICE_POINTER_KEY)
      const privateEntry: EveningEntry = { ...entry(), memoPurpose: "PRIVATE_SELF_ONLY", note: "SYNTHETIC_PRIVATE_MEMO" }
      const attempts: { values: Record<string, string | null> }[] = []
      const actual = Storage.prototype.setItem
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(function(this: Storage, key, value) {
        if (key.startsWith(JOURNAL_DEVICE_PREFIX) && JSON.parse(value).kind === "commit") {
          attempts.push(JSON.parse(value))
          throw new DOMException("synthetic final-commit quota", "QuotaExceededError")
        }
        actual.call(this, key, value)
      })
      const result = mode === "save-private" ? await savePrivateEntry(privateEntry)
        : await replaceEntriesOwnedByWithPrivateMemos(ownerA, [privateEntry], [privateEntry], code)
      expect(result.ok).toBe(false)
      expect(attempts).toHaveLength(1)
      const candidate = attempts[0]!.values
      expect(JSON.parse(candidate[ownerKey]!).ownerByEntryId[privateEntry.id]).toBe(ownerA)
      expect(JSON.parse(candidate[journalKey]!)[0].note).toBe("")
      expect(JSON.parse(candidate[JOURNAL_DEVICE_KEYS[1]]!).records[privateEntry.id].encrypted.algorithm).toBe("AES-GCM")
      expect(adapter.getItem(ownerKey)).toBeNull()
      expect(adapter.getItem(JOURNAL_DEVICE_KEYS[1])).toBeNull()
      expect(loadEntries()).toEqual([])
      expect(localStorage.getItem(JOURNAL_DEVICE_POINTER_KEY)).toBe(pointer)
      expect(rawNamespace().filter(key => key.includes("generation:"))).toHaveLength(1)
      expect(JSON.stringify(Object.values(localStorage))).not.toContain("SYNTHETIC_PRIVATE_MEMO")
    },
  )

  it.each(["changed-owner", "unchanged-owner", "unbound"] as const)(
    "pins the whole owner ledger during an existing private edit without implicit adoption: %s", async mode => {
      setActiveLocalAccount(mode === "unbound" ? null : ownerA)
      const code = createRecoveryCode()
      expect(saveSessionRecoveryCode(code)).toBe(true)
      const original: EveningEntry = { ...entry(), memoPurpose: "PRIVATE_SELF_ONLY", note: "SYNTHETIC_INITIAL_PRIVATE" }
      expect((await savePrivateEntry(original)).ok).toBe(true)
      if (mode === "unbound") {
        setActiveLocalAccount(ownerA)
        expect(saveSessionRecoveryCode(code)).toBe(true)
      }
      const adapter = canonicalJournalStorage(localStorage)
      const beforeJournal = adapter.getItem(journalKey), beforeVault = adapter.getItem(JOURNAL_DEVICE_KEYS[1])
      const beforeOwners = adapter.getItem(ownerKey)
      const edited: EveningEntry = { ...original, savedAt: "2026-10-12T00:01:00.000Z", note: "SYNTHETIC_EDIT_PRIVATE" }
      let release!: () => void, reached!: () => void
      const paused = new Promise<void>(resolve => { release = resolve })
      const encryptStarted = new Promise<void>(resolve => { reached = resolve })
      const encrypt = crypto.subtle.encrypt.bind(crypto.subtle)
      vi.spyOn(crypto.subtle, "encrypt").mockImplementationOnce(async (...args) => {
        reached()
        await paused
        return encrypt(...args)
      })
      const pending = updatePrivateEntry(edited, original.savedAt)
      await encryptStarted
      const changedOwners = JSON.stringify({ schemaVersion: 1, ownerByEntryId: { [original.id]: ownerB } })
      if (mode === "changed-owner") {
        expect(writeJournalDeviceValues(adapter, { [ownerKey]: changedOwners }, { [ownerKey]: beforeOwners })).toBe(true)
      }
      // The active account, scope generation and recovery code did not change;
      // only the separately stored ledger can invalidate this pending edit.
      expect(adapter.getItem(journalKey)).toBe(beforeJournal)
      expect(adapter.getItem(JOURNAL_DEVICE_KEYS[1])).toBe(beforeVault)
      release()
      expect((await pending).ok).toBe(mode !== "changed-owner")
      expect(adapter.getItem(ownerKey)).toBe(mode === "changed-owner" ? changedOwners : beforeOwners)
      if (mode === "changed-owner") {
        expect(adapter.getItem(journalKey)).toBe(beforeJournal)
        expect(adapter.getItem(JOURNAL_DEVICE_KEYS[1])).toBe(beforeVault)
        expect(loadEntries()).toEqual([])
      } else {
        expect((await loadEntriesWithPrivateMemos())[0]).toMatchObject({
          id: original.id, savedAt: edited.savedAt, note: edited.note, bodyPartMetadata: original.bodyPartMetadata,
        })
        if (mode === "unbound") expect(journalOwner(original.id)).toBeNull()
      }
      expect(JSON.stringify(Object.values(localStorage))).not.toContain("SYNTHETIC_EDIT_PRIVATE")
    },
  )
})
