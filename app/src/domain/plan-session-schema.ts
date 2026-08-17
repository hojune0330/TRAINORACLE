import { z } from "zod"
import type { SafetyGateDecision } from "@impl/safety-gate/gate"
import { parsePrescriptionNotation } from "@impl/prescription/notation"
import { derivePrescriptionTotals } from "@impl/prescription/totals"
import {
  resolveDetailedPrescriptionApproval,
  type DetailedPrescriptionApprovalRecord,
  type DetailedPrescriptionApprovalRequest,
} from "./detailed-prescription-approvals"

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
const fingerprintSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/)
const componentRefSchema = z.object({
  componentType: z.enum(["WARMUP", "COOLDOWN", "DOWNSHIFT", "STOP_CONDITIONS"]),
  componentRef: z.string().min(1),
  componentVersion: z.string().min(1),
  componentFingerprint: fingerprintSchema,
}).strict()
const warmupSchema = z.object({
  componentRef: z.literal("WU-V2-5K-01"),
  componentVersion: z.literal("1.0.0"),
  authority: z.literal("OWNER_OPERATIONAL_ADAPTATION"),
  easyDurationMinutes: z.literal(15),
  rpeMin: z.literal(2),
  rpeMax: z.literal(3),
  strides: z.object({
    repetitions: z.literal(4),
    durationSeconds: z.literal(20),
    recoverySeconds: z.literal(40),
    recoveryMode: z.literal("WALK_OR_JOG"),
    progression: z.literal("PROGRESSIVE"),
  }).strict(),
}).strict()
const cooldownSchema = z.object({
  componentRef: z.literal("CD-V2-5K-01"),
  componentVersion: z.literal("1.0.0"),
  authority: z.literal("OWNER_OPERATIONAL_ADAPTATION"),
  easyDurationMinutes: z.literal(10),
  rpeMin: z.literal(1),
  rpeMax: z.literal(2),
}).strict()
const fallbackSchema = z.object({
  componentRef: z.literal("RPE-ONLY-CONTROLLED-01"),
  componentVersion: z.literal("1.0.0"),
  code: z.literal("RPE_ONLY_CONTROLLED"),
  behavior: z.literal("DELEGATE_TO_EXISTING_RPE_CANDIDATE"),
  numericRepetitionVariant: z.null(),
}).strict()
const stopCodeSchema = z.enum([
  "STOP_NEW_OR_WORSENING_PAIN",
  "STOP_DIZZINESS_OR_FAINTNESS",
  "STOP_CHEST_PAIN_OR_UNUSUAL_BREATHING",
  "STOP_LOSS_OF_CONTROLLED_FORM",
])
const stopConditionsSchema = z.object({
  componentRef: z.literal("STOP-V2-5K-01"),
  componentVersion: z.literal("1.0.0"),
  authority: z.literal("OWNER_PRECAUTIONARY_OPERATIONAL_RULE"),
  diagnosticClaim: z.literal(false),
  codes: z.array(stopCodeSchema).length(4).readonly(),
}).strict()
const operationalComponentsSchema = z.object({
  warmup: warmupSchema,
  cooldown: cooldownSchema,
  fallback: fallbackSchema,
  stopConditions: stopConditionsSchema,
}).strict()
const totalsSchema = z.object({
  totalRepetitions: z.number().int().positive(),
  qualityDistanceM: z.number().int().positive(),
  qualityDurationSeconds: z.number().int().positive().nullable(),
  repetitionRecoveryOccurrences: z.number().int().nonnegative(),
  repetitionRecoveryTotalSeconds: z.number().int().nonnegative(),
  setRecoveryOccurrences: z.number().int().nonnegative(),
  setRecoveryTotalSeconds: z.number().int().nonnegative(),
  plannedRecoverySeconds: z.number().int().nonnegative(),
  mainSessionTotalExcludingWarmupCooldown: z.number().int().positive().nullable(),
  uncomputableReasonCodes: z.array(z.enum([
    "QUALITY_DISTANCE_UNAVAILABLE",
    "WORK_DURATION_UNAVAILABLE",
    "REPETITION_RECOVERY_UNAVAILABLE",
    "SET_RECOVERY_UNAVAILABLE",
  ])).readonly(),
}).strict()
const evidenceIdentitySchema = z.object({
  evidenceId: z.string().min(1),
  decisionRef: z.string().min(1),
  fingerprint: fingerprintSchema,
}).strict()
const paceTargetContentShape = {
  kind: z.literal("PACE_TARGET"),
  manifestVersion: z.string().min(1),
  templateId: z.string().min(1),
  templateVersion: z.string().min(1),
  templateContentFingerprint: fingerprintSchema,
  notation: z.string().min(1),
  sourceDecisionId: z.string().min(1),
  sourceEvidenceRef: z.string().min(1),
  approvalDecisionId: z.string().min(1),
  ownerAuthorityDecisionId: z.string().min(1),
  sportsScienceEvidence: evidenceIdentitySchema,
  populationApplicabilityEvidence: evidenceIdentitySchema,
  scope: z.object({
    eventGroup: z.literal("FIVE_K"),
    experienceBand: z.literal("EXPERIENCED"),
    population: z.literal("YOUTH_AND_ADULT"),
    eventEvidenceFingerprint: fingerprintSchema,
    experienceEvidenceFingerprint: fingerprintSchema,
  }).strict(),
  componentRefs: z.array(componentRefSchema).length(4).readonly(),
  operationalComponents: operationalComponentsSchema,
  setCount: z.number().int().positive(),
  repetitionsPerSet: z.number().int().positive(),
  repetitionDistanceM: z.number().int().positive(),
  targetEventDistanceM: z.number().int().positive(),
  targetRepSeconds: z.number().finite().positive(),
  selectedAnchor: currentAnchorSchema,
  displayRoundingPolicyVersion: z.string().min(1),
  repetitionRecoverySeconds: z.number().int().positive().nullable(),
  repetitionRecoveryMode: z.enum(["WALK", "JOG", "STAND", "NOT_APPLICABLE"]),
  setRecoverySeconds: z.number().int().positive().nullable(),
  setRecoveryMode: z.enum(["WALK", "JOG", "STAND", "NOT_APPLICABLE"]),
  totals: totalsSchema,
  stopCodes: z.array(stopCodeSchema).length(4).readonly(),
  fallbackCode: z.literal("RPE_ONLY_CONTROLLED"),
}
const paceTargetContentBaseSchema = z.object(paceTargetContentShape).strict()
type StoredPaceTargetContent = z.infer<typeof paceTargetContentBaseSchema>
const paceTargetContentSchema = paceTargetContentBaseSchema.superRefine(
  validateStoredPaceTargetContent,
)

