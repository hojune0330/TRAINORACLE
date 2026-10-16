import { describe, expect, it } from "vitest"
import { createGameGestures } from "./gestures"
import { advanceTreadmill, newTreadmillRun, treadmillCommand, TREADMILL_RULES } from "../../domain/minigame/treadmill"
const point = (x: number, y: number, time = 0) => ({ x, y, time })

describe("screen gestures", () => {
  it("keeps running while repeated contact strokes produce three grounded jumps and releasing stops running", () => {
    const g = createGameGestures()
    let state = { ...treadmillCommand(newTreadmillRun(), { type: "start" }), countdown: 0, spawned: 99 }
    g.down(1, point(100, 200))
    state = treadmillCommand(state, { type: "run", held: g.held })
    for (let cycle = 0; cycle < 3; cycle++) {
      g.move(1, point(100, 200, cycle * 1100))
      expect(g.move(1, point(100, 150, cycle * 1100 + 100))).toBe(true)
      const before = state.energy
      state = treadmillCommand(state, { type: "jump" })
      expect(state.velocityY).toBe(TREADMILL_RULES.jumpVelocity)
      expect(state.energy).toBe(before - TREADMILL_RULES.jumpCost)
      expect(state.running).toBe(true)
      for (let frame = 0; frame < 22; frame++) state = advanceTreadmill(state, .05)
      expect(state.y).toBe(0)
    }
    g.up(1, point(100, 150, 3500))
    state = treadmillCommand(state, { type: "run", held: g.held })
    expect(state.running).toBe(false)
    const before = state.x
    state = advanceTreadmill(state, .05)
    expect(state.x).toBeLessThan(before)
  })
  it("repeats upward strokes without lifting, including downward returns beyond the starting point", () => {
    for (const dx of [-35, 0, 35]) {
      const g = createGameGestures(); g.down(1, point(100, 200))
      for (let cycle = 0; cycle < 3; cycle++) {
        const y = 200 + cycle * 60
        expect(g.move(1, point(100, y, cycle * 1000))).toBe(false)
        expect(g.move(1, point(100 + dx, y - 40, cycle * 1000 + 100))).toBe(true)
        expect(g.move(1, point(100 + dx, y - 60, cycle * 1000 + 150))).toBe(false)
        expect(g.move(1, point(100 + dx, y - 50, cycle * 1000 + 180))).toBe(false)
        expect(g.move(1, point(100 + dx, y - 85, cycle * 1000 + 200))).toBe(false)
        expect(g.held).toBe(true)
      }
      g.up(1, point(100, 200, 3100))
      expect(g.held).toBe(false)
      expect(g.down(2, point(100, 200, 3150))).toBe(false)
    }
  })
  it("rearms at a new location without needing to return to the original touch origin", () => {
    const g = createGameGestures(); g.down(1, point(100, 400))
    expect(g.move(1, point(100, 300))).toBe(true)
    expect(g.move(1, point(100, 200))).toBe(false)
    expect(g.move(1, point(100, 224))).toBe(false)
    expect(g.move(1, point(100, 196))).toBe(true)
    g.cancel(1)
    expect(g.move(1, point(100, 250))).toBe(false)
    expect(g.held).toBe(false)
  })
  it("holds until every finger releases, and reset releases all input", () => {
    const g = createGameGestures()
    g.down(1, point(0, 100)); g.down(2, point(50, 100))
    expect(g.held).toBe(true)
    g.up(1, point(0, 100, 50)); expect(g.held).toBe(true)
    g.cancel(2); expect(g.held).toBe(false)
    g.down(3, point(0, 100)); g.reset(); expect(g.held).toBe(false)
    expect(g.down(4, point(0, 100, 100))).toBe(false)
  })
  it("jumps once for vertical and both diagonal upward swipes without releasing the hold", () => {
    for (const dx of [-60, 0, 60]) {
      const g = createGameGestures(); g.down(1, point(100, 200))
      expect(g.move(1, point(100 + dx, 150, 100))).toBe(true)
      expect(g.held).toBe(true)
      expect(g.move(1, point(100 + dx, 100, 150))).toBe(false)
      g.up(1, point(100 + dx, 100, 180))
      expect(g.down(2, point(100 + dx, 100, 220))).toBe(false)
    }
  })
  it("ignores jitter, downward and horizontal movement and canceled gestures", () => {
    for (const [dx, dy] of [[2, -10], [0, 60], [90, -15]]) {
      const g = createGameGestures(); g.down(1, point(100, 200))
      expect(g.move(1, point(100 + dx!, 200 + dy!, 100))).toBe(false)
      g.cancel(1)
      expect(g.move(1, point(100, 100, 150))).toBe(false)
      expect(g.down(2, point(100, 200, 180))).toBe(false)
    }
  })
  it("dashes only after a nearby quick tap, preserving it through normal capture loss", () => {
    const g = createGameGestures()
    expect(g.down(1, point(100, 200))).toBe(false)
    g.up(1, point(100, 200, 60)); g.cancel(1)
    expect(g.down(2, point(110, 205, 200))).toBe(true)
    expect(g.held).toBe(true)
  })
  it("does not treat a long hold, distant tap, expired tap or multi-touch as a double tap", () => {
    for (const [duration, gap, x] of [[300, 50, 100], [60, 301, 100], [60, 100, 160]]) {
      const g = createGameGestures(); g.down(1, point(100, 200))
      g.up(1, point(100, 200, duration))
      expect(g.down(2, point(x!, 200, duration! + gap!))).toBe(false)
    }
    const g = createGameGestures(); g.down(1, point(100, 200)); g.down(2, point(100, 200))
    g.up(1, point(100, 200, 40)); g.up(2, point(100, 200, 50))
    expect(g.down(3, point(100, 200, 100))).toBe(false)
  })
})
