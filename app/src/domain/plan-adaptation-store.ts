import { z } from "zod"
import {
  canonicalJson,
  canonicalJsonSha256,
  verifyPlanAdaptationProposal,
} from "@impl/plan-generator/adaptation"
import { RVE_NON_SENSITIVE_REASON_CODES } from "@impl/rve/signal"
import {
  hasCanonicalArrayTree,
  parsePlanBetaState,
  planAdaptationEnvelopeSchema,
  planAdaptationProposalSchema,
  planBetaStateV2Schema,
} from "./plan-beta-schema"
import type {
  PendingNextFrameSuccessor,
  PlanAdaptationEnvelope,
  PlanBetaState,
  PlanBetaStateV2,
} from "./plan-beta-schema"

const ACTIVE_KEY = "trainoracle.plan-beta.v1"
const ADAPTATION_KEY = "trainoracle.plan-beta.adaptation.v1"
const PRIVATE_KEY = /(?:memo|note|symptom)/iu
const safetyReasonCodeSchema = z.enum(RVE_NON_SENSITIVE_REASON_CODES)

const passedSafetyGateSchema = z.object({
  kind: z.literal("passed"),
  action: z.literal("CONTINUE_WITH_OTHER_GATES"),
  planGenerationAllowed: z.literal(true),
  nonSensitiveReasonCodes: z.array(safetyReasonCodeSchema).readonly(),
  audit: z.object({ event: z.literal("PLAN_SAFETY_GATE_PASSED"), privacy: z.literal("REASON_CODES_ONLY") }).strict(),
}).strict()
const blockedSafetyGateSchema = z.object({
  kind: z.literal("blocked"),
  action: z.enum(["BLOCK", "BLOCK_OR_HUMAN_REVIEW"]),
  planGenerationAllowed: z.literal(false),
  requiredNextAction: z.enum(["HUMAN_REVIEW", "MORE_INFO_OR_HUMAN_REVIEW"]),
  nonSensitiveReasonCodes: z.array(safetyReasonCodeSchema).readonly(),
  audit: z.object({ event: z.literal("PLAN_SAFETY_GATE_BLOCKED"), privacy: z.literal("REASON_CODES_ONLY") }).strict(),
}).strict().superRefine((gate, context) => {
  const expected = gate.action === "BLOCK" ? "HUMAN_REVIEW" : "MORE_INFO_OR_HUMAN_REVIEW"
  if (gate.requiredNextAction !== expected) context.addIssue({ code: "custom", path: ["requiredNextAction"], message: "Safety action mismatch." })
})
const acceptanceRequestSchema = z.object({
  proposal: planAdaptationProposalSchema,
  predecessorState: planBetaStateV2Schema,
  successorState: planBetaStateV2Schema,
  actor: z.enum(["SELF", "COACH"]),
  safetyGate: z.union([passedSafetyGateSchema, blockedSafetyGateSchema]),
  safetyEvaluatedAt: z.string().datetime(),
  safetyValidUntil: z.string().datetime(),
  activeHold: z.boolean(),
  acceptedAt: z.string().datetime(),
  idempotencyKey: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
}).strict()
type AcceptanceRequest = z.infer<typeof acceptanceRequestSchema>

export type AdaptationAcceptanceResult =
  | { readonly kind: "accepted"; readonly pending: PendingNextFrameSuccessor; readonly replay: boolean }
  | { readonly kind: "blocked"; readonly code: "SAFETY_BLOCKED" | "STALE_SAFETY" | "ACTIVE_HOLD" }
  | { readonly kind: "rejected"; readonly code: "MALFORMED_INPUT" | "FORGED_PROPOSAL" | "UNAUTHORIZED" | "STALE_BASE" | "REPLAY_MISMATCH" | "SCOPE_MISMATCH" | "SUCCESSOR_MISMATCH" }
  | { readonly kind: "failed"; readonly code: "ADAPTATION_STORAGE_WRITE_FAILED"; readonly rollbackComplete: true }

export function hashPlanBetaState(state: PlanBetaState): Promise<string> {
  return canonicalJsonSha256("trainoracle.plan-beta-state.v1", state)
}

