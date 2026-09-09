import { z } from "zod"
import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { prepareMultiAdjustedPlanCandidateV3 } from "./adjusted-plan-multi-candidate-v3"
import { adjustedPlanReviewScopeV3 } from "./adjusted-plan-review-v3"
import { rpeSourceBindingScopeV3, type ReviewedRpeSourceBindingV3 } from "./rpe-adjusted-slot-v3"
import { hasCanonicalJsonTree } from "./plan-beta-schema"

export type MultiAdjustedPreparationV3 = Parameters<typeof prepareMultiAdjustedPlanCandidateV3>[0]
type Experience = "NEW_TO_RUNNING" | "DEVELOPING" | "EXPERIENCED"
const text = z.string().trim().min(1)
const policySchema = z.object({ scopeVersion: z.literal("MULTI_STRUCTURAL_V3"), policyId: text, version: text,
  scopeFingerprint: z.string().regex(/^sha256:[a-f0-9]{64}$/), configurationReviewRef: text,
  exposureReviewRef: text, interactionReviewRef: text, safetyReviewRef: text,
  validFromMs: z.number().finite(), expiresAtMs: z.number().finite(), revokedAtMs: z.number().finite().nullable(),
}).strict().refine(p => p.validFromMs < p.expiresAtMs)
export type ReviewedMultiAdjustedPlanPolicyV3 = z.infer<typeof policySchema>
export const REVIEWED_MULTI_ADJUSTED_PLAN_POLICIES_V3: readonly ReviewedMultiAdjustedPlanPolicyV3[] = Object.freeze([])
const hash = (value: unknown) => canonicalJsonFingerprint("trainoracle.multi-plan-review.v3", value)
const unavailable = (code: string) => ({ kind: "unavailable" as const, code })
const key = (a: { day: number; slot: string }) => `${a.day}:${a.slot}`

/** The entire layout is reviewed together; individual method acceptance is insufficient. */
export function multiAdjustedPlanReviewScopeV3(inputs: MultiAdjustedPreparationV3, experience: Experience,
  rpeBindings: readonly ReviewedRpeSourceBindingV3[] = []) {
  try {
    if (!["NEW_TO_RUNNING", "DEVELOPING", "EXPERIENCED"].includes(experience)) return unavailable("EXPERIENCE_REQUIRED")
    const prepared = prepareMultiAdjustedPlanCandidateV3(inputs, rpeBindings)
    if (prepared.kind !== "prepared") return prepared
    const reviewedSlots = new Map<string, unknown>()
    for (const input of inputs) {
      if ("experienceBand" in input) {
        if (input.experienceBand !== experience) return unavailable("SOURCE_EXPERIENCE_MISMATCH")
        const checked = rpeSourceBindingScopeV3(input)
        if (checked.kind !== "scope") return checked
        const binding = prepared.candidate.changedSlots.find(s => key(s) === key(input.address))
        if (!binding || !("rpeBinding" in binding)) return unavailable("RPE_BINDING_REQUIRED")
        reviewedSlots.set(key(input.address), { kind: "ADJUSTED_METHOD_V3", recordBasis: "NOT_USED",
          source: checked.checked.source, originalPrescription: checked.original.prescription,
          rpeBinding: binding.rpeBinding })
      } else {
        const checked = adjustedPlanReviewScopeV3(input, experience)
        if (checked.kind !== "scope") return checked
        const layout = checked.scope.layout.find(s => key(s) === key(input.address))
        if (!layout) return unavailable("ADJUSTED_SLOT_REQUIRED")
        reviewedSlots.set(key(input.address), { ...layout.prescription, population: checked.scope.population })
      }
    }
    const c = inputs[0]!.candidate
    const layout = prepared.candidate.sessions.map(session => {
      const p = session.prescription
      const prescription = reviewedSlots.get(key(session)) ?? (p.kind === "PACE_TARGET"
        ? { kind: p.kind, templateId: p.templateId, templateVersion: p.templateVersion,
          templateContentFingerprint: p.templateContentFingerprint, componentRefs: p.componentRefs } : p)
      return { day: session.day, slot: session.slot, role: session.role,
        energyIntent: session.plannedEnergyIntent, prescription }
    }).sort((a, b) => a.day - b.day || a.slot.localeCompare(b.slot))
    const scope = { scopeVersion: "MULTI_STRUCTURAL_V3" as const, eventDistanceM: c.eventDistanceM,
      experienceBand: experience, selectionActor: c.selectionAuthority, selectedEnergyIntent: c.selectedEnergyIntent,
      candidateKind: c.kind, sourceMode: c.sourceMode, frame: c.frame,
      continuity: c.continuityContext.kind === "PREVIOUS_FRAME_CONTEXT_RETAINED"
        ? { kind: c.continuityContext.kind, previousCandidateKind: c.continuityContext.previousCandidateKind } : c.continuityContext,
      mainExposureCount: c.mainExposureLedger.mainExposureCount, layout }
    return { kind: "scope" as const, scope, scopeFingerprint: hash(scope), candidate: prepared.candidate }
  } catch { return unavailable("INVALID_MULTI_PLAN_REVIEW_CONTEXT") }
}

export function checkMultiAdjustedPlanReviewV3(inputs: MultiAdjustedPreparationV3, experience: Experience,
  rpeBindings: readonly ReviewedRpeSourceBindingV3[] = [],
  policies: readonly ReviewedMultiAdjustedPlanPolicyV3[] = REVIEWED_MULTI_ADJUSTED_PLAN_POLICIES_V3) {
  try {
    const prepared = multiAdjustedPlanReviewScopeV3(inputs, experience, rpeBindings)
    if (prepared.kind !== "scope") return prepared
    if (!hasCanonicalJsonTree(policies)) return unavailable("INVALID_MULTI_PLAN_REVIEW_REGISTRY")
    const parsed = z.array(policySchema).safeParse(policies)
    if (!parsed.success) return unavailable("INVALID_MULTI_PLAN_REVIEW_REGISTRY")
    const ids = parsed.data.map(p => JSON.stringify([p.policyId, p.version]))
    if (new Set(ids).size !== ids.length) return unavailable("AMBIGUOUS_MULTI_PLAN_REVIEW")
    const matches = parsed.data.filter(p => p.scopeFingerprint === prepared.scopeFingerprint && p.revokedAtMs === null
      && inputs.every(i => p.validFromMs <= i.source.nowMs && i.source.nowMs < p.expiresAtMs))
    if (matches.length !== 1) return unavailable(matches.length ? "AMBIGUOUS_MULTI_PLAN_REVIEW" : "MULTI_PLAN_CONFIGURATION_REVIEW_REQUIRED")
    const policy = matches[0]!
    return { kind: "reviewed_scope" as const, executionAuthority: "NONE" as const,
      candidate: prepared.candidate, scopeFingerprint: prepared.scopeFingerprint,
      policy: { policyId: policy.policyId, version: policy.version, contentFingerprint: hash(policy) } }
  } catch { return unavailable("INVALID_MULTI_PLAN_REVIEW_CONTEXT") }
}
