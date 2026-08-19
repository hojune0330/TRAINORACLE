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
import { DETAILED_PRESCRIPTION_APPROVALS } from "./detailed-prescription-approvals"
import { formatElapsedMonths, SEASON_WINDOW_MONTHS } from "./athlete-record-display"

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

const opaqueAthleteIdSchema = z.string().refine(
  (value) => value === "local-athlete"
    || /^athlete-\d+$/u.test(value)
    || /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value),
)
const adaptationExposureIdSchema = z.string().regex(/^(?:app-main-day-(?:[1-9]|10)|fixture-main-[1-3])$/u)
const adaptationRecordIdSchema = z.string().refine((value) => (
  /^local-\d+-[a-z0-9]+$/u.test(value)
  || /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value)
))
const currentElapsedLabels = new Set(
  Array.from({ length: SEASON_WINDOW_MONTHS + 1 }, (_, months) => formatElapsedMonths(months)),
)
const adaptationCandidateIdSchema = z.string().refine((value) => {
  const markerIndex = value.indexOf(":pace-target:")
  const baseId = markerIndex < 0 ? value : value.slice(0, markerIndex)
  return /^beta:(?:balanced|conservative):(?:middle_distance|five_k):event-(?:800|1500|3000|5000):(?:new_to_running|developing|experienced):(?:recovery_intent|base_intent|lt_intent|vo2_intent|gly_intent|atp_pc_intent|mixed_intent):(?:single_session_only|recovery_pm_allowed):(?:morning|evening|varies):projection-(?:7|9|9\.5|10):local-civil-9-5:[a-z0-9-]+:\d+(?:-\d+)*:(?:no_usable_journal|recent_journal_context):(?:no-continuity|(?:balanced|conservative):(?:completed|rested|skipped|pain_checkin)-\d+(?:-(?:completed|rested|skipped|pain_checkin)-\d+)*)$/u.test(baseId)
})

const adaptationScopeSchema = z.object({
  athleteId: opaqueAthleteIdSchema,
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

export function hasCanonicalArrayTree(
  value: unknown,
  ancestors = new Set<object>(),
): boolean {
  if (typeof value !== "object" || value === null) return true
  if (ancestors.has(value)) return false
  ancestors.add(value)
  if (Array.isArray(value)) {
    let index = 0
    for (const key of Reflect.ownKeys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if (descriptor?.enumerable !== true) continue
      if (typeof key !== "string" || key !== String(index)) return false
      index += 1
    }
    if (index !== value.length) return false
  }
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor?.enumerable === true
      && "value" in descriptor
      && !hasCanonicalArrayTree(descriptor.value, ancestors)) return false
  }
  ancestors.delete(value)
  return true
}

const canonicalArrayTreeSchema = z.unknown().refine(hasCanonicalArrayTree, {
  message: "Arrays must contain only canonical dense indices.",
})

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

const planBetaStateV1Schema = canonicalArrayTreeSchema.pipe(
  planBetaStateV1BaseSchema.superRefine(validatePlanBetaState),
)
export const planBetaStateV2Schema = canonicalArrayTreeSchema.pipe(
  planBetaStateV2BaseSchema.superRefine(validatePlanBetaState),
)
const planBetaStateSchema = z.union([
  planBetaStateV2Schema,
  planBetaStateV1Schema.transform((state) => ({
    ...state,
    version: 2 as const,
  })),
])

const hashSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/u)
const planBetaCodeSchema = z.enum([
  "PROFILE_ONLY_LIMITED_CONTEXT", "RECENT_JOURNAL_CONTEXT_PRESENT", "BETA_DURATION_RPE_ONLY",
  "PACE_TARGET_BOUND", "BETA_NON_UNIVERSAL_FORMATION_SCOPE", "PREVIOUS_FRAME_CONTEXT_RETAINED",
  "SAFETY_GATE_ACTIVE", "SAFETY_GATE_UNKNOWN", "MALFORMED_INPUT", "UNSUPPORTED_FRAME_LENGTH",
  "INSUFFICIENT_AVAILABLE_DAYS", "INVALID_AVAILABLE_DAY", "INVALID_JOURNAL_CONTEXT",
  "INVALID_CONTINUITY_CONTEXT", "NON_CANONICAL_FRAME_REQUIRES_REVIEW", "CANONICAL_LEDGER_REQUIRES_VALIDATION",
  "NEEDS_COACH_CLARIFICATION", "INVALID_COMPOSITE_RELATION_REQUIRES_REVIEW",
  "COMPETITION_DAY_COLLISION_REQUIRES_COACH_CLARIFICATION", "MAIN_EXPOSURE_COUNT_REQUIRES_REVIEW",
  "MAIN_EXPOSURE_OUTSIDE_AVAILABILITY_REQUIRES_REVIEW", "COACH_SELECTION_REQUIRED", "CANDIDATE_NOT_FOUND",
  "INVALID_SELECTION_REQUEST", "NON_SELECTABLE_PLAN_RESULT", "STALE_CANDIDATE_FINGERPRINT",
  "NONCANONICAL_CANDIDATE_FRAME", "SAFETY_GATE_RECHECK_BLOCKED", "SESSION_DAY_NOT_IN_ACTIVE_PLAN",
  "SESSION_SLOT_NOT_IN_ACTIVE_PLAN",
])
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
const planCandidateObjectSchema = z.object({
  candidateId: adaptationCandidateIdSchema,
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
  mainExposureLedger: z.object({ mainExposureCount: z.union([z.literal(2), z.literal(3)]), fingerprint: z.string(), countedExposureIds: z.array(adaptationExposureIdSchema).readonly() }).strict(),
  rationaleCodes: z.array(planBetaCodeSchema).readonly(),
  sessions: z.array(planSessionSchema).readonly(),
}).strict()
const planCandidateSchema = canonicalArrayTreeSchema.pipe(planCandidateObjectSchema).superRefine((candidate, context) => {
  const marker = ":pace-target:"
  const markerIndex = candidate.candidateId.indexOf(marker)
  const detailedFingerprints = candidate.sessions.flatMap((session) => (
    session.prescription.kind === "PACE_TARGET"
      ? [session.prescription.prescriptionFingerprint]
      : []
  ))
  const expectedDetailedFingerprint = detailedFingerprints.length === 1
    ? detailedFingerprints[0]
    : null
  const expectedBasis = expectedDetailedFingerprint === null
    ? "DURATION_RPE_ONLY"
    : "ONE_TRUSTED_DETAILED_SESSION"
  if (detailedFingerprints.length > 1
    || candidate.detailedPrescriptionFingerprint !== expectedDetailedFingerprint
    || candidate.beta.prescriptionBasis !== expectedBasis
    || (expectedDetailedFingerprint === null
      ? markerIndex >= 0
      : candidate.candidateId.slice(markerIndex + marker.length) !== expectedDetailedFingerprint)) {
    addIssue(context, ["candidateId"], "Detailed prescription identity mismatch.")
  }
  if (candidate.mainExposureLedger.fingerprint !== candidate.mainExposureLedger.countedExposureIds.join(":")) {
    addIssue(context, ["mainExposureLedger", "fingerprint"], "Exposure identity mismatch.")
  }
  if (!candidate.candidateId.includes(`:${candidate.mainExposureLedger.countedExposureIds.join("-")}:`)) {
    addIssue(context, ["candidateId"], "Candidate exposure identity mismatch.")
  }
  for (const [index, session] of candidate.sessions.entries()) {
    if (session.prescription.kind !== "PACE_TARGET") continue
    const prescription = session.prescription
    const approval = DETAILED_PRESCRIPTION_APPROVALS.find((item) => (
      item.templateId === prescription.templateId
      && item.templateVersion === prescription.templateVersion
      && item.targetEventDistanceM === prescription.targetEventDistanceM
    ))
    if (approval === undefined
      || prescription.manifestVersion !== approval.manifestVersion
      || prescription.templateContentFingerprint !== approval.templateContentFingerprint
      || prescription.notation !== approval.notation
      || prescription.sourceDecisionId !== approval.sourceDecisionId
      || prescription.sourceEvidenceRef !== approval.sourceEvidenceRef
      || prescription.approvalDecisionId !== approval.approvalDecisionId
      || prescription.ownerAuthorityDecisionId !== approval.ownerDecision.authorityDecisionId
      || prescription.sportsScienceEvidence.evidenceId !== approval.sportsScienceEvidence.evidenceId
      || prescription.sportsScienceEvidence.decisionRef !== approval.sportsScienceEvidence.decisionRef
      || prescription.sportsScienceEvidence.fingerprint !== approval.sportsScienceEvidence.canonicalEvidenceFingerprint
      || prescription.populationApplicabilityEvidence.evidenceId !== approval.populationApplicabilityEvidence.evidenceId
      || prescription.populationApplicabilityEvidence.decisionRef !== approval.populationApplicabilityEvidence.decisionRef
      || prescription.populationApplicabilityEvidence.fingerprint !== approval.populationApplicabilityEvidence.canonicalEvidenceFingerprint
      || prescription.scope.eventEvidenceFingerprint !== approval.eventScopeEvidence.evidenceFingerprint
      || prescription.scope.experienceEvidenceFingerprint !== approval.experienceScopeEvidence.evidenceFingerprint
      || !approval.eligibleEventGroups.includes(prescription.scope.eventGroup)
      || !approval.eligibleExperienceBands.includes(prescription.scope.experienceBand)
      || prescription.scope.population !== approval.populationApplicability.scope
      || JSON.stringify(prescription.componentRefs) !== JSON.stringify(approval.componentRefs)
      || JSON.stringify(prescription.operationalComponents) !== JSON.stringify(approval.canonicalTemplateContent.operationalComponents)
      || prescription.displayRoundingPolicyVersion !== "seconds-v1") {
      addIssue(context, ["sessions", index, "prescription"], "Prescription references must match an approved manifest entry.")
    }
    if (!adaptationRecordIdSchema.safeParse(prescription.selectedAnchor.anchorId).success) {
      addIssue(context, ["sessions", index, "prescription", "selectedAnchor", "anchorId"], "Anchor identity must be a generated athlete record ID.")
    }
    if (prescription.selectedAnchor.sourceRef !== `athlete-record:${prescription.selectedAnchor.anchorId}`) {
      addIssue(context, ["sessions", index, "prescription", "selectedAnchor", "sourceRef"], "Anchor source identity mismatch.")
    }
    const anchor = prescription.selectedAnchor
    if (!isValidIsoDate(anchor.achievedAt)
      || !currentElapsedLabels.has(anchor.elapsedLabel)
      || (anchor.kind === "SB" && anchor.seasonId !== anchor.achievedAt.slice(0, 4))) {
      addIssue(context, ["sessions", index, "prescription", "selectedAnchor"], "Anchor display metadata must be deterministically derived.")
    }
  }
})

