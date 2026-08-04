import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  DECORATION_STORAGE_KEY_V1,
  DECORATION_STORAGE_KEY_V2,
  loadDecorationState,
  purchaseDecoration,
  rememberDecorationUse,
  saveDecorationState,
  toggleFavoriteDecoration,
} from "./decorations"
import type { DecorationState } from "./decorations"

const STARTER_IDS = [
  "THEME_TRACK_NOTEBOOK",
  "INK_NAVY",
  "STICKER_WEATHER_SUN",
  "STAMP_REST_DAY",
  "TAPE_CHECKER",
] as const

const EMPTY_V2: DecorationState = {
  version: 2,
  spentPoints: 0,
  ownedItemIds: [...STARTER_IDS],
  equipped: {
    themeId: "THEME_TRACK_NOTEBOOK",
    inkId: "INK_NAVY",
    avatarId: null,
  },
  library: {
    favoriteItemIds: [],
    recentItemIds: [],
  },
  pagePlacements: [],
  pointMeaning: "NON_ECONOMIC_NON_TRANSFERABLE_BETA",
}

beforeEach(() => window.localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe("decoration V1 to V2 migration", () => {
  it("initializes the exact seven-field V2 state when both keys are absent", () => {
    const state = loadDecorationState()

    expect(state).toEqual(EMPTY_V2)
    expect(JSON.parse(window.localStorage.getItem(DECORATION_STORAGE_KEY_V2) ?? "null")).toEqual(EMPTY_V2)
    expect(window.localStorage.getItem(DECORATION_STORAGE_KEY_V1)).toBeNull()
  })

  it("preserves partial legacy ownership, spend, and the original V1 bytes", () => {
    const legacyBytes = JSON.stringify({
      version: 1,
      spentPoints: 8,
      ownedItemIds: ["STICKER_FINISH_LINE"],
      pointMeaning: "NON_ECONOMIC_NON_TRANSFERABLE_BETA",
    })
    window.localStorage.setItem(DECORATION_STORAGE_KEY_V1, legacyBytes)

    const state = loadDecorationState()

    expect(state.spentPoints).toBe(8)
    expect(state.ownedItemIds).toEqual([...STARTER_IDS, "STICKER_FINISH_LINE"])
    expect(window.localStorage.getItem(DECORATION_STORAGE_KEY_V1)).toBe(legacyBytes)
  })

  it("migrates a valid zero-purchase V1 without inventing spend", () => {
    const legacyBytes = JSON.stringify({
      version: 1,
      spentPoints: 0,
      ownedItemIds: [],
      pointMeaning: "NON_ECONOMIC_NON_TRANSFERABLE_BETA",
    })
    window.localStorage.setItem(DECORATION_STORAGE_KEY_V1, legacyBytes)

    const state = loadDecorationState()

    expect(state).toEqual(EMPTY_V2)
    expect(window.localStorage.getItem(DECORATION_STORAGE_KEY_V1)).toBe(legacyBytes)
    expect(window.localStorage.getItem(DECORATION_STORAGE_KEY_V2)).toBe(JSON.stringify(EMPTY_V2))
  })

  it("preserves every recognized legacy purchase and ignores an unknown legacy item", () => {
    const legacyBytes = JSON.stringify({
      version: 1,
      spentPoints: 40,
      ownedItemIds: ["THEME_SKY_JOURNAL", "STICKER_FINISH_LINE", "AVATAR_START_LINE", "UNKNOWN_ITEM"],
      pointMeaning: "NON_ECONOMIC_NON_TRANSFERABLE_BETA",
    })
    window.localStorage.setItem(DECORATION_STORAGE_KEY_V1, legacyBytes)

    const state = loadDecorationState()

    expect(state.ownedItemIds).toEqual([
      ...STARTER_IDS,
      "THEME_SKY_JOURNAL",
      "STICKER_FINISH_LINE",
      "AVATAR_START_LINE",
    ])
    expect(state.spentPoints).toBe(40)
    expect(window.localStorage.getItem(DECORATION_STORAGE_KEY_V1)).toBe(legacyBytes)
  })

  it("uses valid V2 as authoritative without merging a conflicting V1", () => {
    const authoritative = {
      ...EMPTY_V2,
      spentPoints: 12,
      ownedItemIds: [...STARTER_IDS, "THEME_SKY_JOURNAL"],
    }
    window.localStorage.setItem(DECORATION_STORAGE_KEY_V2, JSON.stringify(authoritative))
    window.localStorage.setItem(DECORATION_STORAGE_KEY_V1, JSON.stringify({
      version: 1,
      spentPoints: 40,
      ownedItemIds: ["AVATAR_START_LINE"],
      pointMeaning: "NON_ECONOMIC_NON_TRANSFERABLE_BETA",
    }))

    expect(loadDecorationState()).toEqual(authoritative)
  })

  it("skips unknown V2 item rows without erasing valid ownership and placement", () => {
    const stored = JSON.stringify({
      ...EMPTY_V2,
      spentPoints: 8,
      ownedItemIds: [...STARTER_IDS, "STICKER_FINISH_LINE", "UNKNOWN_OWNED"],
      library: {
        favoriteItemIds: ["STICKER_FINISH_LINE", "UNKNOWN_FAVORITE"],
        recentItemIds: ["UNKNOWN_RECENT", "STICKER_FINISH_LINE"],
      },
      pagePlacements: [
        { date: "2026-08-03", slot: "TOP_CORNER", itemId: "STICKER_FINISH_LINE" },
        { date: "2026-08-03", slot: "BODY_MARGIN", itemId: "UNKNOWN_PLACEMENT" },
        { date: "2026-08-03", slot: "PAGE_FOOTER", itemId: "STAMP_REST_DAY", x: 10 },
      ],
    })
    window.localStorage.setItem(DECORATION_STORAGE_KEY_V2, stored)

    const state = loadDecorationState()

    expect(state.ownedItemIds).toEqual([...STARTER_IDS, "STICKER_FINISH_LINE"])
    expect(state.library.favoriteItemIds).toEqual(["STICKER_FINISH_LINE"])
    expect(state.library.recentItemIds).toEqual(["STICKER_FINISH_LINE"])
    expect(state.pagePlacements).toEqual([
      { date: "2026-08-03", slot: "TOP_CORNER", itemId: "STICKER_FINISH_LINE" },
    ])
    expect(window.localStorage.getItem(DECORATION_STORAGE_KEY_V2)).toBe(stored)
  })

  it("leaves malformed V1 untouched and does not promote it", () => {
    const malformed = "{broken-v1"
    window.localStorage.setItem(DECORATION_STORAGE_KEY_V1, malformed)

    expect(loadDecorationState()).toEqual(EMPTY_V2)
    expect(window.localStorage.getItem(DECORATION_STORAGE_KEY_V1)).toBe(malformed)
    expect(window.localStorage.getItem(DECORATION_STORAGE_KEY_V2)).toBeNull()
  })

  it("leaves malformed V2 and legacy V1 untouched without rerunning migration", () => {
    const malformed = "{broken-v2"
    const legacyBytes = JSON.stringify({
      version: 1,
      spentPoints: 8,
      ownedItemIds: ["STICKER_FINISH_LINE"],
      pointMeaning: "NON_ECONOMIC_NON_TRANSFERABLE_BETA",
    })
    window.localStorage.setItem(DECORATION_STORAGE_KEY_V1, legacyBytes)
    window.localStorage.setItem(DECORATION_STORAGE_KEY_V2, malformed)

    expect(loadDecorationState()).toEqual(EMPTY_V2)
    expect(window.localStorage.getItem(DECORATION_STORAGE_KEY_V2)).toBe(malformed)
    expect(window.localStorage.getItem(DECORATION_STORAGE_KEY_V1)).toBe(legacyBytes)
  })
})

describe("decoration V2 verified writes", () => {
  it("caps recents at eight, moves a repeat to the front, and keeps favorites unique", () => {
    const recentIds = [
      "THEME_TRACK_NOTEBOOK",
      "INK_NAVY",
      "STICKER_WEATHER_SUN",
      "STAMP_REST_DAY",
      "TAPE_CHECKER",
      "THEME_SKY_JOURNAL",
      "STICKER_FINISH_LINE",
      "AVATAR_START_LINE",
    ] as const
    const ownAll: DecorationState = {
      ...EMPTY_V2,
      spentPoints: 40,
      ownedItemIds: [...STARTER_IDS, "THEME_SKY_JOURNAL", "STICKER_FINISH_LINE", "AVATAR_START_LINE"],
    }
    const withRecents = recentIds.reduce(rememberDecorationUse, ownAll)
    const repeated = rememberDecorationUse(withRecents, "THEME_TRACK_NOTEBOOK")
    const favoriteOnce = toggleFavoriteDecoration(repeated, "STICKER_WEATHER_SUN")
    const favoriteRemoved = toggleFavoriteDecoration(favoriteOnce, "STICKER_WEATHER_SUN")

    expect(repeated.library.recentItemIds).toEqual([
      "THEME_TRACK_NOTEBOOK",
      "AVATAR_START_LINE",
      "STICKER_FINISH_LINE",
      "THEME_SKY_JOURNAL",
      "TAPE_CHECKER",
      "STAMP_REST_DAY",
      "STICKER_WEATHER_SUN",
      "INK_NAVY",
    ])
    expect(favoriteOnce.library.favoriteItemIds).toEqual(["STICKER_WEATHER_SUN"])
    expect(favoriteRemoved.library.favoriteItemIds).toEqual([])
  })

  it("returns a typed failure and keeps the previous state when storage throws", () => {
    loadDecorationState()
    const before = window.localStorage.getItem(DECORATION_STORAGE_KEY_V2)
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError")
    })

    const result = saveDecorationState({ ...EMPTY_V2, spentPoints: 1 })

    expect(result).toEqual({ ok: false, code: "WRITE_FAILED" })
    expect(window.localStorage.getItem(DECORATION_STORAGE_KEY_V2)).toBe(before)
  })

  it("detects a silent write omission through exact readback", () => {
    loadDecorationState()
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => undefined)

    const result = saveDecorationState({ ...EMPTY_V2, spentPoints: 1 })

    expect(result).toEqual({ ok: false, code: "READBACK_MISMATCH" })
  })

  it("rejects forbidden journal and symptom fields before writing", () => {
    loadDecorationState()
    const before = window.localStorage.getItem(DECORATION_STORAGE_KEY_V2)

    const result = saveDecorationState({ ...EMPTY_V2, memo: "private", pain: 9 })

    expect(result).toEqual({ ok: false, code: "INVALID_STATE" })
    expect(window.localStorage.getItem(DECORATION_STORAGE_KEY_V2)).toBe(before)
  })

  it("does not report a purchase when persistence fails", () => {
    const current = loadDecorationState()
    const legacyBefore = window.localStorage.getItem(DECORATION_STORAGE_KEY_V1)
    const v2Before = window.localStorage.getItem(DECORATION_STORAGE_KEY_V2)
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => undefined)

    const result = purchaseDecoration(20, current, "STICKER_FINISH_LINE")

    expect(result.kind).toBe("SAVE_FAILED")
    expect(result.state).toEqual(current)
    expect(window.localStorage.getItem(DECORATION_STORAGE_KEY_V1)).toBe(legacyBefore)
    expect(window.localStorage.getItem(DECORATION_STORAGE_KEY_V2)).toBe(v2Before)
  })
})
