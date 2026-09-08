import { z } from "zod"
import { hasCanonicalJsonTree } from "../plan-beta-schema"
import { accountPlanFingerprint, type AccountPlanDocument } from "./account-plan-document-schema"
import { joinAccountPlanCollection, splitAccountPlanCollection,
  type AccountPlanCollectionIndex, type AccountPlanCollectionParts,
  type AccountPlanSnapshotPart, type AccountPlanProgressPart } from "./account-plan-collection-schema"

type Part = AccountPlanSnapshotPart | AccountPlanProgressPart
const fingerprint = z.string().regex(/^sha256:[a-f0-9]{64}$/u)
const revision = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER - 2)
const legacySchema = z.object({ documentId: z.uuid(), revision: revision.refine(n => n > 0), fingerprint }).strict()
const transferSchema = z.object({
  version: z.literal(1), ownerId: z.uuid(), operationId: z.uuid(), expectedRevision: revision,
  previous: z.unknown(), next: z.unknown(), legacy: legacySchema.nullable(),
}).strict()
export type AccountPlanCollectionTransfer = Omit<z.infer<typeof transferSchema>, "previous" | "next"> & {
  previous: AccountPlanCollectionParts | null; next: AccountPlanCollectionParts;
}

export type AccountPlanCollectionCommit = {
  ownerId: string; operationId: string; expectedRevision: number;
  previousIndexFingerprint: string | null; previousCurrentPlanId: string | null;
  index: AccountPlanCollectionIndex; legacy: z.infer<typeof legacySchema> | null;
}
export type AccountPlanCollectionReceipt = {
  ownerId: string; operationId: string; revision: number; indexFingerprint: string; requestFingerprint: string;
}
const receiptSchema = z.object({ ownerId: z.uuid(), operationId: z.uuid(),
  revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER - 1),
  indexFingerprint: fingerprint, requestFingerprint: fingerprint }).strict()

/** The production adapter must authenticate the owner and commit in ONE DB transaction.
 * This port is deliberately not connected to the existing single-document gateway.
 * Staged immutable parts confer neither a current pointer nor execution authority. */
export interface AccountPlanCollectionPort {
  receipt(ownerId: string, operationId: string): Promise<unknown | null>
  stage(ownerId: string, part: Part): Promise<void>
  readPart(ownerId: string, kind: Part["kind"], id: string): Promise<unknown | null>
  commit(request: AccountPlanCollectionCommit): Promise<
    { kind: "committed"; receipt: unknown } | { kind: "conflict" }>
}
export type AccountPlanCollectionScope = { ownerId: string; epoch: number }
export type AccountPlanCollectionTransferResult =
  | { kind: "committed"; receipt: AccountPlanCollectionReceipt }
  | { kind: "invalid" | "stale" | "conflict" | "review_required" | "unavailable" | "outcome_unknown" }

function preservesHistory(previous: AccountPlanDocument, next: AccountPlanDocument) {
  return previous.data.plans.every(old => {
    const newer = next.data.plans.find(p => p.planId === old.planId)
    return !!newer && accountPlanFingerprint(old.snapshot) === accountPlanFingerprint(newer.snapshot)
      && newer.updatedAt >= old.updatedAt
      && (old.archivedAt === null || accountPlanFingerprint(old) === accountPlanFingerprint(newer))
  })
}

/** Revalidate persisted operations. Payload consistency never replaces authenticated server CAS. */
export function readAccountPlanCollectionTransfer(value: unknown): AccountPlanCollectionTransfer | null {
  try {
    if (!hasCanonicalJsonTree(value)) return null
    const parsed = transferSchema.safeParse(value)
    if (!parsed.success) return null
    const transfer = parsed.data, next = joinAccountPlanCollection(transfer.next)
    if (!next || (transfer.previous === null) !== (transfer.expectedRevision === 0)) return null
    if (transfer.previous !== null) {
      const previous = joinAccountPlanCollection(transfer.previous)
      if (!previous || transfer.legacy || !preservesHistory(previous, next)) return null
      const oldCurrent = previous.data.currentPlanId
      if (oldCurrent !== null && oldCurrent !== next.data.currentPlanId
        && next.data.plans.find(p => p.planId === oldCurrent)?.archivedAt === null) return null
      // Archived plans cannot become current again, even after a complete rehash.
      if (next.data.currentPlanId && previous.data.plans.find(p => p.planId === next.data.currentPlanId)?.archivedAt) return null
    }
    if (transfer.legacy && accountPlanFingerprint(next) !== transfer.legacy.fingerprint) return null
    // Both unknown wire collections have now passed the full, expensive reader once.
    return structuredClone(transfer) as AccountPlanCollectionTransfer
  } catch { return null }
}

/** Capture the exact source synchronously before any authentication/storage awaits.
 * The caller must persist this operation in its encrypted outbox before transfer. */
