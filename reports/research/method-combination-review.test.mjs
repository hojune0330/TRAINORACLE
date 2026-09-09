import { test } from "node:test"
import assert from "node:assert/strict"
import { previewPendingMethodCombinations } from "./method-combination-review.mjs"

const context = { eventDistanceM: 5000, experience: "EXPERIENCED", population: "YOUTH", actor: "SELF" }
const slots = [1, 4, 7].map(day => ({ day, slot: "AM", family: "LT" }))
test("enumerates all configurations, repeated methods and partial preservation without fixed pairings", () => {
  const result = previewPendingMethodCombinations(context, slots)
  assert.equal(result.combinationCount, "124") // (3 basic + 1 variant + original)^3 - all-original
  assert.equal(result.combinations.length, 124)
  assert.ok(result.combinations.some(row => row.every(s => s.configurationId === "P-LT-C")))
  assert.ok(result.combinations.some(row => row[0].configurationId === "P-LT-C" && row.slice(1).every(s => s.configurationId === null)))
  assert.ok(result.combinations.some(row => row.map(s => s.configurationId).join() === "P-LT-C,P-LT-B,P-LT-S"))
  assert.equal(result.runtimePoliciesCreated, 0)
  assert.equal(result.executionAuthority, "NONE")
  assert.deepEqual(previewPendingMethodCombinations(context, [...slots].reverse()), result)
})
test("uses explicit introduction proposals without substituting trained prescriptions", () => {
  const result = previewPendingMethodCombinations({ ...context, experience: "NEW_TO_RUNNING" }, slots)
  assert.equal(result.combinationCount, "26")
  assert.equal(result.missingSlotChoices.length, 0)
  assert.ok(result.choices.every(s => s.configurationIds.every(id => id.startsWith("P-INTRO-"))))
  assert.equal(result.executionAuthority, "NONE")
})
test("uses each slot purpose independently and caps enumeration without truncating the reported count", () => {
  const result = previewPendingMethodCombinations(context, [{ ...slots[0], family: "GLY" }, { day: 4, slot: "PM", family: "VO2" }])
  assert.equal(result.combinationCount, "17") // (2 + original) * (3 + 2 variants + original) - 1
  assert.ok(result.choices[0].configurationIds.every(id => id.startsWith("P-GLY")))
  assert.ok(result.choices[1].configurationIds.every(id => id.startsWith("P-VO2")))
  const bounded = previewPendingMethodCombinations(context, slots, { materializeLimit: 1 })
  assert.equal(bounded.materialized, false)
  assert.equal(bounded.combinationCount, "124")
  assert.deepEqual(bounded.combinations, [])
  assert.throws(() => previewPendingMethodCombinations(context, [slots[0], slots[0]]), /INVALID_MAIN_ADDRESSES/)
})
