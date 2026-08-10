import { selectPlanForActivation } from "../../domain/plan-beta-flow"
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

export type CandidateSaveResult =
  | { readonly kind: "saved"; readonly state: PlanBetaState }
  | { readonly kind: "rejected"; readonly code: string }

export function saveSelectedPlanCandidate(
  candidate: PlanCandidate,
  generated: PlanGenerationSuccess,
  gate: SafetyGateDecision,
  intake: PlanBetaIntake | null,
): CandidateSaveResult {
  if (intake === null) {
    return { kind: "rejected", code: "MINIMUM_PROFILE_INCOMPLETE" }
  }
  const selection = selectPlanForActivation(candidate, generated, gate, intake)
  if (selection.kind !== "selected") {
    return { kind: "rejected", code: selection.code }
  }
  const saved = savePlanBetaState(selection.state)
  if (!saved.ok) {
    return { kind: "rejected", code: saved.code }
  }
  return { kind: "saved", state: selection.state }
}
