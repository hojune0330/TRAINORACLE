import { z } from "zod"
import { createAccountDocumentBuffer, type AccountJournalConflictBuffer, type AccountJournalDraftView } from "./account-journal-draft-buffer"
import { accountPlanFingerprint, type AccountPlanDocument } from "./account-plan-document-schema"
import { validateAccountPlanCollectionIndex, validateAccountPlanCollectionPart,
  type AccountPlanCollectionIndex, type AccountPlanSnapshotPart, type AccountPlanProgressPart,
  type AccountPlanCollectionParts, splitAccountPlanCollection } from "./account-plan-collection-schema"
import { readAccountPlanCollectionTransfer, type AccountPlanCollectionTransfer } from "./account-plan-collection-transfer"

export type AccountPlanCollectionPart = AccountPlanSnapshotPart | AccountPlanProgressPart
export type AccountPlanCollectionManifest = {
  version: 1
  previous: AccountPlanCollectionIndex | null
  next: AccountPlanCollectionIndex
  operation: { ownerId: string; operationId: string; expectedRevision: number;
    legacy: AccountPlanCollectionTransfer["legacy"] } | null
  /** Actual collection revision for an observed baseline; the local journal has its own counter. */
  revision?: number
}
const revision = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER - 2)
export const accountPlanCollectionManifestSchema = z.object({
  version: z.literal(1), previous: z.custom<AccountPlanCollectionIndex>(validateAccountPlanCollectionIndex).nullable(),
  next: z.custom<AccountPlanCollectionIndex>(validateAccountPlanCollectionIndex),
  operation: z.object({ ownerId: z.uuid(), operationId: z.uuid(), expectedRevision: revision,
    legacy: z.object({ documentId: z.uuid(), revision: revision.refine(n => n > 0),
      fingerprint: z.string().regex(/^sha256:[a-f0-9]{64}$/u) }).strict().nullable(),
  }).strict().nullable(),
  revision: revision.optional(),
}).strict().refine(m => m.operation ? (m.previous === null) === (m.operation.expectedRevision === 0) : m.revision !== undefined)

