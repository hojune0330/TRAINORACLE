import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  createPendingAccountSetup,
  finalizePendingAccountSetup,
  hasCurrentSetupReceipt,
  onlineAccountEligibility,
  readPendingAccountSetup,
  writePendingAccountSetup,
  writeCurrentSetupReceipt,
} from "./auth-onboarding"
import { koreaServiceDate } from "./service-date"

const config = {
  url: "https://example.supabase.co",
  anonKey: "public-anon-key",
  phoneAuthEnabled: false,
  privacyPolicy: { url: "https://trainoracle.example/privacy", version: "2026-08-25" },
  termsOfService: { url: "https://trainoracle.example/terms", version: "2026-08-25" },
}

beforeEach(() => {
  sessionStorage.clear()
  localStorage.clear()
})

describe("pre-auth account onboarding", () => {
  it("allows the exact 14th birthday and blocks the day before it", () => {
    expect(onlineAccountEligibility("2012-08-25", "2026-08-25")).toBe("ELIGIBLE")
    expect(onlineAccountEligibility("2012-08-26", "2026-08-25")).toBe("UNDER_14")
    expect(onlineAccountEligibility("not-a-date", "2026-08-25")).toBe("INVALID")
  })

  it("uses the Korean service date around UTC midnight for the legal age boundary", () => {
    expect(koreaServiceDate(new Date("2026-08-24T15:00:00.000Z"))).toBe("2026-08-25")
    expect(koreaServiceDate(new Date("2026-08-25T14:59:59.000Z"))).toBe("2026-08-25")
    expect(koreaServiceDate(new Date("2026-08-25T15:00:00.000Z"))).toBe("2026-08-26")
  })

  it("expires temporary birth-date and consent data after 15 minutes", () => {
    const pending = createPendingAccountSetup({
      method: "kakao",
      birthDate: "2000-01-01",
      config,
      createdAtMs: 1_000,
    })
    writePendingAccountSetup(pending)

    expect(readPendingAccountSetup(sessionStorage, 1_000 + 15 * 60 * 1000)).toEqual(pending)
    expect(readPendingAccountSetup(sessionStorage, 1_001 + 15 * 60 * 1000)).toBeNull()
    expect(sessionStorage.length).toBe(0)
  })

  it("saves the private profile after OAuth return and keeps no birth date in the durable receipt", async () => {
    writePendingAccountSetup(createPendingAccountSetup({
      method: "google",
      birthDate: "2000-01-01",
      config,
    }))
    const save = vi.fn().mockResolvedValue({ ok: true, message: "saved" })

    await expect(finalizePendingAccountSetup({
      userId: "athlete-a",
      today: "2026-08-25",
      config,
      onSaveProfile: save,
    })).resolves.toEqual({ attempted: true, result: { ok: true, message: "saved" } })

    expect(save).toHaveBeenCalledWith({
      userId: "athlete-a",
      birthDate: "2000-01-01",
      privacyPolicyVersion: "2026-08-25",
      termsOfServiceVersion: "2026-08-25",
    })
    expect(sessionStorage.length).toBe(0)
    expect(localStorage.getItem("trainoracle.account.setup-receipt.v1")).not.toContain("2000-01-01")
    expect(hasCurrentSetupReceipt("athlete-a", config)).toBe(true)
    expect(hasCurrentSetupReceipt("athlete-b", config)).toBe(false)
  })

  it("does not accept a pending consent after either legal version changes", async () => {
    writePendingAccountSetup(createPendingAccountSetup({
      method: "email",
      birthDate: "2000-01-01",
      config,
    }))
    const save = vi.fn()
    const changedConfig = {
      ...config,
      termsOfService: { ...config.termsOfService, version: "2026-09-01" },
    }

    const completion = await finalizePendingAccountSetup({
      userId: "athlete-a",
      today: "2026-08-25",
      config: changedConfig,
      onSaveProfile: save,
    })

    expect(completion.result).toMatchObject({ ok: false })
    expect(save).not.toHaveBeenCalled()
    expect(sessionStorage.length).toBe(0)
  })

  it("rechecks the age before server profile creation", async () => {
    writePendingAccountSetup(createPendingAccountSetup({
      method: "email",
      birthDate: "2013-01-01",
      config,
    }))
    const save = vi.fn()

    const completion = await finalizePendingAccountSetup({
      userId: "athlete-a",
      today: "2026-08-25",
      config,
      onSaveProfile: save,
    })

    expect(completion.result).toMatchObject({ ok: false })
    expect(save).not.toHaveBeenCalled()
  })

  it("can restore a current local receipt after a verified server profile check", () => {
    writeCurrentSetupReceipt("athlete-a", config)

    expect(hasCurrentSetupReceipt("athlete-a", config)).toBe(true)
    expect(localStorage.getItem("trainoracle.account.setup-receipt.v1")).not.toContain("birthDate")
  })
})
