import { createAccountDocumentBuffer, type AccountJournalConflictBuffer } from "./account-journal-draft-buffer"
import { requestAccountDocument, accountJournalPreviewEnabled, type AccountJournalRequest, type AccountJournalResult } from "./account-journal-api"
import { flushAccountJournalDraft } from "./account-journal-sync"
import { activeLocalAccount, localJournalScopeGeneration } from "./local-journal-ownership"
import { accountDeletionBoundaryState } from "./account-deletion-boundary"
import { accountGoalProgramDocumentSchema, accountGoalProgramDocumentId, accountGoalProgramFingerprint as hash,
  accountGoalProgramReferences, emptyAccountGoalProgramIndex, joinAccountGoalProgramCollection,
  splitAccountGoalProgramCollection, validateAccountGoalProgramDocument, validateAccountGoalProgramDocumentUpdate, validateAccountGoalProgramCollectionUpdate,
  ACCOUNT_GOAL_PROGRAM_BUFFER, type AccountGoalProgramCollection, type AccountGoalProgramDocument as Document,
  type AccountGoalProgramIndex } from "./account-goal-program-schema"
import type { GoalTrainingProgramHistory, StoredGoalTrainingProgram } from "../goal-training-program-document"

export type AccountGoalProgramStatus = "LOADING" | "EMPTY" | "READY" | "PENDING" | "CONFLICT" | "FAILED" | "AUTH_REQUIRED" | "UNSUPPORTED" | "UPGRADE_REQUIRED"
export type AccountGoalProgramSnapshot = {
  ownerId: string; sessionGeneration: number
  status: AccountGoalProgramStatus; revision: number; sequence: number; historyLoaded: boolean
  document: StoredGoalTrainingProgram | null; history: GoalTrainingProgramHistory
  pendingDocument: StoredGoalTrainingProgram | null; remoteRevision: number | null
}
export type AccountGoalProgramPorts = {
  buffer: AccountJournalConflictBuffer<Document>
  send: (request: AccountJournalRequest<Document>, current: () => boolean) => Promise<AccountJournalResult<Document>>
  isOwner: () => boolean
  exclusive: <T>(work: () => Promise<T>) => Promise<T>
}
export const accountGoalProgramEditToken = (state: AccountGoalProgramSnapshot) => hash([state.ownerId, state.sessionGeneration, state.revision, state.sequence, state.document, state.history])
/** Immutable originals/progress are staged and reread before the singleton index CAS. */
export function createAccountGoalProgramService(ownerId: string, changed: () => void, ports?: AccountGoalProgramPorts) {
  const buffer = ports?.buffer ?? createAccountDocumentBuffer(accountGoalProgramDocumentSchema, ACCOUNT_GOAL_PROGRAM_BUFFER)
  let active = true, work: Promise<unknown> = Promise.resolve()
  const generation = localJournalScopeGeneration()
  let confirmed: AccountGoalProgramIndex | null = null
  let state: AccountGoalProgramSnapshot = { ownerId, sessionGeneration: generation, status: "LOADING", revision: 0, sequence: 0, historyLoaded: false,
    document: null, history: { version: 1, entries: [] }, pendingDocument: null, remoteRevision: null }
  const current = () => active && (ports?.isOwner() ?? (activeLocalAccount() === ownerId
    && localJournalScopeGeneration() === generation && accountJournalPreviewEnabled()))
    && accountDeletionBoundaryState(ownerId) === "OPEN"
  const send = (request: AccountJournalRequest<Document>) => ports ? ports.send(request, current)
    : requestAccountDocument(ownerId, request, current, accountGoalProgramDocumentSchema)
  const publish = (patch: Partial<AccountGoalProgramSnapshot>) => { if (current()) { state = { ...state, ...patch }; changed() } }
  const failure = (result: Extract<AccountJournalResult<Document>, { ok: false }>) => {
    publish({ status: result.code === "AUTH_REQUIRED" ? "AUTH_REQUIRED" : result.code === "GOAL_PROGRAM_UNSUPPORTED" ? "UNSUPPORTED"
      : result.code === "UPGRADE_REQUIRED" || result.code === "INVALID_RESPONSE" ? "UPGRADE_REQUIRED" : "FAILED" })
  }
  const serialize = <T>(run: (id: string) => Promise<T>, fallback: T): Promise<T> => {
    const next = work.catch(() => undefined).then(async () => {
      if (!current()) return fallback
      const locked = async () => {
        const id = await accountGoalProgramDocumentId(ownerId)
        return current() ? run(id) : fallback
      }
      if (ports) return ports.exclusive(locked)
      if (!globalThis.navigator?.locks) throw Error("Goal program lock unavailable")
      return navigator.locks.request(`trainoracle-account-goal-program:${ownerId}`, { mode: "exclusive" }, locked)
    }).catch(() => { publish({ status: "FAILED" }); return fallback })
    work = next; return next
  }
  async function support() {
    const response = await send({ action: "goalProgramSupport" })
    if (!current()) return false
    if (!response.ok) { failure(response); return false }
    if (response.data.kind !== "goal-program-support" || response.data.version !== 1) { publish({ status: "UNSUPPORTED" }); return false }
    return true
  }
  async function readParts(index: AccountGoalProgramIndex, local: boolean, history = true) {
    const references = history ? accountGoalProgramReferences(index) : index.data.current ? [index.data.current] : []
    const parts: Document[] = [], seen = new Set<string>()
    for (const reference of references) for (const [kind, partId] of [["GOAL_PROGRAM_BODY", reference.bodyId], ["GOAL_PROGRAM_PROGRESS", reference.progressId]] as const) {
      if (seen.has(partId)) continue
      seen.add(partId)
      const documentId = await accountGoalProgramDocumentId(ownerId, kind, partId)
      if (!current()) return null
      let document: Document | null = null
      if (local) document = (await buffer.read(ownerId, documentId))?.draft ?? null
      else {
        const response = await send({ action: "read", documentId })
        if (!current()) return null
        if (!response.ok) { failure(response); return null }
        if (response.data.kind !== "document" || response.data.revision !== 1) { publish({ status: "FAILED" }); return null }
        document = response.data.document
      }
      if (!current() || !document || !validateAccountGoalProgramDocument(document) || document.kind !== kind
        || document.data.id !== partId) return null
      parts.push(document)
    }
    const subset = history ? index : { ...index, data: { ...index.data, history: [] } }
    const joined = joinAccountGoalProgramCollection(subset, parts)
    return joined ? { parts, joined } : null
  }
  async function flush(id: string) {
    const local = await buffer.read(ownerId, id)
    if (!current() || !local || local.draft.kind !== "GOAL_PROGRAM_INDEX" || local.blocked) return false
    const intended = await readParts(local.draft, true)
    if (!current() || !intended) { publish({ status: "FAILED" }); return false }
    for (const part of intended.parts) {
      if (part.kind === "GOAL_PROGRAM_INDEX") throw Error("Unexpected index part")
      const partId = await accountGoalProgramDocumentId(ownerId, part.kind, part.data.id)
      if (!current()) return false
      let result = await flushAccountJournalDraft(buffer, ownerId, partId, send, current)
      if (!current()) return false
      if (result === "CONFLICT") {
        const existing = await send({ action: "read", documentId: partId })
        if (!current()) return false
        const staged = await buffer.read(ownerId, partId)
        if (existing.ok && existing.data.kind === "document" && existing.data.revision === 1
          && hash(existing.data.document) === hash(part) && staged?.blocked) {
          await buffer.captureConflict(ownerId, partId, existing.data.document, 1, staged.localSequence, current)
          if (!current()) return false
          await buffer.resolveConflict(ownerId, partId, "REMOTE", 1, staged.localSequence, current)
          result = "SAVED"
        }
      }
      if (result !== "SAVED") { publish({ status: result === "CONFLICT" ? "CONFLICT" : "PENDING", pendingDocument: intended.joined.document }); return false }
    }
    // Matching receipts do not replace verification of the referenced stored bytes.
    const verified = await readParts(local.draft, false)
    if (!current() || !verified || hash(verified.joined) !== hash(intended.joined)) return false
    const result = await flushAccountJournalDraft(buffer, ownerId, id, send, current)
    if (!current()) return false
    const after = await buffer.read(ownerId, id)
    if (!current()) return false
    publish({ sequence: after?.localSequence ?? state.sequence,
      status: result === "SAVED" ? "LOADING" : result === "CONFLICT" ? "CONFLICT" : "PENDING",
      pendingDocument: result === "SAVED" ? null : intended.joined.document })
    return result === "SAVED"
  }
  async function hydrateInside(id: string, history = false, replay = true): Promise<boolean> {
    publish({ status: "LOADING" })
    if (!await support()) return false
    const response = await send({ action: "read", documentId: id })
    if (!current()) return false
    const local = await buffer.read(ownerId, id)
    if (!current()) return false
    if (!response.ok && response.code !== "NOT_FOUND") { failure(response); return false }
    let remote = !response.ok ? emptyAccountGoalProgramIndex() : response.data.kind === "document" ? response.data.document : null
    const remoteRevision = response.ok && response.data.kind === "document" ? response.data.revision : 0
    if (!remote || !validateAccountGoalProgramDocument(remote) || remote.kind !== "GOAL_PROGRAM_INDEX") { publish({ status: "UPGRADE_REQUIRED" }); return false }
    if (remoteRevision < (local?.serverRevision ?? 0)) { publish({ status: "FAILED" }); return false }
    const remoteParts = await readParts(remote, false, history)
    if (!current() || !remoteParts) { publish({ status: "FAILED" }); return false }
    confirmed = remote
    publish({ document: remoteParts.joined.document, history: remoteParts.joined.history, revision: remoteRevision, historyLoaded: history,
      sequence: local?.localSequence ?? 0 })
    if (local && local.state !== "DRAFT_ACKNOWLEDGED") {
      const pending = local.draft.kind === "GOAL_PROGRAM_INDEX" ? await readParts(local.draft, true) : null
      if (!current() || !pending) { publish({ status: "FAILED" }); return false }
      if (local.blocked) {
        await buffer.captureConflict(ownerId, id, response.ok ? remote : null, remoteRevision, local.localSequence, current)
        publish({ status: "CONFLICT", pendingDocument: pending.joined.document, remoteRevision }); return false
      }
      if (replay) { await flush(id); return current() && hydrateInside(id, history, false) }
      publish({ status: "PENDING", pendingDocument: pending.joined.document }); return false
    }
    if (local && local.serverRevision === remoteRevision && hash(local.draft) !== hash(remote)) { publish({ status: "FAILED" }); return false }
    for (const part of remoteParts.parts) {
      if (part.kind === "GOAL_PROGRAM_INDEX") throw Error("Unexpected part")
      const partId = await accountGoalProgramDocumentId(ownerId, part.kind, part.data.id)
      if (!current()) return false
      await buffer.importRemote(ownerId, partId, part, 1)
    }
    if (remoteRevision > 0) await buffer.importRemote(ownerId, id, remote, remoteRevision)
    if (!current()) return false
    const imported = await buffer.read(ownerId, id)
    publish({ status: remote.data.current ? "READY" : "EMPTY", sequence: imported?.localSequence ?? 0,
      pendingDocument: null, remoteRevision: null })
    return true
  }
  const save = (document: StoredGoalTrainingProgram, history: GoalTrainingProgramHistory, token: string, fresh = () => true) => {
    let collection: AccountGoalProgramCollection
    try { collection = splitAccountGoalProgramCollection(structuredClone(document), structuredClone(history)) } catch { return Promise.resolve(false) }
    return serialize(async id => {
      if (!fresh() || !["READY", "EMPTY"].includes(state.status) || token !== accountGoalProgramEditToken(state)
        || !state.historyLoaded || !confirmed || !validateAccountGoalProgramDocumentUpdate(confirmed, collection.index)) return false
      if (!await support() || !current() || !fresh()) return false
      const priorParts = await readParts(confirmed, true)
      if (!current() || !fresh() || !priorParts || !validateAccountGoalProgramCollectionUpdate(confirmed, priorParts.parts, collection.index, collection.parts)) return false
      const local = await buffer.read(ownerId, id)
      if (!current() || (local?.localSequence ?? 0) !== state.sequence || (local?.serverRevision ?? 0) !== state.revision
        || local && local.state !== "DRAFT_ACKNOWLEDGED") { publish({ status: "CONFLICT" }); return false }
      const entries: { documentId: string; draft: Document; expectedLocalSequence: number }[] = []
      for (const part of collection.parts) {
        const documentId = await accountGoalProgramDocumentId(ownerId, part.kind, part.data.id)
        const before = await buffer.read(ownerId, documentId)
        if (!current() || !fresh()) return false
        if (before) { if (hash(before.draft) !== hash(part) || before.blocked || before.resolvedDeletion) return false }
        else entries.push({ documentId, draft: part, expectedLocalSequence: 0 })
      }
      entries.push({ documentId: id, draft: collection.index, expectedLocalSequence: state.sequence })
      if (!buffer.saveDraftBatch) { publish({ status: "FAILED" }); return false }
      await buffer.saveDraftBatch(ownerId, entries, () => current() && fresh())
      if (!current()) return false
      const savedLocal = await buffer.read(ownerId, id)
      publish({ status: "PENDING", pendingDocument: document, sequence: savedLocal?.localSequence ?? state.sequence })
      if (!fresh()) return false
      const saved = await flush(id)
      if (!current()) return false
      const ready = await hydrateInside(id, true, false)
      return saved && ready && state.document !== null && hash(state.document) === hash(document)
    }, false)
  }
  const reviewedConflict = (review: AccountGoalProgramSnapshot) => current() && state.status === "CONFLICT"
    && review.status === "CONFLICT" && review.remoteRevision !== null && review.remoteRevision === state.remoteRevision
    && accountGoalProgramEditToken(review) === accountGoalProgramEditToken(state)
    && hash(review.pendingDocument) === hash(state.pendingDocument)
  return { hydrate: () => serialize(id => hydrateInside(id), false), loadHistory: () => serialize(id => hydrateInside(id, true), false), save,
    snapshot: () => current() ? structuredClone(state) : { ...state, status: "FAILED" as const, document: null, history: { version: 1 as const, entries: [] }, pendingDocument: null },
    /** Both ciphertext versions remain in the existing conflict archive. */
    acceptRemote: (review: AccountGoalProgramSnapshot) => serialize(async id => {
      if (!reviewedConflict(review) || !await support() || !reviewedConflict(review)) return false
      const local = await buffer.read(ownerId, id)
      if (!current() || !local?.blocked || local.localSequence !== review.sequence) return false
      const response = await send({ action: "read", documentId: id })
      if (!current() || !response.ok || response.data.kind !== "document" || response.data.revision !== review.remoteRevision
        || !confirmed || hash(response.data.document) !== hash(confirmed)) return false
      await buffer.captureConflict(ownerId, id, response.data.document, response.data.revision, review.sequence, current)
      if (!current()) return false
      await buffer.resolveConflict(ownerId, id, "REMOTE", response.data.revision, review.sequence, current)
      return current() && hydrateInside(id, true, false)
    }, false),
    /** Export the exact staged history, never the confirmed remote history. */
    pendingBackup: (review: AccountGoalProgramSnapshot) => serialize(async id => {
      if (!reviewedConflict(review) || !await support() || !reviewedConflict(review)) return null
      const local = await buffer.read(ownerId, id)
      if (!current() || !local?.blocked || local.localSequence !== review.sequence || local.draft.kind !== "GOAL_PROGRAM_INDEX") return null
      const response = await send({ action: "read", documentId: id })
      if (!current() || !response.ok || response.data.kind !== "document" || response.data.revision !== review.remoteRevision
        || !confirmed || hash(response.data.document) !== hash(confirmed)) return null
      const pending = await readParts(local.draft, true)
      return reviewedConflict(review) && pending?.joined.document
        && hash(pending.joined.document) === hash(review.pendingDocument) ? structuredClone(pending.joined) : null
    }, null),
    close: () => { active = false; confirmed = null; buffer.close() } }
}
