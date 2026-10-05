import { describe, expect, it } from "vitest"
import { PACE_EVENT_METERS } from "@impl/prescription/record-pace"
import { calculatePaceSplits, directPaceSeconds, equalDistanceSplits, nearbyPaceTable, paceClock, parsePaceClock, primaryPaceDistances } from "./pace-tools"

describe("pace tool inputs and carry", () => {
  it("keeps decimal race times and rejects invalid components before summing", () => {
    expect(parsePaceClock("", "2", "1.5")).toEqual({ kind: "valid", seconds: 121.5 })
    expect(parsePaceClock("1", "0", "-1").kind).toBe("invalid")
    expect(parsePaceClock("", "60", "0").kind).toBe("invalid")
    expect(parsePaceClock("", "0", "60").kind).toBe("invalid")
    expect(parsePaceClock("", "0", "0").kind).toBe("invalid")
    expect(parsePaceClock("25", "0", "0").kind).toBe("invalid")
    expect(parsePaceClock("", "", "").kind).toBe("empty")
    expect(parsePaceClock("", "2", "").kind).toBe("incomplete")
  })
  it("carries seconds and minutes rather than printing 60", () => {
    expect(paceClock(59.999)).toBe("1:00")
    expect(paceClock(3599.999)).toBe("1:00:00")
    expect(paceClock(239.9, 0)).toBe("4:00")
    expect(paceClock(30.375)).toBe("0:30.4")
    expect(paceClock(61.5)).toBe("1:01.5")
  })
})

describe("source-consistent direct conversion", () => {
  it("has exact arithmetic and half compatibility", () => {
    expect(directPaceSeconds(121.5, 800, 200)).toBe(30.375)
    expect(directPaceSeconds(2400, 10000, 400)).toBe(96)
    expect(directPaceSeconds(6000, 21097, 1000)).toBe(directPaceSeconds(6000, 21097.5, 1000))
    expect(directPaceSeconds(120, 800, 50)).toBeNull()
    expect(directPaceSeconds(Infinity, 800, 200)).toBeNull()
    expect(primaryPaceDistances(800)).toEqual([200, 400, 800])
    expect(primaryPaceDistances(10000)).toEqual([400, 1000, 10000])
  })
  it.each(PACE_EVENT_METERS)("derives every table row from %s metres without stale result state", event => {
    const table = nearbyPaceTable(3000, event)
    expect(table).toHaveLength(5)
    expect(table[2]?.eventSeconds).toBeCloseTo(3000, 8)
    expect(nearbyPaceTable(3600, event)[2]?.eventSeconds).toBeCloseTo(3600, 8)
    expect(nearbyPaceTable(0, event)).toEqual([])
  })
})

describe("normalized split arithmetic", () => {
  it.each(["even", "faster", "slower"] as const)("keeps 10km total exact with %s distribution", trend => {
    const result = equalDistanceSplits(2400, 10000, 400, trend)
    expect(result.kind).toBe("ready")
    if (result.kind !== "ready") throw Error("split")
    expect(result.rows).toHaveLength(25)
    expect(result.rows.reduce((sum, row) => sum + row.seconds, 0)).toBeCloseTo(2400, 8)
    expect(result.rows.at(-1)?.cumulativeSeconds).toBe(2400)
    if (trend === "faster") expect(result.rows[0]!.seconds).toBeGreaterThan(result.rows.at(-1)!.seconds)
  })
  it("preserves fixed times and rejects impossible budgets", () => {
    const result = calculatePaceSplits(100, [{ metres: 400, fixedSeconds: 30 }, { metres: 400 }, { metres: 200, weight: 2 }])
    expect(result.kind).toBe("ready")
    if (result.kind !== "ready") throw Error("split")
    expect(result.rows.map(row => row.seconds)).toEqual([30, 35, 35])
    expect(calculatePaceSplits(20, [{ metres: 400, fixedSeconds: 30 }, { metres: 400 }]).kind).toBe("invalid")
    expect(calculatePaceSplits(20, [{ metres: 400, fixedSeconds: 10 }]).kind).toBe("invalid")
    expect(calculatePaceSplits(20, [{ metres: 400, weight: Infinity }]).kind).toBe("invalid")
  })
  it("retains partial final distances and bounds allocations before building rows", () => {
    const result = equalDistanceSplits(5400, 21097, 1000)
    expect(result.kind).toBe("ready")
    if (result.kind !== "ready") throw Error("split")
    expect(result.rows.at(-1)?.metres).toBe(97.5)
    expect(result.rows.at(-1)?.cumulativeMetres).toBe(21097.5)
    expect(equalDistanceSplits(1000, 5000, 0).kind).toBe("invalid")
    expect(calculatePaceSplits(1000, Array.from({ length: 2001 }, () => ({ metres: 60 }))).kind).toBe("invalid")
  })
  it("checks 210 synthetic distance and distribution journeys without integer/decimal drift", () => {
    for (const event of PACE_EVENT_METERS) for (let index = 0; index < 30; index++) {
      const total = 121.5 + index * 131.337
      const result = equalDistanceSplits(total, event, [200, 400, 1000][index % 3]!, ["even", "faster", "slower"][index % 3] as "even")
      if (result.kind !== "ready") throw Error("split")
      expect(result.rows.reduce((sum, row) => sum + row.seconds, 0)).toBeCloseTo(Math.round(total * 10) / 10, 7)
      expect(result.rows.at(-1)?.cumulativeMetres).toBe(event)
      expect(result.rows.every(row => row.seconds >= 0)).toBe(true)
    }
  })
})
