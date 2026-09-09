import { vi } from "vitest"
import type { AccountJournalDraftBuffer, AccountJournalDraftView } from "./account-journal-draft-buffer"
import type { AccountPlanDocument } from "./account-plan-document-schema"
import { validateAccountPlanDocumentUpdate, validateAccountPlanDocument } from "./account-plan-document-schema"
import type { DraftTransport } from "./account-journal-sync"

export function planIntegrationTransport() {
  let document: AccountPlanDocument | null = null, revision = 0
  const send: DraftTransport<AccountPlanDocument> = vi.fn(async (request: Parameters<DraftTransport<AccountPlanDocument>>[0]): ReturnType<DraftTransport<AccountPlanDocument>> => {
    if (request.action === "read") return document ? { ok: true, data: { kind: "document", documentId: request.documentId,
      revision, document: structuredClone(document) } } : { ok: false, code: "NOT_FOUND" }
    if (request.action !== "save") return { ok: false, code: "UNAVAILABLE" }
    if (request.expectedRevision !== revision) return { ok: true, data: { kind: "conflict", documentId: request.documentId,
      operationId: request.operationId, currentRevision: revision } }
    if (!validateAccountPlanDocument(request.document) || document && !validateAccountPlanDocumentUpdate(document, request.document))
      return { ok: false, code: "INVALID_RESPONSE" }
    document = structuredClone(request.document); revision++
    return { ok: true, data: { kind: "saved", documentId: request.documentId, operationId: request.operationId, revision } }
  })
  return { send, revision: () => revision, document: () => structuredClone(document) }
}

/** Domain/UI protocol double; native IndexedDB/WebCrypto are tested in Playwright. */
export function planIntegrationBuffer(): AccountJournalDraftBuffer<AccountPlanDocument> {
  let view: AccountJournalDraftView<AccountPlanDocument> | null = null
  return {
    read: async () => structuredClone(view), list: async () => view ? [structuredClone(view)] : [],
    saveDraft: async (ownerId, documentId, draft, sequence = 0) => {
      if ((view?.localSequence ?? 0) !== sequence) throw Error("local CAS")
      view = { ownerId, documentId, serverRevision: view?.serverRevision ?? 0, localSequence: sequence + 1,
        acknowledgedSequence: view?.acknowledgedSequence ?? 0, draft: structuredClone(draft), pending: null, blocked: null,
        remoteDraft: null, state: "LOCAL_CHANGES" }
    },
    queue: async (_o, _d, operationId) => { if (!view) throw Error("missing draft")
      view.pending = { operationId, expectedRevision: view.serverRevision, sequence: view.localSequence, draft: structuredClone(view.draft) }
      view.state = "PENDING"
    },
    ack: async (_o, _d, operationId, revision) => {
      if (!view || view.pending?.operationId !== operationId) return false
      view.serverRevision = revision; view.acknowledgedSequence = view.localSequence; view.pending = null; view.state = "DRAFT_ACKNOWLEDGED"; return true
    },
    conflict: async (_o, _d, operationId, currentRevision) => { if (!view) return false
      view.blocked = { kind: "RECEIPT", operationId, currentRevision }; view.state = "CONFLICT"; return true },
    importRemote: async (ownerId, documentId, draft, serverRevision) => {
      if (view && view.state !== "DRAFT_ACKNOWLEDGED") return "CONFLICT"
      view = { ownerId, documentId, serverRevision, localSequence: 1, acknowledgedSequence: 1, draft: structuredClone(draft),
        state: "DRAFT_ACKNOWLEDGED", pending: null, blocked: null, remoteDraft: null }
      return "IMPORTED"
    },
    reject: async (_o, _d, operationId, rejection) => {
      if (!view?.pending || view.pending.operationId !== operationId) return false
      view.pending.rejection = rejection; return true
    },
    clear: async () => false, logout: () => {}, close: () => {},
  }
}
