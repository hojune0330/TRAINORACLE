import { accountConfig } from "./config"
import { createPasswordRecoveryClient } from "./password-recovery-client"
import { supabase } from "./supabase-client"
import type { AuthVerificationResult } from "./auth"
import { authReturnUrl } from "./auth"
import { clearPendingAccountSetupForAttempt, markPendingAccountAuthStarted, markPendingAccountAuthVerified, normalizeAuthEmail, readPendingAccountSetup, isAuthOnlyAccountAttempt } from "./auth-onboarding"
import { authSessionQuarantinePhase, beginAuthSessionQuarantine, clearAuthSessionQuarantine, markAuthSessionExchangeStarted, withAuthSessionQuarantineLock } from "./auth-session-quarantine"

export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 1024
export type PasswordAuthResult = AuthVerificationResult & { readonly state: "ERROR" | "SIGNED_IN" | "EMAIL_CONFIRMATION_REQUIRED" | "PASSWORD_LOGIN_REQUIRED" | "RECOVERY_EMAIL_SENT" | "RECOVERY_READY" | "PASSWORD_UPDATED"; readonly recoveryEmail?: string }
type Client = NonNullable<Awaited<ReturnType<typeof supabase>>>
type Intent = { purpose: "SIGNUP" | "RECOVERY"; nonce: string; email: string; createdAt: number }
type Captured = { intent: Intent; code: string; tokenHash?: never } | { intent: Intent; tokenHash: string; code?: never } | { invalid: true } | { signupFallback: true }
const key = "trainoracle.password.intent.v1", event = "trainoracle:password-auth-state", ttl = 30 * 60 * 1000
const id = /^[a-f0-9]{32}$/u, sessionIdPattern = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/iu
let captured: Captured | null = null, completion: Promise<PasswordAuthResult> | null = null
let recovery: { intent: Intent; userId: string; sessionId: string; accessToken: string; client: Client; isolated: boolean } | null = null
const enabled = () => accountConfig()?.passwordAuthEnabled === true
const failure = (message: string, unsafeSessionOpen = false): PasswordAuthResult => ({ ok: false, state: "ERROR", message, unsafeSessionOpen })
function notify() { if (typeof window !== "undefined") window.dispatchEvent(new Event(event)) }
export function onPasswordAuthStateChange(listener: () => void) { window.addEventListener(event, listener); return () => window.removeEventListener(event, listener) }
export function hasPasswordRecoveryCallback() { return captured !== null }
export function isPasswordRecoveryActive() { return recovery !== null }
function readIntent(): Intent | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) ?? "null")
    if (!value || Object.keys(value).sort().join(",") !== "createdAt,email,nonce,purpose" || !["SIGNUP", "RECOVERY"].includes(value.purpose)
      || typeof value.nonce !== "string" || !id.test(value.nonce) || typeof value.email !== "string" || normalizeAuthEmail(value.email) !== value.email
      || !Number.isFinite(value.createdAt) || value.createdAt > Date.now() || Date.now() - value.createdAt > ttl) return null
    return value as Intent
  } catch { return null }
}
function storeIntent(purpose: Intent["purpose"], email: string, nonce?: string): Intent | null {
  if (recovery || captured) return null
  const value: Intent = { purpose, email, nonce: nonce ?? crypto.randomUUID().replaceAll("-", ""), createdAt: Date.now() }
  try { const raw = JSON.stringify(value); sessionStorage.setItem(key, raw); return sessionStorage.getItem(key) === raw ? value : null } catch { return null }
}
function clearIntent(nonce: string) { try { if (readIntent()?.nonce === nonce) sessionStorage.removeItem(key) } catch { /* no authority from storage failure */ } }
function returnUrl(intent: Intent) {
  const raw = authReturnUrl(); if (!raw) throw new Error("AUTH_RETURN_UNAVAILABLE")
  const url = new URL(raw); url.searchParams.set("password_action", intent.purpose.toLowerCase()); url.searchParams.set("password_flow", intent.nonce); return url.href
}
function validNewPassword(password: string) { return password.length >= PASSWORD_MIN_LENGTH && password.length <= PASSWORD_MAX_LENGTH }
async function close(client: Client, nonce: string): Promise<boolean> {
  try { const result = await client.auth.signOut({ scope: "local" }); return !result.error && clearAuthSessionQuarantine(nonce) } catch { return false }
}
async function ordinarySessionAbsent(): Promise<boolean> {
  try { const client = await supabase({ allowQuarantined: true }); if (!client) return false; const value = await client.auth.getSession(); return !value.error && value.data.session === null } catch { return false }
}
async function closeRecovery(client: Client, nonce: string, isolated: boolean) {
  if (!isolated) return close(client, nonce)
  try { const value = await client.auth.signOut({ scope: "local" }); return !value.error && await ordinarySessionAbsent() && clearAuthSessionQuarantine(nonce) } catch { return false }
}
async function proof(client: Client, token: string, userId: string, email: string, password: boolean, signup = false): Promise<string | null> {
  if (token.length < 32 || token.length > 16384) return null
  const user = await client.auth.getUser(token), claims = await client.auth.getClaims(token)
  if (user.error || user.data.user?.id !== userId || normalizeAuthEmail(user.data.user.email ?? "") !== email || claims.error || !claims.data) return null
  const value = claims.data.claims
  if (!value || value.sub !== userId || typeof value.session_id !== "string" || !sessionIdPattern.test(value.session_id)) return null
  if (password && (!Array.isArray(value.amr) || !value.amr.some(item => item && typeof item === "object" && Reflect.get(item, "method") === "password")
    || value.amr.some(item => item && typeof item === "object" && Reflect.get(item, "method") === "recovery"))) return null
  if (signup && (!user.data.user.email_confirmed_at || !Array.isArray(value.amr) || !value.amr.some(item => item && typeof item === "object" && ["password", "email/signup"].includes(String(Reflect.get(item, "method"))))
    || value.amr.some(item => item && typeof item === "object" && Reflect.get(item, "method") === "recovery"))) return null
  return value.session_id
}
function authorizeAttempt(email: string, attemptId: string, mode: "login" | "signup") {
  const pending = readPendingAccountSetup()
  return pending && isAuthOnlyAccountAttempt(pending) && pending.attemptId === attemptId && pending.method === "password" && pending.entryMode === mode && pending.expectedEmail === email
    && (pending.phase === "AUTH_STARTED" || pending.phase === "PREPARED" && markPendingAccountAuthStarted(attemptId))
}

