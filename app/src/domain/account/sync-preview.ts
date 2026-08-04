import { loadEntries } from "../journal-store"
import { claimSyncBinding, loadSyncConsent } from "./sync-local"
import { hasSupportedSyncSchema, sessionFailureCode } from "./sync-guard"
import { supabase } from "./supabase-client"
import type { SyncPreviewOutcome } from "./sync-types"

export async function previewSync(userId: string): Promise<SyncPreviewOutcome> {
  const localCount = loadEntries().length
  const client = await supabase()
  if (client === null) {
    return { ok: false, message: "계정 기능이 꺼져 있어요.", localCount, remoteJournalCount: 0, remotePrivateCount: 0 }
  }
  const failureCode = await sessionFailureCode(client, userId)
  if (failureCode !== null) {
    return {
      ok: false,
      message: "Sync requires the matching signed-in account.",
      localCount,
      remoteJournalCount: 0,
      remotePrivateCount: 0,
      failureCode,
    }
  }
  if (!loadSyncConsent().enabled) {
    return { ok: false, message: "동기화를 먼저 켜 주세요.", localCount, remoteJournalCount: 0, remotePrivateCount: 0 }
  }
  if (!claimSyncBinding(userId)) {
    return {
      ok: false,
      message: "이 기기의 일지는 다른 계정과 연결되어 있어요. "
        + "계정 화면의 '다른 계정으로 바꾸기'에서 일지를 지우지 않고 연결만 끊을 수 있어요.",
      localCount,
      remoteJournalCount: 0,
      remotePrivateCount: 0,
    }
  }
  if (!await hasSupportedSyncSchema(client)) {
    return {
      ok: false,
      message: "서버 동기화 준비가 아직 끝나지 않았어요. 이 기기의 일지는 그대로예요.",
      localCount,
      remoteJournalCount: 0,
      remotePrivateCount: 0,
      failureCode: "SERVER_SCHEMA_OUTDATED",
    }
  }
  const [journalResult, privateResult] = await Promise.all([
    client.from("journal_entries").select("entry_id").eq("user_id", userId),
    client.from("encrypted_private_notes").select("entry_id").eq("user_id", userId),
  ])
  if (journalResult.error || privateResult.error) {
    return {
      ok: false,
      message: "계정의 일지 개수를 확인하지 못했어요. 이 기기의 일지는 그대로예요.",
      localCount,
      remoteJournalCount: 0,
      remotePrivateCount: 0,
    }
  }
  return {
    ok: true,
    message: "합칠 내용을 확인했어요.",
    localCount,
    remoteJournalCount: journalResult.data?.length ?? 0,
    remotePrivateCount: privateResult.data?.length ?? 0,
  }
}
