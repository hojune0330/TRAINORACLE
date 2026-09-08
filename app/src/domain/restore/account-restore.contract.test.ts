import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createAccountBackupRestoration } from "./account-restore"
import { buildRestorePlan, FULL_FORMAT, readBackupFile, restoreBackupFile, restoreEntries, SAFE_FORMAT } from "./backup-file"
import { setActiveLocalAccount } from "../account/local-journal-ownership"
import { putAccountJournalProjection, readAccountJournalPrivateEntry, resetAccountJournalProjection } from "../account/account-journal-projection"
import { parseAccountJournalRecord } from "../account/account-journal-record-schema"
import type { PostSessionEntry } from "../journal-schema"
import { createEmptyDecorationState, V2_SLOT_DEFAULT_TRANSFORMS } from "../decoration-schema"
import { TEXT_STICKER_ITEM_ID, TEXT_INK_IDS } from "../decoration-catalog"

const api = vi.hoisted(() => ({ hydrate: vi.fn(), persist: vi.fn(), deleted: vi.fn(), decorHydrate: vi.fn(), decorPersist: vi.fn(), decorRead: vi.fn(), decorStatus: vi.fn(), base: vi.fn(), fingerprint: vi.fn() }))
vi.mock("../account/account-decoration-service", () => ({
  hydrateAccountDecorations: api.decorHydrate, persistAccountDecorations: api.decorPersist,
  readAccountDecorationState: api.decorRead, accountDecorationStatus: api.decorStatus,
}))
vi.mock("../account/account-journal-record-service", () => ({
  accountJournalRecordsEnabled: () => true, hydrateAccountJournalRecords: api.hydrate,
  persistAccountJournalRecord: api.persist, accountJournalDeletedDocuments: api.deleted,
  readAccountJournalWriteBase: api.base, accountJournalEntryFingerprint: api.fingerprint,
  accountJournalDocumentId: async (owner: string, id: string) => `${owner}:${id}`,
}))
function entry(id = "backup"): PostSessionEntry {
  return { id, kind: "post-session", date: "2026-07-20", savedAt: "2026-07-20T09:00:00.000Z",
    syncState: "local", system: "base", title: "Synthetic", distanceKm: "5", durationMin: "30", avgPace: "6:00", rpe: 4,
    memo: "Synthetic private backup", memoPurpose: "PRIVATE_SELF_ONLY", fieldProvenance: { rpe: { provenance: "EXPLICIT" } } }
}
function backup(entries = [entry()], format = FULL_FORMAT) {
  return readBackupFile(JSON.stringify({ app: "TRAINORACLE", format, entries }))
}
const sessions: NonNullable<Awaited<ReturnType<typeof createAccountBackupRestoration>>>[] = []
async function prepare(read = backup()) {
  const session = await createAccountBackupRestoration(read)
  expect(session).not.toBeNull(); sessions.push(session!); return session!
}
beforeEach(() => {
  vi.resetAllMocks(); setActiveLocalAccount("A"); resetAccountJournalProjection("A")
  api.hydrate.mockResolvedValue(true); api.deleted.mockReturnValue([])
  api.persist.mockResolvedValue({ ok: true, storage: "ACCOUNT" })
  api.fingerprint.mockImplementation(async ({ syncState: _transport, ...entry }) => JSON.stringify(entry))
  api.base.mockImplementation(async (id: string) => {
    const entry = readAccountJournalPrivateEntry(id)
    return { entry, revision: entry ? 1 : 0, contentFingerprint: entry ? await api.fingerprint(entry) : null }
  })
  api.decorHydrate.mockResolvedValue(true); api.decorRead.mockReturnValue(createEmptyDecorationState())
  api.decorStatus.mockReturnValue("READY"); api.decorPersist.mockResolvedValue({ ok: true, storage: "ACCOUNT", state: createEmptyDecorationState() })
})
afterEach(() => { sessions.splice(0).forEach(session => session.dispose()); setActiveLocalAccount(null); vi.unstubAllEnvs() })

