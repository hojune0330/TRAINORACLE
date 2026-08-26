import {
  DECORATION_CATALOG,
  isDecorationId,
  isPaidDecorationId,
} from "./decoration-catalog"
import type { DecorationId } from "./decoration-catalog"
import {
  createEmptyDecorationState,
  decorationStateSchema,
  migrateLegacyDecorationState,
  parseStoredDecorationState,
} from "./decoration-schema"
import type { DecorationState } from "./decoration-schema"
import { accountScopedStorageKey } from "./account/local-account-scope"

export const DECORATION_STORAGE_KEY_V1 = "trainoracle.decorations.v1"
export const DECORATION_STORAGE_KEY_V2 = "trainoracle.decorations.v2"

export function activeDecorationStorageKeyV1(): string {
  return accountScopedStorageKey(DECORATION_STORAGE_KEY_V1)
}

export function activeDecorationStorageKeyV2(): string {
  return accountScopedStorageKey(DECORATION_STORAGE_KEY_V2)
}

export function readDecorationStateSerialized(): string | null {
  const storage = currentStorage()
  if (storage === null) return null
  const result = readStorage(storage, activeDecorationStorageKeyV2())
  return result.ok ? result.value : null
}

export type DecorationSaveFailureCode = "INVALID_STATE" | "STORAGE_UNAVAILABLE" | "STALE_STATE" | "WRITE_FAILED" | "READBACK_MISMATCH" | "ROLLBACK_FAILED"
export type DecorationSaveResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: DecorationSaveFailureCode }

export type DecorationPurchase =
  | { readonly kind: "PURCHASED"; readonly state: DecorationState; readonly remainingPoints: number }
  | { readonly kind: "ALREADY_OWNED"; readonly state: DecorationState; readonly remainingPoints: number }
  | { readonly kind: "INSUFFICIENT_POINTS"; readonly state: DecorationState; readonly remainingPoints: number }
  | { readonly kind: "UNKNOWN_ITEM"; readonly state: DecorationState; readonly remainingPoints: number }
  | {
    readonly kind: "SAVE_FAILED"
    readonly state: DecorationState
    readonly remainingPoints: number
    readonly code: DecorationSaveFailureCode
  }

type StorageReadResult =
  | { readonly ok: true; readonly value: string | null }
  | { readonly ok: false }

function currentStorage(): Storage | null {
  return typeof window === "undefined" ? null : window.localStorage
}

function readStorage(storage: Storage, key: string): StorageReadResult {
  try {
    return { ok: true, value: storage.getItem(key) }
  } catch (error) {
    if (error instanceof Error) return { ok: false }
    throw error
  }
}

export function saveDecorationState(candidate: unknown): DecorationSaveResult {
  return saveDecorationStateIfCurrent(candidate, undefined)
}

export function saveDecorationStateIfCurrent(
  candidate: unknown,
  expectedSerialized: string | null | undefined,
): DecorationSaveResult {
  const parsed = decorationStateSchema.safeParse(candidate)
  if (!parsed.success) return { ok: false, code: "INVALID_STATE" }
  const storage = currentStorage()
  if (storage === null) return { ok: false, code: "STORAGE_UNAVAILABLE" }
  const storageKey = activeDecorationStorageKeyV2()
  const serialized = JSON.stringify(parsed.data)
  const previous = readStorage(storage, storageKey)
  if (!previous.ok) return { ok: false, code: "STORAGE_UNAVAILABLE" }
  if (expectedSerialized !== undefined && previous.value !== expectedSerialized) {
    return { ok: false, code: "STALE_STATE" }
  }
  if (previous.value !== null && parseStoredDecorationState(previous.value) === null) {
    return { ok: false, code: "INVALID_STATE" }
  }

  const rollback = (): boolean => restoreStorageValue(storage, storageKey, previous.value)

  try {
    storage.setItem(storageKey, serialized)
  } catch (error) {
    if (error instanceof DOMException || error instanceof Error) {
      return rollback() ? { ok: false, code: "WRITE_FAILED" } : { ok: false, code: "ROLLBACK_FAILED" }
    }
    throw error
  }

  const readback = readStorage(storage, storageKey)
  if (!readback.ok || readback.value !== serialized) {
    return rollback() ? { ok: false, code: "READBACK_MISMATCH" } : { ok: false, code: "ROLLBACK_FAILED" }
  }
  const verified = parseStoredDecorationState(readback.value)
  if (verified !== null) return { ok: true }
  return rollback() ? { ok: false, code: "READBACK_MISMATCH" } : { ok: false, code: "ROLLBACK_FAILED" }
}

