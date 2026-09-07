import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { hasCanonicalJsonTree } from "./plan-beta-schema"
import { prepareAdjustedPlanCandidate } from "./adjusted-plan-candidate"

type Preparation = Parameters<typeof prepareAdjustedPlanCandidate>[0]
type Experience = "NEW_TO_RUNNING" | "DEVELOPING" | "EXPERIENCED"
export type ReviewedAdjustedPlanPolicy = {
  readonly policyId: string
  readonly version: string
  readonly scopeFingerprint: string
  readonly configurationReviewRef: string
  readonly exposureReviewRef: string
  readonly interactionReviewRef: string
  readonly safetyReviewRef: string
  readonly validFromMs: number
  readonly expiresAtMs: number
  readonly revokedAtMs: number | null
}

// Engineering support does not constitute a review of an operating configuration.
export const REVIEWED_ADJUSTED_PLAN_POLICIES: readonly ReviewedAdjustedPlanPolicy[] = Object.freeze([])
const hash = (value: unknown) => canonicalJsonFingerprint("trainoracle.adjusted-plan-review-scope.v1", value)
const unavailable = (code: string) => ({ kind: "unavailable" as const, code })
const policyKeys = ["policyId", "version", "scopeFingerprint", "configurationReviewRef", "exposureReviewRef",
  "interactionReviewRef", "safetyReviewRef", "validFromMs", "expiresAtMs", "revokedAtMs"] as const

/** Reviewable configuration/frame scope without athlete record IDs or target times.
 * Exact personal values remain bound by the candidate/snapshot and current anchor gates.
 */
export function adjustedPlanReviewScope(preparation: Preparation, experienceBand: Experience) {
  if (!["NEW_TO_RUNNING", "DEVELOPING", "EXPERIENCED"].includes(experienceBand)) return unavailable("EXPERIENCE_REQUIRED")
  const result = prepareAdjustedPlanCandidate(preparation)
  if (result.kind !== "prepared") return result
  const layout = result.candidate.sessions.map(session => {
    const prescription = session.prescription
    const reference = prescription.kind === "ADJUSTED_METHOD" ? {
      kind: "ADJUSTED_METHOD", from: prescription.snapshot.sourceContext.current,
      to: prescription.snapshot.explanation.configuration, adjustmentPolicy: prescription.snapshot.sourceContext.policy,
    } : prescription.kind === "PACE_TARGET" ? {
      kind: "PACE_TARGET", templateId: prescription.templateId,
      templateVersion: prescription.templateVersion, templateContentFingerprint: prescription.templateContentFingerprint,
      componentRefs: prescription.componentRefs,
    } : prescription
    return { day: session.day, slot: session.slot, role: session.role, energyIntent: session.plannedEnergyIntent, prescription: reference }
  }).sort((a, b) => a.day - b.day || a.slot.localeCompare(b.slot))
  const original = preparation.candidate.sessions.find(session => session.day === preparation.address.day && session.slot === preparation.address.slot)!
  if (original.prescription.kind !== "PACE_TARGET") return unavailable("ORIGINAL_PRESCRIPTION_UNAVAILABLE")
  if (original.prescription.scope.experienceBand !== experienceBand) return unavailable("SOURCE_EXPERIENCE_MISMATCH")
  const scope = { eventDistanceM: preparation.candidate.eventDistanceM,
    selectedEnergyIntent: preparation.candidate.selectedEnergyIntent, experienceBand,
    population: original.prescription.scope.population, selectionActor: preparation.candidate.selectionAuthority,
    candidateKind: preparation.candidate.kind, frame: preparation.candidate.frame,
    continuityContext: preparation.candidate.continuityContext,
    sourceMode: preparation.candidate.sourceMode, mainExposureLedger: preparation.candidate.mainExposureLedger,
    unchangedOperationalComponents: original.prescription.componentRefs, layout }
  return { kind: "scope" as const, scope, scopeFingerprint: hash(scope), candidate: result.candidate }
}

/** Trusted registry lookup, not a signature verifier or permission to save/start.
 * Call under the owning selection lock with fresh source/time/profile context.
 */
export function checkAdjustedPlanReviewPolicy(
  preparation: Preparation,
  experienceBand: Experience,
  policies: readonly ReviewedAdjustedPlanPolicy[] = REVIEWED_ADJUSTED_PLAN_POLICIES,
) {
  try {
    const reviewed = adjustedPlanReviewScope(preparation, experienceBand)
    if (reviewed.kind !== "scope") return reviewed
    if (!hasCanonicalJsonTree(policies) || !Array.isArray(policies)) return unavailable("INVALID_PLAN_REVIEW_REGISTRY")
    const ids = policies.map(policy => JSON.stringify([policy.policyId, policy.version]))
    if (new Set(ids).size !== ids.length) return unavailable("AMBIGUOUS_PLAN_REVIEW_POLICY")
    const now = preparation.source.nowMs
    const matches = policies.filter(policy => policy !== null && typeof policy === "object"
      && Reflect.ownKeys(policy).length === policyKeys.length
      && Reflect.ownKeys(policy).every(key => typeof key === "string" && policyKeys.includes(key as typeof policyKeys[number]))
      && [policy.policyId, policy.version, policy.configurationReviewRef, policy.exposureReviewRef,
        policy.interactionReviewRef, policy.safetyReviewRef].every(value => typeof value === "string" && value.trim().length > 0)
      && policy.scopeFingerprint === reviewed.scopeFingerprint
      && Number.isFinite(policy.validFromMs) && Number.isFinite(policy.expiresAtMs)
      && policy.validFromMs < policy.expiresAtMs && policy.validFromMs <= now && now < policy.expiresAtMs
      && policy.revokedAtMs === null)
    if (matches.length !== 1) return unavailable(matches.length === 0 ? "PLAN_CONFIGURATION_REVIEW_REQUIRED" : "AMBIGUOUS_PLAN_REVIEW_POLICY")
    const policy = matches[0]!
    return { kind: "reviewed_scope" as const, executionAuthority: "NONE" as const,
      candidate: reviewed.candidate, scopeFingerprint: reviewed.scopeFingerprint,
      policy: { policyId: policy.policyId, version: policy.version,
        contentFingerprint: canonicalJsonFingerprint("trainoracle.adjusted-plan-review-policy.v1", policy) } }
  } catch { return unavailable("INVALID_PLAN_REVIEW_CONTEXT") }
}