export type AccountPlanCollectionBufferDependencies = {
  manifests?: AccountJournalConflictBuffer<AccountPlanCollectionManifest>
  parts?: AccountJournalConflictBuffer<AccountPlanCollectionPart>
  cutovers?: AccountJournalConflictBuffer<AccountPlanLegacyHandoff>
  yieldTask?: () => Promise<void>
}
const indexCodec = z.custom<AccountPlanCollectionIndex>(validateAccountPlanCollectionIndex)
const hashCodec = z.string().regex(/^sha256:[a-f0-9]{64}$/u)
const handoffSchema = z.object({
  version: z.literal(1), ownerId: z.uuid(), documentId: z.uuid(), sourceFingerprint: hashCodec,
  disposition: z.enum(["SERVER", "HISTORY"]), collectionRevision: revision.refine(n => n > 0), collectionIndexFingerprint: hashCodec,
  draftIndex: indexCodec, pendingIndex: indexCodec.nullable(), remoteIndex: indexCodec.nullable(),
  source: z.object({ serverRevision: revision, localSequence: z.number().int().positive(),
    acknowledgedSequence: z.number().int().nonnegative(), state: z.enum(["LOCAL_CHANGES", "PENDING", "CONFLICT", "DRAFT_ACKNOWLEDGED"]),
    blocked: z.object({ kind: z.enum(["RECEIPT", "REMOTE"]), operationId: z.string().nullable(), currentRevision: revision }).strict().nullable(),
    operation: z.object({ operationId: z.uuid(), expectedRevision: revision, sequence: z.number().int().positive(),
      rejection: z.string().optional(), writePurpose: z.literal("MIGRATION").optional() }).strict().nullable(),
  }).strict(),
}).strict()
export type AccountPlanLegacyHandoff = z.infer<typeof handoffSchema>
export function accountPlanLegacySourceFingerprint(view: AccountJournalDraftView<AccountPlanDocument>) {
  return accountPlanFingerprint({ ownerId: view.ownerId, documentId: view.documentId, draft: view.draft,
    pending: view.pending, blocked: view.blocked, remoteDraft: view.remoteDraft, serverRevision: view.serverRevision,
    localSequence: view.localSequence, acknowledgedSequence: view.acknowledgedSequence, state: view.state })
}
export const accountPlanCollectionYield = () => new Promise<void>(resolve => setTimeout(resolve, 0))
// UUID storage keys are derived from full content hashes; any collision is rejected, never overwritten.
export function accountPlanCollectionLocalId(value: unknown) {
  const h = accountPlanFingerprint(value).slice(7, 39).split("")
  h[12] = "5"; h[16] = "8"
  const s = h.join("")
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`
}

/** Only physical parts and small manifests enter IndexedDB. No eviction or monolithic fallback. */
export function createAccountPlanCollectionBuffer(ownerId: string, isCurrent: () => boolean,
  dependencies: AccountPlanCollectionBufferDependencies = {}) {
  const manifests = dependencies.manifests ?? createAccountDocumentBuffer(accountPlanCollectionManifestSchema,
    "trainoracle-account-plan-collection-manifests-v1")
  const parts = dependencies.parts ?? createAccountDocumentBuffer(z.custom<AccountPlanCollectionPart>(validateAccountPlanCollectionPart),
    "trainoracle-account-plan-collection-parts-v1")
  const cutovers = dependencies.cutovers ?? createAccountDocumentBuffer(handoffSchema, "trainoracle-account-plan-legacy-handoffs-v1")
  const yieldTask = dependencies.yieldTask ?? accountPlanCollectionYield
  const documentId = accountPlanCollectionLocalId(["manifest", ownerId])
  const check = () => { if (!isCurrent()) throw Error("STALE") }
  const partKey = (kind: AccountPlanCollectionPart["kind"], id: string) => accountPlanCollectionLocalId([kind, id])
  async function rawRead() { check(); const v = await manifests.read(ownerId, documentId); check(); return v }
  async function read() {
    const v = await rawRead()
    if (!v) return null
    const manifest = accountPlanCollectionManifestSchema.parse(v.draft)
    const actualRevision = manifest.operation
      ? manifest.operation.expectedRevision + (v.state === "DRAFT_ACKNOWLEDGED" ? 1 : 0) : manifest.revision!
    // Local conflict resolution can advance the journal while the collection still does not exist.
    return { ...v, serverRevision: actualRevision,
      pending: v.pending ? { ...v.pending, expectedRevision: actualRevision } : null }
  }
  async function stage(part: AccountPlanCollectionPart) {
    check()
    if (!validateAccountPlanCollectionPart(part)) throw Error("INVALID")
    const captured = structuredClone(part), key = partKey(part.kind, part.id)
    const old = await parts.read(ownerId, key); check()
    if (old) {
      if (accountPlanFingerprint(old.draft) !== accountPlanFingerprint(captured)) throw Error("CONFLICT")
      return
    }
    await parts.saveDraft(ownerId, key, captured, 0); check()
  }
  async function readPart(kind: AccountPlanCollectionPart["kind"], id: string) {
    check(); const v = await parts.read(ownerId, partKey(kind, id)); check()
    if (!v) return null
    if (!validateAccountPlanCollectionPart(v.draft) || v.draft.kind !== kind || v.draft.id !== id) throw Error("INVALID")
    return v.draft
  }
  async function assemble(index: AccountPlanCollectionIndex): Promise<AccountPlanCollectionParts> {
    const snapshots: AccountPlanSnapshotPart[] = [], progress: AccountPlanProgressPart[] = []
    for (const ref of index.plans) {
      const s = await readPart("PLAN_SNAPSHOT", ref.snapshotId), p = await readPart("PLAN_PROGRESS", ref.progressId)
      if (!s || s.kind !== "PLAN_SNAPSHOT" || !p || p.kind !== "PLAN_PROGRESS") throw Error("INVALID")
      snapshots.push(s); progress.push(p)
      await yieldTask(); check()
    }
    return { index, snapshots, progress }
  }
  return {
    read, stage, readPart,
    async save(transfer: AccountPlanCollectionTransfer, expectedSequence: number) {
      check()
      const captured = structuredClone(transfer)
      if (!readAccountPlanCollectionTransfer(captured) || captured.ownerId !== ownerId) throw Error("INVALID")
      // Previous parts remain available for restart validation and conflict recovery as well.
      for (const collection of [captured.previous, captured.next]) {
        if (!collection) continue
        for (const part of [...collection.snapshots, ...collection.progress]) {
          await stage(part); await yieldTask(); check()
        }
      }
      const manifest: AccountPlanCollectionManifest = { version: 1, previous: captured.previous?.index ?? null,
        next: captured.next.index, operation: { ownerId, operationId: captured.operationId,
          expectedRevision: captured.expectedRevision, legacy: captured.legacy } }
      const old = await read()
      if ((old?.localSequence ?? 0) !== expectedSequence || old && old.state !== "DRAFT_ACKNOWLEDGED") throw Error("CONFLICT")
      await manifests.saveDraft(ownerId, documentId, manifest, expectedSequence); check()
      // The operation ID is already durable if the browser closes before queue completes.
      await manifests.queue(ownerId, documentId, captured.operationId); check()
    },
    async pending() {
      let view = await read()
      if (!view || view.state === "DRAFT_ACKNOWLEDGED") return null
      if (view.blocked) throw Error("CONFLICT")
      const manifest = accountPlanCollectionManifestSchema.parse(view.draft), op = manifest.operation
      if (!op || op.ownerId !== ownerId || op.expectedRevision !== view.serverRevision) throw Error("INVALID")
      if (!view.pending) {
        await manifests.queue(ownerId, documentId, op.operationId); check(); view = await read()
      }
      if (!view?.pending || view.pending.operationId !== op.operationId
        || accountPlanFingerprint(view.pending.draft) !== accountPlanFingerprint(manifest)) throw Error("CONFLICT")
      const transfer = readAccountPlanCollectionTransfer({ version: 1, ...op,
        previous: manifest.previous ? await assemble(manifest.previous) : null, next: await assemble(manifest.next) })
      check()
      if (!transfer) throw Error("INVALID")
      return transfer
    },
    async ack(operationId: string, revision: number) {
      const raw = await rawRead(), op = raw?.draft.operation
      if (!raw?.pending || !op || op.operationId !== operationId || revision !== op.expectedRevision + 1) return false
      const ok = await manifests.ack(ownerId, documentId, operationId, raw.pending.expectedRevision + 1)
      check(); return ok
    },
    async observe(index: AccountPlanCollectionIndex, revision: number, forceConflict = false) {
      const old = await read()
      if (old && revision < old.serverRevision) throw Error("INVALID")
      if (old?.state === "DRAFT_ACKNOWLEDGED" && old.serverRevision === revision) {
        if (accountPlanFingerprint(old.draft.next) !== accountPlanFingerprint(index)) throw Error("INVALID")
        return "UNCHANGED" as const
      }
      if (!forceConflict && old && old.state !== "DRAFT_ACKNOWLEDGED" && old.serverRevision === revision) return "UNCHANGED" as const
      const raw = await rawRead()
      check()
      const result = await manifests.importRemote(ownerId, documentId,
        { version: 1, previous: null, next: index, operation: null, revision }, (raw?.serverRevision ?? 0) + 1)
      check(); return result
    },
    async useRemote(index: AccountPlanCollectionIndex, revision: number, sequence: number) {
      const raw = await rawRead()
      if (!raw?.blocked) throw Error("CONFLICT")
      const remote: AccountPlanCollectionManifest = { version: 1, previous: null, next: index, operation: null, revision }
      const same = raw.remoteDraft && accountPlanFingerprint(raw.remoteDraft) === accountPlanFingerprint(remote)
      const localRevision = same ? raw.blocked.currentRevision : Math.max(raw.serverRevision, raw.blocked.currentRevision) + 1
      await manifests.captureConflict(ownerId, documentId, remote, localRevision, sequence, isCurrent); check()
      await manifests.resolveConflict(ownerId, documentId, "REMOTE", localRevision, sequence, isCurrent); check()
    },
    async archive() { check(); return manifests.readConflictArchive(ownerId, documentId, isCurrent) },
    async legacyHandoff(view: AccountJournalDraftView<AccountPlanDocument>) {
      check()
      if (view.ownerId !== ownerId) throw Error("INVALID")
      const fingerprint = accountPlanLegacySourceFingerprint(view)
      const stored = await cutovers.read(ownerId, accountPlanCollectionLocalId(["legacy-handoff", fingerprint])); check()
      if (!stored) return null
      const marker = handoffSchema.parse(stored.draft)
      if (marker.ownerId !== ownerId || marker.documentId !== view.documentId || marker.sourceFingerprint !== fingerprint) throw Error("INVALID")
      return marker
    },
    async preserveLegacy(view: AccountJournalDraftView<AccountPlanDocument>, disposition: "SERVER" | "HISTORY",
      confirmedIndex: AccountPlanCollectionIndex, collectionRevision: number) {
      check()
      if (view.ownerId !== ownerId) throw Error("INVALID")
      const captured = structuredClone(view), sourceFingerprint = accountPlanLegacySourceFingerprint(captured)
      const indices: (AccountPlanCollectionIndex | null)[] = []
      for (const document of [captured.draft, captured.pending?.draft ?? null, captured.remoteDraft]) {
        if (!document) { indices.push(null); continue }
        const collection = splitAccountPlanCollection(document)
        for (const part of [...collection.snapshots, ...collection.progress]) {
          await stage(part); await yieldTask(); check()
        }
        indices.push(collection.index)
      }
      const pending = captured.pending
      const marker: AccountPlanLegacyHandoff = handoffSchema.parse({ version: 1, ownerId, documentId: captured.documentId,
        sourceFingerprint, disposition, collectionRevision, collectionIndexFingerprint: accountPlanFingerprint(confirmedIndex),
        draftIndex: indices[0], pendingIndex: indices[1], remoteIndex: indices[2], source: {
          serverRevision: captured.serverRevision, localSequence: captured.localSequence, acknowledgedSequence: captured.acknowledgedSequence,
          state: captured.state, blocked: captured.blocked, operation: pending ? {
            operationId: pending.operationId, expectedRevision: pending.expectedRevision, sequence: pending.sequence,
            ...(pending.rejection ? { rejection: pending.rejection } : {}), ...(pending.writePurpose ? { writePurpose: pending.writePurpose } : {}),
          } : null,
        } })
      const id = accountPlanCollectionLocalId(["legacy-handoff", sourceFingerprint]), old = await cutovers.read(ownerId, id); check()
      if (old) return
      // A local handoff marker is not an ACK of the old operation. Its original DB stays untouched.
      await cutovers.saveDraft(ownerId, id, marker, 0); check()
    },
    close() { manifests.close(); parts.close(); cutovers.close() },
  }
}
export type AccountPlanCollectionBuffer = ReturnType<typeof createAccountPlanCollectionBuffer>
