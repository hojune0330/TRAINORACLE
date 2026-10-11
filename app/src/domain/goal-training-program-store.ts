import { parseStoredGoalTrainingProgram as parseDocument, parseGoalTrainingProgramHistory as parseProgramHistory,
  projectStoredGoalTrainingProgram as projectDocument, resolveGoalTrainingProgramLineage as resolveLineage,
  type StoredGoalTrainingProgram, type GoalTrainingProgramHistory, type GoalTrainingProgramCycleRecord, type GoalTrainingProgramCycle,
} from "./goal-training-program-document"
export type { StoredGoalTrainingProgram, GoalTrainingProgramHistory, GoalTrainingProgramCycleRecord } from "./goal-training-program-document"
import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { validateGoalTrainingProgram, type GoalTrainingProgram } from "./goal-training-program"
import { hasCanonicalJsonTree, planBetaStateV3Schema, planHistoryListSchema, planHistorySchema, type PlanBetaStateV3 } from "./plan-beta-schema"
import { activePlanBetaStorageKey, readPlanBetaStateFromStorage } from "./plan-beta-store"
import { planHistorySnapshotContent } from "./plan-history-snapshot-content"
import { evaluatePlanSafety, type PlanCurrentCheck } from "./plan-beta-flow"
import { getPlanMutationLockManager, PLAN_BETA_MUTATION_LOCK_NAME } from "./plan-mutation-lock"
import { accountPlansEnabled, accountPlanService, ACCOUNT_PLAN_EVENT } from "./account/account-plan-service"
import { createAccountGoalProgramService, accountGoalProgramEditToken, type AccountGoalProgramStatus, type AccountGoalProgramSnapshot } from "./account/account-goal-program-service"
import { captureAccountPlanWrite, ensureAccountPlanHistory } from "./account/account-plan-domain"
import { materializeAccountPlan } from "./account/account-plan-document-schema"
import { accountScopedStorageKey, localAccountScopeSnapshot, localAccountScopeIsCurrent } from "./account/local-account-scope"
import { localJournalScopeGeneration, onLocalJournalScopeChange } from "./account/local-journal-ownership"
import { accountDeletionBoundaryState } from "./account/account-deletion-boundary"
import { todayISO } from "./journal-store"

export const GOAL_TRAINING_PROGRAM_STORAGE_KEY = "trainoracle.goal-training-program.v1"
export const GOAL_TRAINING_PROGRAM_HISTORY_STORAGE_KEY = "trainoracle.goal-training-program.history.v1"
export const GOAL_TRAINING_PROGRAM_EVENT = "trainoracle:goal-training-program-changed"
export const GOAL_TRAINING_PROGRAM_BACKUP_FORMAT = "trainoracle.goal-training-program.personal-backup.v1"
const HISTORY_KEY = "trainoracle.plan-beta.history.v1"
const MAX_DOCUMENT_BYTES = 10_000_000
const MAX_PROGRAM_HISTORY = 18
const fingerprint = (value: unknown) => canonicalJsonFingerprint("trainoracle.goal-training-program-store.v1", value)
type Cycle = GoalTrainingProgramCycle

export type GoalTrainingProgramCycleStatus = "NOT_STARTED" | "CURRENT" | "ENDED" | "PAUSED" | "DETACHED" | "UNAVAILABLE"
export type GoalTrainingProgramReadResult =
  | { kind: "loaded"; document: StoredGoalTrainingProgram; currentPlan: PlanBetaStateV3 | null; currentCycleStatus: GoalTrainingProgramCycleStatus }
  | { kind: "missing" | "invalid" | "storage_error" | "account_unsupported" }
export type GoalTrainingProgramWriteFailure =
  | { kind: "rejected"; code: string }
  | { kind: "failed"; code: "PROGRAM_STORAGE_WRITE_FAILED"; rollbackComplete: boolean }
export type GoalTrainingProgramSaveOptions = {
  expectedRevision: number | null
  currentCheck: PlanCurrentCheck
  freshPreview?: () => boolean
  /** An explicit owner-reviewed whole-program replacement; never an implicit overwrite. */
  replaceExisting?: boolean
  replaceExpiredPending?: true
  expectedPendingReview?: AccountGoalProgramSnapshot
}
export type GoalTrainingProgramApplyInput = {
  programId: string
  expectedRevision: number
  cycle: Cycle
  confirmsNoKnownRisk: boolean
  freshReview?: () => boolean
}
export type GoalTrainingProgramRestoreOptions = {
  expectedRevision: number | null
  confirmsOwnFile: boolean
  isCurrentRequest?: () => boolean
}
const rejected = (code: string): GoalTrainingProgramWriteFailure => ({ kind: "rejected", code })

