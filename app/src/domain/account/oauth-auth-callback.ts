import { accountConfig } from "./config"
import {
  clearPendingAccountSetupForAttempt,
  isAuthAttemptId,
  markPendingAccountAuthVerified,
  readPendingAccountSetup,
} from "./auth-onboarding"
import type { SocialAuthProvider } from "./auth"
import { supabase } from "./supabase-client"
import {
  beginAuthSessionQuarantine,
  clearAuthSessionQuarantine,
  markAuthSessionExchangeStarted,
  withAuthSessionQuarantineLock,
} from "./auth-session-quarantine"
import { verifyReturnedAuthSession } from "./verified-auth-session"

type CapturedOAuthCallback =
  | { readonly kind: "VALID"; readonly code: string; readonly attemptId: string }
  | { readonly kind: "BLOCKED"; readonly attemptId: string }
  | { readonly kind: "INVALID"; readonly attemptId: string | null; readonly legacy: boolean }

export type OAuthCallbackResult =
  | { readonly handled: false }
  | {
      readonly handled: true
      readonly ok: boolean
      readonly message: string
      readonly verifiedUserId?: string
      readonly pendingBound?: boolean
      /** 코드 교환 뒤 local sign-out도 실패해 계정 UI를 막아야 한다. */
      readonly unsafeSessionOpen?: boolean
    }

const OAUTH_CODE_PATTERN = /^[A-Za-z0-9._~-]{16,2048}$/u
const QUERY_CREDENTIAL_KEYS = ["code", "error", "error_code", "error_description"] as const
const LEGACY_FRAGMENT_KEYS = [
  "access_token",
  "refresh_token",
  "provider_token",
  "provider_refresh_token",
  "expires_at",
  "expires_in",
  "token_type",
] as const

let capturedOAuthCallback: CapturedOAuthCallback | null = null
let callbackCompletion: Promise<OAuthCallbackResult> | null = null

type AuthClient = NonNullable<Awaited<ReturnType<typeof supabase>>>

function clearAttemptSafely(attemptId: string): void {
  try {
    clearPendingAccountSetupForAttempt(attemptId)
  } catch {
    // 저장소 차단은 인증 실패를 성공으로 바꾸지 않는다.
  }
}

async function closePotentialLocalSession(client: AuthClient): Promise<boolean> {
  try {
    const { error } = await client.auth.signOut({ scope: "local" })
    return !error
  } catch {
    return false
  }
}

async function closeSessionAndReleaseQuarantine(client: AuthClient, attemptId: string): Promise<boolean> {
  const closed = await closePotentialLocalSession(client)
  return closed && clearAuthSessionQuarantine(attemptId)
}

function fragmentParams(url: URL): URLSearchParams {
  return new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : url.hash)
}

function scrubOAuthCredentials(url: URL, replaceState?: (url: string) => void): void {
  for (const key of QUERY_CREDENTIAL_KEYS) url.searchParams.delete(key)
  const hash = fragmentParams(url)
  for (const key of LEGACY_FRAGMENT_KEYS) hash.delete(key)
  hash.delete("type")
  url.hash = hash.toString() === "" ? "" : `#${hash.toString()}`
  const safeUrl = url.toString()
  if (replaceState !== undefined) replaceState(safeUrl)
  else if (typeof window !== "undefined" && typeof window.history?.replaceState === "function") {
    window.history.replaceState(window.history.state, "", safeUrl)
  }
}

