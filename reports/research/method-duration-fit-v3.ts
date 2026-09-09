import { assembleProposalSession } from "./method-adoption-protocols.mjs"
import type { PendingMethodProtocol } from "./method-proposal-sequence-v3"
import { rangesFor } from "../../impl/src/plan-generator/session-builder"
import type { ExperienceBand } from "../../impl/src/plan-generator/types"

/** Compares elapsed time only; within the old range is not whole-plan adoption. */
export function previewMethodDurationFit(p: PendingMethodProtocol, experience: ExperienceBand) {
  const session = assembleProposalSession(p)
  const ranges = rangesFor(experience)
  const range = p.family === "OFF" ? null : p.family === "BASE" ? ranges.easy
    : p.family === "REC" ? ranges.recoverySupport : ranges.quality
  const parts = [...session.warmup, ...session.main, ...session.cooldown]
  const knownSeconds = parts.filter(part => part.unit === "SECONDS").reduce((sum, part) => sum + part.value, 0)
  const unresolvedDistanceParts = parts.filter(part => part.unit === "METERS").length
  const secondsRange = range ? { minimum: range.minimum * 60, maximum: range.maximum * 60 } : null
  const status = !secondsRange ? "NOT_APPLICABLE" : knownSeconds > secondsRange.maximum
    ? "EXCEEDS_EXISTING_RANGE" : unresolvedDistanceParts > 0 ? "DURATION_UNRESOLVED"
      : knownSeconds < secondsRange.minimum ? "BELOW_EXISTING_RANGE" : "WITHIN_EXISTING_RANGE"
  return {
    protocolId: p.id, experience, status, executionAuthority: "NONE" as const,
    comparisonScope: "STANDARD_CANDIDATE_DURATION_ONLY" as const,
    existingRangeSeconds: secondsRange,
    knownSeconds, exactSeconds: unresolvedDistanceParts || p.family === "OFF" ? null : knownSeconds,
    unresolvedDistanceParts,
    excessAtLeastSeconds: secondsRange ? Math.max(0, knownSeconds - secondsRange.maximum) : null,
    individualAvailabilityChecked: false, wholePlanAdopted: false,
  }
}