let accountService: ReturnType<typeof createAccountGoalProgramService> | null = null
let accountOwner: string | null = null, accountGeneration = -1
function monthlyAccountService() {
  const owner = localAccountScopeSnapshot(), generation = localJournalScopeGeneration()
  if (!accountPlansEnabled() || !owner || accountOwner !== owner || accountGeneration !== generation) {
    accountService?.close(); accountService = null; accountOwner = null
  }
  if (!accountPlansEnabled() || !owner) return null
  if (!accountService) {
    try {
      accountOwner = owner; accountGeneration = generation
      accountService = createAccountGoalProgramService(owner, notifyProgramChanged)
    } catch { accountService = null }
  }
  return accountService
}
export function goalTrainingProgramStorageStatus(): "DEVICE" | AccountGoalProgramStatus {
  return accountPlansEnabled() ? monthlyAccountService()?.snapshot().status ?? "UNSUPPORTED" : "DEVICE"
}
export function goalTrainingProgramAccountSnapshot(): AccountGoalProgramSnapshot | null {
  return accountPlansEnabled() ? monthlyAccountService()?.snapshot() ?? null : null
}
/** A reviewed remote choice changes only the monthly collection, never an active plan. */
export async function acceptRemoteGoalTrainingProgram(review: AccountGoalProgramSnapshot): Promise<boolean> {
  const service = monthlyAccountService()
  if (!accountPlansEnabled() || !service) return false
  return await service.acceptRemote(structuredClone(review)) && monthlyAccountService() === service
}
export async function exportGoalTrainingProgramConflictJSON(review: AccountGoalProgramSnapshot): Promise<string> {
  const service = monthlyAccountService()
  if (!accountPlansEnabled() || !service) throw Error("GOAL_PROGRAM_BACKUP_NOT_READY")
  const pending = await service.pendingBackup(structuredClone(review))
  if (!pending?.document || monthlyAccountService() !== service) throw Error("GOAL_PROGRAM_BACKUP_STATE_CHANGED")
  const content = { app: "TRAINORACLE", format: GOAL_TRAINING_PROGRAM_BACKUP_FORMAT, exportedAt: new Date().toISOString(),
    document: pending.document, history: pending.history }
  const raw = JSON.stringify({ ...content, contentFingerprint: fingerprint(content) }, null, 2)
  if (new TextEncoder().encode(raw).byteLength > MAX_DOCUMENT_BYTES || monthlyAccountService() !== service) throw Error("GOAL_PROGRAM_BACKUP_NOT_READY")
  return raw
}
export async function refreshGoalTrainingProgram(): Promise<boolean> {
  if (!accountPlansEnabled()) return true
  const service = monthlyAccountService()
  if (!service) return false
  const loaded = await service.hydrate()
  if (monthlyAccountService() !== service) return false
  if (!loaded) return false
  return await ensureAccountPlanHistory() && monthlyAccountService() === service
}
function accountProgramFailure() {
  const status = goalTrainingProgramStorageStatus()
  return rejected(status === "UNSUPPORTED" ? "ACCOUNT_STORAGE_UNSUPPORTED"
    : status === "READY" || status === "EMPTY" ? "ACCOUNT_PROGRAM_STATE_CHANGED" : `ACCOUNT_PROGRAM_${status}`)
}
async function readyAccountProgram(allowExpiredPending = false) {
  const service = monthlyAccountService()
  if (!service) return null
  const loaded = await service.loadHistory(), view = service.snapshot()
  const expiredPending = allowExpiredPending && view.status === "PENDING" && view.goalStartDateReviewRequired === true
    && view.pendingDocument !== null && view.pendingDocument.program.window.startDate < todayISO()
  if ((!loaded && !expiredPending) || monthlyAccountService() !== service || !await ensureAccountPlanHistory()) return null
  return (["READY", "EMPTY"].includes(view.status) || expiredPending) && monthlyAccountService() === service ? service : null
}
async function lockedAccountProgram<T>(service: NonNullable<ReturnType<typeof monthlyAccountService>>, run: (current: () => boolean) => Promise<T>): Promise<T | GoalTrainingProgramWriteFailure> {
  const owner = localAccountScopeSnapshot(), generation = localJournalScopeGeneration(), locks = getPlanMutationLockManager()
  const current = () => monthlyAccountService() === service && accountPlansEnabled() && localAccountScopeIsCurrent(owner)
    && localJournalScopeGeneration() === generation && owner !== null && accountDeletionBoundaryState(owner) === "OPEN"
  if (!locks) return rejected("MUTATION_LOCK_UNAVAILABLE")
  try {
    return await locks.request(PLAN_BETA_MUTATION_LOCK_NAME, { mode: "exclusive", ifAvailable: true }, async lock =>
      lock === null ? rejected("MUTATION_LOCK_UNAVAILABLE") : !current() ? rejected("ACCOUNT_OR_STATE_CHANGED") : run(current))
  } catch { return rejected("PROGRAM_STORAGE_UNAVAILABLE") }
}
async function persistAccountProgram(service: NonNullable<ReturnType<typeof monthlyAccountService>>, document: StoredGoalTrainingProgram,
  history: GoalTrainingProgramHistory, token: string, fresh: () => boolean, goalStartDateReviewRequired?: true, replaceExpiredPending?: true) {
  if (!parseDocument(document) || !fresh()) return false
  return await service.save(document, history, token, fresh, { goalStartDateReviewRequired, replaceExpiredPending }) && monthlyAccountService() === service && fresh()
}
function expiredPendingReviewIdentity(view?: AccountGoalProgramSnapshot) {
  return view?.status === "PENDING" && view.goalStartDateReviewRequired === true
    && view.pendingDocument !== null && view.pendingDocument.program.window.startDate < todayISO()
    ? fingerprint([view.ownerId, view.sessionGeneration, view.revision, view.sequence, view.document, view.pendingDocument,
      view.goalStartDateReviewRequired]) : null
}
async function saveAccountGoalProgram(program: GoalTrainingProgram, options: GoalTrainingProgramSaveOptions) {
  if (validateGoalTrainingProgram(program).kind !== "valid") return rejected("INVALID_PROGRAM")
  const pendingReview = options.replaceExpiredPending ? expiredPendingReviewIdentity(options.expectedPendingReview) : null
  if (options.replaceExpiredPending && pendingReview === null) return rejected("ACCOUNT_PROGRAM_STATE_CHANGED")
  const request = fingerprint([program, options.expectedRevision, options.currentCheck, options.replaceExisting === true, options.replaceExpiredPending === true, pendingReview])
  const service = await readyAccountProgram(options.replaceExpiredPending === true)
  if (!service) return accountProgramFailure()
  return lockedAccountProgram(service, async current => {
    const fresh = () => current() && options.freshPreview?.() !== false && evaluatePlanSafety(options.currentCheck).kind === "passed"
      && fingerprint([program, options.expectedRevision, options.currentCheck, options.replaceExisting === true, options.replaceExpiredPending === true,
        options.replaceExpiredPending ? expiredPendingReviewIdentity(options.expectedPendingReview) : null]) === request
    if (!fresh()) return rejected("SAFETY_OR_PREVIEW_CHANGED")
    const opening = service.snapshot(), token = accountGoalProgramEditToken(opening)
    if (options.replaceExpiredPending && expiredPendingReviewIdentity(opening) !== pendingReview) return rejected("ACCOUNT_PROGRAM_STATE_CHANGED")
    const read = options.replaceExpiredPending === true && opening.status === "PENDING"
      && opening.goalStartDateReviewRequired === true && opening.document === null
      ? { kind: "missing" as const } : storedDocument()
    if (!compareRevision(read, options.expectedRevision)) return rejected("STALE_PROGRAM_REVISION")
    const history = structuredClone(opening.history), at = new Date().toISOString()
    if (read.kind === "loaded") {
      const previous = reconcile(read.document)
      if (fingerprint(read.document.program) === fingerprint(program)) {
        if (options.replaceExpiredPending) return rejected("ACCOUNT_PROGRAM_PENDING")
        return { kind: "saved" as const, document: previous.document }
      }
      // Reject an expired replacement before ending the currently selected plan.
      if (program.window.startDate < todayISO()) return rejected("START_DATE_ELAPSED")
      if (!options.replaceExisting) return rejected("EXISTING_PROGRAM_REQUIRES_REVIEW")
      if (history.entries.length >= MAX_PROGRAM_HISTORY) return rejected("PROGRAM_HISTORY_CAPACITY_REACHED")
      if (["DETACHED", "UNAVAILABLE"].includes(previous.currentCycleStatus)) return rejected("EXISTING_ACTIVE_PLAN_REQUIRES_REVIEW")
      if (previous.currentPlan?.progress.some(row => row.state === "PAIN_CHECKIN")) return rejected("SAFETY_REVIEW_REQUIRED")
      const active = readPlanBetaStateFromStorage()
      if (active.kind !== "missing" && previous.currentCycleStatus !== "CURRENT") return rejected("EXISTING_ACTIVE_PLAN_REQUIRES_ARCHIVE")
      if (previous.currentCycleStatus === "CURRENT") {
        const writer = captureAccountPlanWrite(activePlanBetaStorageKey())
        const code = await writer?.archive(() => fresh() && program.window.startDate >= todayISO())
        if (!writer || code || !fresh()) return rejected(code ?? "ACCOUNT_OR_STATE_CHANGED")
      }
      const archived = structuredClone(previous.document)
      if (archived.application) archived.cycles[archived.application.currentCycleIndex - 1]!.status = "ENDED"
      history.entries.unshift({ archivedAt: at, document: archived })
    }
    if (program.window.startDate < todayISO()) return rejected("START_DATE_ELAPSED")
    const pending = (cycle: Cycle): GoalTrainingProgramCycleRecord => ({ cycle, status: "PENDING", latestPlan: null, lineage: [] })
    const document: StoredGoalTrainingProgram = { version: 1, revision: read.kind === "loaded" ? read.document.revision + 1 : 0,
      program: structuredClone(program), application: null, cycles: [pending(1), pending(2), pending(3)] }
    return await persistAccountProgram(service, document, history, token, () => fresh() && program.window.startDate >= todayISO(), true, options.replaceExpiredPending)
      ? { kind: "saved" as const, document } : accountProgramFailure()
  })
}
async function applyAccountGoalCycle(input: GoalTrainingProgramApplyInput) {
  if (!input.confirmsNoKnownRisk) return rejected("CURRENT_BODY_CONFIRMATION_REQUIRED")
  const request = fingerprint([input.programId, input.expectedRevision, input.cycle, input.confirmsNoKnownRisk])
  const service = await readyAccountProgram()
  if (!service) return accountProgramFailure()
  return lockedAccountProgram(service, async current => {
    const read = storedDocument()
    if (read.kind !== "loaded" || read.document.program.programId !== input.programId || !compareRevision(read, input.expectedRevision)) return rejected("STALE_PROGRAM_REVISION")
    const opening = service.snapshot(), token = accountGoalProgramEditToken(opening), view = reconcile(read.document), document = structuredClone(view.document)
    const previous = document.application?.currentCycleIndex
    if (previous === undefined ? input.cycle !== 1 : input.cycle !== previous && input.cycle !== previous + 1) return rejected("INVALID_CYCLE_TRANSITION")
    const target = document.program.frames[input.cycle - 1]!, lastDate = document.program.window.halfDays[target.halfDayOffset + 18]!.date
    const state = input.cycle === previous ? document.cycles[input.cycle - 1]!.latestPlan : target.plan
    if (!state || !planBetaStateV3Schema.safeParse(state).success || state.progress.some(row => row.state === "PAIN_CHECKIN")) return rejected("INVALID_CYCLE_PLAN")
    const active = readPlanBetaStateFromStorage()
    const alreadySelected = active.kind === "loaded" && fingerprint(active.state) === fingerprint(state)
    // PLAN and monthly INDEX have independent receipts. Recover only the exact
    // requested successor after its predecessor was already explicitly ended.
    const recoverSelectedSuccessor = view.currentCycleStatus === "DETACHED" && previous !== undefined
      && input.cycle === previous + 1 && document.cycles[previous - 1]!.status === "ENDED" && alreadySelected
    if (["UNAVAILABLE", "DETACHED"].includes(view.currentCycleStatus) && !recoverSelectedSuccessor) return rejected("EXISTING_ACTIVE_PLAN_REQUIRES_REVIEW")
    if (input.cycle === previous && view.currentCycleStatus === "ENDED") return rejected("ENDED_CYCLE_CANNOT_RESTART")
    if (previous !== undefined && input.cycle !== previous && view.currentCycleStatus !== "ENDED" && !recoverSelectedSuccessor) return rejected("CURRENT_CYCLE_REQUIRES_ARCHIVE")
    const fresh = () => current() && input.freshReview?.() !== false && input.confirmsNoKnownRisk
      && fingerprint([input.programId, input.expectedRevision, input.cycle, input.confirmsNoKnownRisk]) === request
      && evaluatePlanSafety("NO_KNOWN_RISK").kind === "passed" && todayISO() <= lastDate
      && (previous !== undefined || document.program.window.startDate >= todayISO())
      && !view.currentPlan?.progress.some(row => row.state === "PAIN_CHECKIN") && validateGoalTrainingProgram(document.program).kind === "valid"
    if (!fresh()) return rejected("SAFETY_OR_PREVIEW_CHANGED")
    if (active.kind !== "missing" && !alreadySelected) return rejected("EXISTING_ACTIVE_PLAN_REQUIRES_ARCHIVE")
    if (input.cycle === previous && view.currentCycleStatus === "CURRENT") return { kind: "applied" as const, document, state }
    if (!alreadySelected) {
      const writer = captureAccountPlanWrite(activePlanBetaStorageKey())
      const code = await writer?.save(state, [], fresh)
      if (!writer || code || !fresh()) return rejected(code ?? "ACCOUNT_OR_STATE_CHANGED")
    }
    document.revision += 1
    document.application = { appliedAt: document.application?.appliedAt ?? new Date().toISOString(), currentCycleIndex: input.cycle }
    document.cycles[input.cycle - 1] = { ...document.cycles[input.cycle - 1]!, status: "CURRENT", latestPlan: state }
    return await persistAccountProgram(service, document, opening.history, token, fresh)
      ? { kind: "applied" as const, document, state } : accountProgramFailure()
  })
}
async function archiveAccountGoalCycle(input: { programId: string; expectedRevision: number }) {
  const service = await readyAccountProgram()
  if (!service) return accountProgramFailure()
  return lockedAccountProgram(service, async current => {
    const read = storedDocument()
    if (read.kind !== "loaded" || read.document.program.programId !== input.programId || !compareRevision(read, input.expectedRevision)) return rejected("STALE_PROGRAM_REVISION")
    const view = reconcile(read.document), opening = service.snapshot(), token = accountGoalProgramEditToken(opening)
    if (!view.document.application || !view.currentPlan || !["CURRENT", "ENDED", "PAUSED"].includes(view.currentCycleStatus)) return rejected("CURRENT_CYCLE_UNAVAILABLE")
    if (view.currentCycleStatus === "CURRENT") {
      const writer = captureAccountPlanWrite(activePlanBetaStorageKey()), code = await writer?.archive()
      if (!writer || code || !current()) return rejected(code ?? "ACCOUNT_OR_STATE_CHANGED")
    }
    const document = structuredClone(view.document)
    document.cycles[document.application!.currentCycleIndex - 1]!.status = "ENDED"; document.revision += 1
    return await persistAccountProgram(service, document, opening.history, token, current)
      ? { kind: "archived" as const, document } : accountProgramFailure()
  })
}
async function restoreAccountGoalProgram(raw: string, options: GoalTrainingProgramRestoreOptions) {
  if (!monthlyAccountService()) return accountProgramFailure()
  if (!options.confirmsOwnFile) return rejected("OWN_FILE_CONFIRMATION_REQUIRED")
  try {
    if (new TextEncoder().encode(raw).byteLength > MAX_DOCUMENT_BYTES || options.isCurrentRequest?.() === false) return rejected("STALE_OR_INVALID_BACKUP")
    const value = JSON.parse(raw), document = parseDocument(value.document), history = parseProgramHistory(value.history)
    const content = { app: value.app, format: value.format, exportedAt: value.exportedAt, document: value.document, history: value.history }
    if (!hasCanonicalJsonTree(value) || Reflect.ownKeys(value).length !== 6 || value.app !== "TRAINORACLE"
      || value.format !== GOAL_TRAINING_PROGRAM_BACKUP_FORMAT || !document || !history
      || new Date(value.exportedAt).toISOString() !== value.exportedAt || Date.parse(value.exportedAt) > Date.now()
      || value.contentFingerprint !== fingerprint(content)) return rejected("INVALID_PROGRAM_BACKUP")
    const service = await readyAccountProgram()
    if (!service) return accountProgramFailure()
    return lockedAccountProgram(service, async current => {
      const opening = service.snapshot(), read = storedDocument(), token = accountGoalProgramEditToken(opening)
      if (!compareRevision(read, options.expectedRevision)) return rejected("STALE_PROGRAM_REVISION")
      if (read.kind === "loaded" && fingerprint(reconcile(read.document).document) !== fingerprint(document)) return rejected("EXISTING_PROGRAM_REQUIRES_REVIEW")
      const merged = structuredClone(opening.history)
      for (const entry of history.entries) if (!merged.entries.some(old => fingerprint(old.document) === fingerprint(entry.document))) merged.entries.push(entry)
      if (merged.entries.length > MAX_PROGRAM_HISTORY) return rejected("PROGRAM_HISTORY_CAPACITY_REACHED")
      const restored = read.kind === "missing" ? { ...document, revision: document.revision + 1 }
        : read.kind === "loaded" && fingerprint(read.document) !== fingerprint(document) ? { ...document, revision: read.document.revision + 1 } : document
      const fresh = () => current() && options.confirmsOwnFile && options.isCurrentRequest?.() !== false
      return await persistAccountProgram(service, restored, merged, token, fresh)
        ? { kind: "restored" as const, document: restored, activePlanChanged: false as const } : accountProgramFailure()
    })
  } catch { return rejected("INVALID_PROGRAM_BACKUP") }
}

