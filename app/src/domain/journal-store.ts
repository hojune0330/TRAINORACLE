import { parseJournalEntryForWrite, parseJournalEntryList } from "./journal-schema"
import type { JournalEntry } from "./journal-schema"
import { hasValueExcludedFromAnalysis, toAnalysisJournalEntry, toExportJournalEntry } from "./safe-export"
import type { AnalysisJournalEntry, SafeJournalEntry } from "./safe-export"
import { hasImportedField } from "./field-provenance"
import { recordTombstone, removeTombstone } from "./account/tombstone"
import { moveToTrash, takeFromTrash } from "./journal-trash"
import { JOURNAL_STORAGE_KEY, journalStorage, writeJournalEntries } from "./journal-local-storage"
import {
  hasPrivateMemoText,
  isPrivateMemoEntry,
  privateMemoRecord,
  removePrivateMemoWithJournalEntries,
  restorePrivateMemoRecordWithJournalShell,
  restorePrivateMemo,
  restorePrivateMemoShell,
  savePrivateMemoWithJournalShell,
} from "./private-memo-vault"
import { loadSessionRecoveryCode } from "./account/private-note-sync"
import { loadDecorationState } from "./decorations"

const privateMemoCache = new Map<string, { readonly recoveryCode: string; readonly memo: string }>()

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

export type JournalExportOptions = {
  readonly includeRawMemos?: boolean
}

export class PrivateMemoUnlockRequiredError extends Error {
  readonly code = "PRIVATE_MEMO_UNLOCK_REQUIRED"

  constructor() {
    super("PRIVATE_MEMO_UNLOCK_REQUIRED")
    this.name = "PrivateMemoUnlockRequiredError"
  }
}

export function loadEntries(): JournalEntry[] {
  return loadJournalEntriesSnapshot().entries
}

export type JournalEntriesStorageSnapshot = {
  readonly entries: JournalEntry[]
  readonly raw: string | null
  readonly readStatus: "complete" | "uncertain"
}

export type PlanSafetyJournalRead =
  | { readonly status: "complete"; readonly entries: readonly JournalEntry[] }
  | { readonly status: "uncertain" }

export function loadEntriesForPlanSafety(): PlanSafetyJournalRead {
  const snapshot = loadJournalEntriesSnapshot()
  return snapshot.readStatus === "complete"
    ? { status: "complete", entries: snapshot.entries }
    : { status: "uncertain" }
}

export function loadJournalEntriesSnapshot(): JournalEntriesStorageSnapshot {
  const localStorage = journalStorage()
  if (localStorage === null) return { entries: [], raw: null, readStatus: "uncertain" }

  try {
    const raw = localStorage.getItem(JOURNAL_STORAGE_KEY)
    if (raw === null) return { entries: [], raw, readStatus: "complete" }
    const parsed: unknown = JSON.parse(raw)
    const entries = parseJournalEntryList(parsed)
    if (window.location.search.includes("uitest") && Array.isArray(parsed) && parsed.length > entries.length) {
      console.warn(`[JSTORE] dropped=${parsed.length - entries.length} loaded=${entries.length}`)
    }
    return {
      entries,
      raw,
      readStatus: Array.isArray(parsed) && parsed.length === entries.length
        ? "complete"
        : "uncertain",
    }
  } catch {
    return { entries: [], raw: null, readStatus: "uncertain" }
  }
}

export function saveEntry(entry: unknown): { readonly ok: boolean; readonly total: number } {
  const snapshot = loadJournalEntriesSnapshot()
  const all = snapshot.entries
  const parsedEntry = parseJournalEntryForWrite(entry)
  if (parsedEntry === null) return { ok: false, total: all.length }
  if (hasPrivateMemoText(parsedEntry)) return { ok: false, total: all.length }

  all.push(parsedEntry)
  const localStorage = journalStorage()
  if (localStorage === null) return { ok: false, total: all.length }
  return { ok: writeJournalEntries(localStorage, all, snapshot.raw), total: all.length }
}

