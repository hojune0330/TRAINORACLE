// 계정 기능 공개 게이트.
// 자격 정보 2개와 계정 출시 승인 값이 있어야 계정 기능이 켜지고, 각 인증
// 방법은 다시 별도의 출시·중단 값이 있어야 화면과 인증 래퍼에서 사용할 수 있다.
// 키를 미리 등록해도 출시 승인이 없으면 로컬 전용 앱으로 남는다.
import { isSupabasePublicClientKey } from "../supabase-public-key"
import { isRetiredSharedAuthOrigin } from "./auth-origin"

export type AccountConfig = {
  readonly url: string
  readonly anonKey: string
  readonly kakaoAuthEnabled: boolean
  readonly googleAuthEnabled: boolean
  readonly emailAuthEnabled: boolean
  readonly phoneAuthEnabled: boolean
  readonly privacyPolicy: AccountLegalDocument
  readonly termsOfService: AccountLegalDocument
}

export type AccountLegalDocument = {
  readonly url: string
  readonly version: string
}

// Update with both published legal documents and the server admission gate.
export const CURRENT_ACCOUNT_LEGAL_VERSION = "2026-10-05"

function textValue(env: Readonly<Record<string, unknown>>, name: string): string {
  const value = env[name]
  return typeof value === "string" ? value.trim() : ""
}

export function resolveAccountConfig(env: Readonly<Record<string, unknown>>): AccountConfig | null {
  if (textValue(env, "VITE_ACCOUNT_PUBLIC_ENABLED") !== "true") return null
  if (textValue(env, "VITE_KILL_ACCOUNT") === "true") return null

  const url = textValue(env, "VITE_SUPABASE_URL")
  const anonKey = textValue(env, "VITE_SUPABASE_ANON_KEY")
  const privacyPolicy = {
    url: textValue(env, "VITE_PRIVACY_POLICY_URL"),
    version: textValue(env, "VITE_PRIVACY_POLICY_VERSION"),
  }
  const termsOfService = {
    url: textValue(env, "VITE_TERMS_OF_SERVICE_URL"),
    version: textValue(env, "VITE_TERMS_OF_SERVICE_VERSION"),
  }
  if (
    url === "" || !isSupabasePublicClientKey(anonKey)
    || privacyPolicy.url === "" || privacyPolicy.version !== CURRENT_ACCOUNT_LEGAL_VERSION
    || termsOfService.url === "" || termsOfService.version !== CURRENT_ACCOUNT_LEGAL_VERSION
  ) return null
  if (!url.startsWith("https://")) return null
  if (!privacyPolicy.url.startsWith("https://") || !termsOfService.url.startsWith("https://")) return null
  return {
    url,
    anonKey,
    kakaoAuthEnabled: textValue(env, "VITE_KAKAO_AUTH_ENABLED") === "true"
      && textValue(env, "VITE_KILL_KAKAO_AUTH") !== "true",
    googleAuthEnabled: textValue(env, "VITE_GOOGLE_AUTH_ENABLED") === "true"
      && textValue(env, "VITE_KILL_GOOGLE_AUTH") !== "true",
    // PKCE changes the shape of the email callback. Keep the button closed until
    // both the token-hash callback and the hosted email template have been
    // verified together. The flag records that external operational evidence;
    // it must not be inferred from the account-wide release switch.
    emailAuthEnabled: textValue(env, "VITE_EMAIL_AUTH_ENABLED") === "true"
      && textValue(env, "VITE_EMAIL_AUTH_PKCE_OPERATIONS_APPROVED") === "true"
      && textValue(env, "VITE_KILL_EMAIL_AUTH") !== "true",
    phoneAuthEnabled: textValue(env, "VITE_PHONE_AUTH_ENABLED") === "true"
      && textValue(env, "VITE_PHONE_AUTH_OPERATIONS_APPROVED") === "true"
      && textValue(env, "VITE_KILL_PHONE_AUTH") !== "true",
    privacyPolicy,
    termsOfService,
  }
}

export function accountConfig(): AccountConfig | null {
  if (typeof window !== "undefined" && isRetiredSharedAuthOrigin(window.location.hostname)) return null
  return resolveAccountConfig(import.meta.env)
}

export function accountFeatureEnabled(): boolean {
  return accountConfig() !== null
}
