import { afterEach, describe, expect, it, vi } from "vitest"
import { buildOracleDemoScenario, buildOracleDemoTopicResult, ORACLE_DEMO_SCENARIOS } from "./oracle-demo-scenario"
import { buildOracleReport, oracleReportPeriod } from "./oracle-report"
import { energyLedgerWindow } from "./energy-system-ledger"
import { parseJournalEntryForWrite, type JournalEntry, type PostSessionEntry } from "./journal-schema"
import { buildOraclePersonalResult } from "./oracle-personal-result"
import { safeOracleReportHeadline } from "./oracle-report-insights"

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
    expect(level.rows.map(row => row.value)).toEqual([2826, 2805])
    expect(level.source).toContain("가상 예시")
    expect(buildOracleDemoTopicResult("level", 3).status).toBe("ready")
    expect(buildOracleDemoTopicResult("mix").source).toContain("최근 8주")
    expect(buildOracleDemoTopicResult("compare").source).toContain("2026-08~2026-09")
    expect(buildOracleDemoTopicResult("change").source).toContain("2026-08~2026-09")
    expect(buildOracleDemoTopicResult("focus")).toEqual(focus)
  })
  it("validates schemas, keeps a fixed six-month history and slices the same 3-month subset", () => {
    const scenario = buildOracleDemoScenario()
    expect(scenario).toEqual(buildOracleDemoScenario())
    expect(scenario.entries.length).toBe(94)
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
    expect(scenario.athleteRecords.map(record => record.eventDistanceM)).toEqual([10000, 10000, 10000])
    expect(scenario.athleteRecords.every(record => record.verificationState === "SELF_REPORTED")).toBe(true)
    const result = buildOraclePersonalResult({ topicId: "focus", entries: scenario.entries, planState: scenario.planState, planHistory: scenario.planHistory, athleteRecords: scenario.athleteRecords, today: scenario.today })
    expect(result.status).toBe("ready")
    expect(result.source).toContain("연결 4건")
    expect(result.source).toContain("현재 계획")
    expect(result.source).not.toContain("6개월")
  })
})

