import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  DECORATION_IDS,
  DECORATION_STORAGE_KEY_V1,
  DECORATION_STORAGE_KEY_V2,
  DECORATION_STORAGE_KEY_V2_BACKUP,
  DECORATION_STORAGE_KEY_V3,
  OPEN_CUTE_V1,
  PAID_DECORATION_IDS,
  V2_SLOT_DEFAULT_TRANSFORMS,
  claimRewardDecorations,
  decorationStateSchema,
  loadDecorationState,
  purchaseCollectionBundle,
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

const EMPTY_V3: DecorationState = {
  version: 3,
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
  pages: [],
  pointMeaning: "NON_ECONOMIC_NON_TRANSFERABLE_BETA",
}

beforeEach(() => window.localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe("decoration V1/V2 to V3 migration", () => {
  it("initializes the exact seven-field V3 state when no keys are present", () => {
    const state = loadDecorationState()

    expect(state).toEqual(EMPTY_V3)
    expect(JSON.parse(window.localStorage.getItem(DECORATION_STORAGE_KEY_V3) ?? "null")).toEqual(EMPTY_V3)
    expect(window.localStorage.getItem(DECORATION_STORAGE_KEY_V1)).toBeNull()
    expect(window.localStorage.getItem(DECORATION_STORAGE_KEY_V2)).toBeNull()
    expect(window.localStorage.getItem(DECORATION_STORAGE_KEY_V2_BACKUP)).toBeNull()
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

  it("migrates V2 placements into ordered V3 coordinates and keeps the V2 bytes plus a one-time backup", () => {
    const v2Bytes = JSON.stringify({
      version: 2,
      spentPoints: 20,
      ownedItemIds: [...ownedAfterLoad(["STICKER_FINISH_LINE"])],
      equipped: { themeId: "THEME_TRACK_NOTEBOOK", inkId: "INK_NAVY", avatarId: null },
      library: { favoriteItemIds: [], recentItemIds: [] },
      pagePlacements: [
        { date: "2026-08-03", slot: "PAGE_FOOTER", itemId: "STAMP_REST_DAY" },
        { date: "2026-08-03", slot: "HEADER_TAPE", itemId: "TAPE_CHECKER" },
        { date: "2026-08-03", slot: "BODY_STICKER_2", itemId: "EMOJI_SUN" },
      ],
      pointMeaning: "NON_ECONOMIC_NON_TRANSFERABLE_BETA",
    })
    window.localStorage.setItem(DECORATION_STORAGE_KEY_V2, v2Bytes)

    const state = loadDecorationState()

    /* 슬롯 → 좌표 변환표 적용 + 레이어 순서: HEADER_TAPE → PAGE_FOOTER → BODY_STICKER_2 */
    expect(state.pages).toEqual([
      {
        date: "2026-08-03",
        items: [
          { itemId: "TAPE_CHECKER", transform: V2_SLOT_DEFAULT_TRANSFORMS.HEADER_TAPE },
          { itemId: "STAMP_REST_DAY", transform: V2_SLOT_DEFAULT_TRANSFORMS.PAGE_FOOTER },
          { itemId: "EMOJI_SUN", transform: V2_SLOT_DEFAULT_TRANSFORMS.BODY_STICKER_2 },
        ],
      },
    ])
    expect(window.localStorage.getItem(DECORATION_STORAGE_KEY_V2)).toBe(v2Bytes)
    expect(window.localStorage.getItem(DECORATION_STORAGE_KEY_V2_BACKUP)).toBe(v2Bytes)
    expect(JSON.parse(window.localStorage.getItem(DECORATION_STORAGE_KEY_V3) ?? "null")).toEqual(state)
  })

  it("never overwrites an existing V2 backup on repeated migrations", () => {
    const originalBytes = JSON.stringify({
      version: 2,
      spentPoints: 0,
      ownedItemIds: ownedAfterLoad(),
      equipped: { themeId: "THEME_TRACK_NOTEBOOK", inkId: "INK_NAVY", avatarId: null },
      library: { favoriteItemIds: [], recentItemIds: [] },
      pagePlacements: [{ date: "2026-08-03", slot: "TOP_CORNER", itemId: "STICKER_WEATHER_SUN" }],
      pointMeaning: "NON_ECONOMIC_NON_TRANSFERABLE_BETA",
    })
    window.localStorage.setItem(DECORATION_STORAGE_KEY_V2, originalBytes)
    loadDecorationState()

    /* v3 키가 사라진 뒤 v2가 바뀌어도 백업은 최초 원본을 유지한다. */
    window.localStorage.removeItem(DECORATION_STORAGE_KEY_V3)
    const changedBytes = originalBytes.replace("STICKER_WEATHER_SUN", "STICKER_FINISH_LINE")
    window.localStorage.setItem(DECORATION_STORAGE_KEY_V2, changedBytes)
    loadDecorationState()

    expect(window.localStorage.getItem(DECORATION_STORAGE_KEY_V2_BACKUP)).toBe(originalBytes)
  })

  it("uses valid V3 as authoritative without reading a conflicting V2", () => {
    const authoritative = {
      ...EMPTY_V3,
      spentPoints: 12,
      ownedItemIds: ownedAfterLoad(["THEME_SKY_JOURNAL"]),
    }
    window.localStorage.setItem(DECORATION_STORAGE_KEY_V3, JSON.stringify(authoritative))
    window.localStorage.setItem(DECORATION_STORAGE_KEY_V2, JSON.stringify({
      version: 2,
      spentPoints: 40,
      ownedItemIds: ["AVATAR_START_LINE"],
      equipped: { themeId: "THEME_TRACK_NOTEBOOK", inkId: "INK_NAVY", avatarId: null },
      library: { favoriteItemIds: [], recentItemIds: [] },
      pagePlacements: [],
      pointMeaning: "NON_ECONOMIC_NON_TRANSFERABLE_BETA",
    }))

    expect(loadDecorationState()).toEqual(authoritative)
    expect(window.localStorage.getItem(DECORATION_STORAGE_KEY_V2_BACKUP)).toBeNull()
  })

  it("skips unknown V3 item rows without erasing valid ownership and placement", () => {
    const transform = { xPercent: 50, yPercent: 50, scale: 1, rotationDeg: 0 }
    const stored = JSON.stringify({
      ...EMPTY_V3,
      spentPoints: 8,
      ownedItemIds: [...ownedAfterLoad(["STICKER_FINISH_LINE"]), "UNKNOWN_OWNED"],
      library: {
        favoriteItemIds: ["STICKER_FINISH_LINE", "UNKNOWN_FAVORITE"],
        recentItemIds: ["UNKNOWN_RECENT", "STICKER_FINISH_LINE"],
      },
      pages: [
        {
          date: "2026-08-03",
          items: [
            { itemId: "STICKER_FINISH_LINE", transform },
            { itemId: "UNKNOWN_PLACEMENT", transform },
            { itemId: "STAMP_REST_DAY" },
          ],
        },
      ],
    })
    window.localStorage.setItem(DECORATION_STORAGE_KEY_V3, stored)

    const state = loadDecorationState()

    expect(state.ownedItemIds).toEqual(ownedAfterLoad(["STICKER_FINISH_LINE"]))
    expect(state.library.favoriteItemIds).toEqual(["STICKER_FINISH_LINE"])
    expect(state.library.recentItemIds).toEqual(["STICKER_FINISH_LINE"])
    expect(state.pages).toEqual([
      { date: "2026-08-03", items: [{ itemId: "STICKER_FINISH_LINE", transform }] },
    ])
    expect(window.localStorage.getItem(DECORATION_STORAGE_KEY_V3)).toBe(stored)
  })

  it("leaves malformed V1 untouched and does not promote it", () => {
    const malformed = "{broken-v1"
    window.localStorage.setItem(DECORATION_STORAGE_KEY_V1, malformed)

    expect(loadDecorationState()).toEqual(EMPTY_V3)
    expect(window.localStorage.getItem(DECORATION_STORAGE_KEY_V1)).toBe(malformed)
    expect(window.localStorage.getItem(DECORATION_STORAGE_KEY_V3)).toBeNull()
  })

  it("leaves malformed V3 and older keys untouched without rerunning migration", () => {
    const malformed = "{broken-v3"
    const legacyBytes = JSON.stringify({
      version: 1,
      spentPoints: 8,
      ownedItemIds: ["STICKER_FINISH_LINE"],
      pointMeaning: "NON_ECONOMIC_NON_TRANSFERABLE_BETA",
    })
    window.localStorage.setItem(DECORATION_STORAGE_KEY_V1, legacyBytes)
    window.localStorage.setItem(DECORATION_STORAGE_KEY_V3, malformed)

    expect(loadDecorationState()).toEqual(EMPTY_V3)
    expect(window.localStorage.getItem(DECORATION_STORAGE_KEY_V3)).toBe(malformed)
    expect(window.localStorage.getItem(DECORATION_STORAGE_KEY_V1)).toBe(legacyBytes)
  })

  it("refuses a purchase without overwriting malformed V3 bytes", () => {
    const malformed = "{broken-v3"
    window.localStorage.setItem(DECORATION_STORAGE_KEY_V3, malformed)
    const fallback = loadDecorationState()

    const result = purchaseDecoration(20, fallback, "STICKER_FINISH_LINE", malformed)

    expect(result).toMatchObject({ kind: "SAVE_FAILED", code: "INVALID_STATE" })
    expect(window.localStorage.getItem(DECORATION_STORAGE_KEY_V3)).toBe(malformed)
  })

  it("refuses paid ownership that has not spent enough points", () => {
    const inconsistent = JSON.stringify({
      ...EMPTY_V3,
      spentPoints: 0,
      ownedItemIds: ownedAfterLoad(["AVATAR_START_LINE"]),
    })
    window.localStorage.setItem(DECORATION_STORAGE_KEY_V3, inconsistent)
    const fallback = loadDecorationState()

    const result = purchaseDecoration(20, fallback, "STICKER_FINISH_LINE", inconsistent)

    expect(result).toMatchObject({ kind: "SAVE_FAILED", code: "INVALID_STATE" })
    expect(window.localStorage.getItem(DECORATION_STORAGE_KEY_V3)).toBe(inconsistent)
  })
})

describe("decoration V3 verified writes", () => {
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
      ...EMPTY_V3,
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
    const before = window.localStorage.getItem(DECORATION_STORAGE_KEY_V3)
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError")
    })

    const result = saveDecorationState({ ...EMPTY_V3, spentPoints: 1 })

    expect(result).toEqual({ ok: false, code: "WRITE_FAILED" })
    expect(window.localStorage.getItem(DECORATION_STORAGE_KEY_V3)).toBe(before)
  })

  it("detects a silent write omission through exact readback", () => {
    loadDecorationState()
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => undefined)

    const result = saveDecorationState({ ...EMPTY_V3, spentPoints: 1 })

    expect(result).toEqual({ ok: false, code: "READBACK_MISMATCH" })
  })

  it("restores the previous bytes when a write is corrupted before readback", () => {
    loadDecorationState()
    const before = window.localStorage.getItem(DECORATION_STORAGE_KEY_V3)
    const setItem = window.localStorage.setItem.bind(window.localStorage)
    vi.spyOn(Storage.prototype, "setItem").mockImplementation((key, value) => {
      if (key === DECORATION_STORAGE_KEY_V3 && value.includes('"spentPoints":1')) {
        setItem(key, "{corrupted}")
        return
      }
      setItem(key, value)
    })

    const result = saveDecorationState({ ...EMPTY_V3, spentPoints: 1 })

    expect(result).toEqual({ ok: false, code: "READBACK_MISMATCH" })
    expect(window.localStorage.getItem(DECORATION_STORAGE_KEY_V3)).toBe(before)
  })

  it("rejects a stale snapshot instead of overwriting a newer tab state", () => {
    loadDecorationState()
    const expected = window.localStorage.getItem(DECORATION_STORAGE_KEY_V3)
    expect(saveDecorationState({ ...EMPTY_V3, spentPoints: 4 }).ok).toBe(true)

    const result = saveDecorationStateIfCurrent({ ...EMPTY_V3, spentPoints: 8 }, expected)

    expect(result).toEqual({ ok: false, code: "STALE_STATE" })
    expect(JSON.parse(window.localStorage.getItem(DECORATION_STORAGE_KEY_V3) ?? "null").spentPoints).toBe(4)
  })

  it("rejects forbidden journal and symptom fields before writing", () => {
    loadDecorationState()
    const before = window.localStorage.getItem(DECORATION_STORAGE_KEY_V3)

    const result = saveDecorationState({ ...EMPTY_V3, memo: "private", pain: 9 })

    expect(result).toEqual({ ok: false, code: "INVALID_STATE" })
    expect(window.localStorage.getItem(DECORATION_STORAGE_KEY_V3)).toBe(before)
  })

  it("does not report a purchase when persistence fails", () => {
    const current = loadDecorationState()
    const legacyBefore = window.localStorage.getItem(DECORATION_STORAGE_KEY_V1)
    const v3Before = window.localStorage.getItem(DECORATION_STORAGE_KEY_V3)
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => undefined)

    const result = purchaseDecoration(20, current, "STICKER_FINISH_LINE")

    expect(result.kind).toBe("SAVE_FAILED")
    expect(result.state).toEqual(current)
    expect(window.localStorage.getItem(DECORATION_STORAGE_KEY_V1)).toBe(legacyBefore)
    expect(window.localStorage.getItem(DECORATION_STORAGE_KEY_V3)).toBe(v3Before)
  })
})