export const paceTargetPlanItemSchema = z.object({
  ...paceTargetContentShape,
  prescriptionFingerprint: z.string().startsWith("canonical-json-v1:"),
}).strict().superRefine((value, context) => {
  validateStoredPaceTargetContent(value, context)
  const { prescriptionFingerprint, ...content } = value
  if (prescriptionFingerprint !== storedPrescriptionFingerprint(content)) {
    context.addIssue({
      code: "custom",
      path: ["prescriptionFingerprint"],
      message: "Stored prescription fingerprint mismatch.",
    })
  }
})

function validateStoredPaceTargetContent(
  value: StoredPaceTargetContent,
  context: z.RefinementCtx,
): void {
  const componentTypes = value.componentRefs.map((component) => component.componentType)
  if (new Set(componentTypes).size !== 4) {
    addStoredIssue(context, ["componentRefs"], "Stored component identities must be unique.")
  }
  const expectedComponents = [
    ["WARMUP", value.operationalComponents.warmup],
    ["COOLDOWN", value.operationalComponents.cooldown],
    ["DOWNSHIFT", value.operationalComponents.fallback],
    ["STOP_CONDITIONS", value.operationalComponents.stopConditions],
  ] as const
  for (const [componentType, component] of expectedComponents) {
    const ref = value.componentRefs.find((candidate) => candidate.componentType === componentType)
    if (
      ref === undefined
      || ref.componentRef !== component.componentRef
      || ref.componentVersion !== component.componentVersion
    ) {
      addStoredIssue(context, ["componentRefs"], `${componentType} identity mismatch.`)
    }
  }
  if (JSON.stringify(value.stopCodes) !== JSON.stringify(value.operationalComponents.stopConditions.codes)) {
    addStoredIssue(context, ["stopCodes"], "Stored stop codes must match the stop component.")
  }
  if (value.fallbackCode !== value.operationalComponents.fallback.code) {
    addStoredIssue(context, ["fallbackCode"], "Stored fallback code must match the fallback component.")
  }

  const totalRepetitions = value.setCount * value.repetitionsPerSet
  const repetitionRecoveryOccurrences = value.setCount * Math.max(0, value.repetitionsPerSet - 1)
  const setRecoveryOccurrences = Math.max(0, value.setCount - 1)
  const repetitionRecoveryTotalSeconds = repetitionRecoveryOccurrences * (value.repetitionRecoverySeconds ?? 0)
  const setRecoveryTotalSeconds = setRecoveryOccurrences * (value.setRecoverySeconds ?? 0)
  const expectedTotals = {
    totalRepetitions,
    qualityDistanceM: totalRepetitions * value.repetitionDistanceM,
    repetitionRecoveryOccurrences,
    repetitionRecoveryTotalSeconds,
    setRecoveryOccurrences,
    setRecoveryTotalSeconds,
    plannedRecoverySeconds: repetitionRecoveryTotalSeconds + setRecoveryTotalSeconds,
  }
  for (const [key, expected] of Object.entries(expectedTotals)) {
    if (value.totals[key as keyof typeof expectedTotals] !== expected) {
      addStoredIssue(context, ["totals", key], "Stored derived total mismatch.")
    }
  }
  if (
    (value.repetitionRecoverySeconds === null) !== (value.repetitionRecoveryMode === "NOT_APPLICABLE")
    || (value.setRecoverySeconds === null) !== (value.setRecoveryMode === "NOT_APPLICABLE")
  ) {
    addStoredIssue(context, ["repetitionRecoveryMode"], "Timed recovery requires an explicit mode.")
  }
  if (
    value.selectedAnchor.eventDistanceM !== value.targetEventDistanceM
    || Math.round(
      value.selectedAnchor.performanceSeconds
      * value.repetitionDistanceM
      / value.targetEventDistanceM,
    ) !== value.targetRepSeconds
  ) {
    addStoredIssue(context, ["selectedAnchor"], "Stored anchor does not reproduce the pace target.")
  }
}

