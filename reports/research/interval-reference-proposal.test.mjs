import test from "node:test"
import assert from "node:assert/strict"
import { calculateIntervalReferenceProposal as calculate } from "./interval-reference-proposal.mjs"
import { METHOD_ADOPTION_PROTOCOLS, METHOD_ADOPTION_VARIANTS } from "./method-adoption-protocols.mjs"
const input = { eventDistanceM: 5000, freshness: "CURRENT", purpose: "RECENT_RESULT", performanceSeconds: 1111, protocolId: "P-VO2-2" }
test("arbitrary and fractional seconds retain exact race arithmetic, not rounded storage", () => {
  for (const seconds of [1111, 1111.5, 1234.87]) {
    const r = calculate({ ...input, performanceSeconds: seconds })
    assert.equal(r.secondsPerKm, seconds / 5)
    assert.equal(r.secondsPer400m, seconds * 400 / 5000)
    assert.equal(r.referenceKind, "CURRENT_5K_RACE_PACE_NOT_MEASURED_I")
    assert.equal(r.measuredVo2maxPace, false)
    assert.equal(r.executionAuthority, "NONE")
    assert.equal(r.sourceConditionAssessment, "NOT_PERFORMED")
  }
})
test("work and rest come from exact configuration, never the athlete pace", () => {
  for (const protocolId of ["P-VO2-2", "P-VO2-3", "P-VO2-4", "P-VO2-2-4", "P-VO2-2-5"]) {
    const p = [...METHOD_ADOPTION_PROTOCOLS, ...METHOD_ADOPTION_VARIANTS].find(p => p.id === protocolId)
    const r = calculate({ ...input, protocolId })
    assert.deepEqual(r.prescription, {
      workSeconds: p.work[0].value, repeats: p.reps, restSeconds: p.between.value, finalRecoverySeconds: null,
    })
    assert.deepEqual(calculate({ ...input, protocolId, performanceSeconds: 1800 }).prescription, r.prescription)
    assert.equal(r.paceChangesRecovery, false)
  }
})
test("missing old goal and cross-event records cannot masquerade as current 5k", () => {
  for (const patch of [
    { eventDistanceM: 800 }, { eventDistanceM: 42195 }, { freshness: "STALE" },
    { freshness: "UNKNOWN" }, { purpose: "RACE_GOAL" }, { performanceSeconds: 0 },
    { performanceSeconds: -1 }, { performanceSeconds: Infinity }, { performanceSeconds: NaN },
    { performanceSeconds: "1111" }, { protocolId: "P-LT-C" }, { protocolId: "P-ATP-A" },
    { protocolId: "P-VO2-2-99" },
  ]) assert.equal(calculate({ ...input, ...patch }).kind, "unavailable")
  assert.equal(calculate(null).kind, "unavailable")
})

test("source mutation is read or rejected rather than silently using a duplicated prescription", () => {
  const p = METHOD_ADOPTION_PROTOCOLS.find(p => p.id === "P-VO2-2")
  const original = structuredClone(p)
  try {
    p.work[0].value = 121
    assert.equal(calculate(input).prescription.workSeconds, 121)
    p.between.role = "WALK"
    assert.equal(calculate(input).kind, "unavailable")
    Object.assign(p, structuredClone(original), { executionAuthority: "ACTIVE" })
    assert.equal(calculate(input).kind, "unavailable")
  } finally { Object.assign(p, original) }
})
test("PB and SB are allowed only as current input, without automatically speeding up", () => {
  for (const purpose of ["PERSONAL_BEST", "SEASON_BEST"]) {
    const r = calculate({ ...input, purpose, weeksCompleted: 6, attendanceCount: 50 })
    assert.equal(r.secondsPerKm, 222.2)
    assert.equal(calculate({ ...input, purpose, freshness: "STALE" }).kind, "unavailable")
  }
})
