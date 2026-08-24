import { z } from "zod"
import {
  canonicalJson,
  canonicalJsonSha256,
  createPlanAdaptationProposal,
  hashPlanCandidate,
  verifyPlanAdaptationProposal,
} from "@impl/plan-generator/adaptation"
import {
  ADAPTATION_TRANSFORM_REGISTRY_FINGERPRINT,
  ADAPTATION_TRANSFORM_REGISTRY_VERSION,
  resolveRegisteredAdaptationTransform,
} from "@impl/plan-generator/adaptation-transform-registry"
import type { PlanCandidate } from "@impl/plan-generator/types"
import {
  loadAthleteRecords,
} from "./athlete-records"
import {
  resolveDetailedPrescriptionRuntimeAuthority,
} from "./detailed-prescription-runtime-authority"
import {
  evaluateActivePlanAdaptationSafety,
} from "./plan-adaptation-ui-context"
import type { ActivePlanAdaptationSafety } from "./plan-adaptation-ui-context"
import type { PlanCurrentCheck } from "./plan-beta-flow"
import {
  hasCanonicalJsonTree,
  planAdaptationCandidateSchema,
  planAdaptationEnvelopeSchema,
  planBetaStateV3Schema,
  planHistoryListSchema,
} from "./plan-beta-schema"
import type {
  PendingNextFrameSuccessor,
  PlanAdaptationEnvelope,
  PlanBetaState,
  PlanBetaStateV3,
  StoredPlanHistory,
} from "./plan-beta-schema"
import {
  recheckStoredDetailedPrescriptionAuthority,
} from "./plan-session-schema"
import {
  getPlanMutationLockManager,
  PLAN_BETA_MUTATION_LOCK_NAME,
} from "./plan-mutation-lock"

export { PLAN_BETA_MUTATION_LOCK_NAME } from "./plan-mutation-lock"
export const PLAN_SUCCESSOR_ACTIVATION_RECEIPT_STORAGE_KEY = "trainoracle.plan-beta.adaptation-activation.v1"

const ACTIVE_KEY = "trainoracle.plan-beta.v1"
const HISTORY_KEY = "trainoracle.plan-beta.history.v1"
const PENDING_KEY = "trainoracle.plan-beta.adaptation.v1"
const CONTEXT_KEY = "trainoracle.plan-adaptation-context.v1"
const PREVIOUS_INTAKE_KEY = "trainoracle.plan-beta.previous-intake.v1"
const PRIVATE_KEY = /(?:memo|note|symptom)/iu
const terminalProgressStates = new Set(["COMPLETED", "RESTED", "SKIPPED", "PAIN_CHECKIN"])
const MAX_ACTIVATION_FUTURE_SKEW_MS = 5 * 60 * 1000

const activationInputSchema = z.object({
  currentCheck: z.enum(["NO_KNOWN_RISK", "REVIEW_REQUIRED"]),
  activatedAt: z.string().datetime(),
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
}).strict()

const contextSchema = z.object({
  version: z.literal(1),
  activeCandidateId: z.string().min(1),
  candidates: z.tuple([
    planAdaptationCandidateSchema,
    planAdaptationCandidateSchema,
  ]),
}).strict().superRefine((context, refinement) => {
  if (!context.candidates.some((candidate) => candidate.candidateId === context.activeCandidateId)) {
    refinement.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["activeCandidateId"],
      message: "Active candidate must be contained in the stored context.",
    })
  }
})

const receiptSchema = z.object({
  version: z.literal(1),
  decisionId: z.string().regex(/^adaptation-decision:[a-f0-9]{64}$/u),
  proposalId: z.string().regex(/^adaptation:[a-f0-9]{64}$/u),
  idempotencyKey: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
  predecessorStateHash: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
  successorStateHash: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
  successorCandidateId: z.string().min(1),
  pairId: z.string().regex(/^plan-pair:v3:/u),
  activatedAt: z.string().datetime(),
}).strict()

type StoredAdaptationContext = z.infer<typeof contextSchema>

export type ActivateAcceptedSuccessorInput = {
  readonly currentCheck: PlanCurrentCheck
  readonly activatedAt: string
  readonly localDate: string
}

