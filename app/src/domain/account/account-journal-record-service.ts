import { createAccountDocumentBuffer, type AccountJournalConflictBuffer, type AccountJournalDraftView } from "./account-journal-draft-buffer"
import { accountJournalPreviewEnabled, requestAccountDocument } from "./account-journal-api"
import type { AccountJournalRequest } from "./account-journal-api"
import { accountJournalRecordSchema, validateAccountJournalRecordUpdate, type AccountJournalRecord } from "./account-journal-record-schema"
import type { ConflictChoice } from "./account-journal-draft-buffer"
import { activeLocalAccount } from "./local-journal-ownership"
import { flushAccountJournalDraft } from "./account-journal-sync"
import { putAccountJournalProjection, confirmAccountJournalProjection, removeAccountJournalProjection, resetAccountJournalProjection, setAccountJournalProjectionStatus, suppressAccountJournalLocalCopy } from "./account-journal-projection"
import type { JournalEntry } from "../journal-schema"
import { canEditJournalEntry, keepsImportedObjectiveFacts, preserveJournalProvenance } from "../journal-edit-policy"
import { samePlannedSessionLink } from "../planned-session-link"
import { isAccountJournalWriteRejection, type AccountJournalWriteRejection } from "./account-write-rejection"

let buffer: AccountJournalConflictBuffer<AccountJournalRecord> | null = null
let owner: string | null = null
let generation = 0
let work: Promise<unknown> = Promise.resolve()
let hydration: Promise<boolean> | null = null
type LifecycleRequest = Extract<AccountJournalRequest<AccountJournalRecord>, { action: "delete" | "restore" }>
const lifecycleRequests = new Map<string, LifecycleRequest>()
const deleted = new Map<string, number>()
export function accountJournalDeletedDocuments() { return owner === activeLocalAccount() ? [...deleted].map(([documentId, revision]) => ({ documentId, revision })) : [] }
export function accountJournalRecordsEnabled() { return accountJournalPreviewEnabled() && activeLocalAccount() !== null }

export async function accountJournalDocumentId(ownerId: string, entryId: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(["trainoracle.journal.record.v1", ownerId, entryId]))))
  bytes[6] = (bytes[6]! & 15) | 80; bytes[8] = (bytes[8]! & 63) | 128
  const h = [...bytes.slice(0, 16)].map(value => value.toString(16).padStart(2, "0")).join("")
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

function context() {
  const userId = activeLocalAccount()
  if (!accountJournalRecordsEnabled() || !userId) return null
  if (owner !== userId || !buffer) {
    buffer?.close(); generation += 1; owner = userId; deleted.clear(); lifecycleRequests.clear()
    work = Promise.resolve(); hydration = null
    buffer = createAccountDocumentBuffer(accountJournalRecordSchema, "trainoracle-account-journal-records-v1")
    resetAccountJournalProjection(userId)
  }
  const epoch = generation
  return { ownerId: userId, buffer, current: () => generation === epoch && activeLocalAccount() === userId && accountJournalRecordsEnabled() }
}
export function disposeAccountJournalRecords() {
  generation += 1; buffer?.close(); buffer = null; owner = null; lifecycleRequests.clear(); deleted.clear()
  work = Promise.resolve(); hydration = null; resetAccountJournalProjection(null)
}

type Context = NonNullable<ReturnType<typeof context>>
type View = AccountJournalDraftView<AccountJournalRecord>
const failedSave = { ok: false as const, storage: "FAILED" as const }
type SaveResult = typeof failedSave | { ok: false; storage: "FAILED"; rejection: AccountJournalWriteRejection }
  | { ok: true; storage: "ACCOUNT" | "PENDING" | "CONFLICT" }

// One queue coordinates hydration and mutations. The same named browser lock
// covers other tabs; buffer CAS remains the fallback when Web Locks is absent.
function serialize<T>(ctx: Context, action: () => Promise<T>, fallback: T): Promise<T> {
  const run = work.catch(() => undefined).then(async () => {
    const execute = () => ctx.current() ? action() : Promise.resolve(fallback)
    return globalThis.navigator?.locks
      ? navigator.locks.request(`trainoracle-account-record-service:${ctx.ownerId}`, execute)
      : execute()
  }).catch(() => fallback)
  work = run
  return run
}

function sameValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true
  if (!left || !right || typeof left !== "object" || typeof right !== "object"
    || Array.isArray(left) !== Array.isArray(right)) return false
  const a = left as Record<string, unknown>, b = right as Record<string, unknown>
  const keys = Object.keys(a).filter(key => a[key] !== undefined).sort()
  const other = Object.keys(b).filter(key => b[key] !== undefined).sort()
  return keys.length === other.length && keys.every((key, index) => key === other[index] && sameValue(a[key], b[key]))
}

function publish(ctx: Context, view: View) {
  if (!ctx.current()) return
  if (view.resolvedDeletion) {
    deleted.set(view.documentId, view.resolvedDeletion)
    removeAccountJournalProjection(ctx.ownerId, view.draft.entry.id)
    return
  }
  if (view.blocked) setAccountJournalProjectionStatus(ctx.ownerId, "CONFLICT")
  else if (view.pending?.rejection) setAccountJournalProjectionStatus(ctx.ownerId, "REJECTED")
  else if (view.state !== "DRAFT_ACKNOWLEDGED") setAccountJournalProjectionStatus(ctx.ownerId, "PENDING")
  putAccountJournalProjection(ctx.ownerId, { ...view.draft.entry,
    syncState: view.state === "DRAFT_ACKNOWLEDGED" ? "synced" : "local" }, view.state === "DRAFT_ACKNOWLEDGED")
}

function retainedStatus(views: View[]) {
  return views.some(view => view.blocked) ? "CONFLICT" : views.some(view => view.pending?.rejection) ? "REJECTED"
    : views.some(view => view.state !== "DRAFT_ACKNOWLEDGED") ? "PENDING" : "READY"
}

async function applyTombstone(ctx: Context, documentId: string, revision: number) {
  const cached = await ctx.buffer.read(ctx.ownerId, documentId)
  if (!ctx.current()) return false
  if (cached?.resolvedDeletion === revision) { publish(ctx, cached); return true }
  if (cached && revision <= cached.serverRevision) throw new Error("Stale remote revision")
  if (revision < (deleted.get(documentId) ?? 0)) throw new Error("Stale remote revision")
  deleted.set(documentId, revision)
  if (cached) suppressAccountJournalLocalCopy(ctx.ownerId, cached.draft.entry.id)
  else {
    // After reload the encrypted clean cache may already be gone. Match only
    // explicitly owned legacy IDs, never delete or rewrite the device backup.
    const store = await import("../journal-store")
    const ids = store.loadEntriesOwnedBy(ctx.ownerId).map(entry => entry.id)
    for (const id of ids) {
      if (await accountJournalDocumentId(ctx.ownerId, id) !== documentId) continue
      if (!ctx.current()) return false
      suppressAccountJournalLocalCopy(ctx.ownerId, id)
    }
  }
  if (!ctx.current()) return false
  if (cached && cached.state !== "DRAFT_ACKNOWLEDGED") {
    removeAccountJournalProjection(ctx.ownerId, cached.draft.entry.id)
    // Preserve dirty ciphertext, including drafts not yet queued, as a durable
    // conflict. Never send a save to resurrect a server tombstone.
    if (!cached.blocked) {
      if (!cached.pending) await ctx.buffer.queue(ctx.ownerId, documentId, crypto.randomUUID())
      const pending = (await ctx.buffer.read(ctx.ownerId, documentId))?.pending
      if (pending) await ctx.buffer.conflict(ctx.ownerId, documentId, pending.operationId, revision)
    }
    const retained = await ctx.buffer.read(ctx.ownerId, documentId)
    if (retained) publish(ctx, retained)
    return false
  }
  if (cached) {
    await ctx.buffer.acceptCleanDeletion(ctx.ownerId, documentId, revision, cached.localSequence)
    if (ctx.current()) removeAccountJournalProjection(ctx.ownerId, cached.draft.entry.id)
  }
  return ctx.current()
}

