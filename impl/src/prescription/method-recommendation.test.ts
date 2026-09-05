import { describe, expect, it } from "vitest"
import { recommendMethods } from "./method-recommendation"
import type { MethodAssessment, MethodFamily, MethodHistoryEntry, MethodReference, RepeatPreference } from "./method-recommendation"
import type { PrescriptionSequence } from "./sequence"

// Synthetic arithmetic/ordering fixtures only. No training-dose or source acceptance.
const none = { mode: "NOT_APPLICABLE", seconds: null } as const
function sequence(distanceM: number, repeatCount = 3): PrescriptionSequence {
  return {
    kind: "PRESCRIPTION_SEQUENCE", version: 2, id: "synthetic", label: null,
    warmup: [], cooldown: [], terminalRecovery: none,
    main: [{ kind: "segment", id: "work", label: null, repeatCount, recoveryBetweenRepeats: none,
      recoveryAfter: none, work: { kind: "distance", distanceM, durationSeconds: null },
      target: { kind: "EFFORT_GUIDANCE", cue: "synthetic" } }],
  }
}
function family(familyId: string, distanceM: number, repeatCount = 3): MethodFamily {
  return { familyId, reviewRef: "SYNTHETIC-NOT-ACTIVATED", configurations: [{ configurationId: "base", version: "1", sequence: sequence(distanceM, repeatCount) }] }
}
const catalog = [family("a", 111), family("b", 222), family("c", 333)]
const ref = (familyId: string): MethodReference => ({ familyId, configurationId: "base", version: "1" })
const assessment = (familyId: string, eligibilityPriority = 0, purposePriority = 0, contextPriority = 0): MethodAssessment => ({
  ...ref(familyId), eligibility: "ELIGIBLE", eligibilityPriority, purposePriority, contextPriority,
})
const performed = (familyId: string): MethodHistoryEntry => ({ selected: null, performed: { status: "PERFORMED", method: ref(familyId) } })
function run(input: {
  catalog?: readonly MethodFamily[]
  assessments?: readonly MethodAssessment[]
  history?: readonly MethodHistoryEntry[]
  repeatPreference?: RepeatPreference
} = {}) {
  return recommendMethods({ catalog, assessments: [assessment("a"), assessment("b"), assessment("c")], history: [], repeatPreference: "NEUTRAL", ...input })
}
function recommended(input: Parameters<typeof run>[0] = {}) {
  const result = run(input)
  if (result.kind !== "recommended") throw new Error(result.code)
  return result
}
const ids = (values: readonly MethodReference[]) => values.map(value => value.familyId)

