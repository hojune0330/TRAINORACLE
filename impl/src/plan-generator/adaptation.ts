import { assertNever } from "../shared/assert-never"
import { RVE_NON_SENSITIVE_REASON_CODES } from "../rve/signal"
import { isRecord } from "./input-values"
import type { SafetyGateDecision } from "../safety-gate/gate"
import type { PlanCandidate, PlanSelectionAuthority, PlanSession } from "./types"

export const ADAPTATION_DIMENSIONS = ["INTENSITY", "VOLUME", "FREQUENCY"] as const
export type AdaptationDimension = (typeof ADAPTATION_DIMENSIONS)[number]
export type AdaptationProposalOrigin = "SELF_SERVICE" | "COACH_AUTHORED"
export type SupportedAdaptationEvent = 800 | 1500 | 3000 | 5000

export type AdaptationTrigger =
  | { readonly kind: "EXPLICIT_REQUEST"; readonly requestedBy: "ATHLETE" | "COACH"; readonly sourceRef: string }
  | { readonly kind: "SAME_EVENT_PB_SB_AFTER_ACTIVE_PLAN_START"; readonly explicitlyConfirmed: true; readonly recordId: string; readonly purpose: "PERSONAL_BEST" | "SEASON_BEST"; readonly eventDistanceM: SupportedAdaptationEvent; readonly achievedAt: string; readonly sourceRef: string; readonly historicalOrBackfilled: boolean }

export type PlanAdaptationProposalRequest = {
  readonly kind: "PLAN_ADAPTATION_PROPOSAL_REQUEST"
  readonly scope: { readonly athleteId: string; readonly eventDistanceM: SupportedAdaptationEvent }
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
  readonly proposalOrigin: AdaptationProposalOrigin
  readonly selectionAuthority: PlanSelectionAuthority
  readonly trigger: AdaptationTrigger["kind"]
  readonly changeDimension: AdaptationDimension
  readonly baseCandidateId: string
  readonly baseContentHash: string
  readonly proposedContentHash: string
  readonly approvedBeforeValueRef: string
  readonly approvedAfterValueRef: string
  readonly baseCandidate: PlanCandidate
  readonly successorCandidate: PlanCandidate
  readonly createdAt: string
  readonly idempotencyKey: string
}

export type PlanAdaptationProposalResult =
  | { readonly kind: "proposed"; readonly proposal: PlanAdaptationProposal }
  | { readonly kind: "blocked"; readonly code: "SAFETY_BLOCKED" | "STALE_SAFETY" | "ACTIVE_HOLD" }
  | { readonly kind: "rejected"; readonly code: "MALFORMED_INPUT" | "UNSUPPORTED_EVENT" | "CROSS_SCOPE_PROVENANCE" | "INELIGIBLE_TRIGGER" | "STALE_BASE" | "NO_OP" | "MULTIPLE_DIMENSIONS" | "DIMENSION_MISMATCH" | "UNAPPROVED_TRANSFORM" }

const REQUEST_KEYS = ["kind", "scope", "activePlanStartedAt", "baseCandidate", "proposedCandidate", "baseContentHash", "proposalOrigin", "trigger", "changeDimension", "safetyGate", "safetyEvaluatedAt", "safetyValidUntil", "activeHold", "createdAt", "idempotencyKey"] as const
const CANDIDATE_KEYS = ["candidateId", "kind", "eventGroup", "eventDistanceM", "selectedEnergyIntent", "sourceMode", "confidence", "beta", "detailedPrescriptionFingerprint", "continuityContext", "selectionAuthority", "frame", "mainExposureLedger", "rationaleCodes", "sessions"] as const
const PRIVATE_KEY = /(?:memo|note|symptom)/iu
const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/u
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u
const CURRENT_ELAPSED_LABELS = new Set(
  Array.from({ length: 19 }, (_, months) => formatElapsedMonths(months)),
)
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu
const LOCAL_RECORD_ID_PATTERN = /^local-\d+-[a-z0-9]+$/u
const EXPOSURE_ID_PATTERN = /^(?:app-main-day-(?:[1-9]|10)|fixture-main-[1-3])$/u
const CANDIDATE_ID_PATTERN = /^beta:(?:balanced|conservative):(?:middle_distance|five_k):event-(?:800|1500|3000|5000):(?:new_to_running|developing|experienced):(?:recovery_intent|base_intent|lt_intent|vo2_intent|gly_intent|atp_pc_intent|mixed_intent):(?:single_session_only|recovery_pm_allowed):(?:morning|evening|varies):projection-(?:7|9|9\.5|10):local-civil-9-5:[a-z0-9-]+:\d+(?:-\d+)*:(?:no_usable_journal|recent_journal_context):(?:no-continuity|(?:balanced|conservative):(?:completed|rested|skipped|pain_checkin)-\d+(?:-(?:completed|rested|skipped|pain_checkin)-\d+)*)$/u
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
const SAFETY_REASON_CODES: ReadonlySet<string> = new Set(RVE_NON_SENSITIVE_REASON_CODES)

