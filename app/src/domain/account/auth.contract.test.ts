import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  authReturnAttemptId,
  authReturnUrl,
  maskPhoneNumber,
  normalizeKoreanMobilePhone,
  requestEmailOtp,
  requestPhoneOtp,
  signInWithProvider,
  signOut,
  verifyPhoneOtp,
} from "./auth"
import { createPendingAccountSetup, markPendingAccountAuthStarted, writePendingAccountSetup } from "./auth-onboarding"
import { beginAuthSessionQuarantine, isAuthSessionQuarantined } from "./auth-session-quarantine"

const { accountConfigMock, supabaseMock } = vi.hoisted(() => ({
  accountConfigMock: vi.fn(),
  supabaseMock: vi.fn(),
}))
vi.mock("./supabase-client", () => ({ supabase: supabaseMock }))
vi.mock("./config", () => ({ accountConfig: accountConfigMock }))
const attemptId = "a".repeat(32)
const accessToken = "phone-access-token".padEnd(40, "x")
const sessionId = "33333333-3333-4333-8333-333333333333"

const enabledConfig = {
  kakaoAuthEnabled: true,
  googleAuthEnabled: true,
  emailAuthEnabled: true,
  phoneAuthEnabled: true,
}

const onboardingConfig = {
  ...enabledConfig,
  url: "https://example.supabase.co",
  anonKey: "public-anon-key",
  privacyPolicy: { url: "https://trainoracle.example/privacy", version: "2026-08-25" },
  termsOfService: { url: "https://trainoracle.example/terms", version: "2026-08-25" },
}

function prepareAttempt(method: "kakao" | "google" | "email" | "phone"): void {
  writePendingAccountSetup(createPendingAccountSetup({
    method,
    birthDate: "2000-01-01",
    config: onboardingConfig,
    attemptId,
    expectedEmail: method === "email" ? "runner@example.com" : undefined,
  }))
}

beforeEach(() => {
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: {
      request: vi.fn(async (_name: string, _options: unknown, operation: () => Promise<unknown>) => operation()),
    },
  })
  localStorage.clear()
  sessionStorage.clear()
  accountConfigMock.mockReturnValue(onboardingConfig)
})

afterEach(() => {
  vi.clearAllMocks()
})

accountConfigMock.mockReturnValue(onboardingConfig)

