import { beforeEach, expect, it } from "vitest"
import { parseActivityFile } from "./activity-file"
import { buildFileObservation, parseFileObservation, prepareLegacyFileDetailUpgrade, type FileObservationV1 } from "./file-observation"
import { buildImportDrafts, confirmImportDrafts, fileImportCandidateKind, toImportedEntry } from "./import-draft"
import { correctAccountJournalImportedObservation, parseAccountJournalRecord, validateInitialFileObservationRecord } from "../account/account-journal-record-schema"
import { readBackupFile } from "../restore/backup-file"
import { evaluateProviderDataUse } from "../provider-data-rights"
import { initializeCanonicalJournalFixture } from "../../test/canonical-journal-fixture"
import { loadEntries, saveEntry } from "../journal-store"

const xml = `<TrainingCenterDatabase><Activities><Activity Sport="Running"><Id>2026-11-04T07:00:00Z</Id><Lap StartTime="2026-11-04T07:00:00Z"><TotalTimeSeconds>300</TotalTimeSeconds><DistanceMeters>1000</DistanceMeters><Track><Trackpoint><Time>2026-11-04T07:00:00Z</Time><HeartRateBpm><Value>123</Value></HeartRateBpm></Trackpoint></Track></Lap></Activity></Activities></TrainingCenterDatabase>`
const activity = () => parseActivityFile(xml, "UTC").activities[0]!
function fields(observation: FileObservationV1) {
  const { schemaVersion, source, sourceObservationKey, contentRevisionFingerprint, completeness, ...input } = observation
  return input
}
function legacy() {
  const { detail, sourceIdentityFingerprint, ...input } = fields(activity().observation!)
  return buildFileObservation({ ...input, parserVersion: "legacy-parser-v1" })
}
function record(observation = legacy()) {
  return { version: 3 as const, state: "FINALIZED" as const, kind: "JOURNAL" as const,
    entry: toImportedEntry({ ...activity(), observation }, "tcx") }
}
beforeEach(async () => { localStorage.clear(); await initializeCanonicalJournalFixture() })

it("upgrades only an explicitly confirmed exact legacy source and preserves its identity and trust", () => {
  const old = record(), original = old.entry.fileObservation!
  const upgraded = prepareLegacyFileDetailUpgrade(original, activity().observation)!
  expect(upgraded).toMatchObject({ sourceIdentityScope: "LEGACY_UNSCOPED_V1", sourceObservationKey: original.sourceObservationKey,
    sourceIdentityFingerprint: original.sourceIdentityFingerprint, parserVersion: original.parserVersion, confirmation: original.confirmation })
  expect(upgraded.detail?.samples[0]?.metrics.heartRateBpm).toBe(123)
  expect(upgraded.dataLineage).toBeUndefined()
  expect(correctAccountJournalImportedObservation(old, original.contentRevisionFingerprint, upgraded, [])).toBeNull()
  const next = correctAccountJournalImportedObservation(old, original.contentRevisionFingerprint, upgraded, ["detail"])!
  expect(next.version).toBe(5)
  expect(next.entry).toEqual({ ...old.entry, fileObservation: upgraded })
  expect(parseAccountJournalRecord(next)).toEqual(next)
  expect(validateInitialFileObservationRecord(next)).toBe(false)
  expect(validateInitialFileObservationRecord(next, "FILE_OBSERVATION")).toBe(false)
  expect(validateInitialFileObservationRecord(next, "MIGRATION")).toBe(true)
  expect(evaluateProviderDataUse({ lineage: upgraded.dataLineage, requestedFields: ["distanceMeters"], purpose: "SELF_HOSTED_INFERENCE",
    hosting: "COMPANY_SELF_HOSTED", consentActive: true, grants: [], now: "2026-11-04T12:00:00Z" })).toEqual({ allowed: false, reason: "MISSING_LINEAGE" })
})

it("rejects fuzzy IDs, absent IDs, changed facts, changed source namespaces and forged fresh markers", () => {
  const old = record(), original = old.entry.fileObservation!, rich = activity().observation!
  for (const candidate of [
    buildFileObservation({ ...fields(rich), sourceActivityId: "different-id" }),
    buildFileObservation({ ...fields(rich), startedAt: "2026-11-04T08:00:00Z" }),
    buildFileObservation({ ...fields(rich), laps: [{ ...rich.laps[0]!, durationSeconds: 301 }], durationSeconds: 301 }),
  ]) expect(prepareLegacyFileDetailUpgrade(original, candidate)).toBeNull()
  expect(prepareLegacyFileDetailUpgrade(buildFileObservation({ ...fields(original), sourceActivityId: null }), rich)).toBeNull()
  const declaredOther = buildFileObservation({ ...fields(original), dataLineage: {
    schemaVersion: "PROVIDER_DATA_LINEAGE_V1", sources: [{ sourceId: "old-source", originProvider: "COROS", transport: "FILE_UPLOAD", assurance: "USER_DECLARED" }],
    fieldSources: { distanceMeters: ["old-source"] },
  } })
  expect(prepareLegacyFileDetailUpgrade(declaredOther, rich)).toBeNull()
  const upgraded = prepareLegacyFileDetailUpgrade(original, rich)!
  const next = correctAccountJournalImportedObservation(old, original.contentRevisionFingerprint, upgraded, ["detail"])!
  const other = buildFileObservation({ ...fields(upgraded), detail: { ...upgraded.detail!, source: { ...upgraded.detail!.source, originProvider: "COROS" } } })
  expect(correctAccountJournalImportedObservation(next, upgraded.contentRevisionFingerprint, other, ["detail"])).toBeNull()
  expect(parseFileObservation({ ...upgraded, source: "PROVIDER_API" })).toBeNull()
  expect(parseFileObservation({ ...upgraded, sourceObservationKey: rich.sourceObservationKey })).toBeNull()
  expect(fileImportCandidateKind(next.entry, { ...activity(), observation: buildFileObservation({ ...fields(rich),
    detail: { ...rich.detail!, source: { ...rich.detail!.source, originProvider: "COROS" } } }) })).toBeNull()
})

it("round-trips a V7 backup and explicitly reuses the exact rich file without duplicate identity", () => {
  const old = record(), observation = prepareLegacyFileDetailUpgrade(old.entry.fileObservation, activity().observation)!
  const next = correctAccountJournalImportedObservation(old, old.entry.fileObservation!.contentRevisionFingerprint, observation, ["detail"])!
  const backup = readBackupFile(JSON.stringify({ app: "TRAINORACLE", format: "trainoracle.journal.full-backup.v7", entries: [next.entry] }))
  expect(backup.entries).toEqual([next.entry])
  expect(saveEntry(backup.entries[0]!).ok).toBe(true)
  const draft = buildImportDrafts([activity()])[0]!, candidate = draft.identityCandidates![0]!
  expect(candidate.kind).toBe("REUSE")
  expect(confirmImportDrafts([{ draft, intent: { kind: "USE_EXISTING", entryId: candidate.id, expectedSavedAt: candidate.savedAt } }], "tcx"))
    .toMatchObject({ saved: 0, reused: 1 })
  expect(confirmImportDrafts([{ draft, intent: { kind: "SAVE_SEPARATE", confirmedSeparate: true } }], "tcx"))
    .toMatchObject({ saved: 0, reused: 1 })
  expect(loadEntries()).toEqual([next.entry])
})
