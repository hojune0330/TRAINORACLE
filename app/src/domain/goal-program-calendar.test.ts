import { describe, expect, it } from "vitest"
import { isTenKGoalMinutes, projectGoalProgramDays, resolveGoalProgramWindow, TEN_K_GOAL_MINUTES, tenKGoalPaceLabel } from "./goal-program-calendar"

const readyWindow = (startDate = "2026-10-11") => {
  const result = resolveGoalProgramWindow({ kind: "START", startDate }, startDate)
  if (result.kind !== "ready") throw new Error("fixture")
  return result.window
}
// Calendar-only synthetic data: not a reviewed training program or activation fixture.
const entries = () => Array.from({ length: 29 }, (_, day) => ({ halfDayOffset: day * 2, content: { kind: "synthetic" } }))

describe("goal-only program calendar", () => {
  it("offers all five goals without creating an ability record", () => {
    expect(TEN_K_GOAL_MINUTES).toEqual([60, 50, 45, 40, 30])
    expect(TEN_K_GOAL_MINUTES.map(tenKGoalPaceLabel)).toEqual(["6분/km", "5분/km", "4분 30초/km", "4분/km", "3분/km"])
    expect(isTenKGoalMinutes(30)).toBe(true)
    expect(isTenKGoalMinutes("30")).toBe(false)
    expect(isTenKGoalMinutes(35)).toBe(false)
  })
  it("uses 57 half days and does not round each cycle up to ten days", () => {
    const window = readyWindow()
    expect(window.halfDays).toHaveLength(57)
    expect([1, 2, 3].map(c => window.halfDays.filter(s => s.cycle === c).length)).toEqual([19, 19, 19])
    expect(window.halfDays[18]).toMatchObject({ date: "2026-10-20", slot: "AM", cycle: 1 })
    expect(window.halfDays[19]).toMatchObject({ date: "2026-10-20", slot: "PM", cycle: 2 })
    expect(window.halfDays[38]).toMatchObject({ date: "2026-10-30", slot: "AM", cycle: 3 })
    expect(window.endDate).toBe("2026-11-08")
  })
  it.each([
    ["2026-12-20", "2027-01-17"], ["2028-02-01", "2028-02-29"], ["2027-02-01", "2027-03-01"],
    ["2026-03-01", "2026-03-29"], ["2026-10-20", "2026-11-17"],
  ])("preserves civil dates from %s through %s", (start, end) => {
    expect(readyWindow(start).endDate).toBe(end)
    expect(resolveGoalProgramWindow({ kind: "DEADLINE", deadline: end }, start)).toMatchObject({
      kind: "ready", window: { startDate: start, endDate: end, deadline: end },
    })
  })
  it("does not compress a close deadline or silently move it", () => {
    expect(resolveGoalProgramWindow({ kind: "DEADLINE", deadline: "2026-10-20" }, "2026-10-11"))
      .toEqual({ kind: "start-in-past", requiredStartDate: "2026-09-22", suggestedStartDate: "2026-10-11" })
  })
  it.each(["2026-02-30", "bad", "2026-1-01"])("rejects invalid date %s", date => {
    expect(resolveGoalProgramWindow({ kind: "START", startDate: date }, "2026-10-11")).toEqual({ kind: "invalid-date" })
  })
  it("projects explicit entries without losing cycle identity or inventing rest", () => {
    const result = projectGoalProgramDays(readyWindow(), entries())
    expect(result.kind).toBe("ready")
    if (result.kind !== "ready") throw new Error("fixture")
    expect(result.days).toHaveLength(29)
    expect(result.days[9]).toMatchObject({ date: "2026-10-20", cycle: 1 })
    expect(result.days[10]).toMatchObject({ date: "2026-10-21", cycle: 2 })
    expect(result.days[28]).toMatchObject({ date: "2026-11-08", cycle: 3 })
    expect(projectGoalProgramDays(readyWindow(), entries().slice(1))).toEqual({ kind: "invalid-program", reason: "MISSING_DATE" })
  })
  it("rejects workouts on both sides of a shared calendar date", () => {
    expect(projectGoalProgramDays(readyWindow(), [...entries(), { halfDayOffset: 19, content: { kind: "synthetic" } }]))
      .toEqual({ kind: "invalid-program", reason: "DUPLICATE_DATE" })
  })
  it("allows reviewed PM placement without enforcing morning intensity", () => {
    const source = entries().map(e => ({ ...e, halfDayOffset: e.halfDayOffset === 18 ? 19 : e.halfDayOffset }))
    expect(projectGoalProgramDays(readyWindow(), source)).toMatchObject({ kind: "ready" })
  })
  it.each([-1, 57, 1.5, NaN])("rejects out-of-frame offset %s", halfDayOffset => {
    expect(projectGoalProgramDays(readyWindow(), [{ halfDayOffset, content: null }]))
      .toEqual({ kind: "invalid-program", reason: "INVALID_OFFSET" })
  })
})