/** Only the actual password operation's independently verified token can become
 * normal auth proof. No password is persisted or included in a redirect. */
export async function signInWithEmailPassword(email: string, password: string, attemptId: string): Promise<PasswordAuthResult> {
  const normalized = normalizeAuthEmail(email)
  if (!enabled()) return failure("이메일·비밀번호 로그인이 지금은 닫혀 있어요.")
  if (!normalized || !password || password.length > PASSWORD_MAX_LENGTH || !authorizeAttempt(normalized, attemptId, "login")) return failure("이메일과 로그인 정보를 다시 확인해 주세요.")
  const client = await supabase()
  if (!client) return failure("계정 기능을 사용할 수 없어요.")
  if (!beginAuthSessionQuarantine({ attemptId, method: "password" })) return failure("로그인 보호 상태를 먼저 확인해 주세요.", true)
  return withAuthSessionQuarantineLock(async () => {
    if (!markAuthSessionExchangeStarted(attemptId)) return failure("로그인을 안전하게 시작하지 못했어요.", true)
    try {
      const result = await client.auth.signInWithPassword({ email: normalized, password })
      const userId = result.data.user?.id, token = result.data.session?.access_token
      const sessionId = !result.error && userId && token ? await proof(client, token, userId, normalized, true) : null
      if (!userId || !sessionId || !markPendingAccountAuthVerified(attemptId, userId, "password", sessionId)) {
        const closed = await close(client, attemptId); clearPendingAccountSetupForAttempt(attemptId)
        return failure("이메일·비밀번호 또는 이메일 확인 상태를 확인해 주세요.", !closed)
      }
      if (!clearAuthSessionQuarantine(attemptId)) return failure("로그인 보호 상태를 확인하지 못했어요.", !await close(client, attemptId))
      return { ok: true, state: "SIGNED_IN", verifiedUserId: userId, message: "로그인했어요." }
    } catch { const closed = await close(client, attemptId); clearPendingAccountSetupForAttempt(attemptId); return failure("로그인 결과를 확인하지 못했어요. 다시 시도해 주세요.", !closed) }
  })
}

