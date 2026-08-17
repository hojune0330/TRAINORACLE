import { z } from "zod"
import {
  activePlanSchema,
  frameLengthSchema,
  legacyActivePlanSchema,
  plannedEnergyIntentSchema,
  sessionSlotSchema,
} from "./plan-session-schema"
import { isValidIsoDate } from "./dates"

const planEventGroupSchema = z.enum([
  "MIDDLE_DISTANCE",
  "FIVE_K",
  "TEN_K",
  "GENERAL_ENDURANCE",
])
const experienceBandSchema = z.enum([
  "NEW_TO_RUNNING",
  "DEVELOPING",
  "EXPERIENCED",
])
export const COMPETITION_DIVISIONS = [
  "ELEMENTARY",
  "MIDDLE_SCHOOL",
  "HIGH_SCHOOL",
  "COLLEGE",
  "OPEN",
  "MASTERS",
  "NO_REGISTERED_DIVISION",
  "NOT_PROVIDED",
] as const
const competitionDivisionSchema = z.enum(COMPETITION_DIVISIONS)
const secondSessionModeSchema = z.enum([
  "SINGLE_SESSION_ONLY",
  "RECOVERY_PM_ALLOWED",
])
const trainingTimePreferenceSchema = z.enum(["MORNING", "EVENING", "VARIES"])
const progressStateSchema = z.enum([
  "COMPLETED",
  "RESTED",
  "SKIPPED",
  "PAIN_CHECKIN",
])
const storedFrameLengthSchema = z.union([
  frameLengthSchema,
  z.literal(9.5),
])
const selectedStartDateSchema = z.string().refine(isValidIsoDate, {
  message: "Plan start date must use a real YYYY-MM-DD calendar date.",
})

export const planIntakeSchema = z.object({
  eventGroup: planEventGroupSchema,
  competitionDivision: competitionDivisionSchema,
  experienceBand: experienceBandSchema,
  availableDayCount: z.union([
    z.literal(3),
    z.literal(4),
    z.literal(5),
    z.literal(6),
    z.literal("EVERY_DAY"),
  ]),
  requestedFrameLength: z.union([frameLengthSchema, z.literal(9.5)]),
  trainingFocus: plannedEnergyIntentSchema,
  secondSessionMode: secondSessionModeSchema,
  trainingTimePreference: trainingTimePreferenceSchema,
  startDate: selectedStartDateSchema.optional(),
}).strict()

export const storedPlanIntakeSchema = z.object({
  eventGroup: planEventGroupSchema,
  competitionDivision: competitionDivisionSchema.optional(),
  experienceBand: experienceBandSchema,
  availableDayCount: z.union([
    z.literal(3),
    z.literal(4),
    z.literal(5),
    z.literal(6),
    z.literal("EVERY_DAY"),
  ]).optional(),
  requestedFrameLength: z.union([frameLengthSchema, z.literal(9.5)]).optional(),
  trainingFocus: plannedEnergyIntentSchema.optional(),
  secondSessionMode: secondSessionModeSchema.optional(),
  trainingTimePreference: trainingTimePreferenceSchema.optional(),
  startDate: selectedStartDateSchema.optional(),
}).strict()

export const progressSchema = z.object({
  sessionDay: z.number().int().positive(),
  sessionSlot: sessionSlotSchema.optional().default("AM"),
  state: progressStateSchema,
}).strict()

export const planHistorySchema = z.object({
  candidateId: z.string().min(1),
  candidateKind: z.enum(["BALANCED", "CONSERVATIVE"]),
  frameLengthDays: storedFrameLengthSchema,
  progress: z.array(progressSchema),
  archivedAt: z.string().datetime(),
}).strict()

const planAthleteEvidenceSchema = z.object({
  storedRecordCount: z.number().int().nonnegative(),
  goalRecordCount: z.number().int().nonnegative(),
  recentJournalSessionCount: z.number().int().nonnegative(),
}).strict()