export type ActivateAcceptedSuccessorResult =
  | { readonly kind: "activated"; readonly state: PlanBetaStateV3 }
  | { readonly kind: "already_consumed"; readonly state: PlanBetaStateV3 }
  | { readonly kind: "blocked"; readonly code: "SAFETY_BLOCKED" | "STALE_SAFETY" | "ACTIVE_HOLD" | "INCOMPLETE_FRAME" }
  | {
      readonly kind: "rejected"
      readonly code:
        | "MUTATION_LOCK_UNAVAILABLE"
        | "MALFORMED_INPUT"
        | "NO_PENDING_SUCCESSOR"
        | "STALE_BASE"
        | "CONTEXT_MISMATCH"
        | "PENDING_ENVELOPE_MISMATCH"
        | "TRANSFORM_UNAVAILABLE"
        | "RECORD_SNAPSHOT_MISMATCH"
        | "TEMPLATE_AUTHORITY_UNAVAILABLE"
        | "RECEIPT_MISMATCH"
    }
  | { readonly kind: "failed"; readonly code: "ACTIVATION_STORAGE_WRITE_FAILED"; readonly rollbackComplete: boolean }

export async function activateAcceptedNextFrameSuccessor(
  input: ActivateAcceptedSuccessorInput,
): Promise<ActivateAcceptedSuccessorResult> {
  const parsedInput = parseActivationInput(input)
  if (parsedInput === null) return { kind: "rejected", code: "MALFORMED_INPUT" }
  const locks = getPlanMutationLockManager()
  if (locks === null) return { kind: "rejected", code: "MUTATION_LOCK_UNAVAILABLE" }

  try {
    return await locks.request(
      PLAN_BETA_MUTATION_LOCK_NAME,
      { mode: "exclusive", ifAvailable: true },
      async (lock) => {
        if (lock === null) return { kind: "rejected", code: "MUTATION_LOCK_UNAVAILABLE" } as const
        return activateInsideLock(parsedInput)
      },
    )
  } catch {
    return { kind: "rejected", code: "MUTATION_LOCK_UNAVAILABLE" }
  }
}

export function isPlanFrameCompletionEligible(
  state: PlanBetaState,
  localDate: string,
): boolean {
  return state.version === 3 && isCalendarDate(localDate) && frameIsComplete(state, localDate)
}

