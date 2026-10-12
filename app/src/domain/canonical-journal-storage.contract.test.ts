import { webcrypto } from "node:crypto"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  acknowledgeCanonicalJournalStorage,
  assertCanonicalJournalWritable,
  assertCanonicalJournalReadable,
  CANONICAL_JOURNAL_MANIFEST_KEY,
  CANONICAL_JOURNAL_SNAPSHOT_PREFIX,
  CANONICAL_JOURNAL_LIFECYCLE_INTENT_PREFIX,
  canonicalJournalLegacySnapshots,
  canonicalJournalStorageKeys,
  canonicalJournalStorageStatus,
  initializeCanonicalJournalStorage,
  isCanonicalJournalWritable,
  legacyJournalStorageKeys,
  readCanonicalJournalManifest,
  eraseCanonicalJournalStorage,
  redactCanonicalJournalOriginals,
} from "./canonical-journal-storage"
import type { CanonicalJournalLockRunner } from "./canonical-journal-storage"
import {
  JOURNAL_LOCAL_STORAGE_KEY_MAPPINGS,
  JOURNAL_STORAGE_KEY,
  LEGACY_JOURNAL_STORAGE_KEYS as old,
  PRIVATE_MEMO_VAULT_STORAGE_KEY,
  PRIVATE_NOTE_RECOVERY_STORAGE_KEY,
  JOURNAL_OWNERSHIP_STORAGE_KEY,
  JOURNAL_TOMBSTONES_STORAGE_KEY,
  SYNC_RECOVERY_STORAGE_KEY,
} from "./journal-storage-keys"
import { memoPurposeOf } from "./journal-schema"

class MemoryStorage implements Storage {
  readonly values = new Map<string, string>()
  beforeSet?: (key: string, value: string) => void
  afterSet?: (key: string, value: string) => void
  beforeGet?: (key: string) => void
  beforeRemove?: (key: string) => void
  get length(): number { return this.values.size }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null }
  getItem(key: string): string | null { this.beforeGet?.(key); return this.values.get(key) ?? null }
  setItem(key: string, value: string): void { this.beforeSet?.(key, value); this.values.set(key, value); this.afterSet?.(key, value) }
  removeItem(key: string): void { this.beforeRemove?.(key); this.values.delete(key) }
  clear(): void { this.values.clear() }
}

const unlocked: CanonicalJournalLockRunner = async operation => operation()
function journal(id = "synthetic-entry") {
  return { id, kind: "post-session", date: "2026-10-12", savedAt: "2026-10-12T03:00:00Z", syncState: "local",
    system: "base", title: "Synthetic training", distanceKm: "4", durationMin: "25", avgPace: "6:15", rpe: 3,
    memo: "Synthetic historical text" }
}
function encrypted() {
  return { encrypted: { version: 1, algorithm: "AES-GCM", derivation: "PBKDF2-SHA-256", iterations: 210_000,
    salt: "synthetic-salt", iv: "synthetic-iv", ciphertext: "synthetic-ciphertext" } }
}
function seedBundle(target: Storage): void {
  target.setItem(old.journal, JSON.stringify([journal()], null, 2))
  target.setItem(old.vault, JSON.stringify({ version: 1, records: { "synthetic-entry": encrypted() } }, null, 2))
  target.setItem(old.ownership, JSON.stringify({ schemaVersion: 1, ownerByEntryId: { "synthetic-entry": "synthetic-owner" } }))
  target.setItem(old.trash, JSON.stringify([{ entry: journal("synthetic-deleted"), deletedAt: "2026-10-12T04:00:00Z", privateMemo: encrypted() }]))
  target.setItem(old.tombstones, JSON.stringify([{ id: "synthetic-deleted", deletedAt: "2026-10-12T04:00:00Z" }]))
  target.setItem(`${old.syncRecovery}.account.synthetic-owner`, JSON.stringify({ version: 1, userId: "synthetic-owner",
    startedAt: "2026-10-12T04:00:00Z", entries: [journal()], tombstones: [] }))
}