export async function savePrivateEntry(entry: unknown): Promise<{ readonly ok: boolean; readonly total: number }> {
  const snapshot = loadJournalEntriesSnapshot()
  const all = snapshot.entries
  const parsedEntry = parseJournalEntryForWrite(entry)
  if (parsedEntry === null || !hasPrivateMemoText(parsedEntry)) return { ok: false, total: all.length }
  const localStorage = journalStorage()
  const recoveryCode = loadSessionRecoveryCode()
  if (localStorage === null || recoveryCode === null) return { ok: false, total: all.length }

  const ok = await savePrivateMemoWithJournalShell(
    localStorage,
    [...all, parsedEntry],
    parsedEntry,
    recoveryCode,
    snapshot.raw,
  )
  if (!ok) return { ok: false, total: all.length }
  privateMemoCache.set(parsedEntry.id, { recoveryCode, memo: parsedEntry.kind === "evening" ? parsedEntry.note : parsedEntry.memo })
  return { ok: true, total: all.length + 1 }
}

export async function updatePrivateEntry(
  entry: unknown,
  expectedSavedAt: string,
): Promise<{ readonly ok: boolean; readonly total: number }> {
  const snapshot = loadJournalEntriesSnapshot()
  const entries = snapshot.entries
  const nextEntry = parseJournalEntryForWrite(entry)
  if (nextEntry === null || !hasPrivateMemoText(nextEntry)) return { ok: false, total: entries.length }
  const matchingEntries = entries.filter((current) => current.id === nextEntry.id)
  if (matchingEntries.length !== 1) return { ok: false, total: entries.length }
  const previous = matchingEntries[0]
  if (previous === undefined
    || previous.syncState !== "local"
    || hasImportedField(previous.fieldProvenance)
    || previous.savedAt !== expectedSavedAt
    || previous.kind !== nextEntry.kind
    || previous.date !== nextEntry.date
    || !isNewerSavedAt(previous.savedAt, nextEntry.savedAt)) {
    return { ok: false, total: entries.length }
  }
  const localStorage = journalStorage()
  const recoveryCode = loadSessionRecoveryCode()
  if (localStorage === null || recoveryCode === null) return { ok: false, total: entries.length }

  const nextEntries = entries.map((current) => current.id === nextEntry.id ? nextEntry : current)
  const ok = await savePrivateMemoWithJournalShell(
    localStorage,
    nextEntries,
    nextEntry,
    recoveryCode,
    snapshot.raw,
  )
  if (!ok) return { ok: false, total: entries.length }
  privateMemoCache.set(nextEntry.id, { recoveryCode, memo: nextEntry.kind === "evening" ? nextEntry.note : nextEntry.memo })
  return { ok: true, total: entries.length }
}

export async function loadEntriesWithPrivateMemos(): Promise<JournalEntry[]> {
  const entries = loadEntries()
  const localStorage = journalStorage()
  const recoveryCode = loadSessionRecoveryCode()
  if (localStorage === null || recoveryCode === null) return entries

  const restored: JournalEntry[] = []
  for (const entry of entries) {
    const next = await restorePrivateMemo(localStorage, entry, recoveryCode)
    if (next !== entry && hasPrivateMemoText(next)) {
      privateMemoCache.set(entry.id, {
        recoveryCode,
        memo: next.kind === "evening" ? next.note : next.memo,
      })
    }
    restored.push(next)
  }
  return restored
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
  const snapshot = loadJournalEntriesSnapshot()
  const localStorage = journalStorage()
  if (localStorage === null) return { ok: false, total: snapshot.entries.length }
  const ok = writeJournalEntries(localStorage, parsed, snapshot.raw)
  return { ok, total: ok ? parsed.length : snapshot.entries.length }
}

