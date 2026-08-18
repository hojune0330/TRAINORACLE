import { assertNever } from "../shared/assert-never"
import { isRecord, parseSafetyGate } from "./input-values"
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
  if (!isRecord(scope) || !hasExactKeys(scope, ["athleteId", "eventDistanceM"]) || typeof scope["athleteId"] !== "string") return null
  const eventDistanceM = parseSupportedEvent(scope["eventDistanceM"])
  const baseCandidate = parsePlanCandidate(value["baseCandidate"])
  const proposedCandidate = parsePlanCandidate(value["proposedCandidate"])
  const proposalOrigin = value["proposalOrigin"]
  const changeDimension = value["changeDimension"]
  if (eventDistanceM === null || baseCandidate === null || proposedCandidate === null || trigger === null || safetyGate === null
      || (proposalOrigin !== "SELF_SERVICE" && proposalOrigin !== "COACH_AUTHORED")
      || (changeDimension !== "INTENSITY" && changeDimension !== "VOLUME" && changeDimension !== "FREQUENCY")
      || typeof value["baseContentHash"] !== "string" || !SHA256_PATTERN.test(value["baseContentHash"])
      || typeof value["activeHold"] !== "boolean" || typeof value["idempotencyKey"] !== "string" || value["idempotencyKey"].length === 0) return null
  const activePlanStartedAt = value["activePlanStartedAt"]
  const safetyEvaluatedAt = value["safetyEvaluatedAt"]
  const safetyValidUntil = value["safetyValidUntil"]
  const createdAt = value["createdAt"]
  if (!isIsoTimestamp(activePlanStartedAt) || !isIsoTimestamp(safetyEvaluatedAt) || !isIsoTimestamp(safetyValidUntil) || !isIsoTimestamp(createdAt)) return null
  return { kind: "PLAN_ADAPTATION_PROPOSAL_REQUEST", scope: { athleteId: scope["athleteId"], eventDistanceM }, activePlanStartedAt, baseCandidate, proposedCandidate, baseContentHash: value["baseContentHash"], proposalOrigin, trigger, changeDimension, safetyGate, safetyEvaluatedAt, safetyValidUntil, activeHold: value["activeHold"], createdAt, idempotencyKey: value["idempotencyKey"] }
}

function parseTrigger(value: unknown): AdaptationTrigger | null {
  if (!isRecord(value)) return null
  switch (value["kind"]) {
    case "EXPLICIT_REQUEST":
      return hasExactKeys(value, ["kind", "requestedBy", "sourceRef"]) && (value["requestedBy"] === "ATHLETE" || value["requestedBy"] === "COACH") && typeof value["sourceRef"] === "string"
        ? { kind: "EXPLICIT_REQUEST", requestedBy: value["requestedBy"], sourceRef: value["sourceRef"] } : null
    case "SAME_EVENT_PB_SB_AFTER_ACTIVE_PLAN_START": {
      const eventDistanceM = parseSupportedEvent(value["eventDistanceM"])
      if (!hasExactKeys(value, ["kind", "explicitlyConfirmed", "recordId", "purpose", "eventDistanceM", "achievedAt", "sourceRef", "historicalOrBackfilled"])
          || value["explicitlyConfirmed"] !== true || typeof value["historicalOrBackfilled"] !== "boolean" || eventDistanceM === null
          || typeof value["recordId"] !== "string" || (value["purpose"] !== "PERSONAL_BEST" && value["purpose"] !== "SEASON_BEST")
          || !isIsoTimestamp(value["achievedAt"]) || typeof value["sourceRef"] !== "string") return null
      return { kind: "SAME_EVENT_PB_SB_AFTER_ACTIVE_PLAN_START", explicitlyConfirmed: true, recordId: value["recordId"], purpose: value["purpose"], eventDistanceM, achievedAt: value["achievedAt"], sourceRef: value["sourceRef"], historicalOrBackfilled: value["historicalOrBackfilled"] }
    }
    default: return null
  }
}

