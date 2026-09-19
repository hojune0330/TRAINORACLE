import { z } from "zod"
import { hasCanonicalJsonTree } from "../plan-beta-schema"
import { plannedSessionLinkSchema, type PlannedSessionLink } from "../planned-session-link"
import { FILE_OBSERVATION_LIMITS } from "./file-observation"

const fingerprint = z.string().regex(/^sha256:[a-f0-9]{64}$/u)
const revision = z.number().int().positive().max(Number.MAX_SAFE_INTEGER - 2)
const time = z.string().datetime({ offset: true })
const recoveryMode = z.enum(["WALK", "JOG", "STAND", "WALK_OR_JOG", "WALK_OR_STAND", "ACTIVE_ROLL_ON"])

// Reuse the existing immutable identity validator without its unknown-key stripping.
const exactSessionReference = z.custom<PlannedSessionLink>(value => {
  if (!hasCanonicalJsonTree(value)) return false
  const parsed = plannedSessionLinkSchema.safeParse(value)
  return parsed.success && Object.keys(value as object).length === Object.keys(parsed.data).length
})

export const comparisonOriginalReferenceSchema = z.object({
  planFingerprint: fingerprint,
  session: exactSessionReference,
}).strict()
export type ComparisonOriginalReference = z.infer<typeof comparisonOriginalReferenceSchema>

export const comparisonSegmentMappingSchema = z.object({
  planSegmentId: z.string().min(1).max(512),
  sourceLapIndex: z.number().int().min(0).max(FILE_OBSERVATION_LIMITS.laps - 1),
  confirmedKind: z.enum(["WORK", "RECOVERY"]),
  confirmedTargetUnit: z.enum(["DISTANCE", "DURATION"]),
  // Separate interpretation: never rewrite source lap kind, time meaning or recovery.
  confirmedDurationMeaning: z.enum(["TIMER", "MOVING", "ELAPSED"]).nullable(),
  confirmedRecoveryMode: recoveryMode.nullable(),
}).strict()
export type ComparisonSegmentMapping = z.infer<typeof comparisonSegmentMappingSchema>

/** Single shared persistence contract. This is not a plannedSessionLink or authority grant. */
export const comparisonRelationSchema = z.object({
  schemaVersion: z.literal(1),
  relationId: z.string().uuid(),
  journalId: z.string().min(1).max(200),
  journalRevisionAtConfirmation: revision,
  contentRevisionFingerprint: fingerprint,
  observationInterpretationFingerprint: fingerprint,
  original: comparisonOriginalReferenceSchema,
  mappingVersion: z.literal(1),
  mappingConfirmation: z.literal("USER_CONFIRMED"),
  segmentMappings: z.array(comparisonSegmentMappingSchema).min(1).max(FILE_OBSERVATION_LIMITS.laps),
  createdAt: time,
  releasedAt: time.nullable(),
}).strict().superRefine((value, ctx) => {
  if (value.releasedAt !== null && Date.parse(value.releasedAt) < Date.parse(value.createdAt)) {
    ctx.addIssue({ code: "custom", path: ["releasedAt"], message: "Release precedes confirmation" })
  }
  const plans = new Set<string>(), laps = new Set<number>()
  for (const mapping of value.segmentMappings) {
    if (plans.has(mapping.planSegmentId) || laps.has(mapping.sourceLapIndex)) {
      ctx.addIssue({ code: "custom", path: ["segmentMappings"], message: "Mapping must be one to one" })
    }
    plans.add(mapping.planSegmentId)
    laps.add(mapping.sourceLapIndex)
    if (mapping.confirmedKind === "WORK" && mapping.confirmedRecoveryMode !== null) {
      ctx.addIssue({ code: "custom", path: ["segmentMappings"], message: "Work is not recovery" })
    }
  }
})
export type ComparisonRelationV1 = z.infer<typeof comparisonRelationSchema>

export function parseComparisonRelation(value: unknown): ComparisonRelationV1 | null {
  if (!hasCanonicalJsonTree(value)) return null
  const parsed = comparisonRelationSchema.safeParse(value)
  return parsed.success ? structuredClone(parsed.data) : null
}

/** Proposed CAS commands. The server reads PLAN itself; no client-supplied snapshot is accepted. */
export const confirmComparisonRelationRequestSchema = z.object({
  action: z.literal("confirmComparisonRelation"),
  documentId: z.string().uuid(),
  operationId: z.string().uuid(),
  expectedRevision: revision,
  relation: comparisonRelationSchema,
}).strict().superRefine((value, ctx) => {
  if (value.expectedRevision !== value.relation.journalRevisionAtConfirmation || value.relation.releasedAt !== null) {
    ctx.addIssue({ code: "custom", path: ["relation"], message: "Confirmation requires the expected revision and an active relation" })
  }
})
export type ConfirmComparisonRelationRequest = z.infer<typeof confirmComparisonRelationRequestSchema>

export const releaseComparisonRelationRequestSchema = z.object({
  action: z.literal("releaseComparisonRelation"),
  documentId: z.string().uuid(),
  operationId: z.string().uuid(),
  expectedRevision: revision,
  relationId: z.string().uuid(),
  releasedAt: time,
}).strict()
export type ReleaseComparisonRelationRequest = z.infer<typeof releaseComparisonRelationRequestSchema>
