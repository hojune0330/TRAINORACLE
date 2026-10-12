import { parseJournalEntryList, parseJournalEntryForWrite } from "./journal-schema"

/** Logical keys are deliberately unchanged. Old binaries only see these v1
 * keys; this adapter never writes new records back into them. */
export const JOURNAL_DEVICE_KEYS = [
  "trainoracle.journal.v1",
  "trainoracle.private-memo.v1",
  "trainoracle.journal.ownership.v1",
  "trainoracle.journal.trash.v1",
  "trainoracle.sync.tombstones.v1",
] as const
const RECOVERY_KEY = "trainoracle.sync.recovery.v1"
type DeviceKey = typeof JOURNAL_DEVICE_KEYS[number] | typeof RECOVERY_KEY | `${typeof RECOVERY_KEY}.account.${string}`
type Values = Record<string, string | null>

export const JOURNAL_DEVICE_PREFIX = "trainoracle.device-journal.v2:"
export const JOURNAL_DEVICE_POINTER_KEY = `${JOURNAL_DEVICE_PREFIX}pointer`
export const JOURNAL_DEVICE_UNCERTAIN_EVENT = "trainoracle:device-journal-uncertain"
const GENERATION_PREFIX = `${JOURNAL_DEVICE_PREFIX}generation:`
type Pointer = { version: 2; seed: string; head: string }
type DeletionIntent = { id: string; owner: string | null }
type Generation = { version: 2; id: string; kind: "seed" | "commit"; parent: string | null; seed: string; values: Values;
  deletions?: DeletionIntent[]; cleanup?: string[] }
type Snapshot = { pointer: Pointer; rawPointer: string; seed: Generation; head: Generation }
type Stage = { snapshot: Snapshot; values: Values; deletions: DeletionIntent[] }
type AdapterState = { raw: Storage; adapter: Storage; stage?: Stage; observed: Map<string, string | null> }
const adapters = new WeakMap<Storage, AdapterState>()
const adapterStates = new WeakMap<Storage, AdapterState>()

