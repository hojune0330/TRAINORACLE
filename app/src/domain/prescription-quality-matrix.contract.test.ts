import { writeFileSync } from "node:fs"
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import * as d9Module from "@impl/d9/evaluator"
import type { PlanBetaIntake } from "./plan-beta-schema"
import {
  createSelfReportedAthleteRecord,
  saveAthleteRecord,
} from "./athlete-records"
import { MEMO_PURPOSE } from "./journal-schema"
import { saveEntry } from "./journal-store"
import {
  generatePlanFromDraft,
  selectPlanForActivation,
} from "./plan-beta-flow"
import {
  EVIDENCE_COVERAGE,
  PERSONA_COVERAGE,
  SUPPORTED_CASES,
  type MatrixCase,
} from "./prescription-quality-matrix-cases"

const TODAY = new Date("2026-08-17T03:00:00.000Z")
const RAW_MARKER = "MATRIX_RAW_FREE_TEXT_9f86d081"

type MatrixObservation = {
  readonly caseId: string
  readonly outcome: "DETAILED" | "RPE_FALLBACK" | "BLOCKED"
  readonly code: string
  readonly candidateCount: number
  readonly selfSelectionAllowed: boolean
  readonly rawFreeTextRetained: boolean
}

const observations: MatrixObservation[] = []

function draftFor(fixture: MatrixCase): PlanBetaIntake {
  return {
    eventGroup: fixture.eventGroup,
    competitionDivision: fixture.competitionDivision,
    experienceBand: "EXPERIENCED",
    availableDayCount: fixture.availableDayCount,
    requestedFrameLength: fixture.requestedFrameLength,
    trainingFocus: "VO2_INTENT",
    secondSessionMode: fixture.secondSessionMode,
    trainingTimePreference: fixture.trainingTimePreference,
  }
}

function saveCurrentRecord(eventDistanceM: number, performanceSeconds: number): string {
  const id = `matrix-current-${eventDistanceM}`
  const record = createSelfReportedAthleteRecord({
    id,
    purpose: "RECENT_RESULT",
    eventDistanceM,
    performanceSeconds,
    achievedOn: "2026-08-10",
    seasonId: null,
  }, TODAY)
  if (record === null) throw new TypeError("Matrix record fixture is invalid")
  expect(saveAthleteRecord(record, TODAY)).toEqual({ ok: true, total: 1 })
  return id
}

