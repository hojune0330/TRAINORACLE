// 백업 파일 복원 — 내보낸 JSON을 다시 일지로 되돌린다.
//
// 왜 이게 필요한가 (실제 공백):
//  앱은 "내 일지 데이터 내려받기(JSON)"와 "메모 포함 파일 내보내기(JSON)"를
//  제공하고, 안내에도 "이 기기에만 저장" · "계정 연동으로 지키기"라고 쓴다.
//  그런데 **내보낸 파일을 되돌리는 경로가 없었다.** 즉 사용자가 백업을
//  받아둬도 브라우저 데이터를 지우거나 기기를 바꾸면 그 파일은 쓸 데가 없다.
//  백업을 권하면서 복원을 안 주는 것은 지키지 못할 약속이다.
//
// 원칙:
//  - 원본 파일은 기기에서 파싱한다. 계정 경로는 account-restore.ts에서 사용자가
//    확인한 기록만 암호화 계정 보관으로 보내며, 아래 구형 writer는 계정 플래그에서 차단한다.
//  - **덮어쓰기 없음(기본)**: 기존 일지를 지우지 않고 합친다. 같은 id가 있으면
//    사용자에게 선택을 남기고, 기본은 "기존 것 유지"다. 백업 복원이 지금
//    데이터를 날리는 사고를 원천 차단한다.
//  - **지운 일지는 복원되지 않는다**: tombstone에 있는 id는 건너뛴다. 지운
//    기록이 백업 파일을 통해 돌아오면 삭제권 위반이다(동기화와 같은 규칙).
//  - fail-visible: 읽지 못한 항목 수를 숨기지 않는다.
//  - 저장은 기존 쓰기 검증(parseJournalEntryForWrite)을 그대로 통과해야 한다.
//    검증을 우회하는 복원 경로를 만들지 않는다.
import { tombstonedIds } from "../account/tombstone"
import { loadSessionRecoveryCode } from "../account/private-note-sync"
import { parseJournalEntryForWrite, parseJournalEntryList } from "../journal-schema"
import type { JournalEntry } from "../journal-schema"
import { JOURNAL_STORAGE_KEY, journalStorage, writeJournalEntries } from "../journal-local-storage"
import {
  hasPrivateMemoText,
  savePrivateMemosWithJournalShells,
} from "../private-memo-vault"
import { legacyJournalWritesBlocked, loadEntries, loadJournalEntriesSnapshot } from "../journal-store"
import {
  activeDecorationStorageKeyV3,
  parseStoredDecorationState,
  saveDecorationStateIfCurrent,
} from "../decorations"
import type { DecorationState } from "../decorations"
import { z } from "zod"
import { decorationStateSchema, decorationPlacementTransformSchema, V2_SLOT_DEFAULT_TRANSFORMS } from "../decoration-schema"
import { isDecorationSlot, STARTER_DECORATION_IDS } from "../decoration-catalog"
import type { DecorationSlot } from "../decoration-catalog"
import { calendarDecorationStateSchema, calendarDecorationsOwnedBy, createEmptyCalendarDecorationState, parseStoredCalendarDecorationState, type CalendarDecorationState } from "../calendar-decoration-schema"
import { activeCalendarDecorationStorageKey, calendarDecorationReadStatus, readCalendarDecorationStateSerialized, saveCalendarDecorationStateIfCurrent } from "../calendar-decoration-store"
import { loadDecorationState } from "../decorations"
import { localAccountScopeSnapshot } from "../account/local-account-scope"
import { localJournalScopeGeneration } from "../account/local-journal-ownership"
import {
  BACKUP_JSON_IMPORT_LIMITS,
  BackupJsonLimitError,
  readBackupJsonBlob,
  type BackupJsonReadLimits,
} from "./backup-json-stream"

/** 인식하는 내보내기 형식 — journal-store.exportEntriesJSON이 쓰는 값들 */
export const SAFE_FORMAT = "trainoracle.journal.v1"
export const FULL_FORMAT_V3 = "trainoracle.journal.full-backup.v3"
export const FULL_FORMAT_V4 = "trainoracle.journal.full-backup.v4"
export const FULL_FORMAT_V5 = "trainoracle.journal.full-backup.v5"
export const FULL_FORMAT = "trainoracle.journal.full-backup.v2"
export const LEGACY_FULL_FORMAT = "trainoracle.journal.full-backup.v1"

export type BackupKind = "safe" | "full"
export type BackupReadFailure = "FILE_TOO_LARGE" | "TOO_MANY_ENTRIES" | "VALUE_TOO_LARGE"

