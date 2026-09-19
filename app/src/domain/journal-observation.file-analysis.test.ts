import { afterEach, describe, expect, it, vi } from "vitest"
import { buildFileObservation } from "./import/file-observation"
import { buildFileAnalysisReport } from "./import/file-analysis"
import { acceptsExplicitField, acceptsFileDistance } from "./analysis-field-eligibility"
import { buildCumulativeDistanceDashboard, cumulativeDistance } from "./cumulative-distance"
import { projectStructuredJournalObservation, projectStructuredJournalObservations, selectStructuredJournalInput } from "./journal-observation"
import type { PostSessionEntry } from "./journal-schema"
import { eligibleMetricValue } from "./trend-analysis"
import { buildEnergySystemLedger } from "./energy-system-ledger"
import { markCurrentConfirmedAccountJournalProjection, putAccountJournalProjection, readAccountJournalProjection,
  resetAccountJournalProjection, setAccountJournalProjectionStatus } from "./account/account-journal-projection"
import { setActiveLocalAccount } from "./account/local-journal-ownership"
import { analysisExclusionSummary } from "./journal-store"

const date = "2026-09-19"
const formats = ["tcx"] as const
const window = { startDate: "2026-09-01", endDate: date, kind: "MONTH_TO_DATE", precision: "LOCAL_DATE" } as const
function session(overrides: Partial<PostSessionEntry> = {}, meters: number | null = 5049.49): PostSessionEntry {
  return {
    id: "journal-1", kind: "post-session", date, savedAt: `${date}T10:00:00Z`, syncState: "synced",
    system: "base", title: "", memo: "", distanceKm: "99.99", durationMin: "99.99", avgPace: "1:00", rpe: 6,
    fieldProvenance: {
      system: { provenance: "EXPLICIT" }, rpe: { provenance: "EXPLICIT" },
      distanceKm: { provenance: "DERIVED", derivedFrom: ["import:activity-file"], derivationRuleId: "IMPORT_ACTIVITY_FILE_V1" },
      durationMin: { provenance: "DERIVED", derivedFrom: ["import:activity-file"], derivationRuleId: "IMPORT_ACTIVITY_FILE_V1" },
      avgPace: { provenance: "DERIVED", derivedFrom: ["import:activity-file"], derivationRuleId: "IMPORT_ACTIVITY_FILE_V1" },
    },
    fileObservation: buildFileObservation({
      format: "tcx", sourceProfile: "TCX_ACTIVITY_V1", parserVersion: "v1", sourceActivityId: "source-1",
      date, startedAt: null, timeZone: null, sport: "RUNNING", distanceMeters: meters, durationSeconds: 1515.75,
      durationMeaning: "TIMER", confirmation: { sport: null, durationMeaning: null },
      laps: [{ sourceIndex: 0, distanceMeters: meters, durationSeconds: 1515.75, durationMeaning: "TIMER", kind: "UNKNOWN" }],
    }), ...overrides,
  }
}
function project(entries: readonly PostSessionEntry[]) {
  return projectStructuredJournalObservations(entries, { formats, confirmedFileEntries: entries.filter(entry => entry.syncState === "synced") })
}

afterEach(() => { setActiveLocalAccount(null); resetAccountJournalProjection(null); vi.unstubAllEnvs() })

