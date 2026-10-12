import { parseJournalEntry } from "./journal-schema"
import { bodyPartMetadataSnapshotSupported } from "./body-part-metadata"
import {
  CANONICAL_JOURNAL_STORAGE_PREFIX,
  JOURNAL_LOCAL_STORAGE_KEY_MAPPINGS,
  JOURNAL_SESSION_STORAGE_KEY_MAPPINGS,
  LEGACY_JOURNAL_STORAGE_KEYS,
  SYNC_RECOVERY_STORAGE_KEY,
} from "./journal-storage-keys"

export const CANONICAL_JOURNAL_MANIFEST_KEY = "to-local-journal.migration.v1"
export const CANONICAL_JOURNAL_SNAPSHOT_PREFIX = "to-local-journal.originals.v1."
export const CANONICAL_JOURNAL_MIGRATION_LOCK = "to-local-journal.migration.v1"
export const CANONICAL_JOURNAL_SESSION_MIGRATION_KEY = "to-local-journal.session-migration.v1"
export const CANONICAL_JOURNAL_LIFECYCLE_INTENT_PREFIX = "to-local-journal.lifecycle.v1."

export type CanonicalJournalStorageReason =
  | "STORAGE_UNAVAILABLE" | "LOCK_UNAVAILABLE" | "SOURCE_CORRUPT" | "SOURCE_UNSUPPORTED"
  | "CANONICAL_CORRUPT" | "CANONICAL_UNSUPPORTED" | "EXISTING_CANONICAL_STATE"
  | "MIGRATION_INCOMPLETE" | "SOURCE_CHANGED" | "LEGACY_CHANGED"
  | "WRITE_UNCONFIRMED" | "SESSION_CONFLICT" | "STALE_CONFIRMATION" | "ERASE_INCOMPLETE"

export type CanonicalJournalStorageStatus =
  | { readonly status: "ready" }
  | { readonly status: "conflict"; readonly reason: "LEGACY_CHANGED"; readonly conflictToken: string }
  | { readonly status: "unavailable"; readonly reason: CanonicalJournalStorageReason }

export type CanonicalJournalLockRunner = <T>(operation: () => Promise<T>) => Promise<T>
export type CanonicalJournalLegacyValues = readonly (readonly [key: string, raw: string | null])[]
export type CanonicalJournalLegacySnapshot = {
  readonly key: string
  readonly values: CanonicalJournalLegacyValues
}
export type CanonicalJournalLifecycleResult = {
  readonly ok: boolean
  readonly cleared: number
  readonly failed: readonly string[]
}
export type CanonicalJournalOriginalTransform = (
  values: CanonicalJournalLegacyValues,
  context: { readonly source: "canonical" | "legacy" | "original"; readonly snapshotKey?: string },
) => CanonicalJournalLegacyValues | null
export type CanonicalJournalManifest = {
  readonly schemaVersion: 1
  readonly phase: "copying" | "ready" | "redacting" | "erasing" | "erased"
  readonly revision: string
  readonly initialSnapshotKey: string
  readonly comparisonSnapshotKey: string
  readonly acknowledgedSnapshotKeys: readonly string[]
  readonly lifecycleIntentKey?: string
  readonly lifecycleCanonicalSnapshotKey?: string
  readonly lifecycleCompletedPhase?: "ready" | "erased"
  readonly lifecyclePreservedKeys?: readonly string[]
}

type LifecycleOperation = { readonly key: string; readonly before: string | null; readonly after: string | null }
type LifecycleIntent = {
  readonly schemaVersion: 1
  readonly phase: "redacting" | "erasing"
  readonly completedManifest: CanonicalJournalManifest
  readonly operations: readonly LifecycleOperation[]
  readonly canonicalAfter: CanonicalJournalLegacyValues
  readonly preservedKeys: readonly string[]
}

type SnapshotEnvelope = { readonly schemaVersion: 1; readonly values: CanonicalJournalLegacyValues }
type ConflictProof = {
  readonly token: string
  readonly manifestRaw: string
  readonly source: CanonicalJournalLegacyValues
  readonly canonical: CanonicalJournalLegacyValues
}
type Validation = "valid" | "corrupt" | "unsupported"
const conflicts = new WeakMap<Storage, ConflictProof>()
const snapshotCache = new WeakMap<Storage, Map<string, { readonly raw: string; readonly snapshot: CanonicalJournalLegacySnapshot | null }>>()
const validationCache = new WeakMap<Storage, Map<string, { readonly raw: string | null; readonly validation: Validation }>>()
const accountSegment = ".account."

function unavailable(reason: CanonicalJournalStorageReason): CanonicalJournalStorageStatus {
  return { status: "unavailable", reason }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).every(key => keys.includes(key))
}

function randomId(): string {
  // Neither identifiers nor confirmation tokens are fingerprints of private data.
  return globalThis.crypto.randomUUID()
}

function enumerate(target: Storage, predicate: (key: string) => boolean): string[] {
  const keys: string[] = []
  for (let index = 0; index < target.length; index += 1) {
    const key = target.key(index)
    if (key !== null && predicate(key)) keys.push(key)
  }
  return [...new Set(keys)].sort()
}

export function legacyJournalStorageKeys(target: Storage): string[] {
  return [...new Set([
    ...JOURNAL_LOCAL_STORAGE_KEY_MAPPINGS.map(mapping => mapping.legacy),
    ...enumerate(target, key => key.startsWith(`${LEGACY_JOURNAL_STORAGE_KEYS.syncRecovery}${accountSegment}`)),
  ])].sort()
}

export function canonicalJournalStorageKeys(target: Storage): string[] {
  return enumerate(target, key => key.startsWith(CANONICAL_JOURNAL_STORAGE_PREFIX))
}

export function canonicalJournalKeyForLegacy(key: string): string | null {
  const mapping = JOURNAL_LOCAL_STORAGE_KEY_MAPPINGS.find(candidate => candidate.legacy === key)
  if (mapping !== undefined) return mapping.canonical
  const prefix = `${LEGACY_JOURNAL_STORAGE_KEYS.syncRecovery}${accountSegment}`
  return key.startsWith(prefix) ? `${SYNC_RECOVERY_STORAGE_KEY}${key.slice(LEGACY_JOURNAL_STORAGE_KEYS.syncRecovery.length)}` : null
}

function sameValues(left: CanonicalJournalLegacyValues, right: CanonicalJournalLegacyValues): boolean {
  return left.length === right.length && left.every(([key, raw], index) =>
    right[index]?.[0] === key && right[index]?.[1] === raw)
}

function readValues(target: Storage, keys: readonly string[]): CanonicalJournalLegacyValues {
  return keys.map(key => [key, target.getItem(key)] as const)
}