export const planAdaptationProposalSchema = z.object({
  proposalId: z.string().regex(/^adaptation:[a-f0-9]{64}$/u),
  proposalHash: hashSchema,
  targetFrame: z.literal("NEXT_FRAME"),
  athleteId: opaqueAthleteIdSchema,
  eventDistanceM: adaptationScopeSchema.shape.eventDistanceM,
  proposalOrigin: z.enum(["SELF_SERVICE", "COACH_AUTHORED"]),
  selectionAuthority: z.enum(["SELF", "COACH_REQUIRED"]),
  trigger: z.enum(["SAME_EVENT_PB_SB_AFTER_ACTIVE_PLAN_START", "EXPLICIT_REQUEST"]),
  changeDimension: z.enum(["INTENSITY", "VOLUME", "FREQUENCY"]),
  baseCandidateId: adaptationCandidateIdSchema,
  baseContentHash: hashSchema,
  proposedContentHash: hashSchema,
  approvedBeforeValueRef: hashSchema,
  approvedAfterValueRef: hashSchema,
  baseCandidate: planCandidateSchema,
  successorCandidate: planCandidateSchema,
  createdAt: z.string().datetime(),
  idempotencyKey: hashSchema,
}).strict().superRefine((proposal, context) => {
  const expectedAuthority = proposal.proposalOrigin === "SELF_SERVICE" ? "SELF" : "COACH_REQUIRED"
  if (proposal.selectionAuthority !== expectedAuthority) addIssue(context, ["selectionAuthority"], "Selection authority must follow proposal origin.")
  if (proposal.baseCandidateId !== proposal.baseCandidate.candidateId) addIssue(context, ["baseCandidateId"], "Base candidate identity mismatch.")
})

export const pendingNextFrameSuccessorSchema = z.object({
  version: z.literal(1), proposalId: z.string().regex(/^adaptation:[a-f0-9]{64}$/u), targetFrame: z.literal("NEXT_FRAME"),
  proposalOrigin: z.enum(["SELF_SERVICE", "COACH_AUTHORED"]), selectionAuthority: z.enum(["SELF", "COACH_REQUIRED"]),
  trigger: z.enum(["SAME_EVENT_PB_SB_AFTER_ACTIVE_PLAN_START", "EXPLICIT_REQUEST"]), changeDimension: z.enum(["INTENSITY", "VOLUME", "FREQUENCY"]),
  athleteId: opaqueAthleteIdSchema, eventDistanceM: adaptationScopeSchema.shape.eventDistanceM,
  baseCandidateId: adaptationCandidateIdSchema, baseContentHash: hashSchema, proposedContentHash: hashSchema, predecessorStateHash: hashSchema,
  successorState: canonicalArrayTreeSchema.pipe(planBetaStateV2BaseSchema), acceptedAt: z.string().datetime(), decisionId: z.string().regex(/^adaptation-decision:[a-f0-9]{64}$/u), idempotencyKey: hashSchema, requestHash: hashSchema,
}).strict().superRefine((record, context) => {
  if (record.successorState.activePlan.candidateId === record.baseCandidateId) addIssue(context, ["successorState", "activePlan", "candidateId"], "Successor must differ from predecessor.")
  if (!adaptationCandidateIdSchema.safeParse(record.successorState.activePlan.candidateId).success) addIssue(context, ["successorState", "activePlan", "candidateId"], "Successor candidate identity is invalid.")
  const expectedAuthority = record.proposalOrigin === "SELF_SERVICE" ? "SELF" : "COACH_REQUIRED"
  if (record.selectionAuthority !== expectedAuthority) addIssue(context, ["selectionAuthority"], "Selection authority must follow proposal origin.")
})

export const planAdaptationDecisionSchema = z.object({
  version: z.literal(1), decisionId: z.string().regex(/^adaptation-decision:[a-f0-9]{64}$/u), proposalId: z.string().regex(/^adaptation:[a-f0-9]{64}$/u), decision: z.literal("ACCEPT"),
  predecessorStateHash: hashSchema, proposedContentHash: hashSchema, decidedAt: z.string().datetime(), idempotencyKey: hashSchema, requestHash: hashSchema,
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
