import { RUNTIME_CASES } from "./prescription-quality-matrix.test-fixtures"
import { adjustedMethodFixtureWithCandidate, type AdjustedFixtureSchedule } from "./adjusted-method-resolution.test-fixtures"
import { resolveAdjustedMethodPrescription } from "./adjusted-method-resolution"
import { createAdjustedMethodSnapshot } from "./adjusted-method-snapshot"
import { resolveAdjustedCandidateScope } from "./adjusted-plan-candidate"

export function adjustedSelectionFixture(event: typeof RUNTIME_CASES[number] = RUNTIME_CASES[3]!, nowMs = 151, schedule: AdjustedFixtureSchedule = {}) {
  const { candidate, resolution, generation } = adjustedMethodFixtureWithCandidate(event, undefined, undefined, nowMs, schedule)
  const session = candidate.sessions.find(item => item.prescription.kind === "PACE_TARGET")!
  const address = { day: session.day, slot: session.slot }
  const startDate = "2026-09-07"
  const scope = resolveAdjustedCandidateScope(candidate, address, startDate)
  if (scope === null) throw Error("Expected original scope")
  const resolved = resolveAdjustedMethodPrescription(resolution)
  if (resolved.kind !== "resolved") throw Error(resolved.code)
  const explanation = { configuration: resolved.projection.source.to, resolutionContextKey: resolved.projection.resolutionContextKey,
    version: "TEST-1", reviewRef: "TEST-NOT-APPROVAL", purpose: "TEST purpose", energySupply: "TEST energy",
    workRationale: "TEST work", recoveryRationale: "TEST recovery", cycleRole: "TEST cycle", expectedAdaptation: "TEST expectation",
    limitations: "TEST limit", observation: "TEST observation", evidenceRefs: ["TEST-SOURCE"] }
  const snapshot = createAdjustedMethodSnapshot({ ...resolution, scope, explanation })
  if (snapshot.kind !== "prepared") throw Error(snapshot.code)
  return { generation, preparation: { candidate, address, startDate, rawSnapshot: JSON.stringify(snapshot.snapshot), source: resolution.source, explanation } }
}

export function adjustedCandidateFixture(event: typeof RUNTIME_CASES[number] = RUNTIME_CASES[3]!) {
  return adjustedSelectionFixture(event).preparation
}
