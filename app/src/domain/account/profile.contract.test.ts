import { describe, expect, it } from "vitest"
import { ageBandOn, networkAccessForProfile, profileFromBirthDate } from "./profile"

describe("account profile age boundary", () => {
  it("keeps the exact birth date in the private profile and derives the age band", () => {
    const profile = profileFromBirthDate("2013-08-02", "2026-08-01")

    expect(profile.birthDate).toBe("2013-08-02")
    expect(profile.ageBand).toBe("UNDER_14")
    expect(ageBandOn("2012-08-01", "2026-08-01")).toBe("AGE_14_OR_OVER")
  })

  it("blocks under-14 sync and sharing until guardian confirmation", () => {
    const profile = profileFromBirthDate("2013-08-02", "2026-08-01")

    expect(networkAccessForProfile(profile)).toEqual({ sync: false, sharing: false })
    expect(networkAccessForProfile({
      ...profile,
      guardianConfirmedAt: "2026-08-01T01:00:00.000Z",
    })).toEqual({ sync: true, sharing: true })
  })

  it("rejects impossible or future birth dates", () => {
    expect(() => profileFromBirthDate("2026-08-02", "2026-08-01")).toThrow()
    expect(() => profileFromBirthDate("not-a-date", "2026-08-01")).toThrow()
  })
})
