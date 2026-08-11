import { describe, expect, it } from "vitest"
import type { PlanSession } from "@impl/plan-generator/types"
import { twoADayTrainingDayCount } from "./labels"

function session(
  day: number,
  slot: PlanSession["slot"],
  role: PlanSession["role"] = "EASY",
): PlanSession {
  return {
    day,
    slot,
    role,
    plannedEnergyIntent: "BASE_INTENT",
    prescription: {
      kind: "RPE_TIME_RANGE",
      rpe: { minimum: 3, maximum: 4 },
      durationMinutes: { minimum: 30, maximum: 45 },
    },
  }
}

describe("two-a-day plan summary", () => {
  it("does not count a single evening session as two-a-day training", () => {
    expect(twoADayTrainingDayCount([session(4, "PM")])).toBe(0)
  })

  it("counts dates with two non-rest sessions, not afternoon slots", () => {
    expect(twoADayTrainingDayCount([
      session(4, "AM"),
      session(4, "PM"),
      session(7, "PM"),
    ])).toBe(1)
  })

  it("does not count a rest slot as the second training session", () => {
    expect(twoADayTrainingDayCount([
      session(4, "AM", "REST"),
      session(4, "PM"),
    ])).toBe(0)
  })
})