async function activateInsideLock(
  input: ActivateAcceptedSuccessorInput,
): Promise<ActivateAcceptedSuccessorResult> {
  if (typeof window === "undefined") return { kind: "rejected", code: "MUTATION_LOCK_UNAVAILABLE" }

  const snapshots = snapshotStorage()
  if (snapshots === null) return { kind: "failed", code: "ACTIVATION_STORAGE_WRITE_FAILED", rollbackComplete: false }

  const active = parseActiveState(snapshots.active)
  if (active === null) return { kind: "rejected", code: "STALE_BASE" }
  const pending = parsePendingEnvelope(snapshots.pending)
  if (snapshots.pending === null) return alreadyConsumedOrNoPending(active, snapshots.receipt)
  if (pending === null) return { kind: "rejected", code: "MALFORMED_INPUT" }
  const safety = evaluateActivePlanAdaptationSafety(
    active,
    input.currentCheck,
    new Date(input.activatedAt),
  )
  if (safety.kind === "blocked") return { kind: "blocked", code: "SAFETY_BLOCKED" }
  if (Date.parse(safety.safetyEvaluatedAt) > Date.parse(input.activatedAt)
      || Date.parse(input.activatedAt) > Date.parse(safety.safetyValidUntil)) {
    return { kind: "blocked", code: "STALE_SAFETY" }
  }
  if (safety.activeHold || active.progress.some((progress) => progress.state === "PAIN_CHECKIN")) {
    return { kind: "blocked", code: "ACTIVE_HOLD" }
  }

  const context = parseContext(snapshots.context)
  if (context === null || context.activeCandidateId !== active.activePlan.candidateId) {
    return { kind: "rejected", code: "CONTEXT_MISMATCH" }
  }
  if (!frameIsComplete(active, input.localDate)) return { kind: "blocked", code: "INCOMPLETE_FRAME" }

  const verification = await verifyAcceptedPending({ active, pending, context, safety, activatedAt: input.activatedAt })
  if (verification.kind !== "verified") return verification

  const nextState = buildActivatedSuccessorState(pending.pending.successorState, input.activatedAt, input.localDate)
  if (nextState === null) return { kind: "rejected", code: "PENDING_ENVELOPE_MISMATCH" }
  const nextStateHash = await canonicalJsonSha256("trainoracle.plan-beta-state.v1", nextState)
  const history = parseHistory(snapshots.history)
  if (history === null) return { kind: "rejected", code: "MALFORMED_INPUT" }
  const nextHistory: StoredPlanHistory = {
    version: 3,
    candidateId: active.activePlan.candidateId,
    pairId: active.activePlan.pairId,
    candidateKind: active.activePlan.candidateKind,
    eventDistanceM: active.activePlan.eventDistanceM,
    selectedDetailedTemplateRef: active.activePlan.selectedDetailedTemplateRef,
    frameLengthDays: active.activePlan.frame.lengthDays,
    progress: visibleProgress(active),
    archivedAt: input.activatedAt,
  }
  const nextContext = contextSchema.safeParse({
    ...context,
    activeCandidateId: nextState.activePlan.candidateId,
  })
  if (!nextContext.success) return { kind: "rejected", code: "CONTEXT_MISMATCH" }
  const receipt = receiptSchema.safeParse({
    version: 1,
    decisionId: pending.decision.decisionId,
    proposalId: pending.pending.proposalId,
    idempotencyKey: pending.pending.idempotencyKey,
    predecessorStateHash: pending.pending.predecessorStateHash,
    successorStateHash: nextStateHash,
    successorCandidateId: nextState.activePlan.candidateId,
    pairId: nextState.activePlan.pairId,
    activatedAt: input.activatedAt,
  })
  if (!receipt.success) return { kind: "rejected", code: "MALFORMED_INPUT" }

  const staged = {
    history: JSON.stringify([nextHistory, ...history].slice(0, 5)),
    previousIntake: JSON.stringify(active.intake),
    context: JSON.stringify(nextContext.data),
    active: JSON.stringify(nextState),
    receipt: JSON.stringify(receipt.data),
  }
  const transaction = [
    () => writeVerified(window.localStorage, HISTORY_KEY, staged.history),
    () => writeVerified(window.sessionStorage, PREVIOUS_INTAKE_KEY, staged.previousIntake),
    () => writeVerified(window.localStorage, CONTEXT_KEY, staged.context),
    () => writeVerified(window.localStorage, ACTIVE_KEY, staged.active),
    () => writeVerified(window.localStorage, PLAN_SUCCESSOR_ACTIVATION_RECEIPT_STORAGE_KEY, staged.receipt),
    () => removeVerified(window.localStorage, PENDING_KEY),
  ]

  for (const stage of transaction) {
    if (!stage()) {
      return {
        kind: "failed",
        code: "ACTIVATION_STORAGE_WRITE_FAILED",
        rollbackComplete: restoreSnapshots(snapshots),
      }
    }
  }
  return { kind: "activated", state: nextState }
}

