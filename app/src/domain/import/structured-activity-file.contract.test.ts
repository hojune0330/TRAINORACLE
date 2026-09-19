import { describe, expect, it, vi } from "vitest"
import { parseActivityFile } from "./activity-file"
import { parseCsvActivities, parseJsonActivities } from "./structured-activity-file"
import { FILE_OBSERVATION_LIMITS, parseFileObservation, toFileObservationSummary } from "./file-observation"

const row = { date: "2026-09-19", sport: "running", distanceKm: "5.000125", durationMin: "25.0125" }
const csvOf = (value: Record<string, unknown>) => {
  const cell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`
  return Object.keys(value).map(cell).join(",") + "\r\n" + Object.values(value).map(cell).join(",")
}

describe.each(["csv", "json"] as const)("%s precise structured observations", format => {
  const parse = (value: Record<string, unknown>, enabled = true) => parseActivityFile(
    format === "csv" ? csvOf(value) : JSON.stringify([value]), "Asia/Seoul", { observations: { [format]: enabled } },
  )

  it("keeps precision and fixed units without inventing laps or a midnight timestamp", () => {
    const result = parse(row)
    const activity = result.activities[0]!
    expect(activity.observation).toMatchObject({
      format, sourceProfile: format === "csv" ? "CSV_COLUMNS_V1" : "JSON_COLUMNS_V1",
      date: "2026-09-19", startedAt: null, timeZone: null, sport: "RUNNING", sourceActivityId: null,
      distanceMeters: 5000.125, durationSeconds: 1500.75, durationMeaning: "SOURCE_DEFINED",
      laps: [], completeness: { missingDistanceLaps: 0, missingDurationLaps: 0 }, confirmation: null,
    })
    expect(parseFileObservation(activity.observation)).toEqual(activity.observation)
    expect(activity).toMatchObject(toFileObservationSummary(activity.observation!))
    expect(activity.avgPace).toBe("")
    expect(activity.observation?.sourceIdentityFingerprint).toBe(activity.observation?.contentRevisionFingerprint)
  })

  it.each(["5 miles", "1:30", "12abc", "NaN", "Infinity", "-1", "-0", "0xFF", "1,000", "1e999", "1e-999"])("rejects the whole invalid numeric string %s", value => {
    const result = parse({ ...row, distanceKm: value })
    expect(result.activities[0]?.observation).toMatchObject({ distanceMeters: null, durationSeconds: 1500.75 })
    expect(result.issues).toContainEqual({ code: "INVALID_DISTANCE", activityIndex: 0, count: 1 })
    expect(result.skipped).toBe(0)
  })

  it("preserves true zero separately from missing and invalid fields", () => {
    const zero = parse({ ...row, distanceKm: "0", durationMin: "0" })
    expect(zero.activities[0]).toMatchObject({ distanceKm: "0", durationMin: "0", avgPace: "", observation: { distanceMeters: 0, durationSeconds: 0 } })
    const missing = parse({ ...row, distanceKm: "", durationMin: "0" })
    expect(missing.activities[0]?.observation?.distanceMeters).toBeNull()
    expect(missing.issues).toContainEqual({ code: "MISSING_DISTANCE", activityIndex: 0, count: 1 })
    const empty = parse({ ...row, distanceKm: "", durationMin: "" })
    expect(empty.skipped).toBe(1)
    expect(empty.issues).toContainEqual({ code: "NO_MEASUREMENTS", activityIndex: 0, count: 1 })
  })

  it.each(["TIMER", "MOVING", "ELAPSED"])("honors exact declared %s semantics without manufacturing confirmation", meaning => {
    const activity = parse({ ...row, durationMeaning: meaning }).activities[0]!
    expect(activity.avgPace).toBe("5:00")
    expect(activity.observation).toMatchObject({ durationMeaning: meaning, confirmation: null })
    expect(parse({ ...row, durationMeaning: meaning.toLowerCase() }).activities[0]?.avgPace).toBe("")
  })

  it("preserves explicit unknown meanings and reports unrecognized annotations", () => {
    for (const durationMeaning of ["UNKNOWN", "SOURCE_DEFINED"]) {
      expect(parse({ ...row, durationMeaning }).activities[0]?.observation?.durationMeaning).toBe(durationMeaning)
      expect(parse({ ...row, durationMeaning }).activities[0]?.avgPace).toBe("")
    }
    const bad = parse({ ...row, durationMeaning: "private-sentinel" })
    expect(bad.issues).toContainEqual({ code: "INVALID_DURATION_MEANING", activityIndex: 0, count: 1 })
    expect(JSON.stringify(bad)).not.toContain("private-sentinel")
  })

  it("never trusts annotations, authority, names or supplied identity fingerprints", () => {
    const clean = parse(row).activities[0]?.observation
    const injected = parse({ ...row, name: "private-sentinel", Notes: "private-sentinel", filename: "private-sentinel",
      confirmation: { sport: "RUNNING", durationMeaning: "MOVING" }, analysisEligible: true, provenance: "EXPLICIT",
      sourceIdentityFingerprint: `sha256:${"0".repeat(64)}`, sourceObservationKey: "forged", laps: [{ distanceMeters: 999 }], gps: [[37, 127]],
    }).activities[0]!
    expect(injected.observation).toEqual(clean)
    expect(JSON.stringify(injected)).not.toContain("private-sentinel")
    expect(injected.observation?.confirmation).toBeNull()
  })

  it("keeps format flags independent and disabled by default", () => {
    const source = format === "csv" ? csvOf(row) : JSON.stringify([row])
    expect(parseActivityFile(source).activities[0]?.observation).toBeUndefined()
    expect(parseActivityFile(source, "UTC", { observations: { gpx: true } }).activities[0]?.observation).toBeUndefined()
    expect(parse(row, false).activities[0]?.observation).toBeUndefined()
    expect(parse({ ...row, observation: true, observations: { [format]: true } }, false).activities[0]?.observation).toBeUndefined()
  })

  it("preserves local dates, retains valid offset instants and exposes conflicts", () => {
    const local = parse({ ...row, startedAt: "2026-09-19T08:00:00" })
    expect(local.activities[0]?.observation).toMatchObject({ date: row.date, startedAt: null, timeZone: null })
    expect(local.issues).toContainEqual({ code: "TIMEZONE_REQUIRED", activityIndex: 0, count: 1 })
    expect(parse({ ...row, startedAt: "2026-09-18T23:00:00Z", timeZone: "Asia/Seoul" }).activities[0]?.observation).toMatchObject({ startedAt: "2026-09-18T23:00:00Z", timeZone: "Asia/Seoul" })
    const conflict = parse({ ...row, startedAt: "2026-09-18T23:00:00Z", timeZone: "UTC" })
    expect(conflict.activities[0]?.observation).toMatchObject({ date: row.date, startedAt: null, distanceMeters: 5000.125 })
    expect(conflict.issues).toContainEqual({ code: "DATE_TIME_CONFLICT", activityIndex: 0, count: 1 })
    expect(parse({ ...row, date: "2026-02-30" }).skipped).toBe(1)
    const invalidZone = parse({ ...row, startedAt: "2026-09-19T08:00:00+09:00", timeZone: "private-sentinel" })
    expect(invalidZone.activities[0]?.observation).toMatchObject({ startedAt: "2026-09-19T08:00:00+09:00", timeZone: null })
    expect(invalidZone.issues).toContainEqual({ code: "INVALID_TIMEZONE", activityIndex: 0, count: 1 })
  })

  it("keeps source IDs separate from mutable values and rejects free-form IDs", () => {
    const original = parse({ ...row, sourceActivityId: "9007199254740993123456789" }).activities[0]?.observation
    const correction = parse({ ...row, sourceActivityId: "9007199254740993123456789", distanceKm: "6" }).activities[0]?.observation
    expect(original?.sourceActivityId).toBe("9007199254740993123456789")
    expect(correction?.sourceObservationKey).toBe(original?.sourceObservationKey)
    expect(correction?.contentRevisionFingerprint).not.toBe(original?.contentRevisionFingerprint)
    const invalid = parse({ ...row, sourceActivityId: "private sentinel notes" })
    expect(invalid.activities[0]?.observation?.sourceActivityId).toBeNull()
    expect(JSON.stringify(invalid)).not.toContain("private sentinel")
  })

  it("rejects unit-conversion overflow and preserves an independently valid metric", () => {
    const result = parse({ ...row, distanceKm: "1e308" })
    expect(result.activities[0]?.observation).toMatchObject({ distanceMeters: null, durationSeconds: 1500.75 })
    expect(result.issues?.[0]?.code).toBe("INVALID_DISTANCE")
  })

  it("does not guess alternative column names or units", () => {
    const result = parse({ date: row.date, distanceKm: "", durationMin: "1", distanceMiles: "5", distanceMeters: 5000, durationSeconds: 900 })
    expect(result.activities[0]?.observation).toMatchObject({ distanceMeters: null, durationSeconds: 60 })
  })
})

describe("CSV structure and bounded parsing", () => {
  it.each([
    ['date,distanceKm,distanceKm\n2026-09-19,5,6', "CSV_DUPLICATE_HEADER"],
    ['date,,distanceKm\n2026-09-19,ignored,5', "CSV_INVALID_HEADER"],
    ['date,name,distanceKm\n2026-09-19,"unfinished,5', "CSV_INVALID_QUOTES"],
    ['date,name,distanceKm\n2026-09-19,"closed"junk,5', "CSV_INVALID_QUOTES"],
    ['date,unused,distanceKm\n2026-09-19,a"b,5', "CSV_INVALID_QUOTES"],
  ])("rejects structural error with safe code %s", (source, code) => {
    expect(parseCsvActivities(source)?.issues).toEqual([{ code, activityIndex: null, count: 1 }])
  })

  it("reports short and long rows separately while keeping valid rows", () => {
    const result = parseCsvActivities("date,distanceKm,durationMin\n2026-09-19,5\n2026-09-19,5,10,extra\n2026-09-19,5,10", { observation: true })!
    expect(result.skipped).toBe(2)
    expect(result.activities).toHaveLength(1)
    expect(result.issues).toEqual([{ code: "CSV_COLUMN_COUNT", activityIndex: 0, count: 1 }, { code: "CSV_COLUMN_COUNT", activityIndex: 1, count: 1 }])
  })

  it("supports BOM, CRLF, quoted commas, escaped quotes and embedded newlines", () => {
    const source = '\uFEFFdate,name,distanceKm,durationMin\r\n2026-09-19,"first, ""quoted""\r\nsecond",5,10\r\n'
    const result = parseCsvActivities(source)!
    expect(result.activities[0]?.name).toBe('first, "quoted"\r\nsecond')
    expect(result.skipped).toBe(0)
    expect(parseCsvActivities(source, { observation: true })?.activities[0]?.observation?.distanceMeters).toBe(5000)
  })

  it("bounds logical rows before building a large result and enforces byte limits on direct calls", () => {
    const source = "date,name,distanceKm\n" + '2026-09-19,"two\nlines",5\n'.repeat(1000)
    expect(parseCsvActivities(source)?.activities).toHaveLength(1000)
    expect(parseCsvActivities(source + "2026-09-19,last,5")?.issues?.[0]?.code).toBe("ACTIVITY_LIMIT_EXCEEDED")
    expect(parseCsvActivities("\uAC00".repeat(Math.floor(FILE_OBSERVATION_LIMITS.bytes / 3) + 1))?.issues?.[0]?.code).toBe("FILE_TOO_LARGE")
  })
})

describe("JSON structure and bounded parsing", () => {
  it("reports malformed rows without dropping independent valid activities", () => {
    const result = parseJsonActivities(JSON.stringify({ activities: [row, false, null, { ...row, date: "bad" }, row] }), { observation: true })!
    expect(result.activities).toHaveLength(2)
    expect(result.skipped).toBe(3)
    expect(result.activities[0]?.observation).toEqual(result.activities[1]?.observation)
  })

  it("bounds arrays before JSON.parse, including escaped activities property names", () => {
    for (const source of ["[" + "null,".repeat(1000) + "null]", '{"activit\\u0069es":[' + "null,".repeat(1000) + "null]}"]) {
      const spy = vi.spyOn(JSON, "parse")
      const result = parseJsonActivities(source)
      expect(result?.issues?.[0]?.code).toBe("ACTIVITY_LIMIT_EXCEEDED")
      expect(spy.mock.calls.some(call => call[0] === source)).toBe(false)
      spy.mockRestore()
    }
    expect(parseJsonActivities(JSON.stringify(Array(1000).fill(row)))?.activities).toHaveLength(1000)
  })

  it("does not count nested JSON or escaped string delimiters as activity rows", () => {
    const result = parseJsonActivities(JSON.stringify([{ ...row, Notes: 'comma, quote" bracket] brace}', ignored: [1, 2, 3] }]))
    expect(result?.activities).toHaveLength(1)
    expect(parseJsonActivities('{"activities": [}')?.issues?.[0]?.code).toBe("INVALID_FILE")
    expect(parseJsonActivities("[]")?.issues?.[0]?.code).toBe("NO_MEASUREMENTS")
  })

  it("handles invalid numeric types, unsafe numeric IDs and forbidden annotations independently", () => {
    const result = parseJsonActivities(JSON.stringify([{ ...row, distanceKm: true, sourceActivityId: 9007199254740992 }]), { observation: true })!
    expect(result.activities[0]?.observation).toMatchObject({ distanceMeters: null, sourceActivityId: null, durationSeconds: 1500.75 })
    expect(result.issues).toContainEqual({ code: "INVALID_DISTANCE", activityIndex: 0, count: 1 })
    expect(result.issues).toContainEqual({ code: "INVALID_SOURCE_ID", activityIndex: 0, count: 1 })
    expect(parseJsonActivities(" ".repeat(FILE_OBSERVATION_LIMITS.bytes + 1))?.issues?.[0]?.code).toBe("FILE_TOO_LARGE")
  })
})
