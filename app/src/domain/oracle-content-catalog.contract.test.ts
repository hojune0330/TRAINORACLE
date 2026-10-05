import { describe, expect, it } from "vitest"
import { ORACLE_CONTENT_CATALOG, oracleContentTopic } from "./oracle-content-catalog"

describe("Oracle 56-topic editorial registry, not completed personalized delivery", () => {
  it("preserves exactly the approved group IDs without duplicates", () => {
    const expected = Object.entries({ A: 8, B: 7, C: 7, D: 8, E: 6, F: 8, G: 6, H: 6 })
      .flatMap(([group, count]) => Array.from({ length: count }, (_, index) => `${group}${String(index + 1).padStart(2, "0")}`))
    expect(ORACLE_CONTENT_CATALOG.map(topic => topic.id)).toEqual(expected)
    expect(new Set(ORACLE_CONTENT_CATALOG.map(topic => topic.id)).size).toBe(56)
    expect(oracleContentTopic("X01")).toBeNull()
  })
  it("keeps explanations, boundaries and intents without implying activation", () => {
    expect(Object.isFrozen(ORACLE_CONTENT_CATALOG)).toBe(true)
    for (const topic of ORACLE_CONTENT_CATALOG) {
      expect(topic.title.length).toBeGreaterThan(0)
      expect(topic.explanation.length).toBeGreaterThan(0)
      expect(topic.limitation.length).toBeGreaterThan(0)
      expect(topic.requiredEvidence.length).toBeGreaterThan(0)
      expect(topic.personalizedRendererReady).toBe(false)
      expect(Object.isFrozen(topic)).toBe(true)
      expect(Object.isFrozen(topic.requiredEvidence)).toBe(true)
      expect(oracleContentTopic(topic.id)).toBe(topic)
    }
  })
  it("requires friend consent independently of external sharing and keeps education separate", () => {
    for (const topic of ORACLE_CONTENT_CATALOG.filter(t => t.group === "E" && t.id !== "E06")) {
      expect(topic.requiredEvidence).toContain("FRIEND_CONSENT")
    }
    expect(oracleContentTopic("E06")?.requiredEvidence).toEqual(["SHARE_CONSENT"])
    expect(ORACLE_CONTENT_CATALOG.filter(t => t.group === "H").every(t => t.kind === "EDUCATION")).toBe(true)
  })
})
