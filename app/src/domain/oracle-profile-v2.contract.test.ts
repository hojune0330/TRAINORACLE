import { describe, expect, it } from "vitest"
import {
  ORACLE_AXES, ORACLE_NON_NUMERIC, ORACLE_QUESTIONS, buildOracleProfile,
  describeOracleAxis, oracleResponsesSchema, scoreOracleResponses,
  type OracleResponses, type OracleAxisId,
} from "./oracle-profile-v2"

function answers(axis: OracleAxisId, values: number[]): OracleResponses {
  return Object.fromEntries(values.map((value, index) => [`${axis}_${index + 1}`, value])) as OracleResponses
}

describe("Oracle V2 self-response index (not a validated psychometric scale)", () => {
  it("defines exactly three original questions per axis with unique versioned identities", () => {
    expect(ORACLE_QUESTIONS).toHaveLength(24)
    expect(new Set(ORACLE_QUESTIONS.map(q => q.id)).size).toBe(24)
    for (const axis of ORACLE_AXES) expect(ORACLE_QUESTIONS.filter(q => q.axisId === axis.id)).toHaveLength(3)
  })

  for (const axis of ORACLE_AXES) {
    it(`${axis.id}: exhausts all 125 numeric combinations, boundaries and evidence`, () => {
      for (let a = 1; a <= 5; a++) for (let b = 1; b <= 5; b++) for (let c = 1; c <= 5; c++) {
        const input = answers(axis.id, [a, b, c])
        const result = scoreOracleResponses(input).find(s => s.axisId === axis.id)!
        expect(result.state).toBe("COMPLETE")
        expect(result.raw).toBeCloseTo((a + b + c - 3) * 100 / 12)
        expect(result.display).toBe(5 * Math.floor(((a + b + c - 3) * 100 / 12) / 5 + 0.5))
        expect(result.evidence.map(e => e.response)).toEqual([a, b, c])
        expect(result.mixed).toBe(Math.min(a, b, c) <= 2 && Math.max(a, b, c) >= 4)
        expect(scoreOracleResponses(structuredClone(input))).toEqual(scoreOracleResponses(input))
      }
    })
  }

  it("distinguishes zero, absent, skipped and nonnumeric evidence", () => {
    expect(scoreOracleResponses({})[0]).toMatchObject({ state: "UNANSWERED", display: null })
    expect(scoreOracleResponses(answers("CHALLENGE", [1, 1, 1]))[0]).toMatchObject({ state: "COMPLETE", display: 0 })
    for (const value of ORACLE_NON_NUMERIC) {
      const result = scoreOracleResponses({ CHALLENGE_1: 5, CHALLENGE_2: 5, CHALLENGE_3: value })[0]!
      expect(result).toMatchObject({ state: "PARTIAL", display: null, numericCount: 2 })
      expect(result.evidence[2]?.response).toBe(value)
    }
  })

  it("rejects V1 answers, raw notes, extra fields and coercible or invalid numbers", () => {
    for (const invalid of [null, [], { intensity: ["hard"] }, { memo: "private" }, { CHALLENGE_4: 5 },
      ...[0, 6, 2.5, NaN, Infinity, "5", null, undefined, true].map(value => ({ CHALLENGE_1: value }))]) {
      expect(oracleResponsesSchema.safeParse(invalid).success).toBe(false)
    }
  })

  it("retains mixed evidence even when its mean equals a uniform response", () => {
    const uniform = scoreOracleResponses(answers("CHALLENGE", [3, 3, 3]))[0]!
    const mixed = scoreOracleResponses(answers("CHALLENGE", [1, 3, 5]))[0]!
    expect(uniform.display).toBe(mixed.display)
    expect(describeOracleAxis(uniform)).not.toBe(describeOracleAxis(mixed))
  })

  it("handles all 64 candidate sets without ranking or deriving optional-axis characters", () => {
    const core = ORACLE_AXES.filter(axis => !axis.optional)
    for (let mask = 0; mask < 64; mask++) {
      let input: OracleResponses = { ...answers("SU", [5, 5, 5]), ...answers("WE", [5, 5, 5]) }
      const expected: string[] = []
      core.forEach((axis, index) => {
        if (mask & (1 << index)) { input = { ...input, ...answers(axis.id, [5, 5, 5]) }; expected.push(axis.id) }
      })
      const profile = buildOracleProfile(input)
      expect(profile.candidates.map(c => c.id)).toEqual(expected)
      expect(profile.representative.id).toBe(expected.length === 1 ? expected[0] : "NEUTRAL")
    }
  })

  it("preserves valid selection and does not silently replace an invalidated character", () => {
    const input = { ...answers("SOCIAL", [5, 5, 5]), ...answers("STRUCTURE", [5, 5, 5]) }
    expect(buildOracleProfile(input, "SOCIAL").representative?.id).toBe("SOCIAL")
    expect(buildOracleProfile(answers("STRUCTURE", [5, 5, 5]), "SOCIAL").representative.id).toBe("NEUTRAL")
    expect(buildOracleProfile(answers("SOCIAL", [2, 5, 5])).candidates).toEqual([])
    expect(buildOracleProfile(answers("SOCIAL", [4, 4, 4])).candidates.map(c => c.id)).toEqual(["SOCIAL"])
  })

  it("does not mutate caller answers or include prescription/ability claims", () => {
    const input = Object.freeze(answers("STRUCTURE", [4, 4, 4]))
    const result = buildOracleProfile(input)
    expect(result.completedAxes).toEqual(["STRUCTURE"])
    for (const field of ["prescription", "ability", "percentile", "asr", "cs"]) expect(result).not.toHaveProperty(field)
    expect(input).toEqual(answers("STRUCTURE", [4, 4, 4]))
  })

  it("freezes shared questions and preserves motivation as distinct from preference", () => {
    expect(Object.isFrozen(ORACLE_AXES)).toBe(true)
    expect(Object.isFrozen(ORACLE_QUESTIONS)).toBe(true)
    for (const axis of ORACLE_AXES) {
      expect(Object.isFrozen(axis)).toBe(true)
      expect(Object.isFrozen(axis.questions)).toBe(true)
    }
    for (const question of ORACLE_QUESTIONS) expect(Object.isFrozen(question)).toBe(true)
    expect(scoreOracleResponses({}).find(s => s.axisId === "REFRESH")?.concept).toBe("MOTIVATION")
    expect(scoreOracleResponses({}).find(s => s.axisId === "STRUCTURE")?.concept).toBe("PREFERENCE")
  })
})