describe("simple social authentication", () => {
  it("returns to the account screen without losing the deployed subpath", () => {
    expect(authReturnUrl("https://hojune0330.github.io/TRAINORACLE/?from=plan#token"))
      .toBe("https://hojune0330.github.io/TRAINORACLE/?account=1")
  })

  it("binds only a valid non-sensitive attempt id to the return URL", () => {
    const result = authReturnUrl("https://trainoracle.example/?from=account#token", attemptId)
    expect(result).toBe(`https://trainoracle.example/?account=1&account_flow=${attemptId}`)
    expect(authReturnAttemptId(result)).toBe(attemptId)
    expect(authReturnAttemptId("https://trainoracle.example/?account_flow=short")).toBeNull()
    expect(authReturnAttemptId(`https://trainoracle.example/?account_flow=${attemptId}&account_flow=${"b".repeat(32)}`)).toBeNull()
    expect(() => authReturnUrl("https://trainoracle.example/", "short")).toThrow("INVALID_AUTH_ATTEMPT_ID")
  })

  it("does not copy untrusted or sensitive current-page parameters into a provider redirect", () => {
    const result = authReturnUrl(
      "https://trainoracle.example/app?token_hash=secret&code=oauth-code&error=details&share=private&profile=athlete#access_token=secret",
      attemptId,
    )
    const url = new URL(result ?? "")

    expect(url.origin + url.pathname).toBe("https://trainoracle.example/app")
    expect([...url.searchParams.keys()].sort()).toEqual(["account", "account_flow"])
    expect(url.hash).toBe("")
  })

  it.each(["kakao", "google"] as const)("starts %s through the same Supabase OAuth boundary", async (provider) => {
    prepareAttempt(provider)
    const signInWithOAuth = vi.fn().mockResolvedValue({ error: null })
    supabaseMock.mockResolvedValue({ auth: { signInWithOAuth } })

    await expect(signInWithProvider(provider, attemptId)).resolves.toMatchObject({ ok: true })
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider,
      options: { redirectTo: expect.stringContaining(`account_flow=${attemptId}`) },
    })
  })

  it("fails closed when the provider cannot be started", async () => {
    prepareAttempt("kakao")
    const signInWithOAuth = vi.fn().mockResolvedValue({ error: new Error("provider disabled") })
    supabaseMock.mockResolvedValue({ auth: { signInWithOAuth } })

    await expect(signInWithProvider("kakao", attemptId)).resolves.toEqual({
      ok: false,
      message: "카카오 로그인을 시작하지 못했어요.",
    })
  })

  it.each(["kakao", "google"] as const)("does not contact Supabase when the %s release gate is closed", async provider => {
    accountConfigMock.mockReturnValue({
      ...onboardingConfig,
      [`${provider}AuthEnabled`]: false,
    })

    await expect(signInWithProvider(provider, attemptId)).resolves.toMatchObject({ ok: false })
    expect(supabaseMock).not.toHaveBeenCalled()
  })

  it("rejects an unsupported runtime provider even when another method is open", async () => {
    await expect(signInWithProvider("github" as never, attemptId)).resolves.toMatchObject({ ok: false })
    expect(supabaseMock).not.toHaveBeenCalled()
  })

  it("does not contact an auth provider for an under-14 or unbound attempt", async () => {
    writePendingAccountSetup(createPendingAccountSetup({
      method: "google",
      birthDate: "2020-01-01",
      config: onboardingConfig,
      attemptId,
    }))
    await expect(signInWithProvider("google", attemptId)).resolves.toMatchObject({ ok: false })
    sessionStorage.clear()
    await expect(signInWithProvider("google", attemptId)).resolves.toMatchObject({ ok: false })
    expect(supabaseMock).not.toHaveBeenCalled()
  })
})

describe("passwordless email confirmation", () => {
  it("sends the default Supabase confirmation link back to the account screen", async () => {
    prepareAttempt("email")
    const signInWithOtp = vi.fn().mockResolvedValue({ error: null })
    supabaseMock.mockResolvedValue({ auth: { signInWithOtp } })

    await expect(requestEmailOtp(" runner@example.com ", attemptId)).resolves.toEqual({
      ok: true,
      message: "확인 링크를 이메일로 보냈어요.",
    })
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "runner@example.com",
      options: {
        shouldCreateUser: true,
        emailRedirectTo: expect.stringContaining(`account_flow=${attemptId}`),
      },
    })
  })

  it("does not send a link when the email PKCE operations gate is closed", async () => {
    accountConfigMock.mockReturnValue({ ...onboardingConfig, emailAuthEnabled: false })

    await expect(requestEmailOtp("runner@example.com", attemptId)).resolves.toMatchObject({ ok: false })
    expect(supabaseMock).not.toHaveBeenCalled()
  })
})

