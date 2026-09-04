import { assertNever } from "../shared/assert-never"
import { matchesPacePrescriptionSequence, type PaceSequenceSource } from "../prescription/pace-sequence"
import { parsePrescriptionNotation } from "../prescription/notation"
import { derivePrescriptionTotals } from "../prescription/totals"
import {
  continuityContextIdentity,
  continuityIdentityFromCandidateId,
  hasValidCandidateIdentity,
  pairIdHasBase,
  projectPlanCandidate,
} from "./candidate-identity"
import {
  ADAPTATION_SUCCESSOR_POLICY_VERSION,
  ADAPTATION_TRANSFORM_REGISTRY_FINGERPRINT,
  ADAPTATION_TRANSFORM_REGISTRY_VERSION,
  resolveRegisteredAdaptationTransform,
} from "./adaptation-transform-registry"
import type {
  AdaptationTransformDirection,
  AdaptationTransformEdgeId,
} from "./adaptation-transform-registry"
import { isRecord, parseSafetyGate } from "./input-values"
import type { SafetyGateDecision } from "../safety-gate/gate"
import type {
  DetailedTemplateRef,
  PlanCandidate,
  PlanEventGroup,
  PlanSelectionAuthority,
  PlanSession,
  SupportedPlanEventDistanceM,
} from "./types"

export const ADAPTATION_DIMENSIONS = ["INTENSITY", "VOLUME", "FREQUENCY"] as const
export type AdaptationDimension = (typeof ADAPTATION_DIMENSIONS)[number]
export type AdaptationProposalOrigin = "SELF_SERVICE" | "COACH_AUTHORED"
export type SupportedAdaptationEvent = SupportedPlanEventDistanceM

export type AdaptationTrigger =
  | { readonly kind: "EXPLICIT_REQUEST"; readonly requestedBy: "ATHLETE" | "COACH"; readonly sourceRef: string }
  | { readonly kind: "SAME_EVENT_PB_SB_AFTER_ACTIVE_PLAN_START"; readonly explicitlyConfirmed: true; readonly recordId: string; readonly purpose: "PERSONAL_BEST" | "SEASON_BEST"; readonly eventDistanceM: SupportedAdaptationEvent; readonly performanceSeconds: number; readonly achievedAt: string; readonly sourceRef: string; readonly historicalOrBackfilled: boolean }

export type PlanAdaptationProposalRequest = {
  readonly kind: "PLAN_ADAPTATION_PROPOSAL_REQUEST"
  readonly scope: {
    readonly athleteId: string
    readonly eventDistanceM: SupportedAdaptationEvent
    readonly pairId: string
    readonly selectedDetailedTemplateRef: DetailedTemplateRef | null
  }
  readonly activePlanStartedAt: string
  readonly baseCandidate: PlanCandidate
  readonly proposedCandidate: PlanCandidate
  readonly baseContentHash: string
  readonly proposalOrigin: AdaptationProposalOrigin
  readonly trigger: AdaptationTrigger
  readonly changeDimension: AdaptationDimension
  readonly safetyGate: SafetyGateDecision
  readonly safetyEvaluatedAt: string
  readonly safetyValidUntil: string
  readonly activeHold: boolean
  readonly createdAt: string
  readonly idempotencyKey: string
}

export type PlanAdaptationProposal = {
  readonly proposalId: string
  readonly proposalHash: string
  readonly targetFrame: "NEXT_FRAME"
  readonly athleteId: string
  readonly eventDistanceM: SupportedAdaptationEvent
  readonly pairId: string
  readonly selectedDetailedTemplateRef: DetailedTemplateRef | null
  readonly proposalOrigin: AdaptationProposalOrigin
  readonly selectionAuthority: PlanSelectionAuthority
  readonly trigger: AdaptationTrigger["kind"]
  readonly triggerSnapshot: AdaptationTrigger
  readonly triggerSnapshotHash: string
  readonly changeDimension: AdaptationDimension
  readonly transformRegistryVersion: typeof ADAPTATION_TRANSFORM_REGISTRY_VERSION
  readonly transformRegistryFingerprint: string
  readonly transformEdgeId: AdaptationTransformEdgeId
  readonly transformPolicyVersion: typeof ADAPTATION_SUCCESSOR_POLICY_VERSION
  readonly transformDirection: AdaptationTransformDirection
  readonly predecessorPairFingerprint: string
  readonly sourceCandidateId: string
  readonly sourceCandidateContentHash: string
  readonly allowedJsonPointers: readonly string[]
  readonly activePlanStartedAt: string
  readonly baseCandidateId: string
  readonly baseContentHash: string
  readonly proposedContentHash: string
  readonly approvedBeforeValueRef: string
  readonly approvedAfterValueRef: string
  readonly baseCandidate: PlanCandidate
  readonly successorCandidate: PlanCandidate
  readonly successorProvenanceHash: string
  readonly safetyGate: SafetyGateDecision
  readonly safetySnapshotHash: string
  readonly safetyEvaluatedAt: string
  readonly safetyValidUntil: string
  readonly activeHold: false
  readonly createdAt: string
  readonly evaluatedAt: string
  readonly expiresAt: string
  readonly edgeExpiresAt: null
  readonly edgeRevoked: false
  readonly idempotencyKey: string
}

export type PlanAdaptationProposalResult =
  | { readonly kind: "proposed"; readonly proposal: PlanAdaptationProposal }
  | { readonly kind: "blocked"; readonly code: "SAFETY_BLOCKED" | "STALE_SAFETY" | "ACTIVE_HOLD" }
  | { readonly kind: "rejected"; readonly code: "MALFORMED_INPUT" | "UNSUPPORTED_EVENT" | "CROSS_SCOPE_PROVENANCE" | "INELIGIBLE_TRIGGER" | "STALE_BASE" | "NO_OP" | "MULTIPLE_DIMENSIONS" | "DIMENSION_MISMATCH" | "UNAPPROVED_TRANSFORM" }

const REQUEST_KEYS = ["kind", "scope", "activePlanStartedAt", "baseCandidate", "proposedCandidate", "baseContentHash", "proposalOrigin", "trigger", "changeDimension", "safetyGate", "safetyEvaluatedAt", "safetyValidUntil", "activeHold", "createdAt", "idempotencyKey"] as const
const PROPOSAL_KEYS = ["proposalId", "proposalHash", "targetFrame", "athleteId", "eventDistanceM", "pairId", "selectedDetailedTemplateRef", "proposalOrigin", "selectionAuthority", "trigger", "triggerSnapshot", "triggerSnapshotHash", "changeDimension", "transformRegistryVersion", "transformRegistryFingerprint", "transformEdgeId", "transformPolicyVersion", "transformDirection", "predecessorPairFingerprint", "sourceCandidateId", "sourceCandidateContentHash", "allowedJsonPointers", "activePlanStartedAt", "baseCandidateId", "baseContentHash", "proposedContentHash", "approvedBeforeValueRef", "approvedAfterValueRef", "baseCandidate", "successorCandidate", "successorProvenanceHash", "safetyGate", "safetySnapshotHash", "safetyEvaluatedAt", "safetyValidUntil", "activeHold", "createdAt", "evaluatedAt", "expiresAt", "edgeExpiresAt", "edgeRevoked", "idempotencyKey"] as const
const CANDIDATE_KEYS = ["candidateId", "pairId", "kind", "eventGroup", "eventDistanceM", "selectedDetailedTemplateRef", "selectedEnergyIntent", "sourceMode", "confidence", "beta", "detailedPrescriptionFingerprint", "continuityContext", "selectionAuthority", "frame", "mainExposureLedger", "rationaleCodes", "sessions"] as const
const PRIVATE_KEY = /(?:memo|note|symptom)/iu
const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/u
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u
const CURRENT_ELAPSED_LABELS = new Set(
  Array.from({ length: 19 }, (_, months) => formatElapsedMonths(months)),
)
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu
const OPAQUE_RECORD_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u
const EXPOSURE_ID_PATTERN = /^(?:app-main-day-(?:[1-9]|10)|fixture-main-[1-3])$/u
const CANDIDATE_ID_PATTERN = /^beta:(?:balanced|conservative):(?:middle_distance|five_k|ten_k|general_endurance):event-(?:800|1500|3000|5000|10000|21097|42195):(?:new_to_running|developing|experienced):(?:recovery_intent|base_intent|lt_intent|vo2_intent|gly_intent|atp_pc_intent|mixed_intent):(?:single_session_only|recovery_pm_allowed):(?:morning|evening|varies):projection-(?:7|9|9\.5|10):local-civil-9-5:[a-z0-9-]+:\d+(?:-\d+)*:(?:no_usable_journal|recent_journal_context):(?:no-continuity|(?:balanced|conservative):(?:completed|rested|skipped|pain_checkin)-\d+(?:-(?:completed|rested|skipped|pain_checkin)-\d+)*):template-(?:rpe-only|[a-z0-9-]+\.\d+\.\d+\.\d+\.[a-f0-9]{64}):candidate-sha256-[a-f0-9]{64}$/u
const PLAN_BETA_CODES = new Set([
  "PROFILE_ONLY_LIMITED_CONTEXT", "RECENT_JOURNAL_CONTEXT_PRESENT", "BETA_DURATION_RPE_ONLY",
  "PACE_TARGET_BOUND", "BETA_NON_UNIVERSAL_FORMATION_SCOPE", "PREVIOUS_FRAME_CONTEXT_RETAINED",
  "SAFETY_GATE_ACTIVE", "SAFETY_GATE_UNKNOWN", "MALFORMED_INPUT", "UNSUPPORTED_FRAME_LENGTH",
  "INSUFFICIENT_AVAILABLE_DAYS", "INVALID_AVAILABLE_DAY", "INVALID_JOURNAL_CONTEXT",
  "INVALID_CONTINUITY_CONTEXT", "NON_CANONICAL_FRAME_REQUIRES_REVIEW",
  "CANONICAL_LEDGER_REQUIRES_VALIDATION", "NEEDS_COACH_CLARIFICATION",
  "INVALID_COMPOSITE_RELATION_REQUIRES_REVIEW", "COMPETITION_DAY_COLLISION_REQUIRES_COACH_CLARIFICATION",
  "MAIN_EXPOSURE_COUNT_REQUIRES_REVIEW", "MAIN_EXPOSURE_OUTSIDE_AVAILABILITY_REQUIRES_REVIEW",
  "COACH_SELECTION_REQUIRED", "CANDIDATE_NOT_FOUND", "INVALID_SELECTION_REQUEST",
  "NON_SELECTABLE_PLAN_RESULT", "STALE_CANDIDATE_FINGERPRINT", "NONCANONICAL_CANDIDATE_FRAME",
  "SAFETY_GATE_RECHECK_BLOCKED", "SESSION_DAY_NOT_IN_ACTIVE_PLAN", "SESSION_SLOT_NOT_IN_ACTIVE_PLAN",
])

