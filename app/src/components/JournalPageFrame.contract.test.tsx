import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { createEmptyDecorationState, decorationStateSchema } from "../domain/decorations"
import { DecoratedJournalPageFrame } from "./DecoratedJournalPageFrame"
import { JournalPageNavigator } from "./JournalPageNavigator"

afterEach(cleanup)

describe("decorated journal page frame", () => {
  it("renders the chosen theme, avatar, and only the selected date's free-placement decorations", () => {
    const state = decorationStateSchema.parse({
      ...createEmptyDecorationState(),
      ownedItemIds: [
        ...createEmptyDecorationState().ownedItemIds,
        "THEME_SKY_JOURNAL",
        "STICKER_FINISH_LINE",
        "AVATAR_START_LINE",
      ],
      spentPoints: 40,
      equipped: {
        themeId: "THEME_SKY_JOURNAL",
        inkId: "INK_NAVY",
        avatarId: "AVATAR_START_LINE",
      },
      pages: [
        {
          date: "2026-08-01",
          items: [
            { itemId: "TAPE_CHECKER", transform: { xPercent: 50, yPercent: 9, scale: 1, rotationDeg: 0 } },
            { itemId: "STICKER_FINISH_LINE", transform: { xPercent: 86, yPercent: 14, scale: 1, rotationDeg: 0 } },
          ],
        },
        {
          date: "2026-07-31",
          items: [{ itemId: "STAMP_REST_DAY", transform: { xPercent: 50, yPercent: 91, scale: 1, rotationDeg: 0 } }],
        },
      ],
    })

    render(
      <DecoratedJournalPageFrame date="2026-08-01" state={state}>
        <p>오늘 훈련 기록</p>
      </DecoratedJournalPageFrame>,
    )

    expect(screen.getByTestId("journal-page-theme")).toHaveAttribute("src", expect.stringContaining("theme-sky-journal.webp"))
    expect(screen.getByTestId("journal-page-avatar")).toHaveAttribute("src", expect.stringContaining("avatar-start-line.webp"))
    expect(screen.getByTestId("journal-decoration-item-0")).toBeVisible()
    expect(screen.getByTestId("journal-decoration-item-1")).toBeVisible()
    /* 2026-07-31 페이지의 도장은 이 날짜에 그리지 않는다. */
    expect(screen.queryByTestId("journal-decoration-item-2")).not.toBeInTheDocument()
    expect(screen.getByText("오늘 훈련 기록")).toBeVisible()
  })
})

describe("journal page navigator", () => {
  it("keeps clear boundary states and uses the supplied previous and next actions", async () => {
    const user = userEvent.setup()
    const onPrevious = vi.fn()
    const onNext = vi.fn()
    const { rerender } = render(
      <JournalPageNavigator position={2} total={3} onPrevious={onPrevious} onNext={onNext} />,
    )

    await user.click(screen.getByRole("button", { name: "이전 일지" }))
    await user.click(screen.getByRole("button", { name: "다음 일지" }))
    expect(onPrevious).toHaveBeenCalledOnce()
    expect(onNext).toHaveBeenCalledOnce()
    expect(screen.getByText("2 / 3")).toBeVisible()

    rerender(<JournalPageNavigator position={1} total={3} onPrevious={undefined} onNext={onNext} />)
    expect(screen.getByRole("button", { name: "이전 일지" })).toBeDisabled()
  })
})