function readLegacyValues(target: Storage): CanonicalJournalLegacyValues {
  const first = readValues(target, legacyJournalStorageKeys(target))
  const second = readValues(target, legacyJournalStorageKeys(target))
  if (!sameValues(first, second)) throw new Error("SOURCE_CHANGED")
  return second
}

function sourceMatches(target: Storage, values: CanonicalJournalLegacyValues): boolean {
  return sameValues(readLegacyValues(target), values)
}

function readCanonicalValues(target: Storage): CanonicalJournalLegacyValues {
  const keys = [...new Set([
    ...JOURNAL_LOCAL_STORAGE_KEY_MAPPINGS.map(mapping => mapping.canonical),
    ...enumerate(target, key => key.startsWith(`${SYNC_RECOVERY_STORAGE_KEY}${accountSegment}`)),
  ])].sort()
  return readValues(target, keys)
}

function manifestFromRaw(raw: string | null): CanonicalJournalManifest | null {
  if (raw === null) return null
  try {
    const value: unknown = JSON.parse(raw)
    if (!isRecord(value) || value.schemaVersion !== 1
      || !["copying", "ready", "redacting", "erasing", "erased"].includes(String(value.phase))
      || typeof value.revision !== "string" || value.revision === ""
      || typeof value.initialSnapshotKey !== "string" || !value.initialSnapshotKey.startsWith(CANONICAL_JOURNAL_SNAPSHOT_PREFIX)
      || typeof value.comparisonSnapshotKey !== "string" || !value.comparisonSnapshotKey.startsWith(CANONICAL_JOURNAL_SNAPSHOT_PREFIX)
      || !Array.isArray(value.acknowledgedSnapshotKeys)
      || !value.acknowledgedSnapshotKeys.every(key => typeof key === "string" && key.startsWith(CANONICAL_JOURNAL_SNAPSHOT_PREFIX))
      || (value.lifecycleIntentKey !== undefined && (typeof value.lifecycleIntentKey !== "string"
        || !value.lifecycleIntentKey.startsWith(CANONICAL_JOURNAL_LIFECYCLE_INTENT_PREFIX)))
      || (value.lifecycleCanonicalSnapshotKey !== undefined && (typeof value.lifecycleCanonicalSnapshotKey !== "string"
        || !value.lifecycleCanonicalSnapshotKey.startsWith(CANONICAL_JOURNAL_SNAPSHOT_PREFIX)))
      || (value.lifecycleCompletedPhase !== undefined && value.lifecycleCompletedPhase !== "ready" && value.lifecycleCompletedPhase !== "erased")
      || (value.lifecyclePreservedKeys !== undefined && (!Array.isArray(value.lifecyclePreservedKeys)
        || !value.lifecyclePreservedKeys.every(key => typeof key === "string" && key.startsWith(CANONICAL_JOURNAL_SNAPSHOT_PREFIX))))
      || !hasOnlyKeys(value, ["schemaVersion", "phase", "revision", "initialSnapshotKey", "comparisonSnapshotKey", "acknowledgedSnapshotKeys",
        "lifecycleIntentKey", "lifecycleCanonicalSnapshotKey", "lifecycleCompletedPhase", "lifecyclePreservedKeys"])) return null
    return value as unknown as CanonicalJournalManifest
  } catch { return null }
}

export function readCanonicalJournalManifest(target: Storage): CanonicalJournalManifest | null {
  try { return manifestFromRaw(target.getItem(CANONICAL_JOURNAL_MANIFEST_KEY)) }
  catch { return null }
}

function parseSnapshot(key: string, raw: string | null): CanonicalJournalLegacySnapshot | null {
  if (raw === null) return null
  try {
    const value: unknown = JSON.parse(raw)
    if (!isRecord(value) || value.schemaVersion !== 1 || !Array.isArray(value.values)
      || !hasOnlyKeys(value, ["schemaVersion", "values"])) return null
    const values: (readonly [string, string | null])[] = []
    for (const item of value.values) {
      if (!Array.isArray(item) || item.length !== 2 || typeof item[0] !== "string"
        || (item[1] !== null && typeof item[1] !== "string") || canonicalJournalKeyForLegacy(item[0]) === null) return null
      values.push([item[0], item[1]])
    }
    if (new Set(values.map(([source]) => source)).size !== values.length
      || JOURNAL_LOCAL_STORAGE_KEY_MAPPINGS.some(mapping => !values.some(([source]) => source === mapping.legacy))) return null
    values.sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    return { key, values }
  } catch { return null }
}

export function canonicalJournalLegacySnapshots(target: Storage): readonly CanonicalJournalLegacySnapshot[] {
  // Include unreferenced staging/ACK snapshots: they also contain private originals.
  return canonicalJournalStorageKeys(target)
    .filter(key => key.startsWith(CANONICAL_JOURNAL_SNAPSHOT_PREFIX))
    .map(key => readSnapshot(target, key))
    .filter((value): value is CanonicalJournalLegacySnapshot => value !== null)
}

function readSnapshot(target: Storage, key: string): CanonicalJournalLegacySnapshot | null {
  const raw = target.getItem(key)
  let cache = snapshotCache.get(target)
  if (cache === undefined) { cache = new Map(); snapshotCache.set(target, cache) }
  if (raw === null) { cache.delete(key); return null }
  const previous = cache.get(key)
  if (previous?.raw === raw) return previous.snapshot
  const snapshot = parseSnapshot(key, raw)
  cache.set(key, { raw, snapshot })
  if (cache.size > 8) cache.delete(cache.keys().next().value!)
  return snapshot
}

function validateEntries(value: unknown): Validation {
  if (!Array.isArray(value)) return "corrupt"
  if (value.some(entry => isRecord(entry) && entry.bodyPartMetadata !== undefined
    && !bodyPartMetadataSnapshotSupported(JSON.stringify([entry])))) return "unsupported"
  for (const entry of value) {
    if (!isRecord(entry)) return "corrupt"
    if (entry.bodyPartMetadata !== undefined && !bodyPartMetadataSnapshotSupported(JSON.stringify([entry]))) return "unsupported"
    const parsed = parseJournalEntry(entry)
    if (parsed === null) return "corrupt"
    // Existing purpose/provenance normalization stays readable. A future field
    // an older whole-array writer would discard is held for explicit recovery.
    if (Object.keys(entry).some(key => !Object.hasOwn(parsed, key))) return "unsupported"
  }
  return "valid"
}

function validateEncryptedRecord(value: unknown): Validation {
  if (!isRecord(value) || !isRecord(value.encrypted)) return "corrupt"
  const encrypted = value.encrypted
  if (encrypted.version !== 1 || encrypted.algorithm !== "AES-GCM"
    || encrypted.derivation !== "PBKDF2-SHA-256" || encrypted.iterations !== 210_000) return "unsupported"
  if (!["salt", "iv", "ciphertext"].every(key => typeof encrypted[key] === "string" && encrypted[key] !== "")) return "corrupt"
  return hasOnlyKeys(value, ["encrypted"])
    && hasOnlyKeys(encrypted, ["version", "algorithm", "derivation", "iterations", "salt", "iv", "ciphertext"])
    ? "valid" : "unsupported"
}

