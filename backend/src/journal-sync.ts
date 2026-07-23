import type { JournalSyncBatch, StructuredJournalEntry } from "./schemas"

export type SyncScope = Readonly<{
  tenantId: string
  accountId: string
}>

export type StoredSyncBatch = Readonly<{
  batchId: string
  requestHash: string
  acknowledgedJournalIds: readonly string[]
  receivedAt: string
}>

export interface JournalSyncRepository {
  findBatch(scope: SyncScope, batchId: string): Promise<StoredSyncBatch | null>
  commitBatch(
    scope: SyncScope,
    batch: StoredSyncBatch,
    entries: readonly StructuredJournalEntry[],
  ): Promise<void>
}

type JournalAcknowledgement = Readonly<{
  journalId: string
  syncState: "synced"
}>

export type JournalSyncResult =
  | Readonly<{
      status: "accepted"
      acknowledged: readonly JournalAcknowledgement[]
    }>
  | Readonly<{
      status: "already_accepted"
      acknowledged: readonly JournalAcknowledgement[]
    }>

export class IdempotencyKeyReusedError extends Error {
  constructor() {
    super("The idempotency key was already used for different content.")
    this.name = "IdempotencyKeyReusedError"
  }
}

function acknowledge(journalIds: readonly string[]): readonly JournalAcknowledgement[] {
  return journalIds.map((journalId) => ({ journalId, syncState: "synced" }))
}

async function hashBatch(batch: JournalSyncBatch): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(batch))
  const digest = await crypto.subtle.digest("SHA-256", bytes)
  return Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("")
}

export async function syncJournalBatch(
  scope: SyncScope,
  batch: JournalSyncBatch,
  repository: JournalSyncRepository,
): Promise<JournalSyncResult> {
  const requestHash = await hashBatch(batch)
  const existing = await repository.findBatch(scope, batch.batchId)
  if (existing !== null) {
    if (existing.requestHash !== requestHash) throw new IdempotencyKeyReusedError()
    return {
      status: "already_accepted",
      acknowledged: acknowledge(existing.acknowledgedJournalIds),
    }
  }

  const acknowledgedJournalIds = batch.entries.map(({ journalId }) => journalId)
  const storedBatch: StoredSyncBatch = {
    batchId: batch.batchId,
    requestHash,
    acknowledgedJournalIds,
    receivedAt: new Date().toISOString(),
  }
  await repository.commitBatch(scope, storedBatch, batch.entries)

  return {
    status: "accepted",
    acknowledged: acknowledge(acknowledgedJournalIds),
  }
}