/** Capture and scrub PKCE/legacy OAuth credentials before the auth client starts. */
export function captureOAuthAuthCallbackFromUrl(input?: {
  readonly href?: string
  readonly replaceState?: (url: string) => void
}): boolean {
  const href = input?.href ?? (typeof window !== "undefined" ? window.location.href : undefined)
  if (href === undefined) return false
  const url = new URL(href)
  const hash = fragmentParams(url)
  const legacy = LEGACY_FRAGMENT_KEYS.some(key => hash.has(key))
  const accountMarkers = url.searchParams.getAll("account")
  const flows = url.searchParams.getAll("account_flow")
  const codes = url.searchParams.getAll("code")
  const hasOAuthError = url.searchParams.has("error")
    || url.searchParams.has("error_code")
    || url.searchParams.has("error_description")
  if (!legacy && !((accountMarkers.length > 0 || flows.length > 0) && (codes.length > 0 || hasOAuthError))) return false

  const attemptId = flows.length === 1 && isAuthAttemptId(flows[0]) ? flows[0] : null
  const code = codes[0] ?? ""
  scrubOAuthCredentials(url, input?.replaceState)

  const valid = !legacy
    && accountMarkers.length === 1
    && accountMarkers[0] === "1"
    && flows.length === 1
    && attemptId !== null
    && codes.length === 1
    && !hasOAuthError
    && OAUTH_CODE_PATTERN.test(code)
  const pending = valid ? readPendingAccountSetup() : null
  const method = pending?.attemptId === attemptId
    && (pending.method === "kakao" || pending.method === "google")
    ? pending.method
    : null
  capturedOAuthCallback = valid && method !== null
    ? beginAuthSessionQuarantine({ attemptId, method })
      ? { kind: "VALID", code, attemptId }
      : { kind: "BLOCKED", attemptId }
    : { kind: "INVALID", attemptId, legacy }
  callbackCompletion = null
  return true
}

function methodEnabled(method: SocialAuthProvider): boolean {
  const config = accountConfig()
  if (config === null) return false
  return method === "kakao" ? config.kakaoAuthEnabled : config.googleAuthEnabled
}

function userHasLinkedProvider(user: {
  readonly app_metadata?: { readonly provider?: unknown; readonly providers?: unknown }
  readonly identities?: readonly { readonly provider?: unknown }[] | null
}, method: SocialAuthProvider): boolean {
  const primary = user.app_metadata?.provider
  const providers = user.app_metadata?.providers
  return primary === method
    || Array.isArray(providers) && providers.includes(method)
    || Array.isArray(user.identities) && user.identities.some(identity => identity.provider === method)
}

