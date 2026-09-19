import { describe, expect, it } from "vitest"
import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { buildFileObservation, fileObservationSchema, parseFileObservation, toFileObservationSummary } from "./file-observation"
import type { FileObservationInput } from "./file-observation"
import { prepareDeviceActivity } from "./prepared-device-activity"

function input(patch: Partial<FileObservationInput> = {}): FileObservationInput {
  return {
    format: "tcx", sourceProfile: "TCX_ACTIVITY_V1", parserVersion: "tcx-observation-1",
    sourceActivityId: "2026-09-18T23:30:00Z",
    date: "2026-09-19", startedAt: "2026-09-18T23:30:00Z", timeZone: "Asia/Seoul",
    sport: "RUNNING", distanceMeters: 5000.125, durationSeconds: 1500.75, durationMeaning: "SOURCE_DEFINED",
    laps: [
      { sourceIndex: 0, distanceMeters: 4000, durationSeconds: 1200, durationMeaning: "SOURCE_DEFINED", kind: "UNKNOWN" },
      { sourceIndex: 1, distanceMeters: 1000.125, durationSeconds: 300.75, durationMeaning: "SOURCE_DEFINED", kind: "RECOVERY" },
    ],
    confirmation: null,
    ...patch,
  }
}

describe("file and prepared provider boundary", () => {
  const provider = () => ({
    provider: "COROS", sourceId: "synthetic-provider", sourceVersion: null, sport: "RUNNING",
    startedAt: "2026-09-18T23:30:00Z", timeZone: "Asia/Seoul", distanceMeters: 5000.125,
    durationSeconds: 1500.75, durationMeaning: "TIMER",
    laps: [{ distanceMeters: 5000.125, durationSeconds: 1500.75, durationMeaning: "TIMER" }],
  })

  it.each(["ELAPSED", "TIMER", "MOVING", "UNKNOWN"])("preserves provider %s without accepting eligibility annotations", meaning => {
    const source = provider()
    expect(prepareDeviceActivity({ ...source, durationMeaning: meaning, analysisEligible: true,
      laps: [{ ...source.laps[0], durationMeaning: meaning }], confirmation: { sport: "RUNNING", durationMeaning: "TIMER" },
    })).toEqual({ ...source, durationMeaning: meaning, laps: [{ ...source.laps[0], durationMeaning: meaning }],
      schemaVersion: "PREPARED_DEVICE_ACTIVITY_V1", analysisEligible: false })
  })

  it("accepts SOURCE_DEFINED only for files, never for provider activities or laps", () => {
    expect(buildFileObservation(input()).durationMeaning).toBe("SOURCE_DEFINED")
    const source = provider()
    expect(prepareDeviceActivity({ ...source, durationMeaning: "SOURCE_DEFINED" })).toBeNull()
    expect(prepareDeviceActivity({ ...source, laps: [{ ...source.laps[0], durationMeaning: "SOURCE_DEFINED" }] })).toBeNull()
  })

  it("keeps file-only nullable timestamps separate from the required provider time contract", () => {
    expect(buildFileObservation(input({ startedAt: null, timeZone: null }))).toMatchObject({ startedAt: null, timeZone: null })
    expect(prepareDeviceActivity({ ...provider(), startedAt: null })).toBeNull()
    expect(prepareDeviceActivity({ ...provider(), timeZone: null })).toBeNull()
  })
})