/*
 * 컬렉션 획득 경로(번들·보상). 2026-09-04에 번들 구매가 "개별 합계 > spentPoints"로
 * 스키마에 걸려 ZodError를 던지던 회귀를 잡기 위해 추가했다 — 하한 계산은 번들 할인을 인정해야 한다.
 */
describe("collection acquisition paths", () => {
  const TODAY = "2026-09-04"
  const cuteIds = OPEN_CUTE_V1.items.map((item) => item.id)

  it("buys the whole collection at the bundle price and keeps the stored state schema-valid", () => {
    const state = loadDecorationState()
    const result = purchaseCollectionBundle(200, state, OPEN_CUTE_V1.id, TODAY)

    expect(result.kind).toBe("PURCHASED")
    if (result.kind !== "PURCHASED") return
    expect(result.cost).toBe(80)
    expect(result.itemIds).toHaveLength(28)
    expect(result.state.spentPoints).toBe(80)
    expect(decorationStateSchema.safeParse(result.state).success).toBe(true)
    expect(decorationStateSchema.safeParse(JSON.parse(window.localStorage.getItem(DECORATION_STORAGE_KEY_V3) ?? "null")).success).toBe(true)
    expect(purchaseCollectionBundle(200, result.state, OPEN_CUTE_V1.id, TODAY).kind).toBe("ALREADY_OWNED")
  })

  it("charges the cheaper of bundle price and the remaining individual total", () => {
    let state = loadDecorationState()
    for (const itemId of cuteIds.slice(0, 26)) {
      const single = purchaseDecoration(200, state, itemId)
      expect(single.kind).toBe("PURCHASED")
      if (single.kind === "PURCHASED") state = single.state
    }
    expect(state.spentPoints).toBe(26 * 4)

    const result = purchaseCollectionBundle(200, state, OPEN_CUTE_V1.id, TODAY)
    expect(result.kind).toBe("PURCHASED")
    if (result.kind !== "PURCHASED") return
    expect(result.cost).toBe(8)
    expect(result.itemIds).toHaveLength(2)
    expect(result.state.spentPoints).toBe(26 * 4 + 8)
  })

  it("refuses a bundle the user cannot afford without touching storage", () => {
    const state = loadDecorationState()
    const before = window.localStorage.getItem(DECORATION_STORAGE_KEY_V3)
    const result = purchaseCollectionBundle(10, state, OPEN_CUTE_V1.id, TODAY)

    expect(result).toMatchObject({ kind: "INSUFFICIENT_POINTS", cost: 80, remainingPoints: 10 })
    expect(window.localStorage.getItem(DECORATION_STORAGE_KEY_V3)).toBe(before)
  })

  it("returns UNKNOWN_COLLECTION for an id that is not registered", () => {
    expect(purchaseCollectionBundle(200, loadDecorationState(), "NOPE", TODAY).kind).toBe("UNKNOWN_COLLECTION")
  })

  it("claims nothing when no reward rule is satisfied and never changes spentPoints", () => {
    const state = loadDecorationState()
    const result = claimRewardDecorations(state, { journalDays: 0, visitDays: 0 }, TODAY)
    expect(result.kind).toBe("NOTHING_TO_CLAIM")
    expect(result.state.spentPoints).toBe(0)
  })
})
