import { canonicalJournalAccess, canonicalJournalRawStorage } from "./canonical-journal-access"
import { CANONICAL_JOURNAL_SNAPSHOT_PREFIX, canonicalJournalLegacySnapshots, canonicalJournalStorageKeys, legacyJournalStorageKeys, redactCanonicalJournalOriginals, type CanonicalJournalLegacyValues } from "./canonical-journal-storage"
import { journalOwner } from "./account/local-journal-ownership"
import { JOURNAL_LOCAL_STORAGE_KEY_MAPPINGS, JOURNAL_STORAGE_KEY, JOURNAL_TOMBSTONES_STORAGE_KEY, JOURNAL_TRASH_STORAGE_KEY, LEGACY_JOURNAL_STORAGE_KEYS as KEYS, SYNC_RECOVERY_STORAGE_KEY } from "./journal-storage-keys"
import { announceLocalJournalChange } from "./journal-change-events"
import { TRASH_RETENTION_DAYS } from "./journal-trash"

export type PermanentJournalDeletionRef = {
  readonly entry: { readonly id: string }
  readonly deletedAt: string
}

type Target = { readonly id: string; readonly owner: string | null; readonly deletedAt: string }
type Source = "canonical" | "legacy" | "original"
type RecordValue = Record<string, unknown>

