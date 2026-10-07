import { describe, expect, it } from "vitest"
import {
  advanceTreadmill, nearestHazard, newTreadmillRun, treadmillCommand, treadmillTip, treadmillWarning, upcomingHazards,
  TREADMILL_RULES, TREADMILL_STAGES,
} from "./treadmill"
import type { TreadmillHazard, TreadmillHazardKind, TreadmillState, TreadmillUpgrade } from "./treadmill"

function advance(state: TreadmillState, seconds: number): TreadmillState {
  let next = state
  for (let left = seconds; left > 0.000001; left -= 0.05) next = advanceTreadmill(next, Math.min(left, 0.05))
  return next
}
const start = () => treadmillCommand(newTreadmillRun(), { type: "start" })
const hazard = (x: number, kind: TreadmillHazardKind = "barrier"): TreadmillHazard => ({ id: 1, kind, x, hit: false, passed: false })
/** Empty course so a test isolates one rule; `spawned` past the end stops the fixed course from adding hazards. */
const clean = (patch: Partial<TreadmillState> = {}): TreadmillState => ({ ...start(), spawned: 99, ...patch })

type Strategy = (state: TreadmillState) => TreadmillState
/** A simple player: keep a target position, hold a reserve, jump when the next hazard is in range. */
const player = (target: number, reserve: number, gap: number): Strategy => state => {
  let next = state
  const want = (next.x < target && next.energy > reserve) || (next.x < 0.22 && next.energy > 0)
  if (want !== next.running) next = treadmillCommand(next, { type: "run", held: want })
  const ahead = nearestHazard(next)
  if (ahead && ahead.x - next.x < gap) next = treadmillCommand(next, { type: "jump" })
  if (next.x < 0.16) next = treadmillCommand(next, { type: "dash" })
  return next
}
function play(picks: readonly TreadmillUpgrade[], strategy: Strategy): TreadmillState {
  let state = start()
  for (let frame = 0; frame < 4000 && (state.mode === "running" || state.mode === "upgrade"); frame++) {
    if (state.mode === "upgrade") state = treadmillCommand(treadmillCommand(state, { type: "upgrade", upgrade: picks[state.stage]! }), { type: "resume" })
    state = advanceTreadmill(strategy(state), 1 / 60)
  }
  return state
}

