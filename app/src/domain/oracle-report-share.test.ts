import { describe, expect, it } from "vitest"
import { buildOracleReport } from "./oracle-report"
import { oracleShareMoments, projectOracleShare } from "./oracle-report-share"
import { buildOracleDemoScenario } from "./oracle-demo-scenario"

const fixture = () => buildOracleReport({ source: "example", entries: buildOracleDemoScenario().entries, months: 3, today: "2026-09-30" })
describe("Oracle local image export boundary", () => {
  it("exports ordinary single-workout, condition-only and equal-race neutral headlines from actual reports", () => {
    const scenario = buildOracleDemoScenario()
    const workout = scenario.entries.find(entry => entry.kind === "post-session" && entry.date.startsWith("2026-09"))!
    const single = buildOracleReport({ source: "my", months: 3, today: "2026-09-30", entries: [workout] })
    expect(projectOracleShare(single, "summary")?.headline).toBe(single.insights.hero.headline)
    const conditions = buildOracleReport({ source: "my", months: 3, today: "2026-09-30", entries: scenario.entries.filter(entry => entry.kind === "evening") })
    expect(projectOracleShare(conditions, "summary")).toBeNull()
    const races = scenario.athleteRecords.slice(1).map(record => ({ ...record, performanceSeconds: 2805 }))
    const equal = buildOracleReport({ source: "example", months: 3, today: scenario.today, entries: [], athleteRecords: races })
    expect(equal.raceChange?.deltaSeconds).toBe(0)
    expect(projectOracleShare(equal, "summary")?.headline).toMatch(/두 기록이 같아요$/)
    expect(projectOracleShare(equal, "summary")?.metrics.at(-1)?.text).toBe("0초")
  })
  it("reconstructs only safe fields and rejects sensitive injected headlines", () => {
    const report = fixture()
    const poisoned = { ...report, name: "SECRET_NAME", memo: "SECRET_MEMO", accountId: "SECRET_ACCOUNT", route: "SECRET_ROUTE", notices: ["SECRET_NOTICE"], evidence: report.evidence.map(item => ({ ...item, id: "SECRET_ID", title: "SECRET_TITLE", body: "SECRET_BODY", sourceRef: { ...item.sourceRef, sourceId: "SECRET_SOURCE" }, metrics: { ...item.metrics, MOOD: 99999, PAIN_MAX: 88888 } })) }
    const snapshot = projectOracleShare(poisoned, "summary")!
    expect(snapshot.headline).toBe(report.insights.hero.headline)
    expect(JSON.stringify(snapshot)).not.toMatch(/SECRET|99999|88888|sourceRef|accountId|PAIN|MOOD|memo/)
    expect(snapshot.metrics).toHaveLength(report.raceChange ? 3 : 2)
    expect(projectOracleShare({ ...report, insights: { ...report.insights, hero: { ...report.insights.hero, headline: "SECRET_MEMO" } } }, "summary")).toBeNull()
  })
  it("keeps missing and explicit zero distinct, labels examples, preserves monthly reducer values", () => {
    const report = fixture()
    const missing = projectOracleShare({ ...report, distance: { ...report.distance, totalKm: null } }, "summary")!
    const zero = projectOracleShare({ ...report, distance: { ...report.distance, totalKm: 0 } }, "summary")!
    expect(missing.metrics.some(metric => metric.label === "누적 거리")).toBe(false)
    expect(zero.metrics[0]!.text).toBe("0 km")
    expect(zero.source).toContain("예시")
    expect(zero.months.map(month => month.km)).toEqual(report.monthly.map(month => month.distance.totalKm))
  })
  it("requires explicit moment selection and excludes rest/skip, arbitrary method/title and health-only records", () => {
    const report = fixture(), item = report.evidence.find(item => item.kind === "post-session")!
    const sample = { ...report, evidence: [{ ...item, metrics: { PAIN_MAX: 9 }, distanceIncluded: false, durationMin: undefined, methodLabel: undefined, title: "SECRET" }] }
    expect(oracleShareMoments(sample)).toEqual([])
    expect(projectOracleShare(report, "moment")).toBeNull()
    const valid = { ...report, evidence: [{ ...item, metrics: { DISTANCE_KM: 0 }, distanceIncluded: true, durationMin: 12, methodLabel: "반복 달리기" as const }] }
    expect(projectOracleShare(valid, "moment", 0)!.metrics.map(item => item.text)).toEqual(["0 km", "12분", "반복 달리기"])
    expect(oracleShareMoments({ ...valid, evidence: [{ ...valid.evidence[0]!, activityOutcome: "RESTED" }] })).toEqual([])
  })
})
