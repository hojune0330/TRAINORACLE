import { accountJournalPreviewEnabled, requestAccountDocument } from "./account-journal-api"
import { ACCOUNT_NETWORK_DEADLINE_MS } from "./account-network-deadline"
import { activeLocalAccount, onLocalJournalScopeChange } from "./local-journal-ownership"
import { createAccountDocumentBuffer, type AccountJournalConflictBuffer } from "./account-journal-draft-buffer"
import { flushAccountJournalDraft } from "./account-journal-sync"
import {
  ACCOUNT_ATHLETE_RECORD_NAMESPACE, accountAthleteRecordDocumentSchema, accountAthleteRecordSchema,
  type AccountAthleteRecordDocument, type AccountAthleteRecordSnapshot,
} from "./account-athlete-record-schema"
import type { AthleteRecord } from "../athlete-records"

export const ACCOUNT_ATHLETE_RECORD_EVENT = "trainoracle:account-athlete-records-changed"
export type AccountAthleteRecordsStatus = "IDLE" | "AUTH_REQUIRED" | "LOADING" | "EMPTY" | "READY" | "PENDING" | "CONFLICT" | "DELETED" | "FAILED"
export type AccountAthleteRecordsState = {
  status: AccountAthleteRecordsStatus
  ownerId: string | null
  documentId: string | null
  serverRevision: number | null
  records: AthleteRecord[]
  confirmed: boolean
}
export type AddAccountAthleteRecordResult =
  | { ok: true; storage: "ACCOUNT" | "PENDING"; state: AccountAthleteRecordsState; snapshot: AccountAthleteRecordSnapshot | null }
  | { ok: false; code: "INVALID_RECORD" | "DUPLICATE_RECORD" | "STALE_REVISION" | "NOT_READY" | "CONFLICT" | "WRITE_FAILED" | "STALE_RESPONSE" }

let owner: string | null = null
let epoch = 0
let buffer: AccountJournalConflictBuffer<AccountAthleteRecordDocument> | null = null
let unsubscribe: (() => void) | null = null
let work: Promise<unknown> = Promise.resolve()
let scopeController: AbortController | null = null
const empty = (status: AccountAthleteRecordsStatus = "IDLE"): AccountAthleteRecordsState => ({
  status, ownerId: null, documentId: null, serverRevision: null, records: [], confirmed: false,
})
let state = empty()

export function accountAthleteRecordsEnabled(): boolean { return accountJournalPreviewEnabled() }
function publish(next: AccountAthleteRecordsState) {
  state = next
  if (typeof window !== "undefined") window.dispatchEvent(new Event(ACCOUNT_ATHLETE_RECORD_EVENT))
}
function status(next: AccountAthleteRecordsStatus) { publish({ ...state, status: next, confirmed: false }) }
export function readAccountAthleteRecordsState(): AccountAthleteRecordsState {
  if (!accountAthleteRecordsEnabled()) return empty()
  if (!activeLocalAccount()) return empty("AUTH_REQUIRED")
  return owner === activeLocalAccount() ? structuredClone(state) : empty()
}

export async function accountAthleteRecordDocumentId(ownerId: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(
    JSON.stringify([ACCOUNT_ATHLETE_RECORD_NAMESPACE, ownerId]))))
  bytes[6] = (bytes[6]! & 15) | 80; bytes[8] = (bytes[8]! & 63) | 128
  const hex = [...bytes.slice(0, 16)].map(value => value.toString(16).padStart(2, "0")).join("")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/** This is evidence for a server transaction guard, not an atomic plan-write check. */
export function getConfirmedAccountAthleteRecordSnapshot(recordId: string): AccountAthleteRecordSnapshot | null {
  const current = readAccountAthleteRecordsState()
  return current.status === "READY" && current.confirmed && current.documentId && current.serverRevision
    && current.records.some(record => record.id === recordId)
    ? { documentId: current.documentId, serverRevision: current.serverRevision, recordId } : null
}

