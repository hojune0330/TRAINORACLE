import { describe, expect, it } from "vitest"
import { ORACLE_CONTENT_CATALOG } from "./oracle-content-catalog"
import { ORACLE_QUESTIONS } from "./oracle-profile-v2"
import { makeOracleProfileRevision } from "./oracle-profile-snapshot"
import { createSelfReportedAthleteRecord } from "./athlete-records"
import { buildOracleContentReading, resolveOracleContentReading, type OracleContentReaderInput, type OracleReaderSource, type OracleReaderSession } from "./oracle-content-reader"

const today = "2026-10-04"
const ready = <T>(data: T, sourceVersion = "source:1"): OracleReaderSource<T> => ({ state: "READY", sourceVersion, data })
const profile = (revision = 2, value = 4) => makeOracleProfileRevision({ revision, answeredAt: revision === 1 ? "2026-08-01T00:00:00Z" : "2026-09-01T00:00:00Z",
  answers: Object.fromEntries(ORACLE_QUESTIONS.map(q => [q.id, value])) })
const race = (id: string, seconds: number, date: string, distance = 5000, purpose: "PERSONAL_BEST" | "RECENT_RESULT" = "RECENT_RESULT") => createSelfReportedAthleteRecord({ id, purpose, eventDistanceM: distance, performanceSeconds: seconds, achievedOn: date, seasonId: null }, new Date(`${today}T12:00:00`))!
const sessions: OracleReaderSession[] = [
  { id: "s1", date: "2026-09-03", provenance: "EXPLICIT", activity: "RUN", slot: "AM", distanceKm: 5, durationMinutes: 25, rpe: 4, form: "CONTINUOUS", purpose: "BASE" },
  { id: "s2", date: "2026-09-03", provenance: "EXPLICIT", activity: "RUN", slot: "PM", distanceKm: 3, durationMinutes: 20, rpe: 5, form: "INTERVAL", purpose: "GLY",
    segments: [92, 91, 93, 94, 92, 95].map((seconds, i) => ({ id: `rep${i + 1}`, distanceM: 400, seconds })), segmentsComplete: true },
  { id: "s3", date: "2026-09-04", provenance: "EXPLICIT", activity: "WEIGHTS", sets: 3, reps: 5, weightKg: 20, durationMinutes: 15, purpose: "MIX" },
]
function fixture(): OracleContentReaderInput {
  const training = { period: { startDate: "2026-09-01", endDate: "2026-09-30" }, coverage: "COMPLETE" as const, sessions }
  const answers = { motivations: ["RECORD", "REFRESH"] as const, movementForm: "INTERVAL" as const, company: "BOTH" as const, conversation: "EITHER" as const,
    familiarEnjoyment: "YES" as const, learningInterests: ["METHODS"] as const, supplementaryExperience: "NO" as const, supplementaryInterest: "YES" as const,
    raceGoals: ["FINISH", "EXPERIENCE"] as const, raceOutcomes: ["EXPERIENCE"] as const, todayGoals: ["LEARN"] as const,
    togetherPhases: ["WARMUP", "COOLDOWN"] as const, context: "TEAM" as const }
  const conditions = { availableMinutes: 40, places: ["TRACK"] as const, equipment: ["NONE"] as const,
    meetingWindows: [{ date: today, startMinute: 600, endMinute: 660 }],
    races: [{ recordId: "new", course: "TRACK" as const, weather: "DRY" as const, round: "FINAL" as const, goal: "FINISH" as const },
      { recordId: "old", course: "ROAD" as const, weather: "RAIN" as const }],
    events: [{ id: "e1", date: "2026-10-20", cost: { amount: 30000, currency: "KRW" as const }, travelMinutes: 30 },
      { id: "e2", date: "2026-11-01", cost: { amount: 40, currency: "USD" as const }, travelMinutes: 45 }] }
  return { today, profile: ready(profile()), previousProfile: ready(profile(1, 3)), answers: ready(answers),
    records: ready([race("old", 1500, "2026-08-01"), race("new", 1440, "2026-09-01", 5000, "PERSONAL_BEST"), race("other", 600, "2026-07-01", 3000)]),
    goal: ready({ eventDistanceM: 5000, performanceSeconds: 1400 }), device: ready({ eventDistanceM: 5000, performanceSeconds: 1420, date: "2026-09-02", modelVersion: "watch:1" }),
    laps: ready({ recordId: "new", date: "2026-09-01", complete: true, segments: [{ id: "z-first", distanceM: 2500, seconds: 730 }, { id: "a-last", distanceM: 2500, seconds: 710 }] }),
    training: ready(training), conditions: ready(conditions),
    planActual: ready([{ id: "p1", date: "2026-09-03", sessionId: "s2", originalPlanVersion: "original:7", completion: "COMPLETED", plannedDistanceKm: 3,
      plannedRpe: { min: 4, max: 6 }, segmentTargets: [1, 2, 3, 4, 5, 6].map(i => ({ segmentId: `rep${i}`, distanceM: 400, minSeconds: 90, maxSeconds: 94 })) }]),
    method: ready({ id: "method1", purpose: "LT", form: "INTERVAL", requiredMinutes: 30, places: ["TRACK"], equipment: ["NONE"] }),
    friend: ready({ permission: "COMPARISON_ALLOWED", profile: ready(profile()), answers: ready(answers), conditions: ready(conditions), records: ready([race("friend", 1500, "2026-09-02")]), training: ready(training) }),
  }
}
const read = (topic: string, patch: Partial<OracleContentReaderInput> = {}) => buildOracleContentReading(topic, { ...fixture(), ...patch })
const fact = (topic: string, id: string, patch: Partial<OracleContentReaderInput> = {}) => read(topic, patch).facts.find(f => f.id === id)

