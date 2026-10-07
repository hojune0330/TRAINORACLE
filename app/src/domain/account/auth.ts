// 인증 래퍼 — 이메일 OTP(비밀번호 없는 간편 가입/로그인) + 소셜 OAuth.
// 모든 함수는 feature flag OFF(클라이언트 null)일 때 안전한 실패값을 돌려준다.
import { supabase } from "./supabase-client"
import { accountConfig } from "./config"
import {
  clearPendingAccountSetupForAttempt,
  markPendingAccountAuthStarted,
  markPendingAccountAuthVerified,
  normalizeAuthEmail,
  onlineAccountEligibility,
  readPendingAccountSetup,
} from "./auth-onboarding"
import { koreaServiceDate } from "./service-date"
import { clearEmailAuthBrowserProof, createEmailAuthBrowserProof } from "./email-auth-browser-proof"
import {
  authSessionQuarantinePhase,
  authSessionQuarantineLockAvailable,
  beginAuthSessionQuarantine,
  clearAuthSessionQuarantine,
  clearAuthSessionQuarantineAfterConfirmedSignOut,
  markAuthSessionExchangeStarted,
  withAuthSessionQuarantineLock,
} from "./auth-session-quarantine"
import { verifyReturnedAuthSession } from "./verified-auth-session"

export const socialAuthProviders = ["kakao", "google"] as const
export type SocialAuthProvider = typeof socialAuthProviders[number]

export type AccountUser = {
  readonly id: string
  readonly email: string | null
  readonly phone: string | null
  readonly provider: string | null
}

export type AuthResult = {
  readonly ok: boolean
  readonly message: string
}

export type AuthVerificationResult = AuthResult & {
  /** Supabase 인증 작업 자체가 돌려준 사용자 ID. 세션 캐시에서 추측하지 않는다. */
  readonly verifiedUserId?: string
  /** 인증 성공 가능성 뒤 local sign-out도 실패해 계정 UI를 막아야 한다. */
  readonly unsafeSessionOpen?: boolean
}

/**
 * `local`은 이 브라우저 세션만 끝내고, `global`은 같은 계정의 다른 기기 세션도
 * 폐기한다. 일반 로그아웃과 계정 전환은 다른 기기를 건드리지 않도록 local이
 * 기본값이다. global은 계정 삭제처럼 명시적으로 모든 세션을 닫아야 할 때만 쓴다.
 */
export type AccountSignOutScope = "local" | "global"

export type AccountSignOutOptions = {
  readonly scope?: AccountSignOutScope
  /** 삭제 후 정리만 이 계정에 묶는다. 일반 로그아웃에는 필요하지 않다. */
  readonly expectedUserId?: string
  /** 같은 ID로 돌아온 새 세션도 이전 삭제 정리의 대상이 아니다. */
  readonly isCurrent?: () => boolean
}

function toAccountUser(raw: {
  id: string
  email?: string | null
  phone?: string | null
  app_metadata?: { provider?: string }
}): AccountUser {
  return {
    id: raw.id,
    email: raw.email ?? null,
    phone: raw.phone ?? null,
    provider: raw.app_metadata?.provider ?? null,
  }
}

export const PHONE_OTP_RESEND_SECONDS = 60
const AUTH_RETURN_ATTEMPT_PARAM = "account_flow"
const AUTH_ATTEMPT_ID_PATTERN = /^[a-f0-9]{32}$/u

function authMethodEnabled(method: AuthMethodGate): boolean {
  const config = accountConfig()
  if (config === null) return false
  switch (method) {
    case "kakao": return config.kakaoAuthEnabled
    case "google": return config.googleAuthEnabled
    case "email": return config.emailAuthEnabled
    case "phone": return config.phoneAuthEnabled
    default: return false
  }
}

type AuthMethodGate = SocialAuthProvider | "email" | "phone"
type AuthClient = NonNullable<Awaited<ReturnType<typeof supabase>>>

