import { describe, expect, it } from "vitest"
import {
  canUseNetworkFeatures,
  createSupportConnection,
  expandSharingScope,
  requestSupportConnection,
  renewSupportConnection,
} from "./relationships"

describe("guardian and coach-supporter boundaries", () => {
  it("blocks sync and sharing for an under-14 athlete until guardian confirmation", () => {
    expect(canUseNetworkFeatures({ ageBand: "UNDER_14", guardianConfirmedAt: null })).toBe(false)
    expect(canUseNetworkFeatures({
      ageBand: "UNDER_14",
      guardianConfirmedAt: "2026-08-01T00:00:00.000Z",
    })).toBe(true)
  })

  it("labels every unverified invitee as qualification unverified", () => {
    const connection = createSupportConnection({
      athleteId: "athlete-a",
      supporterId: "supporter-a",
      seasonEndsOn: "2026-12-31",
      guardianConfirmedAt: null,
    })

    expect(connection.qualificationLabel).toBe("자격 미확인")
    expect(connection.status).toBe("ACTIVE")
    expect(connection.sharedFields).not.toContain("PRIVATE_MEMO")
  })

  it("requires guardian confirmation before an under-14 athlete creates the first link", () => {
    const result = requestSupportConnection({
      ageBand: "UNDER_14",
      athleteId: "athlete-a",
      supporterId: "supporter-a",
      seasonEndsOn: "2026-12-31",
      guardianConfirmedAt: null,
    })

    expect(result.kind).toBe("GUARDIAN_CONFIRMATION_REQUIRED")
  })

  it("requires guardian confirmation when an under-14 athlete expands sharing", () => {
    const connection = createSupportConnection({
      athleteId: "athlete-a",
      supporterId: "supporter-a",
      seasonEndsOn: "2026-12-31",
      guardianConfirmedAt: "2026-08-01T00:00:00.000Z",
    })

    expect(expandSharingScope(connection, "UNDER_14", null).kind).toBe("GUARDIAN_CONFIRMATION_REQUIRED")
  })

  it("requires guardian confirmation when an under-14 connection renews for a season", () => {
    const connection = createSupportConnection({
      athleteId: "athlete-a",
      supporterId: "supporter-a",
      seasonEndsOn: "2026-12-31",
      guardianConfirmedAt: "2026-08-01T00:00:00.000Z",
    })

    expect(renewSupportConnection(connection, "UNDER_14", "2027-12-31", null).kind)
      .toBe("GUARDIAN_CONFIRMATION_REQUIRED")
  })
})
