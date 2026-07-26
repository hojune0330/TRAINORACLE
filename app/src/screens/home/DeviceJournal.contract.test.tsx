import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import type { JournalEntry } from "../../domain/journal-store"
import { DeviceJournal } from "./DeviceJournal"

const STORAGE_KEY = "trainoracle.journal.v1"

function eveningEntry(note: string): JournalEntry {
  return {
    id: "evening-entry",
    kind: "evening",
    date: "2026-07-24",
    savedAt: "2026-07-24T20:00:00.000Z",
    syncState: "local",
    sleepH: 7,
    sleepQuality: 4,
    weightKg: "",
    restingHr: "",
    painParts: {},
    mood: 4,
    note,
    memoPurpose: "PRIVATE_SELF_ONLY",
  }
}

afterEach(cleanup)

describe("DeviceJournal overview privacy", () => {
  beforeEach(() => window.localStorage.clear())

  it("Given an evening check-in without a note, when rendered, then structured sleep and mood are shown", () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([eveningEntry("")]))

    render(<DeviceJournal />)

    expect(screen.getByText("수면 7h · 기분 4/5")).toBeVisible()
  })

  it("Given an evening check-in with a private note, when rendered, then the overview excludes its raw text", () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([eveningEntry("OWNER_SECRET_TEXT")]))

    render(<DeviceJournal />)

    expect(screen.queryByText("OWNER_SECRET_TEXT")).toBeNull()
    expect(screen.getByText("수면 7h · 기분 4/5")).toBeVisible()
  })
})