describe("file distance in the shared journal projection", () => {
  it("uses exact FILE distance and keeps explicit purpose/RPE without admitting imported duration or pace", () => {
    const projected = project([session()])
    const value = projected[0]!
    expect(value).toMatchObject({ distanceKm: 5.04949, fieldProvenance: { distanceKm: "FILE", rpe: "EXPLICIT" }, acceptedFileFields: ["distanceKm"] })
    expect(value.acceptedExplicitFields).toEqual(["system", "rpe"])
    expect(acceptsFileDistance(value)).toBe(true)
    expect(acceptsExplicitField(value, "distanceKm")).toBe(false)
    expect(acceptsExplicitField(value, "durationMin")).toBe(false)
    expect(acceptsExplicitField(value, "system")).toBe(true)
    expect(eligibleMetricValue(value, "RPE")).toBe(6)
    expect(eligibleMetricValue(value, "SECONDS_PER_KM")).toBeNull()
    const ledger = buildEnergySystemLedger(projected, { ...window, period: "RECENT_4_WEEKS" })
    expect(ledger.rows.find(row => row.key === "BASE")).toMatchObject({ journalSessionCount: 1, meanRpe: 6, durationMinutes: null, durationSampleCount: 0 })
  })

  it("preserves independently explicit distance and duration in a mixed-source record", () => {
    const original = session()
    const value = project([session({ distanceKm: "8", durationMin: "40", fieldProvenance: {
      ...original.fieldProvenance, distanceKm: { provenance: "EXPLICIT" }, durationMin: { provenance: "EXPLICIT" },
    } })])[0]!
    expect(value.distanceKm).toBe(8)
    expect(acceptsExplicitField(value, "distanceKm")).toBe(true)
    expect(acceptsExplicitField(value, "durationMin")).toBe(true)
    expect(acceptsFileDistance(value)).toBe(false)
    expect(cumulativeDistance([value], window).totalKm).toBe(8)
  })

  it("does not revoke an already eligible explicit pace or its direct-input derivation", () => {
    for (const avgPace of ["5:00", ""]) {
      const value = project([session({ distanceKm: "8", durationMin: "40", avgPace, fieldProvenance: {
        distanceKm: { provenance: "EXPLICIT" }, durationMin: { provenance: "EXPLICIT" },
        avgPace: { provenance: avgPace === "" ? "MISSING" : "EXPLICIT" },
      } })])[0]!
      expect(eligibleMetricValue(value, "SECONDS_PER_KM")).toBe(300)
    }
  })

  it("keeps local/pending and disabled files out but preserves direct-purpose signals", () => {
    const pending = project([session({ syncState: "local" })])[0]!
    const disabled = projectStructuredJournalObservations([session()], { formats: [] })[0]!
    for (const value of [pending, disabled]) {
      expect(acceptsFileDistance(value)).toBe(false)
      expect(cumulativeDistance([value], window).totalKm).toBeNull()
      expect(acceptsExplicitField(value, "system")).toBe(true)
      expect(eligibleMetricValue(value, "RPE")).toBe(6)
    }
    // Report acknowledgement comes from the caller's confirmed list, not syncState alone.
    expect(buildFileAnalysisReport([session({ syncState: "local" })], { ...window, formats, sourceContext: "ACCOUNT_CONFIRMED" }).includedSourceCount).toBe(1)
  })

  it("retains purpose-only and memo-only behavior and projects file-only zero measurements", () => {
    const purpose = session({ fileObservation: undefined, distanceKm: "", durationMin: "", avgPace: "", rpe: 0,
      fieldProvenance: { system: { provenance: "EXPLICIT" } } })
    expect(selectStructuredJournalInput(purpose)).not.toBeNull()
    expect(project([purpose])[0]).toMatchObject({ distanceKm: null, durationMin: null, rpe: null })
    expect(selectStructuredJournalInput({ ...purpose, system: "", fieldProvenance: {} })).toBeNull()
    const zero = session({ system: "", distanceKm: "", durationMin: "", avgPace: "", rpe: 0, fieldProvenance: {} }, 0)
    expect(project([zero])[0]?.distanceKm).toBe(0)
    expect(cumulativeDistance(project([zero]), window)).toMatchObject({ totalKm: 0, includedSourceCount: 1, coverage: "DATA" })
    expect(project([{ ...zero, syncState: "local" }])).toEqual([])
  })

  it("does not trust injected or restored capability metadata, changed numbers, dates or source IDs", () => {
    const value = project([session()])[0]!
    const forged = JSON.parse(JSON.stringify(value)) as typeof value
    for (const candidate of [forged, { ...value, distanceKm: 900 }, { ...value, loggedOn: "2026-09-18" },
      { ...value, sourceRef: { ...value.sourceRef, sourceId: "other" } },
      { ...value, sourceRef: { ...value.sourceRef, trustState: "CONFLICTING" as const } },
      { ...value, acceptedFileObservation: undefined },
    ]) {
      expect(acceptsFileDistance(candidate)).toBe(false)
      expect(cumulativeDistance([candidate], window).totalKm).toBeNull()
    }
    const input = selectStructuredJournalInput(session(), { formats, confirmedFileEntries: [session()] })!
    if (input.sourceKind !== "SESSION_RESULT_RECORD") throw new Error("wrong test input")
    const injected = projectStructuredJournalObservation({ ...input, acceptedFileObservation: forged.acceptedFileObservation })
    expect(injected.acceptedFileFields).toBeUndefined()
    expect(cumulativeDistance([injected], window).totalKm).toBeNull()
  })

  it("keeps raw memo/title changes zero-signal in both shared and file reports", () => {
    const original = session()
    const guarded = { ...original, get memo(): string { throw new Error("memo read") }, get title(): string { throw new Error("title read") } }
    expect(project([guarded])).toEqual(project([original]))
    expect(JSON.stringify(project([original]))).not.toContain('"memo"')
  })

  it("rejects a malicious synced local payload without a matching current-account acknowledgement", () => {
    const local = session({ syncState: "synced" })
    const projectDefault = () => projectStructuredJournalObservations([local], { formats })[0]!
    expect(acceptsFileDistance(projectDefault())).toBe(false)
    const owner = "synthetic-owner-A"
    setActiveLocalAccount(owner)
    resetAccountJournalProjection(owner)
    expect(putAccountJournalProjection(owner, local, false)).toBe(true)
    expect(acceptsFileDistance(projectDefault())).toBe(false)
    expect(putAccountJournalProjection(owner, local, true)).toBe(true)
    expect(acceptsFileDistance(projectDefault())).toBe(false)
    expect(markCurrentConfirmedAccountJournalProjection(owner, local, 1)).toBe(true)
    expect(acceptsFileDistance(projectDefault())).toBe(true)
    setActiveLocalAccount("synthetic-owner-B")
    expect(acceptsFileDistance(projectDefault())).toBe(false)
  })

  it("preserves an acknowledged cache after failed hydration without adopting it as current file evidence", () => {
    const owner = "synthetic-owner-A", cached = session()
    setActiveLocalAccount(owner); resetAccountJournalProjection(owner)
    putAccountJournalProjection(owner, cached, true)
    markCurrentConfirmedAccountJournalProjection(owner, cached, 4)
    const current = () => projectStructuredJournalObservations([cached], { formats })[0]!
    expect(acceptsFileDistance(current())).toBe(true)
    setAccountJournalProjectionStatus(owner, "LOADING")
    setAccountJournalProjectionStatus(owner, "FAILED")
    expect(readAccountJournalProjection()).toHaveLength(1)
    expect(acceptsFileDistance(current())).toBe(false)
    expect(cumulativeDistance([current()], window).totalKm).toBeNull()
    markCurrentConfirmedAccountJournalProjection(owner, cached, 4)
    expect(acceptsFileDistance(current())).toBe(true)
  })

  it("does not count a retained offline file cache as included analysis", () => {
    vi.stubEnv("VITE_FEATURE_FILE_ANALYSIS_TCX", "true")
    vi.stubEnv("VITE_KILL_FILE_ANALYSIS_TCX", "false")
    const owner = "synthetic-owner-A"
    const cached = session({ system: "", rpe: 0, fieldProvenance: {
      distanceKm: { provenance: "DERIVED", derivedFrom: ["import:activity-file"], derivationRuleId: "IMPORT_ACTIVITY_FILE_V1" },
    } })
    setActiveLocalAccount(owner); resetAccountJournalProjection(owner)
    putAccountJournalProjection(owner, cached, true)
    markCurrentConfirmedAccountJournalProjection(owner, cached, 4)
    expect(analysisExclusionSummary()).toMatchObject({ total: 1, included: 1, excludedImported: 0 })
    setAccountJournalProjectionStatus(owner, "FAILED")
    expect(analysisExclusionSummary()).toMatchObject({ total: 1, included: 0, excludedImported: 1 })
  })

  it("matches the whole validated file observation, not just id/date or content fingerprint", () => {
    const confirmed = session()
    const variants = [
      session({}, 6000),
      session({ id: "wrong-id" }),
      session({ date: "2026-09-18" }),
      session({ fileObservation: { ...confirmed.fileObservation!, parserVersion: "v2" } }),
      session({ fileObservation: { ...confirmed.fileObservation!, confirmation: { sport: "WALKING", durationMeaning: null } } }),
    ]
    for (const candidate of variants) {
      const value = projectStructuredJournalObservations([candidate], { formats, confirmedFileEntries: [confirmed] })[0]!
      expect(acceptsFileDistance(value)).toBe(false)
      expect(cumulativeDistance([value], window).totalKm).toBeNull()
    }
    const detached = JSON.parse(JSON.stringify(confirmed)) as PostSessionEntry
    expect(acceptsFileDistance(projectStructuredJournalObservations([detached], { formats, confirmedFileEntries: [confirmed] })[0]!)).toBe(true)
    const invalid = { ...confirmed, fileObservation: { ...confirmed.fileObservation!, analysisEligible: true } } as PostSessionEntry
    expect(acceptsFileDistance(projectStructuredJournalObservations([invalid], { formats, confirmedFileEntries: [invalid] })[0]!)).toBe(false)
  })
})

