import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  canonicalJsonSha256,
  createPlanAdaptationProposal,
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
  planBetaStateV2Schema,
} from "./plan-beta-schema"
import { generatePlanFromDraft } from "./plan-beta-flow"
import {
  RUNTIME_CASES,
  TODAY,
  draftFor,
  saveCurrentRecord,
} from "./prescription-quality-matrix.test-fixtures"

type CandidateMutation = (candidate: PlanCandidate) => unknown

const candidateSchema = planAdaptationProposalSchema.shape.baseCandidate

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
      sourceRef: "athlete-request:athlete-1:parser-parity",
    },
    changeDimension: "VOLUME",
    safetyGate: clearedGate(),
    safetyEvaluatedAt: "2026-08-18T00:00:00.000Z",
    safetyValidUntil: "2026-08-18T00:10:00.000Z",
    activeHold: false,
    createdAt: "2026-08-18T00:05:00.000Z",
    idempotencyKey: "parser-parity",
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

describe("impl/app adaptation candidate parser parity", () => {
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
})
