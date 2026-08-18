import {
  canonicalJson,
  canonicalJsonSha256,
  createPlanAdaptationProposal,
} from "@impl/plan-generator/adaptation"
import type { PlanAdaptationProposal } from "@impl/plan-generator/adaptation"
import type {
  PlanCandidate,
  PlanSession,
} from "@impl/plan-generator/types"
import type { AthleteRecord } from "./athlete-records"
import {
  acceptNextFrameProposal,
  loadPendingNextFrameSuccessor,
} from "./plan-adaptation-store"
import type { AdaptationAcceptanceResult } from "./plan-adaptation-store"
import type {
  PendingNextFrameSuccessor,
  PlanBetaState,
  PlanBetaStateV2,
} from "./plan-beta-schema"
import {
  loadPlanAdaptationContext,
  parseActivePlanAdaptationSafety,
} from "./plan-adaptation-ui-context"
import type { ActivePlanAdaptationSafety } from "./plan-adaptation-ui-context"
export {
  adaptationScopeForCandidate,
  eligiblePbSbRecords,
  evaluateActivePlanAdaptationSafety,
  LOCAL_ADAPTATION_ATHLETE_ID,
  PLAN_ADAPTATION_CONTEXT_STORAGE_KEY,
  savePlanAdaptationContext,
} from "./plan-adaptation-ui-context"

type AdaptationReason = "PB_SB" | "EXPLICIT_REQUEST"

export type ChangedSession = {
  readonly before: PlanSession
  readonly after: PlanSession
}

export type PreparedNextFrameAdaptation = {
  readonly proposal: PlanAdaptationProposal
  readonly successorState: PlanBetaStateV2
  readonly changedSessions: readonly ChangedSession[]
  readonly reason: AdaptationReason
  readonly record: AthleteRecord | null
}

export type PrepareNextFrameResult =
  | { readonly kind: "ready"; readonly prepared: PreparedNextFrameAdaptation }
  | { readonly kind: "blocked"; readonly code: string }
  | { readonly kind: "unavailable"; readonly code: string }

type PrepareInput = {
  readonly state: PlanBetaState
  readonly reason: AdaptationReason
  readonly record: AthleteRecord | null
  readonly safety: ActivePlanAdaptationSafety
  readonly operationAt: string
}

export async function prepareNextFrameAdaptation(
  input: PrepareInput,
): Promise<PrepareNextFrameResult> {
  const safety = parseActivePlanAdaptationSafety(input.safety)
  if (safety === null) {
    return { kind: "blocked", code: "SAFETY_CONTEXT_UNAVAILABLE" }
  }
  if (safety.kind === "blocked") return safety
  if (!validOperationTimestamp(input.operationAt)) {
    return { kind: "blocked", code: "SAFETY_CONTEXT_UNAVAILABLE" }
  }
  const scope = input.state.adaptationScope
  const context = loadPlanAdaptationContext(input.state.activePlan.candidateId)
  if (scope === undefined || context === null) {
    return { kind: "unavailable", code: "ADAPTATION_CONTEXT_UNAVAILABLE" }
  }
  const baseCandidate = context.candidates.find(
    (candidate) => candidate.candidateId === context.activeCandidateId,
  )
  const proposedCandidate = context.candidates.find(
    (candidate) => candidate.kind === "CONSERVATIVE",
  )
  if (baseCandidate === undefined || proposedCandidate === undefined) {
    return { kind: "unavailable", code: "ADAPTATION_CONTEXT_UNAVAILABLE" }
  }
  if (
    baseCandidate.selectionAuthority !== "SELF"
    || proposedCandidate.selectionAuthority !== "SELF"
  ) {
    return { kind: "unavailable", code: "COACH_CONNECTION_REQUIRED" }
  }
  const trigger = triggerFor(input.reason, input.record, scope.athleteId)
  if (trigger === null) return { kind: "unavailable", code: "RECORD_NOT_ELIGIBLE" }
  const createdAt = input.operationAt
  const baseContentHash = await canonicalJsonSha256(
    "trainoracle.plan-candidate.v1",
    baseCandidate,
  )
  const result = await createPlanAdaptationProposal({
    kind: "PLAN_ADAPTATION_PROPOSAL_REQUEST",
    scope,
    activePlanStartedAt: input.state.generatedAt,
    baseCandidate,
    proposedCandidate,
    baseContentHash,
    proposalOrigin: "SELF_SERVICE",
    trigger,
    changeDimension: "VOLUME",
    safetyGate: safety.safetyGate,
    safetyEvaluatedAt: safety.safetyEvaluatedAt,
    safetyValidUntil: safety.safetyValidUntil,
    activeHold: safety.activeHold,
    createdAt,
    idempotencyKey: `adaptive-ui:${baseCandidate.candidateId}:${input.reason}:${input.record?.id ?? "request"}`,
  })
  if (result.kind === "blocked") return { kind: "blocked", code: result.code }
  if (result.kind === "rejected") return { kind: "unavailable", code: result.code }
  const successorState = successorStateFor(
    input.state,
    result.proposal.successorCandidate,
    createdAt,
  )
  return {
    kind: "ready",
    prepared: {
      proposal: result.proposal,
      successorState,
      changedSessions: changedSessions(
        result.proposal.baseCandidate.sessions,
        result.proposal.successorCandidate.sessions,
      ),
      reason: input.reason,
      record: input.record,
    },
  }
}

