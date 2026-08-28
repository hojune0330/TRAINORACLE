import { beforeEach, describe, expect, it, vi } from "vitest"
import { generatePlanFromDraft } from "./plan-beta-flow"
import {
  eventDistanceLabel,
  eventGroupForDistance,
  SUPPORTED_PLAN_EVENTS,
} from "../screens/plan-beta/plan-intake-navigation"

const LONGER_EVENTS = [
  { distanceM: 10000, eventGroup: "TEN_K", competitionDivision: "OPEN", label: "10km" },
  { distanceM: 21097, eventGroup: "GENERAL_ENDURANCE", competitionDivision: "NOT_PROVIDED", label: "하프마라톤" },
  { distanceM: 42195, eventGroup: "GENERAL_ENDURANCE", competitionDivision: "NOT_PROVIDED", label: "마라톤" },
] as const

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date("2026-08-28T03:00:00.000Z"))
  window.localStorage.clear()
})

describe("800m through marathon event breadth", () => {
  it("keeps the seven initial events and their display groups explicit", () => {
    expect(SUPPORTED_PLAN_EVENTS).toHaveLength(7)
    for (const fixture of LONGER_EVENTS) {
      expect(eventGroupForDistance(fixture.distanceM)).toBe(fixture.eventGroup)
      expect(eventDistanceLabel(fixture.distanceM)).toBe(fixture.label)
    }
  })

  it.each(LONGER_EVENTS)(
    "generates an honest RPE-time plan for $label without inventing pace detail",
    ({ distanceM, eventGroup, competitionDivision }) => {
      const result = generatePlanFromDraft({
        eventGroup,
        eventDistanceM: distanceM,
        competitionDivision,
        experienceBand: "DEVELOPING",
        availableDayCount: 5,
        requestedFrameLength: 9,
        trainingFocus: "BASE_INTENT",
        secondSessionMode: "SINGLE_SESSION_ONLY",
        trainingTimePreference: "VARIES",
        selectedDetailedTemplateRef: null,
      }, "NO_KNOWN_RISK")

      expect(result.kind).toBe("generated")
      if (result.kind !== "generated") return
      expect(result.prescriptionBinding).toEqual({
        kind: "fallback",
        code: "PACE_TARGET_FALLBACK_NO_EXPLICIT_TEMPLATE",
      })
      for (const candidate of result.generated.candidates) {
        expect(candidate.eventGroup).toBe(eventGroup)
        expect(candidate.eventDistanceM).toBe(distanceM)
        expect(candidate.selectedDetailedTemplateRef).toBeNull()
        expect(candidate.beta.prescriptionBasis).toBe("DURATION_RPE_ONLY")
        expect(candidate.sessions.some((session) => session.prescription.kind === "RPE_TIME_RANGE")).toBe(true)
        expect(candidate.sessions.some((session) => session.prescription.kind === "PACE_TARGET")).toBe(false)
      }
    },
  )

  it("rejects a distance paired with the wrong event group", () => {
    const result = generatePlanFromDraft({
      eventGroup: "TEN_K",
      eventDistanceM: 42195,
      competitionDivision: "OPEN",
      experienceBand: "DEVELOPING",
      availableDayCount: 5,
      requestedFrameLength: 9,
      trainingFocus: "BASE_INTENT",
      secondSessionMode: "SINGLE_SESSION_ONLY",
      trainingTimePreference: "VARIES",
      selectedDetailedTemplateRef: null,
    }, "NO_KNOWN_RISK")

    expect(result).toEqual({ kind: "rejected", code: "MINIMUM_PROFILE_INCOMPLETE" })
  })
})
