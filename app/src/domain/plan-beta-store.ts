import type {
  PlanContinuityInput,
  PlanProgressState,
} from "@impl/plan-generator/types"
import { recordPlanProgress } from "@impl/plan-generator/generator"
import {
  parsePlanBetaState,
  planBetaStateV3Schema,
  planHistoryListSchema,
  planIntakeSchema,
  storedPlanIntakeSchema,
} from "./plan-beta-schema"
import {
  getPlanMutationLockManager,
  PLAN_BETA_MUTATION_LOCK_NAME,
} from "./plan-mutation-lock"
import {
  accountScopedStorageKey,
  accountScopedStorageKeyFor,
  localAccountScopeIsCurrent,
  localAccountScopeSnapshot,
} from "./account/local-account-scope"
import type {
  PlanBetaIntake,
  PlanBetaState,
  PlanBetaStateV2,
  PlanBetaStateV3,
  StoredPlanBetaIntake,
  StoredPlanHistory,
  StoredPlanProgress,
} from "./plan-beta-schema"
export type {
  PlanBetaIntake,
  PlanBetaState,
  PlanBetaStateV2,
  PlanBetaStateV3,
  StoredPlanBetaIntake,
  StoredPlanHistory,
  StoredPlanProgress,
} from "./plan-beta-schema"
export type { StoredActivePlan } from "./plan-session-schema"

export const PLAN_BETA_STORAGE_KEY = "trainoracle.plan-beta.v1"
const HISTORY_KEY = "trainoracle.plan-beta.history.v1"
const PREVIOUS_INTAKE_KEY = "trainoracle.plan-beta.previous-intake.v1"

export function activePlanBetaStorageKey(): string {
  return accountScopedStorageKey(PLAN_BETA_STORAGE_KEY)
}

export type PlanStorageResult =
  | { readonly ok: true }
  | {
      readonly ok: false
      readonly code: "PLAN_STORAGE_WRITE_FAILED"
      readonly rollbackComplete: boolean
    }

export type PlanBetaStateReadResult =
  | { readonly kind: "loaded"; readonly state: PlanBetaState }
  | { readonly kind: "missing" }
  | { readonly kind: "invalid" }
  | { readonly kind: "storage_error" }

export type PlanProgressStorageResult =
  | { readonly kind: "saved"; readonly state: PlanBetaStateV3 }
  | {
      readonly kind: "rejected"
      readonly code:
        | "MUTATION_LOCK_UNAVAILABLE"
        | "STALE_BASE"
        | "INVALID_STORED_PLAN"
        | "PLAN_STORAGE_STATE_UNCERTAIN"
        | "INVALID_PROGRESS"
    }
  | {
      readonly kind: "failed"
      readonly code: "PLAN_STORAGE_WRITE_FAILED"
      readonly rollbackComplete: boolean
    }

export type PlanArchiveResult =
  | { readonly ok: true; readonly intake: StoredPlanBetaIntake }
  | {
      readonly ok: false
      readonly code: "PLAN_ARCHIVE_WRITE_FAILED"
      readonly rollbackComplete: boolean
    }

export type LockedPlanArchiveResult =
  | { readonly kind: "archived"; readonly intake: StoredPlanBetaIntake }
  | {
      readonly kind: "rejected"
      readonly code:
        | "MUTATION_LOCK_UNAVAILABLE"
        | "STALE_BASE"
        | "INVALID_STORED_PLAN"
        | "PLAN_STORAGE_STATE_UNCERTAIN"
    }
  | {
      readonly kind: "failed"
      readonly code: "PLAN_ARCHIVE_WRITE_FAILED"
      readonly rollbackComplete: boolean
    }

export function loadPlanBetaState(): PlanBetaState | null {
  const parsed = loadVersionedPlanBetaState()
  return parsed
}

export function loadVersionedPlanBetaState(): PlanBetaState | null {
  const result = readPlanBetaStateFromStorage()
  return result.kind === "loaded" ? result.state : null
}

export function readPlanBetaStateFromStorage(): PlanBetaStateReadResult {
  return readPlanBetaStateForAccount(localAccountScopeSnapshot())
}

export function readPlanBetaStateForAccount(
  accountScope: string | null,
): PlanBetaStateReadResult {
  if (typeof window === "undefined") return { kind: "storage_error" }
  const storageKey = accountScopedStorageKeyFor(PLAN_BETA_STORAGE_KEY, accountScope)
  let raw: string | null
  try {
    raw = window.localStorage.getItem(storageKey)
  } catch {
    return { kind: "storage_error" }
  }
  if (raw === null) return { kind: "missing" }

  try {
    const json: unknown = JSON.parse(raw)
    const state = parsePlanBetaState(json)
    return state === null ? { kind: "invalid" } : { kind: "loaded", state }
  } catch {
    return { kind: "invalid" }
  }
}

