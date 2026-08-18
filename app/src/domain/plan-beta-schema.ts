import { z } from "zod"
import {
  activePlanSchema,
  frameLengthSchema,
  legacyActivePlanSchema,
  planSessionSchema,
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

const adaptationScopeSchema = z.object({
  athleteId: z.string().min(1).max(128),
  eventDistanceM: z.union([z.literal(800), z.literal(1500), z.literal(3000), z.literal(5000)]),
}).strict()

const planBetaStateCommonShape = {
  intake: storedPlanIntakeSchema,
  progress: z.array(progressSchema),
  generatedAt: z.string().datetime(),
  athleteEvidence: planAthleteEvidenceSchema.optional(),
  adaptationScope: adaptationScopeSchema.optional(),
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
export const planBetaStateV2Schema = planBetaStateV2BaseSchema.superRefine(
  validatePlanBetaState,
)
const planBetaStateSchema = z.union([
  planBetaStateV2Schema,
  planBetaStateV1Schema.transform((state) => ({
    ...state,
    version: 2 as const,
  })),
])

const hashSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/u)
const candidateFrameSchema = z.object({
  formationKind: z.literal("LOCAL_CIVIL_9_5"),
  lengthDays: z.literal(9.5),
  slotCount: z.literal(19),
  projectionLengthDays: z.union([z.literal(7), z.literal(9), z.literal(9.5), z.literal(10)]).optional(),
  continuity: z.union([
    z.object({ kind: z.literal("STANDARD_FRAME") }).strict(),
    z.object({ kind: z.literal("SEVEN_DAY_CONTINUITY"), nextFrameInput: z.literal("SELECTED_PLAN_AND_PROGRESS") }).strict(),
  ]),
}).strict()
const planCandidateSchema = z.object({
  candidateId: z.string().min(1),
  kind: z.enum(["BALANCED", "CONSERVATIVE"]),
  eventGroup: z.enum(["MIDDLE_DISTANCE", "FIVE_K"]),
  eventDistanceM: z.union([
    adaptationScopeSchema.shape.eventDistanceM,
    z.null(),
  ]),
  selectedEnergyIntent: plannedEnergyIntentSchema,
  sourceMode: z.enum(["PROFILE_ONLY", "JOURNAL_CONTEXT_ONLY"]),
  confidence: z.literal("LIMITED"),
  beta: z.object({ designation: z.literal("BETA"), prescriptionBasis: z.enum(["DURATION_RPE_ONLY", "ONE_TRUSTED_DETAILED_SESSION"]), formationMethodClaim: z.literal("NOT_UNIVERSAL") }).strict(),
  detailedPrescriptionFingerprint: z.string().min(1).nullable(),
  continuityContext: z.union([
    z.object({ kind: z.literal("NO_PREVIOUS_FRAME_CONTEXT") }).strict(),
    z.object({ kind: z.literal("PREVIOUS_FRAME_CONTEXT_RETAINED"), previousCandidateKind: z.enum(["BALANCED", "CONSERVATIVE"]), progressStateCounts: z.array(z.object({ state: progressStateSchema, count: z.number().int().nonnegative() }).strict()).readonly() }).strict(),
  ]),
  selectionAuthority: z.enum(["SELF", "COACH_REQUIRED"]),
  frame: candidateFrameSchema,
  mainExposureLedger: z.object({ mainExposureCount: z.union([z.literal(2), z.literal(3)]), fingerprint: z.string().min(1), countedExposureIds: z.array(z.string().min(1)).readonly() }).strict(),
  rationaleCodes: z.array(z.string().min(1)).readonly(),
  sessions: z.array(planSessionSchema).readonly(),
}).strict()

export const planAdaptationProposalSchema = z.object({
  proposalId: z.string().regex(/^adaptation:[a-f0-9]{64}$/u),
  proposalHash: hashSchema,
  targetFrame: z.literal("NEXT_FRAME"),
  athleteId: z.string().min(1).max(128),
  eventDistanceM: adaptationScopeSchema.shape.eventDistanceM,
  proposalOrigin: z.enum(["SELF_SERVICE", "COACH_AUTHORED"]),
  selectionAuthority: z.enum(["SELF", "COACH_REQUIRED"]),
  trigger: z.enum(["SAME_EVENT_PB_SB_AFTER_ACTIVE_PLAN_START", "EXPLICIT_REQUEST"]),
  changeDimension: z.enum(["INTENSITY", "VOLUME", "FREQUENCY"]),
  baseCandidateId: z.string().min(1),
  baseContentHash: hashSchema,
  proposedContentHash: hashSchema,
  approvedBeforeValueRef: hashSchema,
  approvedAfterValueRef: hashSchema,
  baseCandidate: planCandidateSchema,
  successorCandidate: planCandidateSchema,
  createdAt: z.string().datetime(),
  idempotencyKey: z.string().min(1),
}).strict().superRefine((proposal, context) => {
  const expectedAuthority = proposal.proposalOrigin === "SELF_SERVICE" ? "SELF" : "COACH_REQUIRED"
  if (proposal.selectionAuthority !== expectedAuthority) addIssue(context, ["selectionAuthority"], "Selection authority must follow proposal origin.")
  if (proposal.baseCandidateId !== proposal.baseCandidate.candidateId) addIssue(context, ["baseCandidateId"], "Base candidate identity mismatch.")
})

export const pendingNextFrameSuccessorSchema = z.object({
  version: z.literal(1), proposalId: z.string().min(1), targetFrame: z.literal("NEXT_FRAME"),
  proposalOrigin: z.enum(["SELF_SERVICE", "COACH_AUTHORED"]), selectionAuthority: z.enum(["SELF", "COACH_REQUIRED"]),
  trigger: z.enum(["SAME_EVENT_PB_SB_AFTER_ACTIVE_PLAN_START", "EXPLICIT_REQUEST"]), changeDimension: z.enum(["INTENSITY", "VOLUME", "FREQUENCY"]),
  athleteId: z.string().min(1).max(128), eventDistanceM: adaptationScopeSchema.shape.eventDistanceM,
  baseCandidateId: z.string().min(1), baseContentHash: hashSchema, proposedContentHash: hashSchema, predecessorStateHash: hashSchema,
  successorState: planBetaStateV2BaseSchema, acceptedAt: z.string().datetime(), decisionId: z.string().min(1), idempotencyKey: z.string().min(1), requestHash: hashSchema,
}).strict().superRefine((record, context) => {
  if (record.successorState.activePlan.candidateId === record.baseCandidateId) addIssue(context, ["successorState", "activePlan", "candidateId"], "Successor must differ from predecessor.")
  const expectedAuthority = record.proposalOrigin === "SELF_SERVICE" ? "SELF" : "COACH_REQUIRED"
  if (record.selectionAuthority !== expectedAuthority) addIssue(context, ["selectionAuthority"], "Selection authority must follow proposal origin.")
})

export const planAdaptationDecisionSchema = z.object({
  version: z.literal(1), decisionId: z.string().min(1), proposalId: z.string().min(1), decision: z.literal("ACCEPT"),
  predecessorStateHash: hashSchema, proposedContentHash: hashSchema, decidedAt: z.string().datetime(), idempotencyKey: z.string().min(1), requestHash: hashSchema,
}).strict()

export const planAdaptationEnvelopeSchema = z.object({ version: z.literal(1), pending: pendingNextFrameSuccessorSchema, decision: planAdaptationDecisionSchema }).strict().superRefine((envelope, context) => {
  if (envelope.pending.proposalId !== envelope.decision.proposalId || envelope.pending.decisionId !== envelope.decision.decisionId || envelope.pending.requestHash !== envelope.decision.requestHash) addIssue(context, ["decision"], "Decision and pending successor linkage mismatch.")
})

export const planHistoryListSchema = z.array(planHistorySchema).max(5)

export type PlanBetaIntake = z.infer<typeof planIntakeSchema>
export type StoredPlanBetaIntake = z.infer<typeof storedPlanIntakeSchema>
export type CompetitionDivision = PlanBetaIntake["competitionDivision"]
export type StoredPlanProgress = z.infer<typeof progressSchema>
export type LegacyPlanBetaState = z.infer<typeof planBetaStateV1Schema>
export type PlanBetaStateV2 = z.infer<typeof planBetaStateV2Schema>
export type PlanBetaState = Omit<PlanBetaStateV2, "version"> & {
  readonly version: 1 | 2
}
export type StoredPlanHistory = z.infer<typeof planHistorySchema>
export type PendingNextFrameSuccessor = z.infer<typeof pendingNextFrameSuccessorSchema>
export type PlanAdaptationDecision = z.infer<typeof planAdaptationDecisionSchema>
export type PlanAdaptationEnvelope = z.infer<typeof planAdaptationEnvelopeSchema>

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
