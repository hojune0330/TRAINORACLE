import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  DECORATION_STORAGE_KEY_V2,
  createEmptyDecorationState,
  decorationStateSchema,
  loadDecorationState,
  saveDecorationState,
} from "../domain/decorations"
import type { JournalEntry } from "../domain/journal-schema"
import { replaceAllEntries } from "../domain/journal-store"
import { JournalDayReader } from "./JournalDayReader"
import { LogDetail } from "./LogDetail"

const DATE = "2026-08-01"
const NEXT_DATE = "2026-08-03"

function session(id: string, date: string = DATE): JournalEntry {
  return {
    id,
    kind: "post-session",
    date,
    savedAt: `${date}T09:00:00.000Z`,
    syncState: "local",
    system: "base",
    title: "가벼운 조깅",
    distanceKm: "5",
    durationMin: "28",
    avgPace: "5:36",
    rpe: 4,
    memo: "",
  }
}

function storeEntries(entries: readonly JournalEntry[]): void {
  const result = replaceAllEntries(entries)
  if (!result.ok) throw new Error("journal fixture save failed")
}

beforeEach(() => {
  window.localStorage.clear()
  window.history.replaceState({}, "", "/?app=1")
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  window.localStorage.clear()
})

describe("real journal decoration surface", () => {
  it("adds a free page decoration and undoes the exact saved change", async () => {
    // Given
    const user = userEvent.setup()
    storeEntries([session("one")])
    render(<LogDetail date={DATE} />)

    // When
    await user.click(screen.getByRole("button", { name: "일지 꾸미기 열기" }))
    await user.click(screen.getByRole("button", { name: "맑은 날 오른쪽 위에 사용" }))

    // Then
    expect(loadDecorationState().pagePlacements).toEqual([
      { date: DATE, slot: "TOP_CORNER", itemId: "STICKER_WEATHER_SUN" },
    ])
    expect(screen.getByTestId("journal-slot-top-corner")).toBeVisible()

    // When
    await user.click(screen.getByRole("button", { name: "꾸미기 되돌리기" }))

    // Then
    expect(loadDecorationState().pagePlacements).toEqual([])
    expect(screen.queryByTestId("journal-slot-top-corner")).not.toBeInTheDocument()
  })

  it("names both items before replacing an occupied slot", async () => {
    // Given
    const user = userEvent.setup()
    storeEntries([session("one")])
    const base = createEmptyDecorationState()
    const seeded = decorationStateSchema.parse({
      ...base,
      ownedItemIds: [...base.ownedItemIds, "STICKER_FINISH_LINE"],
      pagePlacements: [{ date: DATE, slot: "TOP_CORNER", itemId: "STICKER_WEATHER_SUN" }],
    })
    expect(saveDecorationState(seeded).ok).toBe(true)
    render(<LogDetail date={DATE} />)

    // When
    await user.click(screen.getByRole("button", { name: "일지 꾸미기 열기" }))
    await user.click(screen.getByRole("button", { name: "결승선 스티커 오른쪽 위에 사용" }))

    // Then
    const dialog = screen.getByRole("alertdialog", { name: "꾸미기 교체 확인" })
    expect(dialog).toHaveTextContent("맑은 날")
    expect(dialog).toHaveTextContent("결승선 스티커")
    expect(loadDecorationState().pagePlacements[0]?.itemId).toBe("STICKER_WEATHER_SUN")

    // When
    await user.click(screen.getByRole("button", { name: "교체하기" }))

    // Then
    expect(loadDecorationState().pagePlacements[0]?.itemId).toBe("STICKER_FINISH_LINE")
  })

  it("removes a saved placement and keeps it removed after remount", async () => {
    // Given
    const user = userEvent.setup()
    storeEntries([session("one")])
    const base = createEmptyDecorationState()
    expect(saveDecorationState(decorationStateSchema.parse({
      ...base,
      pagePlacements: [{ date: DATE, slot: "HEADER_TAPE", itemId: "TAPE_CHECKER" }],
    })).ok).toBe(true)
    const view = render(<LogDetail date={DATE} />)

    // When
    await user.click(screen.getByRole("button", { name: "일지 꾸미기 열기" }))
    await user.click(screen.getByRole("button", { name: "체크 테이프 제거" }))
    view.unmount()
    render(<LogDetail date={DATE} />)

    // Then
    expect(loadDecorationState().pagePlacements).toEqual([])
    expect(screen.queryByTestId("journal-slot-header-tape")).not.toBeInTheDocument()
  })

  it("allows only global theme preview on a date without a journal entry", async () => {
    // Given
    const user = userEvent.setup()
    render(<LogDetail date={DATE} />)

    // When
    await user.click(screen.getByRole("button", { name: "일지 꾸미기 열기" }))

    // Then
    expect(screen.getByText("기록이 없는 날에는 테마만 미리 볼 수 있어요.")).toBeVisible()
    expect(screen.getByRole("button", { name: "하늘 일지 테마 미리보기" })).toBeVisible()
    await user.click(screen.getByRole("button", { name: "하늘 일지 테마 미리보기" }))
    expect(screen.getByTestId("journal-page-theme").closest("section")).toHaveAttribute("data-theme-id", "THEME_SKY_JOURNAL")
    expect(screen.queryByRole("button", { name: "하늘 일지 테마 사용하기" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "맑은 날 오른쪽 위에 사용" })).not.toBeInTheDocument()
  })

  it("cancels an unsaved preview when the reader changes dates", async () => {
    // Given
    const user = userEvent.setup()
    const entries = [session("one"), session("two", NEXT_DATE)]
    storeEntries(entries)
    render(
      <JournalDayReader
        date={DATE}
        entries={entries}
        onDateChange={vi.fn()}
        onBack={vi.fn()}
      />,
    )
    await user.click(screen.getByRole("button", { name: "일지 꾸미기 열기" }))
    await user.click(screen.getByRole("button", { name: "하늘 일지 테마 미리보기" }))
    expect(screen.getByText("하늘 일지 테마 미리보기 중")).toBeVisible()

    // When
    cleanup()
    render(
      <JournalDayReader
        date={NEXT_DATE}
        entries={entries}
        onDateChange={vi.fn()}
        onBack={vi.fn()}
      />,
    )

    // Then
    expect(screen.queryByText("하늘 일지 테마 미리보기 중")).not.toBeInTheDocument()
    expect(loadDecorationState().equipped.themeId).toBe("THEME_TRACK_NOTEBOOK")
  })

  it("does not claim success when decoration storage rejects a page change", async () => {
    // Given
    const user = userEvent.setup()
    storeEntries([session("one")])
    const realSetItem = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key: string, value: string) {
      if (key === DECORATION_STORAGE_KEY_V2) throw new Error("quota")
      realSetItem.call(this, key, value)
    })
    render(<LogDetail date={DATE} />)

    // When
    await user.click(screen.getByRole("button", { name: "일지 꾸미기 열기" }))
    await user.click(screen.getByRole("button", { name: "맑은 날 오른쪽 위에 사용" }))

    // Then
    expect(screen.getByRole("status")).toHaveTextContent("꾸미기를 저장하지 못했어요. 일지는 그대로예요.")
    expect(loadDecorationState().pagePlacements).toEqual([])
  })
})
