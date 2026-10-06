import { expect, it } from "vitest"
import { ORACLE_CONTEXT_QUESTIONS, oracleProfileContextSchema } from "./oracle-profile-context"

const empty = { version: "ORACLE_CONTEXT_V1", answeredAt: "2026-10-04T00:00:00Z", answers: {}, conditions: {} }
it("keeps unanswered context empty rather than zero or a fabricated preference", () => {
  expect(oracleProfileContextSchema.parse(empty)).toEqual(empty)
  expect(oracleProfileContextSchema.safeParse({ ...empty, conditions: { availableMinutes: 0 } }).success).toBe(true)
})
it("accepts every shown choice in its declared field", () => {
  for (const q of ORACLE_CONTEXT_QUESTIONS) for (const [value] of q.options) {
    expect(oracleProfileContextSchema.safeParse({ ...empty, answers: { [q.id]: q.multiple ? [value] : value } }).success, `${q.id}:${value}`).toBe(true)
  }
})
it("rejects arbitrary free text, duplicated choices and invalid times", () => {
  for (const payload of [
    { ...empty, memo: "PRIVATE" }, { ...empty, answers: { note: "PRIVATE" } },
    { ...empty, answers: { motivations: ["RECORD", "RECORD"] } },
    { ...empty, conditions: { availableMinutes: -1 } },
    { ...empty, conditions: { meetingWindows: [{ date: "2026-10-04", startMinute: 700, endMinute: 600 }] } },
    { ...empty, conditions: { events: [{ id: "a", date: "2026-02-30" }] } },
  ]) expect(oracleProfileContextSchema.safeParse(payload).success).toBe(false)
})
it("does not interpret an unknown answer as lack of experience", () => {
  const parsed = oracleProfileContextSchema.parse({ ...empty, answers: { supplementaryExperience: "UNKNOWN" } })
  expect(parsed.answers.supplementaryExperience).toBe("UNKNOWN")
  expect(parsed.answers.supplementaryInterest).toBeUndefined()
})
it("rejects duplicated conditions and contradictory equipment before storage", () => {
  const race = { recordId: "race-1", weather: "RAIN" }
  const event = { id: "event-1", date: "2026-10-04", cost: { amount: 20000, currency: "KRW" } }
  const meeting = { date: "2026-10-04", startMinute: 540, endMinute: 600 }
  for (const conditions of [
    { races: [race, race] }, { events: [event, event] }, { meetingWindows: [meeting, meeting] },
    { equipment: ["NONE", "WEIGHTS"] },
  ]) expect(oracleProfileContextSchema.safeParse({ ...empty, conditions }).success).toBe(false)
})
