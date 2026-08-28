import { describe, expect, it } from "vitest"
import {
  advancePeriodizationContext,
  createInitialPeriodizationContext,
  periodizationContextSchema,
  periodizationPhaseFor,
} from "./periodization-lineage"

describe("periodization lineage contract", () => {
  it("starts a new plan at frame one without creating a load increase", () => {
    const context = createInitialPeriodizationContext(
      "opaque-plan-candidate",
      "2026-08-28T00:00:00.000Z",
    )
    expect(context).toMatchObject({
      macrocycleOrdinal: 1,
      frameOrdinal: 1,
      mesocycleOrdinal: 1,
      phase: "BASE",
      frameLengthDays: 9.5,
      targetFrameCount: 18,
      source: "NEW_PLAN",
    })
    expect(context).not.toHaveProperty("intensity")
    expect(context).not.toHaveProperty("volume")
    expect(context).not.toHaveProperty("frequency")
  })

  it("advances only when a successor frame is activated", () => {
    const initial = createInitialPeriodizationContext(
      "opaque-plan-candidate",
      "2026-08-28T00:00:00.000Z",
    )!
    const second = advancePeriodizationContext(initial, "2026-09-06T12:00:00.000Z")!
    const third = advancePeriodizationContext(second, "2026-09-16T00:00:00.000Z")!
    const fourth = advancePeriodizationContext(third, "2026-09-25T12:00:00.000Z")!
    expect(second.frameOrdinal).toBe(2)
    expect(third.mesocycleOrdinal).toBe(1)
    expect(fourth).toMatchObject({ frameOrdinal: 4, mesocycleOrdinal: 2, phase: "BASE" })
    expect(fourth.programLineageId).toBe(initial.programLineageId)
  })

  it("maps the owner direction without claiming biological superiority", () => {
    expect([1, 6].map(periodizationPhaseFor)).toEqual(["BASE", "BASE"])
    expect([7, 11].map(periodizationPhaseFor)).toEqual(["DEVELOPMENT", "DEVELOPMENT"])
    expect([12, 16].map(periodizationPhaseFor)).toEqual(["COMPETITION_SPECIFIC", "COMPETITION_SPECIFIC"])
    expect([17, 18].map(periodizationPhaseFor)).toEqual(["TAPER_PEAK", "TAPER_PEAK"])
  })

  it("starts the next macrocycle after frame 18 and rejects forged positions", () => {
    let context = createInitialPeriodizationContext(
      "opaque-plan-candidate",
      "2026-08-28T00:00:00.000Z",
    )!
    for (let frame = 2; frame <= 18; frame += 1) {
      context = advancePeriodizationContext(
        context,
        new Date(Date.parse(context.frameStartedAt) + 9.5 * 24 * 60 * 60 * 1_000).toISOString(),
      )!
    }
    expect(context).toMatchObject({ macrocycleOrdinal: 1, frameOrdinal: 18, phase: "TAPER_PEAK" })
    const next = advancePeriodizationContext(
      context,
      new Date(Date.parse(context.frameStartedAt) + 9.5 * 24 * 60 * 60 * 1_000).toISOString(),
    )!
    expect(next).toMatchObject({ macrocycleOrdinal: 2, frameOrdinal: 1, mesocycleOrdinal: 1, phase: "BASE" })
    expect(next.programLineageId).toBe(context.programLineageId)
    expect(periodizationContextSchema.safeParse({ ...next, mesocycleOrdinal: 2 }).success).toBe(false)
    expect(periodizationContextSchema.safeParse({ ...next, phase: "TAPER_PEAK" }).success).toBe(false)
  })
})