export function canonicalJson(value: unknown): string {
  if (!isCanonicalJsonTree(value)) {
    throw new TypeError("Canonical JSON supports plain JSON values only")
  }
  return canonicalJsonValue(value, new Set<object>())
}

function canonicalJsonValue(value: unknown, ancestors: Set<object>): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value)
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new RangeError("Canonical JSON requires finite numbers")
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    if (!isDenseArray(value)) throw new TypeError("Canonical JSON rejects sparse arrays")
    if (ancestors.has(value)) throw new TypeError("Canonical JSON rejects cyclic input")
    ancestors.add(value)
    const result = `[${value.map((item) => canonicalJsonValue(item, ancestors)).join(",")}]`
    ancestors.delete(value)
    return result
  }
  if (isRecord(value)) {
    if (ancestors.has(value)) throw new TypeError("Canonical JSON rejects cyclic input")
    ancestors.add(value)
    const entries = Object.keys(value).filter((key) => value[key] !== undefined).sort()
    const result = `{${entries.map((key) => `${JSON.stringify(key)}:${canonicalJsonValue(value[key], ancestors)}`).join(",")}}`
    ancestors.delete(value)
    return result
  }
  throw new TypeError("Canonical JSON supports JSON values only")
}

export async function canonicalJsonSha256(domain: string, value: unknown): Promise<string> {
  const runtime = globalThis as unknown as {
    TextEncoder: new () => { encode(input: string): Uint8Array }
    crypto: { subtle: { digest(algorithm: string, data: Uint8Array): Promise<ArrayBuffer> } }
  }
  const bytes = new runtime.TextEncoder().encode(`${domain}\0${canonicalJson(value)}`)
  const digest = await runtime.crypto.subtle.digest("SHA-256", bytes)
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
  return `sha256:${hex}`
}

export function hashPlanCandidate(candidate: PlanCandidate): Promise<string> {
  return canonicalJsonSha256("trainoracle.plan-candidate.v1", candidate)
}

export async function verifyPlanAdaptationProposal(proposal: unknown): Promise<boolean> {
  try {
  if (!isCanonicalJsonTree(proposal)) return false
  if (!isRecord(proposal) || !hasExactKeys(proposal, PROPOSAL_KEYS)) return false
  const baseCandidate = parsePlanCandidate(proposal["baseCandidate"])
  const successorCandidate = parsePlanCandidate(proposal["successorCandidate"])
  const triggerSnapshot = parseTrigger(proposal["triggerSnapshot"])
  const safetyGate = parseSafetyGate(proposal["safetyGate"]) ?? null
  if (baseCandidate === null || successorCandidate === null || triggerSnapshot === null || safetyGate === null) return false
  const { proposalId, proposalHash, ...content } = proposal
  const expectedProposalHash = await canonicalJsonSha256("trainoracle.plan-adaptation-proposal.v1", content)
  const transform = resolveRegisteredAdaptationTransform(baseCandidate, successorCandidate, triggerSnapshot.kind)
  if (transform === null) return false
  const [baseHash, proposedHash, triggerSnapshotHash, safetySnapshotHash] = await Promise.all([
    hashPlanCandidate(baseCandidate),
    hashPlanCandidate(successorCandidate),
    canonicalJsonSha256("trainoracle.plan-adaptation-trigger-snapshot.v1", triggerSnapshot),
    canonicalJsonSha256("trainoracle.plan-adaptation-safety-snapshot.v1", {
      safetyGate,
      activeHold: proposal["activeHold"],
    }),
  ])
  const successorProvenanceHash = await hashSuccessorProvenance({
    pairId: baseCandidate.pairId,
    edgeId: transform.edge.edgeId,
    sourceCandidateId: baseCandidate.candidateId,
    sourceCandidateContentHash: baseHash,
    successorCandidateId: successorCandidate.candidateId,
    successorContentHash: proposedHash,
  })
  return proposalHash === expectedProposalHash
    && proposalId === `adaptation:${expectedProposalHash.slice("sha256:".length)}`
    && isAthleteId(proposal["athleteId"])
    && typeof proposal["idempotencyKey"] === "string" && SHA256_PATTERN.test(proposal["idempotencyKey"])
    && isIsoTimestamp(proposal["createdAt"])
    && proposal["baseCandidateId"] === baseCandidate.candidateId
    && proposal["sourceCandidateId"] === baseCandidate.candidateId
    && proposal["sourceCandidateContentHash"] === baseHash
    && proposal["baseContentHash"] === baseHash && proposal["proposedContentHash"] === proposedHash
    && proposal["approvedBeforeValueRef"] === baseHash && proposal["approvedAfterValueRef"] === proposedHash
    && proposal["pairId"] === baseCandidate.pairId
    && proposal["pairId"] === successorCandidate.pairId
    && proposal["selectionAuthority"] === baseCandidate.selectionAuthority
    && proposal["selectionAuthority"] === successorCandidate.selectionAuthority
    && canonicalJson(proposal["selectedDetailedTemplateRef"]) === canonicalJson(baseCandidate.selectedDetailedTemplateRef)
    && canonicalJson(proposal["selectedDetailedTemplateRef"]) === canonicalJson(successorCandidate.selectedDetailedTemplateRef)
    && candidateEligibleForExactEvent(proposal["eventDistanceM"], baseCandidate)
    && candidateEligibleForExactEvent(proposal["eventDistanceM"], successorCandidate)
    && proposal["trigger"] === triggerSnapshot.kind
    && proposal["triggerSnapshotHash"] === triggerSnapshotHash
    && isIsoTimestamp(proposal["activePlanStartedAt"])
    && triggerAllowedValues(proposal["proposalOrigin"], proposal["athleteId"], proposal["eventDistanceM"], proposal["activePlanStartedAt"], triggerSnapshot)
    && proposal["transformRegistryVersion"] === ADAPTATION_TRANSFORM_REGISTRY_VERSION
    && proposal["transformRegistryFingerprint"] === ADAPTATION_TRANSFORM_REGISTRY_FINGERPRINT
    && proposal["transformEdgeId"] === transform.edge.edgeId
    && proposal["transformPolicyVersion"] === transform.edge.successorPolicyVersion
    && proposal["transformDirection"] === transform.edge.direction
    && proposal["predecessorPairFingerprint"] === baseCandidate.pairId
    && canonicalJson(proposal["allowedJsonPointers"]) === canonicalJson(transform.allowedJsonPointers)
    && proposal["successorProvenanceHash"] === successorProvenanceHash
    && proposal["safetySnapshotHash"] === safetySnapshotHash
    && safetyGate.kind === "passed"
    && isIsoTimestamp(proposal["safetyEvaluatedAt"])
    && isIsoTimestamp(proposal["safetyValidUntil"])
    && Date.parse(proposal["safetyEvaluatedAt"]) <= Date.parse(proposal["createdAt"])
    && Date.parse(proposal["createdAt"]) <= Date.parse(proposal["safetyValidUntil"])
    && proposal["activeHold"] === false
    && proposal["evaluatedAt"] === proposal["createdAt"]
    && isIsoTimestamp(proposal["createdAt"])
    && proposal["expiresAt"] === proposalExpiry(proposal["createdAt"])
    && proposal["edgeExpiresAt"] === transform.edge.expiresAt
    && proposal["edgeRevoked"] === transform.edge.revoked
    && proposal["changeDimension"] === "VOLUME"
    && (proposal["proposalOrigin"] === "SELF_SERVICE" || proposal["proposalOrigin"] === "COACH_AUTHORED")
    && proposal["selectionAuthority"] === authorityFor(proposal["proposalOrigin"])
  } catch {
    return false
  }
}

export async function createPlanAdaptationProposal(candidate: unknown): Promise<PlanAdaptationProposalResult> {
  try {
    if (!isCanonicalJsonTree(candidate)) return { kind: "rejected", code: "MALFORMED_INPUT" }
    return await createPlanAdaptationProposalUnchecked(candidate)
  } catch {
    return { kind: "rejected", code: "MALFORMED_INPUT" }
  }
}

