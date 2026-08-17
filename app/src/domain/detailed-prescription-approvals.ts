import { z } from "zod"
import {
  EXPERIENCE_BANDS,
  PLAN_EVENT_GROUPS,
  type ExperienceBand,
  type PlanEventGroup,
} from "@impl/plan-generator/types"
import type { PrescriptionOperationalComponents } from "@impl/prescription/types"
import manifestSource from "./detailed-prescription-manifest.json"

const COMPONENT_TYPES = ["WARMUP", "COOLDOWN", "DOWNSHIFT", "STOP_CONDITIONS"] as const
const POPULATION_SCOPES = ["YOUTH_AND_ADULT", "ADULT_ONLY"] as const
const FINGERPRINT_PATTERN = /^sha256:[a-f0-9]{64}$/

type ComponentType = (typeof COMPONENT_TYPES)[number]
export type PopulationApplicabilityScope = (typeof POPULATION_SCOPES)[number]

type EvidenceBinding = {
  readonly decisionId: string
  readonly evidenceRef: string
  readonly evidenceFingerprint: string
}

export type TrustedReviewerAuthority = {
  readonly reviewerId: string
  readonly role: "PRODUCT_OWNER_COACH"
  readonly authorityDecisionId: string
  readonly authorityEvidenceRef: string
  readonly authorityEvidenceCanonical: {
    readonly decisionId: string
    readonly ownerId: string
    readonly approvedScope: string
  }
  readonly authorityEvidenceFingerprint: string
}

export type DetailedPrescriptionComponentRef = {
  readonly componentType: ComponentType
  readonly componentRef: string
  readonly componentVersion: string
  readonly componentFingerprint: string
}

export type DetailedPrescriptionTemplateContent = {
  readonly notation: string
  readonly operationalComponents: PrescriptionOperationalComponents
}

type SportsScienceEvidence = {
  readonly evidenceId: string
  readonly decisionRef: string
  readonly sourceRefs: readonly string[]
  readonly canonicalEvidence: {
    readonly classification: "TRAINORACLE_ADAPTATION"
    readonly sourceSupports: readonly string[]
    readonly sourceDoesNotPrescribe: readonly string[]
  }
  readonly canonicalEvidenceFingerprint: string
}

type PopulationApplicabilityEvidence = {
  readonly evidenceId: string
  readonly decisionRef: string
  readonly sourceRefs: readonly string[]
  readonly canonicalEvidence: {
    readonly scope: "YOUTH_AND_ADULT"
    readonly sameEligibilityCriteria: readonly ["FIVE_K", "EXPERIENCED", "CURRENT_SAME_EVENT_ANCHOR"]
    readonly ageOnlyReject: false
    readonly ageOnlyDoseMultiplier: false
  }
  readonly canonicalEvidenceFingerprint: string
}

export type DetailedPrescriptionApprovalRecord = {
  readonly manifestVersion: "1"
  readonly templateId: string
  readonly templateVersion: string
  readonly templateContentFingerprint: string
  readonly canonicalTemplateContent: DetailedPrescriptionTemplateContent
  readonly notation: string
  readonly lifecycleStatus: "ACTIVE"
  readonly eligibilityStatus: "ELIGIBLE"
  readonly eligibleEventGroups: readonly PlanEventGroup[]
  readonly eventScopeEvidence: EvidenceBinding
  readonly eligibleExperienceBands: readonly ExperienceBand[]
  readonly experienceScopeEvidence: EvidenceBinding
  readonly populationApplicability: { readonly scope: PopulationApplicabilityScope }
  readonly sportsScienceEvidence: SportsScienceEvidence
  readonly populationApplicabilityEvidence: PopulationApplicabilityEvidence
  readonly componentRefs: readonly DetailedPrescriptionComponentRef[]
  readonly sourceDecisionId: string
  readonly sourceEvidenceRef: string
  readonly approvalDecisionId: string
  readonly decidedAt: string
  readonly expiresAt: string
  readonly revokedAt: string | null
  readonly ownerDecision: Omit<TrustedReviewerAuthority, "authorityEvidenceCanonical"> & {
    readonly decision: "APPROVED"
    readonly independentReviewClaimed: false
  }
}

export type DetailedPrescriptionManifest = {
  readonly schemaVersion: 1
  readonly trustedReviewerAuthorities: readonly TrustedReviewerAuthority[]
  readonly approvals: readonly DetailedPrescriptionApprovalRecord[]
}

