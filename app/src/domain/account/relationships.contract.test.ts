import { describe, expect, it } from "vitest"
import {
  canUseNetworkFeatures,
  createSupportConnection,
  expandSharingScope,
  requestSupportConnection,
  renewSupportConnection,
  runNetworkControlWhenEligible,
} from "./relationships"

describe("guardian and coach-supporter boundaries", () => {
  it("blocks sync and sharing for an under-14 athlete until guardian confirmation", () => {
    const serverNow = "2026-08-01T12:00:00.000Z"
    expect(canUseNetworkFeatures({ ageBand: "UNDER_14", guardianAuthority: null }, serverNow)).toBe(false)
    expect(canUseNetworkFeatures({
      ageBand: "UNDER_14",
      guardianAuthority: {
        validFrom: "2026-08-01T00:00:00.000Z",
        validUntil: "2026-12-31T23:59:59.000Z",
        seasonEndsOn: "2026-12-31",
        scope: "ACCOUNT_SYNC",
        revokedAt: null,
      },
    }, serverNow)).toBe(true)
  })

  it("stops every under-14 account network control before a network call when authority is invalid", async () => {
    const invalidAuthority = {
      validFrom: "2026-01-01T00:00:00.000Z",
      validUntil: "2026-12-31T23:59:59.000Z",
      seasonEndsOn: "2026-12-31",
      scope: "ACCOUNT_SYNC",
      revokedAt: "2026-08-01T01:00:00.000Z",
    }
    const serverNow = "2026-08-01T12:00:00.000Z"

    expect(canUseNetworkFeatures({
      ageBand: "UNDER_14",
      guardianAuthority: invalidAuthority,
    }, serverNow)).toBe(false)
    expect(requestSupportConnection({
      ageBand: "UNDER_14",
      athleteId: "athlete-a",
      supporterId: "supporter-a",
      seasonEndsOn: "2026-12-31",
      guardianAuthority: invalidAuthority,
      serverNow,
    }).kind).toBe("GUARDIAN_CONFIRMATION_REQUIRED")
    let networkCallCount = 0
    const didRun = await runNetworkControlWhenEligible({
      ageBand: "UNDER_14",
      guardianAuthority: invalidAuthority,
    }, serverNow, async () => {
      networkCallCount += 1
    })

    expect(didRun).toBe(false)
    expect(networkCallCount).toBe(0)
  })

  it("requires a current scope-specific authority for first link, sharing expansion, and seasonal refresh", () => {
    const serverNow = "2026-08-01T12:00:00.000Z"
    const accountSyncAuthority = {
      validFrom: "2026-01-01T00:00:00.000Z",
      validUntil: "2026-12-31T23:59:59.000Z",
      seasonEndsOn: "2026-12-31",
      scope: "ACCOUNT_SYNC",
      revokedAt: null,
    }
    const connection = createSupportConnection({
      athleteId: "athlete-a",
      supporterId: "supporter-a",
      seasonEndsOn: "2026-12-31",
      guardianAuthority: accountSyncAuthority,
    })

    expect(requestSupportConnection({
      ageBand: "UNDER_14",
      athleteId: "athlete-a",
      supporterId: "supporter-a",
      seasonEndsOn: "2026-12-31",
      guardianAuthority: accountSyncAuthority,
      serverNow,
    }).kind).toBe("GUARDIAN_CONFIRMATION_REQUIRED")
    expect(expandSharingScope(connection, "UNDER_14", accountSyncAuthority, serverNow).kind)
      .toBe("GUARDIAN_CONFIRMATION_REQUIRED")
    expect(renewSupportConnection(connection, "UNDER_14", "2027-12-31", accountSyncAuthority, serverNow).kind)
      .toBe("GUARDIAN_CONFIRMATION_REQUIRED")
  })

  it("allows the first share connection and seasonal refresh only with current matching authority", () => {
    const serverNow = "2026-08-01T12:00:00.000Z"
    const firstLinkAuthority = {
      validFrom: "2026-01-01T00:00:00.000Z",
      validUntil: "2026-12-31T23:59:59.000Z",
      seasonEndsOn: "2026-12-31",
      scope: "FIRST_LINK",
      revokedAt: null,
    }
    const connection = createSupportConnection({
      athleteId: "athlete-a",
      supporterId: "supporter-a",
      seasonEndsOn: "2026-12-31",
      guardianAuthority: firstLinkAuthority,
    })
    const seasonalRefreshAuthority = {
      validFrom: "2026-01-01T00:00:00.000Z",
      validUntil: "2028-01-01T00:00:00.000Z",
      seasonEndsOn: "2027-12-31",
      scope: "SEASON_RENEWAL",
      revokedAt: null,
    }

    expect(requestSupportConnection({
      ageBand: "UNDER_14",
      athleteId: "athlete-a",
      supporterId: "supporter-a",
      seasonEndsOn: "2026-12-31",
      guardianAuthority: firstLinkAuthority,
      serverNow,
    }).kind).toBe("UPDATED")
    expect(renewSupportConnection(
      connection,
      "UNDER_14",
      "2027-12-31",
      seasonalRefreshAuthority,
      serverNow,
    )).toMatchObject({
      kind: "UPDATED",
      connection: { seasonEndsOn: "2027-12-31" },
    })
  })

  it("labels every unverified invitee as qualification unverified", () => {
    const connection = createSupportConnection({
      athleteId: "athlete-a",
      supporterId: "supporter-a",
      seasonEndsOn: "2026-12-31",
      guardianAuthority: null,
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
      guardianAuthority: null,
      serverNow: "2026-08-01T12:00:00.000Z",
    })

    expect(result.kind).toBe("GUARDIAN_CONFIRMATION_REQUIRED")
  })

  it("requires guardian confirmation when an under-14 athlete expands sharing", () => {
    const connection = createSupportConnection({
      athleteId: "athlete-a",
      supporterId: "supporter-a",
      seasonEndsOn: "2026-12-31",
      guardianAuthority: null,
    })

    expect(expandSharingScope(connection, "UNDER_14", null, "2026-08-01T12:00:00.000Z").kind)
      .toBe("GUARDIAN_CONFIRMATION_REQUIRED")
  })

  it("requires guardian confirmation when an under-14 connection renews for a season", () => {
    const connection = createSupportConnection({
      athleteId: "athlete-a",
      supporterId: "supporter-a",
      seasonEndsOn: "2026-12-31",
      guardianAuthority: null,
    })

    expect(renewSupportConnection(connection, "UNDER_14", "2027-12-31", null, "2026-08-01T12:00:00.000Z").kind)
      .toBe("GUARDIAN_CONFIRMATION_REQUIRED")
  })
})