async function createPlanAdaptationProposalUnchecked(candidate: unknown): Promise<PlanAdaptationProposalResult> {
  if (hasUnsupportedNumericEvent(candidate)) return { kind: "rejected", code: "UNSUPPORTED_EVENT" }
  const request = parseAdaptationRequest(candidate)
  if (request === null || containsPrivateKey(candidate)) return { kind: "rejected", code: "MALFORMED_INPUT" }
  const candidateEventDistanceM = request.baseCandidate.eventDistanceM
  if (candidateEventDistanceM === null
      || candidateEventDistanceM !== request.proposedCandidate.eventDistanceM
      || candidateEventDistanceM !== request.scope.eventDistanceM
      || request.baseCandidate.pairId !== request.proposedCandidate.pairId
      || request.baseCandidate.pairId !== request.scope.pairId
      || canonicalJson(request.baseCandidate.selectedDetailedTemplateRef) !== canonicalJson(request.scope.selectedDetailedTemplateRef)
      || canonicalJson(request.proposedCandidate.selectedDetailedTemplateRef) !== canonicalJson(request.scope.selectedDetailedTemplateRef)
      || request.baseCandidate.selectionAuthority !== authorityFor(request.proposalOrigin)
      || request.proposedCandidate.selectionAuthority !== authorityFor(request.proposalOrigin)
      || !candidateEligibleForExactEvent(candidateEventDistanceM, request.baseCandidate)
      || !candidateEligibleForExactEvent(request.scope.eventDistanceM, request.proposedCandidate)) return { kind: "rejected", code: "CROSS_SCOPE_PROVENANCE" }
  if (!triggerAllowed(request)) return { kind: "rejected", code: "INELIGIBLE_TRIGGER" }
  switch (request.safetyGate.kind) {
    case "blocked": return { kind: "blocked", code: "SAFETY_BLOCKED" }
    case "passed": break
    default: return assertNever(request.safetyGate)
  }
  if (Date.parse(request.createdAt) > Date.parse(request.safetyValidUntil) || Date.parse(request.safetyEvaluatedAt) > Date.parse(request.createdAt)) return { kind: "blocked", code: "STALE_SAFETY" }
  if (request.activeHold) return { kind: "blocked", code: "ACTIVE_HOLD" }
  const baseContentHash = await hashPlanCandidate(request.baseCandidate)
  if (baseContentHash !== request.baseContentHash) return { kind: "rejected", code: "STALE_BASE" }
  const dimensions = changedDimensions(request.baseCandidate, request.proposedCandidate)
  if (dimensions.length === 0) return { kind: "rejected", code: "NO_OP" }
  if (dimensions.length > 1) return { kind: "rejected", code: "MULTIPLE_DIMENSIONS" }
  if (dimensions[0] !== request.changeDimension) return { kind: "rejected", code: "DIMENSION_MISMATCH" }
  const transform = request.changeDimension === "VOLUME"
    ? resolveRegisteredAdaptationTransform(request.baseCandidate, request.proposedCandidate, request.trigger.kind)
    : null
  if (transform === null) return { kind: "rejected", code: "UNAPPROVED_TRANSFORM" }
  const proposedContentHash = await hashPlanCandidate(request.proposedCandidate)
  const [triggerSnapshotHash, safetySnapshotHash] = await Promise.all([
    canonicalJsonSha256("trainoracle.plan-adaptation-trigger-snapshot.v1", request.trigger),
    canonicalJsonSha256("trainoracle.plan-adaptation-safety-snapshot.v1", {
      safetyGate: request.safetyGate,
      activeHold: request.activeHold,
    }),
  ])
  const successorProvenanceHash = await hashSuccessorProvenance({
    pairId: request.scope.pairId,
    edgeId: transform.edge.edgeId,
    sourceCandidateId: request.baseCandidate.candidateId,
    sourceCandidateContentHash: baseContentHash,
    successorCandidateId: request.proposedCandidate.candidateId,
    successorContentHash: proposedContentHash,
  })
  const content = {
    targetFrame: "NEXT_FRAME" as const, athleteId: request.scope.athleteId, eventDistanceM: candidateEventDistanceM,
    pairId: request.scope.pairId, selectedDetailedTemplateRef: request.scope.selectedDetailedTemplateRef,
    proposalOrigin: request.proposalOrigin, selectionAuthority: authorityFor(request.proposalOrigin), trigger: request.trigger.kind,
    triggerSnapshot: request.trigger, triggerSnapshotHash, changeDimension: request.changeDimension,
    transformRegistryVersion: ADAPTATION_TRANSFORM_REGISTRY_VERSION,
    transformRegistryFingerprint: ADAPTATION_TRANSFORM_REGISTRY_FINGERPRINT,
    transformEdgeId: transform.edge.edgeId, transformPolicyVersion: transform.edge.successorPolicyVersion,
    transformDirection: transform.edge.direction, predecessorPairFingerprint: request.scope.pairId,
    sourceCandidateId: request.baseCandidate.candidateId, sourceCandidateContentHash: baseContentHash,
    allowedJsonPointers: transform.allowedJsonPointers, activePlanStartedAt: request.activePlanStartedAt,
    baseCandidateId: request.baseCandidate.candidateId, baseContentHash, proposedContentHash,
    approvedBeforeValueRef: baseContentHash, approvedAfterValueRef: proposedContentHash, baseCandidate: request.baseCandidate,
    successorCandidate: request.proposedCandidate, successorProvenanceHash,
    safetyGate: request.safetyGate, safetySnapshotHash,
    safetyEvaluatedAt: request.safetyEvaluatedAt, safetyValidUntil: request.safetyValidUntil,
    activeHold: false as const, createdAt: request.createdAt, evaluatedAt: request.createdAt,
    expiresAt: proposalExpiry(request.createdAt), edgeExpiresAt: transform.edge.expiresAt,
    edgeRevoked: transform.edge.revoked, idempotencyKey: request.idempotencyKey,
  } as const
  const proposalHash = await canonicalJsonSha256("trainoracle.plan-adaptation-proposal.v1", content)
  return { kind: "proposed", proposal: Object.freeze({ proposalId: `adaptation:${proposalHash.slice("sha256:".length)}`, proposalHash, ...content }) }
}

function parseAdaptationRequest(value: unknown): PlanAdaptationProposalRequest | null {
  if (!isRecord(value) || !hasExactKeys(value, REQUEST_KEYS) || value["kind"] !== "PLAN_ADAPTATION_PROPOSAL_REQUEST") return null
  const scope = value["scope"]
  const trigger = parseTrigger(value["trigger"])
  const safetyGate = parseSafetyGate(value["safetyGate"]) ?? null
  if (!isRecord(scope) || !hasExactKeys(scope, ["athleteId", "eventDistanceM", "pairId", "selectedDetailedTemplateRef"]) || !isAthleteId(scope["athleteId"])) return null
  const eventDistanceM = parseSupportedEvent(scope["eventDistanceM"])
  const baseCandidate = parsePlanCandidate(value["baseCandidate"])
  const proposedCandidate = parsePlanCandidate(value["proposedCandidate"])
  const proposalOrigin = value["proposalOrigin"]
  const changeDimension = value["changeDimension"]
  const selectedDetailedTemplateRef = scope["selectedDetailedTemplateRef"]
  if (eventDistanceM === null || baseCandidate === null || proposedCandidate === null || trigger === null || safetyGate === null
      || typeof scope["pairId"] !== "string" || !scope["pairId"].startsWith("plan-pair:v3:")
      || !isDetailedTemplateRef(selectedDetailedTemplateRef)
      || (proposalOrigin !== "SELF_SERVICE" && proposalOrigin !== "COACH_AUTHORED")
      || (changeDimension !== "INTENSITY" && changeDimension !== "VOLUME" && changeDimension !== "FREQUENCY")
      || typeof value["baseContentHash"] !== "string" || !SHA256_PATTERN.test(value["baseContentHash"])
      || typeof value["activeHold"] !== "boolean" || typeof value["idempotencyKey"] !== "string" || !SHA256_PATTERN.test(value["idempotencyKey"])) return null
  const activePlanStartedAt = value["activePlanStartedAt"]
  const safetyEvaluatedAt = value["safetyEvaluatedAt"]
  const safetyValidUntil = value["safetyValidUntil"]
  const createdAt = value["createdAt"]
  if (!isIsoTimestamp(activePlanStartedAt) || !isIsoTimestamp(safetyEvaluatedAt) || !isIsoTimestamp(safetyValidUntil) || !isIsoTimestamp(createdAt)) return null
  if (!candidateAnchorLabelsMatch(baseCandidate, createdAt) || !candidateAnchorLabelsMatch(proposedCandidate, createdAt)) return null
  return { kind: "PLAN_ADAPTATION_PROPOSAL_REQUEST", scope: { athleteId: scope["athleteId"], eventDistanceM, pairId: scope["pairId"], selectedDetailedTemplateRef }, activePlanStartedAt, baseCandidate, proposedCandidate, baseContentHash: value["baseContentHash"], proposalOrigin, trigger, changeDimension, safetyGate, safetyEvaluatedAt, safetyValidUntil, activeHold: value["activeHold"], createdAt, idempotencyKey: value["idempotencyKey"] }
}

