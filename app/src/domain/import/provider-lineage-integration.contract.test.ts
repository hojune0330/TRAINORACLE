import { beforeEach, describe, expect, it } from "vitest"
import { buildFileObservation, parseFileObservation, type FileObservationInput, type FileObservationV1 } from "./file-observation"
import { prepareDeviceActivity } from "./prepared-device-activity"
import { sameFileObservation, toImportedEntry } from "./import-draft"
import { buildFileAnalysisReport, projectFileObservation } from "./file-analysis"
import { correctAccountJournalImportedObservation, parseAccountJournalRecord, validateAccountJournalRecordUpdate } from "../account/account-journal-record-schema"
import { keepsImportedObjectiveFacts } from "../journal-edit-policy"
import { readBackupFile, FULL_FORMAT_V4 } from "../restore/backup-file"
import { evaluateProviderDataUse, type ProviderDataLineage } from "../provider-data-rights"

const lineage: ProviderDataLineage = { schemaVersion: "PROVIDER_DATA_LINEAGE_V1", sources: [{
  sourceId: "synthetic-garmin", originProvider: "GARMIN", transport: "FILE_UPLOAD", assurance: "USER_DECLARED",
}], fieldSources: { distanceMeters: ["synthetic-garmin"], durationSeconds: ["synthetic-garmin"],
  distanceKm: ["synthetic-garmin"], durationMin: ["synthetic-garmin"] } }
function input(dataLineage?: ProviderDataLineage): FileObservationInput {
  return { format: "tcx", sourceProfile: "TCX_ACTIVITY_V1", parserVersion: "tcx-1", sourceActivityId: "synthetic-1",
    date: "2026-10-30", startedAt: null, timeZone: null, sport: "RUNNING", distanceMeters: 5000,
    durationSeconds: 1500, durationMeaning: "TIMER",
    laps: [{ sourceIndex: 0, distanceMeters: 5000, durationSeconds: 1500, durationMeaning: "TIMER", kind: "UNKNOWN" }],
    confirmation: null, ...(dataLineage ? { dataLineage } : {}) }
}
function record(dataLineage?: ProviderDataLineage) {
  const observation = buildFileObservation(input(dataLineage))
  return toImportedEntry({ observation, date: observation.date, name: "", sport: "Running",
    distanceKm: "5", durationMin: "25", avgPace: "5:00" }, "tcx", { includeFileObservation: true })
}
const envelope = (entry: ReturnType<typeof record>) => ({ version: 3, state: "FINALIZED", kind: "JOURNAL", entry })
beforeEach(() => { window.localStorage.clear() })