export type BackupReadResult = {
  /** 스키마 검증을 통과한 항목 */
  readonly entries: readonly JournalEntry[]
  /** 형식이 어긋나 건너뛴 항목 수 — 숨기지 않고 보여준다 */
  readonly skipped: number
  /** 메모 포함 백업인지 — 화면 안내 문구가 달라진다 */
  readonly kind: BackupKind
  /** 파일 자체를 백업으로 인식하지 못한 경우 */
  readonly recognized: boolean
  /** 파일에 적힌 내보낸 시각 (있으면 표시용) */
  readonly exportedAt: string | null
  readonly decorations: DecorationState | null
  readonly decorationStatus: "included" | "not-included" | "invalid"
  readonly decorationItemCount: number
  readonly decorationPlacementCount: number
  readonly calendarDecorations?: CalendarDecorationState | null
  readonly calendarDecorationStatus?: "included" | "not-included" | "invalid"
  /** Present only when a user-selected Blob crossed an explicit local safety budget. */
  readonly readFailure?: BackupReadFailure
}

const UNRECOGNIZED: BackupReadResult = {
  entries: [], skipped: 0, kind: "safe", recognized: false, exportedAt: null,
  decorations: null,
  decorationStatus: "not-included",
  decorationItemCount: 0,
  decorationPlacementCount: 0,
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

/**
 * 백업 JSON 문자열 읽기. 형식을 인식하지 못하면 recognized:false로 돌려주고
 * 절대 추측해서 복원하지 않는다.
 */
export function readBackupFile(text: string): BackupReadResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return UNRECOGNIZED
  }
  return readParsedBackup(parsed)
}

/** Read a selected file without holding its entire source JSON string in memory. */
export async function readBackupBlob(
  blob: Blob,
  current: () => boolean = () => true,
  limits: BackupJsonReadLimits = BACKUP_JSON_IMPORT_LIMITS,
): Promise<BackupReadResult> {
  try {
    return readParsedBackup(await readBackupJsonBlob(blob, current, undefined, limits))
  } catch (error) {
    if (error instanceof BackupJsonLimitError) {
      const readFailure: BackupReadFailure = error.limit === "blobBytes"
        ? "FILE_TOO_LARGE"
        : error.limit === "entries" ? "TOO_MANY_ENTRIES" : "VALUE_TOO_LARGE"
      return { ...UNRECOGNIZED, readFailure }
    }
    return UNRECOGNIZED
  }
}

function readParsedBackup(parsed: unknown): BackupReadResult {
  const root = asRecord(parsed)
  if (root === null) return UNRECOGNIZED
  if (root.app !== "TRAINORACLE") return UNRECOGNIZED

  const format = root.format
  const kind: BackupKind | null = format === FULL_FORMAT_V5 || format === FULL_FORMAT_V4 || format === FULL_FORMAT_V3 || format === FULL_FORMAT || format === LEGACY_FULL_FORMAT
    ? "full"
    : format === SAFE_FORMAT ? "safe" : null
  if (kind === null) return UNRECOGNIZED

  const rawEntries = root.entries
  if (!Array.isArray(rawEntries)) return { ...UNRECOGNIZED, recognized: true, kind }

  // A legacy/safe envelope may not smuggle newly adopted evidence into an old format.
  const formatEntries = format === FULL_FORMAT_V5 || format === FULL_FORMAT_V4 ? rawEntries : rawEntries.filter(entry => {
    const record = asRecord(entry)
    return record?.fileObservation === undefined && record?.comparisonRelations === undefined
  })
  const prepared = kind === "safe" ? formatEntries.map(withEmptyTextFields) : formatEntries
  const parsedEntries = parseJournalEntryList(prepared)
  const seenIds = new Set<string>()
  const entries = parsedEntries.filter((entry) => {
    if (seenIds.has(entry.id)) return false
    seenIds.add(entry.id)
    return true
  })
  const decoration = readDecorationSection(format, root.decorations)
  const calendar = format === FULL_FORMAT_V5 ? calendarDecorationStateSchema.safeParse(root.calendarDecorations) : null
  return {
    entries,
    skipped: rawEntries.length - entries.length,
    kind,
    recognized: true,
    exportedAt: typeof root.exportedAt === "string" ? root.exportedAt : null,
    decorations: decoration.state,
    decorationStatus: decoration.status,
    decorationItemCount: decoration.state?.ownedItemIds.length ?? 0,
    decorationPlacementCount: decoration.state?.pages.reduce((total, page) => total + page.items.length, 0) ?? 0,
    calendarDecorations: calendar?.success ? calendar.data : null,
    calendarDecorationStatus: calendar === null ? "not-included" : calendar.success ? "included" : "invalid",
  }
}

