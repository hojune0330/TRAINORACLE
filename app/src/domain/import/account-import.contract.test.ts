import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createAccountImportConfirmation, buildAccountImportDrafts } from "./account-import"
import { buildImportDrafts, confirmImportDrafts, saveImportedActivities } from "./import-draft"
import { activeLocalAccount, setActiveLocalAccount } from "../account/local-journal-ownership"
import { putAccountJournalProjection, readAccountJournalPrivateEntry, resetAccountJournalProjection } from "../account/account-journal-projection"
import { parseAccountJournalRecord } from "../account/account-journal-record-schema"
import type { PostSessionEntry } from "../journal-schema"

const api = vi.hoisted(() => ({ hydrate: vi.fn(), persist: vi.fn(), deleted: vi.fn(), base: vi.fn(), fingerprint: vi.fn() }))
vi.mock("../account/account-journal-record-service", () => ({
  accountJournalRecordsEnabled: () => true,
  hydrateAccountJournalRecords: api.hydrate,
  persistAccountJournalRecord: api.persist,
  accountJournalDeletedDocuments: api.deleted,
  readAccountJournalWriteBase: api.base, accountJournalEntryFingerprint: api.fingerprint,
  accountJournalDocumentId: async (owner: string, id: string) => `${owner}:${id}`,
}))

const activity = { date: "2026-07-20", name: "Synthetic run", sport: "Running", distanceKm: "5", durationMin: "30", avgPace: "6:00" }
function waiting(): PostSessionEntry {
  return { id: "waiting", kind: "post-session", date: activity.date, savedAt: "2026-07-20T09:00:00.000Z",
    syncState: "local", system: "base", title: "Synthetic", distanceKm: "", durationMin: "", avgPace: "", rpe: 4,
    memo: "Synthetic private memo", memoPurpose: "PRIVATE_SELF_ONLY", objectiveDataState: "WAITING", activityOutcome: "COMPLETED",
    fieldProvenance: { rpe: { provenance: "EXPLICIT" }, activityOutcome: { provenance: "EXPLICIT" } } }
}
const batches: ReturnType<typeof createAccountImportConfirmation>[] = []
function separate(count = 1) {
  const batch = createAccountImportConfirmation(buildImportDrafts(Array.from({ length: count }, () => activity), [])
    .map(draft => ({ draft, intent: { kind: "SAVE_SEPARATE" } })), "csv")
  batches.push(batch); return batch
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
})
afterEach(() => { batches.splice(0).forEach(batch => batch.dispose()); setActiveLocalAccount(null); vi.unstubAllEnvs() })

