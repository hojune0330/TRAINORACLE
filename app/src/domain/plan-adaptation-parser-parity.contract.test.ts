import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  canonicalJsonSha256,
  createPlanAdaptationProposal,
  verifyPlanAdaptationProposal,
} from "@impl/plan-generator/adaptation"
import { generatePlanCandidates } from "@impl/plan-generator/generator"
import type { PlanCandidate } from "@impl/plan-generator/types"
import {
  baseRequest,
  clearedGate,
  expectGenerated,
} from "../../../impl/test/fixtures/plan-beta-request"
import {
  planAdaptationProposalSchema,
  planAdaptationCandidateSchema,
  planBetaStateV2Schema,
} from "./plan-beta-schema"
import { generatePlanFromDraft } from "./plan-beta-flow"
import {
  RUNTIME_CASES,
  TODAY,
  draftFor,
  saveCurrentRecord,
} from "./prescription-quality-matrix.test-fixtures"
import {
  createSelfReportedAthleteRecord,
  saveAthleteRecord,
} from "./athlete-records"

type CandidateMutation = (candidate: PlanCandidate) => unknown

const candidateSchema = planAdaptationCandidateSchema

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(TODAY)
  window.localStorage.clear()
})

function appAcceptsCandidate(candidate: unknown): boolean {
  const parsed = candidateSchema.safeParse(candidate)
  if (!parsed.success || parsed.data.eventDistanceM === null) return false
  return planBetaStateV2Schema.safeParse({
    version: 2,
    intake: {
      eventGroup: parsed.data.eventGroup,
      competitionDivision: "OPEN",
      experienceBand: "EXPERIENCED",
      availableDayCount: 5,
      requestedFrameLength: 9.5,
      trainingFocus: parsed.data.selectedEnergyIntent,
      secondSessionMode: "RECOVERY_PM_ALLOWED",
      trainingTimePreference: "VARIES",
    },
    progress: [],
    generatedAt: "2026-08-01T00:00:00.000Z",
    adaptationScope: {
      athleteId: "athlete-1",
      eventDistanceM: parsed.data.eventDistanceM,
    },
    activePlan: {
      kind: "BETA_ACTIVE_PLAN_SNAPSHOT",
      activationState: "SELECTED_BETA_SNAPSHOT",
      candidateId: parsed.data.candidateId,
      candidateKind: parsed.data.kind,
      eventDistanceM: parsed.data.eventDistanceM,
      selectionActor: "SELF",
      sourceMode: parsed.data.sourceMode,
      selectedEnergyIntent: parsed.data.selectedEnergyIntent,
      frame: parsed.data.frame,
      sessions: parsed.data.sessions,
    },
  }).success
}

async function proposalFor(baseCandidate: unknown, proposedCandidate: unknown) {
  let baseContentHash = `sha256:${"0".repeat(64)}`
  try {
    baseContentHash = await canonicalJsonSha256(
      "trainoracle.plan-candidate.v1",
      baseCandidate,
    )
  } catch {
    // Malformed sparse values cannot have a canonical contract hash.
  }
  return createPlanAdaptationProposal({
    kind: "PLAN_ADAPTATION_PROPOSAL_REQUEST",
    scope: { athleteId: "athlete-1", eventDistanceM: 1500 },
    activePlanStartedAt: "2026-08-01T00:00:00.000Z",
    baseCandidate,
    proposedCandidate,
    baseContentHash,
    proposalOrigin: "SELF_SERVICE",
    trigger: {
      kind: "EXPLICIT_REQUEST",
      requestedBy: "ATHLETE",
      sourceRef: "athlete-request:athlete-1:req-9",
    },
    changeDimension: "VOLUME",
    safetyGate: clearedGate(),
    safetyEvaluatedAt: "2026-08-18T00:00:00.000Z",
    safetyValidUntil: "2026-08-18T00:10:00.000Z",
    activeHold: false,
    createdAt: "2026-08-18T00:05:00.000Z",
    idempotencyKey: `sha256:${"e".repeat(64)}`,
  })
}

function mutateFirstSessionDay(day: number): CandidateMutation {
  return (candidate) => ({
    ...candidate,
    sessions: candidate.sessions.map((session, index) => (
      index === 0 ? { ...session, day } : session
    )),
  })
}

function sparseSessions(candidate: PlanCandidate): unknown {
  return { ...candidate, sessions: sparseCopy(candidate.sessions) }
}

