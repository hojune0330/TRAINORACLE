import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { eraseAllLocalData, erasableKeys } from "./erase-local-data"
import { assertCanonicalJournalWritable, initializeCanonicalJournalStorage } from "./canonical-journal-storage"
import { JOURNAL_OWNERSHIP_STORAGE_KEY, JOURNAL_STORAGE_KEY, JOURNAL_TOMBSTONES_STORAGE_KEY, PRIVATE_MEMO_VAULT_STORAGE_KEY, PRIVATE_NOTE_RECOVERY_STORAGE_KEY } from "./journal-storage-keys"
import { loadEntries } from "./journal-store"
import { setActiveLocalAccount } from "./account/local-journal-ownership"

const MANIFEST_KEY = "to-local-journal.migration.v1"
const ORIGINAL_PREFIX = "to-local-journal.originals.v1."
const LEGACY_JOURNAL_KEY = "trainoracle.journal.v1"
const LEGACY_OWNERSHIP_KEY = "trainoracle.journal.ownership.v1"
const LEGACY_TOMBSTONES_KEY = "trainoracle.sync.tombstones.v1"
const LEGACY_CONTENT_KEYS = [LEGACY_JOURNAL_KEY, "trainoracle.journal.trash.v1", "trainoracle.private-memo.v1", "trainoracle.sync.recovery.v1"]

function localKeys(): string[] {
  return Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))
    .filter((key): key is string => key !== null)
}

function seedLegacy(): void {
  const entry = { id: "live-a", kind: "post-session", date: "2026-10-01", savedAt: "2026-10-01T00:00:00Z",
    syncState: "local", system: "base", title: "synthetic fixture", distanceKm: "", durationMin: "",
    avgPace: "", rpe: 0, memo: "synthetic-private-original", memoPurpose: "ANALYZABLE_TRAINING_NOTE" }
  localStorage.setItem(LEGACY_JOURNAL_KEY, JSON.stringify([entry]))
  localStorage.setItem("trainoracle.journal.trash.v1", JSON.stringify([{ entry, deletedAt: "2026-10-01T00:00:00Z" }]))
  localStorage.setItem("trainoracle.private-memo.v1", JSON.stringify({ version: 1, records: { "live-a": { encrypted: {
    version: 1, algorithm: "AES-GCM", derivation: "PBKDF2-SHA-256", iterations: 210_000,
    salt: "synthetic-salt", iv: "synthetic-iv", ciphertext: "synthetic-private-ciphertext",
  } } } }))
  localStorage.setItem("trainoracle.sync.recovery.v1", JSON.stringify({ version: 1, userId: "synthetic-owner-a",
    startedAt: "2026-10-01T00:00:00Z", entries: [entry], tombstones: [] }))
  localStorage.setItem(LEGACY_TOMBSTONES_KEY, JSON.stringify([{ id: "deleted-a", deletedAt: "2026-10-01T00:00:00Z" }]))
  localStorage.setItem(LEGACY_OWNERSHIP_KEY, JSON.stringify({ schemaVersion: 1,
    ownerByEntryId: { "deleted-a": "synthetic-owner-a", "live-a": "synthetic-owner-a" } }))
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  setActiveLocalAccount(null)
})
afterEach(() => vi.restoreAllMocks())

