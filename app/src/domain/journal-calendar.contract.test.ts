import { describe, expect, it } from "vitest"
import type { ArchiveDaySummary } from "./journal-archive-types"
import { projectJournalMonthCalendar } from "./journal-calendar"

const EMPTY_COUNTS = {
  postSession: 0,
  evening: 0,
  race: 0,
} as const

function recordedDay(date: string, entryCount: number): ArchiveDaySummary {
  return {
    date,
    entryShells: [],
    entryCount,
    kindCounts: { ...EMPTY_COUNTS, postSession: entryCount },
    metrics: {
      distanceKm: null,
      durationMin: null,
      moodAverage: null,
      painMax: null,
    },
    excludedRecordCount: 0,
  }
}

describe("journal month calendar", () => {
  it("lays out a complete Sunday-first month and keeps recorded day summaries", () => {
    // Given
    const days = [
      recordedDay("2026-07-10", 2),
      recordedDay("2026-07-11", 1),
    ]

    // When
    const cells = projectJournalMonthCalendar("2026-07", days)

    // Then
    expect(cells).toHaveLength(35)
    expect(cells.slice(0, 3).every((cell) => cell.kind === "OUTSIDE_MONTH")).toBe(true)
    expect(cells[3]).toMatchObject({ kind: "EMPTY_DAY", date: "2026-07-01", day: 1 })
    expect(cells.find((cell) => cell.date === "2026-07-10")).toMatchObject({
      kind: "RECORDED_DAY",
      entryCount: 2,
    })
    expect(cells.find((cell) => cell.date === "2026-07-11")).toMatchObject({
      kind: "RECORDED_DAY",
      entryCount: 1,
    })
  })

  it("adds a sixth row when the month needs it", () => {
    // Given / When
    const cells = projectJournalMonthCalendar("2026-08", [])

    // Then
    expect(cells).toHaveLength(42)
  })
})
