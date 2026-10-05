import type { AccountConfig } from "./config"
import { savePrivateProfile } from "./account-service"
import type { AccountActionResult, SaveProfileInput } from "./account-service"
import { ageBandOn } from "./profile"
import type { SocialAuthProvider } from "./auth"

export type AuthMethod = SocialAuthProvider | "email" | "phone"

export type PendingAccountSetup = {
  readonly schemaVersion: 4
  readonly attemptId: string
  readonly method: AuthMethod
  readonly phase: "PREPARED" | "AUTH_STARTED" | "AUTH_VERIFIED"
  /**
   * 인증 제공자가 돌려준 실제 사용자 ID. AUTH_VERIFIED에서만 존재하며,
   * 프로필 저장 RPC의 expected_user_id와 같은 값이어야 한다.
   */
  readonly verifiedUserId: string | null
  /** The callback/code-verification path that proved the user ID. */
  readonly verifiedMethod: AuthMethod | null
  /** Supabase session_id signed into the exact token returned by that operation. */
  readonly verifiedSessionId: string | null
  /** 이메일 링크를 직접 요청한 사람이 입력한 주소. 링크 전달 로그인 공격을 막는 데 사용한다. */
  readonly expectedEmail: string | null
  readonly birthDate: string
  readonly privacyPolicyVersion: string
  readonly termsOfServiceVersion: string
  readonly createdAtMs: number
}

type StoragePort = Pick<Storage, "getItem" | "setItem" | "removeItem">

const PENDING_SETUP_KEY = "trainoracle.account.pending-setup.v1"
const SETUP_RECEIPT_KEY = "trainoracle.account.setup-receipt.v1"
const PENDING_SETUP_TTL_MS = 15 * 60 * 1000
const AUTH_ATTEMPT_ID_PATTERN = /^[a-f0-9]{32}$/u
const VERIFIED_USER_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]{0,127}$/u
const VERIFIED_SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu
let pendingExpiryTimer: ReturnType<typeof setTimeout> | null = null

function clearPendingExpiryTimer(): void {
  if (pendingExpiryTimer === null) return
  clearTimeout(pendingExpiryTimer)
  pendingExpiryTimer = null
}

function schedulePendingExpiry(
  pending: PendingAccountSetup,
  storage: StoragePort,
): void {
  if (typeof window === "undefined" || storage !== window.sessionStorage) return
  clearPendingExpiryTimer()
  const remainingMs = Math.max(0, pending.createdAtMs + PENDING_SETUP_TTL_MS - Date.now())
  pendingExpiryTimer = setTimeout(() => {
    pendingExpiryTimer = null
    clearPendingAccountSetupForAttempt(pending.attemptId, storage)
  }, remainingMs)
}

function newAuthAttemptId(): string {
  const bytes = new Uint8Array(16)
  globalThis.crypto.getRandomValues(bytes)
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("")
}

export function isAuthAttemptId(value: unknown): value is string {
  return typeof value === "string" && AUTH_ATTEMPT_ID_PATTERN.test(value)
}

export function normalizeAuthEmail(value: string): string | null {
  const normalized = value.trim().toLowerCase()
  if (normalized.length < 3 || normalized.length > 254 || /[\s\u0000-\u001f\u007f]/u.test(normalized)) return null
  const at = normalized.indexOf("@")
  if (at <= 0 || at !== normalized.lastIndexOf("@") || at >= normalized.length - 1) return null
  return normalized
}

export function onlineAccountEligibility(
  birthDate: string,
  today: string,
): "ELIGIBLE" | "UNDER_14" | "INVALID" {
  try {
    return ageBandOn(birthDate, today) === "AGE_14_OR_OVER" ? "ELIGIBLE" : "UNDER_14"
  } catch {
    return "INVALID"
  }
}

