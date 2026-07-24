// 인증 래퍼 — 이메일 OTP(비밀번호 없는 간편 가입/로그인) + Google OAuth.
// 모든 함수는 feature flag OFF(클라이언트 null)일 때 안전한 실패값을 돌려준다.
import { supabase } from "./supabase-client"

export type AccountUser = {
  readonly id: string
  readonly email: string | null
  readonly provider: string | null
}

export type AuthResult = {
  readonly ok: boolean
  readonly message: string
}

function toAccountUser(raw: {
  id: string
  email?: string | null
  app_metadata?: { provider?: string }
}): AccountUser {
  return {
    id: raw.id,
    email: raw.email ?? null,
    provider: raw.app_metadata?.provider ?? null,
  }
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

/** Google 간편 로그인 (리다이렉트) */
export async function signInWithGoogle(): Promise<AuthResult> {
  const client = await supabase()
  if (client === null) return { ok: false, message: "계정 기능이 꺼져 있어요." }
  const redirectTo = typeof window !== "undefined"
    ? window.location.origin + window.location.pathname
    : undefined
  const { error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  })
  if (error) return { ok: false, message: "Google 로그인을 시작하지 못했어요." }
  return { ok: true, message: "Google로 이동해요." }
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
