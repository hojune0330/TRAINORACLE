import { selectPlanForActivation } from "../../domain/plan-beta-flow"
import type { PlanAthleteEvidence } from "../../domain/plan-beta-flow"
import {
  activePlanBetaStorageKey,
  readPlanBetaStateFromStorage,
  savePlanBetaState,
} from "../../domain/plan-beta-store"
import type {
  PlanBetaIntake,
  PlanBetaState,
} from "../../domain/plan-beta-store"
import type { PlanGenerationSuccess } from "@impl/plan-generator/types"
import type { SafetyGateDecision } from "@impl/safety-gate/gate"
import { isValidIsoDate } from "../../domain/dates"
import {
  adaptationScopeForCandidate,
  savePlanAdaptationContext,
} from "../../domain/plan-adaptation-ui"
import {
  getPlanMutationLockManager,
  PLAN_BETA_MUTATION_LOCK_NAME,
} from "../../domain/plan-mutation-lock"
import {
  localAccountScopeIsCurrent,
  localAccountScopeSnapshot,
} from "../../domain/account/local-account-scope"

export type CandidateSelection = {
  readonly candidateId: string
  readonly startDate: string
}

export type CandidateSaveResult =
  | { readonly kind: "saved"; readonly state: PlanBetaState }
  | { readonly kind: "rejected"; readonly code: string }

export async function saveSelectedPlanCandidate(
  selection: CandidateSelection,
  generated: PlanGenerationSuccess,
  gate: SafetyGateDecision,
  intake: PlanBetaIntake | null,
  athleteEvidence: PlanAthleteEvidence,
  isCurrentDraft: () => boolean = () => true,
): Promise<CandidateSaveResult> {
  if (!isCurrentDraft()) return { kind: "rejected", code: "STALE_CANDIDATE_SELECTION" }
  if (intake === null || !isValidIsoDate(selection.startDate)) {
    return { kind: "rejected", code: "MINIMUM_PROFILE_INCOMPLETE" }
  }
  const selected = selectPlanForActivation(selection.candidateId, generated, gate, {
    ...intake,
    startDate: selection.startDate,
  }, athleteEvidence)
  if (selected.kind !== "selected") {
    return { kind: "rejected", code: selected.code }
  }
  const canonicalCandidate = generated.candidates.find(
    (candidate) => candidate.candidateId === selected.state.activePlan.candidateId,
  )
  if (canonicalCandidate === undefined) {
    return { kind: "rejected", code: "CANDIDATE_NOT_FOUND" }
  }
  const adaptationScope = adaptationScopeForCandidate(canonicalCandidate)
  const state = adaptationScope === null
    ? selected.state
    : { ...selected.state, adaptationScope }
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
        if (!isCurrentDraft()) {
          return { kind: "rejected", code: "STALE_CANDIDATE_SELECTION" } as const
        }
        if (!localAccountScopeIsCurrent(accountScope)) {
          return { kind: "rejected", code: "PLAN_STORAGE_STATE_UNCERTAIN" } as const
        }
        if (typeof window === "undefined") {
          return { kind: "rejected", code: "PLAN_STORAGE_WRITE_FAILED" } as const
        }

        const previousRead = readPlanBetaStateFromStorage()
        if (previousRead.kind === "storage_error") {
          return { kind: "rejected", code: "PLAN_STORAGE_STATE_UNCERTAIN" } as const
        }
        if (previousRead.kind === "invalid") {
          return { kind: "rejected", code: "INVALID_STORED_PLAN" } as const
        }
        if (previousRead.kind === "loaded") {
          return { kind: "rejected", code: "STALE_BASE" } as const
        }
        const previousActive = null

        const saved = savePlanBetaState(state)
        if (!saved.ok) {
          return {
            kind: "rejected",
            code: saved.rollbackComplete ? saved.code : "PLAN_STORAGE_STATE_UNCERTAIN",
          } as const
        }
        const contextSaved = adaptationScope === null
          ? { ok: true } as const
          : savePlanAdaptationContext(generated.candidates, canonicalCandidate.candidateId)
        if (!contextSaved.ok) {
          const rollbackComplete = restoreStorageValue(
            window.localStorage,
            activePlanBetaStorageKey(),
            previousActive,
          ) && contextSaved.rollbackComplete
          return {
            kind: "rejected",
            code: rollbackComplete
              ? "PLAN_STORAGE_WRITE_FAILED"
              : "PLAN_STORAGE_STATE_UNCERTAIN",
          } as const
        }
        return { kind: "saved", state } as const
      },
    )
  } catch {
    return { kind: "rejected", code: "MUTATION_LOCK_UNAVAILABLE" }
  }
}

function restoreStorageValue(storage: Storage, key: string, value: string | null): boolean {
  try {
    if (storage.getItem(key) === value) return true
    if (value === null) storage.removeItem(key)
    else storage.setItem(key, value)
    return storage.getItem(key) === value
  } catch {
    return false
  }
}
