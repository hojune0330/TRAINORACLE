import { describe, expect, it } from "vitest"
import { createGameGestures } from "./gestures"
const point = (x: number, y: number, time = 0) => ({ x, y, time })

describe("screen gestures", () => {
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
