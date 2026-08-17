import { z } from "zod"
import {
  EXPERIENCE_BANDS,
  PLAN_EVENT_GROUPS,
  type ExperienceBand,
  type PlanEventGroup,
} from "@impl/plan-generator/types"
import manifestSource from "./detailed-prescription-manifest.json"

const REVIEWER_ROLES = ["OWNER", "COACH", "SPORTS_SCIENCE", "POPULATION_APPLICABILITY"] as const
const COMPONENT_TYPES = ["WARMUP", "COOLDOWN", "DOWNSHIFT", "STOP_CONDITIONS"] as const
const POPULATION_SCOPES = ["YOUTH_AND_ADULT", "ADULT_ONLY"] as const
const FINGERPRINT_PATTERN = /^sha256:[a-f0-9]{64}$/

type ReviewerRole = (typeof REVIEWER_ROLES)[number]
type ComponentType = (typeof COMPONENT_TYPES)[number]
export type PopulationApplicabilityScope = (typeof POPULATION_SCOPES)[number]

type EvidenceBinding = {
  readonly decisionId: string
  readonly evidenceRef: string
  readonly evidenceFingerprint: string
}

export type TrustedReviewerAuthority = {
  readonly reviewerId: string
  readonly role: ReviewerRole
  readonly qualificationAuthorityRef: string
  readonly qualificationDecisionId: string
  readonly qualificationEvidenceRef: string
  readonly qualificationEvidenceFingerprint: string
}

export type DetailedPrescriptionReviewerApproval<Role extends ReviewerRole = ReviewerRole> =
  TrustedReviewerAuthority & {
    readonly role: Role
    readonly reviewerName: string
    readonly evidenceRef: string
    readonly evidenceFingerprint: string
    readonly decision: "APPROVED"
  }

type DetailedPrescriptionReviews = {
  readonly [Role in ReviewerRole]: DetailedPrescriptionReviewerApproval<Role>
}

export type DetailedPrescriptionComponentRef = {
  readonly componentType: ComponentType
  readonly componentRef: string
  readonly componentVersion: string
  readonly componentFingerprint: string
}

export type DetailedPrescriptionTemplateContent = { readonly notation: string }

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
  readonly populationApplicability: EvidenceBinding & { readonly scope: PopulationApplicabilityScope }
  readonly componentRefs: readonly DetailedPrescriptionComponentRef[]
  readonly sourceDecisionId: string
  readonly sourceEvidenceRef: string
  readonly approvalDecisionId: string
  readonly decidedAt: string
  readonly expiresAt: string
  readonly revokedAt: string | null
  readonly reviews: DetailedPrescriptionReviews
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
  readonly populationApplicability: PopulationApplicabilityScope
  readonly populationEvidenceFingerprint: string
  readonly componentRefs: readonly DetailedPrescriptionComponentRef[]
  readonly evaluatedAt: string
}

function isIsoInstant(value: string): boolean {
  const milliseconds = Date.parse(value)
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value
}

