import { beforeEach, describe, expect, it } from "vitest"
import { TRAINING_CONTENT_CATALOG, trainingContentById } from "./training-content-catalog"
import { loadSavedTrainingContent, setTrainingContentSaved } from "./training-content-store"

beforeEach(() => window.localStorage.clear())

describe("training content catalog", () => {
  it("keeps every launch article read-only and source-labelled", () => {
    expect(TRAINING_CONTENT_CATALOG).toHaveLength(3)
    expect(new Set(TRAINING_CONTENT_CATALOG.map((article) => article.id)).size).toBe(3)
    for (const article of TRAINING_CONTENT_CATALOG) {
      expect(Number.isInteger(article.contentRevision)).toBe(true)
      expect(article.contentRevision).toBeGreaterThan(0)
      expect(article.publicationState).toBe("BETA_READ_ONLY_PUBLISHED")
      expect(article.publishedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/u)
      expect(article.correctionNotice).toBeNull()
      expect(article.planEligibility).toBe("NOT_PLAN_ELIGIBLE")
      expect(article.sourceUrl).toMatch(/^https:\/\//u)
      expect(article.useBoundary.length).toBeGreaterThan(30)
    }
  })

  it("fails closed for an unknown article id", () => {
    expect(() => trainingContentById("UNKNOWN" as never)).toThrow(/Unknown training content/u)
  })

  it("stores only known ids and never creates points or plan state", () => {
    window.localStorage.setItem("trainoracle.training-content.saved.v1", JSON.stringify([
      "CRUISE_INTERVALS", "CRUISE_INTERVALS", "UNKNOWN",
    ]))
    expect(loadSavedTrainingContent()).toEqual(["CRUISE_INTERVALS"])

    expect(setTrainingContentSaved("ELITE_MARATHON_WEEK", true)).toEqual([
      "CRUISE_INTERVALS", "ELITE_MARATHON_WEEK",
    ])
    expect(Object.keys(window.localStorage)).toEqual(["trainoracle.training-content.saved.v1"])
  })
})
