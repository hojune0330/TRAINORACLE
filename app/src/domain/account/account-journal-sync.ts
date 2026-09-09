import type { AccountJournalDraftBuffer } from "./account-journal-draft-buffer"
import { isAccountJournalWriteRejection, type AccountJournalWriteRejection } from "./account-write-rejection"
import type { AccountJournalRequest, AccountJournalResult } from "./account-journal-api"

export type DraftTransport<T = import("./account-journal-draft-buffer").AccountJournalDraft> = (request: AccountJournalRequest<T>) => Promise<AccountJournalResult<T>>

/** Replay the immutable pending snapshot before sending any newer local edit. */
export async function flushAccountJournalDraft<T>(
  buffer: AccountJournalDraftBuffer<T>, ownerId: string, documentId: string,
  send: DraftTransport<T>, isCurrent: () => boolean,
): Promise<"SAVED" | "PENDING" | "CONFLICT" | "STALE" | AccountJournalWriteRejection> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (!isCurrent()) return "STALE"
    let view = await buffer.read(ownerId, documentId)
    if (!isCurrent()) return "STALE"
    if (!view) return "PENDING"
    if (view.blocked) return "CONFLICT"
    if (view.state === "DRAFT_ACKNOWLEDGED") return "SAVED"
    if (!view.pending) {
      await buffer.queue(ownerId, documentId, crypto.randomUUID())
      view = await buffer.read(ownerId, documentId)
    }
    if (!isCurrent()) return "STALE"
    const pending = view?.pending
    if (!pending) return "PENDING"
    if (pending.rejection) return pending.rejection
    const result = await send({ action: "save", documentId, operationId: pending.operationId,
      ...(pending.writePurpose ? { writePurpose: pending.writePurpose } : {}),
      expectedRevision: pending.expectedRevision, document: pending.draft })
    if (!isCurrent()) return "STALE"
    if (!result.ok) {
      if (!isAccountJournalWriteRejection(result.code)) return "PENDING"
      if (await buffer.reject?.(ownerId, documentId, pending.operationId, result.code) === false) continue
      return isCurrent() ? result.code : "STALE"
    }
    if (result.data.kind === "conflict") {
      if (result.data.documentId !== documentId || result.data.operationId !== pending.operationId) return "PENDING"
      await buffer.conflict(ownerId, documentId, pending.operationId, result.data.currentRevision)
      return "CONFLICT"
    }
    if (result.data.kind !== "saved" || result.data.documentId !== documentId
      || result.data.operationId !== pending.operationId
      || result.data.revision !== pending.expectedRevision + 1) return "PENDING"
    if (!await buffer.ack(ownerId, documentId, pending.operationId, result.data.revision)) return "PENDING"
  }
  return "PENDING"
}
