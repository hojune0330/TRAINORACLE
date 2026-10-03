import { describe, expect, it } from "vitest"
import {
  PACE_EVENT_METERS,
  canonicalPaceDistance,
  catalogRecordPaceModel,
  formatPaceSeconds,
  isSegmentPaceReference,
  paceReferenceRange,
  predictRaceFromActual,
  raceAverageSeconds,
  validPaceDate,
} from "@impl/prescription/record-pace"
import type { SegmentPaceReference } from "@impl/prescription/record-pace"

const EVENTS = [800, 1500, 3000, 5000, 10000, 21097.5, 42195] as const
function reference(overrides: Partial<SegmentPaceReference> = {}): SegmentPaceReference {
  return {
    segmentId: "part-0", kind: "ACTUAL", recordId: "record-800",
    recordVersion: "2026-10-02T00:00:00.000Z", eventDistanceM: 800,
    performanceSeconds: 121.5, achievedOn: "2026-10-01", evaluatedOn: "2026-10-02",
    confirmed: true, model: "RACE_AVERAGE_V1", ...overrides,
  }
}

describe("record pace arithmetic and display", () => {
  it("preserves raw 30.375 seconds and rounds only the displayed value", () => {
    const raw = raceAverageSeconds(121.5, 800, 200)
    expect(raw).toBe(30.375)
    expect(formatPaceSeconds(raw ?? NaN)).toBe("30.4\uCD08")
    expect(raw).toBe(30.375)
    expect(paceReferenceRange(reference())).toEqual({ minimum: 151.875, maximum: 151.875 })
  })

  it.each([0, 1] as const)("carries 59.999 into the next minute at %i decimals", (decimals) => {
    expect(formatPaceSeconds(59.999, decimals)).toBe("1\uBD84 0\uCD08")
    expect(formatPaceSeconds(119.999, decimals)).toBe("2\uBD84 0\uCD08")
  })

  it.each([-1, NaN, Infinity, -Infinity])("never formats invalid seconds %s as a pace", (seconds) => {
    expect(formatPaceSeconds(seconds)).toBe("\uD655\uC778 \uD544\uC694")
  })

  it("declares exactly the seven approved canonical event distances", () => {
    expect(PACE_EVENT_METERS).toEqual(EVENTS)
  })

  it.each(EVENTS)("calculates raw race average for %s meters", (eventDistanceM) => {
    expect(canonicalPaceDistance(eventDistanceM)).toBe(eventDistanceM)
    expect(raceAverageSeconds(eventDistanceM * 0.25, eventDistanceM, 200)).toBe(50)
    expect(raceAverageSeconds(eventDistanceM * 0.25, eventDistanceM, 60)).toBe(15)
    const source = reference({ eventDistanceM, performanceSeconds: eventDistanceM * 0.25 })
    expect(isSegmentPaceReference(source)).toBe(true)
    expect(paceReferenceRange(source)).toEqual({ minimum: 250, maximum: 250 })
  })

  it("treats legacy 21097 as exactly 21097.5, not a separate event or rounded divisor", () => {
    expect(canonicalPaceDistance(21097)).toBe(21097.5)
    expect(raceAverageSeconds(4219.5, 21097, 1000)).toBe(200)
    expect(raceAverageSeconds(4219.5, 21097.5, 1000)).toBe(200)
    expect(paceReferenceRange(reference({ eventDistanceM: 21097, performanceSeconds: 4219.5 })))
      .toEqual({ minimum: 200, maximum: 200 })
    expect(raceAverageSeconds(4219.5, 21098, 1000)).toBeNull()
  })

  it.each([
    [0, 800, 200], [-1, 800, 200], [NaN, 800, 200], [Infinity, 800, 200],
    [121.5, 400, 200], [121.5, 0, 200], [121.5, NaN, 200],
    [121.5, 800, 59.999], [121.5, 800, 0], [121.5, 800, NaN], [121.5, 800, Infinity],
    [Number.MAX_VALUE, 800, Number.MAX_VALUE],
  ])("rejects invalid or under-60m arithmetic (%s, %s, %s)", (seconds, event, segment) => {
    expect(raceAverageSeconds(seconds, event, segment)).toBeNull()
  })
})

describe("record reference provenance", () => {
  it("retains actual versus goal identity even when the numerical race average is identical", () => {
    const actual = reference()
    const goal = reference({ kind: "GOAL", achievedOn: null })
    expect(isSegmentPaceReference(actual)).toBe(true)
    expect(isSegmentPaceReference(goal)).toBe(true)
    expect(paceReferenceRange(actual)).toEqual(paceReferenceRange(goal))
    expect(actual.kind).toBe("ACTUAL")
    expect(goal.kind).toBe("GOAL")
    expect(isSegmentPaceReference(reference({ kind: "GOAL" }))).toBe(false)
  })

  it("allows undated actual sources without inventing an achievement date", () => {
    const undated = reference({ achievedOn: null })
    expect(isSegmentPaceReference(undated)).toBe(true)
    expect(paceReferenceRange(undated)).toEqual({ minimum: 151.875, maximum: 151.875 })
    expect(undated.achievedOn).toBeNull()
  })

  it("keeps the explicit 5K threshold range separate from race average", () => {
    const source = reference({ eventDistanceM: 5000, performanceSeconds: 1000, model: "FIVE_K_THRESHOLD_V1" })
    expect(isSegmentPaceReference(source)).toBe(true)
    expect(paceReferenceRange(source)?.minimum).toBeCloseTo(214.912908613696, 9)
    expect(paceReferenceRange(source)?.maximum).toBeCloseTo(218.64113576712, 9)
    expect(paceReferenceRange({ ...source, model: "RACE_AVERAGE_V1" })).toEqual({ minimum: 200, maximum: 200 })
    expect(isSegmentPaceReference({ ...source, eventDistanceM: 10000 })).toBe(false)
  })

  it.each([
    { confirmed: false }, { recordId: "" }, { recordVersion: "not-a-date" },
    { performanceSeconds: NaN }, { performanceSeconds: 86401 }, { eventDistanceM: 400 },
    { achievedOn: "2026-10-03" }, { achievedOn: "2026-02-29" },
    { evaluatedOn: "2026-04-31" }, { model: "PREDICTION" }, { kind: "PREDICTION" },
    { sourceText: "unexpected field" },
  ])("rejects unconfirmed, malformed, or extra reference fields: %j", (overrides) => {
    const malformed = { ...reference(), ...overrides }
    expect(isSegmentPaceReference(malformed)).toBe(false)
    // Exercise the runtime boundary for malformed persisted input as well as the type guard.
    expect(paceReferenceRange(malformed as SegmentPaceReference)).toBeNull()
  })

  it.each([null, undefined, 123, "2026-2-01", "2026-02-29", "1900-02-29", "2026-04-31", "2026-10-02T00:00:00Z"])("rejects invalid calendar value %s", (date) => {
    expect(validPaceDate(date)).toBe(false)
  })

  it.each(["2024-02-29", "2000-02-29", "2026-04-30", "2026-10-02"])("accepts calendar date %s", (date) => {
    expect(validPaceDate(date)).toBe(true)
  })
})