const planBetaStateCommonShape = {
  intake: storedPlanIntakeSchema,
  progress: z.array(progressSchema),
  generatedAt: z.string().datetime(),
  athleteEvidence: planAthleteEvidenceSchema.optional(),
}
const planBetaStateV1BaseSchema = z.object({
  version: z.literal(1),
  ...planBetaStateCommonShape,
  activePlan: legacyActivePlanSchema,
}).strict()
const planBetaStateV2BaseSchema = z.object({
  version: z.literal(2),
  ...planBetaStateCommonShape,
  activePlan: activePlanSchema,
}).strict()
type ValidatedPlanBetaState = Omit<
  z.infer<typeof planBetaStateV2BaseSchema>,
  "version"
> & { readonly version: 1 | 2 }

function validatePlanBetaState(
  state: ValidatedPlanBetaState,
  context: z.RefinementCtx,
): void {
  const sessionsByDay = new Map<number, typeof state.activePlan.sessions>()
  const sessionKeys = new Set<string>()

  for (const session of state.activePlan.sessions) {
    const sessionKey = `${session.day}:${session.slot}`
    if (sessionKeys.has(sessionKey)) {
      addIssue(context, ["activePlan", "sessions"], "Duplicate plan session slot.")
    }
    sessionKeys.add(sessionKey)
    const daySessions = sessionsByDay.get(session.day) ?? []
    sessionsByDay.set(session.day, [...daySessions, session])

  }

  for (const sessions of sessionsByDay.values()) {
    if (sessions.length > 2) {
      addIssue(context, ["activePlan", "sessions"], "Too many sessions in one day.")
    }
    if (
      sessions.length === 2
      && state.intake.secondSessionMode !== "RECOVERY_PM_ALLOWED"
    ) {
      addIssue(context, ["intake", "secondSessionMode"], "Two sessions require explicit consent.")
    }
    if (sessions.filter((session) => session.role === "QUALITY").length > 1) {
      addIssue(context, ["activePlan", "sessions"], "Two QUALITY sessions require the review flow.")
    }
    if (sessions.some((session) => session.role === "QUALITY")) {
      for (const companion of sessions.filter((session) => session.role === "EASY")) {
        if (companion.prescription.rpe.minimum < 1 || companion.prescription.rpe.maximum > 3) {
          addIssue(context, ["activePlan", "sessions"], "A QUALITY companion must stay within RPE 1-3.")
        }
      }
    }
  }

  const progressKeys = new Set<string>()
  for (const progress of state.progress) {
    const progressKey = `${progress.sessionDay}:${progress.sessionSlot}`
    if (progressKeys.has(progressKey) || !sessionKeys.has(progressKey)) {
      addIssue(context, ["progress"], "Progress does not match one plan session.")
    }
    progressKeys.add(progressKey)
  }
}

const planBetaStateV1Schema = planBetaStateV1BaseSchema.superRefine(
  validatePlanBetaState,
)
const planBetaStateV2Schema = planBetaStateV2BaseSchema.superRefine(
  validatePlanBetaState,
)
const planBetaStateSchema = z.union([
  planBetaStateV2Schema,
  planBetaStateV1Schema.transform((state) => ({
    ...state,
    version: 2 as const,
  })),
])

export const planHistoryListSchema = z.array(planHistorySchema).max(5)

export type PlanBetaIntake = z.infer<typeof planIntakeSchema>
export type StoredPlanBetaIntake = z.infer<typeof storedPlanIntakeSchema>
export type CompetitionDivision = PlanBetaIntake["competitionDivision"]
export type StoredPlanProgress = z.infer<typeof progressSchema>
export type LegacyPlanBetaState = z.infer<typeof planBetaStateV1Schema>
export type PlanBetaStateV2 = z.infer<typeof planBetaStateV2Schema>
export type PlanBetaState = Omit<LegacyPlanBetaState, "version"> & {
  readonly version: 1 | 2
}
export type StoredPlanHistory = z.infer<typeof planHistorySchema>

export function parsePlanBetaState(candidate: unknown): PlanBetaStateV2 | null {
  const parsed = planBetaStateSchema.safeParse(candidate)
  return parsed.success ? parsed.data : null
}

function addIssue(
  context: z.RefinementCtx,
  path: readonly (string | number)[],
  message: string,
): void {
  context.addIssue({
    code: z.ZodIssueCode.custom,
    path: [...path],
    message,
  })
}
