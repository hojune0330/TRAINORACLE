import { z } from "zod"
import {
  continuityContextIdentity,
  continuityIdentityFromCandidateId,
  detailedPrescriptionFingerprintFromSessions,
  hasValidCandidateIdentity,
  hasValidCandidatePairIdentity,
  pairIdHasBase,
  projectPlanCandidate,
} from "@impl/plan-generator/candidate-identity"
import {
  ADAPTATION_SUCCESSOR_POLICY_VERSION,
  ADAPTATION_TRANSFORM_REGISTRY_FINGERPRINT,
  ADAPTATION_TRANSFORM_REGISTRY_VERSION,
} from "@impl/plan-generator/adaptation-transform-registry"
import { RVE_NON_SENSITIVE_REASON_CODES } from "@impl/rve/signal"
import { isStoredMainPlacement } from "@impl/plan-generator/main-placement-policy"
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
import { athleteRecordIdSchema } from "./athlete-records"
import { periodizationContextSchema } from "./periodization-lineage"
import { explanationReceiptSchema } from "./training-explanation-receipt"

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
export const supportedPlanEventDistanceSchema = z.union([
  z.literal(800),
  z.literal(1500),
  z.literal(3000),
  z.literal(5000),
  z.literal(10000),
  z.literal(21097),
  z.literal(42195),
])

function eventDistanceMatchesGroup(
  distanceM: z.infer<typeof supportedPlanEventDistanceSchema>,
  eventGroup: z.infer<typeof planEventGroupSchema>,
): boolean {
  if (eventGroup === "MIDDLE_DISTANCE") return distanceM === 800 || distanceM === 1500 || distanceM === 3000
  if (eventGroup === "FIVE_K") return distanceM === 5000
  if (eventGroup === "TEN_K") return distanceM === 10000
  return distanceM === 21097 || distanceM === 42195
}
export const detailedTemplateRefSchema = z.object({
  templateId: z.string().regex(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/u),
  version: z.string().regex(/^\d+\.\d+\.\d+$/u),
  fingerprint: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
}).strict()

export const planIntakeSchema = z.object({
  eventGroup: planEventGroupSchema,
  eventDistanceM: supportedPlanEventDistanceSchema,
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
  selectedDetailedTemplateRef: detailedTemplateRefSchema.nullable(),
  startDate: selectedStartDateSchema.optional(),
}).strict().superRefine((intake, context) => {
  if (!eventDistanceMatchesGroup(intake.eventDistanceM, intake.eventGroup)) {
    addIssue(context, ["eventDistanceM"], "Target event must match the supported event group.")
  }
})

export const storedPlanIntakeSchema = z.object({
  eventGroup: planEventGroupSchema,
  eventDistanceM: supportedPlanEventDistanceSchema.optional(),
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
  selectedDetailedTemplateRef: detailedTemplateRefSchema.nullable().optional(),
  startDate: selectedStartDateSchema.optional(),
}).strict().superRefine((intake, context) => {
  if (intake.eventDistanceM === undefined) return
  if (!eventDistanceMatchesGroup(intake.eventDistanceM, intake.eventGroup)) {
    addIssue(context, ["eventDistanceM"], "Target event must match the supported event group.")
  }
})

export const progressSchema = z.object({
  sessionDay: z.number().int().positive(),
  sessionSlot: sessionSlotSchema.optional().default("AM"),
  state: progressStateSchema,
}).strict()

const legacyPlanHistorySchema = z.object({
  candidateId: z.string().min(1),
  candidateKind: z.enum(["BALANCED", "CONSERVATIVE"]),
  frameLengthDays: storedFrameLengthSchema,
  progress: z.array(progressSchema),
  archivedAt: z.string().datetime(),
}).strict()

const planHistoryV3Schema = legacyPlanHistorySchema.extend({
  version: z.literal(3),
  pairId: z.string().regex(/^plan-pair:v3:/u),
  eventDistanceM: supportedPlanEventDistanceSchema,
  selectedDetailedTemplateRef: detailedTemplateRefSchema.nullable(),
  periodization: periodizationContextSchema.optional(),
}).strict()

const planMethodHistoryEntrySchema = z.object({
  sessionDay: z.number().int().positive(),
  sessionSlot: sessionSlotSchema,
  selectedDetailedTemplateRef: detailedTemplateRefSchema,
  outcome: z.enum(["PERFORMED", "NOT_PERFORMED", "MISSING"]),
}).strict()

