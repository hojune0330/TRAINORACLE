import { beforeEach, describe, expect, it, vi } from "vitest"
import { buildFileObservation } from "./file-observation"
import { confirmedFileActivity, toImportedEntry } from "./import-draft"
import { parseAccountJournalRecord, validateAccountJournalRecordUpdate } from "../account/account-journal-record-schema"
import { parseJournalEntryForWrite } from "../journal-schema"
import { keepsImportedObjectiveFacts } from "../journal-edit-policy"
import { fromStructuredJournalPayload, toExportJournalEntry } from "../safe-export"
import { readBackupFile, FULL_FORMAT_V4, FULL_FORMAT_V3 } from "../restore/backup-file"
import { createPlannedSessionLogDraft } from "../planned-session-link"
import type { ComparisonRelationV1 } from "./comparison-relation"

function activity() {
  const observation = buildFileObservation({ format: "tcx", sourceProfile: "TCX_ACTIVITY_V1", parserVersion: "tcx-1",
    sourceActivityId: "synthetic-1", date: "2026-09-19", startedAt: null, timeZone: null, sport: "RUNNING",
    distanceMeters: 5000.123, durationSeconds: 1500.456, durationMeaning: "SOURCE_DEFINED",
    laps: [{ sourceIndex: 0, distanceMeters: 5000.123, durationSeconds: 1500.456, durationMeaning: "SOURCE_DEFINED", kind: "UNKNOWN" }], confirmation: null })
  return { date: observation.date, name: "Synthetic notes that must not become evidence", sport: "Running",
    distanceKm: "5.00", durationMin: "25", avgPace: "5:00", observation }
}
function record() { return toImportedEntry(activity(), "tcx", { includeFileObservation: true }) }
beforeEach(() => { window.localStorage.clear(); vi.unstubAllEnvs() })