export type DetailedPrescriptionApprovalRequest = {
  readonly templateId: string
  readonly templateVersion: string
  readonly templateContentFingerprint: string
  readonly athleteEventGroup: PlanEventGroup
  readonly athleteExperienceBand: ExperienceBand
  readonly eventScopeEvidenceFingerprint: string
  readonly experienceScopeEvidenceFingerprint: string
  readonly sportsScienceEvidenceFingerprint: string
  readonly populationApplicability: PopulationApplicabilityScope
  readonly populationEvidenceFingerprint: string
  readonly componentRefs: readonly DetailedPrescriptionComponentRef[]
  readonly evaluatedAt: string
}

const nonemptyString = z.string().trim().min(1)
const fingerprint = z.string().regex(FINGERPRINT_PATTERN)
const isoInstant = z.iso.datetime({ offset: true })
const evidenceSchema = z.object({
  decisionId: nonemptyString,
  evidenceRef: nonemptyString,
  evidenceFingerprint: fingerprint,
}).strict()
const authorityCanonicalSchema = z.object({
  decisionId: nonemptyString,
  ownerId: nonemptyString,
  approvedScope: nonemptyString,
}).strict()
const authoritySchema = z.object({
  reviewerId: nonemptyString,
  role: z.literal("PRODUCT_OWNER_COACH"),
  authorityDecisionId: nonemptyString,
  authorityEvidenceRef: nonemptyString,
  authorityEvidenceCanonical: authorityCanonicalSchema,
  authorityEvidenceFingerprint: fingerprint,
}).strict()
const ownerDecisionSchema = authoritySchema.omit({ authorityEvidenceCanonical: true }).extend({
  decision: z.literal("APPROVED"),
  independentReviewClaimed: z.literal(false),
}).strict()
const warmupSchema = z.object({
  componentRef: z.literal("WU-V2-5K-01"), componentVersion: z.literal("1.0.0"),
  authority: z.literal("OWNER_OPERATIONAL_ADAPTATION"), easyDurationMinutes: z.literal(15),
  rpeMin: z.literal(2), rpeMax: z.literal(3),
  strides: z.object({ repetitions: z.literal(4), durationSeconds: z.literal(20), recoverySeconds: z.literal(40), recoveryMode: z.literal("WALK_OR_JOG"), progression: z.literal("PROGRESSIVE") }).strict(),
}).strict()
const cooldownSchema = z.object({
  componentRef: z.literal("CD-V2-5K-01"), componentVersion: z.literal("1.0.0"),
  authority: z.literal("OWNER_OPERATIONAL_ADAPTATION"), easyDurationMinutes: z.literal(10),
  rpeMin: z.literal(1), rpeMax: z.literal(2),
}).strict()
const fallbackSchema = z.object({
  componentRef: z.literal("RPE-ONLY-CONTROLLED-01"), componentVersion: z.literal("1.0.0"),
  code: z.literal("RPE_ONLY_CONTROLLED"), behavior: z.literal("DELEGATE_TO_EXISTING_RPE_CANDIDATE"),
  numericRepetitionVariant: z.null(),
}).strict()
const stopSchema = z.object({
  componentRef: z.literal("STOP-V2-5K-01"), componentVersion: z.literal("1.0.0"),
  authority: z.literal("OWNER_PRECAUTIONARY_OPERATIONAL_RULE"), diagnosticClaim: z.literal(false),
  codes: z.tuple([
    z.literal("STOP_NEW_OR_WORSENING_PAIN"), z.literal("STOP_DIZZINESS_OR_FAINTNESS"),
    z.literal("STOP_CHEST_PAIN_OR_UNUSUAL_BREATHING"), z.literal("STOP_LOSS_OF_CONTROLLED_FORM"),
  ]),
}).strict()
const operationalComponentsSchema = z.object({ warmup: warmupSchema, cooldown: cooldownSchema, fallback: fallbackSchema, stopConditions: stopSchema }).strict()
const componentSchema = z.object({ componentType: z.enum(COMPONENT_TYPES), componentRef: nonemptyString, componentVersion: nonemptyString, componentFingerprint: fingerprint }).strict()
const sportsScienceEvidenceSchema = z.object({
  evidenceId: nonemptyString, decisionRef: nonemptyString, sourceRefs: z.array(nonemptyString).min(1),
  canonicalEvidence: z.object({ classification: z.literal("TRAINORACLE_ADAPTATION"), sourceSupports: z.array(nonemptyString).min(1), sourceDoesNotPrescribe: z.array(nonemptyString).min(1) }).strict(),
  canonicalEvidenceFingerprint: fingerprint,
}).strict()
const populationEvidenceSchema = z.object({
  evidenceId: nonemptyString, decisionRef: nonemptyString, sourceRefs: z.array(nonemptyString).min(1),
  canonicalEvidence: z.object({ scope: z.literal("YOUTH_AND_ADULT"), sameEligibilityCriteria: z.tuple([z.literal("FIVE_K"), z.literal("EXPERIENCED"), z.literal("CURRENT_SAME_EVENT_ANCHOR")]), ageOnlyReject: z.literal(false), ageOnlyDoseMultiplier: z.literal(false) }).strict(),
  canonicalEvidenceFingerprint: fingerprint,
}).strict()
const approvalSchema = z.object({
  manifestVersion: z.literal("1"), templateId: nonemptyString, templateVersion: nonemptyString,
  templateContentFingerprint: fingerprint,
  canonicalTemplateContent: z.object({ notation: nonemptyString, operationalComponents: operationalComponentsSchema }).strict(),
  notation: nonemptyString, lifecycleStatus: z.literal("ACTIVE"), eligibilityStatus: z.literal("ELIGIBLE"),
  eligibleEventGroups: z.array(z.enum(PLAN_EVENT_GROUPS)).min(1), eventScopeEvidence: evidenceSchema,
  eligibleExperienceBands: z.array(z.enum(EXPERIENCE_BANDS)).min(1), experienceScopeEvidence: evidenceSchema,
  populationApplicability: z.object({ scope: z.enum(POPULATION_SCOPES) }).strict(),
  sportsScienceEvidence: sportsScienceEvidenceSchema, populationApplicabilityEvidence: populationEvidenceSchema,
  componentRefs: z.array(componentSchema).length(4), sourceDecisionId: nonemptyString, sourceEvidenceRef: nonemptyString,
  approvalDecisionId: nonemptyString, decidedAt: isoInstant, expiresAt: isoInstant, revokedAt: isoInstant.nullable(),
  ownerDecision: ownerDecisionSchema,
}).strict()
const manifestSchema = z.object({ schemaVersion: z.literal(1), trustedReviewerAuthorities: z.array(authoritySchema), approvals: z.array(approvalSchema) }).strict()

