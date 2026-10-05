import { beforeEach, describe, expect, it, vi } from "vitest"

const { accountConfigMock, supabaseMock } = vi.hoisted(() => ({
  accountConfigMock: vi.fn(),
  supabaseMock: vi.fn(),
}))

vi.mock("./config", () => ({ accountConfig: accountConfigMock }))
vi.mock("./supabase-client", () => ({ supabase: supabaseMock }))

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

const attemptId = "a".repeat(32)
const code = "pkce-code-12345678901234567890"
const accessToken = "oauth-access-token".padEnd(40, "x")
const sessionId = "22222222-2222-4222-8222-222222222222"
const config = {
  url: "https://example.supabase.co",
  anonKey: "public-anon-key",
  kakaoAuthEnabled: true,
  googleAuthEnabled: true,
  emailAuthEnabled: false,
  phoneAuthEnabled: false,
  privacyPolicy: { url: "https://trainoracle.example/privacy", version: "2026-08-26" },
  termsOfService: { url: "https://trainoracle.example/terms", version: "2026-08-26" },
}

function prepareGoogleAttempt(): void {
  writePendingAccountSetup(createPendingAccountSetup({
    method: "google",
    birthDate: "2000-01-01",
    config,
    attemptId,
  }))
  markPendingAccountAuthStarted(attemptId)
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
  accountConfigMock.mockReturnValue(config)
  supabaseMock.mockReset()
  __resetCapturedOAuthAuthCallbackForTest()
})

