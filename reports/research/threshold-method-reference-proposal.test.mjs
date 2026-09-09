import test from "node:test"
import assert from "node:assert/strict"
import { previewThresholdMethodReference as preview } from "./threshold-method-reference-proposal.mjs"
import { METHOD_ADOPTION_PROTOCOLS, METHOD_ADOPTION_VARIANTS } from "./method-adoption-protocols.mjs"

const input = { eventDistanceM: 5000, performanceSeconds: 1111.5, freshness: "CURRENT", purpose: "RECENT_RESULT" }

for (const p of [...METHOD_ADOPTION_PROTOCOLS, ...METHOD_ADOPTION_VARIANTS].filter(p => p.family === "LT")) {
  test(`binds exact geometry without inventing recovery pace: ${p.id}`, () => {
    const result = preview({ ...input, protocolId: p.id })
    assert.equal(result.kind, "threshold_method_review_preview")
    assert.deepEqual(result.protocol, p)
    assert.equal(result.executionAuthority, "NONE")
    assert.equal(result.reference.applicability.status, "NOT_ASSESSED")
    assert.equal(result.reference.applicability.protocolBound, true)
    const work = result.instructions.filter(part => part.role === "WORK")
    const rest = result.instructions.filter(part => part.role !== "WORK")
    assert.equal(work.length, p.reps * p.sets)
    assert.equal(rest.length, p.reps - 1)
    for (const part of work) {
      assert.equal(part.stopRule.seconds, p.work[0].value)
      assert.equal(part.paceReference.distanceCompletionRequired, false)
      assert.ok(Math.abs(part.paceReference.secondsPerKm[0] - 237.2129086137) < 1e-8)
    }
    for (const part of rest) {
      assert.equal(part.value, p.between.value)
      assert.equal(part.role, p.between.role)
      assert.equal(part.paceReference, null)
    }
    assert.equal(result.instructions.at(-1).role, "WORK")
    result.protocol.work[0].value = 999
    assert.notEqual(preview({ ...input, protocolId: p.id }).protocol.work[0].value, 999)
  })
}

test("unsupported inputs cannot be bound to LT", () => {
  for (const value of [null, {}, { ...input, protocolId: "P-VO2-2" },
    { ...input, protocolId: "P-LT-C", freshness: "STALE" }]) {
    assert.deepEqual(preview(value), { kind: "unavailable", executionAuthority: "NONE" })
  }
})
