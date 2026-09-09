import { requestAccountDocument } from "./account-journal-api"
import { activeLocalAccount, onLocalJournalScopeChange } from "./local-journal-ownership"
import { createAccountDocumentBuffer, type AccountJournalConflictBuffer } from "./account-journal-draft-buffer"
import { flushAccountJournalDraft } from "./account-journal-sync"
import { accountDecorationDocumentSchema, validateAccountDecorationDocument, type AccountDecorationDocument } from "./account-decoration-schema"
import { createEmptyDecorationState, type DecorationState } from "../decoration-schema"
import { decorationCatalogItem, isPaidDecorationId } from "../decoration-catalog"
import { hydrateAccountRewards, accountRewardsEnabled } from "./account-reward-service"
import { clearJournalDecorationSessionClipboard } from "../journal-decoration-clipboard"
import { isAccountJournalWriteRejection, type AccountJournalWriteRejection } from "./account-write-rejection"

export type AccountDecorationStatus = "IDLE" | "AUTH_REQUIRED" | "LOADING" | "EMPTY" | "READY" | "PENDING" | "CONFLICT" | "DELETED" | "FAILED"
export const ACCOUNT_DECORATION_EVENT = "trainoracle:account-decorations-changed"
let owner: string | null = null
let epoch = 0
let buffer: AccountJournalConflictBuffer<AccountDecorationDocument> | null = null
let projection: DecorationState | null = null
let confirmed: DecorationState | null = null
let status: AccountDecorationStatus = "IDLE"
let baseKnown = false
let work: Promise<unknown> = Promise.resolve()
let unsubscribe: (() => void) | null = null
let hydration: Promise<boolean> | null = null

export function accountDecorationsEnabled() { return accountRewardsEnabled() }
function notify() { if (typeof window !== "undefined") window.dispatchEvent(new Event(ACCOUNT_DECORATION_EVENT)) }
function setStatus(next: AccountDecorationStatus) { status = next; notify() }
export function accountDecorationStatus(): AccountDecorationStatus {
  if (!accountDecorationsEnabled()) return "IDLE"
  if (!activeLocalAccount()) return "AUTH_REQUIRED"
  return owner === activeLocalAccount() ? status : "IDLE"
}
export function readAccountDecorationState(): DecorationState | null {
  return accountDecorationsEnabled() && owner !== null && owner === activeLocalAccount() && projection ? structuredClone(projection) : null
}
export async function accountDecorationDocumentId(ownerId: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(
    JSON.stringify(["trainoracle.account.decorations.v1", ownerId]))))
  bytes[6] = (bytes[6]! & 15) | 80; bytes[8] = (bytes[8]! & 63) | 128
  const h = [...bytes.slice(0, 16)].map(value => value.toString(16).padStart(2, "0")).join("")
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}
export function disposeAccountDecorations() {
  clearJournalDecorationSessionClipboard()
  epoch += 1; buffer?.close(); buffer = null; owner = null; projection = null; confirmed = null; hydration = null
  baseKnown = false; work = Promise.resolve(); unsubscribe?.(); unsubscribe = null; setStatus("IDLE")
}
function context() {
  const user = activeLocalAccount()
  if (!user || !accountDecorationsEnabled()) return null
  if (owner !== user || !buffer) {
    disposeAccountDecorations(); owner = user
    try { buffer = createAccountDocumentBuffer(accountDecorationDocumentSchema, "trainoracle-account-decorations-v1") }
    catch { setStatus("FAILED"); return null }
    unsubscribe = onLocalJournalScopeChange(disposeAccountDecorations)
    setStatus("LOADING")
  }
  const generation = epoch
  return { owner: user, buffer, current: () => epoch === generation && activeLocalAccount() === user && accountDecorationsEnabled() }
}
type Context = NonNullable<ReturnType<typeof context>>
function serialize<T>(ctx: Context, fn: () => Promise<T>, fallback: T): Promise<T> {
  const next = work.catch(() => undefined).then(async () => {
    const run = () => ctx.current() ? fn() : Promise.resolve(fallback)
    return globalThis.navigator?.locks ? navigator.locks.request(`trainoracle-account-decorations:${ctx.owner}`, run) : run()
  }).catch(() => { if (ctx.current()) setStatus("FAILED"); return fallback })
  work = next; return next
}
async function publish(ctx: Context, id: string) {
  const view = await ctx.buffer.read(ctx.owner, id)
  if (!ctx.current() || !view) return null
  if (view.resolvedDeletion) { projection = null; confirmed = null; baseKnown = false; setStatus("DELETED"); return view }
  if (view.state === "DRAFT_ACKNOWLEDGED") confirmed = structuredClone(view.draft.data)
  // Pending purchase/migration data is durable but is not proof of ownership.
  const trusted = confirmed ?? createEmptyDecorationState()
  projection = structuredClone(sameCommerce(view.draft.data, trusted) ? view.draft.data : trusted)
  setStatus(view.blocked ? "CONFLICT" : view.pending?.rejection ? "FAILED" : view.state === "DRAFT_ACKNOWLEDGED" ? "READY" : "PENDING")
  return view
}
function sameCommerce(left: DecorationState, right: DecorationState) {
  return left.spentPoints === right.spentPoints && left.pointMeaning === right.pointMeaning
    && JSON.stringify([...left.ownedItemIds].sort()) === JSON.stringify([...right.ownedItemIds].sort())
}
async function flush(ctx: Context, id: string) {
  return flushAccountJournalDraft(ctx.buffer, ctx.owner, id,
    request => requestAccountDocument(ctx.owner, request, ctx.current, accountDecorationDocumentSchema), ctx.current)
}

