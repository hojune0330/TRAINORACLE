import { z } from "zod"
import { createAccountPlanCollectionClient, type AccountPlanCollectionClient } from "./account-plan-collection-api"
import { createAccountDocumentBuffer, type AccountJournalDraftBuffer, type AccountJournalDraftView } from "./account-journal-draft-buffer"
import type { DraftTransport } from "./account-journal-sync"
import { createAccountPlanCollectionBuffer, accountPlanCollectionYield, accountPlanLegacySourceFingerprint,
  type AccountPlanCollectionBuffer, type AccountPlanCollectionBufferDependencies } from "./account-plan-collection-buffer"
import { validateAccountPlanCollectionIndex, validateAccountPlanCollectionEntry, accountPlanCollectionPartHash, joinAccountPlanCollection, splitAccountPlanCollection,
  type AccountPlanCollectionIndex, type AccountPlanSnapshotPart, type AccountPlanProgressPart } from "./account-plan-collection-schema"
import { prepareAccountPlanCollectionTransfer, transferAccountPlanCollection,
  } from "./account-plan-collection-transfer"
import { accountPlanEntry, accountPlanFingerprint, emptyAccountPlanDocument, validateAccountPlanDocument,
  validateAccountPlanPacket, type AccountPlanDocument, type AccountPlanEntry, type AccountPlanPacket } from "./account-plan-document-schema"
import { readAccountPlanEntry, createAccountPlanService, accountPlanDocumentId, type AccountPlanService,
  type AccountPlanMutation, type AccountPlanResult,
  type AccountPlanStatus, type AccountPlanTrust } from "./account-plan-service"

export type AccountPlanCollectionLegacy = { documentId: string; revision: number; document: AccountPlanDocument }
export type { AccountPlanCollectionClient } from "./account-plan-collection-api"
export type AccountPlanCollectionServiceInput = {
  ownerId: string; isCurrent: () => boolean; client?: AccountPlanCollectionClient
  buffer?: AccountPlanCollectionBuffer; buffers?: AccountPlanCollectionBufferDependencies
  legacyBuffer?: AccountJournalDraftBuffer<AccountPlanDocument>; legacySend?: DraftTransport<AccountPlanDocument>
  readTrusted?: AccountPlanTrust; online?: () => boolean; changed?: () => void
  /** A monotonically changing authentication epoch also catches A -> B -> A between awaits. */
  epoch?: () => number; yieldTask?: () => Promise<void>; now?: () => string; operationId?: () => string
  /** Explicit lock port for isolated tests; production always uses owner-scoped Web Locks. */
  runExclusive?: <T>(run: () => Promise<T>) => Promise<T>
}

