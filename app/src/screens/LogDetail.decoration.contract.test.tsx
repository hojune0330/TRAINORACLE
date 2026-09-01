import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  DECORATION_STORAGE_KEY_V3,
  MAX_DECORATION_ITEMS_PER_PAGE,
  createEmptyDecorationState,
  decorationStateSchema,
  loadDecorationState,
  saveDecorationState,
} from "../domain/decorations"
import { journalDecorationItems } from "../domain/journal-decoration-state"
import type { JournalEntry } from "../domain/journal-schema"
import { replaceAllEntries } from "../domain/journal-store"
import { JournalDayReader } from "./JournalDayReader"
import { LogDetail } from "./LogDetail"

const DATE = "2026-08-01"
const NEXT_DATE = "2026-08-03"

const T = (x: number, y: number, scale = 1, rotationDeg = 0) =>
  ({ xPercent: x, yPercent: y, scale, rotationDeg }) as const

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

function seedPage(items: readonly { itemId: string; transform: ReturnType<typeof T> }[], extraOwned: readonly string[] = [], spentPoints = 0): void {
  const base = createEmptyDecorationState()
  const state = decorationStateSchema.parse({
    ...base,
    ownedItemIds: [...base.ownedItemIds, ...extraOwned],
    spentPoints,
    pages: items.length === 0 ? [] : [{ date: DATE, items }],
  })
  if (!saveDecorationState(state).ok) throw new Error("decoration fixture save failed")
}