const planHistoryV4Schema = legacyPlanHistorySchema.extend({
  version: z.literal(4),
  pairId: z.string().regex(/^plan-pair:v3:/u),
  eventDistanceM: supportedPlanEventDistanceSchema,
  selectedDetailedTemplateRef: detailedTemplateRefSchema.nullable(),
  methodHistory: z.array(planMethodHistoryEntrySchema).readonly(),
  periodization: periodizationContextSchema.optional(),
}).strict()

export const planHistorySchema = z.union([planHistoryV4Schema, planHistoryV3Schema, legacyPlanHistorySchema])

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
const adaptationRecordIdSchema = athleteRecordIdSchema
const currentElapsedLabels = new Set(
  Array.from({ length: SEASON_WINDOW_MONTHS + 1 }, (_, months) => formatElapsedMonths(months)),
)
const adaptationCandidateIdSchema = z.string().refine((value) => {
  const markerIndex = value.indexOf(":pace-target:")
  const baseId = markerIndex < 0 ? value : value.slice(0, markerIndex)
  return /^beta:(?:balanced|conservative):(?:middle_distance|five_k|ten_k|general_endurance):event-(?:800|1500|3000|5000|10000|21097|42195):(?:new_to_running|developing|experienced):(?:recovery_intent|base_intent|lt_intent|vo2_intent|gly_intent|atp_pc_intent|mixed_intent):(?:single_session_only|recovery_pm_allowed):(?:morning|evening|varies):projection-(?:7|9|9\.5|10):local-civil-9-5:[a-z0-9-]+:\d+(?:-\d+)*:(?:no_usable_journal|recent_journal_context):(?:no-continuity|(?:balanced|conservative):(?:completed|rested|skipped|pain_checkin)-\d+(?:-(?:completed|rested|skipped|pain_checkin)-\d+)*):template-(?:rpe-only|[a-z0-9-]+\.\d+\.\d+\.\d+\.[a-f0-9]{64}):candidate-sha256-[a-f0-9]{64}$/u.test(baseId)
})

