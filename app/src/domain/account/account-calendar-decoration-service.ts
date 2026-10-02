import { requestAccountDocument } from "./account-journal-api"
import { activeLocalAccount, onLocalJournalScopeChange } from "./local-journal-ownership"
import { createAccountDocumentBuffer, type AccountJournalConflictBuffer } from "./account-journal-draft-buffer"
import { flushAccountJournalDraft } from "./account-journal-sync"
import { accountCalendarDecorationDocumentSchema, type AccountCalendarDecorationDocument } from "./account-calendar-decoration-schema"
import { accountDecorationsEnabled, accountDecorationStatus, hydrateAccountDecorations,
  persistAccountDecorations, readAccountDecorationState } from "./account-decoration-service"
import { calendarDecorationStateSchema, calendarDecorationsOwnedBy, createEmptyCalendarDecorationState,
  type CalendarDecorationState } from "../calendar-decoration-schema"

export type AccountCalendarDecorationStatus = "IDLE" | "AUTH_REQUIRED" | "LOADING" | "EMPTY" | "READY"
  | "PENDING" | "CONFLICT" | "DELETED" | "FAILED" | "UNSUPPORTED" | "OWNERSHIP_STATE_CHANGED"
export const ACCOUNT_CALENDAR_DECORATION_EVENT = "trainoracle:account-calendar-decorations-changed"
export const ACCOUNT_CALENDAR_DECORATION_DATABASE = "trainoracle-account-calendar-decorations-v1"
let owner: string | null = null
let epoch = 0
let buffer: AccountJournalConflictBuffer<AccountCalendarDecorationDocument> | null = null
let projection: CalendarDecorationState | null = null
let status: AccountCalendarDecorationStatus = "IDLE"
let baseKnown = false
let supported = false
let work: Promise<unknown> = Promise.resolve()
let hydration: Promise<boolean> | null = null
let unsubscribe: (() => void) | null = null

function setStatus(next: AccountCalendarDecorationStatus) {
  status = next
  if (typeof window !== "undefined") window.dispatchEvent(new Event(ACCOUNT_CALENDAR_DECORATION_EVENT))
}
export function accountCalendarDecorationStatus(): AccountCalendarDecorationStatus {
  if (!accountDecorationsEnabled()) return "IDLE"
  if (!activeLocalAccount()) return "AUTH_REQUIRED"
  return owner === activeLocalAccount() ? status : "IDLE"
}
export function readAccountCalendarDecorationState(): CalendarDecorationState | null {
  return accountDecorationsEnabled() && owner !== null && owner === activeLocalAccount() && projection
    ? structuredClone(projection) : null
}
export async function accountCalendarDecorationDocumentId(ownerId: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(
    JSON.stringify(["trainoracle.account.calendar-decorations.v1", ownerId]))))
  bytes[6] = (bytes[6]! & 15) | 80; bytes[8] = (bytes[8]! & 63) | 128
  const h = [...bytes.slice(0, 16)].map(value => value.toString(16).padStart(2, "0")).join("")
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}
export function disposeAccountCalendarDecorations() {
  epoch += 1; buffer?.close(); buffer = null; owner = null; projection = null; hydration = null
  baseKnown = false; supported = false; work = Promise.resolve(); unsubscribe?.(); unsubscribe = null; setStatus("IDLE")
}
function context() {
  const user = activeLocalAccount()
  if (!user || !accountDecorationsEnabled()) return null
  if (owner !== user || !buffer) {
    disposeAccountCalendarDecorations(); owner = user
    try { buffer = createAccountDocumentBuffer(accountCalendarDecorationDocumentSchema, ACCOUNT_CALENDAR_DECORATION_DATABASE) }
    catch { setStatus("FAILED"); return null }
    unsubscribe = onLocalJournalScopeChange(disposeAccountCalendarDecorations)
    setStatus("LOADING")
  }
  const generation = epoch
  return { owner: user, buffer, current: () => epoch === generation && activeLocalAccount() === user && accountDecorationsEnabled() }
}
type Context = NonNullable<ReturnType<typeof context>>
function serialize<T>(ctx: Context, fn: () => Promise<T>, fallback: T): Promise<T> {
  const next = work.catch(() => undefined).then(async () => {
    // Calendar writes must not race another tab with the same owner. A browser
    // without the existing account-lock primitive keeps the draft read-only.
    if (!ctx.current()) return fallback
    if (!globalThis.navigator?.locks) { setStatus("FAILED"); return fallback }
    return navigator.locks.request(`trainoracle-account-calendar-decorations:${ctx.owner}`, () => ctx.current() ? fn() : fallback)
  }).catch(() => { if (ctx.current()) setStatus("FAILED"); return fallback })
  work = next; return next
}
async function confirmSupport(ctx: Context) {
  const result = await requestAccountDocument(ctx.owner, { action: "calendarDecorationSupport" }, ctx.current,
    accountCalendarDecorationDocumentSchema)
  if (!ctx.current()) return false
  supported = result.ok && result.data.kind === "calendar-decoration-support" && result.data.version === 1
  if (!supported) setStatus(!result.ok && (result.code === "INVALID_RESPONSE" || result.code === "CALENDAR_DECORATION_UNSUPPORTED") ? "UNSUPPORTED" : "FAILED")
  return supported
}
async function publish(ctx: Context, id: string) {
  const view = await ctx.buffer.read(ctx.owner, id)
  if (!ctx.current() || !view) return null
  if (view.resolvedDeletion) { projection = null; baseKnown = false; setStatus("DELETED"); return view }
  projection = structuredClone(view.draft.data)
  setStatus(view.blocked ? "CONFLICT" : view.pending?.rejection === "OWNERSHIP_STATE_CHANGED" ? "OWNERSHIP_STATE_CHANGED"
    : view.pending?.rejection ? "FAILED" : view.state === "DRAFT_ACKNOWLEDGED" ? "READY" : "PENDING")
  return view
}
async function flush(ctx: Context, id: string) {
  if (!supported || !ctx.current()) return "UNAVAILABLE" as const
  return flushAccountJournalDraft(ctx.buffer, ctx.owner, id,
    request => requestAccountDocument(ctx.owner, request, ctx.current, accountCalendarDecorationDocumentSchema), ctx.current)
}

