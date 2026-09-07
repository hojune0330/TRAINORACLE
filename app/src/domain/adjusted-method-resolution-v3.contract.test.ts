import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { projectLegacyPaceSourceV3, resolveAdjustedMethodPrescriptionV3 } from "./adjusted-method-resolution-v3"
import { adjustedMethodResolutionV3Fixture as fixture } from "./adjusted-method-resolution-v3.test-fixtures"
import { RUNTIME_CASES, TODAY } from "./prescription-quality-matrix.test-fixtures"
import { setActiveLocalAccount } from "./account/local-journal-ownership"

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null); vi.useFakeTimers(); vi.setSystemTime(TODAY) })
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

it.each(RUNTIME_CASES.slice(0, 4))("$eventDistanceM connects a generated legacy plan to V3 with exact fractional targets", event => {
  const input = fixture(event), before = JSON.stringify(input)
  const result = resolveAdjustedMethodPrescriptionV3(input)
  if (result.kind !== "resolved") throw Error(result.code)
  const bridge = projectLegacyPaceSourceV3(input.original)
  if (bridge.kind !== "projected") throw Error(bridge.code)
  expect(result.projection.segmentTargets[0]).toMatchObject({ role: "WORK", distanceM: 200,
    targetRepSeconds: input.original.selectedAnchor.performanceSeconds * 200 / event.eventDistanceM,
    secondsPerKm: input.original.selectedAnchor.performanceSeconds * 1000 / event.eventDistanceM })
  const target = result.projection.segmentTargets[0]!.targetRepSeconds!
  expect(target).not.toBe(Math.round(target))
  expect(result.projection.sequence.warmup).toEqual(bridge.support.warmup)
  expect(result.projection.sequence.cooldown).toEqual(bridge.support.cooldown)
  expect(result.projection.structuralTotals.main).toMatchObject({ workDistanceM: 1200,
    knownRecoveryDistanceM: 400, knownRecoverySeconds: 310, recoverySeconds: null })
  expect(result.projection.structuralTotals.warmup.preparationSeconds).toBe(980)
  expect(result.projection.structuralTotals.cooldown.preparationSeconds).toBe(600)
  expect(result).toMatchObject({ executionAuthority: "NONE", projection: { schemaVersion: 3, stage: "CANDIDATE_PROJECTION_ONLY" } })
  expect(JSON.stringify(input)).toBe(before)
})

it("time work keeps its exact duration without inventing a covered distance", () => {
  const result = resolveAdjustedMethodPrescriptionV3(fixture(undefined, { kind: "duration", durationSeconds: 90, distanceM: null }))
  if (result.kind !== "resolved") throw Error(result.code)
  expect(result.projection.segmentTargets[0]).toMatchObject({ targetRepSeconds: null, fixedWorkSeconds: 90, distanceM: null })
  expect(result.projection.structuralTotals.main).toMatchObject({ workSeconds: 540, workDistanceM: null })
})

it("mixed buildup and sprint-reference work retain roles without made-up race-pace targets", () => {
  const input = fixture(undefined, undefined, sequence => {
    const group = sequence.main[0]!
    if (group.kind !== "group" || group.children[0]!.kind !== "segment") throw Error("fixture")
    const work = group.children[0]!
    return { ...sequence, main: [{ ...group, children: [work,
      { ...work, id: "buildup", role: "BUILDUP", work: { kind: "distance", distanceM: 20, durationSeconds: null },
        target: { kind: "EFFORT_GUIDANCE", cue: "synthetic buildup" } },
      { ...work, id: "sprint", work: { kind: "distance", distanceM: 10, durationSeconds: null },
        target: { kind: "SPRINT_REFERENCE", reference: "TEST_NOT_NUMERIC_AUTHORITY" } },
    ] }] }
  })
  const result = resolveAdjustedMethodPrescriptionV3(input)
  if (result.kind !== "resolved") throw Error(result.code)
  expect(result.projection.segmentTargets.map(t => t.segmentId)).toEqual(["v3-work"])
  expect(result.projection.structuralTotals.main.buildupDistanceM).toBe(120)
})

it("rejects changed anchor and stale authority before returning personal targets", () => {
  const input = fixture()
  expect(resolveAdjustedMethodPrescriptionV3({ ...input, source: { ...input.source,
    anchor: { ...input.source.anchor, contentFingerprint: `sha256:${"f".repeat(64)}` } } })).toEqual({ kind: "unavailable", code: "ANCHOR_MISMATCH" })
  expect(resolveAdjustedMethodPrescriptionV3({ ...input, source: { ...input.source, nowMs: 201 } }).kind).toBe("unavailable")
  const receipt = structuredClone(input.receipt)
  Object.assign(receipt.afterTotals.main, { workDistanceM: 1 })
  expect(resolveAdjustedMethodPrescriptionV3({ ...input, receipt }).kind).toBe("unavailable")
})

it("does not let the MAIN source replace support components", () => {
  const input = fixture(undefined, undefined, s => ({ ...s, warmup: s.main.map(n => n.kind === "group"
    ? { ...n, id: "extra-warmup", children: n.children.map(c => ({ ...c, id: `extra-${c.id}` })) }
    : { ...n, id: "extra-warmup" }) }))
  expect(resolveAdjustedMethodPrescriptionV3(input)).toEqual({ kind: "unavailable", code: "COMPONENT_CHANGE_UNSUPPORTED" })
})
it("does not read private extra fields", () => {
  const valid = fixture(), getter = vi.fn(() => "private")
  expect(resolveAdjustedMethodPrescriptionV3(Object.defineProperty(valid, "memo", { enumerable: true, get: getter })).kind).toBe("unavailable")
  expect(getter).not.toHaveBeenCalled()
})
