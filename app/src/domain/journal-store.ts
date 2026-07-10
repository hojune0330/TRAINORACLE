// journal-store — 로컬 우선(local-first) 일지 저장.
// 원칙 (ACCOUNT_FEDERATION_DECISION.md §3.3):
//  - 일지는 먼저 "이 기기"(localStorage)에 저장된다. 회원가입 없이 완전 동작.
//  - 온라인 보관·다기기 동기화는 계정 연동(F3) 후 syncState "local" → 서버 승격으로 처리.
//  - 통증·메모 등 민감 필드도 기기 밖으로 나가지 않는다 (연동 후에도 TRAINORACLE 백엔드 전용).
// §8 memo_policy: memo/note 자유 입력은 저장만 하고 어떤 판정에도 쓰지 않는다.

export type JournalKind = "post-session" | "evening" | "race"

export interface JournalEntryBase {
  id: string
  kind: JournalKind
  /** YYYY-MM-DD (기기 로컬 기준) */
  date: string
  /** ISO timestamp */
  savedAt: string
  /** local = 이 기기에만 존재. 계정 연동 후 서버 승격되면 "synced" (F3) */
  syncState: "local" | "synced"
}

export interface PostSessionEntry extends JournalEntryBase {
  kind: "post-session"
  system: string
  title: string
  distanceKm: string
  durationMin: string
  avgPace: string
  rpe: number
  memo: string
}

export interface EveningEntry extends JournalEntryBase {
  kind: "evening"
  sleepH: number
  sleepQuality: number
  weightKg: string
  restingHr: string
  painParts: Record<string, number>
  mood: number
  note: string
}

export interface RaceEntry extends JournalEntryBase {
  kind: "race"
  stage: "pre" | "post"
  record: string
  rank: string
  result: string
  memo: string
}

export type JournalEntry = PostSessionEntry | EveningEntry | RaceEntry

const KEY = "trainoracle.journal.v1"

function storage(): Storage | null {
  try {
    if (typeof window === "undefined") return null
    const s = window.localStorage
    // Safari 프라이빗 모드 등 쓰기 불가 환경 감지
    const probe = "__to_probe__"
    s.setItem(probe, "1")
    s.removeItem(probe)
    return s
  } catch {
    return null
  }
}

export function loadEntries(): JournalEntry[] {
  const s = storage()
  if (!s) return []
  try {
    const raw = s.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as JournalEntry[]) : []
  } catch {
    return []
  }
}

export function saveEntry(entry: JournalEntry): { ok: boolean; total: number } {
  const s = storage()
  const all = loadEntries()
  all.push(entry)
  if (!s) return { ok: false, total: all.length }
  try {
    s.setItem(KEY, JSON.stringify(all))
    return { ok: true, total: all.length }
  } catch {
    return { ok: false, total: all.length }
  }
}

export function entriesForDate(date: string): JournalEntry[] {
  return loadEntries().filter((e) => e.date === date)
}

export function localOnlyCount(): number {
  return loadEntries().filter((e) => e.syncState === "local").length
}

export function newEntryId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `e_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  }
}

export function todayISO(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** 저장 후 사용자 안내 문구 — 회원 연동 전/후 공통 소스 (문구 이중정의 금지) */
export const LOCAL_SAVE_NOTICE = "이 기기에 저장됐어요"
export const SYNC_UPSELL_NOTICE = "온라인 보관·기기 이동은 계정 연동 후에 할 수 있어요"

/** ?uitest 전용 — 저장/조회/정리 왕복 자가검증. 콘솔에 [JSTORE] 증거 로그. */
export function runStoreSelfTest(): void {
  const s = storage()
  if (!s) {
    console.log("[JSTORE] storage=unavailable roundtrip=skip")
    return
  }
  const before = loadEntries().length
  const probe: JournalEntry = {
    id: newEntryId(), kind: "post-session", date: todayISO(),
    savedAt: new Date().toISOString(), syncState: "local",
    system: "vo2", title: "__uitest__", distanceKm: "1", durationMin: "1", avgPace: "1'00",
    rpe: 5, memo: "",
  }
  const saved = saveEntry(probe)
  const after = loadEntries()
  const found = after.some((e) => e.id === probe.id)
  // 정리: probe 제거 (uitest가 실데이터를 남기지 않도록)
  try {
    s.setItem(KEY, JSON.stringify(after.filter((e) => e.id !== probe.id)))
  } catch { /* noop */ }
  const restored = loadEntries().length
  console.log(
    `[JSTORE] roundtrip=${saved.ok && found} before=${before} afterSave=${after.length} afterClean=${restored}`,
  )
}