export function disposeAccountAthleteRecords(): void {
  epoch += 1; scopeController?.abort(); scopeController = null
  buffer?.close(); buffer = null; owner = null
  unsubscribe?.(); unsubscribe = null; work = Promise.resolve(); publish(empty())
}
function context() {
  const user = activeLocalAccount()
  if (!user || !accountAthleteRecordsEnabled()) return null
  if (owner !== user || !buffer) {
    disposeAccountAthleteRecords(); owner = user
    scopeController = new AbortController()
    try { buffer = createAccountDocumentBuffer(accountAthleteRecordDocumentSchema, "trainoracle-account-athlete-records-v1") }
    catch { status("FAILED"); return null }
    unsubscribe = onLocalJournalScopeChange(disposeAccountAthleteRecords)
  }
  const generation = epoch
  return { owner: user, buffer, signal: scopeController!.signal,
    current: () => epoch === generation && activeLocalAccount() === user && accountAthleteRecordsEnabled() }
}
type Context = NonNullable<ReturnType<typeof context>>
function serialize<T>(ctx: Context, run: () => Promise<T>, fallback: () => T): Promise<T> {
  const next = work.catch(() => undefined).then(async () => {
    const guarded = () => ctx.current() ? run() : Promise.resolve(fallback())
    if (!ctx.current()) return fallback()
    if (!globalThis.navigator?.locks) return guarded()
    const acquisition = new AbortController()
    const cancel = () => acquisition.abort()
    ctx.signal.addEventListener("abort", cancel, { once: true })
    // A different tab may hold this lock indefinitely. Bound acquisition separately
    // from the request; aborting a signal does not release an already granted lock.
    const deadline = setTimeout(cancel, ACCOUNT_NETWORK_DEADLINE_MS)
    try {
      return await navigator.locks.request(`trainoracle-account-athlete-records:${ctx.owner}`,
        { mode: "exclusive", signal: acquisition.signal }, () => { clearTimeout(deadline); return guarded() })
    } finally {
      clearTimeout(deadline)
      ctx.signal.removeEventListener("abort", cancel)
    }
  }).catch(() => { if (ctx.current()) status("FAILED"); return fallback() })
  work = next; return next
}
const send = (ctx: Context, id: string) => requestAccountDocument(ctx.owner,
  { action: "read", documentId: id }, ctx.current, accountAthleteRecordDocumentSchema, undefined, { signal: ctx.signal })

async function hasSupport(ctx: Context): Promise<boolean> {
  const result = await requestAccountDocument(ctx.owner, { action: "athleteRecordSupport" }, ctx.current, accountAthleteRecordDocumentSchema,
    undefined, { signal: ctx.signal })
  if (!ctx.current()) return false
  if (result.ok && result.data.kind === "athlete-record-support" && result.data.version === 1) return true
  status(!result.ok && result.code === "AUTH_REQUIRED" ? "AUTH_REQUIRED" : "FAILED")
  return false
}

async function publishLocal(ctx: Context, id: string, acknowledged = false) {
  const local = await ctx.buffer.read(ctx.owner, id)
  if (!ctx.current() || !local) return null
  const nextStatus = local.resolvedDeletion ? "DELETED" : local.blocked ? "CONFLICT"
    : local.pending?.rejection ? "FAILED" : local.state === "DRAFT_ACKNOWLEDGED" && acknowledged ? "READY" : "PENDING"
  publish({ status: nextStatus, ownerId: ctx.owner, documentId: id, serverRevision: local.serverRevision,
    records: local.resolvedDeletion ? [] : structuredClone(local.draft.data.records), confirmed: nextStatus === "READY" })
  return local
}
async function flush(ctx: Context, id: string) {
  const result = await flushAccountJournalDraft(ctx.buffer, ctx.owner, id,
    request => requestAccountDocument(ctx.owner, request, ctx.current, accountAthleteRecordDocumentSchema, undefined, { signal: ctx.signal }), ctx.current)
  if (ctx.current()) await publishLocal(ctx, id, result === "SAVED")
  return result
}

/** Refresh from the account and replay only already consented, durable pending operations. */
export async function loadAccountAthleteRecords(): Promise<AccountAthleteRecordsState> {
  const ctx = context()
  if (!ctx) return readAccountAthleteRecordsState()
  return serialize(ctx, async () => {
    status("LOADING")
    if (!await hasSupport(ctx)) return readAccountAthleteRecordsState()
    const id = await accountAthleteRecordDocumentId(ctx.owner)
    if (!ctx.current()) return readAccountAthleteRecordsState()
    let local = await ctx.buffer.read(ctx.owner, id)
    if (!ctx.current()) return readAccountAthleteRecordsState()
    let remote = await send(ctx, id)
    if (!ctx.current()) return readAccountAthleteRecordsState()
    if (remote.ok && remote.data.kind === "deleted") {
      if (local && local.state !== "DRAFT_ACKNOWLEDGED" && !local.resolvedDeletion) {
        await ctx.buffer.captureConflict(ctx.owner, id, null, remote.data.revision, local.localSequence, ctx.current)
        if (ctx.current()) await publishLocal(ctx, id)
      } else {
        if (local && !local.resolvedDeletion) await ctx.buffer.acceptCleanDeletion(ctx.owner, id, remote.data.revision, local.localSequence)
        if (ctx.current()) publish({ ...empty("DELETED"), ownerId: ctx.owner, documentId: id, serverRevision: remote.data.revision })
      }
      return readAccountAthleteRecordsState()
    }
    if (!remote.ok && remote.code !== "NOT_FOUND") {
      if (local) await publishLocal(ctx, id)
      if (ctx.current()) status("FAILED")
      return readAccountAthleteRecordsState()
    }
    if (!remote.ok && remote.code === "NOT_FOUND" && (!local || local.serverRevision === 0 && !local.blocked)) {
      if (local) await flush(ctx, id)
      else publish({ ...empty("EMPTY"), ownerId: ctx.owner, documentId: id, serverRevision: 0 })
      return readAccountAthleteRecordsState()
    }
    if (!remote.ok || remote.data.kind !== "document") { status("FAILED"); return readAccountAthleteRecordsState() }
    if (local?.blocked) {
      await ctx.buffer.captureConflict(ctx.owner, id, remote.data.document, remote.data.revision, local.localSequence, ctx.current)
      if (ctx.current()) await publishLocal(ctx, id)
      return readAccountAthleteRecordsState()
    }
    if (local && !local.resolvedDeletion && local.state !== "DRAFT_ACKNOWLEDGED") {
      if (await flush(ctx, id) !== "SAVED" || !ctx.current()) return readAccountAthleteRecordsState()
      // A lost acknowledgement can advance the revision beyond the initial read.
      remote = await send(ctx, id)
      if (!ctx.current()) return readAccountAthleteRecordsState()
      if (!remote.ok || remote.data.kind !== "document") { status("FAILED"); return readAccountAthleteRecordsState() }
      local = await ctx.buffer.read(ctx.owner, id)
      if (!ctx.current()) return readAccountAthleteRecordsState()
    }
    if (local && (remote.data.revision < local.serverRevision
      || remote.data.revision === local.serverRevision && JSON.stringify(remote.data.document) !== JSON.stringify(local.draft))) {
      status("FAILED"); return readAccountAthleteRecordsState()
    }
    await ctx.buffer.importRemote(ctx.owner, id, remote.data.document, remote.data.revision)
    if (ctx.current()) await publishLocal(ctx, id, true)
    return readAccountAthleteRecordsState()
  }, readAccountAthleteRecordsState)
}
export const syncAccountAthleteRecords = loadAccountAthleteRecords