function parseTrigger(value: unknown): AdaptationTrigger | null {
  if (!isRecord(value)) return null
  switch (value["kind"]) {
    case "EXPLICIT_REQUEST":
      return hasExactKeys(value, ["kind", "requestedBy", "sourceRef"]) && (value["requestedBy"] === "ATHLETE" || value["requestedBy"] === "COACH") && isExplicitRequestSource(value["sourceRef"])
        ? { kind: "EXPLICIT_REQUEST", requestedBy: value["requestedBy"], sourceRef: value["sourceRef"] } : null
    case "SAME_EVENT_PB_SB_AFTER_ACTIVE_PLAN_START": {
      const eventDistanceM = parseSupportedEvent(value["eventDistanceM"])
      if (!hasExactKeys(value, ["kind", "explicitlyConfirmed", "recordId", "purpose", "eventDistanceM", "performanceSeconds", "achievedAt", "sourceRef", "historicalOrBackfilled"])
          || value["explicitlyConfirmed"] !== true || typeof value["historicalOrBackfilled"] !== "boolean" || eventDistanceM === null
          || !isRecordId(value["recordId"]) || (value["purpose"] !== "PERSONAL_BEST" && value["purpose"] !== "SEASON_BEST")
          || typeof value["performanceSeconds"] !== "number" || !Number.isFinite(value["performanceSeconds"]) || value["performanceSeconds"] <= 0
          || !isIsoTimestamp(value["achievedAt"]) || value["sourceRef"] !== `athlete-record:${value["recordId"]}`) return null
      return { kind: "SAME_EVENT_PB_SB_AFTER_ACTIVE_PLAN_START", explicitlyConfirmed: true, recordId: value["recordId"], purpose: value["purpose"], eventDistanceM, performanceSeconds: value["performanceSeconds"], achievedAt: value["achievedAt"], sourceRef: value["sourceRef"], historicalOrBackfilled: value["historicalOrBackfilled"] }
    }
    default: return null
  }
}

function parsePlanCandidate(value: unknown): PlanCandidate | null {
  if (!isPlanCandidate(value)) return null
  return value
}

export function isVerifiedPlanCandidate(value: unknown): value is PlanCandidate {
  return isCanonicalJsonTree(value) && isPlanCandidate(value)
}

function isPlanCandidate(value: unknown): value is PlanCandidate {
  const continuityContext = isRecord(value) ? value["continuityContext"] : undefined
  const selectedEnergyIntent = isRecord(value) ? value["selectedEnergyIntent"] : undefined
  if (!isRecord(value) || !hasExactKeys(value, CANDIDATE_KEYS) || !Array.isArray(value["sessions"])
      || !isDenseArray(value["sessions"]) || !value["sessions"].every(isPlanSession)
      || (value["kind"] !== "BALANCED" && value["kind"] !== "CONSERVATIVE")
      || !isPlanEventGroup(value["eventGroup"])
      || parseSupportedEvent(value["eventDistanceM"]) === null
      || typeof value["pairId"] !== "string" || !value["pairId"].startsWith("plan-pair:v3:")
      || !isDetailedTemplateRef(value["selectedDetailedTemplateRef"])
      || !isPlannedEnergyIntent(selectedEnergyIntent)
      || (value["sourceMode"] !== "PROFILE_ONLY" && value["sourceMode"] !== "JOURNAL_CONTEXT_ONLY")
      || value["confidence"] !== "LIMITED" || !isCandidateBeta(value["beta"])
      || !isContinuityContext(continuityContext)
      || (value["selectionAuthority"] !== "SELF" && value["selectionAuthority"] !== "COACH_REQUIRED")
      || !isCandidateFrame(value["frame"]) || !isExposureLedger(value["mainExposureLedger"])
      || !Array.isArray(value["rationaleCodes"]) || !isDenseArray(value["rationaleCodes"])
      || !value["rationaleCodes"].every((code) => typeof code === "string" && PLAN_BETA_CODES.has(code))
      || !hasValidSessionLayout(value["sessions"])) return false
  const detailedFingerprints = value["sessions"].flatMap((session) => (
    session.prescription.kind === "PACE_TARGET"
      ? [session.prescription.prescriptionFingerprint]
      : []
  ))
  const expectedDetailedFingerprint = detailedFingerprints.length === 1
    ? detailedFingerprints[0]
    : null
  if (detailedFingerprints.length > 1
      || value["detailedPrescriptionFingerprint"] !== expectedDetailedFingerprint
      || !isCandidateId(value["candidateId"], expectedDetailedFingerprint)
      || !isRecord(value["beta"])
      || value["beta"]["prescriptionBasis"] !== (expectedDetailedFingerprint === null
        ? "DURATION_RPE_ONLY"
        : "ONE_TRUSTED_DETAILED_SESSION")) return false
  const eventIdentity = `:event-${value["eventDistanceM"] ?? "unbound"}:`
  const ledger = value["mainExposureLedger"]
  if (!isExposureLedger(ledger)) return false
  const exposureIdentity = `:${ledger.countedExposureIds.join("-")}:`
  const reference = value["selectedDetailedTemplateRef"]
  const templateIdentity = reference === null
    ? "rpe-only"
    : `${reference.templateId.toLowerCase()}.${reference.version}.${reference.fingerprint.slice("sha256:".length)}`
  const baseCandidateId = value["candidateId"].split(":pace-target:")[0]
  const candidateSegments = baseCandidateId?.split(":") ?? []
  const expectedContinuityIdentity = continuityContextIdentity(continuityContext)
  const expectedPairId = [
    "plan-pair", "v3", value["eventDistanceM"], templateIdentity,
    selectedEnergyIntent.toLowerCase(), candidateSegments[10], candidateSegments[11],
    expectedContinuityIdentity,
  ].join(":")
  const expectedDetailedIntent = value["eventDistanceM"] === 800
    ? "GLY_INTENT"
    : value["eventDistanceM"] === 1500
      ? "MIXED_INTENT"
      : "VO2_INTENT"
  return value["candidateId"].includes(eventIdentity)
    && value["candidateId"].includes(exposureIdentity)
    && value["candidateId"].includes(`:template-${templateIdentity}`)
    && continuityIdentityFromCandidateId(value["candidateId"]) === expectedContinuityIdentity
    && pairIdHasBase(value["pairId"], expectedPairId)
    && hasValidCandidateIdentity(value["candidateId"], projectPlanCandidate(value as PlanCandidate))
    && (reference === null || selectedEnergyIntent === expectedDetailedIntent)
    && value["sessions"].every((session) => session.prescription.kind !== "PACE_TARGET"
    || (session.prescription.scope.eventGroup === value["eventGroup"]
      && reference !== null
      && session.prescription.templateId === reference.templateId
      && session.prescription.templateVersion === reference.version
      && session.prescription.templateContentFingerprint === reference.fingerprint))
}

function isDetailedTemplateRef(value: unknown): value is DetailedTemplateRef | null {
  return value === null || (isRecord(value)
    && hasExactKeys(value, ["templateId", "version", "fingerprint"])
    && typeof value["templateId"] === "string" && /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/u.test(value["templateId"])
    && typeof value["version"] === "string" && /^\d+\.\d+\.\d+$/u.test(value["version"])
    && typeof value["fingerprint"] === "string" && SHA256_PATTERN.test(value["fingerprint"]))
}

function isPlanSession(value: unknown): value is PlanSession {
  if (!isRecord(value) || typeof value["day"] !== "number" || !Number.isInteger(value["day"]) || value["day"] <= 0 || (value["slot"] !== "AM" && value["slot"] !== "PM") || !isRecord(value["prescription"])) return false
  switch (value["role"]) {
    case "REST": return hasExactKeys(value, ["day", "slot", "role", "plannedEnergyIntent", "prescription"]) && value["slot"] === "AM" && value["plannedEnergyIntent"] === "RECOVERY_INTENT" && hasExactKeys(value["prescription"], ["kind"]) && value["prescription"]["kind"] === "REST"
    case "EASY": return (value["plannedEnergyIntent"] === "RECOVERY_INTENT" || value["plannedEnergyIntent"] === "BASE_INTENT") && hasRpePrescription(value)
    case "QUALITY": return isQualityEnergyIntent(value["plannedEnergyIntent"])
      && (value["prescription"]["kind"] === "PACE_TARGET" ? isPaceTargetPrescription(value["prescription"]) : hasRpePrescription(value))
    default: return false
  }
}

function hasRpePrescription(session: Record<string, unknown>): boolean {
  const prescription = session["prescription"]
  if (!hasExactKeys(session, ["day", "slot", "role", "plannedEnergyIntent", "prescription"]) || !isRecord(prescription) || !hasExactKeys(prescription, ["kind", "rpe", "durationMinutes"]) || prescription["kind"] !== "RPE_TIME_RANGE") return false
  return isBoundedRange(prescription["rpe"], 1, 10)
    && isBoundedRange(prescription["durationMinutes"], Number.MIN_VALUE, Number.POSITIVE_INFINITY)
}

function isFiniteRange(value: unknown): boolean {
  return isRecord(value) && hasExactKeys(value, ["minimum", "maximum"]) && typeof value["minimum"] === "number" && Number.isFinite(value["minimum"]) && typeof value["maximum"] === "number" && Number.isFinite(value["maximum"]) && value["minimum"] <= value["maximum"]
}

function isBoundedRange(value: unknown, minimum: number, maximum: number): boolean {
  return isFiniteRange(value) && isRecord(value)
    && typeof value["minimum"] === "number" && value["minimum"] >= minimum
    && typeof value["maximum"] === "number" && value["maximum"] <= maximum
}

function isCandidateBeta(value: unknown): boolean {
  return isRecord(value) && hasExactKeys(value, ["designation", "prescriptionBasis", "formationMethodClaim"])
    && value["designation"] === "BETA" && (value["prescriptionBasis"] === "DURATION_RPE_ONLY" || value["prescriptionBasis"] === "ONE_TRUSTED_DETAILED_SESSION")
    && value["formationMethodClaim"] === "NOT_UNIVERSAL"
}