function sparseCopy<T>(values: readonly T[]): T[] {
  if (values.length === 0) throw new TypeError("Sparse mutation requires a value")
  const sparse = [...values]
  delete sparse[0]
  return sparse
}

function withEnumerableArrayProperty<T>(values: readonly T[]): T[] {
  const copy = [...values]
  Object.defineProperty(copy, "evidenceText", {
    value: "raw symptom: chest pain after training",
    enumerable: true,
  })
  return copy
}

function withOwnPayload<T extends object>(
  value: T,
  key: PropertyKey,
  enumerable: boolean,
): T {
  Object.defineProperty(value, key, {
    value: "raw symptom: chest pain after training",
    enumerable,
    configurable: true,
  })
  return value
}

function sparseRationaleCodes(candidate: PlanCandidate): unknown {
  return { ...candidate, rationaleCodes: sparseCopy(candidate.rationaleCodes) }
}

function sparseProgressStateCounts(candidate: PlanCandidate): unknown {
  return {
    ...candidate,
    continuityContext: {
      kind: "PREVIOUS_FRAME_CONTEXT_RETAINED",
      previousCandidateKind: "BALANCED",
      progressStateCounts: sparseCopy([{ state: "COMPLETED" as const, count: 1 }]),
    },
  }
}

function sparseCountedExposureIds(candidate: PlanCandidate): unknown {
  return {
    ...candidate,
    mainExposureLedger: {
      ...candidate.mainExposureLedger,
      countedExposureIds: sparseCopy(candidate.mainExposureLedger.countedExposureIds),
    },
  }
}

function duplicateSessionSlot(candidate: PlanCandidate): unknown {
  const first = candidate.sessions[0]
  if (first === undefined) throw new TypeError("Session fixture is empty")
  return {
    ...candidate,
    sessions: candidate.sessions.map((session, index) => (
      index === 1 ? { ...session, day: first.day, slot: first.slot } : session
    )),
  }
}

function emptyRationale(candidate: PlanCandidate): unknown {
  return { ...candidate, rationaleCodes: [""] }
}

function malformedRpe(candidate: PlanCandidate): unknown {
  return {
    ...candidate,
    sessions: candidate.sessions.map((session) => (
      session.prescription.kind === "RPE_TIME_RANGE"
        ? { ...session, prescription: { ...session.prescription, durationMinutes: { minimum: 20, maximum: "30" } } }
        : session
    )),
  }
}

function invalidQualityCompanion(candidate: PlanCandidate): unknown {
  const quality = candidate.sessions.find((session) => session.role === "QUALITY")
  const easy = candidate.sessions.find((session) => session.role === "EASY")
  if (quality === undefined || easy === undefined || easy.prescription.kind !== "RPE_TIME_RANGE") {
    throw new TypeError("Expected QUALITY and EASY fixture sessions")
  }
  return {
    ...candidate,
    sessions: candidate.sessions.map((session) => session === easy ? {
      ...session,
      day: quality.day,
      slot: quality.slot === "AM" ? "PM" as const : "AM" as const,
      prescription: {
        ...session.prescription,
        rpe: { minimum: 2, maximum: 4 },
      },
    } : session),
  }
}

function refreshPrescriptionFingerprint(prescription: Record<string, unknown>) {
  const { prescriptionFingerprint: _fingerprint, ...content } = prescription
  return {
    ...content,
    prescriptionFingerprint: `canonical-json-v1:${JSON.stringify(content)}`,
  }
}

function mutateDetailedPrescription(
  candidate: PlanCandidate,
  mutate: (prescription: Record<string, unknown>) => Record<string, unknown>,
): unknown {
  let nextFingerprint: string | null = null
  const sessions = candidate.sessions.map((session) => {
    if (session.prescription.kind !== "PACE_TARGET") return session
    const prescription = refreshPrescriptionFingerprint(mutate(session.prescription))
    nextFingerprint = prescription.prescriptionFingerprint
    return { ...session, prescription }
  })
  if (nextFingerprint === null || candidate.detailedPrescriptionFingerprint === null) {
    throw new TypeError("Detailed prescription mutation target is missing")
  }
  const marker = ":pace-target:"
  const baseId = candidate.candidateId.slice(0, candidate.candidateId.indexOf(marker))
  return {
    ...candidate,
    candidateId: `${baseId}${marker}${nextFingerprint}`,
    detailedPrescriptionFingerprint: nextFingerprint,
    sessions,
  }
}