describe("treadmill survival rules", () => {
  it("falls without action and stops simulating after failure", () => {
    const state = advance(start(), 8)
    expect(state.mode).toBe("over")
    expect(state.failure).toBe("fall")
    expect(advance(state, 2)).toEqual(state)
  })
  it("buys front space while running and spends it to recover", () => {
    const original = clean()
    const running = advance(treadmillCommand(original, { type: "run", held: true }), 1)
    expect(running.x).toBeGreaterThan(original.x)
    expect(running.energy).toBeLessThan(original.energy)
    const resting = advance(treadmillCommand(running, { type: "run", held: false }), 0.5)
    expect(resting.x).toBeLessThan(running.x)
    expect(resting.energy).toBeGreaterThan(running.energy)
    expect(resting.energy).toBeLessThanOrEqual(TREADMILL_RULES.maxEnergy)
    expect(resting.stats.restSeconds).toBeGreaterThan(0.4)
  })
  it("requires release to recover an exhausted held run and says so", () => {
    const state = advance({ ...clean(), energy: 0, running: true }, 0.5)
    expect(state.energy).toBe(0)
    expect(state.exhausted).toBe(true)
    expect(state.x).toBeLessThan(TREADMILL_RULES.startPosition)
    expect(treadmillWarning(state).text).toContain("손을 놓아야")
    const released = advance(treadmillCommand(state, { type: "run", held: false }), 0.5)
    expect(released.energy).toBeGreaterThan(0)
    expect(released.exhausted).toBe(false)
  })
  it("charges jump once, blocks double jump, lands and records the landing", () => {
    const jump = treadmillCommand(clean(), { type: "jump" })
    expect(jump.energy).toBe(TREADMILL_RULES.maxEnergy - TREADMILL_RULES.jumpCost)
    expect(treadmillCommand(jump, { type: "jump" })).toBe(jump)
    expect(advance(jump, 0.2).y).toBeGreaterThan(TREADMILL_RULES.jumpVelocity * 0.1)
    const landed = advance(jump, 1)
    expect(landed.y).toBe(0)
    expect(landed.landed).toBeLessThan(1)
    expect(landed.stats.jumps).toBe(1)
    expect(treadmillCommand({ ...clean(), energy: TREADMILL_RULES.jumpCost - 1 }, { type: "jump" }).y).toBe(0)
  })
  it("charges dash once and respects its cooldown", () => {
    const state = treadmillCommand(clean(), { type: "dash" })
    expect(state.energy).toBe(TREADMILL_RULES.maxEnergy - TREADMILL_RULES.dashCost)
    expect(treadmillCommand(state, { type: "dash" })).toBe(state)
    expect(advance(state, 0.5).x).toBeGreaterThan(start().x)
    expect(advance(state, 0.5).cooldown).toBeGreaterThan(0)
    expect(treadmillCommand({ ...clean(), energy: TREADMILL_RULES.dashCost - 1 }, { type: "dash" }).dashLeft).toBe(0)
  })
  it("knocks a grounded runner back on a barrier but lets a high jump pass and counts it", () => {
    const state = clean({ hazards: [hazard(0.53)] })
    const hit = advanceTreadmill(state, 0.05)
    expect(hit.x).toBeLessThan(state.x - TREADMILL_RULES.barrierKnockback * 0.9)
    expect(hit.energy).toBeLessThan(TREADMILL_RULES.maxEnergy)
    expect(hit.stats.hits).toBe(1)
    expect(hit.hitFlash).toBeLessThan(0.06)
    const high = advance({ ...state, y: 60, velocityY: 300 }, 0.4)
    expect(high.mode).toBe("running")
    expect(high.stats.hits).toBe(0)
    expect(high.stats.cleared).toBe(1)
  })
  it("uses the drawn hazard width: a near miss outside the box is not a hit", () => {
    const reach = 0.022 + TREADMILL_RULES.runnerHalfWidth
    expect(advanceTreadmill(clean({ hazards: [hazard(0.5 + reach + 0.004)] }), 1 / 240).stats.hits).toBe(0)
    expect(advanceTreadmill(clean({ hazards: [hazard(0.5 + reach - 0.004)] }), 1 / 240).stats.hits).toBe(1)
  })
  it("ends a run on spikes and names the cause", () => {
    const state = advanceTreadmill(clean({ stage: 2, hazards: [hazard(0.53, "spike")] }), 0.05)
    expect(state.mode).toBe("over")
    expect(state.failure).toBe("spike")
    expect(treadmillTip(state)).toMatch(/점프/)
  })
  it("telegraphs the fixed course before each hazard enters", () => {
    const first = TREADMILL_STAGES[0].course[0].at
    const early = advance(start(), first - 1)
    expect(upcomingHazards(early)).toHaveLength(1)
    expect(early.hazards).toHaveLength(0)
    expect(advance(start(), first + 0.05).hazards).toHaveLength(1)
  })
  it("freezes all simulation during manual pause and upgrade choice", () => {
    const state = advance(treadmillCommand(start(), { type: "run", held: true }), 0.5)
    const paused = treadmillCommand(state, { type: "pause" })
    expect(paused.running).toBe(false)
    expect(advance(paused, 4)).toEqual(paused)
    const upgrade = advanceTreadmill({ ...clean(), seconds: 9.99 }, 0.05)
    expect(upgrade.mode).toBe("upgrade")
    expect(advance(upgrade, 4)).toEqual(upgrade)
  })
  it("applies both the benefit and cost and waits for explicit resume", () => {
    const checkpoint = { ...start(), mode: "upgrade" as const, energy: 40 }
    const grip = treadmillCommand(checkpoint, { type: "upgrade", upgrade: "grip" })
    expect(grip.stage).toBe(1)
    expect(grip.mudBonus).toBe(0.5)
    expect(grip.knockbackFactor).toBe(0.5)
    expect(grip.jumpCost).toBe(TREADMILL_RULES.jumpCost + 3)
    expect(grip.mode).toBe("paused")
    expect(grip.energy).toBe(40 + TREADMILL_RULES.checkpointRefill)
    const spring = treadmillCommand(checkpoint, { type: "upgrade", upgrade: "spring" })
    expect(spring.jumpCost).toBe(TREADMILL_RULES.jumpCost - 4)
    expect(spring.strideFactor).toBe(0.88)
    const economy = treadmillCommand(checkpoint, { type: "upgrade", upgrade: "economy" })
    expect(economy.runDrainFactor).toBe(0.8)
    expect(economy.cooldownSeconds).toBe(TREADMILL_RULES.dashCooldown + 1)
    expect(economy.recoveryFactor).toBe(0.9)
    expect(treadmillCommand(start(), { type: "upgrade", upgrade: "grip" }).upgrades).toEqual([])
  })
  it("makes the grip trade-off real on mud: more ground per second, not just a label", () => {
    const mud = (upgrades: TreadmillUpgrade[]) => {
      let state = clean({ stage: 1, running: true })
      if (upgrades.length) state = { ...treadmillCommand({ ...state, mode: "upgrade", stage: 0 }, { type: "upgrade", upgrade: "grip" }), mode: "running", running: true, spawned: 99 }
      return advance(state, 1).x
    }
    expect(mud(["grip"])).toBeGreaterThan(mud([]) + 0.03)
  })
  it("finishes the final stage and resets all upgrades and stats on restart", () => {
    const clear = advanceTreadmill({ ...clean(), stage: 2, seconds: 9.99, upgrades: ["grip"], jumpCost: 11 }, 0.05)
    expect(clear.mode).toBe("clear")
    const again = treadmillCommand(clear, { type: "start" })
    expect(again.stage).toBe(0)
    expect(again.upgrades).toEqual([])
    expect(again.jumpCost).toBe(TREADMILL_RULES.jumpCost)
    expect(again.energy).toBe(TREADMILL_RULES.maxEnergy)
    expect(again.stats.hits).toBe(0)
    expect(again.failure).toBeNull()
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

describe("treadmill balance guard (game feel, not training)", () => {
  it("does not reward a single mindless input", () => {
    expect(play(["grip", "grip"], state => state).failure).toBe("fall")
    const holdOnly: Strategy = state => {
      const next = state.running ? state : treadmillCommand(state, { type: "run", held: true })
      const ahead = nearestHazard(next)
      return ahead && ahead.x - next.x < 0.09 ? treadmillCommand(next, { type: "jump" }) : next
    }
    expect(play(["economy", "economy"], holdOnly).mode).toBe("over")
    const mash: Strategy = state => treadmillCommand(player(0.6, 15, 0)(state), { type: "jump" })
    expect(play(["spring", "spring"], mash).mode).toBe("over")
  })
  it("is clearable by a player that runs, rests and times jumps, with every upgrade path", () => {
    for (const pick of ["grip", "spring", "economy"] as const) {
      expect(play([pick, pick], player(0.55, 25, 0.08)).mode, pick).toBe("clear")
    }
  })
  it("makes double grip pay for heavier jumps: a thin energy reserve fails on spikes", () => {
    expect(play(["grip", "grip"], player(0.55, 10, 0.08)).failure).toBe("spike")
    expect(play(["spring", "spring"], player(0.55, 10, 0.08)).mode).toBe("clear")
  })
})
