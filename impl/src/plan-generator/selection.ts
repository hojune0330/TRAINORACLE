import { assertNever } from "../shared/assert-never"
import { isRecord, parseSafetyGate } from "./input-values"
import { isVerifiedPlanCandidate } from "./adaptation"
import { isSupportOnlyCandidatePair } from "./support-only-candidate-pair"
import type {
  BetaActivePlanSnapshot,
  CanonicalPlanFrame,
  PlanBetaAudit,
  PlanCandidate,
  PlanGenerationSuccess,
  PlanSelectionResult,
  PlanSession,
} from "./types"

function audit(
  event: PlanBetaAudit["event"],
  codes: PlanBetaAudit["codes"],
): PlanBetaAudit {
  return Object.freeze({
    event,
    codes: Object.freeze([...codes]),
    privacy: "STRUCTURED_CODES_ONLY",
  })
}

function copyFrame(frame: CanonicalPlanFrame): CanonicalPlanFrame {
  const base: CanonicalPlanFrame = {
    formationKind: "LOCAL_CIVIL_9_5",
    lengthDays: frame.lengthDays,
    slotCount: frame.slotCount,
    continuity: frame.continuity.kind === "SEVEN_DAY_CONTINUITY"
      ? Object.freeze({
          kind: "SEVEN_DAY_CONTINUITY" as const,
          nextFrameInput: "SELECTED_PLAN_AND_PROGRESS" as const,
        })
      : Object.freeze({ kind: "STANDARD_FRAME" as const }),
  }
  return frame.projectionLengthDays === undefined
    ? Object.freeze(base)
    : Object.freeze({ ...base, projectionLengthDays: frame.projectionLengthDays })
}

function copySession(session: PlanSession): PlanSession {
  switch (session.role) {
    case "REST":
      return Object.freeze({
        day: session.day,
        slot: "AM",
        role: "REST",
        plannedEnergyIntent: "RECOVERY_INTENT",
        prescription: Object.freeze({ kind: "REST" }),
      })
    case "EASY":
      return Object.freeze({
        day: session.day,
        slot: session.slot,
        role: "EASY",
        plannedEnergyIntent: session.plannedEnergyIntent,
        prescription: Object.freeze({
          kind: "RPE_TIME_RANGE",
          rpe: Object.freeze({ ...session.prescription.rpe }),
          durationMinutes: Object.freeze({ ...session.prescription.durationMinutes }),
        }),
      })
    case "QUALITY":
      if (session.prescription.kind === "PACE_TARGET") {
        return Object.freeze({
          day: session.day,
          slot: session.slot,
          role: "QUALITY",
          plannedEnergyIntent: session.plannedEnergyIntent,
          prescription: session.prescription,
        })
      }
      return Object.freeze({
        day: session.day,
        slot: session.slot,
        role: "QUALITY",
        plannedEnergyIntent: session.plannedEnergyIntent,
        prescription: Object.freeze({
          kind: "RPE_TIME_RANGE",
          rpe: Object.freeze({ ...session.prescription.rpe }),
          durationMinutes: Object.freeze({ ...session.prescription.durationMinutes }),
        }),
      })
    default:
      return assertNever(session)
  }
}

function createActiveSnapshot(
  candidate: PlanCandidate,
  actor: "SELF" | "COACH",
): BetaActivePlanSnapshot {
  return Object.freeze({
    kind: "BETA_ACTIVE_PLAN_SNAPSHOT",
    activationState: "SELECTED_BETA_SNAPSHOT",
    candidateId: candidate.candidateId,
    pairId: candidate.pairId,
    candidateKind: candidate.kind,
    eventDistanceM: candidate.eventDistanceM,
    selectedDetailedTemplateRef: candidate.selectedDetailedTemplateRef,
    selectionActor: actor,
    sourceMode: candidate.sourceMode,
    selectedEnergyIntent: candidate.selectedEnergyIntent,
    frame: copyFrame(candidate.frame),
    sessions: Object.freeze(candidate.sessions.map(copySession)),
  })
}

