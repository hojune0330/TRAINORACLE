import { beforeEach, describe, expect, it } from "vitest"
import {
  generatePlanFromDraft,
  selectPlanForActivation,
} from "./plan-beta-flow"
import { parsePlanBetaState } from "./plan-beta-schema"

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
})

describe("canonical plan intake boundary", () => {
  it.each([undefined, "NOT_PROVIDED" as const])(
    "generates without a competition division when the intake uses %s",
    (competitionDivision) => {
      // Given
      const draft = {
        eventGroup: "GENERAL_ENDURANCE" as const,
        competitionDivision,
        experienceBand: "DEVELOPING" as const,
        availableDayCount: 4 as const,
        requestedFrameLength: 9.5 as const,
        trainingFocus: "BASE_INTENT" as const,
        secondSessionMode: "SINGLE_SESSION_ONLY" as const,
        trainingTimePreference: "VARIES" as const,
      }

      // When
      const result = generatePlanFromDraft(draft, "NO_KNOWN_RISK")

      // Then
      expect(result.kind).toBe("generated")
      if (result.kind !== "generated") return
      expect(result.intake.competitionDivision).toBe("NOT_PROVIDED")
    },
  )

  it("projects seven requested days from the continuing 9.5-day formation", () => {
    // Given
    const draft = {
      eventGroup: "MIDDLE_DISTANCE" as const,
      experienceBand: "EXPERIENCED" as const,
      availableDayCount: 5 as const,
      requestedFrameLength: 7 as const,
      trainingFocus: "LT_INTENT" as const,
      secondSessionMode: "SINGLE_SESSION_ONLY" as const,
      trainingTimePreference: "VARIES" as const,
    }

    // When
    const result = generatePlanFromDraft(draft, "NO_KNOWN_RISK")

    // Then
    expect(result.kind).toBe("generated")
    if (result.kind !== "generated") return
    for (const candidate of result.generated.candidates) {
      expect(candidate.frame).toMatchObject({
        formationKind: "LOCAL_CIVIL_9_5",
        lengthDays: 9.5,
        slotCount: 19,
        projectionLengthDays: 7,
        continuity: {
          kind: "SEVEN_DAY_CONTINUITY",
          nextFrameInput: "SELECTED_PLAN_AND_PROGRESS",
        },
      })
      expect(candidate.sessions.every((session) => session.day <= 7)).toBe(true)
      expect(candidate.mainExposureLedger.countedExposureIds).toContain("app-main-day-9")
    }
    const candidate = result.generated.candidates[0]
    const selection = selectPlanForActivation(candidate, result.generated, result.gate, result.intake)
    expect(selection.kind).toBe("selected")
    if (selection.kind !== "selected") return
    expect(parsePlanBetaState(selection.state)?.activePlan.frame).toMatchObject({
      projectionLengthDays: 7,
      continuity: { kind: "SEVEN_DAY_CONTINUITY" },
    })
  })

  it("generates two selectable 9.5-day candidates from the athlete intake", () => {
    // Given
    const draft = {
      eventGroup: "MIDDLE_DISTANCE" as const,
      competitionDivision: "HIGH_SCHOOL" as const,
      experienceBand: "DEVELOPING" as const,
      availableDayCount: 3 as const,
      requestedFrameLength: 9 as const,
      trainingFocus: "LT_INTENT" as const,
      secondSessionMode: "SINGLE_SESSION_ONLY" as const,
      trainingTimePreference: "VARIES" as const,
    }

    // When
    const result = generatePlanFromDraft(draft, "NO_KNOWN_RISK")

    // Then
    expect(result.kind).toBe("generated")
    if (result.kind !== "generated") return

    expect(result.generated.candidates).toHaveLength(2)
    for (const candidate of result.generated.candidates) {
      expect(candidate.frame).toMatchObject({
        formationKind: "LOCAL_CIVIL_9_5",
        lengthDays: 9.5,
        slotCount: 19,
      })
      expect(candidate.mainExposureLedger.mainExposureCount).toBeGreaterThanOrEqual(2)
      expect(candidate.mainExposureLedger.mainExposureCount).toBeLessThanOrEqual(3)
    }
  })

  it("carries the athlete's training-time preference into the generated plan", () => {
    // Given
    const draft = {
      eventGroup: "MIDDLE_DISTANCE" as const,
      competitionDivision: "HIGH_SCHOOL" as const,
      experienceBand: "DEVELOPING" as const,
      availableDayCount: 4 as const,
      requestedFrameLength: 9 as const,
      trainingFocus: "LT_INTENT" as const,
      secondSessionMode: "RECOVERY_PM_ALLOWED" as const,
      trainingTimePreference: "EVENING" as const,
    }

    // When
    const result = generatePlanFromDraft(draft, "NO_KNOWN_RISK")

    // Then
    expect(result.kind).toBe("generated")
    if (result.kind !== "generated") return
    expect(result.intake).toMatchObject({ trainingTimePreference: "EVENING" })
    expect(result.generated.candidates[0]?.sessions.some(
      (session) => session.role === "QUALITY" && session.slot === "PM",
    )).toBe(true)
  })

  it("preserves an evening quality session when the athlete selects a two-a-day plan", () => {
    // Given
    const draft = {
      eventGroup: "FIVE_K" as const,
      competitionDivision: "OPEN" as const,
      experienceBand: "EXPERIENCED" as const,
      availableDayCount: "EVERY_DAY" as const,
      requestedFrameLength: 9.5 as const,
      trainingFocus: "VO2_INTENT" as const,
      secondSessionMode: "RECOVERY_PM_ALLOWED" as const,
      trainingTimePreference: "EVENING" as const,
    }
    const generated = generatePlanFromDraft(draft, "NO_KNOWN_RISK")
    expect(generated.kind).toBe("generated")
    if (generated.kind !== "generated") return
    const candidate = generated.generated.candidates[0]
    expect(candidate).toBeDefined()
    if (candidate === undefined) return

    // When
    const selection = selectPlanForActivation(
      candidate,
      generated.generated,
      generated.gate,
      generated.intake,
    )

    // Then
    expect(selection.kind).toBe("selected")
    if (selection.kind !== "selected") return
    expect(selection.state.activePlan.sessions.some(
      (session) => session.role === "QUALITY" && session.slot === "PM",
    )).toBe(true)
    expect(parsePlanBetaState(selection.state)).not.toBeNull()
  })
})