function readDecorationSection(
  format: unknown,
  candidate: unknown,
): { readonly state: DecorationState | null; readonly status: BackupReadResult["decorationStatus"] } {
  if (format !== FULL_FORMAT_V5 && format !== FULL_FORMAT_V4 && format !== FULL_FORMAT_V3 && format !== FULL_FORMAT) return { state: null, status: "not-included" }
  // A v5 file may contain only calendar decorations. An absent journal-decoration
  // section has no replacement authority; a present but malformed one is invalid.
  if (format === FULL_FORMAT_V5 && candidate === undefined) return { state: null, status: "not-included" }
  if (typeof candidate !== "object" || candidate === null) return { state: null, status: "invalid" }
  const normalized = readLosslessDecorationState(candidate)
  return normalized === null
    ? { state: null, status: "invalid" }
    : { state: normalized, status: "included" }
}

const backupV2PlacementSchema = z.object({
  date: z.string(),
  slot: z.custom<DecorationSlot>(value => typeof value === "string" && isDecorationSlot(value)),
  itemId: z.string(),
  transform: decorationPlacementTransformSchema.optional(),
}).strict()

function readLosslessDecorationState(candidate: unknown): DecorationState | null {
  const source = asRecord(candidate)
  if (!source) return null
  if (source.version === 3) {
    const parsed = decorationStateSchema.safeParse(source)
    return parsed.success ? parsed.data : null
  }
  if (source.version !== 2) return null
  const normalized = parseStoredDecorationState(JSON.stringify(source))
  const rows = z.array(backupV2PlacementSchema).safeParse(source.pagePlacements)
  if (!normalized || !rows.success) return null
  // V2 slot defaults and layer ordering are supported migrations; dropped data is not.
  const { pagePlacements: _placements, ...metadata } = source
  const sourceOwned = source.ownedItemIds
  if (!Array.isArray(sourceOwned)) return null
  const ownedItemIds = [...sourceOwned, ...STARTER_DECORATION_IDS.filter(id => !sourceOwned.includes(id))]
  const preserved = decorationStateSchema.safeParse({ ...metadata, ownedItemIds, version: 3, pages: normalized.pages })
  if (!preserved.success) return null
  const canonical = (state: DecorationState) => JSON.stringify({ ...state, ownedItemIds: [...state.ownedItemIds].sort() })
  if (canonical(preserved.data) !== canonical(normalized)) return null
  const sourceItems = rows.data.map(row => ({ date: row.date, itemId: row.itemId,
    transform: row.transform ?? V2_SLOT_DEFAULT_TRANSFORMS[row.slot] }))
  const migratedItems = normalized.pages.flatMap(page => page.items.map(item => ({ date: page.date,
    itemId: item.itemId, transform: item.transform })))
  const fingerprint = (items: typeof sourceItems) => JSON.stringify(items.map(item => JSON.stringify(item)).sort())
  return fingerprint(sourceItems) === fingerprint(migratedItems) ? preserved.data : null
}

/**
 * 안전 백업(메모 제외)을 복원 가능하게 만든다.
 *
 * 안전 내보내기는 `memo` / `note` / `memoPurpose`를 **일부러 제거**한다. 그런데
 * 일지 스키마는 `memo`(또는 `note`)를 필수로 요구한다. 그래서 안전 백업
 * 파일은 그대로는 스키마 검증을 통과하지 못하고, 복원이 **전부 실패**했다.
 * 앱이 첫 번째로 권하는 백업 파일이 되돌릴 수 없는 파일이었던 셈이다.
 *
 * 여기서 하는 일은 메모·목적 태그를 지우고 필수 텍스트 자리를 빈 문자열로
 * 되돌리는 것뿐이다. 안전 형식은 메모가 없는 파일이라는 약속이므로, 사람이
 * 파일에 텍스트를 나중에 넣어도 복원 경로에서 신뢰하지 않는다. 숫자·날짜·강도
 * 같은 값은 절대 손대지 않는다.
 */
function withEmptyTextFields(raw: unknown): unknown {
  const record = asRecord(raw)
  if (record === null) return raw
  const textField = record.kind === "evening" ? "note" : "memo"
  const { memo: _memo, note: _note, memoPurpose: _memoPurpose, ...withoutMemoFields } = record
  return { ...withoutMemoFields, [textField]: "" }
}

export type RestorePlanItem = {
  readonly entry: JournalEntry
  /** 같은 id의 일지가 이미 이 기기에 있다 */
  readonly conflictsWithExisting: boolean
  /** 사용자가 지운 id — 복원 대상에서 제외된다 */
  readonly previouslyDeleted: boolean
  /** 검토할 때 있던 같은 id 기록의 정확한 값. 적용 직전 변경을 덮지 않기 위한 토큰. */
  readonly reviewedExistingSerialized: string | null
}

