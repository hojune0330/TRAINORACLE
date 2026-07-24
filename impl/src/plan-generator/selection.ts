import { assertNever } from "../shared/assert-never"
import type {
  BetaActivePlanSnapshot,
  PlanBetaAudit,
  PlanCandidate,
  PlanFrame,
  PlanSelectionRequest,
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

function copyFrame(frame: PlanFrame): PlanFrame {
  switch (frame.continuity.kind) {
    case "SEVEN_DAY_CONTINUITY":
      return Object.freeze({
        lengthDays: frame.lengthDays,
        continuity: Object.freeze({
          kind: "SEVEN_DAY_CONTINUITY",
          nextFrameInput: "SELECTED_PLAN_AND_PROGRESS",
        }),
      })
    case "STANDARD_FRAME":
      return Object.freeze({
        lengthDays: frame.lengthDays,
        continuity: Object.freeze({ kind: "STANDARD_FRAME" }),
      })
    default:
      return assertNever(frame.continuity)
  }
}

function copySession(session: PlanSession): PlanSession {
  switch (session.role) {
    case "REST":
      return Object.freeze({
        day: session.day,
        role: "REST",
        prescription: Object.freeze({ kind: "REST" }),
      })
    case "EASY":
    case "QUALITY":
      return Object.freeze({
        day: session.day,
        role: session.role,
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
    candidateKind: candidate.kind,
    selectionActor: actor,
    sourceMode: candidate.sourceMode,
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
  code: "COACH_SELECTION_REQUIRED" | "CANDIDATE_NOT_FOUND",
): PlanSelectionResult {
  return {
    kind: "rejected",
    code,
    audit: audit("PLAN_BETA_SELECTION_REJECTED", [code]),
  }
}

export function selectPlanCandidate(request: PlanSelectionRequest): PlanSelectionResult {
  switch (request.safetyGate.kind) {
    case "blocked":
      return blockedSelection()
    case "passed":
      break
    default:
      return assertNever(request.safetyGate)
  }

  if (
    request.generatedPlan.selectionAuthority === "COACH_REQUIRED" &&
    request.actor === "SELF"
  ) {
    return rejectSelection("COACH_SELECTION_REQUIRED")
  }

  const candidate = request.generatedPlan.candidates.find(
    (item) => item.candidateId === request.selectedCandidateId,
  )
  if (candidate === undefined) {
    return rejectSelection("CANDIDATE_NOT_FOUND")
  }

  return {
    kind: "selected",
    activePlan: createActiveSnapshot(candidate, request.actor),
    audit: audit("PLAN_BETA_SELECTED", []),
  }
}
