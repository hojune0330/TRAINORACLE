import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  createSelfReportedAthleteRecord,
  saveAthleteRecord,
} from "../../../app/src/domain/athlete-records"
import { DETAILED_PRESCRIPTION_APPROVALS } from "../../../app/src/domain/detailed-prescription-approvals"
import { generatePlanFromDraft } from "../../../app/src/domain/plan-beta-flow"
import { projectInstantRecommendation } from "../../../app/src/screens/plan-beta/instant-plan-projection"
import { resolveRegisteredAdaptationTransform } from "../../../impl/src/plan-generator/adaptation-transform-registry"

const NOW = new Date("2026-09-30T03:00:00.000Z")

const EVENTS = [
  { label: "800m", eventGroup: "MIDDLE_DISTANCE", eventDistanceM: 800 },
  { label: "1500m", eventGroup: "MIDDLE_DISTANCE", eventDistanceM: 1500 },
  { label: "3000m", eventGroup: "MIDDLE_DISTANCE", eventDistanceM: 3000 },
  { label: "5000m", eventGroup: "FIVE_K", eventDistanceM: 5000 },
  { label: "10000m", eventGroup: "TEN_K", eventDistanceM: 10000 },
  { label: "half-marathon", eventGroup: "GENERAL_ENDURANCE", eventDistanceM: 21097 },
  { label: "marathon", eventGroup: "GENERAL_ENDURANCE", eventDistanceM: 42195 },
] as const

type EventCase = typeof EVENTS[number]
type DraftOptions = {
  experienceBand: "NEW_TO_RUNNING" | "DEVELOPING" | "EXPERIENCED"
  availableDayCount: 3 | 4 | 5 | 6 | "EVERY_DAY"
  requestedFrameLength: 7 | 9 | 9.5 | 10
  trainingFocus: "MIXED_INTENT" | "LT_INTENT" | "VO2_INTENT" | "BASE_INTENT"
  secondSessionMode: "SINGLE_SESSION_ONLY" | "RECOVERY_PM_ALLOWED"
  trainingTimePreference: "MORNING" | "EVENING" | "VARIES"
  selectedDetailedTemplateRef: unknown
}

function draft(event: EventCase, overrides: Partial<DraftOptions> = {}) {
  return {
    eventGroup: event.eventGroup,
    eventDistanceM: event.eventDistanceM,
    competitionDivision: "OPEN" as const,
    experienceBand: "EXPERIENCED" as const,
    availableDayCount: 5 as const,
    requestedFrameLength: 10 as const,
    trainingFocus: "MIXED_INTENT" as const,
    secondSessionMode: "SINGLE_SESSION_ONLY" as const,
    trainingTimePreference: "VARIES" as const,
    selectedDetailedTemplateRef: null,
    ...overrides,
  }
}

function generate(value: ReturnType<typeof draft>, selection?: unknown) {
  const result = generatePlanFromDraft(value, "NO_KNOWN_RISK", selection)
  if (result.kind !== "generated") throw new Error(`Synthetic plan was not generated: ${result.kind}`)
  return result
}

function candidate(result: ReturnType<typeof generate>, kind: "BALANCED" | "CONSERVATIVE" = "BALANCED") {
  const found = result.generated.candidates.find((item) => item.kind === kind)
  if (!found) throw new Error(`Missing ${kind} candidate`)
  return found
}

function qualitySessions(result: ReturnType<typeof generate>) {
  return candidate(result).sessions.filter((session) => session.role === "QUALITY")
}

function sessionProjection(result: ReturnType<typeof generate>) {
  return candidate(result).sessions.map((session) => ({
    day: session.day,
    slot: session.slot,
    role: session.role,
    plannedEnergyIntent: session.plannedEnergyIntent,
    prescription: session.prescription,
  }))
}