function validateTombstones(value: unknown): Validation {
  if (!Array.isArray(value)) return "corrupt"
  for (const item of value) {
    if (!isRecord(item) || typeof item.id !== "string" || item.id === ""
      || typeof item.deletedAt !== "string" || item.deletedAt === "") return "corrupt"
    if (!hasOnlyKeys(item, ["id", "deletedAt"])) return "unsupported"
  }
  return "valid"
}

function validateStoredValue(legacyKey: string, raw: string | null): Validation {
  if (raw === null) return "valid"
  let value: unknown
  try { value = JSON.parse(raw) } catch { return "corrupt" }
  if (legacyKey === LEGACY_JOURNAL_STORAGE_KEYS.journal) return validateEntries(value)
  if (legacyKey === LEGACY_JOURNAL_STORAGE_KEYS.vault) {
    if (!isRecord(value) || !isRecord(value.records)) return "corrupt"
    if (value.version !== 1 || !hasOnlyKeys(value, ["version", "records"])) return "unsupported"
    for (const [id, record] of Object.entries(value.records)) {
      if (id === "") return "corrupt"
      const valid = validateEncryptedRecord(record)
      if (valid !== "valid") return valid
    }
    return "valid"
  }
  if (legacyKey === LEGACY_JOURNAL_STORAGE_KEYS.ownership) {
    if (!isRecord(value) || !isRecord(value.ownerByEntryId)) return "corrupt"
    if (value.schemaVersion !== 1 || !hasOnlyKeys(value, ["schemaVersion", "ownerByEntryId"])) return "unsupported"
    return Object.entries(value.ownerByEntryId).every(([id, owner]) => id !== "" && typeof owner === "string" && owner !== "")
      ? "valid" : "corrupt"
  }
  if (legacyKey === LEGACY_JOURNAL_STORAGE_KEYS.trash) {
    if (!Array.isArray(value)) return "corrupt"
    for (const item of value) {
      if (!isRecord(item) || typeof item.deletedAt !== "string" || item.deletedAt === "") return "corrupt"
      if (!hasOnlyKeys(item, ["entry", "deletedAt", "privateMemo"])) return "unsupported"
      const validEntry = validateEntries([item.entry])
      if (validEntry !== "valid") return validEntry
      if (item.privateMemo !== undefined) {
        const validPrivate = validateEncryptedRecord(item.privateMemo)
        if (validPrivate !== "valid") return validPrivate
      }
    }
    return "valid"
  }
  if (legacyKey === LEGACY_JOURNAL_STORAGE_KEYS.tombstones) return validateTombstones(value)
  if (legacyKey === LEGACY_JOURNAL_STORAGE_KEYS.syncRecovery
    || legacyKey.startsWith(`${LEGACY_JOURNAL_STORAGE_KEYS.syncRecovery}${accountSegment}`)) {
    if (!isRecord(value) || typeof value.userId !== "string" || value.userId === ""
      || typeof value.startedAt !== "string" || !Number.isFinite(Date.parse(value.startedAt))) return "corrupt"
    if (value.version !== 1 || !hasOnlyKeys(value, ["version", "userId", "startedAt", "entries", "tombstones"])) return "unsupported"
    if (legacyKey !== LEGACY_JOURNAL_STORAGE_KEYS.syncRecovery) {
      try {
        if (decodeURIComponent(legacyKey.slice(`${LEGACY_JOURNAL_STORAGE_KEYS.syncRecovery}${accountSegment}`.length)) !== value.userId) return "corrupt"
      } catch { return "corrupt" }
    }
    const entries = validateEntries(value.entries)
    return entries !== "valid" ? entries : validateTombstones(value.tombstones)
  }
  return "unsupported"
}

function validateValues(values: CanonicalJournalLegacyValues): Validation {
  for (const [key, raw] of values) {
    const valid = validateStoredValue(key, raw)
    if (valid !== "valid") return valid
  }
  return "valid"
}

function validateCanonicalValues(target: Storage): Validation {
  let cache = validationCache.get(target)
  if (cache === undefined) { cache = new Map(); validationCache.set(target, cache) }
  let corrupt = false
  for (const [key, raw] of readCanonicalValues(target)) {
    const direct = JOURNAL_LOCAL_STORAGE_KEY_MAPPINGS.find(mapping => mapping.canonical === key)
    const legacy = direct?.legacy ?? `${LEGACY_JOURNAL_STORAGE_KEYS.syncRecovery}${key.slice(SYNC_RECOVERY_STORAGE_KEY.length)}`
    const previous = cache.get(key)
    const validation = previous?.raw === raw ? previous.validation : validateStoredValue(legacy, raw)
    cache.set(key, { raw, validation })
    if (cache.size > 64) cache.delete(cache.keys().next().value!)
    if (validation === "unsupported") return validation
    if (validation === "corrupt") corrupt = true
  }
  return corrupt ? "corrupt" : "valid"
}

function conflictStatus(target: Storage, manifestRaw: string, source: CanonicalJournalLegacyValues): CanonicalJournalStorageStatus {
  const canonical = readCanonicalValues(target)
  const previous = conflicts.get(target)
  const token = previous !== undefined && previous.manifestRaw === manifestRaw
    && sameValues(previous.source, source) && sameValues(previous.canonical, canonical) ? previous.token : randomId()
  conflicts.set(target, { token, manifestRaw, source, canonical })
  return { status: "conflict", reason: "LEGACY_CHANGED", conflictToken: token }
}

function storageStatus(target: Storage, allowCorruptCurrentRead: boolean): CanonicalJournalStorageStatus {
  try {
    const raw = target.getItem(CANONICAL_JOURNAL_MANIFEST_KEY)
    const manifest = manifestFromRaw(raw)
    if (manifest === null) return unavailable(raw === null ? "MIGRATION_INCOMPLETE" : "CANONICAL_UNSUPPORTED")
    if (canonicalJournalStorageKeys(target).some(key => !knownCanonicalKey(key))) return unavailable("CANONICAL_UNSUPPORTED")
    if (manifest.phase === "erasing" || manifest.phase === "redacting") return unavailable("ERASE_INCOMPLETE")
    const referenced = new Set([manifest.initialSnapshotKey, manifest.comparisonSnapshotKey, ...manifest.acknowledgedSnapshotKeys])
    if ([...referenced].some(key => readSnapshot(target, key) === null)) return unavailable("CANONICAL_CORRUPT")
    if (manifest.phase === "copying") return unavailable("MIGRATION_INCOMPLETE")
    const valid = validateCanonicalValues(target)
    if (valid === "unsupported" || (valid === "corrupt" && !allowCorruptCurrentRead)) return unavailable(valid === "corrupt" ? "CANONICAL_CORRUPT" : "CANONICAL_UNSUPPORTED")
    const baseline = readSnapshot(target, manifest.comparisonSnapshotKey)!
    const source = readLegacyValues(target)
    if (!sameValues(source, baseline.values)) return conflictStatus(target, raw!, source)
    conflicts.delete(target)
    return { status: "ready" }
  } catch (error) {
    return unavailable(error instanceof Error && error.message === "SOURCE_CHANGED" ? "SOURCE_CHANGED" : "STORAGE_UNAVAILABLE")
  }
}

