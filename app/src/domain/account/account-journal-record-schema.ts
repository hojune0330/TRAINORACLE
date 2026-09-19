import { z } from "zod"
import { parseJournalEntryForWrite } from "../journal-schema"
import type { JournalEntry } from "../journal-schema"
import { canEditJournalEntry, keepsImportedObjectiveFacts, preserveJournalProvenance } from "../journal-edit-policy"
import { samePlannedSessionLink } from "../planned-session-link"
import { buildFileObservation, parseFileObservation, toFileObservationSummary } from "../import/file-observation"
import type { FileObservationV1 } from "../import/file-observation"
import { confirmComparisonRelationRequestSchema, releaseComparisonRelationRequestSchema } from "../import/comparison-relation"
import { projectFileObservation } from "../import/file-analysis"
import { prepareComparisonRelation, validateComparisonRelationBinding, validateComparisonRelationOriginalMapping,
  comparisonObservationInterpretationFingerprint, type ComparisonOriginalResolution } from "../import/file-plan-comparison"
import { comparisonRelationSchema } from "../import/comparison-relation"

/** Plaintext codec only for the approved encrypted account-storage path.
 * This does not authorize sharing, analytics, logging, or journal completion.
 */
export type AccountJournalRecord = {
  readonly version: 2 | 3
  readonly state: "FINALIZED"
  readonly kind: "JOURNAL"
  readonly entry: JournalEntry
}

// Validate JSON before parsing: never silently drop undefined, invoke getters/toJSON,
// or accept sparse arrays, non-finite numbers, cycles, or non-JSON objects.
function canonicalJson(value: unknown, ancestors = new Set<object>()): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value)
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value)
  if (typeof value !== "object" || value === null || ancestors.has(value)) throw new Error("Invalid document")
  const array = Array.isArray(value)
  if (!array && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
    throw new Error("Invalid document")
  }
  ancestors.add(value)
  try {
    const keys = Reflect.ownKeys(value).filter(key => !(array && key === "length"))
    if (keys.some(key => typeof key !== "string")) throw new Error("Invalid document")
    if (array && (keys.length !== value.length || keys.some((key, index) => key !== String(index)))) {
      throw new Error("Invalid document")
    }
    const parts = (keys as string[]).sort().map(key => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if (!descriptor?.enumerable || !("value" in descriptor)) throw new Error("Invalid document")
      return [key, canonicalJson(descriptor.value, ancestors)] as const
    })
    if (array) return `[${parts.sort((a, b) => Number(a[0]) - Number(b[0])).map(part => part[1]).join(",")}]`
    return `{${parts.map(([key, item]) => `${JSON.stringify(key)}:${item}`).join(",")}}`
  } finally {
    ancestors.delete(value)
  }
}

/** Returns null for every invalid document; raw parser errors never escape. */
export function parseAccountJournalRecord(value: unknown): AccountJournalRecord | null {
  try {
    const input = canonicalJson(value)
    const candidate = JSON.parse(input) as Record<string, unknown> | null
    if (candidate === null || ![2, 3].includes(candidate.version as number) || candidate.state !== "FINALIZED" || candidate.kind !== "JOURNAL") return null
    const entry = parseJournalEntryForWrite(candidate.entry)
    if (entry === null) return null
    if (candidate.version === 2 && entry.kind === "post-session"
      && (entry.fileObservation !== undefined || entry.comparisonRelations !== undefined)) return null
    const record: AccountJournalRecord = { version: candidate.version as 2 | 3, state: "FINALIZED", kind: "JOURNAL", entry }
    // Parser-added optional undefined values have no JSON representation.
    if (input !== canonicalJson(JSON.parse(JSON.stringify(record)))) return null
    return record
  } catch {
    return null
  }
}

export function validateAccountJournalRecord(value: unknown): value is AccountJournalRecord {
  return parseAccountJournalRecord(value) !== null
}

/** Existing immutable facts and provenance rules also apply at the server boundary. */
export type AccountJournalWritePurpose = "MIGRATION" | "FILE_OBSERVATION"

const sameJson = (left: unknown, right: unknown) => canonicalJson(left ?? null) === canonicalJson(right ?? null)
const objectiveFields = ["distanceKm", "durationMin", "avgPace"] as const

/** File-owned summaries must match; independent explicit facts survive owner backups. */
export function validateInitialFileObservationRecord(value: unknown): boolean {
  const record = parseAccountJournalRecord(value)
  if (record?.version !== 3 || record.entry.kind !== "post-session" || !record.entry.fileObservation) return false
  const observation = record.entry.fileObservation
  const summary = toFileObservationSummary(observation)
  return objectiveFields.every(field => record.entry.kind === "post-session"
    && (record.entry.fieldProvenance?.[field]?.provenance === "EXPLICIT" || record.entry[field] === summary[field]))
}

