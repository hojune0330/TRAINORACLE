import { z } from "zod"
import { supabase } from "./supabase-client"
import { activeLocalAccount } from "./local-journal-ownership"
import { accountJournalDraftSchema } from "./account-journal-draft-buffer"
import { isAccountJournalWriteRejection, type AccountJournalWriteRejection } from "./account-write-rejection"
import type { AccountJournalDraft } from "./account-journal-draft-buffer"

export function accountJournalPreviewEnabled(env: Readonly<Record<string, unknown>> = import.meta.env) {
  return env.VITE_FEATURE_ACCOUNT_JOURNAL === "true" && env.VITE_KILL_ACCOUNT_JOURNAL !== "true"
}

const revision = z.number().int().positive().max(Number.MAX_SAFE_INTEGER - 1)
function responseSchema<T>(schema: z.ZodType<T>) {
const document = z.object({ documentId: z.uuid(), revision, document: schema }).strict()
return z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("ready") }).strict(),
  document.extend({ kind: z.literal("document") }),
  z.object({ kind: z.literal("list"), documents: z.array(document).max(50), nextCursor: z.uuid().nullable(),
    deletedDocuments: z.array(z.object({ documentId: z.uuid(), revision }).strict()).max(50).optional() }).strict(),
  z.object({ kind: z.literal("deleted"), documentId: z.uuid(), revision, operationId: z.uuid().optional() }).strict(),
  z.object({ kind: z.literal("restored"), documentId: z.uuid(), revision, operationId: z.uuid(), sourceRevision: revision }).strict(),
  z.object({ kind: z.literal("history"), documentId: z.uuid(), versions: z.array(z.object({
    revision, document: schema, replacedAt: z.string(), expiresAt: z.string(), reason: z.enum(["replaced", "trash"]),
  }).strict()) }).strict(),
  z.object({ kind: z.literal("saved"), documentId: z.uuid(), operationId: z.uuid(), revision }).strict(),
  z.object({ kind: z.literal("conflict"), documentId: z.uuid(), operationId: z.uuid(),
    currentRevision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER - 1) }).strict(),
])
}

export type AccountJournalResponse<T = AccountJournalDraft> =
  | { kind: "ready" }
  | { kind: "document"; documentId: string; revision: number; document: T }
  | { kind: "list"; documents: { documentId: string; revision: number; document: T }[]; nextCursor: string | null; deletedDocuments?: { documentId: string; revision: number }[] }
  | { kind: "deleted"; documentId: string; revision: number; operationId?: string }
  | { kind: "restored"; documentId: string; revision: number; operationId: string; sourceRevision: number }
  | { kind: "history"; documentId: string; versions: { revision: number; document: T; replacedAt: string; expiresAt: string; reason: "replaced" | "trash" }[] }
  | { kind: "saved"; documentId: string; operationId: string; revision: number }
  | { kind: "conflict"; documentId: string; operationId: string; currentRevision: number }
export type AccountJournalRequest<T = AccountJournalDraft> =
  | { action: "status" }
  | { action: "list"; cursor?: string; collection?: "JOURNAL" }
  | { action: "read"; documentId: string }
  | { action: "history"; documentId: string; collection?: "JOURNAL" }
  | { action: "delete"; documentId: string; operationId: string; expectedRevision: number }
  | { action: "restore"; documentId: string; operationId: string; expectedRevision: number; sourceRevision: number }
  | { action: "save"; documentId: string; operationId: string; expectedRevision: number;
      document: T; writePurpose?: "MIGRATION" }

export type AccountJournalResult<T = AccountJournalDraft> =
  | { ok: true; data: AccountJournalResponse<T> }
  | { ok: false; code: "AUTH_REQUIRED" | "ACCESS_DENIED" | "NOT_FOUND" | "UNAVAILABLE" | "INVALID_RESPONSE" | "STALE_RESPONSE" | "CONFLICT" | AccountJournalWriteRejection }

