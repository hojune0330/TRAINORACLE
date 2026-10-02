import { act, cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { createEmptyDecorationState } from "../../domain/decoration-schema"
import { decorationCatalogItem } from "../../domain/decoration-catalog"
import { appendJournalDecoration, appendJournalTextSticker } from "../../domain/journal-decoration-state"
import { activeDecorationStorageKeyV3 } from "../../domain/decorations"
import { saveEntry } from "../../domain/journal-store"
import { JournalDecorationPreview, JournalWritingDecorationPreview, selectJournalDecorationPreview } from "./JournalDecorationPreview"

afterEach(cleanup)

const DATE = "2026-10-02"

function add<T>(value: T | null): T {
  if (value === null) throw new Error("Fixture decoration could not be added")
  return value
}

describe("selectJournalDecorationPreview", () => {
  it("uses the last valid owned non-text sticker in render order for an actual saved date", () => {
    let state = createEmptyDecorationState()
    state = add(appendJournalDecoration(state, DATE, "STICKER_WEATHER_SUN"))
    state = add(appendJournalDecoration(state, DATE, "TAPE_CHECKER"))
    state = add(appendJournalTextSticker(state, DATE, "오늘은 천천히", "TEXT_INK_NAVY"))

    expect(selectJournalDecorationPreview(state, DATE, new Set([DATE]))?.id).toBe("STICKER_WEATHER_SUN")
  })

  it("uses the later eligible item when it follows earlier decorations", () => {
    let state = createEmptyDecorationState()
    state = add(appendJournalDecoration(state, DATE, "STICKER_WEATHER_SUN"))
    state = add(appendJournalDecoration(state, DATE, "STAMP_DONE_CHECK"))

    expect(selectJournalDecorationPreview(state, DATE, new Set([DATE]))?.id).toBe("STAMP_DONE_CHECK")
  })

  it("omits unowned items, inactive dates, and unknown snapshots", () => {
    let state = createEmptyDecorationState()
    state = add(appendJournalDecoration(state, DATE, "STICKER_WEATHER_SUN"))
    const unowned = {
      ...state,
      ownedItemIds: state.ownedItemIds.filter((itemId) => itemId !== "STICKER_WEATHER_SUN"),
    }

    expect(selectJournalDecorationPreview(unowned, DATE, new Set([DATE]))).toBeNull()
    expect(selectJournalDecorationPreview(state, DATE, new Set())).toBeNull()
    expect(selectJournalDecorationPreview(null, DATE, new Set([DATE]))).toBeNull()
  })
})

describe("JournalDecorationPreview", () => {
  it("hides a broken 16px image without changing or replacing the underlying item", () => {
    const item = decorationCatalogItem("STICKER_WEATHER_SUN")
    expect(item).toBeDefined()
    const { container } = render(<JournalDecorationPreview item={item} />)
    const image = container.querySelector("img")
    expect(image).toHaveAttribute("width", "16")
    fireEvent.error(image!)
    expect(container.querySelector("img")).toBeNull()
  })

  it("refreshes active saved dates after a same-tab journal save", () => {
    let decorationState = createEmptyDecorationState()
    decorationState = add(appendJournalDecoration(decorationState, DATE, "STICKER_WEATHER_SUN"))
    localStorage.setItem(activeDecorationStorageKeyV3(), JSON.stringify(decorationState))
    const { container } = render(<JournalWritingDecorationPreview date={DATE}><p>작성 중</p></JournalWritingDecorationPreview>)

    expect(container.querySelector(".journal-decoration-preview")).toBeNull()
    act(() => {
      saveEntry({
        id: "saved-for-decoration-preview",
        kind: "race",
        date: DATE,
        savedAt: `${DATE}T00:00:00.000Z`,
        syncState: "local",
        stage: "pre",
        record: "",
        rank: "",
        result: "",
        memo: "",
      })
    })

    expect(container.querySelector(".journal-decoration-preview")).toBeInTheDocument()
  })
})
