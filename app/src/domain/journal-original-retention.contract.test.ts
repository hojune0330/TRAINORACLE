import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { assertCanonicalJournalWritable, canonicalJournalLegacySnapshots, initializeCanonicalJournalStorage } from "./canonical-journal-storage"
import { dropFromTrash, emptyTrash, JOURNAL_TRASH_STORAGE_KEY, loadTrash, moveToTrash, purgeExpiredTrash, takeFromTrash, TRASH_LIMIT } from "./journal-trash"
import { deleteEntry, loadEntries, saveEntry } from "./journal-store"
import { permanentlyEraseJournalOriginals, retryPermanentJournalOriginalCleanup } from "./journal-original-retention"
import { assignJournalsToAccount, setActiveLocalAccount } from "./account/local-journal-ownership"
import { JOURNAL_OWNERSHIP_STORAGE_KEY, JOURNAL_STORAGE_KEY, JOURNAL_TOMBSTONES_STORAGE_KEY, LEGACY_JOURNAL_STORAGE_KEYS as KEYS, PRIVATE_MEMO_VAULT_STORAGE_KEY } from "./journal-storage-keys"
import { MEMO_PURPOSE, type PostSessionEntry } from "./journal-schema"

const NOW = Date.parse("2026-10-12T00:00:00Z")
const MANIFEST = "to-local-journal.migration.v1"
const SNAPSHOT_PREFIX = "to-local-journal.originals.v1."

function post(id: string, memo = `synthetic-private:${id}`): PostSessionEntry {
  return { id, kind: "post-session", date: "2026-10-01", savedAt: "2026-10-01T00:00:00Z", syncState: "local",
    system: "base", title: "synthetic fixture", distanceKm: "", durationMin: "", avgPace: "", rpe: 0,
    memo, memoPurpose: MEMO_PURPOSE.analyzableTrainingNote }
}

function stored(): Map<string, string | null> {
  return new Map(Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))
    .filter((key): key is string => key !== null).map(key => [key, localStorage.getItem(key)]))
}

function allJournalCopies(): string {
  return [...stored()].filter(([key]) => key.startsWith("to-local-journal.") || Object.values(KEYS).some(base => key === base || key.startsWith(`${base}.account.`)))
    .map(([, raw]) => raw).join("\n")
}

function seed(entries: readonly PostSessionEntry[], owners: Record<string, string> = {}): void {
  localStorage.setItem(KEYS.journal, JSON.stringify(entries))
  localStorage.setItem(KEYS.ownership, JSON.stringify({ schemaVersion: 1, ownerByEntryId: owners }))
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  setActiveLocalAccount(null)
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  setActiveLocalAccount(null)
})

