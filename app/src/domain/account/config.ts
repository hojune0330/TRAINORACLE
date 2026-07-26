// 계정 기능 공개 게이트.
// 자격 정보 2개와 별도의 출시 승인 값이 모두 있어야 계정 기능이 켜진다.
// 키를 미리 등록해도 출시 승인이 없으면 로컬 전용 앱으로 남는다.

export type AccountConfig = {
  readonly url: string
  readonly anonKey: string
}

function textValue(env: Readonly<Record<string, unknown>>, name: string): string {
  const value = env[name]
  return typeof value === "string" ? value.trim() : ""
}

export function resolveAccountConfig(env: Readonly<Record<string, unknown>>): AccountConfig | null {
  if (textValue(env, "VITE_ACCOUNT_PUBLIC_ENABLED") !== "true") return null

  const url = textValue(env, "VITE_SUPABASE_URL")
  const anonKey = textValue(env, "VITE_SUPABASE_ANON_KEY")
  if (url === "" || anonKey === "") return null
  if (!url.startsWith("https://")) return null
  return { url, anonKey }
}

export function accountConfig(): AccountConfig | null {
  try {
    const env = (import.meta as unknown as { env?: Record<string, unknown> }).env
    return resolveAccountConfig(env ?? {})
  } catch {
    return null
  }
}

export function accountFeatureEnabled(): boolean {
  return accountConfig() !== null
}
