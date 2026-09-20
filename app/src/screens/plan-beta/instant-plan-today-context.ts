import type { PlanBetaState } from "../../domain/plan-beta-store"
import { evaluatePlanSafety } from "../../domain/plan-beta-flow"
import { loadEntries, todayISO } from "../../domain/journal-store"
import { resolveCurrentPlannedSession } from "../../domain/planned-session-link"
import { recheckStoredDetailedPrescriptionAuthority } from "../../domain/plan-session-schema"
import { instantSessionId, projectInstantToday } from "./instant-plan-today"

/** A display preflight, never an execution authorization or a progress write. */
export function projectCurrentInstantToday(state: PlanBetaState, now = new Date()) {
  const linkedSessionIds = loadEntries().flatMap(entry => {
    if (entry.kind !== "post-session" || !entry.plannedSessionLink
      || entry.date !== entry.plannedSessionLink.plannedDate) return []
    const session = resolveCurrentPlannedSession(state, entry.plannedSessionLink)
    return session ? [instantSessionId(session)] : []
  })
  const today = projectInstantToday(state, todayISO(now), linkedSessionIds)
  if (!today.sessions.length) return today
  // This can only suppress instructions. Starting still needs the athlete's fresh answer.
  const safety = evaluatePlanSafety("NO_KNOWN_RISK", now)
  const unavailable = (title: string) => ({ ...today, title, state: "UNAVAILABLE" as const, sessions: [] })
  if (safety.kind === "blocked") return unavailable("최근 기록과 몸 상태를 먼저 확인해 주세요")
  const ids = new Set(today.sessions.map(session => session.id))
  const unavailableAuthority = state.activePlan.sessions.some(session => ids.has(instantSessionId(session))
    && session.prescription.kind === "PACE_TARGET"
    && recheckStoredDetailedPrescriptionAuthority({ operation: "START", prescription: session.prescription,
      evaluatedAt: now.toISOString(), safetyGate: safety.gate }).kind !== "permitted")
  return unavailableAuthority ? unavailable("상세 훈련의 현재 승인 상태를 확인해 주세요") : today
}
