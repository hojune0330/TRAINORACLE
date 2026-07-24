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
    role: z.literal("REST"),
    prescription: z.object({ kind: z.literal("REST") }),
  }),
  z.object({
    day: z.number().int().positive(),
    role: z.enum(["EASY", "QUALITY"]),
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
  frame: planFrameSchema,
  sessions: z.array(planSessionSchema).readonly(),
})
const planIntakeSchema = z.object({
  eventGroup: planEventGroupSchema,
  experienceBand: experienceBandSchema,
  availableDayCount: z.union([z.literal(3), z.literal(4), z.literal(5)]),
  requestedFrameLength: frameLengthSchema,
})
const progressSchema = z.object({
  sessionDay: z.number().int().positive(),
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
  const withoutDay = state.progress.filter(
    (item) => item.sessionDay !== progress.sessionDay,
  )
  return {
    ...state,
    progress: [...withoutDay, progress].sort(
      (left, right) => left.sessionDay - right.sessionDay,
    ),
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