function isContinuityContext(value: unknown): value is PlanCandidate["continuityContext"] {
  if (!isRecord(value)) return false
  if (value["kind"] === "NO_PREVIOUS_FRAME_CONTEXT") return hasExactKeys(value, ["kind"])
  return value["kind"] === "PREVIOUS_FRAME_CONTEXT_RETAINED"
    && hasExactKeys(value, ["kind", "previousCandidateKind", "progressStateCounts"])
    && (value["previousCandidateKind"] === "BALANCED" || value["previousCandidateKind"] === "CONSERVATIVE")
    && Array.isArray(value["progressStateCounts"])
    && isDenseArray(value["progressStateCounts"])
    && value["progressStateCounts"].every((item) => isRecord(item) && hasExactKeys(item, ["state", "count"])
      && (item["state"] === "COMPLETED" || item["state"] === "RESTED" || item["state"] === "SKIPPED" || item["state"] === "PAIN_CHECKIN")
      && typeof item["count"] === "number" && Number.isInteger(item["count"]) && item["count"] >= 0)
}

function isCandidateFrame(value: unknown): boolean {
  if (!isRecord(value) || !hasExactKeys(value, value["projectionLengthDays"] === undefined
    ? ["formationKind", "lengthDays", "slotCount", "continuity"]
    : ["formationKind", "lengthDays", "slotCount", "projectionLengthDays", "continuity"])) return false
  const continuity = value["continuity"]
  return value["formationKind"] === "LOCAL_CIVIL_9_5" && value["lengthDays"] === 9.5 && value["slotCount"] === 19
    && (value["projectionLengthDays"] === undefined || value["projectionLengthDays"] === 7 || value["projectionLengthDays"] === 9 || value["projectionLengthDays"] === 9.5 || value["projectionLengthDays"] === 10)
    && isRecord(continuity)
    && ((continuity["kind"] === "STANDARD_FRAME" && hasExactKeys(continuity, ["kind"]))
      || (continuity["kind"] === "SEVEN_DAY_CONTINUITY" && continuity["nextFrameInput"] === "SELECTED_PLAN_AND_PROGRESS" && hasExactKeys(continuity, ["kind", "nextFrameInput"])))
}

function isExposureLedger(value: unknown): value is PlanCandidate["mainExposureLedger"] {
  return isRecord(value) && hasExactKeys(value, ["mainExposureCount", "fingerprint", "countedExposureIds"])
    && (value["mainExposureCount"] === 2 || value["mainExposureCount"] === 3)
    && typeof value["fingerprint"] === "string" && Array.isArray(value["countedExposureIds"])
    && isDenseArray(value["countedExposureIds"])
    && value["countedExposureIds"].length === value["mainExposureCount"]
    && value["countedExposureIds"].every(isExposureId)
    && value["fingerprint"] === value["countedExposureIds"].join(":")
}

function isDenseArray(value: readonly unknown[]): boolean {
  if (Object.getPrototypeOf(value) !== Array.prototype) return false
  const keys = Reflect.ownKeys(value)
  if (keys.length !== value.length + 1 || keys[value.length] !== "length") return false
  for (let index = 0; index < value.length; index += 1) {
    if (keys[index] !== String(index)) return false
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index))
    if (descriptor?.enumerable !== true || !("value" in descriptor)) return false
  }
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length")
  return lengthDescriptor !== undefined
    && "value" in lengthDescriptor
    && lengthDescriptor.value === value.length
    && lengthDescriptor.enumerable === false
}

function isCanonicalJsonTree(
  value: unknown,
  ancestors = new Set<object>(),
): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true
  if (typeof value === "number") return Number.isFinite(value)
  if (typeof value !== "object" || ancestors.has(value)) return false

  const prototype = Object.getPrototypeOf(value)
  if (Array.isArray(value)) {
    if (prototype !== Array.prototype || !isDenseArray(value)) return false
  } else if (prototype !== Object.prototype && prototype !== null) {
    return false
  }

  ancestors.add(value)
  const keys = Reflect.ownKeys(value)
  for (const key of keys) {
    if (Array.isArray(value) && key === "length") continue
    if (typeof key !== "string") return false
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor?.enumerable !== true || !("value" in descriptor)
      || !isCanonicalJsonTree(descriptor.value, ancestors)) return false
  }
  ancestors.delete(value)
  return true
}

function hasValidSessionLayout(sessions: readonly PlanSession[]): boolean {
  const identities = new Set<string>()
  const qualityDays = new Set<number>()
  for (const session of sessions) {
    const identity = `${session.day}:${session.slot}`
    if (identities.has(identity)) return false
    identities.add(identity)
    if (session.role === "QUALITY") {
      if (qualityDays.has(session.day)) return false
      qualityDays.add(session.day)
    }
  }
  return sessions.every((session) => {
    if (session.role !== "EASY" || !qualityDays.has(session.day)) return true
    return session.prescription.rpe.minimum >= 1 && session.prescription.rpe.maximum <= 3
  })
}

const PACE_TARGET_KEYS = ["kind", "manifestVersion", "templateId", "templateVersion", "templateContentFingerprint", "notation", "sourceDecisionId", "sourceEvidenceRef", "approvalDecisionId", "ownerAuthorityDecisionId", "sportsScienceEvidence", "populationApplicabilityEvidence", "scope", "componentRefs", "operationalComponents", "setCount", "repetitionsPerSet", "repetitionDistanceM", "targetEventDistanceM", "targetRepSeconds", "selectedAnchor", "displayRoundingPolicyVersion", "repetitionRecoverySeconds", "repetitionRecoveryMode", "setRecoverySeconds", "setRecoveryMode", "totals", "stopCodes", "fallbackCode", "prescriptionFingerprint"] as const

const MD_COMPONENT_REFS = [
  { componentType: "WARMUP", componentRef: "WU-MD-01", componentVersion: "1.0.0", componentFingerprint: "sha256:a0aafebf7c1021f56a32cd1c4330609b5d4861ac7a138a0236a3282480d1bb28" },
  { componentType: "COOLDOWN", componentRef: "CD-MD-01", componentVersion: "1.0.0", componentFingerprint: "sha256:3b94b71b4b529fca8841b83f9d355f023fe9178e22a80288c8c043b23d655850" },
  { componentType: "DOWNSHIFT", componentRef: "RPE-ONLY-CONTROLLED-01", componentVersion: "1.0.0", componentFingerprint: "sha256:cd09b06359fcdfb422b421c31dd45a97beeccbdbecaabd1eb7274cdd67ecf3c5" },
  { componentType: "STOP_CONDITIONS", componentRef: "STOP-MD-01", componentVersion: "1.0.0", componentFingerprint: "sha256:d2d0370db17e7caeb11f7aab144b263bef4d63bf91df170175c910133193208e" },
] as const
const FIVE_K_COMPONENT_REFS = [
  { componentType: "WARMUP", componentRef: "WU-V2-5K-01", componentVersion: "1.0.0", componentFingerprint: "sha256:d8da21478d2a44841122874ccf35c24aad1777ebaaeb018deda3e98a8f9cf6f1" },
  { componentType: "COOLDOWN", componentRef: "CD-V2-5K-01", componentVersion: "1.0.0", componentFingerprint: "sha256:8d1470171a5edb17a43aa1c21ca34bbfb77456347a68293d2ffe0a5bc52968ab" },
  { componentType: "DOWNSHIFT", componentRef: "RPE-ONLY-CONTROLLED-01", componentVersion: "1.0.0", componentFingerprint: "sha256:cd09b06359fcdfb422b421c31dd45a97beeccbdbecaabd1eb7274cdd67ecf3c5" },
  { componentType: "STOP_CONDITIONS", componentRef: "STOP-V2-5K-01", componentVersion: "1.0.0", componentFingerprint: "sha256:737ce6df7f7049530b72f3f52f20a2cbbd32bb83ccf6bfd93c29e25864b4bc29" },
] as const

function isPaceTargetPrescription(value: Record<string, unknown>): boolean {
  const hasSequence = Object.prototype.hasOwnProperty.call(value, "sequence")
  if (!hasExactKeys(value, hasSequence ? [...PACE_TARGET_KEYS, "sequence"] : PACE_TARGET_KEYS)) return false
  const strings = ["manifestVersion", "templateId", "templateVersion", "templateContentFingerprint", "notation", "sourceDecisionId", "sourceEvidenceRef", "approvalDecisionId", "ownerAuthorityDecisionId", "displayRoundingPolicyVersion", "prescriptionFingerprint"]
  if (!strings.every((key) => typeof value[key] === "string" && value[key].length > 0)
      || typeof value["templateContentFingerprint"] !== "string" || !SHA256_PATTERN.test(value["templateContentFingerprint"])
      || !isEvidenceIdentity(value["sportsScienceEvidence"]) || !isEvidenceIdentity(value["populationApplicabilityEvidence"])
      || !isPaceScope(value["scope"]) || !isComponentRefs(value["componentRefs"]) || !isOperationalComponents(value["operationalComponents"])
      || !isPositiveInteger(value["setCount"]) || !isPositiveInteger(value["repetitionsPerSet"]) || !isPositiveInteger(value["repetitionDistanceM"])
      || !isPositiveInteger(value["targetEventDistanceM"]) || !isPositiveNumber(value["targetRepSeconds"])
      || !isCurrentAnchor(value["selectedAnchor"]) || !isRecovery(value["repetitionRecoverySeconds"], value["repetitionRecoveryMode"])
      || !isRecovery(value["setRecoverySeconds"], value["setRecoveryMode"]) || !isTotals(value["totals"])
      || !Array.isArray(value["stopCodes"]) || !isDenseArray(value["stopCodes"])
      || value["stopCodes"].length !== 4 || !value["stopCodes"].every(isStopCode)
      || value["fallbackCode"] !== "RPE_ONLY_CONTROLLED") return false
  const anchor = value["selectedAnchor"]
  return isRecord(anchor) && anchor["eventDistanceM"] === value["targetEventDistanceM"]
    && hasApprovedPrescriptionReferenceBinding(value)
    && isConsistentPaceTarget(value)
    // Source fields have passed the exact operational/number checks above.
    && (!hasSequence || matchesPacePrescriptionSequence(value as unknown as PaceSequenceSource, value["sequence"]))
}

