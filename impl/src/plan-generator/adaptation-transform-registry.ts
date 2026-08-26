import { canonicalJsonFingerprint } from "./candidate-identity"
import { isSupportOnlyCandidatePair } from "./support-only-candidate-pair"
import type { PlanCandidate } from "./types"

export const ADAPTATION_TRANSFORM_REGISTRY_VERSION = "trainoracle.plan-adaptation-transform-registry.v1"
export const ADAPTATION_SUCCESSOR_POLICY_VERSION = "trainoracle.existing-v3-sibling-support-duration.v1"

const OWNER_DECISION_ID = "TO-PERSONALIZED-PRESCRIPTION-ALGORITHM-V2-2026-08-23"
const OWNER_DECISION_PAYLOAD_SHA256 = "sha256:e5a1a8ca8ea7c6301239292ba7a6db4de289feea6a477d195b847893fcbd66be"

export type AdaptationTransformEdgeId =
  | "BALANCED_TO_CONSERVATIVE_EXISTING_SIBLING_ONLY"
  | "CONSERVATIVE_TO_BALANCED_EXISTING_SIBLING_ONLY"

export type AdaptationTransformDirection = "REDUCE" | "INCREASE"

export type ActiveAdaptationTransformEdge = {
  readonly edgeId: AdaptationTransformEdgeId
  readonly status: "ACTIVE"
  readonly dimension: "VOLUME"
  readonly fromCandidateKind: "BALANCED" | "CONSERVATIVE"
  readonly toCandidateKind: "BALANCED" | "CONSERVATIVE"
  readonly direction: AdaptationTransformDirection
  readonly triggerClasses: readonly (
    | "EXPLICIT_REQUEST"
    | "SAME_EVENT_PB_SB_AFTER_ACTIVE_PLAN_START"
  )[]
  readonly successorPolicyVersion: typeof ADAPTATION_SUCCESSOR_POLICY_VERSION
  readonly allowedJsonPointerPattern: "/sessions/{index}/prescription/durationMinutes/maximum"
  readonly ownerDecisionId: typeof OWNER_DECISION_ID
  readonly ownerDecisionPayloadSha256: typeof OWNER_DECISION_PAYLOAD_SHA256
  readonly expiresAt: null
  readonly revoked: false
}

const registryContent = {
  version: ADAPTATION_TRANSFORM_REGISTRY_VERSION,
  status: "ACTIVE" as const,
  activeEdges: [
    {
      edgeId: "BALANCED_TO_CONSERVATIVE_EXISTING_SIBLING_ONLY",
      status: "ACTIVE",
      dimension: "VOLUME",
      fromCandidateKind: "BALANCED",
      toCandidateKind: "CONSERVATIVE",
      direction: "REDUCE",
      triggerClasses: ["EXPLICIT_REQUEST"],
      successorPolicyVersion: ADAPTATION_SUCCESSOR_POLICY_VERSION,
      allowedJsonPointerPattern: "/sessions/{index}/prescription/durationMinutes/maximum",
      ownerDecisionId: OWNER_DECISION_ID,
      ownerDecisionPayloadSha256: OWNER_DECISION_PAYLOAD_SHA256,
      expiresAt: null,
      revoked: false,
    },
    {
      edgeId: "CONSERVATIVE_TO_BALANCED_EXISTING_SIBLING_ONLY",
      status: "ACTIVE",
      dimension: "VOLUME",
      fromCandidateKind: "CONSERVATIVE",
      toCandidateKind: "BALANCED",
      direction: "INCREASE",
      triggerClasses: ["EXPLICIT_REQUEST", "SAME_EVENT_PB_SB_AFTER_ACTIVE_PLAN_START"],
      successorPolicyVersion: ADAPTATION_SUCCESSOR_POLICY_VERSION,
      allowedJsonPointerPattern: "/sessions/{index}/prescription/durationMinutes/maximum",
      ownerDecisionId: OWNER_DECISION_ID,
      ownerDecisionPayloadSha256: OWNER_DECISION_PAYLOAD_SHA256,
      expiresAt: null,
      revoked: false,
    },
  ] as const,
  inactiveFamilies: [
    { dimension: "FREQUENCY", status: "INACTIVE_NOT_AUTHORIZED" },
    { dimension: "INTENSITY", status: "INACTIVE_NOT_AUTHORIZED" },
  ] as const,
}

export const ADAPTATION_TRANSFORM_REGISTRY = Object.freeze(registryContent)
export const ADAPTATION_TRANSFORM_REGISTRY_FINGERPRINT = canonicalJsonFingerprint(
  ADAPTATION_TRANSFORM_REGISTRY_VERSION,
  ADAPTATION_TRANSFORM_REGISTRY,
)

export type RegisteredAdaptationTransform = {
  readonly edge: ActiveAdaptationTransformEdge
  readonly allowedJsonPointers: readonly string[]
}

export function validateAdaptationTransformRegistry(value: unknown): boolean {
  try {
    return canonicalJsonFingerprint(ADAPTATION_TRANSFORM_REGISTRY_VERSION, value)
      === ADAPTATION_TRANSFORM_REGISTRY_FINGERPRINT
  } catch {
    return false
  }
}

export function resolveRegisteredAdaptationTransform(
  base: PlanCandidate,
  successor: PlanCandidate,
  triggerClass: "EXPLICIT_REQUEST" | "SAME_EVENT_PB_SB_AFTER_ACTIVE_PLAN_START",
): RegisteredAdaptationTransform | null {
  if (!validateAdaptationTransformRegistry(ADAPTATION_TRANSFORM_REGISTRY)) return null
  const edge = ADAPTATION_TRANSFORM_REGISTRY.activeEdges.find((candidate) =>
    candidate.fromCandidateKind === base.kind
      && candidate.toCandidateKind === successor.kind
      && candidate.triggerClasses.some((candidateTrigger) => candidateTrigger === triggerClass),
  )
  if (edge === undefined) return null
  const pairIsApproved = edge.direction === "REDUCE"
    ? isSupportOnlyCandidatePair(base, successor)
    : isSupportOnlyCandidatePair(successor, base)
  if (!pairIsApproved) return null
  const allowedJsonPointers = changedSupportMaximumPointers(base, successor)
  return allowedJsonPointers.length === 0 ? null : { edge, allowedJsonPointers }
}

function changedSupportMaximumPointers(
  base: PlanCandidate,
  successor: PlanCandidate,
): readonly string[] {
  return base.sessions.flatMap((session, index) => {
    const next = successor.sessions[index]
    if (next === undefined
      || session.prescription.kind !== "RPE_TIME_RANGE"
      || next.prescription.kind !== "RPE_TIME_RANGE"
      || session.prescription.durationMinutes.maximum
        === next.prescription.durationMinutes.maximum) return []
    return [`/sessions/${index}/prescription/durationMinutes/maximum`]
  })
}
