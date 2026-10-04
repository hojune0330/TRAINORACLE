export const RETIRED_SHARED_AUTH_HOST = "hojune0330.github.io"
const AUTH_STORAGE_KEYS = ["trainoracle.auth.v1", "trainoracle.auth.v1-code-verifier"] as const
const ACCOUNT_LOCAL_HINT_KEYS = [
  "trainoracle.account.setup-receipt.v1",
  "trainoracle.auth.quarantine.v1",
  "trainoracle.account.email-browser-proof.v1",
] as const
const ACCOUNT_SESSION_KEYS = ["trainoracle.account.pending-setup.v1"] as const

export function isRetiredSharedAuthOrigin(hostname: string): boolean {
  return hostname.trim().toLowerCase() === RETIRED_SHARED_AUTH_HOST
}

/** Remove only authentication/onboarding state; local journals and plans are never deleted. */
export function retireSharedOriginAuthCredentials(
  localStorage: Pick<Storage, "removeItem">,
  sessionStorage: Pick<Storage, "removeItem">,
  hostname: string,
): boolean {
  if (!isRetiredSharedAuthOrigin(hostname)) return false
  for (const key of [...AUTH_STORAGE_KEYS, ...ACCOUNT_LOCAL_HINT_KEYS]) {
    try { localStorage.removeItem(key) } catch { /* Continue with the other exact keys. */ }
  }
  for (const key of ACCOUNT_SESSION_KEYS) {
    try { sessionStorage.removeItem(key) } catch { /* Account runtime stays disabled on this host. */ }
  }
  return true
}