export type AccountJournalConflictReview = {
  ownerId: string; documentId: string; localSequence: number; remoteRevision: number
  local: AccountJournalRecord; remote: AccountJournalRecord | null
}

/** Reads current authenticated server data; a blocked receipt is never a remote body. */
async function fetchConflict(ctx: Context, documentId: string) {
  const result = await requestAccountDocument(ctx.ownerId, { action: "read", documentId }, ctx.current, accountJournalRecordSchema)
  if (!result.ok || !ctx.current()) return null
  const data = result.data
  if ((data.kind !== "document" && data.kind !== "deleted") || data.documentId !== documentId) return null
  if (data.kind === "document" && (documentId !== await accountJournalDocumentId(ctx.ownerId, data.document.entry.id)
    || !ctx.current())) return null
  return { revision: data.revision, document: data.kind === "document" ? data.document : null }
}

export async function listAccountJournalConflicts() {
  const ctx = context()
  if (!ctx) return []
  return serialize(ctx, async () => {
    const views = await ctx.buffer.list(ctx.ownerId)
    return ctx.current() ? views.filter(view => view.blocked).map(view => ({
      ownerId: ctx.ownerId, documentId: view.documentId, date: view.draft.entry.date,
    })) : []
  }, [])
}

export async function listAccountJournalRecoveryRecords() {
  const ctx = context()
  if (!ctx) return []
  return serialize(ctx, async () => {
    const views = await ctx.buffer.list(ctx.ownerId)
    return ctx.current() ? views.filter(view => view.recoverableVersions).map(view => ({
      ownerId: ctx.ownerId, documentId: view.documentId, date: view.draft.entry.date, count: view.recoverableVersions!,
    })) : []
  }, [])
}

export async function readAccountJournalConflictArchive(ownerId: string, documentId: string) {
  const ctx = context()
  if (!ctx || ctx.ownerId !== ownerId) return null
  return serialize(ctx, async () => {
    const versions = await ctx.buffer.readConflictArchive(ownerId, documentId, ctx.current)
    for (const version of versions) {
      for (const document of [version.local, version.remote, version.pending?.draft]) {
        if (document && await accountJournalDocumentId(ownerId, document.entry.id) !== documentId) return null
      }
    }
    return ctx.current() ? versions : null
  }, null)
}

export async function reviewAccountJournalConflict(documentId: string): Promise<AccountJournalConflictReview | null> {
  const ctx = context()
  if (!ctx) return null
  return serialize<AccountJournalConflictReview | null>(ctx, async () => {
    const local = await ctx.buffer.read(ctx.ownerId, documentId)
    if (!local?.blocked || !ctx.current()) return null
    const remote = await fetchConflict(ctx, documentId)
    if (!remote || !ctx.current()) return null
    await ctx.buffer.captureConflict(ctx.ownerId, documentId, remote.document, remote.revision, local.localSequence, ctx.current)
    if (!ctx.current()) return null
    return { ownerId: ctx.ownerId, documentId, localSequence: local.localSequence,
      remoteRevision: remote.revision, local: local.draft, remote: remote.document }
  }, null)
}

