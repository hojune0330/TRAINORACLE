import { describe, expect, it } from "vitest"
import { prepareCoachingRecordEvidence, buildCoachingEvidenceFacts } from "./coaching-record-evidence"
import { buildFileObservation } from "./import/file-observation"
import type { ProviderDataLineage } from "./provider-data-rights"

const firstId = "11111111-1111-4111-8111-111111111111", secondId = "22222222-2222-4222-8222-222222222222"
const thirdId = "33333333-3333-4333-8333-333333333333"
const directLineage: ProviderDataLineage = { schemaVersion: "PROVIDER_DATA_LINEAGE_V1", sources: [
  { sourceId: "direct", originProvider: "USER", transport: "DIRECT_INPUT", assurance: "USER_DECLARED" },
], fieldSources: { distanceKm: ["direct"], durationMin: ["direct"] } }
const fileLineage: ProviderDataLineage = { schemaVersion: "PROVIDER_DATA_LINEAGE_V1", sources: [
  { sourceId: "garmin", originProvider: "GARMIN", transport: "FILE_UPLOAD", assurance: "PROVIDER_VERIFIED" },
], fieldSources: { distanceMeters: ["garmin"], durationSeconds: ["garmin"], sport: ["garmin"], durationMeaning: ["garmin"] } }
function entry() {
  return { id: "journal-entry", kind: "post-session", date: "2026-10-30", savedAt: "2026-10-30T00:00:00Z", syncState: "local",
    system: "", title: "PRIVATE_TITLE_CANARY", distanceKm: "5", durationMin: "30", avgPace: "", rpe: 0,
    memo: "PRIVATE_MEMO_CANARY", memoPurpose: "ANALYZABLE_TRAINING_NOTE",
    fieldProvenance: { distanceKm: { provenance: "EXPLICIT" }, durationMin: { provenance: "EXPLICIT" } } }
}
function direct(patch = {}, documentId = firstId) {
  return prepareCoachingRecordEvidence({ documentId, revision: 1, document: { version: 2, state: "FINALIZED", kind: "JOURNAL",
    entry: { ...entry(), ...patch } }, lineage: directLineage })
}
function file(options: { id?: string; sourceActivityId?: string; meaning?: "TIMER" | "MOVING" | "ELAPSED" | "UNKNOWN";
  sport?: "RUNNING" | "CYCLING"; missingDuration?: boolean; distance?: number; formats?: readonly ("csv" | "tcx")[]; confirmed?: boolean } = {}) {
  const distance = options.distance ?? 5000, seconds = options.missingDuration ? null : 1800
  const observation = buildFileObservation({ format: "csv", sourceProfile: "CSV_COLUMNS_V1", parserVersion: "csv-1",
    sourceActivityId: options.sourceActivityId ?? options.id ?? firstId, date: "2026-10-30", startedAt: null, timeZone: null,
    sport: options.sport ?? "RUNNING", distanceMeters: distance, durationSeconds: seconds, durationMeaning: options.meaning ?? "TIMER",
    laps: [], confirmation: options.confirmed === false ? null : { sport: null, durationMeaning: null }, dataLineage: fileLineage })
  return prepareCoachingRecordEvidence({ documentId: options.id ?? firstId, revision: 1,
    document: { version: 3, state: "FINALIZED", kind: "JOURNAL", entry: { ...entry(),
      // Deliberately different compatibility cache: facts must use the canonical file.
      distanceKm: "999", durationMin: "999", fileObservation: observation,
      fieldProvenance: { distanceKm: { provenance: "DERIVED", derivedFrom: ["import:activity-file"], derivationRuleId: "import:csv" },
        durationMin: { provenance: "DERIVED", derivedFrom: ["import:activity-file"], derivationRuleId: "import:csv" } } } },
    lineage: fileLineage, allowedFormats: options.formats ?? ["csv"] })
}

