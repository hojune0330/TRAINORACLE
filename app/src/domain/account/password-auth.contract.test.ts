import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ enabled: true, client: { auth: { signUp: vi.fn(), signInWithPassword: vi.fn(), resetPasswordForEmail: vi.fn(), resend: vi.fn(), exchangeCodeForSession: vi.fn(), getUser: vi.fn(), getClaims: vi.fn(), getSession: vi.fn(), updateUser: vi.fn(), signOut: vi.fn() } }, isolated: { auth: { verifyOtp: vi.fn(), getUser: vi.fn(), getClaims: vi.fn(), getSession: vi.fn(), updateUser: vi.fn(), signOut: vi.fn() } } }))
vi.mock("./config", () => ({ accountConfig: () => ({ passwordAuthEnabled: mocks.enabled }) }))
vi.mock("./supabase-client", () => ({ supabase: async () => mocks.client }))
vi.mock("./password-recovery-client", () => ({ createPasswordRecoveryClient: async () => mocks.isolated }))
const owner = "11111111-1111-4111-8111-111111111111", sessionId = "22222222-2222-4222-8222-222222222222", email = "runner@example.com", secret = "unique-secret-not-for-storage", token = "synthetic-password-access-token-123456789", code = "synthetic-pkce-code-123456789", attemptId = "a".repeat(32)
let api: typeof import("./password-auth"), onboarding: typeof import("./auth-onboarding"), guard: typeof import("./auth-session-quarantine")
const user = { id: owner, email, email_confirmed_at: "2026-11-14T00:00:00Z" }, session = { access_token: token, user }
beforeEach(async () => {
  vi.resetModules(); vi.clearAllMocks(); mocks.enabled = true; sessionStorage.clear(); localStorage.clear()
  window.history.replaceState({}, "", "/?account=1")
  Object.defineProperty(navigator, "locks", { configurable: true, value: { request: async (_name: string, _options: unknown, run: () => Promise<unknown>) => run() } })
  api = await import("./password-auth"); onboarding = await import("./auth-onboarding"); guard = await import("./auth-session-quarantine")
  mocks.client.auth.signInWithPassword.mockResolvedValue({ data: { user, session }, error: null })
  mocks.client.auth.signUp.mockResolvedValue({ data: { user, session: null }, error: null })
  mocks.client.auth.resend.mockResolvedValue({ error: null }); mocks.client.auth.resetPasswordForEmail.mockResolvedValue({ error: null })
  mocks.client.auth.getUser.mockResolvedValue({ data: { user }, error: null })
  mocks.client.auth.getClaims.mockResolvedValue({ data: { claims: { sub: owner, session_id: sessionId, amr: [{ method: "password" }] } }, error: null })
  mocks.client.auth.getSession.mockResolvedValue({ data: { session }, error: null })
  mocks.client.auth.exchangeCodeForSession.mockResolvedValue({ data: { user, session, redirectType: "recovery" }, error: null })
  mocks.client.auth.updateUser.mockResolvedValue({ data: { user }, error: null }); mocks.client.auth.signOut.mockResolvedValue({ error: null })
  mocks.isolated.auth.verifyOtp.mockResolvedValue({ data: { user, session }, error: null }); mocks.isolated.auth.getUser.mockResolvedValue({ data: { user }, error: null })
  mocks.isolated.auth.getClaims.mockResolvedValue({ data: { claims: { sub: owner, session_id: sessionId, amr: [{ method: "recovery" }] } }, error: null }); mocks.isolated.auth.getSession.mockResolvedValue({ data: { session }, error: null })
  mocks.isolated.auth.updateUser.mockResolvedValue({ data: { user }, error: null }); mocks.isolated.auth.signOut.mockResolvedValue({ error: null })
})
afterEach(() => { onboarding.clearPendingAccountSetup(); sessionStorage.clear(); localStorage.clear() })
function prepare(mode: "login" | "signup") { onboarding.writePendingAccountSetup(onboarding.createPendingAccountAuthAttempt({ method: "password", expectedEmail: email, entryMode: mode, attemptId })) }
async function recover() {
  expect((await api.requestPasswordRecovery(email)).state).toBe("RECOVERY_EMAIL_SENT")
  const redirect = new URL(mocks.client.auth.resetPasswordForEmail.mock.calls.at(-1)![1].redirectTo); redirect.searchParams.set("code", code)
  let safe = ""; expect(api.capturePasswordAuthCallbackFromUrl({ href: redirect.href, replaceState: value => { safe = value } })).toBe(true)
  expect(safe).not.toContain(code); expect(safe).not.toContain("password_flow"); expect(guard.isAuthSessionQuarantined()).toBe(true)
  return api.completePasswordAuthCallback()
}
describe("explicit email and password authentication", () => {
  it("binds only the actual password token's owner/email/session and stores no password", async () => {
    prepare("login")
    mocks.client.auth.signInWithPassword.mockImplementationOnce(async () => { expect(guard.isAuthSessionQuarantined()).toBe(true); return { data: { user, session }, error: null } })
    expect(await api.signInWithEmailPassword(email, secret, attemptId)).toMatchObject({ ok: true, state: "SIGNED_IN", verifiedUserId: owner })
    expect(mocks.client.auth.getUser).toHaveBeenCalledWith(token); expect(mocks.client.auth.getClaims).toHaveBeenCalledWith(token)
    expect(onboarding.readPendingAccountSetup()).toMatchObject({ phase: "AUTH_VERIFIED", method: "password", verifiedSessionId: sessionId })
    expect(JSON.stringify({ ...sessionStorage, ...localStorage })).not.toContain(secret); expect(guard.isAuthSessionQuarantined()).toBe(false)
  })
  it("rejects a different independently verified user and keeps failed cleanup quarantined", async () => {
    prepare("login"); mocks.client.auth.getUser.mockResolvedValueOnce({ data: { user: { id: "another-owner", email } }, error: null }); mocks.client.auth.signOut.mockResolvedValueOnce({ error: new Error("not confirmed") })
    expect(await api.signInWithEmailPassword(email, secret, attemptId)).toMatchObject({ ok: false, unsafeSessionOpen: true })
    expect(guard.isAuthSessionQuarantined()).toBe(true); expect(onboarding.readPendingAccountSetup()).toBeNull()
  })
  it("does not promote recovery or OTP tokens to password login", async () => {
    prepare("login"); mocks.client.auth.getClaims.mockResolvedValueOnce({ data: { claims: { sub: owner, session_id: sessionId, amr: [{ method: "password" }, { method: "recovery" }] } }, error: null })
    expect((await api.signInWithEmailPassword(email, secret, attemptId)).ok).toBe(false); expect(mocks.client.auth.signOut).toHaveBeenCalledOnce()
  })
  it("does not call authentication behind an unapproved operational flag", async () => {
    mocks.enabled = false; prepare("login"); expect((await api.signInWithEmailPassword(email, secret, attemptId)).ok).toBe(false); expect(mocks.client.auth.signInWithPassword).not.toHaveBeenCalled()
  })
  it("keeps signup with a null session pending email confirmation", async () => {
    prepare("signup"); expect(await api.signUpWithEmailPassword(email, secret, attemptId)).toMatchObject({ ok: true, state: "EMAIL_CONFIRMATION_REQUIRED" })
    expect(onboarding.readPendingAccountSetup()?.phase).toBe("AUTH_STARTED"); expect(guard.isAuthSessionQuarantined()).toBe(false)
    expect(JSON.stringify({ ...sessionStorage, ...localStorage })).not.toContain(secret)
    const payload = mocks.client.auth.signUp.mock.calls[0]![0]; expect(payload.password).toBe(secret); expect(payload.options.emailRedirectTo).not.toContain(secret)
  })
  it("continues an independently confirmed immediate signup without an extra password login", async () => {
    prepare("signup"); mocks.client.auth.signUp.mockResolvedValueOnce({ data: { user, session }, error: null })
    expect(await api.signUpWithEmailPassword(email, secret, attemptId)).toMatchObject({ state: "SIGNED_IN", verifiedUserId: owner })
    expect(mocks.client.auth.signOut).not.toHaveBeenCalled(); expect(onboarding.readPendingAccountSetup()).toMatchObject({ phase: "AUTH_VERIFIED", verifiedMethod: "password" })
  })
  it("resends signup mail only for the exact pending email without retaining the password", async () => {
    prepare("signup"); await api.signUpWithEmailPassword(email, secret, attemptId)
    expect((await api.resendPasswordSignupEmail("other@example.com")).ok).toBe(false); expect(mocks.client.auth.resend).not.toHaveBeenCalled()
    expect((await api.resendPasswordSignupEmail(email)).state).toBe("EMAIL_CONFIRMATION_REQUIRED")
    expect(mocks.client.auth.resend.mock.calls[0]![0]).toMatchObject({ type: "signup", email })
  })
  it("scrubs signup confirmation then uses confirmed signup AMR and exact intent without another login", async () => {
    prepare("signup"); await api.signUpWithEmailPassword(email, secret, attemptId)
    const redirect = new URL(mocks.client.auth.signUp.mock.calls[0]![0].options.emailRedirectTo); redirect.searchParams.set("code", code)
    mocks.client.auth.exchangeCodeForSession.mockResolvedValueOnce({ data: { user, session, redirectType: null }, error: null })
    mocks.client.auth.getClaims.mockResolvedValueOnce({ data: { claims: { sub: owner, session_id: sessionId, amr: [{ method: "email/signup" }] } }, error: null })
    expect(api.capturePasswordAuthCallbackFromUrl({ href: redirect.href, replaceState: value => expect(value).not.toContain(code) })).toBe(true)
    expect(await api.completePasswordAuthCallback()).toMatchObject({ state: "SIGNED_IN", verifiedUserId: owner }); expect(guard.isAuthSessionQuarantined()).toBe(false); expect(api.isPasswordRecoveryActive()).toBe(false); expect(mocks.client.auth.signOut).not.toHaveBeenCalled()
  })
})
describe("password recovery has no ordinary account authority", () => {
  it("lets a signup link in another browser continue to password login without claiming email confirmation", async () => {
    const href = `https://trainoracle.example/?account=1&password_action=signup&password_flow=${attemptId}&code=${code}`
    api.capturePasswordAuthCallbackFromUrl({ href, replaceState: vi.fn() })
    const value = await api.completePasswordAuthCallback(); expect(value.state).toBe("PASSWORD_LOGIN_REQUIRED"); expect(value.message).not.toContain("확인을 마쳤"); expect(mocks.client.auth.exchangeCodeForSession).not.toHaveBeenCalled()
  })
  it("does not promote an unconfirmed signup or a recovery AMR through a signup intent", async () => {
    prepare("signup"); await api.signUpWithEmailPassword(email, secret, attemptId)
    const redirect = new URL(mocks.client.auth.signUp.mock.calls[0]![0].options.emailRedirectTo); redirect.searchParams.set("code", code)
    mocks.client.auth.getUser.mockResolvedValueOnce({ data: { user: { ...user, email_confirmed_at: null } }, error: null })
    api.capturePasswordAuthCallbackFromUrl({ href: redirect.href, replaceState: vi.fn() }); expect((await api.completePasswordAuthCallback()).ok).toBe(false); expect(mocks.client.auth.signOut).toHaveBeenCalledOnce()
  })
  it("accepts a Mail to Safari recovery TokenHash only into an independent memory session", async () => {
    mocks.client.auth.getSession.mockResolvedValue({ data: { session: null }, error: null })
    let safe = ""; const hash = "f".repeat(64)
    expect(api.capturePasswordAuthCallbackFromUrl({ href: `https://trainoracle.example/?account=1&password_action=recovery#token_hash=${hash}&type=recovery`, replaceState: value => { safe = value } })).toBe(true)
    expect(safe).not.toContain(hash); expect(mocks.isolated.auth.verifyOtp).not.toHaveBeenCalled()
    expect(await api.completePasswordAuthCallback()).toMatchObject({ state: "RECOVERY_READY", recoveryEmail: email }); expect(mocks.isolated.auth.verifyOtp).toHaveBeenCalledWith({ token_hash: hash, type: "recovery" })
    expect(mocks.client.auth.exchangeCodeForSession).not.toHaveBeenCalled(); expect(guard.isAuthSessionQuarantined()).toBe(true)
    expect((await api.updateRecoveredPassword(secret)).state).toBe("PASSWORD_UPDATED"); expect(mocks.isolated.auth.updateUser).toHaveBeenCalledWith({ password: secret }); expect(mocks.isolated.auth.signOut).toHaveBeenCalledOnce(); expect(mocks.client.auth.signOut).not.toHaveBeenCalled(); expect(onboarding.readPendingAccountSetup()).toBeNull()
  })
  it("does not replace or sign out a different ordinary Safari account to recover another account", async () => {
    api.capturePasswordAuthCallbackFromUrl({ href: `https://trainoracle.example/?account=1&password_action=recovery#token_hash=${"e".repeat(64)}&type=recovery`, replaceState: vi.fn() })
    expect(await api.completePasswordAuthCallback()).toMatchObject({ ok: false, unsafeSessionOpen: true }); expect(mocks.isolated.auth.verifyOtp).not.toHaveBeenCalled(); expect(mocks.client.auth.signOut).not.toHaveBeenCalled()
    expect((await api.cancelPasswordRecovery()).state).toBe("PASSWORD_LOGIN_REQUIRED"); expect(mocks.client.auth.signOut).not.toHaveBeenCalled(); expect(guard.isAuthSessionQuarantined()).toBe(false)
  })
  it.each(["?account=1&password_action=recovery&token_hash=" + "e".repeat(64) + "&type=recovery", "?account=1&password_action=recovery#token_hash=" + "e".repeat(64) + "&type=signup"])("scrubs and rejects non-fragment or wrong-type recovery %s", async suffix => {
    let safe = ""; api.capturePasswordAuthCallbackFromUrl({ href: "https://trainoracle.example/" + suffix, replaceState: value => { safe = value } }); expect(safe).not.toContain("e".repeat(64)); expect((await api.completePasswordAuthCallback()).ok).toBe(false); expect(mocks.isolated.auth.verifyOtp).not.toHaveBeenCalled()
  })
  it("does not claim an unknown quarantined session was closed without its exact intent", async () => {
    expect(guard.beginAuthSessionQuarantine({ attemptId: "b".repeat(32), method: "email" })).toBe(true)
    expect(await api.cancelPasswordRecovery()).toMatchObject({ ok: false, unsafeSessionOpen: true }); expect(guard.isAuthSessionQuarantined()).toBe(true); expect(mocks.client.auth.signOut).not.toHaveBeenCalled()
  })
  it("holds the exact PKCE recovery result, updates, signs out, then requires fresh login", async () => {
    expect((await recover()).state).toBe("RECOVERY_READY"); expect(guard.isAuthSessionQuarantined()).toBe(true)
    mocks.client.auth.updateUser.mockImplementationOnce(async () => { expect(guard.isAuthSessionQuarantined()).toBe(true); return { data: { user }, error: null } })
    expect((await api.updateRecoveredPassword(secret)).state).toBe("PASSWORD_UPDATED")
    expect(mocks.client.auth.signOut).toHaveBeenCalledWith({ scope: "local" }); expect(guard.isAuthSessionQuarantined()).toBe(false); expect(api.isPasswordRecoveryActive()).toBe(false)
    expect(onboarding.readPendingAccountSetup()).toBeNull(); expect(JSON.stringify({ ...sessionStorage, ...localStorage })).not.toContain(secret)
  })
  it("deduplicates callback exchange including repeated effect completion", async () => {
    await recover(); await Promise.all([api.completePasswordAuthCallback(), api.completePasswordAuthCallback()]); expect(mocks.client.auth.exchangeCodeForSession).toHaveBeenCalledOnce()
  })
  it("does not accept another PKCE flow as recovery even with a valid owner", async () => {
    mocks.client.auth.exchangeCodeForSession.mockResolvedValueOnce({ data: { user, session, redirectType: null }, error: null })
    expect((await recover()).ok).toBe(false); expect(api.isPasswordRecoveryActive()).toBe(false); expect(mocks.client.auth.signOut).toHaveBeenCalledOnce()
  })
  it("leaves failed password update quarantined and supports an explicit session-ending cancel", async () => {
    await recover(); mocks.client.auth.updateUser.mockResolvedValueOnce({ data: { user: null }, error: new Error("denied") })
    expect((await api.updateRecoveredPassword(secret)).ok).toBe(false); expect(guard.isAuthSessionQuarantined()).toBe(true)
    expect((await api.cancelPasswordRecovery()).state).toBe("PASSWORD_LOGIN_REQUIRED"); expect(guard.isAuthSessionQuarantined()).toBe(false)
  })
  it("blocks a changed ambient session before changing any password", async () => {
    await recover(); mocks.client.auth.getSession.mockResolvedValueOnce({ data: { session: { ...session, access_token: "another-verified-session-token-12345678" } }, error: null }); mocks.client.auth.getClaims.mockResolvedValueOnce({ data: { claims: { sub: owner, session_id: "33333333-3333-4333-8333-333333333333", amr: [{ method: "recovery" }] } }, error: null })
    expect((await api.updateRecoveredPassword(secret)).ok).toBe(false); expect(mocks.client.auth.updateUser).not.toHaveBeenCalled(); expect(guard.isAuthSessionQuarantined()).toBe(true)
  })
  it("accepts a refreshed recovery bearer only after proving the same owner and signed session", async () => {
    await recover(); mocks.client.auth.getSession.mockResolvedValueOnce({ data: { session: { ...session, access_token: "refreshed-same-session-token-123456789" } }, error: null })
    expect((await api.updateRecoveredPassword(secret)).state).toBe("PASSWORD_UPDATED"); expect(mocks.client.auth.getUser).toHaveBeenLastCalledWith("refreshed-same-session-token-123456789")
  })
  it("does not claim password reset finished if the recovery session could not be closed", async () => {
    await recover(); mocks.client.auth.signOut.mockResolvedValueOnce({ error: new Error("not confirmed") })
    expect(await api.updateRecoveredPassword(secret)).toMatchObject({ ok: false, unsafeSessionOpen: true }); expect(api.isPasswordRecoveryActive()).toBe(true); expect(guard.isAuthSessionQuarantined()).toBe(true)
  })
  it("scrubs but rejects duplicate, wrong-intent, or legacy token callbacks before any exchange", async () => {
    await api.requestPasswordRecovery(email)
    const redirect = new URL(mocks.client.auth.resetPasswordForEmail.mock.calls[0]![1].redirectTo); redirect.searchParams.set("code", code); redirect.searchParams.append("code", "second-code")
    let safe = ""; api.capturePasswordAuthCallbackFromUrl({ href: redirect.href, replaceState: value => { safe = value } })
    expect(safe).not.toContain(code); expect((await api.completePasswordAuthCallback()).ok).toBe(false); expect(mocks.client.auth.exchangeCodeForSession).not.toHaveBeenCalled()
  })
})
