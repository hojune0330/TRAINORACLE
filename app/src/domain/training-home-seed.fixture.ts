import { parsePlanBetaState } from "./plan-beta-schema"
import type { PlanBetaState } from "./plan-beta-store"

/**
 * TRAINING 모드 확인용 시드 데이터 (수동 검증 전용 — 프로덕션 코드에서 import 금지).
 *
 * 사용법: 브라우저 콘솔에서
 *   localStorage.setItem("trainoracle.plan-beta.v1", JSON.stringify(seed))
 * 를 실행한 뒤 홈으로 이동하면 homeMode가 TRAINING이 된다.
 */
export function trainingHomeSeedFixture(today: string): PlanBetaState {
  const state: PlanBetaState = {
    version: 2,
    intake: {
      eventGroup: "FIVE_K",
      competitionDivision: "OPEN",
      experienceBand: "DEVELOPING",
      availableDayCount: 4,
      requestedFrameLength: 9,
      trainingFocus: "LT_INTENT",
      secondSessionMode: "SINGLE_SESSION_ONLY",
      trainingTimePreference: "VARIES",
      startDate: today,
    },
    activePlan: {
      kind: "BETA_ACTIVE_PLAN_SNAPSHOT",
      activationState: "SELECTED_BETA_SNAPSHOT",
      candidateId: "training-mode-verify-candidate",
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
          day: 2,
          slot: "AM",
          role: "QUALITY",
          plannedEnergyIntent: "LT_INTENT",
          prescription: {
            kind: "RPE_TIME_RANGE",
            rpe: { minimum: 5, maximum: 6 },
            durationMinutes: { minimum: 25, maximum: 40 },
          },
        },
        {
          day: 3,
          slot: "PM",
          role: "EASY",
          plannedEnergyIntent: "RECOVERY_INTENT",
          prescription: {
            kind: "RPE_TIME_RANGE",
            rpe: { minimum: 2, maximum: 3 },
            durationMinutes: { minimum: 20, maximum: 30 },
          },
        },
        {
          day: 4,
          slot: "AM",
          role: "REST",
          prescription: { kind: "REST" },
        },
        {
          day: 5,
          slot: "AM",
          role: "QUALITY",
          plannedEnergyIntent: "VO2_INTENT",
          prescription: {
            kind: "RPE_TIME_RANGE",
            rpe: { minimum: 7, maximum: 8 },
            durationMinutes: { minimum: 30, maximum: 45 },
          },
        },
      ],
    },
    progress: [],
    generatedAt: new Date().toISOString(),
  }
  return state
}

/** 파서를 통과하는지 즉시 확인 (테스트/콘솔용). */
export function isTrainingHomeSeedValid(state: PlanBetaState): boolean {
  return parsePlanBetaState(state) !== null
}
