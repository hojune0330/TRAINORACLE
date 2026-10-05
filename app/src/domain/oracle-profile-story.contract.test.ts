import { expect, it } from "vitest"
import { ORACLE_AXES, scoreOracleResponses } from "./oracle-profile-v2"
import { buildOracleProfileStory } from "./oracle-profile-story"
it("gives every axis a reading grounded only in its own answers", () => {
  for (const axis of ORACLE_AXES) for (const value of [1, 3, 5] as const) {
    const input = Object.fromEntries([1, 2, 3].map(i => [`${axis.id}_${i}`, value]))
    const score = scoreOracleResponses(input).find(item => item.axisId === axis.id)!
    const story = buildOracleProfileStory(score)
    expect(story.facts).toHaveLength(3)
    expect(story.reading).toContain(`${score.display}점`)
    expect(story.scope).toContain("따로 확인")
  }
})
it("does not invent missing answers or turn mixed answers into a personality", () => {
  expect(buildOracleProfileStory(scoreOracleResponses({})[0]!).facts).toEqual([])
  const mixed = buildOracleProfileStory(scoreOracleResponses({ CHALLENGE_1: 1, CHALLENGE_2: 5, CHALLENGE_3: 3 })[0]!)
  expect(mixed.title).toContain("다 담기지")
  expect(mixed.reading).toContain("추측하지")
})
