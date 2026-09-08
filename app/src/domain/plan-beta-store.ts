import type {
  PlanContinuityInput,
  PlanProgressState,
} from "@impl/plan-generator/types"
import type { MethodHistoryEntry } from "@impl/prescription/method-recommendation"
import { summarizePlanMethodCoverage } from "./plan-method-coverage"
import { recordPlanProgress } from "@impl/plan-generator/generator"
import {
  parsePlanBetaState,
  planHistorySchema,
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
import {
  archivePlanOnServer,
  backupActivePlanToServer,
} from "./account/plan-cloud-backup"
import type {
  PlanBetaIntake,
  PlanBetaState,
  PlanBetaStateV2,
  PlanBetaStateV3,
  StoredPlanBetaIntake,
  StoredPlanHistory,
  StoredPlanProgress,
} from "./plan-beta-schema"
import {
  methodReferenceFromTemplate,
  recommendationHistoryFromStored,
  recommendationHistoryFromAdjusted,
} from "./plan-method-history"
import { readAdjustedOriginalPlans } from "./adjusted-plan-archive"
import { accountPlanService, accountPlansEnabled } from "./account/account-plan-service"
import { captureAccountPlanWrite } from "./account/account-plan-domain"
import { materializeAccountPlan } from "./account/account-plan-document-schema"
import { planHistorySnapshotContent } from "./plan-history-snapshot-content"
import { readStoredAdjustedPlanState, RETAINED_ADJUSTED_PLAN_EVIDENCE } from "./adjusted-plan-storage-schema"
import type { RetainedAdjustedPlanEvidence } from "./adjusted-plan-selection"
import { readStoredAdjustedPlanStateV5, RETAINED_ADJUSTED_PLAN_EVIDENCE_V3 } from "./adjusted-plan-storage-v5"
import type { RetainedAdjustedPlanEvidenceV3 } from "./selected-adjusted-plan-v3"
import { readStoredMultiAdjustedPlanV6, RETAINED_MULTI_ADJUSTED_EVIDENCE_V3 } from "./adjusted-plan-storage-v6"
import type { RetainedMultiAdjustedEvidenceV3 } from "./selected-multi-adjusted-plan-v3"
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

function isAdjustedStoredEnvelope(raw: string | null): boolean {
  if (raw === null) return false
  try { return [4, 5, 6].includes(JSON.parse(raw)?.version) } catch { return false }
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
  | (Omit<Extract<ReturnType<typeof readStoredAdjustedPlanState>, { kind: "loaded" }>, "kind"> & { readonly kind: "adjusted_loaded" })
  | (Omit<Extract<ReturnType<typeof readStoredAdjustedPlanStateV5>, { kind: "loaded" }>, "kind"> & { readonly kind: "adjusted_v3_loaded" })
  | (Omit<Extract<ReturnType<typeof readStoredMultiAdjustedPlanV6>, { kind: "loaded" }>, "kind"> & { readonly kind: "multi_adjusted_v3_loaded" })
  | { readonly kind: "missing" }
  | { readonly kind: "invalid" }
  | { readonly kind: "storage_error" }

export type PlanProgressStorageResult =
  | { readonly kind: "saved"; readonly state: PlanBetaStateV3 }
  | {
      readonly kind: "rejected"
      readonly code:
        | `ACCOUNT_PLAN_${string}`
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
        | `ACCOUNT_PLAN_${string}`
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

export function readPlanBetaStateFromStorage(
  retained: readonly RetainedAdjustedPlanEvidence[] = RETAINED_ADJUSTED_PLAN_EVIDENCE,
  retainedV3: readonly RetainedAdjustedPlanEvidenceV3[] = RETAINED_ADJUSTED_PLAN_EVIDENCE_V3,
  retainedMultiV3: readonly RetainedMultiAdjustedEvidenceV3[] = RETAINED_MULTI_ADJUSTED_EVIDENCE_V3,
): PlanBetaStateReadResult {
  if (accountPlansEnabled()) {
    const view = accountPlanService()?.snapshot(), selected = view?.currentPlan
    if (!view || !view.document) return { kind: "storage_error" }
    if (!selected) return { kind: "missing" }
    if (selected.kind !== "read_only") return { kind: "invalid" }
    const state = selected.packet.state
    if (state.version === 3) return { kind: "loaded", state }
    if (state.version === 4) {
      const read = readStoredAdjustedPlanState(state, retained)
      return read.kind === "loaded" ? { ...read, kind: "adjusted_loaded" } : { kind: "invalid" }
    }
    if (state.version === 5) {
      const read = readStoredAdjustedPlanStateV5(state, retainedV3)
      return read.kind === "loaded" ? { ...read, kind: "adjusted_v3_loaded" } : { kind: "invalid" }
    }
    const read = readStoredMultiAdjustedPlanV6(state, retainedMultiV3)
    return read.kind === "loaded" ? { ...read, kind: "multi_adjusted_v3_loaded" } : { kind: "invalid" }
  }
  return readPlanBetaStateForAccount(localAccountScopeSnapshot(), retained, retainedV3, retainedMultiV3)
}

export function readPlanBetaStateForAccount(
  accountScope: string | null,
  retained: readonly RetainedAdjustedPlanEvidence[] = RETAINED_ADJUSTED_PLAN_EVIDENCE,
  retainedV3: readonly RetainedAdjustedPlanEvidenceV3[] = RETAINED_ADJUSTED_PLAN_EVIDENCE_V3,
  retainedMultiV3: readonly RetainedMultiAdjustedEvidenceV3[] = RETAINED_MULTI_ADJUSTED_EVIDENCE_V3,
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
    if (json !== null && typeof json === "object" && "version" in json && json.version === 6) {
      const adjusted = readStoredMultiAdjustedPlanV6(json, retainedMultiV3)
      return adjusted.kind === "loaded" ? { ...adjusted, kind: "multi_adjusted_v3_loaded" } : { kind: "invalid" }
    }
    if (json !== null && typeof json === "object" && "version" in json && json.version === 5) {
      const adjusted = readStoredAdjustedPlanStateV5(json, retainedV3)
      return adjusted.kind === "loaded" ? { ...adjusted, kind: "adjusted_v3_loaded" } : { kind: "invalid" }
    }
    if (json !== null && typeof json === "object" && "version" in json && json.version === 4) {
      const adjusted = readStoredAdjustedPlanState(json, retained)
      return adjusted.kind === "loaded" ? { ...adjusted, kind: "adjusted_loaded" } : { kind: "invalid" }
    }
    const state = parsePlanBetaState(json)
    return state === null ? { kind: "invalid" } : { kind: "loaded", state }
  } catch {
    return { kind: "invalid" }
  }
}

export function savePlanBetaState(
  state: unknown,
): PlanStorageResult {
  if (accountPlansEnabled()) return { ok: false, code: "PLAN_STORAGE_WRITE_FAILED", rollbackComplete: true }
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
    // A stale legacy caller must not overwrite a newer adjusted-plan envelope.
    if (isAdjustedStoredEnvelope(previous)) {
      return { ok: false, code: "PLAN_STORAGE_WRITE_FAILED", rollbackComplete: true }
    }
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
  const accountWrite = captureAccountPlanWrite(activePlanBetaStorageKey())
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
        if (accountWrite) {
          const context = accountWrite.packet?.evidence === null ? accountWrite.packet.context : undefined
          const code = await accountWrite.save(next, [], undefined, context)
          return code ? { kind: "rejected", code } as const : { kind: "saved", state: next } as const
        }
        const saved = savePlanBetaState(next)
        if (saved.ok) void backupActivePlanToServer(next)
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
  if (accountPlansEnabled()) return { ok: false, code: "PLAN_ARCHIVE_WRITE_FAILED", rollbackComplete: true }
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
    if (isAdjustedStoredEnvelope(oldActive)) {
      return { ok: false, code: "PLAN_ARCHIVE_WRITE_FAILED", rollbackComplete: true }
    }
    snapshotsCaptured = true
    const previous = readPlanHistory()
    if (previous === null) throw new Error("Plan history is unavailable")
    const history = planHistorySchema.parse(planHistorySnapshotContent(state, new Date().toISOString(), "MANUAL"))
    const stagedHistory = JSON.stringify(planHistoryListSchema.parse([history, ...previous].slice(0, 18)))
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
    void archivePlanOnServer(state.activePlan.candidateId)
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
  const accountWrite = captureAccountPlanWrite(activePlanBetaStorageKey())
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
        if (accountWrite) {
          const code = await accountWrite.archive()
          return code ? { kind: "rejected", code } as const : { kind: "archived", intake: current.intake } as const
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
  if (accountPlansEnabled()) {
    const entries = accountPlanService()?.snapshot().confirmedDocument?.data.plans ?? []
    const last = entries.filter(p => p.archivedAt !== null).sort((a, b) => b.archivedAt!.localeCompare(a.archivedAt!))[0]
    return last ? last.snapshot.state.version === 3 ? last.snapshot.state.intake : last.snapshot.state.selection.intake : null
  }
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

export function loadPlanMethodHistory(eventDistanceM?: number): readonly MethodHistoryEntry[] {
  return loadPlanMethodHistorySnapshot(eventDistanceM).history
}

/** Scoped, read-only originals. Legacy summaries cannot reconstruct prescriptions. */
export function readArchivedOriginalPlans() {
  const rows = readPlanHistory()
  if (rows === null) return { kind: "unavailable" as const }
  return {
    kind: "loaded" as const,
    retainedPlans: rows.length,
    missingOriginals: rows.filter(row => !("originalPlan" in row)).length,
    plans: rows.flatMap(row => "originalPlan" in row ? [row.originalPlan] : []),
  }
}

export function loadPlanMethodHistorySnapshot(eventDistanceM?: number,
  retained: readonly RetainedAdjustedPlanEvidence[] = RETAINED_ADJUSTED_PLAN_EVIDENCE,
) {
  const loaded = readPlanHistory()
  const rows = loaded ?? []
  const history = Object.freeze(rows.flatMap(history => {
    if (eventDistanceM !== undefined && "eventDistanceM" in history && history.eventDistanceM !== eventDistanceM) return []
    if ("methodHistory" in history) return recommendationHistoryFromStored(history.methodHistory)
    if ("selectedDetailedTemplateRef" in history && history.selectedDetailedTemplateRef !== null) {
      return [Object.freeze({
        selected: methodReferenceFromTemplate(history.selectedDetailedTemplateRef),
        performed: Object.freeze({ status: "MISSING" as const }),
      })]
    }
    return []
  }))
  const archive = readAdjustedOriginalPlans(retained)
  const active = archive.kind === "loaded" && archive.entries.length > 0 ? readPlanBetaStateFromStorage(retained) : null
  const unreadableActive = active?.kind === "invalid" || active?.kind === "storage_error"
  const activeId = active?.kind === "adjusted_loaded" ? active.state.selection.activePlan.candidateId
    : active?.kind === "loaded" ? active.state.activePlan.candidateId : null
  // Retaining an active original is not yet a completed past frame. Do not count
  // its older progress snapshot, or a duplicate legacy row, as another exposure.
  const legacyIds = new Set(rows.map(row => row.candidateId))
  const adjusted = archive.kind === "loaded" && !unreadableActive
    ? archive.entries.filter(row => row.state.selection.activePlan.candidateId !== activeId
      && !legacyIds.has(row.state.selection.activePlan.candidateId)) : []
  const matching = adjusted.filter(row => eventDistanceM === undefined
    || row.state.selection.activePlan.eventDistanceM === eventDistanceM)
  const adjustedHistory = matching.flatMap(row => recommendationHistoryFromAdjusted(row.state))
  const baseCoverage = summarizePlanMethodCoverage(rows, eventDistanceM)
  const dates = [baseCoverage.earliestArchive, baseCoverage.latestArchive,
    ...matching.map(row => row.archivedAt)].filter((date): date is string => date !== null).sort()
  const coverage = loaded === null || archive.kind !== "loaded" || unreadableActive ? null : Object.freeze({
    ...baseCoverage, retainedPlans: baseCoverage.retainedPlans + adjusted.length,
    matchingPlans: baseCoverage.matchingPlans + matching.length,
    missingOutcomes: baseCoverage.missingOutcomes + matching.reduce((count, row) => count
      + row.state.selection.activePlan.sessions.filter(session =>
        (session.prescription.kind === "PACE_TARGET" || session.prescription.kind === "ADJUSTED_METHOD")
        && !row.state.progress.some(item => item.sessionDay === session.day && item.sessionSlot === session.slot)).length, 0),
    unmappedReferences: baseCoverage.unmappedReferences + matching.reduce((count, row) => count
      + row.state.selection.activePlan.sessions.filter(session => session.prescription.kind === "PACE_TARGET"
        && methodReferenceFromTemplate({ templateId: session.prescription.templateId,
          version: session.prescription.templateVersion, fingerprint: session.prescription.templateContentFingerprint }) === null).length, 0),
    earliestArchive: dates[0] ?? null, latestArchive: dates.at(-1) ?? null,
  })
  return Object.freeze({ history: Object.freeze([...history, ...adjustedHistory]), coverage })
}

function loadPlanHistory(): readonly StoredPlanHistory[] {
  return readPlanHistory() ?? []
}

function readPlanHistory(): readonly StoredPlanHistory[] | null {
  if (accountPlansEnabled()) {
    const document = accountPlanService()?.snapshot().confirmedDocument
    if (!document) return null
    return document.data.plans.flatMap(entry => {
      const packet = materializeAccountPlan(entry)
      return entry.archivedAt && packet.state.version === 3
        ? [planHistorySchema.parse(planHistorySnapshotContent(packet.state, entry.archivedAt, "MANUAL"))] : []
    })
  }
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(accountScopedStorageKey(HISTORY_KEY))
    if (raw === null) return []
    const json: unknown = JSON.parse(raw)
    const parsed = planHistoryListSchema.safeParse(json)
    return parsed.success ? parsed.data : null
  } catch {
    return null
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