describe("shared Home/Analysis file cumulative distance", () => {
  it("sums precise values before display, with one common dashboard output", () => {
    const other = session({ id: "journal-2" })
    const file = other.fileObservation!
    const second = { ...other, fileObservation: buildFileObservation({
      format: file.format, sourceProfile: file.sourceProfile, parserVersion: file.parserVersion, sourceActivityId: "source-2",
      date: file.date, startedAt: file.startedAt, timeZone: file.timeZone, sport: file.sport,
      distanceMeters: file.distanceMeters, durationSeconds: file.durationSeconds, durationMeaning: file.durationMeaning,
      confirmation: file.confirmation, laps: file.laps,
    }) }
    const observations = project([session(), second])
    const dashboard = buildCumulativeDistanceDashboard({ observations, asOfDate: date })
    expect(dashboard.toDate.month.totalKm).toBe(10.1)
    expect(dashboard.toDate.week.totalKm).toBe(10.1)
    expect(dashboard.days.at(-1)?.totalKm).toBe(10.1)
    expect(dashboard.toDate.month).toEqual(cumulativeDistance(observations, window))
    expect(dashboard.toDate.month.reasonCodes).toContain("CONFIRMED_FILE_DISTANCE")
  })

  it("deduplicates different journal IDs by source key and rejects conflicting contents in any order", () => {
    const duplicate = project([session(), session({ id: "journal-copy" })])
    const summary = cumulativeDistance(duplicate, window)
    expect(summary).toMatchObject({ totalKm: 5, includedSourceCount: 1, duplicateSourceCount: 1 })
    expect(summary).toEqual(cumulativeDistance([...duplicate].reverse(), window))
    const conflict = project([session(), session({ id: "journal-changed" }, 6000)])
    expect(cumulativeDistance(conflict, window)).toMatchObject({ totalKm: null, includedSourceCount: 0, conflictingSourceCount: 1 })
    expect(cumulativeDistance(conflict, window)).toEqual(cumulativeDistance([...conflict].reverse(), window))
  })

  it("does not hide a missing revision or conflicting sport interpretation behind an eligible distance", () => {
    const missing = project([session(), session({ id: "journal-missing" }, null)])
    expect(cumulativeDistance(missing, window)).toMatchObject({ totalKm: null, conflictingSourceCount: 1 })
    const original = session()
    const walking = { ...original, id: "walking-copy", fileObservation: {
      ...original.fileObservation!, confirmation: { durationMeaning: null, sport: "WALKING" as const },
    } }
    expect(cumulativeDistance(project([original, walking]), window)).toMatchObject({ totalKm: null, conflictingSourceCount: 1 })
  })

  it("cannot double count one source key by mixing a direct-distance copy with a FILE-distance copy", () => {
    const original = session()
    const directCopy = session({ id: "direct-copy", distanceKm: "8", fieldProvenance: {
      ...original.fieldProvenance, distanceKm: { provenance: "EXPLICIT" },
    } })
    const values = project([original, directCopy])
    expect(cumulativeDistance(values, window)).toMatchObject({ totalKm: null, conflictingSourceCount: 1 })
    expect(cumulativeDistance(values, window)).toEqual(cumulativeDistance([...values].reverse(), window))
  })

  it.each(["WALKING", "CYCLING", "OTHER", "UNKNOWN"] as const)("excludes %s file distance from running without discarding explicit purpose", sport => {
    const original = session()
    const value = project([{ ...original, fileObservation: { ...original.fileObservation!, confirmation: { sport, durationMeaning: null } } }])[0]!
    expect(acceptsFileDistance(value)).toBe(false)
    expect(cumulativeDistance([value], window)).toMatchObject({ totalKm: null, excludedSourceCount: 1 })
    expect(acceptsExplicitField(value, "system")).toBe(true)
  })

  it("continues excluding legacy and unadopted provider data", () => {
    const legacy = project([session({ fileObservation: undefined })])[0]!
    const provider = project([session({ fileObservation: undefined, fieldProvenance: {
      distanceKm: { provenance: "DERIVED", derivedFrom: ["provider:coros"], derivationRuleId: "PROVIDER" },
    } })])[0]!
    expect(cumulativeDistance([legacy, provider], window).totalKm).toBeNull()
  })
})
