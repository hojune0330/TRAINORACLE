import { afterEach, describe, expect, it, vi } from "vitest"
import { buildOracleDemoScenario, buildOracleDemoTopicResult } from "./oracle-demo-scenario"
import { buildOracleReport, oracleReportPeriod } from "./oracle-report"
import { energyLedgerWindow } from "./energy-system-ledger"
import { parseJournalEntryForWrite, type JournalEntry, type PostSessionEntry } from "./journal-schema"
import { buildOraclePersonalResult } from "./oracle-personal-result"

function session(id: string, date: string, distance: string, rpe = 4): PostSessionEntry {
  return {
    id, kind: "post-session", date, savedAt: `${date}T09:00:00.000Z`, syncState: "local", system: "base", title: "", distanceKm: distance,
    durationMin: distance === "" ? "" : String(Number(distance) * 6), avgPace: "", rpe, memo: "",
    fieldProvenance: {
      system: { provenance: "EXPLICIT" }, distanceKm: { provenance: distance === "" ? "MISSING" : "EXPLICIT" },
      durationMin: { provenance: distance === "" ? "MISSING" : "EXPLICIT" }, avgPace: { provenance: "MISSING" }, rpe: { provenance: rpe === 0 ? "MISSING" : "EXPLICIT" },
    },
  }
}
const report = (entries: readonly JournalEntry[], today = "2026-09-30", months: 3 | 6 = 3) => buildOracleReport({ source: "my", entries, today, months })

afterEach(() => vi.restoreAllMocks())

