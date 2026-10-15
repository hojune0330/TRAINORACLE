import { describe, expect, it } from "vitest"
import { newTreadmillRun } from "../../domain/minigame/treadmill"
import { createRunnerCamera } from "./camera"
const run = { ...newTreadmillRun(), mode: "running" as const, running: true, countdown: 0 }

describe("runner camera", () => {
  it("smooths exhaustion recoil instead of snapping the shared projection", () => {
    const camera = createRunnerCamera()
    const before = camera({ ...run, x: .7 }, 390, 700, false)
    const after = camera({ ...run, x: .35, exhausted: true, seconds: 1 / 60 }, 390, 700, false)
    expect(Math.abs(after.toPx(.8) - before.toPx(.8))).toBeLessThan(390 * .09)
    expect(after.offset).toBeLessThan(before.offset)
  })
  it("retains visible runner movement during tracking and projects hazards at the same scale", () => {
    const camera = createRunnerCamera()
    const first = camera(run, 360, 600, false)
    const moved = camera({ ...run, x: 0.56, seconds: 0.05 }, 360, 600, false)
    expect(moved.offset).toBeGreaterThan(first.offset)
    const displacement = moved.toPx(0.56) - first.toPx(run.x)
    expect(displacement).toBeGreaterThan(2)
    expect(displacement).toBeLessThan(0.06 * moved.beltWidth - 2)
    expect(moved.toPx(0.66) - moved.toPx(0.56)).toBeCloseTo(0.1 * moved.beltWidth)
    expect(moved.floor).toBeLessThan(600 * 0.82)
  })
  it("shows backward displacement immediately after release instead of pinning the runner", () => {
    const camera = createRunnerCamera()
    const before = camera(run, 390, 700, false)
    let after = before
    for (let i = 1; i <= 120; i++) after = camera({ ...run, running: false, x: .5 - .07 * i / 60, seconds: i / 60 }, 390, 700, false)
    expect(after.toPx(.36)).toBeLessThan(before.toPx(.5) - 45)
    expect(after.toPx(.36)).toBeGreaterThan(0)
    for (let i = 121; i <= 360; i++) after = camera({ ...run, running: false, x: .5 - .07 * i / 60, seconds: i / 60 }, 390, 700, false)
    expect(after.toPx(.06)).toBeGreaterThan(0)
    expect(after.toPx(.08)).toBeLessThan(50)
  })
  it("accelerates scenery on dash and freezes the camera and travel on pause", () => {
    const camera = createRunnerCamera()
    camera(run, 360, 600, false)
    let frame = camera(run, 360, 600, false)
    for (let i = 1; i <= 30; i++) frame = camera({ ...run, seconds: i / 60 }, 360, 600, false)
    const speed = frame.speed, travel = frame.travel
    for (let i = 31; i <= 50; i++) frame = camera({ ...run, seconds: i / 60, dashLeft: 0.3 }, 360, 600, false)
    expect(frame.speed).toBeGreaterThan(speed * 1.8)
    expect(frame.travel).toBeGreaterThan(travel)
    const paused = camera({ ...run, mode: "paused", seconds: 50 / 60 }, 360, 600, false)
    expect(paused.travel).toBe(frame.travel)
    expect(paused.offset).toBe(frame.offset)
    expect(paused.floor).toBe(frame.floor)
  })
  it("keeps the rear boundary visible, resets on a new run and disables extra motion when reduced", () => {
    const camera = createRunnerCamera()
    camera(run, 360, 600, false)
    let frame = camera(run, 360, 600, false)
    for (let i = 1; i <= 120; i++) frame = camera({ ...run, x: 0.07, seconds: i / 60 }, 360, 600, false)
    expect(frame.toPx(0.07)).toBeGreaterThan(0)
    expect(frame.toPx(0.07)).toBeLessThan(40)
    const reduced = camera({ ...run, y: 90, seconds: 3, dashLeft: 0.3 }, 360, 600, true)
    expect(reduced.travel).toBe(0)
    expect(reduced.offset).toBe(0)
    expect(reduced.floor).toBeCloseTo(474)
    const reset = camera(run, 360, 600, false)
    expect(reset.travel).toBe(0)
    expect(reset.toPx(run.x)).toBeCloseTo(144)
  })
})
