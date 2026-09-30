import { rebindCandidatePairIdentity } from "@impl/plan-generator/candidate-identity"
import { isVerifiedPlanCandidate } from "@impl/plan-generator/adaptation"
import { isInitialCandidatePair } from "@impl/plan-generator/support-only-candidate-pair"
import { bindCatalogSession } from "@impl/prescription/catalog-session-binding"
import type { WorkoutCalculationInputs } from "@impl/prescription/all-workout-calculator"
import type { PlanGenerationSuccess } from "@impl/plan-generator/types"

export function replaceCandidateCatalogWorkout(generated: PlanGenerationSuccess, address: { day: number; slot: "AM" | "PM" },
  id: string, inputs: WorkoutCalculationInputs, acceptLongerDuration = false): PlanGenerationSuccess | null {
  const candidates = generated.candidates.map(candidate => {
    if (candidate.eventDistanceM !== inputs.eventDistanceM || !candidate.candidateId.includes(`:${inputs.experience.toLowerCase()}:`)) return null
    const index = candidate.sessions.findIndex(s => s.day === address.day && s.slot === address.slot)
    if (index < 0) return null
    const selected = candidate.sessions[index]!
    const replacement = bindCatalogSession(selected, id, inputs, acceptLongerDuration)
    if (!replacement) return null
    return { ...candidate, sessions: candidate.sessions.map((s, i) => i === index ? replacement : s) }
  })
  const first = candidates[0], second = candidates[1]
  if (!first || !second || candidates.length !== 2) return null
  const pair = rebindCandidatePairIdentity([first, second])
  if (!pair.every(isVerifiedPlanCandidate) || !isInitialCandidatePair(pair[0], pair[1])) return null
  return { ...generated, candidates: pair, pairId: pair[0].pairId }
}