export async function hydrateAccountCalendarDecorations(): Promise<boolean> {
  const ctx = context(); if (!ctx) return false
  if (hydration) return hydration
  const run = serialize(ctx, async () => {
    setStatus("LOADING")
    if (!await confirmSupport(ctx)) return false
    const id = await accountCalendarDecorationDocumentId(ctx.owner)
    let local = await ctx.buffer.read(ctx.owner, id)
    if (!ctx.current()) return false
    if (local) await publish(ctx, id)
    const remote = await requestAccountDocument(ctx.owner, { action: "read", documentId: id }, ctx.current, accountCalendarDecorationDocumentSchema)
    if (!ctx.current()) return false
    if (!remote.ok) {
      if (remote.code === "NOT_FOUND" && !local) {
        baseKnown = true; projection = createEmptyCalendarDecorationState(); setStatus("EMPTY"); return true
      }
      if (remote.code === "NOT_FOUND" && local?.serverRevision === 0 && !local.blocked) {
        baseKnown = true; await flush(ctx, id)
        return (await publish(ctx, id))?.state === "DRAFT_ACKNOWLEDGED"
      }
      // Unknown remote envelopes never become an empty writable document.
      baseKnown = false; setStatus(remote.code === "INVALID_RESPONSE" ? "UNSUPPORTED" : "FAILED"); return false
    }
    if (remote.data.kind === "deleted") {
      const revision = remote.data.revision
      if (local?.resolvedDeletion === revision || !local) {
        projection = null; baseKnown = false; setStatus("DELETED"); return true
      }
      if (revision <= local.serverRevision) throw new Error("Stale calendar deletion")
      if (local.state === "DRAFT_ACKNOWLEDGED") {
        await ctx.buffer.acceptCleanDeletion(ctx.owner, id, revision, local.localSequence)
        if (!ctx.current()) return false
        projection = null; baseKnown = false; setStatus("DELETED"); return true
      }
      if (!local.blocked) {
        if (!local.pending) await ctx.buffer.queue(ctx.owner, id, crypto.randomUUID())
        local = await ctx.buffer.read(ctx.owner, id)
        if (!local?.pending || !ctx.current()) return false
        await ctx.buffer.conflict(ctx.owner, id, local.pending.operationId, revision)
      }
      if (!ctx.current()) return false
      await ctx.buffer.captureConflict(ctx.owner, id, null, revision, local.localSequence, ctx.current)
      if (!ctx.current()) return false
      projection = null; baseKnown = false; setStatus("CONFLICT"); return false
    }
    if (remote.data.kind !== "document") { baseKnown = false; setStatus("FAILED"); return false }
    if (local && remote.data.revision < local.serverRevision) throw new Error("Stale calendar revision")
    baseKnown = true
    // A fixed operation is replayed before a live import so a lost receipt does
    // not silently replace the draft or manufacture a conflict.
    if (local && !local.blocked && !local.resolvedDeletion && local.state !== "DRAFT_ACKNOWLEDGED") {
      await flush(ctx, id); local = await publish(ctx, id)
    }
    if (!local || remote.data.revision >= local.serverRevision) {
      await ctx.buffer.importRemote(ctx.owner, id, remote.data.document, remote.data.revision)
    }
    if (!ctx.current()) return false
    return (await publish(ctx, id))?.state === "DRAFT_ACKNOWLEDGED"
  }, false)
  hydration = run
  try { return await run } finally { if (hydration === run) hydration = null }
}

