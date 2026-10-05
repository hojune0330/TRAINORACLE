import { describe, expect, it } from "vitest"
import {
  makeOracleProfileRevision, oracleProfileRevisionSchema, readOracleProfileReading, saveOracleProfileReading,
} from "./oracle-profile-snapshot"

const stamp = "2026-10-04T12:00:00.000Z"
const make = () => makeOracleProfileRevision({
  revision: 1, answeredAt: stamp, answers: { STRUCTURE_1: 5, STRUCTURE_2: 5, STRUCTURE_3: 5 },
  selectedCharacter: "STRUCTURE",
})

describe("Oracle response snapshot contract, not account authorization", () => {
  it("copies original evidence so later response edits do not rewrite saved scores", () => {
    const revision = make()
    const saved = saveOracleProfileReading(revision, stamp)
    revision.answers.STRUCTURE_1 = 1
    const historical = readOracleProfileReading(saved, { state: "READY", currentRevision: 2 })
    expect(historical.state).toBe("HISTORICAL")
    expect(historical.result?.scores.find(s => s.axisId === "STRUCTURE")?.display).toBe(100)
    expect(readOracleProfileReading(saved, { state: "READY", currentRevision: 1 }).state).toBe("CURRENT")
  })

  it("never returns a result while loading, failed, deleted or on a future revision", () => {
    const saved = saveOracleProfileReading(make(), stamp)
    for (const state of ["LOADING", "FAILED", "DELETED"] as const) {
      expect(readOracleProfileReading(saved, { state })).toEqual({ state, result: null })
    }
    for (const revision of [0, NaN, Infinity, 1.5]) {
      expect(readOracleProfileReading(saved, { state: "READY", currentRevision: revision }).result).toBeNull()
    }
    saved.source.revision = 3
    expect(readOracleProfileReading(saved, { state: "READY", currentRevision: 2 }).state).toBe("FAILED")
  })

  it("rejects arbitrary historical algorithms, private fields and unsupported characters", () => {
    const revision = make()
    for (const invalid of [
      { ...revision, questionVersion: "old" }, { ...revision, scoreVersion: "future" },
      { ...revision, selectedCharacter: "SOCIAL" }, { ...revision, selectedCharacter: "SU" },
      { ...revision, memo: "private" }, { ...revision, answers: { ...revision.answers, privateMemo: "private" } },
    ]) expect(oracleProfileRevisionSchema.safeParse(invalid).success).toBe(false)
    const saved = saveOracleProfileReading(revision, stamp)
    expect(readOracleProfileReading({ ...saved, source: { ...revision, scoreVersion: "future" } }, {
      state: "READY", currentRevision: 1,
    })).toEqual({ state: "UNSUPPORTED", result: null })
  })

  it("does not accept invalid chronology or mutate source on save", () => {
    const revision = make()
    expect(() => saveOracleProfileReading(revision, "2026-10-03T12:00:00.000Z")).toThrow()
    expect(() => makeOracleProfileRevision({ revision: 0, answeredAt: stamp, answers: {} })).toThrow()
    expect(() => makeOracleProfileRevision({ revision: 1, answeredAt: "not-a-date", answers: {} })).toThrow()
    expect(saveOracleProfileReading(revision, stamp).source).toEqual(revision)
  })

  it("does not auto-select a replacement when the saved selection is explicitly neutral", () => {
    const revision = makeOracleProfileRevision({ revision: 2, answeredAt: stamp,
      answers: { SOCIAL_1: 1, SOCIAL_2: 1, SOCIAL_3: 1, STRUCTURE_1: 5, STRUCTURE_2: 5, STRUCTURE_3: 5 },
      selectedCharacter: null,
    })
    const result = readOracleProfileReading(saveOracleProfileReading(revision, stamp), { state: "READY", currentRevision: 2 })
    expect(result.result?.candidates.map(c => c.id)).toEqual(["STRUCTURE"])
    expect(result.result?.representative.id).toBe("NEUTRAL")
  })
})
