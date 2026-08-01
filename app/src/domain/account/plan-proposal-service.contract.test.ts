import { describe, expect, it } from "vitest"
import { parsePlanProposalActivationResult } from "./plan-proposal-service"

describe("plan proposal activation result", () => {
  it("accepts only the complete atomic server receipt", () => {
    const result = parsePlanProposalActivationResult({
      outcome: "ACTIVATED",
      proposalId: "a0c0ae7c-7e71-4738-afbd-008c0e5ea7ce",
      planVersionId: "a3704a33-5b9d-4fc6-a2a9-585196198ca0",
      activeRevision: 4,
      activatedAt: "2026-08-01T00:00:00.000Z",
    })

    expect(result).toEqual({
      ok: true,
      receipt: {
        proposalId: "a0c0ae7c-7e71-4738-afbd-008c0e5ea7ce",
        planVersionId: "a3704a33-5b9d-4fc6-a2a9-585196198ca0",
        activeRevision: 4,
        activatedAt: "2026-08-01T00:00:00.000Z",
      },
    })
  })

  it("rejects an incomplete result instead of showing an active plan", () => {
    const result = parsePlanProposalActivationResult({
      outcome: "ACTIVATED",
      proposalId: "a0c0ae7c-7e71-4738-afbd-008c0e5ea7ce",
      planVersionId: "a3704a33-5b9d-4fc6-a2a9-585196198ca0",
      activatedAt: "2026-08-01T00:00:00.000Z",
    })

    expect(result).toEqual({ ok: false, message: "계획을 적용하지 못했어요. 현재 계획은 그대로예요." })
  })
})
