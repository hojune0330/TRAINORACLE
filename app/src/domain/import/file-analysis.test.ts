import { afterEach, describe, expect, it, vi } from "vitest"
import { buildFileObservation, type FileObservationInput } from "./file-observation"
import { fileAnalysisFormats } from "./file-analysis-policy"
import {
  buildFileAnalysisReport, isProjectedFileObservation, projectFileObservation,
  type FileAnalysisEntry, type FileAnalysisOptions,
} from "./file-analysis"

const date = "2026-09-19"
const options = { formats: ["tcx"], sourceContext: "ACCOUNT_CONFIRMED", startDate: "2026-09-01", endDate: date } as const
function observation(overrides: Partial<FileObservationInput> = {}) {
  const input: FileObservationInput = {
    format: "tcx", sourceProfile: "TCX_ACTIVITY_V1", parserVersion: "v1", sourceActivityId: "activity-1",
    date, startedAt: null, timeZone: null, sport: "RUNNING", distanceMeters: 1000, durationSeconds: 300,
    durationMeaning: "TIMER", confirmation: { sport: null, durationMeaning: null }, laps: [], ...overrides,
  }
  if (input.format === "tcx" && overrides.laps === undefined) input.laps = [{
    sourceIndex: 0, distanceMeters: input.distanceMeters, durationSeconds: input.durationSeconds,
    durationMeaning: input.durationMeaning, kind: "UNKNOWN",
  }]
  return buildFileObservation(input)
}
function entry(overrides: Partial<FileObservationInput> = {}, id = "journal-1"): FileAnalysisEntry {
  return { id, kind: "post-session", date: overrides.date ?? date, fileObservation: observation(overrides) }
}
function report(entries: readonly FileAnalysisEntry[], policy: FileAnalysisOptions = options) {
  return buildFileAnalysisReport(entries, { startDate: options.startDate, endDate: date, ...policy })
}

afterEach(() => vi.unstubAllEnvs())