function readProgramHistory(): { raw: string | null; history: GoalTrainingProgramHistory } | null {
  if (accountPlansEnabled()) {
    const view = monthlyAccountService()?.snapshot()
    return view?.historyLoaded && ["READY", "EMPTY"].includes(view.status) ? { raw: JSON.stringify(view.history), history: view.history } : null
  }
  try {
    const raw = localStorage.getItem(accountScopedStorageKey(GOAL_TRAINING_PROGRAM_HISTORY_STORAGE_KEY))
    if (raw !== null && new TextEncoder().encode(raw).byteLength > MAX_DOCUMENT_BYTES) return null
    const history = raw === null ? { version: 1 as const, entries: [] } : parseProgramHistory(JSON.parse(raw))
    return history ? { raw, history } : null
  } catch { return null }
}

export function activeGoalTrainingProgramStorageKey(): string {
  return accountScopedStorageKey(GOAL_TRAINING_PROGRAM_STORAGE_KEY)
}

function storedDocument(): { kind: "loaded"; document: StoredGoalTrainingProgram; raw: string }
  | { kind: "missing" | "invalid" | "storage_error" | "account_unsupported" } {
  if (accountPlansEnabled()) {
    const view = monthlyAccountService()?.snapshot()
    if (view?.status === "EMPTY") return { kind: "missing" }
    return view?.document && ["READY", "PENDING"].includes(view.status)
      ? { kind: "loaded", document: view.document, raw: JSON.stringify(view.document) } : { kind: "account_unsupported" }
  }
  try {
    const raw = localStorage.getItem(activeGoalTrainingProgramStorageKey())
    if (raw === null) return { kind: "missing" }
    let value: unknown
    try { value = JSON.parse(raw) } catch { return { kind: "invalid" } }
    const document = parseDocument(value)
    return document ? { kind: "loaded", document, raw } : { kind: "invalid" }
  } catch { return { kind: "storage_error" } }
}

