import { accountConfig } from "./config"
import {
  clearPendingAccountSetupForAttempt,
  isAuthAttemptId,
  markPendingEmailAuthVerified,
  readPendingAccountSetup,
} from "./auth-onboarding"
import { supabase } from "./supabase-client"
import {
  beginAuthSessionQuarantine,
  clearAuthSessionQuarantine,
  markAuthSessionExchangeStarted,
  withAuthSessionQuarantineLock,
} from "./auth-session-quarantine"
import {
  clearEmailAuthBrowserProof,
  consumeEmailAuthBrowserProof,
  hasEmailAuthBrowserProof,
} from "./email-auth-browser-proof"
import { verifyReturnedAuthSession } from "./verified-auth-session"

type CapturedEmailCallback =
  | { readonly kind: "VALID"; readonly tokenHash: string; readonly attemptId: string }
  | { readonly kind: "PROOF_MISSING"; readonly attemptId: string }
  | { readonly kind: "BLOCKED"; readonly attemptId: string }
  | { readonly kind: "INVALID"; readonly attemptId: string | null }

export type EmailAuthCallbackResult =
  | { readonly handled: false }
  | {
      readonly handled: true
      readonly ok: boolean
      readonly message: string
      readonly verifiedUserId?: string
      readonly pendingBound?: boolean
      readonly requiresPreAuth?: boolean
      readonly attemptId?: string
      /** 인증 세션 생성 가능성 뒤 local sign-out까지 실패해 계정 UI를 막아야 한다. */
      readonly unsafeSessionOpen?: boolean
    }

const EMAIL_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,512}$/u
let capturedEmailCallback: CapturedEmailCallback | null = null
let callbackCompletion: Promise<EmailAuthCallbackResult> | null = null

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

function callbackAttemptId(url: URL): string | null {
  const values = url.searchParams.getAll("account_flow")
  return values.length === 1 && isAuthAttemptId(values[0]) ? values[0] : null
}

function fragmentParams(url: URL): URLSearchParams {
  return new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : url.hash)
}

function scrubEmailCredential(url: URL, replaceState?: (url: string) => void, scrubOtherAuthCredentials = false): void {
  url.searchParams.delete("token_hash")
  url.searchParams.delete("type")
  const hash = fragmentParams(url)
  hash.delete("token_hash")
  hash.delete("type")
  if (scrubOtherAuthCredentials) {
    for (const key of ["code", "error", "error_code", "error_description"]) url.searchParams.delete(key)
    for (const key of ["access_token", "refresh_token", "provider_token", "provider_refresh_token", "expires_at", "expires_in", "token_type"]) {
      hash.delete(key)
    }
  }
  url.hash = hash.toString() === "" ? "" : `#${hash.toString()}`
  const safeUrl = url.toString()
  if (replaceState !== undefined) replaceState(safeUrl)
  else if (typeof window !== "undefined" && typeof window.history?.replaceState === "function") {
    window.history.replaceState(window.history.state, "", safeUrl)
  }
}

/**
 * The new templates put the one-time token in the fragment so it is not sent in
 * the initial HTTP request or Referer. Query parsing only scrubs and rejects
 * links from the superseded template.
 */
export function captureEmailAuthCallbackFromUrl(input?: {
  readonly href?: string
  readonly replaceState?: (url: string) => void
}): boolean {
  const href = input?.href ?? (typeof window !== "undefined" ? window.location.href : undefined)
  if (href === undefined) return false

  const url = new URL(href)
  const hash = fragmentParams(url)
  const fragmentTokens = hash.getAll("token_hash")
  const fragmentTypes = hash.getAll("type")
  const queryTokens = url.searchParams.getAll("token_hash")
  const queryTypes = url.searchParams.getAll("type")
  if (fragmentTokens.length + queryTokens.length === 0) return false
  const mixedAuthCredential = url.searchParams.has("code")
    || url.searchParams.has("error")
    || url.searchParams.has("error_code")
    || url.searchParams.has("error_description")
    || ["access_token", "refresh_token", "provider_token", "provider_refresh_token"].some(key => hash.has(key))

  // Scrub before validation or network access. Malformed and duplicate values
  // are credentials too and must not remain in browser history.
  scrubEmailCredential(url, input?.replaceState, mixedAuthCredential)

  const attemptId = callbackAttemptId(url)
  const tokenHash = fragmentTokens[0] ?? ""
  const valid = fragmentTokens.length === 1
    && fragmentTypes.length === 1
    && fragmentTypes[0] === "email"
    && queryTokens.length === 0
    && queryTypes.length === 0
    && !mixedAuthCredential
    && attemptId !== null
    && EMAIL_TOKEN_PATTERN.test(tokenHash)
  capturedEmailCallback = valid
    ? !hasEmailAuthBrowserProof(attemptId)
      ? { kind: "PROOF_MISSING", attemptId }
      : beginAuthSessionQuarantine({ attemptId, method: "email" })
      ? { kind: "VALID", tokenHash, attemptId }
      : { kind: "BLOCKED", attemptId }
    : { kind: "INVALID", attemptId }
  callbackCompletion = null
  return true
}