export async function resolveAccountJournalConflict(review: AccountJournalConflictReview, choice: ConflictChoice): Promise<"ACCOUNT" | "PENDING" | "REVIEW_REQUIRED" | "FAILED"> {
  const ctx = context()
  if (!ctx || ctx.ownerId !== review.ownerId) return "FAILED"
  return serialize<"ACCOUNT" | "PENDING" | "REVIEW_REQUIRED" | "FAILED">(ctx, async () => {
    const local = await ctx.buffer.read(ctx.ownerId, review.documentId)
    if (!local?.blocked || local.localSequence !== review.localSequence || !sameValue(local.draft, review.local)) return "REVIEW_REQUIRED"
    const remote = await fetchConflict(ctx, review.documentId)
    if (!remote || !ctx.current()) return "FAILED"
    if (remote.revision !== review.remoteRevision || !sameValue(remote.document, review.remote)) return "REVIEW_REQUIRED"
    if ((choice === "DELETE") !== (remote.document === null)) return "FAILED"
    if (choice === "LOCAL" && (!remote.document || !validateAccountJournalRecordUpdate(remote.document, local.draft))) return "FAILED"
    // Re-capture then resolve with IDB CAS. An intervening tab edit cannot disappear.
    await ctx.buffer.captureConflict(ctx.ownerId, review.documentId, remote.document, remote.revision, review.localSequence, ctx.current)
    if (!ctx.current()) return "FAILED"
    await ctx.buffer.resolveConflict(ctx.ownerId, review.documentId, choice, remote.revision, review.localSequence, ctx.current)
    if (!ctx.current()) return "FAILED"
    let state: "ACCOUNT" | "PENDING" | "REVIEW_REQUIRED" | "FAILED" = "ACCOUNT"
    if (choice === "LOCAL") {
      deleted.delete(review.documentId)
      const flushed = await flushAccountJournalDraft(ctx.buffer, ctx.ownerId, review.documentId,
        request => requestAccountDocument(ctx.ownerId, request, ctx.current, accountJournalRecordSchema), ctx.current)
      state = isAccountJournalWriteRejection(flushed) ? "FAILED" : flushed === "SAVED" ? "ACCOUNT" : flushed === "CONFLICT" ? "REVIEW_REQUIRED" : "PENDING"
    }
    const latest = await ctx.buffer.read(ctx.ownerId, review.documentId)
    if (!latest || !ctx.current()) return "FAILED"
    publish(ctx, latest)
    const retained = await ctx.buffer.list(ctx.ownerId)
    if (!ctx.current()) return "FAILED"
    setAccountJournalProjectionStatus(ctx.ownerId, retainedStatus(retained))
    return state
  }, "FAILED")
}

async function reconcileDocument(ctx: Context, documentId: string) {
  const result = await requestAccountDocument(ctx.ownerId, { action: "read", documentId }, ctx.current, accountJournalRecordSchema)
  if (!result.ok || !ctx.current()) return null
  const data = result.data
  if (data.kind === "deleted") return { data, clean: await applyTombstone(ctx, documentId, data.revision) }
  if (data.kind !== "document" || documentId !== await accountJournalDocumentId(ctx.ownerId, data.document.entry.id) || !ctx.current()) return null
  if (data.revision <= (deleted.get(documentId) ?? 0)) return null
  const imported = await ctx.buffer.importRemote(ctx.ownerId, documentId, data.document, data.revision)
  const view = await ctx.buffer.read(ctx.ownerId, documentId)
  if (!view || !ctx.current()) return null
  deleted.delete(documentId); publish(ctx, view)
  return { data, clean: imported !== "CONFLICT" && view.state === "DRAFT_ACKNOWLEDGED" }
}

export type AccountJournalWriteBase = {
  entry: JournalEntry | null
  revision: number
  contentFingerprint: string | null
}

/** Full private content identity; transport acknowledgement alone is not content. */
export async function accountJournalEntryFingerprint(entry: JournalEntry): Promise<string> {
  function stable(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(stable)
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value)
      .filter(([, item]) => item !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([key, item]) => [key, stable(item)]))
    return value
  }
  const { syncState: _syncState, ...content } = entry
  const bytes = new TextEncoder().encode(JSON.stringify(stable(content)))
  try {
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))
    return `sha256:${[...digest].map(value => value.toString(16).padStart(2, "0")).join("")}`
  } finally { bytes.fill(0) }
}

