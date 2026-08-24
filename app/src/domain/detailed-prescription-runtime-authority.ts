import { z } from "zod"
import {
  PLANNED_ENERGY_INTENTS,
  type DetailedTemplateRef,
  type PlannedEnergyIntent,
  type SupportedPlanEventDistanceM,
} from "@impl/plan-generator/types"
import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import {
  DETAILED_PRESCRIPTION_APPROVALS,
  type DetailedPrescriptionApprovalRecord,
} from "./detailed-prescription-approvals"

const fingerprintSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/u)
const instantSchema = z.iso.datetime({ offset: true })
const templateRefSchema = z.object({
  templateId: z.string().regex(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/u),
  version: z.string().regex(/^\d+\.\d+\.\d+$/u),
  fingerprint: fingerprintSchema,
}).strict()
const supportedEventSchema = z.union([
  z.literal(800), z.literal(1500), z.literal(3000), z.literal(5000),
])
const sourceDigestsSchema = z.array(fingerprintSchema).min(1).superRefine((values, context) => {
  if (new Set(values).size !== values.length) {
    context.addIssue({ code: "custom", message: "Source digests must be unique" })
  }
})
const reviewLimitSchema = z.enum([
  "EXPERIENCED_ONLY",
  "CURRENT_SAME_EVENT_ANCHOR_ONLY",
  "NO_CROSS_EVENT_CONVERSION",
  "NO_AUTOMATIC_PROGRESSION",
  "NO_YOUTH_MULTIPLIER",
  "NO_SEX_MULTIPLIER",
  "SOURCE_SCOPE_ONLY",
])
const reviewLimitsSchema = z.array(reviewLimitSchema).min(1).superRefine((values, context) => {
  if (new Set(values).size !== values.length) {
    context.addIssue({ code: "custom", message: "Review limits must be unique" })
  }
})
const dimensionBase = {
  status: z.literal("APPROVED"),
  limits: reviewLimitsSchema,
  evidenceFingerprint: fingerprintSchema,
}
const totalArithmeticValueSchema = z.object({
  repetitionCount: z.number().int().positive(),
  repetitionDistanceM: z.number().int().positive(),
  totalQualityDistanceM: z.number().int().positive(),
}).strict().superRefine((value, context) => {
  if (value.repetitionCount * value.repetitionDistanceM !== value.totalQualityDistanceM) {
    context.addIssue({ code: "custom", message: "Quality arithmetic must be exact" })
  }
})
const recoveryValueSchema = z.object({
  durationSeconds: z.number().int().positive(),
  mode: z.enum(["STAND", "WALK", "JOG", "WALK_OR_JOG", "ACTIVE"]),
}).strict()
const setRecoveryValueSchema = z.union([
  z.object({ kind: z.literal("NOT_APPLICABLE") }).strict(),
  z.object({ kind: z.literal("EXACT"), recovery: recoveryValueSchema }).strict(),
])
const reviewDimensionsSchema = z.object({
  phase: z.object({ ...dimensionBase, value: z.enum([
    "GENERAL_PREPARATION", "EVENT_SPECIFIC_PREPARATION", "COMPETITION_PREPARATION",
  ]) }).strict(),
  population: z.object({ ...dimensionBase, value: z.literal("YOUTH_AND_ADULT") }).strict(),
  notation: z.object({ ...dimensionBase, value: z.string().trim().min(1) }).strict(),
  totalArithmetic: z.object({ ...dimensionBase, value: totalArithmeticValueSchema }).strict(),
  repetitionRecovery: z.object({ ...dimensionBase, value: recoveryValueSchema }).strict(),
  setRecovery: z.object({ ...dimensionBase, value: setRecoveryValueSchema }).strict(),
  singletonIntent: z.object({ ...dimensionBase, value: z.enum(PLANNED_ENERGY_INTENTS) }).strict(),
  sameEventPace: z.object({
    ...dimensionBase,
    value: z.object({
      eventDistanceM: supportedEventSchema,
      anchor: z.literal("CURRENT_SAME_EVENT_ONLY"),
    }).strict(),
  }).strict(),
  contentSourceAuthority: z.object({
    ...dimensionBase,
    value: z.object({
      templateContentFingerprint: fingerprintSchema,
      sourceDigests: sourceDigestsSchema,
    }).strict(),
  }).strict(),
  youthTransfer: z.object({ ...dimensionBase, value: z.literal("SUPPORTED") }).strict(),
  femaleSexTransfer: z.object({ ...dimensionBase, value: z.literal("SUPPORTED") }).strict(),
}).strict()
const receiptBase = {
  schemaVersion: z.literal(1),
  reviewerId: z.string().regex(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u),
  reviewerQualification: z.object({
    kind: z.enum(["QUALIFIED_RUNNING_COACH", "QUALIFIED_SPORTS_SCIENCE_REVIEWER"]),
    evidenceRef: z.string().min(1),
    evidenceFingerprint: fingerprintSchema,
  }).strict(),
  independentFromExtractionAndImplementation: z.literal(true),
  conflicts: z.literal("NONE_DECLARED"),
  owningAuthority: z.literal("TRAINING_SESSION_PRESCRIPTION_CONTRACT"),
  reviewedArtifactDigest: fingerprintSchema,
  sourceDigests: sourceDigestsSchema,
  selectedTemplateRef: templateRefSchema,
  targetEventDistanceM: supportedEventSchema,
  compatibleIntent: z.enum(PLANNED_ENERGY_INTENTS),
  reviewDimensions: reviewDimensionsSchema,
  verdict: z.enum(["APPROVE", "DO_NOT_APPROVE"]),
  verdictIsUnconditional: z.literal(true),
  reviewedAt: instantSchema,
  expiresAt: instantSchema,
  revokedAt: instantSchema.nullable(),
}
const coachingReceiptSchema = z.object({
  ...receiptBase,
  lane: z.literal("COACHING_APPLICABILITY"),
  reviewScope: z.literal("EVENT_AND_SESSION_COACHING_APPLICABILITY"),
}).strict().superRefine((receipt, context) => {
  if (receipt.reviewerQualification.kind !== "QUALIFIED_RUNNING_COACH") {
    context.addIssue({ code: "custom", path: ["reviewerQualification", "kind"], message: "Coaching review requires a qualified running coach." })
  }
})
const sportsScienceReceiptSchema = z.object({
  ...receiptBase,
  lane: z.literal("SPORTS_SCIENCE_TRANSFER"),
  reviewScope: z.literal("POPULATION_AND_SPORTS_SCIENCE_TRANSFER"),
}).strict().superRefine((receipt, context) => {
  if (receipt.reviewerQualification.kind !== "QUALIFIED_SPORTS_SCIENCE_REVIEWER") {
    context.addIssue({ code: "custom", path: ["reviewerQualification", "kind"], message: "Transfer review requires a qualified sports-science reviewer." })
  }
})
const delegatedAuthoritySchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("DELEGATED_DUAL_REVIEW"),
  lifecycleStatus: z.literal("ACTIVE"),
  eligibilityStatus: z.literal("ELIGIBLE"),
  selectedTemplateRef: templateRefSchema,
  targetEventDistanceM: supportedEventSchema,
  compatibleIntent: z.enum(PLANNED_ENERGY_INTENTS),
  coachingReceipt: coachingReceiptSchema,
  sportsScienceReceipt: sportsScienceReceiptSchema,
}).strict()