describe("Oracle content reader coverage and boundaries", () => {
  it.each(["F02", "F05", "F08"])("%s distinguishes race HEAT from weather HEAT", topic => {
    const result = read(topic, { conditions: ready({ races: [{ recordId: "new", round: "HEAT", weather: "HEAT" }] }) })
    expect(result.facts.find(f => f.id.endsWith(":round"))?.value).toBe("예선")
    expect(result.facts.find(f => f.id.endsWith(":weather"))?.value).toBe("더위")
  })
  it.each(["BASE", "REC", "LT", "VO2", "GLY", "ATP_PC", "MIX", "SPEED", "OTHER"] as const)("pairs Korean purpose labels with %s without changing source codes", purpose => {
    const result = read("D01", { method: ready({ id: "method1", purpose }) })
    expect(result.facts.find(f => f.id === "method:purpose")?.value).toMatch(/[가-힣].*\(.+\)/u)
    const count = read("C02", { training: ready({ period: { startDate: "2026-09-01", endDate: "2026-09-30" }, coverage: "COMPLETE",
      sessions: [{ ...sessions[0]!, purpose }] }) }).facts.find(f => f.id === `training:purpose:${purpose}`)
    expect(count?.value).toBe(1); expect(count?.label).toMatch(/[가-힣].*\(.+\) 목적/u)
  })
  it("exports the parent UI alias and rejects unknown topic identities", () => {
    expect(buildOracleContentReading).toBe(resolveOracleContentReading)
    expect(() => read("A99")).toThrow(RangeError)
  })
  it("keeps fact rendering separate from explanatory paragraphs", () => {
    const result = read("G01")
    expect(result.facts.length).toBeGreaterThan(0)
    for (const f of result.facts) expect(result.paragraphs).not.toContain(`${f.label}: ${f.value} ${f.unit}`)
    expect(result.paragraphs.some(p => p.includes("입력된 달리기 거리 합: 8"))).toBe(false)
  })
  for (const topic of ORACLE_CONTENT_CATALOG) {
    it(`${topic.id}: has distinct readable content without inventing personal facts`, () => {
      const result = buildOracleContentReading(topic.id, { today })
      expect(result).toMatchObject({ topicId: topic.id, title: topic.title, kind: topic.kind, nextAction: topic.destination, personalized: false, facts: [] })
      expect(result.status).toBe(topic.kind === "EDUCATION" ? "SUFFICIENT" : "MISSING")
      expect(result.paragraphs.join(" ")).toContain(topic.explanation)
      expect(result.paragraphs.length).toBeGreaterThan(1)
    })
    it(`${topic.id}: is deterministic and every actual fact retains typed provenance`, () => {
      const input = fixture(); const before = structuredClone(input)
      const result = buildOracleContentReading(topic.id, input)
      expect(result).toEqual(buildOracleContentReading(topic.id, structuredClone(input)))
      expect(input).toEqual(before)
      if (topic.kind !== "EDUCATION") expect(result.facts.length).toBeGreaterThan(0)
      for (const f of result.facts) {
        expect(f.sourceRefs.length).toBeGreaterThan(0)
        expect(f.sourceRefs.every(ref => !!ref.sourceVersion)).toBe(true)
        if (typeof f.value === "number") expect(Number.isFinite(f.value)).toBe(true)
      }
      expect(new Set(result.facts.map(f => f.id)).size).toBe(result.facts.length)
      expect(result.facts.some(f => f.metric === "M20")).toBe(false)
    })
  }
  it.each(["MISSING", "UNAVAILABLE", "REVOKED"] as const)("preserves %s rather than empty-success", state => {
    expect(read("B01", { records: { state } })).toMatchObject({ status: state, personalized: false, facts: [] })
  })
  it("keeps known facts partial when a second source failed", () => {
    const result = read("B06", { records: { state: "UNAVAILABLE" } })
    expect(result.status).toBe("PARTIAL")
    expect(result.inputStates.records).toBe("UNAVAILABLE")
    expect(result.facts.map(f => f.id)).toEqual(["goal:time"])
  })
  it("revocation invalidates the whole dependent bundle, not unrelated education", () => {
    const result = read("B06", { records: { state: "REVOKED" } })
    expect(result).toMatchObject({ status: "REVOKED", facts: [], sourceVersions: {}, personalized: false })
    expect(JSON.stringify(result)).not.toContain("1400")
    expect(read("H06", { profile: { state: "REVOKED" }, records: { state: "REVOKED" } }).status).toBe("SUFFICIENT")
  })
  it("does not read memo-shaped properties, including during deduplication", () => {
    const input = fixture()
    Object.defineProperty(input, "memo", { get() { throw Error("memo accessed") } })
    if (input.training?.state === "READY") for (const s of input.training.data.sessions) Object.defineProperty(s, "memo", { get() { throw Error("memo accessed") }, configurable: true })
    for (const topic of ORACLE_CONTENT_CATALOG) expect(() => buildOracleContentReading(topic.id, input)).not.toThrow()
  })
  it("changes source-version receipts when source changes, without caching old facts", () => {
    const old = read("A02"); const next = read("A02", { profile: ready(profile(2, 1), "profile:changed") })
    expect(old.sourceVersions).not.toEqual(next.sourceVersions)
    expect(next.facts.find(f => f.id === "INTENSITY:index")?.value).toBe(0)
  })
})