describe("account JSON backup restoration", () => {
  it("preserves full private backup and provenance through the account codec without local writes", async () => {
    const read = backup(), original = structuredClone(read)
    const set = vi.spyOn(Storage.prototype, "setItem")
    const session = await prepare(read)
    expect(api.persist).not.toHaveBeenCalled()
    expect(await session.confirm()).toMatchObject({ account: 1, pending: 0, failed: 0 })
    const restored = api.persist.mock.calls[0]![0]
    expect(restored).toMatchObject(entry())
    expect(api.persist).toHaveBeenCalledExactlyOnceWith(restored, undefined, "MIGRATION", { revision: 0, contentFingerprint: null })
    expect(parseAccountJournalRecord({ version: 2, kind: "JOURNAL", state: "FINALIZED", entry: restored })).not.toBeNull()
    expect(read).toEqual(original); expect(set).not.toHaveBeenCalled()
  })

  it("keeps existing by default and preserves full existing memo when overwriting from a safe backup", async () => {
    putAccountJournalProjection("A", { ...entry(), memo: "Synthetic newer private memo", syncState: "synced" })
    const kept = await prepare()
    expect(await kept.confirm()).toMatchObject({ keptExisting: 1, account: 0 })
    expect(api.persist).not.toHaveBeenCalled()
    const overwrite = await prepare(backup([{ ...entry(), rpe: 5 }], SAFE_FORMAT))
    expect(await overwrite.confirm("overwrite-conflicts")).toMatchObject({ account: 1 })
    const restored = api.persist.mock.calls[0]![0]
    expect(restored).toMatchObject({ memo: "Synthetic newer private memo", memoPurpose: "PRIVATE_SELF_ONLY", rpe: 5 })
    expect(api.persist.mock.calls[0]![1]).toBe(entry().savedAt)
    expect(api.persist.mock.calls[0]![2]).toBe("MIGRATION")
    expect(parseAccountJournalRecord({ version: 2, kind: "JOURNAL", state: "FINALIZED", entry: restored })).not.toBeNull()
  })

  it("rehydrates before overwrite and refuses changes since the review", async () => {
    putAccountJournalProjection("A", entry())
    const session = await prepare()
    api.hydrate.mockImplementationOnce(async () => {
      putAccountJournalProjection("A", { ...entry(), savedAt: "2026-07-21T00:00:00.000Z" }); return true
    })
    expect(await session.confirm("overwrite-conflicts")).toMatchObject({ conflicts: 1, account: 0 })
    expect(api.persist).not.toHaveBeenCalled()
    expect(api.hydrate).toHaveBeenCalledTimes(3)
  })

  it("rejects a different full private body with the same savedAt after review", async () => {
    const original = entry()
    putAccountJournalProjection("A", original)
    const session = await prepare()
    const changed = { ...original, memo: "Concurrent private edit", rpe: 7 }
    putAccountJournalProjection("A", changed)
    expect(await session.confirm("overwrite-conflicts")).toMatchObject({ account: 0, conflicts: 1, commit: "FAILED" })
    expect(api.persist).not.toHaveBeenCalled()
    expect(readAccountJournalPrivateEntry(original.id)).toEqual(changed)
  })

  it("does not mistake the pending timestamp for identity on retry", async () => {
    putAccountJournalProjection("A", entry())
    const session = await prepare()
    api.persist.mockResolvedValueOnce({ ok: true, storage: "PENDING" })
    expect(await session.confirm("overwrite-conflicts")).toMatchObject({ pending: 1 })
    const attempted = api.persist.mock.calls[0]![0]
    const changed = { ...attempted, memo: "Different body at the attempted timestamp" }
    putAccountJournalProjection("A", changed)
    expect(await session.confirm()).toMatchObject({ account: 0, conflicts: 1 })
    expect(api.persist).toHaveBeenCalledTimes(1)
    expect(readAccountJournalPrivateEntry(entry().id)).toEqual(changed)
  })

  it("rejects a fresh revision even when savedAt and the entire body are unchanged", async () => {
    const original = entry()
    putAccountJournalProjection("A", original)
    const session = await prepare()
    api.base.mockResolvedValue({ entry: original, revision: 2, contentFingerprint: await api.fingerprint(original) })
    expect(await session.confirm("overwrite-conflicts")).toMatchObject({ conflicts: 1, account: 0 })
    expect(api.persist).not.toHaveBeenCalled()
  })

  it("preserves a target created after the planned-absence review", async () => {
    const session = await prepare()
    const concurrent = { ...entry(), memo: "Created after review" }
    putAccountJournalProjection("A", concurrent)
    expect(await session.confirm("overwrite-conflicts")).toMatchObject({ conflicts: 1, account: 0 })
    expect(api.persist).not.toHaveBeenCalled()
    expect(readAccountJournalPrivateEntry(concurrent.id)).toEqual(concurrent)
  })

  it("passes the original reviewed token through exact pending retries", async () => {
    const original = entry()
    putAccountJournalProjection("A", original)
    const session = await prepare()
    const expectedBase = { revision: 1, contentFingerprint: await api.fingerprint(original) }
    api.persist.mockResolvedValueOnce({ ok: true, storage: "PENDING" })
    expect(await session.confirm("overwrite-conflicts")).toMatchObject({ pending: 1 })
    const attempted = api.persist.mock.calls[0]![0]
    putAccountJournalProjection("A", attempted, false)
    api.base.mockResolvedValue(null)
    expect(await session.confirm()).toMatchObject({ account: 1, pending: 0 })
    expect(api.persist.mock.calls.map(call => call[3])).toEqual([expectedBase, expectedBase])
    expect(api.persist.mock.calls[1]![0]).toEqual(attempted)
  })

  it("never resurrects a tombstone discovered after review", async () => {
    const session = await prepare()
    api.deleted.mockReturnValue([{ documentId: "A:backup", revision: 4 }])
    expect(await session.confirm("overwrite-conflicts")).toMatchObject({ blockedByDeletion: 1, account: 0 })
    expect(api.persist).not.toHaveBeenCalled()
  })

  it("coalesces clicks, reports four states and retains partial success without destructive rollback", async () => {
    const read = { ...backup([entry("one"), entry("two"), entry("three"), entry("four")]), decorations: createEmptyDecorationState(), decorationStatus: "included" as const }
    const session = await prepare(read)
    api.persist.mockResolvedValueOnce({ ok: true, storage: "ACCOUNT" }).mockResolvedValueOnce({ ok: true, storage: "PENDING" })
      .mockResolvedValueOnce({ ok: true, storage: "CONFLICT" }).mockResolvedValueOnce({ ok: false, storage: "FAILED" })
    const work = session.confirm()
    expect(session.confirm()).toBe(work)
    expect(await work).toMatchObject({ account: 1, pending: 1, conflicts: 1, failed: 1, decorationRestore: "KEPT_EXISTING", commit: "PARTIAL" })
    const snapshots = api.persist.mock.calls.map(call => structuredClone(call[0]))
    expect(await session.confirm()).toMatchObject({ account: 4, pending: 0, conflicts: 0, failed: 0 })
    expect(api.persist.mock.calls.slice(4).map(call => call[0])).toEqual(snapshots.slice(1))
    expect(api.persist).toHaveBeenCalledTimes(7)
    expect(api.persist.mock.calls.map(call => call[2])).toEqual(Array(7).fill("MIGRATION"))
    expect(api.persist.mock.calls.map(call => call[3])).toEqual(Array(7).fill({ revision: 0, contentFingerprint: null }))
  })

  it("cancels A-B-A during persistence and stops remaining writes", async () => {
    const session = await prepare(backup([entry("one"), entry("two")]))
    let resolve!: (value: unknown) => void
    api.persist.mockImplementationOnce(() => new Promise(done => { resolve = done }))
    const work = session.confirm()
    await vi.waitFor(() => expect(api.persist).toHaveBeenCalledTimes(1))
    setActiveLocalAccount("B"); setActiveLocalAccount("A")
    resolve({ ok: true, storage: "ACCOUNT" })
    expect(await work).toBeNull(); expect(await session.confirm()).toBeNull()
    expect(api.persist).toHaveBeenCalledTimes(1)
  })

  it("fails closed when the fresh server read fails", async () => {
    const session = await prepare()
    api.hydrate.mockResolvedValue(false)
    expect(await session.confirm()).toMatchObject({ account: 0, failed: 1 })
    expect(api.persist).not.toHaveBeenCalled()
    expect(await createAccountBackupRestoration(backup())).toBeNull()
  })

  it("keeps confirmed and pending receipts visible after an offline retry", async () => {
    const session = await prepare(backup([entry("one"), entry("two")]))
    api.persist.mockResolvedValueOnce({ ok: true, storage: "ACCOUNT" }).mockResolvedValueOnce({ ok: true, storage: "PENDING" })
    expect(await session.confirm()).toMatchObject({ account: 1, pending: 1, failed: 0 })
    api.hydrate.mockResolvedValue(false)
    expect(await session.confirm()).toMatchObject({ account: 1, pending: 1, failed: 0 })
    expect(api.persist).toHaveBeenCalledTimes(2)
  })

  it("leaves legacy restore entry points closed with the account flag", async () => {
    vi.stubEnv("VITE_FEATURE_ACCOUNT_JOURNAL", "true"); vi.stubEnv("VITE_KILL_ACCOUNT_JOURNAL", "false")
    const read = backup(), plan = buildRestorePlan(read.entries, [], new Set())
    expect(await restoreEntries(plan)).toMatchObject({ restored: 0, failed: 1, commit: "FAILED" })
    expect(await restoreBackupFile(read, plan)).toMatchObject({ restored: 0, failed: 1, commit: "FAILED" })
    expect(api.persist).not.toHaveBeenCalled()
  })
})