export type RestorePlan = {
  readonly items: readonly RestorePlanItem[]
  /** 지운 적 있어서 복원하지 않을 개수 */
  readonly blockedByDeletion: number
  /** 이미 있는 일지와 id가 겹치는 개수 */
  readonly conflicts: number
  /** 겹치지도, 지운 적도 없는 새 항목 개수 */
  readonly fresh: number
}

/**
 * 복원 계획 세우기 — 무엇이 새로 들어오고, 무엇이 겹치고, 무엇이 제외되는지
 * 저장 전에 사용자에게 그대로 보여주기 위한 순수 함수.
 */
export function buildRestorePlan(
  entries: readonly JournalEntry[],
  existing: readonly JournalEntry[] = loadEntries(),
  deletedIds: ReadonlySet<string> = tombstonedIds(),
): RestorePlan {
  const existingById = new Map(existing.map((entry) => [entry.id, JSON.stringify(entry)]))
  const items = entries.map((entry) => ({
    entry,
    conflictsWithExisting: existingById.has(entry.id),
    previouslyDeleted: deletedIds.has(entry.id),
    reviewedExistingSerialized: existingById.get(entry.id) ?? null,
  }))
  return {
    items,
    blockedByDeletion: items.filter((item) => item.previouslyDeleted).length,
    conflicts: items.filter((item) => !item.previouslyDeleted && item.conflictsWithExisting).length,
    fresh: items.filter((item) => !item.previouslyDeleted && !item.conflictsWithExisting).length,
  }
}

export type RestoreMode =
  /** 겹치는 항목은 건드리지 않는다 (기본 — 지금 데이터를 지키는 쪽) */
  | "keep-existing"
  /** 겹치는 항목을 백업 파일 내용으로 바꾼다 (사용자가 명시적으로 선택) */
  | "overwrite-conflicts"

export type DecorationRestoreMode = "keep-existing" | "replace"

export type RestoreOutcome = {
  readonly restored: number
  /** 기존 것을 지키기로 해서 건너뛴 개수 */
  readonly keptExisting: number
  /** 지운 적 있어서 제외한 개수 */
  readonly blockedByDeletion: number
  /** 쓰기 검증을 통과하지 못해 저장하지 못한 개수 */
  readonly failed: number
  readonly total: number
  readonly decorationRestore: "RESTORED" | "KEPT_EXISTING" | "NOT_INCLUDED" | "INVALID_SKIPPED" | "SAVE_FAILED" | "ROLLED_BACK"
  readonly calendarDecorationRestore?: RestoreOutcome["decorationRestore"]
  readonly commit: "COMMITTED" | "FAILED" | "ROLLED_BACK"
  readonly failureReason: "NONE" | "DECORATION_SAVE_FAILED" | "CALENDAR_DECORATION_SAVE_FAILED" | "CALENDAR_DEPENDENCY_UNVERIFIED" | "JOURNAL_SAVE_FAILED" | "RECOVERY_CODE_REQUIRED" | "STATE_CHANGED"
}

export async function restoreBackupFile(
  read: BackupReadResult,
  plan: RestorePlan,
  mode: RestoreMode = "keep-existing",
  decorationMode: DecorationRestoreMode = "keep-existing",
  calendarMode: DecorationRestoreMode = "keep-existing",
): Promise<RestoreOutcome> {
  const scope = captureRestoreScope()
  const failed = () => ({
    ...emptyRestoreOutcome(plan, "NOT_INCLUDED" as const, "FAILED" as const, "STATE_CHANGED" as const),
    failed: requestedRestoreCount(plan, mode),
    calendarDecorationRestore: read.calendarDecorationStatus === "invalid" ? "INVALID_SKIPPED" as const
      : read.calendarDecorationStatus === "included" ? "KEPT_EXISTING" as const : "NOT_INCLUDED" as const,
  })
  try {
    return await withLocalRestoreLock(scope, async () => {
      if (!restoreScopeIsCurrent(scope)) return failed()
      if (legacyJournalWritesBlocked()) return {
        ...emptyRestoreOutcome(plan, "NOT_INCLUDED", "FAILED", "JOURNAL_SAVE_FAILED"),
        failed: requestedRestoreCount(plan, mode),
        calendarDecorationRestore: read.calendarDecorationStatus === "invalid" ? "INVALID_SKIPPED"
          : read.calendarDecorationStatus === "included" ? "KEPT_EXISTING" : "NOT_INCLUDED",
      }
      const prepared = revalidateRestorePlan(plan)
      if (prepared === null || !restoreScopeIsCurrent(scope)) return failed()
      return restoreBackupFileUnlocked(read, prepared, mode, decorationMode, calendarMode, scope)
    })
  } catch {
    return failed()
  }
}

