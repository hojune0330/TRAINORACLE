import { describe, expect, it } from "vitest"
import { generatePlanFromDraft } from "./plan-beta-flow"
import { findCatalogConditionReview } from "./catalog-condition-review"
import { replaceCandidateCatalogWorkout } from "./catalog-plan-binding"
import { catalogScheduleConditions, isCatalogEnvironmentRequirement } from "./catalog-schedule-conditions"
import { ALL_WORKOUT_CATALOG } from "@impl/prescription/all-workout-calculator"

function fixture() {
  const source = generatePlanFromDraft({ eventGroup: "FIVE_K", eventDistanceM: 5000,
    experienceBand: "EXPERIENCED", competitionDivision: "OPEN", availableDayCount: 5,
    requestedFrameLength: 9, trainingFocus: "ATP_PC_INTENT", trainingTimePreference: "EVENING",
    secondSessionMode: "SINGLE_SESSION_ONLY", selectedDetailedTemplateRef: null }, "NO_KNOWN_RISK")
  if (source.kind !== "generated") throw Error(source.kind)
  const offer = findCatalogConditionReview(source.generated, source.intake)!
  const changed = replaceCandidateCatalogWorkout(source.generated, offer, offer.catalogId, {
    eventDistanceM: 5000, experience: "EXPERIENCED", availableSeconds: null,
    confirmedRequirements: ["ACCELERATION_AND_DECELERATION_SPACE"], segmentPaces: [], fiveK: null,
  })
  if (!changed) throw Error("valid binding required")
  return { original: source.generated, changed, offer }
}

describe("calendar-scoped temporary environment review", () => {
  it("classifies every currently catalogued condition instead of silently missing a new environment requirement", () => {
    const experience = new Set(["RECENT_LONG_RUN_BASELINE", "RECENT_THRESHOLD_VOLUME", "COMPOUND_TRAINING_EXPERIENCE", "HIGH_INTENSITY_REPETITION_EXPERIENCE"])
    for (const requirement of new Set(ALL_WORKOUT_CATALOG.flatMap(entry => entry.requirements)))
      expect(isCatalogEnvironmentRequirement(requirement) || experience.has(requirement), requirement).toBe(true)
  })
  it("needs no additional answer for original unconfirmed or environment-free workouts", () => {
    expect(catalogScheduleConditions(fixture().original, "2026-10-02", null)).toEqual([])
    for (const key of ["RECENT_LONG_RUN_BASELINE", "RECENT_THRESHOLD_VOLUME", "COMPOUND_TRAINING_EXPERIENCE", "HIGH_INTENSITY_REPETITION_EXPERIENCE"])
      expect(isCatalogEnvironmentRequirement(key), key).toBe(false)
  })

  it("binds calendar date, slot, exact workout and account without altering the source", () => {
    const { changed, offer } = fixture(), before = JSON.stringify(changed)
    const rows = catalogScheduleConditions(changed, "2026-10-02", null)
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every(row => row.day === offer.day && row.slot === offer.slot)).toBe(true)
    expect(rows.every(row => row.requirements.join() === "ACCELERATION_AND_DECELERATION_SPACE")).toBe(true)
    const keys = rows.map(row => row.key)
    expect(catalogScheduleConditions(changed, "2026-11-02", null).every(row => !keys.includes(row.key))).toBe(true)
    expect(catalogScheduleConditions(changed, "2026-10-02", "synthetic-user").every(row => !keys.includes(row.key))).toBe(true)
    expect(catalogScheduleConditions(changed, "2026-10-02", null).map(row => row.key)).toEqual(keys)
    expect(catalogScheduleConditions(changed, "2026-02-30", null)).toEqual([])
    expect(JSON.stringify(changed)).toBe(before)
  })
})
