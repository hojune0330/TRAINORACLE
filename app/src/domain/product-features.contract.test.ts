import { describe, expect, it } from "vitest"
import { resolveProductFeatures } from "./product-features"

describe("product feature kill switches", () => {
  it("keeps risky features off unless the service operator opens each feature", () => {
    expect(resolveProductFeatures({})).toEqual({
      sync: false,
      sharing: false,
      planProposals: false,
      experimentalFatigue: false,
      decorationShop: true,
      productAnalytics: false,
    })
  })

  it("opens only the explicitly approved feature", () => {
    expect(resolveProductFeatures({ VITE_FEATURE_SYNC: "true" })).toMatchObject({
      sync: true,
      sharing: false,
      planProposals: false,
    })
  })

  it("lets an emergency off value override an enabled feature", () => {
    expect(resolveProductFeatures({
      VITE_FEATURE_SHARING: "true",
      VITE_KILL_SHARING: "true",
    }).sharing).toBe(false)
  })
})
