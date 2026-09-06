import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import type { PlanBetaStateV3 } from "./plan-beta-schema"
import { deriveStoredPlanMethodHistory } from "./plan-method-history"

export type PlanArchiveReason = "MANUAL" | "SUCCESSOR"

/** Projection only. Callers must validate the input and the resulting archive. */
export function planHistorySnapshotContent(state: PlanBetaStateV3, archivedAt: string, archiveReason: PlanArchiveReason) {
  const frame = state.activePlan.frame
  const visibleDays = Math.ceil("projectionLengthDays" in frame
    ? (frame.projectionLengthDays ?? frame.lengthDays) : frame.lengthDays)
  const progress = archiveReason === "SUCCESSOR"
    ? state.progress.filter(item => item.sessionDay <= visibleDays) : state.progress
  return {
    version: 5 as const,
    candidateId: state.activePlan.candidateId,
    pairId: state.activePlan.pairId,
    candidateKind: state.activePlan.candidateKind,
    eventDistanceM: state.activePlan.eventDistanceM,
    selectedDetailedTemplateRef: state.activePlan.selectedDetailedTemplateRef,
    ...(state.periodization === undefined ? {} : { periodization: state.periodization }),
    frameLengthDays: frame.lengthDays,
    progress,
    methodHistory: deriveStoredPlanMethodHistory({ sessions: state.activePlan.sessions, progress }),
    archivedAt,
    archiveReason,
    originalPlan: state,
    originalPlanFingerprint: canonicalJsonFingerprint("trainoracle.archived-original-plan.v1", state),
  }
}