async function verifyAcceptedPending(input: {
  readonly active: PlanBetaStateV3
  readonly pending: PlanAdaptationEnvelope
  readonly context: StoredAdaptationContext
  readonly safety: Extract<ActivePlanAdaptationSafety, { readonly kind: "evaluated" }>
  readonly activatedAt: string
}): Promise<{ readonly kind: "verified" } | Exclude<ActivateAcceptedSuccessorResult, { readonly kind: "activated" } | { readonly kind: "already_consumed" } | { readonly kind: "blocked" } | { readonly kind: "failed" }>> {
  const pending = input.pending.pending
  const base = input.context.candidates.find((candidate) => candidate.candidateId === input.active.activePlan.candidateId)
  const successor = input.context.candidates.find((candidate) => candidate.candidateId === pending.successorState.activePlan.candidateId)
  if (base === undefined || successor === undefined || base.candidateId === successor.candidateId) {
    return { kind: "rejected", code: "CONTEXT_MISMATCH" }
  }
  const activeHash = await canonicalJsonSha256("trainoracle.plan-beta-state.v1", input.active)
  const [baseHash, successorHash] = await Promise.all([hashPlanCandidate(base), hashPlanCandidate(successor)])
  const activeScope = input.active.adaptationScope
  if (activeScope === undefined
      || pending.athleteId !== activeScope.athleteId
      || pending.eventDistanceM !== activeScope.eventDistanceM
      || pending.eventDistanceM !== input.active.activePlan.eventDistanceM
      || pending.pairId !== activeScope.pairId
      || canonicalJson(pending.selectedDetailedTemplateRef) !== canonicalJson(activeScope.selectedDetailedTemplateRef)
      || activeHash !== pending.predecessorStateHash
      || baseHash !== pending.baseContentHash
      || baseHash !== pending.sourceCandidateContentHash
      || successorHash !== pending.proposedContentHash
      || pending.baseCandidateId !== base.candidateId
      || pending.sourceCandidateId !== base.candidateId
      || pending.pairId !== input.active.activePlan.pairId
      || pending.pairId !== base.pairId
      || pending.pairId !== successor.pairId
      || pending.predecessorPairFingerprint !== pending.pairId
      || canonicalJson(pending.selectedDetailedTemplateRef) !== canonicalJson(input.active.activePlan.selectedDetailedTemplateRef)
      || canonicalJson(pending.selectedDetailedTemplateRef) !== canonicalJson(successor.selectedDetailedTemplateRef)
      || pending.activePlanStartedAt !== input.active.generatedAt
      || input.active.activePlan.selectionActor !== "SELF"
      || pending.proposalOrigin !== "SELF_SERVICE"
      || pending.selectionAuthority !== "SELF") {
    return { kind: "rejected", code: "PENDING_ENVELOPE_MISMATCH" }
  }
  if (Date.parse(pending.acceptanceSafetyEvaluatedAt) > Date.parse(pending.acceptedAt)
      || Date.parse(pending.acceptedAt) > Date.parse(pending.acceptanceSafetyValidUntil)
      || Date.parse(pending.acceptedAt) < Date.parse(pending.evaluatedAt)
      || Date.parse(pending.acceptedAt) >= Date.parse(pending.expiresAt)
      || pending.activeHold
      || pending.safetyGate.kind !== "passed") {
    return { kind: "rejected", code: "PENDING_ENVELOPE_MISMATCH" }
  }
  if (!successorPreviewMatches(pending.successorState, successor, input.active)) {
    return { kind: "rejected", code: "PENDING_ENVELOPE_MISMATCH" }
  }

  const transform = resolveRegisteredAdaptationTransform(base, successor, pending.trigger)
  if (transform === null
      || pending.transformRegistryVersion !== ADAPTATION_TRANSFORM_REGISTRY_VERSION
      || pending.transformRegistryFingerprint !== ADAPTATION_TRANSFORM_REGISTRY_FINGERPRINT
      || pending.transformEdgeId !== transform.edge.edgeId
      || pending.transformPolicyVersion !== transform.edge.successorPolicyVersion
      || pending.transformDirection !== transform.edge.direction
      || canonicalJson(pending.allowedJsonPointers) !== canonicalJson(transform.allowedJsonPointers)
      || transform.edge.revoked
      || (transform.edge.expiresAt !== null && Date.parse(input.activatedAt) >= Date.parse(transform.edge.expiresAt))
      || pending.edgeRevoked !== transform.edge.revoked
      || pending.edgeExpiresAt !== transform.edge.expiresAt) {
    return { kind: "rejected", code: "TRANSFORM_UNAVAILABLE" }
  }

  const proposalResult = await createPlanAdaptationProposal({
    kind: "PLAN_ADAPTATION_PROPOSAL_REQUEST",
    scope: {
      athleteId: pending.athleteId,
      eventDistanceM: pending.eventDistanceM,
      pairId: pending.pairId,
      selectedDetailedTemplateRef: pending.selectedDetailedTemplateRef,
    },
    activePlanStartedAt: pending.activePlanStartedAt,
    baseCandidate: base,
    proposedCandidate: successor,
    baseContentHash: baseHash,
    proposalOrigin: pending.proposalOrigin,
    trigger: pending.triggerSnapshot,
    changeDimension: pending.changeDimension,
    safetyGate: pending.safetyGate,
    safetyEvaluatedAt: pending.safetyEvaluatedAt,
    safetyValidUntil: pending.safetyValidUntil,
    activeHold: pending.activeHold,
    createdAt: pending.evaluatedAt,
    idempotencyKey: pending.idempotencyKey,
  })
  if (proposalResult.kind !== "proposed" || !await verifyPlanAdaptationProposal(proposalResult.proposal)) {
    return { kind: "rejected", code: "PENDING_ENVELOPE_MISMATCH" }
  }
  const acceptanceRequest = {
    proposal: proposalResult.proposal,
    predecessorState: input.active,
    successorState: pending.successorState,
    actor: "SELF" as const,
    safetyGate: pending.safetyGate,
    safetyEvaluatedAt: pending.acceptanceSafetyEvaluatedAt,
    safetyValidUntil: pending.acceptanceSafetyValidUntil,
    activeHold: pending.activeHold,
    acceptedAt: pending.acceptedAt,
    idempotencyKey: pending.idempotencyKey,
  }
  const requestHash = await canonicalJsonSha256("trainoracle.plan-adaptation-acceptance.v1", acceptanceRequest)
  const decisionHash = await canonicalJsonSha256("trainoracle.plan-adaptation-decision.v1", {
    proposalId: proposalResult.proposal.proposalId,
    requestHash,
  })
  if (pending.requestHash !== requestHash
      || input.pending.decision.requestHash !== requestHash
      || pending.decisionId !== `adaptation-decision:${decisionHash.slice("sha256:".length)}`
      || input.pending.decision.decisionId !== pending.decisionId
      || input.pending.decision.proposalId !== pending.proposalId
      || input.pending.decision.predecessorStateHash !== activeHash
      || input.pending.decision.proposedContentHash !== successorHash
      || input.pending.decision.idempotencyKey !== pending.idempotencyKey
      || input.pending.decision.decidedAt !== pending.acceptedAt) {
    return { kind: "rejected", code: "PENDING_ENVELOPE_MISMATCH" }
  }
  if (!recordSnapshotMatches(pending, input.active.generatedAt, input.activatedAt)) {
    return { kind: "rejected", code: "RECORD_SNAPSHOT_MISMATCH" }
  }
  if (!currentTemplateAuthorityMatches(input.active, successor, input.safety.safetyGate, input.activatedAt)) {
    return { kind: "rejected", code: "TEMPLATE_AUTHORITY_UNAVAILABLE" }
  }
  return { kind: "verified" }
}