export async function readAccountJournalWriteBase(entryId: string): Promise<AccountJournalWriteBase | null> {
  let ctx: ReturnType<typeof context>
  try { ctx = context() } catch { return null }
  if (!ctx) return null
  const current = ctx
  return serialize<AccountJournalWriteBase | null>(current, async () => {
    const documentId = await accountJournalDocumentId(current.ownerId, entryId)
    if (!current.current() || lifecycleRequests.has(documentId) || deleted.has(documentId)) return null
    let view = await current.buffer.read(current.ownerId, documentId)
    if (!view) {
      const remote = await requestAccountDocument(current.ownerId, { action: "read", documentId }, current.current, accountJournalRecordSchema)
      if (!current.current()) return null
      if (!remote.ok) return remote.code === "NOT_FOUND" ? { entry: null, revision: 0, contentFingerprint: null } : null
      if (remote.data.kind !== "document" || remote.data.document.entry.id !== entryId) return null
      await current.buffer.importRemote(current.ownerId, documentId, remote.data.document, remote.data.revision)
      view = await current.buffer.read(current.ownerId, documentId)
    }
    if (!view || view.blocked || view.pending || view.resolvedDeletion || view.state !== "DRAFT_ACKNOWLEDGED") return null
    const contentFingerprint = await accountJournalEntryFingerprint(view.draft.entry)
    if (!current.current()) return null
    return { entry: structuredClone(view.draft.entry), revision: view.serverRevision, contentFingerprint }
  }, null)
}

export async function persistAccountJournalRecord(entry: JournalEntry, expectedSavedAt?: string, writePurpose?: "MIGRATION",
  expectedBase?: Pick<AccountJournalWriteBase, "revision" | "contentFingerprint">): Promise<SaveResult> {
  let ctx: ReturnType<typeof context>
  try { ctx = context() } catch { return failedSave }
  if (!ctx) return failedSave
  const current = ctx
  return serialize<SaveResult>(current, async () => {
    let durable = false
    try {
      // The codec still requires a genuine local write. Migration normalizes only
      // its legacy transport metadata before calling this boundary.
      let document = accountJournalRecordSchema.parse({ version: 2, state: "FINALIZED", kind: "JOURNAL", entry })
      const documentId = await accountJournalDocumentId(current.ownerId, document.entry.id)
      if (!current.current() || lifecycleRequests.has(documentId) || deleted.has(documentId)) return failedSave
      const old = await current.buffer.read(current.ownerId, documentId)
      if (expectedBase !== undefined) {
        if (!expectedBase || !Number.isSafeInteger(expectedBase.revision) || expectedBase.revision < 0
          || (expectedBase.revision === 0 ? expectedBase.contentFingerprint !== null
            : typeof expectedBase.contentFingerprint !== "string" || !/^sha256:[a-f0-9]{64}$/.test(expectedBase.contentFingerprint))) return failedSave
        if (old?.blocked || old?.resolvedDeletion) return failedSave
        const oldFingerprint = old ? await accountJournalEntryFingerprint(old.draft.entry) : null
        const matchesBase = old ? old.state === "DRAFT_ACKNOWLEDGED" && old.serverRevision === expectedBase.revision
          && oldFingerprint === expectedBase.contentFingerprint : expectedBase.revision === 0
        const exactBody = old && oldFingerprint === await accountJournalEntryFingerprint(document.entry)
        const exactPurpose = old && old.writePurpose === writePurpose
        if (exactBody && !exactPurpose) return failedSave
        const retry = old && exactBody && exactPurpose && (old.state === "DRAFT_ACKNOWLEDGED"
          ? old.serverRevision === expectedBase.revision + 1
          : old.pending && old.pending.expectedRevision === expectedBase.revision
            && old.pending.sequence === old.localSequence && old.pending.writePurpose === writePurpose
            && await accountJournalEntryFingerprint(old.pending.draft.entry) === oldFingerprint)
        if (!matchesBase && !retry) return failedSave
        if (!current.current()) return failedSave
      }
      if (writePurpose && old?.pending && old.pending.writePurpose !== writePurpose) return failedSave
      if (old && expectedSavedAt !== undefined) {
        const previous = old.draft.entry, next = document.entry
        if (!canEditJournalEntry(previous) || !keepsImportedObjectiveFacts(previous, next)
          || previous.kind !== next.kind || previous.date !== next.date
          || (previous.kind === "post-session" && next.kind === "post-session"
            && !samePlannedSessionLink(previous.plannedSessionLink, next.plannedSessionLink))) return failedSave
        document = accountJournalRecordSchema.parse({ ...document, entry: preserveJournalProvenance(previous, next) })
      }
      // Identical retries resume the durable snapshot even when the caller still
      // holds the pre-save savedAt. Key order is not content or revision identity.
      if (!old || !sameValue(old.draft, document)) {
        if (expectedSavedAt === undefined ? old !== null : old?.draft.entry.savedAt !== expectedSavedAt) return failedSave
        if (old) {
          const previousTime = Date.parse(old.draft.entry.savedAt), nextTime = Date.parse(document.entry.savedAt)
          if (!Number.isFinite(nextTime) || (Number.isFinite(previousTime) && nextTime <= previousTime)) return failedSave
        }
        await current.buffer.saveDraft(current.ownerId, documentId, document, old?.localSequence ?? 0, writePurpose)
      } else if (writePurpose && old.writePurpose !== writePurpose) {
        await current.buffer.saveDraft(current.ownerId, documentId, document, old.localSequence, writePurpose)
      }
      durable = true
      if (!current.current()) return failedSave
      const local = await current.buffer.read(current.ownerId, documentId)
      if (local) publish(current, local)
      const result = await flushAccountJournalDraft(current.buffer, current.ownerId, documentId,
        request => requestAccountDocument(current.ownerId, request, current.current, accountJournalRecordSchema), current.current)
      if (!current.current()) return failedSave
      const confirmed = await current.buffer.read(current.ownerId, documentId)
      if (confirmed) publish(current, confirmed)
      const retained = await current.buffer.list(current.ownerId)
      if (!current.current()) return failedSave
      setAccountJournalProjectionStatus(current.ownerId, retainedStatus(retained))
      if (isAccountJournalWriteRejection(result)) return { ok: false, storage: "FAILED", rejection: result }
      return { ok: true, storage: result === "SAVED" ? "ACCOUNT" : result === "CONFLICT" ? "CONFLICT" : "PENDING" }
    } catch {
      return durable && current.current() ? { ok: true, storage: "PENDING" } : failedSave
    }
  }, failedSave)
}