function replaceNestedReference(
  prescription: Record<string, unknown>,
  container: string,
  key: string,
  value: string,
): Record<string, unknown> {
  const nested = prescription[container]
  if (typeof nested !== "object" || nested === null || Array.isArray(nested)) {
    throw new TypeError(`Detailed prescription ${container} target is missing`)
  }
  return { ...prescription, [container]: { ...nested, [key]: value } }
}

function replaceAnchorReference(
  prescription: Record<string, unknown>,
  value: string,
): Record<string, unknown> {
  const nested = prescription.selectedAnchor
  if (typeof nested !== "object" || nested === null || Array.isArray(nested)) {
    throw new TypeError("Detailed prescription anchor target is missing")
  }
  return {
    ...prescription,
    selectedAnchor: { ...nested, anchorId: value, sourceRef: `athlete-record:${value}` },
  }
}

function replaceAnchorField(
  prescription: Record<string, unknown>,
  key: string,
  value: string,
): Record<string, unknown> {
  return replaceNestedReference(prescription, "selectedAnchor", key, value)
}

type ValuePath = readonly (string | number)[]

function stringLeafPaths(value: unknown, path: ValuePath = []): ValuePath[] {
  if (typeof value === "string") return [path]
  if (Array.isArray(value)) return value.flatMap((item, index) => stringLeafPaths(item, [...path, index]))
  if (typeof value !== "object" || value === null) return []
  return Object.entries(value).flatMap(([key, item]) => stringLeafPaths(item, [...path, key]))
}

function replaceAtPath(value: unknown, path: ValuePath, replacement: string): unknown {
  const [head, ...tail] = path
  if (head === undefined) return replacement
  if (Array.isArray(value) && typeof head === "number") {
    return value.map((item, index) => index === head ? replaceAtPath(item, tail, replacement) : item)
  }
  if (typeof value === "object" && value !== null && !Array.isArray(value) && typeof head === "string") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => (
      key === head ? [key, replaceAtPath(item, tail, replacement)] : [key, item]
    )))
  }
  throw new TypeError("Detailed prescription string path is invalid")
}

