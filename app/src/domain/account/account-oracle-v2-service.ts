import { requestAccountDocument, type AccountJournalRequest, type AccountJournalResult } from "./account-journal-api"
import { createAccountDocumentBuffer, type AccountJournalConflictBuffer } from "./account-journal-draft-buffer"
import { flushAccountJournalDraft } from "./account-journal-sync"
import { activeLocalAccount } from "./local-journal-ownership"
import { accountRunningProfileDocumentSchema, type AccountRunningProfileDocument } from "./account-running-profile-schema"
import { runningProfileDocumentId } from "./account-running-profile-service"
import { accountOracleCompatibleDocumentSchema, accountOracleV2DocumentSchema, emptyOracleV2Document,
  prepareOracleV2Migration, validateInitialOracleV2Document, validateOracleV2Migration, validateOracleV2Transition,
  type AccountOracleCompatibleDocument as Compatible, type AccountOracleV2Document as Document } from "./account-oracle-v2-schema"
import { oracleResponsesSchema, buildOracleProfile, type OracleAxisId } from "../oracle-profile-v2"
import { makeOracleProfileRevision } from "../oracle-profile-snapshot"

export type OracleV2StoreStatus = "LOADING" | "EMPTY" | "READY" | "PENDING" | "CONFLICT" | "FAILED" | "DELETED" | "MIGRATION_REQUIRED" | "LEGACY_DRAFT"
export type OracleV2Store = {
  status: OracleV2StoreStatus
  document: Document | null
  /** Autosaved editing material is never a completed result. Optional for pre-hydration callers. */
  draftDocument?: Document | null
  draftState?: "EDITING" | "SUBMITTING" | null
  /** Latest server-confirmed result, absent until verified and immediately hidden on deletion. */
  confirmedDocument?: Document | null
  legacyDocument: AccountRunningProfileDocument | null
  revision: number
  sequence: number
  remote: Compatible | null
  remoteRevision: number | null
  error: string | null
}
export type OracleV2ServicePorts = {
  buffer: AccountJournalConflictBuffer<Compatible>
  legacyBuffer: Pick<AccountJournalConflictBuffer<AccountRunningProfileDocument>, "read" | "close">
  send: (request: AccountJournalRequest<Compatible>, current: () => boolean) => Promise<AccountJournalResult<Compatible>>
  isOwner: () => boolean
  exclusive: <T>(work: () => Promise<T>) => Promise<T>
}
export function oracleV2EditToken(state: OracleV2Store): string {
  return JSON.stringify([state.revision, state.sequence, state.document, state.legacyDocument, state.draftDocument, state.draftState])
}
const v2 = (document: Compatible | null): Document | null => {
  const parsed = accountOracleV2DocumentSchema.safeParse(document)
  return parsed.success ? parsed.data : null
}
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)