function clearAttemptSafely(attemptId: string): void {
  try {
    clearPendingAccountSetupForAttempt(attemptId)
  } catch {
    // 저장소 오류는 인증 실패를 성공으로 바꾸지 않는다.
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

function authorizeAuthStart(method: AuthMethodGate, attemptId: string): boolean {
  if (!AUTH_ATTEMPT_ID_PATTERN.test(attemptId)) return false
  const pending = readPendingAccountSetup()
  if (pending === null || pending.attemptId !== attemptId || pending.method !== method) return false
  const config = accountConfig()
  if (config === null
    || pending.privacyPolicyVersion !== config.privacyPolicy.version
    || pending.termsOfServiceVersion !== config.termsOfService.version
    || onlineAccountEligibility(pending.birthDate, koreaServiceDate()) !== "ELIGIBLE") return false
  if (pending.phase === "PREPARED") return markPendingAccountAuthStarted(attemptId)
  return pending.phase === "AUTH_STARTED"
}

function authorizeAuthVerification(method: AuthMethodGate, attemptId: string): boolean {
  if (!AUTH_ATTEMPT_ID_PATTERN.test(attemptId)) return false
  const pending = readPendingAccountSetup()
  const config = accountConfig()
  return config !== null
    && pending?.attemptId === attemptId
    && pending.method === method
    && pending.phase === "AUTH_STARTED"
    && pending.privacyPolicyVersion === config.privacyPolicy.version
    && pending.termsOfServiceVersion === config.termsOfService.version
    && onlineAccountEligibility(pending.birthDate, koreaServiceDate()) === "ELIGIBLE"
}

/** 국내 010 번호를 Supabase가 요구하는 E.164(+8210...) 형태로 바꾼다. */
export function normalizeKoreanMobilePhone(value: string): string | null {
  const compact = value.trim().replace(/[\s().-]/gu, "")
  const local = compact.startsWith("+82")
    ? `0${compact.slice(3)}`
    : compact.startsWith("82")
      ? `0${compact.slice(2)}`
      : compact
  if (!/^010\d{8}$/u.test(local)) return null
  return `+82${local.slice(1)}`
}

export function maskPhoneNumber(value: string): string {
  const normalized = normalizeKoreanMobilePhone(value)
  if (normalized === null) return "휴대전화 번호 확인 필요"
  return `010-****-${normalized.slice(-4)}`
}

/** 이메일 확인 링크 전송 (가입/로그인 겸용 — 계정 없으면 생성). */
export async function requestEmailOtp(email: string, attemptId: string): Promise<AuthResult> {
  if (!authMethodEnabled("email")) return { ok: false, message: "이메일 로그인이 지금은 닫혀 있어요." }
  const normalizedEmail = normalizeAuthEmail(email)
  const prepared = readPendingAccountSetup()
  if (
    normalizedEmail === null
    || prepared?.attemptId !== attemptId
    || prepared.method !== "email"
    || prepared.expectedEmail === null
    || prepared.expectedEmail !== normalizedEmail
  ) return { ok: false, message: "이메일 주소와 가입 확인 정보를 다시 확인해 주세요." }
  if (!authorizeAuthStart("email", attemptId)) {
    return { ok: false, message: "가입 확인이 만료됐어요. 처음부터 다시 진행해 주세요." }
  }
  const client = await supabase()
  if (client === null) return { ok: false, message: "계정 기능이 꺼져 있어요." }
  if (!createEmailAuthBrowserProof(attemptId)) {
    return { ok: false, message: "이 브라우저에서 이메일 확인을 안전하게 시작하지 못했어요." }
  }
  const { error } = await client.auth.signInWithOtp({
    email: normalizedEmail,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: authReturnUrl(undefined, attemptId),
    },
  })
  if (error) {
    clearEmailAuthBrowserProof(attemptId)
    return { ok: false, message: "확인 이메일을 보내지 못했어요. 잠시 후 다시 시도해 주세요." }
  }
  return { ok: true, message: "확인 링크를 이메일로 보냈어요." }
}

export function authReturnUrl(href?: string, attemptId?: string): string | undefined {
  const source = href ?? (typeof window !== "undefined" ? window.location.href : undefined)
  if (source === undefined) return undefined
  if (attemptId !== undefined && !AUTH_ATTEMPT_ID_PATTERN.test(attemptId)) {
    throw new Error("INVALID_AUTH_ATTEMPT_ID")
  }
  const url = new URL(source)
  url.search = ""
  url.hash = ""
  url.searchParams.set("account", "1")
  if (attemptId !== undefined) url.searchParams.set(AUTH_RETURN_ATTEMPT_PARAM, attemptId)
  return url.toString()
}

export function authReturnAttemptId(href?: string): string | null {
  const source = href ?? (typeof window !== "undefined" ? window.location.href : undefined)
  if (source === undefined) return null
  const values = new URL(source).searchParams.getAll(AUTH_RETURN_ATTEMPT_PARAM)
  const value = values[0]
  return values.length === 1 && value !== undefined && AUTH_ATTEMPT_ID_PATTERN.test(value) ? value : null
}

export function clearAuthReturnAttemptIdFromUrl(): void {
  if (typeof window === "undefined" || typeof window.history?.replaceState !== "function") return
  const url = new URL(window.location.href)
  if (!url.searchParams.has(AUTH_RETURN_ATTEMPT_PARAM)) return
  url.searchParams.delete(AUTH_RETURN_ATTEMPT_PARAM)
  window.history.replaceState(window.history.state, "", url.toString())
}

/** 휴대전화로 6자리 인증 코드 전송. 공개 플래그와 SMS 공급자 게이트는 별도다. */
export async function requestPhoneOtp(phone: string, attemptId: string): Promise<AuthResult> {
  if (!authMethodEnabled("phone")) return { ok: false, message: "휴대전화 로그인이 지금은 닫혀 있어요." }
  if (!authorizeAuthStart("phone", attemptId)) {
    return { ok: false, message: "가입 확인이 만료됐어요. 처음부터 다시 진행해 주세요." }
  }
  const client = await supabase()
  if (client === null) return { ok: false, message: "계정 기능이 꺼져 있어요." }
  const normalized = normalizeKoreanMobilePhone(phone)
  if (normalized === null) {
    return { ok: false, message: "010으로 시작하는 휴대전화 번호를 확인해 주세요." }
  }
  const { error } = await client.auth.signInWithOtp({
    phone: normalized,
    options: { shouldCreateUser: true },
  })
  if (error) return { ok: false, message: "인증번호를 보내지 못했어요. 잠시 후 다시 시도해 주세요." }
  return { ok: true, message: "문자로 6자리 인증번호를 보냈어요." }
}

/** 휴대전화로 받은 6자리 코드 확인. */
export async function verifyPhoneOtp(phone: string, code: string, attemptId: string): Promise<AuthVerificationResult> {
  if (!authMethodEnabled("phone")) return { ok: false, message: "휴대전화 로그인이 지금은 닫혀 있어요." }
  if (!authorizeAuthVerification("phone", attemptId)) {
    return { ok: false, message: "인증번호를 다시 받아 주세요." }
  }
  const client = await supabase()
  if (client === null) return { ok: false, message: "계정 기능이 꺼져 있어요." }
  const normalized = normalizeKoreanMobilePhone(phone)
  if (normalized === null) {
    return { ok: false, message: "휴대전화 번호를 다시 확인해 주세요." }
  }
  if (!beginAuthSessionQuarantine({ attemptId, method: "phone" })) {
    clearAttemptSafely(attemptId)
    return {
      ok: false,
      message: "로그인 정보를 안전하게 확인할 수 없어요. 이 기기에서 다시 로그아웃한 뒤 시도해 주세요.",
      unsafeSessionOpen: true,
    }
  }
  return withAuthSessionQuarantineLock(async () => {
    if (!markAuthSessionExchangeStarted(attemptId)) {
      clearAttemptSafely(attemptId)
      return {
        ok: false,
        message: "로그인 정보를 안전하게 확인할 수 없어요. 이 기기에서 다시 로그아웃한 뒤 시도해 주세요.",
        unsafeSessionOpen: true,
      }
    }
    let verificationStarted = false
    try {
    verificationStarted = true
    const { data, error } = await client.auth.verifyOtp({
      phone: normalized,
      token: code.trim(),
      type: "sms",
    })
    if (error) {
      const closed = await closeSessionAndReleaseQuarantine(client, attemptId)
      clearAttemptSafely(attemptId)
      return { ok: false, message: "인증번호가 맞지 않거나 만료됐어요.", unsafeSessionOpen: !closed }
    }
    const verifiedUserId = data.user?.id
    const accessToken = data.session?.access_token
    if (typeof verifiedUserId !== "string" || typeof accessToken !== "string") {
      const closed = await closeSessionAndReleaseQuarantine(client, attemptId)
      clearAttemptSafely(attemptId)
      return {
        ok: false,
        message: "로그인한 계정을 가입 확인과 연결하지 못했어요. 처음부터 다시 진행해 주세요.",
        unsafeSessionOpen: !closed,
      }
    }
    const verifiedSessionId = await verifyReturnedAuthSession(client, {
      accessToken,
      expectedUserId: verifiedUserId,
    })
    if (
      verifiedSessionId === null
      || !markPendingAccountAuthVerified(attemptId, verifiedUserId, "phone", verifiedSessionId)
    ) {
      const closed = await closeSessionAndReleaseQuarantine(client, attemptId)
      clearAttemptSafely(attemptId)
      return {
        ok: false,
        message: "로그인한 계정을 다시 확인하지 못했어요. 처음부터 다시 진행해 주세요.",
        unsafeSessionOpen: !closed,
      }
    }
    if (!clearAuthSessionQuarantine(attemptId)) {
      const closed = await closeSessionAndReleaseQuarantine(client, attemptId)
      clearAttemptSafely(attemptId)
      return {
        ok: false,
        message: "로그인 확인을 안전하게 마치지 못했어요. 처음부터 다시 진행해 주세요.",
        unsafeSessionOpen: !closed,
      }
    }
    return { ok: true, message: "로그인되었어요.", verifiedUserId }
    } catch {
      const closed = verificationStarted
        ? await closeSessionAndReleaseQuarantine(client, attemptId)
        : clearAuthSessionQuarantine(attemptId)
      clearAttemptSafely(attemptId)
      return {
        ok: false,
        message: "인증번호를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.",
        unsafeSessionOpen: !closed,
      }
    }
  })
}

/** 카카오·Google 간편 로그인 (Supabase OAuth 리다이렉트) */
export async function signInWithProvider(provider: SocialAuthProvider, attemptId?: string): Promise<AuthResult> {
  if (!(socialAuthProviders as readonly string[]).includes(provider)) {
    return { ok: false, message: "지원하지 않는 로그인 방법이에요." }
  }
  const label = provider === "kakao" ? "카카오" : "Google"
  if (!authMethodEnabled(provider)) return { ok: false, message: `${label} 로그인이 지금은 닫혀 있어요.` }
  if (attemptId === undefined || !authorizeAuthStart(provider, attemptId)) {
    return { ok: false, message: "가입 확인이 만료됐어요. 처음부터 다시 진행해 주세요." }
  }
  const client = await supabase()
  if (client === null) return { ok: false, message: "계정 기능이 꺼져 있어요." }
  const redirectTo = authReturnUrl(undefined, attemptId)
  const { error } = await client.auth.signInWithOAuth({
    provider,
    options: { redirectTo },
  })
  if (error) return { ok: false, message: `${label} 로그인을 시작하지 못했어요.` }
  return { ok: true, message: `${label}로 이동해요.` }
}

/** 이전 호출부와 외부 계약을 위한 호환 래퍼. */
export async function signInWithGoogle(attemptId: string): Promise<AuthResult> {
  return signInWithProvider("google", attemptId)
}

export async function signOut(options: AccountSignOutOptions = {}): Promise<AuthResult> {
  const superseded = (): AuthResult => ({ ok: false, message: "현재 계정이 바뀌어 로그아웃을 중단했어요." })
  const isCurrent = (): boolean => {
    try {
      return options.isCurrent?.() ?? true
    } catch {
      return false
    }
  }
  if (!isCurrent()) return superseded()
  const quarantinePhase = authSessionQuarantinePhase()
  if (quarantinePhase !== null && !authSessionQuarantineLockAvailable()) {
    return { ok: false, message: "다른 로그인 창을 모두 닫고 이 화면을 다시 열어 주세요." }
  }
  return withAuthSessionQuarantineLock(async () => {
    try {
      // The origin lock serializes this app's exchanges, not arbitrary SDK clients.
      if (!isCurrent()) return superseded()
      const client = await supabase({ allowQuarantined: true })
      if (!isCurrent()) return superseded()
      if (client === null) return { ok: false, message: "계정 기능이 꺼져 있어요." }
      if (options.expectedUserId !== undefined) {
        const { data, error } = await client.auth.getSession()
        if (!isCurrent()
          || error
          || options.expectedUserId.length === 0
          || data.session?.user.id !== options.expectedUserId) return superseded()
      }
      if (options.expectedUserId === undefined && authSessionQuarantinePhase() === "PRE_EXCHANGE") {
        try {
          const { data, error } = await client.auth.getSession()
          if (!isCurrent()) return superseded()
          if (!error && data.session === null && authSessionQuarantinePhase() === "PRE_EXCHANGE") {
            if (!isCurrent()) return superseded()
            if (!clearAuthSessionQuarantineAfterConfirmedSignOut()) {
              return { ok: false, message: "로그인 보호 상태를 정리하지 못했어요." }
            }
            return { ok: true, message: "중단된 로그인을 정리했어요." }
          }
        } catch {
          // If local-session absence cannot be proved, require a real sign-out.
        }
      }
      if (!isCurrent()) return superseded()
      const { error } = await client.auth.signOut({ scope: options.scope ?? "local" })
      if (!isCurrent()) return superseded()
      if (error) return { ok: false, message: "로그아웃에 실패했어요." }
      if (!isCurrent()) return superseded()
      if (!clearAuthSessionQuarantineAfterConfirmedSignOut()) {
        return { ok: false, message: "로그아웃했지만 이 기기의 로그인 보호 상태를 정리하지 못했어요." }
      }
      return { ok: true, message: "로그아웃되었어요." }
    } catch {
      // 네트워크·저장소 예외도 성공처럼 처리하거나 호출부에 미처리 예외로 넘기지 않는다.
      return { ok: false, message: "로그아웃에 실패했어요." }
    }
  })
}

export async function currentUser(options?: { throwOnFailure?: boolean }): Promise<AccountUser | null> {
  try {
    const client = await supabase()
    if (client === null) {
      if (options?.throwOnFailure) throw new Error("AUTH_UNAVAILABLE")
      return null
    }
    const { data, error } = await client.auth.getUser()
    if (error) throw new Error("AUTH_UNAVAILABLE")
    const user = data.user
    return user ? toAccountUser(user) : null
  } catch {
    if (options?.throwOnFailure) throw new Error("AUTH_UNAVAILABLE")
    return null
  }
}

/** 세션 변화 구독. 반환값은 해제 함수. flag OFF면 no-op 해제 함수. */
export function onAuthChange(listener: (user: AccountUser | null) => void, options?: { ignoreInitialSession?: boolean }): () => void {
  let unsubscribe: (() => void) | null = null
  let cancelled = false
  void supabase().then((client) => {
    if (client === null || cancelled) return
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      if (cancelled || options?.ignoreInitialSession && _event === "INITIAL_SESSION") return
      listener(session?.user ? toAccountUser(session.user) : null)
    })
    unsubscribe = () => data.subscription.unsubscribe()
    if (cancelled) unsubscribe()
  }).catch(() => undefined)
  return () => {
    cancelled = true
    unsubscribe?.()
  }
}
