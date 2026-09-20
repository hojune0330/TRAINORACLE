import { describe, expect, it } from "vitest"
import { getOracleTopic, isOracleTopicId, ORACLE_TOPICS, type OracleTopicId } from "./oracle-exploration"

describe("oracle exploration topics", () => {
  it("offers the six distinct approved topics and resolves each by its own id", () => {
    const ids = ORACLE_TOPICS.map((topic) => topic.id)

    expect(ids).toEqual(["level", "focus", "compare", "mix", "priority", "change"])
    expect(new Set(ids).size).toBe(6)
    for (const topic of ORACLE_TOPICS) {
      expect(getOracleTopic(topic.id)).toBe(topic)
      expect(isOracleTopicId(topic.id)).toBe(true)
    }
  })

  it("connects every follow-up to another topic in one complete exploration loop", () => {
    const visited = new Set<OracleTopicId>()
    let current: OracleTopicId = "level"

    for (let step = 0; step < ORACLE_TOPICS.length; step += 1) {
      expect(visited.has(current)).toBe(false)
      visited.add(current)
      const topic = getOracleTopic(current)
      expect(isOracleTopicId(topic.nextId)).toBe(true)
      expect(topic.nextId).not.toBe(topic.id)
      current = topic.nextId
    }

    expect(current).toBe("level")
    expect(visited.size).toBe(6)
  })

  it("rejects inherited keys, aliases and malformed restored navigation values", () => {
    const rejected: unknown[] = [
      "__proto__", "prototype", "constructor", "toString", "hasOwnProperty", "valueOf",
      "LEVEL", " level", "level ", "level/compare", "current-level", "", "unknown",
      null, undefined, 0, false, {}, ["level"], new String("level"),
    ]

    for (const value of rejected) {
      expect(isOracleTopicId(value), String(value)).toBe(false)
    }
  })

  it("labels every example as fictional and leaves the priority goal unquantified", () => {
    for (const topic of ORACLE_TOPICS) {
      expect(topic.example.source).toContain("가상")
      for (const row of topic.example.rows) {
        expect(Number.isFinite(row.value)).toBe(true)
        expect(row.value).toBeGreaterThan(0)
        expect(row.valueLabel.length).toBeGreaterThan(0)
      }
    }
    expect(getOracleTopic("priority").example.rows).toEqual([])
    expect(getOracleTopic("priority").example.unit).toBe("")
  })
})
