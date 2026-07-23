import { describe, expect, it } from "vitest"
import { createApp } from "../src/app"
import type {
  JournalSyncRepository,
  StoredSyncBatch,
  SyncScope,
} from "../src/journal-sync"
import type { StructuredJournalEntry } from "../src/schemas"

const CONTENT_TYPE_JSON = { "Content-Type": "application/json" } as const

const validPayload = {
  schemaVersion: 1,
  batchId: "batch_01JZJ9M8N6E5N9W8WQ7D4W2X1A",
  entries: [
    {
      journalId: "entry_01JZJ9NHPBRHT0QACW6XJMR6B3",
      kind: "post-session",
      date: "2026-07-23",
      savedAt: "2026-07-23T09:30:00+09:00",
      memoServerState: "local_only",
      fields: {
        distanceKm: { value: 8.5, provenance: "EXPLICIT" },
        durationMin: { value: 42, provenance: "EXPLICIT" },
        rpe: { value: 6, provenance: "EXPLICIT" },
      },
    },
  ],
} as const

class MemoryRepository implements JournalSyncRepository {
  readonly batches = new Map<string, StoredSyncBatch>()
  readonly entries: Array<{
    readonly scope: SyncScope
    readonly entry: StructuredJournalEntry
  }> = []

  async findBatch(scope: SyncScope, batchId: string): Promise<StoredSyncBatch | null> {
    return this.batches.get(this.key(scope, batchId)) ?? null
  }

  async commitBatch(
    scope: SyncScope,
    batch: StoredSyncBatch,
    entries: readonly StructuredJournalEntry[],
  ): Promise<void> {
    const key = this.key(scope, batch.batchId)
    if (this.batches.has(key)) throw new Error("duplicate batch")
    this.batches.set(key, batch)
    for (const entry of entries) this.entries.push({ scope, entry })
  }

  private key(scope: SyncScope, batchId: string): string {
    return `${scope.tenantId}:${scope.accountId}:${batchId}`
  }
}

function authenticatedApp(
  repository: JournalSyncRepository,
  overrides: Partial<{
    readonly tenantId: string
    readonly accountId: string
    readonly journalSyncConsentGranted: boolean
  }> = {},
) {
  return createApp({
    repository: () => repository,
    resolveIdentity: async () => ({
      status: "authenticated",
      tenantId: overrides.tenantId ?? "tenant-a",
      accountId: overrides.accountId ?? "account-a",
      journalSyncConsentGranted: overrides.journalSyncConsentGranted ?? true,
    }),
  })
}

async function postJson(app: ReturnType<typeof createApp>, payload: unknown): Promise<Response> {
  return app.request("/v1/journal/sync", {
    method: "POST",
    headers: CONTENT_TYPE_JSON,
    body: JSON.stringify(payload),
  })
}

describe("journal sync boundary", () => {
  it("fails closed when account identity is not configured", async () => {
    const response = await postJson(createApp(), validPayload)

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({ code: "AUTH_NOT_CONFIGURED" })
  })

  it("rejects sync when account consent is absent", async () => {
    const app = authenticatedApp(new MemoryRepository(), {
      journalSyncConsentGranted: false,
    })

    const response = await postJson(app, validPayload)

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({ code: "SYNC_CONSENT_REQUIRED" })
  })

  it("rejects non-JSON and oversized request bodies", async () => {
    const app = authenticatedApp(new MemoryRepository())
    const nonJson = await app.request("/v1/journal/sync", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "{}",
    })
    const oversized = await app.request("/v1/journal/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": "131073",
      },
      body: "{}",
    })

    expect(nonJson.status).toBe(415)
    expect(oversized.status).toBe(413)
  })

  it.each([
    ["raw memo", { ...validPayload.entries[0], memo: "private note" }],
    [
      "MISSING provenance",
      {
        ...validPayload.entries[0],
        fields: { rpe: { value: 0, provenance: "MISSING" } },
      },
    ],
    [
      "race self-check",
      {
        journalId: "entry_race",
        kind: "race",
        date: "2026-07-23",
        savedAt: "2026-07-23T09:30:00+09:00",
        memoServerState: "local_only",
        fields: { tension: { value: 4, provenance: "EXPLICIT" } },
      },
    ],
  ])("rejects %s at the server boundary", async (_name, entry) => {
    const app = authenticatedApp(new MemoryRepository())

    const response = await postJson(app, { ...validPayload, entries: [entry] })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ code: "INVALID_SYNC_PAYLOAD" })
  })

  it("acknowledges a structured batch and makes an exact retry idempotent", async () => {
    const repository = new MemoryRepository()
    const app = authenticatedApp(repository)

    const first = await postJson(app, validPayload)
    const retry = await postJson(app, validPayload)

    expect(first.status).toBe(201)
    expect(retry.status).toBe(200)
    await expect(first.json()).resolves.toMatchObject({
      status: "accepted",
      acknowledged: [{ journalId: validPayload.entries[0].journalId, syncState: "synced" }],
    })
    await expect(retry.json()).resolves.toMatchObject({ status: "already_accepted" })
    expect(repository.entries).toHaveLength(1)
    expect(JSON.stringify(repository.entries)).not.toContain("private note")
  })

  it("rejects reuse of an idempotency key with different content", async () => {
    const repository = new MemoryRepository()
    const app = authenticatedApp(repository)
    await postJson(app, validPayload)

    const response = await postJson(app, {
      ...validPayload,
      entries: [
        {
          ...validPayload.entries[0],
          fields: { rpe: { value: 9, provenance: "EXPLICIT" } },
        },
      ],
    })

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ code: "IDEMPOTENCY_KEY_REUSED" })
  })

  it("rejects duplicate journal IDs inside one batch", async () => {
    const app = authenticatedApp(new MemoryRepository())

    const response = await postJson(app, {
      ...validPayload,
      entries: [validPayload.entries[0], validPayload.entries[0]],
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ code: "INVALID_SYNC_PAYLOAD" })
  })

  it("scopes identical batch identifiers to the authenticated tenant and account", async () => {
    const repository = new MemoryRepository()
    const firstApp = authenticatedApp(repository)
    const secondApp = authenticatedApp(repository, {
      tenantId: "tenant-b",
      accountId: "account-b",
    })

    const first = await postJson(firstApp, validPayload)
    const second = await postJson(secondApp, validPayload)

    expect(first.status).toBe(201)
    expect(second.status).toBe(201)
    expect(repository.entries).toHaveLength(2)
    expect(repository.entries.map(({ scope }) => scope.tenantId)).toEqual([
      "tenant-a",
      "tenant-b",
    ])
  })
})
