// 계정 기능 feature flag.
// VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 둘 다 있어야만 계정 기능이 켜진다.
// 없으면 앱은 기존과 100% 동일하게 동작한다 (회귀 0 보장의 핵심).

export type AccountConfig = {
  readonly url: string
  readonly anonKey: string
}

function readEnv(name: string): string {
  try {
    const env = (import.meta as unknown as { env?: Record<string, unknown> }).env
    const value = env?.[name]
    return typeof value === "string" ? value.trim() : ""
  } catch {
    return ""
  }
}

export function accountConfig(): AccountConfig | null {
  const url = readEnv("VITE_SUPABASE_URL")
  const anonKey = readEnv("VITE_SUPABASE_ANON_KEY")
  if (url === "" || anonKey === "") return null
  if (!url.startsWith("https://")) return null
  return { url, anonKey }
}

export function accountFeatureEnabled(): boolean {
  return accountConfig() !== null
}
