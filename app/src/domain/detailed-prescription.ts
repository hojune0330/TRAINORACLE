import { preparePrescriptionRuntime } from "@impl/prescription/runtime"
import type {
  PaceAnchorRecord,
  PrescriptionDerivedTotals,
  RacePaceCalculationResult,
  StructuredPrescription,
} from "@impl/prescription/types"
import type { SafetyGateDecision } from "@impl/safety-gate/gate"
import {
  resolveDetailedPrescriptionApproval,
  type DetailedPrescriptionApprovalRecord,
  type DetailedPrescriptionApprovalRequest,
} from "./detailed-prescription-approvals"

type DetailedPrescriptionInput = DetailedPrescriptionApprovalRequest & {
  readonly detailedPrescriptionEnabled: boolean
  readonly anchor: PaceAnchorRecord
  readonly displayRoundingPolicyVersion: string
  readonly safetyGate: SafetyGateDecision
}

export type DetailedPrescription = {
  readonly approval: DetailedPrescriptionApprovalRecord
  readonly notation: string
  readonly prescription: StructuredPrescription
  readonly totals: PrescriptionDerivedTotals
  readonly pace: Extract<RacePaceCalculationResult, { readonly kind: "calculated" }>
}

export function prepareDetailedPrescription(
  input: DetailedPrescriptionInput,
): DetailedPrescription | null {
  if (!input.detailedPrescriptionEnabled) return null
  const approval = resolveDetailedPrescriptionApproval(input)
  if (approval === undefined) return null

  const prepared = preparePrescriptionRuntime({
    notation: approval.notation,
    anchor: input.anchor,
    displayRoundingPolicyVersion: input.displayRoundingPolicyVersion,
    template: approval,
    safetyGate: input.safetyGate,
    operationalComponents: approval.canonicalTemplateContent.operationalComponents,
  })
  if (prepared.kind === "rejected") return null

  return Object.freeze({
    approval,
    notation: approval.notation,
    prescription: prepared.prescription,
    totals: prepared.totals,
    pace: prepared.pace,
  })
}
