import type {
  PlanBetaAudit,
  PlanProgressRequest,
  PlanProgressResult,
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

export function recordPlanProgress(request: PlanProgressRequest): PlanProgressResult {
  const hasSessionDay = request.activePlan.sessions.some(
    (session) => session.day === request.sessionDay,
  )
  if (!hasSessionDay) {
    return {
      kind: "rejected",
      code: "SESSION_DAY_NOT_IN_ACTIVE_PLAN",
      audit: audit("PLAN_BETA_PROGRESS_REJECTED", ["SESSION_DAY_NOT_IN_ACTIVE_PLAN"]),
    }
  }

  const hasSessionSlot = request.activePlan.sessions.some(
    (session) => (
      session.day === request.sessionDay
      && session.slot === request.sessionSlot
    ),
  )
  if (!hasSessionSlot) {
    return {
      kind: "rejected",
      code: "SESSION_SLOT_NOT_IN_ACTIVE_PLAN",
      audit: audit("PLAN_BETA_PROGRESS_REJECTED", ["SESSION_SLOT_NOT_IN_ACTIVE_PLAN"]),
    }
  }

  return {
    kind: "recorded",
    progress: Object.freeze({
      activePlanCandidateId: request.activePlan.candidateId,
      sessionDay: request.sessionDay,
      sessionSlot: request.sessionSlot,
      state: request.state,
    }),
    audit: audit("PLAN_BETA_PROGRESS_RECORDED", []),
  }
}