beforeEach(() => { vi.stubGlobal("crypto", webcrypto) })
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe("canonical local journal migration", () => {
  it("copies all companion bytes exactly, preserves originals and never persists a recovery code locally", async () => {
    const local = new MemoryStorage(), session = new MemoryStorage()
    seedBundle(local)
    session.setItem(old.privateNoteRecovery, "synthetic-recovery-code")
    session.setItem(`${old.privateNoteRecovery}.account.synthetic-owner`, "synthetic-owner-recovery-code")
    const originals = legacyJournalStorageKeys(local).map(key => [key, local.getItem(key)] as const)
    expect(await initializeCanonicalJournalStorage(local, session, unlocked)).toEqual({ status: "ready" })
    for (const mapping of JOURNAL_LOCAL_STORAGE_KEY_MAPPINGS) {
      expect(local.getItem(mapping.canonical)).toBe(local.getItem(mapping.legacy))
      expect(mapping.canonical.startsWith("trainoracle.")).toBe(false)
    }
    expect(local.getItem(`${SYNC_RECOVERY_STORAGE_KEY}.account.synthetic-owner`))
      .toBe(local.getItem(`${old.syncRecovery}.account.synthetic-owner`))
    expect(originals).toEqual(legacyJournalStorageKeys(local).map(key => [key, local.getItem(key)]))
    expect(canonicalJournalLegacySnapshots(local)[0]?.values).toEqual(originals)
    expect([...local.values.values()].join("\n")).not.toContain("synthetic-recovery-code")
    expect(session.getItem(PRIVATE_NOTE_RECOVERY_STORAGE_KEY)).toBe("synthetic-recovery-code")
    expect(session.getItem(old.privateNoteRecovery)).toBe("synthetic-recovery-code")
    expect(session.getItem(`${PRIVATE_NOTE_RECOVERY_STORAGE_KEY}.account.synthetic-owner`)).toBe("synthetic-owner-recovery-code")
    expect(local.getItem(PRIVATE_MEMO_VAULT_STORAGE_KEY)).toContain("synthetic-ciphertext")
    expect(isCanonicalJournalWritable(local)).toBe(true)
  })

  it("keeps private origin, legacy provenance normalization and supported metadata without reparsing the persisted bytes", async () => {
    const local = new MemoryStorage()
    const value = { ...journal(), memoPurpose: "legacy-purpose", fieldProvenance: { legacy: { provenance: "legacy" } },
      bodyPartMetadata: { schemaVersion: 1, observations: [{ id: "other_aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
        labelSnapshot: "Synthetic private label", severity: 2, note: "Synthetic private note" }] } }
    const original = JSON.stringify([value], null, 2)
    local.setItem(old.journal, original)
    expect(await initializeCanonicalJournalStorage(local, undefined, unlocked)).toEqual({ status: "ready" })
    expect(local.getItem(JOURNAL_STORAGE_KEY)).toBe(original)
    expect(memoPurposeOf(JSON.parse(local.getItem(JOURNAL_STORAGE_KEY)!)[0])).toBe("PRIVATE_SELF_ONLY")
  })

  it("starts a clean profile only after a locked, confirmed empty source snapshot", async () => {
    const local = new MemoryStorage()
    expect(canonicalJournalStorageStatus(local)).toEqual({ status: "unavailable", reason: "MIGRATION_INCOMPLETE" })
    expect(await initializeCanonicalJournalStorage(local, undefined, unlocked)).toEqual({ status: "ready" })
    expect(local.getItem(JOURNAL_STORAGE_KEY)).toBeNull()
    expect(readCanonicalJournalManifest(local)?.phase).toBe("ready")
  })

  it("fails closed without a migration lock but allows an already ready read without Web Locks", async () => {
    const local = new MemoryStorage()
    vi.stubGlobal("navigator", {})
    expect(await initializeCanonicalJournalStorage(local)).toEqual({ status: "unavailable", reason: "LOCK_UNAVAILABLE" })
    expect(local.length).toBe(0)
    expect(await initializeCanonicalJournalStorage(local, undefined, unlocked)).toEqual({ status: "ready" })
    expect(await initializeCanonicalJournalStorage(local)).toEqual({ status: "ready" })
  })

  it.each([
    [old.journal, "{broken", "SOURCE_CORRUPT"],
    [old.journal, JSON.stringify([journal(), { ...journal("unsupported"), bodyPartMetadata: { schemaVersion: 99, observations: [] } }]), "SOURCE_UNSUPPORTED"],
    [old.journal, JSON.stringify([{ ...journal(), futurePrivateCompanion: { schemaVersion: 9 } }]), "SOURCE_UNSUPPORTED"],
    [old.vault, JSON.stringify({ version: 99, records: {} }), "SOURCE_UNSUPPORTED"],
    [old.ownership, JSON.stringify({ schemaVersion: 1, ownerByEntryId: { x: null } }), "SOURCE_CORRUPT"],
    [old.trash, JSON.stringify([{ entry: null, deletedAt: "synthetic-time" }]), "SOURCE_CORRUPT"],
    [old.tombstones, JSON.stringify([{ id: "", deletedAt: "synthetic-time" }]), "SOURCE_CORRUPT"],
    [`${old.syncRecovery}.account.owner-A`, JSON.stringify({ version: 1, userId: "owner-B", startedAt: "2026-10-12T04:00:00Z", entries: [], tombstones: [] }), "SOURCE_CORRUPT"],
  ])("refuses invalid source %s and retains its bytes", async (key, raw, reason) => {
    const local = new MemoryStorage()
    local.setItem(key, raw)
    expect(await initializeCanonicalJournalStorage(local, undefined, unlocked)).toEqual({ status: "unavailable", reason })
    expect(local.getItem(key)).toBe(raw)
    expect(canonicalJournalStorageKeys(local)).toEqual([])
  })

  it("never overwrites an unrecognized existing canonical value or marker", async () => {
    for (const [key, raw] of [[JOURNAL_STORAGE_KEY, "[]"], [CANONICAL_JOURNAL_MANIFEST_KEY, '{"schemaVersion":99}']]) {
      const local = new MemoryStorage()
      local.setItem(key!, raw!)
      expect((await initializeCanonicalJournalStorage(local, undefined, unlocked)).status).toBe("unavailable")
      expect(local.getItem(key!)).toBe(raw)
    }
  })

  it("holds old edits, additions, deletion and namespace-prefix erase without merging into canonical data", async () => {
    const local = new MemoryStorage()
    seedBundle(local)
    await initializeCanonicalJournalStorage(local, undefined, unlocked)
    const canonical = local.getItem(JOURNAL_STORAGE_KEY)
    local.setItem(old.journal, JSON.stringify([journal("old-app-edit")]))
    expect(canonicalJournalStorageStatus(local).status).toBe("conflict")
    expect(() => assertCanonicalJournalWritable(local)).toThrow("CANONICAL_JOURNAL_UNAVAILABLE")
    for (const key of [...local.values.keys()].filter(key => key.startsWith("trainoracle."))) local.removeItem(key)
    expect(canonicalJournalStorageStatus(local).status).toBe("conflict")
    expect(local.getItem(JOURNAL_STORAGE_KEY)).toBe(canonical)
    expect(canonicalJournalLegacySnapshots(local)[0]?.values.some(([, raw]) => raw?.includes("synthetic-ciphertext"))).toBe(true)
  })

  it("a new account-scoped legacy checkpoint is a conflict even when existing legacy bytes are unchanged", async () => {
    const local = new MemoryStorage()
    await initializeCanonicalJournalStorage(local, undefined, unlocked)
    local.setItem(`${old.syncRecovery}.account.synthetic-owner`, JSON.stringify({ version: 1, userId: "synthetic-owner",
      startedAt: "2026-10-12T04:00:00Z", entries: [], tombstones: [] }))
    expect(canonicalJournalStorageStatus(local).status).toBe("conflict")
  })

  it("acknowledges keeping canonical data only after preserving every accepted legacy revision", async () => {
    const local = new MemoryStorage()
    seedBundle(local)
    await initializeCanonicalJournalStorage(local, undefined, unlocked)
    const canonical = local.getItem(JOURNAL_STORAGE_KEY)
    for (const id of ["legacy-revision-2", "legacy-revision-3"]) {
      const legacy = JSON.stringify([journal(id)], null, 2)
      local.setItem(old.journal, legacy)
      const status = canonicalJournalStorageStatus(local)
      expect(status.status).toBe("conflict")
      if (status.status !== "conflict") throw new Error("Missing conflict")
      expect(await acknowledgeCanonicalJournalStorage(local, status.conflictToken, unlocked)).toEqual({ status: "ready" })
      expect(canonicalJournalLegacySnapshots(local).some(snapshot => snapshot.values.some(([key, raw]) => key === old.journal && raw === legacy))).toBe(true)
    }
    expect(local.getItem(JOURNAL_STORAGE_KEY)).toBe(canonical)
    expect(canonicalJournalLegacySnapshots(local)).toHaveLength(3)
  })

  it("refuses a stale confirmation after either side changes", async () => {
    const local = new MemoryStorage()
    seedBundle(local)
    await initializeCanonicalJournalStorage(local, undefined, unlocked)
    local.setItem(old.journal, JSON.stringify([journal("first-conflict")]))
    const status = canonicalJournalStorageStatus(local)
    if (status.status !== "conflict") throw new Error("Missing conflict")
    local.setItem(JOURNAL_STORAGE_KEY, JSON.stringify([journal("newer-canonical")]))
    expect(await acknowledgeCanonicalJournalStorage(local, status.conflictToken, unlocked)).toEqual({ status: "unavailable", reason: "STALE_CONFIRMATION" })
    expect(canonicalJournalStorageStatus(local).status).toBe("conflict")
    expect(local.getItem(JOURNAL_STORAGE_KEY)).toContain("newer-canonical")
  })

  it("detects corrupt canonical data or a missing baseline instead of treating it as an empty journal", async () => {
    const local = new MemoryStorage()
    await initializeCanonicalJournalStorage(local, undefined, unlocked)
    local.setItem(JOURNAL_STORAGE_KEY, "{broken")
    expect(canonicalJournalStorageStatus(local)).toEqual({ status: "unavailable", reason: "CANONICAL_CORRUPT" })
    local.removeItem(JOURNAL_STORAGE_KEY)
    local.removeItem(readCanonicalJournalManifest(local)!.comparisonSnapshotKey)
    expect(canonicalJournalStorageStatus(local)).toEqual({ status: "unavailable", reason: "CANONICAL_CORRUPT" })
  })

  it("does not silently overwrite a different tab-local recovery code", async () => {
    const local = new MemoryStorage(), session = new MemoryStorage()
    session.setItem(old.privateNoteRecovery, "synthetic-old-code")
    session.setItem(PRIVATE_NOTE_RECOVERY_STORAGE_KEY, "synthetic-new-code")
    expect(await initializeCanonicalJournalStorage(local, session, unlocked)).toEqual({ status: "ready" })
    expect(session.getItem(PRIVATE_NOTE_RECOVERY_STORAGE_KEY)).toBe("synthetic-new-code")
  })

  it("never reimports an old session code after a confirmed migration and explicit clear", async () => {
    const local = new MemoryStorage(), session = new MemoryStorage()
    session.setItem(old.privateNoteRecovery, "synthetic-retained-old-code")
    await initializeCanonicalJournalStorage(local, session, unlocked)
    session.removeItem(PRIVATE_NOTE_RECOVERY_STORAGE_KEY)
    expect(await initializeCanonicalJournalStorage(local, session, unlocked)).toEqual({ status: "ready" })
    expect(session.getItem(PRIVATE_NOTE_RECOVERY_STORAGE_KEY)).toBeNull()
    expect(session.getItem(old.privateNoteRecovery)).toBe("synthetic-retained-old-code")
  })

  it("retains uncertain-read compatibility for malformed current rows but blocks unknown versions and all writes", async () => {
    const local = new MemoryStorage()
    await initializeCanonicalJournalStorage(local, undefined, unlocked)
    local.setItem(JOURNAL_STORAGE_KEY, JSON.stringify([journal(), { invalid: true }]))
    expect(() => assertCanonicalJournalReadable(local)).not.toThrow()
    expect(() => assertCanonicalJournalWritable(local)).toThrow()
    expect(canonicalJournalStorageStatus(local)).toEqual({ status: "unavailable", reason: "CANONICAL_CORRUPT" })
    local.setItem(JOURNAL_STORAGE_KEY, JSON.stringify([{ invalid: true }, { ...journal(), bodyPartMetadata: { schemaVersion: 99, observations: [] } }]))
    expect(() => assertCanonicalJournalReadable(local)).toThrow()
    expect(canonicalJournalStorageStatus(local)).toEqual({ status: "unavailable", reason: "CANONICAL_UNSUPPORTED" })
  })
})

