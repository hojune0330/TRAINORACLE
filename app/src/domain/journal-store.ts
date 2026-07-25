import { parseJournalEntryForWrite, parseJournalEntryList } from "./journal-schema"
import type { JournalEntry } from "./journal-schema"
import { toAnalysisJournalEntry, toExportJournalEntry } from "./safe-export"
import type { AnalysisJournalEntry, SafeJournalEntry } from "./safe-export"
import { recordTombstone } from "./account/tombstone"

export type {
  EveningEntry,
  GoalPace,
  JournalEntry,
  JournalEntryBase,
  JournalKind,
  MemoPurpose,
  PostSessionEntry,
  RaceEntry,
} from "./journal-schema"

const KEY = "trainoracle.journal.v1"

export type JournalExportOptions = {
  readonly includeRawMemos?: boolean
}

function storage(): Storage | null {
  try {
    if (typeof window === "undefined") return null
    const localStorage = window.localStorage
    const probe = "__to_probe__"
    localStorage.setItem(probe, "1")
    localStorage.removeItem(probe)
    return localStorage
  } catch {
    return null
  }
}

function writeEntries(localStorage: Storage, entries: readonly JournalEntry[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries))
    return true
  } catch {
    return false
  }
}

export function loadEntries(): JournalEntry[] {
  const localStorage = storage()
  if (localStorage === null) return []

  try {
    const raw = localStorage.getItem(KEY)
    if (raw === null) return []
    const parsed: unknown = JSON.parse(raw)
    const entries = parseJournalEntryList(parsed)
    if (window.location.search.includes("uitest") && Array.isArray(parsed) && parsed.length > entries.length) {
      console.warn(`[JSTORE] dropped=${parsed.length - entries.length} loaded=${entries.length}`)
    }
    return entries
  } catch {
    return []
  }
}

export function saveEntry(entry: unknown): { readonly ok: boolean; readonly total: number } {
  const all = loadEntries()
  const parsedEntry = parseJournalEntryForWrite(entry)
  if (parsedEntry === null) return { ok: false, total: all.length }

  all.push(parsedEntry)
  const localStorage = storage()
  if (localStorage === null) return { ok: false, total: all.length }
  return { ok: writeEntries(localStorage, all), total: all.length }
}

export function loadAnalysisEntries(): AnalysisJournalEntry[] {
  const entries: AnalysisJournalEntry[] = []
  for (const entry of loadEntries()) {
    const projected = toAnalysisJournalEntry(entry)
    if (projected !== null) entries.push(projected)
  }
  return entries
}

export function entriesForDate(date: string): JournalEntry[] {
  return loadEntries().filter((entry) => entry.date === date)
}

/**
 * 전체 교체 — 동기화 병합 결과 반영 전용.
 * fail-closed: 스키마 파싱을 통과한 항목만 기록하고, 하나라도 유효하지 않으면
 * 유효분만 저장한다. 저장 실패 시 기존 localStorage 내용은 건드리지 않는다.
 */
export function replaceAllEntries(entries: readonly unknown[]): { readonly ok: boolean; readonly total: number } {
  const parsed = parseJournalEntryList(entries)
  const localStorage = storage()
  if (localStorage === null) return { ok: false, total: loadEntries().length }
  const ok = writeEntries(localStorage, parsed)
  return { ok, total: ok ? parsed.length : loadEntries().length }
}

/**
 * 일지 삭제.
 *
 * 삭제 기록(tombstone)을 함께 남긴다. 그렇게 하지 않으면 계정 동기화를 쓰는
 * 사용자에게 지운 일지가 다음 동기화에서 되살아난다(서버 사본이 "한쪽에만
 * 있는 항목"으로 판정되기 때문). 지우고 싶어서 지운 기록이 말없이 돌아오는
 * 것은 삭제권 위반이므로, 계정 기능을 쓰지 않는 사용자에게도 항상 남긴다.
 * tombstone에는 id와 시각만 담기며 날짜·수치·메모는 담기지 않는다.
 */
export function deleteEntry(id: string): { readonly ok: boolean; readonly total: number } {
  const remaining = loadEntries().filter((entry) => entry.id !== id)
  const localStorage = storage()
  if (localStorage === null) return { ok: false, total: remaining.length }
  const ok = writeEntries(localStorage, remaining)
  // 로컬 삭제가 성공한 경우에만 기록한다 — 지워지지 않았는데 지웠다고
  // 표시하면 다음 동기화가 살아있는 일지를 지워버린다.
  if (ok) recordTombstone(id)
  return { ok, total: remaining.length }
}

export function exportEntriesJSON(options: JournalExportOptions = {}): string {
  if (options.includeRawMemos === true) {
    return JSON.stringify(
      {
        app: "TRAINORACLE",
        format: "trainoracle.journal.full-backup.v1",
        exportMode: "OWNER_FULL_BACKUP",
        exportedAt: new Date().toISOString(),
        entries: loadEntries(),
      },
      null,
      2,
    )
  }

  const entries: SafeJournalEntry[] = []
  for (const entry of loadEntries()) {
    const projected = toExportJournalEntry(entry)
    if (projected !== null) entries.push(projected)
  }
  return JSON.stringify(
    {
      app: "TRAINORACLE",
      format: "trainoracle.journal.v1",
      exportedAt: new Date().toISOString(),
      entries,
    },
    null,
    2,
  )
}

export function recentEntries(limit = 10): JournalEntry[] {
  return loadEntries()
    .slice()
    .sort((left, right) => (left.savedAt < right.savedAt ? 1 : -1))
    .slice(0, limit)
}

export function localOnlyCount(): number {
  return loadEntries().filter((entry) => entry.syncState === "local").length
}

export function newEntryId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `e_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  }
}

export function todayISO(): string {
  const date = new Date()
  const padded = (value: number) => String(value).padStart(2, "0")
  return `${date.getFullYear()}-${padded(date.getMonth() + 1)}-${padded(date.getDate())}`
}

export const LOCAL_SAVE_NOTICE = "이 기기에 저장됐어요"
export const SYNC_UPSELL_NOTICE = "온라인 보관·기기 이동은 계정 연동 후에 할 수 있어요"
