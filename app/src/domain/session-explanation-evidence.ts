import type { PlanSession } from "@impl/plan-generator/types"
import type { PlanBetaState } from "./plan-beta-schema"
import type { JournalEntry } from "./journal-schema"
import { collectPlanJournalEvidence, type PlanJournalEvidenceRow } from "./plan-journal-evidence"
import { createPlannedSessionLogDraft } from "./planned-session-link"

export type SessionExplanationEvidence = {
  readonly candidateId: string
  readonly generatedAt: string
  readonly sessionId: string
  readonly rows: readonly PlanJournalEvidenceRow[]
}

export function collectSessionExplanationEvidence(entries: readonly JournalEntry[], state: PlanBetaState, session: PlanSession): SessionExplanationEvidence | null {
  const target = createPlannedSessionLogDraft(state, session, state.generatedAt)
  if (target === null) return null
  return {
    candidateId: state.activePlan.candidateId,
    generatedAt: state.generatedAt,
    sessionId: target.link.plannedSessionId,
    rows: collectPlanJournalEvidence(entries, state).rows.filter((row) => row.plannedSessionId === target.link.plannedSessionId),
  }
}