export async function requestAccountJournal(
  ownerId: string, request: AccountJournalRequest,
  isCurrent: () => boolean,
  dependencies: { client: typeof supabase; owner: typeof activeLocalAccount } = { client: supabase, owner: activeLocalAccount },
): Promise<AccountJournalResult> {
  return requestAccountDocument(ownerId, request, isCurrent, accountJournalDraftSchema, dependencies)
}

export async function requestAccountDocument<T>(
  ownerId: string, request: AccountJournalRequest<T>, isCurrent: () => boolean, schema: z.ZodType<T>,
  dependencies: { client: typeof supabase; owner: typeof activeLocalAccount } = { client: supabase, owner: activeLocalAccount },
): Promise<AccountJournalResult<T>> {
  const current = () => isCurrent() && dependencies.owner() === ownerId
  if (!current()) return { ok: false, code: "STALE_RESPONSE" }
  try {
    const client = await dependencies.client()
    if (!current()) return { ok: false, code: "STALE_RESPONSE" }
    if (!client) return { ok: false, code: "UNAVAILABLE" }
    const session = await client.auth.getSession()
    if (!current()) return { ok: false, code: "STALE_RESPONSE" }
    const token = session.data.session?.access_token
    if (session.error || session.data.session?.user.id !== ownerId || typeof token !== "string"
      || token.trim() !== token || !/^[A-Za-z0-9._~+\/-]+=*$/u.test(token)) return { ok: false, code: "AUTH_REQUIRED" }
    // The SDK rereads auth before fetch; never let a later session select this request's owner.
    const { data, error } = await client.functions.invoke("account-journal", {
      body: request, headers: { Authorization: `Bearer ${token}` },
    })
    let responseData: unknown = data
    if (!current()) return { ok: false, code: "STALE_RESPONSE" }
    if (error) {
      const status = error.context instanceof Response ? error.context.status : 0
      if (status === 409 && ["save", "delete", "restore"].includes(request.action)) {
        responseData = await error.context.clone().json()
        if (!current()) return { ok: false, code: "STALE_RESPONSE" }
        const rejection = (responseData as { error?: unknown })?.error
        if (isAccountJournalWriteRejection(rejection)) return { ok: false, code: rejection }
        if ((responseData as { kind?: unknown })?.kind !== "conflict") return { ok: false, code: "CONFLICT" }
      } else return { ok: false, code: status === 401 ? "AUTH_REQUIRED" : status === 403 ? "ACCESS_DENIED"
        : status === 404 && request.action === "read" ? "NOT_FOUND" : "UNAVAILABLE" }
    }
    const parsed = responseSchema(schema).safeParse(responseData)
    if (!parsed.success) return { ok: false, code: "INVALID_RESPONSE" }
    const result = parsed.data as AccountJournalResponse<T>
    const correctKind = request.action === "status" ? result.kind === "ready"
      : request.action === "list" ? result.kind === "list"
      : request.action === "read" ? (result.kind === "document" || result.kind === "deleted") && result.documentId === request.documentId
      : request.action === "history" ? result.kind === "history" && result.documentId === request.documentId
      : request.action === "delete" || request.action === "restore"
        ? (result.kind === "conflict" || request.action === "delete" && result.kind === "deleted" || request.action === "restore" && result.kind === "restored")
          && result.documentId === request.documentId && result.operationId === request.operationId
          && (result.kind === "conflict" || result.revision === request.expectedRevision + 1)
          && (result.kind !== "restored" || request.action === "restore" && result.sourceRevision === request.sourceRevision)
      : (result.kind === "saved" || result.kind === "conflict")
        && result.documentId === request.documentId && result.operationId === request.operationId
        && (result.kind !== "saved" || result.revision === request.expectedRevision + 1)
    return correctKind ? { ok: true, data: result } : { ok: false, code: "INVALID_RESPONSE" }
  } catch { return { ok: false, code: current() ? "UNAVAILABLE" : "STALE_RESPONSE" } }
}
