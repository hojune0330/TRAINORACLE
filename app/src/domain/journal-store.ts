import { parseJournalEntryForWrite, parseJournalEntryList } from "./journal-schema"
import type { JournalEntry } from "./journal-schema"
import { toAnalysisJournalEntry, toExportJournalEntry } from "./safe-export"
import type { AnalysisJournalEntry, SafeJournalEntry } from "./safe-export"

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

export function deleteEntry(id: string): { readonly ok: boolean; readonly total: number } {
  const remaining = loadEntries().filter((entry) => entry.id !== id)
  const localStorage = storage()
  if (localStorage === null) return { ok: false, total: remaining.length }
  return { ok: writeEntries(localStorage, remaining), total: remaining.length }
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