/**
 * INTERNAL LOCAL CONSISTENCY boundary. This validates device-local content and
 * SELF mode; it does not authenticate an account or coach. Product UI must enter
 * through acceptPreparedNextFrameAdaptation with evaluated safety and hold context.
 */
export async function acceptNextFrameProposal(candidate: unknown): Promise<AdaptationAcceptanceResult> {
  try {
    return await acceptNextFrameProposalUnchecked(candidate)
  } catch {
    return { kind: "rejected", code: "MALFORMED_INPUT" }
  }
}

/** Parsed implementation of the internal local-consistency boundary, not authorization. */
async function acceptNextFrameProposalUnchecked(candidate: unknown): Promise<AdaptationAcceptanceResult> {
  if (typeof window === "undefined"
      || containsPrivateKey(candidate)
      || !hasCanonicalArrayTree(candidate)) return { kind: "rejected", code: "MALFORMED_INPUT" }
  const parsed = acceptanceRequestSchema.safeParse(candidate)
  if (!parsed.success) return { kind: "rejected", code: "MALFORMED_INPUT" }
  const request = parsed.data
  if (!await verifyPlanAdaptationProposal(request.proposal)) return { kind: "rejected", code: "FORGED_PROPOSAL" }
  if (request.actor !== "SELF"
      || request.proposal.proposalOrigin !== "SELF_SERVICE"
      || request.proposal.selectionAuthority !== "SELF") {
    return { kind: "rejected", code: "UNAUTHORIZED" }
  }
  switch (request.safetyGate.kind) {
    case "blocked": return { kind: "blocked", code: "SAFETY_BLOCKED" }
    case "passed": break
  }
  if (!validSafetyTimes(request)) return { kind: "blocked", code: "STALE_SAFETY" }
  if (request.activeHold) return { kind: "blocked", code: "ACTIVE_HOLD" }

  const active = loadActiveState()
  if (active === null) return { kind: "rejected", code: "STALE_BASE" }
  const [activeHash, predecessorStateHash] = await Promise.all([hashPlanBetaState(active), hashPlanBetaState(request.predecessorState)])
  if (activeHash !== predecessorStateHash) return { kind: "rejected", code: "STALE_BASE" }
  if (!scopeMatches(request)) return { kind: "rejected", code: "SCOPE_MISMATCH" }
  if (!candidateMatchesActivePlan(request.proposal.baseCandidate, request.predecessorState.activePlan, request.predecessorState.activePlan.selectionActor)
      || !candidateMatchesActivePlan(request.proposal.successorCandidate, request.successorState.activePlan, request.actor)
      || request.successorState.progress.length !== 0) return { kind: "rejected", code: "SUCCESSOR_MISMATCH" }

  const requestHash = await canonicalJsonSha256("trainoracle.plan-adaptation-acceptance.v1", request)
  const existing = loadEnvelope()
  const sameFrame = existing !== null
    && existing.pending.baseCandidateId === request.proposal.baseCandidateId
    && existing.pending.predecessorStateHash === predecessorStateHash
  if (sameFrame) {
    if (existing.decision.idempotencyKey !== request.idempotencyKey) return { kind: "rejected", code: "STALE_BASE" }
    if (existing.decision.requestHash !== requestHash || existing.decision.proposalId !== request.proposal.proposalId) return { kind: "rejected", code: "REPLAY_MISMATCH" }
    return { kind: "accepted", pending: existing.pending, replay: true }
  }

  const decisionIdHash = await canonicalJsonSha256("trainoracle.plan-adaptation-decision.v1", { proposalId: request.proposal.proposalId, requestHash })
  const decisionId = `adaptation-decision:${decisionIdHash.slice("sha256:".length)}`
  const pending = {
    version: 1 as const,
    proposalId: request.proposal.proposalId,
    targetFrame: "NEXT_FRAME" as const,
    proposalOrigin: request.proposal.proposalOrigin,
    selectionAuthority: request.proposal.selectionAuthority,
    trigger: request.proposal.trigger,
    changeDimension: request.proposal.changeDimension,
    athleteId: request.proposal.athleteId,
    eventDistanceM: request.proposal.eventDistanceM,
    baseCandidateId: request.proposal.baseCandidateId,
    baseContentHash: request.proposal.baseContentHash,
    proposedContentHash: request.proposal.proposedContentHash,
    predecessorStateHash,
    successorState: request.successorState,
    acceptedAt: request.acceptedAt,
    decisionId,
    idempotencyKey: request.idempotencyKey,
    requestHash,
  }
  const envelope = planAdaptationEnvelopeSchema.safeParse({
    version: 1,
    pending,
    decision: { version: 1, decisionId, proposalId: request.proposal.proposalId, decision: "ACCEPT", predecessorStateHash, proposedContentHash: request.proposal.proposedContentHash, decidedAt: request.acceptedAt, idempotencyKey: request.idempotencyKey, requestHash },
  })
  if (!envelope.success) return { kind: "rejected", code: "MALFORMED_INPUT" }
  try {
    window.localStorage.setItem(ADAPTATION_KEY, JSON.stringify(envelope.data))
    return { kind: "accepted", pending: envelope.data.pending, replay: false }
  } catch (error) {
    if (error instanceof Error) return { kind: "failed", code: "ADAPTATION_STORAGE_WRITE_FAILED", rollbackComplete: true }
    throw error
  }
}

