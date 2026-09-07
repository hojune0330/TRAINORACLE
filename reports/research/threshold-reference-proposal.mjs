// Research-only arithmetic. No app import, runtime adoption, or athlete-data access.
export const THRESHOLD_REFERENCE_PROPOSAL = Object.freeze({
  modelId: "TO-T-5K-OFFSET-PROPOSAL",
  version: "0.1",
  status: "OWNER_ADOPTION_PENDING",
  source: "https://news.vdoto2.com/2025/06/get-the-most-out-of-your-threshold-training/",
  sourceOffsetUnit: "SECONDS_PER_MILE",
  metersPerMile: 1609.344,
  offsets: Object.freeze([24, 30]),
})

export function calculateThresholdReferenceProposal({ eventDistanceM, performanceSeconds, freshness, purpose }) {
  if (eventDistanceM !== 5000 || freshness !== "CURRENT"
    || !["PERSONAL_BEST", "SEASON_BEST", "RECENT_RESULT"].includes(purpose)
    || !Number.isFinite(performanceSeconds) || performanceSeconds <= 0) {
    return { kind: "unavailable", executionAuthority: "NONE" }
  }
  const raceSecondsPerKm = performanceSeconds / 5
  const secondsPerKm = THRESHOLD_REFERENCE_PROPOSAL.offsets.map(
    offset => raceSecondsPerKm + offset * 1000 / THRESHOLD_REFERENCE_PROPOSAL.metersPerMile,
  )
  return {
    kind: "research_reference",
    executionAuthority: "NONE",
    modelId: THRESHOLD_REFERENCE_PROPOSAL.modelId,
    modelVersion: THRESHOLD_REFERENCE_PROPOSAL.version,
    secondsPerKm,
    secondsPer400m: secondsPerKm.map(value => value * 0.4),
    recoverySeconds: null,
    measuredThreshold: false,
  }
}
