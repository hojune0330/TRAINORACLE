import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { loadFatigueExperiment, saveFatigueExperiment } from "./fatigue-experiment-store"

const STORAGE_KEY = "trainoracle.fatigue-experiment.v1"

beforeEach(() => window.localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe("fatigue experiment evidence storage", () => {
  it("migrates legacy slider values without inventing evidence", () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      optedIn: true,
      vector: { neural: 8, metabolic: 6, muscular: 7, impact: 5, subjective: 4 },
    }))

    expect(loadFatigueExperiment()).toEqual({
      optedIn: true,
      vector: { neural: 8, metabolic: 6, muscular: 7, impact: 5, subjective: 4 },
      evidence: null,
    })
  })

  it("round-trips the exact evidence time, source, and uncertainty", () => {
    const state = {
      optedIn: true,
      vector: { neural: 8, metabolic: 6, muscular: 7, impact: 5, subjective: 4 },
      evidence: {
        observedAt: "2026-08-02T02:30:00.000Z",
        source: "SELF_REPORTED_SLIDERS" as const,
        uncertainty: "HIGH_SUBJECTIVE_ONLY" as const,
        containsPrivateRawText: false as const,
      },
    }

    expect(saveFatigueExperiment(state)).toBe(true)
    expect(loadFatigueExperiment()).toEqual(state)
  })

  it("reports a browser storage failure but does not hide unexpected code errors", () => {
    const state = loadFatigueExperiment()
    vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
      throw new DOMException("quota", "QuotaExceededError")
    })
    expect(saveFatigueExperiment(state)).toBe(false)

    vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
      throw new TypeError("unexpected")
    })
    expect(() => saveFatigueExperiment(state)).toThrow(TypeError)
  })
})
