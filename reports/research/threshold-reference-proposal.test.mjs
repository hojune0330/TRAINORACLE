import test from "node:test"
import assert from "node:assert/strict"
import { calculateThresholdReferenceProposal as calculate } from "./threshold-reference-proposal.mjs"

const input = { eventDistanceM: 5000, performanceSeconds: 1111, freshness: "CURRENT", purpose: "RECENT_RESULT" }

test("malformed input does not throw or create a reference", () => {
  for (const value of [undefined, null, [], 1111, "1111", true]) {
    assert.deepEqual(calculate(value), { kind: "unavailable", executionAuthority: "NONE" })
  }
})

test("reference preserves only used inputs and distinguishes arithmetic from applicability", () => {
  const result = calculate({ ...input, memo: "DO_NOT_COPY", athleteId: "PRIVATE" })
  assert.deepEqual(result.provenance.input, input)
  assert.equal(result.provenance.recordIdentityVerified, false)
  assert.equal(result.provenance.freshnessVerified, false)
  assert.equal(result.provenance.sourceOffsetUnit, "SECONDS_PER_MILE")
  assert.equal(result.applicability.status, "NOT_ASSESSED")
  assert.equal(result.applicability.protocolBound, false)
  assert.equal(result.applicability.durationAdjustmentApplied, false)
  assert.equal(result.applicability.environmentAdjustmentApplied, false)
  assert.equal(result.applicability.populationSuitabilityEstablished, false)
  assert.ok(result.pendingReviews.includes("EXACT_PROTOCOL_BINDING"))
  assert.ok(result.pendingReviews.includes("OWNER_ADOPTION"))
  assert.equal(JSON.stringify(result).includes("DO_NOT_COPY"), false)
  assert.equal(JSON.stringify(result).includes("PRIVATE"), false)
  result.provenance.offsets[0] = 999
  assert.equal(calculate(input).provenance.offsets[0], 24)
})

test("mile offset is converted before being added to kilometer pace", () => {
  const result = calculate(input)
  assert.equal(result.kind, "research_reference")
  assert.ok(Math.abs(result.secondsPerKm[0] - 237.1129086137) < 1e-8)
  assert.ok(Math.abs(result.secondsPerKm[1] - 240.8411357671) < 1e-8)
  assert.notEqual(result.secondsPerKm[0], 222.2 + 24)
  assert.equal(result.secondsPer400m[0], result.secondsPerKm[0] * 0.4)
  assert.equal(result.executionAuthority, "NONE")
  assert.equal(result.recoverySeconds, null)
  assert.equal(result.measuredThreshold, false)
})

test("non-divisible and fractional race seconds are preserved", () => {
  const a = calculate(input)
  const b = calculate({ ...input, performanceSeconds: 1111.5 })
  assert.ok(Math.abs(b.secondsPerKm[0] - a.secondsPerKm[0] - 0.1) < 1e-10)
})

for (const patch of [
  { eventDistanceM: 800 }, { eventDistanceM: 10000 }, { freshness: "STALE" },
  { freshness: "UNKNOWN" }, { purpose: "RACE_GOAL" }, { performanceSeconds: 0 },
  { performanceSeconds: -1 }, { performanceSeconds: NaN }, { performanceSeconds: Infinity },
  { performanceSeconds: "1111" },
]) {
  test(`rejects unsupported input ${JSON.stringify(patch)}`, () => {
    assert.deepEqual(calculate({ ...input, ...patch }), { kind: "unavailable", executionAuthority: "NONE" })
  })
}

test("PB and SB remain eligible only when caller supplies current status", () => {
  for (const purpose of ["PERSONAL_BEST", "SEASON_BEST"]) {
    assert.equal(calculate({ ...input, purpose }).kind, "research_reference")
    assert.equal(calculate({ ...input, purpose, freshness: "STALE" }).kind, "unavailable")
  }
})
