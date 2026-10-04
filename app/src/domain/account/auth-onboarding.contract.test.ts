import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  createPendingAccountSetup,
  clearPendingAccountSetupForAttempt,
  finalizePendingAccountSetup,
  hasCurrentSetupReceipt,
  markPendingAccountAuthStarted,
  markPendingAccountAuthVerified,
  onlineAccountEligibility,
  readPendingAccountSetup,
  writePendingAccountSetup,
  writeCurrentSetupReceipt,
} from "./auth-onboarding"
import { koreaServiceDate } from "./service-date"

const config = {
  url: "https://example.supabase.co",
  anonKey: "public-anon-key",
  kakaoAuthEnabled: false,
  googleAuthEnabled: true,
  emailAuthEnabled: true,
  phoneAuthEnabled: false,
  privacyPolicy: { url: "https://trainoracle.example/privacy", version: "2026-08-25" },
  termsOfService: { url: "https://trainoracle.example/terms", version: "2026-08-25" },
}

const attemptA = "a".repeat(32)
const attemptB = "b".repeat(32)
const sessionA = "11111111-1111-4111-8111-111111111111"

beforeEach(() => {
  sessionStorage.clear()
  localStorage.clear()
})
afterEach(() => vi.useRealTimers())

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

  it("physically expires temporary birth-date and consent data after 15 minutes", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(1_000))
    const pending = createPendingAccountSetup({
      method: "kakao",
      birthDate: "2000-01-01",
      config,
      createdAtMs: 1_000,
      attemptId: attemptA,
    })
    writePendingAccountSetup(pending)

    expect(readPendingAccountSetup(sessionStorage, 1_000 + 15 * 60 * 1000)).toEqual(pending)
    vi.advanceTimersByTime(15 * 60 * 1000 + 1)
    expect(readPendingAccountSetup()).toBeNull()
    expect(sessionStorage.length).toBe(0)
  })

  it("discards an older unbound pending setup instead of upgrading it implicitly", () => {
    sessionStorage.setItem("trainoracle.account.pending-setup.v1", JSON.stringify({
      schemaVersion: 1,
      method: "google",
      birthDate: "2000-01-01",
      privacyPolicyVersion: "2026-08-25",
      termsOfServiceVersion: "2026-08-25",
      createdAtMs: Date.now(),
    }))

    expect(readPendingAccountSetup()).toBeNull()
    expect(sessionStorage.length).toBe(0)
  })

  it("discards schema 3 pending data that has no signed session binding", () => {
    sessionStorage.setItem("trainoracle.account.pending-setup.v1", JSON.stringify({
      ...createPendingAccountSetup({
        method: "google",
        birthDate: "2000-01-01",
        config,
        attemptId: attemptA,
      }),
      schemaVersion: 3,
      phase: "AUTH_VERIFIED",
      verifiedUserId: "athlete-a",
      verifiedMethod: "google",
    }))

    expect(readPendingAccountSetup()).toBeNull()
    expect(sessionStorage.length).toBe(0)
  })

  it("saves the private profile after OAuth return and keeps no birth date in the durable receipt", async () => {
    const pending = createPendingAccountSetup({
      method: "google",
      birthDate: "2000-01-01",
      config,
      attemptId: attemptA,
    })
    writePendingAccountSetup(pending)
    markPendingAccountAuthStarted(pending.attemptId)
    markPendingAccountAuthVerified(pending.attemptId, "athlete-a", "google", sessionA)
    const save = vi.fn().mockResolvedValue({ ok: true, message: "saved" })

    await expect(finalizePendingAccountSetup({
      userId: "athlete-a",
      returnAttemptId: attemptA,
      today: "2026-08-25",
      config,
      onSaveProfile: save,
    })).resolves.toEqual({ attempted: true, result: { ok: true, message: "saved" } })

    expect(save).toHaveBeenCalledWith({
      userId: "athlete-a",
      expectedSessionId: sessionA,
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
    const pending = createPendingAccountSetup({
      method: "google",
      birthDate: "2000-01-01",
      config,
      attemptId: attemptA,
    })
    writePendingAccountSetup(pending)
    markPendingAccountAuthStarted(pending.attemptId)
    markPendingAccountAuthVerified(pending.attemptId, "athlete-a", "google", sessionA)
    const save = vi.fn()
    const changedConfig = {
      ...config,
      termsOfService: { ...config.termsOfService, version: "2026-09-01" },
    }

    const completion = await finalizePendingAccountSetup({
      userId: "athlete-a",
      returnAttemptId: attemptA,
      today: "2026-08-25",
      config: changedConfig,
      onSaveProfile: save,
    })

    expect(completion.result).toMatchObject({ ok: false })
    expect(save).not.toHaveBeenCalled()
    expect(sessionStorage.length).toBe(0)
  })

  it("rechecks the age before server profile creation", async () => {
    const pending = createPendingAccountSetup({
      method: "google",
      birthDate: "2013-01-01",
      config,
      attemptId: attemptA,
    })
    writePendingAccountSetup(pending)
    markPendingAccountAuthStarted(pending.attemptId)
    markPendingAccountAuthVerified(pending.attemptId, "athlete-a", "google", sessionA)
    const save = vi.fn()

    const completion = await finalizePendingAccountSetup({
      userId: "athlete-a",
      returnAttemptId: attemptA,
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

  it("rejects a cross-tab session hint without a verified auth-operation result", async () => {
    const pending = createPendingAccountSetup({
      method: "google",
      birthDate: "2000-01-01",
      config,
      attemptId: attemptA,
    })
    writePendingAccountSetup(pending)
    markPendingAccountAuthStarted(pending.attemptId)
    const save = vi.fn()

    await expect(finalizePendingAccountSetup({
      userId: "athlete-from-another-tab",
      returnAttemptId: attemptA,
      today: "2026-08-25",
      config,
      onSaveProfile: save,
    })).resolves.toEqual({ attempted: false, result: null })

    expect(save).not.toHaveBeenCalled()
    expect(sessionStorage.length).toBe(0)
  })

  it("forwards the exact verified session so the server can reject a substituted session", async () => {
    const pending = createPendingAccountSetup({
      method: "google",
      birthDate: "2000-01-01",
      config,
      attemptId: attemptA,
    })
    writePendingAccountSetup(pending)
    markPendingAccountAuthStarted(attemptA)
    expect(markPendingAccountAuthVerified(attemptA, "athlete-a", "google", sessionA)).toBe(true)
    const save = vi.fn().mockResolvedValue({ ok: false, message: "SESSION_MISMATCH" })

    await expect(finalizePendingAccountSetup({
      userId: "athlete-a",
      returnAttemptId: attemptA,
      today: "2026-08-25",
      config,
      onSaveProfile: save,
    })).resolves.toEqual({ attempted: true, result: { ok: false, message: "SESSION_MISMATCH" } })
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ expectedSessionId: sessionA }))
    expect(readPendingAccountSetup()).not.toBeNull()
  })

  it("does not let the generic verifier mark an email-only attempt", () => {
    const pending = createPendingAccountSetup({
      method: "email",
      birthDate: "2000-01-01",
      config,
      attemptId: attemptA,
      expectedEmail: "runner@example.com",
    })
    writePendingAccountSetup(pending)
    markPendingAccountAuthStarted(attemptA)

    expect(markPendingAccountAuthVerified(attemptA, "athlete-a", "google", sessionA)).toBe(false)
    expect(readPendingAccountSetup()).toMatchObject({ phase: "AUTH_STARTED", verifiedMethod: null })
  })

  it("rejects the same provider when the verified operation belongs to another user", async () => {
    const pending = createPendingAccountSetup({
      method: "google",
      birthDate: "2000-01-01",
      config,
      attemptId: attemptA,
    })
    writePendingAccountSetup(pending)
    markPendingAccountAuthStarted(attemptA)
    markPendingAccountAuthVerified(attemptA, "athlete-operation-a", "google", sessionA)
    const save = vi.fn()

    await expect(finalizePendingAccountSetup({
      userId: "athlete-session-b",
      returnAttemptId: attemptA,
      today: "2026-08-25",
      config,
      onSaveProfile: save,
    })).resolves.toEqual({ attempted: false, result: null })
    expect(save).not.toHaveBeenCalled()
    expect(readPendingAccountSetup()).toBeNull()
  })

  it("rejects an old redirect after a newer signup attempt replaced it", async () => {
    const pending = createPendingAccountSetup({
      method: "google",
      birthDate: "2000-01-01",
      config,
      attemptId: attemptB,
    })
    writePendingAccountSetup(pending)
    markPendingAccountAuthStarted(pending.attemptId)
    markPendingAccountAuthVerified(pending.attemptId, "athlete-a", "google", sessionA)
    const save = vi.fn()

    await expect(finalizePendingAccountSetup({
      userId: "athlete-a",
      returnAttemptId: attemptA,
      today: "2026-08-25",
      config,
      onSaveProfile: save,
    })).resolves.toEqual({ attempted: false, result: null })

    expect(save).not.toHaveBeenCalled()
    expect(sessionStorage.length).toBe(0)
  })

  it("does not accept prepared facts until an auth request actually started", async () => {
    writePendingAccountSetup(createPendingAccountSetup({
      method: "google",
      birthDate: "2000-01-01",
      config,
      attemptId: attemptA,
    }))
    const save = vi.fn()

    await expect(finalizePendingAccountSetup({
      userId: "athlete-a",
      returnAttemptId: attemptA,
      today: "2026-08-25",
      config,
      onSaveProfile: save,
    })).resolves.toEqual({ attempted: false, result: null })
    expect(save).not.toHaveBeenCalled()
  })

  it("accepts a phone setup only after the code verification transition", async () => {
    const pending = createPendingAccountSetup({
      method: "phone",
      birthDate: "2000-01-01",
      config,
      attemptId: attemptA,
    })
    writePendingAccountSetup(pending)
    expect(markPendingAccountAuthStarted(attemptA)).toBe(true)
    expect(markPendingAccountAuthVerified(attemptA, "athlete-phone", "phone", sessionA)).toBe(true)
    const save = vi.fn().mockResolvedValue({ ok: true, message: "saved" })

    await expect(finalizePendingAccountSetup({
      userId: "athlete-phone",
      returnAttemptId: null,
      today: "2026-08-25",
      config,
      onSaveProfile: save,
    })).resolves.toMatchObject({ attempted: true, result: { ok: true } })
    expect(save).toHaveBeenCalledOnce()
  })

  it("only clears the pending setup when the failed attempt still owns it", () => {
    writePendingAccountSetup(createPendingAccountSetup({
      method: "email",
      birthDate: "2000-01-01",
      config,
      attemptId: attemptB,
    }))

    clearPendingAccountSetupForAttempt(attemptA)
    expect(readPendingAccountSetup()?.attemptId).toBe(attemptB)
    clearPendingAccountSetupForAttempt(attemptB)
    expect(readPendingAccountSetup()).toBeNull()
  })
})