export function savePlanBetaState(
  state: unknown,
): PlanStorageResult {
  if (typeof window === "undefined") {
    return { ok: false, code: "PLAN_STORAGE_WRITE_FAILED", rollbackComplete: false }
  }
  const parsed = planBetaStateV3Schema.safeParse(state)
  if (!parsed.success) {
    return { ok: false, code: "PLAN_STORAGE_WRITE_FAILED", rollbackComplete: true }
  }

  let previous: string | null = null
  let previousCaptured = false
  const storageKey = activePlanBetaStorageKey()
  try {
    previous = window.localStorage.getItem(storageKey)
    previousCaptured = true
    const serialized = JSON.stringify(parsed.data)
    window.localStorage.setItem(storageKey, serialized)
    if (window.localStorage.getItem(storageKey) !== serialized) {
      const rollbackComplete = restoreStorageValue(
        window.localStorage,
        storageKey,
        previous,
      )
      return { ok: false, code: "PLAN_STORAGE_WRITE_FAILED", rollbackComplete }
    }

    return { ok: true }
  } catch {
    const rollbackComplete = previousCaptured
      && restoreStorageValue(window.localStorage, storageKey, previous)
    return { ok: false, code: "PLAN_STORAGE_WRITE_FAILED", rollbackComplete }
  }
}

export async function savePlanProgressWithLock(
  expectedCandidateId: string,
  progress: StoredPlanProgress,
): Promise<PlanProgressStorageResult> {
  const accountScope = localAccountScopeSnapshot()
  const locks = getPlanMutationLockManager()
  if (locks === null) return { kind: "rejected", code: "MUTATION_LOCK_UNAVAILABLE" }

  try {
    return await locks.request(
      PLAN_BETA_MUTATION_LOCK_NAME,
      { mode: "exclusive", ifAvailable: true },
      async (lock) => {
        if (lock === null) return { kind: "rejected", code: "MUTATION_LOCK_UNAVAILABLE" } as const
        if (!localAccountScopeIsCurrent(accountScope)) {
          return { kind: "rejected", code: "PLAN_STORAGE_STATE_UNCERTAIN" } as const
        }
        const currentRead = readPlanBetaStateFromStorage()
        if (currentRead.kind === "storage_error") {
          return { kind: "rejected", code: "PLAN_STORAGE_STATE_UNCERTAIN" } as const
        }
        if (currentRead.kind === "invalid") {
          return { kind: "rejected", code: "INVALID_STORED_PLAN" } as const
        }
        if (currentRead.kind === "missing") {
          return { kind: "rejected", code: "STALE_BASE" } as const
        }
        const current = currentRead.state
        if (current.version !== 3 || current.activePlan.candidateId !== expectedCandidateId) {
          return { kind: "rejected", code: "STALE_BASE" } as const
        }
        const recorded = recordPlanProgress({
          kind: "PLAN_BETA_PROGRESS_REQUEST",
          activePlan: current.activePlan,
          sessionDay: progress.sessionDay,
          sessionSlot: progress.sessionSlot,
          state: progress.state,
        })
        if (recorded.kind !== "recorded") {
          return { kind: "rejected", code: "INVALID_PROGRESS" } as const
        }
        const next = updateStoredProgress(current, progress)
        const saved = savePlanBetaState(next)
        return saved.ok
          ? { kind: "saved", state: next } as const
          : {
              kind: "failed",
              code: saved.code,
              rollbackComplete: saved.rollbackComplete,
            } as const
      },
    )
  } catch {
    return { kind: "rejected", code: "MUTATION_LOCK_UNAVAILABLE" }
  }
}