describe("calendar Oracle report", () => {
  it.each([
    [3, "2026-01-01", "2025-11-01", true],
    [6, "2026-01-31", "2025-08-01", false],
    [3, "2024-02-29", "2023-12-01", false],
    [6, "2024-03-01", "2023-10-01", true],
    [3, "2026-09-30", "2026-07-01", false],
    [6, "2026-09-30", "2026-04-01", false],
  ] as const)("uses calendar months and leap/year boundaries: %i %s", (months, today, startDate, currentMonthPartial) => {
    expect(oracleReportPeriod(months, today)).toEqual({ months, startDate, endDate: today, currentMonthPartial })
    expect(energyLedgerWindow(months === 3 ? "CALENDAR_3_MONTHS" : "CALENDAR_6_MONTHS", today)).toMatchObject({ startDate, endDate: today })
  })

  it("rejects invalid dates and periods before projecting data", () => {
    expect(() => oracleReportPeriod(3, "2026-02-29")).toThrow(RangeError)
    expect(() => oracleReportPeriod(4 as 3, "2026-09-30")).toThrow(RangeError)
  })

  it("clips future and prior-period observations before every reducer", () => {
    const result = report([session("prior", "2026-06-30", "50"), session("in", "2026-07-01", "5"), session("future", "2026-09-16", "70")], "2026-09-15")
    expect(result.distance.totalKm).toBe(5)
    expect(result.evidence.map(item => item.id)).toEqual(["in"])
    expect(result.monthly[2]).toMatchObject({ endDate: "2026-09-15", partialMonth: true })
    expect(result.status).toBe("partial")
  })

  it("keeps monthly distance sums separate from per-session medians and sample counts", () => {
    const result = report([session("a", "2026-09-01", "2", 2), session("b", "2026-09-02", "8", 4), session("c", "2026-09-03", "20", 9)])
    const month = result.monthly[2]!
    expect(month.distance.totalKm).toBe(30)
    expect(month.metrics.DISTANCE_KM).toMatchObject({ kind: "DATA", median: 8, n: 3, unit: "KILOMETERS" })
    expect(month.metrics.RPE).toMatchObject({ kind: "DATA", median: 4, n: 3, unit: "RPE" })
    expect(result.distance.totalKm).toBe(30)
    expect(result.distance.sourceRefs).toHaveLength(3)
  })

  it("keeps missing distinct from zero and honest partial fields", () => {
    const empty = report([])
    expect(empty.status).toBe("missing")
    expect(empty.distance.totalKm).toBeNull()
    expect(empty.monthly.every(month => month.distance.totalKm === null && month.metrics.RPE.kind === "MISSING")).toBe(true)
    const result = report([session("rpe-only", "2026-09-01", "", 5)])
    expect(result.status).toBe("partial")
    expect(result.distance.totalKm).toBeNull()
    expect(result.monthly[2]!.metrics.RPE).toMatchObject({ kind: "DATA", median: 5, n: 1 })
    expect(result.evidence[0]!.metrics.DISTANCE_KM).toBeUndefined()
    expect(result.evidence[0]!.distanceIncluded).toBe(false)
  })

  it("distinguishes ready records spanning the full period from partial and missing", () => {
    const result = report([session("july", "2026-07-01", "5"), session("august", "2026-08-01", "6"), session("september", "2026-09-01", "7")])
    expect(result.status).toBe("ready")
    expect(result.period.currentMonthPartial).toBe(false)
    expect(result.distance.window.kind).toBe("CALENDAR_REPORT_RANGE")
    expect(result.energy.window.period).toBe("CALENDAR_3_MONTHS")
  })

  it("preserves explicit fields beside an unapproved imported distance without promoting it", () => {
    const entry = session("mixed", "2026-09-01", "15")
    const result = report([{ ...entry, fieldProvenance: { ...entry.fieldProvenance, distanceKm: { provenance: "DERIVED", derivedFrom: ["import:activity-file"], derivationRuleId: "unapproved" } } }])
    expect(result.distance.totalKm).toBeNull()
    expect(result.evidence[0]!.metrics.RPE).toBe(4)
    expect(result.evidence[0]!.metrics.DISTANCE_KM).toBeUndefined()
    expect(result.evidence[0]!.sourceRef.trustState).toBe("SOURCE_NOT_VERIFIED")
    expect(result.exclusions).toEqual({ excludedImported: 1, excludedNoProvenance: 0 })
  })

  it("separates legacy and imported exclusion reasons inside the selected range", () => {
    const legacy = { ...session("legacy", "2026-09-01", "5"), fieldProvenance: undefined }
    const outside = { ...session("outside", "2026-06-30", "10"), fieldProvenance: undefined }
    expect(report([legacy, outside]).exclusions).toEqual({ excludedImported: 0, excludedNoProvenance: 1 })
    expect(report([{ ...legacy, date: "2026-06-30" }]).exclusions).toEqual({ excludedImported: 0, excludedNoProvenance: 0 })
  })

  it("does not turn rest/skip records into performed distance, RPE or energy", () => {
    const result = report([session("real", "2026-09-01", "5"), { ...session("rest", "2026-09-02", "100", 10), activityOutcome: "RESTED" }, { ...session("skip", "2026-09-03", "100", 10), activityOutcome: "SKIPPED" }])
    expect(result.distance.totalKm).toBe(5)
    expect(result.energy.includedSourceCount).toBe(1)
    expect(result.evidence.map(item => item.id)).toEqual(["real"])
  })

  it("uses reducer acceptance for duplicate/conflicting distance and evidence", () => {
    const entry = session("same", "2026-09-01", "5")
    const duplicate = report([entry, { ...entry }])
    expect(duplicate.distance.totalKm).toBe(5)
    expect(duplicate.evidence.filter(item => item.distanceIncluded)).toHaveLength(1)
    const conflict = report([entry, { ...entry, distanceKm: "8" }])
    expect(conflict.distance.totalKm).toBeNull()
    expect(conflict.distance.conflictingSourceCount).toBe(1)
    expect(conflict.evidence.every(item => !item.distanceIncluded)).toBe(true)
  })

  it("has zero signal from private memo text, purpose, presence or memo-only records", () => {
    const entry = session("safe", "2026-09-01", "5")
    const baseline = report([entry])
    const privateEntry = { ...entry, memoPurpose: "PRIVATE_SELF_ONLY" as const }
    Object.defineProperty(privateEntry, "memo", { get: () => { throw new Error("private memo read") } })
    expect(report([privateEntry])).toEqual(baseline)
    const memoOnly = { ...session("private-only", "2026-09-02", "", 0), system: "", memo: "private text", memoPurpose: "PRIVATE_SELF_ONLY" as const, fieldProvenance: {} }
    expect(report([entry, memoOnly])).toEqual(baseline)
    expect(JSON.stringify(baseline)).not.toMatch(/private text|memoPurpose|containsPrivateRawText":true/u)
  })

  it("does not read or write browser storage or network while building actual/example reports", () => {
    const get = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("storage read") })
    const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("storage write") })
    const remove = vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw new Error("storage removal") })
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network"))
    expect(report([session("safe", "2026-09-01", "5")]).distance.totalKm).toBe(5)
    const scenario = buildOracleDemoScenario()
    buildOracleReport({ source: "example", months: 6, today: "2027-01-01", entries: scenario.entries })
    for (const topic of ["level", "focus", "compare", "mix", "priority", "change"] as const) buildOracleDemoTopicResult(topic)
    expect(get).not.toHaveBeenCalled()
    expect(set).not.toHaveBeenCalled()
    expect(remove).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

