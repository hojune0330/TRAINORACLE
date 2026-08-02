import { beforeEach, describe, expect, it } from "vitest"
import { loadDecorationState, purchaseDecoration } from "./decorations"

beforeEach(() => window.localStorage.clear())

describe("beta decoration shop", () => {
  it("spends non-economic points on a theme, sticker, or avatar", () => {
    const result = purchaseDecoration(20, loadDecorationState(), "STICKER_FINISH_LINE")

    expect(result.kind).toBe("PURCHASED")
    expect(result.state.ownedItemIds).toEqual(["STICKER_FINISH_LINE"])
    expect(result.state.spentPoints).toBe(8)
    expect(result.remainingPoints).toBe(12)
  })

  it("does not purchase when earned points are insufficient", () => {
    const result = purchaseDecoration(3, loadDecorationState(), "THEME_SKY_JOURNAL")

    expect(result.kind).toBe("INSUFFICIENT_POINTS")
    expect(result.state.ownedItemIds).toEqual([])
  })

  it("marks points as non-cash and non-transferable", () => {
    expect(loadDecorationState()).toMatchObject({
      pointMeaning: "NON_ECONOMIC_NON_TRANSFERABLE_BETA",
    })
  })
})