export function canonicalJournalStorageStatus(target: Storage): CanonicalJournalStorageStatus {
  return storageStatus(target, false)
}

/** Current malformed rows remain visible to the existing uncertain-read parser;
 * storage conflicts, unknown versions and invalid preservation proofs never do. */
export function assertCanonicalJournalReadable(target: Storage): void {
  if (storageStatus(target, true).status !== "ready") throw new Error("CANONICAL_JOURNAL_UNAVAILABLE")
}

export function isCanonicalJournalWritable(target: Storage): boolean {
  return canonicalJournalStorageStatus(target).status === "ready"
}

export function assertCanonicalJournalWritable(target: Storage): void {
  if (!isCanonicalJournalWritable(target)) throw new Error("CANONICAL_JOURNAL_UNAVAILABLE")
}

async function withMigrationLock<T>(operation: () => Promise<T>, runner?: CanonicalJournalLockRunner): Promise<T> {
  if (runner !== undefined) return runner(operation)
  if (typeof navigator === "undefined" || navigator.locks === undefined) throw new Error("LOCK_UNAVAILABLE")
  return navigator.locks.request(CANONICAL_JOURNAL_MIGRATION_LOCK, { mode: "exclusive" }, operation)
}

function writeConfirmed(target: Storage, key: string, raw: string): void {
  target.setItem(key, raw)
  if (target.getItem(key) !== raw) throw new Error("WRITE_UNCONFIRMED")
}

function errorStatus(error: unknown): CanonicalJournalStorageStatus {
  if (error instanceof Error && ["LOCK_UNAVAILABLE", "SOURCE_CHANGED", "WRITE_UNCONFIRMED"].includes(error.message)) {
    return unavailable(error.message as CanonicalJournalStorageReason)
  }
  return unavailable("STORAGE_UNAVAILABLE")
}

function freshSnapshot(target: Storage, values: CanonicalJournalLegacyValues): string {
  const key = `${CANONICAL_JOURNAL_SNAPSHOT_PREFIX}${randomId()}`
  if (target.getItem(key) !== null) throw new Error("WRITE_UNCONFIRMED")
  writeConfirmed(target, key, JSON.stringify({ schemaVersion: 1, values } satisfies SnapshotEnvelope))
  return key
}

function knownCanonicalKey(key: string): boolean {
  return JOURNAL_LOCAL_STORAGE_KEY_MAPPINGS.some(mapping => mapping.canonical === key)
    || key.startsWith(`${SYNC_RECOVERY_STORAGE_KEY}${accountSegment}`)
    || key.startsWith(CANONICAL_JOURNAL_SNAPSHOT_PREFIX)
    || key.startsWith(CANONICAL_JOURNAL_LIFECYCLE_INTENT_PREFIX)
    || key === CANONICAL_JOURNAL_MANIFEST_KEY
}

function partialMatches(target: Storage, source: CanonicalJournalLegacyValues): boolean {
  for (const [key, raw] of readCanonicalValues(target)) {
    if (raw === null) continue
    const sourceKey = JOURNAL_LOCAL_STORAGE_KEY_MAPPINGS.find(mapping => mapping.canonical === key)?.legacy
      ?? `${LEGACY_JOURNAL_STORAGE_KEYS.syncRecovery}${key.slice(SYNC_RECOVERY_STORAGE_KEY.length)}`
    if (source.find(([candidate]) => candidate === sourceKey)?.[1] !== raw) return false
  }
  return true
}

function copySessionRecovery(local: Storage, session?: Storage): CanonicalJournalStorageStatus {
  if (session === undefined) return canonicalJournalStorageStatus(local)
  try {
    const marker = session.getItem(CANONICAL_JOURNAL_SESSION_MIGRATION_KEY)
    if (marker !== null) {
      try {
        const value: unknown = JSON.parse(marker)
        if (!isRecord(value) || value.schemaVersion !== 1 || value.completed !== true) return unavailable("SESSION_CONFLICT")
      } catch { return unavailable("SESSION_CONFLICT") }
      return canonicalJournalStorageStatus(local)
    }
    for (const mapping of JOURNAL_SESSION_STORAGE_KEY_MAPPINGS) {
      const keys = [...new Set([mapping.legacy, ...enumerate(session, key => key.startsWith(`${mapping.legacy}${accountSegment}`))])]
      for (const key of keys) {
        const source = session.getItem(key)
        if (source === null) continue
        const targetKey = `${mapping.canonical}${key.slice(mapping.legacy.length)}`
        const previous = session.getItem(targetKey)
        // Existing canonical codes and invalidation sentinels win. A repeated
        // bootstrap must not import a retained legacy code after explicit clear.
        if (previous === null) writeConfirmed(session, targetKey, source)
        if (session.getItem(key) !== source || session.getItem(targetKey) !== (previous ?? source)) return unavailable("SESSION_CONFLICT")
      }
    }
    writeConfirmed(session, CANONICAL_JOURNAL_SESSION_MIGRATION_KEY, JSON.stringify({ schemaVersion: 1, completed: true }))
    return canonicalJournalStorageStatus(local)
  } catch (error) { return errorStatus(error) }
}