export type AccountCalendarDecorationSaveResult =
  | { ok: true; storage: "ACCOUNT" | "PENDING"; state: CalendarDecorationState }
  | { ok: false; code: "INVALID_STATE" | "STORAGE_UNAVAILABLE" | "STALE_STATE" | "WRITE_FAILED" | "UNSUPPORTED" | "OWNERSHIP_STATE_CHANGED" }

async function canonicalOwnership(ctx: Context, state: CalendarDecorationState) {
  await hydrateAccountDecorations()
  if (!ctx.current()) return false
  const owned = readAccountDecorationState()
  if (!owned || !["READY", "EMPTY", "PENDING"].includes(accountDecorationStatus()) || !calendarDecorationsOwnedBy(state, owned)) return false
  if (accountDecorationStatus() === "EMPTY") {
    // Even starter-only calendar art references the same canonical inventory.
    const first = await persistAccountDecorations(owned, JSON.stringify(owned))
    return ctx.current() && first.ok && first.storage === "ACCOUNT"
  }
  return true
}
export async function persistAccountCalendarDecorations(candidate: unknown, expectedSerialized: string | null): Promise<AccountCalendarDecorationSaveResult> {
  const parsed = calendarDecorationStateSchema.safeParse(candidate)
  if (!parsed.success) return { ok: false, code: "INVALID_STATE" }
  const ctx = context(); if (!ctx) return { ok: false, code: "STORAGE_UNAVAILABLE" }
  const fallback = { ok: false as const, code: "WRITE_FAILED" as const }
  return serialize<AccountCalendarDecorationSaveResult>(ctx, async () => {
    if (!supported || !baseKnown || !projection || !["READY", "EMPTY", "PENDING", "OWNERSHIP_STATE_CHANGED"].includes(status)) {
      return { ok: false, code: status === "UNSUPPORTED" ? "UNSUPPORTED" : "STORAGE_UNAVAILABLE" }
    }
    if (expectedSerialized !== JSON.stringify(projection)) return { ok: false, code: "STALE_STATE" }
    if (!await confirmSupport(ctx)) return { ok: false, code: status === "UNSUPPORTED" ? "UNSUPPORTED" : "STORAGE_UNAVAILABLE" }
    if (!await canonicalOwnership(ctx, parsed.data)) return { ok: false, code: "OWNERSHIP_STATE_CHANGED" }
    const id = await accountCalendarDecorationDocumentId(ctx.owner)
    let current = await ctx.buffer.read(ctx.owner, id)
    if (!ctx.current() || current?.blocked || current && JSON.stringify(current.draft.data) !== expectedSerialized) return { ok: false, code: "STALE_STATE" }
    const document: AccountCalendarDecorationDocument = { version: 3, state: "ACCOUNT_STATE", kind: "CALENDAR_DECORATIONS", data: parsed.data }
    let candidateSaved = false
    if (current?.pending?.rejection === "OWNERSHIP_STATE_CHANGED") {
      const rejected = current.pending
      if (JSON.stringify(parsed.data) !== JSON.stringify(rejected.draft.data)) {
        // Apply is explicit replacement intent. Keep the corrected current draft
        // alongside the still-fixed rejected operation even if the base read fails.
        await ctx.buffer.saveDraft(ctx.owner, id, document, current.localSequence)
        candidateSaved = true; current = await publish(ctx, id)
        if (!ctx.current() || !current || current.pending?.operationId !== rejected.operationId) return { ok: false, code: "STALE_STATE" }
        const remote = await requestAccountDocument(ctx.owner, { action: "read", documentId: id }, ctx.current, accountCalendarDecorationDocumentSchema)
        if (!ctx.current()) return { ok: false, code: "STALE_STATE" }
        let revision: number, remoteDocument: AccountCalendarDecorationDocument | null
        if (!remote.ok) {
          if (remote.code !== "NOT_FOUND" || rejected.expectedRevision !== 0) {
            setStatus(remote.code === "INVALID_RESPONSE" ? "UNSUPPORTED" : "FAILED")
            return { ok: false, code: remote.code === "INVALID_RESPONSE" ? "UNSUPPORTED" : "STORAGE_UNAVAILABLE" }
          }
          revision = 0; remoteDocument = null
        } else if (remote.data.kind === "document" || remote.data.kind === "deleted") {
          revision = remote.data.revision
          remoteDocument = remote.data.kind === "document" ? remote.data.document : null
          if (revision !== rejected.expectedRevision || remote.data.kind === "deleted") {
            if (revision <= rejected.expectedRevision) { setStatus("FAILED"); return { ok: false, code: "STORAGE_UNAVAILABLE" } }
            await ctx.buffer.conflict(ctx.owner, id, rejected.operationId, revision)
            if (!ctx.current()) return { ok: false, code: "STALE_STATE" }
            await ctx.buffer.captureConflict(ctx.owner, id, remoteDocument, revision, current.localSequence, ctx.current)
            if (ctx.current()) await publish(ctx, id)
            return { ok: false, code: "STALE_STATE" }
          }
        } else { setStatus("FAILED"); return { ok: false, code: "STORAGE_UNAVAILABLE" } }
        if (!ctx.buffer.replaceOwnershipRejectedDraft || !await ctx.buffer.replaceOwnershipRejectedDraft(ctx.owner, id,
          document, rejected.operationId, current.localSequence, revision, remoteDocument, crypto.randomUUID(), ctx.current)) {
          if (ctx.current()) await publish(ctx, id)
          return { ok: false, code: "STALE_STATE" }
        }
        current = await publish(ctx, id)
      } else {
        // An unchanged Apply retries the same immutable operation, including its UUID.
        if (!ctx.buffer.retryOwnershipChanged || !await ctx.buffer.retryOwnershipChanged(ctx.owner, id, rejected.operationId, ctx.current)) {
          return { ok: false, code: "OWNERSHIP_STATE_CHANGED" }
        }
        await flush(ctx, id); current = await publish(ctx, id)
        if (!ctx.current() || !current || current.blocked) return { ok: false, code: "STALE_STATE" }
        if (current.pending?.rejection) return { ok: false, code: "OWNERSHIP_STATE_CHANGED" }
        if (JSON.stringify(current.draft.data) === JSON.stringify(parsed.data)) {
          return { ok: true, storage: current.state === "DRAFT_ACKNOWLEDGED" ? "ACCOUNT" : "PENDING", state: structuredClone(parsed.data) }
        }
      }
      if (!ctx.current() || !current || current.blocked) return { ok: false, code: "STALE_STATE" }
      if (current.pending?.rejection) return { ok: false, code: "OWNERSHIP_STATE_CHANGED" }
    }
    if (!candidateSaved) await ctx.buffer.saveDraft(ctx.owner, id, document, current?.localSequence ?? 0)
    if (!ctx.current()) return fallback
    await publish(ctx, id)
    try { await flush(ctx, id) } catch { /* The encrypted immutable outbox remains recoverable. */ }
    const view = await publish(ctx, id)
    if (!ctx.current() || !view) return fallback
    if (view.blocked) return { ok: false, code: "STALE_STATE" }
    if (view.pending?.rejection) return { ok: false, code: view.pending.rejection === "OWNERSHIP_STATE_CHANGED" ? "OWNERSHIP_STATE_CHANGED" : "WRITE_FAILED" }
    return { ok: true, storage: view.state === "DRAFT_ACKNOWLEDGED" ? "ACCOUNT" : "PENDING", state: structuredClone(projection!) }
  }, fallback)
}

