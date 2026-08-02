import { parseJournalEntryList } from "../journal-schema"
import { loadEntries, replaceAllEntries } from "../journal-store"
import { loadSessionRecoveryCode } from "./private-note-sync"
import { pullPrivateJournalEntries, pushPrivateJournalEntries } from "./private-note-remote"
import {
  clearSyncRecoveryCheckpoint,
  createSyncRecoveryCheckpoint,
  recoverPendingSync,
} from "./sync-recovery"
import { failed, hasSupportedSyncSchema, sessionFailureCode } from "./sync-guard"
import { claimSyncBinding, loadSyncConsent, mergeEntries, toUploadPayload } from "./sync-local"
import { supabase } from "./supabase-client"
import { loadTombstones, mergeTombstones, saveTombstones, tombstonedIds } from "./tombstone"
import type { Tombstone } from "./tombstone"
import type { SyncOutcome } from "./sync-types"

const JOURNAL_TABLE = "journal_entries"
const TOMBSTONE_TABLE = "journal_tombstones"

function remoteFailure(
  message: string,
  pulled: number,
  pushed: number,
  total: number,
): SyncOutcome {
  return { ok: false, message, pulled, pushed, deleted: 0, total }
}

export async function syncNow(userId: string): Promise<SyncOutcome> {
  const client = await supabase()
  if (client === null) return failed("계정 기능이 꺼져 있어요.")
  const failureCode = await sessionFailureCode(client, userId)
  if (failureCode !== null) {
    return failed("Sync requires the matching signed-in account.", failureCode)
  }
  const consent = loadSyncConsent()
  if (!consent.enabled) return failed("동기화가 꺼져 있어요. 먼저 동기화를 켜 주세요.")
  if (!claimSyncBinding(userId)) {
    return failed(
      "이 기기의 일지는 다른 계정과 연결되어 있어요. 다른 계정으로 업로드하지 않았어요. "
        + "이 기기를 새로 쓰려면 계정 화면의 '이 기기 데이터 전부 지우기'를 먼저 해 주세요.",
    )
  }
  if (!recoverPendingSync(userId).ok) {
    return failed(
      "이전 동기화 상태를 안전하게 복구하지 못했어요. 이 기기의 일지를 바꾸지 않았어요.",
      "SYNC_RECOVERY_FAILED",
    )
  }
  if (!await hasSupportedSyncSchema(client)) {
    return failed(
      "서버 동기화 준비가 아직 끝나지 않았어요. 이 기기의 일지는 그대로예요.",
      "SERVER_SCHEMA_OUTDATED",
    )
  }

  const { data, error } = await client.from(JOURNAL_TABLE).select("entry").eq("user_id", userId)
  if (error) return failed("서버에서 일지를 가져오지 못했어요.")
  const remote = parseJournalEntryList((data ?? []).map((row: { entry: unknown }) => row.entry))

  const recoveryCode = loadSessionRecoveryCode()
  const privatePull = await pullPrivateJournalEntries(client, userId, recoveryCode)
  if (!privatePull.ok) return failed(privatePull.message)

  const { data: tombstoneRows, error: tombstonePullError } = await client
    .from(TOMBSTONE_TABLE)
    .select("entry_id, deleted_at")
    .eq("user_id", userId)
  if (tombstonePullError) {
    return failed("삭제 기록을 서버에서 확인하지 못해 동기화를 멈췄어요. 로컬 일지는 그대로예요.")
  }
  const remoteTombstones: Tombstone[] = (tombstoneRows ?? [])
    .filter((row: { entry_id: unknown; deleted_at: unknown }) =>
      typeof row.entry_id === "string" && typeof row.deleted_at === "string")
    .map((row: { entry_id: string; deleted_at: string }) =>
      ({ id: row.entry_id, deletedAt: row.deleted_at }))

  const local = loadEntries()
  const localTombstones = loadTombstones()
  const tombstones = mergeTombstones(localTombstones, remoteTombstones)
  if (!createSyncRecoveryCheckpoint(userId, local, localTombstones)) {
    return failed(
      "동기화 복구 지점을 저장하지 못했어요. 이 기기의 일지를 바꾸지 않았어요.",
      "SYNC_RECOVERY_FAILED",
    )
  }
  if (!saveTombstones(tombstones)) {
    return failed("삭제 기록을 이 기기에 저장하지 못해 동기화를 멈췄어요. 로컬 일지는 그대로예요.")
  }
  const deletedIds = tombstonedIds(tombstones)
  const merged = mergeEntries(local, [...remote, ...privatePull.entries], deletedIds)
  if (!replaceAllEntries(merged).ok) {
    return failed("병합 결과를 저장하지 못했어요. 로컬 일지는 그대로예요.")
  }

  const rows: { user_id: string; entry_id: string; saved_at: string; entry: Record<string, unknown> }[] = []
  const memoExcludedEntryIds: string[] = []
  for (const entry of merged) {
    const payload = toUploadPayload(entry, consent)
    if (payload === null) memoExcludedEntryIds.push(entry.id)
    else rows.push({ user_id: userId, entry_id: entry.id, saved_at: entry.savedAt, entry: payload })
  }
  if (rows.length > 0) {
    const { error: pushError } = await client
      .from(JOURNAL_TABLE)
      .upsert(rows, { onConflict: "user_id,entry_id" })
    if (pushError) return remoteFailure("서버 백업에 실패했어요. 로컬 일지는 안전해요.", remote.length, 0, merged.length)
  }

  if (memoExcludedEntryIds.length > 0) {
    const { error: memoDeleteError } = await client
      .from(JOURNAL_TABLE)
      .delete()
      .eq("user_id", userId)
      .in("entry_id", memoExcludedEntryIds)
    if (memoDeleteError) {
      return remoteFailure(
        "메모 제외 설정을 서버에 반영하지 못했어요. 다시 동기화해 주세요.",
        remote.length,
        rows.length,
        merged.length,
      )
    }
  }

  const privatePush = await pushPrivateJournalEntries(
    client,
    userId,
    merged,
    recoveryCode,
    privatePull.remoteEntryIds,
    deletedIds,
  )
  if (!privatePush.ok) {
    return remoteFailure(privatePush.message, remote.length, rows.length, merged.length)
  }

  if (tombstones.length > 0) {
    const { error: tombstoneError } = await client.from(TOMBSTONE_TABLE).upsert(
      tombstones.map((tombstone) => ({
        user_id: userId,
        entry_id: tombstone.id,
        deleted_at: tombstone.deletedAt,
      })),
      { onConflict: "user_id,entry_id" },
    )
    if (tombstoneError) {
      return remoteFailure(
        "삭제 기록을 서버에 올리지 못했어요. 이 기기에서는 지워진 상태예요. "
          + "다른 기기에서 다시 나타나면 한 번 더 동기화해 주세요.",
        remote.length,
        rows.length,
        merged.length,
      )
    }
  }

  const remoteIds = new Set(remote.map((entry) => entry.id))
  const toDelete = [...deletedIds].filter((id) => remoteIds.has(id))
  let deleted = 0
  if (toDelete.length > 0) {
    const { error: deleteError } = await client
      .from(JOURNAL_TABLE)
      .delete()
      .eq("user_id", userId)
      .in("entry_id", toDelete)
    if (deleteError) {
      return remoteFailure(
        "지운 일지를 서버에서도 지우지 못했어요. 이 기기에서는 그대로 지워진 상태예요.",
        remote.length,
        rows.length,
        merged.length,
      )
    }
    deleted = toDelete.length
  }

  if (!clearSyncRecoveryCheckpoint()) {
    return {
      ok: false,
      message: "동기화는 끝났지만 복구 기록을 정리하지 못했어요. 다시 동기화해 주세요.",
      pulled: remote.length,
      pushed: rows.length,
      deleted,
      total: merged.length,
      failureCode: "SYNC_RECOVERY_FAILED",
    }
  }
  return {
    ok: true,
    message: "동기화가 끝났어요.",
    pulled: remote.length,
    pushed: rows.length,
    deleted,
    total: merged.length,
  }
}