const adaptationScopeSchema = z.object({
  athleteId: opaqueAthleteIdSchema,
  eventDistanceM: supportedPlanEventDistanceSchema,
  pairId: z.string().regex(/^plan-pair:v3:/u).optional(),
  selectedDetailedTemplateRef: detailedTemplateRefSchema.nullable().optional(),
}).strict()
const adaptationScopeV3Schema = z.object({
  athleteId: opaqueAthleteIdSchema,
  eventDistanceM: supportedPlanEventDistanceSchema,
  pairId: z.string().regex(/^plan-pair:v3:/u),
  selectedDetailedTemplateRef: detailedTemplateRefSchema.nullable(),
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
const activePlanV3Schema = activePlanSchema.extend({
  pairId: z.string().regex(/^plan-pair:v3:/u),
  eventDistanceM: supportedPlanEventDistanceSchema,
  selectedDetailedTemplateRef: detailedTemplateRefSchema.nullable(),
}).strict()
const planBetaStateV3BaseSchema = z.object({
  version: z.literal(3),
  // Corrupt or newer explanation metadata must not destroy a valid saved prescription.
  explanationReceipt: explanationReceiptSchema.optional().catch(undefined),
  intake: planIntakeSchema,
  progress: z.array(progressSchema),
  generatedAt: z.string().datetime(),
  athleteEvidence: planAthleteEvidenceSchema.optional(),
  adaptationScope: adaptationScopeV3Schema.optional(),
  periodization: periodizationContextSchema.optional(),
  activePlan: activePlanV3Schema,
}).strict().superRefine((state, context) => {
  if (state.activePlan.eventDistanceM !== state.intake.eventDistanceM) {
    addIssue(context, ["activePlan", "eventDistanceM"], "Active target event must match intake.")
  }
  if (state.activePlan.pairId !== state.adaptationScope?.pairId && state.adaptationScope !== undefined) {
    addIssue(context, ["adaptationScope", "pairId"], "Adaptation pair identity must match the active plan.")
  }
  if (state.adaptationScope !== undefined
      && (state.adaptationScope.eventDistanceM !== state.activePlan.eventDistanceM
        || JSON.stringify(state.adaptationScope.selectedDetailedTemplateRef) !== JSON.stringify(state.activePlan.selectedDetailedTemplateRef))) {
    addIssue(context, ["adaptationScope"], "Adaptation scope must match active event and template selection.")
  }
  if (JSON.stringify(state.activePlan.selectedDetailedTemplateRef) !== JSON.stringify(state.intake.selectedDetailedTemplateRef)) {
    addIssue(context, ["activePlan", "selectedDetailedTemplateRef"], "Active template selection must match intake.")
  }
  const reference = state.activePlan.selectedDetailedTemplateRef
  const detailedPrescriptions = state.activePlan.sessions.flatMap(session => (
    session.prescription.kind === "PACE_TARGET" ? [session.prescription] : []
  ))
  if (detailedPrescriptions.length > 0 && !isStoredMainPlacement(state.activePlan)) {
    addIssue(context, ["activePlan", "sessions"], "Active detailed MAIN placement must match a reviewed policy or the legacy V3 read contract.")
  }
  const templateIdentity = reference === null
    ? "rpe-only"
    : `${reference.templateId.toLowerCase()}.${reference.version}.${reference.fingerprint.slice("sha256:".length)}`
  const candidateSegments = state.activePlan.candidateId.split(":pace-target:")[0]?.split(":") ?? []
  const activeContinuityIdentity = continuityIdentityFromCandidateId(
    state.activePlan.candidateId,
  )
  const expectedPairId = [
    "plan-pair", "v3", state.activePlan.eventDistanceM, templateIdentity,
    state.activePlan.selectedEnergyIntent.toLowerCase(), candidateSegments[10], candidateSegments[11],
    activeContinuityIdentity,
  ].join(":")
  const activeIdentityMatches = "formationKind" in state.activePlan.frame
    && hasValidCandidateIdentity(state.activePlan.candidateId, {
      kind: state.activePlan.candidateKind,
      eventDistanceM: state.activePlan.eventDistanceM,
      selectedDetailedTemplateRef: state.activePlan.selectedDetailedTemplateRef,
      selectedEnergyIntent: state.activePlan.selectedEnergyIntent,
      sourceMode: state.activePlan.sourceMode,
      selectionAuthority: state.activePlan.selectionActor === "SELF" ? "SELF" : "COACH_REQUIRED",
      frame: state.activePlan.frame,
      sessions: state.activePlan.sessions,
    })
  if (!state.activePlan.candidateId.includes(`:event-${state.activePlan.eventDistanceM}:`)
      || !state.activePlan.candidateId.includes(`:template-${templateIdentity}`)
      || activeContinuityIdentity === null
      || !pairIdHasBase(state.activePlan.pairId, expectedPairId)
      || !activeIdentityMatches) {
    addIssue(context, ["activePlan", "candidateId"], "Active candidate identity must bind target event and template selection.")
  }
})
type ValidatedPlanBetaState = z.infer<typeof planBetaStateV1BaseSchema>
  | z.infer<typeof planBetaStateV2BaseSchema>
  | z.infer<typeof planBetaStateV3BaseSchema>

export function hasCanonicalJsonTree(
  value: unknown,
): boolean {
  try {
    return hasCanonicalJsonTreeUnchecked(value, new Set<object>())
  } catch {
    return false
  }
}

function hasCanonicalJsonTreeUnchecked(
  value: unknown,
  ancestors: Set<object>,
): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true
  if (typeof value === "number") return Number.isFinite(value)
  if (typeof value !== "object" || ancestors.has(value)) return false

  const prototype = Object.getPrototypeOf(value)
  if (Array.isArray(value)) {
    if (prototype !== Array.prototype) return false
    const keys = Reflect.ownKeys(value)
    if (keys.length !== value.length + 1 || keys[value.length] !== "length") return false
    for (let index = 0; index < value.length; index += 1) {
      if (keys[index] !== String(index)) return false
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index))
      if (descriptor?.enumerable !== true || !("value" in descriptor)) return false
    }
  } else if (prototype !== Object.prototype && prototype !== null) {
    return false
  }

  ancestors.add(value)
  for (const key of Reflect.ownKeys(value)) {
    if (Array.isArray(value) && key === "length") continue
    if (typeof key !== "string") return false
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor?.enumerable !== true || !("value" in descriptor)
      || !hasCanonicalJsonTreeUnchecked(descriptor.value, ancestors)) return false
  }
  ancestors.delete(value)
  return true
}

