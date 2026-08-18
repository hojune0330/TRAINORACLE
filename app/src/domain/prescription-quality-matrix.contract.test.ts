import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import * as d9Module from "@impl/d9/evaluator"
import {
  generatePlanFromDraft,
  selectPlanForActivation,
} from "./plan-beta-flow"
import {
  EVIDENCE_SAMPLES,
  EXTERNAL_POPULATION_REVIEW_LABELS,
  RAW_MARKER,
  RUNTIME_CASES,
  SAMPLED_REVIEW_METADATA,
  TODAY,
  draftFor,
  saveCurrentRecord,
  saveRecentJournalContext,
  writeMatrixReport,
  type MatrixObservation,
  type PopulationContractObservation,
} from "./prescription-quality-matrix.test-fixtures"

const observations: MatrixObservation[] = []
const populationContractObservations: PopulationContractObservation[] = []

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(TODAY)
  window.localStorage.clear()
  window.sessionStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

afterAll(() => writeMatrixReport(observations, populationContractObservations))

describe("athlete persona prescription quality matrix", () => {
  it.each([
    { label: "missing", sourceCommit: undefined },
    { label: "invalid", sourceCommit: "not-a-commit-sha" },
  ] as const)("rejects report generation with a $label source commit", ({ sourceCommit }) => {
    vi.stubEnv("PRESCRIPTION_MATRIX_REPORT", ".")
    vi.stubEnv("PRESCRIPTION_MATRIX_SOURCE_COMMIT", sourceCommit)

    expect(() => writeMatrixReport([], [])).toThrow(
      "PRESCRIPTION_MATRIX_SOURCE_COMMIT must be exactly 40 hexadecimal characters",
    )
  })

  it.each(RUNTIME_CASES)("binds approved detail for $caseId", (fixture) => {
    const selectedRecordId = saveCurrentRecord(
      fixture.eventDistanceM,
      fixture.performanceSeconds,
    )
    if (fixture.withRecentJournal) saveRecentJournalContext()

    const result = generatePlanFromDraft(
      draftFor(fixture),
      "NO_KNOWN_RISK",
      { selectedRecordId },
    )

    expect(result.kind).toBe("generated")
    if (result.kind !== "generated") return
    expect(result.prescriptionBinding).toEqual({ kind: "bound", code: "PACE_TARGET_BOUND" })
    expect(result.generated.selectionAuthority).toBe("SELF")
    expect(result.generated.candidates).toHaveLength(2)
    expect(Object.hasOwn(result.intake, "age")).toBe(false)
    expect(Object.hasOwn(result.intake, "sex")).toBe(false)
    expect(Object.hasOwn(result.intake, "performanceTier")).toBe(false)
    if (fixture.withRecentJournal) {
      expect(result.athleteEvidence.recentJournalSessionCount).toBe(2)
      expect(result.generated.sourceMode).toBe("JOURNAL_CONTEXT_ONLY")
    }

    for (const candidate of result.generated.candidates) {
      const sessionKeys = candidate.sessions.map((session) => `${session.day}:${session.slot}`)
      expect(new Set(sessionKeys).size).toBe(sessionKeys.length)
      expect(candidate.sessions.filter(
        (session) => session.day === 10 && session.slot === "PM",
      )).toEqual([])
      expect(candidate.frame.projectionLengthDays).toBe(fixture.requestedFrameLength)
      const detailed = candidate.sessions.filter((session) => session.prescription.kind === "PACE_TARGET")
      expect(detailed).toHaveLength(1)
      expect(detailed[0]?.prescription).toMatchObject({
        kind: "PACE_TARGET",
        targetEventDistanceM: fixture.eventDistanceM,
        targetRepSeconds: fixture.targetRepSeconds,
        scope: { population: "YOUTH_AND_ADULT" },
      })
      if (fixture.availableDayCount === "EVERY_DAY") {
        const dayTen = candidate.sessions.filter((session) => session.day === 10)
        expect(dayTen).toHaveLength(1)
        expect(dayTen[0]).toMatchObject({
          day: 10,
          slot: "AM",
          role: "QUALITY",
          plannedEnergyIntent: "VO2_INTENT",
        })
      }
    }

    const selection = selectPlanForActivation(
      result.generated.candidates[0],
      result.generated,
      result.gate,
      result.intake,
      result.athleteEvidence,
    )
    expect(selection.kind).toBe("selected")
    const serializedResult = JSON.stringify({ result, selection })
    const selfSelectionAllowed = selection.kind === "selected"
    const rawFreeTextRetained = serializedResult.includes(RAW_MARKER)
    expect(selfSelectionAllowed).toBe(true)
    expect(rawFreeTextRetained).toBe(false)
    observations.push({ caseId: fixture.caseId, outcome: "DETAILED", code: result.prescriptionBinding.code, candidateCount: result.generated.candidates.length, selfSelectionAllowed, rawFreeTextRetained })
  })

  it.each([
    ["no-record-with-raw-memo", "NONE", undefined, "EXPERIENCED", "PACE_TARGET_FALLBACK_NO_EXPLICIT_ANCHOR", true],
    ["stored-unselected", "CURRENT", undefined, "EXPERIENCED", "PACE_TARGET_FALLBACK_NO_EXPLICIT_ANCHOR", false],
    ["developing-current", "CURRENT", "select", "DEVELOPING", "PACE_TARGET_FALLBACK_EXPERIENCE_SCOPE", false],
    ["deferred-100m", 100, "select", "EXPERIENCED", "PACE_TARGET_FALLBACK_EVENT_SCOPE", false],
    ["deferred-400m", 400, "select", "EXPERIENCED", "PACE_TARGET_FALLBACK_EVENT_SCOPE", false],
  ] as const)("reports truthful RPE fallback for %s", (caseId, recordState, selectionState, experienceBand, expectedCode, withRawMemo) => {
    const recordDistance = typeof recordState === "number" ? recordState : 1500
    const selectedRecordId = recordState === "NONE" ? undefined : saveCurrentRecord(recordDistance, 245)
    if (withRawMemo) saveRecentJournalContext()
    const result = generatePlanFromDraft({
      ...draftFor(RUNTIME_CASES[1]),
      experienceBand,
    }, "NO_KNOWN_RISK", selectionState === "select" ? { selectedRecordId } : undefined)

    expect(result.kind).toBe("generated")
    if (result.kind !== "generated") return
    expect(result.prescriptionBinding).toEqual({ kind: "fallback", code: expectedCode })
    expect(result.generated.candidates.every((candidate) => candidate.sessions.every(
      (session) => session.prescription.kind !== "PACE_TARGET",
    ))).toBe(true)
    if (withRawMemo) expect(result.athleteEvidence.recentJournalSessionCount).toBe(2)
    const selection = selectPlanForActivation(
      result.generated.candidates[0],
      result.generated,
      result.gate,
      result.intake,
      result.athleteEvidence,
    )
    const serializedResult = JSON.stringify({ result, selection })
    const selfSelectionAllowed = selection.kind === "selected"
    const rawFreeTextRetained = serializedResult.includes(RAW_MARKER)
    expect(selfSelectionAllowed).toBe(true)
    expect(rawFreeTextRetained).toBe(false)
    observations.push({ caseId, outcome: "RPE_FALLBACK", code: expectedCode, candidateCount: result.generated.candidates.length, selfSelectionAllowed, rawFreeTextRetained })
  })

  it.each(["D9_ACTIVE", "D9_UNKNOWN"] as const)("blocks %s before candidates", (disposition) => {
    if (disposition === "D9_UNKNOWN") {
      vi.spyOn(d9Module, "evaluateD9ColloquialLayer").mockImplementation(() => {
        throw new TypeError("matrix evaluator failure")
      })
    }
    const result = generatePlanFromDraft(
      draftFor(RUNTIME_CASES[0]),
      disposition === "D9_ACTIVE" ? "REVIEW_REQUIRED" : "NO_KNOWN_RISK",
    )
    expect(result).toEqual({ kind: "blocked", code: "CURRENT_CHECK_REQUIRES_REVIEW" })
    if (result.kind !== "blocked") throw new TypeError("D9 matrix case was not blocked")
    observations.push({ caseId: disposition, outcome: "BLOCKED", code: result.code, candidateCount: 0, selfSelectionAllowed: false, rawFreeTextRetained: JSON.stringify(result).includes(RAW_MARKER) })
  })

  it("keeps the prescription identical across external youth and adult review labels", () => {
    const fixture = RUNTIME_CASES[4]
    const selectedRecordId = saveCurrentRecord(fixture.eventDistanceM, fixture.performanceSeconds)
    const runtimeInput = draftFor(fixture)
    const serializedRuntimeInput = JSON.stringify(runtimeInput)
    const labelsPassedToRuntime = EXTERNAL_POPULATION_REVIEW_LABELS.some((label) => serializedRuntimeInput.includes(label))
    const prescriptions = EXTERNAL_POPULATION_REVIEW_LABELS.map(() => {
      const result = generatePlanFromDraft(runtimeInput, "NO_KNOWN_RISK", { selectedRecordId })
      expect(result.kind).toBe("generated")
      if (result.kind !== "generated") throw new TypeError("Population contract case did not generate")
      return result.generated.candidates.map((candidate) => {
        const session = candidate.sessions.find((item) => item.prescription.kind === "PACE_TARGET")
        if (session?.prescription.kind !== "PACE_TARGET") throw new TypeError("Population contract case was not bound")
        return session.prescription
      })
    })
    const prescriptionsEqual = JSON.stringify(prescriptions[0]) === JSON.stringify(prescriptions[1])
    const populationScopes = [...new Set(prescriptions.flat().map((prescription) => prescription.scope.population))]

    expect(labelsPassedToRuntime).toBe(false)
    expect(prescriptionsEqual).toBe(true)
    expect(populationScopes).toEqual(["YOUTH_AND_ADULT"])
    populationContractObservations.push({
      reviewLabels: EXTERNAL_POPULATION_REVIEW_LABELS,
      labelsPassedToRuntime,
      runtimeInputsIdentical: true,
      prescriptionsEqual,
      populationScopes,
    })
  })

  it("records sampled review metadata without treating labels as executable dose axes", () => {
    expect(SAMPLED_REVIEW_METADATA).toHaveLength(8)
    expect(SAMPLED_REVIEW_METADATA.filter((item) => item.divisionLabel === "HIGH_SCHOOL").map(
      (item) => `${item.reportedSex}:${item.performanceTier}`,
    )).toEqual(["MALE:HIGH", "MALE:MID", "MALE:LOW", "FEMALE:HIGH", "FEMALE:MID", "FEMALE:LOW"])
    expect(EVIDENCE_SAMPLES.map((item) => item.state)).toEqual([
      "NONE",
      "SPARSE",
      "CURRENT_SAME_EVENT_WITH_SUFFICIENT_JOURNAL",
    ])
    expect(new Set(RUNTIME_CASES.map((fixture) => fixture.eventDistanceM))).toEqual(new Set([800, 1500, 3000, 5000]))
    expect(new Set(RUNTIME_CASES.map((fixture) => fixture.requestedFrameLength))).toEqual(new Set([7, 9, 10]))
    expect(RUNTIME_CASES.some((fixture) => fixture.availableDayCount === "EVERY_DAY")).toBe(true)
    expect(new Set(RUNTIME_CASES.map((fixture) => fixture.secondSessionMode))).toEqual(new Set(["SINGLE_SESSION_ONLY", "RECOVERY_PM_ALLOWED"]))
  })
})
