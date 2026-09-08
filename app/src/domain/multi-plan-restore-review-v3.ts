import { readStoredMultiAdjustedPlanV6, RETAINED_MULTI_ADJUSTED_EVIDENCE_V3, type StoredMultiAdjustedPlanStateV6, type MultiAdjustedLiveReviewV3 } from "./adjusted-plan-storage-v6"
import { checkMultiAdjustedPlanReviewV3, REVIEWED_MULTI_ADJUSTED_PLAN_POLICIES_V3 } from "./adjusted-plan-multi-review-v3"
import { REVIEWED_RPE_SOURCE_BINDINGS_V3 } from "./rpe-adjusted-slot-v3"

export function readCurrentMultiRestoreReviewV3(state: StoredMultiAdjustedPlanStateV6, registry = {
  retained: RETAINED_MULTI_ADJUSTED_EVIDENCE_V3,
  rpeBindings: REVIEWED_RPE_SOURCE_BINDINGS_V3,
  policies: REVIEWED_MULTI_ADJUSTED_PLAN_POLICIES_V3,
}, at = new Date()): MultiAdjustedLiveReviewV3 {
  const matches = registry.retained.filter(bundle => readStoredMultiAdjustedPlanV6(state, [bundle], at).kind === "loaded")
  if (matches.length !== 1) throw Error("RETAINED_MULTI_EVIDENCE_UNAVAILABLE")
  const bundle = matches[0]!, selection = state.selection
  const preparations = selection.activePlan.sessions.filter(s => s.prescription.kind === "ADJUSTED_METHOD_V3").map(slot => {
    if (slot.prescription.kind !== "ADJUSTED_METHOD_V3") throw Error("INVALID_ADJUSTED_SLOT")
    const evidence = bundle.slots.filter(e => e.address.day === slot.day && e.address.slot === slot.slot)
    const sources = selection.adjustments.sources.filter(s => s.address.day === slot.day && s.address.slot === slot.slot)
    if (evidence.length !== 1 || sources.length !== 1) throw Error("AMBIGUOUS_RESTORE_SOURCE")
    const retained = evidence[0]!, context = sources[0]!.context
    const common = { candidate: selection.adjustments.originalCandidate, address: retained.address,
      startDate: selection.intake.startDate!, rawSnapshot: JSON.stringify(slot.prescription.snapshot), explanation: retained.explanation }
    return "kind" in context ? { ...common, experienceBand: selection.intake.experienceBand,
      source: { ...context, authority: retained.authority, nowMs: at.getTime() } }
      : { ...common, source: { ...context, authority: retained.authority, nowMs: at.getTime() } }
  })
  const reviewed = checkMultiAdjustedPlanReviewV3(preparations, selection.intake.experienceBand, registry.rpeBindings, registry.policies)
  if (reviewed.kind !== "reviewed_scope" || reviewed.candidate.contentFingerprint !== selection.adjustments.selectedCandidateFingerprint)
    throw Error("CURRENT_RESTORE_REVIEW_REQUIRED")
  return { preparations, rpeBindings: registry.rpeBindings, policies: registry.policies, retained: registry.retained }
}
