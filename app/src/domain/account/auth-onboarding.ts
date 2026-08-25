import type { AccountConfig } from "./config"
import { savePrivateProfile } from "./account-service"
import type { AccountActionResult, SaveProfileInput } from "./account-service"
import { ageBandOn } from "./profile"
import type { SocialAuthProvider } from "./auth"

export type AuthMethod = SocialAuthProvider | "email"

export type PendingAccountSetup = {
  readonly schemaVersion: 1
  readonly method: AuthMethod
  readonly birthDate: string
  readonly privacyPolicyVersion: string
  readonly termsOfServiceVersion: string
  readonly createdAtMs: number
}

type StoragePort = Pick<Storage, "getItem" | "setItem" | "removeItem">

const PENDING_SETUP_KEY = "trainoracle.account.pending-setup.v1"
const SETUP_RECEIPT_KEY = "trainoracle.account.setup-receipt.v1"
const PENDING_SETUP_TTL_MS = 15 * 60 * 1000
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
}): PendingAccountSetup {
  return {
    schemaVersion: 1,
    method: input.method,
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
}

export function readPendingAccountSetup(
  storage: StoragePort = window.sessionStorage,
  nowMs = Date.now(),
): PendingAccountSetup | null {
  const raw = storage.getItem(PENDING_SETUP_KEY)
  if (raw === null) return null
  try {
    const parsed = JSON.parse(raw) as Partial<PendingAccountSetup>
    const methodValid = parsed.method === "kakao" || parsed.method === "google" || parsed.method === "email"
    const valid = parsed.schemaVersion === 1
      && methodValid
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
    if (valid) return parsed as PendingAccountSetup
  } catch {
    // 손상되거나 오래된 임시 가입 정보는 사용하지 않고 바로 폐기한다.
  }
  storage.removeItem(PENDING_SETUP_KEY)
  return null
}

export function clearPendingAccountSetup(
  storage: StoragePort = window.sessionStorage,
): void {
  storage.removeItem(PENDING_SETUP_KEY)
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

export async function finalizePendingAccountSetup(input: {
  readonly userId: string
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
