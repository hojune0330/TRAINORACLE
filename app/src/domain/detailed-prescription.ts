import type { ExperienceBand, PlanEventGroup } from "@impl/plan-generator/types"
import { preparePrescriptionRuntime } from "@impl/prescription/runtime"
import type {
  PaceAnchorRecord,
  PrescriptionDerivedTotals,
  RacePaceCalculationResult,
  StructuredPrescription,
} from "@impl/prescription/types"
import type { SafetyGateDecision } from "@impl/safety-gate/gate"
import {
  DETAILED_PRESCRIPTION_APPROVALS,
  type DetailedPrescriptionApprovalRecord,
} from "./detailed-prescription-approvals"

type DetailedPrescriptionInput = {
  readonly detailedPrescriptionEnabled: boolean
  readonly templateId: string
  readonly athleteEventGroup: PlanEventGroup
  readonly athleteExperienceBand: ExperienceBand
  readonly anchor: PaceAnchorRecord
  readonly displayRoundingPolicyVersion: string
  readonly safetyGate: SafetyGateDecision
}

export type DetailedPrescription = {
  readonly notation: string
  readonly prescription: StructuredPrescription
  readonly totals: PrescriptionDerivedTotals
  readonly pace: Extract<RacePaceCalculationResult, { readonly kind: "calculated" }>
}

function hasReview(review: DetailedPrescriptionApprovalRecord["ownerReview"]): boolean {
  return review !== null
    && review.reviewerName.trim().length > 0
    && review.evidenceRef.trim().length > 0
}

function isCompleteApproval(
  approval: DetailedPrescriptionApprovalRecord,
  input: DetailedPrescriptionInput,
): boolean {
  return approval.lifecycleStatus === "ACTIVE"
    && approval.eligibilityStatus === "ELIGIBLE"
    && approval.notation.trim().length > 0
    && approval.eligibleEventGroups.includes(input.athleteEventGroup)
    && approval.eligibleExperienceBands.includes(input.athleteExperienceBand)
    && hasReview(approval.ownerReview)
    && hasReview(approval.coachReview)
    && hasReview(approval.sportsScienceReview)
    && hasReview(approval.youthReview)
}

export function prepareDetailedPrescription(
  input: DetailedPrescriptionInput,
): DetailedPrescription | null {
  if (!input.detailedPrescriptionEnabled) return null
  const approval = DETAILED_PRESCRIPTION_APPROVALS.find(
    (candidate) => candidate.templateId === input.templateId,
  )
  if (approval === undefined || !isCompleteApproval(approval, input)) return null

  const prepared = preparePrescriptionRuntime({
    notation: approval.notation,
    anchor: input.anchor,
    displayRoundingPolicyVersion: input.displayRoundingPolicyVersion,
    template: approval,
    safetyGate: input.safetyGate,
  })
  if (prepared.kind === "rejected") return null

  return Object.freeze({
    notation: approval.notation,
    prescription: prepared.prescription,
    totals: prepared.totals,
    pace: prepared.pace,
  })
}