function addStoredIssue(
  context: z.RefinementCtx,
  path: readonly (string | number)[],
  message: string,
): void {
  context.addIssue({ code: "custom", path: [...path], message })
}

function storedPrescriptionFingerprint(content: StoredPaceTargetContent): string {
  return `canonical-json-v1:${JSON.stringify(content)}`
}

export function createStoredPaceTargetPrescription(
  input: unknown,
): StoredPaceTargetPrescription | null {
  const content = paceTargetContentSchema.safeParse(input)
  if (!content.success) return null
  const parsed = paceTargetPlanItemSchema.safeParse({
    ...content.data,
    prescriptionFingerprint: storedPrescriptionFingerprint(content.data),
  })
  return parsed.success ? parsed.data : null
}

export type StoredPaceTargetPrescription = z.infer<typeof paceTargetPlanItemSchema>
export type DetailedPrescriptionApprovalLookup = (
  request: DetailedPrescriptionApprovalRequest,
) => DetailedPrescriptionApprovalRecord | undefined

export type StoredPrescriptionAuthorityResult =
  | { readonly kind: "permitted"; readonly operation: "START" | "RESTART" }
  | {
      readonly kind: "blocked"
      readonly operation: "START" | "RESTART"
      readonly code:
        | "CURRENT_SAFETY_GATE_BLOCKED"
        | "STORED_PRESCRIPTION_INVALID"
        | "TRUSTED_APPROVAL_UNAVAILABLE"
        | "TRUSTED_APPROVAL_MISMATCH"
    }

