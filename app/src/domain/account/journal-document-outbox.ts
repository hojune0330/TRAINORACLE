import { z } from "zod"

// Pure protocol core only. No storage, network, account switching or feature activation.
const envelopeSchema = z.object({
  version: z.literal(1),
  algorithm: z.literal("AES-GCM"),
  keyId: z.string().min(1).max(80).refine(value => value.trim().length > 0),
  iv: z.string().regex(/^[A-Za-z0-9+/]{16}$/u),
  ciphertext: z.string().min(24).max(1_398_104)
    .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u)
    .refine(value => {
      try {
        const bytes = atob(value)
        return bytes.length >= 16 && bytes.length <= 1_048_576 && btoa(bytes) === value
      } catch { return false }
    }),
}).strict()

export type JournalDocumentEnvelope = z.infer<typeof envelopeSchema>

const operationSchema = z.object({
  operationId: z.uuid(),
  documentId: z.uuid(),
  expectedRevision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER - 1),
  localRevision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  encryptedPayload: envelopeSchema,
}).strict()

const stateSchema = z.object({
  version: z.literal(1),
  ownerId: z.uuid(),
  documentId: z.uuid(),
  localRevision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  acknowledgedLocalRevision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  serverRevision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER - 1),
  draft: envelopeSchema,
  pending: operationSchema.nullable(),
  conflict: z.object({
    attempted: operationSchema,
    currentRevision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER - 1),
  }).strict().nullable(),
}).strict().superRefine((state, context) => {
  const invalid = () => context.addIssue({ code: "custom", message: "Invalid outbox lineage" })
  if (state.acknowledgedLocalRevision > state.localRevision) invalid()
  if (state.serverRevision === 0 && state.acknowledgedLocalRevision > 0) invalid()
  if (state.pending !== null && state.conflict !== null) invalid()
  const operation = state.pending ?? state.conflict?.attempted
  if (operation && (operation.documentId !== state.documentId
    || operation.localRevision > state.localRevision
    || operation.localRevision <= state.acknowledgedLocalRevision
    || operation.expectedRevision !== state.serverRevision)) invalid()
  if (operation?.localRevision === state.localRevision
    && JSON.stringify(operation.encryptedPayload) !== JSON.stringify(state.draft)) invalid()
})

export type JournalDocumentOutbox = z.infer<typeof stateSchema>
export type JournalSyncSession = Readonly<{ ownerId: string; epoch: number }>

function freezeState(state: JournalDocumentOutbox): JournalDocumentOutbox {
  Object.freeze(state.draft)
  for (const operation of [state.pending, state.conflict?.attempted]) {
    if (operation) { Object.freeze(operation.encryptedPayload); Object.freeze(operation) }
  }
  if (state.conflict) Object.freeze(state.conflict)
  return Object.freeze(state)
}

export function readJournalDocumentOutbox(value: unknown): JournalDocumentOutbox | null {
  const parsed = stateSchema.safeParse(value)
  return parsed.success ? freezeState(parsed.data) : null
}

export function createJournalDocumentOutbox(input: {
  ownerId: string; documentId: string; encryptedPayload: JournalDocumentEnvelope;
  serverRevision?: number;
}): JournalDocumentOutbox {
  return freezeState(stateSchema.parse({
    version: 1, ownerId: input.ownerId, documentId: input.documentId,
    localRevision: 1, acknowledgedLocalRevision: 0, serverRevision: input.serverRevision ?? 0,
    draft: input.encryptedPayload, pending: null, conflict: null,
  }))
}

export function editJournalDocumentDraft(
  state: JournalDocumentOutbox, encryptedPayload: JournalDocumentEnvelope,
): JournalDocumentOutbox {
  return freezeState(stateSchema.parse({ ...state,
    localRevision: state.localRevision + 1, draft: encryptedPayload,
  }))
}

export function queueJournalDocument(
  state: JournalDocumentOutbox, operationId: string,
): JournalDocumentOutbox {
  if (state.pending || state.conflict || state.localRevision === state.acknowledgedLocalRevision) return state
  return freezeState(stateSchema.parse({ ...state, pending: {
    operationId, documentId: state.documentId, expectedRevision: state.serverRevision,
    localRevision: state.localRevision, encryptedPayload: state.draft,
  } }))
}

const receiptSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("saved"), documentId: z.uuid(), operationId: z.uuid(),
    revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER - 1) }).strict(),
  z.object({ kind: z.literal("conflict"), documentId: z.uuid(), operationId: z.uuid(),
    currentRevision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER - 1) }).strict(),
])

export function acknowledgeJournalDocument(input: {
  state: JournalDocumentOutbox; receipt: unknown;
  sentSession: JournalSyncSession; currentSession: JournalSyncSession | null;
}): JournalDocumentOutbox {
  const { state, currentSession, sentSession } = input
  if (!currentSession || !Number.isSafeInteger(sentSession.epoch)
    || sentSession.epoch < 0 || currentSession.epoch !== sentSession.epoch
    || currentSession.ownerId !== sentSession.ownerId || state.ownerId !== sentSession.ownerId) return state
  const parsed = receiptSchema.safeParse(input.receipt)
  const operation = state.pending
  if (!parsed.success || !operation) return state
  const receipt = parsed.data
  if (receipt.documentId !== state.documentId || receipt.operationId !== operation.operationId) return state
  if (receipt.kind === "conflict") {
    // Keep both the attempted version and any text edited while the request was in flight.
    if (receipt.currentRevision === operation.expectedRevision) return state
    return freezeState(stateSchema.parse({ ...state, pending: null,
      conflict: { attempted: operation, currentRevision: receipt.currentRevision },
    }))
  }
  if (receipt.revision !== operation.expectedRevision + 1) return state
  return freezeState(stateSchema.parse({ ...state, pending: null,
    serverRevision: receipt.revision, acknowledgedLocalRevision: operation.localRevision,
  }))
}

export function journalDocumentDraftStatus(state: JournalDocumentOutbox) {
  if (state.conflict) return "CONFLICT" as const
  if (state.pending) return "PENDING" as const
  return state.localRevision === state.acknowledgedLocalRevision
    ? "DRAFT_ACKNOWLEDGED" as const : "LOCAL_CHANGES" as const
}
