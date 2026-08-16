import { selectPlanForActivation } from "../../domain/plan-beta-flow"
import type { PlanAthleteEvidence } from "../../domain/plan-beta-flow"
import { savePlanBetaState } from "../../domain/plan-beta-store"
import type {
  PlanBetaIntake,
  PlanBetaState,
} from "../../domain/plan-beta-store"
import type {
  PlanCandidate,
  PlanGenerationSuccess,
} from "@impl/plan-generator/types"
import type { SafetyGateDecision } from "@impl/safety-gate/gate"
import { isValidIsoDate } from "../../domain/dates"

export type CandidateSelection = {
  readonly candidate: PlanCandidate
  readonly startDate: string
}

export type CandidateSaveResult =
  | { readonly kind: "saved"; readonly state: PlanBetaState }
  | { readonly kind: "rejected"; readonly code: string }

export function saveSelectedPlanCandidate(
  selection: CandidateSelection,
  generated: PlanGenerationSuccess,
  gate: SafetyGateDecision,
  intake: PlanBetaIntake | null,
  athleteEvidence: PlanAthleteEvidence,
): CandidateSaveResult {
  if (intake === null || !isValidIsoDate(selection.startDate)) {
    return { kind: "rejected", code: "MINIMUM_PROFILE_INCOMPLETE" }
  }
  const selected = selectPlanForActivation(selection.candidate, generated, gate, {
    ...intake,
    startDate: selection.startDate,
  }, athleteEvidence)
  if (selected.kind !== "selected") {
    return { kind: "rejected", code: selected.code }
  }
  const saved = savePlanBetaState(selected.state)
  if (!saved.ok) {
    return { kind: "rejected", code: saved.code }
  }
  return { kind: "saved", state: selected.state }
}
