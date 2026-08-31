import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  DECORATION_STORAGE_KEY_V2,
  EMOJI_STICKER_IDS,
  MAX_DECORATION_ITEMS_PER_PAGE,
  createEmptyDecorationState,
  decorationStateSchema,
  loadDecorationState,
  parseStoredDecorationState,
} from "../domain/decorations"
import {
  appendJournalDecoration,
  canAppendJournalDecoration,
  journalDecorationItems,
} from "../domain/journal-decoration-state"
import { DecoratedJournalPageFrame } from "./DecoratedJournalPageFrame"

afterEach(cleanup)
beforeEach(() => window.localStorage.clear())

const T = (x: number, y: number, scale = 1, rotationDeg = 0) =>
  ({ xPercent: x, yPercent: y, scale, rotationDeg }) as const

/*
 * 이모지 스티커 v3 계약 (스키마 v3 마이그레이션 계약 §2):
 * 1) 유니코드 텍스트로만 렌더 — 벤더 아트워크 이미지 로드 금지.
 * 2) 페이지당 최대 24개 — 슬롯 없는 자유 배치, 같은 이모지 복수 허용.
 * 3) 기존 v2 저장 상태는 자동 마이그레이션되며 48종을 자동 획득한다.
 * 4) 스티커는 날짜(페이지)에 붙는다 — 메모·항목과 무상관.
 */