describe("file observation adoption projection", () => {
  it("is default-off, honors the shared kill policy, and requires caller account acknowledgement", () => {
    for (const format of ["TCX", "CSV", "JSON", "GPX"]) {
      vi.stubEnv(`VITE_FEATURE_FILE_ANALYSIS_${format}`, "false")
      vi.stubEnv(`VITE_KILL_FILE_ANALYSIS_${format}`, "false")
    }
    expect(projectFileObservation(entry(), { sourceContext: "ACCOUNT_CONFIRMED" })).toEqual({ status: "EXCLUDED", reasonCode: "FORMAT_DISABLED" })
    vi.stubEnv("VITE_FEATURE_FILE_ANALYSIS_TCX", "true")
    expect(fileAnalysisFormats()).toEqual(["tcx"])
    expect(projectFileObservation(entry(), { sourceContext: "ACCOUNT_CONFIRMED" }).status).toBe("ACCEPTED")
    vi.stubEnv("VITE_KILL_FILE_ANALYSIS_TCX", "true")
    expect(projectFileObservation(entry(), { sourceContext: "ACCOUNT_CONFIRMED" }).status).toBe("EXCLUDED")
    expect(projectFileObservation(entry(), { formats: ["tcx"] })).toEqual({ status: "EXCLUDED", reasonCode: "ACCOUNT_CONFIRMATION_REQUIRED" })
    expect(report([entry()], { formats: ["tcx"], sourceContext: "DEVICE_PREVIEW" }).coverage).toBe("ALL_EXCLUDED")
  })

  it.each([
    ["csv", "CSV_COLUMNS_V1"], ["json", "JSON_COLUMNS_V1"], ["gpx", "GPX_TRACK_V1"],
  ] as const)("keeps %s activation independent from TCX", (format, sourceProfile) => {
    const value = entry({ format, sourceProfile })
    expect(projectFileObservation(value, options)).toEqual({ status: "EXCLUDED", reasonCode: "FORMAT_DISABLED" })
    expect(projectFileObservation(value, { ...options, formats: [format] }).status).toBe("ACCEPTED")
  })

  it("validates date, strict metadata, content fingerprint and source key before adoption", () => {
    const original = observation()
    for (const fileObservation of [
      { ...original, distanceMeters: 9999 },
      { ...original, sourceObservationKey: `sha256:${"0".repeat(64)}` },
      { ...original, contentRevisionFingerprint: `sha256:${"0".repeat(64)}` },
      { ...original, source: "COROS" },
      { ...original, analysisEligible: true },
      { ...original, acceptedFileFields: ["distanceKm"] },
      { ...original, confirmation: { ...original.confirmation, mayCreatePlan: true } },
      { ...original, filename: "PRIVATE_FILE_MARKER" },
    ]) {
      expect(projectFileObservation({ ...entry(), fileObservation }, options)).toEqual({ status: "EXCLUDED", reasonCode: "INVALID_FILE_OBSERVATION" })
    }
    expect(projectFileObservation({ ...entry(), date: "2026-09-18" }, options)).toEqual({ status: "EXCLUDED", reasonCode: "DATE_MISMATCH" })
    expect(projectFileObservation(entry({ confirmation: null }), options)).toEqual({ status: "EXCLUDED", reasonCode: "CONFIRMATION_REQUIRED" })
  })

  it("supports a no-ID correction with immutable source identity and changed content", () => {
    const original = observation({ sourceActivityId: null })
    const corrected = observation({ sourceActivityId: null, sourceIdentityFingerprint: original.sourceIdentityFingerprint, distanceMeters: 2000 })
    expect(corrected.sourceObservationKey).toBe(original.sourceObservationKey)
    expect(corrected.contentRevisionFingerprint).not.toBe(original.contentRevisionFingerprint)
    expect(projectFileObservation({ ...entry(), fileObservation: corrected }, options).status).toBe("ACCEPTED")
  })

  it("produces frozen privacy-safe references and never treats a restored attestation as authority", () => {
    const original = observation()
    const projection = projectFileObservation({ ...entry(), fileObservation: original }, options)
    expect(projection.status).toBe("ACCEPTED")
    if (projection.status !== "ACCEPTED") throw new Error("missing positive control")
    expect(isProjectedFileObservation(projection.observation)).toBe(true)
    expect(isProjectedFileObservation(JSON.parse(JSON.stringify(projection.observation)))).toBe(false)
    expect(Object.isFrozen(projection.observation)).toBe(true)
    expect(Object.isFrozen(projection.observation.laps[0])).toBe(true)
    original.distanceMeters = 9000
    expect(projection.observation.distanceMeters).toBe(1000)
    expect(Object.keys(projection.observation)).not.toEqual(expect.arrayContaining(["sourceActivityId", "memo", "name", "title", "filename", "gps", "parserVersion"]))
    const guarded = { ...entry(), get memo() { throw new Error("memo read") }, get title() { throw new Error("title read") }, get filename() { throw new Error("filename read") } }
    expect(report([guarded])).toEqual(report([entry()]))
  })
})

