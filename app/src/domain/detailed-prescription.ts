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
  readonly athleteIsMinor: boolean
  readonly guardianConsentConfirmed: boolean
  readonly designatedHumanReviewConfirmed: boolean
}

type ActivatedStructuredPrescription = Omit<
  StructuredPrescription,
  | "warmupComponentRef"
  | "cooldownComponentRef"
  | "downshiftOptionRefs"
  | "stopConditionCodes"
> & {
  readonly warmupComponentRef: string
  readonly cooldownComponentRef: string
  readonly downshiftOptionRefs: readonly string[]
  readonly stopConditionCodes: readonly string[]
}

export type DetailedPrescription = {
  readonly notation: string
  readonly prescription: ActivatedStructuredPrescription
  readonly totals: PrescriptionDerivedTotals
  readonly pace: Extract<RacePaceCalculationResult, { readonly kind: "calculated" }>
}

function hasReview(review: DetailedPrescriptionApprovalRecord["ownerReview"]): boolean {
  return review !== null
    && review.reviewerName.trim().length > 0
    && review.evidenceRef.trim().length > 0
}

export function isDetailedPrescriptionApprovalComplete(
  approval: DetailedPrescriptionApprovalRecord,
  input: Pick<
    DetailedPrescriptionInput,
    | "athleteEventGroup"
    | "athleteExperienceBand"
    | "athleteIsMinor"
    | "guardianConsentConfirmed"
    | "designatedHumanReviewConfirmed"
  >,
): boolean {
  const minorEligible = !input.athleteIsMinor || (
    approval.minorAllowed
    && input.guardianConsentConfirmed
    && input.designatedHumanReviewConfirmed
  )
  return approval.lifecycleStatus === "ACTIVE"
    && approval.eligibilityStatus === "ELIGIBLE"
    && approval.notation.trim().length > 0
    && approval.eligibleEventGroups.includes(input.athleteEventGroup)
    && approval.eligibleExperienceBands.includes(input.athleteExperienceBand)
    && hasReview(approval.ownerReview)
    && hasReview(approval.coachReview)
    && hasReview(approval.sportsScienceReview)
    && hasReview(approval.youthReview)
    && approval.warmupComponentRef.trim().length > 0
    && approval.cooldownComponentRef.trim().length > 0
    && approval.downshiftOptionRefs.length > 0
    && approval.stopConditionCodes.length > 0
    && minorEligible
}

export function prepareDetailedPrescription(
  input: DetailedPrescriptionInput,
): DetailedPrescription | null {
  if (!input.detailedPrescriptionEnabled) return null
  const approval = DETAILED_PRESCRIPTION_APPROVALS.find(
    (candidate) => candidate.templateId === input.templateId,
  )
  if (
    approval === undefined
    || !isDetailedPrescriptionApprovalComplete(approval, input)
  ) return null

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
    prescription: Object.freeze({
      ...prepared.prescription,
      warmupComponentRef: approval.warmupComponentRef,
      cooldownComponentRef: approval.cooldownComponentRef,
      downshiftOptionRefs: Object.freeze([...approval.downshiftOptionRefs]),
      stopConditionCodes: Object.freeze([...approval.stopConditionCodes]),
    }),
    totals: prepared.totals,
    pace: prepared.pace,
  })
}
