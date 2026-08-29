import type { PlannedEnergyIntent } from "@impl/plan-generator/types"
import { DETAILED_PRESCRIPTION_APPROVALS } from "../../domain/detailed-prescription-approvals"
import { resolveDetailedPrescriptionRuntimeAuthority } from "../../domain/detailed-prescription-runtime-authority"
import type { PlanBetaIntake } from "../../domain/plan-beta-store"

export type DetailedPlanTemplateOption = {
  readonly ref: PlanBetaIntake["selectedDetailedTemplateRef"] & object
  readonly notation: string
  readonly targetEventDistanceM: PlanBetaIntake["eventDistanceM"]
  readonly trainingFocus: PlannedEnergyIntent
}

const TEMPLATE_INTENTS: Readonly<Record<string, PlannedEnergyIntent>> = Object.freeze({
  "MD-800-01": "GLY_INTENT",
  "MD-1500-01": "MIXED_INTENT",
  "MD-3000-01": "VO2_INTENT",
  "V2-SEED-05": "VO2_INTENT",
})

export function resolveDetailedPlanTemplateOption(
  draft: Pick<Partial<PlanBetaIntake>, "eventDistanceM" | "trainingFocus">,
  evaluatedAt = new Date().toISOString(),
): DetailedPlanTemplateOption | null {
  return resolveDetailedPlanTemplateOptions(draft, evaluatedAt)[0] ?? null
}

export function resolveDetailedPlanTemplateOptions(
  draft: Pick<Partial<PlanBetaIntake>, "eventDistanceM" | "trainingFocus">,
  evaluatedAt = new Date().toISOString(),
): readonly DetailedPlanTemplateOption[] {
  if (draft.eventDistanceM === undefined || draft.trainingFocus === undefined) return []
  const eventDistanceM = draft.eventDistanceM
  const trainingFocus = draft.trainingFocus
  const approvals = DETAILED_PRESCRIPTION_APPROVALS.filter((candidate) => (
    candidate.targetEventDistanceM === eventDistanceM
    && TEMPLATE_INTENTS[candidate.templateId] === trainingFocus
  ))
  return approvals.flatMap((approval): DetailedPlanTemplateOption[] => {
    const ref = {
      templateId: approval.templateId,
      version: approval.templateVersion,
      fingerprint: approval.templateContentFingerprint,
    }
    const authority = resolveDetailedPrescriptionRuntimeAuthority({
      selectedTemplateRef: ref,
      targetEventDistanceM: eventDistanceM,
      selectedEnergyIntent: trainingFocus,
      evaluatedAt,
    })
    return authority.kind !== "authorized" ? [] : [{
      ref,
      notation: authority.approval.notation,
      targetEventDistanceM: eventDistanceM,
      trainingFocus,
    }]
  })
}