export function canonicalJson(value: unknown): string {
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
  if (!isRecord(proposal) || !hasExactKeys(proposal, ["proposalId", "proposalHash", "targetFrame", "athleteId", "eventDistanceM", "proposalOrigin", "selectionAuthority", "trigger", "changeDimension", "baseCandidateId", "baseContentHash", "proposedContentHash", "approvedBeforeValueRef", "approvedAfterValueRef", "baseCandidate", "successorCandidate", "createdAt", "idempotencyKey"])) return false
  const baseCandidate = parsePlanCandidate(proposal["baseCandidate"])
  const successorCandidate = parsePlanCandidate(proposal["successorCandidate"])
  if (baseCandidate === null || successorCandidate === null) return false
  const { proposalId, proposalHash, ...content } = proposal
  const expectedProposalHash = await canonicalJsonSha256("trainoracle.plan-adaptation-proposal.v1", content)
  const [baseHash, proposedHash] = await Promise.all([hashPlanCandidate(baseCandidate), hashPlanCandidate(successorCandidate)])
  return proposalHash === expectedProposalHash
    && proposalId === `adaptation:${expectedProposalHash.slice("sha256:".length)}`
    && isAthleteId(proposal["athleteId"])
    && typeof proposal["idempotencyKey"] === "string" && SHA256_PATTERN.test(proposal["idempotencyKey"])
    && isIsoTimestamp(proposal["createdAt"])
    && proposal["baseCandidateId"] === baseCandidate.candidateId
    && proposal["baseContentHash"] === baseHash && proposal["proposedContentHash"] === proposedHash
    && proposal["approvedBeforeValueRef"] === baseHash && proposal["approvedAfterValueRef"] === proposedHash
    && candidateEligibleForExactEvent(proposal["eventDistanceM"], baseCandidate)
    && candidateEligibleForExactEvent(proposal["eventDistanceM"], successorCandidate)
    && validateApprovedAdaptationTransform(baseCandidate, successorCandidate, proposal["changeDimension"]).kind === "approved"
    && (proposal["proposalOrigin"] === "SELF_SERVICE" || proposal["proposalOrigin"] === "COACH_AUTHORED")
    && proposal["selectionAuthority"] === authorityFor(proposal["proposalOrigin"])
  } catch {
    return false
  }
}