export function createPendingAccountSetup(input: {
  readonly method: AuthMethod
  readonly birthDate: string
  readonly config: AccountConfig
  readonly createdAtMs?: number
  readonly attemptId?: string
  readonly expectedEmail?: string
}): PendingAccountSetup {
  const attemptId = input.attemptId ?? newAuthAttemptId()
  if (!isAuthAttemptId(attemptId)) throw new Error("INVALID_AUTH_ATTEMPT_ID")
  const expectedEmail = input.method === "email" && input.expectedEmail !== undefined
    ? normalizeAuthEmail(input.expectedEmail)
    : null
  if (input.method === "email" && input.expectedEmail !== undefined && expectedEmail === null) {
    throw new Error("INVALID_AUTH_EMAIL")
  }
  return {
    schemaVersion: 4,
    attemptId,
    method: input.method,
    phase: "PREPARED",
    verifiedUserId: null,
    verifiedMethod: null,
    verifiedSessionId: null,
    expectedEmail,
    birthDate: input.birthDate,
    privacyPolicyVersion: input.config.privacyPolicy.version,
    termsOfServiceVersion: input.config.termsOfService.version,
    createdAtMs: input.createdAtMs ?? Date.now(),
  }
}

export function writePendingAccountSetup(
  pending: PendingAccountSetup,
  storage: StoragePort = window.sessionStorage,
): void {
  storage.setItem(PENDING_SETUP_KEY, JSON.stringify(pending))
  schedulePendingExpiry(pending, storage)
}

export function readPendingAccountSetup(
  storage: StoragePort = window.sessionStorage,
  nowMs = Date.now(),
): PendingAccountSetup | null {
  const raw = storage.getItem(PENDING_SETUP_KEY)
  if (raw === null) return null
  try {
    const parsed = JSON.parse(raw) as Partial<PendingAccountSetup>
    const methodValid = parsed.method === "kakao"
      || parsed.method === "google"
      || parsed.method === "email"
      || parsed.method === "phone"
    const verifiedUserIdValid = parsed.phase === "AUTH_VERIFIED"
      ? typeof parsed.verifiedUserId === "string" && VERIFIED_USER_ID_PATTERN.test(parsed.verifiedUserId)
      : parsed.verifiedUserId === null
    const verifiedMethodValid = parsed.phase === "AUTH_VERIFIED"
      ? parsed.verifiedMethod === parsed.method
      : parsed.verifiedMethod === null
    const verifiedSessionIdValid = parsed.phase === "AUTH_VERIFIED"
      ? typeof parsed.verifiedSessionId === "string" && VERIFIED_SESSION_ID_PATTERN.test(parsed.verifiedSessionId)
      : parsed.verifiedSessionId === null
    const normalizedExpectedEmail = typeof parsed.expectedEmail === "string"
      ? normalizeAuthEmail(parsed.expectedEmail)
      : null
    const expectedEmailValid = parsed.expectedEmail === undefined
      || parsed.expectedEmail === null
      || normalizedExpectedEmail !== null && normalizedExpectedEmail === parsed.expectedEmail
    const valid = parsed.schemaVersion === 4
      && isAuthAttemptId(parsed.attemptId)
      && methodValid
      && (parsed.phase === "PREPARED" || parsed.phase === "AUTH_STARTED" || parsed.phase === "AUTH_VERIFIED")
      && verifiedUserIdValid
      && verifiedMethodValid
      && verifiedSessionIdValid
      && expectedEmailValid
      && typeof parsed.birthDate === "string"
      && /^\d{4}-\d{2}-\d{2}$/u.test(parsed.birthDate)
      && typeof parsed.privacyPolicyVersion === "string"
      && parsed.privacyPolicyVersion.length > 0
      && typeof parsed.termsOfServiceVersion === "string"
      && parsed.termsOfServiceVersion.length > 0
      && typeof parsed.createdAtMs === "number"
      && Number.isFinite(parsed.createdAtMs)
      && parsed.createdAtMs <= nowMs
      && nowMs - parsed.createdAtMs <= PENDING_SETUP_TTL_MS
    if (valid) {
      const pending = { ...parsed, expectedEmail: normalizedExpectedEmail } as PendingAccountSetup
      schedulePendingExpiry(pending, storage)
      return pending
    }
  } catch {
    // 손상되거나 오래된 임시 가입 정보는 사용하지 않고 바로 폐기한다.
  }
  storage.removeItem(PENDING_SETUP_KEY)
  return null
}

