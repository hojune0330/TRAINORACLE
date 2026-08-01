import { describe, expect, it } from "vitest"
import {
  acceptPlanProposal,
  createPlanProposal,
  confirmWarnedPlanProposal,
} from "./plan-proposals"

describe("coach plan proposals", () => {
  it("preserves the active plan until the athlete accepts the latest draft", () => {
    const proposal = createPlanProposal({
      id: "proposal-1",
      activePlanId: "active-1",
      proposedPlanId: "draft-2",
      proposedBy: "SUPPORTER",
      warning: null,
      createdAt: "2026-08-01T00:00:00.000Z",
    })

    expect(proposal.status).toBe("DRAFT")
    expect(proposal.activePlanId).toBe("active-1")
    expect(acceptPlanProposal(proposal, "2026-08-01T01:00:00.000Z").activePlanId).toBe("draft-2")
  })

  it("requires two distinct confirmations for a warned proposal", () => {
    const proposal = createPlanProposal({
      id: "proposal-1",
      activePlanId: "active-1",
      proposedPlanId: "draft-2",
      proposedBy: "ATHLETE",
      warning: {
        reason: "최근 통증 기록이 있어요.",
        conservativeAlternative: "회복 세션으로 바꾸기",
      },
      createdAt: "2026-08-01T00:00:00.000Z",
    })

    const first = acceptPlanProposal(proposal, "2026-08-01T01:00:00.000Z")
    expect(first.status).toBe("WARNING_REVIEWED")
    expect(first.activePlanId).toBe("active-1")

    const second = confirmWarnedPlanProposal(first, "2026-08-01T01:01:00.000Z")
    expect(second.status).toBe("USER_ACCEPTED_WITH_WARNING")
    expect(second.activePlanId).toBe("draft-2")
    expect(second.warningAcknowledgedAt).toBe("2026-08-01T01:01:00.000Z")
  })
})
