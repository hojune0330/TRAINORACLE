// 일지 동기화 엔진 — local-first, 옵트인, id 기준 LWW(savedAt) 머지.
//
// 안전 원칙:
//  - 로그인해도 자동 업로드 없음. 사용자가 "동기화 켜기"를 눌러야 시작(옵트인).
//  - 업로드 기본 페이로드는 safe-export 투영(메모/노트 원문 제거).
//    훈련 메모 공유를 켜고 용도가 훈련 메모인 경우에만 그 원문을 포함한다.
//  - 병합 결과는 스키마 파싱을 통과한 항목만 기록(fail-closed).
//  - 어떤 실패에서도 로컬 데이터는 손실되지 않는다.
import { parseJournalEntryList } from "../journal-schema"
import type { JournalEntry } from "../journal-schema"
import { loadEntries, replaceAllEntries } from "../journal-store"
import { supabase } from "./supabase-client"
import { loadSessionRecoveryCode } from "./private-note-sync"
import { pullPrivateJournalEntries, pushPrivateJournalEntries } from "./private-note-remote"
import {
  claimSyncBinding,
  loadSyncConsent,
  mergeEntries,
  toUploadPayload,
} from "./sync-local"
import { loadTombstones, mergeTombstones, saveTombstones, tombstonedIds } from "./tombstone"
import type { Tombstone } from "./tombstone"

const TABLE = "journal_entries"
const TOMBSTONE_TABLE = "journal_tombstones"

export { loadSyncConsent, mergeEntries, saveSyncConsent, toUploadPayload } from "./sync-local"
export type { SyncConsent } from "./sync-local"

export type SyncOutcome = {
  readonly ok: boolean
  readonly message: string
  readonly pulled: number
  readonly pushed: number
  /** 서버에서도 지운 개수 — 삭제가 기기 사이에 전파되었는지 보여준다 */
  readonly deleted: number
  readonly total: number
}

export type SyncPreviewOutcome = {
  readonly ok: boolean
  readonly message: string
  readonly localCount: number
  readonly remoteJournalCount: number
  readonly remotePrivateCount: number
}

