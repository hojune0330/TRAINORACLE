import { z } from "zod"
import { supabase } from "./supabase-client"
import { activeLocalAccount } from "./local-journal-ownership"
import { isAccountStoragePaused } from "./storage-consent"
import { currentStorageConsentRevision, pinStorageOperationRevision } from "./storage-consent-revision"
import { accountJournalDraftSchema } from "./account-journal-draft-buffer"
import { isAccountJournalWriteRejection, type AccountJournalWriteRejection } from "./account-write-rejection"
import type { AccountJournalDraft } from "./account-journal-draft-buffer"
import { accountJournalRecordSchema, type AccountJournalWritePurpose } from "./account-journal-record-schema"
import type { FileObservationV1 } from "../import/file-observation"
import type { ConfirmComparisonRelationRequest, ReleaseComparisonRelationRequest } from "../import/comparison-relation"
export type { ConfirmComparisonRelationRequest, ReleaseComparisonRelationRequest } from "../import/comparison-relation"

export function accountJournalPreviewEnabled(env: Readonly<Record<string, unknown>> = import.meta.env) {
  return env.VITE_FEATURE_ACCOUNT_JOURNAL === "true" && env.VITE_KILL_ACCOUNT_JOURNAL !== "true"
    && !isAccountStoragePaused(activeLocalAccount())
}

const revision = z.number().int().positive().max(Number.MAX_SAFE_INTEGER - 1)
function responseSchema<T>(schema: z.ZodType<T>) {
const document = z.object({ documentId: z.uuid(), revision, document: schema }).strict()
return z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("ready") }).strict(),
  z.object({ kind: z.literal("calendar-decoration-support"), version: z.literal(1) }).strict(),
  z.object({ kind: z.literal("athlete-record-support"), version: z.literal(1) }).strict(),
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
  | { kind: "calendar-decoration-support"; version: 1 }
  | { kind: "athlete-record-support"; version: 1 }
  | { kind: "document"; documentId: string; revision: number; document: T }
  | { kind: "list"; documents: { documentId: string; revision: number; document: T }[]; nextCursor: string | null; deletedDocuments?: { documentId: string; revision: number }[] }
  | { kind: "deleted"; documentId: string; revision: number; operationId?: string }
  | { kind: "restored"; documentId: string; revision: number; operationId: string; sourceRevision: number }
  | { kind: "history"; documentId: string; versions: { revision: number; document: T; replacedAt: string; expiresAt: string; reason: "replaced" | "trash" }[] }
  | { kind: "saved"; documentId: string; operationId: string; revision: number }
  | { kind: "conflict"; documentId: string; operationId: string; currentRevision: number }
export type AccountJournalRequest<T = AccountJournalDraft> =
  | ConfirmComparisonRelationRequest | ReleaseComparisonRelationRequest
  | { action: "status" }
  | { action: "calendarDecorationSupport" }
  | { action: "athleteRecordSupport" }
  | { action: "list"; cursor?: string; collection?: "JOURNAL" }
  | { action: "read"; documentId: string }
  | { action: "history"; documentId: string; collection?: "JOURNAL" }
  | { action: "delete"; documentId: string; operationId: string; expectedRevision: number }
  | { action: "restore"; documentId: string; operationId: string; expectedRevision: number; sourceRevision: number }
  | { action: "save"; documentId: string; operationId: string; expectedRevision: number;
      document: T; writePurpose?: AccountJournalWritePurpose }
  | { action: "correctImportedObservation"; documentId: string; operationId: string; expectedRevision: number;
      previousContentRevisionFingerprint: string; replacementObservation: FileObservationV1;
      confirmedChangedFields: readonly string[] }

export type AccountJournalResult<T = AccountJournalDraft> =
  | { ok: true; data: AccountJournalResponse<T> }
  | { ok: false; code: "AUTH_REQUIRED" | "ACCESS_DENIED" | "NOT_FOUND" | "UNAVAILABLE" | "INVALID_RESPONSE" | "CALENDAR_DECORATION_UNSUPPORTED" | "ATHLETE_RECORD_UNSUPPORTED" | "STALE_RESPONSE" | "CONFLICT" | "UPGRADE_REQUIRED" | "FILE_EVIDENCE_DISABLED" | "INVALID_FILE_OBSERVATION" | "FILE_OBSERVATION_CONFLICT" | "COMPARISON_ORIGINAL_UNAVAILABLE" | "INVALID_COMPARISON_RELATION" | "COMPARISON_CAPACITY_EXCEEDED" | AccountJournalWriteRejection }

