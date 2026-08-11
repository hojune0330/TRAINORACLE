import React from "react"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { replaceAllEntries } from "../../domain/journal-store"
import { DeviceJournal } from "./DeviceJournal"

afterEach(cleanup)

describe("recent journal duplicate identifier resilience", () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  it("renders each legacy duplicate without a React key collision", () => {
    // Given
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const first = {
      id: "duplicate-recent-entry",
      kind: "post-session" as const,
      date: "2026-07-20",
      savedAt: "2026-07-20T09:00:00.000Z",
      syncState: "local" as const,
      system: "base",
      title: "First recent duplicate",
      distanceKm: "5",
      durationMin: "25",
      avgPace: "5:00",
      rpe: 6,
      memo: "",
    }
    expect(replaceAllEntries([first, {
      ...first,
      savedAt: "2026-07-20T18:00:00.000Z",
      title: "Second recent duplicate",
    }]).ok).toBe(true)

    // When
    render(<DeviceJournal />)

    // Then
    expect(screen.getByText("First recent duplicate")).toBeVisible()
    expect(screen.getByText("Second recent duplicate")).toBeVisible()
    expect(consoleError.mock.calls.flat().join(" ")).not.toContain("Encountered two children with the same key")
  })
})
