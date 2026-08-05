import { z } from "zod"

export const plannedEnergyIntentSchema = z.enum([
  "RECOVERY_INTENT",
  "BASE_INTENT",
  "LT_INTENT",
  "VO2_INTENT",
  "GLY_INTENT",
  "ATP_PC_INTENT",
  "MIXED_INTENT",
])
export const sessionSlotSchema = z.enum(["AM", "PM"])
export const frameLengthSchema = z.union([z.literal(7), z.literal(9), z.literal(10)])

const enteredBySchema = z.enum(["ATHLETE", "COACH", "VERIFIED_IMPORT"])
const verificationStateSchema = z.enum(["VERIFIED", "SELF_REPORTED", "UNVERIFIED"])
const currentAnchorBase = {
  anchorId: z.string().min(1),
  eventDistanceM: z.number().finite().min(60),
  performanceSeconds: z.number().finite().positive(),
  achievedAt: z.string().min(1),
  enteredBy: enteredBySchema,
  verificationState: verificationStateSchema,
  freshnessState: z.literal("CURRENT"),
  sourceRef: z.string().min(1),
  elapsedLabel: z.string().min(1),
}
const currentAnchorSchema = z.discriminatedUnion("kind", [
  z.object({
    ...currentAnchorBase,
    kind: z.literal("RECENT_RESULT"),
    purpose: z.literal("CURRENT_CAPABILITY"),
    seasonId: z.null(),
  }).strict(),
  z.object({
    ...currentAnchorBase,
    kind: z.literal("PB"),
    purpose: z.literal("CURRENT_CAPABILITY"),
    seasonId: z.null(),
  }).strict(),
  z.object({
    ...currentAnchorBase,
    kind: z.literal("SB"),
    purpose: z.literal("SEASON_CONTEXT"),
    seasonId: z.string().min(1),
  }).strict(),
])
const goalAnchorSchema = z.object({
  anchorId: z.string().min(1),
  kind: z.literal("GOAL"),
  purpose: z.literal("ASPIRATIONAL_TARGET"),
  eventDistanceM: z.number().finite().min(60),
  performanceSeconds: z.number().finite().positive(),
  enteredBy: enteredBySchema,
  verificationState: verificationStateSchema,
  freshnessState: z.enum(["CURRENT", "STALE", "UNKNOWN"]),
  sourceRef: z.string().min(1),
}).strict()

export const paceTargetPlanItemSchema = z.object({
  kind: z.literal("PACE_TARGET"),
  setCount: z.number().int().positive(),
  repetitionsPerSet: z.number().int().positive(),
  repetitionDistanceM: z.number().int().positive(),
  targetRepSeconds: z.number().finite().positive(),
  selectedAnchor: currentAnchorSchema,
  comparisonAnchor: z.object({
    anchor: currentAnchorSchema,
    repSeconds: z.number().finite().positive(),
    deltaSeconds: z.number().finite(),
  }).strict().nullable(),
  goalReference: z.object({
    anchor: goalAnchorSchema,
    repSeconds: z.number().finite().positive(),
    displayOnly: z.literal(true),
  }).strict().nullable(),
  displayRoundingPolicyVersion: z.string().min(1),
  repetitionRecoverySeconds: z.number().finite().positive().nullable(),
  setRecoverySeconds: z.number().finite().positive().nullable(),
}).strict()

const rpeTimeRangeSchema = z.object({
  kind: z.literal("RPE_TIME_RANGE"),
  rpe: z.object({
    minimum: z.number(),
    maximum: z.number(),
  }),
  durationMinutes: z.object({
    minimum: z.number(),
    maximum: z.number(),
  }),
})

export const planSessionSchema = z.discriminatedUnion("role", [
  z.object({
    day: z.number().int().positive(),
    slot: sessionSlotSchema.optional().default("AM"),
    role: z.literal("REST"),
    plannedEnergyIntent: z.literal("RECOVERY_INTENT").optional().default("RECOVERY_INTENT"),
    prescription: z.object({ kind: z.literal("REST") }),
  }),
  z.object({
    day: z.number().int().positive(),
    slot: sessionSlotSchema.optional().default("AM"),
    role: z.literal("EASY"),
    plannedEnergyIntent: z.enum(["RECOVERY_INTENT", "BASE_INTENT"]).optional().default("BASE_INTENT"),
    prescription: rpeTimeRangeSchema,
  }),
  z.object({
    day: z.number().int().positive(),
    slot: sessionSlotSchema.optional().default("AM"),
    role: z.literal("QUALITY"),
    plannedEnergyIntent: z.enum([
      "LT_INTENT",
      "VO2_INTENT",
      "GLY_INTENT",
      "ATP_PC_INTENT",
      "MIXED_INTENT",
    ]).optional().default("MIXED_INTENT"),
    prescription: rpeTimeRangeSchema,
  }),
])

const legacyPlanFrameSchema = z.object({
  lengthDays: frameLengthSchema,
  continuity: z.union([
    z.object({
      kind: z.literal("SEVEN_DAY_CONTINUITY"),
      nextFrameInput: z.literal("SELECTED_PLAN_AND_PROGRESS"),
    }),
    z.object({ kind: z.literal("STANDARD_FRAME") }),
  ]),
})

const canonicalPlanFrameSchema = z.object({
  formationKind: z.literal("LOCAL_CIVIL_9_5"),
  lengthDays: z.literal(9.5),
  slotCount: z.literal(19),
  continuity: z.object({ kind: z.literal("STANDARD_FRAME") }),
})

export const planFrameSchema = z.union([
  legacyPlanFrameSchema,
  canonicalPlanFrameSchema,
])

export const activePlanSchema = z.object({
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

export type StoredActivePlan = z.infer<typeof activePlanSchema>
export type StoredPlanSession = z.infer<typeof planSessionSchema>
