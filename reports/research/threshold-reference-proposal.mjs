// Research-only arithmetic. No app import, runtime adoption, or athlete-data access.
export const THRESHOLD_REFERENCE_PROPOSAL = Object.freeze({
  modelId: "TO-T-5K-OFFSET-PROPOSAL",
  version: "0.2",
  status: "OWNER_ADOPTION_PENDING",
  source: "https://news.vdoto2.com/2025/06/get-the-most-out-of-your-threshold-training/",
  sourceOffsetUnit: "SECONDS_PER_MILE",
  metersPerMile: 1609.344,
  offsets: Object.freeze([24, 30]),
})

export function calculateThresholdReferenceProposal(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { kind: "unavailable", executionAuthority: "NONE" }
  }
  const { eventDistanceM, performanceSeconds, freshness, purpose } = input
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
    provenance: {
      source: THRESHOLD_REFERENCE_PROPOSAL.source,
      sourceOffsetUnit: THRESHOLD_REFERENCE_PROPOSAL.sourceOffsetUnit,
      offsets: [...THRESHOLD_REFERENCE_PROPOSAL.offsets],
      metersPerMile: THRESHOLD_REFERENCE_PROPOSAL.metersPerMile,
      input: { eventDistanceM, performanceSeconds, freshness, purpose },
      recordIdentityVerified: false,
      freshnessVerified: false,
    },
    applicability: {
      status: "NOT_ASSESSED",
      protocolBound: false,
      durationAdjustmentApplied: false,
      environmentAdjustmentApplied: false,
      populationSuitabilityEstablished: false,
    },
    pendingReviews: [
      "CURRENT_RECORD_VERIFICATION", "EXACT_PROTOCOL_BINDING",
      "DURATION_AND_ENVIRONMENT_REVIEW", "INDIVIDUAL_APPLICABILITY", "OWNER_ADOPTION",
    ],
  }
}
