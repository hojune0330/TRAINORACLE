import { beforeEach, describe, expect, it } from "vitest"
import { DECORATION_CATALOG, loadDecorationState, purchaseDecoration } from "./decorations"

const DECORATION_STORAGE_KEY_V1 = "trainoracle.decorations.v1"
const DECORATION_STORAGE_KEY_V2 = "trainoracle.decorations.v2"

const EMPTY_DECORATION_STATE = {
  version: 2,
  spentPoints: 0,
  ownedItemIds: [
    "THEME_TRACK_NOTEBOOK",
    "INK_NAVY",
    "STICKER_WEATHER_SUN",
    "STAMP_REST_DAY",
    "TAPE_CHECKER",
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
  pagePlacements: [],
  pointMeaning: "NON_ECONOMIC_NON_TRANSFERABLE_BETA",
} as const

beforeEach(() => window.localStorage.clear())

describe("beta decoration shop", () => {
  it("exposes the complete eight-item beta catalog without changing paid prices", () => {
    // Given / When
    const catalogIdentity = DECORATION_CATALOG.map(({
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

  it("spends non-economic points on a theme, sticker, or avatar", () => {
    const result = purchaseDecoration(20, loadDecorationState(), "STICKER_FINISH_LINE")

    expect(result.kind).toBe("PURCHASED")
    expect(result.state.ownedItemIds).toEqual([...EMPTY_DECORATION_STATE.ownedItemIds, "STICKER_FINISH_LINE"])
    expect(result.state.spentPoints).toBe(8)
    expect(result.remainingPoints).toBe(12)
  })

  it("persists purchases only under the authoritative V2 decoration storage key", () => {
    // Given
    const initialState = loadDecorationState()

    // When
    const result = purchaseDecoration(20, initialState, "STICKER_FINISH_LINE")

    // Then
    expect(window.localStorage.length).toBe(1)
    expect(window.localStorage.key(0)).toBe(DECORATION_STORAGE_KEY_V2)
    expect(window.localStorage.getItem(DECORATION_STORAGE_KEY_V2)).toBe(JSON.stringify(result.state))
  })

  it("does not purchase when earned points are insufficient", () => {
    const result = purchaseDecoration(3, loadDecorationState(), "THEME_SKY_JOURNAL")

    expect(result.kind).toBe("INSUFFICIENT_POINTS")
    expect(result.state.ownedItemIds).toEqual(EMPTY_DECORATION_STATE.ownedItemIds)
  })

  it("marks points as non-cash and non-transferable", () => {
    expect(loadDecorationState()).toEqual(EMPTY_DECORATION_STATE)
  })

  it("falls back to the safe V2 state while keeping malformed V1 JSON", () => {
    // Given
    const malformed = "{not-json"
    window.localStorage.setItem(DECORATION_STORAGE_KEY_V1, malformed)

    // When
    const state = loadDecorationState()

    // Then
    expect(state).toEqual(EMPTY_DECORATION_STATE)
    expect(window.localStorage.getItem(DECORATION_STORAGE_KEY_V1)).toBe(malformed)
    expect(window.localStorage.getItem(DECORATION_STORAGE_KEY_V2)).toBeNull()
  })

  it("falls back to the safe V2 state when the legacy shape is incomplete", () => {
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
    expect(window.localStorage.getItem(DECORATION_STORAGE_KEY_V2)).toBeNull()
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
    expect(window.localStorage.getItem(DECORATION_STORAGE_KEY_V2)).toBe(JSON.stringify(result.state))
  })
})
