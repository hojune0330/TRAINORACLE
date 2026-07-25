// 일지 동기화 엔진 — local-first, 옵트인, id 기준 LWW(savedAt) 머지.
//
// 안전 원칙:
//  - 로그인해도 자동 업로드 없음. 사용자가 "동기화 켜기"를 눌러야 시작(옵트인).
//  - 업로드 기본 페이로드는 safe-export 투영(메모/노트 원문 제거).
//    "메모도 함께 백업"을 켠 경우에만 원문 포함 — 기본 OFF.
//  - 병합 결과는 스키마 파싱을 통과한 항목만 기록(fail-closed).
//  - 어떤 실패에서도 로컬 데이터는 손실되지 않는다.
import { parseJournalEntryList } from "../journal-schema"
import type { JournalEntry } from "../journal-schema"
import { loadEntries, replaceAllEntries } from "../journal-store"
import { toExportJournalEntry } from "../safe-export"
import { supabase } from "./supabase-client"
import { loadTombstones, mergeTombstones, saveTombstones, tombstonedIds } from "./tombstone"
import type { Tombstone } from "./tombstone"

const CONSENT_KEY = "trainoracle.sync.consent.v1"
const TABLE = "journal_entries"
const TOMBSTONE_TABLE = "journal_tombstones"

export type SyncConsent = {
  readonly enabled: boolean
  /** 메모/노트 원문 포함 여부 — 기본 false (안전 기본값) */
  readonly includeMemos: boolean
}

const DEFAULT_CONSENT: SyncConsent = { enabled: false, includeMemos: false }

function storage(): Storage | null {
  try {
    if (typeof window === "undefined") return null
    return window.localStorage
  } catch {
    return null
  }
}

export function loadSyncConsent(): SyncConsent {
  const localStorage = storage()
  if (localStorage === null) return DEFAULT_CONSENT
  try {
    const raw = localStorage.getItem(CONSENT_KEY)
    if (raw === null) return DEFAULT_CONSENT
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== "object" || parsed === null) return DEFAULT_CONSENT
    const record = parsed as Record<string, unknown>
    return {
      enabled: record.enabled === true,
      includeMemos: record.includeMemos === true,
    }
  } catch {
    return DEFAULT_CONSENT
  }
}

export function saveSyncConsent(consent: SyncConsent): boolean {
  const localStorage = storage()
  if (localStorage === null) return false
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify(consent))
    return true
  } catch {
    return false
  }
}

/**
 * id 기준 LWW 머지 (순수 함수 — 계약 테스트 대상).
 * 같은 id: savedAt 큰 쪽 승리, 동률이면 local 승리.
 * 한쪽에만 있으면 보존. 결과는 date, savedAt 순 정렬.
 *
 * **삭제는 LWW의 예외다.** 사용자가 지운 id(tombstone)는 서버 사본이 더
 * 최신이어도 되살리지 않는다. 그렇게 하지 않으면 지운 일지가 다음 동기화에
 * 말없이 돌아온다 — 삭제권 위반. 되살리고 싶으면 새로 쓰면 된다(새 id).
 */
export function mergeEntries(
  local: readonly JournalEntry[],
  remote: readonly JournalEntry[],
  deletedIds: ReadonlySet<string> = tombstonedIds(),
): JournalEntry[] {
  const byId = new Map<string, JournalEntry>()
  for (const entry of remote) byId.set(entry.id, entry)
  for (const entry of local) {
    const existing = byId.get(entry.id)
    if (existing === undefined || entry.savedAt >= existing.savedAt) {
      byId.set(entry.id, entry)
    }
  }
  for (const id of deletedIds) byId.delete(id)
  return [...byId.values()].sort((a, b) =>
    a.date === b.date ? a.savedAt.localeCompare(b.savedAt) : a.date.localeCompare(b.date),
  )
}

/** 업로드 페이로드 생성 — 동의 설정에 따라 메모 제거/포함 */
export function toUploadPayload(
  entry: JournalEntry,
  consent: SyncConsent,
): Record<string, unknown> | null {
  if (consent.includeMemos) return { ...entry }
  const safe = toExportJournalEntry(entry)
  if (safe === null) return null
  return { ...safe }
}

export type SyncOutcome = {
  readonly ok: boolean
  readonly message: string
  readonly pulled: number
  readonly pushed: number
  /** 서버에서도 지운 개수 — 삭제가 기기 사이에 전파되었는지 보여준다 */
  readonly deleted: number
  readonly total: number
  /**
   * 삭제 기록 pull이 실패해 이번 동기화가 반쪽으로 끝났는지.
   * 동기화 자체는 성공(ok=true)이지만 다른 기기의 삭제는 반영되지 않았다.
   * 비차단으로 두되 사용자에게 감추지는 않는다(fail-visible).
   */
  readonly tombstoneSyncDegraded: boolean
}