export function updateStoredProgress(
  state: PlanBetaStateV3,
  progress: StoredPlanProgress,
): PlanBetaStateV3
export function updateStoredProgress(
  state: PlanBetaState,
  progress: StoredPlanProgress,
): PlanBetaState
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
  if (state.version !== 3) {
    return {
      ok: false,
      code: "PLAN_ARCHIVE_WRITE_FAILED",
      rollbackComplete: true,
    }
  }

  const history: StoredPlanHistory = {
    version: 3,
    candidateId: state.activePlan.candidateId,
    pairId: state.activePlan.pairId,
    candidateKind: state.activePlan.candidateKind,
    eventDistanceM: state.activePlan.eventDistanceM,
    selectedDetailedTemplateRef: state.activePlan.selectedDetailedTemplateRef,
    frameLengthDays: state.activePlan.frame.lengthDays,
    progress: state.progress,
    archivedAt: new Date().toISOString(),
  }
  let oldHistory: string | null = null
  let oldIntake: string | null = null
  let oldActive: string | null = null
  let snapshotsCaptured = false
  const historyKey = accountScopedStorageKey(HISTORY_KEY)
  const previousIntakeKey = accountScopedStorageKey(PREVIOUS_INTAKE_KEY)
  const activeKey = activePlanBetaStorageKey()

  try {
    oldHistory = window.localStorage.getItem(historyKey)
    oldIntake = window.sessionStorage.getItem(previousIntakeKey)
    oldActive = window.localStorage.getItem(activeKey)
    snapshotsCaptured = true
    const previous = loadPlanHistory()
    const stagedHistory = JSON.stringify([history, ...previous].slice(0, 5))
    const stagedIntake = JSON.stringify(state.intake)
    window.localStorage.setItem(historyKey, stagedHistory)
    if (window.localStorage.getItem(historyKey) !== stagedHistory) {
      throw new Error("Plan history was not persisted")
    }
    window.sessionStorage.setItem(previousIntakeKey, stagedIntake)
    if (window.sessionStorage.getItem(previousIntakeKey) !== stagedIntake) {
      throw new Error("Previous intake was not persisted")
    }
    window.localStorage.removeItem(activeKey)
    if (window.localStorage.getItem(activeKey) !== null) {
      throw new Error("Active plan was not cleared")
    }
    return { ok: true, intake: state.intake }
  } catch {
    const rollbackComplete = snapshotsCaptured && [
      restoreStorageValue(window.localStorage, historyKey, oldHistory),
      restoreStorageValue(window.sessionStorage, previousIntakeKey, oldIntake),
      restoreStorageValue(window.localStorage, activeKey, oldActive),
    ].every(Boolean)
    return { ok: false, code: "PLAN_ARCHIVE_WRITE_FAILED", rollbackComplete }
  }
}

export async function archiveAndClearActivePlanWithLock(
  expectedCandidateId: string,
): Promise<LockedPlanArchiveResult> {
  const accountScope = localAccountScopeSnapshot()
  const locks = getPlanMutationLockManager()
  if (locks === null) return { kind: "rejected", code: "MUTATION_LOCK_UNAVAILABLE" }

  try {
    return await locks.request(
      PLAN_BETA_MUTATION_LOCK_NAME,
      { mode: "exclusive", ifAvailable: true },
      async (lock) => {
        if (lock === null) {
          return { kind: "rejected", code: "MUTATION_LOCK_UNAVAILABLE" } as const
        }
        if (!localAccountScopeIsCurrent(accountScope)) {
          return { kind: "rejected", code: "PLAN_STORAGE_STATE_UNCERTAIN" } as const
        }
        const currentRead = readPlanBetaStateFromStorage()
        if (currentRead.kind === "storage_error") {
          return { kind: "rejected", code: "PLAN_STORAGE_STATE_UNCERTAIN" } as const
        }
        if (currentRead.kind === "invalid") {
          return { kind: "rejected", code: "INVALID_STORED_PLAN" } as const
        }
        if (currentRead.kind === "missing") {
          return { kind: "rejected", code: "STALE_BASE" } as const
        }
        const current = currentRead.state
        if (current.version !== 3 || current.activePlan.candidateId !== expectedCandidateId) {
          return { kind: "rejected", code: "STALE_BASE" } as const
        }
        const archived = archiveAndClearActivePlan(current)
        return archived.ok
          ? { kind: "archived", intake: archived.intake } as const
          : {
              kind: "failed",
              code: archived.code,
              rollbackComplete: archived.rollbackComplete,
            } as const
      },
    )
  } catch {
    return { kind: "rejected", code: "MUTATION_LOCK_UNAVAILABLE" }
  }
}

export function loadPreviousIntake(): StoredPlanBetaIntake | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.sessionStorage.getItem(accountScopedStorageKey(PREVIOUS_INTAKE_KEY))
    if (raw === null) return null
    const json: unknown = JSON.parse(raw)
    const current = planIntakeSchema.safeParse(json)
    if (current.success) return current.data
    const legacy = storedPlanIntakeSchema.safeParse(json)
    return legacy.success ? legacy.data : null
  } catch {
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
  try {
    const raw = window.localStorage.getItem(accountScopedStorageKey(HISTORY_KEY))
    if (raw === null) return []
    const json: unknown = JSON.parse(raw)
    const parsed = planHistoryListSchema.safeParse(json)
    return parsed.success ? parsed.data : []
  } catch {
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
