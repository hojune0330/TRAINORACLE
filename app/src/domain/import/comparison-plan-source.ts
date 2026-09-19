import { accountPlanService, type AccountPlanStatus } from "../account/account-plan-service"
import { accountPlanDocumentSchema, type AccountPlanDocument, type AccountPlanEntry, type AccountPlanPacket } from "../account/account-plan-document-schema"
import { activeLocalAccount, onLocalJournalScopeChange } from "../account/local-journal-ownership"
import { hasCanonicalJsonTree } from "../plan-beta-schema"
import { createPlannedSessionLogDraft, type LinkablePlanSession } from "../planned-session-link"
import { comparisonOriginalReferenceSchema, type ComparisonOriginalReference } from "./comparison-relation"
import { resolveComparisonOriginal, resolveComparisonPlanSessions, type ComparisonOriginalResolution, type VerifiedComparisonOriginal } from "./file-plan-comparison"

/** Read-only subset of the existing service, also usable with synthetic ports in tests.
 * Only confirmedDocument is consumed. document/currentPlan may contain overlays or materialized progress.
 */
export type ComparisonPlanReadService = {
  snapshot(): {
    readonly status: AccountPlanStatus
    readonly confirmedDocument?: AccountPlanDocument | null
    readonly historyLoaded?: boolean
    readonly totalPlans?: number
  }
  hydrate?: () => Promise<boolean>
  loadHistory?: () => Promise<boolean>
  loadPlan?: (planId: string) => Promise<AccountPlanEntry | null>
}
type SourceOptions = {
  readonly getService?: () => ComparisonPlanReadService | null
  /** Reference creation time only; never an assertion that a journal was originally planned. */
  readonly referenceTime?: string
}
export type ComparisonPlanChoice = {
  readonly choiceId: string
  readonly reference: ComparisonOriginalReference
  readonly planVersion: 2 | 3 | 4 | 5 | 6
  readonly generatedAt: string
  readonly archivedAt: string | null
  readonly isCurrentPlan: boolean
  readonly prescriptionKind: string
}
const authority = { source: "ACKNOWLEDGED_ACCOUNT_PLAN" as const, executionAuthority: "NONE" as const,
  persistenceAuthority: "NONE" as const, requiresServerOriginalVerification: true as const }
const unavailable = (reason: string) => ({ status: "UNAVAILABLE" as const, reason, choices: [] as readonly ComparisonPlanChoice[], ...authority })

function acknowledged(service: ComparisonPlanReadService | null) {
  if (service === null) return null
  const view = service.snapshot()
  if (!["READY", "EMPTY", "PENDING", "CONFLICT", "REJECTED"].includes(view.status)
    || !hasCanonicalJsonTree(view.confirmedDocument)) return null
  // Collection history may exceed the legacy monolithic byte cap. Reuse the logical document validator.
  const parsed = accountPlanDocumentSchema.safeParse(view.confirmedDocument)
  if (!parsed.success) return null
  const loaded = parsed.data.data.plans.length
  if (view.totalPlans !== undefined && (!Number.isSafeInteger(view.totalPlans) || view.totalPlans < loaded
    || view.historyLoaded !== false && view.totalPlans !== loaded)) return null
  return { view, document: parsed.data }
}

function choicesFrom(service: ComparisonPlanReadService | null, referenceTime?: string) {
  const read = acknowledged(service)
  if (read === null) return unavailable("ACCOUNT_PLAN_NOT_ACKNOWLEDGED")
  if (referenceTime !== undefined && !Number.isFinite(Date.parse(referenceTime))) return unavailable("INVALID_REFERENCE_TIME")
  const choices: ComparisonPlanChoice[] = []
  for (const entry of read.document.data.plans) {
    const packet = entry.snapshot
    const state = packet.state.version === 2 || packet.state.version === 3 ? packet.state : packet.state.selection
    for (const session of state.activePlan.sessions) {
      if (session.role === "REST") continue
      const draft = createPlannedSessionLogDraft<LinkablePlanSession>(state, session, referenceTime ?? state.generatedAt)
      if (draft === null) return unavailable("INVALID_ORIGINAL_SESSION")
      const reference = { planFingerprint: entry.planId, session: draft.link }
      choices.push({ choiceId: `${entry.planId}/${draft.link.plannedSessionId}`, reference,
        planVersion: packet.state.version, generatedAt: state.generatedAt, archivedAt: entry.archivedAt,
        isCurrentPlan: entry.planId === read.document.data.currentPlanId, prescriptionKind: session.prescription.kind })
    }
  }
  return { status: "AVAILABLE" as const, choices, ...authority,
    coverage: read.view.historyLoaded === false ? "PARTIAL" as const : "COMPLETE" as const,
    loadedPlans: read.document.data.plans.length, totalPlans: read.view.totalPlans ?? read.document.data.plans.length }
}

