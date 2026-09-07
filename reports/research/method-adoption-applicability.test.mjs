import test from "node:test"
import assert from "node:assert/strict"
import { PROPOSED_METHOD_SCOPES, previewMethodScope } from "./method-adoption-applicability.mjs"
import { METHOD_ADOPTION_PROTOCOLS } from "./method-adoption-protocols.mjs"
const context = { eventDistanceM: 5000, experience: "EXPERIENCED", population: "YOUTH", actor: "SELF", family: "VO2" }
test("every proposed protocol has exactly one pending scope", () => {
  assert.equal(PROPOSED_METHOD_SCOPES.length, METHOD_ADOPTION_PROTOCOLS.length)
  assert.deepEqual(PROPOSED_METHOD_SCOPES.map(s => s.id).sort(), METHOD_ADOPTION_PROTOCOLS.map(s => s.id).sort())
  assert.equal(new Set(PROPOSED_METHOD_SCOPES.map(s => s.id)).size, 29)
  assert.ok(PROPOSED_METHOD_SCOPES.every(s => s.status === "OWNER_ADOPTION_PENDING"))
})
test("purpose returns all independent proposed candidates, not one paired alternative", () => {
  const result = previewMethodScope(context)
  assert.deepEqual(result.rows.filter(r => r.scopeMatch).map(r => r.id), ["P-VO2-2", "P-VO2-3", "P-VO2-4"])
  assert.ok(result.rows.every(r => r.executionAuthority === "NONE" && r.requiredReviews.includes("WHOLE_FRAME_PLACEMENT")))
  assert.deepEqual(previewMethodScope({ ...context, previousMethodId: "P-VO2-2" }), result)
  assert.deepEqual(previewMethodScope({ ...context, previousMethodId: "P-VO2-4" }), result)
})
test("age and self/coached modes do not silently remove candidate scope", () => {
  for (const population of ["YOUTH", "ADULT"]) for (const actor of ["SELF", "COACH_REQUIRED"]) {
    assert.deepEqual(previewMethodScope({ ...context, population, actor }), previewMethodScope(context))
  }
})

test("explicit population and actor restrictions are honored independently", () => {
  const s = PROPOSED_METHOD_SCOPES.find(s => s.id === "P-VO2-2")
  const population = s.population, actor = s.actor
  const row = c => previewMethodScope(c).rows.find(r => r.id === s.id)
  try {
    s.population = ["ADULT"]
    assert.deepEqual(row(context).reasons, ["OUTSIDE_PROPOSED_POPULATION_SCOPE"])
    assert.equal(row(context).scopeMatch, false)
    assert.equal(row({ ...context, population: "ADULT" }).scopeMatch, true)
    s.actor = ["COACH_REQUIRED"]
    assert.deepEqual(row(context).reasons, ["OUTSIDE_PROPOSED_POPULATION_SCOPE", "OUTSIDE_PROPOSED_ACTOR_SCOPE"])
    assert.deepEqual(row({ ...context, population: "ADULT" }).reasons, ["OUTSIDE_PROPOSED_ACTOR_SCOPE"])
    assert.equal(row({ ...context, population: "ADULT", actor: "COACH_REQUIRED" }).scopeMatch, true)
    assert.equal(row(context).executionAuthority, "NONE")
  } finally { s.population = population; s.actor = actor }
})
test("seven event groups retain VO2 coverage while sprint specialists stay out of scope", () => {
  for (const eventDistanceM of [800,1500,3000,5000,10000,21097,42195]) {
    assert.equal(previewMethodScope({ ...context, eventDistanceM }).rows.filter(r => r.scopeMatch).length, 3)
  }
  for (const eventDistanceM of [100,200,400]) assert.equal(previewMethodScope({ ...context, eventDistanceM }).kind, "invalid_context")
})
test("long distance does not erase GLY purpose; flying skill proposal remains separate", () => {
  const gly = previewMethodScope({ ...context, eventDistanceM: 42195, family: "GLY" })
  assert.equal(gly.rows.filter(r => r.scopeMatch).length, 2)
  assert.ok(gly.rows.every(r => r.requiredReviews.includes("WHOLE_FRAME_PLACEMENT")))
  const atp = previewMethodScope({ ...context, experience: "DEVELOPING", family: "ATP-PC" })
  assert.deepEqual(atp.rows.filter(r => r.scopeMatch).map(r => r.id), ["P-ATP-A", "P-ATP-T"])
})
test("no record is not zero or a global exclusion; unknown experience is not inferred", () => {
  const base = previewMethodScope({ ...context, family: "BASE", experience: "NEW_TO_RUNNING" })
  assert.equal(base.rows.filter(r => r.scopeMatch).length, 2)
  assert.ok(base.rows.every(r => r.recordAbsenceExcludes === false))
  assert.equal(previewMethodScope({ ...context, experience: undefined }).kind, "invalid_context")
  assert.equal(previewMethodScope(null).kind, "invalid_context")
})
