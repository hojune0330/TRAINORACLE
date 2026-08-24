import type { PlanBetaState } from "./plan-beta-store"
import { deriveCandidateId, derivePairId } from "@impl/plan-generator/candidate-identity"

export function stateFixture(): PlanBetaState {
  const candidateBaseId = "beta:balanced:five_k:event-5000:developing:lt_intent:single_session_only:varies:projection-9:local-civil-9-5:fixture-main-1-fixture-main-2:1-5-9:no_usable_journal:no-continuity:template-rpe-only"
  const pairBaseId = "plan-pair:v3:5000:rpe-only:lt_intent:fixture-main-1-fixture-main-2:1-5-9:no-continuity"
  const frame = {
    formationKind: "LOCAL_CIVIL_9_5" as const,
    lengthDays: 9.5 as const,
    slotCount: 19 as const,
    projectionLengthDays: 9 as const,
    continuity: { kind: "STANDARD_FRAME" as const },
  }
  const sessions = [{
    day: 1,
    slot: "AM" as const,
    role: "EASY" as const,
    plannedEnergyIntent: "BASE_INTENT" as const,
    prescription: {
      kind: "RPE_TIME_RANGE" as const,
      rpe: { minimum: 2, maximum: 4 },
      durationMinutes: { minimum: 20, maximum: 30 },
    },
  }]
  const projection = {
    kind: "BALANCED" as const,
    eventDistanceM: 5000 as const,
    selectedDetailedTemplateRef: null,
    selectedEnergyIntent: "LT_INTENT" as const,
    sourceMode: "PROFILE_ONLY" as const,
    selectionAuthority: "SELF" as const,
    frame,
    sessions,
  }
  const candidateId = deriveCandidateId(candidateBaseId, projection)
  const conservativeId = deriveCandidateId(
    candidateBaseId.replace("beta:balanced:", "beta:conservative:"),
    { ...projection, kind: "CONSERVATIVE" },
  )
  const pairId = derivePairId(pairBaseId, candidateId, conservativeId)
  return {
    version: 3,
    intake: {
      eventGroup: "FIVE_K",
      eventDistanceM: 5000,
      competitionDivision: "OPEN",
      experienceBand: "DEVELOPING",
      availableDayCount: 4,
      requestedFrameLength: 9,
      trainingFocus: "LT_INTENT",
      secondSessionMode: "SINGLE_SESSION_ONLY",
      trainingTimePreference: "VARIES",
      selectedDetailedTemplateRef: null,
    },
    activePlan: {
      kind: "BETA_ACTIVE_PLAN_SNAPSHOT",
      activationState: "SELECTED_BETA_SNAPSHOT",
      candidateId,
      pairId,
      candidateKind: "BALANCED",
      eventDistanceM: 5000,
      selectedDetailedTemplateRef: null,
      selectionActor: "SELF",
      sourceMode: "PROFILE_ONLY",
      selectedEnergyIntent: "LT_INTENT",
      frame,
      sessions,
    },
    progress: [],
    generatedAt: "2026-07-24T00:00:00.000Z",
  }
}
