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
  if (draft.eventDistanceM === undefined || draft.trainingFocus === undefined) return null
  const approval = DETAILED_PRESCRIPTION_APPROVALS.find((candidate) => (
    candidate.targetEventDistanceM === draft.eventDistanceM
    && TEMPLATE_INTENTS[candidate.templateId] === draft.trainingFocus
  ))
  if (approval === undefined) return null
  const ref = {
    templateId: approval.templateId,
    version: approval.templateVersion,
    fingerprint: approval.templateContentFingerprint,
  }
  const authority = resolveDetailedPrescriptionRuntimeAuthority({
    selectedTemplateRef: ref,
    targetEventDistanceM: draft.eventDistanceM,
    selectedEnergyIntent: draft.trainingFocus,
    evaluatedAt,
  })
  if (authority.kind !== "authorized") return null
  return {
    ref,
    notation: authority.approval.notation,
    targetEventDistanceM: draft.eventDistanceM,
    trainingFocus: draft.trainingFocus,
  }
}
