import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { beforeEach, describe, expect, it } from "vitest"
import {
  DECORATION_CATALOG,
  DECORATION_IDS,
  CUTE_STICKER_GROUPS,
  CUTE_STICKER_IDS,
  CUTE_STICKER_PRICE,
  EMOJI_STICKER_IDS,
  EMOJI_STICKER_SLOTS,
  PAID_DECORATION_IDS,
  STARTER_DECORATION_IDS,
  loadDecorationState,
  purchaseDecoration,
} from "./decorations"
import type { DecorationCatalogItem } from "./decorations"

const DECORATION_STORAGE_KEY_V1 = "trainoracle.decorations.v1"
const DECORATION_STORAGE_KEY_V3 = "trainoracle.decorations.v3"
const CATALOG: readonly DecorationCatalogItem[] = DECORATION_CATALOG

const EMPTY_DECORATION_STATE = {
  version: 3,
  spentPoints: 0,
  ownedItemIds: [...STARTER_DECORATION_IDS],
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
} as const

beforeEach(() => window.localStorage.clear())

describe("beta decoration shop", () => {
  it("preserves the original eight ids and prices inside the expanded catalog", () => {
    const originalPrices = {
      THEME_TRACK_NOTEBOOK: 0,
      INK_NAVY: 0,
      STICKER_WEATHER_SUN: 0,
      STAMP_REST_DAY: 0,
      TAPE_CHECKER: 0,
      THEME_SKY_JOURNAL: 12,
      STICKER_FINISH_LINE: 8,
      AVATAR_START_LINE: 20,
    } as const

    for (const [id, cost] of Object.entries(originalPrices)) {
      expect(DECORATION_CATALOG.find((item) => item.id === id)).toMatchObject({ id, cost })
    }
  })

  it("keeps the original 34 illustrated materials plus one ink swatch unchanged", () => {
    const materials = CATALOG.filter((item) => item.category !== "EMOJI_STICKER" && item.collection !== "OPEN_CUTE_V1")
    const categoryCounts = Object.fromEntries(
      ["THEME", "TAPE", "STICKER", "STAMP", "INK", "AVATAR"].map((category) => [
        category,
        materials.filter((item) => item.category === category).length,
      ]),
    )
    const prices = Object.fromEntries(materials.map((item) => [item.id, item.cost]))

    expect(materials).toHaveLength(35)
    expect(materials.filter((item) => item.category !== "INK")).toHaveLength(34)
    expect(categoryCounts).toEqual({ THEME: 6, TAPE: 6, STICKER: 10, STAMP: 8, INK: 1, AVATAR: 4 })
    expect(materials.filter((item) => item.starterOwned)).toHaveLength(16)
    expect(materials.filter((item) => !item.starterOwned)).toHaveLength(19)
    expect(materials.map((item) => item.id)).toEqual(DECORATION_IDS.filter((id) => !EMOJI_STICKER_IDS.includes(id as never) && !CUTE_STICKER_IDS.includes(id as never)))
    expect(materials.filter((item) => !item.starterOwned).map((item) => item.id))
      .toEqual(PAID_DECORATION_IDS.filter((id) => !CUTE_STICKER_IDS.includes(id as never)))
    expect(materials.filter((item) => item.starterOwned).map((item) => item.id).sort())
      .toEqual(STARTER_DECORATION_IDS.filter((id) => !EMOJI_STICKER_IDS.includes(id as never)).sort())
    expect(new Set(materials.map((item) => item.id)).size).toBe(materials.length)
    expect(materials.every((item) => /^decorations\/[a-z0-9-]+\.webp$/u.test(item.assetPath))).toBe(true)
    expect(materials.filter((item) => !existsSync(resolve(process.cwd(), "public", item.assetPath))).map((item) => item.assetPath)).toEqual([])
    expect(prices).toEqual({
      THEME_TRACK_NOTEBOOK: 0,
      THEME_SKY_JOURNAL: 12,
      THEME_GRID_FIELD: 0,
      THEME_DAWN_RUN: 12,
      THEME_FOREST_TRAIL: 12,
      THEME_RACE_DAY: 12,
      TAPE_CHECKER: 0,
      TAPE_SAGE_SOLID: 0,
      TAPE_DIAGONAL: 0,
      TAPE_DOT_GRID: 4,
      TAPE_TRACK_LANE: 8,
      TAPE_MOUNTAIN: 8,
      STICKER_WEATHER_SUN: 0,
      STICKER_FINISH_LINE: 8,
      STICKER_RUNNING_SHOE: 0,
      STICKER_WATER_BOTTLE: 0,
      STICKER_STOPWATCH_DOODLE: 0,
      STICKER_HEART_RATE: 4,
      STICKER_TRAIL_TREE: 4,
      STICKER_MEDAL_RIBBON: 8,
      STICKER_NIGHT_MOON: 4,
      STICKER_BANDAGE_CARE: 0,
      STAMP_REST_DAY: 0,
      STAMP_DONE_CHECK: 0,
      STAMP_PERSONAL_BEST: 8,
      STAMP_EARLY_BIRD: 4,
      STAMP_RAIN_RUN: 4,
      STAMP_LONG_RUN: 4,
      STAMP_INTERVAL: 4,
      STAMP_RECOVERY: 0,
      INK_NAVY: 0,
      AVATAR_START_LINE: 20,
      AVATAR_EASY_JOG: 0,
      AVATAR_SPRINTER: 20,
      AVATAR_STRETCHING: 0,
    })
  })

  it("ships a separate 28-item cute sticker collection at one fixed 4P price", () => {
    const cuteItems = CATALOG.filter((item) => item.collection === "OPEN_CUTE_V1")
    const groupCounts = Object.fromEntries(CUTE_STICKER_GROUPS.map((group) => [
      group.id,
      cuteItems.filter((item) => item.cuteGroup === group.id).length,
    ]))

    expect(cuteItems.map((item) => item.id)).toEqual([...CUTE_STICKER_IDS])
    expect(cuteItems).toHaveLength(28)
    expect(groupCounts).toEqual({
      RUNNING_TOOLS: 6,
      MOOD_RECOVERY: 6,
      WEATHER_TIME: 6,
      CHEER_ACHIEVEMENT: 6,
      DOODLE_FRIENDS: 4,
    })
    expect(cuteItems.filter((item) => item.licenseRef === "FLUENT_EMOJI_FLAT_MIT")).toHaveLength(24)
    expect(cuteItems.filter((item) => item.licenseRef === "OPEN_PEEPS_CC0")).toHaveLength(4)
    expect(cuteItems.every((item) => item.category === "STICKER")).toBe(true)
    expect(cuteItems.every((item) => item.cost === CUTE_STICKER_PRICE && !item.starterOwned)).toBe(true)
    expect(cuteItems.every((item) => PAID_DECORATION_IDS.includes(item.id as never))).toBe(true)
    expect(cuteItems.filter((item) => !existsSync(resolve(process.cwd(), "public", item.assetPath)))).toEqual([])
  })

  it("ships 48 free emoji stickers rendered as unicode text with no bundled artwork", () => {
    // Given / When
    const emojiItems: readonly import("./decorations").DecorationCatalogItem[] = DECORATION_CATALOG.filter((item) => item.category === "EMOJI_STICKER")

    // Then: 48종, 전부 무료 스타터, 자산 경로 없음(벤더 아트워크 번들 금지),
    // 전용 슬롯 3칸만 호환, 이모지는 NFC 정규화된 유니코드 문자.
    expect(emojiItems.map((item) => item.id)).toEqual([...EMOJI_STICKER_IDS])
    for (const item of emojiItems) {
      expect(item.cost).toBe(0)
      expect(item.starterOwned).toBe(true)
      expect(item.assetPath).toBe("")
      expect(item.compatibleSlots).toEqual([...EMOJI_STICKER_SLOTS])
      expect(typeof item.emoji).toBe("string")
      expect(item.emoji).toBe(item.emoji?.normalize("NFC"))
      // ZWJ 합성 금지 (OI-EMOJI-2 검증 전 보류)
      expect(item.emoji?.includes("\u200d")).toBe(false)
    }
  })

  it("spends non-economic points on a theme, sticker, or avatar", () => {
    const result = purchaseDecoration(20, loadDecorationState(), "STICKER_FINISH_LINE")

    expect(result.kind).toBe("PURCHASED")
    expect(result.state.ownedItemIds).toEqual([...EMPTY_DECORATION_STATE.ownedItemIds, "STICKER_FINISH_LINE"])
    expect(result.state.spentPoints).toBe(8)
    expect(result.remainingPoints).toBe(12)
  })

  it("charges the fixed 4P price for an open-license cute sticker", () => {
    const result = purchaseDecoration(9, loadDecorationState(), "CUTE_PEEP_HUMMING")

    expect(result.kind).toBe("PURCHASED")
    expect(result.state.ownedItemIds.at(-1)).toBe("CUTE_PEEP_HUMMING")
    expect(result.state.spentPoints).toBe(CUTE_STICKER_PRICE)
    expect(result.remainingPoints).toBe(5)
  })

  it("persists purchases only under the authoritative V3 decoration storage key", () => {
    // Given
    const initialState = loadDecorationState()

    // When
    const result = purchaseDecoration(20, initialState, "STICKER_FINISH_LINE")

    // Then
    expect(window.localStorage.length).toBe(1)
    expect(window.localStorage.key(0)).toBe(DECORATION_STORAGE_KEY_V3)
    expect(window.localStorage.getItem(DECORATION_STORAGE_KEY_V3)).toBe(JSON.stringify(result.state))
  })

  it("does not purchase when earned points are insufficient", () => {
    const result = purchaseDecoration(3, loadDecorationState(), "THEME_SKY_JOURNAL")

    expect(result.kind).toBe("INSUFFICIENT_POINTS")
    expect(result.state.ownedItemIds).toEqual(EMPTY_DECORATION_STATE.ownedItemIds)
  })

  it("marks points as non-cash and non-transferable", () => {
    expect(loadDecorationState()).toEqual(EMPTY_DECORATION_STATE)
  })

  it("falls back to the safe V3 state while keeping malformed V1 JSON", () => {
    // Given
    const malformed = "{not-json"
    window.localStorage.setItem(DECORATION_STORAGE_KEY_V1, malformed)

    // When
    const state = loadDecorationState()

    // Then
    expect(state).toEqual(EMPTY_DECORATION_STATE)
    expect(window.localStorage.getItem(DECORATION_STORAGE_KEY_V1)).toBe(malformed)
    expect(window.localStorage.getItem(DECORATION_STORAGE_KEY_V3)).toBeNull()
  })

  it("falls back to the safe V3 state when the legacy shape is incomplete", () => {
    // Given
    const stale = JSON.stringify({
      version: 1,
      spentPoints: 8,
      ownedItemIds: ["STICKER_FINISH_LINE"],
    })
    window.localStorage.setItem(DECORATION_STORAGE_KEY_V1, stale)

    // When
    const state = loadDecorationState()

    // Then
    expect(state).toEqual(EMPTY_DECORATION_STATE)
    expect(window.localStorage.getItem(DECORATION_STORAGE_KEY_V1)).toBe(stale)
    expect(window.localStorage.getItem(DECORATION_STORAGE_KEY_V3)).toBeNull()
  })

  it("does not carry D9, analysis, or training-plan authority in decoration data", () => {
    // Given
    const legacyBytes = JSON.stringify({
      ...EMPTY_DECORATION_STATE,
      version: 1,
      ownedItemIds: [],
      d9Disposition: "D9_CLEARED",
      analysisEligible: true,
      trainingPlanAccess: "GRANTED",
    })
    window.localStorage.setItem(DECORATION_STORAGE_KEY_V1, legacyBytes)

    // When
    const result = purchaseDecoration(20, loadDecorationState(), "STICKER_FINISH_LINE")

    // Then
    expect(result.state).toEqual({
      ...EMPTY_DECORATION_STATE,
      spentPoints: 8,
      ownedItemIds: [...EMPTY_DECORATION_STATE.ownedItemIds, "STICKER_FINISH_LINE"],
    })
    expect(window.localStorage.getItem(DECORATION_STORAGE_KEY_V1)).toBe(legacyBytes)
    expect(window.localStorage.getItem(DECORATION_STORAGE_KEY_V3)).toBe(JSON.stringify(result.state))
  })
})