describe("session sign-out scope", () => {
  const owner = "synthetic-deletion-owner-a"
  const superseded = { ok: false, message: "현재 계정이 바뀌어 로그아웃을 중단했어요." }
  const ownerSession = () => ({ data: { session: { user: { id: owner } } }, error: null })

  it("refuses superseded deletion cleanup before waiting for the origin lock", async () => {
    await expect(signOut({ expectedUserId: owner, isCurrent: () => false })).resolves.toEqual(superseded)
    expect(navigator.locks.request).not.toHaveBeenCalled()
    expect(supabaseMock).not.toHaveBeenCalled()
  })

  it("rechecks deletion generation after waiting for the origin lock", async () => {
    let release!: () => Promise<unknown>
    let current = true
    Object.defineProperty(navigator, "locks", { configurable: true, value: {
      request: vi.fn((_name: string, _options: unknown, operation: () => Promise<unknown>) =>
        new Promise(resolve => { release = async () => { resolve(await operation()) } })),
    } })
    const result = signOut({ expectedUserId: owner, isCurrent: () => current })
    current = false
    await release()
    await expect(result).resolves.toEqual(superseded)
    expect(supabaseMock).not.toHaveBeenCalled()
  })

  it("does not log B out when account changes during client initialization", async () => {
    let initialize!: (client: unknown) => void
    let current = true
    const getSession = vi.fn().mockResolvedValue(ownerSession())
    const signOutClient = vi.fn().mockResolvedValue({ error: null })
    supabaseMock.mockImplementationOnce(() => new Promise(resolve => { initialize = resolve }))
    const result = signOut({ scope: "global", expectedUserId: owner, isCurrent: () => current })
    await vi.waitFor(() => expect(supabaseMock).toHaveBeenCalledOnce())
    current = false
    initialize({ auth: { getSession, signOut: signOutClient } })
    await expect(result).resolves.toEqual(superseded)
    expect(getSession).not.toHaveBeenCalled()
    expect(signOutClient).not.toHaveBeenCalled()
  })

  it.each([
    { data: { session: { user: { id: "synthetic-owner-b" } } }, error: null },
    { data: { session: null }, error: null },
    { data: { session: null }, error: new Error("unreadable local session") },
  ])("does not sign another or unconfirmed SDK session out", async session => {
    const signOutClient = vi.fn().mockResolvedValue({ error: null })
    supabaseMock.mockResolvedValue({ auth: { getSession: vi.fn().mockResolvedValue(session), signOut: signOutClient } })
    await expect(signOut({ expectedUserId: owner, isCurrent: () => true })).resolves.toEqual(superseded)
    expect(signOutClient).not.toHaveBeenCalled()
  })

  it("rejects A to B to A even if the delayed session read again reports owner A", async () => {
    let readSession!: (session: ReturnType<typeof ownerSession>) => void
    let generation = 0
    const expectedGeneration = generation
    const getSession = vi.fn(() => new Promise(resolve => { readSession = resolve }))
    const signOutClient = vi.fn().mockResolvedValue({ error: null })
    supabaseMock.mockResolvedValue({ auth: { getSession, signOut: signOutClient } })
    const result = signOut({ expectedUserId: owner, isCurrent: () => generation === expectedGeneration })
    await vi.waitFor(() => expect(getSession).toHaveBeenCalledOnce())
    generation += 2
    readSession(ownerSession())
    await expect(result).resolves.toEqual(superseded)
    expect(signOutClient).not.toHaveBeenCalled()
  })

  it("rechecks deletion generation immediately before the actual SDK sign-out call", async () => {
    const signOutClient = vi.fn().mockResolvedValue({ error: null })
    const isCurrent = vi.fn()
      .mockReturnValueOnce(true) // Before lock.
      .mockReturnValueOnce(true) // Inside lock.
      .mockReturnValueOnce(true) // After client initialization.
      .mockReturnValueOnce(true) // After owner read.
      .mockReturnValue(false) // Immediately before the SDK invocation.
    supabaseMock.mockResolvedValue({ auth: { getSession: vi.fn().mockResolvedValue(ownerSession()), signOut: signOutClient } })
    await expect(signOut({ expectedUserId: owner, isCurrent })).resolves.toEqual(superseded)
    expect(signOutClient).not.toHaveBeenCalled()
  })

  it("keeps a newer quarantine when deletion logout completes after generation changes", async () => {
    expect(beginAuthSessionQuarantine({ attemptId, method: "email" })).toBe(true)
    let complete!: (result: { error: null }) => void
    let current = true
    const signOutClient = vi.fn(() => new Promise(resolve => { complete = resolve }))
    supabaseMock.mockResolvedValue({ auth: { getSession: vi.fn().mockResolvedValue(ownerSession()), signOut: signOutClient } })
    const result = signOut({ expectedUserId: owner, isCurrent: () => current })
    await vi.waitFor(() => expect(signOutClient).toHaveBeenCalledOnce())
    current = false
    complete({ error: null })
    await expect(result).resolves.toEqual(superseded)
    expect(isAuthSessionQuarantined()).toBe(true)
  })

  it("passes only the scope to SDK logout for the still-current deletion owner", async () => {
    const signOutClient = vi.fn().mockResolvedValue({ error: null })
    supabaseMock.mockResolvedValue({ auth: { getSession: vi.fn().mockResolvedValue(ownerSession()), signOut: signOutClient } })
    await expect(signOut({ scope: "global", expectedUserId: owner, isCurrent: () => true }))
      .resolves.toEqual({ ok: true, message: "로그아웃되었어요." })
    expect(signOutClient).toHaveBeenCalledWith({ scope: "global" })
  })

  it("recovers an abandoned pre-exchange callback when no local session exists", async () => {
    expect(beginAuthSessionQuarantine({ attemptId, method: "email" })).toBe(true)
    const getSession = vi.fn().mockResolvedValue({ data: { session: null }, error: null })
    const signOutClient = vi.fn()
    supabaseMock.mockResolvedValue({ auth: { getSession, signOut: signOutClient } })

    await expect(signOut()).resolves.toEqual({ ok: true, message: "중단된 로그인을 정리했어요." })
    expect(signOutClient).not.toHaveBeenCalled()
    expect(isAuthSessionQuarantined()).toBe(false)
  })

  it("signs out only this browser by default", async () => {
    const signOutClient = vi.fn().mockResolvedValue({ error: null })
    supabaseMock.mockResolvedValue({ auth: { signOut: signOutClient } })

    await expect(signOut()).resolves.toEqual({
      ok: true,
      message: "로그아웃되었어요.",
    })
    expect(signOutClient).toHaveBeenCalledWith({ scope: "local" })
  })

  it("revokes every device only when global scope is explicit", async () => {
    const signOutClient = vi.fn().mockResolvedValue({ error: null })
    supabaseMock.mockResolvedValue({ auth: { signOut: signOutClient } })

    await expect(signOut({ scope: "global" })).resolves.toMatchObject({ ok: true })
    expect(signOutClient).toHaveBeenCalledWith({ scope: "global" })
  })

  it("keeps a Supabase sign-out failure as an explicit failure result", async () => {
    const signOutClient = vi.fn().mockResolvedValue({ error: new Error("network unavailable") })
    supabaseMock.mockResolvedValue({ auth: { signOut: signOutClient } })

    await expect(signOut()).resolves.toEqual({
      ok: false,
      message: "로그아웃에 실패했어요.",
    })
  })

  it("turns an unexpected sign-out exception into the same failure result", async () => {
    const signOutClient = vi.fn().mockRejectedValue(new Error("storage unavailable"))
    supabaseMock.mockResolvedValue({ auth: { signOut: signOutClient } })

    await expect(signOut()).resolves.toEqual({
      ok: false,
      message: "로그아웃에 실패했어요.",
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
    prepareAttempt("phone")
    const signInWithOtp = vi.fn().mockResolvedValue({ error: null })
    const verifyOtp = vi.fn().mockResolvedValue({
      data: { user: { id: "athlete-phone" }, session: { access_token: accessToken } },
      error: null,
    })
    const getClaims = vi.fn().mockResolvedValue({
      data: { claims: { sub: "athlete-phone", session_id: sessionId } },
      error: null,
    })
    const getUser = vi.fn().mockResolvedValue({ data: { user: { id: "athlete-phone" } }, error: null })
    supabaseMock.mockResolvedValue({ auth: { signInWithOtp, verifyOtp, getClaims, getUser } })

    await expect(requestPhoneOtp("010-1234-5678", attemptId)).resolves.toMatchObject({ ok: true })
    await expect(verifyPhoneOtp("01012345678", "123456", attemptId)).resolves.toMatchObject({ ok: true, verifiedUserId: "athlete-phone" })
    expect(signInWithOtp).toHaveBeenCalledWith({
      phone: "+821012345678",
      options: { shouldCreateUser: true },
    })
    expect(verifyOtp).toHaveBeenCalledWith({
      phone: "+821012345678",
      token: "123456",
      type: "sms",
    })
    expect(getClaims).toHaveBeenCalledWith(accessToken)
    expect(getUser).toHaveBeenCalledWith(accessToken)
  })

  it("reports an unsafe session when storage fails after SMS verification and local sign-out is rejected", async () => {
    prepareAttempt("phone")
    const signInWithOtp = vi.fn().mockResolvedValue({ error: null })
    const verifyOtp = vi.fn().mockResolvedValue({ data: { user: { id: "athlete-phone" } }, error: null })
    const signOutClient = vi.fn().mockResolvedValue({ error: new Error("logout unavailable") })
    supabaseMock.mockResolvedValue({ auth: { signInWithOtp, verifyOtp, signOut: signOutClient } })
    await requestPhoneOtp("010-1234-5678", attemptId)

    const originalGetItem = Storage.prototype.getItem
    let pendingReads = 0
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (this: Storage, key: string) {
      if (this === sessionStorage && key === "trainoracle.account.pending-setup.v1" && ++pendingReads === 2) {
        throw new DOMException("storage blocked", "SecurityError")
      }
      return originalGetItem.call(this, key)
    })
    const result = await verifyPhoneOtp("010-1234-5678", "123456", attemptId)
    getItem.mockRestore()

    expect(result).toMatchObject({ ok: false, unsafeSessionOpen: true })
    expect(signOutClient).toHaveBeenCalledWith({ scope: "local" })
  })

  it("does not verify an SMS code when the durable quarantine cannot be written", async () => {
    prepareAttempt("phone")
    markPendingAccountAuthStarted(attemptId)
    const verifyOtp = vi.fn()
    supabaseMock.mockResolvedValue({ auth: { verifyOtp } })
    const originalSetItem = Storage.prototype.setItem
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key: string, value: string) {
      if (this === localStorage && key === "trainoracle.auth.quarantine.v1") {
        throw new DOMException("storage blocked", "SecurityError")
      }
      return originalSetItem.call(this, key, value)
    })

    await expect(verifyPhoneOtp("010-1234-5678", "123456", attemptId)).resolves.toMatchObject({
      ok: false,
      unsafeSessionOpen: true,
    })
    expect(verifyOtp).not.toHaveBeenCalled()
    setItem.mockRestore()
  })

  it("does not call Supabase for an invalid domestic number", async () => {
    prepareAttempt("phone")
    const signInWithOtp = vi.fn()
    supabaseMock.mockResolvedValue({ auth: { signInWithOtp } })
    await expect(requestPhoneOtp("010-12", attemptId)).resolves.toMatchObject({ ok: false })
    expect(signInWithOtp).not.toHaveBeenCalled()
  })

  it("does not send or verify SMS while the phone operations gate is closed", async () => {
    accountConfigMock.mockReturnValue({ ...onboardingConfig, phoneAuthEnabled: false })

    await expect(requestPhoneOtp("010-1234-5678", attemptId)).resolves.toMatchObject({ ok: false })
    await expect(verifyPhoneOtp("010-1234-5678", "123456", attemptId)).resolves.toMatchObject({ ok: false })
    expect(supabaseMock).not.toHaveBeenCalled()
  })
})
