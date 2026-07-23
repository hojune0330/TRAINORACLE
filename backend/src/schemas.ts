import { z } from "zod"

const stableIdSchema = z.string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/u)

const calendarDateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/u)
  .refine((value) => {
    const [yearText, monthText, dayText] = value.split("-")
    const year = Number(yearText)
    const month = Number(monthText)
    const day = Number(dayText)
    const parsed = new Date(Date.UTC(year, month - 1, day))
    return parsed.getUTCFullYear() === year
      && parsed.getUTCMonth() === month - 1
      && parsed.getUTCDate() === day
  }, "Invalid calendar date")

function explicitNumber(
  valueSchema: z.ZodNumber,
): z.ZodReadonly<z.ZodObject<{
  value: z.ZodNumber
  provenance: z.ZodLiteral<"EXPLICIT">
}>> {
  return z.object({
    value: valueSchema,
    provenance: z.literal("EXPLICIT"),
  }).strict().readonly()
}

const postSessionFieldsSchema = z.object({
  distanceKm: explicitNumber(z.number().finite().nonnegative().max(1_000)).optional(),
  durationMin: explicitNumber(z.number().finite().nonnegative().max(10_080)).optional(),
  rpe: explicitNumber(z.number().int().min(1).max(10)).optional(),
}).strict().readonly()

const eveningFieldsSchema = z.object({
  sleepH: explicitNumber(z.number().finite().nonnegative().max(24)).optional(),
  sleepQuality: explicitNumber(z.number().int().min(1).max(5)).optional(),
  weightKg: explicitNumber(z.number().finite().positive().max(500)).optional(),
  restingHr: explicitNumber(z.number().int().min(20).max(250)).optional(),
  mood: explicitNumber(z.number().int().min(1).max(5)).optional(),
}).strict().readonly()

const baseShape = {
  journalId: stableIdSchema,
  date: calendarDateSchema,
  savedAt: z.string().datetime({ offset: true }),
  memoServerState: z.literal("local_only"),
} as const

const postSessionEntrySchema = z.object({
  ...baseShape,
  kind: z.literal("post-session"),
  fields: postSessionFieldsSchema,
}).strict().readonly()

const eveningEntrySchema = z.object({
  ...baseShape,
  kind: z.literal("evening"),
  fields: eveningFieldsSchema,
}).strict().readonly()

export const structuredJournalEntrySchema = z.discriminatedUnion(
  "kind",
  [postSessionEntrySchema, eveningEntrySchema],
)

export const journalSyncBatchSchema = z.object({
  schemaVersion: z.literal(1),
  batchId: stableIdSchema,
  entries: z.array(structuredJournalEntrySchema).min(1).max(100).readonly(),
}).strict().readonly().superRefine((batch, context) => {
  const seen = new Set<string>()
  for (const [index, entry] of batch.entries.entries()) {
    if (seen.has(entry.journalId)) {
      context.addIssue({
        code: "custom",
        message: "Journal IDs must be unique within a sync batch.",
        path: ["entries", index, "journalId"],
      })
    }
    seen.add(entry.journalId)
  }
})

export type ExplicitNumber = z.infer<ReturnType<typeof explicitNumber>>
export type PostSessionFields = z.infer<typeof postSessionFieldsSchema>
export type EveningFields = z.infer<typeof eveningFieldsSchema>
export type PostSessionSyncEntry = z.infer<typeof postSessionEntrySchema>
export type EveningSyncEntry = z.infer<typeof eveningEntrySchema>
export type StructuredJournalEntry = z.infer<typeof structuredJournalEntrySchema>
export type JournalSyncBatch = z.infer<typeof journalSyncBatchSchema>
