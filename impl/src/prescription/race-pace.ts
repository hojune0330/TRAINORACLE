import type {
  GoalReferenceRacePaceResult,
  PaceAnchorRecord,
} from "./types"

const ENTERED_BY_VALUES: readonly PaceAnchorRecord["enteredBy"][] = [
  "ATHLETE",
  "COACH",
  "VERIFIED_IMPORT",
]
const VERIFICATION_VALUES: readonly PaceAnchorRecord["verificationState"][] = [
  "VERIFIED",
  "SELF_REPORTED",
  "UNVERIFIED",
]
const FRESHNESS_VALUES: readonly PaceAnchorRecord["freshnessState"][] = [
  "CURRENT",
  "STALE",
  "UNKNOWN",
]

export function calculateRacePaceSeconds(input: {
  readonly performanceSeconds: number
  readonly repetitionDistanceM: number
  readonly eventDistanceM: number
}): number {
  return input.performanceSeconds * input.repetitionDistanceM / input.eventDistanceM
}

export function calculateGoalReferenceRacePace(
  input: {
    readonly anchor: PaceAnchorRecord
    readonly targetEventDistanceM: number
    readonly repetitionDistanceM: number
    readonly displayRoundingPolicyVersion: string
  },
): GoalReferenceRacePaceResult {
  if (
    !Number.isFinite(input.targetEventDistanceM)
    || !Number.isFinite(input.repetitionDistanceM)
    || input.targetEventDistanceM < 60
    || input.repetitionDistanceM < 1
  ) {
    return { kind: "rejected", code: "SPRINT_RACE_PACE_FORBIDDEN" }
  }
  if (input.anchor.kind !== "GOAL") {
    return { kind: "rejected", code: "GOAL_ANCHOR_FORBIDDEN" }
  }
  if (input.anchor.purpose !== "ASPIRATIONAL_TARGET") {
    return { kind: "rejected", code: "ANCHOR_PROVENANCE_INCOMPLETE" }
  }
  if (
    !ENTERED_BY_VALUES.includes(input.anchor.enteredBy)
    || !VERIFICATION_VALUES.includes(input.anchor.verificationState)
    || !FRESHNESS_VALUES.includes(input.anchor.freshnessState)
  ) {
    return { kind: "rejected", code: "ANCHOR_PROVENANCE_INCOMPLETE" }
  }
  if (
    input.anchor.anchorId.length === 0
    || input.anchor.sourceRef.length === 0
    || input.anchor.eventDistanceM === null
    || input.anchor.performanceSeconds === null
    || !Number.isFinite(input.anchor.eventDistanceM)
    || !Number.isFinite(input.anchor.performanceSeconds)
    || input.anchor.eventDistanceM <= 0
    || input.anchor.performanceSeconds <= 0
    || input.displayRoundingPolicyVersion.length === 0
  ) {
    return { kind: "rejected", code: "ANCHOR_INCOMPLETE" }
  }
  if (input.anchor.eventDistanceM !== input.targetEventDistanceM) {
    return { kind: "rejected", code: "CROSS_EVENT_MODEL_REQUIRED" }
  }
  return {
    kind: "calculated-goal-reference",
    targetRepSeconds: calculateRacePaceSeconds({
      performanceSeconds: input.anchor.performanceSeconds,
      repetitionDistanceM: input.repetitionDistanceM,
      eventDistanceM: input.anchor.eventDistanceM,
    }),
    displayOnly: true,
    sourceRef: input.anchor.sourceRef,
    displayRoundingPolicyVersion: input.displayRoundingPolicyVersion,
  }
}