describe("permanent journal deletion includes preserved migration originals", () => {
  it("removes one guest id from every archived original and legacy source while keeping another journal intact", async () => {
    seed([post("erase-a"), post("keep-b")])
    await initializeCanonicalJournalStorage(localStorage, sessionStorage)
    const oldSnapshotKeys = canonicalJournalLegacySnapshots(localStorage).map(item => item.key)
    expect(deleteEntry("erase-a")).toMatchObject({ ok: true, trashed: true })
    expect(allJournalCopies()).toContain("synthetic-private:erase-a")

    expect(dropFromTrash("erase-a")).toBe(true)

    expect(allJournalCopies()).not.toContain("synthetic-private:erase-a")
    expect(allJournalCopies()).toContain("synthetic-private:keep-b")
    for (const key of oldSnapshotKeys) expect(localStorage.getItem(key)).toBeNull()
    expect(loadEntries().map(item => item.id)).toEqual(["keep-b"])
    expect(loadTrash()).toEqual([])
    expect(JSON.parse(localStorage.getItem(JOURNAL_TOMBSTONES_STORAGE_KEY) ?? "[]")).toEqual([
      { id: "erase-a", deletedAt: new Date(NOW).toISOString() },
    ])
    expect(() => assertCanonicalJournalWritable(localStorage)).not.toThrow()
    await initializeCanonicalJournalStorage(localStorage, sessionStorage)
    expect(loadEntries().map(item => item.id)).toEqual(["keep-b"])
  })

  it("emptying A's trash removes only A's source and archived body and preserves B's private recovery copy", async () => {
    seed([post("a"), post("b")], { a: "synthetic-account-a", b: "synthetic-account-b" })
    await initializeCanonicalJournalStorage(localStorage, sessionStorage)
    setActiveLocalAccount("synthetic-account-a")
    expect(deleteEntry("a")).toMatchObject({ ok: true, trashed: true })
    setActiveLocalAccount("synthetic-account-b")
    expect(deleteEntry("b")).toMatchObject({ ok: true, trashed: true })
    setActiveLocalAccount("synthetic-account-a")

    expect(emptyTrash()).toBe(true)

    expect(allJournalCopies()).not.toContain("synthetic-private:a")
    expect(allJournalCopies()).toContain("synthetic-private:b")
    expect(JSON.parse(localStorage.getItem(JOURNAL_TRASH_STORAGE_KEY) ?? "[]").map((item: { entry: { id: string } }) => item.entry.id)).toEqual(["b"])
    expect(JSON.parse(localStorage.getItem(JOURNAL_OWNERSHIP_STORAGE_KEY) ?? "null").ownerByEntryId)
      .toEqual({ a: "synthetic-account-a", b: "synthetic-account-b" })
    expect(dropFromTrash("b")).toBe(false)
    setActiveLocalAccount("synthetic-account-b")
    expect(loadTrash().map(item => item.entry.id)).toEqual(["b"])
  })

  it("follows an explicit guest-to-account claim for earlier revisions of the same stable entry id", async () => {
    seed([post("claimed-a")])
    await initializeCanonicalJournalStorage(localStorage, sessionStorage)
    expect(assignJournalsToAccount(["claimed-a"], "synthetic-claim-owner")).toBe(true)
    setActiveLocalAccount("synthetic-claim-owner")
    expect(deleteEntry("claimed-a")).toMatchObject({ ok: true, trashed: true })

    expect(dropFromTrash("claimed-a")).toBe(true)

    expect(allJournalCopies()).not.toContain("synthetic-private:claimed-a")
    expect(JSON.parse(localStorage.getItem(JOURNAL_OWNERSHIP_STORAGE_KEY) ?? "null").ownerByEntryId)
      .toEqual({ "claimed-a": "synthetic-claim-owner" })
  })

  it("refuses a conflicting non-null historical owner before any original or current trash mutation", async () => {
    seed([post("same-id")], { "same-id": "synthetic-old-owner" })
    await initializeCanonicalJournalStorage(localStorage, sessionStorage)
    localStorage.setItem(JOURNAL_OWNERSHIP_STORAGE_KEY, JSON.stringify({ schemaVersion: 1,
      ownerByEntryId: { "same-id": "synthetic-current-owner" } }))
    setActiveLocalAccount("synthetic-current-owner")
    expect(deleteEntry("same-id")).toMatchObject({ ok: true, trashed: true })
    const before = stored()

    expect(dropFromTrash("same-id")).toBe(false)

    expect(stored()).toEqual(before)
    expect(loadTrash().map(item => item.entry.id)).toEqual(["same-id"])
  })

  it("erases expired private bodies from source and archives and keeps unexpired data", async () => {
    const expired = { entry: post("expired-a"), deletedAt: "2026-09-01T00:00:00Z" }
    const fresh = { entry: post("fresh-b"), deletedAt: "2026-10-01T00:00:00Z" }
    seed([])
    localStorage.setItem(KEYS.trash, JSON.stringify([expired, fresh]))
    await initializeCanonicalJournalStorage(localStorage, sessionStorage)

    expect(purgeExpiredTrash(NOW)).toBe(1)

    expect(allJournalCopies()).not.toContain("synthetic-private:expired-a")
    expect(allJournalCopies()).toContain("synthetic-private:fresh-b")
    expect(loadTrash(NOW).map(item => item.entry.id)).toEqual(["fresh-b"])
  })

  it("erases quota-evicted entries from preserved copies before accepting a new trash record", async () => {
    const items = Array.from({ length: TRASH_LIMIT }, (_, index) => ({ entry: post(`old-${index}`),
      deletedAt: new Date(NOW - 60_000 + index).toISOString() }))
    seed([])
    localStorage.setItem(KEYS.trash, JSON.stringify(items))
    await initializeCanonicalJournalStorage(localStorage, sessionStorage)

    expect(moveToTrash(post("incoming"), new Date(NOW).toISOString())).toBe(true)

    expect(allJournalCopies()).not.toContain('synthetic-private:old-0"')
    expect(loadTrash().map(item => item.entry.id)).not.toContain("old-0")
    expect(loadTrash()).toHaveLength(TRASH_LIMIT)
    expect(loadTrash().map(item => item.entry.id)).toContain("incoming")
    expect(allJournalCopies()).toContain("synthetic-private:old-1")
  })

  it("erases targeted ciphertext and interrupted-sync copies as well as journal and trash bodies", async () => {
    const shell = { ...post("private-a", ""), memoPurpose: MEMO_PURPOSE.privateSelfOnly }
    seed([shell], { "private-a": "synthetic-private-owner" })
    localStorage.setItem(KEYS.vault, JSON.stringify({ version: 1, records: { "private-a": { encrypted: {
      version: 1, algorithm: "AES-GCM", derivation: "PBKDF2-SHA-256", iterations: 210_000,
      salt: "synthetic-salt", iv: "synthetic-iv", ciphertext: "synthetic-targeted-private-ciphertext",
    } } } }))
    localStorage.setItem(`${KEYS.syncRecovery}.account.synthetic-private-owner`, JSON.stringify({ version: 1,
      userId: "synthetic-private-owner", startedAt: "2026-10-01T00:00:00Z", entries: [shell], tombstones: [] }))
    await initializeCanonicalJournalStorage(localStorage, sessionStorage)
    setActiveLocalAccount("synthetic-private-owner")
    expect(deleteEntry("private-a")).toMatchObject({ ok: true, trashed: true })
    expect(allJournalCopies()).toContain("synthetic-targeted-private-ciphertext")

    expect(dropFromTrash("private-a")).toBe(true)

    expect(allJournalCopies()).not.toContain("synthetic-targeted-private-ciphertext")
    expect(JSON.parse(localStorage.getItem(PRIVATE_MEMO_VAULT_STORAGE_KEY) ?? '{"records":{}}').records).toEqual({})
    const checkpoint = JSON.parse(localStorage.getItem(`${KEYS.syncRecovery}.account.synthetic-private-owner`) ?? "null")
    expect(checkpoint.entries).toEqual([])
    expect(loadTrash()).toEqual([])
  })

  it("taking a trash entry for a restore rollback leaves preserved originals untouched", async () => {
    seed([post("undo-a")])
    await initializeCanonicalJournalStorage(localStorage, sessionStorage)
    expect(deleteEntry("undo-a")).toMatchObject({ ok: true, trashed: true })
    const manifest = localStorage.getItem(MANIFEST)
    const originals = new Map([...stored()].filter(([key]) => key.startsWith(SNAPSHOT_PREFIX)))

    const taken = takeFromTrash("undo-a")!
    expect(taken.entry.id).toBe("undo-a")
    expect(moveToTrash(taken.entry, taken.deletedAt, taken.privateMemo)).toBe(true)

    expect(localStorage.getItem(MANIFEST)).toBe(manifest)
    for (const [key, raw] of originals) expect(localStorage.getItem(key)).toBe(raw)
    expect(loadTrash().map(item => item.entry.id)).toEqual(["undo-a"])
  })

  it("retries a cleanup that failed before its durable intent after a new-id restore without touching the restored record", async () => {
    seed([post("restore-old")])
    await initializeCanonicalJournalStorage(localStorage, sessionStorage)
    expect(deleteEntry("restore-old")).toMatchObject({ ok: true, trashed: true })
    const taken = takeFromTrash("restore-old")!
    expect(saveEntry(post("restore-new", "synthetic-restored-content")).ok).toBe(true)
    const realSet = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (this === localStorage && key.startsWith(SNAPSHOT_PREFIX)) throw new DOMException("quota")
      realSet.call(this, key, value)
    })
    expect(permanentlyEraseJournalOriginals(localStorage, [taken])).toBe(false)
    expect(allJournalCopies()).toContain("synthetic-private:restore-old")
    expect(loadEntries().map(item => item.id)).toEqual(["restore-new"])

    vi.restoreAllMocks()
    expect(retryPermanentJournalOriginalCleanup(localStorage)).toBe(true)
    expect(allJournalCopies()).not.toContain("synthetic-private:restore-old")
    expect(allJournalCopies()).toContain("synthetic-restored-content")
    expect(loadEntries().map(item => item.id)).toEqual(["restore-new"])
    const after = stored()
    expect(retryPermanentJournalOriginalCleanup(localStorage)).toBe(true)
    expect(stored()).toEqual(after)
  })

  it("does not sweep any body whose 30-day trash recovery window remains open", async () => {
    seed([post("still-recoverable")])
    await initializeCanonicalJournalStorage(localStorage, sessionStorage)
    expect(deleteEntry("still-recoverable")).toMatchObject({ ok: true, trashed: true })
    const before = stored()

    expect(retryPermanentJournalOriginalCleanup(localStorage)).toBe(true)

    expect(stored()).toEqual(before)
    expect(loadTrash().map(item => item.entry.id)).toEqual(["still-recoverable"])
  })

  it("does not claim expiry cleanup when a conflicting historical owner keeps the private recovery copy", async () => {
    seed([], { "expired-conflict": "synthetic-old-owner" })
    localStorage.setItem(KEYS.trash, JSON.stringify([{ entry: post("expired-conflict"), deletedAt: "2026-09-01T00:00:00Z" }]))
    await initializeCanonicalJournalStorage(localStorage, sessionStorage)
    localStorage.setItem(JOURNAL_OWNERSHIP_STORAGE_KEY, JSON.stringify({ schemaVersion: 1,
      ownerByEntryId: { "expired-conflict": "synthetic-current-owner" } }))
    const before = stored()

    expect(purgeExpiredTrash(NOW)).toBe(0)
    expect(retryPermanentJournalOriginalCleanup(localStorage)).toBe(false)

    expect(stored()).toEqual(before)
    expect(allJournalCopies()).toContain("synthetic-private:expired-conflict")
  })

  it("a failed archived-copy removal reports failure and remains held until validated cleanup resumes", async () => {
    seed([post("retry-a")])
    await initializeCanonicalJournalStorage(localStorage, sessionStorage)
    expect(deleteEntry("retry-a")).toMatchObject({ ok: true, trashed: true })
    const blockedKey = canonicalJournalLegacySnapshots(localStorage)[0]!.key
    const realRemove = Storage.prototype.removeItem
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(function (this: Storage, key) {
      if (this === localStorage && key === blockedKey) throw new DOMException("blocked")
      realRemove.call(this, key)
    })

    expect(dropFromTrash("retry-a")).toBe(false)
    expect(() => assertCanonicalJournalWritable(localStorage)).toThrow()
    expect(localStorage.getItem(blockedKey)).not.toBeNull()

    vi.restoreAllMocks()
    await initializeCanonicalJournalStorage(localStorage, sessionStorage)
    expect(() => assertCanonicalJournalWritable(localStorage)).not.toThrow()
    expect(localStorage.getItem(blockedKey)).toBeNull()
    expect(allJournalCopies()).not.toContain("synthetic-private:retry-a")
    expect(loadEntries()).toEqual([])
    expect(loadTrash()).toEqual([])
    expect(localStorage.getItem(JOURNAL_STORAGE_KEY)).toBe("[]")
  })
})
