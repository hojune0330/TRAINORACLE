import { z } from "zod"
import { createAccountPlanCollectionService, type AccountPlanCollectionService } from "./account-plan-collection-service"
import { accountJournalPreviewEnabled, requestAccountDocument } from "./account-journal-api"
import { createAccountDocumentBuffer, type AccountJournalDraftBuffer, type AccountJournalConflictBuffer } from "./account-journal-draft-buffer"
import { flushAccountJournalDraft, type DraftTransport } from "./account-journal-sync"
import { isAccountJournalWriteRejection } from "./account-write-rejection"
import { activeLocalAccount, onLocalJournalScopeChange } from "./local-journal-ownership"
import { RETAINED_ADJUSTED_PLAN_EVIDENCE } from "../adjusted-plan-storage-schema"
import { RETAINED_ADJUSTED_PLAN_EVIDENCE_V3 } from "../adjusted-plan-storage-v5-schema"
import { RETAINED_MULTI_ADJUSTED_EVIDENCE_V3 } from "../adjusted-plan-storage-v6-schema"
import { accountPlanEntry, accountPlanFingerprint, accountPlanCapacity, emptyAccountPlanDocument, materializeAccountPlan,
  validateAccountPlanDocument, validateAccountPlanDocumentUpdate, validateAccountPlanPacket,
  type AccountPlanDocument, type AccountPlanEntry, type AccountPlanPacket } from "./account-plan-document-schema"

const schema = z.custom<AccountPlanDocument>(validateAccountPlanDocument)
export const ACCOUNT_PLAN_EVENT = "trainoracle:account-plan-changed"
export type AccountPlanStatus = "IDLE" | "LOADING" | "EMPTY" | "READY" | "PENDING" | "CONFLICT" | "FAILED" | "AUTH_REQUIRED" | "INVALID" | "REJECTED"
export type AccountPlanTrust = () => readonly NonNullable<AccountPlanPacket["evidence"]>[]
const operatingEvidence: AccountPlanTrust = () => [...RETAINED_ADJUSTED_PLAN_EVIDENCE,
  ...RETAINED_ADJUSTED_PLAN_EVIDENCE_V3, ...RETAINED_MULTI_ADJUSTED_EVIDENCE_V3]

/** Only independent retained content is consulted; a transported hash is never approval. */
export function readAccountPlanEntry(entry: AccountPlanEntry, readTrusted: AccountPlanTrust = operatingEvidence) {
  const packet = materializeAccountPlan(entry)
  if (!validateAccountPlanPacket(packet)) return { kind: "invalid" as const, executionAuthority: "NONE" as const }
  try {
    if (packet.evidence !== null && readTrusted().filter(e => accountPlanFingerprint(e) === accountPlanFingerprint(packet.evidence)).length !== 1)
      return { kind: "evidence_required" as const, executionAuthority: "NONE" as const, packet: structuredClone(packet) }
  } catch { return { kind: "evidence_required" as const, executionAuthority: "NONE" as const, packet: structuredClone(packet) } }
  return { kind: "read_only" as const, executionAuthority: "NONE" as const,
    requiredNextGate: "FRESH_SAFETY_AND_EXECUTION_REVIEW" as const, packet: structuredClone(packet) }
}

export async function accountPlanDocumentId(ownerId: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(
    JSON.stringify(["trainoracle.account.plan.v1", ownerId]))))
  bytes[6] = (bytes[6]! & 15) | 80; bytes[8] = (bytes[8]! & 63) | 128
  const h = [...bytes.slice(0, 16)].map(v => v.toString(16).padStart(2, "0")).join("")
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

export type AccountPlanMutation =
  | { kind: "SAVE_HISTORY"; packet: AccountPlanPacket }
  | { kind: "SELECT"; packet: AccountPlanPacket; confirmsSelection: true; freshReview: () => boolean }
  | { kind: "PROGRESS"; packet: AccountPlanPacket }
  | { kind: "ARCHIVE"; planId: string }
export type AccountPlanResult = "ACCOUNT" | "PENDING" | "CONFLICT" | "STALE" | "FAILED" | "INVALID" | "REVIEW_REQUIRED" | "HISTORY_CONFLICT" | "CAPACITY" | "REJECTED"

