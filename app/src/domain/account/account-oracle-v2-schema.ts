import { z } from "zod"
import { runningProfileAnswersSchema } from "../running-profile"
import { oracleProfileReadingSchema, oracleProfileRevisionSchema } from "../oracle-profile-snapshot"
import { accountRunningProfileDocumentSchema } from "./account-running-profile-schema"
import { oracleProfileContextSchema } from "../oracle-profile-context"

/** Compatible storage format; capability negotiation is required before any V2 write. */
export const accountOracleV2DocumentSchema = z.object({
  version: z.literal(3), state: z.literal("ACCOUNT_STATE"), kind: z.literal("RUNNING_PROFILE"),
  data: z.object({
    version: z.literal("RUNNING_PROFILE_V2"),
    status: z.enum(["ACTIVE", "DELETED"]),
    legacyAnswers: runningProfileAnswersSchema,
    legacyAnsweredAt: z.iso.datetime().nullable(),
    current: oracleProfileRevisionSchema.nullable(),
    readings: z.array(oracleProfileReadingSchema),
    context: oracleProfileContextSchema.optional(),
  }).strict(),
}).strict().superRefine((document, context) => {
  const data = document.data
  if (data.status === "DELETED" && (data.current !== null || data.legacyAnsweredAt !== null || data.readings.length || Object.keys(data.legacyAnswers).length || data.context !== undefined)) {
    context.addIssue({ code: "custom", path: ["data"], message: "Deleted profiles cannot retain active response material" })
  }
  const revisions = new Set<number>()
  for (const [index, reading] of data.readings.entries()) {
    if (!data.current || reading.source.revision > data.current.revision || revisions.has(reading.source.revision)) {
      context.addIssue({ code: "custom", path: ["data", "readings", index], message: "Invalid or duplicate historical revision" })
    }
    if (reading.source.revision === data.current?.revision && !same(reading.source, data.current)) {
      context.addIssue({ code: "custom", path: ["data", "readings", index], message: "Current evidence must agree" })
    }
    revisions.add(reading.source.revision)
  }
})
export type AccountOracleV2Document = z.infer<typeof accountOracleV2DocumentSchema>
export const accountOracleCompatibleDocumentSchema = z.union([accountRunningProfileDocumentSchema, accountOracleV2DocumentSchema])
export type AccountOracleCompatibleDocument = z.infer<typeof accountOracleCompatibleDocumentSchema>

export function emptyOracleV2Document(): AccountOracleV2Document {
  return { version: 3, state: "ACCOUNT_STATE", kind: "RUNNING_PROFILE", data: {
    version: "RUNNING_PROFILE_V2", status: "ACTIVE", legacyAnswers: {}, legacyAnsweredAt: null, current: null, readings: [],
  } }
}

export function validateInitialOracleV2Document(input: unknown): boolean {
  const next = accountOracleV2DocumentSchema.safeParse(input)
  return next.success && validateOracleV2Transition(emptyOracleV2Document(), next.data)
}

export function validateOracleV2Migration(previous: unknown, next: unknown): boolean {
  const before = accountRunningProfileDocumentSchema.safeParse(previous)
  const after = accountOracleV2DocumentSchema.safeParse(next)
  return before.success && after.success && same(prepareOracleV2Migration(before.data), after.data)
}

function same(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const ak = Object.keys(a).sort(), bk = Object.keys(b).sort()
  return ak.length === bk.length && ak.every((key, index) => key === bk[index]
    && same((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]))
}

/** No network or migration side effects. Source V1 document remains the caller's responsibility. */
export function prepareOracleV2Migration(input: unknown): AccountOracleV2Document {
  const previous = accountRunningProfileDocumentSchema.parse(input)
  return accountOracleV2DocumentSchema.parse({
    version: 3, state: "ACCOUNT_STATE", kind: "RUNNING_PROFILE",
    data: { version: "RUNNING_PROFILE_V2", status: "ACTIVE", legacyAnswers: previous.data.answers,
      legacyAnsweredAt: previous.data.answeredAt, current: null, readings: [] },
  })
}

/** This checks document integrity only; server authorization and CAS remain mandatory. */
export function validateOracleV2Transition(previous: unknown, next: unknown): boolean {
  const before = accountOracleV2DocumentSchema.safeParse(previous)
  const after = accountOracleV2DocumentSchema.safeParse(next)
  if (!before.success || !after.success) return false
  const a = before.data.data, b = after.data.data
  if (b.status === "DELETED") return true
  if (a.status === "DELETED") return false
  if (!same(a.legacyAnswers, b.legacyAnswers) || a.legacyAnsweredAt !== b.legacyAnsweredAt) return false
  if (a.current && !b.current) return false
  const changed = !same(a.current, b.current)
  if (changed && b.current?.revision !== (a.current?.revision ?? 0) + 1) return false
  if (changed && a.current && b.current && Date.parse(b.current.answeredAt) < Date.parse(a.current.answeredAt)) return false
  // Old snapshots can be removed, never rewritten or fabricated retrospectively.
  return b.readings.every(reading => {
    const existing = a.readings.find(item => item.source.revision === reading.source.revision)
    if (existing) return same(existing, reading)
    return same(reading.source, a.current) || same(reading.source, b.current)
  })
}