async function restoreBackupFileUnlocked(
  read: BackupReadResult,
  prepared: PreparedRestorePlan,
  mode: RestoreMode,
  decorationMode: DecorationRestoreMode,
  calendarMode: DecorationRestoreMode,
  scope: RestoreScope,
): Promise<RestoreOutcome> {
  const plan = prepared.plan
  const replaceDecorations = read.decorationStatus === "included" && read.decorations !== null && decorationMode === "replace"
  const ownership = replaceDecorations ? read.decorations! : loadDecorationState()
  const calendar = read.calendarDecorations
  const referencesOwned = calendar !== null && calendar !== undefined
    && (calendar.paperThemeId === null || ownership.ownedItemIds.includes(calendar.paperThemeId))
    && calendar.items.every(item => ownership.ownedItemIds.includes(item.itemId))
  const calendarStatus: RestoreOutcome["decorationRestore"] = read.calendarDecorationStatus === "invalid"
    || calendarMode === "replace" && read.calendarDecorationStatus === "included" && !referencesOwned ? "INVALID_SKIPPED"
    : read.calendarDecorationStatus === "included" ? "KEPT_EXISTING" : "NOT_INCLUDED"
  const replaceCalendar = calendarMode === "replace" && read.calendarDecorationStatus === "included" && referencesOwned
  if (replaceDecorations) {
    const currentCalendarStatus = calendarDecorationReadStatus()
    const currentCalendarRaw = readCalendarDecorationStateSerialized()
    const currentCalendar = currentCalendarStatus === "EMPTY" && currentCalendarRaw === null
      ? createEmptyCalendarDecorationState()
      : currentCalendarStatus === "READY" && currentCalendarRaw !== null
        ? parseStoredCalendarDecorationState(currentCalendarRaw) : null
    const calendarAfterRestore = replaceCalendar ? calendar : currentCalendar
    if (calendarAfterRestore === null || calendarAfterRestore === undefined
      || !calendarDecorationsOwnedBy(calendarAfterRestore, read.decorations!)) {
      return { ...emptyRestoreOutcome(plan, "SAVE_FAILED", "FAILED", "CALENDAR_DEPENDENCY_UNVERIFIED"),
        calendarDecorationRestore: replaceCalendar ? "SAVE_FAILED" : calendarStatus }
    }
  }
  if (replaceDecorations || replaceCalendar) {
    const decorationKey = replaceDecorations ? activeDecorationStorageKeyV3() : null
    const calendarKey = replaceCalendar ? activeCalendarDecorationStorageKey() : null
    const snapshot = takeLocalStorageSnapshot([decorationKey, calendarKey].filter((key): key is string => key !== null))
    if (snapshot === null) return { ...emptyRestoreOutcome(plan, replaceDecorations ? "SAVE_FAILED" : read.decorationStatus === "included" ? "KEPT_EXISTING" : "NOT_INCLUDED", "FAILED", replaceDecorations ? "DECORATION_SAVE_FAILED" : "CALENDAR_DECORATION_SAVE_FAILED"), calendarDecorationRestore: replaceCalendar ? "SAVE_FAILED" : calendarStatus }
    const applied: LocalStorageMutation[] = []
    if (!restoreScopeIsCurrent(scope)) return { ...emptyRestoreOutcome(plan, "SAVE_FAILED", "FAILED", "STATE_CHANGED"), calendarDecorationRestore: calendarStatus }
    if (replaceDecorations && decorationKey !== null) {
      const before = snapshotValue(snapshot, decorationKey)
      const after = JSON.stringify(read.decorations!)
      if (!saveDecorationStateIfCurrent(read.decorations!, before).ok) return { ...emptyRestoreOutcome(plan, "SAVE_FAILED", "FAILED", "DECORATION_SAVE_FAILED"), calendarDecorationRestore: calendarStatus }
      applied.push({ key: decorationKey, before, after })
    }
    if (replaceDecorations && !replaceCalendar) {
      const currentStatus = calendarDecorationReadStatus()
      const currentRaw = readCalendarDecorationStateSerialized()
      const current = currentStatus === "EMPTY" && currentRaw === null
        ? createEmptyCalendarDecorationState()
        : currentStatus === "READY" && currentRaw !== null
          ? parseStoredCalendarDecorationState(currentRaw) : null
      if (current === null || !calendarDecorationsOwnedBy(current, read.decorations!)) {
        const rollback = rollbackLocalStorageMutations(applied)
        const rolledBack = rollback.complete && !rollback.stateChanged
        return { ...emptyRestoreOutcome(plan, rolledBack ? "ROLLED_BACK" : "SAVE_FAILED", rolledBack ? "ROLLED_BACK" : "FAILED", "STATE_CHANGED"), calendarDecorationRestore: "SAVE_FAILED" }
      }
    }
    if (replaceCalendar && calendarKey !== null) {
      const before = snapshotValue(snapshot, calendarKey)
      const after = JSON.stringify(calendar!)
      if (!saveCalendarDecorationStateIfCurrent(calendar!, before).ok) {
        const rollback = rollbackLocalStorageMutations(applied)
        const rolledBack = rollback.complete && !rollback.stateChanged
        return { ...emptyRestoreOutcome(plan, replaceDecorations ? rolledBack ? "ROLLED_BACK" : "SAVE_FAILED" : "NOT_INCLUDED", rolledBack ? "ROLLED_BACK" : "FAILED", rollback.stateChanged ? "STATE_CHANGED" : "CALENDAR_DECORATION_SAVE_FAILED"), calendarDecorationRestore: "SAVE_FAILED" }
      }
      applied.push({ key: calendarKey, before, after })
    }
    if (!restoreScopeIsCurrent(scope)) {
      const rollback = rollbackLocalStorageMutations(applied)
      const rolledBack = rollback.complete && !rollback.stateChanged
      return { ...emptyRestoreOutcome(plan, replaceDecorations ? rolledBack ? "ROLLED_BACK" : "SAVE_FAILED" : "NOT_INCLUDED", rolledBack ? "ROLLED_BACK" : "FAILED", "STATE_CHANGED"), calendarDecorationRestore: "SAVE_FAILED" }
    }
    const outcome = await applyRestoreEntries(prepared, mode, scope, true)
    if (outcome.failed > 0 || outcome.commit !== "COMMITTED") {
      const rollback = rollbackLocalStorageMutations(applied)
      const rolledBack = rollback.complete && !rollback.stateChanged
      return {
        ...outcome,
        restored: 0,
        failed: Math.max(outcome.failed, requestedRestoreCount(plan, mode)),
        decorationRestore: replaceDecorations ? rolledBack ? "ROLLED_BACK" : "SAVE_FAILED" : read.decorationStatus === "included" ? "KEPT_EXISTING" : "NOT_INCLUDED",
        calendarDecorationRestore: replaceCalendar ? rolledBack ? "ROLLED_BACK" : "SAVE_FAILED" : calendarStatus,
        commit: rolledBack ? "ROLLED_BACK" : "FAILED",
        failureReason: rollback.stateChanged ? "STATE_CHANGED" : outcome.failureReason,
      }
    }
    return { ...outcome, decorationRestore: replaceDecorations ? "RESTORED" : read.decorationStatus === "invalid" ? "INVALID_SKIPPED" : read.decorationStatus === "included" ? "KEPT_EXISTING" : "NOT_INCLUDED", calendarDecorationRestore: replaceCalendar ? "RESTORED" : calendarStatus }
  }
  const outcome = await applyRestoreEntries(prepared, mode, scope)
  return {
    ...outcome,
    decorationRestore: read.decorationStatus === "invalid"
      ? "INVALID_SKIPPED"
      : read.decorationStatus === "included" ? "KEPT_EXISTING" : "NOT_INCLUDED",
    commit: outcome.restored === 0 && outcome.failed > 0 ? "FAILED" : outcome.commit,
    calendarDecorationRestore: calendarStatus,
  }
}