function saveRecentJournalContext(): void {
  for (const [index, date] of ["2026-08-15", "2026-08-16"].entries()) {
    const saved = saveEntry({
      id: `matrix-session-${index}`,
      kind: "post-session",
      date,
      savedAt: `${date}T10:00:00.000Z`,
      syncState: "local",
      system: "base",
      title: "Matrix context",
      distanceKm: "8",
      durationMin: "45",
      avgPace: "5:30",
      rpe: 4,
      memo: RAW_MARKER,
      memoPurpose: MEMO_PURPOSE.analyzableTrainingNote,
    })
    if (!saved.ok) throw new TypeError("Matrix journal fixture is invalid")
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(TODAY)
  window.localStorage.clear()
  window.sessionStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

afterAll(() => {
  const reportPath = process.env.PRESCRIPTION_MATRIX_REPORT
  if (reportPath === undefined) return
  writeFileSync(reportPath, `${JSON.stringify({
    schemaVersion: 1,
    baselineCommit: "edd7151e60c00b8a4c2b58722f39d021f7f5477a",
    evaluatedAt: TODAY.toISOString(),
    modeledInputs: ["event", "experienceBand", "recordEvidence", "frameLength", "trainingDays", "secondSessionMode", "trainingTimePreference", "D9"],
    reportOnlyPersonaDimensions: ["reportedSex", "performanceTier", "competitionDivision"],
    personaCoverage: PERSONA_COVERAGE,
    evidenceCoverage: EVIDENCE_COVERAGE,
    supportedGenerationCases: SUPPORTED_CASES,
    observations,
    unsupportedCombinations: [
      { combination: "sex-specific prescription", status: "UNMODELED", reason: "Sex is not a runtime input and cannot alter dose." },
      { combination: "high/mid/low performance-tier prescription", status: "UNMODELED", reason: "Experience band is explicitly not a skill score; no approved tier mapping exists." },
      { combination: "100-400m detailed prescription", status: "DEFERRED_RPE_FALLBACK", reason: "No approved detailed template is active in this scope." },
      { combination: "DEVELOPING or NEW_TO_RUNNING detailed prescription", status: "RPE_FALLBACK", reason: "Active detailed approvals are scoped to EXPERIENCED." },
      { combination: "missing or unselected record evidence", status: "RPE_FALLBACK", reason: "An explicit CURRENT same-event anchor is required." },
    ],
  }, null, 2)}\n`)
})

describe("athlete persona prescription quality matrix", () => {
  it.each(SUPPORTED_CASES)("binds approved detail for $caseId", (fixture) => {
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
    expect(Object.hasOwn(result.intake, "sex")).toBe(false)
    expect(Object.hasOwn(result.intake, "performanceTier")).toBe(false)
    expect(JSON.stringify(result)).not.toContain(RAW_MARKER)
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
      })
    }

    const selection = selectPlanForActivation(
      result.generated.candidates[0],
      result.generated,
      result.gate,
      result.intake,
      result.athleteEvidence,
    )
    expect(selection.kind).toBe("selected")
    observations.push({ caseId: fixture.caseId, outcome: "DETAILED", code: result.prescriptionBinding.code, candidateCount: 2, selfSelectionAllowed: selection.kind === "selected", rawFreeTextRetained: false })
  })

  it.each([
    ["no-record", "NONE", undefined, "EXPERIENCED", "PACE_TARGET_FALLBACK_NO_EXPLICIT_ANCHOR"],
    ["stored-unselected", "CURRENT", undefined, "EXPERIENCED", "PACE_TARGET_FALLBACK_NO_EXPLICIT_ANCHOR"],
    ["developing-current", "CURRENT", "select", "DEVELOPING", "PACE_TARGET_FALLBACK_EXPERIENCE_SCOPE"],
    ["deferred-100m", 100, "select", "EXPERIENCED", "PACE_TARGET_FALLBACK_EVENT_SCOPE"],
    ["deferred-400m", 400, "select", "EXPERIENCED", "PACE_TARGET_FALLBACK_EVENT_SCOPE"],
  ] as const)("reports truthful RPE fallback for %s", (caseId, recordState, selectionState, experienceBand, expectedCode) => {
    const recordDistance = typeof recordState === "number" ? recordState : 1500
    const selectedRecordId = recordState === "NONE" ? undefined : saveCurrentRecord(recordDistance, 245)
    const result = generatePlanFromDraft({
      ...draftFor(SUPPORTED_CASES[1]),
      experienceBand,
    }, "NO_KNOWN_RISK", selectionState === "select" ? { selectedRecordId } : undefined)

    expect(result.kind).toBe("generated")
    if (result.kind !== "generated") return
    expect(result.prescriptionBinding).toEqual({ kind: "fallback", code: expectedCode })
    expect(result.generated.candidates.every((candidate) => candidate.sessions.every(
      (session) => session.prescription.kind !== "PACE_TARGET",
    ))).toBe(true)
    observations.push({ caseId, outcome: "RPE_FALLBACK", code: expectedCode, candidateCount: 2, selfSelectionAllowed: true, rawFreeTextRetained: false })
  })

  it.each(["D9_ACTIVE", "D9_UNKNOWN"] as const)("blocks %s before candidates", (disposition) => {
    if (disposition === "D9_UNKNOWN") {
      vi.spyOn(d9Module, "evaluateD9ColloquialLayer").mockImplementation(() => {
        throw new TypeError("matrix evaluator failure")
      })
    }
    const result = generatePlanFromDraft(
      draftFor(SUPPORTED_CASES[0]),
      disposition === "D9_ACTIVE" ? "REVIEW_REQUIRED" : "NO_KNOWN_RISK",
    )
    expect(result).toEqual({ kind: "blocked", code: "CURRENT_CHECK_REQUIRES_REVIEW" })
    if (result.kind !== "blocked") throw new TypeError("D9 matrix case was not blocked")
    observations.push({ caseId: disposition, outcome: "BLOCKED", code: result.code, candidateCount: 0, selfSelectionAllowed: false, rawFreeTextRetained: false })
  })

  it("covers every requested matrix axis without treating persona labels as dose inputs", () => {
    expect(PERSONA_COVERAGE).toHaveLength(8)
    expect(EVIDENCE_COVERAGE.map((item) => item.state)).toEqual([
      "NONE",
      "SPARSE",
      "CURRENT_SAME_EVENT_WITH_SUFFICIENT_JOURNAL",
    ])
    expect(new Set(SUPPORTED_CASES.map((fixture) => fixture.eventDistanceM))).toEqual(new Set([800, 1500, 3000, 5000]))
    expect(new Set(SUPPORTED_CASES.map((fixture) => fixture.requestedFrameLength))).toEqual(new Set([7, 9, 10]))
    expect(SUPPORTED_CASES.some((fixture) => fixture.availableDayCount === "EVERY_DAY")).toBe(true)
    expect(new Set(SUPPORTED_CASES.map((fixture) => fixture.secondSessionMode))).toEqual(new Set(["SINGLE_SESSION_ONLY", "RECOVERY_PM_ALLOWED"]))
    expect(new Set(SUPPORTED_CASES.map((fixture) => fixture.reportedSex))).toEqual(new Set(["MALE", "FEMALE"]))
    expect(new Set(SUPPORTED_CASES.map((fixture) => fixture.performanceTier))).toEqual(new Set(["HIGH", "MID", "LOW"]))
  })
})
