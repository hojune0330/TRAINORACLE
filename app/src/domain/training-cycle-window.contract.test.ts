import { describe, expect, it } from "vitest"
import { trainingCycleWindow } from "./training-cycle-window"

describe("9.5-day journal windows", () => {
  it("alternates 10-day and 9-day windows around an explicit athlete anchor", () => {
    expect(trainingCycleWindow("2026-08-01", 0)).toEqual({
      start: "2026-08-01",
      end: "2026-08-10",
      lengthDays: 10,
      index: 0,
    })
    expect(trainingCycleWindow("2026-08-01", 1)).toMatchObject({ start: "2026-08-11", end: "2026-08-19", lengthDays: 9 })
    expect(trainingCycleWindow("2026-08-01", 2)).toMatchObject({ start: "2026-08-20", end: "2026-08-29", lengthDays: 10 })
    expect(trainingCycleWindow("2026-08-01", -1)).toMatchObject({ start: "2026-07-23", end: "2026-07-31", lengthDays: 9 })
  })
})
