import { z } from "zod"

export const FIELD_PROVENANCE = {
  explicit: "EXPLICIT",
  derived: "DERIVED",
  missing: "MISSING",
} as const

export type FieldProvenanceKind = (typeof FIELD_PROVENANCE)[keyof typeof FIELD_PROVENANCE]

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

export const fieldProvenanceSchema: z.ZodType<FieldProvenanceMap> = z.record(
  z.string().min(1),
  z.union([explicitSchema, missingSchema, derivedSchema]),
)

export function explicitOrMissing(hasValue: boolean): ExplicitFieldProvenance | MissingFieldProvenance {
  return hasValue ? { provenance: FIELD_PROVENANCE.explicit } : { provenance: FIELD_PROVENANCE.missing }
}

export function isEligibleForAnalysis(
  fieldName: string,
  provenance: FieldProvenanceMap | undefined,
): boolean {
  const current = provenance?.[fieldName]
  if (current === undefined || current.provenance === FIELD_PROVENANCE.missing) return false
  if (current.provenance === FIELD_PROVENANCE.explicit) return true

  return current.derivedFrom.every((inputName) => provenance?.[inputName]?.provenance === FIELD_PROVENANCE.explicit)
}