function readArchive(): { states: PlanBetaStateV3[]; raw: string | null } | null {
  if (accountPlansEnabled()) {
    const view = accountPlanService()?.snapshot(), document = view?.confirmedDocument
    if (!document || "historyLoaded" in view && !view.historyLoaded) return null
    const states = document.data.plans.filter(row => row.archivedAt !== null).map(materializeAccountPlan)
      .flatMap(packet => packet.state.version === 3 ? [packet.state] : [])
    return { states, raw: JSON.stringify(states) }
  }
  try {
    const raw = localStorage.getItem(accountScopedStorageKey(HISTORY_KEY))
    const parsed = planHistoryListSchema.safeParse(JSON.parse(raw ?? "[]"))
    return parsed.success ? { raw, states: parsed.data.flatMap(row => "originalPlan" in row ? [row.originalPlan] : []) } : null
  } catch { return null }
}

/** Observe accepted edits/progress, without upgrading or writing any original on read. */
function reconcile(document: StoredGoalTrainingProgram): Extract<GoalTrainingProgramReadResult, { kind: "loaded" }> {
  if (!document.application) return { kind: "loaded", document, currentPlan: null, currentCycleStatus: "NOT_STARTED" }
  const cycleIndex = document.application.currentCycleIndex - 1, cycle = document.cycles[cycleIndex]!
  const original = document.program.frames[cycleIndex]!.plan
  const active = readPlanBetaStateFromStorage()
  const archive = readArchive()
  if (!archive || active.kind === "invalid" || active.kind === "storage_error") {
    return { kind: "loaded", document, currentPlan: cycle.latestPlan, currentCycleStatus: "UNAVAILABLE" }
  }
  const retained = [...cycle.lineage, ...(cycle.latestPlan ? [cycle.latestPlan] : []), ...archive.states]
  if (active.kind === "loaded" && active.state.version === 3) {
    const lineage = resolveLineage(active.state, original, retained)
    if (lineage !== null && cycle.status === "CURRENT") {
      const next = structuredClone(document)
      next.cycles[cycleIndex] = { ...cycle, latestPlan: active.state, lineage }
      return { kind: "loaded", document: next, currentPlan: active.state,
        currentCycleStatus: projectDocument(next).kind === "ready" ? "CURRENT" : "UNAVAILABLE" }
    }
  }
  if (active.kind !== "missing") return { kind: "loaded", document, currentPlan: cycle.latestPlan, currentCycleStatus: "DETACHED" }
  if (cycle.status === "ENDED") return { kind: "loaded", document, currentPlan: cycle.latestPlan, currentCycleStatus: "ENDED" }
  for (const archived of archive.states) {
    const lineage = resolveLineage(archived, original, retained)
    if (lineage === null || !cycle.latestPlan || archived.activePlan.candidateId !== cycle.latestPlan.activePlan.candidateId
      && !lineage.some(state => state.activePlan.candidateId === cycle.latestPlan!.activePlan.candidateId)) continue
    const next = structuredClone(document)
    next.cycles[cycleIndex] = { ...cycle, status: "ENDED", latestPlan: archived, lineage }
    return { kind: "loaded", document: next, currentPlan: archived,
      currentCycleStatus: projectDocument(next).kind === "ready" ? "ENDED" : "UNAVAILABLE" }
  }
  return { kind: "loaded", document, currentPlan: cycle.latestPlan, currentCycleStatus: "PAUSED" }
}

