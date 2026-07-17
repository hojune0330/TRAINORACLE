import { z } from "zod"

export const FIELD_PROVENANCE = {
  explicit: "EXPLICIT",
  derived: "DERIVED",
  missing: "MISSING",
} as const

export type ExplicitFieldProvenance = {
  readonly provenance: "EXPLICIT"
}

export type MissingFieldProvenance = {
  readonly provenance: "MISSING"
}

export type DerivedFieldProvenance = {
  readonly provenance: "DERIVED"
  readonly derivedFrom: readonly string[]
  readonly derivationRuleId: string
}

export type FieldProvenance = ExplicitFieldProvenance | MissingFieldProvenance | DerivedFieldProvenance
export type FieldProvenanceMap = Readonly<Record<string, FieldProvenance>>
export type ProvenanceEntryKind = "post-session" | "evening" | "race"

const ENTRY_PROVENANCE_FIELDS: Readonly<Record<ProvenanceEntryKind, readonly string[]>> = {
  "post-session": ["distanceKm", "durationMin", "avgPace", "rpe", "plannedRpe", "objectiveComponents"],
  evening: ["sleepH", "sleepQuality", "weightKg", "restingHr", "painParts", "mood"],
  race: ["tension", "condition", "mood", "goalPace"],
}

const explicitSchema: z.ZodType<ExplicitFieldProvenance> = z.object({
  provenance: z.literal(FIELD_PROVENANCE.explicit),
}).strict()

const missingSchema: z.ZodType<MissingFieldProvenance> = z.object({
  provenance: z.literal(FIELD_PROVENANCE.missing),
}).strict()

const derivedSchema: z.ZodType<DerivedFieldProvenance> = z.object({
  provenance: z.literal(FIELD_PROVENANCE.derived),
  derivedFrom: z.array(z.string().min(1)).min(1),
  derivationRuleId: z.string().min(1),
}).strict()

const fieldProvenanceValueSchema = z.union([explicitSchema, missingSchema, derivedSchema])

export const fieldProvenanceWriteSchema: z.ZodType<FieldProvenanceMap> = z.record(
  z.string().min(1),
  fieldProvenanceValueSchema,
)

function sanitizePersistedFieldProvenance(value: unknown): FieldProvenanceMap | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined

  const sanitized: Record<string, FieldProvenance> = {}
  for (const [fieldName, candidate] of Object.entries(value)) {
    const parsed = fieldProvenanceValueSchema.safeParse(candidate)
    if (parsed.success) sanitized[fieldName] = parsed.data
  }
  return sanitized
}

export const fieldProvenanceSchema: z.ZodType<FieldProvenanceMap | undefined> = z.preprocess(
  sanitizePersistedFieldProvenance,
  fieldProvenanceWriteSchema.optional(),
)

const REGISTERED_DERIVATION_RULE_IDS: readonly string[] = []

export function explicitOrMissing(hasValue: boolean): ExplicitFieldProvenance | MissingFieldProvenance {
  return hasValue ? { provenance: FIELD_PROVENANCE.explicit } : { provenance: FIELD_PROVENANCE.missing }
}

export function isValidEntryFieldProvenance(kind: ProvenanceEntryKind, provenance: FieldProvenanceMap): boolean {
  const allowedFields = ENTRY_PROVENANCE_FIELDS[kind]
  return Object.entries(provenance).every(([fieldName, field]) => allowedFields.includes(fieldName)
    && (field.provenance !== FIELD_PROVENANCE.derived
      || field.derivedFrom.every((input) => allowedFields.includes(input))))
}

export function isEligibleForAnalysis(fieldName: string, provenance: FieldProvenanceMap | undefined): boolean {
  const current = provenance?.[fieldName]
  if (current === undefined) return false

  switch (current.provenance) {
    case FIELD_PROVENANCE.explicit:
      return true
    case FIELD_PROVENANCE.missing:
      return false
    case FIELD_PROVENANCE.derived:
      return REGISTERED_DERIVATION_RULE_IDS.includes(current.derivationRuleId)
        && !current.derivedFrom.includes(fieldName)
        && current.derivedFrom.every((inputName) => provenance?.[inputName]?.provenance === FIELD_PROVENANCE.explicit)
  }
}