const canonicalJsonTreeSchema = z.unknown().refine(hasCanonicalJsonTree, {
  message: "Input must be a canonical plain JSON tree.",
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
        if (companion.prescription.kind !== "RPE_TIME_RANGE"
            || companion.prescription.rpe.minimum < 1 || companion.prescription.rpe.maximum > 3) {
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

const planBetaStateV1Schema = canonicalJsonTreeSchema.pipe(
  planBetaStateV1BaseSchema.superRefine(validatePlanBetaState),
)
export const planBetaStateV2Schema = canonicalJsonTreeSchema.pipe(
  planBetaStateV2BaseSchema.superRefine(validatePlanBetaState),
)
export const planBetaStateV3Schema = canonicalJsonTreeSchema.pipe(
  planBetaStateV3BaseSchema.superRefine(validatePlanBetaState),
)
const planBetaStateSchema = z.union([
  planBetaStateV3Schema,
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
  pairId: z.string().regex(/^plan-pair:v3:/u),
  kind: z.enum(["BALANCED", "CONSERVATIVE"]),
  eventGroup: z.enum(["MIDDLE_DISTANCE", "FIVE_K"]),
  eventDistanceM: supportedPlanEventDistanceSchema,
  selectedDetailedTemplateRef: detailedTemplateRefSchema.nullable(),
  selectedEnergyIntent: plannedEnergyIntentSchema,
  sourceMode: z.enum(["PROFILE_ONLY", "JOURNAL_CONTEXT_ONLY"]),
  confidence: z.literal("LIMITED"),
  beta: z.object({ designation: z.literal("BETA"), prescriptionBasis: z.enum(["DURATION_RPE_ONLY", "ONE_TRUSTED_DETAILED_SESSION", "MULTIPLE_TRUSTED_DETAILED_SESSIONS"]), formationMethodClaim: z.literal("NOT_UNIVERSAL") }).strict(),
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
export const planAdaptationCandidateSchema = canonicalJsonTreeSchema.pipe(planCandidateObjectSchema).superRefine((candidate, context) => {
  const marker = ":pace-target:"
  const markerIndex = candidate.candidateId.indexOf(marker)
  const detailedSessionCount = candidate.sessions.filter(session => session.prescription.kind === "PACE_TARGET").length
  const expectedDetailedFingerprint = detailedPrescriptionFingerprintFromSessions(candidate.sessions)
  const expectedBasis = detailedSessionCount === 0
    ? "DURATION_RPE_ONLY"
    : detailedSessionCount === 1
      ? "ONE_TRUSTED_DETAILED_SESSION"
      : "MULTIPLE_TRUSTED_DETAILED_SESSIONS"
  if (candidate.detailedPrescriptionFingerprint !== expectedDetailedFingerprint
    || candidate.beta.prescriptionBasis !== expectedBasis
    || (expectedDetailedFingerprint === null
      ? markerIndex >= 0
      : candidate.candidateId.slice(markerIndex + marker.length) !== expectedDetailedFingerprint)) {
      addIssue(context, ["candidateId"], "Detailed prescription identity mismatch.")
  }
  const reference = candidate.selectedDetailedTemplateRef
  const templateIdentity = reference === null
    ? "rpe-only"
    : `${reference.templateId.toLowerCase()}.${reference.version}.${reference.fingerprint.slice("sha256:".length)}`
  const candidateSegments = candidate.candidateId.split(marker)[0]?.split(":") ?? []
  const continuityIdentity = continuityContextIdentity(candidate.continuityContext)
  const expectedPairId = [
    "plan-pair", "v3", candidate.eventDistanceM, templateIdentity,
    candidate.selectedEnergyIntent.toLowerCase(), candidateSegments[10], candidateSegments[11],
    continuityIdentity,
  ].join(":")
  if (!candidate.candidateId.includes(`:template-${templateIdentity}`)
      || continuityIdentityFromCandidateId(candidate.candidateId) !== continuityIdentity
      || !pairIdHasBase(candidate.pairId, expectedPairId)
      || !hasValidCandidateIdentity(candidate.candidateId, projectPlanCandidate(candidate))) {
    addIssue(context, ["pairId"], "Template selection must bind candidate and pair identity.")
  }
  if (candidate.mainExposureLedger.fingerprint !== candidate.mainExposureLedger.countedExposureIds.join(":")) {
    addIssue(context, ["mainExposureLedger", "fingerprint"], "Exposure identity mismatch.")
  }
  if (!candidate.candidateId.includes(`:${candidate.mainExposureLedger.countedExposureIds.join("-")}:`)) {
    addIssue(context, ["candidateId"], "Candidate exposure identity mismatch.")
  }
  const primaryMatchCount = reference === null ? 0 : candidate.sessions.filter(session => (
    session.prescription.kind === "PACE_TARGET"
    && session.prescription.templateId === reference.templateId
    && session.prescription.templateVersion === reference.version
    && session.prescription.templateContentFingerprint === reference.fingerprint
  )).length
  if (detailedSessionCount > 0 && primaryMatchCount < 1) {
    addIssue(context, ["selectedDetailedTemplateRef"], "Primary template reference must match a detailed session.")
  }
  if (!isStoredMainPlacement(candidate)) {
    addIssue(context, ["sessions"], "Detailed MAIN placement must match a reviewed policy or the legacy V3 read contract.")
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

const adaptationSafetyReasonCodeSchema = z.enum(RVE_NON_SENSITIVE_REASON_CODES)
export const adaptationSafetyGateSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("passed"),
    action: z.literal("CONTINUE_WITH_OTHER_GATES"),
    planGenerationAllowed: z.literal(true),
    nonSensitiveReasonCodes: z.array(adaptationSafetyReasonCodeSchema).readonly(),
    audit: z.object({
      event: z.literal("PLAN_SAFETY_GATE_PASSED"),
      privacy: z.literal("REASON_CODES_ONLY"),
    }).strict(),
  }).strict(),
  z.object({
    kind: z.literal("blocked"),
    action: z.enum(["BLOCK", "BLOCK_OR_HUMAN_REVIEW"]),
    planGenerationAllowed: z.literal(false),
    requiredNextAction: z.enum(["HUMAN_REVIEW", "MORE_INFO_OR_HUMAN_REVIEW"]),
    nonSensitiveReasonCodes: z.array(adaptationSafetyReasonCodeSchema).readonly(),
    audit: z.object({
      event: z.literal("PLAN_SAFETY_GATE_BLOCKED"),
      privacy: z.literal("REASON_CODES_ONLY"),
    }).strict(),
  }).strict().superRefine((gate, context) => {
    const expected = gate.action === "BLOCK" ? "HUMAN_REVIEW" : "MORE_INFO_OR_HUMAN_REVIEW"
    if (gate.requiredNextAction !== expected) {
      addIssue(context, ["requiredNextAction"], "Safety action mismatch.")
    }
  }),
])

const adaptationTriggerSnapshotSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("EXPLICIT_REQUEST"),
    requestedBy: z.enum(["ATHLETE", "COACH"]),
    sourceRef: z.string().regex(/^(?:athlete|coach)-request:(?:local-athlete|athlete-\d+|[0-9a-f-]{36}):(?:req-\d+|v\d+)$/u),
  }).strict(),
  z.object({
    kind: z.literal("SAME_EVENT_PB_SB_AFTER_ACTIVE_PLAN_START"),
    explicitlyConfirmed: z.literal(true),
    recordId: adaptationRecordIdSchema,
    purpose: z.enum(["PERSONAL_BEST", "SEASON_BEST"]),
    eventDistanceM: adaptationScopeSchema.shape.eventDistanceM,
    performanceSeconds: z.number().finite().positive(),
    achievedAt: z.string().datetime(),
    sourceRef: z.string(),
    historicalOrBackfilled: z.boolean(),
  }).strict().superRefine((trigger, context) => {
    if (trigger.sourceRef !== `athlete-record:${trigger.recordId}`) {
      addIssue(context, ["sourceRef"], "Record source identity mismatch.")
    }
  }),
])