function successorPreviewMatches(
  preview: PlanBetaStateV3,
  successor: PlanCandidate,
  predecessor: PlanBetaStateV3,
): boolean {
  const expectedActivePlan = {
    kind: "BETA_ACTIVE_PLAN_SNAPSHOT" as const,
    activationState: "SELECTED_BETA_SNAPSHOT" as const,
    candidateId: successor.candidateId,
    pairId: successor.pairId,
    candidateKind: successor.kind,
    eventDistanceM: successor.eventDistanceM,
    selectedDetailedTemplateRef: successor.selectedDetailedTemplateRef,
    selectionActor: "SELF" as const,
    sourceMode: successor.sourceMode,
    selectedEnergyIntent: successor.selectedEnergyIntent,
    frame: successor.frame,
    sessions: successor.sessions,
  }
  return preview.progress.length === 0
    && canonicalJson(preview.activePlan) === canonicalJson(expectedActivePlan)
    && canonicalJson(preview.intake) === canonicalJson(predecessor.intake)
    && canonicalJson(preview.adaptationScope) === canonicalJson(predecessor.adaptationScope)
    && canonicalJson(preview.athleteEvidence) === canonicalJson(predecessor.athleteEvidence)
}

function currentTemplateAuthorityMatches(
  active: PlanBetaStateV3,
  successor: PlanCandidate,
  safetyGate: Extract<ActivePlanAdaptationSafety, { readonly kind: "evaluated" }>['safetyGate'],
  evaluatedAt: string,
): boolean {
  const reference = successor.selectedDetailedTemplateRef
  if (canonicalJson(reference) !== canonicalJson(active.activePlan.selectedDetailedTemplateRef)) return false
  if (reference === null) {
    return successor.sessions.every((session) => session.prescription.kind !== "PACE_TARGET")
  }
  if (resolveDetailedPrescriptionRuntimeAuthority({
    selectedTemplateRef: reference,
    targetEventDistanceM: successor.eventDistanceM,
    selectedEnergyIntent: successor.selectedEnergyIntent,
    evaluatedAt,
  }).kind !== "authorized") return false
  return successor.sessions.every((session) => (
    session.prescription.kind !== "PACE_TARGET"
      || recheckStoredDetailedPrescriptionAuthority({
        operation: "START",
        prescription: session.prescription,
        evaluatedAt,
        safetyGate,
      }).kind === "permitted"
  ))
}

