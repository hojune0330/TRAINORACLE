// A verified account admission consumes this tab's return token. The result stays in the test window.
const storageKey = "trainoracle.run-bti.login-return.v1"
const lifetimeMs = 5 * 60_000
export type RunBtiLoginReturn = {entry: string; expiresAt: number}

export function isRunBtiEntry(entry: unknown): entry is string {
  return entry === "saved" || typeof entry === "string" && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/iu.test(entry)
}
export function clearRunBtiLoginReturn() {
  try { sessionStorage.removeItem(storageKey) } catch { /* Storage may be disabled. */ }
}
export function rememberRunBtiLogin(entry: string): RunBtiLoginReturn {
  const value = {entry, expiresAt: Date.now() + lifetimeMs}
  if (isRunBtiEntry(entry)) {
    try { sessionStorage.setItem(storageKey, JSON.stringify(value)) } catch { /* Same-page login still has the ref. */ }
  }
  return value
}
export function takeRunBtiLoginReturn(inMemory: RunBtiLoginReturn | null): string | null {
  try {
    const stored = inMemory ?? JSON.parse(sessionStorage.getItem(storageKey) ?? "null")
    const now = Date.now()
    return isRunBtiEntry(stored?.entry) && Number.isSafeInteger(stored.expiresAt)
      && stored.expiresAt > now && stored.expiresAt <= now + lifetimeMs ? stored.entry : null
  } catch { return null }
  finally { clearRunBtiLoginReturn() }
}