export async function hydrateAccountJournalRecords() {
  let ctx: ReturnType<typeof context>
  try { ctx = context() } catch { return false }
  if (!ctx) return false
  if (hydration) return hydration
  const current = ctx
  const run = serialize(current, () => hydrate(current), false)
  hydration = run
  try { return await run } finally { if (hydration === run) hydration = null }
}

async function hydrate(ctx: Context) {
  try {
    setAccountJournalProjectionStatus(ctx.ownerId, "LOADING")
    const local = await ctx.buffer.list(ctx.ownerId)
    for (const item of local) {
      if (!ctx.current()) return false
      publish(ctx, item)
    }
    const documents: { documentId: string; document: AccountJournalRecord; revision: number }[] = []
    const tombstones: { documentId: string; revision: number }[] = []
    let cursor: string | undefined
    const seen = new Set<string>()
    do {
      const result = await requestAccountDocument(ctx.ownerId, { action: "list", collection: "JOURNAL", ...(cursor ? { cursor } : {}) }, ctx.current, accountJournalRecordSchema)
      if (!result.ok || result.data.kind !== "list" || !ctx.current()) throw new Error("Unavailable")
      documents.push(...result.data.documents)
      tombstones.push(...result.data.deletedDocuments ?? [])
      cursor = result.data.nextCursor ?? undefined
      if (cursor && seen.has(cursor)) throw new Error("Repeated cursor")
      if (cursor) seen.add(cursor)
    } while (cursor)
    // Discover deletions before replay. Pending save receipts must replay before
    // importing live snapshots, or a lost success receipt looks like a conflict.
    const ids = new Set<string>()
    for (const item of [...documents, ...tombstones]) {
      if (ids.has(item.documentId)) throw new Error("Repeated document")
      ids.add(item.documentId)
    }
    for (const item of documents) {
      if (item.documentId !== await accountJournalDocumentId(ctx.ownerId, item.document.entry.id)) throw new Error("Invalid identity")
    }
    for (const item of tombstones) {
      if (!ctx.current()) return false
      await applyTombstone(ctx, item.documentId, item.revision)
    }
    for (const item of local) {
      if (!ctx.current()) return false
      if (!deleted.has(item.documentId) && !lifecycleRequests.has(item.documentId)
        && !item.blocked && item.state !== "DRAFT_ACKNOWLEDGED") {
        await flushAccountJournalDraft(ctx.buffer, ctx.ownerId, item.documentId,
          request => requestAccountDocument(ctx.ownerId, request, ctx.current, accountJournalRecordSchema), ctx.current)
        const view = await ctx.buffer.read(ctx.ownerId, item.documentId)
        if (view) publish(ctx, view)
      }
    }
    for (const item of documents) {
      if (!ctx.current()) return false
      if (item.revision <= (deleted.get(item.documentId) ?? 0)) throw new Error("Stale remote revision")
      const before = await ctx.buffer.read(ctx.ownerId, item.documentId)
      // The replay above may already have acknowledged a newer revision.
      if (!before || item.revision >= before.serverRevision) await ctx.buffer.importRemote(ctx.ownerId, item.documentId, item.document, item.revision)
      const view = await ctx.buffer.read(ctx.ownerId, item.documentId)
      if (!ctx.current()) return false
      if (view && view.state !== "DRAFT_ACKNOWLEDGED" && item.revision >= view.serverRevision) {
        confirmAccountJournalProjection(ctx.ownerId, { ...item.document.entry, syncState: "synced" })
      }
      if (view) publish(ctx, view)
      deleted.delete(item.documentId)
    }
    const retained = await ctx.buffer.list(ctx.ownerId)
    if (!ctx.current()) return false
    setAccountJournalProjectionStatus(ctx.ownerId, retainedStatus(retained))
    return true
  } catch { if (ctx.current()) setAccountJournalProjectionStatus(ctx.ownerId, "FAILED"); return false }
}

