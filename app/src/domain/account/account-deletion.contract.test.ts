import { describe, expect, it } from "vitest"
import { createAccountDeletionRequest } from "./account-deletion"

describe("account deletion request", () => {
  it("blocks access immediately and sets the final deletion deadline to 30 days", () => {
    expect(createAccountDeletionRequest("2026-08-01T00:00:00.000Z")).toEqual({
      requestedAt: "2026-08-01T00:00:00.000Z",
      accessBlockedAt: "2026-08-01T00:00:00.000Z",
      deleteBy: "2026-08-31T00:00:00.000Z",
      status: "REQUESTED",
    })
  })
})
