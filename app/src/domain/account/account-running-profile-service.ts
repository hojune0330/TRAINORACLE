import { requestAccountDocument, type AccountJournalRequest, type AccountJournalResult } from "./account-journal-api"
import { createAccountDocumentBuffer, type AccountJournalConflictBuffer } from "./account-journal-draft-buffer"
import { flushAccountJournalDraft } from "./account-journal-sync"
import { activeLocalAccount } from "./local-journal-ownership"
import { RUNNING_PROFILE_NAMESPACE, accountRunningProfileDocumentSchema, type AccountRunningProfileDocument as Document } from "./account-running-profile-schema"
import { RUNNING_PROFILE_VERSION, runningProfileAnswersSchema } from "../running-profile"

export type RunningProfileStoreStatus = "LOADING" | "EMPTY" | "READY" | "PENDING" | "CONFLICT" | "FAILED" | "DELETED" | "UPGRADE_REQUIRED"
export type RunningProfileStore = {
  status: RunningProfileStoreStatus; document: Document | null; revision: number; sequence: number
  remote: Document | null; remoteRevision: number | null
}
type Ports = {
  buffer: AccountJournalConflictBuffer<Document>
  send: (request: AccountJournalRequest<Document>, current: () => boolean) => Promise<AccountJournalResult<Document>>
  isOwner: () => boolean
  exclusive: <T>(work: () => Promise<T>) => Promise<T>
}
export async function runningProfileDocumentId(ownerId: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify([RUNNING_PROFILE_NAMESPACE, ownerId]))))
  bytes[6] = (bytes[6]! & 15) | 80; bytes[8] = (bytes[8]! & 63) | 128
  const hex = [...bytes.slice(0, 16)].map(value => value.toString(16).padStart(2, "0")).join("")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
export function runningProfileEditToken(state: RunningProfileStore) {
  return JSON.stringify([state.revision, state.sequence, state.document])
}