/** Account-only service. A successful saveDraft means encrypted device storage, never server acknowledgement. */
export function createOracleV2Service(ownerId: string, changed: (state: OracleV2Store) => void, ports?: OracleV2ServicePorts) {
  // V1's database is deliberately never rewritten, cleared, or replayed by this service.
  const buffer = ports?.buffer ?? createAccountDocumentBuffer(accountOracleCompatibleDocumentSchema, "trainoracle-account-oracle-v2")
  const legacyBuffer = ports?.legacyBuffer ?? createAccountDocumentBuffer(accountRunningProfileDocumentSchema, "trainoracle-account-running-profile-v1")
  let active = true, verified = false
  let restartOperation: { operationId: string; expectedRevision: number } | null = null
  let baseline: Compatible | null = null
  let state: OracleV2Store = { status: "LOADING", document: null, legacyDocument: null, revision: 0, sequence: 0,
    remote: null, remoteRevision: null, error: null, draftDocument: null, draftState: null, confirmedDocument: null }
  let work: Promise<unknown> = Promise.resolve()
  const current = () => active && (ports?.isOwner() ?? activeLocalAccount() === ownerId)
  const publish = (patch: Partial<OracleV2Store>) => {
    if (!current()) return
    state = { ...state, ...patch }; changed(structuredClone(state))
  }
  const send = (request: AccountJournalRequest<Compatible>) => {
    const capable = { ...request, supportedRunningProfileVersions: [1, 2] as (1 | 2)[] }
    return ports ? ports.send(capable, current) : requestAccountDocument(ownerId, capable, current, accountOracleCompatibleDocumentSchema)
  }
  const serialize = (run: (id: string) => Promise<boolean>): Promise<boolean> => {
    const next = work.catch(() => undefined).then(async () => {
      if (!current()) return false
      const locked = async () => { const id = await runningProfileDocumentId(ownerId); return current() ? run(id) : false }
      if (ports) return ports.exclusive(locked)
      if (!globalThis.navigator?.locks) throw Error("LOCK_UNAVAILABLE")
      return navigator.locks.request(`trainoracle-running-profile:${ownerId}`, locked)
    }).catch(() => { publish({ status: "FAILED", error: "STORAGE_UNAVAILABLE" }); return false })
    work = next; return next
  }
  const support = async () => {
    const result = await send({ action: "oracleV2Support" })
    if (!current()) return false
    if (result.ok && result.data.kind === "oracle-v2-support" && result.data.version === 2) return true
    publish({ status: state.status === "PENDING" ? "PENDING" : "FAILED", error: result.ok ? "INVALID_RESPONSE" : result.code })
    return false
  }
  const localState = async (id: string, loading = false) => {
    const local = await buffer.read(ownerId, id)
    if (!current() || !local) return null
    const localDocument = local.resolvedDeletion ? null : v2(local.draft)
    const dirty = !local.resolvedDeletion && local.state !== "DRAFT_ACKNOWLEDGED"
    const editing = dirty && !local.pending
    const confirmedDocument = !loading && verified && !local.resolvedDeletion && localDocument?.data.status !== "DELETED" ? v2(baseline) : null
    const document = editing || local.blocked ? confirmedDocument : localDocument
    const legacyDocument = local.resolvedDeletion || localDocument ? null : accountRunningProfileDocumentSchema.parse(local.draft)
    publish({ document, legacyDocument, confirmedDocument, draftDocument: dirty ? localDocument : null,
      draftState: dirty ? editing ? "EDITING" : "SUBMITTING" : null, revision: local.serverRevision, sequence: local.localSequence,
      status: loading ? "LOADING" : local.blocked ? "CONFLICT" : local.pending?.rejection ? "FAILED"
        : local.state !== "DRAFT_ACKNOWLEDGED" && !local.resolvedDeletion ? "PENDING"
        : local.resolvedDeletion || localDocument?.data.status === "DELETED" ? "DELETED" : legacyDocument ? "MIGRATION_REQUIRED" : "READY",
      error: local.pending?.rejection ?? null })
    return local
  }
  const legacyPending = async (id: string) => {
    const legacy = await legacyBuffer.read(ownerId, id)
    if (!current()) return true
    if (legacy && !legacy.resolvedDeletion && (legacy.blocked || legacy.state !== "DRAFT_ACKNOWLEDGED")) {
      publish({ status: "LEGACY_DRAFT", error: "V1_DRAFT_PRESERVED" }); return true
    }
    return false
  }
  const flush = async (id: string) => {
    if (await legacyPending(id) || !await support() || !current()) return false
    const local = await buffer.read(ownerId, id)
    if (!current() || !local || !v2(local.draft)) return false
    if (local.localSequence !== state.sequence || local.serverRevision !== state.revision) {
      publish({ status: "CONFLICT", error: "LOCAL_STATE_CHANGED" }); return false
    }
    if (local.state !== "DRAFT_ACKNOWLEDGED" && !local.pending) {
      publish({ error: "DRAFT_NOT_SUBMITTED" }); return false
    }
    const result = await flushAccountJournalDraft(buffer, ownerId, id, send, current, document => { baseline = document })
    if (!current()) return false
    await localState(id)
    if (result === "SAVED") publish({ error: null })
    return result === "SAVED"
  }
  const hydrate = () => serialize(async id => {
    verified = false
    publish({ status: "LOADING", error: null, remote: null, remoteRevision: null, confirmedDocument: null })
    const before = await localState(id, true)
    if (!await support()) return false
    if (await legacyPending(id)) return false
    // Only already queued submissions replay automatically. In-progress answers never auto-submit.
    if (before?.pending && !before.blocked && !before.resolvedDeletion && v2(before.draft)) {
      await flush(id)
      if (!current()) return false
    }
    const response = await send({ action: "read", documentId: id })
    if (!current()) return false
    const local = await buffer.read(ownerId, id)
    if (!current()) return false
    if (!response.ok) {
      if (response.code === "NOT_FOUND" && (!local || local.serverRevision === 0 && !local.blocked)) {
        baseline = null; verified = true
        if (local) await localState(id)
        else publish({ status: "EMPTY", document: null, legacyDocument: null, revision: 0, sequence: 0,
          confirmedDocument: null, draftDocument: null, draftState: null })
        return true
      }
      publish({ status: local && local.state !== "DRAFT_ACKNOWLEDGED" ? "PENDING" : "FAILED", error: response.code }); return false
    }
    if ((response.data.kind !== "document" && response.data.kind !== "deleted") || response.data.documentId !== id) {
      publish({ status: "FAILED", error: "INVALID_RESPONSE" }); return false
    }
    const remote = response.data.kind === "document" ? accountOracleCompatibleDocumentSchema.parse(response.data.document) : null
    const revision = response.data.revision
    if (local && revision < local.serverRevision) { publish({ status: "FAILED", error: "STALE_RESPONSE" }); return false }
    baseline = remote; verified = true
    if (local && !local.resolvedDeletion && (local.blocked || local.state !== "DRAFT_ACKNOWLEDGED")) {
      if (local.blocked || revision !== local.serverRevision) {
        if (!local.blocked) {
          if (remote) await buffer.importRemote(ownerId, id, remote, revision)
          else {
            // Bind the unsent snapshot to the observed deletion without transmitting it.
            if (!local.pending) await buffer.queue(ownerId, id, crypto.randomUUID())
            const queued = await buffer.read(ownerId, id)
            if (!current() || !queued?.pending) return false
            await buffer.conflict(ownerId, id, queued.pending.operationId, revision)
          }
          if (!current()) return false
        }
        await buffer.captureConflict(ownerId, id, remote, revision, local.localSequence, current)
        await localState(id); publish({ remote, remoteRevision: revision }); return false
      }
      await localState(id); return true
    }
    if (!remote) {
      if (local && !local.resolvedDeletion) await buffer.acceptCleanDeletion(ownerId, id, revision, local.localSequence)
      publish({ status: "DELETED", document: null, legacyDocument: null, revision,
        confirmedDocument: null, draftDocument: null, draftState: null }); return true
    }
    if (local && revision === local.serverRevision && !same(local.draft, remote)) {
      publish({ status: "FAILED", error: "INVALID_RESPONSE" }); return false
    }
    const imported = await buffer.importRemote(ownerId, id, remote, revision)
    if (!current()) return false
    await localState(id)
    if (imported === "CONFLICT") { publish({ status: "CONFLICT", remote, remoteRevision: revision }); return false }
    return true
  })
  const transition = (next: Document) => baseline === null ? validateInitialOracleV2Document(next)
    : v2(baseline) ? validateOracleV2Transition(baseline, next) : validateOracleV2Migration(baseline, next)
  const prepare = (input: unknown): Document | null => {
    const document = accountOracleV2DocumentSchema.safeParse(input)
    if (document.success) return document.data
    const answers = oracleResponsesSchema.safeParse(input)
    if (!answers.success || state.legacyDocument) return null
    const draft = structuredClone(state.draftDocument ?? state.document ?? emptyOracleV2Document())
    if (draft.data.status === "DELETED") return null
    const previous = v2(baseline)?.data.current
    const selected = draft.data.current?.selectedCharacter ?? null
    draft.data.current = makeOracleProfileRevision({ revision: (previous?.revision ?? 0) + 1,
      answeredAt: new Date().toISOString(), answers: answers.data,
      selectedCharacter: selected && buildOracleProfile(answers.data).candidates.some(c => c.id === selected) ? selected : null })
    // Replacing an unsubmitted answer revision also replaces its not-yet-historical snapshot.
    draft.data.readings = draft.data.readings.filter(reading => reading.source.revision !== draft.data.current!.revision)
    return draft
  }
  const persist = async (id: string, input: unknown, token: string, migration = false, submit = false) => {
    if (!verified || token !== oracleV2EditToken(state)
      || !["EMPTY", "READY", "PENDING", ...(migration ? ["MIGRATION_REQUIRED"] : [])].includes(state.status)) return false
    if (await legacyPending(id)) return false
    const document = prepare(input)
    if (!document || !transition(document) || state.legacyDocument && !migration) {
      publish({ error: "INVALID_DOCUMENT_UPDATE" }); return false
    }
    const local = await buffer.read(ownerId, id)
    if (!current()) return false
    if ((local?.localSequence ?? 0) !== state.sequence || local?.blocked || local?.resolvedDeletion
      || local && local.serverRevision !== state.revision) {
      publish({ status: "CONFLICT", error: "LOCAL_STATE_CHANGED" }); return false
    }
    // A lost receipt must be replayed before editing; it may already have committed.
    if (local?.pending) { publish({ error: "RETRY_REQUIRED" }); return false }
    await buffer.saveDraft(ownerId, id, document, state.sequence, migration ? "MIGRATION" : undefined)
    if (!current()) return false
    // Persist submission intent before probing the network; offline completion can then retry exactly.
    if (submit) await buffer.queue(ownerId, id, crypto.randomUUID())
    if (!current()) return false
    await localState(id); return true
  }
  const saveDraft = (input: unknown, token: string) => serialize(id => persist(id, input, token))
  const save = (input: unknown, token: string) => serialize(async id => {
    // Submit the exact autosaved draft without manufacturing another response revision.
    if (verified && token === oracleV2EditToken(state) && state.status === "PENDING"
      && state.draftState === "SUBMITTING" && same(input, state.document)) return flush(id)
    return await persist(id, input, token, false, true) && await flush(id)
  })
  const retry = () => serialize(async id => {
    if (!verified || await legacyPending(id)) return false
    return flush(id)
  })
  const commitAnswers = (answers: unknown, selectedCharacter: OracleAxisId | null, token: string) => serialize(async id => {
    const document = prepare(answers)
    if (!document?.data.current) return false
    document.data.current.selectedCharacter = selectedCharacter
    return await persist(id, document, token, false, true) && await flush(id)
  })
  const migrateV1 = (token: string) => serialize(async id => {
    if (!state.legacyDocument || state.status !== "MIGRATION_REQUIRED") return false
    return await persist(id, prepareOracleV2Migration(state.legacyDocument), token, true, true) && await flush(id)
  })
  const deleteProfile = (token: string) => serialize(async id => {
    const deleted = emptyOracleV2Document(); deleted.data.status = "DELETED"
    return await persist(id, deleted, token, false, true) && await flush(id)
  })
  const restartProfile = (token: string, confirmation: "START_NEW_ORACLE_V2") => serialize(async id => {
    if (!verified || state.status !== "DELETED" || state.revision < 1 || token !== oracleV2EditToken(state)
      || confirmation !== "START_NEW_ORACLE_V2" || await legacyPending(id)) return false
    const supported = await send({ action: "oracleV2RestartSupport" })
    if (!current()) return false
    if (!supported.ok || supported.data.kind !== "oracle-v2-restart-support" || supported.data.version !== 1) {
      publish({ error: supported.ok ? "INVALID_RESPONSE" : supported.code }); return false
    }
    if (restartOperation?.expectedRevision !== state.revision) restartOperation = { operationId: crypto.randomUUID(), expectedRevision: state.revision }
    const result = await send({ action: "restartOracleV2", documentId: id, ...restartOperation, confirmation })
    if (!current()) return false
    if (!result.ok) { publish({ error: result.code }); return false }
    if (result.data.kind === "conflict") {
      publish({ status: "FAILED", error: "CONFLICT" }); return false
    }
    if (result.data.kind !== "saved" || result.data.documentId !== id || result.data.operationId !== restartOperation.operationId
      || result.data.revision !== restartOperation.expectedRevision + 1) {
      publish({ error: "INVALID_RESPONSE" }); return false
    }
    const empty = emptyOracleV2Document()
    await buffer.importRemote(ownerId, id, empty, result.data.revision)
    if (!current()) return false
    baseline = empty; restartOperation = null
    const restarted = await localState(id)
    return current() && restarted?.state === "DRAFT_ACKNOWLEDGED" && v2(restarted.draft)?.data.status === "ACTIVE"
  })
  const resolve = (review: OracleV2Store, choice: "LOCAL" | "REMOTE") => serialize(async id => {
    if (review.status !== "CONFLICT" || review.remoteRevision === null || !await support() || await legacyPending(id)) return false
    const local = await buffer.read(ownerId, id)
    if (!current() || !local?.blocked || local.localSequence !== review.sequence
      || !same(local.draft, review.draftDocument ?? review.document ?? review.legacyDocument)) return false
    const response = await send({ action: "read", documentId: id })
    if (!current() || !response.ok || response.data.kind !== "document" && response.data.kind !== "deleted") return false
    const remote = response.data.kind === "document" ? accountOracleCompatibleDocumentSchema.parse(response.data.document) : null
    if (response.data.revision !== review.remoteRevision || !same(remote, review.remote)) {
      publish({ status: "CONFLICT", remote, remoteRevision: response.data.revision }); return false
    }
    baseline = remote
    const submitted = local.pending !== null
    let document = v2(local.draft)
    if (choice === "LOCAL") {
      const remoteV2 = v2(remote)
      if (!document || !remoteV2 || remoteV2.data.status === "DELETED") {
        publish({ error: "INVALID_DOCUMENT_UPDATE" }); return false
      }
      if (!transition(document)) {
        // Review authorizes a new response revision, not rewriting the remote history.
        if (document.data.status !== "ACTIVE") return false
        const proposed = document.data.current
        const context = document.data.context
        document = structuredClone(remoteV2)
        if (context) document.data.context = structuredClone(context)
        else delete document.data.context
        if (proposed) document.data.current = makeOracleProfileRevision({ revision: (remoteV2.data.current?.revision ?? 0) + 1,
          answeredAt: new Date(Math.max(Date.now(), Date.parse(remoteV2.data.current?.answeredAt ?? proposed.answeredAt))).toISOString(),
          answers: proposed.answers, selectedCharacter: proposed.selectedCharacter })
        if (!transition(document)) return false
      }
    }
    await buffer.captureConflict(ownerId, id, remote, review.remoteRevision, review.sequence, current)
    if (!current()) return false
    await buffer.resolveConflict(ownerId, id, remote ? choice : "DELETE", review.remoteRevision, review.sequence, current)
    if (!current()) return false
    verified = true
    if (choice === "LOCAL") {
      const resolved = await buffer.read(ownerId, id)
      if (!current() || !resolved || !document) return false
      if (!same(resolved.draft, document)) await buffer.saveDraft(ownerId, id, document, resolved.localSequence)
      if (submitted) await buffer.queue(ownerId, id, crypto.randomUUID())
      await localState(id)
      if (submitted) await flush(id)
    }
    await localState(id); publish({ remote: null, remoteRevision: null })
    return current() && (["READY", "DELETED", "MIGRATION_REQUIRED"].includes(state.status)
      || choice === "LOCAL" && !submitted && state.status === "PENDING")
  })
  return { hydrate, save, saveDraft, commitAnswers, retry, migrateV1, deleteProfile, restartProfile, resolve,
    snapshot: (): OracleV2Store => current() ? structuredClone(state) : { status: "LOADING", document: null, legacyDocument: null,
      revision: 0, sequence: 0, remote: null, remoteRevision: null, error: "STALE_RESPONSE",
      confirmedDocument: null, draftDocument: null, draftState: null },
    close: () => { active = false; verified = false; baseline = null; buffer.close(); legacyBuffer.close() } }
}
