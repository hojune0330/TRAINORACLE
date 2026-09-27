import { describe, expect, it } from "vitest"
import { createWorkoutPreviewHistory, pushWorkoutPreview, undoWorkoutPreview, redoWorkoutPreview } from "./workout-preview-history"

describe("bounded workout preview history", () => {
  it("keeps exactly 20 undo steps without changing the original state", () => {
    const original = createWorkoutPreviewHistory(0)
    let state = original
    for (let i = 1; i <= 25; i++) state = pushWorkoutPreview(state, i)
    expect(original).toEqual({ past: [], present: 0, future: [] })
    expect(state.past).toHaveLength(20)
    for (let i = 0; i < 21; i++) state = undoWorkoutPreview(state)
    expect(state.present).toBe(5)
    expect(state.future).toHaveLength(20)
    for (let i = 0; i < 21; i++) state = redoWorkoutPreview(state)
    expect(state.present).toBe(25)
  })
  it("discards redo after a new branch, including a return to baseline", () => {
    const state = pushWorkoutPreview(undoWorkoutPreview(pushWorkoutPreview(createWorkoutPreviewHistory(null as string | null), "B")), "C")
    expect(state.future).toEqual([])
    expect(redoWorkoutPreview(state)).toBe(state)
    expect(undoWorkoutPreview(state).present).toBeNull()
  })
  it("survives 768 seeded random commands with a 20-step reference model", () => {
    let state = createWorkoutPreviewHistory(0), seed = 2709
    let history = [0], cursor = 0
    for (let i = 1; i <= 768; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      const command = seed % 3
      if (command === 0) {
        state = pushWorkoutPreview(state, i)
        history = [...history.slice(0, cursor + 1), i].slice(-21); cursor = history.length - 1
      } else if (command === 1) { state = undoWorkoutPreview(state); cursor = Math.max(0, cursor - 1) }
      else { state = redoWorkoutPreview(state); cursor = Math.min(history.length - 1, cursor + 1) }
      expect(state.present).toBe(history[cursor])
      expect(state.past.length).toBeLessThanOrEqual(20)
      expect(state.future.length).toBeLessThanOrEqual(20)
    }
  })
})
