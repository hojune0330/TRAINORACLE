import type { ExperienceBand, PlanEventGroup } from "@impl/plan-generator/types"
import type { TemplateRuntimeStatus } from "@impl/prescription/types"

type ApprovalReview = {
  readonly reviewerName: string
  readonly evidenceRef: string
  readonly decision: "APPROVED"
}

export type DetailedPrescriptionApprovalRecord = TemplateRuntimeStatus & {
  readonly templateId: string
  readonly notation: string
  readonly eligibleEventGroups: readonly PlanEventGroup[]
  readonly eligibleExperienceBands: readonly ExperienceBand[]
  readonly ownerReview: ApprovalReview | null
  readonly coachReview: ApprovalReview | null
  readonly sportsScienceReview: ApprovalReview | null
  readonly youthReview: ApprovalReview | null
  readonly minorAllowed: boolean
  readonly warmupComponentRef: string
  readonly cooldownComponentRef: string
  readonly downshiftOptionRefs: readonly string[]
  readonly stopConditionCodes: readonly string[]
}

export const DETAILED_PRESCRIPTION_APPROVALS: readonly DetailedPrescriptionApprovalRecord[] =
  Object.freeze([])