export function readGoalTrainingProgram(): GoalTrainingProgramReadResult {
  const read = storedDocument()
  return read.kind === "loaded" ? reconcile(read.document) : read
}

function notifyProgramChanged(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(GOAL_TRAINING_PROGRAM_EVENT))
}
export function subscribeGoalTrainingProgramChanges(listener: () => void): () => void {
  const observed = () => { notifyProgramChanged() }
  const storage = (event: StorageEvent) => {
    if (event.key == null || [activeGoalTrainingProgramStorageKey(), activePlanBetaStorageKey(), accountScopedStorageKey(HISTORY_KEY),
      accountScopedStorageKey(GOAL_TRAINING_PROGRAM_HISTORY_STORAGE_KEY)].includes(event.key)) observed()
  }
  const offScope = onLocalJournalScopeChange(() => { accountService?.close(); accountService = null; accountOwner = null; observed() })
  window.addEventListener(GOAL_TRAINING_PROGRAM_EVENT, listener)
  window.addEventListener(ACCOUNT_PLAN_EVENT, observed)
  window.addEventListener("storage", storage)
  return () => { offScope(); window.removeEventListener(GOAL_TRAINING_PROGRAM_EVENT, listener)
    window.removeEventListener(ACCOUNT_PLAN_EVENT, observed); window.removeEventListener("storage", storage) }
}

type StorageChange = { storage: Storage; key: string; previous: string | null; next: string | null; written?: boolean }
/** Local multi-key commit with readback and ownership-aware rollback, not a server transaction. */
function commit(changes: StorageChange[], current: () => boolean): { ok: true } | { ok: false; rollbackComplete: boolean } {
  const unchanged = () => current() && changes.every(change => change.storage.getItem(change.key) === (change.written ? change.next : change.previous))
  try {
    for (const change of changes) {
      if (!unchanged()) throw Error("State changed")
      change.written = true
      if (change.next === null) change.storage.removeItem(change.key)
      else change.storage.setItem(change.key, change.next)
      if (!unchanged()) throw Error("Write not confirmed")
    }
    return { ok: true }
  } catch {
    let rollbackComplete = true
    for (const change of [...changes].reverse()) {
      if (!change.written) continue
      try {
        const raw = change.storage.getItem(change.key)
        if (raw === change.next) {
          if (change.previous === null) change.storage.removeItem(change.key)
          else change.storage.setItem(change.key, change.previous)
        }
        if (change.storage.getItem(change.key) !== change.previous) rollbackComplete = false
      } catch { rollbackComplete = false }
    }
    return { ok: false, rollbackComplete }
  }
}

function captureScope() {
  const scope = localAccountScopeSnapshot(), generation = localJournalScopeGeneration()
  return { scope, current: () => !accountPlansEnabled() && localAccountScopeIsCurrent(scope)
    && localJournalScopeGeneration() === generation
    && (scope === null || accountDeletionBoundaryState(scope) === "OPEN") }
}
async function locked<T>(run: () => T, scope: ReturnType<typeof captureScope>): Promise<T | GoalTrainingProgramWriteFailure> {
  const locks = getPlanMutationLockManager()
  if (!locks) return rejected("MUTATION_LOCK_UNAVAILABLE")
  try {
    return await locks.request(PLAN_BETA_MUTATION_LOCK_NAME, { mode: "exclusive", ifAvailable: true }, lock =>
      !lock ? rejected("MUTATION_LOCK_UNAVAILABLE") : !scope.current() ? rejected("ACCOUNT_OR_STATE_CHANGED") : run())
  } catch { return rejected("PROGRAM_STORAGE_UNAVAILABLE") }
}
function compareRevision(read: ReturnType<typeof storedDocument>, expected: number | null) {
  return read.kind === "missing" ? expected === null : read.kind === "loaded" && read.document.revision === expected
}
function failed(result: { rollbackComplete: boolean }): GoalTrainingProgramWriteFailure {
  return { kind: "failed", code: "PROGRAM_STORAGE_WRITE_FAILED", rollbackComplete: result.rollbackComplete }
}

