import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { accountConfigMock, supabaseMock } = vi.hoisted(() => ({
  accountConfigMock: vi.fn(),
  supabaseMock: vi.fn(),
}))

vi.mock("./config", () => ({ accountConfig: accountConfigMock }))
vi.mock("./supabase-client", () => ({ supabase: supabaseMock }))

import {
  __resetCapturedEmailAuthCallbackForTest,
  captureEmailAuthCallbackFromUrl,
  consumeCapturedEmailAuthCallback,
} from "./email-auth-callback"
import {
  __resetCapturedOAuthAuthCallbackForTest,
  captureOAuthAuthCallbackFromUrl,
  consumeCapturedOAuthAuthCallback,
} from "./oauth-auth-callback"
import {
  createPendingAccountSetup,
  markPendingAccountAuthStarted,
  readPendingAccountSetup,
  writePendingAccountSetup,
} from "./auth-onboarding"
import { isAuthSessionQuarantined } from "./auth-session-quarantine"
import { createEmailAuthBrowserProof } from "./email-auth-browser-proof"

const tokenHash = "a".repeat(64)
const attemptId = "b".repeat(32)
const accessToken = "email-access-token".padEnd(40, "x")
const sessionId = "11111111-1111-4111-8111-111111111111"
const config = {
  url: "https://example.supabase.co",
  anonKey: "public-anon-key",
  kakaoAuthEnabled: false,
  googleAuthEnabled: false,
  emailAuthEnabled: true,
  phoneAuthEnabled: false,
  privacyPolicy: { url: "https://trainoracle.example/privacy", version: "2026-08-25" },
  termsOfService: { url: "https://trainoracle.example/terms", version: "2026-08-25" },
}

beforeEach(() => {
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: {
      request: vi.fn(async (_name: string, _options: unknown, operation: () => Promise<unknown>) => operation()),
    },
  })
  __resetCapturedEmailAuthCallbackForTest()
  __resetCapturedOAuthAuthCallbackForTest()
  localStorage.clear()
  expect(createEmailAuthBrowserProof(attemptId)).toBe(true)
  sessionStorage.clear()
  accountConfigMock.mockReturnValue(config)
  supabaseMock.mockReset()
})

afterEach(() => vi.restoreAllMocks())

