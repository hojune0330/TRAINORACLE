import { describe, expect, it } from "vitest"
import { createTreadmillRenderer } from "./draw"
import { GAME_TOKENS } from "./sprites"
import type { GamePalette } from "./sprites"
import { newTreadmillRun, treadmillCommand } from "../../domain/minigame/treadmill"
import { TOUR_CITIES, tourCity, tourStages } from "../../domain/minigame/tour"

/** A 2D context that records text and swallows everything else. */
function recordingContext() {
  const texts: string[] = []
  const fills: number[][] = []
  const translations: [number, number][] = []
  const gradient = { addColorStop() {} }
  const target: Record<string, unknown> = {
    canvas: document.createElement("canvas"), texts, translations, fills,
    fillRect: (...rect: number[]) => fills.push(rect),
    translate: (x: number, y: number) => translations.push([x, y]),
    fillText: (text: string) => { texts.push(text) }, strokeText() {},
    createLinearGradient: () => gradient, createRadialGradient: () => gradient,
  }
  return new Proxy(target, {
    get: (object, key: string) => key in object ? object[key] : () => undefined,
    set: (object, key: string, value) => { object[key] = value; return true },
  }) as unknown as CanvasRenderingContext2D & { texts: string[]; translations: [number, number][]; fills: number[][] }
}
const palette = Object.fromEntries(Object.keys(GAME_TOKENS).map(key => [key, "red"])) as GamePalette

describe("treadmill renderer with tour cities", () => {
  it("actually paints a scheduled obstacle ahead of a front-running player before activation", () => {
    const state = { ...newTreadmillRun(), mode: "running" as const, countdown: 0, running: true, x: 0.88, seconds: 1.5 }
    const context = recordingContext()
    createTreadmillRenderer()(context, state, 360, 600, palette, false, 1000)
    const visible = JSON.parse(context.canvas.dataset.renderedHazards!) as { id: number; x: number; scheduled: boolean }[]
    const first = visible.find(hazard => hazard.id === 0)!
    expect(first).toBeDefined()
    expect(first.scheduled).toBe(true)
    expect(first.x).toBeGreaterThan(0.6)
    expect(first.x).toBeLessThan(0.75)
    expect(context.translations.some(([x, y]) => Math.abs(x - first.x * 360) < 0.01 && y === 474)).toBe(true)
    expect(state.hazards).toHaveLength(0)
  })
  it("places the visible pit at the same rear boundary in city and practice views", () => {
    for (const city of [undefined, tourCity("seoul")]) {
      const context = recordingContext()
      const state = { ...newTreadmillRun(), mode: "running" as const, countdown: 0, running: false, x: .08 }
      createTreadmillRenderer()(context, state, 390, 700, palette, false, 1000, false, { city })
      const edge = Number(context.canvas.dataset.rearEdgeX)
      expect(edge).toBeCloseTo(.06 * 1.4)
      expect(Number(context.canvas.dataset.runnerX)).toBeGreaterThan(edge)
      expect(context.fills.some(([x, y, w, h]) => x === 0 && Math.abs(y! - 545) < .01 && Math.abs(w! - edge * 390) < .01 && Math.abs(h! - 155) < .01)).toBe(true)
    }
  })
  it("announces the city's own stage name in the countdown, not the practice course", () => {
    const stages = tourStages(tourCity("seoul")!)
    const state = { ...treadmillCommand(newTreadmillRun(stages), { type: "start", stages }), stage: 2 }
    const context = recordingContext()
    createTreadmillRenderer()(context, state, 360, 400, palette, true, 1000, false, { city: tourCity("seoul")! })
    expect(context.texts).toContain("3구간 · 남산 야간 공사길")
    expect(context.texts.join("|")).not.toMatch(/가시밭/u)
  })
  it("draws every city, surface and character without throwing", () => {
    for (const city of TOUR_CITIES) for (const stage of [0, 1, 2]) for (const character of ["tori", "hana", "dandan", "nabi", "r01", "pengu"] as const) {
      const stages = tourStages(city)
      const state = { ...treadmillCommand(newTreadmillRun(stages), { type: "start", stages }), countdown: 0, stage, running: true }
      const render = createTreadmillRenderer()
      for (const now of [1000, 1016, 1032]) render(recordingContext(), state, 360, 400, palette, false, now, false, { city, character, effects: stage === 1 ? "low" : "high", trail: ["stardust", "petals", "spark", "flame", "rainbow", null][TOUR_CITIES.indexOf(city) % 6]! })
    }
  })
})