function isEvidenceIdentity(value: unknown): boolean {
  return isRecord(value) && hasExactKeys(value, ["evidenceId", "decisionRef", "fingerprint"])
    && typeof value["evidenceId"] === "string" && typeof value["decisionRef"] === "string"
    && typeof value["fingerprint"] === "string" && SHA256_PATTERN.test(value["fingerprint"])
}

function hasApprovedPrescriptionReferenceBinding(value: Record<string, unknown>): boolean {
  const distance = value["targetEventDistanceM"]
  if (distance !== 800 && distance !== 1500 && distance !== 3000 && distance !== 5000) return false
  const templateId = distance === 5000 ? "V2-SEED-05" : `MD-${distance}-01`
  const approved = distance === 5000
    ? { fingerprint: "sha256:ad4a8c436a5a6e7a9c81342d79b359d84b1b8ea1034f9589141429eea8d0e42a", notation: "5×1000m @5000m RP · r150″ JOG", eventGroup: "FIVE_K", eventFingerprint: "sha256:43f39eea01053d1cf11afbdac90adc0c6331cd4b36355c16b660b6970d62cbed", experienceFingerprint: "sha256:dddff17cc298cd32ce7cbd6c2ccff6e38034b7e0ff5dd114e40b3893d55b4517", sportsFingerprint: "sha256:43f39eea01053d1cf11afbdac90adc0c6331cd4b36355c16b660b6970d62cbed", populationFingerprint: "sha256:dddff17cc298cd32ce7cbd6c2ccff6e38034b7e0ff5dd114e40b3893d55b4517", componentRefs: FIVE_K_COMPONENT_REFS }
    : {
        fingerprint: distance === 800 ? "sha256:8aa917947277883df94a9de665accd59a028b6753cec22d8fecf06795d28b149" : distance === 1500 ? "sha256:dd82bb01baa7b34e163f9148b76eae3956285dc5d1bd7e5217cd39373d966fab" : "sha256:a69b24eccf72be076865b091d6a4ee408da6444512c09a788d717d99adc7a455",
        notation: distance === 800 ? "10×200m @800m RP · r60″ STAND" : distance === 1500 ? "3×500m @1500m RP · r180″ STAND" : "4×800m @3000m RP · r180″ WALK",
        eventGroup: "MIDDLE_DISTANCE",
        eventFingerprint: distance === 800 ? "sha256:15f0364506a6325828b68c7320bad090ebc718552d693af025d0e5b86117a01a" : distance === 1500 ? "sha256:1aa88001839a9fa0202e290c36b50a309a98bff8fbd8abc61903d9277a644082" : "sha256:fb0bc61a1848f424a00510c4d8bbea23be4528d0e89045c68a26ab8d730436e8",
        experienceFingerprint: "sha256:5113008167054deeb83f6519021273f477257a8ba379b95916f4139f6468a5c3",
        sportsFingerprint: distance === 800 ? "sha256:b7b1d282bc14a968fd4d7ca056e501ae2b9870be666a2b50e0c6311892205165" : distance === 1500 ? "sha256:e7897160a160364a7143f7c5dce9154a42ce0eea7dae11acb6876ea9721e93e0" : "sha256:fc3ca228cd6615470775b2a1c768e5bfa4f9e658938893674340b16cad5462fe",
        populationFingerprint: "sha256:db90564affefb2723de747e3c52a406463cf9d9964d4143c1c85fa4083fa6c94",
        componentRefs: MD_COMPONENT_REFS,
      }
  const sourceDecisionId = distance === 5000
    ? "TO-V2-SEED-05-OWNER-ADOPTION-2026-08-17"
    : "MIDDLE_DISTANCE_SOURCE_ADOPTION_PACKET_2026-08-17"
  const approvalDecisionId = distance === 5000
    ? "TO-V2-SEED-05-OWNER-ADOPTION-2026-08-17"
    : "TO-MD-RUNTIME-ACTIVATION-2026-08-17"
  const sourceEvidenceRef = distance === 5000
    ? "reports/review/V2_SEED_05_OWNER_ADOPTION_DECISION_2026-08-17.md"
    : "reports/review/MIDDLE_DISTANCE_SOURCE_ADOPTION_PACKET_2026-08-17.md"
  const sports = value["sportsScienceEvidence"]
  const population = value["populationApplicabilityEvidence"]
  const scope = value["scope"]
  const parsedNotation = parsePrescriptionNotation(approved.notation)
  if (parsedNotation.kind !== "parsed") return false
  const notation = parsedNotation.notation
  return value["manifestVersion"] === "1"
    && value["templateId"] === templateId
    && value["templateVersion"] === "1.0.0"
    && value["templateContentFingerprint"] === approved.fingerprint
    && value["notation"] === approved.notation
    && value["setCount"] === notation.setCount
    && value["repetitionsPerSet"] === notation.repetitionsPerSet
    && value["repetitionDistanceM"] === notation.repetitionDistanceM
    && value["targetEventDistanceM"] === notation.paceTargetEventDistanceM
    && value["repetitionRecoverySeconds"] === notation.repetitionRecoverySeconds
    && value["repetitionRecoveryMode"] === notation.repetitionRecoveryMode
    && value["setRecoverySeconds"] === notation.setRecoverySeconds
    && value["setRecoveryMode"] === notation.setRecoveryMode
    && canonicalJson(value["totals"]) === canonicalJson(derivePrescriptionTotals(notation))
    && value["displayRoundingPolicyVersion"] === "seconds-v1"
    && value["sourceDecisionId"] === sourceDecisionId
    && value["sourceEvidenceRef"] === sourceEvidenceRef
    && value["approvalDecisionId"] === approvalDecisionId
    && value["ownerAuthorityDecisionId"] === approvalDecisionId
    && isRecord(sports)
    && sports["evidenceId"] === `${templateId}-SPORTS-SCIENCE-EVIDENCE-2026-08-17`
    && sports["decisionRef"] === approvalDecisionId
    && sports["fingerprint"] === approved.sportsFingerprint
    && isRecord(population)
    && population["evidenceId"] === `${templateId}-POPULATION-EVIDENCE-2026-08-17`
    && population["decisionRef"] === approvalDecisionId
    && population["fingerprint"] === approved.populationFingerprint
    && isRecord(scope)
    && scope["eventGroup"] === approved.eventGroup
    && scope["experienceBand"] === "EXPERIENCED"
    && scope["population"] === "YOUTH_AND_ADULT"
    && scope["eventEvidenceFingerprint"] === approved.eventFingerprint
    && scope["experienceEvidenceFingerprint"] === approved.experienceFingerprint
    && canonicalJson(value["componentRefs"]) === canonicalJson(approved.componentRefs)
}

function isPaceScope(value: unknown): boolean {
  return isRecord(value) && hasExactKeys(value, ["eventGroup", "experienceBand", "population", "eventEvidenceFingerprint", "experienceEvidenceFingerprint"])
    && (value["eventGroup"] === "MIDDLE_DISTANCE" || value["eventGroup"] === "FIVE_K")
    && value["experienceBand"] === "EXPERIENCED" && value["population"] === "YOUTH_AND_ADULT"
    && typeof value["eventEvidenceFingerprint"] === "string" && SHA256_PATTERN.test(value["eventEvidenceFingerprint"])
    && typeof value["experienceEvidenceFingerprint"] === "string" && SHA256_PATTERN.test(value["experienceEvidenceFingerprint"])
}

function isComponentRefs(value: unknown): boolean {
  return Array.isArray(value) && isDenseArray(value) && value.length === 4 && value.every((item) =>
    isRecord(item) && hasExactKeys(item, ["componentType", "componentRef", "componentVersion", "componentFingerprint"])
    && (item["componentType"] === "WARMUP" || item["componentType"] === "COOLDOWN" || item["componentType"] === "DOWNSHIFT" || item["componentType"] === "STOP_CONDITIONS")
    && typeof item["componentRef"] === "string" && typeof item["componentVersion"] === "string" && item["componentVersion"].length > 0
    && typeof item["componentFingerprint"] === "string" && SHA256_PATTERN.test(item["componentFingerprint"]))
}