function initializeLocked(target: Storage): CanonicalJournalStorageStatus {
  const existingRaw = target.getItem(CANONICAL_JOURNAL_MANIFEST_KEY)
  let manifest = manifestFromRaw(existingRaw)
  if (existingRaw !== null && manifest === null) return unavailable("CANONICAL_UNSUPPORTED")
  if (manifest?.phase === "erasing" || manifest?.phase === "redacting") {
    const result = resumeLifecycleIntent(target)
    return result.ok ? canonicalJournalStorageStatus(target) : unavailable("ERASE_INCOMPLETE")
  }
  if (manifest !== null && manifest.phase !== "copying") return canonicalJournalStorageStatus(target)
  const source = readLegacyValues(target)
  const retryingCopy = manifest !== null
  const retainedInitial = manifest === null ? null : readSnapshot(target, manifest.initialSnapshotKey)
  if (retryingCopy && retainedInitial === null) return unavailable("CANONICAL_CORRUPT")
  const validation = validateValues(retainedInitial?.values ?? source)
  if (validation !== "valid") return unavailable(validation === "corrupt" ? "SOURCE_CORRUPT" : "SOURCE_UNSUPPORTED")
  if (canonicalJournalStorageKeys(target).some(key => !knownCanonicalKey(key))) return unavailable("EXISTING_CANONICAL_STATE")

  if (manifest === null) {
    const storedSnapshotKeys = canonicalJournalStorageKeys(target).filter(key => key.startsWith(CANONICAL_JOURNAL_SNAPSHOT_PREFIX))
    const snapshots = storedSnapshotKeys.map(key => readSnapshot(target, key))
    if (snapshots.some(snapshot => snapshot === null || !sameValues(snapshot.values, source))
      || !partialMatches(target, source)) return unavailable("EXISTING_CANONICAL_STATE")
    if (snapshots.length === 0 && readCanonicalValues(target).some(([, raw]) => raw !== null)) return unavailable("EXISTING_CANONICAL_STATE")
    const snapshotKey = snapshots[0]?.key ?? freshSnapshot(target, source)
    if (!sourceMatches(target, source) || target.getItem(CANONICAL_JOURNAL_MANIFEST_KEY) !== existingRaw) return unavailable("SOURCE_CHANGED")
    manifest = { schemaVersion: 1, phase: "copying", revision: randomId(), initialSnapshotKey: snapshotKey,
      comparisonSnapshotKey: snapshotKey, acknowledgedSnapshotKeys: [] }
    writeConfirmed(target, CANONICAL_JOURNAL_MANIFEST_KEY, JSON.stringify(manifest))
  }

  const expectedRaw = JSON.stringify(manifest)
  if (target.getItem(CANONICAL_JOURNAL_MANIFEST_KEY) !== expectedRaw) return unavailable("WRITE_UNCONFIRMED")
  const initial = readSnapshot(target, manifest.initialSnapshotKey)
  if (initial === null) return unavailable("CANONICAL_CORRUPT")
  // Only an explicit retry may finish the immutable first snapshot while the
  // live v1 source differs. The differing source is retained, never merged.
  if (!retryingCopy && !sameValues(source, initial.values)) return unavailable("SOURCE_CHANGED")
  if (!partialMatches(target, initial.values)) return unavailable("EXISTING_CANONICAL_STATE")

  for (const [legacyKey, raw] of initial.values) {
    const key = canonicalJournalKeyForLegacy(legacyKey)!
    if (!sourceMatches(target, source) || target.getItem(CANONICAL_JOURNAL_MANIFEST_KEY) !== expectedRaw) return unavailable("SOURCE_CHANGED")
    const current = target.getItem(key)
    if (current !== null && current !== raw) return unavailable("EXISTING_CANONICAL_STATE")
    if (raw !== null && current === null) writeConfirmed(target, key, raw)
  }
  if (!sourceMatches(target, source)
    || initial.values.some(([legacyKey, raw]) => target.getItem(canonicalJournalKeyForLegacy(legacyKey)!) !== raw)
    || target.getItem(CANONICAL_JOURNAL_MANIFEST_KEY) !== expectedRaw) return unavailable("SOURCE_CHANGED")
  if (retryingCopy && !sameValues(source, initial.values)) {
    freshSnapshot(target, source)
    if (!sourceMatches(target, source)
      || target.getItem(CANONICAL_JOURNAL_MANIFEST_KEY) !== expectedRaw
      || initial.values.some(([legacyKey, raw]) => target.getItem(canonicalJournalKeyForLegacy(legacyKey)!) !== raw)) return unavailable("SOURCE_CHANGED")
  }
  const ready: CanonicalJournalManifest = { ...manifest, phase: "ready", revision: randomId() }
  writeConfirmed(target, CANONICAL_JOURNAL_MANIFEST_KEY, JSON.stringify(ready))
  return canonicalJournalStorageStatus(target)
}

function canonicalValuesAsLegacy(target: Storage): CanonicalJournalLegacyValues {
  return readCanonicalValues(target).map(([key, raw]) => [
    JOURNAL_LOCAL_STORAGE_KEY_MAPPINGS.find(mapping => mapping.canonical === key)?.legacy
      ?? `${LEGACY_JOURNAL_STORAGE_KEYS.syncRecovery}${key.slice(SYNC_RECOVERY_STORAGE_KEY.length)}`,
    raw,
  ] as const).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
}

function clearCaches(target: Storage): void {
  conflicts.delete(target)
  snapshotCache.delete(target)
  validationCache.delete(target)
}

function removeConfirmed(target: Storage, key: string): number {
  const existed = target.getItem(key) !== null
  target.removeItem(key)
  if (target.getItem(key) !== null) throw new Error("WRITE_UNCONFIRMED")
  return existed ? 1 : 0
}

function replaceValueConfirmed(target: Storage, key: string, raw: string | null): number {
  if (raw === null) return removeConfirmed(target, key)
  writeConfirmed(target, key, raw)
  return 0
}

function sortedValues(values: CanonicalJournalLegacyValues): CanonicalJournalLegacyValues {
  return [...values].sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
}

function compactValues(values: CanonicalJournalLegacyValues): CanonicalJournalLegacyValues {
  return sortedValues(values.filter(([key, raw]) => raw !== null
    || JOURNAL_LOCAL_STORAGE_KEY_MAPPINGS.some(mapping => mapping.legacy === key)))
}

function lifecycleCompletedManifest(held: CanonicalJournalManifest): CanonicalJournalManifest | null {
  if (held.lifecycleCompletedPhase === undefined) return null
  return { schemaVersion: 1, phase: held.lifecycleCompletedPhase, revision: held.revision,
    initialSnapshotKey: held.initialSnapshotKey, comparisonSnapshotKey: held.comparisonSnapshotKey,
    acknowledgedSnapshotKeys: held.acknowledgedSnapshotKeys }
}

