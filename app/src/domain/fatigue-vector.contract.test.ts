import { describe, expect, it } from "vitest"
import { experimentalFatigueComposite, fatigueVector } from "./fatigue-vector"

describe("fatigue vector", () => {
  it("keeps five fatigue dimensions separate", () => {
    expect(fatigueVector({
      neural: 8,
      metabolic: 6,
      muscular: 7,
      impact: 5,
      subjective: 4,
    })).toEqual({ neural: 8, metabolic: 6, muscular: 7, impact: 5, subjective: 4 })
  })

  it("shows an experimental composite only after explicit opt-in", () => {
    const vector = fatigueVector({ neural: 8, metabolic: 6, muscular: 7, impact: 5, subjective: 4 })

    expect(experimentalFatigueComposite(vector, false)).toBeNull()
    expect(experimentalFatigueComposite(vector, true)).toEqual({
      score: 6,
      label: "실험 기능 · 참고용",
      uncertainty: "이 점수는 안전 판정이나 의료 판단이 아니에요.",
    })
  })
})
