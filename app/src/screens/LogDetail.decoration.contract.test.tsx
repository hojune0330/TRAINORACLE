import { cleanup, fireEvent, render, screen } from "@testing-library/react"
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

async function openJournalDecorationTools(): Promise<void> {
  await userEvent.click(screen.getByRole("button", { name: "모든 꾸미기 도구" }))
}

describe("real journal decoration surface", () => {
  it("adds a free page decoration and undoes the exact saved change", async () => {
    // Given
    const user = userEvent.setup()
    storeEntries([session("one")])
    render(<LogDetail date={DATE} />)

    // When
    await user.click(screen.getByRole("button", { name: "일지 꾸미기 열기" }))
    await openJournalDecorationTools()
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
      spentPoints: 8,
      pagePlacements: [{ date: DATE, slot: "TOP_CORNER", itemId: "STICKER_WEATHER_SUN" }],
    })
    expect(saveDecorationState(seeded).ok).toBe(true)
    render(<LogDetail date={DATE} />)

    // When
    await user.click(screen.getByRole("button", { name: "일지 꾸미기 열기" }))
    await openJournalDecorationTools()
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
    await openJournalDecorationTools()
    await user.click(screen.getByRole("button", { name: "체크 테이프 제거" }))
    view.unmount()
    render(<LogDetail date={DATE} />)

    // Then
    expect(loadDecorationState().pagePlacements).toEqual([])
    expect(screen.queryByTestId("journal-slot-header-tape")).not.toBeInTheDocument()
  })

  it("reloads a saved placement and undo restores it after the next saved change", async () => {
    // Given
    const user = userEvent.setup()
    storeEntries([session("one")])
    const first = render(<LogDetail date={DATE} />)

    // When
    await user.click(screen.getByRole("button", { name: "일지 꾸미기 열기" }))
    await openJournalDecorationTools()
    await user.click(screen.getByRole("button", { name: "맑은 날 오른쪽 위에 사용" }))
    first.unmount()
    render(<LogDetail date={DATE} />)

    // Then
    expect(loadDecorationState().pagePlacements).toEqual([
      { date: DATE, slot: "TOP_CORNER", itemId: "STICKER_WEATHER_SUN" },
    ])
    expect(screen.getByTestId("journal-slot-top-corner")).toBeVisible()

    // When
    await user.click(screen.getByRole("button", { name: "일지 꾸미기 열기" }))
    await openJournalDecorationTools()
    await user.click(screen.getByRole("button", { name: "맑은 날 제거" }))
    await user.click(screen.getByRole("button", { name: "꾸미기 되돌리기" }))

    // Then
    expect(loadDecorationState().pagePlacements).toEqual([
      { date: DATE, slot: "TOP_CORNER", itemId: "STICKER_WEATHER_SUN" },
    ])
    expect(screen.getByTestId("journal-slot-top-corner")).toBeVisible()
  })

  it("allows only global theme preview on a date without a journal entry", async () => {
    // Given
    const user = userEvent.setup()
    render(<LogDetail date={DATE} />)

    // When
    await user.click(screen.getByRole("button", { name: "일지 꾸미기 열기" }))
    await openJournalDecorationTools()

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
    await openJournalDecorationTools()
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
    await openJournalDecorationTools()
    await user.click(screen.getByRole("button", { name: "맑은 날 오른쪽 위에 사용" }))

    // Then
    expect(screen.getByRole("status")).toHaveTextContent("꾸미기를 저장하지 못했어요. 일지는 그대로예요.")
    expect(loadDecorationState().pagePlacements).toEqual([])
  })

  it("moves a saved decoration with the keyboard and keeps the normalized position after remount", async () => {
    const user = userEvent.setup()
    storeEntries([session("one")])
    const base = createEmptyDecorationState()
    expect(saveDecorationState(decorationStateSchema.parse({
      ...base,
      pagePlacements: [{ date: DATE, slot: "TOP_CORNER", itemId: "STICKER_WEATHER_SUN" }],
    })).ok).toBe(true)
    const first = render(<LogDetail date={DATE} />)

    await user.click(screen.getByRole("button", { name: "일지 꾸미기 열기" }))
    const movable = screen.getByRole("button", { name: /맑은 날 선택됨/u })
    /* 정밀 이동 계약: 화살표 0.5%, Shift+화살표 2% (마스터 플랜 §2.3) */
    fireEvent.keyDown(movable, { key: "ArrowLeft", shiftKey: true })

    expect(loadDecorationState().pagePlacements[0]?.transform).toEqual({
      xPercent: 84,
      yPercent: 14,
      scale: 1,
      rotationDeg: 0,
    })
    fireEvent.keyDown(movable, { key: "ArrowLeft" })
    expect(loadDecorationState().pagePlacements[0]?.transform?.xPercent).toBe(83.5)

    first.unmount()
    render(<LogDetail date={DATE} />)
    expect(screen.getByTestId("journal-slot-top-corner").closest<HTMLElement>(".decorated-journal-page__free-item")).toHaveStyle({ left: "83.5%" })
  })

  it("deletes the selected decoration from the canvas with the on-canvas button", async () => {
    const user = userEvent.setup()
    storeEntries([session("one")])
    const base = createEmptyDecorationState()
    expect(saveDecorationState(decorationStateSchema.parse({
      ...base,
      pagePlacements: [{ date: DATE, slot: "TOP_CORNER", itemId: "STICKER_WEATHER_SUN" }],
    })).ok).toBe(true)
    render(<LogDetail date={DATE} />)

    await user.click(screen.getByRole("button", { name: "일지 꾸미기 열기" }))
    await user.click(screen.getByRole("button", { name: /맑은 날 선택됨/u }))
    await user.click(screen.getByRole("button", { name: "맑은 날 삭제" }))

    expect(loadDecorationState().pagePlacements).toEqual([])
    expect(screen.getByRole("status")).toHaveTextContent("맑은 날을 지웠어요. 되돌리기로 복구할 수 있어요.")
    /* 삭제는 확인창 없이 즉시, 되돌리기가 안전망이다. */
    await user.click(screen.getByRole("button", { name: "꾸미기 되돌리기" }))
    expect(loadDecorationState().pagePlacements).toHaveLength(1)
  })

  it("deletes the selected decoration with the Delete key", async () => {
    const user = userEvent.setup()
    storeEntries([session("one")])
    const base = createEmptyDecorationState()
    expect(saveDecorationState(decorationStateSchema.parse({
      ...base,
      pagePlacements: [{ date: DATE, slot: "TOP_CORNER", itemId: "STICKER_WEATHER_SUN" }],
    })).ok).toBe(true)
    render(<LogDetail date={DATE} />)

    await user.click(screen.getByRole("button", { name: "일지 꾸미기 열기" }))
    const movable = screen.getByRole("button", { name: /맑은 날 선택됨/u })
    await user.click(movable)
    fireEvent.keyDown(movable, { key: "Delete" })

    expect(loadDecorationState().pagePlacements).toEqual([])
  })

  it("deselects the decoration when tapping empty page space or pressing Escape", async () => {
    const user = userEvent.setup()
    storeEntries([session("one")])
    const base = createEmptyDecorationState()
    expect(saveDecorationState(decorationStateSchema.parse({
      ...base,
      pagePlacements: [{ date: DATE, slot: "TOP_CORNER", itemId: "STICKER_WEATHER_SUN" }],
    })).ok).toBe(true)
    const { container } = render(<LogDetail date={DATE} />)

    await user.click(screen.getByRole("button", { name: "일지 꾸미기 열기" }))
    const movable = screen.getByRole("button", { name: /맑은 날 선택됨/u })
    await user.click(movable)
    expect(movable.closest(".decorated-journal-page__free-item")).toHaveAttribute("data-selected", "true")

    /* Escape로 해제 */
    fireEvent.keyDown(movable, { key: "Escape" })
    expect(movable.closest(".decorated-journal-page__free-item")).not.toHaveAttribute("data-selected")

    /* 다시 선택 후 빈 곳 탭으로 해제 */
    await user.click(movable)
    expect(movable.closest(".decorated-journal-page__free-item")).toHaveAttribute("data-selected", "true")
    const page = container.querySelector(".decorated-journal-page")
    expect(page).not.toBeNull()
    if (page !== null) fireEvent.pointerDown(page)
    expect(movable.closest(".decorated-journal-page__free-item")).not.toHaveAttribute("data-selected")
  })

  it("resets scale and rotation to defaults on double tap while keeping position", async () => {
    const user = userEvent.setup()
    storeEntries([session("one")])
    const base = createEmptyDecorationState()
    expect(saveDecorationState(decorationStateSchema.parse({
      ...base,
      pagePlacements: [{
        date: DATE,
        slot: "TOP_CORNER",
        itemId: "STICKER_WEATHER_SUN",
        transform: { xPercent: 30, yPercent: 40, scale: 1.6, rotationDeg: 21 },
      }],
    })).ok).toBe(true)
    render(<LogDetail date={DATE} />)

    await user.click(screen.getByRole("button", { name: "일지 꾸미기 열기" }))
    const movable = screen.getByRole("button", { name: /맑은 날 선택됨/u })
    /* 더블탭(300ms 내 두 번) → 크기 1.0 / 회전 0°, 위치는 그대로 */
    fireEvent.click(movable)
    fireEvent.click(movable)

    expect(loadDecorationState().pagePlacements[0]?.transform).toEqual({
      xPercent: 30,
      yPercent: 40,
      scale: 1,
      rotationDeg: 0,
    })
  })

  it("redoes an undone change and clears redo on a new edit", async () => {
    const user = userEvent.setup()
    storeEntries([session("one")])
    const base = createEmptyDecorationState()
    expect(saveDecorationState(decorationStateSchema.parse({
      ...base,
      pagePlacements: [{ date: DATE, slot: "TOP_CORNER", itemId: "STICKER_WEATHER_SUN" }],
    })).ok).toBe(true)
    render(<LogDetail date={DATE} />)

    await user.click(screen.getByRole("button", { name: "일지 꾸미기 열기" }))
    const movable = screen.getByRole("button", { name: /맑은 날 선택됨/u })
    /* 1) 이동 → 2) Undo → 3) Redo 로 동일 상태 복원 */
    fireEvent.keyDown(movable, { key: "ArrowLeft", shiftKey: true })
    expect(loadDecorationState().pagePlacements[0]?.transform?.xPercent).toBe(84)

    await user.click(screen.getByRole("button", { name: "꾸미기 되돌리기" }))
    expect(loadDecorationState().pagePlacements[0]?.transform).toBeUndefined()

    await user.click(screen.getByRole("button", { name: "꾸미기 다시 실행" }))
    expect(loadDecorationState().pagePlacements[0]?.transform?.xPercent).toBe(84)

    /* Redo 후 새 편집 → future 스택이 비워져 다시 실행 버튼이 사라진다. */
    await user.click(screen.getByRole("button", { name: "꾸미기 되돌리기" }))
    fireEvent.keyDown(screen.getByRole("button", { name: /맑은 날 선택됨/u }), { key: "ArrowRight" })
    expect(screen.queryByRole("button", { name: "꾸미기 다시 실행" })).toBeNull()
  })

  it("supports Ctrl+Z / Ctrl+Y keyboard history while the editor is open", async () => {
    const user = userEvent.setup()
    storeEntries([session("one")])
    const base = createEmptyDecorationState()
    expect(saveDecorationState(decorationStateSchema.parse({
      ...base,
      pagePlacements: [{ date: DATE, slot: "TOP_CORNER", itemId: "STICKER_WEATHER_SUN" }],
    })).ok).toBe(true)
    render(<LogDetail date={DATE} />)

    await user.click(screen.getByRole("button", { name: "일지 꾸미기 열기" }))
    const movable = screen.getByRole("button", { name: /맑은 날 선택됨/u })
    fireEvent.keyDown(movable, { key: "ArrowLeft", shiftKey: true })
    expect(loadDecorationState().pagePlacements[0]?.transform?.xPercent).toBe(84)

    fireEvent.keyDown(window, { key: "z", ctrlKey: true })
    expect(loadDecorationState().pagePlacements[0]?.transform).toBeUndefined()
    fireEvent.keyDown(window, { key: "y", ctrlKey: true })
    expect(loadDecorationState().pagePlacements[0]?.transform?.xPercent).toBe(84)
  })

  it("duplicates an emoji sticker to the next free slot with a +4% offset", async () => {
    const user = userEvent.setup()
    storeEntries([session("one")])
    const base = createEmptyDecorationState()
    expect(saveDecorationState(decorationStateSchema.parse({
      ...base,
      pagePlacements: [{
        date: DATE,
        slot: "BODY_STICKER_1",
        itemId: "EMOJI_FIRE",
        transform: { xPercent: 40, yPercent: 40, scale: 1.2, rotationDeg: 10 },
      }],
    })).ok).toBe(true)
    render(<LogDetail date={DATE} />)

    await user.click(screen.getByRole("button", { name: "일지 꾸미기 열기" }))
    const movable = screen.getByRole("button", { name: /불꽃 선택됨/u })
    await user.click(movable)
    await user.click(screen.getByRole("button", { name: "불꽃 복제" }))

    const placements = loadDecorationState().pagePlacements
    expect(placements).toHaveLength(2)
    const copy = placements.find((placement) => placement.slot === "BODY_STICKER_2")
    expect(copy?.itemId).toBe("EMOJI_FIRE")
    expect(copy?.transform).toEqual({ xPercent: 44, yPercent: 44, scale: 1.2, rotationDeg: 10 })
  })

  it("refuses to duplicate when all emoji slots are full and explains why", async () => {
    const user = userEvent.setup()
    storeEntries([session("one")])
    const base = createEmptyDecorationState()
    expect(saveDecorationState(decorationStateSchema.parse({
      ...base,
      pagePlacements: [
        { date: DATE, slot: "BODY_STICKER_1", itemId: "EMOJI_FIRE" },
        { date: DATE, slot: "BODY_STICKER_2", itemId: "EMOJI_FIRE" },
        { date: DATE, slot: "BODY_STICKER_3", itemId: "EMOJI_FIRE" },
      ],
    })).ok).toBe(true)
    render(<LogDetail date={DATE} />)

    await user.click(screen.getByRole("button", { name: "일지 꾸미기 열기" }))
    const stickers = screen.getAllByRole("button", { name: /불꽃 선택됨/u })
    await user.click(stickers[0] as HTMLElement)
    await user.click(screen.getByRole("button", { name: "불꽃 복제" }))

    expect(loadDecorationState().pagePlacements).toHaveLength(3)
    expect(screen.getByRole("status")).toHaveTextContent("복제할 빈 자리가 없어요.")
  })

  it("rounds committed transforms to the precision contract (0.1% / 0.05 / 1deg)", async () => {
    const user = userEvent.setup()
    storeEntries([session("one")])
    const base = createEmptyDecorationState()
    expect(saveDecorationState(decorationStateSchema.parse({
      ...base,
      pagePlacements: [{
        date: DATE,
        slot: "TOP_CORNER",
        itemId: "STICKER_WEATHER_SUN",
        transform: { xPercent: 50, yPercent: 50, scale: 1, rotationDeg: 0 },
      }],
    })).ok).toBe(true)
    render(<LogDetail date={DATE} />)

    await user.click(screen.getByRole("button", { name: "일지 꾸미기 열기" }))
    const movable = screen.getByRole("button", { name: /맑은 날 선택됨/u })
    fireEvent.keyDown(movable, { key: "+" })

    const saved = loadDecorationState().pagePlacements[0]?.transform
    expect(saved?.scale).toBe(1.05)
    expect(Number.isInteger((saved?.rotationDeg ?? 0))).toBe(true)
    expect(Math.round((saved?.xPercent ?? 0) * 10) / 10).toBe(saved?.xPercent)
  })
})
