/** Local terminal notice, not server deletion/backup completion or authentication.
 * Keep every device draft, ciphertext, fixed operation and key intact. A deleted
 * account's jobs must never borrow a later login/consent, including in another tab.
 */
export const ACCOUNT_DELETION_BOUNDARY_PREFIX = "trainoracle.account.deletion-requested.v1:"
const CHANGED_EVENT = "trainoracle:account-deletion-boundary-changed"
const closedOwners = new Set<string>()

export type AccountDeletionBoundaryState = "OPEN" | "CLOSED" | "UNKNOWN"
export function accountDeletionBoundaryState(userId: string): AccountDeletionBoundaryState {
  if (closedOwners.has(userId)) return "CLOSED"
  try {
    // Even a damaged existing marker fails closed; its content grants no access.
    if (localStorage.getItem(ACCOUNT_DELETION_BOUNDARY_PREFIX + encodeURIComponent(userId)) !== null) {
      closedOwners.add(userId)
      return "CLOSED"
    }
    return "OPEN"
  } catch { return "UNKNOWN" } // an unreadable notice is never proof of an open owner
}
export function isAccountDeletionClosed(userId: string): boolean {
  return accountDeletionBoundaryState(userId) === "CLOSED"
}

/** Monotonic for one owner: deletion is terminal and has no client-side reopen. */
export function accountDeletionGeneration(userId: string): number {
  return isAccountDeletionClosed(userId) ? 1 : 0
}

export function closeAccountDeletionBoundary(userId: string, requestedAt: string): void {
  if (userId === "") return
  closedOwners.add(userId)
  try {
    // Non-content owner/timestamp only; never a journal, token or profile copy.
    localStorage.setItem(ACCOUNT_DELETION_BOUNDARY_PREFIX + encodeURIComponent(userId), requestedAt)
  } catch { /* the immediate in-memory terminal boundary remains */ }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<string>(CHANGED_EVENT, { detail: userId }))
  }
}

export function onAccountDeletionBoundaryChange(listener: (userId: string) => void): () => void {
  if (typeof window === "undefined") return () => undefined
  const onChanged = (event: Event) => listener((event as CustomEvent<string>).detail)
  const onStorage = (event: StorageEvent) => {
    if (!event.key?.startsWith(ACCOUNT_DELETION_BOUNDARY_PREFIX) || event.newValue === null) return
    try {
      const userId = decodeURIComponent(event.key.slice(ACCOUNT_DELETION_BOUNDARY_PREFIX.length))
      if (userId === "") return
      closedOwners.add(userId)
      listener(userId)
    } catch { /* malformed foreign metadata cannot identify a scope */ }
  }
  window.addEventListener(CHANGED_EVENT, onChanged)
  window.addEventListener("storage", onStorage)
  return () => {
    window.removeEventListener(CHANGED_EVENT, onChanged)
    window.removeEventListener("storage", onStorage)
  }
}
