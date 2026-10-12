import { z } from "zod"
import type { FieldProvenanceMap } from "./field-provenance"
import { BODY_PARTS } from "../components/body-parts"

export const OTHER_BODY_PART_LABEL_LIMIT = 48
export const OTHER_BODY_PART_NOTE_LIMIT = 500
export const OTHER_BODY_PART_COUNT_LIMIT = 20
export type OtherBodyPartId = `other_${string}`
export type OtherBodyPartObservation = {
  readonly id: OtherBodyPartId
  readonly labelSnapshot: string
  readonly severity: 1 | 2 | 3 | 4 | 5
  readonly note?: string
}
/** Owner-private JOURNAL companion. Severity is stored here exactly once.
 * Labels, notes and stable IDs must never enter analytics, logs or models. */
export type BodyPartMetadataV1 = {
  readonly schemaVersion: 1
  readonly observations: readonly OtherBodyPartObservation[]
}

const opaqueId = /^other_[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u
const forbiddenLabelCharacters = /[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u
export const bodyPartMetadataSchema: z.ZodType<BodyPartMetadataV1> = z.object({
  schemaVersion: z.literal(1),
  observations: z.array(z.object({
    id: z.custom<OtherBodyPartId>(value => typeof value === "string" && opaqueId.test(value)),
    labelSnapshot: z.string().min(1).max(OTHER_BODY_PART_LABEL_LIMIT)
      .refine(value => value.trim() === value && !forbiddenLabelCharacters.test(value)),
    severity: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
    note: z.string().max(OTHER_BODY_PART_NOTE_LIMIT).refine(value => !value.includes("\u0000")).optional(),
  }).strict()).max(OTHER_BODY_PART_COUNT_LIMIT),
}).strict().refine(value => new Set(value.observations.map(item => item.id)).size === value.observations.length)

export function parseBodyPartMetadata(value: unknown): BodyPartMetadataV1 | null {
  try {
    const parsed = bodyPartMetadataSchema.safeParse(value)
    return parsed.success ? parsed.data : null
  } catch { return null }
}

export function createOtherBodyPartId(): OtherBodyPartId {
  return `other_${crypto.randomUUID()}`
}

type BodySignalSource = { readonly painParts?: Readonly<Record<string, number>>; readonly bodyPartMetadata?: unknown; readonly fieldProvenance?: FieldProvenanceMap }
const fixedPartKeys = new Map<string, string>(BODY_PARTS.flatMap(part => [[part.id, part.id] as const, [part.name, part.id] as const]))

/** Read-only numeric adapter. Unknown legacy keys and private IDs become generic
 * keys; no inferred location or name is carried across this boundary. */
export function journalPainPartsForSafety(entry: BodySignalSource): Readonly<Record<string, number>> {
  const parts: Record<string, number> = {}
  let legacy = 0
  for (const [id, severity] of Object.entries(entry.painParts ?? {})) {
    if (Number.isInteger(severity) && severity >= 0 && severity <= 5) {
      const fixedId = fixedPartKeys.get(id)
      parts[fixedId !== undefined && !Object.hasOwn(parts, fixedId) ? fixedId : `legacy_other_${++legacy}`] = severity
    }
  }
  const metadata = parseBodyPartMetadata(entry.bodyPartMetadata)
  if (metadata !== null) metadata.observations.forEach((item, index) => { parts[`other_${index + 1}`] = item.severity })
  // An unfamiliar version must stop the consumer, not invent a severity.
  else if (entry.bodyPartMetadata !== undefined) throw new Error("BODY_METADATA_UNSUPPORTED")
  return parts
}

export function journalHasPainSignal(entry: BodySignalSource): boolean {
  if (journalBodyMetadataNeedsReview(entry)) return true
  return Object.values(journalPainPartsForSafety(entry)).some(value => value > 0)
}

export function journalBodyMetadataNeedsReview(entry: BodySignalSource): boolean {
  return entry.bodyPartMetadata !== undefined && parseBodyPartMetadata(entry.bodyPartMetadata) === null
}

/** Before replacing a complete journal array, retain every unsupported private
 * companion in the original bytes. A partial parser is not a migration. */
export function bodyPartMetadataSnapshotSupported(raw: string | null): boolean {
  if (raw === null) return true
  try {
    const entries: unknown = JSON.parse(raw)
    if (!Array.isArray(entries)) return false
    return entries.every(entry => typeof entry !== "object" || entry === null
      || !Object.hasOwn(entry, "bodyPartMetadata")
      || parseBodyPartMetadata((entry as { bodyPartMetadata?: unknown }).bodyPartMetadata) !== null)
  } catch { return false }
}

export function journalWriteRetainsBodyMetadata(raw: string | null, next: readonly { readonly id: string; readonly bodyPartMetadata?: unknown }[]): boolean {
  if (!bodyPartMetadataSnapshotSupported(raw)
    || next.some(entry => entry.bodyPartMetadata !== undefined && parseBodyPartMetadata(entry.bodyPartMetadata) === null)) return false
  if (raw === null) return true
  try {
    const previous = JSON.parse(raw) as Record<string, unknown>[]
    const replacements = new Map(next.map(entry => [entry.id, entry]))
    return previous.every(entry => {
      if (entry === null || typeof entry !== "object" || entry.bodyPartMetadata === undefined) return true
      const replacement = replacements.get(entry.id as string)
      return replacement === undefined || replacement.bodyPartMetadata !== undefined
    })
  } catch { return false }
}

/** An older editor must not erase a companion it cannot edit. Explicit removal
 * uses a supported empty observations list, never omission. */
export function keepsBodyPartMetadata(previous: BodySignalSource, next: BodySignalSource): boolean {
  return previous.bodyPartMetadata === undefined || next.bodyPartMetadata !== undefined
}

/** A backup without the new section has no authority to delete existing labels. */
export function preserveBodyPartMetadataForRestore<T extends BodySignalSource>(previous: T | undefined, next: T): T {
  return previous?.bodyPartMetadata !== undefined && next.bodyPartMetadata === undefined
    ? { ...next, bodyPartMetadata: previous.bodyPartMetadata,
      ...(next.painParts === undefined ? {} : { painParts: Object.fromEntries(Object.entries(next.painParts)
        .filter(([id]) => !/^other_[1-9]\d*$/u.test(id))) }),
      fieldProvenance: { ...next.fieldProvenance,
        ...(previous.fieldProvenance?.painParts === undefined ? {} : { painParts: previous.fieldProvenance.painParts }) },
    } : next
}