export async function acceptPreparedNextFrameAdaptation(input: {
  readonly prepared: PreparedNextFrameAdaptation
  readonly predecessorState: PlanBetaState
  readonly safety: ActivePlanAdaptationSafety
  readonly operationAt: string
}): Promise<AdaptationAcceptanceResult> {
  const safety = parseActivePlanAdaptationSafety(input.safety)
  if (safety === null || !validOperationTimestamp(input.operationAt)) {
    return { kind: "blocked", code: "SAFETY_BLOCKED" }
  }
  if (safety.kind === "blocked") return { kind: "blocked", code: "SAFETY_BLOCKED" }
  if (
    input.prepared.proposal.proposalOrigin !== "SELF_SERVICE"
    || input.prepared.proposal.selectionAuthority !== "SELF"
  ) {
    return { kind: "rejected", code: "UNAUTHORIZED" }
  }
  return acceptNextFrameProposal({
    proposal: input.prepared.proposal,
    predecessorState: input.predecessorState,
    successorState: input.prepared.successorState,
    actor: "SELF",
    safetyGate: safety.safetyGate,
    safetyEvaluatedAt: safety.safetyEvaluatedAt,
    safetyValidUntil: safety.safetyValidUntil,
    activeHold: safety.activeHold,
    acceptedAt: input.operationAt,
    idempotencyKey: input.prepared.proposal.idempotencyKey,
  })
}

export function loadMatchingPendingSuccessor(
  state: PlanBetaState,
): PendingNextFrameSuccessor | null {
  const pending = loadPendingNextFrameSuccessor()
  return pending?.baseCandidateId === state.activePlan.candidateId ? pending : null
}

function triggerFor(
  reason: AdaptationReason,
  record: AthleteRecord | null,
  athleteId: string,
) {
  if (reason === "EXPLICIT_REQUEST") {
    return {
      kind: "EXPLICIT_REQUEST" as const,
      requestedBy: "ATHLETE" as const,
      sourceRef: `athlete-request:${athleteId}:next-frame-volume`,
    }
  }
  if (record === null || record.achievedOn === null) return null
  if (record.purpose !== "PERSONAL_BEST" && record.purpose !== "SEASON_BEST") return null
  return {
    kind: "SAME_EVENT_PB_SB_AFTER_ACTIVE_PLAN_START" as const,
    explicitlyConfirmed: true as const,
    recordId: record.id,
    purpose: record.purpose,
    eventDistanceM: record.eventDistanceM,
    achievedAt: `${record.achievedOn}T00:00:00.000Z`,
    sourceRef: record.sourceRef,
    historicalOrBackfilled: false,
  }
}

function successorStateFor(
  state: PlanBetaState,
  candidate: PlanCandidate,
  generatedAt: string,
): PlanBetaStateV2 {
  const selectionActor = candidate.selectionAuthority === "SELF" ? "SELF" as const : "COACH" as const
  return {
    version: 2,
    intake: state.intake,
    activePlan: {
      kind: "BETA_ACTIVE_PLAN_SNAPSHOT",
      activationState: "SELECTED_BETA_SNAPSHOT",
      candidateId: candidate.candidateId,
      candidateKind: candidate.kind,
      eventDistanceM: candidate.eventDistanceM,
      selectionActor,
      sourceMode: candidate.sourceMode,
      selectedEnergyIntent: candidate.selectedEnergyIntent,
      frame: candidate.frame,
      sessions: candidate.sessions,
    },
    progress: [],
    generatedAt,
    ...(state.athleteEvidence === undefined ? {} : { athleteEvidence: state.athleteEvidence }),
    ...(state.adaptationScope === undefined ? {} : { adaptationScope: state.adaptationScope }),
  }
}

function changedSessions(
  before: readonly PlanSession[],
  after: readonly PlanSession[],
): readonly ChangedSession[] {
  return before.flatMap((session, index) => {
    const next = after[index]
    return next !== undefined && canonicalJson(session) !== canonicalJson(next)
      ? [{ before: session, after: next }]
      : []
  })
}

function validOperationTimestamp(value: string): boolean {
  return Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value
}
