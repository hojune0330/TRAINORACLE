import { beforeEach, expect, it, vi } from "vitest"
import { initializeCanonicalJournalFixture } from "../../test/canonical-journal-fixture"
import { parseActivityFile } from "./activity-file"
import { buildImportDrafts, confirmImportDrafts, toImportedEntry } from "./import-draft"
import { deleteEntry, exportEntriesJSON, loadEntries, restoreDeletedEntry, saveEntry } from "../journal-store"
import { buildFileObservation } from "./file-observation"
import { readBackupFile } from "../restore/backup-file"
import { accountJournalRecordVersion, parseAccountJournalRecord, validateAccountJournalRecordUpdate, correctAccountJournalImportedObservation } from "../account/account-journal-record-schema"
import { JOURNAL_STORAGE_KEY } from "../journal-local-storage"
import { toExportJournalEntry, toAnalysisJournalEntry } from "../safe-export"

const source = (heartRate = 131) => `<TrainingCenterDatabase><Activities><Activity Sport="Running"><Id>2026-11-01T00:00:00Z</Id><Creator><Name>Garmin synthetic</Name></Creator><Lap StartTime="2026-11-01T00:00:00Z"><TotalTimeSeconds>60</TotalTimeSeconds><DistanceMeters>200</DistanceMeters><Track><Trackpoint><Time>2026-11-01T00:00:00Z</Time><Position><LatitudeDegrees>37.5</LatitudeDegrees><LongitudeDegrees>127.1</LongitudeDegrees></Position><HeartRateBpm><Value>${heartRate}</Value></HeartRateBpm></Trackpoint><Trackpoint><Time>2026-11-01T00:01:00Z</Time><HeartRateBpm><Value>140</Value></HeartRateBpm></Trackpoint></Track></Lap></Activity></Activities></TrainingCenterDatabase>`
const activity = (heartRate?: number) => parseActivityFile(source(heartRate), "Asia/Seoul").activities[0]!
const save = (heartRate?: number) => confirmImportDrafts([{ draft: buildImportDrafts([activity(heartRate)])[0]!, intent: { kind: "SAVE_SEPARATE" } }], "tcx")
beforeEach(async () => { vi.unstubAllEnvs(); localStorage.clear(); sessionStorage.clear(); await initializeCanonicalJournalFixture() })

it("preserves parsed sensors and coordinates across local save, fresh read, full backup, trash and restore", () => {
  expect(save()).toMatchObject({ saved: 1, failed: 0 })
  const entry = loadEntries()[0]!
  expect(entry.kind).toBe("post-session")
  if (entry.kind !== "post-session") throw new Error("missing entry")
  expect(entry.fileObservation?.detail?.samples[0]).toMatchObject({ metrics: { heartRateBpm: 131 }, position: { latitudeDegrees: 37.5 } })
  const raw = exportEntriesJSON({ includeRawMemos: true })
  expect(JSON.parse(raw).format).toBe("trainoracle.journal.full-backup.v7")
  expect(readBackupFile(raw).entries[0]).toEqual(entry)
  expect(JSON.stringify(toExportJournalEntry(entry))).not.toContain("latitudeDegrees")
  expect(JSON.stringify(toAnalysisJournalEntry(entry))).not.toContain("heartRateBpm")
  expect(deleteEntry(entry.id).ok).toBe(true)
  expect(loadEntries()).toHaveLength(0)
  expect(save()).toMatchObject({ saved: 0, conflicts: 1 })
  const restored = restoreDeletedEntry(entry.id)
  expect(restored.ok).toBe(true)
  expect(loadEntries()[0]).toEqual({ ...entry, id: restored.restoredId })
})

it("does not duplicate an acknowledged source or overwrite a sensor-only correction", () => {
  expect(save().saved).toBe(1)
  const before = loadEntries()
  expect(save()).toMatchObject({ saved: 0, reused: 1 })
  expect(save(150)).toMatchObject({ saved: 0, conflicts: 1 })
  expect(loadEntries()).toEqual(before)
})

