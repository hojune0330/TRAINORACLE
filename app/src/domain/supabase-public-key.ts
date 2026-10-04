/**
 * Accept only Supabase keys intended for untrusted browser clients.
 * Never include the rejected value in an error or log.
 */
export function isSupabasePublicClientKey(value: string): boolean {
  const key = value.trim()
  if (/^sb_publishable_[A-Za-z0-9_-]{20,}$/u.test(key)) return true
  if (key.startsWith("sb_secret_")) return false
  const parts = key.split(".")
  if (parts.length !== 3) return false
  try {
    const normalized = (parts[1] ?? "").replace(/-/gu, "+").replace(/_/gu, "/")
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")
    const payload = JSON.parse(globalThis.atob(padded)) as Record<string, unknown>
    return payload.role === "anon"
  } catch {
    return false
  }
}
