import { z } from "zod"
import { fieldProvenanceSchema } from "./field-provenance"
import type { FieldProvenanceMap } from "./field-provenance"

export const MEMO_PURPOSE = {
  privateSelfOnly: "PRIVATE_SELF_ONLY",
  analyzableTrainingNote: "ANALYZABLE_TRAINING_NOTE",
} as const

export type MemoPurpose = (typeof MEMO_PURPOSE)[keyof typeof MEMO_PURPOSE]

export type GoalPace = {
  readonly schemaVersion: 1
  readonly unit: "seconds_per_kilometer"
  readonly secondsPerKm: number
}

export type JournalKind = "post-session" | "evening" | "race"

export type JournalEntryBase = {
  readonly id: string
  readonly kind: JournalKind
  readonly date: string
  readonly savedAt: string
  readonly syncState: "local" | "synced"
  readonly fieldProvenance?: FieldProvenanceMap
}

type PurposeScopedMemo = {
  readonly memoPurpose?: MemoPurpose
}

export type PostSessionEntry = JournalEntryBase & PurposeScopedMemo & {
  readonly kind: "post-session"
  readonly system: string
  readonly title: string
  readonly distanceKm: string
  readonly durationMin: string
  readonly avgPace: string
  readonly rpe: number
  readonly memo: string
}

export type EveningEntry = JournalEntryBase & PurposeScopedMemo & {
  readonly kind: "evening"
  readonly sleepH: number
  readonly sleepQuality: number
  readonly weightKg: string
  readonly restingHr: string
  readonly painParts: Readonly<Record<string, number>>
  readonly mood: number
  readonly note: string
}

export type RaceEntry = JournalEntryBase & PurposeScopedMemo & {
  readonly kind: "race"
  readonly stage: "pre" | "post"
  readonly record: string
  readonly rank: string
  readonly result: string
  readonly memo: string
  readonly tension?: number
  readonly condition?: number
  readonly mood?: number
  readonly goalPace?: GoalPace
}

export type JournalEntry = PostSessionEntry | EveningEntry | RaceEntry

const memoPurposeSchema = z.preprocess(
  (value) => value === MEMO_PURPOSE.privateSelfOnly || value === MEMO_PURPOSE.analyzableTrainingNote
    ? value
    : undefined,
  z.enum([MEMO_PURPOSE.privateSelfOnly, MEMO_PURPOSE.analyzableTrainingNote]).optional(),
)

const baseShape = {
  id: z.string().min(1),
  date: z.string().min(1),
  savedAt: z.string().min(1),
  syncState: z.enum(["local", "synced"]),
  fieldProvenance: fieldProvenanceSchema.optional(),
} as const

const purposeShape = {
  memoPurpose: memoPurposeSchema,
} as const

const postSessionSchema: z.ZodType<PostSessionEntry> = z.object({
  ...baseShape,
  ...purposeShape,
  kind: z.literal("post-session"),
  system: z.string(),
  title: z.string(),
  distanceKm: z.string(),
  durationMin: z.string(),
  avgPace: z.string(),
  rpe: z.number().int().min(0).max(10),
  memo: z.string(),
})

const eveningSchema: z.ZodType<EveningEntry> = z.object({
  ...baseShape,
  ...purposeShape,
  kind: z.literal("evening"),
  sleepH: z.number().min(0).max(24),
  sleepQuality: z.number().int().min(0).max(5),
  weightKg: z.string(),
  restingHr: z.string(),
  painParts: z.record(z.string(), z.number().int().min(0).max(5)),
  mood: z.number().int().min(0).max(5),
  note: z.string(),
})

const goalPaceSchema: z.ZodType<GoalPace> = z.object({
  schemaVersion: z.literal(1),
  unit: z.literal("seconds_per_kilometer"),
  secondsPerKm: z.number().int().positive(),
})

const raceSchema: z.ZodType<RaceEntry> = z.object({
  ...baseShape,
  ...purposeShape,
  kind: z.literal("race"),
  stage: z.enum(["pre", "post"]),
  record: z.string(),
  rank: z.string(),
  result: z.string(),
  memo: z.string(),
  tension: z.number().int().min(1).max(10).optional(),
  condition: z.number().int().min(1).max(5).optional(),
  mood: z.number().int().min(1).max(5).optional(),
  goalPace: goalPaceSchema.optional(),
})

const journalEntrySchema: z.ZodType<JournalEntry> = z.union([
  postSessionSchema,
  eveningSchema,
  raceSchema,
])

const journalEntryWriteSchema = journalEntrySchema.superRefine((entry, context) => {
  if (entry.syncState !== "local") {
    context.addIssue({
      code: "custom",
      message: "New journal entries must remain device-local until sync is implemented.",
      path: ["syncState"],
    })
  }

  if (entry.fieldProvenance === undefined) {
    context.addIssue({
      code: "custom",
      message: "New journal entries must record field provenance.",
      path: ["fieldProvenance"],
    })
  }

  const rawText = entry.kind === "evening" ? entry.note : entry.memo
  if (rawText.trim() !== "" && entry.memoPurpose === undefined) {
    context.addIssue({
      code: "custom",
      message: "Nonempty journal text requires an explicit memo purpose.",
      path: ["memoPurpose"],
    })
  }
})

export function parseJournalEntry(value: unknown): JournalEntry | null {
  const result = journalEntrySchema.safeParse(value)
  return result.success ? result.data : null
}

export function parseJournalEntryForWrite(value: unknown): JournalEntry | null {
  const result = journalEntryWriteSchema.safeParse(value)
  return result.success ? result.data : null
}

export function parseJournalEntryList(value: unknown): JournalEntry[] {
  const candidateList = z.array(z.unknown()).safeParse(value)
  if (!candidateList.success) return []

  const entries: JournalEntry[] = []
  for (const candidate of candidateList.data) {
    const entry = parseJournalEntry(candidate)
    if (entry !== null) entries.push(entry)
  }
  return entries
}

export function memoPurposeOf(entry: { readonly memoPurpose?: unknown }): MemoPurpose {
  return entry.memoPurpose === MEMO_PURPOSE.analyzableTrainingNote
    ? MEMO_PURPOSE.analyzableTrainingNote
    : MEMO_PURPOSE.privateSelfOnly
}

export function parseTargetPaceInput(minutesInput: string, secondsInput: string): GoalPace | null {
  const minutesText = minutesInput.trim()
  const secondsText = secondsInput.trim()
  if (minutesText === "" && secondsText === "") return null

  const colonMatch = /^(\d+):(\d{1,2})$/u.exec(minutesText)
  const splitMatch = /^(\d+)$/u.exec(minutesText)
  const secondsMatch = /^(\d{1,2})$/u.exec(secondsText)

  let minutes: number
  let seconds: number
  if (colonMatch !== null && secondsText === "") {
    const [, minutesPart, secondsPart] = colonMatch
    if (minutesPart === undefined || secondsPart === undefined) return null
    minutes = Number(minutesPart)
    seconds = Number(secondsPart)
  } else if (splitMatch !== null && secondsMatch !== null) {
    const [, minutesPart] = splitMatch
    const [, secondsPart] = secondsMatch
    if (minutesPart === undefined || secondsPart === undefined) return null
    minutes = Number(minutesPart)
    seconds = Number(secondsPart)
  } else {
    return null
  }

  if (seconds >= 60) return null
  const secondsPerKm = minutes * 60 + seconds
  if (!Number.isSafeInteger(secondsPerKm) || secondsPerKm <= 0) return null

  return { schemaVersion: 1, unit: "seconds_per_kilometer", secondsPerKm }
}
