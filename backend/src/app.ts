import { Hono } from "hono"
import { D1JournalSyncRepository } from "./d1-journal-repository"
import {
  IdempotencyKeyReusedError,
  syncJournalBatch,
} from "./journal-sync"
import type { JournalSyncRepository } from "./journal-sync"
import { journalSyncBatchSchema } from "./schemas"

const MAX_SYNC_BODY_BYTES = 128 * 1_024

export type Bindings = Readonly<{
  DB: D1Database
}>

export type IdentityResolution =
  | Readonly<{ status: "not_configured" }>
  | Readonly<{ status: "unauthenticated" }>
  | Readonly<{
      status: "authenticated"
      tenantId: string
      accountId: string
      journalSyncConsentGranted: boolean
    }>

type AppDependencies = Readonly<{
  repository: (bindings: Bindings) => JournalSyncRepository
  resolveIdentity: (
    request: Request,
    bindings: Bindings,
  ) => Promise<IdentityResolution>
}>

const defaultDependencies: AppDependencies = {
  repository: (bindings) => new D1JournalSyncRepository(bindings.DB),
  resolveIdentity: async () => ({ status: "not_configured" }),
}

export function createApp(
  overrides: Partial<AppDependencies> = {},
): Hono<{ Bindings: Bindings }> {
  const dependencies: AppDependencies = {
    repository: overrides.repository ?? defaultDependencies.repository,
    resolveIdentity: overrides.resolveIdentity ?? defaultDependencies.resolveIdentity,
  }
  const app = new Hono<{ Bindings: Bindings }>()

  app.get("/health", (context) => context.json({
    service: "trainoracle-account-backend",
    status: "ok",
    journalSync: "auth_required",
  }))

  app.post("/v1/journal/sync", async (context) => {
    const identity = await dependencies.resolveIdentity(context.req.raw, context.env)
    switch (identity.status) {
      case "not_configured":
        return context.json({ code: "AUTH_NOT_CONFIGURED" }, 503)
      case "unauthenticated":
        return context.json({ code: "AUTHENTICATION_REQUIRED" }, 401)
      case "authenticated":
        if (!identity.journalSyncConsentGranted) {
          return context.json({ code: "SYNC_CONSENT_REQUIRED" }, 403)
        }
        break
    }

    const contentType = context.req.header("Content-Type")
      ?.split(";")[0]
      ?.trim()
      .toLowerCase()
    if (contentType !== "application/json") {
      return context.json({ code: "JSON_CONTENT_TYPE_REQUIRED" }, 415)
    }

    const declaredLength = Number(context.req.header("Content-Length"))
    if (Number.isFinite(declaredLength) && declaredLength > MAX_SYNC_BODY_BYTES) {
      return context.json({ code: "SYNC_PAYLOAD_TOO_LARGE" }, 413)
    }

    let candidate: unknown
    try {
      const body = await context.req.text()
      if (new TextEncoder().encode(body).byteLength > MAX_SYNC_BODY_BYTES) {
        return context.json({ code: "SYNC_PAYLOAD_TOO_LARGE" }, 413)
      }
      candidate = JSON.parse(body)
    } catch {
      return context.json({ code: "INVALID_SYNC_PAYLOAD" }, 400)
    }

    const parsed = journalSyncBatchSchema.safeParse(candidate)
    if (!parsed.success) {
      return context.json({ code: "INVALID_SYNC_PAYLOAD" }, 400)
    }

    try {
      const result = await syncJournalBatch(
        { tenantId: identity.tenantId, accountId: identity.accountId },
        parsed.data,
        dependencies.repository(context.env),
      )
      return result.status === "accepted"
        ? context.json(result, 201)
        : context.json(result, 200)
    } catch (error: unknown) {
      if (error instanceof IdempotencyKeyReusedError) {
        return context.json({ code: "IDEMPOTENCY_KEY_REUSED" }, 409)
      }
      throw error
    }
  })

  app.onError((_error, context) => context.json({ code: "INTERNAL_ERROR" }, 500))

  return app
}