describe("explicit local erasure across the journal migration boundary", () => {
  it("erases canonical data, every preserved original and diverged legacy content while retaining only deletion metadata", async () => {
    seedLegacy()
    await initializeCanonicalJournalStorage(localStorage, sessionStorage)
    const originals = localKeys().filter(key => key.startsWith(ORIGINAL_PREFIX))
    expect(originals.length).toBeGreaterThan(0)
    localStorage.setItem(JOURNAL_STORAGE_KEY, "synthetic-private-canonical-edit")
    localStorage.setItem(LEGACY_JOURNAL_KEY, "synthetic-private-legacy-edit")
    localStorage.setItem("another-app.private-state", "keep")
    expect(() => assertCanonicalJournalWritable(localStorage)).toThrow()
    expect(erasableKeys()).toEqual(expect.arrayContaining([...originals, JOURNAL_STORAGE_KEY, ...LEGACY_CONTENT_KEYS]))

    expect(eraseAllLocalData()).toMatchObject({ ok: true, failed: [] })

    for (const key of [...LEGACY_CONTENT_KEYS, JOURNAL_STORAGE_KEY, PRIVATE_MEMO_VAULT_STORAGE_KEY, ...originals]) {
      expect(localStorage.getItem(key)).toBeNull()
    }
    const retained = [{ id: "deleted-a", deletedAt: "2026-10-01T00:00:00Z" }]
    expect(JSON.parse(localStorage.getItem(JOURNAL_TOMBSTONES_STORAGE_KEY) ?? "null")).toEqual(retained)
    expect(JSON.parse(localStorage.getItem(JOURNAL_OWNERSHIP_STORAGE_KEY) ?? "null")).toEqual({
      schemaVersion: 1, ownerByEntryId: { "deleted-a": "synthetic-owner-a" },
    })
    expect(localKeys().filter(key => key.startsWith("to-local-journal.")).map(key => localStorage.getItem(key)).join("\n"))
      .not.toContain("synthetic-private")
    expect(localStorage.getItem("another-app.private-state")).toBe("keep")
    await initializeCanonicalJournalStorage(localStorage, sessionStorage)
    expect(loadEntries()).toEqual([])
    expect(() => assertCanonicalJournalWritable(localStorage)).not.toThrow()
  })

  it("clears old and current recovery credentials from local and session storage in every account scope", () => {
    const bases = [PRIVATE_NOTE_RECOVERY_STORAGE_KEY, "trainoracle.private-note.recovery.v1"]
    const keys = bases.flatMap(key => [key, `${key}.account.synthetic-a`, `${key}.account.synthetic-b`])
    for (const target of [localStorage, sessionStorage]) {
      for (const key of keys) target.setItem(key, "synthetic-recovery-credential")
      target.setItem("another-app.session-state", "keep")
    }
    expect(erasableKeys()).toEqual(expect.arrayContaining(keys))
    expect(eraseAllLocalData()).toMatchObject({ ok: true, failed: [] })
    for (const target of [localStorage, sessionStorage]) {
      for (const key of keys) expect(target.getItem(key)).toBeNull()
      expect(target.getItem("another-app.session-state")).toBe("keep")
    }
  })

  it("explicit full-trace erasure removes unreadable deletion metadata and unreadable archived private data without remigration", async () => {
    seedLegacy()
    await initializeCanonicalJournalStorage(localStorage, sessionStorage)
    localStorage.setItem(LEGACY_JOURNAL_KEY, "synthetic-unreadable-original")
    localStorage.setItem(JOURNAL_TOMBSTONES_STORAGE_KEY, "{malformed-deletion-record")
    localStorage.setItem(JOURNAL_OWNERSHIP_STORAGE_KEY, "{malformed-owner-map")
    localStorage.setItem(`${ORIGINAL_PREFIX}unreadable`, "synthetic-unreadable-preserved-copy")
    localStorage.setItem(PRIVATE_MEMO_VAULT_STORAGE_KEY, "synthetic-unreadable-vault")

    expect(eraseAllLocalData({ includeDeletionRecord: true })).toMatchObject({ ok: true, failed: [] })
    for (const key of [LEGACY_JOURNAL_KEY, LEGACY_TOMBSTONES_KEY, LEGACY_OWNERSHIP_KEY,
      JOURNAL_STORAGE_KEY, JOURNAL_TOMBSTONES_STORAGE_KEY, JOURNAL_OWNERSHIP_STORAGE_KEY, PRIVATE_MEMO_VAULT_STORAGE_KEY,
      `${ORIGINAL_PREFIX}unreadable`]) expect(localStorage.getItem(key)).toBeNull()
    const finalized = localStorage.getItem(MANIFEST_KEY)
    expect(finalized).not.toBeNull()
    await initializeCanonicalJournalStorage(localStorage, sessionStorage)
    expect(localStorage.getItem(MANIFEST_KEY)).toBe(finalized)
    expect(loadEntries()).toEqual([])
  })

  it("refuses default erasure when deletion metadata cannot be proven instead of clearing through ordinary key removal", async () => {
    seedLegacy()
    await initializeCanonicalJournalStorage(localStorage, sessionStorage)
    localStorage.setItem(JOURNAL_OWNERSHIP_STORAGE_KEY, "{unreadable-ownership")
    const before = new Map(localKeys().filter(key => key.startsWith("to-local-journal.") || LEGACY_CONTENT_KEYS.includes(key))
      .map(key => [key, localStorage.getItem(key)]))

    expect(eraseAllLocalData().ok).toBe(false)
    for (const [key, value] of before) expect(localStorage.getItem(key)).toBe(value)
  })

  it("does not remove any journal copy if the durable erase intent cannot be stored", async () => {
    seedLegacy()
    await initializeCanonicalJournalStorage(localStorage, sessionStorage)
    const before = new Map(localKeys().map(key => [key, localStorage.getItem(key)]))
    const realSet = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (this === localStorage && key === MANIFEST_KEY) throw new DOMException("quota")
      realSet.call(this, key, value)
    })

    expect(eraseAllLocalData({ includeDeletionRecord: true }).ok).toBe(false)
    for (const [key, value] of before) expect(localStorage.getItem(key)).toBe(value)
  })

  it("reports a retained canonical value after a silent removal failure and blocks writes until the fixed erase intent resumes", async () => {
    seedLegacy()
    await initializeCanonicalJournalStorage(localStorage, sessionStorage)
    const realRemove = Storage.prototype.removeItem
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(function (this: Storage, key) {
      if (this === localStorage && key === JOURNAL_STORAGE_KEY) return
      realRemove.call(this, key)
    })

    expect(eraseAllLocalData({ includeDeletionRecord: true })).toMatchObject({ ok: false,
      failed: expect.arrayContaining([JOURNAL_STORAGE_KEY]) })
    expect(() => assertCanonicalJournalWritable(localStorage)).toThrow()
    vi.restoreAllMocks()
    await initializeCanonicalJournalStorage(localStorage, sessionStorage)
    expect(() => assertCanonicalJournalWritable(localStorage)).not.toThrow()
    expect(localStorage.getItem(JOURNAL_STORAGE_KEY)).toBeNull()
    expect(loadEntries()).toEqual([])
  })

  it("reports an original archive that could not be removed and never treats the surviving private copy as completed erasure", async () => {
    seedLegacy()
    await initializeCanonicalJournalStorage(localStorage, sessionStorage)
    const original = localKeys().find(key => key.startsWith(ORIGINAL_PREFIX))!
    const realRemove = Storage.prototype.removeItem
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(function (this: Storage, key) {
      if (this === localStorage && key === original) throw new DOMException("blocked")
      realRemove.call(this, key)
    })

    expect(eraseAllLocalData({ includeDeletionRecord: true })).toMatchObject({ ok: false,
      failed: expect.arrayContaining([original]) })
    expect(localStorage.getItem(original)).not.toBeNull()
    expect(() => assertCanonicalJournalWritable(localStorage)).toThrow()
    vi.restoreAllMocks()
    await initializeCanonicalJournalStorage(localStorage, sessionStorage)
    expect(() => assertCanonicalJournalWritable(localStorage)).not.toThrow()
    expect(localStorage.getItem(original)).toBeNull()
  })
})
