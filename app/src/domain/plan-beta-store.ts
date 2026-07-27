import { z } from "zod"
import type {
  PlanContinuityInput,
  PlanProgressState,
} from "@impl/plan-generator/types"

const STORAGE_KEY = "trainoracle.plan-beta.v1"
const HISTORY_KEY = "trainoracle.plan-beta.history.v1"
const PREVIOUS_INTAKE_KEY = "trainoracle.plan-beta.previous-intake.v1"

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
const plannedEnergyIntentSchema = z.enum([
  "RECOVERY_INTENT",
  "BASE_INTENT",
  "LT_INTENT",
  "VO2_INTENT",
  "GLY_INTENT",
  "ATP_PC_INTENT",
  "MIXED_INTENT",
])
const secondSessionModeSchema = z.enum([
  "SINGLE_SESSION_ONLY",
  "RECOVERY_PM_ALLOWED",
])
const sessionSlotSchema = z.enum(["AM", "PM"])
const frameLengthSchema = z.union([z.literal(7), z.literal(9), z.literal(10)])
const progressStateSchema = z.enum([
  "COMPLETED",
  "RESTED",
  "SKIPPED",
  "PAIN_CHECKIN",
])
const planSessionSchema = z.discriminatedUnion("role", [
  z.object({
    day: z.number().int().positive(),
    slot: z.literal("AM").optional().default("AM"),
    role: z.literal("REST"),
    plannedEnergyIntent: z.literal("RECOVERY_INTENT").optional().default("RECOVERY_INTENT"),
    prescription: z.object({ kind: z.literal("REST") }),
  }),
  z.object({
    day: z.number().int().positive(),
    slot: sessionSlotSchema.optional().default("AM"),
    role: z.literal("EASY"),
    plannedEnergyIntent: z.enum(["RECOVERY_INTENT", "BASE_INTENT"]).optional().default("BASE_INTENT"),
    prescription: z.object({
      kind: z.literal("RPE_TIME_RANGE"),
      rpe: z.object({
        minimum: z.number(),
        maximum: z.number(),
      }),
      durationMinutes: z.object({
        minimum: z.number(),
        maximum: z.number(),
      }),
    }),
  }),
  z.object({
    day: z.number().int().positive(),
    slot: z.literal("AM").optional().default("AM"),
    role: z.literal("QUALITY"),
    plannedEnergyIntent: z.enum([
      "LT_INTENT",
      "VO2_INTENT",
      "GLY_INTENT",
      "ATP_PC_INTENT",
      "MIXED_INTENT",
    ]).optional().default("MIXED_INTENT"),
    prescription: z.object({
      kind: z.literal("RPE_TIME_RANGE"),
      rpe: z.object({
        minimum: z.number(),
        maximum: z.number(),
      }),
      durationMinutes: z.object({
        minimum: z.number(),
        maximum: z.number(),
      }),
    }),
  }),
])
const planFrameSchema = z.object({
  lengthDays: frameLengthSchema,
  continuity: z.union([
    z.object({
      kind: z.literal("SEVEN_DAY_CONTINUITY"),
      nextFrameInput: z.literal("SELECTED_PLAN_AND_PROGRESS"),
    }),
    z.object({ kind: z.literal("STANDARD_FRAME") }),
  ]),
})
const activePlanSchema = z.object({
  kind: z.literal("BETA_ACTIVE_PLAN_SNAPSHOT"),
  activationState: z.literal("SELECTED_BETA_SNAPSHOT"),
  candidateId: z.string().min(1),
  candidateKind: z.enum(["BALANCED", "CONSERVATIVE"]),
  selectionActor: z.enum(["SELF", "COACH"]),
  sourceMode: z.enum(["PROFILE_ONLY", "JOURNAL_CONTEXT_ONLY"]),
  selectedEnergyIntent: plannedEnergyIntentSchema.optional().default("MIXED_INTENT"),
  frame: planFrameSchema,
  sessions: z.array(planSessionSchema).readonly(),
})
const planIntakeSchema = z.object({
  eventGroup: planEventGroupSchema,
  experienceBand: experienceBandSchema,
  availableDayCount: z.union([
    z.literal(3),
    z.literal(4),
    z.literal(5),
    z.literal(6),
    z.literal("EVERY_DAY"),
  ]),
  requestedFrameLength: frameLengthSchema,
  trainingFocus: plannedEnergyIntentSchema.optional().default("MIXED_INTENT"),
  secondSessionMode: secondSessionModeSchema.optional().default("SINGLE_SESSION_ONLY"),
})
const progressSchema = z.object({
  sessionDay: z.number().int().positive(),
  sessionSlot: sessionSlotSchema.optional().default("AM"),
  state: progressStateSchema,
})
const planHistorySchema = z.object({
  candidateId: z.string().min(1),
  candidateKind: z.enum(["BALANCED", "CONSERVATIVE"]),
  frameLengthDays: frameLengthSchema,
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
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["activePlan", "sessions"],
        message: "A plan may contain one session for each day and slot.",
      })
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
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["activePlan", "sessions"],
          message: "A PM beta session must be RPE 1-2 recovery support.",
        })
      }
      if (state.intake.secondSessionMode !== "RECOVERY_PM_ALLOWED") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["intake", "secondSessionMode"],
          message: "PM sessions require explicit second-session consent.",
        })
      }
      if (
        state.activePlan.candidateKind !== "BALANCED"
        || state.activePlan.selectedEnergyIntent === "RECOVERY_INTENT"
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["activePlan", "sessions"],
          message: "PM recovery support is limited to a non-recovery Balanced candidate.",
        })
      }
    }
  }

  for (const sessions of sessionsByDay.values()) {
    if (sessions.length > 2) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["activePlan", "sessions"],
        message: "A beta day may contain no more than AM and PM sessions.",
      })
    }
    if (sessions.some((session) => session.slot === "PM") && sessions.some((session) => session.role === "QUALITY")) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["activePlan", "sessions"],
        message: "A PM recovery session cannot share a day with quality training.",
      })
    }
  }

  const progressKeys = new Set<string>()
  for (const progress of state.progress) {
    const progressKey = `${progress.sessionDay}:${progress.sessionSlot}`
    if (progressKeys.has(progressKey) || !sessionKeys.has(progressKey)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["progress"],
        message: "Progress must reference one stored plan session exactly once.",
      })
    }
    progressKeys.add(progressKey)
  }
})
const planHistoryListSchema = z.array(planHistorySchema).max(5)