export function recheckStoredDetailedPrescriptionAuthority(
  input: {
    readonly operation: "START" | "RESTART"
    readonly prescription: unknown
    readonly evaluatedAt: string
    readonly safetyGate: SafetyGateDecision
  },
  lookup: DetailedPrescriptionApprovalLookup = resolveDetailedPrescriptionApproval,
): StoredPrescriptionAuthorityResult {
  if (input.safetyGate.kind === "blocked") {
    return { kind: "blocked", operation: input.operation, code: "CURRENT_SAFETY_GATE_BLOCKED" }
  }
  const parsed = paceTargetPlanItemSchema.safeParse(input.prescription)
  if (!parsed.success) {
    return { kind: "blocked", operation: input.operation, code: "STORED_PRESCRIPTION_INVALID" }
  }
  const prescription = parsed.data
  const approval = lookup({
    templateId: prescription.templateId,
    templateVersion: prescription.templateVersion,
    templateContentFingerprint: prescription.templateContentFingerprint,
    athleteEventGroup: prescription.scope.eventGroup,
    athleteExperienceBand: prescription.scope.experienceBand,
    eventScopeEvidenceFingerprint: prescription.scope.eventEvidenceFingerprint,
    experienceScopeEvidenceFingerprint: prescription.scope.experienceEvidenceFingerprint,
    sportsScienceEvidenceFingerprint: prescription.sportsScienceEvidence.fingerprint,
    populationApplicability: prescription.scope.population,
    populationEvidenceFingerprint: prescription.populationApplicabilityEvidence.fingerprint,
    componentRefs: prescription.componentRefs,
    evaluatedAt: input.evaluatedAt,
  })
  if (approval === undefined) {
    return { kind: "blocked", operation: input.operation, code: "TRUSTED_APPROVAL_UNAVAILABLE" }
  }
  if (!approvalMatchesStoredPrescription(approval, prescription)) {
    return { kind: "blocked", operation: input.operation, code: "TRUSTED_APPROVAL_MISMATCH" }
  }
  return { kind: "permitted", operation: input.operation }
}

function approvalMatchesStoredPrescription(
  approval: DetailedPrescriptionApprovalRecord,
  prescription: StoredPaceTargetPrescription,
): boolean {
  const parsedNotation = parsePrescriptionNotation(approval.notation)
  if (parsedNotation.kind !== "parsed") return false
  const totals = derivePrescriptionTotals(parsedNotation.notation)
  return approval.manifestVersion === prescription.manifestVersion
    && approval.notation === prescription.notation
    && approval.sourceDecisionId === prescription.sourceDecisionId
    && approval.sourceEvidenceRef === prescription.sourceEvidenceRef
    && approval.approvalDecisionId === prescription.approvalDecisionId
    && approval.ownerDecision.authorityDecisionId === prescription.ownerAuthorityDecisionId
    && approval.sportsScienceEvidence.evidenceId === prescription.sportsScienceEvidence.evidenceId
    && approval.sportsScienceEvidence.decisionRef === prescription.sportsScienceEvidence.decisionRef
    && approval.populationApplicabilityEvidence.evidenceId === prescription.populationApplicabilityEvidence.evidenceId
    && approval.populationApplicabilityEvidence.decisionRef === prescription.populationApplicabilityEvidence.decisionRef
    && JSON.stringify(approval.componentRefs) === JSON.stringify(prescription.componentRefs)
    && JSON.stringify(approval.canonicalTemplateContent.operationalComponents) === JSON.stringify(prescription.operationalComponents)
    && parsedNotation.notation.setCount === prescription.setCount
    && parsedNotation.notation.repetitionsPerSet === prescription.repetitionsPerSet
    && parsedNotation.notation.repetitionDistanceM === prescription.repetitionDistanceM
    && parsedNotation.notation.paceTargetEventDistanceM === prescription.targetEventDistanceM
    && parsedNotation.notation.repetitionRecoverySeconds === prescription.repetitionRecoverySeconds
    && parsedNotation.notation.repetitionRecoveryMode === prescription.repetitionRecoveryMode
    && parsedNotation.notation.setRecoverySeconds === prescription.setRecoverySeconds
    && parsedNotation.notation.setRecoveryMode === prescription.setRecoveryMode
    && JSON.stringify(totals) === JSON.stringify(prescription.totals)
}

const rpeTimeRangeSchema = z.object({
  kind: z.literal("RPE_TIME_RANGE"),
  rpe: z.object({
    minimum: z.number(),
    maximum: z.number(),
  }).strict(),
  durationMinutes: z.object({
    minimum: z.number(),
    maximum: z.number(),
  }).strict(),
}).strict()

const restSessionSchema = z.object({
    day: z.number().int().positive(),
    slot: sessionSlotSchema.optional().default("AM"),
    role: z.literal("REST"),
    plannedEnergyIntent: z.literal("RECOVERY_INTENT").optional().default("RECOVERY_INTENT"),
    prescription: z.object({ kind: z.literal("REST") }).strict(),
  }).strict()