describe("canonical company coaching evidence", () => {
  it("projects valid direct explicit facts without raw journal or pretending to know sport/time semantics", () => {
    const a = direct()!, b = direct({ distanceKm: "10", durationMin: "60" }, secondId)!
    expect(a).not.toBeNull()
    const result = buildCoachingEvidenceFacts([a, b])!
    expect(result.facts.map(value => value.value)).toEqual([5, 30, 10, 60])
    expect(result.facts.every(value => value.sourceDocumentIds.length === 1)).toBe(true)
    expect(result.reviewReasons).toContain("DIRECT_TIME_MEANING_UNSPECIFIED")
    expect(JSON.stringify([a, result])).not.toMatch(/PRIVATE_|memo|title|rpe/)
  })
  it.each(["PRIVATE_SELF_ONLY", "bad-value"])("never expands raw/private memo handling: %s", purpose => {
    expect(direct({ memoPurpose: purpose })).toBeNull()
  })
  it.each(["WAITING", "REVIEW_REQUIRED", "CONFLICT"])("excludes unresolved %s state", objectiveDataState => {
    expect(direct({ objectiveDataState })).toBeNull()
  })
  it("does not elevate missing or derived direct facts into eligible metrics", () => {
    expect(direct({ fieldProvenance: undefined })).toBeNull()
    expect(direct({ fieldProvenance: { distanceKm: { provenance: "DERIVED", derivedFrom: ["import:activity-file"], derivationRuleId: "import:csv" } } })).toBeNull()
    const partial = direct({ durationMin: "", fieldProvenance: { distanceKm: { provenance: "EXPLICIT" } } })!
    expect(partial.requiredFields).toEqual(["distanceKm"])
    expect(buildCoachingEvidenceFacts([partial])?.reviewReasons).toContain("MISSING_VALUES")
  })
  it("uses accepted canonical file facts, keeps old caches out and requires server format adoption", () => {
    const value = file()!
    expect(value).toMatchObject({ distanceKm: 5, durationMin: 30, requiredFields: ["sport", "distanceMeters", "durationSeconds", "durationMeaning"] })
    const result = buildCoachingEvidenceFacts([value], { includePace: true })!
    expect(result.facts.map(fact => fact.value)).toEqual([5, 30, 360])
    expect(JSON.stringify(result)).not.toContain("999")
    expect(Object.isFrozen(value.requiredFields)).toBe(true)
    expect(Object.isFrozen(value.fileObservation?.laps)).toBe(true)
    expect(Object.isFrozen(value.lineage.sources)).toBe(true)
    expect(buildCoachingEvidenceFacts([value])?.facts.some(fact => fact.unit === "sec/km")).toBe(false)
    expect(file({ formats: [] })).toBeNull()
    expect(file({ confirmed: false })).toBeNull()
  })
  it("groups sports and incompatible time bases independently without a pooled total", () => {
    const result = buildCoachingEvidenceFacts([file()!, file({ id: secondId, meaning: "MOVING" })!,
      file({ id: thirdId, sport: "CYCLING", meaning: "TIMER", distance: 10000 })!])!
    expect(result.facts.filter(fact => fact.unit === "km").map(fact => fact.value)).toEqual([10, 10])
    expect(result.facts.filter(fact => fact.unit === "min").map(fact => fact.value)).toEqual([30, 30, 30])
    expect(result.reviewReasons).toContain("SEPARATE_SPORTS")
    expect(result.reviewReasons).toContain("SEPARATE_TIME_BASIS")
    expect(result.summaryIds).toContain("SEPARATE_TIME_BASIS")
  })
  it("keeps unknown time per record and withholds pace; missing values remain missing", () => {
    const result = buildCoachingEvidenceFacts([file({ meaning: "UNKNOWN" })!,
      file({ id: secondId, meaning: "UNKNOWN" })!, file({ id: thirdId, missingDuration: true })!], { includePace: true })!
    expect(result.facts.filter(fact => fact.unit === "min").map(fact => fact.value)).toEqual([30, 30])
    expect(result.facts.some(fact => fact.unit === "sec/km")).toBe(false)
    expect(result.reviewReasons).toEqual(expect.arrayContaining(["TIME_MEANING_UNCONFIRMED", "MISSING_VALUES"]))
  })
  it("uses existing source identity to count duplicates once and exclude conflicting copies", () => {
    const duplicate = buildCoachingEvidenceFacts([file()!, file({ id: secondId, sourceActivityId: firstId })!])!
    expect(duplicate.reviewReasons).toContain("DUPLICATE_SOURCE")
    expect(duplicate.facts.find(fact => fact.unit === "km")?.value).toBe(5)
    const conflict = buildCoachingEvidenceFacts([file()!, file({ id: secondId, sourceActivityId: firstId, distance: 6000 })!])!
    expect(conflict.reviewReasons).toContain("CONFLICTING_SOURCE")
    expect(conflict.facts).toEqual([])
  })
  it("rejects rehydrated/unverified projections and same-document duplicate requests", () => {
    const value = direct()!
    expect(buildCoachingEvidenceFacts([JSON.parse(JSON.stringify(value))])).toBeNull()
    expect(buildCoachingEvidenceFacts([value, value])).toBeNull()
  })
})
