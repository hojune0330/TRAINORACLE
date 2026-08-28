import { z } from "zod"
import {
  fieldProvenanceSchema,
  fieldProvenanceWriteSchema,
  isValidEntryFieldProvenance,
} from "./field-provenance"
import type { FieldProvenanceMap } from "./field-provenance"
import { sessionIntensityAssessmentSchema } from "./intensity-assessment"
import type { SessionIntensityAssessment } from "./intensity-assessment"
import { parsePaceText } from "./numeric-input"
import { isValidIsoDate } from "./dates"
import { plannedSessionLinkSchema } from "./planned-session-link"
import type { PlannedSessionLink } from "./planned-session-link"

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
  readonly intensityAssessment?: SessionIntensityAssessment
  readonly plannedSessionLink?: PlannedSessionLink
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

/**
 * 일지 날짜 — 달력에 실재하는 YYYY-MM-DD만 받는다.
 *
 * `z.string().min(1)`이던 시절에는 "2026-13-01"(13월)이나 "2026-02-30"이
 * 그대로 저장됐다.
 *
 * 실측한 피해 (2026-02-30, 50km 일지 하나를 심고 기준일 2026-03-01):
 *   thisWeekStats  -> 2세션 / 58km / 2일   (8km 일지 하나뿐인데 58km)
 *   그 일지 없을 때 -> 1세션 /  8km / 1일
 * `aggregates.entriesBetween`은 날짜를 문자열로만 비교하고
 * `isValidIsoDate`를 거치지 않는다. "2026-02-30"은 창(窓)
 * [2026-02-23, 2026-03-01] 안에 사전순으로 들어가므로 합계에 섞인다.
 *
 * 반면 `journal-archive.projectJournalArchive`와 `home-view-model`,
 * `plan-beta-flow`는 `isValidIsoDate`로 걸러낸다. 즉 같은 일지가
 * 주간 합계에는 있고 아카이브에는 없다 — 화면마다 다른 숫자를 본다.
 *
 * 걸러내기를 화면마다 더 붙이는 건 근본 수정이 아니다(빼먹은 화면이
 * 또 생긴다). 저장 관문에서 막는다.
 *
 * 참고: "2026-13-01"(13월)은 사전순으로 어떤 실제 월보다 크기 때문에
 * 주간 창에 걸리지 않아 합계는 오염시키지 않았다. 그래도 저장은
 * 막는다 — 우연히 안전한 것에 기대지 않는다.
 */
const journalDateSchema = z.string().refine(isValidIsoDate, {
  message: "달력에 없는 날짜예요",
})

const baseShape = {
  id: z.string().min(1),
  date: journalDateSchema,
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
  intensityAssessment: sessionIntensityAssessmentSchema.optional(),
  plannedSessionLink: plannedSessionLinkSchema.optional(),
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

  const rawText = entry.kind === "evening" ? entry.note : entry.memo
  if (rawText.trim() !== "" && entry.memoPurpose === undefined) {
    context.addIssue({
      code: "custom",
      message: "Nonempty journal text requires an explicit memo purpose.",
      path: ["memoPurpose"],
    })
  }

  if (entry.fieldProvenance === undefined) return

  if (!isValidEntryFieldProvenance(entry.kind, entry.fieldProvenance)) {
    context.addIssue({
      code: "custom",
      message: "Provenance metadata may only name fields on this journal entry.",
      path: ["fieldProvenance"],
    })
  }
})

export function parseJournalEntry(value: unknown): JournalEntry | null {
  const result = journalEntrySchema.safeParse(value)
  if (!result.success) return null
  const entry = result.data
  if (entry.fieldProvenance === undefined
    || isValidEntryFieldProvenance(entry.kind, entry.fieldProvenance)) return entry
  return { ...entry, fieldProvenance: {} }
}

export function parseJournalEntryForWrite(value: unknown): JournalEntry | null {
  if (typeof value !== "object" || value === null) return null
  const candidate = value as Record<string, unknown>
  if (candidate.fieldProvenance !== undefined && !fieldProvenanceWriteSchema.safeParse(candidate.fieldProvenance).success) {
    return null
  }
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
    const secondsPerKm = parsePaceText(minutesText)
    if (secondsPerKm === null) return null
    return { schemaVersion: 1, unit: "seconds_per_kilometer", secondsPerKm }
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
