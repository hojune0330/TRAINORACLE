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
  "post-session": [
    "system", "distanceKm", "durationMin", "avgPace", "rpe", "rpeBand",
    "activityOutcome", "activitySlot", "planExecutionRelation", "painCheckStatus",
    "painParts", "plannedSessionLink", "plannedRpe", "objectiveComponents",
  ],
  evening: ["sleepH", "sleepQuality", "weightKg", "restingHr", "painParts", "mood"],
  race: ["tension", "condition", "mood", "goalPace"],
}

/**
 * 외부에서 가져온 값의 파생 입력 토큰.
 *
 * 일지 필드 이름이 아니라 "값이 어디서 왔는지"를 가리키는 고정 토큰이며,
 * 기기 데이터 가져오기(파일 업로드)가 만든 값에만 쓴다.
 *
 * 분석 자격과는 무관하다 — 이 토큰은 `provenance` 맵에 EXPLICIT 항목으로
 * 존재하지 않으므로 `isEligibleForAnalysis`는 항상 false를 돌려준다.
 * 즉 가져온 값은 일지에서는 보이지만 통계·추이·훈련계획 입력에서는 제외된다.
 * 포함 여부를 열려면 별도 오너 결정으로 파생 규칙 ID를 등록해야 한다.
 */
export const EXTERNAL_DERIVATION_INPUTS = ["import:activity-file"] as const

export type ExternalDerivationInput = (typeof EXTERNAL_DERIVATION_INPUTS)[number]

function isAllowedDerivationInput(inputName: string, allowedFields: readonly string[]): boolean {
  return allowedFields.includes(inputName)
    || (EXTERNAL_DERIVATION_INPUTS as readonly string[]).includes(inputName)
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

/** 이 필드가 외부 기기 데이터 가져오기로 채워졌는지 — 출처 배지 표시용 */
export function isImportedField(fieldName: string, provenance: FieldProvenanceMap | undefined): boolean {
  const current = provenance?.[fieldName]
  if (current === undefined || current.provenance !== FIELD_PROVENANCE.derived) return false
  return current.derivedFrom.some((inputName) =>
    (EXTERNAL_DERIVATION_INPUTS as readonly string[]).includes(inputName))
}

/** 일지 한 건이 가져온 기록인지 — 필드 하나라도 외부 출처면 true */
export function hasImportedField(provenance: FieldProvenanceMap | undefined): boolean {
  if (provenance === undefined) return false
  return Object.keys(provenance).some((fieldName) => isImportedField(fieldName, provenance))
}

export function explicitOrMissing(hasValue: boolean): ExplicitFieldProvenance | MissingFieldProvenance {
  return hasValue ? { provenance: FIELD_PROVENANCE.explicit } : { provenance: FIELD_PROVENANCE.missing }
}

export function derivedProvenance(
  derivedFrom: readonly string[],
  derivationRuleId: string,
): DerivedFieldProvenance {
  return { provenance: FIELD_PROVENANCE.derived, derivedFrom, derivationRuleId }
}

export function isValidEntryFieldProvenance(kind: ProvenanceEntryKind, provenance: FieldProvenanceMap): boolean {
  const allowedFields = ENTRY_PROVENANCE_FIELDS[kind]
  return Object.entries(provenance).every(([fieldName, field]) => allowedFields.includes(fieldName)
    && (field.provenance !== FIELD_PROVENANCE.derived
      || field.derivedFrom.every((input) => isAllowedDerivationInput(input, allowedFields))))
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
        // 외부 가져오기 토큰이 섞인 값은 규칙이 등록되어도 분석에 넣지 않는다.
        && !current.derivedFrom.some((inputName) =>
          (EXTERNAL_DERIVATION_INPUTS as readonly string[]).includes(inputName))
        && current.derivedFrom.every((inputName) => provenance?.[inputName]?.provenance === FIELD_PROVENANCE.explicit)
  }
}
