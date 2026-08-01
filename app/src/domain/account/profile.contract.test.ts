import { describe, expect, it } from "vitest"
import {
  ageBandOn,
  networkAccessForProfile,
  profileFromBirthDate,
} from "./profile"

describe("account profile age boundary", () => {
  it("keeps the exact birth date in the private profile and derives the age band", () => {
    const profile = profileFromBirthDate("2013-08-02", "2026-08-01")

    expect(profile.birthDate).toBe("2013-08-02")
    expect(profile.ageBand).toBe("UNDER_14")
    expect(ageBandOn("2012-08-01", "2026-08-01")).toBe("AGE_14_OR_OVER")
  })

  it("blocks under-14 sync and sharing until guardian confirmation", () => {
    const profile = profileFromBirthDate("2013-08-02", "2026-08-01")
    const serverNow = "2026-08-01T12:00:00.000Z"

    expect(networkAccessForProfile(profile, serverNow)).toEqual({ sync: false, sharing: false })
    expect(networkAccessForProfile({
      ...profile,
      guardianAuthority: {
        validFrom: "2026-08-01T01:00:00.000Z",
        validUntil: "2026-12-31T23:59:59.000Z",
        seasonEndsOn: "2026-12-31",
        scope: "ACCOUNT_SYNC",
        revokedAt: null,
      },
    }, serverNow)).toEqual({ sync: true, sharing: true })
  })

  it("keeps adult network controls available without guardian authority", () => {
    const profile = profileFromBirthDate("2012-08-01", "2026-08-01")

    expect(networkAccessForProfile(profile, "2026-08-01T00:00:00.000Z"))
      .toEqual({ sync: true, sharing: true })
  })

  it("blocks malformed, expired, revoked, stale-season, and wrong-scope under-14 authority", () => {
    const profile = profileFromBirthDate("2013-08-02", "2026-08-01")
    const serverNow = "2026-08-01T12:00:00.000Z"
    const invalidAuthorities = [
      {
        validFrom: "malformed",
        validUntil: "2026-12-31T23:59:59.000Z",
        seasonEndsOn: "2026-12-31",
        scope: "ACCOUNT_SYNC",
        revokedAt: null,
      },
      {
        validFrom: "2026-01-01T00:00:00.000Z",
        validUntil: "2026-07-31T23:59:59.000Z",
        seasonEndsOn: "2026-12-31",
        scope: "ACCOUNT_SYNC",
        revokedAt: null,
      },
      {
        validFrom: "2026-01-01T00:00:00.000Z",
        validUntil: "2026-12-31T23:59:59.000Z",
        seasonEndsOn: "2026-12-31",
        scope: "ACCOUNT_SYNC",
        revokedAt: "2026-08-01T01:00:00.000Z",
      },
      {
        validFrom: "2026-01-01T00:00:00.000Z",
        validUntil: "2026-12-31T23:59:59.000Z",
        seasonEndsOn: "2026-07-31",
        scope: "ACCOUNT_SYNC",
        revokedAt: null,
      },
      {
        validFrom: "2026-01-01T00:00:00.000Z",
        validUntil: "2026-12-31T23:59:59.000Z",
        seasonEndsOn: "2026-12-31",
        scope: "FIRST_LINK",
        revokedAt: null,
      },
    ]

    for (const guardianAuthority of invalidAuthorities) {
      expect(networkAccessForProfile({ ...profile, guardianAuthority }, serverNow))
        .toEqual({ sync: false, sharing: false })
    }
  })

  it("rejects impossible or future birth dates", () => {
    expect(() => profileFromBirthDate("2026-08-02", "2026-08-01")).toThrow()
    expect(() => profileFromBirthDate("not-a-date", "2026-08-01")).toThrow()
  })
})
