import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { MINJI_JOURNAL_PAGES } from "./minji-journal-data"
import { MinjiIndexDecorationThumbnail, MinjiJournal } from "./MinjiJournal"

afterEach(cleanup)

describe("Minji journal fixed page frame", () => {
  it("renders an emoji decoration as text instead of an empty image URL", () => {
    const page = MINJI_JOURNAL_PAGES[0]
    if (page === undefined) throw new Error("Minji fixture page is missing")
    const emojiPage = {
      ...page,
      decorationPreset: {
        ...page.decorationPreset,
        placements: [{ itemId: "EMOJI_SUN" as const, transform: { xPercent: 24, yPercent: 84, scale: 1, rotationDeg: -4 } }],
      },
    }
    const { container } = render(<MinjiIndexDecorationThumbnail page={emojiPage} />)

    expect(screen.getByLabelText("해 꾸미기")).toHaveTextContent("☀️")
    expect(container.querySelector("img")).toBeNull()
  })

  it("resets page-only disclosure state when the selected diary changes", async () => {
    const user = userEvent.setup()
    render(<MinjiJournal />)

    await user.click(screen.getByRole("button", { name: /첫날.*4\.6km를 달린 첫 기록/u }))
    await user.click(screen.getByRole("button", { name: "거리와 시간만 적어도 될까?" }))
    expect(screen.getByText("네. 오늘 확인한 사실만 적고 모르는 항목은 비워도 돼요.")).toBeVisible()

    await user.click(screen.getByRole("button", { name: "다음 일지" }))

    expect(screen.queryByText("네. 오늘 확인한 사실만 적고 모르는 항목은 비워도 돼요.")).toBeNull()

    await user.click(screen.getByRole("button", { name: "이전 일지" }))

    expect(screen.queryByText("네. 오늘 확인한 사실만 적고 모르는 항목은 비워도 돼요.")).toBeNull()
  })

  it("keeps fixed chrome mounted while only the dated page content changes", async () => {
    const user = userEvent.setup()
    render(<MinjiJournal />)

    await user.click(screen.getByRole("button", { name: /첫날.*4\.6km를 달린 첫 기록/u }))
    const navigator = screen.getByRole("navigation", { name: "날짜별 일지 넘기기" })
    const datedPage = screen.getByTestId("decorated-journal-content")
    const fixedFrame = datedPage.closest(".decorated-journal-page")
    expect(fixedFrame).not.toBeNull()

    await user.click(screen.getByRole("button", { name: "다음 일지" }))

    expect(screen.getByRole("navigation", { name: "날짜별 일지 넘기기" })).toBe(navigator)
    expect(screen.getByTestId("decorated-journal-content").closest(".decorated-journal-page")).toBe(fixedFrame)
    expect(screen.getByTestId("decorated-journal-content")).not.toBe(datedPage)
  })

  it("turns examples with a horizontal swipe, follows the finger, and returns the new page top", async () => {
    const user = userEvent.setup()
    const scrollIntoView = vi.fn()
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    })
    render(<MinjiJournal />)

    await user.click(screen.getByRole("button", { name: /첫날.*4\.6km를 달린 첫 기록/u }))
    const page = document.querySelector<HTMLElement>(".minji-page")
    expect(page).not.toBeNull()
    if (page === null) return

    fireEvent.touchStart(page, { changedTouches: [{ clientX: 250, clientY: 220 }] })
    fireEvent.touchMove(page, {
      touches: [{ clientX: 170, clientY: 222 }],
      changedTouches: [{ clientX: 170, clientY: 222 }],
    })
    expect(page.style.getPropertyValue("--journal-swipe-offset")).toBe("-12.8px")
    fireEvent.touchEnd(page, { changedTouches: [{ clientX: 120, clientY: 223 }] })

    expect(screen.getAllByText("2 / 6")[0]).toBeVisible()
    await waitFor(() => expect(scrollIntoView).toHaveBeenLastCalledWith({
      behavior: "smooth",
      block: "start",
      inline: "nearest",
    }))
    expect(scrollIntoView.mock.instances.at(-1)).toBe(document.querySelector(".minji-page > .decorated-journal-page"))
    expect(page.style.getPropertyValue("--journal-swipe-offset")).toBe("0px")
  })

  it("does not turn a page when the gesture begins on a page control", async () => {
    const user = userEvent.setup()
    render(<MinjiJournal />)
    await user.click(screen.getByRole("button", { name: /첫날.*4\.6km를 달린 첫 기록/u }))
    const disclosure = screen.getByRole("button", { name: "거리와 시간만 적어도 될까?" })

    fireEvent.touchStart(disclosure, { changedTouches: [{ clientX: 250, clientY: 220 }] })
    fireEvent.touchEnd(disclosure, { changedTouches: [{ clientX: 120, clientY: 222 }] })

    expect(screen.getAllByText("1 / 6")[0]).toBeVisible()
  })
})