function failed(message: string): SyncOutcome {
  return {
    ok: false, message, pulled: 0, pushed: 0, deleted: 0,
    total: loadEntries().length, tombstoneSyncDegraded: false,
  }
}

/** pull → merge → 로컬 반영 → push(전체 upsert) */
export async function syncNow(userId: string): Promise<SyncOutcome> {
  const client = await supabase()
  if (client === null) return failed("계정 기능이 꺼져 있어요.")
  const consent = loadSyncConsent()
  if (!consent.enabled) return failed("동기화가 꺼져 있어요. 먼저 동기화를 켜 주세요.")

  // 1. pull
  const { data, error } = await client
    .from(TABLE)
    .select("entry")
    .eq("user_id", userId)
  if (error) return failed("서버에서 일지를 가져오지 못했어요.")

  const remoteRaw = (data ?? []).map((row: { entry: unknown }) => row.entry)
  const remote = parseJournalEntryList(remoteRaw)

  // 1-b. 삭제 기록 pull — 다른 기기에서 지운 것을 이 기기도 알아야 한다.
  //      이게 없으면 A에서 지운 일지를 B가 다시 밀어 올려 부활시킨다.
  //      실패해도 동기화 전체를 막지 않는다. 로컬 삭제 보호는 그대로 유효하고,
  //      다만 다른 기기의 삭제가 이번에는 반영되지 않을 뿐이다.
  //      (마이그레이션 0002 미실행 환경에서도 기존 동기화가 깨지지 않도록.)
  //      **비차단이지 무언(無言)이 아니다.** 실패 사실은 결과에 실어 보낸다 —
  //      조용히 넘기면 "다른 기기 삭제가 왜 안 왔지?"를 사용자가 알 수 없다.
  const { data: tombstoneRows, error: tombstonePullError } = await client
    .from(TOMBSTONE_TABLE)
    .select("entry_id, deleted_at")
    .eq("user_id", userId)
  const remoteTombstones: Tombstone[] = (tombstoneRows ?? [])
    .filter((row: { entry_id: unknown; deleted_at: unknown }) =>
      typeof row.entry_id === "string" && typeof row.deleted_at === "string")
    .map((row: { entry_id: string; deleted_at: string }) =>
      ({ id: row.entry_id, deletedAt: row.deleted_at }))

  // 2. merge (fail-closed: 파싱 통과분만). 지운 id는 되살리지 않는다.
  const local = loadEntries()
  const tombstones = mergeTombstones(loadTombstones(), remoteTombstones)
  saveTombstones(tombstones)
  const deletedIds = tombstonedIds(tombstones)
  const merged = mergeEntries(local, remote, deletedIds)

  // 3. 로컬 반영 — 실패해도 기존 로컬은 그대로 남는다
  const replaced = replaceAllEntries(merged)
  if (!replaced.ok) return failed("병합 결과를 저장하지 못했어요. 로컬 일지는 그대로예요.")

  // 4. push — merge 결과 전체 upsert
  const rows: { user_id: string; entry_id: string; saved_at: string; entry: Record<string, unknown> }[] = []
  for (const entry of merged) {
    const payload = toUploadPayload(entry, consent)
    if (payload === null) continue
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
        tombstoneSyncDegraded: tombstonePullError !== null && tombstonePullError !== undefined,
      }
    }
  }

  // 5. 삭제 기록 push — 이 기기의 삭제를 다른 기기도 알게 한다.
  //    본문·날짜·수치는 올리지 않는다 — id와 삭제 시각뿐이다(최소 수집).
  //
  //    pull(1-b)과 달리 push 실패는 **숨기지 않는다**. pull이 실패하면 남의
  //    기기 삭제가 이번에 안 올 뿐이지만, push가 실패하면 내가 지운 사실이
  //    서버에 없는 상태로 남는다. 그러면 다른 기기가 자기 사본을 밀어 올려
  //    지운 일지가 되살아난다 — 조용히 성공이라고 말하면 안 되는 실패다.
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
        tombstoneSyncDegraded: tombstonePullError !== null && tombstonePullError !== undefined,
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
        tombstoneSyncDegraded: tombstonePullError !== null && tombstonePullError !== undefined,
      }
    }
    deleted = toDelete.length
  }

  const degraded = tombstonePullError !== null && tombstonePullError !== undefined
  return {
    ok: true,
    message: degraded
      ? "동기화가 끝났어요. 다만 다른 기기의 삭제 기록은 가져오지 못했어요."
      : "동기화가 끝났어요.",
    pulled: remote.length,
    pushed: rows.length,
    deleted,
    total: merged.length,
    tombstoneSyncDegraded: degraded,
  }
}