export async function createPlanAdaptationProposal(candidate: unknown): Promise<PlanAdaptationProposalResult> {
  try {
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
  const transform = validateApprovedAdaptationTransform(request.baseCandidate, request.proposedCandidate, request.changeDimension)
  if (transform.kind === "rejected") return transform
  const proposedContentHash = await hashPlanCandidate(request.proposedCandidate)
  const content = {
    targetFrame: "NEXT_FRAME" as const, athleteId: request.scope.athleteId, eventDistanceM: candidateEventDistanceM,
    proposalOrigin: request.proposalOrigin, selectionAuthority: authorityFor(request.proposalOrigin), trigger: request.trigger.kind,
    changeDimension: request.changeDimension, baseCandidateId: request.baseCandidate.candidateId, baseContentHash, proposedContentHash,
    approvedBeforeValueRef: baseContentHash, approvedAfterValueRef: proposedContentHash, baseCandidate: request.baseCandidate,
    successorCandidate: request.proposedCandidate, createdAt: request.createdAt, idempotencyKey: request.idempotencyKey,
  }
  const proposalHash = await canonicalJsonSha256("trainoracle.plan-adaptation-proposal.v1", content)
  return { kind: "proposed", proposal: Object.freeze({ proposalId: `adaptation:${proposalHash.slice("sha256:".length)}`, proposalHash, ...content }) }
}

function parseAdaptationRequest(value: unknown): PlanAdaptationProposalRequest | null {
  if (!isRecord(value) || !hasExactKeys(value, REQUEST_KEYS) || value["kind"] !== "PLAN_ADAPTATION_PROPOSAL_REQUEST") return null
  const scope = value["scope"]
  const trigger = parseTrigger(value["trigger"])
  const safetyGate = parseStrictSafetyGate(value["safetyGate"])
  if (!isRecord(scope) || !hasExactKeys(scope, ["athleteId", "eventDistanceM"]) || !isAthleteId(scope["athleteId"])) return null
  const eventDistanceM = parseSupportedEvent(scope["eventDistanceM"])
  const baseCandidate = parsePlanCandidate(value["baseCandidate"])
  const proposedCandidate = parsePlanCandidate(value["proposedCandidate"])
  const proposalOrigin = value["proposalOrigin"]
  const changeDimension = value["changeDimension"]
  if (eventDistanceM === null || baseCandidate === null || proposedCandidate === null || trigger === null || safetyGate === null
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
  return { kind: "PLAN_ADAPTATION_PROPOSAL_REQUEST", scope: { athleteId: scope["athleteId"], eventDistanceM }, activePlanStartedAt, baseCandidate, proposedCandidate, baseContentHash: value["baseContentHash"], proposalOrigin, trigger, changeDimension, safetyGate, safetyEvaluatedAt, safetyValidUntil, activeHold: value["activeHold"], createdAt, idempotencyKey: value["idempotencyKey"] }
}

function parseTrigger(value: unknown): AdaptationTrigger | null {
  if (!isRecord(value)) return null
  switch (value["kind"]) {
    case "EXPLICIT_REQUEST":
      return hasExactKeys(value, ["kind", "requestedBy", "sourceRef"]) && (value["requestedBy"] === "ATHLETE" || value["requestedBy"] === "COACH") && isExplicitRequestSource(value["sourceRef"])
        ? { kind: "EXPLICIT_REQUEST", requestedBy: value["requestedBy"], sourceRef: value["sourceRef"] } : null
    case "SAME_EVENT_PB_SB_AFTER_ACTIVE_PLAN_START": {
      const eventDistanceM = parseSupportedEvent(value["eventDistanceM"])
      if (!hasExactKeys(value, ["kind", "explicitlyConfirmed", "recordId", "purpose", "eventDistanceM", "achievedAt", "sourceRef", "historicalOrBackfilled"])
          || value["explicitlyConfirmed"] !== true || typeof value["historicalOrBackfilled"] !== "boolean" || eventDistanceM === null
          || !isRecordId(value["recordId"]) || (value["purpose"] !== "PERSONAL_BEST" && value["purpose"] !== "SEASON_BEST")
          || !isIsoTimestamp(value["achievedAt"]) || value["sourceRef"] !== `athlete-record:${value["recordId"]}`) return null
      return { kind: "SAME_EVENT_PB_SB_AFTER_ACTIVE_PLAN_START", explicitlyConfirmed: true, recordId: value["recordId"], purpose: value["purpose"], eventDistanceM, achievedAt: value["achievedAt"], sourceRef: value["sourceRef"], historicalOrBackfilled: value["historicalOrBackfilled"] }
    }
    default: return null
  }
}

function parseStrictSafetyGate(value: unknown): SafetyGateDecision | null {
  if (!isRecord(value) || !isRecord(value["audit"]) || !hasExactKeys(value["audit"], ["event", "privacy"])) return null
  const reasonCodes = value["nonSensitiveReasonCodes"]
  if (!Array.isArray(reasonCodes) || !isDenseArray(reasonCodes)
      || !reasonCodes.every((code) => typeof code === "string" && SAFETY_REASON_CODES.has(code))) return null
  const audit = value["audit"]
  if (audit["privacy"] !== "REASON_CODES_ONLY") return null
  switch (value["kind"]) {
    case "passed":
      return hasExactKeys(value, ["kind", "action", "planGenerationAllowed", "nonSensitiveReasonCodes", "audit"])
        && value["action"] === "CONTINUE_WITH_OTHER_GATES"
        && value["planGenerationAllowed"] === true
        && audit["event"] === "PLAN_SAFETY_GATE_PASSED"
        ? { kind: "passed", action: "CONTINUE_WITH_OTHER_GATES", planGenerationAllowed: true, nonSensitiveReasonCodes: reasonCodes, audit: { event: "PLAN_SAFETY_GATE_PASSED", privacy: "REASON_CODES_ONLY" } }
        : null
    case "blocked":
      if (!hasExactKeys(value, ["kind", "action", "planGenerationAllowed", "requiredNextAction", "nonSensitiveReasonCodes", "audit"])
          || value["planGenerationAllowed"] !== false || audit["event"] !== "PLAN_SAFETY_GATE_BLOCKED") return null
      if (value["action"] === "BLOCK" && value["requiredNextAction"] === "HUMAN_REVIEW") {
        return { kind: "blocked", action: "BLOCK", planGenerationAllowed: false, requiredNextAction: "HUMAN_REVIEW", nonSensitiveReasonCodes: reasonCodes, audit: { event: "PLAN_SAFETY_GATE_BLOCKED", privacy: "REASON_CODES_ONLY" } }
      }
      return value["action"] === "BLOCK_OR_HUMAN_REVIEW" && value["requiredNextAction"] === "MORE_INFO_OR_HUMAN_REVIEW"
        ? { kind: "blocked", action: "BLOCK_OR_HUMAN_REVIEW", planGenerationAllowed: false, requiredNextAction: "MORE_INFO_OR_HUMAN_REVIEW", nonSensitiveReasonCodes: reasonCodes, audit: { event: "PLAN_SAFETY_GATE_BLOCKED", privacy: "REASON_CODES_ONLY" } }
        : null
    default:
      return null
  }
}

function parsePlanCandidate(value: unknown): PlanCandidate | null {
  if (!isPlanCandidate(value)) return null
  return value
}

function isPlanCandidate(value: unknown): value is PlanCandidate {
  if (!isRecord(value) || !hasExactKeys(value, CANDIDATE_KEYS) || !Array.isArray(value["sessions"])
      || !isDenseArray(value["sessions"]) || !value["sessions"].every(isPlanSession)
      || (value["kind"] !== "BALANCED" && value["kind"] !== "CONSERVATIVE")
      || (value["eventGroup"] !== "MIDDLE_DISTANCE" && value["eventGroup"] !== "FIVE_K")
      || !(value["eventDistanceM"] === null || parseSupportedEvent(value["eventDistanceM"]) !== null)
      || !isPlannedEnergyIntent(value["selectedEnergyIntent"])
      || (value["sourceMode"] !== "PROFILE_ONLY" && value["sourceMode"] !== "JOURNAL_CONTEXT_ONLY")
      || value["confidence"] !== "LIMITED" || !isCandidateBeta(value["beta"])
      || !isContinuityContext(value["continuityContext"])
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
  return value["candidateId"].includes(eventIdentity)
    && value["candidateId"].includes(exposureIdentity)
    && value["sessions"].every((session) => session.prescription.kind !== "PACE_TARGET"
    || session.prescription.scope.eventGroup === value["eventGroup"])
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
  return isFiniteRange(prescription["rpe"]) && isFiniteRange(prescription["durationMinutes"])
}

function isFiniteRange(value: unknown): boolean {
  return isRecord(value) && hasExactKeys(value, ["minimum", "maximum"]) && typeof value["minimum"] === "number" && Number.isFinite(value["minimum"]) && typeof value["maximum"] === "number" && Number.isFinite(value["maximum"]) && value["minimum"] <= value["maximum"]
}

function isCandidateBeta(value: unknown): boolean {
  return isRecord(value) && hasExactKeys(value, ["designation", "prescriptionBasis", "formationMethodClaim"])
    && value["designation"] === "BETA" && (value["prescriptionBasis"] === "DURATION_RPE_ONLY" || value["prescriptionBasis"] === "ONE_TRUSTED_DETAILED_SESSION")
    && value["formationMethodClaim"] === "NOT_UNIVERSAL"
}

function isContinuityContext(value: unknown): boolean {
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
  let index = 0
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor?.enumerable !== true) continue
    if (typeof key !== "string" || key !== String(index)) return false
    index += 1
  }
  return index === value.length
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
  if (!hasExactKeys(value, PACE_TARGET_KEYS)) return false
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
  return value["manifestVersion"] === "1"
    && value["templateId"] === templateId
    && value["templateVersion"] === "1.0.0"
    && value["templateContentFingerprint"] === approved.fingerprint
    && value["notation"] === approved.notation
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
function isPlannedEnergyIntent(value: unknown): boolean { return value === "RECOVERY_INTENT" || value === "BASE_INTENT" || isQualityEnergyIntent(value) }
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
    if (claimedDimension !== "VOLUME" || !isApprovedConservativeVolumeTransform(base, successor)) return { kind: "rejected", code: "UNAPPROVED_TRANSFORM" }
    return { kind: "approved", changeDimension: "VOLUME" }
  } catch {
    return { kind: "rejected", code: "MALFORMED_INPUT" }
  }
}

