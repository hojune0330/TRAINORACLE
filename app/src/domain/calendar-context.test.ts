import { describe, expect, it } from "vitest"
import { calendarCycleIndex, calendarEntriesByDate, calendarReadiness, calendarRecordDates, nearestCalendarDate, planCalendarDate, recentCalendarDate } from "./calendar-context"
import { trainingCycleWindow } from "./training-cycle-window"
import { isoShift } from "./dates"

describe("calendar navigation decisions, never training decisions", () => {
  it("indexes 10,000 entries once without changing or rereading them for calendar cells", () => {
    let reads = 0
    const entries = Array.from({ length: 10_000 }, (_, index) => Object.freeze({ id: index,
      get date() { reads++; return index % 2 ? "2026-09-29" : "2026-09-30" },
    }))
    const byDate = calendarEntriesByDate(entries)
    expect(reads).toBe(10_000)
    for (let pass = 0; pass < 42; pass++) expect(byDate.get("2026-09-30")).toHaveLength(5_000)
    expect(reads).toBe(10_000)
    expect(byDate.get("2026-09-30")![0]).toBe(entries[0])
    expect(calendarEntriesByDate([{ date: "2026-02-30" }]).size).toBe(0)
  })
  it("uses activity date, excludes invalid dates, and never prefers future entries", () => {
    const dates = calendarRecordDates([{ date: "2026-07-01" }, { date: "2026-07-01" }, { date: "2026-08-03" }, { date: "2026-10-01" }, { date: "2026-02-30" }])
    expect(dates).toEqual(["2026-07-01", "2026-08-03", "2026-10-01"])
    expect(recentCalendarDate(dates, "2026-09-30")).toBe("2026-08-03")
    expect(recentCalendarDate(["2026-10-01"], "2026-09-30")).toBeNull()
    expect(nearestCalendarDate(["2026-08-01", "2026-08-03"], "2026-08-02")).toBe("2026-08-01")
  })
  it.each([
    ["2026-09-20", false, "2026-09-30"], ["2026-10-03", false, "2026-10-03"],
    ["2026-11-01", false, "2026-10-08"], ["2026-10-03", true, "2026-09-30"],
  ])("clamps saved plan context without seeking only exercise days (%s)", (today, candidate, expected) => {
    expect(planCalendarDate("2026-09-30", 9, today, candidate)).toBe(expected)
  })
  it("inverts every day in positive and negative 10/9 windows", () => {
    for (let index = -40; index <= 40; index++) {
      const window = trainingCycleWindow("2026-09-30", index)
      for (let day = 0; day < window.lengthDays; day++) expect(calendarCycleIndex("2026-09-30", isoShift(window.start, day))).toBe(index)
    }
  })
  it.each([
    [true, false, null, "RESOLVING", "IDLE", 0, "READY"],
    [true, true, null, "RESOLVING", "IDLE", 0, "LOADING"],
    [true, true, null, "GUEST", "IDLE", 0, "READY"],
    [true, true, "a", "ACCOUNT", "READY", 0, "READY"],
    [true, true, "a", "ACCOUNT", "LOADING", 0, "LOADING"],
    [true, true, "a", "ACCOUNT", "FAILED", 0, "ERROR"],
    [true, true, "a", "ACCOUNT", "FAILED", 1, "STALE"],
    [false, false, null, "GUEST", "IDLE", 0, "ERROR"],
  ])("does not confuse readiness with empty data", (localComplete, accountEnabled, owner, auth, online, entryCount, expected) => {
    expect(calendarReadiness({ localComplete, accountEnabled, owner, auth, online, entryCount })).toBe(expected)
  })
})