function isOperationalComponents(value: unknown): boolean {
  if (!isRecord(value) || !hasExactKeys(value, ["warmup", "cooldown", "fallback", "stopConditions"])) return false
  const warmup = value["warmup"], cooldown = value["cooldown"], fallback = value["fallback"], stop = value["stopConditions"]
  return isRecord(warmup) && hasExactKeys(warmup, ["componentRef", "componentVersion", "authority", "easyDurationMinutes", "rpeMin", "rpeMax", "strides"])
    && (warmup["componentRef"] === "WU-V2-5K-01" || warmup["componentRef"] === "WU-MD-01") && warmup["componentVersion"] === "1.0.0" && warmup["authority"] === "OWNER_OPERATIONAL_ADAPTATION" && warmup["easyDurationMinutes"] === 15 && warmup["rpeMin"] === 2 && warmup["rpeMax"] === 3
    && isRecord(warmup["strides"]) && hasExactKeys(warmup["strides"], ["repetitions", "durationSeconds", "recoverySeconds", "recoveryMode", "progression"]) && warmup["strides"]["repetitions"] === 4 && warmup["strides"]["durationSeconds"] === 20 && warmup["strides"]["recoverySeconds"] === 40 && warmup["strides"]["recoveryMode"] === "WALK_OR_JOG" && warmup["strides"]["progression"] === "PROGRESSIVE"
    && isRecord(cooldown) && hasExactKeys(cooldown, ["componentRef", "componentVersion", "authority", "easyDurationMinutes", "rpeMin", "rpeMax"]) && (cooldown["componentRef"] === "CD-V2-5K-01" || cooldown["componentRef"] === "CD-MD-01") && cooldown["componentVersion"] === "1.0.0" && cooldown["authority"] === "OWNER_OPERATIONAL_ADAPTATION" && cooldown["easyDurationMinutes"] === 10 && cooldown["rpeMin"] === 1 && cooldown["rpeMax"] === 2
    && isRecord(fallback) && hasExactKeys(fallback, ["componentRef", "componentVersion", "code", "behavior", "numericRepetitionVariant"]) && fallback["componentRef"] === "RPE-ONLY-CONTROLLED-01" && fallback["componentVersion"] === "1.0.0" && fallback["code"] === "RPE_ONLY_CONTROLLED" && fallback["behavior"] === "DELEGATE_TO_EXISTING_RPE_CANDIDATE" && fallback["numericRepetitionVariant"] === null
    && isRecord(stop) && hasExactKeys(stop, ["componentRef", "componentVersion", "authority", "diagnosticClaim", "codes"]) && (stop["componentRef"] === "STOP-V2-5K-01" || stop["componentRef"] === "STOP-MD-01") && stop["componentVersion"] === "1.0.0" && stop["authority"] === "OWNER_PRECAUTIONARY_OPERATIONAL_RULE" && stop["diagnosticClaim"] === false && Array.isArray(stop["codes"]) && isDenseArray(stop["codes"]) && stop["codes"].length === 4 && stop["codes"].every(isStopCode)
}

function isCurrentAnchor(value: unknown): boolean {
  if (!isRecord(value) || !hasExactKeys(value, ["anchorId", "eventDistanceM", "performanceSeconds", "achievedAt", "enteredBy", "verificationState", "freshnessState", "sourceRef", "elapsedLabel", "kind", "purpose", "seasonId"])) return false
  return isRecordId(value["anchorId"]) && isPositiveNumber(value["eventDistanceM"]) && value["eventDistanceM"] >= 60 && isPositiveNumber(value["performanceSeconds"])
    && isIsoDate(value["achievedAt"]) && (value["enteredBy"] === "ATHLETE" || value["enteredBy"] === "COACH" || value["enteredBy"] === "VERIFIED_IMPORT")
    && (value["verificationState"] === "VERIFIED" || value["verificationState"] === "SELF_REPORTED" || value["verificationState"] === "UNVERIFIED")
    && value["freshnessState"] === "CURRENT" && value["sourceRef"] === `athlete-record:${value["anchorId"]}`
    && typeof value["elapsedLabel"] === "string" && CURRENT_ELAPSED_LABELS.has(value["elapsedLabel"])
    && ((value["kind"] === "SB" && value["purpose"] === "SEASON_CONTEXT" && value["seasonId"] === value["achievedAt"].slice(0, 4))
      || ((value["kind"] === "PB" || value["kind"] === "RECENT_RESULT") && value["purpose"] === "CURRENT_CAPABILITY" && value["seasonId"] === null))
}

function isRecovery(seconds: unknown, mode: unknown): boolean {
  return (seconds === null && mode === "NOT_APPLICABLE")
    || (isPositiveInteger(seconds) && (mode === "WALK" || mode === "JOG" || mode === "STAND"))
}

function isTotals(value: unknown): boolean {
  if (!isRecord(value) || !hasExactKeys(value, ["totalRepetitions", "qualityDistanceM", "qualityDurationSeconds", "repetitionRecoveryOccurrences", "repetitionRecoveryTotalSeconds", "setRecoveryOccurrences", "setRecoveryTotalSeconds", "plannedRecoverySeconds", "mainSessionTotalExcludingWarmupCooldown", "uncomputableReasonCodes"])) return false
  return isPositiveInteger(value["totalRepetitions"]) && isPositiveInteger(value["qualityDistanceM"])
    && (value["qualityDurationSeconds"] === null || isPositiveInteger(value["qualityDurationSeconds"]))
    && ["repetitionRecoveryOccurrences", "repetitionRecoveryTotalSeconds", "setRecoveryOccurrences", "setRecoveryTotalSeconds", "plannedRecoverySeconds"].every((key) => typeof value[key] === "number" && Number.isInteger(value[key]) && value[key] >= 0)
    && (value["mainSessionTotalExcludingWarmupCooldown"] === null || isPositiveInteger(value["mainSessionTotalExcludingWarmupCooldown"]))
    && Array.isArray(value["uncomputableReasonCodes"]) && isDenseArray(value["uncomputableReasonCodes"])
    && value["uncomputableReasonCodes"].every((code) =>
      code === "QUALITY_DISTANCE_UNAVAILABLE" || code === "WORK_DURATION_UNAVAILABLE"
      || code === "REPETITION_RECOVERY_UNAVAILABLE" || code === "SET_RECOVERY_UNAVAILABLE")
}

function isConsistentPaceTarget(value: Record<string, unknown>): boolean {
  const refs = value["componentRefs"]
  const components = value["operationalComponents"]
  const totals = value["totals"]
  const anchor = value["selectedAnchor"]
  if (!Array.isArray(refs) || !isRecord(components) || !isRecord(totals) || !isRecord(anchor)) return false

  const expectedComponents = [
    ["WARMUP", components["warmup"]],
    ["COOLDOWN", components["cooldown"]],
    ["DOWNSHIFT", components["fallback"]],
    ["STOP_CONDITIONS", components["stopConditions"]],
  ] as const
  if (new Set(refs.map((item) => isRecord(item) ? item["componentType"] : null)).size !== 4) return false
  for (const [componentType, component] of expectedComponents) {
    if (!isRecord(component)) return false
    const ref = refs.find((item) => isRecord(item) && item["componentType"] === componentType)
    if (!isRecord(ref) || ref["componentRef"] !== component["componentRef"] || ref["componentVersion"] !== component["componentVersion"]) return false
  }

  const stopConditions = components["stopConditions"]
  const fallback = components["fallback"]
  if (!isRecord(stopConditions) || !isRecord(fallback)
      || JSON.stringify(value["stopCodes"]) !== JSON.stringify(stopConditions["codes"])
      || value["fallbackCode"] !== fallback["code"]) return false

  const setCount = value["setCount"]
  const repetitionsPerSet = value["repetitionsPerSet"]
  const repetitionDistanceM = value["repetitionDistanceM"]
  const repetitionRecoverySeconds = value["repetitionRecoverySeconds"]
  const setRecoverySeconds = value["setRecoverySeconds"]
  const targetEventDistanceM = value["targetEventDistanceM"]
  if (!isPositiveInteger(setCount) || !isPositiveInteger(repetitionsPerSet) || !isPositiveInteger(repetitionDistanceM)
      || !isPositiveInteger(targetEventDistanceM)) return false
  const repetitionRecoveryOccurrences = setCount * Math.max(0, repetitionsPerSet - 1)
  const setRecoveryOccurrences = Math.max(0, setCount - 1)
  const expectedTotals = {
    totalRepetitions: setCount * repetitionsPerSet,
    qualityDistanceM: setCount * repetitionsPerSet * repetitionDistanceM,
    repetitionRecoveryOccurrences,
    repetitionRecoveryTotalSeconds: repetitionRecoveryOccurrences * (typeof repetitionRecoverySeconds === "number" ? repetitionRecoverySeconds : 0),
    setRecoveryOccurrences,
    setRecoveryTotalSeconds: setRecoveryOccurrences * (typeof setRecoverySeconds === "number" ? setRecoverySeconds : 0),
  }
  for (const [key, expected] of Object.entries(expectedTotals)) {
    if (totals[key] !== expected) return false
  }
  if (totals["plannedRecoverySeconds"] !== expectedTotals.repetitionRecoveryTotalSeconds + expectedTotals.setRecoveryTotalSeconds
      || (repetitionRecoverySeconds === null) !== (value["repetitionRecoveryMode"] === "NOT_APPLICABLE")
      || (setRecoverySeconds === null) !== (value["setRecoveryMode"] === "NOT_APPLICABLE")) return false

  const targetRepSeconds = value["targetRepSeconds"]
  if (!isPositiveNumber(targetRepSeconds) || !isPositiveNumber(anchor["performanceSeconds"])
      || anchor["eventDistanceM"] !== targetEventDistanceM
      || anchor["performanceSeconds"] * repetitionDistanceM / targetEventDistanceM !== targetRepSeconds) return false

  const { prescriptionFingerprint, ...content } = value
  return prescriptionFingerprint === `canonical-json-v1:${JSON.stringify(content)}`
}

function isStopCode(value: unknown): boolean {
  return value === "STOP_NEW_OR_WORSENING_PAIN" || value === "STOP_DIZZINESS_OR_FAINTNESS" || value === "STOP_CHEST_PAIN_OR_UNUSUAL_BREATHING" || value === "STOP_LOSS_OF_CONTROLLED_FORM"
}

function isPositiveInteger(value: unknown): value is number { return typeof value === "number" && Number.isInteger(value) && value > 0 }
function isPositiveNumber(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value) && value > 0 }
function isPlannedEnergyIntent(value: unknown): value is PlanCandidate["selectedEnergyIntent"] { return value === "RECOVERY_INTENT" || value === "BASE_INTENT" || isQualityEnergyIntent(value) }
function isQualityEnergyIntent(value: unknown): boolean { return value === "LT_INTENT" || value === "VO2_INTENT" || value === "GLY_INTENT" || value === "ATP_PC_INTENT" || value === "MIXED_INTENT" }