const adaptationTransformMetadataShape = {
  transformRegistryVersion: z.literal(ADAPTATION_TRANSFORM_REGISTRY_VERSION),
  transformRegistryFingerprint: z.literal(ADAPTATION_TRANSFORM_REGISTRY_FINGERPRINT),
  transformEdgeId: z.enum([
    "BALANCED_TO_CONSERVATIVE_EXISTING_SIBLING_ONLY",
    "CONSERVATIVE_TO_BALANCED_EXISTING_SIBLING_ONLY",
  ]),
  transformPolicyVersion: z.literal(ADAPTATION_SUCCESSOR_POLICY_VERSION),
  transformDirection: z.enum(["REDUCE", "INCREASE"]),
  predecessorPairFingerprint: z.string().regex(/^plan-pair:v3:/u),
  sourceCandidateId: adaptationCandidateIdSchema,
  sourceCandidateContentHash: hashSchema,
  allowedJsonPointers: z.array(z.string().regex(/^\/sessions\/\d+\/prescription\/durationMinutes\/maximum$/u)).min(1).readonly(),
  activePlanStartedAt: z.string().datetime(),
  successorProvenanceHash: hashSchema,
  safetyGate: adaptationSafetyGateSchema,
  safetySnapshotHash: hashSchema,
  safetyEvaluatedAt: z.string().datetime(),
  safetyValidUntil: z.string().datetime(),
  activeHold: z.literal(false),
  evaluatedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  edgeExpiresAt: z.null(),
  edgeRevoked: z.literal(false),
} as const