export async function addAccountAthleteRecord(candidate: unknown, expectedRevision: number): Promise<AddAccountAthleteRecordResult> {
  const parsed = accountAthleteRecordSchema.safeParse(candidate)
  if (!parsed.success) return { ok: false, code: "INVALID_RECORD" }
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || expectedRevision >= Number.MAX_SAFE_INTEGER - 1) {
    return { ok: false, code: "STALE_REVISION" }
  }
  const ctx = context()
  if (!ctx) return { ok: false, code: "NOT_READY" }
  return serialize<AddAccountAthleteRecordResult>(ctx, async () => {
    if (!["READY", "EMPTY"].includes(state.status) || !state.documentId) return { ok: false, code: "NOT_READY" }
    if (state.serverRevision !== expectedRevision) return { ok: false, code: "STALE_REVISION" }
    if (state.records.some(record => record.id === parsed.data.id)) return { ok: false, code: "DUPLICATE_RECORD" }
    if (!await hasSupport(ctx)) return { ok: false, code: ctx.current() ? "NOT_READY" : "STALE_RESPONSE" }
    const id = state.documentId, records = structuredClone(state.records)
    const local = await ctx.buffer.read(ctx.owner, id)
    if (!ctx.current()) return { ok: false, code: "STALE_RESPONSE" }
    if (local && (local.state !== "DRAFT_ACKNOWLEDGED" || local.serverRevision !== expectedRevision
      || JSON.stringify(local.draft.data.records) !== JSON.stringify(records)) || !local && expectedRevision !== 0) {
      status("CONFLICT"); return { ok: false, code: "STALE_REVISION" }
    }
    const document = accountAthleteRecordDocumentSchema.safeParse({ version: 3, state: "ACCOUNT_STATE",
      kind: "ATHLETE_RECORDS", data: { records: [...records, parsed.data] } })
    if (!document.success) return { ok: false, code: "INVALID_RECORD" }
    await ctx.buffer.saveDraft(ctx.owner, id, document.data, local?.localSequence ?? 0)
    if (!ctx.current()) return { ok: false, code: "STALE_RESPONSE" }
    await publishLocal(ctx, id)
    if (!ctx.current()) return { ok: false, code: "STALE_RESPONSE" }
    let result: Awaited<ReturnType<typeof flush>> = "PENDING"
    try { result = await flush(ctx, id) } catch { if (ctx.current()) await publishLocal(ctx, id) }
    if (!ctx.current()) return { ok: false, code: "STALE_RESPONSE" }
    if (result === "CONFLICT") return { ok: false, code: "CONFLICT" }
    if (result !== "SAVED" && result !== "PENDING") return { ok: false, code: "WRITE_FAILED" }
    const current = readAccountAthleteRecordsState()
    if (current.status === "FAILED") return { ok: false, code: "WRITE_FAILED" }
    return { ok: true, storage: current.confirmed ? "ACCOUNT" : "PENDING", state: current,
      snapshot: getConfirmedAccountAthleteRecordSnapshot(parsed.data.id) }
  }, () => ({ ok: false, code: ctx.current() ? "WRITE_FAILED" : "STALE_RESPONSE" }))
}