describe("account import confirmation", () => {
  it("rejects sameSavedAt differentContent after the draft review", async () => {
    const original = waiting()
    putAccountJournalProjection("A", original)
    const drafts = await buildAccountImportDrafts([activity])
    putAccountJournalProjection("A", { ...original, memo: "Concurrent private edit", rpe: 7 })
    const batch = createAccountImportConfirmation([{ draft: drafts![0]!, intent: {
      kind: "ADD_TO_EXISTING", entryId: original.id, expectedSavedAt: original.savedAt,
    } }], "csv")
    batches.push(batch)
    expect(await batch.confirm()).toMatchObject({ account: 0, conflicts: 1 })
    expect(api.persist).not.toHaveBeenCalled()
  })

  it("rejects a changed revision with unchanged reviewed content", async () => {
    const original = waiting()
    putAccountJournalProjection("A", original)
    const drafts = await buildAccountImportDrafts([activity])
    const batch = createAccountImportConfirmation([{ draft: drafts![0]!, intent: {
      kind: "ADD_TO_EXISTING", entryId: original.id, expectedSavedAt: original.savedAt,
    } }], "csv")
    batches.push(batch)
    api.base.mockResolvedValue({ entry: original, revision: 2, contentFingerprint: await api.fingerprint(original) })
    expect(await batch.confirm()).toMatchObject({ account: 0, conflicts: 1 })
    expect(api.persist).not.toHaveBeenCalled()
  })

  it("does not overwrite a different body at the planned separate-import ID", async () => {
    const batch = separate()
    const id = `A:${JSON.stringify(["confirmed-activity-import-v1", "csv", 0, activity])}`
    const concurrent = { ...waiting(), id, memo: "Concurrent record at planned ID" }
    putAccountJournalProjection("A", concurrent)
    expect(await batch.confirm()).toMatchObject({ account: 0, conflicts: 1 })
    expect(api.persist).not.toHaveBeenCalled()
    expect(readAccountJournalPrivateEntry(id)).toEqual(concurrent)
  })

  it("keeps the reviewed merge token frozen and refuses a same-time impostor on retry", async () => {
    const original = waiting()
    putAccountJournalProjection("A", original)
    const drafts = await buildAccountImportDrafts([activity])
    const batch = createAccountImportConfirmation([{ draft: drafts![0]!, intent: {
      kind: "ADD_TO_EXISTING", entryId: original.id, expectedSavedAt: original.savedAt,
    } }], "csv")
    batches.push(batch)
    api.persist.mockResolvedValue({ ok: true, storage: "PENDING" })
    expect(await batch.confirm()).toMatchObject({ pending: 1 })
    const attempted = api.persist.mock.calls[0]![0], expectedBase = api.persist.mock.calls[0]![3]
    expect(expectedBase).toEqual({ revision: 1, contentFingerprint: await api.fingerprint(original) })
    putAccountJournalProjection("A", attempted, false)
    api.base.mockResolvedValue(null)
    expect(await batch.confirm()).toMatchObject({ pending: 1 })
    expect(api.persist.mock.calls[1]![3]).toEqual(expectedBase)
    const changed = { ...attempted, memo: "Same-time concurrent private memo" }
    putAccountJournalProjection("A", changed)
    expect(await batch.confirm()).toMatchObject({ account: 0, conflicts: 1 })
    expect(api.persist).toHaveBeenCalledTimes(2)
    expect(readAccountJournalPrivateEntry(original.id)).toEqual(changed)
  })

  it("hydrates before review and never automatically merges a similarity warning", async () => {
    putAccountJournalProjection("A", { ...waiting(), distanceKm: "5", syncState: "synced" })
    const drafts = await buildAccountImportDrafts([activity])
    expect(drafts?.[0]?.duplicateOf).toBe("waiting")
    expect(api.persist).not.toHaveBeenCalled()
    const batch = createAccountImportConfirmation(drafts!.map(draft => ({ draft, intent: { kind: "SAVE_SEPARATE" } })), "gpx")
    batches.push(batch)
    expect(await batch.confirm()).toMatchObject({ account: 1, saved: 1, merged: 0 })
    expect(api.persist.mock.calls[0]![0].id).not.toBe("waiting")
  })

  it("uses the full private projection, actual format provenance and explicit RPE", async () => {
    const original = waiting()
    putAccountJournalProjection("A", { ...original, syncState: "synced" })
    const drafts = await buildAccountImportDrafts([activity])
    expect(drafts![0]!.reconciliationCandidates).toHaveLength(1)
    const batch = createAccountImportConfirmation([{ draft: drafts![0]!, intent: {
      kind: "ADD_TO_EXISTING", entryId: original.id, expectedSavedAt: original.savedAt,
    } }], "gpx")
    batches.push(batch)
    expect(await batch.confirm()).toMatchObject({ account: 1, merged: 1, pending: 0 })
    const [entry, expected, writePurpose] = api.persist.mock.calls[0]!
    expect(writePurpose).toBe("MIGRATION")
    expect(entry).toMatchObject({ memo: original.memo, memoPurpose: "PRIVATE_SELF_ONLY", rpe: 4,
      fieldProvenance: { rpe: { provenance: "EXPLICIT" }, distanceKm: { provenance: "DERIVED", derivationRuleId: "import:gpx" } } })
    expect(expected).toBe(original.savedAt)
    expect(parseAccountJournalRecord({ version: 2, kind: "JOURNAL", state: "FINALIZED", entry })).not.toBeNull()
    expect(api.hydrate).toHaveBeenCalledTimes(3)
  })

  it("coalesces duplicate clicks and retries only pending/failed rows with frozen IDs and bodies", async () => {
    api.persist.mockResolvedValueOnce({ ok: true, storage: "ACCOUNT" })
      .mockResolvedValueOnce({ ok: true, storage: "PENDING" })
      .mockResolvedValueOnce({ ok: true, storage: "CONFLICT" })
      .mockResolvedValueOnce({ ok: false, storage: "FAILED" })
    const batch = separate(4)
    const first = batch.confirm()
    expect(batch.confirm()).toBe(first)
    expect(await first).toMatchObject({ account: 1, pending: 1, conflicts: 1, failed: 1 })
    const snapshots = api.persist.mock.calls.map(call => structuredClone(call[0]))
    expect(await batch.confirm()).toMatchObject({ account: 4, pending: 0, conflicts: 0, failed: 0 })
    expect(api.persist).toHaveBeenCalledTimes(7)
    expect(api.persist.mock.calls.map(call => call[2])).toEqual(Array(7).fill("MIGRATION"))
    expect(api.persist.mock.calls.map(call => call[3])).toEqual(Array(7).fill({ revision: 0, contentFingerprint: null }))
    expect(api.persist.mock.calls.slice(4).map(call => call[0])).toEqual(snapshots.slice(1))
  })

  it("cancels an A-B-A response and never sends the next row", async () => {
    let resolve!: (value: unknown) => void
    api.persist.mockImplementationOnce(() => new Promise(done => { resolve = done }))
    const batch = separate(2), work = batch.confirm()
    await vi.waitFor(() => expect(api.persist).toHaveBeenCalledTimes(1))
    setActiveLocalAccount("B"); setActiveLocalAccount("A")
    resolve({ ok: true, storage: "ACCOUNT" })
    expect(await work).toBeNull()
    expect(await batch.confirm()).toBeNull()
    expect(api.persist).toHaveBeenCalledTimes(1)
    expect(activeLocalAccount()).toBe("A")
  })

  it("fails closed on hydration failure and server tombstones", async () => {
    api.hydrate.mockResolvedValueOnce(false)
    expect(await separate().confirm()).toMatchObject({ account: 0, failed: 1 })
    const original = waiting()
    putAccountJournalProjection("A", original)
    api.deleted.mockReturnValue([{ documentId: "A:waiting", revision: 2 }])
    const batch = createAccountImportConfirmation([{ draft: buildImportDrafts([activity], [original])[0]!,
      intent: { kind: "ADD_TO_EXISTING", entryId: original.id, expectedSavedAt: original.savedAt } }], "csv")
    batches.push(batch)
    expect(await batch.confirm()).toMatchObject({ conflicts: 1, account: 0 })
    expect(api.persist).not.toHaveBeenCalled()
  })

  it("reuses the exact entry ID and savedAt after reopening the same parsed file", async () => {
    const drafts = await buildAccountImportDrafts([activity])
    const chosen = drafts!.map(draft => ({ draft, intent: { kind: "SAVE_SEPARATE" as const } }))
    const first = createAccountImportConfirmation(chosen, "csv"); batches.push(first)
    await first.confirm()
    const stored = api.persist.mock.calls[0]![0]
    putAccountJournalProjection("A", { ...stored, syncState: "synced" })
    const reopened = createAccountImportConfirmation(chosen, "csv"); batches.push(reopened)
    await reopened.confirm()
    expect(api.persist.mock.calls[1]![0]).toEqual(stored)
    expect(api.persist.mock.calls.map(call => call[2])).toEqual(["MIGRATION", "MIGRATION"])
  })

  it("retains acknowledged and durable pending counts when a later retry cannot hydrate", async () => {
    api.persist.mockResolvedValueOnce({ ok: true, storage: "ACCOUNT" }).mockResolvedValueOnce({ ok: true, storage: "PENDING" })
    const batch = separate(2)
    expect(await batch.confirm()).toMatchObject({ account: 1, pending: 1, failed: 0 })
    api.hydrate.mockResolvedValue(false)
    expect(await batch.confirm()).toMatchObject({ account: 1, pending: 1, failed: 0 })
    expect(api.persist).toHaveBeenCalledTimes(2)
  })

  it("does not overwrite a target changed after review", async () => {
    const original = waiting()
    const draft = buildImportDrafts([activity], [original])[0]!
    putAccountJournalProjection("A", { ...original, savedAt: "2026-07-21T00:00:00.000Z" })
    const batch = createAccountImportConfirmation([{ draft, intent: { kind: "ADD_TO_EXISTING", entryId: original.id, expectedSavedAt: original.savedAt } }], "json")
    batches.push(batch)
    expect(await batch.confirm()).toMatchObject({ conflicts: 1 })
    expect(api.persist).not.toHaveBeenCalled()
  })

  it("keeps legacy synchronous entry points fail closed under the account flag", () => {
    vi.stubEnv("VITE_FEATURE_ACCOUNT_JOURNAL", "true")
    vi.stubEnv("VITE_KILL_ACCOUNT_JOURNAL", "false")
    expect(saveImportedActivities([activity], "csv")).toMatchObject({ saved: 0, failed: 1 })
    expect(confirmImportDrafts([{ draft: buildImportDrafts([activity], [])[0]!, intent: { kind: "SAVE_SEPARATE" } }], "csv"))
      .toMatchObject({ saved: 0, failed: 1 })
    expect(api.persist).not.toHaveBeenCalled()
  })
})