/** Confirmed projections only. Partial documents must never be interpreted as complete history. */
export function createAccountPlanCollectionService(input: AccountPlanCollectionServiceInput) {
  const openingEpoch = input.epoch?.() ?? 0
  let closed = false, invalidated = false, lockUnavailable = false, work: Promise<unknown> = Promise.resolve()
  const current = () => {
    if (closed || invalidated) return false
    if (!input.isCurrent() || (input.epoch?.() ?? 0) !== openingEpoch) invalidated = true
    return !invalidated
  }
  const check = () => { if (!current()) throw Error("STALE") }
  const client: AccountPlanCollectionClient = input.client ?? createAccountPlanCollectionClient(input.ownerId, current)
  const yieldTask = input.yieldTask ?? accountPlanCollectionYield
  const online = input.online ?? (() => globalThis.navigator?.onLine !== false)
  const now = input.now ?? (() => new Date().toISOString())
  let buffer: AccountPlanCollectionBuffer | null = null
  let status: AccountPlanStatus = "IDLE", confirmed: AccountPlanDocument | null = null
  let index: AccountPlanCollectionIndex | null = null, revision = 0, historyLoaded = false
  let legacy: AccountPlanCollectionLegacy | null = null
  let legacyBuffer: AccountJournalDraftBuffer<AccountPlanDocument> | null = null
  let legacyRuntime: AccountPlanService | null = null, legacyPending = false
  let legacyPreview: AccountJournalDraftView<AccountPlanDocument> | null = null, legacyHandoffRevision = 0
  let historyStatus: "IDLE" | "LOADING" | "READY" | "FAILED" = "IDLE"
  let historyWork: Promise<boolean> | null = null
  let historyEpoch = 0, historyCompleted = 0
  let historyController: AbortController | null = null
  let hydrationWork: Promise<boolean> | null = null
  try { buffer = input.buffer ?? createAccountPlanCollectionBuffer(input.ownerId, current, { ...input.buffers, yieldTask }) }
  catch { status = "FAILED" }
  try { legacyBuffer = input.legacyBuffer ?? createAccountDocumentBuffer(z.custom<AccountPlanDocument>(validateAccountPlanDocument), "trainoracle-account-plans-v1") }
  catch { status = "FAILED" }
  const local = () => { check(); if (!buffer) throw Error("FAILED"); return buffer }
  const change = (value: AccountPlanStatus) => { if (current()) { status = value; input.changed?.() } }
  function failure(error: unknown): AccountPlanResult {
    if (!current()) return "STALE"
    const code = typeof error === "object" && error !== null && "code" in error ? error.code
      : error instanceof Error ? error.message : "FAILED"
    if (code === "STALE") return "STALE"
    if (code === "CONFLICT") { change("CONFLICT"); return "CONFLICT" }
    if (code === "INVALID" || code === "INVALID_RESPONSE") { change("INVALID"); return "INVALID" }
    if (code === "AUTH_REQUIRED") { change("AUTH_REQUIRED"); return "FAILED" }
    if (code === "REJECTED" || code === "CAPACITY" || code === "CAPACITY_EXCEEDED") {
      change("REJECTED"); return code === "REJECTED" ? "REJECTED" : "CAPACITY"
    }
    change("FAILED"); return "FAILED"
  }
  function serialize<T>(run: () => Promise<T>, fallback: T, mapError?: (e: unknown) => T): Promise<T> {
    const next = work.catch(() => undefined).then(async () => {
      const execute = async () => { check(); return run() }
      if (input.runExclusive) return input.runExclusive(execute)
      if (typeof globalThis.navigator?.locks?.request !== "function") throw Error("BROWSER_UNSUPPORTED")
      let entered = false
      try {
        return await navigator.locks.request(`trainoracle-account-plan-collection:${input.ownerId}`, { mode: "exclusive" }, () => {
          entered = true; lockUnavailable = false; return execute()
        })
      } catch (error) { if (!entered) lockUnavailable = true; throw error }
    }).catch(error => { const result = mapError?.(error); if (!mapError) failure(error); return result ?? fallback })
    work = next; return next
  }
  function snapshot() {
    const visible = current() ? confirmed : null
    const entry = visible?.data.plans.find(p => p.planId === visible.data.currentPlanId)
    return { status: current() ? status : "IDLE" as AccountPlanStatus,
      browserSupported: !lockUnavailable && !!(input.runExclusive || typeof globalThis.navigator?.locks?.request === "function"),
      document: visible ? structuredClone(visible) : null, confirmedDocument: visible ? structuredClone(visible) : null,
      fingerprint: visible ? accountPlanFingerprint(visible) : null,
      currentPlan: entry ? { planId: entry.planId, ...readAccountPlanEntry(entry, input.readTrusted) } : null,
      historyLoaded: current() && historyLoaded, totalPlans: current() ? index?.plans.length ?? visible?.data.plans.length ?? 0 : 0,
      migrationRequired: current() && legacy !== null,
      legacyPending: current() && legacyPending,
      legacyPendingCount: current() && legacyPending ? legacyPreview?.draft.data.plans.length ?? 0 : 0,
      legacyPendingPlans: current() && legacyPending ? legacyPreview?.draft.data.plans.map(entry => ({
        planId: entry.planId, ...readAccountPlanEntry(entry, input.readTrusted),
      })) ?? [] : [],
      legacyPendingStatus: current() && legacyPending ? legacyPreview?.pending?.rejection ? "REJECTED" as const
        : legacyPreview?.blocked ? "CONFLICT" as const : "PENDING" as const : null,
      historyStatus: current() ? historyStatus : "IDLE" as typeof historyStatus,
      historyProgress: { loaded: current() ? historyLoaded ? index?.plans.length ?? visible?.data.plans.length ?? 0 : historyCompleted : 0,
        total: current() ? index?.plans.length ?? visible?.data.plans.length ?? 0 : 0 },
      capacity: { limit: 100, plans: current() ? index?.plans.length ?? visible?.data.plans.length ?? 0 : 0,
        exceeded: false, partByteLimit: 500_000, unit: "plans" as const } }
  }
  async function readIndex() {
    check()
    let remote: Awaited<ReturnType<AccountPlanCollectionClient["readIndex"]>>
    try { remote = await client.readIndex() }
    catch (e) { if (typeof e === "object" && e !== null && "code" in e && e.code === "NOT_FOUND") remote = null; else throw e }
    check()
    if (remote && (!Number.isSafeInteger(remote.revision) || remote.revision <= 0
      || !validateAccountPlanCollectionIndex(remote.index))) throw Error("INVALID")
    return remote ? structuredClone(remote) : null
  }
  async function readLegacy() {
    let old: AccountPlanCollectionLegacy | null
    try { old = await client.readLegacy() }
    catch (e) { if (typeof e === "object" && e !== null && "code" in e && e.code === "NOT_FOUND") old = null; else throw e }
    check()
    if (old && (!validateAccountPlanDocument(old.document) || !Number.isSafeInteger(old.revision)
      || old.revision <= 0 || !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/iu.test(old.documentId))) throw Error("INVALID")
    return old ? structuredClone(old) : null
  }
  async function inspectLegacyOutbox() {
    check()
    if (!legacyBuffer) throw Error("FAILED")
    const id = await accountPlanDocumentId(input.ownerId); check()
    const view = await legacyBuffer.read(input.ownerId, id); check()
    if (view && (view.ownerId !== input.ownerId || view.documentId !== id)) throw Error("INVALID")
    legacyPending = !!view && view.state !== "DRAFT_ACKNOWLEDGED"
    legacyPreview = legacyPending ? view : null; legacyHandoffRevision = 0
    if (legacyPending && view) {
      const handoff = await local().legacyHandoff(view); check()
      if (handoff) { legacyPending = false; legacyPreview = null; legacyHandoffRevision = handoff.collectionRevision }
    }
    return view
  }
  async function readEntry(target: AccountPlanCollectionIndex, planId: string, forceRemote = false, signal?: AbortSignal) {
    const entryCheck = () => { check(); if (signal?.aborted) throw Error("CANCELLED") }
    entryCheck()
    const ref = target.plans.find(p => p.planId === planId)
    if (!ref) return null
    let s: unknown = forceRemote ? null : await local().readPart("PLAN_SNAPSHOT", ref.snapshotId); entryCheck()
    if (!s) { s = await client.readPart(input.ownerId, "PLAN_SNAPSHOT", ref.snapshotId, signal); entryCheck() }
    let p: unknown = forceRemote ? null : await local().readPart("PLAN_PROGRESS", ref.progressId); entryCheck()
    if (!p) { p = await client.readPart(input.ownerId, "PLAN_PROGRESS", ref.progressId, signal); entryCheck() }
    const entry = validateAccountPlanCollectionEntry(target, s, p)
    if (!entry || entry.planId !== planId) throw Error("INVALID")
    await local().stage(s as AccountPlanSnapshotPart); entryCheck()
    await local().stage(p as AccountPlanProgressPart); entryCheck()
    return entry
  }
  function untilCancelled<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
    return new Promise((resolve, reject) => {
      const abort = () => reject(Error("CANCELLED"))
      if (signal.aborted) abort()
      else signal.addEventListener("abort", abort, { once: true })
      promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort))
    })
  }
  async function projection(target: AccountPlanCollectionIndex) {
    const document = emptyAccountPlanDocument()
    document.data.currentPlanId = target.currentPlanId
    if (target.currentPlanId) {
      const entry = await readEntry(target, target.currentPlanId, true); check()
      if (!entry) throw Error("INVALID")
      document.data.plans.push(entry)
    }
    return document
  }
  async function loadHistory(epoch = historyEpoch) {
    check()
    if (epoch !== historyEpoch) return false
    if (!confirmed) return false
    if (historyLoaded) return true
    if (!index) throw Error("INVALID")
    const controller = new AbortController()
    historyController = controller
    historyCompleted = 0; historyStatus = "LOADING"; change(status)
    const target = index, document = emptyAccountPlanDocument()
    document.data.currentPlanId = target.currentPlanId
    for (const ref of target.plans) {
      if (epoch !== historyEpoch) return false
      let entry: AccountPlanEntry | null
      try { entry = await untilCancelled(readEntry(target, ref.planId, false, controller.signal), controller.signal) }
      catch (error) { if (epoch !== historyEpoch) return false; throw error }
      check()
      if (epoch !== historyEpoch) return false
      if (!entry) throw Error("INVALID")
      document.data.plans.push(entry)
      historyCompleted = document.data.plans.length; change(status)
      await yieldTask(); check()
    }
    if (epoch !== historyEpoch) return false
    // readEntry validates each exact reference and its full logical entry. The index
    // enforces unique IDs/current membership; bind the ordered whole without rereading
    // and revalidating every immutable snapshot in one blocking final pass.
    if (accountPlanCollectionPartHash(document) !== target.documentFingerprint) throw Error("INVALID")
    confirmed = document; historyLoaded = true; historyStatus = "READY"; change(status)
    if (historyController === controller) historyController = null
    return true
  }
  async function flush(review: () => boolean = () => false, guard: () => boolean = () => true,
    allowedLegacySource?: string): Promise<AccountPlanResult> {
    const old = await inspectLegacyOutbox()
    if (legacyPending && (!old || accountPlanLegacySourceFingerprint(old) !== allowedLegacySource)) {
      change(old?.blocked ? "CONFLICT" : "PENDING"); return old?.blocked ? "CONFLICT" : "PENDING"
    }
    const pending = await local().pending(); check()
    if (!pending) return status === "CONFLICT" ? "CONFLICT" : confirmed ? "ACCOUNT" : "FAILED"
    if (!online()) { change("PENDING"); return "PENDING" }
    let transportError: unknown = null
    const attempt = async <T>(run: () => Promise<T>): Promise<T> => {
      try { return await run() } catch (error) { transportError = error; throw error }
    }
    const result = await transferAccountPlanCollection({ transfer: pending, port: {
      receipt: (owner, op) => attempt(() => client.receipt(owner, op)),
      readPart: (owner, kind, id) => attempt(() => client.readPart(owner, kind, id)),
      stage: (owner, part) => attempt(() => client.stage(owner, part)),
      commit: request => attempt(() => client.commit(request)),
    },
      scope: () => current() && guard() ? { ownerId: input.ownerId, epoch: openingEpoch } : null,
      freshSelectionReview: () => {
        const selected = pending.next.index.currentPlanId
        const doc = joinAccountPlanCollection(pending.next), entry = doc?.data.plans.find(p => p.planId === selected)
        return online() && !!entry && readAccountPlanEntry(entry, input.readTrusted).kind === "read_only" && review() === true
      } })
    check()
    if (result.kind === "committed") {
      if (revision === result.receipt.revision && index
        && accountPlanFingerprint(index) !== accountPlanFingerprint(pending.next.index)) throw Error("INVALID")
      if (!await local().ack(pending.operationId, result.receipt.revision)) throw Error("CONFLICT")
      check()
      if (revision > result.receipt.revision) {
        // An old receipt settles that operation, not a newer index already observed by this device.
        if (!index || !confirmed) throw Error("INVALID")
        await local().observe(index, revision); check()
        change(index.plans.length ? "READY" : "EMPTY")
        return "ACCOUNT"
      }
      const document = joinAccountPlanCollection(pending.next)
      if (!document) throw Error("INVALID")
      confirmed = document; index = pending.next.index; revision = result.receipt.revision
      historyLoaded = true; historyStatus = "READY"; legacy = null; change(document.data.plans.length ? "READY" : "EMPTY")
      return "ACCOUNT"
    }
    if (result.kind === "conflict") {
      const remote = await readIndex()
      if (remote) await local().observe(remote.index, remote.revision)
      check(); change("CONFLICT"); return "CONFLICT"
    }
    if (result.kind === "invalid") { change("INVALID"); return "INVALID" }
    if (result.kind === "stale") return "STALE"
    if (pending.legacy && typeof transportError === "object" && transportError !== null
      && "code" in transportError && transportError.code === "REJECTED") {
      // The migration gateway can reject a changed legacy source before a collection exists.
      change("CONFLICT"); return "CONFLICT"
    }
    if (typeof transportError === "object" && transportError !== null && "code" in transportError
      && ["AUTH_REQUIRED", "INVALID", "REJECTED", "STALE"].includes(String(transportError.code))) return failure(transportError)
    change("PENDING"); return "PENDING"
  }
  async function hydrate() {
    change("LOADING")
    const oldOutbox = await inspectLegacyOutbox()
    const remote = await readIndex()
    if (legacyHandoffRevision > (remote?.revision ?? 0)) throw Error("INVALID")
    if (legacyPending) {
      if (remote) {
        const document = await projection(remote.index); check()
        if (remote.revision < revision) throw Error("INVALID")
        confirmed = document; index = remote.index; revision = remote.revision; historyLoaded = false; historyStatus = "IDLE"
        legacy = null
      } else {
        legacy = await readLegacy(); check()
        confirmed = legacy ? structuredClone(legacy.document) : null
        index = null; revision = 0; historyLoaded = !!legacy; historyStatus = legacy ? "READY" : "IDLE"
      }
      change(oldOutbox?.pending?.rejection ? "REJECTED" : oldOutbox?.blocked ? "CONFLICT" : "PENDING")
      return false
    }
    if (!remote) {
      const previous = await local().read(); check()
      if (revision > 0 || (previous?.serverRevision ?? 0) > 0) throw Error("INVALID")
      const old = await readLegacy()
      legacy = old ? structuredClone(old) : null
      confirmed = old ? structuredClone(old.document) : emptyAccountPlanDocument()
      index = null; revision = 0; historyLoaded = true; historyStatus = "READY"
    } else {
      const document = await projection(remote.index); check()
      if (remote.revision < revision) throw Error("INVALID")
      confirmed = document; index = remote.index; revision = remote.revision; legacy = null
      // Even when there is only one plan, this is explicitly a current-only read.
      historyLoaded = false; historyStatus = "IDLE"
    }
    const view = await local().read(); check()
    if (view && view.state !== "DRAFT_ACKNOWLEDGED") {
      if (view.blocked) { change("CONFLICT"); return false }
      // Recover an existing matching receipt, never silently authorize an unsent selection.
      const result = await flush()
      if (result === "ACCOUNT") return true
      if (remote && result === "PENDING") {
        const observed = await local().observe(remote.index, remote.revision); check()
        if (observed === "CONFLICT") change("CONFLICT")
      }
      return false
    }
    if (remote) await local().observe(remote.index, remote.revision)
    check(); change(confirmed.data.plans.length || index?.plans.length ? "READY" : "EMPTY")
    return true
  }
  async function writable(expectedFingerprint: string, stillCurrent: () => boolean = () => true) {
    check()
    await inspectLegacyOutbox(); check()
    if (legacyPending) { change("PENDING"); return null }
    if (!stillCurrent() || !confirmed || legacy || !["READY", "EMPTY"].includes(status)
      || snapshot().fingerprint !== expectedFingerprint) return null
    const view = await local().read(); check()
    if (view && (view.state !== "DRAFT_ACKNOWLEDGED" || view.serverRevision !== revision
      || index && accountPlanFingerprint(view.draft.next) !== accountPlanFingerprint(index))) {
      change(view.blocked ? "CONFLICT" : "PENDING"); return null
    }
    if (!await loadHistory()) return null
    check(); if (!stillCurrent()) return null
    return { base: structuredClone(confirmed!), sequence: view?.localSequence ?? 0 }
  }
  async function save(base: AccountPlanDocument, next: AccountPlanDocument, sequence: number,
    review: () => boolean = () => false, migration?: AccountPlanCollectionLegacy,
    guard: () => boolean = () => true, allowedLegacySource?: string): Promise<AccountPlanResult> {
    if (next.data.plans.length > 100) return "CAPACITY"
    await yieldTask(); check()
    if (!guard()) return "STALE"
    const transfer = prepareAccountPlanCollectionTransfer({ ownerId: input.ownerId,
      operationId: input.operationId?.() ?? crypto.randomUUID(), expectedRevision: revision,
      previous: index ? base : null, next, ...(migration ? { legacy: migration } : {}) })
    if (!transfer) return "INVALID"
    await local().save(transfer, sequence); check(); change("PENDING")
    if (!guard()) return "STALE"
    return flush(review, guard, allowedLegacySource)
  }
  async function completeLegacyHandoff(source: AccountJournalDraftView<AccountPlanDocument>, choice: "SERVER" | "HISTORY") {
    const latest = await inspectLegacyOutbox(); check()
    if (!latest || accountPlanLegacySourceFingerprint(latest) !== accountPlanLegacySourceFingerprint(source) || !index || revision < 1) return "STALE" as const
    await local().preserveLegacy(source, choice, index, revision); check()
    await inspectLegacyOutbox(); check()
    if (legacyPending) return "STALE" as const
    return await hydrate() ? "ACCOUNT" as const : "FAILED" as const
  }
  async function preserveLegacyHistory(source: AccountJournalDraftView<AccountPlanDocument>): Promise<AccountPlanResult> {
    const sourceFingerprint = accountPlanLegacySourceFingerprint(source)
    let view = await local().read(); check()
    if (view && view.state !== "DRAFT_ACKNOWLEDGED") {
      if (view.blocked) return "CONFLICT"
      const result = await flush(() => false, () => true, sourceFingerprint)
      if (result !== "ACCOUNT") return result
    }
    const remote = await readIndex()
    if (remote) {
      confirmed = await projection(remote.index); check()
      index = remote.index; revision = remote.revision; historyLoaded = false; legacy = null
      await local().observe(index, revision); check()
      if (!await loadHistory()) return "FAILED"
    } else {
      if (revision > 0) return "INVALID"
      const old = await readLegacy()
      confirmed = old ? structuredClone(old.document) : emptyAccountPlanDocument()
      index = null; revision = 0; historyLoaded = true; legacy = old
      if (old) {
        view = await local().read(); check()
        const result = await save(old.document, old.document, view?.localSequence ?? 0, () => false, old, () => true, sourceFingerprint)
        if (result !== "ACCOUNT") return result
      }
    }
    const base = structuredClone(confirmed!), next = structuredClone(base), at = now()
    for (const entry of source.draft.data.plans) {
      const existing = next.data.plans.find(p => p.planId === entry.planId)
      if (existing && accountPlanFingerprint(existing.progress) !== accountPlanFingerprint(entry.progress)) return "HISTORY_CONFLICT"
      if (!existing) next.data.plans.push({ ...structuredClone(entry), archivedAt: entry.archivedAt ?? at })
      await yieldTask(); check()
    }
    view = await local().read(); check()
    if (!index || accountPlanFingerprint(base) !== accountPlanFingerprint(next)) {
      const result = await save(base, next, view?.localSequence ?? 0, () => false, undefined, () => true, sourceFingerprint)
      if (result !== "ACCOUNT") return result
    }
    return completeLegacyHandoff(source, "HISTORY")
  }
  function mutate(command: AccountPlanMutation, expectedFingerprint: string): Promise<AccountPlanResult> {
    if (!["SAVE_HISTORY", "SELECT", "PROGRESS", "ARCHIVE"].includes(command?.kind)
      || command.kind !== "ARCHIVE" && !validateAccountPlanPacket(command.packet)) return Promise.resolve("INVALID")
    const captured = command.kind === "ARCHIVE" ? { ...command } : { ...command, packet: structuredClone(command.packet) }
    return serialize(async () => {
      const ready = await writable(expectedFingerprint)
      if (!ready) return "STALE"
      const { base, sequence } = ready, next = structuredClone(base), at = now()
      if (captured.kind === "ARCHIVE") {
        if (captured.planId === base.data.currentPlanId && !online()) return "REVIEW_REQUIRED"
        const entry = next.data.plans.find(p => p.planId === captured.planId)
        if (!entry || entry.archivedAt !== null) return "INVALID"
        entry.archivedAt = at
        if (next.data.currentPlanId === entry.planId) next.data.currentPlanId = null
      } else {
        if (captured.packet.state.version === 2 && captured.kind !== "SAVE_HISTORY") return "REVIEW_REQUIRED"
        const entry = accountPlanEntry(captured.packet, at), previous = next.data.plans.find(p => p.planId === entry.planId)
        if (previous?.archivedAt) return "INVALID"
        if (captured.kind === "PROGRESS") {
          if (!previous || next.data.currentPlanId !== entry.planId) return "STALE"
          previous.progress = entry.progress; previous.updatedAt = at
        } else {
          if (previous && accountPlanFingerprint(previous.progress) !== accountPlanFingerprint(entry.progress)) return "STALE"
          if (!previous) next.data.plans.push(entry)
          if (captured.kind === "SELECT") {
            if (captured.confirmsSelection !== true || !online() || !captured.freshReview()
              || readAccountPlanEntry(entry, input.readTrusted).kind !== "read_only") return "REVIEW_REQUIRED"
            const old = next.data.plans.find(p => p.planId === next.data.currentPlanId)
            if (old && old.planId !== entry.planId) old.archivedAt = at
            next.data.currentPlanId = entry.planId
          }
        }
      }
      check()
      return save(base, next, sequence, () => captured.kind === "SELECT" && captured.freshReview())
    }, "FAILED", failure)
  }
  return {
    snapshot, mutate,
    hydrate: (): Promise<boolean> => {
      if (!hydrationWork) hydrationWork = serialize(hydrate, false).finally(() => { hydrationWork = null })
      return hydrationWork
    },
    loadHistory: (): Promise<boolean> => {
      if (!historyWork) {
        const epoch = historyEpoch
        const pending = serialize(() => loadHistory(epoch), false, () => {
          if (current() && epoch === historyEpoch) { historyStatus = "FAILED"; change(status) }
          return false
        }).finally(() => { if (historyWork === pending) historyWork = null })
        historyWork = pending
      }
      return historyWork
    },
    cancelHistory() {
      if (!current() || historyLoaded) return
      historyEpoch++; historyWork = null; historyCompleted = 0; historyStatus = "IDLE"; change(status)
      historyController?.abort(); historyController = null
    },
    loadPlan: (planId: string): Promise<AccountPlanEntry | null> => serialize(async () => {
      if (!confirmed) return null
      if (historyLoaded) return structuredClone(confirmed.data.plans.find(p => p.planId === planId) ?? null)
      if (!index) return null
      const entry = await readEntry(index, planId); check()
      // History queries never mutate the current-only document or imply full history is loaded.
      return entry ? structuredClone(entry) : null
    }, null),
    retry: (freshReview: () => boolean = () => false) => serialize(() => flush(freshReview), "FAILED" as AccountPlanResult, failure),
    migrateLegacy: (): Promise<AccountPlanResult> => serialize(async () => {
      await inspectLegacyOutbox(); check()
      if (legacyPending) { change("PENDING"); return "PENDING" }
      if (!legacy || !confirmed || !["READY", "EMPTY"].includes(status)) return "STALE"
      const captured = structuredClone(legacy), view = await local().read(); check()
      if (view && view.state !== "DRAFT_ACKNOWLEDGED") return "STALE"
      return save(captured.document, captured.document, view?.localSequence ?? 0, () => false, captured)
    }, "FAILED", failure),
    recoverLegacyPending: (freshReview: () => boolean = () => false, choice?: "SERVER" | "HISTORY"): Promise<AccountPlanResult> => serialize(async () => {
      const source = await inspectLegacyOutbox(); check()
      if (!legacyPending) return await hydrate() ? "ACCOUNT" : "FAILED"
      if (!source) return "FAILED"
      if (choice === "HISTORY") return preserveLegacyHistory(structuredClone(source))
      // Another device may have migrated first. Never write through the retired monolithic path.
      const remote = await readIndex()
      if (remote) {
        if (choice !== "SERVER") { change("CONFLICT"); return "CONFLICT" }
        const document = await projection(remote.index); check()
        const localView = await local().read(); check()
        if (localView && localView.state !== "DRAFT_ACKNOWLEDGED") {
          await local().observe(remote.index, remote.revision, true); check()
          await local().useRemote(remote.index, remote.revision, localView.localSequence); check()
        } else await local().observe(remote.index, remote.revision)
        check(); confirmed = document; index = remote.index; revision = remote.revision; historyLoaded = false; legacy = null
        return completeLegacyHandoff(source, "SERVER")
      }
      check()
      legacyRuntime ??= createAccountPlanService({ ownerId: input.ownerId, isCurrent: current, buffer: legacyBuffer!,
        send: input.legacySend, online, readTrusted: input.readTrusted })
      await legacyRuntime.hydrate(); check()
      let view = await inspectLegacyOutbox(); check()
      if (view?.blocked) {
        if (choice !== "SERVER") { change("CONFLICT"); return "CONFLICT" }
        const fingerprint = legacyRuntime.snapshot().fingerprint
        if (!fingerprint) return "FAILED"
        const resolved = await legacyRuntime.useServerCurrent(fingerprint); check()
        if (resolved !== "ACCOUNT") { change("CONFLICT"); return resolved }
      } else if (legacyPending) {
        const result = await legacyRuntime.retry(freshReview); check()
        if (result !== "ACCOUNT") {
          change(result === "CONFLICT" ? "CONFLICT" : result === "REJECTED" ? "REJECTED" : "PENDING")
          return result
        }
      }
      view = await inspectLegacyOutbox(); check()
      if (legacyPending || view && view.state !== "DRAFT_ACKNOWLEDGED") return "PENDING"
      return await hydrate() ? "ACCOUNT" : "FAILED"
    }, "FAILED", failure),
    importHistory(packets: readonly AccountPlanPacket[], expectedFingerprint: string, stillCurrent: () => boolean): Promise<AccountPlanResult> {
      if (!Array.isArray(packets) || !packets.length || packets.length > 100 || !packets.every(validateAccountPlanPacket)) return Promise.resolve("INVALID")
      const captured = structuredClone(packets)
      return serialize(async () => {
        const ready = await writable(expectedFingerprint, stillCurrent)
        if (!ready) return "STALE"
        const next = structuredClone(ready.base), at = now()
        for (const packet of captured) {
          const entry = accountPlanEntry(packet, at), existing = next.data.plans.find(p => p.planId === entry.planId)
          if (existing && accountPlanFingerprint(existing.progress) !== accountPlanFingerprint(entry.progress)) return "HISTORY_CONFLICT"
          if (!existing) next.data.plans.push({ ...entry, archivedAt: at })
          await yieldTask(); check(); if (!stillCurrent()) return "STALE"
        }
        return save(ready.base, next, ready.sequence, () => false, undefined, stillCurrent)
      }, "FAILED", failure)
    },
    useServerCurrent: (expectedFingerprint: string): Promise<AccountPlanResult> => serialize(async () => {
      if (!["CONFLICT", "REJECTED"].includes(status) || snapshot().fingerprint !== expectedFingerprint) return "STALE"
      const view = await local().read(); check()
      if (!view || view.state === "DRAFT_ACKNOWLEDGED") return "STALE"
      const remote = await readIndex()
      if (!remote) {
        if (revision > 0) return "INVALID"
        const refreshed = await readLegacy(), document = refreshed?.document ?? emptyAccountPlanDocument()
        const parts = splitAccountPlanCollection(document)
        for (const part of [...parts.snapshots, ...parts.progress]) {
          await local().stage(part); await yieldTask(); check()
        }
        await local().observe(parts.index, 0, true); check()
        await local().useRemote(parts.index, 0, view.localSequence); check()
        // This is an authenticated legacy view, not a silently completed collection migration.
        confirmed = structuredClone(document); index = null; revision = 0; legacy = refreshed
        historyLoaded = true; historyStatus = "READY"; change(document.data.plans.length ? "READY" : "EMPTY")
        return "ACCOUNT"
      }
      const document = await projection(remote.index); check()
      if (!view.blocked) await local().observe(remote.index, remote.revision, true)
      await local().useRemote(remote.index, remote.revision, view.localSequence); check()
      confirmed = document; index = remote.index; revision = remote.revision; historyLoaded = false; historyStatus = "IDLE"; legacy = null
      change(index.plans.length ? "READY" : "EMPTY"); return "ACCOUNT"
    }, "FAILED", failure),
    close() {
      historyEpoch++; historyWork = null; historyCompleted = 0
      historyController?.abort(); historyController = null
      closed = true; confirmed = null; index = null; legacy = null; historyLoaded = false; legacyPending = false; legacyPreview = null
      buffer?.close(); if (legacyRuntime) legacyRuntime.close(); else legacyBuffer?.close()
    },
  }
}
export type AccountPlanCollectionService = ReturnType<typeof createAccountPlanCollectionService>
