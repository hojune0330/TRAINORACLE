import { beforeEach, describe, expect, it, vi } from "vitest"
import type { AccountConfig } from "./config"
const mocks = vi.hoisted(() => ({ enabled: true, recovery: false, callback: false, quarantined: false,
  isolated: { auth: { updateUser: vi.fn(), reauthenticate: vi.fn(), dispose: vi.fn() } }, factory: vi.fn(),
  client: { rpc: vi.fn(), auth: { getSession: vi.fn(), getClaims: vi.fn(), getUser: vi.fn(), updateUser: vi.fn(), reauthenticate: vi.fn(), signUp: vi.fn() } } }))
vi.mock("./config", () => ({ accountConfig: () => ({ passwordAuthEnabled: mocks.enabled }) }))
vi.mock("./account-settings-client", () => ({ createAccountSettingsClient: mocks.factory }))
vi.mock("./supabase-client", () => ({ supabase: async () => mocks.client }))
vi.mock("./password-auth", () => ({ PASSWORD_MIN_LENGTH: 8, PASSWORD_MAX_LENGTH: 256, hasPasswordRecoveryCallback: () => mocks.callback, isPasswordRecoveryActive: () => mocks.recovery }))
vi.mock("./auth-session-quarantine", () => ({ isAuthSessionQuarantined: () => mocks.quarantined }))
const owner = "11111111-1111-4111-8111-111111111111", sessionId = "22222222-2222-4222-8222-222222222222", otherSession = "33333333-3333-4333-8333-333333333333"
const token = "synthetic-account-settings-access-token-123456789", secret = "new-password-for-existing-account", current = "existing-password", nonce = "123456"
const user = { id: owner }, session = { access_token: token, refresh_token: "synthetic-refresh", user }
const claims = (id = sessionId, methods = ["password"]) => ({ data: { claims: { sub: owner, session_id: id, amr: methods.map(method => ({ method })) } }, error: null })
let api: typeof import("./account-settings")
beforeEach(async () => {
  vi.resetModules(); vi.resetAllMocks(); sessionStorage.clear(); localStorage.clear()
  mocks.factory.mockResolvedValue(mocks.isolated)
  mocks.enabled = true; mocks.recovery = false; mocks.callback = false; mocks.quarantined = false
  mocks.client.auth.getSession.mockResolvedValue({ data: { session }, error: null })
  mocks.client.auth.getClaims.mockResolvedValue(claims())
  mocks.client.auth.getUser.mockResolvedValue({ data: { user }, error: null })
  mocks.isolated.auth.updateUser.mockResolvedValue({ data: { user }, error: null })
  mocks.isolated.auth.reauthenticate.mockResolvedValue({ error: null })
  mocks.client.rpc.mockResolvedValue({ data: { providers: ["google"], hasPassword: false }, error: null })
  api = await import("./account-settings")
})

