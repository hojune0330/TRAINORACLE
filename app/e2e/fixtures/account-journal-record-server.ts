import type { BrowserContext, Page } from "@playwright/test"
import type { AccountJournalRequest } from "../../src/domain/account/account-journal-api"
import type { AccountJournalRecord } from "../../src/domain/account/account-journal-record-schema"

const origin = "http://127.0.0.1:4381"
type Request = AccountJournalRequest<AccountJournalRecord>
type Stored = { documentId: string; revision: number; document: AccountJournalRecord }
type Version = { revision: number; document: AccountJournalRecord; replacedAt: string; expiresAt: string; reason: "replaced" | "trash" }

// Mock only authentication/HTTP. The real generic API, schema, sync and native
// encrypted IndexedDB buffer remain in the browser module graph.
export function mockRecordServer() {
  const documents = new Map<string, Stored>()
  const tombstones = new Map<string, { documentId: string; revision: number }>()
  const history = new Map<string, Version[]>()
  const receipts = new Map<string, { request: string; result: unknown }>()
  const calls: { ownerId: string; request: Request }[] = []
  let failSave = false
  let loseNextReceipt: Request["action"] | null = null
  let hold: { action: Request["action"]; release: Promise<void> } | null = null
  return {
    documents, tombstones, history, calls,
    offline(value: boolean) { failSave = value },
    loseReceipt(action: Request["action"] = "save") { loseNextReceipt = action },
    holdNext(action: Request["action"]) {
      let release!: () => void
      hold = { action, release: new Promise<void>(resolve => { release = resolve }) }
      return release
    },
    async install(context: BrowserContext) {
      await context.route("**/*", async route => {
        const url = new URL(route.request().url())
        if (url.origin !== origin) return route.abort()
        if (url.pathname === "/__account_record_test__") {
          return route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Native record service test</title>" })
        }
        if (url.pathname === "/src/domain/account/account-journal-api.ts") {
          const response = await route.fetch()
          const body = await response.text()
          const flag = 'return env.VITE_FEATURE_ACCOUNT_JOURNAL === "true" && env.VITE_KILL_ACCOUNT_JOURNAL !== "true";'
          if (body.split(flag).length !== 2) throw new Error("Feature flag route no longer matches; do not silently bypass the real API")
          return route.fulfill({ response, body: body.replace(flag, "return globalThis.__accountRecordFeatureEnabled !== false;") })
        }
        if (url.pathname === "/src/domain/account/supabase-client.ts") {
          return route.fulfill({ contentType: "application/javascript", body: `
            import { activeLocalAccount } from '/src/domain/account/local-journal-ownership.ts';
            export async function supabase() {
              return {
                auth: { getSession: async () => ({ data: { session: { user: { id: activeLocalAccount() } } }, error: null }) },
                functions: { invoke: async (_name, options) => {
                  const response = await fetch('/__record_api__', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ownerId: activeLocalAccount(), request: options.body }) });
                  return response.ok ? { data: await response.json(), error: null } : { data: null, error: { context: response } };
                } }
              };
            }
            export function __resetSupabaseForTest() {}
          ` })
        }
        if (url.pathname !== "/__record_api__") return route.continue()
        const { ownerId, request } = route.request().postDataJSON() as { ownerId: string; request: Request }
        calls.push({ ownerId, request })
        const paused = hold?.action === request.action ? hold : null
        if (paused) hold = null
        const key = "documentId" in request ? `${ownerId}:${request.documentId}` : ""
        let status = 200
        let result: unknown
        if (request.action === "list") {
          result = { kind: "list", documents: [...documents.entries()].filter(([key]) => key.startsWith(`${ownerId}:`)).map(([, value]) => structuredClone(value)),
            deletedDocuments: [...tombstones.entries()].filter(([key]) => key.startsWith(`${ownerId}:`)).map(([, value]) => structuredClone(value)), nextCursor: null }
        } else if (request.action === "read") {
          const current = documents.get(key)
          const deleted = tombstones.get(key)
          if (current) result = { kind: "document", ...structuredClone(current) }
          else if (deleted) result = { kind: "deleted", ...deleted }
          else { status = 404; result = { code: "NOT_FOUND" } }
        } else if (request.action === "history") {
          result = { kind: "history", documentId: request.documentId, versions: structuredClone(history.get(key) ?? []) }
        } else if (request.action === "save" || request.action === "delete" || request.action === "restore") {
          if (failSave) { status = 503; result = { code: "UNAVAILABLE" } }
          else {
            const receiptKey = `${ownerId}:${request.operationId}`
            const prior = receipts.get(receiptKey)
            if (prior) {
              if (prior.request !== JSON.stringify(request)) { status = 409; result = { code: "OPERATION_REUSED" } }
              else result = prior.result
            } else {
              const old = documents.get(key)
              const current = old?.revision ?? tombstones.get(key)?.revision ?? 0
              const source = request.action === "restore" ? history.get(key)?.find(version => version.revision === request.sourceRevision) : undefined
              if (current !== request.expectedRevision) {
                status = 409
                result = { kind: "conflict", documentId: request.documentId, operationId: request.operationId, currentRevision: current }
              } else if (request.action === "restore" && !source) {
                status = 409; result = { code: "SOURCE_UNAVAILABLE" }
              } else {
                if (old) history.set(key, [...(history.get(key) ?? []), { revision: old.revision, document: structuredClone(old.document),
                  replacedAt: "2026-09-08T00:00:00.000Z", expiresAt: "2026-10-08T00:00:00.000Z",
                  reason: request.action === "delete" ? "trash" : "replaced" }])
                if (request.action === "delete") {
                  documents.delete(key)
                  tombstones.set(key, { documentId: request.documentId, revision: current + 1 })
                } else {
                  documents.set(key, { documentId: request.documentId, revision: current + 1,
                    document: structuredClone(request.action === "save" ? request.document : source!.document) })
                  tombstones.delete(key)
                }
                result = { kind: request.action === "save" ? "saved" : request.action === "delete" ? "deleted" : "restored",
                  documentId: request.documentId, operationId: request.operationId, revision: current + 1,
                  ...(request.action === "restore" ? { sourceRevision: request.sourceRevision } : {}) }
                receipts.set(receiptKey, { request: JSON.stringify(request), result })
              }
            }
            if (loseNextReceipt === request.action) { loseNextReceipt = null; status = 503; result = { code: "UNAVAILABLE" } }
          }
        } else { status = 400; result = { code: "UNSUPPORTED_TEST_ACTION" } }
        if (paused) await paused.release
        await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(result) })
      })
    },
  }
}

export async function loadRecordHarness(page: Page, ownerId?: string) {
  await page.goto(`${origin}/__account_record_test__`)
  await page.evaluate(async ownerId => {
    const path = "/e2e/fixtures/account-journal-record-service.ts"
    const fixture = await import(/* @vite-ignore */ path)
    fixture.setup(ownerId)
  }, ownerId)
}