function isApprovedConservativeVolumeTransform(base: PlanCandidate, next: PlanCandidate): boolean {
  if (base.kind !== "BALANCED" || next.kind !== "CONSERVATIVE" || next.candidateId !== base.candidateId.replace("beta:balanced:", "beta:conservative:") || base.sessions.length !== next.sessions.length) return false
  const stable = (plan: PlanCandidate) => ({ eventGroup: plan.eventGroup, eventDistanceM: plan.eventDistanceM, selectedEnergyIntent: plan.selectedEnergyIntent, sourceMode: plan.sourceMode, confidence: plan.confidence, beta: plan.beta, detailedPrescriptionFingerprint: plan.detailedPrescriptionFingerprint, continuityContext: plan.continuityContext, selectionAuthority: plan.selectionAuthority, frame: plan.frame, mainExposureLedger: plan.mainExposureLedger, rationaleCodes: plan.rationaleCodes })
  if (canonicalJson(stable(base)) !== canonicalJson(stable(next))) return false
  return base.sessions.every((session, index) => {
    const successor = next.sessions[index]
    if (successor === undefined || session.day !== successor.day || session.slot !== successor.slot || session.role !== successor.role || session.plannedEnergyIntent !== successor.plannedEnergyIntent || session.prescription.kind !== successor.prescription.kind) return false
    if (session.prescription.kind !== "RPE_TIME_RANGE" || successor.prescription.kind !== "RPE_TIME_RANGE") return canonicalJson(session.prescription) === canonicalJson(successor.prescription)
    return canonicalJson(session.prescription.rpe) === canonicalJson(successor.prescription.rpe) && successor.prescription.durationMinutes.minimum === session.prescription.durationMinutes.minimum && (successor.prescription.durationMinutes.maximum === session.prescription.durationMinutes.minimum || successor.prescription.durationMinutes.maximum === session.prescription.durationMinutes.maximum)
  })
}

