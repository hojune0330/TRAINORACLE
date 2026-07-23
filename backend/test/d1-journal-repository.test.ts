import { env } from "cloudflare:test"
import { beforeEach, describe, expect, it } from "vitest"
import { D1JournalSyncRepository } from "../src/d1-journal-repository"
import { syncJournalBatch } from "../src/journal-sync"
import type { JournalSyncBatch } from "../src/schemas"

const scope = {
  tenantId: "tenant-integration",
  accountId: "account-integration",
} as const

const batch: JournalSyncBatch = {
  schemaVersion: 1,
  batchId: "batch_d1_integration",
  entries: [
    {
      journalId: "entry_d1_integration",
      kind: "evening",
      date: "2026-07-23",
      savedAt: "2026-07-23T22:30:00+09:00",
      memoServerState: "local_only",
      fields: {
        sleepH: { value: 7.5, provenance: "EXPLICIT" },
        mood: { value: 4, provenance: "EXPLICIT" },
      },
    },
  ],
}

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM structured_journal_entries"),
    env.DB.prepare("DELETE FROM journal_sync_batches"),
  ])
})

describe("D1 journal repository", () => {
  it("persists only the structured projection and replays an exact retry", async () => {
    const repository = new D1JournalSyncRepository(env.DB)

    const first = await syncJournalBatch(scope, batch, repository)
    const retry = await syncJournalBatch(scope, batch, repository)
    const row = await env.DB.prepare(`
      SELECT memo_server_state, fields_json
      FROM structured_journal_entries
      WHERE tenant_id = ?1 AND account_id = ?2 AND journal_id = ?3
    `).bind(scope.tenantId, scope.accountId, batch.entries[0]?.journalId).first<{
      memo_server_state: string
      fields_json: string
    }>()

    expect(first.status).toBe("accepted")
    expect(retry.status).toBe("already_accepted")
    expect(row?.memo_server_state).toBe("local_only")
    expect(row?.fields_json).toBe(JSON.stringify(batch.entries[0]?.fields))
    expect(row?.fields_json).not.toMatch(/memo|note|symptom|title/iu)
  })

  it("keeps identical IDs independent across authenticated scopes", async () => {
    const repository = new D1JournalSyncRepository(env.DB)
    const otherScope = {
      tenantId: "tenant-other",
      accountId: "account-other",
    } as const

    await syncJournalBatch(scope, batch, repository)
    await syncJournalBatch(otherScope, batch, repository)
    const count = await env.DB.prepare(`
      SELECT COUNT(*) AS total
      FROM structured_journal_entries
      WHERE journal_id = ?1
    `).bind(batch.entries[0]?.journalId).first<{ total: number }>()

    expect(count?.total).toBe(2)
  })
})
