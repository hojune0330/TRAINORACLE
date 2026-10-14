import { describe, expect, it } from "vitest"
import { advanceTreadmill, newTreadmillRun, TREADMILL_RULES } from "../../domain/minigame/treadmill"
import type { TreadmillState } from "../../domain/minigame/treadmill"
import { createRunnerCamera } from "./camera"
import { presentedHazards } from "./hazard-view"

const stages = [{ ...newTreadmillRun().stages[0]!, course: [{ at: 6, kind: "barrier" as const }] }]
const run = { ...newTreadmillRun(stages), mode: "running" as const, running: true, countdown: 0, x: 0.88 }

describe("hazard presentation continuity", () => {
  it.each([360, 900])("enters from the right edge before activation at viewport width %i", width => {
    const camera = createRunnerCamera()
    let firstX: number | undefined
    for (let seconds = 1; seconds < 6; seconds += 1 / 120) {
      const state = { ...run, seconds }
      const frame = camera(state, width, 600, false)
      const hazard = presentedHazards(state)[0]!
      const x = frame.toPx(hazard.x)
      if (x <= width && firstX === undefined) firstX = x
      // An approaching sprite is visible while there are still no collidable hazards.
      if (seconds > 5.9) { expect(x).toBeLessThan(width * 0.8); expect(state.hazards).toHaveLength(0) }
    }
    expect(firstX).toBeGreaterThan(width - 4)
    expect(firstX).toBeLessThanOrEqual(width)
  })
  it("activates once without a position jump and leaves simulation and saved state untouched", () => {
    let state: TreadmillState = { ...run, seconds: 5.995 }
    const before = JSON.stringify(state)
    const preview = presentedHazards(state)[0]!
    expect(preview.scheduled).toBe(true)
    expect(JSON.stringify(state)).toBe(before)
    state = advanceTreadmill(state, 1 / 120)
    const visible = presentedHazards(state)
    expect(visible).toHaveLength(1)
    expect(visible[0]!.id).toBe(preview.id)
    expect(visible[0]!.scheduled).toBe(false)
    // The unchanged engine activates on a substep; continuity within two substeps.
    expect(preview.x - visible[0]!.x).toBeGreaterThan(0)
    expect(preview.x - visible[0]!.x).toBeLessThan(TREADMILL_RULES.hazardSpeed / 60)
  })
  it("freezes previews on pause and follows the current stage after restore or restart", () => {
    const state = { ...run, seconds: 5 }
    const paused = { ...state, mode: "paused" as const }
    expect(presentedHazards(advanceTreadmill(paused, 1))).toEqual(presentedHazards(paused))
    expect(presentedHazards(JSON.parse(JSON.stringify(state)))).toEqual(presentedHazards(state))
    expect(presentedHazards(newTreadmillRun(stages))[0]!.x).toBeGreaterThan(2)
  })
})