function emptyRestoreOutcome(
  plan: RestorePlan,
  decorationRestore: RestoreOutcome["decorationRestore"],
  commit: RestoreOutcome["commit"],
  failureReason: RestoreOutcome["failureReason"],
): RestoreOutcome {
  return {
    restored: 0,
    keptExisting: 0,
    blockedByDeletion: plan.blockedByDeletion,
    failed: 0,
    total: plan.items.length,
    decorationRestore,
    commit,
    failureReason,
  }
}

type EffectiveRestorePlanItem = RestorePlanItem & {
  readonly currentExists: boolean
  readonly changedSinceReview: boolean
}

type EffectiveRestorePlan = Omit<RestorePlan, "items"> & {
  readonly items: readonly EffectiveRestorePlanItem[]
}

type PreparedRestorePlan = {
  readonly plan: EffectiveRestorePlan
  readonly snapshot: ReturnType<typeof loadJournalEntriesSnapshot>
}

function revalidateRestorePlan(reviewed: RestorePlan): PreparedRestorePlan | null {
  const snapshot = loadJournalEntriesSnapshot()
  if (snapshot.readStatus !== "complete") return null
  const existingById = new Map(snapshot.entries.map((entry) => [entry.id, JSON.stringify(entry)]))
  const deletedIds = tombstonedIds()
  const items = reviewed.items.map((item): EffectiveRestorePlanItem => {
    const currentSerialized = existingById.get(item.entry.id) ?? null
    return {
      ...item,
      currentExists: currentSerialized !== null,
      changedSinceReview: item.reviewedExistingSerialized !== currentSerialized,
      conflictsWithExisting: item.conflictsWithExisting || currentSerialized !== null,
      previouslyDeleted: item.previouslyDeleted || deletedIds.has(item.entry.id),
    }
  })
  return {
    snapshot,
    plan: {
      items,
      blockedByDeletion: items.filter((item) => item.previouslyDeleted).length,
      conflicts: items.filter((item) => !item.previouslyDeleted && item.conflictsWithExisting).length,
      fresh: items.filter((item) => !item.previouslyDeleted && !item.conflictsWithExisting).length,
    },
  }
}

