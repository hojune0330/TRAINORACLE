import { canonicalJson } from "@impl/plan-generator/adaptation"
import { resolveRegisteredAdaptationTransform } from "@impl/plan-generator/adaptation-transform-registry"
import { loadPlanAdaptationContext } from "./plan-adaptation-ui-context"
import type { PlanBetaState } from "./plan-beta-schema"
import { candidateMatchesCurrentSnapshot } from "./plan-current-cycle-context"

/** Read-only entry check. Safety and acceptance still run at the actual operation. */
export function inspectNextFrameAdaptation(state: PlanBetaState) {
  const unavailable = (code: string) => ({ kind: "unavailable" as const, code })
  if (state.version !== 3) return unavailable("ADAPTATION_CONTEXT_UNAVAILABLE")
  if (state.catalogReplacement || state.executionReplan) return unavailable("CHANGED_PLAN_TRANSFORM_UNAVAILABLE")
  if (state.activePlan.sessions.some(session => session.prescription.kind === "RPE_TIME_RANGE"
    && session.prescription.catalogWorkout)) return unavailable("CATALOG_TRANSFORM_UNAVAILABLE")
  const scope = state.adaptationScope
  const context = loadPlanAdaptationContext(state.activePlan.candidateId)
  if (!scope || !context) return unavailable("ADAPTATION_CONTEXT_UNAVAILABLE")
  const baseCandidate = context.candidates.find(candidate => candidate.candidateId === context.activeCandidateId)
  const proposedCandidate = context.candidates.find(candidate => candidate.kind !== baseCandidate?.kind)
  if (!baseCandidate || !proposedCandidate) return unavailable("ADAPTATION_CONTEXT_UNAVAILABLE")
  if (baseCandidate.selectionAuthority !== "SELF" || proposedCandidate.selectionAuthority !== "SELF"
    || state.activePlan.selectionActor !== "SELF") return unavailable("COACH_CONNECTION_REQUIRED")
  const plan = state.activePlan
  // IDs alone do not establish that an old comparison pair belongs to this snapshot.
  if (!candidateMatchesCurrentSnapshot(baseCandidate, state)
    || scope.eventDistanceM !== plan.eventDistanceM || scope.pairId !== plan.pairId
    || canonicalJson(scope.selectedDetailedTemplateRef) !== canonicalJson(plan.selectedDetailedTemplateRef)) {
    return unavailable("ADAPTATION_CONTEXT_MISMATCH")
  }
  const explicitRequest = resolveRegisteredAdaptationTransform(baseCandidate, proposedCandidate, "EXPLICIT_REQUEST") !== null
  const pbSb = resolveRegisteredAdaptationTransform(baseCandidate, proposedCandidate, "SAME_EVENT_PB_SB_AFTER_ACTIVE_PLAN_START") !== null
  if (!explicitRequest && !pbSb) return unavailable("NO_REGISTERED_TRANSFORM")
  return { kind: "available" as const, baseCandidate, proposedCandidate, explicitRequest, pbSb }
}
