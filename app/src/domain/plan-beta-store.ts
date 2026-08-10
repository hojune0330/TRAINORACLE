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

export type PlanStorageResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: "PLAN_STORAGE_WRITE_FAILED" }

export type PlanArchiveResult =
  | { readonly ok: true; readonly intake: PlanBetaIntake }
  | {
      readonly ok: false
      readonly code: "PLAN_ARCHIVE_WRITE_FAILED"
      readonly rollbackComplete: boolean
    }

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

export function savePlanBetaState(state: PlanBetaState): PlanStorageResult {
  if (typeof window === "undefined") {
    return { ok: false, code: "PLAN_STORAGE_WRITE_FAILED" }
  }
  const parsed = parsePlanBetaState(state)
  if (parsed === null) return { ok: false, code: "PLAN_STORAGE_WRITE_FAILED" }

  try {
    const serialized = JSON.stringify(parsed)
    window.localStorage.setItem(STORAGE_KEY, serialized)
    if (window.localStorage.getItem(STORAGE_KEY) !== serialized) {
      return { ok: false, code: "PLAN_STORAGE_WRITE_FAILED" }
    }
    return { ok: true }
  } catch {
    return { ok: false, code: "PLAN_STORAGE_WRITE_FAILED" }
  }
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

export function archiveAndClearActivePlan(state: PlanBetaState): PlanArchiveResult {
  if (typeof window === "undefined") {
    return {
      ok: false,
      code: "PLAN_ARCHIVE_WRITE_FAILED",
      rollbackComplete: false,
    }
  }

  const history: StoredPlanHistory = {
    candidateId: state.activePlan.candidateId,
    candidateKind: state.activePlan.candidateKind,
    frameLengthDays: state.activePlan.frame.lengthDays,
    progress: state.progress,
    archivedAt: new Date().toISOString(),
  }
  const oldHistory = window.localStorage.getItem(HISTORY_KEY)
  const oldIntake = window.sessionStorage.getItem(PREVIOUS_INTAKE_KEY)
  const oldActive = window.localStorage.getItem(STORAGE_KEY)

  try {
    const previous = loadPlanHistory()
    const stagedHistory = JSON.stringify([history, ...previous].slice(0, 5))
    const stagedIntake = JSON.stringify(state.intake)
    window.localStorage.setItem(HISTORY_KEY, stagedHistory)
    if (window.localStorage.getItem(HISTORY_KEY) !== stagedHistory) {
      throw new Error("Plan history was not persisted")
    }
    window.sessionStorage.setItem(PREVIOUS_INTAKE_KEY, stagedIntake)
    if (window.sessionStorage.getItem(PREVIOUS_INTAKE_KEY) !== stagedIntake) {
      throw new Error("Previous intake was not persisted")
    }
    window.localStorage.removeItem(STORAGE_KEY)
    if (window.localStorage.getItem(STORAGE_KEY) !== null) {
      throw new Error("Active plan was not cleared")
    }
    return { ok: true, intake: state.intake }
  } catch {
    const rollbackComplete = [
      restoreStorageValue(window.localStorage, HISTORY_KEY, oldHistory),
      restoreStorageValue(window.sessionStorage, PREVIOUS_INTAKE_KEY, oldIntake),
      restoreStorageValue(window.localStorage, STORAGE_KEY, oldActive),
    ].every(Boolean)
    return { ok: false, code: "PLAN_ARCHIVE_WRITE_FAILED", rollbackComplete }
  }
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

function restoreStorageValue(
  storage: Storage,
  key: string,
  value: string | null,
): boolean {
  try {
    if (value === null) storage.removeItem(key)
    else storage.setItem(key, value)
    return storage.getItem(key) === value
  } catch {
    return false
  }
}
