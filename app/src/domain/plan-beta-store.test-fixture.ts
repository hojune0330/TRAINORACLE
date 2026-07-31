import type { PlanBetaState } from "./plan-beta-store"

export function stateFixture(): PlanBetaState {
  return {
    version: 1,
    intake: {
      eventGroup: "FIVE_K",
      experienceBand: "DEVELOPING",
      availableDayCount: 4,
      requestedFrameLength: 9,
      trainingFocus: "LT_INTENT",
      secondSessionMode: "SINGLE_SESSION_ONLY",
    },
    activePlan: {
      kind: "BETA_ACTIVE_PLAN_SNAPSHOT",
      activationState: "SELECTED_BETA_SNAPSHOT",
      candidateId: "candidate-1",
      candidateKind: "BALANCED",
      selectionActor: "SELF",
      sourceMode: "PROFILE_ONLY",
      selectedEnergyIntent: "LT_INTENT",
      frame: {
        lengthDays: 9,
        continuity: { kind: "STANDARD_FRAME" },
      },
      sessions: [
        {
          day: 1,
          slot: "AM",
          role: "EASY",
          plannedEnergyIntent: "BASE_INTENT",
          prescription: {
            kind: "RPE_TIME_RANGE",
            rpe: { minimum: 2, maximum: 4 },
            durationMinutes: { minimum: 20, maximum: 30 },
          },
        },
      ],
    },
    progress: [],
    generatedAt: "2026-07-24T00:00:00.000Z",
  }
}
