import { z } from "zod"
import { athleteRecordIdSchema, parseAthleteRecord, type AthleteRecord } from "../athlete-records"

export const ACCOUNT_ATHLETE_RECORD_NAMESPACE = "trainoracle.account.athlete-records.v1"

// Account storage confirms durability, never the athletic result's authority.
export const accountAthleteRecordSchema = z.unknown().transform((value, context): AthleteRecord => {
  const record = parseAthleteRecord(value, new Date())
  if (!record || record.enteredBy !== "ATHLETE" || record.verificationState !== "SELF_REPORTED") {
    context.addIssue({ code: "custom", message: "Invalid self-reported athlete record" })
    return z.NEVER
  }
  return record
})

export const accountAthleteRecordDocumentSchema = z.preprocess((value, context) => {
  try {
    if (new TextEncoder().encode(JSON.stringify(value)).byteLength <= 500_000) return value
  } catch { /* Invalid data must not escape into logs. */ }
  context.addIssue({ code: "custom", message: "Invalid or oversized athlete record collection" })
  return z.NEVER
}, z.object({
  version: z.literal(3),
  state: z.literal("ACCOUNT_STATE"),
  kind: z.literal("ATHLETE_RECORDS"),
  data: z.object({ records: z.array(accountAthleteRecordSchema) }).strict(),
}).strict().superRefine((document, context) => {
  if (new Set(document.data.records.map(record => record.id)).size !== document.data.records.length) {
    context.addIssue({ code: "custom", message: "Duplicate athlete record ID" })
  }
}))
export type AccountAthleteRecordDocument = z.infer<typeof accountAthleteRecordDocumentSchema>

export const accountAthleteRecordSnapshotSchema = z.object({
  documentId: z.uuid(),
  serverRevision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER - 1),
  recordId: athleteRecordIdSchema,
}).strict()
export type AccountAthleteRecordSnapshot = z.infer<typeof accountAthleteRecordSnapshotSchema>

export function validateAccountAthleteRecordDocument(value: unknown): boolean {
  return accountAthleteRecordDocumentSchema.safeParse(value).success
}

export function validateAccountAthleteRecordDocumentUpdate(previous: unknown, next: unknown): boolean {
  const before = accountAthleteRecordDocumentSchema.safeParse(previous)
  const after = accountAthleteRecordDocumentSchema.safeParse(next)
  if (!before.success || !after.success || before.data.data.records.length > after.data.data.records.length) return false
  // New entries append; existing IDs and their evidence cannot silently change.
  return before.data.data.records.every((record, index) =>
    JSON.stringify(record) === JSON.stringify(after.data.data.records[index]))
}
