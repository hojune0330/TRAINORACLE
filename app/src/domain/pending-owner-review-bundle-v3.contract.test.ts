import { expect, it } from "vitest"
import { buildPendingOwnerReviewBundleV3 } from "../../../reports/research/method-owner-review-bundle-v3"
import { METHOD_ADOPTION_PROTOCOLS } from "../../../reports/research/method-adoption-protocols.mjs"
import { PROPOSED_METHOD_SCOPES } from "../../../reports/research/method-adoption-applicability.mjs"

it("freezes all proposed configurations and inherited scopes without granting approval", () => {
  const result = buildPendingOwnerReviewBundleV3()
  expect(result.items).toHaveLength(37)
  expect(result.items.filter(item => item.parentId !== null)).toHaveLength(8)
  expect(result.items.find(item => item.id === "P-VO2-2-4")?.scope.id).toBe("P-VO2-2")
  expect(result.ownerDecision).toBe("NOT_GRANTED")
  expect(result.executionAuthority).toBe("NONE")
  expect(result.excludes).toContain("WHOLE_PLAN_COMBINATION_APPROVAL")
  expect(result).toEqual(buildPendingOwnerReviewBundleV3())
})

it("changes identity on recovery or population changes and preserves the prior snapshot", () => {
  const p = METHOD_ADOPTION_PROTOCOLS.find(p => p.id === "P-GLY-S")!
  const s = PROPOSED_METHOD_SCOPES.find(s => s.id === p.id)!
  const seconds = p.setRest!.value, population = [...s.population]
  const before = buildPendingOwnerReviewBundleV3(), serialized = JSON.stringify(before)
  try {
    p.setRest!.value += 1
    expect(buildPendingOwnerReviewBundleV3().contentFingerprint).not.toBe(before.contentFingerprint)
    p.setRest!.value = seconds
    s.population = ["ADULT"]
    expect(buildPendingOwnerReviewBundleV3().contentFingerprint).not.toBe(before.contentFingerprint)
    expect(JSON.stringify(before)).toBe(serialized)
  } finally { p.setRest!.value = seconds; s.population = population }
  expect(buildPendingOwnerReviewBundleV3()).toEqual(before)
})

it("excludes unrequested memo fields and rejects missing or ambiguous scope", () => {
  const s = PROPOSED_METHOD_SCOPES[0]!, before = buildPendingOwnerReviewBundleV3()
  const originalScopes = [...PROPOSED_METHOD_SCOPES]
  try {
    Object.assign(s, { memo: "PRIVATE_REVIEW_SENTINEL" })
    expect(buildPendingOwnerReviewBundleV3()).toEqual(before)
    PROPOSED_METHOD_SCOPES.push(s)
    expect(() => buildPendingOwnerReviewBundleV3()).toThrow("EXACT_REVIEW_SCOPE_REQUIRED")
    PROPOSED_METHOD_SCOPES.pop()
    PROPOSED_METHOD_SCOPES.shift()
    expect(() => buildPendingOwnerReviewBundleV3()).toThrow("EXACT_REVIEW_SCOPE_REQUIRED")
  } finally {
    Reflect.deleteProperty(s, "memo")
    PROPOSED_METHOD_SCOPES.splice(0, PROPOSED_METHOD_SCOPES.length, ...originalScopes)
  }
})
