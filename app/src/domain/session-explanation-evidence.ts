import type { PlanSession } from "@impl/plan-generator/types"
import { parsePlanBetaState, type PlanBetaState } from "./plan-beta-schema"
import type { JournalEntry } from "./journal-schema"
import { collectPlanJournalEvidence, type PlanJournalEvidenceRow, type PlanJournalHistory } from "./plan-journal-evidence"
import { createPlannedSessionLogDraft } from "./planned-session-link"
import { collectPlanMethodObservations, type PlanMethodObservation } from "./plan-method-observations"

export type SessionExplanationEvidence = {
  readonly candidateId: string
  readonly generatedAt: string
  readonly sessionId: string
  readonly rows: readonly PlanJournalEvidenceRow[]
  readonly historyReadIncomplete?: boolean
  readonly methodObservation?: PlanMethodObservation
}

export function collectSessionExplanationEvidence(entries: readonly JournalEntry[], state: PlanBetaState, session: PlanSession, history?: PlanJournalHistory): SessionExplanationEvidence | null {
  const target = createPlannedSessionLogDraft(state, session, state.generatedAt)
  if (target === null) return null
  const originals = history?.kind === "loaded"
    ? history.plans.map(parsePlanBetaState).filter((plan): plan is PlanBetaState => plan !== null) : []
  const methodObservation = collectPlanMethodObservations(entries, originals, state).rows
    .find(row => row.occurrence.plannedSessionId === target.link.plannedSessionId)
  const evidence = collectPlanJournalEvidence(entries, state, history)
  return {
    candidateId: state.activePlan.candidateId,
    generatedAt: state.generatedAt,
    sessionId: target.link.plannedSessionId,
    rows: evidence.rows.filter((row) => row.currentPlannedSessionId === target.link.plannedSessionId),
    historyReadIncomplete: evidence.historyReadIncomplete,
    ...(methodObservation === undefined ? {} : { methodObservation }),
  }
}