describe("canonical original lifecycle transactions", () => {
  it("erases all original content and finishes a minimal marker that prevents remigration", async () => {
    const local = new MemoryStorage()
    seedBundle(local)
    local.setItem(old.ownership, JSON.stringify({ schemaVersion: 1, ownerByEntryId: {
      "synthetic-entry": "synthetic-owner", "synthetic-deleted": "synthetic-owner",
    } }))
    await initializeCanonicalJournalStorage(local, undefined, unlocked)
    local.setItem(old.journal, JSON.stringify([journal("older-binary-write")]))
    const oldSnapshotKeys = canonicalJournalStorageKeys(local).filter(key => key.startsWith(CANONICAL_JOURNAL_SNAPSHOT_PREFIX))
    expect(eraseCanonicalJournalStorage(local).ok).toBe(true)
    expect(readCanonicalJournalManifest(local)?.phase).toBe("erased")
    expect(canonicalJournalStorageStatus(local)).toEqual({ status: "ready" })
    expect(oldSnapshotKeys.every(key => local.getItem(key) === null)).toBe(true)
    expect([...local.values.values()].join("\n")).not.toContain("Synthetic historical text")
    expect([...local.values.values()].join("\n")).not.toContain("synthetic-ciphertext")
    expect(local.getItem(JOURNAL_TOMBSTONES_STORAGE_KEY)).toContain("synthetic-deleted")
    expect(local.getItem(JOURNAL_OWNERSHIP_STORAGE_KEY)).toBe(JSON.stringify({ schemaVersion: 1, ownerByEntryId: { "synthetic-deleted": "synthetic-owner" } }))
    expect(local.getItem(JOURNAL_STORAGE_KEY)).toBeNull()
    expect(await initializeCanonicalJournalStorage(local, undefined, unlocked)).toEqual({ status: "ready" })
    expect(local.getItem(JOURNAL_STORAGE_KEY)).toBeNull()
  })

  it("leaves a blocking erase intent when source deletion fails, and supports a later erase retry", async () => {
    const local = new MemoryStorage()
    seedBundle(local)
    await initializeCanonicalJournalStorage(local, undefined, unlocked)
    local.beforeRemove = key => { if (key === old.journal) throw new Error("Synthetic remove failure") }
    expect(eraseCanonicalJournalStorage(local).ok).toBe(false)
    expect(canonicalJournalStorageStatus(local)).toEqual({ status: "unavailable", reason: "ERASE_INCOMPLETE" })
    expect(() => assertCanonicalJournalReadable(local)).toThrow()
    local.beforeRemove = undefined
    expect(await initializeCanonicalJournalStorage(local, undefined, unlocked)).toEqual({ status: "ready" })
    expect(canonicalJournalStorageStatus(local)).toEqual({ status: "ready" })
  })

  it("refuses ambiguous owner metadata without deleting data, while explicit full trace wipe can remove corrupt state", async () => {
    const local = new MemoryStorage()
    seedBundle(local)
    local.setItem(old.ownership, JSON.stringify({ schemaVersion: 1, ownerByEntryId: { "synthetic-deleted": "owner-A" } }))
    await initializeCanonicalJournalStorage(local, undefined, unlocked)
    local.setItem(JOURNAL_OWNERSHIP_STORAGE_KEY, JSON.stringify({ schemaVersion: 1, ownerByEntryId: { "synthetic-deleted": "owner-B" } }))
    const journalBefore = local.getItem(JOURNAL_STORAGE_KEY)
    expect(eraseCanonicalJournalStorage(local).ok).toBe(false)
    expect(local.getItem(JOURNAL_STORAGE_KEY)).toBe(journalBefore)
    local.setItem(`${CANONICAL_JOURNAL_SNAPSHOT_PREFIX}synthetic-corrupt`, "{broken")
    expect(eraseCanonicalJournalStorage(local).ok).toBe(false)
    expect(eraseCanonicalJournalStorage(local, { includeDeletionRecord: true }).ok).toBe(true)
    expect(local.getItem(JOURNAL_TOMBSTONES_STORAGE_KEY)).toBeNull()
    expect(local.getItem(JOURNAL_OWNERSHIP_STORAGE_KEY)).toBeNull()
    expect([...local.values.values()].join("\n")).not.toContain("owner-A")
    expect([...local.values.values()].join("\n")).not.toContain("owner-B")
  })

  it("redacts current, legacy and every immutable archive in a single held transaction", async () => {
    const local = new MemoryStorage()
    seedBundle(local)
    await initializeCanonicalJournalStorage(local, undefined, unlocked)
    const originals = canonicalJournalStorageKeys(local).filter(key => key.startsWith(CANONICAL_JOURNAL_SNAPSHOT_PREFIX))
    const contexts: string[] = []
    const result = redactCanonicalJournalOriginals(local, (values, context) => {
      contexts.push(context.source)
      return values.map(([key, raw]) => [key, [old.journal, old.vault, old.trash].includes(key as never)
        || key.startsWith(old.syncRecovery) ? null : raw] as const)
    })
    expect(result.ok).toBe(true)
    expect(contexts[0]).toBe("canonical")
    expect(contexts).toContain("legacy")
    expect(contexts).toContain("original")
    expect(originals.every(key => local.getItem(key) === null)).toBe(true)
    expect([...local.values.values()].join("\n")).not.toContain("Synthetic historical text")
    expect([...local.values.values()].join("\n")).not.toContain("synthetic-ciphertext")
    expect(canonicalJournalStorageStatus(local)).toEqual({ status: "ready" })
  })

  it("refuses an unsupported archived source and a transformer refusal before mutating live data", async () => {
    const local = new MemoryStorage()
    seedBundle(local)
    await initializeCanonicalJournalStorage(local, undefined, unlocked)
    const before = new Map(local.values)
    expect(redactCanonicalJournalOriginals(local, () => null).ok).toBe(false)
    expect(local.values).toEqual(before)
    local.setItem(`${CANONICAL_JOURNAL_SNAPSHOT_PREFIX}synthetic-unsupported`, JSON.stringify({ schemaVersion: 1,
      values: JOURNAL_LOCAL_STORAGE_KEY_MAPPINGS.map(mapping => [mapping.legacy, mapping.legacy === old.journal
        ? JSON.stringify([{ ...journal(), futureCompanion: 9 }]) : null]) }))
    const unsupported = new Map(local.values)
    expect(redactCanonicalJournalOriginals(local, values => values).ok).toBe(false)
    expect(local.values).toEqual(unsupported)
  })

  it("blocks every guard after an interrupted permanent original redaction", async () => {
    const local = new MemoryStorage()
    seedBundle(local)
    await initializeCanonicalJournalStorage(local, undefined, unlocked)
    local.beforeRemove = key => { if (key === JOURNAL_STORAGE_KEY) throw new Error("Synthetic redaction failure") }
    expect(redactCanonicalJournalOriginals(local, values => values.map(([key, raw]) => [key, key === old.journal ? null : raw] as const)).ok).toBe(false)
    expect(readCanonicalJournalManifest(local)?.phase).toBe("redacting")
    expect(canonicalJournalStorageStatus(local)).toEqual({ status: "unavailable", reason: "ERASE_INCOMPLETE" })
    expect(() => assertCanonicalJournalWritable(local)).toThrow()
    local.beforeRemove = undefined
    expect(await initializeCanonicalJournalStorage(local, undefined, unlocked)).toEqual({ status: "ready" })
    expect(local.getItem(JOURNAL_STORAGE_KEY)).toBeNull()
    expect([...local.values.keys()].some(key => key.startsWith(CANONICAL_JOURNAL_LIFECYCLE_INTENT_PREFIX))).toBe(false)
  })

  it.each(["old-archive", "intent", "ready-marker"])("resumes the fixed redaction after a failure at %s", async phase => {
    const local = new MemoryStorage()
    seedBundle(local)
    await initializeCanonicalJournalStorage(local, undefined, unlocked)
    const oldArchive = readCanonicalJournalManifest(local)!.initialSnapshotKey
    local.beforeRemove = key => {
      if (phase === "old-archive" && key === oldArchive
        || phase === "intent" && key.startsWith(CANONICAL_JOURNAL_LIFECYCLE_INTENT_PREFIX)) throw new Error("Synthetic interruption")
    }
    local.beforeSet = (key, raw) => {
      if (phase === "ready-marker" && key === CANONICAL_JOURNAL_MANIFEST_KEY && raw.includes('"phase":"ready"')) throw new Error("Synthetic final interruption")
    }
    expect(redactCanonicalJournalOriginals(local, values => values.map(([key, raw]) => [key,
      key === old.journal || key === old.vault || key === old.trash || key.startsWith(old.syncRecovery) ? null : raw] as const)).ok).toBe(false)
    expect(canonicalJournalStorageStatus(local)).toEqual({ status: "unavailable", reason: "ERASE_INCOMPLETE" })
    local.beforeRemove = undefined
    local.beforeSet = undefined
    expect(await initializeCanonicalJournalStorage(local, undefined, unlocked)).toEqual({ status: "ready" })
    expect(local.getItem(oldArchive)).toBeNull()
    expect([...local.values.values()].join("\n")).not.toContain("Synthetic historical text")
    expect([...local.values.values()].join("\n")).not.toContain("synthetic-ciphertext")
  })

  it("holds a fixed retry when a third raw value or new legacy key appears and does not overwrite it", async () => {
    const local = new MemoryStorage()
    seedBundle(local)
    await initializeCanonicalJournalStorage(local, undefined, unlocked)
    local.beforeRemove = key => { if (key === JOURNAL_STORAGE_KEY) throw new Error("Synthetic interruption") }
    redactCanonicalJournalOriginals(local, values => values.map(([key, raw]) => [key, key === old.journal ? null : raw] as const))
    local.beforeRemove = undefined
    const concurrent = JSON.stringify([journal("foreign-live-source")])
    local.setItem(old.journal, concurrent)
    local.setItem(`${old.syncRecovery}.account.foreign-owner`, JSON.stringify({ version: 1, userId: "foreign-owner",
      startedAt: "2026-10-12T04:00:00Z", entries: [], tombstones: [] }))
    const before = new Map(local.values)
    expect(await initializeCanonicalJournalStorage(local, undefined, unlocked)).toEqual({ status: "unavailable", reason: "ERASE_INCOMPLETE" })
    expect(local.values).toEqual(before)
    expect(local.getItem(old.journal)).toBe(concurrent)
  })
})