describe("impl/app adaptation candidate parser parity", () => {
  it.each([
    ["Date", new Date("2026-08-18T00:00:00.000Z")],
    ["Map", new Map([["evidenceText", "raw symptom: chest pain after training"]])],
  ])("rejects unsupported %s candidates before normalization", (_label, candidate) => {
    expect(candidateSchema.safeParse(candidate).success).toBe(false)
  })

  it.each([
    ["proposal symbol", (proposal: object) => {
      Object.defineProperty(proposal, Symbol("evidenceText"), {
        value: "raw symptom: chest pain after training",
        enumerable: true,
      })
      return proposal
    }],
    ["proposal hidden property", (proposal: object) => {
      Object.defineProperty(proposal, "evidenceText", {
        value: "raw symptom: chest pain after training",
        enumerable: false,
      })
      return proposal
    }],
    ["proposal accessor", (proposal: object) => {
      Object.defineProperty(proposal, "targetFrame", {
        get: () => "NEXT_FRAME",
        enumerable: true,
        configurable: true,
      })
      return proposal
    }],
    ["proposal custom prototype", (proposal: object) => (
      Object.setPrototypeOf(proposal, { evidenceText: "raw symptom: chest pain after training" })
    )],
    ["proposal hidden cycle", (proposal: object) => {
      Object.defineProperty(proposal, "self", { value: proposal, enumerable: false })
      return proposal
    }],
  ] as const)("rejects non-canonical %s before app parsing or impl verification", async (_label, mutate) => {
    const generated = expectGenerated(generatePlanCandidates(baseRequest()))
    const [baseCandidate, proposedCandidate] = generated.candidates
    const result = await proposalFor(baseCandidate, proposedCandidate)
    if (result.kind !== "proposed") throw new TypeError("Expected proposal fixture")
    const proposal = mutate({ ...result.proposal })

    expect(planAdaptationProposalSchema.safeParse(proposal).success).toBe(false)
    expect(await verifyPlanAdaptationProposal(proposal)).toBe(false)
  })

  it.each([
    ["enumerable symbol", (candidate: PlanCandidate) => withOwnPayload({ ...candidate }, Symbol("evidenceText"), true)],
    ["non-enumerable symbol", (candidate: PlanCandidate) => withOwnPayload({ ...candidate }, Symbol("evidenceText"), false)],
    ["non-enumerable string", (candidate: PlanCandidate) => withOwnPayload({ ...candidate }, "evidenceText", false)],
    ["accessor", (candidate: PlanCandidate) => {
      const copy = { ...candidate }
      Object.defineProperty(copy, "kind", { get: () => candidate.kind, enumerable: true, configurable: true })
      return copy
    }],
    ["custom prototype", (candidate: PlanCandidate) => Object.setPrototypeOf({ ...candidate }, { evidenceText: "raw symptom: chest pain after training" })],
    ["hidden cycle", (candidate: PlanCandidate) => {
      const copy = { ...candidate }
      Object.defineProperty(copy, "self", { value: copy, enumerable: false, configurable: true })
      return copy
    }],
    ["session symbol", (candidate: PlanCandidate) => {
      const first = candidate.sessions[0]
      if (first === undefined) throw new TypeError("Expected a candidate session")
      return {
        ...candidate,
        sessions: [withOwnPayload({ ...first }, Symbol("evidenceText"), true), ...candidate.sessions.slice(1)],
      }
    }],
  ] as const)("rejects non-canonical candidate %s at both boundaries", async (_label, mutate) => {
    const generated = expectGenerated(generatePlanCandidates(baseRequest()))
    const [baseCandidate, proposedCandidate] = generated.candidates
    const malformedBase = mutate(baseCandidate)

    expect(appAcceptsCandidate(malformedBase)).toBe(false)
    expect(await proposalFor(malformedBase, proposedCandidate))
      .toEqual({ kind: "rejected", code: "MALFORMED_INPUT" })
  })

  it("accepts the generated same-event detailed candidate at both boundaries", async () => {
    const fixture = RUNTIME_CASES[1]
    const selectedRecordId = saveCurrentRecord(fixture.eventDistanceM, fixture.performanceSeconds)
    const generated = generatePlanFromDraft(draftFor(fixture), "NO_KNOWN_RISK", { selectedRecordId })
    if (generated.kind !== "generated") throw new TypeError("Detailed fixture did not generate")
    const [baseCandidate, proposedCandidate] = generated.generated.candidates

    expect(appAcceptsCandidate(baseCandidate)).toBe(true)
    expect(await proposalFor(baseCandidate, proposedCandidate)).toMatchObject({ kind: "proposed" })
  })

  it("rejects a rehashed RPE-only candidate with a raw detailed fingerprint suffix at both boundaries", async () => {
    const generated = expectGenerated(generatePlanCandidates(baseRequest()))
    const [baseCandidate, proposedCandidate] = generated.candidates
    const rawFingerprint = "raw-symptom-chest-pain-after-training-1"
    const attachFingerprint = (candidate: PlanCandidate) => ({
      ...candidate,
      candidateId: `${candidate.candidateId}:pace-target:${rawFingerprint}`,
      detailedPrescriptionFingerprint: rawFingerprint,
    })
    const malformedBase = attachFingerprint(baseCandidate)
    const malformedProposed = attachFingerprint(proposedCandidate)

    expect(appAcceptsCandidate(malformedBase)).toBe(false)
    const result = await proposalFor(malformedBase, malformedProposed)
    expect(result).toEqual({ kind: "rejected", code: "MALFORMED_INPUT" })
    expect(JSON.stringify(result)).not.toContain(rawFingerprint)
  })

  it.each([
    ["day zero", mutateFirstSessionDay(0)],
    ["negative day", mutateFirstSessionDay(-1)],
    ["sparse sessions", sparseSessions],
    ["sparse rationale codes", sparseRationaleCodes],
    ["sparse retained progress counts", sparseProgressStateCounts],
    ["sparse counted exposure IDs", sparseCountedExposureIds],
    ["duplicate session identity", duplicateSessionSlot],
    ["empty rationale", emptyRationale],
    ["malformed RPE prescription", malformedRpe],
    ["out-of-range QUALITY companion", invalidQualityCompanion],
  ] as const)("never proposes an app-rejected %s candidate", async (_label, mutate) => {
    const generated = expectGenerated(generatePlanCandidates(baseRequest()))
    const [baseCandidate, proposedCandidate] = generated.candidates
    const malformedBase = mutate(baseCandidate)
    const malformedProposed = mutate(proposedCandidate)

    expect(appAcceptsCandidate(malformedBase)).toBe(false)
    expect(await proposalFor(malformedBase, malformedProposed))
      .not.toMatchObject({ kind: "proposed" })
  })

  it("rejects app-invalid nested PACE_TARGET identities, totals, and provenance", async () => {
    const fixture = RUNTIME_CASES[1]
    const selectedRecordId = saveCurrentRecord(
      fixture.eventDistanceM,
      fixture.performanceSeconds,
    )
    const generated = generatePlanFromDraft(
      draftFor(fixture),
      "NO_KNOWN_RISK",
      { selectedRecordId },
    )
    if (generated.kind !== "generated") throw new TypeError("Detailed fixture did not generate")
    const [baseCandidate, proposedCandidate] = generated.generated.candidates
    const mutations: readonly CandidateMutation[] = [
      (candidate) => ({
        ...candidate,
        sessions: candidate.sessions.map((session) => session.prescription.kind === "PACE_TARGET" ? {
          ...session,
          prescription: refreshPrescriptionFingerprint({
            ...session.prescription,
            totals: {
              ...session.prescription.totals,
              qualityDistanceM: session.prescription.totals.qualityDistanceM + 1,
            },
          }),
        } : session),
      }),
      (candidate) => ({
        ...candidate,
        sessions: candidate.sessions.map((session) => session.prescription.kind === "PACE_TARGET" ? {
          ...session,
          prescription: refreshPrescriptionFingerprint({
            ...session.prescription,
            componentRefs: session.prescription.componentRefs.map((ref, index, refs) => (
              index === 1 ? { ...ref, componentType: refs[0]?.componentType } : ref
            )),
          }),
        } : session),
      }),
      (candidate) => ({
        ...candidate,
        sessions: candidate.sessions.map((session) => session.prescription.kind === "PACE_TARGET" ? {
          ...session,
          prescription: refreshPrescriptionFingerprint({
            ...session.prescription,
            selectedAnchor: { ...session.prescription.selectedAnchor, sourceRef: "" },
          }),
        } : session),
      }),
      (candidate) => ({
        ...candidate,
        sessions: candidate.sessions.map((session) => session.prescription.kind === "PACE_TARGET" ? {
          ...session,
          prescription: { ...session.prescription, templateContentFingerprint: "not-a-sha256" },
        } : session),
      }),
      (candidate) => ({
        ...candidate,
        sessions: candidate.sessions.map((session) => session.prescription.kind === "PACE_TARGET" ? {
          ...session,
          prescription: refreshPrescriptionFingerprint({
            ...session.prescription,
            sourceEvidenceRef: "raw_symptom_chest_pain_after_training",
          }),
        } : session),
      }),
      (candidate) => ({
        ...candidate,
        sessions: candidate.sessions.map((session) => session.prescription.kind === "PACE_TARGET" ? {
          ...session,
          prescription: refreshPrescriptionFingerprint({
            ...session.prescription,
            selectedAnchor: {
              ...session.prescription.selectedAnchor,
              anchorId: "raw-symptom-chest-pain-after-training",
              sourceRef: "athlete-record:raw-symptom-chest-pain-after-training",
            },
          }),
        } : session),
      }),
    ]

    for (const mutate of mutations) {
      const malformedBase = mutate(baseCandidate)
      const malformedProposed = mutate(proposedCandidate)
      expect(appAcceptsCandidate(malformedBase)).toBe(false)
      expect(await proposalFor(malformedBase, malformedProposed))
        .not.toMatchObject({ kind: "proposed" })
    }
  })

  it.each([
    "raw-symptom-chest-pain-after-training",
    "private_note_after_run",
  ])("rejects consistently linked digit-bearing prose in exposure identities: %s", async (stem) => {
    const generated = expectGenerated(generatePlanCandidates(baseRequest()))
    const [baseCandidate, proposedCandidate] = generated.candidates
    const mutate = (candidate: PlanCandidate) => {
      const countedExposureIds = [`${stem}-1`, `${stem}-2`]
      return {
        ...candidate,
        candidateId: candidate.candidateId.replace(
          candidate.mainExposureLedger.countedExposureIds.join("-"),
          countedExposureIds.join("-"),
        ),
        mainExposureLedger: {
          ...candidate.mainExposureLedger,
          countedExposureIds,
          fingerprint: countedExposureIds.join(":"),
        },
      }
    }
    const malformedBase = mutate(baseCandidate)
    const malformedProposed = mutate(proposedCandidate)

    expect(appAcceptsCandidate(malformedBase)).toBe(false)
    expect(await proposalFor(malformedBase, malformedProposed))
      .not.toMatchObject({ kind: "proposed" })
  })

  it.each([
    ["manifest version", (prescription: Record<string, unknown>, value: string) => ({ ...prescription, manifestVersion: value })],
    ["template ID", (prescription: Record<string, unknown>, value: string) => ({ ...prescription, templateId: value })],
    ["template version", (prescription: Record<string, unknown>, value: string) => ({ ...prescription, templateVersion: value })],
    ["notation", (prescription: Record<string, unknown>, value: string) => ({ ...prescription, notation: value })],
    ["source decision", (prescription: Record<string, unknown>, value: string) => ({ ...prescription, sourceDecisionId: value })],
    ["source evidence", (prescription: Record<string, unknown>, value: string) => ({ ...prescription, sourceEvidenceRef: value })],
    ["approval decision", (prescription: Record<string, unknown>, value: string) => ({ ...prescription, approvalDecisionId: value })],
    ["owner authority decision", (prescription: Record<string, unknown>, value: string) => ({ ...prescription, ownerAuthorityDecisionId: value })],
    ["sports evidence ID", (prescription: Record<string, unknown>, value: string) => replaceNestedReference(prescription, "sportsScienceEvidence", "evidenceId", value)],
    ["sports decision ref", (prescription: Record<string, unknown>, value: string) => replaceNestedReference(prescription, "sportsScienceEvidence", "decisionRef", value)],
    ["population evidence ID", (prescription: Record<string, unknown>, value: string) => replaceNestedReference(prescription, "populationApplicabilityEvidence", "evidenceId", value)],
    ["population decision ref", (prescription: Record<string, unknown>, value: string) => replaceNestedReference(prescription, "populationApplicabilityEvidence", "decisionRef", value)],
    ["selected anchor", replaceAnchorReference],
    ["anchor achieved date", (prescription: Record<string, unknown>, value: string) => replaceAnchorField(prescription, "achievedAt", value)],
    ["anchor elapsed label", (prescription: Record<string, unknown>, value: string) => replaceAnchorField(prescription, "elapsedLabel", value)],
    ["display rounding policy", (prescription: Record<string, unknown>, value: string) => ({ ...prescription, displayRoundingPolicyVersion: value })],
  ] as const)("rejects re-fingerprinted digit-bearing prose in %s", async (_label, mutate) => {
    const fixture = RUNTIME_CASES[1]
    const selectedRecordId = saveCurrentRecord(fixture.eventDistanceM, fixture.performanceSeconds)
    const generated = generatePlanFromDraft(draftFor(fixture), "NO_KNOWN_RISK", { selectedRecordId })
    if (generated.kind !== "generated") throw new TypeError("Detailed fixture did not generate")
    const [baseCandidate, proposedCandidate] = generated.generated.candidates

    for (const value of [
      "raw-symptom-chest-pain-after-training-1",
      "private_note_after_run_1",
    ]) {
      const malformedBase = mutateDetailedPrescription(baseCandidate, (prescription) => mutate(prescription, value))
      const malformedProposed = mutateDetailedPrescription(proposedCandidate, (prescription) => mutate(prescription, value))
      expect(appAcceptsCandidate(malformedBase)).toBe(false)
      expect(await proposalFor(malformedBase, malformedProposed))
        .not.toMatchObject({ kind: "proposed" })
    }
  })

  it.each([
    ["template content fingerprint", (prescription: Record<string, unknown>, value: string) => ({ ...prescription, templateContentFingerprint: value })],
    ["sports evidence fingerprint", (prescription: Record<string, unknown>, value: string) => replaceNestedReference(prescription, "sportsScienceEvidence", "fingerprint", value)],
    ["population evidence fingerprint", (prescription: Record<string, unknown>, value: string) => replaceNestedReference(prescription, "populationApplicabilityEvidence", "fingerprint", value)],
    ["event scope fingerprint", (prescription: Record<string, unknown>, value: string) => replaceNestedReference(prescription, "scope", "eventEvidenceFingerprint", value)],
    ["experience scope fingerprint", (prescription: Record<string, unknown>, value: string) => replaceNestedReference(prescription, "scope", "experienceEvidenceFingerprint", value)],
  ] as const)("rejects a re-fingerprinted alternate valid hash in %s", async (_label, mutate) => {
    const fixture = RUNTIME_CASES[1]
    const selectedRecordId = saveCurrentRecord(fixture.eventDistanceM, fixture.performanceSeconds)
    const generated = generatePlanFromDraft(draftFor(fixture), "NO_KNOWN_RISK", { selectedRecordId })
    if (generated.kind !== "generated") throw new TypeError("Detailed fixture did not generate")
    const [baseCandidate, proposedCandidate] = generated.generated.candidates
    const value = `sha256:${"9".repeat(64)}`
    const malformedBase = mutateDetailedPrescription(baseCandidate, (prescription) => mutate(prescription, value))
    const malformedProposed = mutateDetailedPrescription(proposedCandidate, (prescription) => mutate(prescription, value))

    expect(appAcceptsCandidate(malformedBase)).toBe(false)
    expect(await proposalFor(malformedBase, malformedProposed))
      .not.toMatchObject({ kind: "proposed" })
  })

  it("rejects re-fingerprinted prose in every serialized detailed-prescription string leaf", async () => {
    const fixture = RUNTIME_CASES[1]
    const selectedRecordId = saveCurrentRecord(fixture.eventDistanceM, fixture.performanceSeconds)
    const generated = generatePlanFromDraft(draftFor(fixture), "NO_KNOWN_RISK", { selectedRecordId })
    if (generated.kind !== "generated") throw new TypeError("Detailed fixture did not generate")
    const [baseCandidate, proposedCandidate] = generated.generated.candidates
    const session = baseCandidate.sessions.find((item) => item.prescription.kind === "PACE_TARGET")
    if (session?.prescription.kind !== "PACE_TARGET") throw new TypeError("PACE_TARGET fixture is missing")
    const { prescriptionFingerprint: _fingerprint, ...content } = session.prescription
    const paths = stringLeafPaths(content)
    expect(paths.length).toBeGreaterThan(40)

    for (const path of paths) {
      for (const rawText of ["raw-symptom-chest-pain-after-training-1", "private_note_after_run_1"]) {
        const mutate = (prescription: Record<string, unknown>) => {
          const changed = replaceAtPath(prescription, path, rawText)
          if (typeof changed !== "object" || changed === null || Array.isArray(changed)) {
            throw new TypeError("Detailed prescription mutation did not produce an object")
          }
          return Object.fromEntries(Object.entries(changed))
        }
        const malformedBase = mutateDetailedPrescription(baseCandidate, mutate)
        const malformedProposed = mutateDetailedPrescription(proposedCandidate, mutate)
        expect(appAcceptsCandidate(malformedBase), path.join(".")).toBe(false)
        expect(await proposalFor(malformedBase, malformedProposed), path.join("."))
          .not.toMatchObject({ kind: "proposed" })
      }
    }
  })

  it("derives SB season provenance instead of copying a free-text season label", async () => {
    const fixture = RUNTIME_CASES[1]
    const id = "00000000-0000-4000-8000-000000001501"
    const record = createSelfReportedAthleteRecord({
      id,
      purpose: "SEASON_BEST",
      eventDistanceM: fixture.eventDistanceM,
      performanceSeconds: fixture.performanceSeconds,
      achievedOn: "2026-08-10",
      seasonId: "raw-symptom-chest-pain-after-training-1",
    }, TODAY)
    if (record === null) throw new TypeError("SB fixture is invalid")
    expect(saveAthleteRecord(record, TODAY)).toEqual({ ok: true, total: 1 })
    const generated = generatePlanFromDraft(draftFor(fixture), "NO_KNOWN_RISK", { selectedRecordId: id })
    if (generated.kind !== "generated") throw new TypeError("Detailed SB fixture did not generate")
    const [baseCandidate, proposedCandidate] = generated.generated.candidates

    expect(JSON.stringify(baseCandidate)).not.toContain("raw-symptom-chest-pain-after-training-1")
    expect(appAcceptsCandidate(baseCandidate)).toBe(true)
    expect(await proposalFor(baseCandidate, proposedCandidate)).toMatchObject({ kind: "proposed" })

    const mutateSeason = (candidate: PlanCandidate) => mutateDetailedPrescription(candidate, (prescription) => (
      replaceAnchorField(prescription, "seasonId", "private_note_after_run_1")
    ))
    const malformedBase = mutateSeason(baseCandidate)
    const malformedProposed = mutateSeason(proposedCandidate)
    expect(appAcceptsCandidate(malformedBase)).toBe(false)
    expect(await proposalFor(malformedBase, malformedProposed)).not.toMatchObject({ kind: "proposed" })
  })

  it.each([
    ["component references", (candidate: PlanCandidate) => ({
      ...candidate,
      sessions: candidate.sessions.map((session) => session.prescription.kind === "PACE_TARGET" ? {
        ...session,
        prescription: refreshPrescriptionFingerprint({
          ...session.prescription,
          componentRefs: sparseCopy(session.prescription.componentRefs),
        }),
      } : session),
    })],
    ["top-level stop codes", (candidate: PlanCandidate) => ({
      ...candidate,
      sessions: candidate.sessions.map((session) => session.prescription.kind === "PACE_TARGET" ? {
        ...session,
        prescription: refreshPrescriptionFingerprint({
          ...session.prescription,
          stopCodes: sparseCopy(session.prescription.stopCodes),
        }),
      } : session),
    })],
    ["operational stop-condition codes", (candidate: PlanCandidate) => ({
      ...candidate,
      sessions: candidate.sessions.map((session) => session.prescription.kind === "PACE_TARGET" ? {
        ...session,
        prescription: refreshPrescriptionFingerprint({
          ...session.prescription,
          operationalComponents: {
            ...session.prescription.operationalComponents,
            stopConditions: {
              ...session.prescription.operationalComponents.stopConditions,
              codes: sparseCopy(session.prescription.operationalComponents.stopConditions.codes),
            },
          },
        }),
      } : session),
    })],
    ["uncomputable reason codes", (candidate: PlanCandidate) => ({
      ...candidate,
      sessions: candidate.sessions.map((session) => session.prescription.kind === "PACE_TARGET" ? {
        ...session,
        prescription: refreshPrescriptionFingerprint({
          ...session.prescription,
          totals: {
            ...session.prescription.totals,
            uncomputableReasonCodes: sparseCopy(["WORK_DURATION_UNAVAILABLE" as const]),
          },
        }),
      } : session),
    })],
  ] as const)("never proposes app-rejected sparse PACE_TARGET %s", async (_label, mutate) => {
    const fixture = RUNTIME_CASES[1]
    const selectedRecordId = saveCurrentRecord(fixture.eventDistanceM, fixture.performanceSeconds)
    const generated = generatePlanFromDraft(draftFor(fixture), "NO_KNOWN_RISK", { selectedRecordId })
    if (generated.kind !== "generated") throw new TypeError("Detailed fixture did not generate")
    const [baseCandidate, proposedCandidate] = generated.generated.candidates
    const malformedBase = mutate(baseCandidate)
    const malformedProposed = mutate(proposedCandidate)

    expect(appAcceptsCandidate(malformedBase)).toBe(false)
    expect(await proposalFor(malformedBase, malformedProposed))
      .not.toMatchObject({ kind: "proposed" })
  })

  it.each([
    ["component references", (prescription: Record<string, unknown>) => ({
      ...prescription,
      componentRefs: withEnumerableArrayProperty(prescription.componentRefs as readonly unknown[]),
    })],
    ["top-level stop codes", (prescription: Record<string, unknown>) => ({
      ...prescription,
      stopCodes: withEnumerableArrayProperty(prescription.stopCodes as readonly unknown[]),
    })],
    ["operational stop-condition codes", (prescription: Record<string, unknown>) => {
      const operational = prescription.operationalComponents as Record<string, unknown>
      const stop = operational.stopConditions as Record<string, unknown>
      return {
        ...prescription,
        operationalComponents: {
          ...operational,
          stopConditions: {
            ...stop,
            codes: withEnumerableArrayProperty(stop.codes as readonly unknown[]),
          },
        },
      }
    }],
    ["uncomputable reason codes", (prescription: Record<string, unknown>) => {
      const totals = prescription.totals as Record<string, unknown>
      return {
        ...prescription,
        totals: {
          ...totals,
          uncomputableReasonCodes: withEnumerableArrayProperty(
            totals.uncomputableReasonCodes as readonly unknown[],
          ),
        },
      }
    }],
  ] as const)("rejects extra enumerable data on detailed PACE_TARGET %s", async (_label, mutate) => {
    const fixture = RUNTIME_CASES[1]
    const selectedRecordId = saveCurrentRecord(fixture.eventDistanceM, fixture.performanceSeconds)
    const generated = generatePlanFromDraft(draftFor(fixture), "NO_KNOWN_RISK", { selectedRecordId })
    if (generated.kind !== "generated") throw new TypeError("Detailed fixture did not generate")
    const [baseCandidate, proposedCandidate] = generated.generated.candidates
    const malformedBase = mutateDetailedPrescription(baseCandidate, mutate)
    const malformedProposed = mutateDetailedPrescription(proposedCandidate, mutate)

    expect(appAcceptsCandidate(malformedBase)).toBe(false)
    expect(await proposalFor(malformedBase, malformedProposed))
      .not.toMatchObject({ kind: "proposed" })
  })
})