describe("file observation contract", () => {
  it("builds and round-trips an exact, allowlisted synchronous observation", () => {
    const value = buildFileObservation(input())
    expect(value).not.toBeInstanceOf(Promise)
    expect(value).toMatchObject({ schemaVersion: 1, source: "FILE_UPLOAD", distanceMeters: 5000.125, durationSeconds: 1500.75, confirmation: null })
    expect(value.sourceIdentityFingerprint).toBe(value.contentRevisionFingerprint)
    expect(value.completeness).toEqual({ missingDistanceLaps: 0, missingDurationLaps: 0 })
    expect(parseFileObservation(JSON.parse(JSON.stringify(value)))).toEqual(value)
    expect(fileObservationSchema.safeParse(value).success).toBe(true)
  })

  it("pins the v1 canonical projections using the existing synchronous SHA256 helper", () => {
    const value = buildFileObservation(input())
    expect(value.contentRevisionFingerprint).toBe(canonicalJsonFingerprint("trainoracle.file-observation.content.v1", {
      schemaVersion: 1, date: value.date, startedAt: value.startedAt, timeZone: value.timeZone,
      sport: value.sport, distanceMeters: value.distanceMeters, durationSeconds: value.durationSeconds,
      durationMeaning: value.durationMeaning, laps: value.laps, completeness: value.completeness,
    }))
    expect(value.sourceObservationKey).toBe(canonicalJsonFingerprint("trainoracle.file-observation.source.v1", {
      source: "FILE_UPLOAD", sourceProfile: "TCX_ACTIVITY_V1", sourceActivityId: value.sourceActivityId,
    }))
  })

  it("keeps content independent of parser version, identity, profile and confirmation", () => {
    const original = buildFileObservation(input())
    for (const patch of [
      { parserVersion: "tcx-observation-2" },
      { sourceActivityId: "other-structured-id" },
      { format: "csv", sourceProfile: "CSV_COLUMNS_V1" } as const,
      { confirmation: { durationMeaning: "TIMER", sport: "RUNNING" } } as const,
    ]) expect(buildFileObservation(input(patch)).contentRevisionFingerprint).toBe(original.contentRevisionFingerprint)
    expect(buildFileObservation(input({ parserVersion: "tcx-observation-2" })).sourceObservationKey).toBe(original.sourceObservationKey)
    expect(buildFileObservation(input({ sourceActivityId: "other-structured-id" })).sourceObservationKey).not.toBe(original.sourceObservationKey)
  })

  it("keeps no-ID correction identity stable while separately revising content", () => {
    const original = buildFileObservation(input({ sourceActivityId: null }))
    const corrected = buildFileObservation(input({
      sourceActivityId: null, sourceIdentityFingerprint: original.sourceIdentityFingerprint,
      sport: "WALKING", parserVersion: "tcx-observation-2",
    }))
    expect(corrected.sourceIdentityFingerprint).toBe(original.sourceIdentityFingerprint)
    expect(corrected.sourceObservationKey).toBe(original.sourceObservationKey)
    expect(corrected.contentRevisionFingerprint).not.toBe(original.contentRevisionFingerprint)
    expect(parseFileObservation(corrected)).toEqual(corrected)
    expect(original.sourceObservationKey).toBe(canonicalJsonFingerprint("trainoracle.file-observation.source.v1", {
      source: "FILE_UPLOAD", sourceProfile: "TCX_ACTIVITY_V1", sourceIdentityFingerprint: original.contentRevisionFingerprint,
    }))
    const newCandidate = buildFileObservation(input({ sourceActivityId: null, sport: "WALKING" }))
    expect(newCandidate.sourceObservationKey).not.toBe(original.sourceObservationKey)
    expect(buildFileObservation(input({ sourceActivityId: null, parserVersion: "tcx-observation-2" })).sourceObservationKey).toBe(original.sourceObservationKey)
  })

  it("distinguishes initial timezone review from a stored observation correction", () => {
    const original = buildFileObservation(input({ sourceActivityId: null }))
    const reviewedInput = input({ sourceActivityId: null, date: "2026-09-18", timeZone: "UTC" })
    const beforeFirstSave = buildFileObservation(reviewedInput)
    expect(beforeFirstSave.sourceIdentityFingerprint).toBe(beforeFirstSave.contentRevisionFingerprint)
    const correction = buildFileObservation({ ...reviewedInput, sourceIdentityFingerprint: original.sourceIdentityFingerprint })
    expect(correction.sourceObservationKey).toBe(original.sourceObservationKey)
    expect(correction.contentRevisionFingerprint).toBe(beforeFirstSave.contentRevisionFingerprint)
    expect(parseFileObservation(correction)).not.toBeNull()
  })

  it("requires content changes and lap order changes to change content fingerprints", () => {
    const original = buildFileObservation(input())
    const reversed = input().laps.reverse().map((lap, sourceIndex) => ({ ...lap, sourceIndex }))
    const changed = buildFileObservation(input({ laps: reversed }))
    expect(changed.contentRevisionFingerprint).not.toBe(original.contentRevisionFingerprint)
    expect(changed.sourceObservationKey).toBe(original.sourceObservationKey)
  })

  it("uses numeric values and sorted object keys rather than lexical number formatting", () => {
    const original = input({ format: "json", sourceProfile: "JSON_COLUMNS_V1", distanceMeters: 5 })
    const equivalent = JSON.parse(JSON.stringify(original).replace('"distanceMeters":5,', '"distanceMeters":5.00,'))
    const reversedKeys = Object.fromEntries(Object.entries(equivalent).reverse()) as FileObservationInput
    expect(buildFileObservation(reversedKeys)).toEqual(buildFileObservation(original))
  })

  it.each(["sourceObservationKey", "contentRevisionFingerprint", "sourceIdentityFingerprint"] as const)("rejects tampering with %s", field => {
    const value = buildFileObservation(input({ sourceActivityId: null }))
    expect(parseFileObservation({ ...value, [field]: `sha256:${"0".repeat(64)}` })).toBeNull()
  })

  it.each(["name", "Notes", "filename", "gps", "raw", "analysisEligible", "sourceIndex"])("rejects extra %s instead of stripping it", field => {
    const value = buildFileObservation(input())
    expect(parseFileObservation({ ...value, [field]: "private-sentinel" })).toBeNull()
    expect(parseFileObservation({ ...value, laps: [{ ...value.laps[0], [field]: "private-sentinel" }, value.laps[1]] })).toBeNull()
  })

  it("rejects extra nested confirmation and completeness fields", () => {
    const value = buildFileObservation(input())
    expect(parseFileObservation({ ...value, confirmation: { sport: "RUNNING", durationMeaning: null, Notes: "private-sentinel" } })).toBeNull()
    expect(parseFileObservation({ ...value, completeness: { ...value.completeness, filename: "private-sentinel" } })).toBeNull()
  })

  it.each([
    { distanceMeters: -1 }, { distanceMeters: NaN }, { durationSeconds: Infinity },
    { date: "2026-02-30" }, { date: "2026-09-18" }, { startedAt: "2026-09-19T08:30:00" },
    { startedAt: "2026-09-19" }, { timeZone: "invalid/private-sentinel" },
    { sourceProfile: "JSON_COLUMNS_V1" }, { schemaVersion: 2 }, { source: "GARMIN" },
    { sourceActivityId: "arbitrary free-form notes" },
  ])("rejects invalid or inconsistent fields without throwing: %j", patch => {
    expect(parseFileObservation({ ...buildFileObservation(input()), ...patch })).toBeNull()
  })

  it("requires bounded contiguous laps, completeness and all-lap totals", () => {
    const value = input()
    expect(() => buildFileObservation({ ...value, distanceMeters: 4000 })).toThrow("INVALID_FILE_OBSERVATION")
    expect(() => buildFileObservation({ ...value, laps: value.laps.map(lap => ({ ...lap, sourceIndex: 5 })) })).toThrow("INVALID_FILE_OBSERVATION")
    expect(() => buildFileObservation({ ...value, laps: Array.from({ length: 1001 }, (_, sourceIndex) => ({ ...value.laps[0]!, sourceIndex })) })).toThrow("INVALID_FILE_OBSERVATION")
    const missing = buildFileObservation(input({
      distanceMeters: null,
      laps: value.laps.map((lap, index) => ({ ...lap, distanceMeters: index === 0 ? null : lap.distanceMeters })),
    }))
    expect(missing.completeness).toEqual({ missingDistanceLaps: 1, missingDurationLaps: 0 })
    expect(parseFileObservation({ ...missing, completeness: { missingDistanceLaps: 0, missingDurationLaps: 0 } })).toBeNull()
  })

  it("preserves local date without manufacturing a midnight instant", () => {
    const value = buildFileObservation(input({ startedAt: null, timeZone: null }))
    expect(parseFileObservation(value)).toMatchObject({ date: "2026-09-19", startedAt: null, timeZone: null })
  })
})