describe("canonical migration interruption and concurrency", () => {
  it.each(["snapshot", "copying-marker", "journal", "ready-marker"])("retains originals and safely retries a quota failure at %s", async phase => {
    const local = new MemoryStorage()
    seedBundle(local)
    const source = local.getItem(old.journal)
    let thrown = false
    local.beforeSet = (key, raw) => {
      if (!thrown && ((phase === "snapshot" && key.startsWith(CANONICAL_JOURNAL_SNAPSHOT_PREFIX))
        || (phase === "copying-marker" && key === CANONICAL_JOURNAL_MANIFEST_KEY && raw.includes('"phase":"copying"'))
        || (phase === "journal" && key === JOURNAL_STORAGE_KEY)
        || (phase === "ready-marker" && key === CANONICAL_JOURNAL_MANIFEST_KEY && raw.includes('"phase":"ready"')))) {
        thrown = true
        throw new Error("Synthetic quota")
      }
    }
    expect((await initializeCanonicalJournalStorage(local, undefined, unlocked)).status).toBe("unavailable")
    expect(isCanonicalJournalWritable(local)).toBe(false)
    expect(local.getItem(old.journal)).toBe(source)
    local.beforeSet = undefined
    expect(await initializeCanonicalJournalStorage(local, undefined, unlocked)).toEqual({ status: "ready" })
    expect(local.getItem(JOURNAL_STORAGE_KEY)).toBe(source)
  })

  it("refuses a dropped readback and recovers only its known partial copy", async () => {
    const local = new MemoryStorage()
    seedBundle(local)
    local.afterSet = key => { if (key === JOURNAL_STORAGE_KEY) local.values.delete(key) }
    expect(await initializeCanonicalJournalStorage(local, undefined, unlocked)).toEqual({ status: "unavailable", reason: "WRITE_UNCONFIRMED" })
    local.afterSet = undefined
    expect(await initializeCanonicalJournalStorage(local, undefined, unlocked)).toEqual({ status: "ready" })
  })

  it("holds the initial changed-source attempt and recovers only its immutable first snapshot on retry", async () => {
    const local = new MemoryStorage()
    seedBundle(local)
    const oldSource = local.getItem(old.journal)
    let changed = false
    local.afterSet = key => {
      if (key === JOURNAL_STORAGE_KEY && !changed) {
        changed = true
        local.values.set(old.journal, JSON.stringify([journal("concurrent-old-edit")]))
      }
    }
    expect(await initializeCanonicalJournalStorage(local, undefined, unlocked)).toEqual({ status: "unavailable", reason: "SOURCE_CHANGED" })
    expect(readCanonicalJournalManifest(local)?.phase).toBe("copying")
    expect(canonicalJournalLegacySnapshots(local)[0]?.values.find(([key]) => key === old.journal)?.[1]).toBe(oldSource)
    local.afterSet = undefined
    const recovered = await initializeCanonicalJournalStorage(local, undefined, unlocked)
    expect(recovered.status).toBe("conflict")
    expect(readCanonicalJournalManifest(local)?.phase).toBe("ready")
    expect(local.getItem(JOURNAL_STORAGE_KEY)).toBe(oldSource)
    expect(canonicalJournalLegacySnapshots(local).some(snapshot => snapshot.values.find(([key]) => key === old.journal)?.[1]?.includes("concurrent-old-edit"))).toBe(true)
    expect(local.getItem(old.journal)).toContain("concurrent-old-edit")
  })

  it("does not overwrite a different value in an interrupted canonical copy", async () => {
    const local = new MemoryStorage()
    seedBundle(local)
    local.beforeSet = key => { if (key === JOURNAL_STORAGE_KEY) throw new Error("Synthetic interruption") }
    await initializeCanonicalJournalStorage(local, undefined, unlocked)
    local.beforeSet = undefined
    local.setItem(JOURNAL_STORAGE_KEY, JSON.stringify([journal("independent-canonical-edit")]))
    expect(await initializeCanonicalJournalStorage(local, undefined, unlocked)).toEqual({ status: "unavailable", reason: "EXISTING_CANONICAL_STATE" })
    expect(local.getItem(JOURNAL_STORAGE_KEY)).toContain("independent-canonical-edit")
  })

  it("resumes supported metadata from the first snapshot and requires an ACK for an older writer's stripped revision", async () => {
    const local = new MemoryStorage()
    const withMetadata = { ...journal(), bodyPartMetadata: { schemaVersion: 1, observations: [{
      id: "other_aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", labelSnapshot: "Synthetic retained label", severity: 2,
    }] } }
    const original = JSON.stringify([withMetadata])
    local.setItem(old.journal, original)
    let interrupted = false
    local.afterSet = key => {
      if (key === JOURNAL_STORAGE_KEY && !interrupted) {
        interrupted = true
        local.values.set(old.journal, JSON.stringify([journal()]))
      }
    }
    expect(await initializeCanonicalJournalStorage(local, undefined, unlocked)).toEqual({ status: "unavailable", reason: "SOURCE_CHANGED" })
    local.afterSet = undefined
    const recovered = await initializeCanonicalJournalStorage(local, undefined, unlocked)
    expect(recovered.status).toBe("conflict")
    expect(local.getItem(JOURNAL_STORAGE_KEY)).toBe(original)
    expect(canonicalJournalLegacySnapshots(local)).toHaveLength(2)
    expect(isCanonicalJournalWritable(local)).toBe(false)
    if (recovered.status !== "conflict") throw new Error("Missing recovered conflict")
    expect(await acknowledgeCanonicalJournalStorage(local, recovered.conflictToken, unlocked)).toEqual({ status: "ready" })
    expect(local.getItem(JOURNAL_STORAGE_KEY)).toBe(original)
  })

  it("does not copy a latest unsupported legacy revision while recovering its supported first snapshot", async () => {
    const local = new MemoryStorage()
    const initial = JSON.stringify([journal()])
    const unsupported = JSON.stringify([{ ...journal(), bodyPartMetadata: { schemaVersion: 99, observations: [] } }])
    local.setItem(old.journal, initial)
    local.afterSet = key => { if (key === JOURNAL_STORAGE_KEY) local.values.set(old.journal, unsupported) }
    expect((await initializeCanonicalJournalStorage(local, undefined, unlocked)).status).toBe("unavailable")
    local.afterSet = undefined
    expect((await initializeCanonicalJournalStorage(local, undefined, unlocked)).status).toBe("conflict")
    expect(local.getItem(JOURNAL_STORAGE_KEY)).toBe(initial)
    expect(local.getItem(old.journal)).toBe(unsupported)
    expect(canonicalJournalLegacySnapshots(local).some(snapshot => snapshot.values.find(([key]) => key === old.journal)?.[1] === unsupported)).toBe(true)
  })

  it("holds an initial-snapshot recovery when a foreign canonical writer has changed the partial copy", async () => {
    const local = new MemoryStorage()
    seedBundle(local)
    local.beforeSet = key => { if (key === PRIVATE_MEMO_VAULT_STORAGE_KEY) throw new Error("Synthetic interruption") }
    await initializeCanonicalJournalStorage(local, undefined, unlocked)
    local.beforeSet = undefined
    local.setItem(old.journal, JSON.stringify([journal("newer-legacy")]))
    const foreign = JSON.stringify([journal("foreign-canonical")])
    local.setItem(JOURNAL_STORAGE_KEY, foreign)
    expect(await initializeCanonicalJournalStorage(local, undefined, unlocked)).toEqual({ status: "unavailable", reason: "EXISTING_CANONICAL_STATE" })
    expect(local.getItem(JOURNAL_STORAGE_KEY)).toBe(foreign)
    expect(readCanonicalJournalManifest(local)?.phase).toBe("copying")
  })

  it("serializes two first migrations and reuses the first confirmed original snapshot", async () => {
    const local = new MemoryStorage()
    seedBundle(local)
    let tail: Promise<unknown> = Promise.resolve()
    const serialized: CanonicalJournalLockRunner = operation => {
      const result = tail.then(operation)
      tail = result.catch(() => undefined)
      return result
    }
    const result = await Promise.all([
      initializeCanonicalJournalStorage(local, undefined, serialized),
      initializeCanonicalJournalStorage(local, undefined, serialized),
    ])
    expect(result).toEqual([{ status: "ready" }, { status: "ready" }])
    expect(canonicalJournalLegacySnapshots(local)).toHaveLength(1)
  })

  it("keeps a conflict after an ACK is interrupted and preserves its staged revision", async () => {
    const local = new MemoryStorage()
    seedBundle(local)
    await initializeCanonicalJournalStorage(local, undefined, unlocked)
    local.setItem(old.journal, JSON.stringify([journal("synthetic-new-legacy")]))
    const status = canonicalJournalStorageStatus(local)
    if (status.status !== "conflict") throw new Error("Missing conflict")
    local.beforeSet = key => { if (key === CANONICAL_JOURNAL_MANIFEST_KEY) throw new Error("Synthetic quota") }
    expect((await acknowledgeCanonicalJournalStorage(local, status.conflictToken, unlocked)).status).toBe("unavailable")
    expect(canonicalJournalStorageStatus(local).status).toBe("conflict")
    expect(canonicalJournalLegacySnapshots(local)).toHaveLength(2)
  })
})