describe("specific preferences and record arithmetic", () => {
  it("counts direct motives once without ranking, and never derives interval preference from intensity", () => {
    expect(fact("A01", "motivations:count", { answers: ready({ motivations: ["RECORD", "RECORD", "REFRESH"] }) })?.value).toBe(2)
    expect(read("A04", { answers: { state: "MISSING" } }).facts).toEqual([])
  })
  it("uses approved three-question scores and retains mixed versus uniform evidence", () => {
    const make = (a: number, b: number, c: number) => ready(makeOracleProfileRevision({ revision: 1, answeredAt: "2026-09-01T00:00:00Z", answers: { INTENSITY_1: a, INTENSITY_2: b, INTENSITY_3: c } }))
    const uniform = read("A02", { profile: make(4, 4, 4) }); const mixed = read("A02", { profile: make(2, 5, 5) })
    expect(uniform.facts.find(f => f.id === "INTENSITY:index")?.value).toBe(75)
    expect(mixed.facts.find(f => f.id === "INTENSITY:index")?.value).toBe(75)
    expect(uniform.paragraphs).not.toEqual(mixed.paragraphs)
    const partial = read("A02", { profile: ready(makeOracleProfileRevision({ revision: 1, answeredAt: "2026-09-01T00:00:00Z", answers: { INTENSITY_1: 1, INTENSITY_2: "UNKNOWN" } })) })
    expect(partial.status).toBe("PARTIAL")
    expect(partial.facts.some(f => f.metric === "M01")).toBe(false)
  })
  it("computes 5km actual mean pace and same-event changes with source dates", () => {
    expect(fact("B01", "records:new:pace:1000")?.value).toBe(288)
    expect(fact("B01", "records:new:pace:400")?.value).toBeCloseTo(115.2)
    expect(fact("B01", "records:new:pace:200")?.value).toBeCloseTo(57.6)
    expect(fact("B02", "race:delta")?.value).toBe(-60)
    expect(fact("B02", "race:speed-index")?.value).toBeCloseTo(104.1666667)
    expect(read("B02").facts.filter(f => f.id === "race-role:new")).toHaveLength(1)
  })
  it("keeps old PB visible and goals, future dates, sub-60m and invalid values out of actual races", () => {
    const old = race("pb", 1440, "2020-01-01", 5000, "PERSONAL_BEST")
    expect(read("B05", { records: ready([old]) }).paragraphs.join(" ")).toContain("2020-01-01")
    for (const patch of [{ achievedOn: "2027-01-01" }, { eventDistanceM: 30 }, { performanceSeconds: Infinity }, { performanceSeconds: "1440" }, { verificationState: "UNVERIFIED" }, { purpose: "RACE_GOAL", achievedOn: null }]) {
      expect(read("B01", { records: ready([{ ...old, ...patch }] as never) }).facts).toEqual([])
    }
  })
  it("does not calculate a goal gap across distances or silently fill missing laps", () => {
    expect(read("B06", { goal: ready({ eventDistanceM: 800, performanceSeconds: 120 }) }).facts.some(f => f.id === "goal:delta")).toBe(false)
    expect(fact("B06", "goal:delta")?.value).toBe(-40)
    expect(fact("B04", "laps:pace-delta")?.value).toBe(-8)
    const laps = { recordId: "new", date: "2026-09-01", complete: false, segments: [{ id: "one", distanceM: 400, seconds: 92 }] }
    expect(read("B04", { laps: ready(laps) }).facts.some(f => f.metric === "M10")).toBe(false)
  })
  it("keeps device estimates separate and never invents model M20", () => {
    expect(fact("B07", "device:delta")?.value).toBe(-20)
    expect(fact("B07", "device:prediction")?.sourceRefs[0]?.provenance).toBe("DEVICE_ESTIMATE")
  })
})