function validAttachment(previous: JournalEntry, next: JournalEntry, value: unknown): boolean {
  if (previous.kind !== "post-session" || next.kind !== "post-session" || previous.fileObservation
    || !validateInitialFileObservationRecord(value) || !next.fileObservation) return false
  const before = JSON.parse(JSON.stringify(previous))
  const after = JSON.parse(JSON.stringify(next))
  const expectedState = previous.objectiveDataState === "WAITING" && objectiveFields.some(field => next[field] !== "")
    ? "CONFIRMED" : previous.objectiveDataState
  if (next.objectiveDataState !== expectedState) return false
  for (const field of objectiveFields) {
    const provenance = previous.fieldProvenance?.[field]
    if (provenance?.provenance === "EXPLICIT"
      && (previous[field] !== next[field] || !sameJson(provenance, next.fieldProvenance?.[field]))) return false
    if (previous[field] !== "" && previous[field] !== next[field]
      && !(provenance?.provenance === "DERIVED" && provenance.derivedFrom.includes("import:activity-file"))) return false
    const expected = next[field] === "" ? { provenance: "MISSING" } : {
      provenance: "DERIVED", derivedFrom: ["import:activity-file"], derivationRuleId: `import:${next.fileObservation.format}`,
    }
    if (!sameJson(next.fieldProvenance?.[field], previous.fieldProvenance?.[field])
      && !sameJson(next.fieldProvenance?.[field], expected)) return false
    delete before[field]; delete after[field]
    if (before.fieldProvenance) delete before.fieldProvenance[field]
    if (after.fieldProvenance) delete after.fieldProvenance[field]
  }
  for (const field of ["fileObservation", "objectiveDataState", "savedAt"]) { delete before[field]; delete after[field] }
  return sameJson(before, after)
}

export const FILE_OBSERVATION_CORRECTION_FIELDS = [
  "startedAt", "timeZone", "sport", "distanceMeters", "durationSeconds", "durationMeaning", "laps", "confirmation",
] as const

/** Deterministic server proposal: no client entry, timestamp, provenance or authority fields. */
export function correctAccountJournalImportedObservation(
  previousValue: unknown, previousContentRevisionFingerprint: string,
  replacementValue: unknown, confirmedChangedFields: readonly string[],
): AccountJournalRecord | null {
  try {
    const previous = parseAccountJournalRecord(previousValue)
    const replacement = parseFileObservation(JSON.parse(canonicalJson(replacementValue)))
    if (previous?.version !== 3 || previous.entry.kind !== "post-session" || !previous.entry.fileObservation || !replacement) return null
    const original = previous.entry.fileObservation
    if (original.contentRevisionFingerprint !== previousContentRevisionFingerprint) return null
    const immutable = ["schemaVersion", "source", "format", "sourceProfile", "parserVersion", "sourceActivityId", "date",
      "sourceIdentityFingerprint", "sourceObservationKey"] as const
    if (immutable.some(field => !sameJson(original[field], replacement[field]))) return null
    const changed = FILE_OBSERVATION_CORRECTION_FIELDS.filter(field => !sameJson(original[field], replacement[field]))
    if (changed.length === 0 || !sameJson([...confirmedChangedFields].sort(), [...changed].sort())) return null
    const { schemaVersion: _version, source: _source, completeness: _completeness,
      sourceObservationKey: _key, contentRevisionFingerprint: _fingerprint, ...input } = replacement
    const observation: FileObservationV1 = buildFileObservation(input)
    if (!sameJson(observation, replacement)) return null
    const entry = { ...previous.entry, fileObservation: observation }
    const beforeSummary = toFileObservationSummary(original), summary = toFileObservationSummary(observation)
    for (const field of objectiveFields) {
      const provenance = entry.fieldProvenance?.[field]
      if (provenance?.provenance === "EXPLICIT") continue
      const fileOwned = provenance?.provenance === "DERIVED" && provenance.derivedFrom.includes("import:activity-file")
      // Legacy compatibility caches may lack provenance. Never relabel independent facts.
      if (!fileOwned && (provenance?.provenance === "DERIVED" || entry[field] !== beforeSummary[field])) continue
      entry[field] = summary[field]
      if (fileOwned && summary[field] === "") entry.fieldProvenance = { ...entry.fieldProvenance, [field]: { provenance: "MISSING" } }
      else if (fileOwned || provenance?.provenance === "MISSING" && beforeSummary[field] === "" && summary[field] !== "") {
        entry.fieldProvenance = { ...entry.fieldProvenance, [field]: {
          provenance: "DERIVED", derivedFrom: ["import:activity-file"], derivationRuleId: `import:${observation.format}`,
        } }
      }
    }
    return parseAccountJournalRecord({ ...previous, entry })
  } catch { return null }
}

