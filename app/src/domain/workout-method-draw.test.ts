import { describe, expect, it, vi } from "vitest"
import { drawWorkoutMethod } from "./workout-method-draw"

describe("eligible workout method draw", () => {
  it("can draw each eligible alternative, never the current method", () => {
    const picks = [0, 0.4, 0.999].map(sample => drawWorkoutMethod(4, 1, [1], () => sample)?.index)
    expect(picks).toEqual([0, 2, 3])
    expect(drawWorkoutMethod(3, 0, [0, 1, 2], () => 0)?.index).not.toBe(0)
  })
  it("exhausts unseen methods before starting another cycle without an immediate repeat", () => {
    let current = 0, seen: readonly number[] = [0]
    const results: number[] = []
    for (let i = 0; i < 40; i++) {
      const draw = drawWorkoutMethod(4, current, seen, () => 0)!
      expect(draw.index).not.toBe(current)
      current = draw.index; seen = draw.seen; results.push(current)
    }
    expect(results.slice(0, 6)).toEqual([1, 2, 3, 0, 1, 2])
  })
  it("does not invent another option or consume randomness with no alternatives", () => {
    const random = vi.fn(() => 0)
    expect(drawWorkoutMethod(0, -1, [], random)).toBeNull()
    expect(drawWorkoutMethod(1, 0, [0], random)).toBeNull()
    expect(random).not.toHaveBeenCalled()
    expect(drawWorkoutMethod(1, -1, [], random)?.index).toBe(0)
  })
  it.each([NaN, Infinity, -0.1, 1])("rejects invalid random samples: %s", value => {
    expect(drawWorkoutMethod(3, 0, [0], () => value)).toBeNull()
  })
  it("does not mutate history, and ignores references outside the current pool", () => {
    const seen = Object.freeze([-1, 0, 8])
    expect(drawWorkoutMethod(3, 0, seen, () => 0)).toEqual({ index: 1, seen: [0, 1] })
    expect(seen).toEqual([-1, 0, 8])
  })
})