export type DeleteEntryResult = {
  readonly ok: boolean
  readonly total: number
  /**
   * 휴지통에 보관됐는지. false면 30일 되돌리기를 쓸 수 없다 —
   * UI는 이 값에 따라 안내 문구를 달리 해야 한다(있는데 없다고,
   * 없는데 있다고 말하지 않기 위해).
   */
  readonly trashed: boolean
}

/**
 * 일지 삭제.
 *
 * 삭제 기록(tombstone)을 함께 남긴다. 그렇게 하지 않으면 계정 동기화를 쓰는
 * 사용자에게 지운 일지가 다음 동기화에서 되살아난다(서버 사본이 "한쪽에만
 * 있는 항목"으로 판정되기 때문). 지우고 싶어서 지운 기록이 말없이 돌아오는
 * 것은 삭제권 위반이므로, 계정 기능을 쓰지 않는 사용자에게도 항상 남긴다.
 * tombstone에는 id와 시각만 담기며 날짜·수치·메모는 담기지 않는다.
 *
 * 지운 일지는 **휴지통에 30일 보관**된다(소유자 결정). 순서가 중요하다:
 *  1. 먼저 휴지통에 넣는다. 2. 그다음 본문에서 지운다.
 * 거꾸로 하면 그 사이에 저장이 실패했을 때 일지가 완전히 사라진다.
 * 본문 삭제가 실패하면 휴지통 항목을 되돌려 놓는다(중복 방지).
 *
 * 휴지통 보관에 실패해도 **삭제는 진행한다.** 사용자는 지우기를 요청했고,
 * "되돌릴 준비가 안 돼서 못 지웠어요"는 삭제권을 막는 것이다. 대신 결과에
 * `trashed: false`를 실어 보내 UI가 사실대로 말하게 한다.
 */
export function deleteEntry(id: string): DeleteEntryResult {
  const snapshot = loadJournalEntriesSnapshot()
  const all = snapshot.entries
  const matches = all.filter((entry) => entry.id === id)
  if (matches.length !== 1) return { ok: false, total: all.length, trashed: false }
  const [target] = matches
  if (target === undefined) return { ok: false, total: all.length, trashed: false }

  const remaining = all.filter((entry) => entry.id !== id)
  const localStorage = journalStorage()
  if (localStorage === null) return { ok: false, total: all.length, trashed: false }

  if (!recordTombstone(id)) return { ok: false, total: all.length, trashed: false }

  const record = isPrivateMemoEntry(target) ? privateMemoRecord(localStorage, target.id) : null
  const trashed = moveToTrash(target, undefined, record ?? undefined)

  const ok = isPrivateMemoEntry(target)
    ? removePrivateMemoWithJournalEntries(localStorage, remaining, target.id, snapshot.raw)
    : writeJournalEntries(localStorage, remaining, snapshot.raw)
  if (!ok) {
    // 본문에 그대로 남아 있는데 휴지통에도 있으면 되돌리기가 사본을 하나 더
    // 만든다. 넣었던 것을 빼서 상태를 원래대로 돌린다.
    if (trashed) takeFromTrash(id)
    removeTombstone(id)
    return { ok: false, total: all.length, trashed: false }
  }

  return { ok: true, total: remaining.length, trashed }
}

export type RestoreDeletedResult = {
  readonly ok: boolean
  /** 복구된 일지의 새 id — 원래 id와 다르다(아래 설명) */
  readonly restoredId: string | null
  readonly total: number
}

/**
 * 휴지통에서 일지를 되돌린다.
 *
 * **새 id로 복구한다.** 원래 id를 그대로 쓰면 삭제 기록과 충돌한다:
 *  - 로컬 tombstone만 지우면, 다음 동기화에서 서버 tombstone이 내려와
 *    복구한 일지를 **또 지운다**(tombstone은 머지에서 항상 이긴다).
 *  - 서버 tombstone까지 지우면, 다른 기기에서 이미 반영된 삭제가 풀려
 *    그 기기의 사본이 되살아난다 — 지운 적 없는 일지가 늘어난다.
 * 새 id를 쓰면 오래된 id는 계속 "지워진 id"로 남고, 복구본은 새 기록으로
 * 취급된다. 사용자가 보는 내용(날짜·수치·메모)은 완전히 같다.
 *
 * 휴지통에서 꺼내기(takeFromTrash)를 먼저 해서, 저장이 실패하면 되돌려 놓는다.
 */