describe("existing account settings exact owner and session", () => {
  it("accepts only the exact current ordinary auth attempt session", async () => {
    expect(await api.isCurrentAccountAuthAttempt(owner, sessionId)).toBe(true)
    expect(await api.isCurrentAccountAuthAttempt(owner, otherSession)).toBe(false)
    mocks.client.auth.getClaims.mockResolvedValue(claims(sessionId, ["recovery"]))
    expect(await api.isCurrentAccountAuthAttempt(owner, sessionId)).toBe(false)
  })
  it("loads only independently verified auth methods for the exact current session", async () => {
    expect(await api.loadAccountAuthMethods(owner)).toMatchObject({ ok: true, providers: ["google"], hasPassword: false })
    expect(mocks.client.auth.getClaims).toHaveBeenCalledWith(token)
    expect(mocks.client.auth.getUser).toHaveBeenCalledWith(token)
    expect(mocks.client.rpc).toHaveBeenCalledWith("get_account_auth_methods", { expected_user_id_input: owner, expected_session_id_input: sessionId })
  })
  it.each(["ambient-owner", "verified-owner", "session-change"])("denies methods on %s mismatch", async change => {
    if (change === "ambient-owner") mocks.client.auth.getSession.mockResolvedValue({ data: { session: { ...session, user: { id: "another-owner" } } }, error: null })
    if (change === "verified-owner") mocks.client.auth.getUser.mockResolvedValue({ data: { user: { id: "another-owner" } }, error: null })
    if (change === "session-change") mocks.client.auth.getClaims.mockResolvedValueOnce(claims()).mockResolvedValue(claims(otherSession))
    expect((await api.loadAccountAuthMethods(owner)).ok).toBe(false)
    expect(mocks.isolated.auth.updateUser).not.toHaveBeenCalled()
  })
  it.each(["recovery", "callback", "quarantine"])("denies reads and writes during %s isolation", async state => {
    if (state === "recovery") mocks.recovery = true
    if (state === "callback") mocks.callback = true
    if (state === "quarantine") mocks.quarantined = true
    expect((await api.loadAccountAuthMethods(owner)).ok).toBe(false)
    expect((await api.updateAccountPassword({ userId: owner, password: secret })).ok).toBe(false)
    expect((await api.requestAccountPasswordReauthentication(owner)).ok).toBe(false)
    expect(mocks.client.rpc).not.toHaveBeenCalled(); expect(mocks.isolated.auth.updateUser).not.toHaveBeenCalled()
  })
  it("does not admit a recovery AMR token as ordinary account authority", async () => {
    mocks.client.auth.getClaims.mockResolvedValue(claims(sessionId, ["password", "recovery"]))
    expect((await api.updateAccountPassword({ userId: owner, password: secret })).ok).toBe(false)
    expect(mocks.isolated.auth.updateUser).not.toHaveBeenCalled()
  })
  it("keeps server admission denial authoritative for password writes and reauthentication", async () => {
    mocks.client.rpc.mockResolvedValue({ data: null, error: { code: "42501" } })
    expect((await api.updateAccountPassword({ userId: owner, password: secret })).ok).toBe(false)
    expect((await api.requestAccountPasswordReauthentication(owner)).ok).toBe(false)
    expect(mocks.isolated.auth.updateUser).not.toHaveBeenCalled()
    expect(mocks.isolated.auth.reauthenticate).not.toHaveBeenCalled()
    const config = { privacyPolicy: { version: "p" }, termsOfService: { version: "t" } } as AccountConfig
    expect((await api.reacceptAccountTerms(owner, config)).ok).toBe(false)
  })
  it("adds a password to the same social account without signup or requiring a current password", async () => {
    expect(await api.updateAccountPassword({ userId: owner, password: secret, currentPassword: current })).toMatchObject({ ok: true, state: "UPDATED" })
    expect(mocks.isolated.auth.updateUser).toHaveBeenCalledWith({ password: secret })
    expect(mocks.client.auth.signUp).not.toHaveBeenCalled()
    expect(mocks.client.auth.updateUser).not.toHaveBeenCalled()
    expect(mocks.client.auth.reauthenticate).not.toHaveBeenCalled()
    expect(mocks.isolated.auth.dispose).toHaveBeenCalled()
    expect(JSON.stringify({ ...sessionStorage, ...localStorage })).not.toContain(secret)
  })
  it("requires and forwards the current password only for an existing password identity", async () => {
    mocks.client.rpc.mockResolvedValue({ data: { providers: ["email"], hasPassword: true }, error: null })
    expect((await api.updateAccountPassword({ userId: owner, password: secret })).state).toBe("ERROR")
    expect(mocks.isolated.auth.updateUser).not.toHaveBeenCalled()
    expect((await api.updateAccountPassword({ userId: owner, password: secret, currentPassword: current, nonce })).state).toBe("UPDATED")
    expect(mocks.isolated.auth.updateUser).toHaveBeenCalledWith({ password: secret, current_password: current, nonce })
    expect(mocks.client.auth.signUp).not.toHaveBeenCalled()
    expect(mocks.client.auth.updateUser).not.toHaveBeenCalled()
    expect(mocks.client.auth.reauthenticate).not.toHaveBeenCalled()
    expect(mocks.isolated.auth.dispose).toHaveBeenCalled()
    expect(mocks.factory).toHaveBeenCalledWith({ access_token: token, refresh_token: "synthetic-refresh" })
  })
  it("stops before isolated writes if the shared session changes while the factory awaits", async () => {
    mocks.factory.mockImplementation(async () => {
      mocks.client.auth.getClaims.mockResolvedValue(claims(otherSession))
      return mocks.isolated
    })
    expect((await api.updateAccountPassword({ userId: owner, password: secret })).ok).toBe(false)
    expect(mocks.isolated.auth.updateUser).not.toHaveBeenCalled()
    expect(mocks.client.auth.updateUser).not.toHaveBeenCalled()
    expect(mocks.isolated.auth.dispose).toHaveBeenCalledOnce()
  })
  it.each(["reauthentication_needed", "reauthentication_not_valid"])("requires email proof for %s and passes the supplied nonce", async code => {
    mocks.isolated.auth.updateUser.mockResolvedValue({ data: { user: null }, error: { code } })
    expect(await api.updateAccountPassword({ userId: owner, password: secret, nonce })).toMatchObject({ ok: false, state: "REAUTH_REQUIRED" })
    expect(mocks.isolated.auth.updateUser).toHaveBeenCalledWith({ password: secret, nonce })
    expect((await api.requestAccountPasswordReauthentication(owner)).ok).toBe(true)
    expect(mocks.isolated.auth.reauthenticate).toHaveBeenCalledOnce()
    expect(mocks.client.auth.reauthenticate).not.toHaveBeenCalled()
    expect(mocks.isolated.auth.dispose).toHaveBeenCalledTimes(2)
  })
  it("requires fresh login after a confirmed update closes the session", async () => {
    mocks.isolated.auth.updateUser.mockImplementation(async () => {
      mocks.client.auth.getSession.mockResolvedValue({ data: { session: null }, error: null })
      return { data: { user }, error: null }
    })
    expect(await api.updateAccountPassword({ userId: owner, password: secret })).toMatchObject({ ok: true, state: "LOGIN_REQUIRED" })
  })
  it("does not report another owner or replacement session as a successful password update", async () => {
    mocks.isolated.auth.updateUser.mockResolvedValueOnce({ data: { user: { id: "another-owner" } }, error: null })
    expect((await api.updateAccountPassword({ userId: owner, password: secret })).state).toBe("ERROR")
    mocks.isolated.auth.updateUser.mockImplementationOnce(async () => {
      mocks.client.auth.getClaims.mockResolvedValue(claims(otherSession))
      return { data: { user }, error: null }
    })
    expect((await api.updateAccountPassword({ userId: owner, password: secret })).state).toBe("ERROR")
  })
  it("reaccepts current versions for the exact session without sending a birth date", async () => {
    const config = { privacyPolicy: { version: "privacy-current" }, termsOfService: { version: "terms-current" } } as AccountConfig
    mocks.client.rpc.mockResolvedValue({ data: "ADMITTED_EXISTING", error: null })
    expect((await api.reacceptAccountTerms(owner, config)).ok).toBe(true)
    expect(mocks.client.rpc).toHaveBeenCalledWith("reaccept_account_terms", {
      expected_user_id_input: owner, expected_session_id_input: sessionId,
      privacy_policy_version_input: "privacy-current", terms_of_service_version_input: "terms-current",
    })
  })
})
