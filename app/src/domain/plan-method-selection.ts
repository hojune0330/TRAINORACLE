import {
  detailedTemplateRefSchema,
  hasCanonicalJsonTree,
  planIntakeSchema,
} from "./plan-beta-schema"
import type { PlanBetaIntake } from "./plan-beta-store"
import { resolveDetailedPrescriptionRuntimeAuthority } from "./detailed-prescription-runtime-authority"
import { TRAINING_TEMPLATE_EXPLANATIONS } from "./training-template-explanations"

export type PlanMethodChange =
  | { readonly kind: "ready"; readonly intake: PlanBetaIntake }
  | { readonly kind: "unchanged" }
  | { readonly kind: "rejected"; readonly code: "DETAILED_TEMPLATE_AUTHORITY_UNAVAILABLE" | "MALFORMED_INPUT" }

export function sameDetailedTemplateReference(
  left: PlanBetaIntake["selectedDetailedTemplateRef"],
  right: PlanBetaIntake["selectedDetailedTemplateRef"],
): boolean {
  return left === null || right === null ? left === right
    : left.templateId === right.templateId
      && left.version === right.version
      && left.fingerprint === right.fingerprint
}

/** Validate a choice, not an athlete or a dose. Generation rechecks safety separately. */
export function resolvePlanMethodChange(
  intake: PlanBetaIntake,
  requested: unknown,
  evaluatedAt: Date = new Date(),
): PlanMethodChange {
  if (!hasCanonicalJsonTree(intake) || !hasCanonicalJsonTree(requested)) {
    return { kind: "rejected", code: "MALFORMED_INPUT" }
  }
  const parsedIntake = planIntakeSchema.safeParse(intake)
  const parsedReference = detailedTemplateRefSchema.nullable().safeParse(requested)
  if (!parsedIntake.success || !parsedReference.success || !Number.isFinite(evaluatedAt.getTime())) {
    return { kind: "rejected", code: "MALFORMED_INPUT" }
  }
  const reference = parsedReference.data
  if (reference !== null) {
    const authority = resolveDetailedPrescriptionRuntimeAuthority({
      selectedTemplateRef: reference,
      targetEventDistanceM: parsedIntake.data.eventDistanceM,
      selectedEnergyIntent: parsedIntake.data.trainingFocus,
      evaluatedAt: evaluatedAt.toISOString(),
    })
    const explanationExists = TRAINING_TEMPLATE_EXPLANATIONS.some(({ identity }) => (
      identity.templateId === reference.templateId
      && identity.templateVersion === reference.version
      && identity.templateContentFingerprint === reference.fingerprint
      && identity.targetEventDistanceM === parsedIntake.data.eventDistanceM
    ))
    if (authority.kind !== "authorized"
        || !authority.approval.eligibleEventGroups.includes(parsedIntake.data.eventGroup)
        || !authority.approval.eligibleExperienceBands.includes(parsedIntake.data.experienceBand)
        || authority.approval.populationApplicability.scope !== "YOUTH_AND_ADULT"
        || !explanationExists) {
      return { kind: "rejected", code: "DETAILED_TEMPLATE_AUTHORITY_UNAVAILABLE" }
    }
  }
  if (sameDetailedTemplateReference(parsedIntake.data.selectedDetailedTemplateRef, reference)) {
    return { kind: "unchanged" }
  }
  return { kind: "ready", intake: { ...parsedIntake.data, selectedDetailedTemplateRef: reference } }
}