function parseLifecycleIntent(raw: string | null, held: CanonicalJournalManifest): LifecycleIntent | null {
  if (raw === null) return null
  try {
    const value: unknown = JSON.parse(raw)
    if (!isRecord(value) || value.schemaVersion !== 1 || value.phase !== held.phase
      || !hasOnlyKeys(value, ["schemaVersion", "phase", "completedManifest", "operations", "canonicalAfter", "preservedKeys"])
      || !Array.isArray(value.operations) || !Array.isArray(value.canonicalAfter) || !Array.isArray(value.preservedKeys)) return null
    const completed = manifestFromRaw(JSON.stringify(value.completedManifest))
    const expected = lifecycleCompletedManifest(held)
    if (completed === null || expected === null || JSON.stringify(completed) !== JSON.stringify(expected)) return null
    const keys = new Set<string>()
    for (const operation of value.operations) {
      if (!isRecord(operation) || !hasOnlyKeys(operation, ["key", "before", "after"])
        || typeof operation.key !== "string" || keys.has(operation.key)
        || ![operation.before, operation.after].every(raw => raw === null || typeof raw === "string")
        || operation.key === CANONICAL_JOURNAL_MANIFEST_KEY || operation.key === held.lifecycleIntentKey
        || (!operation.key.startsWith(CANONICAL_JOURNAL_STORAGE_PREFIX) && canonicalJournalKeyForLegacy(operation.key) === null)
        || ((operation.key.startsWith(CANONICAL_JOURNAL_SNAPSHOT_PREFIX)
          || operation.key.startsWith(CANONICAL_JOURNAL_LIFECYCLE_INTENT_PREFIX)) && operation.after !== null)) return null
      keys.add(operation.key)
    }
    const canonical = parseSnapshot("canonical-final-proof", JSON.stringify({ schemaVersion: 1, values: value.canonicalAfter }))
    if (canonical === null || validateValues(canonical.values) !== "valid"
      || !value.preservedKeys.every(key => typeof key === "string" && key.startsWith(CANONICAL_JOURNAL_SNAPSHOT_PREFIX))
      || JSON.stringify(value.preservedKeys) !== JSON.stringify(held.lifecyclePreservedKeys)) return null
    return { schemaVersion: 1, phase: held.phase as "redacting" | "erasing", completedManifest: completed,
      operations: value.operations as unknown as LifecycleOperation[], canonicalAfter: canonical.values,
      preservedKeys: value.preservedKeys as string[] }
  } catch { return null }
}

function lifecycleFinalProofMatches(target: Storage, held: CanonicalJournalManifest): boolean {
  if (held.lifecycleCanonicalSnapshotKey === undefined || held.lifecyclePreservedKeys === undefined) return false
  const finalCanonical = readSnapshot(target, held.lifecycleCanonicalSnapshotKey)
  const finalLegacy = readSnapshot(target, held.comparisonSnapshotKey)
  if (finalCanonical === null || finalLegacy === null
    || !sameValues(canonicalValuesAsLegacy(target), finalCanonical.values)
    || !sameValues(readLegacyValues(target), finalLegacy.values)) return false
  const allowed = new Set([CANONICAL_JOURNAL_MANIFEST_KEY, ...held.lifecyclePreservedKeys,
    ...readCanonicalValues(target).filter(([, raw]) => raw !== null).map(([key]) => key)])
  return canonicalJournalStorageKeys(target).every(key => allowed.has(key))
}

/** Resumption only completes the fixed durable before/after plan. Any new
 * source key or third value blocks it; it cannot adopt a concurrent revision. */
function resumeLifecycleIntent(target: Storage): CanonicalJournalLifecycleResult {
  let cleared = 0
  let failureKey = CANONICAL_JOURNAL_MANIFEST_KEY
  try {
    const heldRaw = target.getItem(CANONICAL_JOURNAL_MANIFEST_KEY)
    const held = manifestFromRaw(heldRaw)
    if (held === null || (held.phase !== "erasing" && held.phase !== "redacting")
      || held.lifecycleIntentKey === undefined) return { ok: false, cleared, failed: [failureKey] }
    const completed = lifecycleCompletedManifest(held)
    if (completed === null) return { ok: false, cleared, failed: [failureKey] }
    const rawIntent = target.getItem(held.lifecycleIntentKey)
    const intent = parseLifecycleIntent(rawIntent, held)
    if (rawIntent !== null && intent === null) return { ok: false, cleared, failed: [held.lifecycleIntentKey] }
    const assertHeld = () => {
      if (target.getItem(CANONICAL_JOURNAL_MANIFEST_KEY) !== heldRaw) throw new Error("WRITE_UNCONFIRMED")
    }
    if (intent !== null) {
      const allowed = new Set([CANONICAL_JOURNAL_MANIFEST_KEY, held.lifecycleIntentKey,
        ...intent.preservedKeys, ...intent.operations.map(operation => operation.key)])
      if (canonicalJournalStorageKeys(target).some(key => !allowed.has(key))
        || legacyJournalStorageKeys(target).some(key => !intent.operations.some(operation => operation.key === key))
        || intent.preservedKeys.some(key => readSnapshot(target, key) === null)
        || intent.operations.some(operation => {
          const raw = target.getItem(operation.key)
          return raw !== operation.before && raw !== operation.after
        })) return { ok: false, cleared, failed: ["canonical-journal-lifecycle-stale"] }
      for (const operation of intent.operations) {
        failureKey = operation.key
        assertHeld()
        const current = target.getItem(operation.key)
        if (current !== operation.before && current !== operation.after) throw new Error("WRITE_UNCONFIRMED")
        if (current !== operation.after) cleared += replaceValueConfirmed(target, operation.key, operation.after)
      }
      if (!sameValues(canonicalValuesAsLegacy(target), intent.canonicalAfter)
        || !sameValues(readLegacyValues(target), readSnapshot(target, held.comparisonSnapshotKey)!.values)
        || intent.operations.some(operation => target.getItem(operation.key) !== operation.after)) throw new Error("WRITE_UNCONFIRMED")
      assertHeld()
      failureKey = held.lifecycleIntentKey
      // This temporary intent was created by this action, not user data erased.
      removeConfirmed(target, failureKey)
    }
    // If interrupted after removing the intent, the held manifest still carries
    // sanitized final proofs and the allowed snapshot inventory for this step.
    if (!lifecycleFinalProofMatches(target, held)) return { ok: false, cleared, failed: ["canonical-journal-lifecycle-incomplete"] }
    assertHeld()
    failureKey = CANONICAL_JOURNAL_MANIFEST_KEY
    writeConfirmed(target, failureKey, JSON.stringify(completed))
    clearCaches(target)
    const status = canonicalJournalStorageStatus(target)
    return { ok: status.status === "ready", cleared, failed: status.status === "ready" ? [] : [failureKey] }
  } catch {
    clearCaches(target)
    return { ok: false, cleared, failed: [failureKey] }
  }
}

