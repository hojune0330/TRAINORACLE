import { createHash } from "node:crypto"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DETAILED_PRESCRIPTION_APPROVALS } from "./detailed-prescription-approvals"
import {
  ACTIVE_DELEGATED_DETAILED_TEMPLATE_COUNT,
  delegatedDetailedPrescriptionAuthorityMatches,
  parseDelegatedDetailedPrescriptionAuthority,
  resolveDetailedPrescriptionRuntimeAuthority,
} from "./detailed-prescription-runtime-authority"
import { generatePlanFromDraft } from "./plan-beta-flow"

const TODAY = new Date("2026-08-23T03:00:00.000Z")
const DIMENSION_DOMAIN = "trainoracle.delegated-detailed-prescription-review-dimension.v1"

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`
  if (typeof value !== "object") throw new TypeError("Test evidence must be JSON data")
  const record = value as Readonly<Record<string, unknown>>
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`
}

function fingerprint(domain: string, value: unknown): string {
  return `sha256:${createHash("sha256").update(`${domain}\0${canonicalJson(value)}`).digest("hex")}`
}

const NOTATION = "10×200m @800m RP · r60″ STAND"
const REVIEWED_FINGERPRINT = fingerprint("trainoracle.test.reviewed-template.v1", { notation: NOTATION })
const TEMPLATE_REF = {
  templateId: "REVIEWED-800-02",
  version: "1.0.0",
  fingerprint: REVIEWED_FINGERPRINT,
} as const
const SOURCE_DIGESTS = Object.freeze([
  fingerprint("trainoracle.test.source.v1", { sourceId: "SOURCE-A" }),
  fingerprint("trainoracle.test.source.v1", { sourceId: "SOURCE-B" }),
])
const REVIEW_LIMITS = Object.freeze([
  "EXPERIENCED_ONLY",
  "CURRENT_SAME_EVENT_ANCHOR_ONLY",
  "NO_CROSS_EVENT_CONVERSION",
  "NO_AUTOMATIC_PROGRESSION",
  "SOURCE_SCOPE_ONLY",
] as const)
const YOUTH_LIMITS = Object.freeze([
  "NO_YOUTH_MULTIPLIER", "CURRENT_SAME_EVENT_ANCHOR_ONLY", "SOURCE_SCOPE_ONLY",
] as const)
const FEMALE_SEX_LIMITS = Object.freeze([
  "NO_SEX_MULTIPLIER", "CURRENT_SAME_EVENT_ANCHOR_ONLY", "SOURCE_SCOPE_ONLY",
] as const)

type ReceiptIdentity = {
  readonly lane: "COACHING_APPLICABILITY" | "SPORTS_SCIENCE_TRANSFER"
  readonly reviewerId: string
}

function reviewedDimension<const Value>(input: {
  readonly identity: ReceiptIdentity
  readonly key: string
  readonly value: Value
  readonly limits: readonly string[]
}) {
  const decision = { status: "APPROVED" as const, limits: input.limits, value: input.value }
  return {
    ...decision,
    evidenceFingerprint: fingerprint(DIMENSION_DOMAIN, {
      schemaVersion: 1,
      reviewerId: input.identity.reviewerId,
      lane: input.identity.lane,
      templateId: TEMPLATE_REF.templateId,
      templateVersion: TEMPLATE_REF.version,
      templateContentDigest: TEMPLATE_REF.fingerprint,
      sourceDigests: SOURCE_DIGESTS,
      targetEventDistanceM: 800,
      compatibleIntent: "GLY_INTENT",
      dimension: input.key,
      status: decision.status,
      limits: decision.limits,
      decision: decision.value,
    }),
  }
}

