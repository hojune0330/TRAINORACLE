import { z } from "zod"
import { supabase } from "./supabase-client"
import { verifyReturnedAuthSession } from "./verified-auth-session"
import { holdStorageTransmission, releaseStorageTransmissionHold, isStorageTransmissionHeld } from "./storage-transmission-hold"

export const STORAGE_CONSENT_VERSION = "2026-10-05"
export const storageConsentSchema = z.object({
  userId: z.uuid(), revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER - 1),
  purposeVersion: z.literal(STORAGE_CONSENT_VERSION),
  healthStorage: z.boolean(), journalTextStorage: z.boolean(),
  decidedAt: z.string().nullable(), operationsReady: z.boolean(),
}).strict()
export type StorageConsent = z.infer<typeof storageConsentSchema>
export type StorageConsentResult = { ok: true; consent: StorageConsent } | { ok: false; message: string }
const pausedAccounts = new Map<string, boolean>()

// An admission check resolves this before activating a real local account scope.
// This is UI state only; the transport and database independently require consent.
export function isAccountStoragePaused(userId: string | null): boolean {
  return userId !== null && (pausedAccounts.get(userId) === true || isStorageTransmissionHeld(userId))
}
function remember(consent: StorageConsent) {
  pausedAccounts.set(consent.userId, !consent.healthStorage || !consent.journalTextStorage || !consent.operationsReady)
}

export async function loadAccountStorageConsent(userId: string): Promise<StorageConsentResult> {
  pausedAccounts.set(userId, true)
  try {
    const client = await supabase()
    if (!client) throw new Error("unavailable")
    const { data, error } = await client.rpc("get_account_storage_consent", { expected_user_id_input: userId })
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
  // Stop local transmission immediately, including when the withdrawal request fails.
  if (!healthStorage || !journalTextStorage) {
    pausedAccounts.set(previous.userId, true)
    holdStorageTransmission(previous.userId)
  }
  try {
    const client = await supabase()
    if (!client) throw new Error("unavailable")
    const { data: session, error: sessionError } = await client.auth.getSession()
    if (sessionError || session.session?.user.id !== previous.userId) throw new Error("identity")
    const token = session.session.access_token
    const sessionId = await verifyReturnedAuthSession(client, { accessToken: token, expectedUserId: previous.userId })
    if (!sessionId) throw new Error("identity")
    const { data, error } = await client.rpc("set_account_storage_consent", {
      expected_user_id_input: previous.userId, expected_session_id_input: sessionId,
      expected_revision_input: previous.revision, purpose_version_input: STORAGE_CONSENT_VERSION,
      health_storage_input: healthStorage, journal_text_storage_input: journalTextStorage,
    })
    const parsed = storageConsentSchema.safeParse(data)
    if (error || !parsed.success || parsed.data.userId !== previous.userId
      || parsed.data.revision !== previous.revision + 1
      || parsed.data.healthStorage !== healthStorage || parsed.data.journalTextStorage !== journalTextStorage) throw new Error("changed")
    releaseStorageTransmissionHold(previous.userId)
    remember(parsed.data)
    return { ok: true, consent: parsed.data }
  } catch {
    return { ok: false, message: "서버에서 동의 변경을 확인하지 못했어요. 현재 상태를 다시 확인해 주세요. 삭제 요청은 별도로 할 수 있어요." }
  }
}