const nonemptyString = z.string().refine((value) => value.trim().length > 0)
const fingerprint = z.string().regex(FINGERPRINT_PATTERN)
const isoInstant = z.string().refine(isIsoInstant)
const evidenceSchema = z.object({
  decisionId: nonemptyString,
  evidenceRef: nonemptyString,
  evidenceFingerprint: fingerprint,
}).strict()
const authoritySchema = z.object({
  reviewerId: nonemptyString,
  role: z.enum(REVIEWER_ROLES),
  qualificationAuthorityRef: nonemptyString,
  qualificationDecisionId: nonemptyString,
  qualificationEvidenceRef: nonemptyString,
  qualificationEvidenceFingerprint: fingerprint,
}).strict()
const reviewerSchema = <Role extends ReviewerRole>(role: Role) => authoritySchema.extend({
  role: z.literal(role),
  reviewerName: nonemptyString,
  evidenceRef: nonemptyString,
  evidenceFingerprint: fingerprint,
  decision: z.literal("APPROVED"),
}).strict()
const componentSchema = z.object({
  componentType: z.enum(COMPONENT_TYPES),
  componentRef: nonemptyString,
  componentVersion: nonemptyString,
  componentFingerprint: fingerprint,
}).strict()
const approvalSchema = z.object({
  manifestVersion: z.literal("1"),
  templateId: nonemptyString,
  templateVersion: nonemptyString,
  templateContentFingerprint: fingerprint,
  canonicalTemplateContent: z.object({ notation: nonemptyString }).strict(),
  notation: nonemptyString,
  lifecycleStatus: z.literal("ACTIVE"),
  eligibilityStatus: z.literal("ELIGIBLE"),
  eligibleEventGroups: z.array(z.enum(PLAN_EVENT_GROUPS)).min(1),
  eventScopeEvidence: evidenceSchema,
  eligibleExperienceBands: z.array(z.enum(EXPERIENCE_BANDS)).min(1),
  experienceScopeEvidence: evidenceSchema,
  populationApplicability: evidenceSchema.extend({ scope: z.enum(POPULATION_SCOPES) }).strict(),
  componentRefs: z.array(componentSchema).min(1),
  sourceDecisionId: nonemptyString,
  sourceEvidenceRef: nonemptyString,
  approvalDecisionId: nonemptyString,
  decidedAt: isoInstant,
  expiresAt: isoInstant,
  revokedAt: isoInstant.nullable(),
  reviews: z.object({
    OWNER: reviewerSchema("OWNER"),
    COACH: reviewerSchema("COACH"),
    SPORTS_SCIENCE: reviewerSchema("SPORTS_SCIENCE"),
    POPULATION_APPLICABILITY: reviewerSchema("POPULATION_APPLICABILITY"),
  }).strict(),
}).strict()
const manifestSchema = z.object({
  schemaVersion: z.literal(1),
  trustedReviewerAuthorities: z.array(authoritySchema),
  approvals: z.array(approvalSchema),
}).strict()

export function canonicalizeDetailedPrescriptionTemplateContent(
  content: DetailedPrescriptionTemplateContent,
): string {
  return JSON.stringify({ notation: content.notation.normalize("NFC") })
}

function reviewerAuthoritiesMatch(
  record: DetailedPrescriptionApprovalRecord,
  authorities: readonly TrustedReviewerAuthority[],
): boolean {
  const reviews = REVIEWER_ROLES.map((role) => record.reviews[role])
  if (new Set(reviews.map((review) => review.reviewerId)).size !== REVIEWER_ROLES.length) return false
  return reviews.every((review) => authorities.some((authority) => (
    authority.reviewerId === review.reviewerId
    && authority.role === review.role
    && authority.qualificationAuthorityRef === review.qualificationAuthorityRef
    && authority.qualificationDecisionId === review.qualificationDecisionId
    && authority.qualificationEvidenceRef === review.qualificationEvidenceRef
    && authority.qualificationEvidenceFingerprint === review.qualificationEvidenceFingerprint
  )))
}

function freezeApproval(record: DetailedPrescriptionApprovalRecord): DetailedPrescriptionApprovalRecord {
  const freezeReview = <Role extends ReviewerRole>(review: DetailedPrescriptionReviewerApproval<Role>) => Object.freeze({ ...review })
  return Object.freeze({
    ...record,
    canonicalTemplateContent: Object.freeze({ ...record.canonicalTemplateContent }),
    eligibleEventGroups: Object.freeze([...record.eligibleEventGroups]),
    eventScopeEvidence: Object.freeze({ ...record.eventScopeEvidence }),
    eligibleExperienceBands: Object.freeze([...record.eligibleExperienceBands]),
    experienceScopeEvidence: Object.freeze({ ...record.experienceScopeEvidence }),
    populationApplicability: Object.freeze({ ...record.populationApplicability }),
    componentRefs: Object.freeze(record.componentRefs.map((component) => Object.freeze({ ...component }))),
    reviews: Object.freeze({
      OWNER: freezeReview(record.reviews.OWNER),
      COACH: freezeReview(record.reviews.COACH),
      SPORTS_SCIENCE: freezeReview(record.reviews.SPORTS_SCIENCE),
      POPULATION_APPLICABILITY: freezeReview(record.reviews.POPULATION_APPLICABILITY),
    }),
  })
}