describe("file observation journal integration", () => {
  it("preserves exact numeric facts and unknown time semantics without inferring BASE", () => {
    const entry = record()
    expect(entry.system).toBe("")
    expect(entry.title).toBe("가져온 달리기")
    expect(entry.distanceKm).toBe(String(5000.123 / 1000))
    expect(entry.durationMin).toBe(String(1500.456 / 60))
    expect(entry.avgPace).toBe("")
    expect(entry.fileObservation?.confirmation).toEqual({ durationMeaning: null, sport: null })
    expect(entry.fieldProvenance?.distanceKm?.provenance).toBe("DERIVED")
    expect(parseJournalEntryForWrite(entry)).not.toBeNull()
    expect(parseAccountJournalRecord({ version: 3, kind: "JOURNAL", state: "FINALIZED", entry })).not.toBeNull()
    expect(parseAccountJournalRecord({ version: 2, kind: "JOURNAL", state: "FINALIZED", entry })).toBeNull()
  })
  it("rejects corrupted requested evidence rather than falling back to a legacy success", () => {
    const invalid = { ...activity(), observation: { ...activity().observation, distanceMeters: 4 } }
    expect(confirmedFileActivity(invalid, "tcx")).toBeNull()
    expect(() => toImportedEntry(invalid, "tcx", { includeFileObservation: true })).toThrow("INVALID_FILE_OBSERVATION")
  })
  it("keeps feature-off imports V2 and never automatically upgrades old data", () => {
    const entry = toImportedEntry(activity(), "tcx")
    expect(entry.fileObservation).toBeUndefined()
    expect(parseAccountJournalRecord({ version: 2, kind: "JOURNAL", state: "FINALIZED", entry })).not.toBeNull()
  })
  it("does not drop or change observation facts during ordinary journal edits", () => {
    const entry = record()
    const { fileObservation: _obs, ...dropped } = entry
    expect(keepsImportedObjectiveFacts(entry, dropped)).toBe(false)
    expect(validateAccountJournalRecordUpdate({ version: 3, kind: "JOURNAL", state: "FINALIZED", entry },
      { version: 2, kind: "JOURNAL", state: "FINALIZED", entry: dropped })).toBe(false)
  })
  it("keeps precise observations in V4 owner backups and out of public safe payloads", () => {
    const entry = { ...record(), memo: "PRIVATE_SENTINEL" }
    const backup = (format: string) => JSON.stringify({ app: "TRAINORACLE", format, entries: [entry] })
    const full = readBackupFile(backup(FULL_FORMAT_V4))
    expect(full.entries).toHaveLength(1)
    expect(full.entries[0]).toEqual(entry)
    const old = readBackupFile(backup(FULL_FORMAT_V3))
    expect(old.entries).toHaveLength(0)
    expect(old.skipped).toBe(1)
    const shared = toExportJournalEntry(entry)
    expect(shared).not.toHaveProperty("fileObservation")
    expect(JSON.stringify(shared)).not.toContain("PRIVATE_SENTINEL")
    expect(fromStructuredJournalPayload({ ...shared, fileObservation: entry.fileObservation })).toBeNull()
  })
  it("keeps corrected source identity and precision through owner backup roundtrip", () => {
    const entry = record(), previous = entry.fileObservation!
    const { schemaVersion: _v, source: _s, completeness: _c, sourceObservationKey: _k, contentRevisionFingerprint: _f, ...input } = previous
    const corrected = buildFileObservation({ ...input, distanceMeters: 5100.123,
      laps: [{ ...input.laps[0]!, distanceMeters: 5100.123 }] })
    expect(corrected.sourceObservationKey).toBe(previous.sourceObservationKey)
    expect(corrected.contentRevisionFingerprint).not.toBe(previous.contentRevisionFingerprint)
    const result = readBackupFile(JSON.stringify({ app: "TRAINORACLE", format: FULL_FORMAT_V4,
      entries: [{ ...entry, distanceKm: "5.100123", fileObservation: corrected }] }))
    expect(result.entries[0]).toHaveProperty("fileObservation", corrected)
  })
  it("roundtrips private comparison history in owner backups without exporting or promoting its authority", () => {
    const entry = record()
    const session = { day: 1, slot: "AM" as const, role: "QUALITY" as const, plannedEnergyIntent: "LT_INTENT" as const,
      prescription: { kind: "SYNTHETIC_IDENTITY_ONLY" } }
    const reference = createPlannedSessionLogDraft({ intake: { startDate: entry.date }, generatedAt: `${entry.date}T00:00:00.000Z`,
      activePlan: { candidateId: "synthetic-no-runtime-authority", sessions: [session] } }, session, `${entry.date}T00:00:00.000Z`)!.link
    const relation: ComparisonRelationV1 = { schemaVersion: 1, relationId: "11111111-1111-4111-8111-111111111111", journalId: entry.id,
      journalRevisionAtConfirmation: 4, contentRevisionFingerprint: entry.fileObservation!.contentRevisionFingerprint,
      observationInterpretationFingerprint: `sha256:${"b".repeat(64)}`, original: { planFingerprint: `sha256:${"c".repeat(64)}`, session: reference },
      mappingVersion: 1, mappingConfirmation: "USER_CONFIRMED", segmentMappings: [{ planSegmentId: "main/0/0", sourceLapIndex: 0,
        confirmedKind: "WORK", confirmedTargetUnit: "DISTANCE", confirmedDurationMeaning: "TIMER", confirmedRecoveryMode: null }],
      createdAt: `${entry.date}T00:00:00.000Z`, releasedAt: null }
    const privateEntry = { ...entry, comparisonRelations: [relation] }
    const restored = readBackupFile(JSON.stringify({ app: "TRAINORACLE", format: FULL_FORMAT_V4, entries: [privateEntry] }))
    expect(restored.entries).toEqual([privateEntry])
    const shared = toExportJournalEntry(privateEntry)
    expect(shared).not.toHaveProperty("comparisonRelations")
    expect(fromStructuredJournalPayload({ ...shared, comparisonRelations: [relation] })).toBeNull()
    expect(readBackupFile(JSON.stringify({ app: "TRAINORACLE", format: FULL_FORMAT_V3, entries: [privateEntry] })).skipped).toBe(1)
    expect(parseAccountJournalRecord({ version: 2, kind: "JOURNAL", state: "FINALIZED", entry: privateEntry })).toBeNull()
  })
})