const planAdaptationProposalObjectSchema = z.object({
  proposalId: z.string().regex(/^adaptation:[a-f0-9]{64}$/u),
  proposalHash: hashSchema,
  targetFrame: z.literal("NEXT_FRAME"),
  athleteId: opaqueAthleteIdSchema,
  eventDistanceM: adaptationScopeSchema.shape.eventDistanceM,
  pairId: z.string().regex(/^plan-pair:v3:/u),
  selectedDetailedTemplateRef: detailedTemplateRefSchema.nullable(),
  proposalOrigin: z.enum(["SELF_SERVICE", "COACH_AUTHORED"]),
  selectionAuthority: z.enum(["SELF", "COACH_REQUIRED"]),
  trigger: z.enum(["SAME_EVENT_PB_SB_AFTER_ACTIVE_PLAN_START", "EXPLICIT_REQUEST"]),
  triggerSnapshot: adaptationTriggerSnapshotSchema,
  triggerSnapshotHash: hashSchema,
  changeDimension: z.enum(["INTENSITY", "VOLUME", "FREQUENCY"]),
  ...adaptationTransformMetadataShape,
  baseCandidateId: adaptationCandidateIdSchema,
  baseContentHash: hashSchema,
  proposedContentHash: hashSchema,
  approvedBeforeValueRef: hashSchema,
  approvedAfterValueRef: hashSchema,
  baseCandidate: planAdaptationCandidateSchema,
  successorCandidate: planAdaptationCandidateSchema,
  createdAt: z.string().datetime(),
  idempotencyKey: hashSchema,
}).strict().superRefine((proposal, context) => {
  const expectedAuthority = proposal.proposalOrigin === "SELF_SERVICE" ? "SELF" : "COACH_REQUIRED"
  if (proposal.selectionAuthority !== expectedAuthority) addIssue(context, ["selectionAuthority"], "Selection authority must follow proposal origin.")
  if (proposal.baseCandidate.selectionAuthority !== proposal.selectionAuthority
      || proposal.successorCandidate.selectionAuthority !== proposal.selectionAuthority) {
    addIssue(context, ["selectionAuthority"], "Proposal authority must match both candidate authorities.")
  }
  if (proposal.baseCandidateId !== proposal.baseCandidate.candidateId) addIssue(context, ["baseCandidateId"], "Base candidate identity mismatch.")
  if (proposal.sourceCandidateId !== proposal.baseCandidate.candidateId
      || proposal.sourceCandidateContentHash !== proposal.baseContentHash) addIssue(context, ["sourceCandidateId"], "Source candidate identity mismatch.")
  if (proposal.predecessorPairFingerprint !== proposal.pairId) addIssue(context, ["predecessorPairFingerprint"], "Predecessor pair fingerprint mismatch.")
  if (proposal.trigger !== proposal.triggerSnapshot.kind) addIssue(context, ["triggerSnapshot"], "Trigger snapshot mismatch.")
  if (proposal.evaluatedAt !== proposal.createdAt) addIssue(context, ["evaluatedAt"], "Proposal evaluation timestamp mismatch.")
  if (proposal.safetyGate.kind !== "passed"
      || Date.parse(proposal.safetyEvaluatedAt) > Date.parse(proposal.createdAt)
      || Date.parse(proposal.createdAt) > Date.parse(proposal.safetyValidUntil)) {
    addIssue(context, ["safetyGate"], "Proposal safety snapshot must be passed and fresh.")
  }
  if (proposal.expiresAt !== new Date(Date.parse(proposal.createdAt) + 72 * 60 * 60 * 1_000).toISOString()) {
    addIssue(context, ["expiresAt"], "Proposal expiry must be exactly 72 hours after creation.")
  }
  const expectedDirection = proposal.baseCandidate.kind === "BALANCED" ? "REDUCE" : "INCREASE"
  const expectedEdge = proposal.baseCandidate.kind === "BALANCED"
    ? "BALANCED_TO_CONSERVATIVE_EXISTING_SIBLING_ONLY"
    : "CONSERVATIVE_TO_BALANCED_EXISTING_SIBLING_ONLY"
  if (proposal.transformDirection !== expectedDirection || proposal.transformEdgeId !== expectedEdge) {
    addIssue(context, ["transformEdgeId"], "Transform edge direction mismatch.")
  }
  if (proposal.pairId !== proposal.baseCandidate.pairId || proposal.pairId !== proposal.successorCandidate.pairId) addIssue(context, ["pairId"], "Proposal pair identity mismatch.")
  const balanced = proposal.baseCandidate.kind === "BALANCED"
    ? proposal.baseCandidate
    : proposal.successorCandidate
  const conservative = proposal.baseCandidate.kind === "CONSERVATIVE"
    ? proposal.baseCandidate
    : proposal.successorCandidate
  if (!hasValidCandidatePairIdentity(balanced, conservative)) addIssue(context, ["pairId"], "Proposal pair content identity mismatch.")
  if (JSON.stringify(proposal.selectedDetailedTemplateRef) !== JSON.stringify(proposal.baseCandidate.selectedDetailedTemplateRef)
      || JSON.stringify(proposal.selectedDetailedTemplateRef) !== JSON.stringify(proposal.successorCandidate.selectedDetailedTemplateRef)) {
    addIssue(context, ["selectedDetailedTemplateRef"], "Proposal template identity mismatch.")
  }
})
export const planAdaptationProposalSchema = canonicalJsonTreeSchema.pipe(planAdaptationProposalObjectSchema)

