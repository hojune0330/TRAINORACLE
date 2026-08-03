import { z } from "zod"
import {
  activePlanSchema,
  frameLengthSchema,
  plannedEnergyIntentSchema,
  sessionSlotSchema,
} from "./plan-session-schema"

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
const secondSessionModeSchema = z.enum([
  "SINGLE_SESSION_ONLY",
  "RECOVERY_PM_ALLOWED",
])
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

export const planIntakeSchema = z.object({
  eventGroup: planEventGroupSchema,
  experienceBand: experienceBandSchema,
  availableDayCount: z.union([
    z.literal(3),
    z.literal(4),
    z.literal(5),
    z.literal(6),
    z.literal("EVERY_DAY"),
  ]),
  requestedFrameLength: z.union([frameLengthSchema, z.literal(9.5)]),
  trainingFocus: plannedEnergyIntentSchema.optional().default("MIXED_INTENT"),
  secondSessionMode: secondSessionModeSchema.optional().default("SINGLE_SESSION_ONLY"),
})

export const progressSchema = z.object({
  sessionDay: z.number().int().positive(),
  sessionSlot: sessionSlotSchema.optional().default("AM"),
  state: progressStateSchema,
})

export const planHistorySchema = z.object({
  candidateId: z.string().min(1),
  candidateKind: z.enum(["BALANCED", "CONSERVATIVE"]),
  frameLengthDays: storedFrameLengthSchema,
  progress: z.array(progressSchema),
  archivedAt: z.string().datetime(),
})

const planBetaStateSchema = z.object({
  version: z.literal(1),
  intake: planIntakeSchema,
  activePlan: activePlanSchema,
  progress: z.array(progressSchema),
  generatedAt: z.string().datetime(),
}).superRefine((state, context) => {
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

    if (session.slot === "PM") {
      const isRecoverySupport = session.role === "EASY"
        && session.plannedEnergyIntent === "RECOVERY_INTENT"
        && session.prescription.kind === "RPE_TIME_RANGE"
        && session.prescription.rpe.minimum === 1
        && session.prescription.rpe.maximum === 2
      if (!isRecoverySupport) {
        addIssue(context, ["activePlan", "sessions"], "Invalid PM recovery support.")
      }
      if (state.intake.secondSessionMode !== "RECOVERY_PM_ALLOWED") {
        addIssue(context, ["intake", "secondSessionMode"], "PM consent is missing.")
      }
      if (
        state.activePlan.candidateKind !== "BALANCED"
        || state.activePlan.selectedEnergyIntent === "RECOVERY_INTENT"
      ) {
        addIssue(context, ["activePlan", "sessions"], "PM plan authority is invalid.")
      }
    }
  }

  for (const sessions of sessionsByDay.values()) {
    if (sessions.length > 2) {
      addIssue(context, ["activePlan", "sessions"], "Too many sessions in one day.")
    }
    if (
      sessions.some((session) => session.slot === "PM")
      && sessions.some((session) => session.role === "QUALITY")
    ) {
      addIssue(context, ["activePlan", "sessions"], "PM recovery cannot follow quality.")
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
})

export const planHistoryListSchema = z.array(planHistorySchema).max(5)

export type PlanBetaIntake = z.infer<typeof planIntakeSchema>
export type StoredPlanProgress = z.infer<typeof progressSchema>
export type PlanBetaState = z.infer<typeof planBetaStateSchema>
export type StoredPlanHistory = z.infer<typeof planHistorySchema>

export function parsePlanBetaState(candidate: unknown): PlanBetaState | null {
  const parsed = planBetaStateSchema.safeParse(candidate)
  return parsed.success ? parsed.data : null
}

function addIssue(
  context: z.RefinementCtx,
  path: readonly PropertyKey[],
  message: string,
): void {
  context.addIssue({
    code: z.ZodIssueCode.custom,
    path: [...path],
    message,
  })
}