function recordSnapshotMatches(
  pending: PendingNextFrameSuccessor,
  activePlanStartedAt: string,
  evaluatedAt: string,
): boolean {
  if (pending.trigger === "EXPLICIT_REQUEST") return true
  const snapshot = pending.triggerSnapshot
  if (snapshot.kind !== "SAME_EVENT_PB_SB_AFTER_ACTIVE_PLAN_START"
      || snapshot.historicalOrBackfilled
      || snapshot.eventDistanceM !== pending.eventDistanceM
      || Date.parse(snapshot.achievedAt) <= Date.parse(activePlanStartedAt)) return false
  const record = loadAthleteRecords(new Date(evaluatedAt)).find((candidate) => candidate.id === snapshot.recordId)
  return record !== undefined
    && (record.purpose === "PERSONAL_BEST" || record.purpose === "SEASON_BEST")
    && record.purpose === snapshot.purpose
    && record.eventDistanceM === snapshot.eventDistanceM
    && record.performanceSeconds === snapshot.performanceSeconds
    && record.sourceRef === snapshot.sourceRef
    && `${record.achievedOn}T00:00:00.000Z` === snapshot.achievedAt
}

function buildActivatedSuccessorState(
  preview: PlanBetaStateV3,
  activatedAt: string,
  localDate: string,
): PlanBetaStateV3 | null {
  const parsed = planBetaStateV3Schema.safeParse({
    ...preview,
    generatedAt: activatedAt,
    intake: { ...preview.intake, startDate: localDate },
    progress: [],
  })
  return parsed.success ? parsed.data : null
}

function frameIsComplete(state: PlanBetaStateV3, localDate: string): boolean {
  const visibleDays = projectedVisibleDays(state)
  const visible = state.activePlan.sessions.filter((session) => session.day <= visibleDays)
  const required = visible.filter((session) => session.role !== "REST")
  const completed = required.every((session) => state.progress.some((progress) => (
    progress.sessionDay === session.day
      && progress.sessionSlot === session.slot
      && terminalProgressStates.has(progress.state)
  )))
  if (completed) return true
  const finalDay = Math.max(...visible.map((session) => session.day), 0)
  const startDate = state.intake.startDate
  return startDate !== undefined
    && finalDay > 0
    && localDate > addCalendarDays(startDate, finalDay - 1)
}

function visibleProgress(state: PlanBetaStateV3) {
  const visibleDays = projectedVisibleDays(state)
  return state.progress.filter((progress) => progress.sessionDay <= visibleDays)
}

function projectedVisibleDays(state: PlanBetaStateV3): number {
  const frame = state.activePlan.frame
  return Math.ceil("projectionLengthDays" in frame
    ? (frame.projectionLengthDays ?? frame.lengthDays)
    : frame.lengthDays)
}

function alreadyConsumedOrNoPending(
  active: PlanBetaStateV3,
  rawReceipt: string | null,
): Promise<ActivateAcceptedSuccessorResult> | ActivateAcceptedSuccessorResult {
  if (rawReceipt === null) return { kind: "rejected", code: "NO_PENDING_SUCCESSOR" }
  try {
    const parsed = receiptSchema.safeParse(JSON.parse(rawReceipt))
    if (!parsed.success) return { kind: "rejected", code: "RECEIPT_MISMATCH" }
    return canonicalJsonSha256("trainoracle.plan-beta-state.v1", active).then((hash) => (
      hash === parsed.data.successorStateHash
        && active.activePlan.candidateId === parsed.data.successorCandidateId
        && active.activePlan.pairId === parsed.data.pairId
        ? { kind: "already_consumed", state: active } as const
        : { kind: "rejected", code: "RECEIPT_MISMATCH" } as const
    ))
  } catch {
    return { kind: "rejected", code: "RECEIPT_MISMATCH" }
  }
}