function decoratedBackup() {
  return { ...backup(), decorations: createEmptyDecorationState(), decorationStatus: "included" as const }
}

describe("explicit account decoration backup replacement", () => {
  it("preserves valid private text exactly in a strict V3 backup", async () => {
    const decorations = { ...createEmptyDecorationState(), pages: [{ date: entry().date, items: [{
      itemId: TEXT_STICKER_ITEM_ID, text: "  Private note  ", inkId: TEXT_INK_IDS[0],
      transform: V2_SLOT_DEFAULT_TRANSFORMS.TOP_CORNER,
    }] }] }
    const read = readBackupFile(JSON.stringify({ app: "TRAINORACLE", format: FULL_FORMAT, entries: [entry()], decorations }))
    expect(read.decorations).toEqual(decorations)
    const session = await prepare(read)
    expect(await session.confirm("keep-existing", "replace")).toMatchObject({ decorationRestore: "ACCOUNT", commit: "COMPLETE" })
    expect(api.decorPersist.mock.calls[0]![0]).toEqual(decorations)
  })

  it.each([
    { itemId: TEXT_STICKER_ITEM_ID, text: "x".repeat(21), inkId: TEXT_INK_IDS[0], transform: V2_SLOT_DEFAULT_TRANSFORMS.TOP_CORNER },
    { itemId: "UNSUPPORTED_FUTURE_ITEM", transform: V2_SLOT_DEFAULT_TRANSFORMS.TOP_CORNER },
  ])("rejects a lossy decoration section without claiming complete restoration: $itemId", async item => {
    const source = { app: "TRAINORACLE", format: FULL_FORMAT, entries: [entry()], decorations: {
      ...createEmptyDecorationState(), pages: [{ date: entry().date, items: [item] }],
    } }
    const original = structuredClone(source), bytes = JSON.stringify(source)
    const read = readBackupFile(bytes)
    expect(read).toMatchObject({ decorationStatus: "invalid", decorations: null })
    const session = await prepare(read)
    expect(await session.confirm("keep-existing", "replace")).toMatchObject({ account: 1,
      decorationRestore: "INVALID_SKIPPED", commit: "PARTIAL" })
    expect(api.decorPersist).not.toHaveBeenCalled()
    const failed = await prepare(readBackupFile(JSON.stringify({ ...source, entries: [] })))
    expect(await failed.confirm("keep-existing", "replace")).toMatchObject({ account: 0,
      decorationRestore: "INVALID_SKIPPED", commit: "FAILED" })
    expect(source).toEqual(original); expect(JSON.stringify(source)).toBe(bytes)
  })

  it("supports lossless V2 slot migration but rejects dropped placements and invalid explicit transforms", async () => {
    const { pages: _pages, ...base } = createEmptyDecorationState()
    const placement = { date: entry().date, slot: "TOP_CORNER", itemId: "STICKER_WEATHER_SUN" }
    const source = { app: "TRAINORACLE", format: FULL_FORMAT, entries: [entry()],
      decorations: { ...base, version: 2, pagePlacements: [placement] } }
    const bytes = JSON.stringify(source), read = readBackupFile(bytes)
    expect(read.decorationStatus).toBe("included")
    expect(read.decorations?.pages).toEqual([{ date: entry().date, items: [{ itemId: placement.itemId,
      transform: V2_SLOT_DEFAULT_TRANSFORMS.TOP_CORNER }] }])
    const session = await prepare(read)
    expect(await session.confirm("keep-existing", "replace")).toMatchObject({ decorationRestore: "ACCOUNT", commit: "COMPLETE" })
    for (const pagePlacements of [
      [placement, placement],
      [{ ...placement, itemId: "UNSUPPORTED_FUTURE_ITEM" }],
      [{ ...placement, transform: { ...V2_SLOT_DEFAULT_TRANSFORMS.TOP_CORNER, scale: 99 } }],
    ]) {
      expect(readBackupFile(JSON.stringify({ ...source, decorations: { ...source.decorations, pagePlacements } })))
        .toMatchObject({ decorationStatus: "invalid", decorations: null })
    }
    expect(JSON.stringify(source)).toBe(bytes)
  })

  it("defaults to keeping decorations, with no implicit account or legacy decoration writer", async () => {
    const session = await prepare(decoratedBackup())
    const set = vi.spyOn(Storage.prototype, "setItem")
    expect(await session.confirm()).toMatchObject({ account: 1, decorationRestore: "KEPT_EXISTING", commit: "COMPLETE" })
    expect(api.decorPersist).not.toHaveBeenCalled(); expect(set).not.toHaveBeenCalled()
  })

  it("writes only after explicit replacement and fresh hydrate with the reviewed serialized base", async () => {
    const read = decoratedBackup(), original = structuredClone(read)
    const session = await prepare(read)
    expect(api.decorPersist).not.toHaveBeenCalled()
    expect(await session.confirm("keep-existing", "replace")).toMatchObject({ decorationRestore: "ACCOUNT", commit: "COMPLETE" })
    expect(api.decorHydrate).toHaveBeenCalledTimes(2)
    expect(api.decorPersist).toHaveBeenCalledExactlyOnceWith(read.decorations, JSON.stringify(createEmptyDecorationState()))
    expect(read).toEqual(original)
    await session.confirm("keep-existing", "replace")
    expect(api.decorPersist).toHaveBeenCalledTimes(1)
    expect(api.persist).toHaveBeenCalledTimes(1)
  })

  it("reports partial success when ownership verification is rejected and never rolls back journals", async () => {
    api.decorPersist.mockResolvedValue({ ok: false, code: "WRITE_FAILED" })
    const read = decoratedBackup(), original = structuredClone(read)
    const session = await prepare(read), set = vi.spyOn(Storage.prototype, "setItem")
    expect(await session.confirm("keep-existing", "replace")).toMatchObject({ account: 1, decorationRestore: "FAILED", decorationFailure: "OWNERSHIP_UNVERIFIED", commit: "PARTIAL" })
    expect(read).toEqual(original); expect(set).not.toHaveBeenCalled()
    expect(api.persist).toHaveBeenCalledTimes(1)
  })

  it("reports partial success in the opposite direction when only decorations are acknowledged", async () => {
    api.persist.mockResolvedValue({ ok: false, storage: "FAILED" })
    const session = await prepare(decoratedBackup())
    expect(await session.confirm("keep-existing", "replace")).toMatchObject({ account: 0, failed: 1, decorationRestore: "ACCOUNT", commit: "PARTIAL" })
  })

  it("refuses a decoration base changed since user review", async () => {
    const session = await prepare(decoratedBackup())
    api.decorRead.mockReturnValue({ ...createEmptyDecorationState(), updatedAt: "synthetic-change" })
    expect(await session.confirm("keep-existing", "replace")).toMatchObject({ account: 1, decorationRestore: "CONFLICT", commit: "PARTIAL" })
    expect(api.decorPersist).not.toHaveBeenCalled()
  })

  it("does not write decorations when fresh hydration or initial base acquisition fails", async () => {
    const session = await prepare(decoratedBackup())
    api.decorHydrate.mockResolvedValue(false)
    expect(await session.confirm("keep-existing", "replace")).toMatchObject({ decorationRestore: "FAILED", decorationFailure: "READ_FAILED", commit: "PARTIAL" })
    const missing = await prepare(decoratedBackup())
    expect(missing.decorationReady).toBe(false)
    expect(await missing.confirm("keep-existing", "replace")).toMatchObject({ decorationRestore: "FAILED", decorationFailure: "READ_FAILED" })
    expect(api.decorPersist).not.toHaveBeenCalled()
  })

  it("keeps pending distinct and replays through hydrate without duplicate replacement writes", async () => {
    api.decorPersist.mockResolvedValue({ ok: true, storage: "PENDING", state: createEmptyDecorationState() })
    const session = await prepare(decoratedBackup())
    expect(await session.confirm("keep-existing", "replace")).toMatchObject({ decorationRestore: "PENDING", commit: "PARTIAL" })
    api.decorHydrate.mockResolvedValueOnce(false); api.decorStatus.mockReturnValue("PENDING")
    expect(await session.confirm()).toMatchObject({ decorationRestore: "PENDING", commit: "PARTIAL" })
    expect(await session.confirm()).toMatchObject({ decorationRestore: "ACCOUNT", commit: "COMPLETE" })
    expect(api.decorPersist).toHaveBeenCalledTimes(1); expect(api.persist).toHaveBeenCalledTimes(1)
  })

  it("rejects A-B-A completion while a decoration write is in flight", async () => {
    let resolve!: (value: unknown) => void
    api.decorPersist.mockImplementationOnce(() => new Promise(done => { resolve = done }))
    const session = await prepare(decoratedBackup()), work = session.confirm("keep-existing", "replace")
    await vi.waitFor(() => expect(api.decorPersist).toHaveBeenCalledTimes(1))
    setActiveLocalAccount("B"); setActiveLocalAccount("A")
    resolve({ ok: true, storage: "ACCOUNT", state: createEmptyDecorationState() })
    expect(await work).toBeNull(); expect(await session.confirm()).toBeNull()
    expect(api.decorPersist).toHaveBeenCalledTimes(1)
  })
})
