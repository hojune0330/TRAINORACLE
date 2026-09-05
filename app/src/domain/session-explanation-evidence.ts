import type { PlanSession } from "@impl/plan-generator/types"
import type { PlanBetaState } from "./plan-beta-schema"
import type { JournalEntry } from "./journal-schema"
import { collectPlanJournalEvidence, type PlanJournalEvidenceRow } from "./plan-journal-evidence"
import { createPlannedSessionLogDraft } from "./planned-session-link"
import { collectPlanMethodObservations, type PlanMethodObservation } from "./plan-method-observations"

export type SessionExplanationEvidence = {
  readonly candidateId: string
  readonly generatedAt: string
  readonly sessionId: string
  readonly rows: readonly PlanJournalEvidenceRow[]
  readonly methodObservation?: PlanMethodObservation
}

export function collectSessionExplanationEvidence(entries: readonly JournalEntry[], state: PlanBetaState, session: PlanSession): SessionExplanationEvidence | null {
  const target = createPlannedSessionLogDraft(state, session, state.generatedAt)
  if (target === null) return null
  const methodObservation = collectPlanMethodObservations(entries, [state]).rows
    .find(row => row.occurrence.plannedSessionId === target.link.plannedSessionId)
  return {
    candidateId: state.activePlan.candidateId,
    generatedAt: state.generatedAt,
    sessionId: target.link.plannedSessionId,
    rows: collectPlanJournalEvidence(entries, state).rows.filter((row) => row.plannedSessionId === target.link.plannedSessionId),
    ...(methodObservation === undefined ? {} : { methodObservation }),
  }
}
