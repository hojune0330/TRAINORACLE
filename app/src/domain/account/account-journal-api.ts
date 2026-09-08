import { z } from "zod"
import { supabase } from "./supabase-client"
import { activeLocalAccount } from "./local-journal-ownership"
import { accountJournalDraftSchema } from "./account-journal-draft-buffer"

export function accountJournalPreviewEnabled(env: Readonly<Record<string, unknown>> = import.meta.env) {
  return env.VITE_FEATURE_ACCOUNT_JOURNAL === "true" && env.VITE_KILL_ACCOUNT_JOURNAL !== "true"
}

const revision = z.number().int().positive().max(Number.MAX_SAFE_INTEGER - 1)
const document = z.object({ documentId: z.uuid(), revision, document: accountJournalDraftSchema }).strict()
const responseSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("ready") }).strict(),
  document.extend({ kind: z.literal("document") }),
  z.object({ kind: z.literal("list"), documents: z.array(document).max(50), nextCursor: z.uuid().nullable() }).strict(),
  z.object({ kind: z.literal("saved"), documentId: z.uuid(), operationId: z.uuid(), revision }).strict(),
  z.object({ kind: z.literal("conflict"), documentId: z.uuid(), operationId: z.uuid(),
    currentRevision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER - 1) }).strict(),
])

export type AccountJournalResponse = z.infer<typeof responseSchema>
export type AccountJournalRequest =
  | { action: "status" }
  | { action: "list"; cursor?: string }
  | { action: "read"; documentId: string }
  | { action: "save"; documentId: string; operationId: string; expectedRevision: number;
      document: z.infer<typeof accountJournalDraftSchema> }

export type AccountJournalResult =
  | { ok: true; data: AccountJournalResponse }
  | { ok: false; code: "AUTH_REQUIRED" | "ACCESS_DENIED" | "UNAVAILABLE" | "INVALID_RESPONSE" | "STALE_RESPONSE" | "CONFLICT" }

export async function requestAccountJournal(
  ownerId: string, request: AccountJournalRequest,
  isCurrent: () => boolean,
  dependencies: { client: typeof supabase; owner: typeof activeLocalAccount } = { client: supabase, owner: activeLocalAccount },
): Promise<AccountJournalResult> {
  const current = () => isCurrent() && dependencies.owner() === ownerId
  if (!current()) return { ok: false, code: "STALE_RESPONSE" }
  try {
    const client = await dependencies.client()
    if (!current()) return { ok: false, code: "STALE_RESPONSE" }
    if (!client) return { ok: false, code: "UNAVAILABLE" }
    const session = await client.auth.getSession()
    if (!current()) return { ok: false, code: "STALE_RESPONSE" }
    if (session.error || session.data.session?.user.id !== ownerId) return { ok: false, code: "AUTH_REQUIRED" }
    const { data, error } = await client.functions.invoke("account-journal", { body: request })
    let responseData: unknown = data
    if (!current()) return { ok: false, code: "STALE_RESPONSE" }
    if (error) {
      const status = error.context instanceof Response ? error.context.status : 0
      if (status === 409 && request.action === "save") {
        responseData = await error.context.clone().json()
        if (!current()) return { ok: false, code: "STALE_RESPONSE" }
        if ((responseData as { kind?: unknown })?.kind !== "conflict") return { ok: false, code: "CONFLICT" }
      } else return { ok: false, code: status === 401 ? "AUTH_REQUIRED" : status === 403 ? "ACCESS_DENIED" : "UNAVAILABLE" }
    }
    const parsed = responseSchema.safeParse(responseData)
    if (!parsed.success) return { ok: false, code: "INVALID_RESPONSE" }
    const result = parsed.data
    const correctKind = request.action === "status" ? result.kind === "ready"
      : request.action === "list" ? result.kind === "list"
      : request.action === "read" ? result.kind === "document" && result.documentId === request.documentId
      : (result.kind === "saved" || result.kind === "conflict")
        && result.documentId === request.documentId && result.operationId === request.operationId
        && (result.kind !== "saved" || result.revision === request.expectedRevision + 1)
    return correctKind ? { ok: true, data: result } : { ok: false, code: "INVALID_RESPONSE" }
  } catch { return { ok: false, code: current() ? "UNAVAILABLE" : "STALE_RESPONSE" } }
}
