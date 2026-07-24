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

const CONSENT_KEY = "trainoracle.sync.consent.v1"
const TABLE = "journal_entries"

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
 */
export function mergeEntries(
  local: readonly JournalEntry[],
  remote: readonly JournalEntry[],
): JournalEntry[] {
  const byId = new Map<string, JournalEntry>()
  for (const entry of remote) byId.set(entry.id, entry)
  for (const entry of local) {
    const existing = byId.get(entry.id)
    if (existing === undefined || entry.savedAt >= existing.savedAt) {
      byId.set(entry.id, entry)
    }
  }
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
  readonly total: number
}

function failed(message: string): SyncOutcome {
  return { ok: false, message, pulled: 0, pushed: 0, total: loadEntries().length }
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

  // 2. merge (fail-closed: 파싱 통과분만)
  const local = loadEntries()
  const merged = mergeEntries(local, remote)

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
        total: merged.length,
      }
    }
  }

  return {
    ok: true,
    message: "동기화가 끝났어요.",
    pulled: remote.length,
    pushed: rows.length,
    total: merged.length,
  }
}
