import { describe, expect, it } from "vitest"
import { connectedWeeklyFacts } from "./connected-weekly-facts"
import type { PostSessionEntry } from "./journal-schema"
import { buildFileObservation, type FileObservationInput } from "./import/file-observation"

const today = "2026-11-11"
const entry = (id: string, date = today, extra: Partial<PostSessionEntry> = {}): PostSessionEntry => ({
  id, date, savedAt: date + "T12:00:00Z", syncState: "local", kind: "post-session",
  system: "", title: "", distanceKm: "5", durationMin: "30", avgPace: "", rpe: 0, memo: "",
  fieldProvenance: { distanceKm: { provenance: "EXPLICIT" }, durationMin: { provenance: "EXPLICIT" } }, ...extra,
})
const fileEntry = (id: string, extra: Partial<FileObservationInput> = {}) => entry(id, today, {
  distanceKm: "", durationMin: "", fieldProvenance: {},
  fileObservation: buildFileObservation({ format: "tcx", sourceProfile: "TCX_ACTIVITY_V1", parserVersion: "v1",
    sourceActivityId: id, date: today, startedAt: null, timeZone: null, sport: "RUNNING",
    distanceMeters: 5000, durationSeconds: 1800, durationMeaning: "TIMER",
    laps: [{ sourceIndex: 0, kind: "UNKNOWN", distanceMeters: extra.distanceMeters ?? 5000, durationSeconds: extra.durationSeconds ?? 1800, durationMeaning: extra.durationMeaning ?? "TIMER" }],
    confirmation: { sport: null, durationMeaning: null }, ...extra }),
})
describe("weekly connected facts", () => {
  it("compares equal local-date week portions and excludes rest, future, invalid and note-only records", () => {
    const records = [entry("current"), entry("previous", "2026-11-04"), entry("previous-later", "2026-11-05"),
      entry("future", "2026-11-12"), entry("invalid", "2026-11-31"), entry("rest", today, { activityOutcome: "RESTED" }),
      entry("skip", today, { activityOutcome: "SKIPPED" }), entry("note", today, { distanceKm: "", durationMin: "", memo: "PRIVATE_MARKER" })]
    const facts = connectedWeeklyFacts(records, today)!
    expect([facts.current.start, facts.current.end, facts.previous.start, facts.previous.end]).toEqual(["2026-11-09", today, "2026-11-02", "2026-11-04"])
    expect(facts.current.records.map(value => value.id)).toEqual(["current"])
    expect(facts.previous.records.map(value => value.id)).toEqual(["previous"])
    expect(facts.current.groups[0]?.distanceKm).toBe(5)
    expect(facts.current.excludedTime).toBe(1)
    expect(JSON.stringify(facts)).not.toContain("PRIVATE_MARKER")
    expect(connectedWeeklyFacts(records, "2026-13-01")).toBeNull()
  })
  it("does not turn missing or imported numeric strings into eligible distance or time", () => {
    const facts = connectedWeeklyFacts([entry("unverified", today, { fieldProvenance: {} }),
      entry("performed", today, { activityOutcome: "COMPLETED", distanceKm: "", durationMin: "" })], today)!
    expect(facts.current.records).toHaveLength(2)
    expect(facts.current.groups).toEqual([])
    expect(facts.current.excludedDistance).toBe(2)
    expect(facts.current.excludedTime).toBe(2)
  })
  it("requires current account confirmation and enabled file format for comparative values", () => {
    const source = fileEntry("file")
    const closed = connectedWeeklyFacts([source], today, { formats: ["tcx"], confirmedFileEntries: [] })!
    expect(closed.current.groups).toEqual([])
    const disabled = connectedWeeklyFacts([source], today, { formats: [], confirmedFileEntries: [source] })!
    expect(disabled.current.groups).toEqual([])
    const ready = connectedWeeklyFacts([source], today, { formats: ["tcx"], confirmedFileEntries: [source] })!
    expect(ready.current.groups[0]).toMatchObject({ id: "RUNNING", distanceKm: 5, distanceSamples: 1, times: [{ clock: "TIMER", seconds: 1800, samples: 1 }] })
  })
  it("separates sport and TIMER/MOVING/ELAPSED and keeps unknown clocks out of totals", () => {
    const records = [fileEntry("timer"), fileEntry("moving", { durationMeaning: "MOVING", durationSeconds: 1200 }),
      fileEntry("elapsed", { durationMeaning: "ELAPSED", durationSeconds: 2000 }),
      fileEntry("unknown", { durationMeaning: "UNKNOWN", durationSeconds: 9999 }),
      fileEntry("cycle", { sport: "CYCLING", durationSeconds: 3000 })]
    const facts = connectedWeeklyFacts(records, today, { formats: ["tcx"], confirmedFileEntries: records })!
    expect(facts.current.groups.find(group => group.id === "RUNNING")?.times).toEqual([
      { clock: "TIMER", seconds: 1800, samples: 1 }, { clock: "MOVING", seconds: 1200, samples: 1 }, { clock: "ELAPSED", seconds: 2000, samples: 1 },
    ])
    expect(facts.current.groups.find(group => group.id === "CYCLING")?.times).toEqual([{ clock: "TIMER", seconds: 3000, samples: 1 }])
    expect(facts.current.excludedTime).toBe(1)
  })
  it("preserves a real file zero but does not create a zero for a missing period", () => {
    const source = fileEntry("zero", { distanceMeters: 0, durationSeconds: 0 })
    const facts = connectedWeeklyFacts([source], today, { formats: ["tcx"], confirmedFileEntries: [source] })!
    expect(facts.current.groups[0]?.distanceKm).toBe(0)
    expect(facts.previous.groups).toEqual([])
  })
  it("counts identical IDs once and excludes conflicting copies before window filtering", () => {
    const source = entry("same")
    const same = connectedWeeklyFacts([source, { ...source, memo: "DIFFERENT_PRIVATE_MEMO" }], today)!
    expect(same.current.records).toHaveLength(1)
    expect(same.current.duplicateCopies).toBe(1)
    const conflict = connectedWeeklyFacts([source, { ...source, date: "2026-11-20" }], today)!
    expect(conflict.current.records).toHaveLength(0)
    expect(conflict.current.conflictingIds).toBe(1)
    expect(conflict.current.groups).toEqual([])
  })
})