type RestoreScope = { readonly owner: string | null; readonly generation: number }

function captureRestoreScope(): RestoreScope {
  return { owner: localAccountScopeSnapshot(), generation: localJournalScopeGeneration() }
}

function restoreScopeIsCurrent(scope: RestoreScope): boolean {
  return localAccountScopeSnapshot() === scope.owner && localJournalScopeGeneration() === scope.generation
}

async function withLocalRestoreLock<T>(_scope: RestoreScope, run: () => T | Promise<T>): Promise<T> {
  const locks = globalThis.navigator?.locks
  if (!locks) return await run()
  return await locks.request(
    "trainoracle-local-profile-restore:v1",
    { mode: "exclusive" },
    run,
  )
}

type LocalStorageSnapshot = readonly (readonly [key: string, value: string | null])[]
type LocalStorageMutation = { readonly key: string; readonly before: string | null; readonly after: string }

function takeLocalStorageSnapshot(keys: readonly string[]): LocalStorageSnapshot | null {
  const storage = journalStorage()
  if (storage === null) return null
  try {
    return [...new Set(keys)].map((key) => [key, storage.getItem(key)] as const)
  } catch {
    return null
  }
}

function snapshotValue(snapshot: LocalStorageSnapshot, key: string): string | null {
  return snapshot.find(([snapshotKey]) => snapshotKey === key)?.[1] ?? null
}

/** Revert only values this restore still owns; a newer tab/account value always wins. */
function rollbackLocalStorageMutations(mutations: readonly LocalStorageMutation[]): {
  readonly complete: boolean
  readonly stateChanged: boolean
} {
  const storage = journalStorage()
  if (storage === null) return { complete: false, stateChanged: false }
  try {
    let complete = true
    let stateChanged = false
    for (const { key, before, after } of [...mutations].reverse()) {
      const current = storage.getItem(key)
      if (current === before) continue
      if (current !== after) {
        stateChanged = true
        continue
      }
      if (before === null) storage.removeItem(key)
      else storage.setItem(key, before)
      if (storage.getItem(key) !== before) complete = false
    }
    return { complete, stateChanged }
  } catch {
    return { complete: false, stateChanged: false }
  }
}

function requestedRestoreCount(plan: RestorePlan, mode: RestoreMode): number {
  return plan.items.filter((item) => !item.previouslyDeleted
    && (mode === "overwrite-conflicts" || !item.conflictsWithExisting)).length
}

/**
 * 실제 복원.
 *
 * 검증은 기존 쓰기 경로와 동일한 규칙을 쓴다 — 복원이라고 해서 스키마 검증을
 * 우회하지 않는다. 겹치는 항목을 바꿀 때는 append가 아니라 교체여야 하므로
 * (그렇지 않으면 같은 id가 두 개 생긴다) 검증 통과분으로 목록을 재구성한다.
 * 어떤 실패에서도 이미 있던 일지는 지워지지 않는다.
 */
export async function restoreEntries(
  plan: RestorePlan,
  mode: RestoreMode = "keep-existing",
): Promise<RestoreOutcome> {
  const scope = captureRestoreScope()
  const failed = () => ({
    ...emptyRestoreOutcome(plan, "NOT_INCLUDED" as const, "FAILED" as const, "STATE_CHANGED" as const),
    failed: requestedRestoreCount(plan, mode),
  })
  try {
    return await withLocalRestoreLock(scope, async () => {
      if (!restoreScopeIsCurrent(scope)) return failed()
      if (legacyJournalWritesBlocked()) return {
        ...emptyRestoreOutcome(plan, "NOT_INCLUDED", "FAILED", "JOURNAL_SAVE_FAILED"),
        failed: requestedRestoreCount(plan, mode),
      }
      const prepared = revalidateRestorePlan(plan)
      return prepared === null ? failed() : applyRestoreEntries(prepared, mode, scope)
    })
  } catch {
    return failed()
  }
}

