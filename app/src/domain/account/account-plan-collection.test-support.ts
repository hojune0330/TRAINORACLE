import { vi } from "vitest"
import { createCollectionPreparationMemory } from "./account-plan-collection-preparation.test-support"
import type { AccountJournalConflictArchive, AccountJournalConflictBuffer, AccountJournalDraftView } from "./account-journal-draft-buffer"
import { accountPlanFingerprint, type AccountPlanDocument } from "./account-plan-document-schema"
import { splitAccountPlanCollection, type AccountPlanCollectionIndex } from "./account-plan-collection-schema"
import type { AccountPlanCollectionClient } from "./account-plan-collection-api"
import type { AccountPlanCollectionCommit, AccountPlanCollectionReceipt } from "./account-plan-collection-transfer"
import type { AccountPlanCollectionManifest, AccountPlanCollectionPart, AccountPlanLegacyHandoff } from "./account-plan-collection-buffer"

export const COLLECTION_OWNER = "11111111-1111-4111-8111-111111111111"
export const COLLECTION_LEGACY_ID = "33333333-3333-4333-8333-333333333333"
const clone = structuredClone
// Protocol double: deliberately no claim of encryption or real IndexedDB transaction coverage.
export function collectionMemoryStore<T>() {
  const rows = new Map<string, AccountJournalDraftView<T>>()
  const archives = new Map<string, AccountJournalConflictArchive<T>[]>()
  const writes: T[] = []
  const key = (owner: string, id: string) => `${owner}:${id}`
  const must = (owner: string, id: string) => {
    const v = rows.get(key(owner, id)); if (!v) throw Error("Missing local record"); return v
  }
  const buffer: AccountJournalConflictBuffer<T> = {
    read: vi.fn(async (owner, id) => clone(rows.get(key(owner, id)) ?? null)),
    list: async owner => clone([...rows.values()].filter(v => v.ownerId === owner)),
    saveDraft: vi.fn(async (ownerId, documentId, draft, sequence) => {
      const old = rows.get(key(ownerId, documentId))
      if (sequence !== undefined && (old?.localSequence ?? 0) !== sequence || old?.blocked) throw Error("Local CAS")
      writes.push(clone(draft))
      rows.set(key(ownerId, documentId), { ownerId, documentId, serverRevision: old?.serverRevision ?? 0,
        localSequence: (old?.localSequence ?? 0) + 1, acknowledgedSequence: old?.acknowledgedSequence ?? 0,
        state: "LOCAL_CHANGES", draft: clone(draft), pending: old?.pending ?? null, blocked: null, remoteDraft: null })
    }),
    queue: vi.fn(async (owner, id, operationId) => {
      const v = must(owner, id)
      if (v.pending) { if (v.pending.operationId !== operationId) throw Error("Pending"); return }
      if (v.blocked || v.localSequence === v.acknowledgedSequence) throw Error("Queue")
      v.pending = { operationId, expectedRevision: v.serverRevision, sequence: v.localSequence, draft: clone(v.draft) }
      v.state = "PENDING"
    }),
    ack: vi.fn(async (owner, id, operationId, revision) => {
      const v = must(owner, id)
      if (!v.pending || v.pending.operationId !== operationId || revision !== v.pending.expectedRevision + 1 || v.blocked) return false
      v.serverRevision = revision; v.acknowledgedSequence = v.pending.sequence; v.pending = null
      v.state = v.acknowledgedSequence === v.localSequence ? "DRAFT_ACKNOWLEDGED" : "LOCAL_CHANGES"
      return true
    }),
    conflict: async (owner, id, operationId, currentRevision) => {
      const v = must(owner, id)
      if (v.pending?.operationId !== operationId || currentRevision === v.serverRevision) return false
      v.blocked = { kind: "RECEIPT", operationId, currentRevision }; v.state = "CONFLICT"; return true
    },
    importRemote: vi.fn(async (ownerId, documentId, draft, serverRevision) => {
      const old = rows.get(key(ownerId, documentId))
      if (serverRevision <= 0 || old && old.serverRevision > serverRevision) throw Error("Revision")
      if (old?.blocked) return "CONFLICT"
      if (old && old.state !== "DRAFT_ACKNOWLEDGED") {
        if (serverRevision === old.serverRevision) return "UNCHANGED"
        old.blocked = { kind: "REMOTE", operationId: null, currentRevision: serverRevision }
        old.remoteDraft = clone(draft); old.state = "CONFLICT"; return "CONFLICT"
      }
      if (old && old.serverRevision === serverRevision) {
        if (accountPlanFingerprint(old.draft) !== accountPlanFingerprint(draft)) throw Error("Same revision mismatch")
        return "UNCHANGED"
      }
      const sequence = (old?.localSequence ?? 0) + 1
      rows.set(key(ownerId, documentId), { ownerId, documentId, serverRevision, localSequence: sequence,
        acknowledgedSequence: sequence, state: "DRAFT_ACKNOWLEDGED", draft: clone(draft), pending: null, blocked: null, remoteDraft: null })
      return "IMPORTED"
    }),
    captureConflict: async (owner, id, remote, remoteRevision, sequence, current = () => true) => {
      const v = must(owner, id)
      if (!current() || !v.blocked || v.localSequence !== sequence || remoteRevision < v.blocked.currentRevision) throw Error("Conflict CAS")
      v.remoteDraft = clone(remote); v.blocked = { kind: "REMOTE", operationId: null, currentRevision: remoteRevision }
    },
    resolveConflict: async (owner, id, choice, remoteRevision, sequence, current = () => true) => {
      const v = must(owner, id)
      if (!current() || choice !== "REMOTE" || !v.remoteDraft || v.blocked?.currentRevision !== remoteRevision || v.localSequence !== sequence) throw Error("Conflict CAS")
      const history = archives.get(key(owner, id)) ?? []
      history.push({ version: 1, createdAt: null, localServerRevision: v.serverRevision, localSequence: sequence,
        remoteRevision, deleted: false, choice, local: clone(v.draft), remote: clone(v.remoteDraft), pending: clone(v.pending) })
      archives.set(key(owner, id), history)
      v.draft = v.remoteDraft; v.remoteDraft = null; v.pending = null; v.blocked = null
      v.localSequence++; v.acknowledgedSequence = v.localSequence; v.serverRevision = remoteRevision; v.state = "DRAFT_ACKNOWLEDGED"
    },
    readConflictArchive: async (owner, id) => clone(archives.get(key(owner, id)) ?? []),
    acceptCleanDeletion: async () => { throw Error("Deletion forbidden") },
    clear: async () => { throw Error("Deletion forbidden") }, logout: vi.fn(), close: vi.fn(),
  }
  return { buffer, rows, archives, writes }
}
export function collectionMemoryBuffers() {
  const manifests = collectionMemoryStore<AccountPlanCollectionManifest>(), parts = collectionMemoryStore<AccountPlanCollectionPart>()
  const legacy = collectionMemoryStore<AccountPlanDocument>()
  const cutovers = collectionMemoryStore<AccountPlanLegacyHandoff>()
  const preparations = createCollectionPreparationMemory()
  return { manifests, parts, legacy, cutovers, preparations, dependencies: { manifests: manifests.buffer, parts: parts.buffer,
    cutovers: cutovers.buffer, preparations: preparations.buffer } }
}

