import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import type { JournalEntry } from "../../domain/journal-store"
import { todayISO } from "../../domain/journal-store"
import { Trends } from "../Trends"

const STORAGE_KEY = "trainoracle.journal.v1"

function trendEntries(): readonly JournalEntry[] {
  const today = todayISO()
  return [
    {
      id: "trend-session",
      kind: "post-session",
      date: today,
      savedAt: `${today}T08:00:00.000Z`,
      syncState: "local",
      system: "base",
      title: "이지런",
      distanceKm: "8",
      durationMin: "40",
      avgPace: "5:00",
      rpe: 4,
      memo: "",
    },
    {
      id: "trend-evening",
      kind: "evening",
      date: today,
      savedAt: `${today}T20:00:00.000Z`,
      syncState: "local",
      sleepH: 8,
      sleepQuality: 4,
      weightKg: "60",
      restingHr: "48",
      painParts: { rKnee: 4 },
      mood: 4,
      note: "",
    },
  ]
}

afterEach(cleanup)

describe("trend chart alternatives", () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trendEntries()))
  })

  it("offers a readable table for every rendered chart", async () => {
    // Given
    const user = userEvent.setup()
    render(<Trends />)

    // When
    const tableToggles = screen.getAllByText("표로 보기")
    for (const toggle of tableToggles) await user.click(toggle)

    // Then
    expect(tableToggles).toHaveLength(3)
    expect(screen.getAllByRole("table")).toHaveLength(3)
    expect(screen.getAllByRole("img")).toHaveLength(3)
  })
})
