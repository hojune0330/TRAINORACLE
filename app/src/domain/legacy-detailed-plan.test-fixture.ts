import { generatePlanCandidates, selectPlanCandidate } from "@impl/plan-generator/generator"
import { bindDetailedPrescriptionCandidates } from "./plan-candidate-prescription"
import { createPlanFormation } from "./plan-beta-formation"
import { evaluatePlanSafety, generatePlanFromDraft, type PlanDraftGeneration } from "./plan-beta-flow"
import { planBetaStateV3Schema, type PlanBetaIntake, type PlanBetaStateV3 } from "./plan-beta-schema"
import { savePlanBetaState } from "./plan-beta-store"
import { savePlanAdaptationContext } from "./plan-adaptation-ui-context"
import { createInitialPeriodizationContext } from "./periodization-lineage"
import { createExplanationReceipt } from "./training-explanation-receipt"
import { todayISO } from "./journal-store"

type GeneratedDraft = Extract<PlanDraftGeneration, { kind: "generated" }>

/** Replays e8cad36c's exact-template lane before remaining MAINs gained catalog bindings.
 * Core generation, formation and the approved detailed binder are unchanged from that
 * revision. No calculated workout is stripped or weakened to manufacture a legacy plan.
 */
export function generateLegacyDetailedPlanFixture(
  draft: Parameters<typeof generatePlanFromDraft>[0],
  currentCheck: "NO_KNOWN_RISK",
  prescriptionSelection: { readonly selectedRecordId: string },
): GeneratedDraft {
  const current = generatePlanFromDraft(draft, currentCheck, prescriptionSelection)
  if (current.kind !== "generated") throw new Error(`Expected generated intake: ${current.kind}`)
  const intake = current.intake
  if (intake.selectedDetailedTemplateRef === null) throw new Error("Expected an exact legacy template")
  const evaluatedAt = new Date()
  const safety = evaluatePlanSafety(currentCheck, evaluatedAt)
  if (safety.kind !== "passed") throw new Error("Legacy fixture safety did not pass")
  const availableTrainingDays = legacyTrainingDays(intake)
  const original = generatePlanCandidates({
    kind: "PLAN_BETA_GENERATION_REQUEST",
    safetyGate: safety.gate,
    profile: {
      eventGroup: intake.eventGroup,
      eventDistanceM: intake.eventDistanceM,
      experienceBand: intake.experienceBand,
      availableTrainingDays,
      secondSessionMode: intake.secondSessionMode,
      trainingTimePreference: intake.trainingTimePreference,
    },
    formation: createPlanFormation(todayISO(evaluatedAt), availableTrainingDays, intake.experienceBand),
    requestedFrameLength: intake.requestedFrameLength,
    selectedEnergyIntent: intake.trainingFocus,
    selectedDetailedTemplateRef: intake.selectedDetailedTemplateRef,
    journalSource: safety.journalSource,
    selectionAuthority: "SELF",
  })
  if (original.kind !== "generated") throw new Error(`Expected historical source: ${original.kind}`)
  const binding = bindDetailedPrescriptionCandidates(original, intake, safety.gate,
    prescriptionSelection, evaluatedAt)
  if (binding.kind !== "bound") throw new Error(`Legacy detailed binding failed: ${binding.code}`)
  if (binding.generated.candidates.some(candidate => candidate.sessions.some(session => (
    session.prescription.kind === "RPE_TIME_RANGE" && session.prescription.catalogWorkout !== undefined
  )))) throw new Error("Historical fixture acquired a later catalog prescription")
  return { ...current, generated: binding.generated,
    prescriptionBinding: { kind: binding.kind, code: binding.code } }
}

/** Restores an already-saved pre-catalog plan through today's schema/storage reader.
 * This is test setup for legacy compatibility, never a new-draft activation bypass.
 */
export function restoreLegacyDetailedPlanFixture(
  generated: GeneratedDraft,
  startDate: string,
  candidateKind: "BALANCED" | "CONSERVATIVE" = "BALANCED",
): PlanBetaStateV3 {
  const candidate = generated.generated.candidates.find(item => item.kind === candidateKind)
  if (candidate === undefined) throw new Error(`Missing historical ${candidateKind} candidate`)
  const selected = selectPlanCandidate({ kind: "PLAN_BETA_SELECTION_REQUEST",
    generatedPlan: generated.generated, selectedCandidateId: candidate.candidateId,
    actor: "SELF", safetyGate: generated.gate })
  if (selected.kind !== "selected") throw new Error(`Historical selection failed: ${selected.kind}`)
  const generatedAt = new Date().toISOString()
  const state = planBetaStateV3Schema.parse({ version: 3,
    intake: { ...generated.intake, startDate }, activePlan: selected.activePlan, progress: [], generatedAt,
    periodization: createInitialPeriodizationContext(candidate.candidateId, generatedAt),
    athleteEvidence: generated.athleteEvidence,
    explanationReceipt: createExplanationReceipt(selected.activePlan, generatedAt),
    adaptationScope: { athleteId: "local-athlete", eventDistanceM: candidate.eventDistanceM,
      pairId: candidate.pairId, selectedDetailedTemplateRef: candidate.selectedDetailedTemplateRef },
  })
  if (!savePlanBetaState(state).ok) throw new Error("Historical state did not survive storage validation")
  if (!savePlanAdaptationContext(generated.generated.candidates, candidate.candidateId).ok) {
    throw new Error("Historical comparison context did not survive storage validation")
  }
  return state
}

// Frozen request mapping from e8cad36c's spreadTrainingDays; this is fixture history,
// not a second production scheduling policy.
function legacyTrainingDays(intake: PlanBetaIntake): readonly number[] {
  const visibleDays = Math.ceil(intake.requestedFrameLength)
  const count = intake.availableDayCount
  if (count === "EVERY_DAY") return Array.from({ length: visibleDays }, (_, index) => index + 1)
  const tenDayMatrix = { 3: [1, 5, 9], 4: [1, 4, 7, 10], 5: [1, 3, 5, 7, 9],
    6: [1, 3, 5, 6, 8, 10] } as const
  return visibleDays === 10 ? tenDayMatrix[count] : Array.from({ length: count },
    (_, index) => Math.round(1 + index * (visibleDays - 1) / (count - 1)))
}