function parseStrictSafetyGate(value: unknown): SafetyGateDecision | null {
  if (!isRecord(value)) return null
  const expected = value["kind"] === "passed" ? ["kind", "action", "planGenerationAllowed", "nonSensitiveReasonCodes", "audit"] : ["kind", "action", "planGenerationAllowed", "requiredNextAction", "nonSensitiveReasonCodes", "audit"]
  if (!hasExactKeys(value, expected) || !isRecord(value["audit"])) return null
  return parseSafetyGate(value) ?? null
}

function parsePlanCandidate(value: unknown): PlanCandidate | null {
  if (!isPlanCandidate(value)) return null
  return value
}

function isPlanCandidate(value: unknown): value is PlanCandidate {
  if (!isRecord(value) || !hasExactKeys(value, CANDIDATE_KEYS) || !Array.isArray(value["sessions"]) || !value["sessions"].every(isPlanSession)
      || typeof value["candidateId"] !== "string" || (value["kind"] !== "BALANCED" && value["kind"] !== "CONSERVATIVE")
      || (value["eventGroup"] !== "MIDDLE_DISTANCE" && value["eventGroup"] !== "FIVE_K")
      || !(value["eventDistanceM"] === null || parseSupportedEvent(value["eventDistanceM"]) !== null)
      || !isPlannedEnergyIntent(value["selectedEnergyIntent"])
      || (value["sourceMode"] !== "PROFILE_ONLY" && value["sourceMode"] !== "JOURNAL_CONTEXT_ONLY")
      || value["confidence"] !== "LIMITED" || !isCandidateBeta(value["beta"])
      || !(value["detailedPrescriptionFingerprint"] === null || typeof value["detailedPrescriptionFingerprint"] === "string")
      || !isContinuityContext(value["continuityContext"])
      || (value["selectionAuthority"] !== "SELF" && value["selectionAuthority"] !== "COACH_REQUIRED")
      || !isCandidateFrame(value["frame"]) || !isExposureLedger(value["mainExposureLedger"])
      || !Array.isArray(value["rationaleCodes"]) || !value["rationaleCodes"].every((code) => typeof code === "string")) return false
  const eventIdentity = `:event-${value["eventDistanceM"] ?? "unbound"}:`
  return value["candidateId"].includes(eventIdentity)
    && value["sessions"].every((session) => session.prescription.kind !== "PACE_TARGET"
    || session.prescription.scope.eventGroup === value["eventGroup"])
}