function blockedSelection(): PlanSelectionResult {
  return {
    kind: "blocked",
    code: "SAFETY_GATE_RECHECK_BLOCKED",
    audit: audit("PLAN_BETA_SELECTION_REJECTED", ["SAFETY_GATE_RECHECK_BLOCKED"]),
  }
}

function rejectSelection(
  code:
    | "COACH_SELECTION_REQUIRED"
    | "CANDIDATE_NOT_FOUND"
    | "INVALID_SELECTION_REQUEST"
    | "NON_SELECTABLE_PLAN_RESULT"
    | "STALE_CANDIDATE_FINGERPRINT"
    | "NONCANONICAL_CANDIDATE_FRAME",
): PlanSelectionResult {
  return {
    kind: "rejected",
    code,
    audit: audit("PLAN_BETA_SELECTION_REJECTED", [code]),
  }
}

function isGeneratedPlan(value: unknown): value is PlanGenerationSuccess {
  try {
    if (!isRecord(value) || value["kind"] !== "generated") return false

    const candidates = value["candidates"]
    const pairId = value["pairId"]
    const selectionAuthority = value["selectionAuthority"]
    if (typeof pairId !== "string"
        || !/^plan-pair:v3:/u.test(pairId)
        || (selectionAuthority !== "SELF" && selectionAuthority !== "COACH_REQUIRED")
        || !Array.isArray(candidates)
        || candidates.length !== 2
        || !Object.prototype.hasOwnProperty.call(candidates, 0)
        || !Object.prototype.hasOwnProperty.call(candidates, 1)) {
      return false
    }

    const first: unknown = candidates[0]
    const second: unknown = candidates[1]
    return isVerifiedPlanCandidate(first)
      && isVerifiedPlanCandidate(second)
      && first.pairId === pairId
      && second.pairId === pairId
      && first.selectionAuthority === selectionAuthority
      && second.selectionAuthority === selectionAuthority
      && first.kind === "BALANCED"
      && second.kind === "CONSERVATIVE"
      && first.candidateId !== second.candidateId
  } catch {
    return false
  }
}

function hasCanonicalProjectionContinuity(frame: Record<string, unknown>): boolean {
  const projectionLengthDays = frame["projectionLengthDays"]
  const continuity = frame["continuity"]
  if (!isRecord(continuity)) return false

  if (projectionLengthDays === 7) {
    return continuity["kind"] === "SEVEN_DAY_CONTINUITY"
      && continuity["nextFrameInput"] === "SELECTED_PLAN_AND_PROGRESS"
  }

  return (
    projectionLengthDays === undefined
    || projectionLengthDays === 9
    || projectionLengthDays === 9.5
    || projectionLengthDays === 10
  ) && continuity["kind"] === "STANDARD_FRAME"
}