function createReviewDimensions(identity: ReceiptIdentity) {
  return {
    phase: reviewedDimension({ identity, key: "phase", value: "EVENT_SPECIFIC_PREPARATION", limits: REVIEW_LIMITS }),
    population: reviewedDimension({ identity, key: "population", value: "YOUTH_AND_ADULT", limits: REVIEW_LIMITS }),
    notation: reviewedDimension({ identity, key: "notation", value: NOTATION, limits: REVIEW_LIMITS }),
    totalArithmetic: reviewedDimension({
      identity, key: "totalArithmetic",
      value: { repetitionCount: 10, repetitionDistanceM: 200, totalQualityDistanceM: 2000 },
      limits: REVIEW_LIMITS,
    }),
    repetitionRecovery: reviewedDimension({
      identity, key: "repetitionRecovery", value: { durationSeconds: 60, mode: "STAND" }, limits: REVIEW_LIMITS,
    }),
    setRecovery: reviewedDimension({
      identity, key: "setRecovery", value: { kind: "NOT_APPLICABLE" }, limits: REVIEW_LIMITS,
    }),
    singletonIntent: reviewedDimension({ identity, key: "singletonIntent", value: "GLY_INTENT", limits: REVIEW_LIMITS }),
    sameEventPace: reviewedDimension({
      identity, key: "sameEventPace",
      value: { eventDistanceM: 800, anchor: "CURRENT_SAME_EVENT_ONLY" }, limits: REVIEW_LIMITS,
    }),
    contentSourceAuthority: reviewedDimension({
      identity, key: "contentSourceAuthority",
      value: { templateContentFingerprint: REVIEWED_FINGERPRINT, sourceDigests: SOURCE_DIGESTS }, limits: REVIEW_LIMITS,
    }),
    youthTransfer: reviewedDimension({ identity, key: "youthTransfer", value: "SUPPORTED", limits: YOUTH_LIMITS }),
    femaleSexTransfer: reviewedDimension({
      identity, key: "femaleSexTransfer", value: "SUPPORTED", limits: FEMALE_SEX_LIMITS,
    }),
  }
}

function createReceipt(identity: ReceiptIdentity) {
  const coaching = identity.lane === "COACHING_APPLICABILITY"
  return {
    schemaVersion: 1 as const,
    ...identity,
    reviewerQualification: {
      kind: coaching ? "QUALIFIED_RUNNING_COACH" as const : "QUALIFIED_SPORTS_SCIENCE_REVIEWER" as const,
      evidenceRef: coaching ? "qualification:running-coach:test" : "qualification:sports-science:test",
      evidenceFingerprint: fingerprint("trainoracle.test.reviewer-qualification.v1", identity),
    },
    independentFromExtractionAndImplementation: true as const,
    conflicts: "NONE_DECLARED" as const,
    owningAuthority: "TRAINING_SESSION_PRESCRIPTION_CONTRACT" as const,
    reviewScope: coaching
      ? "EVENT_AND_SESSION_COACHING_APPLICABILITY" as const
      : "POPULATION_AND_SPORTS_SCIENCE_TRANSFER" as const,
    reviewedArtifactDigest: REVIEWED_FINGERPRINT,
    sourceDigests: SOURCE_DIGESTS,
    selectedTemplateRef: TEMPLATE_REF,
    targetEventDistanceM: 800 as const,
    compatibleIntent: "GLY_INTENT" as const,
    reviewDimensions: createReviewDimensions(identity),
    verdict: "APPROVE" as const,
    verdictIsUnconditional: true as const,
    reviewedAt: "2026-08-23T00:00:00.000Z",
    expiresAt: "2026-09-23T00:00:00.000Z",
    revokedAt: null,
  }
}

const COACHING_RECEIPT = createReceipt({
  lane: "COACHING_APPLICABILITY",
  reviewerId: "01a00a34-088f-75a0-95d0-3b7813f38e8e",
})
const SCIENCE_RECEIPT = createReceipt({
  lane: "SPORTS_SCIENCE_TRANSFER",
  reviewerId: "01a00a34-0f37-7d43-bcc5-4b2c0cb3dd2e",
})
const VALID_DELEGATED_AUTHORITY = {
  schemaVersion: 1,
  kind: "DELEGATED_DUAL_REVIEW",
  lifecycleStatus: "ACTIVE",
  eligibilityStatus: "ELIGIBLE",
  selectedTemplateRef: TEMPLATE_REF,
  targetEventDistanceM: 800,
  compatibleIntent: "GLY_INTENT",
  coachingReceipt: COACHING_RECEIPT,
  sportsScienceReceipt: SCIENCE_RECEIPT,
} as const
const DELEGATED_REQUEST = {
  selectedTemplateRef: TEMPLATE_REF,
  targetEventDistanceM: 800,
  selectedEnergyIntent: "GLY_INTENT",
  evaluatedAt: TODAY.toISOString(),
} as const

