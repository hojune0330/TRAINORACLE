import { describe, expect, it } from "vitest"
import { PROFILE_QUESTIONS, describeRunningPreferences, runningProfileAnswersSchema, toggleProfileAnswer, type RunningProfileAnswers } from "./running-profile"
import { accountRunningProfileDocumentSchema } from "./account/account-running-profile-schema"
import { validateAccountStateDocument, validateAccountStateDocumentUpdate } from "./account/account-state-schema"

describe("running profile descriptive contract", () => {
  it("keeps missing, unknown and not interested separate without inventing scores", () => {
    const result = describeRunningPreferences({ intensity: ["unknown"], weights: ["none"] })
    expect(result.rows.find(row => row.id === "intensity")?.status).toBe("UNKNOWN")
    expect(result.rows.find(row => row.id === "weights")?.status).toBe("ANSWERED")
    expect(result.rows.find(row => row.id === "events")?.status).toBe("UNANSWERED")
    expect(result.answeredCount).toBe(2)
    expect(result).not.toHaveProperty("score")
    expect(result).not.toHaveProperty("prescription")
  })
  it("replaces exclusive answers instead of accumulating contradictory selections", () => {
    let answers = toggleProfileAnswer({}, "motives", "record")
    answers = toggleProfileAnswer(answers, "motives", "health")
    expect(answers.motives).toEqual(["record", "health"])
    answers = toggleProfileAnswer(answers, "motives", "unknown")
    expect(answers.motives).toEqual(["unknown"])
    answers = toggleProfileAnswer(answers, "motives", "friends")
    expect(answers.motives).toEqual(["friends"])
  })
  it("rejects unknown fields, duplicates and forged physiological answers", () => {
    for (const input of [{ memo: "private" }, { intensity: ["hard", "easy"] }, { motives: ["record", "record"] },
      { weights: ["none", "equipment"] }, { events: ["100"] }, { asr: 99 }, { motives: ["unknown", "record"] }]) {
      expect(runningProfileAnswersSchema.safeParse(input).success).toBe(false)
    }
  })
  it("uses catalog order and keeps every selected answer in the detail", () => {
    let answers: RunningProfileAnswers = {}
    for (const option of [...PROFILE_QUESTIONS[0]!.options].reverse().filter(o => o.id !== "unknown")) answers = toggleProfileAnswer(answers, "motives", option.id)
    expect(answers.motives).toEqual(["record", "health", "refresh", "friends", "explore"])
    expect(describeRunningPreferences(answers).rows[0]?.text).toContain("새로운 코스")
    expect(describeRunningPreferences(answers).title.length).toBeLessThan(40)
  })
  it("accepts only the profile document and prevents cross-kind updates", () => {
    const doc = { version: 3, state: "ACCOUNT_STATE", kind: "RUNNING_PROFILE", data: { version: "RUNNING_PROFILE_V1", answeredAt: "2026-10-04T00:00:00.000Z", answers: { motives: ["health"] } } }
    expect(accountRunningProfileDocumentSchema.safeParse(doc).success).toBe(true)
    expect(validateAccountStateDocument(doc)).toBe(true)
    expect(validateAccountStateDocumentUpdate(doc, doc)).toBe(true)
    expect(validateAccountStateDocumentUpdate(doc, { ...doc, kind: "ATHLETE_RECORDS" })).toBe(false)
    expect(accountRunningProfileDocumentSchema.safeParse({ ...doc, data: { ...doc.data, memo: "private" } }).success).toBe(false)
  })
  it("survives 30 seeded synthetic journeys with 80 random answer edits each", () => {
    for (let seed = 1; seed <= 30; seed++) {
      let state = seed, answers: RunningProfileAnswers = {}
      const next = (n: number) => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state % n }
      for (let step = 0; step < 80; step++) {
        const q = PROFILE_QUESTIONS[next(PROFILE_QUESTIONS.length)]!
        answers = toggleProfileAnswer(answers, q.id, q.options[next(q.options.length)]!.id)
        expect(runningProfileAnswersSchema.safeParse(answers).success).toBe(true)
        expect(describeRunningPreferences(answers)).toEqual(describeRunningPreferences(structuredClone(answers)))
      }
    }
  })
})