export function restoreDeletedEntry(id: string): RestoreDeletedResult {
  const taken = takeFromTrash(id)
  if (taken === null) return { ok: false, restoredId: null, total: loadEntries().length }

  const snapshot = loadJournalEntriesSnapshot()
  const restored = { ...taken.entry, id: newEntryId(), syncState: "local" as const }
  const next = [...snapshot.entries, restored]
  const localStorage = journalStorage()
  if (localStorage === null) {
    moveToTrash(taken.entry, taken.deletedAt, taken.privateMemo)
    return { ok: false, restoredId: null, total: next.length - 1 }
  }
  const ok = taken.privateMemo === undefined
    ? writeJournalEntries(localStorage, next, snapshot.raw)
    : restorePrivateMemoRecordWithJournalShell(
      localStorage,
      next,
      taken.entry.id,
      restored.id,
      taken.privateMemo,
      snapshot.raw,
    )
  if (!ok) {
    // 꺼내 놓고 저장에 실패하면 일지가 어디에도 없게 된다. 휴지통에 되돌린다.
    moveToTrash(taken.entry, taken.deletedAt, taken.privateMemo)
    return { ok: false, restoredId: null, total: next.length - 1 }
  }
  return { ok: true, restoredId: restored.id, total: next.length }
}

export function exportEntriesJSON(options: JournalExportOptions = {}): string {
  if (options.includeRawMemos === true) {
    return JSON.stringify(
      {
        app: "TRAINORACLE",
        format: "trainoracle.journal.full-backup.v2",
        exportMode: "OWNER_FULL_BACKUP",
        exportedAt: new Date().toISOString(),
        entries: entriesForOwnerFullBackup(),
        decorations: loadDecorationState(),
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

function entriesForOwnerFullBackup(): JournalEntry[] {
  const recoveryCode = loadSessionRecoveryCode()
  const entries = loadEntries()
  if (recoveryCode === null) {
    if (entries.some(isPrivateMemoEntry)) throw new PrivateMemoUnlockRequiredError()
    return entries
  }
  return entries.map((entry) => {
    const cached = privateMemoCache.get(entry.id)
    if (isPrivateMemoEntry(entry) && (cached === undefined || cached.recoveryCode !== recoveryCode)) {
      throw new PrivateMemoUnlockRequiredError()
    }
    if (cached === undefined || cached.recoveryCode !== recoveryCode) return entry
    return restorePrivateMemoShell(entry, cached.memo)
  })
}

export type SafeExportSummary = {
  /** 이 기기에 있는 일지 전체 개수 */
  readonly total: number
  /** 안전 백업 파일에 들어가는 개수 */
  readonly included: number
  /** 안전 백업에서 빠지는 개수 — 수치 없이 메모만 쓴 일지 */
  readonly skipped: number
}

/**
 * 안전 백업에 무엇이 들어가고 무엇이 빠지는지 미리 센다.
 *
 * 왜 필요한가 (실제 결함 F-3):
 *  안전 백업은 메모 원문을 제외한다. 그래서 **수치를 하나도 안 쓰고 메모만 남긴
 *  일지는 남을 내용이 없어 파일에서 통째로 빠진다**(`toExportJournalEntry`가
 *  null을 돌려준다). 그런데 화면에는 아무 말도 없었다. 사용자는 "내 일지
 *  데이터 내려받기"를 누르고 전부 받았다고 믿는데, 실제로는 일부가 없다.
 *  나중에 이 파일로 복원하면 그 일지들은 돌아오지 않는다 — 조용한 데이터 손실.
 *
 *  고치는 방향은 두 갈래였다: (가) 메모만 있는 일지도 안전 파일에 넣기,
 *  (나) 빠진 개수를 알려주기. (가)는 안전 백업의 약속("메모 원문 제외")을
 *  깨므로 택하지 않았다 — 메모만 있는 일지는 메모를 빼면 빈 껍데기라 넣을
 *  내용 자체가 없다. 소유자 결정은 (나) **안내**다. 빠진다는 사실을 말하고,
 *  전부 받는 방법(메모 포함 파일)을 같은 자리에서 안내한다.
 */
export function safeExportSummary(): SafeExportSummary {
  const entries = loadEntries()
  let included = 0
  for (const entry of entries) {
    if (toExportJournalEntry(entry) !== null) included += 1
  }
  return { total: entries.length, included, skipped: entries.length - included }
}

export type AnalysisExclusionSummary = {
  /** 이 기기에 있는 일지 전체 개수 */
  readonly total: number
  /** 적은 수치가 추이·분석에 실제로 반영되는 일지 개수 */
  readonly included: number
  /**
   * 수치를 적었는데 **가져온 값(DERIVED)이라서** 분석에서 빠진 일지 개수.
   * 원인이 분명하므로 화면에서 이유까지 말해 줄 수 있다.
   */
  readonly excludedImported: number
  /**
   * 수치를 적었는데 **출처 정보가 없어서** 분석에서 빠진 일지 개수.
   *
   * 왜 따로 세는가: `isEligibleForAnalysis`는 출처 맵이 아예 없으면 false를
   * 돌려준다. 그래서 출처 기록이 도입되기 **전에 저장된 일지**와, 출처가 빠진
   * 백업 파일로 복원한 일지도 분석에서 빠진다. 원인이 가져오기와 전혀 다르므로
   * "가져온 기록이라서 빠졌어요"라고 뭉쳐 말하면 **거짓 설명**이 된다.
   * 사용자가 할 수 있는 조치도 다르다(가져온 값은 직접 다시 적어야 하고,
   * 이쪽은 앱이 해결해야 할 몫이다).
   */
  readonly excludedNoProvenance: number
}

/**
 * 추이 화면에서 무엇이 반영되고 무엇이 빠지는지 센다 (Q1 안내용).
 *
 * 계산은 이미 옳다 — 가져온 값은 `loadAnalysisEntries()` 경로에서 제외된다.
 * 이 함수는 **빠진다는 사실을 화면이 말할 수 있게** 개수를 제공할 뿐이며,
 * 어떤 수치도 분석에 새로 넣지 않는다.
 */
export function analysisExclusionSummary(): AnalysisExclusionSummary {
  const entries = loadEntries()
  let included = 0
  let excludedImported = 0
  let excludedNoProvenance = 0
  for (const entry of entries) {
    if (toAnalysisJournalEntry(entry) !== null) included += 1
    if (!hasValueExcludedFromAnalysis(entry)) continue
    // 원인을 뭉치지 않는다. 가져온 필드가 하나라도 있으면 가져오기가 원인이고,
    // 출처 맵 자체가 없으면 구버전·복원이 원인이다.
    if (hasImportedField(entry.fieldProvenance)) excludedImported += 1
    else if (entry.fieldProvenance === undefined) excludedNoProvenance += 1
  }
  return { total: entries.length, included, excludedImported, excludedNoProvenance }
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

function isNewerSavedAt(previousSavedAt: string, nextSavedAt: string): boolean {
  const previousTime = Date.parse(previousSavedAt)
  const nextTime = Date.parse(nextSavedAt)
  return Number.isFinite(nextTime) && (!Number.isFinite(previousTime) || nextTime > previousTime)
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

export { nextJournalSavedAt, updateEntry } from "./journal-update"
export type { UpdateEntryResult } from "./journal-update"

export const LOCAL_SAVE_NOTICE = "이 기기에 저장됐어요"
export const SYNC_UPSELL_NOTICE = "온라인 보관·기기 이동은 계정 연동 후에 할 수 있어요"
