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
import {
  adaptationScopeForCandidate,
  savePlanAdaptationContext,
} from "../../domain/plan-adaptation-ui"

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
  const adaptationScope = adaptationScopeForCandidate(selection.candidate)
  const state = adaptationScope === null
    ? selected.state
    : { ...selected.state, adaptationScope }
  const saved = savePlanBetaState(state)
  if (!saved.ok) {
    return { kind: "rejected", code: saved.code }
  }
  if (adaptationScope !== null) {
    savePlanAdaptationContext(generated.candidates, selection.candidate.candidateId)
  }
  return { kind: "saved", state }
}
