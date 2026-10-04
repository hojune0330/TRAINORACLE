export const AUTH_SESSION_QUARANTINE_KEY = "trainoracle.auth.quarantine.v1"

const ATTEMPT_ID_PATTERN = /^[a-f0-9]{32}$/u
const METHODS = ["email", "phone", "kakao", "google"] as const
const SAME_TAB_EVENT = "trainoracle:auth-session-quarantine"
const ORIGIN_AUTH_LOCK = "trainoracle.auth-session-quarantine.v1"

export type AuthSessionQuarantineMethod = typeof METHODS[number]

export function authSessionQuarantineLockAvailable(): boolean {
  return typeof navigator !== "undefined" && navigator.locks?.request !== undefined
}

/** Serializes exchange, cleanup, and recovery across every same-origin tab. */
export async function withAuthSessionQuarantineLock<T>(operation: () => Promise<T>): Promise<T> {
  if (!authSessionQuarantineLockAvailable()) return operation()
  return navigator.locks.request(ORIGIN_AUTH_LOCK, { mode: "exclusive" }, operation)
}

type AuthSessionQuarantineMarker = {
  readonly schemaVersion: 1
  readonly attemptId: string
  readonly method: AuthSessionQuarantineMethod
  readonly phase: "PRE_EXCHANGE" | "SESSION_MAY_EXIST"
  readonly createdAtMs: number
}

function browserStorage(): Storage | null {
  return typeof window === "undefined" ? null : window.localStorage
}

function validMarker(value: unknown): value is AuthSessionQuarantineMarker {
  if (typeof value !== "object" || value === null) return false
  const candidate = value as Partial<AuthSessionQuarantineMarker>
  return candidate.schemaVersion === 1
    && typeof candidate.attemptId === "string"
    && ATTEMPT_ID_PATTERN.test(candidate.attemptId)
    && METHODS.includes(candidate.method as AuthSessionQuarantineMethod)
    && (candidate.phase === "PRE_EXCHANGE" || candidate.phase === "SESSION_MAY_EXIST")
    && typeof candidate.createdAtMs === "number"
    && Number.isFinite(candidate.createdAtMs)
    && candidate.createdAtMs > 0
}

function readRawMarker(): { readonly quarantined: boolean; readonly marker: AuthSessionQuarantineMarker | null } {
  const storage = browserStorage()
  if (storage === null) return { quarantined: false, marker: null }
  try {
    const raw = storage.getItem(AUTH_SESSION_QUARANTINE_KEY)
    if (raw === null) return { quarantined: false, marker: null }
    try {
      const parsed: unknown = JSON.parse(raw)
      return validMarker(parsed)
        ? { quarantined: true, marker: parsed }
        : { quarantined: true, marker: null }
    } catch {
      // A corrupt marker is not permission to reopen private account data.
      return { quarantined: true, marker: null }
    }
  } catch {
    // If the browser will not let us inspect the guard, keep account access closed.
    return { quarantined: true, marker: null }
  }
}

function notifySameTab(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(SAME_TAB_EVENT))
}

/**
 * Persist the guard before an operation that can install a Supabase session.
 * Existing or malformed guards are never overwritten by a different attempt.
 */
export function beginAuthSessionQuarantine(input: {
  readonly attemptId: string
  readonly method: AuthSessionQuarantineMethod
}): boolean {
  // 세션 교환과 로그아웃을 탭 전체에서 직렬화할 수 없는 브라우저에서는
  // 인증을 시작하지 않는다. 락 없이 진행하면 로그아웃 직후 다른 탭의
  // 콜백이 세션을 다시 설치하는 경쟁 상태를 막을 수 없다.
  if (!authSessionQuarantineLockAvailable()) return false
  if (!ATTEMPT_ID_PATTERN.test(input.attemptId) || !METHODS.includes(input.method)) return false
  const storage = browserStorage()
  if (storage === null) return false
  const current = readRawMarker()
  if (current.quarantined && (
    current.marker === null
    || current.marker.attemptId !== input.attemptId
    || current.marker.method !== input.method
  )) return false
  const marker: AuthSessionQuarantineMarker = {
    schemaVersion: 1,
    attemptId: input.attemptId,
    method: input.method,
    phase: current.marker?.phase ?? "PRE_EXCHANGE",
    createdAtMs: current.marker?.createdAtMs ?? Date.now(),
  }
  try {
    storage.setItem(AUTH_SESSION_QUARANTINE_KEY, JSON.stringify(marker))
    const persisted = readRawMarker().marker
    if (persisted?.attemptId !== marker.attemptId || persisted.method !== marker.method) return false
    notifySameTab()
    return true
  } catch {
    return false
  }
}

/** Promote immediately before invoking an Auth API that may install a session. */
export function markAuthSessionExchangeStarted(attemptId: string): boolean {
  if (!ATTEMPT_ID_PATTERN.test(attemptId)) return false
  const storage = browserStorage()
  if (storage === null) return false
  const current = readRawMarker()
  if (current.marker?.attemptId !== attemptId) return false
  try {
    storage.setItem(AUTH_SESSION_QUARANTINE_KEY, JSON.stringify({
      ...current.marker,
      phase: "SESSION_MAY_EXIST",
    } satisfies AuthSessionQuarantineMarker))
    const persisted = readRawMarker().marker
    if (persisted?.attemptId !== attemptId || persisted.phase !== "SESSION_MAY_EXIST") return false
    notifySameTab()
    return true
  } catch {
    return false
  }
}

export function authSessionQuarantinePhase(): AuthSessionQuarantineMarker["phase"] | "UNKNOWN" | null {
  const current = readRawMarker()
  if (!current.quarantined) return null
  return current.marker?.phase ?? "UNKNOWN"
}

export function isAuthSessionQuarantined(): boolean {
  return readRawMarker().quarantined
}

/** Clear only the attempt that created the guard, and verify the removal. */
export function clearAuthSessionQuarantine(attemptId: string): boolean {
  if (!ATTEMPT_ID_PATTERN.test(attemptId)) return false
  const storage = browserStorage()
  if (storage === null) return false
  const current = readRawMarker()
  if (!current.quarantined) return true
  if (current.marker?.attemptId !== attemptId) return false
  try {
    storage.removeItem(AUTH_SESSION_QUARANTINE_KEY)
    if (readRawMarker().quarantined) return false
    notifySameTab()
    return true
  } catch {
    return false
  }
}

/** A confirmed local/global sign-out may clear even a corrupt or stale guard. */
export function clearAuthSessionQuarantineAfterConfirmedSignOut(): boolean {
  const storage = browserStorage()
  if (storage === null) return false
  try {
    storage.removeItem(AUTH_SESSION_QUARANTINE_KEY)
    if (readRawMarker().quarantined) return false
    notifySameTab()
    return true
  } catch {
    return false
  }
}

/** Listen to both this tab's changes and cross-tab localStorage events. */
export function subscribeAuthSessionQuarantine(listener: (quarantined: boolean) => void): () => void {
  if (typeof window === "undefined") return () => undefined
  const onSameTab = () => listener(isAuthSessionQuarantined())
  const onStorage = (event: StorageEvent) => {
    if (event.key === AUTH_SESSION_QUARANTINE_KEY || event.key === null) onSameTab()
  }
  window.addEventListener(SAME_TAB_EVENT, onSameTab)
  window.addEventListener("storage", onStorage)
  return () => {
    window.removeEventListener(SAME_TAB_EVENT, onSameTab)
    window.removeEventListener("storage", onStorage)
  }
}