describe("file observation compatibility summary", () => {
  it("keeps exact number strings and withholds an unconfirmed source-defined pace", () => {
    const value = buildFileObservation(input())
    expect(toFileObservationSummary(value)).toEqual({ distanceKm: "5.000125", durationMin: "25.0125", avgPace: "" })
    expect(toFileObservationSummary({ ...value, durationMeaning: "UNKNOWN" }).avgPace).toBe("")
  })

  it.each(["TIMER", "MOVING", "ELAPSED"] as const)("only uses explicit %s semantics or separate confirmation for pace", durationMeaning => {
    const value = buildFileObservation(input({ confirmation: { durationMeaning, sport: null } }))
    expect(toFileObservationSummary(value).avgPace).toBe("5:00")
    expect(value.durationMeaning).toBe("SOURCE_DEFINED")
    expect(toFileObservationSummary(buildFileObservation(input({ durationMeaning }))).avgPace).toBe("5:00")
    expect(toFileObservationSummary(buildFileObservation(input({ confirmation: { durationMeaning: null, sport: "RUNNING" } }))).avgPace).toBe("")
  })

  it("leaves null totals blank, preserves true zero and never divides by zero", () => {
    const value = buildFileObservation(input({ format: "csv", sourceProfile: "CSV_COLUMNS_V1", distanceMeters: null, durationSeconds: null }))
    expect(toFileObservationSummary(value)).toEqual({ distanceKm: "", durationMin: "", avgPace: "" })
    expect(toFileObservationSummary({ ...value, distanceMeters: 0, durationSeconds: 0, durationMeaning: "ELAPSED" })).toEqual({ distanceKm: "0", durationMin: "0", avgPace: "" })
  })

  it("supports independently nullable confirmed metadata and rejects invented purposes", () => {
    for (const sport of ["RUNNING", "WALKING", "CYCLING", "OTHER", "UNKNOWN", null] as const) {
      expect(parseFileObservation(buildFileObservation(input({ confirmation: { sport, durationMeaning: null } })))).not.toBeNull()
    }
    expect(parseFileObservation({ ...buildFileObservation(input()), sport: "BASE" })).toBeNull()
  })
})