export function clearPendingAccountSetup(
  storage: StoragePort = window.sessionStorage,
): void {
  if (typeof window !== "undefined" && storage === window.sessionStorage) clearPendingExpiryTimer()
  storage.removeItem(PENDING_SETUP_KEY)
}

function transitionPendingAccountSetup(
  attemptId: string,
  from: readonly PendingAccountSetup["phase"][],
  to: PendingAccountSetup["phase"],
  storage: StoragePort = window.sessionStorage,
): boolean {
  const pending = readPendingAccountSetup(storage)
  if (pending === null || pending.attemptId !== attemptId || !from.includes(pending.phase)) return false
  writePendingAccountSetup({
    ...pending,
    phase: to,
    verifiedUserId: null,
    verifiedMethod: null,
    verifiedSessionId: null,
  }, storage)
  return true
}

export function markPendingAccountAuthStarted(
  attemptId: string,
  storage: StoragePort = window.sessionStorage,
): boolean {
  return transitionPendingAccountSetup(attemptId, ["PREPARED"], "AUTH_STARTED", storage)
}

export function markPendingAccountAuthVerified(
  attemptId: string,
  verifiedUserId: string,
  verifiedMethod: Exclude<AuthMethod, "email">,
  verifiedSessionId: string,
  storage: StoragePort = window.sessionStorage,
): boolean {
  if (!VERIFIED_USER_ID_PATTERN.test(verifiedUserId) || !VERIFIED_SESSION_ID_PATTERN.test(verifiedSessionId)) return false
  const pending = readPendingAccountSetup(storage)
  if (pending === null || pending.attemptId !== attemptId || pending.method !== verifiedMethod) return false
  if (pending.phase === "AUTH_VERIFIED") {
    return pending.verifiedUserId === verifiedUserId
      && pending.verifiedMethod === verifiedMethod
      && pending.verifiedSessionId === verifiedSessionId
  }
  if (pending.phase !== "AUTH_STARTED") return false
  writePendingAccountSetup({
    ...pending,
    phase: "AUTH_VERIFIED",
    verifiedUserId,
    verifiedMethod,
    verifiedSessionId,
  }, storage)
  return true
}

export function markPendingEmailAuthVerified(
  attemptId: string,
  verifiedUserId: string,
  verifiedEmail: string,
  verifiedSessionId: string,
  storage: StoragePort = window.sessionStorage,
): boolean {
  if (!VERIFIED_USER_ID_PATTERN.test(verifiedUserId) || !VERIFIED_SESSION_ID_PATTERN.test(verifiedSessionId)) return false
  const normalizedEmail = normalizeAuthEmail(verifiedEmail)
  const pending = readPendingAccountSetup(storage)
  if (
    normalizedEmail === null
    || pending === null
    || pending.attemptId !== attemptId
    || pending.method !== "email"
    || pending.phase !== "AUTH_STARTED"
    || pending.expectedEmail === null
    || pending.expectedEmail !== normalizedEmail
  ) return false
  writePendingAccountSetup({
    ...pending,
    phase: "AUTH_VERIFIED",
    verifiedUserId,
    verifiedMethod: "email",
    verifiedSessionId,
  }, storage)
  return true
}

export function clearPendingAccountSetupForAttempt(
  attemptId: string,
  storage: StoragePort = window.sessionStorage,
): void {
  const pending = readPendingAccountSetup(storage)
  if (pending?.attemptId === attemptId) clearPendingAccountSetup(storage)
}

