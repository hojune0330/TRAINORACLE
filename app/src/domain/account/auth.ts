// 인증 래퍼 — 이메일 OTP(비밀번호 없는 간편 가입/로그인) + 소셜 OAuth.
// 모든 함수는 feature flag OFF(클라이언트 null)일 때 안전한 실패값을 돌려준다.
import { supabase } from "./supabase-client"

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

/** 이메일로 6자리 인증 코드 전송 (가입/로그인 겸용 — 계정 없으면 생성) */
export async function requestEmailOtp(email: string): Promise<AuthResult> {
  const client = await supabase()
  if (client === null) return { ok: false, message: "계정 기능이 꺼져 있어요." }
  const trimmed = email.trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { ok: false, message: "이메일 주소를 확인해 주세요." }
  }
  const { error } = await client.auth.signInWithOtp({
    email: trimmed,
    options: { shouldCreateUser: true },
  })
  if (error) return { ok: false, message: "코드 전송에 실패했어요. 잠시 후 다시 시도해 주세요." }
  return { ok: true, message: "인증 코드를 이메일로 보냈어요." }
}

/** 이메일로 받은 6자리 코드 확인 */
export async function verifyEmailOtp(email: string, code: string): Promise<AuthResult> {
  const client = await supabase()
  if (client === null) return { ok: false, message: "계정 기능이 꺼져 있어요." }
  const { error } = await client.auth.verifyOtp({
    email: email.trim(),
    token: code.trim(),
    type: "email",
  })
  if (error) return { ok: false, message: "코드가 맞지 않거나 만료됐어요." }
  return { ok: true, message: "로그인되었어요." }
}

export function authReturnUrl(href?: string): string | undefined {
  const source = href ?? (typeof window !== "undefined" ? window.location.href : undefined)
  if (source === undefined) return undefined
  const url = new URL(source)
  url.searchParams.set("account", "1")
  url.hash = ""
  return url.toString()
}

/** 휴대전화로 6자리 인증 코드 전송. 공개 플래그와 SMS 공급자 게이트는 별도다. */
export async function requestPhoneOtp(phone: string): Promise<AuthResult> {
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
export async function verifyPhoneOtp(phone: string, code: string): Promise<AuthResult> {
  const client = await supabase()
  if (client === null) return { ok: false, message: "계정 기능이 꺼져 있어요." }
  const normalized = normalizeKoreanMobilePhone(phone)
  if (normalized === null) {
    return { ok: false, message: "휴대전화 번호를 다시 확인해 주세요." }
  }
  const { error } = await client.auth.verifyOtp({
    phone: normalized,
    token: code.trim(),
    type: "sms",
  })
  if (error) return { ok: false, message: "인증번호가 맞지 않거나 만료됐어요." }
  return { ok: true, message: "로그인되었어요." }
}

/** 카카오·Google 간편 로그인 (Supabase OAuth 리다이렉트) */
export async function signInWithProvider(provider: SocialAuthProvider): Promise<AuthResult> {
  const client = await supabase()
  if (client === null) return { ok: false, message: "계정 기능이 꺼져 있어요." }
  const redirectTo = authReturnUrl()
  const { error } = await client.auth.signInWithOAuth({
    provider,
    options: { redirectTo },
  })
  const label = provider === "kakao" ? "카카오" : "Google"
  if (error) return { ok: false, message: `${label} 로그인을 시작하지 못했어요.` }
  return { ok: true, message: `${label}로 이동해요.` }
}

/** 이전 호출부와 외부 계약을 위한 호환 래퍼. */
export async function signInWithGoogle(): Promise<AuthResult> {
  return signInWithProvider("google")
}

export async function signOut(): Promise<AuthResult> {
  const client = await supabase()
  if (client === null) return { ok: false, message: "계정 기능이 꺼져 있어요." }
  const { error } = await client.auth.signOut()
  if (error) return { ok: false, message: "로그아웃에 실패했어요." }
  return { ok: true, message: "로그아웃되었어요." }
}

export async function currentUser(): Promise<AccountUser | null> {
  const client = await supabase()
  if (client === null) return null
  try {
    const { data } = await client.auth.getSession()
    const user = data.session?.user
    return user ? toAccountUser(user) : null
  } catch {
    return null
  }
}

/** 세션 변화 구독. 반환값은 해제 함수. flag OFF면 no-op 해제 함수. */
export function onAuthChange(listener: (user: AccountUser | null) => void): () => void {
  let unsubscribe: (() => void) | null = null
  let cancelled = false
  void supabase().then((client) => {
    if (client === null || cancelled) return
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      listener(session?.user ? toAccountUser(session.user) : null)
    })
    unsubscribe = () => data.subscription.unsubscribe()
    if (cancelled) unsubscribe()
  })
  return () => {
    cancelled = true
    unsubscribe?.()
  }
}