function commitLifecycleIntent(
  target: Storage,
  previousManifestRaw: string | null,
  completed: CanonicalJournalManifest,
  phase: "erasing" | "redacting",
  operations: readonly LifecycleOperation[],
  canonicalAfter: CanonicalJournalLegacyValues,
  preservedKeys: readonly string[],
): CanonicalJournalLifecycleResult {
  const intentKey = `${CANONICAL_JOURNAL_LIFECYCLE_INTENT_PREFIX}${randomId()}`
  const canonicalProof = sameValues(readSnapshot(target, completed.comparisonSnapshotKey)!.values, canonicalAfter)
    ? completed.comparisonSnapshotKey : freshSnapshot(target, canonicalAfter)
  const preserved = [...new Set([...preservedKeys, canonicalProof])].sort()
  const final: CanonicalJournalManifest = { ...completed, revision: randomId() }
  const intent: LifecycleIntent = { schemaVersion: 1, phase, completedManifest: final,
    operations, canonicalAfter, preservedKeys: preserved }
  writeConfirmed(target, intentKey, JSON.stringify(intent))
  if (target.getItem(CANONICAL_JOURNAL_MANIFEST_KEY) !== previousManifestRaw
    || operations.some(operation => target.getItem(operation.key) !== operation.before)) {
    return { ok: false, cleared: 0, failed: ["canonical-journal-lifecycle-stale"] }
  }
  const held: CanonicalJournalManifest = { ...final, phase, lifecycleIntentKey: intentKey,
    lifecycleCanonicalSnapshotKey: canonicalProof, lifecycleCompletedPhase: final.phase as "ready" | "erased",
    lifecyclePreservedKeys: preserved }
  writeConfirmed(target, CANONICAL_JOURNAL_MANIFEST_KEY, JSON.stringify(held))
  return resumeLifecycleIntent(target)
}

function validTransformation(before: CanonicalJournalLegacyValues, after: CanonicalJournalLegacyValues | null): after is CanonicalJournalLegacyValues {
  if (after === null || before.length !== after.length) return false
  const sorted = sortedValues(after)
  return before.every(([key], index) => sorted[index]?.[0] === key)
    && validateValues(sorted) === "valid"
}

/** Explicit permanent deletion is a single held lifecycle operation across
 * current data, retained v1 sources and every original (including orphan ACKs).
 * The caller supplies the already-authorized exact-ID/owner transformation. */
export function redactCanonicalJournalOriginals(
  target: Storage,
  transform: CanonicalJournalOriginalTransform,
): CanonicalJournalLifecycleResult {
  let cleared = 0
  let failureKey = CANONICAL_JOURNAL_MANIFEST_KEY
  try {
    const manifestRaw = target.getItem(CANONICAL_JOURNAL_MANIFEST_KEY)
    const manifest = manifestFromRaw(manifestRaw)
    if (manifest === null || (manifest.phase !== "ready" && manifest.phase !== "erased")) {
      return { ok: false, cleared, failed: [failureKey] }
    }
    const legacy = readLegacyValues(target)
    const canonical = canonicalValuesAsLegacy(target)
    if (validateValues(legacy) !== "valid" || validateValues(canonical) !== "valid") {
      return { ok: false, cleared, failed: ["canonical-journal-redaction-unavailable"] }
    }
    const nextCanonical = transform(canonical, { source: "canonical" })
    const nextLegacy = transform(legacy, { source: "legacy" })
    if (!validTransformation(canonical, nextCanonical) || !validTransformation(legacy, nextLegacy)) {
      return { ok: false, cleared, failed: ["canonical-journal-redaction-unavailable"] }
    }
    const originalKeys = canonicalJournalStorageKeys(target).filter(key => key.startsWith(CANONICAL_JOURNAL_SNAPSHOT_PREFIX))
    const originals: { readonly original: CanonicalJournalLegacySnapshot; readonly next: CanonicalJournalLegacyValues }[] = []
    for (const key of originalKeys) {
      failureKey = key
      const original = readSnapshot(target, key)
      if (original === null) return { ok: false, cleared, failed: [key] }
      if (validateValues(original.values) !== "valid") return { ok: false, cleared, failed: [key] }
      const next = transform(original.values, { source: "original", snapshotKey: key })
      if (!validTransformation(original.values, next)) return { ok: false, cleared, failed: [key] }
      originals.push({ original, next: compactValues(next) })
    }
    const replacementKeys = new Map<string, string>()
    for (const { original, next } of originals) replacementKeys.set(original.key, freshSnapshot(target, next))
    const nextLegacySorted = compactValues(nextLegacy)
    const comparisonSnapshotKey = freshSnapshot(target, nextLegacySorted)
    const initialSnapshotKey = replacementKeys.get(manifest.initialSnapshotKey)
    if (initialSnapshotKey === undefined || manifest.acknowledgedSnapshotKeys.some(key => !replacementKeys.has(key))) {
      return { ok: false, cleared, failed: [CANONICAL_JOURNAL_MANIFEST_KEY] }
    }
    if (target.getItem(CANONICAL_JOURNAL_MANIFEST_KEY) !== manifestRaw
      || !sourceMatches(target, legacy) || !sameValues(canonicalValuesAsLegacy(target), canonical)
      || originals.some(({ original }) => !sameValues(readSnapshot(target, original.key)?.values ?? [], original.values))) {
      return { ok: false, cleared, failed: ["canonical-journal-redaction-stale"] }
    }
    const ready: CanonicalJournalManifest = { schemaVersion: 1, phase: manifest.phase, revision: randomId(), initialSnapshotKey,
      comparisonSnapshotKey, acknowledgedSnapshotKeys: manifest.acknowledgedSnapshotKeys.map(key => replacementKeys.get(key)!) }
    const operations: LifecycleOperation[] = [
      ...nextCanonical.map(([key, after]) => ({ key: canonicalJournalKeyForLegacy(key)!, before: canonical.find(([candidate]) => candidate === key)![1], after })),
      ...nextLegacy.map(([key, after]) => ({ key, before: legacy.find(([candidate]) => candidate === key)![1], after })),
      ...[...originalKeys, ...canonicalJournalStorageKeys(target).filter(key => key.startsWith(CANONICAL_JOURNAL_LIFECYCLE_INTENT_PREFIX))]
        .map(key => ({ key, before: target.getItem(key), after: null })),
    ]
    return commitLifecycleIntent(target, manifestRaw, ready, "redacting", operations, compactValues(nextCanonical),
      [...replacementKeys.values(), comparisonSnapshotKey])
  } catch {
    clearCaches(target)
    return { ok: false, cleared, failed: [failureKey] }
  }
}

