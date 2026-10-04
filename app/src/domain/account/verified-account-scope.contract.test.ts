import { beforeEach, describe, expect, it, vi } from "vitest"
import type { AccountUser } from "./auth"
import {
  requestVerifiedAccountScopeRefresh,
  startVerifiedAccountScope,
  type VerifiedAccountScopeStatus,
  VERIFIED_ACCOUNT_SCOPE_REFRESH_STORAGE_KEY,
} from "./verified-account-scope"

const account = (id: string): AccountUser => ({ id, email: null, phone: null, provider: null })

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}

describe("verified local account scope", () => {
  let authListener: ((user: AccountUser | null) => void) | null
  let quarantineListener: ((quarantined: boolean) => void) | null
  let currentUser: ReturnType<typeof vi.fn<(options: { throwOnFailure: true }) => Promise<AccountUser | null>>>
  let loadSetup: ReturnType<typeof vi.fn<(input: { userId: string }) => Promise<{ ok: boolean; ready: boolean }>>>
  let activeScope: string | null
  let quarantined: boolean
  let statuses: VerifiedAccountScopeStatus[]
  let setScope: ReturnType<typeof vi.fn<(value: string | null) => void>>
  let setAuthState: ReturnType<typeof vi.fn<(state: "RESOLVING" | "GUEST" | "FAILED") => void>>

  beforeEach(() => {
    authListener = null
    quarantineListener = null
    activeScope = null
    quarantined = false
    statuses = []
    setScope = vi.fn((value: string | null) => { activeScope = value })
    setAuthState = vi.fn()
    currentUser = vi.fn().mockResolvedValue(null)
    loadSetup = vi.fn().mockResolvedValue({ ok: true, ready: true })
  })

  const start = () => startVerifiedAccountScope(status => statuses.push(status), {
    currentUser,
    onAuthChange: listener => { authListener = listener; return () => { authListener = null } },
    loadPrivateProfileSetupStatus: loadSetup,
    setActiveLocalAccount: setScope,
    setAccountAuthState: setAuthState,
    isQuarantined: () => quarantined,
    subscribeQuarantine: listener => { quarantineListener = listener; return () => { quarantineListener = null } },
  })

  it("treats raw user payloads as hints and opens scope only after exact identity and READY checks", async () => {
    const identity = deferred<AccountUser | null>()
    currentUser.mockReturnValueOnce(Promise.resolve(null)).mockReturnValueOnce(identity.promise).mockResolvedValueOnce(account("account-a"))
    const dispose = start()
    await vi.waitFor(() => expect(statuses).toContain("READY"))
    authListener?.(account("account-a"))
    expect(activeScope).toBeNull()
    expect(setScope).not.toHaveBeenCalledWith("account-a")
    identity.resolve(account("account-a"))
    await vi.waitFor(() => expect(activeScope).toBe("account-a"))
    expect(loadSetup).toHaveBeenCalledWith({ userId: "account-a" })
    expect(statuses.at(-1)).toBe("READY")
    dispose()
    expect(activeScope).toBeNull()
  })

  it.each([
    ["identity changed", account("other"), { ok: true, ready: true }],
    ["profile is not ready", account("account-a"), { ok: true, ready: false }],
    ["setup verification failed", account("account-a"), { ok: false, ready: false }],
  ])("fails closed when %s", async (_reason, configure, setup) => {
    currentUser.mockResolvedValueOnce(null).mockResolvedValue(configure)
    loadSetup.mockResolvedValue(setup)
    const dispose = start()
    await vi.waitFor(() => expect(statuses).toContain("READY")) // initial guest resolution
    authListener?.(account("account-a"))
    await vi.waitFor(() => expect(statuses.at(-1)).toBe("FAILED"))
    expect(activeScope).toBeNull()
    dispose()
  })

  it("cancels a pending account check after signout and revokes on quarantine changes", async () => {
    const identity = deferred<AccountUser | null>()
    currentUser.mockResolvedValueOnce(null).mockReturnValueOnce(identity.promise)
    const dispose = start()
    await vi.waitFor(() => expect(statuses).toContain("READY"))
    authListener?.(account("account-a"))
    authListener?.(null)
    identity.resolve(account("account-a"))
    await vi.waitFor(() => expect(statuses.at(-1)).toBe("READY"))
    expect(activeScope).toBeNull()
    expect(loadSetup).not.toHaveBeenCalled()

    quarantined = true
    quarantineListener?.(true)
    expect(activeScope).toBeNull()
    expect(statuses.at(-1)).toBe("FAILED")
    quarantined = false
    currentUser.mockResolvedValue(account("account-b"))
    quarantineListener?.(false)
    await vi.waitFor(() => expect(activeScope).toBe("account-b"))
    dispose()
  })

  it("does not activate when currentUser or setup lookup throws", async () => {
    currentUser.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error("offline"))
    const dispose = start()
    await vi.waitFor(() => expect(statuses).toContain("READY"))
    authListener?.(account("account-a"))
    await vi.waitFor(() => expect(statuses.at(-1)).toBe("FAILED"))
    expect(activeScope).toBeNull()
    dispose()
  })

  it("rechecks server admission after onboarding without another auth event", async () => {
    currentUser.mockResolvedValue(null)
    loadSetup.mockResolvedValueOnce({ ok: false, ready: false })
    const dispose = start()
    await vi.waitFor(() => expect(statuses).toContain("READY"))

    currentUser.mockResolvedValue(account("account-a"))
    authListener?.(account("account-a"))
    await vi.waitFor(() => expect(statuses.at(-1)).toBe("FAILED"))
    expect(activeScope).toBeNull()

    loadSetup.mockResolvedValue({ ok: true, ready: true })
    requestVerifiedAccountScopeRefresh()
    await vi.waitFor(() => expect(activeScope).toBe("account-a"))
    expect(statuses.at(-1)).toBe("READY")
    dispose()
  })

  it("reruns full verification for a cross-tab refresh without trusting storage payload", async () => {
    currentUser.mockResolvedValue(null)
    const dispose = start()
    await vi.waitFor(() => expect(statuses).toContain("READY"))

    currentUser.mockResolvedValue(account("account-a"))
    loadSetup.mockResolvedValue({ ok: true, ready: true })
    window.dispatchEvent(new StorageEvent("storage", {
      key: VERIFIED_ACCOUNT_SCOPE_REFRESH_STORAGE_KEY,
      newValue: JSON.stringify({ userId: "forged-account" }),
    }))

    await vi.waitFor(() => expect(activeScope).toBe("account-a"))
    expect(loadSetup).toHaveBeenCalledWith({ userId: "account-a" })
    expect(currentUser).toHaveBeenCalledWith({ throwOnFailure: true })
    dispose()
  })
})
