import { loadPrivateProfileSetupStatus } from "./account-service"
import { setAccountAuthState } from "./account-auth-state"
import { currentUser, onAuthChange } from "./auth"
import type { AccountUser } from "./auth"
import {
  isAuthSessionQuarantined,
  subscribeAuthSessionQuarantine,
} from "./auth-session-quarantine"
import { setActiveLocalAccount } from "./local-journal-ownership"

export type VerifiedAccountScopeStatus = "LOADING" | "READY" | "FAILED"

type AuthState = "RESOLVING" | "GUEST" | "FAILED"
const SCOPE_REFRESH_EVENT = "trainoracle:verified-account-scope-refresh"
export const VERIFIED_ACCOUNT_SCOPE_REFRESH_STORAGE_KEY = "trainoracle.auth.scope-refresh.v1"
let scopeRefreshRevision = 0

/** Request fresh server admission checks locally and in other same-origin tabs. */
export function requestVerifiedAccountScopeRefresh(): void {
  if (typeof window === "undefined") return
  try {
    scopeRefreshRevision += 1
    const nonce = `${Date.now()}:${scopeRefreshRevision}:${Math.random().toString(36).slice(2)}`
    window.localStorage.setItem(VERIFIED_ACCOUNT_SCOPE_REFRESH_STORAGE_KEY, nonce)
  } catch {
    // Same-tab listeners can still refresh if storage is unavailable.
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SCOPE_REFRESH_EVENT))
}

type VerifiedAccountScopeDependencies = {
  readonly currentUser: (options: { readonly throwOnFailure: true }) => Promise<AccountUser | null>
  readonly onAuthChange: (listener: (user: AccountUser | null) => void) => () => void
  readonly loadPrivateProfileSetupStatus: (input: { readonly userId: string }) => Promise<{
    readonly ok: boolean
    readonly ready: boolean
  }>
  readonly setActiveLocalAccount: (userId: string | null) => void
  readonly setAccountAuthState: (state: AuthState) => void
  readonly isQuarantined: () => boolean
  readonly subscribeQuarantine: (listener: (quarantined: boolean) => void) => () => void
}

const defaultDependencies: VerifiedAccountScopeDependencies = {
  currentUser,
  onAuthChange,
  loadPrivateProfileSetupStatus,
  setActiveLocalAccount,
  setAccountAuthState,
  isQuarantined: isAuthSessionQuarantined,
  subscribeQuarantine: subscribeAuthSessionQuarantine,
}

/**
 * Raw Supabase events are hints only. A private local scope is opened only
 * after a server-backed identity recheck and an admitted, ready profile.
 */
export function startVerifiedAccountScope(
  onStatus: (status: VerifiedAccountScopeStatus) => void,
  dependencies: VerifiedAccountScopeDependencies = defaultDependencies,
): () => void {
  let active = true
  let generation = 0

  const revoke = (status: AuthState, viewStatus: VerifiedAccountScopeStatus) => {
    generation += 1
    dependencies.setActiveLocalAccount(null)
    dependencies.setAccountAuthState(status)
    onStatus(viewStatus)
  }

  const verifyHint = async (hintedUserId: string | null) => {
    const ticket = ++generation
    dependencies.setActiveLocalAccount(null)
    dependencies.setAccountAuthState("RESOLVING")
    onStatus("LOADING")

    if (dependencies.isQuarantined()) {
      revoke("FAILED", "FAILED")
      return
    }
    if (hintedUserId === null) {
      dependencies.setAccountAuthState("GUEST")
      onStatus("READY")
      return
    }

    const stillCurrent = () => active && ticket === generation && !dependencies.isQuarantined()
    try {
      const firstCheck = await dependencies.currentUser({ throwOnFailure: true })
      if (!stillCurrent()) return
      if (firstCheck?.id !== hintedUserId) {
        revoke("FAILED", "FAILED")
        return
      }

      const setup = await dependencies.loadPrivateProfileSetupStatus({ userId: hintedUserId })
      if (!stillCurrent()) return
      if (!setup.ok || !setup.ready) {
        revoke("FAILED", "FAILED")
        return
      }

      // The setup RPC may take time. Recheck the server's current identity at
      // the activation boundary so a switched session cannot inherit scope.
      const finalCheck = await dependencies.currentUser({ throwOnFailure: true })
      if (!stillCurrent()) return
      if (finalCheck?.id !== hintedUserId) {
        revoke("FAILED", "FAILED")
        return
      }

      dependencies.setActiveLocalAccount(hintedUserId)
      dependencies.setAccountAuthState("RESOLVING")
      onStatus("READY")
    } catch {
      if (stillCurrent()) revoke("FAILED", "FAILED")
    }
  }

  const handleAuthChange = (user: AccountUser | null) => {
    // Clear the previous user's local storage namespace before verification.
    void verifyHint(user?.id ?? null)
  }
  let stopAuth: () => void = () => undefined
  const subscribeAuth = () => {
    stopAuth()
    stopAuth = dependencies.onAuthChange(handleAuthChange)
  }
  subscribeAuth()
  const stopQuarantine = dependencies.subscribeQuarantine((quarantined) => {
    if (quarantined) {
      stopAuth()
      revoke("FAILED", "FAILED")
      return
    }
    subscribeAuth()
    void verifyCurrentSession()
  })
  const onScopeRefresh = () => { void verifyCurrentSession() }
  const onCrossTabScopeRefresh = (event: StorageEvent) => {
    if (event.key === VERIFIED_ACCOUNT_SCOPE_REFRESH_STORAGE_KEY) onScopeRefresh()
  }
  if (typeof window !== "undefined") {
    window.addEventListener(SCOPE_REFRESH_EVENT, onScopeRefresh)
    window.addEventListener("storage", onCrossTabScopeRefresh)
  }

  async function verifyCurrentSession() {
    if (!active) return
    if (dependencies.isQuarantined()) {
      revoke("FAILED", "FAILED")
      return
    }
    const ticket = ++generation
    dependencies.setActiveLocalAccount(null)
    dependencies.setAccountAuthState("RESOLVING")
    onStatus("LOADING")
    try {
      const user = await dependencies.currentUser({ throwOnFailure: true })
      if (!active || ticket !== generation || dependencies.isQuarantined()) return
      void verifyHint(user?.id ?? null)
    } catch {
      if (active && ticket === generation) revoke("FAILED", "FAILED")
    }
  }

  // Initial account resolution also comes from getUser, never from cached UI
  // state or a local Supabase auth event payload.
  void verifyCurrentSession()

  return () => {
    if (!active) return
    active = false
    generation += 1
    stopAuth()
    stopQuarantine()
    if (typeof window !== "undefined") {
      window.removeEventListener(SCOPE_REFRESH_EVENT, onScopeRefresh)
      window.removeEventListener("storage", onCrossTabScopeRefresh)
    }
    dependencies.setActiveLocalAccount(null)
    dependencies.setAccountAuthState("RESOLVING")
  }
}