function triggerAllowed(request: PlanAdaptationProposalRequest): boolean {
  switch (request.trigger.kind) {
    case "EXPLICIT_REQUEST": {
      const actor = request.proposalOrigin === "SELF_SERVICE" ? "ATHLETE" : "COACH"
      const prefix = `${actor.toLowerCase()}-request:${request.scope.athleteId}:`
      return request.trigger.requestedBy === actor
        && request.trigger.sourceRef.startsWith(prefix)
        && /^(?:req-\d+|v\d+)$/u.test(request.trigger.sourceRef.slice(prefix.length))
    }
    case "SAME_EVENT_PB_SB_AFTER_ACTIVE_PLAN_START": return !request.trigger.historicalOrBackfilled && request.trigger.eventDistanceM === request.scope.eventDistanceM && request.trigger.sourceRef === `athlete-record:${request.trigger.recordId}` && Date.parse(request.trigger.achievedAt) > Date.parse(request.activePlanStartedAt)
    default: return assertNever(request.trigger)
  }
}

function authorityFor(origin: AdaptationProposalOrigin): PlanSelectionAuthority {
  switch (origin) {
    case "SELF_SERVICE": return "SELF"
    case "COACH_AUTHORED": return "COACH_REQUIRED"
    default: return assertNever(origin)
  }
}

function parseSupportedEvent(value: unknown): SupportedAdaptationEvent | null { return value === 800 || value === 1500 || value === 3000 || value === 5000 ? value : null }
function hasUnsupportedNumericEvent(value: unknown): boolean {
  if (!isRecord(value) || !isRecord(value["scope"])) return false
  const event = value["scope"]["eventDistanceM"]
  return typeof event === "number" && Number.isFinite(event) && parseSupportedEvent(event) === null
}
function candidateEligibleForExactEvent(value: unknown, candidate: PlanCandidate): boolean {
  const distance = parseSupportedEvent(value)
  if (distance === null || candidate.eventDistanceM !== distance
      || (distance === 5000 ? candidate.eventGroup !== "FIVE_K" : candidate.eventGroup !== "MIDDLE_DISTANCE")) return false
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
function isRecordId(value: unknown): value is string { return typeof value === "string" && (UUID_PATTERN.test(value) || LOCAL_RECORD_ID_PATTERN.test(value)) }
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
function isJsonValue(value: unknown): boolean { return value === null || typeof value === "string" || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value)) || (Array.isArray(value) ? isDenseArray(value) && value.every(isJsonValue) : isRecord(value) && Object.values(value).every(isJsonValue)) }