async function verifyCapturedEmailCallback(captured: CapturedEmailCallback): Promise<EmailAuthCallbackResult> {
  if (captured.kind === "PROOF_MISSING") {
    clearAttemptSafely(captured.attemptId)
    return {
      handled: true,
      ok: false,
      message: "이 브라우저에서 요청한 확인 링크가 아니에요. 이메일을 다시 받아 주세요.",
    }
  }
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
    return { handled: true, ok: false, message: "확인 링크가 올바르지 않거나 만료됐어요. 이메일을 다시 받아 주세요." }
  }

  return withAuthSessionQuarantineLock(async () => {
    const config = accountConfig()
    if (config === null || !config.emailAuthEnabled) {
      clearAttemptSafely(captured.attemptId)
      clearEmailAuthBrowserProof(captured.attemptId)
      const released = clearAuthSessionQuarantine(captured.attemptId)
      return {
        handled: true,
        ok: false,
        message: "이메일 로그인이 지금은 닫혀 있어요. 잠시 후 다시 시도해 주세요.",
        unsafeSessionOpen: !released,
      }
    }

    let client: AuthClient | null = null
    let verificationStarted = false
    try {
    if (!consumeEmailAuthBrowserProof(captured.attemptId)) {
      clearAttemptSafely(captured.attemptId)
      const released = clearAuthSessionQuarantine(captured.attemptId)
      return {
        handled: true,
        ok: false,
        message: "이 브라우저에서 요청한 확인 링크가 아니에요. 이메일을 다시 받아 주세요.",
        unsafeSessionOpen: !released,
      }
    }
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
    verificationStarted = true
    const { data, error } = await client.auth.verifyOtp({
      token_hash: captured.tokenHash,
      type: "email",
    })
    const verifiedUserId = data?.user?.id
    const verifiedEmail = data?.user?.email
    const accessToken = data?.session?.access_token
    if (
      error
      || typeof verifiedUserId !== "string"
      || typeof verifiedEmail !== "string"
      || typeof accessToken !== "string"
    ) {
      const closed = await closeSessionAndReleaseQuarantine(client, captured.attemptId)
      clearAttemptSafely(captured.attemptId)
      return {
        handled: true,
        ok: false,
        message: "확인 링크가 올바르지 않거나 만료됐어요. 이메일을 다시 받아 주세요.",
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

    const pendingBound = markPendingEmailAuthVerified(
      captured.attemptId,
      verifiedUserId,
      verifiedEmail,
      verifiedSessionId,
    )
    if (!pendingBound) {
      const closed = await closeSessionAndReleaseQuarantine(client, captured.attemptId)
      clearAttemptSafely(captured.attemptId)
      return {
        handled: true,
        ok: false,
        message: "이메일 확인과 가입 정보를 연결하지 못했어요. 처음부터 다시 진행해 주세요.",
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
      message: "이메일 확인을 마쳤어요.",
      verifiedUserId,
      pendingBound: true,
    }
    } catch {
      const closed = !verificationStarted || client === null
        ? clearAuthSessionQuarantine(captured.attemptId)
        : await closeSessionAndReleaseQuarantine(client, captured.attemptId)
      clearAttemptSafely(captured.attemptId)
      return {
        handled: true,
        ok: false,
        message: "이메일 확인을 마치지 못했어요. 잠시 후 다시 시도해 주세요.",
        unsafeSessionOpen: !closed,
      }
    }
  })
}

/** StrictMode에서도 같은 verification promise/result를 재사용한다. */
export function consumeCapturedEmailAuthCallback(): Promise<EmailAuthCallbackResult> {
  if (callbackCompletion !== null) return callbackCompletion
  const captured = capturedEmailCallback
  if (captured?.kind === "VALID") {
    const config = accountConfig()
    if (config !== null && config.emailAuthEnabled) {
      const pending = readPendingAccountSetup()
      const readyForVerification = pending?.attemptId === captured.attemptId
        && pending.method === "email"
        && pending.phase === "AUTH_STARTED"
      if (!readyForVerification) {
        return Promise.resolve({
          handled: true,
          ok: false,
          message: "이메일을 확인하기 전에 나이와 필수 약관을 다시 확인해 주세요.",
          requiresPreAuth: true,
          attemptId: captured.attemptId,
        })
      }
    }
  }
  capturedEmailCallback = null
  callbackCompletion = captured === null
    ? Promise.resolve({ handled: false })
    : verifyCapturedEmailCallback(captured)
  return callbackCompletion
}

export function capturedEmailAuthAttemptId(): string | null {
  return capturedEmailCallback?.kind === "VALID" ? capturedEmailCallback.attemptId : null
}

export function __resetCapturedEmailAuthCallbackForTest(): void {
  capturedEmailCallback = null
  callbackCompletion = null
}
