import { describe, expect, it } from "vitest"
import { thisWeekStats } from "./aggregates"
import { todayISO } from "./journal-store"
import type { AnalysisPostSessionEntry } from "./safe-export"

function postSession(distanceKm: string): AnalysisPostSessionEntry {
  return {
    id: "session-1",
    kind: "post-session",
    date: todayISO(),
    savedAt: `${todayISO()}T00:00:00.000Z`,
    syncState: "local",
    system: "easy",
    title: "기준 입력",
    distanceKm,
    durationMin: "60",
    avgPace: "5:00",
    rpe: 4,
  }
}

describe("aggregate numeric boundary", () => {
  it("keeps a complete decimal distance when the stored value is valid", () => {
    // Given
    const entry = postSession("12.5")

    // When
    const result = thisWeekStats([entry])

    // Then
    expect(result.distanceKm).toBe(12.5)
  })

  it("excludes a distance when the stored value has trailing text", () => {
    // Given
    const entry = postSession("12abc")

    // When
    const result = thisWeekStats([entry])

    // Then
    expect(result.distanceKm).toBe(0)
  })

  it.each(["", "Infinity", "0x10", "1e3"])(
    "excludes a non-decimal stored distance: %s",
    (distanceKm) => {
      // Given
      const entry = postSession(distanceKm)

      // When
      const result = thisWeekStats([entry])

      // Then
      expect(result.distanceKm).toBe(0)
    },
  )
})