export async function signUpWithEmailPassword(email: string, password: string, attemptId: string): Promise<PasswordAuthResult> {
  const normalized = normalizeAuthEmail(email)
  if (!enabled()) return failure("이메일·비밀번호 가입이 지금은 닫혀 있어요.")
  if (!normalized || !validNewPassword(password) || !authorizeAttempt(normalized, attemptId, "signup")) return failure(`이메일과 ${PASSWORD_MIN_LENGTH}자 이상 비밀번호를 확인해 주세요.`)
  const client = await supabase(), intent = storeIntent("SIGNUP", normalized, attemptId)
  if (!client || !intent) return failure("이 브라우저에서 가입을 안전하게 시작하지 못했어요.")
  if (!beginAuthSessionQuarantine({ attemptId, method: "password" })) return failure("로그인 보호 상태를 먼저 확인해 주세요.", true)
  return withAuthSessionQuarantineLock(async () => {
    if (!markAuthSessionExchangeStarted(attemptId)) return failure("가입을 안전하게 시작하지 못했어요.", true)
    try {
      const result = await client.auth.signUp({ email: normalized, password, options: { emailRedirectTo: returnUrl(intent) } })
      if (result.error) { const closed = await close(client, attemptId); clearIntent(intent.nonce); return failure("가입 요청을 마치지 못했어요. 입력한 정보와 잠시 후 메일함을 확인해 주세요.", !closed) }
      // A null session is the normal email-confirmation path, never enrollment.
      if (!result.data.session) {
        const released = clearAuthSessionQuarantine(attemptId)
        return released ? { ok: true, state: "EMAIL_CONFIRMATION_REQUIRED", message: "확인 메일의 링크를 열어 가입을 이어가세요. 메일이 안 보이면 스팸함도 확인해 주세요." } : failure("이메일 확인을 요청했지만 로그인 보호 상태를 정리하지 못했어요.", true)
      }
      const userId = result.data.user?.id, token = result.data.session.access_token
      const sessionId = userId ? await proof(client, token, userId, normalized, false, true) : null
      if (userId && sessionId && markPendingAccountAuthVerified(attemptId, userId, "password", sessionId) && clearAuthSessionQuarantine(attemptId)) {
        clearIntent(intent.nonce); return { ok: true, state: "SIGNED_IN", verifiedUserId: userId, message: "이메일 확인과 로그인을 마쳤어요." }
      }
      const closed = await close(client, attemptId); clearIntent(intent.nonce); clearPendingAccountSetupForAttempt(attemptId)
      return closed ? { ok: true, state: "PASSWORD_LOGIN_REQUIRED", message: "계정 요청을 마쳤어요. 비밀번호로 로그인해 주세요." } : failure("로그인 보호 상태를 정리하지 못했어요.", true)
    } catch { const closed = await close(client, attemptId); return failure("가입 결과를 확인하지 못했어요. 메일함을 확인한 뒤 다시 진행해 주세요.", !closed) }
  })
}

