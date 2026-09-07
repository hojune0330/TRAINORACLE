// A coaching fallback reference, not VDOT or an estimate of measured vVO2max.
export const INTERVAL_REFERENCE_PROPOSAL = Object.freeze({
  modelId: "TO-HARD-5K-RP-REFERENCE", version: "0.1",
  status: "OWNER_ADOPTION_PENDING", source: "https://vdoto2.com/",
  sourceSection: "Interval Pace",
})
const prescriptions = new Map([
  ["P-VO2-2", { workSeconds: 120, repeats: 6, restSeconds: 60 }],
  ["P-VO2-3", { workSeconds: 180, repeats: 5, restSeconds: 120 }],
  ["P-VO2-4", { workSeconds: 240, repeats: 4, restSeconds: 180 }],
])
export function calculateIntervalReferenceProposal(input) {
  const unavailable = { kind: "unavailable", executionAuthority: "NONE" }
  if (!input || input.eventDistanceM !== 5000 || input.freshness !== "CURRENT"
    || !["PERSONAL_BEST", "SEASON_BEST", "RECENT_RESULT"].includes(input.purpose)
    || !Number.isFinite(input.performanceSeconds) || input.performanceSeconds <= 0) return unavailable
  const prescription = prescriptions.get(input.protocolId)
  if (!prescription) return unavailable
  const secondsPerKm = input.performanceSeconds / 5
  const secondsPer400m = input.performanceSeconds * 400 / 5000
  if (!Number.isFinite(secondsPerKm) || secondsPerKm <= 0 || !Number.isFinite(secondsPer400m) || secondsPer400m <= 0) return unavailable
  return {
    kind: "research_reference", executionAuthority: "NONE",
    modelId: INTERVAL_REFERENCE_PROPOSAL.modelId, modelVersion: INTERVAL_REFERENCE_PROPOSAL.version,
    referenceKind: "CURRENT_5K_RACE_PACE_NOT_MEASURED_I",
    secondsPerKm, secondsPer400m,
    prescription: { ...prescription, finalRecoverySeconds: null },
    paceChangesRecovery: false, measuredVo2maxPace: false,
    sourceConditionAssessment: "NOT_PERFORMED",
  }
}
