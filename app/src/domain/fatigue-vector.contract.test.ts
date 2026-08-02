import { describe, expect, it } from "vitest"
import { experimentalFatigueComposite, fatigueEvidence, fatigueVector } from "./fatigue-vector"

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

  it("requires explicit opt-in and recorded evidence before showing a composite", () => {
    const vector = fatigueVector({ neural: 8, metabolic: 6, muscular: 7, impact: 5, subjective: 4 })
    const evidence = fatigueEvidence({
      observedAt: "2026-08-02T02:30:00.000Z",
      source: "SELF_REPORTED_SLIDERS",
      uncertainty: "HIGH_SUBJECTIVE_ONLY",
      containsPrivateRawText: false,
    })

    expect(experimentalFatigueComposite(vector, evidence, false)).toBeNull()
    expect(experimentalFatigueComposite(vector, null, true)).toBeNull()
    expect(experimentalFatigueComposite(vector, evidence, true)).toEqual({
      score: 6,
      label: "실험 기능 · 참고용",
      observedAt: "2026-08-02T02:30:00.000Z",
      source: "SELF_REPORTED_SLIDERS",
      uncertainty: "직접 고른 값만 평균해 불확실성이 커요. 안전 판정이나 의료 판단이 아니에요.",
    })
  })

  it("rejects evidence without an exact timestamp or the subjective-only boundary", () => {
    expect(() => fatigueEvidence({
      observedAt: "today",
      source: "SELF_REPORTED_SLIDERS",
      uncertainty: "HIGH_SUBJECTIVE_ONLY",
      containsPrivateRawText: false,
    })).toThrow()
    expect(() => fatigueEvidence({
      observedAt: "2026-08-02T02:30:00.000Z",
      source: "WATCH_SENSOR",
      uncertainty: "LOW",
      containsPrivateRawText: false,
    })).toThrow()
  })
})
