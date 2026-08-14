import { describe, expect, it } from "vitest"
import type { PlanSession } from "@impl/plan-generator/types"
import { twoADayTrainingDayCount } from "./labels"

function session(day: number, slot: PlanSession["slot"]): PlanSession {
  return {
    day,
    slot,
    role: "EASY",
    plannedEnergyIntent: "BASE_INTENT",
    prescription: {
      kind: "RPE_TIME_RANGE",
      rpe: { minimum: 3, maximum: 4 },
      durationMinutes: { minimum: 30, maximum: 45 },
    },
  }
}

function restSession(day: number, slot: PlanSession["slot"]): PlanSession {
  return {
    day,
    slot,
    role: "REST",
    plannedEnergyIntent: "RECOVERY_INTENT",
    prescription: { kind: "REST" },
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
      restSession(4, "AM"),
      session(4, "PM"),
    ])).toBe(0)
  })
})