/** Synchronous projection only; no hydrate, fallback to device storage, pending selection or network request. */
export function readComparisonPlanChoices(options: SourceOptions = {}) {
  try {
    return choicesFrom((options.getService ?? accountPlanService)(), options.referenceTime)
  } catch { return unavailable("ACCOUNT_PLAN_READ_FAILED") }
}

/** Explicit history request. The app retains responsibility for its existing service hydration lifecycle. */
export async function loadComparisonPlanChoices(options: SourceOptions = {}) {
  const getService: () => ComparisonPlanReadService | null = options.getService ?? accountPlanService
  try {
    const service = getService(), read = acknowledged(service)
    if (read === null || service === null) return unavailable("ACCOUNT_PLAN_NOT_ACKNOWLEDGED")
    if (read.view.historyLoaded === false) {
      if (!service.loadHistory || !await service.loadHistory()) return unavailable("HISTORY_LOAD_FAILED")
    }
    if (getService() !== service) return unavailable("ACCOUNT_CHANGED")
    const result = choicesFrom(service, options.referenceTime)
    return result.status === "AVAILABLE" && result.coverage !== "COMPLETE" ? unavailable("HISTORY_INCOMPLETE") : result
  } catch { return unavailable("HISTORY_LOAD_FAILED") }
}

/** Revalidate a selected immutable choice. Collection loadPlan checks the acknowledged index and exact
 * part hashes; it does not mutate the current-only projection or pretend full history has loaded.
 * A client result is display-only: the server MUST independently repeat its owner-scoped stored read.
 */
export async function resolveAccountComparisonOriginal(reference: unknown, options: Pick<SourceOptions, "getService"> = {}): Promise<ComparisonOriginalResolution> {
  const getService: () => ComparisonPlanReadService | null = options.getService ?? accountPlanService
  const missing = () => resolveComparisonOriginal(null, reference)
  try {
    if (!hasCanonicalJsonTree(reference)) return missing()
    const parsed = comparisonOriginalReferenceSchema.safeParse(reference)
    const service = getService(), read = acknowledged(service)
    if (!parsed.success || !service || !read) return missing()
    let entry = read.document.data.plans.find(plan => plan.planId === parsed.data.planFingerprint)
    if (!entry && read.view.historyLoaded === false && service.loadPlan) {
      entry = await service.loadPlan(parsed.data.planFingerprint) ?? undefined
    }
    if (getService() !== service || acknowledged(service) === null) return missing()
    return resolveComparisonOriginal(entry?.planId === parsed.data.planFingerprint ? entry.snapshot : null, parsed.data)
  } catch { return missing() }
}

export type ComparisonPlanSource = {
  readonly label: string
  readonly reference: ComparisonOriginalReference
  readonly original: VerifiedComparisonOriginal
  /** Detached immutable body only. Resolve a stored relation with snapshot + relation.original on reopen. */
  readonly snapshot: AccountPlanPacket
}
export type ComparisonPlanSourcesResult =
  | { readonly kind: "ready"; readonly sources: ComparisonPlanSource[] } & typeof authority
  | { readonly kind: "unavailable" }

/** UI entry point: hydrate, explicitly load complete history, then project immutable original sessions.
 * A scope-change listener also invalidates A -> B -> A, even if the final owner string is unchanged.
 */
export async function loadComparisonPlanSources(options: Pick<SourceOptions, "getService"> = {}): Promise<ComparisonPlanSourcesResult> {
  const getService: () => ComparisonPlanReadService | null = options.getService ?? accountPlanService
  const owner = activeLocalAccount()
  if (owner === null) return { kind: "unavailable" }
  let invalidated = false
  const stop = onLocalJournalScopeChange(() => { invalidated = true })
  try {
    const service = getService()
    const current = () => !invalidated && activeLocalAccount() === owner && getService() === service
    if (!service || !service.hydrate || !await service.hydrate() || !current()) return { kind: "unavailable" }
    if (service.loadHistory && (!await service.loadHistory() || !current())) return { kind: "unavailable" }
    const read = acknowledged(service)
    if (!read || read.view.historyLoaded === false || !current()) return { kind: "unavailable" }
    const sources: ComparisonPlanSource[] = []
    for (const entry of read.document.data.plans) {
      const resolved = resolveComparisonPlanSessions(entry.snapshot)
      if (resolved.status !== "ORIGINAL_SESSIONS") return { kind: "unavailable" }
      const snapshot = structuredClone(entry.snapshot)
      for (const original of resolved.originals) {
        const session = original.original.session
        sources.push({ label: `${session.plannedDate} ${session.sessionSlot} / Day ${session.sessionDay} / ${session.plannedRole === "QUALITY" ? "Quality" : "Easy"}${entry.archivedAt === null ? "" : " / Archived"}`,
          reference: original.original, original, snapshot })
      }
    }
    return current() ? { kind: "ready", sources, ...authority } : { kind: "unavailable" }
  } catch { return { kind: "unavailable" } }
  finally { stop() }
}
