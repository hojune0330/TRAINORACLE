import { describe, expect, it } from "vitest"
import { calendarMarksDescription, journalCalendarMarks, plannedCalendarTone } from "./calendar-training-presentation"
import type { PostSessionEntry, RaceEntry } from "./journal-schema"

function post(overrides: Partial<PostSessionEntry> = {}): PostSessionEntry {
  return { id: "synthetic", kind: "post-session", date: "2026-09-30", savedAt: "2026-09-30T00:00:00Z",
    syncState: "local", system: "base", title: "", distanceKm: "", durationMin: "", avgPace: "", rpe: 0, memo: "", ...overrides }
}

describe("calendar role presentation, never prescription or intensity inference", () => {
  it.each([
    ["QUALITY", "ATP_PC_INTENT", "main"], ["QUALITY", "BASE_INTENT", "main"],
    ["EASY", "RECOVERY_INTENT", "recovery"], ["EASY", "BASE_INTENT", "base"],
    ["REST", "RECOVERY_INTENT", "off"], ["UNKNOWN", "RECOVERY_INTENT", "unknown"],
    ["EASY", "GLY_INTENT", "unknown"], ["MAIN", undefined, "main"],
    ["BASE", undefined, "base"], ["REC", undefined, "recovery"], ["OFF", undefined, "off"],
    ["OTHER", undefined, "unknown"],
  ])("%s + %s reads the existing role as %s", (role, plannedEnergyIntent, expected) => {
    expect(plannedCalendarTone({ role, plannedEnergyIntent })).toBe(expected)
  })

  it("does not color a legacy or derived default BASE as known basic exercise", () => {
    expect(journalCalendarMarks(post())).toEqual([{ tone: "unknown", label: "훈련", slot: undefined }])
    for (const provenance of ["MISSING", "DERIVED"] as const) {
      const system = provenance === "MISSING" ? { provenance } : { provenance, derivationRuleId: "unknown", derivedFrom: ["rpe"] }
      expect(journalCalendarMarks(post({ fieldProvenance: { system } }))[0]?.tone).toBe("unknown")
    }
    expect(journalCalendarMarks(post({ fieldProvenance: { system: { provenance: "EXPLICIT" } } }))[0]?.tone).toBe("base")
  })

  it("does not treat ATP-PC, high RPE, or a title as neural or MAIN", () => {
    for (const system of ["atp", "lt", "vo2", "gly", "mixed"]) {
      const marks = journalCalendarMarks(post({ system, rpe: 10, title: "플라이오 MAIN", fieldProvenance: { system: { provenance: "EXPLICIT" } } }))
      expect(marks[0]?.tone).toBe("unknown")
    }
  })

  it("preserves a mixed plyometric component without turning the whole session into neural work", () => {
    const marks = journalCalendarMarks(post({ activitySlot: "PM", system: "base", fieldProvenance: { system: { provenance: "EXPLICIT" } },
      exerciseLog: { version: 1, source: "SELF_REPORTED", components: [
        { id: "p", kind: "PLYOMETRIC", name: "", rows: [] }, { id: "r", kind: "RUNNING", name: "", rows: [] },
      ] } }))
    expect(marks).toEqual([{ tone: "base", label: "기본", slot: "오후", componentCue: "플라이오 포함" }])
    expect(calendarMarksDescription(marks)).toBe("오후 기본 플라이오 포함")
  })

  it("keeps mixed activities without a whole-record source neutral and grouped once", () => {
    const entry = post({ exerciseLog: { version: 1, source: "SELF_REPORTED", components: [
      { id: "p", kind: "PLYOMETRIC", name: "", rows: [] }, { id: "s", kind: "STRENGTH", name: "", rows: [] },
    ] } })
    expect(journalCalendarMarks(entry)).toEqual([{ tone: "unknown", label: "훈련", slot: undefined, componentCue: "플라이오 포함" }])
  })

  it("keeps actual rest, skipped, and explicit recovery different", () => {
    expect(journalCalendarMarks(post({ activityOutcome: "RESTED" }))[0]?.tone).toBe("off")
    expect(journalCalendarMarks(post({ activityOutcome: "SKIPPED" }))[0]).toEqual({ tone: "unknown", label: "건너뜀" })
    expect(journalCalendarMarks(post({ system: "rest", fieldProvenance: { system: { provenance: "EXPLICIT" } } }))[0]?.tone).toBe("recovery")
    expect(journalCalendarMarks(post({ system: "rest" }))[0]?.tone).toBe("unknown")
  })

  it("supports explicit older structured plyometrics without accepting missing provenance", () => {
    const entry = post({ intensityAssessment: { schemaVersion: 1, objectiveComponents: [
      { componentId: "p", kind: "PLYOMETRIC", exerciseType: "점프", contacts: 12 },
    ] } })
    expect(journalCalendarMarks(entry)[0]?.tone).toBe("unknown")
    expect(journalCalendarMarks({ ...entry, fieldProvenance: { objectiveComponents: { provenance: "EXPLICIT" } } })[0]?.tone).toBe("neural")
  })

  it("reads neither private content, health fields, nor the linked plan to color actual entries", () => {
    const entry = post()
    for (const field of ["memo", "title", "painParts", "plannedSessionLink", "intensityAssessment"]) {
      Object.defineProperty(entry, field, { get() { throw new Error(`Forbidden read ${field}`) } })
    }
    expect(journalCalendarMarks(entry)[0]?.tone).toBe("unknown")
    expect(calendarMarksDescription([{ tone: "main", label: "주요", slot: "오전" }, { tone: "recovery", label: "회복", slot: "오후" }]))
      .toBe("오전 주요 · 오후 회복")
  })

  it("keeps race preparation distinct from results and does not invent a time slot", () => {
    const race: RaceEntry = { id: "race", kind: "race", date: "2026-09-30", savedAt: "2026-09-30T06:00:00Z",
      syncState: "local", stage: "pre", record: "", rank: "", result: "", memo: "" }
    expect(journalCalendarMarks(race)).toEqual([{ tone: "race", label: "경기 전" }])
    expect(journalCalendarMarks({ ...race, stage: "post" })).toEqual([{ tone: "race", label: "경기 결과" }])
  })
})