describe("PKCE email callback", () => {
  it("scrubs the one-time credential before exchanging it and verifies it once", async () => {
    const replaceState = vi.fn()
    const verifyOtp = vi.fn().mockResolvedValue({
      data: {
        user: { id: "athlete-email", email: "runner@example.com" },
        session: { access_token: accessToken },
      },
      error: null,
    })
    const getClaims = vi.fn().mockResolvedValue({
      data: { claims: { sub: "athlete-email", session_id: sessionId } },
      error: null,
    })
    const getUser = vi.fn().mockResolvedValue({ data: { user: { id: "athlete-email", email: "runner@example.com" } }, error: null })
    supabaseMock.mockResolvedValue({ auth: { verifyOtp, getClaims, getUser } })
    const pending = createPendingAccountSetup({ method: "email", birthDate: "2000-01-01", config, attemptId, expectedEmail: "runner@example.com" })
    writePendingAccountSetup(pending)
    markPendingAccountAuthStarted(attemptId)

    expect(captureEmailAuthCallbackFromUrl({
      href: `https://trainoracle.example/app/?account=1&account_flow=${attemptId}#token_hash=${tokenHash}&type=email`,
      replaceState,
    })).toBe(true)
    expect(replaceState).toHaveBeenCalledWith(
      `https://trainoracle.example/app/?account=1&account_flow=${attemptId}`,
    )
    expect(replaceState.mock.calls[0]?.[0]).not.toContain("token_hash")

    const expected = {
      handled: true,
      ok: true,
      message: "이메일 확인을 마쳤어요.",
      verifiedUserId: "athlete-email",
      pendingBound: true,
    }
    await expect(consumeCapturedEmailAuthCallback()).resolves.toEqual(expected)
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: tokenHash, type: "email" })
    await expect(consumeCapturedEmailAuthCallback()).resolves.toEqual(expected)
    expect(verifyOtp).toHaveBeenCalledOnce()
    expect(readPendingAccountSetup()).toMatchObject({
      phase: "AUTH_VERIFIED",
      verifiedUserId: "athlete-email",
      verifiedSessionId: sessionId,
    })
    expect(getClaims).toHaveBeenCalledWith(accessToken)
    expect(getUser).toHaveBeenCalledWith(accessToken)
  })

  it.each([
    `https://trainoracle.example/app/?account_flow=${attemptId}#token_hash=${tokenHash}`,
    `https://trainoracle.example/app/?account_flow=${attemptId}#token_hash=${tokenHash}&type=signup`,
    `https://trainoracle.example/app/?account_flow=${attemptId}#token_hash=short&type=email`,
    `https://trainoracle.example/app/?account_flow=${attemptId}#token_hash=${tokenHash}&token_hash=${"c".repeat(64)}&type=email`,
    `https://trainoracle.example/app/?account_flow=${attemptId}&token_hash=${tokenHash}&type=email`,
  ])("fails closed and still scrubs malformed callback %s", async href => {
    const replaceState = vi.fn()
    expect(captureEmailAuthCallbackFromUrl({ href, replaceState })).toBe(true)
    expect(replaceState.mock.calls[0]?.[0]).not.toContain("token_hash")
    await expect(consumeCapturedEmailAuthCallback()).resolves.toMatchObject({ handled: true, ok: false })
    expect(supabaseMock).not.toHaveBeenCalled()
  })

  it("does not consume a generic type query without an email token", async () => {
    expect(captureEmailAuthCallbackFromUrl({
      href: "https://trainoracle.example/app/?type=training",
      replaceState: vi.fn(),
    })).toBe(false)
    await expect(consumeCapturedEmailAuthCallback()).resolves.toEqual({ handled: false })
  })

  it("rejects a forwarded link before Supabase when this browser did not request it", async () => {
    localStorage.clear()
    const pending = createPendingAccountSetup({ method: "email", birthDate: "2000-01-01", config, attemptId, expectedEmail: "runner@example.com" })
    writePendingAccountSetup(pending)
    markPendingAccountAuthStarted(attemptId)
    captureEmailAuthCallbackFromUrl({
      href: `https://trainoracle.example/app/?account=1&account_flow=${attemptId}#token_hash=${tokenHash}&type=email`,
      replaceState: vi.fn(),
    })

    await expect(consumeCapturedEmailAuthCallback()).resolves.toMatchObject({ handled: true, ok: false })
    expect(supabaseMock).not.toHaveBeenCalled()
    expect(isAuthSessionQuarantined()).toBe(false)
  })

  it("honors the email kill gate even when a valid link reaches the app", async () => {
    accountConfigMock.mockReturnValue({ emailAuthEnabled: false })
    captureEmailAuthCallbackFromUrl({
      href: `https://trainoracle.example/app/?account_flow=${attemptId}#token_hash=${tokenHash}&type=email`,
      replaceState: vi.fn(),
    })

    await expect(consumeCapturedEmailAuthCallback()).resolves.toMatchObject({ handled: true, ok: false })
    expect(supabaseMock).not.toHaveBeenCalled()
  })

  it("returns a safe retry message when verification throws", async () => {
    supabaseMock.mockRejectedValue(new Error("network detail must not escape"))
    const pending = createPendingAccountSetup({ method: "email", birthDate: "2000-01-01", config, attemptId, expectedEmail: "runner@example.com" })
    writePendingAccountSetup(pending)
    markPendingAccountAuthStarted(attemptId)
    captureEmailAuthCallbackFromUrl({
      href: `https://trainoracle.example/app/?account_flow=${attemptId}#token_hash=${tokenHash}&type=email`,
      replaceState: vi.fn(),
    })

    const result = await consumeCapturedEmailAuthCallback()
    expect(result).toMatchObject({ handled: true, ok: false })
    expect(JSON.stringify(result)).not.toContain(tokenHash)
    expect(JSON.stringify(result)).not.toContain("network detail")
  })

  it("does not verify a link opened in a new tab until age and legal facts are re-entered", async () => {
    const verifyOtp = vi.fn().mockResolvedValue({
      data: {
        user: { id: "athlete-new-tab", email: "runner@example.com" },
        session: { access_token: accessToken },
      },
      error: null,
    })
    const getClaims = vi.fn().mockResolvedValue({
      data: { claims: { sub: "athlete-new-tab", session_id: sessionId } },
      error: null,
    })
    const getUser = vi.fn().mockResolvedValue({ data: { user: { id: "athlete-new-tab", email: "runner@example.com" } }, error: null })
    supabaseMock.mockResolvedValue({ auth: { verifyOtp, getClaims, getUser } })
    captureEmailAuthCallbackFromUrl({
      href: `https://trainoracle.example/app/?account=1&account_flow=${attemptId}#token_hash=${tokenHash}&type=email`,
      replaceState: vi.fn(),
    })

    await expect(consumeCapturedEmailAuthCallback()).resolves.toMatchObject({
      handled: true,
      ok: false,
      requiresPreAuth: true,
      attemptId,
    })
    expect(supabaseMock).not.toHaveBeenCalled()

    const pending = createPendingAccountSetup({ method: "email", birthDate: "2000-01-01", config, attemptId, expectedEmail: "runner@example.com" })
    writePendingAccountSetup(pending)
    markPendingAccountAuthStarted(attemptId)
    await expect(consumeCapturedEmailAuthCallback()).resolves.toMatchObject({
      handled: true,
      ok: true,
      verifiedUserId: "athlete-new-tab",
    })
    expect(verifyOtp).toHaveBeenCalledOnce()
  })

  it("closes the new local session if the pending attempt disappears during OTP verification", async () => {
    let resolveVerification!: (value: unknown) => void
    const verifyOtp = vi.fn().mockImplementation(() => new Promise(resolve => { resolveVerification = resolve }))
    const signOut = vi.fn().mockResolvedValue({ error: null })
    supabaseMock.mockResolvedValue({ auth: { verifyOtp, signOut } })
    const pending = createPendingAccountSetup({ method: "email", birthDate: "2000-01-01", config, attemptId, expectedEmail: "runner@example.com" })
    writePendingAccountSetup(pending)
    markPendingAccountAuthStarted(attemptId)
    captureEmailAuthCallbackFromUrl({
      href: `https://trainoracle.example/app/?account=1&account_flow=${attemptId}#token_hash=${tokenHash}&type=email`,
      replaceState: vi.fn(),
    })

    const completion = consumeCapturedEmailAuthCallback()
    await vi.waitFor(() => expect(verifyOtp).toHaveBeenCalledOnce())
    sessionStorage.clear()
    resolveVerification({ data: { user: { id: "athlete-race", email: "runner@example.com" } }, error: null })

    await expect(completion).resolves.toMatchObject({ handled: true, ok: false })
    expect(signOut).toHaveBeenCalledWith({ scope: "local" })
  })

  it("signs out and rejects a forwarded link when the verified email differs from the email re-entered by the user", async () => {
    const verifyOtp = vi.fn().mockResolvedValue({
      data: { user: { id: "attacker-account", email: "attacker@example.com" } },
      error: null,
    })
    const signOut = vi.fn().mockResolvedValue({ error: null })
    supabaseMock.mockResolvedValue({ auth: { verifyOtp, signOut } })
    const pending = createPendingAccountSetup({
      method: "email",
      birthDate: "2000-01-01",
      config,
      attemptId,
      expectedEmail: "runner@example.com",
    })
    writePendingAccountSetup(pending)
    markPendingAccountAuthStarted(attemptId)
    captureEmailAuthCallbackFromUrl({
      href: `https://trainoracle.example/app/?account=1&account_flow=${attemptId}#token_hash=${tokenHash}&type=email`,
      replaceState: vi.fn(),
    })

    await expect(consumeCapturedEmailAuthCallback()).resolves.toMatchObject({ handled: true, ok: false })
    expect(signOut).toHaveBeenCalledWith({ scope: "local" })
    expect(readPendingAccountSetup()).toBeNull()
  })

  it("reports an unsafe session when storage fails after OTP exchange and local sign-out is rejected", async () => {
    const verifyOtp = vi.fn().mockResolvedValue({
      data: { user: { id: "athlete-storage-race", email: "runner@example.com" } },
      error: null,
    })
    const signOut = vi.fn().mockResolvedValue({ error: new Error("logout unavailable") })
    supabaseMock.mockResolvedValue({ auth: { verifyOtp, signOut } })
    const pending = createPendingAccountSetup({
      method: "email",
      birthDate: "2000-01-01",
      config,
      attemptId,
      expectedEmail: "runner@example.com",
    })
    writePendingAccountSetup(pending)
    markPendingAccountAuthStarted(attemptId)
    captureEmailAuthCallbackFromUrl({
      href: `https://trainoracle.example/app/?account=1&account_flow=${attemptId}#token_hash=${tokenHash}&type=email`,
      replaceState: vi.fn(),
    })

    const originalGetItem = Storage.prototype.getItem
    let pendingReads = 0
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (this: Storage, key: string) {
      if (this === sessionStorage && key === "trainoracle.account.pending-setup.v1" && ++pendingReads === 2) {
        throw new DOMException("storage blocked", "SecurityError")
      }
      return originalGetItem.call(this, key)
    })
    const result = await consumeCapturedEmailAuthCallback()
    getItem.mockRestore()

    expect(result).toMatchObject({ handled: true, ok: false, unsafeSessionOpen: true })
    expect(signOut).toHaveBeenCalledWith({ scope: "local" })
    expect(isAuthSessionQuarantined()).toBe(true)
  })

  it("does not exchange a credential when the durable quarantine cannot be written", async () => {
    const pending = createPendingAccountSetup({ method: "email", birthDate: "2000-01-01", config, attemptId, expectedEmail: "runner@example.com" })
    writePendingAccountSetup(pending)
    markPendingAccountAuthStarted(attemptId)
    const originalSetItem = Storage.prototype.setItem
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key: string, value: string) {
      if (this === localStorage && key === "trainoracle.auth.quarantine.v1") {
        throw new DOMException("storage blocked", "SecurityError")
      }
      return originalSetItem.call(this, key, value)
    })
    captureEmailAuthCallbackFromUrl({
      href: `https://trainoracle.example/app/?account=1&account_flow=${attemptId}#token_hash=${tokenHash}&type=email`,
      replaceState: vi.fn(),
    })

    await expect(consumeCapturedEmailAuthCallback()).resolves.toMatchObject({
      handled: true,
      ok: false,
      unsafeSessionOpen: true,
    })
    expect(supabaseMock).not.toHaveBeenCalled()
    setItem.mockRestore()
  })

  it("scrubs and rejects a mixed email and OAuth callback without either network operation", async () => {
    const replaceState = vi.fn()
    const mixedUrl = `https://trainoracle.example/app/?account=1&account_flow=${attemptId}&code=pkce-code-12345678901234567890#token_hash=${tokenHash}&type=email`
    expect(captureEmailAuthCallbackFromUrl({ href: mixedUrl, replaceState })).toBe(true)
    const safeUrl = String(replaceState.mock.calls[0]?.[0])
    expect(safeUrl).not.toContain("token_hash")
    expect(safeUrl).not.toContain("code=")
    expect(captureOAuthAuthCallbackFromUrl({ href: safeUrl, replaceState: vi.fn() })).toBe(false)

    await expect(consumeCapturedEmailAuthCallback()).resolves.toMatchObject({ handled: true, ok: false })
    await expect(consumeCapturedOAuthAuthCallback()).resolves.toEqual({ handled: false })
    expect(supabaseMock).not.toHaveBeenCalled()
  })
})
