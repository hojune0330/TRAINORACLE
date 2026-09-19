import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createElement } from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { createAccountImportConfirmation, buildAccountImportDrafts } from "./account-import"
import { buildImportDrafts, confirmImportDrafts, saveImportedActivities, toImportedEntry } from "./import-draft"
import { buildFileObservation, toFileObservationSummary } from "./file-observation"
import { activeLocalAccount, setActiveLocalAccount } from "../account/local-journal-ownership"
import { putAccountJournalProjection, readAccountJournalPrivateEntry, resetAccountJournalProjection } from "../account/account-journal-projection"
import { parseAccountJournalRecord, validateAccountJournalRecordUpdate } from "../account/account-journal-record-schema"
import type { PostSessionEntry } from "../journal-schema"
import type { ImportDraftSelection, ImportSaveIntent } from "./import-draft"
import { ReviewStage, SavedStage } from "../../screens/import-activities/ImportStages"

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
function observedActivity(id: string | null = "tcx-fixture-1", distance = 5000) {
  const observation = buildFileObservation({ format: "tcx", sourceProfile: "TCX_ACTIVITY_V1", parserVersion: "tcx-v1",
    sourceActivityId: id, date: activity.date, startedAt: null, timeZone: null, sport: "RUNNING",
    distanceMeters: distance, durationSeconds: 1800.25, durationMeaning: "SOURCE_DEFINED", confirmation: null,
    laps: [{ sourceIndex: 0, distanceMeters: distance, durationSeconds: 1800.25, durationMeaning: "SOURCE_DEFINED", kind: "UNKNOWN" }] })
  return { ...activity, ...toFileObservationSummary(observation), observation }
}
function separate(count = 1) {
  const batch = createAccountImportConfirmation(buildImportDrafts(Array.from({ length: count }, () => activity), [])
    .map(draft => ({ draft, intent: { kind: "SAVE_SEPARATE" } })), "csv")
  batches.push(batch); return batch
}
function observedBatch(selections: readonly ImportDraftSelection[]) {
  const batch = createAccountImportConfirmation(selections, "tcx")
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
afterEach(() => { cleanup(); batches.splice(0).forEach(batch => batch.dispose()); setActiveLocalAccount(null); vi.unstubAllEnvs() })

describe("explicit file identity choices", () => {
  beforeEach(() => vi.stubEnv("VITE_FEATURE_FILE_ANALYSIS_TCX", "true"))

  it("never silently reuses a no-ID observation on a separate import", async () => {
    const source = observedActivity(null)
    const first = observedBatch([{ draft: (await buildAccountImportDrafts([source]))![0]!, intent: { kind: "SAVE_SEPARATE" } }])
    expect(await first.confirm()).toMatchObject({ saved: 1 })
    const entry = api.persist.mock.calls[0]![0]
    putAccountJournalProjection("A", entry)
    const draft = (await buildAccountImportDrafts([source]))![0]!
    expect(draft.requiresIdentityChoice).toBe(true)
    expect(draft.identityCandidates).toMatchObject([{ id: entry.id, kind: "REUSE" }])
    expect(await observedBatch([{ draft, intent: { kind: "SAVE_SEPARATE" } }]).confirm()).toMatchObject({ account: 0, conflicts: 1 })
    expect(api.persist).toHaveBeenCalledTimes(1)
  })

  it("assigns distinct no-ID journal IDs across explicit separate imports but freezes retry IDs", async () => {
    const source = observedActivity(null)
    const first = observedBatch([{ draft: (await buildAccountImportDrafts([source]))![0]!, intent: { kind: "SAVE_SEPARATE" } }])
    await first.confirm()
    const previous = api.persist.mock.calls[0]![0]
    putAccountJournalProjection("A", previous)
    const draft = (await buildAccountImportDrafts([source]))![0]!
    const second = observedBatch([{ draft, intent: { kind: "SAVE_SEPARATE", confirmedSeparate: true } }])
    api.persist.mockResolvedValue({ ok: true, storage: "PENDING" })
    expect(await second.confirm()).toMatchObject({ pending: 1 })
    expect(await second.confirm()).toMatchObject({ pending: 1 })
    const next = api.persist.mock.calls[1]![0]
    expect(next.id).not.toBe(previous.id)
    expect(next.fileObservation).toEqual(previous.fileObservation)
    expect(api.persist.mock.calls[2]![0]).toEqual(next)
  })

  it("requires a choice when a no-ID candidate appears after review", async () => {
    const source = observedActivity(null)
    const draft = (await buildAccountImportDrafts([source]))![0]!
    expect(draft.requiresIdentityChoice).toBe(false)
    putAccountJournalProjection("A", toImportedEntry(source, "tcx", { includeFileObservation: true }))
    expect(await observedBatch([{ draft, intent: { kind: "SAVE_SEPARATE" } }]).confirm()).toMatchObject({ conflicts: 1, account: 0 })
    expect(api.persist).not.toHaveBeenCalled()
  })

  it("reuses only the explicitly chosen no-ID candidate and preserves its private body", async () => {
    const source = observedActivity(null)
    const first = { ...toImportedEntry(source, "tcx", { includeFileObservation: true }), id: "no-id-am", activitySlot: "AM" as const }
    const second = { ...first, id: "no-id-pm", activitySlot: "PM" as const, rpe: 7, memo: "SYNTHETIC_PRIVATE_KEEP",
      memoPurpose: "PRIVATE_SELF_ONLY" as const, fieldProvenance: { ...first.fieldProvenance, rpe: { provenance: "EXPLICIT" as const } } }
    putAccountJournalProjection("A", first); putAccountJournalProjection("A", second)
    const draft = (await buildAccountImportDrafts([source]))![0]!
    expect(draft.identityCandidates).toHaveLength(2)
    expect(draft.accountWriteBases?.[second.id]?.revision).toBe(1)
    expect(await observedBatch([{ draft, intent: { kind: "USE_EXISTING", entryId: second.id, expectedSavedAt: second.savedAt } }]).confirm())
      .toMatchObject({ account: 1, reused: 1, saved: 0, merged: 0 })
    expect(api.persist).not.toHaveBeenCalled()
    expect(readAccountJournalPrivateEntry(second.id)).toEqual(second)
  })

  it.each(["content", "revision", "deleted"])("rejects a stale explicit reuse after %s changes", async change => {
    const source = observedActivity(null), previous = toImportedEntry(source, "tcx", { includeFileObservation: true })
    putAccountJournalProjection("A", previous)
    const draft = (await buildAccountImportDrafts([source]))![0]!
    if (change === "content") putAccountJournalProjection("A", { ...previous, memo: "SYNTHETIC_CONCURRENT" })
    if (change === "revision") api.base.mockResolvedValue({ entry: previous, revision: 2, contentFingerprint: await api.fingerprint(previous) })
    if (change === "deleted") api.deleted.mockReturnValue([{ documentId: `A:${previous.id}`, revision: 2 }])
    expect(await observedBatch([{ draft, intent: { kind: "USE_EXISTING", entryId: previous.id, expectedSavedAt: previous.savedAt } }]).confirm())
      .toMatchObject({ account: 0, conflicts: 1 })
    expect(api.persist).not.toHaveBeenCalled()
  })

  it("writes repeated stable source IDs only once even before projection refresh", async () => {
    const source = observedActivity()
    const drafts = (await buildAccountImportDrafts([source, source, source]))!
    const batch = observedBatch(drafts.map(draft => ({ draft, intent: { kind: "SAVE_SEPARATE" } })))
    expect(await batch.confirm()).toMatchObject({ account: 1, saved: 1, reused: 2, conflicts: 0 })
    expect(await batch.confirm()).toMatchObject({ account: 1, saved: 1, reused: 2 })
    expect(api.persist).toHaveBeenCalledTimes(1)
  })

  it("does not write conflicting versions of a stable source ID in either row order", async () => {
    const activities = [observedActivity("same-id", 5000), observedActivity("same-id", 5100)]
    for (const sources of [activities, [...activities].reverse()]) {
      const drafts = (await buildAccountImportDrafts(sources))!
      expect(await observedBatch(drafts.map(draft => ({ draft, intent: { kind: "SAVE_SEPARATE", confirmedSeparate: true } }))).confirm())
        .toMatchObject({ account: 0, conflicts: 2 })
    }
    expect(api.persist).not.toHaveBeenCalled()
  })

  it("only retries one pending body for repeated stable source IDs", async () => {
    const source = observedActivity(), drafts = (await buildAccountImportDrafts([source, source]))!
    const batch = observedBatch(drafts.map(draft => ({ draft, intent: { kind: "SAVE_SEPARATE" } })))
    api.persist.mockResolvedValueOnce({ ok: true, storage: "PENDING" })
    expect(await batch.confirm()).toMatchObject({ account: 0, pending: 2, reused: 0 })
    expect(api.persist).toHaveBeenCalledTimes(1)
    expect(await batch.confirm()).toMatchObject({ account: 1, saved: 1, reused: 1 })
    expect(api.persist).toHaveBeenCalledTimes(2)
    expect(api.persist.mock.calls[0]![0]).toEqual(api.persist.mock.calls[1]![0])
  })

  it("requires explicit separate or exclusion for identical no-ID rows within one file", async () => {
    const source = observedActivity(null), drafts = (await buildAccountImportDrafts([source, source]))!
    expect(drafts.every(draft => draft.requiresIdentityChoice)).toBe(true)
    expect(drafts[1]?.batchDuplicateOf).toBe(0)
    expect(await observedBatch(drafts.map(draft => ({ draft, intent: { kind: "SAVE_SEPARATE" } }))).confirm())
      .toMatchObject({ account: 0, conflicts: 2 })
    expect(await observedBatch([{ draft: drafts[0]!, intent: { kind: "SAVE_SEPARATE", confirmedSeparate: true } },
      { draft: drafts[1]!, intent: { kind: "EXCLUDE" } }]).confirm()).toMatchObject({ account: 1, excluded: 1 })
    expect(api.persist).toHaveBeenCalledTimes(1)
  })

  it("excludes without reading or writing the account", async () => {
    const draft = buildImportDrafts([observedActivity(null)], [])[0]!
    api.hydrate.mockResolvedValue(false)
    expect(await observedBatch([{ draft, intent: { kind: "EXCLUDE" } }]).confirm()).toMatchObject({ excluded: 1, account: 0, failed: 0 })
    expect(api.hydrate).not.toHaveBeenCalled()
    expect(api.persist).not.toHaveBeenCalled()
  })

  it("preserves the legacy disabled-flag ID shape even when the parser carries an observation", async () => {
    vi.stubEnv("VITE_FEATURE_FILE_ANALYSIS_TCX", "false")
    const source = observedActivity(), draft = (await buildAccountImportDrafts([source]))![0]!
    await observedBatch([{ draft, intent: { kind: "SAVE_SEPARATE" } }]).confirm()
    const stored = api.persist.mock.calls[0]![0]
    expect(stored.id).toBe(`A:${JSON.stringify(["confirmed-activity-import-v1", "tcx", 0, source])}`)
    expect(stored.fileObservation).toBeUndefined()
    putAccountJournalProjection("A", stored)
    await observedBatch([{ draft, intent: { kind: "SAVE_SEPARATE" } }]).confirm()
    expect(api.persist.mock.calls[1]![0]).toEqual(stored)
  })

  it("replays a known exact source without creating or attaching a coexisting legacy row", async () => {
    const source = observedActivity(), { observation: _observation, ...legacyActivity } = source
    const attached = toImportedEntry(source, "tcx", { includeFileObservation: true })
    const legacy = { ...toImportedEntry(legacyActivity, "tcx"),
      id: `A:${JSON.stringify(["confirmed-activity-import-v1", "tcx", 0, legacyActivity])}` }
    putAccountJournalProjection("A", attached); putAccountJournalProjection("A", legacy)
    const draft = (await buildAccountImportDrafts([source]))![0]!
    expect(await observedBatch([{ draft, intent: { kind: "SAVE_SEPARATE" } }]).confirm()).toMatchObject({ reused: 1, account: 1 })
    expect(api.persist).not.toHaveBeenCalled()
  })

  it("attaches precise evidence to a reordered legacy ID only after explicit choice without promoting RPE", async () => {
    const source = observedActivity()
    const previous = { ...toImportedEntry(activity, "tcx"), id: "old-row-9", distanceKm: "5.00", durationMin: "30",
      memo: "SYNTHETIC_PRIVATE_KEEP", memoPurpose: "PRIVATE_SELF_ONLY" as const, rpe: 6 }
    putAccountJournalProjection("A", previous)
    const draft = (await buildAccountImportDrafts([source]))![0]!
    expect(draft.identityCandidates).toMatchObject([{ id: previous.id, kind: "ATTACH" }])
    expect(await observedBatch([{ draft, intent: { kind: "SAVE_SEPARATE" } }]).confirm()).toMatchObject({ conflicts: 1, account: 0 })
    expect(await observedBatch([{ draft, intent: { kind: "USE_EXISTING", entryId: previous.id, expectedSavedAt: previous.savedAt } }]).confirm())
      .toMatchObject({ merged: 1, account: 1 })
    const [entry, savedAt, purpose, base] = api.persist.mock.calls[0]!
    expect(entry).toMatchObject({ id: previous.id, memo: previous.memo, memoPurpose: previous.memoPurpose, rpe: 6,
      distanceKm: "5", durationMin: String(1800.25 / 60), avgPace: "", fieldProvenance: { rpe: { provenance: "MISSING" } } })
    expect(savedAt).toBe(previous.savedAt)
    expect(purpose).toBe("FILE_OBSERVATION")
    expect(base).toEqual(draft.accountWriteBases?.[previous.id])
    expect(validateAccountJournalRecordUpdate({ version: 2, kind: "JOURNAL", state: "FINALIZED", entry: previous },
      { version: 3, kind: "JOURNAL", state: "FINALIZED", entry }, "FILE_OBSERVATION")).toBe(true)
  })

  it("does not attach to a forged candidate or overwrite explicit objective values", async () => {
    const source = observedActivity()
    const previous = { ...waiting(), distanceKm: "5.00", durationMin: "30", objectiveDataState: "CONFIRMED" as const,
      fieldProvenance: { rpe: { provenance: "EXPLICIT" as const }, distanceKm: { provenance: "EXPLICIT" as const } } }
    putAccountJournalProjection("A", previous)
    const draft = (await buildAccountImportDrafts([source]))![0]!
    expect(draft.identityCandidates).toEqual([])
    expect(await observedBatch([{ draft: { ...draft, identityCandidates: [{ ...previous, kind: "ATTACH" }],
      accountWriteBases: { [previous.id]: { revision: 1, contentFingerprint: await api.fingerprint(previous) } } },
      intent: { kind: "USE_EXISTING", entryId: previous.id, expectedSavedAt: previous.savedAt } }]).confirm())
      .toMatchObject({ conflicts: 1 })
    expect(api.persist).not.toHaveBeenCalled()
  })

  it("does not attach an already represented stable source ID to a second legacy row", async () => {
    const source = observedActivity()
    const attached = toImportedEntry(source, "tcx", { includeFileObservation: true }), legacy = toImportedEntry(activity, "tcx")
    putAccountJournalProjection("A", attached); putAccountJournalProjection("A", legacy)
    const draft = (await buildAccountImportDrafts([source]))![0]!
    expect(await observedBatch([{ draft, intent: { kind: "USE_EXISTING", entryId: legacy.id, expectedSavedAt: legacy.savedAt } }]).confirm())
      .toMatchObject({ conflicts: 1, account: 0 })
    expect(api.persist).not.toHaveBeenCalled()
  })

  it("shows explicit no-ID review choices and never treats a default separate intent as confirmation", () => {
    const source = observedActivity(null), previous = toImportedEntry(source, "tcx", { includeFileObservation: true })
    const drafts = buildImportDrafts([source], [previous]), onIntent = vi.fn()
    const props = { drafts, result: { format: "tcx" as const, activities: [source], skipped: 0 }, selected: new Set([0]),
      intents: new Map<number, ImportSaveIntent>([[0, { kind: "SAVE_SEPARATE" }]]),
      onIntent, onToggle: vi.fn(), onSave: vi.fn(), onRestart: vi.fn() }
    const view = render(createElement(ReviewStage, props))
    const select = screen.getByRole("combobox")
    expect((select as HTMLSelectElement).value).toBe("")
    expect(screen.getByRole("button", { name: "저장 방식을 골라 주세요" })).toBeDisabled()
    fireEvent.change(select, { target: { value: `use:${previous.id}` } })
    expect(onIntent).toHaveBeenLastCalledWith(0, { kind: "USE_EXISTING", entryId: previous.id, expectedSavedAt: previous.savedAt })
    fireEvent.change(select, { target: { value: "separate" } })
    expect(onIntent).toHaveBeenLastCalledWith(0, { kind: "SAVE_SEPARATE", confirmedSeparate: true })
    fireEvent.change(select, { target: { value: "exclude" } })
    expect(onIntent).toHaveBeenLastCalledWith(0, { kind: "EXCLUDE" })
    view.rerender(createElement(ReviewStage, { ...props, intents: new Map<number, ImportSaveIntent>([[0, { kind: "EXCLUDE" }]]) }))
    const exclude = screen.getByRole("button", { name: "고른 1건 가져오기에서 제외" })
    expect(exclude).not.toBeDisabled()
    fireEvent.click(exclude)
    expect(props.onSave).toHaveBeenCalledTimes(1)
  })

  it("counts selected writes and exclusions separately in the review action", () => {
    const sources = [activity, activity, activity], drafts = buildImportDrafts(sources, [])
    const props = { drafts, result: { format: "tcx" as const, activities: sources, skipped: 0 }, selected: new Set([0, 1]),
      intents: new Map<number, ImportSaveIntent>([[0, { kind: "SAVE_SEPARATE" }], [1, { kind: "EXCLUDE" }], [2, { kind: "EXCLUDE" }]]),
      onIntent: vi.fn(), onToggle: vi.fn(), onSave: vi.fn(), onRestart: vi.fn() }
    const view = render(createElement(ReviewStage, props))
    expect(screen.getByRole("button", { name: "1건 저장 · 1건 제외" })).not.toBeDisabled()
    expect(screen.queryByRole("button", { name: "고른 2건 일지에 저장" })).not.toBeInTheDocument()
    view.rerender(createElement(ReviewStage, { ...props, selected: new Set([1]) }))
    expect(screen.getByRole("button", { name: "고른 1건 가져오기에서 제외" })).not.toBeDisabled()
  })

  it("reports an all-excluded local result as exclusion completion, not failed import", () => {
    const view = render(createElement(SavedStage, { outcome: { saved: 0, failed: 0, excluded: 2, total: 7 }, onRestart: vi.fn() }))
    expect(screen.getByText("가져오기 제외 완료")).toBeInTheDocument()
    expect(screen.getByText("2건 가져오기에서 제외")).toBeInTheDocument()
    expect(screen.getByText("새로 저장한 일지는 없어요. 기존 일지는 그대로예요.")).toBeInTheDocument()
    expect(screen.queryByText("가져오기 실패")).not.toBeInTheDocument()
    expect(screen.queryByText("0건을 일지에 저장했어요")).not.toBeInTheDocument()
    view.rerender(createElement(SavedStage, { outcome: { saved: 0, failed: 1, excluded: 1, total: 7 }, onRestart: vi.fn() }))
    expect(screen.getByText("가져오기 실패")).toBeInTheDocument()
    expect(screen.queryByText("가져오기 제외 완료")).not.toBeInTheDocument()
  })

  it("mentions file correction only when this format's analysis is enabled", () => {
    const source = observedActivity(), drafts = buildImportDrafts([source], [])
    const props = { drafts, result: { format: "tcx" as const, activities: [source], skipped: 0 }, selected: new Set([0]),
      intents: new Map<number, ImportSaveIntent>([[0, { kind: "SAVE_SEPARATE" }]]),
      onIntent: vi.fn(), onToggle: vi.fn(), onSave: vi.fn(), onRestart: vi.fn() }
    const view = render(createElement(ReviewStage, props))
    expect(screen.getByText(/파일 기록은 분석에서 정정할 수 있어요/u)).toBeInTheDocument()
    expect(screen.queryByText(/현재 읽기 전용이에요/u)).not.toBeInTheDocument()
    vi.stubEnv("VITE_FEATURE_FILE_ANALYSIS_TCX", "false")
    view.rerender(createElement(ReviewStage, props))
    expect(screen.queryByText(/파일 기록은 분석에서 정정할 수 있어요/u)).not.toBeInTheDocument()
    expect(screen.getByText(/현재 읽기 전용이에요/u)).toBeInTheDocument()
  })
})

describe("account import confirmation", () => {
  it("saves confirmed file evidence as V3 with no EXPLICIT promotion or BASE inference", async () => {
    vi.stubEnv("VITE_FEATURE_FILE_ANALYSIS_TCX", "true")
    const drafts = await buildAccountImportDrafts([observedActivity()])
    const batch = createAccountImportConfirmation(drafts!.map(draft => ({ draft, intent: { kind: "SAVE_SEPARATE" } })), "tcx")
    batches.push(batch)
    expect(await batch.confirm()).toMatchObject({ account: 1, saved: 1 })
    const [entry, , purpose] = api.persist.mock.calls[0]!
    expect(purpose).toBe("FILE_OBSERVATION")
    expect(entry.system).toBe("")
    expect(entry.fileObservation.confirmation).not.toBeNull()
    expect(entry.fieldProvenance.distanceKm.provenance).toBe("DERIVED")
    expect(parseAccountJournalRecord({ version: 3, kind: "JOURNAL", state: "FINALIZED", entry })).not.toBeNull()
  })

  it("reuses an attached confirmed observation without overwriting memo or RPE", async () => {
    vi.stubEnv("VITE_FEATURE_FILE_ANALYSIS_TCX", "true")
    const source = observedActivity()
    const previous = { ...toImportedEntry(source, "tcx", { includeFileObservation: true }), id: "previous-quick-id",
      memo: "SYNTHETIC_PRIVATE_KEEP", memoPurpose: "PRIVATE_SELF_ONLY" as const, rpe: 4 }
    putAccountJournalProjection("A", { ...previous, syncState: "synced" })
    const drafts = await buildAccountImportDrafts([source])
    const batch = createAccountImportConfirmation(drafts!.map(draft => ({ draft, intent: { kind: "SAVE_SEPARATE" } })), "tcx")
    batches.push(batch)
    expect(await batch.confirm()).toMatchObject({ account: 1 })
    expect(api.persist).not.toHaveBeenCalled()
    expect(readAccountJournalPrivateEntry(previous.id)).toMatchObject({ memo: "SYNTHETIC_PRIVATE_KEEP", rpe: 4 })
  })

  it("keeps the source identity stable across row reordering and parser version changes", async () => {
    vi.stubEnv("VITE_FEATURE_FILE_ANALYSIS_TCX", "true")
    const source = observedActivity()
    const first = createAccountImportConfirmation([{ draft: { ...buildImportDrafts([source], [])[0]!, sourceIndex: 9 }, intent: { kind: "SAVE_SEPARATE" } }], "tcx")
    batches.push(first)
    await first.confirm()
    const stored = api.persist.mock.calls[0]![0]
    putAccountJournalProjection("A", { ...stored, syncState: "synced" })
    const changedParser = { ...source, observation: { ...source.observation, parserVersion: "tcx-v2" } }
    const second = createAccountImportConfirmation([{ draft: { ...buildImportDrafts([changedParser], [])[0]!, sourceIndex: 0 }, intent: { kind: "SAVE_SEPARATE" } }], "tcx")
    batches.push(second)
    expect(await second.confirm()).toMatchObject({ account: 1 })
    expect(api.persist).toHaveBeenCalledTimes(1)
    expect(stored.id).toContain(source.observation.sourceObservationKey)
  })

  it("does not silently choose the newest content for an existing source ID", async () => {
    vi.stubEnv("VITE_FEATURE_FILE_ANALYSIS_TCX", "true")
    const previous = toImportedEntry(observedActivity(), "tcx", { includeFileObservation: true })
    putAccountJournalProjection("A", { ...previous, syncState: "synced" })
    const draft = buildImportDrafts([observedActivity("tcx-fixture-1", 5100)], [previous])[0]!
    const batch = createAccountImportConfirmation([{ draft, intent: { kind: "SAVE_SEPARATE" } }], "tcx")
    batches.push(batch)
    expect(await batch.confirm()).toMatchObject({ account: 0, conflicts: 1 })
    expect(await batch.confirm()).toMatchObject({ account: 0, conflicts: 1 })
    expect(api.persist).not.toHaveBeenCalled()
  })

  it("stops new writes after an account/version rejection while keeping acknowledged rows", async () => {
    api.persist.mockResolvedValueOnce({ ok: true, storage: "ACCOUNT" })
      .mockResolvedValueOnce({ ok: false, storage: "FAILED", rejection: "UPGRADE_REQUIRED" })
    expect(await separate(3).confirm()).toMatchObject({ account: 1, failed: 2, stopReason: "SAVE_REJECTED" })
    expect(api.persist).toHaveBeenCalledTimes(2)
  })
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