const pendingNextFrameSuccessorObjectSchema = z.object({
  version: z.literal(1), proposalId: z.string().regex(/^adaptation:[a-f0-9]{64}$/u), targetFrame: z.literal("NEXT_FRAME"),
  proposalOrigin: z.enum(["SELF_SERVICE", "COACH_AUTHORED"]), selectionAuthority: z.enum(["SELF", "COACH_REQUIRED"]),
  trigger: z.enum(["SAME_EVENT_PB_SB_AFTER_ACTIVE_PLAN_START", "EXPLICIT_REQUEST"]), triggerSnapshot: adaptationTriggerSnapshotSchema, triggerSnapshotHash: hashSchema, changeDimension: z.enum(["INTENSITY", "VOLUME", "FREQUENCY"]),
  ...adaptationTransformMetadataShape,
  athleteId: opaqueAthleteIdSchema, eventDistanceM: adaptationScopeSchema.shape.eventDistanceM,
  pairId: z.string().regex(/^plan-pair:v3:/u), selectedDetailedTemplateRef: detailedTemplateRefSchema.nullable(),
  baseCandidateId: adaptationCandidateIdSchema, baseContentHash: hashSchema, proposedContentHash: hashSchema, predecessorStateHash: hashSchema,
  successorState: planBetaStateV3Schema,
  acceptanceSafetyEvaluatedAt: z.string().datetime(), acceptanceSafetyValidUntil: z.string().datetime(),
  acceptedAt: z.string().datetime(), decisionId: z.string().regex(/^adaptation-decision:[a-f0-9]{64}$/u), idempotencyKey: hashSchema, requestHash: hashSchema,
}).strict().superRefine((record, context) => {
  if (record.successorState.activePlan.candidateId === record.baseCandidateId) addIssue(context, ["successorState", "activePlan", "candidateId"], "Successor must differ from predecessor.")
  if (!adaptationCandidateIdSchema.safeParse(record.successorState.activePlan.candidateId).success) addIssue(context, ["successorState", "activePlan", "candidateId"], "Successor candidate identity is invalid.")
  const expectedAuthority = record.proposalOrigin === "SELF_SERVICE" ? "SELF" : "COACH_REQUIRED"
  if (record.selectionAuthority !== expectedAuthority) addIssue(context, ["selectionAuthority"], "Selection authority must follow proposal origin.")
  if (record.pairId !== record.successorState.activePlan.pairId
      || JSON.stringify(record.selectedDetailedTemplateRef) !== JSON.stringify(record.successorState.activePlan.selectedDetailedTemplateRef)) {
    addIssue(context, ["successorState"], "Pending successor scope must match its active plan.")
  }
  if (record.trigger !== record.triggerSnapshot.kind
      || record.predecessorPairFingerprint !== record.pairId
      || record.sourceCandidateId !== record.baseCandidateId
      || record.sourceCandidateContentHash !== record.baseContentHash) {
    addIssue(context, ["transformEdgeId"], "Pending transform provenance mismatch.")
  }
  const reduction = record.transformEdgeId === "BALANCED_TO_CONSERVATIVE_EXISTING_SIBLING_ONLY"
  if ((reduction && (record.transformDirection !== "REDUCE"
      || !record.baseCandidateId.includes(":balanced:")
      || record.successorState.activePlan.candidateKind !== "CONSERVATIVE"))
      || (!reduction && (record.transformDirection !== "INCREASE"
        || !record.baseCandidateId.includes(":conservative:")
        || record.successorState.activePlan.candidateKind !== "BALANCED"))) {
    addIssue(context, ["transformEdgeId"], "Pending transform direction mismatch.")
  }
  if (record.safetyGate.kind !== "passed"
      || record.expiresAt !== new Date(Date.parse(record.evaluatedAt) + 72 * 60 * 60 * 1_000).toISOString()) {
    addIssue(context, ["safetyGate"], "Pending safety or expiry provenance mismatch.")
  }
  if (Date.parse(record.acceptanceSafetyEvaluatedAt) > Date.parse(record.acceptedAt)
      || Date.parse(record.acceptedAt) > Date.parse(record.acceptanceSafetyValidUntil)) {
    addIssue(context, ["acceptanceSafetyEvaluatedAt"], "Acceptance safety must be fresh at acceptance.")
  }
})
export const pendingNextFrameSuccessorSchema = canonicalJsonTreeSchema.pipe(pendingNextFrameSuccessorObjectSchema)