function generatedPlanGuard(value: unknown):
  | { readonly kind: "valid"; readonly generatedPlan: PlanGenerationSuccess }
  | { readonly kind: "rejected"; readonly code: "NON_SELECTABLE_PLAN_RESULT" | "STALE_CANDIDATE_FINGERPRINT" | "NONCANONICAL_CANDIDATE_FRAME" } {
  if (isRecord(value) && Array.isArray(value["candidates"])) {
    for (const candidate of value["candidates"]) {
      if (!isRecord(candidate) || !isRecord(candidate["frame"])) continue
      const frame = candidate["frame"]
      if (
        frame["formationKind"] !== "LOCAL_CIVIL_9_5"
        || frame["lengthDays"] !== 9.5
        || frame["slotCount"] !== 19
        || !hasCanonicalProjectionContinuity(frame)
      ) {
        return { kind: "rejected", code: "NONCANONICAL_CANDIDATE_FRAME" }
      }
    }
  }
  if (
    isRecord(value)
    && value["kind"] === "generated"
    && typeof value["pairId"] === "string"
    && /^plan-pair:v3:/u.test(value["pairId"])
    && Array.isArray(value["candidates"])
    && value["candidates"].length === 2
    && value["candidates"].every((candidate) => (
      isRecord(candidate)
      && typeof candidate["candidateId"] === "string"
      && typeof candidate["pairId"] === "string"
    ))
    && !value["candidates"].every(isVerifiedPlanCandidate)
  ) {
    return { kind: "rejected", code: "STALE_CANDIDATE_FINGERPRINT" }
  }
  if (!isGeneratedPlan(value)) {
    return { kind: "rejected", code: "NON_SELECTABLE_PLAN_RESULT" }
  }

  for (const candidate of value.candidates) {
    const frame = candidate.frame
    if (
      frame["formationKind"] !== "LOCAL_CIVIL_9_5"
      || frame["lengthDays"] !== 9.5
      || frame["slotCount"] !== 19
      || !hasCanonicalProjectionContinuity(frame)
    ) {
      return { kind: "rejected", code: "NONCANONICAL_CANDIDATE_FRAME" }
    }
    const ledger = candidate.mainExposureLedger
    const countedExposureIds = ledger.countedExposureIds
    if (!Array.isArray(countedExposureIds) || !countedExposureIds.every((id) => typeof id === "string")) {
      return { kind: "rejected", code: "STALE_CANDIDATE_FINGERPRINT" }
    }
    if ((ledger.mainExposureCount !== 2 && ledger.mainExposureCount !== 3) || ledger.mainExposureCount !== countedExposureIds.length || ledger.fingerprint !== countedExposureIds.join(":")) {
      return { kind: "rejected", code: "STALE_CANDIDATE_FINGERPRINT" }
    }
    if (!candidate.candidateId.includes(countedExposureIds.join("-"))) {
      return { kind: "rejected", code: "STALE_CANDIDATE_FINGERPRINT" }
    }
    if (
      candidate.detailedPrescriptionFingerprint !== null
      && !candidate.candidateId.includes(candidate.detailedPrescriptionFingerprint)
    ) {
      return { kind: "rejected", code: "STALE_CANDIDATE_FINGERPRINT" }
    }
  }

  if (!isSupportOnlyCandidatePair(value.candidates[0], value.candidates[1])) {
    return { kind: "rejected", code: "STALE_CANDIDATE_FINGERPRINT" }
  }

  return { kind: "valid", generatedPlan: value }
}

export function selectPlanCandidate(request: unknown): PlanSelectionResult {
  try {
    return selectPlanCandidateUnchecked(request)
  } catch {
    return rejectSelection("INVALID_SELECTION_REQUEST")
  }
}

function selectPlanCandidateUnchecked(request: unknown): PlanSelectionResult {
  if (!isRecord(request) || request["kind"] !== "PLAN_BETA_SELECTION_REQUEST") {
    return rejectSelection("INVALID_SELECTION_REQUEST")
  }

  const safetyGate = parseSafetyGate(request["safetyGate"])
  if (safetyGate === undefined) {
    return rejectSelection("INVALID_SELECTION_REQUEST")
  }
  switch (safetyGate.kind) {
    case "blocked":
      return blockedSelection()
    case "passed":
      break
    default:
      return assertNever(safetyGate)
  }

  const guardedPlan = generatedPlanGuard(request["generatedPlan"])
  if (guardedPlan.kind === "rejected") {
    return rejectSelection(guardedPlan.code)
  }
  const actor = request["actor"]
  const selectedCandidateId = request["selectedCandidateId"]
  if ((actor !== "SELF" && actor !== "COACH") || typeof selectedCandidateId !== "string") {
    return rejectSelection("INVALID_SELECTION_REQUEST")
  }

  if (
    guardedPlan.generatedPlan.selectionAuthority === "COACH_REQUIRED" &&
    actor === "SELF"
  ) {
    return rejectSelection("COACH_SELECTION_REQUIRED")
  }

  const candidate = guardedPlan.generatedPlan.candidates.find(
    (item) => item.candidateId === selectedCandidateId,
  )
  if (candidate === undefined) {
    return rejectSelection("CANDIDATE_NOT_FOUND")
  }

  return {
    kind: "selected",
    activePlan: createActiveSnapshot(candidate, actor),
    audit: audit("PLAN_BETA_SELECTED", []),
  }
}