describe("descriptive file report", () => {
  it("uses paired aggregate pace rather than an average of activity paces", () => {
    const result = report([
      entry({ distanceMeters: 1000, durationSeconds: 300 }),
      entry({ sourceActivityId: "two", distanceMeters: 9000, durationSeconds: 4500 }, "journal-2"),
      entry({ sourceActivityId: "missing-distance", distanceMeters: null, durationSeconds: 600 }, "journal-3"),
      entry({ sourceActivityId: "missing-time", distanceMeters: 5000, durationSeconds: null }, "journal-4"),
    ])
    const running = result.sports[0]
    expect(running?.distanceMeters).toMatchObject({ value: 15000, sampleCount: 3, excludedCount: 1 })
    expect(running?.timeSummaries[0]).toMatchObject({
      durationMeaning: "TIMER", durationSeconds: { value: 5400, sampleCount: 3, excludedCount: 1 },
      paceSecondsPerKm: { value: 480, sampleCount: 2, excludedCount: 2 }, pairedDistanceMeters: 10000, pairedDurationSeconds: 4800,
    })
  })

  it("keeps all time meanings separate and unknown source time out of period totals and pace", () => {
    const result = report((["TIMER", "MOVING", "ELAPSED", "SOURCE_DEFINED", "UNKNOWN"] as const).map((durationMeaning, index) =>
      entry({ sourceActivityId: `source-${index}`, durationMeaning, durationSeconds: 300 + index }, `journal-${index}`)))
    expect(result.sports[0]?.timeSummaries).toHaveLength(5)
    for (const time of result.sports[0]?.timeSummaries ?? []) {
      if (time.referenceOnly) {
        expect(time.durationSeconds.value).toBeNull()
        expect(time.paceSecondsPerKm.value).toBeNull()
        expect(time.lapDurationSeconds.value).toBeNull()
        expect(time.reportedDurationSampleCount).toBe(1)
      } else {
        expect(time.durationSeconds.sampleCount).toBe(1)
        expect(time.paceSecondsPerKm.sampleCount).toBe(1)
        expect(time.paceSecondsPerKm.excludedCount).toBe(4)
      }
    }
  })

  it("keeps confirmation separate from source facts and does not reinterpret lap times", () => {
    const source = observation({ sport: "UNKNOWN", durationMeaning: "SOURCE_DEFINED" })
    const confirmed = { ...source, confirmation: { durationMeaning: "MOVING" as const, sport: "RUNNING" as const } }
    const result = report([{ ...entry(), fileObservation: confirmed }])
    expect(result.observations[0]).toMatchObject({ sport: "RUNNING", sourceSport: "UNKNOWN", durationMeaning: "MOVING", sourceDurationMeaning: "SOURCE_DEFINED", contentRevisionFingerprint: source.contentRevisionFingerprint })
    expect(result.sports[0]?.timeSummaries.find(time => time.durationMeaning === "MOVING")?.paceSecondsPerKm.value).toBe(300)
    expect(result.observations[0]?.laps[0]?.durationMeaning).toBe("SOURCE_DEFINED")
  })

  it("shows partial lap references without inventing complete activity time", () => {
    const result = report([entry({ durationMeaning: "SOURCE_DEFINED", durationSeconds: null, distanceMeters: 2000, laps: [
      { sourceIndex: 0, distanceMeters: 1000, durationSeconds: 300, durationMeaning: "SOURCE_DEFINED", kind: "UNKNOWN" },
      { sourceIndex: 1, distanceMeters: 1000, durationSeconds: null, durationMeaning: "SOURCE_DEFINED", kind: "UNKNOWN" },
    ] })])
    expect(result.observations[0]?.durationSeconds).toBeNull()
    expect(result.observations[0]?.lapDurationReferences).toEqual([{ durationMeaning: "SOURCE_DEFINED", partialSeconds: 300, sampleCount: 1, missingCount: 1 }])
    expect(result.sports[0]?.timeSummaries[0]).toMatchObject({ durationSeconds: { value: null }, missingDurationLapCount: 1, paceSecondsPerKm: { value: null } })
  })

  it("distinguishes zero from missing without dividing by zero", () => {
    const result = report([
      entry({ distanceMeters: 0, durationSeconds: 0 }),
      entry({ sourceActivityId: "missing", distanceMeters: null, durationSeconds: null }, "journal-2"),
    ])
    expect(result.sports[0]?.distanceMeters).toMatchObject({ value: 0, sampleCount: 1, excludedCount: 1 })
    expect(result.sports[0]?.timeSummaries[0]).toMatchObject({ durationSeconds: { value: 0, sampleCount: 1 }, paceSecondsPerKm: { value: null, sampleCount: 0, excludedCount: 2 } })
    expect(report([]).coverage).toBe("NO_DATA")
    expect(report([entry()], { ...options, formats: [] }).coverage).toBe("ALL_EXCLUDED")
  })

  it("keeps walking, cycling and unconfirmed sport out of running summaries", () => {
    const result = report((["RUNNING", "WALKING", "CYCLING", "UNKNOWN"] as const).map((sport, index) =>
      entry({ sourceActivityId: `sport-${index}`, sport }, `journal-${index}`)))
    expect(result.sports.map(value => [value.sport, value.distanceMeters.value])).toEqual([
      ["RUNNING", 1000], ["WALKING", 1000], ["CYCLING", 1000], ["UNKNOWN", 1000],
    ])
  })

  it("deduplicates exact source copies and excludes conflicting revisions independent of order", () => {
    const first = entry()
    const copy = { ...first, id: "another-journal-id" }
    const conflict = entry({ sourceActivityId: "conflict", distanceMeters: 2000 }, "conflict-a")
    const changed = entry({ sourceActivityId: "conflict", distanceMeters: 2500 }, "conflict-b")
    const forward = report([first, copy, conflict, changed])
    const reverse = report([changed, conflict, copy, first])
    expect(forward).toEqual(reverse)
    expect(forward).toMatchObject({ includedSourceCount: 1, excludedSourceCount: 1, conflictingSourceCount: 1, duplicateSourceCount: 1 })
    expect(forward.sports[0]?.distanceMeters.value).toBe(1000)
  })

  it("rejects confirmation disagreements even when the content digest is identical", () => {
    const first = entry({ durationMeaning: "SOURCE_DEFINED" })
    const second = entry({ durationMeaning: "SOURCE_DEFINED", confirmation: { durationMeaning: "MOVING", sport: null } }, "journal-2")
    expect(report([first, second])).toMatchObject({ includedSourceCount: 0, conflictingSourceCount: 1 })
    expect(report([first, second])).toEqual(report([second, first]))
  })

  it("does not select an eligible winner before checking a valid but unconfirmed conflicting revision", () => {
    const first = entry()
    const second = entry({ confirmation: null, distanceMeters: 2000 }, "journal-2")
    expect(report([first, second])).toMatchObject({ includedSourceCount: 0, excludedSourceCount: 1, conflictingSourceCount: 1 })
    expect(report([first, second])).toEqual(report([second, first]))
    expect(report([first, { ...first, id: "journal-copy" }], { ...options, formats: [] })).toMatchObject({ excludedSourceCount: 1, duplicateSourceCount: 1 })
  })

  it("rejects two observation keys on one journal ID and retains genuine separate same-day sessions", () => {
    const first = entry()
    const other = entry({ sourceActivityId: "different" })
    expect(report([first, other])).toMatchObject({ includedSourceCount: 0, conflictingSourceCount: 2 })
    expect(report([first, { ...other, id: "journal-2" }])).toMatchObject({ includedSourceCount: 2, conflictingSourceCount: 0 })
  })

  it("scopes conflicts and revisions to inclusive real date windows", () => {
    const old = entry({ date: "2026-08-31", distanceMeters: 9000 })
    const future = entry({ date: "2026-09-20", distanceMeters: 12000 })
    expect(report([old, entry(), future])).toMatchObject({ inputCount: 1, includedSourceCount: 1, conflictingSourceCount: 0 })
    expect(() => buildFileAnalysisReport([], { startDate: "2026-02-30", endDate: date })).toThrow("INVALID_FILE_ANALYSIS_WINDOW")
    expect(() => buildFileAnalysisReport([], { startDate: date, endDate: "2026-09-18" })).toThrow()
  })

  it("never rounds individual source values or emits infinity from finite input overflow", () => {
    const result = report([
      entry({ distanceMeters: 1004.49, durationSeconds: 300.125 }),
      entry({ sourceActivityId: "two", distanceMeters: 1004.49, durationSeconds: 300.125 }, "journal-2"),
    ])
    expect(result.sports[0]?.distanceMeters.value).toBe(2008.98)
    expect(result.sports[0]?.timeSummaries[0]?.pairedDurationSeconds).toBe(600.25)
    const overflow = report([
      entry({ distanceMeters: Number.MAX_VALUE, durationSeconds: Number.MAX_VALUE }),
      entry({ sourceActivityId: "two", distanceMeters: Number.MAX_VALUE, durationSeconds: Number.MAX_VALUE }, "journal-2"),
    ])
    expect(overflow.sports[0]?.distanceMeters.value).toBeNull()
    expect(overflow.sports[0]?.timeSummaries[0]?.paceSecondsPerKm.value).toBeNull()
    expect(overflow.sports[0]?.distanceMeters.reasonCodes).toContain("NON_FINITE_RESULT")
    expect(overflow.coverage).toBe("PARTIAL")
  })
})