async function exchangeCapturedOAuthCallback(captured: CapturedOAuthCallback): Promise<OAuthCallbackResult> {
  if (captured.kind === "BLOCKED") {
    clearAttemptSafely(captured.attemptId)
    return {
      handled: true,
      ok: false,
      message: "로그인 정보를 안전하게 확인할 수 없어요. 이 기기에서 다시 로그아웃한 뒤 시도해 주세요.",
      unsafeSessionOpen: true,
    }
  }
  if (captured.kind === "INVALID") {
    if (captured.attemptId !== null) clearAttemptSafely(captured.attemptId)
    return {
      handled: true,
      ok: false,
      message: captured.legacy
        ? "예전 로그인 링크는 사용할 수 없어요. 로그인 화면에서 다시 시작해 주세요."
        : "로그인 응답이 올바르지 않거나 만료됐어요. 처음부터 다시 진행해 주세요.",
    }
  }

  return withAuthSessionQuarantineLock(async () => {
    const pending = readPendingAccountSetup()
    const method = pending?.attemptId === captured.attemptId
      && (pending.method === "kakao" || pending.method === "google")
      && pending.phase === "AUTH_STARTED"
      ? pending.method
      : null
    if (method === null || !methodEnabled(method)) {
      clearAttemptSafely(captured.attemptId)
      const released = clearAuthSessionQuarantine(captured.attemptId)
      return {
        handled: true,
        ok: false,
        message: "간편 로그인이 지금은 닫혀 있거나 가입 확인이 만료됐어요.",
        unsafeSessionOpen: !released,
      }
    }

    let client: AuthClient | null = null
    let exchangeStarted = false
    try {
    client = await supabase({ allowQuarantined: true })
    if (client === null) {
      const released = clearAuthSessionQuarantine(captured.attemptId)
      return {
        handled: true,
        ok: false,
        message: "계정 기능을 연결하지 못했어요. 잠시 후 다시 시도해 주세요.",
        unsafeSessionOpen: !released,
      }
    }
    if (!markAuthSessionExchangeStarted(captured.attemptId)) {
      clearAttemptSafely(captured.attemptId)
      return {
        handled: true,
        ok: false,
        message: "로그인 정보를 안전하게 확인할 수 없어요. 이 기기에서 다시 로그아웃한 뒤 시도해 주세요.",
        unsafeSessionOpen: true,
      }
    }
    exchangeStarted = true
    const { data, error } = await client.auth.exchangeCodeForSession(captured.code)
    const verifiedUser = data.user
    const verifiedUserId = verifiedUser?.id
    const accessToken = data.session?.access_token
    const providerLinked = verifiedUser != null && userHasLinkedProvider(verifiedUser, method)
    if (error || typeof verifiedUserId !== "string" || typeof accessToken !== "string" || !providerLinked) {
      const closed = await closeSessionAndReleaseQuarantine(client, captured.attemptId)
      clearAttemptSafely(captured.attemptId)
      return {
        handled: true,
        ok: false,
        message: "로그인 결과와 가입 정보를 연결하지 못했어요. 처음부터 다시 진행해 주세요.",
        unsafeSessionOpen: !closed,
      }
    }
    const verifiedSessionId = await verifyReturnedAuthSession(client, {
      accessToken,
      expectedUserId: verifiedUserId,
    })
    if (verifiedSessionId === null) {
      const closed = await closeSessionAndReleaseQuarantine(client, captured.attemptId)
      clearAttemptSafely(captured.attemptId)
      return {
        handled: true,
        ok: false,
        message: "로그인한 세션을 다시 확인하지 못했어요. 처음부터 다시 진행해 주세요.",
        unsafeSessionOpen: !closed,
      }
    }
    const pendingBound = markPendingAccountAuthVerified(
      captured.attemptId,
      verifiedUserId,
      method,
      verifiedSessionId,
    )
    if (!pendingBound) {
      const closed = await closeSessionAndReleaseQuarantine(client, captured.attemptId)
      clearAttemptSafely(captured.attemptId)
      return {
        handled: true,
        ok: false,
        message: "로그인 결과와 가입 정보를 연결하지 못했어요. 처음부터 다시 진행해 주세요.",
        unsafeSessionOpen: !closed,
      }
    }
    if (!clearAuthSessionQuarantine(captured.attemptId)) {
      const closed = await closeSessionAndReleaseQuarantine(client, captured.attemptId)
      clearAttemptSafely(captured.attemptId)
      return {
        handled: true,
        ok: false,
        message: "로그인 확인을 안전하게 마치지 못했어요. 처음부터 다시 진행해 주세요.",
        unsafeSessionOpen: !closed,
      }
    }
    return {
      handled: true,
      ok: true,
      message: "간편 로그인을 확인했어요.",
      verifiedUserId,
      pendingBound: true,
    }
    } catch {
      const closed = !exchangeStarted || client === null
        ? clearAuthSessionQuarantine(captured.attemptId)
        : await closeSessionAndReleaseQuarantine(client, captured.attemptId)
      clearAttemptSafely(captured.attemptId)
      return {
        handled: true,
        ok: false,
        message: "간편 로그인을 마치지 못했어요. 잠시 후 다시 시도해 주세요.",
        unsafeSessionOpen: !closed,
      }
    }
  })
}

/** StrictMode에서도 authorization code를 한 번만 교환한다. */
export function consumeCapturedOAuthAuthCallback(): Promise<OAuthCallbackResult> {
  if (callbackCompletion !== null) return callbackCompletion
  const captured = capturedOAuthCallback
  capturedOAuthCallback = null
  callbackCompletion = captured === null
    ? Promise.resolve({ handled: false })
    : exchangeCapturedOAuthCallback(captured)
  return callbackCompletion
}

export function __resetCapturedOAuthAuthCallbackForTest(): void {
  capturedOAuthCallback = null
  callbackCompletion = null
}