describe("single deterministic fictional scenario", () => {
  it("derives every legacy example topic from the same scenario with truthful source windows", () => {
    const focus = buildOracleDemoTopicResult("focus")
    expect(focus.rows).toHaveLength(4)
    expect(focus.source).toContain("연결 4건")
    expect(focus.source).toContain("2026-09-22~2026-09-30")
    expect(focus.source).not.toContain("6개월")
    expect(buildOracleDemoTopicResult("priority").rows).toEqual(focus.rows)
    const level = buildOracleDemoTopicResult("level")
    expect(level.rows.map(row => row.value)).toEqual([1326, 1305])
    expect(level.source).toContain("가상 예시")
    expect(buildOracleDemoTopicResult("level", 3).status).toBe("partial")
    expect(buildOracleDemoTopicResult("mix").source).toContain("최근 8주")
    expect(buildOracleDemoTopicResult("compare").source).toContain("2026-08~2026-09")
    expect(buildOracleDemoTopicResult("change").source).toContain("2026-08~2026-09")
    expect(buildOracleDemoTopicResult("focus")).toEqual(focus)
  })
  it("validates schemas, keeps a fixed six-month history and slices the same 3-month subset", () => {
    const scenario = buildOracleDemoScenario()
    expect(scenario).toEqual(buildOracleDemoScenario())
    expect(scenario.entries.length).toBeGreaterThan(150)
    expect(scenario.entries.every(entry => parseJournalEntryForWrite(entry) !== null && entry.date >= "2026-04-01" && entry.date <= "2026-09-30")).toBe(true)
    const six = buildOracleReport({ source: "example", entries: scenario.entries, months: 6, today: "2030-01-01" })
    const three = buildOracleReport({ source: "example", entries: scenario.entries, months: 3, today: "2020-01-01" })
    expect(six.period).toMatchObject({ startDate: "2026-04-01", endDate: "2026-09-30" })
    expect(three.period).toMatchObject({ startDate: "2026-07-01", endDate: "2026-09-30" })
    expect(three.monthly).toEqual(six.monthly.slice(3))
    expect(three.evidence).toEqual(six.evidence.filter(item => item.date >= "2026-07-01"))
    expect(six.sourceRefs.every(ref => ref.sourceId.startsWith("oracle-demo-"))).toBe(true)
    expect(six.evidence.some(item => item.date >= "2026-06-15" && item.date <= "2026-06-21")).toBe(false)
    expect(six.monthly[3]!.metrics.PAIN_MAX.kind).toBe("DATA")
    expect(six.monthly[3]!.metrics.PAIN_MAX).toMatchObject({ median: 0 })
  })

  it("uses same-event self-reported races and exact valid current-plan links for legacy topics", () => {
    const scenario = buildOracleDemoScenario()
    expect(scenario.athleteRecords.map(record => record.eventDistanceM)).toEqual([5000, 5000, 5000])
    expect(scenario.athleteRecords.every(record => record.verificationState === "SELF_REPORTED")).toBe(true)
    const result = buildOraclePersonalResult({ topicId: "focus", entries: scenario.entries, planState: scenario.planState, planHistory: scenario.planHistory, athleteRecords: scenario.athleteRecords, today: scenario.today })
    expect(result.status).toBe("ready")
    expect(result.source).toContain("연결 4건")
    expect(result.source).toContain("현재 계획")
    expect(result.source).not.toContain("6개월")
  })
})