export async function previewSync(userId: string): Promise<SyncPreviewOutcome> {
  const localCount = loadEntries().length
  const client = await supabase()
  if (client === null) {
    return { ok: false, message: "계정 기능이 꺼져 있어요.", localCount, remoteJournalCount: 0, remotePrivateCount: 0 }
  }
  const consent = loadSyncConsent()
  if (!consent.enabled) {
    return { ok: false, message: "동기화를 먼저 켜 주세요.", localCount, remoteJournalCount: 0, remotePrivateCount: 0 }
  }
  if (!claimSyncBinding(userId)) {
    return {
      ok: false,
      message: "이 기기의 일지는 다른 계정과 연결되어 있어요.",
      localCount,
      remoteJournalCount: 0,
      remotePrivateCount: 0,
    }
  }
  const [journalResult, privateResult] = await Promise.all([
    client.from(TABLE).select("entry_id").eq("user_id", userId),
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

function failed(message: string): SyncOutcome {
  return {
    ok: false, message, pulled: 0, pushed: 0, deleted: 0,
    total: loadEntries().length,
  }
}

/** pull → merge → 로컬 반영 → push(전체 upsert) */
export async function syncNow(userId: string): Promise<SyncOutcome> {
  const client = await supabase()
  if (client === null) return failed("계정 기능이 꺼져 있어요.")
  const consent = loadSyncConsent()
  if (!consent.enabled) return failed("동기화가 꺼져 있어요. 먼저 동기화를 켜 주세요.")
  if (!claimSyncBinding(userId)) {
    // 막는 이유는 옳다(다른 사람 계정으로 이 기기의 일지가 올라가면 안 된다).
    // 다만 **빠져나갈 길을 함께 알려야 한다.** 이 잠금은 기기를 넘겨받은
    // 사람에게도 걸리고, 그 사람에게는 "안 된다"만 남는다. 잠금을 푸는
    // 유일한 수단이 전체 삭제이므로 그 자리를 가리킨다.
    return failed(
      "이 기기의 일지는 다른 계정과 연결되어 있어요. 다른 계정으로 업로드하지 않았어요. "
        + "이 기기를 새로 쓰려면 계정 화면의 '이 기기 데이터 전부 지우기'를 먼저 해 주세요.",
    )
  }

  // 1. pull
  const { data, error } = await client
    .from(TABLE)
    .select("entry")
    .eq("user_id", userId)
  if (error) return failed("서버에서 일지를 가져오지 못했어요.")

  const remoteRaw = (data ?? []).map((row: { entry: unknown }) => row.entry)
  const remote = parseJournalEntryList(remoteRaw)

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

  // 2. merge (fail-closed: 파싱 통과분만). 지운 id는 되살리지 않는다.
  const local = loadEntries()
  const tombstones = mergeTombstones(loadTombstones(), remoteTombstones)
  if (!saveTombstones(tombstones)) {
    return failed("삭제 기록을 이 기기에 저장하지 못해 동기화를 멈췄어요. 로컬 일지는 그대로예요.")
  }
  const deletedIds = tombstonedIds(tombstones)
  const merged = mergeEntries(local, [...remote, ...privatePull.entries], deletedIds)

  // 3. 로컬 반영 — 실패해도 기존 로컬은 그대로 남는다
  const replaced = replaceAllEntries(merged)
  if (!replaced.ok) return failed("병합 결과를 저장하지 못했어요. 로컬 일지는 그대로예요.")

  // 4. push — merge 결과 전체 upsert
  const rows: { user_id: string; entry_id: string; saved_at: string; entry: Record<string, unknown> }[] = []
  const memoExcludedEntryIds: string[] = []
  for (const entry of merged) {
    const payload = toUploadPayload(entry, consent)
    if (payload === null) {
      memoExcludedEntryIds.push(entry.id)
      continue
    }
    rows.push({ user_id: userId, entry_id: entry.id, saved_at: entry.savedAt, entry: payload })
  }
  if (rows.length > 0) {
    const { error: pushError } = await client
      .from(TABLE)
      .upsert(rows, { onConflict: "user_id,entry_id" })
    if (pushError) {
      return {
        ok: false,
        message: "서버 백업에 실패했어요. 로컬 일지는 안전해요.",
        pulled: remote.length,
        pushed: 0,
        deleted: 0,
        total: merged.length,
      }
    }
  }

  if (memoExcludedEntryIds.length > 0) {
    const { error: memoDeleteError } = await client
      .from(TABLE)
      .delete()
      .eq("user_id", userId)
      .in("entry_id", memoExcludedEntryIds)
    if (memoDeleteError) {
      return {
        ok: false,
        message: "메모 제외 설정을 서버에 반영하지 못했어요. 다시 동기화해 주세요.",
        pulled: remote.length,
        pushed: rows.length,
        deleted: 0,
        total: merged.length,
      }
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
    return {
      ok: false,
      message: privatePush.message,
      pulled: remote.length,
      pushed: rows.length,
      deleted: 0,
      total: merged.length,
    }
  }

  if (tombstones.length > 0) {
    const { error: tombstoneError } = await client.from(TOMBSTONE_TABLE).upsert(
      tombstones.map((tombstone) => ({
        user_id: userId, entry_id: tombstone.id, deleted_at: tombstone.deletedAt,
      })),
      { onConflict: "user_id,entry_id" },
    )
    if (tombstoneError) {
      return {
        ok: false,
        message: "삭제 기록을 서버에 올리지 못했어요. 이 기기에서는 지워진 상태예요. "
          + "다른 기기에서 다시 나타나면 한 번 더 동기화해 주세요.",
        pulled: remote.length,
        pushed: rows.length,
        deleted: 0,
        total: merged.length,
      }
    }
  }

  // 6. 삭제 전파 — 서버에 남은 사본도 지운다. 여기까지 해야 다른 기기에서도
  //    되살아나지 않는다. 실패해도 로컬 삭제는 그대로 유지된다.
  const remoteIds = new Set(remote.map((entry) => entry.id))
  const toDelete = [...deletedIds].filter((id) => remoteIds.has(id))
  let deleted = 0
  if (toDelete.length > 0) {
    const { error: deleteError } = await client
      .from(TABLE)
      .delete()
      .eq("user_id", userId)
      .in("entry_id", toDelete)
    if (deleteError) {
      return {
        ok: false,
        message: "지운 일지를 서버에서도 지우지 못했어요. 이 기기에서는 그대로 지워진 상태예요.",
        pulled: remote.length,
        pushed: rows.length,
        deleted: 0,
        total: merged.length,
      }
    }
    deleted = toDelete.length
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
