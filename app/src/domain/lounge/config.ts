export type LoungeConfig = {
  readonly realtimeUrl: string
  readonly pageUrl: string
}

export function publicLoungeUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.trim() === "") return null
  try {
    const url = new URL(value.trim())
    const host = url.hostname.toLowerCase()
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash
      || host === "localhost" || host.endsWith(".localhost") || host.startsWith("[")
      || host === "0.0.0.0" || /^127\./u.test(host)) return null
    return url.href
  } catch {
    return null
  }
}

export function resolveLoungeConfig(env: Readonly<Record<string, unknown>>): LoungeConfig | null {
  if (env.VITE_LOUNGE_PUBLIC_ENABLED !== "true") return null
  const realtimeUrl = publicLoungeUrl(env.VITE_LOUNGE_REALTIME_URL)
  const pageUrl = publicLoungeUrl(env.VITE_LOUNGE_PAGE_URL)
  return realtimeUrl && pageUrl ? { realtimeUrl, pageUrl } : null
}

export function loungeConfig(): LoungeConfig | null {
  return resolveLoungeConfig(import.meta.env)
}
