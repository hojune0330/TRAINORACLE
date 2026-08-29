import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it } from "vitest"
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
        placements: [{ slot: "BODY_STICKER_1" as const, itemId: "EMOJI_SUN" as const }],
      },
    }
    const { container } = render(<MinjiIndexDecorationThumbnail page={emojiPage} />)

    expect(screen.getByLabelText("해 꾸미기")).toHaveTextContent("☀️")
    expect(container.querySelector("img")).toBeNull()
  })

  it("resets page-only disclosure state when the selected diary changes", async () => {
    const user = userEvent.setup()
    render(<MinjiJournal />)

    await user.click(screen.getByRole("button", { name: /첫날.*처음 적은 한 줄/u }))
    await user.click(screen.getByRole("button", { name: "이 정도만 적어도 될까?" }))
    expect(screen.getByText("괜찮아요. 기억하고 싶은 사실 한두 개만 남겨도 충분해요.")).toBeVisible()

    await user.click(screen.getByRole("button", { name: "다음 일지" }))

    expect(screen.queryByText("괜찮아요. 기억하고 싶은 사실 한두 개만 남겨도 충분해요.")).toBeNull()

    await user.click(screen.getByRole("button", { name: "이전 일지" }))

    expect(screen.queryByText("괜찮아요. 기억하고 싶은 사실 한두 개만 남겨도 충분해요.")).toBeNull()
  })

  it("keeps fixed chrome mounted while only the dated page content changes", async () => {
    const user = userEvent.setup()
    render(<MinjiJournal />)

    await user.click(screen.getByRole("button", { name: /첫날.*처음 적은 한 줄/u }))
    const navigator = screen.getByRole("navigation", { name: "날짜별 일지 넘기기" })
    const datedPage = screen.getByTestId("decorated-journal-content")
    const fixedFrame = datedPage.closest(".decorated-journal-page")
    expect(fixedFrame).not.toBeNull()

    await user.click(screen.getByRole("button", { name: "다음 일지" }))

    expect(screen.getByRole("navigation", { name: "날짜별 일지 넘기기" })).toBe(navigator)
    expect(screen.getByTestId("decorated-journal-content").closest(".decorated-journal-page")).toBe(fixedFrame)
    expect(screen.getByTestId("decorated-journal-content")).not.toBe(datedPage)
  })
})
