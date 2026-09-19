import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { currentConfirmedAccountJournalRevision, readCurrentConfirmedAccountJournalProjection } from "../account/account-journal-projection"
import { activeLocalAccount, onLocalJournalScopeChange } from "../account/local-journal-ownership"
import { parseComparisonRelation, type ComparisonRelationV1 } from "./comparison-relation"
import { isProjectedFileObservation, projectFileObservation, type ProjectedFileObservation } from "./file-analysis"

declare const persistedReadBrand: unique symbol
export type PersistedComparisonReadContext = { readonly [persistedReadBrand]: true }

type Binding = {
  readonly ownerId: string
  readonly epoch: number
  readonly entryId: string
  readonly relationId: string
  readonly revision: number
  readonly relationFingerprint: string
  readonly observationFingerprint: string
}
const bindings = new WeakMap<object, Binding>()
const fingerprint = (value: unknown) => canonicalJsonFingerprint("trainoracle.comparison-persisted-read.v1", value)
let epoch = 0
let listening = false

function listen(): boolean {
  if (typeof window === "undefined") return false
  if (!listening) {
    const invalidate = () => { epoch += 1 }
    onLocalJournalScopeChange(invalidate)
    window.addEventListener("trainoracle:account-journals-changed", invalidate)
    listening = true
  }
  return true
}

function currentBinding(entryId: string, relationId: string): Binding | null {
  if (!listen()) return null
  const ownerId = activeLocalAccount(), revision = currentConfirmedAccountJournalRevision(entryId)
  if (ownerId === null || revision === null || !Number.isSafeInteger(revision) || revision < 1) return null
  const entry = readCurrentConfirmedAccountJournalProjection().find(value => value.id === entryId)
  if (!entry || entry.kind !== "post-session") return null
  const matches = (entry.comparisonRelations ?? []).filter(value => value.relationId === relationId)
  const relation = matches.length === 1 ? parseComparisonRelation(matches[0]) : null
  const projected = projectFileObservation(entry, { sourceContext: "ACCOUNT_CONFIRMED" })
  if (!relation || relation.releasedAt !== null || relation.journalId !== entryId || projected.status !== "ACCEPTED"
    || relation.contentRevisionFingerprint !== projected.observation.contentRevisionFingerprint) return null
  return { ownerId, epoch, entryId, relationId, revision,
    relationFingerprint: fingerprint(relation), observationFingerprint: fingerprint(projected.observation) }
}

/** Read-only capability from the service's current-session ACK, never an entry or flag supplied by the caller.
 * Restore validation remains server-owned. Plan identity, interpretation and mappings are checked by the comparison core.
 */
export function readPersistedComparisonReadContext(entryId: string, relationId: string): PersistedComparisonReadContext | null {
  try {
    const binding = currentBinding(entryId, relationId)
    if (binding === null) return null
    const token = Object.freeze({}) as PersistedComparisonReadContext
    bindings.set(token, binding)
    return token
  } catch { return null }
}

/** Re-check the exact current ACK on every use; copies, changed revisions and scope/projection ABA are not capabilities. */
export function matchesPersistedComparisonReadContext(context: PersistedComparisonReadContext,
  relation: ComparisonRelationV1, observation: ProjectedFileObservation, journalRevision: number): boolean {
  try {
    const bound = bindings.get(context)
    if (!bound || !isProjectedFileObservation(observation) || bound.epoch !== epoch
      || bound.ownerId !== activeLocalAccount() || bound.revision !== journalRevision
      || bound.relationFingerprint !== fingerprint(relation)
      || bound.observationFingerprint !== fingerprint(observation)) return false
    const current = currentBinding(bound.entryId, bound.relationId)
    return current !== null && current.epoch === bound.epoch && current.ownerId === bound.ownerId
      && current.revision === bound.revision && current.relationFingerprint === bound.relationFingerprint
      && current.observationFingerprint === bound.observationFingerprint
  } catch { return false }
}