describe("attempt-bound OAuth PKCE callback", () => {
  it("scrubs and exchanges one code, then binds the returned user to the pending attempt", async () => {
    prepareGoogleAttempt()
    const replaceState = vi.fn()
    const exchangeCodeForSession = vi.fn().mockResolvedValue({
      data: {
        user: { id: "athlete-google", app_metadata: { provider: "google" } },
        session: { access_token: accessToken },
      },
      error: null,
    })
    const getClaims = vi.fn().mockResolvedValue({
      data: { claims: { sub: "athlete-google", session_id: sessionId } },
      error: null,
    })
    const getUser = vi.fn().mockResolvedValue({ data: { user: { id: "athlete-google" } }, error: null })
    supabaseMock.mockResolvedValue({ auth: { exchangeCodeForSession, getClaims, getUser, signOut: vi.fn() } })

    expect(captureOAuthAuthCallbackFromUrl({
      href: `https://trainoracle.example/app/?account=1&account_flow=${attemptId}&code=${code}`,
      replaceState,
    })).toBe(true)
    expect(replaceState).toHaveBeenCalledWith(`https://trainoracle.example/app/?account=1&account_flow=${attemptId}`)

    const first = await consumeCapturedOAuthAuthCallback()
    const second = await consumeCapturedOAuthAuthCallback()
    expect(first).toEqual({
      handled: true,
      ok: true,
      message: "간편 로그인을 확인했어요.",
      verifiedUserId: "athlete-google",
      pendingBound: true,
    })
    expect(second).toEqual(first)
    expect(exchangeCodeForSession).toHaveBeenCalledOnce()
    expect(readPendingAccountSetup()).toMatchObject({
      phase: "AUTH_VERIFIED",
      verifiedUserId: "athlete-google",
      verifiedSessionId: sessionId,
    })
    expect(getClaims).toHaveBeenCalledWith(accessToken)
    expect(getUser).toHaveBeenCalledWith(accessToken)
  })

  it("does not mistake a cached session for a failed overlapping-tab exchange", async () => {
    prepareGoogleAttempt()
    const exchangeCodeForSession = vi.fn().mockResolvedValue({
      data: { user: null, session: null },
      error: new Error("verifier mismatch"),
    })
    supabaseMock.mockResolvedValue({ auth: { exchangeCodeForSession, signOut: vi.fn() } })
    captureOAuthAuthCallbackFromUrl({
      href: `https://trainoracle.example/app/?account=1&account_flow=${attemptId}&code=${code}`,
      replaceState: vi.fn(),
    })

    await expect(consumeCapturedOAuthAuthCallback()).resolves.toMatchObject({ handled: true, ok: false })
    expect(readPendingAccountSetup()).toBeNull()
  })

  it("closes the newly exchanged local session when the returned provider does not match", async () => {
    prepareGoogleAttempt()
    const signOut = vi.fn().mockResolvedValue({ error: null })
    supabaseMock.mockResolvedValue({
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({
          data: { user: { id: "athlete-kakao", app_metadata: { provider: "kakao" } } },
          error: null,
        }),
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "athlete-linked" } }, error: null }),
        signOut,
      },
    })
    captureOAuthAuthCallbackFromUrl({
      href: `https://trainoracle.example/app/?account=1&account_flow=${attemptId}&code=${code}`,
      replaceState: vi.fn(),
    })

    await expect(consumeCapturedOAuthAuthCallback()).resolves.toMatchObject({ ok: false })
    expect(signOut).toHaveBeenCalledWith({ scope: "local" })
    expect(readPendingAccountSetup()).toBeNull()
  })

  it("accepts a Google callback for an email-first user whose linked providers include Google", async () => {
    prepareGoogleAttempt()
    const signOut = vi.fn()
    supabaseMock.mockResolvedValue({
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: "athlete-linked",
              app_metadata: { provider: "email", providers: ["email", "google"] },
              identities: [{ provider: "email" }, { provider: "google" }],
            },
            session: { access_token: accessToken },
          },
          error: null,
        }),
        getClaims: vi.fn().mockResolvedValue({
          data: { claims: { sub: "athlete-linked", session_id: sessionId } },
          error: null,
        }),
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "athlete-linked" } }, error: null }),
        signOut,
      },
    })
    captureOAuthAuthCallbackFromUrl({
      href: `https://trainoracle.example/app/?account=1&account_flow=${attemptId}&code=${code}`,
      replaceState: vi.fn(),
    })

    await expect(consumeCapturedOAuthAuthCallback()).resolves.toMatchObject({
      ok: true,
      verifiedUserId: "athlete-linked",
    })
    expect(signOut).not.toHaveBeenCalled()
  })

  it("reports an unsafe session when storage fails after code exchange and local sign-out is rejected", async () => {
    prepareGoogleAttempt()
    const signOut = vi.fn().mockResolvedValue({ error: new Error("logout unavailable") })
    supabaseMock.mockResolvedValue({
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({
          data: { user: { id: "athlete-storage-race", app_metadata: { provider: "google" } } },
          error: null,
        }),
        signOut,
      },
    })
    captureOAuthAuthCallbackFromUrl({
      href: `https://trainoracle.example/app/?account=1&account_flow=${attemptId}&code=${code}`,
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
    const result = await consumeCapturedOAuthAuthCallback()
    getItem.mockRestore()

    expect(result).toMatchObject({ handled: true, ok: false, unsafeSessionOpen: true })
    expect(signOut).toHaveBeenCalledWith({ scope: "local" })
  })

  it("rechecks the exact provider kill gate before exchanging a returned code", async () => {
    prepareGoogleAttempt()
    accountConfigMock.mockReturnValue({ ...config, googleAuthEnabled: false })
    captureOAuthAuthCallbackFromUrl({
      href: `https://trainoracle.example/app/?account=1&account_flow=${attemptId}&code=${code}`,
      replaceState: vi.fn(),
    })

    await expect(consumeCapturedOAuthAuthCallback()).resolves.toMatchObject({ ok: false })
    expect(supabaseMock).not.toHaveBeenCalled()
    expect(readPendingAccountSetup()).toBeNull()
  })

  it("scrubs and rejects legacy implicit tokens without contacting Supabase", async () => {
    const replaceState = vi.fn()
    expect(captureOAuthAuthCallbackFromUrl({
      href: "https://trainoracle.example/app/?account=1#access_token=secret&refresh_token=more-secret&type=bearer",
      replaceState,
    })).toBe(true)

    const safeUrl = String(replaceState.mock.calls[0]?.[0])
    expect(safeUrl).not.toContain("access_token")
    expect(safeUrl).not.toContain("refresh_token")
    await expect(consumeCapturedOAuthAuthCallback()).resolves.toMatchObject({ handled: true, ok: false })
    expect(supabaseMock).not.toHaveBeenCalled()
  })

  it("scrubs a code-shaped callback even when its account marker was removed", async () => {
    const replaceState = vi.fn()
    expect(captureOAuthAuthCallbackFromUrl({
      href: `https://trainoracle.example/app/?account_flow=${attemptId}&code=${code}`,
      replaceState,
    })).toBe(true)
    expect(String(replaceState.mock.calls[0]?.[0])).not.toContain("code=")
    await expect(consumeCapturedOAuthAuthCallback()).resolves.toMatchObject({ ok: false })
  })
})