function changedDimensions(base: PlanCandidate, next: PlanCandidate): AdaptationDimension[] {
  const changed: AdaptationDimension[] = []
  if (base.selectedEnergyIntent !== next.selectedEnergyIntent || canonicalJson(base.sessions.map((item) => item.plannedEnergyIntent)) !== canonicalJson(next.sessions.map((item) => item.plannedEnergyIntent))) changed.push("INTENSITY")
  if (canonicalJson(base.sessions.map(({ day, slot, role }) => ({ day, slot, role }))) !== canonicalJson(next.sessions.map(({ day, slot, role }) => ({ day, slot, role })))) changed.push("FREQUENCY")
  if (canonicalJson(base.sessions.map((item) => item.prescription)) !== canonicalJson(next.sessions.map((item) => item.prescription))) changed.push("VOLUME")
  return changed
}

export type ApprovedAdaptationTransformResult =
  | { readonly kind: "approved"; readonly changeDimension: "VOLUME" }
  | { readonly kind: "rejected"; readonly code: "MALFORMED_INPUT" | "NO_OP" | "MULTIPLE_DIMENSIONS" | "DIMENSION_MISMATCH" | "UNAPPROVED_TRANSFORM" }

export function validateApprovedAdaptationTransform(
  baseCandidate: unknown,
  successorCandidate: unknown,
  claimedDimension: unknown,
): ApprovedAdaptationTransformResult {
  try {
    const base = parsePlanCandidate(baseCandidate)
    const successor = parsePlanCandidate(successorCandidate)
    if (base === null || successor === null) return { kind: "rejected", code: "MALFORMED_INPUT" }
    const changed = changedDimensions(base, successor)
    if (changed.length === 0) return { kind: "rejected", code: "NO_OP" }
    if (changed.length > 1) return { kind: "rejected", code: "MULTIPLE_DIMENSIONS" }
    if (changed[0] !== claimedDimension) return { kind: "rejected", code: "DIMENSION_MISMATCH" }
    if (claimedDimension !== "VOLUME"
        || resolveRegisteredAdaptationTransform(base, successor, "EXPLICIT_REQUEST") === null) return { kind: "rejected", code: "UNAPPROVED_TRANSFORM" }
    return { kind: "approved", changeDimension: "VOLUME" }
  } catch {
    return { kind: "rejected", code: "MALFORMED_INPUT" }
  }
}

function proposalExpiry(createdAt: string): string {
  return new Date(Date.parse(createdAt) + 72 * 60 * 60 * 1_000).toISOString()
}

function hashSuccessorProvenance(value: {
  readonly pairId: string
  readonly edgeId: AdaptationTransformEdgeId
  readonly sourceCandidateId: string
  readonly sourceCandidateContentHash: string
  readonly successorCandidateId: string
  readonly successorContentHash: string
}): Promise<string> {
  return canonicalJsonSha256("trainoracle.plan-adaptation-successor-provenance.v1", value)
}

function triggerAllowed(request: PlanAdaptationProposalRequest): boolean {
  return triggerAllowedValues(
    request.proposalOrigin,
    request.scope.athleteId,
    request.scope.eventDistanceM,
    request.activePlanStartedAt,
    request.trigger,
  )
}

function triggerAllowedValues(
  proposalOrigin: unknown,
  athleteId: unknown,
  eventDistanceM: unknown,
  activePlanStartedAt: unknown,
  trigger: AdaptationTrigger,
): boolean {
  if ((proposalOrigin !== "SELF_SERVICE" && proposalOrigin !== "COACH_AUTHORED")
      || !isAthleteId(athleteId)
      || parseSupportedEvent(eventDistanceM) === null
      || !isIsoTimestamp(activePlanStartedAt)) return false
  switch (trigger.kind) {
    case "EXPLICIT_REQUEST": {
      const actor = proposalOrigin === "SELF_SERVICE" ? "ATHLETE" : "COACH"
      const prefix = `${actor.toLowerCase()}-request:${athleteId}:`
      return trigger.requestedBy === actor
        && trigger.sourceRef.startsWith(prefix)
        && /^(?:req-\d+|v\d+)$/u.test(trigger.sourceRef.slice(prefix.length))
    }
    case "SAME_EVENT_PB_SB_AFTER_ACTIVE_PLAN_START": return !trigger.historicalOrBackfilled && trigger.eventDistanceM === eventDistanceM && trigger.sourceRef === `athlete-record:${trigger.recordId}` && Date.parse(trigger.achievedAt) > Date.parse(activePlanStartedAt)
    default: return assertNever(trigger)
  }
}

function authorityFor(origin: AdaptationProposalOrigin): PlanSelectionAuthority {
  switch (origin) {
    case "SELF_SERVICE": return "SELF"
    case "COACH_AUTHORED": return "COACH_REQUIRED"
    default: return assertNever(origin)
  }
}

function parseSupportedEvent(value: unknown): SupportedAdaptationEvent | null {
  return value === 800 || value === 1500 || value === 3000 || value === 5000
    || value === 10000 || value === 21097 || value === 42195
    ? value
    : null
}
function isPlanEventGroup(value: unknown): value is PlanEventGroup {
  return value === "MIDDLE_DISTANCE" || value === "FIVE_K"
    || value === "TEN_K" || value === "GENERAL_ENDURANCE"
}
function eventGroupMatchesDistance(
  eventGroup: PlanEventGroup,
  distance: SupportedAdaptationEvent,
): boolean {
  if (eventGroup === "MIDDLE_DISTANCE") return distance === 800 || distance === 1500 || distance === 3000
  if (eventGroup === "FIVE_K") return distance === 5000
  if (eventGroup === "TEN_K") return distance === 10000
  return distance === 21097 || distance === 42195
}
function hasUnsupportedNumericEvent(value: unknown): boolean {
  if (!isRecord(value) || !isRecord(value["scope"])) return false
  const event = value["scope"]["eventDistanceM"]
  return typeof event === "number" && Number.isFinite(event) && parseSupportedEvent(event) === null
}
function candidateEligibleForExactEvent(value: unknown, candidate: PlanCandidate): boolean {
  const distance = parseSupportedEvent(value)
  if (distance === null || candidate.eventDistanceM !== distance
      || !eventGroupMatchesDistance(candidate.eventGroup, distance)) return false
  return candidate.sessions.every((session) =>
    session.prescription.kind !== "PACE_TARGET"
    || (session.prescription.targetEventDistanceM === distance
      && session.prescription.selectedAnchor.eventDistanceM === distance),
  )
}
function isIsoTimestamp(value: unknown): value is string { return typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value }
function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string") return false
  const match = ISO_DATE_PATTERN.exec(value)
  if (match === null) return false
  const year = Number(match[0].slice(0, 4))
  const month = Number(match[0].slice(5, 7))
  const day = Number(match[0].slice(8, 10))
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
}
function formatElapsedMonths(months: number): string {
  if (months === 0) return "이번 달"
  if (months < 12) return `${months}개월 전`
  const years = Math.floor(months / 12)
  const remainingMonths = months % 12
  return remainingMonths === 0 ? `${years}년 전` : `${years}년 ${remainingMonths}개월 전`
}
function candidateAnchorLabelsMatch(candidate: PlanCandidate, evaluatedAt: string): boolean {
  const evaluated = new Date(evaluatedAt)
  return candidate.sessions.every((session) => {
    if (session.prescription.kind !== "PACE_TARGET") return true
    const achievedAt = session.prescription.selectedAnchor.achievedAt
    if (!isIsoDate(achievedAt)) return false
    const year = Number(achievedAt.slice(0, 4))
    const month = Number(achievedAt.slice(5, 7))
    const day = Number(achievedAt.slice(8, 10))
    let months = (evaluated.getUTCFullYear() - year) * 12 + evaluated.getUTCMonth() - (month - 1)
    if (evaluated.getUTCDate() < day) months -= 1
    return months >= 0 && months <= 18
      && session.prescription.selectedAnchor.elapsedLabel === formatElapsedMonths(months)
  })
}
function isAthleteId(value: unknown): value is string { return typeof value === "string" && (value === "local-athlete" || /^athlete-\d+$/u.test(value) || UUID_PATTERN.test(value)) }
function isRecordId(value: unknown): value is string {
  return typeof value === "string"
    && OPAQUE_RECORD_ID_PATTERN.test(value)
    && !PRIVATE_KEY.test(value)
}
function isExposureId(value: unknown): value is string { return typeof value === "string" && EXPOSURE_ID_PATTERN.test(value) }
function isCandidateId(value: unknown, detailedFingerprint: unknown): value is string {
  if (typeof value !== "string") return false
  const marker = ":pace-target:"
  const markerIndex = value.indexOf(marker)
  const baseId = markerIndex < 0 ? value : value.slice(0, markerIndex)
  if (!CANDIDATE_ID_PATTERN.test(baseId)) return false
  return detailedFingerprint === null
    ? markerIndex < 0
    : typeof detailedFingerprint === "string" && value === `${baseId}${marker}${detailedFingerprint}`
}
function isExplicitRequestSource(value: unknown): value is string {
  if (typeof value !== "string") return false
  const parts = value.split(":")
  return parts.length === 3
    && (parts[0] === "athlete-request" || parts[0] === "coach-request")
    && isAthleteId(parts[1])
    && /^(?:req-\d+|v\d+)$/u.test(parts[2] ?? "")
}
function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean { return canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort()) }
function containsPrivateKey(value: unknown, seen = new Set<object>()): boolean {
  if (typeof value !== "object" || value === null) return false
  if (seen.has(value)) return false
  seen.add(value)
  return Object.entries(value).some(([key, child]) => PRIVATE_KEY.test(key) || containsPrivateKey(child, seen))
}
function isJsonValue(value: unknown): boolean { return isCanonicalJsonTree(value) }