describe("synthetic method recommendations", () => {
  it("returns every eligible configuration and two distinct defaults in stable catalog order", () => {
    const result = recommended({ assessments: [assessment("c"), assessment("b"), assessment("a")] })
    expect(ids(result.eligible)).toEqual(["a", "b", "c"])
    expect(ids(result.defaults)).toEqual(["a", "b"])
    expect(recommended()).toEqual(result)
  })

  it("prioritizes eligibility, then purpose, then context before repeat history", () => {
    const assessments = [assessment("a", 1), assessment("b", 0, 1), assessment("c", 0, 0, 9)]
    expect(ids(recommended({ assessments, history: [performed("a"), performed("b")], repeatPreference: "PREFER_REPEAT" }).eligible)).toEqual(["c", "b", "a"])
    expect(ids(recommended({ assessments: [assessment("a", 0, 0, 1), assessment("b")], history: [performed("a")], repeatPreference: "PREFER_REPEAT" }).eligible)).toEqual(["b", "a"])
  })

  it("allows any family to lead without a fixed pair or random selection", () => {
    const input = { assessments: [assessment("a", 3), assessment("b", 2), assessment("c", 1)] }
    expect(ids(recommended(input).defaults)).toEqual(["c", "b"])
    expect(recommended(input)).toEqual(recommended(input))
  })

  it("uses all supplied performed history under an explicit repeat preference", () => {
    const history = [performed("b"), performed("b"), performed("b"), performed("b"), performed("a"), performed("a"), performed("a")]
    expect(ids(recommended({ history, repeatPreference: "PREFER_REPEAT" }).eligible)).toEqual(["b", "a", "c"])
    expect(ids(recommended({ history, repeatPreference: "PREFER_VARIETY" }).eligible)).toEqual(["c", "a", "b"])
    expect(ids(recommended({ history }).eligible)).toEqual(["a", "b", "c"])
  })

  it("keeps selected, actual performed, missing and explicit non-performance separate", () => {
    const history: MethodHistoryEntry[] = [
      { selected: ref("a"), performed: { status: "MISSING" } },
      { selected: ref("a"), performed: { status: "NOT_PERFORMED" } },
      { selected: ref("a"), performed: { status: "PERFORMED", method: ref("b") } },
    ]
    const result = recommended({ history, repeatPreference: "PREFER_REPEAT" })
    expect(ids(result.eligible)).toEqual(["b", "a", "c"])
    expect(result.eligible.find(item => item.familyId === "a")).toMatchObject({ observedPerformedCount: 0, selectedCount: 3 })
    expect(result.historyCoverage).toEqual({ entries: 3, missing: 1, notPerformed: 1 })
  })

  it("uses family history across old configuration versions without fabricating current configuration exposure", () => {
    const history: MethodHistoryEntry[] = [{ selected: null, performed: { status: "PERFORMED", method: { ...ref("b"), version: "retired" } } }]
    expect(ids(recommended({ history, repeatPreference: "PREFER_REPEAT" }).defaults)).toEqual(["b", "a"])
  })

  it("does not treat multiple configurations in one family as two methods", () => {
    const first = family("a", 111)
    const local = [{ ...first, configurations: [...first.configurations, { configurationId: "split", version: "1", sequence: sequence(444) }] }, family("b", 222)]
    const result = recommended({ catalog: local, assessments: [assessment("a"), { ...assessment("a"), configurationId: "split" }, assessment("b")] })
    expect(result.eligible).toHaveLength(3)
    expect(ids(result.defaults)).toEqual(["a", "b"])
  })

  it("rejects fake diversity from independent labels and count-only changes", () => {
    const result = recommended({ catalog: [family("a", 111, 1), family("b", 111, 9), family("c", 333)] })
    expect(ids(result.eligible)).toEqual(["a", "b", "c"])
    expect(ids(result.defaults)).toEqual(["a", "c"])
    expect(ids(recommended({ catalog: [family("a", 111, 1), family("b", 111, 9)], assessments: [assessment("a"), assessment("b")] }).defaults)).toEqual(["a"])
  })

  it("returns one or zero without inventing a second method; missing assessment is not eligible", () => {
    expect(ids(recommended({ assessments: [assessment("c")] }).defaults)).toEqual(["c"])
    expect(recommended({ assessments: [] }).eligible).toEqual([])
    expect(recommended({ assessments: [{ ...ref("a"), eligibility: "INELIGIBLE", reasonCode: "SYNTHETIC_BLOCK" }] }).defaults).toEqual([])
  })

  it("fails closed for duplicate IDs, unknown references, invalid sequence and nonfinite priorities", () => {
    expect(run({ catalog: [family("a", 111), family("a", 222)] })).toEqual({ kind: "rejected", code: "INVALID_CATALOG" })
    expect(run({ assessments: [assessment("unknown")] })).toEqual({ kind: "rejected", code: "INVALID_ASSESSMENTS" })
    expect(run({ assessments: [assessment("a"), assessment("a")] })).toEqual({ kind: "rejected", code: "INVALID_ASSESSMENTS" })
    expect(run({ assessments: [assessment("a", NaN)] })).toEqual({ kind: "rejected", code: "INVALID_ASSESSMENTS" })
    expect(run({ catalog: [family("a", -1)] })).toEqual({ kind: "rejected", code: "INVALID_CATALOG" })
  })

  it("returns detached frozen sequences without changing input or resolving unknown durations", () => {
    const source = JSON.stringify(catalog)
    const result = recommended()
    expect(JSON.stringify(catalog)).toBe(source)
    expect(result.eligible[0]?.sequence).not.toBe(catalog[0]?.configurations[0]?.sequence)
    expect(Object.isFrozen(result.eligible[0]?.sequence.main)).toBe(true)
    expect(result.eligible[0]?.sequence.main[0]).toMatchObject({ work: { durationSeconds: null } })
  })
})
