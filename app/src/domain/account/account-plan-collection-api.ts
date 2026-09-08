import { z } from "zod"
import { supabase } from "./supabase-client"
import { activeLocalAccount } from "./local-journal-ownership"
import { requestAccountDocument } from "./account-journal-api"
import { accountPlanDocumentId } from "./account-plan-service"
import { validateAccountPlanDocument, type AccountPlanDocument } from "./account-plan-document-schema"
import { validateAccountPlanCollectionIndex, validateAccountPlanCollectionPart,
  type AccountPlanCollectionIndex } from "./account-plan-collection-schema"
import type { AccountPlanCollectionPort } from "./account-plan-collection-transfer"

export class AccountPlanCollectionError extends Error {
  constructor(readonly code: "AUTH_REQUIRED" | "STALE" | "INVALID" | "UNAVAILABLE" | "CONFLICT" | "REJECTED") {
    super(code)
  }
}
const revision = z.number().int().positive().max(Number.MAX_SAFE_INTEGER - 1)
const receiptSchema = z.object({ ownerId: z.uuid(), operationId: z.uuid(), revision,
  indexFingerprint: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
  requestFingerprint: z.string().regex(/^sha256:[a-f0-9]{64}$/u) }).strict()
const responseSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("missing") }).strict(),
  z.object({ kind: z.literal("staged") }).strict(),
  z.object({ kind: z.literal("index"), revision, index: z.custom<AccountPlanCollectionIndex>(validateAccountPlanCollectionIndex) }).strict(),
  z.object({ kind: z.literal("part"), part: z.custom<Parameters<AccountPlanCollectionPort["stage"]>[1]>(validateAccountPlanCollectionPart) }).strict(),
  z.object({ kind: z.literal("receipt"), receipt: receiptSchema }).strict(),
  z.object({ kind: z.literal("committed"), receipt: receiptSchema }).strict(),
  z.object({ kind: z.literal("conflict") }).strict(),
])
export interface AccountPlanCollectionClient extends AccountPlanCollectionPort {
  readPart(ownerId: string, kind: Parameters<AccountPlanCollectionPort["readPart"]>[1], id: string, signal?: AbortSignal): Promise<unknown | null>
  readIndex(): Promise<{ revision: number; index: AccountPlanCollectionIndex } | null>
  readLegacy(): Promise<{ documentId: string; revision: number; document: AccountPlanDocument } | null>
}

export function createAccountPlanCollectionClient(ownerId: string, isCurrent: () => boolean,
  dependencies: { client: typeof supabase; owner: typeof activeLocalAccount } = { client: supabase, owner: activeLocalAccount },
): AccountPlanCollectionClient {
  const current = () => isCurrent() && dependencies.owner() === ownerId
  const check = (requestedOwner = ownerId) => {
    if (requestedOwner !== ownerId || !current()) throw new AccountPlanCollectionError("STALE")
  }
  async function invoke(body: object, signal?: AbortSignal) {
    const checkRequest = () => { check(); if (signal?.aborted) throw new AccountPlanCollectionError("STALE") }
    checkRequest()
    const captured = structuredClone(body)
    try {
      const client = await dependencies.client(); checkRequest()
      if (!client) throw new AccountPlanCollectionError("UNAVAILABLE")
      const session = await client.auth.getSession(); checkRequest()
      const token = session.data.session?.access_token
      if (session.error || session.data.session?.user.id !== ownerId || typeof token !== "string" || !token.trim())
        throw new AccountPlanCollectionError("AUTH_REQUIRED")
      const { data, error } = await client.functions.invoke("account-plan-collection", {
        body: captured, headers: { Authorization: `Bearer ${token}` }, timeout: 30_000,
        ...(signal ? { signal } : {}),
      }); checkRequest()
      let value: unknown = data
      if (error) {
        const status = error.context instanceof Response ? error.context.status : 0
        if (status === 409 && "action" in captured && captured.action === "commit") {
          value = await error.context.clone().json(); check()
          if ((value as { kind?: unknown })?.kind !== "conflict") throw new AccountPlanCollectionError("REJECTED")
        } else throw new AccountPlanCollectionError(status === 401 ? "AUTH_REQUIRED"
          : [400, 405, 413, 415, 422].includes(status) ? "INVALID"
            : [403, 409].includes(status) ? "REJECTED" : "UNAVAILABLE")
      }
      const parsed = responseSchema.safeParse(value)
      if (!parsed.success) throw new AccountPlanCollectionError("INVALID")
      return parsed.data
    } catch (error) {
      if (!current()) throw new AccountPlanCollectionError("STALE")
      if (error instanceof AccountPlanCollectionError) throw error
      throw new AccountPlanCollectionError("UNAVAILABLE")
    }
  }
  const invalid = (): never => { throw new AccountPlanCollectionError("INVALID") }
  return {
    async readIndex() {
      const result = await invoke({ action: "readIndex" })
      if (result.kind === "missing") return null
      return result.kind === "index" ? { revision: result.revision, index: result.index } : invalid()
    },
    async readPart(requestedOwner, partKind, partId, signal) {
      check(requestedOwner)
      const result = await invoke({ action: "readPart", partKind, partId }, signal)
      if (result.kind === "missing") return null
      return result.kind === "part" && result.part.kind === partKind && result.part.id === partId ? result.part : invalid()
    },
    async receipt(requestedOwner, operationId) {
      check(requestedOwner)
      const result = await invoke({ action: "receipt", operationId })
      return result.kind === "missing" ? null : result.kind === "receipt"
        && result.receipt.ownerId === ownerId && result.receipt.operationId === operationId ? result.receipt : invalid()
    },
    async stage(requestedOwner, part) {
      check(requestedOwner)
      if (!validateAccountPlanCollectionPart(part)) invalid()
      if ((await invoke({ action: "stage", ownerId, part })).kind !== "staged") invalid()
    },
    async commit(request) {
      check(request.ownerId)
      const result = await invoke({ action: "commit", request })
      return result.kind === "conflict" || result.kind === "committed" ? result : invalid()
    },
    async readLegacy() {
      check()
      const documentId = await accountPlanDocumentId(ownerId); check()
      const result = await requestAccountDocument(ownerId, { action: "read", documentId }, current,
        z.custom<AccountPlanDocument>(validateAccountPlanDocument), dependencies)
      check()
      if (!result.ok) {
        if (result.code === "NOT_FOUND") return null
        throw new AccountPlanCollectionError(result.code === "AUTH_REQUIRED" ? "AUTH_REQUIRED" : "UNAVAILABLE")
      }
      if (result.data.kind !== "document") return invalid()
      return { documentId, revision: result.data.revision, document: result.data.document }
    },
  }
}