export async function saveGoalTrainingProgram(program: GoalTrainingProgram, options: GoalTrainingProgramSaveOptions): Promise<
  { kind: "saved"; document: StoredGoalTrainingProgram } | GoalTrainingProgramWriteFailure> {
  if (accountPlansEnabled()) return saveAccountGoalProgram(program, options)
  if (validateGoalTrainingProgram(program).kind !== "valid") return rejected("INVALID_PROGRAM")
  const optionsFingerprint = () => fingerprint({ expectedRevision: options.expectedRevision, currentCheck: options.currentCheck,
    replaceExisting: options.replaceExisting === true })
  const scope = captureScope(), request = fingerprint(program), optionsRequest = optionsFingerprint()
  return locked(() => {
    if (options.freshPreview?.() === false || fingerprint(program) !== request || optionsFingerprint() !== optionsRequest) return rejected("STALE_PREVIEW")
    const valid = validateGoalTrainingProgram(program)
    if (valid.kind !== "valid") return rejected("INVALID_PROGRAM")
    const read = storedDocument()
    if (!compareRevision(read, options.expectedRevision)) return rejected("STALE_PROGRAM_REVISION")
    if (evaluatePlanSafety(options.currentCheck).kind !== "passed") return rejected("SAFETY_REVIEW_REQUIRED")
    const changes: StorageChange[] = [], at = new Date().toISOString()
    if (read.kind === "loaded") {
      if (fingerprint(read.document.program) === fingerprint(valid.program)) return { kind: "saved", document: reconcile(read.document).document }
      if (!options.replaceExisting) return rejected("EXISTING_PROGRAM_REQUIRES_REVIEW")
      const previous = reconcile(read.document), history = readProgramHistory()
      if (!history) return rejected("PROGRAM_HISTORY_UNAVAILABLE")
      if (history.history.entries.length >= MAX_PROGRAM_HISTORY) return rejected("PROGRAM_HISTORY_CAPACITY_REACHED")
      if (["DETACHED", "UNAVAILABLE"].includes(previous.currentCycleStatus)) return rejected("EXISTING_ACTIVE_PLAN_REQUIRES_REVIEW")
      if (previous.currentPlan?.progress.some(progress => progress.state === "PAIN_CHECKIN")) return rejected("SAFETY_REVIEW_REQUIRED")
      const activeKey = activePlanBetaStorageKey(), activeBefore = localStorage.getItem(activeKey)
      if (activeBefore !== null && previous.currentCycleStatus !== "CURRENT") return rejected("EXISTING_ACTIVE_PLAN_REQUIRES_ARCHIVE")
      const archivedDocument = structuredClone(previous.document)
      if (previous.currentCycleStatus === "CURRENT") {
        if (scope.scope !== null) return rejected("ACCOUNT_STORAGE_UNSUPPORTED")
        const planArchive = previous.currentPlan && stageArchive(previous.currentPlan, at, "MANUAL")
        if (!planArchive) return rejected("PLAN_ARCHIVE_UNAVAILABLE")
        changes.push(planArchive, { storage: localStorage, key: activeKey, previous: activeBefore, next: null })
      }
      if (archivedDocument.application) archivedDocument.cycles[archivedDocument.application.currentCycleIndex - 1]!.status = "ENDED"
      if (!parseDocument(archivedDocument)) return rejected("INVALID_PROGRAM_DOCUMENT")
      const nextHistory: GoalTrainingProgramHistory = { version: 1,
        entries: [{ archivedAt: at, document: archivedDocument }, ...history.history.entries] }
      const next = JSON.stringify(nextHistory)
      if (new TextEncoder().encode(next).byteLength > MAX_DOCUMENT_BYTES) return rejected("PROGRAM_HISTORY_CAPACITY_REACHED")
      changes.push({ storage: localStorage, key: accountScopedStorageKey(GOAL_TRAINING_PROGRAM_HISTORY_STORAGE_KEY), previous: history.raw, next })
    }
    if (valid.program.window.startDate < todayISO()) return rejected("START_DATE_ELAPSED")
    const pendingCycle = (cycle: Cycle): GoalTrainingProgramCycleRecord => ({ cycle, status: "PENDING", latestPlan: null, lineage: [] })
    const document: StoredGoalTrainingProgram = { version: 1, revision: read.kind === "loaded" ? read.document.revision + 1 : 0,
      program: valid.program, application: null, cycles: [pendingCycle(1), pendingCycle(2), pendingCycle(3)] }
    if (!parseDocument(document)) return rejected("INVALID_PROGRAM_DOCUMENT")
    const key = activeGoalTrainingProgramStorageKey(), next = JSON.stringify(document)
    changes.push({ storage: localStorage, key, previous: read.kind === "loaded" ? read.raw : null, next })
    const saved = commit(changes, () => scope.current()
      && options.freshPreview?.() !== false && fingerprint(program) === request && optionsFingerprint() === optionsRequest
      && valid.program.window.startDate >= todayISO()
      && evaluatePlanSafety(options.currentCheck).kind === "passed")
    if (!saved.ok) return failed(saved)
    notifyProgramChanged(); if (changes.some(change => change.key === activePlanBetaStorageKey())) window.dispatchEvent(new Event(ACCOUNT_PLAN_EVENT))
    return { kind: "saved", document }
  }, scope)
}

function stageArchive(state: PlanBetaStateV3, at: string, reason: "MANUAL" | "SUCCESSOR") {
  const key = accountScopedStorageKey(HISTORY_KEY), previous = localStorage.getItem(key)
  const parsed = planHistoryListSchema.safeParse(JSON.parse(previous ?? "[]"))
  if (!parsed.success) return null
  const archived = planHistorySchema.parse(planHistorySnapshotContent(state, at, reason))
  const next = JSON.stringify(planHistoryListSchema.parse([archived, ...parsed.data].slice(0, 18)))
  return { storage: localStorage, key, previous, next } satisfies StorageChange
}