export function createAccountPlanService(input: {
  ownerId: string; isCurrent: () => boolean; buffer?: AccountJournalDraftBuffer<AccountPlanDocument>;
  send?: DraftTransport<AccountPlanDocument>; readTrusted?: AccountPlanTrust; online?: () => boolean; changed?: () => void;
}) {
  let buffer: AccountJournalDraftBuffer<AccountPlanDocument>, unavailable = false
  try { buffer = input.buffer ?? createAccountDocumentBuffer(schema, "trainoracle-account-plans-v1") }
  catch {
    unavailable = true
    const fail = async (): Promise<never> => { throw Error("Account plan buffer unavailable") }
    buffer = { read: fail, list: fail, saveDraft: fail, queue: fail, ack: fail, conflict: fail,
      importRemote: fail, clear: fail, logout: () => {}, close: () => {} }
  }
  const trusted = input.readTrusted ?? operatingEvidence
  let closed = false, status: AccountPlanStatus = unavailable ? "FAILED" : "IDLE", confirmed: AccountPlanDocument | null = null
  let overlay: AccountPlanDocument | null = null, work: Promise<unknown> = Promise.resolve()
  const current = () => !closed && input.isCurrent()
  const send: DraftTransport<AccountPlanDocument> = input.send ?? (request => requestAccountDocument(input.ownerId, request, current, schema))
  const online = input.online ?? (() => globalThis.navigator?.onLine !== false)
  const change = (value: AccountPlanStatus) => { if (current()) { status = value; input.changed?.() } }
  const id = () => accountPlanDocumentId(input.ownerId)
  function serialize<T>(run: () => Promise<T>, fallback: T): Promise<T> {
    const next = work.catch(() => undefined).then(async () => {
      const execute = () => current() ? run() : Promise.resolve(fallback)
      return globalThis.navigator?.locks ? navigator.locks.request(`trainoracle-account-plan:${input.ownerId}`, { mode: "exclusive" }, execute) : execute()
    }).catch(() => { change("FAILED"); return fallback })
    work = next; return next
  }
  async function publish(documentId: string) {
    const view = await buffer.read(input.ownerId, documentId)
    if (!current() || !view) return null
    overlay = structuredClone(view.draft)
    if (view.state === "DRAFT_ACKNOWLEDGED") confirmed = structuredClone(view.draft)
    change(view.pending?.rejection ? "REJECTED" : view.blocked ? "CONFLICT" : view.state === "DRAFT_ACKNOWLEDGED" ? "READY" : "PENDING")
    return view
  }
  async function flush(documentId: string, review: () => boolean = () => false) {
    return flushAccountJournalDraft(buffer, input.ownerId, documentId, request =>
      current() && (request.action !== "save" || request.document.data.currentPlanId === null
        || request.document.data.currentPlanId === confirmed?.data.currentPlanId || online() && review())
        ? send(request) : Promise.resolve({ ok: false, code: "STALE_RESPONSE" }), current)
  }
  async function hydrate(): Promise<boolean> {
    change("LOADING")
    const documentId = await id(), local = await buffer.read(input.ownerId, documentId)
    if (!current()) return false
    const remote = await send({ action: "read", documentId })
    if (!current()) return false
    if (!remote.ok) {
      if (remote.code === "NOT_FOUND" && (!local || local.serverRevision === 0 && !local.blocked)) {
        confirmed = emptyAccountPlanDocument(); overlay = local?.draft ?? confirmed
        change(local?.pending?.rejection ? "REJECTED" : local ? "PENDING" : "EMPTY"); return !local?.pending?.rejection
      }
      if (local) overlay = structuredClone(local.draft)
      change(remote.code === "AUTH_REQUIRED" ? "AUTH_REQUIRED" : remote.code === "INVALID_RESPONSE" ? "INVALID" : "FAILED")
      return false
    }
    if (remote.data.kind !== "document" || remote.data.documentId !== documentId || !validateAccountPlanDocument(remote.data.document)) {
      change("INVALID"); return false
    }
    // Resolve a lost acknowledgement by replaying the exact operation before importing its revision.
    confirmed = structuredClone(remote.data.document)
    if (local?.pending?.rejection) { await publish(documentId); return false }
    if (local?.pending && !local.blocked) {
      await flush(documentId)
      if (!current()) return false
      const after = await buffer.read(input.ownerId, documentId)
      if (after?.serverRevision && after.serverRevision > remote.data.revision) {
        await publish(documentId); return after.state === "DRAFT_ACKNOWLEDGED"
      }
    }
    await buffer.importRemote(input.ownerId, documentId, remote.data.document, remote.data.revision)
    if (!current()) return false
    confirmed = structuredClone(remote.data.document)
    const view = await publish(documentId)
    return view?.state === "DRAFT_ACKNOWLEDGED"
  }
  function snapshot() {
    if (!current()) return { status: "IDLE" as AccountPlanStatus, document: null, fingerprint: null, currentPlan: null }
    const document = overlay ?? confirmed
    // Pending selection is not the account's current pointer until a matching server receipt.
    const selected = confirmed?.data.plans.find(p => p.planId === confirmed?.data.currentPlanId)
    return { status, document: document ? structuredClone(document) : null,
      confirmedDocument: confirmed ? structuredClone(confirmed) : null,
      fingerprint: document ? accountPlanFingerprint(document) : null,
      currentPlan: selected ? { planId: selected.planId, ...readAccountPlanEntry(selected, trusted) } : null }
  }
  function mutate(command: AccountPlanMutation, expectedFingerprint: string): Promise<AccountPlanResult> {
    if (!["SAVE_HISTORY", "SELECT", "PROGRESS", "ARCHIVE"].includes(command?.kind)
      || command.kind !== "ARCHIVE" && !validateAccountPlanPacket(command.packet)) return Promise.resolve("INVALID")
    // Capture data now; a caller's mutation during IDB/auth awaits cannot rewrite an operation.
    const captured = command.kind === "ARCHIVE" ? { ...command } : { ...command, packet: structuredClone(command.packet) }
    return serialize<AccountPlanResult>(async () => {
      if (!current()) return "STALE"
      if (status === "REJECTED") return "REJECTED"
      if (!overlay || status === "CONFLICT" || expectedFingerprint !== accountPlanFingerprint(overlay)) return "STALE"
      if (captured.kind === "SELECT" && (!online() || captured.confirmsSelection !== true || !captured.freshReview())) return "REVIEW_REQUIRED"
      if (captured.kind === "ARCHIVE" && captured.planId === overlay.data.currentPlanId && !online()) return "REVIEW_REQUIRED"
      const base = structuredClone(overlay), next = structuredClone(base), documentId = await id()
      const local = await buffer.read(input.ownerId, documentId)
      if (!current() || local?.blocked || local && accountPlanFingerprint(local.draft) !== expectedFingerprint) return "STALE"
      const at = new Date().toISOString()
      if (captured.kind === "ARCHIVE") {
        const entry = next.data.plans.find(p => p.planId === captured.planId)
        if (!entry || entry.archivedAt !== null) return "INVALID"
        entry.archivedAt = at
        if (next.data.currentPlanId === entry.planId) next.data.currentPlanId = null
      } else {
        if (!validateAccountPlanPacket(captured.packet)) return "INVALID"
        if (captured.packet.state.version === 2 && captured.kind !== "SAVE_HISTORY") return "REVIEW_REQUIRED"
        const entry = accountPlanEntry(captured.packet, at)
        const previous = next.data.plans.find(p => p.planId === entry.planId)
        if (previous?.archivedAt) return "INVALID"
        if (captured.kind === "PROGRESS") {
          if (!previous || next.data.currentPlanId !== entry.planId || confirmed?.data.currentPlanId !== entry.planId) return "STALE"
          previous.progress = entry.progress; previous.updatedAt = at
        } else {
          if (previous && accountPlanFingerprint(previous.progress) !== accountPlanFingerprint(entry.progress)) return "STALE"
          if (!previous) next.data.plans.push(entry)
          if (captured.kind === "SELECT") {
            if (readAccountPlanEntry(entry, trusted).kind !== "read_only") return "REVIEW_REQUIRED"
            const old = next.data.plans.find(p => p.planId === next.data.currentPlanId)
            if (old && old.planId !== entry.planId) old.archivedAt = at
            next.data.currentPlanId = entry.planId
          }
        }
      }
      if (accountPlanCapacity(next).exceeded) return "CAPACITY"
      if (!validateAccountPlanDocumentUpdate(base, next)) return "INVALID"
      const review = () => captured.kind !== "SELECT" || online() && captured.freshReview()
      if (!current() || !review()) return "REVIEW_REQUIRED"
      await buffer.saveDraft(input.ownerId, documentId, next, local?.localSequence ?? 0)
      if (!current()) return "STALE"
      await publish(documentId)
      // Capture an immutable operation even if the network is unavailable.
      const flushed = await flush(documentId, () => captured.kind === "SELECT" && review())
      const latest = await publish(documentId)
      if (!current()) return "STALE"
      if (isAccountJournalWriteRejection(flushed)) { change("REJECTED"); return "REJECTED" }
      return latest?.blocked ? "CONFLICT" : latest?.state === "DRAFT_ACKNOWLEDGED" ? "ACCOUNT" : "PENDING"
    }, "FAILED")
  }
  return {
    snapshot, mutate, hydrate: () => serialize(hydrate, false),
    importHistory: (packets: readonly AccountPlanPacket[], expectedFingerprint: string, stillCurrent: () => boolean): Promise<AccountPlanResult> => {
      if (!Array.isArray(packets) || !packets.length || packets.length > 100 || !packets.every(validateAccountPlanPacket)) return Promise.resolve("INVALID")
      const captured = structuredClone(packets)
      return serialize<AccountPlanResult>(async () => {
      if (!current() || !stillCurrent() || !overlay || !["EMPTY", "READY"].includes(status)
        || accountPlanFingerprint(overlay) !== expectedFingerprint) return "STALE"
      const next = structuredClone(overlay), at = new Date().toISOString(), documentId = await id()
      for (const packet of captured) {
        const entry = accountPlanEntry(packet, at)
        const existing = next.data.plans.find(p => p.planId === entry.planId)
        if (existing && accountPlanFingerprint(existing.progress) !== accountPlanFingerprint(entry.progress)) return "HISTORY_CONFLICT"
        if (!existing) next.data.plans.push({ ...entry, archivedAt: at })
      }
      if (accountPlanCapacity(next).exceeded) return "CAPACITY"
      if (!validateAccountPlanDocumentUpdate(overlay, next)) return "INVALID"
      const local = await buffer.read(input.ownerId, documentId)
      if (!current() || !stillCurrent() || local?.blocked || local && accountPlanFingerprint(local.draft) !== expectedFingerprint) return "STALE"
      await buffer.saveDraft(input.ownerId, documentId, next, local?.localSequence ?? 0)
      if (!current()) return "STALE"
      await publish(documentId)
      const flushed = await flush(documentId)
      const view = await publish(documentId)
      if (!current()) return "STALE"
      if (isAccountJournalWriteRejection(flushed)) { change("REJECTED"); return "REJECTED" }
      return view?.blocked ? "CONFLICT" : view?.state === "DRAFT_ACKNOWLEDGED" ? "ACCOUNT" : "PENDING"
    }, "FAILED")
    },
    useServerCurrent: (expectedFingerprint: string) => serialize<AccountPlanResult>(async () => {
      if (!("captureConflict" in buffer) || !("resolveConflict" in buffer)) return "FAILED"
      const conflicts = buffer as AccountJournalConflictBuffer<AccountPlanDocument>
      const documentId = await id(), local = await buffer.read(input.ownerId, documentId)
      if (!current() || !local?.blocked || accountPlanFingerprint(local.draft) !== expectedFingerprint) return "STALE"
      const remote = await send({ action: "read", documentId })
      if (!current() || !remote.ok || remote.data.kind !== "document"
        || remote.data.documentId !== documentId || !validateAccountPlanDocument(remote.data.document)) return "FAILED"
      await conflicts.captureConflict(input.ownerId, documentId, remote.data.document, remote.data.revision, local.localSequence, current)
      // REMOTE retains the losing local bytes in the encrypted conflict archive.
      // This accepts an authenticated pointer; it does not grant execution authority.
      await conflicts.resolveConflict(input.ownerId, documentId, "REMOTE", remote.data.revision, local.localSequence, current)
      if (!current()) return "STALE"
      const view = await publish(documentId)
      return view?.state === "DRAFT_ACKNOWLEDGED" ? "ACCOUNT" : "CONFLICT"
    }, "FAILED"),
    retry: (freshReview: () => boolean = () => false) => serialize<AccountPlanResult>(async () => {
      const documentId = await id()
      const result = await flush(documentId, freshReview)
      await publish(documentId)
      if (!current()) return "STALE"
      if (isAccountJournalWriteRejection(result)) { change("REJECTED"); return "REJECTED" }
      if (result === "SAVED") return "ACCOUNT"
      if (result === "STALE" || result === "CONFLICT" || result === "PENDING") return result
      change("FAILED")
      return "FAILED"
    }, "FAILED"),
    close() { closed = true; confirmed = null; overlay = null; buffer.close() },
  }
}

export type AccountPlanService = ReturnType<typeof createAccountPlanService> | AccountPlanCollectionService
let singleton: AccountPlanService | null = null, owner: string | null = null, unsubscribe: (() => void) | null = null
export function accountPlansEnabled() { return accountJournalPreviewEnabled() && activeLocalAccount() !== null }
export function disposeAccountPlans() {
  const changed = singleton !== null || owner !== null
  singleton?.close(); singleton = null; owner = null; unsubscribe?.(); unsubscribe = null
  if (changed && typeof window !== "undefined") window.dispatchEvent(new Event(ACCOUNT_PLAN_EVENT))
}
export function accountPlanService(): AccountPlanService | null {
  const user = activeLocalAccount()
  if (!user || !accountPlansEnabled()) { disposeAccountPlans(); return null }
  if (owner !== user || !singleton) {
    disposeAccountPlans(); owner = user
    singleton = createAccountPlanCollectionService({ ownerId: user, isCurrent: () => owner === user && activeLocalAccount() === user && accountPlansEnabled(),
      changed: () => window.dispatchEvent(new Event(ACCOUNT_PLAN_EVENT)) })
    unsubscribe = onLocalJournalScopeChange(disposeAccountPlans)
  }
  return singleton
}
