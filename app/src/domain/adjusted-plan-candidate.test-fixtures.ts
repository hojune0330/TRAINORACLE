import { RUNTIME_CASES } from "./prescription-quality-matrix.test-fixtures"
import { adjustedMethodFixtureWithCandidate } from "./adjusted-method-resolution.test-fixtures"
import { resolveAdjustedMethodPrescription } from "./adjusted-method-resolution"
import { createAdjustedMethodSnapshot } from "./adjusted-method-snapshot"
import { resolveAdjustedCandidateScope } from "./adjusted-plan-candidate"

export function adjustedCandidateFixture(event: typeof RUNTIME_CASES[number] = RUNTIME_CASES[3]!) {
  const { candidate, resolution } = adjustedMethodFixtureWithCandidate(event)
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
  return { candidate, address, startDate, rawSnapshot: JSON.stringify(snapshot.snapshot), source: resolution.source, explanation }
}
