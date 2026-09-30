import { describe, expect, it } from "vitest"
import { ALL_WORKOUT_CATALOG, catalogMethodIdentity } from "@impl/prescription/all-workout-calculator"
import { catalogRecommendationMethodKey, drawUnseenCatalogMethod, groupEligibleCatalogMethods } from "@impl/prescription/catalog-method-selection"

const entry = (id: string) => ALL_WORKOUT_CATALOG.find(row => row.id === id)!

describe("reviewed catalog exploration method grouping", () => {
  it("groups duration variants without changing exact content or legacy method identity", () => {
    const original = JSON.stringify(ALL_WORKOUT_CATALOG)
    expect(catalogMethodIdentity(entry("X-BASE-01"))).not.toBe(catalogMethodIdentity(entry("X-BASE-03")))
    expect(catalogRecommendationMethodKey(entry("X-BASE-01"))).toBe(catalogRecommendationMethodKey(entry("X-BASE-03")))
    ALL_WORKOUT_CATALOG.forEach(catalogRecommendationMethodKey)
    expect(JSON.stringify(ALL_WORKOUT_CATALOG)).toBe(original)
  })

  it("reconciles the two reviewed continuous-running aliases", () => {
    expect(catalogRecommendationMethodKey(entry("P-BASE-C"))).toBe(catalogRecommendationMethodKey(entry("X-BASE-01")))
    expect(catalogRecommendationMethodKey(entry("P-BASE-C-1500"))).toBe(catalogRecommendationMethodKey(entry("X-BASE-01")))
  })

  it("preserves different work units and real set/recovery structures", () => {
    expect(catalogRecommendationMethodKey(entry("X-BASE-01"))).not.toBe(catalogRecommendationMethodKey(entry("X-BASE-02")))
    expect(catalogRecommendationMethodKey(entry("P-BASE-C"))).not.toBe(catalogRecommendationMethodKey(entry("P-BASE-B")))
    expect(catalogRecommendationMethodKey(entry("P-RHYTHM-400"))).not.toBe(catalogRecommendationMethodKey(entry("P-RHYTHM-400-2X6")))
  })

  it("preserves repeated-child recovery versus one terminal recovery", () => {
    const original = entry("P-RHYTHM-T"), copy = structuredClone(original)
    const group = copy.sequence!.main[0]!
    if (group.kind !== "group" || group.children[0]?.kind !== "segment") throw Error("repeated rhythm fixture")
    const child = group.children[0]
    const terminalOnly = { ...copy, sequence: { ...copy.sequence!, main: [{ ...child, repeatCount: child.repeatCount * group.repeatCount }] } }
    expect(catalogRecommendationMethodKey(terminalOnly)).not.toBe(catalogRecommendationMethodKey(original))
    expect(drawUnseenCatalogMethod([terminalOnly], original, new Set())).not.toBeNull()
  })

  it("does not erase an explicit SET boundary even without a set pause", () => {
    const original = entry("X-BASE-01"), copy = structuredClone(original)
    const withSet = { ...copy, sequence: { ...copy.sequence!, main: [{ kind: "group" as const, id: "synthetic-set", label: null,
      repeatCount: 1, repeatUnit: "SET" as const, children: copy.sequence!.main,
      recoveryBetweenRepeats: [], recoveryAfter: [] }] } }
    expect(catalogRecommendationMethodKey(withSet)).not.toBe(catalogRecommendationMethodKey(original))
  })

  it("draws a method before a dose variant and does not inflate a duplicated method", () => {
    const current = entry("P-BASE-B")
    const single = [entry("X-BASE-01"), entry("X-BASE-07")]
    const variants = [...single, entry("X-BASE-03"), entry("P-BASE-C"), entry("P-BASE-C-1500")]
    expect(groupEligibleCatalogMethods(single).size).toBe(2)
    expect(groupEligibleCatalogMethods(variants).size).toBe(2)
    for (const roll of [0, 0.24, 0.49, 0.5, 0.76, 0.99]) {
      const without = drawUnseenCatalogMethod(single, current, new Set(), () => roll)!
      const withVariants = drawUnseenCatalogMethod(variants, current, new Set(), () => roll)!
      expect(catalogRecommendationMethodKey(withVariants.entry)).toBe(catalogRecommendationMethodKey(without.entry))
    }
  })

  it("shows unseen methods first and never silently substitutes a same-method variant", () => {
    const pool = [entry("X-BASE-01"), entry("X-BASE-03"), entry("X-BASE-07"), entry("X-HILL-09")]
    const first = drawUnseenCatalogMethod(pool, pool[0]!, new Set(), () => 0)!
    const second = drawUnseenCatalogMethod(pool, first.entry, first.seen, () => 0)!
    expect(second.entry.id).toBe("X-HILL-09")
    const third = drawUnseenCatalogMethod(pool, second.entry, second.seen, () => 0)!
    expect(catalogRecommendationMethodKey(third.entry)).not.toBe(catalogRecommendationMethodKey(second.entry))
    expect(drawUnseenCatalogMethod([pool[0]!, pool[1]!], pool[0]!, new Set())).toBeNull()
  })
})