it("keeps the exact file source count aligned with distance across journal copies", () => {
  const original = fileEntry("original"), copy = { ...original, id: "copy" }
  const records = [original, copy]
  const facts = connectedWeeklyFacts(records, today, { formats: ["tcx"], confirmedFileEntries: records })!
  expect(facts.current.records).toHaveLength(1)
  expect(facts.current.groups[0]).toMatchObject({ distanceKm: 5, distanceSamples: 1 })
  expect(facts.current.excludedDistance).toBe(0)
  expect(facts.current.duplicateCopies).toBe(1)
  const changed = fileEntry("original", { distanceMeters: 9000 })
  const conflict = connectedWeeklyFacts([original, { ...changed, id: "changed" }], today,
    { formats: ["tcx"], confirmedFileEntries: [original, changed] })!
  expect(conflict.current.records).toEqual([])
  expect(conflict.current.groups).toEqual([])
  expect(conflict.current.conflictingIds).toBe(1)
})
it("keeps similar workouts with different source identities separate", () => {
  const records = [fileEntry("one"), fileEntry("two")]
  const facts = connectedWeeklyFacts(records, today, { formats: ["tcx"], confirmedFileEntries: records })!
  expect(facts.current.records).toHaveLength(2)
  expect(facts.current.groups[0]).toMatchObject({ distanceKm: 10, distanceSamples: 2 })
  expect(facts.current.duplicateCopies).toBe(0)
})
