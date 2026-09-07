import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { PrescriptionSequenceNode } from "@impl/prescription/sequence"
import { resolveAdjustedMethodPrescription } from "./adjusted-method-resolution"
import { RUNTIME_CASES, TODAY } from "./prescription-quality-matrix.test-fixtures"
import { setActiveLocalAccount } from "./account/local-journal-ownership"
import { adjustedMethodResolutionFixture as fixture } from "./adjusted-method-resolution.test-fixtures"

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null); vi.useFakeTimers(); vi.setSystemTime(TODAY) })
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

describe("adjusted MAIN with exact current-record targets", () => {
  it.each(RUNTIME_CASES.slice(0, 4))("$eventDistanceM resolves fractional targets without rewriting the original", event => {
    const input = fixture(event)
    const before = JSON.stringify(input)
    const result = resolveAdjustedMethodPrescription(input)
    if (result.kind !== "resolved") throw Error(result.code)
    expect(result.projection.segmentTargets[0]).toMatchObject({ targetRepSeconds: input.original.selectedAnchor.performanceSeconds * 400 / event.eventDistanceM,
      secondsPerKm: input.original.selectedAnchor.performanceSeconds * 1000 / event.eventDistanceM, distanceM: 400, fixedWorkSeconds: null })
    expect(result.projection.segmentTargets[0]!.targetRepSeconds).not.toBe(Math.round(result.projection.segmentTargets[0]!.targetRepSeconds!))
    expect(result.projection.sequence.warmup).toEqual(input.original.sequence!.warmup)
    expect(result.projection.sequence.cooldown).toEqual(input.original.sequence!.cooldown)
    expect(result.projection.stage).toBe("CANDIDATE_PROJECTION_ONLY")
    expect(result.projection.explanation.kind).toBe("ADJUSTED_CONFIGURATION_EXPLANATION_REQUIRED")
    expect(JSON.stringify(input)).toBe(before)
  })

  it("keeps time-based work explicit and never invents its covered distance", () => {
    const result = resolveAdjustedMethodPrescription(fixture(undefined, { kind: "duration", durationSeconds: 90, distanceM: null }))
    if (result.kind !== "resolved") throw Error(result.code)
    expect(result.projection.segmentTargets[0]).toMatchObject({ targetRepSeconds: null, fixedWorkSeconds: 90, distanceM: null, missing: null })
    expect(result.projection.structuralTotals.qualityDurationSeconds).toBe(180)
    expect(result.projection.structuralTotals.qualityDistanceM).toBeNull()
  })

  it("preserves nested mixed distance/time work and distance recovery without assigning sprint pace", () => {
    const input = fixture(undefined, { kind: "distance", distanceM: 50, durationSeconds: null }, sequence => {
      const work = sequence.main[0]!
      if (work.kind !== "segment") throw Error("Expected segment")
      const children: PrescriptionSequenceNode[] = [work, { ...work, id: "TEST-TIME", work: { kind: "duration", durationSeconds: 40, distanceM: null } },
        { ...work, id: "TEST-SPRINT", target: { kind: "SPRINT_REFERENCE", reference: "TEST-NO-NUMERIC-MODEL" } }]
      return { ...sequence, main: [{ kind: "group", id: "TEST-SET", label: null, repeatCount: 2, children,
        recoveryBetweenRepeats: { mode: "WALK", seconds: null, distanceM: 100 }, recoveryAfter: { mode: "NOT_APPLICABLE", seconds: null } }] }
    })
    const result = resolveAdjustedMethodPrescription(input)
    if (result.kind !== "resolved") throw Error(result.code)
    expect(result.projection.segmentTargets.map(target => target.segmentId)).toEqual(["TEST-WORK", "TEST-TIME"])
    expect(result.projection.sequence.main[0]).toMatchObject({ kind: "group", repeatCount: 2, recoveryBetweenRepeats: { mode: "WALK", distanceM: 100, seconds: null } })
  })

  it.each(["fingerprint", "sourceRef", "event"] as const)("rejects changed anchor %s even when candidate revision remains unchanged", field => {
    const input = fixture()
    const anchor = { ...input.source.anchor, ...(field === "fingerprint" ? { contentFingerprint: `sha256:${"f".repeat(64)}` }
      : field === "sourceRef" ? { sourceRef: "athlete-record:OTHER" } : { eventDistanceM: 1500 }) }
    expect(resolveAdjustedMethodPrescription({ ...input, source: { ...input.source, anchor } })).toEqual({ kind: "unavailable", code: "ANCHOR_MISMATCH" })
  })

  it("rejects expired or modified receipts without returning an executable projection", () => {
    const input = fixture()
    expect(resolveAdjustedMethodPrescription({ ...input, source: { ...input.source, nowMs: 200 } }).kind).toBe("unavailable")
    expect(resolveAdjustedMethodPrescription({ ...input, receipt: { ...input.receipt, delta: { ...input.receipt.delta, qualityDistanceM: 123 } } }).kind).toBe("unavailable")
  })

  it("requires separate component authority instead of overwriting preparation", () => {
    const input = fixture(undefined, undefined, sequence => ({ ...sequence,
      warmup: sequence.main.map(node => ({ ...node, id: "TEST-NEW-WARMUP" })) }))
    expect(resolveAdjustedMethodPrescription(input)).toEqual({ kind: "unavailable", code: "COMPONENT_CHANGE_UNSUPPORTED" })
  })

  it("does not read an extra memo getter", () => {
    const getter = vi.fn(() => "PRIVATE")
    expect(resolveAdjustedMethodPrescription(Object.defineProperty(fixture(), "memo", { enumerable: true, get: getter })).kind).toBe("unavailable")
    expect(getter).not.toHaveBeenCalled()
  })
})