export type DelegatedDetailedPrescriptionAuthority = z.infer<typeof delegatedAuthoritySchema>

export type DetailedPrescriptionRuntimeAuthorityRequest = {
  readonly selectedTemplateRef: DetailedTemplateRef | null
  readonly targetEventDistanceM: number
  readonly selectedEnergyIntent: PlannedEnergyIntent
  readonly evaluatedAt: string
}

export type DetailedPrescriptionRuntimeAuthorityResult =
  | {
      readonly kind: "authorized"
      readonly source: "BASELINE_OWNER_APPROVAL" | "DELEGATED_DUAL_REVIEW"
      readonly approval: DetailedPrescriptionApprovalRecord
    }
  | {
      readonly kind: "fallback"
      readonly code: "NO_EXPLICIT_TEMPLATE" | "RUNTIME_AUTHORITY_UNAVAILABLE"
    }

const BASELINE_TEMPLATE_IDENTITIES = Object.freeze(new Set([
  "V2-SEED-05\u00001.0.0\u0000sha256:ad4a8c436a5a6e7a9c81342d79b359d84b1b8ea1034f9589141429eea8d0e42a\u00005000\u0000VO2_INTENT",
  "MD-800-01\u00001.0.0\u0000sha256:8aa917947277883df94a9de665accd59a028b6753cec22d8fecf06795d28b149\u0000800\u0000GLY_INTENT",
  "MD-1500-01\u00001.0.0\u0000sha256:dd82bb01baa7b34e163f9148b76eae3956285dc5d1bd7e5217cd39373d966fab\u00001500\u0000MIXED_INTENT",
  "MD-3000-01\u00001.0.0\u0000sha256:a69b24eccf72be076865b091d6a4ee408da6444512c09a788d717d99adc7a455\u00003000\u0000VO2_INTENT",
]))
const DELEGATED_RUNTIME_AUTHORITIES: readonly DelegatedDetailedPrescriptionAuthority[] = Object.freeze([])
const REVIEW_DIMENSION_KEYS = Object.freeze([
  "phase",
  "population",
  "notation",
  "totalArithmetic",
  "repetitionRecovery",
  "setRecovery",
  "singletonIntent",
  "sameEventPace",
  "contentSourceAuthority",
  "youthTransfer",
  "femaleSexTransfer",
] as const)
const REVIEW_DIMENSION_FINGERPRINT_DOMAIN = "trainoracle.delegated-detailed-prescription-review-dimension.v1"

