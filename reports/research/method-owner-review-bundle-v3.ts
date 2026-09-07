import { canonicalJsonFingerprint } from "../../impl/src/plan-generator/candidate-identity"
import { METHOD_ADOPTION_PROTOCOLS, METHOD_ADOPTION_VARIANTS, assembleProposalSession } from "./method-adoption-protocols.mjs"
import { PROPOSED_METHOD_SCOPES } from "./method-adoption-applicability.mjs"
import { previewPendingMethodExplanation } from "./method-explanation-preview-v3"

/** Content to review, never an approval record or an operating catalog. */
export function buildPendingOwnerReviewBundleV3() {
  const items = [...METHOD_ADOPTION_PROTOCOLS, ...METHOD_ADOPTION_VARIANTS].map(p => {
    const parentId = "parentId" in p && typeof p.parentId === "string" ? p.parentId : null
    const scopes = PROPOSED_METHOD_SCOPES.filter(scope => scope.id === (parentId ?? p.id))
    if (scopes.length !== 1) throw Error("EXACT_REVIEW_SCOPE_REQUIRED")
    const s = scopes[0]!
    const scope = { id: s.id, eventDistances: [...s.eventDistances], experience: [...s.experience],
      replacementRole: s.replacementRole, population: [...s.population], actor: [...s.actor], status: s.status }
    return { id: p.id, parentId, scope, explanation: previewPendingMethodExplanation(p) }
  })
  if (new Set(items.map(item => item.id)).size !== items.length) throw Error("DUPLICATE_REVIEW_CONFIGURATION")
  const supportAlternatives = METHOD_ADOPTION_PROTOCOLS.filter(p => p.id.startsWith("P-INTRO-")).map(p => {
    const session = assembleProposalSession(p, "INTRO_COMPARISON")
    const parts = (input: typeof session.warmup) => input.map(({ role, unit, value, cue }) => ({ role, unit, value, cue }))
    return { protocolId: p.id, supportRef: session.supportRef,
      status: "OWNER_ADOPTION_PENDING" as const, executionAuthority: "NONE" as const,
      warmup: parts(session.warmup), cooldown: parts(session.cooldown),
      supportSeconds: session.supportSeconds, totalSeconds: session.totalSeconds,
      replacesDefault: false, applicabilityReviewed: false,
      requiredReviews: ["EXACT_SUPPORT_ADOPTION", "INTRO_SUPPORT_APPLICABILITY", "INTRO_SEGMENT_READINESS", "WHOLE_CYCLE_PLACEMENT"] }
  })
  const content = {
    kind: "METHOD_OWNER_REVIEW_BUNDLE_V3" as const, version: "3",
    executionAuthority: "NONE" as const, ownerDecision: "NOT_GRANTED" as const,
    scope: "PROPOSED_CONFIGURATIONS_EXPLANATIONS_AND_POPULATIONS" as const,
    items, supportAlternatives,
    excludes: ["OWNER_APPROVAL_RECORD", "RUNTIME_AUTHORITY", "WHOLE_PLAN_COMBINATION_APPROVAL",
      "PERSONAL_RECORD_IDENTITY", "PERSONAL_PACE_MODEL_APPROVAL", "AUTOMATIC_PROGRESSION"],
    unresolvedDecisions: [...new Set(["EXACT_DOSE_AND_EFFORT_ADOPTION", "SUPPORT_APPLICABILITY",
      "WHOLE_FRAME_AND_COMBINATION_RULES", "INDIVIDUAL_TIME_LIMIT_VS_INITIAL_ESTIMATE",
      "PERSONAL_REFERENCE_MODELS", "INTRO_SEGMENT_READINESS", ...items.flatMap(item => item.explanation.pending),
      ...supportAlternatives.flatMap(item => item.requiredReviews)])],
  }
  return { ...content, contentFingerprint: canonicalJsonFingerprint("trainoracle.owner-review-bundle.v3", content) }
}