function pageItems() {
  return journalDecorationItems(loadDecorationState(), DATE)
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
    await user.click(screen.getByRole("button", { name: "맑은 날 붙이기" }))

    // Then: 첫 장식은 첫 번째 격자 좌표에 붙고 배열 끝(최상단)에 놓인다.
    expect(pageItems()).toEqual([
      { itemId: "STICKER_WEATHER_SUN", transform: T(18, 18) },
    ])
    expect(screen.getByTestId("journal-decoration-item-0")).toBeVisible()

    // When
    await user.click(screen.getByRole("button", { name: "꾸미기 되돌리기" }))

    // Then
    expect(loadDecorationState().pages).toEqual([])
    expect(screen.queryByTestId("journal-decoration-item-0")).not.toBeInTheDocument()
  })

  it("shows a visual material drawer with category chips and no removal action", async () => {
    const user = userEvent.setup()
    storeEntries([session("one")])
    seedPage([{ itemId: "STICKER_WEATHER_SUN", transform: T(18, 18) }])
    const { container } = render(<LogDetail date={DATE} />)

    await user.click(screen.getByRole("button", { name: "일지 꾸미기 열기" }))
    await openJournalDecorationTools()

    expect(screen.getByRole("group", { name: "꾸미기 재료 종류" })).toBeVisible()
    expect(screen.getByRole("button", { name: "스티커" })).toBeVisible()
    expect(screen.getByRole("button", { name: "도장" })).toBeVisible()
    expect(screen.getByRole("button", { name: "테이프" })).toBeVisible()
    expect(screen.getByRole("button", { name: "아바타" })).toBeVisible()
    expect(screen.getByRole("button", { name: "꾸미기 재료 도구" })).toBeVisible()
    expect(container.querySelectorAll(".journal-decoration-toolbar__material-tile").length).toBe(36)
    expect(screen.queryByRole("button", { name: /제거/u })).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "꾸미기 재료 도구" }))
    expect(screen.getByRole("button", { name: "맑은 날 붙이기" })).toBeVisible()
    expect(screen.queryByRole("button", { name: /^기본 · 트랙 노트/u })).not.toBeInTheDocument()
  })

  it("expands a paid item confirmation inline and explains insufficient points", async () => {
    const user = userEvent.setup()
    storeEntries([session("one")])
    render(<LogDetail date={DATE} />)

    await user.click(screen.getByRole("button", { name: "일지 꾸미기 열기" }))
    await openJournalDecorationTools()
    await user.click(screen.getByRole("button", { name: "결승선 스티커 8P로 받기" }))

    const confirmation = screen.getByRole("group", { name: "결승선 스티커 받기 확인" })
    expect(confirmation).toBeVisible()
    expect(confirmation).toHaveTextContent("8P 더 필요해요.")
    expect(screen.getByRole("button", { name: "8P로 받기" })).toBeDisabled()
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
  })

  it("clears an equipped avatar through the category default tile", async () => {
    const user = userEvent.setup()
    storeEntries([session("one")])
    const base = createEmptyDecorationState()
    const state = decorationStateSchema.parse({
      ...base,
      ownedItemIds: [...base.ownedItemIds, "AVATAR_START_LINE"],
      spentPoints: 20,
      equipped: { ...base.equipped, avatarId: "AVATAR_START_LINE" },
    })
    if (!saveDecorationState(state).ok) throw new Error("avatar fixture save failed")
    render(<LogDetail date={DATE} />)

    await user.click(screen.getByRole("button", { name: "일지 꾸미기 열기" }))
    await openJournalDecorationTools()
    await user.click(screen.getByRole("button", { name: "아바타" }))
    await user.click(screen.getByRole("button", { name: "아바타 없음 적용하기" }))

    expect(loadDecorationState().equipped.avatarId).toBeNull()
    expect(screen.getByRole("status")).toHaveTextContent("아바타를 기본 상태로 바꿨어요.")
  })

  it("stacks a second decoration on top instead of asking to replace", async () => {
    // Given: v3 자유 배치 — 교체 확인 다이얼로그가 존재하지 않는다 (계약 §6).
    const user = userEvent.setup()
    storeEntries([session("one")])
    seedPage([{ itemId: "STICKER_WEATHER_SUN", transform: T(86, 14) }], ["STICKER_FINISH_LINE"], 8)
    render(<LogDetail date={DATE} />)

    // When
    await user.click(screen.getByRole("button", { name: "일지 꾸미기 열기" }))
    await openJournalDecorationTools()
    await user.click(screen.getByRole("button", { name: "결승선 스티커 붙이기" }))

    // Then: 둘 다 남고, 나중 것이 배열 끝(최상단)이다.
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    expect(pageItems().map((item) => item.itemId)).toEqual([
      "STICKER_WEATHER_SUN",
      "STICKER_FINISH_LINE",
    ])
    expect(screen.getByTestId("journal-decoration-item-1")).toBeVisible()
  })

  it("removes a saved placement and keeps it removed after remount", async () => {
    // Given
    const user = userEvent.setup()
    storeEntries([session("one")])
    seedPage([{ itemId: "TAPE_CHECKER", transform: T(50, 9) }])
    const view = render(<LogDetail date={DATE} />)

    // When
    await user.click(screen.getByRole("button", { name: "일지 꾸미기 열기" }))
    await user.click(screen.getByTestId("journal-decoration-item-0"))
    await user.click(screen.getByRole("button", { name: "체크 테이프 삭제" }))
    view.unmount()
    render(<LogDetail date={DATE} />)

    // Then
    expect(loadDecorationState().pages).toEqual([])
    expect(screen.queryByTestId("journal-decoration-item-0")).not.toBeInTheDocument()
  })

  it("reloads a saved placement and undo restores it after the next saved change", async () => {
    // Given
    const user = userEvent.setup()
    storeEntries([session("one")])
    const first = render(<LogDetail date={DATE} />)

    // When
    await user.click(screen.getByRole("button", { name: "일지 꾸미기 열기" }))
    await openJournalDecorationTools()
    await user.click(screen.getByRole("button", { name: "맑은 날 붙이기" }))
    first.unmount()
    render(<LogDetail date={DATE} />)

    // Then
    expect(pageItems()).toEqual([
      { itemId: "STICKER_WEATHER_SUN", transform: T(18, 18) },
    ])
    expect(screen.getByTestId("journal-decoration-item-0")).toBeVisible()

    // When
    await user.click(screen.getByRole("button", { name: "일지 꾸미기 열기" }))
    await user.click(screen.getByTestId("journal-decoration-item-0"))
    await user.click(screen.getByRole("button", { name: "맑은 날 삭제" }))
    await user.click(screen.getByRole("button", { name: "꾸미기 되돌리기" }))

    // Then
    expect(pageItems()).toEqual([
      { itemId: "STICKER_WEATHER_SUN", transform: T(18, 18) },
    ])
    expect(screen.getByTestId("journal-decoration-item-0")).toBeVisible()
  })

  it("allows only global theme preview on a date without a journal entry", async () => {
    // Given
    const user = userEvent.setup()
    seedPage([], ["THEME_SKY_JOURNAL"], 12)
    render(<LogDetail date={DATE} />)

    // When
    await user.click(screen.getByRole("button", { name: "일지 꾸미기 열기" }))
    await openJournalDecorationTools()

    // Then
    expect(screen.getByText("기록을 남기기 전에는 테마만 미리 볼 수 있어요.")).toBeVisible()
    expect(screen.getByRole("button", { name: "하늘 일지 테마 적용하기" })).toBeVisible()
    await user.click(screen.getByRole("button", { name: "하늘 일지 테마 적용하기" }))
    expect(screen.getByTestId("journal-page-theme").closest("section")).toHaveAttribute("data-theme-id", "THEME_SKY_JOURNAL")
    const blockedSticker = screen.getByRole("button", { name: /^맑은 날 사용할 수 없음/u })
    expect(blockedSticker).toHaveAttribute("aria-disabled", "true")
    await user.click(blockedSticker)
    expect(screen.getByRole("status")).toHaveTextContent("기록을 먼저 남기면 붙일 수 있어요.")
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
    const skyTheme = screen.getByRole("button", { name: "하늘 일지 테마 12P로 받기" })
    fireEvent.pointerEnter(skyTheme, { pointerType: "mouse" })
    await new Promise((resolve) => window.setTimeout(resolve, 650))
    expect(screen.getByTestId("journal-page-theme").closest("section")).toHaveAttribute("data-theme-id", "THEME_SKY_JOURNAL")

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
    expect(screen.getByTestId("journal-page-theme").closest("section")).toHaveAttribute("data-theme-id", "THEME_TRACK_NOTEBOOK")
    expect(loadDecorationState().equipped.themeId).toBe("THEME_TRACK_NOTEBOOK")
  })

  it("does not claim success when decoration storage rejects a page change", async () => {
    // Given
    const user = userEvent.setup()
    storeEntries([session("one")])
    const realSetItem = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key: string, value: string) {
      if (key === DECORATION_STORAGE_KEY_V3) throw new Error("quota")
      realSetItem.call(this, key, value)
    })
    render(<LogDetail date={DATE} />)

    // When
    await user.click(screen.getByRole("button", { name: "일지 꾸미기 열기" }))
    await openJournalDecorationTools()
    await user.click(screen.getByRole("button", { name: "맑은 날 붙이기" }))

    // Then
    expect(screen.getByRole("status")).toHaveTextContent("꾸미기를 저장하지 못했어요. 일지는 그대로예요.")
    expect(loadDecorationState().pages).toEqual([])
  })

  it("moves a saved decoration with the keyboard and keeps the normalized position after remount", async () => {
    const user = userEvent.setup()
    storeEntries([session("one")])
    seedPage([{ itemId: "STICKER_WEATHER_SUN", transform: T(86, 14) }])
    const first = render(<LogDetail date={DATE} />)

    await user.click(screen.getByRole("button", { name: "일지 꾸미기 열기" }))
    const movable = screen.getByTestId("journal-decoration-item-0")
    await user.click(movable)
    expect(movable).toHaveAttribute("aria-label", expect.stringContaining("선택됨"))
    /* 정밀 이동 계약: 화살표 0.5%, Shift+화살표 2% (마스터 플랜 §2.3) */
    fireEvent.keyDown(movable, { key: "ArrowLeft", shiftKey: true })

    expect(pageItems()[0]?.transform).toEqual(T(84, 14))
    fireEvent.keyDown(movable, { key: "ArrowLeft" })
    expect(pageItems()[0]?.transform.xPercent).toBe(83.5)

    first.unmount()
    render(<LogDetail date={DATE} />)
    expect(screen.getByTestId("journal-decoration-item-0")).toHaveStyle({ left: "83.5%" })
  })

  it("deletes the selected decoration from the canvas with the on-canvas button", async () => {
    const user = userEvent.setup()
    storeEntries([session("one")])
    seedPage([{ itemId: "STICKER_WEATHER_SUN", transform: T(86, 14) }])
    render(<LogDetail date={DATE} />)

    await user.click(screen.getByRole("button", { name: "일지 꾸미기 열기" }))
    await user.click(screen.getByTestId("journal-decoration-item-0"))
    await user.click(screen.getByRole("button", { name: "맑은 날 삭제" }))

    expect(loadDecorationState().pages).toEqual([])
    expect(screen.getByRole("status")).toHaveTextContent("맑은 날을 지웠어요. 되돌리기로 복구할 수 있어요.")
    /* 삭제는 확인창 없이 즉시, 되돌리기가 안전망이다. */
    await user.click(screen.getByRole("button", { name: "꾸미기 되돌리기" }))
    expect(pageItems()).toHaveLength(1)
  })

  it("deletes the selected decoration with the Delete key", async () => {
    const user = userEvent.setup()
    storeEntries([session("one")])
    seedPage([{ itemId: "STICKER_WEATHER_SUN", transform: T(86, 14) }])
    render(<LogDetail date={DATE} />)

    await user.click(screen.getByRole("button", { name: "일지 꾸미기 열기" }))
    const movable = screen.getByTestId("journal-decoration-item-0")
    await user.click(movable)
    fireEvent.keyDown(movable, { key: "Delete" })

    expect(loadDecorationState().pages).toEqual([])
  })

  it("deselects the decoration when tapping empty page space or pressing Escape", async () => {
    const user = userEvent.setup()
    storeEntries([session("one")])
    seedPage([{ itemId: "STICKER_WEATHER_SUN", transform: T(86, 14) }])
    const { container } = render(<LogDetail date={DATE} />)

    await user.click(screen.getByRole("button", { name: "일지 꾸미기 열기" }))
    const movable = screen.getByTestId("journal-decoration-item-0")
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
    seedPage([{ itemId: "STICKER_WEATHER_SUN", transform: T(30, 40, 1.6, 21) }])
    render(<LogDetail date={DATE} />)

    await user.click(screen.getByRole("button", { name: "일지 꾸미기 열기" }))
    const movable = screen.getByTestId("journal-decoration-item-0")
    /* 더블탭(300ms 내 두 번) → 크기 1.0 / 회전 0°, 위치는 그대로 */
    fireEvent.click(movable)
    fireEvent.click(movable)

    expect(pageItems()[0]?.transform).toEqual(T(30, 40, 1, 0))
  })

  it("redoes an undone change and clears redo on a new edit", async () => {
    const user = userEvent.setup()
    storeEntries([session("one")])
    seedPage([{ itemId: "STICKER_WEATHER_SUN", transform: T(86, 14) }])
    render(<LogDetail date={DATE} />)

    await user.click(screen.getByRole("button", { name: "일지 꾸미기 열기" }))
    const movable = screen.getByTestId("journal-decoration-item-0")
    await user.click(movable)
    /* 1) 이동 → 2) Undo → 3) Redo 로 동일 상태 복원 */
    fireEvent.keyDown(movable, { key: "ArrowLeft", shiftKey: true })
    expect(pageItems()[0]?.transform.xPercent).toBe(84)

    await user.click(screen.getByRole("button", { name: "꾸미기 되돌리기" }))
    expect(pageItems()[0]?.transform.xPercent).toBe(86)

    await user.click(screen.getByRole("button", { name: "꾸미기 다시 실행" }))
    expect(pageItems()[0]?.transform.xPercent).toBe(84)

    /* Redo 후 새 편집 → future 스택이 비워져 다시 실행 버튼이 사라진다. */
    await user.click(screen.getByRole("button", { name: "꾸미기 되돌리기" }))
    fireEvent.keyDown(screen.getByTestId("journal-decoration-item-0"), { key: "ArrowRight" })
    expect(screen.queryByRole("button", { name: "꾸미기 다시 실행" })).toBeNull()
  })

  it("supports Ctrl+Z / Ctrl+Y keyboard history while the editor is open", async () => {
    const user = userEvent.setup()
    storeEntries([session("one")])
    seedPage([{ itemId: "STICKER_WEATHER_SUN", transform: T(86, 14) }])
    render(<LogDetail date={DATE} />)

    await user.click(screen.getByRole("button", { name: "일지 꾸미기 열기" }))
    const movable = screen.getByTestId("journal-decoration-item-0")
    await user.click(movable)
    fireEvent.keyDown(movable, { key: "ArrowLeft", shiftKey: true })
    expect(pageItems()[0]?.transform.xPercent).toBe(84)

    fireEvent.keyDown(window, { key: "z", ctrlKey: true })
    expect(pageItems()[0]?.transform.xPercent).toBe(86)
    fireEvent.keyDown(window, { key: "y", ctrlKey: true })
    expect(pageItems()[0]?.transform.xPercent).toBe(84)
  })

  it("duplicates a decoration to the top of the stack with a +4% offset", async () => {
    const user = userEvent.setup()
    storeEntries([session("one")])
    seedPage([{ itemId: "EMOJI_FIRE", transform: T(40, 40, 1.2, 10) }])
    render(<LogDetail date={DATE} />)

    await user.click(screen.getByRole("button", { name: "일지 꾸미기 열기" }))
    const movable = screen.getByTestId("journal-decoration-item-0")
    await user.click(movable)
    await user.click(screen.getByRole("button", { name: "불꽃 복제" }))

    const items = pageItems()
    expect(items).toHaveLength(2)
    /* 복제본은 배열 끝(최상단), 원본 대비 +4%/+4% */
    expect(items[1]).toEqual({ itemId: "EMOJI_FIRE", transform: T(44, 44, 1.2, 10) })
  })

  it("refuses to duplicate when the page is at the 24-item cap and explains why", async () => {
    const user = userEvent.setup()
    storeEntries([session("one")])
    seedPage(Array.from({ length: MAX_DECORATION_ITEMS_PER_PAGE }, (_, index) => ({
      itemId: "EMOJI_FIRE",
      transform: T(4 + (index % 20) * 4, 4 + Math.floor(index / 20) * 10),
    })))
    render(<LogDetail date={DATE} />)

    await user.click(screen.getByRole("button", { name: "일지 꾸미기 열기" }))
    const stickers = screen.getAllByRole("button", { name: /불꽃\./u })
    await user.click(stickers[0] as HTMLElement)
    await user.click(screen.getAllByRole("button", { name: "불꽃 복제" })[0] as HTMLElement)

    expect(pageItems()).toHaveLength(MAX_DECORATION_ITEMS_PER_PAGE)
    expect(screen.getByRole("status")).toHaveTextContent(
      `복제할 자리가 없어요. 한 페이지에 ${MAX_DECORATION_ITEMS_PER_PAGE}개까지예요.`,
    )
  })

  it("refuses to add beyond the 24-item cap from the toolbar and explains why", async () => {
    const user = userEvent.setup()
    storeEntries([session("one")])
    seedPage(Array.from({ length: MAX_DECORATION_ITEMS_PER_PAGE }, (_, index) => ({
      itemId: "EMOJI_FIRE",
      transform: T(4 + (index % 20) * 4, 4 + Math.floor(index / 20) * 10),
    })))
    render(<LogDetail date={DATE} />)

    await user.click(screen.getByRole("button", { name: "일지 꾸미기 열기" }))
    await openJournalDecorationTools()
    await user.click(screen.getByRole("button", { name: /^맑은 날 사용할 수 없음/u }))

    expect(pageItems()).toHaveLength(MAX_DECORATION_ITEMS_PER_PAGE)
    expect(screen.getByRole("status")).toHaveTextContent(
      `한 페이지에 ${MAX_DECORATION_ITEMS_PER_PAGE}개까지 붙일 수 있어요.`,
    )
  })

  it("renders items in array order so the last item paints topmost", () => {
    storeEntries([session("one")])
    seedPage([
      { itemId: "EMOJI_FIRE", transform: T(40, 40) },
      { itemId: "EMOJI_SUN", transform: T(44, 44) },
    ])
    render(<LogDetail date={DATE} />)

    const first = screen.getByTestId("journal-decoration-item-0")
    const second = screen.getByTestId("journal-decoration-item-1")
    /* z-order = DOM 순서 (계약 §2 C2): 나중 요소가 위에 그려진다. */
    expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByTestId("journal-decoration-asset-0")).toHaveTextContent("🔥")
    expect(screen.getByTestId("journal-decoration-asset-1")).toHaveTextContent("☀️")
  })

  it("rounds committed transforms to the precision contract (0.1% / 0.05 / 1deg)", async () => {
    const user = userEvent.setup()
    storeEntries([session("one")])
    seedPage([{ itemId: "STICKER_WEATHER_SUN", transform: T(50, 50) }])
    render(<LogDetail date={DATE} />)

    await user.click(screen.getByRole("button", { name: "일지 꾸미기 열기" }))
    const movable = screen.getByTestId("journal-decoration-item-0")
    await user.click(movable)
    fireEvent.keyDown(movable, { key: "+" })

    const saved = pageItems()[0]?.transform
    expect(saved?.scale).toBe(1.05)
    expect(Number.isInteger((saved?.rotationDeg ?? 0))).toBe(true)
    expect(Math.round((saved?.xPercent ?? 0) * 10) / 10).toBe(saved?.xPercent)
  })
})
