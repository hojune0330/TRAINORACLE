import { z } from "zod"
import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { hasCanonicalJsonTree, progressSchema } from "../plan-beta-schema"
import {
  ACCOUNT_PLAN_MAX_BYTES, accountPlanDocumentSchema,
  type AccountPlanDocument, type AccountPlanPacket,
} from "./account-plan-document-schema"

const fingerprint = z.string().regex(/^sha256:[a-f0-9]{64}$/u)
const snapshotSchema = z.object({
  version: z.literal(1), kind: z.literal("PLAN_SNAPSHOT"),
  // Wire shape only. The complete existing logical schema validates every packet below.
  id: fingerprint, planId: fingerprint, snapshot: z.unknown(),
}).strict()
const progressPartSchema = z.object({
  version: z.literal(1), kind: z.literal("PLAN_PROGRESS"),
  id: fingerprint, planId: fingerprint, snapshotId: fingerprint,
  progress: z.array(progressSchema).max(64), updatedAt: z.string(), archivedAt: z.string().nullable(),
}).strict()
const referenceSchema = z.object({
  planId: fingerprint, snapshotId: fingerprint, snapshotHash: fingerprint,
  progressId: fingerprint, progressHash: fingerprint,
}).strict()
const indexSchema = z.object({
  version: z.literal(1), kind: z.literal("PLAN_COLLECTION"),
  documentFingerprint: fingerprint, currentPlanId: fingerprint.nullable(),
  plans: z.array(referenceSchema).max(100),
}).strict()
const partsSchema = z.object({
  index: indexSchema, snapshots: z.array(snapshotSchema).max(100),
  progress: z.array(progressPartSchema).max(100),
}).strict()

/** Each index/snapshot/progress object is one physical document, not the parts wrapper. */
export type AccountPlanCollectionIndex = z.infer<typeof indexSchema>
export type AccountPlanSnapshotPart = Omit<z.infer<typeof snapshotSchema>, "snapshot"> & { snapshot: AccountPlanPacket }
export type AccountPlanProgressPart = z.infer<typeof progressPartSchema>
export type AccountPlanCollectionParts = {
  index: AccountPlanCollectionIndex
  snapshots: AccountPlanSnapshotPart[]
  progress: AccountPlanProgressPart[]
}

const hash = (value: unknown) => canonicalJsonFingerprint("trainoracle.account-plan-collection.v1", value)
const partId = (kind: "PLAN_SNAPSHOT", planId: string) => hash({ kind, planId })
const progressId = (part: Omit<AccountPlanProgressPart, "id">) => hash(part)
const fits = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).byteLength <= ACCOUNT_PLAN_MAX_BYTES
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

/**
 * Pure data codec. Throws for invalid logical input or an oversized physical part;
 * never evicts history. Logical validation omits only the monolithic byte guard.
 * IDs are owner-neutral data references, not authenticated storage addresses.
 */
export function splitAccountPlanCollection(source: AccountPlanDocument): AccountPlanCollectionParts {
  if (!hasCanonicalJsonTree(source)) throw new Error("Invalid account plan collection source")
  const parsed = accountPlanDocumentSchema.safeParse(source)
  if (!parsed.success) throw new Error("Invalid account plan collection source")
  const document = clone(source)
  const snapshots: AccountPlanSnapshotPart[] = [], progress: AccountPlanProgressPart[] = []
  const plans = document.data.plans.map(entry => {
    const snapshot: AccountPlanSnapshotPart = { version: 1, kind: "PLAN_SNAPSHOT",
      id: partId("PLAN_SNAPSHOT", entry.planId), planId: entry.planId, snapshot: entry.snapshot }
    const revision: Omit<AccountPlanProgressPart, "id"> = { version: 1, kind: "PLAN_PROGRESS",
      planId: entry.planId, snapshotId: snapshot.id,
      progress: entry.progress, updatedAt: entry.updatedAt, archivedAt: entry.archivedAt }
    const mutable: AccountPlanProgressPart = { ...revision, id: progressId(revision) }
    if (!fits(snapshot) || !fits(mutable)) throw new Error("Account plan collection part exceeds byte capacity")
    snapshots.push(snapshot); progress.push(mutable)
    return { planId: entry.planId, snapshotId: snapshot.id, snapshotHash: hash(snapshot),
      progressId: mutable.id, progressHash: hash(mutable) }
  })
  const index: AccountPlanCollectionIndex = { version: 1, kind: "PLAN_COLLECTION",
    documentFingerprint: hash(document), currentPlanId: document.data.currentPlanId, plans }
  if (!fits(index)) throw new Error("Account plan collection part exceeds byte capacity")
  return { index, snapshots, progress }
}

/**
 * Fail closed on incomplete/mixed/corrupted sets; physical arrays may arrive in any order.
 * Hashes bind exact contents, not authority: a fully rewritten/rehashed valid collection
 * is not authenticated by this codec. Owner/CAS/update and independent evidence checks
 * remain the caller's responsibility. No stored evidence is promoted to a trusted registry.
 */
export function joinAccountPlanCollection(parts: unknown): AccountPlanDocument | null {
  try {
    if (!hasCanonicalJsonTree(parts)) return null
    // Bound raw physical inputs before packet readers or schema parsing can normalize them.
    const raw = parts as AccountPlanCollectionParts
    if (!raw || !Array.isArray(raw.snapshots) || !Array.isArray(raw.progress)
      || raw.snapshots.length > 100 || raw.progress.length > 100 || !fits(raw.index)
      || !raw.snapshots.every(fits) || !raw.progress.every(fits)) return null
    const parsed = partsSchema.safeParse(parts)
    if (!parsed.success) return null
    // Validate with Zod, but hash the raw data: defaults must not conceal tampering.
    const { index, snapshots, progress } = raw
    if (snapshots.length !== index.plans.length || progress.length !== index.plans.length) return null
    const snapshotMap = new Map(snapshots.map(part => [part.id, part]))
    const progressMap = new Map(progress.map(part => [part.id, part]))
    if (snapshotMap.size !== snapshots.length || progressMap.size !== progress.length) return null
    const seen = new Set<string>()
    const plans = []
    for (const ref of index.plans) {
      if (seen.has(ref.planId)) return null
      seen.add(ref.planId)
      const snapshot = snapshotMap.get(ref.snapshotId), mutable = progressMap.get(ref.progressId)
      if (!mutable) return null
      const { id: revisionId, ...revision } = mutable
      if (!snapshot || snapshot.planId !== ref.planId || mutable.planId !== ref.planId
        || ref.snapshotId !== partId("PLAN_SNAPSHOT", ref.planId)
        || revisionId !== progressId(revision)
        || mutable.snapshotId !== ref.snapshotId
        || hash(snapshot) !== ref.snapshotHash || hash(mutable) !== ref.progressHash) return null
      plans.push({ planId: ref.planId, snapshot: snapshot.snapshot, progress: mutable.progress,
        updatedAt: mutable.updatedAt, archivedAt: mutable.archivedAt })
    }
    const document: AccountPlanDocument = { version: 3, state: "ACCOUNT_STATE", kind: "PLAN",
      data: { schemaVersion: 1, currentPlanId: index.currentPlanId, plans } }
    if (hash(document) !== index.documentFingerprint) return null
    const logical = accountPlanDocumentSchema.safeParse(document)
    return logical.success ? clone(document) : null
  } catch { return null }
}
