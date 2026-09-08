import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { prepareAdjustedPlanCandidateV3 } from "./adjusted-plan-candidate"
import { hasCanonicalJsonTree } from "./plan-beta-schema"
import { revalidateSourceAdjustmentApplicationV3 } from "./source-adjustment-offer"
import type { ReviewedAdjustedPlanPolicy } from "./adjusted-plan-review-policy"

type Preparation = Parameters<typeof prepareAdjustedPlanCandidateV3>[0]
type Experience = "NEW_TO_RUNNING" | "DEVELOPING" | "EXPERIENCED"
export type ReviewedAdjustedPlanPolicyV3 = Omit<ReviewedAdjustedPlanPolicy, "scopeVersion"> & {
  readonly scopeVersion: "STRUCTURAL_V3"
}
export const REVIEWED_ADJUSTED_PLAN_POLICIES_V3: readonly ReviewedAdjustedPlanPolicyV3[] = Object.freeze([])
const unavailable = (code: string) => ({ kind: "unavailable" as const, code })
const keys = ["scopeVersion", "policyId", "version", "scopeFingerprint", "configurationReviewRef", "exposureReviewRef",
  "interactionReviewRef", "safetyReviewRef", "validFromMs", "expiresAtMs", "revokedAtMs"]
const text = (value: unknown) => typeof value === "string" && value.trim().length > 0

export function adjustedPlanReviewScopeV3(input: Preparation, experience: Experience) {
  try {
    if (!["NEW_TO_RUNNING", "DEVELOPING", "EXPERIENCED"].includes(experience)) return unavailable("EXPERIENCE_REQUIRED")
    const prepared = prepareAdjustedPlanCandidateV3(input)
    if (prepared.kind !== "prepared") return prepared
    const changed = prepared.candidate.sessions.find(s => s.prescription.kind === "ADJUSTED_METHOD_V3")!
    if (changed.prescription.kind !== "ADJUSTED_METHOD_V3") return unavailable("ADJUSTED_SLOT_REQUIRED")
    const source = revalidateSourceAdjustmentApplicationV3(input.source, changed.prescription.snapshot.receipt)
    if (source.kind !== "applied") return source
    const original = input.candidate.sessions.find(s => s.day === input.address.day && s.slot === input.address.slot)!
    if (original.prescription.kind !== "PACE_TARGET" || original.prescription.scope.experienceBand !== experience) {
      return unavailable("SOURCE_EXPERIENCE_MISMATCH")
    }
    const layout = prepared.candidate.sessions.map(session => {
      const p = session.prescription
      const prescription = p.kind === "ADJUSTED_METHOD_V3"
        ? { kind: p.kind, from: source.source.from, to: source.source.to, policy: source.source.policy }
        : p.kind === "PACE_TARGET"
          ? { kind: p.kind, templateId: p.templateId, templateVersion: p.templateVersion,
            templateContentFingerprint: p.templateContentFingerprint, componentRefs: p.componentRefs }
          : p
      return { day: session.day, slot: session.slot, role: session.role, energyIntent: session.plannedEnergyIntent, prescription }
    }).sort((a, b) => a.day - b.day || a.slot.localeCompare(b.slot))
    const c = input.candidate
    const scope = { scopeVersion: "STRUCTURAL_V3" as const, eventDistanceM: c.eventDistanceM,
      experienceBand: experience, population: original.prescription.scope.population,
      selectionActor: c.selectionAuthority, selectedEnergyIntent: c.selectedEnergyIntent,
      candidateKind: c.kind, sourceMode: c.sourceMode, frame: c.frame,
      continuity: c.continuityContext.kind === "PREVIOUS_FRAME_CONTEXT_RETAINED"
        ? { kind: c.continuityContext.kind, previousCandidateKind: c.continuityContext.previousCandidateKind }
        : c.continuityContext,
      mainExposureCount: c.mainExposureLedger.mainExposureCount, layout }
    return { kind: "scope" as const, scope,
      scopeFingerprint: canonicalJsonFingerprint("trainoracle.adjusted-plan-review-scope.v3", scope), candidate: prepared.candidate }
  } catch { return unavailable("INVALID_PLAN_REVIEW_CONTEXT") }
}

export function checkAdjustedPlanReviewPolicyV3(input: Preparation, experience: Experience,
  policies: readonly ReviewedAdjustedPlanPolicyV3[] = REVIEWED_ADJUSTED_PLAN_POLICIES_V3) {
  try {
    const prepared = adjustedPlanReviewScopeV3(input, experience)
    if (prepared.kind !== "scope") return prepared
    if (!hasCanonicalJsonTree(policies) || !Array.isArray(policies)
      || policies.some(p => p === null || typeof p !== "object" || Array.isArray(p)
        || Reflect.ownKeys(p).length !== keys.length || Reflect.ownKeys(p).some(k => typeof k !== "string" || !keys.includes(k))
        || p.scopeVersion !== "STRUCTURAL_V3"
        || ![p.policyId, p.version, p.configurationReviewRef, p.exposureReviewRef, p.interactionReviewRef, p.safetyReviewRef].every(text)
        || !/^sha256:[a-f0-9]{64}$/.test(p.scopeFingerprint)
        || !Number.isFinite(p.validFromMs) || !Number.isFinite(p.expiresAtMs) || p.validFromMs >= p.expiresAtMs
        || p.revokedAtMs !== null && !Number.isFinite(p.revokedAtMs))) return unavailable("INVALID_PLAN_REVIEW_REGISTRY")
    const ids = policies.map(p => JSON.stringify([p.policyId, p.version]))
    if (new Set(ids).size !== ids.length) return unavailable("AMBIGUOUS_PLAN_REVIEW_POLICY")
    const matches = policies.filter(p => p.scopeFingerprint === prepared.scopeFingerprint && p.revokedAtMs === null
      && p.validFromMs <= input.source.nowMs && input.source.nowMs < p.expiresAtMs)
    if (matches.length !== 1) return unavailable(matches.length ? "AMBIGUOUS_PLAN_REVIEW_POLICY" : "PLAN_CONFIGURATION_REVIEW_REQUIRED")
    const policy = matches[0]!
    return { kind: "reviewed_scope" as const, executionAuthority: "NONE" as const, candidate: prepared.candidate,
      scopeFingerprint: prepared.scopeFingerprint, policy: { policyId: policy.policyId, version: policy.version,
        contentFingerprint: canonicalJsonFingerprint("trainoracle.adjusted-plan-review-policy.v3", policy) } }
  } catch { return unavailable("INVALID_PLAN_REVIEW_CONTEXT") }
}
