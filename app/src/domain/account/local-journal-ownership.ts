const OWNERSHIP_KEY = "trainoracle.journal.ownership.v1"
const SCOPE_CHANGED_EVENT = "trainoracle:journal-scope-changed"

type OwnershipManifest = {
  readonly schemaVersion: 1
  readonly ownerByEntryId: Readonly<Record<string, string>>
}

type OwnershipSnapshot = {
  readonly status: "complete" | "uncertain"
  readonly ownerByEntryId: Readonly<Record<string, string>>
  readonly raw: string | null
}

export type OwnershipReservation = {
  readonly ok: boolean
  readonly previousRaw: string | null
  readonly committedRaw: string | null
}

export const LOCAL_JOURNAL_OWNERSHIP_KEY = OWNERSHIP_KEY

let activeAccountId: string | null = null

function storage(): Storage | null {
  try {
    if (typeof window === "undefined") return null
    return window.localStorage
  } catch {
    return null
  }
}

function parseManifest(value: unknown): OwnershipManifest | null {
  if (typeof value !== "object" || value === null) return null
  const record = value as Record<string, unknown>
  if (record.schemaVersion !== 1 || typeof record.ownerByEntryId !== "object" || record.ownerByEntryId === null) {
    return null
  }
  const ownerByEntryId: Record<string, string> = {}
  for (const [entryId, ownerId] of Object.entries(record.ownerByEntryId as Record<string, unknown>)) {
    if (entryId === "" || typeof ownerId !== "string" || ownerId === "") return null
    ownerByEntryId[entryId] = ownerId
  }
  return { schemaVersion: 1, ownerByEntryId }
}

function loadSnapshot(): OwnershipSnapshot {
  const localStorage = storage()
  if (localStorage === null) return { status: "uncertain", ownerByEntryId: {}, raw: null }
  try {
    const raw = localStorage.getItem(OWNERSHIP_KEY)
    if (raw === null) return { status: "complete", ownerByEntryId: {}, raw }
    const parsed = parseManifest(JSON.parse(raw))
    return parsed === null
      ? { status: "uncertain", ownerByEntryId: {}, raw }
      : { status: "complete", ownerByEntryId: parsed.ownerByEntryId, raw }
  } catch {
    return { status: "uncertain", ownerByEntryId: {}, raw: null }
  }
}

function writeManifest(ownerByEntryId: Readonly<Record<string, string>>, expectedRaw: string | null): string | null {
  const localStorage = storage()
  if (localStorage === null) return null
  try {
    if (localStorage.getItem(OWNERSHIP_KEY) !== expectedRaw) return null
    const nextRaw = JSON.stringify({ schemaVersion: 1, ownerByEntryId } satisfies OwnershipManifest)
    localStorage.setItem(OWNERSHIP_KEY, nextRaw)
    return localStorage.getItem(OWNERSHIP_KEY) === nextRaw ? nextRaw : null
  } catch {
    return null
  }
}

function announceScopeChange(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SCOPE_CHANGED_EVENT))
}

export function setActiveLocalAccount(userId: string | null): void {
  const next = userId === "" ? null : userId
  if (activeAccountId === next) return
  activeAccountId = next
  announceScopeChange()
}

export function activeLocalAccount(): string | null {
  return activeAccountId
}

export function onLocalJournalScopeChange(listener: () => void): () => void {
  if (typeof window === "undefined") return () => undefined
  window.addEventListener(SCOPE_CHANGED_EVENT, listener)
  return () => window.removeEventListener(SCOPE_CHANGED_EVENT, listener)
}

/** null은 기기 공용 미연결 데이터, undefined는 소유권 장부 손상·읽기 실패다. */
export function journalOwner(entryId: string): string | null | undefined {
  const snapshot = loadSnapshot()
  if (snapshot.status === "uncertain") return undefined
  return snapshot.ownerByEntryId[entryId] ?? null
}

export function isJournalVisible(entryId: string): boolean {
  const owner = journalOwner(entryId)
  if (owner === undefined) return false
  return owner === null || owner === activeAccountId
}

export function isJournalOwnedBy(entryId: string, userId: string): boolean {
  return userId !== "" && journalOwner(entryId) === userId
}

export function unboundJournalIds(entryIds: readonly string[]): string[] {
  return entryIds.filter((entryId) => journalOwner(entryId) === null)
}

export function reserveJournalOwnership(
  entryIds: readonly string[],
  ownerId: string | null,
): OwnershipReservation {
  const ids = [...new Set(entryIds.filter((entryId) => entryId !== ""))]
  if (ids.length === 0 || ownerId === null) return { ok: true, previousRaw: null, committedRaw: null }
  const snapshot = loadSnapshot()
  if (snapshot.status === "uncertain") return { ok: false, previousRaw: snapshot.raw, committedRaw: null }
  const next = { ...snapshot.ownerByEntryId }
  for (const entryId of ids) {
    const existingOwner = snapshot.ownerByEntryId[entryId]
    if (existingOwner !== undefined && existingOwner !== ownerId) {
      return { ok: false, previousRaw: snapshot.raw, committedRaw: null }
    }
    next[entryId] = ownerId
  }
  const committedRaw = writeManifest(next, snapshot.raw)
  return { ok: committedRaw !== null, previousRaw: snapshot.raw, committedRaw }
}

export function rollbackJournalOwnership(reservation: OwnershipReservation): boolean {
  if (!reservation.ok || reservation.committedRaw === null) return reservation.ok
  const localStorage = storage()
  if (localStorage === null) return false
  try {
    if (localStorage.getItem(OWNERSHIP_KEY) !== reservation.committedRaw) return false
    if (reservation.previousRaw === null) localStorage.removeItem(OWNERSHIP_KEY)
    else localStorage.setItem(OWNERSHIP_KEY, reservation.previousRaw)
    return localStorage.getItem(OWNERSHIP_KEY) === reservation.previousRaw
  } catch {
    return false
  }
}

export function assignJournalsToAccount(entryIds: readonly string[], userId: string): boolean {
  if (userId === "") return false
  if (entryIds.some((entryId) => journalOwner(entryId) === undefined)) return false
  const assignable = entryIds.filter((entryId) => journalOwner(entryId) === null)
  const result = reserveJournalOwnership(assignable, userId)
  if (result.ok) announceScopeChange()
  return result.ok
}

export function retainJournalOwnershipForIds(entryIds: readonly string[]): "removed" | "retained" | "unchanged" | "failed" {
  const localStorage = storage()
  if (localStorage === null) return "failed"
  const snapshot = loadSnapshot()
  if (snapshot.status === "uncertain") return "failed"
  if (snapshot.raw === null) return "unchanged"
  const retainedIds = new Set(entryIds)
  const next = Object.fromEntries(
    Object.entries(snapshot.ownerByEntryId).filter(([entryId]) => retainedIds.has(entryId)),
  )
  try {
    if (Object.keys(next).length === 0) {
      if (localStorage.getItem(OWNERSHIP_KEY) !== snapshot.raw) return "failed"
      localStorage.removeItem(OWNERSHIP_KEY)
      return localStorage.getItem(OWNERSHIP_KEY) === null ? "removed" : "failed"
    }
    if (Object.keys(next).length === Object.keys(snapshot.ownerByEntryId).length) return "unchanged"
    return writeManifest(next, snapshot.raw) === null ? "failed" : "retained"
  } catch {
    return "failed"
  }
}