export type PlanBetaIntake = z.infer<typeof planIntakeSchema>
export type StoredActivePlan = z.infer<typeof activePlanSchema>
export type StoredPlanProgress = z.infer<typeof progressSchema>
export type PlanBetaState = z.infer<typeof planBetaStateSchema>
export type StoredPlanHistory = z.infer<typeof planHistorySchema>

export function loadPlanBetaState(): PlanBetaState | null {
  if (typeof window === "undefined") return null
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (raw === null) return null

  try {
    const json: unknown = JSON.parse(raw)
    const parsed = planBetaStateSchema.safeParse(json)
    return parsed.success ? parsed.data : null
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error
    return null
  }
}

export function savePlanBetaState(state: PlanBetaState): void {
  if (typeof window === "undefined") return
  const parsed = planBetaStateSchema.safeParse(state)
  if (!parsed.success) return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed.data))
}

export function updateStoredProgress(
  state: PlanBetaState,
  progress: StoredPlanProgress,
): PlanBetaState {
  const withoutSession = state.progress.filter(
    (item) => (
      item.sessionDay !== progress.sessionDay
      || item.sessionSlot !== progress.sessionSlot
    ),
  )
  return {
    ...state,
    progress: [...withoutSession, progress].sort((left, right) => (
      left.sessionDay - right.sessionDay
      || left.sessionSlot.localeCompare(right.sessionSlot)
    )),
  }
}

export function archiveAndClearActivePlan(state: PlanBetaState): PlanBetaIntake {
  if (typeof window !== "undefined") {
    const history: StoredPlanHistory = {
      candidateId: state.activePlan.candidateId,
      candidateKind: state.activePlan.candidateKind,
      frameLengthDays: state.activePlan.frame.lengthDays,
      progress: state.progress,
      archivedAt: new Date().toISOString(),
    }
    const previous = loadPlanHistory()
    window.localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify([history, ...previous].slice(0, 5)),
    )
    window.localStorage.removeItem(STORAGE_KEY)
    window.sessionStorage.setItem(
      PREVIOUS_INTAKE_KEY,
      JSON.stringify(state.intake),
    )
  }
  return state.intake
}

export function loadPreviousIntake(): PlanBetaIntake | null {
  if (typeof window === "undefined") return null
  const raw = window.sessionStorage.getItem(PREVIOUS_INTAKE_KEY)
  if (raw === null) return null

  try {
    const json: unknown = JSON.parse(raw)
    const parsed = planIntakeSchema.safeParse(json)
    return parsed.success ? parsed.data : null
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error
    return null
  }
}

export function loadPreviousContinuity(): PlanContinuityInput | undefined {
  const [latest] = loadPlanHistory()
  if (latest === undefined) return undefined

  const states: readonly PlanProgressState[] = [
    "COMPLETED",
    "RESTED",
    "SKIPPED",
    "PAIN_CHECKIN",
  ]
  return {
    previousCandidateKind: latest.candidateKind,
    progressStateCounts: states.map((state) => ({
      state,
      count: latest.progress.filter((item) => item.state === state).length,
    })),
  }
}

function loadPlanHistory(): readonly StoredPlanHistory[] {
  if (typeof window === "undefined") return []
  const raw = window.localStorage.getItem(HISTORY_KEY)
  if (raw === null) return []

  try {
    const json: unknown = JSON.parse(raw)
    const parsed = planHistoryListSchema.safeParse(json)
    return parsed.success ? parsed.data : []
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error
    return []
  }
}