function record(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function parse(raw: string | null): unknown {
  return raw === null ? null : JSON.parse(raw)
}

function ownership(value: unknown): Record<string, string> | null {
  if (value === null) return {}
  if (!record(value) || value.schemaVersion !== 1 || !record(value.ownerByEntryId)) return null
  const entries = Object.entries(value.ownerByEntryId)
  return entries.every(([id, owner]) => id !== "" && typeof owner === "string" && owner !== "")
    ? Object.fromEntries(entries) as Record<string, string> : null
}

function tombstones(value: unknown): Array<{ id: string; deletedAt: string }> | null {
  if (value === null) return []
  if (!Array.isArray(value)) return null
  const items: Array<{ id: string; deletedAt: string }> = []
  for (const item of value) {
    if (!record(item) || typeof item.id !== "string" || item.id === ""
      || typeof item.deletedAt !== "string" || item.deletedAt === "") return null
    items.push({ id: item.id, deletedAt: item.deletedAt })
  }
  return items
}

/** Stable entry ids identify all earlier revisions. An earlier unbound copy
 * follows a later explicit ownership claim; another historical owner never does.
 * Core validates schemas and transaction identities before committing anything. */
function redactValues(values: CanonicalJournalLegacyValues, source: Source, targets: readonly Target[]): CanonicalJournalLegacyValues | null {
  try {
    const originals = new Map(values)
    const decoded = new Map(values.map(([key, raw]) => [key, parse(raw)]))
    const owners = ownership(decoded.get(KEYS.ownership) ?? null)
    const deleted = tombstones(decoded.get(KEYS.tombstones) ?? null)
    if (owners === null || deleted === null) return null
    const byId = new Map(targets.map(target => [target.id, target]))
    const next = new Map(originals)
    const authorize = (id: string, boundOwner: string | null = null): boolean => {
      const target = byId.get(id)
      if (!target) return true
      const historical = Object.hasOwn(owners, id) ? owners[id]! : null
      if (source === "canonical" && historical !== target.owner) return false
      if (historical !== null && historical !== target.owner) return false
      return boundOwner === null || boundOwner === target.owner
    }
    for (const target of targets) if (!authorize(target.id)) return null

    const filterEntries = (value: unknown, boundOwner: string | null = null): unknown[] | null => {
      if (!Array.isArray(value)) return null
      const seen = new Set<string>()
      const kept: unknown[] = []
      for (const entry of value) {
        if (!record(entry) || typeof entry.id !== "string" || entry.id === "" || seen.has(entry.id)) return null
        seen.add(entry.id)
        if (byId.has(entry.id)) {
          if (!authorize(entry.id, boundOwner)) return null
        } else kept.push(entry)
      }
      return kept
    }

    const journal = decoded.get(KEYS.journal)
    if (journal !== null && journal !== undefined) {
      const kept = filterEntries(journal)
      if (kept === null) return null
      // A trash purge cannot delete an active same-id journal. A restore has a new id.
      if (source === "canonical" && kept.length !== (journal as unknown[]).length) return null
      if (kept.length !== (journal as unknown[]).length) next.set(KEYS.journal, JSON.stringify(kept))
    }

    const trash = decoded.get(KEYS.trash)
    const trashIds = new Set<string>()
    if (trash !== null && trash !== undefined) {
      if (!Array.isArray(trash)) return null
      const kept: unknown[] = []
      for (const item of trash) {
        if (!record(item) || !record(item.entry) || typeof item.entry.id !== "string"
          || trashIds.has(item.entry.id)) return null
        trashIds.add(item.entry.id)
        if (byId.has(item.entry.id)) {
          if (!authorize(item.entry.id)) return null
        } else kept.push(item)
      }
      if (kept.length !== trash.length) next.set(KEYS.trash, JSON.stringify(kept))
    }
    if (source === "canonical" && targets.some(target => !trashIds.has(target.id)
      && !deleted.some(item => item.id === target.id))) return null

    const vault = decoded.get(KEYS.vault)
    if (vault !== null && vault !== undefined) {
      if (!record(vault) || !record(vault.records)) return null
      const kept = { ...vault.records }
      let changed = false
      for (const target of targets) {
        if (!Object.hasOwn(kept, target.id)) continue
        if (!authorize(target.id)) return null
        delete kept[target.id]
        changed = true
      }
      if (changed) next.set(KEYS.vault, JSON.stringify({ ...vault, records: kept }))
    }

    for (const [key, value] of decoded) {
      if (key !== KEYS.syncRecovery && !key.startsWith(`${KEYS.syncRecovery}.account.`)) continue
      if (value === null) continue
      if (!record(value) || typeof value.userId !== "string" || value.userId === "") return null
      const kept = filterEntries(value.entries, value.userId)
      if (kept === null || !Array.isArray(value.entries)) return null
      if (kept.length !== value.entries.length) next.set(key, JSON.stringify({ ...value, entries: kept }))
    }

    if (source === "canonical") {
      // Real journal deletion already creates these markers. Also protect a
      // directly restored old trash fixture without reviving the removed id.
      const merged = [...deleted]
      for (const target of targets) if (!merged.some(item => item.id === target.id)) {
        merged.push({ id: target.id, deletedAt: target.deletedAt })
      }
      if (merged.length !== deleted.length) next.set(KEYS.tombstones, JSON.stringify(merged))
    } else {
      const retainedDeletedIds = new Set(deleted.map(item => item.id))
      const kept = { ...owners }
      let changed = false
      for (const target of targets) if (!retainedDeletedIds.has(target.id) && Object.hasOwn(kept, target.id)) {
        delete kept[target.id]
        changed = true
      }
      if (changed) next.set(KEYS.ownership, Object.keys(kept).length === 0 ? null
        : JSON.stringify({ schemaVersion: 1, ownerByEntryId: kept }))
    }
    return values.map(([key]) => [key, next.get(key) ?? null] as const)
  } catch { return null }
}

/** Only permanent trash deletion, expiry/eviction, or completed new-id restore
 * calls this lifecycle. Never call it from takeFromTrash or restore rollback. */
export function permanentlyEraseJournalOriginals(storage: Storage, items: readonly PermanentJournalDeletionRef[]): boolean {
  if (items.length === 0) return true
  const targets: Target[] = []
  const ids = new Set<string>()
  for (const item of items) {
    const owner = journalOwner(item.entry.id)
    if (owner === undefined || owner !== null && typeof owner !== "string"
      || ids.has(item.entry.id) || item.entry.id === "" || item.deletedAt === "") return false
    ids.add(item.entry.id)
    targets.push({ id: item.entry.id, owner, deletedAt: item.deletedAt })
  }
  const result = redactCanonicalJournalOriginals(canonicalJournalRawStorage(storage),
    (values, context) => redactValues(values, context.source, targets))
  // Even partial cleanup may have installed a fence; every reader must recheck.
  announceLocalJournalChange()
  return result.ok
}

function retainedBodyIds(values: CanonicalJournalLegacyValues, candidateIds: ReadonlySet<string>): Set<string> | null {
  try {
    const found = new Set<string>()
    const addEntries = (entries: unknown): boolean => {
      if (!Array.isArray(entries)) return false
      for (const entry of entries) {
        if (!record(entry) || typeof entry.id !== "string" || entry.id === "") return false
        if (candidateIds.has(entry.id)) found.add(entry.id)
      }
      return true
    }
    for (const [key, raw] of values) {
      if (raw === null) continue
      const value = parse(raw)
      if (key === KEYS.journal) { if (!addEntries(value)) return null }
      else if (key === KEYS.trash) {
        if (!Array.isArray(value) || !addEntries(value.map(item => record(item) ? item.entry : null))) return null
      } else if (key === KEYS.vault) {
        if (!record(value) || !record(value.records)) return null
        for (const id of Object.keys(value.records)) if (candidateIds.has(id)) found.add(id)
      } else if (key === KEYS.syncRecovery || key.startsWith(`${KEYS.syncRecovery}.account.`)) {
        if (!record(value) || !addEntries(value.entries)) return null
      }
    }
    return found
  } catch { return null }
}

/** Retry only already-deleted ids whose recovery window is gone. Tombstones
 * prove the earlier deletion; live or recoverable records are never swept.
 * The existing tombstone limit bounds this pass, and ids already cleaned are
 * skipped rather than restaging unchanged originals on every startup. */
export function retryPermanentJournalOriginalCleanup(storage: Storage): boolean {
  const raw = canonicalJournalRawStorage(storage)
  const access = canonicalJournalAccess(raw)
  try {
    const active = parse(access.getItem(JOURNAL_STORAGE_KEY)) ?? []
    const trash = parse(access.getItem(JOURNAL_TRASH_STORAGE_KEY)) ?? []
    const deleted = tombstones(parse(access.getItem(JOURNAL_TOMBSTONES_STORAGE_KEY)))
    if (!Array.isArray(active) || !Array.isArray(trash) || deleted === null) return false
    const activeIds = new Set<string>()
    const trashIds = new Set<string>()
    for (const entry of active) {
      if (!record(entry) || typeof entry.id !== "string" || activeIds.has(entry.id)) return false
      activeIds.add(entry.id)
    }
    let unresolvedExpiry = false
    for (const item of trash) {
      if (!record(item) || !record(item.entry) || typeof item.entry.id !== "string"
        || trashIds.has(item.entry.id) || typeof item.deletedAt !== "string") return false
      trashIds.add(item.entry.id)
      const deletedMs = Date.parse(item.deletedAt)
      if (Number.isFinite(deletedMs) && Date.now() - deletedMs > TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1_000) unresolvedExpiry = true
    }
    const candidates = [...new Map(deleted.map(item => [item.id, item])).values()]
      .filter(item => !activeIds.has(item.id) && !trashIds.has(item.id))
    if (candidates.length === 0) return !unresolvedExpiry
    const candidateIds = new Set(candidates.map(item => item.id))
    const snapshots = canonicalJournalLegacySnapshots(raw)
    if (canonicalJournalStorageKeys(raw).filter(key => key.startsWith(CANONICAL_JOURNAL_SNAPSHOT_PREFIX)).length !== snapshots.length) return false
    const canonical: CanonicalJournalLegacyValues = [
      ...JOURNAL_LOCAL_STORAGE_KEY_MAPPINGS.map(mapping => [mapping.legacy, access.getItem(mapping.canonical)] as const),
      ...canonicalJournalStorageKeys(raw).filter(key => key.startsWith(`${SYNC_RECOVERY_STORAGE_KEY}.account.`))
        .map(key => [`${KEYS.syncRecovery}${key.slice(SYNC_RECOVERY_STORAGE_KEY.length)}`, access.getItem(key)] as const),
    ]
    const legacy = legacyJournalStorageKeys(raw).map(key => [key, raw.getItem(key)] as const)
    const found = new Set<string>()
    for (const values of [canonical, legacy, ...snapshots.map(snapshot => snapshot.values)]) {
      const bodyIds = retainedBodyIds(values, candidateIds)
      if (bodyIds === null) return false
      for (const id of bodyIds) found.add(id)
    }
    const retained = candidates.filter(item => found.has(item.id))
    const cleaned = permanentlyEraseJournalOriginals(raw, retained.map(item => ({ entry: { id: item.id }, deletedAt: item.deletedAt })))
    return cleaned && !unresolvedExpiry
  } catch { return false }
}
