// 계정 기능 공개 게이트.
// 자격 정보 2개와 별도의 출시 승인 값이 모두 있어야 계정 기능이 켜진다.
// 키를 미리 등록해도 출시 승인이 없으면 로컬 전용 앱으로 남는다.

export type AccountConfig = {
  readonly url: string
  readonly anonKey: string
  readonly privacyPolicy: AccountLegalDocument
  readonly termsOfService: AccountLegalDocument
}

export type AccountLegalDocument = {
  readonly url: string
  readonly version: string
}

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
    url === "" || anonKey === ""
    || privacyPolicy.url === "" || privacyPolicy.version === ""
    || termsOfService.url === "" || termsOfService.version === ""
  ) return null
  if (!url.startsWith("https://")) return null
  if (!privacyPolicy.url.startsWith("https://") || !termsOfService.url.startsWith("https://")) return null
  return { url, anonKey, privacyPolicy, termsOfService }
}

export function accountConfig(): AccountConfig | null {
  return resolveAccountConfig(import.meta.env)
}

export function accountFeatureEnabled(): boolean {
  return accountConfig() !== null
}
