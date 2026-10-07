import { z } from "zod"
import { supabase } from "./supabase-client"
import { verifyReturnedAuthSession } from "./verified-auth-session"
import { holdStorageTransmission, releaseStorageTransmissionHold, isStorageTransmissionHeld } from "./storage-transmission-hold"
import { forgetStorageConsentRevision, rememberStorageConsentRevision } from "./storage-consent-revision"
import { accountDeletionBoundaryState, isAccountDeletionClosed, onAccountDeletionBoundaryChange } from "./account-deletion-boundary"

export const STORAGE_CONSENT_VERSION = "2026-10-05"
export const storageConsentSchema = z.object({
  userId: z.uuid(), revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER - 1),
  purposeVersion: z.literal(STORAGE_CONSENT_VERSION),
  healthStorage: z.boolean(), journalTextStorage: z.boolean(),
  decidedAt: z.string().nullable(), operationsReady: z.boolean(),
  liveErasedAt: z.string().datetime({ offset: true }).nullable(), backupStatus: z.enum(["PENDING", "VERIFIED"]).nullable(),
}).strict()
export type StorageConsent = z.infer<typeof storageConsentSchema>
export type StorageConsentResult = { ok: true; consent: StorageConsent } | { ok: false; message: string }
const pausedAccounts = new Map<string, boolean>()
onAccountDeletionBoundaryChange(owner => {
  pausedAccounts.set(owner, true)
  forgetStorageConsentRevision(owner)
})
const deletedResult: StorageConsentResult = { ok: false, message: "삭제를 요청한 계정의 전송은 다시 시작하지 않아요. 기기 기록과 미전송 자료는 그대로 보관돼 있어요." }

// An admission check resolves this before activating a real local account scope.
// This is UI state only; the transport and database independently require consent.
export function isAccountStoragePaused(userId: string | null): boolean {
  return userId !== null && (accountDeletionBoundaryState(userId) !== "OPEN" || pausedAccounts.get(userId) === true || isStorageTransmissionHeld(userId))
}
function remember(consent: StorageConsent) {
  if (isAccountDeletionClosed(consent.userId)) return
  rememberStorageConsentRevision(consent.userId, consent.revision)
  pausedAccounts.set(consent.userId, !consent.healthStorage || !consent.journalTextStorage || !consent.operationsReady)
}

export async function loadAccountStorageConsent(userId: string): Promise<StorageConsentResult> {
  if (isAccountDeletionClosed(userId)) return deletedResult
  pausedAccounts.set(userId, true)
  try {
    if (accountDeletionBoundaryState(userId) === "UNKNOWN") throw new Error("local boundary unavailable")
    const client = await supabase()
    if (isAccountDeletionClosed(userId)) return deletedResult
    if (!client) throw new Error("unavailable")
    const { data, error } = await client.rpc("get_account_storage_consent", { expected_user_id_input: userId })
    if (isAccountDeletionClosed(userId)) return deletedResult
    if (accountDeletionBoundaryState(userId) === "UNKNOWN") throw new Error("local boundary unavailable")
    const parsed = storageConsentSchema.safeParse(data)
    if (error || !parsed.success || parsed.data.userId !== userId) throw new Error("unavailable")
    remember(parsed.data)
    return { ok: true, consent: parsed.data }
  } catch {
    return { ok: false, message: "온라인 보관 동의를 확인하지 못해 전송을 멈췄어요. 기기 기록은 그대로예요." }
  }
}

export async function saveAccountStorageConsent(
  previous: StorageConsent, healthStorage: boolean, journalTextStorage: boolean,
): Promise<StorageConsentResult> {
  if (isAccountDeletionClosed(previous.userId)) return deletedResult
  // Stop local transmission immediately, including when the withdrawal request fails.
  if (!healthStorage || !journalTextStorage) {
    pausedAccounts.set(previous.userId, true)
    holdStorageTransmission(previous.userId)
  }
  try {
    if (accountDeletionBoundaryState(previous.userId) === "UNKNOWN") throw new Error("local boundary unavailable")
    const client = await supabase()
    if (isAccountDeletionClosed(previous.userId)) return deletedResult
    if (!client) throw new Error("unavailable")
    const { data: session, error: sessionError } = await client.auth.getSession()
    if (sessionError || session.session?.user.id !== previous.userId) throw new Error("identity")
    const token = session.session.access_token
    const sessionId = await verifyReturnedAuthSession(client, { accessToken: token, expectedUserId: previous.userId })
    if (!sessionId) throw new Error("identity")
    if (isAccountDeletionClosed(previous.userId)) return deletedResult
    if (accountDeletionBoundaryState(previous.userId) === "UNKNOWN") throw new Error("local boundary unavailable")
    const { data, error } = await client.rpc("set_account_storage_consent", {
      expected_user_id_input: previous.userId, expected_session_id_input: sessionId,
      expected_revision_input: previous.revision, purpose_version_input: STORAGE_CONSENT_VERSION,
      health_storage_input: healthStorage, journal_text_storage_input: journalTextStorage,
    })
    if (isAccountDeletionClosed(previous.userId)) return deletedResult
    if (accountDeletionBoundaryState(previous.userId) === "UNKNOWN") throw new Error("local boundary unavailable")
    const parsed = storageConsentSchema.safeParse(data)
    if (error || !parsed.success || parsed.data.userId !== previous.userId
      || parsed.data.revision !== previous.revision + 1
      || ((!healthStorage || !journalTextStorage) && parsed.data.liveErasedAt === null)
      || parsed.data.healthStorage !== healthStorage || parsed.data.journalTextStorage !== journalTextStorage) throw new Error("changed")
    releaseStorageTransmissionHold(previous.userId)
    remember(parsed.data)
    return { ok: true, consent: parsed.data }
  } catch {
    return { ok: false, message: "서버에서 동의 변경과 자료 삭제 결과를 확인하지 못했어요. 기기 전송은 멈춰 있으며, 현재 상태를 확인하고 철회를 다시 요청해 주세요." }
  }
}