function templateIdentity(
  reference: DetailedTemplateRef,
  eventDistanceM: SupportedPlanEventDistanceM,
  selectedEnergyIntent: PlannedEnergyIntent,
): string {
  return `${reference.templateId}\u0000${reference.version}\u0000${reference.fingerprint}\u0000${eventDistanceM}\u0000${selectedEnergyIntent}`
}

function referenceMatches(left: DetailedTemplateRef, right: DetailedTemplateRef): boolean {
  return left.templateId === right.templateId
    && left.version === right.version
    && left.fingerprint === right.fingerprint
}

function receiptIsCurrent(
  receipt: DelegatedDetailedPrescriptionAuthority["coachingReceipt"]
    | DelegatedDetailedPrescriptionAuthority["sportsScienceReceipt"],
  evaluatedAt: number,
): boolean {
  const reviewedAt = Date.parse(receipt.reviewedAt)
  const expiresAt = Date.parse(receipt.expiresAt)
  return Number.isFinite(reviewedAt)
    && Number.isFinite(expiresAt)
    && reviewedAt <= evaluatedAt
    && evaluatedAt < expiresAt
    && receipt.revokedAt === null
}

function approvalIsCurrent(
  approval: DetailedPrescriptionApprovalRecord,
  evaluatedAt: number,
): boolean {
  const decidedAt = Date.parse(approval.decidedAt)
  const expiresAt = Date.parse(approval.expiresAt)
  return approval.lifecycleStatus === "ACTIVE"
    && approval.eligibilityStatus === "ELIGIBLE"
    && Number.isFinite(decidedAt)
    && Number.isFinite(expiresAt)
    && decidedAt <= evaluatedAt
    && evaluatedAt < expiresAt
    && approval.revokedAt === null
}

function dimensionFingerprintMatches(
  receipt: DelegatedDetailedPrescriptionAuthority["coachingReceipt"]
    | DelegatedDetailedPrescriptionAuthority["sportsScienceReceipt"],
  key: (typeof REVIEW_DIMENSION_KEYS)[number],
): boolean {
  const dimension = receipt.reviewDimensions[key]
  return dimension.evidenceFingerprint === canonicalJsonFingerprint(
    REVIEW_DIMENSION_FINGERPRINT_DOMAIN,
    {
      schemaVersion: 1,
      reviewerId: receipt.reviewerId,
      lane: receipt.lane,
      templateId: receipt.selectedTemplateRef.templateId,
      templateVersion: receipt.selectedTemplateRef.version,
      templateContentDigest: receipt.selectedTemplateRef.fingerprint,
      sourceDigests: receipt.sourceDigests,
      targetEventDistanceM: receipt.targetEventDistanceM,
      compatibleIntent: receipt.compatibleIntent,
      dimension: key,
      status: dimension.status,
      limits: dimension.limits,
      decision: dimension.value,
    },
  )
}

function receiptDimensionsMatch(
  left: DelegatedDetailedPrescriptionAuthority["coachingReceipt"],
  right: DelegatedDetailedPrescriptionAuthority["sportsScienceReceipt"],
): boolean {
  return canonicalJsonFingerprint("trainoracle.delegated-review-source-set.v1", left.sourceDigests)
      === canonicalJsonFingerprint("trainoracle.delegated-review-source-set.v1", right.sourceDigests)
    && REVIEW_DIMENSION_KEYS.every((key) => (
      dimensionFingerprintMatches(left, key)
      && dimensionFingerprintMatches(right, key)
      && canonicalJsonFingerprint("trainoracle.delegated-review-dimension-decision.v1", {
        status: left.reviewDimensions[key].status,
        limits: left.reviewDimensions[key].limits,
        value: left.reviewDimensions[key].value,
      }) === canonicalJsonFingerprint("trainoracle.delegated-review-dimension-decision.v1", {
        status: right.reviewDimensions[key].status,
        limits: right.reviewDimensions[key].limits,
        value: right.reviewDimensions[key].value,
      })
    ))
}

