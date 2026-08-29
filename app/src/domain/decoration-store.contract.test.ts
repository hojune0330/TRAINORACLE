import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  DECORATION_IDS,
  DECORATION_STORAGE_KEY_V1,
  DECORATION_STORAGE_KEY_V2,
  PAID_DECORATION_IDS,
  loadDecorationState,
  purchaseDecoration,
  rememberDecorationUse,
  saveDecorationState,
  saveDecorationStateIfCurrent,
  toggleFavoriteDecoration,
} from "./decorations"
import type { DecorationState } from "./decorations"

/*
 * 2026-08-29: 이모지 스티커 48종이 무료 스타터로 추가되어, 정규화된 보유
 * 목록은 "카탈로그 순서의 무료 전체 + 소유한 유료"가 된다.
 */
const ownedAfterLoad = (paidOwned: readonly string[] = []) =>
  DECORATION_IDS.filter((id) => !(PAID_DECORATION_IDS as readonly string[]).includes(id) || paidOwned.includes(id))

const EMPTY_V2: DecorationState = {
  version: 2,
  spentPoints: 0,
  ownedItemIds: ownedAfterLoad(),
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
    expect(state.ownedItemIds).toEqual(ownedAfterLoad(["STICKER_FINISH_LINE"]))
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

    expect(state.ownedItemIds).toEqual(ownedAfterLoad(["THEME_SKY_JOURNAL", "STICKER_FINISH_LINE", "AVATAR_START_LINE"]))
    expect(state.spentPoints).toBe(40)
    expect(window.localStorage.getItem(DECORATION_STORAGE_KEY_V1)).toBe(legacyBytes)
  })

  it("uses valid V2 as authoritative without merging a conflicting V1", () => {
    const authoritative = {
      ...EMPTY_V2,
      spentPoints: 12,
      ownedItemIds: ownedAfterLoad(["THEME_SKY_JOURNAL"]),
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
      ownedItemIds: [...ownedAfterLoad(["STICKER_FINISH_LINE"]), "UNKNOWN_OWNED"],
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

    expect(state.ownedItemIds).toEqual(ownedAfterLoad(["STICKER_FINISH_LINE"]))
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

  it("refuses a purchase without overwriting malformed V2 bytes", () => {
    const malformed = "{broken-v2"
    window.localStorage.setItem(DECORATION_STORAGE_KEY_V2, malformed)
    const fallback = loadDecorationState()

    const result = purchaseDecoration(20, fallback, "STICKER_FINISH_LINE", malformed)

    expect(result).toMatchObject({ kind: "SAVE_FAILED", code: "INVALID_STATE" })
    expect(window.localStorage.getItem(DECORATION_STORAGE_KEY_V2)).toBe(malformed)
  })

  it("refuses paid ownership that has not spent enough points", () => {
    const inconsistent = JSON.stringify({
      ...EMPTY_V2,
      spentPoints: 0,
      ownedItemIds: ownedAfterLoad(["AVATAR_START_LINE"]),
    })
    window.localStorage.setItem(DECORATION_STORAGE_KEY_V2, inconsistent)
    const fallback = loadDecorationState()

    const result = purchaseDecoration(20, fallback, "STICKER_FINISH_LINE", inconsistent)

    expect(result).toMatchObject({ kind: "SAVE_FAILED", code: "INVALID_STATE" })
    expect(window.localStorage.getItem(DECORATION_STORAGE_KEY_V2)).toBe(inconsistent)
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
      ownedItemIds: ownedAfterLoad(["THEME_SKY_JOURNAL", "STICKER_FINISH_LINE", "AVATAR_START_LINE"]),
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

  it("restores the previous bytes when a write is corrupted before readback", () => {
    loadDecorationState()
    const before = window.localStorage.getItem(DECORATION_STORAGE_KEY_V2)
    const setItem = window.localStorage.setItem.bind(window.localStorage)
    vi.spyOn(Storage.prototype, "setItem").mockImplementation((key, value) => {
      if (key === DECORATION_STORAGE_KEY_V2 && value.includes('"spentPoints":1')) {
        setItem(key, "{corrupted}")
        return
      }
      setItem(key, value)
    })

    const result = saveDecorationState({ ...EMPTY_V2, spentPoints: 1 })

    expect(result).toEqual({ ok: false, code: "READBACK_MISMATCH" })
    expect(window.localStorage.getItem(DECORATION_STORAGE_KEY_V2)).toBe(before)
  })

  it("rejects a stale snapshot instead of overwriting a newer tab state", () => {
    loadDecorationState()
    const expected = window.localStorage.getItem(DECORATION_STORAGE_KEY_V2)
    expect(saveDecorationState({ ...EMPTY_V2, spentPoints: 4 }).ok).toBe(true)

    const result = saveDecorationStateIfCurrent({ ...EMPTY_V2, spentPoints: 8 }, expected)

    expect(result).toEqual({ ok: false, code: "STALE_STATE" })
    expect(JSON.parse(window.localStorage.getItem(DECORATION_STORAGE_KEY_V2) ?? "null").spentPoints).toBe(4)
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