export async function applyGoalTrainingProgramCycle(input: GoalTrainingProgramApplyInput): Promise<
  { kind: "applied"; document: StoredGoalTrainingProgram; state: PlanBetaStateV3 } | GoalTrainingProgramWriteFailure> {
  if (accountPlansEnabled()) return applyAccountGoalCycle(input)
  if (localAccountScopeSnapshot() !== null) return rejected("ACCOUNT_STORAGE_UNSUPPORTED")
  if (!input.confirmsNoKnownRisk) return rejected("CURRENT_BODY_CONFIRMATION_REQUIRED")
  const requestFingerprint = () => fingerprint({ programId: input.programId, expectedRevision: input.expectedRevision,
    cycle: input.cycle, confirmsNoKnownRisk: input.confirmsNoKnownRisk })
  const scope = captureScope(), request = requestFingerprint()
  return locked(() => {
    const read = storedDocument()
    if (read.kind !== "loaded" || read.document.program.programId !== input.programId
      || !compareRevision(read, input.expectedRevision)) return rejected("STALE_PROGRAM_REVISION")
    const view = reconcile(read.document), document = structuredClone(view.document)
    if (view.currentCycleStatus === "UNAVAILABLE" || view.currentCycleStatus === "DETACHED") return rejected("EXISTING_ACTIVE_PLAN_REQUIRES_REVIEW")
    const previousCycle = document.application?.currentCycleIndex
    if (previousCycle === undefined ? input.cycle !== 1 : input.cycle !== previousCycle && input.cycle !== previousCycle + 1) return rejected("INVALID_CYCLE_TRANSITION")
    if (input.cycle === previousCycle && view.currentCycleStatus === "ENDED") return rejected("ENDED_CYCLE_CANNOT_RESTART")
    if (previousCycle !== undefined && input.cycle !== previousCycle && view.currentCycleStatus !== "ENDED") return rejected("CURRENT_CYCLE_REQUIRES_ARCHIVE")
    const targetFrame = document.program.frames[input.cycle - 1]!
    const lastDate = document.program.window.halfDays[targetFrame.halfDayOffset + 18]!.date
    if (todayISO() > lastDate) return rejected("CYCLE_DATES_ELAPSED")
    if (previousCycle === undefined && document.program.window.startDate < todayISO()) return rejected("START_DATE_ELAPSED")
    const activeKey = activePlanBetaStorageKey(), activeRaw = localStorage.getItem(activeKey)
    if (previousCycle === undefined && activeRaw !== null || input.cycle === previousCycle && view.currentCycleStatus === "PAUSED" && activeRaw !== null
      || input.cycle !== previousCycle && view.currentCycleStatus === "ENDED" && activeRaw !== null) return rejected("EXISTING_ACTIVE_PLAN_REQUIRES_ARCHIVE")
    const targetIndex = input.cycle - 1
    const state = input.cycle === previousCycle ? document.cycles[targetIndex]!.latestPlan : document.program.frames[targetIndex]!.plan
    if (!state || !planBetaStateV3Schema.safeParse(state).success || state.progress.some(p => p.state === "PAIN_CHECKIN")) return rejected("INVALID_CYCLE_PLAN")
    const fresh = () => scope.current() && input.confirmsNoKnownRisk && input.freshReview?.() !== false
      && requestFingerprint() === request && evaluatePlanSafety("NO_KNOWN_RISK").kind === "passed"
      && !view.currentPlan?.progress.some(p => p.state === "PAIN_CHECKIN")
      && todayISO() <= lastDate
      && (previousCycle !== undefined || document.program.window.startDate >= todayISO())
      && validateGoalTrainingProgram(document.program).kind === "valid"
    if (!fresh()) return rejected("SAFETY_OR_PREVIEW_CHANGED")
    if (input.cycle === previousCycle && view.currentCycleStatus === "CURRENT") return { kind: "applied", document, state }
    const at = new Date().toISOString(), changes: StorageChange[] = []
    if (previousCycle !== undefined && input.cycle !== previousCycle) {
      const old = document.cycles[previousCycle - 1]!
      if (view.currentCycleStatus === "CURRENT") {
        const history = view.currentPlan && stageArchive(view.currentPlan, at, "SUCCESSOR")
        if (!history) return rejected("PLAN_ARCHIVE_UNAVAILABLE")
        changes.push(history)
      }
      old.status = "ENDED"
    }
    document.revision += 1
    document.application = { appliedAt: document.application?.appliedAt ?? at, currentCycleIndex: input.cycle }
    document.cycles[targetIndex] = { ...document.cycles[targetIndex]!, status: "CURRENT", latestPlan: state }
    if (!parseDocument(document)) return rejected("INVALID_PROGRAM_DOCUMENT")
    changes.push({ storage: localStorage, key: activeKey, previous: activeRaw, next: JSON.stringify(state) },
      { storage: localStorage, key: activeGoalTrainingProgramStorageKey(), previous: read.raw, next: JSON.stringify(document) })
    const saved = commit(changes, fresh)
    if (!saved.ok) return failed(saved)
    notifyProgramChanged(); window.dispatchEvent(new Event(ACCOUNT_PLAN_EVENT))
    return { kind: "applied", document, state }
  }, scope)
}

export async function archiveGoalTrainingProgramCycle(input: { programId: string; expectedRevision: number }): Promise<
  { kind: "archived"; document: StoredGoalTrainingProgram } | GoalTrainingProgramWriteFailure> {
  if (accountPlansEnabled()) return archiveAccountGoalCycle(input)
  if (localAccountScopeSnapshot() !== null) return rejected("ACCOUNT_STORAGE_UNSUPPORTED")
  const scope = captureScope()
  return locked(() => {
    const read = storedDocument()
    if (read.kind !== "loaded" || read.document.program.programId !== input.programId
      || !compareRevision(read, input.expectedRevision)) return rejected("STALE_PROGRAM_REVISION")
    const view = reconcile(read.document)
    if (!view.document.application || !view.currentPlan || !["CURRENT", "ENDED", "PAUSED"].includes(view.currentCycleStatus)) return rejected("CURRENT_CYCLE_UNAVAILABLE")
    const document = structuredClone(view.document), index = document.application!.currentCycleIndex - 1
    const activeKey = activePlanBetaStorageKey(), previous = localStorage.getItem(activeKey)
    const changes: StorageChange[] = []
    if (view.currentCycleStatus === "CURRENT") {
      const history = stageArchive(view.currentPlan, new Date().toISOString(), "MANUAL")
      if (!history) return rejected("PLAN_ARCHIVE_UNAVAILABLE")
      changes.push(history, { storage: localStorage, key: activeKey, previous, next: null })
    }
    document.cycles[index]!.status = "ENDED"; document.revision += 1
    changes.push({ storage: localStorage, key: activeGoalTrainingProgramStorageKey(), previous: read.raw, next: JSON.stringify(document) })
    const saved = commit(changes, () => scope.current())
    if (!saved.ok) return failed(saved)
    notifyProgramChanged(); window.dispatchEvent(new Event(ACCOUNT_PLAN_EVENT))
    return { kind: "archived", document }
  }, scope)
}

/** Use exact current personal snapshots for presentation, keeping original reviewed frames intact. */
export function goalTrainingProgramDays(document: StoredGoalTrainingProgram): GoalTrainingProgram["days"] {
  const projection = projectDocument(document)
  if (projection.kind !== "ready") throw Error("GOAL_PROGRAM_CALENDAR_INVALID")
  return projection.days
}