export async function resendPasswordSignupEmail(email: string): Promise<PasswordAuthResult> {
  const normalized = normalizeAuthEmail(email), intent = readIntent()
  if (!enabled() || !normalized || !intent || intent.email !== normalized || intent.purpose !== "SIGNUP" || captured || recovery) return failure("같은 이메일로 가입을 다시 시작해 주세요.")
  try { const client = await supabase(); if (!client) return failure("계정 기능을 사용할 수 없어요."); const result = await client.auth.resend({ type: "signup", email: normalized, options: { emailRedirectTo: returnUrl(intent) } }); return result.error ? failure("확인 메일을 다시 보내지 못했어요. 잠시 후 시도해 주세요.") : { ok: true, state: "EMAIL_CONFIRMATION_REQUIRED", message: "확인 메일을 요청했어요. 메일함과 스팸함을 확인해 주세요." } } catch { return failure("확인 메일 요청 결과를 확인하지 못했어요.") }
}
export async function requestPasswordRecovery(email: string): Promise<PasswordAuthResult> {
  const normalized = normalizeAuthEmail(email)
  if (!enabled() || !normalized) return failure("이메일 주소와 연결 가능 상태를 확인해 주세요.")
  const client = await supabase(), intent = storeIntent("RECOVERY", normalized)
  if (!client || !intent) return failure("앞서 시작한 비밀번호 변경을 먼저 마쳐 주세요.")
  try { const result = await client.auth.resetPasswordForEmail(normalized, { redirectTo: returnUrl(intent) }); if (result.error) return failure("비밀번호 변경 메일을 보내지 못했어요. 잠시 후 시도해 주세요."); return { ok: true, state: "RECOVERY_EMAIL_SENT", message: "가입한 주소라면 비밀번호 변경 메일을 받을 수 있어요. 이 브라우저에서 링크를 열어 주세요." } } catch { return failure("메일 요청 결과를 확인하지 못했어요. 메일함을 확인해 주세요.") }
}

/** Called before any generic OAuth/email capture or SDK initialization. */
export function capturePasswordAuthCallbackFromUrl(input?: { href?: string; replaceState?: (url: string) => void }): boolean {
  const url = new URL(input?.href ?? window.location.href)
  if (!url.searchParams.has("password_action") && !url.searchParams.has("password_flow")) return false
  const query = new URLSearchParams(url.search), hash = new URLSearchParams(url.hash.slice(1)), intent = readIntent(), codes = query.getAll("code")
  const allowed = ["account", "password_action", "password_flow", "code"]
  const valid = [...query.keys()].every(name => allowed.includes(name)) && new Set(query.keys()).size === [...query.keys()].length && !url.hash
    && query.get("account") === "1" && intent && query.get("password_flow") === intent.nonce && query.get("password_action") === intent.purpose.toLowerCase()
    && codes.length === 1 && /^[A-Za-z0-9._~-]{16,2048}$/u.test(codes[0]!)
  const tokenRecovery = query.get("account") === "1" && query.get("password_action") === "recovery" && new Set(query.keys()).size === [...query.keys()].length
    && [...query.keys()].every(name => ["account", "password_action", "password_flow"].includes(name)) && (!query.has("password_flow") || id.test(query.get("password_flow") ?? ""))
    && [...hash.keys()].length === 2 && hash.getAll("token_hash").length === 1 && hash.getAll("type").length === 1 && hash.get("type") === "recovery" && /^[A-Za-z0-9_-]{32,512}$/u.test(hash.get("token_hash") ?? "")
  const tokenHash = hash.get("token_hash")
  const signupFallback = !intent && query.get("account") === "1" && query.get("password_action") === "signup" && new Set(query.keys()).size === [...query.keys()].length
    && [...query.keys()].every(name => allowed.includes(name)) && !url.hash && id.test(query.get("password_flow") ?? "") && codes.length === 1 && /^[A-Za-z0-9._~-]{16,2048}$/u.test(codes[0]!)
  for (const name of ["code", "token_hash", "type", "password_flow", "password_action", "error", "error_code", "error_description"]) url.searchParams.delete(name)
  for (const name of ["access_token", "refresh_token", "provider_token", "provider_refresh_token", "token_hash", "type", "expires_at", "expires_in", "token_type"]) hash.delete(name)
  url.hash = hash.toString()
  if (input?.replaceState) input.replaceState(url.href); else window.history.replaceState(window.history.state, "", url.href)
  if (tokenRecovery && tokenHash) {
    const isolatedIntent: Intent = { purpose: "RECOVERY", email: "", nonce: crypto.randomUUID().replaceAll("-", ""), createdAt: Date.now() }
    captured = beginAuthSessionQuarantine({ attemptId: isolatedIntent.nonce, method: "password" }) ? { intent: isolatedIntent, tokenHash } : { invalid: true }
  } else captured = valid && intent && beginAuthSessionQuarantine({ attemptId: intent.nonce, method: "password" }) ? { intent, code: codes[0]! } : signupFallback ? { signupFallback: true } : { invalid: true }
  completion = null; notify(); return true
}

