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

  it("keeps every civil date in the correct weekday column across six years", () => {
    // UTC is an independent calendar oracle, not the local-time implementation under test.
    for (let year = 2024; year <= 2029; year += 1) {
      for (let monthIndex = 0; monthIndex < 12; monthIndex += 1) {
        const month = `${year}-${String(monthIndex + 1).padStart(2, "0")}`
        const cells = projectJournalMonthCalendar(month, [])
        const actual = cells.filter(cell => cell.kind !== "OUTSIDE_MONTH")
        const count = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
        expect(actual.map(cell => cell.date), month).toEqual(
          Array.from({ length: count }, (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`),
        )
        expect(cells.length % 7, month).toBe(0)
        expect(new Set(cells.map(cell => cell.date)).size, month).toBe(cells.length)
        cells.forEach((cell, index) => {
          expect(new Date(`${cell.date}T12:00:00Z`).getUTCDay(), cell.date).toBe(index % 7)
          if (index > 0) {
            expect(Date.parse(`${cell.date}T12:00:00Z`) - Date.parse(`${cells[index - 1]!.date}T12:00:00Z`)).toBe(86_400_000)
          }
        })
      }
    }
  })

  it("does not invent records for empty dates or mutate the supplied summaries", () => {
    const day = recordedDay("2028-02-29", 1)
    const before = JSON.stringify(day)
    const cells = projectJournalMonthCalendar("2028-02", [day])
    expect(cells.find(cell => cell.date === "2028-02-29")).toMatchObject({ kind: "RECORDED_DAY", entryCount: 1 })
    expect(cells.find(cell => cell.date === "2028-02-28")).toMatchObject({ kind: "EMPTY_DAY" })
    expect(cells.filter(cell => cell.kind === "RECORDED_DAY")).toHaveLength(1)
    expect(JSON.stringify(day)).toBe(before)
  })
})