export type CorrectImportedObservationRequest = Extract<AccountJournalRequest, { action: "correctImportedObservation" }>

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
  const storageRevision = "operationId" in request
    ? pinStorageOperationRevision(ownerId, request.operationId, 0) : currentStorageConsentRevision(ownerId)
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
    const journalCall = Object.is(schema, accountJournalRecordSchema) || ["correctImportedObservation", "confirmComparisonRelation", "releaseComparisonRelation"].includes(request.action)
      || ((request.action === "list" || request.action === "history") && request.collection === "JOURNAL")
      || (request.action === "save" && (request.document as { kind?: unknown })?.kind === "JOURNAL")
    const { data, error } = await client.functions.invoke("account-journal", {
      body: journalCall ? { ...request, supportedJournalVersions: [2, 3], supportsExerciseLogV1: true } : request,
      headers: { Authorization: `Bearer ${token}`, "x-trainoracle-storage-revision": String(storageRevision) },
    })
    let responseData: unknown = data
    if (!current()) return { ok: false, code: "STALE_RESPONSE" }
    if (error) {
      const status = error.context instanceof Response ? error.context.status : 0
      if (status === 426) return { ok: false, code: "UPGRADE_REQUIRED" }
      if (status === 507) {
        const quota = await error.context.clone().json().catch(() => null)
        if (!current()) return { ok: false, code: "STALE_RESPONSE" }
        if ((quota as { error?: unknown } | null)?.error === "CONFLICT_STORAGE_LIMIT_REACHED") {
          return { ok: false, code: "CONFLICT_STORAGE_LIMIT_REACHED" }
        }
      }
      // Only this additive capability probe may interpret an older route/action as unsupported.
      // Data reads and writes must retain their ordinary failure semantics.
      if (request.action === "calendarDecorationSupport" && [400, 404, 501].includes(status)) {
        return { ok: false, code: "CALENDAR_DECORATION_UNSUPPORTED" }
      }
      if (request.action === "athleteRecordSupport" && [400, 404, 501].includes(status)) {
        return { ok: false, code: "ATHLETE_RECORD_UNSUPPORTED" }
      }
      if ([409, 422].includes(status) && ["save", "delete", "restore", "correctImportedObservation", "confirmComparisonRelation", "releaseComparisonRelation"].includes(request.action)) {
        responseData = await error.context.clone().json()
        if (!current()) return { ok: false, code: "STALE_RESPONSE" }
        const rejection = (responseData as { error?: unknown })?.error
        if (rejection === "FILE_EVIDENCE_DISABLED" || rejection === "INVALID_FILE_OBSERVATION"
          || rejection === "FILE_OBSERVATION_CONFLICT" || rejection === "COMPARISON_ORIGINAL_UNAVAILABLE"
          || rejection === "INVALID_COMPARISON_RELATION" || rejection === "COMPARISON_CAPACITY_EXCEEDED") return { ok: false, code: rejection }
        if (isAccountJournalWriteRejection(rejection)) return { ok: false, code: rejection }
        if (status === 422) return { ok: false, code: "UNAVAILABLE" }
        if ((responseData as { kind?: unknown })?.kind !== "conflict") return { ok: false, code: "CONFLICT" }
      } else return { ok: false, code: status === 401 ? "AUTH_REQUIRED" : status === 403 ? "ACCESS_DENIED"
        : status === 404 && request.action === "read" ? "NOT_FOUND" : "UNAVAILABLE" }
    }
    const parsed = responseSchema(schema).safeParse(responseData)
    if (!parsed.success) return { ok: false, code: "INVALID_RESPONSE" }
    const result = parsed.data as AccountJournalResponse<T>
    const correctKind = request.action === "status" ? result.kind === "ready"
      : request.action === "calendarDecorationSupport" ? result.kind === "calendar-decoration-support"
      : request.action === "athleteRecordSupport" ? result.kind === "athlete-record-support"
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