describe("detailed prescription runtime authority", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(TODAY)
    window.localStorage.clear()
  })

  it("falls back both candidates when an explicit template fingerprint is stale", () => {
    const result = generatePlanFromDraft({
      eventGroup: "FIVE_K",
      eventDistanceM: 5000,
      competitionDivision: "OPEN",
      experienceBand: "EXPERIENCED",
      availableDayCount: 5,
      requestedFrameLength: 9,
      trainingFocus: "VO2_INTENT",
      secondSessionMode: "SINGLE_SESSION_ONLY",
      trainingTimePreference: "VARIES",
      selectedDetailedTemplateRef: {
        templateId: "V2-SEED-05",
        version: "1.0.0",
        fingerprint: `sha256:${"a".repeat(64)}`,
      },
    }, "NO_KNOWN_RISK")

    expect(result.kind).toBe("generated")
    if (result.kind !== "generated") return
    expect(result.prescriptionBinding).toEqual({
      kind: "fallback",
      code: "PACE_TARGET_FALLBACK_AUTHORITY_OR_COMPONENT",
    })
    expect(result.intake.selectedDetailedTemplateRef).toEqual({
      templateId: "V2-SEED-05",
      version: "1.0.0",
      fingerprint: `sha256:${"a".repeat(64)}`,
    })
    expect(result.generated.candidates).toHaveLength(2)
    expect(result.generated.candidates.every((candidate) => (
      candidate.selectedDetailedTemplateRef === null
      && candidate.sessions.every((session) => session.prescription.kind !== "PACE_TARGET")
    ))).toBe(true)
  })

  it("falls back both candidates when ATP-PC is paired with an approved baseline template", () => {
    const baseline = DETAILED_PRESCRIPTION_APPROVALS.find((approval) => (
      approval.templateId === "V2-SEED-05"
    ))
    if (baseline === undefined) throw new TypeError("5000m baseline authority fixture is missing")
    const result = generatePlanFromDraft({
      eventGroup: "FIVE_K",
      eventDistanceM: 5000,
      competitionDivision: "OPEN",
      experienceBand: "EXPERIENCED",
      availableDayCount: 5,
      requestedFrameLength: 9,
      trainingFocus: "ATP_PC_INTENT",
      secondSessionMode: "SINGLE_SESSION_ONLY",
      trainingTimePreference: "VARIES",
      selectedDetailedTemplateRef: {
        templateId: baseline.templateId,
        version: baseline.templateVersion,
        fingerprint: baseline.templateContentFingerprint,
      },
    }, "NO_KNOWN_RISK")

    expect(result.kind).toBe("generated")
    if (result.kind !== "generated") return
    expect(result.prescriptionBinding).toEqual({
      kind: "fallback",
      code: "PACE_TARGET_FALLBACK_AUTHORITY_OR_COMPONENT",
    })
    expect(result.intake.selectedDetailedTemplateRef).toEqual({
      templateId: baseline.templateId,
      version: baseline.templateVersion,
      fingerprint: baseline.templateContentFingerprint,
    })
    expect(result.generated.candidates.every((candidate) => (
      candidate.sessions.every((session) => session.prescription.kind !== "PACE_TARGET")
    ))).toBe(true)
  })

  it("retains exactly four baseline approvals and activates zero delegated additions", () => {
    expect(DETAILED_PRESCRIPTION_APPROVALS).toHaveLength(4)
    expect(ACTIVE_DELEGATED_DETAILED_TEMPLATE_COUNT).toBe(0)
    expect(DETAILED_PRESCRIPTION_APPROVALS.map((approval) => approval.templateId)).toEqual([
      "V2-SEED-05", "MD-800-01", "MD-1500-01", "MD-3000-01",
    ])
  })

  it("accepts a complete delegated authority record only at its pure review boundary", () => {
    expect(parseDelegatedDetailedPrescriptionAuthority(VALID_DELEGATED_AUTHORITY)).not.toBeNull()
    expect(delegatedDetailedPrescriptionAuthorityMatches(
      VALID_DELEGATED_AUTHORITY,
      DELEGATED_REQUEST,
    )).toBe(true)
    expect(resolveDetailedPrescriptionRuntimeAuthority(DELEGATED_REQUEST)).toEqual({
      kind: "fallback",
      code: "RUNTIME_AUTHORITY_UNAVAILABLE",
    })
  })

  it("rejects a delegated receipt that omits reviewer qualification evidence", () => {
    const coachingReceipt: Record<string, unknown> = { ...COACHING_RECEIPT }
    Reflect.deleteProperty(coachingReceipt, "reviewerQualification")
    expect(parseDelegatedDetailedPrescriptionAuthority({
      ...VALID_DELEGATED_AUTHORITY,
      coachingReceipt,
    })).toBeNull()
  })

  it("rejects a SHA-shaped youth transfer fingerprint that is not content-bound", () => {
    const forged = {
      ...VALID_DELEGATED_AUTHORITY,
      coachingReceipt: {
        ...COACHING_RECEIPT,
        reviewDimensions: {
          ...COACHING_RECEIPT.reviewDimensions,
          youthTransfer: {
            ...COACHING_RECEIPT.reviewDimensions.youthTransfer,
            evidenceFingerprint: `sha256:${"9".repeat(64)}`,
          },
        },
      },
    }

    expect(delegatedDetailedPrescriptionAuthorityMatches(forged, DELEGATED_REQUEST)).toBe(false)
  })

  it.each([
    ["template ID", { version: "1.0.0", fingerprint: REVIEWED_FINGERPRINT }],
    ["version", { templateId: "REVIEWED-800-02", fingerprint: REVIEWED_FINGERPRINT }],
    ["fingerprint", { templateId: "REVIEWED-800-02", version: "1.0.0" }],
  ])("keeps plan access when an explicit template ref is missing %s", (_name, partialRef) => {
    const result = generatePlanFromDraft({
      eventGroup: "MIDDLE_DISTANCE",
      eventDistanceM: 800,
      competitionDivision: "OPEN",
      experienceBand: "EXPERIENCED",
      availableDayCount: 5,
      requestedFrameLength: 9,
      trainingFocus: "GLY_INTENT",
      secondSessionMode: "SINGLE_SESSION_ONLY",
      trainingTimePreference: "VARIES",
      selectedDetailedTemplateRef: partialRef,
    }, "NO_KNOWN_RISK")

    expect(result).toMatchObject({
      kind: "generated",
      prescriptionBinding: {
        kind: "fallback",
        code: "PACE_TARGET_FALLBACK_INCOMPLETE_TEMPLATE_REF",
      },
      intake: { selectedDetailedTemplateRef: null },
    })
    if (result.kind !== "generated") return
    expect(result.generated.candidates).toHaveLength(2)
    expect(result.generated.candidates.every((candidate) => (
      candidate.selectedDetailedTemplateRef === null
      && candidate.sessions.every((session) => session.prescription.kind !== "PACE_TARGET")
    ))).toBe(true)
    expect(JSON.stringify(result)).not.toContain("REVIEWED-800-02")
  })

  it.each([
    ["coaching digest", {
      ...VALID_DELEGATED_AUTHORITY,
      coachingReceipt: { ...COACHING_RECEIPT, reviewedArtifactDigest: `sha256:${"5".repeat(64)}` },
    }],
    ["sports-science digest", {
      ...VALID_DELEGATED_AUTHORITY,
      sportsScienceReceipt: { ...SCIENCE_RECEIPT, reviewedArtifactDigest: `sha256:${"6".repeat(64)}` },
    }],
    ["reviewer independence", {
      ...VALID_DELEGATED_AUTHORITY,
      sportsScienceReceipt: { ...SCIENCE_RECEIPT, reviewerId: COACHING_RECEIPT.reviewerId },
    }],
    ["template identity", {
      ...VALID_DELEGATED_AUTHORITY,
      sportsScienceReceipt: {
        ...SCIENCE_RECEIPT,
        selectedTemplateRef: { ...TEMPLATE_REF, templateId: "OTHER-800-02" },
      },
    }],
    ["event", { ...VALID_DELEGATED_AUTHORITY, targetEventDistanceM: 1500 }],
    ["compatible intent", { ...VALID_DELEGATED_AUTHORITY, compatibleIntent: "VO2_INTENT" }],
    ["coaching youth transfer", {
      ...VALID_DELEGATED_AUTHORITY,
      coachingReceipt: {
        ...COACHING_RECEIPT,
        reviewDimensions: {
          ...COACHING_RECEIPT.reviewDimensions,
          youthTransfer: { ...COACHING_RECEIPT.reviewDimensions.youthTransfer, value: "UNKNOWN" },
        },
      },
    }],
    ["sports-science youth transfer", {
      ...VALID_DELEGATED_AUTHORITY,
      sportsScienceReceipt: {
        ...SCIENCE_RECEIPT,
        reviewDimensions: {
          ...SCIENCE_RECEIPT.reviewDimensions,
          youthTransfer: { ...SCIENCE_RECEIPT.reviewDimensions.youthTransfer, value: "UNSUPPORTED" },
        },
      },
    }],
    ["coaching female/sex transfer", {
      ...VALID_DELEGATED_AUTHORITY,
      coachingReceipt: {
        ...COACHING_RECEIPT,
        reviewDimensions: {
          ...COACHING_RECEIPT.reviewDimensions,
          femaleSexTransfer: { ...COACHING_RECEIPT.reviewDimensions.femaleSexTransfer, value: "UNSUPPORTED" },
        },
      },
    }],
    ["sports-science female/sex transfer", {
      ...VALID_DELEGATED_AUTHORITY,
      sportsScienceReceipt: {
        ...SCIENCE_RECEIPT,
        reviewDimensions: {
          ...SCIENCE_RECEIPT.reviewDimensions,
          femaleSexTransfer: { ...SCIENCE_RECEIPT.reviewDimensions.femaleSexTransfer, value: "UNKNOWN" },
        },
      },
    }],
    ["source digest set", {
      ...VALID_DELEGATED_AUTHORITY,
      sportsScienceReceipt: {
        ...SCIENCE_RECEIPT,
        sourceDigests: [fingerprint("trainoracle.test.source.v1", { sourceId: "OTHER" })],
      },
    }],
    ["review verdict", {
      ...VALID_DELEGATED_AUTHORITY,
      sportsScienceReceipt: { ...SCIENCE_RECEIPT, verdict: "DO_NOT_APPROVE" },
    }],
    ["reviewer qualification lane", {
      ...VALID_DELEGATED_AUTHORITY,
      coachingReceipt: {
        ...COACHING_RECEIPT,
        reviewerQualification: {
          ...COACHING_RECEIPT.reviewerQualification,
          kind: "QUALIFIED_SPORTS_SCIENCE_REVIEWER",
        },
      },
    }],
    ["unconditional verdict flag", {
      ...VALID_DELEGATED_AUTHORITY,
      sportsScienceReceipt: { ...SCIENCE_RECEIPT, verdictIsUnconditional: false },
    }],
    ["expiry", {
      ...VALID_DELEGATED_AUTHORITY,
      coachingReceipt: { ...COACHING_RECEIPT, expiresAt: TODAY.toISOString() },
    }],
    ["revocation", {
      ...VALID_DELEGATED_AUTHORITY,
      sportsScienceReceipt: { ...SCIENCE_RECEIPT, revokedAt: "2026-08-23T01:00:00.000Z" },
    }],
  ] as const)("rejects a changed %s", (_name, authority) => {
    expect(delegatedDetailedPrescriptionAuthorityMatches(authority, DELEGATED_REQUEST)).toBe(false)
  })

  it.each([
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
  ] as const)("rejects an arbitrary valid SHA for the %s decision", (key) => {
    const dimension = COACHING_RECEIPT.reviewDimensions[key]
    const authority = {
      ...VALID_DELEGATED_AUTHORITY,
      coachingReceipt: {
        ...COACHING_RECEIPT,
        reviewDimensions: {
          ...COACHING_RECEIPT.reviewDimensions,
          [key]: { ...dimension, evidenceFingerprint: `sha256:${"8".repeat(64)}` },
        },
      },
    }
    expect(delegatedDetailedPrescriptionAuthorityMatches(authority, DELEGATED_REQUEST)).toBe(false)
  })

  it("rejects matching receipts that disagree on structured evidence", () => {
    const changedNotation = reviewedDimension({
      identity: { lane: SCIENCE_RECEIPT.lane, reviewerId: SCIENCE_RECEIPT.reviewerId },
      key: "notation",
      value: "8×200m @800m RP · r60″ STAND",
      limits: REVIEW_LIMITS,
    })
    const authority = {
      ...VALID_DELEGATED_AUTHORITY,
      sportsScienceReceipt: {
        ...SCIENCE_RECEIPT,
        reviewDimensions: {
          ...SCIENCE_RECEIPT.reviewDimensions,
          notation: changedNotation,
        },
      },
    }
    expect(delegatedDetailedPrescriptionAuthorityMatches(authority, DELEGATED_REQUEST)).toBe(false)
  })

  it("rejects two fully re-fingerprinted receipts from the same reviewer", () => {
    const duplicateReviewerReceipt = createReceipt({
      lane: "SPORTS_SCIENCE_TRANSFER",
      reviewerId: COACHING_RECEIPT.reviewerId,
    })
    expect(delegatedDetailedPrescriptionAuthorityMatches({
      ...VALID_DELEGATED_AUTHORITY,
      sportsScienceReceipt: duplicateReviewerReceipt,
    }, DELEGATED_REQUEST)).toBe(false)
  })

  it("rejects unknown authority fields before review evaluation", () => {
    expect(parseDelegatedDetailedPrescriptionAuthority({
      ...VALID_DELEGATED_AUTHORITY,
      automaticActivation: true,
    })).toBeNull()
  })

  it.each([
    ["delegated lifecycle", { ...VALID_DELEGATED_AUTHORITY, lifecycleStatus: "REVIEW_REQUIRED" }],
    ["delegated eligibility", { ...VALID_DELEGATED_AUTHORITY, eligibilityStatus: "INELIGIBLE" }],
  ])("rejects an invalid %s state", (_name, authority) => {
    expect(parseDelegatedDetailedPrescriptionAuthority(authority)).toBeNull()
    expect(delegatedDetailedPrescriptionAuthorityMatches(authority, DELEGATED_REQUEST)).toBe(false)
  })

  it("authorizes each exact retained baseline identity and rejects stale scope", () => {
    for (const approval of DETAILED_PRESCRIPTION_APPROVALS) {
      const selectedEnergyIntent = approval.targetEventDistanceM === 800
        ? "GLY_INTENT"
        : approval.targetEventDistanceM === 1500
          ? "MIXED_INTENT"
          : "VO2_INTENT"
      const result = resolveDetailedPrescriptionRuntimeAuthority({
        selectedTemplateRef: {
          templateId: approval.templateId,
          version: approval.templateVersion,
          fingerprint: approval.templateContentFingerprint,
        },
        targetEventDistanceM: approval.targetEventDistanceM,
        selectedEnergyIntent,
        evaluatedAt: TODAY.toISOString(),
      })
      expect(result.kind).toBe("authorized")
    }

    const baseline = DETAILED_PRESCRIPTION_APPROVALS[0]
    if (baseline === undefined) throw new TypeError("Baseline authority fixture is missing")
    expect(resolveDetailedPrescriptionRuntimeAuthority({
      selectedTemplateRef: {
        templateId: baseline.templateId,
        version: baseline.templateVersion,
        fingerprint: baseline.templateContentFingerprint,
      },
      targetEventDistanceM: 800,
      selectedEnergyIntent: "VO2_INTENT",
      evaluatedAt: TODAY.toISOString(),
    }).kind).toBe("fallback")
    expect(resolveDetailedPrescriptionRuntimeAuthority({
      selectedTemplateRef: {
        templateId: baseline.templateId,
        version: baseline.templateVersion,
        fingerprint: baseline.templateContentFingerprint,
      },
      targetEventDistanceM: 5000,
      selectedEnergyIntent: "VO2_INTENT",
      evaluatedAt: baseline.expiresAt,
    }).kind).toBe("fallback")
    expect(resolveDetailedPrescriptionRuntimeAuthority({
      selectedTemplateRef: {
        templateId: baseline.templateId,
        version: baseline.templateVersion,
        fingerprint: baseline.templateContentFingerprint,
      },
      targetEventDistanceM: 5000,
      selectedEnergyIntent: "ATP_PC_INTENT",
      evaluatedAt: TODAY.toISOString(),
    }).kind).toBe("fallback")
  })
})
