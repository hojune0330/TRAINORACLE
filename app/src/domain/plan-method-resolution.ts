import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { projectPacePrescriptionSequence } from "@impl/prescription/pace-sequence"
import { hasCanonicalJsonTree } from "./plan-beta-schema"
import { paceTargetPlanItemSchema } from "./plan-session-schema"
import { readPlanMethodDefinition } from "./plan-method-definition"
import { templateExplanation } from "./training-template-explanations"

/** Local projection for the adjustment adapter, not persistence or activation authority.
 * Source identity is independent of the athlete; resolved identity includes the exact
 * unrounded prescription and explanation. Never auto-include this in public exports.
 */
export function resolvePlanMethodPrescription(input: unknown) {
  try {
    if (!hasCanonicalJsonTree(input)) return null
    const parsed = paceTargetPlanItemSchema.safeParse(input)
    if (!parsed.success) return null
    const prescription = parsed.data
    const definition = readPlanMethodDefinition({ templateId: prescription.templateId,
      version: prescription.templateVersion, fingerprint: prescription.templateContentFingerprint })
    const explanation = templateExplanation(prescription)
    if (definition === null || explanation === null) return null
    const sequence = prescription.sequence ?? projectPacePrescriptionSequence(prescription)
    if (sequence === null) return null
    const source = {
      configuration: definition.reference,
      template: definition.mapping.templateRef,
      mappingVersion: definition.mapping.mappingVersion,
      reviewRef: definition.reviewRef,
      sourceRef: definition.sourceRef,
    }
    const explanationBinding = { version: explanation.version,
      contentFingerprint: canonicalJsonFingerprint("trainoracle.method-explanation.v1", explanation),
      evidenceRefs: [explanation.decisionPath, explanation.sourceRecordPath].filter((value, index, all) => all.indexOf(value) === index) }
    const resolved = {
      sequence,
      targetRepSeconds: prescription.targetRepSeconds,
      targetEventDistanceM: prescription.targetEventDistanceM,
      anchorContentFingerprint: canonicalJsonFingerprint("trainoracle.method-anchor.v1", prescription.selectedAnchor),
      prescriptionContentFingerprint: canonicalJsonFingerprint("trainoracle.method-resolved-prescription.v1", prescription),
      explanation: explanationBinding,
    }
    return { schemaVersion: 1 as const, source, resolved,
      bindingFingerprint: canonicalJsonFingerprint("trainoracle.method-resolution-binding.v1", { source, resolved }) }
  } catch { return null }
}

export type PlanMethodResolution = NonNullable<ReturnType<typeof resolvePlanMethodPrescription>>