describe("catalog model authority is narrower than race-average arithmetic", () => {
  it("allows only the existing 5K LT and VO2 model pairings", () => {
    expect(catalogRecordPaceModel("LT", 5000)).toBe("FIVE_K_THRESHOLD_V1")
    expect(catalogRecordPaceModel("VO2", 5000)).toBe("RACE_AVERAGE_V1")
  })

  it.each([800, 1500, 3000, 10000, 21097, 21097.5, 42195])("rejects source-event mutation to %s even though average arithmetic exists", (event) => {
    expect(raceAverageSeconds(1000, event, 200)).not.toBeNull()
    expect(catalogRecordPaceModel("LT", event)).toBeNull()
    expect(catalogRecordPaceModel("VO2", event)).toBeNull()
  })

  it.each(["GLY", "MIX", "MIXED", "STEADY", "BASE", "REC", "ATP-PC", "ATP_PC", "TECHNIQUE", "UNKNOWN"])("does not authorize a 5K reference for %s", (intent) => {
    expect(catalogRecordPaceModel(intent, 5000)).toBeNull()
  })
})

describe("comparison predictions cannot become actual sources", () => {
  const actual = { kind: "ACTUAL" as const, recordId: "actual-5k", eventDistanceM: 5000, performanceSeconds: 1000 }

  it("returns labeled Riegel comparison, original identity, and no prescription authority", () => {
    const result = predictRaceFromActual(actual, 10000)
    expect(result).toMatchObject({ kind: "PREDICTION", model: "RIEGEL_1_06_V1", sourceRecordId: "actual-5k", sourceDistanceM: 5000, targetDistanceM: 10000, prescriptionEligible: false })
    expect(result?.seconds).toBeCloseTo(2084.931521682243, 9)
    expect(result?.limitation).toBeTruthy()
    expect(result).not.toHaveProperty("recordId")
  })

  it("rejects chaining a prediction or a goal, at type and runtime boundaries", () => {
    const predicted = predictRaceFromActual(actual, 10000)
    if (predicted === null) throw Error("Positive prediction control failed")
    // @ts-expect-error A prediction is deliberately not an actual input record.
    expect(predictRaceFromActual(predicted, 42195)).toBeNull()
    // @ts-expect-error A goal is not an actual performance.
    expect(predictRaceFromActual({ ...actual, kind: "GOAL" }, 10000)).toBeNull()
    expect(isSegmentPaceReference({ ...reference(), ...predicted })).toBe(false)
  })

  it.each(EVENTS.filter((event) => event !== 5000))("compares an actual to supported target %s", (target) => {
    expect(predictRaceFromActual(actual, target)).toMatchObject({ targetDistanceM: target, prescriptionEligible: false })
  })

  it("normalizes half aliases for source and target and rejects self-prediction", () => {
    expect(predictRaceFromActual(actual, 21097)).toEqual(predictRaceFromActual(actual, 21097.5))
    expect(predictRaceFromActual({ ...actual, eventDistanceM: 21097 }, 10000))
      .toEqual(predictRaceFromActual({ ...actual, eventDistanceM: 21097.5 }, 10000))
    expect(predictRaceFromActual({ ...actual, eventDistanceM: 21097 }, 21097.5)).toBeNull()
    expect(predictRaceFromActual(actual, 5000)).toBeNull()
    expect(predictRaceFromActual(actual, 400)).toBeNull()
  })

  it.each([0, -1, NaN, Infinity, 86400.001, 86401])("rejects invalid actual performance %s", (performanceSeconds) => {
    expect(predictRaceFromActual({ ...actual, performanceSeconds }, 10000)).toBeNull()
  })

  it("accepts the exact 86400-second source boundary without treating it as an output cap", () => {
    const result = predictRaceFromActual({ ...actual, performanceSeconds: 86400 }, 10000)
    expect(result).not.toBeNull()
    expect(Number.isFinite(result?.seconds)).toBe(true)
    expect(result?.seconds).toBeGreaterThan(86400)
    expect(result?.prescriptionEligible).toBe(false)
  })

  it("rejects prediction overflow rather than returning infinite seconds", () => {
    expect(predictRaceFromActual({ ...actual, performanceSeconds: Number.MAX_VALUE }, 42195)).toBeNull()
  })
})
