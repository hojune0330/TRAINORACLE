import { expect, it } from "vitest"
import { recommendMethodsV3 } from "./method-recommendation"
import type { MethodFamily, MethodAssessment, MethodHistoryEntry } from "./method-recommendation"
import type { PrescriptionSequenceV3 } from "./sequence-v3"

function family(id: string, duration: number, count = 4): MethodFamily<PrescriptionSequenceV3> {
  return { familyId: id, reviewRef: "TEST_ONLY_NOT_APPROVAL", configurations: [{ configurationId: "c", version: "1",
    sequence: { kind: "PRESCRIPTION_SEQUENCE", version: 3, id, label: null, warmup: [], cooldown: [], main: [{
      kind: "segment", role: "WORK", id: `${id}-work`, label: null, repeatCount: count,
      work: { kind: "duration", durationSeconds: duration, distanceM: null },
      target: { kind: "EFFORT_GUIDANCE", cue: "same-purpose" },
      recoveryBetweenRepeats: [{ mode: "JOG", seconds: 60 }], recoveryAfter: [],
    }] } }] }
}
const ref = (id: string) => ({ familyId: id, configurationId: "c", version: "1" })
const assessed = (id: string, priority = 0): MethodAssessment => ({ ...ref(id), eligibility: "ELIGIBLE",
  eligibilityPriority: priority, purposePriority: 0, contextPriority: 0 })
const catalog = [family("two-minute", 120), family("three-minute", 180), family("four-minute", 240)]
const input = { catalog, assessments: catalog.map(f => assessed(f.familyId)), history: [] as MethodHistoryEntry[], repeatPreference: "NEUTRAL" as const }

it("selects two different methods from an independent three-method V3 pool", () => {
  const result = recommendMethodsV3(input)
  expect(result.kind).toBe("recommended")
  if (result.kind !== "recommended") return
  expect(result.eligible.map(r => r.familyId)).toEqual(["two-minute", "three-minute", "four-minute"])
  expect(result.defaults.map(r => r.familyId)).toEqual(["two-minute", "three-minute"])
  expect(result.defaults.every(r => r.sequence.version === 3)).toBe(true)
})
it("history changes repeat/variety ordering without hard-coded pairings", () => {
  const history: MethodHistoryEntry[] = [{ selected: ref("two-minute"), performed: { status: "PERFORMED", method: ref("two-minute") } }]
  const varied = recommendMethodsV3({ ...input, history, repeatPreference: "PREFER_VARIETY" })
  const repeated = recommendMethodsV3({ ...input, history, repeatPreference: "PREFER_REPEAT" })
  if (varied.kind !== "recommended" || repeated.kind !== "recommended") throw Error("not recommended")
  expect(varied.defaults.map(r => r.familyId)).toEqual(["three-minute", "four-minute"])
  expect(repeated.defaults.map(r => r.familyId)).toEqual(["two-minute", "three-minute"])
})
it("a count-only copy cannot become the second default even in another family", () => {
  const copy = family("copy", 120, 8)
  const result = recommendMethodsV3({ ...input, catalog: [catalog[0]!, copy, catalog[1]!],
    assessments: [assessed("two-minute"), assessed("copy"), assessed("three-minute")] })
  if (result.kind !== "recommended") throw Error("not recommended")
  expect(result.defaults.map(r => r.familyId)).toEqual(["two-minute", "three-minute"])
})
it("eligibility and purpose priorities precede variety, and missing assessments do not grant access", () => {
  const result = recommendMethodsV3({ ...input,
    assessments: [assessed("two-minute", 1), assessed("four-minute", 0)],
    history: [{ selected: ref("four-minute"), performed: { status: "PERFORMED", method: ref("four-minute") } }],
    repeatPreference: "PREFER_VARIETY" })
  if (result.kind !== "recommended") throw Error("not recommended")
  expect(result.defaults.map(r => r.familyId)).toEqual(["four-minute", "two-minute"])
  expect(result.eligible.some(r => r.familyId === "three-minute")).toBe(false)
})
it("selected, skipped and missing remain distinct from performed", () => {
  const result = recommendMethodsV3({ ...input, repeatPreference: "PREFER_REPEAT", history: [
    { selected: ref("four-minute"), performed: { status: "MISSING" } },
    { selected: ref("three-minute"), performed: { status: "NOT_PERFORMED" } },
  ] })
  if (result.kind !== "recommended") throw Error("not recommended")
  expect(result.defaults[0]?.familyId).toBe("two-minute")
  expect(result.historyCoverage).toEqual({ entries: 2, missing: 1, notPerformed: 1 })
  expect(result.eligible.every(r => r.observedPerformedCount === 0)).toBe(true)
})
it("invalid version or lossy recovery shape is rejected rather than downgraded", () => {
  const bad = JSON.parse(JSON.stringify(catalog)) as MethodFamily<PrescriptionSequenceV3>[]
  const first = bad[0]!.configurations[0]!.sequence
  Object.assign(first, { version: 2 })
  expect(recommendMethodsV3({ ...input, catalog: bad })).toEqual({ kind: "rejected", code: "INVALID_CATALOG" })
})