const easySessionSchema = z.object({
    day: z.number().int().positive(),
    slot: sessionSlotSchema.optional().default("AM"),
    role: z.literal("EASY"),
    plannedEnergyIntent: z.enum(["RECOVERY_INTENT", "BASE_INTENT"]).optional().default("BASE_INTENT"),
    prescription: rpeTimeRangeSchema,
  }).strict()
const qualitySessionBase = {
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
}
const legacyQualitySessionSchema = z.object({
    ...qualitySessionBase,
    prescription: rpeTimeRangeSchema,
  }).strict()
const detailedQualitySessionSchema = z.object({
  ...qualitySessionBase,
  prescription: z.union([rpeTimeRangeSchema, paceTargetPlanItemSchema]),
}).strict()

export const legacyPlanSessionSchema = z.discriminatedUnion("role", [
  restSessionSchema,
  easySessionSchema,
  legacyQualitySessionSchema,
])

export const planSessionSchema = z.discriminatedUnion("role", [
  restSessionSchema,
  easySessionSchema,
  detailedQualitySessionSchema,
])

const legacyPlanFrameSchema = z.object({
  lengthDays: frameLengthSchema,
  continuity: z.union([
    z.object({
      kind: z.literal("SEVEN_DAY_CONTINUITY"),
      nextFrameInput: z.literal("SELECTED_PLAN_AND_PROGRESS"),
    }).strict(),
    z.object({ kind: z.literal("STANDARD_FRAME") }).strict(),
  ]),
}).strict()

const canonicalPlanFrameSchema = z.object({
  formationKind: z.literal("LOCAL_CIVIL_9_5"),
  lengthDays: z.literal(9.5),
  slotCount: z.literal(19),
  projectionLengthDays: z.union([frameLengthSchema, z.literal(9.5)]).optional(),
  continuity: z.union([
    z.object({
      kind: z.literal("SEVEN_DAY_CONTINUITY"),
      nextFrameInput: z.literal("SELECTED_PLAN_AND_PROGRESS"),
    }).strict(),
    z.object({ kind: z.literal("STANDARD_FRAME") }).strict(),
  ]),
}).strict()

export const planFrameSchema = z.union([
  legacyPlanFrameSchema,
  canonicalPlanFrameSchema,
]).superRefine((frame, context) => {
  if (!("formationKind" in frame)) return

  const projectionLengthDays = frame.projectionLengthDays ?? frame.lengthDays
  const expectedContinuityKind = projectionLengthDays === 7
    ? "SEVEN_DAY_CONTINUITY"
    : "STANDARD_FRAME"

  if (frame.continuity.kind !== expectedContinuityKind) {
    context.addIssue({
      code: "custom",
      path: ["continuity", "kind"],
      message: `Projection ${projectionLengthDays} requires ${expectedContinuityKind}`,
    })
  }
})

const activePlanShape = {
  kind: z.literal("BETA_ACTIVE_PLAN_SNAPSHOT"),
  activationState: z.literal("SELECTED_BETA_SNAPSHOT"),
  candidateId: z.string().min(1),
  candidateKind: z.enum(["BALANCED", "CONSERVATIVE"]),
  selectionActor: z.enum(["SELF", "COACH"]),
  sourceMode: z.enum(["PROFILE_ONLY", "JOURNAL_CONTEXT_ONLY"]),
  selectedEnergyIntent: plannedEnergyIntentSchema.optional().default("MIXED_INTENT"),
  frame: planFrameSchema,
}

export const legacyActivePlanSchema = z.object({
  ...activePlanShape,
  sessions: z.array(legacyPlanSessionSchema).readonly(),
}).strict()

export const activePlanSchema = z.object({
  ...activePlanShape,
  sessions: z.array(planSessionSchema).readonly(),
}).strict()

export type StoredActivePlan = z.infer<typeof legacyActivePlanSchema>
export type StoredPlanSession = z.infer<typeof legacyPlanSessionSchema>
export type VersionedStoredActivePlan = z.infer<typeof activePlanSchema>
export type VersionedStoredPlanSession = z.infer<typeof planSessionSchema>