export type AccountCalendarDecorationConflict = {
  ownerId: string; localSequence: number; remoteRevision: number; local: CalendarDecorationState; remote: CalendarDecorationState | null
}
export async function loadAccountCalendarDecorationConflict(): Promise<AccountCalendarDecorationConflict | null> {
  const ctx = context(); if (!ctx) return null
  return serialize<AccountCalendarDecorationConflict | null>(ctx, async () => {
    const id = await accountCalendarDecorationDocumentId(ctx.owner), view = await ctx.buffer.read(ctx.owner, id)
    if (!ctx.current() || !view?.blocked) return null
    const response = await requestAccountDocument(ctx.owner, { action: "read", documentId: id }, ctx.current, accountCalendarDecorationDocumentSchema)
    if (!response.ok || !ctx.current() || (response.data.kind !== "document" && response.data.kind !== "deleted")) return null
    const remote = response.data.kind === "document" ? response.data.document : null
    await ctx.buffer.captureConflict(ctx.owner, id, remote, response.data.revision, view.localSequence, ctx.current)
    return ctx.current() ? { ownerId: ctx.owner, localSequence: view.localSequence, remoteRevision: response.data.revision,
      local: structuredClone(view.draft.data), remote: remote ? structuredClone(remote.data) : null } : null
  }, null)
}
export async function resolveAccountCalendarDecorationConflict(review: AccountCalendarDecorationConflict, choice: "LOCAL" | "REMOTE"): Promise<boolean> {
  const ctx = context(); if (!ctx || review.ownerId !== ctx.owner) return false
  return serialize(ctx, async () => {
    if (!await confirmSupport(ctx)) return false
    const id = await accountCalendarDecorationDocumentId(ctx.owner), view = await ctx.buffer.read(ctx.owner, id)
    if (!ctx.current() || !view?.blocked || view.localSequence !== review.localSequence
      || JSON.stringify(view.draft.data) !== JSON.stringify(review.local)) return false
    const response = await requestAccountDocument(ctx.owner, { action: "read", documentId: id }, ctx.current, accountCalendarDecorationDocumentSchema)
    if (!response.ok || !ctx.current() || (response.data.kind !== "document" && response.data.kind !== "deleted")) return false
    const remote = response.data.kind === "document" ? response.data.document : null
    if (response.data.revision !== review.remoteRevision || JSON.stringify(remote?.data ?? null) !== JSON.stringify(review.remote)) return false
    if (choice === "LOCAL" && (!remote || !await canonicalOwnership(ctx, view.draft.data))) return false
    await ctx.buffer.captureConflict(ctx.owner, id, remote, review.remoteRevision, review.localSequence, ctx.current)
    await ctx.buffer.resolveConflict(ctx.owner, id, remote ? choice : "DELETE", review.remoteRevision, review.localSequence, ctx.current)
    if (!ctx.current()) return false
    if (!remote) { projection = null; baseKnown = false; setStatus("DELETED"); return true }
    baseKnown = true
    if (choice === "LOCAL") await flush(ctx, id)
    const resolved = await publish(ctx, id)
    return !!resolved && !resolved.blocked && !resolved.pending?.rejection
  }, false)
}
export async function readAccountCalendarDecorationConflictArchive(ownerId: string) {
  const ctx = context(); if (!ctx || ownerId !== ctx.owner) return null
  return serialize(ctx, async () => {
    const records = await ctx.buffer.readConflictArchive(ownerId, await accountCalendarDecorationDocumentId(ownerId), ctx.current)
    return ctx.current() ? records : null
  }, null)
}