it("requires an explicit choice when a legacy source returns with newly preserved detail", () => {
  const rich = activity()
  const { schemaVersion, source: origin, sourceObservationKey, sourceIdentityFingerprint, contentRevisionFingerprint, completeness, detail, ...input } = rich.observation!
  const legacy = { ...rich, observation: buildFileObservation(input) }
  expect(saveEntry(toImportedEntry(legacy, "tcx")).ok).toBe(true)
  const before = loadEntries(), draft = buildImportDrafts([rich])[0]!
  expect(draft.requiresIdentityChoice).toBe(true)
  expect(draft.identityCandidates?.[0]?.kind).toBe("CORRECTION")
  expect(confirmImportDrafts([{ draft, intent: { kind: "SAVE_SEPARATE" } }], "tcx")).toMatchObject({ saved: 0, conflicts: 1 })
  expect(loadEntries()).toEqual(before)
  expect(confirmImportDrafts([{ draft, intent: { kind: "SAVE_SEPARATE", confirmedSeparate: true } }], "tcx")).toMatchObject({ saved: 1, conflicts: 0 })
  expect(loadEntries()).toHaveLength(2)
})

it("requires account V5 for rich facts and rejects a version downgrade or detail stripping", () => {
  const entry = toImportedEntry(activity(), "tcx")
  const record = { version: accountJournalRecordVersion(entry), kind: "JOURNAL", state: "FINALIZED", entry }
  expect(record.version).toBe(5)
  expect(parseAccountJournalRecord(record)).not.toBeNull()
  expect(parseAccountJournalRecord({ ...record, version: 3 })).toBeNull()
  const { fileObservation: _file, ...dropped } = entry
  expect(validateAccountJournalRecordUpdate(record, { ...record, version: 2, entry: dropped })).toBe(false)
  const backup = { app: "TRAINORACLE", format: "trainoracle.journal.full-backup.v5", entries: [entry] }
  expect(readBackupFile(JSON.stringify(backup))).toMatchObject({ entries: [], skipped: 1 })
})

it("does not rewrite a no-ID source declaration through sensor correction", () => {
  const { schemaVersion, source: origin, sourceObservationKey, sourceIdentityFingerprint, contentRevisionFingerprint, completeness, ...input } = activity().observation!
  const original = buildFileObservation({ ...input, sourceActivityId: null })
  const entry = toImportedEntry({ ...activity(), observation: original }, "tcx")
  const record = { version: 5, kind: "JOURNAL", state: "FINALIZED", entry }
  const sourceChange = buildFileObservation({ ...input, sourceActivityId: null, sourceIdentityFingerprint: original.sourceIdentityFingerprint,
    detail: { ...original.detail!, source: { ...original.detail!.source, originProvider: "OTHER" } } })
  expect(sourceChange.sourceObservationKey).toBe(original.sourceObservationKey)
  expect(correctAccountJournalImportedObservation(record, original.contentRevisionFingerprint, sourceChange, ["detail"])).toBeNull()
  const { detail, ...without } = input
  const removed = buildFileObservation({ ...without, sourceActivityId: null, sourceIdentityFingerprint: original.sourceIdentityFingerprint })
  expect(correctAccountJournalImportedObservation(record, original.contentRevisionFingerprint, removed, ["detail"])).toBeNull()
})

it("keeps existing bytes and reports failure if browser storage rejects rich records", () => {
  const before = localStorage.getItem(JOURNAL_STORAGE_KEY)
  const real = Storage.prototype.setItem
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
    if (key === JOURNAL_STORAGE_KEY && value.includes("heartRateBpm")) throw new DOMException("quota", "QuotaExceededError")
    return real.call(this, key, value)
  })
  expect(save()).toMatchObject({ saved: 0, failed: 1 })
  expect(localStorage.getItem(JOURNAL_STORAGE_KEY)).toBe(before)
  expect(loadEntries()).toHaveLength(0)
})