export function completePasswordAuthCallback(): Promise<PasswordAuthResult> {
  if (completion) return completion
  if (!captured) return Promise.resolve(failure("비밀번호 확인 링크가 없어요."))
  const pending = captured
  completion = withAuthSessionQuarantineLock(async () => {
    if ("signupFallback" in pending) { captured = null; notify(); return { ok: true, state: "PASSWORD_LOGIN_REQUIRED", message: "이메일 확인을 진행했다면 가입한 이메일과 비밀번호로 로그인해 주세요. 로그인할 때 확인 상태를 다시 확인해요." } }
    if ("invalid" in pending || !enabled() || !pending.tokenHash && readIntent()?.nonce !== pending.intent.nonce) { captured = null; notify(); return failure("링크가 만료됐거나 이 브라우저에서 시작한 요청이 아니에요. 다시 요청해 주세요.", authSessionQuarantinePhase() !== null) }
    const { intent } = pending, isolated = !!pending.tokenHash
    if (isolated && !await ordinarySessionAbsent()) return failure("이 브라우저의 기존 계정을 먼저 로그아웃한 뒤 변경 메일을 다시 열어 주세요.", true)
    const client = isolated ? await createPasswordRecoveryClient() : await supabase({ allowQuarantined: true })
    if (!client || !markAuthSessionExchangeStarted(intent.nonce)) return failure("인증 보호 상태를 확인하지 못했어요.", true)
    try {
      const result = pending.tokenHash ? await client.auth.verifyOtp({ token_hash: pending.tokenHash, type: "recovery" }) : await client.auth.exchangeCodeForSession(pending.code!)
      const userId = result.data.user?.id, token = result.data.session?.access_token, verifiedEmail = isolated ? normalizeAuthEmail(result.data.user?.email ?? "") : intent.email
      const sessionId = !result.error && userId && token && verifiedEmail ? await proof(client, token, userId, verifiedEmail, false, intent.purpose === "SIGNUP") : null
      if (!sessionId || !userId || !token || !verifiedEmail || !isolated && intent.purpose === "RECOVERY" && (!("redirectType" in result.data) || result.data.redirectType !== "recovery")) {
        const closed = await closeRecovery(client, intent.nonce, isolated); captured = null; clearIntent(intent.nonce); notify(); return failure("확인 링크가 만료됐거나 다른 요청이에요. 다시 요청해 주세요.", !closed)
      }
      captured = null
      if (intent.purpose === "RECOVERY") { recovery = { intent: { ...intent, email: verifiedEmail }, userId, accessToken: token, sessionId, client, isolated }; notify(); return { ok: true, state: "RECOVERY_READY", recoveryEmail: verifiedEmail, message: "새 비밀번호를 입력해 주세요." } }
      if (markPendingAccountAuthVerified(intent.nonce, userId, "password", sessionId) && clearAuthSessionQuarantine(intent.nonce)) { clearIntent(intent.nonce); notify(); return { ok: true, state: "SIGNED_IN", verifiedUserId: userId, message: "이메일 확인과 로그인을 마쳤어요." } }
      const closed = await close(client, intent.nonce); clearIntent(intent.nonce); clearPendingAccountSetupForAttempt(intent.nonce); notify()
      return closed ? { ok: true, state: "PASSWORD_LOGIN_REQUIRED", message: "이메일 확인을 마쳤어요. 비밀번호로 로그인해 주세요." } : failure("이메일을 확인했지만 로그인 보호 상태를 정리하지 못했어요.", true)
    } catch { const closed = await closeRecovery(client, intent.nonce, isolated); captured = null; notify(); return failure("확인 결과를 받지 못했어요. 링크를 다시 요청해 주세요.", !closed) }
  })
  return completion
}