function parseActiveState(raw: string | null): PlanBetaStateV3 | null {
  if (raw === null) return null
  try {
    const parsed = planBetaStateV3Schema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

function parsePendingEnvelope(raw: string | null): PlanAdaptationEnvelope | null {
  if (raw === null) return null
  try {
    const parsed = planAdaptationEnvelopeSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

function parseContext(raw: string | null): StoredAdaptationContext | null {
  if (raw === null) return null
  try {
    const value: unknown = JSON.parse(raw)
    if (!hasCanonicalJsonTree(value)) return null
    const parsed = contextSchema.safeParse(value)
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

function parseHistory(raw: string | null): readonly StoredPlanHistory[] | null {
  if (raw === null) return []
  try {
    const parsed = planHistoryListSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

function snapshotStorage(): {
  readonly active: string | null
  readonly history: string | null
  readonly pending: string | null
  readonly context: string | null
  readonly previousIntake: string | null
  readonly receipt: string | null
} | null {
  try {
    return {
      active: window.localStorage.getItem(ACTIVE_KEY),
      history: window.localStorage.getItem(HISTORY_KEY),
      pending: window.localStorage.getItem(PENDING_KEY),
      context: window.localStorage.getItem(CONTEXT_KEY),
      previousIntake: window.sessionStorage.getItem(PREVIOUS_INTAKE_KEY),
      receipt: window.localStorage.getItem(PLAN_SUCCESSOR_ACTIVATION_RECEIPT_STORAGE_KEY),
    }
  } catch {
    return null
  }
}

function restoreSnapshots(snapshots: NonNullable<ReturnType<typeof snapshotStorage>>): boolean {
  return [
    restoreVerified(window.localStorage, ACTIVE_KEY, snapshots.active),
    restoreVerified(window.localStorage, HISTORY_KEY, snapshots.history),
    restoreVerified(window.localStorage, PENDING_KEY, snapshots.pending),
    restoreVerified(window.localStorage, CONTEXT_KEY, snapshots.context),
    restoreVerified(window.sessionStorage, PREVIOUS_INTAKE_KEY, snapshots.previousIntake),
    restoreVerified(window.localStorage, PLAN_SUCCESSOR_ACTIVATION_RECEIPT_STORAGE_KEY, snapshots.receipt),
  ].every(Boolean)
}

function writeVerified(storage: Storage, key: string, value: string): boolean {
  try {
    storage.setItem(key, value)
    return storage.getItem(key) === value
  } catch {
    return false
  }
}

function removeVerified(storage: Storage, key: string): boolean {
  try {
    storage.removeItem(key)
    return storage.getItem(key) === null
  } catch {
    return false
  }
}

function restoreVerified(storage: Storage, key: string, value: string | null): boolean {
  try {
    if (storage.getItem(key) === value) return true
    if (value === null) storage.removeItem(key)
    else storage.setItem(key, value)
    return storage.getItem(key) === value
  } catch {
    return false
  }
}

function parseActivationInput(value: ActivateAcceptedSuccessorInput): ActivateAcceptedSuccessorInput | null {
  if (!hasCanonicalJsonTree(value) || containsPrivateKey(value)) return null
  const parsed = activationInputSchema.safeParse(value)
  if (!parsed.success || !isCalendarDate(parsed.data.localDate)) return null
  if (parsed.data.localDate !== localCalendarDate(parsed.data.activatedAt)) return null
  if (Date.parse(parsed.data.activatedAt) > Date.now() + MAX_ACTIVATION_FUTURE_SKEW_MS) return null
  return parsed.data
}

function localCalendarDate(value: string): string {
  const date = new Date(value)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return parsed.toISOString().slice(0, 10) === value
}

function addCalendarDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function containsPrivateKey(value: unknown, seen = new Set<object>()): boolean {
  if (typeof value !== "object" || value === null) return false
  if (seen.has(value)) return false
  seen.add(value)
  return Object.entries(value).some(([key, child]) => (
    PRIVATE_KEY.test(key) || containsPrivateKey(child, seen)
  ))
}