function isPlanSession(value: unknown): value is PlanSession {
  if (!isRecord(value) || typeof value["day"] !== "number" || !Number.isInteger(value["day"]) || (value["slot"] !== "AM" && value["slot"] !== "PM") || !isRecord(value["prescription"])) return false
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

function isExposureLedger(value: unknown): boolean {
  return isRecord(value) && hasExactKeys(value, ["mainExposureCount", "fingerprint", "countedExposureIds"])
    && (value["mainExposureCount"] === 2 || value["mainExposureCount"] === 3)
    && typeof value["fingerprint"] === "string" && Array.isArray(value["countedExposureIds"])
    && value["countedExposureIds"].length === value["mainExposureCount"]
    && value["countedExposureIds"].every((id) => typeof id === "string")
}

const PACE_TARGET_KEYS = ["kind", "manifestVersion", "templateId", "templateVersion", "templateContentFingerprint", "notation", "sourceDecisionId", "sourceEvidenceRef", "approvalDecisionId", "ownerAuthorityDecisionId", "sportsScienceEvidence", "populationApplicabilityEvidence", "scope", "componentRefs", "operationalComponents", "setCount", "repetitionsPerSet", "repetitionDistanceM", "targetEventDistanceM", "targetRepSeconds", "selectedAnchor", "displayRoundingPolicyVersion", "repetitionRecoverySeconds", "repetitionRecoveryMode", "setRecoverySeconds", "setRecoveryMode", "totals", "stopCodes", "fallbackCode", "prescriptionFingerprint"] as const

function isPaceTargetPrescription(value: Record<string, unknown>): boolean {
  if (!hasExactKeys(value, PACE_TARGET_KEYS)) return false
  const strings = ["manifestVersion", "templateId", "templateVersion", "templateContentFingerprint", "notation", "sourceDecisionId", "sourceEvidenceRef", "approvalDecisionId", "ownerAuthorityDecisionId", "displayRoundingPolicyVersion", "prescriptionFingerprint"]
  if (!strings.every((key) => typeof value[key] === "string" && value[key].length > 0)
      || !isEvidenceIdentity(value["sportsScienceEvidence"]) || !isEvidenceIdentity(value["populationApplicabilityEvidence"])
      || !isPaceScope(value["scope"]) || !isComponentRefs(value["componentRefs"]) || !isOperationalComponents(value["operationalComponents"])
      || !isPositiveInteger(value["setCount"]) || !isPositiveInteger(value["repetitionsPerSet"]) || !isPositiveInteger(value["repetitionDistanceM"])
      || !isPositiveInteger(value["targetEventDistanceM"]) || !isPositiveNumber(value["targetRepSeconds"])
      || !isCurrentAnchor(value["selectedAnchor"]) || !isRecovery(value["repetitionRecoverySeconds"], value["repetitionRecoveryMode"])
      || !isRecovery(value["setRecoverySeconds"], value["setRecoveryMode"]) || !isTotals(value["totals"])
      || !Array.isArray(value["stopCodes"]) || value["stopCodes"].length !== 4 || !value["stopCodes"].every(isStopCode)
      || value["fallbackCode"] !== "RPE_ONLY_CONTROLLED") return false
  const anchor = value["selectedAnchor"]
  return isRecord(anchor) && anchor["eventDistanceM"] === value["targetEventDistanceM"]
}

function isEvidenceIdentity(value: unknown): boolean {
  return isRecord(value) && hasExactKeys(value, ["evidenceId", "decisionRef", "fingerprint"])
    && ["evidenceId", "decisionRef", "fingerprint"].every((key) => typeof value[key] === "string" && value[key].length > 0)
}

function isPaceScope(value: unknown): boolean {
  return isRecord(value) && hasExactKeys(value, ["eventGroup", "experienceBand", "population", "eventEvidenceFingerprint", "experienceEvidenceFingerprint"])
    && (value["eventGroup"] === "MIDDLE_DISTANCE" || value["eventGroup"] === "FIVE_K")
    && value["experienceBand"] === "EXPERIENCED" && value["population"] === "YOUTH_AND_ADULT"
    && typeof value["eventEvidenceFingerprint"] === "string" && typeof value["experienceEvidenceFingerprint"] === "string"
}

function isComponentRefs(value: unknown): boolean {
  return Array.isArray(value) && value.length === 4 && value.every((item) =>
    isRecord(item) && hasExactKeys(item, ["componentType", "componentRef", "componentVersion", "componentFingerprint"])
    && (item["componentType"] === "WARMUP" || item["componentType"] === "COOLDOWN" || item["componentType"] === "DOWNSHIFT" || item["componentType"] === "STOP_CONDITIONS")
    && ["componentRef", "componentVersion", "componentFingerprint"].every((key) => typeof item[key] === "string" && item[key].length > 0))
}

function isOperationalComponents(value: unknown): boolean {
  if (!isRecord(value) || !hasExactKeys(value, ["warmup", "cooldown", "fallback", "stopConditions"])) return false
  const warmup = value["warmup"], cooldown = value["cooldown"], fallback = value["fallback"], stop = value["stopConditions"]
  return isRecord(warmup) && hasExactKeys(warmup, ["componentRef", "componentVersion", "authority", "easyDurationMinutes", "rpeMin", "rpeMax", "strides"])
    && (warmup["componentRef"] === "WU-V2-5K-01" || warmup["componentRef"] === "WU-MD-01") && warmup["componentVersion"] === "1.0.0" && warmup["authority"] === "OWNER_OPERATIONAL_ADAPTATION" && warmup["easyDurationMinutes"] === 15 && warmup["rpeMin"] === 2 && warmup["rpeMax"] === 3
    && isRecord(warmup["strides"]) && hasExactKeys(warmup["strides"], ["repetitions", "durationSeconds", "recoverySeconds", "recoveryMode", "progression"]) && warmup["strides"]["repetitions"] === 4 && warmup["strides"]["durationSeconds"] === 20 && warmup["strides"]["recoverySeconds"] === 40 && warmup["strides"]["recoveryMode"] === "WALK_OR_JOG" && warmup["strides"]["progression"] === "PROGRESSIVE"
    && isRecord(cooldown) && hasExactKeys(cooldown, ["componentRef", "componentVersion", "authority", "easyDurationMinutes", "rpeMin", "rpeMax"]) && (cooldown["componentRef"] === "CD-V2-5K-01" || cooldown["componentRef"] === "CD-MD-01") && cooldown["componentVersion"] === "1.0.0" && cooldown["authority"] === "OWNER_OPERATIONAL_ADAPTATION" && cooldown["easyDurationMinutes"] === 10 && cooldown["rpeMin"] === 1 && cooldown["rpeMax"] === 2
    && isRecord(fallback) && hasExactKeys(fallback, ["componentRef", "componentVersion", "code", "behavior", "numericRepetitionVariant"]) && fallback["componentRef"] === "RPE-ONLY-CONTROLLED-01" && fallback["componentVersion"] === "1.0.0" && fallback["code"] === "RPE_ONLY_CONTROLLED" && fallback["behavior"] === "DELEGATE_TO_EXISTING_RPE_CANDIDATE" && fallback["numericRepetitionVariant"] === null
    && isRecord(stop) && hasExactKeys(stop, ["componentRef", "componentVersion", "authority", "diagnosticClaim", "codes"]) && (stop["componentRef"] === "STOP-V2-5K-01" || stop["componentRef"] === "STOP-MD-01") && stop["componentVersion"] === "1.0.0" && stop["authority"] === "OWNER_PRECAUTIONARY_OPERATIONAL_RULE" && stop["diagnosticClaim"] === false && Array.isArray(stop["codes"]) && stop["codes"].length === 4 && stop["codes"].every(isStopCode)
}

function isCurrentAnchor(value: unknown): boolean {
  if (!isRecord(value) || !hasExactKeys(value, ["anchorId", "eventDistanceM", "performanceSeconds", "achievedAt", "enteredBy", "verificationState", "freshnessState", "sourceRef", "elapsedLabel", "kind", "purpose", "seasonId"])) return false
  return typeof value["anchorId"] === "string" && isPositiveNumber(value["eventDistanceM"]) && isPositiveNumber(value["performanceSeconds"])
    && typeof value["achievedAt"] === "string" && (value["enteredBy"] === "ATHLETE" || value["enteredBy"] === "COACH" || value["enteredBy"] === "VERIFIED_IMPORT")
    && (value["verificationState"] === "VERIFIED" || value["verificationState"] === "SELF_REPORTED" || value["verificationState"] === "UNVERIFIED")
    && value["freshnessState"] === "CURRENT" && typeof value["sourceRef"] === "string" && typeof value["elapsedLabel"] === "string"
    && ((value["kind"] === "SB" && value["purpose"] === "SEASON_CONTEXT" && typeof value["seasonId"] === "string" && value["seasonId"].length > 0)
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
    && Array.isArray(value["uncomputableReasonCodes"]) && value["uncomputableReasonCodes"].every((code) => typeof code === "string")
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
      return request.trigger.requestedBy === actor && request.trigger.sourceRef.startsWith(`${actor.toLowerCase()}-request:${request.scope.athleteId}:`)
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
function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean { return canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort()) }
function containsPrivateKey(value: unknown, seen = new Set<object>()): boolean {
  if (typeof value !== "object" || value === null) return false
  if (seen.has(value)) return false
  seen.add(value)
  return Object.entries(value).some(([key, child]) => PRIVATE_KEY.test(key) || containsPrivateKey(child, seen))
}
function isJsonValue(value: unknown): boolean { return value === null || typeof value === "string" || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value)) || (Array.isArray(value) ? value.every(isJsonValue) : isRecord(value) && Object.values(value).every(isJsonValue)) }