export const planAdaptationDecisionSchema = z.object({
  version: z.literal(1), decisionId: z.string().regex(/^adaptation-decision:[a-f0-9]{64}$/u), proposalId: z.string().regex(/^adaptation:[a-f0-9]{64}$/u), decision: z.literal("ACCEPT"),
  predecessorStateHash: hashSchema, proposedContentHash: hashSchema, decidedAt: z.string().datetime(), idempotencyKey: hashSchema, requestHash: hashSchema,
}).strict()

const planAdaptationEnvelopeObjectSchema = z.object({ version: z.literal(1), pending: pendingNextFrameSuccessorSchema, decision: planAdaptationDecisionSchema }).strict().superRefine((envelope, context) => {
  if (envelope.pending.proposalId !== envelope.decision.proposalId || envelope.pending.decisionId !== envelope.decision.decisionId || envelope.pending.requestHash !== envelope.decision.requestHash) addIssue(context, ["decision"], "Decision and pending successor linkage mismatch.")
})
export const planAdaptationEnvelopeSchema = canonicalJsonTreeSchema.pipe(planAdaptationEnvelopeObjectSchema)

export const planHistoryListSchema = z.array(planHistorySchema).max(18)

export type PlanBetaIntake = z.infer<typeof planIntakeSchema>
export type StoredPlanBetaIntake = z.infer<typeof storedPlanIntakeSchema>
export type CompetitionDivision = PlanBetaIntake["competitionDivision"]
export type StoredPlanProgress = z.infer<typeof progressSchema>
export type LegacyPlanBetaState = z.infer<typeof planBetaStateV1Schema>
export type PlanBetaStateV2 = z.infer<typeof planBetaStateV2Schema>
export type PlanBetaStateV3 = z.infer<typeof planBetaStateV3Schema>
export type PlanBetaState = (Omit<PlanBetaStateV2, "version"> & {
  readonly version: 1 | 2
}) | PlanBetaStateV3
export type StoredPlanHistory = z.infer<typeof planHistorySchema>
export type PendingNextFrameSuccessor = z.infer<typeof pendingNextFrameSuccessorSchema>
export type PlanAdaptationDecision = z.infer<typeof planAdaptationDecisionSchema>
export type PlanAdaptationEnvelope = z.infer<typeof planAdaptationEnvelopeSchema>

export function parsePlanBetaState(candidate: unknown): PlanBetaState | null {
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
