import { describe, expect, it } from "vitest"
import { advanceTreadmill, newTreadmillRun, treadmillCommand, TREADMILL_RULES } from "./treadmill"
import type { TreadmillState } from "./treadmill"

function advance(state: TreadmillState, seconds: number): TreadmillState {
  let next = state
  for (let left = seconds; left > 0.000001; left -= 0.05) next = advanceTreadmill(next, Math.min(left, 0.05))
  return next
}
const start = () => treadmillCommand(newTreadmillRun(), { type: "start" })

describe("treadmill survival rules", () => {
  it("falls without action and stops simulating after failure", () => {
    const state = advance(start(), 8)
    expect(state.mode).toBe("over")
    expect(state.message).toContain("떨어")
    expect(advance(state, 2)).toEqual(state)
  })
  it("buys front space while running and spends it to recover", () => {
    const original = start()
    const running = advance(treadmillCommand(original, { type: "run", held: true }), 1)
    expect(running.x).toBeGreaterThan(original.x)
    expect(running.energy).toBeLessThan(original.energy)
    const resting = advance(treadmillCommand(running, { type: "run", held: false }), 0.5)
    expect(resting.x).toBeLessThan(running.x)
    expect(resting.energy).toBeGreaterThan(running.energy)
    expect(resting.energy).toBeLessThanOrEqual(TREADMILL_RULES.maxEnergy)
  })
  it("requires release to recover an exhausted held run", () => {
    const state = advance({ ...start(), energy: 0, running: true }, 0.5)
    expect(state.energy).toBe(0)
    expect(state.x).toBeLessThan(TREADMILL_RULES.startPosition)
    expect(advance(treadmillCommand(state, { type: "run", held: false }), 0.5).energy).toBeGreaterThan(0)
  })
  it("charges jump once, blocks double jump, and lands", () => {
    const jump = treadmillCommand(start(), { type: "jump" })
    expect(jump.energy).toBe(70)
    expect(treadmillCommand(jump, { type: "jump" })).toBe(jump)
    expect(advance(jump, 0.2).y).toBeGreaterThan(25)
    expect(advance(jump, 1).y).toBe(0)
    expect(treadmillCommand({ ...start(), energy: 9 }, { type: "jump" }).y).toBe(0)
  })
  it("charges dash once and respects its cooldown", () => {
    const state = treadmillCommand(start(), { type: "dash" })
    expect(state.energy).toBe(62)
    expect(treadmillCommand(state, { type: "dash" })).toBe(state)
    expect(advance(state, 0.5).x).toBeGreaterThan(start().x)
    expect(advance(state, 0.5).cooldown).toBeGreaterThan(0)
    expect(treadmillCommand({ ...start(), energy: 17 }, { type: "dash" }).dashLeft).toBe(0)
  })
  it("knocks a grounded runner back on a barrier but lets a high jump pass", () => {
    const state = { ...start(), hazards: [{ x: 0.54, hit: false }] }
    const hit = advanceTreadmill(state, 0.1)
    expect(hit.x).toBeLessThan(0.43)
    expect(hit.energy).toBeLessThan(80)
    const high = advanceTreadmill({ ...state, y: 60, velocityY: 0 }, 0.05)
    expect(high.x).toBeGreaterThan(0.5)
    expect(high.mode).toBe("running")
  })
  it("ends a run on spikes", () => {
    const state = advanceTreadmill({ ...start(), stage: 2, hazards: [{ x: 0.54, hit: false }] }, 0.1)
    expect(state.mode).toBe("over")
    expect(state.message).toContain("가시")
  })
  it("freezes all simulation during manual pause and upgrade choice", () => {
    const state = advance(treadmillCommand(start(), { type: "run", held: true }), 0.5)
    const paused = treadmillCommand(state, { type: "pause" })
    expect(paused.running).toBe(false)
    expect(advance(paused, 4)).toEqual(paused)
    const upgrade = advanceTreadmill({ ...start(), seconds: 9.99 }, 0.05)
    expect(upgrade.mode).toBe("upgrade")
    expect(advance(upgrade, 4)).toEqual(upgrade)
  })
  it("applies both the benefit and cost and waits for explicit resume", () => {
    const checkpoint = { ...start(), mode: "upgrade" as const, energy: 40 }
    const grip = treadmillCommand(checkpoint, { type: "upgrade", upgrade: "grip" })
    expect(grip.stage).toBe(1)
    expect(grip.grip).toBe(0.026)
    expect(grip.jumpCost).toBe(12)
    expect(grip.mode).toBe("paused")
    expect(grip.energy).toBe(65)
    const spring = treadmillCommand(checkpoint, { type: "upgrade", upgrade: "spring" })
    expect(spring.jumpCost).toBe(7)
    expect(spring.dashFactor).toBe(0.85)
    const economy = treadmillCommand(checkpoint, { type: "upgrade", upgrade: "economy" })
    expect(economy.runDrainFactor).toBe(0.8)
    expect(economy.cooldownSeconds).toBe(3)
    expect(treadmillCommand(start(), { type: "upgrade", upgrade: "grip" }).upgrades).toEqual([])
  })
  it("finishes the final stage and resets all upgrades on restart", () => {
    const clear = advanceTreadmill({ ...start(), stage: 2, seconds: 9.99, upgrades: ["grip"], jumpCost: 12 }, 0.05)
    expect(clear.mode).toBe("clear")
    const again = treadmillCommand(clear, { type: "start" })
    expect(again.stage).toBe(0)
    expect(again.upgrades).toEqual([])
    expect(again.jumpCost).toBe(10)
    expect(again.energy).toBe(80)
  })
  it("preserves the input state and matches physics across frame rates", () => {
    const original = { ...start(), running: true }
    const copy = structuredClone(original)
    let slow = original, fast = original
    for (let i = 0; i < 30; i++) slow = advanceTreadmill(slow, 1 / 30)
    for (let i = 0; i < 120; i++) fast = advanceTreadmill(fast, 1 / 120)
    expect(original).toEqual(copy)
    expect(slow.x).toBeCloseTo(fast.x, 8)
    expect(slow.energy).toBeCloseTo(fast.energy, 8)
    expect(advanceTreadmill(original, NaN)).toBe(original)
  })
})
