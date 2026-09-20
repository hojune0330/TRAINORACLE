import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
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
  it.each([
    ["home", "홈으로 돌아가기", "홈"],
    ["rewards", "일지 꾸미기·포인트로 돌아가기", "꾸미기"],
  ] as const)("names the actual return destination: %s", (backDestination, description, label) => {
    const onBack = vi.fn()
    render(<JournalDayReader date="2026-08-01" entries={entries} onDateChange={vi.fn()} onBack={onBack} backDestination={backDestination} />)
    const back = screen.getByRole("button", { name: description })
    expect(back).toHaveTextContent(label)
    fireEvent.click(back)
    expect(onBack).toHaveBeenCalledOnce()
  })

  it("moves only the selected journal date and keeps boundary controls honest", async () => {
    const user = userEvent.setup()
    const onDateChange = vi.fn()
    const onBack = vi.fn()
    render(
      <JournalDayReader
        date="2026-08-01"
        entries={entries}
        onDateChange={onDateChange}
        onBack={onBack}
      />,
    )

    expect(screen.getByText("2 / 3")).toBeVisible()
    await user.click(screen.getByRole("button", { name: "일지 목록으로 돌아가기" }))
    expect(onBack).toHaveBeenCalledOnce()
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
    fireEvent.touchStart(panelButton, {
      touches: [{ clientX: 240, clientY: 200 }],
      changedTouches: [{ clientX: 240, clientY: 200 }],
    })
    fireEvent.touchEnd(panelButton, { touches: [], changedTouches: [{ clientX: 120, clientY: 202 }] })
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

    fireEvent.touchStart(readerSurface, {
      touches: [{ clientX: 240, clientY: 200 }],
      changedTouches: [{ clientX: 240, clientY: 200 }],
    })
    fireEvent.touchCancel(readerSurface, { changedTouches: [{ clientX: 240, clientY: 200 }] })
    fireEvent.touchEnd(readerSurface, { touches: [], changedTouches: [{ clientX: 120, clientY: 202 }] })

    expect(onDateChange).not.toHaveBeenCalled()
  })

  it("leaves two-finger gestures to browser zoom instead of turning the diary page", () => {
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

    fireEvent.touchStart(readerSurface, {
      touches: [{ clientX: 240, clientY: 200 }, { clientX: 180, clientY: 240 }],
      changedTouches: [{ clientX: 240, clientY: 200 }],
    })
    fireEvent.touchEnd(readerSurface, {
      touches: [{ clientX: 180, clientY: 240 }],
      changedTouches: [{ clientX: 100, clientY: 202 }],
    })

    expect(onDateChange).not.toHaveBeenCalled()
  })

  it("returns the newly selected real diary to the compact reader header", async () => {
    const scrolledElements: HTMLElement[] = []
    const scrollIntoView = vi.fn(function (this: HTMLElement) {
      scrolledElements.push(this)
    })
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    })
    const onDateChange = vi.fn()
    const { rerender } = render(
      <JournalDayReader
        date="2026-08-01"
        entries={entries}
        onDateChange={onDateChange}
        onBack={vi.fn()}
      />,
    )

    rerender(
      <JournalDayReader
        date="2026-08-03"
        entries={entries}
        onDateChange={onDateChange}
        onBack={vi.fn()}
      />,
    )

    await waitFor(() => expect(scrollIntoView).toHaveBeenLastCalledWith({
      behavior: "smooth",
      block: "start",
      inline: "nearest",
    }))
    expect(scrolledElements.at(-1)).toHaveClass("journal-day-reader")
  })
})
