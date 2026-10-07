import type { AccountJournalDraftBuffer } from "./account-journal-draft-buffer"
import { isAccountJournalWriteRejection, type AccountJournalWriteRejection } from "./account-write-rejection"
import type { AccountJournalRequest, AccountJournalResult } from "./account-journal-api"
import { accountDeletionBoundaryState } from "./account-deletion-boundary"

export type DraftTransport<T = import("./account-journal-draft-buffer").AccountJournalDraft> = (request: AccountJournalRequest<T>) => Promise<AccountJournalResult<T>>

/** Replay the immutable pending snapshot before sending any newer local edit. */
export async function flushAccountJournalDraft<T>(
  buffer: AccountJournalDraftBuffer<T>, ownerId: string, documentId: string,
  send: DraftTransport<T>, isCurrent: () => boolean,
  onAcknowledged?: (document: T, revision: number) => void,
): Promise<"SAVED" | "PENDING" | "CONFLICT" | "STALE" | AccountJournalWriteRejection> {
  // A durable owner terminal notice is the outbox disposition. Do not read,
  // clear, requeue, ACK, or retry the retained ciphertext after account deletion.
  const localBoundary = (): "ACCOUNT_DELETION_REQUESTED" | "PENDING" | null => {
    const state = accountDeletionBoundaryState(ownerId)
    return state === "CLOSED" ? "ACCOUNT_DELETION_REQUESTED" : state === "UNKNOWN" ? "PENDING" : null
  }
  try {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      let boundary = localBoundary()
      if (boundary) return boundary
      if (!isCurrent()) return "STALE"
      let view = await buffer.read(ownerId, documentId)
      boundary = localBoundary()
      if (boundary) return boundary
      if (!isCurrent()) return "STALE"
      if (!view) return "PENDING"
      if (view.blocked) return "CONFLICT"
      if (view.state === "DRAFT_ACKNOWLEDGED") return "SAVED"
      if (!view.pending) {
        await buffer.queue(ownerId, documentId, crypto.randomUUID())
        boundary = localBoundary()
        if (boundary) return boundary
        if (!isCurrent()) return "STALE"
        view = await buffer.read(ownerId, documentId)
      }
      boundary = localBoundary()
      if (boundary) return boundary
      if (!isCurrent()) return "STALE"
      const pending = view?.pending
      if (!pending) return "PENDING"
      if (pending.rejection) return pending.rejection
      const result = await send(pending.mutation ? { ...pending.mutation, documentId,
        operationId: pending.operationId, expectedRevision: pending.expectedRevision } : { action: "save", documentId, operationId: pending.operationId,
        ...(pending.writePurpose ? { writePurpose: pending.writePurpose } : {}),
        expectedRevision: pending.expectedRevision, document: pending.draft })
      boundary = localBoundary()
      if (boundary) return boundary
      if (!isCurrent()) return "STALE"
      if (!result.ok) {
        if (!isAccountJournalWriteRejection(result.code)) return "PENDING"
        const rejected = await buffer.reject?.(ownerId, documentId, pending.operationId, result.code)
        boundary = localBoundary()
        if (boundary) return boundary
        if (rejected === false) continue
        return isCurrent() ? result.code : "STALE"
      }
      if (result.data.kind === "conflict") {
        if (result.data.documentId !== documentId || result.data.operationId !== pending.operationId) return "PENDING"
        await buffer.conflict(ownerId, documentId, pending.operationId, result.data.currentRevision)
        return localBoundary() ?? (isCurrent() ? "CONFLICT" : "STALE")
      }
      if (result.data.kind !== "saved" || result.data.documentId !== documentId
        || result.data.operationId !== pending.operationId
        || result.data.revision !== pending.expectedRevision + 1) return "PENDING"
      const acknowledged = await buffer.ack(ownerId, documentId, pending.operationId, result.data.revision)
      boundary = localBoundary()
      if (boundary) return boundary
      if (!isCurrent()) return "STALE"
      if (!acknowledged) return "PENDING"
      onAcknowledged?.(pending.draft, result.data.revision)
    }
    return "PENDING"
  } catch (error) {
    // Native-IDB owner disposal can reject a pending read/transaction. It is a
    // terminal deletion, not an ordinary offline retry or a discarded draft.
    const boundary = localBoundary()
    if (boundary) return boundary
    throw error
  }
}