export function exportGoalTrainingProgramJSON(): string {
  if (accountPlansEnabled()) {
    const service = monthlyAccountService(), view = service?.snapshot()
    if (!service || view?.status !== "READY" || !view.document || !view.historyLoaded) throw Error("GOAL_PROGRAM_BACKUP_NOT_READY")
    const reconciled = reconcile(view.document)
    if (["UNAVAILABLE", "DETACHED"].includes(reconciled.currentCycleStatus) || !parseDocument(reconciled.document)) throw Error("GOAL_PROGRAM_BACKUP_NOT_READY")
    const content = { app: "TRAINORACLE", format: GOAL_TRAINING_PROGRAM_BACKUP_FORMAT, exportedAt: new Date().toISOString(),
      document: reconciled.document, history: view.history }
    const raw = JSON.stringify({ ...content, contentFingerprint: fingerprint(content) }, null, 2)
    if (new TextEncoder().encode(raw).byteLength > MAX_DOCUMENT_BYTES || monthlyAccountService() !== service) throw Error("GOAL_PROGRAM_BACKUP_NOT_READY")
    return raw
  }
  const scope = captureScope(), read = storedDocument(), history = readProgramHistory()
  if (read.kind !== "loaded") throw Error("GOAL_PROGRAM_BACKUP_NOT_READY")
  if (!history) throw Error("GOAL_PROGRAM_BACKUP_NOT_READY")
  const activeKey = activePlanBetaStorageKey(), archiveKey = accountScopedStorageKey(HISTORY_KEY)
  const activeBefore = localStorage.getItem(activeKey), archiveBefore = localStorage.getItem(archiveKey)
  const view = reconcile(read.document)
  if (["UNAVAILABLE", "DETACHED"].includes(view.currentCycleStatus) || !parseDocument(view.document)) throw Error("GOAL_PROGRAM_BACKUP_NOT_READY")
  const content = { app: "TRAINORACLE", format: GOAL_TRAINING_PROGRAM_BACKUP_FORMAT, exportedAt: new Date().toISOString(),
    document: view.document, history: history.history }
  const raw = JSON.stringify({ ...content, contentFingerprint: fingerprint(content) }, null, 2)
  if (new TextEncoder().encode(raw).byteLength > MAX_DOCUMENT_BYTES) throw Error("GOAL_PROGRAM_BACKUP_TOO_LARGE")
  if (!scope.current() || localStorage.getItem(activeGoalTrainingProgramStorageKey()) !== read.raw
    || localStorage.getItem(accountScopedStorageKey(GOAL_TRAINING_PROGRAM_HISTORY_STORAGE_KEY)) !== history.raw
    || localStorage.getItem(activeKey) !== activeBefore || localStorage.getItem(archiveKey) !== archiveBefore) throw Error("GOAL_PROGRAM_BACKUP_STATE_CHANGED")
  return raw
}

export async function restoreGoalTrainingProgramJSON(raw: string, options: GoalTrainingProgramRestoreOptions): Promise<
  { kind: "restored"; document: StoredGoalTrainingProgram; activePlanChanged: false } | GoalTrainingProgramWriteFailure> {
  if (accountPlansEnabled()) return restoreAccountGoalProgram(raw, options)
  if (!options.confirmsOwnFile) return rejected("OWN_FILE_CONFIRMATION_REQUIRED")
  const scope = captureScope()
  return locked(() => {
    try {
      if (options.isCurrentRequest?.() === false || new TextEncoder().encode(raw).byteLength > MAX_DOCUMENT_BYTES) return rejected("STALE_OR_INVALID_BACKUP")
      const incoming = JSON.parse(raw)
      if (!hasCanonicalJsonTree(incoming) || incoming?.app !== "TRAINORACLE" || incoming.format !== GOAL_TRAINING_PROGRAM_BACKUP_FORMAT
        || Reflect.ownKeys(incoming).length !== 6 || new Date(incoming.exportedAt).toISOString() !== incoming.exportedAt
        || Date.parse(incoming.exportedAt) > Date.now()) return rejected("INVALID_PROGRAM_BACKUP")
      const content = { app: incoming.app, format: incoming.format, exportedAt: incoming.exportedAt,
        document: incoming.document, history: incoming.history }
      const document = parseDocument(incoming.document), incomingHistory = parseProgramHistory(incoming.history)
      if (!document || !incomingHistory || incoming.contentFingerprint !== fingerprint(content)) return rejected("INVALID_PROGRAM_BACKUP")
      const read = storedDocument()
      if (!compareRevision(read, options.expectedRevision)) return rejected("STALE_PROGRAM_REVISION")
      const history = readProgramHistory()
      if (!history) return rejected("PROGRAM_HISTORY_UNAVAILABLE")
      const entries = [...history.history.entries]
      for (const entry of incomingHistory.entries) {
        if (!entries.some(existing => fingerprint(existing.document) === fingerprint(entry.document))) entries.push(entry)
      }
      if (entries.length > MAX_PROGRAM_HISTORY) return rejected("PROGRAM_HISTORY_CAPACITY_REACHED")
      const nextHistory: GoalTrainingProgramHistory = { version: 1, entries }
      const nextHistoryRaw = JSON.stringify(nextHistory)
      if (new TextEncoder().encode(nextHistoryRaw).byteLength > MAX_DOCUMENT_BYTES) return rejected("PROGRAM_HISTORY_CAPACITY_REACHED")
      if (read.kind === "loaded") {
        if (fingerprint(reconcile(read.document).document) !== fingerprint(document)) return rejected("EXISTING_PROGRAM_REQUIRES_REVIEW")
      }
      const activeKey = activePlanBetaStorageKey(), activeBefore = localStorage.getItem(activeKey)
      const restored = read.kind === "loaded" ? document : { ...document, revision: document.revision + 1 }
      if (!parseDocument(restored)) return rejected("INVALID_PROGRAM_DOCUMENT")
      const key = activeGoalTrainingProgramStorageKey(), changes: StorageChange[] = []
      if (entries.length || history.raw !== null) changes.push({ storage: localStorage,
        key: accountScopedStorageKey(GOAL_TRAINING_PROGRAM_HISTORY_STORAGE_KEY), previous: history.raw, next: nextHistoryRaw })
      if (read.kind === "missing") changes.push({ storage: localStorage, key, previous: null, next: JSON.stringify(restored) })
      const saved = commit(changes, () => scope.current()
        && options.confirmsOwnFile && options.isCurrentRequest?.() !== false && localStorage.getItem(activeKey) === activeBefore)
      if (!saved.ok) return failed(saved)
      notifyProgramChanged()
      return { kind: "restored", document: restored, activePlanChanged: false }
    } catch { return rejected("INVALID_PROGRAM_BACKUP") }
  }, scope)
}