describe("Oracle story facts and rule boundaries", () => {
  // Independently enumerated fixture calendar: monthly sums and unique performed
  // dates, including four September plan sessions, excluding rest/check-ins/gaps.
  const fixtures = [
    ["first-5k", [12.3, 17, 11.8, 22.4, 23, 29], [6, 6, 4, 6, 6, 9], 115.5, 74.4, 37, 21],
    ["ten-k", [60, 57, 48, 64, 51, 59], [9, 7, 6, 9, 8, 10], 339, 174, 49, 27],
    ["track-1500", [35.5, 37, 37, 27.5, 36, 42.5], [8, 7, 7, 7, 7, 10], 215.5, 106, 46, 24],
    ["restart", [33, 11, null, 8, 18, 27.5], [7, 3, 0, 4, 6, 9], 97.5, 53.5, 29, 19],
  ] as const
  it.each(fixtures)("has independently expected 3/6 month totals for %s", (id, km, days, sixKm, threeKm, sixDays, threeDays) => {
    const scenario = buildOracleDemoScenario(id)
    expect(scenario).toEqual(buildOracleDemoScenario(id))
    expect(scenario.entries.every(entry => parseJournalEntryForWrite(entry) !== null)).toBe(true)
    const input = { source: "example" as const, entries: scenario.entries, athleteRecords: scenario.athleteRecords, planState: scenario.planState, planHistory: scenario.planHistory, today: scenario.today }
    const six = buildOracleReport({ ...input, months: 6 })
    const three = buildOracleReport({ ...input, months: 3 })
    expect(six.monthly.map(month => month.distance.totalKm)).toEqual(km)
    expect(six.monthly.map(month => month.workoutDayCount)).toEqual(days)
    expect([six.distance.totalKm, three.distance.totalKm, six.workoutDayCount, three.workoutDayCount]).toEqual([sixKm, threeKm, sixDays, threeDays])
    expect(three.monthly).toEqual(six.monthly.slice(3))
    expect(three.evidence).toEqual(six.evidence.filter(item => item.date >= "2026-07-01"))
    expect(six.completedWeekCount).toBe(25)
    expect(three.completedWeekCount).toBe(12)
    expect(six.insights.strengths.length).toBeLessThanOrEqual(2)
    expect(six.insights.attention.length).toBeLessThanOrEqual(2)
    expect(six.insights.hero.ruleId).toBe(id === "restart" ? "PLAN_REPEATED_HIGHER_EFFORT" : id === "first-5k" ? "MONTH_PURPOSE_CHANGE" : "SAME_EVENT_RACE_CHANGE")
    expect(three.insights.hero.ruleId).toBe(id === "restart" ? "PLAN_REPEATED_HIGHER_EFFORT" : id === "first-5k" ? "MONTH_PURPOSE_CHANGE" : "SAME_EVENT_RACE_CHANGE")
  })
  it("exposes four selectable stories and keeps the argless default", () => {
    expect(ORACLE_DEMO_SCENARIOS.map(item => item.id)).toEqual(["first-5k", "ten-k", "track-1500", "restart"])
    expect(buildOracleDemoScenario()).toEqual(buildOracleDemoScenario("ten-k"))
  })
  it("counts duration-only activity and same-day sessions once, never condition/rest/skip", () => {
    const duration = { ...session("duration", "2026-09-01", "", 0), system: "", durationMin: "20", fieldProvenance: { durationMin: { provenance: "EXPLICIT" as const } } }
    const result = report([duration, duration, session("same-day", "2026-09-01", "3"), { ...session("rest", "2026-09-02", "100"), activityOutcome: "RESTED" }, { ...session("skip", "2026-09-03", "100"), activityOutcome: "SKIPPED" }])
    expect(result.workoutDayCount).toBe(1)
    expect(result.monthly[2]!.days).toEqual([{ date: "2026-09-01", distanceKm: 3, durationMinutes: 38, evidenceRefs: ["duration", "same-day"] }])
    expect(result.monthly[2]!.unknownPurposeCount).toBe(1)
    expect(result.evidence.find(item => item.id === "duration")?.durationMin).toBe(20)
    const dirty = report([duration, { ...duration, durationMin: "40" }])
    expect(dirty.workoutDayCount).toBe(0)
    expect(dirty.evidence).toEqual([])
  })
  it("uses edited accepted distances and never infers methods from purpose, title or pace", () => {
    const baseline = session("edited", "2026-09-02", "5")
    expect(report([{ ...baseline, distanceKm: "7" }]).distance.totalKm).toBe(7)
    expect(report([{ ...baseline, title: "400m 반복 / 가속주", avgPace: "3:00", system: "vo2" }]).evidence[0]!.methodLabel).toBeUndefined()
    const scenario = buildOracleDemoScenario("track-1500")
    const result = buildOracleReport({ source: "example", entries: scenario.entries, today: scenario.today, months: 6 })
    expect(result.evidence.some(item => item.methodLabel === "반복 달리기")).toBe(true)
    expect(result.workoutDayCount).toBe(46) // warmup/main/cooldown remain one session
    expect(result.evidence.some(item => item.methodDetail?.includes("80m · 4회"))).toBe(true)
    expect(result.evidence.some(item => item.methodDetail?.includes("400m · 5회"))).toBe(true)
  })
  it("isolates read errors and excludes goals, cross-event pairs and conflicting race IDs", () => {
    const scenario = buildOracleDemoScenario()
    const base = { source: "example" as const, entries: scenario.entries, athleteRecords: scenario.athleteRecords, today: scenario.today, months: 6 as const }
    const result = buildOracleReport(base)
    expect(result.raceChange?.deltaSeconds).toBe(-21)
    expect(buildOracleReport({ ...base, raceReadState: "error" }).insights.hero.ruleId).toBe("MONTH_PURPOSE_CHANGE")
    expect(buildOracleReport({ ...base, planReadState: "error" }).raceChange).toEqual(result.raceChange)
    const [first, middle, latest] = scenario.athleteRecords
    expect(buildOracleReport({ ...base, athleteRecords: [{ ...latest!, purpose: "RACE_GOAL", achievedOn: null, seasonId: null }] }).raceChange).toBeNull()
    expect(buildOracleReport({ ...base, athleteRecords: [first!, { ...latest!, eventDistanceM: 1500 }] }).raceChange).toBeNull()
    expect(buildOracleReport({ ...base, athleteRecords: [middle!, latest!, { ...latest!, performanceSeconds: 2700 }] }).raceChange).toBeNull()
  })
  it("does not compare a partial current month or manufacture a weakness", () => {
    const result = report([session("july", "2026-07-01", "5"), session("aug", "2026-08-01", "5"), session("sep", "2026-09-01", "80")], "2026-09-15")
    expect(result.insights.hero.ruleId).toBe("ACTIVE_WEEKS")
    expect(result.insights.attention).toEqual([])
    expect(report([]).insights.hero.ruleId).toBe("NEUTRAL")
  })
  it("withholds conflicting outcomes and unconfirmed methods or duration", () => {
    const activity = { ...session("outcome", "2026-09-04", "4"), activityOutcome: "COMPLETED" as const }
    const conflict = report([activity, { ...activity, activityOutcome: "RESTED" }])
    expect(conflict.distance.totalKm).toBeNull()
    expect(conflict.workoutDayCount).toBe(0)
    const unconfirmed = report([{ ...activity, exerciseLog: { version: 1, source: "UNKNOWN", components: [{ kind: "INTERVALS" }] } as never, fieldProvenance: { ...activity.fieldProvenance, durationMin: { provenance: "DERIVED", derivedFrom: ["import:activity-file"], derivationRuleId: "unapproved" } } }])
    expect(unconfirmed.evidence[0]!.methodDetail).toBeUndefined()
    expect(unconfirmed.evidence[0]!.durationMin).toBeUndefined()
  })
  it("keeps narrative events consistent with fictional gaps and first finish", () => {
    const first = buildOracleDemoScenario("first-5k")
    expect(first.athleteRecords.map(record => record.achievedOn)).toEqual(["2026-09-13"])
    const restart = buildOracleDemoScenario("restart")
    expect(restart.entries.some(entry => entry.date > "2026-05-14" && entry.date < "2026-07-14")).toBe(false)
    expect(restart.athleteRecords.some(record => record.achievedOn! > "2026-05-14" && record.achievedOn! < "2026-07-14")).toBe(false)
    const firstReport = buildOracleReport({ source: "example", months: 6, today: first.today, entries: first.entries, athleteRecords: first.athleteRecords })
    expect(firstReport.raceChange).toBeNull()
  })
  it("shares only centrally recognized rule copy and handles unchanged race times", () => {
    expect(safeOracleReportHeadline({ ruleId: "NEUTRAL", headline: "이 기간에 남긴 훈련" })).toBe("이 기간에 남긴 훈련")
    expect(safeOracleReportHeadline({ ruleId: "NEUTRAL", headline: "arbitrary private text" })).toBeNull()
    const scenario = buildOracleDemoScenario()
    const races = scenario.athleteRecords.slice(1).map(record => ({ ...record, performanceSeconds: 2805 }))
    const result = buildOracleReport({ source: "example", months: 3, today: scenario.today, entries: scenario.entries, athleteRecords: races })
    expect(result.insights.hero.headline).toBe("10000m 두 기록이 같아요")
    expect(safeOracleReportHeadline(result.insights.hero)).toBe(result.insights.hero.headline)
    expect(result.insights.strengths.some(item => item.ruleId === result.insights.hero.ruleId)).toBe(false)
    const fractional = buildOracleReport({ source: "example", months: 3, today: scenario.today, entries: scenario.entries, athleteRecords: races.map((record, index) => ({ ...record, performanceSeconds: index === 0 ? 304 : 297.02 })) })
    expect(fractional.raceChange?.deltaSeconds).toBe(-6.98)
    expect(safeOracleReportHeadline(fractional.insights.hero)).toBe("10000m 기록이 6.98초 짧아졌어요")
  })
})