export function validateAccountJournalRecordUpdate(previousValue: unknown, nextValue: unknown, purpose?: AccountJournalWritePurpose): boolean {
  const previousRecord = parseAccountJournalRecord(previousValue)
  const nextRecord = parseAccountJournalRecord(nextValue)
  if (!previousRecord || !nextRecord || (previousRecord.version === 3 && nextRecord.version === 2)) return false
  const previous = previousRecord.entry
  const next = nextRecord.entry
  if (previous.kind === "post-session" && next.kind === "post-session"
    && !sameJson(previous.comparisonRelations, next.comparisonRelations)) return false
  if (previousRecord.version !== nextRecord.version && purpose !== "FILE_OBSERVATION") return false
  if (purpose === "FILE_OBSERVATION") return validAttachment(previous, next, nextValue)
  if (previous.kind === "post-session" && next.kind === "post-session"
    && (!sameJson(previous.fileObservation, next.fileObservation)
      || previous.fileObservation && objectiveFields.some(field => previous[field] !== next[field]))) return false
  if (!previous || !next || previous.id !== next.id || previous.kind !== next.kind || previous.date !== next.date
    || !canEditJournalEntry(previous) || !keepsImportedObjectiveFacts(previous, next)) return false
  if (previous.kind === "post-session" && next.kind === "post-session"
    && !samePlannedSessionLink(previous.plannedSessionLink, next.plannedSessionLink)) return false
  try { return canonicalJson(JSON.parse(JSON.stringify(preserveJournalProvenance(previous, next)))) === canonicalJson(next) }
  catch { return false }
}

export const accountJournalRecordSchema = z.unknown().transform((value, context): AccountJournalRecord => {
  const record = parseAccountJournalRecord(value)
  if (record !== null) return record
  context.addIssue({ code: "custom", message: "Invalid account journal record" })
  return z.NEVER
})

/** Deterministic shape-only proposal for replay/client outbox. Fresh confirmation
 * additionally requires validateAccountJournalComparisonConfirmation on stored PLAN. */
export function applyAccountJournalComparisonMutation(previousValue: unknown, requestValue: unknown): AccountJournalRecord | null {
  try {
    const previous = parseAccountJournalRecord(previousValue)
    const request = JSON.parse(canonicalJson(requestValue))
    if (previous?.version !== 3 || previous.entry.kind !== "post-session" || !previous.entry.fileObservation) return null
    const relations = previous.entry.comparisonRelations ?? []
    if (request.action === "confirmComparisonRelation") {
      const parsed = confirmComparisonRelationRequestSchema.safeParse(request)
      if (!parsed.success || parsed.data.relation.journalId !== previous.entry.id
        || relations.some(value => value.relationId === parsed.data.relation.relationId)) return null
      return parseAccountJournalRecord({ ...previous, entry: { ...previous.entry,
        comparisonRelations: [...relations, parsed.data.relation] } })
    }
    const parsed = releaseComparisonRelationRequestSchema.safeParse(request)
    if (!parsed.success) return null
    const relation = relations.find(value => value.relationId === parsed.data.relationId)
    if (!relation || relation.releasedAt !== null) return null
    return parseAccountJournalRecord({ ...previous, entry: { ...previous.entry,
      comparisonRelations: relations.map(value => value === relation ? { ...value, releasedAt: parsed.data.releasedAt } : value) } })
  } catch { return null }
}

export function validateAccountJournalComparisonConfirmation(previousValue: unknown, request: unknown,
  original: ComparisonOriginalResolution): boolean {
  const previous = parseAccountJournalRecord(previousValue)
  const parsed = confirmComparisonRelationRequestSchema.safeParse(request)
  if (previous?.version !== 3 || previous.entry.kind !== "post-session" || !parsed.success) return false
  const projection = projectFileObservation(previous.entry, { formats: ["tcx", "csv", "json", "gpx"], sourceContext: "ACCOUNT_CONFIRMED" })
  return projection.status === "ACCEPTED"
    && prepareComparisonRelation(parsed.data, original, projection.observation, parsed.data.expectedRevision).status === "READY_FOR_PERSISTENCE"
}

/** Fresh owner restore receives an original resolved by authenticated server storage.
 * Historical claims are retained, not promoted to current observation confirmation. */
export function validateAccountJournalComparisonRestore(value: unknown, relationValue: unknown,
  original: ComparisonOriginalResolution): boolean {
  const record = parseAccountJournalRecord(value), relation = comparisonRelationSchema.safeParse(relationValue)
  if (record?.version !== 3 || record.entry.kind !== "post-session" || !relation.success
    || relation.data.journalId !== record.entry.id
    || validateComparisonRelationOriginalMapping(relation.data, original).status !== "VALID_ORIGINAL_MAPPING") return false
  const projection = projectFileObservation(record.entry, { formats: ["tcx", "csv", "json", "gpx"], sourceContext: "ACCOUNT_CONFIRMED" })
  if (projection.status !== "ACCEPTED") return false
  // Corrections intentionally retain stale relations. Their missing historical file is
  // not fabricated; strict read binding excludes them from current quantitative display.
  if (relation.data.contentRevisionFingerprint !== projection.observation.contentRevisionFingerprint
    || relation.data.observationInterpretationFingerprint !== comparisonObservationInterpretationFingerprint(projection.observation)) return true
  return validateComparisonRelationBinding({ ...relation.data, releasedAt: null },
    original, projection.observation, relation.data.journalRevisionAtConfirmation).status === "VALID_COMPARISON"
}