describe("period and original-plan evidence", () => {
  it("labels all clipped months in a rolling 56-day window rather than calling it one full month", () => {
    const result = read("G01", { training: ready({ period: { startDate: "2026-08-10", endDate: today }, coverage: "PARTIAL",
      sessions: [
        { ...sessions[0]!, id: "aug", date: "2026-08-10", distanceKm: 2 },
        { ...sessions[0]!, id: "sep", date: "2026-09-03", distanceKm: 3 },
        { ...sessions[0]!, id: "oct", date: "2026-10-01", distanceKm: 4 },
      ] }) })
    const distances = result.facts.filter(f => f.unit === "km")
    expect(distances.map(f => [f.value, f.period])).toEqual([
      [2, { startDate: "2026-08-10", endDate: "2026-08-31" }],
      [3, { startDate: "2026-09-01", endDate: "2026-09-30" }],
      [4, { startDate: "2026-10-01", endDate: today }],
    ])
    expect(distances[0]?.label).toContain("2026-08-10~2026-08-31")
    expect(distances[2]?.label).toContain(`2026-10-01~${today}`)
    expect(result.status).toBe("PARTIAL")
  })
  it("keeps a complete month-to-date receipt scoped to its actual dates", () => {
    const result = read("G01", { training: ready({ period: { startDate: "2026-10-01", endDate: today }, coverage: "COMPLETE",
      sessions: [{ ...sessions[0]!, date: "2026-10-03" }] }) })
    expect(result.facts.find(f => f.unit === "km")).toMatchObject({ value: 5, period: { startDate: "2026-10-01", endDate: today },
      label: expect.stringContaining(`2026-10-01~${today}`) })
    expect(result.facts.some(f => f.label.includes("2026-09"))).toBe(false)
  })
  it("sums month distance rather than median and counts AM/PM as one date", () => {
    expect(fact("G01", "2026-09:training:km")?.value).toBe(8)
    expect(fact("C03", "training:days")?.value).toBe(2)
    expect(fact("C03", "training:sessions")?.value).toBe(3)
    expect(fact("C02", "training:purpose:GLY")).toMatchObject({ value: 1, denominator: 3 })
  })
  it("does not count unknown/cycling distances as running or inflate partial receipt", () => {
    const training = ready({ period: { startDate: "2026-09-01", endDate: "2026-09-30" }, coverage: "PARTIAL" as const,
      sessions: [{ ...sessions[0]!, activity: "UNKNOWN" as const, distanceKm: 100 }, { ...sessions[1]!, activity: "CYCLING" as const, distanceKm: 100 }] })
    const result = read("G01", { training })
    expect(result.status).toBe("PARTIAL")
    expect(result.facts.some(f => f.unit === "km")).toBe(false)
  })
  it("deduplicates identical sessions and excludes both sides of a conflict", () => {
    const base = { period: { startDate: "2026-09-01", endDate: "2026-09-30" }, coverage: "COMPLETE" as const }
    expect(fact("G01", "2026-09:training:km", { training: ready({ ...base, sessions: [sessions[0]!, sessions[0]!] }) })?.value).toBe(5)
    for (const conflicting of [[sessions[0]!, { ...sessions[0]!, distanceKm: 9 }], [{ ...sessions[0]!, distanceKm: 9 }, sessions[0]!]]) {
      expect(read("G01", { training: ready({ ...base, sessions: conflicting }) }).facts).toEqual([])
    }
  })
  it("does not choose a winning copy of conflicting session IDs across period snapshots", () => {
    const base = { period: { startDate: "2026-09-01", endDate: "2026-09-30" }, coverage: "COMPLETE" as const }
    const current = ready({ ...base, sessions: [sessions[0]!] })
    const previous = ready({ ...base, sessions: [{ ...sessions[0]!, rpe: 9 }] }, "previous:1")
    for (const [training, previousTraining] of [[current, previous], [previous, current]]) {
      const result = read("G02", { training, previousTraining })
      expect(result.facts).toEqual([])
      expect(result.missingInputs).toContain("training:cross-period-identity")
    }
    expect(read("G02", { training: current, previousTraining: current }).facts.filter(f => f.id.endsWith(":rpe"))).toHaveLength(1)
  })
  it("uses original bounds inclusively and does not claim recovery from missing data", () => {
    expect(fact("C07", "plan:p1:in-range")).toMatchObject({ value: 5, denominator: 6, unit: "count", metric: "M09" })
    expect(fact("G03", "plan:p1:in-range")?.sourceRefs[0]?.sourceVersion).toBe("original:7")
    expect(read("G03", { profile: ready(profile(2, 1)), records: ready([race("faster", 1200, "2026-09-10")]) }).facts).toEqual(read("G03").facts)
    expect(read("C04").facts.some(f => f.id === "training:s2:recovery")).toBe(false)
    expect(fact("C04", "training:s2:repeat-mean")?.value).toBeCloseTo(92.8333333)
    expect(fact("C04", "training:s2:repeat-cv")?.denominator).toBe(6)
  })
  it("completion alone is partial, a mismatched date cannot create linked actual facts", () => {
    const plan = { id: "mark", date: "2026-09-04", sessionId: "s1", originalPlanVersion: "original:1", completion: "COMPLETED" as const }
    const result = read("C07", { planActual: ready([plan]) })
    expect(result.status).toBe("PARTIAL")
    expect(result.facts).toHaveLength(1)
    expect(result.missingInputs).toContain("plan:mark:linked-actual")
  })
  it("preserves original repetition order, absent final recovery, and differing units", () => {
    expect(fact("B04", "lap:z-first:time")?.label).toContain("1번째")
    expect(fact("C06", "training:s3:weightKg")).toMatchObject({ value: 20, unit: "kg" })
    expect(read("C06").facts.some(f => f.metric === "M11")).toBe(false)
  })
  it("reads response changes only in ordered snapshots of the same question version", () => {
    expect(fact("G04", "history:changed")).toMatchObject({ value: 24, denominator: 24 })
    expect(read("G04", { previousProfile: ready(profile(2)) }).facts.some(f => f.metric === "M16")).toBe(false)
    expect(read("G04", { previousProfile: ready({ ...profile(1), questionVersion: "old" } as never) }).inputStates.previousProfile).toBe("UNAVAILABLE")
  })
})