function restoreStorageValue(storage: Storage, storageKey: string, previous: string | null): boolean {
  const current = readStorage(storage, storageKey)
  if (current.ok && current.value === previous) return true
  try {
    if (previous === null) storage.removeItem(storageKey)
    else storage.setItem(storageKey, previous)
    const readback = readStorage(storage, storageKey)
    return readback.ok && readback.value === previous
  } catch (error) {
    if (error instanceof DOMException || error instanceof Error) return false
    throw error
  }
}

export function loadDecorationState(): DecorationState {
  const fallback = createEmptyDecorationState()
  const storage = currentStorage()
  if (storage === null) return fallback

  const v2 = readStorage(storage, activeDecorationStorageKeyV2())
  if (!v2.ok) return fallback
  if (v2.value !== null) return parseStoredDecorationState(v2.value) ?? fallback

  const v1 = readStorage(storage, activeDecorationStorageKeyV1())
  if (!v1.ok) return fallback
  if (v1.value !== null) {
    const migrated = migrateLegacyDecorationState(v1.value)
    if (migrated === null) return fallback
    saveDecorationState(migrated)
    return migrated
  }

  saveDecorationState(fallback)
  return fallback
}

export function rememberDecorationUse(state: DecorationState, itemId: DecorationId): DecorationState {
  const recentItemIds = [itemId, ...state.library.recentItemIds.filter((candidate) => candidate !== itemId)].slice(0, 8)
  return decorationStateSchema.parse({
    ...state,
    library: { ...state.library, recentItemIds },
  })
}

export function toggleFavoriteDecoration(state: DecorationState, itemId: DecorationId): DecorationState {
  const favoriteItemIds = state.library.favoriteItemIds.includes(itemId)
    ? state.library.favoriteItemIds.filter((candidate) => candidate !== itemId)
    : [...state.library.favoriteItemIds, itemId]
  return decorationStateSchema.parse({
    ...state,
    library: { ...state.library, favoriteItemIds },
  })
}

export function purchaseDecoration(
  earnedPoints: number,
  state: DecorationState,
  itemId: string,
  expectedSerialized?: string | null,
): DecorationPurchase {
  const item = DECORATION_CATALOG.find((candidate) => candidate.id === itemId)
  const available = Math.max(0, earnedPoints - state.spentPoints)
  if (item === undefined || !isDecorationId(itemId)) {
    return { kind: "UNKNOWN_ITEM", state, remainingPoints: available }
  }
  if (item.starterOwned || state.ownedItemIds.includes(itemId)) {
    return { kind: "ALREADY_OWNED", state, remainingPoints: available }
  }
  if (!isPaidDecorationId(itemId)) return { kind: "UNKNOWN_ITEM", state, remainingPoints: available }
  if (available < item.cost) return { kind: "INSUFFICIENT_POINTS", state, remainingPoints: available }

  const next = decorationStateSchema.parse({
    ...state,
    spentPoints: state.spentPoints + item.cost,
    ownedItemIds: [...state.ownedItemIds, itemId],
  })
  const saved = saveDecorationStateIfCurrent(next, expectedSerialized)
  if (!saved.ok) return { kind: "SAVE_FAILED", state, remainingPoints: available, code: saved.code }
  return { kind: "PURCHASED", state: next, remainingPoints: available - item.cost }
}

export function decorationItemOwned(state: DecorationState, itemId: DecorationId): boolean {
  return state.ownedItemIds.includes(itemId)
}