export function collectionServer(document: AccountPlanDocument | null = null) {
  let index: AccountPlanCollectionIndex | null = null, revision = 0
  let legacy: Awaited<ReturnType<AccountPlanCollectionClient["readLegacy"]>> = null
  const parts = new Map<string, AccountPlanCollectionPart>(), receipts = new Map<string, AccountPlanCollectionReceipt>()
  const commits: AccountPlanCollectionCommit[] = []
  let loseNext = false, failStage = false
  const seed = (doc: AccountPlanDocument) => {
    const split = splitAccountPlanCollection(doc); index = split.index; revision++
    for (const p of [...split.snapshots, ...split.progress]) parts.set(p.id, clone(p))
  }
  if (document) seed(document)
  const client: AccountPlanCollectionClient = {
    readIndex: vi.fn(async () => index ? { index: clone(index), revision } : null),
    readLegacy: vi.fn(async () => clone(legacy)),
    receipt: vi.fn(async (_owner, id) => clone(receipts.get(id) ?? null)),
    readPart: vi.fn(async (_owner, _kind, id) => clone(parts.get(id) ?? null)),
    stage: vi.fn(async (owner, part) => {
      if (owner !== COLLECTION_OWNER || failStage) throw Error("UNAVAILABLE")
      const old = parts.get(part.id)
      if (old && accountPlanFingerprint(old) !== accountPlanFingerprint(part)) throw Error("CONFLICT")
      parts.set(part.id, clone(part))
    }),
    commit: vi.fn(async (request: AccountPlanCollectionCommit): ReturnType<AccountPlanCollectionClient["commit"]> => {
      commits.push(clone(request))
      if (request.ownerId !== COLLECTION_OWNER || request.expectedRevision !== revision
        || request.previousIndexFingerprint !== (index ? accountPlanFingerprint(index) : null)
        || request.legacy && (!legacy || request.legacy.documentId !== legacy.documentId
          || request.legacy.revision !== legacy.revision || request.legacy.fingerprint !== accountPlanFingerprint(legacy.document))) return { kind: "conflict" }
      revision++; index = clone(request.index)
      const receipt = { ownerId: request.ownerId, operationId: request.operationId, revision,
        indexFingerprint: accountPlanFingerprint(index), requestFingerprint: accountPlanFingerprint(request) }
      receipts.set(request.operationId, receipt)
      if (loseNext) { loseNext = false; throw Error("UNAVAILABLE") }
      return { kind: "committed", receipt: clone(receipt) }
    }),
  }
  return { client, parts, receipts, commits, seed,
    setLegacy: (doc: AccountPlanDocument, rev = 1) => { legacy = { documentId: COLLECTION_LEGACY_ID, revision: rev, document: clone(doc) } },
    loseResponse: () => { loseNext = true }, failStages: (v: boolean) => { failStage = v },
    revision: () => revision, index: () => clone(index),
  }
}