describe("permission-passed comparisons and direct contextual facts", () => {
  it.each(["E01", "E02", "E03", "E04", "E05"])("%s requires passed comparison permission and honors revocation", topic => {
    for (const state of ["MISSING", "UNAVAILABLE", "REVOKED"] as const) expect(read(topic, { friend: { state } })).toMatchObject({ status: state, facts: [] })
    expect(read(topic, { friend: ready({ permission: "EXTERNAL_SHARE_ALLOWED" } as never) }).facts).toEqual([])
  })
  it("does not reuse comparison consent for external sharing", () => {
    expect(read("E06").facts).toEqual([])
    expect(read("E06", { share: ready({ permission: "EXTERNAL_SHARE_ALLOWED", selectedFields: ["RACE_RECORDS"] }) }).facts[0]?.value).toBe("RACE_RECORDS")
  })
  it("friend same-event comparison is signed and source-owned", () => {
    expect(fact("E01", "friend:race-delta")).toMatchObject({ value: 60, owner: "COMPARISON" })
    expect(read("E01").facts.some(f => f.owner === "FRIEND")).toBe(true)
    expect(read("E01", { friend: ready({ permission: "COMPARISON_ALLOWED", records: ready([race("f", 120, "2026-09-01", 800)]) }) }).facts.some(f => f.metric === "M04")).toBe(false)
  })
  it("excludes nonnumeric answer matches from the denominator", () => {
    const p = makeOracleProfileRevision({ revision: 1, answeredAt: "2026-09-01T00:00:00Z", answers: { CHALLENGE_1: 4, CHALLENGE_2: "UNKNOWN", CHALLENGE_3: "VARIES" } })
    const result = read("E03", { profile: ready(p), friend: ready({ permission: "COMPARISON_ALLOWED", profile: ready(p) }) })
    expect(result.facts.find(f => f.id === "friend:matching-answers")).toMatchObject({ value: 1, denominator: 1 })
    expect(result.facts.some(f => f.unit === "%")).toBe(false)
  })
  it("merges overlapping meeting windows instead of double counting intersections", () => {
    const conditions = { meetingWindows: [{ date: today, startMinute: 600, endMinute: 640 }, { date: today, startMinute: 630, endMinute: 660 }] }
    const input = fixture(); const friend = input.friend!.state === "READY" ? input.friend!.data : undefined
    expect(fact("E02", "friend:meeting-minutes", { conditions: ready(conditions), friend: ready({ ...friend!, conditions: ready(conditions) }) })?.value).toBe(60)
  })
  it("compares methods only on stated conditions, not safety or effect", () => {
    expect(fact("D06", "method:minutes-gap")?.value).toBe(10)
    expect(fact("D01", "method:form-match")?.value).toBe("형태 선택에 포함")
    expect(read("D06").facts.some(f => /안전|효과/u.test(f.label))).toBe(false)
  })
  it("keeps event currencies separate and missing cost unknown rather than zero", () => {
    expect(read("F07").facts.filter(f => f.unit === "currency").map(f => f.value)).toEqual([30000, 40])
    const result = read("F07", { conditions: ready({ events: [{ id: "one", date: today }] }) })
    expect(result.status).toBe("PARTIAL")
    expect(result.facts.some(f => f.unit === "currency")).toBe(false)
  })
})
