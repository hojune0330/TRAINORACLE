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
    return parseJournalEntryList(parsed)
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

export function deleteEntry(id: string): { readonly ok: boolean; readonly total: number } {
  const remaining = loadEntries().filter((entry) => entry.id !== id)
  const localStorage = storage()
  if (localStorage === null) return { ok: false, total: remaining.length }
  return { ok: writeEntries(localStorage, remaining), total: remaining.length }
}

export function exportEntriesJSON(): string {
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

export function runStoreSelfTest(options?: { readonly seed?: boolean }): void {
  const localStorage = storage()
  if (localStorage === null) {
    console.log("[JSTORE] storage=unavailable roundtrip=skip")
    return
  }

  const before = loadEntries().length
  const probe: JournalEntry = {
    id: newEntryId(),
    kind: "post-session",
    date: todayISO(),
    savedAt: new Date().toISOString(),
    syncState: "local",
    system: "vo2",
    title: "__uitest__",
    distanceKm: "1",
    durationMin: "1",
    avgPace: "1'00",
    rpe: 5,
    memo: "",
  }
  const saved = saveEntry(probe)
  const after = loadEntries()
  const found = after.some((entry) => entry.id === probe.id)
  const recentTop = recentEntries(1)[0]?.id === probe.id
  writeEntries(
    localStorage,
    after.filter((entry) => entry.id !== probe.id && !entry.id.startsWith("__uiseed_")),
  )

  let seeded = 0
  if (options?.seed === true) {
    const now = Date.now()
    const seeds: JournalEntry[] = [
      {
        id: "__uiseed_1__",
        kind: "post-session",
        date: todayISO(),
        savedAt: new Date(now - 1_000).toISOString(),
        syncState: "local",
        system: "lt",
        title: "시드 · 템포런",
        distanceKm: "8",
        durationMin: "40",
        avgPace: "5'00",
        rpe: 6,
        memo: "",
      },
      {
        id: "__uiseed_2__",
        kind: "evening",
        date: todayISO(),
        savedAt: new Date(now).toISOString(),
        syncState: "local",
        sleepH: 7.5,
        sleepQuality: 4,
        weightKg: "62.0",
        restingHr: "48",
        painParts: { "왼 무릎": 4 },
        mood: 4,
        note: "시드 · 컨디션 좋음",
        memoPurpose: "PRIVATE_SELF_ONLY",
      },
    ]
    for (const seed of seeds) saveEntry(seed)
    seeded = seeds.length
  }

  const restored = loadEntries().length
  console.log(
    `[JSTORE] roundtrip=${saved.ok && found} recentTop=${recentTop} before=${before} afterSave=${after.length} afterClean=${restored} seeded=${seeded}`,
  )
}