export async function updateRecoveredPassword(password: string): Promise<PasswordAuthResult> {
  const held = recovery
  if (!enabled() || !held || !validNewPassword(password)) return failure(`새 비밀번호를 ${PASSWORD_MIN_LENGTH}자 이상 입력해 주세요.`)
  return withAuthSessionQuarantineLock(async () => {
    if (recovery !== held || Date.now() - held.intent.createdAt > ttl || !held.isolated && readIntent()?.nonce !== held.intent.nonce) return failure("비밀번호 변경이 만료됐어요. 다시 요청해 주세요.")
    if (held.isolated && !await ordinarySessionAbsent()) return failure("이 브라우저의 로그인 계정이 바뀌었어요. 먼저 로그아웃해 주세요.", true)
    const client = held.client
    try {
      const ambient = await client.auth.getSession()
      const currentToken = ambient.data.session?.access_token
      if (ambient.error || !currentToken || await proof(client, currentToken, held.userId, held.intent.email, false) !== held.sessionId) return failure("비밀번호 변경 계정이 바뀌었어요. 변경을 취소하고 다시 요청해 주세요.", true)
      const updated = await client.auth.updateUser({ password })
      if (updated.error || updated.data.user?.id !== held.userId) return failure("비밀번호를 바꾸지 못했어요. 새 비밀번호를 확인해 주세요.")
      const closed = await closeRecovery(client, held.intent.nonce, held.isolated)
      if (!closed) return failure("비밀번호를 바꿨지만 변경 세션을 끝내지 못했어요. 먼저 로그아웃해 주세요.", true)
      recovery = null; clearIntent(held.intent.nonce); completion = null; notify()
      return { ok: true, state: "PASSWORD_UPDATED", message: "비밀번호를 바꿨어요. 새 비밀번호로 다시 로그인해 주세요." }
    } catch { return failure("비밀번호 변경 결과를 확인하지 못했어요. 변경 세션을 종료한 뒤 다시 로그인해 주세요.") }
  })
}
export async function cancelPasswordRecovery(): Promise<PasswordAuthResult> {
  const held = recovery, intent = held?.intent ?? (captured && "intent" in captured ? captured.intent : readIntent())
  return withAuthSessionQuarantineLock(async () => {
    if (!intent && authSessionQuarantinePhase() !== null) return failure("인증 보호 상태를 확인하지 못했어요. 먼저 로그아웃해 주세요.", true)
    if (!held && captured && "tokenHash" in captured && intent && authSessionQuarantinePhase() === "PRE_EXCHANGE") {
      // This isolated request never installed any session. Cancel only its own
      // pre-exchange marker; do not sign out an unrelated ordinary account.
      if (!clearAuthSessionQuarantine(intent.nonce)) return failure("인증 보호 상태를 정리하지 못했어요.", true)
      captured = null; completion = null; notify(); return { ok: true, state: "PASSWORD_LOGIN_REQUIRED", message: "비밀번호 변경 화면을 닫았어요." }
    }
    const client = held?.client ?? await supabase({ allowQuarantined: true })
    if (intent && (!client || !await closeRecovery(client, intent.nonce, held?.isolated ?? false))) return failure("변경 세션을 끝내지 못했어요. 다시 로그아웃해 주세요.", true)
    recovery = null; captured = null; completion = null; if (intent) clearIntent(intent.nonce); notify()
    return { ok: true, state: "PASSWORD_LOGIN_REQUIRED", message: intent ? "비밀번호 변경을 종료했어요. 다시 로그인해 주세요." : "비밀번호 변경 화면을 닫았어요." }
  })
}
