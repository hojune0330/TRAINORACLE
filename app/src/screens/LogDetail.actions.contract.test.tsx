import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { JournalEntry } from "../domain/journal-store"
import { LogDetail } from "./LogDetail"

const STORAGE_KEY = "trainoracle.journal.v1"

const PAST_ENTRY = {
  id: "past-session",
  kind: "post-session",
  date: "2026-07-20",
  savedAt: "2026-07-20T09:00:00.000Z",
  syncState: "local",
  system: "base",
  title: "이지런",
  distanceKm: "5",
  durationMin: "30",
  avgPace: "6:00",
  rpe: 4,
  memo: "",
} satisfies JournalEntry

afterEach(cleanup)

describe("past journal actions", () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([PAST_ENTRY]))
  })

  it("offers an edit action for the exact saved entry", async () => {
    const user = userEvent.setup()
    const onEditEntry = vi.fn()
    render(<LogDetail date={PAST_ENTRY.date} onEditEntry={onEditEntry} />)

    await user.click(screen.getByRole("button", { name: "이지런 일지 수정" }))

    expect(onEditEntry).toHaveBeenCalledWith(PAST_ENTRY)
  })

  it("offers to add another journal on the same past date", async () => {
    const user = userEvent.setup()
    const onAddEntry = vi.fn()
    render(<LogDetail date={PAST_ENTRY.date} onAddEntry={onAddEntry} />)

    await user.click(screen.getByRole("button", { name: "이 날짜에 일지 더 쓰기" }))

    expect(onAddEntry).toHaveBeenCalledWith(PAST_ENTRY.date)
  })

  it("does not show disconnected actions when no navigation handler exists", () => {
    render(<LogDetail date={PAST_ENTRY.date} />)

    expect(screen.queryByRole("button", { name: "이지런 일지 수정" })).toBeNull()
    expect(screen.queryByRole("button", { name: "이 날짜에 일지 더 쓰기" })).toBeNull()
  })
})
