import { z } from "zod"
import type {
  JournalSyncRepository,
  StoredSyncBatch,
  SyncScope,
} from "./journal-sync"
import type { StructuredJournalEntry } from "./schemas"

type BatchRow = Readonly<{
  request_hash: string
  acknowledged_ids_json: string
  received_at: string
}>

const acknowledgedIdsSchema = z.array(z.string().min(1).max(128)).readonly()

export class D1JournalSyncRepository implements JournalSyncRepository {
  constructor(private readonly database: D1Database) {}

  async findBatch(scope: SyncScope, batchId: string): Promise<StoredSyncBatch | null> {
    const row = await this.database.prepare(`
      SELECT request_hash, acknowledged_ids_json, received_at
      FROM journal_sync_batches
      WHERE tenant_id = ?1 AND account_id = ?2 AND batch_id = ?3
    `).bind(scope.tenantId, scope.accountId, batchId).first<BatchRow>()
    if (row === null) return null

    const parsedIds = acknowledgedIdsSchema.safeParse(
      JSON.parse(row.acknowledged_ids_json),
    )
    if (!parsedIds.success) throw new Error("Stored sync acknowledgement is invalid.")

    return {
      batchId,
      requestHash: row.request_hash,
      acknowledgedJournalIds: parsedIds.data,
      receivedAt: row.received_at,
    }
  }

  async commitBatch(
    scope: SyncScope,
    batch: StoredSyncBatch,
    entries: readonly StructuredJournalEntry[],
  ): Promise<void> {
    const statements: D1PreparedStatement[] = [
      this.database.prepare(`
        INSERT INTO journal_sync_batches (
          tenant_id,
          account_id,
          batch_id,
          request_hash,
          acknowledged_ids_json,
          received_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
      `).bind(
        scope.tenantId,
        scope.accountId,
        batch.batchId,
        batch.requestHash,
        JSON.stringify(batch.acknowledgedJournalIds),
        batch.receivedAt,
      ),
    ]

    for (const entry of entries) {
      statements.push(this.database.prepare(`
        INSERT INTO structured_journal_entries (
          tenant_id,
          account_id,
          journal_id,
          kind,
          journal_date,
          saved_at,
          memo_server_state,
          fields_json,
          sync_batch_id,
          created_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
      `).bind(
        scope.tenantId,
        scope.accountId,
        entry.journalId,
        entry.kind,
        entry.date,
        entry.savedAt,
        entry.memoServerState,
        JSON.stringify(entry.fields),
        batch.batchId,
        batch.receivedAt,
      ))
    }

    await this.database.batch(statements)
  }
}