export function prepareAccountPlanCollectionTransfer(input: {
  ownerId: string; operationId: string; expectedRevision: number;
  previous: AccountPlanDocument | null; next: AccountPlanDocument;
  legacy?: { documentId: string; revision: number; document: AccountPlanDocument };
}): AccountPlanCollectionTransfer | null {
  try {
    return readAccountPlanCollectionTransfer({ version: 1, ownerId: input.ownerId, operationId: input.operationId,
      expectedRevision: input.expectedRevision,
      previous: input.previous ? splitAccountPlanCollection(input.previous) : null,
      next: splitAccountPlanCollection(input.next), legacy: input.legacy ? {
        documentId: input.legacy.documentId, revision: input.legacy.revision,
        fingerprint: accountPlanFingerprint(input.legacy.document),
      } : null })
  } catch { return null }
}

export function accountPlanCollectionCommit(transfer: AccountPlanCollectionTransfer): AccountPlanCollectionCommit {
  return { ownerId: transfer.ownerId, operationId: transfer.operationId, expectedRevision: transfer.expectedRevision,
    previousIndexFingerprint: transfer.previous ? accountPlanFingerprint(transfer.previous.index) : null,
    previousCurrentPlanId: transfer.previous?.index.currentPlanId ?? null,
    index: structuredClone(transfer.next.index), legacy: transfer.legacy ? { ...transfer.legacy } : null }
}

/** Copy, read back, then atomically switch. A missing ACK is UNKNOWN, never a false rollback.
 * No retry timer, local completion, source deletion, or fallback to a device writer. */
export async function transferAccountPlanCollection(input: {
  transfer: unknown; port: AccountPlanCollectionPort;
  scope: () => AccountPlanCollectionScope | null; freshSelectionReview: () => boolean;
}): Promise<AccountPlanCollectionTransferResult> {
  const transfer = readAccountPlanCollectionTransfer(input.transfer)
  if (!transfer) return { kind: "invalid" }
  const opening = input.scope()
  if (!opening || opening.ownerId !== transfer.ownerId || !Number.isSafeInteger(opening.epoch)) return { kind: "stale" }
  const epoch = opening.epoch, ownerId = opening.ownerId
  const current = () => { const now = input.scope(); return now?.ownerId === ownerId && now.epoch === epoch }
  const request = accountPlanCollectionCommit(transfer)
  const matchingReceipt = (value: unknown): AccountPlanCollectionReceipt | null => {
    const parsed = receiptSchema.safeParse(value)
    if (!parsed.success) return null
    const receipt = parsed.data
    return receipt.ownerId === ownerId && receipt.operationId === transfer.operationId
      && receipt.revision === transfer.expectedRevision + 1
      && receipt.requestFingerprint === accountPlanFingerprint(request)
      && receipt.indexFingerprint === accountPlanFingerprint(transfer.next.index) ? receipt : null
  }
  let committing = false, receiptLookupCompleted = false
  try {
    const existing = await input.port.receipt(ownerId, transfer.operationId)
    receiptLookupCompleted = true
    if (!current()) return { kind: "stale" }
    if (existing !== null) {
      const receipt = matchingReceipt(existing)
      return receipt ? { kind: "committed", receipt } : { kind: "invalid" }
    }
    const changesSelection = transfer.next.index.currentPlanId !== null
      && transfer.next.index.currentPlanId !== transfer.previous?.index.currentPlanId && !transfer.legacy
    const reviewed = () => !changesSelection || input.freshSelectionReview() === true
    if (!reviewed()) return { kind: "review_required" }
    const snapshots: AccountPlanSnapshotPart[] = [], progress: AccountPlanProgressPart[] = []
    for (const part of [...transfer.next.snapshots, ...transfer.next.progress]) {
      if (!current()) return { kind: "stale" }
      let stored = await input.port.readPart(ownerId, part.kind, part.id)
      if (!current()) return { kind: "stale" }
      if (stored === null) {
        await input.port.stage(ownerId, structuredClone(part))
        if (!current()) return { kind: "stale" }
        stored = await input.port.readPart(ownerId, part.kind, part.id)
        if (!current()) return { kind: "stale" }
      }
      if (!hasCanonicalJsonTree(stored) || accountPlanFingerprint(stored) !== accountPlanFingerprint(part)) return { kind: "invalid" }
      if (part.kind === "PLAN_SNAPSHOT") snapshots.push(structuredClone(stored) as AccountPlanSnapshotPart)
      else progress.push(structuredClone(stored) as AccountPlanProgressPart)
    }
    if (!joinAccountPlanCollection({ index: transfer.next.index, snapshots, progress })) return { kind: "invalid" }
    if (!current()) return { kind: "stale" }
    if (!reviewed()) return { kind: "review_required" }
    // Callbacks can change account scope synchronously too.
    if (!current()) return { kind: "stale" }
    committing = true
    const result = await input.port.commit(structuredClone(request))
    if (!current()) return { kind: "stale" }
    if (result.kind === "conflict") return { kind: "conflict" }
    const receipt = matchingReceipt(result.receipt)
    return receipt ? { kind: "committed", receipt } : { kind: "outcome_unknown" }
  } catch {
    return { kind: !current() ? "stale" : !receiptLookupCompleted || committing ? "outcome_unknown" : "unavailable" }
  }
}