export function hasCurrentSetupReceipt(
  userId: string,
  config: AccountConfig,
  storage: StoragePort = window.localStorage,
): boolean {
  const raw = storage.getItem(SETUP_RECEIPT_KEY)
  if (raw === null) return false
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return parsed.schemaVersion === 1
      && parsed.userId === userId
      && parsed.privacyPolicyVersion === config.privacyPolicy.version
      && parsed.termsOfServiceVersion === config.termsOfService.version
  } catch {
    storage.removeItem(SETUP_RECEIPT_KEY)
    return false
  }
}

export function writeCurrentSetupReceipt(
  userId: string,
  config: AccountConfig,
  storage: StoragePort = window.localStorage,
): void {
  storage.setItem(SETUP_RECEIPT_KEY, JSON.stringify({
    schemaVersion: 1,
    userId,
    privacyPolicyVersion: config.privacyPolicy.version,
    termsOfServiceVersion: config.termsOfService.version,
    completedAtMs: Date.now(),
  }))
}

/**
 * Removes only the current account's local completion hint.
 *
 * This receipt is not an authorization decision, but leaving it behind after a
 * logout or deletion can make the next visit look as though setup was already
 * confirmed. A malformed receipt is also removed rather than trusted.
 */
export function clearCurrentSetupReceipt(
  userId: string,
  storage: StoragePort = window.localStorage,
): void {
  const raw = storage.getItem(SETUP_RECEIPT_KEY)
  if (raw === null) return
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (parsed.userId === userId) storage.removeItem(SETUP_RECEIPT_KEY)
  } catch {
    storage.removeItem(SETUP_RECEIPT_KEY)
  }
}

export async function finalizePendingAccountSetup(input: {
  readonly userId: string
  readonly returnAttemptId: string | null
  readonly today: string
  readonly config: AccountConfig
  readonly sessionStorage?: StoragePort
  readonly localStorage?: StoragePort
  readonly onSaveProfile?: (profile: SaveProfileInput) => Promise<AccountActionResult>
}): Promise<{ readonly attempted: boolean; readonly result: AccountActionResult | null }> {
  const sessionStorage = input.sessionStorage ?? window.sessionStorage
  const localStorage = input.localStorage ?? window.localStorage
  const pending = readPendingAccountSetup(sessionStorage)
  if (pending === null) return { attempted: false, result: null }

  const verifiedUserMatches = pending.phase === "AUTH_VERIFIED"
    && pending.verifiedUserId === input.userId
    && pending.verifiedMethod === pending.method
    && pending.verifiedSessionId !== null
  const redirectFlowMatches = pending.method !== "phone"
    && verifiedUserMatches
    && input.returnAttemptId === pending.attemptId
  const verifiedPhoneMatches = pending.method === "phone"
    && verifiedUserMatches
    && input.returnAttemptId === null
  if (!verifiedUserMatches || (!redirectFlowMatches && !verifiedPhoneMatches)) {
    clearPendingAccountSetup(sessionStorage)
    return { attempted: false, result: null }
  }

  if (
    pending.privacyPolicyVersion !== input.config.privacyPolicy.version
    || pending.termsOfServiceVersion !== input.config.termsOfService.version
  ) {
    clearPendingAccountSetup(sessionStorage)
    return {
      attempted: true,
      result: { ok: false, message: "약관이 바뀌었어요. 가입 확인을 다시 진행해 주세요." },
    }
  }
  if (onlineAccountEligibility(pending.birthDate, input.today) !== "ELIGIBLE") {
    clearPendingAccountSetup(sessionStorage)
    return {
      attempted: true,
      result: { ok: false, message: "온라인 계정은 만 14세부터 만들 수 있어요." },
    }
  }

  const result = await (input.onSaveProfile ?? savePrivateProfile)({
    userId: input.userId,
    expectedSessionId: pending.verifiedSessionId,
    birthDate: pending.birthDate,
    privacyPolicyVersion: pending.privacyPolicyVersion,
    termsOfServiceVersion: pending.termsOfServiceVersion,
  })
  if (result.ok) {
    writeCurrentSetupReceipt(input.userId, input.config, localStorage)
    clearPendingAccountSetup(sessionStorage)
  }
  return { attempted: true, result }
}