export function loadPendingNextFrameSuccessor(): PendingNextFrameSuccessor | null {
  return loadEnvelope()?.pending ?? null
}

function loadEnvelope(): PlanAdaptationEnvelope | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(ADAPTATION_KEY)
    if (raw === null) return null
    const json: unknown = JSON.parse(raw)
    const parsed = planAdaptationEnvelopeSchema.safeParse(json)
    return parsed.success ? parsed.data : null
  } catch (error) {
    if (error instanceof Error) return null
    throw error
  }
}

function loadActiveState(): PlanBetaStateV2 | null {
  try {
    const raw = window.localStorage.getItem(ACTIVE_KEY)
    if (raw === null) return null
    const json: unknown = JSON.parse(raw)
    return parsePlanBetaState(json)
  } catch (error) {
    if (error instanceof Error) return null
    throw error
  }
}

function validSafetyTimes(request: AcceptanceRequest): boolean {
  const accepted = Date.parse(request.acceptedAt)
  return Date.parse(request.safetyEvaluatedAt) <= accepted && accepted <= Date.parse(request.safetyValidUntil)
}

function scopeMatches(request: AcceptanceRequest): boolean {
  if (request.predecessorState.adaptationScope === undefined || request.successorState.adaptationScope === undefined) return false
  const expected = { athleteId: request.proposal.athleteId, eventDistanceM: request.proposal.eventDistanceM }
  return canonicalJson(request.predecessorState.adaptationScope) === canonicalJson(expected)
    && canonicalJson(request.successorState.adaptationScope) === canonicalJson(expected)
}

function candidateMatchesActivePlan(candidate: AcceptanceRequest["proposal"]["baseCandidate"], activePlan: PlanBetaStateV2["activePlan"], selectionActor: "SELF" | "COACH"): boolean {
  const expected = {
    kind: "BETA_ACTIVE_PLAN_SNAPSHOT",
    activationState: "SELECTED_BETA_SNAPSHOT",
    candidateId: candidate.candidateId,
    candidateKind: candidate.kind,
    eventDistanceM: candidate.eventDistanceM,
    selectionActor,
    sourceMode: candidate.sourceMode,
    selectedEnergyIntent: candidate.selectedEnergyIntent,
    frame: candidate.frame,
    sessions: candidate.sessions,
  }
  return canonicalJson(activePlan) === canonicalJson(expected)
}

function containsPrivateKey(value: unknown, seen = new Set<object>()): boolean {
  if (typeof value !== "object" || value === null) return false
  if (seen.has(value)) return false
  seen.add(value)
  return Object.entries(value).some(([key, child]) =>
    PRIVATE_KEY.test(key) || containsPrivateKey(child, seen),
  )
}