export function canonicalizeDetailedPrescriptionTemplateContent(content: DetailedPrescriptionTemplateContent): string {
  return JSON.stringify(content)
}

function ownerAuthorityMatches(record: DetailedPrescriptionApprovalRecord, authorities: readonly TrustedReviewerAuthority[]): boolean {
  return authorities.some((authority) => authority.reviewerId === record.ownerDecision.reviewerId
    && authority.role === record.ownerDecision.role
    && authority.authorityDecisionId === record.ownerDecision.authorityDecisionId
    && authority.authorityEvidenceRef === record.ownerDecision.authorityEvidenceRef
    && authority.authorityEvidenceFingerprint === record.ownerDecision.authorityEvidenceFingerprint)
}

function freezeApproval(record: DetailedPrescriptionApprovalRecord): DetailedPrescriptionApprovalRecord {
  const components = record.canonicalTemplateContent.operationalComponents
  return Object.freeze({ ...record,
    canonicalTemplateContent: Object.freeze({ notation: record.canonicalTemplateContent.notation, operationalComponents: Object.freeze({
      warmup: Object.freeze({ ...components.warmup, strides: Object.freeze({ ...components.warmup.strides }) }),
      cooldown: Object.freeze({ ...components.cooldown }), fallback: Object.freeze({ ...components.fallback }),
      stopConditions: Object.freeze({ ...components.stopConditions, codes: Object.freeze([...components.stopConditions.codes]) }),
    }) }),
    eligibleEventGroups: Object.freeze([...record.eligibleEventGroups]), eventScopeEvidence: Object.freeze({ ...record.eventScopeEvidence }),
    eligibleExperienceBands: Object.freeze([...record.eligibleExperienceBands]), experienceScopeEvidence: Object.freeze({ ...record.experienceScopeEvidence }),
    populationApplicability: Object.freeze({ ...record.populationApplicability }),
    sportsScienceEvidence: Object.freeze({ ...record.sportsScienceEvidence, sourceRefs: Object.freeze([...record.sportsScienceEvidence.sourceRefs]), canonicalEvidence: Object.freeze({ ...record.sportsScienceEvidence.canonicalEvidence, sourceSupports: Object.freeze([...record.sportsScienceEvidence.canonicalEvidence.sourceSupports]), sourceDoesNotPrescribe: Object.freeze([...record.sportsScienceEvidence.canonicalEvidence.sourceDoesNotPrescribe]) }) }),
    populationApplicabilityEvidence: Object.freeze({ ...record.populationApplicabilityEvidence, sourceRefs: Object.freeze([...record.populationApplicabilityEvidence.sourceRefs]), canonicalEvidence: Object.freeze({ ...record.populationApplicabilityEvidence.canonicalEvidence, sameEligibilityCriteria: Object.freeze(["FIVE_K", "EXPERIENCED", "CURRENT_SAME_EVENT_ANCHOR"] as const) }) }),
    componentRefs: Object.freeze(record.componentRefs.map((component) => Object.freeze({ ...component }))), ownerDecision: Object.freeze({ ...record.ownerDecision }),
  })
}