function unavailable(): never { throw new Error("JOURNAL_DEVICE_STORAGE_UNCERTAIN") }
function announceUnconfirmedMutation(): void {
  try {
    if (typeof window === "undefined") return
    window.dispatchEvent(new Event(JOURNAL_DEVICE_UNCERTAIN_EVENT))
    window.dispatchEvent(new Event("trainoracle:local-journals-changed"))
  } catch { /* Notifications cannot turn an unconfirmed write into an ACK. */ }
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
function deviceKey(key: string): key is DeviceKey {
  return (JOURNAL_DEVICE_KEYS as readonly string[]).includes(key) || key === RECOVERY_KEY || key.startsWith(`${RECOVERY_KEY}.account.`)
}
export function isJournalDeviceManagedKey(key: string): boolean { return deviceKey(key) }
function valuesFrom(raw: Storage): Values {
  const keys = new Set<string>(JOURNAL_DEVICE_KEYS)
  for (let index = 0; index < raw.length; index++) {
    const key = raw.key(index)
    if (key && deviceKey(key)) keys.add(key)
  }
  return Object.fromEntries([...keys].map(key => [key, raw.getItem(key)]))
}
function sameValues(left: Values, right: Values): boolean {
  return [...new Set([...Object.keys(left), ...Object.keys(right)])].every(key => (left[key] ?? null) === (right[key] ?? null))
}
function validValues(value: unknown): value is Values {
  return isRecord(value) && JOURNAL_DEVICE_KEYS.every(key => key in value)
    && Object.entries(value).every(([key, raw]) => deviceKey(key) && (raw === null || typeof raw === "string"))
}
function parseArray(raw: string | null | undefined): unknown[] {
  if (raw === null || raw === undefined) return []
  const value: unknown = JSON.parse(raw)
  if (!Array.isArray(value)) unavailable()
  return value
}
function validEncryptedRecord(value: unknown): boolean {
  if (!isRecord(value) || !isRecord(value.encrypted)) return false
  const encrypted = value.encrypted
  return encrypted.version === 1 && encrypted.algorithm === "AES-GCM"
    && encrypted.derivation === "PBKDF2-SHA-256" && encrypted.iterations === 210_000
    && ["salt", "iv", "ciphertext"].every(key => typeof encrypted[key] === "string" && encrypted[key] !== "")
}

/** Only the initial legacy capture requires cross-store consistency. Existing
 * synchronous operations can stage their intermediate values, not publish them. */
function validateInitial(values: Values): void {
  const journals = parseArray(values[JOURNAL_DEVICE_KEYS[0]])
  const entries = parseJournalEntryList(journals)
  if (entries.length !== journals.length || new Set(entries.map(entry => entry.id)).size !== entries.length) unavailable()
  const trash = parseArray(values[JOURNAL_DEVICE_KEYS[3]])
  const trashIds = new Set<string>()
  for (const item of trash) {
    if (!isRecord(item) || typeof item.deletedAt !== "string" || item.deletedAt === "") unavailable()
    const entry = parseJournalEntryForWrite(item.entry)
    if (!entry || trashIds.has(entry.id) || (item.privateMemo !== undefined && !validEncryptedRecord(item.privateMemo))) unavailable()
    trashIds.add(entry.id)
  }
  const tombstones = parseArray(values[JOURNAL_DEVICE_KEYS[4]])
  const tombstoneIds = new Set<string>()
  for (const item of tombstones) {
    if (!isRecord(item) || typeof item.id !== "string" || item.id === ""
      || typeof item.deletedAt !== "string" || item.deletedAt === "") unavailable()
    tombstoneIds.add(item.id)
  }
  // A paused old delete must not be promoted as a completed journal snapshot.
  if (entries.some(entry => trashIds.has(entry.id) || tombstoneIds.has(entry.id))) unavailable()
  const ownerRaw = values[JOURNAL_DEVICE_KEYS[2]] ?? null
  if (ownerRaw !== null) {
    const owner: unknown = JSON.parse(ownerRaw)
    if (!isRecord(owner) || owner.schemaVersion !== 1 || !isRecord(owner.ownerByEntryId)
      || Object.entries(owner.ownerByEntryId).some(([id, account]) => !id || typeof account !== "string" || !account)) unavailable()
  }
  const vaultRaw = values[JOURNAL_DEVICE_KEYS[1]] ?? null
  if (vaultRaw !== null) {
    const vault: unknown = JSON.parse(vaultRaw)
    if (!isRecord(vault) || vault.version !== 1 || !isRecord(vault.records)
      || Object.values(vault.records).some(record => !validEncryptedRecord(record))) unavailable()
  }
  for (const [key, serialized] of Object.entries(values)) {
    if (!deviceKey(key) || !key.startsWith(RECOVERY_KEY) || serialized === null) continue
    const checkpoint: unknown = JSON.parse(serialized)
    if (!isRecord(checkpoint) || checkpoint.version !== 1 || typeof checkpoint.userId !== "string" || !checkpoint.userId
      || !Array.isArray(checkpoint.entries) || parseJournalEntryList(checkpoint.entries).length !== checkpoint.entries.length
      || !Array.isArray(checkpoint.tombstones)) unavailable()
    if (key !== RECOVERY_KEY && key !== `${RECOVERY_KEY}.account.${encodeURIComponent(checkpoint.userId)}`) unavailable()
  }
}

function id(): string { return crypto.randomUUID() }
function generationKey(value: string): string { return GENERATION_PREFIX + value }
function parsePointer(raw: string): Pointer {
  const value: unknown = JSON.parse(raw)
  if (!isRecord(value) || value.version !== 2 || typeof value.seed !== "string" || !value.seed
    || typeof value.head !== "string" || !value.head) unavailable()
  return value as Pointer
}
function generation(raw: Storage, value: string): Generation {
  const text = raw.getItem(generationKey(value))
  if (text === null) unavailable()
  const parsed: unknown = JSON.parse(text)
  if (!isRecord(parsed) || parsed.version !== 2 || parsed.id !== value
    || (parsed.kind !== "seed" && parsed.kind !== "commit")
    || (parsed.parent !== null && typeof parsed.parent !== "string")
    || typeof parsed.seed !== "string" || !validValues(parsed.values)
    || (parsed.deletions !== undefined && (!Array.isArray(parsed.deletions)
      || parsed.deletions.some(value => !isRecord(value) || typeof value.id !== "string" || !value.id
        || (value.owner !== null && (typeof value.owner !== "string" || !value.owner)))))
    || (parsed.cleanup !== undefined && (!Array.isArray(parsed.cleanup)
      || parsed.cleanup.some(value => typeof value !== "string" || !value)))) unavailable()
  return parsed as Generation
}
function generationIds(raw: Storage): string[] {
  const result: string[] = []
  for (let index = 0; index < raw.length; index++) {
    const key = raw.key(index)
    if (key?.startsWith(GENERATION_PREFIX)) result.push(key.slice(GENERATION_PREFIX.length))
  }
  return result
}
function putNew(raw: Storage, value: Generation): void {
  const key = generationKey(value.id), serialized = JSON.stringify(value)
  if (raw.getItem(key) !== null) unavailable()
  raw.setItem(key, serialized)
  if (raw.getItem(key) !== serialized) unavailable()
}
function removeOwn(raw: Storage, value: Generation): void {
  const key = generationKey(value.id)
  if (raw.getItem(key) === JSON.stringify(value)) raw.removeItem(key)
}

function initialize(raw: Storage): void {
  if (raw.getItem(JOURNAL_DEVICE_POINTER_KEY) !== null) return
  if (generationIds(raw).length !== 0) unavailable() // interrupted/forked capture is not empty
  const values = valuesFrom(raw)
  validateInitial(values)
  const token = id()
  const seed: Generation = { version: 2, id: token, kind: "seed", parent: null, seed: token, values }
  try {
    putNew(raw, seed)
    if (!sameValues(valuesFrom(raw), values) || raw.getItem(JOURNAL_DEVICE_POINTER_KEY) !== null
      || generationIds(raw).some(other => other !== token)) unavailable()
    const pointer = JSON.stringify({ version: 2, seed: token, head: token } satisfies Pointer)
    raw.setItem(JOURNAL_DEVICE_POINTER_KEY, pointer)
    if (raw.getItem(JOURNAL_DEVICE_POINTER_KEY) !== pointer || !sameValues(valuesFrom(raw), values)
      || generationIds(raw).some(other => other !== token)) unavailable()
  } catch (error) {
    // Never erase a published seed or another tab's immutable capture.
    if (raw.getItem(JOURNAL_DEVICE_POINTER_KEY) === null) removeOwn(raw, seed)
    throw error
  }
}

function read(raw: Storage, allowed?: string, pendingAllowed = false): Snapshot {
  initialize(raw)
  const rawPointer = raw.getItem(JOURNAL_DEVICE_POINTER_KEY)
  if (rawPointer === null) unavailable()
  const pointer = parsePointer(rawPointer)
  const seed = generation(raw, pointer.seed), head = generation(raw, pointer.head)
  if (seed.kind !== "seed" || seed.seed !== seed.id || head.seed !== seed.id) unavailable()
  // A published redaction lists only the previous seed/head it superseded.
  // Cleanup is resumable after process death, but never while legacy diverges.
  if (head.cleanup?.length) {
    if (!sameValues(valuesFrom(raw), seed.values) || raw.getItem(JOURNAL_DEVICE_POINTER_KEY) !== rawPointer) unavailable()
    for (const token of head.cleanup) {
      if (token === seed.id || token === head.id || raw.getItem(JOURNAL_DEVICE_POINTER_KEY) !== rawPointer) unavailable()
      raw.removeItem(generationKey(token))
      if (raw.getItem(generationKey(token)) !== null) unavailable()
    }
  }
  const snapshot = { pointer, rawPointer, seed, head }
  // Process termination has no catch/rollback. Only an already-published,
  // owner-bound deletion intent can repair its exact partial redaction.
  if (head.deletions?.length && !pendingAllowed && !allowed) repairPendingDeletionCapture(raw, snapshot)
  if (seed.kind !== "seed" || seed.seed !== seed.id || head.seed !== seed.id
    || !sameValues(valuesFrom(raw), seed.values)) unavailable()
  if (generationIds(raw).some(other => other !== seed.id && other !== head.id && other !== allowed
    && !head.cleanup?.includes(other))) unavailable()
  if (raw.getItem(JOURNAL_DEVICE_POINTER_KEY) !== rawPointer || !sameValues(valuesFrom(raw), seed.values)) unavailable()
  for (const token of head.cleanup ?? []) {
    if (token === seed.id || token === head.id || raw.getItem(JOURNAL_DEVICE_POINTER_KEY) !== rawPointer) unavailable()
    raw.removeItem(generationKey(token))
    if (raw.getItem(generationKey(token)) !== null) unavailable()
  }
  if (raw.getItem(JOURNAL_DEVICE_POINTER_KEY) !== rawPointer || !sameValues(valuesFrom(raw), seed.values)) unavailable()
  if (head.deletions?.length && !pendingAllowed) {
    if (allowed) unavailable()
    for (const intent of head.deletions) if (!redactJournalDeviceLegacyRecord(raw, intent.id, intent.owner)) unavailable()
    return read(raw)
  }
  return snapshot
}

function commit(state: AdapterState, previous: Snapshot, values: Values, guard: () => boolean = () => true,
  deletions: DeletionIntent[] = []): boolean {
  const raw = state.raw
  let next: Generation | undefined
  try {
    const fresh = read(raw)
    if (fresh.rawPointer !== previous.rawPointer || !guard()) { announceUnconfirmedMutation(); return false }
    if (sameValues(values, fresh.head.values) && deletions.length === 0) return true
    next = { version: 2, id: id(), kind: "commit", parent: fresh.head.id, seed: fresh.seed.id, values,
      ...(deletions.length ? { deletions } : {}) }
    putNew(raw, next)
    // A competing sibling is retained and closes reads; it is not overwritten.
    const checked = read(raw, next.id)
    if (checked.rawPointer !== fresh.rawPointer || !guard()) unavailable()
    const pointer = JSON.stringify({ ...fresh.pointer, head: next.id })
    raw.setItem(JOURNAL_DEVICE_POINTER_KEY, pointer)
    if (raw.getItem(JOURNAL_DEVICE_POINTER_KEY) !== pointer || !guard()
      || !sameValues(valuesFrom(raw), fresh.seed.values)
      || generationIds(raw).some(other => ![fresh.seed.id, fresh.head.id, next!.id].includes(other))) unavailable()
    if (fresh.head.id !== fresh.seed.id) removeOwn(raw, fresh.head)
    // A failed cleanup is a recoverable uncertain state, never an ACK.
    read(raw)
    return true
  } catch {
    if (next !== undefined) {
      const attemptedPointer = JSON.stringify({ ...previous.pointer, head: next.id })
      if (raw.getItem(JOURNAL_DEVICE_POINTER_KEY) === attemptedPointer
        && raw.getItem(generationKey(previous.head.id)) !== null
        && sameValues(valuesFrom(raw), previous.seed.values)
        && generationIds(raw).every(other => [previous.seed.id, previous.head.id, next!.id].includes(other))) {
        raw.setItem(JOURNAL_DEVICE_POINTER_KEY, previous.rawPointer)
      }
    }
    if (next !== undefined && raw.getItem(JOURNAL_DEVICE_POINTER_KEY) === previous.rawPointer) {
      // Only our unpublished candidate can be rolled back. Other generations survive.
      removeOwn(raw, next)
    }
    announceUnconfirmedMutation()
    return false
  }
}

/** This is a bounded, recoverable synchronous commit, not native atomic CAS.
 * The immutable competing value survives even when two pointer writers race. */
export function canonicalJournalStorage(target: Storage): Storage {
  const known = adapterStates.get(target) ?? adapters.get(target)
  if (known) return known.adapter
  const state = { raw: target, observed: new Map<string, string | null>() } as AdapterState
  const adapter: Storage = {
    get length() { return target.length },
    key(index) { return target.key(index) },
    clear() { unavailable() }, // explicit erase has a separate scope/fence contract
    getItem(key) {
      if (!deviceKey(key)) return target.getItem(key)
      const value = (state.stage?.values ?? read(target).head.values)[key] ?? null
      if (!state.stage) state.observed.set(key, value)
      return value
    },
    setItem(key, value) {
      if (!deviceKey(key)) { target.setItem(key, value); return }
      if (state.stage) { state.stage.values[key] = String(value); return }
      const before = read(target)
      if (state.observed.has(key) && (before.head.values[key] ?? null) !== state.observed.get(key)) unavailable()
      if (!commit(state, before, { ...before.head.values, [key]: String(value) })) unavailable()
      state.observed.set(key, String(value))
    },
    removeItem(key) {
      if (!deviceKey(key)) { target.removeItem(key); return }
      if (state.stage) { state.stage.values[key] = null; return }
      const before = read(target)
      if (state.observed.has(key) && (before.head.values[key] ?? null) !== state.observed.get(key)) unavailable()
      if (!commit(state, before, { ...before.head.values, [key]: null })) unavailable()
      state.observed.set(key, null)
    },
  }
  state.adapter = adapter
  adapters.set(target, state)
  adapterStates.set(adapter, state)
  return adapter
}

export function writeJournalDeviceValues(
  target: Storage, changes: Partial<Values>, expected: Partial<Values> = {}, guard: () => boolean = () => true,
): boolean {
  const adapter = canonicalJournalStorage(target), state = adapterStates.get(adapter)!
  try {
    const values = state.stage?.values ?? read(state.raw).head.values
    if ([...Object.keys(changes), ...Object.keys(expected)].some(key => !deviceKey(key))) return false
    if (Object.values(changes).some(value => value !== null && typeof value !== "string")) return false
    if (Object.entries(expected).some(([key, value]) => (values[key] ?? null) !== value) || !guard()) return false
    if (state.stage) { Object.assign(state.stage.values, changes); return true }
    const before = read(state.raw)
    return commit(state, before, Object.assign({ ...before.head.values }, changes) as Values, guard)
  } catch { announceUnconfirmedMutation(); return false }
}

/** Keeps the existing synchronous API while withholding intermediate owner,
 * tombstone, trash and vault changes from the published canonical pointer. */
export function journalDeviceTransaction<T>(target: Storage, operation: () => T, accepted: (value: T) => boolean):
  { ok: true; value: T } | { ok: false } {
  const state = adapterStates.get(canonicalJournalStorage(target))!
  if (state.stage) {
    const value = operation()
    return accepted(value) ? { ok: true, value } : { ok: false }
  }
  try {
    const snapshot = read(state.raw)
    state.stage = { snapshot, values: { ...snapshot.head.values }, deletions: [] }
    const value = operation(), values = state.stage.values, deletions = state.stage.deletions
    state.stage = undefined
    if (!accepted(value) || !commit(state, snapshot, values, () => true, deletions)) return { ok: false }
    if (typeof window !== "undefined") window.dispatchEvent(new Event("trainoracle:local-journals-changed"))
    return { ok: true, value }
  } catch { state.stage = undefined; announceUnconfirmedMutation(); return { ok: false } }
  finally { state.stage = undefined }
}

export function journalDeviceTransactionActive(): boolean {
  try { return typeof window !== "undefined" && adapters.get(window.localStorage)?.stage !== undefined }
  catch { return false }
}

function ownerOf(values: Values, recordId: string): string | null {
  const serialized = values[JOURNAL_DEVICE_KEYS[2]] ?? null
  if (serialized === null) return null
  const owner: unknown = JSON.parse(serialized)
  if (!isRecord(owner) || owner.schemaVersion !== 1 || !isRecord(owner.ownerByEntryId)) unavailable()
  const bound = owner.ownerByEntryId[recordId]
  if (bound === undefined) return null
  if (typeof bound !== "string" || !bound) unavailable()
  return bound
}
function withoutRecoveryRecord(values: Values, recordId: string, owner: string | null): Values {
  const next = { ...values }
  for (const [key, raw] of Object.entries(values)) {
    if (!key.startsWith(RECOVERY_KEY) || raw === null) continue
    const checkpoint: unknown = JSON.parse(raw)
    if (!isRecord(checkpoint) || checkpoint.version !== 1 || !Array.isArray(checkpoint.entries)
      || typeof checkpoint.userId !== "string") unavailable()
    if (!checkpoint.entries.some(value => isRecord(value) && value.id === recordId)) continue
    // Same ID in another owner's checkpoint is a conflict, not a merge/delete grant.
    if (owner === null || checkpoint.userId !== owner
      || (key !== RECOVERY_KEY && key !== `${RECOVERY_KEY}.account.${encodeURIComponent(owner)}`)) unavailable()
    next[key] = JSON.stringify({ ...checkpoint, entries: checkpoint.entries.filter(value => !isRecord(value) || value.id !== recordId) })
  }
  return next
}
export function stageJournalDeviceDeletion(target: Storage, recordId: string): boolean {
  const state = adapterStates.get(canonicalJournalStorage(target))!
  if (!state.stage || !recordId) return false
  try {
    const owner = ownerOf(state.stage.values, recordId)
    state.stage.values = withoutRecoveryRecord(state.stage.values, recordId, owner)
    if (!state.stage.deletions.some(intent => intent.id === recordId)) state.stage.deletions.push({ id: recordId, owner })
    return true
  } catch { return false }
}
function withoutRecord(values: Values, recordId: string, owner: string | null): Values {
  const next = withoutRecoveryRecord(values, recordId, owner)
  for (const key of [JOURNAL_DEVICE_KEYS[0], JOURNAL_DEVICE_KEYS[3]] as const) {
    if (next[key] != null) {
      next[key] = JSON.stringify(parseArray(next[key]).filter(item => {
        if (!isRecord(item)) unavailable()
        return key === JOURNAL_DEVICE_KEYS[0] ? item.id !== recordId
          : isRecord(item.entry) && item.entry.id !== recordId
      }))
    }
  }
  const key = JOURNAL_DEVICE_KEYS[1]
  if (next[key] != null) {
    const vault: unknown = JSON.parse(next[key]!)
    if (!isRecord(vault) || !isRecord(vault.records)) unavailable()
    next[key] = JSON.stringify({ ...vault, records: Object.fromEntries(Object.entries(vault.records).filter(([entryId]) => entryId !== recordId)) })
  }
  return next
}

function repairPendingDeletionCapture(raw: Storage, snapshot: Snapshot): void {
  const intent = snapshot.head.deletions?.[0]
  if (!intent || ownerOf(snapshot.head.values, intent.id) !== intent.owner) unavailable()
  const original = snapshot.seed.values
  const replacement = withoutRecord(original, intent.id, intent.owner)
  const currentValues = withoutRecoveryRecord(snapshot.head.values, intent.id, intent.owner)
  const remaining = snapshot.head.deletions!.filter(value => value.id !== intent.id)
  const actual = valuesFrom(raw)
  // A genuine later v1 edit is neither the captured original nor our exact
  // deletion projection. Keep it and fail closed; never merge it by ID.
  for (const key of new Set([...Object.keys(actual), ...Object.keys(original), ...Object.keys(replacement)])) {
    const value = actual[key] ?? null
    if (value !== (original[key] ?? null) && value !== (replacement[key] ?? null)) unavailable()
  }
  const candidates = generationIds(raw).filter(token => token !== snapshot.seed.id && token !== snapshot.head.id)
    .map(token => generation(raw, token))
  const newSeeds = candidates.filter(candidate => candidate.kind === "seed")
  for (const candidate of candidates) {
    if (candidate.kind === "seed") {
      if (candidate.parent !== null || candidate.seed !== candidate.id || !sameValues(candidate.values, replacement)) unavailable()
    } else {
      if (candidate.parent !== snapshot.head.id || !newSeeds.some(seed => seed.id === candidate.seed)
        || !sameValues(candidate.values, currentValues)
        || JSON.stringify(candidate.deletions ?? []) !== JSON.stringify(remaining)
        || JSON.stringify([...(candidate.cleanup ?? [])].sort()) !== JSON.stringify([...new Set([snapshot.seed.id, snapshot.head.id])].sort())) unavailable()
    }
  }
  if (raw.getItem(JOURNAL_DEVICE_POINTER_KEY) !== snapshot.rawPointer) unavailable()
  for (const key of Object.keys(original)) {
    if ((actual[key] ?? null) === (original[key] ?? null)) continue
    if (raw.getItem(key) !== replacement[key]) unavailable()
    const value = original[key] ?? null
    if (value === null) raw.removeItem(key)
    else raw.setItem(key, value)
    if (raw.getItem(key) !== value) unavailable()
  }
  // Verified unpublished candidates contain only this already-authorized
  // redaction. A conflicting generation is never GC'd by this repair path.
  for (const candidate of candidates) removeOwn(raw, candidate)
  if (raw.getItem(JOURNAL_DEVICE_POINTER_KEY) !== snapshot.rawPointer || !sameValues(valuesFrom(raw), original)) unavailable()
}

/** An explicit delete also redacts the old source and the retained migration
 * seed. Canonical trash is intentionally retained by the existing 30-day rule.
 * No same-ID merge is performed and another account's records are unchanged. */
export function redactJournalDeviceLegacyRecord(target: Storage, recordId: string, expectedOwner?: string | null): boolean {
  if (!recordId) return false
  const state = adapterStates.get(canonicalJournalStorage(target))!, raw = state.raw
  let previous: Snapshot | undefined, seed: Generation | undefined, head: Generation | undefined
  let replacement: Values | undefined
  try {
    previous = read(raw, undefined, true)
    const owner = ownerOf(previous.head.values, recordId)
    if (expectedOwner !== undefined && owner !== expectedOwner) unavailable()
    replacement = withoutRecord(previous.seed.values, recordId, owner)
    const current = withoutRecoveryRecord(previous.head.values, recordId, owner)
    const pending = previous.head.deletions?.filter(intent => intent.id !== recordId) ?? []
    if (sameValues(replacement, previous.seed.values) && sameValues(current, previous.head.values)
      && !previous.head.deletions?.some(intent => intent.id === recordId)) return true
    seed = { version: 2, id: id(), kind: "seed", parent: null, seed: "", values: replacement }
    seed.seed = seed.id
    head = { version: 2, id: id(), kind: "commit", parent: previous.head.id, seed: seed.id, values: current,
      ...(pending.length ? { deletions: pending } : {}), cleanup: [...new Set([previous.seed.id, previous.head.id])] }
    putNew(raw, seed)
    putNew(raw, head)
    if (raw.getItem(JOURNAL_DEVICE_POINTER_KEY) !== previous.rawPointer
      || !sameValues(valuesFrom(raw), previous.seed.values)
      || generationIds(raw).some(other => ![previous!.seed.id, previous!.head.id, seed!.id, head!.id].includes(other))) unavailable()
    for (const key of Object.keys(replacement)) {
      if (replacement[key] === previous.seed.values[key]) continue
      if (raw.getItem(key) !== previous.seed.values[key]) unavailable()
      const value = replacement[key]
      if (value == null) raw.removeItem(key)
      else raw.setItem(key, value)
      if (raw.getItem(key) !== value) unavailable()
    }
    if (raw.getItem(JOURNAL_DEVICE_POINTER_KEY) !== previous.rawPointer || !sameValues(valuesFrom(raw), replacement)) unavailable()
    const pointer = JSON.stringify({ version: 2, seed: seed.id, head: head.id } satisfies Pointer)
    raw.setItem(JOURNAL_DEVICE_POINTER_KEY, pointer)
    if (raw.getItem(JOURNAL_DEVICE_POINTER_KEY) !== pointer || !sameValues(valuesFrom(raw), replacement)
      || generationIds(raw).some(other => ![previous!.seed.id, previous!.head.id, seed!.id, head!.id].includes(other))) unavailable()
    removeOwn(raw, previous.seed)
    if (previous.head.id !== previous.seed.id) removeOwn(raw, previous.head)
    read(raw)
    return true
  } catch {
    if (previous && raw.getItem(JOURNAL_DEVICE_POINTER_KEY) === previous.rawPointer) {
      // Rollback only values still equal to our redaction; a late writer wins
      // preservation, never automatic reconciliation with the new body record.
      if (replacement) for (const key of Object.keys(replacement)) {
        if (replacement[key] === previous.seed.values[key] || raw.getItem(key) !== replacement[key]) continue
        const before = previous.seed.values[key]
        if (before == null) raw.removeItem(key)
        else raw.setItem(key, before)
      }
      if (seed) removeOwn(raw, seed)
      if (head) removeOwn(raw, head)
    }
    return false
  }
}

/** Device-wide explicit erasure removes every payload generation and both
 * namespaces. The remaining empty fence prevents an old cached tab from being
 * silently reimported. Only existing minimal deletion/owner metadata is kept. */
export function eraseJournalDeviceData(target: Storage, includeDeletionRecord: boolean): boolean {
  const state = adapterStates.get(canonicalJournalStorage(target))!, raw = state.raw
  try {
    const capturedPointer = raw.getItem(JOURNAL_DEVICE_POINTER_KEY)
    const capturedLegacy = valuesFrom(raw)
    const sources: Values[] = [valuesFrom(raw)]
    if (!includeDeletionRecord) for (const token of generationIds(raw)) sources.push(generation(raw, token).values)
    const empty = Object.fromEntries([...new Set(sources.flatMap(source => Object.keys(source)))].map(key => [key, null])) as Values
    if (!includeDeletionRecord) {
      const deletions = new Map<string, { id: string; deletedAt: string }>()
      const owners = new Map<string, string>()
      for (const source of sources) {
        for (const value of parseArray(source[JOURNAL_DEVICE_KEYS[4]])) {
          if (!isRecord(value) || typeof value.id !== "string" || !value.id
            || typeof value.deletedAt !== "string" || !value.deletedAt) unavailable()
          const old = deletions.get(value.id)
          if (!old || value.deletedAt < old.deletedAt) deletions.set(value.id, { id: value.id, deletedAt: value.deletedAt })
        }
      }
      for (const source of sources) {
        const serialized = source[JOURNAL_DEVICE_KEYS[2]] ?? null
        if (serialized === null) continue
        const value: unknown = JSON.parse(serialized)
        if (!isRecord(value) || value.schemaVersion !== 1 || !isRecord(value.ownerByEntryId)) unavailable()
        for (const [recordId, owner] of Object.entries(value.ownerByEntryId)) {
          if (!deletions.has(recordId)) continue
          if (typeof owner !== "string" || !owner || (owners.has(recordId) && owners.get(recordId) !== owner)) unavailable()
          owners.set(recordId, owner)
        }
      }
      if (deletions.size) empty[JOURNAL_DEVICE_KEYS[4]] = JSON.stringify([...deletions.values()])
      if (owners.size) empty[JOURNAL_DEVICE_KEYS[2]] = JSON.stringify({ schemaVersion: 1, ownerByEntryId: Object.fromEntries(owners) })
    }
    // A minimal fence exists before deleting originals. Failures remain closed.
    const token = id()
    const fence: Generation = { version: 2, id: token, kind: "seed", parent: null, seed: token, values: empty }
    putNew(raw, fence)
    if (raw.getItem(JOURNAL_DEVICE_POINTER_KEY) !== capturedPointer || !sameValues(valuesFrom(raw), capturedLegacy)) {
      removeOwn(raw, fence)
      return false
    }
    const pointer = JSON.stringify({ version: 2, seed: token, head: token } satisfies Pointer)
    raw.setItem(JOURNAL_DEVICE_POINTER_KEY, pointer)
    if (raw.getItem(JOURNAL_DEVICE_POINTER_KEY) !== pointer) unavailable()
    for (const key of Object.keys(empty)) {
      const value = empty[key]
      if (value == null) raw.removeItem(key)
      else raw.setItem(key, value)
      if (raw.getItem(key) !== value) unavailable()
    }
    for (const other of generationIds(raw)) if (other !== token) {
      raw.removeItem(generationKey(other))
      if (raw.getItem(generationKey(other)) !== null) unavailable()
    }
    read(raw)
    return true
  } catch { return false }
}

/** Emergency reading never initializes a capture. An already-recorded explicit
 * deletion may be resumed; uncertainty is not presented as an empty backup. */
export function readJournalDeviceValue(target: Storage, key: DeviceKey): string | null {
  return target.getItem(JOURNAL_DEVICE_POINTER_KEY) === null ? target.getItem(key) : read(target).head.values[key] ?? null
}