export async function accountJournalRecordHistory(documentId: string) {
  const ctx = context()
  if (!ctx) return null
  const result = await requestAccountDocument(ctx.ownerId, { action: "history", documentId, collection: "JOURNAL" }, ctx.current, accountJournalRecordSchema)
  if (!result.ok || result.data.kind !== "history" || !ctx.current()) return null
  for (const version of result.data.versions) {
    if (await accountJournalDocumentId(ctx.ownerId, version.document.entry.id) !== documentId || !ctx.current()) return null
  }
  return result.data
}

export async function deleteAccountJournalRecord(entryId: string) {
  const ctx = context()
  if (!ctx) return false
  return serialize(ctx, async () => {
    const documentId = await accountJournalDocumentId(ctx.ownerId, entryId)
    let view = await ctx.buffer.read(ctx.ownerId, documentId)
    if ((view && view.state !== "DRAFT_ACKNOWLEDGED") || !ctx.current()) return false
    let request = lifecycleRequests.get(documentId)
    if (request && request.action !== "delete") return false
    if (!request) {
      const reviewedRevision = view?.serverRevision
      const remote = await reconcileDocument(ctx, documentId)
      if (!remote?.clean || !ctx.current()) return false
      if (remote.data.kind === "deleted") return true
      // Reconcile a newer remote edit for review; do not silently delete it.
      if (reviewedRevision === undefined || remote.data.revision !== reviewedRevision) return false
      view = await ctx.buffer.read(ctx.ownerId, documentId)
      if (!view || view.state !== "DRAFT_ACKNOWLEDGED" || !ctx.current()) return false
      request = { action: "delete", documentId, operationId: crypto.randomUUID(), expectedRevision: view.serverRevision }
      lifecycleRequests.set(documentId, request)
    }
    const result = await requestAccountDocument(ctx.ownerId, request, ctx.current, accountJournalRecordSchema)
    if (ctx.current() && (result.ok ? result.data.kind === "conflict" : result.code === "CONFLICT")) {
      lifecycleRequests.delete(documentId)
      await reconcileDocument(ctx, documentId)
      return false
    }
    if (!result.ok || result.data.kind !== "deleted" || !ctx.current()) return false
    const clean = await applyTombstone(ctx, documentId, result.data.revision)
    if (!ctx.current()) return false
    lifecycleRequests.delete(documentId)
    return clean
  }, false)
}