export function parseDetailedPrescriptionManifest(value: unknown): DetailedPrescriptionManifest | undefined {
  const parsed = manifestSchema.safeParse(value)
  if (!parsed.success) return undefined
  const authorities = Object.freeze(parsed.data.trustedReviewerAuthorities.map((authority) => Object.freeze({ ...authority, authorityEvidenceCanonical: Object.freeze({ ...authority.authorityEvidenceCanonical }) })))
  const approvals = Object.freeze(parsed.data.approvals.map(freezeApproval))
  if (!approvals.every((approval) => ownerAuthorityMatches(approval, authorities))) return undefined
  if (new Set(approvals.map((approval) => `${approval.templateId}\u0000${approval.templateVersion}`)).size !== approvals.length) return undefined
  return Object.freeze({ schemaVersion: 1, trustedReviewerAuthorities: authorities, approvals })
}

const EMPTY_MANIFEST: DetailedPrescriptionManifest = Object.freeze({ schemaVersion: 1, trustedReviewerAuthorities: Object.freeze([]), approvals: Object.freeze([]) })
const COMPILED_MANIFEST = parseDetailedPrescriptionManifest(manifestSource) ?? EMPTY_MANIFEST
export const TRUSTED_REVIEWER_AUTHORITIES = COMPILED_MANIFEST.trustedReviewerAuthorities
export const DETAILED_PRESCRIPTION_APPROVALS = COMPILED_MANIFEST.approvals

function componentsMatch(actual: readonly DetailedPrescriptionComponentRef[], expected: readonly DetailedPrescriptionComponentRef[]): boolean {
  const key = (component: DetailedPrescriptionComponentRef) => `${component.componentType}\u0000${component.componentRef}\u0000${component.componentVersion}\u0000${component.componentFingerprint}`
  return actual.length === 4 && actual.length === expected.length && actual.every((component) => expected.some((candidate) => key(candidate) === key(component)))
}

export function isDetailedPrescriptionApprovalApplicable(value: unknown, request: DetailedPrescriptionApprovalRequest, manifest: DetailedPrescriptionManifest): boolean {
  const parsed = approvalSchema.safeParse(value)
  if (!parsed.success) return false
  const record = parsed.data
  const trustedRecord = manifest.approvals.find((approval) => approval.templateId === record.templateId && approval.templateVersion === record.templateVersion)
  return trustedRecord !== undefined && JSON.stringify(record) === JSON.stringify(trustedRecord)
    && ownerAuthorityMatches(record, manifest.trustedReviewerAuthorities)
    && record.templateId === request.templateId && record.templateVersion === request.templateVersion
    && record.templateContentFingerprint === request.templateContentFingerprint
    && record.notation === record.canonicalTemplateContent.notation
    && record.eligibleEventGroups.includes(request.athleteEventGroup)
    && record.eventScopeEvidence.evidenceFingerprint === request.eventScopeEvidenceFingerprint
    && record.eligibleExperienceBands.includes(request.athleteExperienceBand)
    && record.experienceScopeEvidence.evidenceFingerprint === request.experienceScopeEvidenceFingerprint
    && record.sportsScienceEvidence.canonicalEvidenceFingerprint === request.sportsScienceEvidenceFingerprint
    && record.populationApplicability.scope === request.populationApplicability
    && record.populationApplicabilityEvidence.canonicalEvidenceFingerprint === request.populationEvidenceFingerprint
    && componentsMatch(record.componentRefs, request.componentRefs)
    && Date.parse(record.decidedAt) <= Date.parse(request.evaluatedAt) && Date.parse(request.evaluatedAt) < Date.parse(record.expiresAt)
    && Date.parse(record.decidedAt) < Date.parse(record.expiresAt) && record.revokedAt === null
}

export function resolveDetailedPrescriptionApproval(request: DetailedPrescriptionApprovalRequest): DetailedPrescriptionApprovalRecord | undefined {
  const candidate = DETAILED_PRESCRIPTION_APPROVALS.find((approval) => approval.templateId === request.templateId && approval.templateVersion === request.templateVersion)
  return candidate !== undefined && isDetailedPrescriptionApprovalApplicable(candidate, request, COMPILED_MANIFEST) ? candidate : undefined
}