export function parseDetailedPrescriptionManifest(value: unknown): DetailedPrescriptionManifest | undefined {
  const parsed = manifestSchema.safeParse(value)
  if (!parsed.success) return undefined
  const authorities = Object.freeze(parsed.data.trustedReviewerAuthorities.map((authority) => Object.freeze({ ...authority })))
  const approvals = Object.freeze(parsed.data.approvals.map(freezeApproval))
  if (new Set(authorities.map((authority) => `${authority.role}\u0000${authority.reviewerId}`)).size !== authorities.length) return undefined
  if (!approvals.every((approval) => reviewerAuthoritiesMatch(approval, authorities))) return undefined
  if (new Set(approvals.map((approval) => `${approval.templateId}\u0000${approval.templateVersion}`)).size !== approvals.length) return undefined
  return Object.freeze({ schemaVersion: 1, trustedReviewerAuthorities: authorities, approvals })
}

const EMPTY_MANIFEST: DetailedPrescriptionManifest = Object.freeze({
  schemaVersion: 1,
  trustedReviewerAuthorities: Object.freeze([]),
  approvals: Object.freeze([]),
})
const COMPILED_MANIFEST = parseDetailedPrescriptionManifest(manifestSource) ?? EMPTY_MANIFEST

export const TRUSTED_REVIEWER_AUTHORITIES = COMPILED_MANIFEST.trustedReviewerAuthorities
export const DETAILED_PRESCRIPTION_APPROVALS = COMPILED_MANIFEST.approvals

function componentsMatch(actual: readonly DetailedPrescriptionComponentRef[], expected: readonly DetailedPrescriptionComponentRef[]): boolean {
  const key = (component: DetailedPrescriptionComponentRef) => `${component.componentType}\u0000${component.componentRef}\u0000${component.componentVersion}\u0000${component.componentFingerprint}`
  return actual.length > 0
    && actual.length === expected.length
    && actual.every((component) => expected.some((candidate) => key(candidate) === key(component)))
    && expected.every((component) => actual.some((candidate) => key(candidate) === key(component)))
}

export function isDetailedPrescriptionApprovalApplicable(
  value: unknown,
  request: DetailedPrescriptionApprovalRequest,
  manifest: DetailedPrescriptionManifest,
): boolean {
  const parsed = approvalSchema.safeParse(value)
  if (!parsed.success) return false
  const record = parsed.data
  const trustedRecord = manifest.approvals.find((approval) => (
    approval.templateId === record.templateId && approval.templateVersion === record.templateVersion
  ))
  return trustedRecord !== undefined
    && JSON.stringify(record) === JSON.stringify(trustedRecord)
    && reviewerAuthoritiesMatch(record, manifest.trustedReviewerAuthorities)
    && record.templateId === request.templateId
    && record.templateVersion === request.templateVersion
    && record.templateContentFingerprint === request.templateContentFingerprint
    && record.canonicalTemplateContent.notation === record.notation
    && record.canonicalTemplateContent.notation === record.notation.normalize("NFC")
    && record.eligibleEventGroups.includes(request.athleteEventGroup)
    && record.eventScopeEvidence.evidenceFingerprint === request.eventScopeEvidenceFingerprint
    && record.eligibleExperienceBands.includes(request.athleteExperienceBand)
    && record.experienceScopeEvidence.evidenceFingerprint === request.experienceScopeEvidenceFingerprint
    && record.populationApplicability.scope === request.populationApplicability
    && record.populationApplicability.evidenceFingerprint === request.populationEvidenceFingerprint
    && componentsMatch(record.componentRefs, request.componentRefs)
    && Date.parse(record.decidedAt) <= Date.parse(request.evaluatedAt)
    && Date.parse(request.evaluatedAt) < Date.parse(record.expiresAt)
    && Date.parse(record.decidedAt) < Date.parse(record.expiresAt)
    && record.revokedAt === null
}

export function resolveDetailedPrescriptionApproval(
  request: DetailedPrescriptionApprovalRequest,
): DetailedPrescriptionApprovalRecord | undefined {
  const candidate = DETAILED_PRESCRIPTION_APPROVALS.find((approval) => (
    approval.templateId === request.templateId && approval.templateVersion === request.templateVersion
  ))
  return candidate !== undefined
    && isDetailedPrescriptionApprovalApplicable(candidate, request, COMPILED_MANIFEST)
    ? candidate
    : undefined
}
