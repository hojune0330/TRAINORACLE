import { preparePrescriptionRuntime } from "@impl/prescription/runtime"
import type {
  PaceAnchorRecord,
  PrescriptionDerivedTotals,
  RacePaceCalculationResult,
  StructuredPrescription,
} from "@impl/prescription/types"
import type { PlannedEnergyIntent } from "@impl/plan-generator/types"
import type { SafetyGateDecision } from "@impl/safety-gate/gate"
import {
  resolveDetailedPrescriptionApproval,
  type DetailedPrescriptionApprovalRecord,
  type DetailedPrescriptionApprovalRequest,
} from "./detailed-prescription-approvals"
import { resolveDetailedPrescriptionRuntimeAuthority } from "./detailed-prescription-runtime-authority"

type DetailedPrescriptionInput = DetailedPrescriptionApprovalRequest & {
  readonly detailedPrescriptionEnabled: boolean
  readonly selectedEnergyIntent: PlannedEnergyIntent
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
  const runtimeAuthority = resolveDetailedPrescriptionRuntimeAuthority({
    selectedTemplateRef: {
      templateId: input.templateId,
      version: input.templateVersion,
      fingerprint: input.templateContentFingerprint,
    },
    targetEventDistanceM: input.targetEventDistanceM,
    selectedEnergyIntent: input.selectedEnergyIntent,
    evaluatedAt: input.evaluatedAt,
  })
  if (runtimeAuthority.kind === "fallback") return null
  const approval = resolveDetailedPrescriptionApproval(input)
  if (approval === undefined || approval !== runtimeAuthority.approval) return null

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
