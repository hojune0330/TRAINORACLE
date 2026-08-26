import { afterEach, describe, expect, it, vi } from "vitest"
import {
  authReturnUrl,
  maskPhoneNumber,
  normalizeKoreanMobilePhone,
  requestPhoneOtp,
  signInWithProvider,
  verifyPhoneOtp,
} from "./auth"

const { supabaseMock } = vi.hoisted(() => ({ supabaseMock: vi.fn() }))
vi.mock("./supabase-client", () => ({ supabase: supabaseMock }))

afterEach(() => {
  vi.clearAllMocks()
})

describe("simple social authentication", () => {
  it("returns to the account screen without losing the deployed subpath", () => {
    expect(authReturnUrl("https://hojune0330.github.io/TRAINORACLE/?from=plan#token"))
      .toBe("https://hojune0330.github.io/TRAINORACLE/?from=plan&account=1")
  })

  it.each(["kakao", "google"] as const)("starts %s through the same Supabase OAuth boundary", async (provider) => {
    const signInWithOAuth = vi.fn().mockResolvedValue({ error: null })
    supabaseMock.mockResolvedValue({ auth: { signInWithOAuth } })

    await expect(signInWithProvider(provider)).resolves.toMatchObject({ ok: true })
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider,
      options: { redirectTo: expect.stringContaining("account=1") },
    })
  })

  it("fails closed when the provider cannot be started", async () => {
    const signInWithOAuth = vi.fn().mockResolvedValue({ error: new Error("provider disabled") })
    supabaseMock.mockResolvedValue({ auth: { signInWithOAuth } })

    await expect(signInWithProvider("kakao")).resolves.toEqual({
      ok: false,
      message: "카카오 로그인을 시작하지 못했어요.",
    })
  })
})

describe("Korean phone OTP authentication", () => {
  it.each([
    ["010-1234-5678", "+821012345678"],
    ["01012345678", "+821012345678"],
    ["+82 10 1234 5678", "+821012345678"],
    ["821012345678", "+821012345678"],
  ])("normalizes %s to a single E.164 identity", (source, expected) => {
    expect(normalizeKoreanMobilePhone(source)).toBe(expected)
  })

  it.each(["", "010-123-4567", "011-1234-5678", "+1-333-444-5555"])("rejects unsupported number %s", value => {
    expect(normalizeKoreanMobilePhone(value)).toBeNull()
  })

  it("masks the account identifier instead of showing the full phone number", () => {
    expect(maskPhoneNumber("+821012345678")).toBe("010-****-5678")
  })

  it("sends and verifies one normalized SMS identity", async () => {
    const signInWithOtp = vi.fn().mockResolvedValue({ error: null })
    const verifyOtp = vi.fn().mockResolvedValue({ error: null })
    supabaseMock.mockResolvedValue({ auth: { signInWithOtp, verifyOtp } })

    await expect(requestPhoneOtp("010-1234-5678")).resolves.toMatchObject({ ok: true })
    await expect(verifyPhoneOtp("01012345678", "123456")).resolves.toMatchObject({ ok: true })
    expect(signInWithOtp).toHaveBeenCalledWith({
      phone: "+821012345678",
      options: { shouldCreateUser: true },
    })
    expect(verifyOtp).toHaveBeenCalledWith({
      phone: "+821012345678",
      token: "123456",
      type: "sms",
    })
  })

  it("does not call Supabase for an invalid domestic number", async () => {
    const signInWithOtp = vi.fn()
    supabaseMock.mockResolvedValue({ auth: { signInWithOtp } })
    await expect(requestPhoneOtp("010-12")).resolves.toMatchObject({ ok: false })
    expect(signInWithOtp).not.toHaveBeenCalled()
  })
})
