import type {
  PlanContinuityInput,
  PlanProgressState,
} from "@impl/plan-generator/types"
import {
  parsePlanBetaState,
  planHistoryListSchema,
  planIntakeSchema,
} from "./plan-beta-schema"
import type {
  PlanBetaIntake,
  PlanBetaState,
  StoredPlanHistory,
  StoredPlanProgress,
} from "./plan-beta-schema"
export type {
  PlanBetaIntake,
  PlanBetaState,
  StoredPlanHistory,
  StoredPlanProgress,
} from "./plan-beta-schema"
export type { StoredActivePlan } from "./plan-session-schema"

const STORAGE_KEY = "trainoracle.plan-beta.v1"
const HISTORY_KEY = "trainoracle.plan-beta.history.v1"
const PREVIOUS_INTAKE_KEY = "trainoracle.plan-beta.previous-intake.v1"

export function loadPlanBetaState(): PlanBetaState | null {
  if (typeof window === "undefined") return null
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (raw === null) return null

  try {
    const json: unknown = JSON.parse(raw)
    return parsePlanBetaState(json)
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error
    return null
  }
}

export function savePlanBetaState(state: PlanBetaState): void {
  if (typeof window === "undefined") return
  const parsed = parsePlanBetaState(state)
  if (parsed === null) return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed))
}

export function updateStoredProgress(
  state: PlanBetaState,
  progress: StoredPlanProgress,
): PlanBetaState {
  const withoutSession = state.progress.filter(
    (item) => (
      item.sessionDay !== progress.sessionDay
      || item.sessionSlot !== progress.sessionSlot
    ),
  )
  return {
    ...state,
    progress: [...withoutSession, progress].sort((left, right) => (
      left.sessionDay - right.sessionDay
      || left.sessionSlot.localeCompare(right.sessionSlot)
    )),
  }
}

export function archiveAndClearActivePlan(state: PlanBetaState): PlanBetaIntake {
  if (typeof window !== "undefined") {
    const history: StoredPlanHistory = {
      candidateId: state.activePlan.candidateId,
      candidateKind: state.activePlan.candidateKind,
      frameLengthDays: state.activePlan.frame.lengthDays,
      progress: state.progress,
      archivedAt: new Date().toISOString(),
    }
    const previous = loadPlanHistory()
    window.localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify([history, ...previous].slice(0, 5)),
    )
    window.localStorage.removeItem(STORAGE_KEY)
    window.sessionStorage.setItem(
      PREVIOUS_INTAKE_KEY,
      JSON.stringify(state.intake),
    )
  }
  return state.intake
}

export function loadPreviousIntake(): PlanBetaIntake | null {
  if (typeof window === "undefined") return null
  const raw = window.sessionStorage.getItem(PREVIOUS_INTAKE_KEY)
  if (raw === null) return null

  try {
    const json: unknown = JSON.parse(raw)
    const parsed = planIntakeSchema.safeParse(json)
    return parsed.success ? parsed.data : null
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error
    return null
  }
}

export function loadPreviousContinuity(): PlanContinuityInput | undefined {
  const [latest] = loadPlanHistory()
  if (latest === undefined) return undefined

  const states: readonly PlanProgressState[] = [
    "COMPLETED",
    "RESTED",
    "SKIPPED",
    "PAIN_CHECKIN",
  ]
  return {
    previousCandidateKind: latest.candidateKind,
    progressStateCounts: states.map((state) => ({
      state,
      count: latest.progress.filter((item) => item.state === state).length,
    })),
  }
}

function loadPlanHistory(): readonly StoredPlanHistory[] {
  if (typeof window === "undefined") return []
  const raw = window.localStorage.getItem(HISTORY_KEY)
  if (raw === null) return []

  try {
    const json: unknown = JSON.parse(raw)
    const parsed = planHistoryListSchema.safeParse(json)
    return parsed.success ? parsed.data : []
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error
    return []
  }
}
