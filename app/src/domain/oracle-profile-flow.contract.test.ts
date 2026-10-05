import { describe, expect, it } from "vitest"
import { ORACLE_AXES, ORACLE_NON_NUMERIC, oracleResponsesSchema, type OracleResponse } from "./oracle-profile-v2"
import {
  answerOracleQuestion, currentOracleQuestion, editOracleAxis, oracleFlowResult,
  previousOracleQuestion, startOracleQuestionFlow,
} from "./oracle-profile-flow"

describe("Oracle V2 question navigation", () => {
  it("takes three single taps to a scoped result without changing the character mid-group", () => {
    let flow = startOracleQuestionFlow()
    for (let n = 0; n < 3; n++) {
      expect(flow.position).toBe(n)
      expect(oracleFlowResult(flow).completedAxes).toEqual([])
      flow = answerOracleQuestion(flow, currentOracleQuestion(flow)!.id, 5)
    }
    expect(currentOracleQuestion(flow)).toBeNull()
    expect(oracleFlowResult(flow).completedAxes).toEqual(["STRUCTURE"])
    expect(oracleFlowResult(flow).representative?.id).toBe("STRUCTURE")
  })

  it("ignores a second tap for the old screen and keeps answers on back", () => {
    const before = startOracleQuestionFlow()
    const after = answerOracleQuestion(before, "STRUCTURE_1", 4)
    expect(answerOracleQuestion(after, "STRUCTURE_1", 5)).toBe(after)
    const back = previousOracleQuestion(after)
    expect(back.position).toBe(0)
    expect(back.draft.STRUCTURE_1).toBe(4)
    expect(before.draft).toEqual({})
  })

  it("resumes missing questions and allows explicit editing of completed axes", () => {
    const first = startOracleQuestionFlow({ STRUCTURE_1: 3 })
    expect(currentOracleQuestion(first)?.id).toBe("STRUCTURE_2")
    const finished = startOracleQuestionFlow({ STRUCTURE_1: 3, STRUCTURE_2: 4, STRUCTURE_3: 5 })
    expect(finished.position).toBe(3)
    expect(editOracleAxis(finished, "STRUCTURE").position).toBe(0)
  })

  it("resumes at question two after a same-value first answer in a new edit", () => {
    const original = { STRUCTURE_1: 5, STRUCTURE_2: 5, STRUCTURE_3: 5 } as const
    let flow = editOracleAxis(startOracleQuestionFlow(original), "STRUCTURE")
    expect(flow.completed).toEqual(original)
    expect(flow.draft).toEqual({})
    flow = answerOracleQuestion(flow, "STRUCTURE_1", 5)
    expect(startOracleQuestionFlow(flow.draft, "STRUCTURE").position).toBe(1)
    expect(flow.completed).toEqual(original)
  })

  it("completes navigation when skipped without generating a numeric result", () => {
    let flow = startOracleQuestionFlow()
    for (let n = 0; n < 3; n++) flow = answerOracleQuestion(flow, currentOracleQuestion(flow)!.id, "SKIPPED")
    expect(flow.position).toBe(3)
    expect(oracleFlowResult(flow).completedAxes).toEqual([])
    expect(oracleFlowResult(flow).representative.id).toBe("NEUTRAL")
  })

  it("finishing another axis does not publish an unfinished edit", () => {
    let flow = startOracleQuestionFlow({ STRUCTURE_1: 5, STRUCTURE_2: 5, STRUCTURE_3: 5 })
    flow = editOracleAxis(flow, "STRUCTURE")
    flow = answerOracleQuestion(flow, "STRUCTURE_1", 1)
    flow = editOracleAxis(flow, "SOCIAL")
    for (let n = 0; n < 3; n++) flow = answerOracleQuestion(flow, currentOracleQuestion(flow)!.id, 4)
    expect(flow.draft.STRUCTURE_1).toBe(1)
    expect(flow.completed.STRUCTURE_1).toBe(5)
    expect(oracleFlowResult(flow).scores.find(s => s.axisId === "STRUCTURE")?.display).toBe(100)
  })

  it("preserves schema and bounds across 30 seeded synthetic paths, not a human study", () => {
    const choices: OracleResponse[] = [1, 2, 3, 4, 5, ...ORACLE_NON_NUMERIC]
    for (let seed = 1; seed <= 30; seed++) {
      let random = seed
      const next = (n: number) => { random = (Math.imul(random, 1664525) + 1013904223) >>> 0; return random % n }
      let flow = startOracleQuestionFlow()
      for (let step = 0; step < 100; step++) {
        const action = next(4)
        if (action === 0) flow = previousOracleQuestion(flow)
        else if (action === 1) flow = editOracleAxis(flow, ORACLE_AXES[next(ORACLE_AXES.length)]!.id)
        else {
          const question = currentOracleQuestion(flow)
          if (question) flow = answerOracleQuestion(flow, question.id, choices[next(choices.length)]!)
        }
        expect(flow.position).toBeGreaterThanOrEqual(0)
        expect(flow.position).toBeLessThanOrEqual(3)
        expect(oracleResponsesSchema.safeParse(flow.draft).success).toBe(true)
        expect(oracleResponsesSchema.safeParse(flow.completed).success).toBe(true)
        expect(oracleFlowResult(flow)).toEqual(oracleFlowResult(structuredClone(flow)))
      }
    }
  })
})
