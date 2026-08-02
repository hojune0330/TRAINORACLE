export type PlanWarning = {
  readonly reason: string
  readonly conservativeAlternative: string
}

export type PlanProposalStatus = "DRAFT" | "WARNING_REVIEWED" | "ACTIVE" | "USER_ACCEPTED_WITH_WARNING"

export type PlanProposal = {
  readonly id: string
  readonly activePlanId: string
  readonly proposedPlanId: string
  readonly proposedBy: "ATHLETE" | "SUPPORTER"
  readonly warning: PlanWarning | null
  readonly createdAt: string
  readonly status: PlanProposalStatus
  readonly firstWarningReviewedAt: string | null
  readonly warningAcknowledgedAt: string | null
}

export function createPlanProposal(input: Omit<
  PlanProposal,
  "status" | "firstWarningReviewedAt" | "warningAcknowledgedAt"
>): PlanProposal {
  return {
    ...input,
    status: "DRAFT",
    firstWarningReviewedAt: null,
    warningAcknowledgedAt: null,
  }
}

export function acceptPlanProposal(proposal: PlanProposal, confirmedAt: string): PlanProposal {
  if (proposal.warning !== null) {
    return { ...proposal, status: "WARNING_REVIEWED", firstWarningReviewedAt: confirmedAt }
  }
  return { ...proposal, status: "ACTIVE", activePlanId: proposal.proposedPlanId }
}

export function confirmWarnedPlanProposal(
  proposal: PlanProposal,
  confirmedAt: string,
): PlanProposal {
  if (proposal.warning === null || proposal.status !== "WARNING_REVIEWED") return proposal
  if (proposal.firstWarningReviewedAt === confirmedAt) return proposal
  return {
    ...proposal,
    status: "USER_ACCEPTED_WITH_WARNING",
    activePlanId: proposal.proposedPlanId,
    warningAcknowledgedAt: confirmedAt,
  }
}
