import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  createSelfReportedAthleteRecord,
  saveAthleteRecord,
} from "./athlete-records"
import { generatePlanFromDraft } from "./plan-beta-flow"

const TODAY = new Date("2026-08-17T03:00:00.000Z")

const BASE_DRAFT = {
  eventGroup: "MIDDLE_DISTANCE" as const,
  competitionDivision: "OPEN" as const,
  experienceBand: "EXPERIENCED" as const,
  availableDayCount: 5 as const,
  requestedFrameLength: 9 as const,
  trainingFocus: "VO2_INTENT" as const,
  secondSessionMode: "SINGLE_SESSION_ONLY" as const,
  trainingTimePreference: "VARIES" as const,
}

const CASES = [
  {
    eventDistanceM: 800,
    performanceSeconds: 122,
    notation: "10×200m @800m RP · r60″ STAND",
    repetitionsPerSet: 10,
    repetitionDistanceM: 200,
    targetRepSeconds: 30.5,
    recoverySeconds: 60,
    recoveryMode: "STAND",
    qualityDistanceM: 2000,
    recoveryOccurrences: 9,
    recoveryTotalSeconds: 540,
    templateId: "MD-800-01",
  },
  {
    eventDistanceM: 1500,
    performanceSeconds: 245,
    notation: "3×500m @1500m RP · r180″ STAND",
    repetitionsPerSet: 3,
    repetitionDistanceM: 500,
    targetRepSeconds: 245 * 500 / 1500,
    recoverySeconds: 180,
    recoveryMode: "STAND",
    qualityDistanceM: 1500,
    recoveryOccurrences: 2,
    recoveryTotalSeconds: 360,
    templateId: "MD-1500-01",
  },
  {
    eventDistanceM: 3000,
    performanceSeconds: 611,
    notation: "4×800m @3000m RP · r180″ WALK",
    repetitionsPerSet: 4,
    repetitionDistanceM: 800,
    targetRepSeconds: 611 * 800 / 3000,
    recoverySeconds: 180,
    recoveryMode: "WALK",
    qualityDistanceM: 3200,
    recoveryOccurrences: 3,
    recoveryTotalSeconds: 540,
    templateId: "MD-3000-01",
  },
] as const

function saveCurrentRecord(eventDistanceM: number, performanceSeconds: number): string {
  const id = `current-${eventDistanceM}`
  const record = createSelfReportedAthleteRecord({
    id,
    purpose: "RECENT_RESULT",
    eventDistanceM,
    performanceSeconds,
    achievedOn: "2026-08-10",
    seasonId: null,
  }, TODAY)
  if (record === null) throw new TypeError("Current same-event fixture is invalid")
  expect(saveAthleteRecord(record, TODAY)).toEqual({ ok: true, total: 1 })
  return id
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(TODAY)
  window.localStorage.clear()
})

describe("multi-event same-event detailed prescriptions", () => {
  it.each(CASES)(
    "binds the exact $eventDistanceM m template into both candidates",
    (fixture) => {
      const selectedRecordId = saveCurrentRecord(
        fixture.eventDistanceM,
        fixture.performanceSeconds,
      )

      const result = generatePlanFromDraft(
        BASE_DRAFT,
        "NO_KNOWN_RISK",
        { selectedRecordId },
      )

      expect(result.kind).toBe("generated")
      if (result.kind !== "generated") return
      expect(result.prescriptionBinding).toEqual({
        kind: "bound",
        code: "PACE_TARGET_BOUND",
      })
      for (const candidate of result.generated.candidates) {
        const sessions = candidate.sessions.filter((session) => (
          session.role === "QUALITY"
          && session.prescription.kind === "PACE_TARGET"
        ))
        expect(sessions).toHaveLength(1)
        const session = sessions[0]
        if (session?.role !== "QUALITY" || session.prescription.kind !== "PACE_TARGET") {
          throw new TypeError("Detailed session is missing")
        }
        expect(session.prescription).toMatchObject({
          templateId: fixture.templateId,
          notation: fixture.notation,
          setCount: 1,
          repetitionsPerSet: fixture.repetitionsPerSet,
          repetitionDistanceM: fixture.repetitionDistanceM,
          targetEventDistanceM: fixture.eventDistanceM,
          targetRepSeconds: fixture.targetRepSeconds,
          repetitionRecoverySeconds: fixture.recoverySeconds,
          repetitionRecoveryMode: fixture.recoveryMode,
          totals: {
            qualityDistanceM: fixture.qualityDistanceM,
            repetitionRecoveryOccurrences: fixture.recoveryOccurrences,
            repetitionRecoveryTotalSeconds: fixture.recoveryTotalSeconds,
          },
          scope: {
            eventGroup: "MIDDLE_DISTANCE",
            experienceBand: "EXPERIENCED",
            population: "YOUTH_AND_ADULT",
          },
        })
      }
    },
  )

  it.each(["MIDDLE_SCHOOL", "OPEN"] as const)(
    "keeps the same 1500m dose for the %s display division",
    (competitionDivision) => {
      const selectedRecordId = saveCurrentRecord(1500, 240)
      const result = generatePlanFromDraft(
        { ...BASE_DRAFT, competitionDivision },
        "NO_KNOWN_RISK",
        { selectedRecordId },
      )
      expect(result.kind).toBe("generated")
      if (result.kind !== "generated") return
      const detailed = result.generated.candidates[0].sessions.find((session) => (
        session.role === "QUALITY" && session.prescription.kind === "PACE_TARGET"
      ))
      expect(detailed?.prescription).toMatchObject({
        notation: "3×500m @1500m RP · r180″ STAND",
        targetRepSeconds: 80,
      })
    },
  )

  it("keeps a decimal electronic result as the exact pace anchor", () => {
    const selectedRecordId = saveCurrentRecord(800, 121.5)
    const result = generatePlanFromDraft(
      BASE_DRAFT,
      "NO_KNOWN_RISK",
      { selectedRecordId },
    )

    expect(result.kind).toBe("generated")
    if (result.kind !== "generated") return
    expect(result.prescriptionBinding).toEqual({ kind: "bound", code: "PACE_TARGET_BOUND" })
    const detailed = result.generated.candidates[0].sessions.find((session) => (
      session.role === "QUALITY" && session.prescription.kind === "PACE_TARGET"
    ))
    expect(detailed?.prescription).toMatchObject({
      targetEventDistanceM: 800,
      targetRepSeconds: 30.375,
    })
  })

  it("keeps an unsupported same-group distance RPE-only", () => {
    const selectedRecordId = saveCurrentRecord(1000, 150)
    const baseline = generatePlanFromDraft(BASE_DRAFT, "NO_KNOWN_RISK")
    const result = generatePlanFromDraft(
      BASE_DRAFT,
      "NO_KNOWN_RISK",
      { selectedRecordId },
    )

    expect(result.kind).toBe("generated")
    expect(baseline.kind).toBe("generated")
    if (result.kind !== "generated" || baseline.kind !== "generated") return
    expect(result.prescriptionBinding).toEqual({
      kind: "fallback",
      code: "PACE_TARGET_FALLBACK_EVENT_SCOPE",
    })
    expect(result.generated.candidates).toStrictEqual(baseline.generated.candidates)
  })
})