function saveSyntheticRecord(id: string, performanceSeconds: number) {
  const record = createSelfReportedAthleteRecord({
    id,
    purpose: "PERSONAL_BEST",
    eventDistanceM: 5000,
    performanceSeconds,
    achievedOn: "2026-09-01",
    seasonId: null,
  }, NOW)
  if (!record) throw new Error("Synthetic record was rejected")
  expect(saveAthleteRecord(record, NOW).ok).toBe(true)
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  localStorage.clear()
  sessionStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe("synthetic plan meaningfulness matrix", () => {
  it("keeps generic RPE session schedules identical across all seven event distances", () => {
    const matrix = EVENTS.map((event) => {
      const result = generate(draft(event))
      return { event: event.label, sessions: sessionProjection(result) }
    })
    for (const row of matrix.slice(1)) expect(row.sessions).toEqual(matrix[0]?.sessions)
  })

  it("places one beginner QUALITY and two experienced daily QUALITY sessions with a 3-day minimum gap", () => {
    const beginner = generate(draft(EVENTS[3]!, {
      experienceBand: "NEW_TO_RUNNING",
      availableDayCount: 3,
      trainingFocus: "MIXED_INTENT",
    }))
    const experiencedDaily = generate(draft(EVENTS[3]!, {
      availableDayCount: "EVERY_DAY",
      trainingFocus: "MIXED_INTENT",
    }))
    expect(qualitySessions(beginner).map((session) => session.day)).toEqual([5])
    expect(qualitySessions(experiencedDaily).map((session) => session.day)).toEqual([2, 10])
    expect(qualitySessions(experiencedDaily)[1]!.day - qualitySessions(experiencedDaily)[0]!.day).toBeGreaterThanOrEqual(3)
  })

  it("keeps a 9-day MIXED frame at days 1-9 and projects no hidden day-10 MAIN", () => {
    const result = generate(draft(EVENTS[3]!, {
      availableDayCount: "EVERY_DAY",
      requestedFrameLength: 9,
      trainingFocus: "MIXED_INTENT",
    }))
    const selected = candidate(result)
    const mainDays = selected.sessions
      .filter((session) => session.role === "QUALITY")
      .map((session) => session.day)
    const projection = projectInstantRecommendation(selected, "2026-09-30")

    expect(mainDays).toEqual([2, 9])
    expect(selected.sessions.find((session) => session.day === 10)?.role).toBe("REST")
    expect(projection?.days).toHaveLength(9)
    expect(projection?.days.flatMap((day) => day.sessions).filter((session) => session.role === "MAIN"))
      .toHaveLength(2)
  })

  it("gives an explicitly selected two-a-day plan two slots per available day and no double QUALITY", () => {
    const result = generate(draft(EVENTS[3]!, {
      availableDayCount: "EVERY_DAY",
      secondSessionMode: "RECOVERY_PM_ALLOWED",
      trainingTimePreference: "EVENING",
    }))
    const sessions = candidate(result).sessions.filter((session) => session.role !== "REST")
    const perDay = Array.from({ length: 10 }, (_, index) => sessions.filter((session) => session.day === index + 1))
    expect(perDay.map((items) => items.length)).toEqual(Array(10).fill(2))
    expect(perDay.every((items) => items.filter((session) => session.role === "QUALITY").length <= 1)).toBe(true)
    expect(qualitySessions(result).every((session) => session.slot === "PM")).toBe(true)
  })

  it("uses selected intent for RPE while preserving the same generic session duration and placement", () => {
    const mixed = generate(draft(EVENTS[3]!, { trainingFocus: "MIXED_INTENT" }))
    const target = generate(draft(EVENTS[3]!, { trainingFocus: "VO2_INTENT" }))
    const mixedQuality = qualitySessions(mixed)
    const targetQuality = qualitySessions(target)
    expect(mixedQuality.map(({ day, slot }) => [day, slot])).toEqual(targetQuality.map(({ day, slot }) => [day, slot]))
    expect(mixedQuality[0]?.prescription).toMatchObject({ kind: "RPE_TIME_RANGE", rpe: { minimum: 6, maximum: 7 } })
    expect(targetQuality[0]?.prescription).toMatchObject({ kind: "RPE_TIME_RANGE", rpe: { minimum: 7, maximum: 8 } })
    if (mixedQuality[0]?.prescription.kind !== "RPE_TIME_RANGE" || targetQuality[0]?.prescription.kind !== "RPE_TIME_RANGE") {
      throw new Error("Expected generic RPE prescriptions")
    }
    expect(mixedQuality[0].prescription.durationMinutes).toEqual(targetQuality[0].prescription.durationMinutes)
  })

  it("uses a current same-event record only after explicit selection, with its value reflected in pace", () => {
    const approval = DETAILED_PRESCRIPTION_APPROVALS.find((item) => item.targetEventDistanceM === 5000)
    if (!approval) throw new Error("Missing approved synthetic 5000m template")
    const value = draft(EVENTS[3]!, {
      availableDayCount: "EVERY_DAY",
      trainingFocus: "VO2_INTENT",
      selectedDetailedTemplateRef: {
        templateId: approval.templateId,
        version: approval.templateVersion,
        fingerprint: approval.templateContentFingerprint,
      },
    })
    saveSyntheticRecord("synthetic-5k-a", 1111)
    const unselected = generate(value)
    expect(unselected.athleteEvidence.storedRecordCount).toBe(1)
    expect(unselected.prescriptionBinding).toMatchObject({ kind: "fallback", code: "PACE_TARGET_FALLBACK_NO_EXPLICIT_ANCHOR" })

    const selected = generate(value, { selectedRecordId: "synthetic-5k-a" })
    expect(selected.prescriptionBinding).toMatchObject({ kind: "bound", code: "PACE_TARGET_BOUND" })
    const first = selected.generated.candidates[0]!.sessions.find((session) => (
      session.role === "QUALITY" && session.prescription.kind === "PACE_TARGET"
    ))
    if (first?.prescription.kind !== "PACE_TARGET") throw new Error("Missing bound synthetic pace target")
    expect(first.prescription.targetRepSeconds).toBe(222.2)

    localStorage.clear()
    saveSyntheticRecord("synthetic-5k-b", 1200)
    const changedRecord = generate(value, { selectedRecordId: "synthetic-5k-b" })
    const second = changedRecord.kind === "generated" && changedRecord.generated.candidates[0]!.sessions.find((session) => (
      session.role === "QUALITY" && session.prescription.kind === "PACE_TARGET"
    ))
    if (!second || second.prescription.kind !== "PACE_TARGET") throw new Error("Missing changed synthetic pace target")
    expect(second.prescription.targetRepSeconds).toBe(240)
  })

  it("keeps initial candidate QUALITY equal but exposes the registered support-volume increase edge", () => {
    const result = generate(draft(EVENTS[3]!))
    const balanced = candidate(result, "BALANCED")
    const conservative = candidate(result, "CONSERVATIVE")
    expect(balanced.sessions.filter((session) => session.role === "QUALITY"))
      .toEqual(conservative.sessions.filter((session) => session.role === "QUALITY"))
    const upward = resolveRegisteredAdaptationTransform(conservative, balanced, "EXPLICIT_REQUEST")
    expect(upward?.edge).toMatchObject({
      edgeId: "CONSERVATIVE_TO_BALANCED_EXISTING_SIBLING_ONLY",
      status: "ACTIVE",
      dimension: "VOLUME",
      direction: "INCREASE",
    })
  })
})
