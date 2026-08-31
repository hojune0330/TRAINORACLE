import { beforeEach, describe, expect, it } from "vitest"
import {
  DECORATION_CATALOG,
  EMOJI_STICKER_IDS,
  EMOJI_STICKER_SLOTS,
  loadDecorationState,
  purchaseDecoration,
} from "./decorations"

const DECORATION_STORAGE_KEY_V1 = "trainoracle.decorations.v1"
const DECORATION_STORAGE_KEY_V3 = "trainoracle.decorations.v3"

const EMPTY_DECORATION_STATE = {
  version: 3,
  spentPoints: 0,
  ownedItemIds: [
    "THEME_TRACK_NOTEBOOK",
    "INK_NAVY",
    "STICKER_WEATHER_SUN",
    "STAMP_REST_DAY",
    "TAPE_CHECKER",
    // 이모지 스티커 48종은 전부 기본 제공(무료 스타터) — 2026-08-29 V1.
    ...EMOJI_STICKER_IDS,
  ],
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
  it("keeps the original eight-item beta catalog identity without changing paid prices", () => {
    // Given / When: 이모지 스티커(별도 계약) 이외의 기존 8종 식별자는 그대로여야 한다.
    const catalogIdentity = DECORATION_CATALOG
      .filter((item) => item.category !== "EMOJI_STICKER")
      .map(({
        id,
        cost,
        typeLabel,
        assetPath,
        compatibleSlots,
        starterOwned,
      }) => ({ id, cost, typeLabel, assetPath, compatibleSlots, starterOwned }))

    // Then
    expect(catalogIdentity).toEqual([
      {
        id: "THEME_TRACK_NOTEBOOK",
        cost: 0,
        typeLabel: "페이지 테마",
        assetPath: "decorations/theme-track-notebook.webp",
        compatibleSlots: [],
        starterOwned: true,
      },
      {
        id: "INK_NAVY",
        cost: 0,
        typeLabel: "글자색",
        assetPath: "decorations/ink-navy.webp",
        compatibleSlots: [],
        starterOwned: true,
      },
      {
        id: "STICKER_WEATHER_SUN",
        cost: 0,
        typeLabel: "스티커",
        assetPath: "decorations/sticker-weather-sun.webp",
        compatibleSlots: ["TOP_CORNER", "BODY_MARGIN"],
        starterOwned: true,
      },
      {
        id: "STAMP_REST_DAY",
        cost: 0,
        typeLabel: "도장",
        assetPath: "decorations/stamp-rest-day.webp",
        compatibleSlots: ["PAGE_FOOTER"],
        starterOwned: true,
      },
      {
        id: "TAPE_CHECKER",
        cost: 0,
        typeLabel: "마스킹 테이프",
        assetPath: "decorations/tape-checker.webp",
        compatibleSlots: ["HEADER_TAPE"],
        starterOwned: true,
      },
      {
        id: "THEME_SKY_JOURNAL",
        cost: 12,
        typeLabel: "페이지 테마",
        assetPath: "decorations/theme-sky-journal.webp",
        compatibleSlots: [],
        starterOwned: false,
      },
      {
        id: "STICKER_FINISH_LINE",
        cost: 8,
        typeLabel: "스티커",
        assetPath: "decorations/sticker-finish-line.webp",
        compatibleSlots: ["TOP_CORNER", "BODY_MARGIN"],
        starterOwned: false,
      },
      {
        id: "AVATAR_START_LINE",
        cost: 20,
        typeLabel: "아바타",
        assetPath: "decorations/avatar-start-line.webp",
        compatibleSlots: [],
        starterOwned: false,
      },
    ])
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