function retainedDeletionValues(bundles: readonly CanonicalJournalLegacyValues[]): CanonicalJournalLegacyValues | null {
  const tombstones = new Map<string, { readonly id: string; readonly deletedAt: string }>()
  const owners = new Map<string, Set<string>>()
  for (const bundle of bundles) {
    const deletionRaw = bundle.find(([key]) => key === LEGACY_JOURNAL_STORAGE_KEYS.tombstones)?.[1] ?? null
    if (validateStoredValue(LEGACY_JOURNAL_STORAGE_KEYS.tombstones, deletionRaw) !== "valid") return null
    if (deletionRaw !== null) {
      for (const item of JSON.parse(deletionRaw) as { id: string; deletedAt: string }[]) {
        const previous = tombstones.get(item.id)
        if (previous === undefined || item.deletedAt < previous.deletedAt) tombstones.set(item.id, item)
      }
    }
  }
  if (tombstones.size > 0) {
    for (const bundle of bundles) {
      const ownershipRaw = bundle.find(([key]) => key === LEGACY_JOURNAL_STORAGE_KEYS.ownership)?.[1] ?? null
      if (validateStoredValue(LEGACY_JOURNAL_STORAGE_KEYS.ownership, ownershipRaw) !== "valid") return null
      if (ownershipRaw === null) continue
      const map = (JSON.parse(ownershipRaw) as { ownerByEntryId: Record<string, string> }).ownerByEntryId
      for (const [id, owner] of Object.entries(map)) {
        if (!tombstones.has(id)) continue
        const values = owners.get(id) ?? new Set<string>()
        values.add(owner)
        if (values.size > 1) return null
        owners.set(id, values)
      }
    }
  }
  const deletionRaw = tombstones.size === 0 ? null : JSON.stringify([...tombstones.values()].sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0))
  const ownershipRaw = owners.size === 0 ? null : JSON.stringify({ schemaVersion: 1,
    ownerByEntryId: Object.fromEntries([...owners].map(([id, owner]) => [id, [...owner][0]!])) })
  return JOURNAL_LOCAL_STORAGE_KEY_MAPPINGS.map(mapping => [mapping.legacy,
    mapping.legacy === LEGACY_JOURNAL_STORAGE_KEYS.tombstones ? deletionRaw
      : mapping.legacy === LEGACY_JOURNAL_STORAGE_KEYS.ownership ? ownershipRaw : null] as const)
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
}

/** An explicit device erase includes preserved originals. The durable intent
 * blocks other cooperating tabs before any content is removed. Deletion-only
 * metadata remains by default, without journal dates, values or private text. */
export function eraseCanonicalJournalStorage(
  target: Storage,
  options: { readonly includeDeletionRecord?: boolean } = {},
): CanonicalJournalLifecycleResult {
  let cleared = 0
  let failureKey = CANONICAL_JOURNAL_MANIFEST_KEY
  try {
    const expectedManifest = target.getItem(CANONICAL_JOURNAL_MANIFEST_KEY)
    const canonicalKeys = canonicalJournalStorageKeys(target)
    const legacy = readLegacyValues(target)
    const canonical = canonicalValuesAsLegacy(target)
    const originals: CanonicalJournalLegacyValues[] = []
    if (options.includeDeletionRecord !== true) {
      for (const key of canonicalKeys.filter(key => key.startsWith(CANONICAL_JOURNAL_SNAPSHOT_PREFIX))) {
        failureKey = key
        const original = readSnapshot(target, key)
        if (original === null) return { ok: false, cleared, failed: [key] }
        originals.push(original.values)
      }
    }
    const retained = options.includeDeletionRecord === true
      ? JOURNAL_LOCAL_STORAGE_KEY_MAPPINGS.map(mapping => [mapping.legacy, null] as const).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      : retainedDeletionValues([canonical, legacy, ...originals])
    if (retained === null) return { ok: false, cleared, failed: ["canonical-journal-deletion-metadata-unavailable"] }
    const minimalSnapshotKey = freshSnapshot(target, retained)
    if (target.getItem(CANONICAL_JOURNAL_MANIFEST_KEY) !== expectedManifest
      || !sourceMatches(target, legacy) || !sameValues(canonicalValuesAsLegacy(target), canonical)) {
      return { ok: false, cleared, failed: ["canonical-journal-erasure-stale"] }
    }
    const erased: CanonicalJournalManifest = { schemaVersion: 1, phase: "erased", revision: randomId(),
      initialSnapshotKey: minimalSnapshotKey, comparisonSnapshotKey: minimalSnapshotKey, acknowledgedSnapshotKeys: [] }
    const operations = new Map<string, LifecycleOperation>()
    for (const key of canonicalKeys) {
      if (key === CANONICAL_JOURNAL_MANIFEST_KEY) continue
      operations.set(key, { key, before: target.getItem(key), after: null })
    }
    for (const [key, before] of legacy) {
      operations.set(key, { key, before, after: retained.find(([candidate]) => candidate === key)?.[1] ?? null })
    }
    for (const [sourceKey, after] of retained) {
      const key = canonicalJournalKeyForLegacy(sourceKey)!
      operations.set(key, { key, before: target.getItem(key), after })
    }
    return commitLifecycleIntent(target, expectedManifest, erased, "erasing", [...operations.values()], retained, [minimalSnapshotKey])
  } catch {
    clearCaches(target)
    return { ok: false, cleared, failed: [failureKey] }
  }
}

export async function initializeCanonicalJournalStorage(
  target: Storage,
  session?: Storage,
  lockRunner?: CanonicalJournalLockRunner,
): Promise<CanonicalJournalStorageStatus> {
  const current = canonicalJournalStorageStatus(target)
  if (current.status === "ready") return copySessionRecovery(target, session)
  if (current.status === "conflict") return current
  try {
    const status = await withMigrationLock(async () => initializeLocked(target), lockRunner)
    return status.status === "ready" ? copySessionRecovery(target, session) : status
  } catch (error) { return errorStatus(error) }
}

export async function acknowledgeCanonicalJournalStorage(
  target: Storage,
  expectedConflictToken: string,
  lockRunner?: CanonicalJournalLockRunner,
): Promise<CanonicalJournalStorageStatus> {
  try {
    return await withMigrationLock(async () => {
      const status = canonicalJournalStorageStatus(target)
      const proof = conflicts.get(target)
      if (status.status !== "conflict" || status.conflictToken !== expectedConflictToken || proof === undefined) return unavailable("STALE_CONFIRMATION")
      const manifest = manifestFromRaw(proof.manifestRaw)
      if (manifest === null || manifest.phase === "copying") return unavailable("CANONICAL_UNSUPPORTED")
      const snapshotKey = freshSnapshot(target, proof.source)
      if (target.getItem(CANONICAL_JOURNAL_MANIFEST_KEY) !== proof.manifestRaw
        || !sourceMatches(target, proof.source) || !sameValues(readCanonicalValues(target), proof.canonical)) return unavailable("STALE_CONFIRMATION")
      const next: CanonicalJournalManifest = { ...manifest, revision: randomId(), comparisonSnapshotKey: snapshotKey,
        acknowledgedSnapshotKeys: [...manifest.acknowledgedSnapshotKeys, snapshotKey] }
      writeConfirmed(target, CANONICAL_JOURNAL_MANIFEST_KEY, JSON.stringify(next))
      return canonicalJournalStorageStatus(target)
    }, lockRunner)
  } catch (error) { return errorStatus(error) }
}
