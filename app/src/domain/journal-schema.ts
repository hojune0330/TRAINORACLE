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

export type JournalCaptureDepth = "QUICK" | "DETAILED"
export type ActivityOutcome = "COMPLETED" | "PARTIAL" | "LIGHT_ACTIVITY" | "RESTED" | "SKIPPED"
export type ActivitySlot = "UNSPECIFIED" | "AM" | "PM" | "SINGLE"
export type RpeBand = "RPE_1_2" | "RPE_3_4" | "RPE_5_6" | "RPE_7_8" | "RPE_9_10" | "UNKNOWN"
export type ObjectiveDataState = "NONE" | "WAITING" | "REVIEW_REQUIRED" | "CONFIRMED" | "CONFLICT"
export type PlanExecutionRelation = "AS_PLANNED" | "MODIFIED" | "NOT_APPLICABLE" | "UNKNOWN"
export type PainCheckStatus = "NO_SIGNAL_REPORTED" | "SIGNAL_REPORTED" | "UNANSWERED"

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
  readonly captureDepth?: JournalCaptureDepth
  readonly activityOutcome?: ActivityOutcome
  readonly activitySlot?: ActivitySlot
  readonly rpeBand?: RpeBand
  readonly objectiveDataState?: ObjectiveDataState
  readonly planExecutionRelation?: PlanExecutionRelation
  readonly painCheckStatus?: PainCheckStatus
  readonly painParts?: Readonly<Record<string, number>>
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
  captureDepth: z.enum(["QUICK", "DETAILED"]).optional(),
  activityOutcome: z.enum(["COMPLETED", "PARTIAL", "LIGHT_ACTIVITY", "RESTED", "SKIPPED"]).optional(),
  activitySlot: z.enum(["UNSPECIFIED", "AM", "PM", "SINGLE"]).optional(),
  rpeBand: z.enum(["RPE_1_2", "RPE_3_4", "RPE_5_6", "RPE_7_8", "RPE_9_10", "UNKNOWN"]).optional(),
  objectiveDataState: z.enum(["NONE", "WAITING", "REVIEW_REQUIRED", "CONFIRMED", "CONFLICT"]).optional(),
  planExecutionRelation: z.enum(["AS_PLANNED", "MODIFIED", "NOT_APPLICABLE", "UNKNOWN"]).optional(),
  painCheckStatus: z.enum(["NO_SIGNAL_REPORTED", "SIGNAL_REPORTED", "UNANSWERED"]).optional(),
  painParts: z.record(z.string(), z.number().int().min(0).max(5)).optional(),
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

  if (entry.kind === "post-session") {
    const performed = entry.activityOutcome === "COMPLETED"
      || entry.activityOutcome === "PARTIAL"
      || entry.activityOutcome === "LIGHT_ACTIVITY"
    const didNotPerform = entry.activityOutcome === "RESTED" || entry.activityOutcome === "SKIPPED"
    const hasPain = Object.values(entry.painParts ?? {}).some((level) => level > 0)
    const hasObjectiveValue = entry.distanceKm.trim() !== ""
      || entry.durationMin.trim() !== ""
      || entry.avgPace.trim() !== ""

    if (entry.rpe > 0 && entry.rpeBand !== undefined) {
      context.addIssue({
        code: "custom",
        message: "Exact RPE and an RPE band cannot describe the same entry.",
        path: ["rpeBand"],
      })
    }

    if (entry.captureDepth === "QUICK" && entry.activityOutcome === undefined) {
      context.addIssue({
        code: "custom",
        message: "Quick journal entries require an explicit activity outcome.",
        path: ["activityOutcome"],
      })
    }

    if (entry.captureDepth === "QUICK" && performed) {
      if (entry.activitySlot === undefined || entry.activitySlot === "SINGLE") {
        context.addIssue({
          code: "custom",
          message: "Performed quick entries require an explicit time choice.",
          path: ["activitySlot"],
        })
      }
      if (entry.objectiveDataState !== "WAITING" && entry.objectiveDataState !== "CONFIRMED") {
        context.addIssue({
          code: "custom",
          message: "Performed quick entries must declare whether objective data is waiting or confirmed.",
          path: ["objectiveDataState"],
        })
      }
      if (entry.painCheckStatus === undefined || entry.painCheckStatus === "UNANSWERED") {
        context.addIssue({
          code: "custom",
          message: "Performed quick entries require an explicit post-activity body check.",
          path: ["painCheckStatus"],
        })
      }
    }

    if (didNotPerform) {
      if (entry.activitySlot !== undefined || entry.rpe !== 0 || entry.rpeBand !== undefined) {
        context.addIssue({
          code: "custom",
          message: "Rested or skipped entries cannot contain a time slot or effort value.",
          path: ["activityOutcome"],
        })
      }
      if (entry.objectiveDataState !== "NONE") {
        context.addIssue({
          code: "custom",
          message: "Rested or skipped entries have no waiting objective activity data.",
          path: ["objectiveDataState"],
        })
      }
      if (entry.system.trim() !== ""
        || entry.distanceKm.trim() !== ""
        || entry.durationMin.trim() !== ""
        || entry.avgPace.trim() !== ""
        || entry.intensityAssessment !== undefined) {
        context.addIssue({
          code: "custom",
          message: "Rested or skipped entries cannot retain performed-session facts.",
          path: ["activityOutcome"],
        })
      }
      if (entry.painCheckStatus !== undefined || entry.painParts !== undefined) {
        context.addIssue({
          code: "custom",
          message: "Rested or skipped entries cannot retain a post-activity body check.",
          path: ["painCheckStatus"],
        })
      }
      if (["activitySlot", "painCheckStatus", "painParts"].some(
        (field) => entry.fieldProvenance?.[field] !== undefined,
      )) {
        context.addIssue({
          code: "custom",
          message: "Rested or skipped entries cannot retain provenance for questions they did not answer.",
          path: ["fieldProvenance"],
        })
      }
      if (["system", "distanceKm", "durationMin", "avgPace", "rpe"].some(
        (field) => {
          const provenance = entry.fieldProvenance?.[field]
          return provenance !== undefined && provenance.provenance !== "MISSING"
        },
      ) || ["rpeBand", "plannedRpe", "objectiveComponents"].some(
        (field) => entry.fieldProvenance?.[field] !== undefined,
      )) {
        context.addIssue({
          code: "custom",
          message: "Rested or skipped entries may retain only missing provenance for cleared performed-session facts.",
          path: ["fieldProvenance"],
        })
      }
    }

    if (entry.painCheckStatus === "SIGNAL_REPORTED" && !hasPain) {
      context.addIssue({
        code: "custom",
        message: "A reported body signal requires at least one structured body-area level.",
        path: ["painParts"],
      })
    }
    if (entry.painCheckStatus === "NO_SIGNAL_REPORTED" && hasPain) {
      context.addIssue({
        code: "custom",
        message: "A no-signal check cannot coexist with a positive body-area level.",
        path: ["painCheckStatus"],
      })
    }

    if (entry.objectiveDataState === "CONFIRMED" && !hasObjectiveValue) {
      context.addIssue({
        code: "custom",
        message: "Confirmed objective data requires at least one objective value.",
        path: ["objectiveDataState"],
      })
    }

    if ((entry.planExecutionRelation === "AS_PLANNED" || entry.planExecutionRelation === "MODIFIED")
      && entry.plannedSessionLink === undefined) {
      context.addIssue({
        code: "custom",
        message: "A plan execution relation requires an explicit planned-session link.",
        path: ["planExecutionRelation"],
      })
    }
    if (entry.planExecutionRelation === "NOT_APPLICABLE" && entry.plannedSessionLink !== undefined) {
      context.addIssue({
        code: "custom",
        message: "A linked planned session cannot be marked not applicable.",
        path: ["planExecutionRelation"],
      })
    }

    if (entry.planExecutionRelation !== undefined) {
      const relationProvenance = entry.fieldProvenance?.planExecutionRelation
      const linkProvenance = entry.fieldProvenance?.plannedSessionLink
      const expectedLinkProvenance = entry.plannedSessionLink === undefined ? "MISSING" : "EXPLICIT"
      const relationInputs = relationProvenance?.provenance === "DERIVED"
        ? relationProvenance.derivedFrom.join("|")
        : undefined
      if (relationProvenance?.provenance !== "DERIVED"
        || relationProvenance.derivationRuleId !== "QUICK_PLAN_EXECUTION_RELATION_V2"
        // Legacy records were derived before AM/PM became a relation input. Keep them readable
        // and editable without rewriting history; new saves use the three-input derivation.
        || (relationInputs !== "activityOutcome|plannedSessionLink"
          && relationInputs !== "activityOutcome|activitySlot|plannedSessionLink")) {
        context.addIssue({
          code: "custom",
          message: "Plan execution relation must be derived from the chosen outcome, slot, and explicit plan link.",
          path: ["fieldProvenance", "planExecutionRelation"],
        })
      }
      if (linkProvenance?.provenance !== expectedLinkProvenance) {
        context.addIssue({
          code: "custom",
          message: "Planned-session link provenance must match whether an explicit link exists.",
          path: ["fieldProvenance", "plannedSessionLink"],
        })
      }
    }
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
