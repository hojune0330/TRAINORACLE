import { z } from "zod"
import { parseJournalEntryList } from "../journal-schema"
import type { JournalEntry } from "../journal-schema"
import { loadEntriesOwnedBy, replaceEntriesOwnedBy } from "../journal-store"
import { SYNC_RECOVERY_STORAGE_KEY } from "../journal-storage-keys"
import { hasPrivateMemoText } from "../private-memo-vault"
import { mergeEntries } from "./sync-local"
import {
  loadTombstonesOwnedBy,
  mergeTombstones,
  saveTombstonesOwnedBy,
  tombstonedIds,
} from "./tombstone"
import type { Tombstone } from "./tombstone"
import {
  accountScopedStorageKey,
  accountScopedStorageKeyFor,
} from "./local-account-scope"

const RECOVERY_KEY = SYNC_RECOVERY_STORAGE_KEY
const MAX_RECOVERY_AGE_MS = 7 * 24 * 60 * 60 * 1_000
const MAX_FUTURE_CLOCK_SKEW_MS = 5 * 60 * 1_000

const checkpointSchema = z.object({
  version: z.literal(1),
  userId: z.string().min(1),
  startedAt: z.string().datetime(),
  entries: z.array(z.unknown()),
  tombstones: z.array(z.object({
    id: z.string().min(1),
    deletedAt: z.string().min(1),
  }).strict()),
}).strict()

type RecoveryResult = {
  readonly ok: boolean
  readonly recovered: boolean
}

function storage(): Storage | null {
  try {
    if (typeof window === "undefined") return null
    return window.localStorage
  } catch (error) {
    if (error instanceof Error) return null
    throw error
  }
}

function validEntries(values: readonly unknown[]): JournalEntry[] | null {
  const entries = parseJournalEntryList(values)
  if (entries.length !== values.length || entries.some(hasPrivateMemoText)) return null
  return entries
}

export function createSyncRecoveryCheckpoint(
  userId: string,
  entries: readonly JournalEntry[],
  tombstones: readonly Tombstone[],
): boolean {
  if (userId === "" || validEntries(entries) === null) return false
  const localStorage = storage()
  if (localStorage === null) return false
  const recoveryKey = accountScopedStorageKeyFor(RECOVERY_KEY, userId)

  const checkpoint = {
    version: 1 as const,
    userId,
    startedAt: new Date().toISOString(),
    entries,
    tombstones,
  }
  if (!checkpointSchema.safeParse(checkpoint).success) return false

  try {
    localStorage.setItem(recoveryKey, JSON.stringify(checkpoint))
    return localStorage.getItem(recoveryKey) !== null
  } catch (error) {
    if (error instanceof Error) return false
    throw error
  }
}

export function clearSyncRecoveryCheckpoint(accountScope?: string | null): boolean {
  const localStorage = storage()
  if (localStorage === null) return false
  const recoveryKey = accountScope === undefined
    ? accountScopedStorageKey(RECOVERY_KEY)
    : accountScopedStorageKeyFor(RECOVERY_KEY, accountScope)
  try {
    localStorage.removeItem(recoveryKey)
    return localStorage.getItem(recoveryKey) === null
  } catch (error) {
    if (error instanceof Error) return false
    throw error
  }
}

function clearRecoveryKey(recoveryKey: string): boolean {
  const localStorage = storage()
  if (localStorage === null) return false
  try {
    localStorage.removeItem(recoveryKey)
    return localStorage.getItem(recoveryKey) === null
  } catch (error) {
    if (error instanceof Error) return false
    throw error
  }
}

function discardCheckpoint(recoveryKey: string): RecoveryResult {
  return { ok: clearRecoveryKey(recoveryKey), recovered: false }
}

export function recoverPendingSync(userId: string, nowMs = Date.now()): RecoveryResult {
  const localStorage = storage()
  if (localStorage === null) return { ok: false, recovered: false }

  const scopedRecoveryKey = accountScopedStorageKeyFor(RECOVERY_KEY, userId)
  let recoveryKey = scopedRecoveryKey
  let raw: string | null
  try {
    raw = localStorage.getItem(recoveryKey)
    if (raw === null) {
      recoveryKey = RECOVERY_KEY
      raw = localStorage.getItem(recoveryKey)
    }
  } catch (error) {
    if (error instanceof Error) return { ok: false, recovered: false }
    throw error
  }
  if (raw === null) return { ok: true, recovered: false }

  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(raw)
  } catch (error) {
    if (error instanceof SyntaxError) return discardCheckpoint(recoveryKey)
    throw error
  }

  const parsed = checkpointSchema.safeParse(parsedJson)
  if (!parsed.success) return discardCheckpoint(recoveryKey)
  if (parsed.data.userId !== userId) {
    return recoveryKey === RECOVERY_KEY
      ? { ok: true, recovered: false }
      : discardCheckpoint(recoveryKey)
  }
  const startedAtMs = Date.parse(parsed.data.startedAt)
  if (!Number.isFinite(startedAtMs)
    || nowMs - startedAtMs > MAX_RECOVERY_AGE_MS
    || startedAtMs - nowMs > MAX_FUTURE_CLOCK_SKEW_MS) {
    return discardCheckpoint(recoveryKey)
  }
  const checkpointEntries = validEntries(parsed.data.entries)
  if (checkpointEntries === null) return discardCheckpoint(recoveryKey)

  const tombstones = mergeTombstones(parsed.data.tombstones, loadTombstonesOwnedBy(userId))
  const entries = mergeEntries(loadEntriesOwnedBy(userId), checkpointEntries, tombstonedIds(tombstones))
  if (!saveTombstonesOwnedBy(userId, tombstones)) return { ok: false, recovered: false }
  if (!replaceEntriesOwnedBy(userId, entries).ok) return { ok: false, recovered: false }
  if (!clearRecoveryKey(recoveryKey)) return { ok: false, recovered: false }
  return { ok: true, recovered: true }
}
