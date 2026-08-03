import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { JournalEntry } from "../domain/journal-schema"
import { JournalDayReader } from "./JournalDayReader"

const entries = [
  { id: "older", date: "2026-07-29" },
  { id: "current", date: "2026-08-01" },
  { id: "newer", date: "2026-08-03" },
] as JournalEntry[]

afterEach(cleanup)

describe("journal day reader surface", () => {
  it("moves only the selected journal date and keeps boundary controls honest", async () => {
    const user = userEvent.setup()
    const onDateChange = vi.fn()
    render(
      <JournalDayReader
        date="2026-08-01"
        entries={entries}
        onDateChange={onDateChange}
        onBack={vi.fn()}
      />,
    )

    expect(screen.getByText("2 / 3")).toBeVisible()
    await user.click(screen.getByRole("button", { name: "이전 일지" }))
    expect(onDateChange).toHaveBeenCalledWith("2026-07-29")
    await user.click(screen.getByRole("button", { name: "다음 일지" }))
    expect(onDateChange).toHaveBeenCalledWith("2026-08-03")
  })
})
