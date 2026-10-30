import { z } from "zod"
import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"

/** Origin is independent of the route into TrainOracle. Metadata is not permission. */
export const providerOriginSchema = z.enum(["GARMIN", "COROS", "APPLE", "SAMSUNG", "WHOOP", "USER", "OTHER", "UNKNOWN"])
export const providerTransportSchema = z.enum(["PROVIDER_API", "FILE_UPLOAD", "HEALTHKIT", "HEALTH_CONNECT", "DIRECT_INPUT"])
export const providerDataFieldSchema = z.enum([
  "distanceKm", "durationMin", "distanceMeters", "durationSeconds", "avgPace", "sport",
  "date", "startedAt", "timeZone", "durationMeaning", "laps", "summary", "recommendation",
])
export type ProviderDataField = z.infer<typeof providerDataFieldSchema>
const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:@+-]{0,199}$/u)
const sourceSchema = z.strictObject({
  sourceId: identifier,
  originProvider: providerOriginSchema,
  transport: providerTransportSchema,
  assurance: z.enum(["PROVIDER_VERIFIED", "USER_DECLARED", "UNKNOWN"]),
})

export const providerDataLineageSchema = z.strictObject({
  schemaVersion: z.literal("PROVIDER_DATA_LINEAGE_V1"),
  sources: z.array(sourceSchema).min(1).max(64),
  fieldSources: z.partialRecord(providerDataFieldSchema, z.array(identifier).min(1).max(64)),
  fieldDependencies: z.partialRecord(providerDataFieldSchema, z.array(z.strictObject({
    sourceId: identifier, fields: z.array(providerDataFieldSchema).min(1).max(13),
  })).min(1).max(64)).optional(),
}).refine(value => {
  const sourceIds = value.sources.map(source => source.sourceId)
  const referenced = Object.values(value.fieldSources).flat()
  return new Set(sourceIds).size === sourceIds.length && referenced.length > 0
    && sourceIds.every(id => referenced.includes(id))
    && Object.values(value.fieldSources).every(ids => new Set(ids).size === ids.length && ids.every(id => sourceIds.includes(id)))
    && (["summary", "recommendation"] as const).every(field => !value.fieldSources[field] || value.fieldDependencies?.[field])
    && Object.entries(value.fieldDependencies ?? {}).every(([field, dependencies]) => {
      const expected = value.fieldSources[field as ProviderDataField]
      return expected && dependencies.length === expected.length
        && new Set(dependencies.map(dependency => dependency.sourceId)).size === dependencies.length
        && dependencies.every(dependency => expected.includes(dependency.sourceId)
          && new Set(dependency.fields).size === dependency.fields.length)
    })
}, { message: "INCONSISTENT_PROVIDER_LINEAGE" })
export type ProviderDataLineage = z.infer<typeof providerDataLineageSchema>

export function parseProviderDataLineage(value: unknown): ProviderDataLineage | null {
  const result = providerDataLineageSchema.safeParse(value)
  return result.success ? result.data : null
}

/** Separate identity: legacy activity content digests and physiological facts never change. */
export function providerLineageFingerprint(value: unknown): string | null {
  const lineage = parseProviderDataLineage(value)
  if (!lineage) return null
  return canonicalJsonFingerprint("trainoracle.provider-lineage.v1", {
    ...lineage,
    sources: [...lineage.sources].sort((a, b) => a.sourceId < b.sourceId ? -1 : a.sourceId > b.sourceId ? 1 : 0),
    fieldSources: Object.fromEntries(Object.entries(lineage.fieldSources).map(([field, ids]) => [field, [...ids].sort()])),
    ...(lineage.fieldDependencies ? { fieldDependencies: Object.fromEntries(Object.entries(lineage.fieldDependencies)
      .map(([field, dependencies]) => [field, dependencies.map(dependency => ({ ...dependency, fields: [...dependency.fields].sort() }))
        .sort((a, b) => a.sourceId < b.sourceId ? -1 : a.sourceId > b.sourceId ? 1 : 0)])) } : {}),
  })
}

/** A derivative keeps the union of every selected input; missing or conflicting lineage fails closed. */
export function deriveProviderDataLineage(
  inputs: readonly { readonly lineage: unknown; readonly fields: readonly ProviderDataField[] }[],
  outputFields: readonly ProviderDataField[],
): ProviderDataLineage | null {
  if (inputs.length === 0 || outputFields.length === 0) return null
  const sources = new Map<string, ProviderDataLineage["sources"][number]>()
  const dependencies = new Map<string, Set<ProviderDataField>>()
  for (const input of inputs) {
    const lineage = parseProviderDataLineage(input.lineage)
    if (!lineage || input.fields.length === 0) return null
    for (const field of input.fields) {
      const ids = lineage.fieldSources[field]
      if (!ids?.length) return null
      for (const id of ids) {
        const source = lineage.sources.find(value => value.sourceId === id)!
        const previous = sources.get(id)
        if (previous && (previous.originProvider !== source.originProvider || previous.transport !== source.transport
          || previous.assurance !== source.assurance)) return null
        sources.set(id, source)
        const sourceFields = lineage.fieldDependencies?.[field]?.find(dependency => dependency.sourceId === id)?.fields ?? [field]
        const selected = dependencies.get(id) ?? new Set<ProviderDataField>()
        for (const sourceField of sourceFields) selected.add(sourceField)
        dependencies.set(id, selected)
      }
    }
  }
  return parseProviderDataLineage({
    schemaVersion: "PROVIDER_DATA_LINEAGE_V1", sources: [...sources.values()],
    fieldSources: Object.fromEntries(outputFields.map(field => [field, [...sources.keys()]])),
    fieldDependencies: Object.fromEntries(outputFields.map(field => [field,
      [...dependencies].map(([sourceId, fields]) => ({ sourceId, fields: [...fields] }))])),
  })
}