async function applyRestoreEntries(
  prepared: PreparedRestorePlan,
  mode: RestoreMode,
  scope: RestoreScope,
  requireAll = false,
): Promise<RestoreOutcome> {
  const { plan, snapshot } = prepared
  let keptExisting = 0
  let failed = 0
  let failureReason: RestoreOutcome["failureReason"] = "NONE"
  const accepted: JournalEntry[] = []

  for (const item of plan.items) {
    if (item.previouslyDeleted) continue

    if (item.changedSinceReview) {
      if (mode === "keep-existing" && item.currentExists) keptExisting += 1
      else {
        failed += 1
        failureReason = "STATE_CHANGED"
      }
      continue
    }

    if (item.conflictsWithExisting && mode === "keep-existing") {
      keptExisting += 1
      continue
    }

    // 복원한 일지는 이 기기 소유로 되돌린다 — 서버 상태를 가정하지 않는다.
    //
    // 출처(fieldProvenance)는 파일 값을 그대로 보존한다. 손댄 파일이 EXPLICIT을
    // 주장할 수 있다는 점은 검토했고, 강등하지 않기로 했다:
    //  - 위협 모델상 공격자는 곧 사용자 본인이다. 자기 기기의 자기 통계이고,
    //    같은 값을 화면에 직접 입력하면 어차피 EXPLICIT이 된다. 강등은
    //    막을 수 없는 것을 막는 시늉이다.
    //  - 반면 강등하면 **정상 사용자**의 백업 복원 시 통계가 조용히 비어버린다.
    //    실제 피해가 확실한 쪽은 이쪽이다.
    // 남이 보낸 파일을 받아 넣는 경로가 생기면 이 판단은 다시 해야 한다.
    const candidate = parseJournalEntryForWrite({ ...item.entry, syncState: "local" })
    if (candidate === null) {
      failed += 1
      failureReason = "JOURNAL_SAVE_FAILED"
      continue
    }

    accepted.push(candidate)
  }

  if (requireAll && failed > 0) return {
    restored: 0, keptExisting, blockedByDeletion: plan.blockedByDeletion, failed,
    total: plan.items.length, decorationRestore: "NOT_INCLUDED", commit: "FAILED", failureReason,
  }

  const privateEntries = accepted.filter(hasPrivateMemoText)
  let restored = 0
  const storage = journalStorage()
  const acceptedIds = new Set(accepted.map((entry) => entry.id))
  const commitGuard = () => restoreScopeIsCurrent(scope)
    && [...tombstonedIds()].every((id) => !acceptedIds.has(id))
  const next = buildRestoredEntries(snapshot.entries, accepted)

  if (privateEntries.length > 0) {
    const recoveryCode = loadSessionRecoveryCode()
    if (storage !== null && recoveryCode !== null) {
      const written = await savePrivateMemosWithJournalShells(
        storage,
        next,
        privateEntries,
        recoveryCode,
        snapshot.raw,
        commitGuard,
      )
      if (written !== null) restored = accepted.length
      else {
        failed += accepted.length
        failureReason = commitGuard() ? "JOURNAL_SAVE_FAILED" : "STATE_CHANGED"
      }
    } else {
      failed += accepted.length
      failureReason = recoveryCode === null ? "RECOVERY_CODE_REQUIRED" : "JOURNAL_SAVE_FAILED"
    }
  } else if (accepted.length > 0 && storage !== null && commitGuard()) {
    const after = JSON.stringify(next)
    if (writeJournalEntries(storage, next, snapshot.raw) && commitGuard()) restored = accepted.length
    else {
      if (storage.getItem(JOURNAL_STORAGE_KEY) === after) {
        writeJournalEntries(storage, snapshot.entries, after)
      }
      failed += accepted.length
      failureReason = commitGuard() ? "JOURNAL_SAVE_FAILED" : "STATE_CHANGED"
    }
  } else if (accepted.length > 0) {
    failed += accepted.length
    failureReason = "STATE_CHANGED"
  }

  return {
    restored,
    keptExisting,
    blockedByDeletion: plan.blockedByDeletion,
    failed,
    total: plan.items.length,
    decorationRestore: "NOT_INCLUDED",
    commit: restored === 0 && failed > 0 ? "FAILED" : "COMMITTED",
    failureReason,
  }
}

function buildRestoredEntries(
  existing: readonly JournalEntry[],
  accepted: readonly JournalEntry[],
): JournalEntry[] {
  const replacements = new Map(accepted.map((entry) => [entry.id, entry]))
  const existingIds = new Set(existing.map((entry) => entry.id))
  return [
    ...existing.map((entry) => replacements.get(entry.id) ?? entry),
    ...accepted.filter((entry) => !existingIds.has(entry.id)),
  ]
}