export function parseDelegatedDetailedPrescriptionAuthority(
  value: unknown,
): DelegatedDetailedPrescriptionAuthority | null {
  const parsed = delegatedAuthoritySchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

export function delegatedDetailedPrescriptionAuthorityMatches(
  value: unknown,
  request: DetailedPrescriptionRuntimeAuthorityRequest,
): boolean {
  const authority = parseDelegatedDetailedPrescriptionAuthority(value)
  if (authority === null || request.selectedTemplateRef === null) return false
  const coaching = authority.coachingReceipt
  const science = authority.sportsScienceReceipt
  const evaluatedAt = Date.parse(request.evaluatedAt)
  if (!Number.isFinite(evaluatedAt)) return false
  return referenceMatches(authority.selectedTemplateRef, request.selectedTemplateRef)
    && authority.targetEventDistanceM === request.targetEventDistanceM
    && authority.compatibleIntent === request.selectedEnergyIntent
    && coaching.reviewerId !== science.reviewerId
    && coaching.reviewedArtifactDigest === authority.selectedTemplateRef.fingerprint
    && science.reviewedArtifactDigest === authority.selectedTemplateRef.fingerprint
    && receiptDimensionsMatch(coaching, science)
    && referenceMatches(coaching.selectedTemplateRef, authority.selectedTemplateRef)
    && referenceMatches(science.selectedTemplateRef, authority.selectedTemplateRef)
    && coaching.targetEventDistanceM === authority.targetEventDistanceM
    && science.targetEventDistanceM === authority.targetEventDistanceM
    && coaching.compatibleIntent === authority.compatibleIntent
    && science.compatibleIntent === authority.compatibleIntent
    && coaching.reviewDimensions.singletonIntent.value === authority.compatibleIntent
    && science.reviewDimensions.singletonIntent.value === authority.compatibleIntent
    && coaching.reviewDimensions.sameEventPace.value.eventDistanceM === authority.targetEventDistanceM
    && science.reviewDimensions.sameEventPace.value.eventDistanceM === authority.targetEventDistanceM
    && coaching.reviewDimensions.contentSourceAuthority.value.templateContentFingerprint
      === authority.selectedTemplateRef.fingerprint
    && science.reviewDimensions.contentSourceAuthority.value.templateContentFingerprint
      === authority.selectedTemplateRef.fingerprint
    && canonicalJsonFingerprint(
      "trainoracle.delegated-review-source-set.v1",
      coaching.reviewDimensions.contentSourceAuthority.value.sourceDigests,
    ) === canonicalJsonFingerprint("trainoracle.delegated-review-source-set.v1", coaching.sourceDigests)
    && canonicalJsonFingerprint(
      "trainoracle.delegated-review-source-set.v1",
      science.reviewDimensions.contentSourceAuthority.value.sourceDigests,
    ) === canonicalJsonFingerprint("trainoracle.delegated-review-source-set.v1", science.sourceDigests)
    && coaching.verdict === "APPROVE"
    && science.verdict === "APPROVE"
    && receiptIsCurrent(coaching, evaluatedAt)
    && receiptIsCurrent(science, evaluatedAt)
}

export function resolveDetailedPrescriptionRuntimeAuthority(
  request: DetailedPrescriptionRuntimeAuthorityRequest,
): DetailedPrescriptionRuntimeAuthorityResult {
  const reference = request.selectedTemplateRef
  if (reference === null) return { kind: "fallback", code: "NO_EXPLICIT_TEMPLATE" }
  const parsedEvent = supportedEventSchema.safeParse(request.targetEventDistanceM)
  if (!parsedEvent.success) {
    return { kind: "fallback", code: "RUNTIME_AUTHORITY_UNAVAILABLE" }
  }
  const approval = DETAILED_PRESCRIPTION_APPROVALS.find((candidate) => (
    candidate.templateId === reference.templateId
    && candidate.templateVersion === reference.version
    && candidate.templateContentFingerprint === reference.fingerprint
    && candidate.targetEventDistanceM === request.targetEventDistanceM
  ))
  if (approval === undefined) return { kind: "fallback", code: "RUNTIME_AUTHORITY_UNAVAILABLE" }

  const evaluatedAt = Date.parse(request.evaluatedAt)
  if (!Number.isFinite(evaluatedAt) || !approvalIsCurrent(approval, evaluatedAt)) {
    return { kind: "fallback", code: "RUNTIME_AUTHORITY_UNAVAILABLE" }
  }
  const baselineApproved = BASELINE_TEMPLATE_IDENTITIES.has(
    templateIdentity(reference, parsedEvent.data, request.selectedEnergyIntent),
  )
  if (baselineApproved) {
    return { kind: "authorized", source: "BASELINE_OWNER_APPROVAL", approval }
  }

  const delegated = DELEGATED_RUNTIME_AUTHORITIES.find((candidate) => (
    delegatedDetailedPrescriptionAuthorityMatches(candidate, request)
  ))
  return delegated === undefined
    ? { kind: "fallback", code: "RUNTIME_AUTHORITY_UNAVAILABLE" }
    : { kind: "authorized", source: "DELEGATED_DUAL_REVIEW", approval }
}

export const ACTIVE_DELEGATED_DETAILED_TEMPLATE_COUNT = DELEGATED_RUNTIME_AUTHORITIES.length