describe("persisted provider lineage", () => {
  it("keeps legacy observations readable and deterministic analysis unchanged without granting AI", () => {
    const entry = record()
    expect(parseAccountJournalRecord(envelope(entry))).not.toBeNull()
    expect(projectFileObservation(entry, { formats: ["tcx"], sourceContext: "ACCOUNT_CONFIRMED" }).status).toBe("ACCEPTED")
    expect(evaluateProviderDataUse({ lineage: entry.fileObservation?.dataLineage, requestedFields: ["distanceKm"],
      purpose: "SELF_HOSTED_INFERENCE", hosting: "COMPANY_SELF_HOSTED", consentActive: true, grants: [], now: "2026-10-30T00:00:00Z" }).allowed).toBe(false)
  })
  it("round-trips lineage through confirmation, account codec, backup and descriptive projection", () => {
    const entry = record(lineage)
    expect(entry.fileObservation?.confirmation).not.toBeNull()
    expect(parseAccountJournalRecord(envelope(entry))?.entry).toEqual(entry)
    const restored = readBackupFile(JSON.stringify({ app: "TRAINORACLE", format: FULL_FORMAT_V4, entries: [entry] }))
    expect(restored.entries).toEqual([entry])
    const projected = projectFileObservation(entry, { formats: ["tcx"], sourceContext: "ACCOUNT_CONFIRMED" })
    expect(projected.status).toBe("ACCEPTED")
    if (projected.status === "ACCEPTED") expect(projected.observation.dataLineage).toEqual(lineage)
    expect(entry.fieldProvenance?.distanceKm?.provenance).toBe("DERIVED")
  })
  it("preserves old content identity but distinguishes source-rights metadata during import reuse", () => {
    const legacy = buildFileObservation(input()), withOrigin = buildFileObservation(input(lineage))
    expect(legacy.contentRevisionFingerprint).toBe(withOrigin.contentRevisionFingerprint)
    expect(legacy.sourceObservationKey).toBe(withOrigin.sourceObservationKey)
    expect(sameFileObservation(legacy, withOrigin)).toBe(false)
    expect(sameFileObservation(withOrigin, JSON.parse(JSON.stringify(withOrigin)))).toBe(true)
  })
  it("rejects origin erasure or relabelling during generic edits and file corrections", () => {
    const original = record(lineage), observation = original.fileObservation!
    const { dataLineage: _lineage, ...withoutLineage } = observation
    const replacements: FileObservationV1[] = [withoutLineage, { ...observation, dataLineage: { ...lineage,
      sources: [{ ...lineage.sources[0]!, originProvider: "COROS" as const }] } }]
    for (const replacement of replacements) {
      const edited = { ...original, fileObservation: replacement }
      expect(keepsImportedObjectiveFacts(original, edited)).toBe(false)
      expect(validateAccountJournalRecordUpdate(envelope(original), envelope(edited))).toBe(false)
      const corrected = buildFileObservation({ ...input(replacement.dataLineage), sourceIdentityFingerprint: observation.sourceIdentityFingerprint,
        confirmation: observation.confirmation, sport: "WALKING" })
      expect(correctAccountJournalImportedObservation(envelope(original), observation.contentRevisionFingerprint,
        corrected, ["sport"])).toBeNull()
    }
    const permittedCorrection = buildFileObservation({ ...input(lineage), sourceIdentityFingerprint: observation.sourceIdentityFingerprint,
      confirmation: observation.confirmation, sport: "WALKING" })
    expect(correctAccountJournalImportedObservation(envelope(original), observation.contentRevisionFingerprint,
      permittedCorrection, ["sport"])).not.toBeNull()
  })
  it("rejects sensitive/permission claims inside lineage instead of silently stripping", () => {
    const observation = buildFileObservation(input(lineage))
    expect(parseFileObservation({ ...observation, dataLineage: { ...lineage, grantIds: ["untrusted-grant"] } })).toBeNull()
    expect(parseFileObservation({ ...observation, dataLineage: { ...lineage,
      sources: [{ ...lineage.sources[0], memo: "PRIVATE_SENTINEL" }] } })).toBeNull()
    expect(() => buildFileObservation(input({ ...lineage, sources: [{ ...lineage.sources[0]!, transport: "PROVIDER_API" }] }))).toThrow("INVALID_FILE_OBSERVATION")
  })
  it("preserves indirect Garmin origin and rejects direct-provider relabelling", () => {
    const provider = { provider: "HEALTHKIT", sourceId: "synthetic-1", sourceVersion: null, sport: "RUNNING",
      startedAt: "2026-10-30T00:00:00Z", timeZone: "UTC", distanceMeters: 5000, durationSeconds: 1500,
      durationMeaning: "TIMER", laps: [] }
    const indirect = { ...lineage, sources: [{ ...lineage.sources[0]!, transport: "HEALTHKIT" as const }] }
    expect(prepareDeviceActivity({ ...provider, dataLineage: indirect })?.dataLineage).toEqual(indirect)
    const wrong = { ...lineage, sources: [{ ...lineage.sources[0]!, originProvider: "COROS" as const, transport: "PROVIDER_API" as const }] }
    expect(prepareDeviceActivity({ ...provider, provider: "GARMIN", dataLineage: wrong })).toBeNull()
    expect(prepareDeviceActivity({ ...provider, dataLineage: { ...indirect, approved: true } })).toBeNull()
  })
  it("carries original sources into computed totals and pace without laundering an unknown copy", () => {
    const entry = record(lineage)
    const options = { formats: ["tcx" as const], sourceContext: "ACCOUNT_CONFIRMED" as const,
      startDate: entry.date, endDate: entry.date }
    const report = buildFileAnalysisReport([entry], options)
    expect(report.sports[0]?.distanceMeters.value).toBe(5000)
    expect(report.sports[0]?.distanceMeters.dataLineage?.sources).toEqual(lineage.sources)
    expect(report.sports[0]?.timeSummaries[0]?.paceSecondsPerKm.dataLineage?.fieldSources.avgPace).toEqual(["synthetic-garmin"])
    const duplicateWithoutLineage = record()
    const conflict = buildFileAnalysisReport([entry, duplicateWithoutLineage], options)
    expect(conflict.conflictingSourceCount).toBe(1)
    expect(conflict.includedSourceCount).toBe(0)
  })
})
