import { cleanup, fireEvent, render, screen } from "@testing-library/react"
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

  it("keeps the navigator mounted while replacing only the dated page and ignores decoration-panel keys", () => {
    const onDateChange = vi.fn()
    const { rerender } = render(
      <JournalDayReader
        date="2026-08-01"
        entries={entries}
        onDateChange={onDateChange}
        onBack={vi.fn()}
      />,
    )
    const navigator = screen.getByRole("navigation", { name: "날짜별 일지 넘기기" })
    const datedPage = screen.getByTestId("decorated-journal-content")

    rerender(
      <JournalDayReader
        date="2026-08-03"
        entries={entries}
        onDateChange={onDateChange}
        onBack={vi.fn()}
      />,
    )

    expect(screen.getByRole("navigation", { name: "날짜별 일지 넘기기" })).toBe(navigator)
    expect(screen.getByTestId("decorated-journal-content")).not.toBe(datedPage)

    const panel = document.createElement("div")
    panel.dataset.decorationInteraction = "true"
    const panelButton = document.createElement("button")
    panel.append(panelButton)
    document.body.append(panel)
    panelButton.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowLeft" }))
    expect(onDateChange).not.toHaveBeenCalled()

    const readerSurface = document.querySelector(".journal-day-reader")
    expect(readerSurface).not.toBeNull()
    readerSurface?.append(panel)
    fireEvent.touchStart(panelButton, { changedTouches: [{ clientX: 240, clientY: 200 }] })
    fireEvent.touchEnd(panelButton, { changedTouches: [{ clientX: 120, clientY: 202 }] })
    expect(onDateChange).not.toHaveBeenCalled()
    panel.remove()
  })

  it("clears a canceled swipe so the next touch does not reuse stale coordinates", () => {
    const onDateChange = vi.fn()
    const { container } = render(
      <JournalDayReader
        date="2026-08-01"
        entries={entries}
        onDateChange={onDateChange}
        onBack={vi.fn()}
      />,
    )

    const readerSurface = container.querySelector(".journal-day-reader")
    expect(readerSurface).not.toBeNull()
    if (readerSurface === null) return

    fireEvent.touchStart(readerSurface, { changedTouches: [{ clientX: 240, clientY: 200 }] })
    fireEvent.touchCancel(readerSurface, { changedTouches: [{ clientX: 240, clientY: 200 }] })
    fireEvent.touchEnd(readerSurface, { changedTouches: [{ clientX: 120, clientY: 202 }] })

    expect(onDateChange).not.toHaveBeenCalled()
  })
})
