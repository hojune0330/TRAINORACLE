import { describe, expect, it } from "vitest"
import { createTreadmillRenderer } from "./draw"
import { GAME_TOKENS } from "./sprites"
import type { GamePalette } from "./sprites"
import { newTreadmillRun, treadmillCommand } from "../../domain/minigame/treadmill"
import { TOUR_CITIES, tourCity, tourStages } from "../../domain/minigame/tour"

/** A 2D context that records text and swallows everything else. */
function recordingContext() {
  const texts: string[] = []
  const gradient = { addColorStop() {} }
  const target: Record<string, unknown> = {
    canvas: document.createElement("canvas"), texts,
    fillText: (text: string) => { texts.push(text) }, strokeText() {},
    createLinearGradient: () => gradient, createRadialGradient: () => gradient,
  }
  return new Proxy(target, {
    get: (object, key: string) => key in object ? object[key] : () => undefined,
    set: (object, key: string, value) => { object[key] = value; return true },
  }) as unknown as CanvasRenderingContext2D & { texts: string[] }
}
const palette = Object.fromEntries(Object.keys(GAME_TOKENS).map(key => [key, "red"])) as GamePalette

describe("treadmill renderer with tour cities", () => {
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