/** All writes use the existing encrypted outbox; no device-only fallback for an account. */
export function createRunningProfileService(ownerId: string, changed: (state: RunningProfileStore) => void, ports?: Ports) {
  const buffer = ports?.buffer ?? createAccountDocumentBuffer(accountRunningProfileDocumentSchema, "trainoracle-account-running-profile-v1")
  let active = true
  let state: RunningProfileStore = { status: "LOADING", document: null, revision: 0, sequence: 0, remote: null, remoteRevision: null }
  let work: Promise<unknown> = Promise.resolve()
  const current = () => active && (ports?.isOwner() ?? activeLocalAccount() === ownerId)
  const send = (request: AccountJournalRequest<Document>) => ports ? ports.send(request, current)
    : requestAccountDocument(ownerId, request, current, accountRunningProfileDocumentSchema)
  const publish = (patch: Partial<RunningProfileStore>) => {
    if (!current()) return
    state = { ...state, ...patch }; changed(structuredClone(state))
  }
  const serialize = (run: (id: string) => Promise<boolean>): Promise<boolean> => {
    const next = work.catch(() => undefined).then(async () => {
      if (!current()) return false
      const locked = async () => {
        const id = await runningProfileDocumentId(ownerId)
        return current() ? run(id) : false
      }
      if (ports) return ports.exclusive(locked)
      if (!globalThis.navigator?.locks) throw Error("Profile lock unavailable")
      return navigator.locks.request(`trainoracle-running-profile:${ownerId}`, locked)
    }).catch(() => { publish({ status: "FAILED" }); return false })
    work = next; return next
  }
  const support = async () => {
    const result = await send({ action: "runningProfileSupport" })
    if (!current()) return false
    if (result.ok && result.data.kind === "running-profile-support" && result.data.version === 1) return true
    publish({ status: "FAILED" }); return false
  }
  const localState = async (id: string, verifying = false) => {
    const local = await buffer.read(ownerId, id)
    if (!current() || !local) return null
    publish({ document: local.resolvedDeletion ? null : local.draft, revision: local.serverRevision, sequence: local.localSequence,
      status: verifying ? "LOADING" : local.resolvedDeletion ? "DELETED" : local.blocked ? "CONFLICT" : local.pending?.rejection ? "FAILED"
        : local.state === "DRAFT_ACKNOWLEDGED" ? "READY" : "PENDING" })
    return local
  }
  const flush = async (id: string) => {
    await flushAccountJournalDraft(buffer, ownerId, id, send, current)
    return localState(id)
  }
  const hydrate = () => serialize(async id => {
    publish({ status: "LOADING" })
    const before = await localState(id, true)
    if (!await support()) return false
    if (before && !before.blocked && !before.resolvedDeletion && before.state !== "DRAFT_ACKNOWLEDGED") {
      // An offline V1 draft survives a V2 upgrade, but must never overwrite it.
      const preflight = await send({ action: "read", documentId: id })
      if (!current()) return false
      if (!preflight.ok && preflight.code === "UPGRADE_REQUIRED") {
        publish({ status: "UPGRADE_REQUIRED" }); return false
      }
      if (preflight.ok && preflight.data.kind === "document" && !accountRunningProfileDocumentSchema.safeParse(preflight.data.document).success) {
        publish({ status: "UPGRADE_REQUIRED" }); return false
      }
      await flush(id)
      if (!current()) return false
    }
    const response = await send({ action: "read", documentId: id })
    if (!current()) return false
    const local = await buffer.read(ownerId, id)
    if (!current()) return false
    if (!response.ok) {
      if (response.code === "UPGRADE_REQUIRED") { publish({ status: "UPGRADE_REQUIRED" }); return false }
      if (response.code === "NOT_FOUND" && !local) {
        publish({ status: "EMPTY", document: null, revision: 0, sequence: 0, remote: null, remoteRevision: null }); return true
      }
      if (response.code === "NOT_FOUND" && local?.serverRevision === 0 && !local.blocked) { await localState(id); return false }
      publish({ status: local && local.state !== "DRAFT_ACKNOWLEDGED" ? "PENDING" : "FAILED" }); return false
    }
    if (response.data.kind !== "document" && response.data.kind !== "deleted") { publish({ status: "FAILED" }); return false }
    const remoteRevision = response.data.revision
    const remote = response.data.kind === "document" ? response.data.document : null
    if (remote && !accountRunningProfileDocumentSchema.safeParse(remote).success) {
      publish({ status: "UPGRADE_REQUIRED" }); return false
    }
    if (local && remoteRevision < local.serverRevision) { publish({ status: "FAILED" }); return false }
    if (local?.blocked || local && !local.resolvedDeletion && local.state !== "DRAFT_ACKNOWLEDGED") {
      if (local && (local.blocked || remoteRevision !== local.serverRevision)) {
        await buffer.captureConflict(ownerId, id, remote, remoteRevision, local.localSequence, current)
        await localState(id); publish({ remote, remoteRevision }); return false
      }
      await localState(id); return false
    }
    if (!remote) {
      if (local && !local.resolvedDeletion) await buffer.acceptCleanDeletion(ownerId, id, remoteRevision, local.localSequence)
      publish({ status: "DELETED", document: null, revision: remoteRevision, remote: null, remoteRevision: null }); return true
    }
    if (local && remoteRevision === local.serverRevision && JSON.stringify(local.draft) !== JSON.stringify(remote)) {
      publish({ status: "FAILED" }); return false
    }
    const imported = await buffer.importRemote(ownerId, id, remote, remoteRevision)
    if (!current()) return false
    await localState(id)
    if (imported === "CONFLICT") { publish({ status: "CONFLICT", remote, remoteRevision }); return false }
    publish({ remote: null, remoteRevision: null }); return true
  })
  const save = (input: unknown, token: string) => serialize(async id => {
    const parsed = runningProfileAnswersSchema.safeParse(input)
    if (!parsed.success || !["READY", "EMPTY"].includes(state.status) || token !== runningProfileEditToken(state)) return false
    if (!await support()) return false
    const local = await buffer.read(ownerId, id)
    if (!current() || (local?.localSequence ?? 0) !== state.sequence || local?.blocked
      || local && (local.serverRevision !== state.revision || local.state !== "DRAFT_ACKNOWLEDGED")) {
      publish({ status: "CONFLICT" }); return false
    }
    const document: Document = { version: 3, state: "ACCOUNT_STATE", kind: "RUNNING_PROFILE",
      data: { version: RUNNING_PROFILE_VERSION, answeredAt: new Date().toISOString(), answers: parsed.data } }
    await buffer.saveDraft(ownerId, id, document, state.sequence)
    if (!current()) return false
    await localState(id)
    const saved = await flush(id)
    return current() && saved?.state === "DRAFT_ACKNOWLEDGED"
  })
  const resolve = (review: RunningProfileStore, choice: "LOCAL" | "REMOTE") => serialize(async id => {
    if (review.status !== "CONFLICT" || review.remoteRevision === null || !await support()) return false
    const local = await buffer.read(ownerId, id)
    if (!current() || !local?.blocked || local.localSequence !== review.sequence
      || JSON.stringify(local.draft) !== JSON.stringify(review.document)) return false
    const response = await send({ action: "read", documentId: id })
    if (!current() || !response.ok || response.data.kind !== "document" && response.data.kind !== "deleted") return false
    const remote = response.data.kind === "document" ? response.data.document : null
    if (response.data.revision !== review.remoteRevision || JSON.stringify(remote) !== JSON.stringify(review.remote)) {
      publish({ status: "CONFLICT", remote, remoteRevision: response.data.revision }); return false
    }
    if (choice === "LOCAL" && !remote) return false
    await buffer.captureConflict(ownerId, id, remote, review.remoteRevision, review.sequence, current)
    if (!current()) return false
    await buffer.resolveConflict(ownerId, id, remote ? choice : "DELETE", review.remoteRevision, review.sequence, current)
    if (!current()) return false
    if (choice === "LOCAL") await flush(id)
    await localState(id)
    publish({ remote: null, remoteRevision: null })
    return current() && (state.status === "READY" || state.status === "DELETED")
  })
  return { hydrate, save, resolve, snapshot: () => structuredClone(state), close: () => { active = false; buffer.close() } }
}