describe("emoji sticker decoration contract", () => {
  it("renders emoji stickers as unicode text spans, never as image assets", () => {
    const state = decorationStateSchema.parse({
      ...createEmptyDecorationState(),
      pages: [{ date: "2026-08-29", items: [{ itemId: "EMOJI_FIRE", transform: T(24, 84) }] }],
    })

    render(
      <DecoratedJournalPageFrame date="2026-08-29" state={state}>
        <p>오늘 훈련 기록</p>
      </DecoratedJournalPageFrame>,
    )

    const sticker = screen.getByTestId("journal-decoration-asset-0")
    expect(sticker.tagName).toBe("SPAN")
    expect(sticker).toHaveTextContent("🔥")
    expect(sticker).not.toHaveAttribute("src")
    // 벤더 이모지 아트워크 파일을 절대 요청하지 않는다.
    expect(document.querySelectorAll("img[src*='emoji']")).toHaveLength(0)
  })

  it("allows duplicate emoji on one page and caps a page at 24 items", () => {
    const base = createEmptyDecorationState()

    // 같은 이모지 복수 배치는 유효하다 (계약 §2 C3).
    const duplicated = decorationStateSchema.safeParse({
      ...base,
      pages: [{
        date: "2026-08-29",
        items: [
          { itemId: "EMOJI_SUN", transform: T(24, 84) },
          { itemId: "EMOJI_SUN", transform: T(50, 84) },
        ],
      }],
    })
    expect(duplicated.success).toBe(true)

    // 24개를 초과한 페이지는 스키마가 거부한다 (계약 §2 C1).
    const overCap = decorationStateSchema.safeParse({
      ...base,
      pages: [{
        date: "2026-08-29",
        items: Array.from({ length: MAX_DECORATION_ITEMS_PER_PAGE + 1 }, (_, index) => ({
          itemId: "EMOJI_SUN",
          transform: T(4 + (index % 20) * 4, 4 + Math.floor(index / 20) * 10),
        })),
      }],
    })
    expect(overCap.success).toBe(false)

    // append API도 24개에서 멈춘다.
    let state = decorationStateSchema.parse(base)
    for (let count = 0; count < MAX_DECORATION_ITEMS_PER_PAGE; count += 1) {
      const next = appendJournalDecoration(state, "2026-08-29", "EMOJI_SUN")
      expect(next).not.toBeNull()
      state = next!
    }
    expect(canAppendJournalDecoration(state, "2026-08-29")).toBe(false)
    expect(appendJournalDecoration(state, "2026-08-29", "EMOJI_FIRE")).toBeNull()
    expect(journalDecorationItems(state, "2026-08-29")).toHaveLength(MAX_DECORATION_ITEMS_PER_PAGE)
  })

  it("appends to the end of the page array so the newest sticker renders topmost", () => {
    const empty = decorationStateSchema.parse(createEmptyDecorationState())

    const first = appendJournalDecoration(empty, "2026-08-29", "EMOJI_SUN")
    expect(first).not.toBeNull()
    const second = appendJournalDecoration(first!, "2026-08-29", "EMOJI_SHOE")
    expect(second).not.toBeNull()

    const items = journalDecorationItems(second!, "2026-08-29")
    expect(items.map((item) => item.itemId)).toEqual(["EMOJI_SUN", "EMOJI_SHOE"])

    // 다른 날짜의 배치는 이 페이지에 끼어들지 않는다.
    const otherDate = appendJournalDecoration(second!, "2026-08-28", "EMOJI_MOON")
    expect(otherDate).not.toBeNull()
    expect(journalDecorationItems(otherDate!, "2026-08-29")).toHaveLength(2)
    expect(journalDecorationItems(otherDate!, "2026-08-28")).toHaveLength(1)
  })

  it("auto-grants all 48 emoji stickers when migrating a previously stored v2 state", () => {
    // Given: 이모지 도입 전에 저장된 v2 상태(이모지 미보유).
    const legacyV2 = {
      version: 2,
      spentPoints: 8,
      ownedItemIds: ["THEME_TRACK_NOTEBOOK", "INK_NAVY", "STICKER_WEATHER_SUN", "STAMP_REST_DAY", "TAPE_CHECKER", "STICKER_FINISH_LINE"],
      equipped: { themeId: "THEME_TRACK_NOTEBOOK", inkId: "INK_NAVY", avatarId: null },
      library: { favoriteItemIds: [], recentItemIds: [] },
      pagePlacements: [],
      pointMeaning: "NON_ECONOMIC_NON_TRANSFERABLE_BETA",
    }
    window.localStorage.setItem(DECORATION_STORAGE_KEY_V2, JSON.stringify(legacyV2))

    // When
    const state = loadDecorationState()

    // Then: 무료 스타터인 이모지 48종을 전부 보유하며, 기존 구매(유료)도 유지된다.
    for (const emojiId of EMOJI_STICKER_IDS) {
      expect(state.ownedItemIds).toContain(emojiId)
    }
    expect(state.ownedItemIds).toContain("STICKER_FINISH_LINE")
    expect(state.spentPoints).toBe(8)
    expect(state.version).toBe(3)
  })

  it("attaches stickers to the date only, with no reference to memos or entries", () => {
    // 배치 레코드는 itemId/transform 두 필드뿐 — 메모·항목 식별자가 끼어들 수 없다.
    const state = decorationStateSchema.parse({
      ...createEmptyDecorationState(),
      pages: [{ date: "2026-08-29", items: [{ itemId: "EMOJI_CLOVER", transform: T(24, 84) }] }],
    })
    expect(Object.keys(state.pages[0]!.items[0]!).sort()).toEqual(["itemId", "transform"])

    // 메모 식별자를 끼워 넣은 배치는 스키마가 거부한다 (strict).
    const smuggled = decorationStateSchema.safeParse({
      ...createEmptyDecorationState(),
      pages: [{
        date: "2026-08-29",
        items: [{ itemId: "EMOJI_CLOVER", transform: T(24, 84), memoId: "secret-1" }],
      }],
    })
    expect(smuggled.success).toBe(false)
  })

  it("renders a sticker from normalized page coordinates with rotation and scale", () => {
    const state = decorationStateSchema.parse({
      ...createEmptyDecorationState(),
      pages: [{
        date: "2026-08-29",
        items: [{ itemId: "EMOJI_FIRE", transform: T(72, 34, 1.4, 12) }],
      }],
    })

    const { container } = render(
      <DecoratedJournalPageFrame date="2026-08-29" state={state}>
        <p>오늘 훈련 기록</p>
      </DecoratedJournalPageFrame>,
    )

    const freeItem = container.querySelector<HTMLElement>(".decorated-journal-page__free-item")
    expect(freeItem).not.toBeNull()
    expect(freeItem).toHaveStyle({ left: "72%", top: "34%" })
    expect(freeItem?.style.transform).toContain("rotate(12deg)")
    expect(freeItem?.style.transform).toContain("scale(1.4)")
    expect(screen.queryByTestId("journal-sticker-rail")).toBeNull()
  })

  it("round-trips boundary scale and rotation values without normalization", () => {
    const boundary = {
      ...createEmptyDecorationState(),
      pages: [{
        date: "2026-08-29",
        items: [
          { itemId: "EMOJI_FIRE", transform: T(4, 96, 0.3, -180) },
          { itemId: "EMOJI_SUN", transform: T(96, 4, 3, 180) },
        ],
      }],
    }
    const stored = parseStoredDecorationState(JSON.stringify(decorationStateSchema.parse(boundary)))

    expect(stored).not.toBeNull()
    expect(stored!.pages[0]!.items[0]!.transform).toEqual(T(4, 96, 0.3, -180))
    expect(stored!.pages[0]!.items[1]!.transform).toEqual(T(96, 4, 3, 180))
  })

  it("drops only an item with an out-of-range transform while preserving the rest of the page", () => {
    const base = createEmptyDecorationState()
    const stored = parseStoredDecorationState(JSON.stringify({
      ...base,
      version: 3,
      pages: [{
        date: "2026-08-29",
        items: [
          { itemId: "EMOJI_FIRE", transform: T(999, 34) },
          { itemId: "EMOJI_SUN", transform: T(50, 50) },
        ],
      }],
    }))

    expect(stored).not.toBeNull()
    expect(stored!.pages).toEqual([
      { date: "2026-08-29", items: [{ itemId: "EMOJI_SUN", transform: T(50, 50) }] },
    ])
  })
})