export async function restoreAccountJournalVersion(documentId: string, sourceRevision: number, expectedRevision: number) {
  const ctx = context()
  if (!ctx) return false
  return serialize(ctx, async () => {
    const cached = await ctx.buffer.read(ctx.ownerId, documentId)
    if ((cached && cached.state !== "DRAFT_ACKNOWLEDGED") || !ctx.current()) return false
    let request = lifecycleRequests.get(documentId)
    if (request && (request.action !== "restore" || request.sourceRevision !== sourceRevision || request.expectedRevision !== expectedRevision)) return false
    if (!request) {
      // A reload loses in-memory operation IDs. Always reconcile the server base
      // before creating a fresh lifecycle operation, never guess from the cache.
      const remote = await reconcileDocument(ctx, documentId)
      if (!remote?.clean || remote.data.revision !== expectedRevision || !ctx.current()) return false
      const history = await accountJournalRecordHistory(documentId)
      if (!history?.versions.some(version => version.revision === sourceRevision) || !ctx.current()) return false
      request = { action: "restore", documentId, sourceRevision, expectedRevision, operationId: crypto.randomUUID() }
      lifecycleRequests.set(documentId, request)
    }
    const result = await requestAccountDocument(ctx.ownerId, request, ctx.current, accountJournalRecordSchema)
    if (ctx.current() && (result.ok ? result.data.kind === "conflict" : result.code === "CONFLICT")) {
      lifecycleRequests.delete(documentId)
      await reconcileDocument(ctx, documentId)
      return false
    }
    if (!result.ok || result.data.kind !== "restored" || !ctx.current()) return false
    const restored = await reconcileDocument(ctx, documentId)
    if (!restored || !ctx.current()) return false
    lifecycleRequests.delete(documentId)
    return restored.clean && restored.data.kind === "document" && restored.data.revision === result.data.revision
  }, false)
}

export async function readAccountJournalRecordVersion(entryId: string) {
  const ctx = context()
  if (!ctx) return null
  const documentId = await accountJournalDocumentId(ctx.ownerId, entryId)
  const result = await requestAccountDocument(ctx.ownerId, { action: "read", documentId }, ctx.current, accountJournalRecordSchema)
  return result.ok && (result.data.kind === "document" || result.data.kind === "deleted") ? { documentId, revision: result.data.revision } : null
}

export async function undoAccountJournalDeletion(entryId: string) {
  const ctx = context()
  if (!ctx) return false
  const documentId = await accountJournalDocumentId(ctx.ownerId, entryId)
  const revision = deleted.get(documentId)
  return revision !== undefined && revision > 1 ? restoreAccountJournalVersion(documentId, revision - 1, revision) : false
}

/** Only journals already explicitly assigned to this account; never delete device originals. */
export async function migrateOwnedAccountJournals() {
  const ctx = context()
  if (!ctx) return { saved: 0, pending: 0, attention: 0, ok: false }
  const result = { saved: 0, pending: 0, attention: 0, ok: true }
  try {
    const store = await import("../journal-store")
    const owned = store.loadEntriesOwnedBy(ctx.ownerId)
    const unlocked = await store.loadEntriesWithPrivateMemos()
    for (const source of owned) {
      if (!ctx.current()) return { ...result, ok: false }
      const entry: JournalEntry = { ...(source.memoPurpose === "PRIVATE_SELF_ONLY"
        ? unlocked.find(item => item.id === source.id) ?? source : source), syncState: "local" }
      const raw = entry.kind === "evening" ? entry.note : entry.memo
      if (entry.memoPurpose === "PRIVATE_SELF_ONLY" && raw === "") { result.attention += 1; continue }
      const saved = await persistAccountJournalRecord(entry, undefined, "MIGRATION")
      if (!saved.ok || saved.storage === "CONFLICT") result.attention += 1
      else if (saved.storage === "ACCOUNT") result.saved += 1
      else result.pending += 1
    }
    return result
  } catch { return { ...result, ok: false } }
}