const timestamp = z.iso.datetime({ offset: true }).refine(value => Number.isFinite(Date.parse(value)))
/** Only authenticated server-owned configuration may supply these grants. Never accept from a request. */
export const providerDataGrantSchema = z.strictObject({
  grantId: identifier,
  originProvider: z.enum(["GARMIN", "COROS", "APPLE", "SAMSUNG", "WHOOP", "OTHER"]),
  applicationId: z.literal("TRAINORACLE"),
  purpose: z.literal("SELF_HOSTED_INFERENCE"),
  hosting: z.literal("COMPANY_SELF_HOSTED"),
  approvedFields: z.array(providerDataFieldSchema).min(1),
  approvedTransports: z.array(providerTransportSchema).min(1),
  validFrom: timestamp,
  validUntil: timestamp,
  active: z.boolean(),
  evidenceReference: identifier,
  noTraining: z.literal(true),
  retention: z.literal("REQUEST_ONLY"),
}).refine(value => Date.parse(value.validFrom) < Date.parse(value.validUntil), { message: "INVALID_GRANT_WINDOW" })
export type ProviderDataGrant = z.infer<typeof providerDataGrantSchema>
export type ProviderDataUseDecision =
  | { readonly allowed: true; readonly grantIds: readonly string[]; readonly originProviders: readonly string[] }
  | { readonly allowed: false; readonly reason: "UNSUPPORTED_PURPOSE" | "CONSENT_REQUIRED" | "INVALID_TIME"
    | "MISSING_LINEAGE" | "MISSING_FIELD_LINEAGE" | "UNKNOWN_ORIGIN" | "UNVERIFIED_ORIGIN" | "PROVIDER_PERMISSION_REQUIRED" }

/** Pure shared policy, not an authorization endpoint. Server must resolve trusted lineage/consent/grants itself. */
export function evaluateProviderDataUse(input: {
  readonly lineage: unknown
  readonly requestedFields: readonly ProviderDataField[]
  readonly purpose: string
  readonly hosting: string
  readonly consentActive: boolean
  readonly grants: readonly unknown[]
  readonly now: string
}): ProviderDataUseDecision {
  const deny = (reason: Extract<ProviderDataUseDecision, { allowed: false }>["reason"]): ProviderDataUseDecision => ({ allowed: false, reason })
  if (input.purpose !== "SELF_HOSTED_INFERENCE" || input.hosting !== "COMPANY_SELF_HOSTED") return deny("UNSUPPORTED_PURPOSE")
  if (!input.consentActive) return deny("CONSENT_REQUIRED")
  if (!timestamp.safeParse(input.now).success) return deny("INVALID_TIME")
  const now = Date.parse(input.now)
  const lineage = parseProviderDataLineage(input.lineage)
  if (!lineage) return deny("MISSING_LINEAGE")
  if (input.requestedFields.length === 0) return deny("MISSING_FIELD_LINEAGE")
  const grants = input.grants.flatMap(value => {
    const grant = providerDataGrantSchema.safeParse(value)
    return grant.success ? [grant.data] : []
  })
  const grantIds = new Set<string>(), origins = new Set<string>()
  for (const field of input.requestedFields) {
    const sourceIds = lineage.fieldSources[field]
    if (!sourceIds?.length) return deny("MISSING_FIELD_LINEAGE")
    for (const id of sourceIds) {
      const source = lineage.sources.find(value => value.sourceId === id)!
      origins.add(source.originProvider)
      if (source.originProvider === "UNKNOWN") return deny("UNKNOWN_ORIGIN")
      if (source.originProvider === "USER") {
        if (source.transport !== "DIRECT_INPUT" || source.assurance === "UNKNOWN") return deny("UNVERIFIED_ORIGIN")
        continue
      }
      if (source.assurance !== "PROVIDER_VERIFIED") return deny("UNVERIFIED_ORIGIN")
      const dependencies = lineage.fieldDependencies?.[field]?.find(value => value.sourceId === id)?.fields ?? [field]
      const grant = grants.find(value => value.originProvider === source.originProvider && value.active
        && Date.parse(value.validFrom) <= now && now < Date.parse(value.validUntil)
        && value.approvedFields.includes(field) && dependencies.every(dependency => value.approvedFields.includes(dependency))
        && value.approvedTransports.includes(source.transport))
      if (!grant) return deny("PROVIDER_PERMISSION_REQUIRED")
      grantIds.add(grant.grantId)
    }
  }
  return { allowed: true, grantIds: [...grantIds].sort(), originProviders: [...origins].sort() }
}