export async function hydrateAccountDecorations(): Promise<boolean> {
  const ctx = context(); if (!ctx) return false
  if (hydration) return hydration
  const run = serialize(ctx, async () => {
    setStatus("LOADING")
    const id = await accountDecorationDocumentId(ctx.owner)
    let local = await ctx.buffer.read(ctx.owner, id)
    if (!ctx.current()) return false
    if (local) await publish(ctx, id)
    const remote = await requestAccountDocument(ctx.owner, { action: "read", documentId: id }, ctx.current, accountDecorationDocumentSchema)
    if (!ctx.current()) return false
    if (!remote.ok) {
      if (remote.code === "NOT_FOUND" && !local) {
        baseKnown = true; confirmed = createEmptyDecorationState(); projection = structuredClone(confirmed); setStatus("EMPTY"); return true
      }
      if (remote.code === "NOT_FOUND" && local?.serverRevision === 0 && !local.blocked) {
        baseKnown = true; confirmed = createEmptyDecorationState()
        await flush(ctx, id)
        return (await publish(ctx, id))?.state === "DRAFT_ACKNOWLEDGED"
      }
      setStatus("FAILED")
      return false
    }
    if (remote.data.kind === "deleted") {
      const revision = remote.data.revision
      if (local?.resolvedDeletion === revision || !local) {
        projection = null; confirmed = null; baseKnown = false; setStatus("DELETED"); return true
      }
      if (revision <= local.serverRevision) throw new Error("Stale decoration deletion")
      if (local.state === "DRAFT_ACKNOWLEDGED") {
        await ctx.buffer.acceptCleanDeletion(ctx.owner, id, revision, local.localSequence)
        if (!ctx.current()) return false
        projection = null; confirmed = null; baseKnown = false; setStatus("DELETED"); return true
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
      projection = null; confirmed = null; baseKnown = false; setStatus("CONFLICT"); return false
    }
    if (remote.data.kind !== "document") { setStatus("FAILED"); return false }
    if (local && remote.data.revision < local.serverRevision) throw new Error("Stale decoration revision")
    confirmed = structuredClone(remote.data.document.data); baseKnown = true
    // Inspect tombstones first, but replay fixed operations before importing a live
    // snapshot, so a lost acknowledgement does not create a false conflict.
    if (local && !local.blocked && !local.resolvedDeletion && local.state !== "DRAFT_ACKNOWLEDGED") {
      await flush(ctx, id); local = await publish(ctx, id)
    }
    if (!local || remote.data.revision >= local.serverRevision) await ctx.buffer.importRemote(ctx.owner, id, remote.data.document, remote.data.revision)
    if (!ctx.current()) return false
    baseKnown = true
    const view = await publish(ctx, id)
    return view?.state === "DRAFT_ACKNOWLEDGED"
  }, false)
  hydration = run
  try { return await run } finally { if (hydration === run) hydration = null }
}

export type AccountDecorationSaveResult =
  | { ok: true; storage: "ACCOUNT" | "PENDING"; state: DecorationState }
  | { ok: false; code: "INVALID_STATE" | "STORAGE_UNAVAILABLE" | "STALE_STATE" | "WRITE_FAILED"; rejection?: AccountJournalWriteRejection }
export async function persistAccountDecorations(candidate: unknown, expectedSerialized: string | null): Promise<AccountDecorationSaveResult> {
  const fallback = { ok: false as const, code: "WRITE_FAILED" as const }
  const ctx = context(); if (!ctx) return { ok: false, code: "STORAGE_UNAVAILABLE" }
  const input = { version: 3, state: "ACCOUNT_STATE", kind: "DECORATIONS", data: candidate }
  if (!validateAccountDecorationDocument(input)) return { ok: false, code: "INVALID_STATE" }
  const document = accountDecorationDocumentSchema.parse(input)
  return serialize<AccountDecorationSaveResult>(ctx, async () => {
    if (!baseKnown || !projection || !confirmed || !["READY", "EMPTY", "PENDING"].includes(status)) return { ok: false, code: "STORAGE_UNAVAILABLE" }
    if (!sameCommerce(document.data, confirmed)) return { ok: false, code: "INVALID_STATE" }
    if (expectedSerialized !== JSON.stringify(projection)) return { ok: false, code: "STALE_STATE" }
    const id = await accountDecorationDocumentId(ctx.owner)
    const current = await ctx.buffer.read(ctx.owner, id)
    if (!ctx.current() || current?.blocked) return { ok: false, code: "STALE_STATE" }
    if (current && JSON.stringify(current.draft.data) !== expectedSerialized) return { ok: false, code: "STALE_STATE" }
    await ctx.buffer.saveDraft(ctx.owner, id, document, current?.localSequence ?? 0)
    if (!ctx.current()) return fallback
    await publish(ctx, id)
    try { await flush(ctx, id) } catch { /* The encrypted pending version remains recoverable. */ }
    const view = await publish(ctx, id)
    if (!ctx.current() || !view) return fallback
    if (view.blocked) return { ok: false, code: "STALE_STATE" }
    if (view.pending?.rejection) return { ok: false, code: "WRITE_FAILED", rejection: view.pending.rejection }
    return { ok: true, storage: view.state === "DRAFT_ACKNOWLEDGED" ? "ACCOUNT" : "PENDING", state: structuredClone(projection!) }
  }, fallback)
}

export type AccountDecorationConflict = {
  ownerId: string; localSequence: number; remoteRevision: number;
  local: DecorationState; remote: DecorationState | null;
}

export async function purchaseAccountDecoration(itemId: string, expectedSerialized: string | null): Promise<
  { ok: true; storage: "ACCOUNT" | "PENDING"; state: DecorationState; remainingPoints: number }
  | { ok: false; code: "UNAVAILABLE" | "INSUFFICIENT_POINTS" | "STALE_STATE" }> {
  const fallback = { ok: false as const, code: "UNAVAILABLE" as const }
  const ctx = context(), item = decorationCatalogItem(itemId)
  if (!ctx || !item || !isPaidDecorationId(itemId)) return fallback
  return serialize(ctx, async () => {
    if (!confirmed || !projection || !baseKnown || !["READY", "EMPTY"].includes(status)
      || JSON.stringify(projection) !== expectedSerialized) return { ok: false as const, code: "STALE_STATE" as const }
    const id = await accountDecorationDocumentId(ctx.owner), local = await ctx.buffer.read(ctx.owner, id)
    if (!ctx.current() || local && (local.state !== "DRAFT_ACKNOWLEDGED" || JSON.stringify(local.draft.data) !== expectedSerialized)) return fallback
    const credit = await hydrateAccountRewards()
    if (!ctx.current() || !credit.ok || credit.summary.ownerId !== ctx.owner) return fallback
    const recordedSpent = credit.summary.spentPoints + (credit.summary.legacySpentPoints ?? 0)
    if (!Number.isSafeInteger(recordedSpent) || recordedSpent !== confirmed.spentPoints) return fallback
    if (confirmed.ownedItemIds.includes(itemId)) return { ok: true as const, storage: "ACCOUNT" as const,
      state: structuredClone(confirmed), remainingPoints: credit.summary.availablePoints }
    if (credit.summary.availablePoints < item.cost) return { ok: false as const, code: "INSUFFICIENT_POINTS" as const }
    const document = accountDecorationDocumentSchema.parse({ version: 3, state: "ACCOUNT_STATE", kind: "DECORATIONS",
      data: { ...projection, spentPoints: confirmed.spentPoints + item.cost, ownedItemIds: [...confirmed.ownedItemIds, itemId] } })
    // Purchase uses the same fixed save operation. Catalog metadata and credits
    // are validated atomically by the gateway; this client cannot award credits.
    await ctx.buffer.saveDraft(ctx.owner, id, document, local?.localSequence ?? 0)
    if (!ctx.current()) return fallback
    await publish(ctx, id)
    const result = await flush(ctx, id)
    const view = await publish(ctx, id)
    if (!ctx.current() || !view || view.blocked) return fallback
    if (isAccountJournalWriteRejection(result)) return { ok: false as const,
      code: result === "INSUFFICIENT_POINTS" ? "INSUFFICIENT_POINTS" as const : "UNAVAILABLE" as const }
    const saved = view.state === "DRAFT_ACKNOWLEDGED"
    if (saved) await hydrateAccountRewards()
    if (!ctx.current()) return fallback
    return { ok: true as const, storage: saved ? "ACCOUNT" as const : "PENDING" as const,
      state: structuredClone(projection!), remainingPoints: saved ? credit.summary.availablePoints - item.cost : credit.summary.availablePoints }
  }, fallback)
}
export async function loadAccountDecorationConflict(): Promise<AccountDecorationConflict | null> {
  const ctx = context(); if (!ctx) return null
  return serialize<AccountDecorationConflict | null>(ctx, async () => {
    const id = await accountDecorationDocumentId(ctx.owner), view = await ctx.buffer.read(ctx.owner, id)
    if (!view?.blocked || !ctx.current()) return null
    const response = await requestAccountDocument(ctx.owner, { action: "read", documentId: id }, ctx.current, accountDecorationDocumentSchema)
    if (!response.ok || !ctx.current() || (response.data.kind !== "document" && response.data.kind !== "deleted")) return null
    const remote = response.data.kind === "document" ? response.data.document : null
    await ctx.buffer.captureConflict(ctx.owner, id, remote, response.data.revision, view.localSequence, ctx.current)
    if (!ctx.current()) return null
    return { ownerId: ctx.owner, localSequence: view.localSequence, remoteRevision: response.data.revision,
      local: structuredClone(view.draft.data), remote: remote ? structuredClone(remote.data) : null }
  }, null)
}
export async function resolveAccountDecorationConflict(review: AccountDecorationConflict, choice: "LOCAL" | "REMOTE"): Promise<boolean> {
  const ctx = context(); if (!ctx || review.ownerId !== ctx.owner) return false
  return serialize(ctx, async () => {
    const id = await accountDecorationDocumentId(ctx.owner), view = await ctx.buffer.read(ctx.owner, id)
    if (!ctx.current() || !view?.blocked || view.localSequence !== review.localSequence
      || JSON.stringify(view.draft.data) !== JSON.stringify(review.local)) return false
    const response = await requestAccountDocument(ctx.owner, { action: "read", documentId: id }, ctx.current, accountDecorationDocumentSchema)
    if (!response.ok || !ctx.current() || (response.data.kind !== "document" && response.data.kind !== "deleted")) return false
    const remote = response.data.kind === "document" ? response.data.document : null
    if (response.data.revision !== review.remoteRevision || JSON.stringify(remote?.data ?? null) !== JSON.stringify(review.remote)) return false
    if (!remote && choice === "LOCAL") return false
    if (remote && choice === "LOCAL" && !sameCommerce(view.draft.data, remote.data)) return false
    await ctx.buffer.captureConflict(ctx.owner, id, remote, review.remoteRevision, review.localSequence, ctx.current)
    await ctx.buffer.resolveConflict(ctx.owner, id, remote ? choice : "DELETE", review.remoteRevision, review.localSequence, ctx.current)
    if (!ctx.current()) return false
    if (!remote) { projection = null; confirmed = null; baseKnown = false; setStatus("DELETED"); return true }
    confirmed = structuredClone(remote.data); baseKnown = true
    if (choice === "LOCAL") await flush(ctx, id)
    const resolved = await publish(ctx, id)
    return !!resolved && !resolved.blocked
  }, false)
}

export async function readAccountDecorationConflictArchive(ownerId: string) {
  const ctx = context(); if (!ctx || ctx.owner !== ownerId) return null
  return serialize(ctx, async () => {
    const id = await accountDecorationDocumentId(ownerId)
    const records = await ctx.buffer.readConflictArchive(ownerId, id, ctx.current)
    return ctx.current() ? records : null
  }, null)
}

export async function reviewAccountDecorationMigration() {
  const ctx = context(); if (!ctx) return null
  return serialize(ctx, async () => {
    const { readAccountScopedDecorationSource } = await import("../decoration-store")
    const source = readAccountScopedDecorationSource(ctx.owner)
    if (!ctx.current() || !source) return null
    return { ...source, expectedSerialized: projection ? JSON.stringify(projection) : null,
      current: projection ? structuredClone(projection) : null }
  }, null)
}

export async function migrateAccountDecorations(review: NonNullable<Awaited<ReturnType<typeof reviewAccountDecorationMigration>>>) {
  const ctx = context(); if (!ctx || review.ownerId !== ctx.owner || !review.state) return false
  return serialize(ctx, async () => {
    const { readAccountScopedDecorationSource } = await import("../decoration-store")
    const source = readAccountScopedDecorationSource(ctx.owner)
    if (!source?.state || source.raw !== review.raw || source.sourceKey !== review.sourceKey
      || !ctx.current() || !baseKnown || !confirmed || !projection
      || JSON.stringify(projection) !== review.expectedSerialized) return false
    const id = await accountDecorationDocumentId(ctx.owner)
    const local = await ctx.buffer.read(ctx.owner, id)
    if (local && local.state !== "DRAFT_ACKNOWLEDGED") return false
    if (local && JSON.stringify(local.draft.data) !== review.expectedSerialized) return false
    // Only a first document may preserve unverified legacy ownership. The server
    // enforces the one-time, pre-cutover account and 30-day eligibility window.
    if (local ? !sameCommerce(source.state, confirmed)
      : source.state.ownedItemIds.filter(isPaidDecorationId).length > 128) return false
    const remote = await requestAccountDocument(ctx.owner, { action: "read", documentId: id }, ctx.current, accountDecorationDocumentSchema)
    if (!ctx.current()) return false
    if (remote.ok ? remote.data.kind !== "document" || remote.data.revision !== local?.serverRevision
      || JSON.stringify(remote.data.document.data) !== review.expectedSerialized : remote.code !== "NOT_FOUND" || local !== null) return false
    // The original scoped source is intentionally retained. Existing account
    // revisions are retained by the server; migration is never a points grant.
    await ctx.buffer.saveDraft(ctx.owner, id, { version: 3, state: "ACCOUNT_STATE", kind: "DECORATIONS", data: source.state },
      local?.localSequence ?? 0, local ? undefined : "MIGRATION")
    if (!ctx.current()) return false
    await flush(ctx, id)
    const view = await publish(ctx, id)
    if (ctx.current() && view?.state === "DRAFT_ACKNOWLEDGED") await hydrateAccountRewards()
    return !!view && ctx.current() && view.state === "DRAFT_ACKNOWLEDGED"
  }, false)
}
